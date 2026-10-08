// ================================================================================================
// Aufnahme gesamt-telemetrie (R-0623) — DIE POSITIVLISTE DER BETRIEBSLOGFELDER.
// ================================================================================================
//
// „Wenn ueberhaupt Betriebsdaten gesammelt werden, dann nur Felder von einer ausdruecklichen
// Liste — Kundeninhalte gelangen nie in eine zentrale Auswertung. Was nicht auf der Liste steht,
// wird gar nicht erst erhoben."
//
// Die App-Logzeilen gehen an die Standardausgabe und von dort in die zentrale Logablage des
// Betreibers. Die Serializer in `baueLoggerOptionen` begrenzen `req`, `res` und `err` schon auf
// Erlaubnislisten; jedes ANDERE Feld eines Logaufrufs lief bis hierher ungeprüft durch — die Senke
// `senkeUeberWert` kopierte alle Einträge und entfernte nur Geheimnismuster (Ben, Nacharbeit 1).
//
// AB HIER GILT DIESE LISTE für das Feldobjekt jedes Logaufrufs (`hooks.logMethod` in
// `build-app.ts`): nur die hier genannten Felder kommen in die Zeile, jedes mit einer Regel für
// seinen Wert. Ein unbekanntes Feld, ein Wert, der seiner Regel nicht genügt, oder ein unbekanntes
// Unterfeld fällt weg — VOR der Ausgabe. Vergessen führt zu weniger im Log, nicht zu mehr.
//
// EIN NEUES LOGFELD KOMMT NUR ÜBER DIESE LISTE HINEIN, und wer es aufnimmt, begründet damit, dass
// es keinen Kundeninhalt trägt: Kennungen, Zahlen, Zustände, feste Sätze aus dem Quelltext.

/**
 * Wie der Wert eines gelisteten Feldes aussehen darf.
 *
 *   serializer  `req`, `res`, `err`: unverändert weiter an die Erlaubnislisten-Serializer.
 *   zahl        eine endliche Zahl.
 *   wert        Wahrheitswert, endliche Zahl oder eine Kennung (`KENNUNG`, ohne Leerzeichen).
 *   bezeichnung eine kurze Bezeichnung aus dem Quelltext (`BEZEICHNUNG`, Leerzeichen erlaubt).
 *   fehlertyp   ein Fehlerklassenname; Unbekanntes wird über `fehlertyp` (erlaubterTyp) ersetzt.
 *   satz        ein fester Satz aus dem Quelltext: eine Zeile, höchstens `SATZ_MAX` Zeichen.
 *   felder      ein Objekt mit eigener Positivliste.
 *   liste       eine Liste, jedes Element nach derselben Regel.
 *   zuordnung   ein Objekt mit Kennungen als Schlüssel, jeder Wert nach derselben Regel.
 */
export type Logregel =
  | "serializer"
  | "zahl"
  | "wert"
  | "bezeichnung"
  | "fehlertyp"
  | "satz"
  | { readonly felder: Readonly<Record<string, Logregel>> }
  | { readonly liste: Logregel }
  | { readonly zuordnung: Logregel };

/** Kennung: Buchstaben, Ziffern, wenige Trenner — kein Leerzeichen, kein Satzzeichen, kein `@`. */
const KENNUNG = /^[\p{L}\p{N}_.:\-()/]{1,160}$/u;
/** Bezeichnung: wie die Kennung, dazu Leerzeichen (`Lauf (…)`, `1 antwort`), höchstens 80. */
const BEZEICHNUNG = /^[\p{L}\p{N} _.:\-()/]{1,80}$/u;
const SATZ_MAX = 500;

/** Die Fehlerklassen, deren Meldung ein fester, hostfreier Satz aus dem Quelltext ist. */
const FESTTEXT_FEHLERKLASSEN: ReadonlySet<string> = new Set([
  "ConfluenceRequestError",
  "ConfluenceUnusableResponseError",
  "JiraRequestError",
  "SharePointRequestError",
]);

/**
 * Feste Sätze ohne eigenen Klassennamen, deren einziger Wert eine Zahl ist —
 * `ConfluenceStatusError` (services/confluence/src/rest-client.ts) setzt `name` nicht.
 */
