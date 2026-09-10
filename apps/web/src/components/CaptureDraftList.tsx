// AUFTRAG-sortfilter · Punkt 2: „Entwürfe fortsetzen" als eigene, testbare Komponente (aus Capture.tsx
// herausgelöst — identisches Verhalten, nur gekapselt). Sie trägt die Filter-/Sortier-Sicht der
// Entwurfsliste: Volltext-/Titelsuche, in der Admin-Ansicht zusätzlich ein Ersteller-Filter, und die
// Sortierung (zuletzt gespeichert neu→alt als Default, alt→neu, Titel A→Z). Der Zustand wird PRO
// BROWSER gemerkt (localStorage über die fehlertolerante safeLocalStorage-Grenze). Leerer Filter = alle.
//
// ================================================================================================
// JOB 3426 (ENTWUERFE-VERWALTEN) — DIESELBE LISTE, ZWEI FLÄCHEN.
// ================================================================================================
//
// Der Editor (`erfassen/Blatt.tsx`) bildete seine Entwürfe bis hierher ROH ab: Titel, Datum, ein
// Öffnen-Knopf. Kein Suchfeld, keine Sortierung, kein Löschweg — obwohl die ganze Bedienung hier
// seit AUFTRAG-sortfilter fertig lag und nur am alten Arbeitsraum hing. Der Auftrag baut deshalb
// NICHTS NEUES; er schließt das Vorhandene an.
//
// WARUM EINE `variant` UND KEINE ZWEITE KOMPONENTE: Filter, Sortierung, Merkschlüssel und der
// Bestätigungsweg des Löschens sind in beiden Flächen DIESELBE Sache — eine zweite Liste wäre die
// zweite Auffassung davon, was „suchen", „sortieren" und „löschen" heisst, und genau daran liefen
// die Flächen auseinander. Was sich wirklich unterscheidet, ist die Darreichung:
//
//   „arbeitsraum" (Capture.tsx): eine Karte mit Überschrift, Reichweiten-Plakette und
//                                Auf-/Zuklappen; jede Zeile nennt Ersteller, Stand und Status und
//                                trägt einen eigenen „Fortsetzen"-Knopf.
//   „blatt"       (Blatt.tsx):   eine 320-px-Menüfläche, die das Menü selbst schon aufgeklappt
//                                hat; die ZEILE SELBST ist der Öffnen-Knopf (so war sie dort immer,
//                                und die Anker `blatt-entwurf-eintrag*` messen genau das), daneben
//                                der Löschweg. Kein Karten-Rahmen, keine zweite Überschrift.
//
// DIE SUCH- UND SORTIER-BEDIENUNG STEHT HIER NUR EINMAL (`steuerung` unten) und wird von beiden
// Flächen gezeigt — samt der gemeinsamen Merkschlüssel: wer im Arbeitsraum nach „Ventil" sucht,
// findet im Editor denselben Filter vor, sichtbar im Feld, nicht heimlich.
import { ChevronDown, RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Draft } from "../api/types";
import { draftTitle } from "../lib/draftForm";
import {
  DEFAULT_DRAFT_SORT,
  DRAFT_AUTHOR_STORAGE_KEY,
  DRAFT_QUERY_STORAGE_KEY,
  DRAFT_SORT_KEYS,
  DRAFT_SORT_LABEL_KEYS,
  DRAFT_SORT_STORAGE_KEY,
  draftCreatorIds,
  draftListView,
} from "../lib/draftListView";
import { formatKoTimestamp } from "../lib/koDates";
import { usePersistentEnum, usePersistentString } from "../lib/usePersistentValue";
import { Button, Card, SectionLabel } from "./ui";

// Ehrlicher, lokalisierbarer Zeitstempel (dieselbe Darstellung wie zuvor inline in Capture).
function formatDraftTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "unbekannt";
  }
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

