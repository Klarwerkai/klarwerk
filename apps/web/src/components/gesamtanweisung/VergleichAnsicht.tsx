// ==================================================================================================
// JOB 4154 · ZWEI STÄNDE GEGENÜBERSTELLEN — UND DIE VOKABEL, DIE NICHT VERRUTSCHEN DARF.
// ==================================================================================================
//
// DREI WÖRTER, DREI BEDEUTUNGEN, und keines darf durch ein viertes ersetzt werden:
//   unveraendert   — der Nachweis belegt Unverändertheit. NICHT Richtigkeit.
//   geaendert      — es ist nachweislich etwas anders.
//   unbekannt      — es konnte nicht bestimmt werden. Bleibt sichtbar, wird nie weggerundet.
//
// UND EINE LAGE-REGEL: bei Fehler oder gescheiterter Auffrischung steht hier KEIN „unverändert".
// Der Auftrag sagt das wörtlich („Insbesondere erscheint bei einem Fehler nie ‚unverändert'"), und
// `gleichheitsaussageErlaubt` ist die eine Stelle, an der diese Frage fällt.
//
// FE-001 · DAS „LÄDT …" OHNE ANFRAGE IST WEG, UND SEINE URSACHE IST BENANNT. `anzeigelage` fällt
// ohne Daten, ohne Fehler und ohne laufenden Abruf auf „laden" zurück — richtig für eine Abfrage,
// die gleich startet, falsch für die Vergleichsabfrage, die erst mit ZWEI gewählten Ständen startet
// (`useAnweisungVergleich`, `enabled`). Solange keine zwei verschiedenen Stände gewählt sind, lief
// also kein Abruf, und trotzdem stand „Lädt …" da (Live-Befund des Beraters, 26.09.2026). Diese
// Ansicht fragt deshalb zuerst, OB überhaupt verglichen werden kann (`auswahl`), und zeigt „Lädt …"
// nur, wenn der Abruf wirklich läuft. Die Lagen selbst bleiben die aus `zustand.ts`.
import { useTranslation } from "react-i18next";
import type { AnweisungVergleich, Auswirkung } from "../../api/types";
import {
  FELD,
  FELD_LABEL,
  HINWEIS,
  KARTE,
  KARTEN_TITEL,
  KNOPF_NEBEN,
  MELDUNG_FEHLER,
  MELDUNG_HINWEIS,
} from "./gestaltung";
import { type Anzeigelage, gleichheitsaussageErlaubt } from "./zustand";

export const VERGLEICH_MARKE = "ga-vergleich";

const SATZ: Record<Auswirkung, string> = {
  unveraendert: "ga.vergleich.unveraendert",
  geaendert: "ga.vergleich.geaendert",
  unbekannt: "ga.vergleich.unbekannt",
};

/**
 * Kann überhaupt verglichen werden — und wenn nicht, warum nicht?
 *
 * Rein und DOM-frei, damit jede Lage einzeln prüfbar ist:
 *   · `staendeLaden`    — die Liste der Stände wird GERADE abgerufen (nur dann „wird geladen");
 *   · `staendeOffline`  — keine Verbindung, der Abruf ruht: kein Ladehinweis, sondern der Grund;
 *   · `staendeFehler`   — der Abruf ist gescheitert ODER liegt ohne laufenden Abruf nicht vor
 *                         (RUNDE 2, Bens Befund E7: ohne laufende Anfrage kein „wird geladen");
 *   · `zuWenige`        — weniger als zwei gespeicherte Stände: es GIBT nichts zu vergleichen;
 *   · `waehlen`         — zwei Stände gibt es, aber noch nicht zwei verschiedene gewählt;
 *   · `bereit`          — erst jetzt läuft ein Abruf, und erst jetzt darf „Lädt …" erscheinen.
 */
export type Vergleichsauswahl =
  | "staendeLaden"
  | "staendeOffline"
  | "staendeFehler"
  | "zuWenige"
  | "waehlen"
  | "bereit";

export function vergleichsauswahl(eingabe: {
  staende: readonly number[] | undefined;
  staendeFehler: boolean;
  /** Läuft der Abruf der Stände gerade wirklich? Fehlt die Angabe, gilt er als laufend. */
  staendeLaeuft?: boolean;
  offline?: boolean;
  von: number | null;
  bis: number | null;
}): Vergleichsauswahl {
  if (eingabe.staende === undefined) {
    if (eingabe.staendeFehler) {
      return "staendeFehler";
    }
    if (eingabe.offline) {
      return "staendeOffline";
    }
    return eingabe.staendeLaeuft === false ? "staendeFehler" : "staendeLaden";
  }
  if (eingabe.staende.length < 2) {
    return "zuWenige";
  }
  if (eingabe.von === null || eingabe.bis === null || eingabe.von === eingabe.bis) {
    return "waehlen";
  }
  return "bereit";
}

