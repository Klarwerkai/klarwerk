// WP-KLARA-1 (Klara in Word, erster Schritt): DOM-freie Hilfslogik des Word-Add-ins. Das Taskpane
// (apps/web/public/word-addin/taskpane.html) ist bewusst eine selbstenthaltende statische Seite ohne
// Build-Schritt — es trägt eine INLINE-KOPIE dieser zwei Funktionen zwischen den Markern
// KW-WORDADDIN-HELPERS-START/END; ein Äquivalenztest (tests/app/word-addin.test.ts) führt beide
// Fassungen auf denselben Fixtures aus und pinnt identisches Verhalten (kleinste ehrliche Lösung —
// kein Build-Generator für eine einzelne statische Seite).

import type { ReasonerStatus } from "../api/types";
// AUFTRAG-mega75 Block B: KEINE zweite Wahrheit. Die beiden Funktionen, an denen auch AiModelInfo
// in der Anwendung hängt, werden hier IMPORTIERT und AUFGERUFEN — nicht nachgebaut.
import { deriveAiAvailable } from "./aiAvailability";
import { aiTaskInfoPublic } from "./reasonerTaskInfo";

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

// ================================================================================================
// AUFTRAG-mega74 TEIL 2 — DIE BILDER WIRKLICH ÜBERGEBEN.
// ================================================================================================
//
// Bis mega74 hat Klara den Verlust nur GEZÄHLT (countUndeliveredWordImages) und ehrlich gemeldet.
// Die Office-Schnittstelle kennt aber einen Weg an die Bytes: `Body.inlinePictures` →
// `InlinePicture.getBase64ImageSrc()`.
//
// DIE ANFORDERUNGSSTUFE, an der Dokumentation belegt (nicht aus dem Gedächtnis):
//   · `Word.Body.inlinePictures`            → API set: WordApi **1.1**
//   · `Word.InlinePictureCollection` (Klasse, `items`, `load`) → API set: WordApi **1.1**
//   · `Word.InlinePicture.getBase64ImageSrc()` → API set: WordApi **1.1**
// Damit bleibt das Manifest bei `WordApi MinVersion 1.1` (docs/word-addin/klara-manifest.xml:34-36)
// UNVERÄNDERT — es gibt hier nichts für Pedi zu entscheiden.
//
// ZWEI NACHBARN SIND AUSDRÜCKLICH GEMIEDEN, weil sie höher lägen:
//   · `InlinePictureCollection.getFirst()` / `getFirstOrNullObject()` → WordApi **1.3**.
//     Deshalb `load("items")` + Index, nicht `getFirst()`.
//   · `InlinePicture.imageFormat` → **WordApiDesktop 1.1** (also gar nicht die WordApi-Reihe).
//     Deshalb wird der Bildtyp aus den BYTES erkannt (s. `wordImageMimeFromBase64`) und nicht
//     erfragt. Das ist kein Notbehelf: die Magic Bytes sind eindeutiger als eine Typangabe.

// Die vier Rastertypen, die der Server-Sanitizer inline akzeptiert (services/structure/src/
// sanitize.ts:86-93 — `isSafeImgSrc`). Ein Bild, dessen Typ NICHT dazugehört, wird gar nicht erst
// eingesetzt: es würde beim Speichern still weggeworfen, und Klara hätte einen Erfolg behauptet.
const WORD_IMAGE_SIGNATURES: readonly { mime: string; prefix: string }[] = [
  { mime: "image/png", prefix: "iVBORw0KGgo" },
  { mime: "image/jpeg", prefix: "/9j/" },
  { mime: "image/gif", prefix: "R0lGOD" },
  // WEBP ist ein RIFF-Container: „RIFF" in Byte 0-3, die Typkennung „WEBP" erst in Byte 8-11.
  // Byte 8 liegt NICHT auf einer Base64-Dreiergrenze — ein Präfixvergleich auf der kodierten
  // Zeichenkette geht deshalb schief (der erste Anlauf tat genau das und war rot). Deshalb wird
  // der Kopf hier wirklich dekodiert; s. `riffIstWebp`.
  { mime: "image/webp", prefix: "UklGR" },
];

// Dekodiert die ersten Bytes und prüft die RIFF/WEBP-Kennung an ihrer echten Position.
// Fehlschlag (ungültiges Base64, zu kurz) → false, also „kein WEBP" — fail-safe.
function riffIstWebp(base64: string): boolean {
  try {
    const kopf = atob(base64.slice(0, 24));
    return kopf.slice(0, 4) === "RIFF" && kopf.slice(8, 12) === "WEBP";
  } catch {
    return false;
  }
}

/**
 * Welcher Bildtyp steckt in diesem Base64? — aus den Bytes erkannt, nicht erfragt.
 *
 * `null` heißt „unbekannt oder nicht sanitizer-tauglich". Der Aufrufer setzt ein solches Bild NICHT
 * ein und meldet es weiterhin als fehlend — lieber eine ehrliche Lücke als ein Bild, das der Server
 * beim Speichern verwirft.
 */
export function wordImageMimeFromBase64(base64: string): string | null {
  const clean = (base64 ?? "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (clean.length === 0) {
    return null;
  }
  for (const sig of WORD_IMAGE_SIGNATURES) {
    if (clean.startsWith(sig.prefix)) {
      if (sig.mime === "image/webp" && !riffIstWebp(clean)) {
        return null;
      }
      return sig.mime;
    }
  }
  return null;
}

export interface WordImageFillResult {
  html: string;
  /** Wie viele zuvor fehlende Bilder wirklich eingesetzt wurden. */
  filled: number;
  /** Wie viele danach IMMER NOCH fehlen — die Zahl, die Klara meldet. */
  remaining: number;
  /**
   * Warum gar nichts eingesetzt wurde, wenn nichts eingesetzt wurde. `null` = kein Hindernis.
   * `"anzahl-passt-nicht"` ist der wichtige Fall: siehe unten.
   */
  hindernis: "anzahl-passt-nicht" | null;
}

