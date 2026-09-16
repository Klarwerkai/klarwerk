// @vitest-environment jsdom
// ================================================================================================
// JOB 4193 · ENTWURF-MOBIL-DESKTOP-R — DIE RÜCKFRAGE IST AUF DEM TELEFON WIRKLICH LESBAR.
// ================================================================================================
//
// WARUM CHROMIUM UND NICHT JSDOM: die gemounteten Fälle nebenan messen das VERHALTEN (welches Feld
// weicht ab, was bleibt stehen, was wird gespeichert). Ob der Kasten auf 390 px auch LESBAR ist —
// nichts abgeschnitten, nichts überlappend, nichts aus dem Fenster —, ist Layout. jsdom rechnet
// keine Textrechtecke und wendet keine Media Query an; dort stünde jeder Satz vollständig im DOM,
// ob man ihn sieht oder nicht. Dieselbe Begründung und dieselbe Bühne wie
// `tests/start-karten-schmal/start-karten-schmal-chromium.test.tsx` (JOB 3118).
//
// DIE BÜHNE, EHRLICH BENANNT:
//   · Das MARKUP stammt aus der echten, in jsdom gemounteten `pages/Mobile` — über den echten Weg
//     bis in den Konflikt hinein (offline gespeichert, Serverstand geändert, wieder geöffnet), mit
//     dem echten `CaptureService` dahinter. Kein nachgebautes HTML.
//   · Das CSS entsteht aus der ECHTEN Tailwind-Konfiguration der App über die echten Klassennamen
//     dieses Markups — kein handgeschriebener Stilblock, der messen würde, was er selbst behauptet.
//   · Die Schriftdateien der App sind nicht geladen; Chromium löst `system-ui, sans-serif` auf.
//     Keine Aussage hier hängt an einem Millimeter Laufweite: gemessen wird, ob ein Zeichen
//     INNERHALB seines Kastens liegt, nicht wie breit es ist.
//
// GEMESSEN WIRD SCHMAL (390 px) UND BREIT (1280 px), wie die Abnahme es verlangt.
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_payload: Record<string, unknown>): Promise<string> => "",
  fremdSchreiben: async (_id: string, _payload: Record<string, unknown>): Promise<void> => {},
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
  const { CaptureService, DraftStaleError } = await import("../../services/capture/src/service");
  const { ApiError } = await import("../../apps/web/src/api/client");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  };
  box.seed = async (payload: P) => (await svc.createDraft(payload, "u1")).id;
  box.fremdSchreiben = async (id: string, payload: P) => {
    await svc.continueDraft(id, payload, "u2");
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      ko: { list: ok([]) },
      conflicts: { list: ok([]) },
      library: { search: ok([]) },
      ask: { ask: ok({ answered: false }) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => (await svc.resumeDraft(id))?.draft),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P, opts?: { expectedUpdatedAt?: string }) => {
          try {
            return await svc.continueDraft(
              id,
              p,
              "u1",
              opts?.expectedUpdatedAt ? { expectedUpdatedAt: opts.expectedUpdatedAt } : {},
            );
          } catch (e) {
            if (e instanceof DraftStaleError) {
              throw new ApiError(409, "DRAFT_STALE", e.message);
            }
            throw e;
          }
        }),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Mobile } from "../../apps/web/src/pages/Mobile";
import tailwindConfig from "../../apps/web/tailwind.config";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// Lange, echte Sätze — eine Rückfrage über zwei Wörter wäre auf jeder Breite lesbar und prüfte nichts.
const OFFLINE_TEXT =
  "Unterwegs an der Presse notiert: Dosierwert vor dem Schichtwechsel auf 4,2 bar prüfen und im Übergabebuch abzeichnen.";
const SERVER_TEXT =
  "Am Desktop ergänzt: Dosierwert auf 3,8 bar prüfen, zusätzlich die Dichtung an Ventil V4 sichten.";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Die echte Fläche, über den echten Weg bis IN die Rückfrage: offline gespeichert, Serverstand
 * geändert, Entwurf wieder geöffnet. Zurück kommt das Markup, das der Browser danach zeichnet.
 */
