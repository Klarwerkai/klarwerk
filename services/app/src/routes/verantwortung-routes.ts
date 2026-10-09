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
import { can } from "../../../rbac";
import { type Guards, type SessionUser, sendError, tokenFromRequest } from "../http";
import { darfSehen } from "../sichtbarkeit";
import type { SpaceFassung, SpacesRepo } from "../spaces";
import {
  ABLEHNUNGSTEXT,
  type Ablehnung,
  UEBERGABE_HOECHSTZAHL,
  type Zuteilung,
  ZuteilungsFehler,
  beurteile,
  kannVerantworten,
  pruefePerson,
  pruefeZuteilungen,
  vorgangZielGrund,
  zugangsendeGespeichert,
  zugangsstand,
  zulaessigeZiele,
} from "../verantwortung";
import type { NachfolgeEintrag, NachfolgeRepo } from "../verantwortung-nachfolge";
import type {
  OffeneVorgaenge,
  VorgangArt,
  VorgangZuteilung,
  Wissensuebergabe,
} from "../wissensuebergabe";

export interface VerantwortungDienste {
  ko: KoService;
  auth: AuthService;
  spaces: SpacesRepo;
  /** Nacharbeit 4: die Nachfolge für neue Beiträge eines befristeten Kontos. */
  nachfolge: NachfolgeRepo;
  audit?: AuditService;
  /**
   * ADMIN-04: Entwürfe, offene Lücken und offene Prüfaufgaben je Person — dieselbe Erhebung wie
   * die Wissensübergabe (`Wissensuebergabe.offeneVorgaenge`). Fehlt sie, heisst die Antwort
   * „nicht erhoben" (`null`), nie „keine".
   */
  offeneVorgaenge?: (personen: readonly string[]) => Promise<Map<string, OffeneVorgaenge>>;
  /**
   * ADMIN-05: der gemeinsame Übergabeablauf überträgt die offenen Vorgänge über die vorhandene
   * Wissensübergabe — einzeln zugeteilt, auf mehrere Nachfolger verteilt. Fehlt sie, antwortet der
   * Ablauf 503, statt Vorgänge stillschweigend auszulassen.
   */
  vorgaengeWeg?: Pick<Wissensuebergabe, "vorgaengeUebergeben" | "ausgeschlossen">;
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

// ================================================================================================
// ADMIN-05 · DER GEMEINSAME ÜBERGABEABLAUF (`POST /api/verantwortung/ablauf[/vorschau]`).
// ================================================================================================
//
// EIN Einstieg für die beiden vorhandenen Wege — kein dritter Übergabeweg. Beiträge laufen über
// `fuehreAus` (Hauptverantwortung, wie oben), offene Vorgänge über die Wissensübergabe
// (`Wissensuebergabe.vorgaengeUebergeben`). Neu ist nur, was beide verbindet:
//   · UMFANG: `gezielt` (nur die zugeteilten Beiträge/Vorgänge, Zugang bleibt) oder `ausscheiden`
//     (ALLES, was bei der Person liegt, muss zugeteilt sein — sonst ist nichts bestätigbar).
//   · VORSCHAU je Nachfolger-Paket: Objekte, Anzahl, Rechtewirkung; dazu, was nicht übertragbar
//     ist (mit Grund), was noch keinem Paket zugeteilt ist und was ausgeschlossen bleibt.
//   · BESTÄTIGEN prüft der Server selbst: die Ausführung urteilt die Vorschau neu und schreibt
//     NICHTS, wenn sie nicht bestätigbar ist (409). Eine Oberfläche, die den Knopf freigibt, reicht
//     dafür nicht.
//   · ZUGANG: `beenden` nur im Umfang `ausscheiden` und nur, wenn danach weder Beitrag noch
//     offener Vorgang bei der Person liegt — über denselben Befristungsweg wie die Deaktivierung.
//   · BILANZ vorher/nachher als EIN Protokolleintrag `verantwortung.ablauf` (nur Kennungen und
//     Anzahlen), nach einem Neuladen über `GET …/person/:id/ablaeufe` wieder lesbar.
type Umfang = "gezielt" | "ausscheiden";
type Zugangsentscheidung = "behalten" | "beenden";
type EintragArt = "beitrag" | VorgangArt;

interface Ablaufeingabe {
  von: string;
  umfang: Umfang;
  beitraege: Zuteilung[];
  vorgaenge: VorgangZuteilung[];
  zugang: Zugangsentscheidung;
}

/** Eine Zeile des Ablaufs — Beitrag oder Vorgang, mit Ziel. Titel nur, wo er gezeigt werden darf. */
interface Eintrag {
  art: EintragArt;
  id: string;
  titel: string | null;
  an: string;
  anName: string | null;
}

interface OffenerEintrag extends Eintrag {
  grund: string;
  text: string;
}

interface Bilanz {
  beitraege: number;
  entwuerfe: number;
  luecken: number;
  pruefaufgaben: number;
}

interface Paket {
  an: { id: string; name: string | null; role: PublicUser["role"] | null };
  anzahl: number;
  eintraege: Eintrag[];
  bereitsErledigt: number;
  /** Je Art die Anzahl — daraus nennt die Oberfläche die Rechtewirkung. */
  wirkung: Record<EintragArt, number>;
}

/**
 * Nacharbeit 1 (Ben K6): der Beginn eines Ablaufs, wie er VOR dem ersten Schreiben im Protokoll
 * steht (`verantwortung.ablauf-begonnen`). Offen ist er, solange kein Abschlussvermerk
 * `verantwortung.ablauf` ihn über `beginn` schliesst.
 */
interface Ablaufbeginn {
  seq: number;
  at: string;
  umfang: Umfang;
  vorher: Bilanz;
  beitraege: Zuteilung[];
  vorgaenge: VorgangZuteilung[];
}

/**
 * Ergänzt einen Plan um Zuteilungen, die er noch nicht WÖRTLICH enthält. Derselbe Eintrag mit einem
 * anderen Ziel bleibt bewusst als zweite Zeile stehen: welches Ziel ihn heute trägt, entscheidet die
 * Bilanz (`planStand`) am tatsächlichen Stand.
 */
function planErgaenzen<T extends { an: string; koId?: string; art?: string; id?: string }>(
  plan: T[],
  neu: readonly T[],
): void {
  // Ein fester Schlüssel statt `JSON.stringify`: aus dem Protokoll gelesene Felder können in anderer
  // Reihenfolge zurückkommen (jsonb).
  const schluesselVon = (z: T): string => [z.art ?? "beitrag", z.koId ?? z.id, z.an].join("|");
  const vorhanden = new Set(plan.map(schluesselVon));
  for (const z of neu) {
    const schluessel = schluesselVon(z);
    if (!vorhanden.has(schluessel)) {
      vorhanden.add(schluessel);
      plan.push(z);
    }
  }
}

const VORGANGARTEN: readonly VorgangArt[] = ["entwurf", "luecke", "pruefaufgabe"];

function summe(b: Bilanz): number {
  return b.beitraege + b.entwuerfe + b.luecken + b.pruefaufgaben;
}

/** Die offenen Vorgänge einer Person als Zuteilungsschlüssel (`art:id`). */
function vorgangsschluessel(art: VorgangArt, id: string): string {
  return `${art}:${id}`;
}

/** Form der Vorgangszuteilung: bekannte Art, Kennungen, je Vorgang höchstens EIN Ziel. */
function pruefeVorgaenge(roh: unknown): VorgangZuteilung[] {
  if (roh === undefined) {
    return [];
  }
  if (!Array.isArray(roh)) {
    throw new ZuteilungsFehler("Die Vorgangszuteilung muss eine Liste sein.");
  }
  if (roh.length > UEBERGABE_HOECHSTZAHL) {
    throw new ZuteilungsFehler(
      `Höchstens ${UEBERGABE_HOECHSTZAHL} Vorgänge je Übergabe — bitte in Pakete teilen.`,
    );
  }
  const raus = new Map<string, VorgangZuteilung>();
  for (const eintrag of roh) {
    const e = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
      string,
      unknown
    >;
    const art = VORGANGARTEN.find((a) => a === e.art);
    const id = typeof e.id === "string" && e.id.trim() ? e.id.trim() : null;
    const an = typeof e.an === "string" && e.an.trim() ? e.an.trim() : null;
    if (!art || id === null || an === null) {
      throw new ZuteilungsFehler(
        "Jeder Vorgang braucht art (entwurf, luecke, pruefaufgabe), id und an.",
      );
    }
    const schluessel = vorgangsschluessel(art, id);
    const vorhanden = raus.get(schluessel);
    if (vorhanden && vorhanden.an !== an) {
      throw new ZuteilungsFehler("Ein Vorgang ist zwei verschiedenen Nachfolgern zugeteilt.");
    }
    raus.set(schluessel, { art, id, an });
  }
  return [...raus.values()];
}

function ablaufEingabe(body: unknown): Ablaufeingabe {
  const b = (body ?? {}) as Record<string, unknown>;
  const von = pruefePerson(b.person);
  const umfangRoh = b.umfang;
  if (umfangRoh !== "gezielt" && umfangRoh !== "ausscheiden") {
    throw new ZuteilungsFehler("Der Umfang fehlt: gezielt oder ausscheiden.");
  }
  const umfang: Umfang = umfangRoh;
  const zugang: Zugangsentscheidung | null =
    b.zugang === undefined || b.zugang === "behalten"
      ? "behalten"
      : b.zugang === "beenden"
        ? "beenden"
        : null;
  if (zugang === null) {
    throw new ZuteilungsFehler("Die Zugangsentscheidung ist behalten oder beenden.");
  }
  if (zugang === "beenden" && umfang !== "ausscheiden") {
    throw new ZuteilungsFehler(
      "Den Zugang beendet nur die vollständige Ausscheidensübergabe — die gezielte Übergabe lässt ihn unverändert.",
    );
  }
  if (b.beitraege !== undefined && !Array.isArray(b.beitraege)) {
    throw new ZuteilungsFehler("Die Beitragszuteilung muss eine Liste sein.");
  }
  const beitraege =
    Array.isArray(b.beitraege) && b.beitraege.length > 0 ? pruefeZuteilungen(b.beitraege) : [];
  const vorgaenge = pruefeVorgaenge(b.vorgaenge);
  if (umfang === "gezielt" && beitraege.length + vorgaenge.length === 0) {
    throw new ZuteilungsFehler("Es ist nichts zugeteilt.");
  }
  return { von, umfang, beitraege, vorgaenge, zugang };
}

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

