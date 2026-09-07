// AUFTRAG-ic7-import-vision: EHRLICHE Quellen-Galerie „wo die Reise hingeht". REINES Datenmodell
// (DOM-frei, deterministisch) fuer die Systeme- und Datei-Galerie der Import-Ansicht.
//
// GRUNDSATZ (Ehrlichkeit vor Optik): jede Quelle traegt einen EHRLICHEN Zustand.
//  - "active"       → real nutzbar; loest ueber onActivate den echten, bereits existierenden Fluss aus.
//  - "elsewhere"    → auf DIESER Flaeche nicht, aber woanders im Produkt wirklich einlesbar. Kein
//                     Import hier — ein echter Weg dorthin (JOB 3190, siehe unten).
//  - "unconfigured" → GEBAUT, aber ohne hinterlegten Dienst nicht nutzbar. Kein Import.
//  - "soon"         → in Arbeit; darf NIE einen Import starten (nur ein ehrlicher Hinweis).
//  - "planned"      → Vision, noch nicht begonnen; ebenfalls kein Import, nur Aufklaerung.
//
// JOB 3190 (UX-18) — WELCHE WAHRHEIT GEMESSEN WIRD UND WELCHE VON HAND STEHT.
// GEMESSEN wird jeder Zustand, den die ECHTE Importweiche des Erfassens beantworten kann: hat die
// Kachel einen Importweg (`accept !== null`) und faellt ihr Sample ueber `detectFileKind` auf eine
// unterstuetzte Art, dann ist dieser Typ wirklich einlesbar — im Erfassen als "active", auf der
// Import-Flaeche als "elsewhere". VON HAND steht nur, was die Weiche grundsaetzlich nicht messen
// kann: die ausdrueckliche Aktiv-Zusage der Import-Flaeche fuer JSON (dort laeuft der eine echte
// Upload dieser Seite), der echte Planwert fuer Excel (kein Extraktionsweg) und `fixedState` fuer
// das Audio-/Video-Transkript (gebaut, aber ohne Dienst). Alles andere von Hand zu setzen hiesse,
// eine zweite Wahrheit neben die messbare zu stellen — genau der Fehler, den UX-18 abgeloest hat.
//
// AUFTRAG-mega15 Block D (SCRUM-382, Pedis Entscheidung): „unconfigured" ist wegen des
// Audio-/Video-Transkripts dazugekommen. Die Kachel sagte „geplant" — das war schlicht falsch: das
// Transkriptionsmodul ist gebaut und verdrahtet (`services/media/`, `POST /api/media/analyze`),
// nur der Dienst ist nicht konfiguriert. „Geplant" und „nicht konfiguriert" sind zwei verschiedene
// Wahrheiten, und die Kachel muss die zutreffende sagen. Kein eigener Einstieg jetzt: die
// VERDRAHTUNG bleibt unveraendert (accept === null, kein Handler, kein neuer Fluss).
// Die Galerie-Komponente ruft onActivate AUSSCHLIESSLICH fuer "active"; "soon"/"planned" zeigen
// einen ruhigen, nicht-modalen Hinweis. Kein neuer Egress-Pfad, kein Konnektor-Aufruf an geplante
// Systeme — das steckt bewusst NICHT in diesem Modell.

import { type FileKind, detectFileKind } from "./extract";

export type SourceState = "active" | "elsewhere" | "unconfigured" | "soon" | "planned";

export interface GallerySource {
  /** Stabile ID — steuert bei "active" den echten Fluss (Argument von onActivate). */
  readonly id: string;
  /** i18n-Schluessel des Anzeigenamens (keine hartcodierten Strings im JSX). */
  readonly labelKey: string;
  readonly state: SourceState;
}

// Reihenfolge der Zustaende: aktiv zuerst, dann anderswo verfuegbar, dann vorhanden-aber-
// unkonfiguriert, dann bald, dann geplant. JOB 3190: "elsewhere" steht direkt hinter "active" und
// vor "unconfigured", weil es die staerkste Aussage nach "hier nutzbar" ist — die Faehigkeit
// existiert und ist von hier aus in einem Schritt erreichbar.
const STATE_RANK: Record<SourceState, number> = {
  active: 0,
  elsewhere: 1,
  unconfigured: 2,
  soon: 3,
  planned: 4,
};

