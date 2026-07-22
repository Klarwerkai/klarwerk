// WP-POLISH-CLOSE (bens Punkt 1, U5-Weg): der Bibliotheks-Fragen-Knopf sendet für vertrauliche
// KOs NICHT automatisch — Variante (a), die ehrlichere: die Frage wird nur VORBEFÜLLT
// (Deep-Link ohne ?ask=1), die Ask-Seite zeigt den nüchternen Vertraulichkeits-Hinweis und der
// Nutzer sendet bewusst selbst. Fail-safe: alles, was nicht eindeutig nicht-vertraulich ist
// (unbekannte Stufen), wird wie vertraulich behandelt; das fehlende Feld ist die dokumentierte
// intern-Codierung des Servers (vertrauliche Stufen werden IMMER materialisiert).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  askConfidentialQuestionHref,
  isConfidentialAskPrefill,
  shouldAutoAskFromSearch,
} from "../../apps/web/src/lib/askQuestion";
import { isKnownNonConfidential } from "../../apps/web/src/lib/confidentiality";
import { libraryUseCta } from "../../apps/web/src/lib/libraryMaturity";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function ko(
  over: Omit<Partial<KnowledgeObject>, "confidentiality"> & { confidentiality?: string },
): KnowledgeObject {
  return {
    id: "k1",
    title: "Geheimrezeptur X",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 10,
    status: "validiert",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 0,
    assignments: [],
    asset: null,
    ...over,
  } as unknown as KnowledgeObject;
}

describe("WP-POLISH-CLOSE Punkt 1: Karten-Frage bei vertraulichem KO ohne Auto-Send", () => {
  it("vertraulich/streng vertraulich → Deep-Link OHNE ?ask=1 (kein Auto-Send), mit Hinweis-Marker", () => {
    for (const level of ["vertraulich", "streng_vertraulich"]) {
      const cta = libraryUseCta(ko({ confidentiality: level }), "Was gilt zu: Geheimrezeptur X?");
      expect(cta.kind).toBe("ask");
      expect(cta.href).not.toContain("ask=1");
      expect(cta.href).toContain("vertraulich=1");
      expect(decodeURIComponent(cta.href)).toContain("Was gilt zu: Geheimrezeptur X?");
      // Der Auto-Ask-Leser der Ask-Seite feuert für diesen Link NIE.
      const params = new URLSearchParams(cta.href.split("?")[1] ?? "");
      expect(shouldAutoAskFromSearch(params)).toBe(false);
      expect(isConfidentialAskPrefill(params)).toBe(true);
    }
  });

  it("fail-safe: eine UNBEKANNTE Stufe wird wie vertraulich behandelt (kein Auto-Send)", () => {
    const cta = libraryUseCta(ko({ confidentiality: "geheim" }), "Frage?");
    expect(cta.href).not.toContain("ask=1");
    expect(cta.href).toContain("vertraulich=1");
  });

  it("nicht-vertraulich (fehlend = dokumentiert intern / explizit intern) → Auto-Send bleibt", () => {
    const withoutField = libraryUseCta(ko({ title: "Ventil X" }), "Frage?");
    expect(withoutField.href).toContain("&ask=1");
    const explicitIntern = libraryUseCta(ko({ confidentiality: "intern" }), "Frage?");
    expect(explicitIntern.href).toContain("&ask=1");
  });

  it("isKnownNonConfidential: nur intern/fehlend sind eindeutig nicht-vertraulich (fail-safe)", () => {
    expect(isKnownNonConfidential(undefined)).toBe(true);
    expect(isKnownNonConfidential(null)).toBe(true);
    expect(isKnownNonConfidential("intern")).toBe(true);
    expect(isKnownNonConfidential("vertraulich")).toBe(false);
    expect(isKnownNonConfidential("streng_vertraulich")).toBe(false);
    expect(isKnownNonConfidential("geheim")).toBe(false);
    expect(isKnownNonConfidential(42)).toBe(false);
  });

  it("askConfidentialQuestionHref: Vorbefüllen + Marker, nie der Auto-Antwort-Parameter", () => {
    const href = askConfidentialQuestionHref("Was gilt zu: X?");
    expect(href).toContain("/fragen?q=");
    expect(href).toContain("&vertraulich=1");
    expect(href).not.toContain("ask=1");
  });

  it("die Ask-Seite zeigt den nüchternen Hinweis für vertraulich vorbefüllte Fragen (DE/EN/NL)", () => {
    const ask = read("apps/web/src/pages/Ask.tsx");
    expect(ask).toContain("isConfidentialAskPrefill(params) && !result");
    expect(ask).toContain('t("ask.confidentialPrefillHint")');
    for (const lng of ["de", "en", "nl"]) {
      expect(
        String(i18n.getResource(lng, "translation", "ask.confidentialPrefillHint") ?? "").length,
        `${lng}:ask.confidentialPrefillHint`,
      ).toBeGreaterThan(0);
    }
  });

  it("die Chips-Quelle filtert über dieselbe fail-safe-Prüfung (Verdrahtungs-Pin)", () => {
    const chips = read("apps/web/src/lib/askExampleChips.ts");
    expect(chips).toContain("isKnownNonConfidential(k.confidentiality)");
  });
});
