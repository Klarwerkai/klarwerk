import { afterEach, describe, expect, it } from "vitest";
import { makeKo, renderMarkup, setLanguage } from "../../test/render";
import { KoReadBody, KoReadHeader } from "./KoRead";

// SCRUM-513 (WP1): Grundabdeckung für die herausgelösten reinen Lese-Komponenten (laut Audit fehlte sie).
// Pinnt den Sichtvertrag (Titel/Konfidenz/Aussage/Bedingungen/Maßnahmen/Tags) + i18n der Section-Labels.

afterEach(async () => {
  await setLanguage("de"); // Sprache nach jedem Test zurücksetzen
});

describe("KoReadHeader", () => {
  it("zeigt Titel und Konfidenzwert", () => {
    const html = renderMarkup(
      <KoReadHeader ko={makeKo({ title: "Pumpe entlüften", confidence: 84 })} />,
    );
    expect(html).toContain("Pumpe entlüften");
    expect(html).toContain("84"); // ConfidenceBar-Rohwert sichtbar
  });
});

describe("KoReadBody", () => {
  it("zeigt die Aussage, wenn kein bodyHtml gesetzt ist", () => {
    const html = renderMarkup(<KoReadBody ko={makeKo({ statement: "Klartext-Aussage." })} />);
    expect(html).toContain("Klartext-Aussage.");
  });

  it("rendert Bedingungen, Maßnahmen und Tags", () => {
    const html = renderMarkup(
      <KoReadBody
        ko={makeKo({
          conditions: ["Bei Überdruck"],
          measures: ["Ventil schließen"],
          tags: ["druck", "ventil"],
        })}
      />,
    );
    expect(html).toContain("Bei Überdruck");
    expect(html).toContain("Ventil schließen");
    expect(html).toContain("#druck");
    expect(html).toContain("#ventil");
  });

  it("blendet leere Abschnitte aus (kein leerer Rahmen)", () => {
    const html = renderMarkup(
      <KoReadBody ko={makeKo({ conditions: [], measures: [], tags: [] })} />,
    );
    // Keine Bedingungen/Maßnahmen-Labels, wenn die Listen leer sind.
    expect(html).not.toContain("Bedingungen");
    expect(html).not.toContain("Maßnahme");
  });

  it("rendert das sanitisierte Body-HTML statt der Roh-Aussage, wenn bodyHtml gesetzt ist", () => {
    const html = renderMarkup(
      <KoReadBody ko={makeKo({ bodyHtml: "<p>Formatierter <strong>Inhalt</strong></p>" })} />,
    );
    expect(html).toContain("Formatierter");
    expect(html).toContain("<strong>Inhalt</strong>");
  });

  it("i18n: Section-Labels folgen der Sprache (DE → EN)", async () => {
    const ko = makeKo({ conditions: ["x"], measures: ["y"] });
    const de = renderMarkup(<KoReadBody ko={ko} />);
    expect(de).toContain("Aussage");
    expect(de).toContain("Bedingungen");
    await setLanguage("en");
    const en = renderMarkup(<KoReadBody ko={ko} />);
    expect(en).toContain("Statement");
    expect(en).toContain("Conditions");
    expect(en).not.toContain("Aussage");
  });
});