/**
 * Stabile Sortierung aktiv→bald→geplant. Innerhalb eines Zustands bleibt die Eingabereihenfolge
 * erhalten (stabiler Vergleich ueber den Original-Index).
 */
export function orderByState(sources: readonly GallerySource[]): GallerySource[] {
  return sources
    .map((source, index) => ({ source, index }))
    .sort((a, b) => STATE_RANK[a.source.state] - STATE_RANK[b.source.state] || a.index - b.index)
    .map(({ source }) => source);
}

/** Badge-Text je Zustand — IMMER Text (nicht nur Farbe), fuer Barrierefreiheit. */
export const STATE_BADGE_KEY: Record<SourceState, string> = {
  active: "imp.explore.active",
  // JOB 3190: das Badge sagt BEIDES in zwei Woertern — dass es die Funktion gibt und wo sie liegt.
  elsewhere: "imp.gallery.elsewhere",
  unconfigured: "imp.gallery.unconfigured",
  soon: "imp.explore.soon",
  planned: "imp.gallery.planned",
};

/** Ehrlicher Klick-Hinweis je nicht-aktivem Zustand (kein Import, nur Aufklaerung). */
export const STATE_HINT_KEY: Record<Exclude<SourceState, "active">, string> = {
  // JOB 3190: der ausgeschriebene Satz zum Badge — er nennt den Weg beim Namen. Auf `/import` ist
  // die Kachel selbst der Weg (ein Link); wo kein Link angeboten wird, bleibt dieser Satz die
  // Auskunft. Ein Text, zwei Tueren — keine zweite Wahrheit.
  elsewhere: "imp.gallery.hintElsewhere",
  unconfigured: "imp.gallery.hintUnconfigured",
  soon: "imp.gallery.hintSoon",
  planned: "imp.gallery.hintPlanned",
};

/** i18n-Schluessel des ehrlichen Hinweises fuer einen Zustand; null fuer "active" (kein Hinweis). */
export function hintKeyFor(state: SourceState): string | null {
  return state === "active" ? null : STATE_HINT_KEY[state];
}

// ================================================================================================
// JOB 3190 · RUNDE 2 — DIE RESTSCHRITTE STEHEN SICHTBAR AN DER KACHEL, NICHT NUR IM `title`.
// ================================================================================================
//
// GEMESSEN (Ben, Runde 1, Chromium): nach Tab+Enter auf der Word-Kachel steht der Browser wirklich
// auf `/erfassen` — aber der Dateiimport ist dort noch NICHT offen (`capture-file-pick` fehlt;
// sein Befund: `{"dateiauswahl":false,"dateieingang":true,"dateiwerkzeug":true}`). Er liegt hinter
// dem Werkzeug „Datei" und dessen Eintrag „Datei importieren".
//
// Solange diese zwei Schritte bleiben, darf die Kachel sie nicht verschweigen. Sie standen bis
// hierher nur im `title` des Links — also nur fuer die Maus und nur beim Verweilen. Jetzt stehen
// sie SICHTBAR auf der Kachel, in genau dem Wortlaut, den die Zielflaeche traegt
// (`erfassen.werkzeug.datei` → `erfassen.weg.datei`); `tests/import-einstieg/weg-ins-erfassen.test.tsx`
// laeuft genau diese angesagten Schritte ab und misst am gemounteten Baum, dass sie hinfuehren.
//
// KEIN ERSATZ FUER DEN EINEN SCHRITT, sondern die ehrliche Ansage des heutigen Wegs: der Deep-Link,
// der den Dateiimport in EINEM Schritt oeffnen wuerde, braucht `components/erfassen/Blatt.tsx`
// (`ansicht` liest dort keinen Parameter) — kein Zielpfad dieses Auftrags, siehe RUECKGABE.
const STATE_STEPS_KEY: Partial<Record<SourceState, string>> = {
  elsewhere: "imp.gallery.elsewhereSteps",
};

/** Sichtbare Restschritte auf der Zielflaeche; null, wo der Zustand keine kostet. */
export function stepsKeyFor(state: SourceState): string | null {
  return STATE_STEPS_KEY[state] ?? null;
}

