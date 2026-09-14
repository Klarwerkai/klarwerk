// ================================================================================================
// JOB 3840 — EIN PROGRAMM, EIN TYPPRÜFER, EINMAL JE LAUF.
// ================================================================================================
//
// WOZU ES DIESE DATEI GIBT. `toter-kandidatenweg.test.ts` beurteilt den Empfänger eines Aufrufs am
// Syntaxbaum EINER Datei, und genau dort endete seine Reichweite: kommt der Träger als Rückgabewert
// einer importierten Funktion herein (`const y = hol(); y.findCandidates({})`), steht in derselben
// Datei weder eine Typangabe noch ein repo-ähnlicher Name. Die Auskunft liegt in der NACHBARDATEI,
// und die kennt nur der Typprüfer. Der braucht ein `ts.Program` — und ein Programm baut man EINMAL.
//
// WARUM NICHT IN `tools/modalgrenze.ts`: die Datei ist gemeinsame Vorrichtung vieler Wächter; ein
// Programmaufbau dort wirkte auf fremde Bestandsdateien. Er wohnt deshalb hier, neben dem einen
// Wächter, der ihn braucht.
//
// WARUM EIN PROGRAMM UND NICHT EINES JE DATEI ODER JE FALL: der Aufbau ist der teure Teil (er liest
// die ganze Fläche samt aufgelöster Abhängigkeiten), die Frage danach ist billig (der Prüfer
// beantwortet sie für einen einzelnen Knoten). Ein Programm je Aufruf machte die Wächterdatei im Tor
// unbezahlbar; `./tools/check` ist der Engpass der Maschine. Die gemessenen Kosten stehen in
// `Typumgebung.aufbauMs` — der Wächter schreibt sie in seine Ausgabe, damit die Zahl gemessen ist
// und nicht behauptet.
//
// WAS DIESE DATEI NICHT TUT: sie beurteilt nichts. Was als Repository gilt, steht als Regel im
// Wächter (`REPO_TYPEN` in `toter-kandidatenweg.test.ts`) — hier wird nur das Programm gebaut.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript";
import { WURZEL, posix, quelleAus } from "../../tools/modalgrenze";

export interface Typumgebung {
  readonly pruefer: ts.TypeChecker;
  /**
   * Die Quelle, wie sie IM Programm liegt.
   *
   * Der Prüfer beantwortet ausschliesslich Fragen zu SEINEN Knoten; ein zweiter, nebenher geparster
   * Baum derselben Datei ist für ihn ein Fremdkörper und liefert `any`. Wer den Prüfer fragen will,
   * läuft deshalb über diesen Baum.
   */
  quelle(datei: string): ts.SourceFile | undefined;
  /** Was der Aufbau gekostet hat, in Millisekunden — gemessen, nicht geschätzt. */
  readonly aufbauMs: number;
}

/** Die Grundlage der Übersetzeroptionen: dieselbe Datei, gegen die `npx tsc --noEmit` fährt. */
const GRUNDLAGE = "tsconfig.json";

/** Das Verzeichnis der Web-App — Anker ihrer eigenen Übersetzerkonfiguration. */
const WEB = join("apps", "web");

/** Die Übersetzeroptionen EINER Konfigurationsdatei, aus ihr gelesen statt nachgebaut. */
function gelesen(datei: string, anker: string): ts.CompilerOptions {
  const roh = ts.readConfigFile(join(anker, datei), (pfad) => readFileSync(pfad, "utf8"));
  const config = (roh.config ?? {}) as { compilerOptions?: unknown };
  return ts.convertCompilerOptionsFromJson(config.compilerOptions, anker).options;
}

