import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { DraftPayload } from "../../../capture";
import { leiteLernbereichAb } from "../assistenz-lernen-lernauftrag";
import { type Guards, sendError, tokenFromRequest } from "../http";
import {
  AUSSEN_BESTAETIGUNG_GUELTIG_MS,
  type AussenBestaetigung,
  type BeobachtungEingabe,
  type KorrekturEingabe,
  type Lernsitzung,
  ROHDATEN_FRIST_STUNDEN,
  type Routine,
  SICHTBAR_GUELTIG_MS,
  type StartEingabe,
  VORMACHEN_ABBRUCH_REGELN,
  VORMACHEN_HOSTS,
  VORMACHEN_HOSTS_MIT_ANZEIGE,
  VORMACHEN_VORGAENGE,
  type VormachenDienst,
  VormachenFehler,
  clientSchluessel,
} from "../vormachen";
import { hostDerAnfrage } from "../vormachen-arbeitswege";

// ================================================================================================
// produkt:20261011:peter-p06 — VORMACHEN UND PERSÖNLICHE ROUTINE, NUR FÜR DAS EIGENE KONTO.
// ================================================================================================
//
//   GET    /api/me/vormachen                         — eigene Lernsitzungen, Notizen, Routinen
//   POST   /api/me/vormachen                         — Lernsitzung mit Host, Vorgängen, Zweck starten
//   DELETE /api/me/vormachen                         — Privatlöschung (Sitzungen, Notizen, Routinen)
//   POST   /api/me/vormachen/:id/beobachtungen       — nur Vorgänge mit Quelle `client` (Seitenwechsel);
//                                                      Arbeitswege schreibt der Server selbst mit
//                                                      (`vormachen-arbeitswege.ts`, onResponse)
//   PUT    /api/me/vormachen/:id/zustand             — sofort pausieren / fortsetzen
//   GET    /api/me/vormachen/:id/vorschau            — nachvollziehbare Vorschau der Routine
//   PUT    /api/me/vormachen/:id/korrektur           — Schritt korrigieren oder herausnehmen
//   POST   /api/me/vormachen/:id/bestaetigung        — Vorschau mit ihrem Stand bestätigen
//   POST   /api/me/vormachen/:id/abbruch             — abbrechen nach der gewählten Regel
//   DELETE /api/me/vormachen/:id                     — eine Lernsitzung oder behaltene Notiz löschen
//   POST   /api/me/vormachen/routinen/:id/schritte/:schrittId/freigabe — einen Schritt freigeben;
//          Außenschritt: ohne `bestaetigung` 409 mit angeforderter `ausfuehrung`, dann einmal
//          `{ bestaetigung: { ausfuehrung } }` (gebunden an Routine, Schritt, Ausführung)
//   POST   /api/me/vormachen/routinen/:id/firmenuebergabe              — Kopie als Entwurf übergeben
//
// Das Konto kommt AUSSCHLIESSLICH aus der Sitzung (`user.id`); fremd und unbekannt antworten 404.
// Kein zusätzliches Recht: wer angemeldet ist, führt seine eigenen Routinen; nur die Firmenübergabe
// verlangt wie jeder Entwurf das Anlagerecht `ko.create`. Ins Prüfprotokoll gehen
// nur EREIGNISSE mit Zahlen und Kennungen — nie Beschreibung, Rohwert oder Zweck.

export const VORMACHEN_GESTARTET = "vormachen.gestartet";
export const VORMACHEN_PAUSIERT = "vormachen.pausiert";
export const VORMACHEN_FORTGESETZT = "vormachen.fortgesetzt";
export const VORMACHEN_BESTAETIGT = "vormachen.routine.bestaetigt";
export const VORMACHEN_ABGEBROCHEN = "vormachen.abgebrochen";
export const VORMACHEN_NOTIZ_VERWORFEN = "vormachen.notiz.verworfen";
export const VORMACHEN_AUSSENAKTION = "vormachen.aussenaktion.bestaetigt";
export const VORMACHEN_FIRMENUEBERGABE = "vormachen.firmenuebergabe";
export const VORMACHEN_PRIVAT_GELOESCHT = "vormachen.privat.geloescht";

