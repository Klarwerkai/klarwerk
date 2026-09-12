// @vitest-environment jsdom
// ================================================================================================
// JOB 3741 · N2 — DER BEWEIS HAENGT AM GEZEICHNETEN DOM, NICHT AN DER REINEN FUNKTION.
// ================================================================================================
//
// Der DOM-freie Nachbar (`jeder-menuepunkt-hat-einen-erklaersatz.test.ts`) belegt, dass zu jedem
// Menuepunkt ein Kapitel entsteht und in drei Sprachen aufloest. Das allein waere der teuerste
// Fehler dieses Projekts: gebaut und nie gerufen. Deshalb montiert dieser Lauf das ECHTE Kopfband
// auf jeder betroffenen Route, oeffnet Zahnrad → Seitenhilfe und liest, was dort steht:
//   · die Liste `[data-testid="seitenhilfe-liste"]` (`ZahnradMenue.tsx:62`) ist da,
//   · sie traegt Titel UND Text des Kapitels DIESER Route,
//   · und die Leermeldung `menue.seitenhilfe.leer` (`ZahnradMenue.tsx:57`) steht NICHT mehr da.
//
// DIE ROUTEN WERDEN ERHOBEN, nicht aufgezaehlt: dieselbe Rechnung aus `app/navigation.ts` ×
// `HELP_TOPICS` wie nebenan. Faellt ein einzelnes Kapitel weg, faellt GENAU seine Route hier rot
// auf und nennt sich in der Fehlermeldung (Gegenprobe (a) des Auftrags) — ein Mengenwaechter, der
// Einzelentfernungen nicht bemerkt, waere kein Waechter (Lehre aus JOB 3587 R4).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // Rolle `admin` — zusammen mit dem Stufe-2-Schalter unten sind ALLE Menuepunkte erreichbar.
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make();
        },
      },
    );
  return { endpoints: make() };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { FOOT_ITEMS, NAV_GROUPS, type NavItem } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import { navHilfeFor } from "../../apps/web/src/lib/navHilfe";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der persistierte Stufe-2-Umschalter (`lib/stufe2Storage.ts:7`). Admin + an ⇒ alles erreichbar. */
const STUFE2_KEY = "kw.stufe2.v1";

/** Dieselben drei Ausnahmen wie nebenan — mit denselben Gruenden (§10 des Auftrags). */
const OHNE_KAPITEL: readonly string[] = ["/admin", "/start", "/entwuerfe"];

/** Die elf Kapitel VOR diesem Auftrag; alles Weitere auf einer Menue-Route ist neu. */
const GEERBTE_IDS: readonly string[] = [
  "firststart",
  "capture",
  "fileimport",
  "ask",
  "library",
  "validation",
  "tasks",
  "risk",
  "lifecycle",
  "stufe2",
  "mobile",
];

function menuepunkte(): NavItem[] {
  return [...NAV_GROUPS.flatMap((g) => g.items), ...FOOT_ITEMS];
}

/**
 * DIE SOLLMENGE KOMMT AUS `app/navigation.ts` — und AUSDRUECKLICH NICHT aus `HELP_TOPICS`.
 *
 * Das ist der Unterschied zwischen einem Waechter und einer Zaehlung, und er ist hier gemessen:
 * die erste Fassung dieses Laufs las die Routen aus `HELP_TOPICS` und blieb bei der Gegenprobe (a)
 * GRUEN — wer ein Kapitel entfernt, entfernt damit auch die Route aus der eigenen Sollmenge, und
 * der Lauf prueft still eine Route weniger. Genau die Bauform, vor der die Lehre aus JOB 3587 R4
 * warnt („ein Mengenwaechter, der Einzelentfernungen nicht bemerkt, ist kein Waechter").
 *
 * Aus der Navigationsquelle erhoben faellt dagegen GENAU die Route rot auf, deren Kapitel fehlt —
 * und sie steht in der Fehlermeldung.
 */
function sollRouten(): string[] {
  return menuepunkte()
    .map((i) => i.path)
    .filter((pfad, i, alle) => alle.indexOf(pfad) === i)
    .filter((pfad) => !OHNE_KAPITEL.includes(pfad));
}

