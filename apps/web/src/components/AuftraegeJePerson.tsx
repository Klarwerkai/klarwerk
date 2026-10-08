import { useTranslation } from "react-i18next";
import type { AssignmentSummary } from "../api/types";
import { auftraegeJePerson } from "../lib/auftraegeJePerson";
import { Card, SectionLabel } from "./ui";

// R-0756 / FR-VAL-06: offene und erledigte Prüfaufträge je Person in der Auswertung. Die Zahlen
// liefert `GET /api/validation/overview` unverändert; die Ordnung steht in `auftraegeJePerson`.
export function AuftraegeJePerson({
  summaries,
  personen,
}: {
  summaries: readonly AssignmentSummary[];
  personen: readonly { id: string; name: string }[];
}): JSX.Element {
  const { t } = useTranslation();
  const zeilen = auftraegeJePerson(summaries, personen);
  return (
    <Card>
      <SectionLabel>{t("prueferzuweisung.person.titel")}</SectionLabel>
      {zeilen.length === 0 ? (
        <div className="text-[13px] text-muted-2">{t("prueferzuweisung.person.leer")}</div>
      ) : (
        <table className="w-full text-[13px]" data-testid="auftraege-je-person">
          <thead>
            <tr className="text-left font-mono text-micro uppercase tracking-wider text-muted-2">
              <th className="py-1 font-normal">{t("prueferzuweisung.person.person")}</th>
              <th className="py-1 text-right font-normal">{t("prueferzuweisung.person.offen")}</th>
              <th className="py-1 text-right font-normal">
                {t("prueferzuweisung.person.erledigt")}
              </th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.userId} className="border-t border-hairline">
                <td className="py-1.5 text-text">
                  {z.name ?? t("prueferzuweisung.person.unbekannt")}
                </td>
                <td className="py-1.5 text-right font-mono text-ink">{z.open}</td>
                <td className="py-1.5 text-right font-mono text-muted">{z.done}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