/**
 * JOB 3867 — DIE ALIAS-AUSKUNFT DER WEB-FLÄCHE, AUS `apps/web/tsconfig.json` GELESEN.
 *
 * WARUM SIE FEHLTE UND WARUM DAS SCHLIMMER WAR ALS EINE LÜCKE. Die Optionen beider Programme kamen
 * bis JOB 3867 ausschliesslich aus der Wurzel-`tsconfig.json`, und die führt weder `baseUrl` noch
 * `paths` — sie ist Node-rein und sagt das dort auch. Die Web-App schreibt ihre modulinternen
 * Importe aber über `@/…` (`apps/web/tsconfig.json`, `"@/*": ["src/*"]`). Jeder dieser Importe war
 * für den Prüfer ein unauflösbares Modul, jeder Träger dahinter hatte den Typ `any` — und `any`
 * verwirft `repoTypname` ausdrücklich, weil aus „ich weiss es nicht" keine Beanstandung werden darf.
 * Ergebnis war ein STILLES GRÜN über die ganze Web-Fläche: der Wächter schwieg, WEIL ihm die
 * Auskunft fehlte. Dieselbe Falsch-entwarnung, gegen die der `directoryExists`-Haken unten schon
 * einmal gebaut wurde.
 *
 * DASSELBE ARGUMENT WIE BEI `jsx`/DOM oben, nur eine Zeile später gezogen: die Produktfläche
 * enthält `apps/web/src/**`, also braucht der Prüfer dort die Auskunft, die diese Fläche über sich
 * selbst führt.
 *
 * ABSOLUT VERANKERT, und das ist kein Geschmack: `paths`-Einträge liest TypeScript sonst gegen
 * `baseUrl` bzw. das Verzeichnis ihrer Konfigurationsdatei — beides kennt ein von Hand gebautes
 * Optionsobjekt nicht, und der Prüfer löste dann gegen das falsche Verzeichnis auf. Die Ziele
 * zeigen deshalb fertig auf `WURZEL/apps/web/src/*`.
 *
 * OHNE `baseUrl`, mit Grund: `baseUrl` wirkt auf JEDEN nicht-relativen Importnamen des ganzen
 * Programms — auch auf die von `services/**`. Gefragt ist hier allein die Alias-Regel, also steht
 * nur sie in den Optionen.
 */
function webAliase(): ts.CompilerOptions {
  const wurzelWeb = join(WURZEL, WEB);
  const optionenWeb = gelesen("tsconfig.json", wurzelWeb);
  const muster = optionenWeb.paths;
  if (muster === undefined) {
    return {};
  }
  const anker = optionenWeb.baseUrl ?? wurzelWeb;
  return {
    paths: Object.fromEntries(
      Object.entries(muster).map(([alias, ziele]) => [
        alias,
        ziele.map((ziel) => posix(join(anker, ziel))),
      ]),
    ),
  };
}

