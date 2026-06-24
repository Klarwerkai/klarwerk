import { useTranslation } from "react-i18next";
import type { KnowledgeType } from "./types";

// Wissensart-Tag mit Glyph (BRIEF §5).
const GLYPH: Record<KnowledgeType, string> = {
  bauchgefuehl: "∿",
  best_practice: "★",
  lernkurve: "↗",
  technik: "⚙",
  negativwissen: "⊘",
};

export function KnowledgeTypeTag({ type }: { type: KnowledgeType }): JSX.Element {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-hairline px-2 py-0.5 font-mono text-[11px] font-medium text-muted">
      <span aria-hidden>{GLYPH[type]}</span>
      {t(`ktype.${type}`)}
    </span>
  );
}
