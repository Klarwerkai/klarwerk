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

import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  /**
   * Nacharbeit 7: Funktionen dieser Datei, die eine NICHT auflösbare Rolle aus ihrem Parameter an
   * ein DOM-Element weiterreichen (`function Button({ ...props }: ButtonHTMLAttributes<…>)` →
   * `<button {...props} />`). Ihre Rolle setzen die Aufrufer; das Tor prüft deren Spreads.
   */
  weiterreicher: string[];
  /** Nacharbeit 7: Spreads in Komponenten, deren Rolle nicht in dieser Datei feststeht. */
  komponentenStellen: Komponentenstelle[];
}

/** Ein Spread in eine Komponente — ob er zählt, entscheidet das Tor über alle Dateien. */
export interface Komponentenstelle {
  datei: string;
  zeile: number;
  text: string;
  /** Die Komponente im Bestand; `undefined`, wenn nicht lesbar (Paket, Wert) — dann zählt sie. */
  ziel: { modul: string; name: string } | undefined;
  /** Die Herkunft der Props ist nicht auflösbar. */
  abbruch: boolean;
  /** Funktionen dieser Datei, deren Parameter-Rolle hier weiterläuft; `undefined` = namenlos. */
  funktionen: Array<string | undefined>;
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
      ts.isInterfaceDeclaration(n) ||
      ts.isFunctionDeclaration(n)
    ) {
      merke(n.name, n);
    }
    ts.forEachChild(n, gehe);
  };
  gehe(sf);
  return index;
}

// ------------------------------------------------------------------------------------------------
// Nacharbeit 6: MODULE LESEN — der Rückgabetyp einer importierten Funktion.
// ------------------------------------------------------------------------------------------------
//
// `<div {...anzeigestatusAnker(zustand)} />` (BibliothekFlaeche, BibliothekLesen, Mobile) galt als
// abgerissene Kette und machte das Tor am Bestand rot — obwohl `lib/displayStatus.ts` den
// Rückgabetyp `AnzeigestatusAnker` deklariert und der nachweislich KEINE Rolle trägt. Ein Aufruf
// wird deshalb über den deklarierten Rückgabetyp der Funktion beurteilt, auch über einen relativen
// Import hinweg. Ohne Rückgabetyp, bei Paketimporten und Methoden bleibt die Kette abgerissen.

/** Liest ein Quellmodul des Bestands (posix-Pfad ab der Wurzel) — `undefined`, wenn es fehlt. */
export type Modulleser = (datei: string) => Quelle | undefined;

const BESTANDSMODULE = new Map<string, Quelle | null>();

/** Der Leser für den echten Bestand unter `WURZEL`, mit Zwischenspeicher je Datei. */
export function bestandsLeser(datei: string): Quelle | undefined {
  let quelle = BESTANDSMODULE.get(datei);
  if (quelle === undefined) {
    quelle = existsSync(join(WURZEL, datei)) ? ladeQuelle(datei) : null;
    BESTANDSMODULE.set(datei, quelle);
  }
  return quelle ?? undefined;
}

/** `../lib/x` von `apps/web/src/pages/A.tsx` aus → die möglichen Moduldateien. */
function modulKandidaten(vonDatei: string, spezifizierer: string): string[] {
  if (!spezifizierer.startsWith(".")) {
    return [];
  }
  const teile = vonDatei.split("/").slice(0, -1);
  for (const stueck of spezifizierer.split("/")) {
    if (stueck === ".." && teile.length > 0) {
      teile.pop();
    } else if (stueck !== "." && stueck !== "" && stueck !== "..") {
      teile.push(stueck);
    }
  }
  const basis = teile.join("/");
  return [`${basis}.ts`, `${basis}.tsx`, `${basis}/index.ts`, `${basis}/index.tsx`];
}

/** Der deklarierte Rückgabetyp einer Funktion — Deklaration oder `const f = (…): T => …`. */
function rueckgabeTyp(d: ts.Node): ts.TypeNode | undefined {
  if (ts.isFunctionDeclaration(d)) {
    return d.type;
  }
  if (ts.isVariableDeclaration(d) && d.initializer) {
    const init = d.initializer;
    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
      return init.type;
    }
  }
  return undefined;
}

/** Die exportierte Funktion `name` eines Moduls, auf oberster Ebene. */
function exportierteFunktion(quelle: Quelle, name: string): ts.Node | undefined {
  for (const anweisung of quelle.ast.statements) {
    if (ts.isFunctionDeclaration(anweisung) && anweisung.name?.text === name) {
      return istExportiert(anweisung) ? anweisung : undefined;
    }
    if (ts.isVariableStatement(anweisung)) {
      for (const d of anweisung.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === name) {
          return istExportiert(d) ? d : undefined;
        }
      }
    }
  }
  return undefined;
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

// Die Typauflösung liegt auf Modulebene: die Wertauswertung (`statischeWerte`) und die Rolle
// gespreizter Props (`propsRolle`, Nacharbeit 4/5) lesen dieselben lokalen Typen.

function typNamen(deklarationen: Deklarationen, name: string): ts.Node[] {
  const alle = deklarationen.get(name) ?? [];
  return alle.filter((d) => ts.isTypeAliasDeclaration(d) || ts.isInterfaceDeclaration(d));
}

