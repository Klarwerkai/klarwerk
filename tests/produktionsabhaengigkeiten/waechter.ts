// ================================================================================================
// JOB 4272 · DIE PRÜFENDEN FUNKTIONEN — EINMAL GESCHRIEBEN, ZWEIMAL GEFAHREN.
// ================================================================================================
//
// WARUM DIESE DATEI IN RUNDE 3 ENTSTANDEN IST. BEN hat in Runde 2 den Static-Wächter widerlegt:
// er zählte DATEIEN MIT IMPORT statt REGISTRIERUNGEN. Eine zweite, rechtegeschützte
// `@fastify/static`-Registrierung IN DERSELBEN DATEI blieb damit unsichtbar — der Wächter blieb
// grün, während genau die Bedingung eingetreten war, unter der „nicht exponiert" nicht mehr gilt.
// BENs Wortlaut: „ein unveränderter Import darf die Mutation nicht verdecken."
//
// DIE LEHRE DARAUS IST ALLGEMEINER ALS DER EINE FEHLER: Eine Zusicherung, die nur am gesunden Fall
// gefahren wurde, ist unbelegt. Jede Behauptung dieses Ordners hängt deshalb ab hier an einer
// Funktion, die MESSBAR unterscheidet — und jede dieser Funktionen wird zweimal gefahren:
//   einmal am echten Stand (sie muss schweigen) und einmal an einer VERSTELLTEN, isolierten Kopie
//   (sie muss reden). Das Zweite steht in `kalibrierung.test.ts`, Auftrag §7.
//
// FORM DER FUNKTIONEN: Jede gibt einen BEFUND zurück — leere Liste bzw. `null` heisst „nichts
// gefunden". Keine wirft, keine ruft `expect`. Nur so lässt sich dieselbe Funktion einmal gegen
// „muss schweigen" und einmal gegen „muss reden" fahren, ohne sie zu kopieren. Eine kopierte
// Prüfung kalibriert sich selbst und beweist nichts.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 4: WAS BEN AN RUNDE 3 WIDERLEGT HAT — UND WO DIE REPARATUR SITZT
// ------------------------------------------------------------------------------------------------
// BEN hat in Runde 3 (Cloud-Lauf `8bbfa0116713d2ca336cc6cf`) eine Rechteprüfung VOR den echten
// `registerWebStatic`-Aufruf gehängt: der Dateizugriff war nachweislich geschützt (ohne Kopf 401,
// mit Kopf 200) — und `schutzBefunde` gab `[]` zurück. Zwei Gründe, beide hier behoben:
//   (1) Die Hook-Beobachtung unten ersetzte `addHook` und sah damit nur, was NACH ihrem Beginn
//       registriert wurde. Ein Hook, der vorher schon auf der Instanz lag, war unsichtbar. Deshalb
//       liest `hookProfil` jetzt das REGISTER der Instanz selbst — den Endstand, unabhängig davon,
//       wer wann registriert hat.
//   (2) Gemessen wurde nur `registerWebStatic`, nicht die ganze Auslieferungskette. Die Kette steht
//       in `server.ts::configureWebDelivery` und ist von dort nicht aufrufbar (die Datei startet
//       beim Import einen Server). `auslieferungsKette` liest sie deshalb AM SYNTAXBAUM, Aufruf für
//       Aufruf; `ketteBefunde` misst den nachgestellten Lauf derselben Kette und fragt zusätzlich
//       jeden ausgelieferten Baum OHNE BERECHTIGUNG ab. Eine Rechteprüfung über statischen Dateien
//       fällt damit an drei Stellen auf: an der Kette, am Hookprofil und am Zugriff.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { Server as HttpServer } from "node:http";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import ts from "typescript";

// ================================================================================================
// QUELLEN EINSAMMELN
// ================================================================================================

/** Eine eingelesene Quelldatei: Pfad relativ zur übergebenen Wurzel, und ihr Text. */
export interface Quelldatei {
  readonly pfad: string;
  readonly text: string;
}

/**
 * Jede `.ts`-Datei unter `wurzel` (ohne Tests, ohne `node_modules`/`dist`), eingelesen.
 *
 * Die Wurzel ist ein PARAMETER und keine Konstante — das ist der ganze Trick, mit dem dieselbe
 * Prüfung gegen eine verstellte isolierte Kopie gefahren werden kann.
 */
