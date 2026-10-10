// ================================================================================================
// produkt:20261009:referenzki-quellenbelege (REF-01) — DER QUELLENLINK, TATSÄCHLICH BEDIENT.
// ================================================================================================
//
// Ben nacharbeit-4: „Der geforderte tatsächlich bedienbare Quellenlink einschließlich Desktop,
// 390 × 844 sowie Tastatur/Fokus/Rückweg ist nicht belegt." Der Desktop-Zeigerweg ist Bestand:
// `belegstelle-im-lesetext-chromium.test.ts` K1 (Frage → Antwort → Klick auf den Quellenchip →
// Passage markiert, im Bild, fokussiert; Fenster 1620 × 900). Diese Datei ergänzt GENAU den Rest:
//   · M1 — 390 × 844, NUR Tastatur: Frage per Enter, Quellenchip per Tab erreicht und per Enter
//          geöffnet; die Passage ist markiert, im Bild und hat den Fokus; kein waagerechtes
//          Überlaufen; der Rückweg (Verlauf zurück) führt auf die Fragenseite mit der Antwort.
//   · M2 — 390 × 844: der Fundstellenlink aus dem neuen Feld `aussagen` (nicht vom Test gebaut,
//          sondern aus der echten `/api/ask`-Antwort) öffnet genau die gebundene Passage.
//
// Vorrichtung: `h4-harness` (gebautes dist, echte App, Chromium, freigegebener Eintrag mit
// ABSATZ_1/ABSATZ_2). Inhalte fiktiv.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

let stand: H4Stand | null = null;
let fehler: string | null = null;
let gefangen: { aussagen?: unknown } | null = null;

