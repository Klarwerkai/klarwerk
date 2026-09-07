// JOB 3199 · CDP-Stichproben eines einzigen Chromium-Starts, ohne ps/pgrep oder Server.
// Basisstand: der unmittelbare Elterncommit des Prüfstands (wird beim Einbau gesetzt)
// Der Playwright-Import ordnet diesen Fall der seriellen Browsergruppe zu (unten nachgerechnet).
// Einzelaufrufe außerhalb tools/test müssen ebenfalls unter tools/browserdeckel.sh laufen.
// Das Maximum gilt nur für die beiden CDP-Stichproben: Spitzen dazwischen erhebt niemand.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { join } from "node:path";
import { type Browser, chromium } from "playwright";
import { expect, it } from "vitest";
import { WURZEL, ermittleBrowserbefund } from "./browser-gruppe";

async function begrenzt<T>(arbeit: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      arbeit,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Chromium-Prozessmessung: Zeitgrenze ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

it("C1 · ein Chromium: Prozesszahl bei einer und vier gleichzeitig offenen Seiten oder wörtlicher Ausfallbeleg", async () => {
  const beginn = Date.now();
  const datei = "tests/tor-inventar/chromium-prozesszahl.test.ts";
  const befund = ermittleBrowserbefund();
  expect(befund.browserTests).toContain(datei);
  expect(befund.startdateien).toContain(datei);
  const last = {
    vor: loadavg(),
    seiten: [1, 4],
    inhalt: "statische data:-HTML-Seiten, keine App/Server/Netzlast",
  };
  const messungen: Array<{
    seiten: number;
    zeit: string;
    prozesse: number;
    prozessliste: Array<{ id: number; type: string; cpuTime: number }>;
  }> = [];
  const fehler: string[] = [];
  let browser: Browser | undefined;
  try {
    // Genau ein launch; kein Retry bei Sandbox-/CDP-Fehlern und keine erfundene Ersatzanzahl.
    browser = await chromium.launch({ headless: true, timeout: 10_000 });
    const gestartet = browser;
    await begrenzt(
      (async () => {
        const cdp = await gestartet.newBrowserCDPSession();
        const kontext = await gestartet.newContext();
        for (const anzahl of last.seiten) {
          while (kontext.pages().length < anzahl) {
            const seite = await kontext.newPage();
            await seite.goto(
              `data:text/html,<title>Prozessmessung</title><p>Seite ${kontext.pages().length}</p>`,
              { timeout: 5000 },
            );
          }
          const { processInfo } = await cdp.send("SystemInfo.getProcessInfo");
          if (processInfo.length === 0)
            throw new Error("SystemInfo.getProcessInfo: leere Prozessliste");
          messungen.push({
            seiten: kontext.pages().length,
            zeit: new Date().toISOString(),
            prozesse: new Set(processInfo.map((p) => p.id)).size,
            prozessliste: processInfo,
          });
        }
      })(),
      25_000,
    );
  } catch (error) {
    fehler.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (browser) {
      try {
        await begrenzt(browser.close(), 5000);
      } catch (error) {
        fehler.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  const gemessen = fehler.length === 0 && messungen.length === last.seiten.length;
  const beleg = {
    status: gemessen ? "gemessen" : "nicht gemessen",
    maximum: gemessen ? Math.max(...messungen.map((m) => m.prozesse)) : null,
    messungen,
    fehler,
    last: { ...last, nach: loadavg() },
    dauerMs: Date.now() - beginn,
    browsergruppe: befund.ketten.get(datei),
  };
  const ordner = join(WURZEL, ".local/run");
  mkdirSync(ordner, { recursive: true });
  const ziel = join(ordner, "chromium-prozesszahl.json");
  writeFileSync(ziel, `${JSON.stringify(beleg, null, 2)}\n`);
  console.log(
    gemessen
      ? `Chromium-Prozesszahl: Maximum ${beleg.maximum}; ${messungen.map((m) => `${m.seiten} Seiten: ${m.prozesse}`).join("; ")}; ${beleg.dauerMs}ms`
      : `Chromium-Prozesszahl: nicht gemessen — ${fehler.join("\n")}; ${beleg.dauerMs}ms`,
  );
  // Auch der erlaubte Ausfall muss einen lesbaren, ehrlichen Beleg hinterlassen.
  expect(JSON.parse(readFileSync(ziel, "utf8"))).toEqual(beleg);
  expect(beleg.dauerMs).toBeLessThan(60_000);
  if (!gemessen) {
    expect(beleg.maximum).toBeNull();
    expect(fehler.length).toBeGreaterThan(0);
  } else {
    expect(messungen.map((m) => m.seiten)).toEqual(last.seiten);
  }
}, 55_000);
