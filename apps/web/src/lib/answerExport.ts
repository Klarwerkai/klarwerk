// SCRUM-430 (Pedi 03.07., VIP): eine beantwortete Frage inkl. Quellen als Markdown exportieren/
// teilen (Kopieren / Download / Druck-PDF). Reine, DOM-freie Formatierung — testbar ohne Browser.
// Die Quellen bleiben klar ausgewiesen (Status/Trust/Nutzbarkeit); nichts wird beschönigt.

export interface AnswerExportStep {
  description: string;
  snippet?: string | null;
}

export interface AnswerExportSource {
  title: string;
  statusLabel?: string;
  trust?: number;
  usabilityLabel?: string;
}

// Vom Aufrufer (übersetzt) gelieferte Abschnitts-Beschriftungen — hält die Funktion i18n-frei.
export interface AnswerExportLabels {
  answer: string;
  evidence: string;
  trust: string;
  steps: string;
  sources: string;
  // Fußnote; {{date}} wird durch das Erstelldatum (YYYY-MM-DD) ersetzt.
  footer: string;
}

export interface AnswerExportInput {
  question: string;
  answer: string;
  statusLabel: string;
  evidenceLabel: string;
  trust: number;
  steps: readonly AnswerExportStep[];
  sources: readonly AnswerExportSource[];
  generatedAt: string; // ISO-Zeitstempel
  labels: AnswerExportLabels;
}

function sourceLine(source: AnswerExportSource, trustLabel: string): string {
  const parts = [
    source.statusLabel,
    source.trust !== undefined ? `${trustLabel} ${source.trust}` : undefined,
    source.usabilityLabel,
  ].filter((p): p is string => Boolean(p?.trim()));
  const suffix = parts.length > 0 ? ` — ${parts.join(" · ")}` : "";
  return `- ${source.title.trim()}${suffix}`;
}

export function buildAnswerMarkdown(input: AnswerExportInput): string {
  const L = input.labels;
  const lines: string[] = [];
  lines.push(`# ${input.question.trim() || "—"}`);
  lines.push("");
  const meta = [
    input.statusLabel,
    `${L.evidence}: ${input.evidenceLabel}`,
    `${L.trust} ${input.trust}`,
  ].filter((p) => Boolean(p?.trim()));
  lines.push(`**${L.answer}** · ${meta.join(" · ")}`);
  lines.push("");
  lines.push(input.answer.trim());

  if (input.steps.length > 0) {
    lines.push("");
    lines.push(`## ${L.steps}`);
    for (const step of input.steps) {
      lines.push(`- ${step.description.trim()}`);
      if (step.snippet?.trim()) {
        lines.push(`  > ${step.snippet.trim()}`);
      }
    }
  }

  if (input.sources.length > 0) {
    lines.push("");
    lines.push(`## ${L.sources}`);
    for (const source of input.sources) {
      lines.push(sourceLine(source, L.trust));
    }
  }

  lines.push("");
  lines.push(`_${L.footer.replace("{{date}}", input.generatedAt.slice(0, 10))}_`);
  return lines.join("\n");
}

// Dateiname für den Markdown-Download — an das Muster von outputDoc angelehnt.
export function answerExportFilename(generatedAt: string): string {
  const date = generatedAt.slice(0, 10) || "antwort";
  return `klarwerk-antwort-${date}.md`;
}
