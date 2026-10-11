import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";

// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · Entscheidung 27 (R-0164, R-0178) — EXTERNE FREIGABE ÜBERNEHMEN.
// ================================================================================================
//
// „Externe Freigabe und Provenienz übernehmen; interne Anwendbarkeit klären ohne pauschale zweite
// Inhaltsprüfung." Erfasst wird die Herkunft der externen Freigabe (Herausgeber, Datum, optional
// Kennung, Person, Nachweis), dazu die intern zuständige Person und die AUSDRÜCKLICHE Bestätigung,
// dass der Inhalt hier gilt. `art` trennt Wissensübernahme und ganzes Dokument als externe Referenz.
// Präsentational; geprüft und geschrieben wird am Server (`externe-freigabe`).

export interface ExterneFreigabeEingabeForm {
  art: "wissen" | "referenz";
  herausgeber: string;
  freigegebenAm: string;
  freigabeKennung?: string;
  freigegebenVon?: string;
  nachweis?: string;
  zustaendig: string;
  anwendbarBestaetigt: true;
}

export interface ExterneFreigabeDialogProps {
  bereich: string;
  konten: readonly { id: string; name: string }[];
  laeuft: boolean;
  fehler: string | null;
  aufUebernehmen: (eingabe: ExterneFreigabeEingabeForm) => void;
  aufAbbrechen: () => void;
}

const FELD = "h-9 rounded-input border border-hairline bg-surface px-2";

export function ExterneFreigabeDialog({
  bereich,
  konten,
  laeuft,
  fehler,
  aufUebernehmen,
  aufAbbrechen,
}: ExterneFreigabeDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [art, setArt] = useState<"wissen" | "referenz">("wissen");
  const [herausgeber, setHerausgeber] = useState("");
  const [freigegebenAm, setFreigegebenAm] = useState("");
  const [kennung, setKennung] = useState("");
  const [von, setVon] = useState("");
  const [nachweis, setNachweis] = useState("");
  const [zustaendig, setZustaendig] = useState("");
  const [anwendbar, setAnwendbar] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const feld = (
    beschriftung: string,
    wert: string,
    setzen: (v: string) => void,
    testId: string,
    typ = "text",
  ): JSX.Element => (
    <label className="flex flex-col gap-1">
      <span className="font-medium text-muted">{beschriftung}</span>
      <input
        type={typ}
        data-testid={testId}
        value={wert}
        onChange={(e) => setzen(e.target.value)}
        className={FELD}
      />
    </label>
  );

  return (
    // Nacharbeit 7: eingebetteter, beschrifteter Bereich — kein modales Fenster (lint/a11y).
    <section
      aria-label={t("weisung.extern.dialogTitel")}
      data-testid="extern-dialog"
      className="space-y-2 rounded-card border border-hairline bg-page p-3 text-[12.5px]"
    >
      <div className="font-semibold text-text">{t("weisung.extern.dialogTitel")}</div>
      <p className="text-muted">{t("weisung.extern.erklaerung")}</p>
      <label className="flex flex-col gap-1">
        <span className="font-medium text-muted">{t("weisung.extern.art")}</span>
        <select
          data-testid="extern-art"
          value={art}
          onChange={(e) => setArt(e.target.value === "referenz" ? "referenz" : "wissen")}
          className={FELD}
        >
          <option value="wissen">{t("weisung.extern.artWissen")}</option>
          <option value="referenz">{t("weisung.extern.artReferenz")}</option>
        </select>
      </label>
      {feld(t("weisung.extern.herausgeber"), herausgeber, setHerausgeber, "extern-herausgeber")}
      {feld(
        t("weisung.extern.freigegebenAm"),
        freigegebenAm,
        setFreigegebenAm,
        "extern-datum",
        "date",
      )}
      {feld(t("weisung.extern.kennungFeld"), kennung, setKennung, "extern-kennung")}
      {feld(t("weisung.extern.vonFeld"), von, setVon, "extern-von")}
      {feld(t("weisung.extern.nachweisFeld"), nachweis, setNachweis, "extern-nachweis", "url")}
      <label className="flex flex-col gap-1">
        <span className="font-medium text-muted">{t("weisung.extern.zustaendig")}</span>
        <select
          data-testid="extern-zustaendig"
          value={zustaendig}
          onChange={(e) => setZustaendig(e.target.value)}
          className={FELD}
        >
          <option value="">{t("weisung.dialog.waehlen")}</option>
          {konten.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          data-testid="extern-anwendbar"
          checked={anwendbar}
          onChange={(e) => setAnwendbar(e.target.checked)}
        />
        <span>{t("weisung.extern.anwendbar", { bereich })}</span>
      </label>
      {hinweis || fehler ? (
        <p role="alert" className="text-trust-crit-text">
          {hinweis ?? fehler}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          data-testid="extern-uebernehmen"
          disabled={laeuft}
          onClick={() => {
            if (!herausgeber.trim() || !freigegebenAm || !zustaendig || !anwendbar) {
              setHinweis(t("weisung.extern.fehltAngabe"));
              return;
            }
            setHinweis(null);
            aufUebernehmen({
              art,
              herausgeber: herausgeber.trim(),
              freigegebenAm,
              zustaendig,
              anwendbarBestaetigt: true,
              ...(kennung.trim() ? { freigabeKennung: kennung.trim() } : {}),
              ...(von.trim() ? { freigegebenVon: von.trim() } : {}),
              ...(nachweis.trim() ? { nachweis: nachweis.trim() } : {}),
            });
          }}
        >
          {t("weisung.extern.uebernehmen")}
        </Button>
        <Button variant="ghost" onClick={aufAbbrechen}>
          {t("weisung.dialog.abbrechen")}
        </Button>
      </div>
    </section>
  );
}
