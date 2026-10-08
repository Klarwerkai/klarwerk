// ================================================================================================
// HAUPTVERANTWORTUNG ÜBERGEBEN — BESTAND, VORSCHAU, ÜBERGABE, DEAKTIVIERUNG (`../verantwortung.ts`).
// ================================================================================================
//
// Auftrag `produkt:20261007:ownership-uebergabe`. Alle Wege gehören der Kontoverwaltung
// (`users.manage`) — dieselbe Schwelle wie die bestehende Autorenübergabe (`transfer-author`).
//
// DER ABLAUF, wie die Oberfläche (`apps/web/src/components/VerantwortungUebergabe.tsx`) ihn fährt:
//   1. Bestand einer Person lesen (`GET …/person/:id`) — mit den wählbaren Nachfolgern.
//   2. Zuteilungen bilden: einzelne Beiträge oder Pakete je Nachfolger.
//   3. Vorschau (`POST …/vorschau`) — schreibt nichts. Zeigt je Nachfolger Anzahl und Beiträge und
//      jede Zeile, die abgelehnt würde, mit Grund.
//   4. Übergabe (`POST …/uebergabe`) — urteilt je Beitrag NEU (die Lage kann sich seit der Vorschau
//      geändert haben) und schreibt je Beitrag einzeln über `KoService.setOwnership` (Änderung und
//      Prüfprotokolleintrag `ko.ownership` gemeinsam). Scheitert ein Teil, antwortet sie 207 und nennt
//      jede offene Zeile; dieselbe Zuteilung ein zweites Mal geschickt holt genau den Rest nach —
//      bereits übergebene Zeilen zählen als `bereitsErledigt`, nichts wird doppelt geschrieben.
//   5. Deaktivierung (`POST …/deaktivierung`) — übergibt optional zuerst und beendet den Zugang nur,
//      wenn danach KEIN Beitrag mehr bei der Person liegt. Sonst 409, und der Zugang bleibt offen.
//
// DEAKTIVIEREN HEISST HIER: den Zugang SOFORT beenden, über den bestehenden Befristungsweg
// (`AuthService.setAccessExpiry` mit dem jetzigen Zeitpunkt). Er trägt schon alles, was eine
// Deaktivierung braucht: Aussperrschutz für den letzten Admin, Prüfprotokoll
// (`user.access-expiry-set`), Sperre beim nächsten Aufruf — und den Weg zurück („Befristung
// beenden" in der Kontokarte). Ein zweiter Sperrbegriff neben Freigabe und Befristung entsteht nicht.
//
// UND LÖSCHEN UND BEFRISTEN: `kontoendeSperre` (unten) hält `DELETE /api/users/:id`,
// `DELETE /api/auth/users/:id` und das Setzen einer Befristung über `PUT /api/users/:id` an, solange
// das Konto noch Hauptverantwortung trägt — sonst entstünden Beiträge ohne Verantwortung, beim
// Befristen eben erst mit dem Fristablauf (Nacharbeit 2, Ben K5).
//
// DER BESTAND schliesst wiederherstellbare Beiträge im Papierkorb ein (Nacharbeit 2, Ben K5):
// `restore` übernimmt die Verantwortung unverändert, also muss auch sie übergeben sein.
//
// SICHTBARKEIT: Titel stehen nur bei Beiträgen, die der Handelnde nach `darfSehen` lesen darf. Bei
// den übrigen (etwa in einem geschlossenen Space) sieht die Kontoverwaltung Kennung, Space und
// Status, aber keinen Inhalt — sie muss diesen Bestand übergeben können, damit beim Personalwechsel
// nichts ungeklärt zurückbleibt.
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { AuditService } from "../../../audit";
import {
  AuthError,
  type AuthService,
  type PublicUser,
  type Role,
  meldung,
  sprache,
} from "../../../auth";
import {
  type KnowledgeObject,
  type KoService,
  ownershipOf,
  responsibleKindOf,
  responsibleOf,
} from "../../../knowledge-object";
import { erstelleVermaechtnisBuch, istBeitragVon } from "../../../output";
import { can } from "../../../rbac";
import { type Guards, type SessionUser, sendError, tokenFromRequest } from "../http";
import { darfSehen } from "../sichtbarkeit";
import type { SpaceFassung, SpacesRepo } from "../spaces";
import {
  ABLEHNUNGSTEXT,
  type Ablehnung,
  type Zuteilung,
  ZuteilungsFehler,
  beurteile,
  kannVerantworten,
  pruefePerson,
  pruefeZuteilungen,
  zugangsstand,
  zulaessigeZiele,
} from "../verantwortung";
import type { NachfolgeEintrag, NachfolgeRepo } from "../verantwortung-nachfolge";

