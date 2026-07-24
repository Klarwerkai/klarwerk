// WP-KLARA-1 (Klara in Word, erster Schritt): DOM-freie Hilfslogik des Word-Add-ins. Das Taskpane
// (apps/web/public/word-addin/taskpane.html) ist bewusst eine selbstenthaltende statische Seite ohne
// Build-Schritt — es trägt eine INLINE-KOPIE dieser zwei Funktionen zwischen den Markern
// KW-WORDADDIN-HELPERS-START/END; ein Äquivalenztest (tests/app/word-addin.test.ts) führt beide
// Fassungen auf denselben Fixtures aus und pinnt identisches Verhalten (kleinste ehrliche Lösung —
// kein Build-Generator für eine einzelne statische Seite).

// Titel des Front-Door-Entwurfs aus der Word-Selektion: erste nicht-leere Zeile, auf 60 Zeichen
// gekappt. Ganz ohne brauchbare Zeile → ehrlicher Standardtitel (kein leerer Draft-Titel).
export const WORD_ADDIN_FALLBACK_TITLE = "Wissens-Entwurf aus Word";
export const WORD_ADDIN_TITLE_MAX = 60;

export function deriveDraftTitleFromSelection(text: string): string {
  const firstLine =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  const title = firstLine.slice(0, WORD_ADDIN_TITLE_MAX).trim();
  return title.length > 0 ? title : WORD_ADDIN_FALLBACK_TITLE;
}

// WP-KLARA-1c (Pedis Live-Befund, Word Mac 16.111): Anmelde-RÜCKWEG. Das Panel navigiert NICHT mehr
// zur App (dort blieb es nach dem Login auf der vollen Webseite hängen), sondern öffnet die Anmeldung
// in einem EIGENEN Fenster und POLLT /api/auth/me. Diese pure Funktion entscheidet je Poll-Tick:
// fertig (Session da → angemeldeten Zustand zeigen, OHNE Navigation), Frist abgelaufen (ehrlicher
// Timeout-Hinweis) oder weiter warten.
export const WORD_ADDIN_LOGIN_POLL_INTERVAL_MS = 3000;
export const WORD_ADDIN_LOGIN_POLL_MAX_MS = 300000; // 5 Minuten (harte Frist ab Start)
// WP-IC-PAKET-1c (bens ROT-1b): eigene Frist JE FETCH (AbortController) — ein hängender Request
// blockiert die sequenzielle Schleife höchstens diese Spanne, nie die ganze 5-Minuten-Frist.
export const WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS = 5000;

export type LoginPollDecision = "done" | "timeout" | "poll";

export function loginPollDecision(elapsedMs: number, signedIn: boolean): LoginPollDecision {
  if (signedIn) {
    return "done";
  }
  if (elapsedMs >= WORD_ADDIN_LOGIN_POLL_MAX_MS) {
    return "timeout";
  }
  return "poll";
}

// WP-IC-PAKET-1c (bens ROT-1d): Schritt-Entscheidung NACH Abschluss eines Poll-Versuchs, inklusive
// GENERATION-Guard. Jeder Lauf trägt eine Generation-ID; Abbrechen/Neustart erhöht die aktuelle
// Generation — ein Versuch einer ALTEN Generation endet IMMER still ("stale"), egal was der Fetch
// ergab (kein später Zustands-Überschreiber). Sonst: fertig / harte Frist / nächsten Versuch planen
// (die Planung erfolgt erst NACH Abschluss — genau EIN Poll gleichzeitig, kein Interval).
export type LoginPollStep = "stale" | "done" | "timeout" | "schedule";

export function loginPollStep(
  generation: number,
  currentGeneration: number,
  elapsedMs: number,
  signedIn: boolean,
): LoginPollStep {
  if (generation !== currentGeneration) {
    return "stale";
  }
  const decision = loginPollDecision(elapsedMs, signedIn);
  return decision === "poll" ? "schedule" : decision;
}

