// ================================================================================================
// AUFTRAG-mega32 BLOCK H2/H3 — DER JSON-KASTEN, JETZT IM FLUSS.
// ================================================================================================
//
// H2. Bis mega31 stand dieser Kasten als eigenes Card AUSSERHALB des ImportCockpitProvider (in
// pages/Stufe2.tsx) und wurde deshalb IMMER gerendert — es gab schlicht nichts, was ihn bedingt
// hätte. Pedis Beobachtung war genau das: er wählt oben Confluence, und weiter unten steht
// weiterhin „JSON-RE-IMPORT" mit Ablagefläche und Knopf. Jetzt lebt der Kasten im Provider und
// verschwindet, sobald Confluence gewählt ist.
//
// H3 — DIE FALLE, ÜBER DEN ZUSTAND GELÖST. Die JSON-Kachel der Galerie klickte den versteckten
// Dateieingang bisher über seine DOM-Kennung an. Der Eingang liegt in genau diesem Kasten; bedingt
// gerendert hätte `document.getElementById` `null` geliefert und die Kachel hätte GERÄUSCHLOS
// nichts mehr getan — kein Fehler, keine Meldung, nur ein toter Knopf.
//
// Der Kasten hält seinen Eingang deshalb selbst (Ref) und öffnet ihn, wenn die Anforderung des
// Cockpits steigt. Die stabile DOM-Kennung bleibt am Element: Tests und Bestandsflächen benennen
// sie, und sie kostet nichts — aber NIEMAND steuert den Dialog mehr über sie.
//
// Kein neuer Import-Pfad, kein neuer Egress: es ist derselbe Eingang, derselbe onChange, derselbe
// bestehende Fluss.
import { Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { JSON_UPLOAD_INPUT_ID } from "../lib/importSourceGallery";
import { useFilePickRequest, useImportSource } from "./ImportStepper";
import { Card, SectionLabel } from "./ui";

// Anker des Kastens — damit ein Test „steht er da oder nicht?" fragen kann, ohne sich an Text zu
// klammern. Rein additiv, keine Verhaltensänderung.
export const IMPORT_JSON_CARD_ID = "import-json-card";

export function ImportJsonUpload({
  dragOver,
  setDragOver,
  onDrop,
  onFile,
  disabled,
}: {
  dragOver: boolean;
  setDragOver: (over: boolean) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  disabled: boolean;
}): JSX.Element | null {
  const { t } = useTranslation();
  const { source } = useImportSource();
  const filePickRequest = useFilePickRequest();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // H3: Der Dialog öffnet sich, weil der ZUSTAND es verlangt — nicht, weil jemand ein Element im
  // Dokument gefunden hat. `filePickRequest` ist monoton, damit auch die WIEDERHOLTE Wahl derselben
  // Quelle greift (abgebrochener Dialog, zweiter Versuch). Der Erststart (0) öffnet nichts.
  useEffect(() => {
    if (filePickRequest > 0) {
      inputRef.current?.click();
    }
  }, [filePickRequest]);

  // H2: Bei Confluence gehört dieser Kasten nicht zum Weg. Solange NICHTS gewählt ist, bleibt er
  // stehen wie bisher — Ausblenden beginnt erst mit einer echten Wahl.
  if (source === "confluence") {
    return null;
  }

  return (
    <Card className="mb-5" id={IMPORT_JSON_CARD_ID}>
      <SectionLabel>{t("imp.uploadTitle")}</SectionLabel>
      <p className="mb-3 text-[13px] text-muted">{t("imp.uploadHint")}</p>
      {/* E2E-010 (KEIN Bug — nur UI): ehrlich WARUM hier nur JSON geht, mit Verweis auf den Weg für
          Office-Dateien. Kein Capability-Umbau. */}
      <p className="mb-3 rounded-btn bg-page px-3 py-2 text-[12.5px] text-muted">
        {t("imp.jsonOnlyReason")}
      </p>
      {/* Block A: Drop-Zone ZUSÄTZLICH zum Dialog. Der Knopf bleibt (Tastatur-/A11y-Weg). */}
      <div
        data-testid="import-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`mb-3 rounded-card border border-dashed p-4 text-center text-[12.5px] transition-colors ${
          dragOver ? "border-brand bg-brand/5 text-text" : "border-hairline text-muted"
        }`}
      >
        {dragOver ? t("imp.dropActive") : t("imp.dropHint")}
      </div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-2 text-[13px] font-semibold text-text hover:bg-hairline-soft">
        <Upload size={15} />
        {t("imp.upload")}
        <input
          // Die Kennung bleibt (Tests/Bestandsflächen benennen sie) — aber der Dialog wird NICHT
          // mehr über sie gesteuert, sondern über die Referenz und den Cockpit-Zustand (H3).
          id={JSON_UPLOAD_INPUT_ID}
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          disabled={disabled}
          onChange={(e) => void onFile(e)}
        />
      </label>
    </Card>
  );
}
