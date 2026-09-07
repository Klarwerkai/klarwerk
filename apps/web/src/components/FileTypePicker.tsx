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
  stepsKeyFor,
} from "../lib/importSourceGallery";
import { usePersistentDisclosure } from "../lib/usePersistentDisclosure";

// Kachel-Optik je Zustand. WICHTIG: nie „bg-ink" (ohne aria-pressed) — der geführte Fluss zählt
// solche Buttons als seinen EINEN Primär-CTA. Die Kacheln sind informativ/aktivierend, nicht der CTA.
const TILE_CLASS: Record<SourceState, string> = {
  active: "border-ink/30 bg-surface text-text hover:border-ink/50 hover:bg-hairline-soft",
  // JOB 3190 (UX-18): „anderswo verfuegbar" ist die staerkste Aussage nach „hier nutzbar" — die
  // Faehigkeit existiert und die Kachel fuehrt wirklich dorthin. Deshalb traegt sie die Optik der
  // aktiven Kachel und nicht die gedaempfte der geplanten.
  elsewhere: "border-ink/30 bg-surface text-text hover:border-ink/50 hover:bg-hairline-soft",
  // AUFTRAG-mega15 Block D (SCRUM-382): vorhanden, aber ohne hinterlegten Dienst nicht nutzbar —
  // optisch naeher an „bald" als an „geplant", denn gebaut IST es. Aktivierbar ist es trotzdem nicht.
  unconfigured: "border-hairline bg-page text-muted hover:border-ink/25",
  soon: "border-hairline bg-page text-muted hover:border-ink/25",
  planned: "border-hairline-soft bg-page text-muted-2 hover:border-ink/20",
};

