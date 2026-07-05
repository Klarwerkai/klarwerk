import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  KLARA_PAGES,
  allFaqEntries,
  allKlaraEntries,
  klaraEntryById,
  pageEntryFor,
  pageTitleKeyForRoute,
  rankKlara,
  resolveKlaraEntries,
  searchKlara,
} from "../../apps/web/src/lib/klaraRegistry";

// Klara v1 (Pedi 05.07.): EINE Registry über alle Hilfe-Quellen — Seiten, chelp.*, vhelp.*,
// Hilfeseiten-Kapitel. Getestet: Vollständigkeit, DE+EN-Auflösung, Kontext-Zuordnung, Suche.
describe("Klara v1: konsolidierte Hilfe-Registry", () => {
  it("bündelt alle Quellen mit eindeutigen IDs (Seiten + chelp + vhelp + Kapitel)", () => {
    const entries = allKlaraEntries();
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    // 16 Seiten + 23 Erfassen + 26 Prüfbereich + 49 Sektionen (Berater 05.07.) + 10 Kapitel ≥ 124.
    expect(entries.length).toBeGreaterThanOrEqual(124);
    for (const prefix of ["page:", "cap:", "rev:", "sec:", "topic:"]) {
      expect(
        entries.some((e) => e.id.startsWith(prefix)),
        `Quelle fehlt: ${prefix}`,
      ).toBe(true);
    }
    // Jeder Eintrag verweist auf eine echte interne Route (Absprung aus dem Panel).
    for (const e of entries) {
      expect(e.route.startsWith("/"), `${e.id} ohne Route`).toBe(true);
    }
  });

  it("löst jeden Titel und Text in DE und EN auf (keine rohen Keys, keine Alibi-Texte)", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const entry of allKlaraEntries()) {
        const title = i18n.t(entry.titleKey);
        const body = i18n.t(entry.bodyKey);
        expect(title, `${lng}:${entry.titleKey}`).not.toBe(entry.titleKey);
        expect(body, `${lng}:${entry.bodyKey}`).not.toBe(entry.bodyKey);
        expect(body.length, `${lng}:${entry.bodyKey}`).toBeGreaterThan(30);
      }
    }
  });

  it("ordnet Routen dem richtigen Seiten-Kontext zu (inkl. /wissen/:id, unbekannt = null)", () => {
    expect(pageEntryFor("/validierung")?.id).toBe("page:validation");
    expect(pageEntryFor("/erfassen")?.id).toBe("page:capture");
    expect(pageEntryFor("/wissen/abc-123")?.id).toBe("page:koDetail");
    expect(pageEntryFor("/gibtsnicht")).toBeNull();
    // Jede Klara-Seite (außer dem /wissen-Sondereintrag) ist über ihre Route erreichbar.
    for (const p of KLARA_PAGES.filter((x) => x.id !== "koDetail")) {
      expect(pageEntryFor(p.route)?.id, p.route).toBe(`page:${p.id}`);
    }
  });

  it("findet Anker-Einträge per ID und rät nie (unbekannt = null)", () => {
    expect(klaraEntryById("rev:originFilter")?.route).toBe("/validierung");
    expect(klaraEntryById("cap:modes")?.route).toBe("/erfassen");
    expect(klaraEntryById("gibt:esnicht")).toBeNull();
  });

  it("sucht tolerant: Groß/Klein, Mehrwort und Synonyme (freigeben → validieren)", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    expect(searchKlara(resolved, "BUS-FAKTOR").length).toBeGreaterThan(0);
    expect(searchKlara(resolved, "wissenslücke").length).toBeGreaterThan(0);
    // Synonym: Alltagswort „freigeben" trifft Validierungs-Einträge.
    const syn = searchKlara(resolved, "freigeben");
    expect(syn.length).toBeGreaterThan(0);
    expect(syn.some((e) => e.id === "page:validation" || e.route === "/validierung")).toBe(true);
    // Leere Suche liefert bewusst nichts (Panel zeigt dann den Seiten-Kontext).
    expect(searchKlara(resolved, "   ")).toEqual([]);
  });

  it("rankt ganze FRAGEN tolerant für die KI-Grundlage (Füllwörter kippen nichts)", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    // Die strikte Suche findet für diese Frage nichts — das Ranking sehr wohl.
    const question = "Warum brauche ich mehrere grüne Freigaben bis zur Validierung?";
    expect(searchKlara(resolved, question)).toEqual([]);
    const ranked = rankKlara(resolved, question, 6);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.length).toBeLessThanOrEqual(6);
    expect(ranked.some((e) => e.route === "/validierung")).toBe(true);
    // Ohne verwertbare Wörter ehrlich leer — dann gibt es auch keinen Modellaufruf.
    expect(rankKlara(resolved, "ä ü ö")).toEqual([]);
  });

  it("Satzzeichen kippen die Suche nicht mehr (Pedi-Bug: Frage mit Fragezeichen)", async () => {
    await i18n.changeLanguage("de");
    const resolved = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
    // Vor dem Fix fand „Validierung?" NICHTS — das Fragezeichen klebte am Suchwort.
    expect(searchKlara(resolved, "Validierung?").length).toBeGreaterThan(0);
    expect(searchKlara(resolved, "Bus-Faktor?!").length).toBeGreaterThan(0);
    expect(rankKlara(resolved, "Was ist der Bus-Faktor?").length).toBeGreaterThan(0);
  });

  it("liefert das Seiten-Label je Route (für den Zum-Bereich-Link der KI-Antwort)", () => {
    expect(pageTitleKeyForRoute("/validierung")).toBe("nav.validation");
    expect(pageTitleKeyForRoute("/gibtsnicht")).toBeNull();
  });

  it("FAQ (Berater 3a): 77 Antworten in der Wissensdatenbank — nur im deutschen UI, bis EN folgt", async () => {
    const de = allFaqEntries("de");
    expect(de.length).toBeGreaterThanOrEqual(77);
    expect(new Set(de.map((e) => e.id)).size).toBe(de.length);
    for (const e of de) {
      expect(e.id.startsWith("faq:"), e.id).toBe(true);
      expect(e.title.length, e.id).toBeGreaterThan(10);
      expect(e.body.length, e.id).toBeGreaterThan(60);
      expect(e.route.startsWith("/"), e.id).toBe(true);
    }
    // Ehrliches Sprach-Gate: EN bleibt leer, bis Lieferung 3b die Übersetzung bringt.
    expect(allFaqEntries("en")).toEqual([]);
    // Die FAQ ist durchsuchbar Teil des Korpus: „ChatGPT" steht NUR in der FAQ.
    await i18n.changeLanguage("de");
    const corpus = [
      ...resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k)),
      ...allFaqEntries("de"),
    ];
    const hit = searchKlara(corpus, "ChatGPT");
    expect(hit.some((e) => e.id === "faq:faq.grund.1")).toBe(true);
    expect(rankKlara(corpus, "Wem gehört das Wissen, das ich eingebe?").length).toBeGreaterThan(0);
  });
});