/**
 * Die Optionen des Programms — aus `tsconfig.json` gelesen, nicht nachgebaut.
 *
 * VIER ZUSÄTZE, jeder mit Grund:
 *   · `jsx`/DOM-Bibliothek: `tsconfig.json` ist Node-rein (es schliesst `tests/**\/*.tsx` aus und
 *     kennt `apps/` nicht als Einstieg). Die Produktfläche enthält aber `apps/web/src/**.tsx`.
 *
 *     JOB 3895 — HIER STAND EINE BEGRÜNDUNG, DIE NIE JEMAND NACHGEMESSEN HAT, und sie war für das
 *     PRODUKTPROGRAMM FALSCH. Der Satz lautete: „ohne diese beiden Zusätze verlöre der Prüfer dort
 *     jeden Typ und die Erhebung wäre still schwächer."
 *
 *     GEMESSEN, beide Zusätze aus `produktprogramm` herausgenommen, 759 Produktdateien (Lauf
 *     df19a4517685c1ed414c5137): die Deckung bleibt bei 177 von 177 JSX-führenden `.tsx`-Dateien,
 *     der Gegenbeleg auf `ModalBoundaryContext.tsx` bleibt `Element`, und kein Fall der Datei wird
 *     rot. Einzeln geprüft, nur `jsx` heraus (Lauf 7df450dbe79fdf629e9de7b9): ebenfalls unverändert.
 *     NACH DEM REBASE AUF `e82f890` WIEDERHOLT, weil sich mit ihm die PRODUKTFLÄCHE geändert hat
 *     (`AiAssistBox.tsx`, `Menue.tsx`, `BibliothekFlaeche.tsx`) und ein Befund über sie damit neu zu
 *     erheben war (Lauf 26fb6d9dbf614bbaedf56d0a): gleiches Ergebnis, 177 von 177.
 *
 *     Der Grund ist der Sache nach einleuchtend: die Produktdateien holen die React-Typen selbst
 *     herein, und mit ihnen die globale `JSX`-Auskunft — das Programm braucht die Zusage dafür nicht.
 *
 *     JOB 3948 — HIER STAND EINE GRENZE, DIE NIEMAND GEMESSEN HAT, und sie ist jetzt gemessen. Der
 *     Satz lautete: „NICHT gemessen ist, ob andere Typen derselben Dateien ohne die DOM-Bibliothek
 *     zerfallen (`HTMLDivElement` und Verwandte) — deshalb bleiben beide Zusätze stehen, statt auf
 *     eine Messung hin entfernt zu werden, die sie nicht deckt." Er ist ERSETZT, nicht ergänzt.
 *
 *     GEMESSEN (Fall „JOB 3948 · Lieferung 5" in `toter-kandidatenweg.test.ts`, Lauf
 *     a808872853bc46cea48314d86cba5a21): EINE gestellte `.tsx`-Quelle, drei Programme, je zwei
 *     Fragen — der Typ der JSX-Stelle und ein DOM-Typ AUSSERHALB davon:
 *
 *         beide Zusätze   `<section>` → Element   `document.createElement("div")` → HTMLDivElement
 *         ohne DOM-Bibl.  `<section>` → Element   `document.createElement("div")` → any
 *         ohne `jsx`      `<section>` → any       `document.createElement("div")` → HTMLDivElement
 *
 *     Die beiden Zusätze tragen GETRENNTE Dinge, und keiner trägt das des anderen: `jsx` trägt
 *     allein die JSX-Auskunft, die DOM-Bibliothek allein die Typen daneben. Beide bleiben stehen —
 *     jetzt auf eine Messung hin und nicht mehr mangels einer. Die Messung ist gebunden: sie leitet
 *     ihre Zusätze aus `FLAECHEN_ZUSATZ` unten ab, wer dort etwas herausnimmt, rötet sie.
 *
 *     IN DER KALIBRIERUNG unten trägt `jsx` sehr wohl, und DAS ist gemessen und gebunden: die
 *     gestellten Quellen holen keine React-Typen herein, also kommt die JSX-Auskunft dort allein aus
 *     dieser Zusage. Der Fall „JOB 3895 · die JSX-Zusage trägt auch in der Kalibrierung" in
 *     `toter-kandidatenweg.test.ts` hält das fest; nimmt man `jsx` aus `gestelltesProgramm` heraus,
 *     wird er rot und nennt `section:4 → any` statt `Element` (R2, Lauf 330aaa53a578c8e3bd02dda5;
 *     auf der Basis `e82f890` erneut gemessen, Lauf 99983ae74c945e5430ccd25e, gleiches Ergebnis).
 *   · `paths` der Web-Fläche (JOB 3867, s. `webAliase`): aus demselben Grund, eine Ebene tiefer —
 *     ohne sie löst kein `@/…`-Import auf und der Prüfer schweigt dort, statt zu antworten.
 *   · `types: []`: gefragt ist der Typ EINES Empfängers, nicht eine vollständige Typprüfung. Die
 *     globalen Typpakete tragen dazu nichts bei und sind der teuerste Teil des Aufbaus.
 *   · `noEmit`: dieses Programm schreibt nie eine Datei.
 */
function optionen(zusatz: ts.CompilerOptions): ts.CompilerOptions {
  return {
    ...gelesen(GRUNDLAGE, WURZEL),
    noEmit: true,
    types: [],
    ...webAliase(),
    ...zusatz,
  };
}

/**
 * DIE ZWEI ZUSÄTZE DER FLÄCHE, an EINER Stelle — `jsx` und die DOM-Bibliothek.
 *
 * JOB 3948: bis hierher standen sie zeichengleich zweimal da (einmal in `produktprogramm`, einmal in
 * `gestelltesProgramm`). Zwei Stellen für dieselbe Zusage laufen auseinander, und Lieferung 5
 * braucht sie ausserdem als Gegenstand: sie nimmt genau diese Zusätze EINZELN heraus und misst, was
 * dabei zerfällt. Ein zweites Optionsobjekt entsteht dabei nicht — beide Programme und die Messung
 * gehen weiter durch `optionen(…)`.
 */
