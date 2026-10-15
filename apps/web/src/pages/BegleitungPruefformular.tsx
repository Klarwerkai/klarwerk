// ================================================================================================
// AKTIVE BEGLEITUNG (BPA-05) · DER FREIGEGEBENE TESTVORGANG `/begleitung/pruefformular`.
// ================================================================================================
//
// Originalkriterium K6 spricht vom „freigegebenen Testformular". Das ist es: ein synthetisches
// Datenblatt eines Netzteils, im Produkt erreichbar (Router, Einstieg aus der Assistenz-Vorschau),
// als Vorgang eingerichtet über `data-klara-begleitbereich`. Die Leiste in der Hülle bietet hier
// die Begleitung an; der Vorgangsadapter liest nur die Felder dieser Fläche.
//
//   · Freigegeben für die Rollen experte und controller (`data-klara-begleitbereich-rollen`). Eine
//     andere Rolle — auch Verwaltung — sieht das Formular, bekommt aber kein Begleitangebot (G04).
//   · „Kundennummer" ist ausgeschlossen, die persönliche Notiz liegt außerhalb der Fläche: beides
//     wird nie gelesen (K2).
//   · „Angaben prüfen" ist die spätere Prüfung des bisherigen Weges: sie meldet fehlende Einheiten
//     erst NACH dem Ausfüllen. Mit ihr lassen sich beide Wege derselben Recherche ausführen (K10).
//
// Nichts wird gespeichert oder gesendet; die Seite hat keinen Serverabruf.
import { useState } from "react";
import { ohneEinheit } from "../components/klara-begleitung/kern";
import { useAssistenzT } from "../lib/assistenzProfil";

/** Die Felder des synthetischen Datenblatts. `einheiten` leer heißt: keine Einheit erwartet. */
const FELDER: readonly { name: string; einheiten: readonly string[] }[] = [
  { name: "hersteller", einheiten: [] },
  { name: "leistung", einheiten: ["W", "kW"] },
  { name: "spannung", einheiten: ["V"] },
  { name: "strom", einheiten: ["A"] },
  { name: "wirkungsgrad", einheiten: ["%"] },
  { name: "anschluesse", einheiten: [] },
];

const FELD =
  "mt-1 w-full rounded-btn border border-hairline bg-surface px-3 py-2 text-[14px] text-text";
const KNOPF =
  "inline-flex h-9 items-center rounded-btn border border-hairline bg-surface px-3 text-[13px] font-semibold text-text";

export function BegleitungPruefformular(): JSX.Element {
  const { t } = useAssistenzT();
  const [befunde, setBefunde] = useState<string[] | null>(null);

  const pruefen = (): void => {
    const fehlend: string[] = [];
    for (const f of FELDER) {
      const el = document.getElementById(`pf-${f.name}`) as HTMLInputElement | null;
      if (f.einheiten.length > 0 && el && ohneEinheit(el.value)) {
        fehlend.push(f.name);
      }
    }
    setBefunde(fehlend);
  };

  return (
    <div className="mx-auto max-w-2xl pt-6" data-testid="page-begleitung-pruefformular">
      <span
        data-testid="pruefformular-kennzeichen"
        className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-trust-warn-text"
      >
        {t("begleitung.formular.kennzeichen")}
      </span>
      <h1 className="mt-2 text-[26px] font-semibold text-ink">{t("begleitung.formular.titel")}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-text">{t("begleitung.formular.intro")}</p>
      <form
        className="mt-5 grid gap-3"
        data-klara-begleitbereich="pruefformular-netzteil"
        data-klara-begleitbereich-name={t("begleitung.formular.titel")}
        data-klara-begleitbereich-rollen="experte,controller"
        onSubmit={(e) => {
          e.preventDefault();
          pruefen();
        }}
      >
        {FELDER.map((f) => (
          <div key={f.name}>
            <label htmlFor={`pf-${f.name}`} className="text-[13px] font-semibold text-ink">
              {t(`begleitung.formular.feld.${f.name}`)}
            </label>
            <input
              id={`pf-${f.name}`}
              name={f.name}
              className={FELD}
              autoComplete="off"
              data-klara-einheit={f.einheiten.length > 0 ? f.einheiten.join(",") : undefined}
            />
          </div>
        ))}
        <div>
          <label htmlFor="pf-kundennummer" className="text-[13px] font-semibold text-ink">
            {t("begleitung.formular.feld.kundennummer")}
          </label>
          <input
            id="pf-kundennummer"
            name="kundennummer"
            className={FELD}
            autoComplete="off"
            data-klara-ausgeschlossen=""
          />
          <p className="mt-1 text-[12px] text-muted">{t("begleitung.formular.ausgeschlossen")}</p>
        </div>
        <div>
          <button type="submit" className={KNOPF} data-testid="pruefformular-pruefen">
            {t("begleitung.formular.pruefen")}
          </button>
        </div>
      </form>
      {befunde !== null ? (
        befunde.length === 0 ? (
          <output className="mt-3 block text-[13px]" data-testid="pruefformular-vollstaendig">
            {t("begleitung.formular.vollstaendig")}
          </output>
        ) : (
          <div className="mt-3 text-[13px]" data-testid="pruefformular-befunde">
            <p>{t("begleitung.formular.befunde")}</p>
            <ul className="list-disc pl-5">
              {befunde.map((name) => (
                <li key={name} data-testid={`pruefformular-befund-${name}`}>
                  {t(`begleitung.formular.feld.${name}`)}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
      <section className="mt-6" aria-labelledby="pf-privat-titel">
        <h2 id="pf-privat-titel" className="text-[15px] font-semibold text-ink">
          {t("begleitung.formular.privatTitel")}
        </h2>
        <textarea
          name="persoenliche-notiz"
          aria-labelledby="pf-privat-titel"
          className={FELD}
          rows={3}
        />
        <p className="mt-1 text-[12px] text-muted">{t("begleitung.formular.privatHinweis")}</p>
      </section>
    </div>
  );
}