// Selektion → sicheres Body-HTML: je nicht-leere Zeile ein <p>, Text vollständig escaped (keine
// Roh-HTML-Übernahme aus Word). Leere Selektion → leerer String (der Aufrufer meldet ehrlich).
export function selectionToBodyHtml(text: string): string {
  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

// ---- WP-KLARA-2 (Pedis Befund 2: Formatierung erhalten) ----
// Word liefert über getSelectedDataAsync(Html)/body.getHtml() ein KOMPLETTES, wildes HTML-Dokument
// (head/style/mso-Attribute). Der Client schneidet nur den body-Inhalt heraus und schickt ihn als
// bodyHtml an den BESTEHENDEN Draft-Weg — die autoritative Säuberung (Allowlist, h1→h2-Mapping,
// Tabellen-Subset, data:image-Bilder) macht der Server-Sanitizer (services/structure) an der
// Persistenz-Grenze (SCRUM-524 WP5). Hier passiert bewusst KEINE eigene Sanitisierung.

// Spiegel von MAX_INLINE_BODY_HTML_BYTES (lib/docx.ts) — das Taskpane ist buildlos und kann das
// Modul nicht importieren; ein Test pinnt die Gleichheit. Über dem Budget: ehrlicher
// Klartext-Fallback statt stillem Verlust (der Server-Bodylimit läge ohnehin bei 5 MiB).
// WP-SHIP8-FINAL (bens Bedingung 4): das Budget misst jetzt den FINALEN JSON.stringify-Payload
// des Draft-POSTs (Envelope inkl. Escaping) — s. prepareWordDraftRequest.
export const WORD_ADDIN_BODY_BUDGET_BYTES = 3_500_000;

// body-Inhalt aus dem Word-HTML-Dokument schneiden; ohne body-Tags bleibt der Roh-String (Word
// im Web liefert teils nur Fragmente). Leer/Whitespace → leerer String.
export function extractWordBodyHtml(html: string): string {
  const match = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return (match?.[1] ?? html).trim();
}

// EHRLICHE Bild-Bilanz: Word liefert Bilder je nach Version als data:URL — oder eben nicht
// (leere/externe/cid:-Quellen). Gezählt wird, was der Server-Sanitizer NICHT als sicheres
// Rasterbild übernehmen kann (dieselbe data:image-Klasse wie isSafeImgSrc) — diese Bilder gehen
// verloren und werden dem Nutzer gemeldet. KEIN Fake, keine Platzhalterbilder.
export function countUndeliveredWordImages(html: string): number {
  const imgRe = /<img\b[^>]*>/gi;
  let missing = 0;
  let match = imgRe.exec(html);
  while (match !== null) {
    const srcMatch = /src\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(match[0]);
    const src = (srcMatch?.[1] ?? srcMatch?.[2] ?? "").trim();
    if (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src)) {
      missing += 1;
    }
    match = imgRe.exec(html);
  }
  return missing;
}

// UTF-8-Bytelänge (Budget-Messgröße — identisch zur Server-/DOCX-Mechanik).
export function wordHtmlUtf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

// ---- WP-KLARA-ASK (Pedis Entscheid 22.07., bens Option B: das Klara-Funktionsversprechen) ----
// Aussage in Word markieren → Klara fragen → quellengebundene Antwort aus dem VALIDIERTEN
// Werkswissen. Der Kanal ist der BESTEHENDE Konsolen-Vertrag POST /api/ask (Session-Pfad,
// Permission ko.read — kein neuer Guard, keine neue Route, kein Add-in-eigener Modellaufruf).

// Frage-Deckel: Word-Auswahlen können riesig sein; der Server erlaubt 8.000 Codepoints, das
// Panel kappt bewusst frueher (ehrliche Meldung statt stillem Server-400).
export const WORD_ADDIN_ASK_MAX_CHARS = 2000;
// Frist je Ask-Request (eigener AbortController — haengt der Server, endet das Panel ehrlich).
export const WORD_ADDIN_ASK_TIMEOUT_MS = 15000;

export type AskQuestionSource = "selection" | "manual" | "empty";

export interface PreparedAskQuestion {
  question: string;
  from: AskQuestionSource;
  truncated: boolean;
}

// EINE Entscheidungsstelle für die Frage: Word-Auswahl hat Vorrang; leere Auswahl → Eingabefeld
// (freies Fragen); beides leer → ehrlich "empty". Über dem Deckel wird gekappt + gemeldet.
export function prepareAskQuestion(selectionText: string, manualText: string): PreparedAskQuestion {
  const selection = (selectionText || "").trim();
  const manual = (manualText || "").trim();
  const from: AskQuestionSource =
    selection.length > 0 ? "selection" : manual.length > 0 ? "manual" : "empty";
  const raw = from === "selection" ? selection : from === "manual" ? manual : "";
  if (raw.length === 0) {
    return { question: "", from: "empty", truncated: false };
  }
  if (raw.length > WORD_ADDIN_ASK_MAX_CHARS) {
    return { question: raw.slice(0, WORD_ADDIN_ASK_MAX_CHARS).trim(), from, truncated: true };
  }
  return { question: raw, from, truncated: false };
}

