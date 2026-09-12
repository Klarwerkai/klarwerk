// ================================================================================================
// JOB 3609 · DIE VORRICHTUNG BESCHREIBT DIE SEITE — EINMAL JE BÜHNE, UND SONST NIRGENDS.
// ================================================================================================
//
// HERKUNFT. JOB 3564 hat diese Kopplung für EINE Bühne (`tests/design/h4-harness.ts`) durchgesetzt:
// die Typisierung der Browserseite wohnt in der Vorrichtung, nicht in jeder Testdatei neu. Die Bahn
// von JOB 3564 hat die Lücke selbst benannt (`archiv/3564/runde-3/RUECKGABE.md:55`): „dasselbe
// Muster existiert an einer anderen Bühne — sechs weitere Dateien … Dieser Wächter deckt sie nicht
// ab, weil er auf `design/h4-harness` zugeschnitten ist." JOB 3609 macht aus dem Einzelwert eine
// MENGE. Das Haus hat drei Bühnen, und an allen dreien gilt dieselbe Doktrin:
//
//   · `tests/design/h4-harness.ts`      — die gebaute Bibliothek in Chromium (1620 px).
//   · `tests/design/h6-chromium.ts`     — die gebauten Admin-/Profilflächen in Chromium.
//   · `tests/design/h3-blatt-buehne.ts` — das gebaute Erfassungsblatt in Chromium.
//
// WAS HIER GEPRÜFT WIRD, IST EINE KOPPLUNG UND KEIN SCHNAPPSCHUSS. Nicht „steht in Zeile 33 noch
// dasselbe wie heute", sondern: keine Datei unter `tests/`, die eine dieser drei Bühnen importiert,
// reicht sich ein Feld der echten Playwright-Seite selbst nach, das die schlanke Typisierung DIESER
// Bühne nicht kennt — weder über ein Interface (`interface X extends Seite { … }`) noch über einen
// Cast (`seite() as unknown as X`) noch über einen Typalias auf den indizierten Zugriff
// (`type X = Buehne["seite"] & { … }`, die Schreibweise an h3). Die Liste der geprüften Dateien wird
// zur Laufzeit aus dem Baum erhoben, nicht gepflegt; ein neuer Verbraucher fällt von selbst hinein.
//
// UND ES HÄNGT AN DER SACHE, NICHT AN DER SCHREIBWEISE. Zwei Tarnungen derselben Aufweitung kamen in
// Runde 1 noch durch, weil die HERKUNFTSERKENNUNG zu wörtlich war (Prüfer BEN, 11.09.): die Klammer
// (`type X = (Buehne["seite"] & { … })`) und die lokale Umbenennung des Behälters
// (`type S = Buehne; type X = S["seite"] & { … }`). Beide sind für TypeScript dasselbe wie die nackte
// Form, also müssen sie hier denselben Fund erzeugen: Klammern fallen überall durch `ohneKlammern`
// und `schnittTeile` weg, und der Behälter wird in der über `standTypen` ERWEITERTEN Menge
// nachgeschlagen, nicht in der nackten Importbindung. V6 misst beides je Bühne dreifach.
//
// JEDE BÜHNE WIRD GEGEN IHRE EIGENE TYPISIERUNG GEMESSEN. Alle drei Bühnen nennen ihren Seitentyp
// `Seite`, aber die drei sind NICHT gleich: `h4-harness.ts` kennt `keyboard`, `setViewportSize` und
// `waitForTimeout`, die beiden anderen nicht. Deshalb wird je Datei aufgelöst, aus WELCHER Bühne der
// lokale Name stammt (über die Importbindung, nicht über den Namen), und gegen genau deren Felder
// verglichen. Ein Zusammenwerfen aller drei Feldmengen wäre ein stiller Freibrief.
//
// WENN DIESER FALL ROT WIRD, ist die Antwort NIE „mein Interface in der Testdatei ist doch klein".
// Das Feld gehört in `export interface Seite` DER BETROFFENEN BÜHNE — also in
// `tests/design/h4-harness.ts`, `tests/design/h6-chromium.ts` oder `tests/design/h3-blatt-buehne.ts`,
// je nachdem, welche die Meldung nennt; schlank, nur was wirklich benutzt wird, mit einem Satz
// Begründung daneben. Danach ist dieser Fall von selbst grün (er liest die Bühnen bei jedem Lauf
// neu), und die nächste Browserprüfung findet das Feld vor, statt sich eine eigene Typarbeit zu
// bauen. Genau das war der Gewinn von JOB 3564; er soll an allen drei Bühnen halten.
//
// ÜBER DEN SYNTAXBAUM, NICHT ÜBER ZEICHENKETTEN — dieselbe Doktrin wie
// `tests/tor-inventar/browser-gruppe.ts:20-29` und `tests/capture/aufrufer-waechter.test.ts`. Eine
// Textsuche träfe die Kopfkommentare dieser Dateien mit: sie BEGRÜNDEN die Aufweitungen wörtlich
// und wären dann ihr eigener Fund. Das ist auch die Promptverbesserung des Prüfers vom 10.09.
// (`LEHREN.md`, JOB 3489): „Die Quelltextprobe sucht nur in CODEZEILEN, nicht in Kommentaren."
// Kommentare kommen im AST gar nicht vor; V5 belegt das je Bühne ausdrücklich.
//
// DIE GRENZE, AUSDRÜCKLICH BENANNT: gesehen wird, wer eine Bühne SELBST importiert. Wer die Seite
// aus dritter Hand bezieht — über einen Helfer, der seinerseits eine Bühne benutzt —, fällt nicht in
// die Menge. Im heutigen Bestand ist das `tests/profil-schmal/schmal-buehne.ts`: sie holt aus h6 nur
// `BrowserFn`, `DIST`, `ORIGIN` und `fn` und deklariert ein EIGENES `export interface Seite` (:47);
// ihre Verbraucher (`ux13-profil-320.test.ts`) messen gegen diesen eigenen Typ. Genau deshalb hängt
// dieser Wächter an der IMPORTBINDUNG und nicht am Namen „Seite" — sonst zählte er dort eine Schuld,
// die es nicht gibt. Eine vierte Bühne dieser Art gehört ins Register oben, nicht in eine Ausnahme.
// Seit Runde 3 ist diese Grenze GEMESSEN und nicht mehr nur behauptet: V6 fährt sie als Fallpaar —
// der Verbraucher aus dritter Hand bleibt still, derselbe Rumpf mit direktem Bühnenimport meldet.
// Der re-exportierende Helfer selbst fällt sehr wohl in die Menge; die Grenze verliert also den
// Verbraucher zweiter Hand, nicht den, der die Aufweitung wirklich schreibt.
//
// KEIN BROWSER, KEINE NEUE STARTSTELLE. Diese Datei liest Quelltext und startet nichts. Sie
// importiert KEINE der drei Bühnen, sondern liest sie als Text: ein Import zöge sie über die
// Importhülle in die serielle Browser-Gruppe (`tests/tor-inventar/browser-gruppe.ts`) und verschöbe
// den Bestandspin der Startstellen (`tor-bestand-vollstaendig.test.ts`). Der bleibt unberührt — V7
// misst es mit demselben Scanner, der die Browser-Gruppe berechnet.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { BROWSER_PAKETE, spezifizierer } from "../tor-inventar/browser-gruppe";

const WURZEL = join(__dirname, "..", "..");
const TESTS = join(WURZEL, "tests");

// ==================================================================================================
// DAS BÜHNENREGISTER — DIE BÜHNE IST EINE MENGE, KEIN EINZELWERT.
// ==================================================================================================
//
// Bis JOB 3609 standen hier zwei Einzelwerte (`HARNESS`, `HARNESS_MUSTER`). Sie sind ersetzt, nicht
// ergänzt: es gibt keinen zweiten Weg mehr, eine Bühne zu benennen. Wer eine vierte Bühne baut,
// trägt sie hier ein — und alle Fälle unten laufen von selbst auch über sie.
interface Buehne {
  /** Kurzname für Meldungen und Fallnamen. */
  readonly kurz: string;
  /** Der Pfad der Bühnendatei, aus dem die Felder gelesen werden (als TEXT, nie importiert). */
  readonly pfad: string;
  /** Das Importmuster, an dem ein Verbraucher erkannt wird — am Modulspezifizierer, nicht am Text. */
  readonly muster: RegExp;
  /**
   * Der NAME der Typdeklaration, die in dieser Bühne die Browserseite beschreibt. Alle drei Bühnen
   * schreiben sie als `export interface Seite` (`h4-harness.ts:85`, `h6-chromium.ts:126`,
   * `h3-blatt-buehne.ts:75`) — gleich benannt, aber NICHT gleich gefüllt.
   */
  readonly seitentyp: string;
  /**
   * Der Behälter, über dessen Feld `seite` die Verbraucher die Seite erreichen. An h3 ist das die
   * Schreibweise, in der die Seite überhaupt nur auftaucht: `Buehne["seite"] & { … }`
   * (`tests/import-anleitung-modus/tastatur-importart-chromium.test.ts:35`). Deshalb steht der
   * Behältername hier und nicht nur der Seitentyp — sonst sähe der Auflöser an h3 gar nichts.
   */
  readonly standtyp: string;
  /** Wofür die Bühne da ist — ein Satz, damit die Meldung ohne Nachschlagen verständlich ist. */
  readonly zweck: string;
}

const BUEHNEN: readonly Buehne[] = [
  {
    kurz: "h4",
    pfad: "tests/design/h4-harness.ts",
    muster: /(^|\/)design\/h4-harness(\.js)?$/,
    seitentyp: "Seite",
    standtyp: "H4Stand",
    zweck: "die gebaute Bibliothek in Chromium, 1620 px, mit echtem Bestand und echter Fastify-App",
  },
  {
    kurz: "h6",
    pfad: "tests/design/h6-chromium.ts",
    muster: /(^|\/)design\/h6-chromium(\.js)?$/,
    seitentyp: "Seite",
    standtyp: "Stand",
    zweck: "die gebauten Admin- und Profilflächen in Chromium, mit einspeisbarer Störung",
  },
  {
    kurz: "h3",
    pfad: "tests/design/h3-blatt-buehne.ts",
    muster: /(^|\/)design\/h3-blatt-buehne(\.js)?$/,
    seitentyp: "Seite",
    standtyp: "Buehne",
    zweck: "das gebaute Erfassungsblatt in Chromium, auf `localhost` und mit Serverwahrheit",
  },
] as const;

/**
 * Die eigene Datei nimmt sich aus. Sie NENNT die Bühnenpfade (als Lesequelle), importiert sie aber
 * nicht — sie fällt also ohnehin nicht in die Verbrauchermenge. Der Name steht hier trotzdem, damit
 * die Ausnahme benannt ist und nicht aus Versehen entsteht.
 */
const SELBST = "tests/design-vorrichtung/seiten-typ-waechter.test.ts";

/** Verzeichnisse, die der Gang nie betritt (Vorbild: `browser-gruppe.ts`). */
const NICHT_BETRETEN = new Set(["node_modules", "dist", ".git", ".local", "coverage"]);