const BADGE_CLASS: Record<SourceState, string> = {
  active: "bg-trust-pos-bg text-trust-pos-text",
  elsewhere: "bg-trust-pos-bg text-trust-pos-text",
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

// ================================================================================================
// JOB 3190 (UX-18 / N-0041) — NAME UND ZUSTAND STEHEN SCHMAL NICHT MEHR IN DERSELBEN ZEILE.
// ================================================================================================
//
// GEMESSEN (Chromium, `tests/import-einstieg/kachel-schmal-chromium.test.ts`): bis hierher war die
// Kachel EINE Zeile — Icon, Name mit `truncate`, Badge. Bei 320/360/390 px trug das Raster ZWEI
// Spalten; der Name wurde gekuerzt, damit das Badge in dieselbe Zeile passt. Genau das ist N-0041
// („Bei 390 px verdeckt der Status teilweise den Quellnamen").
//
// DIE REGEL: unterhalb von `sm` steht das Badge in EIGENER Zeile unter dem Namen, und der Name darf
// umbrechen statt zu kuerzen (`sm:truncate` statt `truncate`). Ab `sm` bleibt alles, wie es war —
// dieselbe Reihe, dieselben Abstaende, dieselbe Kuerzung. Die Verschachtelung ist bewusst so
// gewaehlt, dass sie ab `sm` geometrisch identisch zur alten ist: aussen eine Reihe aus
// [Icon+Name] und [Badge] mit `gap-2`, innen Icon und Name mit `gap-2`.
//
// JOB 3190 · RUNDE 2: die Kachel ist jetzt eine SPALTE aus [Name+Badge-Reihe] und — nur wo der Weg
// noch Schritte kostet — der sichtbaren Wegzeile. Die Reihe traegt `w-full`, ist also ab `sm`
// geometrisch dieselbe Reihe wie zuvor (gemessen in `kachel-schmal-chromium.test.ts`, Fall D1:
// Badge steht weiterhin rechts vom Namen in derselben Zeile).
const TILE_LAYOUT =
  "flex flex-col items-start gap-1 rounded-card border px-3 py-2.5 text-left text-[13px] font-semibold transition-colors focus:outline-none focus-visible:border-ink/50 focus-visible:ring-2 focus-visible:ring-brand/40";

function TileInhalt({ source, icon }: { source: GallerySource; icon: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  // Die Restschritte auf der Zielflaeche — sichtbar, nicht nur im `title` (Ben, Runde 1).
  const schritte = stepsKeyFor(source.state);
  return (
    <>
      {/* Die Klassenkette steht als LITERAL da (nicht als Konstante): der Klassenbindungs-Sammler
          `tests/app/mega47-modale-flaechen-sammler.test.tsx` löst Literale auf und meldet nur, was
          er nicht auflösen kann — eine Konstante hier hätte seine Zahl ohne Not bewegt. */}
      <span className="flex w-full min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="flex w-full min-w-0 items-center gap-2 sm:flex-1">
          <span aria-hidden className="shrink-0 text-muted-2">
            {icon}
          </span>
          {/* Schmal: umbrechen (der volle Name bleibt SICHTBAR). Ab `sm`: kuerzen wie bisher. */}
          <span data-tile-name className="min-w-0 flex-1 break-words sm:truncate">
            {t(source.labelKey)}
          </span>
        </span>
        {/* Zustand als TEXT im Badge (nicht nur Farbe) — barrierearm. */}
        <span
          data-tile-badge
          className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] font-medium ${BADGE_CLASS[source.state]}`}
        >
          {t(STATE_BADGE_KEY[source.state])}
        </span>
      </span>
      {/* Die zwei Schritte, die auf der Zielflaeche noch zu gehen sind — im Wortlaut DIESER Flaeche.
          Sie brechen um statt zu kuerzen: eine halbe Wegbeschreibung waere keine. */}
      {schritte ? (
        <span data-tile-steps className="w-full break-words text-[11px] font-normal text-muted-2">
          {t(schritte)}
        </span>
      ) : null}
    </>
  );
}

function Tile({
  source,
  icon,
  href,
  onClick,
}: {
  source: GallerySource;
  icon: ReactNode;
  /**
   * JOB 3190: Ist ein Ziel angegeben, IST die Kachel der Weg dorthin — ein echtes `<a>`, damit
   * Maus, Tab/Enter, Mittelklick und der Browser-Rueckweg ohne Nachbildung funktionieren. Ohne
   * Ziel bleibt sie das `<button>`, das sie immer war (kein Aufrufer aendert sich dadurch).
   */
  href: string | null;
  onClick: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const marken = {
    "data-id": source.id,
    "data-state": source.state,
    onClick,
  };
  // Die KLASSE steht ausdruecklich an beiden Elementen und NICHT im gemeinsamen Attributobjekt:
  // der Klassenbindungs-Sammler (`tests/app/mega47-modale-flaechen-sammler.test.tsx`) liest
  // `className`-Attribute am Baum. In ein Objekt geschoben verschwaende die Bindung aus seiner
  // Erhebung — gemessen: der Sammler zaehlte 215 statt der 216 des Ausgangsstands, die Bindung war
  // also verschwunden. Ein Waechter, an dem man vorbeischreiben kann, ist keiner.
  if (href !== null) {
    // Das Badge sagt in zwei Woertern, WO es weitergeht; der ausgeschriebene Satz steht am Link.
    // Er ist derselbe, den eine Kachel OHNE Ziel als Hinweis zeigt (`hintKeyFor`) — ein Text, zwei
    // Tueren, keine zweite Formulierung derselben Wahrheit.
    const hinweis = hintKeyFor(source.state);
    return (
      <a
        href={href}
        {...marken}
        {...(hinweis ? { title: t(hinweis) } : {})}
        className={`${TILE_LAYOUT} ${TILE_CLASS[source.state]}`}
      >
        <TileInhalt source={source} icon={icon} />
      </a>
    );
  }
  return (
    <button type="button" {...marken} className={`${TILE_LAYOUT} ${TILE_CLASS[source.state]}`}>
      <TileInhalt source={source} icon={icon} />
    </button>
  );
}

export interface FileTypePickerProps {
  sources: readonly GallerySource[];
  // Wird AUSSCHLIESSLICH für aktive Kacheln aufgerufen (echter, bestehender Fluss). Für bald/geplant
  // bleibt dieser Callback bewusst unberührt — kein Import, kein Dialog, kein Konnektor-Call.
  onActivate: (id: string) => void;
  /**
   * F-0120 / K-27 (JOB 2969 D1): Meldet den ehrlichen Kachel-Hinweis nach OBEN, statt ihn selbst
   * anzusagen — `null` heisst „kein Hinweis mehr".
   *
   * WOZU: Die Erfassen-Flaeche hat ZWEI Ablehnungsursachen (nicht unterstuetzte Datei,
   * nicht-importierende Kachel). Traegt jede ihre eigene Live-Region, sagt eine Vorlesehilfe
   * ZWEI Meldungen fuer EINEN Vorgang an — gemessen: beide Regionen trugen gleichzeitig Text,
   * in beiden Reihenfolgen. AUFTRAG-1840 hat dieselbe Doppelung schon einmal aufgeloest, damals
   * innerhalb von `CaptureFileImport`; das hier ist derselbe Griff eine Ebene hoeher.
   *
   * OPTIONAL, und das ist Absicht: Ohne diesen Prop bleibt alles wie bisher — die Import-Flaeche
   * (Stufe 2) hat keine zweite Ursache und behaelt ihre eigene Region unveraendert.
   */
  onHintChange?: (hintKey: string | null) => void;
  // Optionaler Icon-Wähler; Default: Datei-Icon je Typ. Systeme reichen z. B. Boxes herein.
  iconFor?: (source: GallerySource) => ReactNode;
  /**
   * JOB 3190 (UX-18): Ziel einer Kachel, die auf eine ANDERE Fläche des Produkts führt (Zustand
   * `elsewhere`). `null` heisst „kein Ziel" — dann bleibt die Kachel das bisherige `<button>` mit
   * dem ehrlichen Hinweis.
   *
   * WARUM ALS PROP UND NICHT IM BAUTEIL: dieses Bauteil kennt keinen Router und soll keinen
   * kennen — es wird auch ohne Router gerendert (SSR-Fixture der Import-Erklärseite,
   * `tests/m6-import-erklaerweg/gallery-fixture.tsx`). Wer ein Ziel hat, reicht es herein; wer
   * keines hat, ändert nichts.
   */
  hrefFor?: (source: GallerySource) => string | null;
  // Optionale Gruppen-Überschrift (i18n-Text).
  title?: string;
  // Klappt „geplant" hinter EINE Zeile?
  //
  // D-045 (JOB 1021): Das war bis hierher ein ausdrückliches Opt-in — eingeführt in mega32 Block G
  // nur für die Import-Galerie, während das Erfassen unverändert blieb. Diese Trennung ist
  // AUFGEHOBEN: Einklappen ist jetzt der STANDARD für beide Oberflächen. Der Grund ist derselbe,
  // der ihn in der Galerie erzwungen hat — zwei Drittel der Fläche tun nichts —, und er gilt im
  // Erfassen genauso.
  //
  // `false` bleibt als ausdrücklicher ALTMODUS erhalten: alle geplanten Kacheln sofort sichtbar,
  // kein Aufklapper. Er ist keine Altlast, sondern die bewusste Ausnahme für Aufrufer, die den
  // vollständigen Bestand in einem Blick brauchen — und für Bestandstests, die genau ihn prüfen.
  //
  // Beide Modi hängen an `tests/app/file-type-picker-planned-default.test.tsx`; wer den Default
  // zurückdreht, macht dort R1 rot.
  collapsePlanned?: boolean;
  // Speicherschlüssel des Aufklappers. Fehlt er, bleibt der Zustand rein flüchtig.
  plannedStorageKey?: string;
}

const keinZiel = (): string | null => null;

export function FileTypePicker({
  sources,
  onActivate,
  onHintChange,
  iconFor = defaultIconFor,
  hrefFor = keinZiel,
  title,
  collapsePlanned = true,
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
    // JOB 3190: Eine Kachel mit Ziel IST der Weg — sie führt dorthin und sagt daneben nicht noch
    // einmal, wo es langgeht. Ein Hinweis neben einer stattfindenden Navigation wäre Rauschen.
    if (hrefFor(source) !== null) {
      return;
    }
    if (source.state === "active") {
      setHint(null);
      onHintChange?.(null);
      onActivate(source.id);
      return;
    }
    // Der naechste Zustand wird VOR dem Setzen bestimmt, nicht im Updater: ein Seiteneffekt in
    // `setHint((prev) => …)` liefe im StrictMode zweimal und meldete den Hinweis doppelt nach oben.
    const naechster = hint?.id === source.id ? null : source;
    setHint(naechster);
    onHintChange?.(naechster ? hintKeyFor(naechster.state) : null);
  };

  const hintKey = hint ? hintKeyFor(hint.state) : null;
  // Die Reihenfolge innerhalb beider Mengen bleibt die von orderByState — hier wird nur GETRENNT,
  // nicht neu sortiert.
  const visible = collapsePlanned ? sources.filter((s) => s.state !== "planned") : sources;
  const planned = collapsePlanned ? sources.filter((s) => s.state === "planned") : [];
  // JOB 3190 (N-0041): schmal EINE Spalte. Zwei Spalten liessen bei 320 px rund 116 px je Kachel —
  // zu wenig fuer „PowerPoint (.pptx)" oder „Audio-/Video-Transkript" neben ihrem Badge. Ab `sm`
  // bleibt das Raster unveraendert dreispaltig.
  const grid = "grid grid-cols-1 gap-2 sm:grid-cols-3";
  const renderTile = (source: GallerySource): JSX.Element => (
    <Tile
      key={source.id}
      source={source}
      icon={iconFor(source)}
      href={hrefFor(source)}
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
      {/* F-0120 / K-27: Meldet die Galerie nach oben (`onHintChange`), traegt der ELTERNTEIL die
          eine Ansage — dann darf hier keine zweite Region stehen, sonst ist die Doppelung nur
          verschoben. Ohne den Prop bleibt die eigene Region wie bisher. */}
      {hintKey && !onHintChange ? (
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