/**
 * Setzt die über die Office-Schnittstelle geholten Bilder in das Word-HTML ein.
 *
 * DIE ZUORDNUNG IST DER HEIKLE TEIL, und sie ist bewusst streng. `inlinePictures` liefert ALLE
 * eingebetteten Bilder des Bereichs in Dokumentreihenfolge; das HTML trägt seine `<img>`-Tags in
 * derselben Reihenfolge. Zugeordnet wird deshalb über den INDEX (i-tes `<img>` ↔ i-tes Bild) —
 * NICHT über „das nächste fehlende", denn Word liefert je nach Fassung einen Teil der Bilder schon
 * als data:-URL, und dann wäre eine fortlaufende Zählung um genau diese Bilder verschoben.
 *
 * PASSEN DIE ANZAHLEN NICHT, WIRD NICHTS EINGESETZT. Eine Zuordnung, die wir nicht belegen können,
 * wäre ein Bild an der falschen Stelle — und das ist schlimmer als ein fehlendes Bild, weil es wie
 * Inhalt aussieht. In diesem Fall bleibt die heutige ehrliche Meldung stehen.
 */
export function fillWordImages(html: string, base64List: readonly string[]): WordImageFillResult {
  const imgRe = /<img\b[^>]*>/gi;
  const tags: string[] = [];
  let m = imgRe.exec(html);
  while (m !== null) {
    tags.push(m[0]);
    m = imgRe.exec(html);
  }
  const fehltVorher = countUndeliveredWordImages(html);
  if (tags.length === 0 || tags.length !== base64List.length) {
    return {
      html,
      filled: 0,
      remaining: fehltVorher,
      hindernis: tags.length === 0 ? null : "anzahl-passt-nicht",
    };
  }

  let index = -1;
  let filled = 0;
  const out = html.replace(/<img\b[^>]*>/gi, (tag) => {
    index += 1;
    const srcMatch = /src\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const src = (srcMatch?.[1] ?? srcMatch?.[2] ?? "").trim();
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src)) {
      return tag; // Word hat dieses Bild bereits geliefert — nicht anfassen.
    }
    const roh = (base64List[index] ?? "").replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
    const mime = wordImageMimeFromBase64(roh);
    if (!mime) {
      return tag; // unbekannter Typ → bleibt ehrlich fehlend.
    }
    filled += 1;
    const datenUrl = `data:${mime};base64,${roh}`;
    return srcMatch
      ? tag.replace(/src\s*=\s*(?:"[^"]*"|'[^']*')/i, `src="${datenUrl}"`)
      : tag.replace(/^<img/i, `<img src="${datenUrl}"`);
  });
  return { html: out, filled, remaining: fehltVorher - filled, hindernis: null };
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

// AUFTRAG-mega52 D1 — HIER STAND PEDIS BEFUND IM KLARTEXT.
//
// Der Kommentar lautete: „Server-Vertrag kennt de/en (FR-I18N-01); die NL-Oberflaeche fragt auf
// Deutsch nach." Das war bewusst so gebaut und genau der Grund, warum im Word-Handlauf vom 28.07.
// die niederlaendische Oberflaeche deutsche Antwortkoerper zurueckbekam. Der Server-Vertrag kennt
// seit mega52 drei Sprachen — die Oberflaeche muss nicht mehr luegen.
export function askLocale(lang: string): "de" | "en" | "nl" {
  if (lang === "en") {
    return "en";
  }
  return lang === "nl" ? "nl" : "de";
}

// ================================================================================================
// AUFTRAG-JOB507-D4 — RETRY-AFTER: EINE ZAHL, SECHS KLASSEN, EINE OBERGRENZE.
// ================================================================================================
//
// Der Server sperrt bei zu vielen Versuchen und antwortet mit 429 + `Retry-After`
// (services/auth/src/routes.ts:194 — ganze Sekunden aus `rate-limit.ts`; das Add-on-Ratenlimit
// nutzt die Plugin-Vorgabe). RFC 9110 laesst dort ZWEI Formen zu: `delta-seconds` oder ein
// HTTP-Datum. Das Panel kannte den Fall bisher gar nicht — 429 fiel in den generischen
// `!res.ok`-Zweig und wurde als „fehlgeschlagen (HTTP 429)" gezeigt. Technisch wahr, praktisch
// nutzlos: die eine Auskunft, die der Wartende braucht — WIE LANGE —, war da und wurde weggeworfen.
//
// DIE REIHENFOLGE IST FEST, weil eine wackelige Reihenfolge hier eine falsche Zahl bedeutet:
//   1. fehlend            → null   (nichts gesagt)
//   2. leer/nur Leerraum  → null   (nichts gesagt)
//   3. ganze Sekunden     → Wert, auf die Obergrenze gedeckelt
//   4. negative Sekunden  → 0      (vergangen; RFC-widrig, aber eindeutig gemeint: sofort)
//   5. HTTP-Datum         → Zukunft: aufgerundete Differenz, gedeckelt; Vergangenheit/jetzt: 0
//   6. alles andere       → null   (ungueltig — lieber keine Zahl als eine geratene)
//
// `null` und `0` sind AUSDRUECKLICH nicht dasselbe: 0 heisst „jetzt wieder", null heisst „wir
// wissen es nicht" — und die Oberflaeche sagt dann auch nur das.
//
// DIE OBERGRENZE ist kein Schoenheitswert. Ein defekter oder feindseliger Zwischenserver darf dem
// Panel keine Wartezeit von Tagen in den sichtbaren Text schreiben; eine Stunde ist die Grenze,
// hinter der eine Zahl im Aufgabenfenster ohnehin keine Handlungsanweisung mehr ist.
export const WORD_ADDIN_RETRY_AFTER_MAX_SECONDS = 3600;

// WARUM HIER EINE FORM GEPRUEFT WIRD, BEVOR `Date.parse` UEBERHAUPT LAEUFT: `Date.parse` ist in
// V8 absichtlich nachsichtig und nimmt auch Zeichenfolgen an, die kein HTTP-Datum sind. Der
// Red-first-Lauf hat genau das aufgedeckt — `Retry-After: 12.5` (offensichtlicher Unsinn, den ein
// kaputter Zwischenserver schickt) wurde als Datum gelesen, landete in der Vergangenheit und kam
// als „jetzt wieder erlaubt" heraus statt als „unbrauchbar". Das ist der schlechtere Ausgang: eine
// erfundene Auskunft sieht aus wie eine echte.
//
// Geprueft wird deshalb die IMF-fixdate-Form aus RFC 9110 („Sun, 06 Nov 1994 08:49:37 GMT") — genau
// die Form, die der Server selbst erzeugen wuerde. Ein ISO-Zeitstempel wird BEWUSST NICHT
// akzeptiert: er ist an dieser Kopfzeile nicht vertragsgemaess, und „unbekannt" ist ehrlicher als
// eine Zahl aus einer Form, auf die sich niemand geeinigt hat.
const RETRY_AFTER_HTTP_DATE = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

