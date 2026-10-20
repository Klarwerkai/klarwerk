import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { can } from "../../../rbac";
import {
  ROUTINEN_EREIGNISSE,
  type RoutinenEreignis,
  type Zeitplan,
  ereignisAusText,
  istRoutinenEreignis,
  pruefeZeitplan,
  siehtGeheimAus,
} from "../assistenz-lernen";
import { LaufAbgelehnt, legeRoutinenLaufAn } from "../assistenz-lernen-lauf";
import {
  HOST_VERSION_MAX,
  WORD_DOKUMENT,
  WORD_MARKIERUNG,
  type WordUmfang,
  istWordProgramm,
  wordPruefsumme,
  wordUmfaenge,
} from "../assistenz-lernen-word";
import type {
  RoutinenZeitsteuerung,
  ZeitplanLaufErgebnis,
} from "../assistenz-lernen-zeitsteuerung";
import { type Guards, sendError } from "../http";
import { auftragMitVerlauf } from "../klara-aktionsverlauf";
import { KLARA_KOERPER_MAX } from "../klara-auftrag";
import { type KlaraGespraechDienst, KlaraGespraechFehler } from "../klara-gespraech";
import {
  type BindungsSiegel,
  type HostBindung,
  abgelehnt,
  leseAdapterZiel,
  pruefeZielVorWirkung,
} from "../programmadapter";
import { KLARA_SINGLE_TENANT_ID } from "../services/klara-session-service";
import { type Routine, type VormachenDienst, VormachenFehler } from "../vormachen";

// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — EINE ROUTINE LAUFEN LASSEN.
// ================================================================================================
//
//   POST /api/me/vormachen/routinen/:id/lauf      { gespraech, lauf, fassung, eingaben }
//   PUT  /api/me/vormachen/routinen/:id/zustand   { zustand: "aktiv" | "pausiert" }
//   PUT  /api/me/vormachen/routinen/:id/ausfuehrung { ausfuehrung } (EQF-06-K06: Übergabeart)
//   PUT  /api/me/vormachen/routinen/:id/zeitplan  { zeitplan: Zeitplan | null, eingaben? }
//        AC05: die vorhandene Zeitsteuerung des Servers führt fällige Läufe mit diesen Eingaben
//        über denselben Laufweg aus (`assistenz-lernen-zeitsteuerung.ts`).
//
// Nacharbeit 41 — Word-Routinen über den Programmadapter (BPA-04), Aufrufer: das Word-Fenster
// (`apps/web/public/word-addin/vormachen.js`, Block KW-ROUTINEN):
//   GET  /api/me/vormachen/word-routinen          eigene Word-Routinen samt anstehendem Termin
//   PUT  /api/me/vormachen/routinen/:id/host      { bindung, aktuell, hostVersion }
//   POST /api/me/vormachen/routinen/:id/word-lauf { lauf, fassung, gespraech?, eingaben,
//                                                   host: { bindung, aktuell, hostVersion, markierung } }
//
// Der LAUF einer in P06 bestätigten Routine — und nur er. Die Routine kommt aus der P06-Ablage des
// eigenen Kontos (fremd und unbekannt 404). `planeLauf` prüft sie vor jeder Wirkung: Zustand
// (pausiert läuft nicht), Fassung (eine Wiederaufnahme läuft nur auf ihr), Eingaben (keine
// Zugangsdaten), Schreibrecht der Rolle (Beobachten allein genügt nicht), Halt an folgenreichen
// Schritten. Ein freigegebener Plan wird über die Brücke ein gebundener Klara-Auftrag im eigenen
// Gespräch; AUSGEFÜHRT wird er über den vorhandenen Weg des Aktionskerns
// (`POST …/auftraege/:auftragId/schritte/:schluessel/ausfuehrung`) mit dessen Rechten, Nachlesen,
// Wiederholschutz und Rücknahme. Kein zweiter Ausführungsweg.
//
// IDEMPOTENT (G12, Bens Befund zu 7073e04d): die Laufkennung wird mit Konto, Routine, Fassung,
// Gespräch und Eingaben dauerhaft an genau einen Auftrag gebunden (`VormachenDienst.einmalJeLauf`).
// Dieselbe Anfrage noch einmal liefert denselben Auftrag (200, `wiederholt`); dieselbe Kennung mit
// anderen Angaben wird abgewiesen (409 `lauf_widerspricht`).
//
// Ins Prüfprotokoll gehen nur Ereignis und Kennungen — nie Titel, Inhalt oder Zweck.

