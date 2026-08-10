// ================================================================================================
// AUFTRAG-BASIC-W2-RESULTAT-VIEW-KERN-23 — DAS WISSEN, ALS EIGENE OBJEKTE.
// ================================================================================================
//
// Der zweite von zwei Blöcken. Eine Quelle kann `n` Wissenseinheiten tragen (Auftrag §2) — genau
// das ist die Botschaft der Welle, und deshalb ist dies eine LISTE und keine Zusammenfassung.
//
// `<ol>`, nicht `<ul>`: die Reihenfolge ist bedeutungstragend. Sie kommt serverseitig aus
// `extractionOrder` und wird hier NICHT nachsortiert (Auftrag §7) — die gelieferte Folge ist die
// gezeigte Folge.
//
// Fundstelle, Validierungsstatus, Konflikte und Lücken werden GELESEN. Nichts davon wird berechnet,
// geschätzt oder ergänzt. Fehlt die Fundstelle, steht das ausdrücklich da (Auftrag §4) — eine Zeile
// ohne Hinweis sähe aus wie eine belegte Aussage.
import { useTranslation } from "react-i18next";
import type { KnowledgeBlockView } from "../../lib/importResultView";
import { Card, SectionLabel } from "../ui";

export interface KnowledgeItemListProps {
  knowledge: KnowledgeBlockView;
}

export function KnowledgeItemList({ knowledge }: KnowledgeItemListProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="w2-knowledge-heading" data-testid="w2-knowledge">
      <Card interactive={false}>
        <SectionLabel>
          <span id="w2-knowledge-heading">{t("w2.knowledge.heading")}</span>
        </SectionLabel>
        <p className="mb-1 text-[12.5px] text-muted">{t("w2.knowledge.lead")}</p>
        <p data-testid="w2-knowledge-count" className="mb-3 text-[12.5px] font-medium text-text">
          {t("w2.knowledge.count", { count: knowledge.count })}
        </p>
        {knowledge.empty ? (
          // „Leer" ist NICHT „erfolgreich". Der Satz sagt beides.
          <p data-testid="w2-knowledge-empty" className="text-sm text-trust-warn-text">
            {t(knowledge.emptyKey ?? "w2.knowledge.empty")}
          </p>
        ) : (
          <ol data-testid="w2-knowledge-list" className="flex list-none flex-col gap-3 p-0">
            {knowledge.items.map((item) => (
              <li
                key={item.key}
                data-testid="w2-knowledge-item"
                data-position={String(item.position)}
                className="rounded-card border border-hairline p-3"
              >
                <p className="mb-1 font-mono text-micro uppercase tracking-wider text-muted-2">
                  {t("w2.item.position", { position: item.position })}
                </p>
                {item.statement === null ? (
                  <p
                    data-testid="w2-item-statement-missing"
                    className="text-sm italic text-trust-warn-text"
                  >
                    {t(item.statementMissingKey ?? "w2.item.statementMissing")}
                  </p>
                ) : (
                  <p data-testid="w2-item-statement" className="break-words text-sm text-text">
                    {item.statement}
                  </p>
                )}
                <dl className="mt-2 flex flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="text-[12.5px] font-medium text-muted">{t("w2.item.locator")}</dt>
                    <dd
                      data-testid="w2-item-locator"
                      data-missing={String(item.locator === null)}
                      className="break-words text-[12.5px] text-text"
                    >
                      {item.locator === null ? (
                        <span className="italic text-trust-warn-text">
                          {t(item.locatorMissingKey ?? "w2.item.locatorMissing")}
                        </span>
                      ) : (
                        item.locator
                      )}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="text-[12.5px] font-medium text-muted">{t("w2.item.status")}</dt>
                    <dd
                      data-testid="w2-item-status"
                      data-missing={String(item.validationStatus === null)}
                      className="break-words text-[12.5px] text-text"
                    >
                      {item.validationStatus === null ? (
                        <span className="italic text-trust-warn-text">
                          {t(item.validationMissingKey ?? "w2.item.statusMissing")}
                        </span>
                      ) : (
                        // WÖRTLICH der gelieferte Wert. Kein Umdeuten in eine eigene Statuswelt.
                        item.validationStatus
                      )}
                    </dd>
                  </div>
                </dl>
                {/* Konflikte und Lücken sind GEZÄHLTE gelieferte IDs — nie erkannte Sachverhalte.
                    Null Konflikte heisst „keine gemeldet", nicht „keine vorhanden". */}
                <p
                  data-testid="w2-item-conflicts"
                  data-count={String(item.conflictCount)}
                  className={
                    item.conflictCount > 0
                      ? "mt-2 text-[12.5px] text-trust-warn-text"
                      : "mt-2 text-[12.5px] text-muted"
                  }
                >
                  {item.conflictCount > 0
                    ? t("w2.item.conflicts", { count: item.conflictCount })
                    : t("w2.item.conflictsNone")}
                </p>
                <p
                  data-testid="w2-item-gaps"
                  data-count={String(item.gapCount)}
                  className="text-[12.5px] text-muted"
                >
                  {item.gapCount > 0
                    ? t("w2.item.gaps", { count: item.gapCount })
                    : t("w2.item.gapsNone")}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </section>
  );
}
