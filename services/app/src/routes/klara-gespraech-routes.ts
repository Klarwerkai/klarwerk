import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, sendError } from "../http";
import {
  aktionskennung,
  auftragMitVerlauf,
  protokollStand,
  schrittVerlauf,
} from "../klara-aktionsverlauf";
import type { KlaraAuftrag, KlaraAuftragSchritt } from "../klara-auftrag";
import { bindeAuftragsnotizen } from "../klara-auftragsnotiz";
import { KlaraAusfuehrung, type KlaraRufe, type KlaraVorWirkung } from "../klara-ausfuehrung";
import {
  type KlaraGespraech,
  type KlaraGespraechDienst,
  KlaraGespraechFehler,
  type KlaraNachrichtEingabe,
  type KlaraSchrittEingabe,
} from "../klara-gespraech";

// ================================================================================================
// produkt:20261008:klara-basis — DAS EIGENE KLARA-GESPRÄCH, NUR FÜR DAS EIGENE KONTO.
// ================================================================================================
//
//   GET    /api/me/klara/gespraech                         — das zuletzt geführte eigene Gespräch
//   POST   /api/me/klara/gespraeche                        — ein Gespräch mit Objektbezug beginnen
//   GET    /api/me/klara/gespraeche/:id                    — ein eigenes Gespräch lesen
//   POST   /api/me/klara/gespraeche/:id/nachrichten        — eine Nachricht festhalten
//   PUT    /api/me/klara/gespraeche/:id/schritt            — den letzten bewusst begonnenen Schritt
//   PUT    /api/me/klara/gespraeche/:id/einwilligung       — Einwilligung erteilen oder widerrufen
//   DELETE /api/me/klara/gespraeche/:id                    — ein eigenes Gespräch löschen
//
// Das Konto kommt AUSSCHLIESSLICH aus der Sitzung (`user.id`), nie aus Pfad oder Rumpf. Ein fremdes
// und ein unbekanntes Gespräch antworten gleich (404). Kein zusätzliches Recht: wer angemeldet ist,
// führt seine eigenen Gespräche — ob eine Frage beantwortet wird, entscheidet der Frageweg
// (`POST /api/ask`, `ko.read`), nicht diese Ablage.
//
// Ins Prüfprotokoll gehen nur EREIGNISSE (angelegt, Einwilligung, gelöscht) mit der Kennung — nie
// Frage, Antwort oder Objektbezug. Das Protokoll ist anhängend; ein Inhalt dort wäre nach dem Löschen
// nicht mehr zu entfernen.

export const KLARA_GESPRAECH_BEGONNEN = "klara.gespraech.begonnen";
export const KLARA_GESPRAECH_EINWILLIGUNG = "klara.gespraech.einwilligung";
export const KLARA_GESPRAECH_GELOESCHT = "klara.gespraech.geloescht";

export interface KlaraGespraechRoutenDeps {
  dienst: KlaraGespraechDienst;
  audit: AuditService;
  /** BPA-06: Prüfung eines Auftrags aus einem Routinenlauf vor der Wirkung. */
  vorWirkung?: KlaraVorWirkung;
}

const FEHLERCODE: Record<KlaraGespraechFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof KlaraGespraechFehler) {
    reply.code(fehler.status).send({
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
      ...(fehler.konflikt ? { konflikt: fehler.konflikt } : {}),
    });
    return;
  }
  sendError(reply, fehler);
}

// ================================================================================================
// produkt:20261010:assistenz-aktionen-verlauf-ruecknahme (PV-02) — GESPRÄCH, AKTION, PROTOKOLL.
// ================================================================================================
//
// Jede Antwort über Aufträge trägt den ERGEBNISSTAND und je Schritt AKTIONSKENNUNG, VERTRAG und ob
// er jetzt zurückgenommen werden kann (`klara-aktionsverlauf.ts`). Ein Schrittereignis im
// Prüfprotokoll nennt Gespräch, Aktionskennung, Vertrag sowie vorherigen und neuen Stand — als
// Fassungszeit bzw. Art der Aufgabenwirkung, nie Titel, Inhalt oder Personenname. Eine abgelehnte
// Rücknahme steht dort als eigenes Ereignis. `GET …/auftraege/:auftragId/protokoll` gibt der Person
// genau diese Einträge ihres eigenen Auftrags aus der vorhandenen Kette zurück.
export const KLARA_AUFTRAG_SCHRITT = "klara.auftrag.schritt";
export const KLARA_AUFTRAG_RUECKNAHME_ABGELEHNT = "klara.auftrag.ruecknahme-abgelehnt";

