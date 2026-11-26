import { skipToken, useQueries } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../../api/endpoints";
import { useSession } from "../../app/AuthContext";
import type { BegleiterVergleich } from "../../lib/begleiter";
import { zitatFragment } from "../../lib/belegstelle";
import { gespeicherteFassungHref } from "../../lib/objektbezug";
import { useAuthorName } from "../../lib/useAuthorName";
import { koDetailUrl } from "../../lib/wordAddin";
import { AiGeneratedNotice } from "../AiGeneratedNotice";
import { Belegtitel } from "../Belegtitel";
import "./BegleiterDirektvergleich.css";

const URTEIL = {
  bestaetigt: { symbol: "✓", farbe: "bg-trust-pos-bg text-trust-pos-text" },
  widersprochen: { symbol: "×", farbe: "bg-trust-crit-bg text-trust-crit-text" },
  offen: { symbol: "?", farbe: "bg-trust-warn-bg text-trust-warn-text" },
} as const;

function Wortlaut({
  text,
  marke,
  farbe,
}: {
  text: string;
  marke: BegleiterVergleich["dokumentMarke"];
  farbe: string;
}): JSX.Element {
  if (
    !marke ||
    marke.nurKontext ||
    marke.start < 0 ||
    marke.end > text.length ||
    marke.end <= marke.start
  ) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, marke.start)}
      <mark className={`rounded-sm px-0.5 font-semibold underline underline-offset-2 ${farbe}`}>
        {text.slice(marke.start, marke.end)}
      </mark>
      {text.slice(marke.end)}
    </>
  );
}

type Belegfassung = Awaited<ReturnType<typeof endpoints.ko.belegfassung>>;

function Quellverweis({
  id,
  fassung,
  nummer,
  zitat,
  quelle,
}: {
  id: string;
  fassung: number | undefined;
  nummer: number;
  zitat: string;
  quelle: Belegfassung | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const name = useAuthorName();
  return (
    <div className="begleiter-quellverweis mt-1.5 text-[12px] leading-snug">
      <a
        href={
          fassung
            ? gespeicherteFassungHref(id, fassung) + zitatFragment(zitat)
            : koDetailUrl(window.location.origin, id)
        }
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-sm font-semibold text-brand-text underline underline-offset-2 focus-visible:outline focus-visible:outline-2"
      >
        {quelle?.titel ? (
          <Belegtitel titel={quelle.titel} demoSeed={quelle.demoSeed} />
        ) : (
          t("begleiter.vergleich.quelllink", { nummer })
        )}
      </a>
      {fassung !== undefined && (
        <span className="mt-0.5 block text-muted">
          {t("begleiter.vergleich.fassung", { fassung })}
          {quelle &&
            ` · ${
              quelle.freigegebenVon
                ? t("begleiter.vergleich.freigegebenVon", { person: name(quelle.freigegebenVon) })
                : t("begleiter.vergleich.freigabeUnbekannt")
            }`}
        </span>
      )}
    </div>
  );
}

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
                <Wortlaut text={vergleich.dokument} marke={vergleich.dokumentMarke} farbe={farbe} />
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
                    marke={vergleich.belegMarke}
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