export interface VerantwortungDienste {
  ko: KoService;
  auth: AuthService;
  spaces: SpacesRepo;
  /** Nacharbeit 4: die Nachfolge für neue Beiträge eines befristeten Kontos. */
  nachfolge: NachfolgeRepo;
  audit?: AuditService;
  /** Uhr für Zugangsstand und Deaktivierung — in Tests stellbar. */
  jetzt?: () => number;
}

interface Person {
  id: string;
  name: string | null;
  role: PublicUser["role"] | null;
  zugang: ReturnType<typeof zugangsstand>;
}

interface Zeile {
  koId: string;
  titel: string | null;
  an: string;
  anName: string | null;
}

interface AbgelehnteZeile extends Zeile {
  grund: Ablehnung | "SCHREIBFEHLER";
  text: string;
}

export interface Uebergabeergebnis {
  von: Person;
  uebertragen: Zeile[];
  bereitsErledigt: Zeile[];
  abgelehnt: AbgelehnteZeile[];
  fehlgeschlagen: AbgelehnteZeile[];
  vollstaendig: boolean;
  /** Beiträge, die nach diesem Aufruf noch bei der Person liegen — über den GANZEN Bestand. */
  verbleibt: number;
}

/** Ein Paket: alle Beiträge, die an DENSELBEN Nachfolger gehen. */
interface Gruppe {
  an: { id: string; name: string | null };
  anzahl: number;
  beitraege: { koId: string; titel: string | null }[];
}

const SCHREIBFEHLER_TEXT =
  "Der Beitrag konnte nicht gespeichert werden. Er ist unverändert und kann erneut übertragen werden.";

function fehler(reply: FastifyReply, e: unknown, request: FastifyRequest): void {
  if (e instanceof ZuteilungsFehler) {
    reply.code(400).send({ error: "ZUTEILUNG_UNGUELTIG", message: e.message });
    return;
  }
  // Der Befristungsweg wirft Katalogschlüssel (etwa `LAST_ADMIN_DEMOTION`) — übersetzt wie an den
  // Kontorouten, damit niemand einen Schlüssel statt eines Satzes liest.
  if (e instanceof AuthError) {
    reply
      .code(e.code === "NOT_FOUND" ? 404 : 403)
      .send({ error: e.code, message: meldung(e.message, sprache(request)) });
    return;
  }
  sendError(reply, e);
}

