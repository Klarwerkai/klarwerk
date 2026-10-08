// ================================================================================================
// DIE MODALGRENZE — DIE ERHEBUNG, IM PRODUKT STATT IM TEST.
// ================================================================================================
//
// JOB 2008 D2 (Register A17). Bis hierher lag diese Erhebung vollstaendig in
// `tests/app/mega47-modale-flaechen-sammler.test.tsx`. Sie war richtig gebaut — ueber den echten
// Syntaxbaum, mit Alias-Aufloesung und `createElement` — aber sie lebte ausschliesslich im Test:
// `erhebeVerweise` und `ALLE_ERHEBUNGEN` kamen im Produkt NULL mal vor. Ein Test ist kein Aufrufer.
//
// WAS SICH AENDERT: nur der ORT. Kein Zeichen der Erhebungslogik ist umgeschrieben — die Zeilen
// sind aus der Testdatei hierher verschoben und tragen jetzt `export`. Der Test importiert sie
// zurueck; `tools/modalgrenze.sh` faehrt sie als Gate. Damit gibt es genau EINE Erhebung mit ZWEI
// Aufrufern, nicht zwei Erhebungen.
//
// DIE WURZEL ist der einzige echte Unterschied: in `tests/app/` lag sie zwei Ebenen ueber der
// Datei, hier eine. Sie ist deshalb ein Parameter mit Vorgabe, kein fester Pfad — beide Aufrufer
// reichen dieselbe Wurzel herein.
//
// KEINE LAUFZEITABHAENGIGKEIT DES PRODUKTS: `typescript` ist devDependency und bleibt es. Dieses
// Modul wird nicht gebuendelt und nicht beim Start ausgefuehrt — es ist ein Werkzeug des Tors,
// wie `tools/check-cwd-contract.mjs` und `depcruise`.

import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";

// (1) Die Erhebung: der echte Syntaxbaum plus ein unabhängiger Zähler (mega72, Register A17).
// ---------------------------------------------------------------------------------------------

/**
 * Die Wurzel des Bestands.
 *
 * In der Testdatei stand hier `join(__dirname, "..", "..")`. Das trägt hier nicht mehr: `__dirname`
 * gibt es im ESM-Scope von Node nicht, und `import.meta.dirname` überlebt die CJS-Transformation
 * von vitest nicht zuverlässig. Das ARBEITSVERZEICHNIS ist der einzige Bezug, den beide Aufrufer
 * gleich sehen — `tools/modalgrenze.sh` setzt es mit `cd "$(dirname "$0")/.."`, und `tools/test`
 * ruft vitest ebenfalls von der Wurzel.
 *
 * Und es ist abgesichert, nicht geraten: `tools/check` fährt als ERSTEN Schritt
 * `node tools/check-cwd-contract.mjs` (Register I14) — eine falsche Wurzel bricht dort ab, bevor
 * diese Zeile je gelesen wird. Griffe sie doch daneben, liefe die Erhebung leer, und der Fall
 * „die Erhebung fällt nicht still auf null" wird rot statt still zu schweigen.
 */
export const WURZEL = process.cwd();
export const WEB_SRC = join("apps", "web", "src");
export const GRENZE_MODUL = "apps/web/src/app/ModalBoundaryContext.tsx";

// BEGRÜNDETE native Ausnahmen: Flächen, deren Modalität der BROWSER herstellt (Top-Layer + inerter
// Hintergrund über `showModal()`), nicht die Shell-Grenze. Die Ausnahme ist an ihren Beleg
// gebunden — verschwindet `showModal()` aus der Datei, wird sie rot statt still weitergeschleppt.
//
// AUFTRAG-mega76 BLOCK E: der Schlüssel ist weiterhin die Datei, die WIRKUNG aber nicht mehr.
// Ausgenommen wird nur noch der Kandidat der Art `showModal-nutzung` selbst (s. `beurteile`) —
// jeder andere Kandidat derselben Datei muss die Modalgrenze der Shell weiterhin vorweisen. Eine
// Ausnahme, die auf Dateiebene wirkt, deckt Funde ab, die sie nie begründet hat.
export const NATIV_MODAL_AUSNAHMEN = new Map<string, string>([
  [
    "apps/web/src/components/BodyImageGallery.tsx",
    "Lightbox über natives showModal() — Top-Layer und inerter Hintergrund kommen vom Browser (WP-D9c)",
  ],
]);

// Derselbe Fokus-Selektor wie in `apps/web/src/lib/focusables.ts` — bewusst gespiegelt: weicht er im
// Produktcode still auf, fällt es hier auf.
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function istQuelldatei(pfad: string): boolean {
  if (!pfad.endsWith(".ts") && !pfad.endsWith(".tsx")) {
    return false;
  }
  return !pfad.endsWith(".test.ts") && !pfad.endsWith(".test.tsx");
}

