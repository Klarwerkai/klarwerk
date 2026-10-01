// ==================================================================================================
// FE-001 · WORUM GEHT ES? — TITEL, ZWECK, GELTUNGSBEREICH UND VORAUSSETZUNGEN BEARBEITEN.
// ==================================================================================================
//
// Der Kopfvertrag (`AnweisungKopfEingabe`) und seine Tür (`PUT /api/gesamtanweisungen/:id`) gab es
// seit JOB 4154 — eine Bedienung dafür nicht: wer eine Anleitung anlegte, bekam leere Zeilen
// „Zweck:", „Geltungsbereich:" und konnte sie nirgends füllen. Ein lesbares Dokument für Menschen
// beginnt aber genau dort (Startvertrag: „Titel, Zweck, Geltungsbereich, Voraussetzungen").
//
// DREI ZUSAGEN:
//   · NICHTS GILT ALS GESPEICHERT, BEVOR DER SERVER ES BESTÄTIGT. Scheitert das Speichern (Konflikt,
//     Rechte, offline), bleibt der Text im Feld stehen und die Absage steht daneben.
//   · UNGESPEICHERTES WIRD NICHT ÜBERSCHRIEBEN. Jeder andere Schreibweg (Abschnitt aufnehmen,
//     Reihenfolge) erhöht die Version und frischt den Lesestand auf; übernommen wird der neue
//     Serverstand nur in Felder, die gerade NICHT in Bearbeitung sind.
//   · DER TITEL DARF NICHT LEER WERDEN — mit sichtbarem Grund statt stummem grauen Knopf.
//
// RUNDE 2 (Bens Befunde E3/E8/E9):
//   · „Gespeichert" gilt NUR für den gesendeten Stand. Wer während einer laufenden Speicherung
//     weitertippt, behält danach „noch nicht gespeichert" und einen bedienbaren Knopf.
//   · Der Zustand „ungespeichert" wird nach oben gemeldet (`meldeUngespeichert`) — die Seite sperrt
//     damit das Vorlegen mit sichtbarem Grund.
//   · Die Kartenüberschrift trägt eine EIGENE Kennung; vorher teilte sie `ga-kopf-titel` mit dem
//     Titelfeld, und die Beschriftung „Titel" zeigte ins Leere.
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AnweisungKopfEingabe } from "../../api/types";
import {
  BESTAETIGUNG,
  FELD,
  FELD_LABEL,
  FELD_MEHRZEILIG,
  HINWEIS,
  KARTE,
  KARTEN_TITEL,
  KNOPF_HAUPT,
  MELDUNG_FEHLER,
} from "./gestaltung";

export const KOPF_MARKE = "ga-kopf";

type Kopf = Required<AnweisungKopfEingabe>;

const FELDER = ["titel", "zweck", "geltungsbereich", "voraussetzungen"] as const;

