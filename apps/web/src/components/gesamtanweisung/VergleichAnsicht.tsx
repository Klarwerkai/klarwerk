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
import { useTranslation } from "react-i18next";
import type { AnweisungVergleich, Auswirkung } from "../../api/types";
import { type Anzeigelage, gleichheitsaussageErlaubt } from "./zustand";

export const VERGLEICH_MARKE = "ga-vergleich";

const SATZ: Record<Auswirkung, string> = {
  unveraendert: "ga.vergleich.unveraendert",
  geaendert: "ga.vergleich.geaendert",
  unbekannt: "ga.vergleich.unbekannt",
};

export function VergleichAnsicht({
  lage,
  vergleich,
  staende,
  von,
  bis,
  waehleVon,
  waehleBis,
}: {
  lage: Anzeigelage;
  vergleich: AnweisungVergleich | undefined;
  staende: readonly number[];
  von: number | null;
  bis: number | null;
  waehleVon: (version: number | null) => void;
  waehleBis: (version: number | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const darfAussagen = gleichheitsaussageErlaubt(lage);

  return (
    <section data-testid={VERGLEICH_MARKE}>
      <h3>{t("ga.vergleich.titel")}</h3>
      <label htmlFor="ga-vergleich-von">{t("ga.vergleich.von")}</label>
      <select
        id="ga-vergleich-von"
        value={von === null ? "" : String(von)}
        onChange={(e) => waehleVon(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">—</option>
        {staende.map((v) => (
          <option key={v} value={String(v)}>
            {v}
          </option>
        ))}
      </select>
      <label htmlFor="ga-vergleich-bis">{t("ga.vergleich.bis")}</label>
      <select
        id="ga-vergleich-bis"
        value={bis === null ? "" : String(bis)}
        onChange={(e) => waehleBis(e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">—</option>
        {staende.map((v) => (
          <option key={v} value={String(v)}>
            {v}
          </option>
        ))}
      </select>

      {lage.art === "laden" ? <p aria-live="polite">{t("ga.laedt")}</p> : null}

      {lage.art === "fehler" ? (
        // Fehlersatz — und KEIN „unverändert" daneben.
        <p role="alert">{t(lage.offline ? "ga.offline" : "ga.fehler")}</p>
      ) : null}

      {lage.art === "stand" && vergleich ? (
        <div data-testid={`${VERGLEICH_MARKE}-ergebnis`}>
          {darfAussagen ? (
            <>
              <p data-testid={`${VERGLEICH_MARKE}-gesamt`}>{t(SATZ[vergleich.gesamt])}</p>
              {/* Die unbestimmbaren Befunde bleiben sichtbar, auch wenn etwas anderes „geändert" ist. */}
              <p data-testid={`${VERGLEICH_MARKE}-unbekannte`}>
                {t("ga.vergleich.unbekannte", { anzahl: vergleich.unbekannte })}
              </p>
              <ul>
                {vergleich.befunde.map((befund) => (
                  <li
                    key={`${befund.feld}-${befund.bausteinId ?? "anweisung"}`}
                    data-auswirkung={befund.auswirkung}
                  >
                    {/* Farbe nie allein: die Auswirkung steht als WORT in der Zeile. Und das
                        Feld steht als SATZ, nicht als Maschinenschlüssel — ein
                        „tabellenueberschriften" im Nutzertext ist genau der Befund N-0053. */}
                    {t(`ga.feld.${befund.feld}`)} · {t(SATZ[befund.auswirkung])} · {befund.hinweis}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            // GAR KEINE Gleichheitsaussage — auch nicht je Befund. Ein vorhandenes Ergebnis neben
            // einem Fehlersatz würde gelesen, als gälte es; es gilt aber für einen Stand, den
            // niemand mehr bestätigen konnte.
            <>
              <p role="alert">{t(lage.offline ? "ga.offline" : "ga.fehler")}</p>
              <p data-testid={`${VERGLEICH_MARKE}-gesamt`}>{t("ga.vergleich.keineAussage")}</p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
