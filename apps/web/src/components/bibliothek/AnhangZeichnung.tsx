import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ZeichnungNichtDarstellbar,
  type ZeichnungsAnhang,
  ladeAnhangsZeichnung,
} from "../../lib/zeichnungsanhang";
import type { Zeichnungspunkt } from "../../lib/zeichnungspunkt";
import { Zeichnung } from "./Zeichnung";

// ==================================================================================================
// PLAN-SPRACHANMERKUNG (R-1625, R-2177) · NACHARBEIT 2 — EINE HOCHGELADENE ZEICHNUNG MIT MARKE.
// ==================================================================================================
//
// Holt die Zeichnung eines Anhangs (PDF-Seite, DXF, Bild; `lib/zeichnungsanhang.ts`) und reicht sie
// an DIESELBE `Zeichnung` weiter, die auch Bilder im Text trägt — Tipp, Marke und Tastaturweg sind
// ein Bauteil, nicht zwei. Bei mehrseitigen PDFs blättert die Fläche; die Seite gehört zur Notiz.
//
// KANN DIE DATEI NICHT GEZEICHNET WERDEN (DWG, leer, nicht ladbar), steht der Grund mit dem
// nächsten Schritt da — und KEINE Zeichnung, auf die sich eine Marke setzen liesse.

const knopfCls =
  "rounded-btn border border-hairline px-2 py-0.5 text-[12px] font-semibold text-muted hover:text-text disabled:cursor-default disabled:text-muted-2";

export function AnhangZeichnung({
  anhang,
  seite,
  onSeite,
  punkt,
  onPunkt,
  beschriftung,
}: {
  anhang: ZeichnungsAnhang;
  seite: number;
  onSeite?: ((n: number) => void) | undefined;
  punkt?: Zeichnungspunkt | undefined;
  onPunkt?: ((p: Zeichnungspunkt) => void) | undefined;
  beschriftung: string;
}): JSX.Element {
  const { t } = useTranslation();
  const zeichnung = useQuery({
    queryKey: ["anhangszeichnung", anhang.objectId, seite],
    queryFn: () => ladeAnhangsZeichnung(anhang, seite),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  if (zeichnung.isPending) {
    return (
      <p data-bib-anhangszeichnung-lade="" className="text-[12px] text-muted">
        {t("state.loading")}
      </p>
    );
  }
  if (zeichnung.isError) {
    const grund =
      zeichnung.error instanceof ZeichnungNichtDarstellbar ? zeichnung.error.grund : "laden";
    return (
      <p data-bib-anhangszeichnung-fehler={grund} className="text-[12px] text-trust-crit-text">
        {t(`stellenbezug.anhang.fehler.${grund}`)}
      </p>
    );
  }
  const daten = zeichnung.data;
  return (
    <div data-bib-anhangszeichnung={anhang.objectId} className="space-y-1">
      {daten.seiten > 1 ? (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
          {onSeite ? (
            <button
              type="button"
              data-bib-anhangszeichnung-zurueck=""
              disabled={daten.seite <= 1}
              onClick={() => onSeite(daten.seite - 1)}
              className={knopfCls}
            >
              {t("stellenbezug.anhang.seiteZurueck")}
            </button>
          ) : null}
          <span data-bib-anhangszeichnung-seite={`${daten.seite}/${daten.seiten}`}>
            {t("stellenbezug.anhang.seiteVon", { seite: daten.seite, seiten: daten.seiten })}
          </span>
          {onSeite ? (
            <button
              type="button"
              data-bib-anhangszeichnung-weiter=""
              disabled={daten.seite >= daten.seiten}
              onClick={() => onSeite(daten.seite + 1)}
              className={knopfCls}
            >
              {t("stellenbezug.anhang.seiteWeiter")}
            </button>
          ) : null}
        </div>
      ) : null}
      {daten.ausgelassen > 0 ? (
        <p
          data-bib-anhangszeichnung-ausgelassen={daten.ausgelassen}
          className="text-[12px] text-muted"
        >
          {t("stellenbezug.anhang.ausgelassen", { anzahl: daten.ausgelassen })}
        </p>
      ) : null}
      <Zeichnung src={daten.src} punkt={punkt} onPunkt={onPunkt} beschriftung={beschriftung} />
    </div>
  );
}
