// ================================================================================================
// JOB 3062 · H3 · R7 — DAS HILFEREGISTER DES BLATTES: JEDE Hilfe der drei alten Flächen.
// ================================================================================================
//
// BENS BEFUND ZUR RUNDE 6, und er ist berechtigt: Das „?"-Menü rendert bis R6 nur
// `CAPTURE_HELP_TOPICS` (`lib/captureHelp.ts`, 23 Themen). Am Basisstand 237b44c stehen in
// `pages/Capture.tsx` aber 32 und in `pages/CaptureFrontDoor.tsx` 8 `HelpTip`-Aufrufe — und acht
// davon holen ihren Text NICHT über `chelp(id)`, sondern nennen ihre i18n-Schlüssel unmittelbar.
// Genau die fielen durch: `capture.help.category.*` („Kategorie & #Tags") stand nach dem Umbau
// nirgends mehr. Auftrag §5a lässt keine Zeile „entfällt" zu; das gilt auch für einen Hilfetext.
//
// WARUM DIESE LISTE HIER LIEGT UND NICHT IN `lib/captureHelp.ts`: Jene Datei ist die Hilfekarte des
// ERFASSUNGSWEGES und wird von den alten Flächen mitbenutzt; sie liegt ausserdem nicht in den
// ZIELPFADEN dieses Auftrags. Diese Datei ist das Register der EINEN Hilfefläche des Blattes: sie
// nimmt die Hilfekarte, wie sie ist, und ergänzt sie um die Themen, die ihre Schlüssel selbst
// mitbringen. Ein neuer Eintrag in `captureHelp.ts` erscheint hier weiterhin ohne Nacharbeit.
//
// KEIN ZWEITER TEXTBESTAND: Alle Schlüssel kommen entweder aus der Hilfekarte oder aus den
// Copy-Konstanten, in denen sie ohnehin schon stehen (`CAPTURE_FILE_TEXT`, `CAPTURE_WIZARD_TEXT`,
// `EDITOR_DROP_KEYS`). Nur die vier Schlüsselpaare, die am Basisstand als Zeichenkette im JSX
// standen (`conf.field`/`conf.help`, `capture.help.category.*`, `capture.help.validations.*`,
// `capture.reviewers.help*`), stehen auch hier als Zeichenkette — an EINEM Ort statt an fünf.
//
// Der Nachweis ist `tests/design/h3-funktionsinventar.test.ts` (Fall „Hilfe-Tipps"): Er hält die
// Kennungen des BASISSTANDES als eigene Liste und sucht jeden Titel und jeden Text im geöffneten
// „?"-Menü der gebauten Seite. Eine Mindestanzahl genügt dort ausdrücklich nicht mehr.
import {
  ASSIST_ACTIONS,
  assistActionHelpKey,
  assistActionLabelKey,
} from "../../lib/captureAiAssist";
import { CAPTURE_FILE_TEXT } from "../../lib/captureFromFile";
import { CAPTURE_HELP_TOPICS } from "../../lib/captureHelp";
import { CAPTURE_WIZARD_TEXT } from "../../lib/captureWizard";
import { EDITOR_DROP_KEYS } from "../../lib/editorDropPaste";

export interface HilfeThema {
  /** Stabile Kennung — sie wird zum Testanker `blatt-hilfe-<id>`. */
  readonly id: string;
  readonly titleKey: string;
  readonly bodyKey: string;
}

/**
 * Die Themen, die ihre Schlüssel selbst mitbringen statt aus der Hilfekarte zu kommen — jedes mit
 * der Fundstelle, an der es steht. Die Reihenfolge ist die des alten Weges: erst das Blatt selbst
 * (Bilder, Vertraulichkeit), dann die Erfassungsformulare, zuletzt der Dateiweg. Seit JOB 3880
 * folgen die fünf KI-Werksaktionen — sie trugen ihren Schlüssel am Basisstand NICHT am `HelpTip`
 * des Blattes (genau das war der Befund von JOB 3831), bringen ihn aber ebenso selbst mit.
 */
