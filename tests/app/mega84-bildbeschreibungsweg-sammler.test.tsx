// @vitest-environment jsdom
// AUFTRAG-mega84 Block D — DER WÄCHTER FÜR DEN *WEG* ZUR BILDBESCHREIBUNG.
//
// DIE VORGESCHICHTE. Diese Funktion ist zweimal still verschwunden. Beim ersten Mal (mega50) fehlte
// ein optionaler Prop auf zwei von vier Flächen — Formular und Vorschlag waren dort gar nicht da.
// Der Sammler `tests/app/mega50-bildbeschreibung-sammler.test.ts` hütet seither, dass der describe-
// WEG jede Fläche erreicht. Beim zweiten Mal (Pedi, 31.07., 13:20, mit Bildschirmfoto) war alles
// verdrahtet und trotzdem unerreichbar: das Formular öffnete AUSSCHLIESSLICH über den Knopf in der
// Bild-Werkzeugleiste, und den sah man erst, nachdem man das BILD angeklickt hatte. Klickte man
// stattdessen auf die Beschreibung — die Fläche, die der Nutzer ansieht —, tippte man inline.
//
// Das ist eine andere Klasse als mega50, und mega50 kann sie nicht sehen: dort wird geprüft, ob der
// Weg VERDRAHTET ist, nicht ob er BEDIENBAR ist. Beide Male war die Antwort auf Pedis Klick „nichts
// passiert", die Ursachen lagen eine Etage auseinander.
//
// DIE BAUFORM IST DIE VON mega50, ERWEITERT UM EINE STUFE (der Auftrag: „erweitere diese Bauform,
// statt eine zweite anzulegen"):
//   (1) BAUTEILE — jede Quelldatei, die die Bildbeschreibung ANBIETET (sie rendert `CAPTION_AI_TEXT.…`).
//   (2) AUFRUFER — jede Quelldatei, die eines dieser Bauteile im JSX einbindet.
//       Bis hierher wörtlich mega50: die Grundmenge wird ERHOBEN, sie steht nicht als Liste da.
//   (3) NEU: das ANTWORTVERHALTEN. Für das erhobene Bauteil wird gemountet und gefahren, was der
//       Nutzer tut — auf die Beschreibung klicken, mit der Tastatur dorthin, und was dann im
//       Formular steht. Gepinnt wird also nicht, dass ein Name vorkommt, sondern dass die Fläche
//       antwortet.
//
// WARUM EINMAL MOUNTEN FÜR ALLE FLÄCHEN GENÜGT — und wo die Grenze davon liegt: Stufe (1)+(2)
// belegen, dass ALLE erhobenen Flächen ihre Bildbeschreibung durch DASSELBE Bauteil bekommen
// (heute: `RichTextEditor`). Das Verhalten dieses einen Bauteils ist damit das Verhalten jeder
// Fläche. Käme morgen ein ZWEITES Bauteil dazu, wächst die Grundmenge — und dieser Wächter mountet
// es nicht, sondern wird an Stufe (1) rot, weil er dann mehr Bauteile erhebt als er fährt. Das ist
// Absicht: lieber laut unvollständig als still unvollständig.
//
// AUFTRAG-mega85 Block E — DIE ERHEBUNG WAR DATEI-GENAU UND IST JETZT FUND-GENAU.
//
// DER BEFUND (ben, sammel83-mega84, ROT-Punkt 4): Stufe (2) zählte AUFRUFER-DATEIEN und verlangte
// `>= 4` — bei acht tatsächlichen Einbindungen. Verschwand eine von zwei Editor-Instanzen in
// `Capture.tsx`, blieb die Datei ein Aufrufer und der Wächter blieb grün. Die Titelprüfung suchte
// `documentTitle` IRGENDWO IN DER DATEI: ein Vorkommen deckte alle Instanzen darin, und das Wort in
// einer ganz anderen Funktion hätte ebenso genügt. Ein Wächter, der auf Dateiebene zählt, sieht das
// Schrumpfen innerhalb einer Datei nicht — und genau dort ist die Bildbeschwerde zweimal
// verschwunden.
//
// WAS SICH GEÄNDERT HAT:
//   · Ein FUND ist eine einzelne JSX-Einbindung, nicht eine Datei. Heute sind es ACHT in vier
//     Dateien — nachgezählt, nicht gerundet, und die Untergrenze ist an dieser Zahl kalibriert.
//   · Die TRÄGER werden transitiv erhoben: `KnowledgeInputStudio` bietet die Bildbeschreibung nicht
//     selbst an, rendert aber einen `RichTextEditor` und reicht den Titel durch — seine drei
//     Einbindungen tragen den Vertrag also genauso. Datei-genau war das unsichtbar.
//   · Die Titelpaarung wird JE FUND geprüft, und zwar auf der Attributliste GENAU DIESER
//     Einbindung (Klammertiefe wird mitgezählt, damit ein `onChange={(x) => ...}` mit seinem `>`
//     die Grenze des Elements nicht verschiebt).
//
// AUFTRAG-mega86 Block C — DIE ERHEBUNG WAR HEURISTISCH UND IST JETZT AUTORITATIV.
//
// DER BEFUND (ben, sammel84-mega85, GELB): die Grundmenge kam aus Textmustern — exportierte
// Grossbuchstaben-Funktionen, JSX-Namensvorkommen, ein dateiweites `documentTitle:` als transitive
// Abbruchregel. Vier Folgen, alle benannt: Alias, Spread und `createElement` waren blind; ein
// Wrapper mit anders benanntem Prop konnte falsch zugeordnet werden; eine unbeteiligte
// Prop-Deklaration liess eine ganze Datei durch; und `FUNDE.length >= 8` erkannte zwar den heutigen
// Verlust, aber nach Wachstum KOMPENSIERTE ein neuer Fund einen verschwundenen — neun auf acht blieb
// gruen.
//
// WAS SICH GEAENDERT HAT:
//   · Die Erhebung liest den TYPESCRIPT-BAUM, nicht mehr Zeichenfolgen. JSX-Elemente, ihre
//     Attributlisten, ein `{...spread}` und `createElement`-Aufrufe sind dort dasselbe Ding.
//   · Jede Einbindung wird ihrer UMSCHLIESSENDEN Komponente zugeordnet (nicht mehr allen
//     exportierten Funktionen der Datei), und „fuehrt den Titel als eigenen Prop" wird am PARAMETER
//     der Komponente abgelesen (nicht mehr dateiweit).
//   · Jeder Fund hat eine stabile IDENTITAET und genau eine DISPOSITION. Ein verschwundener
//     bekannter Fund wird rot, UNABHAENGIG von der Gesamtzahl; ein neuer Fund ohne Disposition auch.
//     Die Mindestzahlen sind damit weg — sie waren genau die Luecke.
//
// DIE VERBLEIBENDE GRENZE, benannt statt verschwiegen: Alias und Indirektion
// (`const E = RichTextEditor; <E/>`) entgehen der Erhebung weiterhin — dafuer braeuchte es den
// Typpruefer, nicht nur den Syntaxbaum. Der letzte Fall der Stufe 1+2 BELEGT diese Grenze, statt sie
// nur zu behaupten. Zwei Dinge entschaerfen sie: der Titel ist seit mega85 ein PFLICHT-Parameter, ein
// Alias ohne ihn compiliert also gar nicht erst (`tests/capture/mega85-titelvertrag-mounted.test.tsx`),
// und ein Editor ohne Provider wirft zur Laufzeit
// (`tests/capture/bildbeschreibung-pflichtvertrag-mounted.test.tsx`).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── Stufe 1 + 2: die Grundmenge AUTORITATIV erheben (TypeScript-Baum) ───────────────────────────

const WURZEL = process.cwd();
const WEB_SRC = join("apps", "web", "src");

function istQuelldatei(pfad: string): boolean {
  if (!pfad.endsWith(".ts") && !pfad.endsWith(".tsx")) {
    return false;
  }
  return !pfad.endsWith(".test.ts") && !pfad.endsWith(".test.tsx");
}

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (istQuelldatei(relativ)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

function posix(pfad: string): string {
  return pfad.split(sep).join("/");
}

// Eine einzelne Einbindung — JSX oder `createElement`. Der Textansatz sah `createElement` gar nicht;
// hier ist es dieselbe Erhebung, weil es im Baum dieselbe Sache ist.
interface Einbindung {
  datei: string;
  komponente: string;
  // JOB 2080 D1: der Deklarationsort der eingebundenen Komponente. `null`, wenn nicht auflösbar.
  kennung: string | null;
  // Dasselbe für die Hülle — Stufe 2 vergleicht darüber statt über den Namen.
  huelleKennung: string | null;
  // Die exportierte Komponente, IN DEREN Rumpf die Einbindung steht. Der Textansatz kannte das
  // nicht und ordnete jede Einbindung allen exportierten Funktionen der Datei zu.
  huelle: string | null;
  attribute: string[];
  spread: boolean;
  ahnen: string;
  zeile: number;
}

interface Bauteilkandidat {
  name: string;
  // JOB 2080 D1: der Deklarationsort dieser Komponente — ihre Identität über Dateigrenzen hinweg.
  kennung: string | null;
  eigenerTitel: boolean;
  bietetAn: boolean;
}

interface Quelle {
  datei: string;
  roh: string;
  einbindungen: Einbindung[];
  komponenten: Bauteilkandidat[];
}

function tagName(n: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
  return n.tagName.getText(n.getSourceFile());
}

const ANGEBOT_MUSTER = /CAPTION_AI_TEXT\s*\./;
const AUSNAHME_MUSTER = /KEINE-BILDBESCHREIBUNG:/;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AUFTRAG-JOB-2080 D1 (I44, drittens · STUFE 1) — DIE ERHEBUNG STEHT AUF EINEM PROGRAMM.
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// DER BEFUND (ben, sammel85, `OFFEN.md:384` = I44, drittens): „JSX-Memberzugriffe und lokale
// Aliase treffen den einfachen Trägernamen nicht … Belastbar wird es erst über Symbolauflösung im
// TypeChecker oder über stabile Flächen-Kennungen."
//
// DIE ENTSCHEIDUNG (`00_CONTROL/ENTSCHEIDUNGEN/JOB-2062-I44-SAMMLERGRUNDLAGE.md`): Weg A, in zwei
// Stufen. STUFE 1 ist NUR dieser Sammler; `mega47`, `mega88` und `mega89` folgen einzeln und nur,
// wenn Stufe 1 trägt.
//
// WAS SICH ÄNDERT: Bis hierher verglich die Erhebung NAMEN. Zwei gleichnamige Komponenten in zwei
// Dateien waren ununterscheidbar, `<Foo.Bar />` traf den Trägernamen nie, und `const E = Editor`
// war eine benannte Grenze. Jetzt trägt jede Komponente und jede Einbindung eine KENNUNG — den
// Ort ihrer Deklaration, aufgelöst über `checker.getSymbolAtLocation` samt Alias-Auflösung. Der
// Vergleich in Stufe 2 läuft über die Kennung; der NAME bleibt erhalten, weil er in Meldungen und
// Fundidentitäten lesbar sein muss.
//
// DIE INVARIANZ-AUFLAGE, wörtlich aus der Entscheidung: `246 Komponenten · 1 Anbieter · 2 Träger`
// vorher wie nachher. Sie steht unten als eigener Fall (`STUFE-1-INVARIANZ`) und ist damit nicht
// bloß eine Zusage in dieser Rückgabe, sondern eine Zusicherung im Tor.
const COMPILER_OPTIONEN: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  skipLibCheck: true,
  allowImportingTsExtensions: true,
  baseUrl: join(WURZEL, "apps", "web"),
  paths: { "@/*": ["src/*"] },
};

const WEB_DATEIEN: string[] = quelldateien(WEB_SRC).map(posix);
const PROGRAMM = ts.createProgram(
  WEB_DATEIEN.map((d) => join(WURZEL, d)),
  COMPILER_OPTIONEN,
);
const CHECKER = PROGRAMM.getTypeChecker();

function lies(datei: string): Quelle {
  const baum = PROGRAMM.getSourceFile(join(WURZEL, datei));
  if (!baum) {
    throw new Error(
      `${datei} liegt nicht im Programm — die Grundmenge und das Programm sind auseinandergelaufen.`,
    );
  }
  return erhebe(datei, baum, CHECKER);
}

// Dieselbe Erhebung über eine Quelle IM SPEICHER — damit die Sonden unten die Erhebung wirklich
// fahren können, statt ihr Verhalten zu behaupten.
//
// JOB 2080 D1: auch die Sonde bekommt jetzt ein Programm, sonst hätte sie keinen Checker und damit
// keine Kennung — sie würde eine andere Erhebung fahren als der echte Baum. Es ist ein
// EIN-DATEI-Programm: die Sonde soll lokale Deklarationen auflösen, nicht den halben Quellbaum
// laden. Genau EINE Erhebung mit zwei Quellen, kein zweiter Weg.
function liesQuelle(datei: string, roh: string): Quelle {
  const host = ts.createCompilerHost(COMPILER_OPTIONEN, true);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, ziel, beiFehler, erneut) =>
    name === datei
      ? ts.createSourceFile(name, roh, ziel, true, ts.ScriptKind.TSX)
      : originalGetSourceFile(name, ziel, beiFehler, erneut);
  const originalFileExists = host.fileExists.bind(host);
  host.fileExists = (name) => name === datei || originalFileExists(name);
  const originalReadFile = host.readFile.bind(host);
  host.readFile = (name) => (name === datei ? roh : originalReadFile(name));

  const programm = ts.createProgram([datei], COMPILER_OPTIONEN, host);
  const baum = programm.getSourceFile(datei);
  if (!baum) {
    throw new Error(`Sondenquelle ${datei} konnte nicht geparst werden.`);
  }
  return erhebe(datei, baum, programm.getTypeChecker());
}

