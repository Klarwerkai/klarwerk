// @vitest-environment jsdom
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";
import { ABBAU_GRENZE_MS, schliesseChromium } from "./chromium-abbau";
import { t1bAbbau, t1bQuelle } from "./t1b-original";

const POP = "tests/app/navguard-pop-mounted.test.tsx";
const RASTER = "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts";
const KARTEN = "tests/start-karten-schmal/start-karten-schmal-chromium.test.tsx";

function aus<T = unknown>(quelle: string, scope: object): T {
  return runInNewContext(ts.transpile(quelle, { target: ts.ScriptTarget.ES2022 }), scope) as T;
}

function pop(): (aktion: () => void, anzahl?: number) => Promise<void> {
  return aus(`${t1bQuelle(POP, ["wartePop"])}; wartePop`, {
    window,
    Date,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, 80)),
    clearTimeout,
  }) as ReturnType<typeof pop>;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

it("popstate-Zähler: wartet auch hinter abschneidendem Listener auf das zweite Ereignis", async () => {
  const abschneiden = (e: Event) => e.stopImmediatePropagation();
  window.addEventListener("popstate", abschneiden);
  let fertig = false;
  const p = pop()(() => window.dispatchEvent(new PopStateEvent("popstate")), 2).then(() => {
    fertig = true;
  });
  try {
    await Promise.resolve();
    await Promise.resolve();
    expect(fertig, "zweites popstate steht noch aus").toBe(false);
  } finally {
    window.dispatchEvent(new PopStateEvent("popstate"));
    await p;
    window.removeEventListener("popstate", abschneiden);
  }
  expect(fertig).toBe(true);
  await pop()(() => window.dispatchEvent(new PopStateEvent("popstate")));
});

it("popstate-Zähler: dauerhaft zweites Ereignis fehlt, erster Fehler nennt 1 von 2", async () => {
  const start = Date.now();
  let fehler: unknown;
  try {
    await pop()(() => window.dispatchEvent(new PopStateEvent("popstate")), 2);
  } catch (e) {
    fehler = e;
  }
  console.log(
    `popstate-Zähler: zweites Ereignis fehlt · ${Date.now() - start}ms · erster Fehler/letzter Zustand: ${String(fehler)}`,
  );
  expect(String(fehler)).toMatch(/1 von 2 popstate.*\d+ms.*letzter Zustand/);
});

it("Kante 3 bindet die erwarteten zwei Ereignisse am Originalaufruf", async () => {
  const zahlen: number[] = [];
  await aus<Promise<void>>(`(async () => { ${t1bQuelle(POP, [], "Kante 3:")} })()`, {
    trailToCapture: async () => {},
    type: async () => {},
    act: async (fn: () => unknown) => fn(),
    wartePop: async (_fn: unknown, anzahl = 1) => {
      zahlen.push(anzahl);
    },
    warteRouter: async () => {},
    container: { querySelectorAll: () => [1] },
    expect,
    pageText: () => "Ungespeicherte Eingabe",
    path: () => "/erfassen",
    field: () => ({ value: "Doppelklick" }),
    clickDialog: async () => {
      throw new Error("Ende der untersuchten Kante");
    },
  }).catch((e: Error) => {
    expect(e.message).toBe("Ende der untersuchten Kante");
  });
  expect(zahlen).toEqual([2]);
});

const rollen = ["viewer", "experte", "controller", "admin", "auditor"];
const namen = ["Betrachter", "Experte", "Controller", "Administrator", "Auditor"];

