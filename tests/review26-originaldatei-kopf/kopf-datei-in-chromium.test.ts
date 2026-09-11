// ================================================================================================
// JOB 3474 · RUNDE 2 — DER WEG ZUR ORIGINALDATEI, MIT ECHTEN TASTEN, AN DER GEBAUTEN SEITE.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN DEN GEMOUNTETEN STEHT (BENs Prüflücke 6 aus Runde 1): „`kopf-tastatur.test.tsx`
// misst programmatischen Fokus und Klick; echte Tab-/Enter-Bedienung bleibt unbelegt und sollte im
// Browser geprüft werden." Das ist zutreffend und in jsdom auch nicht heilbar: jsdom führt für einen
// `<button>` KEINE Vorgabehandlung auf `keydown` aus — ein dort abgeschicktes `Enter` bewirkt nichts.
// Die gemountete Datei sagt das ausdrücklich; hier wird die fehlende Hälfte wirklich gemessen.
//
// VORRICHTUNG: dieselbe wie JOB 3063 H4 und JOB 3108 B (`tests/design/h4-harness.ts`, unverändert) —
// gebautes `apps/web/dist`, echte Fastify-App, echtes Chromium. DIESE DATEI STARTET KEINEN EIGENEN
// BROWSER: sie fährt über den vorhandenen Prüfstand und ist deshalb KEINE neue Startstelle im Sinn
// von `tests/tor-inventar/tor-bestand-vollstaendig.test.ts` (B4, Pin 25) — dieselbe Einordnung wie
// die M6b-Dateien, die dort ausdrücklich nicht auftauchen. Die Last bleibt klein: EIN Browser, EINE
// Seite, vier Fälle.
//
// DER BERICHT WIRD HERGESTELLT, NICHT VORAUSGESETZT: `h4Stand` legt den freigegebenen Eintrag mit
// zwei Absätzen und ohne Datei an. Der Haken `vorbereiten` überarbeitet ihn über den ECHTEN Dienst
// (`services.ko.revise`, derselbe Aufruf wie `PUT /api/kos/:id` mit `action: "revise"`) auf sechzig
// Abschnitte MIT der Body-Datei-Referenz am Ende — geschrieben von `fileLinkHtml`, also genau der
// Form, die der Dateiimport erzeugt. Damit läuft sie zusätzlich durch den SERVER-Sanitizer; C0
// kalibriert, dass sie ihn übersteht (sonst prüften die Tastenfälle eine Seite ohne Datei).
//
// AUSDRÜCKLICH NICHT GEMESSEN: der Download selbst. Die Object-Kennung dieses Bestands zeigt auf
// kein abgelegtes Objekt — `/api/objects/:id/raw` antwortete mit einem Fehler. Gemessen wird der
// WEG (Fokus, Sichtbarkeit, Adresse des Ziels), nicht die Auslieferung der Bytes; alles andere wäre
// eine Zusage über einen Bestand, den diese Vorrichtung nicht herstellt.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileLinkHtml, objectRawHref } from "../../apps/web/src/lib/bodyFileLink";
import { DIST, type H4Stand, ORIGIN, type Seite, fn, h4Stand } from "../design/h4-harness";

const DATEI_NAME = "Vertrag-2024.docx";
const OBJEKT_ID = "5d4f2b6a-1c3e-4f8a-9b2d-77e1c0a4b915";
const DATEI_HREF = objectRawHref(OBJEKT_ID) as string;

/** Sechzig Abschnitte — der Befundfall: „erst nach dem langen Text verlinkt". */
const LANGER_TEXT = Array.from(
  { length: 60 },
  (_, i) =>
    `<h2>Abschnitt ${i + 1}</h2><p>Reinigung, Prüfung und Freigabe im Abschnitt ${i + 1}.</p>`,
).join("");

const BODY_MIT_DATEI = `${LANGER_TEXT}${fileLinkHtml({ objectId: OBJEKT_ID, name: DATEI_NAME })}`;

