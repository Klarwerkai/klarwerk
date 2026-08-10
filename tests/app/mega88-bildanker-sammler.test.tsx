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
//   · Alias und Indirektion entgehen der Erhebung (wie in mega86) — dafür bräuchte es den
//     Typprüfer, nicht den Syntaxbaum.
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
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
//   (1) ES SCHREIBT NICHT. Keine DOM-Schreibform im ganzen Modul — keine Zuweisung an
//       `innerHTML`/`outerHTML`/`textContent`/`nodeValue`, kein `insertAdjacentHTML`,
//       `setAttribute`, `appendChild`, `replaceWith`, `append`/`prepend`, `insertBefore`,
//       `replaceChildren`, `createElement`, `document.write`. Ein Modul ohne jede Schreibform kann
//       den Beitragskörper nicht verändern und die Invariante folglich weder tragen noch umgehen.
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

function erhebeSchreibstellen(): Schreibstelle[] {
  const { baum } = baumVon(EDITOR);
  const gefunden = new Map<string, boolean>();
  const merke = (k: ts.Node): void => {
    const id = huelleVon(k, baum);
    const rumpf = rumpfText(k, baum);
    gefunden.set(id, (gefunden.get(id) ?? false) || /\bverankereFiguren\s*\(/.test(rumpf));
  };
  const gehe = (k: ts.Node): void => {
    if (
      ts.isBinaryExpression(k) &&
      k.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(k.left) &&
      k.left.name.text === "innerHTML"
    ) {
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
type SchreibDisposition = "koerper" | "formularfeld" | "generisch";

const SCHREIB_DISPOSITION: Readonly<Record<string, SchreibDisposition>> = {
  fuegeAmCursorEin: "generisch",
  "useEffect[value, mode]": "koerper", // Laden von außen: Entwurf, Beitrag, Altbestand (Block C)
  exec: "koerper", // Werkzeugleiste, Bild aus Anhängen, Link, Block
  insertHtmlReliable: "koerper", // lokale Dateiauswahl, Drop, Einfügen
  captionFormat: "formularfeld", // fett/kursiv/Umbruch im Beschreibungsfeld
  "useEffect[captionFieldEpoch]": "formularfeld", // Befüllen des Feldes beim Öffnen
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
  it("jede `liest-markup`-Stelle BELEGT, dass sie liest: keine Schreibform, jedes <img> ein Suchmuster", () => {
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
