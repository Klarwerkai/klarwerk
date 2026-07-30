// ================================================================================================
// AUFTRAG-mega61 BLOCK A — WO DIE GEMOUNTETEN TORWÄCHTER-TESTS WOHNEN, UND WARUM DORT.
// ================================================================================================
//
// DIE EIGENTLICHEN FÄLLE stehen in `apps/web/src/legal/mega61-rechtsseiten.test.tsx`. Hier steht
// nur der Wächter, der sie dort HÄLT — und der Grund dafür, weil er sonst beim nächsten Aufräumen
// verlorengeht:
//
// `tsconfig.tests-tsx.json` typprüft alle `.tsx` unter `tests/**` in einem EIGENEN Programm mit den
// Einstellungen und Typen der WURZEL. Für kleine, gemountete Bausteine reicht das. Sobald ein Test
// dort aber `apps/web/src/App` importiert, zieht er über `routes.tsx` die GANZE Anwendung in dieses
// Programm — und dann prüft der Wurzel-Typprüfer Web-Dateien mit Wurzel-Einstellungen. Ergebnis
// gemessen, nicht vermutet: acht Fehler in fünf Dateien (fehlendes `vite/client` für
// `import.meta.env`, `override` an der Fehlergrenze, `exactOptionalPropertyTypes` gegen die
// i18next-Typen), von denen KEINER ein echter Defekt ist. Der Typprüfer der Anwendung
// (`apps/web/tsconfig.json`) ist über dieselben Dateien grün — er hat DOM, jsx, `vite/client` und
// die passenden @types.
//
// Deshalb wohnen Tests, die den Torwächter oder die Anwendungshülle MONTIEREN, unter
// `apps/web/src/**`. Der Testlauf sieht sie dort genauso (vitest.config.ts schließt
// `apps/web/src/**/*.test.{ts,tsx}` seit mega59 ein), und der richtige Typprüfer auch.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");

function dateien(verzeichnis: string, endung: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis))) {
    if (eintrag === "node_modules" || eintrag.startsWith(".")) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag);
    if (statSync(join(WURZEL, relativ)).isDirectory()) {
      gefunden.push(...dateien(relativ, endung));
    } else if (relativ.endsWith(endung)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

describe("mega61 A · die gemounteten Torwächter-Tests liegen im Web-Typprüfpfad", () => {
  it("sie sind da, wo der Typprüfer der Anwendung sie sieht", () => {
    const erwartet = [
      join("apps", "web", "src", "legal", "mega61-rechtsseiten.test.tsx"),
      join("apps", "web", "src", "legal", "mega61-hinweisbanner.test.tsx"),
    ];
    const vorhanden = dateien(join("apps", "web", "src"), ".test.tsx");
    for (const datei of erwartet) {
      expect(vorhanden, `${datei} fehlt — wurde er zurückverschoben?`).toContain(datei);
    }
  });

  it("KEIN Test unter tests/** zieht die ganze Anwendung in den Wurzel-Typprüfer", () => {
    // Die Regel über die Bauform, nicht über die heutigen Dateien: Wer künftig `App` (oder den
    // Router, der alle Seiten einsammelt) aus einem `tests/**`-Test importiert, wird hier rot —
    // und zwar mit dem Grund, statt später mit acht rätselhaften Typfehlern.
    const verstoesse: string[] = [];
    const selbst = join("tests", "legal", "mega61-rechtsseiten.test.tsx");
    for (const datei of dateien("tests", ".tsx")) {
      // Diese Datei nennt die verbotenen Pfade selbst — sie ist der Wächter, nicht der Fall.
      if (datei === selbst) {
        continue;
      }
      const inhalt = readFileSync(join(WURZEL, datei), "utf8");
      // GEMESSEN, nicht geraten: `apps/web/src/routes` allein ist heute unbedenklich — ein Test
      // importiert es (tests/app/stage2-gate-mounted.test.tsx) und das Programm bleibt grün.
      // `apps/web/src/App` ist es nicht: es zieht zusätzlich den Anwendungsrahmen mit
      // `import.meta.env`, der Fehlergrenze und den Anmeldeschirmen herein, und genau dort brechen
      // die Wurzel-Einstellungen. Die Regel bleibt deshalb auf das eingeschränkt, was WIRKLICH
      // bricht; würde sie mehr behaupten, wäre sie eine Vermutung mit Testfarbe.
      if (inhalt.includes("apps/web/src/App")) {
        verstoesse.push(
          `${datei} importiert apps/web/src/App — solche Tests gehören nach apps/web/src/**`,
        );
      }
    }
    expect(verstoesse).toEqual([]);
  });
});