// Ersteller-Name über das Directory (Fallback = Id, nie ein erfundener Name).
function draftAuthorName(draft: Draft, directory: readonly { id: string; name: string }[]): string {
  return directory.find((entry) => entry.id === draft.originalAuthor)?.name ?? draft.originalAuthor;
}

// ================================================================================================
// JOB 3426 §4b.4 — ZWEI WEGE, ZWEI WÖRTER.
// ================================================================================================
//
// Dieser Knopf trug bis hierher `capture.discardDraft` — DE „Verwerfen", EN „Discard". Er tut aber
// nichts, was man verwerfen könnte: er stößt `DELETE /api/drafts/<id>` an, die Rückfrage daneben
// heisst „Entwurf endgültig löschen?" und die Quittung „Entwurf gelöscht." Im Editor steht seit
// diesem Auftrag beides in DEMSELBEN Menü — der Löschknopf der Zeile und der Eintrag „Eingabe
// verwerfen" (`fd.discardInput`), der nur die ungespeicherte Eingabe des Blattes zurücksetzt und
// den Bestand nicht anfasst. Dasselbe Wort für „unwiderruflich weg" und „zurück auf gespeichert"
// ist genau die Vermischung, die §4b.4 verbietet.
//
// Er trägt deshalb das Wort der Bestätigung, die er auslöst (`capture.discardDraftYes`, DE
// „Löschen" / EN „Delete") — kein neuer Schlüssel, sondern der, der die Handlung schon benennt.
// Und er trägt ihn als `aria-label`, nicht nur als `title`: ein Knopf, dessen einziger Inhalt ein
// Symbol ist, ist ohne ihn für einen Screenreader namenlos.
function LoeschKnopf({
  id,
  onConfirmDiscard,
}: {
  id: string;
  onConfirmDiscard: (id: string | null) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="entwurfsliste-loeschen"
      // BEWUSST NICHT `data-entwurf`: dieses Attribut trägt im Editor die ZEILE selbst, und
      // `tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts` greift mit
      // `s.click('[data-entwurf="…"]')` danach. Playwright ist streng — zwei Treffer wären ein
      // Abbruch, und ein zweiter Knoten mit demselben Namen sagte ohnehin nicht dasselbe.
      data-loeschen={id}
      aria-label={t("capture.discardDraftYes")}
      title={t("capture.discardDraftYes")}
      onClick={() => onConfirmDiscard(id)}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
    >
      <Trash2 size={14} />
    </button>
  );
}

// Die beiden Knöpfe der Rückfrage — in beiden Flächen dieselben, damit „Behalten" nirgends fehlt.
// AUFTRAG-mega45 Block E: der zerstörende Knopf trug die neutrale Vorgabe „outline". Warnfarbe wie
// überall sonst; gehalten vom Sammler in `tests/app/mega45-loeschbestaetigung-sammler.test.ts`.
function LoeschRueckfrage({
  id,
  discardPending,
  onConfirmDiscard,
  onDiscard,
}: {
  id: string;
  discardPending: boolean;
  onConfirmDiscard: (id: string | null) => void;
  onDiscard: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <Button
        variant="ghost"
        data-testid="entwurfsliste-loeschen-nein"
        onClick={() => onConfirmDiscard(null)}
      >
        {t("capture.discardDraftKeep")}
      </Button>
      <Button
        variant="danger"
        data-testid="entwurfsliste-loeschen-ja"
        disabled={discardPending}
        onClick={() => onDiscard(id)}
      >
        {t("capture.discardDraftYes")}
      </Button>
    </>
  );
}

/** Was beiden Flächen gemeinsam ist — Bestand, Hervorhebung und die beiden Handlungen. */
interface CaptureDraftListBasis {
  drafts: readonly Draft[];
  // Gerade über die Vordertür gespeicherter Entwurf (Hervorhebung) bzw. gerade in Bearbeitung.
  highlightId: string | null;
  editingId: string | null;
  confirmDiscardId: string | null;
  onConfirmDiscard: (id: string | null) => void;
  discardPending: boolean;
  onDiscard: (id: string) => void;
  onResume: (draft: Draft) => void;
}