const EIGENE_SCHLUESSEL: readonly HilfeThema[] = [
  // Der Ablagehinweis des Editors (Fussleiste des `RichTextEditor`, JOB 2610 D3). Bewusst der
  // „ImagesOnly"-Schlüssel: das Blatt reicht dem Editor keinen Dateiweg herein (kein `onFiles`),
  // der Satz über Dateien wäre hier unwahr.
  { id: "ablage", titleKey: "erfassen.hilfe.bilder", bodyKey: EDITOR_DROP_KEYS.hintImagesOnly },
  // CaptureFrontDoor.tsx:1138 — `<HelpTip title={t("conf.field")} body={t("conf.help")} />`.
  { id: "vertraulichkeit", titleKey: "conf.field", bodyKey: "conf.help" },
  // Capture.tsx:5018 — die Hilfe, deren Verlust ben gemessen hat.
  {
    id: "kategorie",
    titleKey: "capture.help.category.title",
    bodyKey: "capture.help.category.body",
  },
  // Capture.tsx:5031
  {
    id: "validierungen",
    titleKey: "capture.help.validations.title",
    bodyKey: "capture.help.validations.body",
  },
  // Capture.tsx:5108
  { id: "pruefer", titleKey: "capture.reviewers.helpTitle", bodyKey: "capture.reviewers.helpBody" },
  // Capture.tsx:6043 (Expertenformular: Kernaussage, Bedingungen & Massnahmen)
  {
    id: "kernaussage",
    titleKey: CAPTURE_WIZARD_TEXT.structData,
    bodyKey: CAPTURE_WIZARD_TEXT.condMeasuresHint,
  },
  // Capture.tsx:6089 (Expertenformular: Hilfen, Vorlagen & Anhänge-Kontext)
  {
    id: "hilfen",
    titleKey: CAPTURE_WIZARD_TEXT.helpers,
    bodyKey: CAPTURE_WIZARD_TEXT.helpersHint,
  },
  // Capture.tsx:4676 (Dateiweg: gezielt suchen)
  {
    id: "dateisuche",
    titleKey: CAPTURE_FILE_TEXT.queryHelpTitle,
    bodyKey: CAPTURE_FILE_TEXT.queryHelpBody,
  },
  // Capture.tsx:4690 (Dateiweg: Ergebnis-Sprache)
  {
    id: "dateisprache",
    titleKey: CAPTURE_FILE_TEXT.langHelpTitle,
    bodyKey: CAPTURE_FILE_TEXT.langHelpBody,
  },
  // ==============================================================================================
  // JOB 3880 — DIE FÜNF KI-WERKSAKTIONEN (`lib/captureAiAssist.ts:11-17`, SCRUM-404).
  // ==============================================================================================
  // Zu jeder Werksaktion der KI-Palette gibt es seit SCRUM-404 einen Erklärsatz
  // (`assistActionHelpKey`, `captureAiAssist.ts:30-34`: „für das ?-HelpTip am Button, damit klar
  // ist, was die jeweilige KI-Aktion tut, BEVOR man sie auslöst"). JOB 3831 hat gemessen, dass er
  // auf dem Blatt niemanden erreicht: „auf dem Erfassungsblatt steht keiner der fünf Sätze in der
  // gezeichneten Zahnrad-Liste, in keinem Zustand der Palette" (`jobs/3831/runde-1/RUECKGABE.md:2`;
  // Prüfstand `tests/ki-werksaktionen-hilfe/werksaktionen-erklaersatz.test.tsx`). Grund: das Blatt
  // zeichnet die fünf Knöpfe selbst als `MenueEintrag` (`Blatt.tsx:2141-2152`), ohne `HelpTip` —
  // anders als `AiAssistBox.tsx:117` an den übrigen Flächen.
  //
  // ABGELEITET, NICHT ABGESCHRIEBEN: Die Einträge entstehen aus `ASSIST_ACTIONS` selbst. Eine hier
  // getippte Fünferliste wäre ein zweiter Bestand neben der Palette und schwiege, sobald eine
  // sechste Werksaktion dazukäme; die Palette zeigte sechs Knöpfe, die Seitenhilfe erklärte fünf.
  // Der Wächter dazu ist W5 in `tests/ki-werksaktionen-hilfe/werksaktionen-erklaersatz.test.tsx`.
  ...ASSIST_ACTIONS.map((aktion) => ({
    id: `ki-${aktion}`,
    titleKey: assistActionLabelKey(aktion),
    bodyKey: assistActionHelpKey(aktion),
  })),
];

/**
 * ALLE Hilfen des Blattes an EINEM Ort — die Hilfekarte des Erfassungsweges plus die Themen, die
 * ihre Schlüssel selbst mitbringen. Doppelte Kennungen kann es nicht geben: die Hilfekarte
 * führt ihren eigenen Namensraum (`chelp.<id>.*`), diese Liste ihren (seit JOB 3880 zusätzlich
 * `ki-<aktion>`); W5 im Prüfstand der KI-Werksaktionen misst das nach.
 */
export const BLATT_HILFE_THEMEN: readonly HilfeThema[] = [
  ...EIGENE_SCHLUESSEL,
  ...CAPTURE_HELP_TOPICS,
];