export function parseRetryAfterSeconds(
  value: string | null | undefined,
  nowMs: number,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = value.trim();
  if (raw.length === 0) {
    return null;
  }
  if (/^\d+$/.test(raw)) {
    return Math.min(Number(raw), WORD_ADDIN_RETRY_AFTER_MAX_SECONDS);
  }
  if (/^-\d+$/.test(raw)) {
    return 0;
  }
  const parsed = RETRY_AFTER_HTTP_DATE.test(raw) ? Date.parse(raw) : Number.NaN;
  if (Number.isFinite(parsed)) {
    const seconds = Math.ceil((parsed - nowMs) / 1000);
    if (seconds <= 0) {
      return 0;
    }
    return Math.min(seconds, WORD_ADDIN_RETRY_AFTER_MAX_SECONDS);
  }
  return null;
}

// AUFTRAG-JOB507-D4: der 403-Ausgang ist NEU und er ist kein Detail. Bis hierher warf `performAsk`
// 401 und 403 in einen Topf („auth"), und das Panel sagte in beiden Faellen „Nicht angemeldet".
// Bei 403 ist das irrefuehrend: die Sitzung IST da, dem Konto fehlt `ko.read`. Wer daraufhin ein
// zweites Mal anmeldet, aendert nichts und erfaehrt den Grund nie. Der Wissensluecken-Weg des
// Panels unterschied beides laengst (sendOpenQuestion) — jetzt tut es der Fragen-Weg auch.
export type AskOutcomeKind =
  | "answered"
  | "gap"
  | "auth"
  | "forbidden"
  | "rate-limited"
  | "error"
  | "timeout";

// ================================================================================================
// AUFTRAG-mega34 BLOCK B (bens zweiter ROT-Befund) — WORD BEKOMMT DIE EINSTUFUNG.
// ================================================================================================
//
// Bis mega33 kannte diese Flaeche nur zwei Zustaende: `answered` oder `gap`. Weder Wissensklasse
// noch Pruefabdeckung noch Konfliktstand kamen darin vor — und der Nutzer KOPIERTE das Ergebnis in
// ein echtes Dokument. Von allen Leseflaechen ist das die folgenreichste, weil das Ergebnis das
// Haus verlaesst.
//
// Sie legt jetzt NICHTS mehr selbst aus: der Server liefert den kanonischen, quellengebundenen
// Evidenzzustand an `/api/ask` mit (services/ask/src/answer-evidence.ts). Hier wird er nur gelesen.
export type AskGrade = "verified" | "unverified";

export interface AskEvidence {
  grade: AskGrade;
  // Der benannte Pruefvorbehalt, falls vorhanden — worauf er sich bezieht.
  checkCaveat?: { reason: string; unproven: number; total: number } | null;
  // Die Konfliktlage selbst ist unbekannt (serverseitiger Abruf gescheitert).
  conflictsUnproven?: boolean;
  // AUFTRAG-W1-VERTRAUENSKOPF-08 Buendel B: mindestens eine TRAGENDE Quelle steht in einem offenen
  // Konflikt. Der Server berechnet und sendet das Feld seit mega34 (services/ask/src/answer-evidence.ts
  // — Anker `sourcesConflicted`); dieser Clienttyp kannte es bis hierher NICHT und hat es deshalb
  // verworfen. Nichts wird hier berechnet: die Konfliktlage bleibt vollstaendig serverseitig
  // (KW-W1-13: „Keine Konflikte oder Validierung clientseitig berechnen").
  sourcesConflicted?: boolean;
}

export interface AskOutcome {
  kind: AskOutcomeKind;
  answer?: string;
  sources?: string[]; // KO-Ids aus AnswerResult.sources — Titel/Trust laedt das Panel je KO nach
  trust?: number;
  detail?: string;
  // AUFTRAG-mega34 B: die EINE Einstufung, vom Server. Bei `answered` immer gesetzt.
  grade?: AskGrade;
  evidence?: AskEvidence | undefined;
  // AUFTRAG-W1-VERTRAUENSKOPF-08 Buendel B: die TRAGENDE Teilmenge (`AnswerResult.citedSources`),
  // auf der die serverseitige Evidenzregel ohnehin rechnet. `sources` bleibt unveraendert die
  // vollstaendige Transparenzliste. Auf dem heutigen retrieval-only-Weg sind beide Mengen gleich
  // (`[best.id]`) — die Unterscheidung ist deshalb REAL, aber nicht sichtbar wirksam; ein Server
  // ohne das Feld fuehrt in „keine Aussage", nie in eine falsche.
  citedSources?: string[] | undefined;
  // AUFTRAG-W1-VERTRAUENSKOPF-08 Buendel B: HOECHSTENS der erste real gelieferte
  // `AnswerResult.steps[0].snippet` — ehrlich als „Verwendeter Ausschnitt" bezeichnet.
  // AUSDRUECKLICH KEINE Begruendungskette: KW-W1-13 verbietet, aus `steps` eine Argumentation zu
  // konstruieren, und mega39 D2 hat genau diese Vortaeuschung in der Konsole bereits entfernt.
  snippet?: string | undefined;
  // AUFTRAG-mega81 BLOCK A: das SERVERSEITIGE Kennzeichnungssignal (`result.aiGenerated`, gesetzt
  // in services/reasoner/src/service.ts an `answer`/`describe`/`interview`). Es reist mit, damit
  // die KI-Kennzeichnung an das Verhalten gebunden werden kann statt an ihre Anwesenheit. Fehlt es
  // — und auf dem retrieval-only-Weg des Add-ins fehlt es IMMER, weil `answerRetrievalOnly` es
  // bewusst weglaesst —, wird nichts behauptet.
  aiGenerated?: boolean;
  // AUFTRAG-JOB507-D4: bei `rate-limited` die gelesene Wartezeit in Sekunden — `null`, wenn der
  // Server keine oder eine unbrauchbare genannt hat. Die Oberflaeche zeigt dann KEINE Zahl.
  retryAfterSeconds?: number | null;
  // AUFTRAG-mega77 BLOCK A: hier stand `ungeprueft` — die Zahl der unterdrueckten ungeprueften
  // Treffer aus mega74 Teil 2b, samt der Zusage „0 heisst es gab wirklich nichts". Feld, Zusage und
  // serverseitige Berechnung sind entfernt (services/ask/src/service.ts): die Zahl entstand ohne
  // Betrachterfilter und zaehlte die gedeckelte Vorauswahl statt des Bestands.
}

