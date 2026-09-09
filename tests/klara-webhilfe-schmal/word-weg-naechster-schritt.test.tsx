import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @vitest-environment jsdom
// JOB 3144 · UX-16/N-0042: gemountete Struktur, keine Layoutbehauptung in jsdom.
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { KlaraPathTeaser } from "../../apps/web/src/components/KlaraPathTeaser";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function mount(surface: "start" | "import"): Promise<void> {
  await act(async () => {
    root.render(createElement(MemoryRouter, null, createElement(KlaraPathTeaser, { surface })));
  });
}

const hilfeFaelle = [
  ["F8", "start"],
  ["F9", "import"],
] as const;

describe("JOB 3144 · Word-Vorschau hat einen erreichbaren nächsten Schritt", () => {
  it.each(hilfeFaelle)(
    "%s · auf %s führt genau ein Link zur bestehenden Hilfe",
    async (_fall, surface) => {
      await mount(surface);
      const links = host.querySelectorAll("a");
      expect(links).toHaveLength(1);
      expect(links[0]?.getAttribute("href")).toBe("/hilfe");
      expect(host.querySelector("details")?.nextElementSibling).toBe(links[0]);
    },
  );

  it("F10 · der benannte Hilfe-Link gehört zur Tabulatorreihenfolge", async () => {
    await mount("start");
    const link = host.querySelector<HTMLAnchorElement>('a[href="/hilfe"]');
    expect(link, "Hilfe-Link fehlt").not.toBeNull();
    if (!link) throw new Error("Hilfe-Link fehlt");
    expect(link.tabIndex).toBe(0);
    expect(link.closest('[aria-hidden="true"], [hidden], [inert]')).toBeNull();
    expect(link.textContent).toBe(
      "Klara hilft dir schon heute in der Web-App — hier geht es zur Hilfe.",
    );
    expect(link.getAttribute("aria-label")).toBeNull();
    // Native Fokusfähigkeit + Tabindex prüfen die Struktur. Ein synthetisches Tab-Ereignis
    // bewegt in jsdom keinen Fokus; echte Tab-Navigation misst die Chromium-Datei daneben.
    link.focus();
    expect(document.activeElement).toBe(link);
  });

  it.each(["start", "import"] as const)(
    "F11 · %s bleibt Demnächst, ohne Klara-CTA oder Verfügbarkeitsbehauptung",
    async (surface) => {
      await mount(surface);
      expect(host.textContent).toContain("Demnächst");
      expect(host.textContent).toContain("Verfügbar ist das noch nicht.");
      expect(host.querySelector("button")).toBeNull();
      for (const cta of [
        "Mit Klara starten",
        "Mit Klara Wissen erfassen",
        "Import mit Klara begleiten",
      ]) {
        expect(host.textContent).not.toContain(cta);
      }
    },
  );
});

// JOB 3264: Symbolidentität statt Namensvergleich. Nur konstante Aliasübergänge und
// Modul-Re-Exporte gelten als aufgelöst; jede andere Weitergabe bleibt ein Rotbefund.
type Verwendung = { datei: string; zeile: number; flaeche: string };
const produktOrdner = resolve("apps/web/src");
const komponentenPfad = join(produktOrdner, "components/KlaraPathTeaser.tsx");
const kalibrierOrdner = resolve("tests/klara-webhilfe-schmal/kalibrierung");

function quellDateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true })
    .flatMap((eintrag) => {
      if (["node_modules", "__tests__", "test", "tests", "__mocks__"].includes(eintrag.name))
        return [];
      const pfad = join(ordner, eintrag.name);
      return eintrag.isDirectory()
        ? quellDateien(pfad)
        : /\.[cm]?[jt]sx?$/.test(eintrag.name) &&
            !/\.(test|spec|d)\.[cm]?[jt]sx?$/.test(eintrag.name)
          ? [pfad]
          : [];
    })
    .sort();
}