type SchrittAntwort = { auftrag: KlaraAuftrag; schritt: KlaraAuftragSchritt; wiederholt: boolean };

function schrittSicht(r: SchrittAntwort) {
  return {
    auftrag: auftragMitVerlauf(r.auftrag),
    schritt: { ...r.schritt, ...schrittVerlauf(r.auftrag, r.schritt) },
    wiederholt: r.wiederholt,
  };
}

/** Der Bezug eines Schrittereignisses: Gespräch, Aktionskennung, Vertrag, vorher/neu. */
function schrittBezug(gespraechId: string, r: SchrittAntwort): Record<string, unknown> {
  const s = r.schritt;
  const verlauf = schrittVerlauf(r.auftrag, s);
  const bezug: Record<string, unknown> = {
    gespraech: gespraechId,
    aktionskennung: verlauf.aktionskennung,
    vertrag: verlauf.vertrag,
  };
  if (s.stand === "gespeichert") {
    bezug.vorherStand = protokollStand(s.vorherStand);
    bezug.neuerStand = protokollStand(s.ergebnis?.stand);
  } else if (s.stand === "zurueckgenommen") {
    bezug.vorherStand = protokollStand(s.ergebnis?.stand);
    bezug.neuerStand = protokollStand(s.ruecknahmeStand);
  }
  return bezug;
}

/** Die Sicht nach außen — ohne Kontokennung, die der Fragende ohnehin selbst ist. */
function sicht(g: KlaraGespraech) {
  return {
    id: g.id,
    objektbezug: g.objektbezug,
    nachrichten: g.nachrichten,
    letzterSchritt: g.letzterSchritt,
    einwilligungAm: g.einwilligungAm,
    angelegtAm: g.angelegtAm,
    geaendertAm: g.geaendertAm,
  };
}

