// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung · DIE UMSETZUNGSDOKU HÄLT IHRE FUNDSTELLEN.
// ================================================================================================
//
//   U1  Jede Kürzel-Aktion steht mit Fundstelle und Voraussetzung in `UMSETZUNG.md`; die genannten
//       Dateien existieren und tragen die genannten Anker (K17).
//   U2  Server und Oberfläche kennen dieselben Aktionen in derselben Reihenfolge (K17).
//   U3  Option 1 ist festgehalten: innerhalb Klarwerks, systemweit nur vorgemerkt; ab Werk unbelegt;
//       nicht angebotene Funktionen sind mit Grund benannt (K10, K17, K18).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KLARA_KUERZEL_AKTIONEN as CLIENT } from "../../apps/web/src/api/assistenzTastenkuerzel";
import {
  KLARA_KUERZEL_AKTIONEN as SERVER,
  STANDARD_BELEGUNG,
} from "../../services/app/src/assistenz-tastenkuerzel";
import { repoPfad } from "../support/repoPfad";

const doku = readFileSync(repoPfad("docs/klara-setup-shortcuts/UMSETZUNG.md"), "utf8");
const quelle = (relativ: string): string => readFileSync(repoPfad(relativ), "utf8");

describe("U1 · jede Aktion mit Fundstelle und Voraussetzung", () => {
  const abschnitt = doku.slice(doku.indexOf("## 3."), doku.indexOf("## 4."));
  const zeilen = abschnitt.split("\n").filter((z) => z.startsWith("| ") && z.includes("(`"));

  for (const aktion of SERVER) {
    it(aktion, () => {
      const zeile = zeilen.find((z) => z.includes(`(\`${aktion}\`)`));
      expect(zeile, `${aktion} fehlt im Inventar`).toBeDefined();
      const pfad = /`(apps\/web\/src\/[^`]+)`/.exec(zeile ?? "")?.[1] ?? "";
      expect(existsSync(repoPfad(pfad)), `${aktion}: ${pfad}`).toBe(true);
      // Die Spalte „Voraussetzung“ ist ausgefüllt.
      const spalten = (zeile ?? "").split("|").map((s) => s.trim());
      expect(spalten[5]?.length ?? 0, `${aktion} ohne Voraussetzung`).toBeGreaterThan(0);
    });
  }

  it("die genannten Anker stehen im Code", () => {
    const sprache = quelle("apps/web/src/components/klara-vorschau/KlaraSprache.tsx");
    for (const anker of [
      'data-testid="klara-diktieren"',
      'data-testid="klara-auftrag-sprechen"',
      'data-testid="klara-aufnahme-stoppen"',
    ]) {
      expect(doku).toContain(anker);
      expect(sprache).toContain(anker);
    }
    expect(quelle("apps/web/src/components/klara-vorschau/vorlesen.ts")).toContain(
      "export function stoppeVorlesen",
    );
    expect(quelle("apps/web/src/components/fragen/FrageFeld.tsx")).toContain(
      'data-testid="ask-sprachaufnahme"',
    );
    // Jede ausführende Fläche hört auf den einen Ausführungsweg.
    expect(quelle("apps/web/src/components/klara-vorschau/KlaraVorschau.tsx")).toContain(
      "useKlaraAktion((aktion) => {",
    );
    expect(quelle("apps/web/src/components/KlaraAssistant.tsx")).toContain(
      'if (aktion !== "seitenhilfe") {',
    );
    // Genau einmal je Zweig der Hülle (schmal/breit schliessen sich aus) — ein Hörer zur Zeit.
    const huelle = quelle("apps/web/src/shell/AppShell.tsx");
    expect(huelle.match(/<KlaraKuerzelAusfuehrung \/>/g)).toHaveLength(2);
  });
});

describe("U2 · Server und Oberfläche kennen dieselben Aktionen", () => {
  it("gleiche Liste, gleiche Reihenfolge", () => {
    expect([...CLIENT]).toEqual([...SERVER]);
  });
});

describe("U3 · Option 1, Standard, nicht angebotene Funktionen", () => {
  it("innerhalb Klarwerks; systemweit nur vorgemerkt; ab Werk unbelegt", () => {
    expect(doku).toContain("innerhalb des aktiven Klarwerk-Fensters");
    expect(doku).toMatch(/vorgemerkt,\s+nicht gebaut/);
    expect(Object.values(STANDARD_BELEGUNG).every((b) => b === null)).toBe(true);
    const texte = quelle("apps/web/src/texte/klarasetup.ts");
    expect(texte).toContain("in Klarwerk, solange das Klarwerk-Fenster aktiv ist");
    expect(texte).toContain("das ist für später vorgemerkt");
  });

  it("nicht angebotene Funktionen sind mit Grund benannt", () => {
    expect(doku).toContain("**Ausdrücklich nicht als Klara-Kürzel angeboten, mit Grund:**");
    for (const funktion of ["Server-Verschriftlichung", "Klara in Word", "Systemweite Auslösung"]) {
      expect(doku, funktion).toContain(funktion);
    }
  });
});
