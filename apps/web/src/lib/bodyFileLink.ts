// SCRUM-355 / FR-STR-02 / G-P1-1: DOM-freier Helfer, um eine Nicht-Bild-Datei als SICHEREN Link im
// ausführlichen Wissenstext (bodyHtml) zu referenzieren. KEINE Legacy-Data-URLs, KEINE breite
// Sanitizer-Allowlist: der Link zeigt ausschließlich auf den vorhandenen internen Object-Store-Raw-Pfad
// `/api/objects/:id/raw`. Der Dateiname wird sicher escapt. Reine String-/Daten-Logik — kein DOM, kein
// Upload, keine Validierung (die Datei-Referenz ist Evidence/Anhang, KEIN Status-/Trust-/Validierungs-
// Signal). Server- und FE-Sanitizer behalten genau die schmale `attachment`-Div-Klasse + sichere Links.

import { htmlToPlainText, isEmptyHtml } from "./richText";

// Object-Store-IDs sind Wort-/Bindestrich-Token; alles andere wird abgelehnt (kein Pfad-/Scheme-Trick).
const OBJECT_ID_RE = /^[\w-]+$/;

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Sicherer interner Raw-Pfad für ein Object-Store-Objekt, oder null bei ungültiger ID.
export function objectRawHref(objectId: string | null | undefined): string | null {
  const id = (objectId ?? "").trim();
  return OBJECT_ID_RE.test(id) ? `/api/objects/${id}/raw` : null;
}

export interface BodyFileInput {
  objectId?: string | null;
  name?: string | null;
}

// WP-HYG (bens P2-Hinweis aus D1e): DIE zentrale Object-Id-Längen-Reserve — sie lebt HIER, im
// Modul, das Object-Links besitzt, statt verstreut bei den Aufrufern. Reale Ids sind UUIDs
// (36 Zeichen, s. object-store/service.ts genId → randomUUID); 128 liegt weit darüber, sodass ein
// mit dieser Reserve gebauter Platzhalter-Link NIE kürzer ist als ein echter — Größen-Preflights
// mit reservedObjectLinkHtml sind damit beweisbar ausreichend.
export const OBJECT_LINK_ID_RESERVE_CHARS = 128;

// Platzhalter-Link mit reservierter Id-Länge — die EINE Quelle für alle Größen-Preflights
// (kein Aufrufer baut mehr eine eigene x-Repeat-Id).
export function reservedObjectLinkHtml(name: string): string {
  return fileLinkHtml({ objectId: "x".repeat(OBJECT_LINK_ID_RESERVE_CHARS), name });
}

// Sichere Body-Datei-Referenz: div.attachment > a(href=raw, title=name) > name. Leer, wenn keine
// gültige objectId vorliegt (kein Fake-Link). Nur sichere, vom Sanitizer erlaubte Attribute/Klassen.
export function fileLinkHtml(input: BodyFileInput): string {
  const href = objectRawHref(input.objectId);
  if (!href) {
    return "";
  }
  const name = (input.name ?? "").trim() || "Datei";
  const safeName = escapeText(name);
  return `<div class="attachment"><a href="${href}" title="${safeName}">${safeName}</a></div>`;
}

// Body-Datei-Referenz nicht-destruktiv anhängen; leerer Body → setzen; ohne gültige objectId = No-Op.
export function applyBodyFileLink(
  currentHtml: string | null | undefined,
  input: BodyFileInput,
): string {
  const next = fileLinkHtml(input);
  const base = currentHtml ?? "";
  if (next.length === 0) {
    return base;
  }
  return isEmptyHtml(base) ? next : base + next;
}

