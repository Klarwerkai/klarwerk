// ==================================================================================================
// JOB 4154 · DER LESESTAND — HERKUNFT JE BAUSTEIN, UND KEINE BEHAUPTUNG ZU VIEL.
// ==================================================================================================
//
// REIN DARSTELLEND: die Lage kommt fertig herein (`zustand.ts`), die Daten auch. Damit ist jede
// der sieben Lagen aus Abschnitt 9 einzeln prüfbar, ohne Abfrage und ohne Netz.
//
// WAS DIESE ANSICHT NIE TUT:
//   · aus der gebundenen Fassung die heutige machen — sie zeigt `koVersion`, und ein
//     Aktualisierungsvorschlag steht DANEBEN, nicht darin;
//   · beim Fehler etwas über Vollständigkeit oder Gleichheit sagen;
//   · eine unbekannte Menge als leere ausgeben (`mengenSchluessel` trennt die drei Fälle);
//   · Farbe allein sprechen lassen — jeder Zustand trägt Text.
import { useTranslation } from "react-i18next";
import type { AnweisungLesestand, BausteinLesestand } from "../../api/types";
import { VoraussetzungFeld } from "./VoraussetzungFeld";
import { type Anzeigelage, mengenSchluessel, standSchluessel } from "./zustand";

/** Was ein Baustein an Bearbeitung zulässt. Fehlt es, ist die Liste reine Lesefläche. */
export interface Bausteinbearbeitung {
  readonly verschieben: (bausteinId: string, richtung: -1 | 1) => void;
  readonly voraussetzung: (bausteinId: string, wert: string | null) => void;
  readonly gesperrt: boolean;
}

export const LESESTAND_MARKE = "ga-lesestand";

function Menge({
  schluessel,
  werte,
}: {
  schluessel: "ga.baustein.tabellen" | "ga.baustein.abbildungen";
  werte: readonly string[] | null;
}): JSX.Element {
  const { t } = useTranslation();
  const auskunft = mengenSchluessel(werte);
  return <li>{t(schluessel, { werte: auskunft.werte ?? t(auskunft.schluessel) })}</li>;
}

function BausteinZeile({
  baustein,
  bearbeiten,
}: {
  baustein: BausteinLesestand;
  bearbeiten?: Bausteinbearbeitung;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <li data-testid={`${LESESTAND_MARKE}-baustein`} data-baustein={baustein.id}>
      <p>{t("ga.baustein.fassung", { version: baustein.koVersion })}</p>
      {baustein.herkunft ? (
        <p>
          {t("ga.baustein.herkunft", {
            titel: baustein.herkunft.titel,
            autor: baustein.herkunft.autor,
          })}
          {" · "}
          {baustein.herkunft.fassungAm ?? t("ga.baustein.fassungAmUnbekannt")}
        </p>
      ) : (
        // Wissenslücke statt Erfindung: es wird NICHT auf die heutige Fassung ausgewichen.
        <p>{t("ga.baustein.herkunftUnbekannt")}</p>
      )}
      {baustein.aktualisierungsvorschlag ? (
        <p data-testid={`${LESESTAND_MARKE}-vorschlag`}>
          {t("ga.baustein.aktualisierung", {
            version: baustein.aktualisierungsvorschlag.aufVersion,
          })}
        </p>
      ) : null}
      {baustein.nachweisHash === null ? <p>{t("ga.baustein.nachweisFehlt")}</p> : null}
      {baustein.voraussetzung ? (
        <p>
          {t("ga.voraussetzung.label")}: {baustein.voraussetzung}
        </p>
      ) : null}
      <ul>
        <Menge schluessel="ga.baustein.tabellen" werte={baustein.inhalt.tabellenUeberschriften} />
        <Menge schluessel="ga.baustein.abbildungen" werte={baustein.inhalt.abbildungen} />
      </ul>
      {bearbeiten ? (
        <>
          <p>
            <button
              type="button"
              onClick={() => bearbeiten.verschieben(baustein.id, -1)}
              disabled={bearbeiten.gesperrt}
            >
              {t("ga.ordnen.hoch")}
            </button>
            <button
              type="button"
              onClick={() => bearbeiten.verschieben(baustein.id, 1)}
              disabled={bearbeiten.gesperrt}
            >
              {t("ga.ordnen.runter")}
            </button>
          </p>
          <VoraussetzungFeld
            bausteinId={baustein.id}
            wert={baustein.voraussetzung}
            gesperrt={bearbeiten.gesperrt}
            uebernehmen={(wert) => bearbeiten.voraussetzung(baustein.id, wert)}
          />
        </>
      ) : null}
    </li>
  );
}