// `satisfies` statt einer Typangabe, und das ist kein Geschmack: `ts.CompilerOptions` erklärt jedes
// Feld als optional, unter `exactOptionalPropertyTypes` wäre `FLAECHEN_ZUSATZ.jsx` damit
// `JsxEmit | undefined` — und genau diese beiden Felder liest die Messung unten EINZELN heraus.
export const FLAECHEN_ZUSATZ = {
  jsx: ts.JsxEmit.ReactJSX,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  skipLibCheck: true,
} satisfies ts.CompilerOptions;

function umgebungAus(programm: ts.Program, beginn: number): Typumgebung {
  return {
    pruefer: programm.getTypeChecker(),
    quelle: (datei) => programm.getSourceFile(join(WURZEL, datei)),
    aufbauMs: Date.now() - beginn,
  };
}

let produkt: Typumgebung | undefined;

/**
 * Das EINE Programm über die Produktfläche, gehalten über die ganze Datei.
 *
 * Der Zwischenspeicher ist modulweit und absichtlich unabhängig von der übergebenen Dateiliste: die
 * Produktfläche ist innerhalb eines Laufs dieselbe, und ein zweiter Aufbau wäre reine Wartezeit.
 *
 * WAS ES KOSTET — GEMESSEN (JOB 3840, 13.09.2026, derselbe Befehl auf demselben Rechner, 759
 * Produktdateien, Gruppe `tests/live-check-postgres-prefilter` + die zwei `repo-pg-*`-Dateien):
 *
 *     VORHER   `toter-kandidatenweg.test.ts` 1395 ms, davon der Produktflächen-Fall 1337 ms · 46 Fälle
 *     NACHHER  `toter-kandidatenweg.test.ts` 2249 ms, davon der Fall 2130 ms · 49 Fälle
 *              (im Fall: Programmaufbau 1422 ms + Erhebung 703 ms)
 *     Gruppe   2,08 s → 2,97 s
 *
 * Der Preis ist also der AUFBAU, nicht die Frage: die Erhebung selbst wurde schneller (703 statt
 * 1337 ms), weil der Baum jetzt aus dem Programm kommt statt je Datei neu geparst zu werden. Netto
 * kostet die Verschärfung rund 0,85 s im Tor. Zum Vergleich auf der Prüfmaschine der Cloud (andere
 * Leistung, dieselbe Richtung): 1515 ms → 3154 ms, davon Programmaufbau 2274 ms.
 *
 * WAS DIE ALIAS-AUFLÖSUNG DAZU KOSTET — GEMESSEN (JOB 3867, 13.09.2026, dieselbe Befehlszeile,
 * dieselben 759 Produktdateien, alle Läufe auf dem GETEILTEN Arbeitsprüfplatz der Cloud):
 *
 *     VORHER   Datei 2350 ms (Fall 2235 ms; Aufbau 1625 ms + Erhebung 604 ms) · 22 Fälle · Gruppe 3,04 s
 *     NACHHER  Datei 2658 ms (Fall 2517 ms; Aufbau 1807 ms + Erhebung  704 ms) · 25 Fälle · Gruppe 3,35 s
 *
 * Netto +0,31 s auf die Datei und +0,31 s auf die Gruppe — und darin stecken auch die drei neuen
 * Fälle, nicht nur die Auflösung.
 *
 * WAS DIE `.tsx`-MESSUNG DAZU KOSTET — GEMESSEN (JOB 3895, 13.09.2026, dieselbe Befehlszeile,
 * dieselben 759 Produktdateien, alle Läufe auf dem GETEILTEN Arbeitsprüfplatz der Cloud):
 *
 *     VORHER   Datei 5260 ms (Fall 5001 ms; Aufbau 3456 + Erhebung 1534) · 25 Fälle · Gruppe 6,37 s
 *              (Lauf a0c023d40eeb43ffb3f4d6ac83725190, Basisstand ece535ba)
 *     NACHHER  Datei 6130 ms (Fall 5505 ms; Aufbau 3674 + Erhebung 1671 + Deckung 149) · 29 Fälle
 *              · Gruppe 7,29 s (Lauf dfa80d8f5ad8491888c2be9831765749)
 *
 * Dieses Paar allein sagte: +0,87 s auf die Datei, +0,92 s auf die Gruppe. ES SAGT DAS NICHT, und
 * das ist der eigentliche Befund dieser Messung: DER PLATZ STREUT VIEL STÄRKER ALS DER EFFEKT.
 * Derselbe bytegleiche Endstand lief eine halbe Stunde später auf einem freien Platz mit
 *
 *     ENDSTAND  Datei 3145 ms (Aufbau 1969 + Erhebung 715 + Deckung 84) · 29 Fälle · Gruppe 3,85 s
 *               (Lauf 4961738b9a305675bdfa5126)
 *
 * — also SCHNELLER als der VORHER-Lauf mit 6,37 s. Eine Aussage „der Job kostet +0,9 s" wäre aus
 * diesen Zahlen nicht zu belegen; sie stünde nur da, weil zwei Läufe zufällig so gefallen sind.
 *
 * WAS SICH BELEGEN LÄSST, weil es sich selbst misst: die `.tsx`-Deckung — 181 Dateien gefiltert,
 * 177 Bäume bis zur ERSTEN JSX-Stelle durchlaufen, 177 Typfragen — schreibt ihre eigene Zahl in die
 * Ausgabe des Falls. Sie lag in sechs Läufen bei 84, 120, 149, 150, 155, 166 ms. Das ist der Preis
 * dieses Jobs im Tor; er ist um eine Grössenordnung kleiner als die Streuung des Platzes (derselbe
 * Programmaufbau: 1969 bis 4032 ms über dieselben sechs Läufe). Ein Aufschlag durch `jsx` in
 * `gestelltesProgramm` ist NICHT nachweisbar: das gestellte Programm ist klein, und die vier neuen
 * Fälle zusammen laufen in unter einer halben Sekunde.
 *
 * WAS JOB 3948 DAZU KOSTET — GEMESSEN (14.09.2026, dieselbe Befehlszeile über die drei Gruppen
 * `tests/live-check-*`, dieselben 759 Produktdateien, beide Läufe auf dem Arbeitsprüfplatz der Cloud):
 *
 *     VORHER    Datei 5864 ms (Fall 5252 ms; Aufbau 3402 + Erhebung 1677 + Deckung 157) · 29 Fälle
 *               · Gruppe 9,75 s (Lauf 68329376bc114e5a9a56e18ed2798a02)
 *     NACHHER   Datei 8142 ms (Fall 5589 ms; Aufbau 3766 + Erhebung 1647 + Deckung 162) · 32 Fälle
 *               · Gruppe 12,16 s (Lauf a808872853bc46cea48314d86cba5a21)
 *     ENDSTAND  Aufbau 2600 + Erhebung 982 · 32 Fälle · Gruppe 8,87 s
 *               (Lauf d110a15db6ec4543964accb3829809f7)
 *
 * DAS PAAR SAGT WIEDER NICHTS, und diesmal war es vorher bekannt: der bytegleiche ENDSTAND lief auf
 * einem freien Platz in 8,87 s — SCHNELLER als der VORHER-Lauf mit 9,75 s. „+2,4 s" wäre aus diesem
 * Paar nicht zu belegen, genau wie schon bei JOB 3895.
 *
 * WAS SICH BELEGEN LÄSST, weil es sich selbst misst — und was deshalb die einzigen Zahlen sind, auf
 * die sich hier eine Aussage stützt:
 *
 *     Lieferung 5 (drei Programme über EINE gestellte `.tsx`-Quelle)   1459 ms · 1200 ms (zwei Läufe)
 *     Lieferung 6 (der echte Produkttyp zieht `repo.ts`/`service.ts` samt ihrer Abhängigkeiten in
 *       das gestellte Programm; Fall „JOB 3840")                       441 ms → 919 ms (ein Paar)
 *
 * Lieferung 5 kostet damit BELEGT über eine Sekunde im Tor — über der Schwelle, die der Auftrag als
 * meldepflichtig setzt; sie steht als BEFUND in der Rückgabe. Die Zahl zu Lieferung 6 ist EIN Paar
 * und trägt nach dem Massstab dieses Blocks keine Aussage über die Gruppe. Der Preis ist der dafür,
 * dass drei Zusagen dieser Kette nicht mehr behauptet, sondern gemessen sind.
 *
 * DER PLATZ STREUT STÄRKER ALS DER EFFEKT, und auch das ist gemessen statt geschätzt: dieselben 25
 * Fälle liefen im selben Fenster fünfmal, zwischen Datei 2658 ms (Aufbau 1807 ms) und Datei 4026 ms
 * (Aufbau 2738 ms) — OHNE Alias-Auskunft ebenso wie mit. Die schärfste Paarung ist die Rückbauprobe:
 * derselbe Baum, allein die Zeile `...webAliase()` entfernt → Aufbau 1797 ms, Datei 2748 ms; mit ihr
 * Aufbau 1807 ms, Datei 2658 ms. Zehn Millisekunden Unterschied im Aufbau. Ein Aufschlag durch
 * `paths` ist hier NICHT nachweisbar, und der Sache nach ist das erwartbar: `apps/web/src/**` liegt
 * ohnehin vollständig in `rootNames`. Die Auflösung zieht keine Datei zusätzlich ins Programm, sie
 * findet nur die schon vorhandene.
 */
