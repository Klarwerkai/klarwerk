import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { deriveIntakeSuggestion } from "../../../lib/intakeSuggestion";
import { setLanguage } from "../../../test/render";
import { StructureSuggestionChips } from "./StructureSuggestionChips";

// SCRUM-527 (WP3): der Struktur-Vorschlag als editierbare Chips; Platzhalter-Ableitung aus dem Text.

afterEach(async () => {
  await setLanguage("de");
});

describe("deriveIntakeSuggestion", () => {
  it("nimmt den ersten Satz als Titel und den Autor als Quelle", () => {
    const s = deriveIntakeSuggestion(
      "Vor jeder Wartung Not-Aus ziehen. Und sichern.",
      "Anna Muster",
    );
    expect(s.title).toBe("Vor jeder Wartung Not-Aus ziehen");
    expect(s.source).toBe("Anna Muster");
    expect(s.category).toBe(""); // leer, Nutzer tippt an
  });

  it("kürzt lange Titel mit Auslassung", () => {
    const long = `${"a".repeat(80)} ende`;
    const s = deriveIntakeSuggestion(long, "x");
    expect(s.title.length).toBeLessThanOrEqual(60);
    expect(s.title.endsWith("…")).toBe(true);
  });
});

describe("StructureSuggestionChips", () => {
  const suggestion = { title: "Not-Aus vor Wartung", category: "Wartung", source: "Anna" };

  it("rendert die drei editierbaren Chips mit den vorgeschlagenen Werten", () => {
    const html = renderToStaticMarkup(
      <StructureSuggestionChips suggestion={suggestion} onChange={() => {}} />,
    );
    expect(html).toContain("Titel");
    expect(html).toContain("Kategorie");
    expect(html).toContain("Vermutete Quelle");
    expect(html).toContain('value="Not-Aus vor Wartung"'); // editierbarer Wert
    expect(html).toContain('value="Wartung"');
    expect(html).toContain('value="Anna"');
    expect((html.match(/<input/g) ?? []).length).toBe(3); // drei editierbare Felder
  });

  it("markiert einen abgeleiteten Platzhalter ehrlich (derived-Badge)", () => {
    const html = renderToStaticMarkup(
      <StructureSuggestionChips suggestion={suggestion} onChange={() => {}} derived />,
    );
    expect(html).toContain("aus deinem Text abgeleitet");
  });

  it("ohne derived → kein Badge", () => {
    const html = renderToStaticMarkup(
      <StructureSuggestionChips suggestion={suggestion} onChange={() => {}} />,
    );
    expect(html).not.toContain("aus deinem Text abgeleitet");
  });

  it("i18n: Chip-Labels folgen der Sprache (DE → EN → NL)", async () => {
    await setLanguage("en");
    let html = renderToStaticMarkup(
      <StructureSuggestionChips suggestion={suggestion} onChange={() => {}} />,
    );
    expect(html).toContain("Likely source");
    expect(html).toContain("tap anything");
    await setLanguage("nl");
    html = renderToStaticMarkup(
      <StructureSuggestionChips suggestion={suggestion} onChange={() => {}} />,
    );
    expect(html).toContain("Vermoedelijke bron");
  });
});
