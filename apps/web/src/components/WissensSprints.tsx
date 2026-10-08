// ================================================================================================
// R-1657 (ROADMAP 9.3) — WISSENS-SPRINTS: BEGRÜNDETE ARBEITSVORSCHLÄGE JE BEREICH.
// ================================================================================================
//
// Quelle: „Bereich Schweißtechnik: 4 offene Konflikte, 12 Objekte zur Re-Validierung. 2-Tage-Sprint
// vorschlagen?" Die Fläche RECHNET NICHTS: Gründe, Zahlen und Sprintlänge kommen aus dem
// Management-Snapshot (services/management/src/metrics.ts → sprints). Es sind Vorschläge — die
// Fläche legt keinen Sprint und keine Aufgabe an. Texte: texte/wissenssprints.ts.
import { useTranslation } from "react-i18next";
import type { MgmtSprint } from "../api/types";

export function WissensSprints({ sprints }: { sprints: readonly MgmtSprint[] }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="sprints" className="mt-3 border-t border-hairline pt-2">
      <div className="text-[12.5px] font-semibold text-ink">{t("wissenssprints.titel")}</div>
      <p className="text-[11.5px] text-muted-2">{t("wissenssprints.einleitung")}</p>
      {sprints.length === 0 ? (
        <p data-testid="sprints-leer" className="mt-1 text-[12.5px] text-muted">
          {t("wissenssprints.leer")}
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {sprints.map((s) => {
            const bereich = t("wissenssprints.bereich", { bereich: s.category });
            const gruende = s.reasons
              .map((r) => t(`wissenssprints.grund.${r.key}`, { count: r.count }))
              .join(", ");
            return (
              <li
                key={s.category}
                data-testid="sprint"
                data-kategorie={s.category}
                className="rounded-card bg-page px-3 py-2 text-[12.5px] text-text"
              >
                <span className="font-semibold">{bereich}</span>{" "}
                <span data-testid="sprint-gruende">{`${gruende}.`}</span>{" "}
                <span data-testid="sprint-vorschlag" className="font-semibold">
                  {t("wissenssprints.vorschlag", { count: s.days })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