// AUFTRAG-mega34 B: der Grad aus dem Server-Feld — FAIL-SAFE. Fehlt das Feld (alter Server,
// abgeschnittener Body, unerwartetes Format), gilt die Antwort als NICHT belegt. Dieselbe
// Beweislast-Umkehr wie in Block A: „nichts da" ist nicht „nichts vorhanden", und die einzige
// harte Zusage lautet, dass der Leser nie eine zu starke Aussage sieht.
export function askGradeOf(evidence: unknown): AskGrade {
  const grade = (evidence as { grade?: unknown } | null | undefined)?.grade;
  return grade === "verified" ? "verified" : "unverified";
}

// AUFTRAG-mega34 B2: DERSELBE Hinweis fuer Anzeige, Kopieren und Einfuegen. Die Texte kommen von
// aussen (i18n der jeweiligen Laufzeit), die AUSWAHL trifft diese eine Funktion — damit die drei
// Wege nicht auseinanderlaufen koennen.
// ================================================================================================
// AUFTRAG-mega81 BLOCK A — DIE KI-KENNZEICHNUNG HAENGT AM SIGNAL, NICHT AN DER FLAECHE.
// ================================================================================================
//
// Bis mega80 stand „Von kuenstlicher Intelligenz erzeugt" DAUERHAFT im Fragen-Bereich des
// Aufgabenfensters — unmittelbar ueber der Zeile, die (seit mega79 richtig) sagt, Klaras Antwort
// entstehe IMMER ohne KI-Modell. Zwei unvereinbare Saetze uebereinander, fuer denselben Weg.
//
// Diese eine Funktion entscheidet, ob die Behauptung sichtbar wird — und sie entscheidet es
// AUSSCHLIESSLICH an dem, was der Server ueber DIESE Antwort gesagt hat:
//   · kein `aiGenerated` im Antwortkoerper  → keine Behauptung (der heutige retrieval-only-Weg),
//   · `aiGenerated` da                      → Behauptung, unveraendert wie seit mega61.
// Ohne angezeigte Antwort gibt es nichts zu kennzeichnen: eine Wissensluecke, ein Zeitablauf oder
// ein Rechtefehler zeigt keinen erzeugten Text.
//
// GEBUNDEN, NICHT ABGESCHALTET: zeigt diese Flaeche spaeter einmal einen echten Modellweg, folgt
// die Kennzeichnung von selbst — es ist dieselbe Funktion, dasselbe Signal.
export function askAiNoticeVisible(outcome: AskOutcome | null | undefined): boolean {
  return outcome?.kind === "answered" && outcome.aiGenerated === true;
}

export function answerInsertEvidenceNote(
  grade: AskGrade,
  texts: { verified: string; unverified: string },
): string {
  return grade === "verified" ? texts.verified : texts.unverified;
}

// ================================================================================================
// AUFTRAG-W1-VERTRAUENSKOPF-08 BLOCK B — DIE VORHANDENE EVIDENZ ENTFALTEN.
// ================================================================================================
//
// DER BEFUND (Ist-Delta 05, §3.2/3.3). Der Server liefert seit mega34 einen reichen Evidenzzustand:
// FUENF unterscheidbare Pruefvorbehalte samt Zaehlung, dazu die Konfliktlage in ZWEI getrennten
// Feldern. Das Aufgabenfenster las davon nur `grade` und zeigte ZWEI Texte. Die Nutzerin erfuhr
// also, DASS etwas nicht belegt ist — nie, WAS. Und die Konfliktwarnung, die W1 ausdruecklich
// verlangt, war von jedem anderen Vorbehalt ununterscheidbar.
//
// HIER WIRD NICHTS BERECHNET. Diese Funktion liest ausschliesslich, was im Antwortkoerper steht.
// KW-W1-13 verbietet ausdruecklich, Konflikte oder Validierung clientseitig zu bestimmen — die
// Regel bleibt in services/ask/src/answer-evidence.ts, und zwar als einzige Fassung.
export type AskCaveatKey =
  | "unknown"
  | "unchecked"
  | "noCoverage"
  | "incomplete"
  | "unattributed"
  // Ein Grund, den dieser Client nicht kennt (neuer Server, abgeschnittener Body). Er wird als
  // GENERISCHER Vorbehalt gezeigt — nie verschwiegen. Schweigen waere hier fail-open.
  | "other";

// Die Konfliktlage in genau drei Anzeige-Zustaenden. `unproven` ist NICHT „keine Konflikte":
// „nichts da" ist nicht „nichts vorhanden" — dieselbe Beweislast-Umkehr, die der Server mit
// `conflictsUnproven` bereits fuehrt.
export type AskConflictState = "conflicted" | "unproven" | "clear";

export interface AskEvidenceDetail {
  caveat: { key: AskCaveatKey; unproven: number; total: number } | null;
  conflict: AskConflictState;
}

const ASK_CAVEAT_KEYS: readonly string[] = [
  "unknown",
  "unchecked",
  "noCoverage",
  "incomplete",
  "unattributed",
];

function askCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function askEvidenceDetail(evidence: unknown): AskEvidenceDetail {
  const raw = evidence as
    | { checkCaveat?: unknown; sourcesConflicted?: unknown; conflictsUnproven?: unknown }
    | null
    | undefined;

  // `checkCaveat: null` ist eine ECHTE Aussage des Servers: jede tragende Quelle ist belegt.
  // `undefined` dagegen heisst nur, dass nichts gesagt wurde — beides fuehrt hier zu keiner
  // Vorbehalts-Zeile, aber der Grad bleibt in diesem Fall ueber `askGradeOf` fail-safe unbelegt.
  const cc = raw?.checkCaveat;
  const caveat =
    cc && typeof cc === "object"
      ? (() => {
          const reason = (cc as { reason?: unknown }).reason;
          return {
            key: (typeof reason === "string" && ASK_CAVEAT_KEYS.includes(reason)
              ? reason
              : "other") as AskCaveatKey,
            unproven: askCount((cc as { unproven?: unknown }).unproven),
            total: askCount((cc as { total?: unknown }).total),
          };
        })()
      : null;

  // FAIL-SAFE: „keine offenen Konflikte" wird NUR behauptet, wenn der Server BEIDE Felder
  // ausdruecklich mit `false` gesendet hat. Ein fehlendes Feld, ein alter Server oder ein
  // gescheiterter Konfliktabruf fuehren in „konnte nicht geprueft werden" — nie in eine Entwarnung.
  const conflict: AskConflictState =
    raw?.sourcesConflicted === true
      ? "conflicted"
      : raw?.sourcesConflicted === false && raw?.conflictsUnproven === false
        ? "clear"
        : "unproven";

  return { caveat, conflict };
}