export function quellen(wurzel: string, unter = "", raus: Quelldatei[] = []): Quelldatei[] {
  const ordner = unter ? join(wurzel, unter) : wurzel;
  for (const eintrag of readdirSync(ordner)) {
    if (eintrag === "node_modules" || eintrag === "dist") {
      continue;
    }
    const rel = unter ? `${unter}/${eintrag}` : eintrag;
    if (statSync(join(wurzel, rel)).isDirectory()) {
      quellen(wurzel, rel, raus);
    } else if (rel.endsWith(".ts") && !rel.endsWith(".test.ts")) {
      raus.push({ pfad: rel, text: readFileSync(join(wurzel, rel), "utf8") });
    }
  }
  return raus;
}

// ================================================================================================
// (1) @fastify/static — REGISTRIERUNGEN, NICHT IMPORTE
// ================================================================================================

/** Eine gefundene Registrierung: wo sie steht, und unter welchem Bezeichner. */
export interface Registrierung {
  readonly pfad: string;
  readonly zeile: number;
  readonly bezeichner: string;
}

/**
 * Der Name, unter dem eine Datei `@fastify/static` hereinholt — `import x from "@fastify/static"`
 * oder `import * as x from …` oder `require("@fastify/static")`. Ohne Treffer: `null`.
 */
function statischerBezeichner(text: string): string | null {
  const treffer =
    /import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s*(?:,[^;]*)?\s+from\s+["']@fastify\/static["']/.exec(
      text,
    ) ??
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(["']@fastify\/static["']\)/.exec(text);
  return treffer?.[1] ?? null;
}

/**
 * ALLE `@fastify/static`-REGISTRIERUNGEN im übergebenen Quellbaum — je Aufrufstelle eine Zeile.
 *
 * DAS IST DIE KORREKTUR AUS BENs BEFUND. Gezählt wird `<irgendwas>.register(<bezeichner>` —
 * also die AUFRUFSTELLE. Zwei Registrierungen in derselben Datei ergeben zwei Einträge; der
 * Import bleibt dabei einer und verdeckt nichts mehr.
 */
export function statischeRegistrierungen(dateien: readonly Quelldatei[]): Registrierung[] {
  const raus: Registrierung[] = [];
  for (const datei of dateien) {
    const bezeichner = statischerBezeichner(datei.text);
    if (!bezeichner) {
      continue;
    }
    const muster = new RegExp(`\\.register\\(\\s*${bezeichner}\\b`, "g");
    for (const treffer of datei.text.matchAll(muster)) {
      raus.push({
        pfad: datei.pfad,
        zeile: datei.text.slice(0, treffer.index).split("\n").length,
        bezeichner,
      });
    }
  }
  return raus;
}

// ================================================================================================
// (2) @fastify/static — WAS BEIM REGISTRIEREN WIRKLICH PASSIERT
// ================================================================================================
//
// Die Quelltextzählung oben findet die AUFRUFSTELLE. Sie findet nicht, was die Aufrufstelle TUT:
// welcher Baum ausgeliefert wird, ob eine Rechteprüfung davorhängt, ob unter einem Präfix ein
// zweiter Baum liegt. Dafür wird die echte Registrierfunktion an einer Fastify-Instanz gefahren,
// deren `register`, `addHook` und Routentabelle mitgeschrieben werden.
//
// Das ist der zweite Riegel gegen BENs Mutation: sie fällt hier ein zweites Mal auf, und zwar
// unabhängig von jeder Schreibweise im Quelltext.

/** Was beim Registrieren beobachtet wurde. */
export interface Beobachtung {
  /** Je `app.register(...)`-Aufruf ein Eintrag: die mitgegebenen Optionen, soweit erkennbar. */
  readonly registrierungen: {
    /** Woran man das Plugin wiedererkennt: sein fastify-plugin-Name, sonst sein Funktionsname. */
    readonly plugin: string;
    readonly wurzel: unknown;
    readonly praefix: unknown;
    /** Wachnamen, die als OPTION mitgegeben wurden (`preHandler` & Co. an `@fastify/static`). */
    readonly wachen: string[];
  }[];
  /** Die Namen der app-weiten Hooks, die die Registrierfunktion selbst hinzugefügt hat. */
  readonly hooks: string[];
  /** Je angelegter Route: Adresse und die daran hängenden Wachen. */
  readonly routen: { readonly url: string; readonly wachen: string[] }[];
  /**
   * Das Hookregister der Instanz, BEVOR irgendetwas beobachtet wurde.
   *
   * DAS IST BENs LÜCKE AUS RUNDE 3: Wer einen Hook registriert, bevor die Beobachtung beginnt, war
   * über `addHook` nicht mehr zu sehen. Dieses Feld liest den Zustand der Instanz und nicht den
   * Aufrufstrom — es ist daher unabhängig von der Reihenfolge.
   */
  readonly hookProfilVorher: Record<string, number>;
  /** Dasselbe Register am ENDE, ohne den eigenen `onRoute`-Beobachter. */
  readonly hookProfilNachher: Record<string, number>;
}

/**
 * Das Hookregister einer Fastify-Instanz, gelesen AN DER INSTANZ: `{ onRequest: 3, onSend: 3 }`.
 *
 * Fastify legt es unter einem Symbol mit der Beschreibung `fastify.hooks` ab (`lib/symbols.js`).
 * Das Symbol ist nicht global registriert (`Symbol(...)`, nicht `Symbol.for(...)`), wird also über
 * seine Beschreibung gefunden. Fehlt es, heisst das NICHT „keine Hooks": dann ist die MESSUNG
 * ausgefallen, und genau das steht dann als Eintrag da — eine ausgefallene Messung darf nie wie
 * eine bestandene aussehen.
 */
export function hookProfil(app: unknown): Record<string, number> {
  if (typeof app !== "object" || app === null) {
    return { HOOKREGISTER_UNLESBAR: 1 };
  }
  const schluessel = Object.getOwnPropertySymbols(app).find(
    (s) => s.description === "fastify.hooks",
  );
  if (!schluessel) {
    return { HOOKREGISTER_UNLESBAR: 1 };
  }
  const register = (app as Record<symbol, unknown>)[schluessel];
  if (typeof register !== "object" || register === null) {
    return { HOOKREGISTER_UNLESBAR: 1 };
  }
  const raus: Record<string, number> = {};
  for (const [name, wert] of Object.entries(register)) {
    if (Array.isArray(wert) && wert.length > 0) {
      raus[name] = wert.length;
    }
  }
  return raus;
}

/** Ein Hookprofil als eine lesbare, von der Schlüsselreihenfolge unabhängige Zeile. */
export function profilText(profil: Readonly<Record<string, number>>): string {
  const teile = Object.entries(profil)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, zahl]) => `${name}=${zahl}`);
  return teile.length > 0 ? teile.join(", ") : "leer";
}

