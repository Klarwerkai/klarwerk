import { createHash } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { AuditService } from "../../../audit";
import {
  type FaehigkeitsAusfuehrung,
  FaehigkeitsVormerkungFehler,
  type FaehigkeitsVormerkungen,
  type Faehigkeitsauftrag,
  type Faehigkeitsergebnis,
  type KontextTeil,
  bindungsFingerabdruck,
} from "../assistenz-faehigkeiten";
import { type Guards, type SessionUser, sendError, tokenFromRequest } from "../http";

// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) — DIE FÄHIGKEITEN DER EIGENEN ASSISTENZ.
// ================================================================================================
//
//   GET  /api/me/faehigkeiten                                   Übersicht + eigene Vormerkungen
//   POST /api/me/faehigkeiten/vormerkungen                      Favorit / bestätigte Routine
//   POST /api/me/faehigkeiten/vormerkungen/:id/deaktivieren     Vormerkung deaktivieren
//   POST /api/me/faehigkeiten/vorschau                          Wahl + Bindung, nichts ausgeführt
//   POST /api/me/faehigkeiten/auftraege                         Ausführen (sofort oder Hintergrund)
//   GET  /api/me/faehigkeiten/auftraege                         Eigene Aufträge
//   GET  /api/me/faehigkeiten/auftraege/:id                     Ein eigener Auftrag
//   POST /api/me/faehigkeiten/auftraege/:id/abbrechen           Eigenen Lauf abbrechen
//
// Konto, Sitzung und Rechte kommen AUSSCHLIESSLICH aus der Anmeldung; eine Kontokennung im Rumpf
// wird abgewiesen. Der Arbeitsbereichskontext kommt nur als Kennungen und wird hier aus dem Bestand
// geladen — mit den Rechten des Kontos (`ladeKontext`), nie aus mitgeschicktem Text. Ins
// Prüfprotokoll geht das Ereignis mit Fähigkeit und Auftragskennung, nie Eingabe oder Ergebnis.

export const FAEHIGKEIT_VORMERKUNG_GESPEICHERT = "assistenz.faehigkeit.vorgemerkt";
export const FAEHIGKEIT_VORMERKUNG_DEAKTIVIERT = "assistenz.faehigkeit.deaktiviert";
export const FAEHIGKEIT_AUFTRAG = "assistenz.faehigkeit.auftrag";

export interface FaehigkeitenRoutenDeps {
  readonly ausfuehrung: FaehigkeitsAusfuehrung;
  readonly vormerkungen: FaehigkeitsVormerkungen;
  /** Lädt den Kontext mit den Rechten des Kontos; `null`, wenn ein Objekt nicht sichtbar ist. */
  readonly kontext: (
    user: SessionUser,
    kennungen: readonly string[],
  ) => Promise<KontextTeil[] | null>;
  readonly audit: AuditService;
  readonly mandant: string;
  /** Startet die Abarbeitung eingestellter Hintergrundaufträge (nicht im Wiederanlauf). */
  readonly hintergrund?: () => void;
}

const KONTO_FELDER = [
  "kontoId",
  "konto",
  "userId",
  "user",
  "nutzer",
  "mandant",
  "sitzung",
] as const;
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const MAX_KONTEXT = 20;

function rumpf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function fremdeAngabe(request: FastifyRequest, eigeneId: string): boolean {
  const r = rumpf(request.body);
  return KONTO_FELDER.some((feld) => r[feld] !== undefined && r[feld] !== eigeneId);
}

function abweisen(reply: FastifyReply, status: 400 | 403 | 404, message: string): void {
  reply.code(status).send({
    error: status === 400 ? "VALIDATION" : status === 403 ? "FORBIDDEN" : "NOT_FOUND",
    message,
  });
}

/** Eine Sitzungskennung OHNE den Sitzungsschlüssel — er gehört in keine Bindung. */
function sitzungVon(request: FastifyRequest): string {
  const token = tokenFromRequest(request);
  return token ? createHash("sha256").update(token).digest("hex").slice(0, 16) : "ohne-sitzung";
}

type Anfrage =
  | { ok: true; auftrag: Faehigkeitsauftrag }
  | { ok: false; status: 400 | 404; message: string };