// ================================================================================================
// JOB 3474 · REVIEW26 — DIESES MODUL KONNTE SEINE EIGENE FORM SCHREIBEN, ABER NICHT LESEN.
// ================================================================================================
//
// DER BEFUND (`gespraech/advisor-freitag/NUTZERBEFUNDE-AN-CLAUDE-20260908.md:47-51`, Posten 4): am
// Kopf eines aus einer Datei erfassten Berichts stand „Anhänge · keine", während die funktionierende
// Original-DOCX erst nach dem langen Text verlinkt war.
//
// DIE GEMESSENE URSACHE: der Ganzdokument-Import legt das Original in den Object-Store und hängt es
// als Body-Datei-Referenz an den Entwurfstext (`pages/Capture.tsx:1336-1349`, `fileLinkHtml`) — ein
// `KoAttachment` entsteht dabei NICHT (`finalizeCaptureSubmit` bekommt sein `original` nur im
// Warteschlangen-Weg, `Capture.tsx:1810-1812`). Beide Kopfzähler der Lesefläche hängen aber an
// `ko.attachments` / `ko.sources`. Die Datei war deshalb am Kopf unsichtbar.
//
// WARUM DER LESEWEG HIER WOHNT UND NICHT IN EINEM ZWEITEN SCANNER: die Form gehört diesem Modul.
// Der einzige vorhandene bodyHtml-Leser ist `extractBodyImages` (`lib/bodyImages.ts:152`) — er sucht
// `figure`/`img`/`figcaption` über einen Tiefenzähler und liefert `BodyImage`; `div.attachment > a`
// kennt er nicht. Schreib- und Leseseite stehen jetzt nebeneinander und teilen dieselbe Strenge:
// akzeptiert wird ausschließlich, was `objectRawHref` selbst schreiben würde (Rundlauf-Prüfung
// unten). Ein Pfad-Trick (`/api/objects/../raw`) oder eine fremde Adresse ergibt NICHTS.
// DOM-frei wie der Rest der Datei: reine Zeichenarbeit, im Node-Tor prüfbar.
export interface BodyFileRef {
  objectId: string;
  name: string;
}

// Ein `div` unmittelbar gefolgt von einem `<a>…</a>` — die Form, die `fileLinkHtml` schreibt.
// Klasse und Adresse werden danach GEPRÜFT, nicht schon hier gefiltert: so bleibt die Regel an einer
// Stelle lesbar, und Attributreihenfolge/Anführungszeichen dürfen sich ändern (der Sanitizer baut
// Tags neu auf, `richText.ts`).
const BODY_FILE_BLOCK_RE = /<div\b([^>]*)>\s*<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