/** Woran man ein Fastify-Plugin wiedererkennt. `fastify-plugin` hinterlegt seinen Namen im Meta. */
function pluginMarke(plugin: unknown): string {
  if (typeof plugin !== "function") {
    return "kein-plugin";
  }
  const traeger = plugin as unknown as Record<symbol, unknown> & { name?: string };
  const meta = traeger[Symbol.for("plugin-meta")] as { name?: string } | undefined;
  const anzeige = traeger[Symbol.for("fastify.display-name")];
  if (typeof meta?.name === "string" && meta.name !== "") {
    return meta.name;
  }
  if (typeof anzeige === "string" && anzeige !== "") {
    return anzeige;
  }
  return plugin.name !== "" ? plugin.name : "anonym";
}

/** Die Wachen, an denen eine Autorisierung hängen würde. */
const WACHNAMEN = ["onRequest", "preParsing", "preValidation", "preHandler"] as const;

/**
 * Fährt `registrieren(app, dist)` an einer frischen Instanz und schreibt mit, was dabei geschieht.
 *
 * `registrieren` ist ein PARAMETER: am echten Stand kommt `registerWebStatic` herein, in der
 * Kalibrierung die verstellte Fassung mit der zweiten geschützten Registrierung.
 */
export async function beobachteAuslieferung(
  app: FastifyInstance,
  registrieren: (app: FastifyInstance, dist: string) => Promise<void>,
  dist: string,
): Promise<Beobachtung> {
  const registrierungen: {
    plugin: string;
    wurzel: unknown;
    praefix: unknown;
    wachen: string[];
  }[] = [];
  const hooks: string[] = [];
  const routen: { url: string; wachen: string[] }[] = [];

  // VOR JEDEM EIGENEN EINGRIFF: was liegt schon auf der Instanz? Das ist die Reparatur zu BENs
  // Runde-3-Befund — sein Hook lag hier, und keine Ersetzung von `addHook` hätte ihn je gesehen.
  const hookProfilVorher = hookProfil(app);

  // ZUERST der eigene onRoute-Hook — danach erst wird `addHook` beobachtet, damit dieser Hook
  // nicht sich selbst mitzählt.
  app.addHook("onRoute", (route) => {
    const wachen: string[] = [];
    for (const name of WACHNAMEN) {
      const wert = (route as unknown as Record<string, unknown>)[name];
      if (Array.isArray(wert) ? wert.length > 0 : typeof wert === "function") {
        wachen.push(name);
      }
    }
    routen.push({ url: route.url, wachen });
  });

  // BEWUSST NICHT `.bind(app)`: Fastify legt jede Kapsel (`app.register(async (scope) => …)`) als
  // Objekt MIT `app` IM PROTOTYP an — die Ersetzung unten erbt also in jede Kapsel hinein. Wäre das
  // Original an `app` gebunden, liefe eine Registrierung IN der Kapsel in Wahrheit an der Wurzel,
  // und die Kapselung (samt ihrer Wache) wäre aufgehoben, ohne dass es jemand sähe. Der beobachtete
  // Aufruf muss sein eigenes `this` behalten; gemessen wird trotzdem, weil die Ersetzung geerbt wird.
  const echtesRegister = app.register;
  const echtesAddHook = app.addHook;
  const beobachtet = app as unknown as Record<string, unknown>;
  /** Vor dem Eingriff festgehalten: war die Methode eine eigene Eigenschaft oder geerbt? */
  const warEigen = {
    register: Object.hasOwn(app, "register"),
    addHook: Object.hasOwn(app, "addHook"),
  };
  beobachtet.register = function (
    this: unknown,
    plugin: unknown,
    optionen?: Record<string, unknown>,
  ) {
    registrierungen.push({
      plugin: pluginMarke(plugin),
      wurzel: optionen?.root,
      praefix: optionen?.prefix,
      // Eine Wache, die als OPTION mitkommt, erreicht die Routentabelle nicht immer in einer Form,
      // die `onRoute` zeigt — gemessen im Cloud-Lauf fd7b06f9283bbfa327d27290, wo `preHandler` an
      // `@fastify/static` genau so durchrutschte. Sie wird deshalb HIER gelesen, an der Stelle, an
      // der sie geschrieben wurde.
      wachen: WACHNAMEN.filter((name) => optionen?.[name] !== undefined),
    });
    return (echtesRegister as (this: unknown, p: unknown, o?: unknown) => unknown).call(
      this,
      plugin,
      optionen,
    );
  };
  beobachtet.addHook = function (this: unknown, name: string, ...rest: unknown[]) {
    hooks.push(name);
    return (echtesAddHook as (this: unknown, n: string, ...r: unknown[]) => unknown).call(
      this,
      name,
      ...rest,
    );
  };

  let hookProfilNachher: Record<string, number> = { HOOKREGISTER_UNLESBAR: 1 };
  try {
    await registrieren(app, dist);
    await app.ready();
    // Der Endstand am Register, MINUS des eigenen onRoute-Beobachters: gezählt werden soll der
    // Aufbau, nicht die Messung.
    const gemessen = hookProfil(app);
    hookProfilNachher = Object.fromEntries(
      Object.entries(gemessen)
        .map(([name, zahl]): [string, number] => [name, name === "onRoute" ? zahl - 1 : zahl])
        .filter(([, zahl]) => zahl > 0),
    );
  } finally {
    // Zurück auf den Ausgangszustand: waren `register`/`addHook` vorher geerbt und keine eigene
    // Eigenschaft, wird die Ersetzung ENTFERNT statt überschrieben — sonst bliebe eine eigene
    // Eigenschaft zurück, wo vorher der Prototyp galt.
    for (const [name, original] of [
      ["register", echtesRegister],
      ["addHook", echtesAddHook],
    ] as const) {
      if (warEigen[name]) {
        beobachtet[name] = original;
      } else {
        delete beobachtet[name];
      }
    }
  }
  return { registrierungen, hooks, routen, hookProfilVorher, hookProfilNachher };
}