export interface CaptureDraftListArbeitsraumProps extends CaptureDraftListBasis {
  // Weglassen heisst „arbeitsraum" — der ältere der beiden Verwender bleibt dadurch unverändert.
  // Das ausgeschriebene `| undefined` ist Pflicht (`exactOptionalPropertyTypes`, tsconfig.json:12).
  variant?: "arbeitsraum" | undefined;
  isAdmin: boolean;
  directory: readonly { id: string; name: string }[];
  open: boolean;
  onToggleOpen: () => void;
  // „Meine Entwürfe" bzw. „Admin-Ansicht: alle Entwürfe" (in Capture gebildet).
  scopeLabel: string;
}

// ================================================================================================
// JOB 3503 (ENTWUERFE-MENUEPUNKT) — DIE DRITTE FLÄCHE: DIE EIGENE SEITE.
// ================================================================================================
//
// „Meine Entwürfe" hat seit JOB 3503 einen eigenen Punkt im Kopfband und eine eigene Seite
// (`pages/MeineEntwuerfe.tsx`). Sie zeigt DIESELBE Liste — dieselbe Suche, dieselbe Sortierung,
// denselben Löschweg, dieselben Merkschlüssel. Eine dritte Komponente wäre die dritte Auffassung
// davon, was „suchen", „sortieren" und „löschen" heisst; genau das verbietet der Auftrag (§3).
//
// WAS DIE SEITE ANDERS DARREICHT als der Arbeitsraum: Sie braucht KEINEN Karten-Rahmen, KEINE
// Überschrift „Entwürfe fortsetzen" und KEIN Auf-/Zuklappen. Die Hülle nennt die Seite bereits (der
// Kopfband-Punkt steht auf dieser Route mit `aria-current="page"`), und eine Seite, die man erst
// aufklappen muss, wäre genau der Aufklapper, den dieser Auftrag ablösen soll. Die ZEILEN sind
// dieselben wie im Arbeitsraum (Titel, Ersteller, Stand, Status, „Fortsetzen", Löschweg) — sie
// stehen deshalb unten EINMAL (`inhalt`) und werden von beiden Zweigen gezeigt.
//
// Lade-, Leer- und Fehlerlage bleiben wie im Blatt-Zweig beim AUFRUFER: sie sind Auskünfte über den
// Abruf, und diese Komponente sieht einen gescheiterten Abruf gar nicht.
export interface CaptureDraftListSeiteProps extends CaptureDraftListBasis {
  variant: "seite";
  isAdmin: boolean;
  directory: readonly { id: string; name: string }[];
  // „Meine Entwürfe" bzw. „Admin-Ansicht: alle Entwürfe" — dieselbe ADMIN-Auskunft wie im
  // Arbeitsraum (mega38 J4), von der Seite gebildet.
  scopeLabel: string;
}

export interface CaptureDraftListBlattProps extends CaptureDraftListBasis {
  variant: "blatt";
  /**
   * Der Titel, unter dem ein Entwurf OHNE eigenen Titel steht. Das Blatt führt seinen eigenen
   * (`cfd.fallbackTitle`, „Unbenanntes Wissensobjekt") und reicht ihn herein, statt hier einen
   * zweiten zu erfinden — er entscheidet auch, wonach die Suche und „Titel A→Z" greifen.
   */
  titleFallback: string;
  /**
   * JOB 3256 (Zustandsmodell §9 „laden"): Solange das Blatt einen Entwurf lädt, nimmt es keinen
   * zweiten an. Die Zeilen sind dann gesperrt und sagen im Titel, warum — statt es wortlos zu tun.
   */
  entriesDisabled: boolean;
  entriesDisabledTitle: string;
}

export type CaptureDraftListProps =
  | CaptureDraftListArbeitsraumProps
  | CaptureDraftListBlattProps
  | CaptureDraftListSeiteProps;

