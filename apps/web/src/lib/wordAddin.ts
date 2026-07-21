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

export interface WordDraftBody {
  bodyHtml: string;
  usedHtml: boolean; // false = Klartext-Fallback (kein/leeres HTML oder Budget überschritten)
  overBudget: boolean; // true = HTML lag über dem Budget → Klartext-Fallback, ehrlich gemeldet
  undeliveredImages: number; // Bilder, die Word nicht als übernehmbare Daten geliefert hat
}

// EINE Entscheidungsstelle für den Draft-Body: Word-HTML wenn vorhanden und im Budget, sonst der
// Klartext-Fallback (Zeilen-Absätze) — nie stiller Verlust, die Zähler tragen die ehrliche Meldung.
export function prepareWordDraftBody(html: string, text: string): WordDraftBody {
  const inner = extractWordBodyHtml(html || "");
  const undeliveredImages = countUndeliveredWordImages(inner);
  if (inner.length === 0) {
    return {
      bodyHtml: selectionToBodyHtml(text),
      usedHtml: false,
      overBudget: false,
      undeliveredImages: 0,
    };
  }
  if (wordHtmlUtf8Bytes(inner) > WORD_ADDIN_BODY_BUDGET_BYTES) {
    return {
      bodyHtml: selectionToBodyHtml(text),
      usedHtml: false,
      overBudget: true,
      undeliveredImages,
    };
  }
  return { bodyHtml: inner, usedHtml: true, overBudget: false, undeliveredImages };
}
