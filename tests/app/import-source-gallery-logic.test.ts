// AUFTRAG-ic7-import-vision: PURE-Logik der EHRLICHEN Quellen-Galerie — Datenmodell, Reihenfolge
// (aktiv→bald→geplant), Zustands-Ableitungen und die i18n-Abdeckung DE/EN/NL. DOM-frei.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  FILE_SOURCES,
  type GallerySource,
  JSON_SOURCE_IDS,
  STATE_BADGE_KEY,
  STATE_HINT_KEY,
  SYSTEM_SOURCES,
  hintKeyFor,
  orderByState,
} from "../../apps/web/src/lib/importSourceGallery";

const RANK = { active: 0, soon: 1, planned: 2 } as const;

function isOrdered(sources: readonly GallerySource[]): boolean {
  for (let i = 1; i < sources.length; i++) {
    const prev = sources[i - 1];
    const cur = sources[i];
    if (prev && cur && RANK[prev.state] > RANK[cur.state]) {
      return false;
    }
  }
  return true;
}

describe("ic7: orderByState — aktiv→bald→geplant, stabil", () => {
  it("sortiert die Zustaende in der Reihenfolge aktiv, bald, geplant", () => {
    const mixed: GallerySource[] = [
      { id: "p1", labelKey: "x", state: "planned" },
      { id: "a1", labelKey: "x", state: "active" },
      { id: "s1", labelKey: "x", state: "soon" },
      { id: "p2", labelKey: "x", state: "planned" },
      { id: "a2", labelKey: "x", state: "active" },
    ];
    expect(orderByState(mixed).map((s) => s.id)).toEqual(["a1", "a2", "s1", "p1", "p2"]);
  });

  it("ist stabil innerhalb eines Zustands (Eingabereihenfolge bleibt)", () => {
    const same: GallerySource[] = [
      { id: "first", labelKey: "x", state: "planned" },
      { id: "second", labelKey: "x", state: "planned" },
      { id: "third", labelKey: "x", state: "planned" },
    ];
    expect(orderByState(same).map((s) => s.id)).toEqual(["first", "second", "third"]);
  });
});

describe("ic7: Datenmodell Systeme + Dateien", () => {
  it("beide Galerien sind bereits aktiv→bald→geplant geordnet", () => {
    expect(isOrdered(SYSTEM_SOURCES)).toBe(true);
    expect(isOrdered(FILE_SOURCES)).toBe(true);
  });

  it("enthaelt alle drei Zustandsklassen in beiden Galerien", () => {
    for (const gallery of [SYSTEM_SOURCES, FILE_SOURCES]) {
      const states = new Set(gallery.map((s) => s.state));
      expect(states.has("active")).toBe(true);
      expect(states.has("soon")).toBe(true);
      expect(states.has("planned")).toBe(true);
    }
  });

  it("Systeme: Confluence + JSON-Import aktiv; Jira/Word/PDF bald; die geplanten Systeme sind vollstaendig", () => {
    const byId = new Map(SYSTEM_SOURCES.map((s) => [s.id, s.state]));
    expect(byId.get("confluence")).toBe("active");
    expect(byId.get("json")).toBe("active");
    for (const id of ["jira", "word-sys", "pdf-sys"]) {
      expect(byId.get(id), id).toBe("soon");
    }
    for (const id of [
      "sharepoint",
      "teams",
      "gdrive",
      "dms",
      "plm",
      "servicenow",
      "sap",
      "notion",
      "slack",
      "email",
    ]) {
      expect(byId.get(id), id).toBe("planned");
    }
  });

  it("Dateien: JSON aktiv; Word/PDF bald; Excel/PowerPoint/CSV/OCR/Transkript geplant", () => {
    const byId = new Map(FILE_SOURCES.map((s) => [s.id, s.state]));
    expect(byId.get("json-file")).toBe("active");
    for (const id of ["docx", "pdf"]) {
      expect(byId.get(id), id).toBe("soon");
    }
    for (const id of ["xlsx", "pptx", "csv", "ocr", "avtranscript"]) {
      expect(byId.get(id), id).toBe("planned");
    }
  });

  it("die aktiven JSON-Kacheln (Systeme + Dateien) sind als JSON-Fluss registriert", () => {
    for (const id of JSON_SOURCE_IDS) {
      const state = [...SYSTEM_SOURCES, ...FILE_SOURCES].find((s) => s.id === id)?.state;
      expect(state, id).toBe("active");
    }
  });
});

describe("ic7: hintKeyFor — nur bald/geplant tragen einen ehrlichen Hinweis", () => {
  it("active → kein Hinweis (null)", () => {
    expect(hintKeyFor("active")).toBeNull();
  });
  it("soon/planned → jeweils der ehrliche Hinweis-Schluessel", () => {
    expect(hintKeyFor("soon")).toBe(STATE_HINT_KEY.soon);
    expect(hintKeyFor("planned")).toBe(STATE_HINT_KEY.planned);
  });
});

describe("ic7: i18n — Badges, Hinweise, Gruppentitel in DE/EN/NL", () => {
  const badge = {
    de: { active: "aktiv", soon: "bald", planned: "geplant" },
    en: { active: "active", soon: "soon", planned: "planned" },
    nl: { active: "actief", soon: "binnenkort", planned: "gepland" },
  } as const;
  const hint = {
    de: { soon: "In Arbeit — diese Quelle kommt bald.", planned: "Geplant — kommt später." },
    en: { soon: "In progress — this source is coming soon.", planned: "Planned — coming later." },
    nl: {
      soon: "In ontwikkeling — deze bron komt binnenkort.",
      planned: "Gepland — komt later.",
    },
  } as const;
  const titles = {
    de: { systems: "Systeme", files: "Dateien" },
    en: { systems: "Systems", files: "Files" },
    nl: { systems: "Systemen", files: "Bestanden" },
  } as const;

  it("Badge-Text je Zustand ist in DE/EN/NL gepinnt", () => {
    for (const lng of ["de", "en", "nl"] as const) {
      for (const state of ["active", "soon", "planned"] as const) {
        const key = STATE_BADGE_KEY[state];
        expect(i18n.getResource(lng, "translation", key), `${lng}:${state}`).toBe(
          badge[lng][state],
        );
      }
    }
  });

  it("ehrliche Hinweise (bald/geplant) sind in DE/EN/NL gepinnt", () => {
    for (const lng of ["de", "en", "nl"] as const) {
      expect(i18n.getResource(lng, "translation", STATE_HINT_KEY.soon), `${lng}:soon`).toBe(
        hint[lng].soon,
      );
      expect(i18n.getResource(lng, "translation", STATE_HINT_KEY.planned), `${lng}:planned`).toBe(
        hint[lng].planned,
      );
    }
  });

  it("Gruppentitel Systeme/Dateien sind in DE/EN/NL gepinnt", () => {
    for (const lng of ["de", "en", "nl"] as const) {
      expect(i18n.getResource(lng, "translation", "imp.gallery.systemsTitle"), lng).toBe(
        titles[lng].systems,
      );
      expect(i18n.getResource(lng, "translation", "imp.gallery.filesTitle"), lng).toBe(
        titles[lng].files,
      );
    }
  });

  it("jeder Label-Schluessel des Modells loest in allen drei Sprachen auf (kein roher Key)", () => {
    for (const source of [...SYSTEM_SOURCES, ...FILE_SOURCES]) {
      for (const lng of ["de", "en", "nl"] as const) {
        const value = String(i18n.getResource(lng, "translation", source.labelKey) ?? "");
        expect(value.length, `${lng}:${source.labelKey}`).toBeGreaterThan(0);
      }
    }
  });
});