async function auftragAus(
  deps: FaehigkeitenRoutenDeps,
  request: FastifyRequest,
  user: SessionUser,
): Promise<Anfrage> {
  const r = rumpf(request.body);
  const zweck = r.zweck;
  if (typeof zweck !== "string" || zweck.trim() === "" || zweck.length > 80) {
    return { ok: false, status: 400, message: "zweck ist Pflicht." };
  }
  const gewaehlt = r.gewaehlt ?? null;
  if (gewaehlt !== null && (typeof gewaehlt !== "string" || !KENNUNG.test(gewaehlt))) {
    return { ok: false, status: 400, message: "gewaehlt ist keine gültige Fähigkeitskennung." };
  }
  const eingabe = r.eingabe ?? {};
  if (typeof eingabe !== "object" || eingabe === null || Array.isArray(eingabe)) {
    return { ok: false, status: 400, message: "eingabe muss ein Objekt sein." };
  }
  const arbeitsbereich = r.arbeitsbereich ?? null;
  if (
    arbeitsbereich !== null &&
    (typeof arbeitsbereich !== "string" || arbeitsbereich.length > 200)
  ) {
    return { ok: false, status: 400, message: "arbeitsbereich ist ungültig." };
  }
  const kennungen = r.kontext ?? [];
  if (
    !Array.isArray(kennungen) ||
    kennungen.length > MAX_KONTEXT ||
    kennungen.some((k) => typeof k !== "string" || k.length === 0 || k.length > 200)
  ) {
    return { ok: false, status: 400, message: "kontext muss eine Liste von Kennungen sein." };
  }
  const ausloeserRoh = r.ausloeser ?? "nutzerauftrag";
  if (ausloeserRoh !== "nutzerauftrag" && ausloeserRoh !== "routine") {
    return { ok: false, status: 400, message: "ausloeser ist nutzerauftrag oder routine." };
  }
  const ausloeser = ausloeserRoh as "nutzerauftrag" | "routine";
  const auftragId =
    r.auftragId ??
    `vorschau-${createHash("sha256").update(String(Date.now())).digest("hex").slice(0, 12)}`;
  if (typeof auftragId !== "string" || !KENNUNG.test(auftragId)) {
    return { ok: false, status: 400, message: "auftragId ist ungültig." };
  }
  const kontext = await deps.kontext(user, kennungen as string[]);
  if (kontext === null) {
    // G05: kein Hinweis, WELCHES Objekt fehlt oder verborgen ist.
    return {
      ok: false,
      status: 404,
      message: "Der angegebene Arbeitsbereichskontext ist nicht verfügbar.",
    };
  }
  return {
    ok: true,
    auftrag: {
      auftragId,
      mandant: deps.mandant,
      nutzer: user.id,
      sitzung: sitzungVon(request),
      arbeitsbereich: arbeitsbereich as string | null,
      zweck: zweck.trim(),
      gewaehlt: gewaehlt as string | null,
      eingabe: eingabe as Record<string, unknown>,
      kontext,
      ausloeser,
    },
  };
}

