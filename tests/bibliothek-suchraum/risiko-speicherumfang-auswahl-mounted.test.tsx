// @vitest-environment jsdom
// ================================================================================================
// BEN-NACHARBEIT 2 — DREI BELEGTE LÜCKEN, JE EINE GEGENPROBE.
// ================================================================================================
//   K16 (R-1006): Sortierung nach Risiko — im Sortiermodell UND im Menü, Reihenfolge an
//                 unterschiedlich riskanten Wissensobjekten gemessen.
//   K26 (N-0060): der Speicherumfang steht direkt im Untermenü „Sicht speichern", nicht nur im
//                 getrennten Untermenü „Sichten".
//   K27 (N-0074): ein ausdrücklich geöffneter Beitrag, den Facetten, Umschalter oder Bereich aus
//                 der Treffermenge ausschliessen, wird auf der Lesefläche als ausserhalb markiert.
//
// Gemessen an der gemounteten `BibliothekFlaeche`, nur der Datenabruf ist ersetzt — dieselbe Bauform
// wie `tests/bibliothek-sichten/sichten-hinweis-mounted.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

const session = vi.hoisted(() => ({ id: "u1" }));

function ko(
  id: string,
  title: string,
  status: "offen" | "validiert",
  trust: number,
  extra: Partial<KnowledgeObject> = {},
): KnowledgeObject {
  return {
    id,
    title,
    statement: "Wartung",
    type: "best_practice",
    category: "Anlage A",
    tags: ["Wartung"],
    status,
    author: "u2",
    originalAuthor: "u2",
    assignments: [],
    neededValidations: 2,
    asset: null,
    trust,
    confidence: 0,
    version: 1,
    conditions: [],
    measures: [],
    createdAt: "2026-08-20T00:00:00.000Z",
    history: [{ version: 1, author: "u2", at: "2026-08-20T00:00:00.000Z", note: "erstellt" }],
    ...extra,
  } as unknown as KnowledgeObject;
}

// Fünf Objekte, deren Risiko-Reihenfolge sich von jeder anderen Sortierung unterscheidet:
//   zu prüfen (offen, ohne Zuweisung)   → zuerst, darin Vertrauen niedrig zuerst
//   in Prüfung (offen, mit Zuweisung)   → danach
//   nutzbar (validiert)                 → zuletzt, darin Vertrauen niedrig zuerst
const KOS: KnowledgeObject[] = [
  ko("v90", "A Ventil freigegeben hoch", "validiert", 90),
  ko("p50", "B Ventil in Prüfung", "offen", 50, { assignments: ["u3"] }),
  ko("o80", "C Ventil offen hoch", "offen", 80),
  ko("o10", "D Ventil offen niedrig", "offen", 10),
  ko("v20", "E Ventil freigegeben niedrig", "validiert", 20, { category: "Anlage B" }),
];
const RISIKO_REIHENFOLGE = ["o10", "o80", "p50", "v20", "v90"];

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({
    data,
    isLoading: false,
    isError: false,
    isRefetchError: false,
    isFetching: false,
    isStale: false,
    fetchStatus: "idle",
    dataUpdatedAt: 100,
    refetch: async () => ({}),
  });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useConflicts: () => ok([]),
    useDirectory: () => ok([]),
    useKo: () => ({ ...ok(undefined), isLoading: true }),
    useEigeneBefunde: () => ok([]),
    useAudit: () => ok([]),
    koQueryKey: (id: string) => ["ko", id],
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: session.id ? { id: session.id, role: "experte" } : null }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import i18n from "../../apps/web/src/i18n";
import {
  LIBRARY_SORT_KEYS,
  LIBRARY_SORT_LABEL_KEYS,
  LIBRARY_SORT_STORAGE_KEY,
  sortLibrary,
} from "../../apps/web/src/lib/librarySort";
import { menueOeffnen, waehleImMenue } from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function mount(entry = "/bibliothek"): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [entry] }, createElement(BibliothekFlaeche)),
      ),
    );
  });
}

const zeilenIds = (): (string | null)[] =>
  [...container.querySelectorAll('[data-testid="bib-zeile"]')].map((z) =>
    z.getAttribute("data-bib-id"),
  );
const ausserhalb = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="bib-lesen-ausserhalb"]');

