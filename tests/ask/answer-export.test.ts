import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AnswerExportLabels,
  answerExportFilename,
  buildAnswerMarkdown,
} from "../../apps/web/src/lib/answerExport";

const WURZEL = join(__dirname, "..", "..");

const labels: AnswerExportLabels = {
  answer: "Antwort",
  evidence: "Evidenz",
  trust: "Trust",
  steps: "Argumentationsschritte",
  sources: "Quellen",
  footer: "Quellengebunden · erstellt am {{date}}.",
  // AUFTRAG-mega62 Block E: die KI-Kennzeichnung ist PFLICHTFELD und keine Option — deshalb steht
  // sie hier auch in der Attrappe. Ein optionales Feld hätte genau die Lücke offen gelassen, um
  // die es geht: einen Export ohne Kennzeichnung, der trotzdem baut.
  aiNotice:
    "Von künstlicher Intelligenz erzeugt (KLARWERK, Frage beantwortet, 2026-07-27). Inhaltlich zu prüfen.",
};

describe("SCRUM-430: buildAnswerMarkdown", () => {
  it("formatiert Frage, Antwort, Schritte und Quellen inkl. Status/Trust als Markdown", () => {
    const md = buildAnswerMarkdown({
      question: "Welche Farbe haben die Firmenwagen?",
      answer: "Laut Quelle werden alle Firmenwagen in Blau bestellt.",
      statusLabel: "Ungeprüft",
      evidenceLabel: "quellengebunden",
      trust: 33,
      steps: [{ description: "Quelle: Firmenwagen-Farbregelung", snippet: "Alle in Blau." }],
      sources: [
        {
          sourceId: "ko-firmenwagen-farbregelung",
          title: "Firmenwagen-Farbregelung",
          statusLabel: "Offen",
          trust: 33,
          usabilityLabel: "zu prüfen",
        },
      ],
      generatedAt: "2026-07-05T08:00:00.000Z",
      labels,
    });

    expect(md).toContain("# Welche Farbe haben die Firmenwagen?");
    expect(md).toContain("**Antwort** · Ungeprüft · Evidenz: quellengebunden · Trust 33");
    expect(md).toContain("Laut Quelle werden alle Firmenwagen in Blau bestellt.");
    expect(md).toContain("## Argumentationsschritte");
    expect(md).toContain("> Alle in Blau.");
    expect(md).toContain("## Quellen");
    // Quelle klar ausgewiesen mit Status/Trust/Nutzbarkeit.
    // JOB 502: diese Zusicherung bleibt BUCHSTABENGLEICH stehen. Sie ist der Beleg, dass die neue
    // Kennung nichts verdrängt — Titel, Status, Trust und Nutzbarkeit stehen unverändert in
    // unveränderter Reihenfolge. Die Kennung selbst wird im eigenen Fall darunter geprüft.
    expect(md).toContain("- Firmenwagen-Farbregelung — Offen · Trust 33 · zu prüfen");
    // Datum in der Fußnote eingesetzt.
    expect(md).toContain("erstellt am 2026-07-05.");
  });

  // ============================================================================================
  // JOB 502 (Klara-Export, Quellidentität) — ZWEI GLEICH BETITELTE QUELLEN SIND ZWEI QUELLEN.
  // ============================================================================================
  // Bis hierher trug die exportierte Quellzeile nur Titel, Status, Trust und Nutzbarkeit. Zwei
  // Fassungen desselben Dokuments — gleicher Titel, gleicher Status, gleicher Wert — wurden damit
  // zu zwei buchstabengleichen Zeilen. Wer den Export später liest, kann die Fundstelle dann nicht
  // mehr zurückverfolgen: er sieht zweimal dasselbe und weiß nicht, welche Fassung gemeint war.
  // Die stabile, bereits vorhandene Quellen-ID reist deshalb MIT. Sie wird nicht erfunden.
  it("unterscheidet zwei gleich betitelte Quellen an ihrer stabilen Quellen-ID", () => {
    const md = buildAnswerMarkdown({
      question: "Welcher Lieferweg gilt?",
      answer: "Es liegen zwei Fassungen mit identischem Titel vor.",
      statusLabel: "Ungeprüft",
      evidenceLabel: "quellengebunden",
      trust: 50,
      steps: [],
      sources: [
        {
          sourceId: "ko-lieferweg-nord-2024",
          title: "Lieferweg Nord",
          statusLabel: "Offen",
          trust: 50,
          usabilityLabel: "zu prüfen",
        },
        {
          sourceId: "ko-lieferweg-nord-2019",
          title: "Lieferweg Nord",
          statusLabel: "Offen",
          trust: 50,
          usabilityLabel: "zu prüfen",
        },
      ],
      generatedAt: "2026-08-06T10:00:00.000Z",
      labels,
    });

    const sourceLines = md.split("\n").filter((line) => line.startsWith("- Lieferweg Nord"));
    expect(sourceLines).toHaveLength(2);
    // Der Kern: zwei Quellen, zwei unterscheidbare Zeilen.
    expect(sourceLines[0]).not.toBe(sourceLines[1]);
    // Und die Unterscheidung ist die ECHTE Kennung, nicht eine erfundene Nummerierung.
    expect(md).toContain("ko-lieferweg-nord-2024");
    expect(md).toContain("ko-lieferweg-nord-2019");
    // Titel, Status, Trust und Nutzbarkeit bleiben dabei vollständig erhalten.
    expect(md).toContain("- Lieferweg Nord — Offen · Trust 50 · zu prüfen");
  });

  it("lässt leere Schritte/Quellen weg und übersteht fehlende Felder", () => {
    const md = buildAnswerMarkdown({
      question: "  ",
      answer: "Kurz.",
      statusLabel: "Gesichert",
      evidenceLabel: "validiert",
      trust: 80,
      steps: [],
      sources: [{ sourceId: "ko-nur-titel", title: "Nur Titel" }],
      generatedAt: "2026-07-05T00:00:00.000Z",
      labels,
    });
    expect(md).toContain("# —"); // leere Frage → Platzhalter
    expect(md).not.toContain("## Argumentationsschritte");
    expect(md).toContain("## Quellen");
    expect(md).toContain("- Nur Titel");
    // JOB 502: die alte Fassung prüfte hier `not.toContain("- Nur Titel —")`. Seit die Kennung
    // Pflicht ist, trägt JEDE Zeile einen Zusatz — der Gedankenstrich allein sagt also nichts mehr.
    // Die Aussage dahinter bleibt aber genau dieselbe und wird jetzt direkt geprüft: fehlende
    // Angaben werden NICHT erfunden, an der Zeile steht kein einziges zusätzliches Feld.
    const nurTitel = md.split("\n").find((line) => line.startsWith("- Nur Titel"));
    expect(nurTitel).not.toContain("·");
  });

  // KALIBRIERUNG zu JOB 502: der Vertrag kann die Kennung nur TRAGEN — füllen muss sie die
  // Fragenfläche. Genau daran ist es bisher gescheitert: `Ask.tsx` hatte `s.id` in der Hand
  // (es verlinkt damit auf `/wissen/${s.id}`) und ließ sie beim Bauen des Exports liegen.
  it("die Fragenfläche reicht die vorhandene Quellen-ID wirklich durch — ohne Ersatzwert", () => {
    const vertrag = readFileSync(join(WURZEL, "apps/web/src/lib/answerExport.ts"), "utf8");
    // Pflichtfeld, nicht Option — ein optionales Feld ließe den Export ohne Rückverfolgbarkeit zu.
    expect(vertrag).toContain("sourceId: string;");
    expect(vertrag).not.toContain("sourceId?: string");

    const ask = readFileSync(join(WURZEL, "apps/web/src/pages/Ask.tsx"), "utf8");
    expect(ask).toContain("sourceId: s.id,");
    // Kein `??`-Ersatzwert an dieser Stelle: eine erfundene Kennung wäre schlimmer als keine.
    expect(ask).not.toContain("sourceId: s.id ??");
  });

  it("Dateiname trägt das Erstelldatum", () => {
    expect(answerExportFilename("2026-07-05T08:00:00.000Z")).toBe("klarwerk-antwort-2026-07-05.md");
    expect(answerExportFilename("")).toBe("klarwerk-antwort-antwort.md");
  });
});