export function produktprogramm(dateien: readonly string[]): Typumgebung {
  if (produkt !== undefined) {
    return produkt;
  }
  const beginn = Date.now();
  const programm = ts.createProgram({
    rootNames: dateien.map((datei) => join(WURZEL, datei)),
    options: optionen(FLAECHEN_ZUSATZ),
  });
  produkt = umgebungAus(programm, beginn);
  return produkt;
}

const gestellte = new WeakMap<ReadonlyMap<string, string>, Typumgebung>();

/**
 * Ein Programm aus GESTELLTEN Quellen — für die Kalibrierung.
 *
 * Die Kalibrierung braucht mehr als eine Datei: der Träger steht in der einen, seine Typauskunft in
 * der anderen. Genau diese Trennung ist der Gegenstand, sie lässt sich also nicht an einer einzelnen
 * gestellten Quelle messen. Die Quellen liegen im Speicher; nur die Standardbibliothek kommt von
 * der Platte (Rückfall auf den echten Übersetzer-Wirt).
 *
 * Auch hier wird je Quellenmenge genau EINMAL gebaut — alle Fälle teilen ein Programm.
 *
 * JOB 3895 — DIE ART DER GESTELLTEN QUELLE KOMMT AUS IHRER ENDUNG. Bis hierher erzeugte der Wirt
 * JEDE gestellte Quelle als `ts.ScriptKind.TS`. Eine gestellte `.tsx`-Quelle wurde damit als `.ts`
 * geparst, ihr JSX war ein Syntaxfehler, und die Kalibrierung konnte für die Web-Fläche — die
 * überwiegend aus `.tsx` besteht — gar keinen Fall stellen. GEMESSEN vor der Reparatur (Lauf
 * 4c1345e7e42ef6c94cffc3ef): `scriptKind=3` (TS), vier Parse-Fehler („'>' expected.", „';'
 * expected.", „',' expected.", „Unterminated regular expression literal."), der Empfänger des
 * `findCandidates`-Aufrufs zerfiel zu einem leeren Ausdruck mit dem Typ `any` — und der Fall war
 * still grün, WEIL die Auskunft fehlte. Dieselbe Falsch-entwarnung wie bei `directoryExists` unten
 * und beim `@/…`-Alias oben.
 *
 * DIE REGEL WIRD ANGEWANDT, NICHT NACHGEBAUT: `quelleAus` (`tools/modalgrenze.ts`) entscheidet
 * bereits an der Endung zwischen `ts.ScriptKind.TSX` und `ts.ScriptKind.TS`. Der Wirt ruft sie,
 * statt eine zweite Endungsregel neben sie zu stellen; `tools/modalgrenze.ts` bleibt unverändert und
 * bekommt nur einen Aufrufer mehr. Mitgekauft ist dabei ihr `ts.ScriptTarget.Latest` und ihr
 * `setParentNodes: true` — letzteres entspricht dem `true` an `createCompilerHost` unten, ersteres
 * ist für die gestellten Quellen ohne Belang, weil die Typprüfung ihr Ziel aus `options` nimmt.
 */
