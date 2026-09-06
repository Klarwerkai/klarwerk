// @vitest-environment jsdom
// P04: echte Fläche, Liste, Menüs, URL und Persistenz. Nur der Datenabruf ist ersetzt;
// Segment, Eigentum, Facetten und Zeitfenster werden ausschließlich im Produkt gefiltert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

const session = vi.hoisted(() => ({ id: "u1", bestandBestaetigt: true }));
const KOS = (
  [
    ["eigen-frei", "u1", "validiert", "Anlage A", "2026-08-20"],
    ["eigen-offen", "u1", "offen", "Anlage A", "2026-08-20"],
    ["fremd-frei", "u2", "validiert", "Anlage A", "2026-08-20"],
    ["fremd-offen", "u2", "offen", "Anlage A", "2026-08-20"],
    ["andere-anlage", "u1", "validiert", "Anlage B", "2026-08-20"],
    ["alter-eintrag", "u1", "validiert", "Anlage A", "2025-01-01"],
  ] as const
).map(
  ([id, author, status, category, date]): KnowledgeObject => ({
    id,
    title: `Ventil ${id}`,
    statement: "Wartung",
    type: "best_practice",
    category,
    tags: ["Wartung", "Technik"],
    status,
    author,
    originalAuthor: author,
    assignments: [],
    neededValidations: 2,
    asset: null,
    trust: 0,
    confidence: 0,
    version: 1,
    conditions: [],
    measures: [],
    createdAt: `${date}T00:00:00.000Z`,
    history: [{ version: 1, author, at: `${date}T00:00:00.000Z`, note: "erstellt" }],
  }),
);
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
    useKos: () => ({
      ...ok(KOS),
      isStale: !session.bestandBestaetigt,
      isFetching: !session.bestandBestaetigt,
    }),
    useLibrarySearch: ({ q }: { q?: string }) => ok(KOS.filter((k) => !q || k.title.includes(q))),
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
  menueEintrag,
  menueOeffnen,
  menueSchliessen,
  segment,
  suche,
  tippe,
  waehleImMenue,
} from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const KEY = "klarwerk.library.views.u1";
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let render: () => void;
function mount(entry = "/bibliothek"): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render = () =>
    act(() =>
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(
            MemoryRouter,
            { initialEntries: [entry] },
            createElement(BibliothekFlaeche),
          ),
        ),
      ),
    );
  render();
}
function click(el: HTMLElement): void {
  act(() => el.click());
}
function element<T extends HTMLElement>(selector: string): T {
  const el = container.querySelector<T>(selector);
  if (!el) throw new Error(`Element fehlt: ${selector}`);
  return el;
}
function scope(value: string): void {
  click(element(`[data-testid="bib-scope-${value}"]`));
}
function ids(): string[] {
  return [...container.querySelectorAll('[data-testid="bib-zeile"]')]
    .map((el) => el.getAttribute("data-bib-id") ?? "")
    .sort();
}
function save(name: string): void {
  menueOeffnen(container, "bib-liste-menue");
  tippe(element("#bib-sichtname"), name);
  click(element('[data-testid="bib-sicht-speichern"]'));
}
function load(name: string): void {
  click(menueEintrag(menueOeffnen(container, "bib-liste-menue"), name));
}
function checked(name: string): boolean {
  const result =
    menueEintrag(menueOeffnen(container, "bib-liste-menue"), name).getAttribute("aria-checked") ===
    "true";
  menueSchliessen(container, "bib-liste-menue");
  return result;
}
async function debounce(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 360));
  });
}
beforeEach(async () => {
  await i18n.changeLanguage("de");
  session.id = "u1";
  session.bestandBestaetigt = true;
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  if (root) act(() => root.unmount());
  container?.remove();
});