/** Playwright kann mehr, als die schlanke Schnittstelle der Vorrichtung nennt (Muster: JOB 3108). */
interface Tastatur {
  press(taste: string): Promise<void>;
}
const tastatur = (s: Seite): Tastatur => (s as unknown as { keyboard: Tastatur }).keyboard;

/** In der Seite: Lage und Zustand in EINEM Zug — sonst stammten die Aussagen aus zwei Ständen. */
const MESSEN = `(href) => {
  const lage = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, hoehe: r.height };
  };
  const knopf = document.querySelector('[data-testid="bib-sprung-originaldatei"]');
  const anker = document.querySelector('[data-testid="bib-text"] .attachment a[href="' + href + '"]');
  const aktiv = document.activeElement;
  return {
    fenster: window.innerHeight,
    knopfDa: !!knopf,
    knopfText: knopf ? knopf.innerText.replace(/\\s+/g, ' ').trim() : '(kein Knopf)',
    knopfLage: lage(knopf),
    ankerDa: !!anker,
    ankerLage: lage(anker),
    aktivTag: aktiv ? aktiv.tagName : '(keins)',
    aktivHref: aktiv ? (aktiv.getAttribute('href') || '') : '',
    aktivIstAnker: !!(anker && aktiv === anker),
    kopfText: document.querySelector('[data-testid="bib-kopf-spruenge"]')
      ? document.querySelector('[data-testid="bib-kopf-spruenge"]').innerText.replace(/\\s+/g, ' ').trim()
      : '(keine Sprungzeile)',
  };
}`;

interface Lage {
  top: number;
  bottom: number;
  hoehe: number;
}
interface Messung {
  fenster: number;
  knopfDa: boolean;
  knopfText: string;
  knopfLage: Lage | null;
  ankerDa: boolean;
  ankerLage: Lage | null;
  aktivTag: string;
  aktivHref: string;
  aktivIstAnker: boolean;
  kopfText: string;
}

let stand: H4Stand | null = null;
let fehler: string | null = null;

const messen = async (): Promise<Messung> =>
  (await (stand as H4Stand).seite.evaluate<Messung>(fn(MESSEN), DATEI_HREF)) as Messung;

/** Die Seite von vorn laden — jeder Tastenfall beginnt ohne Fokus und ohne vorherigen Sprung. */
async function frisch(): Promise<void> {
  const s = (stand as H4Stand).seite;
  await s.goto(`${ORIGIN}/wissen/${(stand as H4Stand).koId}`, {
    waitUntil: "load",
    timeout: 60_000,
  });
  await s.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="bib-sprung-originaldatei"]')`),
    undefined,
    { timeout: 30_000 },
  );
}

/**
 * Vom Knopf „Fragen" aus NUR tippen, bis der Originaldatei-Knopf den Fokus hat.
 * Gibt die Zahl der Anschläge zurück; `null`, wenn er nicht erreichbar war.
 */
async function tabBisKnopf(): Promise<number | null> {
  const s = (stand as H4Stand).seite;
  await s.evaluate(fn(`() => document.querySelector('[data-testid="bib-fragen"]').focus()`));
  for (let i = 0; i < 12; i++) {
    await tastatur(s).press("Tab");
    const da = await s.evaluate<boolean>(
      fn(
        `() => document.activeElement === document.querySelector('[data-testid="bib-sprung-originaldatei"]')`,
      ),
    );
    if (da) {
      return i + 1;
    }
  }
  return null;
}