// ==================================================================================================
// DER ALTBESTAND — WAS GEZÄHLT UND BENANNT, ABER AUFTRAGSGEMÄSS NICHT ANGEFASST WIRD.
// ==================================================================================================
//
// JOB 3564 hat den Altbestand an h4 registriert; JOB 3609 tut dasselbe für h6 und h3. Die Bühnen
// selbst gehören anderen laufenden Jobs (h4 → 3602, h6 → 3587, h3 → 3584), und die Verbraucher
// gehören ihren eigenen Zeilen: ein Feld in `Seite` einzutragen hiesse, eine fremde Zielpfaddatei zu
// ändern. Also stehen sie hier — namentlich, mit genau den Feldern, die ihnen heute zugestanden
// werden.
//
// Das ist kein Freibrief, sondern eine Schranke in BEIDE Richtungen:
//   · Ein Feld, das NICHT in der Zeile steht, macht V1 rot — auch in einer alten Datei.
//   · Eine alte Datei, die ihre Aufweitung LOSWIRD, macht V2 rot: dann gehört der Eintrag weg, sonst
//     verwaltet das Register Gespenster (Lehre JOB 3550/3562: ein Wächter, der nichts mehr sieht,
//     ist grün und nutzlos). Dasselbe gilt FELDWEISE: ein zugestandenes Feld, das nirgends mehr
//     nachgereicht wird, ist eine Karteileiche und macht V2 rot.
//   · Auch die Bühne der Zeile wird geprüft: wandert eine Datei auf eine andere Bühne, ist der
//     Eintrag falsch und V2 rot.
// Wer eine dieser Zeilen abräumen will, trägt das Feld in `Seite` der genannten Bühne ein und löscht
// die Zeile.
interface Altzeile {
  /** Die Bühne, gegen die gemessen wird — muss mit dem Befund übereinstimmen (V2). */
  readonly buehne: string;
  /** Genau die Felder, die heute zugestanden sind. Alles darüber hinaus ist rot. */
  readonly felder: readonly string[];
  /** Warum die Datei sie heute braucht — ein Satz, kein Freibrief. */
  readonly grund: string;
}

const ALTBESTAND: ReadonlyMap<string, Altzeile> = new Map<string, Altzeile>([
  // ---- Bühne h4 (JOB 3564, unverändert übernommen) ---------------------------------------------
  [
    "tests/anhang-upload-tastatur/foto-anhaengen-tastatur.test.ts",
    {
      buehne: "h4",
      felder: ["mouse", "setInputFiles"],
      grund: "echte Maus und echter Dateidialog — JOB 3564, Folgezeile 1",
    },
  ],
  [
    "tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts",
    {
      buehne: "h4",
      felder: ["reload"],
      grund:
        "das Neuladen der Seite im Word-Hilfe-Fall — JOB 3564, Folgezeile 2. Die Datei schreibt " +
        "ausserdem `interface SeiteMitTastatur extends Seite` (:10) und `SeiteMitReload extends " +
        "SeiteMitTastatur` (:96); `keyboard.press` ist seit JOB 3564 in `Seite` und damit bezahlt, " +
        "übrig bleibt `reload`. EINE Zeile, nicht zwei — die Datei ist h4-Verbraucherin, sonst nichts.",
    },
  ],
  [
    "tests/bibliothek-sichten/sichten-chromium.test.ts",
    {
      buehne: "h4",
      felder: ["keyboard.type"],
      grund: "Tippen statt nur Tastendruck — JOB 3564, Folgezeile 3",
    },
  ],
  [
    "tests/quellen-anker-im-formular/belegstelle-ueberlebt-neuladen-chromium.test.ts",
    {
      buehne: "h4",
      felder: ["keyboard.type", "click", "focus", "selectOption", "reload"],
      grund:
        "die breiteste Aufweitung im h4-Bestand (Tippen, Klicken, Fokussieren, Auswählen, Neuladen)" +
        " — JOB 3564, Folgezeile 4, und der eigentliche Kandidat für den nächsten Zug an h4",
    },
  ],
  // ---- Bühne h6 (JOB 3609; Runde 1 fand acht Dateien, Runde 3 misst zehn) ----------------------
  //
  // Der Auftrag ging von SECHS Dateien aus (`archiv/3564/runde-3/RUECKGABE.md:40`). Runde 1 fand
  // ACHT, Runde 3 findet ZEHN: `gast-buehne.ts` und `aufgaben-schmal-chromium.test.ts` sind zwischen
  // Runde 2 und Runde 3 neu in den Baum gekommen und reichen sich dieselben Felder selbst nach wie
  // die Nachbarn. Sie werden GEZÄHLT UND BENANNT, nicht umgebaut (AUFTRAG §10, dieselbe Schranke wie
  // bei JOB 3564) — dass sie überhaupt auffielen, ohne dass jemand danach suchte, ist der Zweck
  // dieses Wächters.
  [
    "tests/demo-firmen-ci-anmeldung/gast-buehne.ts",
    {
      buehne: "h6",
      felder: ["setViewportSize", "reload"],
      grund:
        "Neu im Baum seit Runde 2, von Runde 3 nachgemessen. Keine Testdatei, sondern ein " +
        "Bühnen-Helfer: `export interface GastSeite extends Seite` (:70) — Fenster verstellen und " +
        "neu laden. Ihr eigener Kommentar (:63-69) nennt den Grund, aus dem sie NICHT aus Playwright " +
        "typisiert: ein Typimport zählte im Torgraphen als weitere Startstelle. Genau diese Not " +
        "räumt ein Eintrag in `Seite` von h6 ab, nicht ein zweiter eigener Typ.",
    },
  ],
  [
    "tests/design/job3337-palette-flaches-fenster-chromium.test.ts",
    {
      buehne: "h6",
      felder: ["setViewportSize", "keyboard"],
      grund:
        "Das flache Fenster wird während der Messung verstellt und mit echten Tasten bedient; " +
        "`h6-chromium.ts` reicht die rohe Playwright-Seite durch, ohne beides zu benennen (:37, :40).",
    },
  ],
  [
    "tests/einstellungen-schmal/ux12b-einstellungen-schmal-chromium.test.ts",
    {
      buehne: "h6",
      felder: ["setViewportSize", "keyboard"],
      grund:
        "Dieselben zwei Felder wie an job3337, wortgleich abgeschrieben (:149, :153) — genau die " +
        "doppelte Typarbeit, die JOB 3564 an h4 beendet hat.",
    },
  ],
  [
    "tests/ki-fehlerhilfe/wiederholen-tastatur-chromium.test.ts",
    {
      buehne: "h6",
      felder: ["keyboard"],
      grund: "Echte Tastenanschläge auf den Knopf „Erneut“ (:48) — `press`, sonst nichts.",
    },
  ],
  [
    "tests/m6-import-erklaerweg/rueckweg-echte-route-chromium.test.ts",
    {
      buehne: "h6",
      felder: ["setViewportSize"],
      grund:
        "Die schmale Lage des Rückwegs (:27, `interface SeiteMitFenster extends Seite`). In der " +
        "Akte von JOB 3564 nicht enthalten; von JOB 3609 nachgemessen.",
    },
  ],
  [
    "tests/m6-import-erklaerweg/rundweg-tastatur-chromium.test.ts",
    {
      buehne: "h6",
      felder: ["setViewportSize", "keyboard", "goBack"],
      grund:
        "Die breiteste Aufweitung im h6-Bestand (:30): Fenster verstellen, Tab drücken UND zurück " +
        "navigieren. `goBack` hat sonst niemand — der Kandidat für den nächsten Zug an h6.",
    },
  ],
  [
    "tests/navigation-schmal/kopfband-messung.ts",
    {
      buehne: "h6",
      felder: ["setViewportSize"],
      grund:
        "Keine Testdatei, sondern ein Messhelfer: er exportiert `SeiteMitViewport` (:24) und castet " +
        "in `seiteRoh` (:106). Die zweite Schreibweise derselben Schuld, an h6 bis JOB 3609 ungesehen.",
    },
  ],
  [
    "tests/review26-aufgaben-schmal/aufgaben-schmal-chromium.test.ts",
    {
      buehne: "h6",
      felder: ["setViewportSize", "mouse"],
      grund:
        "Neu im Baum seit Runde 2, von Runde 3 nachgemessen: `interface SeiteRoh extends Seite` " +
        "(:69), schmales Fenster und echte Maus — dieselben zwei Felder, die die Nachbarin " +
        "`pruefen-schmal-chromium.test.ts` schon nachreicht. Der nächste Abschreibfall an h6.",
    },
  ],
  [
    "tests/review26-pruefen-schmal/pruefen-schmal-chromium.test.ts",
    {
      buehne: "h6",
      felder: ["locator", "getByTestId", "mouse", "keyboard"],
      grund:
        "Die vier Felder einer ganzen Bedienfläche (:35) — Elementgriffe, echte Maus, echte Tasten. " +
        "In der Akte von JOB 3564 nicht enthalten; von JOB 3609 nachgemessen.",
    },
  ],
  [
    "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts",
    {
      buehne: "h6",
      felder: ["setViewportSize", "keyboard"],
      grund:
        "Zwei Fundstellen in EINER Datei (:379 Cast auf `SeiteMitViewport`, :396 Cast auf die " +
        "Schnittmenge) — EINE Zeile hier, mit der Vereinigung der Felder.",
    },
  ],
  // ---- Bühne h3 (JOB 3609; Runde 1 fand drei Dateien, Runde 3 misst zwei) -----------------------
  //
  // HIER HAT DIE KOPPLUNG ZUM ERSTEN MAL GELIEFERT. Zwischen Runde 2 und Runde 3 hat JOB 3584 — der
  // Eigentümer von `h3-blatt-buehne.ts` — `keyboard` (:87, nur `press`) und `setViewportSize` (:93)
  // in die `Seite` dieser Bühne eingetragen. Der Wächter liest die Bühne bei JEDEM Lauf neu, also
  // sind drei Schulden von selbst bezahlt worden, ohne dass jemand hier etwas nachpflegen musste:
  //   · `tastatur-importart-chromium.test.ts` hat GAR KEINE Aufweitung mehr — ihre Zeile ist
  //     gelöscht. Sie schreibt zwar weiter `Buehne["seite"] & { keyboard: Tastatur }` (:35), aber
  //     das deckt sich jetzt mit der Bühne; der Typalias ist keine Schuld mehr, nur noch Wiederholung.
  //   · `ux19-buehne.ts` hat `keyboard` verloren, `hinweis-bleibt-schmal-lesbar.test.ts`
  //     `setViewportSize` — beide Zeilen sind entsprechend gekürzt.
  // V2 hat genau das erzwungen: die drei Zeilen wurden als Karteileichen rot gemeldet. Das ist die
  // Schranke in der Rückrichtung, die der Auftrag verlangt — sie hat sich an echtem Fortschritt bewährt.
  [
    "tests/ux19-speichern-oeffnen-reload/ux19-buehne.ts",
    {
      buehne: "h3",
      felder: ["setInputFiles", "click"],
      grund:
        "Keine Testdatei, sondern der Helfer der UX19-Gruppe: `export type SeiteMitDatei = " +
        'Buehne["seite"] & { … }` (:48) — Dateianlage und der ECHTE Zeigerklick (JOB 3259 R2). ' +
        "`keyboard` stand bis Runde 2 hier und ist seit JOB 3584 in `Seite` von h3 bezahlt.",
    },
  ],
  [
    "tests/vertraulichkeit-hinweis/hinweis-bleibt-schmal-lesbar.test.ts",
    {
      buehne: "h3",
      felder: ["waitForLoadState"],
      grund:
        "Das Warten auf den Ladezustand, über einen Cast (:114). Die drei schmalen Breiten " +
        "(320/360/390) standen bis Runde 2 als `setViewportSize` daneben — seit JOB 3584 kennt " +
        "`h3-blatt-buehne.ts` das Feld selbst, also ist nur noch `waitForLoadState` offen.",
    },
  ],
]);