export const BPA06_LAUF_ANGELEGT = "bpa06.lauf.auftrag";
export const BPA06_ROUTINE_ZUSTAND = "bpa06.routine.zustand";
export const BPA06_ROUTINE_ZEITPLAN = "bpa06.routine.zeitplan";
export const BPA06_ROUTINE_HOST = "bpa06.routine.host";
/** EQF-06-K10: eine Korrektur an einer bestätigten Routine wurde die nächste Fassung. */
export const BPA06_ROUTINE_KORREKTUR = "bpa06.routine.korrektur";
/** EQF-06-K06: die Übergabeart einer Routine wurde gesetzt. */
export const BPA06_ROUTINE_AUSFUEHRUNG = "bpa06.routine.ausfuehrung";

export interface AssistenzLernenRoutenDeps {
  vormachen: VormachenDienst;
  klara: KlaraGespraechDienst;
  audit: AuditService;
  /**
   * Nacharbeit 41: das Siegel des Programmadapters (BPA-04) — DASSELBE wie unter
   * `/api/klara/programme`, damit eine dort ausgestellte Bindung hier gilt. Fehlt es, laufen keine
   * Word-Routinen.
   */
  siegel?: BindungsSiegel;
  /** Nacharbeit 41: die vorhandene Zeitsteuerung — ihr Laufweg führt auch Word-Läufe aus. */
  zeitsteuerung?: RoutinenZeitsteuerung;
}

const LAUF = /^[A-Za-z0-9_-]{1,100}$/;
const ZEITPLAN_EINGABEN_MAX = 20;
const ZEITPLAN_EINGABE_TEXT_MAX = 2_000;
/** Höchstlänge der übergebenen Markierung — wie beim Lesen über die Bedienungshilfe (BPA-04). */
const MARKIERUNG_MAX = 20_000;

/** Antwortstatus je Ausgang eines Word-Laufs. */
const HOSTLAUF_STATUS: Record<ZeitplanLaufErgebnis["stand"], number> = {
  ausgefuehrt: 201,
  abweichung: 200,
  offen: 202,
  angelegt: 202,
  wiederholt: 202,
  nicht_ausgefuehrt: 409,
  abgelehnt: 409,
  fehler: 503,
  wartet_auf_host: 202,
};

type WordHostPruefung =
  | { ok: true; aktuell: HostBindung; hostVersion: string }
  | { ok: false; status: number; antwort: Record<string, unknown> };

/**
 * Nacharbeit 41: der Host eines Word-Laufs oder einer Hostbindung, geprüft mit dem
 * Programmadapter. Mandant und Nutzer setzt der Server aus der Sitzung; die Bindung muss vom
 * Server gesiegelt sein und zur AKTUELLEN Lage passen (`pruefeZielVorWirkung`: Konto, Programm,
 * Sitzung, Dokument, Fassung, Markierung). Nur Word-Programme des Registers.
 */