/**
 * DER BEFUND ZUR ADVISORYBEDINGUNG: Gibt es Anzeichen für einen GESCHÜTZTEN statischen Pfad?
 *
 * GHSA-83w8-p2f5-377r und GHSA-8pvw-jcv7-9cmj beschreiben beide dasselbe: eine nicht-kanonische
 * Pfadform führt an einer RECHTEPRÜFUNG ÜBER STATISCHEN DATEIEN vorbei. Ohne Rechteprüfung gibt es
 * nichts zu umgehen. Diese Funktion sammelt alles, was die Bedingung herstellen würde:
 *   · mehr als ein `register`-Aufruf (ein zweiter Baum — der Fall, den BEN gebaut hat; auch ein
 *     gekapselter Bereich `app.register(async (scope) => …)` fällt hierunter, denn auch er ist ein
 *     `register`-Aufruf an dieser Instanz),
 *   · ein Präfix (ein abgetrennter, meist geschützter Bereich),
 *   · eine Wache als OPTION der Registrierung (`preHandler` & Co. an `@fastify/static`),
 *   · eine Wache an einer Route (dieselben Namen, direkt an `app.get(…, { preHandler }, …)`),
 *   · ein app-weiter Hook ausserhalb der einen erlaubten Auslieferungszusage.
 *
 * WARUM DIE WACHE ZWEIMAL GESUCHT WIRD: `onRoute` zeigt eine Wache, die als Option an
 * `@fastify/static` mitkam, NICHT (gemessen im Cloud-Lauf `fd7b06f9283bbfa327d27290`). Ein Riegel,
 * der nur die Routentabelle liest, hätte genau BENs Mutation wieder durchgelassen. Beide Formen
 * werden deshalb an der Stelle gelesen, an der sie geschrieben werden.
 *
 * Leere Liste heisst: die Bedingung ist nicht hergestellt. Jeder Eintrag ist der Anlass, die
 * Einordnung neu zu machen — nicht, den Wächter anzupassen.
 */
