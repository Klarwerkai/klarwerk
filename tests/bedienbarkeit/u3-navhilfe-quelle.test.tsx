// @vitest-environment jsdom
// ================================================================================================
// JOB 3028 · U3 → JOB 3060 · H1 — DIE KETTE: DER TEXT KOMMT AUS DEM HILFEKAPITEL, SONST NIRGENDWOHER.
// ================================================================================================
//
// Die Ablösungsgefahr ist eine ZWEITE WAHRHEIT — eine abgeschriebene Tabelle „Route → Text“ neben
// `HELP_TOPICS`, die beim nächsten neuen Kapitel unbemerkt auseinanderläuft. Genau die ist hier
// gepinnt, dauerhaft: der Bestand der Hilfekapitel wird für diesen Lauf GESETZT, und die gemountete
// Seitenhilfe (Zahnrad-Menü, seit H1 der Ort des Satzes) muss ihm folgen.
//
// Zwei Zusicherungen:
//   (a) LEERER Bestand  → die Seitenhilfe zeigt auf jeder Seite nur den Leersatz. Käme der Text aus
//       einer eigenen Tabelle in `navHilfe.ts`, stünde er weiter da und dieser Fall bliebe grün.
//   (b) ZWEI Kapitel auf derselben Route → `null`. Regel 3 von `navHilfeFor`: bei Mehrdeutigkeit
//       wird NICHT geraten. Im echten Bestand kommt der Fall nicht vor — er wird hier gesetzt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HelpTopicDef } from "../../apps/web/src/lib/helpTopics";

/** Der gesetzte Bestand. Als GETTER in die Attrappe gereicht — `navHilfeFor` liest bei jedem Aufruf. */
const lage = vi.hoisted(() => ({ topics: [] as unknown[] }));

vi.mock("../../apps/web/src/lib/helpTopics", async (echt) => {
  const actual = (await echt()) as Record<string, unknown>;
  return {
    ...actual,
    get HELP_TOPICS() {
      return lage.topics;
    },
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
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
import i18n from "../../apps/web/src/i18n";
import { navHilfeFor } from "../../apps/web/src/lib/navHilfe";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STUFE2_KEY = "kw.stufe2.v1";

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
  // Zwei Durchläufe: `/auth/me` wird erst nach erfolgreichem `/auth/status` freigegeben.
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

async function seitenhilfeOeffnen(): Promise<string> {
  await click(container.querySelector('[data-testid="kopfband-zahnrad"]'));
  await click(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'));
  return (container.querySelector('[data-testid="zahnrad-menue"]')?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function kapitel(id: string, to: string): HelpTopicDef {
  return { id, titleKey: `help.${id}.title`, bodyKey: `help.${id}.body`, to, tags: [] };
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.setItem(STUFE2_KEY, "1");
});

afterEach(() => {
  window.localStorage.removeItem(STUFE2_KEY);
  lage.topics = [];
  vi.clearAllMocks();
});

describe("JOB 3028 U3 → H1 · der Satz der Seitenhilfe kommt aus HELP_TOPICS — und aus nichts anderem", () => {
  it("U3-9: ohne Hilfekapitel zeigt die Seitenhilfe auf /aufgaben nur den Leersatz — kein Satz, kein Träger", async () => {
    lage.topics = [];
    await mountKopfband("/aufgaben");
    try {
      const text = await seitenhilfeOeffnen();
      expect(text).toContain(
        String(i18n.getResource("de", "translation", "menue.seitenhilfe.leer")),
      );
      expect(container.querySelector('[data-testid="seitenhilfe-liste"]')).toBeNull();
      // Und kein Kopfband-Punkt trägt einen Tooltip oder eine Beschreibung. (Die Status-Zeilen im
      // Zahnrad-Menü tragen ihren Klartext-Tooltip weiterhin — das ist mega38 H, nicht U3.)
      for (const link of container.querySelectorAll("header a.kw-kopfband-punkt")) {
        expect(link.hasAttribute("title")).toBe(false);
        expect(link.hasAttribute("aria-describedby")).toBe(false);
      }
      expect(container.querySelectorAll("span.sr-only").length).toBe(0);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("ein NEUES Kapitel zieht den Satz von selbst nach — nichts muss nachgetragen werden", async () => {
    // `/extern` hat im echten Bestand kein Kapitel. Hier bekommt es eines — und zwar nur hier.
    lage.topics = [kapitel("tasks", "/aufgaben"), kapitel("extern", "/extern")];
    await mountKopfband("/extern");
    try {
      const text = await seitenhilfeOeffnen();
      expect(text).toContain("help.extern.body");
      expect(container.querySelector('[data-testid="seitenhilfe-liste"]')).not.toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("Regel 3: zwei Kapitel auf derselben Route ⇒ null — es wird nicht geraten", () => {
    lage.topics = [kapitel("a", "/aufgaben"), kapitel("b", "/aufgaben")];
    expect(navHilfeFor("/aufgaben")).toBeNull();
    // Gegenprobe in derselben Lage: eine EINDEUTIGE Route liefert weiterhin ihr Kapitel.
    lage.topics = [kapitel("a", "/aufgaben"), kapitel("b", "/fragen")];
    expect(navHilfeFor("/aufgaben")).toEqual({
      titleKey: "help.a.title",
      bodyKey: "help.a.body",
    });
  });
});
