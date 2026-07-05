import { describe, expect, it } from "vitest";
import {
  type AnswerExportLabels,
  answerExportFilename,
  buildAnswerMarkdown,
} from "../../apps/web/src/lib/answerExport";

const labels: AnswerExportLabels = {
  answer: "Antwort",
  evidence: "Evidenz",
  trust: "Trust",
  steps: "Argumentationsschritte",
  sources: "Quellen",
  footer: "Quellengebunden · erstellt am {{date}}.",
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
    expect(md).toContain("- Firmenwagen-Farbregelung — Offen · Trust 33 · zu prüfen");
    // Datum in der Fußnote eingesetzt.
    expect(md).toContain("erstellt am 2026-07-05.");
  });

  it("lässt leere Schritte/Quellen weg und übersteht fehlende Felder", () => {
    const md = buildAnswerMarkdown({
      question: "  ",
      answer: "Kurz.",
      statusLabel: "Gesichert",
      evidenceLabel: "validiert",
      trust: 80,
      steps: [],
      sources: [{ title: "Nur Titel" }],
      generatedAt: "2026-07-05T00:00:00.000Z",
      labels,
    });
    expect(md).toContain("# —"); // leere Frage → Platzhalter
    expect(md).not.toContain("## Argumentationsschritte");
    expect(md).toContain("## Quellen");
    expect(md).toContain("- Nur Titel"); // ohne Zusatz, kein " — "
    expect(md).not.toContain("- Nur Titel —");
  });

  it("Dateiname trägt das Erstelldatum", () => {
    expect(answerExportFilename("2026-07-05T08:00:00.000Z")).toBe("klarwerk-antwort-2026-07-05.md");
    expect(answerExportFilename("")).toBe("klarwerk-antwort-antwort.md");
  });
});
