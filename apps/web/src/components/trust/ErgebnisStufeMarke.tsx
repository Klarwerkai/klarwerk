import { useTranslation } from "react-i18next";
import { ERGEBNIS_STUFE_TEXT, type ErgebnisStufe } from "../../lib/kiHerkunft";

// R-1020 / R-1695 (Grundsatz G-3): EINE Marke für die Stufe jedes Ergebnisses — Entwurf,
// Empfehlung oder validiert. Die Stufe wird nicht hier entschieden, sondern in `lib/kiHerkunft.ts`;
// diese Marke zeigt sie nur. Nie allein über Farbe: jede Stufe trägt ihren Wortlaut, der Entwurf
// zusätzlich Rahmenform (gestrichelt) und Zeichen (✦).
const STIL: Readonly<Record<ErgebnisStufe, string>> = {
  entwurf: "border border-dashed border-ai-dashed bg-ai-surface-2 text-ai",
  empfehlung: "border border-trust-warn-fill bg-trust-warn-bg text-trust-warn-text",
  validiert: "border border-trust-pos-fill bg-trust-pos-bg text-trust-pos-text",
};

export function ErgebnisStufeMarke({
  stufe,
  className,
}: {
  stufe: ErgebnisStufe;
  className?: string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      data-testid="ergebnis-stufe"
      data-stufe={stufe}
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider ${STIL[stufe]} ${className ?? ""}`}
    >
      {stufe === "entwurf" ? <span aria-hidden>✦</span> : null}
      {t(ERGEBNIS_STUFE_TEXT[stufe])}
    </span>
  );
}