function erhebeAufrufer(
  ordner: string,
  // Gegenproben ändern den gelesenen Originalquelltext im Speicher, niemals Produktdateien.
  quellErsatz: ReadonlyMap<string, string> = new Map(),
): Verwendung[] {
  const dateien = quellDateien(ordner);
  const optionen: ts.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    allowJs: true,
    noLib: true,
    noResolve: true,
    types: [],
  };
  const host = ts.createCompilerHost(optionen, true);
  const lesen = host.readFile;
  host.readFile = (pfad) => quellErsatz.get(resolve(pfad)) ?? lesen(pfad);
  // noResolve hält Fremdpakete aus dem Lauf. Alle lokalen Module sind explizite Wurzeln,
  // inklusive der echten Komponente für die Kalibrierung; der Checker löst ihre Exporte auf.
  const programm = ts.createProgram([...new Set([...dateien, komponentenPfad])], optionen, host);
  const checker = programm.getTypeChecker();
  const befunde = new Map<string, Verwendung>();

  function entpacke(knoten: ts.Node): ts.Node {
    return ts.isParenthesizedExpression(knoten) ||
      ts.isAsExpression(knoten) ||
      ts.isNonNullExpression(knoten) ||
      ts.isSatisfiesExpression(knoten) ||
      ts.isTypeAssertionExpression(knoten)
      ? entpacke(knoten.expression)
      : knoten;
  }
  function schluessel(
    knoten: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  ): string | undefined {
    if (ts.isPropertyAccessExpression(knoten)) return knoten.name.text;
    const argument = entpacke(knoten.argumentExpression);
    return ts.isStringLiteralLike(argument) ? argument.text : undefined;
  }
  function istKomponente(symbol: ts.Symbol): boolean {
    return (
      symbol.declarations?.some(
        (d) =>
          resolve(d.getSourceFile().fileName) === komponentenPfad &&
          ts.isFunctionDeclaration(d) &&
          d.name?.text === "KlaraPathTeaser",
      ) ?? false
    );
  }
  function aufloesen(knoten: ts.Node, gesehen = new Set<ts.Symbol>()): ts.Symbol | undefined {
    const ausdruck = entpacke(knoten);
    if (ts.isPropertyAccessExpression(ausdruck) || ts.isElementAccessExpression(ausdruck)) {
      const basis = aufloesen(ausdruck.expression, gesehen);
      const name = schluessel(ausdruck);
      if (!basis || istKomponente(basis) || name === undefined) return undefined;
      return bindung(
        checker.getExportsOfModule(basis).find((s) => s.name === name),
        gesehen,
      );
    }
    return ts.isIdentifier(ausdruck)
      ? bindung(
          ts.isShorthandPropertyAssignment(ausdruck.parent)
            ? checker.getShorthandAssignmentValueSymbol(ausdruck.parent)
            : checker.getSymbolAtLocation(ausdruck),
          gesehen,
        )
      : undefined;
  }
  function bindung(symbol: ts.Symbol | undefined, gesehen: Set<ts.Symbol>): ts.Symbol | undefined {
    if (!symbol || gesehen.has(symbol)) return undefined;
    const weiter = new Set(gesehen).add(symbol);
    if (symbol.flags & ts.SymbolFlags.Alias)
      return bindung(checker.getAliasedSymbol(symbol), weiter);
    if (istKomponente(symbol)) return symbol;
    for (const deklaration of symbol.declarations ?? []) {
      if (ts.isVariableDeclaration(deklaration) && deklaration.initializer) {
        const ziel = aufloesen(deklaration.initializer, weiter);
        if (ziel) return ziel;
      }
      if (ts.isExportAssignment(deklaration)) return aufloesen(deklaration.expression, weiter);
    }
    if (
      symbol.flags & ts.SymbolFlags.Module &&
      checker.getExportsOfModule(symbol).some((s) => bindung(s, weiter))
    )
      return symbol;
    return undefined;
  }
  function melde(knoten: ts.Node, flaeche = "ungeklärt"): void {
    const quelle = knoten.getSourceFile();
    const datei = relative(ordner, quelle.fileName);
    const zeile = quelle.getLineAndCharacterOfPosition(knoten.getStart(quelle)).line + 1;
    befunde.set(`${datei}:${knoten.getStart(quelle)}:${flaeche}`, { datei, zeile, flaeche });
  }
  function surface(knoten: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
    const attribute = knoten.attributes.properties;
    // Auch ein späterer Spread kann eine zuvor wörtliche surface überschreiben.
    if (attribute.some(ts.isJsxSpreadAttribute)) return "ungeklärt";
    const werte = attribute.filter((a) => ts.isJsxAttribute(a) && a.name.getText() === "surface");
    if (werte.length !== 1) return "ungeklärt";
    const attribut = werte[0];
    if (!attribut || !ts.isJsxAttribute(attribut) || !attribut.initializer) return "ungeklärt";
    const wert = ts.isJsxExpression(attribut.initializer)
      ? attribut.initializer.expression
      : attribut.initializer;
    const literal = wert && entpacke(wert);
    return literal && ts.isStringLiteralLike(literal) ? literal.text : "ungeklärt";
  }
  function besuche(knoten: ts.Node): void {
    if (
      ts.isImportDeclaration(knoten) ||
      ts.isExportDeclaration(knoten) ||
      ts.isImportEqualsDeclaration(knoten) ||
      ts.isTypeNode(knoten)
    )
      return;
    if (
      ts.isIdentifier(knoten) ||
      ts.isPropertyAccessExpression(knoten) ||
      ts.isElementAccessExpression(knoten)
    ) {
      const eltern = knoten.parent;
      const istName =
        (ts.isVariableDeclaration(eltern) ||
          ts.isFunctionDeclaration(eltern) ||
          ts.isParameter(eltern) ||
          ts.isBindingElement(eltern) ||
          ts.isPropertyAccessExpression(eltern)) &&
        eltern.name === knoten;
      const ziel = istName ? undefined : aufloesen(knoten);
      if (ziel) {
        let verwendung: ts.Node = knoten;
        while (verwendung.parent && entpacke(verwendung.parent) === knoten)
          verwendung = verwendung.parent;
        const kontext = verwendung.parent;
        if (
          (ts.isPropertyAccessExpression(kontext) || ts.isElementAccessExpression(kontext)) &&
          kontext.expression === verwendung &&
          !istKomponente(ziel)
        ) {
          const name = schluessel(kontext);
          if (name === undefined || !checker.getExportsOfModule(ziel).some((s) => s.name === name))
            melde(kontext);
        } else if (
          (ts.isJsxOpeningElement(kontext) || ts.isJsxSelfClosingElement(kontext)) &&
          kontext.tagName === verwendung &&
          istKomponente(ziel)
        ) {
          melde(kontext, surface(kontext));
        } else if (ts.isJsxClosingElement(kontext) && kontext.tagName === verwendung) {
          // Der öffnende Tag trägt den einen Befund.
        } else if (
          ts.isVariableDeclaration(kontext) &&
          kontext.initializer === verwendung &&
          ts.isIdentifier(kontext.name) &&
          ts.isVariableDeclarationList(kontext.parent) &&
          kontext.parent.flags & ts.NodeFlags.Const
        ) {
          // Der Checker folgt diesem Alias bis zu jeder Verwendung (auch in anderem Scope).
        } else if (ts.isExportAssignment(kontext) && kontext.expression === verwendung) {
          // Default-Re-Export: der Checker folgt dem ExportAssignment.
        } else {
          melde(verwendung);
        }
      }
    }
    ts.forEachChild(knoten, besuche);
  }
  for (const datei of dateien) {
    const quelle = programm.getSourceFile(datei);
    if (!quelle) throw new Error(`${datei}: Quelltext nicht erhoben`);
    const syntaxfehler = programm.getSyntacticDiagnostics(quelle);
    if (syntaxfehler.length) {
      const zeile = quelle.getLineAndCharacterOfPosition(syntaxfehler[0]?.start ?? 0).line + 1;
      throw new Error(`${datei}:${zeile}: ungeklärte Weiterverwendung — Quelltext nicht parsebar`);
    }
    besuche(quelle);
  }
  return [...befunde.values()].sort((a, b) => a.datei.localeCompare(b.datei) || a.zeile - b.zeile);
}

