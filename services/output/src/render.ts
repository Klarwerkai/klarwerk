// Reine, DOM-freie Renderer je Output-Typ + Herkunftsblock (FE-OUT-01/02/03).
// Eingabe sind ausschließlich bereits validierte KnowledgeObjects (Guard im Service).
import { type KnowledgeObject, geltungsText, ownershipOf } from "../../knowledge-object";
import {
  type OutputKind,
  type OutputProvenance,
  type OutputPruefnachweis,
  type OutputSource,
  type OutputUnsicherheit,
  UNCERTAIN_TRUST_BELOW,
} from "./types";

export const KIND_TITLE: Record<OutputKind, string> = {
  instruction: "Arbeitsanweisung",
  checklist: "Checkliste",
  troubleshooting: "Störungshilfe",
  training: "Schulungsunterlage",
  management_summary: "Management-Summary",
  faq: "FAQ",
  betriebsmitteilung: "Betriebsmitteilung",
};

/** Die Unsicherheiten im Wortlaut des Markdown-Herkunftsblocks. */
export const UNSICHERHEIT_TEXT: Record<OutputUnsicherheit, string> = {
  niedriger_trust: "niedriger Trust",
  geltung_fehlt: "Gültigkeitsbereich nicht angegeben",
  verantwortung_fehlt: "Verantwortung nicht benannt",
  rolle_fehlt: "verantwortliche Rolle nicht benannt",
  pruefdatum_fehlt: "kein Prüfnachweis — Datum der letzten Prüfung nicht belegt",
  pruefnachweis_fremde_fassung: "Prüfnachweis gilt einer früheren Fassung",
  pruefnachweis_ungueltig: "Prüfnachweis hält der Auditprüfung nicht stand",
};

/** Datum der AKTUELLEN Fassung — aus der History, bei v1 ohne Eintrag aus `createdAt`; sonst null. */
function fassungVom(ko: KnowledgeObject): string | null {
  const eintraege = Array.isArray(ko.history) ? ko.history : [];
  for (let i = eintraege.length - 1; i >= 0; i -= 1) {
    const e = eintraege[i];
    if (e && e.version === ko.version && typeof e.at === "string") {
      return e.at;
    }
  }
  return ko.version === 1 && typeof ko.createdAt === "string" ? ko.createdAt : null;
}

export function toSource(ko: KnowledgeObject): OutputSource {
  return {
    id: ko.id,
    title: ko.title,
    status: ko.status,
    trust: ko.trust,
    version: ko.version,
    category: ko.category,
    type: ko.type,
  };
}

/**
 * R-0349 / R-0414: die eindeutige Marke einer Quelle im Dokument. Sie nennt Kennung UND Fassung —
 * zwei gleichnamige Quellen bleiben unterscheidbar, und die Marke führt eindeutig in den
 * Herkunftsblock (`[Qn]`).
 */
export function quellenMarke(index: number, ko: Pick<KnowledgeObject, "id" | "version">): string {
  return `[Q${index + 1}: ${ko.id} · v${ko.version}]`;
}

export interface ProvenanceOptionen {
  /** „Q1", „Q2" … — die Nummer in Auswahlreihenfolge. Ohne Angabe: „Q1". */
  marke?: string;
  /** Ergebnis der Prüfung des Validierungsnachweises. Ohne Angabe: nicht geprüft = MISSING. */
  pruefung?: OutputPruefnachweis;
}

