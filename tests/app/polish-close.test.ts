// WP-POLISH-CLOSE (bens Punkt 1, U5-Weg): der Bibliotheks-Fragen-Knopf sendet für vertrauliche
// KOs NICHT automatisch — Variante (a), die ehrlichere: die Frage wird nur VORBEFÜLLT
// (Deep-Link ohne ?ask=1), die Ask-Seite zeigt den nüchternen Vertraulichkeits-Hinweis und der
// Nutzer sendet bewusst selbst. Fail-safe: alles, was nicht eindeutig nicht-vertraulich ist
// (unbekannte Stufen), wird wie vertraulich behandelt; das fehlende Feld ist die dokumentierte
// intern-Codierung des Servers (vertrauliche Stufen werden IMMER materialisiert).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fragenHref } from "../../apps/web/src/components/bibliothek/fragen";
import i18n from "../../apps/web/src/i18n";
import {
  askConfidentialQuestionHref,
  isConfidentialAskPrefill,
  shouldAutoAskFromSearch,
} from "../../apps/web/src/lib/askQuestion";
import { isKnownNonConfidential } from "../../apps/web/src/lib/confidentiality";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

// JOB 3063 (H4, Runde 5): Diese Zusage hing bis dahin an `libraryUseCta`. Der Knopf der Lesefläche
// zieht seine Adresse jetzt aus `components/bibliothek/fragen.ts::fragenHref` — die Reife-Verzweigung
// ist weg (jeder Eintrag heißt „Fragen"), die VERTRAULICHKEITS-Kante bleibt Wort für Wort dieselbe.
// Gemessen wird deshalb hier weiter, nur an der Funktion, die den Knopf heute wirklich speist.
// `undefined` ist die dokumentierte Kante „Feld fehlt" — sie zählt als nicht-vertraulich.
const href = (level: string | undefined, frage: string): string => fragenHref("k1", frage, level);

describe("WP-POLISH-CLOSE Punkt 1: Karten-Frage bei vertraulichem KO ohne Auto-Send", () => {
  it("vertraulich/streng vertraulich → Deep-Link OHNE ?ask=1 (kein Auto-Send), mit Hinweis-Marker", () => {
    for (const level of ["vertraulich", "streng_vertraulich"]) {
      const ziel = href(level, "Was gilt zu: Geheimrezeptur X?");
      expect(ziel).not.toContain("ask=1");
      expect(ziel).toContain("vertraulich=1");
      expect(decodeURIComponent(ziel)).toContain("Was gilt zu: Geheimrezeptur X?");
      // Der Auto-Ask-Leser der Ask-Seite feuert für diesen Link NIE.
      const params = new URLSearchParams(ziel.split("?")[1] ?? "");
      expect(shouldAutoAskFromSearch(params)).toBe(false);
      expect(isConfidentialAskPrefill(params)).toBe(true);
      // Und der Bezug auf genau diesen Eintrag reist mit (Auftrag §5.3).
      expect(params.get("ko")).toBe("k1");
    }
  });

  it("fail-safe: eine UNBEKANNTE Stufe wird wie vertraulich behandelt (kein Auto-Send)", () => {
    const ziel = href("geheim", "Frage?");
    expect(ziel).not.toContain("ask=1");
    expect(ziel).toContain("vertraulich=1");
  });

  it("nicht-vertraulich (fehlend = dokumentiert intern / explizit intern) → Auto-Send bleibt", () => {
    expect(href(undefined, "Frage?")).toContain("&ask=1");
    expect(href("intern", "Frage?")).toContain("&ask=1");
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
