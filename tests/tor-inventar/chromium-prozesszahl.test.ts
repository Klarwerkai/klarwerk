// JOB 3199 · CDP-Stichproben eines einzigen Chromium-Starts, ohne ps/pgrep oder Server.
// Basisstand: der unmittelbare Elterncommit des Prüfstands (wird beim Einbau gesetzt)
// Der Playwright-Import ordnet diesen Fall der seriellen Browsergruppe zu (unten nachgerechnet).
// Einzelaufrufe außerhalb tools/test müssen ebenfalls unter tools/browserdeckel.sh laufen.
// Das Maximum gilt nur für die beiden CDP-Stichproben: Spitzen dazwischen erhebt niemand.
// JOB 3581: Ein Ausfall ist nicht mehr pauschal erlaubt. Wie schwer er wiegt, entscheidet
// `prozesszahl-ausfall.ts` an EINER Tatsache — kam `chromium.launch()` zurück? Nur der verweigerte
// Start ist eine Umgebungsgrenze und bleibt grün; alles danach ist ein Befund und färbt rot.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { join } from "node:path";
import { type Browser, chromium } from "playwright";
import { expect, it } from "vitest";
import { WURZEL, ermittleBrowserbefund } from "./browser-gruppe";
import { klassifiziereAusfall } from "./prozesszahl-ausfall";

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
  // Kam der Start zurück? Die eine beobachtete Tatsache, an der die Ausfallklasse hängt
  // (`prozesszahl-ausfall.ts`) — nicht der Wortlaut einer Fehlermeldung.
  let gestartet = false;
  try {
    // Genau ein launch; kein Retry bei Sandbox-/CDP-Fehlern und keine erfundene Ersatzanzahl.
    browser = await chromium.launch({ headless: true, timeout: 10_000 });
    gestartet = true;
    const offen = browser;
    await begrenzt(
      (async () => {
        const cdp = await offen.newBrowserCDPSession();
        const kontext = await offen.newContext();
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
    // Wie schwer wiegt der Ausfall? Im Gutfall gibt es keinen: `null`, nicht ein beschönigendes
    // Urteil. Beurteilt wird an genau einer Stelle, in `prozesszahl-ausfall.ts`.
    ausfall: gemessen ? null : klassifiziereAusfall({ gestartet, fehler }),
    // Eigener Zeitstempel: ohne ihn sieht ein liegen gebliebener Beleg eines früheren Laufs aus
    // wie der von heute — im Ausfall ist `messungen` leer und trägt gar kein `zeit`.
    erstelltAm: new Date().toISOString(),
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
      : `Chromium-Prozesszahl: nicht gemessen (Klasse ${beleg.ausfall?.klasse}) — ${beleg.ausfall?.grund}; ${beleg.dauerMs}ms`,
  );
  // Auch der erlaubte Ausfall muss einen lesbaren, ehrlichen Beleg hinterlassen.
  expect(JSON.parse(readFileSync(ziel, "utf8"))).toEqual(beleg);
  expect(beleg.dauerMs).toBeLessThan(60_000);
  // Der Zeitstempel stammt aus DIESEM Lauf — sonst wäre er nur hingeschrieben und ein Beleg von
  // vorgestern bliebe unerkannt.
  expect(Date.parse(beleg.erstelltAm)).toBeGreaterThanOrEqual(beginn);
  expect(Date.parse(beleg.erstelltAm)).toBeLessThanOrEqual(Date.now());
  if (!gemessen) {
    expect(beleg.maximum).toBeNull();
    expect(fehler.length).toBeGreaterThan(0);
    // NICHT jeder Ausfall ist gleich viel wert: ein verweigerter Browserstart ist eine Grenze
    // dieser Umgebung, alles NACH einem gelungenen Start ist ein Befund über Chromium und diese
    // Maschine. Nur die erste Lage darf grün bleiben.
    const urteil = klassifiziereAusfall({ gestartet, fehler });
    // Der geschriebene Beleg trägt genau das Urteil, an dem dieser Fall hängt — kein zweites,
    // freundlicheres daneben.
    expect(beleg.ausfall).toEqual(urteil);
    expect(
      urteil.erlaubt,
      `Chromium-Prozesszahl NICHT gemessen, Klasse ${urteil.klasse}: ${urteil.grund}`,
    ).toBe(true);
  } else {
    expect(messungen.map((m) => m.seiten)).toEqual(last.seiten);
  }
}, 55_000);