export function CaptureDraftList(props: CaptureDraftListProps): JSX.Element | null {
  const { i18n, t } = useTranslation();
  // Filter-/Sortier-Zustand pro Browser gemerkt; ein Fremd-/Altwert der Sortierung fällt sicher zurück.
  const [query, setQuery] = usePersistentString(DRAFT_QUERY_STORAGE_KEY, "");
  const [sort, setSort] = usePersistentEnum(
    DRAFT_SORT_STORAGE_KEY,
    DRAFT_SORT_KEYS,
    DEFAULT_DRAFT_SORT,
  );
  const [authorFilter, setAuthorFilter] = usePersistentString(DRAFT_AUTHOR_STORAGE_KEY, "");

  const {
    drafts,
    highlightId,
    editingId,
    confirmDiscardId,
    onConfirmDiscard,
    discardPending,
    onDiscard,
    onResume,
  } = props;

  const totalCount = drafts.length;
  if (totalCount === 0) {
    return null;
  }

  // Der Ersteller-Filter greift nur in der Admin-Ansicht („ALLE ENTWÜRFE"); sonst zeigt der Nutzer
  // ohnehin nur die eigenen Entwürfe. Die Menüfläche des Blattes führt ihn nicht: sie ist 320 px
  // breit und kennt kein Verzeichnis — ein Filter ohne auflösbare Namen zeigte nur Kennungen.
  const isAdmin = props.variant === "blatt" ? false : props.isAdmin;
  const directory = props.variant === "blatt" ? [] : props.directory;
  const fallbackTitle =
    props.variant === "blatt" ? props.titleFallback : t("capture.draftFallbackTitle");
  const visibleDrafts = draftListView(
    drafts,
    { filter: { query, author: isAdmin ? authorFilter : "" }, sort },
    fallbackTitle,
  );
  const creatorIds = isAdmin ? draftCreatorIds(drafts) : [];

  // ==============================================================================================
  // DIE SUCH- UND SORTIER-BEDIENUNG — EINMAL GESCHRIEBEN, VON BEIDEN FLÄCHEN GEZEIGT.
  // ==============================================================================================
  // Die Anker tragen den neutralen Namen `entwurfsliste-…`: dieselbe Bedienung, gleich gemessen,
  // egal auf welcher Fläche sie steht.
  const steuerung = (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        data-testid="entwurfsliste-suche"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("capture.draftSearch")}
        aria-label={t("capture.draftSearch")}
        className="h-8 min-w-[10rem] flex-1 rounded-input border border-hairline bg-surface px-2.5 text-[12.5px] text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
      />
      {isAdmin ? (
        <select
          data-testid="entwurfsliste-ersteller"
          value={authorFilter}
          onChange={(e) => setAuthorFilter(e.target.value)}
          aria-label={t("capture.draftAuthorLabel")}
          className="h-8 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none focus:border-ink/30"
        >
          <option value="">{t("capture.draftAuthorAll")}</option>
          {creatorIds.map((id) => (
            <option key={id} value={id}>
              {directory.find((entry) => entry.id === id)?.name ?? id}
            </option>
          ))}
        </select>
      ) : null}
      <label className="inline-flex items-center gap-1.5">
        <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
          {t("capture.draftSortLabel")}
        </span>
        <select
          data-testid="entwurfsliste-sortierung"
          value={sort}
          onChange={(e) => setSort(e.target.value as (typeof DRAFT_SORT_KEYS)[number])}
          aria-label={t("capture.draftSortLabel")}
          className="h-8 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text outline-none focus:border-ink/30"
        >
          {DRAFT_SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(DRAFT_SORT_LABEL_KEYS[key])}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  // ==============================================================================================
  // JOB 3426 — DIE FLÄCHE DES EDITORS.
  // ==============================================================================================
  // Sie steht in einer Menüfläche, die das Menü schon aufgeklappt hat: kein Karten-Rahmen, keine
  // zweite Überschrift, kein zweites Auf-/Zuklappen. Lade-, Leer- und Fehlerlage bleiben beim
  // Editor (JOB 3266, D1) — sie sind Auskünfte über den ABRUF, nicht über diese Liste, und diese
  // Komponente sieht einen gescheiterten Abruf gar nicht (sie bekommt dann keine Entwürfe).
  if (props.variant === "blatt") {
    const { entriesDisabled, entriesDisabledTitle } = props;
    return (
      <div className="space-y-1.5">
        {steuerung}
        {visibleDrafts.length === 0 ? (
          <p
            data-testid="entwurfsliste-filter-leer"
            className="rounded-btn bg-page px-2 py-1.5 text-[12px] leading-relaxed text-muted"
          >
            {t("capture.draftEmptyFiltered")}
          </p>
        ) : (
          <ul>
            {visibleDrafts.map((d) => {
              // Einmal gelesen, einmal entschieden: ob das Datum steht und was dort steht, ist
              // dieselbe Frage — zwei Aufrufe wären zwei Antworten auf sie.
              const datum = formatKoTimestamp(d.updatedAt || d.createdAt, i18n.language);
              return (
                <li key={d.id} className="flex flex-col">
                  <div className="flex items-start gap-1">
                    <button
                      type="button"
                      data-testid="blatt-entwurf-eintrag"
                      // WELCHEN Entwurf diese Zeile öffnet, steht an ihr selbst — dieselbe Kennung,
                      // die gleich in die Adresse geht. Ohne sie liesse sich „der Titel öffnet
                      // GENAU diesen Entwurf" nur behaupten, nicht messen.
                      data-entwurf={d.id}
                      disabled={entriesDisabled}
                      title={entriesDisabled ? entriesDisabledTitle : undefined}
                      onClick={() => onResume(d)}
                      className={`block min-w-0 flex-1 rounded-[7px] px-2 py-1.5 text-left text-[13px] ${
                        entriesDisabled ? "opacity-50" : "hover:bg-hairline-soft"
                      } ${editingId === d.id ? "font-semibold text-text" : "text-text"}`}
                    >
                      {/* ==================================================================
                          JOB 3266 R3 (bens Korrekturpflicht 2) — DER TITEL STEHT GANZ DA.
                          ==================================================================
                          Hier stand `truncate` (`white-space: nowrap`, `overflow: hidden`,
                          `text-overflow: ellipsis`). Bens Messung: 506 px Text auf 262 px
                          Fläche bei 320 px Fenster — der Titel brach mit Auslassungspunkten
                          AM ENDE ab. Genau dort stehen aber die Wörter, die zwei Entwürfe
                          desselben Vorhabens unterscheiden („… Nord 2026" gegen „… Süd
                          2026"). Eine Liste, in der zwei Zeilen gleich aussehen, ist keine
                          Auswahl.

                          `break-words` (`overflow-wrap: break-word`): Der Titel bricht wie
                          gewöhnlicher Text um, ein überlanges Wort (eine Kennung, ein
                          Dateiname ohne Leerzeichen) bricht innerhalb. Die Höhe darf wachsen
                          — die Liste ist genau dafür rollbar (`MenueFlaeche`,
                          `max-h-[420px] overflow-auto`).

                          Der Anker `…-eintrag-titel` ist der Messpunkt des
                          Lesbarkeitsmessers (`tests/d1-meine-entwuerfe/
                          zugang-schmal-chromium.test.ts`): er vergleicht `scrollWidth`/
                          `scrollHeight` gegen die sichtbare Fläche und erwartet dort GENAU
                          den Titel — die Marke „in Bearbeitung" steht deshalb daneben, nicht
                          darin. */}
                      <span data-testid="blatt-entwurf-eintrag-titel" className="block break-words">
                        {draftTitle(d, fallbackTitle)}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] font-normal text-muted">
                        {/* JOB 3266 (D1), Lieferung 3: das DATUM neben dem Titel — bei mehreren
                            Entwürfen desselben Vorhabens ist der Titel allein nicht
                            unterscheidbar. Fehlt oder bricht der Wert, steht KEINE Zeile da
                            statt eines erfundenen Datums (die Zusage von `formatKoTimestamp`). */}
                        {datum ? (
                          <span data-testid="blatt-entwurf-eintrag-datum">{datum}</span>
                        ) : null}
                        {/* JOB 3426, Lieferung 3: die Hervorhebung des offenen Entwurfs war eine
                            reine Fettung — für Auge und Maus genug, für einen Screenreader
                            nichts. Dasselbe Wort wie im Arbeitsraum, kein zweites. */}
                        {editingId === d.id ? (
                          <span
                            data-testid="blatt-entwurf-eintrag-offen"
                            className="font-mono text-[10px] uppercase text-ai"
                          >
                            {t("capture.editingBadge")}
                          </span>
                        ) : null}
                        {highlightId === d.id ? (
                          <span className="font-mono text-[10px] uppercase text-trust-pos-text">
                            {t("capture.draftJustSaved")}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {confirmDiscardId === d.id ? null : (
                      <LoeschKnopf id={d.id} onConfirmDiscard={onConfirmDiscard} />
                    )}
                  </div>
                  {confirmDiscardId === d.id ? (
                    // Auf 320 px passt die Rückfrage nicht neben den Titel — sie steht unter der
                    // Zeile, die sie betrifft, und trägt dieselben drei Worte wie im Arbeitsraum.
                    <div className="flex flex-wrap items-center gap-1.5 px-2 pb-1.5">
                      <span className="text-[11.5px] font-semibold text-text">
                        {t("capture.discardDraftQ")}
                      </span>
                      <LoeschRueckfrage
                        id={d.id}
                        discardPending={discardPending}
                        onConfirmDiscard={onConfirmDiscard}
                        onDiscard={onDiscard}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ==============================================================================================
  // JOB 3503 — DIE ZEILEN DES ARBEITSRAUMS SIND JETZT AUCH DIE ZEILEN DER SEITE.
  // ==============================================================================================
  // Zeichengleich zu vorher, nur einmal benannt statt zweimal geschrieben. Neu sind drei inerte
  // Anker an der Zeile: ohne sie liesse sich „diese Zeile öffnet GENAU diesen Entwurf" auf der
  // neuen Seite nur behaupten, nicht messen. Sie tragen den neutralen Namen der gemeinsamen
  // Bedienung — dieselbe Zeile, gleich gemessen, egal auf welcher Fläche sie steht.
  const inhalt = (
    <>
      {/* Volltext-/Titelsuche + Sortierung (Admin zusätzlich Ersteller-Filter). Leerer Filter =
          alle. JOB 3426: die Bedienung steht oben EINMAL und trägt alle Flächen. */}
      {steuerung}
      {visibleDrafts.length === 0 ? (
        <p
          data-testid="entwurfsliste-filter-leer"
          className="rounded-btn bg-page px-3 py-2 text-[12px] leading-relaxed text-muted"
        >
          {t("capture.draftEmptyFiltered")}
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {visibleDrafts.map((d) => (
            <li
              key={d.id}
              data-testid="entwurfsliste-eintrag"
              data-entwurfszeile={d.id}
              className={`flex flex-col gap-2 py-2 sm:flex-row sm:items-center ${
                highlightId === d.id
                  ? "rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg px-2"
                  : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-text">
                  {/* JOB 3503: der Titel trägt einen eigenen Träger — die Marken „in Bearbeitung"
                      und „gerade gespeichert" stehen DANEBEN und nicht darin, sonst läse ein
                      Titelvergleich sie mit. Dieselbe Trennung wie im Blatt-Zweig
                      (`blatt-entwurf-eintrag-titel`, JOB 3266 R3). */}
                  <span data-testid="entwurfsliste-eintrag-titel">
                    {draftTitle(d, fallbackTitle)}
                  </span>
                  {editingId === d.id ? (
                    <span className="ml-2 font-mono text-[10px] uppercase text-ai">
                      {t("capture.editingBadge")}
                    </span>
                  ) : null}
                  {highlightId === d.id ? (
                    <span className="ml-2 font-mono text-[10px] uppercase text-trust-pos-text">
                      {t("capture.draftJustSaved")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
                  <span>
                    {t("capture.draftCreatorMeta", { name: draftAuthorName(d, directory) })}
                  </span>
                  <span>
                    {t("capture.draftSavedMeta", {
                      date: formatDraftTimestamp(d.updatedAt || d.createdAt),
                    })}
                  </span>
                  <span>{t("capture.draftStatusMeta")}</span>
                </div>
              </div>
              {/* Bugfix (Pedi 04.07.): Löschen erst nach Inline-Nachfrage — kein stiller Verlust. */}
              {confirmDiscardId === d.id ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[11.5px] font-semibold text-text">
                    {t("capture.discardDraftQ")}
                  </span>
                  <LoeschRueckfrage
                    id={d.id}
                    discardPending={discardPending}
                    onConfirmDiscard={onConfirmDiscard}
                    onDiscard={onDiscard}
                  />
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="entwurfsliste-fortsetzen"
                    data-entwurf-fortsetzen={d.id}
                    onClick={() => onResume(d)}
                    className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                  >
                    <RotateCcw size={13} />
                    {t("capture.resume")}
                  </button>
                  <LoeschKnopf id={d.id} onConfirmDiscard={onConfirmDiscard} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  // JOB 3503: die eigene Seite — dieselben Zeilen, dieselbe Bedienung, ohne Rahmen und ohne
  // Aufklapper. Die Zahl steht als Plakette da, wo sie im Arbeitsraum steht; die Reichweiten-
  // Plakette bleibt eine ADMIN-Auskunft (mega38 J4) und erscheint nur dort, wo sie etwas
  // unterscheidet.
  if (props.variant === "seite") {
    return (
      <div data-testid="entwuerfe-liste" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2">
              {props.scopeLabel}
            </span>
          ) : null}
          <span
            data-testid="entwurfsliste-anzahl"
            className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2"
          >
            {totalCount}
          </span>
        </div>
        {inhalt}
      </div>
    );
  }

  const { open, onToggleOpen, scopeLabel } = props;

  return (
    <Card className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SectionLabel>{t("capture.resumeTitle")}</SectionLabel>
          {/* AUFTRAG-mega38 BLOCK J4: die Reichweiten-Plakette ist eine ADMIN-Auskunft. Für alle
              anderen stand dort „Meine Entwürfe" neben einer Überschrift, die schon „Entwürfe
              fortsetzen" heisst — doppelt gesagt und im Admin-Fall („ADMIN-ANSICHT: ALLE
              ENTWÜRFE") schlicht nicht ihre Angelegenheit. Sie erscheint nur noch, wo sie etwas
              unterscheidet. */}
          {isAdmin ? (
            <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2">
              {scopeLabel}
            </span>
          ) : null}
          <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2">
            {totalCount}
          </span>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggleOpen}
          className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
        >
          {open ? t("capture.resumeCollapse") : t("capture.resumeExpand", { count: totalCount })}
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open ? inhalt : null}
      {/* AUFTRAG-mega38 BLOCK J4: hier stand im eingeklappten Zustand „{{count}} Entwürfe sind
          eingeklappt, damit die Erfassungswege darunter erreichbar bleiben." Das erklärt der
          Leserin UNSERE Layoutentscheidung — eine Auskunft über uns, nicht über ihre Arbeit. Die
          Zahl steht ohnehin in der Plakette daneben und im Aufklapp-Knopf („Entwürfe anzeigen
          (13)"); der Satz trug nichts hinzu ausser Rechtfertigung. */}
    </Card>
  );
}
