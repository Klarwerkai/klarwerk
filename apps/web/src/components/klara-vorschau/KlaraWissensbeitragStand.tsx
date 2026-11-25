import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { klaraWissenApi } from "../../api/klaraWissen";
import { useAssistenzT } from "../../lib/assistenzProfil";

import { reworkHref } from "../../lib/reviewReworkContext";
import { KlaraRegelstaende } from "./KlaraRegelvorschlag";

export function KlaraWissensbeitragStand({
  konto,
  id,
  fassung,
  ergebnisId,
}: { konto: string; id: string; fassung: number; ergebnisId?: string | undefined }) {
  const { t } = useAssistenzT();
  const stand = useQuery({
    queryKey: ["klara-beitragsstand", konto, id, fassung, ergebnisId ?? null],
    queryFn: () => klaraWissenApi.beitragsstand(id),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: "always",
  });
  if (stand.isFetching) return null;
  if (stand.isError) {
    return (
      <output className="mt-2 block text-sm">
        {t("klarawissen.beitragsstand.fehler")}{" "}
        <button type="button" className="underline" onClick={() => void stand.refetch()}>
          {t("klarawissen.beitragsstand.erneut")}
        </button>
      </output>
    );
  }
  if (!stand.data || (!stand.data.beitraege.length && !stand.data.regelvorschlaege.length))
    return null;
  return (
    <div
      data-testid="wissen-ergebnis"
      className="mt-3 space-y-1 rounded-input border border-hairline p-3 text-sm"
    >
      <h4 className="font-semibold">{t("klarawissen.beitragsstand.titel")}</h4>
      <ul className="space-y-2">
        {stand.data.beitraege.map((beitrag) => (
          <li key={beitrag.notizFassung}>
            <span className="text-xs text-muted">
              {t("klarawissen.beitragsstand.notizFassung", { fassung: beitrag.notizFassung })}
            </span>
            <p>{t(`klarawissen.beitragsstand.${beitrag.stand}`)}</p>
            {beitrag.stand !== "nicht_verfuegbar" && (
              <Link
                className="underline"
                to={
                  beitrag.stand === "abgelehnt" || beitrag.stand === "rueckfrage"
                    ? reworkHref(encodeURIComponent(beitrag.id))
                    : `/wissen/${encodeURIComponent(beitrag.id)}`
                }
              >
                {t("klarawissen.beitragsstand.oeffnen", { version: beitrag.version })}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <KlaraRegelstaende staende={stand.data.regelvorschlaege} />
    </div>
  );
}
