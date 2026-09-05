// @vitest-environment jsdom
// ================================================================================================
// JOB 3028 · U3 → JOB 3060 · H1 — DER ERKLÄRSATZ ZUM MENÜPUNKT LIEGT IN DER SEITENHILFE.
// ================================================================================================
//
// JOB 3028 brachte den Satz des Hilfekapitels an den Menüpunkt (title + aria-describedby). Pedi
// (04.09.): Erklärung gehört hinter Zahnrad/Profil, nicht ins Sichtfeld. Der Satz bleibt — er kommt
// weiter aus `HELP_TOPICS` über `navHilfeFor` (kein neuer Text, keine zweite Tabelle) —, aber sein
// ORT ist die Zeile „Seitenhilfe“ im Zahnrad-Menü, und die Kopfband-Punkte tragen KEIN `title` und
// KEIN `aria-describedby` mehr.
//
// GEMESSEN WIRD AN DER GEMOUNTETEN FLÄCHE, nicht an `i18n.ts`, in BEIDE Richtungen: die Seiten mit
// Kapitel zeigen ihren Satz, die ohne zeigen den ehrlichen Leersatz; die MENGE wird zur Laufzeit
// aus Navigation × Hilfekapiteln gerechnet, nicht aufgezählt (U3-5).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// „channel“-Mock wie bei `tests/app/nav-badges-*-mounted` — U3-6: der Satz darf in KEINER
// Zähler-Lage (lädt / gescheitert) anders lauten.
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
    // erreichbar (`canSee`). Nur so ist die Mengenaussage in U3-5 vollständig.
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
    notifications: { list: vi.fn(async () => []), markSeen: vi.fn(async () => ({})) },
    features: { get: vi.fn(async () => ({ features: {} })) },
    reasoner: {
      status: vi.fn(async () => ({ active: false, mode: "none", reachable: "unknown", tasks: {} })),
      config: vi.fn(async () => null),
    },
    external: { policy: vi.fn(async () => ({ stage: "blocked" })) },
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
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { FOOT_ITEMS, NAV_GROUPS, type NavItem, canSee } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";
import { MobileNavDrawer } from "../../apps/web/src/shell/MobileNavDrawer";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der persistierte Stufe-2-Umschalter (`lib/stufe2Storage.ts:7`). Admin + an ⇒ alles erreichbar. */
const STUFE2_KEY = "kw.stufe2.v1";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function huelle(
  kind: ReturnType<typeof createElement>,
  pfad: string,
): ReturnType<typeof createElement> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(
    QueryClientProvider,
    { client: qc },
    createElement(
      AuthProvider,
      null,
      createElement(
        RoleProvider,
        null,
        createElement(
          ToastProvider,
          null,
          createElement(
            NavGuardProvider,
            null,
            createElement(MemoryRouter, { initialEntries: [pfad] }, kind),
          ),
        ),
      ),
    ),
  );
}

/** Das echte Kopfband unter einer Route, mit echten Providern; einzige Attrappe ist die Endpunktgrenze. */
async function mountKopfband(pfad = "/aufgaben"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(huelle(createElement(Kopfband), pfad));
    await flush();
  });
  // ZWEI Durchläufe: `/auth/me` wird erst freigegeben, wenn `/auth/status` erfolgreich ist
  // (AuthContext.tsx:99). Nach nur einem Durchlauf steht die Rolle noch auf dem Vorschau-Wert.
  await act(flush);
  await act(flush);
}

