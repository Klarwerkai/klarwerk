// @vitest-environment jsdom
// AUFTRAG-mega88 Block E — DER SAMMLER FÜR DIE BILDWEGE. EIN URTEIL JE WEG, KEINE MINDESTZAHL.
//
// DIE VORGESCHICHTE. Die Bildbeschreibung ist in diesem Projekt dreimal still verschwunden. mega50:
// ein optionaler Prop fehlte auf zwei von vier Flächen. mega84: alles war verdrahtet und trotzdem
// unbedienbar. Und jetzt mega88: alles war verdrahtet UND bedienbar — aber das Bild, auf das der
// Nutzer klickte, hatte gar keinen Anker, an dem eine Beschreibung hängen könnte. Drei Ursachen,
// drei Etagen, dieselbe Antwort auf Pedis Klick: „nichts passiert".
//
// Die beiden vorhandenen Sammler sehen diese dritte Etage nicht:
// `tests/app/mega50-bildbeschreibung-sammler.test.ts` prüft, ob der describe-WEG jede Fläche
// erreicht; `tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx` prüft, ob die Fläche auf die
// Bedienung ANTWORTET. Beide setzen ein Bild MIT figure/figcaption voraus. Genau diese Voraussetzung
// war die Lücke. Dieser Sammler hütet sie — und nur sie.
//
// DIE BAUFORM ist die von mega86, weil sie sich getragen hat:
//   · Die Grundmenge wird AUTORITATIV aus dem TypeScript-Baum ERHOBEN, nicht als Liste gepflegt.
//   · Jeder Fund hat eine STABILE IDENTITÄT und genau EINE Disposition. Ein bekannter Fund, der
//     verschwindet, wird rot; ein neuer Fund ohne Disposition ebenfalls. Es gibt keine Mindestzahl —
//     die war in mega85 genau die Lücke, weil ein neuer Fund einen verschwundenen kompensierte.
//   · Gepinnt wird ANTWORTVERHALTEN, nicht Namensanwesenheit: Stufe 3 ERZEUGT das Markup der
//     erhobenen Wege wirklich und MISST, ob ein Anker entsteht.
//
// DREI STUFEN, und sie fangen drei verschiedene Rückschritte:
//   (1) WER BILDMARKUP ERZEUGT. Jede Funktion im Produktcode, die `<img`-Markup baut. Je Fund ein
//       Urteil aus dem Quelltext: trägt sie den Anker selbst (figure + figcaption + data-image-id)
//       oder liefert sie ein nacktes Bild? Ein nacktes Bild ist erlaubt — aber nur mit der
//       Disposition „trägt die Invariante", und die muss Stufe 3 belegen.
//   (2) WER IN DEN EDITOR-KÖRPER SCHREIBT. Jede Stelle in `RichTextEditor.tsx`, die HTML in ein
//       Element schreibt. Jede Körper-Stelle MUSS in derselben Funktion verankern. Das ist die
//       Stufe, die „ein einzelner Weg wird an der Invariante vorbeigeführt" sieht.
//   (3) OB ES WIRKT. Für jeden Weg mit Disposition „trägt die Invariante" wird das ECHTE Markup
//       erzeugt (die Produktfunktion aufgerufen, keine Attrappe) und durch die zentrale Stelle
//       gefahren. Entsteht kein Anker, ist es rot.
//
// DIE GRENZEN, benannt statt verschwiegen:
//   · Stufe 1 sieht Markup, das im Quelltext GEBAUT wird. HTML, das ein Weg nur DURCHREICHT
//     (Einfügen aus der Zwischenablage, ein `bodyHtml`, das ein API-Aufrufer schickt), enthält
//     `<img` nicht als Literal und ist dort unsichtbar. Diese Wege deckt Stufe 2 ab, weil sie im
//     Editor durch dieselbe Schreibstelle laufen — und der gemountete Beleg
//     `tests/capture/mega88-bildweg-anker-mounted.test.tsx` fährt den Einfügeweg als Handlung.
//   · Die Server-Endpunkte, die `bodyHtml` roh annehmen, ERZEUGEN keinen Anker und sollen es auch
//     nicht: sie sanitisieren autoritativ. Verankert wird im Editor, weil dort beschrieben wird.
//     Ein nacktes Bild aus einer fremden Quelle bekommt seinen Anker beim ersten Laden.
//   · WAS DIE STUFE-2-ERHEBUNG SIEHT, ist gemessen und nicht behauptet: dreizehn Schreibformen,
//     jede durch einen eingespeisten Fall in Stufe 2 belegt (acht seit JOB 2085 D1, fünf seit
//     JOB 3119). In der Reihenfolge der Messung `R-0041-bildstruktur-20260906-0500`:
//     Zuweisung an eine Schreib-Eigenschaft über den Punkt · über ein Literal in der Klammer ·
//     `appendChild` · `replaceChildren` · `insertNode` · Methodenalias über `bind` ·
//     Methodenreferenz über `f.call`/`f.apply` · benannter Import eines schreibenden Exports ·
//     Alias über beliebig viele Bindungen · Namensraum-Import (`import * as h`) · Helferkette
//     über mehrere Module · dynamischer Schlüssel aus einer auflösbaren `const`-Bindung ·
//     `Reflect.set` auf eine Schreib-Eigenschaft.
//   · WAS SIE AUSDRÜCKLICH NICHT SIEHT, und jedes davon steht als eigener Fall in Stufe 2, nicht
//     nur hier im Kommentar: einen Helfer aus einem PAKET, benannt oder als Namensraum (die
//     Auflösung folgt allein relativen Pfaden — `OF-2060-2` ist nicht entschieden) · einen
//     dynamischen Schlüssel, der nicht statisch auflösbar ist (`let`, Zusammensetzung, Parameter;
//     dort wird nicht geraten, sondern geschwiegen) · eine Importkette jenseits von
//     `IMPORTKETTEN_TIEFE`.
//     UND DIE NAMENSTABELLE KENNT KEINE GÜLTIGKEITSBEREICHE (JOB 3119, Runde 2): sie ist flach über
//     die ganze Datei. Ein Name, der irgendwo darin ein zweites Mal als WERT gebunden wird — die
//     Formen stehen abschliessend bei `stringKonstanten` und umfassen Deklaration wie Ausdruck
//     (`function key` und `const f = function key`, `class key` und `const K = class key`) —, gilt
//     als NICHT auflösbar, auch wenn die Verdeckung an der Schreibstelle gar nicht greift. Der
//     Irrtum geht damit immer zur schweigenden Seite: lieber eine Stelle unerhoben als eine erfunden.
//     HIER STAND BIS JOB 3119: „Alias und Indirektion entgehen der Erhebung — dafür bräuchte es
//     den Typprüfer, nicht den Syntaxbaum." Das war schon seit JOB 2085 D1 falsch und ist mit
//     diesen dreizehn Formen erledigt: keine von ihnen braucht mehr als den Syntaxbaum. Der Satz
//     ist gestrichen und nicht ergänzt — zwei Wahrheitsstände über dieselbe Erhebung sind genau
//     der Fehler, gegen den JOB 1185 D1 weiter unten gebaut wurde.
//   · Stufe 1 (`leserBefunde`) ist davon UNBERÜHRT und bewusst enger; ihre Grenze steht bei
//     ihrem eigenen Fall („die vier Auslagerungsformen aus I50 sind NICHT erfasst").
// JOB 2085 D1: `existsSync`/`dirname`/`resolve` für die einstufige Modulauflösung (I47, zweitens).
// JOB 3119: `relative` für die MEHRSTUFIGE — jedes Modul löst seine Importe relativ zu sich auf.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { enhanceFiguresForEditing } from "../../apps/web/src/lib/editorFigures";
import { insertImageHtml, insertImageSrcHtml } from "../../apps/web/src/lib/richText";
import { fillWordImages } from "../../apps/web/src/lib/wordAddin";

const WURZEL = process.cwd();

// ── Erhebung: die Quelldateien des Produkts ────────────────────────────────────────────────────