export function schutzBefunde(b: Beobachtung, erlaubteHooks: readonly string[]): string[] {
  const raus: string[] = [];
  if (b.registrierungen.length !== 1) {
    raus.push(
      `${b.registrierungen.length} statt einer @fastify/static-Registrierung: ${JSON.stringify(b.registrierungen)}`,
    );
  }
  for (const eintrag of b.registrierungen) {
    if (eintrag.praefix !== undefined) {
      raus.push(`eine Registrierung liegt unter dem Präfix ${JSON.stringify(eintrag.praefix)}`);
    }
    if (eintrag.wachen.length > 0) {
      raus.push(`eine Registrierung bringt eine Wache mit: ${eintrag.wachen.join(", ")}`);
    }
  }
  for (const route of b.routen) {
    if (route.wachen.length > 0) {
      raus.push(`die Route ${route.url} trägt eine Wache: ${route.wachen.join(", ")}`);
    }
  }
  for (const hook of b.hooks) {
    if (!erlaubteHooks.includes(hook)) {
      raus.push(`ein app-weiter Hook ausserhalb der Auslieferungszusage: ${hook}`);
    }
  }
  return raus;
}

// ================================================================================================
// (2b) DIE GANZE AUSLIEFERUNGSKETTE — AM SYNTAXBAUM, WEIL SIE NICHT AUFRUFBAR IST
// ================================================================================================
//
// `server.ts::configureWebDelivery` ist die WIRKLICHE Auslieferungskette: Security-Header,
// Kanonik-Umleitung, noindex, dann `registerWebStatic`. Die Funktion ist nicht exportiert, und
// `server.ts` startet beim Import einen Server (`start()` in der letzten Zeile) — ein Test kann sie
// also nicht aufrufen. Was er kann: sie LESEN, Aufruf für Aufruf, und die Reihe festhalten.
//
// WARUM AM SYNTAXBAUM UND NICHT MIT `grep`: derselbe Grund wie in `tests/waechter-ast` (JOB 3586)
// und `tests/capture/aufrufer-waechter.test.ts` — ein Aufruf in einem Kommentar, in einer
// Zeichenkette oder in einem Regex-Literal ist kein Aufruf. Nur der Baum unterscheidet das.
//
// DIE PIN IST ABSICHTLICH VOLLSTÄNDIG und nicht auf „verdächtige" Namen gefiltert: ein Filter wäre
// genau das Loch, durch das BENs Rechteprüfung gegangen ist. Wer die Kette ändert, macht diese
// Zeile rot — das ist keine Schikane, sondern die Aufforderung, die Einordnung von
// GHSA-83w8-p2f5-377r / GHSA-8pvw-jcv7-9cmj neu zu treffen.

/**
 * Jeder Aufruf im Rumpf der benannten Funktion, in Quellreihenfolge, als stabile Marke:
 * `registerWebStatic`, `app.addHook("onRequest")`, `….send("Not Found")`.
 *
 * Verkettete Aufrufe (`reply.code(404).type(…).send(…)`) tragen `…` als Träger, damit die Marke
 * kurz und von der Zeilenumbrucheinteilung unabhängig bleibt. Ein String-Literal als erstes
 * Argument kommt mit — es ist bei `addHook`/`get` die eigentliche Aussage.
 *
 * Wird die Funktion nicht gefunden, steht das als EINTRAG da und nicht als leere Liste: eine
 * ausgefallene Messung darf nie wie ein unauffälliger Befund aussehen.
 */
