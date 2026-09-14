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
// die Prüfmenge. Das ist eine Entscheidung und bleibt eine: wer Re-Exporte verfolgte, zählte bei
// `tests/profil-schmal/schmal-buehne.ts` eine Schuld, die es nicht gibt (sie holt aus h6 nur
// `BrowserFn`, `DIST`, `ORIGIN` und `fn` und deklariert ein EIGENES `export interface Seite` (:47),
// weil h6 ein fest verdrahtetes Konto anmeldet). Deshalb hängt dieser Wächter an der IMPORTBINDUNG
// und nicht am Namen „Seite".
//
// SEIT JOB 3947 HAT DIESE GRENZE EINEN GEZÄHLTEN PREIS (BEN zu JOB 3819 Runde 2, Prüfpunkt 6: „für
// indirekte Verbraucher über Modulgrenzen einen echten Re-Export-Fall ergänzen"). Ein Wächter, der
// seine eigene blinde Stelle nicht beziffert, ist grün und nutzlos — also wird erhoben, was heute
// tatsächlich über eine Modulgrenze an den Verbrauchern vorbeigereicht wird:
//   · V11 misst die HELFER ZWEITER HAND in zwei Bauformen — den echten Re-Export
//     (`export type { Seite } from "<Bühne>"`, auch `export *` und mit Umbenennung) und die
//     NEUDEKLARATION (die Datei importiert die Bühne, deklariert aber ein eigenes `Seite`) — und
//     vergleicht sie feldweise mit dem Register `GRENZFAELLE`. Es wird in beide Richtungen rot,
//     genau wie V2 beim `ALTBESTAND`.
//   · V12 ZÄHLT DIE VERBRAUCHER ZWEITER HAND AUF, statt sie zu verbieten: die Grenze bleibt, aber
//     sie steht mit Namen im Torprotokoll. Eine Registerzeile ohne Verbraucher ist ein Gespenst.
//   · V13 kalibriert das an ZWEI synthetischen Quellen (R1–R10): ein Modulübergang lässt sich mit
//     einer einzigen Quelle nicht messen, und ein erfundener Modulname (V6/G2) belegt nur die
//     Bauart des Auflösers, keine Zeile des Bestands.
//
// UND DER PREIS HÄNGT AN DER SACHE, NICHT AN DER SCHREIBWEISE (Prüfer BEN zu Runde 1, neun eigene
// Gegenproben). Runde 1 las den eigenen Seitentyp nur da, wo seine Mitglieder unmittelbar dastanden;
// derselbe Typ als lokaler Alias, als Schnittmenge oder über lokale Vererbung fiel durch — zweimal
// ganz aus der Helfermenge, einmal mit dem Preis NULL, was wie „kostet nichts" aussieht und „nicht
// nachgesehen" heisst. `eigeneTypisierung` löst deshalb durch alle drei hindurch auf, und was sich
// NICHT auflösen lässt (ein Name aus einem fremden Modul), trägt `<nicht auflösbar: …>` als Preis
// statt still zu verschwinden. R7–R10 halten genau diese vier Lagen je Bühne fest, und V13 misst
// zusätzlich nach, dass ein so gefundener Helfer OHNE Registerzeile V11 wirklich rot macht — mit
// derselben Funktion, die V11 fährt.
// WAS DIE GRENZE HEUTE KOSTET, steht in `GRENZFAELLE` und in der Konsolenzeile von V11: genau ein
// Feld, `setViewportSize`, aus `tests/profil-schmal/schmal-buehne.ts` (h6) an
// `tests/profil-schmal/ux13-profil-320.test.ts`. Der zweite Fall, `gast-buehne.ts`, reicht die
// Typisierung von h6 UNVERÄNDERT weiter und kostet deshalb nichts.
//
// UND DIE ASYMMETRIE, DIE DAHINTERSTECKT: ein reiner Re-Exporteur fällt sehr wohl in die
// Verbrauchermenge — `buehnenVon` zählt auch eine `ExportDeclaration` mit Modulspezifizierer —, aber
// er trägt KEINE Bindung bei, denn `bindungenVon` steigt bei allem aus, was kein Import ist. Er
// erhöht also die Zahl in V3 und ist strukturell unprüfbar. R1 hält genau das fest, statt es dem
// Code zu überlassen. Der Helfer, der die Bühne SELBST importiert und aufweitet, bleibt dagegen voll
// in der Prüfmenge (V6, Fall „Helfer selbst importiert").
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
  /**
   * Wie viele Felder ihre `Seite` heute führt — die Untergrenze von V3, JE BÜHNE.
   *
   * Bis JOB 3775 stand hier EINE Zahl für alle drei (`>= 6`). Die war für h6 (7 Felder) knapp und
   * für h4 (nach dem Abräumen 14) bedeutungslos: h4 hätte acht Felder verlieren können, ohne dass
   * ein Fall rot geworden wäre — und mit jedem verlorenen Feld wäre eine Aufweitung in den
   * Verbraucherdateien wieder „berechtigt" geworden, lautlos. Eine Untergrenze, die den heutigen
   * Bestand nicht mehr berührt, ist eine stillgelegte Prüfung. Gemessen am Basisstand `8208f57`.
   */
  readonly mindestFelder: number;
}

