// produkt:wettbewerb:20261003:lernplattform — K1/K6/K8: DIE ANLEITUNG SAGT, WAS DAS PRODUKT TUT.
//
// Die Anleitung (docs/lernplattform-scorm.md) ist der technische Lieferumfang. Dieser Test hält sie
// an den Konstanten des Produkts fest — eine Anleitung, die eine andere Version oder ein anderes LMS
// nennt als der Code, wäre schlechter als keine — und prüft, dass sie Inhaltsübergabe, Lernabschluss
// und den (nicht vorhandenen) Rückkanal als drei getrennte Abschnitte führt.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCORM_FORMAT } from "../../services/output";
import { SCO_CSS, SCO_JS } from "../../services/output/src/scorm-laufzeit";
import { repoPfad } from "../support/repoPfad";

const ANLEITUNG = readFileSync(repoPfad("docs/lernplattform-scorm.md"), "utf8");

function abschnitt(titel: string): string {
  const start = ANLEITUNG.indexOf(`### ${titel}`);
  expect(start, titel).toBeGreaterThanOrEqual(0);
  const rest = ANLEITUNG.slice(start + 4);
  const ende = rest.search(/\n##+ /);
  return ende < 0 ? rest : rest.slice(0, ende);
}

describe("Anleitung zur Lernplattform-Übergabe", () => {
  it("K1 · nennt Format, Standardversion, Referenz-LMS und Paketart wie der Code", () => {
    expect(ANLEITUNG).toContain(SCORM_FORMAT.paketart);
    expect(ANLEITUNG).toContain("<schemaversion>1.2</schemaversion>");
    expect(ANLEITUNG).toContain("Moodle 4.5 LTS");
    expect(SCORM_FORMAT.referenzLms).toContain("Moodle 4.5 LTS");
    expect(ANLEITUNG).toContain("keine universelle Kompatibilitätszusage");
    expect(ANLEITUNG).toContain("## Abnahme am Referenzsystem (offen)");
  });

  it("K6 · dokumentiert die Netzabhängigkeit so, wie das Paket sie erzwingt", () => {
    expect(ANLEITUNG).toContain(
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:",
    );
    // Die Paketlaufzeit spricht mit keinem Server (dieselbe Prüfung wie paket.test.ts, hier gegen
    // die Quelle, aus der jedes Paket gebaut wird).
    expect(SCO_JS).not.toMatch(/https?:\/\/|XMLHttpRequest|fetch\(|sendBeacon|WebSocket/);
    expect(SCO_CSS).not.toMatch(/https?:\/\/|@import|url\(/);
  });

  it("K8 · trennt Inhaltsübergabe, Lernabschluss im LMS und Rückkanal", () => {
    const uebergabe = abschnitt("1. Inhaltsübergabe (Klarwerk)");
    const abschluss = abschnitt("2. Lernabschluss in der Lernplattform (Paket ↔ LMS)");
    const rueckkanal = abschnitt("3. Rückkanal nach Klarwerk");

    expect(uebergabe).toContain("noch **nicht** in der Lernplattform veröffentlicht");
    expect(uebergabe).toContain("output.lms-export");
    expect(abschluss).toContain("`completed` nur, wenn jede Lerneinheit angezeigt wurde");
    expect(abschluss).toContain("`incomplete`");
    expect(rueckkanal).toContain("Es gibt **keinen** Rückkanal");
    // Der Abschluss gehört dem LMS, nicht Klarwerk — die Übergabe-Erklärung behauptet keinen.
    expect(uebergabe).not.toMatch(/abgeschlossen|completed/);
    expect(SCORM_FORMAT.rueckkanal).toContain("keiner");
  });
});
