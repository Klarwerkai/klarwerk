// ================================================================================================
// produkt:20261009:referenzki-antwortstatus (REF-04) — ANTWORTSTATUS, TATSÄCHLICH BEDIENT
// (Chromium, Desktop 1280 × 800 und 390 × 844, nur Tastatur, Fokus, Rückweg).
// ================================================================================================
//
// Vorrichtung: `h4-harness` — gebautes dist, ECHTE App (`buildApp`, echte Dienste), Chromium.
// Ersetzt ist genau EINE Stelle: die Prüferwahl des Reasoners liefert einen Prüfer-Doppelgänger
// (kein Netz, kein Modell). Bindung, technische Auflösung, Auswertung, Route, Antwortkörper,
// Kennzeichnung und Oberfläche sind echt. Das ist KEINE Modellbeobachtung — die steht in
// `tests-smoke/referenzki-antwortstatus-modell.spec.ts`.
//
//   C1 · 1280 × 800 und 390 × 844: Antwort → „Quellen geprüft" → Aussage → per Tab + Enter zu
//        Fundstelle, Passage und Begründung (Fokus springt hinein) → „Zurück zur Aussage" per
//        Tastatur (Fokus zurück) — ohne waagerechtes Überlaufen.
//   C2 · 390 × 844: Prüferausfall → „Entwurf · Prüfung nicht abgeschlossen" mit nächstem Schritt →
//        „Erneut prüfen" per Tastatur → während des Laufs „Entwurf · Prüfung läuft" → danach
//        „Quellen geprüft"; nie eine Bestätigung vor dem Ergebnis.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReferenzPruefer } from "../../services/reasoner";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

let stand: H4Stand | null = null;
let fehler: string | null = null;
let modus: "belegt" | "ausfall" | "langsam" = "belegt";

const machePruefer = (modell: string): ReferenzPruefer => ({
  rolle: { anbieter: `anthropic:${modell}`, modell, stufe: "cloud" },
  extern: true,
  pruefe: async (_system, user) => {
    if (modus === "ausfall") {
      throw new Error("Anbieter antwortete mit 503");
    }
    if (modus === "langsam") {
      await new Promise((r) => setTimeout(r, 2_500));
    }
    const daten = JSON.parse(user.slice(user.indexOf("\n") + 1)) as {
      posten: { teilId: string; fundstellen: { fundstelleId: string }[] }[];
    };
    return {
      text: JSON.stringify({
        richtlinie: "referenzpruefung-v1",
        ergebnisse: daten.posten.map((p) => ({
          teilId: p.teilId,
          zustand: "belegt",
          fundstelleId: p.fundstellen[0]?.fundstelleId ?? null,
          begruendung: "Die Fundstelle nennt genau diese Empfehlung.",
        })),
      }),
      dauerMs: 9,
    };
  },
});
let pruefer = machePruefer("ref04-fiktiv-1");

const GEPRUEFT = '[data-testid="referenzpruefung"][data-status="geprueft"]';
const NICHT_PRUEFBAR = '[data-testid="referenzpruefung"][data-status="nicht_pruefbar"]';
const KNOPF = '[data-testid="referenzpruefung-zur-fundstelle"]';
const DETAIL_SEL = '[data-testid="referenzpruefung-fundstelle-detail"]';
const ZURUECK = '[data-testid="referenzpruefung-zurueck"]';
const ERNEUT = '[data-testid="referenzpruefung-erneut"]';
const MARKE_LAEUFT = '[data-testid="quellenstatus-marke"][data-gesamt="laeuft"]';
const MARKE_GEPRUEFT = '[data-testid="quellenstatus-marke"][data-gesamt="quellen_geprueft"]';

const DA = fn("(sel) => !!document.querySelector(sel)");
const WEG = fn("(sel) => !document.querySelector(sel)");
const FOKUS = fn(
  "(sel) => !!document.activeElement && document.activeElement.matches(sel) && document.activeElement.matches(':focus-visible')",
);
const FOKUS_IN = fn("(sel) => !!document.activeElement && document.activeElement.matches(sel)");
const UEBERLAUF = fn("() => document.documentElement.scrollWidth > window.innerWidth + 1");
const MARKE = fn(`() => {
  const m = document.querySelector('[data-testid="quellenstatus-marke"]');
  return m ? m.getAttribute('data-gesamt') : null;
}`);
const NAECHSTER = fn(`() => {
  const n = document.querySelector('[data-testid="referenzpruefung-naechster"]');
  return n ? n.textContent || '' : '';
}`);
const DETAIL = fn(`() => {
  const d = document.querySelector('[data-testid="referenzpruefung-fundstelle-detail"]');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  const link = d.querySelector('[data-testid="referenzpruefung-fundstelle"]');
  const passage = d.querySelector('[data-testid="referenzpruefung-passage"]');
  const begruendung = d.querySelector('[data-testid="referenzpruefung-detail-begruendung"]');
  return {
    passage: passage ? passage.textContent || '' : '',
    begruendung: begruendung ? begruendung.textContent || '' : '',
    href: link ? link.getAttribute('href') : null,
    imBild: r.left >= -1 && r.right <= window.innerWidth + 1,
  };
}`);
const EINGABE_FOKUSSIEREN = `() => {
  const i = document.querySelector('[data-testid="page-fragen"] form input');
  i.focus();
  if (i.select) i.select();
}`;

interface Detail {
  passage: string;
  begruendung: string;
  href: string | null;
  imBild: boolean;
}

async function fragen(s: H4Stand, frage: string): Promise<void> {
  await s.seite.goto(`${ORIGIN}/fragen`, { waitUntil: "load" });
  await s.seite.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="page-fragen"] form input')`),
    undefined,
    { timeout: 30_000 },
  );
  await s.seite.evaluate(fn(EINGABE_FOKUSSIEREN));
  await s.seite.keyboard.type(frage);
  await s.seite.keyboard.press("Enter");
}