/**
 * DIE PRÜFMENGE JE BÜHNE, FESTGENAGELT (Lehre vom 10.09., `LEHREN.md` JOB 3489 09:21:13: „Jede
 * Testmenge, die aus einer Laufzeitquelle abgeleitet wird, braucht einen eigenen `it` … der ihre
 * erwartete Größe festnagelt — sonst kann die ganze Prüfmenge lautlos auf null schrumpfen").
 *
 * Die ZAHL steht als Untergrenze und die NAMEN als Pflichtmenge — beides zusammen, weil beides eine
 * andere Frage beantwortet: die Untergrenze fängt eine leergelaufene Erhebung, die Namen sagen,
 * WELCHE Datei verschwunden ist. Ein NEUER Verbraucher darf dazukommen, ohne diese Fälle rot zu
 * machen (das ist keine Entscheidung, die gesehen werden muss) — bringt er eine Aufweitung mit, ist
 * er in V1 rot, und genau dort gehört er hin.
 *
 * Eine Datei, die den Pfad nur in einem KOMMENTAR oder in einer Pin-Liste nennt
 * (`tests/tor-inventar/tor-bestand-vollstaendig.test.ts`), ist kein Verbraucher — genau dieser
 * Unterschied ist der Grund für den Syntaxbaum.
 */
const ERWARTETE_VERBRAUCHER: ReadonlyMap<string, readonly string[]> = new Map<
  string,
  readonly string[]
>([
  // Gemessen am Basisstand `4dfc4f0`: h4 = 12, h6 = 17, h3 = 6 Verbraucher. Die h4-Menge ist
  // unverändert die von JOB 3564 — der Umbau auf das Register hat an ihr nichts verschoben.
  [
    "h4",
    [
      "tests/ablage-kontext/neuladen-in-chromium.test.ts",
      "tests/anhang-upload-tastatur/foto-anhaengen-tastatur.test.ts",
      "tests/berichtskopf-spruenge/kopf-sprung-in-chromium.test.ts",
      "tests/bibliothek-schmal/telefon-chromium.test.ts",
      "tests/bibliothek-scope-sprache/ortszeile-390px-browser.test.ts",
      "tests/bibliothek-sichten/sichten-chromium.test.ts",
      "tests/bibliothek-vorschau-aufklapper/vorschau-aufklapper-chromium.test.ts",
      "tests/bibliothek/job3068-deckung-sichtbar.test.tsx",
      "tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts",
      "tests/quellen-anker-im-formular/belegstelle-ueberlebt-neuladen-chromium.test.ts",
      "tests/tor-bereitschaft/verzoegerte-antworten.test.ts",
      "tests/ux21-tablet-lesemodus/tablet-chromium.test.ts",
    ],
  ],
  [
    "h6",
    [
      "tests/design/job3337-palette-flaches-fenster-chromium.test.ts",
      "tests/einstellungen-schmal/ux12b-einstellungen-schmal-chromium.test.ts",
      "tests/ki-fehlerhilfe/wiederholen-tastatur-chromium.test.ts",
      "tests/m6-import-erklaerweg/rueckweg-echte-route-chromium.test.ts",
      "tests/m6-import-erklaerweg/rundweg-tastatur-chromium.test.ts",
      "tests/navigation-schmal/kopfband-ci-chromium.test.ts",
      "tests/navigation-schmal/kopfband-messung.ts",
      "tests/navigation-schmal/kopfband-schmal-chromium.test.ts",
      "tests/profil-schmal/schmal-buehne.ts",
      "tests/profil-schmal/ux13-profil-320.test.ts",
      "tests/review26-pruefen-schmal/pruefen-schmal-chromium.test.ts",
      "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts",
      "tests/tor-bereitschaft/t1b-hooks.test.ts",
      "tests/tor-bereitschaft/t1b-raster.test.ts",
      "tests/tor-bereitschaft/t1e-ableitung.test.ts",
      "tests/tor-bereitschaft/verzoegerte-antworten.test.ts",
      "tests/tor-chromium-abbau/probe-beschriftet-sich-als-probe.test.ts",
    ],
  ],
  [
    "h3",
    [
      "tests/import-anleitung-modus/tastatur-importart-chromium.test.ts",
      "tests/ux19-speichern-oeffnen-reload/ganzdokument-am-echten-server.test.ts",
      "tests/ux19-speichern-oeffnen-reload/ux19-buehne.ts",
      "tests/ux19-speichern-oeffnen-reload/vorlesehilfe-ganzdokument.test.ts",
      "tests/ux19-speichern-oeffnen-reload/wartebudget-waechter.test.ts",
      "tests/vertraulichkeit-hinweis/hinweis-bleibt-schmal-lesbar.test.ts",
    ],
  ],
]);

// ---- Quelltextgang -------------------------------------------------------------------------------

function gehe(ordner: string, hinein: string[]): string[] {
  for (const eintrag of readdirSync(ordner)) {
    if (NICHT_BETRETEN.has(eintrag)) {
      continue;
    }
    const pfad = join(ordner, eintrag);
    if (statSync(pfad).isDirectory()) {
      gehe(pfad, hinein);
    } else if (eintrag.endsWith(".ts") || eintrag.endsWith(".tsx")) {
      hinein.push(pfad);
    }
  }
  return hinein;
}

/** Ein Pfad in der Schreibweise, in der `git` und die Register ihn führen. */
function alsPosix(absolut: string): string {
  return relative(WURZEL, absolut).split("\\").join("/");
}