export function assistenzFaehigkeitenRoutes(
  deps: FaehigkeitenRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { ausfuehrung, vormerkungen, audit } = deps;

  return async (app) => {
    app.get("/api/me/faehigkeiten", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        reply.header("cache-control", "no-store");
        reply.code(200).send({
          faehigkeiten: await ausfuehrung.uebersicht({ mandant: deps.mandant, nutzer: user.id }),
          vormerkungen: await vormerkungen.liste(user.id),
        });
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.post<{ Body: unknown }>("/api/me/faehigkeiten/vormerkungen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      if (fremdeAngabe(request, user.id)) {
        abweisen(reply, 403, "Vormerkungen gehören zum eigenen Konto.");
        return;
      }
      const r = rumpf(request.body);
      const faehigkeitId = r.faehigkeitId;
      const art = r.art;
      const zweck = r.zweck;
      if (typeof faehigkeitId !== "string" || (art !== "favorit" && art !== "routine")) {
        abweisen(reply, 400, "faehigkeitId und art (favorit oder routine) sind Pflicht.");
        return;
      }
      if (zweck !== undefined && zweck !== null && typeof zweck !== "string") {
        abweisen(reply, 400, "zweck muss Text sein.");
        return;
      }
      try {
        const vm = await vormerkungen.speichere(user.id, {
          faehigkeitId,
          art: art as "favorit" | "routine",
          zweck: typeof zweck === "string" ? zweck : null,
          bestaetigt: r.bestaetigt === true,
        });
        await audit.record({
          actor: user.id,
          action: FAEHIGKEIT_VORMERKUNG_GESPEICHERT,
          target: `faehigkeit:${vm.faehigkeitId}`,
        });
        reply.header("cache-control", "no-store");
        reply.code(200).send({ vormerkung: vm, vormerkungen: await vormerkungen.liste(user.id) });
      } catch (fehler) {
        if (fehler instanceof FaehigkeitsVormerkungFehler) {
          abweisen(reply, fehler.status === 409 ? 400 : fehler.status, fehler.message);
          return;
        }
        sendError(reply, fehler);
      }
    });

    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/me/faehigkeiten/vormerkungen/:id/deaktivieren",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        if (fremdeAngabe(request, user.id)) {
          abweisen(reply, 403, "Vormerkungen gehören zum eigenen Konto.");
          return;
        }
        try {
          await vormerkungen.deaktiviere(user.id, request.params.id);
          await audit.record({
            actor: user.id,
            action: FAEHIGKEIT_VORMERKUNG_DEAKTIVIERT,
            target: `faehigkeit:${request.params.id}`,
          });
          reply.header("cache-control", "no-store");
          reply.code(200).send({ vormerkungen: await vormerkungen.liste(user.id) });
        } catch (fehler) {
          if (fehler instanceof FaehigkeitsVormerkungFehler) {
            abweisen(reply, fehler.status === 409 ? 400 : fehler.status, fehler.message);
            return;
          }
          sendError(reply, fehler);
        }
      },
    );

    app.post<{ Body: unknown }>("/api/me/faehigkeiten/vorschau", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      if (fremdeAngabe(request, user.id)) {
        abweisen(reply, 403, "Ein Auftrag gehört zum eigenen Konto.");
        return;
      }
      try {
        const a = await auftragAus(deps, request, user);
        if (!a.ok) {
          abweisen(reply, a.status, a.message);
          return;
        }
        const vorbereitung = await ausfuehrung.bereiteVor(a.auftrag);
        reply.header("cache-control", "no-store");
        // AC03/G04: Die Ausführung ist nur für GENAU diese Bindung zulässig — Kennung und
        // Fingerabdruck gehen mit der Bestätigung zurück (`POST …/auftraege`).
        reply.code(200).send({
          vorbereitung,
          auftragId: a.auftrag.auftragId,
          fingerabdruck:
            vorbereitung.art === "gebunden" ? bindungsFingerabdruck(vorbereitung.bindung) : null,
        });
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.post<{ Body: unknown }>("/api/me/faehigkeiten/auftraege", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      if (fremdeAngabe(request, user.id)) {
        abweisen(reply, 403, "Ein Auftrag gehört zum eigenen Konto.");
        return;
      }
      const r = rumpf(request.body);
      if (typeof r.auftragId !== "string" || !KENNUNG.test(r.auftragId)) {
        abweisen(reply, 400, "auftragId ist Pflicht (Buchstaben, Ziffern, . _ : -).");
        return;
      }
      if (r.bestaetigt !== true) {
        abweisen(
          reply,
          400,
          "Die Ausführung braucht die Bestätigung der Vorschau (bestaetigt: true).",
        );
        return;
      }
      const angezeigt = r.vorschauFingerabdruck;
      if (typeof angezeigt !== "string" || !/^[0-9a-f]{64}$/.test(angezeigt)) {
        abweisen(
          reply,
          400,
          "Die Ausführung braucht den Fingerabdruck der bestätigten Vorschau (vorschauFingerabdruck).",
        );
        return;
      }
      try {
        const a = await auftragAus(deps, request, user);
        if (!a.ok) {
          abweisen(reply, a.status, a.message);
          return;
        }
        const v = await ausfuehrung.bereiteVor(a.auftrag);
        if (v.art !== "gebunden") {
          reply.code(200).send({ vorbereitung: v, ergebnis: null });
          return;
        }
        // AC03/G04: ausgeführt wird nur die Bindung, die angezeigt und bestätigt wurde. Hat sich
        // seitdem Vertrag, Adapterfassung, Eingabe, Datenweg oder eine Kontextfassung geändert,
        // weicht der Fingerabdruck ab — dann keine Wirkung, sondern eine neue Vorschau.
        if (bindungsFingerabdruck(v.bindung) !== angezeigt) {
          reply.code(409).send({
            error: "CONFLICT",
            grund: "vorschau_veraltet",
            message:
              "Seit der Vorschau hat sich die Fähigkeit, die Eingabe oder der Arbeitsbereichskontext geändert. Bitte die neue Vorschau prüfen und erneut bestätigen.",
            vorbereitung: v,
            fingerabdruck: bindungsFingerabdruck(v.bindung),
          });
          return;
        }
        await audit.record({
          actor: user.id,
          action: FAEHIGKEIT_AUFTRAG,
          target: `faehigkeitsauftrag:${v.bindung.faehigkeitId}:${v.bindung.auftragId}`,
        });
        reply.header("cache-control", "no-store");
        if (r.hintergrund === true) {
          const stand = await ausfuehrung.starteImHintergrund(v.bindung);
          deps.hintergrund?.();
          reply.code(202).send({ vorbereitung: v, hintergrund: stand, ergebnis: null });
          return;
        }
        const ergebnis: Faehigkeitsergebnis = await ausfuehrung.fuehreAus(v.bindung);
        reply.code(200).send({ vorbereitung: v, ergebnis });
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.get("/api/me/faehigkeiten/auftraege", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        reply.header("cache-control", "no-store");
        reply.code(200).send({ auftraege: await ausfuehrung.auftraege(user.id) });
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.get<{ Params: { id: string } }>(
      "/api/me/faehigkeiten/auftraege/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const a = await ausfuehrung.auftrag(user.id, request.params.id);
          if (!a) {
            abweisen(reply, 404, "Diesen Auftrag gibt es für dein Konto nicht.");
            return;
          }
          reply.header("cache-control", "no-store");
          reply.code(200).send({ auftrag: a });
        } catch (fehler) {
          sendError(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/me/faehigkeiten/auftraege/:id/abbrechen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const abgebrochen = await ausfuehrung.brecheAb(user.id, request.params.id);
          reply.header("cache-control", "no-store");
          reply.code(200).send({ abgebrochen });
        } catch (fehler) {
          sendError(reply, fehler);
        }
      },
    );
  };
}
