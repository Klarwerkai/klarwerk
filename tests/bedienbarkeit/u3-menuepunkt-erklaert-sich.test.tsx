// @vitest-environment jsdom
// ================================================================================================
// JOB 3028 · U3 — DER MENÜPUNKT SAGT VOR DEM KLICK, WAS HINTER IHM LIEGT.
// ================================================================================================
//
// Nataschas dritte Hürde (PRIORITAETEN.md P9): „Meine Aufgaben" ist systemzentriert benannt, und
// wer nicht geschult ist, erfährt erst NACH dem Klick, was dahinter liegt. Die Erklärungen dazu
// stehen seit SCRUM-219 als Hilfekapitel im Produkt — nur auf der Hilfeseite, also genau dort, wo
// jemand, der die Navigation nicht versteht, nicht als Erstes hinsieht.
//
// GEMESSEN WIRD AN DER GEMOUNTETEN FLÄCHE, nicht an `i18n.ts`. Ein Test, der nur nachschlägt, ob
// ein Schlüssel existiert, bewiese, dass ein Satz existiert — nicht, dass ihn jemand sieht. Das
// ist die Fehlerklasse, an der JOB 679 D1 gescheitert ist, und das Vorbild dieser Datei
// (`apps/web/src/pages/Library.origin-chip.test.tsx`) ist ihre Antwort.
//
// JEDER FALL PRÜFT BEIDE RICHTUNGEN. Ein Hinweis, der überall steht, sagt nichts: die Punkte OHNE
// Hilfekapitel müssen stumm bleiben (U3-3, U3-4), und die MENGE der Punkte mit Hinweis wird zur
// Laufzeit ausgerechnet statt aufgezählt (U3-5).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// „channel"-Mock wie bei `tests/app/nav-badges-*-mounted` — jeder queryFn-Aufruf bekommt ein
// frisches Promise, dessen Ausgang dieser Test steuert. Er braucht das für U3-6: der Hinweis darf
// in KEINER Zähler-Lage (lädt / gescheitert / veraltet) anders lauten.
const d = vi.hoisted(() => {
  const mk = () => {
    const state = { resolve: (_v: unknown) => {}, reject: (_e: unknown) => {} };
    const fn = vi.fn(
      () =>
        new Promise((resolve, reject) => {
          state.resolve = resolve;
          state.reject = reject;
        }),
    );
    return {
      fn,
      resolve: (v: unknown) => state.resolve(v),
      reject: (e: unknown) => state.reject(e),
    };
  };
  return { board: mk(), conflicts: mk(), duplicates: mk(), gaps: mk(), lifecycle: mk() };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // Rolle `admin` — zusammen mit dem Stufe-2-Schalter (unten) sind damit ALLE Menüpunkte
    // sichtbar (`canSee`, navigation.ts:341-346). Nur so ist die Mengenaussage in U3-5 vollständig.
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    validation: { board: d.board.fn },
    conflicts: { list: d.conflicts.fn },
    duplicates: { list: d.duplicates.fn },
    gaps: { summary: d.gaps.fn },
    lifecycle: { pending: d.lifecycle.fn },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { FOOT_ITEMS, NAV_GROUPS, type NavItem, canSee } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import { MobileNavDrawer } from "../../apps/web/src/shell/MobileNavDrawer";
import { Sidebar } from "../../apps/web/src/shell/Sidebar";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der persistierte Stufe-2-Umschalter (`lib/stufe2Storage.ts:7`). Admin + an ⇒ alles sichtbar. */
const STUFE2_KEY = "kw.stufe2.v1";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die echte Seitenleiste, mit echten Providern; einzige Attrappe ist die Endpunktgrenze. */
async function mountSidebar(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              NavGuardProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(Sidebar)),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // ZWEI Durchläufe, und das ist kein Aberglaube: `/auth/me` wird erst freigegeben, wenn
  // `/auth/status` erfolgreich ist (AuthContext.tsx:99). Nach nur einem Durchlauf steht die Rolle
  // noch auf dem Vorschau-Wert `experte`, und die Hälfte der Menüpunkte fehlte — gemessen an der
  // Sonde, nicht vermutet.
  await act(flush);
  await act(flush);
}

/**
 * Der GEÖFFNETE Off-Canvas-Drawer — die zweite Fläche, auf der dieselbe `Sidebar` steht
 * (`MobileNavDrawer.tsx:225`). Er wird DIREKT montiert und nicht über die Shell: die Shell brächte
 * Topbar, Command-Palette und Klara mit, also drei weitere Endpunktflächen, die mit dieser Frage
 * nichts zu tun haben. `MobileNavDrawer.tsx` wird dabei nur gelesen, nicht geändert.
 *
 * `hostRef`/`triggerRef` sind schlichte Ref-Objekte: die Modalgrenze liest sie nur (`host()`,
 * `trigger()?.focus()`), sie müssen nicht an echten Knoten hängen.
 */
async function mountDrawer(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const hostRef = { current: null as HTMLElement | null };
  const triggerRef = { current: null as HTMLButtonElement | null };
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              NavGuardProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: ["/"] },
                createElement(ModalBoundaryProvider, {
                  hostRef,
                  // `children` als Prop und nicht als drittes Argument: die Props dieses Anbieters
                  // führen `children` als PFLICHTFELD, und die createElement-Überladung mit
                  // Kinder-Argumenten deckt das nicht ab (gemessen am Typecheck).
                  children: createElement(MobileNavDrawer, {
                    open: true,
                    onClose: () => {},
                    triggerRef,
                  }),
                }),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

/** Der hinterlegte Text einer Sprache — aus dem Bestand gelesen, nicht im Test abgeschrieben. */
function sprache(lng: string, key: string): string {
  return String(i18n.getResource(lng, "translation", key));
}

function de(key: string): string {
  return sprache("de", key);
}

/** Der Menüpunkt, adressiert über sein Ziel — nicht über eine CSS-Klasse. */
function punkt(pfad: string, wurzel: ParentNode = container): HTMLAnchorElement | null {
  return wurzel.querySelector<HTMLAnchorElement>(`a[href="${pfad}"]`);
}

/**
 * Der Text, den ein Screenreader als BESCHREIBUNG des Links vorträgt: `aria-describedby` zeigt auf
 * eine Kennung, dahinter liegt der Träger. `getElementById` statt `querySelector`, weil `useId`
 * Doppelpunkte erzeugt (`:r1:`) — ein gültiges id-Attribut, aber kein gültiger CSS-Selektor.
 */
function beschreibung(link: HTMLAnchorElement | null): string | null {
  const id = link?.getAttribute("aria-describedby");
  if (!id) {
    return null;
  }
  return document.getElementById(id)?.textContent ?? null;
}

/** Alle Menüpunkte, die eine Admin-Sitzung mit Stufe 2 überhaupt sieht — die Fläche von U3-5. */
function sichtbareEintraege(): NavItem[] {
  return [...NAV_GROUPS.flatMap((g) => g.items), ...FOOT_ITEMS].filter((i) =>
    canSee(i, "admin", true),
  );
}

/**
 * Die ERWARTETE Menge, unabhängig von `navHilfeFor` ausgerechnet: ein Menüpunkt bekommt einen
 * Hinweis, wenn genau ein Hilfekapitel auf seine Route zeigt — abzüglich der einen ausgeschriebenen
 * Ausnahme. Aufgezählt wird hier NICHTS: kommt morgen ein Kapitel oder ein Menüpunkt dazu, wächst
 * diese Menge von selbst mit, und der Fall merkt, wenn die Fläche es nicht tut.
 *
 * `/admin`: das einzige Kapitel dort ist `firststart` (`helpTopics.ts:15-21`). Es beantwortet
 * „wie richte ich das System das erste Mal ein" und nicht „was liegt unter dem Menüpunkt
 * Verwaltung" — eine Vorschau auf eine andere Frage wäre keine ehrliche Vorschau. Entscheidung
 * JOB 3028, ausgeschrieben in `apps/web/src/lib/navHilfe.ts`.
 */
const AUSNAHMEN: readonly string[] = ["/admin"];

function erwartetePfadeMitHinweis(): string[] {
  return sichtbareEintraege()
    .filter((i) => HELP_TOPICS.filter((topic) => topic.to === i.path).length === 1)
    .filter((i) => !AUSNAHMEN.includes(i.path))
    .map((i) => i.path)
    .sort();
}

function pfadeMitHinweisImDom(): string[] {
  return sichtbareEintraege()
    .filter((i) => punkt(i.path)?.hasAttribute("title") === true)
    .map((i) => i.path)
    .sort();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.setItem(STUFE2_KEY, "1");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.removeItem(STUFE2_KEY);
  vi.clearAllMocks();
});

