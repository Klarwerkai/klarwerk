// @vitest-environment jsdom
// UX-29 C: echter Menütext, echte Sitzungstrennung und Speicherfehler; nur Datenabruf ersetzt.
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
import { LIBRARY_RESULT_LIMIT } from "../../apps/web/src/lib/libraryDisplay";
import { LIBRARY_SAVED_VIEW_DIMENSIONS } from "../../apps/web/src/lib/librarySavedViewState";
import { LIBRARY_SORT_STORAGE_KEY } from "../../apps/web/src/lib/librarySort";
import {
  menueEintrag,
  menueOeffnen,
  menueSchliessen,
  segment,
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

// Textsuche, kein title-/Tooltip-Treffer. Der Text muss im geöffneten Untermenü stehen.
function hinweis(): HTMLElement {
  const menu = menueOeffnen(container, "bib-liste-menue");
  const nodes = [...menu.querySelectorAll<HTMLElement>("p")].filter((p) =>
    /^(Sichten bleiben|Views stay)/.test(p.textContent ?? ""),
  );
  if (nodes.length === 0) throw new Error("unable to find an element: sichtbarer Speicherhinweis");
  expect(nodes).toHaveLength(1);
  const node = nodes[0] as HTMLElement;
  expect(node.closest("details")?.open).toBe(true);
  expect(node.closest("details")?.querySelector("summary")?.textContent).toContain(
    String(i18n.t("lib.menue.sichten")),
  );
  expect(node.closest('[hidden], [aria-hidden="true"]')).toBeNull();
  expect(getComputedStyle(node).display).not.toBe("none");
  expect(getComputedStyle(node).visibility).not.toBe("hidden");
  return node;
}
function text(): string {
  return hinweis().textContent ?? "";
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

describe("UX-29 C · Speicherhinweis auf der Bibliotheksfläche", () => {
  it("H1 · angemeldet: sichtbarer Text nennt Browser, Anmeldung, fehlende Übertragung und Löschfolge", () => {
    mount();
    expect(text()).toContain("nur in diesem Browser");
    expect(text()).toContain("deiner aktuellen Anmeldung");
    expect(text()).toContain("nicht auf dem Server");
    expect(text()).toContain("nicht auf andere Geräte oder Browser übertragen");
    expect(text()).toContain("Browserdaten löscht, löscht auch die Sichten");
  });

  it("H2 · jede typgebundene Dimension erscheint übersetzt im selben Textknoten", () => {
    mount();
    const visible = text();
    expect(Object.keys(LIBRARY_SAVED_VIEW_DIMENSIONS).length).toBeGreaterThan(0);
    for (const key of Object.values(LIBRARY_SAVED_VIEW_DIMENSIONS)) {
      const label: unknown = i18n.getResource("de", "translation", key);
      expect(typeof label, key).toBe("string");
      expect(visible).toContain(label);
    }
  });

  it("H3 · Sortierung und Fenstergröße sind nicht enthalten; Aufrufen beschreibt das echte A/B-Verhalten", () => {
    mount();
    expect(text()).toContain("Nicht gespeichert: Sortierung und Fenstergröße („Mehr laden“)");
    expect(text()).toContain("Sortierung bleibt beim Aufrufen unverändert");
    expect(text()).toContain("Fenstergröße beginnt neu");
  });

  it("H4 · ohne Sitzung gilt die Liste für alle ohne Anmeldung; Sitzungswechsel tauscht den Hinweis", () => {
    session.id = "";
    mount();
    expect(text()).toContain(
      "Ohne Anmeldung gilt die Liste für alle, die diesen Browser ohne Anmeldung benutzen",
    );
    expect(text()).not.toContain("deiner aktuellen Anmeldung");
    session.id = "u1";
    render();
    expect(text()).toContain("deiner aktuellen Anmeldung");
    expect(text()).not.toContain("Ohne Anmeldung gilt");
    session.id = "";
    render();
    expect(text()).not.toContain("deiner aktuellen Anmeldung");
  });

  it("H5 · Lesefehler ändert die Mechanikauskunft nicht; Speicherfehler bleibt daneben sichtbar", () => {
    mount("/bibliothek?raum=meine");
    const vorher = text();
    act(() => root.unmount());
    container.remove();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Speicher gesperrt");
    });
    mount("/bibliothek?raum=meine");
    expect(text()).toBe(vorher);
    expect(text()).not.toMatch(/keine Sichten|\d+ Sichten|erfolgreich gespeichert/);
    tippe(element<HTMLInputElement>("#bib-sichtname"), "Versuch");
    click(element('[data-testid="bib-sicht-speichern"]'));
    expect(element('[role="alert"]').textContent).toBe(String(i18n.t("state.error")));
    expect(text()).toBe(vorher);
  });

  it.each(["u1", ""])("H6 · EN vollständig, mit Sitzung %s und ohne deutschen Rest", async (id) => {
    await i18n.changeLanguage("en");
    session.id = id;
    mount();
    const visible = text();
    expect(visible).toContain("only in this browser");
    expect(visible).toContain("not stored on the server");
    expect(visible).toContain("not transferred to other devices or browsers");
    expect(visible).toContain("Clearing browser data also deletes the views");
    expect(visible).toContain(
      id ? "your current sign-in" : "everyone using this browser without signing in",
    );
    if (!id) expect(visible).not.toContain("your current sign-in");
    expect(visible).toContain("Not saved: sort order and window size (“Load more”)");
    expect(visible).toContain("sort order stays unchanged when loading a view");
    expect(visible).toContain("window size starts over");
    for (const key of Object.values(LIBRARY_SAVED_VIEW_DIMENSIONS)) {
      const label: unknown = i18n.getResource("en", "translation", key);
      expect(typeof label, key).toBe("string");
      expect(visible).toContain(label);
      expect(visible).not.toContain(key);
    }
    expect(visible).not.toMatch(
      /Sichten|Anmeldung|Suchbegriff|Filterauswahl|Zeitraum|Gruppierung|Bereich|Sortierung|Fenstergröße|Mehr laden/,
    );
  });

  it("H7 · Löschpunkt benennt auch nach einer Filteränderung weiterhin seine Zielsicht (LEHREN 3137)", () => {
    localStorage.setItem(KEY, JSON.stringify([{ name: "Wartung", state: { scope: "meine" } }]));
    mount();
    click(menueEintrag(menueOeffnen(container, "bib-liste-menue"), "Wartung"));
    segment(container, "offen");
    const menu = menueOeffnen(container, "bib-liste-menue");
    expect(menueEintrag(menu, "Wartung").getAttribute("aria-checked")).toBe("false");
    expect(menueEintrag(menu, String(i18n.t("lib.views.remove"))).textContent).toContain("Wartung");
  });

  it("H8 · A/B-Grenze gemessen: Aufrufen erhält die neue Sortierung und setzt das nachgeladene Fenster zurück", () => {
    const original = [...KOS];
    const muster = KOS[0] as KnowledgeObject;
    KOS.splice(
      0,
      KOS.length,
      ...Array.from({ length: LIBRARY_RESULT_LIMIT + 1 }, (_, index) => ({
        ...muster,
        id: `objekt-${index}`,
        trust: 1 - index / (LIBRARY_RESULT_LIMIT + 1),
        title: `Wartung ${String(LIBRARY_RESULT_LIMIT - index).padStart(3, "0")}`,
      })),
    );
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(20_000);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);
    try {
      localStorage.setItem(LIBRARY_SORT_STORAGE_KEY, "trust");
      mount("/bibliothek?raum=meine");
      const ids = () =>
        [...container.querySelectorAll('[data-testid="bib-zeile"]')].map((el) =>
          el.getAttribute("data-bib-id"),
        );
      expect(ids()).toHaveLength(LIBRARY_RESULT_LIMIT);
      expect(ids()[0]).toBe("objekt-0");
      menueOeffnen(container, "bib-liste-menue");
      tippe(element<HTMLInputElement>("#bib-sichtname"), "Fenster");
      click(element('[data-testid="bib-sicht-speichern"]'));
      waehleImMenue(container, "bib-menue-filter", String(i18n.t("lib.sort.title")));
      expect(ids()[0]).toBe(`objekt-${LIBRARY_RESULT_LIMIT}`);
      // JOB 3488: die Rollspur wird über ihre MARKE gegriffen, nicht über die Baumlage der Zeile.
      // Bis hierher stand hier `element('[data-testid="bib-zeile"]').parentElement` — eine Annahme
      // über den Aufbau der Liste, und genau die ist mit dem Vorschau-Aufklapper gefallen: die
      // Zeile ist jetzt ein BLOCK aus Zeilenknopf und Umschalter, der Elternknoten der Zeile ist
      // also der Block und nicht mehr die Spur. Ein `scroll`-Ereignis STEIGT NICHT AUF, der Griff
      // lief damit ins Leere und das Nachladen blieb aus (gemessen: 200 statt 201 Zeilen). Die
      // Marke `bib-spur` steht in `BibliothekListe.tsx` ausdrücklich dafür, das rollende Element
      // von aussen zu finden, ohne seinen Aufbau zu kennen — dieselbe Marke, die auch
      // `BibliothekFlaeche.tsx` (`listenRoller`) benutzt. Gemessen wird unverändert dasselbe.
      const scroll = element('[data-testid="bib-spur"]');
      act(() => {
        scroll.scrollTop = 19_500;
        scroll.dispatchEvent(new Event("scroll"));
      });
      expect(ids()).toHaveLength(LIBRARY_RESULT_LIMIT + 1);
      scroll.scrollTop = 0;
      click(menueEintrag(menueOeffnen(container, "bib-liste-menue"), "Fenster"));
      expect(ids()).toHaveLength(LIBRARY_RESULT_LIMIT);
      expect(ids()[0]).toBe(`objekt-${LIBRARY_RESULT_LIMIT}`);
      expect(localStorage.getItem(LIBRARY_SORT_STORAGE_KEY)).toBe("title");
      expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")[0].state).not.toHaveProperty("sortKey");
      expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")[0].state).not.toHaveProperty(
        "windowLimit",
      );
      expect(text()).toContain("Fenstergröße beginnt neu");
    } finally {
      KOS.splice(0, KOS.length, ...original);
    }
  });

  it("H9 · NL-Spiegel liefert Mechanik und Dimensionen ohne deutschen Rückfall", async () => {
    await i18n.changeLanguage("nl");
    session.id = "";
    mount();
    const menu = menueOeffnen(container, "bib-liste-menue");
    const visible = menu.querySelector('[data-testid="bib-sichten-hinweis"]')?.textContent ?? "";
    expect(visible).toContain("alleen in deze browser");
    expect(visible).toContain("iedereen die deze browser zonder aanmelding gebruikt");
    expect(visible).toContain("Niet opgeslagen: sortering en venstergrootte");
    for (const key of Object.values(LIBRARY_SAVED_VIEW_DIMENSIONS)) {
      const label: unknown = i18n.getResource("nl", "translation", key);
      expect(typeof label, key).toBe("string");
      expect(visible).toContain(label);
    }
    expect(visible).not.toMatch(/Sichten|Anmeldung|Sortierung|Fenstergröße/);
  });

  it("H10 · laufender Abruf und Offlinezustand lassen die Mechanikauskunft stehen", () => {
    mount();
    const vorher = text();
    menueSchliessen(container, "bib-liste-menue");
    session.bestandBestaetigt = false;
    render();
    expect(text()).toBe(vorher);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(text()).toBe(vorher);
  });
});