function baum(pfad: string): ts.SourceFile {
  return ts.createSourceFile(
    pfad,
    readFileSync(pfad, "utf8"),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    pfad.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** Jeder Knoten des Baums, einmal. */
function knoten(wurzel: ts.Node): ts.Node[] {
  const alle: ts.Node[] = [];
  const gang = (n: ts.Node): void => {
    alle.push(n);
    n.forEachChild(gang);
  };
  gang(wurzel);
  return alle;
}

/** Der Modulspezifizierer eines Import-/Export-Knotens — oder `undefined`. */
function modulSpezifizierer(n: ts.Node): string | undefined {
  const spez = ts.isImportDeclaration(n)
    ? n.moduleSpecifier
    : ts.isExportDeclaration(n)
      ? n.moduleSpecifier
      : undefined;
  return spez !== undefined && ts.isStringLiteral(spez) ? spez.text : undefined;
}

/**
 * WELCHE Bühnen importiert diese Datei? Gemessen am Modulspezifizierer, nicht am Text — und in EINER
 * Antwort, damit eine Datei, die zwei Bühnen benutzt, EINMAL gemeldet wird und nicht zweimal.
 */
function buehnenVon(sf: ts.SourceFile): Buehne[] {
  const gefunden: Buehne[] = [];
  for (const n of knoten(sf)) {
    const spez = modulSpezifizierer(n);
    if (spez === undefined) {
      continue;
    }
    for (const b of BUEHNEN) {
      if (b.muster.test(spez) && !gefunden.includes(b)) {
        gefunden.push(b);
      }
    }
  }
  return gefunden;
}

/**
 * Die lokalen Namen, unter denen eine Bühne in dieser Datei erreichbar ist.
 *
 * WARUM ÜBER DIE IMPORTBINDUNG UND NICHT ÜBER DEN NAMEN „Seite": alle drei Bühnen nennen ihren
 * Seitentyp `Seite`, und `tests/profil-schmal/schmal-buehne.ts:47` deklariert sogar ein EIGENES
 * `export interface Seite`, obwohl sie aus h6 nur `BrowserFn`, `DIST`, `ORIGIN` und `fn` holt. Wer
 * am Namen hängt, misst dort gegen eine Bühne, die die Datei gar nicht benutzt. Die Bindung sagt
 * die Wahrheit: `propertyName` ist der Name IN der Bühne, `name` der Name in dieser Datei.
 */
interface Bindungen {
  /** lokaler Name des Seitentyps → Bühne */
  readonly seiten: ReadonlyMap<string, Buehne>;
  /** lokaler Name des Behältertyps (`H4Stand`/`Stand`/`Buehne`) → Bühne */
  readonly staende: ReadonlyMap<string, Buehne>;
}

function bindungenVon(sf: ts.SourceFile): Bindungen {
  const seiten = new Map<string, Buehne>();
  const staende = new Map<string, Buehne>();
  for (const n of knoten(sf)) {
    if (!ts.isImportDeclaration(n) || n.importClause === undefined) {
      continue;
    }
    const spez = modulSpezifizierer(n);
    const buehne = BUEHNEN.find((b) => spez !== undefined && b.muster.test(spez));
    if (buehne === undefined) {
      continue;
    }
    const bindung = n.importClause.namedBindings;
    if (bindung === undefined || !ts.isNamedImports(bindung)) {
      continue;
    }
    for (const spec of bindung.elements) {
      const inDerBuehne = (spec.propertyName ?? spec.name).text;
      const hier = spec.name.text;
      if (inDerBuehne === buehne.seitentyp) {
        seiten.set(hier, buehne);
      }
      if (inDerBuehne === buehne.standtyp) {
        staende.set(hier, buehne);
      }
    }
  }
  return { seiten, staende };
}

// ---- Felder eines Typs ---------------------------------------------------------------------------

/** Feldname → seine Unterfelder (leer, wenn der Feldtyp kein Objekt ist). */
type Felder = Map<string, string[]>;

const NICHT_AUFLOESBAR = "<Feldtyp nicht auflösbar>";

function namenVon(mitglied: ts.TypeElement, sf: ts.SourceFile): string | null {
  const name = mitglied.name;
  if (name === undefined) {
    return null;
  }
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText(sf);
}

/**
 * Die Felder EINES Typliterals oder EINER lokalen Deklaration — ohne das, was von `Seite` geerbt
 * wird. Geerbtes ist keine Aufweitung; nachgereichtes schon.
 */
function felderAus(
  mitglieder: readonly ts.TypeElement[],
  sf: ts.SourceFile,
  lokal: ReadonlyMap<string, ts.TypeNode | readonly ts.TypeElement[]>,
): Felder {
  const felder: Felder = new Map();
  for (const m of mitglieder) {
    const name = namenVon(m, sf);
    if (name === null) {
      continue;
    }
    felder.set(name, unterfelder(m, sf, lokal));
  }
  return felder;
}

/**
 * Was hinter einem Typausdruck steckt.
 *
 * DREI AUSGÄNGE, WEIL ES DREI LAGEN GIBT (Korrekturpflicht 1, Prüfer BEN zu JOB 3564 Runde 2):
 * Runde 2 löste einen benannten Typ nur auf, wenn er als `interface` geschrieben war — `type X = { … }`
 * fiel lautlos durch, obwohl es dieselbe Sache ist. Deshalb wird hier nicht mehr nach der
 * Schreibweise gefragt, sondern nach dem, was am Ende der Kette steht: Mitglieder, kein Objekt, oder
 * unbekannt. Nur „unbekannt" (ein Name, der aus dieser Datei hinausführt) ist die Zweifelslage.
 */
type Aufloesung =
  | { art: "mitglieder"; mitglieder: readonly ts.TypeElement[] }
  | { art: "kein-objekt" }
  | { art: "unbekannt" };

const KEIN_OBJEKT: Aufloesung = { art: "kein-objekt" };
const UNBEKANNT: Aufloesung = { art: "unbekannt" };

/**
 * KLAMMERN SIND SCHREIBWEISE, KEINE SACHE (Korrekturpflicht 1, Prüfer BEN zu JOB 3609 Runde 1).
 * `(A & B)` ist dasselbe wie `A & B`; TypeScript liest beides gleich, der Wächter von Runde 1 nicht:
 * er fragte `ts.isIntersectionTypeNode(n.type)` direkt am Aliastyp und sah bei einer Klammer nichts.
 * Jede Stelle, die einen Typausdruck ZERLEGT, geht ab jetzt durch diese zwei Funktionen.
 */
function ohneKlammern(t: ts.TypeNode): ts.TypeNode {
  let kern = t;
  while (ts.isParenthesizedTypeNode(kern)) {
    kern = kern.type;
  }
  return kern;
}

/**
 * Die Teile einer Schnittmenge — durch Klammern hindurch und über geschachtelte Schnittmengen flach.
 * Ein Typ, der keine Schnittmenge ist, ist sein eigener einziger Teil.
 */
function schnittTeile(t: ts.TypeNode): ts.TypeNode[] {
  const kern = ohneKlammern(t);
  if (!ts.isIntersectionTypeNode(kern)) {
    return [kern];
  }
  const flach: ts.TypeNode[] = [];
  for (const teil of kern.types) {
    flach.push(...schnittTeile(teil));
  }
  return flach;
}

function aufloesen(
  typ: ts.TypeNode,
  lokal: ReadonlyMap<string, ts.TypeNode | readonly ts.TypeElement[]>,
  gesehen: ReadonlySet<string> = new Set(),
): Aufloesung {
  if (ts.isParenthesizedTypeNode(typ)) {
    return aufloesen(typ.type, lokal, gesehen);
  }
  if (ts.isTypeLiteralNode(typ)) {
    return { art: "mitglieder", mitglieder: typ.members };
  }
  if (ts.isIntersectionTypeNode(typ)) {
    // `Seite & { mouse: … }` oder `Buehne["seite"] & { keyboard: … }`: die Bezugnahme auf die Bühne
    // führt aus der Datei hinaus (unbekannt), das Literal daneben ist die Aufweitung. Gemeldet wird,
    // was hier neu dazukommt.
    const mitglieder: ts.TypeElement[] = [];
    for (const teil of typ.types) {
      const auf = aufloesen(teil, lokal, gesehen);
      if (auf.art === "mitglieder") {
        mitglieder.push(...auf.mitglieder);
      }
    }
    return mitglieder.length > 0 ? { art: "mitglieder", mitglieder } : UNBEKANNT;
  }
  if (ts.isTypeReferenceNode(typ) && ts.isIdentifier(typ.typeName)) {
    const name = typ.typeName.text;
    if (gesehen.has(name)) {
      return UNBEKANNT; // Ringschluss `type A = A` — im Zweifel nicht schweigen.
    }
    const ziel = lokal.get(name);
    if (ziel === undefined) {
      return UNBEKANNT; // Der Name führt aus dieser Datei hinaus.
    }
    if (Array.isArray(ziel)) {
      return { art: "mitglieder", mitglieder: ziel as readonly ts.TypeElement[] };
    }
    return aufloesen(ziel as ts.TypeNode, lokal, new Set([...gesehen, name]));
  }
  return KEIN_OBJEKT;
}

/**
 * Die Unterfelder eines Feldes. Sie werden gebraucht, weil eine Aufweitung sich auch INNEN
 * verstecken kann: `keyboard: { press; type }` gegen ein `Seite`, das nur `press` kennt, wäre auf
 * Feldnamen-Ebene unsichtbar. Ein Feldtyp, der sich hier nicht auflösen lässt, gilt als Aufweitung
 * (fail-closed) — ein Wächter, der im Zweifel schweigt, ist grün und nutzlos.
 */
function unterfelder(
  mitglied: ts.TypeElement,
  sf: ts.SourceFile,
  lokal: ReadonlyMap<string, ts.TypeNode | readonly ts.TypeElement[]>,
): string[] {
  if (!ts.isPropertySignature(mitglied) || mitglied.type === undefined) {
    return [];
  }
  const auf = aufloesen(mitglied.type, lokal);
  if (auf.art === "mitglieder") {
    return auf.mitglieder.map((m) => namenVon(m, sf)).filter((n): n is string => n !== null);
  }
  return auf.art === "unbekannt" ? [NICHT_AUFLOESBAR] : [];
}

// ---- Die Felder, die die `Seite` JEDER Bühne selbst kennt -----------------------------------------

/**
 * EIN FIXPUNKT STATT EINER GERATENEN ZAHL (Prüfpunkt 6, Prüfer BEN zu JOB 3609 Runde 2:
 * „Aliasauflösung ist auf acht Durchgänge begrenzt").
 *
 * Runde 2 lief `for (let runde = 0; runde < 8; runde++)`. Steht eine Aliaskette RÜCKWÄRTS im
 * Quelltext, kommt je Durchgang nur EIN Glied dazu — bei elf Gliedern war die Auflösung also
 * stillschweigend zu Ende, und die Aufweitung am Ende der Kette blieb unentdeckt. TypeScript stört
 * sich an der Länge nicht; ein Wächter, der das tut, hängt wieder an der Schreibweise.
 *
 * Die Zahl war auch ohne Not: `schritt` setzt einen Namen NUR, wenn er noch fehlt, und entfernt
 * keinen. Also wächst die Menge in jedem Durchgang mit `true` um mindestens einen Namen, und die
 * Namen sind durch die Deklarationen der Datei begrenzt — die Schleife endet von selbst. Die
 * Obergrenze bleibt trotzdem stehen, aber sie ist AUS DER DATEI abgeleitet statt geraten: sie fängt
 * einen künftigen Denkfehler in `schritt` (einen, der bereits bekannte Namen erneut meldet), nicht
 * eine lange Kette. Schlägt sie an, ist das ein Fehler im Wächter und wird laut, nicht still.
 */
function bisZumFixpunkt(deklarationen: number, schritt: () => boolean): void {
  for (let runde = 0; runde <= deklarationen; runde++) {
    if (!schritt()) {
      return;
    }
  }
  throw new Error(
    `Die Auflösung der Typnamen kam nach ${deklarationen + 1} Durchläufen nicht zur Ruhe — \`schritt\` meldet Zuwachs für Namen, die die Menge schon kennt.`,
  );
}

/** Wie viele Typ-Deklarationen diese Datei hat — die einzig ehrliche Obergrenze für den Fixpunkt. */
function deklarationsZahl(alle: readonly ts.Node[]): number {
  return alle.filter((n) => ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)).length;
}

function lokaleTypen(sf: ts.SourceFile): Map<string, ts.TypeNode | readonly ts.TypeElement[]> {
  const lokal = new Map<string, ts.TypeNode | readonly ts.TypeElement[]>();
  for (const n of knoten(sf)) {
    if (ts.isInterfaceDeclaration(n)) {
      lokal.set(n.name.text, n.members);
    } else if (ts.isTypeAliasDeclaration(n)) {
      lokal.set(n.name.text, n.type);
    }
  }
  return lokal;
}

/**
 * Gelesen aus der Bühnendatei — bei JEDEM Lauf neu. Nichts hier ist abgeschrieben: trägt jemand ein
 * Feld in `Seite` einer Bühne ein, weiß dieser Wächter es sofort, und die Verbraucher, die es bisher
 * selbst nachreichten, werden dadurch von selbst sauber.
 */
function seitenFelder(b: Buehne): Felder {
  const pfad = join(WURZEL, b.pfad);
  const sf = baum(pfad);
  const lokal = lokaleTypen(sf);
  const seite = knoten(sf).find(
    (n): n is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(n) && n.name.text === b.seitentyp,
  );
  if (seite === undefined) {
    throw new Error(
      `${b.pfad}: \`export interface ${b.seitentyp}\` nicht gefunden — der Wächter misst nichts.`,
    );
  }
  return felderAus(seite.members, sf, lokal);
}

const FELDER: ReadonlyMap<string, Felder> = new Map(BUEHNEN.map((b) => [b.kurz, seitenFelder(b)]));

function felderVon(kurz: string): Felder {
  const f = FELDER.get(kurz);
  if (f === undefined) {
    throw new Error(
      `Bühne „${kurz}" ist nicht im Register — BUEHNEN und Meldung laufen auseinander.`,
    );
  }
  return f;
}

/**
 * Die Feldmenge, gegen die eine Aufweitung gemessen wird, wenn die Bühne NICHT eindeutig bestimmbar
 * ist (eine Datei importiert zwei Bühnen und der Typ verrät nicht, welche gemeint ist).
 *
 * FAIL-CLOSED: bekannt ist nur, was ALLE beteiligten Bühnen kennen. Die Vereinigung wäre der
 * bequeme und der falsche Weg — sie würde `keyboard` aus h4 als „bekannt" an h6 durchwinken.
 */
function schnittmengeDerFelder(kurznamen: readonly string[]): Felder {
  const mengen = kurznamen.map(felderVon);
  const erste = mengen[0];
  if (erste === undefined) {
    return new Map();
  }
  const gemeinsam: Felder = new Map();
  for (const [name, unter] of erste) {
    if (!mengen.every((m) => m.has(name))) {
      continue;
    }
    gemeinsam.set(
      name,
      unter.filter((u) => mengen.every((m) => (m.get(name) ?? []).includes(u))),
    );
  }
  return gemeinsam;
}

// ---- Die Aufweitungen einer Verbraucherdatei -----------------------------------------------------

interface Aufweitung {
  datei: string;
  zeile: number;
  name: string;
  art: "erweiterung" | "cast" | "indizierter-alias";
  /** Kurzname der Bühne — oder „mehrdeutig", wenn die Datei mehrere importiert. */
  buehne: string;
  /** Was die `Seite` dieser Bühne an dieser Stelle NICHT kennt — genau das, was dorthin gehört. */
  fehlt: string[];
}

/** Ist das ein indizierter Zugriff auf das Feld `seite` (`Buehne["seite"]`)? */
function istSeitenZugriff(t: ts.TypeNode): t is ts.IndexedAccessTypeNode {
  const kern = ohneKlammern(t);
  if (!ts.isIndexedAccessTypeNode(kern)) {
    return false;
  }
  const index = ohneKlammern(kern.indexType);
  return (
    ts.isLiteralTypeNode(index) &&
    ts.isStringLiteral(index.literal) &&
    index.literal.text === "seite"
  );
}

/**
 * Der Name des BEHÄLTERS in einem indizierten Seitenzugriff — durch Klammern hindurch
 * (`(Buehne)["seite"]` ist `Buehne["seite"]`). `undefined`, wenn der Behälter kein schlichter Name
 * ist (etwa `{ seite: … }["seite"]`); dann ist die Bühne aus der Schreibweise nicht ablesbar.
 */
function behaelterName(t: ts.TypeNode): string | undefined {
  const kern = ohneKlammern(t);
  if (!ts.isIndexedAccessTypeNode(kern)) {
    return undefined;
  }
  const obj = ohneKlammern(kern.objectType);
  return ts.isTypeReferenceNode(obj) && ts.isIdentifier(obj.typeName)
    ? obj.typeName.text
    : undefined;
}

/**
 * DIE BEHÄLTERNAMEN DIESER DATEI → IHRE BÜHNE (Korrekturpflicht 1, Prüfer BEN zu JOB 3609 Runde 1).
 *
 * Runde 1 schlug den Behälter AUSSCHLIESSLICH in den Importbindungen nach. Wer ihn lokal umbenannte
 * — `type MeinStand = Buehne; type X = MeinStand["seite"] & { … }` —, lief an der Prüfung vorbei:
 * BEN hat genau das gemessen, zehn von zehn Fällen blieben grün. Also wächst die Menge hier
 * genauso über einen Fixpunkt, wie `seitenTypen` es für die Seitentypen tut:
 *   · `type S = Buehne`            — die schlichte Umbenennung, auch geklammert.
 *   · `type S = Buehne & { … }`    — die Umbenennung mit Zutat.
 *   · `interface S extends Buehne` — dieselbe Sache als Interface.
 * Ein Ringschluss (`type A = B; type B = A`) bricht von selbst ab: ein Name wird nur EINMAL gesetzt,
 * und ohne Zuwachs endet die Schleife. Seit Runde 3 läuft sie bis zum FIXPUNKT statt acht Mal — auch
 * eine rückwärts deklarierte Kette beliebiger Länge kommt an (`bisZumFixpunkt`, BEN Prüfpunkt 6).
 */
function standTypen(sf: ts.SourceFile, bindungen: Bindungen): Map<string, Buehne> {
  const menge = new Map<string, Buehne>(bindungen.staende);
  const alle = knoten(sf);
  bisZumFixpunkt(deklarationsZahl(alle), () => {
    let gewachsen = false;
    for (const n of alle) {
      if (ts.isTypeAliasDeclaration(n) && !menge.has(n.name.text)) {
        for (const t of schnittTeile(n.type)) {
          const von =
            ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName)
              ? menge.get(t.typeName.text)
              : undefined;
          if (von !== undefined) {
            menge.set(n.name.text, von);
            gewachsen = true;
          }
        }
      }
      if (ts.isInterfaceDeclaration(n) && !menge.has(n.name.text)) {
        for (const h of n.heritageClauses ?? []) {
          for (const t of h.types) {
            const von = ts.isIdentifier(t.expression) ? menge.get(t.expression.text) : undefined;
            if (von !== undefined) {
              menge.set(n.name.text, von);
              gewachsen = true;
            }
          }
        }
      }
    }
    return gewachsen;
  });
  return menge;
}

