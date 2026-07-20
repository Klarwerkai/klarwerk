import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { importImageNotice } from "../../apps/web/src/lib/captureFromFile";

// WP-D1d/WP-D1e (Fix 1): PURE Auswahl der ehrlichen Bild-Meldung aus expliziten Zählern
// (compressed/dropped) + originalAttached. „Original im Anhang" NUR bei echtem Anhang-Erfolg; sonst
// weggelassene = verloren. WP-D1e führt zusätzlich `kept` (= total − dropped) als eigenen Platzhalter:
// tatsächlich übernommene Bilder werden benannt, statt bei compressed=0 irreführend „0 komprimiert" zu lesen.

describe("WP-D1e: importImageNotice (Zähler kept/compressed/dropped + Anhang-Kopplung)", () => {
  it("kein Bild → keine Meldung", () => {
    expect(importImageNotice({ total: 0, compressed: 0, dropped: 0, originalAttached: true })).toBe(
      null,
    );
  });

  it("komprimiert behalten + Anhang ok → imagesKept (kept = total)", () => {
    expect(
      importImageNotice({ total: 5, compressed: 5, dropped: 0, originalAttached: true }),
    ).toEqual({
      key: "capture.file.imagesKept",
      params: { kept: 5, compressed: 5, dropped: 0 },
    });
  });

  it("komprimiert + einige weggelassen + Anhang ok → imagesKeptDropped (kept = total − dropped)", () => {
    expect(
      importImageNotice({ total: 8, compressed: 5, dropped: 3, originalAttached: true }),
    ).toEqual({
      key: "capture.file.imagesKeptDropped",
      params: { kept: 5, compressed: 5, dropped: 3 },
    });
  });

  it("Anhang FEHLGESCHLAGEN, keine weggelassen → imagesNoOriginal (kein Anhang-Hinweis)", () => {
    expect(
      importImageNotice({ total: 4, compressed: 4, dropped: 0, originalAttached: false }),
    ).toEqual({
      key: "capture.file.imagesNoOriginal",
      params: { kept: 4, compressed: 4, dropped: 0 },
    });
  });

  it("Anhang FEHLGESCHLAGEN + weggelassen → imagesLost (verlorene Bilder benannt)", () => {
    expect(
      importImageNotice({ total: 6, compressed: 4, dropped: 2, originalAttached: false }),
    ).toEqual({
      key: "capture.file.imagesLost",
      params: { kept: 4, compressed: 4, dropped: 2 },
    });
  });

  // WP-D1e (Fix 1, Kern): alle Bilder unverändert BEHALTEN (klein/leicht) — total>0, compressed=0,
  // dropped=0. Bisher las die Meldung irreführend „0 Bilder komprimiert"; jetzt nennt kept die 4.
  it("alle unveraendert behalten (compressed=0, dropped=0) → kept = total statt irrefuehrender Null", () => {
    expect(
      importImageNotice({ total: 4, compressed: 0, dropped: 0, originalAttached: true }),
    ).toEqual({
      key: "capture.file.imagesKept",
      params: { kept: 4, compressed: 0, dropped: 0 },
    });
  });

  // WP-D1e (Fix 1): Teilkompression 0 < compressed < kept — beide Zahlen bleiben getrennt.
  it("Teilkompression (0 < compressed < kept) → getrennte Zähler", () => {
    expect(
      importImageNotice({ total: 5, compressed: 2, dropped: 0, originalAttached: true }),
    ).toEqual({
      key: "capture.file.imagesKept",
      params: { kept: 5, compressed: 2, dropped: 0 },
    });
  });

  // WP-D1e (Fix 1): Encoder-Fallback (kein Re-Encode möglich) — compressed=0, aber die Bilder sind
  // übernommen. Auch OHNE Anhang wird kept benannt (nicht „0 komprimiert" ohne Bezug).
  it("Encoder-Fallback (compressed=0) ohne Anhang → imagesNoOriginal mit kept", () => {
    expect(
      importImageNotice({ total: 3, compressed: 0, dropped: 0, originalAttached: false }),
    ).toEqual({
      key: "capture.file.imagesNoOriginal",
      params: { kept: 3, compressed: 0, dropped: 0 },
    });
  });
});

describe("WP-D1e: Meldungstexte sind ehrlich (DE/EN/NL)", () => {
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

  it("alle drei Zähler-Platzhalter (kept/compressed/dropped) bleiben erhalten", () => {
    for (const lng of ["de", "en", "nl"]) {
      const lost = String(i18n.getResource(lng, "translation", "capture.file.imagesLost"));
      expect(lost, `${lng}:imagesLost`).toContain("{{kept}}");
      expect(lost, `${lng}:imagesLost`).toContain("{{compressed}}");
      expect(lost, `${lng}:imagesLost`).toContain("{{dropped}}");
      // Auch die reinen Übernahme-Meldungen nennen kept UND compressed getrennt.
      const kept = String(i18n.getResource(lng, "translation", "capture.file.imagesKept"));
      expect(kept, `${lng}:imagesKept`).toContain("{{kept}}");
      expect(kept, `${lng}:imagesKept`).toContain("{{compressed}}");
    }
  });

  // WP-D1e (Fix 1): der gerenderte Text nennt bei compressed=0 die übernommenen Bilder (kept), statt
  // nur „0 komprimiert" — geprüft über die echte Interpolation je Sprache.
  it("gerenderte Meldung nennt kept auch bei compressed=0 (keine irreführende Null)", () => {
    const params = { kept: 4, compressed: 0, dropped: 0 };
    const expectations = {
      de: { t: i18n.getFixedT("de"), keptWord: /übernommen/ },
      en: { t: i18n.getFixedT("en"), keptWord: /imported/ },
      nl: { t: i18n.getFixedT("nl"), keptWord: /overgenomen/ },
    };
    for (const [lng, { t, keptWord }] of Object.entries(expectations)) {
      const rendered = String(t("capture.file.imagesKept", params));
      expect(rendered, `${lng}: kept-Zahl`).toContain("4");
      expect(rendered, `${lng}: kept-Wort`).toMatch(keptWord);
      // Der Platzhalter darf nicht unaufgelöst durchsickern.
      expect(rendered, `${lng}: interpoliert`).not.toContain("{{kept}}");
    }
  });
});