function rumpf<T>(body: unknown): T {
  return (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as T;
}

export function klaraGespraechRoutes(
  deps: KlaraGespraechRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, audit } = deps;
  const ausfuehrung = new KlaraAusfuehrung(dienst, deps.vorWirkung);

  return async (app) => {
    app.get("/api/me/klara/gespraech", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const g = await dienst.aktuelles(user.id);
        reply.code(200).send({ gespraech: g ? sicht(g) : null });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Body: { objektbezug?: unknown } }>(
      "/api/me/klara/gespraeche",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const g = await dienst.beginne(
            user.id,
            rumpf<{ objektbezug?: unknown }>(request.body).objektbezug,
          );
          await audit.record({
            actor: user.id,
            action: KLARA_GESPRAECH_BEGONNEN,
            target: `klara-gespraech:${g.id}`,
          });
          reply.code(201).send({ gespraech: sicht(g) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get<{ Params: { id: string } }>("/api/me/klara/gespraeche/:id", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const g = await dienst.hole(user.id, request.params.id);
        reply.code(200).send({ gespraech: sicht(g) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { id: string }; Body: KlaraNachrichtEingabe }>(
      "/api/me/klara/gespraeche/:id/nachrichten",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { gespraech, nachricht } = await dienst.fuegeHinzu(
            user.id,
            request.params.id,
            rumpf<KlaraNachrichtEingabe>(request.body),
          );
          reply.code(201).send({ nachricht, gespraech: sicht(gespraech) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string }; Body: KlaraSchrittEingabe }>(
      "/api/me/klara/gespraeche/:id/schritt",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const g = await dienst.setzeSchritt(
            user.id,
            request.params.id,
            rumpf<KlaraSchrittEingabe>(request.body),
          );
          reply.code(200).send({ gespraech: sicht(g) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string }; Body: { erteilt?: unknown } }>(
      "/api/me/klara/gespraeche/:id/einwilligung",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const erteilt = rumpf<{ erteilt?: unknown }>(request.body).erteilt;
          const g = await dienst.setzeEinwilligung(user.id, request.params.id, erteilt);
          await audit.record({
            actor: user.id,
            action: KLARA_GESPRAECH_EINWILLIGUNG,
            target: `klara-gespraech:${g.id}`,
            payload: { erteilt: g.einwilligungAm !== null },
          });
          reply.code(200).send({ gespraech: sicht(g) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // Löschen wirkt ZUERST, der Nachweis folgt: ein nicht erreichbares Protokoll darf einen
    // gewünschten Löschvorgang nicht aufhalten.
    app.delete<{ Params: { id: string } }>(
      "/api/me/klara/gespraeche/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          if (!(await dienst.loesche(user.id, request.params.id))) {
            reply.code(404).send({ error: "NOT_FOUND", message: "Gespräch nicht gefunden." });
            return;
          }
          await audit.record({
            actor: user.id,
            action: KLARA_GESPRAECH_GELOESCHT,
            target: `klara-gespraech:${request.params.id}`,
          });
          reply.code(200).send({ geloescht: 1 });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // ============================================================================================
    // Klara 05 (produkt:20261008:klara-aktionen) — Ausführungsaufträge im eigenen Gespräch.
    // ============================================================================================
    //
    //   GET  …/gespraeche/:id/auftraege                                 — die Aufträge lesen
    //   POST …/gespraeche/:id/auftraege                                 — Auftrag mit Grenze geben
    //   POST …/gespraeche/:id/auftraege/:auftragId/fassungen            — Grenze korrigieren
    //   PUT  …/gespraeche/:id/auftraege/:auftragId/schritte/:schluessel — Schritt beginnen/melden
    //   PUT  …/gespraeche/:id/auftraege/:auftragId/abbruch              — keine weiteren Schritte
    //   GET  …/gespraeche/:id/auftraege/:auftragId/protokoll            — eigene Protokolleinträge (PV-02)
    //
    // Dieselbe Tür wie das Gespräch: nur angemeldet, nur das eigene Konto, fremd und unbekannt 404.
    // Kein zusätzliches Recht — ob ein Schritt WIRKT, entscheidet der vorhandene Produktweg mit
    // seinen eigenen Rechten. Ins Prüfprotokoll gehen Ereignis, Kennungen, Aktion und Stand; nie
    // Wortlaut, Titel oder Inhalte.
    app.get<{ Params: { id: string } }>(
      "/api/me/klara/gespraeche/:id/auftraege",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const auftraege = await dienst.auftraege(user.id, request.params.id);
          reply.code(200).send({ auftraege: auftraege.map(auftragMitVerlauf) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/me/klara/gespraeche/:id/auftraege",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const eingabe = rumpf<Record<string, unknown>>(request.body);
          if (
            Array.isArray(eingabe.plan) &&
            eingabe.plan.some((p) => p && typeof p === "object" && "notizQuelle" in p)
          )
            await dienst.hole(user.id, request.params.id);
          const gebunden = await bindeAuftragsnotizen(eingabe, rufeFuer(request));
          const auftrag = await dienst.legeAuftragAn(user.id, request.params.id, gebunden);
          await audit.record({
            actor: user.id,
            action: "klara.auftrag.angelegt",
            target: `klara-auftrag:${auftrag.id}`,
            payload: {
              gespraech: request.params.id,
              aktionen: auftrag.erlaubteAktionen,
              geplanteSchritte: auftrag.geplanteSchritte,
            },
          });
          reply.code(201).send({ auftrag: auftragMitVerlauf(auftrag) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string; auftragId: string }; Body: unknown }>(
      "/api/me/klara/gespraeche/:id/auftraege/:auftragId/fassungen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const auftrag = await dienst.korrigiereAuftrag(
            user.id,
            request.params.id,
            request.params.auftragId,
            rumpf<Record<string, unknown>>(request.body),
          );
          await audit.record({
            actor: user.id,
            action: "klara.auftrag.korrigiert",
            target: `klara-auftrag:${auftrag.id}`,
            payload: { fassung: auftrag.fassung, aktionen: auftrag.erlaubteAktionen },
          });
          reply.code(200).send({ auftrag: auftragMitVerlauf(auftrag) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string; auftragId: string; schluessel: string }; Body: unknown }>(
      "/api/me/klara/gespraeche/:id/auftraege/:auftragId/schritte/:schluessel",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const r = await dienst.setzeAuftragsschritt(
            user.id,
            request.params.id,
            request.params.auftragId,
            request.params.schluessel,
            rumpf<Record<string, unknown>>(request.body),
          );
          if (!r.wiederholt) {
            await audit.record({
              actor: user.id,
              action: KLARA_AUFTRAG_SCHRITT,
              target: `klara-auftrag:${r.auftrag.id}`,
              payload: {
                nr: r.schritt.nr,
                aktion: r.schritt.aktion,
                stand: r.schritt.stand,
                ...(r.schritt.ergebnis ? { ergebnis: r.schritt.ergebnis.id } : {}),
                ...schrittBezug(request.params.id, r),
              },
            });
          }
          reply.code(200).send(schrittSicht(r));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    for (const weg of ["unterbrechen", "fortsetzen"] as const) {
      app.post<{ Params: { id: string; auftragId: string }; Body: { auftragFassung?: unknown } }>(
        `/api/me/klara/gespraeche/:id/auftraege/:auftragId/${weg}`,
        async (request, reply) => {
          const user = await guards.requireUser(request, reply);
          if (!user) return;
          try {
            const auftrag = await dienst.unterbrecheAuftrag(
              user.id,
              request.params.id,
              request.params.auftragId,
              weg === "fortsetzen",
              request.body?.auftragFassung,
            );
            await audit.record({
              actor: user.id,
              action: `klara.auftrag.${weg}`,
              target: `klara-auftrag:${auftrag.id}`,
            });
            reply.code(200).send({ auftrag: auftragMitVerlauf(auftrag) });
          } catch (fehler) {
            antworteMitFehler(reply, fehler);
          }
        },
      );
    }

    app.put<{ Params: { id: string; auftragId: string }; Body: unknown }>(
      "/api/me/klara/gespraeche/:id/auftraege/:auftragId/abbruch",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const auftrag = await dienst.brecheAuftragAb(
            user.id,
            request.params.id,
            request.params.auftragId,
          );
          await audit.record({
            actor: user.id,
            action: "klara.auftrag.abgebrochen",
            target: `klara-auftrag:${auftrag.id}`,
          });
          reply.code(200).send({ auftrag: auftragMitVerlauf(auftrag) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // ============================================================================================
    // Nacharbeit 2 (Ben): DIE GEBUNDENE AUSFÜHRUNG — der Server führt den Planschritt aus.
    // ============================================================================================
    //
    //   POST …/auftraege/:auftragId/schritte/:schluessel/ausfuehrung — Planschritt ausführen
    //   POST …/auftraege/:auftragId/schritte/:schluessel/ruecknahme  — gespeicherten Schritt zurück
    //
    // Ausgeführt wird über die VORHANDENEN Türen mit der Anmeldung der Person (`rufeFuer`): dieselben
    // Rechte, dieselbe Sichtbarkeit, derselbe Vorgangsschlüssel und Standvergleich wie im Editor.
    // Der Browser schickt nur Schrittnummer und Fassung; Aktion, Ziel und Inhalt stehen im Auftrag.
    const rufeFuer =
      (request: FastifyRequest): KlaraRufe =>
      async (methode, url, rumpf) => {
        const kopf: Record<string, string> = {};
        for (const name of ["authorization", "cookie", "accept-language"]) {
          const wert = request.headers[name];
          if (typeof wert === "string") {
            kopf[name] = wert;
          }
        }
        const r = await app.inject({
          method: methode,
          url,
          headers: kopf,
          ...(rumpf === undefined ? {} : { payload: rumpf as Record<string, unknown> }),
        });
        let daten: unknown = null;
        try {
          daten = r.body ? JSON.parse(r.body) : null;
        } catch {
          daten = null;
        }
        return { status: r.statusCode, daten };
      };

    app.post<{ Params: { id: string; auftragId: string; schluessel: string }; Body: unknown }>(
      "/api/me/klara/gespraeche/:id/auftraege/:auftragId/schritte/:schluessel/ausfuehrung",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const r = await ausfuehrung.fuehreAus(
            user.id,
            request.params.id,
            request.params.auftragId,
            request.params.schluessel,
            rumpf<{ nr?: unknown; auftragFassung?: unknown }>(request.body),
            rufeFuer(request),
          );
          if (!r.wiederholt) {
            await audit.record({
              actor: user.id,
              action: KLARA_AUFTRAG_SCHRITT,
              target: `klara-auftrag:${r.auftrag.id}`,
              payload: {
                nr: r.schritt.nr,
                aktion: r.schritt.aktion,
                stand: r.schritt.stand,
                ausgefuehrt: "server",
                ...(r.schritt.ergebnis ? { ergebnis: r.schritt.ergebnis.id } : {}),
                ...(r.schritt.fehlerCode ? { fehler: r.schritt.fehlerCode } : {}),
                ...schrittBezug(request.params.id, r),
              },
            });
          }
          reply.code(200).send(schrittSicht(r));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string; auftragId: string; schluessel: string }; Body: unknown }>(
      "/api/me/klara/gespraeche/:id/auftraege/:auftragId/schritte/:schluessel/ruecknahme",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const r = await ausfuehrung.nimmZurueck(
            user.id,
            request.params.id,
            request.params.auftragId,
            request.params.schluessel,
            rufeFuer(request),
          );
          if (!r.wiederholt) {
            await audit.record({
              actor: user.id,
              action: KLARA_AUFTRAG_SCHRITT,
              target: `klara-auftrag:${r.auftrag.id}`,
              payload: {
                nr: r.schritt.nr,
                aktion: r.schritt.aktion,
                stand: r.schritt.stand,
                ...schrittBezug(request.params.id, r),
              },
            });
          }
          reply.code(200).send(schrittSicht(r));
        } catch (fehler) {
          // PV-02-05: eine abgelehnte Rücknahme ist ein Ereignis des Vorgangs — mit Kennungen und
          // Ständen, ohne Titel oder Inhalt. Ein unbekannter Schritt oder Auftrag (404) nicht.
          // Die Antwort an die Person geht in jedem Fall hinaus, auch wenn das Protokoll ausfällt.
          try {
            if (fehler instanceof KlaraGespraechFehler && fehler.status === 409) {
              const k: Readonly<Record<string, unknown>> = fehler.konflikt ?? {};
              await audit.record({
                actor: user.id,
                action: KLARA_AUFTRAG_RUECKNAHME_ABGELEHNT,
                target: `klara-auftrag:${request.params.auftragId}`,
                payload: {
                  gespraech: request.params.id,
                  grund: fehler.grund,
                  ...(typeof k.aktionskennung === "string"
                    ? { aktionskennung: k.aktionskennung }
                    : {}),
                  ...(typeof k.vertrag === "string" ? { vertrag: k.vertrag } : {}),
                  ...(typeof k.eigenerStand === "string" ? { eigenerStand: k.eigenerStand } : {}),
                  ...(typeof k.aktuellerStand === "string"
                    ? { aktuellerStand: k.aktuellerStand }
                    : {}),
                },
              });
            }
          } finally {
            antworteMitFehler(reply, fehler);
          }
        }
      },
    );

    // PV-02-03: das Prüfprotokoll EINES eigenen Auftrags — dieselben Einträge der vorhandenen Kette,
    // nur die dieser Person zu diesem Auftrag. Fremd oder unbekannt: 404 wie jeder Auftragsweg.
    app.get<{ Params: { id: string; auftragId: string } }>(
      "/api/me/klara/gespraeche/:id/auftraege/:auftragId/protokoll",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const a = await dienst.auftrag(user.id, request.params.id, request.params.auftragId);
          const eintraege = await audit.list({ target: `klara-auftrag:${a.id}` });
          reply.code(200).send({
            auftrag: a.id,
            aktionskennungen: a.schritte.map((s) => aktionskennung(a.id, s.nr)),
            eintraege: eintraege
              .filter((e) => e.actor === user.id)
              .map((e) => ({ seq: e.seq, at: e.at, action: e.action, payload: e.payload })),
          });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}
