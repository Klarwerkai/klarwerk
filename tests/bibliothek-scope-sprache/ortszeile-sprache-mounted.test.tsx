// @vitest-environment jsdom
import { readFileSync } from "node:fs";
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
const schluessel = ["lib.ownScope.label", "lib.ownScope.meine", "lib.ownScope.alle"];
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
    const modul = readFileSync(repoPfad("apps/web/src/lib/libraryOwnScope.ts"), "utf8");
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