export interface VormachenRoutenDeps {
  dienst: VormachenDienst;
  audit: AuditService;
  /** Der vorhandene Entwurfsweg — eine Firmenübergabe ist dort eine eigene Kopie. */
  entwuerfe: { createDraft(payload: DraftPayload, author: string): Promise<{ id: string }> };
}

const FEHLERCODE: Record<VormachenFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "NICHT_GEWAEHLT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof VormachenFehler) {
    reply.code(fehler.status).send({
      ...fehler.details,
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  sendError(reply, fehler);
}

/** BPA-06 AC01: Rückfragen eines Lernauftrags, die eine ausdrückliche Wahl beantwortet. */
const WAEHLBAR: readonly string[] = ["vorgang_unklar", "anwendung_unklar"];

function rumpf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function escapeHtml(roh: string): string {
  return roh
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function vormachenRoutes(deps: VormachenRoutenDeps, guards: Guards): FastifyPluginAsync {
  const { dienst, audit, entwuerfe } = deps;

  /** Die Sicht einer Lernsitzung — Lernnotiz ohne Rohwerte, Rohdaten nur als Zahl. */
  const sitzungSicht = (s: Lernsitzung) => ({
    id: s.id,
    host: s.host,
    vorgaenge: s.vorgaenge,
    zweck: s.zweck,
    abbruchRegel: s.abbruchRegel,
    zustand: s.zustand,
    beobachtet: s.beobachtungen.length,
    rohwerte: s.beobachtungen.filter((b) => b.rohwert !== null).length,
    nichtAufgenommen: s.nichtAufgenommen,
    lernnotiz: dienst.lernnotiz(s),
    angelegtAm: s.angelegtAm,
    verfallAm: s.verfallAm,
  });

  const routineSicht = (r: Routine) => ({
    id: r.id,
    titel: r.titel,
    zweck: r.zweck,
    host: r.host,
    modus: r.modus,
    fassung: r.fassung,
    schritte: r.schritte,
    herkunft: r.herkunft,
    bestaetigtAm: r.bestaetigtAm,
    firmenuebergabe: r.firmenuebergabe,
    // BPA-06 (assistenz-lernen-routes.ts): Zustand, Zeitplan und Ableitung aus Vorführungen.
    zustand: r.zustand ?? "aktiv",
    zeitplan: r.zeitplan ?? null,
    ableitung: r.ableitung ?? null,
    // BPA-06 Nacharbeit 41: an welches Word (Programm, Hostfassung) die Routine gebunden ist.
    hostbindung: r.hostbindung ?? null,
    // EQF-06-K10: der Fassungsverlauf nach Korrekturen, je mit Quelle.
    versionen: r.versionen ?? [],
    // EQF-06-K06: die Übergabeart (fehlt sie, läuft die Routine selbstständig).
    ausfuehrung: r.ausfuehrung ?? "selbststaendig",
  });

  return async (app) => {
    app.get<{ Querystring: { anzeige?: string } }>("/api/me/vormachen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const { sitzungen, routinen } = await dienst.uebersicht(user.id);
        // `?anzeige=<host>`: die Lernanzeige DIESES Clients zeigt den Zustand gerade sichtbar —
        // nur dann wird hier mitgeschrieben (`meldeSichtbar`, gebunden an die Anmeldesitzung).
        const offen = sitzungen.some((s) => s.zustand !== "abgebrochen");
        const anzeige = request.query?.anzeige;
        const sichtbar =
          offen &&
          dienst.meldeSichtbar(user.id, anzeige, clientSchluessel(tokenFromRequest(request)));
        reply.header("cache-control", "no-store");
        reply.code(200).send({
          sitzungen: sitzungen.map(sitzungSicht),
          routinen: routinen.map(routineSicht),
          sichtbar,
          katalog: {
            hosts: VORMACHEN_HOSTS,
            hostsMitAnzeige: VORMACHEN_HOSTS_MIT_ANZEIGE,
            sichtbarGueltigSekunden: SICHTBAR_GUELTIG_MS / 1000,
            vorgaenge: VORMACHEN_VORGAENGE,
            abbruchRegeln: VORMACHEN_ABBRUCH_REGELN,
            rohdatenFristStunden: ROHDATEN_FRIST_STUNDEN,
            bestaetigungGueltigSekunden: AUSSEN_BESTAETIGUNG_GUELTIG_MS / 1000,
          },
        });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Body: unknown }>("/api/me/vormachen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const body = rumpf(request.body);
        // BPA-06 AC01: ein natürlicher Lernauftrag (`auftrag`) bestimmt den Lernbereich selbst —
        // ausdrücklich gewählte `host`/`vorgaenge` (Antwort auf eine Rückfrage) gehen vor.
        let eingabe = body as StartEingabe;
        if (typeof body.auftrag === "string") {
          const herkunft = hostDerAnfrage(request.headers, body);
          const b = leiteLernbereichAb(body.auftrag, herkunft);
          const gewaehlt = body.host !== undefined && body.vorgaenge !== undefined;
          // Eine Wahl beantwortet nur eine Rückfrage nach Vorgang oder Anwendung — nie eine nicht
          // freigegebene Anwendung oder einen Satz ohne Lernabsicht.
          const waehlbar = b.art === "klaerung" && WAEHLBAR.includes(b.grund);
          if (b.art === "klaerung" && !(gewaehlt && waehlbar)) {
            const klaerung = { art: b.grund, frage: b.frage, optionen: b.optionen };
            throw new VormachenFehler(422, "klaerung", b.frage, { klaerung });
          }
          const zweck = body.auftrag.trim().slice(0, 300);
          eingabe = gewaehlt
            ? { host: body.host, vorgaenge: body.vorgaenge, zweck }
            : b.art === "bereich"
              ? { host: b.host, vorgaenge: [...b.vorgaenge], zweck: b.zweck }
              : eingabe;
        }
        const s = await dienst.starte(user.id, eingabe);
        await audit.record({
          actor: user.id,
          action: VORMACHEN_GESTARTET,
          target: `vormachen:${s.id}`,
          payload: {
            host: s.host,
            vorgaenge: s.vorgaenge,
            abbruchRegel: s.abbruchRegel,
            ...(typeof body.auftrag === "string" ? { ausLernauftrag: true } : {}),
          },
        });
        reply.code(201).send({ sitzung: sitzungSicht(s) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    // Löschen wirkt ZUERST, der Nachweis folgt (wie beim Gedächtnis).
    app.delete("/api/me/vormachen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const geloescht = await dienst.privatLoeschen(user.id);
        await audit.record({
          actor: user.id,
          action: VORMACHEN_PRIVAT_GELOESCHT,
          target: user.id,
          payload: geloescht,
        });
        reply.code(200).send({ geloescht });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/:id/beobachtungen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const eingabe = rumpf(request.body) as BeobachtungEingabe;
          const client = clientSchluessel(tokenFromRequest(request));
          const nr = await dienst.beobachte(user.id, request.params.id, eingabe, client);
          reply.code(201).send({ nr });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/:id/zustand",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const zustand = rumpf(request.body).zustand;
          const s = await dienst.setzeZustand(user.id, request.params.id, zustand);
          await audit.record({
            actor: user.id,
            action: s.zustand === "pausiert" ? VORMACHEN_PAUSIERT : VORMACHEN_FORTGESETZT,
            target: `vormachen:${s.id}`,
          });
          reply.code(200).send({ sitzung: sitzungSicht(s) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get<{ Params: { id: string } }>(
      "/api/me/vormachen/:id/vorschau",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          reply.header("cache-control", "no-store");
          reply.code(200).send({ vorschau: await dienst.vorschau(user.id, request.params.id) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/:id/korrektur",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const eingabe = rumpf(request.body) as KorrekturEingabe;
          const vorschau = await dienst.korrigiere(user.id, request.params.id, eingabe);
          reply.code(200).send({ vorschau });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/:id/bestaetigung",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const eingabe = rumpf(request.body) as { stand?: unknown; titel?: unknown };
          const r = await dienst.bestaetige(user.id, request.params.id, eingabe);
          await audit.record({
            actor: user.id,
            action: VORMACHEN_BESTAETIGT,
            target: `routine:${r.id}`,
            payload: { sitzung: r.herkunft.sitzungId, schritte: r.schritte.length },
          });
          reply.code(201).send({ routine: routineSicht(r) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/me/vormachen/:id/abbruch",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const ergebnis = await dienst.brecheAb(user.id, request.params.id);
          await audit.record({
            actor: user.id,
            action: VORMACHEN_ABGEBROCHEN,
            target: `vormachen:${request.params.id}`,
            payload: { ...ergebnis },
          });
          reply.code(200).send(ergebnis);
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.delete<{ Params: { id: string } }>("/api/me/vormachen/:id", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        await dienst.verwerfeNotiz(user.id, request.params.id);
        await audit.record({
          actor: user.id,
          action: VORMACHEN_NOTIZ_VERWORFEN,
          target: `vormachen:${request.params.id}`,
        });
        reply.code(200).send({ geloescht: 1 });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { id: string; schrittId: string }; Body: unknown }>(
      "/api/me/vormachen/routinen/:id/schritte/:schrittId/freigabe",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const body = rumpf(request.body);
          const bestaetigung =
            body.bestaetigung && typeof body.bestaetigung === "object"
              ? (body.bestaetigung as AussenBestaetigung)
              : undefined;
          const { id, schrittId } = request.params;
          const freigabe = await dienst.gibSchrittFrei(user.id, id, schrittId, bestaetigung);
          if (freigabe.art === "aussenaktion_bestaetigt") {
            await audit.record({
              actor: user.id,
              action: VORMACHEN_AUSSENAKTION,
              target: `routine:${id}`,
              payload: {
                schritt: schrittId,
                vorgang: freigabe.schritt.vorgang,
                ausfuehrung: freigabe.ausfuehrung,
              },
            });
          }
          reply.code(200).send({ freigabe });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/me/vormachen/routinen/:id/firmenuebergabe",
      async (request, reply) => {
        // Dasselbe Anlagerecht wie `POST /api/drafts` — die Übergabe ist ein Entwurf, kein Umweg.
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          const r = await dienst.routine(user.id, request.params.id);
          if (r.firmenuebergabe) {
            reply.code(200).send({ routine: routineSicht(r), neu: false });
            return;
          }
          const liste = r.schritte.map((x) => `<li>${escapeHtml(x.beschreibung)}</li>`).join("");
          const entwurf = await entwuerfe.createDraft(
            {
              title: r.titel,
              statement: r.zweck,
              bodyHtml: `<ol>${liste}</ol><p>Aus einer persönlichen Routine übernommen.</p>`,
              // Die vorsichtige Stufe; die Person ändert sie im Entwurf vor dem Einreichen.
              confidentiality: "vertraulich",
              tags: ["routine"],
            },
            user.id,
          );
          const neu = await dienst.vermerkeFirmenuebergabe(user.id, r.id, entwurf.id);
          await audit.record({
            actor: user.id,
            action: VORMACHEN_FIRMENUEBERGABE,
            target: `routine:${r.id}`,
            payload: { entwurf: entwurf.id },
          });
          reply.code(201).send({ routine: routineSicht(neu), neu: true });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}