export function auslieferungsKette(quelltext: string, funktion: string): string[] {
  const quelle = ts.createSourceFile(
    `${funktion}.ts`,
    quelltext,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
  );
  let rumpf: ts.Block | undefined;
  const suche = (knoten: ts.Node): void => {
    if (ts.isFunctionDeclaration(knoten) && knoten.name?.text === funktion && knoten.body) {
      rumpf = knoten.body;
    }
    ts.forEachChild(knoten, suche);
  };
  suche(quelle);
  if (!rumpf) {
    return [`FUNKTION NICHT GEFUNDEN: ${funktion}`];
  }
  const schritte: string[] = [];
  const gehe = (knoten: ts.Node): void => {
    if (ts.isCallExpression(knoten)) {
      schritte.push(aufrufMarke(knoten));
    }
    ts.forEachChild(knoten, gehe);
  };
  ts.forEachChild(rumpf, gehe);
  return schritte;
}

function aufrufMarke(aufruf: ts.CallExpression): string {
  const ziel = aufruf.expression;
  let name: string;
  if (ts.isPropertyAccessExpression(ziel)) {
    name = `${ts.isIdentifier(ziel.expression) ? ziel.expression.text : "…"}.${ziel.name.text}`;
  } else if (ts.isIdentifier(ziel)) {
    name = ziel.text;
  } else {
    name = "…";
  }
  const erstes = aufruf.arguments[0];
  if (erstes && (ts.isStringLiteral(erstes) || ts.isNoSubstitutionTemplateLiteral(erstes))) {
    return `${name}("${erstes.text}")`;
  }
  return name;
}

// ================================================================================================
// (2c) DER ZUGRIFF SELBST — OHNE BERECHTIGUNG GEFRAGT
// ================================================================================================
//
// Der stärkste Beleg für „über diesen statischen Dateien liegt keine Rechteprüfung" ist keine
// Quelltextaussage, sondern die Frage OHNE BERECHTIGUNG: kommt die Datei? BENs Gegenprobe hat den
// umgekehrten Fall gemessen (ohne Kopf 401, mit Kopf 200) — genau daran muss diese Messung
// scheitern.

export interface Zugangsprobe {
  /** Die abgefragte Adresse — je ausgeliefertem Baum eine. */
  readonly url: string;
  readonly status: number;
  readonly koerper: string;
  /** Was im Körper stehen MUSS, damit „200" nicht bloss eine Zahl ist. */
  readonly erwartet: string;
}

/**
 * Wo eine statisch ausgelieferte Datei OHNE Berechtigung nicht herausgekommen ist.
 *
 * Eine LEERE Probenliste ist ein Befund und kein Bestehen (REGELN Abschnitt 7): ohne eine einzige
 * gefahrene Anfrage ist über den Zugang nichts gesagt.
 */
export function zugangsBefunde(proben: readonly Zugangsprobe[]): string[] {
  if (proben.length === 0) {
    return ["keine einzige Zugangsprobe gefahren — darüber ist über den Zugang nichts gesagt"];
  }
  const raus: string[] = [];
  for (const probe of proben) {
    if (probe.status === 401 || probe.status === 403) {
      raus.push(
        `${probe.url} verlangt ohne Berechtigung eine Anmeldung (Status ${probe.status}) — über einer statisch ausgelieferten Datei liegt damit eine Rechteprüfung, und genau die ist die Bedingung von GHSA-83w8-p2f5-377r und GHSA-8pvw-jcv7-9cmj`,
      );
    } else if (probe.status !== 200) {
      raus.push(`${probe.url} antwortete ohne Berechtigung mit ${probe.status} statt mit 200`);
    } else if (!probe.koerper.includes(probe.erwartet)) {
      raus.push(
        `${probe.url} kam mit 200, aber ohne den erwarteten Inhalt ${JSON.stringify(probe.erwartet)}`,
      );
    }
  }
  return raus;
}

/** Was die Auslieferungskette am Ende zeigen MUSS. */
export interface Kettenzusage {
  /** Die Marken aller `register`-Aufrufe in der zugesagten Reihenfolge. */
  readonly plugins: readonly string[];
  /** Das Hookregister des FERTIGEN Aufbaus. */
  readonly hooks: Readonly<Record<string, number>>;
}