async function raster(gefunden: string[]): Promise<{ fehler: string | null; knoepfe: unknown[] }> {
  document.body.innerHTML = '<div data-testid="detail-ansicht-rolle"><div></div></div>';
  const grid = document.querySelector('[data-testid="detail-ansicht-rolle"] > div');
  if (!grid) throw new Error("Prüfraster fehlt");
  Object.defineProperty(grid, "clientWidth", { value: 300 });
  for (const name of gefunden) {
    const b = document.createElement("button");
    b.setAttribute("aria-pressed", "false");
    b.textContent = name;
    b.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 300,
      height: 30,
      left: 0,
      right: 300,
      top: 0,
      bottom: 30,
      toJSON: () => ({}),
    });
    grid.append(b);
  }
  const browserScope = {
    document: {
      querySelector: document.querySelector.bind(document),
      fonts: { ready: Promise.resolve() },
      documentElement: { scrollWidth: 320 },
      createRange: () => ({ selectNodeContents: () => {}, getClientRects: () => [] }),
    },
    window: { innerWidth: 320 },
    Date,
    requestAnimationFrame: (fn: () => void) => setTimeout(fn, 0),
    getComputedStyle: () => ({
      gridTemplateColumns: "300px",
      borderLeftWidth: "0",
      borderRightWidth: "0",
      paddingLeft: "0",
      paddingRight: "0",
    }),
  };
  const seite = {
    setViewportSize: async () => {},
    evaluate: (quelle: string, arg: unknown) => aus(`(${quelle})(arg)`, { ...browserScope, arg }),
  };
  return (await aus(
    `(async () => { ${t1bQuelle(RASTER, ["NAMEN", "REITER", "MESSEN", "messen"])}; return await messen(320, false, 30); })()`,
    {
      ROLES: rollen,
      i18n: { t: (key: string) => namen[rollen.indexOf(key.replace("role.name.", ""))] },
      stand: { seite },
      fn: (s: string) => s,
    },
  )) as Awaited<ReturnType<typeof raster>>;
}

it("Knopfzahl abgeleitet: fünf Produktrollen mit fünf Knöpfen werden bereit", async () => {
  const m = await raster(namen);
  expect(m.fehler).toBeNull();
  expect(m.knoepfe).toHaveLength(5);
});

it("Knopfzahl abgeleitet: gefilterte fünfte Rolle bleibt rot mit Namen und Anzahlen", async () => {
  const start = Date.now();
  const m = await raster(namen.slice(0, 4));
  console.log(
    `Knopfzahl abgeleitet: fünfte Rolle fehlt · ${Date.now() - start}ms · erster Fehler/letzter Zustand: ${m.fehler}`,
  );
  expect(m.fehler).toContain("erwartet 5");
  expect(m.fehler).toContain("gefunden 4");
  for (const name of namen) expect(m.fehler).toContain(name);
  expect(m.fehler).toMatch(/\d+ms.*letzter Zustand/);
});

for (const datei of [KARTEN, RASTER, "tests/tor-bereitschaft/t1b-raster.test.ts"]) {
  it(`Abbaudauer gepinnt: Original-afterAll misst die echte close-Promise · ${datei}`, async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    let zeit = 0;
    vi.spyOn(performance, "now").mockImplementation(() => zeit);
    let schliesse!: () => void;
    const browser = {
      close: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            schliesse = resolve;
          }),
      ),
    };
    let hook!: () => Promise<void>;
    let rahmen = 0;
    aus(t1bAbbau(datei), {
      schliesseChromium,
      browser,
      stand: { browser, app: { close: async () => {} } },
      afterAll: (fn: () => Promise<void>, ms: number) => {
        hook = fn;
        rahmen = ms;
      },
      beende: async (s: { browser: typeof browser }) => s.browser.close(),
    });
    const p = hook();
    await Promise.resolve();
    expect(log).not.toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalledTimes(1);
    zeit = 17.25;
    schliesse();
    await p;
    expect(rahmen).toBe(60_000);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.flat().join("\n")).toContain("17.25ms");
    expect(log.mock.calls.flat().join("\n")).toContain(datei);
  });
}

