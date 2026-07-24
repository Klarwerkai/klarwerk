// AUFTRAG-uxpol3 (bens Restfund 4.1): Die GESAMTE Capture-Dateityp-Verdrahtung als EINE exportierte
// Produktionskomponente — genau der Baum, den Capture.tsx rendert, jetzt an einer Stelle und real
// testbar (echter, im DOM gemounteter <input> + echte onActivate/onChange-Kopplung). Vorher lag die
// Verdrahtung inline in Capture.tsx und ließ sich nur über Quelltext-Stringpins prüfen.
//
// Ehrlichkeit (unangetastet): der versteckte <input> IST der bestehende Importweg (kein neuer Egress).
// NUR eine aktive Kachel setzt über openCaptureFileDialog ein TYPGERECHTES `accept` und klickt genau
// diesen Input; „bald"/„geplant" öffnen nichts. Die Auswahl der Dateikacheln kommt aus der pro
// Oberfläche abgeleiteten, ehrlichen Capability (fileSourcesForSurface("capture")).
import { type ChangeEvent, useRef } from "react";
import { FILE_IMPORT_ACCEPT } from "../lib/captureFromFile";
import { fileSourcesForSurface, openCaptureFileDialog } from "../lib/importSourceGallery";
import { FileTypePicker } from "./FileTypePicker";

export interface CaptureFileImportProps {
  // Der ECHTE Extraktions-Pfad des Erfassens (Capture.onExtractFile). Wird ausgelöst, wenn der
  // bestehende versteckte <input> eine Datei liefert (onChange) — die Kacheln klicken nur diesen Input.
  onExtractFile: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function CaptureFileImport({ onExtractFile }: CaptureFileImportProps): JSX.Element {
  // Referenz auf den BESTEHENDEN Datei-Dialog des „Aus Datei"-Imports. Eine aktive Kachel öffnet ihn
  // typgerecht (openCaptureFileDialog); bald/geplant lösen ihn nie aus. Kein neuer Upload-Pfad.
  const fileImportInputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={fileImportInputRef}
        type="file"
        accept={FILE_IMPORT_ACCEPT}
        className="hidden"
        onChange={onExtractFile}
      />
      <FileTypePicker
        sources={fileSourcesForSurface("capture")}
        onActivate={(id) => {
          openCaptureFileDialog(id, fileImportInputRef.current);
        }}
      />
    </>
  );
}