/**
 * DER BEFUND ÜBER DEN VOLLSTÄNDIGEN AUFBAU — die Antwort auf BENs Korrekturpflicht 1.
 *
 * Er liest vier Tatsachen, und jede davon fängt eine Form, die die anderen nicht fangen:
 *   · die REIHE der `register`-Aufrufe (eine zweite `@fastify/static`-Registrierung, ein
 *     gekapselter Bereich, ein neues Plugin),
 *   · Präfix und Wache je Registrierung sowie Wachen an Routen (wie `schutzBefunde`),
 *   · das HOOKREGISTER des fertigen Aufbaus — hier fällt auch ein Hook auf, der VOR der Beobachtung
 *     registriert wurde; das war BENs Lücke,
 *   · den ZUGRIFF ohne Berechtigung auf jeden ausgelieferten Baum.
 *
 * Leere Liste heisst: der Aufbau stellt die Advisorybedingung nicht her.
 */
export function ketteBefunde(
  b: Beobachtung,
  zusage: Kettenzusage,
  proben: readonly Zugangsprobe[],
): string[] {
  const raus: string[] = [];
  if (Object.keys(b.hookProfilVorher).length > 0) {
    raus.push(
      `die Instanz trug VOR dem Aufbau schon Hooks: ${profilText(b.hookProfilVorher)} — der Aufbau ist damit nicht der gemessene`,
    );
  }
  const gefunden = b.registrierungen.map((r) => r.plugin);
  if (gefunden.join(" · ") !== zusage.plugins.join(" · ")) {
    raus.push(
      `die Reihe der register-Aufrufe hat sich geändert: [${gefunden.join(" · ")}] statt [${zusage.plugins.join(" · ")}]`,
    );
  }
  for (const eintrag of b.registrierungen) {
    if (eintrag.praefix !== undefined) {
      raus.push(`eine Registrierung liegt unter dem Präfix ${JSON.stringify(eintrag.praefix)}`);
    }
    if (eintrag.wachen.length > 0) {
      raus.push(`eine Registrierung bringt eine Wache mit: ${eintrag.wachen.join(", ")}`);
    }
  }
  for (const route of b.routen) {
    if (route.wachen.length > 0) {
      raus.push(`die Route ${route.url} trägt eine Wache: ${route.wachen.join(", ")}`);
    }
  }
  const ist = profilText(b.hookProfilNachher);
  const soll = profilText(zusage.hooks);
  if (ist !== soll) {
    raus.push(
      `das Hookregister des fertigen Aufbaus ist „${ist}" statt „${soll}" — auch ein VOR der Beobachtung registrierter Hook fällt hier auf`,
    );
  }
  raus.push(...zugangsBefunde(proben));
  return raus;
}

// ================================================================================================
// (3) HTTP/2 — die Bedingung, unter der `find-my-way` „nicht exponiert" ist
// ================================================================================================

/**
 * `null` = ein gewöhnlicher HTTP/1-Server. Sonst der Grund, warum die Einordnung entfällt.
 *
 * DIE REIHENFOLGE IST ABSICHT. `Http2Server` und `Http2SecureServer` erben von `net.Server` und
 * NICHT von `http.Server` — die `instanceof`-Prüfung allein würde sie zwar fangen, aber unter der
 * unspezifischen Meldung „kein node:http-Server mehr". Der HTTP/2-Fall ist der eine, um den es hier
 * geht; er wird deshalb zuerst und mit seinem Namen gemeldet.
 */
export function http2Befund(server: unknown): string | null {
  const name = (server as { constructor?: { name?: string } })?.constructor?.name ?? "unbekannt";
  if (/^Http2/.test(name)) {
    return `HTTP/2 ist eingeschaltet (${name}): GHSA-c96f-x56v-gq3h greift ab jetzt`;
  }
  if (!(server instanceof HttpServer) || name !== "Server") {
    return `Der Aufbau liefert keinen gewöhnlichen node:http-Server mehr, sondern ${name} — die find-my-way-Einordnung ist neu zu treffen`;
  }
  return null;
}

/**
 * Jede Quelldatei, die http2 verdrahtet. BEWUSST NICHT der ALPN-Bezeichner `"h2"`: er ist nicht
 * vom HTML-Tag `h2` unterscheidbar, und der steht im Sanitizer völlig zu Recht. Ein Wächter, der
 * bei jeder Überschriftenliste anschlägt, wird abgeschaltet — dann meldet gar nichts mehr.
 */
export function http2Treffer(dateien: readonly Quelldatei[]): string[] {
  return dateien.filter((d) => /\bhttp2\b|node:http2/i.test(d.text)).map((d) => d.pfad);
}

// ================================================================================================
// (4) DIE LOCKDATEI IST DIE EINZIGE WAHRHEIT ÜBER VERSIONEN
// ================================================================================================

