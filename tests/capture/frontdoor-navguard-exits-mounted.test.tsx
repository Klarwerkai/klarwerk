// @vitest-environment jsdom
// AUFTRAG-mega11 Block B (bens SB-2): Die Weggehwarnung der Vordertür war löchrig.
//
// mega9 hatte das Dirty-Prädikat richtig gebaut und den Wächter angemeldet — aber der Wächter ist
// QUELLENBASIERT: er greift nur, wenn die Navigationsquelle `guard()` selbst ruft, und mega9 hat
// genau EINE Quelle verdrahtet (den Kopf-Link „Alle Erfassungs-Modi", gepinnt in
// frontdoor-navguard-mounted.test.tsx). Alles andere ging vorbei:
//
//   apps/web/src/shell/Sidebar.tsx:321  roher NavLink nach /profil
//   apps/web/src/shell/Topbar.tsx:127   Benachrichtigungsziel per direktem navigate
//   apps/web/src/shell/Topbar.tsx:337   Suche per direktem navigate
//   apps/web/src/shell/Topbar.tsx:418   Hilfe per direktem navigate
//   apps/web/src/shell/Logo.tsx:8       roher Link
//   Reload/Tab-Schließen                kein beforeunload (Capture.tsx hatte einen)
//
// Und der Befund ist größer als die Vordertür: das sind SHELL-Ausgänge. Dieselben Lücken bestanden
// damit auf JEDER geschützten Seite, auch auf `/erfassen`, dessen Wächter in früheren Runden
// abgenommen wurde — dort fehlte nie der Wächter, sondern es fehlten dieselben fünf Aufrufe.
//
// Dieser Test fährt die ECHTE Shell (Sidebar, Topbar, Logo) gegen die ECHTE Vordertür und
// verlangt für jeden dieser Ausgänge: Warnung erscheint, Wechsel findet NICHT statt. Er pinnt
// zusätzlich beide Ränder des Dirty-Prädikats (geleerter Body = dirty, nur geöffneter Entwurf =
// sauber), damit ein späterer Umbau nicht die eine Hälfte gegen die andere eintauscht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  };
  box.seed = async (p: P) => (await svc.createDraft(p, "u1")).id;
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    drafts: {
      get: vi.fn(async (id: string) => svc.getDraft(id)),
      create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
      update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
      promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
    },
    reasoner: {
      structure: vi.fn(async () => ({
        title: "Dichtungswechsel L4",
        statement: "Dichtung vor jedem Anlauf prüfen.",
        conditions: [],
        measures: [],
        tags: [],
        demo: true,
        fallbackReason: "no-model",
      })),
      assist: vi.fn(async () => ({ text: "", demo: true })),
      status: vi.fn(async () => ({ active: true, mode: "cloud", reachable: "active" })),
      config: vi.fn(async () => null),
    },
    // Eine echte Benachrichtigung MIT eindeutigem Ziel — sonst rendert die Glocke keinen Sprung.
    notifications: {
      list: vi.fn(async () => [
        { id: "n1", kind: "conflict", title: "Widerspruch entdeckt", createdAt: "2026-07-25" },
      ]),
      markSeen: vi.fn(async () => ({})),
    },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { Sidebar } from "../../apps/web/src/shell/Sidebar";
import { Topbar } from "../../apps/web/src/shell/Topbar";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const START = "/capture/frontdoor";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
// Idempotent und in afterEach garantiert: eine FEHLGESCHLAGENE Erwartung darf die Seite nicht
// montiert zurücklassen, sonst überlebt ihr beforeunload-Handler am globalen `window` und verfälscht
// die folgenden Fälle (genau das hat die erste Fassung dieses Tests getan).
let mounted = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function LocationProbe(): JSX.Element {
  const loc = useLocation();
  return createElement("span", { "data-testid": "loc" }, `${loc.pathname}${loc.search}`);
}

async function mount(url: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mounted = true;
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
                MemoryRouter,
                { initialEntries: [url] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    // Die ECHTE Shell um die ECHTE Seite — genau die Kombination, in der die
                    // Lücken bestanden.
                    createElement(Sidebar),
                    createElement(Topbar),
                    createElement(CaptureFrontDoor),
                    createElement(LocationProbe),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function unmount(): void {
  if (!mounted) {
    return;
  }
  mounted = false;
  act(() => root.unmount());
  container.remove();
}

function loc(): string {
  return container.querySelector("[data-testid=loc]")?.textContent ?? "";
}

// Der Wächter-Dialog rendert im Provider (außerhalb des Seitenbaums) — deshalb am document lesen.
function guardAsked(): boolean {
  return (document.body.textContent ?? "").includes(i18n.t("nav.guard.title"));
}

function editor(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Body-Editor nicht gefunden");
  }
  return el;
}

async function setBody(html: string): Promise<void> {
  const el = editor();
  await act(async () => {
    el.innerHTML = html;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function click(el: Element, init: MouseEventInit = {}): Promise<void> {
  await act(async () => {
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }),
    );
    await flush();
  });
}

function within(selector: string): HTMLElement {
  const el = container.querySelector(selector);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`${selector} nicht gefunden`);
  }
  return el;
}

function anchorTo(scope: HTMLElement, href: string): HTMLAnchorElement {
  const el = [...scope.querySelectorAll("a")].find((a) => a.getAttribute("href") === href);
  if (!(el instanceof HTMLAnchorElement)) {
    throw new Error(`Link auf ${href} nicht gefunden`);
  }
  return el;
}