/**
 * Welche Typnamen dieser Datei stehen für die Seite EINER Bühne — und für welche?
 *
 * Gesät wird aus der Importbindung (nicht aus dem Namen), und dann wächst die Menge über drei Wege:
 *   (a) `interface B extends A` — die offene Erweiterung.
 *   (b) `type B = A & { … }` — dieselbe Sache als Schnittmenge.
 *   (c) `type B = Stand["seite"] & { … }` — der indizierte Zugriff auf den Behälter der Bühne. Das
 *       ist die DRITTE Schreibweise, belegt an
 *       `tests/import-anleitung-modus/tastatur-importart-chromium.test.ts:35` und
 *       `tests/ux19-speichern-oeffnen-reload/ux19-buehne.ts:48`. Bis JOB 3609 sah sie niemand.
 *
 * Zerlegt wird über `schnittTeile` (Klammern hindurch) und nachgeschlagen in `staende` — der über
 * `standTypen` ERWEITERTEN Behältermenge, nicht in den nackten Importbindungen. Beides sind die
 * zwei Lücken, die BEN an Runde 1 gemessen hat.
 */
function seitenTypen(
  sf: ts.SourceFile,
  bindungen: Bindungen,
  staende: ReadonlyMap<string, Buehne>,
): Map<string, Buehne> {
  const menge = new Map<string, Buehne>(bindungen.seiten);
  // Mehrfach laufen: `A extends Seite`, `B extends A` — die Kette kann in jeder Reihenfolge stehen,
  // und sie darf beliebig lang sein (Fixpunkt statt der geratenen Acht aus Runde 2).
  const alle = knoten(sf);
  bisZumFixpunkt(deklarationsZahl(alle), () => {
    let gewachsen = false;
    for (const n of alle) {
      if (ts.isInterfaceDeclaration(n) && !menge.has(n.name.text)) {
        for (const h of n.heritageClauses ?? []) {
          for (const t of h.types) {
            const von = ts.isIdentifier(t.expression) ? menge.get(t.expression.text) : undefined;
            if (von !== undefined) {
              menge.set(n.name.text, von);
              gewachsen = true;
            }
          }
        }
      }
      if (ts.isTypeAliasDeclaration(n) && !menge.has(n.name.text)) {
        for (const t of schnittTeile(n.type)) {
          const ueberNamen =
            ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName)
              ? menge.get(t.typeName.text)
              : undefined;
          const behaelter = istSeitenZugriff(t) ? behaelterName(t) : undefined;
          const ueberZugriff = behaelter === undefined ? undefined : staende.get(behaelter);
          const von = ueberNamen ?? ueberZugriff;
          if (von !== undefined) {
            menge.set(n.name.text, von);
            gewachsen = true;
          }
        }
      }
    }
    return gewachsen;
  });
  return menge;
}

/**
 * Namen, hinter denen in dieser Datei eine Seite steckt — und, soweit erkennbar, aus welcher Bühne:
 * alles, was ausdrücklich einen Seitentyp trägt, jede Funktion, die eine Seite zurückgibt (auch als
 * `H4Stand["seite"]`), und jeder Zugriff `.seite`. Der Wert `null` heisst „Seite, Bühne unklar".
 */
function seitenNamen(
  sf: ts.SourceFile,
  typen: ReadonlyMap<string, Buehne>,
  staende: ReadonlyMap<string, Buehne>,
): Map<string, Buehne | null> {
  const namen = new Map<string, Buehne | null>();
  /** `undefined` = keine Seite; sonst die Bühne oder `null` für „Seite, Bühne unklar". */
  const seitenHerkunft = (typ: ts.TypeNode | undefined): Buehne | null | undefined => {
    if (typ === undefined) {
      return undefined;
    }
    const t = ohneKlammern(typ);
    if (ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName)) {
      const b = typen.get(t.typeName.text);
      return b === undefined ? undefined : b;
    }
    if (istSeitenZugriff(t)) {
      const behaelter = behaelterName(t);
      return behaelter === undefined ? null : (staende.get(behaelter) ?? null);
    }
    return undefined;
  };
  for (const n of knoten(sf)) {
    if (ts.isParameter(n) || ts.isVariableDeclaration(n)) {
      const herkunft = seitenHerkunft(n.type);
      if (herkunft !== undefined && ts.isIdentifier(n.name)) {
        namen.set(n.name.text, herkunft);
      }
    }
    if (ts.isFunctionDeclaration(n) && n.name !== undefined) {
      const herkunft = seitenHerkunft(n.type);
      if (herkunft !== undefined) {
        namen.set(n.name.text, herkunft);
      }
    }
  }
  return namen;
}

/** Steckt hinter diesem Ausdruck die Seite einer Bühne? */
function istSeitenAusdruck(e: ts.Expression, namen: ReadonlyMap<string, Buehne | null>): boolean {
  if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) {
    return istSeitenAusdruck(e.expression, namen);
  }
  if (ts.isIdentifier(e)) {
    return namen.has(e.text) || e.text === "seite" || e.text === "page";
  }
  if (ts.isPropertyAccessExpression(e)) {
    return e.name.text === "seite" || istSeitenAusdruck(e.expression, namen);
  }
  if (ts.isCallExpression(e)) {
    const ruf = e.expression;
    if (ts.isIdentifier(ruf)) {
      return namen.has(ruf.text) || ruf.text === "seite";
    }
    return ts.isPropertyAccessExpression(ruf) && ruf.name.text === "seite";
  }
  return false;
}

/** Die Bühne hinter einem Seitenausdruck, soweit sie aus der Datei hervorgeht. */
function buehneVonAusdruck(
  e: ts.Expression,
  namen: ReadonlyMap<string, Buehne | null>,
): Buehne | null {
  if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) {
    return buehneVonAusdruck(e.expression, namen);
  }
  if (ts.isIdentifier(e)) {
    return namen.get(e.text) ?? null;
  }
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) {
    return namen.get(e.expression.text) ?? null;
  }
  if (ts.isPropertyAccessExpression(e)) {
    return buehneVonAusdruck(e.expression, namen);
  }
  return null;
}

function ueberschuss(eigen: Felder, bekannt: Felder): string[] {
  const fehlt: string[] = [];
  for (const [name, unter] of eigen) {
    const bekannteUnter = bekannt.get(name);
    if (bekannteUnter === undefined) {
      fehlt.push(name);
      continue;
    }
    for (const u of unter) {
      if (!bekannteUnter.includes(u)) {
        fehlt.push(`${name}.${u}`);
      }
    }
  }
  return fehlt;
}

/**
 * Die Erhebung über einen fertigen Baum statt über einen Dateipfad — bewusst NUR so, damit die
 * Kalibrierung (V6) den Wächter mit Quelltext im Speicher füttern kann, ohne eine echte Testdatei
 * anzufassen: eine Gegenprobe, die dauerhaft im Lauf steht, statt einmal von Hand gefahren zu werden.
 */