// Geteilte ID des bestehenden JSON-Datei-Dialogs — die aktive JSON-Kachel oeffnet genau diesen
// (den echten, bereits existierenden Upload) statt einen neuen Pfad zu erfinden.
export const JSON_UPLOAD_INPUT_ID = "imp-json-upload-input";

// IDs der aktiven JSON-Kacheln (Systeme + Dateien) — beide zeigen auf denselben echten Upload.
export const JSON_SOURCE_IDS = ["json", "json-file"] as const;

// PAKET 1 — Systeme. aktiv: Confluence · JSON-Import (bestehend). bald: Jira · Word · PDF.
// geplant: SharePoint · MS Teams · Google Drive · DMS · PLM · ServiceNow · SAP · Notion · Slack · E-Mail.
export const SYSTEM_SOURCES: readonly GallerySource[] = orderByState([
  { id: "confluence", labelKey: "imp.gallery.src.confluence", state: "active" },
  { id: "json", labelKey: "imp.gallery.src.jsonImport", state: "active" },
  { id: "jira", labelKey: "imp.gallery.src.jira", state: "soon" },
  { id: "word-sys", labelKey: "imp.gallery.src.wordFile", state: "soon" },
  { id: "pdf-sys", labelKey: "imp.gallery.src.pdfFile", state: "soon" },
  { id: "sharepoint", labelKey: "imp.gallery.src.sharepoint", state: "planned" },
  { id: "teams", labelKey: "imp.gallery.src.teams", state: "planned" },
  { id: "gdrive", labelKey: "imp.gallery.src.gdrive", state: "planned" },
  { id: "dms", labelKey: "imp.gallery.src.dms", state: "planned" },
  { id: "plm", labelKey: "imp.gallery.src.plm", state: "planned" },
  { id: "servicenow", labelKey: "imp.gallery.src.servicenow", state: "planned" },
  { id: "sap", labelKey: "imp.gallery.src.sap", state: "planned" },
  { id: "notion", labelKey: "imp.gallery.src.notion", state: "planned" },
  { id: "slack", labelKey: "imp.gallery.src.slack", state: "planned" },
  { id: "email", labelKey: "imp.gallery.src.email", state: "planned" },
]);

// AUFTRAG-uxpol2 (bens Blocker 2.1/2.2): EINE belastbare, pro Oberfläche ableitbare Dateityp-
// Capability. Je Datei-Kachel ein TYPGERECHTES `accept` (die Union der aktiven ist genau der reale
// Dokument-Import-Dialog) und ein REPRÄSENTATIVES Sample, dessen Fähigkeit die ECHTE Importweiche
// `detectFileKind` (Erfassen: onExtractFile) bestimmt — kein blindes Hartkodieren des Zustands.
// `accept: null` = kein echter Importweg (die Kachel öffnet nie einen Dialog).
interface FileSourceDef {
  readonly id: string;
  readonly labelKey: string;
  readonly accept: string | null;
  // Repräsentative Datei, an der detectFileKind die reale Erfassen-Fähigkeit misst.
  readonly sample: { name: string; type?: string };
  // AUFTRAG-mega15 Block D (SCRUM-382): fester, auf BEIDEN Oberflächen geltender Zustand für
  // Kacheln, deren Wahrheit die Text-Extraktionsweiche gar nicht messen kann. Die Weiche kennt nur
  // „extrahiert diese Oberfläche Text daraus" — sie kann nicht zwischen „nie gebaut" und „gebaut,
  // aber kein Dienst hinterlegt" unterscheiden. Ohne diese Ausnahme müsste die Kachel weiter eine
  // der beiden Wahrheiten falsch behaupten.
  readonly fixedState?: SourceState;
}

// Typgerechte accept-Fragmente — je Fragment genau EIN Format-Cluster. Die Union der aktiven Kacheln
// deckt exakt die von detectFileKind unterstützten Formate ab (JSON/Text/DOCX/PDF/PPTX/Bild) — so ist
// kein als „geplant" markiertes Format über einen breiten Dialog erreichbar (JSON-Seam geschlossen).
const ACCEPT_JSON = ".json,application/json";
const ACCEPT_TEXT = ".txt,.md,.markdown,.csv,.log";
const ACCEPT_DOCX = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPT_PDF = ".pdf,application/pdf";
const ACCEPT_PPTX =
  ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const ACCEPT_IMAGE = "image/*";

