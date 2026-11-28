import { skipToken, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../api/endpoints";
import { useSession } from "../app/AuthContext";
import { formatKoTimestamp } from "../lib/koDates";
import type { notizPruefbezug } from "../lib/objektbezug";
import { useAuthorName } from "../lib/useAuthorName";
import { GespeicherteFassung } from "./GespeicherteFassung";

export function ZitierteQuellansicht({
  koId,
  fassung,
  ankerId,
  zitat,
  notizbezug,
  oeffneAktuellenEintrag,
}: {
  koId: string;
  fassung: number;
  ankerId: string | null;
  zitat: string;
  notizbezug?: ReturnType<typeof notizPruefbezug>;
  oeffneAktuellenEintrag?: () => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const { user, isLoading } = useSession();
  const name = useAuthorName();
  // This endpoint checks the current access and the cited historical version before returning
  // the actor from that version's approval record. The snapshot author is a different person.
  const beleg = useQuery({
    queryKey: ["begleiter-belegfassung", user?.id, koId, fassung],
    queryFn: user ? () => endpoints.ko.belegfassung(koId, fassung) : skipToken,
    retry: false,
    gcTime: 0,
    refetchOnMount: "always",
  });
  if (isLoading || (user && (beleg.isPending || beleg.isFetching))) {
    return <output>{t("quellen.gespeichert.laedt")}</output>;
  }
  if (!user || !beleg.isSuccess || beleg.data.id !== koId || beleg.data.fassung !== fassung) {
    return <output>{t("quellen.gespeichert.fehler")}</output>;
  }
  const aktuell = beleg.data.aktuellBestaetigteFassung;
  const aktuellerEintrag =
    aktuell && aktuell > fassung
      ? t("quellen.fokus.heute", { version: aktuell })
      : t("quellen.fokus.aktuellerEintrag");
  const linkKlasse =
    "mt-4 inline-flex rounded-btn text-sm font-medium text-brand-text underline underline-offset-4";
  const freigabezeit = formatKoTimestamp(beleg.data.freigegebenAm, i18n.language);
  return (
    <section data-testid="quellenfokus" className="mx-auto max-w-3xl py-3">
      {notizbezug && (
        <Link
          className="mb-3 inline-flex rounded-btn text-sm font-semibold text-brand-text underline"
          to={notizbezug.zurAussage}
        >
          {t("quellen.fokus.zurAussage")}
        </Link>
      )}
      <GespeicherteFassung
        koId={koId}
        fassung={fassung}
        ankerId={ankerId}
        zitat={zitat}
        freigabeperson={beleg.data.freigegebenVon ? name(beleg.data.freigegebenVon) : null}
        freigabezeit={freigabezeit}
      />
      {oeffneAktuellenEintrag ? (
        <button
          type="button"
          data-testid="quellenfokus-aktuell"
          className={linkKlasse}
          onClick={oeffneAktuellenEintrag}
        >
          {aktuellerEintrag}
        </button>
      ) : (
        <Link
          to={`/wissen/${encodeURIComponent(koId)}${notizbezug ? `?${notizbezug.anQuelle}` : ""}`}
          data-testid="quellenfokus-aktuell"
          className={linkKlasse}
        >
          {aktuellerEintrag}
        </Link>
      )}
    </section>
  );
}