function buttonByLabel(scope: HTMLElement, label: string): HTMLButtonElement {
  const el = [...scope.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === label,
  );
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${label}" nicht gefunden`);
  }
  return el;
}

// Die fünf Shell-Ausgänge, die ben benannt hat — jeder als eigener, benannter Weg.
const SHELL_EXITS: { name: string; run: () => Promise<void> }[] = [
  {
    name: "Sidebar → Profil (war ein roher NavLink)",
    run: async () => click(anchorTo(within("aside"), "/profil")),
  },
  {
    name: "Logo → Startseite (war ein roher Link)",
    run: async () => {
      const logo = within("aside").querySelector<HTMLAnchorElement>('a[aria-label^="Klarwerk"]');
      if (!logo) {
        throw new Error("Logo-Link nicht gefunden");
      }
      await click(logo);
    },
  },
  {
    name: "Topbar → Hilfe (war ein direktes navigate)",
    run: async () => click(buttonByLabel(within("header"), i18n.t("nav.help"))),
  },
  {
    name: "Topbar → Suche (war ein direktes navigate)",
    run: async () => {
      const input = within("header").querySelector<HTMLInputElement>("input[type=search]");
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      await act(async () => {
        setter?.call(input, "Ventil");
        input?.dispatchEvent(new Event("input", { bubbles: true }));
        await flush();
      });
      await act(async () => {
        input
          ?.closest("form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        await flush();
      });
    },
  },
  {
    name: "Topbar → Benachrichtigungsziel (war ein direktes navigate)",
    run: async () => {
      const header = within("header");
      await click(buttonByLabel(header, i18n.t("topbar.notifications")));
      const target = [...header.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes("Widerspruch entdeckt"),
      );
      if (!target) {
        throw new Error("Benachrichtigungs-Eintrag nicht gefunden");
      }
      await click(target);
    },
  },
];

async function seedDraft(): Promise<string> {
  return box.seed({
    title: "Dichtungswechsel L4",
    statement: "Dichtung vor jedem Anlauf prüfen.",
    type: "best_practice",
    category: "Allgemein",
    bodyHtml: "<p>Alter Absatz</p>",
    origin: "frontdoor",
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("mega11 Block B-2: JEDER Shell-Ausgang läuft durch den Wächter", () => {
  for (const exit of SHELL_EXITS) {
    it(`${exit.name}: warnt und wechselt NICHT`, async () => {
      await mount(START);
      await setBody("<p>Frisch getippter Inhalt</p>");
      expect(guardAsked()).toBe(false);

      await exit.run();

      expect(guardAsked(), "der Wächter hat nicht gefragt").toBe(true);
      expect(loc(), "trotz Warnung gewechselt").toBe(START);
      unmount();
    });

    it(`${exit.name}: ohne Änderung wechselt sofort (keine Warnung ohne Verlust)`, async () => {
      const id = await seedDraft();
      await mount(`${START}?draft=${id}`);
      // Der Entwurf ist geladen, aber nichts wurde angefasst.
      expect(editor().innerHTML).toContain("Alter Absatz");

      await exit.run();

      expect(guardAsked()).toBe(false);
      expect(loc()).not.toBe(`${START}?draft=${id}`);
      unmount();
    });
  }

  it("Modifikator-Klick (neuer Tab) bleibt beim Browser — er verlässt die Seite nicht", async () => {
    await mount(START);
    await setBody("<p>Frisch getippter Inhalt</p>");

    await click(anchorTo(within("aside"), "/profil"), { metaKey: true });

    // Weder Warnung (nichts geht verloren) noch In-App-Wechsel.
    expect(guardAsked()).toBe(false);
    expect(loc()).toBe(START);
    unmount();
  });
});

describe("mega11 Block B-1: Neuladen/Tab-Schließen warnt ebenfalls", () => {
  function beforeUnloadBlocked(): boolean {
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  }

  it("geänderter Inhalt → der Browser fragt vor dem Neuladen", async () => {
    await mount(START);
    expect(beforeUnloadBlocked(), "sauberes Formular darf nicht warnen").toBe(false);

    await setBody("<p>Frisch getippter Inhalt</p>");

    expect(beforeUnloadBlocked()).toBe(true);
    unmount();
  });

  it("der ausdrücklich GELEERTE Body ist dirty, der nur geöffnete Entwurf ist sauber", async () => {
    const id = await seedDraft();
    await mount(`${START}?draft=${id}`);
    expect(editor().innerHTML).toContain("Alter Absatz");

    // Nur geöffnet: es gibt nichts zu verlieren — weder Browser- noch In-App-Warnung.
    expect(beforeUnloadBlocked(), "nur geöffneter Entwurf hat gewarnt").toBe(false);

    // ⌘A + Rücktaste: die Löschung, die Block A speicherbar gemacht hat, muss auch geschützt sein —
    // sonst hätten wir sie speicherbar gemacht und gleichzeitig weiter still verlieren lassen.
    await setBody("");

    expect(beforeUnloadBlocked(), "geleerter Body galt als sauber").toBe(true);
    await click(anchorTo(within("aside"), "/profil"));
    expect(guardAsked()).toBe(true);
    expect(loc()).toBe(`${START}?draft=${id}`);
    unmount();
  });

  it("nach dem Aushängen der Seite warnt nichts mehr (kein Handler-Leck)", async () => {
    await mount(START);
    await setBody("<p>Frisch getippter Inhalt</p>");
    expect(beforeUnloadBlocked()).toBe(true);

    unmount();

    expect(beforeUnloadBlocked()).toBe(false);
  });
});
