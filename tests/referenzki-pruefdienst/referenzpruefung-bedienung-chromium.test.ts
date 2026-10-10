// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02, Ben nacharbeit-3) — ANZEIGE UND ADMINAUSWAHL,
// TATSÄCHLICH BEDIENT (Chromium, Desktop und 390 × 844, Tastatur, Fokus, Rückweg).
// ================================================================================================
//
// Vorrichtung: `h4-harness` — gebautes dist, ECHTE App (`buildApp`, echte Dienste), Chromium.
// Ersetzt ist genau EINE Stelle: die Prüferwahl des Reasoners liefert einen Prüfer-Doppelgänger
// (kein Netz, kein Modell), der je Posten mit der ersten Fundstelle urteilt — oder ausfällt.
// Bindung, technische Auflösung, Auswertung, Route, Antwortkörper und Oberfläche sind echt.
// Das ist KEINE echte Modellbeobachtung (K10 bleibt dafür offen).
//
//   B1 · 1280 × 800: Frage → Prüfergebnis an der Antwort (je Aussage Zustand, Fundstelle,
//        Begründung, getrennte Hinweise, Grenze) → Fundstelle per Tab + Enter → Quelle in ihrer
//        Fassung → Rückweg: die Prüfung steht wieder an der Antwort.
//   B2 · 390 × 844: Prüferausfall sichtbar „nicht prüfbar" mit Grund → „Erneut prüfen" per Tastatur →
//        geprüft, Versuch 2 von 2, kein weiterer Knopf; ohne waagerechtes Überlaufen.
//   B3 · 390 × 844 und 1280 × 800: KI-Verwaltung — die erlaubte Referenz-KI per Tastatur abwählen,
//        der Server speichert über den bestehenden Adminweg; Rückweg über „Zurück".
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { buildServices } from "../../services/app/src/build-app";
import type { ReferenzPruefer } from "../../services/reasoner";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

let stand: H4Stand | null = null;
let fehler: string | null = null;
let dienste: ReturnType<typeof buildServices> | null = null;
let modus: "belegt" | "ausfall" = "belegt";
let aufrufe = 0;

const FRAGE = "Welche Profile sind zu bevorzugen?";
const FRAGE_ZWEI = "Welche Profile sind zu bevorzugen und auszuführen?";

/**
 * Der Prüfer-Doppelgänger: urteilt „belegt" mit der ersten Fundstelle — oder fällt aus. Je Fall ein
 * eigener Modellbezeichner: ein gültiger Cachebeleg desselben Pakets und Modells würde sonst zu
 * Recht wiederverwendet (K8), und der Ausfall wäre nicht zu sehen.
 */
