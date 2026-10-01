// ================================================================================================
// R-0142 (Lauf 5, Bens B7) — DAS IMPORTERGEBNIS AUF DER WISSENSSEITE.
// ================================================================================================
//
// Die Wissensseite ist die EINE zusammenhängende Fläche eines importierten Objekts: Original
// (Volltext), Quellen, Validierung und Widersprüche stehen schon hier. Dieser Block ergänzt den Weg
// zurück in den Import — aus welcher Quellfassung und welchem Lauf das Wissen stammt und was die
// Annahme bewirkt hat. Er ist KEINE zweite Wissensfläche und rendert nicht die gesperrte
// W2-Resultatfläche (`tests/app/w2a-import-run-routes-148.test.ts`, Block 5 hält sie gesperrt).
//
// ANGEZEIGT WIRD NUR, WAS DER SERVER LIEFERT (`GET /admin/import/knowledge/:koId`). Fehlt etwas,
// sagt der Block es; Lücken werden nur genannt, wenn der Server eine Beziehung liefert — heute
// meldet er ehrlich `RELATION_NOT_AVAILABLE`, und genau das steht dann da.
//
// HINTER RECHT UND SCHALTER: nur für die Admin-Rolle angefragt (die Route verlangt `users.manage`
// und existiert nur bei eingeschaltetem Import). Antwortet der Server nicht mit einem Ergebnis
// (404/403/abgeschaltet), erscheint nichts.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { endpoints } from "../../api/endpoints";
import type { ImportKnowledgeResult, KnowledgeObject } from "../../api/types";
import { useRole } from "../../app/RoleContext";
import { formatKoTimestamp } from "../../lib/koDates";

const BEKANNTE_LAUFZUSTAENDE = new Set([
  "QUEUED",
  "FETCHING",
  "PERSISTING_SOURCE",
  "EXTRACTING",
  "CREATING_KNOWLEDGE",
  "ANALYZING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
]);
const BEKANNTE_AUSGAENGE = new Set(["CREATED", "BOUND", "SKIPPED", "FAILED"]);

/** Trägt das Objekt einen Import-Herkunftsanker (Quelle mit Quellstand, kein Anhang)? */
function hatImportAnker(ko: KnowledgeObject): boolean {
  return (ko.sources ?? []).some((s) => s.sourceVersion !== undefined && !s.attachmentOf);
}

export function ImportErgebnis({ ko }: { ko: KnowledgeObject }): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const { role } = useRole();
  const aktiv = role === "admin" && hatImportAnker(ko);
  const abfrage = useQuery<ImportKnowledgeResult>({
    queryKey: ["import-knowledge", ko.id],
    queryFn: () => endpoints.admin.import.knowledgeResult(ko.id),
    enabled: aktiv,
    retry: false,
  });
  const e = abfrage.data;
  if (!aktiv || !e) {
    return null;
  }
  const laufStatus = e.run
    ? BEKANNTE_LAUFZUSTAENDE.has(e.run.status)
      ? t(`w2.run.status.${e.run.status}`)
      : t("w2.run.status.unknown")
    : null;
  const ausgang = e.item
    ? BEKANNTE_AUSGAENGE.has(e.item.itemOutcome)
      ? t(`ko.importResult.outcome.${e.item.itemOutcome}`)
      : t("ko.importResult.outcome.unknown", { wert: e.item.itemOutcome })
    : null;
  return (
    <section
      data-testid="bib-import-ergebnis"
      className="mt-3 space-y-1 border-t border-hairline pt-3 text-[12px]"
    >
      <h4 className="font-semibold text-ink">{t("w2.result.heading")}</h4>
      <p className="text-muted">{t("ko.importResult.lead")}</p>
      {e.source ? (
        <>
          <p data-testid="bib-import-revision">
            {t("ko.importResult.revision", {
              version: e.source.sourceVersion,
              zeit: formatKoTimestamp(e.source.importedAt, i18n.language) ?? e.source.importedAt,
            })}
          </p>
          {e.source.contentReferenceState !== "AVAILABLE" ? (
            <p className="text-muted">{t("ko.importResult.contentNotCaptured")}</p>
          ) : null}
          <p data-testid="bib-import-lauf">
            {laufStatus
              ? t("ko.importResult.run", { status: laufStatus })
              : t("ko.importResult.noRun")}
          </p>
          <p data-testid="bib-import-ausgang">{ausgang ?? t("ko.importResult.noItem")}</p>
        </>
      ) : (
        <p data-testid="bib-import-revision" className="text-muted">
          {t("ko.importResult.noRevision")}
        </p>
      )}
      <p data-testid="bib-import-luecken" className="text-muted">
        {e.knowledgeGapRelationState === "AVAILABLE" && Array.isArray(e.knowledgeGapIds)
          ? t("ko.importResult.gaps", { anzahl: e.knowledgeGapIds.length })
          : t("ko.importResult.gapsNotAvailable")}
      </p>
    </section>
  );
}
