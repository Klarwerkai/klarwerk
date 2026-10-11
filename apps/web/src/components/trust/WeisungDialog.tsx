import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";

// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · Entscheidungen 18/19 (R-0573) — DIE WEISUNG SETZEN.
// ================================================================================================
//
// Präsentational wie die übrigen Bauteile unter `trust/`: Konten, betroffene Punkte und Rückrufe
// kommen von der Lesefläche. Pflicht sind die verantwortliche Person der Sichtung und die Frist
// (Entscheidung 19). Zur Wahl stehen nur Konten, die der Server als sichtungsfähig nennt (sie
// lesen den Eintrag mit ihrem eigenen Zugang — Nacharbeit 11, Ben B1). Hat der Server betroffene
// Punkte vorgelegt (409 `WEISUNG_PUNKTE_OFFEN`), stehen sie hier EINZELN — jeder wird ausdrücklich
// bestehen gelassen oder überstimmt; ein überstimmter Punkt wird geschlossen, nicht gelöscht
// (Ben B2). Ob die Weisung gilt, entscheidet allein der Server.

export interface BetroffenerPunktAnzeige {
  conflictId: string;
  koId: string;
  titel: string;
}

type PunktEntscheidung = "bestehen" | "ueberstimmen";

export interface WeisungDialogProps {
  bereich: string;
  /** Wählbare Konten für die Sichtung — nur sichtungsfähige, ohne die weisende Person selbst. */
  konten: readonly { id: string; name: string }[];
  punkte: readonly BetroffenerPunktAnzeige[];
  laeuft: boolean;
  fehler: string | null;
  aufSetzen: (eingabe: {
    verantwortlich: string;
    frist: string;
    bestehenLassen: string[];
    ueberstimmen: string[];
  }) => void;
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
  const [entscheidungen, setEntscheidungen] = useState<ReadonlyMap<string, PunktEntscheidung>>(
    new Map(),
  );
  const [hinweis, setHinweis] = useState<string | null>(null);

  const entscheiden = (conflictId: string, wahl: PunktEntscheidung): void => {
    setEntscheidungen((alt) => new Map(alt).set(conflictId, wahl));
  };
  const mit = (wahl: PunktEntscheidung): string[] =>
    [...entscheidungen].filter(([, w]) => w === wahl).map(([k]) => k);

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
      {konten.length === 0 ? (
        <p data-testid="weisung-keine-kandidaten" className="text-muted-2">
          {t("weisung.dialog.keineKandidaten")}
        </p>
      ) : null}
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
                <fieldset className="space-y-0.5">
                  <legend>{p.titel}</legend>
                  <label className="mr-3 inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name={`weisung-punkt-${p.conflictId}`}
                      data-testid={`weisung-punkt-${p.conflictId}`}
                      checked={entscheidungen.get(p.conflictId) === "bestehen"}
                      onChange={() => entscheiden(p.conflictId, "bestehen")}
                    />
                    <span>{t("weisung.dialog.punktBestehen")}</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name={`weisung-punkt-${p.conflictId}`}
                      data-testid={`weisung-punkt-ueberstimmen-${p.conflictId}`}
                      checked={entscheidungen.get(p.conflictId) === "ueberstimmen"}
                      onChange={() => entscheiden(p.conflictId, "ueberstimmen")}
                    />
                    <span>{t("weisung.dialog.punktUeberstimmen")}</span>
                  </label>
                </fieldset>
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
            aufSetzen({
              verantwortlich,
              frist,
              bestehenLassen: mit("bestehen"),
              ueberstimmen: mit("ueberstimmen"),
            });
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
