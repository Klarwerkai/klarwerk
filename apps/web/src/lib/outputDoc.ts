// Reine, DOM-freie FE-Helfer für die Output Factory (FE-OUT / SCRUM-109).
// Kernlogik liegt im Backend; hier nur Auswahl-Liste + Datei-/Anzeige-Helfer.
import type { OutputDocument, OutputKind } from "../api/types";

export interface OutputKindOption {
  kind: OutputKind;
  labelKey: string; // i18n: out.kind.<kind>
  descKey: string; // i18n: out.kindDesc.<kind>
}

export const OUTPUT_KIND_OPTIONS: readonly OutputKindOption[] = [
  { kind: "instruction", labelKey: "out.kind.instruction", descKey: "out.kindDesc.instruction" },
  { kind: "checklist", labelKey: "out.kind.checklist", descKey: "out.kindDesc.checklist" },
  {
    kind: "troubleshooting",
    labelKey: "out.kind.troubleshooting",
    descKey: "out.kindDesc.troubleshooting",
  },
  { kind: "training", labelKey: "out.kind.training", descKey: "out.kindDesc.training" },
  {
    kind: "management_summary",
    labelKey: "out.kind.management_summary",
    descKey: "out.kindDesc.management_summary",
  },
];

// Dateiname für den Markdown-Download: kind + Datum, ohne Sonderzeichen.
export function downloadFilename(doc: Pick<OutputDocument, "kind" | "generatedAt">): string {
  const date = doc.generatedAt.slice(0, 10) || "output";
  return `klarwerk-${doc.kind}-${date}.md`;
}

// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier stand `orderedSelection` (Auswahl in
// Quellenreihenfolge). Die Output Factory behält bewusst die Nutzer-Reihenfolge
// (`outputComposition.ts::sanitizeOrder`, das Backend rendert in genau dieser Folge, FR-EXT-03); die
// Sortierung rief niemand und ist entfernt.
