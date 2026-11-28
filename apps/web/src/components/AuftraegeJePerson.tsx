import { useTranslation } from "react-i18next";
import type { PruefdauerAuswertung, ZuweisungsWeg } from "../api/types";
import { Card, SectionLabel } from "./ui";

const WEGE: readonly ZuweisungsWeg[] = ["automatisch", "manuell", "einreichen"];

// R-1655: „Validierungszeiten sinken messbar" — die Prüfdauer je Zuweisungsweg nebeneinander.
// Ob das Routing wirkt, zeigt der Vergleich der Zeile „automatisch" mit den übrigen; ohne
// erledigte Zuweisung steht dort ausdrücklich „noch keine Messung", keine Null.
export function PruefdauerJeWeg({
  auswertung,
}: {
  auswertung: PruefdauerAuswertung;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <Card>
      <SectionLabel>{t("prueferzuweisung.dauer.titel")}</SectionLabel>
      <table className="w-full text-[13px]" data-testid="pruefdauer-je-weg">
        <thead>
          <tr className="text-left font-mono text-micro uppercase tracking-wider text-muted-2">
            <th className="py-1 font-normal">{t("prueferzuweisung.dauer.weg")}</th>
            <th className="py-1 text-right font-normal">{t("prueferzuweisung.dauer.median")}</th>
            <th className="py-1 text-right font-normal">{t("prueferzuweisung.dauer.erledigt")}</th>
            <th className="py-1 text-right font-normal">{t("prueferzuweisung.dauer.offen")}</th>
          </tr>
        </thead>
        <tbody>
          {WEGE.map((weg) => {
            const z = auswertung[weg];
            return (
              <tr key={weg} className="border-t border-hairline">
                <td className="py-1.5 text-text">{t(`prueferzuweisung.dauer.weg.${weg}`)}</td>
                <td className="py-1.5 text-right font-mono text-ink">
                  {z.medianStunden === null
                    ? t("prueferzuweisung.dauer.keine")
                    : t("prueferzuweisung.dauer.stunden", { n: z.medianStunden })}
                </td>
                <td className="py-1.5 text-right font-mono text-muted">{z.erledigt}</td>
                <td className="py-1.5 text-right font-mono text-muted">{z.offen}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// R-0756 / FR-VAL-06: hier stand `AuftraegeJePerson`, eine zweite Tabelle der Prüfaufträge je
// Person. Gesamtcheck R-1329 (Aufrufer-Wächter): entfernt, weil überholt — die Auswertung zeigt die
// Zahlen „in der EINEN Darstellung `PersonenZeilen`“ (`pages/Analytics.tsx`, „hier keine zweite
// Tabelle“), der Adminbereich nutzt die Ableitung `auftraegeJePerson` unmittelbar
// (`pages/Admin.tsx`). Gemessen werden beide Orte in
// `tests/analytics/kennzahlen-uebersicht-mounted.test.tsx` und
// `tests/analytics/kapital-pruefaufgaben-mounted.test.tsx`.