// AUFTRAG-W1-VERTRAUENSKOPF-08 Buendel B: lohnt der Ausschnitt eine eigene Zeile?
//
// AUF DEM HEUTIGEN WEG IST DIE ANTWORT DIE AUSSAGE DER TRAGENDEN QUELLE. `answerRetrievalOnly`
// liefert `answer = best.statement` UND `steps[0].snippet = best.statement`
// (services/reasoner/src/provider.ts) — beide Texte sind dann IDENTISCH. Derselbe Satz zweimal,
// einmal als „Antwort" und einmal als „Verwendeter Ausschnitt", sieht aus wie ein zweiter Beleg,
// ist aber derselbe. Genau diese Vortaeuschung hat mega39 D2 in der Fragen-Konsole entfernt
// (`stepsWorthShowing`); sie wird hier nicht neu eingefuehrt.
//
// Der Vergleich normalisiert nur Leerraum — keine inhaltliche Aehnlichkeitsrechnung. Im Zweifel
// wird der Ausschnitt GEZEIGT: etwas Zusaetzliches zu sehen ist harmlos, eine Dopplung fuer einen
// Beleg zu halten nicht.
export function askSnippetWorthShowing(
  answer: string | null | undefined,
  snippet: string | null | undefined,
): boolean {
  const s = typeof snippet === "string" ? snippet.replace(/\s+/g, " ").trim() : "";
  if (s.length === 0) {
    return false;
  }
  const a = typeof answer === "string" ? answer.replace(/\s+/g, " ").trim() : "";
  return s !== a;
}

// Die Rolle EINER Quelle in der Antwort. `citedSources` ist die tragende Teilmenge; fehlt sie oder
// ist sie leer, wird KEINE Rolle behauptet (`unknown`) — die Liste sieht dann aus wie bisher.
export type AskSourceRole = "carrying" | "consulted" | "unknown";