/** Der Typ des Mitglieds `name` in einem LOKAL deklarierten Objekttyp — sonst `undefined`. */
function mitgliedsTypIn(
  deklarationen: Deklarationen,
  typ: ts.TypeNode,
  name: string,
  tiefe: number,
): ts.TypeNode | undefined {
  if (tiefe > MAX_TIEFE) {
    return undefined;
  }
  if (ts.isParenthesizedTypeNode(typ)) {
    return mitgliedsTypIn(deklarationen, typ.type, name, tiefe + 1);
  }
  if (ts.isIntersectionTypeNode(typ)) {
    for (const t of typ.types) {
      const gefunden = mitgliedsTypIn(deklarationen, t, name, tiefe + 1);
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
    for (const d of typNamen(deklarationen, typ.typeName.text)) {
      let gefunden: ts.TypeNode | undefined;
      if (ts.isInterfaceDeclaration(d)) {
        gefunden = mitglieder(d.members);
      } else if (ts.isTypeAliasDeclaration(d)) {
        gefunden = mitgliedsTypIn(deklarationen, d.type, name, tiefe + 1);
      }
      if (gefunden) {
        return gefunden;
      }
    }
  }
  return undefined;
}

/** Die Zeichenkettenwerte eines Typs: Literal-Unionen und lokale Aliasse; sonst offen. */
function typWerteIn(deklarationen: Deklarationen, typ: ts.TypeNode, tiefe: number): Wertbild {
  if (tiefe > MAX_TIEFE) {
    return { werte: [], offen: [typ] };
  }
  if (ts.isLiteralTypeNode(typ)) {
    return istZeichenkettenLiteral(typ.literal)
      ? { werte: [{ text: typ.literal.text, knoten: typ.literal }], offen: [] }
      : { werte: [], offen: [] };
  }
  if (ts.isUnionTypeNode(typ)) {
    return vereine(typ.types.map((t) => typWerteIn(deklarationen, t, tiefe + 1)));
  }
  if (ts.isParenthesizedTypeNode(typ)) {
    return typWerteIn(deklarationen, typ.type, tiefe + 1);
  }
  if (
    typ.kind === ts.SyntaxKind.UndefinedKeyword ||
    typ.kind === ts.SyntaxKind.NullKeyword ||
    typ.kind === ts.SyntaxKind.BooleanKeyword ||
    typ.kind === ts.SyntaxKind.NumberKeyword
  ) {
    return { werte: [], offen: [] };
  }
  if (ts.isTypeReferenceNode(typ) && ts.isIdentifier(typ.typeName)) {
    const alias = typNamen(deklarationen, typ.typeName.text).find(ts.isTypeAliasDeclaration);
    if (alias) {
      return typWerteIn(deklarationen, alias.type, tiefe + 1);
    }
  }
  return { werte: [], offen: [typ] };
}

/** Der Typ, den eine destrukturierte Bindung aus dem Typ ihres Halters bekommt. */
function bindungsTypIn(
  deklarationen: Deklarationen,
  b: ts.BindingElement,
): ts.TypeNode | undefined {
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
  return mitgliedsTypIn(deklarationen, halter.type, name.text, 0);
}

/**
 * Nacharbeit 4/5 (ben): die Rolle eines GESPREIZTEN Props-Ausdrucks, am Verwendungsort bestimmt.
 *
 * Die Ausgänge werden auseinandergehalten:
 *  · `bild.werte`    — die Rolle steht fest (Typ `role: "dialog"`);
 *  · `bild.offen`    — eine Rolle ist da, ihr Wert nicht (`role?: string`);
 *  · `abbrueche`     — nicht auflösbar: die Kette reisst ab (Aufruf ohne Rückgabetyp, `let`,
 *                      Feldzugriff) oder der Typ ist nicht lesbar (Paketimport wie
 *                      `ButtonHTMLAttributes`, `any`, Generika);
 *  · `vonAufrufern`  — nicht auflösbar, aber aus dem PARAMETER einer Funktion: die Rolle setzt,
 *                      wer die Funktion aufruft. Das Tor prüft diese Aufrufstellen
 *                      (`weitergereichteBefunde`, Nacharbeit 7).
 * Alles leer heisst: nachweislich keine Rolle. Ein nicht aufgelöster Typ ergibt das NICHT mehr
 * (Nacharbeit 7, ben: „eine fehlgeschlagene Auflösung darf nicht keineRolle() ergeben“).
 */
export interface PropsRolle {
  bild: Wertbild;
  abbrueche: ts.Node[];
  vonAufrufern: Aufruferquelle[];
}

/** Ein Parameter, dessen Rolle erst an den Aufrufstellen seiner Funktion feststeht. */
export interface Aufruferquelle {
  /** Name der Funktion (Deklaration, `const F = …`, auch in `memo(…)`); `undefined` = namenlos. */
  funktion: string | undefined;
  knoten: ts.Node;
}

function keineRolle(): PropsRolle {
  return { bild: { werte: [], offen: [] }, abbrueche: [], vonAufrufern: [] };
}

function nichtAufloesbar(knoten: ts.Node): PropsRolle {
  return { ...keineRolle(), abbrueche: [knoten] };
}

function vereineRollen(teile: PropsRolle[]): PropsRolle {
  return {
    bild: vereine(teile.map((t) => t.bild)),
    abbrueche: teile.flatMap((t) => t.abbrueche),
    vonAufrufern: teile.flatMap((t) => t.vonAufrufern),
  };
}

/** Woher eine Datei ihre Importe liest: ihr eigener Pfad und der Modulleser. */
export interface Modulumfeld {
  datei: string;
  leser: Modulleser;
}

/** Wo ein Typ steht: die Deklarationen seines Moduls und — für Importe — sein Modulumfeld. */
interface Typumfeld {
  deklarationen: Deklarationen;
  modul: Modulumfeld | undefined;
}

type Importziel = { art: "paket" } | { art: "modul"; quelle: Quelle; datei: string; name: string };

/**
 * Wohin ein Bezeichner importiert wird. `undefined`: kein Import dieses Namens. `paket`: ein
 * Paketimport, ein Standardimport oder ein Modul, das der Leser nicht kennt — nicht lesbar.
 */
function importZiel(name: ts.Identifier, modul: Modulumfeld | undefined): Importziel | undefined {
  for (const anweisung of name.getSourceFile().statements) {
    if (!ts.isImportDeclaration(anweisung) || !ts.isStringLiteral(anweisung.moduleSpecifier)) {
      continue;
    }
    const klausel = anweisung.importClause;
    const bindungen = klausel?.namedBindings;
    const element =
      bindungen !== undefined && ts.isNamedImports(bindungen)
        ? bindungen.elements.find((e) => e.name.text === name.text)
        : undefined;
    // Nacharbeit 11 (ben): ein Standardimport ist kein Paket mehr, sondern der Export `default`
    // des Moduls — `folgeReexport` löst ihn zur benannten Deklaration auf.
    const exportName =
      klausel?.name?.text === name.text
        ? "default"
        : element
          ? (element.propertyName ?? element.name).text
          : undefined;
    if (exportName === undefined) {
      continue;
    }
    for (const kandidat of modulKandidaten(modul?.datei ?? "", anweisung.moduleSpecifier.text)) {
      const quelle = modul?.leser(kandidat);
      if (quelle && modul) {
        // Nacharbeit 8: über Sammeldateien (`components/trust/index.ts`) zur echten Deklaration.
        const ziel = folgeReexport({ quelle, datei: kandidat, name: exportName }, modul.leser, 0);
        return ziel ? { art: "modul", ...ziel } : { art: "paket" };
      }
    }
    return { art: "paket" };
  }
  return undefined;
}

/** Wo ein exportierter Name deklariert ist: Modul, Pfad, Name dort. */
interface Exportort {
  quelle: Quelle;
  datei: string;
  name: string;
}

/** Deklariert das Modul `name` auf oberster Ebene selbst (Funktion, Klasse, Typ, Variable)? */
function deklariertSelbst(quelle: Quelle, name: string): boolean {
  return quelle.ast.statements.some((s) => {
    if (
      ts.isFunctionDeclaration(s) ||
      ts.isClassDeclaration(s) ||
      ts.isInterfaceDeclaration(s) ||
      ts.isTypeAliasDeclaration(s)
    ) {
      return s.name?.text === name;
    }
    if (ts.isVariableStatement(s)) {
      return s.declarationList.declarations.some(
        (d) => ts.isIdentifier(d.name) && d.name.text === name,
      );
    }
    return false;
  });
}

/**
 * Nacharbeit 11: der Name hinter `export default` — `export default function Weiter`,
 * `export default Weiter;` oder `export { Weiter as default }`. `undefined`: namenlos oder ein
 * Ausdruck; ein solcher Export ist nicht zuordenbar.
 */
function standardExportName(quelle: Quelle): string | undefined {
  for (const s of quelle.ast.statements) {
    if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) {
      if ((ts.getCombinedModifierFlags(s) & ts.ModifierFlags.Default) !== 0) {
        return s.name?.text;
      }
      continue;
    }
    if (ts.isExportAssignment(s) && !s.isExportEquals) {
      return ts.isIdentifier(s.expression) ? s.expression.text : undefined;
    }
    if (ts.isExportDeclaration(s) && !s.moduleSpecifier && s.exportClause) {
      if (ts.isNamedExports(s.exportClause)) {
        const element = s.exportClause.elements.find((e) => e.name.text === "default");
        if (element?.propertyName) {
          return element.propertyName.text;
        }
      }
    }
  }
  return undefined;
}

/**
 * Nacharbeit 8: ein Export, der nur weitergereicht wird — `export { X } from "./X"`,
 * `export { X as Y } from "./X"`, `export * from "./X"` —, wird bis zur Deklaration verfolgt.
 * `undefined`: die Deklaration ist nicht zu finden (Paket, unbekanntes Modul) — nicht lesbar.
 */