export function gestelltesProgramm(quellen: ReadonlyMap<string, string>): Typumgebung {
  const bekannt = gestellte.get(quellen);
  if (bekannt !== undefined) {
    return bekannt;
  }
  const umgebung = gestelltesProgrammMit(quellen, FLAECHEN_ZUSATZ);
  gestellte.set(quellen, umgebung);
  return umgebung;
}

/**
 * DASSELBE GESTELLTE PROGRAMM, ABER MIT WÄHLBAREM ZUSATZ — JOB 3948, Lieferung 5.
 *
 * `gestelltesProgramm` oben ist der eine gespeicherte Aufrufer mit `FLAECHEN_ZUSATZ`; die Messung
 * der Zusätze ruft dieselbe Vorrichtung mit einem beschnittenen Zusatz. Es gibt damit weiterhin EINEN
 * Wirt, EINE Optionsquelle und EINEN Programmbau — nur die zwei Zusätze sind beweglich, und genau sie
 * sind der Gegenstand der Messung. Kein Zwischenspeicher hier: jede Messung will ein eigenes Programm.
 */
export function gestelltesProgrammMit(
  quellen: ReadonlyMap<string, string>,
  zusatz: ts.CompilerOptions,
): Typumgebung {
  const beginn = Date.now();
  const inhalte = new Map(
    [...quellen].map(([datei, text]) => [posix(join(WURZEL, datei)), text] as const),
  );
  // GEMESSEN UND NICHT VERMUTET: ohne `directoryExists` bleibt der Import ungelöst und der Träger
  // hätte den Typ `any` — der Prüfer probiert in einem Verzeichnis, das es auf der Platte nicht gibt,
  // gar nicht erst (`fileExists` wird dort nie gefragt). Der Fall wäre dann grün geblieben, WEIL die
  // Auskunft fehlt: ein Wächter, der aus „unbekannt" ein „in Ordnung" macht. Deshalb kennt der Wirt
  // die Verzeichnisse der gestellten Quellen samt ihrer Oberverzeichnisse.
  const ordner = new Set<string>();
  for (const datei of inhalte.keys()) {
    for (let ordnerName = posix(dirname(datei)); ordnerName.length > 1; ) {
      ordner.add(ordnerName);
      const oben = posix(dirname(ordnerName));
      if (oben === ordnerName) {
        break;
      }
      ordnerName = oben;
    }
  }
  // JOB 3895: DIESELBE FRAGE WIE DAS PRODUKTPROGRAMM. Ohne `jsx` und die DOM-Bibliothek stellte die
  // Kalibrierung eine ANDERE Frage als `produktprogramm` oben — sie konnte die Zusage dort also
  // grundsätzlich nicht prüfen. Beide Zusätze laufen durch dasselbe `optionen(…)`; eine zweite
  // Optionsquelle entsteht nicht.
  const eigene = optionen(zusatz);
  const basis = ts.createCompilerHost(eigene, true);
  const wirt: ts.CompilerHost = {
    ...basis,
    getSourceFile: (name, stand, aufFehler, neu) => {
      const text = inhalte.get(posix(name));
      return text === undefined
        ? basis.getSourceFile(name, stand, aufFehler, neu)
        : quelleAus(name, text).ast;
    },
    fileExists: (name) => inhalte.has(posix(name)) || basis.fileExists(name),
    readFile: (name) => inhalte.get(posix(name)) ?? basis.readFile(name),
    directoryExists: (name) => ordner.has(posix(name)) || basis.directoryExists?.(name) === true,
  };
  const programm = ts.createProgram({
    rootNames: [...inhalte.keys()],
    options: eigene,
    host: wirt,
  });
  return umgebungAus(programm, beginn);
}
