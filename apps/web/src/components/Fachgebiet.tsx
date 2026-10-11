// ================================================================================================
// R-0034 / R-0465 / FR-CAP-08 (aufnahme:20260922:gesamt-wissen-metadaten) — DAS FACHGEBIET AM OBJEKT.
// ================================================================================================
//
// Bis hierher gab es das Fachgebiet im Modell (`KnowledgeObject.domain`), an der Route
// (`action: "domain"`) und als Facette der Bibliothek — aber keine Fläche, die es setzte. Damit
// blieb die Facette für jedes in der Oberfläche erfasste Objekt leer, und die Zuordnung wirkte nur in
// der Datenhaltung. Dieses Feld zeigt den gespeicherten Wert und ändert ihn über genau diese Aktion;
// ein leerer Wert entfernt die Angabe. Ändern darf, wer das Objekt bearbeiten darf (Server:
// `ko.create`, dieselbe Schwelle wie die Kategorie). Abgeleitet wird nichts.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextInput } from "./ui";

/** Dieselbe Höchstlänge wie am Server (`DOMAIN_MAX_LENGTH`, services/app/src/routes/ko-routes.ts). */
export const FACHGEBIET_MAX_LAENGE = 120;

export function FachgebietFeld({
  domain,
  darfAendern,
  wartet,
  onSpeichern,
}: {
  domain: string | undefined;
  darfAendern: boolean;
  wartet: boolean;
  onSpeichern: (domain: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const gespeichert = domain?.trim() ?? "";
  const [wert, setWert] = useState(gespeichert);
  const unveraendert = wert.replace(/\s+/g, " ").trim() === gespeichert;
  return (
    <div data-testid="ko-fachgebiet" className="mt-3 border-t border-hairline pt-3 text-[12.5px]">
      <p className="font-semibold text-text">{t("wissensmetadaten.fachgebiet.feld")}</p>
      <p data-testid="ko-fachgebiet-wert" className="mt-0.5 text-muted">
        {gespeichert || t("wissensmetadaten.fachgebiet.keins")}
      </p>
      {darfAendern ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TextInput
            data-testid="ko-fachgebiet-eingabe"
            aria-label={t("wissensmetadaten.fachgebiet.feld")}
            placeholder={t("wissensmetadaten.fachgebiet.platzhalter")}
            value={wert}
            maxLength={FACHGEBIET_MAX_LAENGE}
            disabled={wartet}
            onChange={(e) => setWert(e.target.value)}
            className="h-9 min-w-[10rem] flex-1"
          />
          <Button
            data-testid="ko-fachgebiet-speichern"
            variant="primary"
            disabled={wartet || unveraendert}
            onClick={() => onSpeichern(wert.trim())}
          >
            {t("wissensmetadaten.fachgebiet.speichern")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