export function askSourceRole(
  id: string,
  citedSources: readonly string[] | undefined,
): AskSourceRole {
  if (!Array.isArray(citedSources) || citedSources.length === 0) {
    return "unknown";
  }
  return citedSources.indexOf(id) >= 0 ? "carrying" : "consulted";
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
  // AUFTRAG-JOB507-D4: die Kopfzeilen sind OPTIONAL, damit jeder bestehende Fake ohne Umbau weiter
  // gilt — fehlt der Zugriff, ist die Wartezeit ehrlich unbekannt statt geraten.
  headers?: { get(name: string): string | null } | undefined;
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
  locale: "de" | "en" | "nl",
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
      if (res.status === 401) {
        return { kind: "auth" };
      }
      // AUFTRAG-JOB507-D4: 403 ist FEHLENDES RECHT (`ko.read`), keine fehlende Anmeldung.
      if (res.status === 403) {
        return { kind: "forbidden" };
      }
      // AUFTRAG-JOB507-D4: 429 ist eine Sperre auf Zeit — die Zeit steht im Kopf und wird gelesen.
      if (res.status === 429) {
        return {
          kind: "rate-limited",
          retryAfterSeconds: parseRetryAfterSeconds(
            res.headers ? res.headers.get("retry-after") : null,
            Date.now(),
          ),
        };
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
        // AUFTRAG-W1-VERTRAUENSKOPF-08 Buendel B: die tragende Teilmenge und der erste Ausschnitt.
        // Beide werden GELESEN, nie hergeleitet — fehlt das Feld, bleibt es `undefined`, und die
        // Flaeche behauptet dann nichts (dieselbe Beweislast-Umkehr wie `askGradeOf`).
        const cited = Array.isArray(result?.citedSources)
          ? (result.citedSources as unknown[]).filter(
              (id): id is string => typeof id === "string" && id.trim().length > 0,
            )
          : undefined;
        const firstStep = Array.isArray(result?.steps)
          ? ((result.steps as unknown[])[0] as { snippet?: unknown } | undefined)
          : undefined;
        const snippet =
          typeof firstStep?.snippet === "string" && firstStep.snippet.trim().length > 0
            ? firstStep.snippet.trim()
            : undefined;
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
            // AUFTRAG-mega34 B: die serverseitige Einstufung reist mit. Fehlt sie, ist der Grad
            // fail-safe „unverified" — Word behauptet nie Sicherheit, die es nicht belegt bekam.
            grade: askGradeOf(result.evidence),
            evidence: (result.evidence ?? undefined) as AskEvidence | undefined,
            citedSources: cited,
            snippet,
            // AUFTRAG-mega81 BLOCK A: das Kennzeichnungssignal wird GELESEN, nicht angenommen.
            // `aiGenerated` ist am Server ein Objekt ({aiGenerated,task,mode,at}); hier zaehlt nur,
            // OB es da ist — die Flaeche behauptet nie mehr, als der Server gesagt hat.
            aiGenerated: Boolean(result.aiGenerated),
          };
        }
        // AUFTRAG-mega77 BLOCK A: die Wissensluecke ist wieder eine reine Wissensluecke. Der
        // Antwortkoerper wird an dieser Stelle NICHT mehr nach einer Bestandszahl durchsucht.
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
// AUFTRAG-mega34 B2: der EINGEFUEGTE Text traegt die Einstufung mit. Das ist der Punkt, an dem das
// Ergebnis das Haus verlaesst — ein Hinweis, der nur im Panel steht, reist nicht mit ins Dokument.
// Der Zusatz ist optional, damit alle bestehenden Aufrufe unveraendert bleiben.
// AUFTRAG-mega36 D: bleibt nach dem Abzug bereits vorhandener Metazeilen KEIN Koerper uebrig
// (die Nutzerin hat NUR den Metablock im Feld stehen), entsteht die Quellen-Zeile ohne die beiden
// fuehrenden Leerzeilen — ein Text, der mit "\n\nQuelle: ..." beginnt, ist kein Ergebnis.
export function buildAnswerInsertText(
  answer: string,
  sourceLine: string,
  truncatedNote?: string,
  evidenceNote?: string,
): string {
  const head = answer.replace(/\s+$/g, "");
  const base = head.length > 0 ? `${head}\n\n${sourceLine}` : sourceLine;
  const withEvidence =
    evidenceNote && evidenceNote.trim().length > 0 ? `${base}\n${evidenceNote}` : base;
  return truncatedNote && truncatedNote.trim().length > 0
    ? `${withEvidence}\n${truncatedNote}`
    : withEvidence;
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

// AUFTRAG-mega35 A1 — DIE EINE STELLE, AN DER DER AUSZUGEBENDE TEXT ENTSTEHT.
//
// Vorher wurde der vollstaendige Text VORBEFUELLT und spaeter nachgetragen; wer waehrenddessen
// editierte, verlor Einstufung und Quellen-Zeile, ohne dass die Ausgabewege das bemerkt haetten.
// Die Bauweise ist jetzt umgedreht: der Nutzerin gehoert NUR der Antwortkoerper; Einstufung und
// Quellen-Zeile werden im AUGENBLICK des Kopierens/Einfuegens angesetzt und koennen deshalb nicht
// fehlen. Rein und DOM-frei — die Laufzeit reicht Zustand und uebersetzte Texte herein.
export interface AnswerOutputInput {
  // Der BEARBEITETE Antwortkoerper aus dem Feld (nicht die Originalantwort).
  body: string;
  sourceTitles: readonly string[];
  sourceDates: readonly (string | undefined)[];
  truncated: boolean;
  grade: AskGrade;
  // "Heute" fuer den Fall ohne belegtes Quell-Datum — hereingereicht statt hier gelesen (testbar).
  now: Date;
  texts: {
    verified: string;
    unverified: string;
    // Templates mit {titles}/{date}.
    sourceLine: string;
    sourceLineRetrieved: string;
    // Bereits aufgeloester Kappungs-Hinweis (der {max}-Platzhalter ist beim Aufrufer gefuellt).
    truncatedNote: string;
  };
}

// AUFTRAG-mega36 D (bens GELB-2) — DIE ZUSAMMENSETZUNG IST IDEMPOTENT.
//
// Bis mega35 hing `composeAnswerOutput` Quellen-Zeile und Einstufung IMMER an. Kopiert die Nutzerin
// die volle Ausgabe einmal heraus und wieder in das Feld hinein (der realistische Weg: kopieren,
// woanders lesen, zurueckfuegen), entstand jede Zeile doppelt.
//
// Erkannt wird der ANGEHAENGTE Metablock — also die Zeilen am ENDE des Koerpers, die genau die
// Formen tragen, die diese Funktion selbst erzeugt: eine der beiden Quellen-Zeilen-Vorlagen
// (Platzhalter {titles}/{date} als Platzhalter, der Rest zeichengleich), einer der beiden
// Einstufungstexte oder der Kappungshinweis. Alles andere bleibt unangetastet — eine Zeile, die das
// Wort „Quelle" nur ERWAEHNT, ist keine Metazeile.
//
// AUSDRUECKLICHE GRENZE: nur der TRAILING-Block wird erkannt. Eine Metazeile MITTEN im Koerper
// bleibt stehen (sie ist dort nicht das Ergebnis dieser Funktion, sondern Text der Nutzerin) und
// eine Metazeile in einer ANDEREN Sprache als der gerade eingestellten wird nicht erkannt.
function composedMetaLinePattern(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\\\{titles\\\}/g, ".*").replace(/\\\{date\\\}/g, ".*")}$`);
}

export function stripComposedMetaLines(body: string, texts: AnswerOutputInput["texts"]): string {
  const patterns = [
    composedMetaLinePattern(texts.sourceLine),
    composedMetaLinePattern(texts.sourceLineRetrieved),
  ];
  const exact = [texts.verified, texts.unverified, texts.truncatedNote]
    .map((value) => (value || "").trim())
    .filter((value) => value.length > 0);
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0) {
    const last = (lines[lines.length - 1] ?? "").trim();
    if (last.length === 0) {
      lines.pop();
      continue;
    }
    if (exact.includes(last) || patterns.some((pattern) => pattern.test(last))) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join("\n").replace(/\s+$/g, "");
}

export function composeAnswerOutput(input: AnswerOutputInput): string {
  const standLabel = newestSourceDateLabel(input.sourceDates);
  const sourceLine = standLabel
    ? buildAskSourceLine(input.sourceTitles, standLabel, input.texts.sourceLine)
    : buildAskSourceLine(
        input.sourceTitles,
        formatAskDateLabel(input.now),
        input.texts.sourceLineRetrieved,
      );
  const evidenceNote = answerInsertEvidenceNote(input.grade, {
    verified: input.texts.verified,
    unverified: input.texts.unverified,
  });
  const truncatedNote = input.truncated ? input.texts.truncatedNote : "";
  // AUFTRAG-mega36 D: erst den bereits vorhandenen Metablock abziehen, dann genau einmal ansetzen.
  return buildAnswerInsertText(
    stripComposedMetaLines(input.body, input.texts),
    sourceLine,
    truncatedNote,
    evidenceNote,
  );
}

// AUFTRAG-mega36 B2 — GANZE AUSWAHL ODER BRUCHSTUECK.
//
// Der abgefangene native Kopiervorgang (Cmd+C, Kontextmenue, Ausschneiden, Ziehen) gibt den
// ABGELEITETEN Text nur dann aus, wenn die Auswahl den GANZEN Antwortkoerper umfasst. Eine
// Teilauswahl — drei Woerter, ein Satz — bleibt roh: ein Bruchstueck ist keine Antwort und traegt
// deshalb auch keine Einstufung; eine Einstufungszeile an drei Woerter zu haengen waere Laerm und
// wuerde die Zeile entwerten.
//
// „Ganz" wird umgebende-Leerraum-tolerant gemessen: wer die Textzeile markiert, aber die leere
// Zeile davor/danach ausspart, hat den ganzen Koerper markiert. Umgekehrt kann eine echte
// Teilauswahl NIE zeichengleich zum getrimmten Koerper werden — ausgelassen werden darf nur
// Leerraum. Leerer Koerper oder leere Auswahl → false (es gibt nichts abzuleiten).
export function answerSelectionIsWhole(value: string, start: number, end: number): boolean {
  const body = (value || "").trim();
  if (body.length === 0) {
    return false;
  }
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min((value || "").length, Math.max(start, end));
  return (value || "").slice(from, to).trim() === body;
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
  return JSON.stringify({ title, statement, bodyHtml, origin: "word_addin" });
}

export interface WordDraftRequest {
  // Finaler, bereits serialisierter POST-Body (genau der gemessene String wird gesendet).
  payload: string;
  title: string;
  usedHtml: boolean; // false = Klartext-Fallback (kein/leeres HTML oder Budget überschritten)
  overBudget: boolean; // true = FINALER Payload lag über dem Budget → Klartext-Fallback, ehrlich gemeldet
  undeliveredImages: number; // Bilder, die Word nicht als übernehmbare Daten geliefert hat
  // AUFTRAG-mega45 Block F: WORD HAT GAR KEIN VERWERTBARES HTML GELIEFERT.
  //
  // Der Zweig `inner.length === 0` meldete bis mega44 `undeliveredImages: 0` UND `overBudget:
  // false` — also genau die beiden Werte, an denen die Oberfläche ihre Warnung festmacht, beide
  // auf „alles gut". Das ist DIE STILLE NULL: die Null ist nicht falsch (in einem leeren HTML
  // sind wirklich null Bilder zählbar), sie wird nur als Entwarnung gelesen, obwohl gar nichts
  // geprüft werden KONNTE. Formatierung und Bilder verschwanden, der Nutzer sah ein grünes
  // „Entwurf angelegt".
  //
  // Dieses Feld trennt „gezählt und nichts gefunden" von „konnte nicht zählen". Es ist bewusst
  // KEINE Zahl: wo kein HTML ankam, ist jede Bildzahl geraten, und eine geratene Zahl wäre
  // schlimmer als keine. Die Oberfläche meldet deshalb ohne Anzahl, dass Formatierung und
  // etwaige Bilder nicht übernommen wurden.
  plainTextFallback: boolean;
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
      plainTextFallback: true,
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
      // Hier ist der Verlust bereits durch `overBudget` benannt UND die Bildzahl ist echt gezählt
      // (es lag ja HTML vor) — kein zweites, gleichlautendes Signal.
      plainTextFallback: false,
    };
  }
  return {
    payload: htmlPayload,
    title,
    usedHtml: true,
    overBudget: false,
    undeliveredImages,
    plainTextFallback: false,
  };
}

