// IC-3 (Import-Cockpit): prompt-/filtergesteuerte AUSWAHL. Der Nutzer grenzt per Satz ODER per Klick
// (Autoren-/Themen-/Space-Chips der Landkarte, Zeitraum, Limit) ein, WAS importiert wird. „Vorschau"
// ruft die READ-ONLY select-Route (schreibt nichts) und zeigt „X von Y Treffer", die EFFEKTIV benutzten
// Kriterien (Transparenz) und die Vorschau-Liste. Noch KEIN Übernahme-Button — das ist IC-4.
// WP-IC-PAKET-1 (Teil 3): Chip-Filter kommen aus der Landkarte (Props); Zeitraum (von/bis Jahr) hier;
// eine bereits geöffnete Vorschau aktualisiert sich LIVE bei jeder Filter-Änderung (debounced).
// WP-IC-PAKET-1 (Teil 4, IC-6a): bereits importierte Seiten sind markiert („bereits importiert",
// optional „Quelle neuer als Import") und standardmäßig ABGEWÄHLT — bewusst wieder anwählbar (kein
// hartes Verbot; Review-Invariante bleibt, importiert wird hier ohnehin nichts).
// WP-SHIP9-S1b (bens GELB): offene Kandidaten tragen ein EIGENES Kennzeichen „bereits zur Prüfung
// vorgemerkt" (eigene Farbe/eigener Text, gleiche Vorab-Abwahl) — nie mehr „bereits importiert".
// WP-IC-PAKET-1 (Teil 1): Altbestand-Anzeige dekodiert HTML-Entities (nur Text-Rendering, nie HTML).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Images, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ImportPreviewEntry, ImportSelectCriteria, ImportSelectResponse } from "../api/types";
// JOB 3640: die EINE i18next-Instanz der Anwendung — dieselbe, die `useTranslation` bedient. Sie
// wird hier nur ERWEITERT (s. `registriereRahmenTexte` unten), nie umkonfiguriert.
import i18nInstanz from "../i18n";
import { clearFacetSelection } from "../lib/facetFilter";
// AUFTRAG-mega27 Block B: DIESELBE Filter-Technik wie die Bibliothek — Schiene, aktive Leiste,
// Bereichsfilter. Kein zweiter Nachbau neben einer ausgereiften, getesteten Technik.
import {
  EMPTY_FACET_RANGE,
  EMPTY_RAIL_UI,
  type FacetRailUiState,
  type FacetRange,
  facetRailGroups,
} from "../lib/facetRail";
import { type FacetValues, toggleFacetValue } from "../lib/facets";
import { displayImportText } from "../lib/htmlEntities";
import { summarizeSelectCriteria } from "../lib/importExplore";
// WP-SHIP9-S2 Paket 2 (D2–D7): reines View-Modell für Suche/Filter/Alle/Gruppen der Trefferliste.
import {
  DEFAULT_PREVIEW_VIEW,
  IMPORT_SELECT_FACET_CONFIGS,
  IMPORT_SELECT_RANGE_AFTER_KEY,
  IMPORT_SELECT_SECONDARY_FACET_KEYS,
  type PreviewChip,
  type PreviewGroupMode,
  type PreviewLanguage,
  type PreviewRow,
  bulkSelectableRows,
  clearAllSelected,
  defaultGroupMode,
  deselectLanguage,
  effectiveGroupMode,
  folderModeUnavailableReason,
  groupCheckboxState,
  groupModeOptions,
  groupRowsTree,
  groupsCollapsedByDefault,
  languageCounts,
  previewFacetValues,
  rowsAllChecked,
  selectionSummary,
  setRowsSelected,
  visibleRows,
} from "../lib/importSelectView";
// WP-IC-PAKET-1b (bens ROT-3): latest-wins — Antworten aelterer Requests werden verworfen.
import { createLatestWins } from "../lib/latestWins";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { useAiAvailable } from "../lib/useAiAvailable";
import { useAiBillable } from "../lib/useAiBillable";
import { FacetFilter } from "./FacetFilter";
// WP-IC-4: Schritt 4+5 (Gruppen-Freigabe + Übernahme mit Bilanz).
import { ImportGroups } from "./ImportGroups";
// RT5a-c (nacht24): Subfolder-Baum + Sprach-Massenaktion (Darstellung; Logik in importSelectView).
import { ImportPreviewTree, LanguageDeselectChips } from "./ImportPreviewTree";
// WP-COCKPIT-LINIE: Schritt-Überschrift (3 Eingrenzen) + Meilenstein-Meldung an die Leiste.
import {
  ImportStepHeading,
  useReportImportGeneration,
  useReportImportStage,
} from "./ImportStepper";
import { FacetActiveBar } from "./facets/FacetActiveBar";
import { Button, TextInput } from "./ui";

// Klick-Filter der Erkundungs-Landkarte (Roh-Werte, wie der Server sie kennt — dekodiert wird nur die
// Anzeige, nie der Filterwert).
export interface ImportChipCriteria {
  themes: string[];
  authors: string[];
  spaces: string[];
}

