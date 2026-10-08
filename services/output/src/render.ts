// Reine, DOM-freie Renderer je Output-Typ + Herkunftsblock (FE-OUT-01/02/03).
// Eingabe sind ausschließlich bereits validierte KnowledgeObjects (Guard im Service).
import { type KnowledgeObject, geltungsText, ownershipOf } from "../../knowledge-object";
import {
  type OutputKind,
  type OutputProvenance,
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
};

/** Die Unsicherheiten im Wortlaut des Markdown-Herkunftsblocks. */
export const UNSICHERHEIT_TEXT: Record<OutputUnsicherheit, string> = {
  niedriger_trust: "niedriger Trust",
  geltung_fehlt: "Gültigkeitsbereich nicht angegeben",
  verantwortung_fehlt: "Verantwortung nicht benannt",
  pruefdatum_fehlt: "Datum der letzten Prüfung nicht festgehalten",
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

export function toProvenance(ko: KnowledgeObject): OutputProvenance {
  // R-0337 / R-1739: nur, was am Objekt steht. Fehlt etwas, bleibt es null und wird als
  // Unsicherheit ausgewiesen — kein Rückfall (Verantwortung ≠ Autor, Geltung ≠ „überall").
  const eigentum = ownershipOf(ko);
  const geltungsbereich = ko.geltung ? geltungsText(ko.geltung) : null;
  const verantwortlich = eigentum?.owner ?? null;
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
  unsicherheiten.push("pruefdatum_fehlt");
  return {
    geltungsbereich,
    verantwortlich,
    validiertVon: eigentum ? [...eigentum.validators] : [],
    fassungVom: fassungVom(ko),
    letztePruefungAm: null,
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

function renderInstruction(kos: readonly KnowledgeObject[]): string {
  const blocks = kos.map((ko, i) => {
    const lines = [`## ${i + 1}. ${ko.title}`, "", ko.statement];
    if (ko.conditions.length > 0) {
      lines.push("", "**Wann es gilt**", ...ko.conditions.map((c) => `- ${c}`));
    }
    if (ko.measures.length > 0) {
      lines.push("", "**Vorgehen**", ...ko.measures.map((m, k) => `${k + 1}. ${m}`));
    }
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}

function renderChecklist(kos: readonly KnowledgeObject[]): string {
  const items: string[] = [];
  for (const ko of kos) {
    items.push(`### ${ko.title}`);
    const points = ko.measures.length > 0 ? ko.measures : [ko.statement];
    for (const p of points) {
      items.push(`- [ ] ${p}`);
    }
    items.push("");
  }
  return items.join("\n").trimEnd();
}

function renderTroubleshooting(kos: readonly KnowledgeObject[]): string {
  const blocks = kos.map((ko) => {
    const symptom = ko.conditions.length > 0 ? ko.conditions.join("; ") : ko.title;
    const action = ko.measures.length > 0 ? ko.measures.map((m) => `- ${m}`).join("\n") : "—";
    return [
      `### ${ko.title}`,
      `**Symptom / Bedingung:** ${symptom}`,
      `**Ursache / Hinweis:** ${ko.statement}`,
      "**Maßnahme:**",
      action,
    ].join("\n");
  });
  return blocks.join("\n\n");
}

function renderTraining(kos: readonly KnowledgeObject[]): string {
  const blocks = kos.map((ko, i) => {
    const lines = [`## Lerneinheit ${i + 1}: ${ko.title}`, "", `**Kernaussage:** ${ko.statement}`];
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

function renderManagementSummary(kos: readonly KnowledgeObject[]): string {
  const avgTrust =
    kos.length > 0 ? Math.round(kos.reduce((s, k) => s + k.trust, 0) / kos.length) : 0;
  const lines = [
    `**Umfang:** ${kos.length} validierte Wissensobjekte · Ø Trust ${avgTrust}`,
    "",
    "**Kernpunkte:**",
    ...kos.map(
      (ko) =>
        `- ${ko.title} — ${ko.statement} _(${ko.category}, Trust ${ko.trust}, ${authorLine(ko)})_`,
    ),
  ];
  const uncertain = kos.filter((k) => k.trust < UNCERTAIN_TRUST_BELOW);
  if (uncertain.length > 0) {
    lines.push(
      "",
      "**Unsicherheiten:**",
      ...uncertain.map((k) => `- ${k.title} (Trust ${k.trust})`),
    );
  }
  return lines.join("\n");
}

// R-0732 / SOLL:FR-EXT-03: je Quelle eine Frage (der Titel) und ihre Antwort (Aussage, Bedingungen,
// Maßnahmen) — nichts hinzugefügt, was nicht im Wissensobjekt steht.
function renderFaq(kos: readonly KnowledgeObject[]): string {
  const blocks = kos.map((ko) => {
    const lines = [`### ${ko.title}`, "", ko.statement];
    if (ko.conditions.length > 0) {
      lines.push("", `**Gilt, wenn:** ${ko.conditions.join("; ")}`);
    }
    if (ko.measures.length > 0) {
      lines.push("", ...ko.measures.map((m, k) => `${k + 1}. ${m}`));
    }
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}

const RENDERERS: Record<OutputKind, (kos: readonly KnowledgeObject[]) => string> = {
  instruction: renderInstruction,
  checklist: renderChecklist,
  troubleshooting: renderTroubleshooting,
  training: renderTraining,
  management_summary: renderManagementSummary,
  faq: renderFaq,
};

export function renderBody(kind: OutputKind, kos: readonly KnowledgeObject[]): string {
  return RENDERERS[kind](kos);
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

// Herkunftsblock (FE-OUT-03): je Quelle KO-ID, Status, Trust, Version, Autor, Gültigkeit.
export function renderProvenance(provs: readonly OutputProvenance[]): string {
  const lines = ["## Herkunft & Nachweis", ""];
  for (const p of provs) {
    const flag = p.uncertain ? " · ⚠︎ niedriger Trust" : "";
    lines.push(
      `- **${p.title}** (\`${p.koId}\`) — ${p.type} · ${p.category} · Status ${p.status} · ` +
        `Trust ${p.trust} · ${p.validity} · Autor: ${p.author === p.originalAuthor ? p.author : `${p.author} (urspr. ${p.originalAuthor})`}${flag}`,
    );
    // R-0337 / R-1739: die übrigen Pflichtangaben je Quelle; Fehlendes steht als „nicht …" da.
    const validiert =
      p.validiertVon.length > 0 ? ` (validiert von ${p.validiertVon.join(", ")})` : "";
    lines.push(
      `  Gültigkeitsbereich: ${p.geltungsbereich ?? "nicht angegeben"} · ` +
        `Verantwortung: ${p.verantwortlich ?? "nicht benannt"} · ` +
        `Fassung vom: ${p.fassungVom ? p.fassungVom.slice(0, 10) : "nicht festgehalten"} · ` +
        `Letzte Prüfung: ${p.letztePruefungAm ? p.letztePruefungAm.slice(0, 10) : "nicht festgehalten"}${validiert}`,
    );
    const unsicher = p.unsicherheiten.map((u) => UNSICHERHEIT_TEXT[u]).join("; ");
    lines.push(`  Offene Unsicherheiten: ${unsicher || "keine"}`);
  }
  lines.push("", OUTPUT_NO_CHECK_NOTE);
  return lines.join("\n");
}
