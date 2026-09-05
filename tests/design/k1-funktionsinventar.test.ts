// ================================================================================================
// JOB 3056 · K1 — DAS FUNKTIONSINVENTAR: „heute → neuer Ort", jede Zeile in der gebauten Flaeche
// erreicht (Pedi 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere
// dich an Pages, arbeite mit Untermenüs.").
// ================================================================================================
//
// Jede Zeile nennt die Kennung/Funktion von HEUTE (main nach JOB 3018), ihren NEUEN Ort (Selektor)
// und den WEG dorthin (Ruhe · Antwort · „Mehr" · Zahnrad · Sprache · Hilfe · Erfassen). Der Test
// geht den Weg in Chromium an der ausgelieferten Datei (apps/web/dist/word-addin/taskpane.html)
// und verlangt: das Element ist da UND sichtbar.
//
// RUNDE 4 (Codex Pflicht 4): `lage` heisst nicht mehr „existiert, erscheint irgendwann", sondern
// die Zeile nennt ihre LAGE, und der Test STELLT sie — mit den echten Wegen des Panels und, wo
// der Test-Server die Lage nicht stellt, mit einer Route (Ask-Vertrag, Klara-Sitzung, Netz weg)
// oder der Word-Attrappe (Markierung, Dokument). Danach muss das Element SICHTBAR sein. Und JEDE
// Zeile traegt eine Mutation: das Element wird entfernt, die Pruefung muss dann rot sein, das
// Element kommt zurueck, die Pruefung ist wieder gruen — der Test misst also wirklich das Element.
//
// ZWEI FLAECHEN: „browser" (kein Office, echter Test-Server, drei validierte Objekte) und „word"
// (office.js-Attrappe mit Markierung und Dokument, gestellte Klara-Sitzung mit Zustimmungsbedarf).
// KEINE Zeile „entfaellt". Dieselbe Tabelle steht in der RUECKGABE des Auftrags.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ASK_URL,
  AUSSAGE,
  FRAGE,
  type Flaeche,
  ORIGIN,
  type RouteHandler,
  askAntwort,
  fn,
  frageStellen,
  leser,
  starteFlaeche,
} from "./k1-messung";

type Weg = "ruhe" | "antwort" | "mehr" | "zahnrad" | "sprache" | "hilfe" | "erfassen";
type Flaechenart = "browser" | "word";
type Zeile = {
  heute: string;
  neu: string;
  weg: Weg;
  sichtbar: true | "lage";
  funktion: string;
  flaeche?: Flaechenart;
  /** Pflicht bei `sichtbar: "lage"`: die Lage, die der Test stellt (s. LAGEN). */
  lage?: LageName;
};

// ---- Die Lagen ---------------------------------------------------------------------------------
type LageName =
  | "fassungswechsel"
  | "sitzungSteht"
  | "zustimmungVerlangt"
  | "ka4Nein"
  | "zugestimmt"
  | "sitzung401"
  | "anmeldungLaeuft"
  | "sitzungNetz"
  | "markierungUndText"
  | "frageLaeuft"
  | "frageFehler"
  | "dokumentOffen"
  | "feldFokus"
  | "kiKennzeichnung"
  | "mehrQuellen"
  | "langeAntwort"
  | "vorbehalt"
  | "ausschnitt"
  | "kopierRueckfall"
  | "luecke"
  | "offeneFrageGesendet"
  | "schreibanlass"
  | "zuruf";