const FILE_SOURCE_DEFS: readonly FileSourceDef[] = [
  {
    id: "json-file",
    labelKey: "imp.gallery.file.json",
    accept: ACCEPT_JSON,
    sample: { name: "a.json" },
  },
  { id: "csv", labelKey: "imp.gallery.file.csv", accept: ACCEPT_TEXT, sample: { name: "a.csv" } },
  {
    id: "docx",
    labelKey: "imp.gallery.file.docx",
    accept: ACCEPT_DOCX,
    sample: { name: "a.docx" },
  },
  { id: "pdf", labelKey: "imp.gallery.file.pdf", accept: ACCEPT_PDF, sample: { name: "a.pdf" } },
  {
    id: "pptx",
    labelKey: "imp.gallery.file.pptx",
    accept: ACCEPT_PPTX,
    sample: { name: "a.pptx" },
  },
  {
    id: "ocr",
    labelKey: "imp.gallery.file.ocr",
    accept: ACCEPT_IMAGE,
    sample: { name: "a.png", type: "image/png" },
  },
  // Wirklich (noch) fehlend: Excel — kein Extraktionsweg → kein Dialog, ehrlich geplant.
  //
  // AUFTRAG-mega14 Block G / mega15 Block D (SCRUM-382) — der Befund und Pedis Entscheidung:
  // Für Audio/Video stimmt „kein Extraktionsweg" NICHT. Das Transkriptionsmodul (`services/media/`)
  // ist gebaut, verdrahtet (`build-app.ts`, `POST /api/media/analyze`) und im Erfassen über einen
  // echten „Transkribieren"-Knopf erreichbar (`Capture.tsx`, Karte „Dokumente" unter „Erweiterte
  // Details"). Die Kachel sagte trotzdem „geplant" — genau der Satz aus dem Live-Test, und falsch.
  //
  // Entschieden (Pedi): KEIN eigener Einstieg jetzt, aber die Falschaussage verschwindet. Die
  // Kachel traegt den Zustand `unconfigured` — vorhanden, aber ohne hinterlegten Dienst nicht
  // nutzbar. Kein Umhaengen auf ein anderes Eingabefeld, kein neuer Handler: `accept` bleibt null,
  // die Galerie oeffnet fuer diese Kachel weiterhin keinen Dialog.
  //
  // Excel bleibt „geplant": dort gibt es wirklich keinen Extraktionsweg.
  { id: "xlsx", labelKey: "imp.gallery.file.xlsx", accept: null, sample: { name: "a.xlsx" } },
  {
    id: "avtranscript",
    labelKey: "imp.gallery.file.avtranscript",
    // Unveraendert null: diese Kachel oeffnet KEINEN Dialog und haengt an KEINEM Handler. Nur die
    // Aussage wird richtig — der Weg bleibt genau, wie er ist (Pedis Entscheidung zu SCRUM-382).
    accept: null,
    sample: { name: "a.mp4", type: "video/mp4" },
    fixedState: "unconfigured",
  },
];

export type ImportSurface = "capture" | "import";

// ================================================================================================
// JOB 3190 (UX-18) — DIE HANDTABELLE IST AUF DAS GESCHRUMPFT, WAS DIE WEICHE NICHT MESSEN KANN.
// ================================================================================================
//
// VORHER standen hier sieben Eintraege, darunter `docx: "soon"` und `pdf: "soon"`. Das war die
// zweite Wahrheit: die Weiche misst fuer beide „einlesbar", der Dateidialog des Erfassens traegt
// `.docx` und `.pdf` ausdruecklich (`captureFromFile.ts:64-65`) — und die Fläche, auf der jemand
// nach dem Weg sucht, sagte „bald". Wer das las, hielt die Funktion fuer nicht gebaut.
//
// GEBLIEBEN sind genau zwei Eintraege, und beide sind Aussagen, die aus der Weiche nicht folgen:
//   · `json-file: "active"` — die ausdrueckliche Zusage DIESER Flaeche. Auf `/import` laeuft ein
//     echter JSON-Upload; die Weiche wuesste davon nichts (sie kennt nur „extrahiert Text").
//   · `xlsx: "planned"`     — der echte Planwert. Excel hat keinen Extraktionsweg (`accept: null`),
//     die Weiche gaebe also ohnehin „nicht einlesbar" — der Eintrag steht hier trotzdem, weil
//     „geplant" die staerkere, ausdrueckliche Aussage ist und nicht der Rueckfall sein soll.
// `avtranscript` steht bewusst NICHT hier: sein Zustand ist auf beiden Oberflaechen derselbe und
// kommt aus `fixedState` (SCRUM-382).
//
// Alles Uebrige leitet `fileSourcesForSurface` unten aus derselben Weiche ab, die das Erfassen
// benutzt. Wer hier wieder einen messbaren Typ von Hand eintraegt, macht
// `tests/import-einstieg/weiche-statt-handtisch.test.ts` rot.
const IMPORT_FILE_STATE: Record<string, SourceState> = {
  "json-file": "active",
  xlsx: "planned",
};

