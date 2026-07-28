// AUFTRAG-uxpol1 (PAKET 2): gemeinsames, poliertes Dateityp-Kachel-Bauteil für Erfassen UND Import.
// EINE Wahrheitsquelle: das IC-7-Datenmodell importSourceGallery.ts (Zustände/Reihenfolge). Kacheln
// statt grauer Pillen — dezentes Datei-Icon je Typ, Name, Zustands-Badge (aktiv/bald/geplant), klare
// Hierarchie (aktiv hervorgehoben, bald leicht, geplant gedämpft), Hover/Fokus sauber.
//
// Ehrlichkeit (aus IC-7, unangetastet): NUR „active"-Kacheln lösen über onActivate den echten,
// bereits existierenden Fluss aus. „soon"/„planned" starten NIE einen Import/Dialog — sie blenden
// nur einen ruhigen, nicht-modalen, ehrlichen Hinweis ein (aria-live). Badges tragen TEXT (nicht nur
// Farbe); jede Kachel ist ein <button> (tastaturfokussierbar). Kein neuer Egress/Upload-Pfad.
import {
  Boxes,
  ChevronDown,
  File,
  FileAudio,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
  ScanLine,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type GallerySource,
  STATE_BADGE_KEY,
  type SourceState,
  hintKeyFor,
} from "../lib/importSourceGallery";
import { usePersistentDisclosure } from "../lib/usePersistentDisclosure";

// Kachel-Optik je Zustand. WICHTIG: nie „bg-ink" (ohne aria-pressed) — der geführte Fluss zählt
// solche Buttons als seinen EINEN Primär-CTA. Die Kacheln sind informativ/aktivierend, nicht der CTA.
const TILE_CLASS: Record<SourceState, string> = {
  active: "border-ink/30 bg-surface text-text hover:border-ink/50 hover:bg-hairline-soft",
  // AUFTRAG-mega15 Block D (SCRUM-382): vorhanden, aber ohne hinterlegten Dienst nicht nutzbar —
  // optisch naeher an „bald" als an „geplant", denn gebaut IST es. Aktivierbar ist es trotzdem nicht.
  unconfigured: "border-hairline bg-page text-muted hover:border-ink/25",
  soon: "border-hairline bg-page text-muted hover:border-ink/25",
  planned: "border-hairline-soft bg-page text-muted-2 hover:border-ink/20",
};

const BADGE_CLASS: Record<SourceState, string> = {
  active: "bg-trust-pos-bg text-trust-pos-text",
  unconfigured: "bg-trust-warn-bg text-trust-warn-text",
  soon: "bg-trust-warn-bg text-trust-warn-text",
  planned: "bg-hairline-soft text-muted-2",
};

// Icon je Datei-/System-Typ (dezent). Fallback: allgemeines Datei-Icon. Systeme (Import-Galerie)
// tragen ein neutrales Boxes-Icon — die Datei-Gruppe je Format ein passendes Datei-Icon.
const FILE_ICONS: Record<string, ReactNode> = {
  "json-file": <FileJson size={16} />,
  json: <FileJson size={16} />,
  docx: <FileType size={16} />,
  "word-sys": <FileType size={16} />,
  pdf: <FileText size={16} />,
  "pdf-sys": <FileText size={16} />,
  xlsx: <FileSpreadsheet size={16} />,
  pptx: <Presentation size={16} />,
  csv: <FileText size={16} />,
  ocr: <ScanLine size={16} />,
  avtranscript: <FileAudio size={16} />,
};

function defaultIconFor(source: GallerySource): ReactNode {
  return FILE_ICONS[source.id] ?? <File size={16} />;
}

function Tile({
  source,
  icon,
  onClick,
}: {
  source: GallerySource;
  icon: ReactNode;
  onClick: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-id={source.id}
      data-state={source.state}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-card border px-3 py-2.5 text-left text-[13px] font-semibold transition-colors focus:outline-none focus-visible:border-ink/50 ${TILE_CLASS[source.state]}`}
    >
      <span aria-hidden className="shrink-0 text-muted-2">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{t(source.labelKey)}</span>
      {/* Zustand als TEXT im Badge (nicht nur Farbe) — barrierearm. */}
      <span
        className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-medium ${BADGE_CLASS[source.state]}`}
      >
        {t(STATE_BADGE_KEY[source.state])}
      </span>
    </button>
  );
}

