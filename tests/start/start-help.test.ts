import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { START_HELP_IDS, START_HELP_TOPICS, startHelp } from "../../apps/web/src/lib/startHelp";

// JOB 3064 H5 UMGEZOGEN, nicht gelockert: die drei ?-Hilfen des Start-Screens standen als drei
// verstreute Fragezeichen auf der Fläche. Seit dem Umbau nach dem Zielbild `Main.dc.html` liegen
// sie gebündelt hinter „…" → „Hilfe zu dieser Seite" — also in `components/start/StartPanel.tsx`.
// Die ZUSAGE ist unverändert: keine tote Hilfe-Karte, jedes Thema wird wirklich gerendert. Nur die
// Bauform hat sich geändert (eine Liste statt drei `shelp("<id>")`-Aufrufe), und deshalb misst der
// Fall unten die Auflösung über `START_HELP_TOPICS` statt drei Aufrufstellen.
const panelSource = readFileSync(
  fileURLToPath(new URL("../../apps/web/src/components/start/StartPanel.tsx", import.meta.url)),
  "utf8",
);
const kartenSource = readFileSync(
  fileURLToPath(new URL("../../apps/web/src/components/start/StartKarten.tsx", import.meta.url)),
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

  // AUFTRAG-mega38 BLOCK G2: „kpis" ist raus — der Kennzahlen-Block, den diese Hilfe erklärte, ist
  // ersatzlos entfallen (seine Zahlen standen schon im Wissenskapital darüber).
  it("deckt die genannten Kern-Elemente ab (Kreis, Arbeitsübersicht, Punkte)", () => {
    for (const id of ["cycle", "work", "severity"] as const) {
      expect(START_HELP_IDS).toContain(id);
    }
  });

  it("das Menü-Blatt rendert JEDES Thema (keine tote Hilfe-Karte)", () => {
    // Die Bindung läuft über die produktive Tabelle selbst — eine neue `START_HELP_ID` erscheint
    // damit ohne Nacharbeit, und eine gestrichene kann nicht als toter Schlüssel zurückbleiben.
    expect(panelSource).toContain('import { START_HELP_TOPICS } from "../../lib/startHelp"');
    expect(panelSource).toContain("START_HELP_TOPICS.map");
    expect(panelSource).toContain("topic.titleKey");
    expect(panelSource).toContain("topic.bodyKey");
    // Kalibrierung: die Tabelle ist nicht leer — sonst wäre die Zusage über eine leere Menge.
    expect(START_HELP_IDS.length).toBeGreaterThan(2);
    // Die Dringlichkeits-Legende in Worten ist mit der Arbeitsliste entfallen; die drei Stufen
    // stehen jetzt als farbige Punkte an den Zeilen von „FÜR DICH" (Zielbild Z.48/54/60), und
    // `shelp.severity.body` erklärt sie im Blatt. Gemessen wird deshalb der Punkt, nicht der Text.
    for (const ton of ["trust-crit-fill", "trust-warn-fill", "trust-pos-fill"]) {
      expect(kartenSource, `Zustandspunkt ${ton} fehlt`).toContain(ton);
    }
  });
});
