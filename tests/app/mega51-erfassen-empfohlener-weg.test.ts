// ================================================================================================
// AUFTRAG-mega51 BLOCK B — EINE PRIMÄRE HANDLUNG BEIM ERFASSEN, OHNE VERLUST.
// ================================================================================================
// Fünf gleichrangige Angebote sind kein Angebot. Genau EIN Erzählweg ist ab jetzt der empfohlene
// und als solcher sichtbar; die übrigen bleiben vollständig erreichbar, nur ruhiger gezeichnet.
//
// Der Test pinnt DIE BINDUNG, nicht den Namen: er schreibt nirgends „freitext" als Erwartung an
// die Empfehlung, sondern verlangt, dass die Empfehlung der ERSTE Eintrag von `NARRATE_MODES` ist
// — die Stelle, an der der Bestand den Standardweg seit jeher führt („Standardweg zuerst"). Ein
// zweites Literal hier wäre derselbe Fehler, den mega39 an der Rollenlogik abgeräumt hat.
//
// Und er pinnt B2: keine Fähigkeit verschwindet. Die Menge der Erzählwege und der Expertenpfad
// bleiben unverändert; die Ansicht ruft für JEDEN von ihnen weiterhin `switchMode` auf.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAPTURE_ENTRY_TEXT,
  CAPTURE_MODES,
  EXPERT_MODE,
  NARRATE_MODES,
  RECOMMENDED_NARRATE_MODE,
  isRecommendedMode,
} from "../../apps/web/src/lib/captureEntry";

const CAPTURE_TSX = join(__dirname, "../../apps/web/src/pages/Capture.tsx");
const I18N_TS = join(__dirname, "../../apps/web/src/i18n.ts");

describe("mega51 B · beim Erfassen führt ein empfohlener Weg, ohne dass einer wegfällt", () => {
  it("B1: die Empfehlung ist ABGELEITET — der Standardweg an erster Stelle, kein zweites Literal", () => {
    expect(RECOMMENDED_NARRATE_MODE).toBe(NARRATE_MODES[0]);
    expect(NARRATE_MODES).toContain(RECOMMENDED_NARRATE_MODE);
    // Der Expertenpfad ist NICHT der empfohlene Weg — er bleibt der bewusste Nebenweg.
    expect(RECOMMENDED_NARRATE_MODE).not.toBe(EXPERT_MODE);
  });

  it("B1: genau EINER der Erzählwege ist der empfohlene", () => {
    expect(NARRATE_MODES.filter(isRecommendedMode)).toHaveLength(1);
  });

  it("B2: keine Fähigkeit verschwindet — Wege und Expertenpfad sind unverändert", () => {
    expect([...CAPTURE_MODES].sort()).toEqual([
      "datei",
      "diktat",
      "formular",
      "freitext",
      "interview",
    ]);
    expect([...NARRATE_MODES]).toEqual(["freitext", "diktat", "interview", "datei"]);
    expect(EXPERT_MODE).toBe("formular");
  });

  it("B2: die Ansicht rendert weiterhin ALLE Erzählwege über dieselbe Umschaltung", () => {
    const quelle = readFileSync(CAPTURE_TSX, "utf8");
    // Die Leiste läuft über NARRATE_MODES.map — keine handverlesene Teilmenge.
    expect(quelle).toContain("NARRATE_MODES.map((m) => (");
    expect(quelle).toContain("onClick={() => switchMode(m)}");
    // Und der Expertenpfad hängt weiter an seinem eigenen Umschalter.
    expect(quelle).toContain('switchMode(isExpertMode(mode) ? "freitext" : EXPERT_MODE)');
  });

  it("die Kennzeichnung ist in DE, EN und NL vorhanden", () => {
    const i18n = readFileSync(I18N_TS, "utf8");
    expect(CAPTURE_ENTRY_TEXT.recommendedBadge).toBe("capture.entry.recommendedBadge");
    const treffer = i18n.match(/"capture\.entry\.recommendedBadge":/g) ?? [];
    expect(treffer).toHaveLength(3);
  });
});