export function verantwortungRoutes(
  dienste: VerantwortungDienste,
  guards: Guards,
): FastifyPluginAsync {
  const jetzt = dienste.jetzt ?? (() => Date.now());

  async function lage() {
    const [konten, spaces, bestand] = await Promise.all([
      dienste.auth.listUsers(),
      dienste.spaces.aktuelle(),
      dienste.ko.listEinschliesslichPapierkorb(),
    ]);
    return { konten, spaces, bestand, zeit: jetzt() };
  }

  function person(id: string, konten: readonly PublicUser[], zeit: number): Person {
    const konto = konten.find((k) => k.id === id);
    return {
      id,
      name: konto?.name ?? null,
      role: konto?.role ?? null,
      zugang: zugangsstand(konto, zeit),
    };
  }

  function name(id: string, konten: readonly PublicUser[]): string | null {
    return konten.find((k) => k.id === id)?.name ?? null;
  }

  /** Der Titel nur für den, der den Beitrag lesen darf — sonst `null`. */
  function titelFuer(user: SessionUser, ko: KnowledgeObject | undefined): string | null {
    return ko && darfSehen(user, ko) ? ko.title : null;
  }

  function spaceName(ko: KnowledgeObject, spaces: readonly SpaceFassung[]): string | null {
    const id = typeof ko.spaceId === "string" ? ko.spaceId : null;
    return id ? (spaces.find((s) => s.id === id)?.name ?? null) : null;
  }

  function bestandVon(von: string, bestand: readonly KnowledgeObject[]): KnowledgeObject[] {
    return bestand.filter((ko) => responsibleOf(ko) === von);
  }

  /** Aktive Konten mit `ko.validate` — die Vertretung nach dem bestehenden Rollenmodell. */
  function vertretung(konten: readonly PublicUser[], ohne: string, zeit: number) {
    return konten
      .filter(
        (k) => k.id !== ohne && zugangsstand(k, zeit) === "aktiv" && can(k.role, "ko.validate"),
      )
      .map((k) => ({ id: k.id, name: k.name, role: k.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Die Vorschau UND die Ausführung — derselbe Urteilsweg. `schreiben = false` verändert nichts.
   */
  async function fuehreAus(
    user: SessionUser,
    von: string,
    zuteilung: readonly Zuteilung[],
    schreiben: boolean,
    log: FastifyRequest["log"],
  ): Promise<Uebergabeergebnis & { gruppen: Gruppe[] }> {
    const { konten, spaces, bestand, zeit } = await lage();
    const nachKennung = new Map(bestand.map((ko) => [ko.id, ko]));
    const ergebnis: Uebergabeergebnis = {
      von: person(von, konten, zeit),
      uebertragen: [],
      bereitsErledigt: [],
      abgelehnt: [],
      fehlgeschlagen: [],
      vollstaendig: false,
      verbleibt: 0,
    };
    const bereit: Zeile[] = [];
    for (const { koId, an } of zuteilung) {
      const ko = nachKennung.get(koId);
      const ziel = konten.find((k) => k.id === an);
      const zeile: Zeile = { koId, titel: titelFuer(user, ko), an, anName: ziel?.name ?? null };
      const urteil = beurteile(ko, von, ziel, an, spaces, zeit);
      if (urteil.art === "abgelehnt") {
        const text = ABLEHNUNGSTEXT[urteil.grund];
        ergebnis.abgelehnt.push({ ...zeile, grund: urteil.grund, text });
      } else if (urteil.art === "erledigt") {
        ergebnis.bereitsErledigt.push(zeile);
      } else if (!schreiben) {
        bereit.push(zeile);
      } else {
        try {
          // Nacharbeit 4 (Ben): das Urteil oben galt dem vorab geladenen Stand. Geschrieben wird
          // nur, wenn die Verantwortung UNTER der Objektsperre noch bei `von` liegt; dann wird
          // allein `owner` des aktuellen Aggregats ersetzt (zwischenzeitliche Mitwirkung bleibt).
          // Hat eine überlappende Übergabe gewonnen, bleibt die Zeile offen.
          const stand = await dienste.ko.uebertrageVerantwortung(koId, von, an, user.id);
          if (stand === "uebertragen") {
            ergebnis.uebertragen.push(zeile);
          } else if (stand === "erledigt") {
            ergebnis.bereitsErledigt.push(zeile);
          } else {
            const grund = "NICHT_MEHR_BEI_PERSON";
            ergebnis.abgelehnt.push({ ...zeile, grund, text: ABLEHNUNGSTEXT[grund] });
          }
        } catch (e) {
          log.error({ err: e, koId }, "Verantwortungsübergabe: Beitrag nicht gespeichert");
          const text = SCHREIBFEHLER_TEXT;
          ergebnis.fehlgeschlagen.push({ ...zeile, grund: "SCHREIBFEHLER", text });
        }
      }
    }
    // Was nach diesem Aufruf noch bei der Person liegt. Bei der Vorschau: abzüglich dessen, was
    // übergeben WÜRDE. Gezählt über den GANZEN Bestand, auch über Beiträge ausserhalb der Zuteilung.
    const weg = new Set([...ergebnis.uebertragen, ...bereit].map((z) => z.koId));
    ergebnis.verbleibt = bestandVon(von, bestand).filter((ko) => !weg.has(ko.id)).length;
    ergebnis.vollstaendig = ergebnis.abgelehnt.length === 0 && ergebnis.fehlgeschlagen.length === 0;
    const gruppen = gruppiere(schreiben ? ergebnis.uebertragen : bereit, konten);
    if (schreiben && (ergebnis.uebertragen.length > 0 || !ergebnis.vollstaendig)) {
      // Die Zusammenfassung des Vorgangs. Je Beitrag steht der bindende Beleg bereits als
      // `ko.ownership` (mit vorherigem und neuem Verantwortlichen) im Protokoll; scheitert nur
      // diese Zusammenfassung, bleibt die Übergabe gültig und der Fehler im Betriebslog.
      try {
        await dienste.audit?.record({
          actor: user.id,
          action: "verantwortung.uebergabe",
          target: von,
          payload: {
            uebertragen: ergebnis.uebertragen.length,
            bereitsErledigt: ergebnis.bereitsErledigt.length,
            abgelehnt: ergebnis.abgelehnt.length,
            fehlgeschlagen: ergebnis.fehlgeschlagen.length,
            verbleibt: ergebnis.verbleibt,
            nachfolger: gruppen.map((g) => ({ an: g.an.id, anzahl: g.anzahl })),
          },
        });
      } catch (e) {
        log.error({ err: e }, "Verantwortungsübergabe: Zusammenfassung nicht protokolliert");
      }
    }
    return { ...ergebnis, gruppen };
  }

  function gruppiere(zeilen: readonly Zeile[], konten: readonly PublicUser[]): Gruppe[] {
    const gruppen = new Map<string, Gruppe>();
    for (const z of zeilen) {
      const g = gruppen.get(z.an) ?? {
        an: { id: z.an, name: name(z.an, konten) },
        anzahl: 0,
        beitraege: [],
      };
      g.anzahl += 1;
      g.beitraege.push({ koId: z.koId, titel: z.titel });
      gruppen.set(z.an, g);
    }
    return [...gruppen.values()].sort((a, b) => (a.an.name ?? "").localeCompare(b.an.name ?? ""));
  }

  function eingabe(body: unknown): { von: string; zuteilung: Zuteilung[] } {
    const b = (body ?? {}) as { von?: unknown; zuteilung?: unknown };
    return { von: pruefePerson(b.von), zuteilung: pruefeZuteilungen(b.zuteilung) };
  }

  return async (app) => {
    // Der Bestand einer Person: alles, wofür sie heute hauptverantwortlich ist, mit Autorschaft und
    // Verantwortungsart getrennt — dazu die wählbaren Nachfolger und die Vertretung.
    app.get<{ Params: { id: string } }>("/api/verantwortung/person/:id", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const { konten, spaces, bestand, zeit } = await lage();
      const von = request.params.id;
      const beitraege = bestandVon(von, bestand)
        .map((ko) => {
          const own = ownershipOf(ko);
          return {
            koId: ko.id,
            version: ko.version,
            titel: titelFuer(user, ko),
            sichtbar: darfSehen(user, ko),
            status: ko.status,
            spaceName: spaceName(ko, spaces),
            verantwortungsart: responsibleKindOf(ko),
            autor: { id: ko.author, name: name(ko.author, konten) },
            ursprungsautor: { id: ko.originalAuthor, name: name(ko.originalAuthor, konten) },
            mitwirkende: (own?.reviewers.length ?? 0) + (own?.validators.length ?? 0),
            imPapierkorb: Boolean(ko.deletedAt),
            // Nacharbeit 2 (Ben K2): die Nachfolger, die GENAU DIESEN Beitrag übernehmen dürfen
            // (aktiv, unbefristet, Bearbeitungsrecht, Leserecht am Beitrag). Die Oberfläche bietet
            // für ein Paket nur an, wer für jeden seiner Beiträge hier steht; die Ausführung prüft
            // trotzdem jede Zeile neu.
            zulaessig: zulaessigeZiele(ko, von, konten, spaces, zeit),
          };
        })
        .sort((a, b) => (a.titel ?? "￿").localeCompare(b.titel ?? "￿"));
      const nachfolge = await dienste.nachfolge.lies(von);
      reply.code(200).send({
        person: person(von, konten, zeit),
        // Nacharbeit 4: wer neue Beiträge eines befristeten Kontos verantwortet (sonst `null`).
        nachfolgeBeiBefristung: nachfolge
          ? { id: nachfolge.nachfolger, name: name(nachfolge.nachfolger, konten) }
          : null,
        anzahl: beitraege.length,
        nichtEinsehbar: beitraege.filter((b) => !b.sichtbar).length,
        beitraege,
        ziele: konten
          .filter((k) => k.id !== von && kannVerantworten(k, zeit))
          .map((k) => ({ id: k.id, name: k.name, role: k.role }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        vertretung: vertretung(konten, von, zeit),
      });
    });

    // Auftrag `aufnahme:20260922:gesamt-wissensvermaechtnis` (R-1642 / R-2175): das Wissens-
    // Vermächtnis-Buch einer Person — alle ihre Beiträge als Autorin oder Autor, auf Knopfdruck
    // aus der Kontokarte. Schreibt nichts am Wissen. Aufgenommen wird nur, was der Handelnde lesen
    // darf, validiert und nicht vertraulich ist (`services/output/src/vermaechtnis.ts`). Das
    // Protokoll hält fest, DASS jemand das Buch einer Person erzeugt hat — mit Zählern, ohne Titel.
    app.get<{ Params: { id: string } }>(
      "/api/verantwortung/person/:id/vermaechtnis",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const { konten, bestand, zeit } = await lage();
        const id = request.params.id;
        if (!konten.some((k) => k.id === id) && !bestand.some((ko) => istBeitragVon(ko, id))) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Konto nicht gefunden." });
          return;
        }
        const buch = erstelleVermaechtnisBuch({
          person: { id, name: name(id, konten) },
          bestand,
          darfSehen: (ko) => darfSehen(user, ko),
          name: (kennung) => name(kennung, konten),
          jetzt: zeit,
        });
        try {
          await dienste.audit?.record({
            actor: user.id,
            action: "vermaechtnis.erzeugt",
            target: id,
            payload: { aufgenommen: buch.aufgenommen, ausgelassen: buch.ausgelassen },
          });
        } catch (e) {
          request.log.error({ err: e }, "Vermächtnis-Buch: Erzeugung nicht protokolliert");
        }
        reply.code(200).send(buch);
      },
    );

    // Bestand ohne aktive Hauptverantwortung — je Person nur die Anzahl, kein Inhalt. Das ist die
    // Liste, die nach einem Personalwechsel leer sein soll.
    app.get("/api/verantwortung/ungeklaert", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const { konten, bestand, zeit } = await lage();
      const je = new Map<string, number>();
      for (const ko of bestand) {
        const wer = responsibleOf(ko);
        if (
          !kannVerantworten(
            konten.find((k) => k.id === wer),
            zeit,
          )
        ) {
          je.set(wer, (je.get(wer) ?? 0) + 1);
        }
      }
      reply.code(200).send({
        personen: [...je]
          .map(([id, anzahl]) => ({ ...person(id, konten, zeit), anzahl }))
          .sort((a, b) => b.anzahl - a.anzahl),
        vertretung: vertretung(konten, "", zeit),
      });
    });

    // Die Vorschau. Schreibt nichts.
    app.post<{ Body: unknown }>("/api/verantwortung/vorschau", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        const { von, zuteilung } = eingabe(request.body);
        const v = await fuehreAus(user, von, zuteilung, false, request.log);
        reply.code(200).send({
          von: v.von,
          gesamt: zuteilung.length,
          bereit: v.gruppen.reduce((n, g) => n + g.anzahl, 0),
          gruppen: v.gruppen,
          abgelehnt: v.abgelehnt,
          bereitsErledigt: v.bereitsErledigt,
          verbleibt: v.verbleibt,
        });
      } catch (e) {
        fehler(reply, e, request);
      }
    });

    // Die Übergabe. 200 nur, wenn jede Zeile übergeben oder schon erledigt ist; sonst 207 mit jeder
    // offenen Zeile — eine unvollständige Übergabe sieht nie wie eine vollständige aus.
    app.post<{ Body: unknown }>("/api/verantwortung/uebergabe", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        const { von, zuteilung } = eingabe(request.body);
        const { gruppen, ...ergebnis } = await fuehreAus(user, von, zuteilung, true, request.log);
        reply.code(ergebnis.vollstaendig ? 200 : 207).send({ ...ergebnis, gruppen });
      } catch (e) {
        fehler(reply, e, request);
      }
    });

    // Übergeben und deaktivieren in EINEM Schritt — deaktiviert wird nur ein Konto ohne Restbestand.
    app.post<{ Body: unknown }>("/api/verantwortung/deaktivierung", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        const b = (request.body ?? {}) as { person?: unknown; zuteilung?: unknown };
        const von = pruefePerson(b.person);
        if (von === user.id) {
          reply.code(400).send({
            error: "SELBST",
            message: "Das eigene Konto kann hier nicht deaktiviert werden.",
          });
          return;
        }
        const konto = (await dienste.auth.listUsers()).find((k) => k.id === von);
        if (!konto) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Konto nicht gefunden." });
          return;
        }
        const mitZuteilung = Array.isArray(b.zuteilung) && b.zuteilung.length > 0;
        const uebergabe = mitZuteilung
          ? await fuehreAus(user, von, pruefeZuteilungen(b.zuteilung), true, request.log)
          : null;
        const verbleibt = bestandVon(von, await dienste.ko.listEinschliesslichPapierkorb()).length;
        if (verbleibt > 0) {
          reply.code(409).send({
            error: "BESTAND_OFFEN",
            message: `Das Konto ist noch für ${verbleibt} Beiträge hauptverantwortlich. Es bleibt aktiv, bis alle übergeben sind.`,
            verbleibt,
            uebergabe,
          });
          return;
        }
        // Schon ohne Zugang (abgelaufen/gesperrt): nichts zu beenden — eine Wiederholung ist kein
        // Fehler und schreibt keinen zweiten Vermerk. Ein BEFRISTETES Konto endet hier sofort.
        const zugang = zugangsstand(konto, jetzt());
        if (zugang === "abgelaufen" || zugang === "gesperrt") {
          reply.code(200).send({
            konto: person(von, [konto], jetzt()),
            bereitsInaktiv: true,
            uebergabe,
          });
          return;
        }
        const nachher = await dienste.auth.setAccessExpiry(
          von,
          new Date(jetzt()).toISOString(),
          user.id,
        );
        reply.code(200).send({
          konto: person(von, [nachher], jetzt()),
          bereitsInaktiv: false,
          uebergabe,
        });
      } catch (e) {
        fehler(reply, e, request);
      }
    });
  };
}