// Erfassen: eine Kachel ist AKTIV, wenn ihr Sample über die ECHTE Weiche detectFileKind (die
// onExtractFile nutzt) auf einen unterstützten FileKind fällt UND ein Importweg (accept) existiert.
function captureSupports(def: FileSourceDef): boolean {
  if (def.accept === null) {
    return false;
  }
  const kind: FileKind = detectFileKind(def.sample);
  return kind !== "unsupported";
}

/**
 * Der Zustand EINER Kachel auf der Import-Flaeche.
 *
 * JOB 3190: Ableitung statt Handtisch. Die ausdrueckliche Handaussage gewinnt (JSON aktiv, Excel
 * geplant); fuer alles andere fragt diese Flaeche DIESELBE Weiche wie das Erfassen — kann das
 * Erfassen die Datei wirklich einlesen, heisst die Kachel `elsewhere` („gibt es, nur nicht hier"),
 * sonst bleibt sie ehrlich `planned`.
 */
function importState(def: FileSourceDef): SourceState {
  const vonHand = IMPORT_FILE_STATE[def.id];
  if (vonHand !== undefined) {
    return vonHand;
  }
  return captureSupports(def) ? "elsewhere" : "planned";
}

// Die Datei-Galerie EINER Oberfläche — Zustand pro Oberfläche aus derselben Weiche abgeleitet
// (Erfassen: hier nutzbar → „aktiv"; Import-Review: dort nutzbar → „anderswo"), Reihenfolge
// aktiv→anderswo→nicht konfiguriert→bald→geplant.
export function fileSourcesForSurface(surface: ImportSurface): GallerySource[] {
  return orderByState(
    FILE_SOURCE_DEFS.map((def) => ({
      id: def.id,
      labelKey: def.labelKey,
      state:
        def.fixedState ??
        (surface === "capture"
          ? captureSupports(def)
            ? ("active" as const)
            : ("planned" as const)
          : importState(def)),
    })),
  );
}

// Typgerechtes accept einer Datei-Kachel (null = kein echter Importweg → kein Dialog).
export function acceptForFileSource(id: string): string | null {
  return FILE_SOURCE_DEFS.find((def) => def.id === id)?.accept ?? null;
}

// Öffnet den BESTEHENDEN Datei-Dialog des Erfassen-Imports für eine aktive Kachel — mit einem
// `accept`, das GENAU zum angeklickten Typ passt (JSON-Seam geschlossen: nie ein Dialog, der ein als
// inaktiv markiertes Format zulässt). Kacheln ohne echten Importweg (accept === null) tun nichts.
// Rückgabe: true, wenn ein Dialog geöffnet wurde. Kein neuer Egress — es klickt nur den vorhandenen
// versteckten <input>.
export function openCaptureFileDialog(
  id: string,
  input: { accept: string; click: () => void } | null,
): boolean {
  const accept = acceptForFileSource(id);
  if (!accept || !input) {
    return false;
  }
  input.accept = accept;
  input.click();
  return true;
}

// PAKET 2 — Dateien der IC-7 Import-Review. JOB 3190: JSON aktiv (der echte Upload dieser Fläche);
// Word/PDF/PowerPoint/Text-CSV/OCR „anderswo verfügbar" (im Erfassen wirklich einlesbar);
// Transkript nicht konfiguriert; Excel geplant.
export const FILE_SOURCES: readonly GallerySource[] = fileSourcesForSurface("import");