// Server-Vertrag kennt de/en (FR-I18N-01); die NL-Oberflaeche fragt auf Deutsch nach.
export function askLocale(lang: string): "de" | "en" {
  return lang === "en" ? "en" : "de";
}

export type AskOutcomeKind = "answered" | "gap" | "auth" | "error" | "timeout";

export interface AskOutcome {
  kind: AskOutcomeKind;
  answer?: string;
  sources?: string[]; // KO-Ids aus AnswerResult.sources — Titel/Trust laedt das Panel je KO nach
  trust?: number;
  detail?: string;
}

// Der eine Ask-Lauf gegen POST /api/ask (Fetch injizierbar → testbar mit Fake-fetch, DOM-frei).
// Ergebnis-Vertrag: answered NUR bei echter quellengebundener Antwort; alles andere ist ehrlich
// gap/auth/timeout/error — NIE eine erfundene Antwort, NIE Erfolg vortaeuschen.
export interface AskFetchInit {
  method: string;
  credentials: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

export interface AskFetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type AskFetchFn = (url: string, init: AskFetchInit) => Promise<AskFetchResponseLike>;

// WP-UX-WOW-1 U1 (Word): das Taskpane zeigt und fuegt KLARTEXT ein — Markdown-Zeichen der Antwort
// werden mit derselben Subset-Logik wie in der Konsole ENTFERNT statt gerendert (Ueberschriften-,
// Fett-/Kursiv-Marker weg; Listenpunkte als "- "-Zeilen normalisiert). Nur Zeichen-Strip, nie HTML.
export function stripAskAnswerMarkdown(answer: string): string {
  const out: string[] = [];
  for (const raw of answer.replace(/\r\n?/g, "\n").split("\n")) {
    let line = raw.trim();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading?.[1] !== undefined) {
      line = heading[1].trim();
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet?.[1] !== undefined) {
      line = `- ${bullet[1]}`;
    }
    out.push(line.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*\n]+)\*/g, "$1"));
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function performAsk(
  question: string,
  locale: "de" | "en",
  fetchFn: AskFetchFn,
  timeoutMs: number,
): Promise<AskOutcome> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      controller.abort();
    } catch {
      // bereits beendet — egal
    }
  }, timeoutMs);
  return fetchFn("/api/ask", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    // WP-KLARA-ASK-FIX (bens Fix 1, P0): das Add-in sendet IMMER den server-garantierten
    // retrieval-only-Modus — markierter Dokumenttext darf NIE zur Cloud (nur validierte KOs,
    // deterministisches Retrieval, keine Synthese). Es gibt clientseitig keine andere Wahl.
    body: JSON.stringify({ question, locale, mode: "retrieval-only" }),
    signal: controller.signal,
  })
    .then((res): Promise<AskOutcome> | AskOutcome => {
      if (res.status === 401 || res.status === 403) {
        return { kind: "auth" };
      }
      if (!res.ok) {
        return { kind: "error", detail: `HTTP ${res.status}` };
      }
      return res.json().then((body): AskOutcome => {
        const result = (body as { result?: Record<string, unknown> } | null)?.result ?? null;
        const answer = result?.answer;
        // WP-KLARA-ASK-FIX (bens Fix 2, Quellen-Pflicht): eine Antwort OHNE mindestens eine
        // gueltige Source-Id ist KEINE belegte Antwort — sie zaehlt ehrlich als Wissensluecke
        // (nie eine quellenlose Aussage einfuegbar machen).
        const sources = Array.isArray(result?.sources)
          ? (result.sources as unknown[]).filter(
              (id): id is string => typeof id === "string" && id.trim().length > 0,
            )
          : [];
        if (
          result &&
          result.answered === true &&
          typeof answer === "string" &&
          answer.trim().length > 0 &&
          sources.length > 0
        ) {
          return {
            kind: "answered",
            // WP-UX-WOW-1 U1: Klartext im Panel UND im eingefuegten Text — Markdown-Zeichen raus.
            answer: stripAskAnswerMarkdown(answer),
            sources,
            trust: typeof result.trust === "number" ? result.trust : 0,
          };
        }
        return { kind: "gap" };
      });
    })
    .catch((err): AskOutcome => {
      if (timedOut) {
        return { kind: "timeout" };
      }
      return {
        kind: "error",
        detail: err instanceof Error && err.message ? err.message : "offline",
      };
    })
    .then((outcome) => {
      clearTimeout(timer);
      return outcome;
    });
}