function parsedPositiveInt(raw: string): number | undefined {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// AUFTRAG-mega27 Block B: Speicherschlüssel des eingeklappten „Weitere Filter" — je Browser
// gemerkt, wie in der Bibliothek (Vorbild Library.tsx).
const IMPORT_MORE_FILTERS_STORAGE_KEY = "klarwerk.import.select.filters.moreOpen";

// Stabile leere Liste — sonst bekäme die memoisierte Facetten-Ableitung bei jedem Render eine neue
// Referenz und liefe umsonst.
const NO_ENTRIES: readonly ImportPreviewEntry[] = [];

// ================================================================================================
// JOB 3640 · DIE TEXTE DES VORFÜHRRAHMENS — DE/EN/NL, IN DER EINEN i18next-INSTANZ.
// ================================================================================================
//
// WARUM SIE HIER WOHNEN UND NICHT IN `i18n.ts`: Runde 1 hat die Schlüssel in den zentralen Katalog
// geschrieben. Das war ein ZIELPFAD-VERSTOSS (Urteil Runde 1: „ZIELPFAD-VERSTOSS:
// apps/web/src/i18n.ts") — die Datei steht nicht in den Zielpfaden dieses Auftrags, und ein Diff
// ausserhalb der Zielpfade ist ungeprüfter Code. §4.5 des Auftrags verlangt trotzdem „DE/EN
// vollständig". Beides geht zusammen, weil das Haus den Fall schon kennt: die Texte der
// Lesevariante wohnen seit JOB 3326 R4 ebenfalls BEI IHRER FUNKTION (`lib/lesevariante.ts`) und
// nicht im Katalog.
//
// DER UNTERSCHIED IST NUR DIE VERDRAHTUNG, NICHT DER MECHANISMUS: `lesevariante` wird in `i18n.ts`
// in die drei Sprachobjekte gespreizt; dieses Bündel meldet sich selbst an derselben, EINEN
// i18next-Instanz an. Es gibt danach genau ein `t()`, genau einen Ressourcenspeicher und genau
// einen Ort je Schlüssel — keine zweite Übersetzungswahrheit, kein zweiter Nachschlageweg. Die
// Aufrufstellen unten schreiben `t("imp.rahmen…")` wie jeder andere Text der Anwendung.
//
// `addResourceBundle` mit FLACHEM Objekt, nicht `addResource`: der Katalog in `i18n.ts` ist flach
// (Schlüssel mit Punkten sind EIN Schlüssel, keine Verschachtelung) — dieselbe Begründung wie in
// `tests/web/job2660-hilfe-fremdtext-ui.test.tsx:252`. `deep`/`overwrite` stehen auf `true`, damit
// der Aufruf idempotent ist: beide Zielpfad-Dateien rufen ihn (s. `registriereRahmenTexte` unten),
// und welche von beiden zuerst geladen wird, darf keine Rolle spielen.
//
// NACHFOLGE, ausdrücklich benannt: Sobald `i18n.ts` in den Zielpfaden eines Auftrags steht, gehören
// diese drei Objekte in den Katalog — die Aufrufstellen ändern sich dabei um KEIN Zeichen.
//
// NL steht hier, weil die Anwendung drei Sprachen führt und ein fehlendes Bündel stillschweigend
// auf Deutsch zurückfiele. Ein niederländischer Satz, der heimlich deutsch ist, ist kein Rückfall,
// sondern eine falsche Auskunft.
//
// JOB 3772: das Bündel trägt seit diesem Auftrag AUCH die drei Sätze der gewechselten Eingrenzung
// (`imp.eingrenzung…`). Es heisst weiter `RAHMEN_TEXTE`, weil es ein Transportweg ist und kein
// Themenordner — und weil `i18n.ts` weiterhin nicht in den Zielpfaden steht, gilt die NACHFOLGE
// oben unverändert für alle Schlüssel darin.
const RAHMEN_TEXTE_DE = {
  "imp.rahmen.titel": "Für welche Firma führst du vor?",
  "imp.rahmen.erklaerung":
    "Trage das Wort ein, das die Seiten dieser Firma im Titel tragen. Solange der Rahmen gilt, zeigen Eingrenzen, Vorschau und Übernahme ausschließlich Seiten mit diesem Wort im Titel. Es wird nichts umbenannt, nichts verschoben und nichts gelöscht.",
  "imp.rahmen.feldLabel": "Firma oder Demobereich",
  "imp.rahmen.platzhalter": "z. B. Advisor",
  "imp.rahmen.setzen": "Rahmen setzen",
  "imp.rahmen.aktiv": "Rahmen: {{firma}}",
  "imp.rahmen.aufheben": "Rahmen aufheben",
  "imp.rahmen.umfang_one": "1 Seite im Rahmen",
  "imp.rahmen.umfang_other": "{{count}} Seiten im Rahmen",
  "imp.rahmen.umfangLaeuft": "Seitenzahl wird gezählt …",
  "imp.rahmen.umfangFehler": "Seitenzahl nicht abrufbar.",
  "imp.rahmen.umfangVeraltet": "Auffrischung fehlgeschlagen — die Zahl ist die zuletzt gemessene.",
  "imp.rahmen.umfangErneut": "Erneut zählen",
  "imp.rahmen.umfangUngemessen":
    "Seitenzahl noch nicht gemessen — sie wird beim Erkunden ermittelt.",
  "imp.rahmen.leer":
    "Keine geladene Seite trägt „{{firma}}“ im Titel. Der Rahmen ist leer — prüfe die Schreibweise oder hebe ihn auf.",
  "imp.rahmen.landkarteUngerahmt":
    "Autoren, Themen, Quellen und Zeitraum darunter zählen den GESAMTEN Bestand: die Erkundung kann nicht nach Rahmen zählen. Gerahmt sind die Seitenzahl oben und alle folgenden Schritte.",
  "imp.rahmen.seitenImRahmen": "Seiten im Rahmen",
  "imp.rahmen.vonGesamt": "von {{total}} im Gesamtbestand",
  // Eigene Beschriftung, weil der Rahmen technisch ein `titleContains` ist, fachlich aber der
  // Rahmen und nicht ein vom Menschen gesetztes Titelkriterium.
  "imp.rahmen.critRahmen": "Rahmen (Firma)",
  "imp.rahmen.titelbefundUngerahmt":
    "Diese Zahl zählt den Gesamtbestand, nicht den Rahmen — deshalb gibt es dazu keinen Umschaltknopf, solange der Rahmen gilt.",
  // Runde 4 (BEN-Korrekturpflicht 1): der Rahmen hat gewechselt, die angezeigte Liste gehört noch
  // zur Abfrage davor. Sie wird NICHT geleert (LEHREN §7), aber sie ist ab sofort nichts, woraus
  // man auswählen, gruppieren oder übernehmen kann.
  "imp.rahmen.wechselLaeuft":
    "Der Rahmen gilt jetzt für „{{firma}}“. Die Liste unten stammt noch aus der Abfrage davor und wird im neuen Rahmen neu geholt — bis dahin lässt sich daraus nichts auswählen, gruppieren oder übernehmen.",
  "imp.rahmen.wechselLaeuftOhne":
    "Der Rahmen ist aufgehoben. Die Liste unten stammt noch aus der Abfrage im Rahmen davor und wird ohne Rahmen neu geholt — bis dahin lässt sich daraus nichts auswählen, gruppieren oder übernehmen.",
  "imp.rahmen.wechselFehler":
    "Die Vorschau im Rahmen „{{firma}}“ konnte nicht geholt werden. Die Liste unten stammt weiter aus der Abfrage davor; Auswählen, Gruppieren und Übernehmen bleiben gesperrt, bis die Vorschau im aktuellen Rahmen steht. „Vorschau aktualisieren“ versucht es erneut.",
  "imp.rahmen.wechselFehlerOhne":
    "Die Vorschau ohne Rahmen konnte nicht geholt werden. Die Liste unten stammt weiter aus der Abfrage im Rahmen davor; Auswählen, Gruppieren und Übernehmen bleiben gesperrt, bis die Vorschau zum aktuellen Stand passt. „Vorschau aktualisieren“ versucht es erneut.",
  "imp.rahmen.wechselGruppenGesperrt":
    "Gruppieren und Übernehmen stehen erst wieder bereit, wenn die Vorschau im aktuellen Rahmen steht — was hier stand, gehörte zur Abfrage davor.",
  // JOB 3772: dieselbe Lage eine Eingrenzung weiter (Chips, Jahre, Deckel). Die Sätze nennen die
  // TREFFERZAHL ausdrücklich mit, weil sie direkt darüber steht und sonst als Aussage über die
  // gerade gültige Eingrenzung gelesen würde — und sie sagen, was WEITER geht: anhaken. Der Rahmen
  // hat eigene Sätze, weil er mehr sperrt und den Schritt ganz ausbaut; ein gemeinsamer Text müsste
  // für einen der beiden Fälle lügen.
  "imp.eingrenzung.wechselLaeuft":
    "Die Trefferzahl darüber und die Liste darunter gehören noch zur Eingrenzung davor; die Vorschau zur aktuellen Eingrenzung wird gerade geholt. Bis dahin lässt sich daraus nichts gruppieren und nichts übernehmen — anhaken und abwählen bleiben möglich.",
  "imp.eingrenzung.wechselFehler":
    "Die Vorschau zur aktuellen Eingrenzung konnte nicht geholt werden. Die Trefferzahl darüber und die Liste darunter gehören weiter zur Eingrenzung davor; Gruppieren und Übernehmen bleiben gesperrt, bis die Vorschau zur aktuellen Eingrenzung passt. „Vorschau aktualisieren“ versucht es erneut.",
  "imp.eingrenzung.gruppenGesperrt":
    "Gruppieren und Übernehmen stehen erst wieder bereit, wenn die Vorschau zur aktuellen Eingrenzung passt — was hier steht, gehört zur Eingrenzung davor.",
};

const RAHMEN_TEXTE_EN: typeof RAHMEN_TEXTE_DE = {
  "imp.rahmen.titel": "Which company are you presenting for?",
  "imp.rahmen.erklaerung":
    "Enter the word that this company's pages carry in their title. While the frame applies, narrowing, preview and import show only pages with that word in the title. Nothing is renamed, moved or deleted.",
  "imp.rahmen.feldLabel": "Company or demo area",
  "imp.rahmen.platzhalter": "e.g. Advisor",
  "imp.rahmen.setzen": "Set frame",
  "imp.rahmen.aktiv": "Frame: {{firma}}",
  "imp.rahmen.aufheben": "Remove frame",
  "imp.rahmen.umfang_one": "1 page inside the frame",
  "imp.rahmen.umfang_other": "{{count}} pages inside the frame",
  "imp.rahmen.umfangLaeuft": "Counting pages …",
  "imp.rahmen.umfangFehler": "Page count unavailable.",
  "imp.rahmen.umfangVeraltet": "Refresh failed — this is the last measured number.",
  "imp.rahmen.umfangErneut": "Count again",
  "imp.rahmen.umfangUngemessen": "Page count not measured yet — it is determined when you explore.",
  "imp.rahmen.leer":
    "No loaded page carries “{{firma}}” in its title. The frame is empty — check the spelling or remove it.",
  "imp.rahmen.landkarteUngerahmt":
    "Authors, themes, sources and time range below count the ENTIRE source: exploring cannot count per frame. Framed are the page count above and every following step.",
  "imp.rahmen.seitenImRahmen": "Pages inside the frame",
  "imp.rahmen.vonGesamt": "of {{total}} in the entire source",
  "imp.rahmen.critRahmen": "Frame (company)",
  "imp.rahmen.titelbefundUngerahmt":
    "This number counts the entire source, not the frame — that is why there is no switch button while the frame applies.",
  "imp.rahmen.wechselLaeuft":
    "The frame now applies to “{{firma}}”. The list below still comes from the previous request and is being fetched again inside the new frame — until then nothing in it can be selected, grouped or imported.",
  "imp.rahmen.wechselLaeuftOhne":
    "The frame has been removed. The list below still comes from the request inside the previous frame and is being fetched again without a frame — until then nothing in it can be selected, grouped or imported.",
  "imp.rahmen.wechselFehler":
    "The preview inside the frame “{{firma}}” could not be fetched. The list below still comes from the previous request; selecting, grouping and importing stay locked until the preview matches the current frame. “Refresh preview” tries again.",
  "imp.rahmen.wechselFehlerOhne":
    "The preview without a frame could not be fetched. The list below still comes from the request inside the previous frame; selecting, grouping and importing stay locked until the preview matches the current state. “Refresh preview” tries again.",
  "imp.rahmen.wechselGruppenGesperrt":
    "Grouping and importing become available again once the preview matches the current frame — what stood here belonged to the previous request.",
  "imp.eingrenzung.wechselLaeuft":
    "The hit count above and the list below still belong to the previous narrowing; the preview for the current narrowing is being fetched. Until then nothing in it can be grouped or imported — selecting and deselecting stay possible.",
  "imp.eingrenzung.wechselFehler":
    "The preview for the current narrowing could not be fetched. The hit count above and the list below still belong to the previous narrowing; grouping and importing stay locked until the preview matches the current narrowing. “Refresh preview” tries again.",
  "imp.eingrenzung.gruppenGesperrt":
    "Grouping and importing become available again once the preview matches the current narrowing — what stands here belongs to the previous narrowing.",
};

const RAHMEN_TEXTE_NL: typeof RAHMEN_TEXTE_DE = {
  "imp.rahmen.titel": "Voor welk bedrijf geef je de demo?",
  "imp.rahmen.erklaerung":
    "Vul het woord in dat de pagina's van dit bedrijf in de titel dragen. Zolang het kader geldt, tonen afbakenen, voorbeeld en overname uitsluitend pagina's met dat woord in de titel. Er wordt niets hernoemd, verplaatst of verwijderd.",
  "imp.rahmen.feldLabel": "Bedrijf of demogebied",
  "imp.rahmen.platzhalter": "bijv. Advisor",
  "imp.rahmen.setzen": "Kader instellen",
  "imp.rahmen.aktiv": "Kader: {{firma}}",
  "imp.rahmen.aufheben": "Kader opheffen",
  "imp.rahmen.umfang_one": "1 pagina binnen het kader",
  "imp.rahmen.umfang_other": "{{count}} pagina's binnen het kader",
  "imp.rahmen.umfangLaeuft": "Aantal pagina's wordt geteld …",
  "imp.rahmen.umfangFehler": "Aantal pagina's niet op te halen.",
  "imp.rahmen.umfangVeraltet": "Verversen mislukt — dit is het laatst gemeten aantal.",
  "imp.rahmen.umfangErneut": "Opnieuw tellen",
  "imp.rahmen.umfangUngemessen":
    "Aantal pagina's nog niet gemeten — het wordt bij het verkennen bepaald.",
  "imp.rahmen.leer":
    "Geen geladen pagina draagt „{{firma}}“ in de titel. Het kader is leeg — controleer de schrijfwijze of hef het op.",
  "imp.rahmen.landkarteUngerahmt":
    "Auteurs, thema's, bronnen en periode hieronder tellen de VOLLEDIGE bron: verkennen kan niet per kader tellen. Gekaderd zijn het aantal pagina's hierboven en alle volgende stappen.",
  "imp.rahmen.seitenImRahmen": "Pagina's binnen het kader",
  "imp.rahmen.vonGesamt": "van {{total}} in de volledige bron",
  "imp.rahmen.critRahmen": "Kader (bedrijf)",
  "imp.rahmen.titelbefundUngerahmt":
    "Dit aantal telt de volledige bron, niet het kader — daarom is er geen omschakelknop zolang het kader geldt.",
  "imp.rahmen.wechselLaeuft":
    "Het kader geldt nu voor „{{firma}}“. De lijst hieronder komt nog uit de vorige aanvraag en wordt binnen het nieuwe kader opnieuw opgehaald — tot dan kan er niets uit worden gekozen, gegroepeerd of overgenomen.",
  "imp.rahmen.wechselLaeuftOhne":
    "Het kader is opgeheven. De lijst hieronder komt nog uit de aanvraag binnen het vorige kader en wordt zonder kader opnieuw opgehaald — tot dan kan er niets uit worden gekozen, gegroepeerd of overgenomen.",
  "imp.rahmen.wechselFehler":
    "Het voorbeeld binnen het kader „{{firma}}“ kon niet worden opgehaald. De lijst hieronder komt nog steeds uit de vorige aanvraag; kiezen, groeperen en overnemen blijven geblokkeerd totdat het voorbeeld bij het huidige kader past. „Voorbeeld verversen“ probeert het opnieuw.",
  "imp.rahmen.wechselFehlerOhne":
    "Het voorbeeld zonder kader kon niet worden opgehaald. De lijst hieronder komt nog steeds uit de aanvraag binnen het vorige kader; kiezen, groeperen en overnemen blijven geblokkeerd totdat het voorbeeld bij de huidige stand past. „Voorbeeld verversen“ probeert het opnieuw.",
  "imp.rahmen.wechselGruppenGesperrt":
    "Groeperen en overnemen zijn pas weer beschikbaar als het voorbeeld bij het huidige kader past — wat hier stond, hoorde bij de vorige aanvraag.",
  "imp.eingrenzung.wechselLaeuft":
    "Het aantal treffers hierboven en de lijst hieronder horen nog bij de vorige afbakening; het voorbeeld voor de huidige afbakening wordt opgehaald. Tot dan kan er niets uit worden gegroepeerd of overgenomen — aanvinken en afvinken blijven mogelijk.",
  "imp.eingrenzung.wechselFehler":
    "Het voorbeeld voor de huidige afbakening kon niet worden opgehaald. Het aantal treffers hierboven en de lijst hieronder horen nog steeds bij de vorige afbakening; groeperen en overnemen blijven geblokkeerd totdat het voorbeeld bij de huidige afbakening past. „Voorbeeld verversen“ probeert het opnieuw.",
  "imp.eingrenzung.gruppenGesperrt":
    "Groeperen en overnemen zijn pas weer beschikbaar als het voorbeeld bij de huidige afbakening past — wat hier staat, hoort bij de vorige afbakening.",
};

/**
 * Die Texte des Rahmens an der EINEN i18next-Instanz anmelden.
 *
 * IDEMPOTENT und ohne Reihenfolgeannahme: beide Flächen des Rahmens rufen ihn beim Laden ihres
 * Moduls (hier direkt darunter, in `ImportExplore.tsx` neben dem Import). Wer zuerst geladen wird,
 * spielt damit keine Rolle — und ein Test, der nur EINE der beiden Flächen mountet, hat die Texte
 * trotzdem. Genau das war die Falle: ein stiller Verlass auf die Modulreihenfolge hätte die
 * englische Fläche im falschen Einstieg auf Rohschlüssel zurückfallen lassen.
 */
export function registriereRahmenTexte(): void {
  i18nInstanz.addResourceBundle("de", "translation", RAHMEN_TEXTE_DE, true, true);
  i18nInstanz.addResourceBundle("en", "translation", RAHMEN_TEXTE_EN, true, true);
  i18nInstanz.addResourceBundle("nl", "translation", RAHMEN_TEXTE_NL, true, true);
}

registriereRahmenTexte();

// ================================================================================================
// JOB 3640 · DER VORFÜHRRAHMEN BINDET AUCH DIESEN SCHRITT.
// ================================================================================================
//
// Der Rahmen ist ein Titelwort (WARUM genau dieses Merkmal: Kopf von `ImportExplore.tsx`). Er
// kommt von oben herein und reist als `titleContains` in JEDER Anfrage dieses Schritts mit. Damit
// ist er KEIN vorbelegter Filter, den man wegklicken kann: es gibt hier kein Bedienelement, das
// ihn entfernt — aufheben kann ihn nur die Leiste oben.
//
// DASS ER AUCH GRUPPIERUNG UND ÜBERNAHME BINDET, ist kein zweiter Mechanismus: beide laufen über
// `preview.criteria`, also über die Kriterien, die der SERVER als effektiv benutzt zurückmeldet —
// und dort steht der Rahmen, weil die Klick-Kriterien die KI-Deutung schlagen
// (`{...derived.criteria, ...clickCriteria}`, routes/confluence-import-routes.ts).
//
// DIE EINE STELLE, AN DER MAN AUS DEM RAHMEN HERAUSFIELE, ist der Umschaltknopf des Titelbefunds
// (JOB 3356): er fordert die Vorschau mit GENAU den Server-Kriterien `{titleContains: [satz]}` an.
// Mehrere Einträge in `titleContains` wirken als ODER (`matchesTitleContains`) — den Rahmen dort
// mit hineinzulegen würde die Auswahl also AUSWEITEN statt sie zu rahmen. Der Knopf entfällt
// deshalb, solange ein Rahmen gilt, und der Titelbefund sagt dazu ausdrücklich, dass seine Zahl
// den Gesamtbestand zählt. Eine Zahl, die den Rahmen ignoriert, muss als solche dastehen.
export function ImportSelect({
  chip,
  rahmen = null,
}: {
  chip: ImportChipCriteria;
  // Der gültige Vorführrahmen (Titelwort) oder `null`. Optional, damit Aufrufer ohne Rahmen
  // zeichengleich bleiben — ohne Rahmen verhält sich dieser Schritt exakt wie bisher.
  rahmen?: string | null;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  // AUFTRAG-mega9 Block E-5 (KW-E2E-009): Bilanz und Review-Abfrage nach der Übernahme GEMEINSAM
  // auffrischen. ImportGroups bleibt bewusst ohne react-query-Abhängigkeit (dokumentiert an
  // jumpToReview) — die Invalidierung sitzt deshalb hier, im Eltern-Kontext.
  const qc = useQueryClient();
  // PAKET 1 (D-AISTATE, Pedi 23.07.): ist die KI-Gruppierung (Task „group") nutzbar? An ImportGroups
  // durchgereicht — der deterministische Gruppierungs-Ablauf bleibt nutzbar, nur der Vor-Hinweis ehrlich.
  const groupAi = useAiAvailable("group");
  // AUFTRAG-mega67 Block G: dieselbe Fläche, andere Frage — nutzbar ist nicht dasselbe wie teuer.
  // ImportGroups sitzt ohne eigenen Zugang zum Status; der Boolean kommt deshalb von hier.
  const groupBillable = useAiBillable("group");
  const [prompt, setPrompt] = useState("");
  // WP-VIP2-GATE-2 (bens Fix 1): PFLICHT-Eigeneinstufung des Auswahl-Satzes — VORGABE ist
  // fail-safe „Ja/unsicher" (vertraulich); nur die bewusste Wahl „Nein, unbedenklich" erlaubt
  // dem Server ueberhaupt den Cloud-Weg (und auch dann nur bei komplett freigegebenem Snapshot).
  const [promptConfidential, setPromptConfidential] = useState(true);
  const [limit, setLimit] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  // WP-IC-PAKET-1 (Teil 4): Auswahl-Zustand je Vorschau-Zeile — Standard: alles an, AUSSER bereits
  // importierte Einträge (Doppel-Import vermeiden); bewusstes Wieder-Anwählen bleibt möglich.
  const [checkedRows, setCheckedRows] = useState<boolean[]>([]);
  // WP-IC-PAKET-1b (bens ROT-3): die angezeigte Vorschau liegt in EIGENEM State und wird NUR vom
  // latest-wins-Guard gesetzt — select.data (letzte SETTLED Mutation) könnte eine ältere, später
  // fertig gewordene Antwort sein und Vorschau + checkedRows rückwärts überschreiben.
  const [preview, setPreview] = useState<ImportSelectResponse | null>(null);
  // JOB 3356 (Runde 2, BEN-Korrekturpflicht 1): DER SATZ, DER ZU DIESER ANTWORT GEFÜHRT HAT.
  // Ohne ihn konnte die Fläche nicht sagen, WOZU die angezeigte Deutung und die Titelzahl gehören —
  // nach einer laufenden oder gescheiterten Folgeanfrage standen beide unverändert da und lasen sich
  // wie eine Aussage über den Satz, der gerade im Feld steht. Er wird NUR aus einer erfolgreichen
  // Antwort gesetzt (zusammen mit `preview`, im selben latest-wins-Zweig) — nie aus dem Eingabefeld.
  const [previewPrompt, setPreviewPrompt] = useState("");
  // JOB 3640 (Runde 4, BEN-Korrekturpflicht 1): DER RAHMEN, MIT DEM DIESE ANTWORT GEHOLT WURDE.
  // Genau derselbe Gedanke wie `previewPrompt` eine Zeile darüber, eine Ebene ernster: ohne ihn
  // konnte die Fläche nicht sagen, ZU WELCHEM Rahmen die angezeigte Liste gehört — nach einem
  // Rahmenwechsel stand die alte, ungerahmte Auswahl unverändert da und liess sich gruppieren und
  // ÜBERNEHMEN, während oben „Rahmen: Advisor" zu lesen war (bens Zustandsgegenprobe Runde 3:
  // `{"criteria":{},"includeIds":["basic1"],…}`). Er wird NUR aus einer erfolgreichen Antwort
  // gesetzt, im selben latest-wins-Zweig wie `preview` — nie aus dem Prop.
  const [previewRahmen, setPreviewRahmen] = useState<string | null>(null);
  // JOB 3772: DIE EINGRENZUNG, MIT DER DIESE ANTWORT GEHOLT WURDE — derselbe Schnappschuss-Weg wie
  // `previewPrompt` und `previewRahmen` darüber, nur für die ganze Kriterienmenge (Chips, Jahre,
  // Deckel, Rahmen). Er trägt den CLIENT-Schlüssel `criteriaKey`, nicht `preview.criteria`.
  //
  // WARUM NICHT `preview.criteria`: der Server meldet die EFFEKTIV benutzten Kriterien zurück und
  // mischt dort die KI-Deutung des Satzes hinein (`{...derived.criteria, ...clickCriteria}`,
  // routes/confluence-import-routes.ts — s. Kopf dieser Datei). Ein Vergleich „Server-Kriterien
  // gegen clientseitig gebaute Kriterien" wäre überall dort ungleich, wo der Server etwas ergänzt
  // oder eine eigene Kriterienmenge zurückmeldet — und sperrte die Fläche dauerhaft, ohne dass sich
  // etwas geändert hätte. GEMESSEN, nicht vermutet: mit diesem Vergleich stand der Titelbefund-Weg
  // sofort und dauerhaft gesperrt da (Gegenprobe C der Rückgabe, Fall „TITELBEFUND").
  // Verglichen wird deshalb Client-Schlüssel gegen Client-Schlüssel.
  // `null` = es gab noch nie eine erfolgreiche Antwort.
  const [previewKriterien, setPreviewKriterien] = useState<string | null>(null);
  const latestRef = useRef(createLatestWins());
  // WP-SHIP9-S2 Paket 2 (D3–D7): Ansichts-Zustand der Trefferliste (Suche/Filter-Chip/Ausblenden/
  // Gruppierung). Rein für die DARSTELLUNG — die Auswahl selbst bleibt in checkedRows (Originalindex).
  const [view, setView] = useState(DEFAULT_PREVIEW_VIEW);
  // AUFTRAG-mega27 Block B: Anzeige-Zustand der Filterschiene (Suchtext/„alle zeigen" je Dimension) —
  // derselbe Zustandstyp wie in der Bibliothek.
  const [railUi, setRailUi] = useState<FacetRailUiState>(EMPTY_RAIL_UI);
  // AUFTRAG-mega27 A4: hat der Nutzer den Gruppier-Modus SELBST gewählt? Solange nicht, gilt die
  // VORGABE aus dem Bestand (Ordner, sobald es eine echte Struktur gibt) — und eine Live-
  // Aktualisierung der Vorschau darf eine bewusste Wahl nicht überschreiben.
  const [groupModeTouched, setGroupModeTouched] = useState(false);
  // WP-BILD-1f RT5a: expliziter Auf-/Zu-Zustand je Gruppe (Baugruppen-Ordner). Nur EXPLIZITE
  // Nutzer-Klicks landen hier; ohne Eintrag gilt der Standard (offen, bzw. eingeklappt bei vielen
  // Geschwistern auf derselben Ebene). Der Key ist der volle Pfad-Schlüssel des Knotens.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // WP-COCKPIT-LINIE: Vorschau da → Meilenstein "previewed" an die Schritt-Leiste; beim ERSTEN
  // Erscheinen zur Vorschau scrollen (Muster aus R7) — Live-Aktualisierungen der Filter springen
  // danach bewusst nicht mehr.
  const reach = useReportImportStage();
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const scrolledToPreviewRef = useRef(false);
  useEffect(() => {
    if (preview !== null) {
      reach("previewed");
      if (!scrolledToPreviewRef.current) {
        scrolledToPreviewRef.current = true;
        previewBoxRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }
    }
  }, [preview, reach]);

  // WP-COCKPIT-LINIE-b (bens Punkt 2): die Eingrenzungs-EINGABEN (Chips/Jahre/Limit/Satz) sind die
  // Generation des Fortschritts. Ändert sich die Eingrenzung nach einer Bilanz, meldet dieser
  // Effekt die neue Generation — der Provider nimmt den Schritten 4+5 ehrlich die Haken und macht
  // Schritt 3 wieder zum aktuellen (Monotonie gilt nur innerhalb einer Generation).
  const beginGeneration = useReportImportGeneration();
  const generationKey = JSON.stringify([
    chip.themes,
    chip.authors,
    chip.spaces,
    // JOB 3640: ein gewechselter oder aufgehobener Rahmen ist eine andere Eingrenzung — die Leiste
    // nimmt den Schritten 4+5 dafür ihre Haken zurück, wie bei jedem anderen Kriterium auch.
    rahmen,
    yearFrom,
    yearTo,
    limit,
    prompt,
  ]);
  useEffect(() => {
    beginGeneration(generationKey);
  }, [generationKey, beginGeneration]);

  // WP-IC-PAKET-1 (Teil 3): DER SCHLÜSSEL DER EINGRENZUNG — alles, was der Mensch hier einstellen
  // kann und was in `buildCriteria` landet, als ein vergleichbarer Wert. Er steuert das verzögerte
  // Nachladen (Effekt weiter unten).
  // JOB 3772: er steht jetzt VOR der Mutation, weil deren `mutationFn` ihn als Schnappschuss mit
  // zurückgibt (`gesendeteKriterien`). Ein Vorgriff aus der Closure heraus wäre zwar gelaufen, aber
  // beim Lesen eine Falle. Der Satz gehört bewusst NICHT hinein: er wird per Knopf angefordert, und
  // seine Zuordnung führt `previewPrompt`.
  const criteriaKey = JSON.stringify([
    chip.themes,
    chip.authors,
    chip.spaces,
    // JOB 3640: ein gewechselter Rahmen ist eine ECHTE Filteränderung — eine offene Vorschau lädt
    // dafür nach, wie bei Chips, Jahren und Deckel.
    rahmen,
    yearFrom,
    yearTo,
    limit,
  ]);

  const buildCriteria = (): ImportSelectCriteria => {
    const parsedLimit = parsedPositiveInt(limit);
    const from = parsedPositiveInt(yearFrom);
    const to = parsedPositiveInt(yearTo);
    return {
      ...(chip.themes.length > 0 ? { themes: chip.themes } : {}),
      ...(chip.authors.length > 0 ? { authors: chip.authors } : {}),
      ...(chip.spaces.length > 0 ? { spaces: chip.spaces } : {}),
      // JOB 3640: der Rahmen. Genau EIN Eintrag — mehrere wären ein ODER und damit kein Rahmen.
      ...(rahmen !== null ? { titleContains: [rahmen] } : {}),
      ...(from !== undefined ? { yearFrom: from } : {}),
      ...(to !== undefined ? { yearTo: to } : {}),
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
    };
  };

  // JOB 3356 (IMPORT-FREITEXT-TITEL): die Vorschau kann jetzt mit EINER fertigen Kriterienmenge
  // angefordert werden — genau der Weg des Titel-Knopfs. Wird sie übergeben, gilt sie ALLEIN und der
  // Satz reist NICHT mit: sonst käme die KI-Deutung (Thema) über UND wieder dazu und der Titelweg
  // fände dasselbe Nichts. Ohne Übergabe bleibt alles wie bisher (Satz + Klick-Filter).
  const select = useMutation<
    {
      requestId: number;
      data: ImportSelectResponse;
      gesendeterSatz: string;
      gesendeterRahmen: string | null;
      gesendeteKriterien: string;
    },
    unknown,
    // `undefined` = „wie bisher" (Satz + Klick-Filter); nur der Titelweg reicht eine fertige
    // Kriterienmenge herein. Bewusst nicht `void` im Vertrag: das erlaubte zwar den argumentlosen
    // Aufruf, ist aber `lint/suspicious/noConfusingVoidType` — die Aufrufer übergeben deshalb
    // ausdrücklich `undefined`.
    ImportSelectCriteria | undefined
  >({
    mutationFn: async (override) => {
      // ROT-3: jeder Start zieht eine Request-ID; nur die zuletzt gestartete darf anwenden.
      const requestId = latestRef.current.begin();
      // JOB 3356 R2: der GESENDETE Satz reist mit der Antwort zurück — die Anzeige darf ihre
      // Zuordnung nicht aus dem Eingabefeld ableiten, das sich inzwischen geändert haben kann.
      const gesendeterSatz = override ? "" : prompt.trim();
      // JOB 3640 R4: WELCHER Rahmen in dieser Anfrage steckt — dieselbe Regel wie beim Satz, und
      // aus demselben Grund: das Prop kann sich ändern, während die Anfrage unterwegs ist. Der
      // Titelweg (`override`) schickt AUSDRÜCKLICH nur `{titleContains: [satz]}` und damit KEINEN
      // Rahmen; seine Antwort gehört deshalb zu keinem. Sein Knopf existiert ohnehin nur, solange
      // kein Rahmen gilt (s. Kopf dieser Datei) — beides sagt dasselbe, hier steht es auch dann
      // richtig da, wenn der Knopf je wieder unter einem Rahmen erschiene.
      const gesendeterRahmen = override === undefined ? rahmen : null;
      // JOB 3772: die Eingrenzung, die beim START dieser Anfrage galt. Auch für den Titelweg
      // (`override`) wird der GERADE GÜLTIGE Client-Schlüssel vermerkt, obwohl dieser Weg eine
      // eigene Kriterienmenge schickt: sein Ergebnis ist genau das, was der Mensch mit dem Knopf
      // angefordert hat, und es wird von keinem Nachladen abgelöst (der Knopf ändert `criteriaKey`
      // nicht). Ihn hier als „gehört zu keiner Eingrenzung" zu vermerken hiesse, den Titelweg
      // dauerhaft zu sperren — die Sperre soll den Menschen schützen, nicht seinen Knopf abschaffen.
      const gesendeteKriterien = criteriaKey;
      const data = await endpoints.admin.import.select({
        prompt: gesendeterSatz,
        criteria: override ?? buildCriteria(),
        // WP-SAMMEL20-FIX (bens Fix 3): locale explizit mitgeben (Route-Schema: de/en).
        locale: toReasonerLocale(i18n.language),
        // WP-VIP2-GATE-2 (bens Fix 1): die Eigeneinstufung reist IMMER mit (Pflichtfeld).
        promptConfidential,
      });
      return { requestId, data, gesendeterSatz, gesendeterRahmen, gesendeteKriterien };
    },
    onSuccess: ({ requestId, data, gesendeterSatz, gesendeterRahmen, gesendeteKriterien }) => {
      if (!latestRef.current.isCurrent(requestId)) {
        return; // ältere Antwort — verwerfen, die neuere Vorschau bleibt stehen
      }
      setPreview(data);
      setPreviewPrompt(gesendeterSatz);
      setPreviewRahmen(gesendeterRahmen);
      setPreviewKriterien(gesendeteKriterien);
      // WP-SHIP9-S1b: auch Vorgemerktes startet abgewählt (Queue-Schutz), bleibt aber anwählbar.
      setCheckedRows(
        data.preview.map((entry) => entry.alreadyImported !== true && entry.alreadyQueued !== true),
      );
    },
  });

  // WP-IC-PAKET-1 (Teil 3): LIVE-Trefferzahl — sobald eine Vorschau einmal geöffnet wurde, aktualisiert
  // jede Filter-Änderung (Chips/Jahre/Limit) sie automatisch (debounced; Prompt weiterhin per Knopf).
  const hasPreviewRef = useRef(false);
  if (preview !== null) {
    hasPreviewRef.current = true;
  }
  const mutateRef = useRef(select.mutate);
  mutateRef.current = select.mutate;
  const lastCriteriaKeyRef = useRef(criteriaKey);
  useEffect(() => {
    // Nur bei ECHTER Filter-Änderung nach einer geöffneten Vorschau nachladen (nicht beim Mount).
    if (!hasPreviewRef.current || lastCriteriaKeyRef.current === criteriaKey) {
      lastCriteriaKeyRef.current = criteriaKey;
      return;
    }
    lastCriteriaKeyRef.current = criteriaKey;
    const timer = setTimeout(() => mutateRef.current(undefined), 350);
    return () => clearTimeout(timer);
  }, [criteriaKey]);

  // JOB 3356: `summarizeSelectCriteria` (apps/web/src/lib/importExplore.ts) kennt `titleContains`
  // nicht und liegt ausserhalb der Zielpfade dieses Auftrags. Die Zeile entsteht deshalb hier — und
  // wird in DIESELBE Liste gehängt, nicht in einen zweiten Kasten daneben: ohne sie stünde nach dem
  // Titel-Klick „Keine Eingrenzung — alles würde passen." über einer titelgefilterten Liste.
  // JOB 3640: Gilt ein Rahmen, IST dieses `titleContains` der Rahmen — buildCriteria schickt genau
  // ihn, und die Klick-Kriterien schlagen serverseitig die KI-Deutung. Dann trägt die Zeile die
  // Beschriftung des Rahmens statt der eines vom Menschen gesetzten Titelkriteriums; beides in
  // DERSELBEN Liste, nicht in zwei Kästen nebeneinander.
  // Runde 4: die Beschriftung hängt am Rahmen DIESER Antwort (`previewRahmen`), nicht am gerade
  // gültigen Prop — die Zeile beschreibt, was der Server für diese Liste benutzt hat. Nach einem
  // Rahmenwechsel stünde sonst die Beschriftung des neuen Rahmens über dem Wort des alten.
  const titleCriteriaLine =
    preview && (preview.criteria.titleContains?.length ?? 0) > 0
      ? `${previewRahmen !== null ? t("imp.rahmen.critRahmen") : t("imp.select.critTitle")}: ${(
          preview.criteria.titleContains ?? []
        ).join(", ")}`
      : null;
  const criteriaLines = preview
    ? [
        ...summarizeSelectCriteria(preview.criteria, {
          themes: t("imp.select.critThemes"),
          authors: t("imp.select.critAuthors"),
          keywords: t("imp.select.critKeywords"),
          years: t("imp.select.critYears"),
          limit: t("imp.select.critLimit"),
          spaces: t("imp.select.critSpaces"),
        }),
        ...(titleCriteriaLine ? [titleCriteriaLine] : []),
      ]
    : [];

  // JOB 3356: der Titelbefund zeigt sich GENAU dann, wenn die Vorschau leer ist und ein Satz
  // gestellt war (nur dann sendet der Server das Feld). Er stammt IMMER aus einer erfolgreichen
  // Antwort — `preview` ist der latest-wins-Stand der letzten 200er-Antwort; ein Fehler oder ein
  // laufender Nachschlag erzeugt hier nie eine Zahl (Zustandsmodell des Auftrags).
  const titleFallback =
    preview !== null && preview.preview.length === 0 ? preview.titleFallback : undefined;
  // JOB 3356 (Runde 2, BEN-Korrekturpflicht 1 + Nachführung der Steuerung 08.09. 22:21):
  // WÄHREND EINE FOLGEANFRAGE LÄUFT ODER GESCHEITERT IST, GILT KEINE ALTE TITELAUSSAGE ALS AKTUELL.
  // Der Kasten wird deshalb nicht geleert (die zuletzt erfolgreich geholte Auskunft bleibt lesbar —
  // Zustandsmodell „Cache mit gescheiterter Auffrischung"), sondern sichtbar dem Satz zugeordnet,
  // der sie erzeugt hat, mit dem Grund daneben. Der Umschaltknopf verschwindet dabei: er würde auf
  // eine Zahl umstellen, die gerade keine geprüfte Grundlage mehr hat.
  // Der dritte Fall (der Mensch hat den Satz im Feld geändert, aber noch nicht angefordert) ist
  // dieselbe Lage aus demselben Grund und läuft über dieselbe eine Regel — kein zweiter Weg.
  const titleFallbackGrund: "pending" | "error" | "changed" | null = select.isPending
    ? "pending"
    : select.isError
      ? "error"
      : previewPrompt !== prompt.trim()
        ? "changed"
        : null;

  const errorMessage = select.error instanceof ApiError ? select.error.message : t("state.error");
  const alreadyImportedCount = preview?.alreadyImported ?? 0;
  const alreadyQueuedCount = preview?.alreadyQueued ?? 0;

  // ==============================================================================================
  // JOB 3640 (Runde 4) · EIN GEWECHSELTER RAHMEN ENTWERTET DIE ALTE LISTE SOFORT.
  // ==============================================================================================
  //
  // BENS BEFUND (Runde 3, ROT): Vorschau und Gruppen reisten dem Rahmen nur NACH — das Nachladen
  // ist um 350 ms verzögert und kann scheitern. In genau diesem Fenster stand unter „Rahmen:
  // Advisor" weiterhin die alte, ungerahmte Auswahl, und ihr Übernehmen-Knopf schickte sie
  // tatsächlich ab. Der Rahmen ist aber eine ZUSAGE („ausschließlich Seiten mit diesem Wort im
  // Titel") — sie darf keine Sekunde lang falsch sein.
  //
  // DIE REGEL, EINE ZEILE: Gehört die angezeigte Antwort nicht zum aktuell gültigen Rahmen, ist sie
  // eine ALTE AUSKUNFT und keine Grundlage mehr zum Handeln. Sie bleibt sichtbar (LEHREN §7: eine
  // gescheiterte Auffrischung leert nichts), sagt aber, wozu sie gehört — und alles, was aus ihr
  // etwas MACHEN würde (anhaken, Massenaktionen, gruppieren, übernehmen), ist gesperrt, bis die
  // Vorschau im aktuellen Rahmen steht. Das gilt in beide Richtungen: ein gesetzter, ein
  // gewechselter und ein aufgehobener Rahmen sind derselbe Fall.
  //
  // KEIN ZWEITER FILTERWEG: die alte Liste wird hier NICHT clientseitig nachgefiltert. Der
  // Titelvergleich wohnt im Server (`matchesTitleContains`, services/library-analytics/src/select.ts);
  // ihn hier nachzubauen hiesse, zwei Wahrheiten darüber zu führen, was im Rahmen liegt. Die eine
  // Antwort, die zählt, kommt vom Server — bis sie da ist, wird gewartet, nicht geraten.
  //
  // ==============================================================================================
  // JOB 3772 · DIESELBE FRAGE, EINE EINGRENZUNG WEITER — EINE REGEL, ZWEI SCHÄRFEN.
  // ==============================================================================================
  //
  // DER REST AUS JOB 3640 R4, wörtlich: „Dieselbe Bauart von Lücke besteht weiterhin für die
  // ÜBRIGEN Eingrenzungen (Themen-/Autoren-Chips, Jahre, Deckel): auch dort liegen zwischen der
  // Änderung und der neu geholten Vorschau 350 ms, in denen eine schon gebaute Gruppierung der
  // vorherigen Eingrenzung übernommen werden kann."
  //
  // ES GIBT DESHALB GENAU EINE STELLE, DIE FRAGT „GEHÖRT DIE ANGEZEIGTE ANTWORT ZUR GEGENWART?" —
  // die Zeile `kriterienVeraltet` hier. Sie vergleicht den Schnappschuss der Eingrenzung, mit der
  // die angezeigte Antwort GEHOLT wurde, gegen die Eingrenzung, die JETZT gilt.
  //
  // DER RAHMENFALL IST IHRE TEILMENGE, KEIN ZWEITER MECHANISMUS: der Rahmen steckt selbst in
  // `criteriaKey` (s. dort), ein Rahmenwechsel macht die Antwort also immer auch kriterien-veraltet.
  // `rahmenVeraltet` ist von hier ab nur noch die SCHÄRFERE Lesart derselben einen Frage, ausdrücklich
  // aus ihr abgeleitet (`kriterienVeraltet && …`), damit die beiden nie auseinanderlaufen können.
  //
  // WARUM ZWEI SCHÄRFEN UND NICHT EINE:
  //   · RAHMEN — eine Ausschließlichkeits-Zusage („ausschließlich Seiten mit diesem Wort im Titel").
  //     Sie darf keine Sekunde falsch sein, deshalb ist alles gesperrt, auch das blosse Anhaken, und
  //     der Gruppen-/Übernahmeschritt wird ausgebaut. Ein Rahmen wechselt selten und bewusst.
  //   · EINGRENZUNG — keine Zusage, sondern eine Frage an den Server. Falsch wäre allein, die alte
  //     ANTWORT abzuschicken; gesperrt ist deshalb genau das, was etwas ABSCHICKT (Gruppieren,
  //     Übernehmen). Anhaken bleibt, und das LIVE-Nachladen bleibt unverändert: das Fenster ist
  //     ~350 ms lang und öffnet sich bei JEDEM Chip-Klick — wer hier mehr sperrt als nötig, macht
  //     die Fläche bei normaler Bedienung unbenutzbar.
  const kriterienVeraltet =
    preview !== null && (previewKriterien !== criteriaKey || previewRahmen !== rahmen);
  const rahmenVeraltet = kriterienVeraltet && previewRahmen !== rahmen;

  const toggleRow = (index: number): void => {
    if (rahmenVeraltet) {
      return;
    }
    setCheckedRows((prev) => prev.map((on, i) => (i === index ? !on : on)));
  };

  const languageLabel = (lang: PreviewLanguage | undefined): string =>
    lang === "de"
      ? t("imp.select.langDe")
      : lang === "en"
        ? t("imp.select.langEn")
        : lang === "nl"
          ? t("imp.select.langNl")
          : t("imp.select.langOther");
  // Die drei Status-Werte der Facette — dieselben Begriffe wie bisher an den Chips.
  const statusLabel = (chip: PreviewChip): string =>
    chip === "imported"
      ? t("imp.select.chipImported")
      : chip === "queued"
        ? t("imp.select.chipQueued")
        : t("imp.select.chipNew");
  // AUFTRAG-mega27 Block B: Anzeige-Label eines Facetten-Werts. Ordner/Thema/Autor tragen bereits
  // den kanonischen Text (previewFacetValues dekodiert an EINER Stelle) — hier wird NICHT erneut
  // dekodiert; Status und Sprache bekommen ihre lokalisierten Begriffe.
  const facetValueLabel = (key: string, value: string): string => {
    if (key === "status") {
      return statusLabel(value as PreviewChip);
    }
    if (key === "language") {
      return languageLabel(value as PreviewLanguage);
    }
    return value;
  };

  // WP-SHIP9-S2 Paket 2: abgeleitete Ansicht — gefilterte/durchsuchte Zeilen (D7 + Block-B-Facetten),
  // optional gruppiert (D3/D5/A4). Die AUSWAHL bleibt in checkedRows (Originalindex); dies steuert
  // nur, was sichtbar ist und welche Zeilen „Alle wählen"/Ordner-Checkbox erfassen.
  const entries: readonly ImportPreviewEntry[] = preview?.preview ?? NO_ENTRIES;
  // Effizienz-Vertrag von lib/facets: die (teure) WERT-Ableitung je Eintrag läuft genau EINMAL je
  // Datenlauf — je Render bleiben nur Lookups und Integer-Zähler.
  const facetBase = useMemo(() => entries.map((entry) => previewFacetValues(entry)), [entries]);
  const valuesOf = (_entry: ImportPreviewEntry, index: number): FacetValues =>
    facetBase[index] ?? {};
  // AUFTRAG-mega27 A4: der Gruppier-Modus. Ohne eigene Wahl gilt die VORGABE aus dem Bestand
  // (Ordner, sobald wenigstens ein Eintrag einen Pfad trägt und daraus ≥2 Ordner entstehen).
  // WP-BILD-1f RT5c: der angeforderte Modus gilt nur, wenn er im Bestand überhaupt angeboten wird —
  // sonst ehrlicher Rückfall auf die flache Liste (kein toter Modus).
  const requestedGroupMode: PreviewGroupMode = groupModeTouched
    ? view.groupMode
    : defaultGroupMode(entries);
  const groupMode = preview
    ? effectiveGroupMode(entries, requestedGroupMode)
    : ("none" as PreviewGroupMode);
  // A4: warum die Ordneransicht gerade NICHT gilt — eine Zeile, ehrlich benannt (dieselbe
  // Ehrlichkeitsregel wie effectiveGroupMode).
  const folderFallback = preview ? folderModeUnavailableReason(entries) : null;
  const rows = preview ? visibleRows(entries, view, valuesOf) : [];
  // Block B: die Schienen-Sicht (Kontext-Zähler, Ausgrauen, Suche je Dimension, aufmachbarer
  // Deckel) — dieselbe Technik und dieselben Bausteine wie in der Bibliothek.
  const facetGroups = facetRailGroups(
    facetBase,
    IMPORT_SELECT_FACET_CONFIGS,
    view.selection,
    railUi,
    (key, value) => facetValueLabel(key, value),
  );
  // RT5a (nacht24): ECHTER Subfolder-Baum — im Sprach-Modus bekommen Sprach-Ordner Themen-
  // Unterordner (auf-/zuklappbar), sobald die Sprache ≥2 Themen hergibt; sonst wie bisher.
  const groups = groupRowsTree(rows, groupMode);
  const summary = selectionSummary(checkedRows);
  // F1: Bulk-Aktionen (Alle wählen, Gruppen-Checkbox) UND die Haken-Anzeige arbeiten auf DERSELBEN
  // bulk-wählbaren Teilmenge — bereits importierte/vorgemerkte Zeilen fasst kein Bulk-Setzer an.
  const bulkRows = bulkSelectableRows(rows);
  const allVisibleChecked = rowsAllChecked(checkedRows, bulkRows);
  // F2: „Alle wählen" wirkt nur auf bulk-wählbare sichtbare Zeilen; „Alle abwählen" leert GLOBAL
  // (auch weggefilterte, aber gewählte Treffer) — Beschriftung und Wirkung fallen nie auseinander.
  const toggleAll = (): void => {
    if (rahmenVeraltet) {
      return;
    }
    if (allVisibleChecked) {
      setCheckedRows((prev) => clearAllSelected(prev));
    } else {
      setCheckedRows((prev) => setRowsSelected(prev, bulkRows, true));
    }
  };
  // WP-BILD-1f RT5b: Gruppen-Checkbox setzt die GANZE Gruppe. ANWÄHLEN erfasst nur bulk-wählbare
  // Zeilen (F1: importierte/vorgemerkte bleiben aus); ABWÄHLEN wirkt auf ALLE Zeilen der Gruppe (auch
  // bewusst wieder-angewählte bekannte Einträge).
  const setGroupSelected = (groupRowsArg: readonly PreviewRow[], value: boolean): void => {
    if (rahmenVeraltet) {
      return;
    }
    setCheckedRows((prev) =>
      value
        ? setRowsSelected(prev, bulkSelectableRows(groupRowsArg), true)
        : setRowsSelected(prev, groupRowsArg, false),
    );
  };
  // RT5b: Klick auf den Gruppen-Haken — "on" → ganze Gruppe abwählen; sonst anwählen (bulk-wählbare).
  // Gibt es nichts anzuwählen (nur bekannte Zeilen), aber ist etwas gewählt, wirkt der Klick als Abwahl.
  const toggleGroup = (groupRowsArg: readonly PreviewRow[]): void => {
    const state = groupCheckboxState(checkedRows, groupRowsArg);
    const canSelect = bulkSelectableRows(groupRowsArg).length > 0;
    setGroupSelected(groupRowsArg, state !== "on" && canSelect);
  };
  // RT5a: eingeklappt-Standard bei vielen Ordnern; explizite Klicks (openGroups) haben Vorrang.
  // AUFTRAG-mega27 A5: die Schwelle gilt JE EBENE (Zahl der Geschwister) — Begründung an
  // groupsCollapsedByDefault. Der Schlüssel ist der volle Pfad-Schlüssel des Knotens.
  const isGroupOpen = (key: string, siblingCount: number): boolean =>
    openGroups[key] ?? !groupsCollapsedByDefault(siblingCount);
  const setGroupOpen = (key: string, value: boolean): void => {
    setOpenGroups((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  };
  // F3: die in der Vorschau gewählten, ZULÄSSIGEN Kandidaten-IDs (Originalindex → checkedRows) —
  // sie steuern serverseitig Gruppierung UND Übernahme (nicht nur die Kriterien).
  const selectedCandidateIds = preview
    ? preview.preview.flatMap((entry, index) =>
        checkedRows[index] === true && entry.id ? [entry.id] : [],
      )
    : [];
  // AUFTRAG-mega59 BLOCK F2: nimmt der GEWÄHLTE Stapel die Cloud-KI aus der Gruppierung? Abgeleitet
  // aus GENAU den gewählten Vorschau-Einträgen — nicht aus der ganzen Vorschau, denn die Auswahl ist
  // eine Teilmenge, und eine Warnung über nicht gewählte Einträge wäre falsch. Der Batch-Vertrag ist
  // „ganz oder gar nicht": EIN vertraulicher Eintrag nimmt die Cloud für den ganzen Lauf heraus,
  // deshalb `some`. Rein clientseitig auf schon geladenen Daten — kein neuer Aufruf.
  const stackConfidential = preview
    ? preview.preview.some(
        (entry, index) => checkedRows[index] === true && entry.confidentialForAi === true,
      )
    : false;

  // AUFTRAG-mega9 Block E-4 (KW-E2E-008): Der Neu-Mount über den React-Key verwirft die aufgebaute
  // Gruppierung korrekt — aber damit auch das Wissen, DASS schon gruppiert wurde. Genau deshalb stand
  // dort weiterhin „Weiter: Gruppieren & Übernehmen", als der Nutzer nach dem Gruppieren einen
  // Kandidaten abwählte. Dieses Wissen lebt hier, oberhalb des Keys, und überlebt den Remount.
  const [lastGroupedKey, setLastGroupedKey] = useState<string | null>(null);
  // RT5b (nacht24): Sprach-Zähler über den GESAMTEN gefundenen Bestand — Basis der Massenaktion.
  const langCounts = preview ? languageCounts(entries) : [];
  // WP-BILD-1f RT5c: Gruppier-Modi dynamisch — ein Modus erscheint nur, wenn der Bestand dafür ≥2
  // Gruppen hergibt. „none" (flache Liste) ist immer dabei; „nach Ordner" (mega27 A4) steht vorn.
  const groupModeName = (mode: PreviewGroupMode): string =>
    mode === "folder"
      ? t("imp.select.groupFolder")
      : mode === "theme"
        ? t("imp.select.groupTheme")
        : mode === "language"
          ? t("imp.select.groupLanguage")
          : t("imp.select.groupNone");
  const groupModes = preview ? groupModeOptions(entries) : [];

  // Eine Vorschau-Zeile (Checkbox + Titel + Kennzeichen) — geteilt zwischen flacher und Gruppen-Ansicht.
  const renderRow = ({ entry, index }: PreviewRow): JSX.Element => (
    <li key={`${entry.title}-${index}`} className="flex items-start gap-2 text-[12.5px] text-text">
      <input
        type="checkbox"
        aria-label={displayImportText(entry.title, entry.textCodec)}
        checked={checkedRows[index] ?? false}
        onChange={() => toggleRow(index)}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      {/* WP-IC-PAKET-1 (Teil 1): Altbestand-Entities nur fürs Text-Rendering dekodieren. */}
      <span className="min-w-0 flex-1 truncate">
        {displayImportText(entry.title, entry.textCodec)}
      </span>
      {entry.alreadyImported ? (
        <span className="shrink-0 rounded-pill bg-trust-pos-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-pos-text">
          {t("imp.preview.imported")}
        </span>
      ) : null}
      {/* WP-SHIP9-S1b: eigener Zustand in EIGENER Farbe — offener Kandidat ist
          „bereits zur Prüfung vorgemerkt", nicht „bereits importiert". */}
      {entry.alreadyQueued ? (
        <span className="shrink-0 rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
          {t("imp.preview.queued")}
        </span>
      ) : null}
      {entry.sourceNewer ? (
        <span className="shrink-0 rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
          {t("imp.preview.sourceNewer")}
        </span>
      ) : null}
      {entry.author ? (
        <span className="shrink-0 text-[11px] text-muted-2">
          {displayImportText(entry.author, entry.textCodec)}
        </span>
      ) : null}
      {entry.hasImage ? <Images size={12} className="mt-0.5 shrink-0 text-muted-2" /> : null}
    </li>
  );

  const yearInputCls =
    "h-9 w-24 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text";

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      {/* WP-COCKPIT-LINIE Schritt 3: Eingrenzen — Nummer + Titel + 1-Satz-Erklärung. */}
      <ImportStepHeading step="narrow" />

      {/* Freitext-Prompt */}
      <div className="mt-2">
        <TextInput
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("imp.select.promptPlaceholder")}
        />
      </div>
      {/* WP-VIP2-GATE-2 (bens Fix 1): PFLICHT-Eigeneinstufung DIREKT an der Satz-Eingabe —
          Vorgabe „Ja/unsicher" (fail-safe vertraulich); nur die bewusste Wahl „Nein" gibt den
          Satz fuer den Cloud-Weg frei (der Server prueft zusaetzlich den Snapshot als Backstop). */}
      <div
        className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-muted"
        role="radiogroup"
        aria-label={t("imp.select.promptConfidentialLabel")}
      >
        <span className="font-semibold">{t("imp.select.promptConfidentialLabel")}</span>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            name="prompt-confidential"
            checked={promptConfidential}
            onChange={() => setPromptConfidential(true)}
          />
          {t("imp.select.promptConfidentialYes")}
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            name="prompt-confidential"
            checked={!promptConfidential}
            onChange={() => setPromptConfidential(false)}
          />
          {t("imp.select.promptConfidentialNo")}
        </label>
      </div>

      {/* Zeitraum + Limit + Vorschau-Button (WP-IC-PAKET-1 Teil 3: von/bis Jahr aus den Erkundungsdaten) */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          {t("imp.select.yearFrom")}
          <input
            type="number"
            min={1990}
            max={2100}
            value={yearFrom}
            onChange={(e) => setYearFrom(e.target.value)}
            className={yearInputCls}
          />
        </label>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          {t("imp.select.yearTo")}
          <input
            type="number"
            min={1990}
            max={2100}
            value={yearTo}
            onChange={(e) => setYearTo(e.target.value)}
            className={yearInputCls}
          />
        </label>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          {t("imp.select.limit")}
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="h-9 w-20 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text"
          />
        </label>
        {/* WP-COCKPIT-LINIE: der EINE Primär-CTA nach der Erkundung („Weiter: …"-Muster). Sobald
            die Vorschau steht, tritt er zurück (outline, „Vorschau aktualisieren") — der nächste
            Primär-Knopf gehört dann Schritt 4 (Gruppieren & Übernehmen). */}
        <Button
          variant={preview ? "outline" : "primary"}
          disabled={select.isPending}
          onClick={() => select.mutate(undefined)}
        >
          {select.isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {select.isPending
            ? t("imp.select.previewing")
            : preview
              ? t("imp.select.previewAgain")
              : t("imp.select.previewCta")}
        </Button>
      </div>

      {select.isError ? (
        <p className="mt-3 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
          {errorMessage}
        </p>
      ) : null}

      {/* ROT-3: gerendert wird IMMER der latest-wins-Stand (preview), nie select.data direkt. */}
      {preview ? (
        <div
          ref={previewBoxRef}
          className="mt-3 scroll-mt-4 rounded-card border border-hairline bg-page p-3"
        >
          <div className="text-[13px] font-semibold text-text">
            {t("imp.select.matched", {
              matched: preview.preview.length,
              total: preview.matched,
            })}
            {preview.limited ? ` · ${t("imp.select.limitedNote")}` : ""}
            {/* WP-IC-PAKET-1 (Teil 4): ehrlicher Import-Status der Vorschau — WP-SHIP9-S1b:
                importiert und vorgemerkt sind ZWEI getrennte Zähler. */}
            {alreadyImportedCount > 0
              ? ` · ${t("imp.select.alreadyImported", { n: alreadyImportedCount })}`
              : ""}
            {alreadyQueuedCount > 0
              ? ` · ${t("imp.select.alreadyQueued", { n: alreadyQueuedCount })}`
              : ""}
          </div>

          {/* WP-SAMMEL20-FIX (bens Fix 2): KI-Ausfall NIE still — nüchterner Hinweis, dass nur
              die Klick-Filter gelten (die weiterhin wirken; nichts wird erfunden).
              WP-SHIP9-S2 (bens Folgeschnitt B4): den WAHREN Grund zeigen — vertraulichkeitsbedingter
              Cloud-Ausschluss ist etwas anderes als „KI nicht erreichbar". */}
          {preview.inferenceStatus === "unavailable" ? (
            <p className="mt-1.5 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text">
              {preview.fallbackReason === "confidential"
                ? t("imp.select.aiConfidential")
                : t("imp.select.aiUnavailable")}
            </p>
          ) : null}

          {/* JOB 3640 R4: der Rahmen hat gewechselt — die Liste darunter gehört zur Abfrage davor.
              Sie bleibt lesbar, aber sie ist ab hier keine Grundlage zum Handeln mehr (Begründung
              an `rahmenVeraltet`). Der Satz sagt, WAS jetzt gilt, WOHER die Liste stammt und WAS
              gesperrt ist — und im Fehlerfall, wie es weitergeht. */}
          {rahmenVeraltet ? (
            <p
              data-testid="rahmen-gewechselt"
              className="mt-1.5 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text"
            >
              {select.isError
                ? rahmen !== null
                  ? t("imp.rahmen.wechselFehler", { firma: rahmen })
                  : t("imp.rahmen.wechselFehlerOhne")
                : rahmen !== null
                  ? t("imp.rahmen.wechselLaeuft", { firma: rahmen })
                  : t("imp.rahmen.wechselLaeuftOhne")}
            </p>
          ) : kriterienVeraltet ? (
            /* JOB 3772: die schwächere Schärfe derselben Regel — die Eingrenzung hat gewechselt.
               Der Satz steht DIREKT unter der Trefferzahl und nennt sie ausdrücklich mit: sie ist
               eine Aussage über die Eingrenzung von vorhin, nicht über die, die jetzt gilt. Er sagt
               auch, was WEITER geht (anhaken) — eine Sperre, die mehr behauptet als sie tut, ist
               ihrerseits eine falsche Auskunft. */
            <p
              data-testid="eingrenzung-gewechselt"
              className="mt-1.5 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text"
            >
              {select.isError
                ? t("imp.eingrenzung.wechselFehler")
                : t("imp.eingrenzung.wechselLaeuft")}
            </p>
          ) : null}

          {/* Effektiv benutzte Kriterien — Transparenz. Leer → „alles". */}
          {criteriaLines.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-muted-2">
              {criteriaLines.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[11.5px] text-muted-2">{t("imp.select.critAll")}</p>
          )}

          {/* JOB 3356 (IMPORT-FREITEXT-TITEL): 0 Treffer nach einem Satz ist kein stilles Nichts.
              Hier stehen drei Aussagen, jede an ihrer eigenen Voraussetzung:
              (a) WIE die KI den Satz gedeutet hat — nur wenn sie überhaupt gedeutet hat
                  (inferenceStatus "ok"); bei Ausfall behauptet die Fläche das NICHT, dort gilt der
                  Hinweis-Kasten oben (nur Klick-Filter). Die Deutung selbst steht in den
                  Kriterien-Zeilen darüber; hier wird kein zweiter Weg dafür gebaut.
              (b) die deterministische Titelzahl zum eigenen Wortlaut — auch die 0 wird gesagt.
              (c) der Knopf auf GENAU die Kriterien des Servers (titleFallback.criteria), nie auf die
                  KI-Kriterien. Er greift nur auf Druck: ohne ihn bleibt die Vorschau die, die der
                  Mensch angefordert hat.
              Runde 2: läuft eine Folgeanfrage oder ist sie gescheitert (bzw. steht im Feld inzwischen
              ein anderer Satz), steht ZUERST die Zuordnung „Ergebnis für: <alter Satz>" samt Grund —
              und der Knopf verschwindet. Nichts wird geleert, aber nichts Altes gibt sich als neu. */}
          {titleFallback ? (
            <div className="mt-1.5 rounded-btn border border-hairline bg-surface px-3 py-2 text-[12px] text-text">
              {titleFallbackGrund !== null ? (
                <p className="font-semibold text-muted">
                  {t("imp.select.titleFallbackStale", { query: previewPrompt })}{" "}
                  {titleFallbackGrund === "pending"
                    ? t("imp.select.titleFallbackStalePending")
                    : titleFallbackGrund === "error"
                      ? t("imp.select.titleFallbackStaleError")
                      : t("imp.select.titleFallbackStaleChanged")}
                </p>
              ) : null}
              {preview.inferenceStatus === "ok" ? (
                <p className="mt-1">{t("imp.select.titleFallbackInterpreted")}</p>
              ) : null}
              <p className="mt-1">
                {titleFallback.matched > 0
                  ? t("imp.select.titleFallbackFound", {
                      count: titleFallback.matched,
                      query: titleFallback.query,
                    })
                  : t("imp.select.titleFallbackNone", { query: titleFallback.query })}
              </p>
              {/* JOB 3640: Die Zahl des Titelbefunds entsteht serverseitig OHNE den Rahmen
                  (`filterImportItems(items, {titleContains: [query]})`). Solange ein Rahmen gilt,
                  steht sie deshalb ausdrücklich als Zahl über den Gesamtbestand da — und der
                  Umschaltknopf entfällt, weil er genau aus dem Rahmen herausführen würde
                  (Begründung im Kopf dieser Datei). */}
              {rahmen !== null ? (
                <p data-testid="titelbefund-ungerahmt" className="mt-1 text-[11.5px] text-muted-2">
                  {t("imp.rahmen.titelbefundUngerahmt")}
                </p>
              ) : null}
              {titleFallback.matched > 0 && titleFallbackGrund === null && rahmen === null ? (
                <div className="mt-2">
                  <Button variant="outline" onClick={() => select.mutate(titleFallback.criteria)}>
                    {t("imp.select.titleFallbackCta", { count: titleFallback.matched })}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Vorschau-Liste mit Auswahl (Teil 4): bereits Importiertes markiert + standardmäßig abgewählt.
              AUFTRAG-mega27 Block B: darüber KEINE eigene Filterzeile mehr, sondern DIESELBE
              Filterschiene wie die Bibliothek (Facetten mit kombinierbaren Zählern, „Weitere Filter"
              eingeklappt, Bereichsfilter) links und über der Liste die aktive-Filter-Leiste.
              Massenaktionen („Alle wählen/abwählen", „alle <Sprache> abwählen") stehen bewusst
              NICHT in der Schiene — sie ändern die AUSWAHL, Filter ändern nur die SICHT (B4). */}
          {entries.length > 0 ? (
            <div className="mt-2 grid gap-3 border-t border-hairline pt-2 lg:grid-cols-[236px_minmax(0,1fr)]">
              <FacetFilter
                configs={IMPORT_SELECT_FACET_CONFIGS}
                groups={facetGroups}
                selection={view.selection}
                total={entries.length}
                shown={rows.length}
                onToggle={(key, value) =>
                  setView((v) => ({ ...v, selection: toggleFacetValue(v.selection, key, value) }))
                }
                onReset={() =>
                  setView((v) => ({
                    ...v,
                    selection: clearFacetSelection(),
                    range: EMPTY_FACET_RANGE,
                  }))
                }
                labelForValue={facetValueLabel}
                onQueryChange={(key, query) =>
                  setRailUi((ui) => ({ ...ui, query: { ...ui.query, [key]: query } }))
                }
                onShowAllToggle={(key) =>
                  setRailUi((ui) => ({
                    ...ui,
                    showAll: { ...ui.showAll, [key]: ui.showAll[key] !== true },
                  }))
                }
                secondaryKeys={IMPORT_SELECT_SECONDARY_FACET_KEYS}
                moreStorageKey={IMPORT_MORE_FILTERS_STORAGE_KEY}
                range={view.range}
                onRangeChange={(range: FacetRange) => setView((v) => ({ ...v, range }))}
                rangeLabelKey="imp.select.rangeLabel"
                rangeAfterKey={IMPORT_SELECT_RANGE_AFTER_KEY}
                countLabelKey="imp.select.facetCount"
                searchSlot={
                  /* D7: Suchfeld ganz oben in der Schiene — der Träger besitzt die Query. */
                  <TextInput
                    value={view.query}
                    onChange={(e) => setView((v) => ({ ...v, query: e.target.value }))}
                    placeholder={t("imp.select.searchPlaceholder")}
                    aria-label={t("imp.select.searchPlaceholder")}
                  />
                }
              />

              {/* JOB 3640 R4: die SPERRE der entwerteten Liste — ein `fieldset disabled`, also die
                  Browser-eigene Regel, die JEDES Bedienelement darin erfasst: die Haken der Zeilen,
                  die Massenaktionen UND die Gruppen-Haken im Baum (`ImportPreviewTree`, eigene
                  Datei). Kein nachgebautes Deaktivieren an einem Dutzend Stellen, das eine davon
                  vergessen könnte. Die Handler oben sind zusätzlich verriegelt (`rahmenVeraltet`) —
                  die Sperre soll nicht davon abhängen, dass ein Klick nur über die Fläche kommt.
                  Die Filterschiene links bleibt bedienbar: sie ändert die SICHT, nicht die Auswahl. */}
              <fieldset disabled={rahmenVeraltet} className="m-0 min-w-0 border-0 p-0">
                {/* B3: die aktive-Filter-Leiste über der TREFFERLISTE — jede aktive Wahl als
                    entfernbare Pille, mit demselben Zurücksetzen wie in der Bibliothek. */}
                <FacetActiveBar
                  configs={IMPORT_SELECT_FACET_CONFIGS}
                  selection={view.selection}
                  onToggle={(key, value) =>
                    setView((v) => ({ ...v, selection: toggleFacetValue(v.selection, key, value) }))
                  }
                  onReset={() =>
                    setView((v) => ({
                      ...v,
                      selection: clearFacetSelection(),
                      range: EMPTY_FACET_RANGE,
                    }))
                  }
                  onClearGroup={(key) =>
                    setView((v) => ({ ...v, selection: { ...v.selection, [key]: undefined } }))
                  }
                  labelForValue={facetValueLabel}
                  range={view.range}
                  onRangeChange={(range: FacetRange) => setView((v) => ({ ...v, range }))}
                  rangeLabelKey="imp.select.rangeLabel"
                />

                {/* B4: MASSENAKTIONEN — sie ändern die Auswahl, nicht die Sicht, und haben deshalb
                    ihre eigene Zeile. D2 „Alle wählen/abwählen" · RT5b „alle <Sprache> abwählen". */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted">
                  <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2">
                    {t("imp.select.bulkLabel")}
                  </span>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="rounded-btn border border-hairline bg-surface px-2.5 py-1 font-semibold text-text hover:bg-hairline-soft"
                  >
                    {allVisibleChecked ? t("imp.select.deselectAll") : t("imp.select.selectAll")}
                  </button>
                  <LanguageDeselectChips
                    counts={langCounts}
                    label={languageLabel}
                    buttonText={(lang, n) => t("imp.select.deselectLang", { lang, n })}
                    onDeselect={(lang) => {
                      // R4: dieselbe Verriegelung wie an den übrigen Auswahl-Wegen.
                      if (rahmenVeraltet) {
                        return;
                      }
                      setCheckedRows((prev) => deselectLanguage(prev, entries, lang));
                    }}
                  />
                </div>

                {/* D5/D3/A4: Gruppierung — reine Sicht-Umschaltung, keine Auswahl-Änderung. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                  <span>{t("imp.select.groupBy")}</span>
                  {groupModes.map((m) => (
                    <button
                      key={m.mode}
                      type="button"
                      aria-pressed={groupMode === m.mode}
                      onClick={() => {
                        setGroupModeTouched(true);
                        setView((v) => ({ ...v, groupMode: m.mode }));
                      }}
                      className={`rounded-btn border px-2 py-0.5 font-semibold ${
                        groupMode === m.mode
                          ? "border-ai/50 bg-ai-surface-1 text-ai"
                          : "border-hairline bg-surface text-muted hover:text-text"
                      }`}
                    >
                      {groupModeName(m.mode)}
                      {m.mode === "none" ? "" : ` · ${m.count}`}
                    </button>
                  ))}
                </div>

                {/* A4: EHRLICHE EINE ZEILE, warum es keine Ordneransicht gibt — dieselbe Regel wie
                    beim Rückfall von effectiveGroupMode. Nur zeigen, solange der Nutzer nicht
                    bewusst eine andere Gruppierung gewählt hat. */}
                {folderFallback !== null && !groupModeTouched ? (
                  <p className="mt-1.5 text-[11.5px] text-muted-2">
                    {folderFallback === "no-path"
                      ? t("imp.select.folderFallbackNoPath")
                      : t("imp.select.folderFallbackSingle")}
                  </p>
                ) : null}

                {/* D7: dauerhaft sichtbare Auswahl-Zusammenfassung „X von Y gewählt". */}
                <p className="mt-2 text-[11.5px] text-muted-2">
                  {t("imp.select.summary", { selected: summary.selected, total: summary.total })}
                  {alreadyImportedCount > 0 ? ` — ${t("imp.select.importedDeselected")}` : ""}
                  {alreadyQueuedCount > 0 ? ` — ${t("imp.select.queuedDeselected")}` : ""}
                </p>

                {rows.length === 0 ? (
                  // D7/B2: nach Suche/Facetten/Bereich keine Zeile mehr sichtbar — ehrlich benannt.
                  <p className="mt-2 text-[12px] text-muted-2">{t("imp.select.emptyFiltered")}</p>
                ) : groupMode === "none" ? (
                  <ul className="mt-1.5 space-y-1 border-t border-hairline pt-2">
                    {rows.map(renderRow)}
                  </ul>
                ) : (
                  // A5: auf-/zuklappbare Ordner mit Tri-State-Haken — im Ordner-Modus der ECHTE
                  // Quell-Baum in beliebiger Tiefe, im Sprach-Modus wie bisher zweistufig.
                  // Darstellung geteilt in ImportPreviewTree; Logik pure in importSelectView.
                  <ImportPreviewTree
                    groups={groups}
                    isOpen={isGroupOpen}
                    setOpen={setGroupOpen}
                    checkStateOf={(groupRowsArg) => groupCheckboxState(checkedRows, groupRowsArg)}
                    onToggleGroup={toggleGroup}
                    labelOf={(group) =>
                      group.kind === "language"
                        ? languageLabel(group.language)
                        : group.value === ""
                          ? // Ein leerer Wert heißt: die Quelle nennt hier nichts. Ehrlich benannt,
                            // nicht als erfundener Ordner „Sonstiges".
                            group.kind === "folder"
                            ? t("imp.select.noFolder")
                            : t("imp.select.noTheme")
                          : // A2/A4: kanonische Werte werden NICHT erneut dekodiert (textCodec).
                            displayImportText(group.value, group.textCodec)
                    }
                    countLabel={(n) => t("imp.select.groupCount", { n })}
                    renderRow={renderRow}
                  />
                )}
              </fieldset>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted-2">{t("imp.select.empty")}</p>
          )}

          {/* WP-IC-4 (Schritt 4+5): Gruppieren → Gruppen-Freigabe → Übernahme mit ehrlicher Bilanz.
              Key = Kriterien der AKTUELLEN Vorschau: eine geänderte Eingrenzung setzt den
              Gruppierungs-Schritt sauber zurück (keine veralteten Gruppen zur neuen Auswahl).
              WP-SHIP9-S2d (F3, bens GELB): die stabil sortierte Vorschau-Auswahl gehört ZUSÄTZLICH
              in den Key — ändert sich selectedCandidateIds NACH dem Gruppieren, verwirft der
              Neu-Mount den kompletten aufgebauten Zustand (Gruppen/Zweit-Auswahl/Bilanz), sodass
              die sichtbaren Gruppen NIE von der aktuellen Auswahl abweichen (und ein in-flight
              /group der alten Auswahl auf der abgemeldeten Instanz ins Leere läuft). */}
          {/* JOB 3640 R4: GEHÖRT DIE ANGEZEIGTE ANTWORT NICHT ZUM GÜLTIGEN RAHMEN, GIBT ES HIER
              NICHTS ZU GRUPPIEREN UND NICHTS ZU ÜBERNEHMEN. Das ist die Stelle, an der bens
              Gegenprobe durchkam: `ImportGroups` bekam weiter `preview.criteria` der alten Abfrage
              und schickte sie ab. Statt des Schritts steht hier eine Zeile, die sagt, warum er
              fehlt — und er kommt von selbst wieder, sobald die Vorschau im aktuellen Rahmen
              steht. Ausgebaut statt nur ausgegraut: der aufgebaute Gruppen-Zustand gehörte zur
              alten Auswahl, ein laufendes /group daran läuft auf der abgemeldeten Instanz ins
              Leere (dieselbe Begründung wie beim Key darunter). */}
          {rahmenVeraltet ? (
            <p
              data-testid="rahmen-gruppen-gesperrt"
              className="mt-3 border-t border-hairline pt-3 text-[12px] text-muted"
            >
              {t("imp.rahmen.wechselGruppenGesperrt")}
            </p>
          ) : kriterienVeraltet ? (
            /* JOB 3772: hier wird AUSGEGRAUT, nicht ausgebaut — anders als beim Rahmen eine Zeile
               darüber, und aus einem gemessenen Grund: das Fenster ist ~350 ms lang und öffnet sich
               bei JEDEM Chip-Klick, bei jeder getippten Jahresziffer und bei jedem Tastendruck im
               Deckel-Feld. Ein Ausbau liesse den ganzen Schritt dabei flackern. Verloren geht
               dadurch nichts: trifft die neue Antwort ein, wirft der React-Key darunter
               (`JSON.stringify(preview.criteria)` + gewählte IDs) den aufgebauten Gruppen-Zustand
               ohnehin weg — gemessen in `rahmenwechsel-entwertet-die-alte-auswahl.test.tsx`. */
            <p
              data-testid="eingrenzung-gruppen-gesperrt"
              className="mt-3 border-t border-hairline pt-3 text-[12px] text-muted"
            >
              {t("imp.eingrenzung.gruppenGesperrt")}
            </p>
          ) : null}

          {preview.preview.length > 0 && !rahmenVeraltet
            ? (() => {
                // Derselbe Wert wie der React-Key — EINE Quelle, damit „was wurde gruppiert" und
                // „was setzt den Schritt zurück" nicht auseinanderlaufen können.
                const groupKey = `${JSON.stringify(preview.criteria)}|${JSON.stringify(
                  [...selectedCandidateIds].sort(),
                )}`;
                return (
                  // JOB 3772 · DER ABSENDEWEG IST VERRIEGELT, NICHT NUR AUSGEGRAUT.
                  //
                  // `disabled` am `fieldset` ist die browsereigene Regel und erfasst JEDES
                  // Bedienelement darin — dieselbe Doktrin wie an der Trefferliste oben, kein
                  // nachgebautes Deaktivieren an einem Dutzend Knöpfen, das einen vergessen könnte.
                  //
                  // Der `onClickCapture` daneben ist der RIEGEL: `ImportGroups` gruppiert und
                  // übernimmt in eigener Sache (`endpoints.admin.import.group/apply`) und liegt
                  // ausserhalb der Zielpfade dieses Auftrags — ein Handler-Verschluss wie an
                  // `toggleRow` ist dort nicht zu setzen. Er wird deshalb hier gesetzt, eine Ebene
                  // höher: der Klick wird in der EINFANGENDEN Phase abgefangen und erreicht die
                  // Knöpfe darin gar nicht. Die Sperre hängt damit nicht daran, dass ein Browser
                  // `fieldset disabled` an einer Schaltfläche wirklich durchsetzt.
                  <fieldset
                    disabled={kriterienVeraltet}
                    onClickCapture={(ereignis) => {
                      if (kriterienVeraltet) {
                        ereignis.preventDefault();
                        ereignis.stopPropagation();
                      }
                    }}
                    className="m-0 min-w-0 border-0 p-0"
                  >
                    <ImportGroups
                      key={groupKey}
                      criteria={preview.criteria}
                      selectedCandidateIds={selectedCandidateIds}
                      aiAvailable={groupAi.available}
                      aiBillable={groupBillable}
                      // AUFTRAG-mega59 BLOCK F2: die Vertraulichkeit des gewählten Stapels — ohne sie
                      // schwieg die Vorwarnung bei aktivem Reasoner und log damit über das, was danach
                      // als „Ohne KI gruppiert" erschien.
                      stackConfidential={stackConfidential}
                      // AUFTRAG-mega9 Block E-4 (KW-E2E-008): schon gruppiert, aber zu einer ANDEREN
                      // Auswahl ⇒ der Knopf heißt „Gruppierung aktualisieren".
                      groupingStale={lastGroupedKey !== null && lastGroupedKey !== groupKey}
                      onGrouped={() => setLastGroupedKey(groupKey)}
                      // AUFTRAG-mega9 Block E-5 (KW-E2E-009): Review-Queue und Bilanz GEMEINSAM
                      // auffrischen — sonst zeigt der Verlauf neben dem frischen „1 offen" noch die
                      // Zahlen von vor der Übernahme.
                      onApplied={() => {
                        void qc.invalidateQueries({ queryKey: ["import-candidates"] });
                        // Übernommene Kandidaten werden zu Wissensobjekten — dieselben Begleiter, die
                        // auch die Review-Entscheidung in Stufe2 auffrischt.
                        void qc.invalidateQueries({ queryKey: ["kos"] });
                        void qc.invalidateQueries({ queryKey: ["library"] });
                        void qc.invalidateQueries({ queryKey: ["validation"] });
                        // JOB 3288 (BEN, Runde 3+4): DER KOPF DERSELBEN SEITE. Seit Lieferung 3
                        // hinterlässt jede Übernahme einen `ImportRun`
                        // (`confluence-import-routes.ts:1143`), und der Zugangskasten oben liest
                        // daraus die Zeile „Zuletzt erfolgreich abgeschlossener Import"
                        // (`import-access-service.ts:90` → `findLastSuccessAt`). Diese Zeile ist die
                        // EINZIGE Stelle, an der der Selektivimport überhaupt sichtbar wird — und
                        // ohne diese Zeile blieb sie im offenen Fenster auf „ist bisher nicht
                        // festgehalten" stehen, während der Server den Abschluss längst kannte. Pedi
                        // hatte genau das vor sich (Codex-Livebefund df052186, 36 Seiten importiert).
                        // Sie gehört hierher und nicht an den Kopf: WER etwas bewirkt hat, frischt
                        // auf — dieselbe Regel wie bei den vier Zeilen darüber.
                        void qc.invalidateQueries({ queryKey: ["import-access", "confluence"] });
                      }}
                    />
                  </fieldset>
                );
              })()
            : null}
        </div>
      ) : null}
    </div>
  );
}
