import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";

// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · Entscheidungen 18/19 (R-0573) — DIE WEISUNG SETZEN.
// ================================================================================================
//
// Präsentational wie die übrigen Bauteile unter `trust/`: Konten, betroffene Punkte und Rückrufe
// kommen von der Lesefläche. Pflicht sind die verantwortliche Person der Sichtung und die Frist
// (Entscheidung 19). Hat der Server betroffene Punkte vorgelegt (409 `WEISUNG_PUNKTE_OFFEN`),
// stehen sie hier EINZELN — jeder lässt sich ausdrücklich bestehen lassen; überstimmt wird über die
// Konfliktentscheidung, nicht hier. Ob die Weisung gilt, entscheidet allein der Server.

export interface BetroffenerPunktAnzeige {
  conflictId: string;
  koId: string;
  titel: string;
}

export interface WeisungDialogProps {
  bereich: string;
  /** Wählbare Konten für die Sichtung — ohne die weisende Person selbst. */
  konten: readonly { id: string; name: string }[];
  punkte: readonly BetroffenerPunktAnzeige[];
  laeuft: boolean;
  fehler: string | null;
  aufSetzen: (eingabe: { verantwortlich: string; frist: string; bestehenLassen: string[] }) => void;
  aufAbbrechen: () => void;
}

export function WeisungDialog({
  bereich,
  konten,
  punkte,
  laeuft,
  fehler,
  aufSetzen,
  aufAbbrechen,
}: WeisungDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [verantwortlich, setVerantwortlich] = useState("");
  const [frist, setFrist] = useState("");
  const [bestehen, setBestehen] = useState<ReadonlySet<string>>(new Set());
  const [hinweis, setHinweis] = useState<string | null>(null);

  const umschalten = (conflictId: string): void => {
    setBestehen((alt) => {
      const neu = new Set(alt);
      if (neu.has(conflictId)) {
        neu.delete(conflictId);
      } else {
        neu.add(conflictId);
      }
      return neu;
    });
  };

  return (
    // Nacharbeit 7: ein eingebetteter, beschrifteter Bereich unter der Prüfmarke — kein modales
    // Fenster; deshalb `section` mit Beschriftung statt `role="dialog"` (lint/a11y).
    <section
      aria-label={t("weisung.dialog.titel")}
      data-testid="weisung-dialog"
      className="space-y-2 rounded-card border border-hairline bg-page p-3 text-[12.5px]"
    >
      <div className="font-semibold text-text">{t("weisung.dialog.titel")}</div>
      <p className="text-muted">{t("weisung.dialog.erklaerung")}</p>
      <p className="text-muted-2">{bereich}</p>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-muted">{t("weisung.dialog.verantwortlich")}</span>
        <select
          data-testid="weisung-verantwortlich"
          value={verantwortlich}
          onChange={(e) => setVerantwortlich(e.target.value)}
          className="h-9 rounded-input border border-hairline bg-surface px-2"
        >
          <option value="">{t("weisung.dialog.waehlen")}</option>
          {konten.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-muted">{t("weisung.dialog.frist")}</span>
        <input
          type="date"
          data-testid="weisung-frist"
          value={frist}
          onChange={(e) => setFrist(e.target.value)}
          className="h-9 rounded-input border border-hairline bg-surface px-2"
        />
      </label>
      {punkte.length > 0 ? (
        <div data-testid="weisung-punkte" className="space-y-1">
          <div className="font-medium text-text">{t("weisung.dialog.punkteTitel")}</div>
          <p className="text-muted-2">{t("weisung.dialog.punktHinweis")}</p>
          <ul className="space-y-1">
            {punkte.map((p) => (
              <li key={p.conflictId}>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    data-testid={`weisung-punkt-${p.conflictId}`}
                    checked={bestehen.has(p.conflictId)}
                    onChange={() => umschalten(p.conflictId)}
                  />
                  <span>
                    {p.titel} — {t("weisung.dialog.punktBestehen")}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hinweis || fehler ? (
        <p role="alert" className="text-trust-crit-text">
          {hinweis ?? fehler}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          data-testid="weisung-setzen"
          disabled={laeuft}
          onClick={() => {
            if (!verantwortlich || !frist) {
              setHinweis(t("weisung.dialog.fehltAngabe"));
              return;
            }
            setHinweis(null);
            aufSetzen({ verantwortlich, frist, bestehenLassen: [...bestehen] });
          }}
        >
          {t("weisung.dialog.setzen")}
        </Button>
        <Button variant="ghost" onClick={aufAbbrechen}>
          {t("weisung.dialog.abbrechen")}
        </Button>
      </div>
    </section>
  );
}