function folgeReexport(ort: Exportort, leser: Modulleser, tiefe: number): Exportort | undefined {
  if (tiefe > MAX_TIEFE) {
    return undefined;
  }
  if (deklariertSelbst(ort.quelle, ort.name)) {
    return ort;
  }
  if (ort.name === "default") {
    const benannt = standardExportName(ort.quelle);
    if (benannt !== undefined) {
      return folgeReexport({ ...ort, name: benannt }, leser, tiefe + 1);
    }
  }
  // Nacharbeit 12 (ben): `export { Weiter as W }` OHNE `from` — ein lokaler Alias, der auf eine
  // Deklaration dieses Moduls oder auf einen Import zeigt.
  for (const s of ort.quelle.ast.statements) {
    if (
      !ts.isExportDeclaration(s) ||
      s.moduleSpecifier !== undefined ||
      s.exportClause === undefined ||
      !ts.isNamedExports(s.exportClause)
    ) {
      continue;
    }
    const element = s.exportClause.elements.find((e) => e.name.text === ort.name);
    if (element === undefined) {
      continue;
    }
    const lokal = (element.propertyName ?? element.name).text;
    if (deklariertSelbst(ort.quelle, lokal)) {
      return { ...ort, name: lokal };
    }
    const importiert = importBindung(ort, lokal, leser);
    return importiert ? folgeReexport(importiert, leser, tiefe + 1) : undefined;
  }
  for (const s of ort.quelle.ast.statements) {
    if (
      !ts.isExportDeclaration(s) ||
      !s.moduleSpecifier ||
      !ts.isStringLiteral(s.moduleSpecifier)
    ) {
      continue;
    }
    let name: string | undefined;
    if (s.exportClause === undefined) {
      name = ort.name;
    } else if (ts.isNamedExports(s.exportClause)) {
      const element = s.exportClause.elements.find((e) => e.name.text === ort.name);
      name = element ? (element.propertyName ?? element.name).text : undefined;
    }
    if (name === undefined) {
      continue;
    }
    for (const kandidat of modulKandidaten(ort.datei, s.moduleSpecifier.text)) {
      const quelle = leser(kandidat);
      if (quelle) {
        const ziel = folgeReexport({ quelle, datei: kandidat, name }, leser, tiefe + 1);
        if (ziel) {
          return ziel;
        }
        break;
      }
    }
  }
  return undefined;
}

/** Das Modul hinter einem relativen Spezifizierer, wie der Leser es kennt. */
function leseModul(
  vonDatei: string,
  spezifizierer: string,
  leser: Modulleser,
): Exportort | undefined {
  for (const kandidat of modulKandidaten(vonDatei, spezifizierer)) {
    const quelle = leser(kandidat);
    if (quelle) {
      return { quelle, datei: kandidat, name: "" };
    }
  }
  return undefined;
}

/** Woher ein Modul einen lokalen Namen importiert: Zielmodul und Name dort (`default` inklusive). */
function importBindung(ort: Exportort, lokal: string, leser: Modulleser): Exportort | undefined {
  for (const s of ort.quelle.ast.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) {
      continue;
    }
    const klausel = s.importClause;
    const bindungen = klausel?.namedBindings;
    const element =
      bindungen !== undefined && ts.isNamedImports(bindungen)
        ? bindungen.elements.find((e) => e.name.text === lokal)
        : undefined;
    let name: string | undefined;
    if (klausel?.name?.text === lokal) {
      name = "default";
    } else if (element !== undefined) {
      name = (element.propertyName ?? element.name).text;
    }
    if (name === undefined) {
      continue;
    }
    const modul = leseModul(ort.datei, s.moduleSpecifier.text, leser);
    return modul ? { ...modul, name } : undefined;
  }
  return undefined;
}

/**
 * Nacharbeit 12 (ben): ALLE Namen, die ein Modul als Wert exportiert — eigene Exporte, Aliasse
 * (`export { Weiter as W }`), `export * as ns` und rekursiv `export * from` (ohne `default`), mit
 * Zyklenschutz. `vollstaendig: false`, wenn ein `export *` auf ein nicht lesbares Modul zeigt: dann
 * ist die Liste nicht abschliessend.
 */
function exportierteNamen(
  modul: Exportort,
  leser: Modulleser,
  besucht: Set<string> = new Set(),
): { namen: Set<string>; vollstaendig: boolean } {
  const namen = new Set<string>();
  let vollstaendig = true;
  if (besucht.has(modul.datei)) {
    return { namen, vollstaendig };
  }
  besucht.add(modul.datei);
  for (const s of modul.quelle.ast.statements) {
    if (ts.isExportDeclaration(s)) {
      if (s.exportClause === undefined) {
        const ziel =
          s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier)
            ? leseModul(modul.datei, s.moduleSpecifier.text, leser)
            : undefined;
        if (ziel === undefined) {
          vollstaendig = false;
          continue;
        }
        const unter = exportierteNamen(ziel, leser, besucht);
        for (const n of unter.namen) {
          if (n !== "default") {
            namen.add(n);
          }
        }
        vollstaendig = vollstaendig && unter.vollstaendig;
      } else if (ts.isNamedExports(s.exportClause)) {
        for (const element of s.exportClause.elements) {
          namen.add(element.name.text);
        }
      } else {
        namen.add(s.exportClause.name.text);
      }
      continue;
    }
    if (ts.isExportAssignment(s)) {
      namen.add("default");
      continue;
    }
    if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) {
      const flags = ts.getCombinedModifierFlags(s);
      if ((flags & ts.ModifierFlags.Default) !== 0) {
        namen.add("default");
      } else if ((flags & ts.ModifierFlags.Export) !== 0 && s.name) {
        namen.add(s.name.text);
      }
      continue;
    }
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && istExportiert(d)) {
          namen.add(d.name.text);
        }
      }
    }
  }
  return { namen, vollstaendig };
}

/** Die exportierten Typdeklarationen `name` eines Moduls (Interfaces dürfen mehrfach stehen). */
function exportierteTypen(quelle: Quelle, name: string): ts.Node[] {
  return quelle.ast.statements.filter(
    (s) =>
      (ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) &&
      s.name.text === name &&
      istExportiert(s),
  );
}

function umfeldVon(quelle: Quelle, datei: string, leser: Modulleser): Typumfeld {
  return { deklarationen: sammleDeklarationen(quelle.ast), modul: { datei, leser } };
}

/**
 * Nacharbeit 7 (ben): die Rolle in einem Props-TYP, dreiwertig — gefunden (`bild`), nachweislich
 * fehlend (alles leer) oder nicht auflösbar (`abbrueche`). Aufgelöst werden Objekttypen, Unionen und
 * Schnittmengen von Objekttypen, Interfaces mit `extends`, lokale und relativ importierte
 * Typverweise, `Partial`/`Required`/`Readonly`/`NonNullable`/`Omit`/`Pick` sowie Mapped Types über
 * Schlüsselmuster (`data-${string}`). Alles andere ist nicht auflösbar — nie „keine Rolle“.
 */