export function LesestandAnsicht({
  lage,
  stand,
  zeit,
  bearbeiten,
}: {
  lage: Anzeigelage;
  stand: AnweisungLesestand | undefined;
  /** Der Zeitpunkt, auf den sich der angezeigte Stand bezieht. */
  zeit: string;
  bearbeiten?: Bausteinbearbeitung;
}): JSX.Element {
  const { t } = useTranslation();

  if (lage.art === "laden") {
    // KEINE Mengen-, Vollständigkeits- oder Gleichheitsaussage — nur, dass geladen wird.
    return (
      <section data-testid={LESESTAND_MARKE}>
        <p aria-live="polite">{t("ga.laedt")}</p>
      </section>
    );
  }

  if (lage.art === "fehler") {
    // Fehlersatz und GAR NICHTS über Vollständigkeit, Gleichheit oder Freigabe.
    return (
      <section data-testid={LESESTAND_MARKE}>
        <p role="alert">{t(lage.offline ? "ga.offline" : "ga.fehler")}</p>
      </section>
    );
  }

  if (lage.art === "leer" || !stand) {
    return (
      <section data-testid={LESESTAND_MARKE}>
        <p>{t("ga.leer")}</p>
      </section>
    );
  }

  const standzeile = standSchluessel(lage);
  return (
    <section data-testid={LESESTAND_MARKE}>
      <h2>{stand.titel}</h2>
      <p data-testid={`${LESESTAND_MARKE}-stand`}>{t(`ga.stand.${stand.stand}`)}</p>
      {standzeile ? <p data-testid={`${LESESTAND_MARKE}-zeit`}>{t(standzeile, { zeit })}</p> : null}
      {lage.auffrischungGescheitert || lage.offline ? (
        // Der alte Stand BLEIBT stehen und der Fehler ist trotzdem sichtbar — er wird nicht als
        // frisch ausgegeben (Lehre 03.09., JOB 3027/3025/3037).
        <p role="alert">{t(lage.offline ? "ga.offline" : "ga.fehler")}</p>
      ) : null}
      <p>
        {t("ga.kopf.zweck")}: {stand.zweck}
      </p>
      <p>
        {t("ga.kopf.geltungsbereich")}: {stand.geltungsbereich}
      </p>
      <p>
        {t("ga.kopf.voraussetzungen")}: {stand.voraussetzungen}
      </p>
      {stand.unvollstaendig ? (
        <p data-testid={`${LESESTAND_MARKE}-unvollstaendig`} role="alert">
          {t("ga.unvollstaendig")} {t("ga.verborgene", { anzahl: stand.verborgeneBausteine })}
        </p>
      ) : null}
      {/* Der Lückenvermerk kommt vom Server und steht sichtbar — kein grüner Haken. */}
      <p data-testid={`${LESESTAND_MARKE}-pruefanbindung`}>{t("ga.pruefanbindung")}</p>
      <h3>{t("ga.bausteine")}</h3>
      {stand.bausteine.length === 0 ? (
        <p>{t("ga.leer")}</p>
      ) : (
        <ol>
          {stand.bausteine.map((baustein) => (
            <BausteinZeile
              key={baustein.id}
              baustein={baustein}
              {...(bearbeiten ? { bearbeiten } : {})}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
