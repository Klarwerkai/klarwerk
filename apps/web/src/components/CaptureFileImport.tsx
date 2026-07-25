// AUFTRAG-uxpol3 (bens Restfund 4.1): Die GESAMTE Capture-Dateityp-Verdrahtung als EINE exportierte
// Produktionskomponente — genau der Baum, den Capture.tsx rendert, jetzt an einer Stelle und real
// testbar (echter, im DOM gemounteter <input> + echte onActivate/onChange-Kopplung). Vorher lag die
// Verdrahtung inline in Capture.tsx und ließ sich nur über Quelltext-Stringpins prüfen.
//
// Ehrlichkeit (unangetastet): der versteckte <input> IST der bestehende Importweg (kein neuer Egress).
// NUR eine aktive Kachel setzt über openCaptureFileDialog ein TYPGERECHTES `accept` und klickt genau
// diesen Input; „bald"/„geplant" öffnen nichts. Die Auswahl der Dateikacheln kommt aus der pro
// Oberfläche abgeleiteten, ehrlichen Capability (fileSourcesForSurface("capture")).
//
// AUFTRAG-mega1 Block A: ZUSÄTZLICH zum Dialog eine Drag&Drop-Zone. Eine per Drop abgelegte Datei
// läuft durch GENAU denselben `onExtractFile`-Seam (kein neuer Egress, kein zweiter Pfad). Der
// Dateityp wird über die BESTEHENDE Weiche `detectFileKind` klassifiziert: unterstützt → verarbeiten,
// nicht unterstützt → ehrlicher aria-live-Hinweis, keine Verarbeitung.
import { type ChangeEvent, type DragEvent, useState } from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { CAPTURE_FILE_TEXT, FILE_IMPORT_ACCEPT } from "../lib/captureFromFile";
import { detectFileKind } from "../lib/extract";
import { fileSourcesForSurface, openCaptureFileDialog } from "../lib/importSourceGallery";
import { FileTypePicker } from "./FileTypePicker";

export interface CaptureFileImportProps {
  // Der ECHTE Extraktions-Pfad des Erfassens (Capture.onExtractFile). Wird ausgelöst, wenn der
  // bestehende versteckte <input> eine Datei liefert (onChange) — die Kacheln klicken nur diesen Input.
  onExtractFile: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function CaptureFileImport({ onExtractFile }: CaptureFileImportProps): JSX.Element {
  const { t } = useTranslation();
  // Referenz auf den BESTEHENDEN Datei-Dialog des „Aus Datei"-Imports. Eine aktive Kachel öffnet ihn
  // typgerecht (openCaptureFileDialog); bald/geplant lösen ihn nie aus. Kein neuer Upload-Pfad.
  const fileImportInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Ehrlicher Ablehnungshinweis (nicht unterstützter Dateityp); wird über aria-live angesagt.
  const [dropReject, setDropReject] = useState<string | null>(null);

  // Block A: eine per Drop abgelegte Datei durch DENSELBEN onExtractFile-Seam speisen — kein zweiter
  // Pfad. Nicht unterstützte Typen (detectFileKind === "unsupported") werden ehrlich abgelehnt.
  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    if (detectFileKind({ name: file.name, type: file.type }) === "unsupported") {
      setDropReject(t(CAPTURE_FILE_TEXT.dropReject, { name: file.name }));
      return;
    }
    setDropReject(null);
    // Genau der bestehende Extraktionsweg: ein synthetisches Change-Event auf demselben Seam. onExtractFile
    // liest nur `target.files[0]` und setzt `target.value` — kein neuer Egress, kein neuer Fetch.
    onExtractFile({
      target: { files: [file] as unknown as FileList, value: "" },
    } as unknown as ChangeEvent<HTMLInputElement>);
  };

  return (
    <>
      <input
        ref={fileImportInputRef}
        type="file"
        accept={FILE_IMPORT_ACCEPT}
        className="hidden"
        onChange={onExtractFile}
      />
      {/* Sichtbare Drop-Zone — ZUSÄTZLICH zum Dialog/Picker, nicht als Ersatz. Der Tastatur-/A11y-Weg
          bleibt der Picker unten. */}
      <div
        data-testid="capture-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-3 rounded-card border border-dashed p-4 text-center text-[12.5px] transition-colors ${
          dragOver ? "border-brand bg-brand/5 text-text" : "border-hairline text-muted"
        }`}
      >
        {dragOver ? t(CAPTURE_FILE_TEXT.dropActive) : t(CAPTURE_FILE_TEXT.dropHint)}
      </div>
      <p className="sr-only" aria-live="polite">
        {dropReject ?? ""}
      </p>
      {dropReject ? <p className="mb-2 text-[12px] text-trust-crit-text">{dropReject}</p> : null}
      <FileTypePicker
        sources={fileSourcesForSurface("capture")}
        onActivate={(id) => {
          openCaptureFileDialog(id, fileImportInputRef.current);
        }}
      />
    </>
  );
}
