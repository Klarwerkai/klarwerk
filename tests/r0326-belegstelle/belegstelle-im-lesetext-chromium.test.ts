// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-QUELLENANZEIGE (R-0326, R-0329) — DIE WEB-ANSICHT AM ECHTEN BROWSER.
// ================================================================================================
//
// R-0326: „Ein Klick auf das Zitat springt an genau diese Stelle und hebt sie hervor." Der Klick
// im Word-Panel öffnet `/wissen/:id?stelle=…&fassung=…` (taskpane.js `askStelleHref`). Gemessen
// wird hier, was diese Adresse an der GEBAUTEN Seite tut: die Passage ist im Lesetext markiert,
// steht im Bild und hat den Fokus. Gegenproben: andere Fassung und nicht wörtliche Passage
// markieren NICHTS und sagen es.
// R-0329: „Im Wissensnetz anzeigen" öffnet `/wissen/:id?abschnitt=nachbarschaft` — die
// Nachbarschaft (das Wissensnetz des Eintrags) steht danach AUFGEKLAPPT und im Bild.
//
// Vorrichtung: `h4-harness` (gebautes dist, echte App, Chromium, freigegebener Eintrag mit zwei
// Absätzen ABSATZ_1/ABSATZ_2).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ABSATZ_1, ABSATZ_2, type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

let stand: H4Stand | null = null;
let fehler: string | null = null;
let fassung = 0;

interface Lage {
  marken: string[];
  imBild: boolean;
  fokusInMarke: boolean;
  lage: string | null;
}

const MESSEN = `() => {
  const marken = [...document.querySelectorAll('[data-testid="bib-text"] mark[data-bib-belegstelle]')];
  const erste = marken[0];
  const r = erste ? erste.getBoundingClientRect() : null;
  const a = document.activeElement;
  const lageEl = document.querySelector('[data-testid="bib-belegstelle-lage"]');
  return {
    marken: marken.map((m) => m.textContent || ''),
    imBild: !!r && r.top >= 0 && r.bottom <= window.innerHeight,
    fokusInMarke: !!a && marken.includes(a),
    lage: lageEl ? lageEl.getAttribute('data-lage') : null,
  };
}`;

async function oeffnen(suche: string): Promise<Lage> {
  const s = stand as H4Stand;
  await s.seite.goto(`${ORIGIN}/wissen/${s.koId}?${suche}`, { waitUntil: "load" });
  await s.seite.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="bib-titel"]')`),
    undefined,
    { timeout: 30_000 },
  );
  await s.seite.waitForTimeout(500);
  const m = await s.seite.evaluate<Lage>(fn(MESSEN));
  console.info(`R-0326 · ?${suche.slice(0, 60)}… → ${JSON.stringify(m)}`);
  return m;
}