export interface FileTypePickerProps {
  sources: readonly GallerySource[];
  // Wird AUSSCHLIESSLICH für aktive Kacheln aufgerufen (echter, bestehender Fluss). Für bald/geplant
  // bleibt dieser Callback bewusst unberührt — kein Import, kein Dialog, kein Konnektor-Call.
  onActivate: (id: string) => void;
  // Optionaler Icon-Wähler; Default: Datei-Icon je Typ. Systeme reichen z. B. Boxes herein.
  iconFor?: (source: GallerySource) => ReactNode;
  // Optionale Gruppen-Überschrift (i18n-Text).
  title?: string;
  // AUFTRAG-mega32 BLOCK G: Klappt „geplant" hinter EINE Zeile? AUSDRÜCKLICH opt-in, weil dieses
  // Bauteil ZWEI Oberflächen trägt: die Import-Galerie UND den Dateityp-Picker im Erfassen. Der
  // Block gilt nur der Import-Seite; das Erfassen bleibt unverändert. Ein stillschweigend geteiltes
  // Verhalten wäre genau die Art Nebenwirkung, die hier niemand bestellt hat.
  collapsePlanned?: boolean;
  // Speicherschlüssel des Aufklappers. Fehlt er, bleibt der Zustand rein flüchtig.
  plannedStorageKey?: string;
}

export function FileTypePicker({
  sources,
  onActivate,
  iconFor = defaultIconFor,
  title,
  collapsePlanned = false,
  plannedStorageKey,
}: FileTypePickerProps): JSX.Element {
  const { t } = useTranslation();
  // Ehrlicher Klick-Zustand: die zuletzt angeklickte NICHT-aktive Kachel (rein informativ). Erneuter
  // Klick auf dieselbe Kachel schließt den Hinweis wieder.
  const [hint, setHint] = useState<GallerySource | null>(null);
  // ============================================================================================
  // AUFTRAG-mega32 BLOCK G — „IN PLANUNG" EINKLAPPEN.
  // ============================================================================================
  // Gezählt: die System-Galerie zeigt zwei aktive, drei „bald" und ZEHN geplante Kacheln, die
  // Datei-Galerie dieselbe Staffelung. Zwei Drittel der Fläche tun nichts, und genau das macht die
  // Seite unübersichtlich.
  //
  // Einklappen ist KEINE Unehrlichkeit — Verschweigen wäre eine. Die geplanten Kacheln bleiben
  // vollständig erreichbar, ihre ANZAHL steht in der Zeile, und aufgeklappt verhalten sie sich
  // GENAU wie heute (kein Import, kein Formular, nur der ehrliche Hinweis).
  //
  // „Nicht konfiguriert" bleibt AUSSERHALB des Aufklappers sichtbar: gebaut und nur ohne
  // hinterlegten Dienst ist etwas anderes als geplant — diese Unterscheidung wurde ausdrücklich
  // einmal erkämpft (mega15 Block D / SCRUM-382) und darf hier nicht wieder verschwimmen.
  const [plannedOpen, togglePlanned] = usePersistentDisclosure(plannedStorageKey, {
    defaultOpen: false,
  });

  const clickTile = (source: GallerySource): void => {
    if (source.state === "active") {
      setHint(null);
      onActivate(source.id);
      return;
    }
    setHint((prev) => (prev?.id === source.id ? null : source));
  };

  const hintKey = hint ? hintKeyFor(hint.state) : null;
  // Die Reihenfolge innerhalb beider Mengen bleibt die von orderByState — hier wird nur GETRENNT,
  // nicht neu sortiert.
  const visible = collapsePlanned ? sources.filter((s) => s.state !== "planned") : sources;
  const planned = collapsePlanned ? sources.filter((s) => s.state === "planned") : [];
  const grid = "grid grid-cols-2 gap-2 sm:grid-cols-3";
  const renderTile = (source: GallerySource): JSX.Element => (
    <Tile
      key={source.id}
      source={source}
      icon={iconFor(source)}
      onClick={() => clickTile(source)}
    />
  );

  return (
    <div>
      {title ? (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
          {title}
        </span>
      ) : null}
      <div className={`${grid} ${title ? "mt-1.5" : ""}`}>{visible.map(renderTile)}</div>
      {planned.length > 0 ? (
        <div className="mt-2">
          <button
            type="button"
            data-testid="planned-disclosure"
            aria-expanded={plannedOpen}
            onClick={togglePlanned}
            className="flex w-full items-center gap-1.5 rounded-btn px-1 py-1 text-left text-[12px] font-semibold text-muted-2 transition-colors hover:text-muted focus:outline-none focus-visible:text-text"
          >
            <ChevronDown
              size={14}
              aria-hidden
              className={`transition-transform ${plannedOpen ? "rotate-180" : ""}`}
            />
            <span>{t("imp.gallery.plannedGroup", { count: planned.length })}</span>
          </button>
          {plannedOpen ? <div className={`${grid} mt-1.5`}>{planned.map(renderTile)}</div> : null}
        </div>
      ) : null}
      {/* Ehrlicher, nicht-modaler Hinweis — nur für bald/geplant, nie ein Import. <output> trägt
          implizit role="status" (aria-live ergänzt es explizit), also kein blockierender Dialog. */}
      {hintKey ? (
        <output
          aria-live="polite"
          className="mt-2 block rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text"
        >
          {t(hintKey)}
        </output>
      ) : null}
    </div>
  );
}

// Neutrales System-Icon (Import-Galerie „Systeme"): einheitlicher Boxes-Marker.
export function systemIcon(): ReactNode {
  return <Boxes size={16} />;
}
