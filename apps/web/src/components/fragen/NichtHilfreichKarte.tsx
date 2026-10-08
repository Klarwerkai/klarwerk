// ================================================================================================
// R-1649 (ROADMAP 7.3) — DIE BESTÄTIGUNG NACH „DAS WAR NICHT HILFREICH, ICH HABE ES SO GEMACHT …".
// ================================================================================================
//
// Die Fläche hat den gesprochenen Satz erkannt (`lib/nichtHilfreich.ts`). Gespeichert wird erst
// nach diesem einen Klick: eine Fehlerkennung des Diktats darf weder eine Negativ-Bewährung noch
// einen Entwurf anlegen. Wer es doch als Frage gemeint hat, stellt es mit dem zweiten Knopf.
//
// Der abweichende Weg steht editierbar da, damit Erkennungsfehler vor dem Entwurf korrigiert werden.
// Darf die Rolle keine Entwürfe anlegen (`/erfassen` wie überall über `routePathAllows`), wird nur
// die Rückmeldung angeboten und das offen gesagt — der Weg wird nicht still verworfen.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRole } from "../../app/RoleContext";
import { routePathAllows } from "../../app/navigation";

export function NichtHilfreichKarte({
  quelleTitel,
  alternative: erkannt,
  laeuft,
  onBestaetigen,
  onAlsFrage,
  onVerwerfen,
}: {
  /** Titel der tragenden Quelle, auf die sich die Rückmeldung bezieht. */
  quelleTitel: string;
  /** Der erkannte abweichende Weg; leer, wenn keiner genannt wurde. */
  alternative: string;
  laeuft: boolean;
  /** `alternative` ist nur gesetzt, wenn ein Entwurf angelegt werden soll und darf. */
  onBestaetigen: (alternative: string | null) => void;
  onAlsFrage: () => void;
  onVerwerfen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const { role } = useRole();
  const darfEntwurf = routePathAllows("/erfassen", role);
  const [weg, setWeg] = useState(erkannt);
  const mitEntwurf = darfEntwurf && weg.trim().length > 0;

  return (
    <div
      data-testid="ask-nicht-hilfreich"
      className="mt-3 rounded-btn border border-hairline bg-surface px-4 py-3 text-[14px] text-text"
    >
      <p className="font-semibold">{t("sprachfeedback.erkannt", { titel: quelleTitel })}</p>
      {darfEntwurf ? (
        <label className="mt-2 block text-[13px] text-muted">
          {t("sprachfeedback.wegLabel")}
          <textarea
            data-testid="ask-nicht-hilfreich-weg"
            value={weg}
            onChange={(e) => setWeg(e.target.value)}
            rows={3}
            maxLength={8000}
            className="mt-1 block w-full rounded-btn border border-hairline bg-page px-3 py-2 text-[14px] text-text"
          />
        </label>
      ) : erkannt ? (
        <p data-testid="ask-nicht-hilfreich-kein-entwurf" className="mt-2 text-[13px] text-muted">
          {t("sprachfeedback.keinEntwurfRecht")}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="ask-nicht-hilfreich-bestaetigen"
          disabled={laeuft}
          onClick={() => onBestaetigen(mitEntwurf ? weg.trim() : null)}
          className="inline-flex items-center rounded-[10px] bg-brand px-4 py-2 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mitEntwurf ? t("sprachfeedback.bestaetigenMitEntwurf") : t("sprachfeedback.bestaetigen")}
        </button>
        <button
          type="button"
          data-testid="ask-nicht-hilfreich-als-frage"
          disabled={laeuft}
          onClick={onAlsFrage}
          className="inline-flex items-center rounded-[10px] border border-hairline bg-surface px-4 py-2 text-[14px] text-text hover:bg-hairline-soft disabled:opacity-50"
        >
          {t("sprachfeedback.alsFrage")}
        </button>
        <button
          type="button"
          data-testid="ask-nicht-hilfreich-verwerfen"
          disabled={laeuft}
          onClick={onVerwerfen}
          className="inline-flex items-center rounded-[10px] px-4 py-2 text-[14px] text-muted hover:underline disabled:opacity-50"
        >
          {t("sprachfeedback.verwerfen")}
        </button>
      </div>
    </div>
  );
}