const INVENTAR: readonly Zeile[] = [
  // ---- Kopf --------------------------------------------------------------------------------------
  {
    heute: ".brand „Klara KLARWERK“",
    neu: "#kw-titel",
    weg: "ruhe",
    sichtbar: true,
    funktion: "Titel „Klara“",
  },
  {
    heute: "#tab-ask / #tab-capture (Reiterleiste)",
    neu: "#kw-segment #tab-ask, #kw-segment #tab-capture",
    weg: "ruhe",
    sichtbar: true,
    funktion: "Umschalter Fragen | Erfassen im Kopf",
  },
  {
    heute: "— (neu)",
    neu: "#kw-zahnrad",
    weg: "ruhe",
    sichtbar: true,
    funktion: "Zahnrad → Einstellungen",
  },
  {
    heute: "#lang-de / #lang-en / #lang-nl (Sprachwahl im Kopf)",
    neu: "#einst-sprache-wahl #lang-de, #einst-sprache-wahl #lang-en, #einst-sprache-wahl #lang-nl",
    weg: "sprache",
    sichtbar: true,
    funktion: "Sprache DE/EN/NL",
  },
  {
    heute: "#kw-kopf-zeile / #kw-anmeldung „Angemeldet als …“",
    neu: "#einst-konto-name",
    weg: "zahnrad",
    sichtbar: true,
    funktion: "Name aus checkSession (Konto)",
  },
  {
    heute: "#kw-stand-kopf + #kw-stand (Auslieferungsstand, zweimal)",
    neu: "#kw-stand-zeile #kw-stand",
    weg: "zahnrad",
    sichtbar: true,
    funktion: "Stand „Klara <Stand>“ aus KLARA_STAND (einmal)",
  },
  {
    heute: "#kw-fassung / #kw-fassung-btn (Fassungswechsel)",
    neu: "#kw-fassung",
    weg: "zahnrad",
    sichtbar: true,
    funktion: "Fassungszeile; Knopf nur bei neuer Fassung",
  },
  {
    heute: "#kw-fassung-btn",
    neu: "#kw-fassung-btn",
    weg: "zahnrad",
    sichtbar: "lage",
    lage: "fassungswechsel",
    funktion: "„Neu laden“ nur bei Fassungswechsel (HEAD-Kopf X-KW-Available-Version weicht ab)",
  },
  // ---- Vertrauenskopf (BASIC-0) und Sitzung (BASIC-1) --------------------------------------------
  {
    heute: "#klara-trust-head / #klara-trust-mode / #klara-trust-detail (KI-Stand von KLARWERK)",
    neu: "#klara-trust-head #klara-trust-mode, #klara-trust-head #klara-trust-detail",
    weg: "hilfe",
    sichtbar: true,
    funktion: "Hausstand aus /api/reasoner/status (laedt/da/unerreichbar)",
  },
  {
    heute: "#klara-s4-label „In dieser Sitzung“",
    neu: "#klara-s4-label",
    weg: "zahnrad",
    sichtbar: true,
    funktion: "Etikett der Sitzungsgruppe",
  },
  {
    heute: "#klara-s4-mode (Modus-Pille)",
    neu: "#klara-s4-mode",
    weg: "zahnrad",
    sichtbar: true,
    funktion: "KI-Zeile: aufgeloester Modus oder „–“",
  },
  {
    heute: "#klara-s4-session (Zustimmung: …)",
    neu: "#klara-s4-session",
    weg: "zahnrad",
    sichtbar: true,
    funktion: "Zustimmungsstand / Sitzungszustand",
  },
  {
    heute: "#klara-s4-provider (Anbieter · Modell)",
    neu: "#klara-s4-provider",
    weg: "zahnrad",
    sichtbar: "lage",
    flaeche: "word",
    lage: "sitzungSteht",
    funktion: "Anbieter/Modell, nur wenn der Server sie nennt (Klara-Sitzung gestellt)",
  },
  {
    heute: "#klara-s4-deviation (Abweichung / Sperre)",
    neu: "#klara-s4-deviation",
    weg: "zahnrad",
    sichtbar: "lage",
    flaeche: "word",
    lage: "sitzungSteht",
    funktion: "Abweichung oder Sperre, nur wenn eingetreten (hier: Zustimmung fehlt → gesperrt)",
  },
  {
    heute: "#klara-consent-card (Zustimmungskarte) + #klara-consent-grant",
    neu: "#klara-consent-zeile #klara-consent-grant, #klara-consent-card",
    weg: "zahnrad",
    sichtbar: "lage",
    flaeche: "word",
    lage: "zustimmungVerlangt",
    funktion:
      "„Externe KI erlauben“ als Schalter (= Zustimmen), Auskunft darunter — nur wenn der Server sie verlangt",
  },
  {
    heute: "#ka4-frage (aktives Fragen fuer dieses Dokument)",
    neu: "#klara-consent-card #ka4-frage, #ka4-frage-ja, #ka4-frage-nein",
    weg: "zahnrad",
    sichtbar: "lage",
    flaeche: "word",
    lage: "zustimmungVerlangt",
    funktion: "KA4-Frage Ja/Nein, nur wenn der Server Zustimmung verlangt und sie erteilbar ist",
  },
  {
    heute: "#ka4-abgelehnt",
    neu: "#ka4-abgelehnt",
    weg: "zahnrad",
    sichtbar: "lage",
    flaeche: "word",
    lage: "ka4Nein",
    funktion: "Die gemerkte Ablehnung fuer dieses Dokument, nach „Nein“",
  },
  {
    heute: "#klara-consent-revoke",
    neu: "#klara-consent-zeile #klara-consent-revoke",
    weg: "zahnrad",
    sichtbar: "lage",
    flaeche: "word",
    lage: "zugestimmt",
    funktion: "Der Schalter steht auf „an“ (= Widerrufen), nachdem serverseitig zugestimmt wurde",
  },
  // ---- Sitzungskarte -----------------------------------------------------------------------------
  {
    heute: "#session-card / #session-status / #login-block / #login-btn",
    neu: "#session-block #session-status, #session-block #login-btn",
    weg: "ruhe",
    sichtbar: "lage",
    lage: "sitzung401",
    funktion: "EIN Satz + GENAU „Anmelden“ in der Mitte, nur ohne Anmeldung (401)",
  },
  {
    heute: "#login-cancel-btn / #login-context-hint",
    neu: "#session-block #login-cancel-btn, #login-context-hint",
    weg: "ruhe",
    sichtbar: "lage",
    lage: "anmeldungLaeuft",
    funktion: "„Warten abbrechen“ und der Fallback-Fenster-Hinweis, waehrend die Anmeldung laeuft",
  },
  {
    heute: "— (neu, §9)",
    neu: "#session-retry-btn",
    weg: "ruhe",
    sichtbar: "lage",
    lage: "sitzungNetz",
    funktion: "GENAU „Erneut versuchen“, wenn der Server nicht erreichbar ist",
  },
  {
    heute: "greetTitle / greetBody (Begruessung)",
    neu: "#kw-hilfe [data-t=greetTitle], #kw-hilfe [data-t=greetBody]",
    weg: "hilfe",
    sichtbar: true,
    funktion: "Begruessung unter „Wie Klara antwortet“",
  },
  {
    heute: "loginHint / loginReturn (Anmeldehinweise)",
    neu: "#kw-hilfe [data-t=loginHint], #kw-hilfe [data-t=loginReturn]",
    weg: "hilfe",
    sichtbar: true,
    funktion: "Anmeldehinweise unter „Wie Klara antwortet“",
  },
  // ---- Fragen ------------------------------------------------------------------------------------
  {
    heute: "#ask-karte / #ask-input / #ask-btn",
    neu: "#ask-feld #ask-karte, #ask-input, #ask-btn",
    weg: "ruhe",
    sichtbar: true,
    funktion: "Frage-Feld unten, runder Sendeknopf",
  },
  {
    heute: "#ask-source-note (Gefragt wird: Markierung / Eingabe)",
    neu: "#ask-source-note",
    weg: "ruhe",
    sichtbar: "lage",
    flaeche: "word",
    lage: "markierungUndText",
    funktion: "Nur der Verwerfungsfall (Markierung in Word UND getippter Text)",
  },
  {
    heute: "— (neu, ersetzt den Markierungs-Hinweis)",
    neu: "#einst-mitlesen",
    weg: "zahnrad",
    sichtbar: true,
    funktion: "Schalter: Markierung in Word als Frage lesen",
  },
  {
    heute: "#ask-ladekarte / #ask-ladekarte-satz (Wartezustand)",
    neu: "#ask-btn svg.kreisel",
    weg: "ruhe",
    sichtbar: "lage",
    lage: "frageLaeuft",
    funktion: "Laden = drehender Kreis im Sendeknopf, solange /api/ask laeuft",
  },
  {
    heute: "#ask-status (Warnungen / Erfolg)",
    neu: "#ask-status",
    weg: "ruhe",
    sichtbar: "lage",
    lage: "frageFehler",
    funktion: "Warnkasten fuer echte Warnungen (hier: „Keine Verbindung.“)",
  },
  {
    heute: "— (neu, §9)",
    neu: "#ask-retry-btn",
    weg: "ruhe",
    sichtbar: "lage",
    lage: "frageFehler",
    funktion: "„Erneut versuchen“ bei Frist/Verbindung",
  },
  {
    heute: "#ask-review-notice (Pruefhinweis)",
    neu: "#kw-hilfe [data-t=askReviewNotice]",
    weg: "hilfe",
    sichtbar: true,
    funktion: "Pruefhinweis unter „Wie Klara antwortet“",
  },
  {
    heute: "#kw-fuss / #ask-rule-note (Regelsatz + Schloss)",
    neu: "#kw-hilfe #ask-rule-note",
    weg: "hilfe",
    sichtbar: true,
    funktion: "Regel (mega75 C) unter „Wie Klara antwortet“",
  },
  {
    heute: "#klara-leitsatz „Keine KI-Antwort ohne Beleg …“",
    neu: "#kw-hilfe #ask-rule-note",
    weg: "hilfe",
    sichtbar: true,
    funktion: "Leitsatz ist der Anfang der Regel",
  },
  {
    heute: "#ka1-block (Begriffsbild)",
    neu: "#ask-ruhe #ka1-block, #ka1-terms li",
    weg: "ruhe",
    sichtbar: "lage",
    flaeche: "word",
    lage: "dokumentOffen",
    funktion: "Begriffe des Word-Dokuments, nur mit Begriffen (Dokument der Attrappe)",
  },
  {
    heute: "Hilfe-Karte helpTitle / helpCan1-3 / helpNot1-2",
    neu: "#kw-hilfe [data-t=helpTitle], #kw-hilfe [data-t=helpCan1], #kw-hilfe [data-t=helpCan3], #kw-hilfe [data-t=helpNot2]",
    weg: "hilfe",
    sichtbar: true,
    funktion: "„Was kann Klara hier?“",
  },
  // ---- Antwort -----------------------------------------------------------------------------------
  {
    heute: "#ask-frage-zeile-btn (Frage-Pille)",
    neu: "#ask-frage-zeile-btn",
    weg: "antwort",
    sichtbar: true,
    funktion: "Frage als Zeile; Klick = bearbeiten",
  },
  {
    heute: "#ask-neue-frage-btn „Neue Frage“",
    neu: "#kw-zurueck",
    weg: "antwort",
    sichtbar: true,
    funktion: "Zurueck-Chevron = neue Frage (und das Feld unten)",
  },
  {
    heute: "#antwortkarte / #ask-answer-edit",
    neu: "#antwortkarte #ask-answer-edit",
    weg: "antwort",
    sichtbar: true,
    funktion: "Antworttext, bearbeitbar",
  },
  {
    heute: "— (neu, Runde 4: Main.dc.html Z.28)",
    neu: "#ask-fussnoten sup.fussnote",
    weg: "antwort",
    sichtbar: true,
    funktion: "Fussnotenziffer am Textende, zugeordnet dem Chip derselben Quelle",
  },
  {
    heute: "#ask-answer-toggle („mehr anzeigen“)",
    neu: "#ask-answer-toggle",
    weg: "antwort",
    sichtbar: "lage",
    lage: "langeAntwort",
    funktion: "„mehr anzeigen“ nur bei langer Antwort (> 320 Zeichen)",
  },
  {
    heute: "#ask-answer-edit-hint",
    neu: "#ask-answer-edit-hint",
    weg: "antwort",
    sichtbar: "lage",
    lage: "feldFokus",
    funktion: "Bearbeitungshinweis beim Fokus im Antwortfeld",
  },
  {
    heute: "#ask-ai-notice (KI-Kennzeichnung)",
    neu: "#antwortkarte #ask-ai-notice",
    weg: "antwort",
    sichtbar: "lage",
    lage: "kiKennzeichnung",
    funktion: "Nur mit serverseitigem aiGenerated (G24-Marke)",
  },
  {
    heute: "#ask-sources / .quelle-chip (Titel-Link)",
    neu: "#ask-sources li.quelle-chip a",
    weg: "antwort",
    sichtbar: true,
    funktion: "Chip „n · Titel“ mit Deep-Link",
  },
  {
    heute: "#ask-quellen-mehr-btn („+n“)",
    neu: "#ask-quellen-mehr-btn",
    weg: "antwort",
    sichtbar: "lage",
    lage: "mehrQuellen",
    funktion: "„+n“-Chip bei mehr als zwei Quellen (askQuellenMehrChip)",
  },
  {
    heute: "— (neu)",
    neu: "#ask-mehr-btn",
    weg: "antwort",
    sichtbar: true,
    funktion: "„Mehr“ oeffnet die Auskunft zur Antwort",
  },
  {
    heute: "#antwortkarte-herkunft-zeile „Aus freigegebenem Firmenwissen“",
    neu: "#ask-mehr-block #antwortkarte-herkunft-zeile",
    weg: "mehr",
    sichtbar: true,
    funktion: "Herkunft unter „Mehr“",
  },
  {
    heute: "#ask-evidence-note (Einstufung)",
    neu: "#ask-mehr-block #ask-evidence-note",
    weg: "mehr",
    sichtbar: true,
    funktion: "Einstufung unter „Mehr“",
  },
  {
    heute: "#ask-caveat-line (Vorbehalt)",
    neu: "#ask-mehr-block #ask-caveat-line, #ask-vorbehalt",
    weg: "mehr",
    sichtbar: "lage",
    lage: "vorbehalt",
    funktion: "Vorbehalt: EIN Satz unter der Karte + Zaehlung unter „Mehr“ (checkCaveat)",
  },
  {
    heute: "#ask-conflict-line (Konfliktlage)",
    neu: "#ask-mehr-block #ask-conflict-line",
    weg: "mehr",
    sichtbar: true,
    funktion: "Konfliktlage unter „Mehr“; offener Konflikt auch als Satz unter der Karte",
  },
  {
    heute: "#ask-snippet-block (Ausschnitt / Zitat)",
    neu: "#ask-mehr-block #ask-snippet-block",
    weg: "mehr",
    sichtbar: "lage",
    lage: "ausschnitt",
    funktion: "Zitat, nur wenn es nicht die Antwort selbst ist (steps[0].snippet)",
  },
  {
    heute: ".quelle-chip-fassung (Status · Rolle · Vertrauen · Stand)",
    neu: "#ask-mehr-block #ask-quellen-detail li",
    weg: "mehr",
    sichtbar: true,
    funktion: "Je Quelle Status, Rolle, Vertrauen, Stand unter „Mehr“",
  },
  {
    heute: "#antwortkarte-aktionen / #ask-insert-btn / #ask-copy-btn",
    neu: "#antwortkarte-aktionen #ask-insert-btn, #antwortkarte-aktionen #ask-copy-btn",
    weg: "antwort",
    sichtbar: true,
    funktion: "„Einfuegen“ / „Kopieren“",
  },
  {
    heute: "#ask-copy-fallback (Zwischenablage-Rueckfall)",
    neu: "#ask-copy-fallback",
    weg: "antwort",
    sichtbar: "lage",
    lage: "kopierRueckfall",
    funktion: "Volltext, wenn die Zwischenablage fehlt",
  },
  {
    heute: "#antwortkarte-fuss-hinweis „Woertlich zitiert · fachlich pruefen“",
    neu: "#kw-hilfe [data-t=askReviewNotice]",
    weg: "hilfe",
    sichtbar: true,
    funktion: "Im Pruefhinweis enthalten (woertlich, fachlich pruefen)",
  },
  // ---- Luecke ------------------------------------------------------------------------------------
  {
    heute: "#ask-gap-block / #ask-luecke / #ask-luecke-frage-aendern / #ask-gap-send-btn",
    neu: "#ask-gap-block #ask-luecke, #ask-luecke-frage-aendern, #ask-gap-send-btn",
    weg: "ruhe",
    sichtbar: "lage",
    lage: "luecke",
    funktion: "Lueckenkarte ohne Hinweistext; „Frage aendern“, offene Frage (echte Luecke der App)",
  },
  {
    heute: "#ask-gap-open-block (Entwurf-Link)",
    neu: "#ask-gap-open-block",
    weg: "ruhe",
    sichtbar: "lage",
    lage: "offeneFrageGesendet",
    funktion: "Der Link zum Entwurf, nachdem die offene Frage gesendet wurde (POST /api/drafts)",
  },
  {
    heute: "#ask-luecke-fuss „Klara erfindet keine Antworten …“",
    neu: "#kw-hilfe [data-t=askGapFuss]",
    weg: "hilfe",
    sichtbar: true,
    funktion: "Haltung der Luecke unter „Wie Klara antwortet“",
  },
  // ---- Bestandsblick / Zuruf (nur mit Word) ------------------------------------------------------
  {
    heute: "#ka3-karten (Bestandsblick, nach #session-card)",
    neu: "#ka3-karten, #ka3-karten li a",
    weg: "ruhe",
    sichtbar: "lage",
    flaeche: "word",
    lage: "schreibanlass",
    funktion: "Karte unter der Ruhe-Mitte, nur mit Treffern — nach einem Schreibanlass von Word",
  },
  {
    heute: "#ka6-block (Zuruf, am Ende von #section-ask)",
    neu: "#ka6-block, #ka6-zurufe button",
    weg: "ruhe",
    sichtbar: "lage",
    flaeche: "word",
    lage: "zuruf",
    funktion: "Karte vor dem Frage-Feld, nur mit erlaubtem Zuruf und Kontext (Markierung/Text)",
  },
  // ---- Konto / Erfassen --------------------------------------------------------------------------
  {
    heute: "— (neu)",
    neu: "#logout-btn",
    weg: "zahnrad",
    sichtbar: true,
    funktion: "„Abmelden“ (POST /api/auth/logout)",
  },
  {
    // KONFLIKTRUNDE 6: JOB 3057 K2 hat #section-capture inzwischen nach dem Mockup „Erfassen"
    // umgebaut (die Radiogruppe #scope-selection/#scope-document und #send-review-note sind
    // ersetzt, nicht daneben belassen — s. tests/design/k2-funktionsinventar.test.ts) — die Zeile
    // nennt die tatsaechlich sichtbaren Orte statt der abgeloesten Ids.
    heute: "#section-capture (Erfassen, JOB 3057 K2)",
    neu: "#section-capture #capture-karte, #capture-titel, #send-btn, #capture-mehr-btn",
    weg: "erfassen",
    sichtbar: true,
    funktion: "Erfassen-Flaeche ueber den Umschalter",
  },
];