function pruefeWordHost(siegel: BindungsSiegel, nutzer: string, roh: unknown): WordHostPruefung {
  const h = rumpf(roh);
  const aktuell = leseAdapterZiel(h.aktuell, KLARA_SINGLE_TENANT_ID, nutzer);
  const hostVersion = typeof h.hostVersion === "string" ? h.hostVersion.trim() : "";
  if (!aktuell || hostVersion === "" || hostVersion.length > HOST_VERSION_MAX) {
    const message = "host.aktuell (Ziel) und host.hostVersion sind Pflicht.";
    return { ok: false, status: 400, antwort: { grund: "eingabe", message } };
  }
  if (!istWordProgramm(aktuell.programm)) {
    const message = "Dieser Laufweg ist nur für Word.";
    return { ok: false, status: 409, antwort: { grund: "anderer_host", message } };
  }
  const gebunden = siegel.oeffnen(h.bindung);
  const ziel = gebunden ? pruefeZielVorWirkung(gebunden, aktuell) : abgelehnt("host-getrennt");
  if (!ziel.ok) {
    const { grund, text: message, naechsterSchritt } = ziel;
    return { ok: false, status: 409, antwort: { grund, message, naechsterSchritt } };
  }
  return { ok: true, aktuell, hostVersion };
}

function hostbindungSicht(r: Routine) {
  const hb = r.hostbindung ?? null;
  return hb
    ? {
        programm: hb.programm,
        hostVersion: hb.hostVersion,
        objekt: hb.objekt ?? null,
        zeitplanImHost: hb.zeitplanImHost === true,
        am: hb.am,
      }
    : null;
}

function rumpf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function eingabenAus(roh: unknown): Record<string, string> {
  const o = rumpf(roh);
  const eingaben: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") {
      eingaben[k] = v;
    }
  }
  return eingaben;
}

function routineSicht(r: Routine) {
  return {
    id: r.id,
    fassung: r.fassung,
    zustand: r.zustand ?? "aktiv",
    zeitplan: r.zeitplan ?? null,
    // AC05: die Eingaben fälliger Läufe — nur die Namen, nie die Werte (sie stehen in der Routine).
    zeitplanEingaben: Object.keys(r.zeitplanLauf?.eingaben ?? {}),
    hostbindung: hostbindungSicht(r),
    // EQF-06-K03/K10: Korrekturen mit Quelle und der Fassungsverlauf.
    korrekturen: r.ableitung?.korrekturen ?? [],
    versionen: r.versionen ?? [],
    // EQF-06-K06: selbstständig, Ergebnis zur Prüfung oder gemeinsam schrittweise.
    ausfuehrung: r.ausfuehrung ?? "selbststaendig",
  };
}

/** AC05: die Eingaben für Läufe aus der Zeitsteuerung — Text, begrenzt, keine Zugangsdaten. */
function zeitplanEingabenAus(roh: unknown): Record<string, string> | string {
  const eingaben = eingabenAus(roh);
  const eintraege = Object.entries(eingaben);
  if (eintraege.length > ZEITPLAN_EINGABEN_MAX) {
    return "Zu viele Eingaben für den Zeitplan.";
  }
  for (const [name, wert] of eintraege) {
    if (wert.length > ZEITPLAN_EINGABE_TEXT_MAX) {
      return `Die Eingabe „${name}“ ist zu lang.`;
    }
    if (siehtGeheimAus(wert)) {
      return `„${name}“ sieht nach Zugangsdaten aus. Die werden nicht gespeichert.`;
    }
  }
  return eingaben;
}

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof LaufAbgelehnt) {
    reply.code(fehler.status).send({
      grund: fehler.grund,
      message: fehler.message,
      ...(fehler.plan ? { plan: fehler.plan } : {}),
    });
    return;
  }
  if (fehler instanceof VormachenFehler) {
    // EQF-06-K03: eine Rückfrage trägt ihre Wahl (`klaerung`) mit.
    const { status, grund, message, details } = fehler;
    reply.code(status).send({ grund, message, ...details });
    return;
  }
  if (fehler instanceof KlaraGespraechFehler) {
    reply.code(fehler.status).send({ grund: fehler.grund, message: fehler.message });
    return;
  }
  sendError(reply, fehler);
}

