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
//
// PRÜFSTATUS-ANZEIGE (Pedi 28.09.2026, Ergänzung 3) · `FreigabeStatus` ist der EINE Statusblock für
// Übersicht und Detailansicht: Standwort, Stand-Nummer, Bedeutung (freigegeben oder nicht), Angaben
// zu einer dokumentierten Entscheidung und der nächste Schritt nach den Rechten des Betrachters.
// Beide Ansichten zeichnen ihn aus `freigabeanzeige` (`zustand.ts`) — so können sie nicht
// auseinanderlaufen.
import { useTranslation } from "react-i18next";
import type { AnweisungStand } from "../../api/types";
import { formatKoTimestamp } from "../../lib/koDates";
import { useAuthorName } from "../../lib/useAuthorName";
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
import { type Freigabeeingabe, type Freigaberechte, type Sperre, freigabeanzeige } from "./zustand";

export const ENTSCHEIDUNG_MARKE = "ga-entscheidung";

/**
 * Der Statusblock einer Arbeitsanleitung — in der Übersicht je Zeile, in der Detailansicht im Kopf.
 *
 * `marke` ist der Testkennungsstamm der Ansicht; das Standwort trägt `${marke}-stand`, damit die
 * bestehenden Prüfstellen der Liste (`ga-liste-stand`) unverändert greifen.
 */
export function FreigabeStatus({
  marke,
  eingabe,
  rechte,
}: {
  marke: string;
  eingabe: Freigabeeingabe;
  rechte: Freigaberechte;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  // STATUS-FREIGABE: die entscheidende Person über DENSELBEN Verzeichnisweg wie „Erstellt von" —
  // eine unbekannte Kennung wird als unbekannt benannt, nie durch einen anderen Namen ersetzt.
  const nameVon = useAuthorName();
  const anzeige = freigabeanzeige(eingabe, rechte);
  const zeit = anzeige.pruefung?.am ? formatKoTimestamp(anzeige.pruefung.am, i18n.language) : null;
  return (
    <div
      data-testid={`${marke}-freigabe`}
      data-stand={eingabe.stand}
      data-version={eingabe.version}
      // STATUS-FREIGABE: Klara liest beim Zeigen GENAU diesen gezeichneten Block.
      data-objektstatus="anleitung"
      className="space-y-1"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span data-testid={`${marke}-stand`} className={CHIP}>
          <span className="sr-only">{t("ga.liste.stand")}: </span>
          {t(anzeige.wort)}
        </span>
        <span data-testid={`${marke}-fassung`} className={HINWEIS}>
          {t("fe001.status.fassung", { nummer: eingabe.version })}
        </span>
      </p>
      <p data-testid={`${marke}-bedeutung`} className={HINWEIS}>
        {t(anzeige.bedeutung)}
      </p>
      {anzeige.pruefung ? (
        <p
          data-testid={`${marke}-pruefung`}
          data-festgehalten={anzeige.pruefung.von ? "ja" : "nein"}
          className={HINWEIS}
        >
          {t(anzeige.pruefung.schluessel, {
            nummer: anzeige.pruefung.nummer ?? eingabe.version,
            zeit: zeit ?? t("fe001.zeitUnbekannt"),
            ...(anzeige.pruefung.von ? { name: nameVon(anzeige.pruefung.von) } : {}),
          })}
        </p>
      ) : null}
      <p data-testid={`${marke}-schritt`} className="text-[12.5px] leading-relaxed text-text">
        <span className="font-semibold">{t("fe001.status.naechsterSchritt")}</span>{" "}
        {t(anzeige.naechsterSchritt)}
      </p>
    </div>
  );
}

/** Der erklärende Satz zum Stand — was er bedeutet und was als Nächstes möglich ist. */
function erklaerung(
  stand: AnweisungStand,
  darfEntscheiden: boolean,
  darfVorlegen: boolean,
): string {
  if (stand === "vorgelegt") {
    return darfEntscheiden ? "fe001.entscheidung.wartetAufDich" : "fe001.entscheidung.wartet";
  }
  if (stand === "entschieden") {
    return "fe001.entscheidung.angenommen";
  }
  if (stand === "abgelehnt") {
    // „Überarbeiten und erneut vorlegen" nur, wer es darf — sonst nur die Bedeutung (BEN-01).
    return darfVorlegen ? "fe001.entscheidung.abgelehnt" : "fe001.status.bedeutung.abgelehnt";
  }
  return "fe001.entscheidung.bedeutung";
}

export function EntscheidungsVorlage({
  stand,
  sperre,
  darfEntscheiden,
  darfVorlegen,
  vorlegen,
  entscheiden,
  fehlerSatz,
}: {
  stand: AnweisungStand;
  sperre: Sperre;
  /** Das Freigaberecht des Betrachters. Ohne es gibt es die Entscheidungsknöpfe gar nicht. */
  darfEntscheiden: boolean;
  /**
   * Das Vorlegerecht (`ko.create`) des Betrachters. Ohne es gibt es den Vorlegeknopf gar nicht —
   * dieselbe Regel wie beim Freigaberecht (Ben R1, BEN-01: ein Viewer las „nur lesen" und bekam
   * trotzdem einen aktiven Knopf, der am Server nur 403 kann).
   */
  darfVorlegen: boolean;
  vorlegen: () => void;
  entscheiden: (entscheidung: "angenommen" | "abgelehnt") => void;
  /** Der Satz zum letzten gescheiterten Versuch, oder `null`. */
  fehlerSatz: string | null;
}): JSX.Element {
  const { t } = useTranslation();
  const vorlegbar = darfVorlegen && (stand === "entwurf" || stand === "abgelehnt");
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
        {t(erklaerung(stand, darfEntscheiden, darfVorlegen))}
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
