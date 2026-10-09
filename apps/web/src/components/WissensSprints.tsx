// ================================================================================================
// R-1657 (ROADMAP 9.3) — WISSENS-SPRINTS: BEGRÜNDETE ARBEITSVORSCHLÄGE JE BEREICH.
// ================================================================================================
//
// Quelle: „Bereich Schweißtechnik: 4 offene Konflikte, 12 Objekte zur Re-Validierung. 2-Tage-Sprint
// vorschlagen?" Die Fläche RECHNET NICHTS: Gründe, Zahlen und Sprintlänge kommen aus dem
// Management-Snapshot (services/management/src/metrics.ts → sprints). Es sind Vorschläge — die
// Fläche legt keinen Sprint und keine Aufgabe an. Texte: texte/wissenssprints.ts.
//
// Nacharbeit 2: jeder Vorschlag sagt, WER ihn trägt — das Reasoner-Urteil oder die benannte Regel —,
// und eine Zeile nennt den Stand der regelmäßigen Reasoner-Analyse für die eigene Sicht.
import { useTranslation } from "react-i18next";
import type { MgmtSprint, MgmtSprintAnalysis } from "../api/types";

const BEKANNTE_URSACHEN = new Set(["no-model", "confidential", "model-timeout", "model-error"]);

function Analysestand({ analyse }: { analyse: MgmtSprintAnalysis }): JSX.Element {
  const { t, i18n } = useTranslation();
  const zeit = analyse.analyzedAt
    ? new Date(analyse.analyzedAt).toLocaleString(i18n.language)
    : null;
  let text: string;
  if (analyse.failure) {
    const ursache = BEKANNTE_URSACHEN.has(analyse.failure) ? analyse.failure : "model-error";
    text = t("wissenssprints.analyse.ohneUrteil", {
      grund: t(`wissenssprints.ursache.${ursache}`),
    });
  } else if (analyse.provider && zeit) {
    text = t("wissenssprints.analyse.reasoner", { anbieter: analyse.provider, zeit });
  } else if (zeit) {
    text = t("wissenssprints.analyse.geprueft", { zeit });
  } else {
    text = t(analyse.regular ? "wissenssprints.analyse.ausstehend" : "wissenssprints.analyse.aus");
  }
  return (
    <p data-testid="sprints-analyse" className="mt-1 text-[11.5px] text-muted">
      {text}
    </p>
  );
}

export function WissensSprints({
  sprints,
  analyse,
}: {
  sprints: readonly MgmtSprint[];
  analyse?: MgmtSprintAnalysis | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="sprints" className="mt-3 border-t border-hairline pt-2">
      <div className="text-[12.5px] font-semibold text-ink">{t("wissenssprints.titel")}</div>
      <p className="text-[11.5px] text-muted-2">{t("wissenssprints.einleitung")}</p>
      {analyse ? <Analysestand analyse={analyse} /> : null}
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
                data-quelle={s.source}
                className="rounded-card bg-page px-3 py-2 text-[12.5px] text-text"
              >
                <span data-testid="sprint-satz">
                  <span className="font-semibold">{bereich}</span>{" "}
                  <span data-testid="sprint-gruende">{`${gruende}.`}</span>{" "}
                  <span data-testid="sprint-vorschlag" className="font-semibold">
                    {t("wissenssprints.vorschlag", { count: s.days })}
                  </span>
                </span>
                {s.source ? (
                  <span
                    data-testid="sprint-quelle"
                    className="ml-2 rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] uppercase text-muted-2"
                  >
                    {t(`wissenssprints.quelle.${s.source}`)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