function rolleImTyp(typ: ts.TypeNode, u: Typumfeld, tiefe: number): PropsRolle {
  if (tiefe > MAX_TIEFE) {
    return nichtAufloesbar(typ);
  }
  if (ts.isParenthesizedTypeNode(typ)) {
    return rolleImTyp(typ.type, u, tiefe + 1);
  }
  if (ts.isUnionTypeNode(typ) || ts.isIntersectionTypeNode(typ)) {
    return vereineRollen(typ.types.map((t) => rolleImTyp(t, u, tiefe + 1)));
  }
  if (ts.isTypeLiteralNode(typ)) {
    return rolleInMitgliedern(typ.members, u);
  }
  if (ts.isMappedTypeNode(typ)) {
    return rolleImMappedType(typ, u);
  }
  if (ts.isTypeReferenceNode(typ)) {
    return rolleImVerweis(typ.typeName, typ.typeArguments ?? [], typ, u, tiefe);
  }
  if (
    ts.isLiteralTypeNode(typ) ||
    ts.isFunctionTypeNode(typ) ||
    typ.kind === ts.SyntaxKind.UndefinedKeyword ||
    typ.kind === ts.SyntaxKind.NullKeyword ||
    typ.kind === ts.SyntaxKind.NeverKeyword ||
    typ.kind === ts.SyntaxKind.VoidKeyword ||
    typ.kind === ts.SyntaxKind.BooleanKeyword ||
    typ.kind === ts.SyntaxKind.NumberKeyword ||
    typ.kind === ts.SyntaxKind.StringKeyword
  ) {
    // Werte ohne Objektgestalt tragen kein `role`.
    return keineRolle();
  }
  return nichtAufloesbar(typ);
}

/** `role` unter den Mitgliedern eines Objekttyps — auch über eine Zeichenketten-Indexsignatur. */
function rolleInMitgliedern(mitglieder: ts.NodeArray<ts.TypeElement>, u: Typumfeld): PropsRolle {
  const teile: PropsRolle[] = [];
  for (const m of mitglieder) {
    const istRolle = ts.isPropertySignature(m) && eigenschaftsName(m.name) === "role";
    const istIndex =
      ts.isIndexSignatureDeclaration(m) &&
      m.parameters.some((p) => p.type?.kind !== ts.SyntaxKind.NumberKeyword);
    if (istRolle || istIndex) {
      const wertTyp = (m as ts.PropertySignature | ts.IndexSignatureDeclaration).type;
      teile.push(
        wertTyp
          ? { ...keineRolle(), bild: typWerteIn(u.deklarationen, wertTyp, 0) }
          : nichtAufloesbar(m),
      );
    }
  }
  return vereineRollen(teile);
}

/** `{ [K in C]?: T }` — `role` gehört dazu, wenn das Schlüsselmuster es zulässt. */
function rolleImMappedType(typ: ts.MappedTypeNode, u: Typumfeld): PropsRolle {
  const schluessel = typ.typeParameter.constraint;
  const wert = (): PropsRolle => {
    if (typ.type === undefined) {
      return nichtAufloesbar(typ);
    }
    return { ...keineRolle(), bild: typWerteIn(u.deklarationen, typ.type, 0) };
  };
  // Nacharbeit 9 (ben): `{ [K in 'x' as 'role']: … }` — mit Umbenennung (`as …`) zählen die
  // NEUEN Schlüssel, nicht die ursprünglichen. Ohne sie die Schlüssel der Bedingung.
  const ausschlaggebend = typ.nameType ?? schluessel;
  if (ausschlaggebend && ts.isTemplateLiteralTypeNode(ausschlaggebend)) {
    // `data-${string}`: jeder Schlüssel beginnt mit `data-` — `role` nachweislich nicht.
    return "role".startsWith(ausschlaggebend.head.text) ? nichtAufloesbar(typ) : keineRolle();
  }
  if (ausschlaggebend) {
    const namen = typWerteIn(u.deklarationen, ausschlaggebend, 0);
    if (namen.offen.length === 0) {
      return namen.werte.some((w) => w.text === "role") ? wert() : keineRolle();
    }
  }
  // Nicht ausgewertet (etwa eine Umbenennung über `K`) ist nicht ausgeschlossen: nicht auflösbar.
  return nichtAufloesbar(typ);
}

/** Ein Typverweis `Name<…>` — lokal, relativ importiert oder ein eingebauter Hilfstyp. */
function rolleImVerweis(
  name: ts.Node,
  argumente: readonly ts.TypeNode[],
  knoten: ts.Node,
  u: Typumfeld,
  tiefe: number,
): PropsRolle {
  if (!ts.isIdentifier(name)) {
    // `React.HTMLAttributes<…>` — ein Namensraum ist nicht lesbar.
    return nichtAufloesbar(knoten);
  }
  const lokal = typNamen(u.deklarationen, name.text);
  if (lokal.length > 0) {
    return vereineRollen(lokal.map((d) => rolleInDeklaration(d, u, tiefe + 1)));
  }
  const ziel = importZiel(name, u.modul);
  if (ziel !== undefined) {
    if (ziel.art === "paket" || u.modul === undefined) {
      return nichtAufloesbar(knoten);
    }
    const decls = exportierteTypen(ziel.quelle, ziel.name);
    if (decls.length === 0) {
      return nichtAufloesbar(knoten);
    }
    const zielUmfeld = umfeldVon(ziel.quelle, ziel.datei, u.modul.leser);
    return vereineRollen(decls.map((d) => rolleInDeklaration(d, zielUmfeld, tiefe + 1)));
  }
  const [basis, schluessel] = argumente;
  const hilfstyp = ["Partial", "Required", "Readonly", "NonNullable"].includes(name.text);
  if (hilfstyp && basis) {
    return rolleImTyp(basis, u, tiefe + 1);
  }
  if ((name.text === "Omit" || name.text === "Pick") && basis && schluessel) {
    const namen = typWerteIn(u.deklarationen, schluessel, 0);
    if (namen.offen.length > 0) {
      return nichtAufloesbar(knoten);
    }
    const mitRolle = namen.werte.some((w) => w.text === "role");
    // Omit ohne `role` und Pick mit `role` behalten die Rolle der Basis; sonst ist sie weg.
    return (name.text === "Omit") !== mitRolle ? rolleImTyp(basis, u, tiefe + 1) : keineRolle();
  }
  return nichtAufloesbar(knoten);
}

/** Interface (eigene Mitglieder, sonst `extends`) oder Typalias. */
function rolleInDeklaration(d: ts.Node, u: Typumfeld, tiefe: number): PropsRolle {
  if (ts.isTypeAliasDeclaration(d)) {
    return rolleImTyp(d.type, u, tiefe);
  }
  if (!ts.isInterfaceDeclaration(d)) {
    return nichtAufloesbar(d);
  }
  const eigene = rolleInMitgliedern(d.members, u);
  if (eigene.bild.werte.length + eigene.bild.offen.length + eigene.abbrueche.length > 0) {
    return eigene;
  }
  const geerbt = (d.heritageClauses ?? []).flatMap((h) =>
    h.types.map((t) => rolleImVerweis(t.expression, t.typeArguments ?? [], t, u, tiefe + 1)),
  );
  return vereineRollen(geerbt);
}

/** Die Rolle eines Props-Typs an einer Deklaration; ohne Typangabe ist sie nicht auflösbar. */
function rolleAusTyp(u: Typumfeld, typ: ts.TypeNode | undefined, ersatz: ts.Node): PropsRolle {
  return typ ? rolleImTyp(typ, u, 0) : nichtAufloesbar(ersatz);
}

/** Ist die Deklaration eine Funktion — direkt oder als `const F = memo((…) => …)`? */
function istFunktion(d: ts.Node): boolean {
  if (ts.isFunctionDeclaration(d)) {
    return true;
  }
  if (!ts.isVariableDeclaration(d) || d.initializer === undefined) {
    return false;
  }
  let init: ts.Node = d.initializer;
  while (ts.isCallExpression(init) && init.arguments[0] !== undefined) {
    init = init.arguments[0];
  }
  return ts.isArrowFunction(init) || ts.isFunctionExpression(init);
}