function aufweitungenAusBaum(sf: ts.SourceFile, datei: string): Aufweitung[] {
  const dateiBuehnen = buehnenVon(sf);
  if (dateiBuehnen.length === 0) {
    return [];
  }
  const kurznamen = dateiBuehnen.map((b) => b.kurz);
  const bindungen = bindungenVon(sf);
  const lokal = lokaleTypen(sf);
  // Erst die Behälter (samt lokaler Umbenennungen), dann die Seitentypen — der zweite Schritt liest
  // den ersten: `type S = Buehne; type X = S["seite"] & { … }`.
  const staende = standTypen(sf, bindungen);
  const typen = seitenTypen(sf, bindungen, staende);
  const namen = seitenNamen(sf, typen, staende);
  const gefunden = new Map<string, Aufweitung>();

  /** Die Feldmenge, gegen die gemessen wird — und der Name der Bühne in der Meldung. */
  const messlatte = (b: Buehne | null): { bekannt: Felder; buehne: string } =>
    b !== null
      ? { bekannt: felderVon(b.kurz), buehne: b.kurz }
      : dateiBuehnen.length === 1 && dateiBuehnen[0] !== undefined
        ? { bekannt: felderVon(dateiBuehnen[0].kurz), buehne: dateiBuehnen[0].kurz }
        : {
            bekannt: schnittmengeDerFelder(kurznamen),
            buehne: `mehrdeutig (${kurznamen.join("+")})`,
          };

  const melde = (
    knoten_: ts.Node,
    name: string,
    art: Aufweitung["art"],
    felder: Felder,
    b: Buehne | null,
  ): void => {
    const latte = messlatte(b);
    const fehlt = ueberschuss(felder, latte.bekannt);
    if (fehlt.length === 0 || gefunden.has(name)) {
      return;
    }
    gefunden.set(name, {
      datei,
      zeile: sf.getLineAndCharacterOfPosition(knoten_.getStart(sf)).line + 1,
      name,
      art,
      buehne: latte.buehne,
      fehlt,
    });
  };

  for (const n of knoten(sf)) {
    // (1) `interface X extends Seite { … }` — die offene Aufweitung.
    if (ts.isInterfaceDeclaration(n) && !bindungen.seiten.has(n.name.text)) {
      const b = typen.get(n.name.text);
      if (b !== undefined) {
        melde(n, n.name.text, "erweiterung", felderAus(n.members, sf, lokal), b);
      }
    }
    // (2) `type X = Seite & { … }` und (3) `type X = Buehne["seite"] & { … }` — dieselbe Sache in
    // Kurzschreibweise. Welche der beiden es ist, entscheidet der indizierte Zugriff; aufgelöst wird
    // beides gleich.
    if (ts.isTypeAliasDeclaration(n) && !bindungen.seiten.has(n.name.text)) {
      const b = typen.get(n.name.text);
      if (b !== undefined) {
        const auf = aufloesen(n.type, lokal);
        if (auf.art === "mitglieder") {
          const ueberZugriff = schnittTeile(n.type).some(istSeitenZugriff);
          melde(
            n,
            n.name.text,
            ueberZugriff ? "indizierter-alias" : "erweiterung",
            felderAus(auf.mitglieder, sf, lokal),
            b,
          );
        }
      }
    }
    // (4) Der Cast: `seite() as unknown as X`, `stand.seite as X`, `s as unknown as { … }` —
    // gleichgültig, ob X ein Interface, ein Typalias, ein Typliteral oder eine Schnittmenge ist.
    // Der Auflöser oben entscheidet das, nicht diese Stelle: eine Schreibweise mehr darf keine
    // Prüflücke mehr sein (Korrekturpflicht 1 zu JOB 3564 Runde 2).
    if (ts.isAsExpression(n) && istSeitenAusdruck(n.expression, namen)) {
      const auf = aufloesen(n.type, lokal);
      if (auf.art === "mitglieder") {
        const felder = felderAus(auf.mitglieder, sf, lokal);
        // Auch hier durch die Klammern hindurch: `as unknown as (KMaus)` nennt denselben Typ.
        const ziel = ohneKlammern(n.type);
        const zielName =
          ts.isTypeReferenceNode(ziel) && ts.isIdentifier(ziel.typeName)
            ? ziel.typeName.text
            : undefined;
        const benannt = zielName ?? `{ ${[...felder.keys()].join(", ")} }`;
        const ausTyp = zielName === undefined ? null : (typen.get(zielName) ?? null);
        melde(n, benannt, "cast", felder, ausTyp ?? buehneVonAusdruck(n.expression, namen));
      }
    }
  }
  return [...gefunden.values()];
}

// ---- Die Erhebung, EINMAL je Lauf ----------------------------------------------------------------
//
// Ein Gang über `tests/`, nicht drei: je Datei wird einmal geparst und dann zugeordnet. Die gemessene
// Dauer steht in `ERHEBUNG_MS` und wird von V8 festgehalten, damit ein Ausreisser auffällt.
const BEGINN = Date.now();
const ALLE_DATEIEN = gehe(TESTS, []).map(alsPosix);
/** Verbraucherdatei → die Bühnen, die sie importiert. EINE Zeile je Datei, auch bei zwei Bühnen. */
const VERBRAUCHER = new Map<string, Buehne[]>();
const BEFUND: Aufweitung[] = [];
for (const datei of ALLE_DATEIEN.sort()) {
  if (datei === SELBST) {
    continue;
  }
  const sf = baum(join(WURZEL, datei));
  const buehnen = buehnenVon(sf);
  if (buehnen.length === 0) {
    continue;
  }
  VERBRAUCHER.set(datei, buehnen);
  BEFUND.push(...aufweitungenAusBaum(sf, datei));
}
const ERHEBUNG_MS = Date.now() - BEGINN;

/** Die Verbraucher EINER Bühne. */
function verbraucherVon(kurz: string): string[] {
  return [...VERBRAUCHER.entries()]
    .filter(([, bs]) => bs.some((b) => b.kurz === kurz))
    .map(([d]) => d)
    .sort();
}

function zeile(a: Aufweitung): string {
  return `[${a.buehne}] ${a.datei}:${a.zeile} · ${a.art} „${a.name}" reicht nach: ${a.fehlt.join(", ")}`;
}

// ---- Die Kalibrierung: derselbe Verstoß in jeder Schreibweise, an jeder Bühne ---------------------
//
// WARUM ES DIESEN ABSCHNITT GIBT (Prüfer BEN, JOB 3564 Runde 2). Runde 2 löste ein benanntes
// Cast-Ziel nur auf, wenn es ein `interface` war; derselbe Verstoß als `type X = { … }` blieb
// unentdeckt — der Wächter hing an der SCHREIBWEISE, nicht an der Sache. JOB 3609 fügt die zweite
// Achse dazu: derselbe Verstoß an einer ANDEREN BÜHNE blieb unentdeckt, weil der Wächter an EINER
// Bühne hing. Hier steht beides nebeneinander, dauerhaft im Lauf.
//
// Die Fälle sind Quelltext im Speicher, keine echten Dateien: so kalibriert sich der Wächter, ohne
// dass jemand eine Verbraucherdatei absichtlich verunreinigen müsste. Jeder Fall benutzt DIESELBE
// unbekannte Seitenfunktion (`mouse.click`), damit allein Schreibweise und Bühne sich unterscheiden.
const MAUS = "{ click(x: number, y: number): Promise<void> }";
/** Ein Feld, das JEDE der drei Bühnen selbst kennt — der Negativfall darf daran nicht anschlagen. */
const BEKANNTES_FELD = "{ goto(url: string): Promise<unknown> }";

interface Kalibrierfall {
  readonly name: string;
  readonly quelle: string;
  /** Was der Wächter melden MUSS — leer heisst: dieser Fall ist erlaubt und bleibt still. */
  readonly erwartet: readonly string[];
  /** An welcher Bühne die Meldung hängen muss — leer, wenn nichts gemeldet wird. */
  readonly buehne: string;
}

/** Der Importpfad, unter dem eine Bühne von `tests/design-vorrichtung/` aus erreichbar wäre. */
function importPfad(b: Buehne): string {
  return `../${b.pfad.replace(/^tests\//, "").replace(/\.ts$/, "")}`;
}

