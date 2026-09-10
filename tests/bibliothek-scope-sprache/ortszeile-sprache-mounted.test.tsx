// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import i18n from "../../apps/web/src/i18n";
import { repoPfad } from "../support/repoPfad";

const worte = {
  de: ["Geltungsbereich", "Meine Ablage", "Alle Inhalte"],
  en: ["Scope", "My collection", "All content"],
  nl: ["Bereik", "Mijn verzameling", "Alle inhoud"],
} as const;
const sprachen = Object.keys(i18n.options.resources ?? {});
// JOB 3565 · Lieferung 4 — die geführten Sprachen stehen hier UNABHÄNGIG von `i18n`, damit Fall 7
// eine echte Gegenaussage hat und nicht die Laufzeitquelle mit sich selbst vergleicht.
const GEFUEHRTE_SPRACHEN = ["de", "en", "nl"];
const schluessel = ["lib.ownScope.label", "lib.ownScope.meine", "lib.ownScope.alle"];

// JOB 3565 · Lieferung 2 — Pedis Begründung für die Ortszeile, wörtlich. Quelle des Wortlauts ist
// das Codex-Urteil zu JOB 3489 (`archiv/3489/runde-1/ben.md:35`); die dort zitierte
// Entscheidungsdatei `ENTSCHEIDUNGEN/JOB-381-ORTSZEILE.md` existiert in keinem Commit dieses Repos.
// Der Kommentarkopf von `libraryOwnScope.ts` ist damit der letzte Ort, an dem der Satz steht — und
// genau deshalb hat er hier einen Wächter (Fall 6).
const PEDIS_SATZ =
  "„Die Zeile muss wirken, nicht nur aussehen. 'Meine Ablage' filtert auf createdBy des " +
  'angemeldeten Nutzers. Eine Schaltflaeche ohne Wirkung waere eine Attrappe."';
const bestand = [
  { id: "eigen", title: "Eigener Beitrag", author: "fremd", history: [{ author: "ich" }] },
  { id: "fremd", title: "Fremder Beitrag", author: "ich", history: [{ author: "fremd" }] },
  { id: "unbekannt", title: "Ohne Historie", author: "ich", history: [] },
].map((ko) => ({
  statement: "",
  conditions: [],
  measures: [],
  type: "best_practice",
  category: "Anlage",
  tags: [],
  confidence: 0,
  trust: 0,
  status: "validiert",
  version: 1,
  originalAuthor: "fremd",
  neededValidations: 2,
  assignments: [],
  asset: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  ...ko,
})) as unknown as KnowledgeObject[];

/**
 * JOB 3565 · Lieferung 1 — TypeScript-Quelltext ohne Kommentare, Zeichenketten UNVERÄNDERT.
 *
 * Die Trennung von Code und Kommentar macht NICHT dieser Test, sondern der TypeScript-Parser
 * selbst: die Datei wird geparst, und übrig bleibt genau das, was der Parser als Token sieht.
 * Kommentare sind für ihn Trivia und stehen in keinem Token; JSDoc-Blöcke hängen als eigene Knoten
 * am Baum und werden hier verworfen. Alles andere — Zeichenketten, Templates, Regex-Literale —
 * bleibt Zeichen für Zeichen erhalten, an seiner ursprünglichen Stelle (Kommentartext wird durch
 * Leerzeichen ersetzt, Zeilenumbrüche bleiben, damit Zeilennummern stimmen).
 *
 * WARUM NICHT VON HAND: die erste Fassung dieses Jobs lief zeichenweise und schätzte, wo eine
 * Zeichenkette beginnt. Codex fand daran zwei echte Fehler (Urteil zu Runde 1, Korrekturpflicht 1):
 * ein Regex-Literal `/\/\//` wurde als Kommentarbeginn gelesen — alles dahinter, auch ein deutsches
 * Anzeigetext-Literal, verschwand ungeprüft; und ein Kommentar innerhalb eines `${…}`-Ausdrucks
 * blieb stehen, weil der Backtick als durchgehende Zeichenkette galt. Die damals dort behauptete
 * „bewusste Grenze, folgenlos" war falsch: sie kostete Fall 5 die Schärfe. Beide Fälle stehen jetzt
 * als Proben in `scannerProben` und werden von Fall 9 dauerhaft gehalten.
 */