async function konfliktMarkup(): Promise<string> {
  await i18n.changeLanguage("de");
  box.reset();
  window.localStorage.clear();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  const id = await box.seed({ title: "Schichtwechsel Presse 3", statement: "Ursprung" });

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
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
                  createElement(
                    MemoryRouter,
                    { initialEntries: [{ pathname: "/mobile", state: { from: "/start" } }] },
                    createElement(
                      Routes,
                      null,
                      createElement(Route, { path: "/mobile", element: createElement(Mobile) }),
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

    const klick = async (el: Element | null | undefined): Promise<void> => {
      if (!(el instanceof HTMLButtonElement)) {
        throw new Error("Knopf nicht gefunden");
      }
      await act(async () => {
        el.click();
        await flush();
      });
    };
    const knopf = (teil: string): HTMLButtonElement | undefined =>
      [...container.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
      );
    const netz = async (an: boolean): Promise<void> => {
      Object.defineProperty(navigator, "onLine", { value: an, configurable: true });
      await act(async () => {
        window.dispatchEvent(new Event(an ? "online" : "offline"));
        await flush();
      });
    };

    await klick(container.querySelector(`button[title="${i18n.t("mob.resume")}"]`));
    await netz(false);
    const feld = container.querySelector("textarea");
    if (!(feld instanceof HTMLTextAreaElement)) {
      throw new Error("Textfeld nicht gefunden");
    }
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      feld,
      OFFLINE_TEXT,
    );
    await act(async () => {
      feld.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    await klick(knopf(i18n.t("mob.update")));
    await box.fremdSchreiben(id, { statement: SERVER_TEXT });
    await netz(true);
    await klick(container.querySelector(`button[title="${i18n.t("mob.resume")}"]`));

    if (!container.querySelector('[data-testid="mob-stand-konflikt"]')) {
      throw new Error("Rückfrage steht nicht — die Bühne misst sonst nichts");
    }
    return container.innerHTML;
  } finally {
    await act(async () => root.unmount());
    container.remove();
    qc.clear();
  }
}

const WURZEL = join(__dirname, "..", "..");
const verlangeModul = createRequire(join(WURZEL, "apps", "web", "index.js"));

async function stylesheet(markup: string): Promise<string> {
  const postcss = verlangeModul("postcss") as (p: unknown[]) => {
    process(css: string, o: Record<string, unknown>): Promise<{ css: string }>;
  };
  const tailwind = verlangeModul("tailwindcss") as (c: unknown) => unknown;
  const ergebnis = await postcss([
    tailwind({ ...tailwindConfig, content: [{ raw: markup, extension: "html" }] }),
  ]).process("@tailwind base;\n@tailwind utilities;", { from: undefined });
  return ergebnis.css;
}

interface Textstelle {
  voll: string;
  sichtbar: string;
}
interface Messung {
  dokumentBreite: number;
  fensterBreite: number;
  kasten: { left: number; right: number; width: number };
  /** Jede Textstelle IM Kasten: was dasteht und was ein Mensch davon wirklich sieht. */
  stellen: Textstelle[];
  /** Die beiden Wege aus dem Kasten — Kästen und ob sie sich überlappen. */
  knoepfe: { text: string; left: number; right: number; top: number; bottom: number }[];
  knopfUeberlappung: boolean;
  /** Liegt der ganze Kasten im Fenster? */
  imFenster: boolean;
}

interface Page {
  setViewportSize(o: { width: number; height: number }): Promise<void>;
  goto(url: string): Promise<unknown>;
  route(muster: string, handler: (route: Weiche) => unknown): Promise<void>;
  evaluate<T>(fn: string): Promise<T>;
}
interface Weiche {
  fulfill(o: Record<string, unknown>): Promise<void>;
}
interface Browser {
  newPage(o: Record<string, unknown>): Promise<Page>;
  close(): Promise<void>;
}

const MESSUNG = `(() => {
  const sichtbarerText = (el) => {
    const kasten = el.getBoundingClientRect();
    let text = "";
    for (const knoten of el.childNodes) {
      if (knoten.nodeType !== 3) { continue; }
      const roh = knoten.textContent ?? "";
      const bereich = document.createRange();
      for (let i = 0; i < roh.length; i++) {
        bereich.setStart(knoten, i);
        bereich.setEnd(knoten, i + 1);
        const r = bereich.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) { text += roh[i]; continue; }
        const drin = r.left >= kasten.left - 0.5 && r.right <= kasten.right + 0.5
          && r.top >= kasten.top - 0.5 && r.bottom <= kasten.bottom + 0.5;
        if (drin) { text += roh[i]; }
      }
    }
    return text;
  };
  const kastenEl = document.querySelector('[data-testid="mob-stand-konflikt"]');
  const k = kastenEl.getBoundingClientRect();
  const stellen = [...kastenEl.querySelectorAll("p, div")]
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim()))
    .map((el) => ({ voll: el.textContent ?? "", sichtbar: sichtbarerText(el) }));
  const knoepfe = [...kastenEl.querySelectorAll("button")].map((b) => {
    const r = b.getBoundingClientRect();
    return { text: (b.textContent ?? "").trim(), left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });
  let ueberlappung = false;
  for (let i = 0; i < knoepfe.length; i++) {
    for (let j = i + 1; j < knoepfe.length; j++) {
      const a = knoepfe[i]; const b = knoepfe[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) { ueberlappung = true; }
    }
  }
  return {
    dokumentBreite: document.documentElement.scrollWidth,
    fensterBreite: window.innerWidth,
    kasten: { left: k.left, right: k.right, width: k.width },
    stellen,
    knoepfe,
    knopfUeberlappung: ueberlappung,
    imFenster: k.left >= -0.5 && k.right <= window.innerWidth + 0.5,
  };
})()`;

const BUEHNE = "http://rueckfrage.pruefstand/";
let seitenInhalt = "";
let browser: Browser | null = null;
let seite: Page | null = null;
let vorrat: { html: string; css: string } | null = null;
const messungen = new Map<number, Messung>();

async function messen(breite: number): Promise<Messung> {
  const vorhanden = messungen.get(breite);
  if (vorhanden) {
    return vorhanden;
  }
  if (!vorrat) {
    const html = await konfliktMarkup();
    vorrat = { html, css: await stylesheet(html) };
  }
  const s = seite as Page;
  await s.setViewportSize({ width: breite, height: 844 });
  seitenInhalt = `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${vorrat.css}</style></head><body>${vorrat.html}</body></html>`;
  await s.goto(`${BUEHNE}mobile`);
  const messung = await s.evaluate<Messung>(MESSUNG);
  messungen.set(breite, messung);
  return messung;
}

beforeAll(async () => {
  const { chromium } = verlangeModul("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  seite = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await seite.route("**/*", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: seitenInhalt }),
  );
}, 180_000);

afterAll(async () => {
  await schliesseChromium(
    "tests/entwurf-mobil-desktop/rueckfrage-schmal-chromium.test.tsx",
    browser,
  );
}, 60_000);

describe.each([390, 1280])(
  "JOB 4193 · die Rückfrage bei %i px — nichts abgeschnitten, nichts überlappend",
  (breite) => {
    it("der Kasten liegt im Fenster, und die Seite läuft nicht seitlich über", async () => {
      const m = await messen(breite);
      console.log(
        `JOB 4193 · ${breite}px · Kasten ${m.kasten.left.toFixed(1)}–${m.kasten.right.toFixed(1)} px (${m.kasten.width.toFixed(1)} breit) · Fenster ${m.fensterBreite} · scrollWidth ${m.dokumentBreite} · ${m.stellen.length} Textstellen, ${m.knoepfe.length} Wege`,
      );
      expect(m.imFenster).toBe(true);
      expect(m.dokumentBreite).toBeLessThanOrEqual(m.fensterBreite);
      expect(m.kasten.width).toBeGreaterThan(100);
    });

    it("jeder Satz im Kasten ist vollständig sichtbar — nichts ist abgeschnitten", async () => {
      const m = await messen(breite);
      const beschnitten = m.stellen.filter((s) => s.sichtbar.trim() !== s.voll.trim());
      expect(
        beschnitten.map((s) => `${s.voll.slice(0, 40)} → sichtbar: ${s.sichtbar.slice(0, 40)}`),
      ).toEqual([]);
    });

    it("die Rückfrage trägt ihre Aussage, ihre Feldangabe und BEIDE Wege", async () => {
      const m = await messen(breite);
      const text = m.stellen.map((s) => s.sichtbar).join(" ");
      expect(text).toContain(i18n.t("mob.stand.titelOffline"));
      expect(text).toContain(i18n.t("mob.stand.feld.statement"));
      expect(m.knoepfe.map((k) => k.text)).toEqual([
        i18n.t("mob.stand.holen"),
        i18n.t("mob.stand.behalten"),
      ]);
    });

    it("die beiden Wege überlappen einander nicht", async () => {
      const m = await messen(breite);
      expect(m.knopfUeberlappung).toBe(false);
      for (const k of m.knoepfe) {
        expect(k.right).toBeLessThanOrEqual(m.kasten.right + 0.5);
        expect(k.left).toBeGreaterThanOrEqual(m.kasten.left - 0.5);
      }
    });
  },
);
