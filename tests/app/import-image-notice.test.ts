import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

// WP-D1d/WP-D1e (Fix 1): die ehrliche Bild-Meldung aus expliziten Zählern (kept/compressed/dropped)
// + Anhang-Erfolg. „Original im Anhang" NUR bei echtem Anhang-Erfolg; sonst weggelassene = verloren.
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): Der erste Block dieser Datei prüfte `importImageNotice`,
// die Meldungswahl auf der alten `imageInfo`-Bilanz. Seit JOB 513/D3B wählt der Arbeitsraum über den
// Bildtransfer-Vertrag (`imageTransferSummary`, gemessen in `tests/capture/wp-d9b-image-budget.test.ts`);
// die alte Wahl hatte keinen Produktaufrufer und ist entfernt, mit ihr jener Block. Die Texte selbst
// liest der Vertrag weiter — sie bleiben hier gemessen.

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