// Die KENNUNG einer Komponente: der Ort ihrer DEKLARATION, `datei:zeile`. Ein Alias und ein
// JSX-Memberzugriff laufen darauf zusammen, weil beide dasselbe Symbol meinen — das ist der ganze
// Gewinn dieser Umstellung. Ist ein Symbol nicht auflösbar (in einer Sonde ohne Importe der
// Normalfall), bleibt die Kennung `null`; Stufe 2 fällt dann auf den Namen zurück, statt die
// Einbindung STILL zu verlieren. Ein Rückfall, der gemeldet wird, ist etwas anderes als eine Lücke.
function kennungVon(knoten: ts.Node, checker: ts.TypeChecker): string | null {
  let symbol = checker.getSymbolAtLocation(knoten);
  if (!symbol) {
    return null;
  }
  // GEMESSEN, nicht angenommen — und meine erste Fassung war zu kurz: `getAliasedSymbol` allein
  // löst NUR Import-Aliase. Für `const E = Editor` blieb sie an der `VariableDeclaration` stehen,
  // für `<Umschlag.Editor />` am `ShorthandPropertyAssignment`. Beide Formen sind aber genau das,
  // was I44 drittens nennt. Deshalb werden hier drei Sprünge gefahren, bis kein weiterer greift:
  //   Import-Alias · Kurzschreibweise im Objektliteral · Zuweisung eines blossen Bezeichners.
  // Die Schleife ist gedeckelt: eine zyklische Zuweisung darf den Sammler nicht aufhängen.
  for (let sprung = 0; sprung < 5; sprung += 1) {
    if (symbol.flags & ts.SymbolFlags.Alias) {
      try {
        const aufgeloest = checker.getAliasedSymbol(symbol);
        if (aufgeloest && aufgeloest !== symbol) {
          symbol = aufgeloest;
          continue;
        }
      } catch {
        // Kein auflösbarer Alias — dann gilt das bisherige Symbol.
      }
    }
    const erste = symbol.declarations?.[0];
    if (erste && ts.isShorthandPropertyAssignment(erste)) {
      const ziel = checker.getShorthandAssignmentValueSymbol(erste);
      if (ziel && ziel !== symbol) {
        symbol = ziel;
        continue;
      }
    }
    if (erste && ts.isVariableDeclaration(erste) && erste.initializer) {
      // NUR ein blosser Bezeichner. `const A = memo(B)` ist eine andere Komponente als `B`, und
      // sie hier gleichzusetzen wäre eine Behauptung über Laufzeitverhalten, die der Sammler
      // nicht belegen kann.
      if (ts.isIdentifier(erste.initializer)) {
        const ziel = checker.getSymbolAtLocation(erste.initializer);
        if (ziel && ziel !== symbol) {
          symbol = ziel;
          continue;
        }
      }
    }
    break;
  }
  const deklaration = symbol.declarations?.[0];
  if (!deklaration) {
    return null;
  }
  const quelle = deklaration.getSourceFile();
  const zeile = quelle.getLineAndCharacterOfPosition(deklaration.getStart(quelle)).line + 1;
  return `${posix(quelle.fileName.replace(`${WURZEL}${sep}`, ""))}:${zeile}`;
}