function istQuelldatei(pfad: string): boolean {
  if (!pfad.endsWith(".ts") && !pfad.endsWith(".tsx")) {
    return false;
  }
  return !pfad.includes(".test.");
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

function wurzelverzeichnisse(): string[] {
  const aus = [join("apps", "web", "src")];
  for (const eintrag of readdirSync(join(WURZEL, "services"), { withFileTypes: true })) {
    if (!eintrag.isDirectory()) {
      continue;
    }
    const src = join("services", eintrag.name, "src");
    try {
      readdirSync(join(WURZEL, src));
      aus.push(src);
    } catch {
      // Modul ohne src/ — nichts zu erheben.
    }
  }
  return aus;
}

function baumAus(datei: string, roh: string): { baum: ts.SourceFile; roh: string } {
  return {
    roh,
    baum: ts.createSourceFile(datei, roh, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  };
}

function baumVon(datei: string): { baum: ts.SourceFile; roh: string } {
  return baumAus(datei, readFileSync(join(WURZEL, datei), "utf8"));
}

// Die umschließende Funktion eines Knotens. Anonyme Rückrufe (useEffect & Co.) bekommen den Namen
// des Aufrufs PLUS seine Abhängigkeitsliste: das ist stabil gegen Zeilenverschiebungen und sagt
// gleichzeitig, WELCHER Effekt gemeint ist. Eine Zeilennummer in der Identität wäre bei jeder
// Änderung darüber rot geworden — ein Wächter, der bei jeder Bewegung schreit, wird abgeschaltet.
function huelleVon(knoten: ts.Node, baum: ts.SourceFile): string {
  let p: ts.Node | undefined = knoten.parent;
  while (p) {
    if (ts.isFunctionDeclaration(p) && p.name) {
      return p.name.text;
    }
    if (
      (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
      p.parent &&
      ts.isVariableDeclaration(p.parent) &&
      ts.isIdentifier(p.parent.name)
    ) {
      return p.parent.name.text;
    }
    if (
      (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
      p.parent &&
      ts.isCallExpression(p.parent) &&
      ts.isIdentifier(p.parent.expression)
    ) {
      const args = p.parent.arguments;
      const letzte = args[args.length - 1];
      const deps =
        letzte !== undefined && letzte !== p ? letzte.getText(baum).replace(/\s+/g, " ") : "";
      return `${p.parent.expression.text}${deps}`;
    }
    p = p.parent;
  }
  return "<modul>";
}

function rumpfText(knoten: ts.Node, baum: ts.SourceFile): string {
  let p: ts.Node | undefined = knoten.parent;
  while (p) {
    if (ts.isFunctionDeclaration(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p)) {
      return p.getText(baum);
    }
    p = p.parent;
  }
  return "";
}

// ── Stufe 1: WER BILDMARKUP ERZEUGT ────────────────────────────────────────────────────────────

type Urteil = "anker" | "nackt";

interface Erzeuger {
  id: string; // stabile Identität: datei::funktion
  urteil: Urteil;
}

const ANKERTEILE = [/<figure\b/i, /<figcaption\b/i, /data-image-id/i] as const;

function istBildLiteral(k: ts.Node, baum: ts.SourceFile): boolean {
  const istLiteral =
    ts.isStringLiteral(k) ||
    ts.isNoSubstitutionTemplateLiteral(k) ||
    ts.isTemplateHead(k) ||
    ts.isTemplateMiddle(k) ||
    ts.isTemplateTail(k);
  return istLiteral && /<img\b/i.test(k.getText(baum));
}

/** Die Erhebung EINER Quelle — als eigene Funktion, damit auch erfundene Quellen sie durchlaufen. */
function erhebeAusQuelle(datei: string, roh: string): Erzeuger[] {
  const gefunden = new Map<string, Urteil>();
  if (!/<img/i.test(roh)) {
    return [];
  }
  const { baum } = baumAus(datei, roh);
  const gehe = (k: ts.Node): void => {
    if (istBildLiteral(k, baum)) {
      const id = `${posix(datei)}::${huelleVon(k, baum)}`;
      const rumpf = rumpfText(k, baum);
      const urteil: Urteil = ANKERTEILE.every((teil) => teil.test(rumpf)) ? "anker" : "nackt";
      // Ein Fund je Funktion; trägt eine ihrer Stellen den vollen Anker, gilt sie als verankernd.
      if (gefunden.get(id) !== "anker") {
        gefunden.set(id, urteil);
      }
    }
    ts.forEachChild(k, gehe);
  };
  gehe(baum);
  return Array.from(gefunden, ([id, urteil]) => ({ id, urteil }));
}

function erhebeErzeuger(): Erzeuger[] {
  const gefunden = new Map<string, Urteil>();
  for (const datei of wurzelverzeichnisse().flatMap(quelldateien)) {
    for (const e of erhebeAusQuelle(datei, readFileSync(join(WURZEL, datei), "utf8"))) {
      if (gefunden.get(e.id) !== "anker") {
        gefunden.set(e.id, e.urteil);
      }
    }
  }
  return Array.from(gefunden, ([id, urteil]) => ({ id, urteil })).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}

// ── AUFTRAG-mega90 Block D: DIE `liest-markup`-AUSNAHME BELEGT DIE LESER-EIGENSCHAFT ───────────
//
// DER BEFUND (ben in sammel89). Die Disposition `liest-markup` ist für `bodyImages.ts` sachlich
// richtig — das Modul liest Markup und erzeugt keinen Editorinhalt. Ihre Zusicherung verlangte aber
// nur das Urteil `nackt`, und GENAU DIESES URTEIL BEKÄME AUCH EIN NEUER, UNSICHERER ERZEUGER von
// nacktem `<img>`-Markup: wer ihn als `liest-markup` einträgt, passierte den Sammler ohne jeden
// Wirkungsbeleg. bens Satz dazu, und er ist der Merksatz dieses Blocks:
// „Baut keinen vollständigen Anker" beweist nicht „schreibt nichts".
//
// WAS HIER NICHT STEHT UND BEWUSST NICHT STEHEN DARF: eine Liste von Dateinamen, die als Leser
// gelten. Das wäre exakt der Wächter, gegen den der Merksatz geschrieben ist.
//
// GEPRÜFT WERDEN STATTDESSEN ZWEI MASCHINELL FESTSTELLBARE EIGENSCHAFTEN DES MODULS:
//
//   (1) ES ENTHÄLT KEINE DER BEKANNTEN DIREKTEN DOM-SCHREIBFORMEN. Keine direkte Zuweisung an
//       `innerHTML`/`outerHTML`/`textContent`/`nodeValue`, kein direkter Aufruf von
//       `insertAdjacentHTML`, `setAttribute`, `appendChild`, `replaceWith`, `append`/`prepend`,
//       `insertBefore`, `replaceChildren`, `createElement`, `document.write`.
//
//       ================================================================================
//       JOB 1185 D1 — DIESE ZUSAGE IST VERENGT WORDEN, UND HIER STEHT WARUM.
//       ================================================================================
//
//       BIS HIERHER STAND: „ES SCHREIBT NICHT. Keine DOM-Schreibform im ganzen Modul … Ein Modul
//       ohne jede Schreibform kann den Beitragskörper nicht verändern." Das war eine ALLGEMEINE
//       Zusage über eine ENDLICHE Prüfung — und ben hat sie in `sammel92` (Register I50, zweitens)
//       als solche benannt: der AST-Teil erkennt nur eine endliche Liste direkter
//       Property-Zuweisungen und Methodennamen.
//
//       VIER FORMEN LAGERN DIE WIRKUNG AUS, OHNE EINE DER AUFGEZÄHLTEN GESTALTEN ZU HABEN. Alle
//       vier wurden am 20.08.2026 einzeln in dieses Modul eingespeist und gefahren — der Wächter
//       blieb JEDES MAL GRÜN (11/11), obwohl wirklich geschrieben wurde:
//
//         (a) Zuweisung über einen ZEICHENKETTENSCHLÜSSEL — `ziel["innerHTML"] = html`.
//             Die Erhebung verlangt `ts.isPropertyAccessExpression(k.left)`; das hier ist eine
//             ElementAccessExpression. Gleiche Wirkung, andere Knotenart.
//         (b) `Reflect.set(ziel, "innerHTML", html)` — ein Aufruf, dessen Methodenname `set`
//             lautet und deshalb in keiner der beiden Listen steht.
//         (c) ALIASIERTER Methodenaufruf — `const anhaengen = ziel.appendChild.bind(ziel);
//             anhaengen(knoten)`. Der wirksame Aufruf ist ein blosser Identifier ohne
//             PropertyAccess; gerufen wird `bind`, und das steht nicht in der Liste.
//         (d) IMPORTIERTER SCHREIBHELFER — `enhanceFiguresForEditing(ziel, …)`. Ein
//             Identifier-Aufruf; was hinter dem Namen steht, sieht dieser Syntaxbaum nicht.
//
//       WAS DIESE ZUSAGE DESHALB HEUTE HEISST — und nur das: das Modul enthält keine der
//       vierzehn oben aufgezählten Gestalten. Sie heisst NICHT „es schreibt nicht". Der
//       Unterschied ist die ganze Korrektur, und der Kalibrierungsfall weiter unten
//       („die vier Auslagerungsformen aus I50 sind NICHT erfasst") hält ihn fest, damit
//       niemand die engere Zusage später wieder für die breite hält.
//
//       DIE WAHL, WIE ES WEITERGEHT, IST NICHT HIER GETROFFEN. ben nennt zwei Wege — die Zusage
//       verengen (dieser Weg) oder die Erhebung tragfähig machen (positive Modulgrenze oder
//       Laufzeitprobe mit schreibgeschütztem DOM-Adapter). Beide liegen mit Kosten, Bindung und
//       Risiko in `RUECKGABE-BASIC4-JOB-1185-D1-LIEST-MARKUP-WAECHTER.md`; entschieden wird dort
//       nicht, sondern vom KOPF.
//
//   (2) JEDES `<img`-LITERAL IST EIN SUCHMUSTER, KEIN ERZEUGTES MARKUP. Das Literal muss als Quelle
//       eines regulären Ausdrucks enden: entweder unmittelbar als Argument von `RegExp(…)` /
//       `new RegExp(…)`, oder als Initialisierer einer Konstanten, deren SÄMTLICHE Verwendungen im
//       Modul genau das sind. Ein Literal, das irgendwo anders hinfließt — in eine Rückgabe, eine
//       Zuweisung, einen Aufruf —, ist erzeugtes Markup und macht die Disposition rot.
//       (Regex-LITERALE wie `/<img\b[^>]*>/` sind gar keine Zeichenkettenliterale und werden von der
//       Erhebung oben ohnehin nicht gefunden — sie können hier nicht durchrutschen.)
//
// DIE GRENZE, benannt statt verschwiegen: (2) folgt dem Literal nur über eine Ebene benannter
// Konstanten im selben Modul. Ein Literal, das über eine Funktion oder einen Import gereicht wird,
// gilt hier als „nicht als Muster belegt" — der Wächter irrt damit zur SICHEREN Seite: er wird rot
// und verlangt eine Entscheidung, statt still durchzulassen.

const SCHREIB_EIGENSCHAFTEN = new Set(["innerHTML", "outerHTML", "textContent", "nodeValue"]);
const SCHREIB_METHODEN = new Set([
  "insertAdjacentHTML",
  "setAttribute",
  "appendChild",
  "replaceWith",
  "append",
  "prepend",
  "insertBefore",
  "replaceChildren",
  "createElement",
  "write",
]);

/** Klettert von einem Literal über Verkettung/Template/Klammern nach oben zum tragenden Ausdruck. */
function tragenderAusdruck(k: ts.Node): ts.Node {
  let n = k;
  while (
    n.parent &&
    (ts.isTemplateExpression(n.parent) ||
      ts.isTemplateSpan(n.parent) ||
      ts.isParenthesizedExpression(n.parent) ||
      ts.isAsExpression(n.parent) ||
      (ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === ts.SyntaxKind.PlusToken))
  ) {
    n = n.parent;
  }
  return n;
}

function istRegExpArgument(k: ts.Node, baum: ts.SourceFile): boolean {
  const p = tragenderAusdruck(k).parent;
  if (p === undefined) {
    return false;
  }
  if (!ts.isCallExpression(p) && !ts.isNewExpression(p)) {
    return false;
  }
  return p.expression.getText(baum) === "RegExp";
}

/** Die Befunde gegen eine als `liest-markup` disponierte Quelle. Leer = die Eigenschaft ist belegt. */
function leserBefunde(datei: string, roh: string): string[] {
  const { baum } = baumAus(datei, roh);
  const befunde: string[] = [];

  // (1) Schreibformen.
  const geheSchreiben = (k: ts.Node): void => {
    if (
      ts.isBinaryExpression(k) &&
      k.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(k.left) &&
      SCHREIB_EIGENSCHAFTEN.has(k.left.name.text)
    ) {
      befunde.push(`schreibt in \`${k.left.name.text}\``);
    }
    if (ts.isCallExpression(k) && ts.isPropertyAccessExpression(k.expression)) {
      const name = k.expression.name.text;
      if (SCHREIB_METHODEN.has(name)) {
        befunde.push(`ruft \`${name}(…)\``);
      }
    }
    ts.forEachChild(k, geheSchreiben);
  };
  geheSchreiben(baum);

  // (2) Jedes `<img`-Literal muss als Regex-Quelle enden.
  const literale: ts.Node[] = [];
  const geheLiterale = (k: ts.Node): void => {
    if (istBildLiteral(k, baum)) {
      literale.push(k);
    }
    ts.forEachChild(k, geheLiterale);
  };
  geheLiterale(baum);

  // Alle Verwendungen eines Namens im Modul (ohne die Deklaration selbst).
  const verwendungen = (name: string): ts.Identifier[] => {
    const aus: ts.Identifier[] = [];
    const gehe = (k: ts.Node): void => {
      if (
        ts.isIdentifier(k) &&
        k.text === name &&
        !(ts.isVariableDeclaration(k.parent) && k.parent.name === k)
      ) {
        aus.push(k);
      }
      ts.forEachChild(k, gehe);
    };
    gehe(baum);
    return aus;
  };

  for (const literal of literale) {
    if (istRegExpArgument(literal, baum)) {
      continue;
    }
    const traeger = tragenderAusdruck(literal).parent;
    const konstante =
      traeger !== undefined && ts.isVariableDeclaration(traeger) && ts.isIdentifier(traeger.name)
        ? traeger.name.text
        : null;
    if (konstante === null) {
      befunde.push(
        `das \`<img\`-Literal in \`${huelleVon(literal, baum)}\` ist kein Suchmuster: es fließt weder in RegExp(…) noch in eine Konstante`,
      );
      continue;
    }
    const stellen = verwendungen(konstante);
    const alleMuster = stellen.length > 0 && stellen.every((s) => istRegExpArgument(s, baum));
    if (!alleMuster) {
      befunde.push(
        `die Konstante \`${konstante}\` trägt ein \`<img\`-Literal, wird aber nicht ausschließlich als RegExp-Quelle verwendet`,
      );
    }
  }
  return befunde;
}

// DIE DISPOSITIONEN. Jede erhobene Stelle braucht genau eine — und wer eine hinzufügt, muss sagen,
// warum ein nacktes Bild dort in Ordnung ist. Genau das ist der Zweck dieser Tabelle: sie zwingt
// die Entscheidung an die Oberfläche, statt sie im Code verschwinden zu lassen.
// AUFTRAG-mega89: eine DRITTE Disposition, weil die Erhebung einen dritten Fall gefunden hat und
// dieser Sammler dafür gebaut ist, genau das an die Oberfläche zu zwingen. „liest-markup" ist eine
// Stelle, deren `<img`-Literal ein LESE-Muster ist (ein Zerleger), kein erzeugtes Markup: sie
// schreibt nichts in einen Beitragskörper und kann folglich weder verankern noch die Verankerung
// umgehen. Damit die Disposition kein Freibrief ist, wird sie unten geprüft: eine solche Stelle darf
// KEIN vollständiges Ankermarkup bauen — täte sie es, wäre sie doch ein Erzeuger und die
// Entscheidung müsste neu gefällt werden.
type ErzeugerDisposition = "traegt-anker-selbst" | "traegt-invariante" | "liest-markup";

const ERZEUGER_DISPOSITION: Readonly<Record<string, ErzeugerDisposition>> = {
  // Der Import-Weg (DOCX) — verankert seit WP-BILD-1a/1b beim Umhüllen selbst.
  "apps/web/src/lib/docx.ts::wrapImagesInFigures": "traegt-anker-selbst",
  // Die Invariante selbst (AUFTRAG-mega88 Block B) — sie IST der Anker.
  "apps/web/src/lib/editorFigures.ts::ensureImageAnchors": "traegt-anker-selbst",
  // Folienbilder aus PPTX und die gerenderte Folienansicht.
  "apps/web/src/lib/pptx.ts::imageFigureHtml": "traegt-anker-selbst",
  "apps/web/src/lib/slideImages.ts::slideFigureHtml": "traegt-anker-selbst",
  // Die Beispielpakete (Server-Seed) schreiben figure + Fußnote MIT Text direkt in den Bestand.
  "services/app/src/example-packages.ts::createExampleKo": "traegt-anker-selbst",
  // Der Editor-Einfügehelfer: liefert bewusst ein nacktes <img>. Er ist der EINE Ort, an dem
  // Bildmarkup für den Editor entsteht (Werkzeugleiste, lokale Dateiauswahl, Drop, Bild-Paste) —
  // und alle vier landen im Editor-DOM, wo die Invariante greift. Belegt in Stufe 3.
  "apps/web/src/lib/richText.ts::insertImageSrcHtml": "traegt-invariante",
  // Klara/Word-Add-in: reicht Word-Markup durch und füllt nur die Bild-Bytes nach. Das Ergebnis ist
  // ein nacktes <img> und wird als Entwurfs-bodyHtml gespeichert (B33 im Register seit mega69).
  // Beschrieben wird es im Editor — dort greift die Invariante beim Laden. Belegt in Stufe 3.
  "apps/web/src/lib/wordAddin.ts::fillWordImages": "traegt-invariante",
  // AUFTRAG-mega89 Block B: der Zerleger der Galerie-Ableitung. Sein `<img`-Literal ist das
  // Suchmuster, mit dem er ein FERTIGES bodyHtml liest — er erzeugt kein Bildmarkup und schreibt
  // nirgends in einen Beitragskörper. Seine Zusage (beide Bilder, jeweils richtige Beschreibung,
  // auch bei Verschachtelung) steht in `tests/capture/mega89-galerie-paarung.test.ts`.
  "apps/web/src/lib/bodyImages.ts::<modul>": "liest-markup",
};

// ── Stufe 2: WER IN DEN EDITOR SCHREIBT ────────────────────────────────────────────────────────

const EDITOR = join("apps", "web", "src", "components", "RichTextEditor.tsx");

interface Schreibstelle {
  id: string; // stabile Identität: die umschließende Funktion
  verankert: boolean; // ruft `verankereFiguren` in derselben Funktion
}

const SCHREIB_AUFRUFE = /^(document\.execCommand|.*\.insertAdjacentHTML|fuegeAmCursorEin)$/;

// ── JOB 2085 D1 (I47, zweitens): DIE ERHEBUNG SIEHT JETZT AUCH INDIREKTE WEGE ─────────────────
//
// DER BEFUND (`OFFEN.md`, I47, zweitens): „der Sammler erkennt nur `innerHTML`-Zuweisungen und
// eine begrenzte Regex-Menge; Alias und Indirektion sind im Testkopf selbst als blind benannt."
//
// VIER FORMEN WERDEN GESCHLOSSEN:
//   (1) weitere Schreib-Eigenschaften als `innerHTML` — `outerHTML`, `textContent`, `nodeValue`.
//   (2) SCHLÜSSEL-INDIREKTION: `ziel["innerHTML"] = html`. Die alte Erhebung verlangte
//       `isPropertyAccessExpression`; das ist eine ElementAccessExpression.
//   (3) KNOTENEINFÜGENDE Methoden — darunter `appendChild`, `replaceChildren` und `insertNode`,
//       also genau die drei Wege, vor denen I47 (erstens) warnt. Sie standen in KEINER Liste:
//       der Sammler konnte einen Weg nicht sehen, vor dem sein Schwesterwächter warnt.
//   (4) ALIAS und IMPORTIERTER HELFER — die beiden Formen, die den Punkt definieren.
//
// UND EINE BESTANDSAUSSAGE IST DAMIT WIDERLEGT: der Kopf dieser Datei sagte, für Alias und
// Indirektion „bräuchte es den Typprüfer, nicht den Syntaxbaum". Für die hier gebauten Formen
// trifft das nicht zu — sie sind ohne Programm und ohne Checker erreichbar.
//
// ── JOB 3119 (PRIORITAETEN.md I47b): FÜNF WEITERE FORMEN, UND DER KOPF IST WIRKLICH BERICHTIGT ─
//
// DIE KORREKTUR OBEN WAR ANGEKÜNDIGT UND NICHT AUSGEFÜHRT: der widerlegte Satz stand bis JOB 3119
// unverändert im Kopf, während hier „der Kopfkommentar ist entsprechend korrigiert" behauptet
// wurde. Damit sagte der Wächter weniger, als er kann — derselbe Fehler, gegen den JOB 1185 D1
// weiter oben gebaut ist, nur in die andere Richtung. Der Kopf trägt jetzt den gemessenen Stand,
// und diese Zeilen sind seine Vorgeschichte, keine zweite Fassung davon.
//
// FÜNF FORMEN KOMMEN HINZU, alle fünf vor dem Bau als `ergebnis: []` gemessen:
//   (5) ALIAS ÜBER MEHRERE BINDUNGEN — `const b = a`. Die Menge der indirekten Namen wird bis zum
//       FIXPUNKT fortgeschrieben statt nur eine Ebene tief.
//   (6) NAMENSRAUM-IMPORT — `import * as h from "./m"; h.write(z)`. Er wird aufgelöst wie ein
//       benannter Import; welcher Export gemeint ist, sagt erst die Aufrufstelle.
//   (7) HELFERKETTE über mehrere Module — der importierte Export schreibt nicht selbst, sondern
//       ruft einen schreibenden Export des nächsten Moduls. Begrenzt durch `IMPORTKETTEN_TIEFE`
//       und einen Zyklusschutz über besuchte Modul/Export-Paare.
//   (8) DYNAMISCHER SCHLÜSSEL — `const key = "innerHTML"; z[key] = html`, aber NUR wenn `key`
//       statisch auflösbar ist. Ein Parameter, eine Zusammensetzung, eine `let`-Bindung bleiben
//       ungemeldet: eine Erhebung, die rät, ist schlechter als eine, die ihre Grenze hinschreibt.
//       RUNDE 2 (Befund BEN): das galt in Runde 1 nur für den Namen selbst — ein PARAMETER, der
//       eine gleichnamige äussere `const` verdeckte, wurde trotzdem über sie aufgelöst.
//       RUNDE 3 (Befund BEN): und in Runde 2 fehlten die beiden AUSDRUCKSFORMEN, `const f =
//       function key(){…}` und `const K = class key {…}`. Welche Bindungsformen verdecken, steht
//       jetzt abschliessend und mit Beleg je Form bei `stringKonstanten`.
//   (9) `Reflect.set(z, "innerHTML", html)` — dieselbe Wirkung wie (1), aber der Schreibname steht
//       als Argument da und in keiner Methodenliste.
//
// ABGRENZUNG: `setAttribute` ist NICHT aufgenommen. Es setzt Attribute an vorhandenen Knoten und
// kann kein Bild in den Körper bringen; seine Aufnahme brächte Dutzende Stellen ohne Bildbezug.
// Diese Listen fragen: „kann hier ein KNOTEN hereinkommen?"
const SCHREIB_EIGENSCHAFTEN_ERHEBUNG = new Set([
  "innerHTML",
  "outerHTML",
  "textContent",
  "nodeValue",
]);
const KNOTEN_METHODEN = new Set([
  "appendChild",
  "replaceChildren",
  "replaceWith",
  "append",
  "prepend",
  "insertBefore",
  "insertNode",
  "insertAdjacentHTML",
]);

/** Quelltexte für eingespeiste Proben: Modulspezifizierer → Quelltext. */
type Moduldeck = Readonly<Record<string, string>>;

/** Zeigt dieser Initialisierer auf eine bekannte Schreibmethode? (`bind` oder blosse Referenz) */
function zeigtAufSchreibmethode(n: ts.Node | undefined): boolean {
  if (n === undefined) {
    return false;
  }
  if (
    ts.isCallExpression(n) &&
    ts.isPropertyAccessExpression(n.expression) &&
    n.expression.name.text === "bind" &&
    ts.isPropertyAccessExpression(n.expression.expression) &&
    KNOTEN_METHODEN.has(n.expression.expression.name.text)
  ) {
    return true;
  }
  return ts.isPropertyAccessExpression(n) && KNOTEN_METHODEN.has(n.name.text);
}

// ── JOB 3119 (PRIORITAETEN.md I47b): DIE TIEFENGRENZE DER HELFERKETTE ─────────────────────────
//
// Ein importierter Helfer, der selbst nur einen weiteren importierten Helfer ruft, schreibt
// MITTELBAR — und war damit bis JOB 3119 unerhoben (Fall `import-helper-zwei-ebenen` der Messung
// `R-0041-bildstruktur-20260906-0500`). Verfolgt wird die Kette über HÖCHSTENS so viele
// Modulgrenzen. Die Grenze ist nötig, weil der Zyklusschutz allein nicht genügt: ein azyklisches
// Modulgeflecht kann beliebig tief sein, und die Erhebung läuft in jedem Testlauf.
//
// DIESE ZAHL UND DER FALL „eine Importkette jenseits der Tiefengrenze wird NICHT verfolgt" IN
// STUFE 2 GEHÖREN ZUSAMMEN: wer sie ändert, ersetzt den Fall, statt ihn anzupassen.
const IMPORTKETTEN_TIEFE = 3;

/** Ein aufgelöstes Modul: sein Quelltext UND sein Pfad — der Pfad trägt die nächste Auflösung. */
interface Modulfund {
  quelle: string;
  pfad: string;
}

/**
 * Ein projektinternes Modul auflösen. NUR relative Pfade — ein Paket unter `node_modules` wird
 * bewusst NICHT verfolgt (`OF-2060-2`, siehe die Fälle `DIE GRENZE` unten).
 * JOB 3119: der Fund trägt seinen Pfad mit, damit ein Modul die Spezifizierer SEINER Importe
 * relativ zu SICH auflösen kann — ohne das endete die Kette nach einer Ebene.
 */
function loeseModul(vonDatei: string, spez: string, deck?: Moduldeck): Modulfund | null {
  if (deck !== undefined) {
    const quelle = deck[spez];
    return quelle === undefined ? null : { quelle, pfad: spez };
  }
  if (!spez.startsWith(".")) {
    return null;
  }
  const basis = resolve(dirname(join(WURZEL, vonDatei)), spez);
  for (const endung of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const pfad = basis + endung;
    if (existsSync(pfad)) {
      return { quelle: readFileSync(pfad, "utf8"), pfad: posix(relative(WURZEL, pfad)) };
    }
  }
  return null;
}

// JOB 3119: dieselbe Datei wird auf einer Kette mehrfach erreicht (jeder benannte Import eines
// Moduls fragt sie erneut). Ein Parse je Inhalt genügt — der Baum wird nur gelesen.
const BAUM_SPEICHER = new Map<string, ts.SourceFile>();

function baumGeparst(datei: string, quelle: string): ts.SourceFile {
  const schluessel = `${datei} ${quelle}`;
  const bekannt = BAUM_SPEICHER.get(schluessel);
  if (bekannt !== undefined) {
    return bekannt;
  }
  const { baum } = baumAus(datei, quelle);
  BAUM_SPEICHER.set(schluessel, baum);
  return baum;
}

/**
 * JOB 3119 (Lieferung 4): die statisch auflösbaren Bindungen auf ein Stringliteral.
 * Auflösbar ist NUR eine `const`-Bindung auf ein Literal, und nur wenn derselbe Name im Baum
 * nicht noch anders gebunden wird. Alles andere steht als `null` drin und heisst „NICHT
 * auflösbar" — dort wird nicht geraten, sondern nichts gemeldet.
 *
 * JOB 3119 RUNDE 2 (Befund BEN, Korrekturpflicht 1): diese Erhebung KENNT KEINE GÜLTIGKEITSBEREICHE
 * — sie führt eine flache Namenstabelle über die ganze Datei. Bis hierher las sie nur
 * Variablendeklarationen; ein Funktionsparameter `key` konnte deshalb eine äussere
 * `const key = "innerHTML"` VERDECKEN, ohne dass die Tabelle es merkte, und `z[key] = html` galt als
 * Schreibstelle, obwohl der Wert zur Bauzeit unbekannt ist. Das war genau das Raten, das Lieferung 4
 * ausschliesst. Die Antwort passt zur flachen Tabelle: eine weitere Bindung desselben Namens trägt
 * sich als `null` ein, und eine zweite Bindung mit anderem Wert macht den Namen ohnehin unauflösbar.
 * Die Tabelle irrt damit zur schweigenden Seite: ein verdeckter Name wird lieber gar nicht aufgelöst
 * als falsch. Der Preis ist eine Schreibstelle, die unerhoben bleibt, wenn irgendwo in derselben
 * Datei ein gleichnamiger Parameter steht — das ist die richtige Richtung für einen Wächter, der
 * nicht raten darf.
 *
 * JOB 3119 RUNDE 3 (Befund BEN, Korrekturpflicht 1): Runde 2 schrieb hier „JEDE weitere Bindung" und
 * führte in Wahrheit eine LISTE, in der die beiden Ausdrucksformen fehlten — `const f = function
 * key(){…}` und `const K = class key {…}` binden `key` in ihrem eigenen Rumpf, und genau dort wurde
 * er gelesen. Der Fehlalarm blieb also für zwei Schreibweisen bestehen, während der Kommentar
 * Vollständigkeit behauptete. Die Liste steht jetzt unten vollständig und mit Deklaration UND
 * Ausdruck nebeneinander; dieser Absatz behauptet keine Vollständigkeit mehr, sondern zeigt auf sie.
 * Die Formen sind je einzeln durch einen Fall in Stufe 2 belegt (`I47b-4b`, `I47b-4c`).
 */
function stringKonstanten(baum: ts.SourceFile): Map<string, string | null> {
  const aus = new Map<string, string | null>();
  // Eine zweite Bindung MIT ANDEREM WERT macht den Namen unauflösbar; zweimal derselbe Literalwert
  // bleibt auflösbar, weil dann jede Verdeckung dasselbe bedeutet.
  const setze = (name: string, wert: string | null): void => {
    aus.set(name, aus.has(name) && aus.get(name) !== wert ? null : wert);
  };
  // Ein Bindungsname, dessen Wert nicht statisch feststeht — auch jeder Name in einem Muster.
  const verdecke = (n: ts.BindingName): void => {
    if (ts.isIdentifier(n)) {
      setze(n.text, null);
      return;
    }
    for (const el of n.elements) {
      if (ts.isBindingElement(el)) {
        verdecke(el.name);
      }
    }
  };
  const gehe = (k: ts.Node): void => {
    if (ts.isVariableDeclaration(k)) {
      if (ts.isIdentifier(k.name)) {
        // `k.parent` ist die Deklarationsliste — bei einer `catch`-Bindung ist es die Klausel, also
        // nicht `const`, also `null`. Das ist richtig so.
        const konstant =
          ts.isVariableDeclarationList(k.parent) && (k.parent.flags & ts.NodeFlags.Const) !== 0;
        setze(
          k.name.text,
          konstant && k.initializer !== undefined && ts.isStringLiteral(k.initializer)
            ? k.initializer.text
            : null,
        );
      } else {
        verdecke(k.name);
      }
    } else if (ts.isParameter(k)) {
      verdecke(k.name);
    } else if (
      // Die Formen, die einen WERTNAMEN binden und dabei eine äussere `const` VERDECKEN können.
      // Die Liste ist als LISTE die Schwachstelle — Runde 2 führte nur die beiden DEKLARATIONEN und
      // liess die beiden gleichbedeutenden AUSDRUCKSFORMEN offen (Befund BEN, Runde 2). Deklaration
      // UND Ausdruck stehen deshalb nebeneinander, damit die Lücke nicht wieder zwischen zwei
      // Schreibweisen desselben Gedankens entsteht. Jede Zeile hat ihren Fall in Stufe 2.
      //
      // MASSSTAB FÜR DIE VOLLSTÄNDIGKEIT ist nicht „alles, was einen Namen bindet", sondern „alles,
      // was VERDECKEN kann": beide Bindungen im GLEICHEN Bereich wären ein Doppelname und damit ein
      // Übersetzungsfehler, den es im Produkt nicht gibt. Verdecken kann nur, was sich in einen
      // Funktions- oder Blockrumpf legen lässt — und das sind genau diese fünf. Nicht in der Liste
      // und deshalb auch ohne Zweig: `namespace key {}` und `import key = require(…)` dürfen nicht
      // in einem Funktionsrumpf stehen (TS1235) und können folglich nichts verdecken; `interface`,
      // `type`, Typparameter, Eigenschafts- und Methodennamen sowie `export { x as key }` binden
      // gar keinen Wertnamen. Ein Zweig ohne belegbaren Fall wäre ungeprüfter Code.
      ts.isFunctionDeclaration(k) ||
      ts.isFunctionExpression(k) ||
      ts.isClassDeclaration(k) ||
      ts.isClassExpression(k) ||
      ts.isEnumDeclaration(k)
    ) {
      // Nur die Ausdrucksformen dürfen namenlos sein (`const f = function () {}`).
      if (k.name !== undefined) {
        setze(k.name.text, null);
      }
    } else if (ts.isImportSpecifier(k) || ts.isNamespaceImport(k)) {
      setze(k.name.text, null);
    } else if (ts.isImportClause(k) && k.name !== undefined) {
      setze(k.name.text, null);
    }
    ts.forEachChild(k, gehe);
  };
  gehe(baum);
  return aus;
}

/** Was in EINEM Modul über Namen bekannt ist — die Grundlage jedes Urteils in diesem Modul. */
interface Umgebung {
  deck: Moduldeck | undefined;
  tiefe: number;
  besucht: ReadonlySet<string>;
  /** Name → Stringwert, oder `null` für „nicht statisch auflösbar". */
  konstanten: Map<string, string | null>;
  /** Namen, deren AUFRUF schreibt: Alias-Ketten und schreibende benannte Importe. */
  indirekt: Set<string>;
  /** `import * as h from "./m"` → h → das aufgelöste Modul. */
  namensraeume: Map<string, Modulfund>;
}

function umgebungFuer(
  baum: ts.SourceFile,
  datei: string,
  deck: Moduldeck | undefined,
  tiefe: number,
  besucht: ReadonlySet<string>,
): Umgebung {
  const indirekt = new Set<string>();
  const namensraeume = new Map<string, Modulfund>();
  const bindungen: Array<{ name: string; init: ts.Expression | undefined }> = [];

  const sammle = (k: ts.Node): void => {
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name)) {
      bindungen.push({ name: k.name.text, init: k.initializer });
    }
    // (4b) IMPORT: benannte Importe, deren Export im Zielmodul schreibt — und (JOB 3119,
    // Lieferung 2) NAMENSRAUM-Importe, deren Modul hier nur gemerkt wird: ob `h.name(…)`
    // schreibt, entscheidet erst die Aufrufstelle, denn ein Namensraum bringt alle Exporte mit.
    if (
      tiefe > 0 &&
      ts.isImportDeclaration(k) &&
      k.importClause?.namedBindings !== undefined &&
      ts.isStringLiteral(k.moduleSpecifier)
    ) {
      const gebunden = k.importClause.namedBindings;
      const fund = loeseModul(datei, k.moduleSpecifier.text, deck);
      if (fund !== null) {
        if (ts.isNamedImports(gebunden)) {
          for (const el of gebunden.elements) {
            const exportName = (el.propertyName ?? el.name).text;
            if (exportSchreibt(fund, exportName, deck, tiefe - 1, besucht)) {
              indirekt.add(el.name.text);
            }
          }
        } else {
          namensraeume.set(gebunden.name.text, fund);
        }
      }
    }
    ts.forEachChild(k, sammle);
  };
  sammle(baum);

  // (4a) ALIAS bis zum FIXPUNKT (JOB 3119, Lieferung 1). Bis hierher galt nur eine Bindung als
  // indirekt, deren INITIALISIERER selbst auf eine Schreibmethode zeigt — `const b = a` fiel
  // durch, obwohl `a` bereits als schreibend bekannt war. Jetzt wird die Menge fortgeschrieben,
  // bis sie sich nicht mehr ändert: das deckt zwei, drei und jede weitere Ebene, und ebenso den
  // Alias auf einen schreibenden IMPORT (deshalb stehen die Importe oben, vor dem Fixpunkt).
  let geaendert = true;
  while (geaendert) {
    geaendert = false;
    for (const b of bindungen) {
      if (indirekt.has(b.name)) {
        continue;
      }
      const zeigt =
        zeigtAufSchreibmethode(b.init) ||
        (b.init !== undefined && ts.isIdentifier(b.init) && indirekt.has(b.init.text));
      if (zeigt) {
        indirekt.add(b.name);
        geaendert = true;
      }
    }
  }

  return { deck, tiefe, besucht, konstanten: stringKonstanten(baum), indirekt, namensraeume };
}

/**
 * Eine der DIREKTEN Schreibformen — ohne Alias, Import und Namensraum. Diese eine Stelle
 * beurteilt sowohl den gemessenen Baum als auch den Rumpf jedes verfolgten Helfers: ein zweiter,
 * engerer Satz Regeln für Helfer wäre genau die Sorte Doppelung, an der ein Weg vorbeiläuft.
 */
function istDirekteSchreibform(k: ts.Node, konstanten: Map<string, string | null>): boolean {
  if (ts.isBinaryExpression(k) && k.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    // (1) Eigenschaft über den Punkt.
    if (
      ts.isPropertyAccessExpression(k.left) &&
      SCHREIB_EIGENSCHAFTEN_ERHEBUNG.has(k.left.name.text)
    ) {
      return true;
    }
    // (2) Eigenschaft über einen Schlüssel: unmittelbares Literal ODER (JOB 3119, Lieferung 4)
    // ein Bezeichner, der im selben Baum eindeutig als `const` auf ein Literal gebunden ist.
    if (ts.isElementAccessExpression(k.left)) {
      const schluessel: ts.Expression | undefined = k.left.argumentExpression;
      const name =
        schluessel === undefined
          ? null
          : ts.isStringLiteral(schluessel)
            ? schluessel.text
            : ts.isIdentifier(schluessel)
              ? (konstanten.get(schluessel.text) ?? null)
              : null;
      if (name !== null && SCHREIB_EIGENSCHAFTEN_ERHEBUNG.has(name)) {
        return true;
      }
    }
  }
  if (ts.isCallExpression(k) && ts.isPropertyAccessExpression(k.expression)) {
    // (3) knoteneinfügende Methoden über den Punkt.
    if (KNOTEN_METHODEN.has(k.expression.name.text)) {
      return true;
    }
    // (5) JOB 3119, Lieferung 5: `Reflect.set(ziel, "innerHTML", html)` — dieselbe Wirkung wie
    // (1), aber der Schreibname steht als ARGUMENT da und in keiner Methodenliste. `Reflect.get`
    // und ein `Reflect.set` auf eine andere Eigenschaft bleiben ungemeldet.
    if (
      k.expression.name.text === "set" &&
      ts.isIdentifier(k.expression.expression) &&
      k.expression.expression.text === "Reflect"
    ) {
      const eigenschaft: ts.Expression | undefined = k.arguments[1];
      if (
        eigenschaft !== undefined &&
        ts.isStringLiteral(eigenschaft) &&
        SCHREIB_EIGENSCHAFTEN_ERHEBUNG.has(eigenschaft.text)
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Schreibt dieser Knoten — direkt, über einen Alias, einen Import oder einen Namensraum? */
function istSchreibstelle(k: ts.Node, u: Umgebung): boolean {
  if (istDirekteSchreibform(k, u.konstanten)) {
    return true;
  }
  if (!ts.isCallExpression(k)) {
    return false;
  }
  // (4) Aufruf eines Alias- oder importierten Schreibnamens — direkt `f(…)`.
  if (ts.isIdentifier(k.expression) && u.indirekt.has(k.expression.text)) {
    return true;
  }
  if (ts.isPropertyAccessExpression(k.expression) && ts.isIdentifier(k.expression.expression)) {
    const traeger = k.expression.expression.text;
    const name = k.expression.name.text;
    // … ODER über `f.call(…)` / `f.apply(…)`. Diese Form hat dieser Wächter beim Bauen selbst
    // aufgedeckt: sie ist eine PropertyAccessExpression und wäre der Identifier-Prüfung entgangen.
    if ((name === "call" || name === "apply") && u.indirekt.has(traeger)) {
      return true;
    }
    // … ODER über einen Namensraum: `h.name(…)` gilt, wenn der Export `name` schreibt.
    const raum = u.namensraeume.get(traeger);
    if (raum !== undefined && exportSchreibt(raum, name, u.deck, u.tiefe - 1, u.besucht)) {
      return true;
    }
  }
  return false;
}

/**
 * Schreibt der benannte Export dieses Moduls — selbst oder über einen weiteren Helfer?
 * JOB 3119 (Lieferung 3): bis hierher wurde nur der Rumpf des Exports im DIREKT importierten
 * Modul durchsucht; eine Kette `probe → helfer → tief` blieb unerhoben. Jetzt trägt der Rumpf
 * dieselbe Umgebung wie jedes andere Modul, also auch dessen eigene Importe — begrenzt durch
 * `IMPORTKETTEN_TIEFE` und den Zyklusschutz `besucht`.
 */
function exportSchreibt(
  modul: Modulfund,
  exportName: string,
  deck: Moduldeck | undefined,
  tiefe: number,
  besucht: ReadonlySet<string>,
): boolean {
  if (tiefe < 0) {
    return false;
  }
  const schluessel = `${modul.pfad}::${exportName}`;
  // ZYKLUSSCHUTZ: `a → b → a` bricht hier ab. Kein Fund, kein Absturz, keine Endlosschleife.
  if (besucht.has(schluessel)) {
    return false;
  }
  const baum = baumGeparst(modul.pfad, modul.quelle);
  const u = umgebungFuer(baum, modul.pfad, deck, tiefe, new Set([...besucht, schluessel]));
  let gefunden = false;
  const imRumpf = (k: ts.Node): void => {
    if (istSchreibstelle(k, u)) {
      gefunden = true;
    }
    ts.forEachChild(k, imRumpf);
  };
  const suche = (k: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(k) && k.name?.text === exportName) ||
      (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.name.text === exportName)
    ) {
      imRumpf(k);
    }
    ts.forEachChild(k, suche);
  };
  suche(baum);
  return gefunden;
}

function erhebeSchreibstellen(vorgabe?: {
  datei: string;
  quelltext: string;
  deck?: Moduldeck;
}): Schreibstelle[] {
  // JOB 2085 D1: die Erhebung ist einspeisbar. OHNE das lässt sich nicht belegen, dass sie eine
  // Form ERKENNT — man sähe nur, dass sie im heutigen Editor nichts findet, und das ist von
  // „sie ist blind" nicht zu unterscheiden. Ohne Vorgabe misst sie unverändert den Editor.
  const datei = vorgabe?.datei ?? EDITOR;
  const { baum } = vorgabe ? baumAus(vorgabe.datei, vorgabe.quelltext) : baumVon(EDITOR);
  const u = umgebungFuer(baum, datei, vorgabe?.deck, IMPORTKETTEN_TIEFE, new Set<string>());

  const gefunden = new Map<string, boolean>();
  const merke = (k: ts.Node): void => {
    const id = huelleVon(k, baum);
    const rumpf = rumpfText(k, baum);
    // JOB 2060 D4: `ensureImageAnchors` zählt ebenso. Bis hierher erkannte die Erhebung allein
    // `verankereFiguren` — den Wrapper, der die Invariante ruft UND die Übersetzungstexte setzt.
    // Die Emissionsgrenze braucht die Texte nicht (sie schreibt nichts, was der Nutzer sieht) und
    // ruft deshalb die Invariante direkt. Ohne diese Zeile hielte der Sammler eine Stelle für
    // nicht verankernd, die verankert — ein Fehlalarm, der die richtige Bauform bestraft hätte.
    gefunden.set(
      id,
      // JOB 2085 D1: `enhanceFiguresForEditing` zählt ebenso — es ist die dritte Gestalt derselben
      // Invariante (der Wrapper `verankereFiguren` ruft genau sie). Ohne diese Ergänzung gälte die
      // eine Verankerungsstelle des Editors selbst als nicht verankernd.
      (gefunden.get(id) ?? false) ||
        /\b(verankereFiguren|ensureImageAnchors|enhanceFiguresForEditing)\s*\(/.test(rumpf),
    );
  };
  const gehe = (k: ts.Node): void => {
    // Die fünf Formen (1)–(5) und die drei Indirektionen stehen in `istSchreibstelle` — derselben
    // Stelle, die auch jeden verfolgten Helferrumpf beurteilt.
    if (istSchreibstelle(k, u)) {
      merke(k);
    }
    if (ts.isCallExpression(k) && SCHREIB_AUFRUFE.test(k.expression.getText(baum))) {
      merke(k);
    }
    ts.forEachChild(k, gehe);
  };
  gehe(baum);
  return Array.from(gefunden, ([id, verankert]) => ({ id, verankert })).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}

// „koerper" = schreibt in den Fließtext des Beitrags → MUSS verankern.
// „formularfeld" = schreibt in das Beschreibungsfeld des Bildbeschreibungs-Formulars. Dort steht
//     kein Bild und darf keines stehen (der Sanitizer der Fußnote lässt kein <img> zu) — Verankern
//     wäre dort sinnlos, nicht vergessen.
// „generisch" = eine Hilfsfunktion, die in das ihr GEREICHTE Element schreibt. Sie kann die Pflicht
//     nicht tragen, weil sie das Ziel nicht kennt; die Auflage ist, dass jeder ihrer Aufrufer selbst
//     erhoben und disponiert ist. Genau das wird unten geprüft.
// JOB 2060 D4 (I47, erstens): `emissionspuffer` ist neu. Er wird gebraucht, weil die
// Emissionsgrenze seit diesem Durchgang HTML schreibt — aber in ein Element, das NIE im Dokument
// hängt. `koerper` wäre bequem gewesen (die Prüfung „verankert" bestünde sie), stünde aber als
// falsche Auskunft im Register: `emit()` schreibt nicht in den Beitragskörper. Eine Kategorie, die
// lügt, ist schlechter als eine Kategorie mehr.
type SchreibDisposition = "koerper" | "formularfeld" | "generisch" | "emissionspuffer";

const SCHREIB_DISPOSITION: Readonly<Record<string, SchreibDisposition>> = {
  fuegeAmCursorEin: "generisch",
  // ── JOB 3107 (PRIORITAETEN.md Q5b, Teil 1): AUS `useEffect[value, mode]` IST DIESE STELLE ─────
  //
  // Hier stand `"useEffect[value, mode]": "koerper"` — der Effekt, der eine von außen gekommene
  // Fassung in den Körper schrieb (Entwurf, Beitrag, Altbestand, Vorlage, KI-Vorschlag). Er
  // schreibt nicht mehr selbst: er ENTSCHEIDET nur noch (sofort schreiben, vertagen oder nichts zu
  // tun) und ruft für das Schreiben diese eine Funktion. Der zweite Aufrufer ist der Nachholweg
  // beim Fokusverlust (`onEditorBlur`) — er holt die Fassung nach, die bei liegender Einfügemarke
  // vertagt wurde, und braucht dafür DIESELBEN Folgeschritte (Lauf-Nummern, `captionFormStale`,
  // Trennungsbefund, Verankerung). Ein zweiter, verkürzter Schreibweg wäre genau der Weg, gegen den
  // dieser Wächter gebaut ist.
  //
  // Die Erhebung sieht deshalb ab jetzt `schreibeFremdfassung` statt des Effekts: der Effekt
  // enthält keine Schreibform mehr, die Funktion enthält sie. Die Zusage ist unverändert
  // `koerper` — und sie ist erfüllt, der Rumpf ruft `verankereFiguren(el)`.
  schreibeFremdfassung: "koerper",
  // JOB 3282 (EDITOR-R26): Link UND Block gehen nicht mehr hierüber — `exec` trägt jetzt die
  // Auszeichnungs- und Struktur-Befehle des Browsers (fett, kursiv, Überschriften, Listen) und das
  // Einfügen von Bild/Datei aus den Anhängen. Die Zusage bleibt `koerper`, der Rumpf ruft die
  // Verankerung.
  exec: "koerper", // Werkzeugleiste (fett/kursiv/Listen/Überschriften), Bild und Datei aus Anhängen
  insertHtmlReliable: "koerper", // lokale Dateiauswahl, Drop, Einfügen, Link
  // ── JOB 3282 (EDITOR-R26): DER BLOCK SCHREIBT JETZT SELBST ───────────────────────────────────
  //
  // Bis hierher lief das Einfügen eines Info-/Hinweis-/Warnung-/Erfolg-Blocks über `exec` und war
  // damit von DESSEN Disposition gedeckt. `execCommand("insertHTML")` durfte den `div`-Container
  // in einer Liste oder in einem vorhandenen Block aber auflösen — Codex hat am 08.09. live drei
  // von vier Typen dabei verloren. `addBlock` baut den Block deshalb selbst als Knoten
  // (`lib/editorBlockInsert.ts`) und ist damit eine eigene Schreibstelle im Beitragskörper.
  //
  // `koerper` und die Pflicht daraus ist erfüllt: der Rumpf ruft `verankereFiguren(el)`, denselben
  // Abschluss wie `insertHtmlReliable`. Ein Block bringt zwar von sich aus kein Bild mit — aber die
  // Verankerung hängt hier nicht am Inhalt DIESER Einfügung, sondern daran, dass der Körper nach
  // JEDER Schreibstelle die Invariante erfüllt (I47).
  addBlock: "koerper",
  captionFormat: "formularfeld", // fett/kursiv/Umbruch im Beschreibungsfeld
  "useEffect[captionFieldEpoch]": "formularfeld", // Befüllen des Feldes beim Öffnen
  emit: "emissionspuffer", // JOB 2060 D4: abgekoppelte Kopie, verankert, berührt den Editor nicht
  // ── JOB 2085 D1: DREI STELLEN, DIE DIE ERWEITERTE ERHEBUNG ERSTMALS SIEHT ────────────────────
  // Alle drei waren immer da. Der Sammler sah sie nicht, weil `appendChild`/`insertNode` in keiner
  // Liste standen und importierte Helfer gar nicht verfolgt wurden.
  //
  // Fügt ausschließlich `<strong>`/`<em>` um eine bestehende Auswahl ein
  // (`RichTextEditor.tsx`, `tag: "strong" | "em"`) — kann kein Bild in den Körper bringen.
  // `generisch` wie `fuegeAmCursorEin`: in welches Element geschrieben wird, bestimmt der Aufrufer.
  umschliesseAuswahlMit: "generisch",
  // Ruft den importierten `applyCaptionHtml` — er schreibt in das Feld des
  // Bildbeschreibungs-Formulars, nicht in den Beitragskörper.
  saveCaptionForm: "formularfeld",
  // Das ist `verankereFiguren` (useCallback mit `[t]`) — die EINE Aufrufstelle der Invariante.
  // Sie schreibt über `enhanceFiguresForEditing` in das Element, das der Aufrufer übergibt; ihre
  // fünf Aufrufer sind einzeln disponiert. Sie IST die Verankerung, nicht ein Weg an ihr vorbei.
  "useCallback[t]": "generisch",
  // ── JOB 3055 (PRIORITAETEN.md V7): DER ZUORDNUNGS-KLICK ──────────────────────────────────────
  //
  // Die Erhebung sieht diese Stelle, weil sie `ordneFussnoteZu` ruft — einen benannten Import aus
  // `editorFigures.ts`, dessen Export selbst schreibt (`caption.outerHTML`). Genau dafür ist der
  // Import-Zweig (4b) gebaut, und er hat hier zum ersten Mal einen echten Neuzugang gefunden.
  //
  // `koerper` und nichts anderes: Die Zuordnung verschiebt eine Bildbeschreibung IM Fließtext des
  // Beitrags — sie nimmt sie von ihrer Stelle und setzt sie als direktes Kind in die figure ihres
  // Bildes. Das ist der Beitragskörper, nicht das Formularfeld und keine abgekoppelte Kopie. Mit
  // dieser Disposition greift die Pflicht der nächsten Zusicherung („jede Körper-Schreibstelle
  // ruft die Verankerung"), und sie ist erfüllt: der Rumpf ruft `verankereFiguren(el)`.
  ordneFussnoteDemBildZu: "koerper",
};

// ── Stufe 3: OB ES WIRKT ───────────────────────────────────────────────────────────────────────

interface ElementLike {
  innerHTML: string;
  querySelectorAll(selectors: string): Iterable<{
    getAttribute(name: string): string | null;
    closest(selectors: string): { querySelector(s: string): ElementLike | null } | null;
  }>;
}
const doc = (globalThis as unknown as { document: { createElement(t: string): ElementLike } })
  .document;

/** Wie viele Bilder in diesem HTML tragen figure + Fußnote + beidseitig dieselbe Kennung? */
function verankerteBilder(html: string): { bilder: number; verankert: number } {
  const el = doc.createElement("div");
  el.innerHTML = html;
  let bilder = 0;
  let verankert = 0;
  for (const img of el.querySelectorAll("img")) {
    bilder += 1;
    const figure = img.closest("figure");
    const cap = figure?.querySelector(":scope > figcaption") as {
      getAttribute(n: string): string | null;
    } | null;
    const id = img.getAttribute("data-image-id");
    if (
      figure !== null &&
      cap !== null &&
      id !== null &&
      id === cap.getAttribute("data-image-id")
    ) {
      verankert += 1;
    }
  }
  return { bilder, verankert };
}

/** Das echte Markup eines Weges durch die zentrale Stelle fahren — Wirkung, nicht Behauptung. */
function durchDieInvariante(html: string): string {
  const el = doc.createElement("div");
  el.innerHTML = html;
  enhanceFiguresForEditing(
    el as unknown as Parameters<typeof enhanceFiguresForEditing>[0],
    "✎ …",
    "Bildbeschreibung öffnen",
  );
  return el.innerHTML;
}

const TINY = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

// Das ECHTE Markup je Weg mit Disposition „trägt die Invariante" — die Produktfunktion wird
// aufgerufen, nicht nachgebaut. Ein Nachbau wäre genau der Fehler, den dieser Sammler sucht.
const WEGE_MIT_INVARIANTE: Readonly<Record<string, () => string>> = {
  "apps/web/src/lib/richText.ts::insertImageSrcHtml": () =>
    `<p>Vor dem Ausbau</p>${insertImageSrcHtml(TINY, "Führungsschiene")}${insertImageHtml("obj-1", "Lager")}`,
  "apps/web/src/lib/wordAddin.ts::fillWordImages": () =>
    fillWordImages('<p>Aus Word</p><img src="cid:bild1">', [TINY]).html,
};

// ── Die Zusicherungen ──────────────────────────────────────────────────────────────────────────

describe("AUFTRAG-mega88 Block E, Stufe 1: wer Bildmarkup erzeugt, hat ein Urteil", () => {
  const erzeuger = erhebeErzeuger();

  it("die Erhebung findet überhaupt etwas (sonst prüft dieser Sammler nichts)", () => {
    expect(
      erzeuger.length,
      "Die Erhebung hat keine einzige bildmarkup-erzeugende Stelle gefunden — dann ist der Wächter blind, nicht grün",
    ).toBeGreaterThan(3);
  });

  it("kein bekannter Weg ist verschwunden, kein neuer ohne Disposition dazugekommen", () => {
    const erhoben = new Set(erzeuger.map((e) => e.id));
    const disponiert = new Set(Object.keys(ERZEUGER_DISPOSITION));
    const neu = [...erhoben].filter((id) => !disponiert.has(id));
    const weg = [...disponiert].filter((id) => !erhoben.has(id));
    expect(
      neu,
      "NEUER Weg, auf dem Bildmarkup entsteht, ohne Entscheidung: trägt er den Anker selbst, oder läuft er durch die Invariante? Diese Frage muss beantwortet werden, bevor der Weg ausgeliefert wird",
    ).toEqual([]);
    expect(
      weg,
      "Ein bekannter Weg ist verschwunden. Wurde er umbenannt, ist die Disposition nachzuziehen; wurde er entfernt, ist sie zu löschen",
    ).toEqual([]);
  });

  it("jeder Weg hält, was seine Disposition sagt", () => {
    for (const { id, urteil } of erzeuger) {
      const disposition = ERZEUGER_DISPOSITION[id];
      if (disposition === "traegt-anker-selbst") {
        expect(
          urteil,
          `${id} ist als selbst verankernd disponiert, erzeugt aber ein nacktes Bild (figure, figcaption oder data-image-id fehlt)`,
        ).toBe("anker");
      }
      // AUFTRAG-mega89: ein Leser, der plötzlich vollständiges Ankermarkup baut, ist keiner mehr.
      if (disposition === "liest-markup") {
        expect(
          urteil,
          `${id} ist als reine LESE-Stelle disponiert, baut aber vollständiges Ankermarkup. Dann ist es ein Erzeuger, und die Entscheidung gehört neu gefällt.`,
        ).toBe("nackt");
      }
    }
  });

  // AUFTRAG-mega90 Block D — hier wird die Ausnahme eng.
  // JOB 1185 D1: der Testname sagt jetzt, was wirklich geprüft wird. Vorher hiess er „keine
  // Schreibform"; das war die allgemeine Zusage, die die Erhebung nicht halten kann (s. Kopf).
  it("jede `liest-markup`-Stelle belegt: keine BEKANNTE DIREKTE Schreibform, jedes <img> ein Suchmuster", () => {
    const leser = Object.entries(ERZEUGER_DISPOSITION).filter(([, d]) => d === "liest-markup");
    expect(
      leser.length,
      "Keine einzige Stelle trägt diese Disposition — dann prüft dieser Wächter nichts",
    ).toBeGreaterThan(0);
    for (const [id] of leser) {
      const datei = id.split("::")[0] ?? "";
      expect(
        leserBefunde(datei, readFileSync(join(WURZEL, datei), "utf8")),
        `${datei} ist als reine LESE-Stelle disponiert, belegt das aber nicht. „Baut keinen vollständigen Anker" beweist nicht „schreibt nichts".`,
      ).toEqual([]);
    }
  });

  // ==============================================================================================
  // JOB 1185 D1 — DIE GRENZE DER ZUSAGE IST GEMESSEN, NICHT BEHAUPTET.
  // ==============================================================================================
  //
  // Der Kopf dieses Blocks sagt seit JOB 1185, dass die Erhebung nur BEKANNTE DIREKTE Schreibformen
  // sieht. Ein Satz im Kommentar ist aber genau die Sorte Zusage, die hier gerade korrigiert wurde:
  // er kann veralten, ohne dass es jemand merkt. Deshalb steht die Grenze hier als FALL.
  //
  // ER IST BEWUSST HERUM GEBAUT: er belegt, dass die vier Formen NICHT erkannt werden. Schliesst
  // jemand später eine davon (Weg B), wird DIESER Fall rot — und zwingt damit dazu, im selben Zug
  // auch die Zusage im Kopf wieder zu erweitern. Ohne ihn liefen Erhebung und Zusage erneut
  // auseinander, nur in die andere Richtung.
  //
  // Gefahren wird durch DIESELBE Funktion, die oben den echten Baum beurteilt — eine Attrappe der
  // Prüflogik würde nichts belegen.
  const AUSLAGERUNGSFORMEN: ReadonlyArray<readonly [string, string]> = [
    [
      "(a) Zuweisung über einen Zeichenkettenschlüssel",
      'export function s(ziel: Record<string, string>, html: string): void { ziel["innerHTML"] = html; }',
    ],
    [
      "(b) Reflect.set",
      'export function s(ziel: object, html: string): void { Reflect.set(ziel, "innerHTML", html); }',
    ],
    [
      "(c) aliasierter Methodenaufruf",
      "export function s(ziel: HTMLElement, k: Node): void { const f = ziel.appendChild.bind(ziel); f(k); }",
    ],
    [
      "(d) importierter Schreibhelfer",
      'import { enhanceFiguresForEditing } from "./editorFigures";\nexport function s(ziel: HTMLElement): void { enhanceFiguresForEditing(ziel, "x", "y"); }',
    ],
  ];

  it("die vier Auslagerungsformen aus I50 sind NICHT erfasst — die Zusage ist entsprechend eng", () => {
    for (const [name, quelle] of AUSLAGERUNGSFORMEN) {
      expect(
        leserBefunde("apps/web/src/lib/erfundene-auslagerung.ts", quelle),
        `${name} wird jetzt ERKANNT. Das ist ein Fortschritt — aber die Zusage im Kopf dieses Blocks ist noch die enge („keine BEKANNTEN DIREKTEN Schreibformen"). Erweitere sie im selben Zug, sonst sagt der Wächter erneut weniger, als er kann.`,
      ).toEqual([]);
    }
  });

  it("KALIBRIERUNG — die vier Formen schreiben wirklich, der direkte Fall wird erkannt", () => {
    // Ohne diesen Fall wäre der Fall darüber wertlos: „nicht erkannt" könnte auch heissen, dass
    // `leserBefunde` gar nichts erkennt. Die DIREKTE Gestalt derselben Wirkung MUSS auffallen.
    expect(
      leserBefunde(
        "apps/web/src/lib/erfundene-auslagerung.ts",
        "export function s(ziel: HTMLElement, html: string): void { ziel.innerHTML = html; }",
      ),
      "die direkte Zuweisung an innerHTML MUSS erkannt werden",
    ).not.toEqual([]);
    expect(
      leserBefunde(
        "apps/web/src/lib/erfundene-auslagerung.ts",
        "export function s(ziel: HTMLElement, k: Node): void { ziel.appendChild(k); }",
      ),
      "der direkte Aufruf von appendChild MUSS erkannt werden",
    ).not.toEqual([]);
  });

  // DIE ZELLE, DIE IN mega89 GEFEHLT HAT, und sie ist der ganze Punkt dieses Blocks: ein ERFUNDENER
  // neuer Erzeuger von nacktem <img>-Markup, der sich als `liest-markup` einträgt. Er bekommt von der
  // Erhebung dasselbe Urteil `nackt` wie ein echter Leser — die mega89-Zusicherung hätte ihn also
  // durchgelassen. Gefahren wird er durch DIESELBEN Funktionen, die oben den echten Baum beurteilen;
  // eine Attrappe der Prüflogik würde nichts belegen.
  const ERFUNDENER_ERZEUGER = [
    "export function bildKachelHtml(src: string, id: string): string {",
    '  return `<div class="kachel"><img src="${src}" data-kachel="${id}"></div>`;',
    "}",
    "export function schreibeKachel(ziel: { innerHTML: string }, src: string): void {",
    "  ziel.innerHTML = bildKachelHtml(src, 'k1');",
    "}",
  ].join("\n");

  it("ein ERFUNDENER Erzeuger, der sich als `liest-markup` einträgt, macht den Sammler rot", () => {
    const datei = "apps/web/src/lib/erfundene-bildkachel.ts";
    const erhoben = erhebeAusQuelle(datei, ERFUNDENER_ERZEUGER);
    // Vorbedingung: die Erhebung sieht ihn — und fällt genau das Urteil, das die alte Zusicherung
    // verlangt hätte. Ohne diesen Nachweis prüfte die Zeile darunter am Problem vorbei.
    expect(
      erhoben.map((e) => e.urteil),
      "Die Erhebung sieht den erfundenen Erzeuger nicht oder urteilt anders als erwartet",
    ).toEqual(["nackt"]);

    expect(
      leserBefunde(datei, ERFUNDENER_ERZEUGER),
      "Ein Erzeuger von nacktem <img>-Markup passiert die `liest-markup`-Ausnahme, ohne seine Leser-Eigenschaft zu belegen — genau die Abschwächung aus sammel89",
    ).not.toEqual([]);
  });
});

describe("AUFTRAG-mega88 Block E, Stufe 2: jede Schreibstelle im Körper verankert", () => {
  const stellen = erhebeSchreibstellen();

  it("kein bekannter Schreibweg ist verschwunden, kein neuer ohne Disposition dazugekommen", () => {
    const erhoben = new Set(stellen.map((s) => s.id));
    const disponiert = new Set(Object.keys(SCHREIB_DISPOSITION));
    expect(
      [...erhoben].filter((id) => !disponiert.has(id)),
      "NEUE Stelle, die HTML in ein Element des Editors schreibt, ohne Entscheidung: schreibt sie in den Beitragskörper (dann muss sie verankern) oder ins Beschreibungsfeld?",
    ).toEqual([]);
    expect(
      [...disponiert].filter((id) => !erhoben.has(id)),
      "Eine bekannte Schreibstelle ist verschwunden — die Disposition zeigt ins Leere",
    ).toEqual([]);
  });

  it("jede Körper-Schreibstelle ruft die Verankerung — hier bricht ein vorbeigeführter Weg", () => {
    for (const { id, verankert } of stellen) {
      if (SCHREIB_DISPOSITION[id] === "koerper") {
        expect(
          verankert,
          `${id} schreibt HTML in den Beitragskörper, verankert aber nicht. Ein Bild, das auf diesem Weg hereinkommt, hätte keine Fußnote — genau der Auslieferungsblocker aus mega88.`,
        ).toBe(true);
      }
    }
  });

  it("JOB 2060 D4: die Emissionsgrenze verankert — sonst wäre ihre Kategorie nur ein Etikett", () => {
    // `emissionspuffer` nimmt die Stelle von der Körper-Pflicht aus, weil sie nicht in den Körper
    // schreibt. Ohne diese Prüfung wäre die Ausnahme ein Freibrief: eine Stelle, die HTML schreibt
    // und NICHT verankert, könnte sich dahinter verstecken. Genau das ist der Weg, den I47
    // (erstens) schließen sollte.
    const emissionsstellen = stellen.filter(
      ({ id }) => SCHREIB_DISPOSITION[id] === "emissionspuffer",
    );
    expect(
      emissionsstellen.length,
      "keine Stelle ist als `emissionspuffer` erhoben — dann ist der Verschluss aus JOB 2060 D4 verschwunden",
    ).toBeGreaterThan(0);
    for (const { id, verankert } of emissionsstellen) {
      expect(
        verankert,
        `${id} ist die Emissionsgrenze, verankert aber nicht. Dann verlässt unverankerte Struktur den Editor — I47 (erstens) ist wieder offen.`,
      ).toBe(true);
    }
  });

  // ── JOB 2085 D1 (I47, zweitens): WAS DIE ERHEBUNG SIEHT — eingespeist, nicht behauptet ───────
  //
  // Ohne Einspeisung liesse sich nicht belegen, dass eine Form ERKANNT wird: ein Lauf gegen den
  // heutigen Editor kann „findet nichts, weil nichts da ist" nicht von „findet nichts, weil blind"
  // unterscheiden. Genau daran ist D5 gescheitert.
  const eingespeist = (
    rumpf: string,
    kopf = "",
    deck?: Readonly<Record<string, string>>,
  ): string[] =>
    erhebeSchreibstellen({
      datei: "apps/web/src/components/probe.tsx",
      quelltext: `${kopf}function probe(ziel: HTMLElement, knoten: Node, html: string) {\n${rumpf}\n}\n`,
      ...(deck ? { deck } : {}),
    }).map((s) => s.id);

  it("JOB 2085 · P-1/P-2: der gebundene METHODENALIAS wird erhoben", () => {
    expect(
      eingespeist("const anhaengen = ziel.appendChild.bind(ziel); anhaengen(knoten);"),
      "der über `.bind()` gebundene Alias entgeht der Erhebung — I47 (zweitens) ist offen",
    ).toContain("probe");

    expect(
      eingespeist("const f = ziel.appendChild; f.call(ziel, knoten);"),
      "die blosse Methodenreferenz entgeht der Erhebung",
    ).toContain("probe");
  });

  it("JOB 2085 · P-3: der IMPORTIERTE schreibende Helfer wird erhoben", () => {
    // Der Zwei-Dateien-Fall aus Prüflücke 2 des D5-Urteils: ein importierter Helfer fügt über
    // `appendChild` ein Bild in das übergebene Ziel ein.
    const deck = {
      "./schreiber":
        "export function schreibeIrgendwohin(z: HTMLElement) { z.appendChild(document.createElement('img')); }",
      "./leser": "export function lieseNur(z: HTMLElement) { return z.childNodes.length; }",
    };
    expect(
      eingespeist(
        "schreibeIrgendwohin(ziel);",
        'import { schreibeIrgendwohin } from "./schreiber";\n',
        deck,
      ),
      "ein importierter schreibender Helfer passiert die Erhebung ungesehen — genau die Lücke aus I47 (zweitens)",
    ).toContain("probe");

    // N-2: derselbe Weg, aber der Helfer LIEST nur.
    expect(
      eingespeist("lieseNur(ziel);", 'import { lieseNur } from "./leser";\n', deck),
      "ein rein lesender Import wird als Schreibstelle gemeldet — Fehlalarm",
    ).not.toContain("probe");
  });

  it("JOB 2085 · N-1/N-3 · KALIBRIERUNG: die Erhebung meldet nicht einfach alles", () => {
    // Ohne diesen Fall wären die Positivfälle auch dann grün, wenn `eingespeist` jede Eingabe als
    // Treffer meldete — dann bewiesen sie nichts.
    expect(
      eingespeist("const laenge = ziel.childNodes.length; void laenge;"),
      "eine reine Lesebindung wird als Schreibstelle erhoben",
    ).not.toContain("probe");

    expect(
      eingespeist('const s = ziel.setAttribute.bind(ziel); s("data-x", "1");'),
      "`setAttribute` wird erhoben — es setzt Attribute an vorhandenen Knoten und kann kein Bild " +
        "in den Körper bringen (Abgrenzung im Kopf der Erhebung)",
    ).not.toContain("probe");
  });

  it("JOB 2085 · DIE GRENZE: ein Paketimport wird NICHT verfolgt — benannt statt verschwiegen", () => {
    // Die Modulauflösung folgt ausschliesslich RELATIVEN Pfaden. Ein Import aus einem Paket unter
    // `node_modules` wird nicht geparst; ein schreibender Helfer von dort bliebe unerhoben.
    //
    // OB DAS SO BLEIBT, IST EINE ENTSCHEIDUNG UND KEIN MESSERGEBNIS — `OF-2060-2` liegt beim Chef:
    // rot (wie die I50-Erhebung, die zur sicheren Seite irrt) oder still (wie hier). Dieser Fall
    // hält den heutigen Zustand fest, damit die Lücke nicht im Kopfkommentar verschwindet.
    //
    // WIRD ER ROT, ist die Entscheidung gefallen oder die Auflösung erweitert — dann gehört er
    // ersetzt, nicht angepasst.
    expect(
      eingespeist("fremdSchreiber(ziel);", 'import { fremdSchreiber } from "ein-paket";\n'),
      "ein Paketimport wird inzwischen verfolgt — dann ist OF-2060-2 entschieden und dieser Fall " +
        "gehört ersetzt, nicht angepasst",
    ).not.toContain("probe");
  });

  // ── JOB 3119 (PRIORITAETEN.md I47b): FÜNF FORMEN, AN DENEN DIE ERHEBUNG VORBEISAH ────────────
  //
  // Gemessen am unveränderten Sammler (Lauf `R-0041-bildstruktur-20260906-0500`, Quellhash
  // `6f89b562…`): dreizehn eingespeiste Quelltexte, acht erkannt, fünf mit `ergebnis: []`. Diese
  // fünf werden hier eingespeist — jeder Positivfall mit seiner Gegenprobe, damit „erkannt" nicht
  // heisst „meldet alles". Die Gegenproben waren schon vor dem Bau grün und müssen es bleiben.

  it("JOB 3119 · I47b-1: der Alias über MEHRERE Bindungen wird erhoben", () => {
    expect(
      eingespeist("const a = ziel.appendChild.bind(ziel); const b = a; b(knoten);"),
      "der ZWEISTUFIGE Alias entgeht der Erhebung — sie nimmt nur Bindungen auf, deren " +
        "Initialisierer selbst auf eine Schreibmethode zeigt",
    ).toContain("probe");

    expect(
      eingespeist("const a = ziel.appendChild.bind(ziel); const b = a; const c = b; c(knoten);"),
      "der DREISTUFIGE Alias entgeht der Erhebung — die Menge der indirekten Namen wird nicht bis " +
        "zum Fixpunkt fortgeschrieben, sondern nur eine Ebene tief",
    ).toContain("probe");

    // GEGENPROBE: dieselbe Kettenlänge auf einen Wert, der nichts in den Körper bringen kann.
    expect(
      eingespeist('const a = ziel.getAttribute.bind(ziel); const b = a; const c = b; c("data-x");'),
      "eine dreistufige Kette auf `getAttribute` wird als Schreibstelle gemeldet — der Fixpunkt " +
        "verbreitet sich über die Schreibmethoden hinaus (Fehlalarm)",
    ).not.toContain("probe");
  });

  const NAMENSRAUM_DECK = {
    "./helfer": "export function write(z, html) { z.innerHTML = html; }",
    "./nurlesen": "export function lieseNur(z) { return z.childNodes.length; }",
  };

  it("JOB 3119 · I47b-2: der NAMENSRAUM-Import wird aufgelöst wie ein benannter", () => {
    expect(
      eingespeist("h.write(ziel, html);", 'import * as h from "./helfer";\n', NAMENSRAUM_DECK),
      "`import * as h` bleibt unbetrachtet — der Importzweig verlangt benannte Bindungen, und " +
        "`h.write(…)` wird nur auf `call`/`apply` geprüft",
    ).toContain("probe");

    // GEGENPROBE: derselbe Weg über einen Namensraum, dessen Export nur LIEST.
    expect(
      eingespeist("l.lieseNur(ziel);", 'import * as l from "./nurlesen";\n', NAMENSRAUM_DECK),
      "ein rein lesender Namensraum-Export wird als Schreibstelle gemeldet — Fehlalarm",
    ).not.toContain("probe");
  });

  const KETTEN_DECK = {
    "./helfer": 'import { tief } from "./tief";\nexport function write(z) { tief(z); }',
    "./tief": 'export function tief(z) { z.innerHTML = "<img>"; }',
    "./leserhelfer":
      'import { liestTief } from "./liesttief";\nexport function nurLesen(z) { return liestTief(z); }',
    "./liesttief": "export function liestTief(z) { return z.innerHTML; }",
  };

  it("JOB 3119 · I47b-3: die IMPORT-HELFERKETTE wird über eine weitere Ebene verfolgt", () => {
    expect(
      eingespeist("write(ziel);", 'import { write } from "./helfer";\n', KETTEN_DECK),
      "der importierte Helfer schreibt nicht selbst, sondern ruft einen schreibenden Export des " +
        "nächsten Moduls — die Erhebung durchsucht nur den Rumpf des direkt importierten Exports",
    ).toContain("probe");

    // GEGENPROBE: dieselbe Kettenform, deren letztes Glied nur liest.
    expect(
      eingespeist("nurLesen(ziel);", 'import { nurLesen } from "./leserhelfer";\n', KETTEN_DECK),
      "eine Kette, deren letztes Glied nur liest, wird als Schreibstelle gemeldet — Fehlalarm",
    ).not.toContain("probe");
  });

  it("JOB 3119 · I47b-4: der AUFLÖSBARE dynamische Schlüssel wird erhoben", () => {
    expect(
      eingespeist('const key = "innerHTML"; ziel[key] = html;'),
      "der über eine `const`-Bindung aufgelöste Schlüssel entgeht der Erhebung — der " +
        "ElementAccess-Zweig verlangt ein Stringliteral unmittelbar in der Klammer",
    ).toContain("probe");

    // GEGENPROBEN: nicht statisch auflösbar heisst NICHT gemeldet — geraten wird nicht.
    expect(
      eingespeist('let key = "innerHTML"; ziel[key] = html;'),
      "eine `let`-Bindung wird aufgelöst — sie kann bis zur Zuweisung überschrieben sein, die " +
        "Erhebung würde raten",
    ).not.toContain("probe");
    expect(
      eingespeist('const key = "inner" + "HTML"; ziel[key] = html;'),
      "ein zusammengesetzter Schlüssel wird aufgelöst — die Erhebung würde raten",
    ).not.toContain("probe");
    expect(
      eingespeist('const key = "dataset"; ziel[key] = html;'),
      "ein Schlüssel ausserhalb der Schreib-Eigenschaften wird gemeldet — Fehlalarm",
    ).not.toContain("probe");
  });

  it("JOB 3119 R2 · I47b-4b: ein VERDECKENDER Parameter macht den Schlüssel NICHT auflösbar", () => {
    // BEFUND VON BEN (Runde 1, Korrekturpflicht 1): die Schlüsselauflösung sah nur
    // Variablendeklarationen. Ein Funktionsparameter GLEICHEN NAMENS verdeckt die äussere `const`,
    // sein Wert ist zur Bauzeit unbekannt — die Erhebung übernahm trotzdem den Wert der Konstanten
    // und meldete eine Schreibstelle, die keine sein muss. Das ist genau das Raten, das Lieferung 4
    // ausschliesst: nicht statisch auflösbar heisst SCHWEIGEN, nicht „nimm den nächstbesten Wert".
    // Die Schreibstelle liegt im Rumpf von `setze`, also heisst der Fund `setze` und nicht `probe`
    // (`huelleVon` benennt die nächste umschliessende Funktion). Nur so trägt der Parameter, um den
    // es geht, denselben Namen wie die Konstante — die Signatur von `probe` steht im Einspeiser fest.
    expect(
      eingespeist(
        'function setze(key) { ziel[key] = html; }\nsetze("innerHTML");',
        'const key = "innerHTML";\n',
      ),
      "ein Parameter, der eine gleichnamige `const` verdeckt, wird über den Namen aufgelöst — die " +
        "Erhebung rät einen Schlüsselwert, den sie nicht kennt (Fehlalarm)",
    ).not.toContain("setze");

    // Dieselbe Verdeckung, nur destrukturiert — sie darf nicht durch die Maschen fallen.
    expect(
      eingespeist(
        'function setze({ key }) { ziel[key] = html; }\nsetze({ key: "innerHTML" });',
        'const key = "innerHTML";\n',
      ),
      "ein DESTRUKTURIERTER Parameter verdeckt die gleichnamige `const` nicht — die Erhebung rät",
    ).not.toContain("setze");

    // KALIBRIERUNG, in DERSELBEN Bauform: ohne Verdeckung bleibt der Schlüssel auflösbar. Ohne
    // diese Zeile wäre die Schärfung oben auch dann grün, wenn die Auflösung ganz abgeschaltet
    // würde — oder wenn ein Fund im Rumpf einer inneren Funktion gar nicht mehr erhoben würde.
    expect(
      eingespeist(
        "function setze(wert) { ziel[key] = wert; }\nsetze(html);",
        'const key = "innerHTML";\n',
      ),
      "die eindeutige `const`-Bindung wird nicht mehr aufgelöst — die Schärfung gegen verdeckende " +
        "Parameter hat Lieferung 4 mit abgeräumt",
    ).toContain("setze");
  });

  it("JOB 3119 R3 · I47b-4c: auch ein benannter AUSDRUCK verdeckt — Funktion wie Klasse", () => {
    // BEFUND VON BEN (Runde 2, Korrekturpflicht 1): Runde 2 nahm Funktions- und KlassenDEKLARATIONEN
    // in die Verdeckung auf und behauptete „jede weitere Bindung". Die beiden AUSDRUCKSFORMEN fehlten:
    // `const f = function key() {…}` und `const K = class key {…}` binden ihren Namen INNERHALB ihres
    // eigenen Rumpfes — genau dort, wo der Schlüssel gelesen wird. Die äussere Konstante wurde
    // weiterhin eingesetzt, und damit blieb der Fehlalarm für diese zwei Formen bestehen.
    expect(
      eingespeist(
        "const f = function key() { ziel[key] = html; };\nvoid f;",
        'const key = "innerHTML";\n',
      ),
      "ein benannter FUNKTIONSAUSDRUCK verdeckt die gleichnamige `const` nicht — die Erhebung rät " +
        "einen Schlüsselwert, der im Rumpf die Funktion selbst ist (Fehlalarm)",
    ).not.toContain("f");

    expect(
      eingespeist(
        "const K = class key { schreibe() { ziel[key] = html; } };\nvoid K;",
        'const key = "innerHTML";\n',
      ),
      "ein benannter KLASSENAUSDRUCK verdeckt die gleichnamige `const` nicht — die Erhebung rät",
    ).not.toContain("probe");

    // Die fünfte Form, die sich in einen Funktionsrumpf legen lässt und dort verdeckt.
    expect(
      eingespeist("enum key { A }\nziel[key] = html;", 'const key = "innerHTML";\n'),
      "ein `enum` GLEICHEN NAMENS im Rumpf verdeckt die äussere `const` nicht — die Erhebung rät",
    ).not.toContain("probe");

    // KALIBRIERUNG in beiden Bauformen: ohne Namensgleichheit bleibt der Schlüssel auflösbar.
    expect(
      eingespeist(
        "const f = function setze() { ziel[key] = html; };\nvoid f;",
        'const key = "innerHTML";\n',
      ),
      "der Fund im Rumpf eines benannten Funktionsausdrucks entfällt ganz — die Schärfung hat mehr " +
        "abgeräumt als die Verdeckung",
    ).toContain("f");
    expect(
      eingespeist(
        "const K = class Setzer { schreibe() { ziel[key] = html; } };\nvoid K;",
        'const key = "innerHTML";\n',
      ),
      "der Fund im Rumpf eines Klassenausdrucks entfällt ganz — die Schärfung hat mehr abgeräumt " +
        "als die Verdeckung",
    ).toContain("probe");
  });

  it("JOB 3119 · I47b-5: `Reflect.set` auf eine Schreib-Eigenschaft wird erhoben", () => {
    expect(
      eingespeist('Reflect.set(ziel, "innerHTML", html);'),
      "`Reflect.set` entgeht der Erhebung — sein Methodenname steht in keiner Liste",
    ).toContain("probe");

    // GEGENPROBEN: lesend, und schreibend auf eine Eigenschaft ohne Knotenwirkung.
    expect(
      eingespeist('Reflect.get(ziel, "innerHTML");'),
      "`Reflect.get` wird als Schreibstelle gemeldet — Fehlalarm",
    ).not.toContain("probe");
    expect(
      eingespeist('Reflect.set(ziel, "dataset", html);'),
      "`Reflect.set` auf eine Eigenschaft ausserhalb der Liste wird gemeldet — Fehlalarm",
    ).not.toContain("probe");
  });

  // ── JOB 3119: DIE NEUEN GRENZEN, benannt statt verschwiegen ───────────────────────────────────

  it("JOB 3119 · DIE GRENZE: ein NAMENSRAUM aus einem Paket wird NICHT verfolgt", () => {
    // Dieselbe Grenze wie beim benannten Paketimport oben, nur in der neuen Form: `loeseModul`
    // folgt ausschliesslich relativen Pfaden, und daran ändert der Namensraum-Zweig nichts.
    // `OF-2060-2` liegt beim Chef und ist hier NICHT entschieden.
    //
    // WIRD ER ROT, ist die Auflösung erweitert oder die Entscheidung gefallen — dann gehört dieser
    // Fall ERSETZT, nicht angepasst.
    expect(
      eingespeist("p.write(ziel, html);", 'import * as p from "ein-paket";\n'),
      "ein Namensraum aus einem Paket wird inzwischen verfolgt — dann gehört dieser Fall ersetzt, " +
        "nicht angepasst",
    ).not.toContain("probe");
  });

  it("JOB 3119 · DIE GRENZE: eine Importkette jenseits der Tiefengrenze wird NICHT verfolgt", () => {
    // Die Kette wird über höchstens `IMPORTKETTEN_TIEFE` Modulgrenzen verfolgt. Was dahinter liegt,
    // bleibt unerhoben — kein Fund, kein Absturz, keine Endlosschleife.
    //
    // WIRD DER ZWEITE TEIL ROT, ist die Grenze angehoben — dann gehört dieser Fall ERSETZT, nicht
    // angepasst: die Zahl in `IMPORTKETTEN_TIEFE` und der Fall müssen zusammen wandern.
    const stufen = (anzahl: number): Readonly<Record<string, string>> => {
      const deck: Record<string, string> = {};
      for (let i = 1; i < anzahl; i += 1) {
        deck[`./k${i}`] =
          `import { k${i + 1} } from "./k${i + 1}";\nexport function k${i}(z) { k${i + 1}(z); }`;
      }
      deck[`./k${anzahl}`] = `export function k${anzahl}(z) { z.innerHTML = "<img>"; }`;
      return deck;
    };

    // KALIBRIERUNG: genau an der Grenze (drei Modulgrenzen) wird noch verfolgt. Ohne diese Zeile
    // wäre die darunter wertlos — „nicht verfolgt" könnte auch „gar keine Kette verfolgt" heissen.
    expect(
      eingespeist("k1(ziel);", 'import { k1 } from "./k1";\n', stufen(3)),
      "eine Kette GENAU an der Tiefengrenze wird nicht mehr verfolgt — dann ist die Grenze " +
        "enger als `IMPORTKETTEN_TIEFE` behauptet",
    ).toContain("probe");

    expect(
      eingespeist("k1(ziel);", 'import { k1 } from "./k1";\n', stufen(4)),
      "eine Kette JENSEITS der Tiefengrenze wird verfolgt — dann ist die Grenze angehoben und " +
        "dieser Fall gehört ersetzt, nicht angepasst",
    ).not.toContain("probe");
  });

  it("JOB 3119 R2 · der ZYKLISCHE Import hält die Erhebung an, ohne sie blind zu machen", () => {
    // BEFUND VON BEN (Runde 1, Prüflücke 6): der Tiefengrenzen-Fall oben ist eine GERADE Kette und
    // belegt den Zyklusschutz nicht. Hier laufen zwei Module wirklich im Ring. Zwei Aussagen, und
    // die zweite ist die wichtigere: der Ring bricht ab (kein Absturz, keine Endlosschleife) UND er
    // verschluckt nicht den Fund, der im Ring liegt. Ein Zyklusschutz, der alles verstummen lässt,
    // wäre von einem blinden Sammler nicht zu unterscheiden.
    const RING_DECK = {
      "./ring1": 'import { ring2 } from "./ring2";\nexport function ring1(z) { ring2(z); }',
      "./ring2": 'import { ring1 } from "./ring1";\nexport function ring2(z) { ring1(z); }',
      "./sring1": 'import { sring2 } from "./sring2";\nexport function sring1(z) { sring2(z); }',
      "./sring2":
        'import { sring1 } from "./sring1";\nexport function sring2(z) { sring1(z); z.innerHTML = "<img>"; }',
    };

    expect(
      eingespeist("ring1(ziel);", 'import { ring1 } from "./ring1";\n', RING_DECK),
      "ein Ring aus zwei nur weiterreichenden Modulen wird als Schreibstelle gemeldet — der " +
        "Zyklusschutz erfindet einen Fund",
    ).not.toContain("probe");

    expect(
      eingespeist("sring1(ziel);", 'import { sring1 } from "./sring1";\n', RING_DECK),
      "der Ring verschluckt die Schreibstelle, die IN ihm liegt — der Zyklusschutz bricht zu früh " +
        "ab und macht die Erhebung blind",
    ).toContain("probe");
  });

  it("die generische Hilfsfunktion wird nur von erhobenen, disponierten Stellen gerufen", () => {
    const { baum } = baumVon(EDITOR);
    const aufrufer = new Set<string>();
    const gehe = (k: ts.Node): void => {
      if (ts.isCallExpression(k) && k.expression.getText(baum) === "fuegeAmCursorEin") {
        aufrufer.add(huelleVon(k, baum));
      }
      ts.forEachChild(k, gehe);
    };
    gehe(baum);
    aufrufer.delete("fuegeAmCursorEin");
    expect(
      aufrufer.size,
      "Niemand ruft die Hilfsfunktion — die Erhebung greift ins Leere",
    ).toBeGreaterThan(0);
    for (const a of aufrufer) {
      expect(
        SCHREIB_DISPOSITION[a],
        `${a} schreibt über die generische Hilfsfunktion in ein Element, ist aber nicht disponiert`,
      ).toBeDefined();
    }
  });
});

describe("AUFTRAG-mega88 Block E, Stufe 3: die Invariante WIRKT auf jedem Weg, der sie braucht", () => {
  const erzeuger = erhebeErzeuger();

  it("für jeden Weg mit dieser Disposition ist echtes Markup hinterlegt", () => {
    const brauchen = erzeuger
      .filter((e) => ERZEUGER_DISPOSITION[e.id] === "traegt-invariante")
      .map((e) => e.id);
    expect(
      brauchen.length,
      "Kein einziger Weg hängt an der Invariante — das kann nicht sein",
    ).toBeGreaterThan(0);
    for (const id of brauchen) {
      expect(
        WEGE_MIT_INVARIANTE[id],
        `${id} verlässt sich auf die Invariante, wird hier aber nicht GEFAHREN. Eine Disposition ohne Messung ist eine Behauptung.`,
      ).toBeDefined();
    }
  });

  it("jeder dieser Wege liefert nackte Bilder — und bekommt durch die Invariante seinen Anker", () => {
    for (const [id, erzeuge] of Object.entries(WEGE_MIT_INVARIANTE)) {
      const roh = erzeuge();
      const vorher = verankerteBilder(roh);
      expect(vorher.bilder, `${id}: die Bühne enthält gar kein Bild`).toBeGreaterThan(0);
      expect(
        vorher.verankert,
        `${id}: Vorbedingung verletzt — dieser Weg liefert bereits verankerte Bilder, die Disposition gehört korrigiert`,
      ).toBe(0);

      const nachher = verankerteBilder(durchDieInvariante(roh));
      expect(nachher.bilder, `${id}: die Invariante hat ein Bild verloren`).toBe(vorher.bilder);
      expect(
        nachher.verankert,
        `${id}: nach der zentralen Verankerung ist immer noch ein Bild ohne Fußnote. Der Nutzer klickt auf die Bildbeschreibung, und es passiert nichts.`,
      ).toBe(vorher.bilder);
    }
  });

  it("die Kennung wird STABIL vergeben — zweimal verankern ändert sie nicht", () => {
    for (const [id, erzeuge] of Object.entries(WEGE_MIT_INVARIANTE)) {
      const einmal = durchDieInvariante(erzeuge());
      const zweimal = durchDieInvariante(einmal);
      const kennungen = (html: string): string[] =>
        Array.from(html.matchAll(/data-image-id="([^"]+)"/g), (m) => m[1] ?? "");
      expect(
        kennungen(zweimal),
        `${id}: die Bildkennung wurde beim zweiten Verankern neu vergeben. Jede offene Bitte der Galerie und jeder laufende KI-Vorschlag zeigten danach ins Leere.`,
      ).toEqual(kennungen(einmal));
      expect(kennungen(einmal).length).toBeGreaterThan(0);
    }
  });
});
