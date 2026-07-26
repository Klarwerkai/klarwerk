// AUFTRAG-mega9 Block E-1 (KW-E2E-005): Der offene Importkandidat hieß „Neu".
//
// „Neu" beschreibt den Anlagezustand, nicht die Bedeutung für den Nutzer: der Kandidat ist zur
// Prüfung vorgemerkt und wartet auf eine Entscheidung. Der Prüfer schlug ausdrücklich vor, die
// Statuskopie zu ZENTRALISIEREN statt drei Fundstellen einzeln umzubenennen — genau das prüft dieser
// Test: EINE Quelle für Text, Farbton und „ist offen".
import { describe, expect, it } from "vitest";
import de from "../../apps/web/src/i18n";
import {
  IMPORT_CANDIDATE_STATES,
  importCandidateStatusKey,
  importCandidateStatusTone,
  isImportCandidateStatus,
  isOpenImportCandidate,
} from "../../apps/web/src/lib/importCandidateStatus";

describe("Block E-1: zentrale Statuskopie des Importkandidaten", () => {
  it("jeder bekannte Zustand hat einen eigenen Schlüssel", () => {
    for (const state of IMPORT_CANDIDATE_STATES) {
      expect(importCandidateStatusKey(state)).toBe(`imp.status.${state}`);
    }
  });

  it("ein unbekannter Zustand fällt auf einen ehrlichen Text zurück, nicht auf den rohen Schlüssel", () => {
    expect(importCandidateStatusKey("gibt-es-nicht")).toBe("imp.status.unknown");
    expect(isImportCandidateStatus("gibt-es-nicht")).toBe(false);
  });

  it("'offen' ist eine Funktion, nicht ein an vier Stellen wiederholter Vergleich", () => {
    expect(isOpenImportCandidate("neu")).toBe(true);
    for (const state of ["in_bearbeitung", "angenommen", "abgelehnt", "info-angefragt"]) {
      expect(isOpenImportCandidate(state)).toBe(false);
    }
  });

  it("der Farbton kommt aus derselben Quelle wie der Text", () => {
    // Offen = etwas wartet auf eine Entscheidung → Warnton (vorher neutral „bg-page", was den
    // offenen Zustand optisch wie einen erledigten aussehen ließ).
    expect(importCandidateStatusTone("neu")).toContain("trust-warn");
    expect(importCandidateStatusTone("angenommen")).toContain("trust-pos");
    expect(importCandidateStatusTone("abgelehnt")).toContain("trust-crit");
    expect(importCandidateStatusTone("gibt-es-nicht")).toBe("bg-page text-muted");
  });

  it("der sichtbare Text sagt in DE/EN/NL 'zur Prüfung vorgemerkt' statt 'Neu'", () => {
    const key = importCandidateStatusKey("neu");
    const expected: Record<string, string> = {
      de: "Zur Prüfung vorgemerkt",
      en: "Marked for review",
      nl: "Voorgemerkt voor controle",
    };
    for (const [lng, text] of Object.entries(expected)) {
      expect(de.getFixedT(lng)(key), lng).toBe(text);
      // Und der alte, irreführende Text ist wirklich weg.
      expect(de.getFixedT(lng)(key), lng).not.toBe("Neu");
    }
  });

  it("alle drei Sprachen kennen jeden Zustand (kein fehlender Schlüssel)", () => {
    for (const lng of ["de", "en", "nl"]) {
      for (const state of [...IMPORT_CANDIDATE_STATES, "unknown"]) {
        const key = `imp.status.${state}`;
        const value = de.getFixedT(lng)(key);
        // i18next gibt bei fehlendem Schlüssel den Schlüssel selbst zurück.
        expect(value, `${lng} ${key}`).not.toBe(key);
        expect(String(value).length, `${lng} ${key}`).toBeGreaterThan(0);
      }
    }
  });
});