// ---- Die beiden Flaechen -----------------------------------------------------------------------
const DOKUMENT =
  "Ventil Wartung Druck entlasten. Das Ventil wird vor jeder Wartung entlastet und der Druck geprueft.";
const ZWEITER_TITEL = "HD Handbook";
const DRITTER_TITEL = "Randnotiz";
const LANGE_ANTWORT =
  "Vor jeder Wartung ist das Ventil vollstaendig zu entlasten und der Restdruck zu pruefen. "
    .repeat(6)
    .trim();

/** Der gestellte Sitzungsstand der Word-Flaeche — von den Lagen fortgeschrieben. */
const sitzung = { zugestimmt: false };
function aufloesung(): Record<string, unknown> {
  return {
    resolutionId: "res-1",
    mode: "external",
    provider: "srv-anbieter",
    model: "srv-modell",
    adminConfiguredMode: "external",
    effectiveMode: "external",
    deviation: false,
    deviationReason: null,
    externalConsentRequired: true,
    externalConsentGranted: sitzung.zugestimmt,
    executionAllowed: sitzung.zugestimmt,
    blockedReason: sitzung.zugestimmt ? null : "external_consent_missing",
    resolvedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    policyVersion: "p1",
    configurationVersion: "c1",
    effectivePayloadClasses: ["query_text"],
    blockedPayloadClasses: [],
  };
}
function sicht(): Record<string, unknown> {
  return {
    sessionId: "sess-1",
    tenantId: "t1",
    actorId: "a1",
    addinInstanceId: "inst-1",
    documentContextId: "doc-t-1",
    createdAt: new Date(Date.now() - 5000).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    policyVersion: "p1",
    configurationVersion: "c1",
    consentState: sitzung.zugestimmt ? "granted" : "none",
    closed: false,
    resolution: aufloesung(),
  };
}