describe("JOB 3028 U3 · der Menüpunkt erklärt sich vor dem Klick", () => {
  it("U3-1: „Meine Aufgaben“ trägt den Satz des Hilfekapitels — für die Maus UND für den Screenreader", async () => {
    await mountSidebar();
    const link = punkt("/aufgaben");
    expect(link, "der Menüpunkt /aufgaben fehlt").not.toBeNull();
    expect(
      link?.getAttribute("title"),
      "der Menüpunkt trägt keinen Tooltip mit dem Hilfetext",
    ).toBe(de("help.tasks.body"));
    expect(
      beschreibung(link),
      "aria-describedby zeigt nicht auf einen Träger mit demselben Text",
    ).toBe(de("help.tasks.body"));
  });

  it("U3-2: der zugängliche NAME des Links bleibt die Beschriftung — die Beschreibung ersetzt ihn nicht", async () => {
    await mountSidebar();
    const link = punkt("/aufgaben");
    // Kein `aria-label`/`aria-labelledby`: der Name kommt weiter aus dem sichtbaren Text.
    expect(link?.hasAttribute("aria-label")).toBe(false);
    expect(link?.hasAttribute("aria-labelledby")).toBe(false);
    expect(link?.textContent).toContain(de("nav.tasks"));
    // Der lange Satz steht NICHT im Link — sein Träger liegt bewusst daneben, sonst flösse er in
    // den Namen ein und aus „Meine Aufgaben“ würde der ganze Absatz.
    expect(
      link?.textContent,
      "der Hilfetext steht IM Link und verschluckt damit den Namen",
    ).not.toContain(de("help.tasks.body"));
  });

  it("U3-3: Punkte ohne Hilfekapitel bleiben STUMM — ein Hinweis, der überall steht, sagt nichts", async () => {
    await mountSidebar();
    for (const pfad of ["/wissensnetz", "/konflikte"]) {
      const link = punkt(pfad);
      expect(link, `der Menüpunkt ${pfad} fehlt`).not.toBeNull();
      expect(link?.hasAttribute("title"), `${pfad} trägt einen Tooltip ohne Hilfekapitel`).toBe(
        false,
      );
      expect(
        link?.hasAttribute("aria-describedby"),
        `${pfad} trägt eine Beschreibung ohne Hilfekapitel`,
      ).toBe(false);
    }
  });

  it("U3-4: /admin bleibt stumm, weil sein einziges Kapitel (firststart) eine ANDERE Frage beantwortet", async () => {
    await mountSidebar();
    const link = punkt("/admin");
    expect(link, "der Menüpunkt /admin fehlt").not.toBeNull();
    expect(link?.hasAttribute("title")).toBe(false);
    expect(link?.hasAttribute("aria-describedby")).toBe(false);
    // Und der Erststart-Text taucht nirgends in der Seitenleiste auf — auch nicht an einem anderen Punkt.
    expect(container.textContent ?? "").not.toContain(de("help.firststart.body"));
  });

  it("U3-5: die MENGE stimmt — acht Punkte, berechnet aus Navigation und Hilfekapiteln, nicht aufgezählt", async () => {
    await mountSidebar();
    const erwartet = erwartetePfadeMitHinweis();
    expect(erwartet.length, "die Rechnung aus NAV_GROUPS × HELP_TOPICS ergibt nicht acht").toBe(8);
    expect(
      pfadeMitHinweisImDom(),
      "die Seitenleiste trägt eine andere Menge als berechnet",
    ).toEqual(erwartet);
    // Und jeder dieser acht trägt WIRKLICH den Satz seines eigenen Kapitels — nicht irgendeinen.
    for (const pfad of erwartet) {
      const kapitel = HELP_TOPICS.find((topic) => topic.to === pfad);
      expect(kapitel, `kein Kapitel zu ${pfad}`).toBeDefined();
      const text = kapitel ? de(kapitel.bodyKey) : "";
      expect(punkt(pfad)?.getAttribute("title"), `${pfad} trägt den falschen Satz`).toBe(text);
      expect(beschreibung(punkt(pfad)), `${pfad} beschreibt sich mit dem falschen Satz`).toBe(text);
    }
  });

  it("U3-6a: der Hinweis hängt nicht am Zähler — alle Quellen LADEN noch", async () => {
    await mountSidebar();
    // Kein Kanal wurde aufgelöst ⇒ die Badges stehen auf „lädt“ (Ladepunkt, keine Zahl).
    expect(
      container.querySelectorAll(`[aria-label="${i18n.t("nav.badge.loading")}"]`).length,
      "keine ladenden Zähler — die Lage dieses Falls ist gar nicht hergestellt",
    ).toBeGreaterThan(0);
    expect(punkt("/aufgaben")?.getAttribute("title")).toBe(de("help.tasks.body"));
    expect(beschreibung(punkt("/aufgaben"))).toBe(de("help.tasks.body"));
    // Die beiden Texte vermischen sich nicht: das Abzeichen behält seine eigene Beschriftung.
    expect(punkt("/aufgaben")?.getAttribute("title")).not.toContain(i18n.t("nav.badge.loading"));
  });

  it("U3-6b: der Hinweis hängt nicht am Zähler — alle Quellen sind GESCHEITERT", async () => {
    await mountSidebar();
    await act(async () => {
      d.board.reject(new Error("kaputt"));
      d.conflicts.reject(new Error("kaputt"));
      d.duplicates.reject(new Error("kaputt"));
      d.gaps.reject(new Error("kaputt"));
      d.lifecycle.reject(new Error("kaputt"));
      await flush();
    });
    const marker = container.querySelectorAll(`[aria-label="${i18n.t("nav.badge.error")}"]`);
    expect(
      marker.length,
      "kein Fehler-Marker — die Lage dieses Falls ist nicht hergestellt",
    ).toBeGreaterThan(0);
    expect(punkt("/aufgaben")?.getAttribute("title")).toBe(de("help.tasks.body"));
    expect(beschreibung(punkt("/aufgaben"))).toBe(de("help.tasks.body"));
    expect(marker[0]?.getAttribute("aria-label")).toBe(i18n.t("nav.badge.error"));
  });

  it("U3-6c: der Hinweis hängt nicht am Zähler — eine geladene Zahl ist VERALTET", async () => {
    await mountSidebar();
    await act(async () => {
      d.board.resolve([{ id: "a" }, { id: "b" }]);
      d.conflicts.resolve([]);
      d.duplicates.resolve([]);
      d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
      d.lifecycle.resolve([]);
      await flush();
    });
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["validation", "board"] });
      await flush();
    });
    await act(async () => {
      d.board.reject(new Error("Refetch kaputt"));
      await flush();
    });
    const stale = container.querySelector(`[aria-label="${i18n.t("nav.badge.stale")}"]`);
    expect(
      stale,
      "kein Veraltet-Hinweis — die Lage dieses Falls ist nicht hergestellt",
    ).not.toBeNull();
    expect(punkt("/aufgaben")?.getAttribute("title")).toBe(de("help.tasks.body"));
    expect(beschreibung(punkt("/aufgaben"))).toBe(de("help.tasks.body"));
    // Die alte Zahl behält ihre eigene, bedeutungstragende Beschriftung.
    expect(
      container.querySelector(`[aria-label="${i18n.t("nav.badge.validation", { count: 2 })}"]`),
    ).not.toBeNull();
  });

  it("U3-7: dieselben Hinweise kommen im geöffneten Off-Canvas-Menü an — eine Fläche, ein Bau", async () => {
    await mountDrawer();
    const dialog = container.querySelector<HTMLElement>("dialog[aria-modal='true']");
    expect(dialog, "der Drawer ist nicht offen").not.toBeNull();
    if (!dialog) {
      return;
    }
    // Im Drawer gemessen, nicht irgendwo auf der Seite.
    const aufgaben = punkt("/aufgaben", dialog);
    expect(aufgaben, "der Menüpunkt /aufgaben fehlt im Drawer").not.toBeNull();
    expect(aufgaben?.getAttribute("title")).toBe(de("help.tasks.body"));
    expect(beschreibung(aufgaben)).toBe(de("help.tasks.body"));
    // Die Gegenrichtung gilt auch hier.
    expect(punkt("/wissensnetz", dialog)?.hasAttribute("title")).toBe(false);
    // Der Träger ist kein zusätzlicher Halt für die Fokusfalle des Drawers.
    const id = aufgaben?.getAttribute("aria-describedby") ?? "";
    const traeger = document.getElementById(id);
    expect(traeger?.tagName.toLowerCase()).toBe("span");
    expect(traeger?.hasAttribute("tabindex")).toBe(false);
  });

  // ==============================================================================================
  // U3-10 — DER SPRACHWECHSEL (Codex-Prüflücke aus Runde 1, nicht blockierend, hier geschlossen).
  // ==============================================================================================
  //
  // Der Vorschlag des Prüfers wörtlich: „gemountete Sidebar nach `changeLanguage` prüfen". Die
  // Gefahr dahinter ist real und nicht theoretisch: Würde der Satz EINMAL beim Aufbau aufgelöst
  // und weggelegt, bliebe er nach einem Sprachwechsel auf Deutsch stehen — die Oberfläche spräche
  // Englisch, und ausgerechnet die Erklärung, die jemandem beim Verstehen helfen soll, spräche es
  // nicht. Gemessen wird deshalb in ALLEN drei Sprachen des Bestands (`i18n.ts:13316`) und danach
  // zurück auf Deutsch — ein Wechsel, der nur in eine Richtung wirkt, wäre auch ein Defekt.
  it("U3-10: der Hinweis folgt dem Sprachwechsel de → en → nl und wieder zurück", async () => {
    await mountSidebar();
    expect(punkt("/aufgaben")?.getAttribute("title")).toBe(sprache("de", "help.tasks.body"));

    for (const lng of ["en", "nl"] as const) {
      const erwartet = sprache(lng, "help.tasks.body");
      // Ohne diese Zeile wäre der Fall auch dann grün, wenn beide Sprachen denselben Satz führten.
      expect(erwartet, `${lng} führt denselben Satz wie de — der Fall misst nichts`).not.toBe(
        sprache("de", "help.tasks.body"),
      );
      await act(async () => {
        await i18n.changeLanguage(lng);
        await flush();
      });
      expect(punkt("/aufgaben")?.getAttribute("title"), `Tooltip folgt ${lng} nicht`).toBe(
        erwartet,
      );
      expect(beschreibung(punkt("/aufgaben")), `Beschreibung folgt ${lng} nicht`).toBe(erwartet);
      // Die Gegenrichtung hält in jeder Sprache: kein Kapitel ⇒ kein Hinweis, kein Träger.
      expect(punkt("/wissensnetz")?.hasAttribute("title"), `${lng}: /wissensnetz redet`).toBe(
        false,
      );
      expect(punkt("/admin")?.hasAttribute("title"), `${lng}: /admin redet`).toBe(false);
    }

    await act(async () => {
      await i18n.changeLanguage("de");
      await flush();
    });
    expect(punkt("/aufgaben")?.getAttribute("title")).toBe(sprache("de", "help.tasks.body"));
    expect(beschreibung(punkt("/aufgaben"))).toBe(sprache("de", "help.tasks.body"));
  });
});
