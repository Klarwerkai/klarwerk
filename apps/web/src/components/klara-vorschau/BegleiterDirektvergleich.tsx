import { skipToken, useQueries } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../../api/endpoints";
import { useSession } from "../../app/AuthContext";
import type { BegleiterVergleich } from "../../lib/begleiter";
import { AiGeneratedNotice } from "../AiGeneratedNotice";
import { Quellverweis } from "./BegleiterVergleichsquelle";
import "./BegleiterDirektvergleich.css";

const URTEIL = {
  bestaetigt: { symbol: "✓", farbe: "bg-trust-pos-bg text-trust-pos-text" },
  widersprochen: { symbol: "×", farbe: "bg-trust-crit-bg text-trust-crit-text" },
  offen: { symbol: "?", farbe: "bg-trust-warn-bg text-trust-warn-text" },
} as const;

function markierterText(text: string, marke: BegleiterVergleich["dokumentMarke"]): string | null {
  if (!marke || marke.start < 0 || marke.end > text.length || marke.end <= marke.start) {
    return null;
  }
  return text.slice(marke.start, marke.end);
}

function Wortlaut({
  text,
  marke,
  farbe,
}: {
  text: string;
  marke: BegleiterVergleich["dokumentMarke"];
  farbe: string;
}): JSX.Element {
  const ausschnitt = markierterText(text, marke);
  if (!marke || marke.nurKontext || !ausschnitt) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, marke.start)}
      <mark className={`rounded-sm px-0.5 font-semibold underline underline-offset-2 ${farbe}`}>
        {ausschnitt}
      </mark>
      {text.slice(marke.end)}
    </>
  );
}

type Belegfassung = Awaited<ReturnType<typeof endpoints.ko.belegfassung>>;