/** Der Name der Funktion, zu der ein Parameter gehört — auch durch `memo(…)`/`forwardRef(…)`. */
function funktionsName(funktion: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(funktion)) {
    return funktion.name?.text;
  }
  if (ts.isArrowFunction(funktion) || ts.isFunctionExpression(funktion)) {
    let p: ts.Node = funktion.parent;
    while (ts.isCallExpression(p)) {
      p = p.parent;
    }
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
      return p.name.text;
    }
  }
  return undefined;
}

/**
 * Was am Parameter nicht auflösbar ist, entscheidet sich an den Aufrufstellen: aus `abbrueche`
 * wird `vonAufrufern` mit dem Namen der Funktion. Was aufgelöst ist, bleibt, wie es ist.
 */
function ausDemParameter(r: PropsRolle, parameter: ts.ParameterDeclaration): PropsRolle {
  if (r.abbrueche.length === 0) {
    return r;
  }
  const quelle: Aufruferquelle = { funktion: funktionsName(parameter.parent), knoten: parameter };
  return { bild: r.bild, abbrueche: [], vonAufrufern: [...r.vonAufrufern, quelle] };
}

/**
 * Nacharbeit 6: die Rolle eines Aufrufs `f(…)` — aus dem deklarierten Rückgabetyp von `f`, lokal
 * oder im relativ importierten Modul (dort mit DESSEN Typen). Ohne Rückgabetyp reisst die Kette ab.
 */
function rolleAusAufruf(
  aufruf: ts.CallExpression,
  deklarationen: Deklarationen,
  umfeld: Modulumfeld | undefined,
): PropsRolle {
  const name = aufruf.expression;
  if (!ts.isIdentifier(name)) {
    return nichtAufloesbar(aufruf);
  }
  const lokal = sichtbareDeklarationen(deklarationen, name);
  if (lokal.length > 0) {
    const u: Typumfeld = { deklarationen, modul: umfeld };
    return vereineRollen(lokal.map((d) => rolleAusTyp(u, rueckgabeTyp(d), aufruf)));
  }
  const ziel = importZiel(name, umfeld);
  if (ziel === undefined || ziel.art === "paket" || umfeld === undefined) {
    return nichtAufloesbar(aufruf);
  }
  const funktion = exportierteFunktion(ziel.quelle, ziel.name);
  const typ = funktion ? rueckgabeTyp(funktion) : undefined;
  return rolleAusTyp(umfeldVon(ziel.quelle, ziel.datei, umfeld.leser), typ, aufruf);
}

export function propsRolle(
  ausdruck: ts.Node,
  deklarationen: Deklarationen,
  umfeld?: Modulumfeld,
  mitEigenen = false,
  tiefe = 0,
  pfad: Set<ts.Node> = new Set(),
): PropsRolle {
  const abbruch = nichtAufloesbar;
  const weiter = (n: ts.Node): PropsRolle =>
    propsRolle(n, deklarationen, umfeld, mitEigenen, tiefe + 1, pfad);
  if (tiefe > MAX_TIEFE) {
    return abbruch(ausdruck);
  }
  let k: ts.Node = ausdruck;
  while (
    ts.isParenthesizedExpression(k) ||
    ts.isNonNullExpression(k) ||
    ts.isAsExpression(k) ||
    ts.isSatisfiesExpression(k)
  ) {
    k = k.expression;
  }
  if (ts.isObjectLiteralExpression(k)) {
    // Eigene `role`-Einträge erhebt am JSX-Spread der Eigenschaftsbesucher (`istPropsObjekt`); hier
    // zählen dann nur die gespreizten Teile — `{ ...props, id }` trägt die Rolle von `props` weiter.
    // `mitEigenen` (Nacharbeit 10, direkte Aufrufe): auch die eigenen Einträge, über die ganze Kette.
    const teile = k.properties.filter(ts.isSpreadAssignment).map((s) => weiter(s.expression));
    for (const eig of mitEigenen ? k.properties : []) {
      if (ts.isPropertyAssignment(eig) && eigenschaftsName(eig.name) === "role") {
        teile.push({ ...keineRolle(), bild: statischeWerte(eig.initializer, deklarationen) });
      }
      if (ts.isShorthandPropertyAssignment(eig) && eig.name.text === "role") {
        teile.push({ ...keineRolle(), bild: statischeWerte(eig.name, deklarationen) });
      }
    }
    return vereineRollen(teile);
  }
  if (ts.isConditionalExpression(k)) {
    return vereineRollen([weiter(k.whenTrue), weiter(k.whenFalse)]);
  }
  if (ts.isBinaryExpression(k)) {
    const op = k.operatorToken.kind;
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) {
      return vereineRollen([weiter(k.left), weiter(k.right)]);
    }
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      return weiter(k.right);
    }
  }
  if (k.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(k) && k.text === "undefined")) {
    return keineRolle();
  }
  if (ts.isCallExpression(k)) {
    return rolleAusAufruf(k, deklarationen, umfeld);
  }
  if (!ts.isIdentifier(k)) {
    return abbruch(k);
  }
  const decls = sichtbareDeklarationen(deklarationen, k);
  if (decls.length === 0) {
    return abbruch(k);
  }
  return vereineRollen(
    decls.map((d) => {
      if (pfad.has(d)) {
        return abbruch(d);
      }
      pfad.add(d);
      try {
        return deklarationsRolle({ deklarationen, modul: umfeld }, d, weiter);
      } finally {
        pfad.delete(d);
      }
    }),
  );
}