const flaechen: Record<Flaechenart, Flaeche | null> = { browser: null, word: null };
let fehler: string | null = null;

function f(art: Flaechenart): Flaeche {
  const fl = flaechen[art];
  expect(fl, `Flaeche ${art} steht nicht`).not.toBeNull();
  return fl as Flaeche;
}
function lesen(art: Flaechenart) {
  return leser(
    () => flaechen[art]?.seite ?? null,
    () => fehler,
  );
}
const SICHTBAR_FN =
  "(sel) => { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; }";
async function warteSichtbar(
  art: Flaechenart,
  sel: string,
  soll = true,
  timeout = 20_000,
): Promise<void> {
  await f(art).seite.waitForFunction(
    fn(`([sel, soll]) => (${SICHTBAR_FN})(sel) === soll`),
    [sel, soll],
    { timeout },
  );
}
async function tippen(art: Flaechenart, text: string): Promise<void> {
  await f(art).seite.focus("#ask-input");
  await f(art).seite.type("#ask-input", text);
}
/**
 * Zahnrad → Zeile „Sprache". Die Zeile KLAPPT UM (aria-expanded) und behaelt ihren Stand, wenn man
 * die Einstellungen verlaesst: geoeffnet wird nur, wenn sie zu ist — sonst schloesse der Klick sie.
 * (Runde 5: der blinde zweite Klick liess `#lang-en` verborgen, die Browser-Flaeche blieb in der
 * 401-Lage stehen, und 27 Zeilen danach scheiterten am gesperrten Sendeknopf.)
 */