function ohneKommentare(quelle: string): string {
  const datei = ts.createSourceFile(
    "probe.ts",
    quelle,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const istCode = new Array<boolean>(quelle.length).fill(false);
  const sammle = (knoten: ts.Node): void => {
    // JSDoc-Knoten (`/** … */`) hängen als Kinder am Baum — sie sind Kommentar, nicht Code.
    if (knoten.kind >= ts.SyntaxKind.FirstJSDocNode && knoten.kind <= ts.SyntaxKind.LastJSDocNode) {
      return;
    }
    const kinder = knoten.getChildren(datei);
    if (kinder.length === 0) {
      for (let i = knoten.getStart(datei); i < knoten.getEnd(); i += 1) istCode[i] = true;
      return;
    }
    for (const kind of kinder) sammle(kind);
  };
  sammle(datei);
  let aus = "";
  for (let i = 0; i < quelle.length; i += 1) {
    const zeichen = quelle[i] as string;
    aus += istCode[i] || zeichen === "\n" ? zeichen : " ";
  }
  return aus;
}

/**
 * JOB 3565 · Runde 2 — der Scanner hat jetzt selbst einen Wächter (Fall 9).
 *
 * Beide Lücken, die Codex an der Runde-1-Fassung von `ohneKommentare` fand, stehen hier als Probe:
 * ein deutsches Anzeigetext-Literal HINTER einem Regex-Literal muss stehen bleiben (sonst übersieht
 * Fall 5 es), ein deutscher Kommentar INNERHALB eines `${…}`-Ausdrucks muss fallen (sonst vertreibt
 * Fall 5 erneut einen Kommentar — genau der Schaden, den dieser Job repariert).
 *
 * `true` = der Text steht danach noch da (Code), `false` = er ist weg (Kommentar).
 */
const scannerProben: ReadonlyArray<readonly [string, string, boolean]> = [
  ["Zeilenkommentar fällt", '// Meine Ablage\nconst a = "x";', false],
  ["Blockkommentar fällt", '/* Meine Ablage */\nconst a = "x";', false],
  ["JSDoc fällt", '/**\n * Meine Ablage\n */\nexport const a = "x";', false],
  ["Kommentar im Template-Ausdruck fällt", "const a = `${/* Meine Ablage */ 1}`;", false],
  ["Kommentar hinter Code fällt", 'const a = "x"; // Meine Ablage', false],
  ["Zeichenkette bleibt", 'const a = "Meine Ablage";', true],
  ["Zeichenkette mit `//` darin bleibt", 'const a = "https://host/Meine Ablage";', true],
  [
    "Zeichenkette hinter einem Regex bleibt",
    'const a = /\\/\\//.test("x") ? "Meine Ablage" : "";',
    true,
  ],
  ["Template bleibt", "const a = `Meine Ablage`;", true],
];

const lage = vi.hoisted(() => ({ zustand: "erfolgreich" }));
function query() {
  const cache = lage.zustand.startsWith("Cache");
  const fehler = lage.zustand === "Fehler" || lage.zustand === "Cache gescheitert";
  return {
    data:
      cache || lage.zustand === "erfolgreich" ? bestand : lage.zustand === "leer" ? [] : undefined,
    isLoading: lage.zustand === "laden",
    isFetching: lage.zustand === "laden" || lage.zustand === "Cache laufend",
    isError: fehler,
    isRefetchError: fehler && cache,
    isStale: cache,
    fetchStatus:
      lage.zustand === "offline"
        ? "paused"
        : lage.zustand === "laden" || lage.zustand === "Cache laufend"
          ? "fetching"
          : "idle",
    dataUpdatedAt: cache || lage.zustand === "erfolgreich" ? Date.parse("2026-09-01T10:00:00Z") : 0,
    error: fehler ? new Error("Abruf fehlgeschlagen") : null,
  };
}
vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = (data: unknown) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => query(),
    useLibrarySearch: () => query(),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
    useEigeneBefunde: () => ok([]),
    useAudit: () => ok([]),
    useKo: () => ({ data: undefined, isLoading: true, isError: false, error: null }),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "ich", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | undefined;
let client: QueryClient;
function Adresse() {
  return createElement("span", { "data-adresse": useLocation().search });
}
async function mount(sprache: string) {
  await i18n.changeLanguage(sprache);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/bibliothek?sonstwas=behalten"] },
          createElement(Adresse),
          createElement(BibliothekFlaeche),
        ),
      ),
    );
  });
}
function el(id: string): HTMLElement {
  const element = container.querySelector(`[data-testid="${id}"]`);
  expect(element, id).toBeInstanceOf(HTMLElement);
  return element as HTMLElement;
}
function pruefeTexte(sprache: string) {
  const soll = worte[sprache as keyof typeof worte];
  expect(soll, `unabhängige Solltexte für ${sprache}`).toBeDefined();
  expect(el("bib-scope-meine").textContent).toBe(soll[1]);
  expect(el("bib-scope-alle").textContent).toBe(soll[2]);
  expect(el("library-scope-bar").querySelector("fieldset")?.getAttribute("aria-label")).toBe(
    soll[0],
  );
  expect(el("library-scope-bar").textContent).toBe(soll[1] + soll[2]);
  expect(
    [...el("library-scope-bar").querySelectorAll("button")].map((b) => b.dataset.testid),
  ).toEqual(["bib-scope-meine", "bib-scope-alle"]);
}
beforeEach(() => {
  lage.zustand = "erfolgreich";
  localStorage.clear();
});
afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = undefined;
    container.remove();
    client.clear();
  }
  await i18n.changeLanguage("de");
  vi.restoreAllMocks();
});

