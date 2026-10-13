// OCR-E02 · Erkannten Bildtext berichtigen, rückgängig machen, auf den Rohbefund zurücksetzen.
//
//   · Rohbefund und Berichtigung bleiben unterscheidbar: die Berichtigung ist als solche
//     gekennzeichnet, der Rohbefund der Erkennung steht aufklappbar daneben.
//   · Gespeichert wird am Konto, gebunden an Quelle und Bildfassung (`lib/bildKorrektur.ts`,
//     `/api/me/assistenz/bildkorrekturen`); Bild und Datei werden nicht angefasst.
//   · Ob berichtigt werden darf, entscheidet der Server (`ko.create`). Ohne das Recht gibt es keine
//     Bearbeitung — und ein Schreibversuch würde mit 403 abgewiesen.
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BildBefund } from "../lib/bildAutomatik";
import { andereFassungBerichtigt, berichtigbar, ortKennung } from "../lib/bildKorrektur";
import { type BildKorrekturStand, aendereBildKorrektur } from "../lib/bildKorrekturenStand";

const KNOPF =
  "inline-flex h-7 items-center rounded-btn border border-hairline bg-surface px-2 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40";

type Meldung = { art: "ok" | "fehler"; text: string } | null;

export function BildTextBerichtigung({
  befund,
  quelle,
  stand,
  ort,
}: {
  /** Der Befund MIT wirksamer Berichtigung (`befundMitKorrektur`). */
  befund: BildBefund;
  /** Die volle Bindung an die Quelle (`korrekturQuelleFuer`). */
  quelle: string;
  stand: BildKorrekturStand;
  /** Die Fundstelle im Wortlaut der Oberfläche. */
  ort: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  const feldId = useId();
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<Meldung>(null);
  if (!berichtigbar(befund)) {
    return null;
  }
  const kennung = befund.inhaltskennung;
  const k = befund.korrektur;
  const darf = stand.status === "bereit" && stand.darfBearbeiten;
  const andere = !k && andereFassungBerichtigt(stand.korrekturen, quelle, befund);

  const sende = async (
    aktion: "setzen" | "rueckgaengig" | "zuruecksetzen",
    text?: string,
  ): Promise<void> => {
    setLaeuft(true);
    setMeldung(null);
    const ergebnis = await aendereBildKorrektur(
      aktion === "setzen"
        ? {
            aktion,
            quelle,
            inhaltskennung: kennung,
            ort: ortKennung(befund.fundstelle),
            text: text ?? "",
          }
        : { aktion, quelle, inhaltskennung: kennung },
    );
    setLaeuft(false);
    if (ergebnis.art === "gespeichert") {
      setEntwurf(null);
      setMeldung({
        art: "ok",
        text:
          ergebnis.korrektur === null
            ? t("bildfundstelle.korrektur.zurueckgesetzt")
            : t("bildfundstelle.korrektur.gespeichert"),
      });
    } else if (ergebnis.art === "verweigert") {
      setMeldung({ art: "fehler", text: t("bildfundstelle.korrektur.verweigert") });
    } else {
      setMeldung({
        art: "fehler",
        text: t("bildfundstelle.korrektur.fehler", { grund: ergebnis.meldung }),
      });
    }
  };

  return (
    <div data-testid="bild-berichtigung" data-berichtigt={k ? "true" : "false"} className="mt-1">
      {k ? (
        <p data-testid="bild-berichtigung-hinweis" className="font-semibold text-ai">
          {t("bildfundstelle.korrektur.berichtigt")}
        </p>
      ) : null}
      {andere ? (
        <p data-testid="bild-berichtigung-andere-fassung" className="text-trust-warn-text">
          {t("bildfundstelle.korrektur.andereFassung")}
        </p>
      ) : null}
      {k ? (
        <details className="mt-0.5">
          <summary className="cursor-pointer text-muted">
            {t("bildfundstelle.korrektur.rohbefund")}
          </summary>
          <pre
            data-testid="bild-berichtigung-roh"
            className="mt-0.5 whitespace-pre-wrap break-words font-sans text-muted"
          >
            {k.rohGekennzeichnet}
          </pre>
        </details>
      ) : null}
      {entwurf !== null ? (
        <div className="mt-1 space-y-1">
          <label htmlFor={feldId} className="block font-semibold text-text">
            {t("bildfundstelle.korrektur.feld", { ort })}
          </label>
          <textarea
            id={feldId}
            data-testid="bild-berichtigung-feld"
            value={entwurf}
            onChange={(e) => setEntwurf(e.target.value)}
            rows={Math.min(8, Math.max(2, entwurf.split("\n").length))}
            className="w-full rounded-input border border-hairline bg-surface px-2 py-1 text-[13px] outline-none focus:border-ink/30"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="bild-berichtigung-speichern"
              className={KNOPF}
              disabled={laeuft}
              onClick={() => void sende("setzen", entwurf)}
            >
              {t("bildfundstelle.korrektur.speichern")}
            </button>
            <button
              type="button"
              className={KNOPF}
              disabled={laeuft}
              onClick={() => setEntwurf(null)}
            >
              {t("bildfundstelle.korrektur.abbrechen")}
            </button>
          </div>
        </div>
      ) : darf ? (
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="bild-berichtigung-bearbeiten"
            className={KNOPF}
            disabled={laeuft}
            onClick={() => setEntwurf(befund.textGekennzeichnet)}
          >
            {k
              ? t("bildfundstelle.korrektur.bearbeiten")
              : t("bildfundstelle.korrektur.berichtigen")}
          </button>
          {k ? (
            <button
              type="button"
              data-testid="bild-berichtigung-rueckgaengig"
              className={KNOPF}
              disabled={laeuft}
              onClick={() => void sende("rueckgaengig")}
            >
              {t("bildfundstelle.korrektur.rueckgaengig")}
            </button>
          ) : null}
          {k ? (
            <button
              type="button"
              data-testid="bild-berichtigung-zuruecksetzen"
              className={KNOPF}
              disabled={laeuft}
              onClick={() => void sende("zuruecksetzen")}
            >
              {t("bildfundstelle.korrektur.zuruecksetzen")}
            </button>
          ) : null}
        </div>
      ) : null}
      {meldung ? (
        meldung.art === "ok" ? (
          <output data-testid="bild-berichtigung-meldung" className="mt-1 block text-muted">
            {meldung.text}
          </output>
        ) : (
          <p
            data-testid="bild-berichtigung-meldung"
            role="alert"
            className="mt-1 text-trust-crit-text"
          >
            {meldung.text}
          </p>
        )
      ) : null}
    </div>
  );
}