  /** ADMIN-05: was heute bei der Person liegt — Beiträge (mit Papierkorb) und offene Vorgänge. */
  async function bilanzVon(von: string): Promise<{ bilanz: Bilanz; vorgaenge: OffeneVorgaenge }> {
    const [bestand, je] = await Promise.all([
      dienste.ko.listEinschliesslichPapierkorb(),
      // `bilanzVon` läuft nur, wenn `offeneVorgaenge` verdrahtet ist (s. `ablauf`).
      (dienste.offeneVorgaenge as NonNullable<VerantwortungDienste["offeneVorgaenge"]>)([von]),
    ]);
    const vorgaenge = je.get(von) ?? { entwuerfe: [], luecken: [], pruefaufgaben: [] };
    return {
      bilanz: {
        beitraege: bestandVon(von, bestand).length,
        entwuerfe: vorgaenge.entwuerfe.length,
        luecken: vorgaenge.luecken.length,
        pruefaufgaben: vorgaenge.pruefaufgaben.length,
      },
      vorgaenge,
    };
  }

  /** Nacharbeit 1 (Ben K6): der jüngste Beginn dieser Person ohne Abschlussvermerk — oder `null`. */
  async function offenerAblaufbeginn(von: string): Promise<Ablaufbeginn | null> {
    const audit = dienste.audit as AuditService;
    const [begonnen, fortsetzungen, abschluesse] = await Promise.all([
      audit.list({ action: "verantwortung.ablauf-begonnen", target: von }),
      audit.list({ action: "verantwortung.ablauf-fortgesetzt", target: von }),
      audit.list({ action: "verantwortung.ablauf", target: von }),
    ]);
    const geschlossen = new Set(abschluesse.map((x) => x.payload.beginn));
    const offen = [...begonnen].reverse().find((x) => !geschlossen.has(x.seq));
    if (!offen) {
      return null;
    }
    // Nacharbeit 2 (Ben K6): der Plan ist die VEREINIGUNG aus dem Beginn und jeder protokollierten
    // Fortsetzung — so kennt die Bilanz auch eine Restzuordnung, die ein späterer Lauf geändert hat.
    const plaene = [offen, ...fortsetzungen.filter((x) => x.payload.beginn === offen.seq)];
    const beitraege: Zuteilung[] = [];
    const vorgaenge: VorgangZuteilung[] = [];
    for (const x of plaene) {
      if (Array.isArray(x.payload.beitraege)) {
        planErgaenzen(beitraege, x.payload.beitraege as Zuteilung[]);
      }
      if (Array.isArray(x.payload.vorgaenge)) {
        planErgaenzen(vorgaenge, x.payload.vorgaenge as VorgangZuteilung[]);
      }
    }
    const p = offen.payload;
    return {
      seq: offen.seq,
      at: offen.at,
      umfang: p.umfang === "gezielt" ? "gezielt" : "ausscheiden",
      vorher: p.vorher as Bilanz,
      beitraege,
      vorgaenge,
    };
  }

