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
//
// FE-001 · ES ERKLÄRT JETZT, WAS PASSIERT. Bis hierher standen „Zur Entscheidung vorlegen", ein
// Statuswort und ein Knopf da — ohne Bedeutung, ohne Empfänger, ohne nächsten Schritt. Die Sätze
// nennen, was die bestehenden Rechte sagen (`entscheiden` fordert `ko.validate`: Controller und
// Administration, `services/rbac/src/policy.ts`), und was NICHT geschieht: keine automatische
// fachliche Prüfung, keine Benachrichtigung. Eine neue Pflichtrolle entsteht hier nicht.
import { useTranslation } from "react-i18next";
import type { AnweisungStand } from "../../api/types";
import {
  CHIP,
  HINWEIS,
  KARTE,
  KARTEN_TITEL,
  KNOPF_HAUPT,
  KNOPF_NEBEN,
  MELDUNG_FEHLER,
  MELDUNG_HINWEIS,
} from "./gestaltung";
import type { Sperre } from "./zustand";

export const ENTSCHEIDUNG_MARKE = "ga-entscheidung";

/** Der erklärende Satz zum Stand — was er bedeutet und was als Nächstes möglich ist. */
function erklaerung(stand: AnweisungStand, darfEntscheiden: boolean): string {
  if (stand === "vorgelegt") {
    return darfEntscheiden ? "fe001.entscheidung.wartetAufDich" : "fe001.entscheidung.wartet";
  }
  if (stand === "entschieden") {
    return "fe001.entscheidung.angenommen";
  }
  if (stand === "abgelehnt") {
    return "fe001.entscheidung.abgelehnt";
  }
  return "fe001.entscheidung.bedeutung";
}

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
    <section
      data-testid={ENTSCHEIDUNG_MARKE}
      aria-labelledby="ga-entscheidung-titel"
      className={KARTE}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ga-entscheidung-titel" className={KARTEN_TITEL}>
          {t("ga.entscheidung.titel")}
        </h2>
        <span className={CHIP} data-testid={`${ENTSCHEIDUNG_MARKE}-stand`}>
          {t(`ga.stand.${stand}`)}
        </span>
      </div>
      <p className={HINWEIS} data-testid={`${ENTSCHEIDUNG_MARKE}-erklaerung`}>
        {t(erklaerung(stand, darfEntscheiden))}
      </p>
      <ul className={`${HINWEIS} list-disc space-y-0.5 pl-5`}>
        <li>{t("fe001.entscheidung.wer")}</li>
        <li>{t("fe001.entscheidung.teileNichtGanzes")}</li>
        <li>{t("fe001.entscheidung.keinVersand")}</li>
      </ul>
      <p className={MELDUNG_HINWEIS}>{t("fe001.entscheidung.pruefungOffen")}</p>
      <div className="flex flex-wrap items-center gap-2">
        {vorlegbar ? (
          <button
            type="button"
            data-testid={`${ENTSCHEIDUNG_MARKE}-vorlegen`}
            className={KNOPF_HAUPT}
            onClick={vorlegen}
            disabled={sperre.gesperrt}
            aria-describedby={sperre.gesperrt ? "ga-entscheidung-grund" : undefined}
          >
            {t("ga.entscheidung.vorlegen")}
          </button>
        ) : null}
        {entscheidbar && darfEntscheiden ? (
          <>
            <button
              type="button"
              data-testid={`${ENTSCHEIDUNG_MARKE}-annehmen`}
              className={KNOPF_HAUPT}
              onClick={() => entscheiden("angenommen")}
              disabled={sperre.gesperrt}
            >
              {t("ga.entscheidung.annehmen")}
            </button>
            <button
              type="button"
              data-testid={`${ENTSCHEIDUNG_MARKE}-ablehnen`}
              className={KNOPF_NEBEN}
              onClick={() => entscheiden("abgelehnt")}
              disabled={sperre.gesperrt}
            >
              {t("ga.entscheidung.ablehnen")}
            </button>
          </>
        ) : null}
      </div>
      {sperre.gesperrt && sperre.grund ? (
        <p
          role="alert"
          id="ga-entscheidung-grund"
          className={MELDUNG_HINWEIS}
          data-testid={`${ENTSCHEIDUNG_MARKE}-grund`}
        >
          {t(sperre.grund)}
        </p>
      ) : null}
      {fehlerSatz ? (
        <p role="alert" className={MELDUNG_FEHLER} data-testid={`${ENTSCHEIDUNG_MARKE}-fehler`}>
          {t(fehlerSatz)}
        </p>
      ) : null}
    </section>
  );
}
