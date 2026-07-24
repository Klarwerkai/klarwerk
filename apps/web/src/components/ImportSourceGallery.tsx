// AUFTRAG-ic7-import-vision: EHRLICHE Quellen-Galerie. Zeigt visuell, wohin die Import-Reise geht,
// ohne je eine Faehigkeit vorzutaeuschen. Zwei Gruppen: Systeme (PAKET 1) und Dateien (PAKET 2).
//
// Ehrlichkeit vor Optik:
//  - NUR "active"-Kacheln loesen ueber onActivate den echten, bereits existierenden Import-Fluss aus.
//  - Ein Klick auf "soon"/"planned" startet NIE einen Import, oeffnet kein Formular, zeigt keinen
//    Fortschritt — er blendet nur einen ruhigen, nicht-modalen, ehrlichen Hinweis ein (aria-live).
//  - Badges tragen TEXT (nicht nur Farbe); jede Kachel ist ein <button> (tastaturfokussierbar).
import { Boxes, FileText } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FILE_SOURCES,
  type GallerySource,
  STATE_BADGE_KEY,
  SYSTEM_SOURCES,
  type SourceState,
  hintKeyFor,
} from "../lib/importSourceGallery";

// Kachel-Rahmen je Zustand. WICHTIG: nie „bg-ink" verwenden — der gefuehrte Fluss zaehlt Buttons
// mit „bg-ink" (ohne aria-pressed) als seinen EINEN Primaer-CTA. Die Galerie ist informativ und
// darf diese Zaehlung nicht verfaelschen.
const TILE_CLASS: Record<SourceState, string> = {
  active: "border-ink/25 bg-surface text-text hover:border-ink/40",
  soon: "border-hairline bg-page text-muted hover:border-ink/20",
  planned: "border-hairline bg-page text-muted-2 hover:border-ink/20",
};

const BADGE_CLASS: Record<SourceState, string> = {
  active: "bg-trust-pos-bg text-trust-pos-text",
  soon: "bg-trust-warn-bg text-trust-warn-text",
  planned: "bg-hairline-soft text-muted-2",
};

function SourceTile({
  source,
  icon,
  onClick,
}: {
  source: GallerySource;
  icon: ReactNode;
  onClick: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const badge = t(STATE_BADGE_KEY[source.state]);
  return (
    <button
      type="button"
      data-id={source.id}
      data-state={source.state}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-card border px-3 py-2 text-[13px] font-semibold ${TILE_CLASS[source.state]}`}
    >
      <span aria-hidden className="shrink-0 text-muted-2">
        {icon}
      </span>
      <span>{t(source.labelKey)}</span>
      {/* Zustand steht als TEXT im Badge (nicht nur ueber die Farbe) — barrierearm. */}
      <span
        className={`ml-0.5 rounded-pill px-1.5 py-0.5 text-[10px] font-medium ${BADGE_CLASS[source.state]}`}
      >
        {badge}
      </span>
    </button>
  );
}

function Gallery({
  title,
  sources,
  icon,
  onTileClick,
}: {
  title: string;
  sources: readonly GallerySource[];
  icon: ReactNode;
  onTileClick: (source: GallerySource) => void;
}): JSX.Element {
  return (
    <div>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
        {title}
      </span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {sources.map((source) => (
          <SourceTile
            key={source.id}
            source={source}
            icon={icon}
            onClick={() => onTileClick(source)}
          />
        ))}
      </div>
    </div>
  );
}

export function ImportSourceGallery({
  onActivate,
}: {
  // Wird AUSSCHLIESSLICH fuer aktive Kacheln aufgerufen (echter, bestehender Fluss). Fuer
  // bald/geplant bleibt dieser Callback bewusst unberuehrt — kein Import, kein Konnektor-Call.
  onActivate: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  // Ehrlicher Klick-Zustand: die zuletzt angeklickte NICHT-aktive Kachel. Rein informativ.
  // Erneuter Klick auf dieselbe Kachel schliesst den Hinweis wieder.
  const [hint, setHint] = useState<GallerySource | null>(null);

  const clickTile = (source: GallerySource): void => {
    if (source.state === "active") {
      setHint(null);
      onActivate(source.id);
      return;
    }
    setHint((prev) => (prev?.id === source.id ? null : source));
  };

  const hintKey = hint ? hintKeyFor(hint.state) : null;

  return (
    <div className="space-y-4">
      <Gallery
        title={t("imp.gallery.systemsTitle")}
        sources={SYSTEM_SOURCES}
        icon={<Boxes size={14} />}
        onTileClick={clickTile}
      />
      <Gallery
        title={t("imp.gallery.filesTitle")}
        sources={FILE_SOURCES}
        icon={<FileText size={14} />}
        onTileClick={clickTile}
      />
      {/* Ehrlicher, nicht-modaler Hinweis — nur fuer bald/geplant, nie ein Import. <output> traegt
          implizit role="status" (aria-live ergaenzt es explizit), also kein blockierender Dialog. */}
      {hintKey ? (
        <output
          aria-live="polite"
          className="block rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text"
        >
          {t(hintKey)}
        </output>
      ) : null}
    </div>
  );
}