describe("R-0326/R-0329 · Belegstelle und Wissensnetz-Einstieg an der gebauten Lesefläche (Chromium)", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "belegstelle@r0326.test");
      const s = stand;
      fassung = await s.seite.evaluate<number>(
        fn(
          `(id) => fetch('/api/kos/' + id, { credentials: 'include' }).then((r) => r.json()).then((k) => k.version)`,
        ),
        s.koId,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("B1 · ?stelle=<zweiter Absatz>&fassung=<aktuell>: GENAU die Passage ist markiert, steht im Bild und hat den Fokus", async () => {
    expect(fehler).toBeNull();
    expect(fassung).toBeGreaterThan(0);
    const p = new URLSearchParams({ stelle: ABSATZ_2, fassung: String(fassung) });
    const m = await oeffnen(p.toString());
    expect(m.marken.join("")).toBe(ABSATZ_2);
    expect(m.imBild).toBe(true);
    expect(m.fokusInMarke).toBe(true);
    expect(m.lage).toBe("markiert");
  }, 90_000);

  it("B2 · andere Fassung: NICHTS markiert, die Fläche sagt es", async () => {
    expect(fehler).toBeNull();
    const p = new URLSearchParams({ stelle: ABSATZ_2, fassung: String(fassung + 1) });
    const m = await oeffnen(p.toString());
    expect(m.marken).toEqual([]);
    expect(m.lage).toBe("andereFassung");
  }, 90_000);

  it("B3 · nicht wörtlich stehende Passage: NICHTS markiert, kein Teiltreffer, die Fläche sagt es", async () => {
    expect(fehler).toBeNull();
    const p = new URLSearchParams({ stelle: "Diese Passage steht nirgends im Bericht." });
    const m = await oeffnen(p.toString());
    expect(m.marken).toEqual([]);
    expect(m.lage).toBe("nichtGefunden");
  }, 90_000);

  it("W1 · R-0329 · ?abschnitt=nachbarschaft: das Wissensnetz des Eintrags steht aufgeklappt und im Bild", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    await s.seite.goto(`${ORIGIN}/wissen/${s.koId}?abschnitt=nachbarschaft`, {
      waitUntil: "load",
    });
    await s.seite.waitForFunction(
      fn(`() => {
        const d = document.querySelector('[data-bib-abschnitt="nachbarschaft"]');
        return !!d && d.open === true;
      }`),
      undefined,
      { timeout: 30_000 },
    );
    await s.seite.waitForTimeout(500);
    const lage = await s.seite.evaluate<{ top: number; hoehe: number; offen: string[] }>(
      fn(`() => {
        const d = document.querySelector('[data-bib-abschnitt="nachbarschaft"]');
        const r = d.getBoundingClientRect();
        return {
          top: r.top,
          hoehe: window.innerHeight,
          offen: [...document.querySelectorAll('[data-bib-abschnitt]')]
            .filter((x) => x.open)
            .map((x) => x.getAttribute('data-bib-abschnitt')),
        };
      }`),
    );
    console.info(`R-0329 · Nachbarschaft: ${JSON.stringify(lage)}`);
    // Angesprungen: der Abschnitt beginnt im Bild — und er ist der EINE geöffnete.
    expect(lage.top).toBeGreaterThanOrEqual(0);
    expect(lage.top).toBeLessThan(lage.hoehe);
    expect(lage.offen).toEqual(["nachbarschaft"]);
  }, 90_000);

  // ==============================================================================================
  // K1 · DER GANZE KLICKWEG AUS DER ANTWORT (Ben, Nacharbeit 11): nicht eine selbst gebaute Adresse,
  // sondern Fragenseite → echte Frage an die echte App → Klick auf den Quellenchip der Antwort →
  // Lesefläche. Dort ist die zitierte Passage der tragenden Quelle markiert und angesprungen.
  // ==============================================================================================
  it("K1 · Frage → Antwort → Klick auf den Quellenchip: die zitierte Passage ist im Quelldokument markiert und im Bild", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    // Dieselbe eine gesetzte Auskunft wie in `h5-funktionsinventar.test.ts` I7 und
    // `zielbild-h5-fragen.test.ts`: ohne verdrahtetes Modell graut D-AISTATE den Sendeknopf hart aus
    // (Prüflauf zu ff6019e3: „KI nicht verfügbar", Knopf `disabled`). Gesetzt wird NUR die
    // VERFÜGBARKEIT; die Antwort, ihre Quellen und der Chip kommen unverändert von der echten App.
    s.antworten.vorAuslieferung = async (url, body) => {
      if (url.pathname !== "/api/reasoner/status") return body;
      try {
        const echt = JSON.parse(body) as { error?: unknown; tasks?: Record<string, boolean> };
        if (echt.error !== undefined) return body;
        return JSON.stringify({
          ...echt,
          active: true,
          tasks: { ...(echt.tasks ?? {}), answer: true },
        });
      } catch {
        return body;
      }
    };
    await s.seite.goto(`${ORIGIN}/fragen`, { waitUntil: "load" });
    await s.seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="page-fragen"] form input')`),
      undefined,
      { timeout: 30_000 },
    );
    // Nur Begriffe, die der Eintrag wirklich trägt (R-0473: alle Fragebegriffe müssen in der Quelle
    // stehen — sonst wird die Frage vertragsgemäß eine Wissenslücke). Dieselbe Bauform wie die
    // Frage in `h5-funktionsinventar.test.ts` I7; „Profile" und „bevorzugen" stehen in ABSATZ_1.
    await s.seite.click('[data-testid="page-fragen"] form input');
    await s.seite.keyboard.type("Welche Profile sind zu bevorzugen?");
    await s.seite.click('[data-testid="page-fragen"] form button[type="submit"]');
    await s.seite.waitForFunction(
      fn(
        `(id) => !!document.querySelector('[data-testid="ask-quellen-chip"][href*="' + id + '"]')`,
      ),
      s.koId,
      { timeout: 45_000 },
    );
    const href = await s.seite.evaluate<string>(
      fn(
        `(id) => document.querySelector('[data-testid="ask-quellen-chip"][href*="' + id + '"]').getAttribute('href')`,
      ),
      s.koId,
    );
    console.info(`R-0326 · Chip der Antwort → ${href}`);
    // Der Chip trägt den Anker der TRAGENDEN Passage — er wurde nicht vom Test gebaut.
    const anker = new URL(href, ORIGIN);
    expect(anker.pathname).toBe(`/wissen/${s.koId}`);
    expect(anker.searchParams.get("stelle")).toBe(ABSATZ_1);
    // Der echte Zeigerklick (Router-Navigation der Anwendung).
    await s.seite.click(`[data-testid="ask-quellen-chip"][href*="${s.koId}"]`);
    await s.seite.waitForFunction(
      fn(
        `() => document.querySelectorAll('[data-testid="bib-text"] mark[data-bib-belegstelle]').length > 0`,
      ),
      undefined,
      { timeout: 30_000 },
    );
    await s.seite.waitForTimeout(500);
    const m = await s.seite.evaluate<Lage>(fn(MESSEN));
    console.info(`R-0326 · nach dem Klick → ${JSON.stringify(m)}`);
    expect(m.marken.join("")).toBe(ABSATZ_1);
    expect(m.imBild).toBe(true);
    expect(m.fokusInMarke).toBe(true);
    expect(m.lage).toBe("markiert");
  }, 120_000);

  it("Z · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });
});