  /**
   * Was aus dem Plan eines Beginns JETZT beim jeweiligen Nachfolger liegt — gelesen über dieselben
   * Urteilswege wie die Vorschau (`erledigt`), also ohne zu schreiben.
   */
  async function planStand(
    user: SessionUser,
    von: string,
    beginn: Ablaufbeginn,
    log: FastifyRequest["log"],
  ): Promise<{ an: string; beitraege: number; vorgaenge: number }[]> {
    const weg = dienste.vorgaengeWeg as NonNullable<VerantwortungDienste["vorgaengeWeg"]>;
    const b =
      beginn.beitraege.length > 0 ? await fuehreAus(user, von, beginn.beitraege, false, log) : null;
    const v = await weg.vorgaengeUebergeben(von, beginn.vorgaenge, user.id, false);
    const je = new Map<string, { an: string; beitraege: number; vorgaenge: number }>();
    const zaehle = (an: string, art: "beitraege" | "vorgaenge"): void => {
      const eintrag = je.get(an) ?? { an, beitraege: 0, vorgaenge: 0 };
      eintrag[art] += 1;
      je.set(an, eintrag);
    };
    for (const z of b?.bereitsErledigt ?? []) {
      zaehle(z.an, "beitraege");
    }
    for (const z of v.bereitsErledigt) {
      zaehle(z.an, "vorgaenge");
    }
    return [...je.values()];
  }

