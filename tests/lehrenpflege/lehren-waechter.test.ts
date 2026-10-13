// ================================================================================================
// AUFNAHME 20260922 · GESAMT-LEHRENPFLEGE (R-1333) — DREI GESCHRIEBENE REGELN BEKOMMEN EINEN WÄCHTER.
// ================================================================================================
//
// Das Lehrenbuch des Repositorys ist `harness/90-correction-log.md`: jede Zeile nennt Symptom,
// Regel und Status. Drei dieser Regeln standen dort, ohne dass ein Test sie hielt (Abgleich in
// `docs/qm/aufnahme-20260922-gesamt-lehrenpflege.md`):
//
//   W1  „Build-Schritt muss `npm ci` statt partiellem `npm install` nutzen" (2026-06-22).
//       Die CI hält `tests/app/ci-check-contract.test.ts`; das Produktionsabbild (`Dockerfile`)
//       hielt niemand.
//   W2  „`tsPreCompilationDeps: true` in `.dependency-cruiser.cjs`" (2026-06-22). `depcruise`
//       läuft im Tor, aber das Entfernen der Option machte nichts rot — die Modulgrenze sähe
//       `import type` dann still nicht mehr.
//   W3  „Flächen an der Modalgrenze hängen ihre An-/Abmeldung nur an `enter`, nie am
//       Kontextobjekt" (2026-09-27). Gemessen war das nur an `<Modal>`
//       (`tests/mega87-tastaturweg/modal-meldet-sich-einmal-an-mounted.test.tsx`); Seitenblatt,
//       Navigations-Drawer, Filterblatt und Navigationswächter hielten es nur aus Sorgfalt.
//
// Dazu L: das Register unten ordnet JEDEN Eintrag des Lehrenbuchs seinem Wächter zu oder nennt,
// warum es keinen gibt. Ein neuer Eintrag ohne Zuordnung ist rot — eine Lehre bleibt nicht still
// ein Satz in einer Datei.
//
// WAS DIESE DATEI NICHT BELEGT: das Laufzeitverhalten der Modalflächen (das messen ihre eigenen
// Prüfstände) und die Wirkung von `depcruise` selbst (das zeigt der Tor-Lauf `tools/check`).
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { WEB_SRC, WURZEL, posix, quelldateien } from "../../tools/modalgrenze";

const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), "utf8");

const LEHRENBUCH = "harness/90-correction-log.md";
const DIESE_DATEI = "tests/lehrenpflege/lehren-waechter.test.ts";

// ------------------------------------------------------------------------------------------------
// L · Register: jeder Eintrag des Lehrenbuchs hat einen Wächter oder einen benannten Grund.
// ------------------------------------------------------------------------------------------------

interface Lehre {
  /** Wörtliche Zeichenfolge, die genau einen Eintrag des Lehrenbuchs trifft. */
  merkmal: string;
  /** Prüfstände, die die Regel halten. Leer nur mit `ohneWaechter`. */
  waechter: readonly string[];
  /** Warum es keinen (allgemeinen) Wächter gibt — der Teil der Regel, der offen bleibt. */
  ohneWaechter?: string;
}

const REGISTER: readonly Lehre[] = [
  {
    merkmal: "(Initialer Aufbau — noch keine Korrekturen)",
    waechter: [],
    ohneWaechter: "Kopfzeile des Aufbaus, keine Regel.",
  },
  {
    merkmal: "Build-Schritt muss `npm ci`",
    waechter: ["tests/app/ci-check-contract.test.ts", DIESE_DATEI],
  },
  {
    merkmal: "DoD-Regel: Story erst",
    waechter: [],
    ohneWaechter:
      "Ablaufregel, keine Eigenschaft des Quelltexts. Heute getragen von Bens unabhängiger Prüfung der Originalkriterien (CLAUDE.md, harness/80-definition-of-done.md).",
  },
  {
    merkmal: "`tsPreCompilationDeps: true` in `.dependency-cruiser.cjs`",
    waechter: [DIESE_DATEI],
  },
  {
    merkmal: "WP-E: (1) App-globale onSend-Hooks IMMER synchron",
    waechter: [
      "services/app/src/sync-onsend-hooks.test.ts",
      "tests/app/mega71-onsend-synchron.test.ts",
      "services/app/src/b44-send-return-waechter.test.ts",
    ],
    ohneWaechter:
      "Teil (1) ist allgemein bewacht. Teil (2) „return reply“ hält der B44-Wächter nur für die Kanten seines Schutzes, nicht für jeden Handler; Teil (3) „Ursache loggen statt catch {}“ hat keinen allgemeinen Wächter.",
  },
  {
    merkmal: "Browsertests warten nach einem Breitenwechsel auf eine Lagebedingung",
    waechter: ["tests/bibliothek-quellennachweis/dateiname-bricht-um-chromium.test.ts"],
    ohneWaechter:
      "Gehalten ist der Anlassfall (`TELEFONLAGE_STEHT`). Ob eine Wartebedingung nur in der Zielanordnung gilt, ist am Quelltext allgemein nicht entscheidbar.",
  },
  {
    merkmal: "Flächen an der Modalgrenze hängen ihre An-/Abmeldung nur an `enter`",
    waechter: [
      "tests/mega87-tastaturweg/modal-meldet-sich-einmal-an-mounted.test.tsx",
      DIESE_DATEI,
    ],
  },
  {
    merkmal: "Bereitschaft der Leseansicht im PostgreSQL-Selbsttest",
    waechter: ["tests/fassungsrueckholung-echter-browser/kalibrierung.test.ts"],
  },
];