export function KopfBearbeitung({
  kopf,
  gesperrt,
  grund,
  speichern,
  fehler,
  meldeUngespeichert,
}: {
  /** Der zuletzt vom Server gelesene Kopf — oder `null`, solange keiner vorliegt. */
  kopf: Kopf | null;
  gesperrt: boolean;
  /** Der Satz, der die Sperre erklärt. */
  grund: string | null;
  /** Gibt nach BESTÄTIGTEM Speichern `true` zurück, sonst `false`. */
  speichern: (kopf: Kopf) => Promise<boolean>;
  /** Der i18n-Schlüssel der letzten Absage, oder `null`. */
  fehler: string | null;
  /** Meldet, ob gerade ungespeicherte Eingaben im Formular stehen. */
  meldeUngespeichert?: (ungespeichert: boolean) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [werte, setWerte] = useState<Kopf>(
    kopf ?? { titel: "", zweck: "", geltungsbereich: "", voraussetzungen: "" },
  );
  const [geaendert, setGeaendertZustand] = useState(false);
  // Derselbe Wert als Ref: der Übernahme-Effekt unten darf nie mit einem VERALTETEN „nicht
  // geändert" laufen. Gemessen im Browser (FE-001): kam der Lesestand genau während des Tippens an,
  // überschrieb der Effekt das gerade getippte Feld mit dem Serverstand.
  const geaendertRef = useRef(false);
  const setGeaendert = (wert: boolean): void => {
    geaendertRef.current = wert;
    setGeaendertZustand(wert);
  };
  // Der Stand, der GERADE im Formular steht — auch während eine Speicherung unterwegs ist.
  const werteRef = useRef<Kopf>(werte);
  werteRef.current = werte;
  useEffect(() => {
    meldeUngespeichert?.(geaendert);
  }, [geaendert, meldeUngespeichert]);
  const [gespeichert, setGespeichert] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  // Einen NEUEN Serverstand übernehmen — aber nie über ungespeicherte Eingaben hinweg. Nur `kopf`
  // löst aus: nach dem Speichern darf nicht der noch alte Stand zurückgeschrieben werden, bevor die
  // Auffrischung den gespeicherten liefert.
  useEffect(() => {
    if (kopf && !geaendertRef.current) {
      setWerte(kopf);
    }
  }, [kopf]);

  const titelLeer = werte.titel.trim().length === 0;

  async function absenden(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (gesperrt || titelLeer || laeuft || !geaendert) {
      return;
    }
    setLaeuft(true);
    const gesendet: Kopf = {
      titel: werte.titel.trim(),
      zweck: werte.zweck.trim(),
      geltungsbereich: werte.geltungsbereich.trim(),
      voraussetzungen: werte.voraussetzungen.trim(),
    };
    const erfolg = await speichern(gesendet);
    setLaeuft(false);
    if (erfolg) {
      // Bestätigt ist NUR der gesendete Stand. Steht inzwischen etwas anderes im Formular, bleibt
      // es ausdrücklich ungespeichert.
      const jetzt = werteRef.current;
      const weiterGeaendert = FELDER.some((feld) => jetzt[feld].trim() !== gesendet[feld]);
      setGeaendert(weiterGeaendert);
      setGespeichert(!weiterGeaendert);
    }
  }

  const sperrSatz = gesperrt
    ? grund
    : titelLeer
      ? "fe001.kopf.titelPflicht"
      : !geaendert
        ? "fe001.kopf.nichtsGeaendert"
        : null;

  return (
    <section data-testid={KOPF_MARKE} aria-labelledby="ga-kopf-ueberschrift" className={KARTE}>
      <h2 id="ga-kopf-ueberschrift" className={KARTEN_TITEL}>
        {t("fe001.kopf.titel")}
      </h2>
      <p className={HINWEIS}>{t("fe001.kopf.einleitung")}</p>
      <form onSubmit={absenden} className="space-y-3">
        {FELDER.map((feld) => {
          const id = `ga-kopf-${feld}`;
          const hinweisId = `${id}-hinweis`;
          const gemeinsam = {
            id,
            name: feld,
            value: werte[feld],
            "aria-describedby": hinweisId,
            // Erst bearbeitbar, wenn der gespeicherte Kopf da ist — sonst tippte man in Felder, deren
            // Inhalt gleich darauf der Server liefert.
            readOnly: kopf === null,
            onChange: (e: { target: { value: string } }) => {
              setWerte((vorher) => ({ ...vorher, [feld]: e.target.value }));
              setGeaendert(true);
              setGespeichert(false);
            },
          };
          return (
            <div key={feld}>
              <label htmlFor={id} className={FELD_LABEL}>
                {t(`ga.kopf.${feld}`)}
              </label>
              {feld === "titel" ? (
                <input {...gemeinsam} required className={FELD} />
              ) : (
                <textarea {...gemeinsam} rows={2} className={FELD_MEHRZEILIG} />
              )}
              <p id={hinweisId} className={`${HINWEIS} mt-1`}>
                {t(`fe001.kopf.hinweis.${feld}`)}
              </p>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className={KNOPF_HAUPT}
            disabled={sperrSatz !== null || laeuft}
            aria-describedby={sperrSatz ? "ga-kopf-sperre" : undefined}
            data-testid={`${KOPF_MARKE}-speichern`}
          >
            {t("fe001.kopf.speichern")}
          </button>
          {sperrSatz ? (
            <p id="ga-kopf-sperre" className={HINWEIS} data-testid={`${KOPF_MARKE}-sperre`}>
              {t(sperrSatz)}
            </p>
          ) : null}
        </div>
        <div aria-live="polite">
          {geaendert ? (
            <p className={HINWEIS} data-testid={`${KOPF_MARKE}-ungespeichert`}>
              {t("fe001.kopf.ungespeichert")}
            </p>
          ) : gespeichert ? (
            <p className={BESTAETIGUNG} data-testid={`${KOPF_MARKE}-gespeichert`}>
              {t("fe001.kopf.gespeichert")}
            </p>
          ) : null}
        </div>
        {fehler ? (
          <p role="alert" className={MELDUNG_FEHLER} data-testid={`${KOPF_MARKE}-fehler`}>
            {t(fehler)}
          </p>
        ) : null}
      </form>
    </section>
  );
}
