// ================================================================================================
// R-1165 · R-1175 (aufnahme:20260922:gesamt-rechte-inventar) — DIE GRUNDMENGE DER SCHNITTSTELLEN,
// SELBST ERHOBEN.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Beide Wächter über die Serverrouten nahmen ihre Grundmenge bis hierher
// aus einer DATEIAUSWAHL, nicht aus dem Server:
//
//   · `routeGuardAudit.ts` (`routeSourceFiles`): `services/app/src/routes/*-routes.ts`, nicht
//     rekursiv, plus zwei namentlich genannte Dateien — und eine URL nur, wenn das erste
//     `"/…"`-Literal im Block in die Zeichenklasse `[A-Za-z0-9/:_.-]` passt. Alles andere fiel als
//     `(unknown)` STILL heraus.
//   · `mega74-lesewege-sammler.test.ts` (`dateien`): `services/app/src/routes/**` plus
//     `build-app.ts` — und ein Fund nur, wenn der Pfad ein Zeichenkettenliteral ist.
//
// GEMESSEN AM STAND 41ba0b7f, nicht vermutet — drei echte Registrierungen lagen ausserhalb:
//
//   · `services/app/src/web-static.ts:89` — `app.get(KLARA_TASKPANE_PFAD, …)`. Konstantenpfad und
//     ausserhalb BEIDER Dateiauswahlen. Keiner der zwei Wächter hat diese Route je gesehen.
//   · `services/app/src/routes/naechster-schritt-entwurf.ts:88` — `app.get<…>(NAECHSTER_SCHRITT_PFAD,
//     …)`. Kein `-routes.ts` (Audit blind), Konstantenpfad (Sammler blind, sein Textlauf verlangt ein
//     Literal und schlug deshalb ebenfalls nicht an).
//   · `services/app/src/routes/addin-static-routes.ts:181` — `app.get<…>("/addin/*", …)`. Der Stern
//     passt nicht in die Zeichenklasse des Audits; die Route lief dort als `(unknown)` still durch.
//
// DESHALB HIER, NACH DEM MERKSATZ DES PRÜFERS (R-1175: „ein Wächter taugt nur, wenn er seine
// Grundmenge selbst und autoritativ erhebt, ein Schrumpfen fail-closed erkennt, jedem Fund genau ein
// Urteil zuordnet"):
//
//   (1) DIE DATEIEN ENTSTEHEN AUS DEM QUELLTEXT. `routenquellen()` steigt durch `services/**` und
//       nimmt jede Produktdatei, in der etwas WIE eine Registrierung aussieht. Keine Liste, kein
//       Verzeichnisname, kein Dateinamensmuster.
//   (2) DIE REGISTRIERUNGEN ENTSTEHEN AUS DEM SYNTAXBAUM. Pfad aus dem ERSTEN ARGUMENT: ein Literal
//       oder eine Konstante derselben Datei. Was an `app.<methode>(…)` hängt und nicht aufzulösen
//       ist (importierte Konstante, zusammengesetzter Pfad, Nicht-`/`-Pfad), ist ROT mit Datei und
//       Zeile — nicht still übersprungen.
//   (3) EIN UNABHÄNGIGER TEXTLAUF über den kommentargeschwärzten Quelltext. Jede Stelle, die er als
//       Registrierung sieht und der Syntaxbaum NICHT beurteilt hat, ist ROT mit Datei und Zeile.
//       `app.route({…})` liest die Erhebung nicht und meldet es deshalb ebenfalls rot.
//
// BENANNTE GRENZEN (verschwiegen wird eine Grenze zur Falle):
//   · Gelesen wird `services/**/*.ts` (ohne Tests, `.d.ts`, `node_modules`, `dist`). Ein Server
//     ausserhalb von `services/` oder in `.js` geschriebene Routen sähe die Erhebung nicht.
//   · NACHARBEIT 2 (Befund ben): `scope.get(PFAD, …)` ist jetzt erfasst — als Registrierung, wenn
//     `PFAD` eine `"/…"`-Konstante der Datei ist (gleich welcher Empfänger), und als ROT, wenn
//     `scope` eine erhobene Serverinstanz ist und der Pfad sich nicht auflösen lässt
//     (`serverInstanzen`). Weiterhin NICHT erkennbar: ein Empfänger, der weder als Instanz
//     erhebbar ist (ungetypt, nicht über `register`/Plugin-Typ gebunden) noch einen auflösbaren
//     `"/…"`-Pfad trägt — er wäre von `map.get(SCHLUESSEL)` nicht zu unterscheiden.
//   · Auslieferungen OHNE `<empfänger>.<methode>(…)` — `app.register(fastifyStatic, …)` und
//     `setNotFoundHandler` in `web-static.ts` (die gebaute Oberfläche, keine Wissensobjekte) — sind
//     keine Registrierungen im Sinne dieser Erhebung.
//   · Ein Text, der in einer ZEICHENKETTE wie eine Registrierung aussieht, meldet der Textlauf rot
//     (fail-closed). Am Stand 41ba0b7f gibt es keinen solchen Fall.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { REPO_WURZEL } from "../support/repoPfad";

