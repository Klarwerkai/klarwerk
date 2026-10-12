import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatKoTimestamp } from "../../lib/koDates";
import { Button } from "../ui";
import {
  type Wissensauskunft,
  fehlerGrund,
  feldwertAus,
  wissensauskunftApi,
  zeitpunktAusFeld,
} from "./api";

// ================================================================================================
// WISSENSAUSKUNFT ZUM ZEITPUNKT · die Fläche im Abschnitt „Mehr" (R-1644).
// ================================================================================================
//
// Ein Zeitpunkt, ein Knopf, eine Antwort. Abgefragt wird ERST auf den Klick — das Aufklappen des
// Abschnitts holt nichts. Die Fläche liest nur; die Antwort nennt immer auch ihre Grenzen.
// Sichtbar nur mit Prüferecht (`ko.validate`, Controller/Admin) — entschieden wird am Server.

function fehlerText(t: TFunction, fehler: unknown): string {
  const grund = fehlerGrund(fehler);
  return grund === "zeitpunkt_ungueltig" || grund === "zeitpunkt_zukunft"
    ? t(`wissensauskunft.fehler.${grund}`)
    : t("wissensauskunft.fehler.allgemein");
}

function Antwort({ auskunft }: { auskunft: Wissensauskunft }): JSX.Element {
  const { t, i18n } = useTranslation();
  const datum = (iso: string): string => formatKoTimestamp(iso, i18n.language) ?? "—";
  const { fassung, freigabe } = auskunft;
  return (
    <div data-testid="wissensauskunft-antwort" className="space-y-2">
      <p className="font-semibold text-text">
        {t("wissensauskunft.stand", { datum: datum(auskunft.zeitpunkt) })}
      </p>
      {auskunft.vorhanden ? null : (
        <p data-testid="wissensauskunft-nicht-vorhanden" className="text-muted">
          {t("wissensauskunft.nichtVorhanden")}
        </p>
      )}
      {auskunft.imPapierkorb ? (
        <p className="text-trust-warn-text">{t("wissensauskunft.papierkorb")}</p>
      ) : null}
      {auskunft.vorhanden ? (
        fassung ? (
          <div data-testid="wissensauskunft-fassung" className="rounded-input bg-page p-2">
            <p className="text-text">
              {t("wissensauskunft.fassung", {
                version: fassung.version,
                datum: datum(fassung.seit),
                name: fassung.von.name || fassung.von.id,
              })}
            </p>
            <p className="mt-1 font-semibold text-text">{fassung.titel}</p>
            <p className="text-muted">{fassung.aussage}</p>
            <p data-testid="wissensauskunft-freigabe" className="mt-1 text-muted">
              {freigabe
                ? t("wissensauskunft.freigabe", {
                    datum: datum(freigabe.am),
                    name: freigabe.von.name || freigabe.von.id,
                  })
                : t("wissensauskunft.keineFreigabe")}
            </p>
            {auskunft.aktuelleFassung !== fassung.version ? (
              <p className="mt-1 text-muted">
                {t("wissensauskunft.heute", { version: auskunft.aktuelleFassung })}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted">{t("wissensauskunft.keineFassung")}</p>
        )
      ) : null}
      <div>
        <p className="font-mono text-micro uppercase tracking-wider text-muted-2">
          {t("wissensauskunft.personen")}
        </p>
        {auskunft.personen.length === 0 ? (
          <p className="text-muted">{t("wissensauskunft.keinePersonen")}</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {auskunft.personen.map((p) => (
              <li key={p.id} data-testid="wissensauskunft-person" data-person={p.id}>
                <span className="font-semibold text-text">{p.name || p.id}</span>
                <ul className="ml-3 text-[11.5px] text-muted">
                  {p.belege.map((b) => (
                    <li
                      key={`${b.art}:${b.am}:${b.seq ?? ""}`}
                      data-testid="wissensauskunft-beleg"
                      data-art={b.art}
                      data-zurueckgenommen={b.zurueckgenommen ? "ja" : undefined}
                    >
                      {t(`wissensauskunft.art.${b.art}`)}
                      {b.fassung === null
                        ? ""
                        : ` · ${t("wissensauskunft.beleg.fassung", { fassung: b.fassung })}`}
                      {` · ${datum(b.am)}`}
                      {b.zurueckgenommen ? ` · ${t("wissensauskunft.beleg.zurueckgenommen")}` : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div data-testid="wissensauskunft-grenzen">
        <p className="font-mono text-micro uppercase tracking-wider text-muted-2">
          {t("wissensauskunft.grenzen")}
        </p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] text-muted">
          {auskunft.nichtErfasst.map((g) => (
            <li key={g}>{t(`wissensauskunft.grenze.${g}`)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function WissensauskunftBereich({ koId }: { koId: string }): JSX.Element {
  const { t } = useTranslation();
  const [feld, setFeld] = useState(() => feldwertAus(new Date()));
  const [zeitpunkt, setZeitpunkt] = useState<string | null>(null);
  const [eingabeFehler, setEingabeFehler] = useState(false);
  const auskunft = useQuery({
    queryKey: ["wissensauskunft", koId, zeitpunkt],
    queryFn: () => wissensauskunftApi.abfragen(koId, zeitpunkt as string),
    enabled: zeitpunkt !== null,
    retry: false,
  });
  return (
    <div data-testid="wissensauskunft-bereich" className="space-y-3">
      <p className="text-[12px] text-muted">{t("wissensauskunft.einleitung")}</p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(ereignis) => {
          ereignis.preventDefault();
          const iso = zeitpunktAusFeld(feld);
          setEingabeFehler(iso === null);
          if (iso !== null) {
            setZeitpunkt(iso);
          }
        }}
      >
        <label className="flex flex-col gap-1 text-[12.5px] text-muted">
          {t("wissensauskunft.zeitpunkt")}
          <input
            type="datetime-local"
            data-testid="wissensauskunft-zeitpunkt"
            value={feld}
            onChange={(ereignis) => setFeld(ereignis.target.value)}
            className="rounded-btn border border-hairline px-2 py-1 text-[13px] text-text"
          />
        </label>
        <Button type="submit" data-testid="wissensauskunft-abfragen" disabled={auskunft.isFetching}>
          {auskunft.isFetching ? t("wissensauskunft.laeuft") : t("wissensauskunft.abfragen")}
        </Button>
      </form>
      {eingabeFehler ? (
        <p role="alert" className="text-[12.5px] text-trust-warn-text">
          {t("wissensauskunft.fehler.zeitpunkt_ungueltig")}
        </p>
      ) : null}
      {auskunft.isError ? (
        <p role="alert" className="text-[12.5px] text-trust-warn-text">
          {fehlerText(t, auskunft.error)}
        </p>
      ) : null}
      {auskunft.data && !auskunft.isError ? <Antwort auskunft={auskunft.data} /> : null}
    </div>
  );
}
