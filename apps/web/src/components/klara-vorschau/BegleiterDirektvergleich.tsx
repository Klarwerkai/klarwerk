import { useTranslation } from "react-i18next";
import type { BegleiterVergleich } from "../../lib/begleiter";
import { koDetailUrl } from "../../lib/wordAddin";
import { AiGeneratedNotice } from "../AiGeneratedNotice";

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
  if (!marke || marke.start < 0 || marke.end > text.length || marke.end <= marke.start) {
    return <>{text}</>;
  }
  return (
    <>
      {text.slice(0, marke.start)}
      <mark className={`rounded-sm px-0.5 font-semibold ${farbe}`}>
        {text.slice(marke.start, marke.end)}
      </mark>
      {text.slice(marke.end)}
    </>
  );
}

export function BegleiterDirektvergleich({
  vergleich,
  zeigen,
}: {
  vergleich: BegleiterVergleich;
  zeigen: (() => void) | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const { symbol, farbe } = URTEIL[vergleich.art];
  const quellen = [...new Set(vergleich.belege.flatMap((beleg) => beleg.quellen))];
  const etikett = "text-[11px] font-semibold text-muted";
  const zitat = "mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text";
  return (
    <section
      data-testid="begleiter-direktvergleich"
      data-urteil={vergleich.art}
      className="overflow-hidden rounded-card border border-hairline bg-surface"
    >
      <h3 className={`flex items-center gap-2 px-3 py-2 text-[14px] font-semibold ${farbe}`}>
        <span aria-hidden="true" className="text-base">
          {symbol}
        </span>
        {t(`begleiter.vergleich.${vergleich.art}`)}
      </h3>
      <div className="space-y-2.5 p-3">
        <dl className="space-y-2.5">
          <div>
            <dt className={etikett}>{t("begleiter.vergleich.dokument")}</dt>
            <dd className={zitat}>
              <Wortlaut text={vergleich.dokument} marke={vergleich.dokumentMarke} farbe={farbe} />
            </dd>
          </div>
          {vergleich.belege.map((beleg) => (
            <div
              key={JSON.stringify([beleg.text, beleg.quellen])}
              className="border-t border-hairline pt-2"
            >
              <dt className={etikett}>
                {t(beleg.woertlich ? "begleiter.vergleich.quelle" : "begleiter.vergleich.beleg")}
                {beleg.quellen.map((id) => {
                  const nummer = quellen.indexOf(id) + 1;
                  return (
                    <a
                      key={id}
                      href={koDetailUrl(window.location.origin, id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t("begleiter.vergleich.quelllink", { nummer })}
                      className="ml-1 inline-block rounded-sm px-0.5 text-brand-text underline focus-visible:outline focus-visible:outline-2"
                    >
                      [{nummer}]
                    </a>
                  );
                })}
              </dt>
              <dd className={zitat}>
                <Wortlaut
                  text={beleg.text}
                  marke={vergleich.belegMarke}
                  farbe="bg-trust-pos-bg text-trust-pos-text"
                />
              </dd>
            </div>
          ))}
        </dl>
        {vergleich.art === "offen" ? (
          <p className="text-[12px] text-muted">{t("begleiter.vergleich.fehlt")}</p>
        ) : null}
        {vergleich.aiGenerated === true ? <AiGeneratedNotice className="block" /> : null}
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
