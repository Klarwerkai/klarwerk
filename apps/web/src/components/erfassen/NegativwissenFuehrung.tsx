// R-1664 / R-2179 / R-2180 — der geführte Erfassungsblock eines Lerneffekts (Wissensart
// Negativwissen). Reine Darstellung: Zustand und Stufenregel hält die Seite (Capture.tsx), die
// Logik steht DOM-frei in `lib/negativwissen.ts`.
//
// BEN, Nacharbeit 2: eine Überschreitung der Obergrenzen steht AM FELD (Ist und Grenze), und ein
// Satz darunter sagt, dass Sichern und Einreichen bis dahin gesperrt sind. Die Eingabe wird nie
// abgeschnitten — auch nicht über `maxLength`, das einen eingefügten Text still kürzen würde.
import { useTranslation } from "react-i18next";
import type { NegativwissenBezug } from "../../api/types";
import {
  NEGATIVWISSEN_BEZUEGE,
  NEGATIVWISSEN_FRAGEN,
  type NegativwissenForm,
  type NegativwissenTextfeld,
  type NegativwissenUeberschreitung,
  negativwissenUeberschreitungen,
} from "../../lib/negativwissen";

const FELD_KLASSE =
  "w-full rounded-input border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:ring-1 focus:ring-hairline";

const HINWEIS_KLASSE = "mt-0.5 block text-[11.5px] leading-snug text-trust-crit-text";

function rahmen(ungueltig: boolean): string {
  return `${FELD_KLASSE} ${ungueltig ? "border-trust-crit-fill ring-1 ring-trust-crit-fill" : "border-hairline"}`;
}

export function NegativwissenFuehrung({
  form,
  onChange,
}: {
  form: NegativwissenForm;
  onChange: (form: NegativwissenForm) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const ueberschreitungen = negativwissenUeberschreitungen(form);
  const ueberschreitungenVon = (
    feld: NegativwissenUeberschreitung["feld"],
  ): NegativwissenUeberschreitung[] => ueberschreitungen.filter((u) => u.feld === feld);
  const satz = (u: NegativwissenUeberschreitung): string =>
    u.art === "anzahl"
      ? t("negativwissen.obergrenze.anzahl", { ist: u.ist, max: u.max })
      : u.feld === "warnsignale"
        ? t("negativwissen.obergrenze.warnsignal", { ist: u.ist, max: u.max })
        : t("negativwissen.obergrenze.zeichen", { ist: u.ist, max: u.max });
  const setzeFeld = (feld: NegativwissenTextfeld, wert: string): void => {
    const next = { ...form };
    next[feld] = wert;
    onChange(next);
  };
  const umschalten = (b: NegativwissenBezug): void => {
    const bezug = form.bezug.includes(b) ? form.bezug.filter((x) => x !== b) : [...form.bezug, b];
    onChange({ ...form, bezug: NEGATIVWISSEN_BEZUEGE.filter((x) => bezug.includes(x)) });
  };
  const warnsignalFehler = ueberschreitungenVon("warnsignale");
  return (
    <section
      data-testid="negativwissen-fuehrung"
      aria-labelledby="negativwissen-fuehrung-titel"
      className="space-y-3 rounded-card border border-hairline bg-page p-3"
    >
      <div>
        <h3 id="negativwissen-fuehrung-titel" className="text-[13.5px] font-semibold text-text">
          {t("negativwissen.fuehrungTitel")}
        </h3>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-2">
          {t("negativwissen.hinweis")}
        </p>
      </div>
      {NEGATIVWISSEN_FRAGEN.map(({ feld, key }) => {
        const fehler = ueberschreitungenVon(feld);
        return (
          <label key={feld} className="block">
            <span className="mb-1 block text-[12.5px] font-semibold text-muted">{t(key)}</span>
            <textarea
              data-testid={`negativwissen-${feld}`}
              rows={2}
              value={form[feld]}
              onChange={(e) => setzeFeld(feld, e.target.value)}
              aria-invalid={fehler.length > 0}
              aria-describedby={fehler.length > 0 ? `negativwissen-${feld}-grenze` : undefined}
              className={rahmen(fehler.length > 0)}
            />
            {fehler.length > 0 ? (
              <span
                id={`negativwissen-${feld}-grenze`}
                role="alert"
                data-testid={`negativwissen-${feld}-grenze`}
                className={HINWEIS_KLASSE}
              >
                {fehler.map(satz).join(" ")}
              </span>
            ) : null}
          </label>
        );
      })}
      <label className="block">
        <span className="mb-1 block text-[12.5px] font-semibold text-muted">
          {t("negativwissen.warnsignale")}
        </span>
        <textarea
          data-testid="negativwissen-warnsignale"
          rows={3}
          value={form.warnsignale}
          onChange={(e) => onChange({ ...form, warnsignale: e.target.value })}
          aria-invalid={warnsignalFehler.length > 0}
          aria-describedby="negativwissen-warnsignale-hinweis"
          className={rahmen(warnsignalFehler.length > 0)}
        />
        <span
          id="negativwissen-warnsignale-hinweis"
          className="mt-0.5 block text-[11px] text-muted-2"
        >
          {t("negativwissen.warnsignaleHinweis")}
        </span>
        {warnsignalFehler.length > 0 ? (
          <span
            role="alert"
            data-testid="negativwissen-warnsignale-grenze"
            className={HINWEIS_KLASSE}
          >
            {warnsignalFehler.map(satz).join(" ")}
          </span>
        ) : null}
      </label>
      <fieldset>
        <legend className="mb-1 text-[12.5px] font-semibold text-muted">
          {t("negativwissen.bezug")}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {NEGATIVWISSEN_BEZUEGE.map((b) => {
            const aktiv = form.bezug.includes(b);
            return (
              <button
                key={b}
                type="button"
                data-testid={`negativwissen-bezug-${b}`}
                aria-pressed={aktiv}
                onClick={() => umschalten(b)}
                className={
                  aktiv
                    ? "rounded-btn border border-ink bg-ink px-2.5 py-1 text-[12px] font-semibold text-white"
                    : "rounded-btn border border-hairline px-2.5 py-1 text-[12px] text-muted hover:text-text"
                }
              >
                {t(`negativwissen.bezug.${b}`)}
              </button>
            );
          })}
        </div>
        {form.bezug.length > 0 ? (
          <p
            data-testid="negativwissen-bezug-stufe"
            className="mt-1.5 text-[11.5px] leading-snug text-trust-warn-text"
          >
            {t("negativwissen.bezugStufe")}
          </p>
        ) : null}
      </fieldset>
      {ueberschreitungen.length > 0 ? (
        <p
          role="alert"
          data-testid="negativwissen-grenze-gesperrt"
          className="text-[12px] text-trust-crit-text"
        >
          {t("negativwissen.obergrenze.gesperrt")}
        </p>
      ) : null}
    </section>
  );
}