const BUEHNEN: readonly Buehne[] = [
  {
    kurz: "h4",
    pfad: "tests/design/h4-harness.ts",
    muster: /(^|\/)design\/h4-harness(\.js)?$/,
    seitentyp: "Seite",
    standtyp: "H4Stand",
    zweck: "die gebaute Bibliothek in Chromium, 1620 px, mit echtem Bestand und echter Fastify-App",
    // Die neun von JOB 3564 (route, addInitScript, goto, waitForFunction, waitForTimeout,
    // setViewportSize, keyboard, evaluate, on) plus die fünf von JOB 3775 (mouse, setInputFiles,
    // reload, click, selectOption). `keyboard.type` ist ein Unterfeld und zählt hier nicht mit.
    mindestFelder: 14,
  },
  {
    kurz: "h6",
    pfad: "tests/design/h6-chromium.ts",
    muster: /(^|\/)design\/h6-chromium(\.js)?$/,
    seitentyp: "Seite",
    standtyp: "Stand",
    zweck: "die gebauten Admin- und Profilflächen in Chromium, mit einspeisbarer Störung",
    // Die sieben von JOB 3065/3587 (route, addInitScript, goto, waitForFunction, evaluate, on,
    // waitForTimeout) plus die vier von JOB 3819 (goBack, locator, getByTestId, mouse). Die Zahl
    // wird MITGEFÜHRT und nicht stehen gelassen: eine Untergrenze, die den heutigen Bestand nicht
    // mehr berührt, ist eine stillgelegte Prüfung (derselbe Grund wie oben bei h4).
    mindestFelder: 11,
  },
  {
    kurz: "h3",
    pfad: "tests/design/h3-blatt-buehne.ts",
    muster: /(^|\/)design\/h3-blatt-buehne(\.js)?$/,
    seitentyp: "Seite",
    standtyp: "Buehne",
    zweck: "das gebaute Erfassungsblatt in Chromium, auf `localhost` und mit Serverwahrheit",
    // route, addInitScript, on, goto, waitForFunction, evaluate, keyboard, setViewportSize.
    mindestFelder: 8,
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
// JOB 3564 hat den Altbestand an h4 registriert; JOB 3609 tat dasselbe für h6 und h3. Sie standen
// hier, weil die Bühnen damals fremden laufenden Jobs gehörten (h6 → 3587, h3 → 3584): ein Feld in
// `Seite` einzutragen hiesse dann, eine fremde Zielpfaddatei zu ändern. Also stehen sie hier —
// namentlich, mit genau den Feldern, die ihnen heute zugestanden werden.
//
// h4 IST ABGERÄUMT (JOB 3775) UND BLEIBT ES. Die vier h4-Zeilen sind weg, weil ihre Felder jetzt in
// `Seite` von `tests/design/h4-harness.ts` stehen — `mouse`, `setInputFiles`, `reload`, `click`,
// `selectOption` und `keyboard.type`, je mit dem Verbraucher daneben, der sie bestellt hat. Die
// Sperre von damals ist Geschichte: JOB 3602 ist archiviert, die Bühne gehört keinem laufenden Job
// mehr. Was verhindert, dass die Liste für h4 wieder wächst, ist nicht dieser Kommentar, sondern
// V10 unten: er wird rot, sobald hier auch nur EINE Zeile mit `buehne: "h4"` steht. Für h6 und h3
// gilt das ausdrücklich NICHT — ihre Bühnen tragen ihre Felder noch nicht.
//
// h6 IST ANGEFANGEN, ABER NICHT FERTIG (JOB 3819). Vier Felder sind dort bezahlt und stehen jetzt in
// `Seite` von `tests/design/h6-chromium.ts`: `goBack`, `locator`, `getByTestId` und `mouse` (samt dem
// Typ `Elementgriff`, der bis dahin in `pruefen-schmal-chromium.test.ts` wohnte). Es sind genau die
// vier, die AUSSCHLIESSLICH die drei Dateien jenes Auftrags nachreichten. `setViewportSize`,
// `keyboard` und `reload` blieben bewusst draussen: sie stehen auch in Dateien, die fremden Aufträgen
// als Zielpfad gehören (`gast-buehne.ts` → JOB 3774, `kopfband-messung.ts` → Nachbarschaft JOB 3778)
// — ein Eintrag hätte sie mitgerissen. Die zehn h6-Zeilen sind deshalb ZEHN GEBLIEBEN, nur kürzer;
// h6 steht ausdrücklich NICHT in `ABGERAEUMT` bei V10, und eine solche Behauptung wäre falsch.
//
// Das ist kein Freibrief, sondern eine Schranke in BEIDE Richtungen:
//   · Ein Feld, das NICHT in der Zeile steht, macht V1 rot — auch in einer alten Datei.
//   · Eine alte Datei, die ihre Aufweitung LOSWIRD, macht V2 rot: dann gehört der Eintrag weg, sonst
//     verwaltet das Register Gespenster (Lehre JOB 3550/3562: ein Wächter, der nichts mehr sieht,
//     ist grün und nutzlos). Dasselbe gilt FELDWEISE: ein zugestandenes Feld, das nirgends mehr
//     nachgereicht wird, ist eine Karteileiche und macht V2 rot.
//   · Auch die Bühne der Zeile wird geprüft: wandert eine Datei auf eine andere Bühne, ist der
//     Eintrag falsch und V2 rot.
//   · Und für eine abgeräumte Bühne nimmt die Liste gar nichts mehr an — V10.
// Wer eine dieser Zeilen abräumen will, trägt das Feld in `Seite` der genannten Bühne ein und löscht
// die Zeile. Ist die letzte Zeile einer Bühne weg, gehört ihr Kurzname in `ABGERAEUMT` bei V10.
interface Altzeile {
  /** Die Bühne, gegen die gemessen wird — muss mit dem Befund übereinstimmen (V2). */
  readonly buehne: string;
  /** Genau die Felder, die heute zugestanden sind. Alles darüber hinaus ist rot. */
  readonly felder: readonly string[];
  /** Warum die Datei sie heute braucht — ein Satz, kein Freibrief. */
  readonly grund: string;
}

const ALTBESTAND: ReadonlyMap<string, Altzeile> = new Map<string, Altzeile>([
  // ---- Bühne h4: KEINE ZEILE MEHR (JOB 3775) ----------------------------------------------------
  //
  // Hier standen vier Zeilen (JOB 3564, Folgezeilen 1–4). Sie sind gelöscht, nicht auskommentiert:
  // `foto-anhaengen-tastatur` (mouse, setInputFiles), `klara-hilfe-chromium` (reload),
  // `sichten-chromium` (keyboard.type) und `belegstelle-ueberlebt-neuladen-chromium` (keyboard.type,
  // click, selectOption, reload) reichen sich nichts mehr nach — ihre Eigeninterfaces und Casts sind
  // entfernt, die Felder stehen in `Seite` der Bühne. V10 hält die Stelle frei.
  // ---- Bühne h6 (JOB 3609; Runde 1 fand acht Dateien, Runde 3 misst zehn) ----------------------
  //
  // Der Auftrag ging von SECHS Dateien aus (`archiv/3564/runde-3/RUECKGABE.md:40`). Runde 1 fand
  // ACHT, Runde 3 findet ZEHN: `gast-buehne.ts` und `aufgaben-schmal-chromium.test.ts` sind zwischen
  // Runde 2 und Runde 3 neu in den Baum gekommen und reichen sich dieselben Felder selbst nach wie
  // die Nachbarn. Sie werden GEZÄHLT UND BENANNT, nicht umgebaut (AUFTRAG §10, dieselbe Schranke wie
  // bei JOB 3564) — dass sie überhaupt auffielen, ohne dass jemand danach suchte, ist der Zweck
  // dieses Wächters.
  //
  // JOB 3819 hat DREI dieser zehn Zeilen gekürzt, keine gelöscht: `rundweg-tastatur` (−goBack),
  // `aufgaben-schmal` (−mouse) und `pruefen-schmal` (−locator, −getByTestId, −mouse). Alle drei
  // tragen weiter gesperrte Felder, also bleiben sie stehen. Was hier steht, ist damit wieder genau
  // die heutige Schuld und nicht die von gestern — V2 erzwingt das feldweise.
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
      felder: ["setViewportSize", "keyboard"],
      grund:
        "Fenster verstellen und Tab drücken (:34). `goBack` stand bis JOB 3819 daneben und ist " +
        "seither in `Seite` von h6 bezahlt; offen sind nur noch die zwei Felder, die auch fremde " +
        "Zielpfaddateien nachreichen.",
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
      felder: ["setViewportSize"],
      grund:
        "`interface SeiteRoh extends Seite` (:72), das schmale Fenster. Die echte Maus stand bis " +
        "JOB 3819 daneben und ist seither in `Seite` von h6 bezahlt; `setViewportSize` bleibt, " +
        "weil es auch `gast-buehne.ts` und `kopfband-messung.ts` nachreichen.",
    },
  ],
  [
    "tests/review26-pruefen-schmal/pruefen-schmal-chromium.test.ts",
    {
      buehne: "h6",
      felder: ["keyboard"],
      grund:
        "Echte Tastenanschläge auf der Prüffläche (:17, `interface BedienbareSeite extends " +
        "Seite`). Die drei übrigen Felder der Bedienfläche — `locator`, `getByTestId` und `mouse` " +
        "— stehen seit JOB 3819 in `Seite` von h6, samt dem Typ `Elementgriff`, der bis dahin " +
        "hier deklariert war.",
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

// ==================================================================================================
// DIE GRENZFÄLLE — WAS ÜBER EINE MODULGRENZE WEITERGEREICHT WIRD (JOB 3947).
// ==================================================================================================
//
// DIESES REGISTER BESCHREIBT EINE ANDERE SACHE ALS `ALTBESTAND` OBEN, und der Unterschied ist der
// ganze Punkt: `ALTBESTAND` führt AUFWEITUNGEN — eine Datei, die eine Bühne selbst importiert und
// sich ein Feld nachreicht, das deren `Seite` nicht kennt. `GRENZFAELLE` führt WEITERREICHUNGEN —
// eine Datei, die eine Seitentypisierung über eine Modulgrenze an andere Dateien abgibt, sodass
// deren Verbraucher von V1 gar nicht gesehen werden. Das eine ist eine Schuld, die abgetragen
// gehört; das andere ist der PREIS einer bewusst gezogenen Grenze. Eine Datei kann in beiden
// Registern stehen (`gast-buehne.ts` tut es), und das ist kein Widerspruch.
//
// ZWEI BAUFORMEN, BEIDE GEMESSEN (V11, kalibriert in V13):
//   (i)  DER ECHTE RE-EXPORT — `export type { Seite } from "<Bühne>"`, auch `export * from` und auch
//        mit Umbenennung. Er reicht die Typisierung der Bühne UNVERÄNDERT weiter; sein Preis ist
//        deshalb null, und das wird gerechnet (`ueberschuss` gegen dieselbe Feldmenge), nicht
//        behauptet. Bestandsfall: `tests/demo-firmen-ci-anmeldung/gast-buehne.ts:45`.
//   (ii) DIE NEUDEKLARATION — die Datei importiert eine Bühne, exportiert aber einen EIGENEN Typ
//        unter dem Namen von deren `seitentyp`, ohne ihn aus ihr abzuleiten. Nur hier entsteht
//        wirklich ein Preis, weil der eigene Typ Felder führen kann, die die Bühne nicht kennt.
//        Bestandsfall: `tests/profil-schmal/schmal-buehne.ts:47`. In WELCHER Schreibweise dieser
//        eigene Typ dasteht, ist gleichgültig — unmittelbare Mitglieder, lokaler Alias,
//        Schnittmenge oder lokale Vererbung sind für TypeScript dasselbe und müssen denselben Preis
//        liefern (`eigeneTypisierung`; R7–R9 in V13 halten es je Bühne fest).
//
// DIE GRENZE WIRD DAMIT BEZIFFERT UND NICHT GESCHLOSSEN. Die Verbraucher zweiter Hand werden von V12
// AUFGEZÄHLT, nicht verboten — R2 in V13 misst ausdrücklich nach, dass der Erheber sie NICHT
// einsammelt. Wer eine Zeile hier loswerden will, trägt das Feld in `export interface Seite` der
// genannten Bühne ein; dann fällt die Weiterreichung von selbst auf null, und V11 verlangt die
// Löschung der Zeile (Gespenst).
interface Grenzzeile {
  /** Die Bühne, deren Seitentypisierung weitergereicht wird — muss mit dem Befund übereinstimmen. */
  readonly buehne: string;
  /** Wie sie hinausgeht. Steht hier, weil der Weg zur Abhilfe je Bauform ein anderer ist. */
  readonly art: Weitergabe["art"];
  /**
   * Genau die Felder, die der weitergereichte Typ führt und die `Seite` der Bühne NICHT kennt.
   * Leer heisst: unverändert weitergereicht, kein Preis — nicht „ungemessen". Ein Eintrag der Form
   * `<nicht auflösbar: X>` heisst das Gegenteil: hier konnte NICHTS gemessen werden, und die Zeile
   * sagt es, statt eine Null hinzuschreiben, die wie Unschuld aussieht.
   */
  readonly felder: readonly string[];
  /**
   * Die Verbraucher zweiter Hand, die heute sicher an dieser Zeile hängen — die festgenagelte
   * UNTERGRENZE von V12, nach derselben Doktrin wie `ERWARTETE_VERBRAUCHER` unten: die gemessene
   * Liste muss sie enthalten, darf aber wachsen.
   */
  readonly verbraucher: readonly string[];
  /** Wer die Felder bezieht und warum die Grenze hier bewusst gilt — ein Satz, kein Freibrief. */
  readonly grund: string;
}

// GEMESSEN AM BASISSTAND `cc82ae0` — zwei Helfer, nicht einer. Beide hängen an h6; an h4 und h3
// reicht heute niemand eine Seitentypisierung über eine Modulgrenze weiter. Der ganze Preis der
// Grenze ist damit EIN Feld: `setViewportSize` aus `schmal-buehne.ts`.
const GRENZFAELLE: ReadonlyMap<string, Grenzzeile> = new Map<string, Grenzzeile>([
  [
    "tests/demo-firmen-ci-anmeldung/gast-buehne.ts",
    {
      buehne: "h6",
      art: "re-export",
      felder: [],
      verbraucher: ["tests/demo-firmen-ci-anmeldung/anmeldemaske-marke-chromium.test.ts"],
      grund:
        '`export type { BrowserFn, Seite } from "../design/h6-chromium"` (:45) — der einzige echte ' +
        "Re-Export über eine Modulgrenze im Baum. `anmeldemaske-marke-chromium.test.ts` bezieht die " +
        "Seite daraus über `GastSeite` (abgeleitet, :70) und `GastStand` (Behälter, :97). Die " +
        "Typisierung geht UNVERÄNDERT hinaus, also kostet die Grenze hier nichts: die Felder, die " +
        "diese Datei zusätzlich braucht (`setViewportSize`, `reload`), stehen als AUFWEITUNG im " +
        "`ALTBESTAND` oben und werden dort abgetragen, nicht hier.",
    },
  ],
  [
    "tests/profil-schmal/schmal-buehne.ts",
    {
      buehne: "h6",
      art: "neudeklaration",
      felder: ["setViewportSize"],
      verbraucher: ["tests/profil-schmal/ux13-profil-320.test.ts"],
      grund:
        "Sie holt aus h6 nur `BrowserFn`, `DIST`, `ORIGIN` und `fn` und deklariert ein EIGENES " +
        "`export interface Seite` (:47) mit sieben Feldern; genau eines davon kennt h6 nicht. " +
        "`ux13-profil-320.test.ts` bezieht es über `Buehne` (`seite: Seite | null`, :67) — die Datei " +
        "steht zwar selbst in der h6-Verbraucherliste (sie holt `fn` direkt), aber die Seite, die " +
        "sie wirklich bedient, kommt an V1 vorbei. Die Grenze gilt hier bewusst: h6 meldet ein FEST " +
        "VERDRAHTETES Konto an, an dem der Schaden von UX-13 unsichtbar wäre (:5-11). Abtragen liesse " +
        "sie sich nur mit einem Eintrag von `setViewportSize` in `Seite` von h6 — den JOB 3819 " +
        "bewusst gelassen hat, weil er fremde Zielpfaddateien mitrisse.",
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
  // NEU GEMESSEN AM BASISSTAND `8208f57` (JOB 3775): h4 = 15, h6 = 25, h3 = 8 Verbraucher. Die
  // Listen von JOB 3609 (12 / 17 / 6, Stand `4dfc4f0`) waren damit keine Untergrenze mehr, die noch
  // beisst: h4 hätte drei Verbraucher verlieren dürfen, h6 acht, h3 zwei — ohne dass ein Fall rot
  // geworden wäre. Eine Untergrenze, die den heutigen Bestand nicht mehr berührt, ist eine
  // stillgelegte Prüfung; deshalb stehen hier die heute gemessenen Mengen, nicht die von damals.
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
      "tests/review26-originaldatei-kopf/kopf-datei-in-chromium.test.ts",
      "tests/seitenhilfe-luecken/tablet-schublade-chromium.test.ts",
      "tests/tor-bereitschaft/verzoegerte-antworten.test.ts",
      "tests/ux21-tablet-lesemodus/tablet-chromium.test.ts",
      "tests/wissensobjekt-loeschen/loeschen-in-chromium.test.ts",
    ],
  ],
  [
    "h6",
    [
      "tests/chr-kopfband-1000/kopfband-1000-chromium.test.ts",
      "tests/chr-navigation-ci-logo/logokasten-chromium.test.ts",
      "tests/chr-navigation-sprachen/sprachschritt-ausgaenge.test.ts",
      "tests/demo-firmen-ci-anmeldung/anmeldemaske-marke-chromium.test.ts",
      "tests/demo-firmen-ci-anmeldung/gast-buehne.ts",
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
      "tests/review26-aufgaben-schmal/aufgaben-schmal-chromium.test.ts",
      "tests/review26-pruefen-schmal/pruefen-schmal-chromium.test.ts",
      "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts",
      "tests/seitenhilfe-dubletten/seitenhilfe-chromium.test.ts",
      "tests/tor-bereitschaft/t1b-hooks.test.ts",
      "tests/tor-bereitschaft/t1b-raster.test.ts",
      "tests/tor-bereitschaft/t1e-ableitung.test.ts",
      "tests/tor-bereitschaft/verzoegerte-antworten.test.ts",
      "tests/tor-chromium-abbau/probe-beschriftet-sich-als-probe.test.ts",
      "tests/vorfuehrdaten-getrennt/netzwerk-chromium.test.ts",
    ],
  ],
  [
    "h3",
    [
      "tests/entwurf-aus-adresse/adresse-entwurf-chromium.test.ts",
      "tests/import-anleitung-modus/tastatur-importart-chromium.test.ts",
      "tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts",
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
        // Auch hier durch die Klammern hindurch: `as unknown as (KZieh)` nennt denselben Typ.
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

// ---- Helfer zweiter Hand: was über eine Modulgrenze weitergereicht wird (JOB 3947) ---------------

interface Weitergabe {
  /** Die Datei des Helfers, in der Schreibweise von `ALLE_DATEIEN`. */
  datei: string;
  /** Kurzname der Bühne, deren Seitentypisierung hier hinausgeht. */
  buehne: string;
  art: "re-export" | "neudeklaration";
  /** Der EXPORTIERTE Name, unter dem sie den Helfer verlässt. */
  name: string;
  zeile: number;
  /** Was der weitergereichte Typ führt und die `Seite` der Bühne NICHT kennt — der PREIS. */
  fehlt: string[];
  /** Alle exportierten Namen, über die ein Verbraucher diese Seite aus dem Helfer bezieht. */
  zugaenge: string[];
}

/** Ist diese Deklaration exportiert? Ohne `export` verlässt nichts das Modul. */
function istExportiert(n: ts.Node): boolean {
  const mods = ts.canHaveModifiers(n) ? ts.getModifiers(n) : undefined;
  return (mods ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** Der Name einer Typdeklaration (`interface X`, `type X = …`) — sonst `undefined`. */
function typName(n: ts.Node): string | undefined {
  return ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) ? n.name.text : undefined;
}

/** Die Mitglieder einer Typdeklaration, soweit sie unmittelbar dastehen. */
function mitgliederVon(n: ts.Node): readonly ts.TypeElement[] | undefined {
  if (ts.isInterfaceDeclaration(n)) {
    return n.members;
  }
  if (ts.isTypeAliasDeclaration(n)) {
    const kern = ohneKlammern(n.type);
    return ts.isTypeLiteralNode(kern) ? kern.members : undefined;
  }
  return undefined;
}

// ---- Die Felder eines EIGENEN Seitentyps — durch die Schreibweise hindurch (Runde 2) -------------
//
// KORREKTURPFLICHT 1 (Prüfer BEN zu Runde 1, neun eigene Gegenproben, je drei an jeder Bühne). Runde 1
// las den eigenen Seitentyp nur da, wo seine Mitglieder UNMITTELBAR dastanden (`mitgliederVon`). Drei
// alltägliche Schreibweisen derselben Sache fielen damit durch — an allen drei Bühnen, gemessen mit
// dem Probefeld `dragAndDrop`:
//   · der LOKALE ALIAS      — `type Eigen = { dragAndDrop: … }; export type Seite = Eigen;`
//     `mitgliederVon` gab `undefined`, die Datei fiel schon aus der KANDIDATENMENGE: kein Helfer,
//     kein Preis, kein Wort. Die teuerste Art, einen Wächter zu verlieren.
//   · die SCHNITTMENGE      — `export type Seite = TeilA & { dragAndDrop: … };` — dasselbe.
//   · die LOKALE VERERBUNG  — `export interface Seite extends Eigen {}`. Hier blieb der Helfer sogar
//     sichtbar, aber sein Preis wurde als LEER gemessen: `n.members` ist leer, das Geerbte stand
//     nebenan. Eine Null, die wie „kostet nichts" aussieht und „nicht nachgesehen" heisst.
// Es ist derselbe Fehler, den BEN schon an JOB 3564 gemessen hat („löste ein Cast-Ziel nur auf, wenn
// es ein `interface` war"): der Wächter hing an der SCHREIBWEISE statt an der Sache. Deshalb wird hier
// nicht mehr gefragt, WIE der Typ geschrieben ist, sondern was am Ende der Kette steht.
//
// UND WAS SICH NICHT AUFLÖSEN LÄSST, WIRD GESAGT. `type Seite = Fremd`, wobei `Fremd` aus einem
// anderen Modul kommt, ist nicht „leer" — es ist UNBEKANNT. Ein solcher Typ darf nicht still aus der
// Helfermenge fallen (BEN, Prüfpunkt 6), sondern trägt `<nicht auflösbar: Fremd>` als Preis: die Zeile
// muss dann registriert werden, und wer sie liest, sieht sofort, dass hier nichts gemessen werden
// konnte. Fail-closed, dieselbe Doktrin wie `NICHT_AUFLOESBAR` bei den Unterfeldern.
/** Ein Teil der Typisierung, der aus dieser Datei hinausführt — im Zweifel melden, nie schweigen. */
function nichtAufloesbar(was: string): string {
  return `<nicht auflösbar: ${was}>`;
}

/**
 * Typen, die sicher KEIN Objekt mit Feldern sind. `any`, `unknown` und `object` stehen bewusst NICHT
 * hier: hinter ihnen kann alles stecken, also gelten sie als unbekannt und nicht als leer.
 */
const OHNE_FELDER: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.StringKeyword,
  ts.SyntaxKind.NumberKeyword,
  ts.SyntaxKind.BooleanKeyword,
  ts.SyntaxKind.BigIntKeyword,
  ts.SyntaxKind.SymbolKeyword,
  ts.SyntaxKind.VoidKeyword,
  ts.SyntaxKind.UndefinedKeyword,
  ts.SyntaxKind.NeverKeyword,
]);

function istOhneFelder(t: ts.TypeNode): boolean {
  const kern = ohneKlammern(t);
  return OHNE_FELDER.has(kern.kind) || ts.isLiteralTypeNode(kern);
}

/**
 * Name → die DEKLARATION selbst, nicht nur ihr Rumpf. `lokaleTypen` oben legt für ein Interface nur
 * `n.members` ab und verliert damit die `extends`-Klausel — für die Unterfelder reicht das, für den
 * Preis eines Helfers nicht (genau die lokale Vererbung war eine der neun Gegenproben). Mehrere
 * Deklarationen unter einem Namen (Interface-Verschmelzung) werden ALLE geführt und alle gelesen.
 */
function lokaleDeklarationen(alle: readonly ts.Node[]): Map<string, ts.Node[]> {
  const nach = new Map<string, ts.Node[]>();
  for (const n of alle) {
    const name = typName(n);
    if (name === undefined) {
      continue;
    }
    const liste = nach.get(name);
    if (liste === undefined) {
      nach.set(name, [n]);
    } else {
      liste.push(n);
    }
  }
  return nach;
}

interface EigenTypisierung {
  /** Was der Typ nachweislich führt — durch Aliase, Schnittmengen und lokale Vererbung hindurch. */
  readonly felder: Felder;
  /** Die Teile, die aus dieser Datei hinausführen. Nicht leer heisst: hier wurde NICHTS gemessen. */
  readonly offen: readonly string[];
}

function eigeneTypisierung(
  start: ts.Node,
  sf: ts.SourceFile,
  lokal: ReadonlyMap<string, ts.TypeNode | readonly ts.TypeElement[]>,
  deklarationen: ReadonlyMap<string, readonly ts.Node[]>,
): EigenTypisierung {
  const felder: Felder = new Map();
  const offen = new Set<string>();
  const gesehen = new Set<ts.Node>();

  const nimm = (mitglieder: readonly ts.TypeElement[]): void => {
    for (const m of mitglieder) {
      const name = namenVon(m, sf);
      if (name === null || felder.has(name)) {
        continue;
      }
      felder.set(name, unterfelder(m, sf, lokal));
    }
  };

  const ausName = (name: string): void => {
    const ziele = deklarationen.get(name);
    if (ziele === undefined || ziele.length === 0) {
      offen.add(name); // Der Name führt aus dieser Datei hinaus — unbekannt, nicht leer.
      return;
    }
    for (const z of ziele) {
      ausDeklaration(z);
    }
  };

  const ausTeil = (t: ts.TypeNode): void => {
    if (ts.isTypeLiteralNode(t)) {
      nimm(t.members);
      return;
    }
    if (ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) && t.typeArguments === undefined) {
      ausName(t.typeName.text);
      return;
    }
    if (istOhneFelder(t)) {
      return;
    }
    // `Omit<X, "a">`, `Stand["seite"]` mit unbekanntem Behälter, bedingte und abgebildete Typen:
    // TypeScript löst das auf, dieser Wächter nicht. Also wird es gesagt und nicht verschwiegen.
    offen.add(t.getText(sf));
  };

  /** Ein Ringschluss (`type A = A`) endet über `gesehen`, nicht über eine geratene Tiefe. */
  function ausDeklaration(n: ts.Node): void {
    if (gesehen.has(n)) {
      return;
    }
    gesehen.add(n);
    if (ts.isInterfaceDeclaration(n)) {
      nimm(n.members);
      for (const h of n.heritageClauses ?? []) {
        for (const t of h.types) {
          if (ts.isIdentifier(t.expression) && t.typeArguments === undefined) {
            ausName(t.expression.text);
          } else {
            offen.add(t.getText(sf));
          }
        }
      }
      return;
    }
    if (ts.isTypeAliasDeclaration(n)) {
      for (const t of schnittTeile(n.type)) {
        ausTeil(t);
      }
      return;
    }
    offen.add(typName(n) ?? n.getText(sf));
  }

  ausDeklaration(start);
  return { felder, offen: [...offen].sort() };
}

/** Nennt dieser Typausdruck irgendwo einen dieser Namen? (`Seite | null` nennt `Seite`.) */
function nenntNamen(typ: ts.TypeNode, menge: ReadonlySet<string>): boolean {
  return knoten(typ).some(
    (k) => ts.isTypeReferenceNode(k) && ts.isIdentifier(k.typeName) && menge.has(k.typeName.text),
  );
}

/**
 * ÜBER WELCHE EXPORTIERTEN NAMEN ERREICHT EIN VERBRAUCHER DIE WEITERGEREICHTE SEITE?
 *
 * Nicht nur über den Namen selbst. `tests/profil-schmal/ux13-profil-320.test.ts` importiert aus
 * `schmal-buehne.ts` gar kein `Seite`, sondern `Buehne` — und kommt über `buehne.seite` an genau
 * dieselbe Typisierung. Dasselbe an `gast-buehne.ts`: dort geht es über `GastSeite` (abgeleitet) und
 * `GastStand` (Behälter). Wer nur den nackten Namen zählte, fände für beide Bestandsfälle NULL
 * Verbraucher und löschte die Registerzeilen als Gespenster — also wächst die Menge über zwei Wege,
 * dieselben zwei, die auch `seitenTypen`/`standTypen` oben gehen:
 *   (a) ABGELEITET — `export interface G extends Seite`, `export type G = Seite & { … }`.
 *   (b) BEHÄLTER — ein exportierter Typ mit einem Mitglied `seite`, dessen Typ einen der Namen nennt.
 * Beides nur EXPORTIERT: was das Modul nicht verlässt, erreicht kein Verbraucher.
 */
function zugangsNamen(sf: ts.SourceFile, alle: readonly ts.Node[], start: string): string[] {
  const menge = new Set<string>([start]);
  bisZumFixpunkt(deklarationsZahl(alle), () => {
    let gewachsen = false;
    for (const n of alle) {
      const name = typName(n);
      if (name === undefined || menge.has(name) || !istExportiert(n)) {
        continue;
      }
      if (ts.isInterfaceDeclaration(n)) {
        for (const h of n.heritageClauses ?? []) {
          for (const t of h.types) {
            if (ts.isIdentifier(t.expression) && menge.has(t.expression.text)) {
              menge.add(name);
              gewachsen = true;
            }
          }
        }
      }
      if (ts.isTypeAliasDeclaration(n)) {
        for (const t of schnittTeile(n.type)) {
          if (
            ts.isTypeReferenceNode(t) &&
            ts.isIdentifier(t.typeName) &&
            menge.has(t.typeName.text)
          ) {
            menge.add(name);
            gewachsen = true;
          }
        }
      }
      for (const m of mitgliederVon(n) ?? []) {
        if (
          namenVon(m, sf) === "seite" &&
          ts.isPropertySignature(m) &&
          m.type !== undefined &&
          nenntNamen(m.type, menge)
        ) {
          menge.add(name);
          gewachsen = true;
        }
      }
    }
    return gewachsen;
  });
  return [...menge].sort();
}

/**
 * DER ERHEBER DER HELFER ZWEITER HAND — über den Syntaxbaum, nie über den Rohtext und nie über
 * blosse Namensgleichheit (Doktrin oben; Lehre JOB 3489 „nur in CODEZEILEN, nicht in Kommentaren";
 * Lehre JOB 3931 „Der Fundstellenwächter glaubt dem Rohtext und dem blossen Namen").
 *
 * Er läuft in der EINEN Erhebungsschleife unten mit — kein zweiter Gang über den Baum (V8). Die
 * teure Auflösung (`standTypen`/`seitenTypen`) wird nur angeworfen, wenn die Datei überhaupt einen
 * Typ unter dem Namen eines `seitentyp` exportiert; für die weit über tausend anderen Dateien kostet
 * der Erheber einen Durchgang durch `sf.statements`.
 */
function weitergabenAusBaum(sf: ts.SourceFile, datei: string): Weitergabe[] {
  const dateiBuehnen = buehnenVon(sf);
  if (dateiBuehnen.length === 0) {
    return [];
  }
  const alle = knoten(sf);
  const lokal = lokaleTypen(sf);
  const deklarationen = lokaleDeklarationen(alle);
  const gefunden: Weitergabe[] = [];
  const melde = (
    b: Buehne,
    art: Weitergabe["art"],
    name: string,
    n: ts.Node,
    eigen: EigenTypisierung,
  ): void => {
    if (gefunden.some((w) => w.name === name && w.buehne === b.kurz)) {
      return;
    }
    gefunden.push({
      datei,
      buehne: b.kurz,
      art,
      name,
      zeile: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
      // Der Preis ist beides: was die Bühne nicht kennt UND was sich gar nicht auflösen liess. Das
      // zweite ist kein Nebenfall — ein Helfer, dessen Typisierung ins Unbekannte zeigt, ist die
      // Lage, in der Schweigen am teuersten wäre.
      fehlt: [
        ...ueberschuss(eigen.felder, felderVon(b.kurz)),
        ...eigen.offen.map((o) => nichtAufloesbar(o)),
      ],
      zugaenge: zugangsNamen(sf, alle, name),
    });
  };
  /** Der Re-Export gibt die Typisierung der Bühne UNVERÄNDERT weiter — nichts bleibt offen. */
  const wieDieBuehne = (b: Buehne): EigenTypisierung => ({
    felder: felderVon(b.kurz),
    offen: [],
  });

  // ---- Bauform (i): der ECHTE Re-Export, also eine `ExportDeclaration` MIT Modulspezifizierer ----
  //
  // `modulSpezifizierer` behandelt Import und Export gleich; nur hier zählt der Unterschied. Ein
  // LOKALER Re-Export (`export type { Seite };` ohne `from`) ist kein Modulübergang — er gibt weiter,
  // was die Datei sich selbst importiert hat, und die Datei steht dann ohnehin voll in der Prüfmenge.
  // Weitergereicht wird die Typisierung der Bühne UNVERÄNDERT, also ist die Feldmenge ihre eigene und
  // der Überschuss rechnerisch leer. Das wird gerechnet und nicht gesetzt: trüge die Bühne morgen
  // einen anderen Typ, liefe dieselbe Rechnung mit.
  for (const n of alle) {
    if (!ts.isExportDeclaration(n)) {
      continue;
    }
    const spez = modulSpezifizierer(n);
    if (spez === undefined) {
      continue;
    }
    const b = BUEHNEN.find((x) => x.muster.test(spez));
    if (b === undefined) {
      continue;
    }
    const klausel = n.exportClause;
    if (klausel === undefined) {
      // `export * from "<Bühne>"` — alles, also auch `Seite` und der Behälter, unter ihrem Namen.
      melde(b, "re-export", b.seitentyp, n, wieDieBuehne(b));
      melde(b, "re-export", b.standtyp, n, wieDieBuehne(b));
    } else if (ts.isNamespaceExport(klausel)) {
      // `export * as X from "<Bühne>"` — erreichbar als `X.Seite`; der Zugang ist der Namensraum.
      melde(b, "re-export", klausel.name.text, n, wieDieBuehne(b));
    } else {
      for (const spec of klausel.elements) {
        const inDerBuehne = (spec.propertyName ?? spec.name).text;
        if (inDerBuehne === b.seitentyp || inDerBuehne === b.standtyp) {
          melde(b, "re-export", spec.name.text, spec, wieDieBuehne(b));
        }
      }
    }
  }

  // ---- Bauform (ii): die NEUDEKLARATION — die Bauart von `schmal-buehne.ts` ----------------------
  //
  // Die Datei importiert eine Bühne (steht also in `VERBRAUCHER`), exportiert aber einen EIGENEN Typ
  // unter dem Namen von deren `seitentyp`, ohne ihn aus ihr abzuleiten. Wäre er abgeleitet, stünde er
  // in `seitenTypen` und V1 hätte ihn längst als Aufweitung gemeldet — genau das wird hier geprüft
  // und nicht angenommen, sonst zählte dieselbe Sache zweimal.
  //
  // KANDIDAT IST JEDE EXPORTIERTE TYPDEKLARATION UNTER DIESEM NAMEN, gleichgültig wie sie geschrieben
  // ist. Runde 1 verlangte hier zusätzlich `mitgliederVon(n) !== undefined` und liess damit den
  // lokalen Alias und die Schnittmenge lautlos durch (BEN, Korrekturpflicht 1). Was der Typ führt,
  // entscheidet `eigeneTypisierung` und nicht diese Stelle — eine Schreibweise mehr darf keine
  // Prüflücke mehr sein (dieselbe Lehre wie beim Cast-Ziel in JOB 3564).
  const kandidaten = alle.filter(
    (n) => istExportiert(n) && dateiBuehnen.some((b) => typName(n) === b.seitentyp),
  );
  if (kandidaten.length > 0) {
    const bindungen = bindungenVon(sf);
    const staende = standTypen(sf, bindungen);
    const typen = seitenTypen(sf, bindungen, staende);
    for (const n of kandidaten) {
      const name = typName(n);
      if (name === undefined || typen.has(name)) {
        continue;
      }
      for (const b of dateiBuehnen) {
        if (b.seitentyp === name) {
          melde(b, "neudeklaration", name, n, eigeneTypisierung(n, sf, lokal, deklarationen));
        }
      }
    }
  }
  return gefunden;
}

// ---- Die Importkanten des Baums: wer holt WELCHE Namen aus WELCHER Datei? ------------------------
//
// Gebraucht von V12, um die Verbraucher zweiter Hand zu benennen — über die Importbindung, nicht über
// den Dateinamen. Erhoben wird über `sf.statements` statt über den ganzen Baum: Importe stehen auf
// oberster Ebene, und der Gang kostet so auch für die Dateien nichts, die keine Bühne anfassen.
interface Importkante {
  /** Der aufgelöste Zielpfad OHNE Endung, in der Schreibweise von `ALLE_DATEIEN`. */
  readonly ziel: string;
  /** Die Namen, wie sie IM ZIEL heissen (`propertyName ?? name`). */
  readonly namen: readonly string[];
}

/** `tests/a/b` + `../c/d` → `tests/c/d`. Reiner Pfadausdruck, ohne Plattformtrennzeichen. */
function posixNormal(pfad: string): string {
  const teile: string[] = [];
  for (const t of pfad.split("/")) {
    if (t === "" || t === ".") {
      continue;
    }
    if (t === "..") {
      teile.pop();
      continue;
    }
    teile.push(t);
  }
  return teile.join("/");
}

function ohneEndung(pfad: string): string {
  return pfad.replace(/\.(tsx?|jsx?)$/, "");
}

function importKantenVon(sf: ts.SourceFile, datei: string): Importkante[] {
  const ordner = datei.split("/").slice(0, -1).join("/");
  const kanten: Importkante[] = [];
  for (const n of sf.statements) {
    if (!ts.isImportDeclaration(n) || n.importClause === undefined) {
      continue;
    }
    const spez = modulSpezifizierer(n);
    if (spez === undefined || !spez.startsWith(".")) {
      continue;
    }
    const bindung = n.importClause.namedBindings;
    const namen: string[] = [];
    if (bindung !== undefined && ts.isNamedImports(bindung)) {
      for (const spec of bindung.elements) {
        namen.push((spec.propertyName ?? spec.name).text);
      }
    }
    kanten.push({ ziel: ohneEndung(posixNormal(`${ordner}/${spez}`)), namen });
  }
  return kanten;
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
/** Was über eine Modulgrenze weitergereicht wird (JOB 3947) — aus DERSELBEN Schleife. */
const WEITERGABEN: Weitergabe[] = [];
/** Datei → ihre Importkanten in den Baum. Auch für Dateien OHNE Bühne: V12 misst die Bezieher. */
const IMPORTKANTEN = new Map<string, Importkante[]>();
for (const datei of ALLE_DATEIEN.sort()) {
  if (datei === SELBST) {
    continue;
  }
  const sf = baum(join(WURZEL, datei));
  IMPORTKANTEN.set(datei, importKantenVon(sf, datei));
  const buehnen = buehnenVon(sf);
  if (buehnen.length === 0) {
    continue;
  }
  VERBRAUCHER.set(datei, buehnen);
  BEFUND.push(...aufweitungenAusBaum(sf, datei));
  WEITERGABEN.push(...weitergabenAusBaum(sf, datei));
}
const ERHEBUNG_MS = Date.now() - BEGINN;

/**
 * Die Verbraucher ZWEITER HAND einer Helferdatei: wer holt aus ihr einen der Namen, über die ihre
 * weitergereichte Seite erreichbar ist? Gemessen über die Importbindung und den aufgelösten
 * Modulpfad — nie über den Dateinamen.
 */
function verbraucherZweiterHand(helfer: string): string[] {
  const zugaenge = new Set(
    WEITERGABEN.filter((w) => w.datei === helfer).flatMap((w) => w.zugaenge),
  );
  if (zugaenge.size === 0) {
    return [];
  }
  const ziel = ohneEndung(helfer);
  return [...IMPORTKANTEN.entries()]
    .filter(
      ([d, kanten]) =>
        d !== helfer &&
        kanten.some((k) => k.ziel === ziel && k.namen.some((nm) => zugaenge.has(nm))),
    )
    .map(([d]) => d)
    .sort();
}

/** Die gemessenen Weitergaben EINER Datei, zusammengefasst — die Grundlage jeder Meldung in V11/V12. */
interface Grenzbefund {
  readonly datei: string;
  readonly weitergaben: readonly Weitergabe[];
  readonly buehnen: readonly string[];
  readonly arten: readonly string[];
  /** Die Vereinigung der Preise — genau das, was in der Registerzeile stehen muss. */
  readonly felder: readonly string[];
  readonly verbraucher: readonly string[];
}

/**
 * Aus gemessenen Weitergaben einen Befund. Steht getrennt vom Baum, damit V13 denselben Weg mit
 * SYNTHETISCHEN Quellen gehen kann: nur so lässt sich zeigen, dass ein neuer Helfer ohne
 * Registerzeile V11 wirklich rot macht, statt es zu behaupten (BEN, Korrekturpflicht 1).
 */
function befundAus(
  datei: string,
  weitergaben: readonly Weitergabe[],
  verbraucher: readonly string[],
): Grenzbefund {
  return {
    datei,
    weitergaben,
    buehnen: [...new Set(weitergaben.map((w) => w.buehne))].sort(),
    arten: [...new Set(weitergaben.map((w) => w.art))].sort(),
    felder: [...new Set(weitergaben.flatMap((w) => w.fehlt))].sort(),
    verbraucher: [...verbraucher],
  };
}

function grenzBefund(datei: string): Grenzbefund {
  return befundAus(
    datei,
    WEITERGABEN.filter((w) => w.datei === datei),
    verbraucherZweiterHand(datei),
  );
}

/** Die gemessenen Helferdateien, jede einmal. */
function gemesseneHelfer(): string[] {
  return [...new Set(WEITERGABEN.map((w) => w.datei))].sort();
}

/** „`setViewportSize`" oder, wenn nichts dazukommt, der ehrliche Satz dafür. */
function preisText(felder: readonly string[]): string {
  return felder.length > 0
    ? `\`${felder.join("`, `")}\``
    : "die Seitentypisierung unverändert (kein Preis)";
}

function beziehertext(verbraucher: readonly string[]): string {
  const kurz = verbraucher.map((d) => d.split("/").pop() ?? d);
  return kurz.length > 0 ? `\`${kurz.join("`, `")}\`` : "niemanden";
}

/** Die Zeile, die im Torprotokoll steht — Datei, Bauform, Bühne, Feld und Bezieher, nie nur eine Zahl. */
function grenzZeile(bef: Grenzbefund): string {
  const wie = bef.weitergaben.map((w) => `${w.art} \`${w.name}\`:${w.zeile}`).join(", ");
  return (
    `[${bef.buehnen.join("+")}] \`${bef.datei}\` (${wie}) reicht ${preisText(bef.felder)} ` +
    `über die Modulgrenze an ${beziehertext(bef.verbraucher)} weiter`
  );
}

/**
 * DER VERGLEICH VON MESSUNG UND REGISTER — der Rumpf von V11, als reine Funktion.
 *
 * Er steht hier und nicht im `it`, weil er sonst nur mit dem echten Baum liefe und damit nur mit den
 * beiden Zeilen, die heute im Register stehen. Ein Fall, der NIE rot gesehen wurde, ist kein Beleg
 * (Lehre JOB 3489): V13 fährt dieselbe Funktion unten mit synthetischen Befunden und einem LEEREN
 * Register und misst nach, dass ein neu gebauter Helfer zweiter Hand sie wirklich rot macht.
 *
 * Rot in BEIDE Richtungen, dieselbe Doktrin wie V2 beim `ALTBESTAND`.
 */
function grenzMeldungen(
  befunde: ReadonlyMap<string, Grenzbefund>,
  register: ReadonlyMap<string, Grenzzeile>,
): string[] {
  const meldungen: string[] = [];
  for (const [datei, bef] of befunde) {
    if (register.has(datei)) {
      continue;
    }
    const buehne = BUEHNEN.find((x) => x.kurz === bef.buehnen[0]);
    const ort = `\`export interface ${buehne?.seitentyp ?? "Seite"}\` von \`${buehne?.pfad ?? bef.buehnen.join("+")}\``;
    meldungen.push(
      `\`${datei}\` reicht ${preisText(bef.felder)} über die Modulgrenze an ` +
        `${beziehertext(bef.verbraucher)} weiter und ist nicht registriert — trage das Feld in ` +
        `${ort} ein, oder registriere die Grenze hier`,
    );
  }
  for (const [datei, eintrag] of register) {
    const bef = befunde.get(datei) ?? befundAus(datei, [], []);
    if (bef.weitergaben.length === 0) {
      meldungen.push(
        `${datei}: nichts wird mehr über eine Modulgrenze weitergereicht — der Eintrag gehört gelöscht`,
      );
      continue;
    }
    for (const feld of eintrag.felder) {
      if (!bef.felder.includes(feld)) {
        meldungen.push(
          `${datei}: „${feld}" wird nicht mehr über die Modulgrenze weitergereicht — Karteileiche in der Zeile`,
        );
      }
    }
    for (const feld of bef.felder) {
      if (!eintrag.felder.includes(feld)) {
        meldungen.push(
          `${datei}: „${feld}" wird zusätzlich über die Modulgrenze an ` +
            `${beziehertext(bef.verbraucher)} weitergereicht und steht nicht in der Zeile — trage ` +
            `das Feld in \`Seite\` von \`${bef.buehnen.join("+")}\` ein, oder ergänze es hier`,
        );
      }
    }
    if (!bef.buehnen.includes(eintrag.buehne)) {
      meldungen.push(
        `${datei}: die Zeile sagt Bühne „${eintrag.buehne}", gemessen wurde [${bef.buehnen.join(", ")}]`,
      );
    }
    if (!bef.arten.includes(eintrag.art)) {
      meldungen.push(
        `${datei}: die Zeile sagt Bauform „${eintrag.art}", gemessen wurde [${bef.arten.join(", ")}]`,
      );
    }
  }
  return meldungen;
}

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
// unbekannte Seitenfunktion, damit allein Schreibweise und Bühne sich unterscheiden.
//
// DAS PROBEFELD MUSS UNBEKANNT BLEIBEN, UND DAS IST KEINE FORMSACHE (JOB 3775). Bis dahin war es
// `mouse.click` — und `mouse` war genau eines der Felder, die JOB 3775 in `Seite` von h4 eingetragen
// hat. In dem Augenblick hätten alle h4-Fälle der Kalibrierung „kein Fund" gemessen und der Fall
// wäre rot geworden: richtig laut, aber aus dem falschen Grund. Genauso stand es um das Unterfeld
// `keyboard.type`. Beide sind ersetzt, und V6 misst seither ausdrücklich nach, dass das Probefeld an
// KEINER Bühne bekannt ist — sonst kalibrierte die Kalibrierung irgendwann nur noch ihr Schweigen.
//
// JOB 3819 HAT DIESELBE FRAGE FÜR h6 GESTELLT und sie NICHT angenommen, sondern der Schranke
// überlassen: die vier dort eingetragenen Felder (`goBack`, `locator`, `getByTestId`, `mouse`) sind
// weder `dragAndDrop` noch `keyboard.insertText`, also bleibt die Kalibrierung an h6 scharf — und
// zwar gemessen, nicht behauptet, denn die zwei Zeilen unten in V6 laufen über JEDE Bühne. Wer als
// nächster ein Feld in eine `Seite` einträgt, braucht hier nichts nachzupflegen: er wird rot, wenn
// er das Probefeld trifft, und still weitergelassen, wenn nicht.
/** Das Probefeld: eine Seitenfunktion, die keine der drei Bühnen führt. V6 misst genau das nach. */
const UNGEDECKT = "dragAndDrop";
const ZIEHEN = "{ starten(von: string, nach: string): Promise<void> }";
/** Dasselbe eine Ebene tiefer: ein Unterfeld von `keyboard`, das keine Bühne kennt. */
const UNGEDECKT_UNTER = "insertText";
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
      quelle: `${kopf}interface KZieh extends ${b.seitentyp} { ${UNGEDECKT}: ${ZIEHEN} }\nasync function probe(): Promise<void> { await (seite() as unknown as KZieh).${UNGEDECKT}.starten("a", "b"); }`,
      erwartet: [UNGEDECKT],
      buehne: b.kurz,
    });
    faelle.push({
      name: `${b.kurz} · Schreibweise 2: Cast auf ein Typliteral`,
      quelle: `${kopf}async function probe(): Promise<void> {\n  await (seite() as unknown as { ${UNGEDECKT}: ${ZIEHEN} }).${UNGEDECKT}.starten("a", "b");\n}`,
      erwartet: [UNGEDECKT],
      buehne: b.kurz,
    });
    faelle.push({
      name: `${b.kurz} · Schreibweise 3: Typalias über den indizierten Zugriff`,
      quelle: `${kopf}type KZieh = ${b.standtyp}["seite"] & { ${UNGEDECKT}: ${ZIEHEN} };\ndeclare const k: KZieh;\n`,
      erwartet: [UNGEDECKT],
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
      quelle: `${kopf}type KZieh = (${b.standtyp}["seite"] & { ${UNGEDECKT}: ${ZIEHEN} });\ndeclare const k: KZieh;\n`,
      erwartet: [UNGEDECKT],
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
      quelle: `${kopf}// type KZieh = (${b.standtyp}["seite"] & { ${UNGEDECKT}: ${ZIEHEN} });\nexport const nichts3a = 1;\n`,
      erwartet: [],
      buehne: "",
    });
    faelle.push({
      name: `${b.kurz} · Schreibweise 3b: indizierter Zugriff über einen lokalen Behälteralias`,
      quelle: `${kopf}type KStand = ${b.standtyp};\ntype KZieh = KStand["seite"] & { ${UNGEDECKT}: ${ZIEHEN} };\ndeclare const k: KZieh;\n`,
      erwartet: [UNGEDECKT],
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
      quelle: `${kopf}// type KStand = ${b.standtyp};\n// type KZieh = KStand["seite"] & { ${UNGEDECKT}: ${ZIEHEN} };\nexport const nichts3b = 1;\n`,
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
      quelle: `${kopf}type KZieh = KK${KETTENGLIEDER - 1}["seite"] & { ${UNGEDECKT}: ${ZIEHEN} };\n${kette}\ndeclare const k: KZieh;\n`,
      erwartet: [UNGEDECKT],
      buehne: b.kurz,
    });

    // (G1) DER RINGSCHLUSS. `type ZA = ZB; type ZB = ZA` ist für TypeScript ein Fehler (TS2456), kann
    // also in echtem Code gar nicht stehen — dieser Fall belegt trotzdem, dass der Auflöser daran
    // weder hängenbleibt noch eine Bühne erfindet: keiner der beiden Namen führt je zu einer Bühne,
    // also gibt es keinen Fund. Ohne diesen Fall wäre „bricht von selbst ab" eine reine Behauptung.
    faelle.push({
      name: `${b.kurz} · Grenze: Ringschluss im Behälteralias — kein Fund, und kein Hänger`,
      quelle: `${kopf}type ZA = ZB;\ntype ZB = ZA;\ntype KZieh = ZA["seite"] & { ${UNGEDECKT}: ${ZIEHEN} };\ndeclare const k: KZieh;\n`,
      erwartet: [],
      buehne: "",
    });

    // (G2) DER VERBRAUCHER AUS DRITTER HAND. Das ist die im Kopf benannte Grenze (:45-51), und sie
    // bleibt mit Absicht eine: `tests/profil-schmal/schmal-buehne.ts` holt aus h6 nur `BrowserFn`,
    // `DIST`, `ORIGIN` und `fn` und deklariert ein EIGENES `Seite`. Wer Re-Exporte verfolgte, zählte
    // dort eine Schuld, die es nicht gibt. Also wird die Grenze GEMESSEN statt geschlossen — und
    // damit sie nicht bloß „der Testkörper sagt nichts" heisst, steht direkt daneben der GEGENPOL:
    // derselbe Rumpf, Zeichen für Zeichen, nur mit direktem Bühnenimport. Er MUSS melden.
    //
    // WAS DIESER FALL NICHT KANN (JOB 3947): sein Modulspezifizierer ist ERFUNDEN — das Modul
    // `./ein-helfer-der-die-buehne-benutzt` gibt es im Baum nicht. Er belegt damit die Bauart des
    // Auflösers, aber keine Zeile des Bestands. Dieselbe Grenze an einem echten MODULPAAR misst
    // V13 (R2/R3), und was sie heute kostet, zählt V11.
    const rumpfAusDritterHand = `interface KZieh extends ${b.seitentyp} { ${UNGEDECKT}: ${ZIEHEN} }\nasync function probe(): Promise<void> { await (seite() as unknown as KZieh).${UNGEDECKT}.starten("a", "b"); }`;
    faelle.push({
      name: `${b.kurz} · Grenze: Verbraucher AUS DRITTER HAND (über einen re-exportierenden Helfer) wird nicht gesehen`,
      quelle: `import type { ${b.seitentyp} } from "./ein-helfer-der-die-buehne-benutzt";\ndeclare function seite(): ${b.seitentyp};\n${rumpfAusDritterHand}`,
      erwartet: [],
      buehne: "",
    });
    faelle.push({
      name: `${b.kurz} · Gegenpol zur Grenze: derselbe Rumpf, nur direkt an der Bühne — meldet`,
      quelle: `${kopf}${rumpfAusDritterHand}`,
      erwartet: [UNGEDECKT],
      buehne: b.kurz,
    });

    // (G3) …aber der HELFER SELBST wird sehr wohl gesehen: er importiert die Bühne, also fällt er in
    // die Menge. Genau so ist `tests/navigation-schmal/kopfband-messung.ts` gebaut. Die Grenze aus G2
    // ist damit scharf gezogen: sie verliert den Verbraucher zweiter Hand, nicht den Helfer, der die
    // Aufweitung wirklich schreibt.
    //
    // WIE DIESER FALL HEISST, IST SEIT JOB 3947 GENAUER (Lieferung 7). Er hiess „der
    // re-exportierende Helfer", gemessen hat er aber den DIREKTEN IMPORTEUR: seine Quelle beginnt mit
    // `kopf`, also mit `import type { Seite, Stand } from "<Bühne>"`, und die Zeile
    // `export type { Seite };` darunter ist ein LOKALER Re-Export ohne Modulspezifizierer — kein
    // Modulübergang. Der Name versprach mehr, als der Fall hielt; die Sache selbst bleibt
    // unverändert, denn sie ist richtig. Der ECHTE Re-Export über eine Modulgrenze steht in V13 (R1).
    faelle.push({
      name: `${b.kurz} · der Helfer selbst importiert die Bühne und weitet sie auf — und wird gesehen`,
      quelle: `${kopf}export type SeiteMitZiehen = ${b.seitentyp} & { ${UNGEDECKT}: ${ZIEHEN} };\nexport type { ${b.seitentyp} };\n`,
      erwartet: [UNGEDECKT],
      buehne: b.kurz,
    });

    faelle.push({
      name: `${b.kurz} · Gegenstück: derselbe Wortlaut als KOMMENTAR wird nicht gefunden`,
      quelle: `${kopf}// interface KZieh extends ${b.seitentyp} { ${UNGEDECKT}: ${ZIEHEN} }\n// type KZieh = ${b.standtyp}["seite"] & { ${UNGEDECKT}: ${ZIEHEN} };\n// await (seite() as unknown as { ${UNGEDECKT}: ${ZIEHEN} }).${UNGEDECKT}.starten("a", "b");\nexport const nichts = 1;\n`,
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
      quelle: `${kopf}type KZieh = { ${UNGEDECKT}: ${ZIEHEN} };\nasync function probe(): Promise<void> { await (seite() as unknown as KZieh).${UNGEDECKT}.starten("a", "b"); }`,
      erwartet: [UNGEDECKT],
      buehne: "h4",
    });
    faelle.push({
      name: "h4 · Schnittmenge mit `Seite` unmittelbar im Cast",
      quelle: `${kopf}async function probe(): Promise<void> {\n  await (seite() as unknown as (${h4.seitentyp} & { ${UNGEDECKT}: ${ZIEHEN} })).${UNGEDECKT}.starten("a", "b");\n}`,
      erwartet: [UNGEDECKT],
      buehne: "h4",
    });
    faelle.push({
      name: "h4 · verstecktes Unterfeld über einen Typalias",
      // Das Unterfeld ist seit JOB 3775 `insertText` und nicht mehr `type`: `keyboard.type` steht
      // jetzt in `Seite` von h4 und wäre hier „bekannt" — der Fall prüfte dann nichts mehr.
      quelle: `${kopf}type KTasten = { press(taste: string): Promise<void>; ${UNGEDECKT_UNTER}(text: string): Promise<void> };\ninterface KSeite extends ${h4.seitentyp} { keyboard: KTasten }\nasync function probe(): Promise<void> { await (seite() as KSeite).keyboard.${UNGEDECKT_UNTER}("abc"); }`,
      erwartet: [`keyboard.${UNGEDECKT_UNTER}`],
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

// ---- Die Kalibrierung über die MODULGRENZE: zwei Quellen statt einer (JOB 3947) ------------------
//
// `kalibriere` oben baut EINE synthetische Datei. Ein Modulübergang lässt sich damit nicht messen:
// G2 behilft sich deshalb mit einem ERFUNDENEN Modulspezifizierer, und G3 misst in Wahrheit den
// direkten Importeur. Hier stehen dagegen ZWEI Quellen — Helfer A und Verbraucher B, B importiert aus
// A —, und darauf laufen die ECHTEN Erheber: `buehnenVon`, `bindungenVon`, `weitergabenAusBaum` und
// `aufweitungenAusBaum`. Keine Datei wird dafür angelegt; beides ist Quelltext im Speicher.
const KAL_A_NAME = "<kalibrier-helfer>";
const KAL_A = `tests/design-vorrichtung/${KAL_A_NAME}.ts`;
const KAL_B = "tests/design-vorrichtung/<kalibrier-verbraucher>.test.ts";

interface Modulfall {
  readonly name: string;
  /** Quelle des Helfers A. */
  readonly a: string;
  /** Quelle des Verbrauchers B — er importiert aus A oder, im Gegenpol, direkt aus der Bühne. */
  readonly b: string;
  /** Die Bühnen, die A importiert ODER re-exportiert (`buehnenVon` zählt beides). */
  readonly aBuehnen: readonly string[];
  /** Wie viele Seiten-/Behälterbindungen `bindungenVon(A)` liefert — bei reinem Re-Export NULL. */
  readonly aBindungen: number;
  /** Gilt A als Helfer zweiter Hand, und zu welchem Preis? Leerer Kurzname heisst: kein Helfer. */
  readonly aHelferBuehne: string;
  /** Die Bauform, unter der A gemeldet werden muss — leer, wenn A kein Helfer ist. */
  readonly aArt: Weitergabe["art"] | "";
  readonly aPreis: readonly string[];
  /** Was `aufweitungenAusBaum(A)` melden muss — Weiterreichung ist KEINE Aufweitung. */
  readonly aAufweitungen: readonly string[];
  /** Was `aufweitungenAusBaum(B)` melden muss, und an welcher Bühne. */
  readonly bFund: readonly string[];
  readonly bBuehne: string;
}

function modulfaelle(): Modulfall[] {
  const faelle: Modulfall[] = [];
  for (const b of BUEHNEN) {
    const pfad = importPfad(b);
    /** A als reiner Re-Exporteur: eine `ExportDeclaration` MIT Modulspezifizierer, sonst nichts. */
    const aReExport = `export type { ${b.seitentyp}, ${b.standtyp} } from "${pfad}";\n`;
    /**
     * Der Rumpf von B — Zeichen für Zeichen derselbe in R2 und R3. Nur die Importzeile darüber
     * unterscheidet sich, und genau das ist die Aussage: ohne den Gegenpol hiesse R2 bloss „der
     * Testkörper sagt nichts" (dieselbe Begründung wie bei G2).
     */
    const rumpf = `declare function seite(): ${b.seitentyp};\ninterface KZieh extends ${b.seitentyp} { ${UNGEDECKT}: ${ZIEHEN} }\nasync function probe(): Promise<void> { await (seite() as unknown as KZieh).${UNGEDECKT}.starten("a", "b"); }`;
    const ausA = `import type { ${b.seitentyp} } from "./${KAL_A_NAME}";\n`;
    const ausBuehne = `import type { ${b.seitentyp} } from "${pfad}";\n`;

    // R1 — DIE ASYMMETRIE, ZUM ERSTEN MAL FESTGEHALTEN. A re-exportiert nur; `buehnenVon` zählt ihn
    // trotzdem in die Verbrauchermenge (und damit in die Zahl, die V3 festnagelt), `bindungenVon`
    // liefert aber LEERE Mengen — A ist strukturell unprüfbar. Bisher stand das nur im Code.
    faelle.push({
      name: `${b.kurz} · R1: der echte Re-Export über die Modulgrenze — Helfer zweiter Hand, aber ohne jede Bindung`,
      a: aReExport,
      b: `${ausA}export const nichtsR1: ${b.seitentyp} | null = null;\n`,
      aBuehnen: [b.kurz],
      aBindungen: 0,
      aHelferBuehne: b.kurz,
      aArt: "re-export",
      aPreis: [],
      aAufweitungen: [],
      bFund: [],
      bBuehne: "",
    });

    // R2 — DIE GRENZE, an einem echten Modulpaar statt am erfundenen Spezifizierer aus G2.
    faelle.push({
      name: `${b.kurz} · R2: der Verbraucher zweiter Hand weitet auf — und wird NICHT gesehen (die Grenze)`,
      a: aReExport,
      b: `${ausA}${rumpf}`,
      aBuehnen: [b.kurz],
      aBindungen: 0,
      aHelferBuehne: b.kurz,
      aArt: "re-export",
      aPreis: [],
      aAufweitungen: [],
      bFund: [],
      bBuehne: "",
    });

    // R3 — DER GEGENPOL: derselbe Rumpf, nur direkt an der Bühne. Er MUSS melden.
    faelle.push({
      name: `${b.kurz} · R3: Gegenpol zu R2 — derselbe Rumpf, nur direkt an der Bühne, meldet`,
      a: aReExport,
      b: `${ausBuehne}${rumpf}`,
      aBuehnen: [b.kurz],
      aBindungen: 0,
      aHelferBuehne: b.kurz,
      aArt: "re-export",
      aPreis: [],
      aAufweitungen: [],
      bFund: [UNGEDECKT],
      bBuehne: b.kurz,
    });

    // R4 — DIE BAUFORM VON `schmal-buehne.ts`, synthetisch: A holt aus der Bühne nur einen Baustein
    // und deklariert ein EIGENES `Seite`. Beide Aussagen stehen in EINEM Fall: A ist ein Helfer
    // zweiter Hand MIT Preis, erzeugt aber keine Aufweitung — sein `Seite` ist nicht aus der Bühne
    // abgeleitet, also hat V1 dort zu Recht nichts zu melden.
    faelle.push({
      name: `${b.kurz} · R4: die Neudeklaration (Bauform von \`schmal-buehne.ts\`) — Preis ja, Aufweitung nein`,
      a: `import { fn } from "${pfad}";\nexport interface ${b.seitentyp} { ${UNGEDECKT}: ${ZIEHEN} }\nexport const nutzR4 = fn;\n`,
      b: `${ausA}export const nichtsR4: ${b.seitentyp} | null = null;\n`,
      aBuehnen: [b.kurz],
      aBindungen: 0,
      aHelferBuehne: b.kurz,
      aArt: "neudeklaration",
      aPreis: [UNGEDECKT],
      aAufweitungen: [],
      bFund: [],
      bBuehne: "",
    });

    // R5 — DAS GEGENSTÜCK, DAS NICHT ANSCHLAGEN DARF: A holt aus der Bühne nur `fn` und reicht keine
    // Typisierung weiter. Ohne diesen Fall hiesse „Helfer zweiter Hand" bloss „importiert eine Bühne".
    faelle.push({
      name: `${b.kurz} · R5: Gegenstück — A holt nur \`fn\` und reicht nichts weiter, also kein Helfer`,
      a: `import { fn } from "${pfad}";\nexport const nutzR5 = fn;\n`,
      b: `import { nutzR5 } from "./${KAL_A_NAME}";\nexport const wiederR5 = nutzR5;\n`,
      aBuehnen: [b.kurz],
      aBindungen: 0,
      aHelferBuehne: "",
      aArt: "",
      aPreis: [],
      aAufweitungen: [],
      bFund: [],
      bBuehne: "",
    });

    // R6 — DERSELBE WORTLAUT ALS KOMMENTAR. Kommentare kommen im AST nicht vor; der Erheber darf sie
    // also nicht sehen (Lehre JOB 3489, und JOB 3931: „glaubt dem Rohtext und dem blossen Namen").
    faelle.push({
      name: `${b.kurz} · R6: Gegenstück — der Re-Export und die Neudeklaration als KOMMENTAR`,
      a: `import { fn } from "${pfad}";\n// export type { ${b.seitentyp} } from "${pfad}";\n// export interface ${b.seitentyp} { ${UNGEDECKT}: ${ZIEHEN} }\nexport const nutzR6 = fn;\n`,
      b: `import { nutzR6 } from "./${KAL_A_NAME}";\nexport const wiederR6 = nutzR6;\n`,
      aBuehnen: [b.kurz],
      aBindungen: 0,
      aHelferBuehne: "",
      aArt: "",
      aPreis: [],
      aAufweitungen: [],
      bFund: [],
      bBuehne: "",
    });

    // ---- R7–R9: DIESELBE NEUDEKLARATION IN DREI ANDEREN SCHREIBWEISEN (Runde 2) -----------------
    //
    // Das sind die NEUN GEGENPROBEN des Prüfers, drei je Bühne, dauerhaft in den Lauf gestellt. Alle
    // drei sind für TypeScript dasselbe wie R4 — und alle drei kamen in Runde 1 durch: R7 und R8
    // fielen ganz aus der Helfermenge (`mitgliederVon` gab `undefined`), R9 blieb sichtbar, wurde
    // aber mit dem Preis NULL gemessen, weil `n.members` leer ist und das Feld nebenan stand.
    // Derselbe Typ muss denselben Preis liefern; sonst hängt der Wächter wieder an der Schreibweise.
    const nutz = (nr: string): string => `export const nutz${nr} = fn;\n`;
    const holeFn = `import { fn } from "${pfad}";\n`;
    const bNimmtSeite = (nr: string): string =>
      `import type { ${b.seitentyp} } from "./${KAL_A_NAME}";\nexport const nichts${nr}: ${b.seitentyp} | null = null;\n`;

    faelle.push({
      name: `${b.kurz} · R7: Neudeklaration über einen LOKALEN ALIAS — derselbe Preis wie R4`,
      a: `${holeFn}type EigenR7 = { ${UNGEDECKT}: ${ZIEHEN} };\nexport type ${b.seitentyp} = EigenR7;\n${nutz("R7")}`,
      b: bNimmtSeite("R7"),
      aBuehnen: [b.kurz],
      aBindungen: 0,
      aHelferBuehne: b.kurz,
      aArt: "neudeklaration",
      aPreis: [UNGEDECKT],
      aAufweitungen: [],
      bFund: [],
      bBuehne: "",
    });

    // R8 — die SCHNITTMENGE. Sie sagt zwei Dinge in einem Fall: das ungedeckte Feld wird gefunden,
    // UND der andere Teil (`route`, das jede der drei Bühnen selbst führt) wird aufgelöst und
    // richtigerweise NICHT als Preis gezählt. Ein Auflöser, der die Schnittmenge nur überspringt,
    // wäre hier grün und in der ersten Hälfte trotzdem blind.
    faelle.push({
      name: `${b.kurz} · R8: Neudeklaration als SCHNITTMENGE — der Preis ist das ungedeckte Feld, nicht \`route\``,
      a: `${holeFn}interface TeilR8 { route(url: string): Promise<void> }\nexport type ${b.seitentyp} = TeilR8 & { ${UNGEDECKT}: ${ZIEHEN} };\n${nutz("R8")}`,
      b: bNimmtSeite("R8"),
      aBuehnen: [b.kurz],
      aBindungen: 0,
      aHelferBuehne: b.kurz,
      aArt: "neudeklaration",
      aPreis: [UNGEDECKT],
      aAufweitungen: [],
      bFund: [],
      bBuehne: "",
    });

    faelle.push({
      name: `${b.kurz} · R9: Neudeklaration über LOKALE VERERBUNG — ein leeres \`{}\` ist kein Preis von null`,
      a: `${holeFn}interface EigenR9 { ${UNGEDECKT}: ${ZIEHEN} }\nexport interface ${b.seitentyp} extends EigenR9 {}\n${nutz("R9")}`,
      b: bNimmtSeite("R9"),
      aBuehnen: [b.kurz],
      aBindungen: 0,
      aHelferBuehne: b.kurz,
      aArt: "neudeklaration",
      aPreis: [UNGEDECKT],
      aAufweitungen: [],
      bFund: [],
      bBuehne: "",
    });

    // R10 — DER NICHT AUFLÖSBARE EIGENE SEITENTYP (BEN, Prüfpunkt 6). `Fremd` kommt aus einem anderen
    // Modul; dieser Wächter kann nicht sagen, was dahintersteckt. Er darf dann nicht schweigen und
    // auch nicht „keine Felder" behaupten, sondern meldet den Helfer MIT dem Vermerk. Fail-closed,
    // dieselbe Doktrin wie `NICHT_AUFLOESBAR` bei den Unterfeldern.
    faelle.push({
      name: `${b.kurz} · R10: der eigene Seitentyp ist NICHT AUFLÖSBAR — er meldet unbekannt statt zu verschwinden`,
      a: `${holeFn}import type { Fremd } from "./<ein-fremdes-modul>";\nexport type ${b.seitentyp} = Fremd;\n${nutz("R10")}`,
      b: bNimmtSeite("R10"),
      aBuehnen: [b.kurz],
      aBindungen: 0,
      aHelferBuehne: b.kurz,
      aArt: "neudeklaration",
      aPreis: [nichtAufloesbar("Fremd")],
      aAufweitungen: [],
      bFund: [],
      bBuehne: "",
    });
  }
  return faelle;
}

const MODULFAELLE = modulfaelle();

function quelle(pfad: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    pfad,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
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
      // Die Untergrenze ist die GEMESSENE Feldzahl DIESER Bühne (`mindestFelder`) und nicht mehr
      // eine gemeinsame Sechs — ein verlorenes Feld macht in den Verbraucherdateien lautlos eine
      // Aufweitung wieder berechtigt, also muss der Verlust hier auffallen.
      const felder = felderVon(b.kurz);
      console.info(
        `JOB 3775 · V3-${b.kurz}: ${felder.size} Felder in \`${b.seitentyp}\` (Untergrenze ${b.mindestFelder}) — ${[...felder.keys()].join(", ")}`,
      );
      expect(
        [...felder.keys()],
        `${b.pfad}: \`${b.seitentyp}\` kennt \`goto\` nicht mehr`,
      ).toContain("goto");
      expect(
        felder.size,
        `${b.pfad}: \`${b.seitentyp}\` hat Felder verloren — gemessen ${felder.size}, festgenagelt ${b.mindestFelder}`,
      ).toBeGreaterThanOrEqual(b.mindestFelder);
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
    // `interface X { … }` hinter einem Cast, `type X = { … }` aber nicht; und bis JOB
    // 3609 sah niemand dasselbe an h6 oder h3. Beides ist derselbe Verstoß, also muss beides
    // denselben Fund erzeugen — mit Datei, Zeile, Typname, BÜHNE und Feld.

    // ZUERST DIE VORAUSSETZUNG DER GANZEN KALIBRIERUNG (JOB 3775): das Probefeld darf an KEINER
    // Bühne bekannt sein. Trägt es jemand in eine `Seite` ein, messen alle Fälle dieser Bühne
    // plötzlich „kein Fund" — die Kalibrierung wäre dann zwar rot, aber niemand sähe warum. Diese
    // zwei Zeilen sagen es. Genau das ist beim Umbau von `mouse` und `keyboard.type` passiert.
    for (const b of BUEHNEN) {
      const felder = felderVon(b.kurz);
      expect(
        [...felder.keys()],
        `${b.pfad} kennt „${UNGEDECKT}" jetzt selbst — die Kalibrierung braucht ein anderes Probefeld`,
      ).not.toContain(UNGEDECKT);
      expect(
        felder.get("keyboard") ?? [],
        `${b.pfad} kennt „keyboard.${UNGEDECKT_UNTER}" jetzt selbst — Probe-Unterfeld wechseln`,
      ).not.toContain(UNGEDECKT_UNTER);
    }

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
    // JOB 3947 HAT DIESE ZAHL NACHGERECHNET UND NICHT ANGERÜHRT: seine vier Modulfälle (R1–R4) und
    // ihre zwei Gegenstücke brauchen ZWEI Quellen und stehen deshalb in einer eigenen Liste
    // (`MODULFAELLE`), mit eigener festgenagelter Zahl in V13. Hier kam kein Fall dazu; G3 wurde nur
    // umbenannt, und sein Namensbestandteil „Helfer selbst importiert" steht unverändert unten in der
    // Formenliste — die Umbenennung darf diese Prüfung nicht ins Leere laufen lassen.
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

  it("V10 · die Bühne h4 ist abgeräumt — und der ALTBESTAND nimmt für sie keine Zeile mehr an", () => {
    // WARUM NUR h4 UND NICHT ALLE DREI. V1 und V2 halten den Altbestand in beide Richtungen, aber
    // keiner von beiden verhindert, dass er WÄCHST: die nächste h4-Datei, die sich `dragAndDrop`
    // selbst nachreicht, bekäme heute einfach eine fünfte Zeile, und der Gewinn von JOB 3564 wäre
    // still wieder weg. Für h4 ist diese Tür ab JOB 3775 zu — die Bühne hat ihre Felder, also gibt
    // es keinen Grund mehr, an ihr etwas zuzugestehen.
    //
    // h6 UND h3 BLEIBEN AUSDRÜCKLICH ZUGELASSEN. Ihre Bühnen tragen ihre Felder noch nicht (h6 kennt
    // `setViewportSize` nicht, h3 kein `waitForLoadState`), und ihre Verbraucher gehören fremden
    // Zielpfaden. Ein Fall, der sie hier mitverböte, wäre am Tag seiner Entstehung rot und würde
    // abgeschaltet statt erfüllt. Wer h6 oder h3 abräumt, erweitert diese Menge um seinen Kurznamen.
    const ABGERAEUMT = ["h4"] as const;
    // Ohne diese Zeile wäre der Fall nach einer Umbenennung im Register lautlos grün: er prüfte dann
    // eine Bühne, die es nicht mehr gibt.
    for (const kurz of ABGERAEUMT) {
      expect(
        BUEHNEN.map((b) => b.kurz),
        `Die abgeräumte Bühne „${kurz}" steht nicht mehr im Register — dieser Fall bewacht nichts`,
      ).toContain(kurz);
    }
    const rueckfall: string[] = [];
    for (const [datei, zeile_] of ALTBESTAND) {
      if (!ABGERAEUMT.includes(zeile_.buehne as (typeof ABGERAEUMT)[number])) {
        continue;
      }
      const buehne = BUEHNEN.find((b) => b.kurz === zeile_.buehne);
      const ort = `\`export interface ${buehne?.seitentyp ?? "Seite"}\` von \`${buehne?.pfad ?? "der Bühne"}\``;
      const weg = `trage das Feld in ${ort} ein und lösche diese Altzeile`;
      rueckfall.push(
        `${datei}: reicht sich „${zeile_.felder.join(", ")}" selbst nach — ${weg}. Die Bühne \`${zeile_.buehne}\` ist seit JOB 3775 abgeräumt und nimmt keinen Neuzugang mehr an.`,
      );
    }
    expect(
      rueckfall,
      `Für diese Bühnen gibt es keinen Altbestand mehr: ${ABGERAEUMT.join(", ")}`,
    ).toEqual([]);
  });

  it("V11 · der Preis der Grenze ist GEZÄHLT, nicht behauptet — jeder Helfer zweiter Hand steht im Register", () => {
    // Dieselbe Doktrin wie V2 beim `ALTBESTAND`, nur für die andere Sache: nicht die Aufweitung, die
    // eine Datei sich selbst nachreicht, sondern die Typisierung, die sie über eine MODULGRENZE
    // abgibt. In beide Richtungen rot — sonst verwaltet auch dieses Register irgendwann Gespenster.
    const helfer = gemesseneHelfer();
    for (const datei of helfer) {
      console.info(`JOB 3947 · V11 Grenze: ${grenzZeile(grenzBefund(datei))}`);
    }
    if (helfer.length === 0) {
      // Kein stiller Erfolg: die Aussage „die Grenze kostet heute nichts" wird ausgesprochen.
      console.info(
        "JOB 3947 · V11: kein Helfer zweiter Hand im Baum gemessen — die Grenze kostet heute nichts.",
      );
    }
    const meldungen = grenzMeldungen(
      new Map(helfer.map((datei) => [datei, grenzBefund(datei)])),
      GRENZFAELLE,
    );
    expect(
      meldungen,
      "Die Grenze zum Verbraucher zweiter Hand bleibt — aber ihr Preis gehört gezählt und nicht " +
        "verschwiegen (BEN zu JOB 3819 R2, Prüfpunkt 6)",
    ).toEqual([]);
  });

  it("V12 · die Verbraucher zweiter Hand werden BENANNT — aufgezählt, nicht verboten", () => {
    // Die Grenze bleibt (R2 misst das nach). Was sich ändert, ist die Sichtbarkeit: wer die Seite
    // aus zweiter Hand bezieht, steht mit Namen im Torprotokoll. Und eine Registerzeile, an der
    // niemand mehr hängt, ist genauso ein Gespenst wie eine ohne Messung.
    const meldungen: string[] = [];
    for (const [datei, eintrag] of GRENZFAELLE) {
      const bezieher = verbraucherZweiterHand(datei);
      console.info(
        `JOB 3947 · V12 zweite Hand: \`${datei}\` [${eintrag.buehne}, ${eintrag.art}] · ` +
          `Preis: ${preisText(eintrag.felder)} · Bezieher: ${bezieher.join(", ") || "(niemand)"}`,
      );
      if (bezieher.length === 0) {
        meldungen.push(
          `${datei}: reicht an niemanden weiter — der Helfer hat keinen Verbraucher zweiter Hand mehr, die Registerzeile gehört gelöscht`,
        );
      }
      for (const pflicht of eintrag.verbraucher) {
        if (!bezieher.includes(pflicht)) {
          meldungen.push(
            `${datei}: „${pflicht}" bezieht die Seite nicht mehr aus diesem Helfer — die festgenagelte Untergrenze der Zeile stimmt nicht mehr`,
          );
        }
      }
    }
    expect(
      meldungen,
      "Jede Zeile in `GRENZFAELLE` muss einen Bezieher haben — sonst reicht der Helfer ins Leere",
    ).toEqual([]);
  });

  it("V13 · kalibriert über die MODULGRENZE: zwei Quellen statt einer (R1–R10)", () => {
    const rest: string[] = [];
    const gleich = (ist: readonly string[], soll: readonly string[]): boolean =>
      [...ist].sort().join("|") === [...soll].sort().join("|");
    for (const fall of MODULFAELLE) {
      const a = quelle(KAL_A, fall.a);
      const b = quelle(KAL_B, fall.b);

      // (1) A steht in der Verbrauchermenge — auch als REINER Re-Exporteur (`buehnenVon` zählt die
      //     `ExportDeclaration` mit), …
      const aBuehnen = buehnenVon(a).map((x) => x.kurz);
      if (!gleich(aBuehnen, fall.aBuehnen)) {
        rest.push(
          `${fall.name}: A gehört zu [${aBuehnen.join(", ")}], erwartet [${fall.aBuehnen.join(", ")}]`,
        );
      }
      // (2) … trägt aber keine Bindung bei: `bindungenVon` steigt bei allem aus, was kein Import ist.
      //     Genau diese Asymmetrie war bisher nirgends gemessen.
      const bindungen = bindungenVon(a);
      const zahl = bindungen.seiten.size + bindungen.staende.size;
      if (zahl !== fall.aBindungen) {
        rest.push(
          `${fall.name}: \`bindungenVon(A)\` liefert ${zahl} Bindungen, erwartet ${fall.aBindungen}`,
        );
      }
      // (3) Der Erheber der Helfer zweiter Hand — Bauform, Bühne und PREIS.
      const weiter = weitergabenAusBaum(a, KAL_A);
      const helferBuehnen = [...new Set(weiter.map((w) => w.buehne))];
      const erwarteteBuehnen = fall.aHelferBuehne === "" ? [] : [fall.aHelferBuehne];
      if (!gleich(helferBuehnen, erwarteteBuehnen)) {
        rest.push(
          `${fall.name}: A gilt als Helfer zweiter Hand von [${helferBuehnen.join(", ")}], erwartet [${erwarteteBuehnen.join(", ")}]`,
        );
      }
      const preis = weiter.flatMap((w) => w.fehlt);
      if (!gleich(preis, fall.aPreis)) {
        rest.push(
          `${fall.name}: A reicht [${preis.join(", ")}] weiter, erwartet [${fall.aPreis.join(", ")}]`,
        );
      }
      const arten = [...new Set(weiter.map((w) => w.art))];
      const erwarteteArten = fall.aArt === "" ? [] : [fall.aArt];
      if (!gleich(arten, erwarteteArten)) {
        rest.push(
          `${fall.name}: A wird als [${arten.join(", ")}] gemeldet, erwartet [${erwarteteArten.join(", ")}]`,
        );
      }
      // (3b) UND DER BEFUND KOMMT AUCH BEI V11 AN. Ein Erheber, der misst, und ein Register, das
      //      nichts davon erfährt, wären zwei Wächter, die einander decken — genau die Lage, in der
      //      Runde 1 grün war, obwohl drei Schreibweisen durchfielen. Deshalb läuft hier DIESELBE
      //      Funktion, die V11 fährt: einmal mit LEEREM Register (muss rot werden und Datei, Preis
      //      und den Weg zur Abhilfe nennen) und einmal mit der passenden Zeile (muss schweigen).
      if (fall.aHelferBuehne !== "" && fall.aArt !== "") {
        const bef = befundAus(KAL_A, weiter, [KAL_B]);
        const ohneZeile = grenzMeldungen(new Map([[KAL_A, bef]]), new Map());
        if (!ohneZeile.some((m) => m.includes(KAL_A) && m.includes("nicht registriert"))) {
          rest.push(
            `${fall.name}: ein neuer Helfer zweiter Hand ohne Registerzeile macht V11 NICHT rot — gemeldet wurde [${ohneZeile.join(" | ")}]`,
          );
        }
        for (const feld of fall.aPreis) {
          if (!ohneZeile.some((m) => m.includes(feld))) {
            rest.push(
              `${fall.name}: die V11-Meldung nennt „${feld}" nicht — eine Zahl ohne Feld ist keine Meldung`,
            );
          }
        }
        const mitZeile = grenzMeldungen(
          new Map([[KAL_A, bef]]),
          new Map([
            [
              KAL_A,
              {
                buehne: fall.aHelferBuehne,
                art: fall.aArt,
                felder: fall.aPreis,
                verbraucher: [KAL_B],
                grund: "Kalibrierung: die Zeile, die zu diesem Befund gehört.",
              },
            ],
          ]),
        );
        if (mitZeile.length > 0) {
          rest.push(
            `${fall.name}: die passende Registerzeile beruhigt V11 nicht — [${mitZeile.join(" | ")}]`,
          );
        }
      }
      // (4) Weiterreichung ist KEINE Aufweitung — sonst zählte dieselbe Sache in beiden Registern.
      const aAuf = aufweitungenAusBaum(a, KAL_A).flatMap((x) => x.fehlt);
      if (!gleich(aAuf, fall.aAufweitungen)) {
        rest.push(
          `${fall.name}: A meldet die Aufweitungen [${aAuf.join(", ")}], erwartet [${fall.aAufweitungen.join(", ")}]`,
        );
      }
      // (5) B, der Verbraucher: die Grenze. Er wird von V1 nicht gesehen, wenn er aus A bezieht —
      //     und sehr wohl, wenn er dieselbe Sache direkt an der Bühne schreibt (R3).
      const bBefund = aufweitungenAusBaum(b, KAL_B);
      const bFund = bBefund.flatMap((x) => x.fehlt);
      if (!gleich(bFund, fall.bFund)) {
        rest.push(
          `${fall.name}: B meldet [${bFund.join(", ")}], erwartet [${fall.bFund.join(", ")}]`,
        );
      }
      for (const x of bBefund) {
        if (x.buehne !== fall.bBuehne) {
          rest.push(`${fall.name}: B meldet Bühne „${x.buehne}", erwartet „${fall.bBuehne}"`);
        }
      }
      // (6) UND DIE GRENZE BLEIBT EINE GRENZE: B ist NIE ein Helfer zweiter Hand. Wer den Erheber so
      //     verstellt, dass er Re-Exporte weiterverfolgt und den Verbraucher einsammelt, wird hier rot.
      const bWeiter = weitergabenAusBaum(b, KAL_B);
      if (bWeiter.length > 0) {
        rest.push(
          `${fall.name}: B wurde als Helfer zweiter Hand eingesammelt (${bWeiter.map((w) => w.name).join(", ")}) — die Grenze ist heimlich geschlossen worden`,
        );
      }
    }
    expect(
      rest,
      "Der Modulübergang lässt sich nur an ZWEI Quellen messen: der echte Re-Export trägt keine " +
        "Bindung (R1), die Grenze hält (R2), ihr Gegenpol meldet (R3), und die Neudeklaration hat " +
        "einen Preis, aber keine Aufweitung (R4) — in JEDER Schreibweise: Alias (R7), Schnittmenge " +
        "(R8), lokale Vererbung (R9) und, wenn sich nichts auflösen lässt, ausdrücklich unbekannt (R10)",
    ).toEqual([]);
    // Die Fallzahl wird MITGEFÜHRT, nicht stehen gelassen: ZEHN je Bühne, und sie setzt sich so
    // zusammen — vier Fälle mit Aussage aus Runde 1 (R1 Asymmetrie, R2 Grenze, R3 Gegenpol,
    // R4 Neudeklaration), zwei Gegenstücke ohne Aussage (R5 `fn` allein, R6 derselbe Wortlaut als
    // Kommentar) und vier aus Runde 2 (R7 lokaler Alias, R8 Schnittmenge, R9 lokale Vererbung,
    // R10 nicht auflösbar). R7–R9 sind die neun Gegenproben des Prüfers, drei je Bühne. Sie stehen
    // in EINER eigenen Liste, deshalb rührt sich `JE_BUEHNE` in V6 nicht.
    const JE_BUEHNE_MODUL = 10;
    expect(MODULFAELLE.length).toBe(BUEHNEN.length * JE_BUEHNE_MODUL);
    for (const b of BUEHNEN) {
      for (const form of ["R1:", "R2:", "R3:", "R4:", "R5:", "R6:", "R7:", "R8:", "R9:", "R10:"]) {
        expect(
          MODULFAELLE.some((f) => f.name.startsWith(`${b.kurz} · ${form}`)),
          `Bühne ${b.kurz}: der Modulfall „${form}" fehlt`,
        ).toBe(true);
      }
    }
  });
});
