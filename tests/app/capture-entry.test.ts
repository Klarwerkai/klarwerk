import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  CAPTURE_ENTRY_TEXT,
  CAPTURE_INTRO_SEEN_KEY,
  CAPTURE_MODES,
  EXPERT_MODE,
  type KeyValueStore,
  NARRATE_MODES,
  isCaptureFirstRun,
  isExpertMode,
  markCaptureIntroSeen,
} from "../../apps/web/src/lib/captureEntry";

// SCRUM-384 / AG-12 / KG-UX-001/002/003/010: Erzähl-Einstieg als Standardweg, Formular als
// Expertenpfad, Erstnutzer-Führung pro Browser. DOM-freier Helfer — hier ohne DOM getestet.
function fakeStore(initial: Record<string, string> = {}): KeyValueStore & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? (data[k] as string) : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe("SCRUM-384: captureEntry", () => {
  it("Erzähl-Modi enthalten NICHT das Formular; nichts geht verloren", () => {
    expect(NARRATE_MODES).not.toContain(EXPERT_MODE);
    // Alle Modi bleiben erhalten: Erzähl-Modi + Expertenpfad = alle bekannten Modi.
    expect(new Set([...NARRATE_MODES, EXPERT_MODE])).toEqual(new Set(CAPTURE_MODES));
    // Der Standardweg beginnt mit Freitext (ruhigster Einstieg).
    expect(NARRATE_MODES[0]).toBe("freitext");
  });

  it("isExpertMode erkennt genau das Formular", () => {
    expect(isExpertMode("formular")).toBe(true);
    expect(isExpertMode("freitext")).toBe(false);
    expect(isExpertMode("diktat")).toBe(false);
    expect(isExpertMode("interview")).toBe(false);
  });

  it("Erstbesuch → firstRun true; nach markCaptureIntroSeen → false", () => {
    const store = fakeStore();
    expect(isCaptureFirstRun(store)).toBe(true);
    markCaptureIntroSeen(store);
    expect(store.data[CAPTURE_INTRO_SEEN_KEY]).toBe("1");
    expect(isCaptureFirstRun(store)).toBe(false);
  });

  it("defensiv: fehlender/kaputter Storage kippt nie die Seite", () => {
    expect(isCaptureFirstRun(null)).toBe(true);
    expect(isCaptureFirstRun(undefined)).toBe(true);
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("quota");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(isCaptureFirstRun(broken)).toBe(true);
    expect(() => markCaptureIntroSeen(broken)).not.toThrow();
    expect(() => markCaptureIntroSeen(null)).not.toThrow();
  });

  it("Copy ist DE und EN vorhanden (keine leeren Keys)", () => {
    for (const key of Object.values(CAPTURE_ENTRY_TEXT)) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("Ehrlichkeit: Expertenpfad verspricht nichts Automatisches, Rückweg bleibt", () => {
    const deActive = String(i18n.getResource("de", "translation", CAPTURE_ENTRY_TEXT.expertActive));
    const enActive = String(i18n.getResource("en", "translation", CAPTURE_ENTRY_TEXT.expertActive));
    expect(deActive).toMatch(/nichts wird automatisch validiert/i);
    expect(enActive).toMatch(/nothing is validated automatically/i);
    const deHint = String(i18n.getResource("de", "translation", CAPTURE_ENTRY_TEXT.expertHint));
    const enHint = String(i18n.getResource("en", "translation", CAPTURE_ENTRY_TEXT.expertHint));
    expect(deHint).toMatch(/jederzeit/i);
    expect(enHint).toMatch(/any time/i);
  });
});