function pruefeFlaechen(befunde: Verwendung[]): void {
  expect(
    befunde.length,
    "Keine produktiven Aufrufer gefunden — Erhebung ungeklärt",
  ).toBeGreaterThan(0);
  const geprueft: ReadonlySet<string> = new Set(hilfeFaelle.map(([, flaeche]) => flaeche));
  const fehler = befunde.flatMap((b) =>
    b.flaeche === "ungeklärt"
      ? [`${b.datei}:${b.zeile}: ungeklärte Weiterverwendung`]
      : !geprueft.has(b.flaeche)
        ? [`${b.datei}:${b.zeile}: ungeprüfte Fläche "${b.flaeche}"`]
        : [],
  );
  expect(fehler, fehler.join("\n")).toEqual([]);
}

it("F12 · Kalibrierung findet Punkt- UND Klammerzugriff auf die dritte Fläche", () => {
  const befunde = erhebeAufrufer(kalibrierOrdner);
  for (const datei of ["punkt.tsx", "klammer.tsx"]) {
    expect(
      befunde.filter((b) => b.datei === datei),
      `${datei}: dritte Fläche per ${datei === "klammer.tsx" ? "Klammerzugriff" : "Punktzugriff"} fehlt`,
    ).toEqual([{ datei, zeile: 5, flaeche: "capture" }]);
  }
});