/** Die HTTP-Methoden, die Fastify kennt — bewusst alle, nicht nur `get`. */
export const METHODEN = new Set([
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "all",
  "head",
  "options",
]);

export interface Registrierung {
  /** Großgeschrieben, wie im Matrixschlüssel. */
  methode: string;
  pfad: string;
  datei: string;
  zeile: number;
  /** Der Quelltext des Registrierungsaufrufs — Grundlage der Schutzart. */
  aufruf: string;
}

export interface Dateierhebung {
  registrierungen: Registrierung[];
  /** Je Eintrag `datei:zeile — Grund`: eine Stelle, die die Erhebung NICHT lesen konnte. */
  unlesbar: string[];
}

export interface Schnittstellenerhebung extends Dateierhebung {
  dateien: string[];
}

// Der unabhängige Textlauf. `TEXT_MIT_PFAD` trifft jede Registrierung mit Literalpfad an jedem
// Empfänger, `TEXT_AN_APP` jede Registrierung an `app` gleich welchen Pfades, `TEXT_ROUTE` die
// Bauform, die die Erhebung nicht liest.
const TEXT_MIT_PFAD =
  /\.(get|post|put|delete|patch|all|head|options)\s*(<[\s\S]{0,400}?>)?\s*\(\s*["'`]\//g;
const TEXT_AN_APP = /\bapp\.(get|post|put|delete|patch|all|head|options)\s*[<(]/g;
const TEXT_ROUTE = /\.route\s*\(/g;

// Nacharbeit 2 (Befund ben, R-1165/R-1175): `const PFAD = "/api/neu"; scope.get(PFAD, handler);`
// traf keines der drei Muster oben — die Datei kam gar nicht erst in den Syntaxlauf. Deshalb nimmt
// die Dateierhebung zusätzlich jede Datei, die (a) Fastify kennt (Import, Instanz- oder
// Plugin-Typ, `Fastify(…)`), oder (b) eine `"/…"`-Konstante führt UND eine Methode mit einem
// Bezeichner als erstem Argument aufruft. Grob mit Absicht: zu viel kostet nur Zeit.
const TEXT_KENNT_FASTIFY =
  /from\s+["'](fastify|fastify-plugin)["']|\bFastify(Instance|PluginAsync|PluginCallback)\b|\bFastify\s*\(/;
const TEXT_PFADKONSTANTE = /\bconst\s+[A-Za-z_$][\w$]*\s*=\s*["'`]\//;
const TEXT_BEZEICHNER_ALS_PFAD =
  /\.(get|post|put|delete|patch|all|head|options)\s*(<[\s\S]{0,400}?>)?\s*\(\s*[A-Za-z_$]/;

/** Sieht dieser Quelltext nach einer Routendatei aus? Grob mit Absicht: zu viel kostet nur Zeit. */
export function siehtAusWieRoutenquelle(text: string): boolean {
  return (
    [TEXT_MIT_PFAD, TEXT_AN_APP, TEXT_ROUTE].some((muster) =>
      new RegExp(muster.source).test(text),
    ) ||
    TEXT_KENNT_FASTIFY.test(text) ||
    (TEXT_PFADKONSTANTE.test(text) && TEXT_BEZEICHNER_ALS_PFAD.test(text))
  );
}

/** Der erste Parameter einer Funktion, wenn er ein schlichter Bezeichner ist. */
function ersterParameter(f: ts.SignatureDeclarationBase): string | undefined {
  const p = f.parameters[0];
  return p && ts.isIdentifier(p.name) ? p.name.text : undefined;
}

function istFunktionsliteral(n: ts.Node): n is ts.ArrowFunction | ts.FunctionExpression {
  return ts.isArrowFunction(n) || ts.isFunctionExpression(n);
}

/**
 * Nacharbeit 2: die SERVERINSTANZEN dieser Datei — unabhängig von ihrem Namen. Eine Instanz ist
 *   · ein Parameter mit dem Typ `FastifyInstance`,
 *   · der erste Parameter eines Plugins: einer Funktion, die an `.register(…)` geht, mit
 *     `fp(…)`/`fastifyPlugin(…)` umhüllt ist, als `FastifyPlugin…` getypt/zugesichert ist oder aus
 *     einer Funktion mit Rückgabetyp `FastifyPlugin…` zurückgegeben wird,
 *   · eine Variable, die `Fastify(…)`/`fastify(…)` zugewiesen bekommt,
 *   · und weiterhin `app`.
 * Jede `<instanz>.<methode>(…)` ist eine Registrierung; ihr Pfad muss sich auflösen lassen.
 * BENANNTE GRENZE: die Zuordnung geht über den NAMEN innerhalb der Datei, nicht über den Typprüfer.
 */
export function serverInstanzen(sf: ts.SourceFile): Set<string> {
  const instanzen = new Set<string>(["app"]);
  const istPluginTyp = (typ: ts.TypeNode | undefined): boolean =>
    typ !== undefined && /\bFastifyPlugin(Async|Callback)?\b/.test(typ.getText(sf));
  const merke = (f: ts.Node): void => {
    if (istFunktionsliteral(f)) {
      const name = ersterParameter(f);
      if (name) {
        instanzen.add(name);
      }
    }
  };
  const besuche = (n: ts.Node): void => {
    if (ts.isParameter(n) && ts.isIdentifier(n.name) && n.type) {
      if (/\bFastifyInstance\b/.test(n.type.getText(sf))) {
        instanzen.add(n.name.text);
      }
    }
    if (ts.isCallExpression(n)) {
      const aufgerufen = n.expression;
      const name = ts.isIdentifier(aufgerufen)
        ? aufgerufen.text
        : ts.isPropertyAccessExpression(aufgerufen)
          ? aufgerufen.name.text
          : "";
      if (name === "register" || name === "fp" || name === "fastifyPlugin") {
        for (const arg of n.arguments) {
          merke(arg);
        }
      }
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const init = n.initializer;
      if (
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        /^(Fastify|fastify)$/.test(init.expression.text)
      ) {
        instanzen.add(n.name.text);
      }
      if (istPluginTyp(n.type)) {
        merke(ohneHuelle(init));
      }
    }
    if ((ts.isAsExpression(n) || ts.isSatisfiesExpression(n)) && istPluginTyp(n.type)) {
      merke(ohneHuelle(n.expression));
    }
    if (ts.isReturnStatement(n) && n.expression) {
      let f: ts.Node | undefined = n.parent;
      while (f && !ts.isFunctionLike(f)) {
        f = f.parent;
      }
      if (f && ts.isFunctionLike(f) && istPluginTyp(f.type)) {
        merke(ohneHuelle(n.expression));
      }
    }
    if (istFunktionsliteral(n) && !ts.isBlock(n.body) && n.parent) {
      // `(): FastifyPluginAsync => async (scope) => {…}` — Rückgabe ohne `return`.
      if (istPluginTyp(n.type)) {
        merke(ohneHuelle(n.body));
      }
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  return instanzen;
}

function istProduktquelle(name: string): boolean {
  return name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.endsWith(".d.ts");
}

/**
 * (1) Jede Produktdatei unter `wurzel`, die WIE eine Routendatei aussieht — rekursiv, ohne Liste.
 * Rückgabe relativ zu `basis`, sortiert (`services/app/src/routes/ko-routes.ts`).
 */
export function routenquellen(
  wurzel: string = join(REPO_WURZEL, "services"),
  basis: string = REPO_WURZEL,
): string[] {
  const gefunden: string[] = [];
  const steige = (verzeichnis: string): void => {
    for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
      if (eintrag.name === "node_modules" || eintrag.name === "dist") {
        continue;
      }
      const pfad = join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) {
        steige(pfad);
      } else if (
        istProduktquelle(eintrag.name) &&
        siehtAusWieRoutenquelle(readFileSync(pfad, "utf8"))
      ) {
        gefunden.push(relative(basis, pfad));
      }
    }
  };
  steige(wurzel);
  return gefunden.sort();
}

/**
 * `ts.createSourceFile` WIRFT bei kaputter Syntax nicht, die Fehler stehen in `parseDiagnostics`
 * (dieselbe Begründung wie mega74-lesewege-sammler.test.ts, AUFTRAG-mega76 Block C, Grenze 2).
 */
export function parseFehler(sf: ts.SourceFile): readonly ts.Diagnostic[] {
  return (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
}

/** `as const`, `satisfies` und Klammern um ein Literal herum ablegen. */
function ohneHuelle(n: ts.Expression): ts.Expression {
  let aktuell = n;
  while (
    ts.isAsExpression(aktuell) ||
    ts.isSatisfiesExpression(aktuell) ||
    ts.isParenthesizedExpression(aktuell)
  ) {
    aktuell = aktuell.expression;
  }
  return aktuell;
}

/** Jede `const NAME = "…"` der Datei, gleich auf welcher Tiefe. */
export function zeichenkettenKonstanten(sf: ts.SourceFile): Map<string, string> {
  const konstanten = new Map<string, string>();
  const besuche = (n: ts.Node): void => {
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      ts.isVariableDeclarationList(n.parent) &&
      (n.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const wert = ohneHuelle(n.initializer);
      if (ts.isStringLiteral(wert) || ts.isNoSubstitutionTemplateLiteral(wert)) {
        konstanten.set(n.name.text, wert.text);
      }
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  return konstanten;
}

/** Der Pfad im ersten Argument: Literal oder Konstante derselben Datei, sonst `undefined`. */
export function pfadVon(
  arg0: ts.Expression | undefined,
  konstanten: ReadonlyMap<string, string>,
): string | undefined {
  if (!arg0) {
    return undefined;
  }
  if (ts.isStringLiteral(arg0) || ts.isNoSubstitutionTemplateLiteral(arg0)) {
    return arg0.text;
  }
  if (ts.isIdentifier(arg0)) {
    return konstanten.get(arg0.text);
  }
  return undefined;
}

/**
 * Der Quelltext mit LÄNGENTREU geschwärzten Kommentaren: jede Position bleibt, wo sie war, also
 * stimmen Zeilennummern und der Abgleich mit dem Syntaxbaum. Die Kommentarbereiche kommen aus dem
 * Compiler selbst — ein `"/addin/*"` in einer Zeichenkette ist für ihn kein Kommentaranfang.
 */
export function kommentareGeschwaerzt(sf: ts.SourceFile): string {
  const text = sf.text;
  const zeichen = text.split("");
  const schwaerze = (bereich: ts.CommentRange): void => {
    for (let i = bereich.pos; i < bereich.end; i++) {
      if (zeichen[i] !== "\n" && zeichen[i] !== "\r") {
        zeichen[i] = " ";
      }
    }
  };
  const gesehen = new Set<number>();
  const besuche = (n: ts.Node): void => {
    if (ts.isJSDoc(n)) {
      return;
    }
    if (!gesehen.has(n.pos)) {
      gesehen.add(n.pos);
      for (const bereich of ts.getLeadingCommentRanges(text, n.pos) ?? []) {
        schwaerze(bereich);
      }
      for (const bereich of ts.getTrailingCommentRanges(text, n.pos) ?? []) {
        schwaerze(bereich);
      }
    }
    for (const kind of n.getChildren(sf)) {
      besuche(kind);
    }
  };
  besuche(sf);
  return zeichen.join("");
}

/**
 * (3) Der Textlauf gegen den Syntaxbaum: jede Stelle, die WIE eine Registrierung aussieht und deren
 * Methodenname NICHT unter `gelesen` steht, ist eine Bauform, die die Erhebung nicht liest.
 * `gelesen` sind die Positionen der Methodennamen, die der Syntaxbaum beurteilt hat.
 */
export function textlaufLuecken(
  sf: ts.SourceFile,
  datei: string,
  gelesen: ReadonlySet<number>,
  instanzen: ReadonlySet<string> = serverInstanzen(sf),
): string[] {
  const geschwaerzt = kommentareGeschwaerzt(sf);
  const zeile = (pos: number): number => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const luecken: string[] = [];
  const muster: Array<readonly [RegExp, number]> = [
    [TEXT_MIT_PFAD, ".".length],
    [TEXT_AN_APP, "app.".length],
  ];
  // Nacharbeit 2: dasselbe Netz unter jeder weiteren Serverinstanz, gleich wie sie heisst.
  for (const name of instanzen) {
    if (name !== "app") {
      const sicher = name.replace(/\$/g, "\\$");
      muster.push([
        new RegExp(`(?<![\\w$.])${sicher}\\.(${[...METHODEN].join("|")})\\s*[<(]`, "g"),
        name.length + 1,
      ]);
    }
  }
  for (const [regel, versatz] of muster) {
    for (const treffer of geschwaerzt.matchAll(regel)) {
      const pos = (treffer.index ?? 0) + versatz;
      if (!gelesen.has(pos)) {
        luecken.push(
          `${datei}:${zeile(pos)} — der Textlauf sieht hier eine Registrierung, die der Syntaxbaum nicht liest (unbekannte Bauform).`,
        );
      }
    }
  }
  for (const treffer of geschwaerzt.matchAll(TEXT_ROUTE)) {
    luecken.push(
      `${datei}:${zeile(treffer.index ?? 0)} — \`.route({…})\` gefunden. Diese Bauform erhebt die Erhebung nicht; die Route wäre unsichtbar. Auf <app>.<methode>("/…") umstellen oder die Erhebung erweitern.`,
    );
  }
  return luecken;
}

/** (2) Alle Registrierungen EINER Datei, samt der Stellen, die sie nicht lesen konnte. */
export function erhebeRegistrierungen(datei: string, text: string): Dateierhebung {
  const registrierungen: Registrierung[] = [];
  const unlesbar: string[] = [];
  const sf = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true);
  const zeile = (pos: number): number => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const fehler = parseFehler(sf);
  if (fehler.length > 0) {
    unlesbar.push(
      `${datei}:${zeile(fehler[0]?.start ?? 0)} — ${fehler.length} Syntaxfehler beim Parsen. Die Erhebung dieser Datei wäre unvollständig.`,
    );
    return { registrierungen, unlesbar };
  }
  const konstanten = zeichenkettenKonstanten(sf);
  const instanzen = serverInstanzen(sf);
  const gelesen = new Set<number>();
  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const name = n.expression.name;
      if (METHODEN.has(name.text)) {
        gelesen.add(name.getStart(sf));
        const pfad = pfadVon(n.arguments[0], konstanten);
        const empfaenger = n.expression.expression;
        // Nacharbeit 2: nicht mehr nur `app`, sondern jede erhobene Serverinstanz.
        const anApp = ts.isIdentifier(empfaenger) && instanzen.has(empfaenger.text);
        if (pfad?.startsWith("/")) {
          registrierungen.push({
            methode: name.text.toUpperCase(),
            pfad,
            datei,
            zeile: zeile(n.getStart(sf)),
            aufruf: n.getText(sf),
          });
        } else if (anApp) {
          unlesbar.push(
            `${datei}:${zeile(n.getStart(sf))} — ${empfaenger.getText(sf)}.${name.text}(…) an einer Serverinstanz mit einem Pfad, den die Erhebung nicht auflösen kann (weder Literal noch Konstante dieser Datei, oder kein "/"-Pfad).`,
          );
        }
      }
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  unlesbar.push(...textlaufLuecken(sf, datei, gelesen, instanzen));
  return { registrierungen, unlesbar };
}

/** (1)+(2)+(3) über den ganzen Server. */
export function erhebeSchnittstellen(): Schnittstellenerhebung {
  const dateien = routenquellen();
  const registrierungen: Registrierung[] = [];
  const unlesbar: string[] = [];
  for (const datei of dateien) {
    const teil = erhebeRegistrierungen(datei, readFileSync(join(REPO_WURZEL, datei), "utf8"));
    registrierungen.push(...teil.registrierungen);
    unlesbar.push(...teil.unlesbar);
  }
  return { dateien, registrierungen, unlesbar };
}