  /**
   * ADMIN-05 · DIE VORSCHAU DES GEMEINSAMEN ABLAUFS — schreibt nichts. Dieselbe Funktion urteilt vor
   * der Ausführung erneut; ist sie dann nicht bestätigbar, wird nichts geschrieben.
   */
  async function ablaufVorschau(user: SessionUser, e: Ablaufeingabe, log: FastifyRequest["log"]) {
    const weg = dienste.vorgaengeWeg as NonNullable<VerantwortungDienste["vorgaengeWeg"]>;
    const { konten, spaces, bestand, zeit } = await lage();
    const nachKennung = new Map(bestand.map((ko) => [ko.id, ko]));
    const vorher = await bilanzVon(e.von);
    // Entwürfe und Lücken nur als Kennung (privat bzw. vertraulich) — wie die Wissensübergabe.
    const titel = (art: EintragArt, id: string): string | null =>
      art === "beitrag" || art === "pruefaufgabe" ? titelFuer(user, nachKennung.get(id)) : null;
    const eintrag = (art: EintragArt, id: string, an: string): Eintrag => ({
      art,
      id,
      titel: titel(art, id),
      an,
      anName: name(an, konten),
    });

    // Die Ziele der Vorgänge — dieselbe Grundregel wie bei Beiträgen, je Art das nötige Recht.
    const abgelehnt: OffenerEintrag[] = [];
    const zulaessig: VorgangZuteilung[] = [];
    for (const z of e.vorgaenge) {
      const grund: Ablehnung | null =
        z.an === e.von
          ? "ZIEL_IST_PERSON"
          : vorgangZielGrund(
              z.art,
              konten.find((k) => k.id === z.an),
              z.art === "pruefaufgabe" ? nachKennung.get(z.id) : undefined,
              spaces,
              zeit,
            );
      if (grund === null) {
        zulaessig.push(z);
      } else {
        abgelehnt.push({ ...eintrag(z.art, z.id, z.an), grund, text: ABLEHNUNGSTEXT[grund] });
      }
    }
    const beitraege = await fuehreAus(user, e.von, e.beitraege, false, log);
    const vorgaenge = await weg.vorgaengeUebergeben(e.von, zulaessig, user.id, false);
    for (const z of beitraege.abgelehnt) {
      abgelehnt.push({ ...eintrag("beitrag", z.koId, z.an), grund: z.grund, text: z.text });
    }
    for (const z of vorgaenge.abgelehnt) {
      const grund = "VORGANG_NICHT_MOEGLICH";
      abgelehnt.push({ ...eintrag(z.art, z.id, z.an), grund, text: z.grund });
    }

    // Die Pakete: je Nachfolger, was übertragen würde — und was dort schon liegt.
    const pakete = new Map<string, Paket>();
    const paket = (an: string): Paket => {
      const vorhanden = pakete.get(an);
      if (vorhanden) {
        return vorhanden;
      }
      const konto = konten.find((k) => k.id === an);
      const neu: Paket = {
        an: { id: an, name: konto?.name ?? null, role: konto?.role ?? null },
        anzahl: 0,
        eintraege: [],
        bereitsErledigt: 0,
        wirkung: { beitrag: 0, entwurf: 0, luecke: 0, pruefaufgabe: 0 },
      };
      pakete.set(an, neu);
      return neu;
    };
    const bereit = [
      ...beitraege.gruppen.flatMap((g) =>
        g.beitraege.map((b) => eintrag("beitrag", b.koId, g.an.id)),
      ),
      ...vorgaenge.bereit.map((z) => eintrag(z.art, z.id, z.an)),
    ];
    for (const z of bereit) {
      const p = paket(z.an);
      p.eintraege.push(z);
      p.anzahl += 1;
      p.wirkung[z.art] += 1;
    }
    for (const z of [...beitraege.bereitsErledigt, ...vorgaenge.bereitsErledigt]) {
      paket(z.an).bereitsErledigt += 1;
    }

    // Was bei der Person liegt, aber keinem Paket zugeteilt ist. Im Umfang `ausscheiden` hindert es.
    const zugeteilteBeitraege = new Set(e.beitraege.map((z) => z.koId));
    const zugeteilteVorgaenge = new Set(e.vorgaenge.map((z) => vorgangsschluessel(z.art, z.id)));
    const offenVorhanden: { art: EintragArt; id: string }[] = [
      ...bestandVon(e.von, bestand).map((ko) => ({ art: "beitrag" as const, id: ko.id })),
      ...vorher.vorgaenge.entwuerfe.map((d) => ({ art: "entwurf" as const, id: d.id })),
      ...vorher.vorgaenge.luecken.map((l) => ({ art: "luecke" as const, id: l.id })),
      ...vorher.vorgaenge.pruefaufgaben.map((p) => ({ art: "pruefaufgabe" as const, id: p.koId })),
    ];
    const nichtZugeteilt = offenVorhanden
      .filter((x) =>
        x.art === "beitrag"
          ? !zugeteilteBeitraege.has(x.id)
          : !zugeteilteVorgaenge.has(vorgangsschluessel(x.art, x.id)),
      )
      .map((x) => ({ art: x.art, id: x.id, titel: titel(x.art, x.id) }));

    const konto = konten.find((k) => k.id === e.von);
    const hindernisse: string[] = [];
    if (abgelehnt.length > 0) {
      hindernisse.push("NICHT_UEBERTRAGBAR");
    }
    if (e.umfang === "ausscheiden" && nichtZugeteilt.length > 0) {
      hindernisse.push("NICHT_ZUGETEILT");
    }
    if (e.zugang === "beenden" && e.von === user.id) {
      hindernisse.push("SELBST");
    }
    if (e.zugang === "beenden" && !konto) {
      hindernisse.push("KONTO_FEHLT");
    }
    const uebrig = (art: EintragArt) =>
      offenVorhanden.filter((x) => x.art === art).length -
      bereit.filter((x) => x.art === art).length;
    const prognose: Bilanz = {
      beitraege: uebrig("beitrag"),
      entwuerfe: uebrig("entwurf"),
      luecken: uebrig("luecke"),
      pruefaufgaben: uebrig("pruefaufgabe"),
    };
    const zugangJetzt = zugangsstand(konto, zeit);
    const vorschau = {
      person: person(e.von, konten, zeit),
      umfang: e.umfang,
      vorher: vorher.bilanz,
      prognose,
      pakete: [...pakete.values()].sort((a, b) => (a.an.name ?? "").localeCompare(b.an.name ?? "")),
      abgelehnt,
      nichtZugeteilt,
      ausgeschlossen: await weg.ausgeschlossen(e.von),
      zugang: {
        jetzt: zugangJetzt,
        entscheidung: e.zugang,
        // Beendet wird nur ohne Restbestand; die Vorschau sagt, was nach Plan gelten würde. Auch
        // ein gesperrtes Konto bekommt das gespeicherte Zugangsende (Nacharbeit 1, Ben K5).
        danach:
          e.zugang === "beenden" && summe(prognose) === 0 && konto
            ? ("abgelaufen" as const)
            : zugangJetzt,
      },
      vertretung: vertretung(konten, e.von, zeit),
      hindernisse,
      bestaetigbar: hindernisse.length === 0,
      // Was eine Übergabe NIE ändert — als Aussage der Vorschau, nicht nur als Text der Oberfläche.
      unveraendert: ["autorschaft", "freigabe", "historie", "rolle", "spacezugang"],
    };
    // `zulaessig` bleibt intern: die Ausführung überträgt genau die Vorgänge, deren Ziel hier galt.
    return { vorschau, zulaessig };
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

    // ADMIN-04 · DIE ZAHLEN DER KONTENLISTE — je Konto Zugangsstand, Beiträge und andere offene
    // Vorgänge, nur Anzahlen. `beitraege` ist dieselbe Menge wie `anzahl` im Bestand der Person
    // (Hauptverantwortung, Papierkorb eingeschlossen); Entwürfe, Lücken und Prüfaufgaben sind
    // andere Ablagen und stehen getrennt daneben — nichts davon ist in `beitraege` enthalten.
    app.get("/api/verantwortung/uebersicht", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const { konten, bestand, zeit } = await lage();
      const beitraege = new Map<string, number>();
      for (const ko of bestand) {
        const wer = responsibleOf(ko);
        beitraege.set(wer, (beitraege.get(wer) ?? 0) + 1);
      }
      let vorgaenge: Map<string, OffeneVorgaenge> | null = null;
      if (dienste.offeneVorgaenge) {
        try {
          vorgaenge = await dienste.offeneVorgaenge(konten.map((k) => k.id));
        } catch (e) {
          // Die Beiträge bleiben belegt; die Vorgänge heissen dann „nicht erhoben", nicht „0".
          request.log.error({ err: e }, "Kontenübersicht: offene Vorgänge nicht erhoben");
        }
      }
      reply.code(200).send({
        erhobenAm: new Date(zeit).toISOString(),
        personen: konten.map((k) => {
          const v = vorgaenge?.get(k.id);
          return {
            id: k.id,
            zugang: zugangsstand(k, zeit),
            beitraege: beitraege.get(k.id) ?? 0,
            vorgaenge: v
              ? {
                  entwuerfe: v.entwuerfe.length,
                  luecken: v.luecken.length,
                  pruefaufgaben: v.pruefaufgaben.length,
                }
              : null,
          };
        }),
      });
    });

