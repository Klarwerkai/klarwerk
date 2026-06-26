// Reine, DOM-freie Renderer je Output-Typ + Herkunftsblock (FE-OUT-01/02/03).
// Eingabe sind ausschließlich bereits validierte KnowledgeObjects (Guard im Service).
import type { KnowledgeObject } from "../../knowledge-object";
import {
  type OutputKind,
  type OutputProvenance,
  type OutputSource,
  UNCERTAIN_TRUST_BELOW,
} from "./types";

export const KIND_TITLE: Record<OutputKind, string> = {
  instruction: "Arbeitsanweisung",
  checklist: "Checkliste",
  troubleshooting: "Störungshilfe",
  training: "Schulungsunterlage",
  management_summary: "Management-Summary",
};

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
  return {
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

const RENDERERS: Record<OutputKind, (kos: readonly KnowledgeObject[]) => string> = {
  instruction: renderInstruction,
  checklist: renderChecklist,
  troubleshooting: renderTroubleshooting,
  training: renderTraining,
  management_summary: renderManagementSummary,
};

export function renderBody(kind: OutputKind, kos: readonly KnowledgeObject[]): string {
  return RENDERERS[kind](kos);
}

// Herkunftsblock (FE-OUT-03): je Quelle KO-ID, Status, Trust, Version, Autor, Gültigkeit.
export function renderProvenance(provs: readonly OutputProvenance[]): string {
  const lines = ["## Herkunft & Nachweis", ""];
  for (const p of provs) {
    const flag = p.uncertain ? " · ⚠︎ niedriger Trust" : "";
    lines.push(
      `- **${p.title}** (\`${p.koId}\`) — ${p.type} · ${p.category} · Status ${p.status} · ` +
        `Trust ${p.trust} · ${p.validity} · Autor: ${p.author === p.originalAuthor ? p.author : `${p.author} (urspr. ${p.originalAuthor})`}${flag}`,
    );
  }
  return lines.join("\n");
}