// ================================================================================================
// AUFTRAG-JOB507-D4 — WAS DIE ANTWORT DES DRAFT-POSTS BEDEUTET, WIRD EINMAL ENTSCHIEDEN.
// ================================================================================================
//
// Der Entwurf-Sender und der Wissensluecken-Weg schicken beide an POST /api/drafts und lasen die
// Antwort bis hierher JEDER FUER SICH: der eine kannte 401/403, der andere nur „nicht ok". Alles
// dazwischen — 413 vom Route-bodyLimit (DRAFTS_BODY_LIMIT, 5 MiB) und 429 vom Ratenlimit — landete
// in „Senden fehlgeschlagen (HTTP 413)". Der Satz ist nicht falsch, aber er ist keine Auskunft: er
// sagt weder, WORAN es lag, noch was zu tun ist, und er sieht aus wie ein Serverfehler, obwohl das
// Dokument schlicht zu gross war.
//
// FAIL-CLOSED IST DER KERN DIESER FUNKTION: als angelegt gilt AUSSCHLIESSLICH das dokumentierte
// 201 der Route (services/app/src/routes/capture-routes.ts). Jede andere Antwort ist Create-0 —
// auch ein kuenftiges 200 oder 202. Damit kann kein neuer Statuscode versehentlich als Erfolg
// durchrutschen und einen Entwurf behaupten, den es nicht gibt.
export type DraftResponseKind =
  | "created"
  | "auth"
  | "forbidden"
  | "too-large"
  | "rate-limited"
  | "error";

export function classifyDraftResponse(status: number): DraftResponseKind {
  if (status === 201) {
    return "created";
  }
  if (status === 401) {
    return "auth";
  }
  if (status === 403) {
    return "forbidden";
  }
  if (status === 413) {
    return "too-large";
  }
  if (status === 429) {
    return "rate-limited";
  }
  return "error";
}

/** Die eine Stelle, an der „es liegt jetzt ein Entwurf im Pool" behauptet werden darf. */
export function draftWasCreated(kind: DraftResponseKind): boolean {
  return kind === "created";
}

// ================================================================================================
// AUFTRAG-mega75 BLOCK A + B (Pedi 30.07.) — KLARA SAGT, MIT WELCHER KI SIE ARBEITET.
// ================================================================================================
//
// PEDIS WIDERSPRUCH: `AiModelInfo` zeigt an jeder KI-Fläche der Anwendung, WOMIT gearbeitet wird —
// abgeleitet aus dem öffentlichen, abstrahierten Status (/api/reasoner/status). Dieselbe Fläche im
// Word-Add-in trug davon NICHTS: der KI-Satz stand dort als fester Text ohne jede Verbindung zum
// tatsächlichen Zustand. Wer in KLARWERK eine KI arbeiten sah und in Klara „Keine belastbare
// Grundlage" las, bekam nirgends gesagt, warum das kein Widerspruch ist.
//
// WARUM DIESE FUNKTION HIER STEHT UND NICHT IM TASKPANE: sie ist die EINE Stelle, an der die
// KLARWERK-Ableitung für Klara ausgewertet wird — und sie leitet nichts selbst ab, sondern RUFT
// `deriveAiAvailable` und `aiTaskInfoPublic` auf. Im TypeScript gibt es damit keine Kopie, sondern
// echte Wiederverwendung. Nur das buildlose Taskpane muss spiegeln (kein Modulsystem, kein Build);
// dieser Spiegel ist über den VOLLEN Vertrags-Zustandsraum gepinnt
// (tests/app/mega75-klara-ki-status.test.ts) — der Äquivalenztest ist die Lieferung, nicht die Kopie.
//
// DIESELBE AUFGABE wie die Fläche in der Anwendung: `KlaraAssistant.tsx` bindet
// `<AiModelInfo task="answer" />` ein. Verglichen wir eine andere Aufgabe, verglichen wir zwei Dinge.
export const KLARA_AI_TASK = "answer";