export function assistenzLernenRoutes(
  deps: AssistenzLernenRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { vormachen, klara, audit } = deps;

  return async (app) => {
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/routinen/:id/lauf",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const body = rumpf(request.body);
          const gespraech = typeof body.gespraech === "string" ? body.gespraech : "";
          const lauf = typeof body.lauf === "string" ? body.lauf : "";
          const fassung = body.fassung;
          if (!gespraech || !LAUF.test(lauf) || typeof fassung !== "number") {
            const message = "gespraech, lauf (Kennung) und fassung (Zahl) sind Pflicht.";
            reply.code(400).send({ grund: "eingabe", message });
            return;
          }
          const eingaben = eingabenAus(body.eingaben);
          const routine = await vormachen.routine(user.id, request.params.id);
          // Pausiert: auch eine Wiederholung gibt keinen (noch nicht ausgeführten) Auftrag heraus.
          if (routine.zustand === "pausiert") {
            reply.code(409).send({ grund: "pausiert", message: "Die Routine ist pausiert." });
            return;
          }
          const ergebnis = await legeRoutinenLaufAn(
            { vormachen, klara },
            {
              kontoId: user.id,
              darfSchreiben: can(user.role, "ko.create"),
              routine,
              gespraech,
              lauf,
              fassung,
              eingaben,
            },
          );
          const plan = ergebnis.plan;
          const auftrag = await klara.auftrag(user.id, ergebnis.gespraech, ergebnis.auftragId);
          if (ergebnis.wiederholt) {
            reply.code(200).send({ auftrag: auftragMitVerlauf(auftrag), wiederholt: true });
            return;
          }
          await audit.record({
            actor: user.id,
            action: BPA06_LAUF_ANGELEGT,
            target: `klara-auftrag:${auftrag.id}`,
            payload: { routine: routine.id, fassung: routine.fassung, gespraech, lauf },
          });
          reply.code(201).send({ auftrag: auftragMitVerlauf(auftrag), plan, wiederholt: false });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/routinen/:id/zustand",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const zustand = rumpf(request.body).zustand;
          const r = await vormachen.setzeRoutinenZustand(user.id, request.params.id, zustand);
          await audit.record({
            actor: user.id,
            action: BPA06_ROUTINE_ZUSTAND,
            target: `routine:${r.id}`,
            payload: { zustand: r.zustand ?? "aktiv" },
          });
          reply.code(200).send({ routine: routineSicht(r) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/routinen/:id/zeitplan",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const body = rumpf(request.body);
          const roh = body.zeitplan;
          let zeitplan = roh === null || roh === undefined ? null : (roh as Zeitplan);
          // EQF-06-K05: „bei Ereignis“ braucht eine eindeutige Ereignisquelle — gewählt oder
          // aus den Worten der Person eindeutig erkannt. Sonst gezielte Rückfrage mit dem
          // Katalog (422).
          if (zeitplan && rumpf(zeitplan).art === "bei_ereignis") {
            const geklaert = ereignisGeklaert(rumpf(zeitplan));
            if (!geklaert) {
              reply.code(422).send({
                grund: "klaerung",
                message: "Bei welchem Ereignis soll die Routine laufen?",
                optionen: EREIGNIS_OPTIONEN,
              });
              return;
            }
            zeitplan = { art: "bei_ereignis", ereignis: geklaert };
          }
          const fehlerText = zeitplan ? pruefeZeitplanSicher(zeitplan) : undefined;
          if (fehlerText) {
            reply.code(400).send({ grund: "eingabe", message: fehlerText });
            return;
          }
          const eingaben = zeitplanEingabenAus(body.eingaben);
          if (typeof eingaben === "string") {
            reply.code(400).send({ grund: "eingabe", message: eingaben });
            return;
          }
          // AC05: fällige Läufe legen ihren Auftrag in einem eigenen Gespräch der Person an.
          let lauf: { gespraech: string; eingaben: Record<string, string> } | null = null;
          if (zeitplan) {
            const routine = await vormachen.routine(user.id, request.params.id);
            const g = await klara.beginne(user.id, {
              pfad: "/vormachen",
              seitenName: "Meine Funktionen",
              objekt: routine.titel,
            });
            lauf = { gespraech: g.id, eingaben };
          }
          const r = await vormachen.setzeZeitplan(user.id, request.params.id, zeitplan, lauf);
          await audit.record({
            actor: user.id,
            action: BPA06_ROUTINE_ZEITPLAN,
            target: `routine:${r.id}`,
            payload: { art: zeitplan?.art ?? null },
          });
          reply.code(200).send({ routine: routineSicht(r) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // EQF-06-K06: die Übergabeart der eigenen Routine — fremd und unbekannt 404.
    app.put<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/routinen/:id/ausfuehrung",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const roh = rumpf(request.body).ausfuehrung;
          const r = await vormachen.setzeAusfuehrung(user.id, request.params.id, roh);
          await audit.record({
            actor: user.id,
            action: BPA06_ROUTINE_AUSFUEHRUNG,
            target: `routine:${r.id}`,
            payload: { ausfuehrung: r.ausfuehrung ?? "selbststaendig" },
          });
          reply.code(200).send({ routine: routineSicht(r) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // ----------------------------------------------------------------------------------------------
    // Nacharbeit 41 (Ben zu 32e10b9d): Word-Routinen über den integrierten Programmadapter (BPA-04).
    // ----------------------------------------------------------------------------------------------

    /** Die eigenen Word-Routinen fürs Word-Fenster: Bindung, Zustand und ein anstehender Termin. */
    app.get("/api/me/vormachen/word-routinen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const { routinen } = await vormachen.uebersicht(user.id);
        const jetzt = Date.now();
        reply.header("cache-control", "no-store");
        reply.code(200).send({
          routinen: routinen
            .filter((r) => r.host === "word")
            .map((r) => {
              // Nacharbeit 43: der fällige Termin und wie er an dieses Word geht (automatisch nur
              // mit ausdrücklicher Freigabe beim Binden) — und welchen Umfang er aus Word liest.
              const u = deps.zeitsteuerung?.uebergabe(r, jetzt) ?? null;
              return {
                ...routineSicht(r),
                titel: r.titel,
                umfaenge: wordUmfaenge(r),
                anstehend: u?.kennung ?? null,
                uebergabe: u?.art ?? null,
              };
            }),
        });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    /**
     * Die Person bindet ihre Word-Routine ausdrücklich an DIESES Word: Programm und Hostfassung aus
     * der gesiegelten, aktuell gültigen Bindung. Spätere Läufe vergleichen dagegen (AC07).
     */
    app.put<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/routinen/:id/host",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        if (!deps.siegel) {
          reply.code(503).send({ grund: "nicht_verfuegbar", message: "Kein Programmadapter." });
          return;
        }
        try {
          const host = pruefeWordHost(deps.siegel, user.id, request.body);
          if (!host.ok) {
            reply.code(host.status).send(host.antwort);
            return;
          }
          const programm = host.aktuell.programm as "word-mac" | "word-web";
          // Nacharbeit 43: fällige Termine ohne Klick nur mit AUSDRÜCKLICHER Freigabe (true) und
          // nur in genau diesem Dokument.
          const zeitplanImHost = rumpf(request.body).zeitplanImHost === true;
          const r = await vormachen.setzeHostbindung(user.id, request.params.id, {
            programm,
            hostVersion: host.hostVersion,
            objekt: host.aktuell.objekt,
            zeitplanImHost,
          });
          await audit.record({
            actor: user.id,
            action: BPA06_ROUTINE_HOST,
            target: `routine:${r.id}`,
            payload: { programm, zeitplanImHost },
          });
          reply.code(200).send({ routine: routineSicht(r) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    /**
     * Ein Lauf einer Word-Routine mit der gebundenen Markierung — von Hand (eigene Laufkennung) oder
     * ein anstehender Zeitplantermin (seine Kennung; Gespräch und Eingaben aus dem Zeitplan).
     * Reihenfolge: Zielprüfung (Siegel, aktuelle Lage, nachgerechnete Prüfsumme) unmittelbar vor dem
     * Laufweg der Zeitsteuerung — `planeLauf` (Programm, Hostfassung, Rechte JETZT, Pause, Fassung,
     * Eingaben), gebundener Auftrag genau einmal je Kennung, Aktionskern mit Prüfung vor der Wirkung,
     * Nachlesen und Ergebnisprüfung.
     */
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/routinen/:id/word-lauf",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        const { siegel, zeitsteuerung } = deps;
        if (!siegel || !zeitsteuerung) {
          reply.code(503).send({ grund: "nicht_verfuegbar", message: "Kein Programmadapter." });
          return;
        }
        try {
          const body = rumpf(request.body);
          const lauf = typeof body.lauf === "string" ? body.lauf : "";
          const fassung = body.fassung;
          if (!LAUF.test(lauf) || typeof fassung !== "number") {
            const message = "lauf (Kennung) und fassung (Zahl) sind Pflicht.";
            reply.code(400).send({ grund: "eingabe", message });
            return;
          }
          const routine = await vormachen.routine(user.id, request.params.id);
          if (routine.zustand === "pausiert") {
            reply.code(409).send({ grund: "pausiert", message: "Die Routine ist pausiert." });
            return;
          }
          // Nacharbeit 43: der BESTÄTIGTE Umfang der Routine — Markierung und/oder ganzes Dokument,
          // je getrennt gelesen und gebunden. Fehlt ein Umfang, läuft nichts (kein stiller Ersatz).
          const umfaenge = wordUmfaenge(routine);
          const h = rumpf(body.host);
          const texte: Partial<Record<WordUmfang, string>> = {};
          for (const u of umfaenge) {
            const roh = h[u];
            // Die Länge eines Dokuments prüft unten die verständliche Grenze (409, vor der Wirkung).
            const zuLang =
              u === WORD_MARKIERUNG && typeof roh === "string" && roh.length > MARKIERUNG_MAX;
            if (typeof roh !== "string" || zuLang) {
              const was =
                u === WORD_DOKUMENT ? "host.dokument (ganzes Dokument)" : "host.markierung";
              const message = `${was} ist Pflicht und höchstens ${MARKIERUNG_MAX} Zeichen lang.`;
              reply.code(400).send({ grund: "eingabe", message });
              return;
            }
            texte[u] = roh.replace(/\r\n?/g, "\n").trim();
          }
          const host = pruefeWordHost(siegel, user.id, body.host);
          if (!host.ok) {
            reply.code(host.status).send(host.antwort);
            return;
          }
          // Jeder übergebene Text muss GENAU der gebundene sein (Prüfsumme nachgerechnet): die
          // Markierung gegen `auswahl`, das Dokument gegen `fassung` der Bindung.
          const markierung = texte[WORD_MARKIERUNG];
          const dokument = texte[WORD_DOKUMENT];
          const abweichung =
            markierung !== undefined && wordPruefsumme(markierung) !== host.aktuell.auswahl
              ? abgelehnt("auswahl-geaendert")
              : dokument !== undefined && wordPruefsumme(dokument) !== host.aktuell.fassung
                ? abgelehnt("fassung-geaendert")
                : null;
          if (abweichung && !abweichung.ok) {
            const { grund, text: message, naechsterSchritt } = abweichung;
            reply.code(409).send({ grund, message, naechsterSchritt });
            return;
          }
          // Ein Dokument, das ein Entwurf nicht ganz aufnehmen kann, hält VOR der Wirkung an —
          // gekürzt wird nicht. Nacharbeit 45: die Grenze ist die des Körpers (Volltext), nicht die
          // der Kernaussage.
          if (dokument !== undefined && dokument.length > KLARA_KOERPER_MAX) {
            const umfang = `Das Dokument hat ${dokument.length} Zeichen`;
            const grenze = `ein Entwurf aus einer Routine nimmt höchstens ${KLARA_KOERPER_MAX} auf`;
            const weg = "übernimm das Dokument von Hand über „Dokument als Entwurf übernehmen“";
            const message = `${umfang}; ${grenze}. Gekürzt wird nicht — ${weg}.`;
            reply.code(409).send({ grund: "dokument_nicht_unterstuetzt", message });
            return;
          }
          // Nacharbeit 43: ein fälliger Termin ohne Klick (vom Word-Fenster abgeholt) nur mit der
          // ausdrücklichen Freigabe beim Binden, im gebundenen Programm und Dokument.
          if (body.automatisch === true) {
            const hb = routine.hostbindung ?? null;
            if (!lauf.startsWith("zeitplan-") || !hb?.zeitplanImHost) {
              const message = "Für diese Routine sind Läufe ohne Klick in Word nicht freigegeben.";
              reply.code(409).send({ grund: "nicht_freigegeben", message });
              return;
            }
            const ziel = abgelehnt("anderes-dokument");
            const anderswo =
              hb.programm !== host.aktuell.programm || hb.objekt !== host.aktuell.objekt;
            if (anderswo && !ziel.ok) {
              const { grund, text: message, naechsterSchritt } = ziel;
              reply.code(409).send({ grund, message, naechsterSchritt });
              return;
            }
          }
          const vorhanden = (routine.laeufe ?? []).find((l) => l.kennung === lauf) ?? null;
          if (!vorhanden && fassung !== routine.fassung) {
            const message = `Die Routine steht jetzt auf Fassung ${routine.fassung}.`;
            reply.code(409).send({ grund: "fassung_geaendert", message });
            return;
          }
          // Ein Zeitplantermin nur, wenn er JETZT ansteht (oder schon angelegt ist); Gespräch und
          // Eingaben dann aus dem Zeitplan — die Person ergänzt nichts daran.
          const termin = lauf.startsWith("zeitplan-");
          const zl = routine.zeitplanLauf ?? null;
          const ansteht = zeitsteuerung.anstehend(routine, Date.now())?.kennung === lauf;
          if (termin && !vorhanden && !ansteht) {
            const message = "Dieser Termin steht nicht an.";
            reply.code(409).send({ grund: "termin_nicht_anstehend", message });
            return;
          }
          let gespraech = vorhanden?.gespraech ?? (termin ? zl?.gespraech : undefined);
          if (!gespraech && typeof body.gespraech === "string" && body.gespraech) {
            gespraech = body.gespraech;
          }
          if (!gespraech) {
            const g = await klara.beginne(user.id, {
              pfad: "/vormachen",
              seitenName: "Meine Funktionen in Word",
              objekt: routine.titel,
            });
            gespraech = g.id;
          }
          const eingaben = termin ? { ...(zl?.eingaben ?? {}) } : eingabenAus(body.eingaben);
          const e = await zeitsteuerung.fuehreHostlaufAus(routine, lauf, {
            gespraech,
            eingaben,
            host: {
              programm: host.aktuell.programm,
              hostVersion: host.hostVersion,
              auswahl: host.aktuell.auswahl,
              dokumentFassung: host.aktuell.fassung,
              ...(markierung !== undefined ? { markierung } : {}),
              ...(dokument !== undefined ? { dokument } : {}),
            },
          });
          const status = e.stand === "abgelehnt" ? (e.status ?? 409) : HOSTLAUF_STATUS[e.stand];
          // Der Bericht am vorhandenen Ort — derselbe Pfad wie im Aktionskern.
          const pfad = e.ergebnisId ? `/erfassen?draft=${encodeURIComponent(e.ergebnisId)}` : null;
          reply.code(status).send({ ergebnis: e, pfad });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    /**
     * EQF-06-K10 (Aufnahme 16.10.2026): „Beachte meine heutige Korrektur künftig.“ Die Korrektur
     * einer bestätigten Routine — in den Worten der Person (`{ nr, satz, bedeutung? }`, gedeutet nach
     * EQF-06-K03) oder strukturiert — wird die nächste Fassung mit Quelle im Fassungsverlauf. Die
     * erwartete Fassung ist Pflicht: wer eine ältere gesehen hat, korrigiert nichts Fremdes.
     */
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/me/vormachen/routinen/:id/korrektur",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const body = rumpf(request.body);
          const ergebnis = await vormachen.korrigiereRoutine(user.id, request.params.id, {
            fassung: body.fassung,
            ableitung: body.ableitung,
          });
          const { routine, aenderung } = ergebnis;
          // Ins Prüfprotokoll Ereignis, Fassung und Art — nie der Wortlaut der Person.
          await audit.record({
            actor: user.id,
            action: BPA06_ROUTINE_KORREKTUR,
            target: `routine:${routine.id}`,
            payload: {
              fassung: routine.fassung,
              art: aenderung.art,
              bedeutung: aenderung.quelle?.bedeutung ?? null,
            },
          });
          reply.code(200).send({
            routine: routineSicht(routine),
            // Die Schritte der neuen Fassung — ohne Inhalts- oder Empfängerwerte (P06-Regel).
            ableitung: routine.ableitung ?? null,
            korrektur: aenderung.quelle ?? null,
          });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}

const ZEITPLAN_ARTEN = ["sofort", "ab_datum", "woechentlich", "bei_ereignis"];

/** EQF-06-K05: die Wahl, die eine Rückfrage zum Ereignis anbietet — genau der Katalog. */
const EREIGNIS_OPTIONEN = (Object.keys(ROUTINEN_EREIGNISSE) as RoutinenEreignis[]).map((e) => ({
  ereignis: e,
  text: ROUTINEN_EREIGNISSE[e].text,
}));

/** Das gewählte Ereignis — oder das eindeutig aus `beschreibung` erkannte; sonst `null`. */
function ereignisGeklaert(o: Record<string, unknown>): RoutinenEreignis | null {
  if (istRoutinenEreignis(o.ereignis)) {
    return o.ereignis;
  }
  const text = typeof o.beschreibung === "string" ? o.beschreibung.slice(0, 300) : "";
  return text ? ereignisAusText(text) : null;
}

/** `pruefeZeitplan` erwartet die Gestalt; aus dem Netz kommt sie erst nach dieser Vorprüfung. */
function pruefeZeitplanSicher(z: Zeitplan): string | undefined {
  const o = rumpf(z);
  if (!ZEITPLAN_ARTEN.includes(String(o.art))) {
    return "zeitplan.art muss sofort, ab_datum, woechentlich oder bei_ereignis sein.";
  }
  if (o.art === "bei_ereignis") {
    return pruefeZeitplan(z);
  }
  if (o.art !== "sofort" && typeof o.zeitzone !== "string") {
    return "zeitplan.zeitzone ist Pflicht.";
  }
  if (o.art === "ab_datum" && typeof o.start !== "string") {
    return "zeitplan.start ist Pflicht.";
  }
  if (o.art === "woechentlich") {
    const tag = o.wochentag;
    if (typeof tag !== "number" || !Number.isInteger(tag) || tag < 1 || tag > 7) {
      return "zeitplan.wochentag muss 1 bis 7 sein.";
    }
    if (typeof o.uhrzeit !== "string") {
      return "zeitplan.uhrzeit ist Pflicht.";
    }
    if (o.nachholen !== "einmal_nachholen" && o.nachholen !== "auslassen") {
      return "zeitplan.nachholen muss einmal_nachholen oder auslassen sein.";
    }
  }
  return pruefeZeitplan(z);
}
