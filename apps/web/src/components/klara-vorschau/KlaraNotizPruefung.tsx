import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { type NotizModell, type NotizQuellenpruefung, klaraWissenApi } from "../../api/klaraWissen";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { zitatFragment } from "../../lib/belegstelle";
import { gespeicherteFassungHref } from "../../lib/objektbezug";
import { Referenzpruefung, auszuegeAus } from "../fragen/Referenzpruefung";

function stufe(rolle: NotizQuellenpruefung["ergebnis"]["rollen"]["pruefer"]) {
  return typeof rolle === "object" ? (rolle?.stufe ?? null) : rolle;
}

export function KlaraNotizPruefung({
  id,
  fassung,
  konto,
}: { id: string; fassung: number; konto: string }) {
  const { t, i18n } = useAssistenzT();
  const [params] = useSearchParams();
  const notizImLink = params.get("notiz") === id;
  const laufImLink = notizImLink ? params.get("pruefstand") : null;
  const aussageImLink = notizImLink ? params.get("aussage") : null;
  const [wahl, setWahl] = useState<string | null | undefined>(undefined);
  const lauf = wahl === undefined ? laufImLink : wahl;
  const bereich = useRef<HTMLDivElement>(null);
  const fokussiert = useRef<string>();
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const client = useQueryClient();
  const basisKey = ["klara-notiz-pruefstand", konto, id, fassung];
  const gespeichert = useQuery({
    queryKey: [...basisKey, lauf ?? "letzter"],
    queryFn: () => klaraWissenApi.pruefstand(id, lauf ?? undefined),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const pruefung =
    gespeichert.isFetching || gespeichert.isError || fehler === "unverfuegbar"
      ? null
      : gespeichert.data?.pruefung;
  const standId = pruefung?.ergebnis.pruefId;
  useEffect(() => {
    if (!aussageImLink || !laufImLink || standId !== laufImLink) return;
    const ziel = `${standId}:${aussageImLink}`;
    if (fokussiert.current === ziel) return;
    const aussage = Array.from(
      bereich.current?.querySelectorAll<HTMLElement>("[data-aussage-id]") ?? [],
    ).find((e) => e.dataset.aussageId === aussageImLink);
    if (aussage) {
      aussage.focus();
      fokussiert.current = ziel;
    }
  }, [aussageImLink, laufImLink, standId]);
  const pruefen = async () => {
    setFehler("");
    setLaeuft(true);
    try {
      const antwort = await klaraWissenApi.pruefen(id, fassung);
      if (antwort.fassung !== fassung) setFehler("neueFassung");
      else {
        await client.cancelQueries({ queryKey: basisKey });
        client.setQueryData([...basisKey, "letzter"], { pruefung: antwort });
        setWahl(null);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setFehler("fassungGeaendert");
      else
        setFehler(
          e instanceof ApiError && [403, 404].includes(e.status) ? "unverfuegbar" : "fehler",
        );
    } finally {
      setLaeuft(false);
    }
  };
  const beschriftung = (rolle: NotizModell | NonNullable<ReturnType<typeof stufe>>) =>
    typeof rolle === "object" && rolle.modell
      ? rolle.modell
      : t(`referenzpruefung.stufe.${stufe(rolle)}`);
  const ergebnis = pruefung?.ergebnis;
  const passagen = auszuegeAus(pruefung?.beleg);
  const anzahl = new Map<string, number>();
  for (const a of ergebnis?.aussagen ?? []) anzahl.set(a.zustand, (anzahl.get(a.zustand) ?? 0) + 1);
  return (
    <div ref={bereich} className="my-2 space-y-2" aria-busy={laeuft || gespeichert.isFetching}>
      {gespeichert.isFetching && (
        <output className="text-xs text-muted">{t("klarawissen.modellpruefung.laden")}</output>
      )}
      {gespeichert.isError && (
        <p role="alert">
          {t(
            `klarawissen.modellpruefung.${gespeichert.error instanceof ApiError && [403, 404].includes(gespeichert.error.status) ? "unverfuegbar" : "fehler"}`,
          )}
        </p>
      )}
      <button
        type="button"
        className="rounded-btn border border-hairline px-3 py-1 text-sm disabled:opacity-50"
        data-testid="wissen-pruefen"
        disabled={laeuft || gespeichert.isFetching}
        onClick={() => void pruefen()}
      >
        {t(
          laeuft
            ? "klarawissen.modellpruefung.laeuft"
            : pruefung
              ? "klarawissen.modellpruefung.erneut"
              : "klarawissen.pruefen",
        )}
      </button>
      {fehler && <p role="alert">{t(`klarawissen.modellpruefung.${fehler}`)}</p>}
      {pruefung && ergebnis && (
        <>
          {pruefung.geprueftAm && (
            <div className="space-y-1" data-testid="notiz-pruefstand">
              <p className="text-sm font-semibold">
                {t("klarawissen.modellpruefung.gespeichert", {
                  zeit: new Intl.DateTimeFormat(i18n.language, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(pruefung.geprueftAm)),
                  fassung: pruefung.fassung,
                })}
              </p>
              {pruefung.fassung !== fassung && (
                <p className="text-xs text-muted">
                  {t("klarawissen.modellpruefung.aelter", { fassung })}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {[
                  ["vorheriger", pruefung.vorheriger],
                  ["naechster", pruefung.naechster],
                ].map(
                  ([richtung, ziel]) =>
                    ziel && (
                      <button
                        key={richtung}
                        type="button"
                        disabled={laeuft}
                        className="text-sm text-accent underline"
                        onClick={() => {
                          setFehler("");
                          setWahl(ziel);
                        }}
                      >
                        {t(`klarawissen.modellpruefung.${richtung}`)}
                      </button>
                    ),
                )}
              </div>
            </div>
          )}
          {anzahl.size > 1 && (
            <p className="text-sm font-semibold" data-testid="notiz-urteile">
              {Array.from(
                anzahl,
                ([zustand, n]) => `${n} ${t(`referenzpruefung.zustand.${zustand}`)}`,
              ).join(" · ")}
            </p>
          )}
          {pruefung.modellherkunft && (
            <dl className="space-y-1 text-xs" data-testid="notiz-modellherkunft">
              <div>
                <dt className="font-semibold">{t("klarawissen.modellpruefung.ursprung")}</dt>
                <dd>{beschriftung(pruefung.modellherkunft)}</dd>
              </div>
              {ergebnis.status === "geprueft" && ergebnis.rollen.pruefer && (
                <div>
                  <dt className="font-semibold">{t("klarawissen.modellpruefung.pruefer")}</dt>
                  <dd>{beschriftung(ergebnis.rollen.pruefer)}</dd>
                </div>
              )}
            </dl>
          )}
          <Referenzpruefung
            ergebnis={{
              ...ergebnis,
              rollen: {
                antwort: stufe(ergebnis.rollen.antwort),
                pruefer: stufe(ergebnis.rollen.pruefer),
              },
            }}
            aussageTexte={new Map(pruefung.beleg.aussagen.map((a) => [a.aussageId, a.text]))}
            antwortFingerabdruck={pruefung.beleg.antwortFingerabdruck}
            titelVon={(koId) => pruefung.quelltitel?.[koId]}
            wissenHref={gespeicherteFassungHref}
            hrefFuerFundstelle={(fund, aussageId) => {
              const bezug = new URLSearchParams({
                vonNotiz: id,
                aussage: aussageId,
                pruefstand: ergebnis.pruefId,
              });
              return `${gespeicherteFassungHref(fund.koId, fund.koVersion)}&${bezug}${zitatFragment(passagen.get(fund.fundstelleId) ?? "")}`;
            }}
            auszugVon={(fid) => passagen.get(fid)}
            testId="notiz-quellenpruefung"
          />
        </>
      )}
    </div>
  );
}