describe("JOB 3474 · der Weg zur Originaldatei mit echten Tasten (Chromium)", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "pedi@job3474.test", async (z) => {
        await z.services.ko.revise(z.freiId, { bodyHtml: BODY_MIT_DATEI }, z.autorId);
      });
      await stand.seite.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="bib-sprung-originaldatei"]')`),
        undefined,
        { timeout: 30_000 },
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 5).join(" | ");
    }
  }, 240_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("C0 · KALIBRIERUNG: die Datei übersteht den Server-Sanitizer, der Kopf nennt sie beim Namen", async () => {
    expect(fehler).toBeNull();
    expect((stand as H4Stand).version.length).toBeGreaterThan(0);
    const m = await messen();
    console.info(`JOB 3474 C0 · ${JSON.stringify(m)}`);
    // Ohne diese beiden Zeilen misst C1 eine Lage, die es gar nicht gibt.
    expect(m.ankerDa, "die Body-Datei-Referenz hat den Server-Sanitizer nicht überlebt").toBe(true);
    expect(m.knopfDa, "am Kopf steht kein Originaldatei-Knopf").toBe(true);
    expect(m.knopfText).toContain(DATEI_NAME);
    // Und der Befund ist echt: der Link liegt WEIT unter dem Sichtfeld, der Knopf steht darin.
    expect((m.ankerLage as Lage).top).toBeGreaterThan(m.fenster);
    expect((m.knopfLage as Lage).top).toBeLessThan(m.fenster);
  }, 90_000);

  it("C1 · NUR TASTATUR: mit Tab erreichbar, ECHTES Enter führt zur Datei", async () => {
    expect(fehler).toBeNull();
    await frisch();
    const schritte = await tabBisKnopf();
    expect(
      schritte,
      "der Originaldatei-Knopf war in 12 Tabulatorschritten nicht erreichbar",
    ).not.toBeNull();
    console.info(`JOB 3474 C1 · Knopf nach ${schritte} Tabulatorschritten erreicht`);
    await tastatur((stand as H4Stand).seite).press("Enter");
    await (stand as H4Stand).seite.waitForFunction(
      fn(
        `(href) => document.activeElement === document.querySelector('[data-testid="bib-text"] .attachment a[href="' + href + '"]')`,
      ),
      DATEI_HREF,
      { timeout: 20_000 },
    );
    const m = await messen();
    console.info(`JOB 3474 C1 · ${JSON.stringify(m)}`);
    expect(m.aktivTag).toBe("A");
    expect(m.aktivHref).toBe(DATEI_HREF);
    expect(m.aktivIstAnker).toBe(true);
    // Der Link ist wirklich im Bild — der Sprung ist keine reine Fokusverschiebung.
    const lage = m.ankerLage as Lage;
    expect(lage.top, `Link top=${lage.top}, Fenster=${m.fenster}`).toBeLessThan(m.fenster);
    expect(lage.bottom, "der Link liegt über dem Bild").toBeGreaterThan(0);
  }, 90_000);

  it("C2 · dasselbe mit der LEERTASTE — die zweite Taste, die ein echter Knopf annimmt", async () => {
    expect(fehler).toBeNull();
    await frisch();
    const schritte = await tabBisKnopf();
    expect(schritte).not.toBeNull();
    await tastatur((stand as H4Stand).seite).press("Space");
    await (stand as H4Stand).seite.waitForFunction(
      fn(
        `(href) => document.activeElement === document.querySelector('[data-testid="bib-text"] .attachment a[href="' + href + '"]')`,
      ),
      DATEI_HREF,
      { timeout: 20_000 },
    );
    const m = await messen();
    console.info(`JOB 3474 C2 · ${JSON.stringify(m)}`);
    expect(m.aktivIstAnker).toBe(true);
    expect((m.ankerLage as Lage).top).toBeLessThan(m.fenster);
  }, 90_000);

  it("C3 · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect((stand as H4Stand).seitenfehler).toEqual([]);
  });
});

describe.runIf(!existsSync(join(DIST, "index.html")))(
  "JOB 3474 · Chromium-Fall übersprungen",
  () => {
    it("meldet das fehlende dist, statt eine Prüfung vorzutäuschen", () => {
      expect(existsSync(join(DIST, "index.html")), `dist fehlt: ${DIST}`).toBe(false);
    });
  },
);