async function spracheOeffnen(art: Flaechenart): Promise<void> {
  const s = f(art).seite;
  await s.click("#kw-zahnrad");
  const offen = await lesen(art).eval<string | null>(
    "() => document.getElementById('einst-sprache-zeile').getAttribute('aria-expanded')",
  );
  if (offen !== "true") await s.click("#einst-sprache-zeile");
  await warteSichtbar(art, "#lang-de");
}
/** Ueber den Sprachwechsel (Einstellungen → Sprache) laeuft checkSession erneut — der echte Weg. */
async function anmeldungNeuPruefen(art: Flaechenart, code: "de" | "en"): Promise<void> {
  const s = f(art).seite;
  await spracheOeffnen(art);
  await s.click(`#lang-${code}`);
  await s.click("#kw-zurueck");
}
function antwortMit(over: Record<string, unknown>): RouteHandler {
  const b = f("browser");
  return askAntwort({
    answered: true,
    answer: AUSSAGE,
    sources: [b.koId],
    citedSources: [b.koId],
    trust: 80,
    steps: [],
    demo: false,
    evidence: { grade: "verified" },
    ...over,
  });
}

/** Immer von der Ruhe aus: Einstellungen/Hilfe/Erfassen verlassen, Antwort/Luecke verwerfen. */
async function zurRuhe(art: Flaechenart): Promise<void> {
  const s = f(art).seite;
  const l = lesen(art);
  const ansicht = await l.eval<string>(
    "() => document.getElementById('kw-einstellungen').className.indexOf('hidden') === -1 ? 'einstellungen' : document.getElementById('kw-hilfe').className.indexOf('hidden') === -1 ? 'hilfe' : document.getElementById('section-capture').className.indexOf('hidden') === -1 ? 'erfassen' : 'fragen'",
  );
  if (ansicht === "hilfe") await s.click("#kw-zurueck");
  if (ansicht !== "fragen") await s.click(ansicht === "erfassen" ? "#tab-ask" : "#kw-zurueck");
  if (await l.sichtbar("#ask-answer-block")) await s.click("#kw-zurueck");
  if (await l.sichtbar("#ask-gap-block")) await s.click("#ask-luecke-frage-aendern");
  await s.fill("#ask-input", "");
}