function Standwahl({
  id,
  label,
  wert,
  staende,
  waehle,
}: {
  id: string;
  label: string;
  wert: number | null;
  staende: readonly number[];
  waehle: (version: number | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const neuester = staende.length > 0 ? Math.max(...staende) : null;
  const aeltester = staende.length > 0 ? Math.min(...staende) : null;
  return (
    <div className="min-w-0 flex-1 basis-40">
      <label htmlFor={id} className={FELD_LABEL}>
        {label}
      </label>
      <select
        id={id}
        value={wert === null ? "" : String(wert)}
        onChange={(e) => waehle(e.target.value === "" ? null : Number(e.target.value))}
        className={FELD}
      >
        <option value="">{t("fe001.vergleich.bitteWaehlen")}</option>
        {/* AUFSTEIGEND, wie vor FE-001: „Pfeil nach unten" heisst „neuerer Stand" — ein bestehender
            Tastaturvertrag (a8), den eine Umsortierung still umkehren würde. */}
        {[...staende]
          .sort((a, b) => a - b)
          .map((v) => (
            <option key={v} value={String(v)}>
              {v === neuester
                ? t("fe001.vergleich.standAktuell", { nummer: v })
                : v === aeltester
                  ? t("fe001.vergleich.standErster", { nummer: v })
                  : t("fe001.vergleich.stand", { nummer: v })}
            </option>
          ))}
      </select>
    </div>
  );
}

export function VergleichAnsicht({
  lage,
  vergleich,
  staende,
  von,
  bis,
  waehleVon,
  waehleBis,
  auswahl,
  abrufLaeuft,
  staendeNeuLaden,
  staendeAuffrischungFehler = false,
}: {
  lage: Anzeigelage;
  vergleich: AnweisungVergleich | undefined;
  staende: readonly number[];
  von: number | null;
  bis: number | null;
  waehleVon: (version: number | null) => void;
  waehleBis: (version: number | null) => void;
  /**
   * FE-001 · Ob verglichen werden kann. Fehlt die Angabe (ältere Aufrufer), wird sie aus `staende`,
   * `von` und `bis` abgeleitet — die Stände gelten dann als geladen.
   */
  auswahl?: Vergleichsauswahl;
  /** FE-001 · Läuft der Vergleichsabruf gerade wirklich? Nur dann steht „Lädt …". */
  abrufLaeuft?: boolean;
  /** RUNDE 2 · Der nächste Schritt, wenn die Stände fehlen: erneut abrufen. */
  staendeNeuLaden?: () => void;
  /**
   * LAUF 4 (Bens Befund BEN-01) · Das NACHLADEN der Stände ist gescheitert, obwohl eine ältere Liste
   * vorliegt. `auswahl` richtet sich weiter nach dieser Liste; der Fehler steht zusätzlich da, mit
   * dem nächsten Schritt — sonst sähe der Mensch nur den alten Stand und hielte ihn für aktuell.
   */
  staendeAuffrischungFehler?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const darfAussagen = gleichheitsaussageErlaubt(lage);
  const lageDerAuswahl = auswahl ?? vergleichsauswahl({ staende, staendeFehler: false, von, bis });
  const laeuft = abrufLaeuft ?? lage.art === "laden";
  const neuester = staende.length > 0 ? Math.max(...staende) : null;
  const vorletzter = staende.length > 1 ? [...staende].sort((a, b) => b - a)[1] : undefined;

  return (
    <section data-testid={VERGLEICH_MARKE} aria-labelledby="ga-vergleich-titel" className={KARTE}>
      <h2 id="ga-vergleich-titel" className={KARTEN_TITEL}>
        {t("ga.vergleich.titel")}
      </h2>
      <p className={HINWEIS}>{t("fe001.vergleich.einleitung")}</p>

      {lageDerAuswahl === "staendeLaden" ? (
        <p aria-live="polite" className={HINWEIS} data-testid={`${VERGLEICH_MARKE}-staende-laedt`}>
          {t("fe001.vergleich.staendeLaden")}
        </p>
      ) : null}
      {lageDerAuswahl === "staendeOffline" ? (
        <p
          role="alert"
          className={MELDUNG_HINWEIS}
          data-testid={`${VERGLEICH_MARKE}-staende-offline`}
        >
          {t("fe001.vergleich.staendeOffline")}
        </p>
      ) : null}
      {lageDerAuswahl === "staendeFehler" ? (
        <div
          role="alert"
          className={MELDUNG_FEHLER}
          data-testid={`${VERGLEICH_MARKE}-staende-fehler`}
        >
          <p>{t("fe001.vergleich.staendeFehler")}</p>
          {staendeNeuLaden ? (
            <button type="button" className={`${KNOPF_NEBEN} mt-2`} onClick={staendeNeuLaden}>
              {t("fe001.auswahl.erneutLaden")}
            </button>
          ) : null}
        </div>
      ) : null}
      {staendeAuffrischungFehler && lageDerAuswahl !== "staendeFehler" ? (
        <div
          role="alert"
          className={MELDUNG_FEHLER}
          data-testid={`${VERGLEICH_MARKE}-staende-auffrischung-fehler`}
        >
          <p>{t("fe001.vergleich.staendeAuffrischungFehler")}</p>
          {staendeNeuLaden ? (
            <button type="button" className={`${KNOPF_NEBEN} mt-2`} onClick={staendeNeuLaden}>
              {t("fe001.auswahl.erneutLaden")}
            </button>
          ) : null}
        </div>
      ) : null}
      {lageDerAuswahl === "zuWenige" ? (
        <p className={MELDUNG_HINWEIS} data-testid={`${VERGLEICH_MARKE}-zu-wenige`}>
          {t("fe001.vergleich.zuWenige", { count: staende.length })}
        </p>
      ) : null}

      {lageDerAuswahl === "waehlen" || lageDerAuswahl === "bereit" ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Standwahl
              id="ga-vergleich-von"
              label={t("ga.vergleich.von")}
              wert={von}
              staende={staende}
              waehle={waehleVon}
            />
            <Standwahl
              id="ga-vergleich-bis"
              label={t("ga.vergleich.bis")}
              wert={bis}
              staende={staende}
              waehle={waehleBis}
            />
          </div>
          {neuester !== null && vorletzter !== undefined ? (
            <button
              type="button"
              className={KNOPF_NEBEN}
              data-testid={`${VERGLEICH_MARKE}-letzte`}
              onClick={() => {
                waehleVon(vorletzter);
                waehleBis(neuester);
              }}
            >
              {t("fe001.vergleich.letzteAenderung")}
            </button>
          ) : null}
          {lageDerAuswahl === "waehlen" ? (
            <p className={HINWEIS} data-testid={`${VERGLEICH_MARKE}-waehlen`}>
              {t(
                von !== null && von === bis
                  ? "fe001.vergleich.gleicherStand"
                  : "fe001.vergleich.waehlen",
              )}
            </p>
          ) : null}
        </>
      ) : null}

      {lageDerAuswahl === "bereit" && laeuft && vergleich === undefined ? (
        <p aria-live="polite" className={HINWEIS}>
          {t("ga.laedt")}
        </p>
      ) : null}

      {lageDerAuswahl === "bereit" && lage.art === "fehler" ? (
        // Fehlersatz — und KEIN „unverändert" daneben.
        <p role="alert" className={MELDUNG_FEHLER}>
          {t(lage.offline ? "ga.offline" : "ga.fehler")}
        </p>
      ) : null}

      {lageDerAuswahl === "bereit" && lage.art === "stand" && vergleich ? (
        <div data-testid={`${VERGLEICH_MARKE}-ergebnis`} className="space-y-2">
          {darfAussagen ? (
            <>
              <p
                className="text-[13px] font-semibold text-text"
                data-testid={`${VERGLEICH_MARKE}-gesamt`}
              >
                {t(SATZ[vergleich.gesamt])}
              </p>
              {/* Die unbestimmbaren Befunde bleiben sichtbar, auch wenn etwas anderes „geändert" ist. */}
              <p className={HINWEIS} data-testid={`${VERGLEICH_MARKE}-unbekannte`}>
                {t("ga.vergleich.unbekannte", { anzahl: vergleich.unbekannte })}
              </p>
              <ul className="space-y-1">
                {vergleich.befunde.map((befund) => (
                  <li
                    key={`${befund.feld}-${befund.bausteinId ?? "anweisung"}`}
                    data-auswirkung={befund.auswirkung}
                    className="text-[12.5px] leading-relaxed text-text"
                  >
                    {/* Farbe nie allein: die Auswirkung steht als WORT in der Zeile. Und das
                        Feld steht als SATZ, nicht als Maschinenschlüssel — ein
                        „tabellenueberschriften" im Nutzertext ist genau der Befund N-0053. */}
                    <span className="font-semibold">{t(`ga.feld.${befund.feld}`)}</span> ·{" "}
                    {t(SATZ[befund.auswirkung])} · {befund.hinweis}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            // GAR KEINE Gleichheitsaussage — auch nicht je Befund. Ein vorhandenes Ergebnis neben
            // einem Fehlersatz würde gelesen, als gälte es; es gilt aber für einen Stand, den
            // niemand mehr bestätigen konnte.
            <>
              <p role="alert" className={MELDUNG_FEHLER}>
                {t(lage.offline ? "ga.offline" : "ga.fehler")}
              </p>
              <p data-testid={`${VERGLEICH_MARKE}-gesamt`}>{t("ga.vergleich.keineAussage")}</p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
