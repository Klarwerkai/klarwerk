import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, type SessionUser, sendError } from "../http";
import {
  type InternerTermin,
  type KalenderAnbindung,
  type KalenderAnbindungDienst,
  KalenderAnbindungFehler,
  type KalenderErgebnis,
  type KalenderZuordnung,
  anbieterFehlerlage,
  pruefeInternenTermin,
  pruefeTeilnehmerAuftragEingabe,
} from "../klara-kalender-anbindung";

// ================================================================================================
// produkt:20261008:klara-kalender (Klara 11, AW-17) — DIE KALENDERANBINDUNG, NUR FÜR DAS EIGENE KONTO.
// ================================================================================================
//
//   GET  /api/me/klara/kalender                                   Konto, Kalender, eigene Anbindungen
//   POST /api/me/klara/kalender/anbindungen                       Kalender wählen (Umfang, Feldregeln)
//   POST /api/me/klara/kalender/anbindungen/:id/entfernen            lokale Anbindung bewusst entfernen
//   GET  /api/me/klara/kalender/anbindungen/:id/termine?von&bis   Termine im Zielkalender lesen
//   POST /api/me/klara/kalender/anbindungen/:id/termine           Termin eintragen bzw. ändern
//   GET  /api/me/klara/kalender/anbindungen/:id/zuordnungen       Zuordnungen samt Stand und Sperre
//   POST /api/me/klara/kalender/anbindungen/:id/abgleich          externe Änderungen verarbeiten
//   POST /api/me/klara/kalender/zuordnungen/:schluessel/loeschvorschau   Ziel + Fassung lesen
//   POST /api/me/klara/kalender/zuordnungen/:schluessel/loeschen         an die Fassung gebunden
//   POST /api/me/klara/kalender/zuordnungen/:schluessel/entscheidung     ausdrücklich entscheiden
//   GET  /api/me/klara/kalender/lauf?auftragId&ereignisId         Laufstand für den Scheduler
//
// Dieselbe Tür-Regel wie die persönlichen Aufgaben (`klara-aufgabe-routes.ts`): das Konto kommt
// AUSSCHLIESSLICH aus der Sitzung; fremde und unbekannte Anbindungen/Zuordnungen antworten gleich
// (404) — auch für Administratoren. Ins Prüfprotokoll gehen nur Kennungen, Stände und Umfänge, nie
// Termininhalte, Teilnehmeradressen oder Zugangsmerkmale.

export const KLARA_KALENDER_ANBINDUNG_ENTFERNT = "klara.kalender.anbindung_entfernt";
export const KLARA_KALENDER_VERBUNDEN = "klara.kalender.verbunden";
export const KLARA_KALENDER_EINGETRAGEN = "klara.kalender.eingetragen";
export const KLARA_KALENDER_GELOESCHT = "klara.kalender.geloescht";
export const KLARA_KALENDER_ENTSCHIEDEN = "klara.kalender.entschieden";
export const KLARA_KALENDER_ABGEGLICHEN = "klara.kalender.abgeglichen";

export interface KlaraKalenderRoutenDeps {
  dienst: KalenderAnbindungDienst;
  audit: AuditService;
  /**
   * S09 (AW17-K01): ein Eintrag des eigenen Kalenders als interner Termin — mit SEINER Auftrags- und
   * Ereigniskennung (`kalenderIdentitaet`), gelesen mit heutigen Rechten. Ohne Angabe: nur `termin`.
   */
  eigenerTermin?: (user: SessionUser, eintragId: string) => Promise<InternerTermin>;
}