describe("JOB 3489 · Ortszeile spricht die gewählte Sprache", () => {
  it.each(sprachen)(
    "Fall 1/2 · gemountete Beschriftungen und zugänglicher Gruppenname in %s",
    async (sprache) => {
      await mount(sprache);
      pruefeTexte(sprache);
    },
  );
  it("Fall 3 · DE → EN → DE hält Wahl, URL, Trefferzahl und eigene Treffermenge", async () => {
    await mount("de");
    expect(container.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(3);
    await act(async () => el("bib-scope-meine").click());
    const vorher = el("bib-fuss").textContent;
    expect(vorher).toBe("1 Eintrag");
    const adresse = container.querySelector("[data-adresse]")?.getAttribute("data-adresse");
    expect(new URLSearchParams(adresse ?? "").get("raum")).toBe("meine");
    for (const sprache of ["en", "de"]) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      pruefeTexte(sprache);
      expect(el("bib-scope-meine").getAttribute("aria-pressed")).toBe("true");
      expect(el("bib-scope-alle").getAttribute("aria-pressed")).toBe("false");
      expect(el("library-scope-bar").dataset.raum).toBe("meine");
      expect(container.querySelector("[data-adresse]")?.getAttribute("data-adresse")).toBe(adresse);
      expect(container.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(1);
      expect(el("bib-zeile").textContent).toContain("Eigener Beitrag");
      expect(el("bib-fuss").textContent).toBe(sprache === "en" ? "1 entry" : vorher);
    }
    await act(async () => el("bib-scope-alle").click());
    expect(container.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(3);
  });
  it.each(sprachen)(
    "Fall 4 · Katalogwerte in %s existieren ohne Rückfall und unterscheiden sich von DE",
    (sprache) => {
      expect(sprachen.sort()).toEqual(Object.keys(worte).sort());
      for (const key of schluessel) {
        const wert: unknown = i18n.getResource(sprache, "translation", key);
        expect(typeof wert, key).toBe("string");
        expect(String(wert).trim(), key).not.toBe("");
        if (sprache !== "de")
          expect(wert, key).not.toBe(i18n.getResource("de", "translation", key));
      }
    },
  );
  it("Fall 5 · keine deutschen Beschriftungen mehr in Zugehörigkeitsmodul und Ortszeile", () => {
    // JOB 3565 · Lieferung 1 — geprüft werden CODEZEILEN, nicht Kommentare. Der Fall verbot die drei
    // Wortlaute zuvor im GANZEN Dateiinhalt und war damit strenger als sein Auftrag (JOB 3489 §5.3:
    // „keine deutschen ANZEIGETEXTE"). Genau das hat Pedis Begründung aus dem Kopf der Datei
    // vertrieben (`archiv/3489/runde-1/ben.md:35`). Die Absicht bleibt scharf: ein deutsches
    // Anzeigetext-Literal im Code macht den Fall weiterhin rot — Gegenprobe (a) in der Rückgabe.
    const modul = ohneKommentare(
      readFileSync(repoPfad("apps/web/src/lib/libraryOwnScope.ts"), "utf8"),
    );
    const flaeche = readFileSync(
      repoPfad("apps/web/src/components/bibliothek/BibliothekFlaeche.tsx"),
      "utf8",
    );
    const ort = flaeche.slice(flaeche.indexOf("ortszeile={"), flaeche.indexOf("segment={segment}"));
    expect(ort).toContain('data-testid="library-scope-bar"');
    for (const wort of worte.de) {
      expect(modul).not.toContain(wort);
      expect(ort).not.toContain(wort);
    }
  });
  it("Fall 6 · Pedis Wortlaut steht wörtlich im Zugehörigkeitsmodul", () => {
    // Der Kommentarkopf darf umbrechen, wie er will — verglichen wird der FLIESSTEXT: Zeilenpräfixe
    // (`//`, `*`) fallen weg, Folgen von Leerraum werden zu einem Leerzeichen.
    const fliesstext = readFileSync(repoPfad("apps/web/src/lib/libraryOwnScope.ts"), "utf8")
      .replace(/^[ \t]*(\/\/|\*)[ \t]?/gm, "")
      .replace(/\s+/g, " ");
    expect(fliesstext).toContain(PEDIS_SATZ);
  });
  it("Fall 7 · genau drei geführte Sprachen — die Prüfmenge kann nicht lautlos schrumpfen", () => {
    // AUSSERHALB jedes `it.each`: `sprachen` speist Fall 1/2, Fall 4 und die 18 Zustandsfälle. Wäre
    // `i18n.options.resources` leer oder nachgeladen, verschwänden die alle spurlos — dieser Fall
    // ist der einzige, der das rot macht (Codex zu JOB 3489, `ben.md:29`/`:43`).
    expect([...sprachen].sort()).toEqual([...GEFUEHRTE_SPRACHEN].sort());
  });
  it.each(scannerProben)("Fall 9 · Kommentarentfernung: %s", (name, quelle, erwartet) => {
    expect(ohneKommentare(quelle).includes("Meine Ablage"), name).toBe(erwartet);
  });
  it("Fall 8 · `lib.menue.geltungsbereich` ist in keiner Sprache mehr bekannt", () => {
    // Gemessen vor dem Löschen: der Schlüssel trug in allen drei Sprachen exakt die Werte von
    // `lib.ownScope.label` und hatte ausserhalb von `i18n.ts` keinen einzigen Verbraucher
    // (`grep -rn "lib.menue.geltungsbereich" apps services tests tests-smoke extensions`).
    for (const sprache of GEFUEHRTE_SPRACHEN) {
      expect(
        i18n.getResource(sprache, "translation", "lib.menue.geltungsbereich"),
        sprache,
      ).toBeUndefined();
      // Die verbleibende eine Stelle bleibt bedienbar — sonst wäre das Löschen ein Verlust.
      expect(typeof i18n.getResource(sprache, "translation", "lib.ownScope.label"), sprache).toBe(
        "string",
      );
    }
  });
  describe.each(sprachen)("Zustandsmodell in %s", (sprache) => {
    it.each(["laden", "leer", "Fehler", "Cache laufend", "Cache gescheitert", "offline"])(
      "%s · Texte bleiben sichtbar und Scope bedienbar",
      async (zustand) => {
        lage.zustand = zustand;
        await mount(sprache);
        pruefeTexte(sprache);
        expect(el("library-scope-bar").closest("[hidden]")).toBeNull();
        expect(el("library-scope-bar").querySelector("[disabled]")).toBeNull();
        await act(async () => el("bib-scope-meine").click());
        expect(el("library-scope-bar").dataset.raum).toBe("meine");
        pruefeTexte(sprache);
        if (zustand.startsWith("Cache")) {
          expect(container.querySelectorAll('[data-testid="bib-zeile"]')).toHaveLength(1);
          expect(el("bib-zeile").textContent).toContain("Eigener Beitrag");
        }
      },
    );
  });
});
