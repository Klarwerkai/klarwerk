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
  "apps/web/src/pages/Capture.tsx › CaptureArbeitsraum › <KnowledgeInputStudio> [attachments+bodyHtml+documentTitle+enrichLocale+externalStage+images+onApply+onAttachFiles+onClose+open+runAssist] in [Field<div<ReasonerDraft<div] #1":
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
  "apps/web/src/pages/Capture.tsx › CaptureArbeitsraum › <RichTextEditor> [captionFormRequest+documentTitle+images+onAttachFiles+onChange+onTitelVorschlag+value] in [Field<div<ReasonerDraft<div] #1":
    "Erfassung, direkter Editor im Reasoner-Entwurf. Seit PRO 337 nimmt er die Bitte der Bildergalerie derselben Flaeche entgegen; seit JOB 2419 D1 fuehrt er den Uebernahme-Weg fuer den Titelvorschlag.",
  // AUFTRAG-PRO-337: dieselbe Erweiterung an der zweiten Instanz derselben Datei.
  "apps/web/src/pages/Capture.tsx › CaptureArbeitsraum › <RichTextEditor> [aiPanel+captionFormRequest+documentTitle+images+onAttachFiles+onChange+onTitelVorschlag+value] in [div<div<Card<div] #1":
    "Erfassung, direkter Editor im Hauptformular (mit KI-Palette). Die zweite Instanz derselben Datei — genau die, die mega85 datei-genau nicht sehen konnte. Seit PRO 337 ebenfalls mit dem Galerieeinstieg verbunden, seit JOB 2419 D1 mit dem Uebernahme-Weg.",
  "apps/web/src/pages/Capture.tsx › CaptureArbeitsraum › <KnowledgeInputStudio> [attachments+bodyHtml+documentTitle+enrichLocale+externalStage+images+onApply+onAttachFiles+onClose+open+runAssist] in [div<Card<div<div] #1":
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
  // JOB 3062 · H3: dieselbe EINE Einbindung, neue Identität. Die umschliessende Komponente heisst
  // jetzt `Blatt` (nicht mehr `CaptureFrontDoor` — die Seite ist nur noch die Adresse), und die
  // Ahnenkette ist die des Blattes statt die des alten Formulars. Weg der Bildbeschreibung
  // unverändert: `captionFormRequest` liegt an, die Beschreibungspflicht gilt wie bisher.
  // JOB 3062 · H3 · R8: die Ahnenkette steht wieder unmittelbar unter `ImageDescribeProvider`. R7
  // hatte dort einen `BildTitelHorcher` geschachtelt, der die describe-Antwort mithörte; ben hat
  // gemessen, dass er der Gültigkeitsprüfung des Editors (`stillCurrent()`) VORLIEF und deshalb
  // verworfene Antworten als Titelvorschlag zeigte. Er ist ersatzlos entfallen — das Blatt liest
  // die geprüfte Entscheidung des Editors, statt eine zweite zu bilden. Es gibt damit wieder genau
  // EINEN Weg durch den Bildkanal, und diese Zeile beschreibt ihn.
  "apps/web/src/components/erfassen/Blatt.tsx › Blatt › <RichTextEditor> [captionFormRequest+documentTitle+onChange+onTitelVorschlag+placeholder+value] in [div<div<div<ImageDescribeProvider] #1":
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
    //
    // JOB 3067 (V4 · die Sichtmetrik bekommt eine Fläche · KONFLIKTRUNDE 1): NACH DEM REBASE auf
    // JOB 3063 NEU GEMESSEN. `komponenten` von 275 auf 278 NACHGEZOGEN, gemessen am eigenen Lauf.
    // `Wissensnetz.tsx` bringt GENAU DREI Komponenten hinzu — `Zahl` (eine abgelesene Zahl mit
    // ihrer Beschriftung), `Sichtzahlen` (die Ablesekarte „Sichtbarer Bestand") und `Themenzeilen`
    // (die Themenliste mit dem Weg in die Bibliothek). Dieselbe Begründung wie oben, und sie trägt
    // hier genauso: Die Auflage verbietet, dass eine UMSTELLUNG die Erhebung verschiebt — nicht,
    // dass der Quellbaum wächst. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, sind unverändert:
    // `anbieter` 1 und `traeger` 2. Keine der drei bietet eine Bildbeschreibung an (kein
    // `ANGEBOT_MUSTER`) und keine trägt einen eigenen Titel (kein `documentTitle`-Prop) — sie
    // erscheinen nur in der Grundmenge.
    //
    // JOB 3064 (H5): `komponenten` von 253 auf 259 NACHGEZOGEN. Der neue Bereich
    // `apps/web/src/components/start/` bringt SECHS Komponenten mit — `OverflowMenu` (das
    // „…"-Menü), `Seitenblatt` (das Blatt eines Menüpunkts), `KartenKopf`, `FuerDichKarte`,
    // `FuerDichZeile` und `ZuletztKarte` (die zwei Karten des Zielbilds und ihre Zeile);
    // `StartPanelInhalt` ist die siebte Datei, aber `forYou.ts`, `zuletzt.ts` und `useDiktat.ts`
    // bringen keine Komponenten mit.
    //
    // Dieselbe Begründung wie oben, und sie trägt hier genauso: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2. Keines der
    // neuen Bauteile bietet eine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und keines trägt
    // einen eigenen Titel (kein `documentTitle`-Prop) — sie erscheinen nur in der Grundmenge.
    //
    // JOB 3064 (H5, Runde 4): `komponenten` von 259 auf 260 NACHGEZOGEN. In `pages/Ask.tsx` kommt
    // GENAU EINE Komponente hinzu — `MehrFlaechenInfo`, die Einordnung DER FLÄCHE (Kicker, Titel,
    // Modus-Chip, KI-Kennzeichnung, Erklär-Fläche). Sie entsteht aus Bens Korrekturpflicht 2: das
    // Info-Blatt hängt je nach Lage an zwei Stellen im Baum, und statt zweier Abschriften trägt
    // beide Stellen EIN Bauteil. Der Zuwachs ist also eine Entdopplung, keine neue Fläche.
    //
    // Dieselbe Begründung wie oben, und sie trägt hier genauso: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2. Das Bauteil
    // bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel
    // (kein `documentTitle`-Prop) — es erscheint nur in der Grundmenge.
    //
    // JOB 3064 (H5, Runde 5): `komponenten` von 260 auf 262 NACHGEZOGEN. Die neue Datei
    // `apps/web/src/components/start/AntwortText.tsx` bringt GENAU ZWEI Komponenten mit —
    // `AntwortText` (der Textsatz der Fragenfläche) und ihr internes `Inline` (die Inline-Teile
    // eines Segments). Dieselben zwei Namen trägt `components/AnswerMarkdown.tsx`, denn die
    // Fussnotenmarke des Zielbilds entsteht zwangsläufig dort, wo der Antworttext zu React-Knoten
    // wird, und `AnswerMarkdown` bedient daneben Mobile und Klara (§10 des Auftrags).
    //
    // Dieselbe Begründung wie oben, und sie trägt hier genauso: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2. Keines der
    // beiden Bauteile bietet eine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und keines trägt
    // einen eigenen Titel (kein `documentTitle`-Prop) — sie erscheinen nur in der Grundmenge.
    //
    // JOB 3064 (H5, Runde 6): `komponenten` von 262 auf 263 NACHGEZOGEN. In `pages/Ask.tsx` kommt
    // GENAU EINE Komponente hinzu — `MehrLueckenInfo`, die Einordnung einer WISSENSLÜCKE (Vertrag,
    // Quellenbilanz, geführter Rettungsweg, Datenschutzsatz, Weg zum Risiko-Board). Sie entsteht
    // aus Bens Korrekturpflicht 1: diese Texte standen bis Runde 5 als ZWEITE Karte neben der
    // Lückenkarte im Sichtfeld (gemessen: `{"ergebniskarten":2}`); jetzt stehen sie im Info-Blatt
    // „…" → „Mehr". Der Zuwachs ist also ein Umzug mit Namen, keine neue Fläche.
    //
    // Dieselbe Begründung wie oben, und sie trägt hier genauso: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2. Das Bauteil
    // bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel
    // (kein `documentTitle`-Prop) — es erscheint nur in der Grundmenge.
    //
    // JOB 3064 (H5, Runde 7): `komponenten` von 263 auf 265 NACHGEZOGEN. In
    // `components/start/AntwortText.tsx` kommen GENAU ZWEI Komponenten hinzu — `Marke` (die
    // hochgestellte Quellenziffer) und `Teil` (ein Inline-Teil mit seinen Marken). Sie entstehen
    // aus Bens Korrekturpflicht 1: die Marke muss auch INNERHALB von fett/kursiv gesetzt werden,
    // und dafür braucht jeder Inline-Teil dieselbe Zerlegung statt nur die Text-Teile. Aus einem
    // Zweig im Rendersatz sind damit zwei benannte Bauteile geworden — dieselbe Arbeit, ein Name
    // dafür.
    //
    // Dieselbe Begründung wie oben, und sie trägt hier genauso: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2. Keines der
    // beiden Bauteile bietet eine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und keines trägt
    // einen eigenen Titel (kein `documentTitle`-Prop) — sie erscheinen nur in der Grundmenge.
    //
    // JOB 3064 (H5) · KONFLIKTRUNDE 1: NACH DEM REBASE auf JOB 3052/3061/3063/3067 NEU GEMESSEN.
    // Die 278 aus dem Stand vor diesem Job plus die zwölf eigenständigen Komponenten dieses Jobs
    // (sechs aus `components/start/`, `MehrFlaechenInfo` und `MehrLueckenInfo` in `pages/Ask.tsx`,
    // `AntwortText`/`Inline`/`Marke`/`Teil` in `components/start/AntwortText.tsx`) ergeben 290 — am
    // eigenen Lauf dieses Arbeitsbaums gemessen, nicht rechnerisch addiert.
    //
    // JOB 3070 (V6 · der Leseweg des Wissensnetzes) · KONFLIKTRUNDE 1: NACH DEM REBASE auf JOB 3064
    // NEU GEMESSEN, `komponenten` von 290 auf 291 NACHGEZOGEN. GENAU EINE Komponente kommt hinzu —
    // `Umschalter` in `Wissensnetz.tsx`: die zwei Schalter „Netz" / „Lesen", mit denen am grossen
    // Bildschirm zwischen Zeichnung und Leseansicht gewaehlt wird. Sie ist reiner Anzeigezustand,
    // bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und traegt keinen eigenen Titel (kein
    // `documentTitle`-Prop) — sie erscheint nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2
    // wirklich haengt, sind unveraendert: `anbieter` 1 und `traeger` 2.
    //
    // JOB 3060 · H1 (die Hülle): `komponenten` von 253 auf 263 NACHGEZOGEN — gemessen, nicht
    // gelockert. Mit der alten Hülle gehen 15 Komponenten (`shell/Sidebar.tsx`: Badge, BadgeLoading,
    // BadgeError, BadgeStale, NavRow, RoleSwitcher, Sidebar · `shell/Topbar.tsx`: LangPill,
    // DesignTogglePill, NotificationBell, ReasonerStatusPill, ExternalStagePill, KiModePill,
    // IslandMarkerPill, Topbar); das Kopfband bringt 25 (Kopfband, KopfbandPunkte ×4, Menue ×5,
    // ZahnradMenue ×3, KontoMenue ×2, Meldungen, StatusZeilen ×5, RollenVorschau, Darstellung,
    // DrawerMenue, SeitenhilfeProvider). Saldo +10. `HelpTip` bleibt eine Komponente (rendert
    // nichts, meldet sich bei der Seitenhilfe an). Die zwei Zahlen, an denen Stufe 2 hängt, sind
    // unverändert: `anbieter` 1 und `traeger` 2 — kein Kopfband-Baustein bietet eine
    // Bildbeschreibung an oder trägt einen Titel.
    //
    // KONFLIKTRUNDE 1: NACH DEM REBASE von JOB 3060 (H1, Shell/Kopfband) auf den Stand von
    // JOB 3052/3061/3063/3064/3067/3070 (Prüf-, Bibliotheks-, Wissensnetz- und Startflächen) NEU
    // GEMESSEN, nicht rechnerisch addiert. Die abgelöste Hülle (Sidebar.tsx, Topbar.tsx) und die
    // neuen Kopfband-Bausteine treffen hier auf die 291 Komponenten aus JOB 3070 (inklusive des
    // Wissensnetz-Umschalters sowie der Bibliotheks- und Wissensnetz-Bauteile aus JOB 3063/3067);
    // der Zahlenwert unten stammt aus dem tatsächlichen Testlauf an diesem Arbeitsbaum. Die zwei
    // Zahlen, an denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2.
    //
    // JOB 3062 · H3 (vor diesem Rebase): `komponenten` von 253 auf 268 nachgezogen, dann R8 wieder
    // bei 268 (R7 hatte kurzzeitig 269 durch den seither ersatzlos entfallenen `BildTitelHorcher`,
    // der der Gültigkeitsprüfung des Editors vorlief — bens Befund). Der Quellbaum wuchs um das
    // Blatt und seine Bausteine (`components/erfassen/`); die zwei Zahlen, an denen Stufe 2
    // wirklich hängt, blieben UNVERÄNDERT: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 1: NACH DEM REBASE von JOB 3062 (H3, Blatt „Erfassen") auf den Stand von
    // JOB 3052/3060/3061/3063/3064/3067/3070 (Kopfband, Prüf-, Bibliotheks-, Wissensnetz- und
    // Startflächen) NEU GEMESSEN, nicht rechnerisch addiert. Der Zahlenwert unten stammt aus dem
    // tatsächlichen Testlauf an diesem Arbeitsbaum. Die zwei Zahlen, an denen Stufe 2 wirklich
    // hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2.
    //
    // JOB 3065 H6 (Einstellungen nach dem Pages-Maßstab): `komponenten` von 253 auf 280
    // NACHGEZOGEN (Stand vor diesem Rebase). Das ist die größte Bewegung dieser Zahl seit ihrer
    // Einführung, und sie hat genau einen Grund: `pages/Admin.tsx` war EINE Komponente mit 1844
    // Zeilen. Sie ist in benannte Bauteile zerlegt — vier Detailseiten (`AdminKontenDetails`,
    // `AdminKiDetails`, `AdminDatenDetails`, `AdminSicherheitDetails`) mit je einer Komponente pro
    // früherer Karte, dazu die fünf Bauteile der Zeilenfläche (`Seite`, `Zeilenkarte`,
    // `Detailkarte` und die beiden DOM-freien Module) und die zerlegte Profilseite.
    //
    // Dieselbe Begründung wie bei jedem Eintrag oben, und sie trägt hier genauso: Die Auflage
    // verbietet, dass eine UMSTELLUNG die ERHEBUNG verschiebt — nicht, dass der Quellbaum wächst.
    // Die zwei Zahlen, an denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und
    // `traeger` 2. Keines der neuen Bauteile bietet eine Bildbeschreibung an (kein
    // `ANGEBOT_MUSTER`) und keines trägt einen eigenen Titel (kein `documentTitle`-Prop) — sie
    // erscheinen ausschließlich in der Grundmenge, die von 406 auf 415 Quelldateien gewachsen ist.
    // JOB 3065 R2: `komponenten` von 280 auf 281. Es ist GENAU ein Bauteil dazugekommen —
    // `components/einstellungen/Abfragehuelle.tsx` mit der Komponente `Abfragehuelle`, die den
    // Lade-/Fehler-/Stale-Vertrag der Detailkarten trägt. `anbieter` 1 und `traeger` 2 sind
    // unverändert: sie bietet keine Bildbeschreibung an und trägt keinen eigenen Titel.
    //
    // JOB 3065 R3: von 281 auf 282. Wieder GENAU ein Bauteil, in derselben Datei — `Fehlerbox`.
    // Sie ist der herausgelöste Fehlerzustand, damit die Bereitschaft (eine Karte mit SECHS
    // Quellen, die die Hülle deshalb nicht verwenden kann) denselben Wortlaut und denselben Ausweg
    // zeigt wie jede andere Karte. `anbieter` 1 und `traeger` 2 bleiben unverändert.
    //
    // KONFLIKTRUNDE 1: NACH DEM REBASE von JOB 3065 (H6, Einstellungen) auf den Stand von JOB
    // 3052/3060/3061/3063/3064/3067/3070 (Prüf-, Bibliotheks-, Wissensnetz-, Start- und
    // Kopfbandflächen) NEU GEMESSEN, nicht rechnerisch addiert. Die 29 Einstellungen-Komponenten
    // (282 − 253) treffen hier auf die 301 Komponenten aus dem Stand vor diesem Job; der
    // Zahlenwert unten stammt aus dem tatsächlichen Testlauf an diesem Arbeitsbaum. Die zwei
    // Zahlen, an denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 2: die Erfassen-Komponenten (JOB 3062) und die Einstellungen-Komponenten
    // (JOB 3065) treffen hier gemeinsam auf denselben Stand; der Zahlenwert unten stammt aus dem
    // tatsächlichen Testlauf an diesem Arbeitsbaum, nicht aus einer Kopfrechnung der Deltas. Die
    // zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und
    // `traeger` 2.
    // JOB 3118 (Q6e/UX-17): `komponenten` von 345 auf 346 NACHGEZOGEN, am eigenen Lauf dieses
    // Arbeitsbaums gemessen (der Test meldete zuerst `expected 346 to be 345`). GENAU EINE
    // Komponente kommt hinzu — `Datenlagezeile` in `components/start/StartKarten.tsx`: der
    // Datenlagesatz und der Wiederholen-Knopf, die bis dahin in BEIDEN Startkarten je zweimal
    // abgeschrieben standen. Der Zuwachs ist also eine Entdopplung, keine neue Fläche. Sie bietet
    // keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein
    // `documentTitle`-Prop) — sie erscheint nur in der Grundmenge. Die zwei Zahlen, an denen
    // Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2.
    //
    // JOB 3124 · UX-12: unabhängig von JOB 3118 kommt GENAU EIN weiteres Bauteil dazu —
    // `VorschauHinweis` in `shell/RollenVorschau.tsx`, der Vorschausatz samt Rückweg, den seit
    // diesem Job auch die Rollen-Sperrkarte (`components/Stage2Notice.tsx`) rendert. Es ist eine
    // HERAUSLÖSUNG, keine neue Fläche: der Rumpf stand vorher in `RollenVorschau` selbst. Das
    // Bauteil bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen
    // Titel (kein `documentTitle`-Prop) — es erscheint nur in der Grundmenge.
    //
    // KONFLIKTRUNDE 1 (JOB 3124): NACH DEM REBASE auf JOB 3118 treffen beide unabhängigen
    // Bauteile (`Datenlagezeile` und `VorschauHinweis`) auf denselben Stand; `komponenten` von
    // 346 auf 347 NACHGEZOGEN — am eigenen Lauf dieses Arbeitsbaums gemessen, nicht rechnerisch
    // addiert. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter`
    // 1 und `traeger` 2.
    //
    // JOB 3134 (KI-WAHL, Runde 2): `komponenten` von 347 auf 348 NACHGEZOGEN, am eigenen Lauf
    // gemessen (das Tor der Runde 1 meldete `expected 348 to be 347`). GENAU EINE Komponente kommt
    // hinzu — `WahlOptionen` in `pages/AdminKiDetails.tsx`: die EINE Optionsliste der KI-Karte
    // (Auto, ChatGPT (OpenAI), Claude (Anthropic), Intern, Regelbasiert), die das globale Feld und
    // jedes Aufgabenfeld gemeinsam rendern, damit die Feinabstimmung nie einen Anbieter kennt, den
    // das globale Feld nicht kennt. Es ist eine Entdopplung, keine neue Fläche. Sie bietet keine
    // Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein
    // `documentTitle`-Prop) — sie erscheint nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2
    // wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 1 (JOB 3190 · UX-18): NACH DEM REBASE auf JOB 3134 treffen beide unabhängigen
    // Herauslösungen (`WahlOptionen` und `TileInhalt`) auf denselben Stand; `komponenten` von 348
    // auf 349 NACHGEZOGEN — am eigenen Lauf dieses Arbeitsbaums gemessen, nicht rechnerisch
    // addiert. GENAU EINE weitere Komponente kommt hinzu — `TileInhalt` in
    // `components/FileTypePicker.tsx`: Icon, Name und Zustands-Badge einer Dateikachel. Es ist eine
    // HERAUSLÖSUNG, keine neue Fläche: der Rumpf stand vorher direkt in `Tile`, und seit diesem Job
    // hat die Kachel zwei Erscheinungsformen (`<button>` wie bisher, `<a>` wenn sie auf eine andere
    // Fläche führt) — ohne das Bauteil stünde derselbe Inhalt zweimal abgeschrieben da. Es bietet
    // keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein
    // `documentTitle`-Prop) — es erscheint nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2
    // wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2.
    //
    // JOB 3267 · Q1 (Runde 4): `komponenten` von 349 auf 351 NACHGEZOGEN — am eigenen Lauf dieses
    // Arbeitsbaums gemessen (der Test meldete zuerst `expected 351 to be 349`), nicht gerechnet.
    // GENAU ZWEI Bauteile kommen hinzu, beide in `pages/Ask.tsx`:
    //
    //     + `VerwendungsPlakette` (Ask.tsx:228) — die Plakette „verwendet · nicht verwendet ·
    //       Zuordnung unbekannt", die der Quellenchip UND die Quellenliste rendern.
    //     + `PruefstandPlakette` (Ask.tsx:277) — dieselbe Bauform für die ZWEITE Aussage, den
    //       Prüfstand („Offen"/„Validiert").
    //
    // Es sind HERAUSLÖSUNGEN, keine neuen Flächen: der Rumpf stand vorher zweimal abgeschrieben in
    // der Karte und im Blatt. Sie sind der Weg, auf dem dieser Job die Auflage des
    // Klassenbindungs-Wächters erfüllt (mega47, JOB 1181): je Zustand ein eigener Zweig mit fester
    // Klassenkette statt eines berechneten `TON[zustand]` — ausgeschrieben an beiden Stellen wäre
    // dasselbe Gerüst viermal abgetippt. Gemessen an diesem Arbeitsbaum trägt `pages/Ask.tsx` damit
    // fünf Komponenten (`VerwendungsPlakette`, `PruefstandPlakette`, `MehrFlaechenInfo`,
    // `MehrLueckenInfo`, `Ask`) statt drei.
    //
    // Für DIESEN Sammler gibt es nichts aufzulösen — er zählt. Keines der beiden Bauteile bietet
    // eine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und keines trägt einen eigenen Titel (kein
    // `documentTitle`-Prop); sie erscheinen nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2
    // wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 1 (JOB 3179 · UX-24, Runde 2): NACH DEM REBASE auf JOB 3267 trifft die
    // unabhängige Herauslösung `AnhangVorschau` in `components/bibliothek/MehrAbschnitte.tsx` auf
    // denselben Stand; `komponenten` von 351 auf 352 NACHGEZOGEN — am eigenen Lauf dieses
    // Arbeitsbaums gemessen, nicht rechnerisch addiert. `AnhangVorschau` hält den Ladefehler je
    // Vorschau und wird beim Wechsel ihrer Quelle neu gemountet. Sie bietet keine Bildbeschreibung
    // an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein `documentTitle`-Prop) — sie
    // erscheint nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben
    // unverändert: `anbieter` 1 und `traeger` 2.
    //
    // JOB 3277 (DEMOPAKET-ADVISOR): `komponenten` von 352 auf 353 NACHGEZOGEN — am eigenen Lauf
    // dieses Arbeitsbaums gemessen (der Test meldete `expected 353 to equal 352`), nicht gerechnet.
    // GENAU EIN Bauteil kommt hinzu: `DemoPackages` in `components/ExamplePackages.tsx` — der
    // Kasten, in dem ein Demopaket gewählt, geladen, zurückgesetzt und paketweise entfernt wird.
    // Es ist eine eigene Fläche, aber keine Bildfläche: es bietet keine Bildbeschreibung an (kein
    // `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein `documentTitle`-Prop) — es erscheint
    // nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben unverändert:
    // `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 3 (JOB 3268 · D1-R): NACH DEM REBASE auf JOB 3277/DEMOPAKET-ADVISOR trifft die
    // unabhängige NEUE Fläche `VersionsHinweis` in `components/VersionsHinweis.tsx` auf denselben
    // Stand; `komponenten` von 353 auf 354 NACHGEZOGEN — am eigenen Lauf dieses Arbeitsbaums
    // gemessen, nicht rechnerisch addiert. `VersionsHinweis` ist die eine ruhige Zeile, mit der ein
    // seit Stunden offener Tab erfährt, dass eine neue Version ausgeliefert ist, samt Knopf „Neu
    // laden" (Pedis Befund vom 08.09.), keine Herauslösung. Für DIESEN Sammler ändert sie nichts:
    // sie zeigt kein Bild, bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen
    // eigenen Titel (kein `documentTitle`-Prop) — sie erscheint nur in der Grundmenge. Die zwei
    // Zahlen, an denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 1 (JOB 3288 · IMPORT-VOLLTEXT): NACH DEM REBASE auf JOB 3268/D1-R trifft die
    // unabhängige NEUE Fläche IMPORT-VOLLTEXT auf denselben Stand; `komponenten` von 354 auf 356
    // NACHGEZOGEN — am eigenen Lauf dieses Arbeitsbaums gemessen, nicht rechnerisch addiert. GENAU
    // ZWEI Bauteile kommen hinzu, beide in `pages/Stufe2.tsx`:
    //
    //     + `ImportVolltextAufklapper` (Stufe2.tsx:496) — der aufklappbare ganze Seitentext auf
    //       der Prüfkarte; er hält seinen Auf-/Zu-Zustand und die „Mehr anzeigen"-Entscheidung
    //       je Karte, ist also eine eigene Komponente und kein Ausdruck in der Karte.
    //     + `ImportQuellzeile` (Stufe2.tsx:576) — Titel, Raum und der Link zur Confluence-Quelle.
    //
    // Für DIESEN Sammler gibt es nichts aufzulösen — er zählt. Keines der beiden Bauteile bietet
    // eine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und keines trägt einen eigenen Titel (kein
    // `documentTitle`-Prop); sie erscheinen nur in der Grundmenge. Die zwei Zahlen, an denen
    // Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 6 (JOB 3140 · UX-11): NACH DEM REBASE auf JOB 3288/IMPORT-VOLLTEXT trifft die
    // unabhängige HERAUSLÖSUNG `DetailWert` in `pages/AdminSicherheitDetails.tsx` auf denselben
    // Stand; `komponenten` von 356 auf 357 NACHGEZOGEN — am eigenen Lauf dieses Arbeitsbaums
    // gemessen (der Test meldete `expected 357 to equal 356`), nicht rechnerisch addiert.
    // `DetailWert` ist der Wert einer Detailzeile des Prüfprotokolls in seinen drei Formen (Wert ·
    // Kennung mit Grund · „nicht gespeichert"). Es ist eine HERAUSLÖSUNG aus der Zeilenschleife,
    // keine neue Fläche, und reiner Text ohne Bedienelement. Es bietet keine Bildbeschreibung an
    // (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein `documentTitle`-Prop) — es
    // erscheint nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben
    // unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 2 (JOB 3326 · LESEVARIANTE): NACH DEM REBASE auf JOB 3140/UX-11 trifft die
    // unabhängige NEUE Fläche `LesevarianteHinweis` in `components/LesevarianteHinweis.tsx` auf
    // denselben Stand; `komponenten` von 357 auf 358 NACHGEZOGEN — am eigenen Lauf dieses
    // Arbeitsbaums gemessen, nicht rechnerisch addiert. `LesevarianteHinweis` ist die Kennzeichnung
    // „Übersetzung · Original: Englisch" samt Umschalter zurück zum Original. Sie bietet keine
    // Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein
    // `documentTitle`-Prop); sie erscheint nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2
    // wirklich hängt, bleiben unverändert: `anbieter` 1, `traeger` 2.
    //
    // JOB 3362 (LESEVARIANTE-FLAECHEN): dieselbe Gattung, ein Bauteil weiter — `ZeilenTitel` in
    // `components/bibliothek/BibliothekListe.tsx`; `komponenten` von 358 auf 359 NACHGEZOGEN, am
    // eigenen Lauf dieses Arbeitsbaums gemessen (der Test meldete `expected 359 to equal 358`),
    // nicht rechnerisch addiert. `ZeilenTitel` ist der Titel EINER Listenzeile in der Lesesprache;
    // es ist eine HERAUSLÖSUNG aus der Zeilenschleife (der Haken `useLesevariante` braucht eine
    // eigene Komponente je Zeile), keine neue Fläche. Es bietet keine Bildbeschreibung an (kein
    // `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein `documentTitle`-Prop); es erscheint nur
    // in der Grundmenge. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben unverändert:
    // `anbieter` 1, `traeger` 2.
    //
    // KONFLIKTRUNDE 2 (JOB 3357 · IMPORT-LAUFKENNUNG): NACH DEM REBASE auf JOB 3362/LESEVARIANTE-
    // FLAECHEN trifft die unabhängige NEUE Fläche IMPORT-LAUFKENNUNG auf denselben Stand;
    // `komponenten` von 359 auf 361 NACHGEZOGEN — am eigenen Lauf dieses Arbeitsbaums gemessen,
    // nicht rechnerisch addiert. GENAU ZWEI Bauteile kommen hinzu, beide in
    // `components/ImportGroups.tsx`:
    //
    //     + `LaufAusgang` — Status, Fehlercode/-grund und Zähler EINES Übernahmelaufs, gelesen
    //       über den bestehenden Haken `useImportRun`. Eigene Komponente und kein Ausdruck in der
    //       Bilanz, weil der Haken NUR mit vorhandener Kennung überhaupt feuern darf; das ist als
    //       eigenes Bauteil baulich sicher statt bloß verabredet.
    //     + `LaufKennungen` — die Kennungen dieses Durchlaufs in Aufrufreihenfolge, samt dem
    //       ehrlichen Satz für den Fall, dass der Server keinen Lauf geführt hat.
    //
    // Für DIESEN Sammler gibt es nichts aufzulösen — er zählt. Keines der beiden Bauteile bietet
    // eine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und keines trägt einen eigenen Titel (kein
    // `documentTitle`-Prop); sie erscheinen nur in der Grundmenge. Die zwei Zahlen, an denen
    // Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 1 (JOB 3363 · LESEVARIANTE-PRUEFKARTE): NACH DEM REBASE auf JOB 3357/IMPORT-
    // LAUFKENNUNG trifft die unabhängige NEUE Fläche LESEVARIANTE-PRUEFKARTE auf denselben Stand;
    // `komponenten` von 361 auf 362 NACHGEZOGEN, am eigenen Lauf dieses Arbeitsbaums gemessen,
    // nicht rechnerisch addiert. Das eine Bauteil ist `ImportKandidatKarte` in `pages/Stufe2.tsx`;
    // es ist eine HERAUSLÖSUNG aus der Kartenschleife (der Haken
    // `useFrischeKandidatenLesevariante` braucht eine eigene Komponente je Karte), keine neue
    // Fläche — das gerenderte Ergebnis ist das bisherige plus die Kennzeichnung. Es bietet keine
    // Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein
    // `documentTitle`-Prop); es erscheint nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2
    // wirklich hängt, bleiben unverändert: `anbieter` 1, `traeger` 2.
    //
    // JOB 3390 (LADEFEHLER-ALTER-TAB): `komponenten` von 362 auf 363 NACHGEZOGEN — am eigenen Lauf
    // dieses Arbeitsbaums gemessen (der Test meldete `expected { komponenten: 363, … } to deeply
    // equal { komponenten: 362, … }`), nicht gerechnet. GENAU EIN Bauteil kommt hinzu:
    // `NeueVersionAngebot` in `components/VersionsHinweis.tsx` — der Satz „eine neue Version ist
    // da" samt Knopf „Neu laden" in seinen zwei Formen (Überlagerung des Versionswächters ·
    // Karte im Seitenfluss, wenn die Fehlergrenze einen gescheiterten Nachlade-Import fängt). Es
    // ist eine HERAUSLÖSUNG aus `VersionsHinweis`, keine neue Fläche: die Überlagerung rendert
    // zeichengleich wie vorher, und die zweite Fundstelle benutzt dasselbe Bauteil, statt den Text
    // abzuschreiben. Es bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen
    // eigenen Titel (kein `documentTitle`-Prop) — es erscheint nur in der Grundmenge. Die zwei
    // Zahlen, an denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1, `traeger` 2.
    //
    // KONFLIKTRUNDE 7 (JOB 3337 · ADMIN-NAVIGATION): NACH DEM REBASE auf JOB 3390/LADEFEHLER-ALTER-
    // TAB trifft die unabhängige NEUE Fläche ADMIN-NAVIGATION auf denselben Stand; `komponenten`
    // von 363 auf 365 NACHGEZOGEN — am eigenen Lauf dieses Arbeitsbaums gemessen, nicht rechnerisch
    // addiert. Es sind GENAU ZWEI Bauteile, beide in `pages/Admin.tsx` und beide reine
    // Navigationszeilen: `Kurzlink` (eine Zeile, die aus der Verwaltung auf einen vorhandenen
    // Bedienort führt) und `BereichsZeile` (dieselbe Zeile mit der ehrlichen Unterscheidung „Rolle
    // fehlt" gegen „Modul ausgeschaltet"). Für DIESEN Sammler ändern sie nichts: sie zeigen kein
    // Bild, bieten keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und tragen keinen eigenen Titel
    // (kein `documentTitle`-Prop) — sie erscheinen nur in der Grundmenge. Die zwei Zahlen, an denen
    // Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 1 (JOB 3323 · APP-SPRACHSCHALTER): NACH DEM REBASE auf JOB 3337/ADMIN-NAVIGATION
    // trifft die unabhängige NEUE Fläche APP-SPRACHSCHALTER auf denselben Stand; `komponenten` von
    // 365 auf 366 NACHGEZOGEN — am eigenen Lauf dieses Arbeitsbaums gemessen, nicht rechnerisch
    // addiert. GENAU EIN Bauteil kommt hinzu: `SprachSchalter` in der neuen Datei
    // `components/SprachSchalter.tsx` — die DE/EN/NL-Zeile im Konto-Menü der Hülle, mit der sich
    // die Sprache aus jeder laufenden Szene wechseln lässt. Die zweite Funktion der Datei,
    // `istAktiv`, wird NICHT mitgezählt: `alsKomponente` (oben, :453) verlangt einen
    // Großbuchstaben am Namensanfang. GEGENPROBE dazu, gemessen statt behauptet: mit der
    // Deklaration kleingeschrieben meldet dieser Fall wieder 365 und ist grün — die +1 ist genau
    // dieses Bauteil und kein zweiter Fund, der sich hinter derselben Zahl versteckt.
    // Es bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel
    // (kein `documentTitle`-Prop) — es erscheint nur in der Grundmenge. Die zwei Zahlen, an denen
    // Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2.
    //
    // JOB 3430 (Q1c-NACHLADEN): `komponenten` von 366 auf 367 NACHGEZOGEN — am Lauf gemessen, nicht
    // gerechnet. Das Tor dieses Arbeitsbaums meldete wörtlich `gemessen: 367 Komponenten ·
    // 1 Anbieter · 2 Traeger · Grundmenge 471 Quelldateien` gegen die damalige Auflage 366.
    // GENAU EIN Bauteil kommt hinzu: `AbschnittNachladen` in
    // `components/bibliothek/MehrAbschnitte.tsx` — der Knopf, mit dem ein aufgeklappter Abschnitt
    // („Belege", „Schnappschüsse") seinen Stand über `refetch()` seiner eigenen Abfrage nachholt.
    // Es ist eine HERAUSLÖSUNG, keine neue Fläche: dieselbe Bauform steht an zwei Abschnitten
    // derselben Lesefläche, statt zweimal als Literal — hingeschrieben wäre sie die Doppelung, die
    // die Doppelungswächter suchen. Es zeigt kein Bild, bietet keine Bildbeschreibung an (kein
    // `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein `documentTitle`-Prop); es erscheint
    // nur in der Grundmenge. GEGENPROBE dazu, gemessen statt behauptet: mit der Deklaration
    // kleingeschrieben (`abschnittNachladen`) meldet dieser Fall wieder 366 — `alsKomponente`
    // (oben, :453) verlangt einen Großbuchstaben am Namensanfang, und die +1 ist damit genau dieses
    // Bauteil und kein zweiter Fund, der sich hinter derselben Zahl versteckt. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 2 (JOB 3420 · KI-FEHLERHILFE): NACH DEM REBASE auf JOB 3430/Q1c-NACHLADEN trifft
    // die unabhängige NEUE Fläche KI-FEHLERHILFE auf denselben Stand; `komponenten` von 367 auf 369
    // NACHGEZOGEN — am eigenen Lauf dieses Arbeitsbaums gemessen, nicht rechnerisch addiert. Es sind
    // GENAU ZWEI Bauteile, beide in `pages/AdminKiDetails.tsx`: `KiFehlerkasten` (der EINE rote
    // Kasten der KI-Karte, der die gemessene Ursache statt eines pauschalen Schlüsseltipps zeigt)
    // und `KiAnfrageFehler` (derselbe Kasten für den Fall, dass gar kein Prüfergebnis vorliegt).
    // Beide sind HERAUSLÖSUNGEN aus sechs vorher abgeschriebenen `<p>`-Zeilen derselben Karte, keine
    // neue Fläche. Für DIESEN Sammler ändern sie nichts: sie zeigen kein Bild, bieten keine
    // Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und tragen keinen eigenen Titel (kein
    // `documentTitle`-Prop) — sie erscheinen nur in der Grundmenge. Die zwei Zahlen, an denen
    // Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 2 (JOB 3426 · ENTWUERFE-VERWALTEN): auf demselben Rebase-Ziel trifft die
    // ZWEITE, ebenso unabhängige Fläche ENTWUERFE-VERWALTEN auf denselben Stand; `komponenten` von
    // 369 (nach KI-FEHLERHILFE, siehe oben) auf 371 NACHGEZOGEN — am eigenen Lauf dieses
    // Arbeitsbaums gemessen, nicht rechnerisch addiert. GENAU ZWEI weitere Bauteile kommen hinzu,
    // beide in `components/CaptureDraftList.tsx`:
    //
    //     + `LoeschKnopf` — der Papierkorb EINER Entwurfszeile, der die Löschfrage STELLT (er
    //       löscht nicht). Eigene Komponente, weil ihn seit diesem Auftrag ZWEI Flächen zeigen —
    //       der alte Arbeitsraum und die Menüfläche des Editors — und ein zweites Mal geschriebener
    //       Löschknopf genau die Stelle wäre, an der die Rückfrage einmal fehlte.
    //     + `LoeschRueckfrage` — die zwei Knöpfe „Behalten" und „Löschen" derselben Rückfrage, aus
    //       demselben Grund und mit derselben Warnfarbe (AUFTRAG-mega45 Block E).
    //
    // GEGENPROBE dazu, gemessen statt behauptet: mit den beiden Deklarationen kleingeschrieben
    // (`loeschKnopf`, `loeschRueckfrage`) meldet dieser Fall wieder `gemessen: 369 Komponenten` —
    // `alsKomponente` (oben, :453) verlangt einen Großbuchstaben am Namensanfang; die +2 sind damit
    // genau diese zwei Bauteile und kein dritter Fund, der sich hinter derselben Zahl versteckt.
    // Für DIESEN Sammler ändern sie nichts: sie zeigen kein Bild, bieten keine Bildbeschreibung an
    // (kein `ANGEBOT_MUSTER`) und tragen keinen eigenen Titel (kein `documentTitle`-Prop) — sie
    // erscheinen nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben
    // unverändert: `anbieter` 1 und `traeger` 2.
    //
    // JOB 3428 (KI-FREIE-ANWEISUNG): `komponenten` von 371 auf 372 NACHGEZOGEN — am eigenen Lauf
    // dieses Arbeitsbaums gemessen (der Fall meldete `gemessen: 372 Komponenten`), nicht gerechnet.
    // GENAU EIN Bauteil kommt hinzu, in `components/AiAssistBox.tsx`:
    //
    //     + `AiAssistInstructions` — die eigenen Vorlagen und die freie KI-Anweisung. Eigene
    //       Komponente, weil sie seit diesem Auftrag ZWEI Flächen zeigen: der alte Arbeitsraum
    //       (`AiAssistBox`) und das KI-Menü des Standardeditors (`erfassen/Blatt.tsx`). Ein zweites
    //       Mal geschriebenes Vorlagenfeld wäre genau die zweite Vorlagenverwaltung, die der
    //       Auftrag ausdrücklich verbietet.
    //
    // GEGENPROBE dazu, gemessen statt behauptet: mit der Deklaration kleingeschrieben
    // (`aiAssistInstructions`) meldet dieser Fall wieder `gemessen: 371 Komponenten` —
    // `alsKomponente` (oben, :453) verlangt einen Großbuchstaben am Namensanfang; die +1 ist damit
    // genau dieses eine Bauteil und kein zweiter Fund, der sich hinter derselben Zahl versteckt.
    //
    // KONFLIKTRUNDE 1 (JOB 3511 · DEMO-FIRMEN-CI): NACH DEM REBASE auf JOB 3428/KI-FREIE-ANWEISUNG
    // trifft die unabhängige NEUE Fläche DEMO-FIRMEN-CI auf denselben Stand; `komponenten` von 372
    // (nach KI-FREIE-ANWEISUNG, siehe oben) auf 373 NACHGEZOGEN — am eigenen Lauf dieses
    // Arbeitsbaums nach der Konfliktauflösung gemessen, nicht rechnerisch addiert. GENAU EIN
    // Bauteil kommt hinzu: `DemoErscheinungsbild` in `pages/AdminDatenDetails.tsx` — der Abschnitt
    // „Demo-Erscheinungsbild" der Demodaten-Karte (Firmenprofil wählen, Firmen-CI an/aus). Es ist
    // eine eigene Komponente und keine Zeile in `DemodatenDetail`, weil es eine eigene Abfrage samt
    // eigenem Lade-/Fehlerzustand führt (`GET /api/branding` hinter der `Abfragehuelle`);
    // hineingeschrieben teilte es sich den Zustand mit dem Demodaten-Bestand und könnte dessen
    // Fehler nicht mehr von seinem eigenen unterscheiden.
    // GEGENPROBE dazu, gemessen statt behauptet: mit der Deklaration kleingeschrieben
    // (`demoErscheinungsbild`) meldet dieser Fall wieder `gemessen: 372 Komponenten` —
    // `alsKomponente` (oben, :453) verlangt einen Großbuchstaben am Namensanfang; die +1 ist damit
    // genau dieses Bauteil und kein zweiter Fund, der sich hinter derselben Zahl versteckt.
    // Für DIESEN Sammler ändert es nichts: es zeigt kein Bild, bietet keine Bildbeschreibung an
    // (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein `documentTitle`-Prop) — es
    // erscheint nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben
    // unverändert: `anbieter` 1 und `traeger` 2.
    //
    // KONFLIKTRUNDE 3 (JOB 3503 · ENTWUERFE-MENUEPUNKT): NACH DEM REBASE auf JOB 3511/DEMO-FIRMEN-CI
    // trifft die unabhängige NEUE Fläche ENTWUERFE-MENUEPUNKT auf denselben Stand; `komponenten` von
    // 373 (nach DEMO-FIRMEN-CI, siehe oben) auf 374 NACHGEZOGEN — am eigenen Lauf dieses
    // Arbeitsbaums nach der Konfliktauflösung gemessen, nicht rechnerisch addiert. GENAU EIN
    // weiteres Bauteil kommt hinzu:
    //
    //     + `MeineEntwuerfe` (`pages/MeineEntwuerfe.tsx`) — die eigene Übersichtsseite hinter dem
    //       neuen Kopfband-Punkt. Sie ist eine Seite, keine Herauslösung.
    //
    // GEGENPROBE dazu, gemessen statt behauptet: mit der Deklaration kleingeschrieben
    // (`meineEntwuerfe`) meldet dieser Fall wieder `gemessen: 373 Komponenten` — `alsKomponente`
    // (oben, :453) verlangt einen Großbuchstaben am Namensanfang; die +1 ist damit genau dieses
    // Bauteil und kein zweiter Fund, der sich hinter derselben Zahl versteckt.
    // Für DIESEN Sammler ändert sie nichts: sie zeigt kein Bild, bietet keine Bildbeschreibung an
    // (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein `documentTitle`-Prop) — sie
    // erscheint nur in der Grundmenge. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben
    // unverändert: `anbieter` 1 und `traeger` 2.
    //
    // JOB 3525 (CHR-NAVIGATION-SCHMAL): `komponenten` von 374 auf 376 NACHGEZOGEN — am Lauf dieses
    // Arbeitsbaums gemessen (der Fall meldete `gemessen: 376 Komponenten · 1 Anbieter · 2 Traeger`),
    // nicht gerechnet. GENAU ZWEI Bauteile kommen hinzu, beide in `shell/KopfbandPunkte.tsx`:
    //
    //     + `KopfbandPunkt` — EIN Punkt des Kopfbands. Das ist eine HERAUSLÖSUNG, keine neue
    //       Fläche: derselbe Baum stand vorher inline in `KopfbandPunkte`. Er bekam einen Namen,
    //       weil das schmale Band damals dieselben Punkte ein zweites Mal zeigte und eine Abschrift
    //       zwei Orte geschaffen hätte, an denen Aktivregel, Zähler und Fokusring auseinanderlaufen.
    //     + `KopfbandPunkteSchmal` — die Auswahl der Punkte, die auf dem Band 760–899 px oben
    //       stehen blieben. Sie filterte `useSichtbareKopfbandPunkte`, führte also keine zweite
    //       Quelle, und gab `null`, wenn die Rolle keinen davon sehen durfte. (Fort seit JOB 3605,
    //       siehe unten.)
    //
    // Dieselbe Begründung wie oben, und sie trägt hier genauso: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, sind unverändert: `anbieter` 1 und `traeger` 2. Keines der
    // beiden Bauteile bietet eine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und keines trägt
    // einen eigenen Titel (kein `documentTitle`-Prop) — sie erscheinen nur in der Grundmenge.
    //
    // JOB 3605 (ENTWUERFE-MENUEPUNKT OHNE SONDERSTELLUNG): `komponenten` von 376 auf 375
    // ZURÜCKGEZOGEN — wieder am Lauf dieses Arbeitsbaums gemessen (der Fall meldete `gemessen: 375
    // Komponenten · 1 Anbieter · 2 Traeger`), nicht gerechnet. GENAU EINES der zwei oben genannten
    // Bauteile fällt weg: `KopfbandPunkteSchmal`. Pedi hat am 11.09.2026 (über Codex, Nachricht
    // 0bd3a41e) verlangt, „Meine Entwürfe" sei „normaler Teil der gesamten Navigation, keine
    // Sonderstellung"; die schmale Auswahl, die jenes Bauteil war, ist damit ersatzlos fort.
    // `KopfbandPunkt` BLEIBT — es hat weiterhin einen Aufrufer (`KopfbandPunkte`) und trägt die
    // vollständige Regel eines Punktes.
    //
    // Die zwei Zahlen, an denen Stufe 2 hängt, sind auch durch diese Rücknahme unverändert
    // (`anbieter` 1, `traeger` 2): das entfallene Bauteil bot keine Bildbeschreibung an und trug
    // keinen eigenen Titel — es stand nur in der Grundmenge.
    //
    // JOB 3640 (DEMO-FIRMA WAEHLEN): `komponenten` von 375 auf 376 NACHGEZOGEN — am Lauf dieses
    // Arbeitsbaums gemessen (der Fall meldete `gemessen: 376 Komponenten · 1 Anbieter · 2 Traeger ·
    // Grundmenge 475 Quelldateien`), nicht gerechnet. GENAU EIN Bauteil kommt hinzu:
    //
    //     + `VorfuehrrahmenKasten` (`components/ImportExplore.tsx:175`) — die sichtbare Wahl „Für
    //       welche Firma führst du vor?" vor dem Erkunden und, sobald sie gilt, die Leiste mit
    //       Namen, gemessener Seitenzahl und „Rahmen aufheben". Das ist eine NEUE Fläche und keine
    //       Herauslösung: den Begriff „die Firma, für die ich vorführe" gab es im Produkt vorher
    //       nicht, weder als Auswahl noch als Bindung über die Importschritte.
    //
    // GEGENPROBE dazu, gemessen statt behauptet: mit der Deklaration UND ihrer Einbindung
    // kleingeschrieben (`vorfuehrrahmenKasten`) meldet dieser Fall wieder `gemessen: 375
    // Komponenten` und wird gegen den ALTEN Pin grün — `alsKomponente` (oben, :453) verlangt einen
    // Großbuchstaben am Namensanfang; die +1 ist damit genau dieses Bauteil und kein zweiter Fund,
    // der sich hinter derselben Zahl versteckt. Danach hashgleich zurückgenommen
    // (`ImportExplore.tsx` = 7ed00d665daca7737d7a1cbcd44ce6e7338502974a964e186276ad1751287429 vor
    // und nach der Probe).
    //
    // Dieselbe Begründung wie oben, und sie trägt hier genauso: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2. Der Kasten
    // zeigt kein Bild, bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen
    // eigenen Titel (kein `documentTitle`-Prop) — er erscheint nur in der Grundmenge.
    // JOB 3761 (MAN SIEHT DER DEMO AN, DASS SIE DIE DEMO IST): `komponenten` von 376 auf 377
    // NACHGEZOGEN — am Lauf dieses Arbeitsbaums gemessen (der Fall meldete `gemessen: 377
    // Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 476 Quelldateien`), nicht gerechnet. GENAU
    // EIN Bauteil kommt hinzu:
    //
    //     + `DemoKennzeichen` (`auth/BrandPanel.tsx`) — die sichtbare Kennzeichnung „Demo-Instanz"
    //       auf der Anmeldemaske und über dem Kopfband. Eine NEUE Fläche und keine Herauslösung:
    //       die Aussage „diese Instanz ist die Vorführinstanz" gab es im Produkt vorher an keiner
    //       Stelle, weder als Schalter noch als Text.
    //
    // GEGENPROBE dazu, gemessen statt behauptet: mit der Deklaration UND ihren zwei Einbindungen
    // kleingeschrieben (`demoKennzeichen`) meldet dieser Fall wieder `gemessen: 376 Komponenten`
    // und wird gegen den ALTEN Pin grün — `alsKomponente` (oben, :453) verlangt einen
    // Großbuchstaben am Namensanfang; die +1 ist damit genau dieses Bauteil und kein zweiter Fund
    // hinter derselben Zahl. Danach hashgleich zurückgenommen.
    //
    // Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und
    // `traeger` 2. Die Kennzeichnung zeigt kein Bild, bietet keine Bildbeschreibung an (kein
    // `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein `documentTitle`-Prop) — sie erscheint
    // nur in der Grundmenge.
    //
    // JOB 3808 (OHNE NETZ SAGT DIE AUFGABENLISTE NICHT „NICHTS OFFEN."): `komponenten` von 377 auf
    // 378 NACHGEZOGEN — NACH dem Rebase auf JOB 3761 („MAN SIEHT DER DEMO AN …", der Eintrag direkt
    // darüber) am Lauf DIESES Arbeitsbaums gemessen, nicht gerechnet; der wörtliche Fund steht unter
    // PRUEFUNGEN in der Rückgabe. GENAU EIN weiteres Bauteil kommt hinzu, zusätzlich zu
    // `DemoKennzeichen` oben:
    //
    //     + `PausedMarker` (`components/LoadState.tsx:70`) — die Markierung des RUHENDEN Abrufs,
    //       das dritte Bauteil dieser Datei neben `LoadErrorState` und `StaleMarker`. Ohne Netz
    //       gibt es keinen gescheiterten Versuch, den man melden könnte (die Abfrage ruht), und
    //       „Auffrischung fehlgeschlagen" wäre dort die falsche Auskunft. Das ist eine NEUE Lage
    //       und keine Herauslösung: `StaleMarker` bleibt unverändert für seinen Fall (Netz da,
    //       Refetch gescheitert) und behält jeden seiner Aufrufer.
    //
    // GEGENPROBE dazu, gemessen statt behauptet: mit der Deklaration UND ihrer Einbindung
    // kleingeschrieben (`pausedMarker` in `LoadState.tsx` und `pages/MyTasks.tsx`) meldet dieser
    // Fall wieder `gemessen: 377 Komponenten` und wird gegen den NEUEN Pin rot — `alsKomponente`
    // (oben, :453) verlangt einen Großbuchstaben am Namensanfang; die +1 ist damit genau dieses
    // Bauteil und kein zweiter Fund, der sich hinter derselben Zahl versteckt. Danach hashgleich
    // zurückgenommen (`LoadState.tsx` = b161d5d3a967fac638dd0fdcb690fdb4293e8e2c3dd4a7a599d3b0dfba7c81e0,
    // `MyTasks.tsx` = b4ca3b67e58b877160400d9d3cdb7d93214a26c0e57ca94644ce958edb9fc277, je vor und
    // nach der Probe).
    //
    // Dieselbe Begründung wie oben, und sie trägt hier genauso: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2. Die
    // Markierung zeigt kein Bild, bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und
    // trägt keinen eigenen Titel (kein `documentTitle`-Prop) — sie erscheint nur in der Grundmenge.
    //
    // JOB 4025 (KUNDENBETRIEB-BACKUP): `komponenten` von 378 auf 381 NACHGEZOGEN — am Lauf DIESES
    // Arbeitsbaums gemessen, nicht gerechnet (der Sammler meldete `gemessen: 381 Komponenten ·
    // 1 Anbieter · 2 Traeger`); der wörtliche Fund steht unter PRUEFUNGEN in der Rückgabe. Die drei
    // neuen Bauteile stehen zusammen in EINER neuen Datei, `pages/AdminBetriebDetails.tsx` — die
    // Fläche, auf der ein Betreiber ohne Terminal sieht, ob eine Sicherung vorliegt:
    //
    //     + `Eintragszeile` — eine Sicherung als Zeile: Datei, Zeitpunkt, Alter, Größe, Marke.
    //     + `Befund`        — die Weiche zwischen Liste, belegter Negativaussage („keine Sicherung
    //                         im Verzeichnis …") und „nicht feststellbar" mit Grund.
    //     + `SicherungDetail` — die Detailkarte selbst, verdrahtet im Switch von `pages/Admin.tsx`.
    //
    // Es ist eine NEUE Fläche und keine Herauslösung: die Aussage „hier liegt (k)eine Sicherung"
    // gab es im Produkt vorher an keiner Stelle — weder als Route noch als Karte noch als Zeile.
    // Die Auflage verbietet, dass eine UMSTELLUNG die Erhebung verschiebt, nicht, dass der
    // Quellbaum wächst. Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben unverändert:
    // `anbieter` 1 und `traeger` 2. Keines der drei Bauteile zeigt ein Bild, bietet eine
    // Bildbeschreibung an (kein `ANGEBOT_MUSTER`) oder trägt einen eigenen Titel (kein
    // `documentTitle`-Prop) — sie erscheinen nur in der Grundmenge.
    //
    // GEGENPROBE dazu, gemessen statt behauptet: mit allen drei Deklarationen UND ihren
    // Einbindungen kleingeschrieben meldet dieser Fall wieder `gemessen: 378 Komponenten` und wird
    // gegen den NEUEN Pin rot — `alsKomponente` (oben, :453) verlangt einen Großbuchstaben am
    // Namensanfang; die +3 sind damit genau diese drei Bauteile und kein vierter Fund hinter
    // derselben Zahl. Danach hashgleich zurückgenommen.
    //
    // JOB 4086 (SHAREPOINT/ONEDRIVE) NACH DEM REBASE auf JOB 4025 — NACHGEFÜHRT von 381 auf 383.
    // Zwei neue Bauteile, beide unter `components/sharepoint-import/`:
    //
    //     + `SharePointImportBereich` — der Weg auswählen → abrufen → importieren
    //     + `SharePointZugangKarte`   — der Zugangszustand der zweiten Quelle
    //
    // Dieselbe Begründung wie bei den Einträgen darüber, und sie trägt hier genauso: Die Auflage
    // verbietet, dass eine UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst.
    // Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und
    // `traeger` 2. Keines der beiden Bauteile zeigt ein Bild, bietet eine Bildbeschreibung an
    // (kein `ANGEBOT_MUSTER`) oder trägt einen eigenen Titel — sie erscheinen nur in der
    // Grundmenge. Das ist keine Behauptung nebenbei: der Bereich zeigt Dateinamen, Adressen und
    // Stände, und die einzige Bildquelle des Imports (der Bildauszug des Confluence-Snapshots)
    // wird von ihm nicht berührt. Die Rebase-Summe (381 aus JOB 4025 + diese zwei) ist an diesem
    // Arbeitsbaum nach der Konfliktauflösung gemessen, nicht gerechnet.
    //
    // JOB 4154: +8 Komponenten gesamtanweisung/ — NACHGEFÜHRT von 383 auf 391.
    //
    // GEMESSEN, NICHT GERECHNET: die Diagnosezeile dieses Falls nennt die Zahl selbst („gemessen:
    // 391 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 491 Quelldateien"). Sechs neue Dateien
    // unter `apps/web/src/components/gesamtanweisung/` tragen acht Bauteile — `LesestandAnsicht`
    // bringt neben sich die beiden dateilokalen `Menge` und `BausteinZeile` mit:
    //
    //     + `GesamtanweisungSeite`  die Fläche, die den ganzen Weg hält
    //     + `BausteinAufnahme`      Eintrag und Fassung wählen
    //     + `LesestandAnsicht`      (+ `Menge`, + `BausteinZeile`) der Lesestand samt Herkunft
    //     + `VoraussetzungFeld`     die Voraussetzung eines Bausteins
    //     + `VergleichAnsicht`      zwei Stände gegenüberstellen
    //     + `EntscheidungsVorlage`  vorlegen und entscheiden
    //
    // Dieselbe Begründung wie bei den Einträgen darüber, und sie trägt hier genauso: Die Auflage
    // verbietet, dass eine UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst.
    // Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und
    // `traeger` 2. Keines der acht Bauteile zeigt ein Bild, bietet eine Bildbeschreibung an (kein
    // `ANGEBOT_MUSTER`) oder trägt einen eigenen Titel — sie erscheinen nur in der Grundmenge.
    // Das ist keine Behauptung nebenbei: die Fläche zeigt Titel, Fassungsnummern, Herkunftszeilen
    // und Vergleichsbefunde als TEXT; die Abbildungen eines gebundenen Bausteins nennt sie
    // ausschliesslich beim Namen (`ga.baustein.abbildungen`), sie stellt keine dar.
    //
    // JOB 4153 (WG-ANZEIGE) — NACHGEFÜHRT von 391 auf 392: +WissensbeziehungenBereich.tsx.
    // EIN neues Bauteil, `apps/web/src/components/WissensbeziehungenBereich.tsx` — die Anzeige und
    // Pflege der ausdrücklich gesetzten Fachbeziehungen eines Wissenseintrags.
    //
    // Dieselbe Begründung wie bei den Einträgen darüber, und sie trägt hier genauso: die Auflage
    // verbietet, dass eine UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst.
    // Die zwei Zahlen, an denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und
    // `traeger` 2. Und das ist keine Behauptung nebenbei, sondern am Bauteil nachgelesen: es zeigt
    // Titel, Beziehungsart, Richtung, Urheber, Datum und einen Fassungsvermerk — kein Bild, kein
    // `ANGEBOT_MUSTER`, kein `documentTitle`-Prop. Es berührt keinen Bildweg; es erscheint nur in
    // der Grundmenge. Die Rebase-Summe (391 aus JOB 4154 + dieses eine) ist an diesem Arbeitsbaum
    // nach der Konfliktauflösung gemessen, nicht gerechnet.
    //
    // JOB 4145 R2 (WIKI-ORIENTIERUNG) — NACHGEFÜHRT von 392 auf 393. EIN neues Bauteil:
    //
    //     + `Lesegliederung` — die Gliederung des Fließtexts in der Bibliotheks-Lesespalte,
    //                          in `components/bibliothek/BibliothekLesen.tsx` (nicht exportiert,
    //                          genau ein Aufrufer in derselben Datei).
    //
    // Dieselbe Begründung wie bei den Einträgen darüber: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2. Das Bauteil
    // zeigt kein Bild, bietet keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen
    // eigenen Titel (kein `documentTitle`-Prop) — es rendert ein `<nav>` mit Sprungknöpfen, deren
    // Beschriftung der Überschriftentext des Dokuments ist. Es erscheint nur in der Grundmenge.
    // Die Bildergalerie derselben Lesefläche (`BodyImageGallery`) ist unberührt; sie steht
    // weiterhin an ihrem Ort im Fließtext und wird von der Gliederung nicht angefasst.
    //
    // GEGENPROBE dazu, gemessen statt behauptet: mit der Deklaration UND ihrer Einbindung
    // kleingeschrieben meldet dieser Fall wieder `gemessen: 392 Komponenten` und wird gegen den
    // NEUEN Pin rot — `alsKomponente` (oben, :453) verlangt einen Großbuchstaben am
    // Namensanfang; die +1 ist damit genau dieses Bauteil und kein zweiter Fund hinter derselben
    // Zahl. Danach hashgleich zurückgenommen. Die Rebase-Summe (392 aus JOB 4153/4154 + dieses
    // eine aus JOB 4145 R2) ist an diesem Arbeitsbaum nach der Konfliktauflösung gemessen, nicht
    // gerechnet.
    //
    // JOB 4233 (P2-FASSUNG-GESAMTANWEISUNG) — NACHGEFÜHRT von 393 auf 394. EIN neues Bauteil:
    //
    //     + `BausteinText` — der Text der GEBUNDENEN Fassung eines Anweisungsbausteins samt seiner
    //                        Gliederung, in `components/gesamtanweisung/LesestandAnsicht.tsx`
    //                        (nicht exportiert, genau ein Aufrufer in derselben Datei).
    //
    // Dieselbe Begründung wie bei den Einträgen darüber: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2. Das ist am
    // Bauteil nachgelesen und nicht nebenbei behauptet: es zeichnet Rumpf-HTML über `SanitizedHtml`
    // und eine `<nav>`-Gliederung aus den D44-Regeln, es zeigt KEIN Bild, bietet KEINE
    // Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt keinen eigenen Titel (kein
    // `documentTitle`-Prop). Die Abbildungen eines gebundenen Bausteins nennt die Fläche weiterhin
    // ausschliesslich beim Namen (`ga.baustein.abbildungen`) — sie stellt keine dar. Es erscheint
    // nur in der Grundmenge.
    //
    // JOB 4155 R1 (WG-LUECKEN), NACH DEM REBASE auf JOB 4233 — NACHGEFÜHRT von 394 auf 396. ZWEI
    // neue Bauteile:
    //
    //     + `Beziehungsbereich`       — die Hülle, die den `WissensbeziehungenBereich` in die
    //                                   Lesespalte einhängt, in
    //                                   `components/bibliothek/BibliothekLesen.tsx` (nicht
    //                                   exportiert, genau ein Aufrufer in derselben Datei).
    //     + `Verknuepfungsauskunft`   — der Grundsatz „keine Beziehung heisst nicht geprüft" und
    //                                   der Grund einer ausgelassenen Erhebung, in
    //                                   `pages/Wissensnetz.tsx` (nicht exportiert, genau ein
    //                                   Aufrufer in derselben Datei).
    //
    // Dieselbe Begründung wie bei jedem Eintrag darüber: Die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. Die zwei Zahlen, an
    // denen Stufe 2 wirklich hängt, bleiben unverändert: `anbieter` 1 und `traeger` 2. Beide
    // Bauteile zeigen KEIN Bild, bieten keine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und
    // tragen keinen eigenen Titel (kein `documentTitle`-Prop): das eine rendert ein `<div>` um
    // einen vorhandenen Bereich samt einem Wiederholknopf, das andere zwei Sätze. Sie erscheinen
    // nur in der Grundmenge und berühren keinen Bildweg. Die Bildergalerie derselben Lesefläche
    // (`BodyImageGallery`) ist unberührt. Die Rebase-Summe (394 aus JOB 4233 + diese zwei aus JOB
    // 4155 R1) ist an diesem Arbeitsbaum nach der Konfliktauflösung gemessen, nicht gerechnet.
    //
    // JOB 4156 (WIKI-GESAMTANWEISUNG-ANSCHLUSS): 396 → 398, und es sind GENAU ZWEI Bauteile, beide
    // in der neuen Datei `components/gesamtanweisung/GesamtanweisungBereich.tsx`:
    //     + `GesamtanweisungBereich` — die Hülle, die den Bereich in der App verankert; sie liest
    //                                  `:id` aus der Adresse und reicht an die Fläche aus JOB 4154
    //                                  weiter (exportiert, Aufrufer `apps/web/src/routes.tsx`).
    //     + `Einstieg`               — das Formular „Gesamtanweisung anlegen" (nicht exportiert,
    //                                  genau ein Aufrufer in derselben Datei).
    // Dieselbe Begründung wie bei jedem Eintrag darüber: die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. `anbieter` 1 und
    // `traeger` 2 bleiben unverändert, und das ist hier nachgesehen: keines der beiden Bauteile
    // zeigt ein Bild, bietet eine Bildbeschreibung an (kein `ANGEBOT_MUSTER`) oder trägt ein
    // `documentTitle`-Prop — das eine reicht durch, das andere rendert ein Textfeld mit Knopf.
    // Sie erscheinen nur in der Grundmenge und berühren keinen Bildweg.
    //
    // JOB 4293 R3 (JSON-VOLLTEXT-RUNDLAUF · § 9 ZUSTANDSMODELL): 398 → 399, und es ist GENAU EIN
    // Bauteil:
    //     + `ImportStandHinweis` — der Satz über die Aktualität der Prüfliste („Stand von zuletzt —
    //                              die Auffrischung ist gescheitert." und die zwei Geschwister), in
    //                              `pages/Stufe2.tsx` (nicht exportiert, genau ein Aufrufer in
    //                              derselben Datei: die Prüfkarte `ImportKandidatKarte`).
    // Dieselbe Begründung wie bei jedem Eintrag darüber: die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. `anbieter` 1 und
    // `traeger` 2 bleiben unverändert, und das ist am Bauteil nachgelesen, nicht nebenbei
    // behauptet: es rendert ein einziges `<p>` mit einem Satz aus dem Katalog, zeigt KEIN Bild,
    // bietet KEINE Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt kein `documentTitle`-Prop.
    // Es erscheint nur in der Grundmenge und berührt keinen Bildweg. Die +1 ist gemessen (der
    // Sammler meldete `expected { komponenten: 399, … } to deeply equal { komponenten: 398, … }`),
    // nicht gerechnet.
    //
    // JOB 4333 (ENTWURF-MOBIL-DESKTOP-R · Neuladen ohne Netz): 399 → 400, und es ist GENAU EIN
    // Bauteil:
    //     + `OfflineErfassungsTor` — der Zweig des Torwächters, der bei UNBEANTWORTETER
    //                                Sitzungsfrage genau die shell-lose Erfassungsroute `/mobile`
    //                                durchlässt und auf jeder anderen Adresse die Anmeldemaske
    //                                zeigt, in `App.tsx` (nicht exportiert, genau ein Aufrufer in
    //                                derselben Datei: `Gate`).
    // Dieselbe Begründung wie bei jedem Eintrag darüber: die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. `anbieter` 1 und
    // `traeger` 2 bleiben unverändert, und das ist am Bauteil nachgelesen, nicht nebenbei
    // behauptet: es rendert entweder `AuthScreens` oder die durchgereichte Anwendungshülle, zeigt
    // KEIN Bild, bietet KEINE Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt kein
    // `documentTitle`-Prop. Es erscheint nur in der Grundmenge und berührt keinen Bildweg. Die +1
    // ist gemessen (der Sammler meldete `expected { komponenten: 400, … } to deeply equal
    // { komponenten: 399, … }`, Cloud-Lauf ae5de1e1393e48469652e954c74b8e48), nicht gerechnet.
    //
    // JOB 4357 (WIKI-ZUSAMMENARBEIT · die Bestandsliste der Gesamtanweisungen): 400 → 402, und es
    // sind GENAU ZWEI Bauteile, beide in `components/gesamtanweisung/GesamtanweisungBereich.tsx`:
    //     + `Bestandsliste`  — die Liste des gespeicherten Bestands samt ihren vier Anzeigelagen
    //                          (laden · leer · Fehler · Stand), nicht exportiert, genau ein
    //                          Aufrufer in derselben Datei: `Einstieg`.
    //     + `Listeneintrag`  — EINE Zeile der Liste: der Titel als `<Link>` plus vier Absätze
    //                          (Stand, Urheber, letzte Änderung, Bausteinzahl), nicht exportiert,
    //                          genau ein Aufrufer in derselben Datei: `Bestandsliste`.
    // Dieselbe Begründung wie bei jedem Eintrag darüber: die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. `anbieter` 1 und
    // `traeger` 2 bleiben unverändert, und das ist am Bauteil NACHGELESEN und nicht nebenbei
    // behauptet: in der ganzen Datei kommt weder `CAPTION_AI_TEXT` (also kein `ANGEBOT_MUSTER`)
    // noch ein `documentTitle`-Prop noch ein `<img` vor. Die Liste nennt Titel, Stand, Urheber,
    // Änderungszeit und ZWEI ZAHLEN — sie stellt kein Bild dar und trägt keine Bildbeschreibung.
    // Beide Bauteile erscheinen nur in der Grundmenge und berühren keinen Bildweg.
    //
    // DIE +2 IST GEMESSEN, nicht gerechnet: der Sammler meldete im Tor der Runde 2 wörtlich
    // „gemessen: 402 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 493 Quelldateien …
    // expected { komponenten: 402, anbieter: 1, …(1) } to deeply equal { komponenten: 400, … }"
    // (Cloud-Lauf 036e7ef823af315efb46c458). Dass `anbieter` und `traeger` dabei UNVERÄNDERT
    // blieben, steht in derselben Meldung — beide Seiten des Vergleichs nennen 1 und 2.
    //
    // JOB 4363 (H6-D1b · DER STAND DER BEREITSCHAFTSKARTE): 402 → 403, und es ist GENAU EIN
    // Bauteil:
    //     + `Bereitschaftstandhinweis` — die Standzeile der Bereitschaftskarte
    //       (`components/einstellungen/bereitschaftstandhinweis.tsx`), exportiert, genau ein
    //       Aufrufer: `pages/AdminSicherheitDetails.tsx` (`BereitschaftDetail`).
    // Dieselbe Begründung wie bei jedem Eintrag darüber: die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. `anbieter` 1 und
    // `traeger` 2 bleiben unverändert, und das ist an der Datei NACHGELESEN und nicht nebenbei
    // behauptet: sie enthält weder `CAPTION_AI_TEXT` (also kein `ANGEBOT_MUSTER`) noch ein
    // `documentTitle`-Prop noch ein `<img`. Sie rendert eine Statusregion mit Text, einem
    // Warnsymbol aus `lucide-react` und einem Wiederholen-Knopf — kein Bild, keine
    // Bildbeschreibung. Das Bauteil erscheint nur in der Grundmenge und berührt keinen Bildweg.
    //
    // DIE +1 IST GEMESSEN, nicht gerechnet: der Sammler meldete im Tor dieser Runde wörtlich
    // „gemessen: 403 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 494 Quelldateien …
    // expected { komponenten: 403, anbieter: 1, …(1) } to deeply equal { komponenten: 402, … }"
    // (Arbeitsprüfung 624ddc26383645d89df830597f0f6c55). Dass `anbieter` und `traeger` dabei
    // UNVERÄNDERT blieben, steht in derselben Meldung — beide Seiten nennen 1 und 2.
    //
    // WIKI-BEARBEITUNGSRESERVIERUNG: 403 → 405, und es sind GENAU ZWEI Bauteile in EINER Datei
    // (`components/bibliothek/Bearbeitungshinweis.tsx`):
    //     + `Bearbeitungshinweis` — der Hinweis auf eine laufende fremde Bearbeitung und ihr Ende,
    //       exportiert, genau ein Aufrufer: `BibliothekLesen`.
    //     + `LesestandSatz` — der Satz „neu gelesen / Lesen gescheitert", nicht exportiert, genau
    //       ein Aufrufer in derselben Datei.
    // `anbieter` 1 und `traeger` 2 bleiben unverändert, an der Datei NACHGELESEN: sie enthält weder
    // `CAPTION_AI_TEXT` noch ein `documentTitle`-Prop noch ein `<img` — nur Text und Knöpfe.
    //
    // DIE +2 IST GEMESSEN: das Linux-Tor meldete wörtlich „gemessen: 405 Komponenten · 1 Anbieter
    // · 2 Traeger … expected { komponenten: 405, … } to deeply equal { komponenten: 403, … }"
    // (Prüfauftrag lt-1790424665-865dc221).
    //
    // FE-003 (SEITENTUTORIAL „FRAGEN“): 405 → 423. Dazu kommen die Bauteile des neuen Rahmens
    // (`tutorial/TutorialRahmen.tsx`: Provider, Einstieg, Fläche; `tutorial/TutorialBereich.tsx`),
    // die der Demo (`tutorial/fragen/FragenDemo.tsx`: Demo, Übergang, Übung und ihre kleinen
    // Teilflächen) und die aus `pages/Ask.tsx` herausgelösten gemeinsamen Bausteine
    // (`components/fragen/FrageFeld.tsx`, `Quellenplaketten.tsx` mit `QuellenChipInhalt`,
    // `Antwortbausteine.tsx`). `VerwendungsPlakette` und `PruefstandPlakette` sind UMGEZOGEN, nicht
    // neu. Dieselbe Begründung wie darüber: der Quellbaum wächst, die Umstellung verschiebt nichts —
    // `anbieter` 1 und `traeger` 2 bleiben unverändert. Keine der Dateien enthält
    // `CAPTION_AI_TEXT`, ein `documentTitle`-Prop oder ein `<img`; das Tutorial zeigt ausdrücklich
    // keine Bilder (`tests/fe003-tutorial-fragen/aenderungsprobe-mounted.test.tsx`).
    //
    // DIE +18 IST GEMESSEN, nicht gerechnet: der Sammler meldete an diesem Arbeitsbaum wörtlich
    // „gemessen: 423 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 511 Quelldateien …
    // expected { komponenten: 423, … } to deeply equal { komponenten: 405, … }".
    //
    // FE-001 (ARBEITSANLEITUNGEN VERSTÄNDLICH UND BEDIENBAR): 423 → 430 (nach FE-003 darüber), und es sind GENAU SIEBEN
    // Bauteile, alle unter `components/gesamtanweisung/`:
    //     + `KopfBearbeitung` (eigene Datei) — Titel, Zweck, Geltungsbereich, Voraussetzungen
    //     + `Treffer`, `Fassungswahl` (`BausteinAufnahme.tsx`) — Suche und Fassungswahl
    //     + `Dokument`, `Kopfangabe` (`LesestandAnsicht.tsx`) — die Lesefassung als Dokument
    //     + `Standwahl` (`VergleichAnsicht.tsx`) — die Auswahl eines Stands
    //     + `Eintragsliste` (`GesamtanweisungBereich.tsx`) — die Zeilen der Übersicht
    // Dieselbe Begründung wie bei jedem Eintrag darüber: die Auflage verbietet, dass eine
    // UMSTELLUNG die Erhebung verschiebt — nicht, dass der Quellbaum wächst. `anbieter` 1 und
    // `traeger` 2 bleiben unverändert: keine der Dateien enthält `CAPTION_AI_TEXT`, ein
    // `documentTitle`-Prop oder ein `<img`. Die Vorschau der Fassung zeichnet deren Rumpf über
    // `SanitizedHtml` — dasselbe Bauteil wie bisher im Lesestand, kein neuer Bildweg.
    // DIE +7 IST GEMESSEN: im eigenen Lauf 405 → 412 (Cloud-Lauf pa-1790434819-46fe6fb5); nach der
    // Zusammenführung mit FE-003 (423) am zusammengeführten Arbeitsbaum erneut gemessen: 430.
    //
    // Aufnahme gesamt-ki-laufprotokoll (V9, R-2071): 430 → 431. GENAU EIN Bauteil kommt dazu:
    //     + `ModelRunAuswertungCard` (`pages/Stufe2.tsx`) — die KI-Auswertung eines Zeitraums
    // Gemessen: der Sammler meldete „expected { komponenten: 431, … } to deeply equal
    // { komponenten: 430, … }". `anbieter` 1 und `traeger` 2 bleiben: die Karte zeigt kein Bild,
    // keinen `documentTitle` und kein `CAPTION_AI_TEXT`.
    //
    // FE-002 (HEADER TEIL 1 · FUNKTIONEN FINDEN): 431 → 436 (zusammengeführt nach dem KI-Laufprotokoll
    // darüber). Es sind GENAU FÜNF Bauteile der Kopfbandhülle, in anderen Dateien als die darüber:
    //     + `ArbeitsbereicheEintraege`, `ArbeitsbereicheMenue` (`shell/ArbeitsbereicheMenue.tsx`)
    //     + `MeldungenMenue`, `MeldungenUndKonto` (`shell/MeldungenMenue.tsx`)
    //     + `MeldungenListe` (`shell/Meldungen.tsx`, aus `Meldungen` herausgelöst)
    // Keines enthält `CAPTION_AI_TEXT`, ein `documentTitle`-Prop oder ein `<img` — Menüs,
    // Glocke und Meldungsliste, kein Bildweg. `anbieter` 1 und `traeger` 2 bleiben unverändert.
    // Die spätere Lagekorrektur `useImFenster` (`shell/Menue.tsx`) ist ein Hook, kein Bauteil.
    // GEMESSEN war die FE-002-Stufe auf dem Stand vor dem KI-Laufprotokoll: 430 → 435 (Serverlauf
    // `header-gezielt` am Kandidaten a3116cac, Sammler grün).
    //
    // DIE 437 IST GEMESSEN, nicht gerechnet: am zusammengeführten Kandidaten c5560a74 meldete der
    // Sammler wörtlich „gemessen: 437 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 536
    // Quelldateien … expected { komponenten: 437, … } to deeply equal { komponenten: 436, … }".
    // Gerechnet waren 431 + 5 = 436. Die eine Komponente mehr stammt NICHT aus FE-002: seit der
    // Messung 435 kamen dort nur ein Hook (`useImFenster`, kleingeschrieben, vom Sammler nicht
    // gezählt) und Attribute dazu. Sie kam mit dem eingemischten Hauptstand; welches Bauteil es ist,
    // ist an diesem Arbeitsbaum ohne Git-Verlauf nicht namentlich bestimmt. `anbieter` 1 und
    // `traeger` 2 sind in derselben Meldung unverändert.
    //
    // PRÜFSTATUS-ANZEIGE (Pedi 28.09.2026, Ergänzung 3): GENAU EIN Bauteil zusätzlich:
    //     + `FreigabeStatus` (`components/gesamtanweisung/EntscheidungsVorlage.tsx`) — der eine
    //       Statusblock für Übersicht und Detailansicht der Arbeitsanleitungen.
    // Kein Bild, kein `CAPTION_AI_TEXT`, kein `documentTitle`: `anbieter` 1 und `traeger` 2 bleiben.
    // Auf dem eigenen Stand GEMESSEN: 430 → 431 („gemessen: 431 Komponenten · 1 Anbieter · 2 Traeger
    // · Grundmenge 527 Quelldateien"). Nach der Zusammenführung mit dem Hauptstand (437) waren
    // 437 + 1 = 438 nur GERECHNET.
    //
    // DIE 444 IST GEMESSEN, nicht gerechnet: am zusammengeführten Kandidaten 4be0477f meldete der
    // Sammler wörtlich „gemessen: 444 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 546
    // Quelldateien … expected { komponenten: 444, … } to deeply equal { komponenten: 438, … }".
    // Die sechs Komponenten über 438 kamen mit dem erneut eingemischten Hauptstand (Grundmenge
    // 536 → 546 Quelldateien); die Prüfstatus-Anzeige fügt seit `FreigabeStatus` kein Bauteil
    // hinzu. Welche es sind, ist an diesem Arbeitsbaum ohne Git-Verlauf nicht namentlich bestimmt.
    // `anbieter` 1 und `traeger` 2 sind in derselben Meldung unverändert.
    //
    // DIE 447 IST GEMESSEN, nicht gerechnet: am Kandidaten 903b2a22 meldete der Sammler wörtlich
    // „gemessen: 447 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 549 Quelldateien … expected
    // { komponenten: 447, … } to deeply equal { komponenten: 444, … }". Die Nacharbeit zwischen
    // 4be0477f und 903b2a22 änderte im Produktcode nichts (nur Test-Gegenprobe und Sollwert); die
    // drei Komponenten mehr kamen mit dem Hauptstand (Grundmenge 546 → 549). Welche es sind, ist
    // auch hier ohne Git-Verlauf nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 bleiben.
    //
    // Folgeauftrag gesamt-erstnutzerfuehrung-quellen (R-0928/R-1675), Integration mit diesem
    // Hauptstand: 447 → 448. GENAU EIN Bauteil kommt dazu, das main noch nicht trägt:
    //     + `Einstieg` (`pages/Einstieg.tsx`) — die kurze thematische Einstiegsansicht
    // Kein Bild, kein `documentTitle`, kein `CAPTION_AI_TEXT`; `anbieter` 1 und `traeger` 2 bleiben.
    // Auf dem eigenen Stand war die Zahl GEMESSEN 444 (Kandidat 3874b441; 437 + 6 aus `a2ff8da8`
    // — `ProfilZeile`, `RuhestandZeile`, `BereichsprofilPflege`, `Bereich`, `RisikoHorizont`,
    // `WissensPriorisierung` — + 1 `Einstieg`). Diese sechs stecken in den 447 von main schon drin.
    // EHRLICH GESAGT: die 448 ist bei der Konfliktauflösung GERECHNET (447 + 1), nicht gemessen;
    // weicht der Prüflauf ab, nennt die Meldung oben die gemessene Zahl, und DIE gehört hier hin.
    //
    // Nacharbeit 15: GEMESSEN 451. Am Kandidaten 95636768 meldete der Sammler wörtlich „gemessen:
    // 451 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 559 Quelldateien … expected
    // { komponenten: 451, … } to deeply equal { komponenten: 448, … }". Dieser Auftrag trägt genau
    // EIN Bauteil (`Einstieg`) und zwei Quelldateien (`pages/Einstieg.tsx`, `lib/einstiege.ts`) bei;
    // die drei Komponenten über 448 kamen mit dem erneut eingemischten Hauptstand (Grundmenge
    // 549 → 559, davon 2 aus diesem Auftrag). Welche es sind, ist ohne Git-Verlauf an diesem
    // Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // Aufnahme gesamt-bildbeschreibung-bedienung, Nacharbeit 1: GEMESSEN 470. Am Kandidaten
    // a400f78b meldete der Sammler wörtlich „gemessen: 470 Komponenten · 1 Anbieter · 2 Traeger ·
    // Grundmenge 588 Quelldateien … expected { komponenten: 470, … } to deeply equal
    // { komponenten: 451, … }". Dieser Auftrag trägt KEIN Bauteil bei: er ändert in
    // `BodyImageGallery.tsx` nur Zustand und Markup der vorhandenen Großansicht (Ladezustand,
    // R-0899) und legt das Textmodul `texte/bildergalerie.ts` an — reine Daten, keine Komponente.
    // Die 19 Komponenten über 451 kamen mit dem Hauptstand (Basis 863a0974). Welche es sind, ist
    // an diesem Arbeitsbaum ohne Git-Verlauf nicht namentlich bestimmt. `anbieter` 1 und `traeger`
    // 2 sind in derselben Meldung unverändert — eine neue Bildbeschreibungsfläche ist NICHT
    // hinzugekommen (bens Bedingung an I44 bleibt gewahrt).
    //
    // Nacharbeit 2 desselben Auftrags: GEMESSEN 480. Am Kandidaten 515abd35 meldete der Sammler
    // wörtlich „gemessen: 480 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 596 Quelldateien …
    // expected { komponenten: 480, … } to deeply equal { komponenten: 470, … }". Zwischen a400f78b
    // und 515abd35 änderte dieser Auftrag NUR Testdateien (diesen Sollwert und die Ausnahmeliste in
    // `tests/legal/mega61-rechtsseiten.test.tsx`), keine Quelldatei der Grundmenge. Die 10
    // Komponenten über 470 kamen mit dem erneut eingemischten Hauptstand (Grundmenge 588 → 596).
    // Welche es sind, ist ohne Git-Verlauf an diesem Arbeitsbaum nicht namentlich bestimmt.
    // `anbieter` 1 und `traeger` 2 sind in derselben Meldung unverändert.
    //
    // Aufnahme gesamt-ki-kennzeichnung (R-0603/R-0604): 451 → 452. GENAU EIN Bauteil kommt dazu:
    //     + `AiSurfaceNotice` (`components/AiGeneratedNotice.tsx`) — der dauerhafte Flächensatz
    //       „hier kann eine KI mitarbeiten" an Auslösern und auf der Fragenseite.
    // Es rendert ein einziges `<span>` mit einem Katalogsatz, zeigt KEIN Bild, bietet KEINE
    // Bildbeschreibung an (kein `ANGEBOT_MUSTER`) und trägt kein `documentTitle`-Prop — nur
    // Grundmenge. In `RichTextEditor.tsx` (schon Träger) wird lediglich ein vorhandenes Bauteil
    // zusätzlich eingesetzt.
    //
    // NACHARBEIT 1 · GEMESSEN 488. Die oben gerechnete 452 war falsch, weil sie den erneut
    // eingemischten Hauptstand nicht kannte. Am Kandidaten 7b7d9a0e meldete der Sammler wörtlich
    // „gemessen: 488 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 608 Quelldateien …
    // expected { komponenten: 488, … } to deeply equal { komponenten: 452, … }"
    // (HISTORIE/nacharbeit-1/PRUEFUNG/betroffene-bestandswaechter.log). Davon ist GENAU EIN Bauteil
    // aus diesem Auftrag (`AiSurfaceNotice`); die 36 über 452 kamen mit dem Hauptstand (Grundmenge
    // 559 → 608, keine Quelldatei aus diesem Auftrag — der Hauptstand selbst führt hier noch 451).
    // Welche es sind, ist ohne Lauf am Hauptstand nicht namentlich bestimmt. `anbieter` 1 und
    // `traeger` 2 sind unverändert — beide Seiten der Meldung nennen 1 und 2.
    //
    // NACHARBEIT 2 (Ben: R-1020 / R-1695): 488 → 489, GERECHNET, nicht gemessen — die Hand startet
    // keine Tests. GENAU EIN Bauteil kommt dazu: `ErgebnisStufeMarke`
    // (`components/trust/ErgebnisStufeMarke.tsx`), die Marke Entwurf/Empfehlung/validiert. Sie
    // rendert ein `<span>` mit Katalogtext, zeigt KEIN Bild, bietet KEINE Bildbeschreibung an (kein
    // `ANGEBOT_MUSTER`) und trägt kein `documentTitle`-Prop — nur Grundmenge. Die übrigen neuen
    // Dateien (`lib/kiHerkunft.ts`, `lib/antwortDateien.ts`, `components/fragen/antwortMenue.ts`)
    // bringen keine Komponente mit. Weicht die Messung ab, gilt der gemessene Wert samt Herkunft.
    // (489 ist am Kandidaten 2215c220 GEMESSEN bestätigt — nacharbeit-2-sammler-und-texte grün.)
    //
    //
    // Aus dem Hauptstand (Auftrag gesamt-hilfen), dort gegen 451 gerechnet:
    // Aufnahme gesamt-hilfen, Nacharbeit 5 (R-0443): 451 → 452. GENAU EIN Bauteil kommt dazu:
    //     + `Arbeitsweise` (`pages/Arbeitsweise.tsx`) — die eigene Seite „So arbeitet Klarwerk“
    // Kein Bild, kein `documentTitle`, kein `CAPTION_AI_TEXT`; sie verwendet die vorhandene Sicht
    // `SoArbeitetKlarwerk` wieder (dort nur ein optionaler Schalter, kein neues Bauteil).
    // `anbieter` 1 und `traeger` 2 bleiben. EHRLICH GESAGT: die 452 ist GERECHNET (451 + 1), nicht
    // gemessen; weicht der Prüflauf ab, nennt die Meldung oben die gemessene Zahl.
    //
    // Nacharbeit 6: GEMESSEN 495. Am Kandidaten 33aad029 meldete der Sammler wörtlich „gemessen:
    // 495 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 621 Quelldateien … expected
    // { komponenten: 495, … } to deeply equal { komponenten: 452, … }". Dieser Auftrag trägt genau
    // EIN Bauteil (`Arbeitsweise`) bei; die 43 Komponenten über 452 kamen mit dem eingemischten
    // Hauptstand (Grundmenge 559 → 621; aus diesem Auftrag `pages/Arbeitsweise.tsx`,
    // `texte/arbeitsweise.ts`). Welche es sind, ist ohne Git-Verlauf an diesem Arbeitsbaum nicht
    // namentlich bestimmt. Die danach ergänzte `lib/klaraBibliothek.ts` enthält kein Bauteil (nur
    // die Funktion `allBibliothekEntries`). `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // Aus dem Hauptstand (Auftrag PLAN-SPRACHANMERKUNG), dort gegen 451 gerechnet:
    // PLAN-SPRACHANMERKUNG (R-1625, R-2177): 451 → 452. GENAU EIN Bauteil kommt dazu:
    //     + `Zeichnung` (`components/bibliothek/Zeichnung.tsx`) — die Zeichnung einer Rückfrage
    //       mit ihrer Marke; antippbar beim Schreiben, nur lesend am gespeicherten Beitrag.
    // Sie zeigt ein Bild aus dem Inhalt, bietet aber keine Bildbeschreibung an (kein
    // `CAPTION_AI_TEXT`) und trägt keinen eigenen Titel (kein `documentTitle`-Prop): `anbieter` 1
    // und `traeger` 2 bleiben. EHRLICH GESAGT: die 452 ist GERECHNET (451 + 1) — dieser Auftrag
    // durfte keinen Testlauf selbst starten; weicht der Prüflauf ab, gehört die gemessene Zahl hin.
    // NACHARBEIT 2 (BEN: CAD-/PDF-Arbeitsweg): 452 → 453, GENAU EIN Bauteil mehr:
    //     + `AnhangZeichnung` (`components/bibliothek/AnhangZeichnung.tsx`) — die hochgeladene
    //       Zeichnung (PDF-Seite, DXF, Bild) mit Seitenwahl, gereicht an `Zeichnung`.
    // Kein `CAPTION_AI_TEXT`, kein `documentTitle`. Ebenfalls GERECHNET (452 + 1). Hinweis: der
    // Prüflauf von nacharbeit-1 mass 494 am integrierten Stand — die Abweichung über diese eine
    // Komponente hinaus stammt aus fremden Lieferungen und ist hier nicht nachgezogen.
    //
    // ZUSAMMENFÜHRUNG (Aufnahme gesamt-bildbeschreibung-bedienung, Nacharbeit 5, Kandidat
    // 48fcaba0 mit main fadddf37): Die beiden Zweige standen auf verschiedenen Zahlen — hier GEMESSEN
    // 480 (Kandidat 515abd35, ohne `Zeichnung`/`AnhangZeichnung`), auf main GERECHNET 453 bei
    // GEMESSENEN 494 am integrierten Stand der Sprachanmerkung. Im zusammengeführten Baum liegen
    // beide Bauteile (`components/bibliothek/Zeichnung.tsx`, `AnhangZeichnung.tsx`); dieser Auftrag
    // trägt weiterhin KEINE Komponente bei. Eingesetzt ist deshalb die einzige an einem Stand MIT
    // diesen Bauteilen gemessene Zahl, 494. EHRLICH GESAGT: an DIESEM Kandidaten ist sie nicht
    // gemessen — ob in den 494 `AnhangZeichnung` schon enthalten war, sagt die Quelle nicht. Weicht
    // der Prüflauf ab, nennt die Meldung oben die gemessene Zahl, und DIE gehört hier hin.
    // `anbieter` 1 und `traeger` 2 sind in beiden Zweigen gleich und bleiben exakt geprüft.
    //
    // Nacharbeit 6: GEMESSEN 512 — die 494 der Zusammenführung waren übernommen, nicht gemessen.
    // Am zusammengeführten Kandidaten 2100605a meldete der Sammler wörtlich „gemessen: 512
    // Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 644 Quelldateien … expected
    // { komponenten: 512, … } to deeply equal { komponenten: 494, … }"; die übrigen 43 Fälle der
    // Datei waren grün. Seit der Zusammenführung änderte dieser Auftrag nur diesen Sollwert; die
    // Komponenten über 480 kamen mit main (Grundmenge 596 → 644). Welche es außer `Zeichnung` und
    // `AnhangZeichnung` sind, ist ohne Git-Verlauf nicht namentlich bestimmt. `anbieter` 1 und
    // `traeger` 2 sind in derselben Meldung unverändert — keine neue Bildbeschreibungsfläche.
    //
    // Nacharbeit 8: GEMESSEN 513. Am Kandidaten 85661d72 meldete der Sammler wörtlich „gemessen: 513
    // Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 647 Quelldateien … expected
    // { komponenten: 513, … } to deeply equal { komponenten: 512, … }"; die übrigen 43 Fälle grün.
    // Seit 2100605a änderte dieser Auftrag nur diesen Sollwert (eine Testdatei, keine Quelldatei der
    // Grundmenge); die eine Komponente kam mit main (Grundmenge 644 → 647), namentlich ohne
    // Git-Verlauf nicht bestimmt. `anbieter` 1 und `traeger` 2 unverändert.
    //
    // INTEGRATION (Aufnahme gesamt-ki-kennzeichnung, Nacharbeit 8): beide Zählreihen treffen sich.
    // Ausgangspunkt ist die GEMESSENE 489 (Kandidat 2215c220, Hauptstand dc8fadeda). Seither bringt
    // der Hauptstand bis 4878a322 laut Diff 26 Komponentendeklarationen in `.tsx` mit und entfernt
    // keine — darunter `Zeichnung` und `AnhangZeichnung` aus dem Absatz darüber, dazu u. a.
    // `FragekontextWahl`, `KlaraVorschau`, `NichtHilfreichKarte`, `GeltungFeld`, `ExternStatus`.
    // 489 + 26 = 515. EHRLICH GESAGT: GERECHNET über ein Diff-Muster, nicht gemessen — die Hand
    // startet keine Tests. Weicht der Prüflauf ab, nennt die Meldung die gemessene Zahl; die gehört
    // dann hierher. `anbieter` 1 und `traeger` 2 bleiben in beiden Reihen unverändert.
    //
    // Aus dem Hauptstand (gesamt-hilfen), gemessen ohne die Bauteile dieses Auftrags:
    // ZUSAMMENFÜHRUNG beider Stände (gesamt-hilfen Nacharbeit 11, Kandidat 96b9e3a0): 497.
    // Grundlage ist die GEMESSENE 495 von gesamt-hilfen (Kandidat 33aad029; sie enthält
    // `Arbeitsweise` und den Hauptstand von damals, der hier noch 451 trug — `Zeichnung` und
    // `AnhangZeichnung` waren darin also noch nicht enthalten). Dazu die zwei Bauteile der
    // Plan-Sprachanmerkung: 495 + 2 = 497. EHRLICH GESAGT: GERECHNET, nicht gemessen; was der
    // Hauptstand seit 33aad029 sonst an Bauteilen gebracht hat, ist darin nicht enthalten. Weicht
    // der Prüflauf ab, gehört die gemessene Zahl hierher. `anbieter` 1 und `traeger` 2 bleiben.
    //
    // gesamt-hilfen Nacharbeit 12: GEMESSEN 515. Am Kandidaten 01c730f4 meldete der Sammler
    // wörtlich „gemessen: 515 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 657 Quelldateien …
    // expected { komponenten: 515, … } to deeply equal { komponenten: 497, … }". Seit der Messung 495
    // (33aad029, Grundmenge 621) hat gesamt-hilfen KEIN Bauteil hinzugefügt: dazugekommen sind
    // nur `lib/klaraBibliothek.ts` (Funktionen, kein Bauteil) und ein Testfall. Die 20 Komponenten
    // über 495 kommen also aus dem eingemischten Hauptstand (Grundmenge 621 → 657), darunter laut
    // Kommentar oben `Zeichnung` und `AnhangZeichnung`. Die übrigen 18 sind ohne Git-Verlauf an
    // diesem Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // ZUSAMMENFÜHRUNG (gesamt-bildbeschreibung-bedienung Nacharbeit 12, Kandidat 5613867b mit main
    // bc2b75e7): hier GEMESSEN 513 (85661d72, Grundmenge 647), auf main GEMESSEN 515 (01c730f4,
    // Grundmenge 657, samt `Arbeitsweise`, `Zeichnung`, `AnhangZeichnung`). Dieser Auftrag trägt
    // KEIN Bauteil bei — seine Quellbeiträge sind `BodyImageGallery.tsx` (Zustand/Markup der
    // vorhandenen Großansicht) und das Datenmodul `texte/bildergalerie.ts`. Die erwartete Zahl ist
    // deshalb die von main: 515. EHRLICH GESAGT: an DIESEM Kandidaten nicht gemessen; hat main seit
    // 01c730f4 weitere Bauteile gebracht, nennt die Meldung oben die gemessene Zahl, und DIE gehört
    // hierher. `anbieter` 1 und `traeger` 2 sind auf beiden Seiten gleich und bleiben exakt geprüft.
    //
    // Nacharbeit 13: GEMESSEN 522. Am zusammengeführten Kandidaten 58bf2cb0 meldete der Sammler
    // wörtlich „gemessen: 522 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 671 Quelldateien …
    // expected { komponenten: 522, … } to deeply equal { komponenten: 515, … }"; die übrigen 43
    // Fälle der Datei grün. Dieser Auftrag hat seit der Zusammenführung nur diesen Sollwert geändert;
    // die 7 Komponenten über 515 kamen mit main (Grundmenge 657 → 671), namentlich ohne Git-Verlauf
    // nicht bestimmt. `anbieter` 1 und `traeger` 2 unverändert — keine neue Bildbeschreibungsfläche.
    //
    // AUFNAHME 20260922 · GESAMT-NAVIGATION, Nacharbeit 7: GEMESSEN 523. Am Kandidaten 35d8b164
    // meldete der Sammler wörtlich „gemessen: 523 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge
    // 670 Quelldateien … expected { komponenten: 523, … } to deeply equal { komponenten: 515, … }".
    // Seit dem letzten Stand dieser Zahl (df501851) kamen 13 Quelldateien dazu (657 → 670, per
    // `git diff --diff-filter=A` bestimmt). Dieser Auftrag trägt GENAU EIN Bauteil bei:
    //     + `WeiterUntenHinweis` (`shell/WeiterUnten.tsx`) — „Weitere Einträge unten" am Rand des
    //       Drawers und der Übersicht „Arbeitsbereiche" (R-1045)
    // (`texte/navigation.ts` ist ein Textmodul ohne Bauteil; die Entlastungsschalter in `Help.tsx`,
    // `Risk.tsx` und `BibliothekFlaeche.tsx` stehen inline, ohne neues Bauteil). Die übrigen 7 kamen
    // mit dem eingemischten Hauptstand, aus den dort neuen Dateien
    // `components/LueckenAnsprechpartner.tsx`, `components/VerantwortungUebergabe.tsx` und
    // `components/wissensauskunft/WissensauskunftBereich.tsx`; einzeln gezählt ist das ohne Lauf
    // nicht. Kein Bauteil bietet eine Bildbeschreibung an oder trägt `documentTitle`:
    // `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // ADMIN-01 (produkt:20261009:admin-verwaltung-uebersicht): 515 → 516. GENAU EIN Bauteil kommt
    // dazu:
    //     + `AdminUebersicht` (`pages/AdminUebersicht.tsx`) — die Startseite der Verwaltung mit
    //       Aufgabenzählern und den sieben fachlichen Gruppen.
    // Ihre Zeilenhelfer (`verweis`, `zielZeile`) sind kleingeschrieben und keine Bauteile. Sie
    // zeigt kein Bild, bietet keine Bildbeschreibung an (kein `CAPTION_AI_TEXT`) und trägt keinen
    // eigenen Titel (kein `documentTitle`-Prop): `anbieter` 1 und `traeger` 2 bleiben. EHRLICH
    // GESAGT: GERECHNET (515 + 1) — dieser Auftrag durfte keinen Testlauf selbst starten; weicht der
    // Prüflauf ab, gehört die gemessene Zahl hierher.
    //
    // ADMIN-01 Nacharbeit 1: GEMESSEN 530. Der Prüflauf am Kandidaten a9b11511 meldete wörtlich
    // „gemessen: 530 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 681 Quelldateien". Die
    // Grundmenge wuchs gegenüber der Messung 515 (657 Dateien) um 24 Quelldateien aus dem
    // eingemischten Hauptstand; ADMIN-01 trägt davon genau EIN Bauteil (`AdminUebersicht`). Die
    // übrigen 14 sind ohne Git-Verlauf an diesem Arbeitsbaum nicht namentlich bestimmt.
    // `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // INTEGRATION (Aufnahme gesamt-ki-kennzeichnung, Nacharbeit 9): Die 515 von gesamt-hilfen ist
    // GEMESSEN (Kandidat 01c730f4) — ohne die Bauteile dieses Auftrags; meine gerechnete 515 aus
    // Nacharbeit 8 kam auf dieselbe Zahl, aber über einen anderen Stand. Der Zusammenschluss:
    //     515  gemessen am Hauptstand-Stand 01c730f4
    //   +   2  seither im Hauptstand bis 1139536b: `Antwort`, `WissensauskunftBereich`
    //          (Diff 01c730f4..1139536b, keine entfernte Komponentendeklaration)
    //   +   2  dieser Auftrag, im Hauptstand nicht enthalten: `AiSurfaceNotice`, `ErgebnisStufeMarke`
    //   = 519. EHRLICH GESAGT: GERECHNET, nicht gemessen — die Hand startet keine Tests. Weicht der
    // Prüflauf ab, nennt die Meldung die gemessene Zahl; die gehört dann hierher.
    //
    // NACHARBEIT 10 · GEMESSEN 522. Am Kandidaten 46e7f627 meldete der Sammler wörtlich „gemessen:
    // 522 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 669 Quelldateien … expected
    // { komponenten: 522, … } to deeply equal { komponenten: 519, … }"
    // (HISTORIE/nacharbeit-10/PRUEFUNG/nacharbeit-9-komponentensammler.log). Die Rechnung 519 war
    // für ihren Stand richtig; danach wurde der Hauptstand 15102c19d eingemischt, und der bringt
    // laut Diff 1139536b..15102c19d genau DREI Komponenten mit: `LueckenAnsprechpartner`,
    // `Vorschlagsliste`, `Vorschlag` — keine entfernt. 519 + 3 = 522 deckt sich mit der Messung.
    // `anbieter` 1 und `traeger` 2 sind unverändert — beide Seiten der Meldung nennen 1 und 2.
    //
    // NACHARBEIT 11 · GEMESSEN 524. Am Kandidaten 54b5f032 meldete der Sammler wörtlich „gemessen:
    // 524 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 672 Quelldateien … expected
    // { komponenten: 524, … } to deeply equal { komponenten: 522, … }"
    // (HISTORIE/nacharbeit-11/PRUEFUNG/nacharbeit-10-komponentensammler.log). Erneut kam ein
    // Hauptstand dazu (13bf9f2bd); laut Diff 15102c19d..13bf9f2bd bringt er genau ZWEI Komponenten
    // mit — `VerantwortungUebergabe`, `Arbeitsflaeche` — und entfernt keine. 522 + 2 = 524 deckt
    // sich mit der Messung. Dieser Auftrag hat seit Nacharbeit 2 kein Bauteil hinzugefügt.
    //
    // NACHARBEIT 13 (Integration Hauptstand 1322621a): laut Diff 13bf9f2bd..1322621a bringt der
    // Hauptstand SIEBEN Komponentendeklarationen mit und entfernt keine — `GeteilterStandNachlader`,
    // `FundZeile`, `Eintrag`, `Bedingungswechsel`, `UebergabeVorschauInhalt`, `Wissensuebergabe`,
    // `Verantwortung`. 524 + 7 = 531. EHRLICH GESAGT: GERECHNET, nicht gemessen (dasselbe
    // Diff-Muster lag in Nacharbeit 10 und 11 jeweils genau auf der Messung). Weicht der Prüflauf
    // ab, nennt die Meldung die gemessene Zahl; die gehört dann hierher.
    //
    // ZUSAMMENFÜHRUNG (Aufnahme 20260922 · gesamt-navigation, Nacharbeit 11 — Integration mit main
    // 8f83f8ad): beide Zweige haben diese Zahl unabhängig fortgeschrieben. Die 523 der
    // Gesamt-Navigation enthielt 7 Hauptstand-Bauteile (u. a. `LueckenAnsprechpartner`,
    // `VerantwortungUebergabe`, `WissensauskunftBereich`), die in den 531 des Hauptstands schon
    // gezählt sind. Der Diff des zusammengeführten Baums gegen 8f83f8ad unterscheidet sich in
    // GENAU EINER Komponentendeklaration: `WeiterUntenHinweis` (`shell/WeiterUnten.tsx`), im
    // Hauptstand nicht vorhanden. 531 + 1 = 532. EHRLICH GESAGT: GERECHNET, nicht gemessen (die 531
    // ist ihrerseits gerechnet). Weicht der Prüflauf ab, gehört die gemessene Zahl hierher.
    // `anbieter` 1 und `traeger` 2 bleiben.
    //
    // ZUSAMMENFÜHRUNG ADMIN-01 × Hauptstand 8f83f8ad (ADMIN-01 Nacharbeit 5): beide Reihen zählen
    // auf DIESELBE Basis 529 (Hauptstand 1322621a). ADMIN-01 hat dort GEMESSEN 530 = 529 + 1
    // (`AdminUebersicht`); der Hauptstand rechnet 531 = 529 + 2 (`AiSurfaceNotice`,
    // `ErgebnisStufeMarke`). Zusammen: 529 + 1 + 2 = 532. EHRLICH GESAGT: GERECHNET, nicht
    // gemessen; weicht der Prüflauf ab, gehört die gemessene Zahl hierher.
    //
    // Aus dem Auftragszweig produkt:20261007:veroeffentlichungsoptionen, dort gegen 451 gerechnet:
    // GENAU EIN Bauteil kommt dazu:
    //     + `VeroeffentlichungBereich` (`components/veroeffentlichung/VeroeffentlichungBereich.tsx`)
    //       — Stand, Meldungswahl und Wirkung der Veröffentlichung, exportiert, genau ein Aufrufer:
    //       `BibliothekLesen`.
    // Kein Bild, kein `documentTitle`, kein `CAPTION_AI_TEXT` — nur Text, Auswahlfelder und ein
    // Knopf; `anbieter` 1 und `traeger` 2 bleiben. Auf dem eigenen Stand GEMESSEN 488 (Kandidat
    // 6e70163d, Hauptstand c62a9855: „gemessen: 488 Komponenten · 1 Anbieter · 2 Traeger ·
    // Grundmenge 610 Quelldateien"); davon EIN Bauteil aus diesem Auftrag.
    //
    // ZUSAMMENFÜHRUNG veroeffentlichungsoptionen × Hauptstand fb1b3cae (Nacharbeit 4): der
    // Hauptstand führt 532 ohne `VeroeffentlichungBereich`; mit ihm 532 + 1 = 533. EHRLICH GESAGT:
    // GERECHNET, nicht gemessen — weicht der Prüflauf ab, gehört die gemessene Zahl hierher.
    //
    // veroeffentlichungsoptionen Nacharbeit 6: GEMESSEN 541. Am Kandidaten 17e4dc5c (nach dem
    // Einmischen von main 5ed2ded3) meldete der Sammler wörtlich „gemessen: 541 Komponenten ·
    // 1 Anbieter · 2 Traeger · Grundmenge 693 Quelldateien … expected { komponenten: 541, … } to
    // deeply equal { komponenten: 533, … }". Dieser Auftrag trägt seit der 533 kein weiteres
    // Bauteil bei; die 8 darüber kamen mit dem eingemischten Hauptstand. Welche es sind, ist ohne
    // Git-Verlauf an diesem Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2
    // sind in derselben Meldung unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 7: GEMESSEN 521. Am Kandidaten c48626a7 meldete der
    // Sammler wörtlich „gemessen: 521 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 675
    // Quelldateien … expected { komponenten: 521, … } to deeply equal { komponenten: 541, … }".
    // Die Grundmenge ist gegenüber der Messung 541 (693 Quelldateien) um 18 Dateien KLEINER: dieser
    // Kandidat steht auf einer anderen Basis des Hauptstands. Dieser Auftrag hat nichts entfernt —
    // `VeroeffentlichungBereich` steht unverändert in `components/veroeffentlichung/` und wird von
    // `BibliothekLesen` eingebunden. Welche 20 Komponenten am Basisstand fehlen, ist ohne Git-Verlauf
    // an diesem Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // Aus dem Hauptstand (gesamt-bildbeschreibung-bedienung), gemessen ohne `VeroeffentlichungBereich`:
    // ZUSAMMENFÜHRUNG (gesamt-bildbeschreibung-bedienung Nacharbeit 16, Kandidat 2827fbda mit main
    // 5ed2ded3): hier GEMESSEN 522 (58bf2cb0, Grundmenge 671), auf main GERECHNET 532 für den
    // vollen Hauptstand samt `AdminUebersicht`, `AiSurfaceNotice`, `ErgebnisStufeMarke`. Dieser
    // Auftrag trägt KEIN Bauteil bei (nur Zustand/Markup in `BodyImageGallery.tsx` und das
    // Datenmodul `texte/bildergalerie.ts`), also bleibt es bei der Zahl von main: 532. EHRLICH
    // GESAGT: weder hier noch auf main gemessen; weicht der Prüflauf ab, nennt die Meldung die
    // gemessene Zahl, und DIE gehört hierher. `anbieter` 1 und `traeger` 2 auf beiden Seiten gleich.
    //
    // Nacharbeit 18: GEMESSEN 520. Am Kandidaten 82ac7de2 (nach Einmischen von main 7f13932f)
    // meldete der Sammler wörtlich „gemessen: 520 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge
    // 673 Quelldateien … expected { komponenten: 520, … } to deeply equal { komponenten: 532, … }";
    // die übrigen Fälle der Datei und `tests/legal/mega61-rechtsseiten.test.tsx` waren grün. Die
    // Zahl liegt UNTER der gerechneten 532: main hat mit R-1349 u. a. die Wissensraum-Bausteine
    // entfernt (Kommentar in mega61); welche Komponenten genau wegfielen oder dazukamen, ist ohne
    // Git-Verlauf nicht namentlich bestimmt. Dieser Auftrag hat seitdem nur Testdateien geändert und
    // trägt weiterhin kein Bauteil bei. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // Aus dem Hauptstand (gesamt-navigation), gemessen ohne `VeroeffentlichungBereich`:
    // ZUSAMMENFÜHRUNG Gesamt-Navigation × Hauptstand 956a896c (gesamt-navigation, Nacharbeit 13):
    // die 532 des Hauptstands (inklusive `AdminUebersicht`, `AiSurfaceNotice`, `ErgebnisStufeMarke`)
    // und die gleichlautende 532 der Gesamt-Navigation zählen VERSCHIEDENE Mengen. Der Diff des
    // zusammengeführten Baums gegen 956a896c unterscheidet sich in GENAU EINER
    // Komponentendeklaration: `WeiterUntenHinweis` (`shell/WeiterUnten.tsx`), im Hauptstand nicht
    // vorhanden. 532 + 1 = 533. EHRLICH GESAGT: GERECHNET, nicht gemessen. Weicht der Prüflauf ab,
    // gehört die gemessene Zahl hierher. `anbieter` 1 und `traeger` 2 bleiben.
    //
    // gesamt-navigation Nacharbeit 14: GEMESSEN 539. Am Kandidaten 0532195b meldete der Sammler
    // wörtlich „gemessen: 539 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 689 Quelldateien …
    // expected { komponenten: 539, … } to deeply equal { komponenten: 533, … }". Nach der
    // Zusammenführung oben wurde ein neuerer Hauptstand eingemischt (3938f1989); laut Diff
    // 956a896c..Kandidat bringt er SECHS Komponentendeklarationen mit und entfernt keine —
    // `Verantwortung`, `Seite`, `StufenInhalt`, `Argumentation`, `Belastbarkeit`,
    // `PruefrahmenSatz` (u. a. das neue `components/fragen/Belastbarkeit.tsx`). Dazu
    // `WeiterUntenHinweis` dieses Auftrags: 532 + 6 + 1 = 539 deckt sich mit der Messung. Kein
    // Bauteil bietet eine Bildbeschreibung an oder trägt `documentTitle`: `anbieter` 1 und
    // `traeger` 2 sind unverändert (beide Seiten der Meldung nennen 1 und 2).
    //
    // gesamt-navigation Nacharbeit 15: GEMESSEN 540. Am Kandidaten 15ec8596 meldete der Sammler
    // wörtlich „gemessen: 540 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 690 Quelldateien …
    // expected { komponenten: 540, … } to deeply equal { komponenten: 539, … }". Erneut kam ein
    // Hauptstand dazu (85f3f691d, darin „Eigene Zwei-Faktor-Anmeldung konkretisieren" fb1b3cae7);
    // laut Diff 0532195b..15ec8596 bringt er genau EINE Komponente mit — `ZweiFaktorDetail` — und
    // eine Quelldatei (`texte/zweifaktor.ts`, 689 → 690), entfernt keine. 539 + 1 = 540 deckt sich
    // mit der Messung. Dieser Auftrag hat dabei kein Bauteil hinzugefügt. `anbieter` 1 und
    // `traeger` 2 sind unverändert.
    //
    // gesamt-navigation Nacharbeit 17: GEMESSEN 541. Am Kandidaten ffe93dd8 meldete der Sammler
    // wörtlich „gemessen: 541 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 692 Quelldateien …
    // expected { komponenten: 541, … } to deeply equal { komponenten: 540, … }". Erneut kam ein
    // Hauptstand dazu (8d4814670); laut Diff 15ec8596..ffe93dd8 bringt er genau EINE Komponente mit
    // — `AntwortMelden` — und zwei Quelldateien (`components/fragen/AntwortMelden.tsx`,
    // `texte/antwortmeldung.ts`; 690 → 692), entfernt keine. 540 + 1 = 541 deckt sich mit der
    // Messung. Dieser Auftrag hat dabei kein Bauteil hinzugefügt. `anbieter` 1 und `traeger` 2
    // sind unverändert.
    //
    // gesamt-navigation Nacharbeit 18: GEMESSEN 521. Am Kandidaten 26242335 meldete der Sammler
    // wörtlich „gemessen: 521 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 674 Quelldateien …
    // expected { komponenten: 521, … } to deeply equal { komponenten: 541, … }". Der eingemischte
    // Hauptstand (4fae57bef) räumt ungenutzten Code ab: laut Diff ffe93dd8..26242335 entfernt er
    // ZWANZIG Komponentendeklarationen und fügt keine hinzu — `GuardedNavLink`, `FindingSideLink`,
    // `FindingCard`, `FindingGroupHeader`, `KnowledgeRescueIntro`, `LibraryScopeBar`,
    // `IntakeCompletion`, `IntakeEmptyState`, `Chip`, `StructureSuggestionChips`, `ConflictKoSide`,
    // `ImportResultView`, `KnowledgeItemList`, `SourceRecordCard`, `KoReadHeader`,
    // `KoReadStatement`, `KoReadDetails`, `KoReadBody`, `KoReadView`, `KoHomeLine` — samt 18
    // Quelldateien (692 → 674). 541 − 20 = 521 deckt sich mit der Messung. Keine Datei dieses
    // Auftrags ist betroffen; `WeiterUntenHinweis` bleibt enthalten. `anbieter` 1 und `traeger` 2
    // sind unverändert.
    //
    // ZUSAMMENFÜHRUNG veroeffentlichungsoptionen × Hauptstand 985cb62c (Nacharbeit 9): beide
    // Reihen stehen GEMESSEN auf 521 über derselben aufgeräumten Basis (die zwanzig entfernten
    // Komponenten fehlen in beiden). Die Reihe von gesamt-navigation enthält `WeiterUntenHinweis`,
    // nicht aber `VeroeffentlichungBereich`; meine enthält `VeroeffentlichungBereich`, nicht aber
    // `WeiterUntenHinweis`. Zusammen: 521 + 1 = 522 — in veroeffentlichungsoptionen Nacharbeit 10
    // am Kandidaten 6ac9e459 GEMESSEN bestätigt (Sammler grün). `anbieter` 1 und `traeger` 2 bleiben.
    //
    // ADMIN-02 (produkt:20261009:admin-integrationszustaende) Nacharbeit 2 — ZWEI neue Bauteile in
    // `components/ImportLaufListe.tsx` (`ImportLaufListe`, die Importliste, und die dateilokale
    // `LaufZeile`). Keines zeigt ein Bild, bietet eine Bildbeschreibung an oder trägt einen eigenen
    // Titel — sie erscheinen nur in der Grundmenge. Auf dem damaligen Stand GEMESSEN 531
    // (Kandidat 7b7cb869, Grundmenge 682), darin diese zwei.
    //
    // ZUSAMMENFÜHRUNG ADMIN-02 × Hauptstand a57e1e8f (ADMIN-02 Nacharbeit 7): der Hauptstand hat
    // nach seinem Aufräumschritt GEMESSEN 521 (s. direkt darüber); `ImportLaufListe` und
    // `LaufZeile` gibt es dort nicht, und der Aufräumschritt hat keine Datei dieses Auftrags
    // berührt. 521 + 2 = 523. EHRLICH GESAGT: GERECHNET, nicht gemessen; weicht der Prüflauf ab,
    // gehört die gemessene Zahl hierher. `anbieter` 1 und `traeger` 2 bleiben.
    //
    // ADMIN-02 Nacharbeit 8 · GEMESSEN 526. Am Kandidaten 4d4b9c19 meldete der Sammler wörtlich
    // „gemessen: 526 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 680 Quelldateien …
    // expected { komponenten: 526, … } to deeply equal { komponenten: 523, … }". Die Rechnung 523
    // war zu niedrig: dieser Auftrag trägt weiterhin genau ZWEI Bauteile bei (`ImportLaufListe`,
    // `LaufZeile`; neue Quelldateien `components/ImportLaufListe.tsx`, `lib/importLaufHilfe.ts`,
    // `lib/integrationStatus.ts`, `texte/integrationen.ts`). Die übrigen 3 Komponenten (und 2
    // Quelldateien, 674 + 4 = 678 → 680) kommen aus dem eingemischten Hauptstand und sind ohne
    // Git-Verlauf an diesem Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2
    // sind unverändert — beide Seiten der Meldung nennen 1 und 2.
    //
    // ZUSAMMENFÜHRUNG (gesamt-bildbeschreibung-bedienung Nacharbeit 19, Kandidat 10bf555a mit main
    // 8e3b1366): hier GEMESSEN 520 (82ac7de2, Grundmenge 673), auf main GEMESSEN 521 (26242335,
    // Grundmenge 674). Der Unterschied ist genau `WeiterUntenHinweis` (`shell/WeiterUnten.tsx`) der
    // Gesamt-Navigation, den dieser Zweig noch nicht trug: 520 + 1 = 521 — beide Reihen decken sich.
    // Dieser Auftrag trägt KEIN Bauteil bei; seine Quelldateien (`BodyImageGallery.tsx`,
    // `texte/bildergalerie.ts`) liegen nicht unter den 20 abgeräumten. Erwartet ist deshalb die
    // auf main gemessene 521. An DIESEM Kandidaten nicht gemessen; weicht der Prüflauf ab, gehört
    // die gemessene Zahl hierher. `anbieter` 1 und `traeger` 2 sind auf beiden Seiten gleich.
    //
    // Nacharbeit 22: GEMESSEN 524. Am Kandidaten ca3bb812 meldete der Sammler wörtlich „gemessen:
    // 524 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 677 Quelldateien … expected
    // { komponenten: 524, … } to deeply equal { komponenten: 521, … }"; die übrigen 43 Fälle grün.
    // Seit der Zusammenführung änderte dieser Auftrag nur diesen Sollwert (keine Quelldatei der
    // Grundmenge); die 3 Komponenten und 3 Quelldateien (674 → 677) kamen mit main, namentlich
    // ohne Git-Verlauf nicht bestimmt. `anbieter` 1 und `traeger` 2 unverändert.
    //
    // ZUSAMMENFÜHRUNG veroeffentlichungsoptionen × Hauptstand 09c76c18 (Nacharbeit 14): der
    // Hauptstand führt GEMESSEN 524 (ca3bb812) — mit `WeiterUntenHinweis`, aber ohne
    // `VeroeffentlichungBereich`. Dieser Auftrag trägt genau dieses eine Bauteil bei und seit der
    // Messung 522 kein weiteres (Nacharbeit 11 änderte nur Dienst, Ablage und Tests). Zusammen:
    // 524 + 1 = 525. EHRLICH GESAGT: GERECHNET, nicht gemessen — weicht der Prüflauf ab, gehört die
    // gemessene Zahl hierher. `anbieter` 1 und `traeger` 2 bleiben.
    //
    // veroeffentlichungsoptionen Nacharbeit 15: GEMESSEN 527. Am Kandidaten 476c51a3 meldete der
    // Sammler wörtlich „gemessen: 527 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 682
    // Quelldateien … expected { komponenten: 527, … } to deeply equal { komponenten: 525, … }"; die
    // übrigen 43 Fälle der Datei waren grün. Dieser Auftrag trägt weiterhin genau EIN Bauteil bei
    // (`VeroeffentlichungBereich`, schon in der 525); die 2 Komponenten darüber kamen mit dem
    // eingemischten Hauptstand (Grundmenge 677 → 682), namentlich ohne Git-Verlauf nicht bestimmt.
    // `anbieter` 1 und `traeger` 2 sind unverändert. (Dieser Lauf war ROT — 43 von 44 Fällen grün,
    // dieser eine rot —, die 527 ist also eine Messung, kein bestandener Nachweis.)
    //
    // veroeffentlichungsoptionen Nacharbeit 17 (Ben: die 527 stammt aus einer überholten Grundmenge):
    // zwischen dem gemessenen Kandidaten 476c51a3 und dem zusammengeführten Kandidaten ab7ec0b9 kamen
    // mit dem Hauptstand GENAU ACHT Komponentendeklarationen dazu, am Baum nachgezählt:
    //     + `MeineDatenDetail`, `FruehereAntraege`, `LoeschantragDetail`
    //       (`components/datenschutz/MeineDaten.tsx`)
    //     + `AntragZeile`, `AuskunftFuerKonto`, `BetroffenenrechteVerwaltung`
    //       (`components/datenschutz/Verwaltung.tsx`)
    //     + `NegativwissenFuehrung` (`components/erfassen/NegativwissenFuehrung.tsx`)
    //     + `NegativwissenAnzeige` (`components/ko/NegativwissenAnzeige.tsx`)
    // Keines zeigt ein Bild mit Bildbeschreibungsangebot (kein `CAPTION_AI_TEXT`) oder trägt
    // `documentTitle`. Dieser Auftrag hat seit 476c51a3 kein Bauteil hinzugefügt. 527 + 8 = 535.
    // EHRLICH GESAGT: GERECHNET, nicht gemessen — der Sammler muss am Kandidaten erneut laufen;
    // weicht er ab, gehört die gemessene Zahl hierher. `anbieter` 1 und `traeger` 2 bleiben.
    //
    // veroeffentlichungsoptionen Nacharbeit 18: GEMESSEN 536. Am Kandidaten ca505431 meldete der
    // Sammler wörtlich „gemessen: 536 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 699
    // Quelldateien … expected { komponenten: 536, … } to deeply equal { komponenten: 535, … }".
    // Dieser Auftrag hat seit Nacharbeit 17 keine Quelldatei der Grundmenge geändert; die EINE
    // Komponente über der gerechneten 535 kam mit dem Basisstand dieses Kandidaten und ist ohne
    // Git-Verlauf an diesem Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind
    // unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 20: GEMESSEN 539. Am Kandidaten bcaeca4a meldete der
    // Sammler wörtlich „gemessen: 539 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 702
    // Quelldateien … expected { komponenten: 539, … } to deeply equal { komponenten: 536, … }".
    // Dieser Auftrag hat seit Nacharbeit 17 keine Quelldatei der Grundmenge geändert; die DREI
    // Komponenten und drei Quelldateien (699 → 702) kamen mit dem Basisstand dieses Kandidaten und
    // sind ohne Git-Verlauf an diesem Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und
    // `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 21: GEMESSEN 542. Am Kandidaten c35599e2 meldete der
    // Sammler wörtlich „gemessen: 542 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 706
    // Quelldateien … expected { komponenten: 542, … } to deeply equal { komponenten: 539, … }".
    // Dieser Auftrag hat seit Nacharbeit 17 keine Quelldatei der Grundmenge geändert; die DREI
    // Komponenten und vier Quelldateien (702 → 706) kamen mit dem Basisstand dieses Kandidaten und
    // sind ohne Git-Verlauf an diesem Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und
    // `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 22: GEMESSEN 544. Am Kandidaten 15cd7214 meldete der
    // Sammler wörtlich „gemessen: 544 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 709
    // Quelldateien … expected { komponenten: 544, … } to deeply equal { komponenten: 542, … }".
    // Dieser Auftrag hat seit Nacharbeit 17 keine Quelldatei der Grundmenge geändert; die ZWEI
    // Komponenten und drei Quelldateien (706 → 709) kamen mit dem Basisstand dieses Kandidaten und
    // sind ohne Git-Verlauf an diesem Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und
    // `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 25: GEMESSEN 546. Am Kandidaten 96e3cc54 meldete der
    // Sammler wörtlich „gemessen: 546 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 712
    // Quelldateien … expected { komponenten: 546, … } to deeply equal { komponenten: 544, … }".
    // Dieser Auftrag hat seit Nacharbeit 17 keine Quelldatei der Grundmenge geändert (Nacharbeit 24
    // berührte nur das Smoke-Mengenmanifest); die ZWEI Komponenten und drei Quelldateien
    // (709 → 712) kamen mit dem Basisstand dieses Kandidaten und sind ohne Git-Verlauf an diesem
    // Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 27: GEMESSEN 548. Am Kandidaten e1a84f27 (nach dem
    // Basiswechsel 26 auf main 5308f426) meldete der Sammler wörtlich „gemessen: 548 Komponenten ·
    // 1 Anbieter · 2 Traeger · Grundmenge 712 Quelldateien … expected { komponenten: 548, … } to
    // deeply equal { komponenten: 546, … }". Die Grundmenge blieb bei 712; die ZWEI Komponenten
    // kamen also in bereits gezählten Quelldateien mit dem Basisstand hinzu. Dieser Auftrag hat seit
    // Nacharbeit 17 keine Quelldatei der Grundmenge geändert; namentlich sind die zwei ohne
    // Git-Verlauf an diesem Arbeitsbaum nicht bestimmt. `anbieter` 1 und `traeger` 2 unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 29: GEMESSEN 553. Am Kandidaten 8858c1e7 (nach der
    // Integration mit main 4333e511, lesen-inhalt-zuerst) meldete der Sammler wörtlich „gemessen:
    // 553 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 717 Quelldateien … expected
    // { komponenten: 553, … } to deeply equal { komponenten: 548, … }". Die FÜNF Komponenten und
    // fünf Quelldateien (712 → 717) kamen mit dem Basisstand. Dieser Auftrag hat in Nacharbeit 28
    // nur die Lage der vorhandenen `VeroeffentlichungBereich` in `BibliothekLesen.tsx` verschoben —
    // keine Komponente und keine Quelldatei hinzugefügt. `anbieter` 1 und `traeger` 2 unverändert.
    //
    // ZUSAMMENFÜHRUNG ADMIN-02 × main dd82d5df (ADMIN-02 Nacharbeit 10): main hat GEMESSEN 524
    // (Grundmenge 677); `ImportLaufListe` und `LaufZeile` dieses Auftrags gibt es dort nicht.
    // Die ADMIN-02-Messung 526 (Grundmenge 680) enthielt diese zwei und ebenfalls den Hauptstand
    // über 521. 524 + 2 = 526. EHRLICH GESAGT: GERECHNET, nicht gemessen; weicht der Prüflauf ab,
    // gehört die gemessene Zahl hierher. `anbieter` 1 und `traeger` 2 bleiben.
    //
    // ADMIN-02 Nacharbeit 11 · GEMESSEN 528. Am Kandidaten 9c2ee6b8 meldete der Sammler wörtlich
    // „gemessen: 528 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 683 Quelldateien …
    // expected { komponenten: 528, … } to deeply equal { komponenten: 526, … }". Dieser Auftrag
    // trägt unverändert genau ZWEI Bauteile bei (`ImportLaufListe`, `LaufZeile`) und vier
    // Quelldateien; die Rechnung 524 + 2 war zu niedrig, die übrigen 2 Komponenten (Grundmenge
    // 677 + 4 = 681 → 683) kamen mit main und sind ohne Git-Verlauf hier nicht namentlich
    // bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // ADMIN-02 Nacharbeit 12 · GEMESSEN 536. Am Kandidaten cbe6db0f meldete der Sammler wörtlich
    // „gemessen: 536 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 690 Quelldateien …
    // expected { komponenten: 536, … } to deeply equal { komponenten: 528, … }". Seit der Messung
    // 528 hat dieser Auftrag keine Quelldatei der Grundmenge geändert oder angelegt; die 8
    // Komponenten und 7 Quelldateien (683 → 690) kamen mit dem eingemischten Hauptstand und sind
    // ohne Git-Verlauf hier nicht namentlich bestimmt. Beitrag dieses Auftrags unverändert ZWEI
    // (`ImportLaufListe`, `LaufZeile`). `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // ADMIN-02 Nacharbeit 13 · GEMESSEN 537. Am Kandidaten d03f45b6 meldete der Sammler wörtlich
    // „gemessen: 537 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 692 Quelldateien …
    // expected { komponenten: 537, … } to deeply equal { komponenten: 536, … }". Dieser Auftrag hat
    // seit der Messung 536 keine Quelldatei der Grundmenge geändert; die eine Komponente und zwei
    // Quelldateien (690 → 692) kamen mit dem eingemischten Hauptstand und sind ohne Git-Verlauf hier
    // nicht namentlich bestimmt. Beitrag dieses Auftrags unverändert ZWEI. `anbieter` 1 und
    // `traeger` 2 sind unverändert.
    //
    // ADMIN-02 Nacharbeit 17 · GEMESSEN 540. Am Kandidaten 6d939fc5 meldete der Sammler wörtlich
    // „gemessen: 540 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 703 Quelldateien …
    // expected { komponenten: 540, … } to deeply equal { komponenten: 537, … }". Dieser Auftrag hat
    // seit der Messung 537 keine Quelldatei der Grundmenge geändert; die drei Komponenten und elf
    // Quelldateien (692 → 703) kamen mit dem eingemischten Hauptstand und sind ohne Git-Verlauf hier
    // nicht namentlich bestimmt. Beitrag dieses Auftrags unverändert ZWEI. `anbieter` 1 und
    // `traeger` 2 sind unverändert.
    //
    // ADMIN-02 Nacharbeit 18 · GEMESSEN 543. Am Kandidaten 8a397134 meldete der Sammler wörtlich
    // „gemessen: 543 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 707 Quelldateien …
    // expected { komponenten: 543, … } to deeply equal { komponenten: 540, … }". Dieser Auftrag hat
    // seit der Messung 540 keine Quelldatei der Grundmenge geändert; die drei Komponenten und vier
    // Quelldateien (703 → 707) kamen mit dem eingemischten Hauptstand und sind ohne Git-Verlauf hier
    // nicht namentlich bestimmt. Beitrag dieses Auftrags unverändert ZWEI. `anbieter` 1 und
    // `traeger` 2 sind unverändert.
    //
    // ADMIN-02 Nacharbeit 19 · GEMESSEN 547. Am Kandidaten 22afabdb meldete der Sammler wörtlich
    // „gemessen: 547 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 712 Quelldateien …
    // expected { komponenten: 547, … } to deeply equal { komponenten: 543, … }". Dieser Auftrag hat
    // seit der Messung 543 keine Quelldatei der Grundmenge geändert; die vier Komponenten und fünf
    // Quelldateien (707 → 712) kamen mit dem eingemischten Hauptstand und sind ohne Git-Verlauf hier
    // nicht namentlich bestimmt. Beitrag dieses Auftrags unverändert ZWEI. `anbieter` 1 und
    // `traeger` 2 sind unverändert.
    //
    // ADMIN-02 Nacharbeit 21 · GEMESSEN 548. Am Kandidaten 6f186539 meldete der Sammler wörtlich
    // „gemessen: 548 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 713 Quelldateien …
    // expected { komponenten: 548, … } to deeply equal { komponenten: 547, … }". `git diff --stat
    // 22afabdb 6f1865396 -- apps/web/src` nennt ausschließlich Dateien der eingemischten Aufträge
    // „Dialoggrenzen, Tastaturfokus und Vorleseansagen" und „Inhaltsqualität ohne Personenwertung"
    // (u. a. ModalBoundaryContext, erfassen/Blatt, erfassen/Menue, texte/tragfaehigkeit); keine
    // Quelldatei dieses Auftrags. Beitrag dieses Auftrags unverändert ZWEI. `anbieter` 1 und
    // `traeger` 2 sind unverändert.
    //
    // ADMIN-02 Nacharbeit 22 · GEMESSEN 549. Am Kandidaten 936e46fa meldete der Sammler wörtlich
    // „gemessen: 549 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 713 Quelldateien …
    // expected { komponenten: 549, … } to deeply equal { komponenten: 548, … }". `git diff --stat
    // 6f1865396 936e46fa -- apps/web/src` nennt ausschließlich Dateien des eingemischten Auftrags
    // „Eigene Kontodaten mit erhaltenem Änderungsverlauf berichtigen" (u. a. Profile,
    // AdminKontenDetails, api/auth, Wörterbücher); keine Quelldatei dieses Auftrags. Die Grundmenge
    // bleibt 713, die neue Komponente liegt also in einer bestehenden Datei. Beitrag dieses Auftrags
    // unverändert ZWEI. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // ADMIN-02 Nacharbeit 23 · GEMESSEN 554. Am Kandidaten 1e02cb5e meldete der Sammler wörtlich
    // „gemessen: 554 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 718 Quelldateien …
    // expected { komponenten: 554, … } to deeply equal { komponenten: 549, … }". `git diff --stat
    // 936e46fa 1e02cb5e -- apps/web/src` nennt ausschließlich Dateien der eingemischten Aufträge
    // „KI-Beteiligung und Ersatzbetrieb ehrlich kennzeichnen" (u. a. BetreiberKarte, KiLageZeile,
    // lib/betreiberKarte, lib/kiLageAnzeige, texte/kilage) und „Artikel und Anleitungen mit Inhalt
    // zuerst lesen" (u. a. bibliothek/*, texte/lesereihenfolge); keine Quelldatei dieses Auftrags.
    // Beitrag dieses Auftrags unverändert ZWEI. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // Technische Zusammenführung e270b71d × main 6b704ec4: beide Zählhistorien bleiben erhalten.
    // Im Quellbaum kommen gegenüber den 553 dieses Zweigs genau `ImportLaufListe` und
    // `LaufZeile` hinzu; gegenüber den 554 auf main genau `VeroeffentlichungBereich`.
    // Der gemeinsame Sollwert ist daher 555. Sammlerlogik, Anbieter 1 und Träger 2 bleiben gleich.
    //
    // veroeffentlichungsoptionen Nacharbeit 34: GEMESSEN 556. Am Kandidaten 44adee92 meldete der
    // Sammler wörtlich „gemessen: 556 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 727
    // Quelldateien … expected { komponenten: 556, … } to deeply equal { komponenten: 555, … }".
    // Dieser Auftrag hat seit Nacharbeit 28 (nur Lage von `VeroeffentlichungBereich` in
    // `BibliothekLesen.tsx`) keine Quelldatei der Grundmenge geändert; die EINE Komponente kam mit
    // dem Basisstand und ist ohne Git-Verlauf an diesem Arbeitsbaum nicht namentlich bestimmt.
    // `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 36: GEMESSEN 563. Am Kandidaten 270712da (nach der
    // Integration mit main 4072f832, Übersetzungspflege R-1034) meldete der Sammler wörtlich
    // „gemessen: 563 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 734 Quelldateien … expected
    // { komponenten: 563, … } to deeply equal { komponenten: 556, … }". Dieser Auftrag hat in
    // Nacharbeit 35 nur `db.ts` und `migrationsbeleg.ts` (Serverseite, nicht in der Grundmenge)
    // zusammengeführt; die SIEBEN Komponenten und sieben Quelldateien (727 → 734) kamen mit dem
    // Basisstand und sind ohne Git-Verlauf an diesem Arbeitsbaum nicht namentlich bestimmt.
    // `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 38: GEMESSEN 573. Am Kandidaten 54c98803 (nach der
    // Integration mit main 842818b1, ADMIN-15 Unternehmensprofil) meldete der Sammler wörtlich
    // „gemessen: 573 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 743 Quelldateien … expected
    // { komponenten: 573, … } to deeply equal { komponenten: 563, … }". Dieser Auftrag hat in
    // Nacharbeit 37 nur `db.ts`, `migrationsbeleg.ts` (Serverseite, nicht in der Grundmenge) und das
    // Smoke-Mengenmanifest zusammengeführt; die ZEHN Komponenten und neun Quelldateien (734 → 743)
    // kamen mit dem Basisstand und sind ohne Git-Verlauf an diesem Arbeitsbaum nicht namentlich
    // bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 42: GEMESSEN 574. Am Kandidaten d6c56941 meldete der
    // Sammler wörtlich „gemessen: 574 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 746
    // Quelldateien … expected { komponenten: 574, … } to deeply equal { komponenten: 573, … }".
    // Dieser Auftrag hat seit Nacharbeit 38 nur diese Testdatei geändert; die EINE Komponente und
    // drei Quelldateien (743 → 746) kamen mit dem Basisstand und sind ohne Git-Verlauf an diesem
    // Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 43: GEMESSEN 579. Am Kandidaten d0888761 meldete der
    // Sammler wörtlich „gemessen: 579 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 754
    // Quelldateien … expected { komponenten: 579, … } to deeply equal { komponenten: 574, … }".
    // Dieser Auftrag hat seit Nacharbeit 38 nur diese Testdatei geändert; die FÜNF Komponenten und
    // acht Quelldateien (746 → 754) kamen mit dem Basisstand und sind ohne Git-Verlauf an diesem
    // Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 46: GEMESSEN 585. Am Kandidaten dc75d753 meldete der
    // Sammler wörtlich „gemessen: 585 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 756
    // Quelldateien … expected { komponenten: 585, … } to deeply equal { komponenten: 579, … }".
    // Dieser Auftrag hat seit Nacharbeit 38 nur diese Testdatei geändert; die SECHS Komponenten und
    // zwei Quelldateien (754 → 756) kamen mit dem Basisstand und sind ohne Git-Verlauf an diesem
    // Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 47: GEMESSEN 592. Am Kandidaten dcbb03c9 meldete der
    // Sammler wörtlich „gemessen: 592 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 762
    // Quelldateien … expected { komponenten: 592, … } to deeply equal { komponenten: 585, … }".
    // Dieser Auftrag hat seit Nacharbeit 38 nur diese Testdatei geändert; die SIEBEN Komponenten und
    // sechs Quelldateien (756 → 762) kamen mit dem Basisstand und sind ohne Git-Verlauf an diesem
    // Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 48: GEMESSEN 593. Am Kandidaten 7eae1065 meldete der
    // Sammler wörtlich „gemessen: 593 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 763
    // Quelldateien … expected { komponenten: 593, … } to deeply equal { komponenten: 592, … }".
    // Dieser Auftrag hat seit Nacharbeit 38 nur diese Testdatei geändert; die EINE Komponente und
    // eine Quelldatei (762 → 763) kamen mit dem Basisstand und sind ohne Git-Verlauf an diesem
    // Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    //
    // veroeffentlichungsoptionen Nacharbeit 50: GEMESSEN 597. Am Kandidaten f2dcaff4 meldete der
    // Sammler wörtlich „gemessen: 597 Komponenten · 1 Anbieter · 2 Traeger · Grundmenge 765
    // Quelldateien … expected { komponenten: 597, … } to deeply equal { komponenten: 593, … }".
    // Dieser Auftrag hat seit Nacharbeit 38 nur diese Testdatei geändert; die VIER Komponenten und
    // zwei Quelldateien (763 → 765) kamen mit dem Basisstand und sind ohne Git-Verlauf an diesem
    // Arbeitsbaum nicht namentlich bestimmt. `anbieter` 1 und `traeger` 2 sind unverändert.
    expect({ komponenten, anbieter, traeger }, diagnose).toEqual({
      komponenten: 597,
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