const FESTTEXT_MUSTER: readonly RegExp[] = [/^Confluence-API antwortete mit \d{3}$/];

/**
 * Die inhaltsfreie Fehlerkennung für ein Logfeld — statt des freien Fehlertexts.
 *
 * Für die Klassen in `FESTTEXT_FEHLERKLASSEN` und die Sätze in `FESTTEXT_MUSTER` ist es der feste
 * Satz (er nennt die Lage, nie Host, Adresse oder Zugangsmerkmal); für jeden anderen Fehler nur der
 * Klassenname.
 */
export function inhaltsfreieFehlerkennung(err: unknown): string {
  if (!(err instanceof Error)) {
    return "unknown";
  }
  const fest =
    FESTTEXT_FEHLERKLASSEN.has(err.name) || FESTTEXT_MUSTER.some((m) => m.test(err.message));
  return fest ? err.message : err.name;
}

const KA4: Logregel = {
  felder: { nutzlast: "wert", entscheidung: "wert", grund: "wert" },
};

const STARTVERTRAG: Logregel = {
  felder: {
    betriebsart: "wert",
    datenhaltung: "satz",
    bestand: "satz",
    gesetzt: { liste: "wert" },
    nichtGesetzt: { liste: "wert" },
    zusatzfunktionen: { zuordnung: "wert" },
    maengel: { liste: { felder: { befund: "satz", betrifft: { liste: "wert" }, code: "wert" } } },
  },
};

/**
 * DIE LISTE. Jeder Eintrag nennt die Stelle, die das Feld schreibt.
 */
export const LOGFELDER: Readonly<Record<string, Logregel>> = {
  // Fastify/pino selbst (Anfrage-, Antwort- und Fehlerzeilen) und jeder `{ err }`-Aufruf.
  req: "serializer",
  res: "serializer",
  err: "serializer",
  responseTime: "zahl",
  // Ereignisname (csrf.ts, build-app.ts `ki_preisliste`, `ki_lauf`).
  event: "wert",
  // Kalibrierkennung, mit der eine Prüfung belegt, dass ihr Logmitschnitt die Zeilen wirklich hört
  // (tests/office-web-anmeldung/uebergabe-keine-auskunft.test.ts) — nur eine Kennung.
  probe: "wert",
  // Domänen-Fehlercode (http.ts, confluence-import-routes.ts).
  code: "wert",
  // Importwege: Stelle und inhaltsfreie Fehlerkennung (confluence-/jira-/sharepoint-import-routes).
  stelle: "bezeichnung",
  fehler: "satz",
  seiten: "zahl",
  // Gründe und Arten aus festen Mengen (csrf.ts, slides-routes.ts).
  grund: "wert",
  art: "wert",
  reason: "fehlertyp",
  // Kennungen (ko-routes.ts, ask-routes.ts, auth/routes.ts).
  koId: "wert",
  konto: "wert",
  restVorhanden: "wert",
  restFreigegeben: "wert",
  // support-routes.ts
  supportkontakt: "wert",
  // slides-routes.ts — nur Metriken.
  durationMs: "zahl",
  slides: "zahl",
  truncated: "wert",
  droppedOversize: "zahl",
  droppedByBudget: "zahl",
  inputBytes: "zahl",
  // capture-routes.ts — der Verkleinerungsbericht (Zähler und benannte Gründe).
  gesehen: "zahl",
  verkleinert: "zahl",
  quellbytes: "zahl",
  ableitungsbytes: "zahl",
  gleichzeitigMax: "zahl",
  uebersprungen: { liste: "wert" },
  ausfaelle: { liste: { felder: { bildNummer: "zahl", grund: "wert" } } },
  // ask-routes.ts — die KA4-Entscheidung.
  ka4: KA4,
  // build-app.ts — der Startbericht (Namen und feste Sätze, nie Werte).
  startvertrag: STARTVERTRAG,
  // model-runs `kiLaufLogzeile` — die Logzeile `ki_lauf` (Metadaten eines KI-Laufs).
  id: "wert",
  task: "wert",
  status: "wert",
  provider: "wert",
  model: "wert",
  fallback: "wert",
  demo: "wert",
  dauerMs: "zahl",
  eingabeToken: "zahl",
  ausgabeToken: "zahl",
  kosten: "zahl",
  waehrung: "wert",
  erzeugt: "bezeichnung",
  traceId: "wert",
  spanId: "wert",
  parentSpanId: "wert",
  requestId: "wert",
  versuche: "zahl",
};

