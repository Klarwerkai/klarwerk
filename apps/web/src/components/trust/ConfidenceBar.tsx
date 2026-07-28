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
  showLabel = false,
  percentPhrase = false,
}: {
  value: number;
  // AUFTRAG-mega35 E: der Vorgabewert ist FALSE. Das prozentbasierte Qualitätswort — „Gesichert" ab
  // 85 — ist eine Vertrauensaussage aus einer Zahl, nicht aus Belegen; es widerspricht der
  // Einstufung, die seit mega33/mega34 aus Prüfstand und Konfliktlage abgeleitet wird. Alle
  // normalen Leseflächen setzten die Prop bereits ausdrücklich auf false; allein `/ui-kit` hing am
  // alten Vorgabewert und zeigte das Wort weiter. Mit dem Vorgabewert false kann keine neue Fläche
  // mehr versehentlich hineinlaufen — wer das Wort will, sagt es ausdrücklich (Ask.tsx tut das,
  // aber nur bei belegter Einstufung). Die Übersetzungen bleiben unangetastet.
  showLabel?: boolean;
  // SCRUM-513 (WP2): lesbare Prozent-Sprache statt/zusätzlich zur Rohzahl — „84 % sicher". Additiv;
  // ohne die Prop bleibt die Darstellung exakt wie bisher (Rohzahl + Qualitätswort). Bei percentPhrase
  // ersetzt die Sprach-Fassung die bare Zahl (nie „nur Rohzahl", G-2/A-4).
  percentPhrase?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const q = quality(v);
  return (
    // mega40 E: `kw-confidence` — Stil-Anker; das modern-Thema dämpft die Anzeige rein optisch
    // (keine Umbenennung, kein neuer Text, kein Ring — die Vertrauenswert-Scheibe bleibt draußen).
    <div className="kw-confidence flex items-center gap-2">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-hairline">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: q.color }} />
      </div>
      {percentPhrase ? (
        <span className="font-mono text-[12px] font-semibold" style={{ color: q.color }}>
          {t("evidence.percentSure", { pct: v })}
        </span>
      ) : (
        <span className="font-mono text-[12px] font-semibold" style={{ color: q.color }}>
          {v}
        </span>
      )}
      {showLabel ? (
        <span className="text-[12px]" style={{ color: q.color }}>
          {t(`quality.${q.key}`)}
        </span>
      ) : null}
    </div>
  );
}
