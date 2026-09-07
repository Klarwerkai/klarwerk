import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROLES } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { type Stand, fn, schattenLagen, starte, wechsle } from "../design/h6-chromium";
import { schliesseChromium } from "./chromium-abbau";
import { t1bQuelle } from "./t1b-original";

const DATEI = "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts";
let stand: Stand;

function original(praefix?: string): () => Promise<unknown> {
  const quelle = t1bQuelle(
    DATEI,
    [
      "NAMEN",
      "REITER",
      "MESSEN",
      "VORSCHAU_STARTEN",
      "FOKUS",
      "RING_OHNE_FOKUS",
      "LAGE",
      "WARTE_EINSTELLUNGEN",
      "messen",
      "seiteRoh",
      "vorschauStarten",
      "tabBisRueckweg",
    ],
    praefix,
  );
  return new Function(
    "scope",
    ts.transpile(
      `
    const { stand, expect, fn, wechsle, schattenLagen, ROLES, i18n } = scope;
    return async () => { ${quelle} ${praefix ? "" : "return await messen(320, false, 200);"} };
  `,
      { target: ts.ScriptTarget.ES2022 },
    ),
  )({ stand, expect, fn, wechsle, schattenLagen, ROLES, i18n });
}

describe("JOB 3152 · Originalmessung erkennt dauerhafte Raster- und Tastaturfehler", () => {
  beforeAll(async () => {
    stand = await starte("/admin", '[data-einst="seite"]', 320, 740);
    expect(stand.fehler).toBeNull();
  }, 60_000);
  afterAll(async () => {
    try {
      await schliesseChromium("tests/tor-bereitschaft/t1b-raster.test.ts", stand?.browser);
    } finally {
      await stand?.app?.close();
    }
  }, 60_000);

  for (const defekt of ["falsche Spaltenzahl", "Raster unsichtbar"] as const) {
    it(`${defekt} bleibt rot mit letztem Layoutzustand`, async () => {
      await wechsle(stand, "/admin", '[data-einst="seite"]');
      await stand.seite?.evaluate(
        fn(`(regel) => {
        const stil = document.createElement('style');
        stil.id = 'job3152-stoerung';
        stil.textContent = '[data-testid="detail-ansicht-rolle"] .grid { ' + regel + ' }';
        document.head.append(stil);
      }`),
        defekt === "falsche Spaltenzahl"
          ? "grid-template-columns: repeat(4, 1fr) !important;"
          : "display:none !important;",
      );
      const start = Date.now();
      try {
        const m = (await original()()) as { fehler: string | null };
        console.log(
          `Rollenraster · ${defekt} · ${Date.now() - start}ms · erster Fehler/letzter Zustand: ${m.fehler}`,
        );
        // S0 der Zieldatei verlangt m.fehler === null: dieser Zustand bleibt dort rot.
        expect(m.fehler).toContain("Rollenraster nicht bereit:");
        expect(m.fehler).toContain('"viewport":320');
      } finally {
        await stand.seite?.evaluate(
          fn(`() => document.querySelector('#job3152-stoerung')?.remove()`),
        );
      }
    });
  }

  for (const praefix of ["T2 ·", "T3 ·"]) {
    it(`${praefix} tabIndex=-1 am echten Rückweg bleibt rot`, async () => {
      const seite = stand.seite;
      if (!seite) throw new Error("Chromium-Seite fehlt");
      let verstellt = 0;
      stand.seite = new Proxy(seite, {
        get(ziel, name) {
          if (name === "evaluate")
            return async (pruefung: Parameters<typeof seite.evaluate>[0], arg?: unknown) => {
              const wert = await ziel.evaluate(pruefung, arg);
              if (pruefung.toString().includes("rollenName")) {
                await ziel.evaluate(
                  fn(`() => {
                document.querySelector('[data-testid="sperrkarte-vorschau"] button').tabIndex = -1;
              }`),
                );
                verstellt++;
              }
              return wert;
            };
          const wert = Reflect.get(ziel, name);
          return typeof wert === "function" ? wert.bind(ziel) : wert;
        },
      });
      const start = Date.now();
      let fehler: unknown;
      try {
        await original(praefix)();
      } catch (e) {
        fehler = e;
      } finally {
        stand.seite = seite;
        const lage = await seite.evaluate(
          fn(
            `() => ({ url: location.href, tabIndex: document.querySelector('[data-testid="sperrkarte-vorschau"] button')?.tabIndex })`,
          ),
        );
        console.log(
          `${praefix} GEGENPROBE · ${Date.now() - start}ms · erster Fehler: ${String(fehler).split("\n")[0]} · letzter Zustand: ${JSON.stringify(lage)}`,
        );
        await wechsle(stand, "/admin", '[data-einst="seite"]');
      }
      expect(verstellt).toBe(1);
      expect(String(fehler)).toMatch(/greater than 0/);
    });
  }
});