const WEG = Symbol("weg");

function istZahl(wert: unknown): wert is number {
  return typeof wert === "number" && Number.isFinite(wert);
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return wert !== null && typeof wert === "object" && !Array.isArray(wert);
}

function nachRegel(wert: unknown, regel: Logregel, fehlertyp: (name: unknown) => string): unknown {
  if (regel === "serializer") {
    return wert;
  }
  if (regel === "zahl") {
    return istZahl(wert) ? wert : WEG;
  }
  if (regel === "wert") {
    if (typeof wert === "boolean" || istZahl(wert)) {
      return wert;
    }
    return typeof wert === "string" && KENNUNG.test(wert) ? wert : WEG;
  }
  if (regel === "bezeichnung") {
    return typeof wert === "string" && BEZEICHNUNG.test(wert) ? wert : WEG;
  }
  if (regel === "fehlertyp") {
    return fehlertyp(wert);
  }
  if (regel === "satz") {
    return typeof wert === "string" && wert.length <= SATZ_MAX && !/[\r\n]/.test(wert) ? wert : WEG;
  }
  if ("felder" in regel) {
    return istObjekt(wert) ? felderNachListe(wert, regel.felder, fehlertyp) : WEG;
  }
  if ("liste" in regel) {
    if (!Array.isArray(wert)) {
      return WEG;
    }
    return wert.map((e) => nachRegel(e, regel.liste, fehlertyp)).filter((e) => e !== WEG);
  }
  if (!istObjekt(wert)) {
    return WEG;
  }
  const ergebnis: Record<string, unknown> = {};
  for (const [schluessel, inhalt] of Object.entries(wert)) {
    if (!KENNUNG.test(schluessel)) {
      continue;
    }
    const gefiltert = nachRegel(inhalt, regel.zuordnung, fehlertyp);
    if (gefiltert !== WEG) {
      ergebnis[schluessel] = gefiltert;
    }
  }
  return ergebnis;
}

function felderNachListe(
  quelle: Record<string, unknown>,
  liste: Readonly<Record<string, Logregel>>,
  fehlertyp: (name: unknown) => string,
): Record<string, unknown> {
  const ergebnis: Record<string, unknown> = {};
  for (const [feld, inhalt] of Object.entries(quelle)) {
    if (!Object.hasOwn(liste, feld) || inhalt === undefined) {
      continue;
    }
    const gefiltert = nachRegel(inhalt, liste[feld] as Logregel, fehlertyp);
    if (gefiltert !== WEG) {
      ergebnis[feld] = gefiltert;
    }
  }
  return ergebnis;
}

/**
 * Das Feldobjekt eines Logaufrufs, reduziert auf die Positivliste — auf jeder Ebene.
 *
 * `fehlertyp` ist die Erlaubnisliste der Fehlerklassen (`erlaubterTyp` in `build-app.ts`); sie
 * wird übergeben statt importiert, weil `build-app.ts` dieses Modul einbindet.
 */
export function nurGelisteteLogfelder(
  feldobjekt: object,
  fehlertyp: (name: unknown) => string,
): Record<string, unknown> {
  return felderNachListe(feldobjekt as Record<string, unknown>, LOGFELDER, fehlertyp);
}