export function BegleiterDirektvergleich({
  vergleich,
  anderePassage,
  aktuellePassage,
  zeigen,
}: {
  vergleich: BegleiterVergleich;
  anderePassage?: boolean;
  aktuellePassage: boolean;
  zeigen: (() => void) | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { symbol, farbe } = URTEIL[vergleich.art];
  const widerspruch = vergleich.art === "widersprochen";
  const quellen = [...new Set(vergleich.belege.flatMap((beleg) => beleg.quellen))];
  const { user } = useSession();
  const belege = useQueries({
    queries: (vergleich.quellfassungen ?? []).map(({ id, fassung }) => ({
      queryKey: ["begleiter-belegfassung", user?.id, id, fassung],
      queryFn: user ? () => endpoints.ko.belegfassung(id, fassung) : skipToken,
      retry: false,
      gcTime: 0,
    })),
  });
  const fassungen = new Map<string, Belegfassung>();
  for (const [i, stand] of (vergleich.quellfassungen ?? []).entries()) {
    const abfrage = belege[i];
    if (
      abfrage?.isSuccess &&
      abfrage.data.id === stand.id &&
      abfrage.data.fassung === stand.fassung
    ) {
      fassungen.set(stand.id, abfrage.data);
    }
  }
  const beleg = vergleich.belege[0];
  const dokumentwort = widerspruch
    ? markierterText(vergleich.dokument, vergleich.dokumentMarke)
    : null;
  const quellwort =
    widerspruch && vergleich.belege.length === 1 && beleg?.woertlich
      ? markierterText(beleg.text, vergleich.belegMarke)
      : null;
  const nurDokumentkontext = vergleich.dokumentMarke?.nurKontext === true;
  const nurQuellkontext = vergleich.belegMarke?.nurKontext === true;
  const wortpaar = dokumentwort && quellwort && !(nurDokumentkontext && nurQuellkontext);
  const wortgleich =
    aktuellePassage &&
    vergleich.art === "bestaetigt" &&
    vergleich.belege.length === 1 &&
    beleg?.woertlich &&
    beleg.text === vergleich.dokument &&
    beleg.quellen.length === 1 &&
    Boolean(fassungen.get(beleg.quellen[0] ?? "")?.freigegebenVon);
  const [beideAnzeigen, setBeideAnzeigen] = useState(false);
  const kurz = wortgleich && !beideAnzeigen;
  const wortlautId = useId();
  const etikett = "text-[11px] font-semibold text-muted";
  const zitat = "mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text";
  return (
    <section
      data-testid="begleiter-direktvergleich"
      data-urteil={vergleich.art}
      className="begleiter-direktvergleich overflow-hidden rounded-card border border-hairline bg-surface"
    >
      <h3 className={`flex items-center gap-2 px-3 py-2 text-[14px] font-semibold ${farbe}`}>
        <span aria-hidden="true" className="text-base">
          {symbol}
        </span>
        {wortgleich
          ? t("begleiter.vergleich.wortgleich")
          : t(`begleiter.vergleich.${vergleich.art}`)}
      </h3>
      {wortpaar && (
        <p
          data-testid="begleiter-wortpaar"
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-hairline px-3 py-1.5 text-sm font-semibold [overflow-wrap:anywhere]"
        >
          <span
            className={
              nurDokumentkontext ? "min-w-0 font-normal text-muted" : "min-w-0 text-trust-crit-text"
            }
          >
            <span className="sr-only">
              {t(
                anderePassage
                  ? "begleiter.vergleich.frueherePassage"
                  : "begleiter.vergleich.dokument",
              )}
              :{" "}
            </span>
            {nurDokumentkontext ? t("begleiter.vergleich.fehltImSatz") : dokumentwort}
          </span>
          <span aria-hidden="true" className="text-muted">
            →
          </span>
          <span
            className={
              nurQuellkontext ? "min-w-0 font-normal text-muted" : "min-w-0 text-trust-pos-text"
            }
          >
            <span className="sr-only">{t("begleiter.vergleich.quelle")}: </span>
            {nurQuellkontext ? t("begleiter.vergleich.entfaellt") : quellwort}
          </span>
        </p>
      )}
      <div className="space-y-2.5 p-3">
        <dl id={wortlautId} className="space-y-2.5">
          {!kurz && (
            <div>
              <dt className={etikett}>
                {t(
                  anderePassage
                    ? "begleiter.vergleich.frueherePassage"
                    : "begleiter.vergleich.dokument",
                )}
              </dt>
              <dd className={zitat}>
                <Wortlaut
                  text={vergleich.dokument}
                  marke={widerspruch ? vergleich.dokumentMarke : null}
                  farbe={farbe}
                />
              </dd>
            </div>
          )}
          {vergleich.belege.map((beleg) => (
            <div
              key={JSON.stringify([beleg.text, beleg.quellen])}
              className={kurz ? undefined : "border-t border-hairline pt-2"}
            >
              <dt className={kurz ? "sr-only" : etikett}>
                {t(beleg.woertlich ? "begleiter.vergleich.quelle" : "begleiter.vergleich.beleg")}
              </dt>
              <dd className={zitat}>
                {kurz ? (
                  beleg.text
                ) : (
                  <Wortlaut
                    text={beleg.text}
                    marke={widerspruch ? vergleich.belegMarke : null}
                    farbe="bg-trust-pos-bg text-trust-pos-text"
                  />
                )}
                {beleg.quellen.map((id) => (
                  <Quellverweis
                    key={id}
                    id={id}
                    quelle={fassungen.get(id)}
                    nummer={quellen.indexOf(id) + 1}
                    zitat={beleg.woertlich && beleg.quellen.length === 1 ? beleg.text : ""}
                    fassung={vergleich.quellfassungen?.find((stand) => stand.id === id)?.fassung}
                  />
                ))}
              </dd>
            </div>
          ))}
        </dl>
        {wortgleich && (
          <button
            type="button"
            aria-controls={wortlautId}
            aria-expanded={beideAnzeigen}
            onClick={() => setBeideAnzeigen(!beideAnzeigen)}
            data-testid="begleiter-beide-fassungen"
            className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-text hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            {t(beideAnzeigen ? "begleiter.vergleich.einklappen" : "begleiter.vergleich.beide")}
          </button>
        )}
        {vergleich.art === "offen" ? (
          <p className="text-[12px] text-muted">{t("begleiter.vergleich.fehlt")}</p>
        ) : null}
        {vergleich.aiGenerated === true ? (
          <AiGeneratedNotice className="begleiter-ki-hinweis block" />
        ) : null}
        {zeigen && vergleich.zeigbar ? (
          <button
            type="button"
            onClick={zeigen}
            data-testid="begleiter-vergleich-zeigen"
            className="rounded-btn border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-semibold text-text hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            {t("begleiter.aktion.art.zeigen")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