const machePruefer = (modell: string): ReferenzPruefer => ({
  rolle: { anbieter: `anthropic:${modell}`, modell, stufe: "cloud" },
  extern: true,
  pruefe: async (_system, user) => {
    aufrufe += 1;
    if (modus === "ausfall") {
      throw new Error("Anbieter antwortete mit 503");
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
let pruefer = machePruefer("pruef-fiktiv-9");

interface Lage {
  status: string | null;
  zustaende: string[];
  fundstellen: string[];
  grenze: boolean;
  versuch: string;
  erneut: boolean;
  statusText: string;
  ueberlauf: boolean;
  breiteOk: boolean;
}

const MESSEN = fn(`() => {
  const box = document.querySelector('[data-testid="referenzpruefung"]');
  const r = box ? box.getBoundingClientRect() : null;
  return {
    status: box ? box.getAttribute('data-status') : null,
    zustaende: [...document.querySelectorAll('[data-testid="referenzpruefung-aussage"]')].map((a) => a.getAttribute('data-zustand') || ''),
    fundstellen: [...document.querySelectorAll('[data-testid="referenzpruefung-fundstelle"]')].map((a) => a.getAttribute('href') || ''),
    grenze: !!document.querySelector('[data-testid="referenzpruefung-grenze"]'),
    versuch: (document.querySelector('[data-testid="referenzpruefung-versuch"]') || {}).textContent || '',
    erneut: !!document.querySelector('[data-testid="referenzpruefung-erneut"]'),
    statusText: (document.querySelector('[data-testid="referenzpruefung-status"]') || {}).textContent || '',
    ueberlauf: document.documentElement.scrollWidth > window.innerWidth + 1,
    breiteOk: !!r && r.right <= window.innerWidth + 1 && r.left >= -1,
  };
}`);

const DA = fn("(sel) => !!document.querySelector(sel)");
const FOKUS = fn(
  "(sel) => !!document.activeElement && document.activeElement.matches(sel) && document.activeElement.matches(':focus-visible')",
);
const PFAD = fn("() => location.pathname + location.search");
const AUF_WISSEN = fn("(id) => location.pathname === '/wissen/' + id");
const GEPRUEFT = '[data-testid="referenzpruefung"][data-status="geprueft"]';
const NICHT_PRUEFBAR = '[data-testid="referenzpruefung"][data-status="nicht_pruefbar"]';
const EINGABE_FOKUSSIEREN = `() => {
  const i = document.querySelector('[data-testid="page-fragen"] form input');
  i.focus();
  if (i.select) i.select();
}`;
const ADMIN_LAGE = `() => {
  const k = document.querySelector('[data-testid="ki-referenz-local-erlaubt"]');
  const ueberlauf = document.documentElement.scrollWidth > window.innerWidth + 1;
  return { an: !!k && k.checked, frei: !!k && !k.disabled, ueberlauf };
}`;

interface AdminLage {
  an: boolean;
  frei: boolean;
  ueberlauf: boolean;
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

async function tabBis(s: H4Stand, sel: string, max = 160): Promise<boolean> {
  for (let i = 0; i < max; i += 1) {
    await s.seite.keyboard.press("Tab");
    if (await s.seite.evaluate<boolean>(FOKUS, sel)) {
      return true;
    }
  }
  return false;
}

describe("REF-02 · Prüfergebnis und Adminauswahl, bedient in Chromium", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "ref02-bedienung@ref02.test", async (z) => {
        dienste = z.services;
        // Die Adminliste über den bestehenden Weg: „local" ist erlaubt (hier nicht eingerichtet).
        await z.services.reasoner.setTaskConfig({
          global: "auto",
          perTask: {},
          referenzpruefung: ["local"],
        });
        vi.spyOn(z.services.reasoner, "referenzPruefer").mockImplementation(() => ({ pruefer }));
        vi.spyOn(z.services.reasoner, "externeVerarbeitungErlaubt").mockReturnValue(true);
      });
      const s = stand;
      // Wie `ref01-fundstelle-bedienung-chromium.test.ts`: ohne verdrahtetes Modell graut D-AISTATE
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

  it("B1 · 1280 × 800: Ergebnis an der Antwort, Fundstelle per Tastatur, Rückweg mit Prüfung", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    await s.seite.setViewportSize({ width: 1280, height: 800 });
    modus = "belegt";
    await fragen(s, FRAGE);
    await s.seite.waitForFunction(DA, GEPRUEFT, { timeout: 45_000 });
    const m = await s.seite.evaluate<Lage>(MESSEN);
    console.info(`REF-02 · B1 → ${JSON.stringify(m)}`);
    expect(m.zustaende.length).toBeGreaterThan(0);
    expect(m.zustaende).toContain("belegt");
    const zurQuelle = m.fundstellen.filter((h) => h.includes(`/wissen/${s.koId}`));
    expect(zurQuelle.length).toBeGreaterThan(0);
    expect(zurQuelle.every((h) => h.includes("fassung="))).toBe(true);
    expect(m.grenze).toBe(true);
    expect(m.versuch).toContain("1");
    expect(m.ueberlauf).toBe(false);
    // Kein Modell- oder Anbietername an der Fläche.
    const text = await s.seite.evaluate<string>(
      fn(`() => document.querySelector('[data-testid="referenzpruefung"]').textContent || ''`),
    );
    expect(text).not.toContain("pruef-fiktiv-9");

    // Die Fundstelle per Tab erreicht (sichtbarer Fokus) und per Enter geöffnet.
    expect(await tabBis(s, '[data-testid="referenzpruefung-fundstelle"]')).toBe(true);
    await s.seite.keyboard.press("Enter");
    await s.seite.waitForFunction(AUF_WISSEN, s.koId, { timeout: 30_000 });
    expect(await s.seite.evaluate<string>(PFAD)).toContain("fassung=");

    // Rückweg: die Antwort UND ihre Prüfung stehen wieder da (Arbeitsstand).
    await s.seite.evaluate(fn("() => { history.back(); }"));
    await s.seite.waitForFunction(DA, GEPRUEFT, { timeout: 30_000 });
  }, 180_000);

  it("B2 · 390 × 844: Ausfall sichtbar, erneute Prüfung per Tastatur, danach ausgeschöpft", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    await s.seite.setViewportSize({ width: 390, height: 844 });
    pruefer = machePruefer("pruef-fiktiv-10");
    modus = "ausfall";
    const vorher = aufrufe;
    await fragen(s, FRAGE_ZWEI);
    await s.seite.waitForFunction(DA, NICHT_PRUEFBAR, { timeout: 45_000 });
    const ausfall = await s.seite.evaluate<Lage>(MESSEN);
    console.info(`REF-02 · B2 Ausfall → ${JSON.stringify(ausfall)}`);
    expect(ausfall.statusText).toContain("Nicht prüfbar");
    expect(ausfall.statusText).toContain("ausgefallen");
    expect(ausfall.zustaende.every((z) => z === "nicht_pruefbar")).toBe(true);
    expect(ausfall.erneut).toBe(true);
    expect(ausfall.ueberlauf).toBe(false);
    expect(ausfall.breiteOk).toBe(true);
    expect(aufrufe).toBe(vorher + 1);

    // Erneut prüfen — nur mit der Tastatur.
    modus = "belegt";
    expect(await tabBis(s, '[data-testid="referenzpruefung-erneut"]')).toBe(true);
    await s.seite.keyboard.press("Enter");
    await s.seite.waitForFunction(DA, GEPRUEFT, { timeout: 45_000 });
    const danach = await s.seite.evaluate<Lage>(MESSEN);
    console.info(`REF-02 · B2 erneut → ${JSON.stringify(danach)}`);
    expect(danach.versuch).toContain("2");
    expect(danach.erneut).toBe(false);
    expect(danach.ueberlauf).toBe(false);
    expect(aufrufe).toBe(vorher + 2);
  }, 180_000);

  for (const [breite, hoehe] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    it(`B3 · ${breite} × ${hoehe}: Referenz-KI in der KI-Verwaltung per Tastatur abwählen und speichern`, async () => {
      expect(fehler).toBeNull();
      const s = stand as H4Stand;
      await dienste?.reasoner.setTaskConfig({
        global: "auto",
        perTask: {},
        referenzpruefung: ["local"],
      });
      await s.seite.setViewportSize({ width: breite, height: hoehe });
      await s.seite.goto(`${ORIGIN}/admin?bereich=ki&detail=ki`, { waitUntil: "load" });
      await s.seite.waitForFunction(DA, '[data-testid="ki-referenzpruefung"]', {
        timeout: 30_000,
      });
      const vorher = await s.seite.evaluate<AdminLage>(fn(ADMIN_LAGE));
      expect(vorher).toEqual({ an: true, frei: true, ueberlauf: false });

      expect(await tabBis(s, '[data-testid="ki-referenz-local-erlaubt"]', 220)).toBe(true);
      await s.seite.keyboard.press("Space");
      await s.seite.waitForFunction(DA, '[data-testid="ki-referenzpruefung-leer"]', {
        timeout: 30_000,
      });
      expect(dienste?.reasoner.getTaskConfig().referenzpruefung).toBeUndefined();
      expect(
        await s.seite.evaluate<boolean>(
          fn("() => document.documentElement.scrollWidth > window.innerWidth + 1"),
        ),
      ).toBe(false);

      // Rückweg: „Zurück" der Detailkarte schließt die KI-Karte.
      await s.seite.click('[data-testid="detail-ki"] [data-einst="zurueck"]');
      await s.seite.waitForFunction(
        fn(`() => !document.querySelector('[data-testid="detail-ki"]')`),
        undefined,
        { timeout: 30_000 },
      );
    }, 180_000);
  }

  it("Z · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });
});
