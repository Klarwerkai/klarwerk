import { describe, expect, it } from "vitest";
import { buildServices } from "./build-app";
import { DEMO_TEXTS, type DemoLocale } from "./demo-content";
import { seedDemo } from "./seed-demo";

const LOCALES = ["de", "en", "nl"] as const;

// Erwartete, je Sprache wörtliche Streitwerte (blau/blue/blauw · Rot/red/rood). Diese pinnen die
// Übersetzung fest, damit sie sich nicht unbemerkt verschiebt.
const COLOR: Record<DemoLocale, { blue: string; red: string }> = {
  de: { blue: "blau", red: "Rot" },
  en: { blue: "blue", red: "red" },
  nl: { blue: "blauw", red: "rood" },
};

describe("SCRUM-487: dreisprachiger Demo-Content — Invarianten", () => {
  for (const locale of LOCALES) {
    const t = DEMO_TEXTS[locale];

    it(`[${locale}] Firmenwagen: Streitwert steht wörtlich in Aussage UND Belegzitat`, () => {
      // Streitwert = erwartete Farbe
      expect(t.carConflict.aWert).toBe(COLOR[locale].blue);
      expect(t.carConflict.bWert).toBe(COLOR[locale].red);
      // Zitat = Aussage (der Beleg IST die KO-Aussage)
      expect(t.carConflict.quoteA).toBe(t.koCarBlau.statement);
      expect(t.carConflict.quoteB).toBe(t.koCarRot.statement);
      // Streitwert wörtlich in Aussage und Zitat
      expect(t.koCarBlau.statement.includes(t.carConflict.aWert)).toBe(true);
      expect(t.koCarRot.statement.includes(t.carConflict.bWert)).toBe(true);
      expect(t.carConflict.quoteA.includes(t.carConflict.aWert)).toBe(true);
      expect(t.carConflict.quoteB.includes(t.carConflict.bWert)).toBe(true);
    });

    it(`[${locale}] Vorwärmung: Streitwert steht wörtlich im Belegzitat`, () => {
      expect(t.warmConflict.quoteA).toBe(t.koWarm.statement);
      expect(t.warmConflict.quoteB).toBe(t.koNoWarm.statement);
      expect(t.warmConflict.quoteA.includes(t.warmConflict.aWert)).toBe(true);
      expect(t.warmConflict.quoteB.includes(t.warmConflict.bWert)).toBe(true);
    });
  }

  it("die drei Sprachen sind wirklich verschieden (keine Platzhalter-Reste = de)", () => {
    expect(DEMO_TEXTS.en.koCarBlau.statement).not.toBe(DEMO_TEXTS.de.koCarBlau.statement);
    expect(DEMO_TEXTS.nl.koCarBlau.statement).not.toBe(DEMO_TEXTS.de.koCarBlau.statement);
    expect(DEMO_TEXTS.en.koCarBlau.statement).not.toBe(DEMO_TEXTS.nl.koCarBlau.statement);
  });
});

// End-to-End: der echte Seed erzeugt je Sprache die Showcase-Kollisionen mit lokalisierten,
// wörtlich belegten Streitwerten (kollision in allen drei Sprachen vorhanden).
describe("SCRUM-487: Seed erzeugt lokalisierte Showcase-Kollisionen", () => {
  for (const locale of LOCALES) {
    it(`[${locale}] Firmenwagen- + Vorwärmung-Kollision mit lokalisierten Streitwerten`, async () => {
      const services = buildServices();
      await seedDemo(services, locale);
      const open = await services.conflicts.unresolved();
      const t = DEMO_TEXTS[locale];

      const car = open.find(
        (c) => c.detector?.kollision?.streitpunkt === t.carConflict.streitpunkt,
      );
      expect(car, `Firmenwagen-Kollision (${locale}) fehlt im Seed`).toBeDefined();
      const k = car?.detector?.kollision;
      expect(k?.seiteA.streitwert).toBe(COLOR[locale].blue);
      expect(k?.seiteB.streitwert).toBe(COLOR[locale].red);
      expect(car?.detector?.quotes?.a.includes(COLOR[locale].blue)).toBe(true);
      expect(car?.detector?.quotes?.b.includes(COLOR[locale].red)).toBe(true);
      expect(k?.seiteA.streitwertWoertlich).toBe(true);
      expect(k?.seiteB.streitwertWoertlich).toBe(true);

      expect(
        open.some((c) => c.detector?.kollision?.streitpunkt === t.warmConflict.streitpunkt),
      ).toBe(true);
    });
  }
});
