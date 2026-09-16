// ==================================================================================================
// JOB 4154 · EINE VORHANDENE FASSUNG AUFNEHMEN — EINTRAG UND FASSUNG, BEIDES PFLICHT.
// ==================================================================================================
//
// DIE FASSUNGSNUMMER IST EIN EIGENES FELD UND KEIN KOMFORTVERZICHT. Wer nur den Eintrag wählen
// könnte, bekäme „die aktuelle Fassung" — und damit genau die stille Ersetzung, die der
// Startvertrag verbietet. Deshalb gibt es hier zwei Pflichtfelder und keinen Vorbelegungstrick.
//
// OHNE KI und vollständig mit der Tastatur: echte `<label>`/`<input>`/`<button>`-Elemente in einem
// `<form>`. Absenden geht mit Enter im Feld wie mit dem Knopf; nichts hängt an einem Zeigegerät.
// Eingaben bleiben beim Scheitern STEHEN — der Zustand wird erst nach einem bestätigten Erfolg
// geleert.
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

export const AUFNAHME_MARKE = "ga-aufnahme";

export function BausteinAufnahme({
  aufnehmen,
  gesperrt,
  grund,
}: {
  aufnehmen: (eingabe: {
    koId: string;
    koVersion: number;
    nachweisHash: string | null;
  }) => Promise<boolean>;
  gesperrt: boolean;
  /** Der Satz, der die Sperre erklärt. Eine Sperre ohne Grund wäre ein toter Knopf. */
  grund: string | null;
}): JSX.Element {
  const { t } = useTranslation();
  const [koId, setKoId] = useState("");
  const [koVersion, setKoVersion] = useState("");
  const [nachweis, setNachweis] = useState("");

  const fassung = Number.parseInt(koVersion, 10);
  const vollstaendig = koId.trim().length > 0 && Number.isInteger(fassung) && fassung > 0;

  async function absenden(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!vollstaendig || gesperrt) {
      return;
    }
    const erfolg = await aufnehmen({
      koId: koId.trim(),
      koVersion: fassung,
      nachweisHash: nachweis.trim().length > 0 ? nachweis.trim() : null,
    });
    // NUR nach bestätigtem Erfolg leeren. Scheitert der Aufruf, steht die Eingabe noch da.
    if (erfolg) {
      setKoId("");
      setKoVersion("");
      setNachweis("");
    }
  }

  return (
    <form data-testid={AUFNAHME_MARKE} onSubmit={absenden}>
      <h3>{t("ga.aufnahme.titel")}</h3>
      <label htmlFor="ga-aufnahme-koid">{t("ga.aufnahme.koId")}</label>
      <input
        id="ga-aufnahme-koid"
        name="koId"
        value={koId}
        required
        onChange={(e) => setKoId(e.target.value)}
      />
      <label htmlFor="ga-aufnahme-fassung">{t("ga.aufnahme.koVersion")}</label>
      <input
        id="ga-aufnahme-fassung"
        name="koVersion"
        type="number"
        min={1}
        step={1}
        value={koVersion}
        required
        onChange={(e) => setKoVersion(e.target.value)}
      />
      <label htmlFor="ga-aufnahme-nachweis">{t("ga.aufnahme.nachweis")}</label>
      <input
        id="ga-aufnahme-nachweis"
        name="nachweisHash"
        value={nachweis}
        onChange={(e) => setNachweis(e.target.value)}
      />
      <button type="submit" disabled={gesperrt || !vollstaendig}>
        {t("ga.aufnahme.knopf")}
      </button>
      {gesperrt && grund ? <p role="alert">{t(grund)}</p> : null}
    </form>
  );
}
