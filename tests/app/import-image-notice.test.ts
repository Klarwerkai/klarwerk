import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { importImageNotice } from "../../apps/web/src/lib/captureFromFile";

// WP-D1d (Fix 4): PURE Auswahl der ehrlichen Bild-Meldung aus expliziten Zählern (compressed/dropped)
// + originalAttached. „Original im Anhang" NUR bei echtem Anhang-Erfolg; sonst weggelassene = verloren.

describe("WP-D1d: importImageNotice (Zähler + Anhang-Kopplung)", () => {
  it("kein Bild → keine Meldung", () => {
    expect(importImageNotice({ total: 0, compressed: 0, dropped: 0, originalAttached: true })).toBe(
      null,
    );
  });

  it("komprimiert behalten + Anhang ok → imagesKept", () => {
    expect(
      importImageNotice({ total: 5, compressed: 5, dropped: 0, originalAttached: true }),
    ).toEqual({ key: "capture.file.imagesKept", params: { compressed: 5, dropped: 0 } });
  });

  it("komprimiert + einige weggelassen + Anhang ok → imagesKeptDropped", () => {
    expect(
      importImageNotice({ total: 8, compressed: 5, dropped: 3, originalAttached: true }),
    ).toEqual({ key: "capture.file.imagesKeptDropped", params: { compressed: 5, dropped: 3 } });
  });

  it("Anhang FEHLGESCHLAGEN, keine weggelassen → imagesNoOriginal (kein Anhang-Hinweis)", () => {
    expect(
      importImageNotice({ total: 4, compressed: 4, dropped: 0, originalAttached: false }),
    ).toEqual({ key: "capture.file.imagesNoOriginal", params: { compressed: 4, dropped: 0 } });
  });

  it("Anhang FEHLGESCHLAGEN + weggelassen → imagesLost (verlorene Bilder benannt)", () => {
    expect(
      importImageNotice({ total: 6, compressed: 4, dropped: 2, originalAttached: false }),
    ).toEqual({ key: "capture.file.imagesLost", params: { compressed: 4, dropped: 2 } });
  });
});

describe("WP-D1d: Meldungstexte sind ehrlich (DE/EN/NL)", () => {
  const attached = ["capture.file.imagesKept", "capture.file.imagesKeptDropped"];
  const notAttached = ["capture.file.imagesNoOriginal", "capture.file.imagesLost"];

  it("Anhang-Meldungen behaupten das Original im Anhang", () => {
    const positive = { de: /im Anhang/, en: /in the attachment/, nl: /in de bijlage/ };
    for (const key of attached) {
      for (const [lng, re] of Object.entries(positive)) {
        expect(String(i18n.getResource(lng, "translation", key)), `${lng}:${key}`).toMatch(re);
      }
    }
  });

  it("Fehl-Anhang-Meldungen behaupten KEIN Original im Anhang, sondern negieren klar", () => {
    const negation = { de: /NICHT/, en: /NOT/, nl: /NIET/ };
    for (const key of notAttached) {
      for (const [lng, re] of Object.entries(negation)) {
        const text = String(i18n.getResource(lng, "translation", key));
        expect(text, `${lng}:${key}`).toMatch(re);
        // Keine positive „liegt im Anhang"-Behauptung.
        const positiveClaim = /liegt im Anhang|is in the attachment|zit in de bijlage/;
        expect(text, `${lng}:${key}`).not.toMatch(positiveClaim);
      }
    }
  });

  it("die Zähler-Platzhalter bleiben in allen Sprachen erhalten", () => {
    for (const lng of ["de", "en", "nl"]) {
      expect(String(i18n.getResource(lng, "translation", "capture.file.imagesLost"))).toContain(
        "{{compressed}}",
      );
      expect(String(i18n.getResource(lng, "translation", "capture.file.imagesLost"))).toContain(
        "{{dropped}}",
      );
    }
  });
});
