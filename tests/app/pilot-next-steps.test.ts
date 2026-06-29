import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { DEMO_PILOT_PATH } from "../../apps/web/src/lib/demoPilotPath";
import { PILOT_NEXT_STEPS, pilotNextSteps } from "../../apps/web/src/lib/pilotNextSteps";

// SCRUM-306: nach dem Demodaten-/Pilot-Start sichtbare Operator-Next-Steps in den Stage-1-Lauf —
// nur vorhandene Routen, keine automatische Navigation, kein Backend.
describe("SCRUM-306: pilotNextSteps", () => {
  it("liefert Start, Pilot-Checkliste und die demo-sichere Beispiel-Frage in fester Reihenfolge", () => {
    expect(pilotNextSteps()).toBe(PILOT_NEXT_STEPS);
    expect(PILOT_NEXT_STEPS.map((s) => s.id)).toEqual(["start", "checklist", "ask"]);
  });

  it("verweist auf vorhandene Routen (Start, Hilfe, Ask-Deep-Link aus dem Demo-Pilotpfad)", () => {
    const byId = Object.fromEntries(PILOT_NEXT_STEPS.map((s) => [s.id, s.to]));
    expect(byId.start).toBe("/start");
    expect(byId.checklist).toBe("/hilfe");
    // Ask-Schritt = derselbe vorbereitete Deep-Link wie Schritt 1 des Demo-Pilotpfads (kein Fake-Link).
    expect(byId.ask).toBe(DEMO_PILOT_PATH[0]?.to);
    expect(byId.ask?.startsWith("/fragen")).toBe(true);
  });

  it("nutzt stabile i18n-Keys, die DE und EN vorhanden sind", () => {
    const keys = [
      "pilot.next.title",
      "pilot.next.hint",
      ...PILOT_NEXT_STEPS.map((s) => s.labelKey),
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("bleibt ehrlich: Hinweis nennt Demodaten als Beispiele, nicht als produktiven Beweis", () => {
    expect(String(i18n.getResource("de", "translation", "pilot.next.hint"))).toMatch(/Beispiele/i);
    expect(String(i18n.getResource("en", "translation", "pilot.next.hint"))).toMatch(/examples/i);
  });
});
