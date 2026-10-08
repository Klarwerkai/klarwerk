import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { Card, SectionLabel } from "./ui";

// R-0773 — „Das System zeigt, wonach gesucht wurde, ohne dass etwas gefunden wurde."
//
// NUR DIE EIGENEN SUCHEN: der Server liefert unter `/api/library/nulltreffer` ausschliesslich die
// Liste der angemeldeten Person (Begründung in services/ask/src/nulltreffer.ts, R-0585). Die Fläche
// sagt das ausdrücklich, damit niemand eine Übersicht über alle Suchen erwartet.
//
// Der Erfassungseinstieg trägt den Suchbegriff NICHT in der Adresse — derselbe Grund wie bei den
// Lücken (`lib/captureFromGap.ts`): Freitext gehört nicht in URL, Verlauf und Protokolle.
//
// Die Abfrage steht bewusst hier und nicht in `api/hooks.ts`: der Abruf ist ein eigener Teil dieser
// einen Fläche. Scheitert er, zeigt die Fläche NICHTS — eine fehlende Auskunft ist keine leere Liste,
// und ein Leersatz würde „keine erfolglosen Suchen" behaupten.
export function EigeneNulltreffer(): JSX.Element | null {
  const { t } = useTranslation();
  const suchen = useQuery({
    queryKey: ["library", "nulltreffer"],
    queryFn: () => endpoints.library.nulltreffer(),
    retry: false,
  });
  const eintraege = Array.isArray(suchen.data) ? suchen.data : [];
  if (eintraege.length === 0) {
    return null;
  }
  return (
    <div data-testid="eigene-nulltreffer">
      <div className="mb-1 flex items-center gap-1.5">
        <SectionLabel>{t("nulltreffer.titel")}</SectionLabel>
      </div>
      <p className="mb-2 text-[12px] text-muted-2">{t("nulltreffer.hinweis")}</p>
      <Card className="p-0">
        <div className="divide-y divide-hairline">
          {eintraege.map((e) => (
            <div
              key={e.begriff}
              data-testid="nulltreffer-zeile"
              className="flex flex-wrap items-center gap-3 px-4 py-2.5"
            >
              <span className="min-w-0 flex-1 break-words text-[13.5px] text-text">
                „{e.begriff}“
              </span>
              <span className="shrink-0 font-mono text-[10.5px] text-muted-2">
                {t("nulltreffer.anzahl", { count: e.anzahl })}
              </span>
              <Link
                to="/erfassen"
                className="inline-flex shrink-0 items-center rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-text hover:bg-hairline-soft"
              >
                {t("nulltreffer.erfassen")}
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
