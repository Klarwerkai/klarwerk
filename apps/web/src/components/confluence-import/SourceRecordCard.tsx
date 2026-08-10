// ================================================================================================
// AUFTRAG-BASIC-W2-RESULTAT-VIEW-KERN-23 — DAS ORIGINAL, ALS EIGENES OBJEKT.
// ================================================================================================
//
// Dies ist der eine von zwei Blöcken. Er zeigt das DOKUMENT — die konkrete, unveränderliche
// Revision, aus der Wissen entstanden ist. Er ist bewusst ein eigener `<section>` mit eigener
// Überschrift und eigenem Rahmen: die sichtbare Botschaft der ganzen Welle ist „Dokument ≠ Wissen"
// (`KW-W2-17`), und die trägt nur eine Trennung, die man sehen kann.
//
// Jede Angabe kommt WÖRTLICH aus den Props. Fehlt eine Pflichtangabe, steht das als Text da
// (Auftrag §3) — ein weggelassenes Feld sähe aus wie ein vollständiges Original.
import { useTranslation } from "react-i18next";
import type { SourceBlockView } from "../../lib/importResultView";
import { ExternalUrlText } from "../ExternalUrlText";
import { Card, SectionLabel } from "../ui";

export interface SourceRecordCardProps {
  source: SourceBlockView;
}

export function SourceRecordCard({ source }: SourceRecordCardProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="w2-source-heading" data-testid="w2-source">
      <Card interactive={false}>
        <SectionLabel>
          <span id="w2-source-heading">{t("w2.source.heading")}</span>
        </SectionLabel>
        <p className="mb-3 text-[12.5px] text-muted">{t("w2.source.lead")}</p>
        {!source.present ? (
          // Keine Quelle geliefert. Das ist ein Befund, kein leerer Bereich.
          <p data-testid="w2-source-missing" className="text-sm text-trust-warn-text">
            {t("w2.source.missing")}
          </p>
        ) : (
          <>
            {source.missingRequiredCount > 0 ? (
              <p
                data-testid="w2-source-missing-required"
                className="mb-3 rounded-card bg-trust-warn-bg p-2 text-[12.5px] text-trust-warn-text"
              >
                {t("w2.source.missingRequired")}
              </p>
            ) : null}
            {/* Beschreibungsliste statt Tabelle: sie bricht auf schmalen Taskpanes/Fenstern um,
                ohne dass etwas abgeschnitten wird oder seitlich scrollt. */}
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
              {source.fields.map((feld) => (
                <div key={feld.labelKey} className="contents">
                  <dt className="text-[12.5px] font-medium text-muted">{t(feld.labelKey)}</dt>
                  <dd
                    data-testid={`w2-source-field-${feld.labelKey}`}
                    data-missing={String(feld.value === null)}
                    className="break-words text-sm text-text"
                  >
                    {feld.value === null ? (
                      <span className="italic text-trust-warn-text">
                        {t(feld.missingKey ?? "w2.value.missing")}
                      </span>
                    ) : feld.kind === "url" ? (
                      // Die vorhandene gehaertete Anzeige: unsichere Schemata werden zu reinem
                      // Text neutralisiert (SCRUM-527). Keine zweite Auslegung von „externer Link".
                      <ExternalUrlText url={feld.value} className="break-all underline" />
                    ) : (
                      feld.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Card>
    </section>
  );
}