const FEHLERCODE: Record<KalenderAnbindungFehler["status"], string> = {
  400: "VALIDATION",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof KalenderAnbindungFehler) {
    reply.code(fehler.status).send({
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  // Ein Anbieterfehler außerhalb des Ergebnisweges (Konto/Kalender lesen): fester Satz, kein 401 —
  // die eigene Sitzung ist gültig, nur der verbundene Kalender antwortet nicht brauchbar.
  const lage = anbieterFehlerlage(fehler);
  if (lage) {
    reply.code(409).send({
      error: "CALENDAR",
      grund: lage,
      message: (fehler as Error).message,
    });
    return;
  }
  sendError(reply, fehler);
}

function rumpf(body: unknown): Record<string, unknown> {
  return (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<
    string,
    unknown
  >;
}

/** Die Sicht nach außen — ohne Kontokennung. */
function anbindungSicht(a: KalenderAnbindung) {
  return {
    id: a.id,
    anbieter: a.anbieter,
    konto: a.konto,
    kalender: a.kalender,
    umfang: a.umfang,
    rechte: a.rechte,
    felder: a.felder,
    privatProjektion: a.privatProjektion,
    entfernteAnzeige: a.entfernteAnzeige,
    angelegtAm: a.angelegtAm,
  };
}

function zuordnungSicht(z: KalenderZuordnung): Omit<KalenderZuordnung, "kontoId"> {
  return Object.fromEntries(Object.entries(z).filter(([k]) => k !== "kontoId")) as Omit<
    KalenderZuordnung,
    "kontoId"
  >;
}

function ergebnisSicht(r: KalenderErgebnis) {
  return r.ok
    ? { ok: true as const, zuordnung: zuordnungSicht(r.zuordnung), termin: r.termin }
    : {
        ok: false as const,
        stand: r.stand,
        grund: r.grund,
        meldung: r.meldung,
        zuordnung: r.zuordnung ? zuordnungSicht(r.zuordnung) : null,
      };
}

export function klaraKalenderRoutes(
  deps: KlaraKalenderRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, audit } = deps;
  const BASIS = "/api/me/klara/kalender";

  return async (app) => {
    app.get(BASIS, async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const anbindungen = await dienst.anbindungen(user.id);
        // Antwortet der Kalender nicht, bleiben die eigenen Anbindungen trotzdem sichtbar.
        let auswahl: unknown;
        try {
          auswahl = await dienst.auswahl(user.id);
        } catch (fehler) {
          const lage = anbieterFehlerlage(fehler);
          if (!lage) {
            throw fehler;
          }
          auswahl = { verbunden: false, grund: lage, meldung: (fehler as Error).message };
        }
        reply.code(200).send({ auswahl, anbindungen: anbindungen.map(anbindungSicht) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post("/api/me/klara/kalender/anbindungen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const a = await dienst.verbinde(user.id, rumpf(request.body));
        await audit.record({
          actor: user.id,
          action: KLARA_KALENDER_VERBUNDEN,
          target: `klara-kalender:${a.id}`,
          payload: { anbieter: a.anbieter, art: a.kalender.art, umfang: a.umfang },
        });
        reply.code(201).send({ anbindung: anbindungSicht(a) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { id: string } }>(
      "/api/me/klara/kalender/anbindungen/:id/entfernen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) return;
        try {
          await dienst.entferneAnbindung(
            user.id,
            request.params.id,
            rumpf(request.body).bestaetigt,
          );
          await audit.record({
            actor: user.id,
            action: KLARA_KALENDER_ANBINDUNG_ENTFERNT,
            target: `klara-kalender:${request.params.id}`,
            payload: {},
          });
          reply.code(200).send({ entfernt: true });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get<{ Params: { id: string }; Querystring: { von?: string; bis?: string } }>(
      "/api/me/klara/kalender/anbindungen/:id/termine",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        const { von, bis } = request.query;
        if (typeof von !== "string" || typeof bis !== "string" || !(von < bis)) {
          reply.code(400).send({ error: "VALIDATION", message: "von und bis sind Pflicht." });
          return;
        }
        try {
          reply.code(200).send(await dienst.lese(user.id, request.params.id, von, bis));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/me/klara/kalender/anbindungen/:id/termine",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const body = rumpf(request.body);
          // S09: ein Eintrag des EIGENEN Kalenders kommt mit SEINER Auftrags- und Ereigniskennung —
          // der Server liest ihn selbst mit heutigen Rechten; der Browser nennt nur die Kennung.
          const termin =
            typeof body.eigenerEintragId === "string" && deps.eigenerTermin
              ? await deps.eigenerTermin(user, body.eigenerEintragId)
              : pruefeInternenTermin(body.termin);
          const auftrag = pruefeTeilnehmerAuftragEingabe(body.teilnehmerAuftrag);
          const r = await dienst.projiziere(user.id, request.params.id, termin, auftrag);
          await audit.record({
            actor: user.id,
            action: KLARA_KALENDER_EINGETRAGEN,
            target: `klara-kalender:${request.params.id}`,
            payload: {
              ok: r.ok,
              stand: r.ok ? r.zuordnung.stand : r.stand,
              einladung: auftrag.teilnehmerAuftrag ? auftrag.teilnehmerAuftrag.adressen.length : 0,
            },
          });
          // Kein falscher Erfolg: ein nicht nachgelesenes Ergebnis ist 202 (ausstehend) bzw. 409.
          reply.code(r.ok ? 200 : r.stand === "ausstehend" ? 202 : 409).send(ergebnisSicht(r));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get<{ Params: { id: string } }>(
      "/api/me/klara/kalender/anbindungen/:id/zuordnungen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const alle = await dienst.zuordnungen(user.id, request.params.id);
          reply.code(200).send({ zuordnungen: alle.map(zuordnungSicht) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/me/klara/kalender/anbindungen/:id/abgleich",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const alle = await dienst.gleicheAlleAb(user.id, request.params.id);
          const pausiert = alle.filter(
            (x) => x.ergebnis.ok && x.ergebnis.laufWirkung === "pausiert",
          );
          await audit.record({
            actor: user.id,
            action: KLARA_KALENDER_ABGEGLICHEN,
            target: `klara-kalender:${request.params.id}`,
            payload: { zuordnungen: alle.length, pausiert: pausiert.length },
          });
          reply.code(200).send({
            ergebnisse: alle.map((x) => ({
              schluessel: x.schluessel,
              laufWirkung: x.ergebnis.ok ? (x.ergebnis.laufWirkung ?? "keine") : null,
              ergebnis: ergebnisSicht(x.ergebnis),
            })),
          });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { schluessel: string } }>(
      "/api/me/klara/kalender/zuordnungen/:schluessel/loeschvorschau",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const z = await dienst.zuordnung(user.id, request.params.schluessel);
          const r = await dienst.loeschVorschau(
            user.id,
            z.anbindungId,
            z.intern,
            rumpf(request.body).umfang,
          );
          reply.code(r.ok ? 200 : 409).send(r);
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { schluessel: string } }>(
      "/api/me/klara/kalender/zuordnungen/:schluessel/loeschen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const z = await dienst.zuordnung(user.id, request.params.schluessel);
          const body = rumpf(request.body);
          const r = await dienst.loesche(user.id, z.anbindungId, z.intern, {
            umfang: body.umfang,
            fassung: body.fassung,
          });
          await audit.record({
            actor: user.id,
            action: KLARA_KALENDER_GELOESCHT,
            target: `klara-kalender-zuordnung:${z.schluessel}`,
            payload: {
              ok: r.ok,
              umfang: typeof body.umfang === "string" ? body.umfang : null,
              grund: r.ok ? null : r.grund,
            },
          });
          reply.code(r.ok ? 200 : r.stand === "ausstehend" ? 202 : 409).send(ergebnisSicht(r));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { schluessel: string } }>(
      "/api/me/klara/kalender/zuordnungen/:schluessel/entscheidung",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const z = await dienst.zuordnung(user.id, request.params.schluessel);
          const body = rumpf(request.body);
          const r = await dienst.entscheide(user.id, z.anbindungId, z.intern, {
            wahl: body.wahl,
            umfang: body.umfang,
          });
          await audit.record({
            actor: user.id,
            action: KLARA_KALENDER_ENTSCHIEDEN,
            target: `klara-kalender-zuordnung:${z.schluessel}`,
            payload: {
              wahl: typeof body.wahl === "string" ? body.wahl : null,
              umfang: typeof body.umfang === "string" ? body.umfang : null,
              laufWirkung: r.laufWirkung,
            },
          });
          reply.code(200).send({ laufWirkung: r.laufWirkung, ergebnis: ergebnisSicht(r.ergebnis) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get<{ Querystring: { auftragId?: string; ereignisId?: string } }>(
      "/api/me/klara/kalender/lauf",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        const { auftragId, ereignisId } = request.query;
        if (typeof auftragId !== "string" || typeof ereignisId !== "string") {
          reply
            .code(400)
            .send({ error: "VALIDATION", message: "auftragId und ereignisId sind Pflicht." });
          return;
        }
        try {
          const stand = await dienst.laufStand(user.id, auftragId, ereignisId);
          reply.code(200).send({ auftragId, ereignisId, stand });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}