async function weg(art: Flaechenart, w: Weg): Promise<void> {
  const s = f(art).seite;
  await zurRuhe(art);
  if (w === "ruhe") return;
  if (w === "erfassen") {
    await s.click("#tab-capture");
    return;
  }
  if (w === "antwort" || w === "mehr") {
    await frageStellen(s);
    if (w === "mehr") await s.click("#ask-mehr-btn");
    return;
  }
  if (w === "sprache") {
    await spracheOeffnen(art);
    return;
  }
  await s.click("#kw-zahnrad");
  if (w === "hilfe") await s.click("#einst-hilfe-zeile");
}

// ---- Die Lagen: stellen (von der Ruhe aus, bis das Element da sein MUSS) und abraeumen ----------
interface Lage {
  flaeche: Flaechenart;
  stellen(): Promise<void>;
  abraeumen(): Promise<void>;
}

let askTor: (() => void) | null = null;
let askHandler: RouteHandler | null = null;
async function askRoute(art: Flaechenart, handler: RouteHandler): Promise<void> {
  askHandler = handler;
  await f(art).seite.route(ASK_URL, handler);
}
async function askRouteWeg(art: Flaechenart): Promise<void> {
  if (askHandler) await f(art).seite.unroute(ASK_URL, askHandler);
  askHandler = null;
}
const AUTH_URL = `${ORIGIN}/api/auth/me`;
let authHandler: RouteHandler | null = null;
async function authRoute(status: number | "netz"): Promise<void> {
  authHandler = async (route) => {
    if (status === "netz") {
      await route.abort();
      return;
    }
    await route.fulfill({ status, body: "{}", contentType: "application/json" });
  };
  await f("browser").seite.route(AUTH_URL, authHandler);
}
async function authRouteWeg(): Promise<void> {
  if (authHandler) await f("browser").seite.unroute(AUTH_URL, authHandler);
  authHandler = null;
}
const FASSUNG_URL = `${ORIGIN}/word-addin/taskpane.html`;
const fassungHandler: RouteHandler = async (route) => {
  if (route.request().method() !== "HEAD") {
    await route.fallback();
    return;
  }
  await route.fulfill({ status: 200, headers: { "X-KW-Available-Version": "eine-neuere" } });
};

/** Antwort mit gestelltem Vertrag: Route setzen, Frage stellen, ggf. „Mehr" oeffnen. */
function antwortLage(over: Record<string, unknown>, mehr = false): Lage {
  return {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      await askRoute("browser", antwortMit(over));
      await frageStellen(f("browser").seite);
      if (mehr) await f("browser").seite.click("#ask-mehr-btn");
    },
    async abraeumen() {
      await askRouteWeg("browser");
      await zurRuhe("browser");
    },
  };
}

