import { CheckCircle2, CircleHelp, CircleX, Quote } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const varianten = ["conflict", "match", "open"] as const;
const ergebnis = {
  conflict: { Icon: CircleX, farbe: "bg-trust-crit-bg text-trust-crit-text" },
  match: { Icon: CheckCircle2, farbe: "bg-trust-pos-bg text-trust-pos-text" },
  open: { Icon: CircleHelp, farbe: "bg-trust-warn-bg text-trust-warn-text" },
} as const;

function MarkierterSatz({
  satz,
  wortlaut,
  farbe,
}: { satz: string; wortlaut: string; farbe: string }): JSX.Element {
  const i = satz.indexOf(wortlaut);
  if (i < 0) return <>{satz}</>;
  return (
    <>
      {satz.slice(0, i)}
      <mark className={farbe}>{wortlaut}</mark>
      {satz.slice(i + wortlaut.length)}
    </>
  );
}

export function KatalogVergleich(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [variante, waehle] = useState<(typeof varianten)[number]>("conflict");
  const { Icon, farbe } = ergebnis[variante];
  const englisch = (i18n.resolvedLanguage ?? i18n.language).split("-")[0] === "en";
  return (
    <details className="rounded-card border border-hairline bg-surface" data-katalog-vergleich>
      <summary className="cursor-pointer rounded-card px-4 py-3 text-sm font-semibold text-brand-text focus-visible:outline-brand">
        {t("funktionskatalog.example")}
      </summary>
      <div className="space-y-4 border-t border-hairline p-4">
        <fieldset className="flex flex-wrap gap-1">
          <legend className="mb-2 text-xs font-semibold text-muted">
            {t("funktionskatalog.variant")}
          </legend>
          {varianten.map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={v === variante}
              onClick={() => waehle(v)}
              className={
                v === variante
                  ? "rounded-btn border border-ink bg-ink px-3 py-1.5 text-sm font-semibold text-white focus-visible:outline-brand"
                  : "rounded-btn border border-hairline px-3 py-1.5 text-sm font-semibold hover:bg-hairline-soft focus-visible:outline-brand"
              }
            >
              {t(`funktionskatalog.wording.${v}`)}
            </button>
          ))}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-btn bg-hairline-soft p-3">
            <h4 className="mb-2 text-xs font-semibold text-muted">
              {t("funktionskatalog.passage")}
            </h4>
            <p className="text-sm leading-relaxed">
              <MarkierterSatz
                satz={t(`funktionskatalog.sentence.${variante}`)}
                wortlaut={t(`funktionskatalog.wording.${variante}`)}
                farbe={farbe}
              />
            </p>
          </div>
          <div className="rounded-btn border border-hairline p-3">
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
              <Quote size={14} aria-hidden="true" />
              {t("funktionskatalog.exampleSource")}
            </h4>
            <blockquote className="text-sm leading-relaxed">
              <MarkierterSatz
                satz={t("funktionskatalog.sentence.match")}
                wortlaut={t("funktionskatalog.wording.match")}
                farbe="bg-trust-pos-bg text-trust-pos-text"
              />
            </blockquote>
            <p className="mt-2 text-xs text-muted" lang="en">
              {t("funktionskatalog.referenceTitle", { lng: "en" })}
            </p>
            {!englisch && (
              <details className="mt-2 text-xs text-muted">
                <summary className="cursor-pointer">{t("funktionskatalog.original")}</summary>
                <p lang="en" className="mt-1">
                  {t("funktionskatalog.sentence.match", { lng: "en" })}
                </p>
              </details>
            )}
          </div>
        </div>
        <output
          className={`flex items-center gap-2 rounded-btn px-3 py-2 text-sm font-semibold ${farbe}`}
        >
          <Icon size={17} aria-hidden="true" className="shrink-0" />
          {t(`funktionskatalog.example.${variante}`)}
        </output>
      </div>
    </details>
  );
}
