import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { START_HELP_IDS, START_HELP_TOPICS, startHelp } from "../../apps/web/src/lib/startHelp";

const startSource = readFileSync(
  fileURLToPath(new URL("../../apps/web/src/pages/Start.tsx", import.meta.url)),
  "utf8",
);

// SCRUM-488 (Nullschulung): Der Start-Screen ist der erste Screen eines ungeschulten Testers und
// hatte 0 HelpTips. Getestet: zentrale Hilfe-Karte (Schema shelp.*), DE+EN-Texte, und dass die
// HelpTips an den Kern-Elementen (Kreis, Arbeitsübersicht, Dringlichkeits-Punkte, Kennzahlen) sitzen.
describe("SCRUM-488: ?-Hilfen auf dem Start-Screen", () => {
  it("hat eindeutige Themen und ein stabiles Schlüssel-Schema (shelp.*)", () => {
    expect(new Set(START_HELP_IDS).size).toBe(START_HELP_IDS.length);
    expect(START_HELP_TOPICS.length).toBe(START_HELP_IDS.length);
    const topic = startHelp("cycle");
    expect(topic.titleKey).toBe("shelp.cycle.title");
    expect(topic.bodyKey).toBe("shelp.cycle.body");
  });

  it("löst jeden Titel und Text in DE und EN auf — ausführlich, nicht als Alibi", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const topic of START_HELP_TOPICS) {
        const title = i18n.t(topic.titleKey);
        const body = i18n.t(topic.bodyKey);
        expect(title, `${lng}:${topic.titleKey}`).not.toBe(topic.titleKey);
        expect(body, `${lng}:${topic.bodyKey}`).not.toBe(topic.bodyKey);
        expect(title.length, `${lng}:${topic.titleKey}`).toBeGreaterThan(3);
        // Nullschulung: jede Hilfe erklärt Was/Wann/Was-nicht — das trägt nicht unter 120 Zeichen.
        expect(body.length, `${lng}:${topic.bodyKey}`).toBeGreaterThan(120);
      }
    }
  });

  it("deckt die genannten Kern-Elemente ab (Kreis, Arbeitsübersicht, Punkte, Kennzahlen)", () => {
    for (const id of ["cycle", "work", "severity", "kpis"] as const) {
      expect(START_HELP_IDS).toContain(id);
    }
  });

  it("Start.tsx bindet die HelpTips an genau diese Elemente (keine tote Hilfe-Karte)", () => {
    expect(startSource).toContain('import { type StartHelpId, startHelp } from "../lib/startHelp"');
    for (const id of START_HELP_IDS) {
      expect(startSource, `shelp("${id}") fehlt in Start.tsx`).toContain(`shelp("${id}")`);
    }
    // Die Dringlichkeits-Legende (Klartext) rendert die Stufen-Labels (Template start.severity.<sev>).
    expect(startSource).toContain("start.severity.");
  });
});