function erhebe(datei: string, baum: ts.SourceFile, checker: ts.TypeChecker): Quelle {
  const roh = baum.getFullText();
  const einbindungen: Einbindung[] = [];
  const komponenten: Bauteilkandidat[] = [];

  const huelleVon = (knoten: ts.Node): { name: string; kennung: string | null } | null => {
    let p: ts.Node | undefined = knoten.parent;
    while (p) {
      if (ts.isFunctionDeclaration(p) && p.name && /^[A-Z]/.test(p.name.text)) {
        return { name: p.name.text, kennung: kennungVon(p.name, checker) };
      }
      if (
        (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
        p.parent &&
        ts.isVariableDeclaration(p.parent) &&
        ts.isIdentifier(p.parent.name) &&
        /^[A-Z]/.test(p.parent.name.text)
      ) {
        return { name: p.parent.name.text, kennung: kennungVon(p.parent.name, checker) };
      }
      p = p.parent;
    }
    return null;
  };

  // Die JSX-Nachbarschaft, in der die Einbindung steht. Sie gehört zur IDENTITÄT (siehe unten):
  // zwei Einbindungen derselben Komponente mit derselben Prop-Liste in derselben Datei wären sonst
  // ununterscheidbar — und genau darüber könnte ein Austausch unbemerkt bleiben.
  const ahnenVon = (knoten: ts.Node): string => {
    const kette: string[] = [];
    let p: ts.Node | undefined = knoten.parent;
    while (p) {
      if (ts.isJsxElement(p)) {
        kette.push(tagName(p.openingElement));
      }
      p = p.parent;
    }
    return kette.slice(0, 4).join("<");
  };

  const zeileVon = (knoten: ts.Node): number =>
    baum.getLineAndCharacterOfPosition(knoten.getStart(baum)).line + 1;

  // „Führt den Titel als EIGENEN Prop" — am Parameter der Komponente abgelesen, nicht an einer
  // Zeichenfolge irgendwo in der Datei. Das war bens Blindstelle „DURCHREICH_MUSTER prüft dateiweit".
  //
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // AUFTRAG-JOB-2062 D4 (I44, erstens — zweite Haelfte) — DREI SCHREIBWEISEN STATT EINER.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // DER BEFUND (ben, sammel85, `OFFEN.md:384`): „`eigenerTitel` erkennt nur einen direkt
  // destrukturierten Parameter, sodass `function Wrapper(props: Props)` oder
  // `{ documentTitle: titel }` die transitive Hülle stoppt."
  //
  // WAS DAS HEISST: Beide Formen führen den Titel als eigenen Prop — nur anders geschrieben. Wurde
  // die Hülle hier fälschlich beendet, endete die transitive Kette in Stufe 2 EINEN Schritt zu
  // früh: der Träger darüber fiel aus der Menge, und mit ihm alle Einbindungen in seinem Rumpf.
  // Kein Fund, kein Rot — die Kette hörte einfach auf.
  //
  // DIE UMBENANNTE DESTRUKTURIERUNG IST DER HEIKLERE DER BEIDEN, weil sie fast richtig aussieht:
  //   { documentTitle }          -> e.name = documentTitle · e.propertyName = undefined
  //   { documentTitle: titel }   -> e.name = titel         · e.propertyName = documentTitle
  // Wer nur `e.name` liest, sieht im zweiten Fall den ZIELnamen der Umbenennung und nicht den
  // Prop. Der Prop steht in `propertyName`, und nur wenn umbenannt wurde.
  //
  // GEMESSEN AM 23.08.2026 über alle 399 Quelldateien in `apps/web/src`, alte gegen neue Fassung:
  //   Träger mit eigenem documentTitle — vorher 2 · nachher 2 · neu erkannt 0 · verloren 0
  // AUCH DIESE HÄRTUNG BEHEBT HEUTE KEINEN FALL. Sie ist Vorsorge, wie D3 — und sie steht hier,
  // weil die Kette sonst an der nächsten neuen Fläche still abbricht statt zu melden.
  const TITEL_PROP = "documentTitle";
  // Der Typ ist enger als `SignatureDeclarationBase`, weil Fall (3) den RUMPF braucht — und den
  // hat nur eine Funktion mit Körper. Genau die drei Formen kommen aus `alsKomponente`.
  const eigenerTitel = (fn: Komponentenknoten): boolean => {
    const erster = fn.parameters[0];
    if (!erster) {
      return false;
    }
    // (1) und (2): `{ documentTitle }` und `{ documentTitle: titel }`
    if (ts.isObjectBindingPattern(erster.name)) {
      return erster.name.elements.some((e) => {
        const quelle = e.propertyName ?? e.name;
        return ts.isIdentifier(quelle) && quelle.text === TITEL_PROP;
      });
    }
    // (3): `function Wrapper(props: Props)` — der Titel wird über das Objekt gelesen. Erhoben wird
    // das am BAUM, nicht an einer Zeichenfolge: entweder `props.documentTitle` irgendwo im Rumpf
    // oder eine Destrukturierung `const { documentTitle } = props`. An den Parameternamen gebunden,
    // damit ein gleichnamiger Zugriff auf ein FREMDES Objekt nicht mitzählt.
    if (ts.isIdentifier(erster.name) && fn.body) {
      const param = erster.name.text;
      let gefunden = false;
      const tief = (n: ts.Node): void => {
        if (
          ts.isPropertyAccessExpression(n) &&
          ts.isIdentifier(n.expression) &&
          n.expression.text === param &&
          n.name.text === TITEL_PROP
        ) {
          gefunden = true;
        }
        if (
          ts.isVariableDeclaration(n) &&
          ts.isObjectBindingPattern(n.name) &&
          n.initializer &&
          ts.isIdentifier(n.initializer) &&
          n.initializer.text === param
        ) {
          for (const el of n.name.elements) {
            const quelle = el.propertyName ?? el.name;
            if (ts.isIdentifier(quelle) && quelle.text === TITEL_PROP) {
              gefunden = true;
            }
          }
        }
        ts.forEachChild(n, tief);
      };
      tief(fn.body);
      return gefunden;
    }
    return false;
  };

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // AUFTRAG-JOB-2062 D3 (I44, erstens) — DIE GRUNDMENGE KENNT JETZT BEIDE SCHREIBWEISEN.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // DER BEFUND (ben, sammel85, `OFFEN.md:384` = I44, erstens): Die Erhebung nahm nur
  // `FunctionDeclaration`-Knoten auf — „ein Anbieter als `export const Editor = () => …` bleibt
  // außerhalb der Grundmenge". Er wäre weder als Bauteil (Stufe 1) noch als Träger (Stufe 2)
  // sichtbar gewesen: kein Fund, kein Rot, keine Meldung. Eine Erhebung, die den Anbieter nicht
  // kennt, kann über ihn auch nichts Falsches sagen — sie sagt gar nichts, und das ist schlimmer.
  //
  // DIE ASYMMETRIE WAR IM CODE SICHTBAR: `huelleVon` oben erkennt genau diese Form seit jeher
  // (`isArrowFunction`/`isFunctionExpression` an einer `VariableDeclaration`), die
  // Komponentenerhebung nicht. Zwei Stellen, dieselbe Frage, zwei verschiedene Antworten.
  //
  // GEMESSEN AM 23.08.2026 ÜBER ALLE 399 QUELLDATEIEN in `apps/web/src`, damit niemand mehr
  // Wirkung annimmt, als da ist:
  //   246 Komponenten als `function Name()`   ·   0 als `const Name = () => …`
  //   0 anonyme default-exportierte Funktionen · 0 Anbieter außerhalb der Grundmenge
  // DIESE HÄRTUNG BEHEBT HEUTE ALSO KEINEN EINZIGEN FALL. Sie ist ausdrücklich VORSORGE, und
  // genau dafür steht bens Bedingung an I44: „solange vor der Umsetzung keine neue
  // Bildbeschreibungsfläche hinzukommt". Käme sie in der heute im React-Umfeld üblichsten Form,
  // hätte die Erhebung sie nicht gesehen.
  type Komponentenknoten = ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
  // JOB 2080 D1: `id` ist der NAMENSKNOTEN — an ihm hängt das Symbol und damit die Kennung.
  const alsKomponente = (
    knoten: ts.Node,
  ): { name: string; fn: Komponentenknoten; id: ts.Identifier } | null => {
    if (ts.isFunctionDeclaration(knoten) && knoten.name && /^[A-Z]/.test(knoten.name.text)) {
      return { name: knoten.name.text, fn: knoten, id: knoten.name };
    }
    if (
      ts.isVariableDeclaration(knoten) &&
      ts.isIdentifier(knoten.name) &&
      /^[A-Z]/.test(knoten.name.text) &&
      knoten.initializer &&
      (ts.isArrowFunction(knoten.initializer) || ts.isFunctionExpression(knoten.initializer))
    ) {
      return { name: knoten.name.text, fn: knoten.initializer, id: knoten.name };
    }
    return null;
  };

  const besuche = (knoten: ts.Node): void => {
    if (ts.isJsxOpeningElement(knoten) || ts.isJsxSelfClosingElement(knoten)) {
      const name = tagName(knoten);
      if (/^[A-Z]/.test(name)) {
        // JOB 2080 D1: Bei `<Foo.Bar />` meint der RECHTE Teil die Komponente — der Checker löst
        // ihn auf, der Text `"Foo.Bar"` konnte den Trägernamen nie treffen. Das war I44, drittens.
        const ziel = ts.isPropertyAccessExpression(knoten.tagName)
          ? knoten.tagName.name
          : knoten.tagName;
        const huelle = huelleVon(knoten);
        einbindungen.push({
          datei,
          komponente: name,
          kennung: kennungVon(ziel, checker),
          huelle: huelle?.name ?? null,
          huelleKennung: huelle?.kennung ?? null,
          attribute: knoten.attributes.properties
            .filter(ts.isJsxAttribute)
            .map((a) => a.name.getText(baum)),
          spread: knoten.attributes.properties.some(ts.isJsxSpreadAttribute),
          ahnen: ahnenVon(knoten),
          zeile: zeileVon(knoten),
        });
      }
    } else if (
      ts.isCallExpression(knoten) &&
      ts.isIdentifier(knoten.expression) &&
      knoten.expression.text === "createElement" &&
      knoten.arguments[0] &&
      ts.isIdentifier(knoten.arguments[0] as ts.Node) &&
      /^[A-Z]/.test((knoten.arguments[0] as ts.Identifier).text)
    ) {
      const props = knoten.arguments[1];
      const felder =
        props && ts.isObjectLiteralExpression(props)
          ? props.properties
              .filter((p) => ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))
              .map((p) => p.name?.getText(baum) ?? "")
          : [];
      const huelleCe = huelleVon(knoten);
      einbindungen.push({
        datei,
        komponente: (knoten.arguments[0] as ts.Identifier).text,
        kennung: kennungVon(knoten.arguments[0] as ts.Identifier, checker),
        huelle: huelleCe?.name ?? null,
        huelleKennung: huelleCe?.kennung ?? null,
        attribute: felder,
        spread:
          !!props &&
          ts.isObjectLiteralExpression(props) &&
          props.properties.some(ts.isSpreadAssignment),
        ahnen: "createElement",
        zeile: zeileVon(knoten),
      });
    }
    const kandidat = alsKomponente(knoten);
    if (kandidat) {
      komponenten.push({
        name: kandidat.name,
        kennung: kennungVon(kandidat.id, checker),
        eigenerTitel: eigenerTitel(kandidat.fn),
        // Bei `const Name = () => …` ist der Rumpf der INITIALIZER, nicht die Deklaration — sonst
        // zählte bei `const A = () => …, B = …` fremder Text zum Angebot.
        bietetAn: ANGEBOT_MUSTER.test(kandidat.fn.getText(baum)),
      });
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(baum);
  return { datei, roh, einbindungen, komponenten };
}

const ALLE_QUELLEN: Quelle[] = quelldateien(WEB_SRC).map((d) => lies(posix(d)));

const TEXT_MODUL = "apps/web/src/lib/captionAiSuggest.ts";
const WEG_MODUL = "apps/web/src/app/ImageDescribeContext.tsx";

// Stufe (1): die ANBIETER — Komponenten, die die Bildbeschreibung selbst rendern. Ihr VERHALTEN
// wird unten gefahren (Stufe 3). Geprüft wird jetzt der Rumpf DER KOMPONENTE, nicht die Datei.
const BAUTEILE: { datei: string; komponente: string; kennung: string | null }[] =
  ALLE_QUELLEN.filter((f) => f.datei !== TEXT_MODUL && f.datei !== WEG_MODUL).flatMap((f) =>
    f.komponenten
      .filter((k) => k.bietetAn)
      .map((k) => ({ datei: f.datei, komponente: k.name, kennung: k.kennung })),
  );

// Stufe (2): die TRÄGER — transitive Hülle mit derselben Abbruchregel wie bisher („durchreichen
// oder besitzen"), aber am PARAMETER der Komponente abgelesen statt an einem Textmuster über die
// ganze Datei. Eine unbeteiligte Prop-Deklaration lässt jetzt keine Datei mehr durch, und ein
// Wrapper mit anders benanntem Prop wird nicht mehr falsch zugeordnet.
//
// JOB 2080 D1 · STUFE 1 DER SAMMLERGRUNDLAGE: Die Runde vergleicht jetzt KENNUNGEN, nicht Namen.
// Der Unterschied ist keine Feinheit — er entscheidet über drei Dinge, die vorher nicht gingen:
//   · `<Foo.Bar />` trifft den Träger, weil der Checker den rechten Teil auflöst.
//   · `const E = Editor; <E />` trifft ihn, weil der Alias auf dieselbe Deklaration zeigt.
//   · Zwei gleichnamige Komponenten in zwei Dateien sind nicht mehr dieselbe.
// Wo eine Kennung fehlt (Sondenquellen ohne Importe), fällt der Vergleich auf den Namen zurück —
// das ist der bisherige Weg und keine Verschlechterung, nur eben keine Verbesserung.
const schluessel = (name: string | null, kennung: string | null): string | null => kennung ?? name;

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AUFTRAG-JOB-2083 D1 — DIE INVARIANZ WIRD GERECHNET, NICHT FESTGESCHRIEBEN.
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// In JOB 2080 D1 stand die Auflage als DREI ZAHLEN im Test: `toEqual({ komponenten: 246,
// anbieter: 1, traeger: 2 })`. Das war mein eigener Konstruktionsfehler, und ich habe ihn in
// 2080 D2 §2.4 selbst gemeldet: **eine feste Zahl prüft einen Zeitpunkt, keine Invarianz.**
// Kommt eine Komponente hinzu, wird der Fall rot, ohne dass an der Grundlage etwas falsch wäre —
// und dann steht genau die Versuchung im Raum, vor der bens Auflage warnt: „Die Sollzahlen dürfen
// nicht passend gemacht werden."
//
// DESHALB RECHNET STUFE 2 JETZT IN BEIDEN WÄHRUNGEN. `stufe2` bekommt den Vergleichsschlüssel als
// Parameter: über NAMEN (der Weg vor der Umstellung) oder über KENNUNGEN (der Weg danach). Der
// Produktivpfad benutzt die Kennungen; der Invarianzfall unten fährt beide über denselben Baum und
// verlangt Gleichheit. **Dieser Vergleich wächst mit dem Quellbaum mit und lässt sich durch keine
// angepasste Zahl grün machen** — er kann nur grün sein, wenn die Umstellung wirklich nichts
// verschiebt.
type Waehrung = "name" | "kennung";
const nach = (w: Waehrung, name: string | null, kennung: string | null): string | null =>
  w === "kennung" ? schluessel(name, kennung) : name;

function stufe2(w: Waehrung): { traeger: string[]; namen: string[]; funde: string[] } {
  const menge = new Set(
    BAUTEILE.map((b) => nach(w, b.komponente, b.kennung)).filter((s): s is string => !!s),
  );
  for (let runde = 0; runde < 5; runde += 1) {
    let neu = 0;
    for (const f of ALLE_QUELLEN) {
      for (const e of f.einbindungen) {
        const eingebunden = nach(w, e.komponente, e.kennung);
        const huelle = nach(w, e.huelle, e.huelleKennung);
        if (!eingebunden || !menge.has(eingebunden) || !huelle || menge.has(huelle)) {
          continue;
        }
        if (f.komponenten.find((k) => nach(w, k.name, k.kennung) === huelle)?.eigenerTitel) {
          menge.add(huelle);
          neu += 1;
        }
      }
    }
    if (neu === 0) {
      break;
    }
  }
  // Die Fundliste in DERSELBEN Währung — sonst verglichen wir Träger in der einen und Funde in
  // der anderen, und der Vergleich unten wäre wertlos.
  const funde: string[] = [];
  for (const f of ALLE_QUELLEN) {
    for (const e of f.einbindungen) {
      const eingebunden = nach(w, e.komponente, e.kennung);
      const huelle = nach(w, e.huelle, e.huelleKennung);
      if (!eingebunden || !menge.has(eingebunden) || (huelle && huelle === eingebunden)) {
        continue;
      }
      const signatur = [...e.attribute].sort().join("+") + (e.spread ? "+{…spread}" : "");
      funde.push(
        `${e.datei} › ${e.huelle ?? "(modulweit)"} › <${e.komponente}> [${signatur}] in [${e.ahnen}]`,
      );
    }
  }
  // ════════════════════════════════════════════════════════════════════════════════════════════
  // AUFTRAG-JOB-2087 D1 — DIE TRÄGER WERDEN AUCH UNTER IHREM NAMEN AUSGEWIESEN.
  // ════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Der eine rote Test aus JOB 2080/2083 stand genau hier — und er war mein Fehler, nicht der der
  // Umstellung: Mit dem Wechsel auf Kennungen enthält `TRAEGER` seit JOB 2080 D1 Einträge der Form
  // `apps/web/src/components/KnowledgeInputStudio.tsx:48` statt `KnowledgeInputStudio`. Zwei
  // Zusicherungen weiter unten lesen aber weiterhin NAMEN:
  //
  //   `expect(TRAEGER).toContain("KnowledgeInputStudio")`   -> wurde ROT
  //   `expect(TRAEGER).not.toContain("AppRoutes")`          -> blieb grün und war STILL WERTLOS
  //
  // Die zweite ist der unangenehmere Teil des Befundes: Eine Zusicherung, die nach dem Umbau nichts
  // mehr prüfen kann, faellt nicht auf. Sie haette weiter „grün" gemeldet, waehrend die Grenze, die
  // sie bewacht, unbewacht war.
  //
  // DESHALB LIEFERT `stufe2` BEIDE SICHTEN AUF DIESELBE MENGE: `traeger` sind die Schlüssel für den
  // internen Vergleich, `namen` dieselben Träger unter ihrem lesbaren Namen. Die Zusicherungen
  // lesen `namen` und sind damit wieder scharf — auch die zweite.
  const namen = [...menge]
    .map((schl) => {
      for (const f of ALLE_QUELLEN) {
        const treffer = f.komponenten.find((k) => nach(w, k.name, k.kennung) === schl);
        if (treffer) {
          return treffer.name;
        }
      }
      return null;
    })
    .filter((n): n is string => !!n);

  return { traeger: [...menge], namen, funde };
}

const STUFE2 = stufe2("kennung");
const TRAEGER: string[] = STUFE2.traeger;
// JOB 2087 D1: dieselbe Menge, unter dem lesbaren Namen — für Zusicherungen, die einen Namen
// nennen wollen. Sie ist eine ANSICHT, keine zweite Erhebung: beide kommen aus demselben Lauf.
const TRAEGER_NAMEN: string[] = STUFE2.namen;

interface Fund extends Einbindung {
  signatur: string;
  ordnung: number;
}

const FUNDE: Fund[] = (() => {
  const zaehler = new Map<string, number>();
  const out: Fund[] = [];
  for (const f of ALLE_QUELLEN) {
    for (const e of f.einbindungen) {
      // Die Komponente in ihrer eigenen Definition zu erwähnen ist keine Einbindung von außen.
      // JOB 2080 D1: beide Prüfungen laufen über die Kennung — sonst gälte eine gleichnamige
      // Komponente aus einer anderen Datei als Selbsterwähnung und fiele still heraus.
      const eingebunden = schluessel(e.komponente, e.kennung);
      const huelle = schluessel(e.huelle, e.huelleKennung);
      if (!eingebunden || !TRAEGER.includes(eingebunden) || (huelle && huelle === eingebunden)) {
        continue;
      }
      const signatur = [...e.attribute].sort().join("+") + (e.spread ? "+{…spread}" : "");
      const basis = `${e.datei} › ${e.huelle ?? "(modulweit)"} › <${e.komponente}> [${signatur}] in [${e.ahnen}]`;
      const ordnung = (zaehler.get(basis) ?? 0) + 1;
      zaehler.set(basis, ordnung);
      out.push({ ...e, signatur, ordnung });
    }
  }
  return out;
})();

// ── AUFTRAG-mega86 Block C: STABILE FUNDIDENTITÄT UND GENAU EINE DISPOSITION ────────────────────
//
// DER BEFUND (ben, sammel84-mega85, GELB): `FUNDE.length >= 8` erkennt den heutigen Verlust, aber
// nach Wachstum KOMPENSIERT ein neuer Fund einen verschwundenen — neun auf acht bleibt grün. Eine
// Mindestzahl ist kein fail-closed je Instanz.
//
// Deshalb hat jetzt jeder Fund eine IDENTITÄT und genau eine DISPOSITION. Verschwindet ein bekannter
// Fund, wird das rot — UNABHÄNGIG von der Gesamtzahl. Taucht ein Fund ohne Disposition auf, ebenso.
//
// Die Identität ist absichtlich beschreibend statt kurz: Datei, umschließende Komponente, eingebundene
// Komponente, Prop-Liste und JSX-Nachbarschaft. Sie enthält KEINE Zeilennummer und keine
// Zeichenposition — die wandern bei jeder Bearbeitung und wären damit keine Identität, sondern
// Rauschen.
//
// DER PREIS, benannt: wer eine Einbindung umhängt (andere Nachbarschaft) oder ihr einen Prop gibt,
// ändert ihre Identität und wird hier rot. Das ist gewollt — es ist eine Nachfrage, keine Anklage,
// und die Antwort ist eine Zeile in dieser Tabelle. Lieber laut fragen als still danebenliegen.
const DISPOSITIONEN: Record<string, string> = {
  "apps/web/src/components/KnowledgeInputStudio.tsx › KnowledgeInputStudio › <RichTextEditor> [aiPanel+documentTitle+files+images+onAttachFiles+onChange+value] in [div<section<div<div] #1":
    "Das Studio rendert den Editor selbst und reicht den Titel des Beitrags durch — die Quelle, aus der die drei Studio-Einbindungen ihren Vertrag beziehen.",
  "apps/web/src/pages/Capture.tsx › Capture › <KnowledgeInputStudio> [attachments+bodyHtml+documentTitle+enrichLocale+externalStage+images+onApply+onAttachFiles+onClose+open+runAssist] in [Field<div<ReasonerDraft<div] #1":
    "Erfassung, Studio-Weg im Reasoner-Entwurf: traegt die Bildbeschreibung ueber das Studio.",
  // AUFTRAG-PRO-337: Signatur um `captionFormRequest` erweitert. Diese Fläche band ihre
  // Bildergalerie ohne `onEditCaption` ein — der Galerieeinstieg fiel dort lautlos aus (der Prop ist
  // optional). Die Identität hat sich damit geändert, und genau das hat dieser Sammler gemeldet:
  // die Zeile ist ANGEPASST, nachdem hingesehen wurde — das Muster bleibt unverbogen.
  // 26.08.2026, JOB 2419 D1 (TV1, letzte Luecke): beide Signaturen tragen jetzt zusaetzlich
  // `onTitelVorschlag`. Die Flaechen sind dieselben geblieben; sie bekommen den Weg, einen aus der
  // Bildbeschreibung abgeleiteten Titelvorschlag in ihr eigenes Entwurfs-Titelfeld zu uebernehmen —
  // auf Klick, nie von selbst. Der Sammler hat beide alten Identitaeten als verschwunden UND beide
  // neuen als undisponiert gemeldet, WEIL er das soll. Hier ist hingesehen worden.
  "apps/web/src/pages/Capture.tsx › Capture › <RichTextEditor> [captionFormRequest+documentTitle+images+onAttachFiles+onChange+onTitelVorschlag+value] in [Field<div<ReasonerDraft<div] #1":
    "Erfassung, direkter Editor im Reasoner-Entwurf. Seit PRO 337 nimmt er die Bitte der Bildergalerie derselben Flaeche entgegen; seit JOB 2419 D1 fuehrt er den Uebernahme-Weg fuer den Titelvorschlag.",
  // AUFTRAG-PRO-337: dieselbe Erweiterung an der zweiten Instanz derselben Datei.
  "apps/web/src/pages/Capture.tsx › Capture › <RichTextEditor> [aiPanel+captionFormRequest+documentTitle+images+onAttachFiles+onChange+onTitelVorschlag+value] in [div<div<Card<div] #1":
    "Erfassung, direkter Editor im Hauptformular (mit KI-Palette). Die zweite Instanz derselben Datei — genau die, die mega85 datei-genau nicht sehen konnte. Seit PRO 337 ebenfalls mit dem Galerieeinstieg verbunden, seit JOB 2419 D1 mit dem Uebernahme-Weg.",
  "apps/web/src/pages/Capture.tsx › Capture › <KnowledgeInputStudio> [attachments+bodyHtml+documentTitle+enrichLocale+externalStage+images+onApply+onAttachFiles+onClose+open+runAssist] in [div<Card<div<div] #1":
    "Erfassung, Studio-Weg aus dem Hauptformular. Prop-gleich zur Reasoner-Instanz und nur ueber die JSX-Nachbarschaft von ihr unterscheidbar — deshalb gehoert sie zur Identitaet.",
  // 10.08.2026, Zusammenfuehrung der GitHub-Linie: der Ahnenpfad hat sich von
  // [div<form<Card<div] auf [ImageDescribeProvider<div<form<Card] geaendert. Die Flaeche ist
  // dieselbe geblieben; ueber ihr steht jetzt der <ImageDescribeProvider> aus PR #1
  // („inherit document confidentiality"), der die Vertraulichkeit des Entwurfs an den Weg zur
  // Bildbeschreibung weiterreicht. Der Sammler hat das gemeldet, WEIL er es melden soll: eine
  // umgehaengte Einbindung ist ein Befund, bis jemand hingesehen hat. Hier ist hingesehen worden.
  // 26.08.2026, JOB 2402 D1 (TV1 Scheibe b): die Signatur hat sich um `onTitelVorschlag` erweitert.
  // Die Flaeche ist dieselbe geblieben; sie bekommt den Weg, einen abgeleiteten Titelvorschlag in
  // ihr eigenes Titelfeld zu uebernehmen — auf Klick, nie von selbst. Der Sammler hat die alte
  // Identitaet als verschwunden UND die neue als undisponiert gemeldet, WEIL er das soll: eine
  // Einbindung mit anderer Propmenge ist ein Befund, bis jemand hingesehen hat. Hier ist hingesehen
  // worden. Der Prop ist bewusst optional (Begruendung an seiner Deklaration in RichTextEditor.tsx);
  // die vier anderen Einbindungen tragen ihn nicht und bleiben deshalb unveraendert.
  "apps/web/src/pages/CaptureFrontDoor.tsx › CaptureFrontDoor › <RichTextEditor> [captionFormRequest+documentTitle+onChange+onTitelVorschlag+placeholder+value] in [ImageDescribeProvider<div<form<Card] #1":
    "Eingangstuer der Erfassung — die Flaeche, auf der Pedis Befund vom 31.07. entstand. Seit PR #1 unter dem ImageDescribeProvider, der die Vertraulichkeit des Entwurfs mitfuehrt. Seit JOB 2402 D1 zusaetzlich die einzige Flaeche mit Uebernehmen-Weg fuer den Titelvorschlag.",
  // 04.09.2026, JOB 3063 (H4): die beiden Einbindungen des Wissensobjekt-Bearbeitens sind mit dem
  // Umbau der Bibliothek von `pages/KnowledgeDetail.tsx` nach
  // `components/bibliothek/BibliothekLesen.tsx` gezogen — `/wissen/:id` ist seit dem Auftrag
  // dieselbe Flaeche wie `/bibliothek`, mit dem Eintrag vorgewaehlt. Der Sammler hat beide alten
  // Identitaeten als verschwunden UND beide neuen als undisponiert gemeldet, WEIL er das soll.
  // Hier ist hingesehen worden: die PROPMENGE ist Zeichen fuer Zeichen dieselbe geblieben, nur die
  // Datei, die Huelle und der Ahnenpfad haben gewechselt (statt `[Field<div<Card<div]` jetzt
  // `[Field<div<div<ImageDescribeProvider]` — die Karte ist weg, der Provider steht darueber).
  "apps/web/src/components/bibliothek/BibliothekLesen.tsx › BibliothekLesen › <KnowledgeInputStudio> [attachments+bodyHtml+documentTitle+files+images+onApply+onClose+open+runAssist] in [Field<div<div<ImageDescribeProvider] #1":
    "Wissensobjekt bearbeiten, Studio-Weg — seit JOB 3063 auf der Leseflaeche der Bibliothek.",
  // 26.08.2026, JOB 2426 D1 (TV1, letzte Einbindung): die Signatur traegt zusaetzlich
  // `onTitelVorschlag`. Sie ist die einzige der fuenf, auf der ein Uebernehmen einen bereits
  // vergebenen Titel ERSETZT — die Begruendung dafuer steht an der Einbindung selbst: drei bewusste
  // Handlungen davor, und `edit` ist reiner Formularzustand ohne Autosave.
  "apps/web/src/components/bibliothek/BibliothekLesen.tsx › BibliothekLesen › <RichTextEditor> [captionFormRequest+documentTitle+files+images+onChange+onTitelVorschlag+value] in [Field<div<div<ImageDescribeProvider] #1":
    "Wissensobjekt bearbeiten, direkter Editor — seit JOB 3063 auf der Leseflaeche der Bibliothek. Seit JOB 2426 D1 mit dem Uebernahme-Weg fuer den Titelvorschlag.",
};

const identitaet = (f: Fund): string =>
  `${f.datei} › ${f.huelle ?? "(modulweit)"} › <${f.komponente}> [${f.signatur}] in [${f.ahnen}] #${f.ordnung}`;

const IDENTITAETEN = FUNDE.map(identitaet);

describe("mega86 Block C · Stufe 1+2: jeder Fund hat eine Identität und genau eine Disposition", () => {
  it("der Quellbaum wird wirklich gelesen (ein leerer Sammler wäre ein grüner Sammler)", () => {
    expect(ALLE_QUELLEN.length).toBeGreaterThan(100);
    expect(BAUTEILE.map((b) => b.komponente)).toContain("RichTextEditor");
    // Negativ-Sonde: eine unbeteiligte Datei rutscht nicht herein.
    expect(BAUTEILE.map((b) => b.datei)).not.toContain("apps/web/src/lib/editorBlocks.ts");
    // Und die Erhebung sieht wirklich Bäume, nicht Zeilen: irgendeine Datei trägt JSX.
    expect(ALLE_QUELLEN.some((f) => f.einbindungen.length > 0)).toBe(true);
  });

  it("FAIL-CLOSED: ein BEKANNTER Fund, der verschwindet, wird rot — egal wie viele es insgesamt sind", () => {
    const verschwunden = Object.keys(DISPOSITIONEN).filter((id) => !IDENTITAETEN.includes(id));
    expect(
      verschwunden,
      "Diese Einbindungen der Bildbeschreibung standen in der Dispositionstabelle und sind nicht " +
        "mehr da. Das ist ein Befund, AUCH wenn die Gesamtzahl gleich geblieben ist — genau die " +
        "Kompensation, die eine Mindestzahl nicht sieht. Wurde die Fläche entfernt? Dann gehört die " +
        "Zeile aus der Tabelle. Wurde sie nur umgehängt oder umbenannt? Dann gehört die Zeile " +
        "angepasst — nachdem jemand hingesehen hat.",
    ).toEqual([]);
  });

  it("FAIL-CLOSED: ein NEUER Fund ohne Disposition wird rot", () => {
    const ohneUrteil = IDENTITAETEN.filter((id) => !DISPOSITIONEN[id]);
    expect(
      ohneUrteil,
      "Diese Einbindungen tragen die Bildbeschreibung, ohne dass jemand entschieden hätte, was mit " +
        "ihnen ist. Disposition in DISPOSITIONEN eintragen.",
    ).toEqual([]);
  });

  it("die Identität TRENNT wirklich — keine zwei Funde teilen sich eine", () => {
    // Ohne diese Sonde wäre nicht belegt, dass die Identität überhaupt unterscheidet: fielen zwei
    // Funde zusammen, deckte eine Disposition beide ab und der Austausch wäre wieder unsichtbar.
    expect(new Set(IDENTITAETEN).size).toBe(IDENTITAETEN.length);
    // Und heute reicht die Beschreibung ohne Ordnungszahl schon aus — jede Ordnungszahl ist 1.
    expect(FUNDE.map((f) => f.ordnung).filter((o) => o !== 1)).toEqual([]);
  });

  it("die transitive Ebene ist erhoben und klettert NICHT bis zum Anwendungsrahmen", () => {
    // Das Studio bietet die Beschreibung nicht an, TRÄGT sie aber. Fiele es aus der Hülle, verlöre
    // der Wächter drei Funde unbemerkt.
    // JOB 2087 D1: `TRAEGER_NAMEN` statt `TRAEGER` — seit der Kennungs-Umstellung enthält
    // `TRAEGER` Deklarationsorte, keine Namen. Die Zusicherung ist dieselbe, sie liest nur die
    // Sicht, die Namen führt.
    expect(TRAEGER_NAMEN).toContain("KnowledgeInputStudio");
    // …und die Grenze hält: eine Route reicht keinen Dokument-Titel durch, sie führt zu der Seite,
    // die ihn erzeugt. Ohne diese Grenze wären `routes.tsx` und der Rahmen Fundstellen geworden.
    //
    // AUFTRAG-mega86 Block D: hier wurden die beiden Pfade bis mega85 aus Teilstücken ZUSAMMEN-
    // GESETZT, weil `tests/legal/mega61-rechtsseiten.test.tsx` den Rahmenpfad als reinen Text im
    // Dateiinhalt suchte und Erwähnung nicht von Import unterschied. Das Ausweichen war im engen
    // Auftrag vertretbar, drohte aber zur zweiten Wahrheit zu werden. Der Wächter erkennt jetzt
    // echte Importdeklarationen (TypeScript-Baum), also stehen die Pfade wieder da, wo man sie
    // lesen kann: im Klartext.
    const fundDateien = [...new Set(FUNDE.map((f) => f.datei))];
    expect(fundDateien).not.toContain("apps/web/src/routes.tsx");
    expect(fundDateien).not.toContain("apps/web/src/App.tsx");
    // JOB 2087 D1: Diese Zeile stand seit der Umstellung auf `TRAEGER` und konnte NICHTS mehr
    // finden — ein Name kommt in einer Kennungsliste nie vor. Sie war grün und wertlos. Auf
    // `TRAEGER_NAMEN` umgestellt ist sie wieder scharf; das ist eine Verschärfung, keine Lockerung.
    expect(TRAEGER_NAMEN).not.toContain("AppRoutes");
  });

  it("das VERHALTEN wird für JEDES erhobene Bauteil gefahren — sonst ist dieser Wächter unvollständig", () => {
    // Die Verhaltensstufe unten mountet `RichTextEditor`. Käme ein zweites Bauteil dazu, das die
    // Bildbeschreibung anbietet, wäre sein Verhalten ungeprüft — und das soll auffallen.
    const gefahren = ["RichTextEditor"];
    const ungefahren = BAUTEILE.map((b) => b.komponente).filter((k) => !gefahren.includes(k));
    expect(
      ungefahren,
      "Dieses Bauteil bietet die Bildbeschreibung an, aber sein Antwortverhalten wird von diesem " +
        "Wächter nicht gefahren. Entweder es kommt in die Verhaltensstufe unten, oder es ist gar " +
        "kein zweites Bauteil (dann gehört der Weg dorthin geführt statt nachgebaut).",
    ).toEqual([]);
  });

  it("AUFTRAG-mega84 Block C: JEDE EINZELNE Einbindung reicht den Titel durch", () => {
    // Der Titel ist Teil des Kontexts, den `collectImageContext` sammelt. Er kam über einen
    // OPTIONALEN Prop — Capture (2×) und KnowledgeDetail gaben ihn, CaptureFrontDoor und
    // KnowledgeInputStudio nicht. Geprüft wird die ATTRIBUTLISTE DIESER Einbindung, jetzt aus dem
    // Baum statt aus einem Zeichen-Zerteiler.
    const rohVon = new Map(ALLE_QUELLEN.map((f) => [f.datei, f.roh]));
    const ohneTitel = FUNDE.filter(
      (f) =>
        !f.attribute.includes("documentTitle") && !AUSNAHME_MUSTER.test(rohVon.get(f.datei) ?? ""),
    ).map(identitaet);
    expect(
      ohneTitel,
      "Diese EINBINDUNGEN tragen einen Editor mit Bildbeschreibung, reichen aber keinen " +
        "`documentTitle` durch — der KI-Vorschlag entsteht dort ohne den Titel des Beitrags. " +
        "Soll eine Fläche keinen haben, gehört das als `KEINE-BILDBESCHREIBUNG: <Grund>` in den Code.",
    ).toEqual([]);
  });

  it("ein SPREAD ist keine Blindstelle mehr, sondern ein Befund", () => {
    // mega85 nannte Spread als blind: `<RichTextEditor {...props} />` entging der Erhebung ganz.
    // Jetzt wird die Einbindung ERFASST; ob der Titel darin steckt, kann diese Erhebung nicht
    // wissen — also gilt sie als titellos und wird oben rot, bis jemand hinsieht.
    const mitSpread = FUNDE.filter((f) => f.spread).map(identitaet);
    expect(
      mitSpread,
      "Eine Einbindung reicht ihre Props gesammelt durch. Das ist erlaubt, aber dieser Wächter " +
        "kann den Titel darin nicht sehen — er gehört dann ausgeschrieben oder als " +
        "`KEINE-BILDBESCHREIBUNG: <Grund>` begründet.",
    ).toEqual([]);
    // Die Erhebung KANN Spread sehen — sonst wäre die Zusage oben ein leeres Versprechen.
    expect(
      ALLE_QUELLEN.some((f) => f.einbindungen.some((e) => e.spread)),
      "Nirgends im Web-Quellbaum steht ein JSX-Spread — dann prüft der Fall oben nichts.",
    ).toBe(true);
  });

  it("die Erhebung sieht auch `createElement` (der Textansatz sah es nicht)", () => {
    // Heute bindet kein Produktcode einen Träger so ein. Belegt wird deshalb die FÄHIGKEIT, an
    // einer Sonde — sonst stünde hier eine Zusage, die niemand geprüft hat.
    const sonde = liesQuelle(
      "sonde.tsx",
      "const a = createElement(RichTextEditor, { value: v, documentTitle: t });\n" +
        "const b = createElement(RichTextEditor, { value: v });\n",
    );
    expect(sonde.einbindungen.map((e) => e.komponente)).toEqual([
      "RichTextEditor",
      "RichTextEditor",
    ]);
    expect(sonde.einbindungen[0]?.attribute).toContain("documentTitle");
    expect(sonde.einbindungen[1]?.attribute).not.toContain("documentTitle");
  });

  it("die Attributliste gehört zum EINZELNEN Element (Negativ-Sonde an der Erhebung)", () => {
    // Der Nachfolger der mega85-Zerteiler-Sonde: ein Pfeil im ersten Element darf nicht auf das
    // zweite abfärben, und der Titel des zweiten nicht auf das erste.
    const sonde = liesQuelle(
      "sonde.tsx",
      "export function Probe() {\n" +
        "  return (\n" +
        "    <div>\n" +
        "      <RichTextEditor value={v} onChange={(html: string) => setV(html)} />\n" +
        "      <RichTextEditor value={w} onChange={setW} documentTitle={titel} />\n" +
        "    </div>\n" +
        "  );\n" +
        "}\n",
    );
    const editoren = sonde.einbindungen.filter((e) => e.komponente === "RichTextEditor");
    expect(editoren).toHaveLength(2);
    expect(editoren[0]?.attribute).toEqual(["value", "onChange"]);
    expect(editoren[1]?.attribute).toContain("documentTitle");
    // Und die Hülle wird richtig zugeordnet — das konnte der Textansatz nicht.
    expect(editoren[0]?.huelle).toBe("Probe");
  });

  // ── AUFTRAG-JOB-2062 D3 (I44, erstens): beide Schreibweisen in der Grundmenge ─────────────────
  //
  // Heute steht im Web-Quellbaum keine einzige Komponente als `const Name = () => …` (gemessen:
  // 246 zu 0). Belegt wird deshalb die FÄHIGKEIT an Sonden — genau wie beim `createElement`-Fall
  // oben, und aus demselben Grund: sonst stünde hier eine Zusage, die niemand geprüft hat.

  it("ein Anbieter als `const Editor = () => …` landet in der Grundmenge", () => {
    const sonde = liesQuelle(
      "sonde.tsx",
      "export const Editor = ({ documentTitle }: Props) => {\n" +
        "  return <p>{CAPTION_AI_TEXT.hinweis}</p>;\n" +
        "};\n",
    );
    const k = sonde.komponenten.find((x) => x.name === "Editor");
    expect(
      k,
      "Der Pfeil-Anbieter fehlt in der Grundmenge — genau die Blindstelle aus I44.",
    ).toBeDefined();
    expect(
      k?.bietetAn,
      "Er bietet an (CAPTION_AI_TEXT), wird aber nicht als Anbieter geführt.",
    ).toBe(true);
    expect(k?.eigenerTitel, "Sein eigener documentTitle-Prop wird nicht erkannt.").toBe(true);
  });

  it("auch `const Editor = function () { … }` zählt — dieselbe Sache, andere Schreibweise", () => {
    const sonde = liesQuelle(
      "sonde.tsx",
      "const Editor = function ({ documentTitle }: Props) {\n" +
        "  return <p>{CAPTION_AI_TEXT.hinweis}</p>;\n" +
        "};\n",
    );
    const k = sonde.komponenten.find((x) => x.name === "Editor");
    expect(k?.bietetAn).toBe(true);
    expect(k?.eigenerTitel).toBe(true);
  });

  it("die alte Form bleibt unverändert erfasst — die Erweiterung nimmt nichts weg", () => {
    // Ohne diesen Fall wäre nicht gezeigt, dass die Umstellung von `isFunctionDeclaration` auf
    // `alsKomponente` die bisherige Hälfte wirklich mitträgt.
    const sonde = liesQuelle(
      "sonde.tsx",
      "export function Editor({ documentTitle }: Props) {\n" +
        "  return <p>{CAPTION_AI_TEXT.hinweis}</p>;\n" +
        "}\n",
    );
    const k = sonde.komponenten.find((x) => x.name === "Editor");
    expect(k?.bietetAn).toBe(true);
    expect(k?.eigenerTitel).toBe(true);
  });

  it("kleingeschriebene Konstanten und Nicht-Funktionen bleiben draußen", () => {
    // Die Gegenrichtung. Ohne sie könnte die Erweiterung jede Konstante einsammeln und die
    // Grundmenge mit Daten füllen, die keine Komponenten sind — die Fundzahlen wären dann wertlos.
    const sonde = liesQuelle(
      "sonde.tsx",
      "const editor = () => <p>{CAPTION_AI_TEXT.hinweis}</p>;\n" +
        "const EDITOR_TEXT = CAPTION_AI_TEXT.hinweis;\n" +
        "const Grenze = 5;\n",
    );
    expect(sonde.komponenten.map((k) => k.name)).toEqual([]);
  });

  it("ein Pfeil-Träger schließt die transitive Hülle — Stufe 2 trägt die neue Form mit", () => {
    // Der eigentliche Zweck: nicht dass der Knoten in einer Liste steht, sondern dass die
    // Hüllenrunde ihn als Träger anerkennt. `huelleVon` kannte Pfeilfunktionen schon; erst jetzt
    // findet die Runde in `komponenten` auch den passenden Eintrag dazu.
    const sonde = liesQuelle(
      "sonde.tsx",
      "export const Wrapper = ({ documentTitle }: Props) => {\n" +
        "  return <RichTextEditor value={v} documentTitle={documentTitle} />;\n" +
        "};\n",
    );
    const einbindung = sonde.einbindungen.find((e) => e.komponente === "RichTextEditor");
    expect(einbindung?.huelle, "huelleVon sieht den Pfeil nicht — dann trägt Stufe 2 nicht.").toBe(
      "Wrapper",
    );
    expect(
      sonde.komponenten.find((k) => k.name === "Wrapper")?.eigenerTitel,
      "Die Hülle ist da, aber ohne Eintrag in `komponenten` bricht die Kette in Stufe 2 ab.",
    ).toBe(true);
  });

  // ── AUFTRAG-JOB-2062 D4 (I44, erstens — zweite Hälfte): drei Schreibweisen des Titel-Props ────
  //
  // Auch hier gilt, was für D3 galt: im Web-Quellbaum steht heute keine dieser Formen (gemessen
  // 2 zu 2, null neu). Die Fähigkeit wird an Sonden belegt, nicht an Fundzahlen behauptet.

  it("umbenannte Destrukturierung `{ documentTitle: titel }` zählt als eigener Titel", () => {
    // Der heiklere der beiden Fälle: `e.name` ist hier `titel`, der Prop steht in `propertyName`.
    // Wer nur `e.name` liest, sieht den Zielnamen der Umbenennung und hält die Hülle für titellos.
    const sonde = liesQuelle(
      "sonde.tsx",
      "export function Wrapper({ documentTitle: titel }: Props) {\n" +
        "  return <RichTextEditor value={v} documentTitle={titel} />;\n" +
        "}\n",
    );
    expect(sonde.komponenten.find((k) => k.name === "Wrapper")?.eigenerTitel).toBe(true);
  });

  it("`function Wrapper(props: Props)` zählt, wenn der Titel über das Objekt gelesen wird", () => {
    const zugriff = liesQuelle(
      "sonde.tsx",
      "export function Wrapper(props: Props) {\n" +
        "  return <RichTextEditor value={v} documentTitle={props.documentTitle} />;\n" +
        "}\n",
    );
    expect(zugriff.komponenten.find((k) => k.name === "Wrapper")?.eigenerTitel).toBe(true);

    const destrukturiert = liesQuelle(
      "sonde.tsx",
      "export function Wrapper(props: Props) {\n" +
        "  const { documentTitle } = props;\n" +
        "  return <RichTextEditor value={v} documentTitle={documentTitle} />;\n" +
        "}\n",
    );
    expect(destrukturiert.komponenten.find((k) => k.name === "Wrapper")?.eigenerTitel).toBe(true);
  });

  it("die direkte Destrukturierung bleibt unverändert erkannt", () => {
    // Ohne diesen Fall wäre nicht gezeigt, dass die Erweiterung die bisherige Form mitträgt.
    const sonde = liesQuelle(
      "sonde.tsx",
      "export function Wrapper({ documentTitle }: Props) {\n" +
        "  return <RichTextEditor value={v} documentTitle={documentTitle} />;\n" +
        "}\n",
    );
    expect(sonde.komponenten.find((k) => k.name === "Wrapper")?.eigenerTitel).toBe(true);
  });

  it("DIE GEGENRICHTUNG: ein fremdes Objekt mit gleichem Feldnamen zählt NICHT", () => {
    // Der Preis einer zu weiten Erhebung wäre eine Hülle, die den Titel gar nicht führt — die
    // transitive Menge würde wachsen und die Fundzahlen wären wertlos. Deshalb ist der Zugriff an
    // den PARAMETERNAMEN gebunden, und dieser Fall belegt es.
    const fremd = liesQuelle(
      "sonde.tsx",
      "export function Wrapper(props: Props) {\n" +
        "  const daten = ladeDaten();\n" +
        "  return <RichTextEditor value={v} documentTitle={daten.documentTitle} />;\n" +
        "}\n",
    );
    expect(
      fremd.komponenten.find((k) => k.name === "Wrapper")?.eigenerTitel,
      "`daten.documentTitle` ist nicht der Prop dieser Komponente — die Hülle führt ihn nicht.",
    ).toBe(false);

    const ohne = liesQuelle(
      "sonde.tsx",
      "export function Wrapper(props: Props) {\n" +
        "  return <RichTextEditor value={props.value} />;\n" +
        "}\n",
    );
    expect(ohne.komponenten.find((k) => k.name === "Wrapper")?.eigenerTitel).toBe(false);
  });

  // ── AUFTRAG-JOB-2080 D1 · STUFE 1: die Invarianz-Auflage als Fall, nicht als Zusage ──────────
  //
  // Die Entscheidung (`ENTSCHEIDUNGEN/JOB-2062-I44-SAMMLERGRUNDLAGE.md`) macht die Umstellung von
  // drei Zahlen abhängig: „246 Komponenten · 1 Anbieter · 2 Träger, vorher wie nachher. Weicht EINE
  // Zahl ab, ist die Umstellung GESCHEITERT, nicht fast richtig." Sie steht deshalb hier und nicht
  // nur in einer Rückgabe — wer die Grundlage künftig anfasst, sieht sofort, ob er sie verschoben
  // hat.
  // JOB 2083 D1: Dieser Fall hiess in 2080 D1 dasselbe, prüfte aber drei feste Zahlen. Er steht
  // jetzt in zwei Teilen da — der eine hält die Auflage des Chefs fest, der andere prüft, was die
  // Auflage eigentlich MEINT. Und beide sagen bei Rot, WAS sie gemessen haben; eine nackte
  // Erwartung `expected 246 to be 247` schickt den Nächsten auf dieselbe Suche, die mich einen
  // ganzen Durchgang gekostet hat.
  // AUFTRAG-JOB-2087 D1: der Wächter über die Namenssicht selbst.
  //
  // `TRAEGER_NAMEN` existiert, damit Zusicherungen einen Namen nennen können. Genau daran hängt
  // jetzt aber auch ihre Schärfe: liefe die Liste je leer oder unvollständig, würde jedes
  // `not.toContain(...)` wieder grün und wertlos — dieselbe stille Entwertung, die diesen Job
  // zwei Durchgänge gekostet hat, nur eine Ebene höher.
  it("DIE NAMENSSICHT LÄUFT NICHT LEER · gleich viele Namen wie Träger", () => {
    // Laeuft die Namenssicht leer, sind alle Zusicherungen ueber Namen still wertlos.
    expect(
      TRAEGER_NAMEN.length,
      `Namenssicht unvollstaendig: ${TRAEGER.length} Traeger, ${TRAEGER_NAMEN.length} Namen.`,
    ).toBe(TRAEGER.length);
    expect(
      TRAEGER_NAMEN.length,
      "Es gibt keine Traeger — dann prueft Stufe 2 nichts.",
    ).toBeGreaterThan(0);
    // Und die Sichten gehoeren zusammen: jeder Name muss in seiner eigenen Kennung vorkommen.
    const unpassend = TRAEGER_NAMEN.filter(
      (n, i) => !(TRAEGER[i] ?? "").includes(n) && !(TRAEGER[i] ?? "").includes("/"),
    );
    expect(unpassend, "Name und Kennung gehoeren nicht zusammen.").toEqual([]);
  });

  it("STUFE-1-INVARIANZ · die drei Zahlen der Auflage", () => {
    const komponenten = ALLE_QUELLEN.reduce((n, f) => n + f.komponenten.length, 0);
    const anbieter = ALLE_QUELLEN.flatMap((f) => f.komponenten.filter((k) => k.bietetAn)).length;
    const traeger = ALLE_QUELLEN.flatMap((f) => f.komponenten.filter((k) => k.eigenerTitel)).length;
    // Die Diagnose steht IM Fall, nicht in einer Rückgabe: wer hier rot wird, sieht sofort, ob die
    // Erhebung verschoben ist (dann Rollback) oder ob der Sammler aus dem falschen Verzeichnis
    // gelesen hat (dann ist nicht die Grundlage schuld, sondern der Lauf).
    const diagnose =
      `gemessen: ${komponenten} Komponenten · ${anbieter} Anbieter · ${traeger} Traeger` +
      ` · Grundmenge ${ALLE_QUELLEN.length} Quelldateien · cwd ${WURZEL}`;
    // JOB 2600 D1: `komponenten` von 246 auf 249 NACHGEZOGEN. Die neue Seite
    // `apps/web/src/pages/Wissensnetz.tsx` bringt GENAU DREI Komponenten mit — `Karte`,
    // `AlleThemen` und `Wissensnetz` selbst.
    //
    // WARUM DAS DIE AUFLAGE NICHT VERLETZT: Die Entscheidung bindet die Umstellung an „vorher wie
    // nachher" — sie verbietet, dass eine UMSTELLUNG die Erhebung verschiebt, nicht, dass der
    // Quellbaum waechst. Die beiden Zahlen, an denen Stufe 2 wirklich haengt, sind unveraendert:
    // `anbieter` 1 und `traeger` 2. Die Themenkarte bietet keine Bildbeschreibung an und traegt
    // keinen eigenen Titel — sie erscheint nur in der Grundmenge.
    //
    // JOB 2970 D1 (F-0140 / K-20): `komponenten` von 249 auf 250 NACHGEZOGEN. Die Import-Seite
    // `apps/web/src/pages/Stufe2.tsx` bringt GENAU EINE Komponente mit — `ImportRunPanel`, die
    // Fläche, auf der der Verwalter den Zustand eines laufenden Imports liest.
    //
    // Dieselbe Begründung wie oben bei JOB 2600 D1, und sie trägt hier genauso: Die Auflage
    // verbietet, dass eine UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst.
    // Die zwei Zahlen, an denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und
    // `traeger` 2. Die Lauf-Fläche bietet keine Bildbeschreibung an und trägt keinen eigenen
    // Titel; sie erscheint nur in der Grundmenge.
    //
    // JOB 3015 D5 (KonsoleStart): `komponenten` von 250 auf 251 NACHGEZOGEN. Die Startseite
    // `apps/web/src/pages/Start.tsx` bringt GENAU EINE Komponente hinzu — `KonsoleKarte`, die
    // Karte der Konsole (Suchen/Prüfen/Hinzufügen). Dieselbe Begründung wie oben: der Quellbaum
    // wächst, keine Umstellung verschiebt die Erhebung. `anbieter` 1 und `traeger` 2 sind
    // unverändert — die Karte bietet keine Bildbeschreibung an und trägt keinen eigenen Titel.
    //
    // JOB 3029 (U1): `komponenten` von 251 auf 252 NACHGEZOGEN. Die neue Datei
    // `apps/web/src/components/KnopfUnterschied.tsx` bringt GENAU EINE Komponente mit —
    // `KnopfUnterschied`, den sichtbaren Unterschied der zwei Erfassen-Knöpfe.
    //
    // Dieselbe Begründung wie oben, und sie trägt hier genauso: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2. Der Block ist
    // reine Auskunft: er bietet keine Bildbeschreibung an und trägt keinen eigenen Titel.
    //
    // JOB 3045 (Fundort im Live-Check): `komponenten` von 252 auf 253 NACHGEZOGEN. Die Datei
    // `apps/web/src/components/capture/intake/LiveReactionZone.tsx` bringt GENAU EINE Komponente
    // hinzu — `Fundort`, die Zeile unter dem Treffer, die Kategorie und Zustand des getroffenen
    // Wissensobjekts nennt (und bei fehlender Aussage schweigt).
    //
    // Dieselbe Begründung wie oben, und sie trägt hier genauso: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2. Die
    // Fundortzeile bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen
    // eigenen Titel (kein `documentTitle`-Prop) — sie erscheint nur in der Grundmenge.
    //
    // JOB 3052 (D6 Wissensnetz): `komponenten` von 253 auf 255 NACHGEZOGEN. `Wissensnetz.tsx`
    // bringt GENAU ZWEI Komponenten hinzu — `Seitenleiste` (die Objektliste des gewählten Themas
    // aus der Bibliothekssuche) und `Inhalt` (der gemeinsame Renderer für frische und gecachte
    // Daten). Dieselbe Begründung wie oben: der Quellbaum wächst, keine Umstellung verschiebt die
    // Erhebung; `anbieter` 1 und `traeger` 2 bleiben — weder Leiste noch Renderer bieten eine
    // Bildbeschreibung an oder tragen einen eigenen Titel.
    //
    // JOB 3061 (H2 · Prüfen nach Pages-Maßstab): `komponenten` von 255 auf 264 NACHGEZOGEN,
    // gemessen am eigenen Lauf. Die vier Prüfseiten sind auf die Mockups vom 04.09. umgebaut; die
    // gemeinsamen Bauteile der Fläche liegen jetzt unter `apps/web/src/components/pruefen/` und
    // ersetzen die bisher in den vier Seiten verstreuten Bauteile. Dieselbe Begründung wie oben,
    // und sie trägt hier genauso: Die Auflage verbietet, dass eine UMSTELLUNG die Erhebung
    // verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an denen Stufe 2 wirklich
    // hängt, sind unverändert: `anbieter` 1 und `traeger` 2. Keines der neuen Bauteile bietet eine
    // Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und keines trägt einen eigenen Titel (kein
    // `documentTitle`-Prop) — sie erscheinen nur in der Grundmenge.
    //
    // JOB 3063 (H4 · KONFLIKTRUNDE 2): NACH DEM REBASE auf JOB 3061/3052 NEU GEMESSEN. Die sechs
    // Bausteine unter `apps/web/src/components/bibliothek/` (Fläche, Liste, Lesefläche, „Mehr"-
    // Abschnitte, Menü, Zustand) sind die Aufteilung der beiden abgelösten Riesen
    // `pages/Library.tsx` und `pages/KnowledgeDetail.tsx`, nicht neue Funktionen. Dieselbe
    // Begründung wie oben: die Auflage verbietet, dass eine UMSTELLUNG die Erhebung verschiebt —
    // nicht, dass der Quellbaum wächst. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, sind
    // UNVERÄNDERT: `anbieter` 1 und `traeger` 2. Der Weg zur Bildbeschreibung ist mit dem Umbau
    // weder verdoppelt noch verlorengegangen — er ist mit dem Editor auf die Lesefläche gezogen
    // (Dispositionstabelle oben). Der Zahlenwert unten stammt aus dem tatsächlichen Testlauf an
    // diesem Arbeitsbaum, nicht aus einer Kopfrechnung der beiden Deltas.
    //
    // JOB 3063 RUNDE 6: von 274 auf 275, am eigenen Lauf gemessen. GENAU eine Komponente ist
    // dazugekommen: `components/bibliothek/AuffrischungHinweis.tsx` — die EINE Bauform des Satzes
    // „Stand von <Zeit> · Auffrischung fehlgeschlagen", die nach dem Einbau der Runde 5 zweimal
    // wörtlich im selben Ordner stand. Das ist eine ZUSAMMENFÜHRUNG, kein neuer Weg: sie bietet
    // keine Bildbeschreibung an und trägt keinen eigenen Titel. Die zwei Zahlen, an denen Stufe 2
    // wirklich hängt, sind unverändert — `anbieter` 1 und `traeger` 2.
    expect({ komponenten, anbieter, traeger }, diagnose).toEqual({
      komponenten: 275,
      anbieter: 1,
      traeger: 2,
    });
  });

  it("STUFE-1-INVARIANZ · Name gegen Kennung: die Umstellung verschiebt Stufe 2 nicht", () => {
    // DAS ist die Auflage in ihrer eigentlichen Form. Beide Währungen über DENSELBEN Baum, im
    // SELBEN Lauf. Der Fall wächst mit dem Quellbaum mit; er lässt sich durch keine angepasste
    // Zahl grün machen, sondern nur dadurch, dass die Umstellung wirklich nichts verschiebt.
    const alt = stufe2("name");
    const neu = stufe2("kennung");
    expect(
      neu.traeger.length,
      `Traegerzahl verschoben: ueber Namen ${alt.traeger.length}, ueber Kennungen ${neu.traeger.length}.`,
    ).toBe(alt.traeger.length);
    const verloren = alt.funde.filter((f) => !neu.funde.includes(f));
    const hinzu = neu.funde.filter((f) => !alt.funde.includes(f));
    // Ein VERSCHWUNDENER Fund ist der Abbruchgrund: er waere still aus der Aufsicht gefallen.
    expect(
      { verloren, hinzu },
      `Fundmenge verschoben — alt ${alt.funde.length}, neu ${neu.funde.length}.`,
    ).toEqual({ verloren: [], hinzu: [] });
  });

  // JOB 2083 D1 · SCHRITT 3 meiner eigenen Spezifikation aus 2080 D2 §3. In D1 war ein Fall dieser
  // Datei rot, und ich konnte ihn nicht lokalisieren: alles, was sich ausserhalb des Testlaufs
  // nachrechnen liess, war grün. Drei Ursachen blieben übrig, die alle NICHT in der Logik liegen,
  // sondern im Laufkontext — Arbeitsverzeichnis, Umgebung, Ladezeitpunkt. Der Fall unten macht
  // genau diese drei sichtbar, statt sie als Zahlendrift zu tarnen.
  it("DIE GRUNDLAGE STEHT · Arbeitsverzeichnis, Grundmenge und Programm sind da", () => {
    expect(
      ALLE_QUELLEN.length,
      `Die Grundmenge ist zu klein — liest der Sammler aus dem falschen Verzeichnis? cwd ist ${WURZEL}.`,
    ).toBeGreaterThan(300);
    expect(
      PROGRAMM.getSourceFiles().length,
      `Das Programm ist leer oder winzig — dann löst der Checker nichts auf. cwd ist ${WURZEL}.`,
    ).toBeGreaterThan(ALLE_QUELLEN.length);
    // Und die Gegenprobe zur Grundmenge: die eine Datei, an der alles hängt, muss drin sein.
    expect(
      ALLE_QUELLEN.some((f) => f.datei === "apps/web/src/components/RichTextEditor.tsx"),
      `RichTextEditor.tsx fehlt in der Grundmenge — cwd ist ${WURZEL}.`,
    ).toBe(true);
  });

  it("STUFE-1-INVARIANZ · jede Komponente und jede Einbindung ist über den Checker auflösbar", () => {
    // Der Gegenfall zur Zahl oben: die drei Werte könnten auch stimmen, wenn der Checker gar nichts
    // auflöst und alles auf den Namensvergleich zurückfällt. Dann wäre die Umstellung eine leere
    // Hülle. Gemessen am 23.08.2026: 246/246 Komponenten und 1524/1524 Einbindungen auflösbar.
    const ohneKennung = ALLE_QUELLEN.flatMap((f) => f.komponenten.filter((k) => !k.kennung));
    expect(
      ohneKennung.map((k) => k.name),
      "Komponenten ohne Kennung — der Checker löst sie nicht auf, Stufe 2 fällt auf Namen zurück.",
    ).toEqual([]);
    const einbOhne = ALLE_QUELLEN.flatMap((f) => f.einbindungen.filter((e) => !e.kennung));
    expect(
      einbOhne.map((e) => `${e.datei}:${e.zeile} <${e.komponente}>`),
      "Einbindungen ohne Kennung — dort greift die neue Grundlage nicht.",
    ).toEqual([]);
  });

  it("STUFE 1 löst auf, was der Name nicht traf: JSX-Member und Alias", () => {
    // Der eigentliche Gewinn, an einer Sonde gefahren. `<Umschlag.Editor />` und `<E />` zeigen
    // beide auf dieselbe Deklaration wie `<Editor />` — über den Namen war das nie erreichbar.
    const sonde = liesQuelle(
      "sonde.tsx",
      "export function Editor({ documentTitle }: Props) {\n" +
        "  return <p>{documentTitle}</p>;\n" +
        "}\n" +
        "const Umschlag = { Editor };\n" +
        "const E = Editor;\n" +
        "export function Probe() {\n" +
        "  return (\n" +
        "    <div>\n" +
        "      <Editor documentTitle={t} />\n" +
        "      <Umschlag.Editor documentTitle={t} />\n" +
        "      <E documentTitle={t} />\n" +
        "    </div>\n" +
        "  );\n" +
        "}\n",
    );
    const deklaration = sonde.komponenten.find((k) => k.name === "Editor")?.kennung;
    expect(
      deklaration,
      "Ohne Kennung der Deklaration ist der Vergleich unten wertlos.",
    ).toBeTruthy();
    const treffer = sonde.einbindungen.filter((e) => e.kennung === deklaration);
    expect(
      treffer.map((e) => e.komponente),
      "Alle drei Schreibweisen meinen dieselbe Komponente — genau das war I44, drittens.",
    ).toEqual(["Editor", "Umschlag.Editor", "E"]);
  });

  it("DIE GRENZE IST GEWANDERT: der Alias wird aufgelöst, sobald sein ZIEL im Programm liegt", () => {
    // JOB 2080 D1 · STUFE 1: Bis hierher stand hier „DIE VERBLEIBENDE GRENZE … die Sonde belegt,
    // dass die Erhebung den Alias wirklich nicht sieht". DAS GILT NICHT MEHR, und ein Kommentar,
    // der es weiter behauptet, wäre eine Falle für den Nächsten. Der Fall bleibt trotzdem stehen,
    // weil er jetzt etwas ANDERES festhält — und das ist die neue, engere Grenze:
    //
    //   Die Auflösung braucht ein ZIEL im Programm. Steht der Alias auf einem Namen, den dieses
    //   Programm nicht kennt, bleibt die Kennung bei der Zuweisung stehen. In einer Sondenquelle
    //   ohne Importe ist das der Normalfall; im echten Quellbaum ist es die Ausnahme, denn dort
    //   sind 1524 von 1524 Einbindungen auflösbar (Fall STUFE-1-INVARIANZ oben).
    //
    // Der NAME bleibt in beiden Fällen `E` — er wird für Meldungen und Fundidentitäten gebraucht
    // und ist nicht das, worüber Stufe 2 vergleicht.
    const ohneZiel = liesQuelle(
      "sonde.tsx",
      "const E = RichTextEditor;\nexport function Probe() {\n  return <E value={v} />;\n}\n",
    );
    expect(ohneZiel.einbindungen.map((e) => e.komponente)).toEqual(["E"]);
    expect(
      ohneZiel.einbindungen[0]?.kennung,
      "Ohne bekanntes Ziel darf die Erhebung keine Auflösung BEHAUPTEN — sie kennt sie nicht.",
    ).toBe("sonde.tsx:1");

    // Und die Gegenrichtung: liegt das Ziel im selben Programm, zeigt der Alias darauf.
    const mitZiel = liesQuelle(
      "sonde.tsx",
      "export function Editor({ documentTitle }: Props) {\n  return <p>{documentTitle}</p>;\n}\n" +
        "const E = Editor;\nexport function Probe() {\n  return <E documentTitle={t} />;\n}\n",
    );
    const deklaration = mitZiel.komponenten.find((k) => k.name === "Editor")?.kennung;
    expect(mitZiel.einbindungen.find((e) => e.komponente === "E")?.kennung).toBe(deklaration);
  });
});
// ── Stufe 3: das ANTWORTVERHALTEN ───────────────────────────────────────────────────────────────

const FIGURE =
  '<figure><img src="data:image/png;base64,AAAA" data-image-id="kw-a"><figcaption data-image-id="kw-a">Vorhandene Beschreibung</figcaption></figure>';

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let lastHtml = "";

function Host() {
  const [value, setValue] = useState(FIGURE);
  lastHtml = value;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => {
        lastHtml = html;
        setValue(html);
      },
    }),
  );
}

