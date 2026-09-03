// @vitest-environment jsdom
// ================================================================================================
// JOB 3028 · U3 — DIE KETTE: DER TEXT KOMMT AUS DEM HILFEKAPITEL, SONST NIRGENDWOHER.
// ================================================================================================
//
// Die Ablösungsgefahr dieses Auftrags ist eine ZWEITE WAHRHEIT — eine abgeschriebene Tabelle
// „Route → Text" neben `HELP_TOPICS`, die beim nächsten neuen Kapitel unbemerkt auseinanderläuft
// (die Sorte Befund, die Codex in JOB 3013 R1 gerügt hat). Genau die ist hier gepinnt, und zwar
// nicht als einmalige Handprobe, sondern dauerhaft: der Bestand der Hilfekapitel wird für diesen
// Lauf GESETZT, und die gemountete Seitenleiste muss ihm folgen.
//
// Zwei Zusicherungen:
//   (a) LEERER Bestand  → kein einziger Menüpunkt trägt einen Hinweis. Käme der Text aus einer
//       eigenen Tabelle in `navHilfe.ts`, stünde er weiter da und dieser Fall bliebe grün.
//   (b) ZWEI Kapitel auf derselben Route → `null`. Das ist Regel 3 von `navHilfeFor`: bei
//       Mehrdeutigkeit wird NICHT geraten und nicht das erste genommen. Im echten Bestand kommt
//       der Fall nicht vor — er wird deshalb hier gesetzt und nicht dort erfunden.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HelpTopicDef } from "../../apps/web/src/lib/helpTopics";

/**
 * Der gesetzte Bestand. Als GETTER in die Attrappe gereicht, damit jeder Fall ihn eigenständig
 * stellen kann — `navHilfeFor` liest `HELP_TOPICS` bei jedem Aufruf.
 */
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
import i18n from "../../apps/web/src/i18n";
import { navHilfeFor } from "../../apps/web/src/lib/navHilfe";
import { Sidebar } from "../../apps/web/src/shell/Sidebar";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STUFE2_KEY = "kw.stufe2.v1";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountSidebar(): Promise<void> {
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
  // Zwei Durchläufe: `/auth/me` wird erst nach erfolgreichem `/auth/status` freigegeben
  // (AuthContext.tsx:99); vorher steht die Rolle noch auf dem Vorschau-Wert.
  await act(flush);
  await act(flush);
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

describe("JOB 3028 U3 · der Hinweis kommt aus HELP_TOPICS — und aus nichts anderem", () => {
  it("U3-9: ohne Hilfekapitel trägt KEIN Menüpunkt einen Hinweis", async () => {
    lage.topics = [];
    await mountSidebar();
    try {
      const links = [...container.querySelectorAll("a")];
      expect(links.length, "die Seitenleiste rendert gar keine Menüpunkte").toBeGreaterThan(5);
      for (const link of links) {
        expect(
          link.hasAttribute("title"),
          `${link.getAttribute("href")} trägt einen Hinweis, obwohl es kein Kapitel gibt`,
        ).toBe(false);
        expect(link.hasAttribute("aria-describedby")).toBe(false);
      }
      expect(container.querySelectorAll("span.sr-only").length).toBe(0);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it("ein NEUES Kapitel zieht den Hinweis von selbst nach — nichts muss nachgetragen werden", async () => {
    // `/extern` hat im echten Bestand kein Kapitel. Hier bekommt es eines — und zwar nur hier.
    lage.topics = [kapitel("tasks", "/aufgaben"), kapitel("extern", "/extern")];
    await mountSidebar();
    try {
      const extern = container.querySelector<HTMLAnchorElement>('a[href="/extern"]');
      expect(extern?.getAttribute("title")).toBe("help.extern.body");
      const id = extern?.getAttribute("aria-describedby") ?? "";
      expect(document.getElementById(id)?.textContent).toBe("help.extern.body");
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