/** Nur zur Auswahl einer Stichprobe (N2d): eine Route, deren Kapitel aus DIESEM Auftrag stammt. */
function eineNeueRoute(): string | undefined {
  return sollRouten().find((pfad) => {
    const kapitel = HELP_TOPICS.find((t) => t.to === pfad);
    return kapitel !== undefined && !GEERBTE_IDS.includes(kapitel.id);
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountKopfband(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(MemoryRouter, { initialEntries: [pfad] }, createElement(Kopfband)),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Zwei Durchlaeufe: `/auth/me` wird erst nach erfolgreichem `/auth/status` freigegeben.
  await act(flush);
  await act(flush);
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
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

async function seitenhilfeOeffnen(): Promise<void> {
  await click(container.querySelector('[data-testid="kopfband-zahnrad"]'));
  await click(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'));
}

/** Der Text der Seitenhilfe-Liste — oder der des ganzen Menues, wenn keine Liste da ist. */
function seitenhilfeText(): string {
  const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
  const quelle = liste ?? container.querySelector('[data-testid="zahnrad-menue"]');
  return (quelle?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Der hinterlegte Text einer Sprache — aus dem Bestand gelesen, nicht im Test abgeschrieben. */
function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.setItem(STUFE2_KEY, "1");
});

afterEach(() => {
  window.localStorage.removeItem(STUFE2_KEY);
  vi.clearAllMocks();
});

describe("JOB 3741 · N2 — das Zahnrad zeigt auf jeder Menue-Route den Satz ihrer Seite", () => {
  it("N2a: die Erhebung ist kalibriert — die Sollmenge kommt aus der Navigation und ist nicht leer", () => {
    expect(sollRouten().length, "keine Route zu pruefen — der Lauf misst nichts").toBeGreaterThan(
      10,
    );
    expect(
      sollRouten().length,
      "die Sollmenge ist nicht mehr „alle Menuepunkte ausser den drei Ausnahmen“",
    ).toBe(new Set(menuepunkte().map((i) => i.path)).size - OHNE_KAPITEL.length);
  });

  it("N2b: jede Route traegt Titel UND Text ihres Kapitels, und KEINE Leermeldung", async () => {
    for (const pfad of sollRouten()) {
      const hilfe = navHilfeFor(pfad);
      // Fehlt hier das Kapitel, nennt die Meldung GENAU diese Route — das ist die Gegenprobe (a).
      expect(hilfe, `${pfad}: kein Hilfekapitel — die Seitenhilfe bliebe dort leer`).not.toBeNull();
      await mountKopfband(pfad);
      try {
        await seitenhilfeOeffnen();
        const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
        expect(liste, `${pfad}: die Seitenhilfe zeigt keine Liste`).not.toBeNull();
        const text = seitenhilfeText();
        expect(text, `${pfad}: der Titel des Kapitels fehlt`).toContain(de(hilfe?.titleKey ?? ""));
        expect(text, `${pfad}: der Erklaersatz des Kapitels fehlt`).toContain(
          de(hilfe?.bodyKey ?? ""),
        );
        expect(text, `${pfad}: dort steht weiter die Leermeldung`).not.toContain(
          de("menue.seitenhilfe.leer"),
        );
      } finally {
        abbauen();
      }
    }
  });

  it("N2c: die Gegenrichtung — /start bleibt bei der ehrlichen Leermeldung", async () => {
    // Ohne diesen Fall bewiese N2b nur, dass irgendwo Text steht. `/start` gehoert zu JOB 3669 und
    // hat hier absichtlich kein Kapitel: dort MUSS die Leermeldung stehen.
    await mountKopfband("/start");
    try {
      await seitenhilfeOeffnen();
      expect(container.querySelector('[data-testid="seitenhilfe-liste"]')).toBeNull();
      expect(seitenhilfeText()).toContain(de("menue.seitenhilfe.leer"));
    } finally {
      abbauen();
    }
  });

  it("N2d: der Satz folgt dem Sprachwechsel — er wird nicht einmal aufgeloest und weggelegt", async () => {
    const erste = eineNeueRoute();
    expect(erste, "keine Route mit einem Kapitel aus DIESEM Auftrag").toBeDefined();
    if (!erste) {
      return;
    }
    const hilfe = navHilfeFor(erste);
    await mountKopfband(erste);
    try {
      await seitenhilfeOeffnen();
      expect(seitenhilfeText()).toContain(de(hilfe?.bodyKey ?? ""));
      for (const lng of ["en", "nl"] as const) {
        const erwartet = String(i18n.getResource(lng, "translation", hilfe?.bodyKey ?? ""));
        expect(erwartet, `${lng} traegt denselben Satz wie de — der Fall misst nichts`).not.toBe(
          de(hilfe?.bodyKey ?? ""),
        );
        await act(async () => {
          await i18n.changeLanguage(lng);
          await flush();
        });
        expect(seitenhilfeText(), `Satz folgt ${lng} nicht`).toContain(erwartet);
      }
    } finally {
      await act(async () => {
        await i18n.changeLanguage("de");
        await flush();
      });
      abbauen();
    }
  });
});