function mount(): void {
  lastHtml = FIGURE;
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  act(() => {
    r.render(createElement(Host));
  });
}

// Die Erhebungsstufen oben mounten nichts — der Abbau darf dort nicht in einen Fehler laufen und
// die eigentliche Aussage der Fälle überdecken.
afterEach(() => {
  const r = root;
  if (r) {
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

function flaeche(): HTMLElement {
  if (!container) {
    throw new Error("Die Fläche wurde nicht gemountet");
  }
  return container;
}

function fussnote(): HTMLElement {
  const cap = flaeche().querySelector("figcaption");
  if (!(cap instanceof HTMLElement)) {
    throw new Error("Die Fläche rendert keine Bild-Fußnote");
  }
  return cap;
}

function formularfeld(): HTMLElement | null {
  const el = flaeche().querySelector("#caption-form-text");
  return el instanceof HTMLElement ? el : null;
}

describe("mega84 Block D · Stufe 3: von der Beschreibung führt ein bedienbarer Weg in das Formular", () => {
  it("MAUS: der Klick auf die Beschreibung öffnet das Formular für genau dieses Bild", () => {
    mount();
    expect(formularfeld()).toBeNull();
    act(() => {
      fussnote().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(
      formularfeld(),
      "Von der Bildbeschreibung führt kein Weg in das Formular — genau Pedis Befund vom 31.07.: " +
        "„da steht das graue Feld, und das ist alles, was passiert.“",
    ).not.toBeNull();
    // Für GENAU DIESES Bild: der vorhandene Text ist der Ausgangswert.
    expect(formularfeld()?.textContent).toBe("Vorhandene Beschreibung");
  });

  it("TASTATUR: gleichwertig — erreichbar, angekündigt, und Eingabetaste öffnet", () => {
    mount();
    const cap = fussnote();
    expect(
      cap.getAttribute("tabindex"),
      "die Beschreibung ist nicht mit der Tastatur erreichbar",
    ).toBe("0");
    expect(
      cap.getAttribute("role"),
      "die Beschreibung ist nicht als Bedienelement angekündigt",
    ).toBe("button");
    expect(cap.getAttribute("aria-label")).toBe(i18n.t(CAPTION_AI_TEXT.captionOpenLabel));
    act(() => {
      cap.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });
    expect(formularfeld(), "der Tastaturweg ist dem Mausweg nicht gleichwertig").not.toBeNull();
  });

  it("das Formular trägt Textfeld, Formatierung, Vorschlagsknopf und Speichern", () => {
    mount();
    act(() => {
      fussnote().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // Ein beschriftetes Textfeld …
    expect(formularfeld()).not.toBeNull();
    expect(flaeche().querySelector('label[for="caption-form-text"]')?.textContent).toBe(
      i18n.t(CAPTION_AI_TEXT.formLabel),
    );
    // … Formatierung (Pedis Umfang: fett, kursiv, Zeilenumbruch) in einer benannten Gruppe …
    expect(flaeche().querySelector("fieldset")?.getAttribute("aria-label")).toBe(
      i18n.t(CAPTION_AI_TEXT.formFormatLabel),
    );
    for (const testid of ["caption-form-bold", "caption-form-italic", "caption-form-linebreak"]) {
      expect(flaeche().querySelector(`[data-testid="${testid}"]`), testid).not.toBeNull();
    }
    // … der Vorschlagsknopf …
    expect(flaeche().querySelector('[data-testid="caption-form-suggest"]')).not.toBeNull();
    // … und Speichern.
    expect(flaeche().querySelector('[data-testid="caption-form-save"]')).not.toBeNull();
  });

  it("der Speicherpfad trägt die Formatierung wirklich bis in den Dokumentinhalt", () => {
    mount();
    act(() => {
      fussnote().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const feld = formularfeld();
    if (!feld) {
      throw new Error("Formularfeld fehlt");
    }
    act(() => {
      feld.innerHTML = "Der <strong>Dichtring</strong> am <em>Ventil</em>";
      feld.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      (flaeche().querySelector('[data-testid="caption-form-save"]') as HTMLElement).click();
    });
    expect(
      lastHtml,
      "Die Formatierung überlebt den Speicherpfad nicht — das Feld verspricht dann etwas, was das " +
        "Dokument nicht hält.",
    ).toContain("<strong>Dichtring</strong>");
    expect(lastHtml).toContain("<em>Ventil</em>");
  });

  it("es bleibt bei EINEM Formular und EINEM KI-Weg", () => {
    mount();
    act(() => {
      fussnote().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(flaeche().querySelectorAll("#caption-form-text")).toHaveLength(1);
    expect(flaeche().querySelectorAll('[data-testid="caption-form-suggest"]')).toHaveLength(1);
  });
});

// ================================================================================================
// JOB 1122 · DER VON-AUSSEN-TRÄGER UND DIE GRENZEN DER SYMBOLAUFLÖSUNG
// ================================================================================================
//
// WORAUS DAS FOLGT: BEN5 hat zu JOB 996/D2 GRÜN geurteilt und dabei fünf Prüflücken benannt, die
// ausdrücklich KEINE Korrekturpflicht sind. Vier davon schliesst dieser Block:
//
//   (1) „Den Aufruferpfad von `Stage2Notice.tsx:38` bis zum tatsächlich übergebenen `Icon`
//       erheben und die Ausnahme fachlich bestätigen oder auflösen."        → A
//   (3) „`export { default as X }`, `export { X as Y }` und zyklische `export *`-Ketten jeweils
//       auf kanonische Herkunft ODER FAIL-CLOSED BEFUND prüfen."            → B und C
//   (4) „Zwei disjunkte lokale Scopes mit gleichem Namen vorlegen und belegen, dass kein falsches
//       Endsymbol als erfolgreich gilt."                                    → D
//   sowie BEN5s Promptverbesserung: „Eine bekannte unauflösbare Stelle bleibt nur mit konkretem
//   Fundort, fachlicher Disposition und Test auf veralteten Eintrag zulässig." → E
//
// DAS ERGEBNIS VON A VORWEG, weil es die Lage ändert: Der einzige reale von-aussen-Träger ist
// NICHT unauflösbar. `GateFrame` nimmt sein Symbol als Parameter, aber beide Aufrufer stehen in
// derselben Datei und übergeben benannte Importe. Die Stelle braucht keine Ausnahme, sondern eine
// Auflösung — und genau die steht unten als Fall.

const STAGE2 = "apps/web/src/components/Stage2Notice.tsx";

/** Ein aufgelöstes Symbol: woher es kommt und wie es dort heisst. */
interface Symbolherkunft {
  /** `modul#name` bei aufgelösten Symbolen, sonst `null`. */
  kanonisch: string | null;
  /** Der im Aufruf geschriebene Name — nur Anzeige, nie Auswahlkriterium. */
  geschrieben: string;
}

/** Importtabelle einer Datei: geschriebener Name → `modul#exportname`. */
function importtabelle(baum: ts.SourceFile): Map<string, string> {
  const tabelle = new Map<string, string>();
  for (const anweisung of baum.statements) {
    if (!ts.isImportDeclaration(anweisung) || !ts.isStringLiteral(anweisung.moduleSpecifier)) {
      continue;
    }
    const modul = anweisung.moduleSpecifier.text;
    const bindung = anweisung.importClause?.namedBindings;
    if (bindung && ts.isNamedImports(bindung)) {
      for (const el of bindung.elements) {
        // `import { X as Y }` → geschrieben Y, exportiert X.
        tabelle.set(el.name.text, `${modul}#${(el.propertyName ?? el.name).text}`);
      }
    }
    if (anweisung.importClause?.name) {
      tabelle.set(anweisung.importClause.name.text, `${modul}#default`);
    }
  }
  return tabelle;
}

/**
 * Erhebt, welche Symbole ein JSX-Attribut eines bestimmten Elements trägt.
 * Beispiel: `<GateFrame icon={Layers} …>` → Herkunft von `Layers`.
 */
function attributsymbole(datei: string, element: string, attribut: string): Symbolherkunft[] {
  const roh = readFileSync(join(WURZEL, datei), "utf8");
  const baum = ts.createSourceFile(datei, roh, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const tabelle = importtabelle(baum);
  const gefunden: Symbolherkunft[] = [];

  const besuche = (knoten: ts.Node): void => {
    const offen =
      ts.isJsxSelfClosingElement(knoten) || ts.isJsxOpeningElement(knoten) ? knoten : null;
    if (offen && tagName(offen) === element) {
      for (const eigenschaft of offen.attributes.properties) {
        if (!ts.isJsxAttribute(eigenschaft) || eigenschaft.name.getText(baum) !== attribut) {
          continue;
        }
        const wert = eigenschaft.initializer;
        // Nur ein blosser Bezeichner ist auflösbar. Ein Ausdruck (Ternär, Aufruf, Feldzugriff)
        // bleibt fail-closed unaufgelöst — er kann zur Laufzeit alles sein.
        if (
          wert &&
          ts.isJsxExpression(wert) &&
          wert.expression &&
          ts.isIdentifier(wert.expression)
        ) {
          const name = wert.expression.text;
          gefunden.push({ kanonisch: tabelle.get(name) ?? null, geschrieben: name });
        } else {
          gefunden.push({ kanonisch: null, geschrieben: wert ? wert.getText(baum) : "(leer)" });
        }
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(baum);
  return gefunden;
}

// ── E · Register bekannter unauflösbarer Stellen ────────────────────────────────────────────────
// BEN5 verlangt für JEDEN Eintrag: konkreter Fundort, fachliche Disposition und ein Test, der den
// Eintrag rot macht, sobald er veraltet ist. Das Register ist LEER — nicht weil niemand hingesehen
// hat, sondern weil der einzige Kandidat in A aufgelöst wurde.
const UNAUFLOESBAR_BEKANNT: Record<string, string> = {};

describe("JOB 1122 · A: der reale von-aussen-Träger ist bis zum übergebenen Symbol aufgelöst", () => {
  it("GateFrame nimmt sein Symbol als Parameter und rendert es an genau einer Stelle", () => {
    // Die Ausgangslage, die BEN5 als unauflösbar geführt hat: `<Icon size={28} …>` bezieht sein
    // Symbol nicht aus einem Import, sondern aus dem Parameter `icon`. Syntaktisch endet die
    // Erhebung hier — deshalb galt die Stelle als von-aussen.
    const roh = readFileSync(join(WURZEL, STAGE2), "utf8");
    expect(roh, "GateFrame benennt seinen Symbolparameter nicht mehr `icon: Icon`.").toContain(
      "icon: Icon,",
    );
    expect(roh, "Das durchgereichte Symbol wird nicht mehr als <Icon> gerendert.").toContain(
      "<Icon size={28}",
    );
  });

  it("beide Aufrufer übergeben ein benanntes, importiertes Symbol — nichts bleibt offen", () => {
    const symbole = attributsymbole(STAGE2, "GateFrame", "icon");

    expect(
      symbole.length,
      "Die Zahl der GateFrame-Aufrufer hat sich geändert. Jeder neue Aufrufer braucht eine eigene Auflösung.",
    ).toBe(2);

    const offen = symbole.filter((s) => s.kanonisch === null);
    expect(
      offen.map((s) => s.geschrieben),
      "Ein GateFrame-Aufrufer übergibt ein Symbol, das nicht auf einen Import zurückführbar ist. Fail-closed: solange das so ist, ist der Träger nicht aufgelöst.",
    ).toEqual([]);
  });

  it("die aufgelösten Symbole sind genau die beiden Torsymbole aus lucide-react", () => {
    const kanonisch = attributsymbole(STAGE2, "GateFrame", "icon")
      .map((s) => s.kanonisch)
      .sort();

    // Das ist die fachliche Auflösung der Prüflücke 1: Stufe-2-Tor trägt `Layers`, Rollentor `Lock`.
    expect(kanonisch).toEqual(["lucide-react#Layers", "lucide-react#Lock"]);
  });

  it("die Auflösung hängt am Import, nicht am geschriebenen Namen", () => {
    // Gegenprobe an einer Sonde: derselbe geschriebene Name, andere Herkunft — die Auflösung
    // muss der Herkunft folgen. Sonst wäre der Name wieder die Wahrheit, und genau das hat
    // JOB 996 abgelöst.
    const baum = ts.createSourceFile(
      "sonde.tsx",
      'import { Lock as Layers } from "andere-quelle";\nexport function P() {\n  return <GateFrame icon={Layers} />;\n}\n',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const tabelle = importtabelle(baum);
    expect(
      tabelle.get("Layers"),
      "Der Alias wird nicht auf sein Exportsymbol zurückgeführt — dann trägt wieder der geschriebene Name die Auswahl.",
    ).toBe("andere-quelle#Lock");
  });
});

describe("JOB 1122 · B: Weiterexport-Formen sind kalibriert, nicht stillschweigend übergangen", () => {
  // BEN5-Prüflücke 3, erste Hälfte. Der heutige Sammler löst Weiterexporte NICHT auf — das ist
  // eine bekannte Grenze (siehe „DIE VERBLEIBENDE GRENZE" oben). Diese Fälle halten sie fest,
  // damit sie ein BEFUND bleibt und nicht zur stillen Annahme wird.
  const FORMEN: { name: string; quelle: string }[] = [
    {
      name: "export { default as X }",
      quelle: 'export { default as RichTextEditor } from "./RichTextEditor";\n',
    },
    {
      name: "export { X as Y }",
      quelle: 'export { RichTextEditor as Editor } from "./RichTextEditor";\n',
    },
  ];

  for (const form of FORMEN) {
    it(`${form.name}: die Erhebung meldet keine Einbindung — die Form ist kein stiller Träger`, () => {
      const sonde = liesQuelle("barrel.ts", form.quelle);

      // Fail-closed heisst hier: ein Weiterexport ist KEINE Einbindung und darf auch keine
      // vortäuschen. Würde die Erhebung hier etwas melden, wäre die Fundmenge unecht.
      expect(
        sonde.einbindungen,
        `Die Erhebung erzeugt aus "${form.name}" eine Einbindung. Ein Weiterexport bindet nichts ein.`,
      ).toEqual([]);
      expect(
        sonde.komponenten.map((k) => k.name),
        `Die Erhebung hält "${form.name}" für eine Komponentendefinition.`,
      ).toEqual([]);
    });
  }

  it("ein Weiterexport verdeckt eine echte Einbindung derselben Datei nicht", () => {
    // Kalibrierung in die Gegenrichtung: neben dem Weiterexport steht eine echte Einbindung.
    // Sie muss weiterhin gefunden werden — sonst prüfte der Fall oben nur Blindheit.
    const sonde = liesQuelle(
      "gemischt.tsx",
      'export { RichTextEditor as Editor } from "./RichTextEditor";\n' +
        "export function Probe() {\n  return <RichTextEditor value={v} documentTitle={t} />;\n}\n",
    );
    expect(sonde.einbindungen.map((e) => e.komponente)).toEqual(["RichTextEditor"]);
    expect(sonde.einbindungen[0]?.huelle).toBe("Probe");
  });
});

describe("JOB 1122 · C: zyklische Barrel-Ketten enden in einem Befund, nicht in einer Schleife", () => {
  // BEN5-Prüflücke 3, zweite Hälfte. Ein Zyklus `a → b → a` darf die Erhebung weder aufhängen
  // noch ein Endsymbol erfinden.
  it("eine zyklische export-*-Kette wird ohne Endlosgang und ohne erfundenes Ziel gelesen", () => {
    const a = liesQuelle("a.ts", 'export * from "./b";\n');
    const b = liesQuelle("b.ts", 'export * from "./a";\n');

    for (const [name, quelle] of [
      ["a.ts", a],
      ["b.ts", b],
    ] as const) {
      expect(quelle.einbindungen, `${name} erzeugt aus einem Zyklus eine Einbindung.`).toEqual([]);
      expect(quelle.komponenten, `${name} erzeugt aus einem Zyklus eine Komponente.`).toEqual([]);
    }
  });

  it("ein Zyklus mit echter Einbindung dazwischen verliert die Einbindung nicht", () => {
    const gemischt = liesQuelle(
      "zyklisch.tsx",
      'export * from "./a";\n' +
        "export function Probe() {\n  return <RichTextEditor value={v} documentTitle={t} />;\n}\n" +
        'export * from "./b";\n',
    );
    expect(gemischt.einbindungen.map((e) => e.komponente)).toEqual(["RichTextEditor"]);
  });
});

describe("JOB 1122 · D: disjunkte lokale Scopes erzeugen kein falsches Endsymbol", () => {
  // BEN5-Prüflücke 4. Zwei Funktionen, in beiden eine lokale Komponente gleichen Namens. Die
  // Erhebung ist absichtlich nicht scopegenau — sie darf deshalb keine der beiden Einbindungen
  // der falschen Hülle zuordnen und keine als „aufgelöst" ausgeben.
  const ZWEI_SCOPES =
    "export function Eins() {\n" +
    "  const Panel = () => <div />;\n" +
    "  return <Panel value={a} />;\n" +
    "}\n" +
    "export function Zwei() {\n" +
    "  const Panel = () => <span />;\n" +
    "  return <Panel value={b} />;\n" +
    "}\n";

  it("jede Einbindung bleibt bei ihrer eigenen Hülle", () => {
    const sonde = liesQuelle("scopes.tsx", ZWEI_SCOPES);
    const panels = sonde.einbindungen.filter((e) => e.komponente === "Panel");

    expect(panels.length, "Nicht beide Panel-Einbindungen erhoben.").toBe(2);
    expect(
      panels.map((e) => e.huelle).sort(),
      "Eine Einbindung wurde der falschen Hülle zugeordnet — dann wäre die Fundidentität falsch.",
    ).toEqual(["Eins", "Zwei"]);
  });

  it("gleichnamige lokale Symbole werden nicht zu EINEM Symbol verschmolzen", () => {
    const sonde = liesQuelle("scopes.tsx", ZWEI_SCOPES);
    const panels = sonde.einbindungen.filter((e) => e.komponente === "Panel");

    // Ein lokales `Panel` steht in keiner Importtabelle. Genau deshalb darf es nie als kanonisch
    // aufgelöst gelten — sonst würde ein Name aus Scope A als Symbol aus Scope B verkauft.
    const baum = ts.createSourceFile(
      "scopes.tsx",
      ZWEI_SCOPES,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    expect(
      importtabelle(baum).get("Panel"),
      "Ein lokal deklariertes Symbol taucht in der Importtabelle auf — dann ist die Herkunft erfunden.",
    ).toBeUndefined();

    // Und die beiden bleiben durch ihre Hülle unterscheidbar, obwohl sie gleich heissen.
    expect(new Set(panels.map((e) => e.huelle)).size).toBe(2);
  });
});

describe("JOB 1122 · E: bekannte Ausnahmen tragen Fundort, Disposition und Veraltungstest", () => {
  it("jeder Eintrag im Ausnahmeregister nennt einen realen Fundort und eine Disposition", () => {
    for (const [fundort, disposition] of Object.entries(UNAUFLOESBAR_BEKANNT)) {
      expect(fundort, "Ein Registereintrag ohne Dateipfad ist kein Fundort.").toContain(
        "apps/web/src/",
      );
      expect(
        disposition.length,
        `Der Eintrag "${fundort}" trägt keine fachliche Disposition.`,
      ).toBeGreaterThan(30);
      // Der Veraltungstest: die genannte Datei muss es geben. Ein Eintrag auf eine verschwundene
      // Datei ist ein veralteter Eintrag und wird rot.
      const datei = fundort.split(" ")[0] ?? "";
      expect(
        existsSync(join(WURZEL, datei)),
        `Der Registereintrag zeigt auf "${datei}", das es nicht mehr gibt — veralteter Eintrag.`,
      ).toBe(true);
    }
  });

  it("das Register ist leer, weil der einzige Kandidat aufgelöst wurde", () => {
    // Diese Zusicherung ist der sichtbare Unterschied zu JOB 996: dort war der Stage2Notice-Fall
    // über eine Ausnahme dispositioniert. Käme er zurück ins Register, ohne dass Block A rot wird,
    // wäre eine Auflösung stillschweigend gegen eine Ausnahme getauscht worden.
    expect(
      Object.keys(UNAUFLOESBAR_BEKANNT),
      "Es gibt wieder bekannte unauflösbare Stellen. Jede braucht Fundort, Disposition und den Nachweis, dass sie nicht auflösbar ist.",
    ).toEqual([]);
  });
});