for (const negativ of [false, true]) {
  it(`Livewall-Mock: zweiter Abruf bleibt ${negativ ? "leer" : "verzögert vollständig"} und wird zurückgestellt`, async () => {
    const standard = async () => ({ saved: ["Standardantwort"] });
    const get = vi.fn(standard);
    const WAND = { saved: ["Testantwort"] };
    let abrufe = 0;
    const seitenMarkup = async () => {
      const antworten = [await get(), await get()];
      abrufe += antworten.length;
      expect(antworten).toEqual([negativ ? { saved: [] } : WAND, negativ ? { saved: [] } : WAND]);
      if (negativ) throw new Error('Startkarten nicht bereit: {"zuletzt":[]}');
      return "Titel";
    };
    await aus(
      `(async () => { ${t1bQuelle(KARTEN, [], negativ ? "dauerhaft leere Livewall" : "wartet auf die gezielt verspätete Livewall")} })()`,
      {
        vi,
        expect,
        endpoints: { livewall: { get } },
        WAND,
        seitenMarkup,
        ZULETZT: [{ title: "Titel" }],
        MELDUNGEN: [],
        Date,
        console,
        setTimeout: (fn: () => void) => {
          fn();
        },
      },
    );
    expect(abrufe).toBe(2);
    expect(get.getMockImplementation()).toBe(standard);
  });
}

for (const defekt of ["unbestätigt", "verspätet bestätigt", "close lehnt ab"] as const) {
  it(`Abbaudauer gepinnt: ${defekt} bleibt rot mit erstem Fehler, Dauer und Zustand`, async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const datei = `Abbau-Negativfall: ${defekt}`;
    const browser = {
      close: async () => {
        if (defekt === "close lehnt ab") throw new Error("ECHTER CLOSE-FEHLER");
        if (defekt === "unbestätigt") await new Promise(() => {});
        // Verstreichen ohne Timerzustellung: simuliert einen blockierten Eventloop.
        else vi.spyOn(performance, "now").mockReturnValue(ABBAU_GRENZE_MS + 1);
      },
    };
    try {
      expect(ABBAU_GRENZE_MS).toBeLessThan(60_000);
      const ergebnis = schliesseChromium(datei, browser).catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(ABBAU_GRENZE_MS + 1);
      const fehler = String(await ergebnis);
      console.log(`${datei} · erster Fehler/letzter Zustand: ${fehler}`);
      expect(fehler).toContain(datei);
      expect(fehler).toMatch(/\d+\.\d+ms.*Grenze.*erster Fehler.*letzter Zustand/);
      expect(fehler).toContain(
        defekt === "close lehnt ab" ? "ECHTER CLOSE-FEHLER" : "Abbaugrenze überschritten",
      );
      expect(fehler).toContain(
        defekt === "verspätet bestätigt" ? "close() bestätigt" : "close() unbestätigt",
      );
    } finally {
      vi.useRealTimers();
    }
  });
}

for (const praefix of ["dauerhaft leere Livewall", "wartet auf die gezielt verspätete Livewall"]) {
  it(`Livewall-Mock: auch beim Abbruch zurückgestellt · ${praefix}`, async () => {
    const standard = async () => ({ saved: [] });
    const get = vi.fn(standard);
    const ergebnis = aus<Promise<void>>(`(async () => { ${t1bQuelle(KARTEN, [], praefix)} })()`, {
      vi,
      expect,
      endpoints: { livewall: { get } },
      WAND: { saved: [] },
      seitenMarkup: async () => {
        throw new Error("ABSICHTLICHER MOUNT-FEHLER");
      },
      ZULETZT: [],
      MELDUNGEN: [],
      Date,
      console,
    });
    await expect(ergebnis).rejects.toThrow("ABSICHTLICHER MOUNT-FEHLER");
    expect(get.getMockImplementation()).toBe(standard);
  });
}

it("Abbaudauer: auch ein mehrzeiliger close-Fehler bleibt eine Protokollzeile", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const ursache = new Error("Verbindung weg\nBrowserprotokoll: beendet");
  const fehler = await schliesseChromium("mehrzeiliger close-Fehler", {
    close: async () => {
      throw ursache;
    },
  }).catch((e: Error) => e);
  expect(fehler).toHaveProperty("cause", ursache);
  expect(log).toHaveBeenCalledTimes(1);
  const zeile = String(log.mock.calls[0]?.[0]);
  expect(zeile).not.toMatch(/[\r\n]/);
  expect(zeile).toContain("Verbindung weg | Browserprotokoll: beendet");
});
