import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { KnowledgeObject } from "../api/types";
import {
  EINZELQUELLEN_DECKEL,
  einzelquelleErfassenHref,
  meineEinzelquellenThemen,
} from "../lib/meineEinzelquellen";

// R-1626 (ROADMAP 1.4): die kurze persönliche Liste der Themen, deren einziger sichtbarer
// Wissensträger die betrachtende Person ist — mit dem Einstieg ins geführte Interview je Thema.
// Regel und Sichtbarkeitsgrenze: `lib/meineEinzelquellen.ts`. Ohne Thema rendert sie NICHTS — kein
// Leersatz, der eine Aussage über den Bestand machte.
export function MeineEinzelquellen({
  objekte,
  userId,
}: {
  objekte: readonly KnowledgeObject[] | undefined;
  userId: string | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  const themen = meineEinzelquellenThemen(objekte ?? [], userId);
  if (themen.length === 0) {
    return null;
  }
  return (
    <section
      data-testid="meine-einzelquellen"
      aria-label={t("einzelquelle.titel")}
      className="overflow-hidden rounded-[14px] border border-hairline bg-surface px-4 py-3 shadow-tile"
    >
      <div className="text-[11px] uppercase tracking-[0.5px] text-muted-2">
        {t("einzelquelle.titel")}
      </div>
      <p className="mt-1 text-[13px] text-text">
        {t("einzelquelle.satz", { count: themen.length })}
      </p>
      <ul className="mt-2 space-y-1.5">
        {themen.slice(0, EINZELQUELLEN_DECKEL).map((eintrag) => (
          <li
            key={eintrag.thema}
            data-testid="einzelquelle-thema"
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
          >
            <span className="min-w-0 break-words text-[13px] text-muted">
              {t("einzelquelle.zeile", { thema: eintrag.thema })}
            </span>
            <Link
              to={einzelquelleErfassenHref(eintrag.thema)}
              data-testid="einzelquelle-einstieg"
              className="shrink-0 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-text hover:bg-hairline-soft"
            >
              {t("einzelquelle.einstieg")}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