export function toProvenance(
  ko: KnowledgeObject,
  optionen: ProvenanceOptionen = {},
): OutputProvenance {
  // R-0337 / R-1739: nur, was am Objekt (und in seinem Auditnachweis) steht. Fehlt etwas, bleibt
  // es null und wird als Unsicherheit ausgewiesen — kein Rückfall (Verantwortung ≠ Autor, Rolle ≠
  // Geltungsrolle, Geltung ≠ „überall", Prüfdatum ≠ Fassungsdatum).
  const eigentum = ownershipOf(ko);
  const geltungsbereich = ko.geltung ? geltungsText(ko.geltung) : null;
  const verantwortlich = eigentum?.owner ?? null;
  const verantwortlicheRolle = eigentum?.ownerRole ?? null;
  const pruefung: OutputPruefnachweis = optionen.pruefung ?? { zustand: "MISSING" };
  const unsicherheiten: OutputUnsicherheit[] = [];
  if (ko.trust < UNCERTAIN_TRUST_BELOW) {
    unsicherheiten.push("niedriger_trust");
  }
  if (geltungsbereich === null) {
    unsicherheiten.push("geltung_fehlt");
  }
  if (verantwortlich === null) {
    unsicherheiten.push("verantwortung_fehlt");
  }
  if (verantwortlicheRolle === null) {
    unsicherheiten.push("rolle_fehlt");
  }
  if (pruefung.zustand === "MISSING") {
    unsicherheiten.push("pruefdatum_fehlt");
  } else if (pruefung.zustand === "WRONG_SUBJECT") {
    unsicherheiten.push("pruefnachweis_fremde_fassung");
  } else if (pruefung.zustand !== "OK") {
    unsicherheiten.push("pruefnachweis_ungueltig");
  }
  return {
    marke: optionen.marke ?? "Q1",
    geltungsbereich,
    verantwortlich,
    verantwortlicheRolle,
    validiertVon: eigentum ? [...eigentum.validators] : [],
    fassungVom: fassungVom(ko),
    letztePruefungAm: pruefung.zustand === "OK" ? pruefung.am : null,
    unsicherheiten,
    koId: ko.id,
    title: ko.title,
    status: ko.status,
    trust: ko.trust,
    version: ko.version,
    author: ko.author,
    originalAuthor: ko.originalAuthor,
    category: ko.category,
    type: ko.type,
    // Gültigkeit ehrlich abgeleitet: kein Ablaufdatum im Modell (FR-EXT-07 = Konzept).
    validity: `validiert · v${ko.version} · Stand ${ko.createdAt}`,
    uncertain: ko.trust < UNCERTAIN_TRUST_BELOW,
  };
}

function authorLine(ko: KnowledgeObject): string {
  return ko.author === ko.originalAuthor ? ko.author : `${ko.author} (urspr. ${ko.originalAuthor})`;
}

// --- Renderer je Typ. Liefern den Dokument-Körper (ohne Herkunftsblock). ---
//
// R-0349 / R-0414 (Nacharbeit 5): jede tragende Passage trägt die Marke ihrer Quelle
// (`quellenMarke`) — an der Überschrift ihres Blocks bzw. an der Zeile selbst, wo es keinen Block
// gibt. Die Marke ist Klartext und reist deshalb unverändert nach Word und über den Rückweg.

/** Kontext je Aufruf: die Marken in Auswahlreihenfolge, der Anlass und die Herkunft je Quelle. */
export interface RenderKontext {
  marken: readonly string[];
  anlass: string | null;
  audienceRole: string | null;
  provenance: readonly OutputProvenance[];
}

function marke(kontext: RenderKontext, i: number): string {
  return kontext.marken[i] ?? "";
}