// ================================================================================================
// RUNDE 2 · BENS BEFUND — EIN `href=` IM TEXT EINES ANDEREN ATTRIBUTS WAR DIE ADRESSE.
// ================================================================================================
//
// HIER STAND EIN SUCHENDER ATTRIBUTLESER: `new RegExp("\\s" + name + "\\s*=\\s*(…)").exec(tag)`.
// Er sucht den Namen IRGENDWO im Tag und weiß nichts von Anführungszeichengrenzen. Bens Gegenprobe,
// nachgemessen und in R12/F-N5 festgehalten — sie überlebt auch `sanitizeHtml`, weil `title` am `<a>`
// ein erlaubtes Attribut mit freiem Text ist:
//
//     <a title="Hinweis href=/api/objects/fake/raw " href="https://fremd.example/x">Fremd.docx</a>
//
// Der alte Leser fand das `href=` IM `title` zuerst und lieferte `/api/objects/fake/raw`. Der Kopf
// behauptete daraufhin „Originaldatei · Fremd.docx" — eine Datei, die es nicht gibt, und ein Knopf,
// der ins Leere führt (das Sprungziel existiert nicht, `springeZurDatei` endet wirkungslos). Genau
// die Zusage „eine fremde `href` liefert NICHTS" war damit gebrochen.
//
// DIE ANTWORT IST NICHT EIN SCHÄRFERER SUCHAUSDRUCK, SONDERN EIN ANDERES VERFAHREN: die Attributliste
// wird EINMAL SEQUENTIELL von links nach rechts zerlegt. Ein zitierter Wert wird dabei VOLLSTÄNDIG
// verbraucht; was in ihm steht, kann baulich nie mehr als Attributname gelesen werden. Das ist der
// Unterschied zwischen „ich suche `href`" und „ich weiß, welches Zeichen zum Wert gehört".
//
// FAIL-CLOSED: stolpert die Zerlegung über etwas, das kein Attribut ist (unbalanciertes
// Anführungszeichen, exotischer Name), liefert sie `null` — und der ganze Block wird verworfen. Ein
// unlesbares Tag ergibt KEINE Datei, nie eine halb geratene. Echte Inhalte kostet das nichts: der
// Sanitizer lässt am `div` nur `class`, am `<a>` nur `href` und `title` durch (`richText.ts:59-60`,
// `:109-118`), und `fileLinkHtml` escapt `<`, `>`, `&` und `"` im Namen.
//
// (Der Attributleser der Bildergalerie, `bodyImages.ts:83`, trägt dieselbe Schwäche. Er ist hier
// KEIN Zielpfad und bleibt unangetastet — genannt, damit die Stelle nicht unbemerkt bleibt.)
const ATTRIBUT_RE = /([A-Za-z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/y;

function tagAttribute(attributListe: string): Map<string, string> | null {
  const attribute = new Map<string, string>();
  const leerraum = /\s*/y;
  const attribut = new RegExp(ATTRIBUT_RE.source, "y");
  let i = 0;
  while (i < attributListe.length) {
    leerraum.lastIndex = i;
    leerraum.exec(attributListe);
    i = leerraum.lastIndex;
    if (i >= attributListe.length) {
      break;
    }
    // Der Schrägstrich eines selbstschließenden Tags ist kein Attribut — aber NUR am Ende. Ein `/`
    // MITTEN in der Liste ist kein Tag-Abschluss, sondern ein Zeichen aus einem Wert, dessen
    // Anführungszeichen nicht aufgegangen ist; dort wird abgebrochen statt weitergeraten.
    if (attributListe[i] === "/") {
      if (i === attributListe.length - 1) {
        break;
      }
      return null;
    }
    attribut.lastIndex = i;
    const m = attribut.exec(attributListe);
    if (!m) {
      return null; // fail-closed: hier steht kein Attribut, also ist das Tag unlesbar
    }
    const name = (m[1] ?? "").toLowerCase();
    // Erstes Vorkommen gilt — dieselbe Regel wie im DOM, wo ein doppeltes Attribut ignoriert wird.
    if (!attribute.has(name)) {
      attribute.set(name, m[2] ?? m[3] ?? m[4] ?? "");
    }
    i = attribut.lastIndex;
  }
  return attribute;
}

// Die Gegenrichtung zu `escapeText` ist NICHT selbstgebaut: `htmlToPlainText` ist die kanonische
// Reduktion dieses Hauses (`richText.ts:450`, Server-Zwilling `services/structure/src/sanitize.ts`),
// und `mega85` erhebt jede zweite Rohreduktion als Befund. Sie leistet genau das Nötige in EINEM
// Durchlauf: Inline-Auszeichnung verschwindet spurlos (kein Zwischenraum vor dem Satzzeichen — der
// mega84-Fehler), Entities werden einmal dekodiert (nie doppelt), Whitespace wird geglättet.

// Die Body-Datei-Referenzen eines Berichts LESEN, in der Reihenfolge ihres Auftretens.
export function bodyFileLinksFromHtml(bodyHtml: string | null | undefined): BodyFileRef[] {
  const out: BodyFileRef[] = [];
  if (!bodyHtml) {
    return out;
  }
  // Frische Regex je Aufruf (kein geteilter `lastIndex` über Aufrufe hinweg).
  const marken = new RegExp(BODY_FILE_BLOCK_RE.source, "gi");
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = marken.exec(bodyHtml)) !== null) {
    const divAttribute = tagAttribute(m[1] ?? "");
    const linkAttribute = tagAttribute(m[2] ?? "");
    if (!divAttribute || !linkAttribute) {
      continue; // unlesbares Tag → keine Datei (fail-closed, s. oben)
    }
    if (!(divAttribute.get("class") ?? "").split(/\s+/).includes("attachment")) {
      continue;
    }
    const href = (linkAttribute.get("href") ?? "").trim();
    // DIE STRENGE IST DIE DER SCHREIBSEITE, nicht eine zweite Auslegung: die Id wird nur dann
    // anerkannt, wenn `objectRawHref` aus ihr GENAU diese Adresse gebaut hätte.
    const id = href.slice("/api/objects/".length, -"/raw".length);
    if (objectRawHref(id) !== href) {
      continue;
    }
    const name =
      htmlToPlainText(m[3] ?? "") || htmlToPlainText(linkAttribute.get("title") ?? "") || "Datei";
    out.push({ objectId: id, name });
  }
  return out;
}

export interface EditorFile {
  objectId: string;
  name: string;
  mime?: string | null;
}

interface AttachmentRecordLike {
  name?: string | null;
  mime?: string | null;
  objectId?: string | null;
}

function isImageMime(mime: string | null | undefined): boolean {
  return typeof mime === "string" && mime.toLowerCase().startsWith("image/");
}

// Aus KO-Attachments die im Body verlinkbaren Dateien ableiten: NICHT-Bild UND mit Object-Store-`objectId`.
// Bilder werden weiterhin über den Bild-Einfügen-Pfad eingebettet; Dateien ohne `objectId` (z. B. noch
// nicht hochgeladene Capture-Session-Dateien) sind bewusst NICHT verlinkbar (kein Fake-Link).
export function editorFilesFromAttachments(
  attachments: readonly AttachmentRecordLike[],
): EditorFile[] {
  const out: EditorFile[] = [];
  for (const a of attachments) {
    const id = (a.objectId ?? "").trim();
    if (id.length === 0 || isImageMime(a.mime) || !OBJECT_ID_RE.test(id)) {
      continue;
    }
    out.push({ objectId: id, name: (a.name ?? "").trim() || "Datei", mime: a.mime ?? null });
  }
  return out;
}
