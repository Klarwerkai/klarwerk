// ================================================================================================
// AUFTRAG-mega34 BLOCK F — ROHWERTE UND FALSCHE FORMEN IN DEN FÜNF ANSICHTEN, DIE SIE SIEHT.
// ================================================================================================
//
// Die externe Auswertung nannte UUIDs, `best_practice`, `note` und die Form „1 Experten" als
// Reifebruch. Für eine Testerin mit journalistischem Hintergrund, deren Auftrag „versteht man das?"
// lautet, ist das der Eindruck einer internen Fachanwendung statt eines Produkts.
//
// GEGENSTAND SIND NUR DIE FÜNF ANSICHTEN IHRER SIEBEN AUFGABEN: Start · Erfassen · Fragen ·
// Bibliothek · KO-Detail. Alles andere ist hier ausdrücklich nicht Gegenstand.
//
// Nachgeprüft und SAUBER (deshalb hier nicht behandelt): `best_practice` und die übrigen
// Wissensarten laufen überall durch `KnowledgeTypeTag` → `t("ktype.<typ>")`, in DE/EN/NL
// vollständig. Die genannten Rohwerte erscheinen dort nicht.
//
// Was BLEIBT, sind vier Stellen — ein roher Enum-Wert und drei falsche Einzahl-Formen.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

const SPRACHEN = ["de", "en", "nl"] as const;

// Die i18next-v4-Pluralisierung greift NUR über die Variable `count`. Ein Schlüssel mit `{{n}}`
// bekommt niemals eine Einzahl-Form, egal wie viele `_one`-Varianten daneben stehen.
// AUFTRAG-mega38 BLOCK J4: `capture.resumeCollapsedHint` stand hier und ist ERSATZLOS entfernt —
// nicht weil die Form falsch wurde, sondern weil der ganze Satz weg ist (er erklärte der Leserin
// unsere Layoutentscheidung). Ein Plural-Pin auf einen Schlüssel, den es nicht mehr gibt, wäre ein
// Test, der nichts mehr bewacht.
const PLURAL_KEYS = [
  "ko.ovSources", // KO-Detail — Übersichtszeile
  "ko.ovAttachments", // KO-Detail — Übersichtszeile
  "lib.facet.showResults", // Bibliothek — Filter-Knopf
] as const;

describe("mega34 F · korrekte Formen bei 0, 1 und mehreren", () => {
  for (const lng of SPRACHEN) {
    for (const key of PLURAL_KEYS) {
      it(`${lng} · ${key} unterscheidet Einzahl und Mehrzahl`, async () => {
        await i18n.changeLanguage(lng);
        const eins = i18n.t(key, { count: 1 });
        const mehrere = i18n.t(key, { count: 3 });
        const keine = i18n.t(key, { count: 0 });

        // Der Schlüssel ist überhaupt übersetzt (kein durchgereichter Rohschlüssel).
        expect(eins, `${key} fehlt in ${lng}`).not.toBe(key);
        // Die Zahl steht drin — die Form ist nicht durch Weglassen „gelöst".
        expect(eins).toContain("1");
        expect(mehrere).toContain("3");
        expect(keine).toContain("0");
        // Und Einzahl und Mehrzahl lauten wirklich verschieden.
        expect(eins.replace(/\d+/g, "#"), `${key} (${lng}) sagt bei 1 dasselbe wie bei 3`).not.toBe(
          mehrere.replace(/\d+/g, "#"),
        );
        // Der 0-Fall folgt der Mehrzahl (so ist es in allen drei Sprachen richtig).
        expect(keine.replace(/\d+/g, "#")).toBe(mehrere.replace(/\d+/g, "#"));
      });
    }
  }

  it("die alte {{n}}-Variable ist weg — sonst pluralisiert i18next gar nicht", async () => {
    await i18n.changeLanguage("de");
    for (const key of PLURAL_KEYS) {
      // Mit `count` darf keine unaufgelöste Variable übrig bleiben.
      expect(i18n.t(key, { count: 1 }), `${key} hat noch eine offene Variable`).not.toContain("{{");
    }
  });
});

describe("mega34 F · kein technischer Rohwert als primäre Nutzerbotschaft", () => {
  it("die Startseite zeigt den Status übersetzt, nicht als DB-Wert", () => {
    // Die Live-Wand auf der Startseite rendert `{s.status}` roh — „VALIDIERT" / „OFFEN" als
    // Enum-Wert, bei englischer und niederländischer Oberfläche sogar auf Deutsch. Überall sonst
    // im Produkt macht das `StatusPill` über `t("status.<wert>")`; hier wurde es als einzige
    // Stelle umgangen. Gepinnt am Quelltext, weil die Karte einen Netz-Abruf braucht.
    // JOB 3064 H5 UMGEZOGEN, nicht gelockert: die Live-Wand steht seit dem Umbau der Startseite
    // nicht mehr auf der Fläche, sondern hinter „…" → „Gerade" — also in
    // `components/start/StartPanel.tsx`. Die ZUSAGE ist unverändert dieselbe (kein roher DB-Wert,
    // die übersetzte `StatusPill`); nur die Datei, die sie trägt, ist eine andere. Gemessen wird
    // weiter am Quelltext, weil die Karte einen Netz-Abruf braucht.
    const src = require("node:fs").readFileSync(
      "apps/web/src/components/start/StartPanel.tsx",
      "utf8",
    );
    expect(src).not.toMatch(/>\s*\{s\.status\}\s*</);
    expect(src).toContain("StatusPill");
    // Und die Startseite selbst rendert die Live-Wand wirklich nicht mehr — sonst stünde die
    // alte Fassung daneben und dieser Pin bewiese nichts.
    const start = require("node:fs").readFileSync("apps/web/src/pages/Start.tsx", "utf8");
    expect(start).not.toContain("livewall");
  });

  it("die Status-Übersetzungen, die sie dafür braucht, gibt es in allen drei Sprachen", async () => {
    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      for (const status of ["offen", "validiert"]) {
        expect(i18n.t(`status.${status}`), `status.${status} fehlt in ${lng}`).not.toBe(
          `status.${status}`,
        );
      }
    }
  });
});
