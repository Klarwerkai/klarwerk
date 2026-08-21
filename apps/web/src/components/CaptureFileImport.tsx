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
import { UploadLimitsHint } from "./UploadLimitsHint";

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
  // AUFTRAG-mega34 D2: die Ablagefläche ist jetzt ein echter <button> statt eines <div>.
  const handleDrop = (e: DragEvent<HTMLButtonElement>): void => {
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

  // AUFTRAG-mega34 BLOCK D1: der EINE Weg, den vorhandenen versteckten Eingang zu öffnen. Knopf und
  // Ablagefläche rufen dieselbe Zeile — kein neuer Importweg, kein neuer Egress, keine neue
  // Fähigkeit. Der Eingang trägt bereits sein volles `accept` (FILE_IMPORT_ACCEPT); der Knopf
  // verspricht damit nichts, was der Dialog nicht anbietet.
  const openFileDialog = (): void => {
    fileImportInputRef.current?.click();
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
      {/* AUFTRAG-mega14 Block E (SCRUM-421): die geltenden Grenzen AN der Auswahlstelle,
          aus derselben Quelle, die der Server erzwingt. */}
      <UploadLimitsHint className="mb-2 text-[11px] text-muted-2" />
      {/* ==========================================================================================
          AUFTRAG-mega34 BLOCK D (Aufgabe 5 der Testerin) — DIE DATEIAUSWAHL BEKOMMT IHREN KNOPF.
          ==========================================================================================
          Bis hierher gab es drei Wege in den Dateidialog — den versteckten Eingang (unsichtbar),
          die Ablagefläche (nur Maus, nur Drag&Drop) und die Dateityp-Kacheln (die niemand als
          Dialog-Öffner liest). Wer nicht darauf kam, dass eine KACHEL den Systemdialog öffnet, fand
          den Weg nicht — zwei Bildschirmfotos der externen Auswertung zeigen genau diesen Moment.
          Das ist der einzige Punkt, an dem ihr Test scheitern kann, ohne dass etwas kaputt ist.

          Der Knopf ist die ehrlichste denkbare Ergänzung: er klickt den bestehenden Eingang. */}
      {/* D2: ein ECHTER <button>, kein anklickbares <div>. Damit ist die Ablagefläche von sich aus
          fokussierbar und reagiert auf Enter und Leertaste — ohne eigene Tastatur-Nachbildung, die
          in einem Browser doppelt auslösen würde (keydown-Handler PLUS natives click). Die
          Drag&Drop-Handler bleiben unverändert daran hängen. */}
      <button
        type="button"
        data-testid="capture-dropzone"
        onClick={openFileDialog}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mb-2 w-full cursor-pointer rounded-card border border-dashed p-4 text-center text-[12.5px] transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 ${
          dragOver ? "border-brand bg-brand/5 text-text" : "border-hairline text-muted"
        }`}
      >
        {dragOver ? t(CAPTURE_FILE_TEXT.dropActive) : t(CAPTURE_FILE_TEXT.dropHint)}
      </button>
      {/* D1: sichtbar, benannt, ein echtes <button> — Tastatur und Screenreader inklusive. */}
      <div className="mb-3 flex justify-center">
        <button
          type="button"
          data-testid="capture-file-pick"
          onClick={openFileDialog}
          className="rounded-btn border border-hairline bg-page px-3 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          {t(CAPTURE_FILE_TEXT.pick)}
        </button>
      </div>
      {/* AUFTRAG-1840 (Anker A-1292-MELDUNG): EIN Träger statt zweier.
          Vorher stand der Ablehnungsgrund in einer stummen `sr-only`-Live-Region UND zwei Zeilen
          weiter noch einmal sichtbar. Für eine Vorlesehilfe war das derselbe Satz zweimal: einmal
          aus der Live-Region angesagt, einmal beim Weiterwandern im Baum gelesen.

          Jetzt trägt das SICHTBARE Element selbst den Kanal. `<output>` ist die Bauform dieses
          Hauses — es trägt implizit `role="status"` (biome `useSemanticElements`), genau wie
          nebenan in `FileTypePicker.tsx:214`, das diese Komponente selbst rendert. `aria-live`
          ergänzt die Rolle explizit, `aria-atomic` sorgt dafür, dass der Grund als EIN Satz
          vorgelesen wird und nicht in Bruchstücken.

          UNANGETASTET, und das ist Absicht: Die Region bleibt DAUERHAFT montiert und im Leerfall
          leer. `tests/app/a18-ansagen-ereignisse.test.tsx` führt genau das als Ausgangszustand
          von I1 („`sr-only`-Live-Bereich montiert, Inhalt leer"), und B2 derselben Datei belegt,
          warum: eine erst im Fehlerfall eingehängte Region wird von Vorlesehilfen überhört.

          DIE KLASSE IST STATISCH, und das ist kein Schönheitsgriff: `mega47-modale-flaechen-
          sammler.test.tsx` sammelt Klassenbindungen und pinnt die Zahl der unauflösbaren auf 207.
          Eine bedingte `className={a ? "x" : "y"}` kann er nicht auflösen und hätte die Zahl auf
          208 gehoben — gemessen. Alle Live-Regionen dieses Hauses tragen deshalb eine feste
          Klasse (`MobileNavDrawer.tsx:117`, `LoadState.tsx:34`, `FileTypePicker.tsx:216`), und
          diese hier auch. Ohne Inhalt ist das Element leer und nimmt keine Höhe ein. */}
      <output
        aria-live="polite"
        aria-atomic="true"
        className="block text-[12px] text-trust-crit-text"
      >
        {dropReject ?? ""}
      </output>
      <FileTypePicker
        sources={fileSourcesForSurface("capture")}
        onActivate={(id) => {
          openCaptureFileDialog(id, fileImportInputRef.current);
        }}
      />
    </>
  );
}
