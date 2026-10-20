import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { ObjectStore } from "../../../object-store";
import type { AssistenzProfilDienst } from "../assistenz-profil";
import { type Guards, sendError } from "../http";
import {
  type BindungsSiegel,
  DateiAufnahmeFehler,
  type DateiLeser,
  GEMEINSAME_DIENSTE,
  type GewaehlteDatei,
  type HostBindung,
  type KontextEintrag,
  type OsRechte,
  PROGRAMM_REGISTER,
  abgelehnt,
  bewerteBedienungshilfeLesen,
  faehigkeitsUebersicht,
  leseAdapterZiel,
  nimmGewaehlteDateiAuf,
  pruefeZielVorWirkung,
  uebermittelbarerKontext,
} from "../programmadapter";
import { KLARA_SINGLE_TENANT_ID } from "../services/klara-session-service";
import { OBJECTS_BODY_LIMIT } from "./object-routes";

// ================================================================================================
// produkt:20261011:assistenz-programmadapter (BPA-04) — WAS KLARA IN WELCHEM PROGRAMM KANN, UND DIE
// PRÜFUNGEN VOR JEDER WIRKUNG IN EINEM FREMDEN PROGRAMM.
// ================================================================================================
//
//   GET  /api/klara/programme                  — Fähigkeitsübersicht je Programm.
//   POST /api/klara/programme/verbinden        — der Server stellt eine gesiegelte Bindung aus
//                                                (Mandant und Nutzer aus der Sitzung).
//   POST /api/klara/programme/wirkung          — Zielprüfung VOR einer Wirkung (Word-Seitenfenster
//                                                vor dem Einfügen, Klara-Begleiter).
//   POST /api/klara/programme/finder           — genau eine im Systemdialog gewählte Datei in die
//                                                vorhandene Objektablage, mit Herkunft und Fassung.
//   GET  /api/klara/programme/finder/:objektId   — die dauerhaft protokollierte Herkunft einer
//                                                Aufnahme, nur für ihren Eigentümer.
//   POST /api/klara/programme/bedienungshilfe  — Markierung über die Bedienungshilfe lesen; dazu
//                                                nur der Kontext, der zur AKTUELLEN Bindung passt.
//
// Alle Wege fahren die bestehende Anmeldung; es gibt keine zweite Anmeldung und keine Ablage je
// Programm. Die Regeln selbst stehen in `programmadapter.ts` — diese Datei liest nur die Eingabe,
// setzt Mandant und Nutzer aus der Sitzung und antwortet mit dem Ergebnis der Regel.

export const PROGRAMME_FINDER_AUFGENOMMEN = "klara.programme.finder.aufgenommen";

export interface ProgrammadapterRoutenDeps {
  assistenzProfil: AssistenzProfilDienst;
  objekte: ObjectStore;
  audit: AuditService;
  siegel: BindungsSiegel;
}

/** Höchstwerte für den Text, den der Begleiter mitbringt — Kontext, kein Dokumentbestand. */
const MARKIERUNG_MAX = 20_000;
const KONTEXT_MAX_EINTRAEGE = 20;

/** Erlaubte MIME-Form: `typ/untertyp`, sonst ein neutraler Binärtyp. */
const MIME = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i;

function rumpf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

/** Fehlt ein Recht in der Meldung, gilt es als NICHT erteilt — fail-closed. */
function leseRechte(roh: unknown): OsRechte {
  const r = rumpf(roh);
  return {
    bedienungshilfe: r.bedienungshilfe === true,
    dateizugriff: r.dateizugriff === true,
    bildschirmaufnahme: r.bildschirmaufnahme === true,
  };
}

function ungueltig(reply: FastifyReply, message: string): void {
  reply.code(400).send({ error: "VALIDATION", message });
}

/** Prüft das Ziel vor der Wirkung; bei Abweichung ist die 409 schon gesendet. */
function zielAntwort(
  reply: FastifyReply,
  gebunden: HostBindung | null,
  aktuell: HostBindung,
): boolean {
  const ergebnis = gebunden ? pruefeZielVorWirkung(gebunden, aktuell) : abgelehnt("host-getrennt");
  if (!ergebnis.ok) {
    reply.code(409).send(ergebnis);
  }
  return ergebnis.ok;
}