// ================================================================================================
// R-0623 (Ben, Nacharbeit 4) — AUCH DIE MELDUNGSTEXTE NUR AUS EINER AUSDRÜCKLICHEN LISTE.
// ================================================================================================
//
// Bis hierher wurde ein Meldungstext nur auf ein Fehlermuster geprüft — eine Sperrliste:
// `app.log.warn("Befund: Anna Meier")` kam unverändert durch. Jetzt steht eine Meldung nur dann in
// der Zeile, wenn sie GENAU einer der folgenden Vorlagen entspricht. Jede andere wird durch
// `MELDUNG_NICHT_GELISTET` ersetzt — vor der Ausgabe.
//
// EINE VORLAGE IST EIN FESTER SATZ AUS DEM QUELLTEXT. Wo der Satz einen Wert trägt, steht an der
// Stelle ein Platzhalter mit derselben Wertregel wie bei den Feldern: `{zahl}`, `{wert}` (Kennung
// ohne Leerzeichen), `{bezeichnung}` (kurz, Leerzeichen erlaubt) oder `{liste}` (Kennungen, durch
// „, " getrennt). Ein Wert, der seiner Regel nicht genügt, lässt die ganze Meldung durchfallen.
//
// EINE NEUE MELDUNG KOMMT NUR ÜBER DIESE LISTE HINEIN; jede Vorlage nennt die Stelle, die sie
// schreibt. Werte gehören bevorzugt in die gelisteten Felder, nicht in den Text.

/** Was anstelle einer Meldung steht, die keiner Vorlage entspricht. */
export const MELDUNG_NICHT_GELISTET = "[Meldung nicht gelistet]";

const PLATZHALTER: Readonly<Record<string, string>> = {
  zahl: String.raw`-?\d{1,15}(?:\.\d{1,6})?`,
  wert: String.raw`[\p{L}\p{N}_.:\-()/]{1,160}`,
  bezeichnung: String.raw`[\p{L}\p{N} _.:\-()/]{1,80}`,
  liste: String.raw`[\p{L}\p{N}_.:\-]{1,60}(?:, [\p{L}\p{N}_.:\-]{1,60}){0,49}`,
};

const RUECKNAHME_KONTO = "JOB 4011: Rücknahme eines halb angelegten Kontos gescheitert — ";

