import { useTranslation } from "react-i18next";

// Konfidenz/Reifegrad 0–100 (BRIEF §5). Schwellen: <65 Vorläufig · 65–84
// Belastbar · ≥85 Gesichert. Überall ohne Klick erkennbar (A-4).
function quality(v: number): { key: string; color: string } {
  if (v >= 85) {
    return { key: "assured", color: "#3aa06a" };
  }
  if (v >= 65) {
    return { key: "reliable", color: "#c8861a" };
  }
  return { key: "preliminary", color: "#9aa1a8" };
}

export function ConfidenceBar({
  value,
  showLabel = true,
}: {
  value: number;
  showLabel?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const q = quality(v);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-hairline">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: q.color }} />
      </div>
      <span className="font-mono text-[12px] font-semibold" style={{ color: q.color }}>
        {v}
      </span>
      {showLabel ? (
        <span className="text-[12px]" style={{ color: q.color }}>
          {t(`quality.${q.key}`)}
        </span>
      ) : null}
    </div>
  );
}