function leseDatei(roh: unknown): (GewaehlteDatei & { mime: string; inhalt: string }) | null {
  const d = rumpf(roh);
  if (
    typeof d.dateiId !== "string" ||
    d.dateiId === "" ||
    typeof d.name !== "string" ||
    d.name.trim() === "" ||
    typeof d.groesse !== "number" ||
    !Number.isInteger(d.groesse) ||
    d.groesse < 0 ||
    typeof d.geaendertAm !== "string" ||
    typeof d.inhalt !== "string"
  ) {
    return null;
  }
  return {
    dateiId: d.dateiId,
    name: d.name,
    groesse: d.groesse,
    geaendertAm: d.geaendertAm,
    mime: typeof d.mime === "string" && MIME.test(d.mime) ? d.mime : "application/octet-stream",
    inhalt: d.inhalt,
  };
}

export function programmadapterRoutes(
  deps: ProgrammadapterRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { siegel } = deps;

  // Dasselbe Muster wie `POST /api/objects`: die Anmeldung VOR dem Parsen eines großen Rumpfs.
  const requireAuthedBeforeParse = async (
    request: Parameters<Guards["requireUser"]>[0],
    reply: Parameters<Guards["requireUser"]>[1],
  ): Promise<void> => {
    await guards.requireUser(request, reply);
  };

  return async (app) => {
    app.get("/api/klara/programme", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const profil = await deps.assistenzProfil.hole(user.id);
        reply.header("cache-control", "no-store");
        reply.code(200).send({
          ...faehigkeitsUebersicht(),
          assistenz: { name: profil?.name ?? null, avatar: profil?.avatar ?? null },
          dienste: GEMEINSAME_DIENSTE,
        });
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.post<{ Body: unknown }>("/api/klara/programme/verbinden", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const ziel = leseAdapterZiel(rumpf(request.body).ziel, KLARA_SINGLE_TENANT_ID, user.id);
      const eintrag = PROGRAMM_REGISTER.find((e) => e.programm === ziel?.programm);
      if (!ziel || !eintrag || eintrag.weg === "keiner") {
        ungueltig(
          reply,
          "Für dieses Programm gibt es keinen Klara-Weg, oder das Ziel ist unvollständig.",
        );
        return;
      }
      reply.header("cache-control", "no-store");
      reply.code(200).send({ bindung: siegel.siegeln(ziel), programm: ziel.programm });
    });

    app.post<{ Body: unknown }>("/api/klara/programme/wirkung", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const body = rumpf(request.body);
      const aktuell = leseAdapterZiel(body.aktuell, KLARA_SINGLE_TENANT_ID, user.id);
      if (!aktuell) {
        ungueltig(reply, "Das aktuelle Ziel ist unvollständig.");
        return;
      }
      // Der Begleiter trägt eine gesiegelte Bindung. Das Word-Seitenfenster prüft sein EIGENES
      // Einfügen und meldet die Bindung vom Zeitpunkt der Frage ungesiegelt; Mandant und Nutzer
      // setzt der Server auch dort aus der Sitzung.
      const gebunden =
        body.bindung !== undefined
          ? siegel.oeffnen(body.bindung)
          : leseAdapterZiel(body.gebunden, KLARA_SINGLE_TENANT_ID, user.id);
      if (!zielAntwort(reply, gebunden, aktuell)) {
        return;
      }
      reply.code(200).send({ ok: true });
    });

    app.post<{ Body: unknown }>(
      "/api/klara/programme/finder",
      { bodyLimit: OBJECTS_BODY_LIMIT, onRequest: requireAuthedBeforeParse },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const body = rumpf(request.body);
        const aktuell = leseAdapterZiel(body.aktuell, KLARA_SINGLE_TENANT_ID, user.id);
        if (!aktuell || aktuell.programm !== "finder") {
          ungueltig(reply, "Das aktuelle Ziel ist keine Finder-Auswahl.");
          return;
        }
        const roh = Array.isArray(body.dateien) ? body.dateien : [];
        const dateien = roh.map(leseDatei);
        if (dateien.some((d) => d === null)) {
          ungueltig(reply, "Eine Datei ist unvollständig beschrieben.");
          return;
        }
        const gewaehlt = dateien as Array<GewaehlteDatei & { mime: string; inhalt: string }>;
        if (!zielAntwort(reply, siegel.oeffnen(body.bindung), aktuell)) {
          return;
        }
        // Der Server liest nichts von der Platte des Nutzers: der Begleiter hat genau die eine
        // gewählte Datei geschickt. Der Kern ruft diesen Leser nur für sie — und nur, wenn genau
        // eine gewählt ist und die Dateifreigabe noch besteht.
        const leser: DateiLeser = {
          lies: async (dateiId) => {
            const datei = gewaehlt.find((d) => d.dateiId === dateiId);
            return new Uint8Array(Buffer.from(datei?.inhalt ?? "", "base64"));
          },
        };
        try {
          const rechte = leseRechte(body.rechte);
          const aufnahme = await nimmGewaehlteDateiAuf(gewaehlt, rechte, leser, user.id);
          const datei = gewaehlt[0] as GewaehlteDatei & { mime: string; inhalt: string };
          // Ziel und Fassung müssen zur aufgenommenen Datei passen: die Bindung nennt GENAU diese
          // Datei (Kennung) und GENAU diesen Inhalt (Prüfsumme, vom Server nachgerechnet).
          if (aktuell.objekt !== datei.dateiId) {
            reply.code(409).send(abgelehnt("anderes-dokument"));
            return;
          }
          if (aktuell.fassung !== aufnahme.herkunft.sha256) {
            reply.code(409).send(abgelehnt("fassung-geaendert"));
            return;
          }
          const ref = await deps.objekte.put({
            name: datei.name,
            mime: datei.mime,
            data: `data:${datei.mime};base64,${datei.inhalt}`,
            // Keine Schutzklasse aus dem Finder: ohne Angabe gilt das Objekt als vertraulich
            // (object-store, SCRUM-521) — die unbekannte Schutzklasse bleibt geschützt (P01).
            purpose: "attachment",
            owner: user.id,
          });
          // DIE HERKUNFT BLEIBT AM OBJEKT: der Eintrag im (verketteten, dauerhaften) Prüfprotokoll
          // mit dem Objekt als Ziel trägt ursprüngliche Datei-Kennung, Quellfassung (SHA-256, Größe,
          // Änderungszeit), Aufnahmezeit und die Aufnahmebindung. Gelesen wird er über
          // `GET /api/klara/programme/finder/:objektId`. Nie darin: Dateiname, Pfad oder Inhalt.
          await deps.audit.record({
            actor: user.id,
            action: PROGRAMME_FINDER_AUFGENOMMEN,
            target: `object:${ref.id}`,
            payload: {
              quelle: aufnahme.herkunft.quelle,
              dateiId: aufnahme.herkunft.dateiId,
              sha256: aufnahme.herkunft.sha256,
              groesse: aufnahme.herkunft.groesse,
              geaendertAm: aufnahme.herkunft.geaendertAm,
              aufgenommenAm: aufnahme.herkunft.aufgenommenAm,
              bindung: {
                programm: aktuell.programm,
                sitzung: aktuell.sitzung,
                hostKonto: aktuell.hostKonto,
                objekt: aktuell.objekt,
                fassung: aktuell.fassung,
              },
            },
          });
          reply.header("cache-control", "no-store");
          reply.code(201).send({
            ok: true,
            objektId: ref.id,
            herkunft: aufnahme.herkunft,
            ocrUrl: `/erfassen?weg=datei&finder=${encodeURIComponent(ref.id)}`,
          });
        } catch (fehler) {
          if (fehler instanceof DateiAufnahmeFehler) {
            reply.code(409).send({ ok: false, grund: fehler.grund, text: fehler.message });
            return;
          }
          sendError(reply, fehler);
        }
      },
    );

    // Die Herkunft einer aufgenommenen Datei — nur für den, der sie aufgenommen hat (Eigentümer am
    // Objekt). Für alle anderen und für unbekannte Kennungen dieselbe 404: keine Existenzauskunft.
    app.get<{ Params: { objektId: string } }>(
      "/api/klara/programme/finder/:objektId",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        const nichtGefunden = (): void => {
          reply.code(404).send({ error: "NOT_FOUND", message: "Keine Aufnahme gefunden." });
        };
        try {
          const objektId = request.params.objektId;
          const meta = await deps.objekte.metadata(objektId);
          if (!meta || meta.lifecycle?.owner !== user.id) {
            nichtGefunden();
            return;
          }
          const eintraege = await deps.audit.list({
            action: PROGRAMME_FINDER_AUFGENOMMEN,
            target: `object:${objektId}`,
          });
          const eintrag = eintraege.find((e) => e.actor === user.id);
          if (!eintrag) {
            nichtGefunden();
            return;
          }
          reply.header("cache-control", "no-store");
          reply.code(200).send({
            objektId,
            name: meta.name,
            mime: meta.mime,
            herkunft: eintrag.payload,
            protokolliertAm: eintrag.at,
          });
        } catch (fehler) {
          sendError(reply, fehler);
        }
      },
    );

    app.post<{ Body: unknown }>("/api/klara/programme/bedienungshilfe", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const body = rumpf(request.body);
      const aktuell = leseAdapterZiel(body.aktuell, KLARA_SINGLE_TENANT_ID, user.id);
      const b = rumpf(body.beobachtung);
      if (
        !aktuell ||
        typeof b.bundleId !== "string" ||
        typeof b.hostVersion !== "string" ||
        typeof b.fensterTreffer !== "number" ||
        typeof b.elementTreffer !== "number" ||
        typeof b.rolle !== "string" ||
        (b.markierung !== null && typeof b.markierung !== "string") ||
        (typeof b.markierung === "string" && b.markierung.length > MARKIERUNG_MAX)
      ) {
        ungueltig(reply, "Ziel oder Beobachtung ist unvollständig.");
        return;
      }
      if (!zielAntwort(reply, siegel.oeffnen(body.bindung), aktuell)) {
        return;
      }
      const entscheidung = bewerteBedienungshilfeLesen(
        {
          bundleId: b.bundleId,
          hostVersion: b.hostVersion,
          fensterTreffer: b.fensterTreffer,
          elementTreffer: b.elementTreffer,
          rolle: b.rolle,
          markierung: (b.markierung as string | null) ?? null,
        },
        leseRechte(body.rechte),
        // Nur der Lesezweck des Programms, an das die Bindung gebunden ist — ein Word-Lesezweck
        // gilt nicht, wenn das Ziel ein anderes Programm ist.
        PROGRAMM_REGISTER.filter((e) => e.programm === aktuell.programm),
      );
      if (entscheidung.entscheidung !== "lesen") {
        reply.code(409).send({ ok: false, ...entscheidung });
        return;
      }
      // Mitgeschickter Kontext zählt nur mit gültigem Siegel UND passender aktueller Bindung —
      // nach einem Host- oder Kontowechsel bleibt davon nichts übrig.
      const roh = Array.isArray(body.kontext) ? body.kontext.slice(0, KONTEXT_MAX_EINTRAEGE) : [];
      const eintraege: KontextEintrag[] = [];
      for (const r of roh) {
        const e = rumpf(r);
        const bindung = siegel.oeffnen(e.bindung);
        if (bindung && typeof e.inhalt === "string" && e.inhalt.length <= MARKIERUNG_MAX) {
          eintraege.push({ bindung, privat: e.privat === true, inhalt: e.inhalt });
        }
      }
      const freigegeben = uebermittelbarerKontext(eintraege, aktuell);
      reply.header("cache-control", "no-store");
      reply.code(200).send({
        ok: true,
        markierung: entscheidung.markierung,
        kontext: freigegeben.map((e) => ({ privat: e.privat, inhalt: e.inhalt })),
        verworfen: roh.length - freigegeben.length,
        // Die Bindung, unter der der Begleiter diese Markierung künftig als Kontext mitschickt.
        kontextBindung: siegel.siegeln(aktuell),
      });
    });
  };
}