const LAGEN: Record<LageName, Lage> = {
  fassungswechsel: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      const s = f("browser").seite;
      await s.route(FASSUNG_URL, fassungHandler);
      // Der Abgleich des Panels selbst (HEAD auf die eigene Adresse, JOB 1077) — mit dem Kopf des
      // Servers, der jetzt eine andere Fassung nennt.
      await s.evaluate(fn("() => kwFassungAbgleichen()"));
      await s.click("#kw-zahnrad");
    },
    async abraeumen() {
      const s = f("browser").seite;
      await s.unroute(FASSUNG_URL, fassungHandler);
      await s.evaluate(fn("() => kwFassungAbgleichen()"));
      await warteSichtbar("browser", "#kw-fassung-btn", false);
      await zurRuhe("browser");
    },
  },
  sitzungSteht: {
    flaeche: "word",
    async stellen() {
      await zurRuhe("word");
      await f("word").seite.click("#kw-zahnrad");
    },
    async abraeumen() {
      await zurRuhe("word");
    },
  },
  zustimmungVerlangt: {
    flaeche: "word",
    async stellen() {
      await zurRuhe("word");
      await f("word").seite.click("#kw-zahnrad");
    },
    async abraeumen() {
      await zurRuhe("word");
    },
  },
  ka4Nein: {
    flaeche: "word",
    async stellen() {
      await zurRuhe("word");
      await f("word").seite.click("#kw-zahnrad");
      await f("word").seite.click("#ka4-frage-nein");
    },
    async abraeumen() {
      await zurRuhe("word");
    },
  },
  zugestimmt: {
    flaeche: "word",
    async stellen() {
      await zurRuhe("word");
      const s = f("word").seite;
      await s.click("#kw-zahnrad");
      // Der Schalter IST der Zustimmen-Knopf: POST …/consent, der Server antwortet „granted".
      sitzung.zugestimmt = true;
      await s.click("#klara-consent-grant");
      await warteSichtbar("word", "#klara-consent-revoke");
    },
    async abraeumen() {
      await zurRuhe("word");
    },
  },
  sitzung401: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      await authRoute(401);
      await anmeldungNeuPruefen("browser", "en");
      await warteSichtbar("browser", "#session-block");
    },
    async abraeumen() {
      await authRouteWeg();
      await anmeldungNeuPruefen("browser", "de");
      await warteSichtbar("browser", "#session-block", false);
    },
  },
  anmeldungLaeuft: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      await authRoute(401);
      await anmeldungNeuPruefen("browser", "en");
      await warteSichtbar("browser", "#login-btn");
      // „Anmelden" oeffnet das Fallback-Fenster (kein Office-Dialog) und beginnt den Poll-Lauf.
      await f("browser").seite.click("#login-btn");
      await warteSichtbar("browser", "#login-cancel-btn");
    },
    async abraeumen() {
      await f("browser").seite.click("#login-cancel-btn");
      await authRouteWeg();
      await anmeldungNeuPruefen("browser", "de");
      await warteSichtbar("browser", "#session-block", false);
    },
  },
  sitzungNetz: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      await authRoute("netz");
      await anmeldungNeuPruefen("browser", "en");
      await warteSichtbar("browser", "#session-retry-btn");
    },
    async abraeumen() {
      await authRouteWeg();
      // „Erneut versuchen" IST der Rueckweg: der Server antwortet wieder, die Ruhe kehrt zurueck.
      await f("browser").seite.click("#session-retry-btn");
      await warteSichtbar("browser", "#session-block", false);
      await anmeldungNeuPruefen("browser", "de");
    },
  },
  markierungUndText: {
    flaeche: "word",
    async stellen() {
      await zurRuhe("word");
      await tippen("word", "Und was gilt fuer Hohlprofile?");
      await warteSichtbar("word", "#ask-source-note");
    },
    async abraeumen() {
      await zurRuhe("word");
    },
  },
  frageLaeuft: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      const tor = new Promise<void>((r) => {
        askTor = r;
      });
      await askRoute("browser", async (route) => {
        await tor;
        await antwortMit({})(route);
      });
      await f("browser").seite.fill("#ask-input", FRAGE);
      await f("browser").seite.click("#ask-btn");
      await warteSichtbar("browser", "#ask-btn svg.kreisel");
    },
    async abraeumen() {
      askTor?.();
      askTor = null;
      await warteSichtbar("browser", "#ask-answer-block");
      await askRouteWeg("browser");
      await zurRuhe("browser");
    },
  },
  frageFehler: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      await askRoute("browser", async (route) => {
        await route.abort();
      });
      await f("browser").seite.fill("#ask-input", FRAGE);
      await f("browser").seite.click("#ask-btn");
      await warteSichtbar("browser", "#ask-retry-btn");
    },
    async abraeumen() {
      await askRouteWeg("browser");
      // „Erneut versuchen" IST der Rueckweg: dieselbe Frage, echter Server, echte Antwort.
      await f("browser").seite.click("#ask-retry-btn");
      await warteSichtbar("browser", "#ask-answer-block");
      await zurRuhe("browser");
    },
  },
  dokumentOffen: {
    flaeche: "word",
    async stellen() {
      await zurRuhe("word");
      await warteSichtbar("word", "#ka1-block");
    },
    async abraeumen() {
      /* das Dokument bleibt offen */
    },
  },
  feldFokus: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      await frageStellen(f("browser").seite);
      await f("browser").seite.focus("#ask-answer-edit");
    },
    async abraeumen() {
      await zurRuhe("browser");
    },
  },
  kiKennzeichnung: antwortLage({
    aiGenerated: { aiGenerated: true, task: "answer", mode: "model" },
  }),
  mehrQuellen: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      const b = f("browser");
      await askRoute("browser", antwortMit({ sources: [b.koId, ...b.weitereIds] }));
      await frageStellen(b.seite);
    },
    async abraeumen() {
      await askRouteWeg("browser");
      await zurRuhe("browser");
    },
  },
  langeAntwort: antwortLage({ answer: LANGE_ANTWORT }),
  vorbehalt: antwortLage(
    {
      evidence: {
        grade: "unverified",
        checkCaveat: { reason: "unchecked", unproven: 1, total: 1 },
      },
    },
    true,
  ),
  ausschnitt: antwortLage(
    {
      steps: [
        {
          description: "Quelle",
          sourceId: "x",
          snippet: "Ein anderer Ausschnitt als die Antwort.",
        },
      ],
    },
    true,
  ),
  kopierRueckfall: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      const s = f("browser").seite;
      await frageStellen(s);
      // Die Umgebung ohne Zwischenablage-Schnittstelle (kein sicherer Kontext, alter Host).
      await s.evaluate(
        fn(
          "() => Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true })",
        ),
      );
      await s.click("#ask-copy-btn");
      await warteSichtbar("browser", "#ask-copy-fallback");
    },
    async abraeumen() {
      await zurRuhe("browser");
    },
  },
  luecke: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      const s = f("browser").seite;
      await s.fill("#ask-input", "Xylophon Zebra Quasar");
      await s.click("#ask-btn");
      await warteSichtbar("browser", "#ask-gap-block");
    },
    async abraeumen() {
      await zurRuhe("browser");
    },
  },
  offeneFrageGesendet: {
    flaeche: "browser",
    async stellen() {
      await zurRuhe("browser");
      const s = f("browser").seite;
      await s.fill("#ask-input", "Xylophon Zebra Quasar zwei");
      await s.click("#ask-btn");
      await warteSichtbar("browser", "#ask-gap-block");
      // Die offene Frage reist als ECHTER Entwurf (POST /api/drafts der App).
      await s.click("#ask-gap-send-btn");
      await warteSichtbar("browser", "#ask-gap-open-block");
    },
    async abraeumen() {
      await zurRuhe("browser");
    },
  },
  schreibanlass: {
    flaeche: "word",
    async stellen() {
      await zurRuhe("word");
      // Der Fokus bindet KA3 an Word (ka3EreignisBinden); ein Markierungswechsel von Word ist der
      // Schreibanlass — die Attrappe haelt die angemeldeten Rueckrufe (window.__kwHandler).
      // Die Karte kommt NICHT sofort: KA3 wartet die Tastenruhe ab (ka3Planen, KA3_TASTENRUHE_MS,
      // heute 30 s — gelesen aus der gebauten Seite, nicht angenommen) und fragt erst dann ueber
      // KA2 → POST /api/ask den echten Bestand. Gewartet wird Tastenruhe plus Abruf.
      const ruheMs = await lesen("word").eval<number>("() => KA3_TASTENRUHE_MS");
      expect(ruheMs, "KA3_TASTENRUHE_MS in der gebauten Seite").toBeGreaterThan(0);
      await f("word").seite.evaluate(
        fn(
          "() => { window.dispatchEvent(new Event('focus')); (window.__kwHandler || []).forEach((h) => h()); }",
        ),
      );
      await warteSichtbar("word", "#ka3-karten", true, ruheMs + 15_000);
    },
    async abraeumen() {
      /* die Karte bleibt — sie gehoert zum Dokument */
    },
  },
  zuruf: {
    flaeche: "word",
    async stellen() {
      await zurRuhe("word");
      await tippen("word", "Bitte formulieren");
      await warteSichtbar("word", "#ka6-block");
    },
    async abraeumen() {
      await zurRuhe("word");
    },
  },
};