function kalibrierfaelle(): Kalibrierfall[] {
  const faelle: Kalibrierfall[] = [];
  for (const b of BUEHNEN) {
    const pfad = importPfad(b);
    const kopf = `import type { ${b.seitentyp}, ${b.standtyp} } from "${pfad}";\ndeclare function seite(): ${b.standtyp}["seite"];\n`;
    faelle.push({
      name: `${b.kurz} · Schreibweise 1: Interface-Erweiterung`,
      quelle: `${kopf}interface KMaus extends ${b.seitentyp} { mouse: ${MAUS} }\nasync function probe(): Promise<void> { await (seite() as unknown as KMaus).mouse.click(1, 2); }`,
      erwartet: ["mouse"],
      buehne: b.kurz,
    });
    faelle.push({
      name: `${b.kurz} · Schreibweise 2: Cast auf ein Typliteral`,
      quelle: `${kopf}async function probe(): Promise<void> {\n  await (seite() as unknown as { mouse: ${MAUS} }).mouse.click(1, 2);\n}`,
      erwartet: ["mouse"],
      buehne: b.kurz,
    });
    faelle.push({
      name: `${b.kurz} · Schreibweise 3: Typalias über den indizierten Zugriff`,
      quelle: `${kopf}type KMaus = ${b.standtyp}["seite"] & { mouse: ${MAUS} };\ndeclare const k: KMaus;\n`,
      erwartet: ["mouse"],
      buehne: b.kurz,
    });
    // ---- Schreibweise 3, zwei Tarnungen (Korrekturpflicht 1, Prüfer BEN zu JOB 3609 Runde 1) ----
    //
    // Runde 1 fand den indizierten Zugriff nur in seiner NACKTEN Form. BEN hat zwei Tarnungen
    // gemessen, die beide durchkamen, obwohl sie dieselbe Sache sind:
    //   3a — die rechte Typseite zusätzlich geklammert: `type K = (Stand["seite"] & { … })`.
    //        Klammern sind Schreibweise, keine Sache; TypeScript liest beides gleich.
    //   3b — der Behälter über einen LOKALEN Alias: `type S = Stand; type K = S["seite"] & { … }`.
    //        Die Importbindung kennt nur `Stand`; der Alias führte an ihr vorbei.
    // Beide stehen hier je Bühne dreifach: unerlaubtes Feld (Fund), erlaubtes Feld (kein Fund),
    // derselbe Wortlaut als Kommentar (kein Fund) — sonst belegt der Fall nur die halbe Aussage.
    faelle.push({
      name: `${b.kurz} · Schreibweise 3a: indizierter Zugriff, die rechte Typseite geklammert`,
      quelle: `${kopf}type KMaus = (${b.standtyp}["seite"] & { mouse: ${MAUS} });\ndeclare const k: KMaus;\n`,
      erwartet: ["mouse"],
      buehne: b.kurz,
    });
    faelle.push({
      name: `${b.kurz} · Gegenstück zu 3a: geklammert, aber nur ein Feld, das die Bühne kennt`,
      quelle: `${kopf}type KBekannt = (${b.standtyp}["seite"] & ${BEKANNTES_FELD});\ndeclare const k: KBekannt;\n`,
      erwartet: [],
      buehne: "",
    });
    faelle.push({
      name: `${b.kurz} · Gegenstück zu 3a: der geklammerte Wortlaut als KOMMENTAR`,
      quelle: `${kopf}// type KMaus = (${b.standtyp}["seite"] & { mouse: ${MAUS} });\nexport const nichts3a = 1;\n`,
      erwartet: [],
      buehne: "",
    });
    faelle.push({
      name: `${b.kurz} · Schreibweise 3b: indizierter Zugriff über einen lokalen Behälteralias`,
      quelle: `${kopf}type KStand = ${b.standtyp};\ntype KMaus = KStand["seite"] & { mouse: ${MAUS} };\ndeclare const k: KMaus;\n`,
      erwartet: ["mouse"],
      buehne: b.kurz,
    });
    faelle.push({
      name: `${b.kurz} · Gegenstück zu 3b: über den Alias, aber nur ein Feld, das die Bühne kennt`,
      quelle: `${kopf}type KStand = ${b.standtyp};\ntype KBekannt = KStand["seite"] & ${BEKANNTES_FELD};\ndeclare const k: KBekannt;\n`,
      erwartet: [],
      buehne: "",
    });
    faelle.push({
      name: `${b.kurz} · Gegenstück zu 3b: der Alias-Wortlaut als KOMMENTAR`,
      quelle: `${kopf}// type KStand = ${b.standtyp};\n// type KMaus = KStand["seite"] & { mouse: ${MAUS} };\nexport const nichts3b = 1;\n`,
      erwartet: [],
      buehne: "",
    });
    // ---- Die drei GRENZEN, die BEN an Runde 2 benannt hat (Prüfpunkt 6, „für Folgearbeit") -------
    //
    // Runde 2 war grün, aber BEN hat drei Stellen genannt, an denen der Auflöser bis dahin nur
    // BEHAUPTET war und nicht gemessen: die lange rückwärts deklarierte Aliaskette, der Ringschluss
    // und der Verbraucher aus dritter Hand. Zwei davon sind echte Grenzen und bleiben welche — dann
    // stehen sie hier als Fall MIT ihrer Begründung, statt nur im Kopfkommentar behauptet zu sein.
    // Die dritte war keine Grenze, sondern eine geratene Zahl; sie ist in dieser Runde weg (§`bisZumFixpunkt`).

    // (3c) DIE LANGE, RÜCKWÄRTS DEKLARIERTE KETTE. Runde 2 lief genau acht Durchgänge. Weil je
    // Durchgang nur EIN Glied dazukommt, wenn die Kette rückwärts im Quelltext steht, war bei elf
    // Gliedern Schluss — die Aufweitung am Ende der Kette blieb unentdeckt. TypeScript stört sich an
    // der Länge nicht, also darf dieser Wächter es auch nicht. Elf Glieder: mit der alten Zahl rot.
    const KETTENGLIEDER = 11;
    const kette = Array.from({ length: KETTENGLIEDER }, (_, i) =>
      i === 0 ? `type KK0 = ${b.standtyp};` : `type KK${i} = KK${i - 1};`,
    )
      .reverse()
      .join("\n");
    faelle.push({
      name: `${b.kurz} · Schreibweise 3c: lange RÜCKWÄRTS deklarierte Behälterkette (${KETTENGLIEDER} Glieder)`,
      quelle: `${kopf}type KMaus = KK${KETTENGLIEDER - 1}["seite"] & { mouse: ${MAUS} };\n${kette}\ndeclare const k: KMaus;\n`,
      erwartet: ["mouse"],
      buehne: b.kurz,
    });

    // (G1) DER RINGSCHLUSS. `type ZA = ZB; type ZB = ZA` ist für TypeScript ein Fehler (TS2456), kann
    // also in echtem Code gar nicht stehen — dieser Fall belegt trotzdem, dass der Auflöser daran
    // weder hängenbleibt noch eine Bühne erfindet: keiner der beiden Namen führt je zu einer Bühne,
    // also gibt es keinen Fund. Ohne diesen Fall wäre „bricht von selbst ab" eine reine Behauptung.
    faelle.push({
      name: `${b.kurz} · Grenze: Ringschluss im Behälteralias — kein Fund, und kein Hänger`,
      quelle: `${kopf}type ZA = ZB;\ntype ZB = ZA;\ntype KMaus = ZA["seite"] & { mouse: ${MAUS} };\ndeclare const k: KMaus;\n`,
      erwartet: [],
      buehne: "",
    });

    // (G2) DER VERBRAUCHER AUS DRITTER HAND. Das ist die im Kopf benannte Grenze (:45-51), und sie
    // bleibt mit Absicht eine: `tests/profil-schmal/schmal-buehne.ts` holt aus h6 nur `BrowserFn`,
    // `DIST`, `ORIGIN` und `fn` und deklariert ein EIGENES `Seite`. Wer Re-Exporte verfolgte, zählte
    // dort eine Schuld, die es nicht gibt. Also wird die Grenze GEMESSEN statt geschlossen — und
    // damit sie nicht bloß „der Testkörper sagt nichts" heisst, steht direkt daneben der GEGENPOL:
    // derselbe Rumpf, Zeichen für Zeichen, nur mit direktem Bühnenimport. Er MUSS melden.
    const rumpfAusDritterHand = `interface KMaus extends ${b.seitentyp} { mouse: ${MAUS} }\nasync function probe(): Promise<void> { await (seite() as unknown as KMaus).mouse.click(1, 2); }`;
    faelle.push({
      name: `${b.kurz} · Grenze: Verbraucher AUS DRITTER HAND (über einen re-exportierenden Helfer) wird nicht gesehen`,
      quelle: `import type { ${b.seitentyp} } from "./ein-helfer-der-die-buehne-benutzt";\ndeclare function seite(): ${b.seitentyp};\n${rumpfAusDritterHand}`,
      erwartet: [],
      buehne: "",
    });
    faelle.push({
      name: `${b.kurz} · Gegenpol zur Grenze: derselbe Rumpf, nur direkt an der Bühne — meldet`,
      quelle: `${kopf}${rumpfAusDritterHand}`,
      erwartet: ["mouse"],
      buehne: b.kurz,
    });

    // (G3) …aber der HELFER SELBST wird sehr wohl gesehen: er importiert die Bühne, also fällt er in
    // die Menge. Genau so sind `tests/navigation-schmal/kopfband-messung.ts` und
    // `tests/profil-schmal/schmal-buehne.ts` gebaut. Die Grenze aus G2 ist damit scharf gezogen: sie
    // verliert den Verbraucher zweiter Hand, nicht den Helfer, der die Aufweitung wirklich schreibt.
    faelle.push({
      name: `${b.kurz} · der re-exportierende Helfer selbst importiert die Bühne — und wird gesehen`,
      quelle: `${kopf}export type SeiteMitMaus = ${b.seitentyp} & { mouse: ${MAUS} };\nexport type { ${b.seitentyp} };\n`,
      erwartet: ["mouse"],
      buehne: b.kurz,
    });

    faelle.push({
      name: `${b.kurz} · Gegenstück: derselbe Wortlaut als KOMMENTAR wird nicht gefunden`,
      quelle: `${kopf}// interface KMaus extends ${b.seitentyp} { mouse: ${MAUS} }\n// type KMaus = ${b.standtyp}["seite"] & { mouse: ${MAUS} };\n// await (seite() as unknown as { mouse: ${MAUS} }).mouse.click(1, 2);\nexport const nichts = 1;\n`,
      erwartet: [],
      buehne: "",
    });
    faelle.push({
      name: `${b.kurz} · Gegenstück: der Cast nennt nur, was die Bühne selbst kennt`,
      quelle: `${kopf}type KBekannt = ${BEKANNTES_FELD};\nasync function probe(): Promise<void> { await (seite() as unknown as KBekannt).goto("/"); }`,
      erwartet: [],
      buehne: "",
    });
  }
  // Die historischen Fälle aus JOB 3564 — sie haben eine echte Prüflücke aufgedeckt und bleiben.
  const h4 = BUEHNEN[0];
  if (h4 !== undefined) {
    const kopf = `import type { ${h4.seitentyp}, ${h4.standtyp} } from "${importPfad(h4)}";\ndeclare function seite(): ${h4.standtyp}["seite"];\n`;
    faelle.push({
      name: "h4 · Typalias hinter einem Cast (die Lücke aus JOB 3564 Runde 2)",
      quelle: `${kopf}type KMaus = { mouse: ${MAUS} };\nasync function probe(): Promise<void> { await (seite() as unknown as KMaus).mouse.click(1, 2); }`,
      erwartet: ["mouse"],
      buehne: "h4",
    });
    faelle.push({
      name: "h4 · Schnittmenge mit `Seite` unmittelbar im Cast",
      quelle: `${kopf}async function probe(): Promise<void> {\n  await (seite() as unknown as (${h4.seitentyp} & { mouse: ${MAUS} })).mouse.click(1, 2);\n}`,
      erwartet: ["mouse"],
      buehne: "h4",
    });
    faelle.push({
      name: "h4 · verstecktes Unterfeld über einen Typalias",
      quelle: `${kopf}type KTasten = { press(taste: string): Promise<void>; type(text: string): Promise<void> };\ninterface KSeite extends ${h4.seitentyp} { keyboard: KTasten }\nasync function probe(): Promise<void> { await (seite() as KSeite).keyboard.type("abc"); }`,
      erwartet: ["keyboard.type"],
      buehne: "h4",
    });
  }
  // ---- Die mehrdeutige Lage, fail-closed ---------------------------------------------------------
  //
  // Eine Datei darf zwei Bühnen importieren — `tests/tor-bereitschaft/verzoegerte-antworten.test.ts`
  // tut es heute (h4 + h6). Lässt sich dann nicht entscheiden, WELCHE Bühne hinter einem Cast steckt,
  // misst der Wächter gegen die SCHNITTMENGE der Feldmengen: bekannt ist nur, was BEIDE kennen.
  // Ohne diese zwei Fälle stünde dieser Zweig ungemessen im Code — und die bequeme Umkehrung (die
  // VEREINIGUNG) fiele niemandem auf, obwohl sie `keyboard` aus h4 an h6 durchwinkte.
  const h4b = BUEHNEN[0];
  const h6b = BUEHNEN[1];
  if (h4b !== undefined && h6b !== undefined) {
    const kopf = `import type { ${h4b.seitentyp} as SeiteH4 } from "${importPfad(h4b)}";\nimport type { ${h6b.seitentyp} as SeiteH6 } from "${importPfad(h6b)}";\ndeclare function seite(): unknown;\n`;
    faelle.push({
      name: "mehrdeutig · `keyboard` kennt nur h4 — an h6 ist es eine Aufweitung, also wird gemeldet",
      quelle: `${kopf}async function probe(): Promise<void> { await (seite() as unknown as { keyboard: { press(t: string): Promise<void> } }).keyboard.press("Tab"); }`,
      erwartet: ["keyboard"],
      buehne: "mehrdeutig (h4+h6)",
    });
    faelle.push({
      name: "mehrdeutig · `goto` kennen BEIDE Bühnen — kein Fund",
      quelle: `${kopf}async function probe(): Promise<void> { await (seite() as unknown as ${BEKANNTES_FELD}).goto("/"); }`,
      erwartet: [],
      buehne: "",
    });
  }
  return faelle;
}

const KALIBRIERFAELLE = kalibrierfaelle();
const KALIBRIER_DATEI = "tests/design-vorrichtung/<kalibrierung>.test.ts";