// Die Abrufphase — Klara kennt DREI ehrliche Zustände, nicht zwei. Ein Ladezustand, der wie ein
// Befund aussieht, ist genau der Fehler, der bei A22 eine Runde gekostet hat: „noch nicht da"
// heißt NICHT „keine KI", und „Dienst nicht erreichbar" heißt nicht „verfügbar".
export type KlaraAiPhase = "laedt" | "da" | "unerreichbar";

// Was diese Ableitung beschreibt: den HAUSSTAND von KLARWERK für die Aufgabe `answer` — arbeitet
// dort gerade eine externe KI, eine hausinterne, oder keine — plus die beiden ehrlichen
// Nicht-Aussagen. KEIN Modellname: der öffentliche Status ist bewusst abstrahiert (WP-VIP2-GATE),
// und das bleibt so.
//
// AUFTRAG-mega79 BLOCK A: sie beschreibt AUSDRÜCKLICH NICHT Klaras Antwortweg. Der ist keine
// Betriebsart, sondern eine Eigenschaft: Klaras Antwort läuft IMMER deterministisch, zitiert
// validiertes Wissen wörtlich, und der markierte Text erreicht NIE ein Modell oder einen Embedder —
// unabhängig davon, was hier herauskommt. Der sichtbare Satz im Aufgabenfenster hatte diese beiden
// Dinge vermischt und behauptete bei „extern"/„intern", für Klaras Antwort arbeite eine KI. Das ist
// korrigiert; die Ableitung selbst ist unverändert.
export type KlaraAiLage = "laedt" | "unerreichbar" | "extern" | "intern" | "keine";

export function klaraAiLage(phase: KlaraAiPhase, status: ReasonerStatus | undefined): KlaraAiLage {
  if (phase === "laedt") {
    return "laedt";
  }
  if (phase === "unerreichbar") {
    return "unerreichbar";
  }
  // Nutzbarkeit JE AUFGABE — exakt die Ableitung, die auch die Knöpfe in der Anwendung ausgraut.
  if (!deriveAiAvailable(status, KLARA_AI_TASK)) {
    return "keine";
  }
  // Betriebsart aus derselben öffentlichen Ableitung wie AiModelInfo (ohne Modellname).
  const mode = aiTaskInfoPublic(status).mode;
  if (mode === "cloud") {
    return "extern";
  }
  if (mode === "local") {
    return "intern";
  }
  return "keine";
}

// ================================================================================================
// AUFTRAG-W1-VERTRAUENSKOPF-08 BLOCK A — DER PERMANENTE KOPF (BASIC-0).
// ================================================================================================
//
// WARUM UEBERHAUPT. `KW-S4-01 §2` verlangt, dass Klara den tatsaechlich wirksamen KI-Zustand
// „immer ganz oben im Kopf" zeigt. Die vorhandene Zeile sass IM Fragen-Reiter, UNTER dem
// Eingabefeld — und war im Erfassen-Reiter unsichtbar. Sie sagte das Richtige an der falschen
// Stelle und nur die halbe Zeit.
//
// WAS DIESE FUNKTION NICHT TUT. Sie leitet NICHTS ab. Der einzige Zustandsbesitzer bleibt
// `klaraAiLage` — dieselbe Funktion, die `AiModelInfo` in der Anwendung ueber `deriveAiAvailable`
// und `aiTaskInfoPublic` speist, gepinnt ueber den vollen Vertrags-Zustandsraum
// (tests/app/mega75-klara-ki-status.test.ts). Hier wird ihr Ergebnis nur in eine Kopf-Darstellung
// uebersetzt. Deshalb steht dieser Block AUSSERHALB der mega75-Schnittmarken: er darf den dort
// gepinnten Zustandsraum weder erweitern noch verengen.
//
// KW-W1-13 (BASIC-0-Dateigrenze): Modus, Provider, Modell, Admin-Vorgabe, Abweichung,
// `resolutionId`, Sitzung und Consent gehoeren zu BASIC-1 und existieren heute in KEINER Zeile
// Produktcode. Sie werden hier NICHT erfunden. `detailKeys` ist die dafuer vorgesehene, heute
// bewusst LEERE Erweiterungsstelle — BASIC-1 fuellt sie, statt einen zweiten Kopf zu bauen.
export type KlaraTrustTone = "neutral" | "ok" | "warn";

export interface KlaraTrustHead {
  // Der Zustand, unveraendert von `klaraAiLage` — EIN Besitzer, keine zweite Wahrheit.
  lage: KlaraAiLage;
  // Kurzetikett der Zustandspille. Traegt den Zustand als TEXT; die Farbe ist nur eine zweite,
  // redundante Spur (Anforderung: „Inhalt nicht nur farblich kodieren").
  modeKey: string;
  // Der ausfuehrliche, bereits bestehende und dreisprachig gepinnte Satz.
  detailKey: string;
  tone: KlaraTrustTone;
  // BASIC-1-Erweiterungsstelle. Heute leer — und zwar nicht aus Versehen: es gibt keine
  // Vertragsdaten, aus denen sie zu fuellen waere.
  detailKeys: readonly string[];
}

function klaraTrustKey(prefix: string, lage: KlaraAiLage): string {
  return `${prefix}${lage.charAt(0).toUpperCase()}${lage.slice(1)}`;
}

export function klaraTrustHead(
  phase: KlaraAiPhase,
  status: ReasonerStatus | undefined,
): KlaraTrustHead {
  const lage = klaraAiLage(phase, status);
  // Der Ton sagt „ist der Stand BEKANNT?" — NICHT „ist er gut?". `extern` ist deshalb `ok`: die
  // Auskunft steht, und ob eine externe KI im Haus arbeitet, ist eine Tatsache und kein Mangel.
  // Ein Ladezustand ist kein Befund (`neutral`), und „nicht erreichbar" ist keine
  // Verfuegbarkeitsaussage (`warn`) — genau der A22-Fehler, den mega75 geschlossen hat.
  const tone: KlaraTrustTone =
    lage === "laedt" ? "neutral" : lage === "unerreichbar" ? "warn" : "ok";
  return {
    lage,
    modeKey: klaraTrustKey("trustMode", lage),
    detailKey: klaraTrustKey("aiLage", lage),
    tone,
    detailKeys: [],
  };
}
