// R-1664 / R-2179 — die geführt erfassten Angaben eines Lerneffekts am Wissensobjekt lesen.
// Zeigt nur, was angegeben wurde; ohne Angaben rendert sie nichts (Altbestand, andere Wissensart).
import { useTranslation } from "react-i18next";
import type { NegativwissenAngaben } from "../../api/types";
import { NEGATIVWISSEN_FRAGEN } from "../../lib/negativwissen";

export function NegativwissenAnzeige({
  angaben,
}: {
  angaben: NegativwissenAngaben | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (!angaben) {
    return null;
  }
  const antworten = NEGATIVWISSEN_FRAGEN.filter(({ feld }) => angaben[feld]);
  const warnsignale = angaben.earlyWarningSigns ?? [];
  const bezug = angaben.bezug ?? [];
  return (
    <section
      data-testid="negativwissen-anzeige"
      className="space-y-2 rounded-card border border-hairline bg-page px-3 py-2.5"
    >
      <h3 className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-muted-2">
        {t("negativwissen.anzeigeTitel")}
      </h3>
      <dl className="space-y-1.5">
        {antworten.map(({ feld, key }) => (
          <div key={feld}>
            <dt className="text-[12px] font-semibold text-muted">{t(key)}</dt>
            <dd className="text-[13px] text-text">{angaben[feld]}</dd>
          </div>
        ))}
        {warnsignale.length > 0 ? (
          <div>
            <dt className="text-[12px] font-semibold text-muted">
              {t("negativwissen.warnsignale")}
            </dt>
            <dd>
              <ul className="list-disc pl-5 text-[13px] text-text">
                {warnsignale.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {bezug.length > 0 ? (
          <div>
            <dt className="text-[12px] font-semibold text-muted">{t("negativwissen.bezug")}</dt>
            <dd className="text-[13px] text-text">
              {bezug.map((b) => t(`negativwissen.bezug.${b}`)).join(" · ")}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
