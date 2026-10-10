// produkt:20261007:templates-default — K6: Klara und Editor verwenden dieselben Felder und
// Anforderungen; freie Eingabe bleibt erreichbar. Klara liest genau den Stand, den die Vorlagenwahl
// setzt (`lib/aktiveVorlage.ts`) — hier mit der eingebauten Standardvorlage aus dem Server-Katalog.
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { KlaraVorlagenKontext } from "../../apps/web/src/components/KlaraVorlagenKontext";
import { setzeAktiveVorlage } from "../../apps/web/src/lib/aktiveVorlage";
import { setLanguage } from "../../apps/web/src/test/render";
import { STANDARD_VORLAGEN } from "../../services/app/src/vorlagen";

const procedure = STANDARD_VORLAGEN.find((v) => v.id === "std-procedure");
const faq = STANDARD_VORLAGEN.find((v) => v.id === "std-faq");

afterEach(async () => {
  setzeAktiveVorlage(null);
  await setLanguage("de");
});

describe("Klaras Vorlagenkontext", () => {
  it("nennt dieselben Felder und Pflichtfelder wie der Editor — inklusive verbindlicher Space-Vorlage", () => {
    if (!procedure || !faq) {
      throw new Error("Standardvorlagen fehlen");
    }
    setzeAktiveVorlage({
      vorlage: { ...procedure, felder: [...procedure.felder] },
      space: { id: "s1", name: "Instandhaltung" },
      vorgabe: null,
      verbindlich: { ...faq, felder: [...faq.felder] },
    });
    const html = renderToStaticMarkup(<KlaraVorlagenKontext pfad="/erfassen" />);
    expect(html).toContain("Arbeitsanleitung");
    for (const f of procedure.felder) {
      expect(html).toContain(f.titel);
    }
    // Pflicht: die der verwendeten Vorlage UND die der im Space verbindlichen.
    expect(html).toContain("Pflicht beim Einreichen: Schritte, Frage, Antwort.");
    expect(html).toContain("Instandhaltung");
    expect(html).toContain("Freie Eingabe bleibt jederzeit möglich");
  });

  it("freie Eingabe: keine Vorlage, der Weg bleibt genannt; ausserhalb des Erfassens schweigt Klara", async () => {
    setzeAktiveVorlage({ vorlage: null, space: null, vorgabe: null, verbindlich: null });
    expect(renderToStaticMarkup(<KlaraVorlagenKontext pfad="/erfassen" />)).toContain(
      "ohne Vorlage",
    );
    expect(renderToStaticMarkup(<KlaraVorlagenKontext pfad="/bibliothek" />)).toBe("");
    await setLanguage("en");
    expect(renderToStaticMarkup(<KlaraVorlagenKontext pfad="/erfassen" />)).toContain(
      "without a template",
    );
  });

  it("englische Oberfläche: dieselben Felder in der englischen Fassung", async () => {
    if (!procedure) {
      throw new Error("Standardvorlage fehlt");
    }
    await setLanguage("en");
    setzeAktiveVorlage({
      vorlage: { ...procedure, felder: [...procedure.felder] },
      space: null,
      vorgabe: null,
      verbindlich: null,
    });
    const html = renderToStaticMarkup(<KlaraVorlagenKontext pfad="/erfassen" />);
    expect(html).toContain("Work instruction");
    expect(html).toContain("Required on submission: Steps.");
  });
});