export interface Lockdatei {
  readonly packages: Record<string, { readonly version?: string; readonly dev?: boolean }>;
}

/** Eine Zeile der Expositionstabelle des Berichts. */
export interface Berichtszeile {
  readonly paket: string;
  readonly ort: string;
  readonly version: string;
  readonly urteil: string;
}

/**
 * Liest die Expositionstabelle aus dem Berichtstext. Erkannt wird jede Markdown-Zeile mit genau
 * den vier Spalten `| Paket | Ort | Version | Urteil |`; Kopf- und Trennzeile fallen weg.
 */
export function berichtstabelle(text: string): Berichtszeile[] {
  const zeilen: Berichtszeile[] = [];
  for (const roh of text.split("\n")) {
    if (!roh.trimStart().startsWith("|")) {
      continue;
    }
    const spalten = roh
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((s) => s.trim().replace(/^`|`$/g, ""));
    if (spalten.length !== 4) {
      continue;
    }
    const [paket, ort, version, urteil] = spalten as [string, string, string, string];
    if (!ort.startsWith("node_modules/")) {
      continue; // Kopfzeile, Trennzeile oder eine andere Tabelle des Berichts
    }
    zeilen.push({ paket, ort, version, urteil });
  }
  return zeilen;
}

/**
 * Wo Lockdatei und Bericht auseinanderlaufen. Leere Liste heisst: sie sind einig.
 *
 * DAS IST DER TRAGENDE WÄCHTER DES ORDNERS (Auftrag, Prüfpunkt 2): ohne ihn hinge die Einordnung
 * „exponiert / nicht exponiert" an einer Zahl in einem Bericht, den niemand nachrechnet.
 */
export function versionsAbweichungen(lock: Lockdatei, tabelle: readonly Berichtszeile[]): string[] {
  const raus: string[] = [];
  for (const z of tabelle) {
    const eintrag = lock.packages[z.ort];
    if (!eintrag) {
      raus.push(`Der Bericht nennt einen Ort, den die Lockdatei nicht kennt: ${z.ort}`);
      continue;
    }
    if (eintrag.version !== z.version) {
      raus.push(
        `${z.paket}: der Bericht sagt ${z.version}, die Lockdatei sagt ${String(eintrag.version)} (${z.ort})`,
      );
    }
  }
  return raus;
}

// ================================================================================================
// (5) DIE VIER FUNKTIONEN, DIE EINE VERSIONSÄNDERUNG ÜBERLEBEN MÜSSEN
// ================================================================================================

/** (a) Bildimport: hält die Ableitung die Zielkante ein? `null` = ja. */
export function kantenBefund(breite: number, hoehe: number, grenze: number): string | null {
  const laengste = Math.max(breite, hoehe);
  return laengste <= grenze
    ? null
    : `Die Ableitung ist ${breite}×${hoehe} — die Zielkante ${grenze} greift nicht mehr`;
}

/** (b) HTTP-Validierung: wurde die fehlerhafte Anfrage wirklich abgewiesen? `null` = ja. */
export function abweisungsBefund(statusCode: number, koerper: string): string | null {
  return statusCode === 400
    ? null
    : `Eine fehlerhafte Anfrage kam mit ${statusCode} durch statt mit 400: ${koerper.slice(0, 200)}`;
}

/** (c) Statische Auslieferung: scheitert eine fehlende Asset-Datei wirklich laut? `null` = ja. */
export function assetBefund(
  antwort: { statusCode: number; headers: Record<string, unknown>; body: string },
  spaMarke: string,
): string | null {
  if (antwort.body.includes(spaMarke)) {
    return `Ein fehlendes Bündel kam still als SPA-HTML zurück (Status ${antwort.statusCode})`;
  }
  if (/text\/html/.test(String(antwort.headers["content-type"] ?? ""))) {
    return `Ein fehlendes Bündel kam als text/html zurück (Status ${antwort.statusCode})`;
  }
  if (antwort.statusCode !== 404) {
    return `Ein fehlendes Bündel antwortete mit ${antwort.statusCode} statt mit 404`;
  }
  return null;
}

/** (d) Mailadresse: kam beim Transport genau die übergebene Adresse an? `null` = ja. */
export function adressBefund(uebergeben: string, angekommen: unknown): string | null {
  return angekommen === uebergeben
    ? null
    : `Die Empfängeradresse kam verändert bei nodemailer an: übergeben ${JSON.stringify(
        uebergeben,
      )}, angekommen ${JSON.stringify(angekommen)} — eine Einladung ginge an jemand anderen`;
}