beforeEach(async () => {
  await i18n.changeLanguage("de");
  session.id = "u1";
  window.localStorage.clear();
});
afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("K16 · Sortierung nach Risiko", () => {
  it("R1 · das Sortiermodell kennt „risk“, mit eigenem Text in DE/EN/NL", () => {
    expect(LIBRARY_SORT_KEYS).toContain("risk");
    expect(LIBRARY_SORT_LABEL_KEYS.risk).toBe("lib.sort.risk");
    for (const sprache of ["de", "en", "nl"] as const) {
      const wert: unknown = i18n.getResource(sprache, "translation", "lib.sort.risk");
      expect(typeof wert, sprache).toBe("string");
    }
    expect(i18n.getResource("en", "translation", "lib.sort.risk")).not.toBe(
      i18n.getResource("de", "translation", "lib.sort.risk"),
    );
  });

  it("R2 · rein: zu prüfen vor in Prüfung vor nutzbar, darin Vertrauen niedrig zuerst", () => {
    const sortiert = sortLibrary(KOS, "risk", (k) => k).map((k) => k.id);
    expect(sortiert).toEqual(RISIKO_REIHENFOLGE);
    // Kalibrierung: die Reihenfolge ist keine der vorhandenen Sortierungen.
    expect(sortLibrary(KOS, "trust", (k) => k).map((k) => k.id)).not.toEqual(RISIKO_REIHENFOLGE);
    expect(sortLibrary(KOS, "title", (k) => k).map((k) => k.id)).not.toEqual(RISIKO_REIHENFOLGE);
    // Das Original bleibt unberührt.
    expect(KOS.map((k) => k.id)).toEqual(["v90", "p50", "o80", "o10", "v20"]);
  });

  it("R3 · gemountet: der Menüpunkt steht im Menü „Filter“ und ordnet die Liste nach Risiko", () => {
    mount();
    expect(zeilenIds()).not.toEqual(RISIKO_REIHENFOLGE);
    waehleImMenue(container, "bib-menue-filter", String(i18n.t("lib.sort.risk")));
    expect(zeilenIds()).toEqual(RISIKO_REIHENFOLGE);
    expect(window.localStorage.getItem(LIBRARY_SORT_STORAGE_KEY)).toBe("risk");
  });
});

describe("K26 · Speicherumfang direkt bei „Sicht speichern“", () => {
  function umfang(): HTMLElement {
    const menue = menueOeffnen(container, "bib-liste-menue");
    const el = menue.querySelector<HTMLElement>('[data-testid="bib-sicht-speichern-umfang"]');
    if (!el) throw new Error("Speicherumfang fehlt im Untermenü „Sicht speichern“");
    return el;
  }

  it("U1 · angemeldet: der Satz steht im Untermenü „Sicht speichern“ neben Feld und Knopf", () => {
    mount("/bibliothek?zustand=offen");
    const el = umfang();
    const details = el.closest("details");
    expect(details?.querySelector("summary")?.textContent).toContain(
      String(i18n.t("lib.menue.sichtSpeichern")),
    );
    expect(details?.open).toBe(true);
    expect(details?.querySelector("#bib-sichtname")).not.toBeNull();
    expect(el.closest('[hidden], [aria-hidden="true"]')).toBeNull();
    const text = el.textContent ?? "";
    expect(text).toContain("nur in diesem Browser");
    expect(text).toContain("nicht auf dem Server");
    expect(text).toContain("deiner aktuellen Anmeldung");
    const knopf = container.querySelector('[data-testid="bib-sicht-speichern"]');
    expect(knopf?.getAttribute("aria-describedby")).toBe(el.id);
  });

  it("U2 · ohne Anmeldung nennt der Satz die geteilte Browserliste", () => {
    session.id = "";
    mount("/bibliothek?zustand=offen");
    const text = umfang().textContent ?? "";
    expect(text).toContain("Ohne Anmeldung gilt die Liste");
    expect(text).not.toContain("deiner aktuellen Anmeldung");
  });

  it("U3 · EN: eigener Satz ohne deutschen Rest", async () => {
    await i18n.changeLanguage("en");
    mount("/bibliothek?zustand=offen");
    const text = umfang().textContent ?? "";
    expect(text).toContain("only in this browser");
    expect(text).not.toMatch(/Browser gespeichert|Anmeldung/);
  });
});

describe("K27 · geöffneter Beitrag ausserhalb der aktuellen Treffer", () => {
  it("A1 · Umschalter schliesst den geöffneten Beitrag aus ⇒ markiert", () => {
    mount("/bibliothek?eintrag=v90&zustand=offen");
    expect(zeilenIds()).not.toContain("v90");
    expect(ausserhalb()?.textContent).toBe(String(i18n.t("lib.lesen.ausserhalbTreffer")));
    // Natives <output> = implizite Rolle „status" (Live-Region), ohne ARIA-Nachbau.
    expect(ausserhalb()?.tagName).toBe("OUTPUT");
    expect(ausserhalb()?.hasAttribute("role")).toBe(false);
  });

  it("A2 · Facette schliesst ihn aus ⇒ markiert", () => {
    mount("/bibliothek?eintrag=v90&category=Anlage+B");
    expect(zeilenIds()).toEqual(["v20"]);
    expect(ausserhalb()).not.toBeNull();
  });

  it("A3 · Bereich „Meine Ablage“ schliesst den fremden Beitrag aus ⇒ markiert", () => {
    mount("/bibliothek?eintrag=v90&raum=meine");
    expect(zeilenIds()).not.toContain("v90");
    expect(ausserhalb()).not.toBeNull();
  });

  it("A4 · KALIBRIERUNG: liegt der Beitrag in den Treffern, steht keine Markierung", () => {
    mount("/bibliothek?eintrag=o10&zustand=offen");
    expect(zeilenIds()).toContain("o10");
    expect(ausserhalb()).toBeNull();
  });

  it("A5 · KALIBRIERUNG: ohne ausdrückliche Wahl (Vorwahl) keine Markierung", () => {
    mount("/bibliothek?zustand=offen");
    expect(ausserhalb()).toBeNull();
  });
});