it("F12a · jede produktive Word-Vorschau-Fläche ist durch F8–F11 geprüft", () => {
  const beginn = performance.now();
  const befunde = erhebeAufrufer(produktOrdner);
  console.info(
    `Aufrufererhebung ${Math.round(performance.now() - beginn)} ms: ${JSON.stringify(befunde)}`,
  );
  pruefeFlaechen(befunde);
});

// Derselbe Ordner, dieselbe Erhebung: die Ersatzquelle wird nur gelesen, nicht ausgeführt.
// So können auch absichtlich nicht typisierbare, dynamische Weitergaben kalibrieren.
const direktImport =
  'import { KlaraPathTeaser } from "../../../apps/web/src/components/KlaraPathTeaser";';
const namensraumImport = 'import * as ns from "../../../apps/web/src/components/KlaraPathTeaser";';
function kalibriere(quelle: string): Verwendung[] {
  return erhebeAufrufer(
    kalibrierOrdner,
    new Map([[join(kalibrierOrdner, "punkt.tsx"), quelle]]),
  ).filter((b) => b.datei === "punkt.tsx");
}

it.each([
  ["Direktimport", `${direktImport}\nconst Seite = () => <KlaraPathTeaser surface="capture" />;`],
  [
    "Importalias",
    'import { KlaraPathTeaser as X } from "../../../apps/web/src/components/KlaraPathTeaser";\nconst Seite = () => <X surface="capture" />;',
  ],
  [
    "Namensraum-JSX",
    `${namensraumImport}\nconst Seite = () => <ns.KlaraPathTeaser surface="capture"></ns.KlaraPathTeaser>;`,
  ],
  [
    "Alias-Kette",
    `${direktImport} const X = KlaraPathTeaser; const Y = (X);\nconst Seite = () => <Y surface={"capture"} />;`,
  ],
  [
    "Namensraum-Alias",
    `${namensraumImport} const n = ns; const X = n["KlaraPathTeaser"];\nconst Seite = () => <X surface="capture" />;`,
  ],
  [
    "benannter Re-Export",
    'import { Hilfe as X } from "./weiterexport";\nconst Seite = () => <X surface="capture" />;',
  ],
  [
    "Stern-Re-Export",
    'import { KlaraPathTeaser as X } from "./weiterexport";\nconst Seite = () => <X surface="capture" />;',
  ],
  [
    "Default-Re-Export",
    'import X from "./weiterexport";\nconst Seite = () => <X surface="capture" />;',
  ],
  [
    "Namensraum-Re-Export",
    'import { Vorschau as ns } from "./weiterexport"; const X = ns["KlaraPathTeaser"];\nconst Seite = () => <X surface="capture" />;',
  ],
])("F12b · %s meldet die dritte Fläche mit Fundstelle", (_name, quelle) => {
  const befunde = kalibriere(quelle);
  expect(befunde).toEqual([{ datei: "punkt.tsx", zeile: 2, flaeche: "capture" }]);
  expect(() => pruefeFlaechen(befunde)).toThrow('punkt.tsx:2: ungeprüfte Fläche "capture"');
});