/** Die Rolle, die eine Deklaration als Props-Wert trägt — über ihren Typ oder ihre Herkunft. */
function deklarationsRolle(
  u: Typumfeld,
  d: ts.Node,
  weiter: (n: ts.Node) => PropsRolle,
): PropsRolle {
  if (ts.isParameter(d) && ts.isIdentifier(d.name)) {
    return ausDemParameter(rolleAusTyp(u, d.type, d), d);
  }
  if (ts.isVariableDeclaration(d)) {
    // Nacharbeit 5 (ben): die Kette läuft über den Initialisierer weiter (`const q = props`).
    // Nur wenn sie abreisst, gilt eine eigene Typangabe als Ersatz.
    const konstant = (ts.getCombinedNodeFlags(d) & ts.NodeFlags.Const) !== 0;
    if (konstant && d.initializer) {
      const herkunft = weiter(d.initializer);
      if (herkunft.abbrueche.length > 0 && d.type) {
        return rolleAusTyp(u, d.type, d);
      }
      return herkunft;
    }
    return rolleAusTyp(u, d.type, d);
  }
  if (ts.isBindingElement(d) && d.dotDotDotToken !== undefined) {
    // `{ a, ...rest }: Props` — `rest` trägt `role`, sofern es nicht daneben herausgelöst wurde.
    const muster = d.parent;
    if (!ts.isObjectBindingPattern(muster)) {
      return nichtAufloesbar(d);
    }
    const herausgeloest = muster.elements.some((e) => {
      const name = e.propertyName ?? e.name;
      return e !== d && ts.isIdentifier(name) && name.text === "role";
    });
    const halter = muster.parent;
    if (herausgeloest) {
      return keineRolle();
    }
    if (ts.isParameter(halter)) {
      return ausDemParameter(rolleAusTyp(u, halter.type, halter), halter);
    }
    if (ts.isVariableDeclaration(halter)) {
      // `const { a, ...rest } = props` — ohne Typangabe trägt der Rest die Rolle der Quelle.
      if (halter.type) {
        return rolleAusTyp(u, halter.type, halter);
      }
      return halter.initializer ? weiter(halter.initializer) : nichtAufloesbar(d);
    }
    return nichtAufloesbar(d);
  }
  if (ts.isBindingElement(d)) {
    // Ein einzelnes Feld als Props-Objekt (`({ p }: { p: P })`). Sein Typ wird nur lokal gelesen;
    // ohne ihn ist das Feld nicht auflösbar — als Parameterfeld entscheidet der Aufrufer.
    const typ = bindungsTypIn(u.deklarationen, d);
    const r = rolleAusTyp(u, typ, d);
    const halter = d.parent.parent;
    return ts.isParameter(halter) ? ausDemParameter(r, halter) : r;
  }
  return nichtAufloesbar(d);
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

  const typWerte = (typ: ts.TypeNode, tiefe: number): Wertbild =>
    typWerteIn(deklarationen, typ, tiefe);
  const bindungsTyp = (b: ts.BindingElement): ts.TypeNode | undefined =>
    bindungsTypIn(deklarationen, b);

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

// Nacharbeit 6: `leser` liefert importierte Module für die Rückgabetypen gespreizter Aufrufe. Die
// Vorgabe liest den echten Bestand; das Tor reicht die Module seines eigenen Baums herein.
export function erhebeDatei(quelle: Quelle, leser: Modulleser = bestandsLeser): DateiErhebung {
  const sf = quelle.ast;
  const umfeld: Modulumfeld = { datei: quelle.datei, leser };
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

  const weiterreicher = new Set<string>();
  const komponentenStellen: Komponentenstelle[] = [];

  // Wohin ein Spread in eine Komponente geht: eine Funktion des Bestands — oder nichts Lesbares
  // (Paket, Wert); dann zählt die Stelle im Tor wie eine an einem DOM-Element. Re-Exporte über
  // Sammeldateien folgt `importZiel` bis zur Deklaration (Nacharbeit 8).
  const komponentenZiel = (tag: ts.Node): Komponentenstelle["ziel"] => {
    if (!ts.isIdentifier(tag)) {
      return undefined;
    }
    const lokal = sichtbareDeklarationen(deklarationen, tag);
    if (lokal.length > 0) {
      return lokal.every(istFunktion) ? { modul: quelle.datei, name: tag.text } : undefined;
    }
    const ziel = importZiel(tag, umfeld);
    if (ziel?.art !== "modul") {
      return undefined;
    }
    const funktion = exportierteFunktion(ziel.quelle, ziel.name);
    return funktion && istFunktion(funktion) ? { modul: ziel.datei, name: ziel.name } : undefined;
  };

  // Die Rolle gespreizter Props: ein Dialogwert wird Kandidat am Spread, eine vorhandene, aber
  // unbestimmbare Rolle (`role?: string`) eine unbekannte Bauform — rot mit Datei und Zeile.
  // Nacharbeit 5: reisst die lokale Herkunft ab, ist das an einem DOM-Element ebenfalls rot — dort
  // wird `role` unmittelbar zum Attribut. Bei einem Bauteil beurteilt dessen eigene Datei, was es
  // mit den Props baut (dort ist der Spread wieder ein Ausgangspunkt).
  //
  // Nacharbeit 7: eine nicht auflösbare Rolle aus dem PARAMETER einer benannten Funktion ist am
  // DOM-Element kein Befund dieser Stelle — die Funktion wird als `weiterreicher` vermerkt, und das
  // Tor prüft ihre Aufrufstellen. Spreads in Komponenten werden als `komponentenStellen` vermerkt.
  const meldePropsRolle = (ausdruck: ts.Node, tag: ts.Node, aufDomElement: boolean): void => {
    const { bild, abbrueche, vonAufrufern } = propsRolle(ausdruck, deklarationen, umfeld);
    const text = ausdruck.getText(sf).replace(/\s+/g, " ").slice(0, 60);
    const zeile = zeileVon(sf, ausdruck);
    if (!aufDomElement && (abbrueche.length > 0 || vonAufrufern.length > 0)) {
      komponentenStellen.push({
        datei: quelle.datei,
        zeile,
        text,
        ziel: komponentenZiel(tag),
        abbruch: abbrueche.length > 0,
        funktionen: vonAufrufern.map((q) => q.funktion),
      });
    }
    for (const q of aufDomElement ? vonAufrufern : []) {
      if (q.funktion !== undefined) {
        weiterreicher.add(q.funktion);
      } else {
        unbekannteBauformen.push(
          `${quelle.datei}:${zeile} — gespreizte Props „${text}“ an einem DOM-Element: ihre Rolle kommt aus dem Parameter einer namenlosen Funktion, deren Aufrufer dieser Sammler nicht findet`,
        );
      }
    }
    for (const w of bild.werte) {
      if (istDialogName(w.text)) {
        melde(ausdruck, "role-dialog");
        kandidatTokens.add(w.knoten);
      }
    }
    if (bild.offen.length > 0) {
      unbekannteBauformen.push(
        `${quelle.datei}:${zeileVon(sf, ausdruck)} — gespreizte Props „${text}“ tragen eine Rolle, deren Wert statisch nicht bestimmbar ist: ob hier ein Dialog entsteht, kann dieser Sammler nicht beurteilen`,
      );
    }
    if (aufDomElement && abbrueche.length > 0) {
      unbekannteBauformen.push(
        `${quelle.datei}:${zeile} — gespreizte Props „${text}“ an einem DOM-Element: ihre Herkunft oder ihr Typ ist nicht auflösbar, ob sie eine Rolle tragen, kann dieser Sammler nicht beurteilen`,
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
    // Nacharbeit 4 (ben): der SPREAD ist selbst Ausgangspunkt. `<div {...props} />` mit
    // `props: { role: "dialog" }` hat kein Objektliteral, an dem der Besucher oben ansetzen könnte —
    // die Rolle steht nur im lokalen Typ des Parameters (`propsRolle`). Nacharbeit 5: auch über
    // lokale Initialisierer und Bindungsketten (`const q = props; <div {...q} />`).
    if (ts.isJsxSpreadAttribute(node)) {
      const element = node.parent.parent;
      const aufDom = ts.isIdentifier(element.tagName) && /^[a-z]/.test(element.tagName.text);
      meldePropsRolle(node.expression, element.tagName, aufDom);
    }
    if (ts.isCallExpression(node) && aufrufName(node) === "createElement") {
      const [tag, props] = node.arguments;
      if (tag && props) {
        // Ein bestimmter Zeichenkettenwert als Tag ist ein DOM-Element (`createElement("div", …)`).
        const tagWerte = statischeWerte(tag, deklarationen);
        const aufDom = tagWerte.werte.length > 0 && tagWerte.offen.length === 0;
        meldePropsRolle(props, tag, aufDom);
      }
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
    weiterreicher: [...weiterreicher],
    komponentenStellen,
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

/** Nacharbeit 9: was ausserhalb von JSX/`createElement` mit einem Weiterreicher geschieht. */
interface Direktverwendungen {
  /** Direkte Aufrufe `F(props)` — ausgewertet wie `createElement(F, props)`. */
  stellen: Komponentenstelle[];
  /** Fertige Befunde: Wertverwendungen, Dialog- und unbestimmte Rollen direkter Aufrufe. */
  befunde: string[];
}

/** Ist dieser Bezeichner nur ein Name (Deklaration, Import/Export, Eigenschaft, Typ) — kein Wert? */
function istNurName(id: ts.Identifier): boolean {
  const p = id.parent;
  if (
    ts.isImportSpecifier(p) ||
    ts.isImportClause(p) ||
    ts.isExportSpecifier(p) ||
    ts.isNamespaceImport(p) ||
    // `export default Weiter;` ist ein Export, kein Wert: Standardimporte werden aufgelöst.
    ts.isExportAssignment(p) ||
    ts.isJsxAttribute(p) ||
    (ts.isQualifiedName(p) && p.right === id) ||
    (ts.isPropertyAccessExpression(p) && p.name === id) ||
    (ts.isBindingElement(p) && p.propertyName === id)
  ) {
    return true;
  }
  if (
    (ts.isFunctionDeclaration(p) ||
      ts.isVariableDeclaration(p) ||
      ts.isParameter(p) ||
      ts.isBindingElement(p) ||
      ts.isPropertyAssignment(p) ||
      ts.isPropertySignature(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isMethodDeclaration(p)) &&
    p.name === id
  ) {
    return true;
  }
  // `typeof F` und andere Typpositionen verwenden den Wert nicht zur Laufzeit.
  for (let k: ts.Node = p; !ts.isSourceFile(k); k = k.parent) {
    if (ts.isTypeQueryNode(k) || ts.isTypeReferenceNode(k)) {
      return true;
    }
  }
  return false;
}

/**
 * Nacharbeit 9 (ben): JEDE Verwendung eines Weiterreichers wird abgerechnet, nicht nur JSX und
 * `createElement`. Ein direkter Aufruf `F(props)` wird wie `createElement(F, props)` ausgewertet;
 * jede andere Verwendung als Wert (`memo(F)`, `{ F }`, `as={F}`, Rückgabe, Zuweisung) macht die
 * Aufrufer unauffindbar und ist rot mit Datei und Zeile — statt den ursprünglichen Befund am
 * DOM-Element ersatzlos zu unterdrücken.
 */
function weiterreicherVerwendungen(
  erhoben: DateiErhebung[],
  weiter: Set<string>,
  leser: Modulleser,
): Direktverwendungen {
  const namen = new Set([...weiter].map((k) => k.slice(k.lastIndexOf("#") + 1)));
  const ergebnis: Direktverwendungen = { stellen: [], befunde: [] };
  for (const e of erhoben) {
    const quelle = e.quelle;
    const sf = quelle.ast;
    // Nacharbeit 10 (ben): ein Import-Alias (`import { Weiter as W }`, auch über eine Sammeldatei)
    // trägt einen anderen Namen als die Deklaration. Gefiltert wird deshalb nach allen Namen, die
    // eine Bindung tragen KÖNNEN; ob sie den Weiterreicher trägt, entscheidet die Auflösung.
    // Nacharbeit 11 (ben): auch Standardimporte (`import W from`) und Namensräume
    // (`import * as M from` → `M.Weiter(…)`) tragen einen Weiterreicher.
    const lokaleNamen = new Set(namen);
    const namensraeume = new Map<string, string>();
    for (const s of sf.statements) {
      if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) {
        continue;
      }
      const klausel = s.importClause;
      if (klausel?.name) {
        lokaleNamen.add(klausel.name.text);
      }
      const bindungen = klausel?.namedBindings;
      if (bindungen !== undefined && ts.isNamedImports(bindungen)) {
        for (const element of bindungen.elements) {
          lokaleNamen.add(element.name.text);
        }
      }
      if (bindungen !== undefined && ts.isNamespaceImport(bindungen)) {
        namensraeume.set(bindungen.name.text, s.moduleSpecifier.text);
      }
    }
    const deklarationen = sammleDeklarationen(sf);
    const umfeld: Modulumfeld = { datei: quelle.datei, leser };
    // Das Modul hinter einem Namensraumimport — nur, wenn der Name hier nicht überdeckt ist.
    const namensraumModul = (id: ts.Identifier): Exportort | undefined => {
      const spezifizierer = namensraeume.get(id.text);
      if (spezifizierer === undefined || sichtbareDeklarationen(deklarationen, id).length > 0) {
        return undefined;
      }
      for (const kandidat of modulKandidaten(quelle.datei, spezifizierer)) {
        const modul = leser(kandidat);
        if (modul) {
          return { quelle: modul, datei: kandidat, name: "" };
        }
      }
      return undefined;
    };
    // Der Weiterreicher hinter `M.name` — über Re-Exporte bis zur Deklaration.
    const ausNamensraum = (modul: Exportort, name: string): string | undefined => {
      const ort = folgeReexport({ ...modul, name }, leser, 0);
      const schluessel = ort ? `${ort.datei}#${ort.name}` : undefined;
      return schluessel !== undefined && weiter.has(schluessel) ? schluessel : undefined;
    };
    const zielVon = (id: ts.Identifier): string | undefined => {
      const lokal = sichtbareDeklarationen(deklarationen, id);
      if (lokal.length > 0) {
        return lokal.some(istFunktion) ? `${quelle.datei}#${id.text}` : undefined;
      }
      const ziel = importZiel(id, umfeld);
      return ziel?.art === "modul" ? `${ziel.datei}#${ziel.name}` : undefined;
    };
    // `id` ist der genutzte Ausdruck: der Bezeichner `W` oder der Zugriff `M.Weiter`/`M["Weiter"]`.
    const pruefeVerwendung = (id: ts.Expression, ziel: string): void => {
      const p = id.parent;
      const zeile = zeileVon(sf, id);
      const name = id.getText(sf);
      const trenner = ziel.lastIndexOf("#");
      const istTag =
        (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxClosingElement(p)) &&
        p.tagName === id;
      const istCreateElement =
        ts.isCallExpression(p) && aufrufName(p) === "createElement" && p.arguments[0] === id;
      if (istTag || istCreateElement) {
        return;
      }
      if (ts.isCallExpression(p) && p.expression === id) {
        const props = p.arguments[0];
        if (props === undefined) {
          return;
        }
        const r = propsRolle(props, deklarationen, umfeld);
        // Nacharbeit 10 (ben): die eigenen `role`-Einträge des übergebenen Werts — auch hinter
        // einer Zwischenvariable oder einem Objekt-Spread (`const p = { role: x }; F(p)`). Am
        // JSX-Spread erhebt sie der Eigenschaftsbesucher; einen direkten Aufruf kennt er nicht.
        const mitEigenen = propsRolle(props, deklarationen, umfeld, true);
        const text = props.getText(sf).replace(/\s+/g, " ").slice(0, 60);
        if (r.bild.werte.some((w) => istDialogName(w.text)) && !e.nutztGrenze) {
          ergebnis.befunde.push(
            `${quelle.datei}:${zeile} — role-dialog über den direkten Aufruf ${name}(…): mögliche modale Fläche ohne die Modalgrenze der Shell`,
          );
        }
        if (mitEigenen.bild.offen.length > 0) {
          ergebnis.befunde.push(
            `${quelle.datei}:${zeile} — Props „${text}“ im direkten Aufruf ${name}(…) tragen eine Rolle, deren Wert statisch nicht bestimmbar ist: ob hier ein Dialog entsteht, kann dieser Sammler nicht beurteilen`,
          );
        }
        ergebnis.stellen.push({
          datei: quelle.datei,
          zeile,
          text,
          ziel: { modul: ziel.slice(0, trenner), name: ziel.slice(trenner + 1) },
          abbruch: r.abbrueche.length > 0,
          funktionen: r.vonAufrufern.map((q) => q.funktion),
        });
        return;
      }
      ergebnis.befunde.push(
        `${quelle.datei}:${zeile} — ${name} reicht Props bis zu einem DOM-Element weiter, wird hier aber als Wert verwendet: seine Aufrufer und deren Rollen kann dieser Sammler nicht finden`,
      );
    };
    // `M.Weiter` / `M["Weiter"]` wird wie ein Bezeichner geprüft. Der Namensraum selbst als Wert
    // (`[M]`, `f(M)`, `M[k]`) gibt jeden enthaltenen Weiterreicher aus der Hand — nicht zuordenbar.
    const pruefeNamensraum = (m: ts.Identifier, modul: Exportort): void => {
      const p = m.parent;
      if (ts.isPropertyAccessExpression(p) && p.expression === m) {
        const ziel = ausNamensraum(modul, p.name.text);
        if (ziel !== undefined) {
          pruefeVerwendung(p, ziel);
        }
        return;
      }
      if (
        ts.isElementAccessExpression(p) &&
        p.expression === m &&
        istZeichenkettenLiteral(p.argumentExpression)
      ) {
        const ziel = ausNamensraum(modul, p.argumentExpression.text);
        if (ziel !== undefined) {
          pruefeVerwendung(p, ziel);
        }
        return;
      }
      // Nacharbeit 12 (ben): die TATSÄCHLICH exportierten Namen, rekursiv über Aliasse und
      // `export *` — ein Alias wie `W` aus `export { Weiter as W }` hinter `export *` zählt mit.
      const exportiert = exportierteNamen(modul, leser);
      const enthalten = [...exportiert.namen].filter((n) => ausNamensraum(modul, n) !== undefined);
      const stelle = `${quelle.datei}:${zeileVon(sf, m)} — der Namensraum ${m.text}`;
      if (enthalten.length > 0) {
        ergebnis.befunde.push(
          `${stelle} enthält den Weiterreicher ${enthalten.join(", ")} und wird hier als Wert verwendet: dessen Aufrufer und deren Rollen kann dieser Sammler nicht finden`,
        );
      } else if (!exportiert.vollstaendig && weiter.size > 0) {
        // Nicht abschliessend erhoben ist nicht nachweislich frei von Weiterreichern.
        ergebnis.befunde.push(
          `${stelle} wird hier als Wert verwendet, seine Exporte sind nicht vollständig auflösbar (export * aus einem nicht lesbaren Modul): ob er einen Weiterreicher enthält, kann dieser Sammler nicht beurteilen`,
        );
      }
    };
    const gehe = (n: ts.Node): void => {
      const modul = ts.isIdentifier(n) ? namensraumModul(n) : undefined;
      if (ts.isIdentifier(n) && modul !== undefined && !istNurName(n)) {
        pruefeNamensraum(n, modul);
      } else if (ts.isIdentifier(n) && lokaleNamen.has(n.text) && !istNurName(n)) {
        const ziel = zielVon(n);
        if (ziel !== undefined && weiter.has(ziel)) {
          pruefeVerwendung(n, ziel);
        }
      }
      ts.forEachChild(n, gehe);
    };
    gehe(sf);
  }
  return ergebnis;
}

/**
 * Nacharbeit 7: die Aufrufstellen der Weiterreicher, über ALLE Dateien. Eine Komponente reicht
 * weiter, wenn ihre nicht auflösbare Parameter-Rolle ein DOM-Element erreicht — direkt oder über
 * eine weitere weiterreichende Komponente (Fixpunkt). Ein Spread in eine solche Komponente oder in
 * eine nicht lesbare (Paket) zählt wie ein Spread an einem DOM-Element: ist seine Herkunft nicht
 * auflösbar oder stammt er aus einer namenlosen Funktion, ist er rot mit Datei und Zeile.
 */
export function weitergereichteBefunde(
  erhoben: DateiErhebung[],
  leser: Modulleser = bestandsLeser,
): string[] {
  const schluessel = (modul: string, name: string): string => `${modul}#${name}`;
  const weiter = new Set(
    erhoben.flatMap((e) => e.weiterreicher.map((n) => schluessel(e.quelle.datei, n))),
  );
  const jsxStellen = erhoben.flatMap((e) => e.komponentenStellen);
  const zaehlt = (s: Komponentenstelle): boolean =>
    s.ziel === undefined || weiter.has(schluessel(s.ziel.modul, s.ziel.name));
  const erweitere = (stellen: Komponentenstelle[]): void => {
    let gewachsen = true;
    while (gewachsen) {
      gewachsen = false;
      for (const s of stellen.filter(zaehlt)) {
        for (const f of s.funktionen) {
          if (f !== undefined && !weiter.has(schluessel(s.datei, f))) {
            weiter.add(schluessel(s.datei, f));
            gewachsen = true;
          }
        }
      }
    }
  };
  // Nacharbeit 9 (ben): auch direkte Aufrufe und Wertverwendungen der Weiterreicher zählen. Neue
  // Weiterreicher aus direkten Aufrufen erweitern die Menge — deshalb im Wechsel bis zur Ruhe.
  let direkt: Direktverwendungen = { stellen: [], befunde: [] };
  let groesse = -1;
  while (groesse !== weiter.size) {
    groesse = weiter.size;
    erweitere([...jsxStellen, ...direkt.stellen]);
    direkt = weiterreicherVerwendungen(erhoben, weiter, leser);
    erweitere([...jsxStellen, ...direkt.stellen]);
  }
  const befunde: string[] = [...direkt.befunde];
  for (const s of [...jsxStellen, ...direkt.stellen].filter(zaehlt)) {
    const wohin = s.ziel ? `<${s.ziel.name}> (${s.ziel.modul})` : "eine nicht lesbare Komponente";
    if (s.abbruch) {
      befunde.push(
        `${s.datei}:${s.zeile} — gespreizte Props „${s.text}“ in ${wohin}, die Props bis zu einem DOM-Element weiterreicht: ihre Herkunft oder ihr Typ ist nicht auflösbar, ob sie eine Rolle tragen, kann dieser Sammler nicht beurteilen`,
      );
    }
    if (s.funktionen.includes(undefined)) {
      befunde.push(
        `${s.datei}:${s.zeile} — gespreizte Props „${s.text}“ in ${wohin}: ihre Rolle kommt aus dem Parameter einer namenlosen Funktion, deren Aufrufer dieser Sammler nicht findet`,
      );
    }
  }
  return befunde;
}

export function pruefeModalgrenze(wurzel: string = WURZEL): {
  rot: string[];
  gelesen: number;
  kandidaten: number;
} {
  const dateien = quelldateien(WEB_SRC, wurzel);
  // Register A17b: gelesen wird unter DERSELBEN Wurzel, unter der gesucht wurde. Bis hierher las
  // `ladeQuelle` immer unter `WURZEL` — mit einer anderen Wurzel hätte das Tor Dateien als gelesen
  // gezählt, die es nie gelesen hat (bens Frage aus sammel70).
  const quellen = new Map<string, Quelle>();
  for (const d of dateien) {
    quellen.set(posix(d), quelleAus(posix(d), readFileSync(join(wurzel, d), "utf8")));
  }
  // Nacharbeit 6: Importe werden aus DEMSELBEN Baum gelesen, nicht aus `WURZEL`.
  const leser: Modulleser = (datei) => quellen.get(datei);
  const erhoben = [...quellen.values()].map((q) => erhebeDatei(q, leser));

  // Was der Parser nicht lesen konnte, wird rot — nicht still uebergangen.
  // (`leseFehler` haengt an der Quelle, nicht an der Erhebung — s. `interface Quelle`.)
  const leseFehler = erhoben.flatMap((e) => e.quelle.leseFehler);
  // Register A17b: der unabhängige Zähler und die unbekannten Bauformen gehören INS TOR. Bis
  // hierher liefen sie nur im Test (`UNABGERECHNET` in mega47) — das Tor meldete eine Bauform, die
  // es nicht lesen konnte, also gar nicht.
  const unbekannt = [...erhoben.flatMap(modalAbgleich), ...weitergereichteBefunde(erhoben, leser)];
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