// JOB 1181 D1: die Wurzel ist ein Parameter geworden. Grund steht in Block F unten — BENs dritte
// Prüflücke zu D3 verlangt einen Träger, den der BAUMSCANNER wirklich liest, nicht einen, der einer
// Funktion als Text übergeben wird. Ohne diesen Parameter liesse sich das nur belegen, indem eine
// Datei in `apps/web/src/` entsteht; der Lease dieses Durchgangs verbietet jeden Produktcode. Der
// Standardwert ist unverändert `WURZEL`, jeder bestehende Aufruf verhält sich zeichengleich.
export function quelldateien(verzeichnis: string, wurzel: string = WURZEL): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(wurzel, verzeichnis), { withFileTypes: true })) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...quelldateien(relativ, wurzel));
    } else if (istQuelldatei(relativ)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

// Kommentare zählen nicht: dieser Sammler beschreibt seine eigene Bauform ausführlich in Prosa, und
// eine Erwähnung ist keine Verdrahtung. ZEILENTREU: Blockkommentare werden durch Leerraum ersetzt,
// nicht entfernt — die Zeilennummern des gestrippten Textes sind die der Datei.
export function ohneKommentare(quelle: string): string {
  return quelle
    .replace(/\/\*[\s\S]*?\*\//g, (kommentar) => kommentar.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

export function posix(pfad: string): string {
  return pfad.split(sep).join("/");
}

export interface Quelle {
  datei: string;
  text: string;
  gestrippt: string;
  ast: ts.SourceFile;
  // Was der Sammler nicht lesen konnte, wird rot mit Datei und Zeile — nicht übergangen.
  leseFehler: string[];
}

export function quelleAus(datei: string, text: string): Quelle {
  const art = datei.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true, art);
  // `parseDiagnostics` ist die einzige Stelle, an der der Parser Syntaxfehler ablegt, ohne dass man
  // ein ganzes Program bauen muss — im öffentlichen Typ fehlt das Feld, im Objekt liegt es immer.
  const diagnosen =
    (ast as ts.SourceFile & { parseDiagnostics?: ts.DiagnosticWithLocation[] }).parseDiagnostics ??
    [];
  const leseFehler = diagnosen.slice(0, 3).map((d) => {
    const zeile = ast.getLineAndCharacterOfPosition(d.start).line + 1;
    return `${datei}:${zeile} — ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
  });
  return { datei, text, gestrippt: ohneKommentare(text), ast, leseFehler };
}

export function ladeQuelle(datei: string): Quelle {
  return quelleAus(posix(datei), readFileSync(join(WURZEL, datei), "utf8"));
}

export function zeileVon(sf: ts.SourceFile, n: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
}

export type KandidatArt =
  | "aria-modal-attribut"
  | "aria-modal-eigenschaft"
  | "aria-modal-zeichenkette"
  // Register A17b (R-1390, „abweichend benannte Bauformen"): die DOM-Reflexion `el.ariaModal`,
  // `{ ariaModal: … }`. Sie trägt die Zeichenfolge `aria-modal` nicht und lief bis hierher an
  // Syntaxbaum UND Wortzähler vorbei.
  | "aria-modal-reflexion"
  | "dialog-jsx"
  | "dialog-createElement"
  | "role-dialog"
  | "showModal-nutzung";

export interface Kandidat {
  datei: string;
  zeile: number;
  art: KandidatArt;
  /**
   * AUFTRAG-mega76 BLOCK E: bei `dialog-jsx` der Bezeichner aus `ref={…}`.
   *
   * Er ist das Bindeglied, mit dem sich die native Ausnahme AM FUND belegen lässt statt an der
   * Datei: nur ein `<dialog>`, dessen genau dieses `ref` irgendwo `showModal()` empfängt, wird
   * vom Browser modal gemacht. Ein zweites `<dialog>` in derselben Datei bekommt nichts geschenkt.
   */
  ref?: string;
}

export interface DateiErhebung {
  quelle: Quelle;
  kandidaten: Kandidat[];
  // Spannen aller Text-Tokens (Zeichenketten, Templates, JsxText, Regex), die KEIN Kandidat sind —
  // die belegte Prosa, gegen die der unabhängige Zähler abrechnet.
  prosaSpannen: Array<readonly [number, number]>;
  nutztGrenze: boolean;
  exportierte: string[];
  /**
   * AUFTRAG-mega76 BLOCK E: die Ref-Bezeichner, auf denen in DIESER Datei `showModal()` läuft —
   * `dialogRef.current.showModal()` ebenso wie `const d = dialogRef.current; d.showModal()`.
   */
  nativeRefs: Set<string>;
  /**
   * Register A17b: was dieser Sammler NICHT beurteilen kann, mit Datei und Zeile — rot über
   * `modalAbgleich`, nicht still als Prosa verbucht. Zwei Arten:
   *  · ein `"dialog"`/`"alertdialog"`, das nach dem ganzen Lauf in keine Bauform geflossen ist
   *    (Typdeklarationen und Vergleiche ausgenommen, `istReinerDialogText`);
   *  · ein Rollenwert, der sich statisch nicht bestimmen lässt (`role={props.rolle}`).
   */
  unbekannteBauformen: string[];
}

/** Die Rollen- bzw. Elementnamen, die eine Fläche als Dialog ausweisen. */
export function istDialogName(text: string): boolean {
  return text === "dialog" || text === "alertdialog";
}

function istZeichenkettenLiteral(n: ts.Node): n is ts.StringLiteralLike {
  return ts.isStringLiteral(n) || n.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral;
}

// ------------------------------------------------------------------------------------------------
// Register A17b, Nacharbeit (ben): DIE STATISCHE WERTAUSWERTUNG.
// ------------------------------------------------------------------------------------------------
//
// Bis hierher galt eine Rolle nur dann als Dialog, wenn das VOLLSTÄNDIGE Literal im Ausdruck stand.
// `role={"dia" + "log"}` fiel damit still durch — statisch bestimmbar, aber nie bestimmt. Jetzt wird
// der Wert am Syntaxbaum AUSGEWERTET: Verkettung, Template, Bedingung, Rückfallketten, Hüllen
// (`as`, `satisfies`, `!`), Konstanten, Parameter-Vorgaben und Literal-Union-Typen der Datei.
// Was danach nicht feststeht, landet in `offen` — und ist damit eine Aussage, kein stilles Nichts.

/** Ein statisch ermittelter Zeichenkettenwert und der Knoten, aus dem er stammt. */
export interface StatischerWert {
  text: string;
  knoten: ts.Node;
}

/** Die möglichen Werte eines Ausdrucks — und die Stellen, an denen er nicht bestimmbar war. */
export interface Wertbild {
  werte: StatischerWert[];
  offen: ts.Node[];
}

/** Name → Deklarationen dieser Datei (Variablen, Bindungen, Parameter, Typen). */
export type Deklarationen = Map<string, ts.Node[]>;

const MAX_KOMBINATIONEN = 64;
const MAX_TIEFE = 12;

export function sammleDeklarationen(sf: ts.SourceFile): Deklarationen {
  const index: Deklarationen = new Map();
  const merke = (name: ts.Node | undefined, decl: ts.Node): void => {
    if (name && ts.isIdentifier(name)) {
      index.set(name.text, [...(index.get(name.text) ?? []), decl]);
    }
  };
  const gehe = (n: ts.Node): void => {
    if (
      ts.isVariableDeclaration(n) ||
      ts.isBindingElement(n) ||
      ts.isParameter(n) ||
      ts.isTypeAliasDeclaration(n) ||
      ts.isInterfaceDeclaration(n)
    ) {
      merke(n.name, n);
    }
    ts.forEachChild(n, gehe);
  };
  gehe(sf);
  return index;
}

/** Der Sichtbarkeitsraum einer Deklaration: Block, Datei, Funktion oder Schleifenkopf. */
function sichtraum(decl: ts.Node): ts.Node | undefined {
  let k = decl.parent;
  while (
    k &&
    !(
      ts.isBlock(k) ||
      ts.isSourceFile(k) ||
      ts.isModuleBlock(k) ||
      ts.isFunctionLike(k) ||
      ts.isForStatement(k) ||
      ts.isForOfStatement(k) ||
      ts.isForInStatement(k) ||
      ts.isCaseBlock(k)
    )
  ) {
    k = k.parent;
  }
  return k;
}

/** Die vom Verwendungsort aus sichtbaren Deklarationen — die innerste Ebene gewinnt. */
function sichtbareDeklarationen(deklarationen: Deklarationen, id: ts.Identifier): ts.Node[] {
  const sichtbar: Array<{ decl: ts.Node; raum: ts.Node }> = [];
  for (const decl of deklarationen.get(id.text) ?? []) {
    const raum = sichtraum(decl);
    if (raum !== undefined && raum.pos <= id.pos && id.end <= raum.end) {
      sichtbar.push({ decl, raum });
    }
  }
  const innerste = Math.max(-1, ...sichtbar.map(({ raum }) => raum.pos));
  return sichtbar.filter(({ raum }) => raum.pos === innerste).map(({ decl }) => decl);
}

function vereine(bilder: Wertbild[]): Wertbild {
  return { werte: bilder.flatMap((b) => b.werte), offen: bilder.flatMap((b) => b.offen) };
}

function verkette(knoten: ts.Node, links: Wertbild, rechts: Wertbild): Wertbild {
  if (
    links.offen.length > 0 ||
    rechts.offen.length > 0 ||
    links.werte.length === 0 ||
    rechts.werte.length === 0 ||
    links.werte.length * rechts.werte.length > MAX_KOMBINATIONEN
  ) {
    return { werte: [], offen: [knoten] };
  }
  return {
    werte: links.werte.flatMap((l) => rechts.werte.map((r) => ({ text: l.text + r.text, knoten }))),
    offen: [],
  };
}

/**
 * Alle möglichen Zeichenkettenwerte eines Ausdrucks, statisch am Syntaxbaum ermittelt. Ein
 * nicht-zeichenkettiger Wert (`undefined`, `null`, Zahl, Wahrheitswert) trägt nichts bei; alles,
 * was sich nicht bestimmen lässt (Prop-Zugriff, Aufruf, Import, `let`), steht in `offen`.
 */
export function statischeWerte(ausdruck: ts.Node, deklarationen: Deklarationen): Wertbild {
  const leer = (): Wertbild => ({ werte: [], offen: [] });
  const unbestimmt = (n: ts.Node): Wertbild => ({ werte: [], offen: [n] });
  const besucht = new Set<ts.Node>();

  const typNamen = (name: string): ts.Node[] => {
    const alle = deklarationen.get(name) ?? [];
    return alle.filter((d) => ts.isTypeAliasDeclaration(d) || ts.isInterfaceDeclaration(d));
  };

  const mitgliedsTyp = (typ: ts.TypeNode, name: string, tiefe: number): ts.TypeNode | undefined => {
    if (tiefe > MAX_TIEFE) {
      return undefined;
    }
    if (ts.isParenthesizedTypeNode(typ)) {
      return mitgliedsTyp(typ.type, name, tiefe + 1);
    }
    if (ts.isIntersectionTypeNode(typ)) {
      for (const t of typ.types) {
        const gefunden = mitgliedsTyp(t, name, tiefe + 1);
        if (gefunden) {
          return gefunden;
        }
      }
      return undefined;
    }
    const mitglieder = (liste: ts.NodeArray<ts.TypeElement>): ts.TypeNode | undefined => {
      for (const m of liste) {
        if (ts.isPropertySignature(m) && eigenschaftsName(m.name) === name) {
          return m.type;
        }
      }
      return undefined;
    };
    if (ts.isTypeLiteralNode(typ)) {
      return mitglieder(typ.members);
    }
    if (ts.isTypeReferenceNode(typ) && ts.isIdentifier(typ.typeName)) {
      for (const d of typNamen(typ.typeName.text)) {
        let gefunden: ts.TypeNode | undefined;
        if (ts.isInterfaceDeclaration(d)) {
          gefunden = mitglieder(d.members);
        } else if (ts.isTypeAliasDeclaration(d)) {
          gefunden = mitgliedsTyp(d.type, name, tiefe + 1);
        }
        if (gefunden) {
          return gefunden;
        }
      }
    }
    return undefined;
  };

  const typWerte = (typ: ts.TypeNode, tiefe: number): Wertbild => {
    if (tiefe > MAX_TIEFE) {
      return unbestimmt(typ);
    }
    if (ts.isLiteralTypeNode(typ)) {
      return istZeichenkettenLiteral(typ.literal)
        ? { werte: [{ text: typ.literal.text, knoten: typ.literal }], offen: [] }
        : leer();
    }
    if (ts.isUnionTypeNode(typ)) {
      return vereine(typ.types.map((t) => typWerte(t, tiefe + 1)));
    }
    if (ts.isParenthesizedTypeNode(typ)) {
      return typWerte(typ.type, tiefe + 1);
    }
    if (
      typ.kind === ts.SyntaxKind.UndefinedKeyword ||
      typ.kind === ts.SyntaxKind.NullKeyword ||
      typ.kind === ts.SyntaxKind.BooleanKeyword ||
      typ.kind === ts.SyntaxKind.NumberKeyword
    ) {
      return leer();
    }
    if (ts.isTypeReferenceNode(typ) && ts.isIdentifier(typ.typeName)) {
      const alias = typNamen(typ.typeName.text).find(ts.isTypeAliasDeclaration);
      if (alias) {
        return typWerte(alias.type, tiefe + 1);
      }
    }
    return unbestimmt(typ);
  };

  const bindungsTyp = (b: ts.BindingElement): ts.TypeNode | undefined => {
    const name = b.propertyName ?? b.name;
    const muster = b.parent;
    const halter = muster.parent;
    if (
      !ts.isObjectBindingPattern(muster) ||
      !(ts.isIdentifier(name) || ts.isStringLiteral(name)) ||
      !(ts.isParameter(halter) || ts.isVariableDeclaration(halter)) ||
      !halter.type
    ) {
      return undefined;
    }
    return mitgliedsTyp(halter.type, name.text, 0);
  };

  // `besucht` ist der aktuelle Auflösungspfad, kein Gedächtnis: `a + a` wertet `a` zweimal aus,
  // nur ein Kreis (`const a = b; const b = a`) bricht ab.
  const deklarationsWerte = (d: ts.Node, tiefe: number): Wertbild => {
    if (besucht.has(d)) {
      return unbestimmt(d);
    }
    besucht.add(d);
    try {
      return deklarationsWerteOhneKreis(d, tiefe);
    } finally {
      besucht.delete(d);
    }
  };

  function deklarationsWerteOhneKreis(d: ts.Node, tiefe: number): Wertbild {
    if (ts.isVariableDeclaration(d)) {
      const konstant = (ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const) !== 0;
      return konstant && d.initializer ? werte(d.initializer, tiefe + 1) : unbestimmt(d);
    }
    if (ts.isBindingElement(d)) {
      const typ = bindungsTyp(d);
      return vereine([
        d.initializer ? werte(d.initializer, tiefe + 1) : leer(),
        typ ? typWerte(typ, tiefe + 1) : unbestimmt(d),
      ]);
    }
    if (ts.isParameter(d) && d.type) {
      return vereine([
        d.initializer ? werte(d.initializer, tiefe + 1) : leer(),
        typWerte(d.type, tiefe + 1),
      ]);
    }
    return unbestimmt(d);
  }

  function werte(n: ts.Node, tiefe: number): Wertbild {
    if (tiefe > MAX_TIEFE) {
      return unbestimmt(n);
    }
    if (istZeichenkettenLiteral(n)) {
      return { werte: [{ text: n.text, knoten: n }], offen: [] };
    }
    if (
      ts.isParenthesizedExpression(n) ||
      ts.isAsExpression(n) ||
      ts.isSatisfiesExpression(n) ||
      ts.isNonNullExpression(n) ||
      ts.isTypeAssertionExpression(n)
    ) {
      return werte(n.expression, tiefe + 1);
    }
    if (ts.isJsxExpression(n)) {
      return n.expression ? werte(n.expression, tiefe + 1) : leer();
    }
    if (ts.isConditionalExpression(n)) {
      return vereine([werte(n.whenTrue, tiefe + 1), werte(n.whenFalse, tiefe + 1)]);
    }
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind;
      if (op === ts.SyntaxKind.PlusToken) {
        return verkette(n, werte(n.left, tiefe + 1), werte(n.right, tiefe + 1));
      }
      if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) {
        return vereine([werte(n.left, tiefe + 1), werte(n.right, tiefe + 1)]);
      }
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
        return werte(n.right, tiefe + 1);
      }
    }
    if (ts.isTemplateExpression(n)) {
      let bild: Wertbild = { werte: [{ text: n.head.text, knoten: n }], offen: [] };
      for (const span of n.templateSpans) {
        bild = verkette(n, bild, werte(span.expression, tiefe + 1));
        bild = verkette(n, bild, { werte: [{ text: span.literal.text, knoten: n }], offen: [] });
      }
      return bild;
    }
    if (
      n.kind === ts.SyntaxKind.NullKeyword ||
      n.kind === ts.SyntaxKind.TrueKeyword ||
      n.kind === ts.SyntaxKind.FalseKeyword ||
      ts.isNumericLiteral(n)
    ) {
      return leer();
    }
    if (ts.isIdentifier(n)) {
      if (n.text === "undefined") {
        return leer();
      }
      const decls = sichtbareDeklarationen(deklarationen, n);
      if (decls.length === 0) {
        return unbestimmt(n);
      }
      const bild = vereine(decls.map((d) => deklarationsWerte(d, tiefe + 1)));
      // Die Unbestimmtheit wird am VERWENDUNGSORT gemeldet, nicht tief in der Deklaration.
      return { werte: bild.werte, offen: bild.offen.length > 0 ? [n] : [] };
    }
    return unbestimmt(n);
  }

  return werte(ausdruck, 0);
}

/**
 * Eine Hülle, die einen Wert nur durchreicht oder zwischen Werten wählt: Klammer, Bedingung,
 * `as`/`satisfies`, Rückfall- und Verknüpfungsketten. Eine Zuweisung gehört nicht dazu.
 */
function istWerthuelle(n: ts.Node): boolean {
  return (
    ts.isParenthesizedExpression(n) ||
    ts.isConditionalExpression(n) ||
    ts.isAsExpression(n) ||
    ts.isSatisfiesExpression(n) ||
    (ts.isBinaryExpression(n) && n.operatorToken.kind !== ts.SyntaxKind.EqualsToken)
  );
}

/**
 * Ein Textattribut an einem INTRINSISCHEN Element (`<span title="dialog" />`) — nicht `role`.
 * Ein kleingeschriebener Tag ist ein DOM-Element; seine übrigen Attribute sind Text und bauen
 * keine Fläche. Ein Bauteil (`<Huelle as="dialog" />`) kann seine Props dagegen zu einem Element
 * machen und bleibt deshalb ausserhalb dieser Ausnahme.
 */
function istTextattributIntrinsisch(literal: ts.Node): boolean {
  let k: ts.Node = literal;
  while (k.parent !== undefined && (istWerthuelle(k.parent) || ts.isJsxExpression(k.parent))) {
    k = k.parent;
  }
  const attribut = k.parent;
  if (attribut === undefined || !ts.isJsxAttribute(attribut) || attribut.initializer !== k) {
    return false;
  }
  if (attribut.name.getText() === "role") {
    return false;
  }
  const element = attribut.parent.parent;
  return (
    (ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)) &&
    ts.isIdentifier(element.tagName) &&
    /^[a-z]/.test(element.tagName.text)
  );
}

/**
 * Ist dieses Dialog-Literal nachweislich KEIN Bau? Eine Typdeklaration (`type R = "dialog" | …`)
 * baut keine Fläche, ein Vergleich (`rolle === "dialog"`, `case "dialog":`) liest nur, ein
 * Textattribut an einem DOM-Element (`<span title="dialog" />`) ist Oberflächentext (Nacharbeit 3).
 * Alles andere, das keiner erkannten Bauform zugeflossen ist, bleibt eine unbekannte Bauform.
 */
export function istReinerDialogText(literal: ts.Node): boolean {
  const p = literal.parent;
  if (!p) {
    return false;
  }
  if (istTextattributIntrinsisch(literal)) {
    return true;
  }
  if (ts.isLiteralTypeNode(p)) {
    return true;
  }
  if (ts.isCaseClause(p) && p.expression === literal) {
    return true;
  }
  if (ts.isBinaryExpression(p)) {
    const op = p.operatorToken.kind;
    return (
      op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      op === ts.SyntaxKind.EqualsEqualsToken ||
      op === ts.SyntaxKind.ExclamationEqualsToken
    );
  }
  return false;
}

/** Der Name einer Eigenschaft, gleich ob als Bezeichner oder als Zeichenkette geschrieben. */
function eigenschaftsName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  return undefined;
}

export function istExportiert(n: ts.Declaration): boolean {
  const flags = ts.getCombinedModifierFlags(n);
  return (flags & (ts.ModifierFlags.Export | ts.ModifierFlags.Default)) !== 0;
}

export function aufrufName(call: ts.CallExpression): string {
  const c = call.expression;
  if (ts.isIdentifier(c)) {
    return c.text;
  }
  if (ts.isPropertyAccessExpression(c)) {
    return c.name.text;
  }
  return "";
}

export function istTextToken(n: ts.Node): boolean {
  return (
    ts.isStringLiteral(n) ||
    ts.isJsxText(n) ||
    n.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
    n.kind === ts.SyntaxKind.TemplateHead ||
    n.kind === ts.SyntaxKind.TemplateMiddle ||
    n.kind === ts.SyntaxKind.TemplateTail ||
    n.kind === ts.SyntaxKind.RegularExpressionLiteral
  );
}

export function erhebeDatei(quelle: Quelle): DateiErhebung {
  const sf = quelle.ast;
  const kandidaten: Kandidat[] = [];
  const prosaSpannen: Array<readonly [number, number]> = [];
  const exportierte: string[] = [];
  const unbekannteBauformen: string[] = [];
  let nutztGrenze = false;
  // Text-Tokens, die bereits als Kandidat erfasst sind, dürfen nicht zusätzlich Prosa werden —
  // sonst wäre jede Erwähnung doppelt erklärt und der Zähler wertlos.
  const kandidatTokens = new Set<ts.Node>();

  const melde = (n: ts.Node, art: KandidatArt, ref?: string): void => {
    kandidaten.push({ datei: quelle.datei, zeile: zeileVon(sf, n), art, ...(ref ? { ref } : {}) });
  };

  const deklarationen = sammleDeklarationen(sf);
  // Alle Dialog-Literale der Datei; ob sie einer Bauform zugeflossen sind, steht erst NACH dem
  // ganzen Lauf fest (die Konstante kann vor ihrer Verwendung stehen).
  const dialogLiteralKnoten: ts.StringLiteralLike[] = [];

  // Ein Wert, der im Ausdruck selbst steht, wird an seiner Stelle gemeldet; einer aus einer
  // Deklaration am Verwendungsort.
  const stelle = (w: StatischerWert, ausdruck: ts.Node): ts.Node =>
    w.knoten.getStart(sf) >= ausdruck.getStart(sf) && w.knoten.end <= ausdruck.end
      ? w.knoten
      : ausdruck;

  // Register A17b (Nacharbeit): der Rollenwert wird AUSGEWERTET, nicht nach Literalen durchsucht.
  // `meldeOffen` steht dort, wo `role` zweifelsfrei die ARIA-Rolle ist (JSX-Attribut,
  // `setAttribute`, Props-Objekt an JSX-Spread oder `createElement`). Ein nicht bestimmbarer Wert
  // ist dort eine unbekannte Bauform — rot mit Datei und Zeile, statt ohne Ergebnis abgerechnet.
  const meldeRolle = (ausdruck: ts.Node, meldeOffen: boolean): void => {
    const bild = statischeWerte(ausdruck, deklarationen);
    for (const w of bild.werte) {
      if (istDialogName(w.text)) {
        melde(stelle(w, ausdruck), "role-dialog");
        kandidatTokens.add(w.knoten);
      }
    }
    if (meldeOffen && bild.offen.length > 0) {
      unbekannteBauformen.push(
        `${quelle.datei}:${zeileVon(sf, ausdruck)} — Rollenwert „${ausdruck.getText(sf).replace(/\s+/g, " ").slice(0, 60)}“ ist statisch nicht bestimmbar: ob hier ein Dialog entsteht, kann dieser Sammler nicht beurteilen`,
      );
    }
  };

  // Alle Verwendungen einer lokalen Bindung — nach derselben Sichtbarkeitsregel wie die
  // Wertauswertung, damit ein gleichnamiger Bezeichner in einem anderen Block nicht mitzählt.
  const verwendungen = (decl: ts.Node, name: string): ts.Identifier[] => {
    const gefunden: ts.Identifier[] = [];
    const gehe = (n: ts.Node): void => {
      if (
        ts.isIdentifier(n) &&
        n.text === name &&
        n.parent !== decl &&
        sichtbareDeklarationen(deklarationen, n).includes(decl)
      ) {
        gefunden.push(n);
      }
      ts.forEachChild(n, gehe);
    };
    gehe(sf);
    return gefunden;
  };

  // Ist dieses Objekt das Props-Objekt einer Bauform (JSX-Spread oder `createElement`)? Nur dort
  // ist `role` sicher die ARIA-Rolle — sonst ist es in diesem Produkt meist die Benutzerrolle.
  // Nacharbeit 3 (ben): das Objekt wird auch über lokale Bindungen und Objekt-Spreads verfolgt —
  // `const p = { role: x }; <div {...p} />` und `const q = { ...p }; createElement("div", q)`.
  const istPropsObjekt = (objekt: ts.Node, tiefe = 0): boolean => {
    if (tiefe > MAX_TIEFE) {
      return false;
    }
    let k: ts.Node = objekt;
    let p: ts.Node | undefined = k.parent;
    while (p !== undefined && (istWerthuelle(p) || ts.isSpreadAssignment(p))) {
      k = ts.isSpreadAssignment(p) ? p.parent : p;
      p = k.parent;
    }
    if (p === undefined) {
      return false;
    }
    if (ts.isJsxSpreadAttribute(p)) {
      return true;
    }
    if (ts.isCallExpression(p) && aufrufName(p) === "createElement") {
      return p.arguments.some((a) => a === k);
    }
    if (ts.isVariableDeclaration(p) && p.initializer === k && ts.isIdentifier(p.name)) {
      return verwendungen(p, p.name.text).some((v) => istPropsObjekt(v, tiefe + 1));
    }
    return false;
  };

  // AUFTRAG-mega76 BLOCK E — die Kette `<dialog ref={R}>` … `R.current.showModal()` nachziehen.
  // `aliasse` fängt die Zwischenvariable ab (`const d = dialogRef.current`), `showModalZiele` die
  // Bezeichner, auf denen der Aufruf wirklich steht. Erst beides zusammen belegt, dass GENAU
  // dieses `<dialog>` vom Browser modal gemacht wird.
  const aliasse = new Map<string, string>();
  const showModalZiele = new Set<string>();

  // Der Bezeichner hinter `X`, `X.current` oder einem Alias darauf.
  const refBezeichner = (n: ts.Node): string | undefined => {
    if (ts.isIdentifier(n)) {
      return aliasse.get(n.text) ?? n.text;
    }
    if (ts.isPropertyAccessExpression(n) && n.name.text === "current") {
      return refBezeichner(n.expression);
    }
    return undefined;
  };

  // `ref={…}` eines JSX-Elements — das Bindeglied zur nativen Ausnahme (mega76 BLOCK E).
  const refVon = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string | undefined => {
    const refAttr = node.attributes.properties.find(
      (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText(sf) === "ref",
    );
    const refAusdruck =
      refAttr?.initializer && ts.isJsxExpression(refAttr.initializer)
        ? refAttr.initializer.expression
        : undefined;
    return refAusdruck ? refBezeichner(refAusdruck) : undefined;
  };

  const besuch = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useModalBoundary"
    ) {
      nutztGrenze = true;
    }
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text)) {
      if (istExportiert(node)) {
        exportierte.push(node.name.text);
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /^[A-Z]/.test(node.name.text) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
      istExportiert(node)
    ) {
      exportierte.push(node.name.text);
    }

    // `aria-modal` als JSX-Attribut — die gerade Bauform.
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "aria-modal") {
      melde(node.name, "aria-modal-attribut");
    }
    // `aria-modal` als Objekt-Eigenschaft — die Spread-Bauform aus bens Befund.
    if (
      ts.isPropertyAssignment(node) &&
      ts.isStringLiteral(node.name) &&
      node.name.text === "aria-modal"
    ) {
      melde(node.name, "aria-modal-eigenschaft");
      kandidatTokens.add(node.name);
    }
    // `aria-modal` als nackte Zeichenkette — `setAttribute` und Verwandte.
    if (
      (ts.isStringLiteral(node) || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) &&
      (node as ts.StringLiteralLike).text === "aria-modal" &&
      !kandidatTokens.has(node)
    ) {
      melde(node, "aria-modal-zeichenkette");
      kandidatTokens.add(node);
    }
    // `<dialog>` im JSX.
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sf) === "dialog"
    ) {
      melde(node.tagName, "dialog-jsx", refVon(node));
    }
    // Register A17b (Nacharbeit): ein abweichend benannter Tag, dessen Wert statisch „dialog“ ist —
    // `const Huelle = "dialog"; <Huelle />`. JSX liest einen grossgeschriebenen Bezeichner als
    // Wert; nur dann wird er ausgewertet. Ein Bauteil (Funktion, Import) bleibt kein Kandidat.
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      /^[A-Z]/.test(node.tagName.text)
    ) {
      for (const w of statischeWerte(node.tagName, deklarationen).werte) {
        if (w.text === "dialog") {
          melde(node.tagName, "dialog-jsx", refVon(node));
          kandidatTokens.add(w.knoten);
        }
      }
    }
    // `const d = dialogRef.current` — die Zwischenvariable, über die der Aufruf meist läuft.
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isPropertyAccessExpression(node.initializer) &&
      node.initializer.name.text === "current" &&
      ts.isIdentifier(node.initializer.expression)
    ) {
      aliasse.set(node.name.text, node.initializer.expression.text);
    }
    // `createElement("dialog", …)` — React wie DOM, auch als Template ohne Ersetzung (A17b) und
    // über einen statisch bestimmbaren Wert (`createElement(tag, …)` mit `const tag = "dialog"`).
    // Ein nicht bestimmbares erstes Argument ist hier der Normalfall (ein Bauteil) und kein Befund.
    if (ts.isCallExpression(node) && aufrufName(node) === "createElement") {
      const erstes = node.arguments[0];
      if (erstes) {
        for (const w of statischeWerte(erstes, deklarationen).werte) {
          if (w.text === "dialog") {
            melde(stelle(w, erstes), "dialog-createElement");
            kandidatTokens.add(w.knoten);
          }
        }
      }
    }
    // `role="dialog"` / `role="alertdialog"` — als JSX-Attribut, als Objekt-Eigenschaft, über
    // `setAttribute("role", …)` oder `el.role = …`. Register A17b: der Wert wird ausgewertet
    // (`role={"dia" + "log"}`, `role={offen ? "dialog" : undefined}`, `role={rolle}`), s. `meldeRolle`.
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "role" && node.initializer) {
      meldeRolle(node.initializer, true);
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(sf).replace(/["']/g, "") === "role") {
      meldeRolle(node.initializer, istPropsObjekt(node.parent));
    }
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === "role") {
      meldeRolle(node.name, istPropsObjekt(node.parent));
    }
    if (ts.isCallExpression(node) && aufrufName(node) === "setAttribute") {
      const [attribut, wert] = node.arguments;
      if (attribut && wert && istZeichenkettenLiteral(attribut) && attribut.text === "role") {
        meldeRolle(wert, true);
      }
    }
    // `x.role = …` meldet nur bestimmte Dialogwerte: in diesem Produkt ist `role` an Objekten
    // meist die BENUTZERrolle — ein unbestimmter Wert dort ist kein Hinweis auf einen Dialog.
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text === "role"
    ) {
      meldeRolle(node.right, false);
    }
    // `ariaModal` — die DOM-Reflexion von `aria-modal`, abweichend benannt (A17b). Punktzugriff,
    // Objekt-Eigenschaft (auch Kurzform), JSX-Attribut und Index-Zugriff `el["ariaModal"]`.
    if (ts.isPropertyAccessExpression(node) && node.name.text === "ariaModal") {
      melde(node.name, "aria-modal-reflexion");
    }
    if (ts.isPropertyAssignment(node) && eigenschaftsName(node.name) === "ariaModal") {
      melde(node.name, "aria-modal-reflexion");
      kandidatTokens.add(node.name);
    }
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === "ariaModal") {
      melde(node.name, "aria-modal-reflexion");
    }
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "ariaModal") {
      melde(node.name, "aria-modal-reflexion");
    }
    if (istZeichenkettenLiteral(node) && node.text === "ariaModal" && !kandidatTokens.has(node)) {
      melde(node, "aria-modal-reflexion");
      kandidatTokens.add(node);
    }
    // `showModal` — Punktzugriff oder Index-Zugriff.
    if (ts.isPropertyAccessExpression(node) && node.name.text === "showModal") {
      melde(node.name, "showModal-nutzung");
      const ziel = refBezeichner(node.expression);
      if (ziel) {
        showModalZiele.add(ziel);
      }
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === "showModal"
    ) {
      melde(node.argumentExpression, "showModal-nutzung");
      kandidatTokens.add(node.argumentExpression);
    }

    if (istZeichenkettenLiteral(node) && istDialogName(node.text)) {
      dialogLiteralKnoten.push(node);
    }

    // Alles Text-Artige, das kein Kandidat wurde, ist belegte Prosa.
    if (istTextToken(node) && !kandidatTokens.has(node)) {
      prosaSpannen.push([node.getStart(sf), node.end] as const);
    }

    ts.forEachChild(node, besuch);
  };
  besuch(sf);

  // Register A17b: ein `"dialog"`/`"alertdialog"`, das NACH dem ganzen Lauf keiner Bauform
  // zugeflossen ist (Tag, `createElement`, Rolle — auch über Konstanten), ist eine UNBEKANNTE
  // Bauform. Ausgenommen ist nur, was nachweislich nichts baut: Typdeklarationen und Vergleiche
  // (`istReinerDialogText`, Nacharbeit nach bens Befund zur Typdeklaration).
  for (const literal of dialogLiteralKnoten) {
    if (kandidatTokens.has(literal) || istReinerDialogText(literal)) {
      continue;
    }
    unbekannteBauformen.push(
      `${quelle.datei}:${zeileVon(sf, literal)} — Zeichenkette „${literal.text}“ fliesst in keine erkannte Bauform (weder <dialog>, createElement noch role): ein abweichend benannter Dialog, den dieser Sammler nicht beurteilen kann`,
    );
  }

  // Die Aliasse sind erst nach dem vollständigen Lauf bekannt (`const d = …` kann NACH dem
  // `<dialog>` stehen). Deshalb werden beide Seiten hier abschliessend aufgelöst.
  const nativeRefs = new Set([...showModalZiele].map((z) => aliasse.get(z) ?? z));
  for (const k of kandidaten) {
    if (k.ref) {
      k.ref = aliasse.get(k.ref) ?? k.ref;
    }
  }
  return {
    quelle,
    kandidaten,
    prosaSpannen,
    nutztGrenze,
    exportierte,
    nativeRefs,
    unbekannteBauformen,
  };
}

// --- Der unabhängige Zähler: Wort-Erwähnungen gegen die Erklärung des Syntaxbaums abrechnen. ---

export function trefferZeilen(gestrippt: string, muster: RegExp): number[] {
  const zeilen: number[] = [];
  for (const m of gestrippt.matchAll(muster)) {
    zeilen.push(gestrippt.slice(0, m.index).split("\n").length);
  }
  return zeilen;
}

export function prosaTreffer(e: DateiErhebung, muster: RegExp): number {
  let n = 0;
  for (const [start, ende] of e.prosaSpannen) {
    n += [...e.quelle.text.slice(start, ende).matchAll(muster)].length;
  }
  return n;
}

// Kern des Auftrags: eine Erwähnung, die weder Kandidat noch belegte Prosa ist, heißt „diese
// Bauform konnte ich nicht lesen" — und das ist ROT, kein stilles Loch.
export function unabgerechnet(
  e: DateiErhebung,
  muster: RegExp,
  erklaerteKandidaten: number,
): string[] {
  const zeilen = trefferZeilen(e.quelle.gestrippt, muster);
  const erklaert = erklaerteKandidaten + prosaTreffer(e, muster);
  if (zeilen.length <= erklaert) {
    return [];
  }
  return [
    `${e.quelle.datei}:${zeilen.join(",")} — ${zeilen.length} Erwähnung(en) von ${muster.source}, nur ${erklaert} abgerechnet (Kandidat oder Prosa): eine Bauform, die dieser Sammler nicht beurteilen konnte`,
  ];
}

export function modalAbgleich(e: DateiErhebung): string[] {
  const anzahl = (arten: readonly KandidatArt[]): number =>
    e.kandidaten.filter((k) => arten.includes(k.art)).length;
  return [
    ...unabgerechnet(
      e,
      /aria-modal/g,
      anzahl(["aria-modal-attribut", "aria-modal-eigenschaft", "aria-modal-zeichenkette"]),
    ),
    ...unabgerechnet(e, /showModal/g, anzahl(["showModal-nutzung"])),
    ...unabgerechnet(e, /<dialog\b/g, anzahl(["dialog-jsx"])),
    // Register A17b: die abweichend benannte Reflexion und Dialog-Literale ohne erkannte Bauform.
    ...unabgerechnet(e, /\bariaModal\b/g, anzahl(["aria-modal-reflexion"])),
    ...e.unbekannteBauformen,
  ];
}

// --- Die Urteile: jeder Kandidat bekommt genau eines; ohne Grenze ist rot. ---

export type Urteil = "an-der-grenze" | "grenzmodul" | "nativ-modal-ausgenommen" | "OHNE GRENZE";

export interface Beurteilung {
  kandidat: Kandidat;
  urteil: Urteil;
}

// ================================================================================================
// B52/E · GELB-1 (JOB 1660) — DIE NATIVE AUSNAHME HAENGT AM KANDIDATEN, NICHT AN DER DATEI.
// ================================================================================================
//
// DER BEFUND, aus der Erntekontrolle PRO2 (`1652 D1`, Befund 2) — Zitat aus fremder Rueckgabe:
//   „Der Schluessel ist an jeder der vier Stellen die Datei … nie der Kandidat. Damit gilt
//    weiterhin: eine ZWEITE, nicht native `aria-modal`-Flaeche in einer ausgenommenen Datei
//    rutscht durch, weil die Ausnahme die ganze Datei freistellt."
//
// NACHGEMESSEN, und das Bild ist genauer als der Befund: von den vier Stellen war EINE bereits
// kandidatengebunden — `beurteile` (mega76 BLOCK E) prueft `showModal-nutzung` bzw. den
// `dialog-jsx` mit nativer Ref. Die drei UEBRIGEN aber schlossen die Datei als GANZES aus den
// Erhebungen aus: `BAUTEIL_ERHEBUNGEN`, `unregistrierteVollflaechen`, `unregistrierteWirkflaechen`.
// Dort traf der Befund zu.
//
// DIE REGEL STEHT JETZT AN EINER STELLE. `nativGedeckt` ist woertlich die Bedingung, die
// `beurteile` schon benutzte — kein zweiter Begriff von „nativ" (ENTSCHEIDUNGEN/JOB-646.md).
// `nativAusnahmeDecktDatei` sagt, ob die Ausnahme ALLE modalen Funde einer Datei traegt; nur dann
// darf eine dateiweite Erhebung sie ueberspringen. Sobald in einer ausgenommenen Datei EIN Fund
// auftaucht, den `showModal()` nicht deckt, ist die Datei wieder in der Erhebung.
//
// DIE RICHTUNG IST EINSEITIG: die neue Regel ist STRENGER als die alte. Sie kann Funde nur
// hinzufuegen, nie entfernen — eine Datei ohne Ausnahme verhaelt sich unveraendert.

/** Deckt die native Ausnahme DIESEN Fund? Dieselbe Bedingung, die `beurteile` seit mega76 fuehrt. */
export function nativGedeckt(e: DateiErhebung, k: Kandidat): boolean {
  return (
    k.art === "showModal-nutzung" || (k.art === "dialog-jsx" && !!k.ref && e.nativeRefs.has(k.ref))
  );
}

/**
 * Deckt die native Ausnahme ALLE Funde dieser Datei — darf eine dateiweite Erhebung sie also
 * ueberspringen?
 *
 * `every` ueber die Kandidaten ist der ganze Punkt: eine Datei faellt nur dann heraus, wenn es in
 * ihr NICHTS gibt, was die Ausnahme nicht begruendet. Ein zweites, rein React-gebautes Overlay in
 * derselben Datei holt sie zurueck in die Erhebung.
 */
export function nativAusnahmeDecktDatei(e: DateiErhebung): boolean {
  if (!NATIV_MODAL_AUSNAHMEN.has(e.quelle.datei)) {
    return false;
  }
  return e.kandidaten.every((k) => nativGedeckt(e, k));
}

export function beurteile(erhebungen: DateiErhebung[]): {
  beurteilt: Beurteilung[];
  rot: string[];
} {
  const beurteilt: Beurteilung[] = [];
  const rot: string[] = [];
  for (const e of erhebungen) {
    const ausnahme = NATIV_MODAL_AUSNAHMEN.get(e.quelle.datei);
    for (const k of e.kandidaten) {
      let urteil: Urteil;
      if (k.datei === GRENZE_MODUL) {
        urteil = "grenzmodul";
      } else if (e.nutztGrenze) {
        urteil = "an-der-grenze";
      } else if (ausnahme !== undefined && nativGedeckt(e, k)) {
        // AUFTRAG-mega76 BLOCK E: die Ausnahme hing bis hier an der DATEI. Damit deckte sie
        // ALLE Kandidaten dieser Datei — auch solche, die mit `showModal()` nichts zu tun haben
        // (etwa ein zweites, rein React-gebautes Overlay in derselben Datei). Sie deckte also
        // mehr ab, als sie sollte. Jetzt ist sie an DENSELBEN Fund gebunden, den sie begründet:
        // ausgenommen ist die `showModal`-Nutzung selbst, sonst nichts.
        urteil = "nativ-modal-ausgenommen";
      } else {
        urteil = "OHNE GRENZE";
        rot.push(
          `${k.datei}:${k.zeile} — ${k.art}: mögliche modale Fläche ohne die Modalgrenze der Shell (weder useModalBoundary noch begründete Ausnahme). Eine Modalität, die nur behauptet wird, ist genau der Fehler, den mega48 schließt.`,
        );
      }
      beurteilt.push({ kandidat: k, urteil });
    }
    // Eine Ausnahme, die ihren Beleg verloren hat, ist eine Zusage von gestern.
    if (ausnahme !== undefined && !e.kandidaten.some((k) => k.art === "showModal-nutzung")) {
      rot.push(
        `${e.quelle.datei} — als nativ-modal ausgenommen (${ausnahme}), aber ohne showModal() im Quelltext: die Ausnahme trägt nicht mehr`,
      );
    }
  }
  return { beurteilt, rot };
}

// ================================================================================================
// DER AUFRUFER — dieselbe Erhebung als Gate, nicht als Test.
// ================================================================================================
//
// Aufgerufen von `tools/modalgrenze.sh`, das in `tools/check` steht. Fail-closed: jeder Kandidat
// ohne Modalgrenze und jede unlesbare Datei beenden mit Code 1 und nennen Datei und Zeile.
// Der Test in `tests/app/mega47-modale-flaechen-sammler.test.tsx` misst DIESELBEN Funktionen —
// es gibt eine Erhebung und zwei Aufrufer.

export function pruefeModalgrenze(wurzel: string = WURZEL): {
  rot: string[];
  gelesen: number;
  kandidaten: number;
} {
  const dateien = quelldateien(WEB_SRC, wurzel);
  // Register A17b: gelesen wird unter DERSELBEN Wurzel, unter der gesucht wurde. Bis hierher las
  // `ladeQuelle` immer unter `WURZEL` — mit einer anderen Wurzel hätte das Tor Dateien als gelesen
  // gezählt, die es nie gelesen hat (bens Frage aus sammel70).
  const erhoben = dateien.map((d) =>
    erhebeDatei(quelleAus(posix(d), readFileSync(join(wurzel, d), "utf8"))),
  );

  // Was der Parser nicht lesen konnte, wird rot — nicht still uebergangen.
  // (`leseFehler` haengt an der Quelle, nicht an der Erhebung — s. `interface Quelle`.)
  const leseFehler = erhoben.flatMap((e) => e.quelle.leseFehler);
  // Register A17b: der unabhängige Zähler und die unbekannten Bauformen gehören INS TOR. Bis
  // hierher liefen sie nur im Test (`UNABGERECHNET` in mega47) — das Tor meldete eine Bauform, die
  // es nicht lesen konnte, also gar nicht.
  const unbekannt = erhoben.flatMap(modalAbgleich);
  const { rot, beurteilt } = beurteile(erhoben);
  // Eine Erhebung, die leer läuft, ist ein Fehler und kein Erfolg. Die gemessenen Untergrenzen
  // gegen ein SCHRUMPFEN stehen in `tests/app/mega47-modale-flaechen-sammler.test.tsx`
  // („die Grundmenge ist an KEINER Stelle still geschrumpft") und laufen im selben Tor danach.
  const leer =
    erhoben.length === 0 || beurteilt.length === 0
      ? [
          `${WEB_SRC} — Erhebung leer (${erhoben.length} Dateien, ${beurteilt.length} Kandidaten): nichts gemessen ist kein Befund`,
        ]
      : [];
  return {
    rot: [...leer, ...leseFehler, ...unbekannt, ...rot],
    gelesen: erhoben.length,
    kandidaten: beurteilt.length,
  };
}

// Direktaufruf (tools/modalgrenze.sh) — beim Import aus dem Test passiert hier nichts.
if (process.argv[1]?.endsWith("modalgrenze.ts")) {
  const { rot, gelesen, kandidaten } = pruefeModalgrenze();
  if (rot.length > 0) {
    console.error(`✖ Modalgrenze verletzt (${rot.length} Fund(e), ${gelesen} Dateien gelesen):`);
    for (const zeile of rot) {
      console.error(`   ${zeile}`);
    }
    process.exit(1);
  }
  console.log(
    `✓ Modalgrenze: ${gelesen} Dateien gelesen, ${kandidaten} Kandidaten beurteilt, keine unbekannte Bauform, kein Fund ohne Grenze`,
  );
}
