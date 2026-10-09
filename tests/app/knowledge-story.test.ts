import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  KNOWLEDGE_STORY_SURFACES,
  type StorySurface,
  knowledgeStory,
} from "../../apps/web/src/lib/knowledgeStory";
import type { KnowledgeOsPhase } from "../../apps/web/src/lib/taskAction";

// SCRUM-377 / AG-12 / AG-13 / KG-UX: app-weite Knowledge-Rescue-Story für leere/erste Zustände.
// DOM-frei: ordnet jede Kernfläche in den Knowledge-OS-Kreis ein und liefert nur i18n-Keys.
// Kein Score, keine Validierung, keine Mutation.

describe("SCRUM-377: knowledgeStory — Flächen → Kreis-Phase", () => {
  it("bildet jede Fläche auf die richtige Phase im Capture→Review→Use-Kreis ab", () => {
    const phaseBySurface: Record<StorySurface, KnowledgeOsPhase> = {
      start: "capture",
      tasks: "validate",
      library: "use",
      validation: "validate",
      risk: "capture",
      neighborhood: "use",
      audit: "maintain",
      gaps: "use",
      lifecycle: "maintain",
      duplicates: "validate",
      objekt: "use",
      entwuerfe: "capture",
      verwaltung: "maintain",
      auswertung: "maintain",
      import: "capture",
      anleitung: "use",
      spaces: "use",
      ausgang: "validate",
      wissensnetz: "use",
      meldungen: "maintain",
      horizont: "maintain",
      lernpfad: "use",
      hilfe: "use",
      conflicts: "validate",
      gliederung: "capture",
    };
    for (const surface of KNOWLEDGE_STORY_SURFACES) {
      const story = knowledgeStory(surface);
      expect(story.phase).toBe(phaseBySurface[surface]);
      // Kreis-Label folgt der bestehenden Vokabel cycle.<phase>.label (eine Sprache app-weit).
      expect(story.phaseLabelKey).toBe(`cycle.${story.phase}.label`);
    }
  });

  it("nutzt EINE geteilte Rescue-Story + geteilten Ehrlichkeitshinweis, aber flächenspezifische Leads", () => {
    const stories = KNOWLEDGE_STORY_SURFACES.map((s) => knowledgeStory(s));
    for (const story of stories) {
      expect(story.titleKey).toBe("story.rescue.title");
      expect(story.honestKey).toBe("story.honest");
      expect(story.leadKey).toMatch(/^story\.surface\.[a-z]+\.lead$/);
    }
    // Leads sind eindeutig je Fläche (keine Doppelung).
    const leads = new Set(stories.map((s) => s.leadKey));
    expect(leads.size).toBe(KNOWLEDGE_STORY_SURFACES.length);
  });

  // R-0956: dazugekommen sind die Risikoseite (Cockpit/Bus-Faktor), die Schlagwort-Nachbarschaft,
  // das Audit-Protokoll und (Bestandsabgleich, Nacharbeit 4) Lücken, Lebenszyklus und Dubletten.
  // Nacharbeit 7 (Ben): R-0956 gilt für JEDE leere Liste — dazu kommen die Teillisten eines
  // Beitrags, Entwürfe, Verwaltung, Auswertung, Import, Anleitung, Räume, Ausgangsprüfung,
  // Wissensnetz, Meldungen, Ruhestandshorizont, Lernpfad, Seitenhilfe, Konflikte und Gliederung.
  it("deckt genau die fünfundzwanzig Flächen ab", () => {
    expect([...KNOWLEDGE_STORY_SURFACES].sort()).toEqual([
      "anleitung",
      "audit",
      "ausgang",
      "auswertung",
      "conflicts",
      "duplicates",
      "entwuerfe",
      "gaps",
      "gliederung",
      "hilfe",
      "horizont",
      "import",
      "lernpfad",
      "library",
      "lifecycle",
      "meldungen",
      "neighborhood",
      "objekt",
      "risk",
      "spaces",
      "start",
      "tasks",
      "validation",
      "verwaltung",
      "wissensnetz",
    ]);
  });
});

describe("SCRUM-377: Story-Copy ist ehrlich und in DE/EN vorhanden", () => {
  it("alle Story-Keys (Titel, Ehrlichkeit, Leads) in DE und EN vorhanden", () => {
    const keys = new Set<string>();
    for (const surface of KNOWLEDGE_STORY_SURFACES) {
      const s = knowledgeStory(surface);
      keys.add(s.titleKey);
      keys.add(s.honestKey);
      keys.add(s.leadKey);
    }
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: Titel spricht vom Sichern (verloren/lost), Hinweis verspricht keine Auto-Freigabe (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", "story.rescue.title") ?? "")).toMatch(
      /verloren|sichert/i,
    );
    expect(String(i18n.getResource("en", "translation", "story.rescue.title") ?? "")).toMatch(
      /lost|secures/i,
    );
    expect(String(i18n.getResource("de", "translation", "story.honest") ?? "")).toMatch(
      /nach der Prüfung|gesichert|automatisch/i,
    );
    expect(String(i18n.getResource("en", "translation", "story.honest") ?? "")).toMatch(
      /after the team reviews|secured|automatically/i,
    );
  });
});