function kalibriere(fall: Kalibrierfall): Aufweitung[] {
  const sf = ts.createSourceFile(
    KALIBRIER_DATEI,
    fall.quelle,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  return aufweitungenAusBaum(sf, KALIBRIER_DATEI);
}

describe("JOB 3609 · die Seiten-Typisierung wohnt in der Vorrichtung — an JEDER der drei Bühnen", () => {
  it("V1 · kein Verbraucher einer Bühne reicht sich ein Feld selbst nach, das ihre `Seite` nicht kennt", () => {
    for (const b of BUEHNEN) {
      console.info(
        `JOB 3609 · ${b.kurz} (${b.pfad}) — ${b.zweck} · ` +
          `Verbraucher: ${verbraucherVon(b.kurz).length} · ` +
          `Felder in \`${b.seitentyp}\`: ${[...felderVon(b.kurz).keys()].join(", ")}`,
      );
    }
    for (const a of BEFUND) {
      console.info(`JOB 3609 · Aufweitung: ${zeile(a)}`);
    }
    const unerlaubt = BEFUND.filter((a) => {
      const zugestanden = ALTBESTAND.get(a.datei);
      return zugestanden === undefined || a.fehlt.some((f) => !zugestanden.felder.includes(f));
    });
    expect(
      unerlaubt.map(zeile),
      "Diese Felder gehören in `export interface Seite` DER GENANNTEN BÜHNE (h4 = " +
        "tests/design/h4-harness.ts, h6 = tests/design/h6-chromium.ts, h3 = " +
        "tests/design/h3-blatt-buehne.ts), nicht in die Testdatei",
    ).toEqual([]);
  });

  it("V2 · der Altbestand verwaltet keine Gespenster: jede Zeile, jedes Feld und jede Bühne stimmt noch", () => {
    const jeDatei = new Map<string, Aufweitung[]>();
    for (const a of BEFUND) {
      jeDatei.set(a.datei, [...(jeDatei.get(a.datei) ?? []), a]);
    }
    const leichen: string[] = [];
    for (const [datei, eintrag] of ALTBESTAND) {
      const befunde = jeDatei.get(datei);
      if (befunde === undefined) {
        leichen.push(`${datei}: keine Aufweitung mehr — der Eintrag gehört gelöscht`);
        continue;
      }
      const gemessen = new Set(befunde.flatMap((a) => a.fehlt));
      for (const feld of eintrag.felder) {
        if (!gemessen.has(feld)) {
          leichen.push(
            `${datei}: „${feld}" wird nicht mehr nachgereicht — Karteileiche in der Zeile`,
          );
        }
      }
      const buehnen = new Set(befunde.map((a) => a.buehne));
      if (!buehnen.has(eintrag.buehne)) {
        leichen.push(
          `${datei}: die Zeile sagt Bühne „${eintrag.buehne}", gemessen wurde [${[...buehnen].join(", ")}]`,
        );
      }
    }
    expect(
      leichen,
      "Ein Wächter, der nichts mehr sieht, ist grün und nutzlos (JOB 3550/3562)",
    ).toEqual([]);
  });

  for (const b of BUEHNEN) {
    it(`V3-${b.kurz} · die Prüfmenge der Bühne \`${b.kurz}\` ist festgenagelt`, () => {
      // Ohne diese Fälle wäre V1 auch dann grün, wenn die Erhebung gar nichts mehr fände — die
      // teuerste Art, einen Wächter zu verlieren (`LEHREN.md`, JOB 3489, 10.09. 09:21:13).
      const pflicht = ERWARTETE_VERBRAUCHER.get(b.kurz) ?? [];
      const gemessen = verbraucherVon(b.kurz);
      console.info(
        `JOB 3609 · V3-${b.kurz}: ${gemessen.length} Verbraucher — ${gemessen.join(", ")}`,
      );
      expect(
        gemessen.length,
        `${b.pfad}: kein Verbraucher gefunden — die Erhebung ist leer`,
      ).toBeGreaterThanOrEqual(pflicht.length);
      expect(
        pflicht.filter((d) => !gemessen.includes(d)),
        `Diese Verbraucher von ${b.pfad} sind aus der Prüfmenge verschwunden`,
      ).toEqual([]);
      // Und die Grundlage selbst: `Seite` muss Felder haben, sonst wäre jede Aufweitung „bekannt".
      const felder = felderVon(b.kurz);
      expect(
        [...felder.keys()],
        `${b.pfad}: \`${b.seitentyp}\` kennt \`goto\` nicht mehr`,
      ).toContain("goto");
      expect(felder.size, `${b.pfad}: \`${b.seitentyp}\` ist leergelaufen`).toBeGreaterThanOrEqual(
        6,
      );
    });
  }

  it("V4 · der Verzeichnisgang hat den Testbaum wirklich gefunden", () => {
    expect(
      ALLE_DATEIEN.length,
      "Der Verzeichnisgang hat den Testbaum nicht gefunden",
    ).toBeGreaterThan(500);
    expect(VERBRAUCHER.size, "Keine einzige Bühne hat einen Verbraucher").toBeGreaterThan(0);
  });

  it("V5 · eine Datei, die zwei Bühnen importiert, steht EINMAL im Register — mit beiden Namen", () => {
    const doppelt = [...VERBRAUCHER.entries()].filter(([, bs]) => bs.length > 1);
    for (const [datei, bs] of doppelt) {
      console.info(`JOB 3609 · zwei Bühnen: ${datei} → ${bs.map((b) => b.kurz).join(" + ")}`);
    }
    // Die Zusage ist die Bauart, nicht der heutige Bestand: `VERBRAUCHER` ist eine Map über den
    // Dateipfad, eine Datei kann also gar nicht zweimal darin stehen. Gemessen wird das hier.
    const namen = [...VERBRAUCHER.keys()];
    expect(new Set(namen).size, "Eine Datei steht zweimal im Register").toBe(namen.length);
    // Und die Meldungen: je Datei und Typname höchstens EINE Zeile.
    const schluessel = BEFUND.map((a) => `${a.datei}::${a.name}`);
    expect(new Set(schluessel).size, "Dieselbe Aufweitung wird doppelt gemeldet").toBe(
      schluessel.length,
    );
  });

  it("V6 · kalibriert: derselbe Verstoß wird in JEDER Schreibweise und an JEDER Bühne gefunden", () => {
    // Ohne diesen Fall hängt V1 an Schreibweise und Bühne: JOB 3564 Runde 2 sah
    // `interface X { mouse … }` hinter einem Cast, `type X = { mouse … }` aber nicht; und bis JOB
    // 3609 sah niemand dasselbe an h6 oder h3. Beides ist derselbe Verstoß, also muss beides
    // denselben Fund erzeugen — mit Datei, Zeile, Typname, BÜHNE und Feld.
    const rest: string[] = [];
    for (const fall of KALIBRIERFAELLE) {
      const befund = kalibriere(fall);
      const gefunden = [...befund.flatMap((a) => a.fehlt)].sort();
      const erwartet = [...fall.erwartet].sort();
      if (gefunden.join("|") !== erwartet.join("|")) {
        rest.push(
          `${fall.name}: erwartet [${erwartet.join(", ")}], gefunden [${gefunden.join(", ")}]`,
        );
      }
      for (const a of befund) {
        if (a.zeile <= 0 || a.name === "" || a.datei !== KALIBRIER_DATEI) {
          rest.push(`${fall.name}: unbrauchbare Meldung „${zeile(a)}"`);
        }
        if (a.buehne !== fall.buehne) {
          rest.push(`${fall.name}: Bühne „${a.buehne}" gemeldet, erwartet „${fall.buehne}"`);
        }
      }
    }
    expect(
      rest,
      "Der Wächter darf weder an der Schreibweise noch an der Bühne hängen: jede dieser Formen " +
        "reicht dasselbe Feld nach und gehört gemeldet — mit der richtigen Bühne",
    ).toEqual([]);
    // Die Kalibrierung selbst darf nicht leerlaufen (Lehre JOB 3489: jede abgeleitete Testmenge
    // braucht ihre festgenagelte Größe). ELF Fälle je Bühne: fünf Schreibweisen mit Fund
    // (Interface-Erweiterung, Cast auf ein Typliteral, indizierter Zugriff nackt / geklammert /
    // über einen Behälteralias) und sechs Gegenstücke ohne Fund (je ein erlaubtes Feld und je ein
    // Kommentar zu den Formen 3, 3a und 3b). Dazu die drei historischen Fälle aus JOB 3564 und die
    // zwei mehrdeutigen.
    // Seit Runde 3 SECHZEHN je Bühne: die elf von Runde 2 plus die fünf Fälle zu den drei Grenzen,
    // die BEN benannt hat (lange rückwärts deklarierte Kette, Ringschluss, Verbraucher aus dritter
    // Hand samt Gegenpol und dem Helfer, der die Bühne selbst importiert).
    const JE_BUEHNE = 16;
    expect(KALIBRIERFAELLE.length).toBe(BUEHNEN.length * JE_BUEHNE + 5);
    // Und die Balance: eine Kalibrierung, in der je Bühne nur noch Gegenstücke stünden, prüfte bloß
    // das Schweigen des Wächters. Jede der fünf Formen mit Fund muss je Bühne vorhanden sein.
    for (const b of BUEHNEN) {
      const mitFund = KALIBRIERFAELLE.filter((f) => f.buehne === b.kurz);
      expect(
        mitFund.length,
        `Bühne ${b.kurz} hat zu wenige Fund-Fälle in der Kalibrierung`,
      ).toBeGreaterThanOrEqual(8);
      for (const form of [
        "Schreibweise 1",
        "Schreibweise 2",
        "Schreibweise 3:",
        "Schreibweise 3a",
        "Schreibweise 3b",
        "Schreibweise 3c",
        "Gegenpol zur Grenze",
        "Helfer selbst importiert",
      ]) {
        expect(
          mitFund.some((f) => f.name.includes(form)),
          `Bühne ${b.kurz}: die Form „${form}" fehlt in der Kalibrierung`,
        ).toBe(true);
      }
    }
  });

  it("V7 · diese Datei startet keinen Browser und importiert keine Bühne", () => {
    // Gemessen mit demselben Scanner, der die Browser-Gruppe berechnet — nicht mit einer zweiten
    // Meinung. Ein Import einer Bühne zöge diese Datei über die Importhülle in die serielle Gruppe
    // und verschöbe den Bestandspin der Startstellen in `tor-bestand-vollstaendig.test.ts`.
    const spez = spezifizierer(join(WURZEL, SELBST));
    const browser = spez.filter((s) =>
      BROWSER_PAKETE.some(
        (p) => s === p || s.startsWith(`${p}/`) || s.includes(`node_modules/${p}`),
      ),
    );
    expect(browser, "Diese Datei darf kein Browser-Paket importieren").toEqual([]);
    const buehnen = spez.filter((s) => BUEHNEN.some((b) => b.muster.test(s)));
    expect(
      buehnen,
      "Die Bühnen werden als TEXT gelesen, nie importiert — sonst wandert diese Datei in die " +
        "serielle Browser-Gruppe",
    ).toEqual([]);
    // Und der Beleg, dass der Text-Weg wirklich benutzt wird: die Felder sind da.
    for (const b of BUEHNEN) {
      expect(felderVon(b.kurz).size, `${b.pfad} wurde nicht als Text gelesen`).toBeGreaterThan(0);
    }
  });

  it("V8 · die Erhebung läuft EINMAL über den Baum und bleibt im Zeitrahmen", () => {
    console.info(
      `JOB 3609 · Erhebung: ${ALLE_DATEIEN.length} Dateien, ${VERBRAUCHER.size} Verbraucher, ` +
        `${BEFUND.length} Aufweitungen, ${ERHEBUNG_MS} ms`,
    );
    // Grosszügig bemessen (der Rechner ist geteilt): der Fall soll einen AUSREISSER fangen — etwa
    // einen Gang, der versehentlich je Bühne einmal über den Baum läuft —, nicht die Tageslast.
    expect(
      ERHEBUNG_MS,
      `Die Erhebung brauchte ${ERHEBUNG_MS} ms — das ist kein einzelner Gang mehr`,
    ).toBeLessThan(120_000);
  });

  it("V9 · die Auflösung läuft bis zum Fixpunkt, und ihre Notbremse ist keine Attrappe", () => {
    // V6 misst, DASS eine elfgliedrige Kette ankommt. Hier steht die Bauart dahinter: Runde 2 hatte
    // eine geratene Acht, Runde 3 hat eine aus der Datei abgeleitete Obergrenze. Beide Hälften der
    // Zusage werden gemessen — sonst ist „läuft bis zum Fixpunkt" eine Behauptung und die Notbremse
    // eine Zeile, die nie jemand ausgeführt hat.
    let rufe = 0;
    expect(() =>
      bisZumFixpunkt(2, () => {
        rufe++;
        return rufe < 3;
      }),
    ).not.toThrow();
    expect(rufe, "Der Fixpunkt muss so oft laufen, wie es Zuwachs gibt").toBe(3);
    expect(
      () => bisZumFixpunkt(4, () => true),
      "Ein `schritt`, der ewig Zuwachs meldet, muss laut werden statt ewig zu laufen",
    ).toThrow(/nicht zur Ruhe/);
    // Und die Obergrenze ist wirklich die Zahl der Deklarationen, nicht eine Konstante: eine Quelle
    // mit drei Deklarationen erlaubt vier Durchläufe, eine mit null genau einen.
    const dreiDeklarationen = ts.createSourceFile(
      "probe.ts",
      "type A = 1; interface B { x: 1 } type C = 2;",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(deklarationsZahl(knoten(dreiDeklarationen))).toBe(3);
  });
});
