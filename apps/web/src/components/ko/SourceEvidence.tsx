import { useTranslation } from "react-i18next";
import type { KoSource } from "../../api/types";
import i18n from "../../i18n";
import { sourceBadgeKey } from "../../lib/koSource";
import { safeHttpUrl } from "../../lib/safeUrl";
import { ConfidenceBar } from "../trust";

// SCRUM-513/486 (WP2-Design): gemeinsamer, wiederverwendbarer Belegschicht-Baustein — die eine Quelle
// der Wahrheit dafür, WOHER eine Aussage stammt, WANN und WIE sicher. Reine Präsentation (Props rein,
// JSX raus) — KEINE Datenbeschaffung. Genutzt in KO-Detail, KoView/Konfliktkarte und Vergleich.

// Datum lokalisiert + robust formatieren. Ungültig/leer → null (der Aufrufer zeigt dann „kein Datum").
function formatDate(iso: string | null | undefined, lang: string): string | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(lang);
}

// EINE anklickbare Quelle. Mit URL → echter Link (neuer Tab, noreferrer). Ohne URL → KEIN toter blauer
// Link, sondern das Label als Text plus ehrliche „interne Quelle"-Markierung. Zusätzlich der
// validiert/nicht-validiert-Badge (Belegstufe) und optional der Anbieter.
export function SourceLink({
  source,
  showExcerpt = false,
}: {
  source: KoSource;
  showExcerpt?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  // G-2/WP2: defensiv gegen Altdaten — eine gespeicherte javascript:/data:/relative URL wird NICHT zum
  // aktiven Link, sondern fällt auf die „interne Quelle"-Textdarstellung zurück.
  const href = safeHttpUrl(source.url);
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-1.5">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-[12.5px] font-medium text-ai hover:underline"
          >
            {source.label}
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[12.5px] font-medium text-text">{source.label}</span>
            <span className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted-2">
              {t("evidence.internalSource")}
            </span>
          </span>
        )}
        <span className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-trust-warn-text">
          {t(sourceBadgeKey(source))}
        </span>
        {source.provider ? (
          <span className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted">
            {source.provider}
          </span>
        ) : null}
      </span>
      {showExcerpt && source.excerpt ? (
        <span className="text-[11.5px] leading-relaxed text-muted">{source.excerpt}</span>
      ) : null}
    </span>
  );
}

// Belegschicht je Aussage: Quelle(n) + Quelldatum + Konfidenz. Konfidenz IMMER als ConfidenceBar mit
// lesbarer %-Sprache (nie nur Rohzahl). Zwei Varianten: „compact" (einzeilig, für Karten) und „full"
// (gestapelt, für Detail). Ohne Quelle: ehrlicher Leerzustand statt leerer Fläche.
export function SourceEvidence({
  sources,
  confidence,
  date,
  variant = "full",
}: {
  sources: readonly KoSource[];
  confidence?: number;
  date?: string | null;
  variant?: "compact" | "full";
}): JSX.Element {
  const { t } = useTranslation();
  const dateText = formatDate(date, i18n.language);
  const dateLabel = dateText ? t("evidence.sourceDate", { date: dateText }) : t("evidence.noDate");
  const hasSources = sources.length > 0;

  if (variant === "compact") {
    // Einzeilig: erste Quelle (+ „+N weitere") · Quelldatum · Konfidenz (Balken + „84 % sicher").
    const first = sources[0];
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        {hasSources && first ? (
          <>
            <SourceLink source={first} />
            {sources.length > 1 ? (
              <span className="font-mono text-[10.5px] text-muted-2">
                {t("evidence.more", { count: sources.length - 1 })}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-2">{t("evidence.noSource")}</span>
        )}
        <span className="text-muted-2">·</span>
        <span className={dateText ? "text-muted" : "text-muted-2"}>{dateLabel}</span>
        {confidence !== undefined ? (
          <>
            <span className="text-muted-2">·</span>
            <ConfidenceBar value={confidence} showLabel={false} percentPhrase />
          </>
        ) : null}
      </div>
    );
  }

  // Vollvariante: gestapelt, mit Auszügen und voller Konfidenzzeile.
  return (
    <div className="space-y-2">
      {hasSources ? (
        <ul className="space-y-1.5">
          {sources.map((s) => (
            <li key={s.id}>
              <SourceLink source={s} showExcerpt />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-muted-2">{t("evidence.noSource")}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`text-[12px] ${dateText ? "text-muted" : "text-muted-2"}`}>
          {dateLabel}
        </span>
        {confidence !== undefined ? <ConfidenceBar value={confidence} percentPhrase /> : null}
      </div>
    </div>
  );
}