// Einfuege-Gating (Teil 2): NUR eine echte quellengebundene Antwort darf ins Dokument — nie die
// Wissensluecke, nie ein Fehlerzustand. WP-KLARA-ASK-FIX (bens Fix 2): zusaetzlich PFLICHT auf
// mindestens EINE gueltige Source-Id — ohne Quelle gibt es nichts Belegtes einzufuegen.
export function canInsertAnswer(outcome: AskOutcome | null | undefined): boolean {
  return Boolean(
    outcome &&
      outcome.kind === "answered" &&
      typeof outcome.answer === "string" &&
      outcome.answer.trim().length > 0 &&
      Array.isArray(outcome.sources) &&
      outcome.sources.some((id) => typeof id === "string" && id.trim().length > 0),
  );
}

// Quellen-Zeile des eingefuegten Texts: Template traegt die Sprache ({titles}/{date}); ohne
// aufgeloeste Titel ehrlich der Systemname (nie leer, nie erfunden).
export function buildAskSourceLine(
  titles: readonly string[],
  dateLabel: string,
  template: string,
): string {
  const names = titles.map((title) => (title || "").trim()).filter((title) => title.length > 0);
  const joined = names.length > 0 ? names.join(", ") : "KLARWERK";
  return template.replace("{titles}", joined).replace("{date}", dateLabel);
}

// Eingefuegter Text = validiertes Wissen + Quellen-Zeile (beginnt bewusst NICHT mit einem
// KI-Etikett — es IST das geprüfte Wissen, die Quellenangabe traegt die Herkunft).
// WP-KLARA-ASK-FIX (bens Fix 3): wurde die Frage gekappt (2000-Zeichen-Deckel), traegt der
// eingefuegte Text einen EHRLICHEN Kappungs-Hinweis mit (die Antwort galt der gekappten Frage).
export function buildAnswerInsertText(
  answer: string,
  sourceLine: string,
  truncatedNote?: string,
): string {
  const base = `${answer.replace(/\s+$/g, "")}\n\n${sourceLine}`;
  return truncatedNote && truncatedNote.trim().length > 0 ? `${base}\n${truncatedNote}` : base;
}