it.each([
  ["berechneter Namensraumschlüssel", `${namensraumImport}\nconst X = ns[schluessel];`],
  [
    "Schlüsselvariable trotz Literaltyp",
    `${namensraumImport} const key = "KlaraPathTeaser";\nconst X = ns[key];`,
  ],
  [
    "berechneter Schlüssel neben bekanntem Aufruf",
    `${namensraumImport} const Seite = () => <ns.KlaraPathTeaser surface="start" />;\nconst X = ns[schluessel];`,
  ],
  [
    "surface-Variable",
    `${direktImport}\nconst Seite = () => <KlaraPathTeaser surface={flaeche} />;`,
  ],
  ["fehlende surface", `${direktImport}\nconst Seite = () => <KlaraPathTeaser />;`],
  [
    "Spread nach surface",
    `${direktImport}\nconst Seite = () => <KlaraPathTeaser surface="start" {...props} />;`,
  ],
  [
    "Spread vor surface",
    `${direktImport}\nconst Seite = () => <KlaraPathTeaser {...props} surface="start" />;`,
  ],
  [
    "Weitergabe als Prop",
    `${direktImport}\nconst Seite = () => <Empfaenger component={KlaraPathTeaser} />;`,
  ],
  [
    "Namensraum als Prop",
    `${namensraumImport}\nconst Seite = () => <Empfaenger components={ns} />;`,
  ],
  [
    "Alias als Prop",
    `${namensraumImport} const X = ns["KlaraPathTeaser"];\nconst Seite = () => <Empfaenger component={X} />;`,
  ],
  ["Funktionsargument", `${direktImport}\nregistriere(KlaraPathTeaser);`],
  ["Namensraum als Funktionsargument", `${namensraumImport}\nregistriere(ns);`],
  ["createElement", `${direktImport}\ncreateElement(KlaraPathTeaser, { surface: "capture" });`],
  ["Rückgabe der Bindung", `${direktImport}\nconst hole = () => KlaraPathTeaser;`],
  ["veränderlicher Alias", `${direktImport}\nlet X = KlaraPathTeaser;`],
  ["Objekt-Kurzschreibweise", `${direktImport}\nconst register = { KlaraPathTeaser };`],
  ["Destrukturierung", `${namensraumImport}\nconst { KlaraPathTeaser: X } = ns;`],
  ["Namensraum im Array", `${namensraumImport}\nconst register = [ns];`],
  ["unbekanntes Namensraummitglied", `${namensraumImport}\nconst X = ns.unbekannt;`],
])("F12c · ungeklärte Weiterverwendung: %s schweigt nicht", (_name, quelle) => {
  const befunde = kalibriere(quelle);
  expect(befunde).toContainEqual({ datei: "punkt.tsx", zeile: 2, flaeche: "ungeklärt" });
  expect(() => pruefeFlaechen(befunde)).toThrow("punkt.tsx:2: ungeklärte Weiterverwendung");
});

it("F12d · leere Erhebung ist rot; Kommentare, fremde Namen und Schattenbindungen sind keine Aufrufer", () => {
  const befunde = kalibriere(`${namensraumImport}
// <ns.KlaraPathTeaser surface="capture" />
const text = '<KlaraPathTeaser surface="capture" />';
function fremd(ns: { KlaraPathTeaser: unknown }) { return ns.KlaraPathTeaser; }
function KlaraPathTeaser() { return null; }
const Seite = () => <KlaraPathTeaser surface="capture" />;`);
  expect(befunde).toEqual([]);
  expect(() => pruefeFlaechen(befunde)).toThrow("Keine produktiven Aufrufer gefunden");
});

it.each([
  ["Direktimport", '\nexport const Gegenprobe = () => <KlaraPathTeaser surface="capture" />;'],
  [
    "Klammeralias",
    '\nimport * as WordVorschau from "../components/KlaraPathTeaser";\nconst WordHilfe = WordVorschau["KlaraPathTeaser"];\nexport const Gegenprobe = () => <WordHilfe surface="capture" />;',
  ],
])("F12e · Produkt-Gegenprobe %s wird rot, ohne die Produktdatei zu schreiben", (_name, zusatz) => {
  const datei = join(produktOrdner, "pages/Stufe2.tsx");
  const original = readFileSync(datei, "utf8");
  const zeile =
    (original + zusatz).split("\n").findIndex((z) => z.includes("export const Gegenprobe")) + 1;
  const befunde = erhebeAufrufer(produktOrdner, new Map([[datei, original + zusatz]]));
  expect(befunde).toContainEqual({ datei: "pages/Stufe2.tsx", zeile, flaeche: "capture" });
  expect(() => pruefeFlaechen(befunde)).toThrow(
    `pages/Stufe2.tsx:${zeile}: ungeprüfte Fläche "capture"`,
  );
  expect(readFileSync(datei, "utf8")).toBe(original);
});

it("F12f · auch ein Aufruf im Definitionsmodul darf nicht verschwinden", () => {
  const original = readFileSync(komponentenPfad, "utf8");
  const quelle = `${original}\nexport const WeitereFlaeche = () => <KlaraPathTeaser surface="capture" />;`;
  const zeile = quelle.split("\n").length;
  const befunde = erhebeAufrufer(produktOrdner, new Map([[komponentenPfad, quelle]]));
  expect(befunde).toContainEqual({
    datei: "components/KlaraPathTeaser.tsx",
    zeile,
    flaeche: "capture",
  });
  expect(() => pruefeFlaechen(befunde)).toThrow(
    `components/KlaraPathTeaser.tsx:${zeile}: ungeprüfte Fläche "capture"`,
  );
});
