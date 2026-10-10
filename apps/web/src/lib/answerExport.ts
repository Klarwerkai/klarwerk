// SCRUM-430 (Pedi 03.07., VIP): eine beantwortete Frage inkl. Quellen als Markdown exportieren/
// teilen (Kopieren / Download / Druck-PDF). Reine, DOM-freie Formatierung — testbar ohne Browser.
// Die Quellen bleiben klar ausgewiesen (Status/Trust/Nutzbarkeit); nichts wird beschönigt.
import type { KiHerkunft } from "./kiHerkunft";

export interface AnswerExportStep {
  description: string;
  snippet?: string | null;
}

export interface AnswerExportSource {
  /**
   * JOB 502 (Klara-Export, Quellidentität): die stabile, BEREITS VORHANDENE Kennung der Quelle —
   * dieselbe Id, mit der die Oberfläche auf `/wissen/<id>` verlinkt.
   *
   * Bis hierher trug die exportierte Zeile nur Titel, Status, Trust und Nutzbarkeit. Zwei Fassungen
   * desselben Dokuments — gleicher Titel, gleicher Status, gleicher Wert — wurden damit zu zwei
   * buchstabengleichen Zeilen: wer den Export später las, konnte die Fundstelle nicht mehr
   * zurückverfolgen und sah nicht einmal, DASS es zwei verschiedene Quellen waren.
   *
   * Das Feld ist PFLICHT und nicht optional. Ein optionales Feld hätte genau die Lücke offen
   * gelassen, um die es geht: einen Export ohne Rückverfolgbarkeit, der trotzdem baut. Die Kennung
   * wird dabei nie erfunden — sie kommt aus dem Bestand (`SourceRef.id`), niemals aus einer
   * Ersatznummerierung.
   */
  sourceId: string;
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

// ------------------------------------------------------------------------------------------------
// R-1643 — DAS ENTSCHEIDUNGS-PROTOKOLL.
// ------------------------------------------------------------------------------------------------
// Originalwortlaut (Funktions-Roadmap 6.1): eine KLARWERK-gestützte Entscheidung „kann mit einem
// Klick als Audit-Dokument exportiert werden — PDF mit allen Quellen, Trust-Werten,
// Argumentationskette, Zeitstempel, Nutzer-ID".
//
// Quellen (mit Kennung), Trust-Werte und Schritte trug die Markdown-Datei schon. Es fehlten zwei
// Angaben: der ZEITSTEMPEL stand nur als Tag (`YYYY-MM-DD`) in Fußnote und Kopfblock, und WER
// exportiert hat, stand nirgends. Beides ergänzt dieser Block; die Datei bleibt dieselbe. Das
// gedruckte Blatt (der PDF-Weg) liest dieselben Angaben über `fragen/Entscheidungsprotokoll.tsx`.
export interface DecisionProtocolLabels {
  heading: string;
  time: string;
  user: string;
  // Fehlt eine angemeldete Person, steht das so da — es wird keine Kennung erfunden.
  userUnknown: string;
  // R-1643 (Ben, Nacharbeit 2): die Argumentationskette.
  argumentation: string;
  // „belegt durch" vor der Quelle eines Glieds.
  supportedBy: string;
  // Liefert der Server keine Kette, steht das so da — die Quellenliste ersetzt sie nicht.
  argumentationMissing: string;
}

/**
 * R-1643: ein Glied der Argumentationskette — eine Aussage der Antwort und die Quelle, deren
 * Wortlaut sie belegt (gemessen vom Reasoner, `pruefeDeckung`).
 */
export interface DecisionArgument {
  aussage: string;
  belegtDurch: string;
}

export interface DecisionProtocol {
  /**
   * Die Kennung der angemeldeten Person aus der Sitzung (`SessionUser.id`) — `null`, wenn keine
   * Sitzung feststeht. PFLICHT und nicht optional: ein Protokoll ohne die Angabe, ob die Person
   * bekannt ist, wäre die Lücke, um die es R-1643 geht.
   */
  userId: string | null;
  /**
   * Die Argumentationskette der Antwort — `null`, wenn der Server keine geliefert hat. PFLICHT aus
   * demselben Grund wie `userId`: die Schritte (`steps`) sind Fundstellen, keine Begründung, und
   * dürfen ihre Stelle nicht stillschweigend einnehmen.
   */
  argumentation: readonly DecisionArgument[] | null;
  labels: DecisionProtocolLabels;
}

/**
 * R-1643: die Glieder der Kette mit dem Titel ihrer Quelle — von Datei und Druck gemeinsam
 * gelesen. Der Titel kommt aus der Quellenliste derselben Antwort; steht die Quelle dort nicht,
 * bleibt es bei der Kennung (nie ein erfundener Titel).
 */
export function decisionArguments(
  input: Pick<AnswerExportInput, "sources">,
  protocol: DecisionProtocol,
): { aussage: string; quelleTitel: string | null; quelleId: string }[] | null {
  if (!protocol.argumentation || protocol.argumentation.length === 0) {
    return null;
  }
  return protocol.argumentation.map((glied) => ({
    aussage: glied.aussage.trim(),
    quelleTitel: input.sources.find((s) => s.sourceId === glied.belegtDurch)?.title.trim() || null,
    quelleId: glied.belegtDurch,
  }));
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
  // R-1643: optional nur für Aufrufer ohne Sitzung (reine Formatierungsfälle); die Fragenfläche
  // gibt es immer mit.
  protocol?: DecisionProtocol;
  /**
   * R-0604 / R-0625 (Ben Nacharbeit 2): die DREIWERTIGE Herkunft (`kiHerkunftAus`). Nur der belegte
   * modellfreie Rückfall (`"ohne-ki"`) nimmt Kopfblock und Satz heraus. `"ki"`, `"unbekannt"` und
   * eine fehlende Angabe behalten die Kennzeichnung — Unbekannt wird nicht still zu „keine KI".
   * Bis Nacharbeit 2 stand hier ein Boolean, und die Fragenseite machte aus „unbekannt" ein `false`.
   */
  kiHerkunft?: KiHerkunft;
}

/** Trägt die Datei die KI-Kennzeichnung? Für ALLE Ausgabeformate dieselbe Entscheidung. */
export function exportKennzeichnen(input: Pick<AnswerExportInput, "kiHerkunft">): boolean {
  return input.kiHerkunft !== "ohne-ki";
}

/**
 * R-1643: die Aussagen über eine Quelle, in fester Reihenfolge — von Markdown-Zeile und
 * gedrucktem Protokoll GEMEINSAM gelesen, damit Datei und PDF dasselbe über eine Quelle sagen.
 * Die Kennung steht zuletzt und ohne Auszeichnung; die Markdown-Zeile setzt sie in Backticks.
 */
export function sourceFacts(source: AnswerExportSource, trustLabel: string): string[] {
  return [
    // AUFTRAG-mega62 Block E: das Kennzeichen steht ZUERST — es ist die Aussage über die Quelle,
    // alles Weitere ist ihre Beschreibung. Auf dem Bildschirm steht es aus demselben Grund direkt
    // am Titel.
    source.attributionLabel,
    source.statusLabel,
    source.trust !== undefined ? `${trustLabel} ${source.trust}` : undefined,
    source.usabilityLabel,
    // JOB 502: die Kennung steht ZULETZT — und zwar bewusst. Alles davor sind Aussagen ÜBER die
    // Quelle (trägt/angesehen, Status, Wert, Nutzbarkeit); sie werden gelesen. Die Id ist keine
    // Aussage, sondern der Rückweg zur Fundstelle — sie gehört ans Ende, wo sie beim Lesen nicht
    // im Weg steht, aber jederzeit greifbar ist.
    source.sourceId.trim() || undefined,
  ].filter((p): p is string => Boolean(p?.trim()));
}

function sourceLine(source: AnswerExportSource, trustLabel: string): string {
  // JOB 502: die Kennung steht in Backticks, damit sofort erkennbar ist, dass es eine technische
  // Kennung ist und kein weiteres Urteilswort.
  const id = source.sourceId.trim();
  const parts = [
    ...sourceFacts({ ...source, sourceId: "" }, trustLabel),
    ...(id ? [`\`${id}\``] : []),
  ];
  const suffix = parts.length > 0 ? ` — ${parts.join(" · ")}` : "";
  return `- ${source.title.trim()}${suffix}`;
}

/**
 * R-1643: die Kopfzeilen des Entscheidungs-Protokolls — Zeitpunkt (voller ISO-Zeitstempel, UTC)
 * und Nutzer-ID. Ebenfalls von Datei und Druck gemeinsam gelesen.
 */
export function decisionProtocolRows(
  input: Pick<AnswerExportInput, "generatedAt">,
  protocol: DecisionProtocol,
): { label: string; value: string; kennung: boolean }[] {
  const user = protocol.userId?.trim();
  return [
    { label: protocol.labels.time, value: input.generatedAt, kennung: false },
    user
      ? { label: protocol.labels.user, value: user, kennung: true }
      : { label: protocol.labels.user, value: protocol.labels.userUnknown, kennung: false },
  ];
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
  // R-1643: Zeitpunkt und Person auch MASCHINENLESBAR — eine Ablage, die nach Kopfblöcken
  // sortiert, findet das Protokoll so ohne Prosa. Die Person steht nur da, wenn sie feststeht;
  // „unbekannt" ist eine Aussage für Lesende und steht deshalb unten im Text.
  const protokoll = input.protocol
    ? [
        `exported-at: ${input.generatedAt}`,
        ...(input.protocol.userId?.trim()
          ? [`user-id: ${JSON.stringify(input.protocol.userId.trim())}`]
          : []),
      ]
    : [];
  // R-0604 / R-0625: nur der belegte modellfreie Rückfall nimmt die KI-Zeilen heraus. Die
  // Protokollzeilen (R-1643) sind keine KI-Aussage und bleiben; ohne Protokoll entfällt der
  // Kopfblock dann ganz — Zeichen für Zeichen wie vor der Zusammenführung.
  const kennzeichnen = exportKennzeichnen(input);
  if (!kennzeichnen && protokoll.length === 0) {
    return [];
  }
  return [
    FRONTMATTER_TRENNER,
    ...(kennzeichnen
      ? [
          "ai-generated: true",
          "ai-system: KLARWERK",
          "ai-task: answer",
          `ai-date: ${input.generatedAt.slice(0, 10)}`,
        ]
      : []),
    ...protokoll,
    FRONTMATTER_TRENNER,
    "",
  ];
}

export function buildAnswerMarkdown(input: AnswerExportInput): string {
  const L = input.labels;
  const lines: string[] = [...frontmatter(input)];
  lines.push(`# ${input.question.trim() || "—"}`);
  lines.push("");
  if (exportKennzeichnen(input)) {
    lines.push(`_${L.aiNotice.trim()}_`);
    lines.push("");
  }
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

  if (input.protocol) {
    lines.push("");
    lines.push(`## ${input.protocol.labels.heading}`);
    for (const row of decisionProtocolRows(input, input.protocol)) {
      lines.push(`- ${row.label}: ${row.kennung ? `\`${row.value}\`` : row.value}`);
    }
    // R-1643 (Ben, Nacharbeit 2): die Argumentationskette — Aussage für Aussage mit ihrem Beleg.
    const PL = input.protocol.labels;
    lines.push("");
    lines.push(`### ${PL.argumentation}`);
    const kette = decisionArguments(input, input.protocol);
    if (kette) {
      for (const [i, glied] of kette.entries()) {
        const quelle = glied.quelleTitel
          ? `${glied.quelleTitel} \`${glied.quelleId}\``
          : `\`${glied.quelleId}\``;
        lines.push(`${i + 1}. „${glied.aussage}“ — ${PL.supportedBy}: ${quelle}`);
      }
    } else {
      lines.push(`_${PL.argumentationMissing}_`);
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
