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
  /**
   * AUFTRAG-mega62 Block E (Register F29): das Kennzeichen „trägt" bzw. „angesehen", schon
   * ÜBERSETZT vom Aufrufer — dieselbe Bewegung wie bei `statusLabel` (hält das Modul i18n-frei).
   *
   * Bis mega61 wurde beim Export genau dieses Kennzeichen WEGGEWORFEN (Ask.tsx baute die
   * Exportquellen aus `answerSources` und ließ `carrying` liegen). Übrig blieb die Reihenfolge —
   * tragende Quellen standen oben, aber nichts sagte das. Wer die Datei später las, sah eine flache
   * Liste, in der eine nur konsultierte Quelle wie eine tragende aussah. Genau das ist die Aussage,
   * die der Desktop seit mega52 macht und die der Export verschluckte.
   *
   * Fehlt das Feld, steht an der Zeile kein Kennzeichen — das ist der ehrliche Zustand „Zuordnung
   * unbekannt" (s. `attributionUnknown` unten), nicht „nur konsultiert".
   */
  attributionLabel?: string;
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
  /**
   * AUFTRAG-mega62 Block E: die KI-Kennzeichnung, wie sie Abschnitt 8 von
   * `_relay/kopf/RECHT-KI-Verordnung-Umsetzung.md` für Exporte verlangt — vom Aufrufer bereits
   * übersetzt UND mit eingesetzter Aufgabe und Datum. Sie muss mitgehen, weil die Kennzeichnung
   * dort wirkt, wo die Datei weitergegeben wird; ein Hinweis, der nur auf dem Bildschirm stand,
   * reist nicht mit.
   */
  aiNotice: string;
  /**
   * AUFTRAG-mega62 Block E: der Satz für den Fall, dass die Zuordnung der Quellen UNBEKANNT ist —
   * derselbe, den die Oberfläche über der Liste zeigt. Ohne ihn stünde im Export eine Quellenliste
   * ganz ohne Kennzeichen, und niemand wüsste, ob das „keine trägt" heißt oder „wir wissen es
   * nicht". Fehlt er, wird nichts geschrieben (Aufrufer ohne diesen Zustand bleiben unverändert).
   */
  attributionUnknown?: string;
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
    // AUFTRAG-mega62 Block E: das Kennzeichen steht ZUERST — es ist die Aussage über die Quelle,
    // alles Weitere ist ihre Beschreibung. Auf dem Bildschirm steht es aus demselben Grund direkt
    // am Titel.
    source.attributionLabel,
    source.statusLabel,
    source.trust !== undefined ? `${trustLabel} ${source.trust}` : undefined,
    source.usabilityLabel,
  ].filter((p): p is string => Boolean(p?.trim()));
  const suffix = parts.length > 0 ? ` — ${parts.join(" · ")}` : "";
  return `- ${source.title.trim()}${suffix}`;
}

// ------------------------------------------------------------------------------------------------
// AUFTRAG-mega62 BLOCK E — DER KOPFBLOCK, DER DIE KENNZEICHNUNG MITREISEN LÄSST.
// ------------------------------------------------------------------------------------------------
//
// ZWEIMAL DIESELBE AUSSAGE, UND DAS IST ABSICHT:
//   · MASCHINENLESBAR als YAML-Kopfblock — Werkzeuge, die Markdown einlesen (Wikis, Statik-
//     generatoren, Dokumentenablagen), sehen die Kennzeichnung, ohne Prosa lesen zu müssen. Genau
//     das meint Abschnitt 6 des Rechtsdokuments mit „bei Markdown über einen Kopfblock".
//   · MENSCHENLESBAR als erste Zeile unter der Überschrift — wer die Datei aufmacht, sieht sie,
//     ohne den Kopfblock zu kennen. Ein Metadatum allein wäre nach Artikel 50 Absatz 5 nicht
//     „klar und deutlich unterscheidbar", sondern versteckt.
//
// DER KOPFBLOCK STEHT GANZ OBEN, ohne Leerzeile davor — sonst erkennt ihn kein Werkzeug.
const FRONTMATTER_TRENNER = "---";

function frontmatter(input: AnswerExportInput): string[] {
  return [
    FRONTMATTER_TRENNER,
    "ai-generated: true",
    "ai-system: KLARWERK",
    "ai-task: answer",
    `ai-date: ${input.generatedAt.slice(0, 10)}`,
    FRONTMATTER_TRENNER,
    "",
  ];
}

export function buildAnswerMarkdown(input: AnswerExportInput): string {
  const L = input.labels;
  const lines: string[] = [...frontmatter(input)];
  lines.push(`# ${input.question.trim() || "—"}`);
  lines.push("");
  lines.push(`_${L.aiNotice.trim()}_`);
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
    // AUFTRAG-mega62 Block E: trägt KEINE Zeile ein Kennzeichen, ist die Zuordnung unbekannt —
    // und das gehört gesagt. Eine Liste ohne Kennzeichen und ohne Erklärung liest sich wie
    // „keine trägt", und das wäre eine Aussage, die niemand geprüft hat.
    const ohneKennzeichen = input.sources.every((s) => !s.attributionLabel?.trim());
    if (ohneKennzeichen && L.attributionUnknown?.trim()) {
      lines.push("");
      lines.push(`_${L.attributionUnknown.trim()}_`);
      lines.push("");
    }
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