async function tabBis(s: H4Stand, sel: string, max = 200): Promise<boolean> {
  for (let i = 0; i < max; i += 1) {
    await s.seite.keyboard.press("Tab");
    if (await s.seite.evaluate<boolean>(FOKUS, sel)) {
      return true;
    }
  }
  return false;
}

describe("REF-04 · Antwortstatus, bedient in Chromium", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "ref04-bedienung@ref04.test", async (z) => {
        await z.services.reasoner.setTaskConfig({
          global: "auto",
          perTask: {},
          referenzpruefung: ["local"],
        });
        vi.spyOn(z.services.reasoner, "referenzPruefer").mockImplementation(() => ({ pruefer }));
        vi.spyOn(z.services.reasoner, "externeVerarbeitungErlaubt").mockReturnValue(true);
      });
      const s = stand;
      // Wie `referenzpruefung-bedienung-chromium.test.ts`: ohne verdrahtetes Modell graut D-AISTATE
      // den Sendeknopf aus. Gesetzt wird NUR die Verfügbarkeit der Aufgabe „answer".
      s.antworten.vorAuslieferung = async (url, body) => {
        if (url.pathname !== "/api/reasoner/status") return body;
        try {
          const echt = JSON.parse(body) as { error?: unknown; tasks?: Record<string, boolean> };
          if (echt.error !== undefined) return body;
          const tasks = { ...(echt.tasks ?? {}), answer: true };
          return JSON.stringify({ ...echt, active: true, tasks });
        } catch {
          return body;
        }
      };
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  const ansichten = [
    [1280, 800, "Welche Profile sind zu bevorzugen?", "ref04-fiktiv-1"],
    [390, 844, "Welche Profile sind zu bevorzugen und zu nutzen?", "ref04-fiktiv-2"],
  ] as const;
  for (const [breite, hoehe, frage, modell] of ansichten) {
    it(`C1 · ${breite} × ${hoehe}: Antwort → Prüfung → Aussage → Fundstelle → Rückweg, nur Tastatur`, async () => {
      expect(fehler).toBeNull();
      const s = stand as H4Stand;
      await s.seite.setViewportSize({ width: breite, height: hoehe });
      modus = "belegt";
      pruefer = machePruefer(modell);
      await fragen(s, frage);
      await s.seite.waitForFunction(DA, GEPRUEFT, { timeout: 45_000 });
      expect(await s.seite.evaluate<string | null>(MARKE)).toBe("quellen_geprueft");
      expect(await s.seite.evaluate<boolean>(UEBERLAUF)).toBe(false);

      expect(await tabBis(s, KNOPF)).toBe(true);
      await s.seite.keyboard.press("Enter");
      await s.seite.waitForFunction(DA, DETAIL_SEL, { timeout: 15_000 });
      expect(await s.seite.evaluate<boolean>(FOKUS_IN, DETAIL_SEL)).toBe(true);
      const d = await s.seite.evaluate<Detail | null>(DETAIL);
      console.info(`REF-04 · C1 ${breite} → ${JSON.stringify(d)}`);
      expect(d?.passage.length ?? 0).toBeGreaterThan(0);
      expect(d?.begruendung).toContain("Die Fundstelle nennt genau diese Empfehlung.");
      expect(d?.href ?? "").toContain(`/wissen/${s.koId}`);
      expect(d?.href ?? "").toContain("fassung=");
      expect(d?.imBild).toBe(true);
      expect(await s.seite.evaluate<boolean>(UEBERLAUF)).toBe(false);

      // Rückweg per Tastatur: „Zurück zur Aussage" → Fokus wieder auf dem auslösenden Knopf.
      expect(await tabBis(s, ZURUECK, 20)).toBe(true);
      await s.seite.keyboard.press("Enter");
      await s.seite.waitForFunction(WEG, DETAIL_SEL, { timeout: 15_000 });
      expect(await s.seite.evaluate<boolean>(FOKUS_IN, KNOPF)).toBe(true);
      // Die Antwort steht weiter da — der Kontext ist nicht verlassen.
      expect(await s.seite.evaluate<boolean>(DA, '[data-testid="ask-answer"]')).toBe(true);
    }, 180_000);
  }

  it("C2 · 390 × 844: Ausfall → nicht abgeschlossen mit nächstem Schritt → erneut → läuft → geprüft", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    await s.seite.setViewportSize({ width: 390, height: 844 });
    pruefer = machePruefer("ref04-fiktiv-3");
    modus = "ausfall";
    await fragen(s, "Welche Profile sind zu bevorzugen und warum?");
    await s.seite.waitForFunction(DA, NICHT_PRUEFBAR, { timeout: 45_000 });
    expect(await s.seite.evaluate<string | null>(MARKE)).toBe("nicht_abgeschlossen");
    const naechster = await s.seite.evaluate<string>(NAECHSTER);
    expect(naechster).toContain("Nächster Schritt");
    expect(naechster).toContain("erneut anstoßen");

    modus = "langsam";
    expect(await tabBis(s, ERNEUT)).toBe(true);
    await s.seite.keyboard.press("Enter");
    await s.seite.waitForFunction(DA, MARKE_LAEUFT, { timeout: 10_000 });
    // Während des Laufs gibt es keine Bestätigung.
    expect(await s.seite.evaluate<boolean>(DA, MARKE_GEPRUEFT)).toBe(false);
    await s.seite.waitForFunction(DA, MARKE_GEPRUEFT, { timeout: 45_000 });
    expect(await s.seite.evaluate<boolean>(UEBERLAUF)).toBe(false);
  }, 180_000);

  it("Z · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });
});