// ---- Der Lauf ----------------------------------------------------------------------------------
describe("JOB 3056 · K1 · Funktionsinventar — jede heutige Kennung/Funktion hat einen erreichbaren, SICHTBAREN Ort", () => {
  beforeAll(async () => {
    try {
      flaechen.browser = await starteFlaeche({
        mitWissen: true,
        weitereObjekte: [
          { titel: ZWEITER_TITEL, aussage: "Geschlossene Profile sind zu begruenden." },
          { titel: DRITTER_TITEL, aussage: "Spritzzonen sind gesondert zu betrachten." },
        ],
      });
      flaechen.word = await starteFlaeche({
        mitWissen: true,
        word: { markierung: FRAGE, dokument: DOKUMENT },
        klara: { sicht, aufloesung },
        // Mit gestellter Sitzung sperrt der Zustimmungsbedarf das Fragen — „steht" heisst hier:
        // die Sitzung ist aufgeloest (KI-Zeile traegt einen Wert) und die Anmeldung belegt.
        bereitWenn:
          "() => document.getElementById('klara-s4-mode').textContent !== '–' && document.getElementById('einst-konto-name').textContent !== '–'",
      });
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await flaechen.browser?.schliessen();
    await flaechen.word?.schliessen();
  }, 60_000);

  it("S · beide Flaechen stehen, die Tabelle ist nicht leer, KEINE Zeile heisst „entfaellt“, jede Lage ist benannt und stellbar", () => {
    expect(fehler).toBeNull();
    expect(INVENTAR.length).toBeGreaterThan(40);
    for (const z of INVENTAR) {
      expect(z.neu.trim().length, z.heute).toBeGreaterThan(0);
      expect(z.funktion).not.toMatch(/entf(ae|ä)llt/i);
      if (z.sichtbar === "lage") {
        expect(z.lage, `${z.heute}: Lage ohne Namen`).toBeDefined();
        expect(LAGEN[z.lage as LageName], `${z.heute}: Lage ${z.lage} unbekannt`).toBeDefined();
        expect(LAGEN[z.lage as LageName].flaeche).toBe(z.flaeche ?? "browser");
      }
    }
    expect(INVENTAR.filter((z) => z.sichtbar === "lage").length).toBeGreaterThanOrEqual(24);
  });

  for (const z of INVENTAR) {
    const art: Flaechenart = z.flaeche ?? "browser";
    it(`${art} · ${z.weg}${z.lage ? ` · Lage ${z.lage}` : ""} · ${z.heute} → ${z.neu}`, async () => {
      expect(fehler).toBeNull();
      const lage = z.lage ? LAGEN[z.lage] : null;
      if (lage) await lage.stellen();
      else await weg(art, z.weg);
      const l = lesen(art);
      try {
        for (const selektor of z.neu.split(",").map((t) => t.trim())) {
          expect(
            await l.eval<number>("(sel) => document.querySelectorAll(sel).length", selektor),
            `${selektor} fehlt in der gebauten Flaeche`,
          ).toBeGreaterThan(0);
          expect(
            await l.sichtbar(selektor),
            `${selektor} ist auf dem Weg „${z.weg}“${z.lage ? ` in der Lage ${z.lage}` : ""} nicht sichtbar`,
          ).toBe(true);
          // MUTATION: ohne das Element (alle Treffer des Selektors) ist die Pruefung rot;
          // zurueckgesetzt ist sie wieder gruen.
          const mutation = await l.eval<{ ohne: boolean | null; mit: boolean | null }>(
            `(sel) => { const alle = [...document.querySelectorAll(sel)].map((el) => ({ el, eltern: el.parentNode, next: el.nextSibling })); for (const a of alle) a.el.remove(); const ohne = (${SICHTBAR_FN})(sel); for (const a of alle.reverse()) a.eltern.insertBefore(a.el, a.next); const mit = (${SICHTBAR_FN})(sel); return { ohne, mit }; }`,
            selektor,
          );
          expect(mutation.ohne, `${selektor}: die Pruefung sieht das Entfernen nicht`).toBe(false);
          expect(mutation.mit, `${selektor}: nach dem Zuruecksetzen nicht wieder sichtbar`).toBe(
            true,
          );
        }
        expect(f(art).seitenfehler).toEqual([]);
      } finally {
        if (lage) await lage.abraeumen();
      }
      // 90 s: die Lage „schreibanlass" traegt allein die Tastenruhe von KA3 (30 s) plus Abruf.
    }, 90_000);
  }
});
