// ==================================================================================================
// JOB 4154 · VORLEGEN UND ENTSCHEIDEN — GESPERRT, SOLANGE DER STAND UNGEWISS IST.
// ==================================================================================================
//
// DIE SPERRE IST DER KERN DIESES BAUTEILS, nicht ein Nebenzustand. Ein Entscheid auf einem Stand,
// dessen Auffrischung gescheitert ist, wäre genau der Fall, den F4 verbietet: freigegeben würde
// eine Fassung, die so vielleicht gar nicht mehr existiert. Deshalb ist der Knopf dann aus — MIT
// sichtbarem Grund, denn ein toter Knopf ohne Erklärung ist eine Scheinfunktion.
//
// UND: aus grünen Bausteinen entsteht hier nichts. Dieses Bauteil kennt den Status der gebundenen
// Einträge gar nicht; es kennt nur den Stand der ANWEISUNG und zwei Knöpfe für einen Menschen.
import { useTranslation } from "react-i18next";
import type { AnweisungStand } from "../../api/types";
import type { Sperre } from "./zustand";

export const ENTSCHEIDUNG_MARKE = "ga-entscheidung";

export function EntscheidungsVorlage({
  stand,
  sperre,
  darfEntscheiden,
  vorlegen,
  entscheiden,
  fehlerSatz,
}: {
  stand: AnweisungStand;
  sperre: Sperre;
  /** Das Freigaberecht des Betrachters. Ohne es gibt es die Entscheidungsknöpfe gar nicht. */
  darfEntscheiden: boolean;
  vorlegen: () => void;
  entscheiden: (entscheidung: "angenommen" | "abgelehnt") => void;
  /** Der Satz zum letzten gescheiterten Versuch, oder `null`. */
  fehlerSatz: string | null;
}): JSX.Element {
  const { t } = useTranslation();
  const vorlegbar = stand === "entwurf" || stand === "abgelehnt";
  const entscheidbar = stand === "vorgelegt";

  return (
    <section data-testid={ENTSCHEIDUNG_MARKE}>
      <h3>{t("ga.entscheidung.titel")}</h3>
      <p data-testid={`${ENTSCHEIDUNG_MARKE}-stand`}>{t(`ga.stand.${stand}`)}</p>
      {vorlegbar ? (
        <button
          type="button"
          data-testid={`${ENTSCHEIDUNG_MARKE}-vorlegen`}
          onClick={vorlegen}
          disabled={sperre.gesperrt}
        >
          {t("ga.entscheidung.vorlegen")}
        </button>
      ) : null}
      {entscheidbar && darfEntscheiden ? (
        <p>
          <button
            type="button"
            data-testid={`${ENTSCHEIDUNG_MARKE}-annehmen`}
            onClick={() => entscheiden("angenommen")}
            disabled={sperre.gesperrt}
          >
            {t("ga.entscheidung.annehmen")}
          </button>
          <button
            type="button"
            data-testid={`${ENTSCHEIDUNG_MARKE}-ablehnen`}
            onClick={() => entscheiden("abgelehnt")}
            disabled={sperre.gesperrt}
          >
            {t("ga.entscheidung.ablehnen")}
          </button>
        </p>
      ) : null}
      {sperre.gesperrt && sperre.grund ? (
        <p role="alert" data-testid={`${ENTSCHEIDUNG_MARKE}-grund`}>
          {t(sperre.grund)}
        </p>
      ) : null}
      {fehlerSatz ? (
        <p role="alert" data-testid={`${ENTSCHEIDUNG_MARKE}-fehler`}>
          {t(fehlerSatz)}
        </p>
      ) : null}
    </section>
  );
}