interface Lage {
  marken: string[];
  imBild: boolean;
  fokusInMarke: boolean;
  lage: string | null;
  ueberlauf: boolean;
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
    ueberlauf: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
}`;

const FRAGE = "Welche Profile sind zu bevorzugen?";

/** Was M2 aus der mitgelesenen `/api/ask`-Antwort braucht — nur diese Felder. */
interface GefangeneFundstelle {
  art: string;
  koId: string;
  auszug: string;
  link: string;
}
interface GefangenerBeleg {
  aussagen: { teile: { fundstellen: GefangeneFundstelle[] }[] }[];
}

const DA = fn("(sel) => !!document.querySelector(sel)");
const FOKUS_AUF = fn("(sel) => !!document.activeElement && document.activeElement.matches(sel)");
const ZURUECK_AUF_FRAGEN = fn(
  `(sel) => !!document.querySelector('[data-testid="page-fragen"]') && !!document.querySelector(sel)`,
);

async function aufMarkenWarten(s: H4Stand): Promise<Lage> {
  await s.seite.waitForFunction(
    fn(
      `() => document.querySelectorAll('[data-testid="bib-text"] mark[data-bib-belegstelle]').length > 0`,
    ),
    undefined,
    { timeout: 30_000 },
  );
  await s.seite.waitForTimeout(500);
  return s.seite.evaluate<Lage>(fn(MESSEN));
}

describe("REF-01 · Quellenlink bei 390 × 844 mit Tastatur, Fokus und Rückweg (Chromium)", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "ref01-bedienung@r0326.test");
      const s = stand;
      // Dieselbe eine gesetzte Auskunft wie `belegstelle-im-lesetext-chromium.test.ts` K1: ohne
      // verdrahtetes Modell graut D-AISTATE den Sendeknopf aus. Gesetzt wird NUR die Verfügbarkeit;
      // Antwort, Quellen, Chip und `aussagen` kommen unverändert von der echten App — die Antwort
      // von `/api/ask` wird hier nur MITGELESEN, nicht verändert.
      s.antworten.vorAuslieferung = async (url, body) => {
        if (url.pathname === "/api/ask") {
          try {
            gefangen = JSON.parse(body) as { aussagen?: unknown };
          } catch {
            gefangen = null;
          }
          return body;
        }
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
      await s.seite.setViewportSize({ width: 390, height: 844 });
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("M1 · 390 × 844, nur Tastatur: Frage → Quellenchip per Tab und Enter → Passage markiert und fokussiert → Rückweg", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    await s.seite.goto(`${ORIGIN}/fragen`, { waitUntil: "load" });
    await s.seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="page-fragen"] form input')`),
      undefined,
      { timeout: 30_000 },
    );
    // Das Eingabefeld bekommt den Fokus, getippt und abgeschickt wird mit der Tastatur.
    await s.seite.evaluate(
      fn(`() => document.querySelector('[data-testid="page-fragen"] form input').focus()`),
    );
    await s.seite.keyboard.type(FRAGE);
    await s.seite.keyboard.press("Enter");
    const chip = `[data-testid="ask-quellen-chip"][href*="${s.koId}"]`;
    await s.seite.waitForFunction(DA, chip, { timeout: 45_000 });

    // Den Chip mit der Tab-Taste erreichen — gemessen, nicht per Skript fokussiert.
    let erreicht = false;
    for (let i = 0; i < 120 && !erreicht; i += 1) {
      await s.seite.keyboard.press("Tab");
      erreicht = await s.seite.evaluate<boolean>(FOKUS_AUF, chip);
    }
    expect(erreicht, "Quellenchip per Tab erreichbar").toBe(true);
    await s.seite.keyboard.press("Enter");

    const m = await aufMarkenWarten(s);
    console.info(`REF-01 · 390 × 844 nach Enter auf dem Chip → ${JSON.stringify(m)}`);
    expect(m.lage).toBe("markiert");
    expect(m.marken.join("").length).toBeGreaterThan(0);
    expect(m.imBild).toBe(true);
    expect(m.fokusInMarke).toBe(true);
    expect(m.ueberlauf).toBe(false);

    // Rückweg: der Verlauf führt zurück auf die Fragenseite, und die Antwort samt Quellenchip steht
    // wieder da — der Weg zur Quelle ist keine Einbahnstraße.
    await s.seite.evaluate(fn("() => { history.back(); }"));
    await s.seite.waitForFunction(ZURUECK_AUF_FRAGEN, chip, { timeout: 30_000 });
  }, 180_000);

  it("M2 · 390 × 844: der Fundstellenlink aus `aussagen` öffnet genau die gebundene Passage", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    // `gefangen` stammt aus M1 — dieselbe echte Antwort, die die Oberfläche bekommen hat.
    const beleg = gefangen?.aussagen as GefangenerBeleg | undefined;
    expect(beleg, "die echte /api/ask-Antwort trägt `aussagen`").toBeDefined();
    const fundstelle = (beleg?.aussagen ?? [])
      .flatMap((a) => a.teile.flatMap((t) => t.fundstellen))
      .find((f) => f.art === "intern" && f.koId === s.koId);
    expect(fundstelle, "eine interne Fundstelle am Eintrag").toBeDefined();
    const ziel = new URL(fundstelle?.link ?? "/", ORIGIN);
    expect(ziel.pathname).toBe(`/wissen/${s.koId}`);
    expect(ziel.searchParams.get("stelle")).toBe(fundstelle?.auszug);

    await s.seite.goto(`${ORIGIN}${fundstelle?.link ?? "/"}`, { waitUntil: "load" });
    const m = await aufMarkenWarten(s);
    console.info(`REF-01 · Fundstellenlink ${ziel.search.slice(0, 60)}… → ${JSON.stringify(m)}`);
    expect(m.marken.join("")).toBe(fundstelle?.auszug);
    expect(m.lage).toBe("markiert");
    expect(m.imBild).toBe(true);
    expect(m.fokusInMarke).toBe(true);
    expect(m.ueberlauf).toBe(false);
  }, 120_000);

  it("Z · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });
});