    // ADMIN-04 · die offenen Vorgänge EINER Person — das Ziel des Zählers in der Kontokarte.
    // Entwürfe und Lücken nur als Kennung (privat bzw. vertraulich), Prüfaufgaben mit Titel nur,
    // wenn der Handelnde den Beitrag lesen darf.
    app.get<{ Params: { id: string } }>(
      "/api/verantwortung/person/:id/vorgaenge",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        if (!dienste.offeneVorgaenge) {
          reply.code(503).send({
            error: "NICHT_VERFUEGBAR",
            message: "Die offenen Vorgänge können hier nicht erhoben werden.",
          });
          return;
        }
        const von = request.params.id;
        const [v, bestand] = await Promise.all([
          dienste.offeneVorgaenge([von]),
          dienste.ko.listEinschliesslichPapierkorb(),
        ]);
        const nachKennung = new Map(bestand.map((ko) => [ko.id, ko]));
        const eintrag = v.get(von) ?? { entwuerfe: [], luecken: [], pruefaufgaben: [] };
        reply.code(200).send({
          entwuerfe: eintrag.entwuerfe,
          luecken: eintrag.luecken,
          pruefaufgaben: eintrag.pruefaufgaben.map((z) => ({
            koId: z.koId,
            titel: titelFuer(user, nachKennung.get(z.koId)),
          })),
        });
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

    // ADMIN-05 · ohne beide Erhebungen gibt es keinen gemeinsamen Ablauf — gesagt, nicht verschwiegen.
    const ablaufBereit = (reply: FastifyReply): boolean => {
      // Nacharbeit 1: ohne Prüfprotokoll gibt es keinen nachholbaren Abschluss — also keinen Ablauf.
      if (dienste.offeneVorgaenge && dienste.vorgaengeWeg && dienste.audit) {
        return true;
      }
      reply.code(503).send({
        error: "NICHT_VERFUEGBAR",
        message: "Die offenen Vorgänge können hier nicht übergeben werden.",
      });
      return false;
    };

    // ADMIN-05 · Die Vorschau des gemeinsamen Ablaufs. Schreibt nichts — auch kein Protokoll.
    app.post<{ Body: unknown }>("/api/verantwortung/ablauf/vorschau", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user || !ablaufBereit(reply)) {
        return;
      }
      try {
        const { vorschau } = await ablaufVorschau(user, ablaufEingabe(request.body), request.log);
        reply.code(200).send(vorschau);
      } catch (e) {
        fehler(reply, e, request);
      }
    });

    // ADMIN-05 · Die Ausführung. Urteilt die Vorschau NEU; ist sie nicht bestätigbar, 409 und nichts
    // geschrieben. Sonst Beiträge und Vorgänge je Zeile, danach die Zugangsentscheidung und EIN
    // Bilanzvermerk. 200 nur, wenn alles übertragen (oder schon erledigt) ist und die gewählte
    // Zugangsentscheidung gilt; sonst 207 mit jeder offenen Zeile. Dieselbe Eingabe noch einmal
    // geschickt holt genau den Rest nach — erledigte Zeilen werden nicht ein zweites Mal geschrieben.
    app.post<{ Body: unknown }>("/api/verantwortung/ablauf", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user || !ablaufBereit(reply)) {
        return;
      }
      try {
        const e = ablaufEingabe(request.body);
        const { vorschau, zulaessig } = await ablaufVorschau(user, e, request.log);
        if (!vorschau.bestaetigbar) {
          reply.code(409).send({
            error: "NICHT_BESTAETIGBAR",
            message:
              "Die Zuordnung ist nicht vollständig oder nicht zulässig. Es wurde nichts übertragen und der Zugang nicht verändert.",
            vorschau,
          });
          return;
        }
        const weg = dienste.vorgaengeWeg as NonNullable<VerantwortungDienste["vorgaengeWeg"]>;
        const audit = dienste.audit as AuditService;

        // Nacharbeit 1 (Ben K6): DER BEGINN STEHT IM PROTOKOLL, BEVOR ETWAS GESCHRIEBEN WIRD — mit
        // der Vorher-Bilanz und dem Plan. Scheitert später der Abschlussvermerk, bleibt dieser
        // Beginn offen, und der nächste bestätigte Ablauf derselben Person holt den Abschluss mit
        // GENAU dieser Vorher-Bilanz nach. Lässt sich der Beginn nicht festhalten, wird nichts
        // übertragen.
        let beginn = await offenerAblaufbeginn(e.von);
        const nachgeholt = beginn !== null;
        if (beginn) {
          // Nacharbeit 2 (Ben K6): auch eine FORTSETZUNG steht vor dem ersten Schreiben im
          // Protokoll — mit ihrem Plan. Nur so kann die nachgeholte Bilanz eine geänderte
          // Restzuordnung zählen. Lässt sie sich nicht festhalten, wird nichts übertragen.
          try {
            await audit.record({
              actor: user.id,
              action: "verantwortung.ablauf-fortgesetzt",
              target: e.von,
              payload: { beginn: beginn.seq, beitraege: e.beitraege, vorgaenge: e.vorgaenge },
            });
          } catch (err) {
            request.log.error({ err }, "Übergabeablauf: Fortsetzung nicht protokolliert");
            reply.code(503).send({
              error: "PROTOKOLL_NICHT_VERFUEGBAR",
              message:
                "Das Prüfprotokoll nimmt gerade nichts an. Es wurde nichts übertragen und der Zugang nicht verändert.",
            });
            return;
          }
          planErgaenzen(beginn.beitraege, e.beitraege);
          planErgaenzen(beginn.vorgaenge, e.vorgaenge);
        } else {
          try {
            const eintrag = await audit.record({
              actor: user.id,
              action: "verantwortung.ablauf-begonnen",
              target: e.von,
              payload: {
                umfang: e.umfang,
                vorher: vorschau.vorher,
                beitraege: e.beitraege,
                vorgaenge: e.vorgaenge,
                zugang: e.zugang,
              },
            });
            beginn = {
              seq: eintrag.seq,
              at: eintrag.at,
              umfang: e.umfang,
              vorher: vorschau.vorher,
              beitraege: [...e.beitraege],
              vorgaenge: [...e.vorgaenge],
            };
          } catch (err) {
            request.log.error({ err }, "Übergabeablauf: Beginn nicht protokolliert");
            reply.code(503).send({
              error: "PROTOKOLL_NICHT_VERFUEGBAR",
              message:
                "Das Prüfprotokoll nimmt gerade nichts an. Es wurde nichts übertragen und der Zugang nicht verändert.",
            });
            return;
          }
        }

        // AB HIER IST GESCHRIEBEN WORDEN (oder kann es sein). Kein Fehler darf das Teilergebnis
        // mehr verschlucken (Ben K4): jeder nachgelagerte Schritt fängt seinen Fehler und meldet
        // ihn als offenen Schritt; dieselbe Eingabe noch einmal holt ihn nach.
        const abschlussOffen: string[] = [];
        const beitraege =
          e.beitraege.length > 0
            ? await fuehreAus(user, e.von, e.beitraege, true, request.log)
            : null;
        let vorgaenge: Awaited<ReturnType<typeof weg.vorgaengeUebergeben>>;
        let vorgaengeUnklar: VorgangZuteilung[] = [];
        try {
          vorgaenge = await weg.vorgaengeUebergeben(e.von, zulaessig, user.id, true);
        } catch (err) {
          request.log.error({ err }, "Übergabeablauf: Vorgänge nicht vollständig übertragen");
          vorgaengeUnklar = zulaessig;
          vorgaenge = {
            bereit: [],
            uebertragen: [],
            bereitsErledigt: [],
            abgelehnt: [],
            fehlgeschlagen: [],
            protokolliert: true,
          };
        }

        // Nacharbeit 2 (Ben K4): auch der Kontenstand wird NACH den Übertragungen gelesen. Scheitert
        // er, bleibt das Teilergebnis; Namen fehlen dann, und Zugang wie Abschluss sind ungeklärt —
        // ein offener Schritt `KONTEN`, den dieselbe Eingabe noch einmal nachholt.
        let konten: readonly PublicUser[] = [];
        let kontenLesbar = true;
        try {
          konten = await dienste.auth.listUsers();
        } catch (err) {
          request.log.error({ err }, "Übergabeablauf: Kontenstand danach nicht lesbar");
          kontenLesbar = false;
          abschlussOffen.push("KONTEN");
        }
        const zeile = (art: EintragArt, id: string, titel: string | null, an: string): Eintrag => ({
          art,
          id,
          titel,
          an,
          anName: name(an, konten),
        });
        const titelVorgang = (art: VorgangArt, id: string): string | null =>
          art === "pruefaufgabe"
            ? (vorschau.pakete.flatMap((p) => p.eintraege).find((x) => x.art === art && x.id === id)
                ?.titel ?? null)
            : null;
        const uebertragen: Eintrag[] = [
          ...(beitraege?.uebertragen ?? []).map((z) => zeile("beitrag", z.koId, z.titel, z.an)),
          ...vorgaenge.uebertragen.map((z) => zeile(z.art, z.id, titelVorgang(z.art, z.id), z.an)),
        ];
        const bereitsErledigt: Eintrag[] = [
          ...(beitraege?.bereitsErledigt ?? []).map((z) => zeile("beitrag", z.koId, z.titel, z.an)),
          ...vorgaenge.bereitsErledigt.map((z) => zeile(z.art, z.id, null, z.an)),
        ];
        const offen: OffenerEintrag[] = [
          ...[...(beitraege?.abgelehnt ?? []), ...(beitraege?.fehlgeschlagen ?? [])].map((z) => ({
            ...zeile("beitrag", z.koId, z.titel, z.an),
            grund: z.grund,
            text: z.text,
          })),
          ...vorgaenge.abgelehnt.map((z) => ({
            ...zeile(z.art, z.id, titelVorgang(z.art, z.id), z.an),
            grund: "VORGANG_NICHT_MOEGLICH",
            text: z.grund,
          })),
          ...vorgaenge.fehlgeschlagen.map((z) => ({
            ...zeile(z.art, z.id, titelVorgang(z.art, z.id), z.an),
            grund: "SCHREIBFEHLER",
            text: `Der Vorgang ist unverändert und kann erneut übertragen werden. (${z.grund})`,
          })),
          ...vorgaengeUnklar.map((z) => ({
            ...zeile(z.art, z.id, titelVorgang(z.art, z.id), z.an),
            grund: "STAND_UNGEKLAERT",
            text: "Der Stand dieses Vorgangs ist ungeklärt. Erneut übertragen klärt ihn — bereits Übertragenes wird nicht doppelt geschrieben.",
          })),
        ];
        if (!vorgaenge.protokolliert) {
          // Die übertragenen Kennungen stehen dann im Bilanzvermerk unten — kein offener Schritt.
          request.log.error("Übergabeablauf: Vorgangsvermerk lifecycle.handover fehlt");
        }

        // Die Bilanz NACH dem Schreiben — frisch gelesen, nicht aus dem Plan gerechnet. Ohne sie
        // lässt sich weder das Zugangsende verantworten noch die Bilanz abschliessen.
        let nachher: Bilanz | null = null;
        try {
          nachher = (await bilanzVon(e.von)).bilanz;
        } catch (err) {
          request.log.error({ err }, "Übergabeablauf: Bilanz danach nicht lesbar");
          abschlussOffen.push("BILANZ_NACHHER");
        }

        // Nacharbeit 1 (Ben K5): BEENDEN HEISST DAS ZUGANGSENDE SPEICHERN — auch bei einem gerade
        // gesperrten Konto. Eine Sperre ist vorübergehend (eine Freigabe öffnet sie wieder), das
        // Zugangsende nicht. Erfüllt ist die Entscheidung erst, wenn die gespeicherte Befristung
        // erreicht ist (`zugangsendeGespeichert`), nicht schon, weil das Konto gerade zu ist.
        let konto = konten.find((k) => k.id === e.von);
        // Ohne lesbaren Kontenstand gilt der zuletzt GELESENE Stand (aus der Vorschau dieses Laufs)
        // — als Auskunft, nicht als Grundlage einer Zugangsänderung.
        const zugangVorher = kontenLesbar ? zugangsstand(konto, jetzt()) : vorschau.zugang.jetzt;
        let endeGespeichert = kontenLesbar && zugangsendeGespeichert(konto, jetzt());
        let geschrieben = false;
        let zugangGrund: string | null = null;
        if (e.zugang === "beenden") {
          if (!kontenLesbar) {
            zugangGrund =
              "Der Kontenstand ist nicht lesbar — der Zugang wurde nicht verändert. Erneut bestätigen klärt und beendet ihn.";
          } else if (nachher === null) {
            zugangGrund =
              "Der Bestand danach ist nicht lesbar — der Zugang bleibt, bis die Übergabe erneut bestätigt ist.";
          } else if (summe(nachher) > 0) {
            zugangGrund = `Bei der Person liegen noch ${summe(nachher)} Beiträge oder Vorgänge — der Zugang bleibt, bis alles übergeben ist.`;
          } else if (!endeGespeichert && konto) {
            try {
              konto = await dienste.auth.setAccessExpiry(
                e.von,
                new Date(jetzt()).toISOString(),
                user.id,
              );
              geschrieben = true;
              endeGespeichert = zugangsendeGespeichert(konto, jetzt());
            } catch (err) {
              request.log.error({ err }, "Übergabeablauf: Zugangsende nicht gespeichert");
              abschlussOffen.push("ZUGANG");
              zugangGrund =
                "Das Zugangsende konnte nicht gespeichert werden. Die Übertragungen gelten; erneut bestätigen beendet den Zugang.";
            }
          }
        }
        const zugangErfuellt = e.zugang === "behalten" || endeGespeichert;
        const zugang = {
          vorher: zugangVorher,
          // Mit gespeichertem Zugangsende heisst der Stand „beendet" — auch wenn das Konto daneben
          // gesperrt ist; die Sperre allein wäre vorübergehend.
          nachher:
            e.zugang === "beenden" && endeGespeichert
              ? "abgelaufen"
              : kontenLesbar
                ? zugangsstand(konto, jetzt())
                : zugangVorher,
          entscheidung: e.zugang,
          beendet: geschrieben,
          endeGespeichert,
          grund: zugangGrund,
        };

        // Je Nachfolger, was aus dem Plan DES BEGINNS samt aller protokollierten Fortsetzungen jetzt
        // bei ihm liegt — beim Nachholen also auch, was ein früherer Lauf übertragen hat, und eine
        // geänderte Restzuordnung. Lässt sich das nicht lesen (Ben K6, Nacharbeit 2), wird KEINE
        // unvollständige Liste gespeichert: der Abschluss bleibt offen (`BILANZ_NACHFOLGER`).
        let nachfolger: { an: string; beitraege: number; vorgaenge: number }[] | null = null;
        try {
          nachfolger = await planStand(user, e.von, beginn, request.log);
        } catch (err) {
          request.log.error({ err }, "Übergabeablauf: Stand je Nachfolger nicht lesbar");
          abschlussOffen.push("BILANZ_NACHFOLGER");
        }

        // DER BILANZVERMERK: Vorher-Bilanz aus dem Beginn, nachher, je Nachfolger, offene Zeilen
        // und Zugang — Kennungen und Anzahlen, keine Inhalte. Er schliesst den Beginn (`beginn`).
        // Scheitert er (Ben K6), bleibt der Beginn offen und der Abschluss ist ein OFFENER SCHRITT:
        // nicht vollständig, 207, und der nächste bestätigte Ablauf holt ihn mit derselben
        // Vorher-Bilanz nach.
        let protokolliert = false;
        // Ohne lesbaren Kontenstand ist der Zugang ungeklärt — der Beginn bleibt dann offen, damit
        // die Wiederaufnahme mit derselben Vorher-Bilanz abschliesst.
        if (nachher !== null && nachfolger !== null && kontenLesbar) {
          try {
            await audit.record({
              actor: user.id,
              action: "verantwortung.ablauf",
              target: e.von,
              payload: {
                umfang: beginn.umfang,
                vorher: beginn.vorher,
                nachher,
                nachfolger,
                uebertragen: uebertragen.length,
                bereitsErledigt: bereitsErledigt.length,
                offen: offen.map((z) => ({ art: z.art, id: z.id, an: z.an, grund: z.grund })),
                vorgaengeUebertragen: vorgaenge.uebertragen,
                zugang,
                vollstaendig: offen.length === 0 && zugangErfuellt && abschlussOffen.length === 0,
                beginn: beginn.seq,
                nachgeholt,
              },
            });
            protokolliert = true;
          } catch (err) {
            request.log.error({ err }, "Übergabeablauf: Bilanz nicht protokolliert");
          }
        }
        if (!protokolliert) {
          abschlussOffen.push("BILANZVERMERK");
        }
        const vollstaendig = offen.length === 0 && zugangErfuellt && abschlussOffen.length === 0;
        reply.code(vollstaendig ? 200 : 207).send({
          person: kontenLesbar ? person(e.von, konten, jetzt()) : vorschau.person,
          umfang: beginn.umfang,
          vorher: beginn.vorher,
          nachher,
          nachfolger: nachfolger ?? [],
          uebertragen,
          bereitsErledigt,
          offen,
          zugang,
          abschlussOffen,
          nachgeholt,
          vollstaendig,
          protokolliert,
        });
      } catch (e) {
        fehler(reply, e, request);
      }
    });

    // ADMIN-05 · Die Abschlussbilanzen einer Person aus dem Prüfprotokoll — jüngste zuerst. Damit ist
    // die Bilanz auch nach einem Neuladen nachvollziehbar; sie kommt vom Server, nicht aus dem Zustand
    // der Seite.
    app.get<{ Params: { id: string } }>(
      "/api/verantwortung/person/:id/ablaeufe",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        if (!dienste.audit) {
          reply.code(503).send({
            error: "NICHT_VERFUEGBAR",
            message: "Das Prüfprotokoll ist hier nicht verfügbar.",
          });
          return;
        }
        const [eintraege, konten] = await Promise.all([
          dienste.audit.list({ action: "verantwortung.ablauf", target: request.params.id }),
          dienste.auth.listUsers(),
        ]);
        type Nachfolge = { an: string; beitraege: number; vorgaenge: number };
        // Nacharbeit 1 (Ben K6): ein begonnener Ablauf ohne Abschlussbilanz ist auch nach Reload
        // sichtbar — mit seiner Vorher-Bilanz, die beim Nachholen gilt.
        const offen = await offenerAblaufbeginn(request.params.id);
        reply.code(200).send({
          ausstehend: offen
            ? { seq: offen.seq, at: offen.at, umfang: offen.umfang, vorher: offen.vorher }
            : null,
          ablaeufe: eintraege
            .slice(-5)
            .reverse()
            .map((x) => ({
              seq: x.seq,
              at: x.at,
              actor: { id: x.actor, name: name(x.actor, konten) },
              ...x.payload,
              nachfolger: ((x.payload.nachfolger ?? []) as Nachfolge[]).map((n) => ({
                ...n,
                name: name(n.an, konten),
              })),
            })),
        });
      },
    );
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
    // R-0554 (aufnahme gesamt-wissen-verantwortung) — KONTO ENTFERNEN MIT NACHFOLGER.
    // `DELETE /api/users/:id?nachfolger=…` übergibt den Bestand ZUERST (Auslöser aus der
    // Verzeichnispflege, `auth/src/routes.ts` → `vorDemEntfernen` in der Wurzel) und entfernt nur,
    // wenn danach keine Hauptverantwortung mehr am Konto hängt — einschliesslich Papierkorb
    // (`build-app.ts`). Hier vorab abgewiesen, liefe die Übergabe nie. Dieselbe Sperre bleibt also
    // wirksam, nur NACH der Übergabe. Der Nachfolger muss dafür nach DERSELBEN Regel zulässig sein
    // wie jede Nachfolge hier (`kannVerantworten`); sonst wird nichts geändert.
    const nachfolgerRoh = (request.query as { nachfolger?: unknown } | undefined)?.nachfolger;
    if (
      loeschen &&
      pfad === "/api/users/:id" &&
      typeof nachfolgerRoh === "string" &&
      nachfolgerRoh.trim().length > 0
    ) {
      const nachfolger = nachfolgerRoh.trim();
      const konten = await dienste.auth.listUsers();
      if (
        nachfolger === id ||
        !kannVerantworten(
          konten.find((k) => k.id === nachfolger),
          jetzt(),
        )
      ) {
        reply.code(400).send({
          error: "NACHFOLGE_UNZULAESSIG",
          message:
            "Der Nachfolger muss ein aktives, unbefristetes Konto mit Bearbeitungsrecht sein. Es wurde nichts übergeben und nichts entfernt.",
        });
        return reply;
      }
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
