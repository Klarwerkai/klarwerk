import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import {
  PILOT_OBSERVATIONS,
  pilotObservationGuide,
} from "../../apps/web/src/lib/pilotObservationGuide";

// SCRUM-307: beobachtete Pilot-Reibungen werden auf bestehende Knowledge-OS-Flows gemappt — ohne
// Backend, ohne Speicherung. Reine UX-Notiz bekommt bewusst KEINEN Produktlink.
describe("SCRUM-307: pilotObservationGuide", () => {
  it("deckt alle erwarteten Kategorien in fester Reihenfolge ab", () => {
    expect(pilotObservationGuide()).toBe(PILOT_OBSERVATIONS);
    expect(PILOT_OBSERVATIONS.map((o) => o.id)).toEqual([
      "missing",
      "unverified",
      "outdated",
      "source",
      "uxnote",
    ]);
  });

  it("mappt jede Flow-Kategorie auf die richtige vorhandene Route", () => {
    const byId = Object.fromEntries(PILOT_OBSERVATIONS.map((o) => [o.id, o.to]));
    expect(byId.missing).toBe("/risiko");
    expect(byId.unverified).toBe("/validierung");
    expect(byId.outdated).toBe("/lebenszyklus");
    expect(byId.source).toBe("/bibliothek");
    // Quelle/Trust-Einstieg über /bibliothek, NICHT über eine Fake-KO-ID.
    expect(byId.source).not.toMatch(/\/wissen\//);
  });

  it("Routen (außer UX-Notiz) sind vorhandene App-Routen (gedeckt durch Help-Topics)", () => {
    const knownRoutes = new Set(HELP_TOPICS.map((tp) => tp.to));
    for (const obs of PILOT_OBSERVATIONS) {
      if (obs.to !== null) {
        expect(knownRoutes.has(obs.to)).toBe(true);
      }
    }
  });

  it("die reine UX-/Pilotnotiz hat bewusst KEINEN Produktlink und keine Fake-Speicherung", () => {
    const uxnote = PILOT_OBSERVATIONS.find((o) => o.id === "uxnote");
    expect(uxnote?.to).toBeNull();
    // Mapping-Text macht ehrlich klar: organisatorisch, nicht im Produkt gespeichert.
    expect(String(i18n.getResource("de", "translation", "pilot.obs.uxnote.map"))).toMatch(
      /nicht im Produkt gespeichert/i,
    );
    expect(String(i18n.getResource("en", "translation", "pilot.obs.uxnote.map"))).toMatch(
      /not stored in the product/i,
    );
  });

  it("alle i18n-Keys (Titel/Untertitel/Labels/Map/Helfer) sind DE und EN auflösbar", () => {
    const keys = [
      "pilot.obs.title",
      "pilot.obs.subtitle",
      "pilot.obs.mapLabel",
      "pilot.obs.openFlow",
      ...PILOT_OBSERVATIONS.flatMap((o) => [o.labelKey, o.mapKey]),
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });
});