/** Einträge des Lehrenbuchs: Tabellenzeilen mit Datum und eigene Abschnitte (`## …`). */
function eintraegeIm(text: string): string[] {
  return text
    .split("\n")
    .filter((zeile) => /^\| \d{4}-\d{2}-\d{2} \|/.test(zeile) || /^## /.test(zeile));
}

describe("L · jede Lehre im Lehrenbuch ist bewacht oder begründet unbewacht", () => {
  const eintraege = eintraegeIm(lies(LEHRENBUCH));
  const lehrenZu = (e: string): number => REGISTER.filter((l) => e.includes(l.merkmal)).length;
  const eintraegeZu = (l: Lehre): number => eintraege.filter((e) => e.includes(l.merkmal)).length;

  it("das Lehrenbuch wird gelesen, nicht leer erhoben", () => {
    expect(eintraege.length).toBeGreaterThanOrEqual(REGISTER.length);
  });

  it("jeder Eintrag trifft genau einen Registereintrag", () => {
    const hinweis = "Neue Lehre? Wächter nennen oder begründen, warum keiner geht.";
    expect(
      eintraege.filter((e) => lehrenZu(e) !== 1),
      hinweis,
    ).toEqual([]);
  });

  it("jeder Registereintrag trifft genau einen Eintrag — keine verwaiste Zuordnung", () => {
    expect(REGISTER.filter((l) => eintraegeZu(l) !== 1).map((l) => l.merkmal)).toEqual([]);
  });

  it("jeder genannte Wächter liegt im Bestand; ohne Wächter steht ein Grund", () => {
    const fehler: string[] = [];
    for (const lehre of REGISTER) {
      for (const datei of lehre.waechter) {
        if (!existsSync(join(WURZEL, datei))) {
          fehler.push(`${lehre.merkmal}: ${datei} fehlt`);
        }
      }
      if (lehre.waechter.length === 0 && !lehre.ohneWaechter?.trim()) {
        fehler.push(`${lehre.merkmal}: weder Wächter noch Grund`);
      }
    }
    expect(fehler).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// W1 · Bauschritte installieren mit `npm ci`, nie mit `npm install`.
// ------------------------------------------------------------------------------------------------

type Bauart = "dockerfile" | "workflow";

// Im Dockerfile ist nur eine ganze Zeile Kommentar; im Workflow auch ein `#` nach Leerraum.
const KOMMENTAR: Record<Bauart, RegExp> = {
  dockerfile: /^(\s*)#.*$/,
  workflow: /(^|\s)#.*$/,
};

/** Jeder npm-Installationsbefehl außerhalb von Kommentaren, mit seinem Unterbefehl. */
function installBefehle(text: string, art: Bauart): string[] {
  const befehle = text
    .split("\n")
    .map((zeile) => zeile.replace(KOMMENTAR[art], "$1"))
    .join("\n")
    // Fortsetzungszeilen zusammenziehen: `RUN npm \` + `install` ist ein Befehl.
    .replace(/\\\n/g, " ");
  return [...befehle.matchAll(/\bnpm\s+(ci|install|i|add)\b/g)].map((m) => m[1] ?? "");
}

const BAUSCHRITTE: ReadonlyArray<readonly [string, Bauart]> = [
  ["Dockerfile", "dockerfile"],
  [".github/workflows/ci.yml", "workflow"],
];

describe("W1 · Bauschritte installieren deterministisch mit `npm ci`", () => {
  it("KALIBRIERUNG: der Leser fängt jede Installationsform und übergeht Kommentare", () => {
    expect(installBefehle("RUN npm install", "dockerfile")).toEqual(["install"]);
    expect(installBefehle("RUN cd apps/web && npm i", "dockerfile")).toEqual(["i"]);
    expect(installBefehle("RUN npm \\\n  install --omit=dev", "dockerfile")).toEqual(["install"]);
    expect(installBefehle("RUN npm ci --omit=dev", "dockerfile")).toEqual(["ci"]);
    expect(installBefehle("# npm install", "dockerfile")).toEqual([]);
    expect(installBefehle("RUN npm run build", "dockerfile")).toEqual([]);
    expect(installBefehle("      - run: npm install", "workflow")).toEqual(["install"]);
    expect(installBefehle("  # kein `npm install`", "workflow")).toEqual([]);
    expect(installBefehle("        run: npx playwright install", "workflow")).toEqual([]);
  });

  for (const [datei, art] of BAUSCHRITTE) {
    it(`${datei}: installiert, und zwar ausschließlich mit \`npm ci\``, () => {
      const befehle = installBefehle(lies(datei), art);
      expect(befehle.length, `${datei} installiert nicht mehr`).toBeGreaterThan(0);
      expect(befehle.filter((b) => b !== "ci")).toEqual([]);
    });
  }

  it("Dockerfile: Oberflächenstufe und Laufzeitstufe installieren beide mit `npm ci`", () => {
    const text = lies("Dockerfile");
    expect(text).toMatch(/^RUN cd apps\/web && npm ci\b/m);
    expect(text).toMatch(/^RUN npm ci --omit=dev\b/m);
  });
});

// ------------------------------------------------------------------------------------------------
// W2 · Die Modulgrenze verfolgt Typ-Importe mit.
// ------------------------------------------------------------------------------------------------

interface CruiserRegel {
  name?: string;
  severity?: string;
}
interface CruiserKonfiguration {
  forbidden?: CruiserRegel[];
  options?: { tsPreCompilationDeps?: unknown };
}

describe("W2 · `.dependency-cruiser.cjs` behält `tsPreCompilationDeps: true`", () => {
  const laden = createRequire(import.meta.url);
  const konfiguration = laden(join(WURZEL, ".dependency-cruiser.cjs")) as CruiserKonfiguration;

  it("die Option ist gesetzt — ohne sie sähe die Modulgrenze `import type` nicht", () => {
    expect(konfiguration.options?.tsPreCompilationDeps).toBe(true);
  });

  it("die Regel, für die die Option da ist, bricht weiterhin den Lauf", () => {
    const grenze = konfiguration.forbidden?.find((r) => r.name === "module-boundaries");
    expect(grenze?.severity).toBe("error");
  });

  it("das Tor fährt genau diese Konfiguration", () => {
    const aufruf = /npx depcruise --config \.dependency-cruiser\.cjs services/;
    expect(lies("tools/check")).toMatch(aufruf);
  });
});

// ------------------------------------------------------------------------------------------------
// W3 · An der Modalgrenze hängt kein Effekt am Kontextobjekt.
// ------------------------------------------------------------------------------------------------
//
// Das Kontextobjekt der Grenze wechselt mit `locked`, und `locked` setzt gerade die eigene
// Anmeldung (`enter`). Ein Effekt mit dem Objekt in der Abhängigkeitsliste läuft deshalb je Öffnen
// zweimal: abmelden (Fokus zurück auf den Auslöser), neu anmelden. Erhoben wird am Syntaxbaum:
//
//   · QUELLEN  jede Variable, die `useModalBoundary()`, `useModalBoundaryOptional()` oder
//              `useContext(ModalBoundaryCtx)` als Ganzes bindet, und jede Variable, die eine
//              solche als Ganzes weiterreicht (`a ?? b`, `a || b`, `c ? a : b`).
//   · VERSTOSS eine solche Variable in der Abhängigkeitsliste von useEffect, useLayoutEffect,
//              useInsertionEffect, useCallback oder useMemo. `grenze?.enter` und eine
//              Destrukturierung (`const { enter } = …`) sind erlaubt.
//   · UNBEKANNT ein Grenzzugriff, der weder gebunden noch nur gelesen wird (etwa als Argument
//              weitergereicht) — rot und zitiert, statt still übergangen.
//
// GRENZE DER MESSUNG: Namen gelten je Datei, nicht je Gültigkeitsbereich. Eine gleichnamige
// fremde Variable in derselben Datei würde mitgezählt — das macht den Wächter strenger, nicht blind.

const GRENZ_HOOKS = new Set(["useModalBoundary", "useModalBoundaryOptional"]);
const ABHAENGIGKEITS_HOOKS = new Set([
  "useEffect",
  "useLayoutEffect",
  "useInsertionEffect",
  "useCallback",
  "useMemo",
]);
const GRENZ_MODUL = "apps/web/src/app/ModalBoundaryContext.tsx";

interface GrenzBefund {
  fundort: string;
  art: "kontextobjekt-in-abhaengigkeit" | "unbekannt";
  zitat: string;
}

function aufgerufenerName(aufruf: ts.CallExpression): string | undefined {
  const ziel = aufruf.expression;
  if (ts.isIdentifier(ziel)) {
    return ziel.text;
  }
  if (ts.isPropertyAccessExpression(ziel)) {
    return ziel.name.text;
  }
  return undefined;
}

function istGrenzzugriff(knoten: ts.Node): knoten is ts.CallExpression {
  if (!ts.isCallExpression(knoten)) {
    return false;
  }
  const name = aufgerufenerName(knoten);
  if (name !== undefined && GRENZ_HOOKS.has(name)) {
    return true;
  }
  if (name !== "useContext") {
    return false;
  }
  const erstes = knoten.arguments[0];
  return erstes !== undefined && ts.isIdentifier(erstes) && erstes.text === "ModalBoundaryCtx";
}

function istWeiterreichung(knoten: ts.Node): knoten is ts.BinaryExpression {
  return (
    ts.isBinaryExpression(knoten) &&
    (knoten.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      knoten.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  );
}

function ohneHuelle(ausdruck: ts.Expression): ts.Expression {
  let aktuell = ausdruck;
  while (
    ts.isParenthesizedExpression(aktuell) ||
    ts.isNonNullExpression(aktuell) ||
    ts.isAsExpression(aktuell) ||
    ts.isSatisfiesExpression(aktuell)
  ) {
    aktuell = aktuell.expression;
  }
  return aktuell;
}

/** Reicht der Ausdruck ein gebundenes Grenzobjekt als Ganzes weiter? */
function reichtWeiter(ausdruck: ts.Expression, gebunden: ReadonlySet<string>): boolean {
  const kern = ohneHuelle(ausdruck);
  if (ts.isIdentifier(kern)) {
    return gebunden.has(kern.text);
  }
  if (ts.isCallExpression(kern)) {
    return istGrenzzugriff(kern);
  }
  if (istWeiterreichung(kern)) {
    return reichtWeiter(kern.left, gebunden) || reichtWeiter(kern.right, gebunden);
  }
  if (ts.isConditionalExpression(kern)) {
    return reichtWeiter(kern.whenTrue, gebunden) || reichtWeiter(kern.whenFalse, gebunden);
  }
  return false;
}

function alleKnoten(wurzel: ts.Node): ts.Node[] {
  const aus: ts.Node[] = [];
  const besuche = (knoten: ts.Node): void => {
    aus.push(knoten);
    ts.forEachChild(knoten, besuche);
  };
  besuche(wurzel);
  return aus;
}

/** Ist der Grenzzugriff erklärt: gebunden, gelesen oder (nur im Grenzmodul) zurückgegeben? */
function zugriffErklaert(aufruf: ts.CallExpression, datei: string): boolean {
  let oben: ts.Node = aufruf.parent;
  while (
    ts.isParenthesizedExpression(oben) ||
    ts.isNonNullExpression(oben) ||
    ts.isAsExpression(oben) ||
    ts.isConditionalExpression(oben) ||
    istWeiterreichung(oben)
  ) {
    oben = oben.parent;
  }
  if (ts.isVariableDeclaration(oben)) {
    return true;
  }
  if (ts.isPropertyAccessExpression(oben) && oben.expression === aufruf) {
    return true;
  }
  return ts.isReturnStatement(oben) && datei === GRENZ_MODUL;
}

function grenzBefundeIn(text: string, datei: string): GrenzBefund[] {
  const art = datei.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true, art);
  const knoten = alleKnoten(ast);
  const ort = (k: ts.Node): string =>
    `${datei}:${ast.getLineAndCharacterOfPosition(k.getStart(ast)).line + 1}`;
  const befunde: GrenzBefund[] = [];

  for (const k of knoten) {
    if (istGrenzzugriff(k) && !zugriffErklaert(k, datei)) {
      befunde.push({ fundort: ort(k), art: "unbekannt", zitat: k.parent.getText(ast) });
    }
  }

  // Gebundene Grenzobjekte bis zum Fixpunkt: `const a = useModalBoundaryOptional()`, dann
  // `const g = p ?? a` usw. Destrukturierungen binden Teile, nicht das Objekt.
  const gebunden = new Set<string>();
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const k of knoten) {
      if (
        ts.isVariableDeclaration(k) &&
        ts.isIdentifier(k.name) &&
        k.initializer !== undefined &&
        !gebunden.has(k.name.text) &&
        reichtWeiter(k.initializer, gebunden)
      ) {
        gebunden.add(k.name.text);
        gewachsen = true;
      }
    }
  }

  for (const k of knoten) {
    if (!ts.isCallExpression(k)) {
      continue;
    }
    const name = aufgerufenerName(k);
    const liste = k.arguments[1];
    if (name === undefined || !ABHAENGIGKEITS_HOOKS.has(name) || liste === undefined) {
      continue;
    }
    if (!ts.isArrayLiteralExpression(liste)) {
      continue;
    }
    for (const element of liste.elements) {
      if (reichtWeiter(element, gebunden)) {
        befunde.push({
          fundort: ort(element),
          art: "kontextobjekt-in-abhaengigkeit",
          zitat: `${name}(…, ${liste.getText(ast)})`,
        });
      }
    }
  }
  return befunde;
}

/** Dateien, die die Grenze überhaupt holen — die Grundmenge der Erhebung. */
function holtGrenze(text: string): boolean {
  return /\buseModalBoundary(?:Optional)?\s*\(|\buseContext\s*\(\s*ModalBoundaryCtx\b/.test(text);
}

// Kalibrierfälle. Der erste ist die Bauform vor mega87: der Effekt hängt am Objekt.
const VERSTOESSE = [
  "const grenze = useModalBoundaryOptional(); useEffect(() => grenze?.enter(f), [open, grenze]);",
  "const aus = useModalBoundaryOptional(); const g = p ?? aus; useLayoutEffect(() => {}, [g]);",
  "const aus = useContext(ModalBoundaryCtx); const w = x === undefined ? aus : x; useCallback(() => {}, [w]);",
  "const g = useModalBoundary(); useMemo(() => 1, [(g as V)]);",
];
const ERLAUBT = [
  "const grenze = useModalBoundaryOptional(); const anmelden = grenze?.enter; useEffect(() => anmelden?.(f), [anmelden]);",
  "const { enter } = useModalBoundary(); useEffect(() => enter(f), [enter]);",
  "const grenze = 5; useEffect(() => {}, [grenze]);",
  "const locked = useContext(ModalBoundaryCtx)?.locked ?? false;",
];

describe("W3 · an der Modalgrenze hängt kein Effekt am Kontextobjekt", () => {
  const dateien = quelldateien(WEB_SRC).map(posix);
  const mitGrenze = dateien.filter((datei) => holtGrenze(lies(datei)));
  const befunde = mitGrenze.flatMap((datei) => grenzBefundeIn(lies(datei), datei));

  it("die Erhebung läuft nicht leer und reicht bis zu den Flächen, die die Lehre nennt", () => {
    for (const flaeche of [
      "apps/web/src/components/Modal.tsx",
      "apps/web/src/components/start/Seitenblatt.tsx",
      "apps/web/src/shell/MobileNavDrawer.tsx",
      "apps/web/src/components/FacetFilter.tsx",
      GRENZ_MODUL,
    ]) {
      expect(mitGrenze, flaeche).toContain(flaeche);
    }
  });

  it("kein Grenzobjekt steht in einer Abhängigkeitsliste, kein Zugriff bleibt unerklärt", () => {
    const hinweis = "Nur `enter` oder ein anderer stabiler Teil gehört in die Liste (2026-09-27).";
    expect(
      befunde.map((b) => `${b.fundort} [${b.art}]  ${b.zitat}`),
      hinweis,
    ).toEqual([]);
  });

  it("KALIBRIERUNG: Verstöße werden erkannt, die erlaubten Bauformen nicht", () => {
    const arten = (src: string): string[] => grenzBefundeIn(src, "x.tsx").map((b) => b.art);
    for (const src of VERSTOESSE) {
      expect(arten(src), src).toEqual(["kontextobjekt-in-abhaengigkeit"]);
    }
    for (const src of ERLAUBT) {
      expect(arten(src), src).toEqual([]);
    }
    // Unbekannt: der Zugriff wird weitergereicht statt gebunden oder gelesen.
    expect(arten("merke(useModalBoundaryOptional());")).toEqual(["unbekannt"]);
  });
});