function renderInstruction(kos: readonly KnowledgeObject[], k: RenderKontext): string {
  const blocks = kos.map((ko, i) => {
    const lines = [`## ${i + 1}. ${ko.title} ${marke(k, i)}`, "", ko.statement];
    if (ko.conditions.length > 0) {
      lines.push("", "**Wann es gilt**", ...ko.conditions.map((c) => `- ${c}`));
    }
    if (ko.measures.length > 0) {
      lines.push("", "**Vorgehen**", ...ko.measures.map((m, n) => `${n + 1}. ${m}`));
    }
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}

function renderChecklist(kos: readonly KnowledgeObject[], k: RenderKontext): string {
  const items: string[] = [];
  for (const [i, ko] of kos.entries()) {
    items.push(`### ${ko.title} ${marke(k, i)}`);
    const points = ko.measures.length > 0 ? ko.measures : [ko.statement];
    for (const p of points) {
      items.push(`- [ ] ${p}`);
    }
    items.push("");
  }
  return items.join("\n").trimEnd();
}

function renderTroubleshooting(kos: readonly KnowledgeObject[], k: RenderKontext): string {
  const blocks = kos.map((ko, i) => {
    const symptom = ko.conditions.length > 0 ? ko.conditions.join("; ") : ko.title;
    const action = ko.measures.length > 0 ? ko.measures.map((m) => `- ${m}`).join("\n") : "—";
    return [
      `### ${ko.title} ${marke(k, i)}`,
      `**Symptom / Bedingung:** ${symptom}`,
      `**Ursache / Hinweis:** ${ko.statement}`,
      "**Maßnahme:**",
      action,
    ].join("\n");
  });
  return blocks.join("\n\n");
}

function renderTraining(kos: readonly KnowledgeObject[], k: RenderKontext): string {
  const blocks = kos.map((ko, i) => {
    const lines = [
      `## Lerneinheit ${i + 1}: ${ko.title} ${marke(k, i)}`,
      "",
      `**Kernaussage:** ${ko.statement}`,
    ];
    if (ko.conditions.length > 0) {
      lines.push("", "**Kontext / Voraussetzungen**", ...ko.conditions.map((c) => `- ${c}`));
    }
    if (ko.measures.length > 0) {
      lines.push("", "**Was zu tun ist**", ...ko.measures.map((m) => `- ${m}`));
    }
    lines.push("", `_Lernziel: Inhalt sicher anwenden können (${ko.category})._`);
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}

function renderManagementSummary(kos: readonly KnowledgeObject[], k: RenderKontext): string {
  const avgTrust =
    kos.length > 0 ? Math.round(kos.reduce((s, x) => s + x.trust, 0) / kos.length) : 0;
  const lines = [
    `**Umfang:** ${kos.length} validierte Wissensobjekte · Ø Trust ${avgTrust}`,
    "",
    "**Kernpunkte:**",
    ...kos.map(
      (ko, i) =>
        `- ${ko.title} — ${ko.statement} _(${ko.category}, Trust ${ko.trust}, ${authorLine(ko)})_ ${marke(k, i)}`,
    ),
  ];
  const uncertain = kos
    .map((ko, i) => ({ ko, i }))
    .filter(({ ko }) => ko.trust < UNCERTAIN_TRUST_BELOW);
  if (uncertain.length > 0) {
    lines.push(
      "",
      "**Unsicherheiten:**",
      ...uncertain.map(({ ko, i }) => `- ${ko.title} (Trust ${ko.trust}) ${marke(k, i)}`),
    );
  }
  return lines.join("\n");
}

// R-0732 / SOLL:FR-EXT-03: je Quelle eine Frage (der Titel) und ihre Antwort (Aussage, Bedingungen,
// Maßnahmen) — nichts hinzugefügt, was nicht im Wissensobjekt steht.
function renderFaq(kos: readonly KnowledgeObject[], k: RenderKontext): string {
  const blocks = kos.map((ko, i) => {
    const lines = [`### ${ko.title} ${marke(k, i)}`, "", ko.statement];
    if (ko.conditions.length > 0) {
      lines.push("", `**Gilt, wenn:** ${ko.conditions.join("; ")}`);
    }
    if (ko.measures.length > 0) {
      lines.push("", ...ko.measures.map((m, n) => `${n + 1}. ${m}`));
    }
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}

// ================================================================================================
// R-0350 / R-0349 (Nacharbeit 5) — DIE BETRIEBSMITTEILUNG: DIE FORM DER GATTUNG, NICHT EIN GERÜST.
// ================================================================================================
//
// Pedis Beispiel: „Ich muss eine Betriebsmitteilung zu Urlaubstagen schreiben." Eine
// Betriebsmitteilung hat Betreff, Anrede an die Belegschaft, einen sachlich-freundlichen Ton in
// Sie-Form, den Anlass, die geltenden Punkte, was zu tun ist, einen Ansprechpartner und einen Gruß.
// Genau diese Form entsteht hier — regelbasiert, ohne Modell, aus nichts als den gewählten
// geprüften Quellen. Jeder geltende Punkt trägt seine Quellenmarke. Was nicht aus den Quellen
// kommen KANN (Unterzeichner, Ansprechpartner ohne benannte Rolle), steht als sichtbarer
// Platzhalter in eckigen Klammern da: „Der Mensch formt, kürzt, unterschreibt."
function renderBetriebsmitteilung(kos: readonly KnowledgeObject[], k: RenderKontext): string {
  const anlass = k.anlass ? k.anlass.trim() : "";
  const betreff = anlass.length > 0 ? anlass : kos.map((ko) => ko.title).join(", ");
  const rollen: string[] = [];
  for (const p of k.provenance) {
    if (p.verantwortlicheRolle !== null && !rollen.includes(p.verantwortlicheRolle)) {
      rollen.push(p.verantwortlicheRolle);
    }
  }
  const anrede = k.audienceRole
    ? `Liebe Kolleginnen und Kollegen (${k.audienceRole}),`
    : "Liebe Kolleginnen und Kollegen,";
  // Endet der Anlass schon mit einem Satzzeichen („… was haben wir dazu?"), kommt keines dazu.
  const satzende = /[.!?]$/.test(betreff) ? "" : ".";
  const lines = [
    `**Betreff:** ${betreff}`,
    "",
    anrede,
    "",
    `wir möchten Sie über Folgendes informieren: ${betreff}${satzende} Für Sie gilt:`,
  ];
  for (const [i, ko] of kos.entries()) {
    lines.push("", `**${ko.title}** ${marke(k, i)}`, "", ko.statement);
    if (ko.conditions.length > 0) {
      lines.push("", `Das gilt, wenn: ${ko.conditions.join("; ")}.`);
    }
    if (ko.measures.length > 0) {
      lines.push("", "Bitte beachten Sie:", ...ko.measures.map((m, n) => `${n + 1}. ${m}`));
    }
  }
  lines.push(
    "",
    rollen.length > 0
      ? `Bei Rückfragen wenden Sie sich bitte an: ${rollen.join(", ")}.`
      : "Bei Rückfragen wenden Sie sich bitte an: [Ansprechpartner eintragen].",
    "",
    "Vielen Dank für Ihre Unterstützung.",
    "",
    "Mit freundlichen Grüßen",
    "",
    "[Name, Funktion]",
  );
  return lines.join("\n");
}

type Renderer = (kos: readonly KnowledgeObject[], k: RenderKontext) => string;

const RENDERERS: Record<OutputKind, Renderer> = {
  instruction: renderInstruction,
  checklist: renderChecklist,
  troubleshooting: renderTroubleshooting,
  training: renderTraining,
  management_summary: renderManagementSummary,
  faq: renderFaq,
  betriebsmitteilung: renderBetriebsmitteilung,
};

export function renderBody(
  kind: OutputKind,
  kos: readonly KnowledgeObject[],
  kontext?: Partial<RenderKontext>,
): string {
  const k: RenderKontext = {
    marken: kontext?.marken ?? kos.map((ko, i) => quellenMarke(i, ko)),
    anlass: kontext?.anlass ?? null,
    audienceRole: kontext?.audienceRole ?? null,
    provenance: kontext?.provenance ?? kos.map((ko, i) => toProvenance(ko, { marke: `Q${i + 1}` })),
  };
  return RENDERERS[kind](kos, k);
}

// AUFTRAG-mega29 C3 (bens M28-3): der Herkunftsblock nennt Status, Trust und Version — und schwieg
// bisher darüber, ob das enthaltene Wissen gegen Widersprüche und Duplikate geprüft wurde. Seit dem
// Kandidaten-Deckel ist dieses Schweigen irreführend: wer eine fertige Arbeitsanweisung in der Hand
// hält, schließt daraus leicht auf innere Stimmigkeit. BEWUSST nur EIN Satz und NICHT die volle
// Abdeckung: ein Dokument bündelt viele Objekte mit je eigenem Lauf; eine belastbare Gesamtzahl
// wäre eine eigene Rechnung. Der Satz behauptet deshalb nichts über den Umfang — er nimmt nur die
// Zusicherung zurück, die der Leser sonst selbst ergänzt. (Strukturgleich zu EXPORT_NO_CHECK_NOTE
// in services/library-analytics; die Modulgrenze verbietet einen geteilten Textbestand.)
export const OUTPUT_NO_CHECK_NOTE =
  "Hinweis: Dieses Dokument trifft keine Aussage darüber, ob das enthaltene Wissen auf Konflikte oder Duplikate geprüft wurde.";

// Herkunftsblock (FE-OUT-03): je Quelle Marke, KO-ID, Fassung, Status, Trust, Autor, Gültigkeit.
export function renderProvenance(provs: readonly OutputProvenance[]): string {
  const lines = ["## Herkunft & Nachweis", ""];
  for (const p of provs) {
    const flag = p.uncertain ? " · ⚠︎ niedriger Trust" : "";
    lines.push(
      `- [${p.marke}] **${p.title}** (\`${p.koId}\`, Fassung ${p.version}) — ${p.type} · ${p.category} · Status ${p.status} · ` +
        `Trust ${p.trust} · ${p.validity} · Autor: ${p.author === p.originalAuthor ? p.author : `${p.author} (urspr. ${p.originalAuthor})`}${flag}`,
    );
    // R-0337 / R-1739: die übrigen Pflichtangaben je Quelle; Fehlendes steht als „nicht …" da.
    const validiert =
      p.validiertVon.length > 0 ? ` (validiert von ${p.validiertVon.join(", ")})` : "";
    lines.push(
      `  Gültigkeitsbereich: ${p.geltungsbereich ?? "nicht angegeben"} · ` +
        `Verantwortliche Rolle: ${p.verantwortlicheRolle ?? "nicht benannt"} · ` +
        `Verantwortung: ${p.verantwortlich ?? "nicht benannt"} · ` +
        `Fassung vom: ${p.fassungVom ? p.fassungVom.slice(0, 10) : "nicht festgehalten"} · ` +
        `Letzte Prüfung: ${p.letztePruefungAm ? p.letztePruefungAm.slice(0, 10) : "nicht belegt"}${validiert}`,
    );
    const unsicher = p.unsicherheiten.map((u) => UNSICHERHEIT_TEXT[u]).join("; ");
    lines.push(`  Offene Unsicherheiten: ${unsicher || "keine"}`);
  }
  lines.push("", OUTPUT_NO_CHECK_NOTE);
  return lines.join("\n");
}