export const MELDUNGEN: readonly string[] = [
  // Fastify selbst (Anfrage-/Antwortzeilen, Start).
  "incoming request",
  "request completed",
  "Server listening at {wert}",
  // build-app.ts
  "ki_lauf",
  "KLARWERK Startbericht",
  "Bestandsabfrage gescheitert: {wert}",
  "KLARWERK_TRUST_PROXY ist eine Hop-Anzahl und wird nicht mehr beachtet (GHSA-3m5p-2c4r-xxw2) — die IP-Adresse(n) des Proxys eintragen.",
  // model-runs/src/preisliste.ts (über build-app.ts `ki_preisliste`)
  "KLARWERK_KI_PREISLISTE ist kein gültiges JSON.",
  "KLARWERK_KI_PREISLISTE braucht `waehrung` und `preisstand` (je kurzer Text).",
  "KLARWERK_KI_PREISLISTE braucht `modelle` als Objekt.",
  'KLARWERK_KI_PREISLISTE: Preis für „{wert}" unvollständig oder negativ.',
  // http.ts, csrf.ts, support-routes.ts, external-routes.ts, ko-routes.ts
  "Interner Betriebsfehler maskiert (HTTP 500 INTERNAL).",
  "Schreibender Sitzungsaufruf fremder Herkunft abgelehnt",
  "Supportkontakt gesetzt, aber nicht auslieferbar — die Hilfe zeigt ihn als ungültig an.",
  "external-search: Anfrage an den Anbieter fehlgeschlagen",
  "Konfliktvorschlag unvollständig",
  // auth/src/routes.ts (die vier Sätze aus `restSatz`)
  "Passwort-Reset-Mail konnte nicht gesendet werden",
  `${RUECKNAHME_KONTO}ob und in welchem Zustand ein Konto zurückbleibt, war nicht mehr messbar.`,
  `${RUECKNAHME_KONTO}im Bestand steht ein FREIGEGEBENES Konto, mit dem man sich anmelden kann.`,
  `${RUECKNAHME_KONTO}der Rest ist nicht freigegeben — mit ihm kommt niemand herein.`,
  `${RUECKNAHME_KONTO}im Bestand steht kein Konto aus diesem Aufruf.`,
  // reasoner-routes.ts, ask-routes.ts
  "reasoner.ki-freigabe konnte nicht protokolliert werden — Erweiterung abgelehnt",
  "reasoner.ki-freigabe (Rücknahme) konnte nicht protokolliert werden — sie gilt trotzdem",
  "reasoner.ka4.dokument-consent",
  "ask.ka4.dokument-consent",
  "ask.ka4.dokumenttext",
  "ask.evidence: Quell-KO nicht auflösbar",
  "ask.evidence: Konfliktabruf gescheitert — Einstufung bleibt unbelegt",
  // confluence-/jira-/sharepoint-import-routes.ts
  "confluence-import: {bezeichnung} fehlgeschlagen",
  "confluence-import: Anhangsabgleich unvollständig",
  "jira-import: {bezeichnung} fehlgeschlagen",
  "sharepoint-import: {bezeichnung} fehlgeschlagen",
  // slides-routes.ts, capture-routes.ts
  "slides-convert",
  "slides-convert-failed",
  "docx-convert-failed",
  "docx-bildverkleinerung-uebersprungen",
  // security-headers.ts (Mandantennamen aus der Betreiberkonfiguration)
  'KLARWERK_M365_MANDANTEN: Eintrag "{wert}" verworfen — {bezeichnung}. Er erscheint NICHT in frame-ancestors des Word-Taskpanes.',
  "KLARWERK_M365_MANDANTEN: Word im Browser darf Klara aus den SharePoint-Herkünften von {liste} einbetten.",
  // server.ts
  "KI-Zuordnung konnte NICHT geladen werden — fail-closed auf global={wert} (kein Cloud-Egress). Bitte DB prüfen und den Prozess NEU STARTEN, um die persistierte Wahl zu laden (keine automatische Wiederherstellung im laufenden Betrieb) — oder die Zuordnung in der Zwischenzeit unter KI-Verwaltung neu setzen.",
  "KI-Zuordnung per KLARWERK_REASONER_POLICY gesetzt (global={wert}, transient — überschreibt die persistierte Wahl für diesen Start).",
  "KI-Zuordnung aus der Persistenz geladen (global={wert}).",
  "Keine KI-Zuordnung konfiguriert — es gilt der Standard (global={wert}). Unter KI-Verwaltung setzbar; die Wahl wird dann persistiert.",
  "Ungültige KLARWERK_REASONER_POLICY='{wert}' — ignoriert.",
  "PID-Datei geschrieben: {wert} (pid {zahl})",
  "KLARWERK läuft auf :{zahl} — Datenhaltung: {bezeichnung}",
  "Papierkorb-Endlöschung eines KO fehlgeschlagen",
  "Papierkorb-Endlöschung beim Start: {zahl} abgelaufene KO(s) entfernt.",
  "Papierkorb-Endlöschung beim Start übersprungen",
  "Papierkorb-Endlöschung (periodisch): {zahl} abgelaufene KO(s) entfernt.",
  "Periodischer Papierkorb-Sweep übersprungen",
  "Papierkorb-Sweep aktiv — Intervall {zahl} min.",
  "Klara-Aufräumlauf aktiv — Intervall {zahl} min.",
  "Gedächtnis aufgeräumt ({wert}): {zahl} abgelaufene Einträge gelöscht.",
  "Gedächtnis-Aufräumlauf übersprungen",
  // klara-aufraeumen.ts
  "Klara-Sitzungen aufgeräumt ({wert}): {zahl} entfernt.",
  "Klara-Aufräumlauf ({wert}) übersprungen",
];

function vorlageAlsMuster(vorlage: string): RegExp {
  const teile = vorlage.split(/\{(zahl|wert|bezeichnung|liste)\}/);
  const quelle = teile
    .map((teil, i) =>
      i % 2 === 1 ? `(?:${PLATZHALTER[teil]})` : teil.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
  return new RegExp(`^${quelle}$`, "u");
}

const MELDUNGSMUSTER: readonly RegExp[] = MELDUNGEN.map(vorlageAlsMuster);

/**
 * Der Meldungstext einer Logzeile nach der Positivliste: unverändert, wenn er genau einer Vorlage
 * entspricht — sonst `MELDUNG_NICHT_GELISTET`. Mehrzeiliges entspricht nie einer Vorlage.
 */
export function gelisteteMeldung(meldung: string): string {
  return MELDUNGSMUSTER.some((muster) => muster.test(meldung)) ? meldung : MELDUNG_NICHT_GELISTET;
}