describe("P04 · gespeicherte Filterlage auf der echten Bibliotheksfläche", () => {
  it("A1 · Speichern, abweichend einstellen, Aufrufen: Segment UND Scope stellen dieselben Treffer her", () => {
    mount();
    scope("meine");
    segment(container, "validiert");
    const vorher = ids();
    expect(vorher).toEqual(["alter-eintrag", "andere-anlage", "eigen-frei"]);
    save("Freigaben");
    scope("alle");
    segment(container, "offen");
    expect(ids()).toEqual(["eigen-offen", "fremd-offen"]);
    load("Freigaben");
    expect(ids()).toEqual(vorher);
    expect(element('[data-testid="bib-scope-meine"]').getAttribute("aria-pressed")).toBe("true");
    expect(element('[data-testid="bib-segment-validiert"]').getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")[0].state).toMatchObject({
      segment: "validiert",
      scope: "meine",
    });
  });

  it("A2 · neuer Mount stellt auch Suche, Facetten, Zeitraum und Gruppierung wieder her", async () => {
    mount("/bibliothek?q=Ventil&category=Anlage+A&von=2026-08-01&bis=2026-08-31");
    scope("meine");
    segment(container, "validiert");
    const menu = menueOeffnen(container, "bib-menue-filter");
    const gruppe = [...menu.querySelectorAll("details")].find((d) =>
      d.querySelector("summary")?.textContent?.includes(String(i18n.t("lib.groupBy.label"))),
    );
    click(menueEintrag(gruppe as HTMLElement, String(i18n.t("lib.facet.category"))));
    menueSchliessen(container, "bib-menue-filter");
    expect(ids()).toEqual(["eigen-frei"]);
    save("Präzise");
    act(() => root.unmount());
    container.remove();
    mount("/bibliothek?q=ander&zustand=offen");
    load("Präzise");
    await debounce();
    expect(ids()).toEqual(["eigen-frei"]);
    expect(element<HTMLInputElement>('[data-testid="bib-suche"]').value).toBe("Ventil");
    expect(element('[data-testid="bib-menue-bereich"]').textContent).toContain("1");
    menueOeffnen(container, "bib-menue-filter");
    expect(element<HTMLInputElement>("#bib-von").value).toBe("2026-08-01");
    expect(element<HTMLInputElement>("#bib-bis").value).toBe("2026-08-31");
    expect(container.querySelector('[data-testid="bib-gruppenkopf"]')).not.toBeNull();
    expect(checked("Präzise")).toBe(true);
  });

  it.each(["segment", "scope", "q", "facet", "range", "groupBy"])(
    "B1 · manuell %s ändern entfernt Häkchen, Rückkehr zeigt es wieder",
    async (field) => {
      mount();
      scope("meine");
      save("Aktuell");
      expect(checked("Aktuell")).toBe(true);
      const change = (back: boolean) => {
        if (field === "segment") segment(container, back ? "alle" : "offen");
        if (field === "scope") scope(back ? "meine" : "alle");
        if (field === "q") suche(container, back ? "" : "eigen");
        if (field === "facet") waehleImMenue(container, "bib-menue-bereich", "Anlage A");
        if (field === "range") {
          menueOeffnen(container, "bib-menue-filter");
          tippe(element("#bib-von"), back ? "" : "2026-01-01");
          menueSchliessen(container, "bib-menue-filter");
        }
        if (field === "groupBy") {
          const m = menueOeffnen(container, "bib-menue-filter");
          const g = [...m.querySelectorAll("details")].find((d) =>
            d.querySelector("summary")?.textContent?.includes(String(i18n.t("lib.groupBy.label"))),
          );
          click(
            menueEintrag(
              g as HTMLElement,
              String(i18n.t(back ? "lib.groupBy.none" : "lib.facet.category")),
            ),
          );
          menueSchliessen(container, "bib-menue-filter");
        }
      };
      change(false);
      expect(checked("Aktuell")).toBe(false);
      change(true);
      await debounce();
      expect(checked("Aktuell")).toBe(true);
    },
  );

  it("B2 · gleiche Facettenmenge in anderer Klickreihenfolge bleibt dieselbe Sicht", () => {
    mount();
    waehleImMenue(container, "bib-menue-bereich", "Anlage A");
    waehleImMenue(container, "bib-menue-bereich", "Anlage B");
    save("Beide");
    waehleImMenue(container, "bib-menue-bereich", "Anlage A");
    expect(checked("Beide")).toBe(false);
    waehleImMenue(container, "bib-menue-bereich", "Anlage A");
    expect(checked("Beide")).toBe(true);
  });

  it("A3 · Alt-Sicht setzt sichere Standards alle/alle und erhält die Statusmigration", () => {
    localStorage.setItem(KEY, JSON.stringify([{ name: "Alt", state: { status: "offen" } }]));
    mount("/bibliothek?raum=meine&zustand=validiert");
    load("Alt");
    expect(ids()).toEqual(["eigen-offen", "fremd-offen"]);
    expect(element('[data-testid="bib-scope-alle"]').getAttribute("aria-pressed")).toBe("true");
    expect(element('[data-testid="bib-segment-alle"]').getAttribute("aria-pressed")).toBe("true");
    expect(checked("Alt")).toBe(true);
  });

  it("A4 · Nutzerwechsel lässt weder Sichtnamen noch Löschziel oder Namenseingabe übergreifen", () => {
    localStorage.setItem(
      "klarwerk.library.views.u2",
      JSON.stringify([{ name: "Andere", state: { scope: "meine" } }]),
    );
    mount();
    scope("meine");
    save("Privat");
    menueOeffnen(container, "bib-liste-menue");
    tippe(element("#bib-sichtname"), "Entwurf u1");
    session.id = "u2";
    render();
    const m = menueOeffnen(container, "bib-liste-menue");
    expect(m.textContent).not.toContain("Privat");
    expect(m.textContent).not.toContain(String(i18n.t("lib.views.remove")));
    expect(element<HTMLInputElement>("#bib-sichtname").value).toBe("");
    load("Andere");
    expect(ids()).toEqual(["fremd-frei", "fremd-offen"]);
    session.id = "";
    render();
    expect(menueOeffnen(container, "bib-liste-menue").textContent).not.toContain("Andere");
    session.id = "u1";
    render();
    load("Privat");
    expect(ids()).toEqual(["alter-eintrag", "andere-anlage", "eigen-frei", "eigen-offen"]);
  });

  it("A5 · ungeprüfte URL-Restwerte bleiben nach Filterklick vom Speichern ausgeschlossen", () => {
    session.bestandBestaetigt = false;
    mount("/bibliothek?tag=gibt-es-nicht&tag=Wartung");
    waehleImMenue(container, "bib-menue-filter", "Wartung");
    save("Ungeprüft");
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(element<HTMLButtonElement>('[data-testid="bib-sicht-speichern"]').disabled).toBe(true);
  });
  it("A6 · kaputte Felder und einzelne Fremdformate gefährden weder Seite noch andere Sichten", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        null,
        { name: "Array", state: [] },
        { name: "Gesund", state: { scope: "meine" } },
        {
          name: "Kaputt",
          state: {
            q: 42,
            segment: { value: "offen" },
            scope: "raum-geheim",
            groupBy: ["category"],
            range: { from: 42, to: "kaputt" },
            facetSel: { category: ["Anlage A", null, 42], fremderFilter: ["x"] },
          },
        },
      ]),
    );
    mount();
    load("Kaputt");
    expect(ids()).toEqual([
      "alter-eintrag",
      "eigen-frei",
      "eigen-offen",
      "fremd-frei",
      "fremd-offen",
    ]);
    expect(element<HTMLInputElement>('[data-testid="bib-suche"]').value).toBe("");
    expect(menueOeffnen(container, "bib-liste-menue").textContent).not.toContain("Array");
    load("Gesund");
    save("Neu");
    expect(
      JSON.parse(localStorage.getItem(KEY) ?? "[]").map((v: { name: string }) => v.name),
    ).toEqual(["Gesund", "Kaputt", "Neu"]);
  });

  it("A7 · widersprüchliche Alt-Facetten bleiben auch nach erneutem Speichern ohne Treffer", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { name: "Leer", state: { category: "Anlage A", facetSel: { category: ["Anlage B"] } } },
      ]),
    );
    mount();
    load("Leer");
    expect(ids()).toEqual([]);
    save("Weiter leer");
    waehleImMenue(container, "bib-menue-filter", String(i18n.t("facet.reset")));
    expect(ids()).toHaveLength(6);
    expect(checked("Weiter leer")).toBe(false);
    load("Weiter leer");
    expect(ids()).toEqual([]);
    expect(checked("Weiter leer")).toBe(true);
  });

  it.each(["{kaputt", '{"fremd":true}'])(
    "A8 · beschädigtes JSON/Fremdformat bleibt lesbar ausgeblendet und wird nicht überschrieben: %s",
    (raw) => {
      localStorage.setItem(KEY, raw);
      mount();
      expect(ids()).toHaveLength(6);
      scope("meine");
      save("Versuch");
      expect(localStorage.getItem(KEY)).toBe(raw);
      expect(element('[role="alert"]').textContent).toBe(String(i18n.t("state.error")));
      expect(element<HTMLInputElement>("#bib-sichtname").value).toBe("Versuch");
    },
  );

  it.each(["getItem", "setItem"] as const)(
    "A9 · %s-Ausfall nach Laden verliert keine Sicht; Wiederholung speichert erst nach Erfolg",
    (method) => {
      localStorage.setItem(KEY, JSON.stringify([{ name: "Bestand", state: { scope: "meine" } }]));
      mount();
      load("Bestand");
      const before = localStorage.getItem(KEY);
      const fail = vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error("Speicher gesperrt");
      });
      save("Neu");
      expect(element('[role="alert"]')).not.toBeNull();
      expect(menueOeffnen(container, "bib-liste-menue").textContent).toContain("Bestand");
      fail.mockRestore();
      expect(localStorage.getItem(KEY)).toBe(before);
      click(element('[data-testid="bib-sicht-speichern"]'));
      expect(
        JSON.parse(localStorage.getItem(KEY) ?? "[]").map((v: { name: string }) => v.name),
      ).toEqual(["Bestand", "Neu"]);
    },
  );

  it("A10 · fehlgeschlagenes Löschen lässt die gespeicherte Sicht und ihren Zugriff stehen", () => {
    localStorage.setItem(KEY, JSON.stringify([{ name: "Bestand", state: { scope: "meine" } }]));
    mount();
    load("Bestand");
    const before = localStorage.getItem(KEY);
    const fail = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Speicher voll");
    });
    click(
      menueEintrag(menueOeffnen(container, "bib-liste-menue"), String(i18n.t("lib.views.remove"))),
    );
    expect(element('[role="alert"]')).not.toBeNull();
    expect(localStorage.getItem(KEY)).toBe(before);
    fail.mockRestore();
    load("Bestand");
    expect(ids()).toHaveLength(4);
    click(
      menueEintrag(menueOeffnen(container, "bib-liste-menue"), String(i18n.t("lib.views.remove"))),
    );
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toEqual([]);
  });

  it("A11 · gesperrter localStorage-Zugriff verhindert nicht den Seitenzugang", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("Zugriff gesperrt");
    });
    mount();
    expect(ids()).toHaveLength(6);
    scope("meine");
    save("Versuch");
    expect(element('[role="alert"]')).not.toBeNull();
    expect(ids()).toHaveLength(4);
  });
});