/** Der GEÖFFNETE Off-Canvas-Drawer — die zweite Fläche mit denselben Zahnrad-Einträgen. */
async function mountDrawer(pfad = "/aufgaben"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const hostRef = { current: null as HTMLElement | null };
  const triggerRef = { current: null as HTMLButtonElement | null };
  await act(async () => {
    root.render(
      huelle(
        createElement(ModalBoundaryProvider, {
          hostRef,
          children: createElement(MobileNavDrawer, { open: true, onClose: () => {}, triggerRef }),
        }),
        pfad,
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

async function click(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

/** Zahnrad-Menü öffnen und die Seitenhilfe aufklappen — im Kopfband. */
async function seitenhilfeOeffnen(wurzel: ParentNode = container): Promise<void> {
  const zahnrad = wurzel.querySelector('[data-testid="kopfband-zahnrad"]');
  if (zahnrad) {
    await click(zahnrad);
  }
  await click(wurzel.querySelector('[data-testid="zahnrad-seitenhilfe"]'));
}

/** Der Text der Seitenhilfe (Liste oder Leersatz), nach dem Aufklappen. */
function seitenhilfeText(wurzel: ParentNode = container): string {
  const liste = wurzel.querySelector('[data-testid="seitenhilfe-liste"]');
  if (liste) {
    return (liste.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  return (wurzel.querySelector('[data-testid="zahnrad-menue"], .kw-drawer')?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Der hinterlegte Text einer Sprache — aus dem Bestand gelesen, nicht im Test abgeschrieben. */
function sprache(lng: string, key: string): string {
  return String(i18n.getResource(lng, "translation", key));
}
function de(key: string): string {
  return sprache("de", key);
}

/** Alle Menüpunkte, die eine Admin-Sitzung mit Stufe 2 überhaupt erreicht — die Fläche von U3-5. */
function erreichbareEintraege(): NavItem[] {
  return [...NAV_GROUPS.flatMap((g) => g.items), ...FOOT_ITEMS].filter((i) =>
    canSee(i, "admin", true),
  );
}

/**
 * Die ERWARTETE Menge, unabhängig von `navHilfeFor` ausgerechnet: eine Seite bekommt einen Satz,
 * wenn genau ein Hilfekapitel auf ihre Route zeigt — abzüglich der einen ausgeschriebenen Ausnahme
 * (`/admin`: das einzige Kapitel dort beantwortet eine andere Frage; JOB 3028, lib/navHilfe.ts).
 */
const AUSNAHMEN: readonly string[] = ["/admin"];

function erwartetePfadeMitSatz(): string[] {
  return erreichbareEintraege()
    .filter((i) => HELP_TOPICS.filter((topic) => topic.to === i.path).length === 1)
    .filter((i) => !AUSNAHMEN.includes(i.path))
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

describe("JOB 3028 U3 → H1 · der Erklärsatz zum Menüpunkt steht in der Seitenhilfe, nicht am Punkt", () => {
  it("U3-1: auf /aufgaben nennt die Seitenhilfe Titel und Satz des Hilfekapitels „Meine Aufgaben“", async () => {
    await mountKopfband("/aufgaben");
    await seitenhilfeOeffnen();
    const text = seitenhilfeText();
    expect(text).toContain(de("help.tasks.title"));
    expect(text).toContain(de("help.tasks.body"));
  });

  it("U3-2: die Kopfband-Punkte tragen KEIN title und KEIN aria-describedby — der Name bleibt die Beschriftung", async () => {
    await mountKopfband("/aufgaben");
    const punkte = [...container.querySelectorAll<HTMLAnchorElement>("header a.kw-kopfband-punkt")];
    expect(punkte.length, "keine Kopfband-Punkte gefunden").toBe(5);
    for (const link of punkte) {
      expect(link.hasAttribute("title"), `${link.getAttribute("href")} trägt einen Tooltip`).toBe(
        false,
      );
      expect(link.hasAttribute("aria-describedby")).toBe(false);
      expect(link.hasAttribute("aria-label")).toBe(false);
      expect(link.hasAttribute("aria-labelledby")).toBe(false);
    }
    // Der lange Satz steht nirgends im Kopfband — auch nicht als versteckter Träger.
    expect(container.querySelector("header")?.textContent).not.toContain(de("help.tasks.body"));
    expect(container.querySelectorAll("header span.sr-only").length).toBe(0);
  });

  it("U3-3: Seiten ohne Hilfekapitel bekommen den ehrlichen Leersatz — ein Hinweis, der überall steht, sagt nichts", async () => {
    for (const pfad of ["/wissensnetz", "/konflikte"]) {
      await mountKopfband(pfad);
      await seitenhilfeOeffnen();
      expect(seitenhilfeText(), `${pfad} zeigt einen Satz ohne Kapitel`).toContain(
        de("menue.seitenhilfe.leer"),
      );
      expect(container.querySelector('[data-testid="seitenhilfe-liste"]')).toBeNull();
      act(() => root.unmount());
      container.remove();
    }
    // Damit afterEach einen Baum vorfindet.
    await mountKopfband("/start");
  });

  it("U3-4: /admin bleibt stumm, weil sein einziges Kapitel (firststart) eine ANDERE Frage beantwortet", async () => {
    await mountKopfband("/admin");
    await seitenhilfeOeffnen();
    expect(seitenhilfeText()).toContain(de("menue.seitenhilfe.leer"));
    expect(container.textContent ?? "").not.toContain(de("help.firststart.body"));
  });

  it("U3-5: die MENGE stimmt — acht Seiten, berechnet aus Navigation und Hilfekapiteln, nicht aufgezählt", async () => {
    const erwartet = erwartetePfadeMitSatz();
    expect(erwartet.length, "die Rechnung aus NAV_GROUPS × HELP_TOPICS ergibt nicht acht").toBe(8);
    const imDom: string[] = [];
    for (const item of erreichbareEintraege()) {
      await mountKopfband(item.path);
      await seitenhilfeOeffnen();
      const kapitel = HELP_TOPICS.find((topic) => topic.to === item.path);
      const text = seitenhilfeText();
      if (container.querySelector('[data-testid="seitenhilfe-liste"]')) {
        imDom.push(item.path);
        // Und jede dieser Seiten trägt WIRKLICH den Satz ihres eigenen Kapitels — nicht irgendeinen.
        expect(kapitel, `Satz ohne Kapitel auf ${item.path}`).toBeDefined();
        expect(text, `${item.path} trägt den falschen Satz`).toContain(de(kapitel?.bodyKey ?? ""));
      } else {
        expect(text, `${item.path} ohne Liste und ohne Leersatz`).toContain(
          de("menue.seitenhilfe.leer"),
        );
      }
      act(() => root.unmount());
      container.remove();
    }
    expect(imDom.sort(), "die Seitenhilfe trägt eine andere Menge als berechnet").toEqual(erwartet);
    await mountKopfband("/start");
  });

  it("U3-6a: der Satz hängt nicht am Zähler — alle Quellen LADEN noch, und es gibt keinen Zähler", async () => {
    await mountKopfband("/aufgaben");
    // Kein Kanal wurde aufgelöst ⇒ §9: keine Zahl an „Prüfen“, kein Ladepunkt.
    expect(container.querySelector(".kw-kopfband-zaehler")).toBeNull();
    await seitenhilfeOeffnen();
    expect(seitenhilfeText()).toContain(de("help.tasks.body"));
  });

  it("U3-6b: der Satz hängt nicht am Zähler — alle Quellen sind GESCHEITERT", async () => {
    await mountKopfband("/aufgaben");
    await act(async () => {
      d.board.reject(new Error("kaputt"));
      d.conflicts.reject(new Error("kaputt"));
      d.duplicates.reject(new Error("kaputt"));
      d.gaps.reject(new Error("kaputt"));
      d.lifecycle.reject(new Error("kaputt"));
      await flush();
    });
    expect(container.querySelector(".kw-kopfband-zaehler")).toBeNull();
    await seitenhilfeOeffnen();
    expect(seitenhilfeText()).toContain(de("help.tasks.body"));
  });

  it("U3-7: derselbe Satz kommt im geöffneten Off-Canvas-Menü an — eine Fläche, ein Bau", async () => {
    await mountDrawer("/aufgaben");
    const dialog = container.querySelector<HTMLElement>("dialog[aria-modal='true']");
    expect(dialog, "der Drawer ist nicht offen").not.toBeNull();
    if (!dialog) {
      return;
    }
    await seitenhilfeOeffnen(dialog);
    expect(seitenhilfeText(dialog)).toContain(de("help.tasks.body"));
    // Die Gegenrichtung gilt auch hier: die Kopfband-Punkte im Drawer tragen keinen Tooltip. (Die
    // Status-Zeilen des Zahnrad-Teils tragen ihren Klartext-Tooltip weiterhin — mega38 H.)
    for (const link of dialog.querySelectorAll('a[data-testid^="drawer-punkt-"]')) {
      expect(link.hasAttribute("title")).toBe(false);
      expect(link.hasAttribute("aria-describedby")).toBe(false);
    }
  });

  // U3-10 — DER SPRACHWECHSEL: würde der Satz EINMAL beim Aufbau aufgelöst und weggelegt, bliebe er
  // nach einem Sprachwechsel auf Deutsch stehen. Gemessen in ALLEN drei Sprachen und zurück.
  it("U3-10: der Satz folgt dem Sprachwechsel de → en → nl und wieder zurück", async () => {
    await mountKopfband("/aufgaben");
    await seitenhilfeOeffnen();
    expect(seitenhilfeText()).toContain(sprache("de", "help.tasks.body"));

    for (const lng of ["en", "nl"] as const) {
      const erwartet = sprache(lng, "help.tasks.body");
      expect(erwartet, `${lng} führt denselben Satz wie de — der Fall misst nichts`).not.toBe(
        sprache("de", "help.tasks.body"),
      );
      await act(async () => {
        await i18n.changeLanguage(lng);
        await flush();
      });
      expect(seitenhilfeText(), `Satz folgt ${lng} nicht`).toContain(erwartet);
    }

    await act(async () => {
      await i18n.changeLanguage("de");
      await flush();
    });
    expect(seitenhilfeText()).toContain(sprache("de", "help.tasks.body"));
  });
});
