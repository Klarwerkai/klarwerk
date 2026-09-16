// ================================================================================================
// JOB 4203 · D3 — DIE BEDIENSCHRITTE DES DURCHGÄNGIGEN WEGES. EINMAL, HIER.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie ist der Werkzeugkasten der vier Bedienwegnachweise dieses Ordners
// (PDF, PPTX, Markdown, Abweisung) — und sie baut KEINE zweite Bühne: sie benutzt die vorhandene
// H3-Bühne (`tests/design/h3-blatt-buehne.ts`, echte gebaute Seite in Chromium an der echten
// Fastify-App) und die vorhandenen Bedienschritte aus `tests/ux19-speichern-oeffnen-reload/
// ux19-buehne.ts`. Eine zweite Fassung derselben Handgriffe wäre eine zweite Auslegung derselben
// Regel; sie ist in diesem Haus die häufigste Ursache dafür, dass zwei Tests dasselbe behaupten und
// nur einer stimmt.
//
// ================================================================================================
// WAS HIER NEU HINZUKOMMT, UND WARUM ES HINZUKOMMEN MUSS: DIE SICHTBARE DATEIAUSWAHL.
// ================================================================================================
//
// `ux19-buehne.dateiWaehlen` setzt die Datei über den VERSTECKTEN `<input type=file>`
// (`DATEI_EINGANG`). Für den Zweck dieses Auftrags reicht das nicht: gefordert ist der Weg über den
// SICHTBAREN Knopf `capture-file-pick` (`CaptureFileImport.tsx:130-152`) — „nicht der versteckte
// Input, nicht `page.evaluate`". Der Unterschied ist keine Förmlichkeit. Der sichtbare Knopf ist
// genau die Stelle, an der die externe Auswertung zweimal hängen geblieben ist (die Begründung
// steht im Bauteil selbst, `CaptureFileImport.tsx:98-107`); ein Test, der ihn umgeht, kann über den
// Weg eines Menschen nichts sagen.
//
// Der Weg dorthin ist Playwrights Dateiwähler: ein ECHTER Zeigerklick auf den sichtbaren Knopf
// öffnet den Systemdialog, Playwright fängt ihn als `filechooser`-Ereignis ab, und die Datei wird
// IN DIESEN Dialog gelegt. Kommt der Klick nicht an — Knopf nicht sichtbar, verdeckt, gesperrt —,
// erscheint das Ereignis nie und der Schritt wird rot. Genau das soll er.
import type { Buffer } from "node:buffer";
import i18n from "../../apps/web/src/i18n";
import {
  CAPTURE_FILE_TEXT,
  type WholeDocumentSourceKind,
  wholeDocumentBodyHtml,
} from "../../apps/web/src/lib/captureFromFile";
import { STALE_BUNDLE_KEY } from "../../apps/web/src/lib/staleChunk";
import { fn } from "../design/h3-blatt-buehne";
import {
  type DateiAnlage,
  FALL_RAHMEN_MS,
  KLICK_KNOPF,
  SEITENTEXT,
  type SeiteMitDatei,
  WARTEBUDGET,
  aufFlaechensatzWarten,
  wartebudget,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";
import { REFERENZ, type Referenzart, referenzBytes } from "./referenzinhalt";

// ------------------------------------------------------------------------------------------------
// Die nachdeklarierte Playwright-Fähigkeit: der Dateiwähler.
// ------------------------------------------------------------------------------------------------

/** Der aufgefangene Systemdialog. Mehr wird davon nicht gebraucht. */
export interface Dateiwaehler {
  setFiles(dateien: readonly DateiAnlage[]): Promise<void>;
}

export type SeiteMitDialog = SeiteMitDatei & {
  waitForEvent(name: string, opts?: { timeout?: number }): Promise<Dateiwaehler>;
  /**
   * `ux19-buehne.Tastatur` deklariert nur `press`. Der Abweisungsfall braucht echtes TIPPEN: sein
   * Gegenstand ist ein Entwurf, den ein Mensch geschrieben hat — kein über `evaluate` gesetzter
   * Zustand. Dieselbe Nachdeklaration wie dort, nur um die eine fehlende Fähigkeit erweitert.
   */
  keyboard: { press(taste: string): Promise<void>; type(text: string): Promise<void> };
};

// ------------------------------------------------------------------------------------------------
// Budgets — abgeleitet, nicht geraten (dieselbe Doktrin wie `ux19-buehne.WARTEBUDGET`).
// ------------------------------------------------------------------------------------------------
//
// Die eigenen Schritte dieses Ordners kennt der `Warteschritt`-Typ der ux19-Bühne nicht; ihre
// Budgets werden deshalb HIER aus demselben Fallrahmen abgeleitet, mit denselben Teilern. Eine
// unmittelbare Zahl steht an keiner Stelle dieses Ordners.

/** Der Zeitrahmen jedes Falls — derselbe wie bei der geliehenen Bühne. */
export { FALL_RAHMEN_MS };

/** Öffnen des Systemdialogs und Setzen der Datei: derselbe Anteil wie „dateiWaehlen" (Rahmen/6). */
const DIALOG_BUDGET_MS = FALL_RAHMEN_MS / WARTEBUDGET.teiler.gross;

/** Ein Zeigerklick auf ein sichtbares Bedienelement (Rahmen/12) — derselbe Anteil wie `zeigerklick`. */
const KLICK_BUDGET_MS = FALL_RAHMEN_MS / WARTEBUDGET.teiler.zwischen;

// ------------------------------------------------------------------------------------------------
// Selektoren des Weges
// ------------------------------------------------------------------------------------------------

/** Der SICHTBARE Auswahlknopf — das Ziel des Weges „datei" (`CaptureFileImport.tsx:132`). */
export const SICHTBARE_DATEIAUSWAHL = '[data-testid="capture-file-pick"]';
/** Der Einreichen-Knopf des Blattes (`components/erfassen/Blatt.tsx:3042`). */
export const EINREICHEN_KNOPF = '[data-testid="blatt-einreichen"]';
/** Die Lagezeile des Blattes — nach dem Einreichen trägt sie den Link zum Wissenseintrag. */
export const BLATT_LAGE = '[data-testid="blatt-lage"]';

/**
 * ================================================================================================
 * RUNDE 2 — ALLE LIVE-REGIONEN DER SEITE, MIT IHREM TEXT.
 * ================================================================================================
 *
 * BEN hat in Runde 1 beanstandet, dass der Abweisungsfall seine Meldung im GESAMTSEITENTEXT suchte
 * („T6 sucht die Fehlermeldung im Seitentext statt in der Live-Region"). Ein Satz, der irgendwo auf
 * der Fläche steht, ist für eine Vorlesehilfe nicht da: sie sagt nur an, was in einer Live-Region
 * steht. Seine eigene Messung am gebauten Produkt: „BEN: Abweisung fehlt in allen Live-Regionen".
 *
 * Gelesen wird deshalb die MENGE der Live-Regionen, nicht ein bestimmter Selektor — so hängt die
 * Aussage an der Sache (wird angesagt) und nicht daran, wo das Produkt seine Region gerade baut.
 * `<output>` ist dabei eigenständig aufgeführt, weil es `role="status"` IMPLIZIT trägt
 * (`tests-smoke/a18-live-region-browser.spec.ts`, Fall P1) und im Markup kein Attribut zeigt.
 */
export const LIVE_REGIONEN_LESEN = `() => {
  const marken = '[role="status"],[role="alert"],[role="log"],[aria-live],output';
  return Array.prototype.map.call(document.querySelectorAll(marken), (el) => ({
    marke: el.tagName.toLowerCase()
      + (el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : '')
      + (el.getAttribute('aria-live') ? '[aria-live=' + el.getAttribute('aria-live') + ']' : '')
      + (el.getAttribute('data-testid') ? '[' + el.getAttribute('data-testid') + ']' : ''),
    text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
  }));
}`;

/** Der `href` der Verknüpfung in der Lagezeile — `/wissen/<id>` nach dem Einreichen. */
export const LAGE_WISSENSLINK = `() => {
  const lage = document.querySelector('[data-testid="blatt-lage"]');
  const a = lage ? lage.querySelector('a[href^="/wissen/"]') : null;
  return a ? a.getAttribute('href') : null;
}`;

/** Der sichtbare Text der Schreibfläche des Blattes — der übernommene Inhalt, wie er dasteht. */
export const BLATT_TEXT = `() => {
  const el = document.querySelector('[data-testid="blatt-text"]');
  return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '';
}`;

/**
 * RUNDE 2 — DIE QUELLENANZEIGE, GEZIELT STATT IM GESAMTTEXT.
 *
 * BEN zu Runde 1, Prüfpunkt 3: „Eine eigenständige Quellenanzeige ist durch die bloße
 * Dateinamensuche im gesamten Seitentext nicht isoliert nachgewiesen." Er hat recht: ein Dateiname
 * steht auf dieser Fläche an mehreren Stellen (Anhangzeile, Erfolgskasten, Titelvorschlag). Ein
 * Treffer im Gesamttext sagt deshalb nicht, dass die HERKUNFT angezeigt wird.
 *
 * Gelesen wird ab jetzt genau der Träger der Herkunft: der Quelle-Blockquote, den
 * `wholeDocumentBodyHtml` erzeugt (`captureFromFile.ts`, `<blockquote><p>Quelle: …`). `null` = es
 * gibt gar keinen — und darüber wird dann auch nichts behauptet.
 */
// ================================================================================================
// RUNDE 4 — DIE KALIBRIERUNG: LIEST DIE ABLESUNG WIRKLICH DIE SEITE, AUF DER SIE STEHT?
// ================================================================================================
//
// DER BEFUND, den der Prüfer gefunden hat und den kein grüner Lauf zeigen konnte: der Abschnitt
// „36-pruefliste" prüfte die Folgeüberschrift gegen `imEntwurf` — einen Flächentext, der ZWEI
// Seitenwechsel früher gelesen worden war. Der Fall war grün und hat über den Wissenseintrag nichts
// gesagt; BENs Gegenprobe (Überschrift dort aus dem DOM entfernt) blieb ebenfalls grün. Eine
// Zusicherung, die nach einem Seitenwechsel einen alten Wert befragt, ist keine Zusicherung.
//
// ZWEI GRIFFE STEHEN JETZT DAGEGEN, und der zweite ist dieser hier:
//   1. Jeder Abschnitt der Ketten kapselt seinen Lesewert in einem eigenen Block. Ein Zugriff über
//      den Seitenwechsel hinweg scheitert damit am COMPILER, nicht erst an einem Prüfer. Das gilt
//      für ALLE Abschnitte aller drei Ketten.
//   2. Die Ablesung AM WISSENSEINTRAG kalibriert sich selbst: der behauptete Inhalt wird auf der
//      Zielseite gezielt entfernt, und die Ablesung MUSS das merken. Erst danach wird er wieder-
//      hergestellt. Dieselbe Bauform wie der Deckel in `ux19` F4 („ERST DIE KALIBRIERUNG, sonst
//      wäre der Zeigerklick nur behauptet") — ein Nachweis über das Messmittel, nicht über den
//      Gegenstand.
//
// WO GENAU DIESER ZWEITE GRIFF STEHT, und nirgends sonst — drei Aufrufe, je einer am Wissens-
// eintrag, der Stelle des Befunds aus Runde 3:
//      `markdown-durchgaengig-chromium.test.ts` · `pdf-durchgaengig-chromium.test.ts` ·
//      `pptx-durchgaengig-chromium.test.ts`, jeweils im Abschnitt „36-pruefliste".
// Die Abschnitte 33 und 34 (Entwurf und Zustand nach dem Neuladen) haben KEINE Kalibrierung; dort
// trägt allein Griff 1. Wer hier „jede Ablesung nach einem Seitenwechsel" liest, liest zu viel.
//
// Geleert wird ausschliesslich der TEXTKNOTEN, und sein alter Wert wird gemerkt; die Fläche bleibt
// im Übrigen unangetastet und ist nach `TEXT_ZURUECK` Zeichen für Zeichen wieder die alte.

/** Leert den ersten Textknoten, der `marke` enthält, und merkt ihn für die Wiederherstellung. */
export const TEXT_AUSBLENDEN = `(marke) => {
  const gang = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let k = gang.nextNode(); k !== null; k = gang.nextNode()) {
    if ((k.nodeValue || '').indexOf(marke) !== -1) {
      window.__d3Kalibrierung = { knoten: k, wert: k.nodeValue };
      k.nodeValue = '';
      return true;
    }
  }
  return false;
}`;

/** Stellt den zuletzt geleerten Textknoten wieder her. */
export const TEXT_ZURUECK = `() => {
  const p = window.__d3Kalibrierung;
  if (!p) { return false; }
  p.knoten.nodeValue = p.wert;
  delete window.__d3Kalibrierung;
  return true;
}`;

export const QUELLE_BLOCKQUOTE = `() => {
  const wurzel = document.querySelector('[data-testid="blatt-text"]') || document.body;
  const bq = wurzel.querySelector('blockquote') || document.querySelector('blockquote');
  return bq ? (bq.textContent || '').replace(/\\s+/g, ' ').trim() : null;
}`;

// ------------------------------------------------------------------------------------------------
// Die Datei, die ein Mensch wählt
// ------------------------------------------------------------------------------------------------

/** Eine Referenzdatei als Playwright-Anlage — echte Bytes von der Platte, kein Nachbau. */
export function referenzAnlage(art: Referenzart): DateiAnlage {
  return {
    name: REFERENZ[art].name,
    mimeType: REFERENZ[art].mime,
    buffer: referenzBytes(art) as Buffer,
  };
}

// ------------------------------------------------------------------------------------------------
// Bedienschritte
// ------------------------------------------------------------------------------------------------

/**
 * 30-DATEIAUSWAHL — die Datei über den SICHTBAREN Knopf wählen.
 *
 * Zuerst wird auf das Dialog-Ereignis gehorcht, DANN geklickt: umgekehrt wäre der Dialog schon
 * offen, bevor jemand hinsieht, und der Schritt liefe in sein Budget, ohne dass etwas falsch ist.
 */
export async function dateiUeberSichtbareAuswahl(
  seite: SeiteMitDialog,
  anlage: DateiAnlage,
): Promise<void> {
  const warten = seite.waitForEvent("filechooser", { timeout: DIALOG_BUDGET_MS });
  await seite.click(SICHTBARE_DATEIAUSWAHL, { timeout: KLICK_BUDGET_MS });
  const waehler = await warten;
  await waehler.setFiles([anlage]);
}

/**
 * Die Fehlersätze, die der Datei-Import auf die Fläche bringen kann. Alle aus derselben Quelle wie
 * das Produkt (`Capture.tsx:4019-4024`, `:4029-4041`, `:4113-4135`) — keine abgeschriebenen Texte.
 */
function importFehlersaetze(name: string): string[] {
  return [
    satz(CAPTURE_FILE_TEXT.unsupported, { name }),
    satz(CAPTURE_FILE_TEXT.parseError, { name }),
    satz(CAPTURE_FILE_TEXT.empty, { name }),
    satz(CAPTURE_FILE_TEXT.emptyPdf, { name }),
    satz(CAPTURE_FILE_TEXT.emptyPptx, { name }),
    satz(CAPTURE_FILE_TEXT.pptxTooLarge, { name }),
    // Der Sonderfall, den `honestParseErrorText` vom echten Lesefehler trennt: ein nach einem
    // Deploy gescheiterter Chunk-Import ist KEIN kaputtes Dokument (`lib/staleChunk.ts:9`).
    satz(STALE_BUNDLE_KEY),
  ].filter((s) => s.length > 0);
}

/**
 * 31-EINGELESENES-DOKUMENT — warten, bis die Fläche die gewählte Datei als eingelesen führt.
 *
 * Gewartet wird auf einen ZUSTAND, nicht auf eine Frist: `wholeSourceNote` erscheint erst, wenn
 * `fileText` gefüllt ist (`Capture.tsx:5513`) — also nach einer GELUNGENEN Extraktion. Ein
 * `waitForTimeout` stünde hier für „lange genug auf diesem Rechner" und für nichts sonst.
 *
 * ========================================================================================
 * DER FEHLERABBRUCH, und warum er hier stehen MUSS (gemessen, Arbeitsprüfung
 * 6ac2f0fd… / Cloud-Lauf d3f1dc569a3b0e34b54fe2cc, 16.09.).
 * ========================================================================================
 * Ohne ihn lief die erste Fassung dieses Schritts 120 008 ms in ihr Budget und meldete dann
 * „Wartebudget erschöpft" mit einem in der MITTE gekürzten Flächentext — genau dort, wo der
 * Grund stand. Zwei Minuten Wartezeit für eine Auskunft, die nach 200 ms feststand.
 *
 * `Capture.tsx:4113-4118` setzt im Fehlerzweig `setFileName(null)` UND einen Fehlersatz. Der
 * Zustand ist damit ENDGÜLTIG: weiter zu warten kann nichts mehr ändern. Diese Schleife bricht
 * deshalb ab, sobald einer der Fehlersätze dasteht — und nennt ihn, statt ihn wegzukürzen.
 */
export async function aufEingelesenWarten(seite: SeiteMitDialog, name: string): Promise<void> {
  const erwartet = satz(CAPTURE_FILE_TEXT.wholeSourceNote, { name });
  const fehlersaetze = importFehlersaetze(name);
  const budget = wartebudget("aufFlaechensatzWarten");
  const start = Date.now();
  for (;;) {
    const text = await flaeche(seite);
    if (text.includes(erwartet)) {
      return;
    }
    const fehler = fehlersaetze.find((s) => text.includes(s));
    if (fehler !== undefined) {
      throw new Error(
        `Der Import von «${name}» endete im Fehlerzustand · Grund auf der Fläche: «${fehler}» · ` +
          `nach ${Date.now() - start} ms von ${budget} ms Budget`,
      );
    }
    if (Date.now() - start >= budget) {
      throw new Error(
        `Wartebudget erschöpft · «${name}» wurde weder eingelesen noch abgewiesen · erwartet war: ` +
          `«${erwartet}» · abgelaufen nach ${Date.now() - start} ms · VOLLER Flächentext: «${text}»`,
      );
    }
    await new Promise((auf) => setTimeout(auf, WARTEBUDGET.taktMs));
  }
}

/**
 * Der PERSISTIERTE Formathinweis einer Dateiart — der Satz, der im Quelle-Blockquote des Entwurfs
 * landet (`SOURCE_LABELS`, `captureFromFile.ts:272-311`).
 *
 * ER IST NICHT DERSELBE WIE DIE OBERFLÄCHEN-QUITTUNG, und das ist gemessen, nicht vermutet: für
 * PPTX weichen `importNote.pptx` (i18n) und `notePptx` (SOURCE_LABELS) im Wortlaut voneinander ab
 * (Befund in der Rückgabe). Ein Fall, der am Entwurf den i18n-Satz sucht, misst deshalb nicht den
 * Entwurf, sondern seine eigene Annahme. Abgeleitet wird der Satz aus dem echten Rumpfbauer — es
 * gibt keine zweite Abschrift.
 */
export function persistierterFormathinweis(sourceKind: WholeDocumentSourceKind): string {
  const html = wholeDocumentBodyHtml({
    fileName: "x",
    text: "x",
    sourceKind,
    locale: i18n.language,
  });
  const block = /<blockquote>([\s\S]*?)<\/blockquote>/.exec(html)?.[1] ?? "";
  const absaetze = [...block.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1] ?? "");
  return (absaetze[1] ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Die Vertraulichkeit wählen — ein Schritt, den ein Mensch VOR dem Einreichen gehen MUSS.
 *
 * GEMESSEN, NICHT ANGENOMMEN: `Blatt.tsx:1465-1472` bricht `requestSubmit` ab, solange
 * `vertraulichkeitOffen` gilt, markiert das Feld und setzt den Fokus dorthin — ohne Toast, ohne
 * Fehlerzeile. Der erste Anlauf dieses Ordners hat genau das erlebt: „Einreichen" geklickt, nichts
 * passiert, 120 s Wartebudget (Cloud-Lauf d3f1dc569a3b0e34b54fe2cc). Der abgenommene DOCX-Weg zeigt
 * denselben Schritt: in `31-eingelesenes-dokument.txt` steht „Vertraulichkeit", in
 * `35-eingereicht.txt` steht „Öffentlich-intern" — dazwischen hat der Mensch gewählt.
 */
export async function vertraulichkeitWaehlen(seite: SeiteMitDialog): Promise<void> {
  const stufe = satz("conf.level.intern");
  await seite.evaluate<boolean>(fn(KLICK_KNOPF), satz("erfassen.werkzeug.vertraulichkeit"));
  await aufFlaechensatzWarten(seite, stufe);
  await seite.evaluate<boolean>(fn(KLICK_KNOPF), stufe);
}

/** Ein Produktsatz, so gefaltet, wie die Ableser dieser Bühne die Fläche lesen. */
export function satz(schluessel: string, params: Record<string, unknown> = {}): string {
  return String(i18n.t(schluessel, params)).replace(/\s+/g, " ").trim();
}

/**
 * Die Zeichenzahl aus der Einlese-Quittung — GELESEN, nicht angenommen.
 *
 * Das Muster kommt aus derselben Übersetzungstabelle, aus der die Fläche rendert: der Schlüssel
 * wird mit einer Marke statt der Zahl gefüllt, die Marke wird zur Ziffernstelle. So hängt der
 * Ableser weder an einem deutschen Wortlaut noch an einer abgeschriebenen Satzform.
 * `null` = die Quittung steht nicht da; darüber wird dann auch nichts behauptet.
 */
export async function eingelesenZeichen(
  seite: SeiteMitDialog,
  name: string,
): Promise<number | null> {
  const marke = "9797979797";
  const muster = satz(CAPTURE_FILE_TEXT.loadedStatsWhole, { name, chars: marke });
  const teile = muster.split(marke);
  const vor = teile[0] ?? "";
  const nach = teile[1] ?? "";
  const roh = (await seite.evaluate<string>(fn(SEITENTEXT))).replace(/\s+/g, " ");
  const treffer = new RegExp(`${maskiere(vor)}(\\d+)${maskiere(nach)}`).exec(roh);
  const zahl = treffer?.[1];
  return zahl === undefined ? null : Number.parseInt(zahl, 10);
}

/** Zeichenkette als wörtliches Regex-Stück. */
function maskiere(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 35-EINGEREICHT — den Entwurf einreichen und auf die Lagezeile mit dem Wissenslink warten.
 *
 * Zurück kommt die Kennung des entstandenen Wissenseintrags — genau die, die der Mensch angeboten
 * bekommt (`Blatt.tsx:3209`, `to={/wissen/<id>}`). Keine Kennung aus einer Antwort, die niemand
 * sieht: was nicht verlinkt ist, ist für einen Menschen nicht da.
 */
export async function einreichenUndKennung(seite: SeiteMitDialog): Promise<string> {
  // Ohne diesen Schritt bleibt der Klick auf „Einreichen" WIRKUNGSLOS (s. `vertraulichkeitWaehlen`).
  await vertraulichkeitWaehlen(seite);
  await seite.click(EINREICHEN_KNOPF, { timeout: KLICK_BUDGET_MS });
  const erwartet = satz("erfassen.eingereicht");
  const budget = wartebudget("aufFlaechensatzWarten");
  const start = Date.now();
  for (;;) {
    const text = await flaeche(seite);
    if (text.includes(erwartet)) {
      break;
    }
    if (Date.now() - start >= budget) {
      throw new Error(
        `Das Einreichen hat die Lagezeile «${erwartet}» nicht gebracht · abgelaufen nach ` +
          `${Date.now() - start} ms · VOLLER Flächentext: «${text}»`,
      );
    }
    await new Promise((auf) => setTimeout(auf, WARTEBUDGET.taktMs));
  }
  const href = await seite.evaluate<string | null>(fn(LAGE_WISSENSLINK));
  if (href === null) {
    throw new Error(
      `Nach dem Einreichen steht in der Lagezeile kein Weg zum Wissenseintrag · VOLLER Flächentext: «${await flaeche(seite)}»`,
    );
  }
  return href.slice("/wissen/".length);
}

/**
 * Den Datei-Arbeitsraum schliessen und ans Blatt zurückkehren (`cancelFileImport`,
 * `Capture.tsx:2679-2706`).
 *
 * WARUM DER ABWEISUNGSFALL IHN BRAUCHT, und das ist gemessen: solange der Datei-Arbeitsraum offen
 * ist, gibt es `[data-testid="blatt-text"]` GAR NICHT — die Schreibfläche ist nicht versteckt,
 * sondern nicht montiert. Die erste Fassung von T6 verglich deshalb den getippten Entwurf mit einem
 * leeren String und meldete „die Abweisung hat den bestehenden Entwurf verändert", obwohl nichts
 * verändert war (Cloud-Lauf d3f1dc569a3b0e34b54fe2cc). Gemessen wird, was ein Mensch sieht, wenn er
 * nach der Abweisung zu seinem Text zurückgeht — und das ist hier.
 */
export async function dateiwegSchliessen(seite: SeiteMitDialog): Promise<void> {
  await seite.evaluate<boolean>(fn(KLICK_KNOPF), satz(CAPTURE_FILE_TEXT.cancel));
  const budget = wartebudget("aufFlaechensatzWarten");
  const start = Date.now();
  for (;;) {
    const text = await seite.evaluate<string>(fn(BLATT_TEXT));
    if (text.length > 0) {
      return;
    }
    if (Date.now() - start >= budget) {
      throw new Error(
        `Nach dem Abbrechen steht die Schreibfläche nicht wieder da · abgelaufen nach ${Date.now() - start} ms · VOLLER Flächentext: «${await flaeche(seite)}»`,
      );
    }
    await new Promise((auf) => setTimeout(auf, WARTEBUDGET.taktMs));
  }
}

/** Der sichtbare Text der ganzen Seite — für die Zusicherungen der Fälle. */
export async function flaeche(seite: SeiteMitDialog): Promise<string> {
  return (await seite.evaluate<string>(fn(SEITENTEXT))).replace(/\s+/g, " ");
}

/**
 * Die HERKUNFT, wie sie ein Mensch am Entwurf oder am Wissenseintrag liest — gezielt aus dem
 * Quelle-Blockquote, nicht aus dem Gesamtseitentext (Begründung bei `QUELLE_BLOCKQUOTE`).
 * `null` = es steht gar keine Quellenanzeige da.
 */
export async function quellenanzeige(seite: SeiteMitDialog): Promise<string | null> {
  return seite.evaluate<string | null>(fn(QUELLE_BLOCKQUOTE));
}

/**
 * RUNDE 4 — der Nachweis, dass eine Ablesung WIRKLICH die Seite liest, auf der sie steht.
 *
 * `lesen` wird dreimal gerufen: einmal vor dem Ausblenden, einmal während `marke` auf der ZIELSEITE
 * entfernt ist — dann MUSS die Marke fehlen —, und einmal nach dem Wiederherstellen. Ein Ableser,
 * der den mittleren Schritt übersteht, liest etwas anderes als die Seite vor ihm; genau der Fehler,
 * den der Prüfer in Runde 3 gefunden hat.
 *
 * WIEDERHERSTELLUNG (RUNDE 5, nach dem Befund des Prüfers): sie läuft bei JEDEM Ausgang des
 * mittleren Schritts — bei erkanntem eingefrorenem Wert ebenso wie bei einem Ableser, der WIRFT.
 * Belegt durch T10c (eingefroren) und T10e/T10f (werfend) in `kalibrierung-greift.test.tsx`.
 * NICHT abgesichert ist der Fall, dass `TEXT_ZURUECK` selbst scheitert: dann bleibt die Seite
 * verstellt, und die Funktion sagt das ausdrücklich, statt es zu verschweigen.
 *
 * Aufgerufen an genau drei Stellen — je einmal am Wissenseintrag der drei Ketten; siehe den
 * Abschnittskopf „RUNDE 4 — DIE KALIBRIERUNG" oben.
 */
export async function ablesungKalibrieren(
  seite: SeiteMitDialog,
  marke: string,
  lesen: () => Promise<string>,
): Promise<void> {
  const vorher = await lesen();
  if (!vorher.includes(marke)) {
    throw new Error(`Kalibrierung: «${marke}» steht schon vor dem Ausblenden nicht auf der Seite.`);
  }
  const ausgeblendet = await seite.evaluate<boolean>(fn(TEXT_AUSBLENDEN), marke);
  if (!ausgeblendet) {
    throw new Error(`Kalibrierung: «${marke}» liess sich auf der Zielseite nicht ausblenden.`);
  }
  // AB HIER IST DIE SEITE VERSTELLT, und bis zur Wiederherstellung darf nichts daran vorbeiführen.
  // RUNDE 5: hier stand `const waehrend = await lesen();` ohne `try`. WIRFT der Ableser — und
  // `page.evaluate` wirft, sobald die Seite navigiert, abstürzt oder der Kontext wegfällt —, dann
  // wurde die Wiederherstellung übersprungen und die Seite blieb mit einem leeren Textknoten
  // zurück (Befund des Prüfers, Runde 4). Dieselbe Fehlerklasse wie im Auftrag, nur im Messmittel.
  let waehrend = "";
  let lesefehler: unknown;
  let hatGeworfen = false;
  try {
    waehrend = await lesen();
  } catch (fehler) {
    hatGeworfen = true;
    lesefehler = fehler;
  }

  // ZUERST wiederherstellen, DANN urteilen — und das gilt AUCH für den werfenden Ableser.
  const zurueck = await seite.evaluate<boolean>(fn(TEXT_ZURUECK));
  if (hatGeworfen) {
    if (!zurueck) {
      throw new Error(
        `Kalibrierung: «${marke}» liess sich nach einem Lesefehler NICHT wiederherstellen — die Seite bleibt verstellt.`,
        { cause: lesefehler },
      );
    }
    // Die Seite steht wieder; der Fehler des Ablesers kommt UNVERFÄLSCHT heraus. Ihn durch eine
    // eigene Meldung zu ersetzen hiesse, im Protokoll die Diagnose der Vorrichtung statt der
    // Ursache zu hinterlassen.
    throw lesefehler;
  }
  if (!zurueck) {
    throw new Error("Kalibrierung: der ausgeblendete Text liess sich nicht wiederherstellen.");
  }
  if (waehrend.includes(marke)) {
    throw new Error(
      `Kalibrierung GESCHEITERT: «${marke}» stand noch da, obwohl es auf der Zielseite entfernt war — die Ablesung liest nicht diese Seite, sondern einen älteren Zustand.`,
    );
  }
  const nachher = await lesen();
  if (!nachher.includes(marke)) {
    throw new Error(`Kalibrierung: «${marke}» kam nach dem Wiederherstellen nicht zurück.`);
  }
}

/** Eine Live-Region der Seite, mit ihrer Marke und ihrem Text. */
export interface Liveregion {
  readonly marke: string;
  readonly text: string;
}

/** Alle Live-Regionen der Seite — für die Abweisungsprüfung und ihre Ablaufmeldung. */
export async function liveregionen(seite: SeiteMitDialog): Promise<Liveregion[]> {
  return seite.evaluate<Liveregion[]>(fn(LIVE_REGIONEN_LESEN));
}

/**
 * RUNDE 2 — warten, bis ein Satz WIRKLICH ANGESAGT wird: er muss in einer Live-Region stehen.
 *
 * Der Unterschied zu `aufFlaechensatzWarten` ist der ganze Punkt (BEN, Korrekturpflicht 3): dort
 * genügt es, dass der Satz irgendwo auf der Seite steht. Hier zählt nur, was eine Vorlesehilfe
 * ansagen würde. Bei Ablauf nennt die Meldung ALLE gefundenen Regionen samt Inhalt — ohne das
 * hiesse „nicht angesagt" bloss „nicht gefunden", und niemand wüsste, wo nachzusehen ist.
 */
export async function aufLiveMeldungWarten(seite: SeiteMitDialog, satz: string): Promise<void> {
  const budget = wartebudget("aufFlaechensatzWarten");
  const start = Date.now();
  for (;;) {
    const regionen = await liveregionen(seite);
    if (regionen.some((r) => r.text.includes(satz))) {
      return;
    }
    if (Date.now() - start >= budget) {
      throw new Error(
        `Der Satz «${satz}» steht in KEINER Live-Region — er wird also nicht angesagt. ` +
          `Gefundene Regionen: ${JSON.stringify(regionen)} · abgelaufen nach ${Date.now() - start} ms`,
      );
    }
    await new Promise((auf) => setTimeout(auf, WARTEBUDGET.taktMs));
  }
}

/** Das Budget eines geliehenen Warteschritts — damit die Fälle keine eigene Zahl mitbringen. */
export { wartebudget };