/**
 * Hält jedes KONTOENDE an, solange das Konto noch Hauptverantwortung trägt:
 *   · das Löschen (`DELETE /api/users/:id`, `DELETE /api/auth/users/:id`) und
 *   · das Setzen einer Befristung (`PUT /api/users/:id` mit `accessExpiresAt` als Zeitpunkt) — sie
 *     beendet den Zugang mit dem Fristablauf von selbst (Nacharbeit 2, Ben K5). Das NEHMEN einer
 *     Befristung (`null`) und jede andere Kontoänderung bleiben frei.
 * Gezählt wird der ganze Bestand einschliesslich des wiederherstellbaren Papierkorbs.
 *
 * Als Hook an der Wurzel und nicht in den Kontorouten selbst: die Routen in `services/auth` kennen
 * keine Wissensobjekte (Modulgrenze). Er greift nur für eine angemeldete Kontoverwaltung — jeder
 * andere bekommt unverändert die Absage der Route, ohne dass hier etwas über den Bestand verraten
 * wird.
 */
export function kontoendeSperre(
  app: FastifyInstance,
  dienste: Pick<VerantwortungDienste, "ko" | "auth" | "nachfolge"> & { jetzt?: () => number },
): void {
  const jetzt = dienste.jetzt ?? (() => Date.now());
  const LOESCHWEGE = new Set(["/api/users/:id", "/api/auth/users/:id"]);
  // Die Kontowege, nach denen ein Konto befristet UND mit Bearbeitungsrecht dastehen kann.
  const KONTOWEGE = new Set([
    "PUT /api/users/:id",
    "POST /api/users",
    "POST /api/auth/users/:id/approve",
  ]);
  // Was der Vorlauf (preHandler) für den Nachlauf (onSend/onResponse) derselben Anfrage festhält.
  interface Vorlauf {
    handelnder: string;
    nachfolge: string | undefined;
    /** Vor der Änderung vorweggenommen gesetzt: der Eintrag davor, für die Rücknahme. */
    vorher?: { konto: string; eintrag: NachfolgeEintrag | undefined };
    /** Der Antwortrumpf der Route — synchron im onSend gemerkt, ausgewertet im onResponse. */
    antwort?: string;
  }
  const vorlauf = new WeakMap<object, Vorlauf>();

  /**
   * Die Nachfolge für ein befristetes Konto: die benannte, sonst die bisherige (noch zulässig),
   * sonst die handelnde Kontoverwaltung — oder `undefined`, wenn keine davon zulässig ist.
   */
  async function waehleNachfolger(kontoId: string, v: Vorlauf, zeit: number) {
    const konten = await dienste.auth.listUsers();
    const zulaessig = (kandidat: string | undefined): kandidat is string =>
      kandidat !== undefined &&
      kandidat !== kontoId &&
      kannVerantworten(
        konten.find((k) => k.id === kandidat),
        zeit,
      );
    const bisher = (await dienste.nachfolge.lies(kontoId))?.nachfolger;
    return { bisher, nachfolger: [v.nachfolge, bisher, v.handelnder].find(zulaessig) };
  }

  /** Braucht dieses Konto (in diesem Stand) eine Nachfolge? Befristet und mit Anlagerecht. */
  function brauchtNachfolge(konto: PublicUser, zeit: number): boolean {
    return zugangsstand(konto, zeit) === "befristet" && can(konto.role, "ko.create");
  }

  /** Der Kontostand, den diese Änderung erzeugen WIRD (Rolle, Freigabe, Befristung aus dem Rumpf). */
  function vorhersage(konto: PublicUser, pfad: string, rumpf: Record<string, unknown>): PublicUser {
    const { accessExpiresAt: bisherigesEnde, ...ohneEnde } = konto;
    const role = typeof rumpf.role === "string" ? (rumpf.role as Role) : konto.role;
    const approved = pfad.endsWith("/approve") || rumpf.approve === true || konto.approved;
    const ende =
      typeof rumpf.accessExpiresAt === "string"
        ? rumpf.accessExpiresAt
        : rumpf.accessExpiresAt === null
          ? undefined
          : bisherigesEnde;
    return ende === undefined
      ? { ...ohneEnde, role, approved }
      : { ...ohneEnde, role, approved, accessExpiresAt: ende };
  }

  app.addHook("preHandler", async (request, reply) => {
    const pfad = request.routeOptions.url ?? "";
    const loeschen = request.method === "DELETE" && LOESCHWEGE.has(pfad);
    const kontoweg = KONTOWEGE.has(`${request.method} ${pfad}`);
    const rumpf = (request.body ?? {}) as {
      accessExpiresAt?: unknown;
      verantwortungNachfolge?: unknown;
    };
    const ende = rumpf.accessExpiresAt;
    const befristen =
      request.method === "PUT" && pfad === "/api/users/:id" && typeof ende === "string";
    if (!loeschen && !kontoweg) {
      return;
    }
    const token = tokenFromRequest(request);
    const handelnder = token ? await dienste.auth.authenticate(token) : undefined;
    if (!handelnder || !can(handelnder.role, "users.manage")) {
      return;
    }
    const id = (request.params as { id?: unknown }).id;
    if (kontoweg) {
      // Nacharbeit 4 (Ben K5): eine ausdrücklich benannte Nachfolge muss heute zulässig sein —
      // aktiv, unbefristet, mit Bearbeitungsrecht und nicht das Konto selbst. Sonst wird nichts
      // geändert.
      const gewuenscht = rumpf.verantwortungNachfolge;
      if (gewuenscht !== undefined) {
        const konten = await dienste.auth.listUsers();
        const ziel = konten.find((k) => k.id === gewuenscht);
        if (
          typeof gewuenscht !== "string" ||
          gewuenscht === id ||
          !kannVerantworten(ziel, jetzt())
        ) {
          reply.code(400).send({
            error: "NACHFOLGE_UNZULAESSIG",
            message:
              "Die Nachfolge für neue Beiträge muss ein aktives, unbefristetes Konto mit Bearbeitungsrecht sein. Es wurde nichts geändert.",
          });
          return reply;
        }
      }
      const v: Vorlauf = {
        handelnder: handelnder.id,
        nachfolge: typeof gewuenscht === "string" ? gewuenscht : undefined,
      };
      vorlauf.set(request, v);
      // Nacharbeit 5: die Nachfolge steht VOR der Kontoänderung — nicht in einem asynchronen
      // onSend (im Haus verboten: Doppel-Send-Fenster, `sync-onsend-hooks.test.ts`). Damit kann das
      // befristete Konto ab der ersten Sekunde der Befristung nichts ohne Nachfolge anlegen.
      // Scheitert die Änderung, nimmt `onResponse` den vorweggenommenen Eintrag zurück.
      const bestehend =
        typeof id === "string"
          ? (await dienste.auth.listUsers()).find((k) => k.id === id)
          : undefined;
      if (bestehend) {
        const zeit = jetzt();
        const danach = vorhersage(bestehend, pfad, rumpf as Record<string, unknown>);
        if (brauchtNachfolge(danach, zeit)) {
          const { bisher, nachfolger } = await waehleNachfolger(bestehend.id, v, zeit);
          if (nachfolger !== undefined && nachfolger !== bisher) {
            v.vorher = { konto: bestehend.id, eintrag: await dienste.nachfolge.lies(bestehend.id) };
            await dienste.nachfolge.setze({
              konto: bestehend.id,
              nachfolger,
              gesetztVon: handelnder.id,
              gesetztAm: new Date(zeit).toISOString(),
            });
          }
        }
      }
    }
    if (typeof id !== "string" || (!loeschen && !befristen)) {
      return;
    }
    const bestand = await dienste.ko.listEinschliesslichPapierkorb();
    const verbleibt = bestand.filter((ko) => responsibleOf(ko) === id).length;
    if (verbleibt > 0) {
      // `return reply` beendet die Anfrage hier — der Handler der Route läuft danach nicht mehr.
      reply.code(409).send({
        error: "BESTAND_OFFEN",
        message: befristen
          ? `Das Konto ist noch für ${verbleibt} Beiträge hauptverantwortlich. Eine Befristung beendet den Zugang von selbst — bitte zuerst übergeben. Es wurde nichts geändert.`
          : `Das Konto ist noch für ${verbleibt} Beiträge hauptverantwortlich. Bitte zuerst übergeben.`,
        verbleibt,
      });
      return reply;
    }
  });

  // Nacharbeit 5: SYNCHRON und im Callback-Stil, wie jeder onSend-Hook im Haus. Er merkt sich nur
  // den Antwortrumpf der Kontoroute; ausgewertet wird er nach dem Senden (`onResponse`).
  app.addHook("onSend", (request, _reply, payload, done) => {
    const v = vorlauf.get(request);
    if (v && typeof payload === "string") {
      v.antwort = payload;
    }
    done(null, payload);
  });

  // Nach dem Senden: der Stand der Nachfolge folgt dem, was die Route TATSÄCHLICH gespeichert hat.
  //   · Abgewiesen (kein 2xx): eine vorweggenommene Nachfolge wird zurückgenommen.
  //   · Gelungen, Konto danach nicht befristet oder ohne Anlagerecht: die Nachfolge entfällt.
  //   · Gelungen, befristet mit Anlagerecht, noch ohne zulässige Nachfolge (neu angelegtes Konto):
  //     sie wird jetzt gesetzt. Bis dahin legt das Konto nichts an (`NACHFOLGE_FEHLT`), es entsteht
  //     also auch in diesem Augenblick kein Beitrag ohne Verantwortung.
  app.addHook("onResponse", async (request, reply) => {
    const v = vorlauf.get(request);
    if (!v) {
      return;
    }
    try {
      if (reply.statusCode < 200 || reply.statusCode >= 300) {
        if (v.vorher) {
          await (v.vorher.eintrag
            ? dienste.nachfolge.setze(v.vorher.eintrag)
            : dienste.nachfolge.entferne(v.vorher.konto));
        }
        return;
      }
      let konto: PublicUser | undefined;
      try {
        const gelesen = JSON.parse(v.antwort ?? "") as Partial<PublicUser> | null;
        konto = gelesen && typeof gelesen.id === "string" ? (gelesen as PublicUser) : undefined;
      } catch {
        konto = undefined;
      }
      if (!konto) {
        return;
      }
      const zeit = jetzt();
      if (!brauchtNachfolge(konto, zeit)) {
        await dienste.nachfolge.entferne(konto.id);
        return;
      }
      const { bisher, nachfolger } = await waehleNachfolger(konto.id, v, zeit);
      if (nachfolger !== undefined && nachfolger !== bisher) {
        await dienste.nachfolge.setze({
          konto: konto.id,
          nachfolger,
          gesetztVon: v.handelnder,
          gesetztAm: new Date(zeit).toISOString(),
        });
      }
    } catch (fehler) {
      // Fail-closed: ohne gespeicherte Nachfolge legt ein befristetes Konto nichts an.
      request.log.error({ err: fehler }, "Nachfolge bei Befristung nicht angeglichen");
    }
  });
}