// Stand-Datum der Quellen-Zeile (dd.mm.yyyy — Dokument-Artefakt, bewusst EIN Format).
export function formatAskDateLabel(date: Date): string {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${pad(day)}.${pad(month)}.${date.getFullYear()}`;
}

// WP-KLARA-ASK-FIX (bens Fix 3, ehrliche Quellen-Zeile): das NEUESTE belegte Datum aus den
// aufgeloesten Quell-KOs (Validierungs-/Aenderungsdatum aus history, sonst createdAt) — nur ein
// parsebares Datum zaehlt. null = kein Beleg → der Aufrufer schreibt ehrlich
// "abgerufen am <heute>" statt eines erfundenen Standes.
export function newestSourceDateLabel(dates: readonly (string | undefined)[]): string | null {
  let best: number | null = null;
  for (const raw of dates) {
    const parsed = raw ? Date.parse(raw) : Number.NaN;
    if (Number.isFinite(parsed) && (best === null || parsed > best)) {
      best = parsed;
    }
  }
  return best === null ? null : formatAskDateLabel(new Date(best));
}

// Wissensluecken-Weg (Teil 2): die offene Frage reist als Front-Door-ENTWURF (bestehender
// Draft-Weg) nach KLARWERK — Titel-Konvention mit demselben 60-Zeichen-Deckel wie der Sender.
// WP-KLARA-ASK-FIX (bens Fix 4): Praefix/Fallback kommen LOKALISIERT vom Aufrufer (DE/EN/NL) —
// kein fest verdrahteter deutscher Titel mehr.
export function openQuestionDraftTitle(
  question: string,
  prefix: string,
  fallbackTitle: string,
): string {
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return fallbackTitle;
  }
  return `${prefix}${trimmed}`.slice(0, WORD_ADDIN_TITLE_MAX).trim();
}

// RT-KLARA1 (Pedis Live-Befund 23.07.): „Einfuegen fehlgeschlagen (You don't have sufficient
// permissions for this action.)" — der rohe Office-Fehlertext nennt die Ursache (Manifest ohne
// Schreibberechtigung) nicht verständlich. Diese pure Klassifikation erkennt den Berechtigungsfall
// (Message-/Code-Muster der Office-Hosts, EN/DE/NL) und erlaubt eine ehrliche, lokalisierte
// Erklärung samt Ausweg (Manifest mit ReadWriteDocument neu sideloaden). Alles andere bleibt
// ehrlich „other" mit dem konkreten Detail — nie ein geratener Grund.
export type InsertFailureKind = "permission" | "other";

export function classifyInsertError(detail: string): InsertFailureKind {
  return /permission|berechtigung|toestemming|machtiging|access\s*denied|accessdenied/i.test(
    detail || "",
  )
    ? "permission"
    : "other";
}

// AUFTRAG-klara1b (Pedis Live-Befund 24.07., Teil A): Einfuegen ROBUST. Der moderne Word-JS-Weg
// (Word.run + getSelection().insertText) ist der PRIMAERE Versuch, setSelectedDataAsync bleibt der
// Fallback fuer aeltere Hosts — beide brauchen ReadWriteDocument. Diese Orchestrierung ist
// DOM-/Office-frei: die konkreten Office-Aufrufe reicht der Aufrufer als injizierte Versuche (run
// rejectet mit einem Error, dessen message den Office-Fehlertext traegt). Getestet mit Fake-
// Versuchen. Schlaegt ein Versuch mit Berechtigungsfehler fehl, wird der Ausgang ehrlich als
// "permission" gemeldet (Manifest-/Cache-Ursache, Ausweg Re-Sideload + Kopieren) — nie ein
// geratener Grund. Reihenfolge = Versuchsreihenfolge; der erste Erfolg gewinnt.
export type InsertMethod = "word-run" | "set-selected-data";

export interface InsertAttempt {
  method: InsertMethod;
  run: (text: string) => Promise<void>;
}

export interface InsertOutcome {
  ok: boolean;
  method?: InsertMethod;
  failure?: InsertFailureKind; // nur bei ok=false
  detail?: string;
}

export async function performInsert(
  text: string,
  attempts: readonly InsertAttempt[],
): Promise<InsertOutcome> {
  let lastDetail = "";
  let sawPermission = false;
  for (const attempt of attempts) {
    try {
      await attempt.run(text);
      return { ok: true, method: attempt.method };
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : String(err ?? "");
      lastDetail = detail || lastDetail;
      if (classifyInsertError(detail) === "permission") {
        sawPermission = true;
      }
    }
  }
  return { ok: false, failure: sawPermission ? "permission" : "other", detail: lastDetail };
}

// Teil B (Ausweg „Kopieren"): der Feldinhalt reist in die Zwischenablage — der EINE verlaessliche
// Weg, wenn der Office-Insert an Rechten scheitert (Cache/Manifest). Clipboard injiziert (testbar);
// fehlt die API oder wirft sie (kein sicherer Kontext, Nutzer-Geste noetig), ehrlich ok=false — der
// Aufrufer nennt dann den manuellen Ausweg (Text markieren + kopieren).
export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

export async function performCopy(
  text: string,
  clipboard: ClipboardLike | null | undefined,
): Promise<{ ok: boolean; detail?: string }> {
  if (!clipboard || typeof clipboard.writeText !== "function") {
    return { ok: false, detail: "no-clipboard" };
  }
  try {
    await clipboard.writeText(text);
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error && err.message ? err.message : "clipboard" };
  }
}

// Teil B (kompakte Antwort): ist die Antwort lang, zeigt das Panel sie NICHT sofort in voller Hoehe —
// ein „mehr anzeigen"-Schalter klappt das editierbare Feld auf. Reine Schwellwert-Entscheidung
// (Zeichen ODER Zeilen ueber dem Deckel) — der Aufrufer blendet den Schalter nur dann ein.
export const WORD_ADDIN_ANSWER_COMPACT_CHARS = 320;
export const WORD_ADDIN_ANSWER_COMPACT_LINES = 6;

export function answerIsLong(text: string): boolean {
  const trimmed = (text || "").trim();
  if (trimmed.length > WORD_ADDIN_ANSWER_COMPACT_CHARS) {
    return true;
  }
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.length > WORD_ADDIN_ANSWER_COMPACT_LINES;
}

// K2/K3 (AUFTRAG-klara1 Paket 2): Anzeige-Status einer Antwort-Quelle — derselbe Kern wie die
// Bibliotheks-Ableitung deriveStatus (lib/displayStatus.ts, ohne Konflikt-/Revalidierungs-Flags):
// validiert → validiert; offen MIT Zuweisungen → pruefung (in Validierung); offen → offen; KO
// nicht ladbar oder fremder Status → ehrlich "unknown" — nie raten. Ein Test pinnt die Gleichheit
// zu deriveStatus auf den auflösbaren Fällen.
export type AskSourceDisplayStatus = "validiert" | "pruefung" | "offen" | "unknown";

export function askSourceStatus(
  ko: { status?: unknown; assignments?: unknown } | null | undefined,
): AskSourceDisplayStatus {
  if (!ko || typeof ko.status !== "string") {
    return "unknown";
  }
  if (ko.status === "validiert") {
    return "validiert";
  }
  if (ko.status === "offen") {
    return Array.isArray(ko.assignments) && ko.assignments.length > 0 ? "pruefung" : "offen";
  }
  return "unknown";
}

// K2: Deep-Link einer Antwort-Quelle auf die bestehende KO-Detailroute /wissen/:id (das Add-in
// öffnet ihn extern/im neuen Tab — dieselbe Route wie die Bibliothek, kein neuer Pfad).
export function koDetailUrl(origin: string, koId: string): string {
  return `${origin}/wissen/${encodeURIComponent(koId)}`;
}

// WP-SHIP8-FINAL (bens Bedingung 4, EIN Auswahl-Snapshot): der Klartext wird aus dem EINEN
// HTML-Zugriff ABGELEITET statt über einen zweiten Office-Aufruf gelesen (die Auswahl kann sich
// zwischen zwei Aufrufen ändern → inkonsistenter Titel/Statement zum Body). DOM-freier Tag-Strip
// im bestehenden Helfer-Muster: Block-Enden → Zeilenumbruch, Tags weg, Basis-Entities dekodieren
// (&amp; bewusst ZULETZT — sonst würde ein escaptes &amp;lt; doppelt dekodiert).
export function wordHtmlToPlainText(html: string): string {
  const stripped = extractWordBodyHtml(html || "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|figcaption|caption|blockquote|pre)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const decoded = stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&");
  return decoded
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

// WP-SHIP8-FINAL (bens Bedingung 4, Payload-Messung FINAL): der EXAKTE Draft-POST-Body — das
// Budget misst DIESEN String (Envelope inkl. JSON-Escaping), nicht mehr die rohen HTML-Bytes.
export function draftPostPayload(title: string, statement: string, bodyHtml: string): string {
  return JSON.stringify({ title, statement, bodyHtml, origin: "frontdoor" });
}

export interface WordDraftRequest {
  // Finaler, bereits serialisierter POST-Body (genau der gemessene String wird gesendet).
  payload: string;
  title: string;
  usedHtml: boolean; // false = Klartext-Fallback (kein/leeres HTML oder Budget überschritten)
  overBudget: boolean; // true = FINALER Payload lag über dem Budget → Klartext-Fallback, ehrlich gemeldet
  undeliveredImages: number; // Bilder, die Word nicht als übernehmbare Daten geliefert hat
}

// EINE Entscheidungsstelle für den Draft-Request: Word-HTML wenn vorhanden UND der finale
// JSON-Payload im Budget liegt, sonst der Klartext-Fallback (Zeilen-Absätze) — nie stiller
// Verlust, die Zähler tragen die ehrliche Meldung. Die Konstante WORD_ADDIN_BODY_BUDGET_BYTES
// begrenzt jetzt den FINALEN Payload (Escaping zählt mit — ein anführungszeichenlastiges HTML
// kann über dem Budget liegen, obwohl seine rohen Bytes darunter lägen).
export function prepareWordDraftRequest(html: string, text: string): WordDraftRequest {
  const title = deriveDraftTitleFromSelection(text);
  const statement = text.trim().slice(0, 500);
  const inner = extractWordBodyHtml(html || "");
  const undeliveredImages = countUndeliveredWordImages(inner);
  if (inner.length === 0) {
    return {
      payload: draftPostPayload(title, statement, selectionToBodyHtml(text)),
      title,
      usedHtml: false,
      overBudget: false,
      undeliveredImages: 0,
    };
  }
  const htmlPayload = draftPostPayload(title, statement, inner);
  if (wordHtmlUtf8Bytes(htmlPayload) > WORD_ADDIN_BODY_BUDGET_BYTES) {
    return {
      payload: draftPostPayload(title, statement, selectionToBodyHtml(text)),
      title,
      usedHtml: false,
      overBudget: true,
      undeliveredImages,
    };
  }
  return { payload: htmlPayload, title, usedHtml: true, overBudget: false, undeliveredImages };
}
