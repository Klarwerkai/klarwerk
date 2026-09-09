// WP-IC-4 (Schritt 4+5): Gruppen-Freigabe + Übernahme mit ehrlicher Bilanz. „Gruppieren" holt die
// KI-Gruppierung (Server; ohne funktionierendes Modell kommt die ehrliche deterministische
// Themen-Gruppierung — Kennzeichnung „Ohne KI gruppiert"). Gruppen als aufklappbare Karten mit
// großen Klickflächen (iPad); der Gruppen-Entscheid ist die Vorgabe je Kandidat, Einzel-Overrides
// bleiben; „bereits importiert" ist vorab abgewählt. „Auswahl übernehmen" startet den BESTEHENDEN
// Import-Weg (Review-Queue; Review-Invariante bleibt) in Batches mit ehrlichem Fortschritt und
// endet in der Bilanz (übernommen/übersprungen/ausgeschlossen/fehlgeschlagen).
import { ArrowRight, CheckCircle2, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
// JOB 3357: der BESTEHENDE Lesehaken der Laufakte — derselbe, den die Lauf-Kachel der Import-Seite
// fährt (`pages/Stufe2.tsx`, `const lauf = useImportRun(importId)`). Kein eigener Abruf, kein
// zweiter Schlüssel, kein zweiter Nachfragetakt.
import { useImportRun } from "../api/hooks";
import type { ImportApplyResponse, ImportGroupResponse, ImportSelectCriteria } from "../api/types";
import { displayImportText } from "../lib/htmlEntities";
import {
  type ApplyRunState,
  EMPTY_APPLY_RUN,
  type GroupedCandidate,
  IMPORT_GROUPS_TEXT,
  type ImportBilanz,
  type ImportGroup,
  aggregateBilanz,
  applyGroupToggle,
  buildBatches,
  groupLabelKey,
  hintLabelKey,
  includedIds,
  initialSelection,
  noAiReasonKey,
  selectionCounts,
  toggleCandidate,
} from "../lib/importGroups";
import { importRunStateView } from "../lib/importResultView";
import { koLabel } from "../lib/koLabel";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { AiCostHint } from "./AiCostHint";
import { AiGeneratedNotice } from "./AiGeneratedNotice";
// WP-COCKPIT-LINIE: Schritt-Überschriften (4 Gruppen freigeben · 5 Übernehmen & Bilanz) +
// Meilenstein-Meldungen an die Schritt-Leiste.
import { ImportStepHeading, useReportImportStage, useRewindImportStage } from "./ImportStepper";
// JOB 3357: der vorhandene Zustandsrenderer des Laufs — benutzt, nicht nachgebaut (Auftrag §7).
import { RunStateBanner } from "./confluence-import/RunStateBanner";
import { Button, cx } from "./ui";

// Präsentationsteil (kontrolliert, ohne Netz) — separat exportiert für den Mounted-Test.
export function GroupApprovalPanel({
  groups,
  candidates,
  selection,
  demo,
  fallbackReason,
  onToggleGroup,
  onToggleCandidate,
}: {
  groups: ImportGroup[];
  candidates: GroupedCandidate[];
  selection: Record<string, boolean>;
  demo: boolean;
  // WP-SHIP9-S1 (bens W2-Auflage): Ursache des deterministischen Laufs — "confidential" bekommt
  // einen spezifischen Grund-Zusatz am Badge (Muster AiCheckBadge), die übrigen Ursachen bleiben
  // bei der bisherigen Darstellung (bens T9).
  fallbackReason?: ImportGroupResponse["fallbackReason"];
  onToggleGroup: (group: ImportGroup, on: boolean) => void;
  onToggleCandidate: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const counts = selectionCounts(selection);
  const reasonKey = noAiReasonKey(fallbackReason);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-text">
          {t(IMPORT_GROUPS_TEXT.selectedCount, { x: counts.selected, y: counts.total })}
        </span>
        {demo ? (
          <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
            {reasonKey
              ? t(IMPORT_GROUPS_TEXT.noAiReason, { reason: t(reasonKey) })
              : t(IMPORT_GROUPS_TEXT.noAi)}
          </span>
        ) : (
          <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
            {t(IMPORT_GROUPS_TEXT.aiGrouped)}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {groups.map((group) => {
          const labelKey = groupLabelKey(group);
          const label = labelKey ? t(labelKey) : group.title;
          const groupOn = group.ids.some((id) => selection[id] === true);
          return (
            <details
              key={`${group.title}-${group.ids[0] ?? ""}`}
              className="rounded-card border border-hairline bg-surface"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3">
                <ChevronDown size={16} className="shrink-0 text-muted-2" />
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-text">
                  {label}
                </span>
                <span className="text-[12px] text-muted-2">
                  {t(IMPORT_GROUPS_TEXT.groupCount, { n: group.ids.length })}
                </span>
                {/* Große Klickflächen (iPad): ganze Gruppe freigeben/ausschließen. */}
                <button
                  type="button"
                  aria-pressed={groupOn}
                  onClick={(e) => {
                    e.preventDefault();
                    onToggleGroup(group, true);
                  }}
                  className={`rounded-btn border px-3 py-1.5 text-[12px] font-semibold ${
                    groupOn
                      ? "border-trust-pos-fill/60 bg-trust-pos-bg text-trust-pos-text"
                      : "border-hairline bg-surface text-muted hover:text-text"
                  }`}
                >
                  {t(IMPORT_GROUPS_TEXT.approve)}
                </button>
                <button
                  type="button"
                  aria-pressed={!groupOn}
                  onClick={(e) => {
                    e.preventDefault();
                    onToggleGroup(group, false);
                  }}
                  className={`rounded-btn border px-3 py-1.5 text-[12px] font-semibold ${
                    groupOn
                      ? "border-hairline bg-surface text-muted hover:text-text"
                      : "border-trust-warn-fill/60 bg-trust-warn-bg text-trust-warn-text"
                  }`}
                >
                  {t(IMPORT_GROUPS_TEXT.exclude)}
                </button>
              </summary>
              <ul className="space-y-1 border-t border-hairline p-3">
                {group.ids.map((id) => {
                  const candidate = byId.get(id);
                  if (!candidate) {
                    return null;
                  }
                  return (
                    <li key={id} className="flex items-start gap-2 text-[12.5px] text-text">
                      <input
                        type="checkbox"
                        aria-label={displayImportText(candidate.title, candidate.textCodec)}
                        checked={selection[id] === true}
                        onChange={() => onToggleCandidate(id)}
                        className="mt-0.5 h-5 w-5 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        {displayImportText(candidate.title, candidate.textCodec)}
                      </span>
                      {/* WP-SHIP9-S1b (bens GELB): EIGENES Badge — offener Kandidat ist „bereits
                          zur Prüfung vorgemerkt", bewusst in anderer Farbe und anderem Text als
                          der neutrale „bereits importiert"-Hinweis (ehrliche Trennung). */}
                      {candidate.alreadyQueued === true ? (
                        <span className="shrink-0 rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                          {t(IMPORT_GROUPS_TEXT.hintQueued)}
                        </span>
                      ) : null}
                      {/* WP-IC-6b: nüchternes Badge — Quelle wurde seit dem Import aktualisiert;
                          der Kandidat ist als Aktualisierung wählbar (neue KO-Version im Review). */}
                      {candidate.sourceNewer ? (
                        <span className="shrink-0 rounded-pill bg-ai-surface-1 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
                          {t(IMPORT_GROUPS_TEXT.hintSourceNewer)}
                        </span>
                      ) : null}
                      {candidate.hints.map((hint) => {
                        const key = hintLabelKey(hint);
                        return key ? (
                          <span
                            key={hint}
                            className="shrink-0 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2"
                          >
                            {t(key)}
                          </span>
                        ) : null;
                      })}
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================================================
// JOB 3357 — DER LAUF DIESER ÜBERNAHME: KENNUNG, AUSGANG, ZÄHLER.
// ================================================================================================
//
// DER BEFUND (Codex-Live 311b601a auf 1.201, nach einem echten Selektivimport):
// „Eine konkrete Laufkennung wird weiterhin nicht sichtbar angeboten; Uhrzeit und Ergebniszähler
// funktionieren jetzt praktisch." Die Kennung war da — der Server schickt sie seit JOB 3288 mit —,
// nur nahm sie im Client niemand entgegen. Pedi konnte den Lauf, den er gerade gefahren hatte,
// nicht benennen: nicht im Gespräch, nicht im Protokoll, nicht gegenüber dem Prüfer.
//
// EINE KENNUNG ALLEIN GENÜGT NICHT. Eine nackte UUID beantwortet die Frage nicht, die man
// wirklich hat („ist der Lauf durch, und wie ist er ausgegangen?"). Deshalb steht neben der
// Kennung der AUSGANG — gelesen über den vorhandenen Haken `useImportRun`, dargestellt im
// vorhandenen `RunStateBanner`, gezählt mit dem vorhandenen Satz `w2.run.progress`. Kein zweiter
// Abrufweg, kein zweites Vokabular: die Lauf-Kachel derselben Seite sagt dieselben Worte.
//
// WARUM ZWEI KOMPONENTEN UND NICHT ZWEI ZWEIGE IM RENDER: der Haken darf nur feuern, wenn es
// wirklich eine Kennung gibt. Als eigenes Bauteil, das nur mit vorhandener Kennung überhaupt
// gemountet wird, ist das baulich sicher — nicht bloß per `enabled` verabredet. Ohne Kennung
// entsteht dadurch auch keine react-query-Abhängigkeit dieser Fläche.

// Die Textschlüssel dieses Blocks. Sie stehen HIER und nicht in `lib/importGroups.ts`, weil dort
// keine Zeile dieses Auftrags liegt (Zielpfade); das Präfix `imp.groups.` bleibt dasselbe.
const IMPORT_GROUPS_RUN_TEXT = {
  heading: "imp.groups.runHeading",
  idLabel: "imp.groups.runIdLabel",
  call: "imp.groups.runCall",
  idNone: "imp.groups.runIdNone",
  outcomeLoading: "imp.groups.runOutcomeLoading",
  outcomeUnavailable: "imp.groups.runOutcomeUnavailable",
  // Der Vorbehalt ist EIN Satz („das ist nicht der aktuelle Stand") plus der GRUND. Getrennte
  // Vollsätze je Grund hatten den Fehler, dass jeder Grund seine eigene Kennzeichnung mitbringen
  // musste — und der Grund, den Runde 1 nicht kannte (ausgesetzt), brachte eben keine mit.
  outcomeStale: "imp.groups.runOutcomeStale",
  staleFailed: "imp.groups.runOutcomeStaleFailed",
  stalePaused: "imp.groups.runOutcomeStalePaused",
  staleRefreshing: "imp.groups.runOutcomeRefreshing",
  outcomeOffline: "imp.groups.runOutcomeOffline",
} as const;

/** Der Ausgang GENAU EINES Laufs. Wird nur gerendert, wenn eine Kennung vorliegt. */
function LaufAusgang({ importId }: { importId: string }): JSX.Element {
  const { t } = useTranslation();
  const lauf = useImportRun(importId);
  const akte = lauf.data;
  // AUSGESETZT (`fetchStatus: "paused"`) IST WEDER LADEN NOCH FEHLER — und genau daran ist die
  // erste Runde dieses Auftrags gescheitert (Prüferbefund BEN, JOB 3357 R1: offline gemessen
  // `{"status":"success","fetchStatus":"paused"}`, während die Fläche den alten Ausgang unmarkiert
  // stehen ließ). react-query setzt bei fehlender Verbindung KEIN `isError` und KEIN `isFetching`:
  // die Abfrage wartet. Wer nur diese zwei Flaggen liest, hält den ausgesetzten Fall für „ruhig und
  // aktuell" — die schlimmste der drei Lesarten, weil sie eine Frischezusage macht, die niemand
  // geprüft hat. `isPaused` wird deshalb VOR beiden anderen gefragt: es beschreibt, was gerade
  // wirklich der Fall ist (es läuft kein Versuch), während ein `isError` aus einem früheren Versuch
  // nur noch Vergangenheit ist.
  if (!akte) {
    // Noch nie erfolgreich gelesen. Drei verschiedene Lagen, drei verschiedene Sätze — und in
    // KEINER davon eine Aussage über den Ausgang: „unbekannt" ist weder Erfolg noch Misserfolg.
    return (
      <p data-testid="imp-groups-run-outcome" className="mt-1.5 text-[12px] text-muted-2">
        {lauf.isPaused
          ? t(IMPORT_GROUPS_RUN_TEXT.outcomeOffline)
          : lauf.isError
            ? t(IMPORT_GROUPS_RUN_TEXT.outcomeUnavailable)
            : t(IMPORT_GROUPS_RUN_TEXT.outcomeLoading)}
      </p>
    );
  }
  // GELESEN, nie hergeleitet — dieselbe reine Ableitung, die auch die Lauf-Kachel speist.
  const zustand = importRunStateView(akte.status);
  // Warum der Gezeigte nicht der aktuelle Stand ist — oder `null`, wenn er es ist. `isPaused` steht
  // VORNE: es beschreibt die Gegenwart (es läuft kein Versuch), während ein `isError` aus einem
  // früheren Versuch nur Vergangenheit ist. `dringend` trennt „da wartet etwas auf mich" von
  // „das erledigt sich gerade von selbst" — Farbe als zweite Spur, der Satz sagt es ohnehin.
  const vorbehalt: { grund: string; dringend: boolean } | null = lauf.isPaused
    ? { grund: IMPORT_GROUPS_RUN_TEXT.stalePaused, dringend: true }
    : lauf.isError
      ? { grund: IMPORT_GROUPS_RUN_TEXT.staleFailed, dringend: true }
      : lauf.isFetching
        ? { grund: IMPORT_GROUPS_RUN_TEXT.staleRefreshing, dringend: false }
        : null;
  // Der Ton des Vorbehalts steht als EIGENER lokaler Wert da und nicht im `className`-Ausdruck.
  // Grund ist der Klassenbindungs-Sammler (`tests/app/mega47-modale-flaechen-sammler.test.tsx`):
  // er löst Bezeichner auf, die in DIESER Datei einen literalen Wert haben, und meldet alles
  // andere als offen. Als `cx("mt-1 text-[12px]", vorbehalt.dringend ? … : …)` geschrieben war die
  // Bindung unauflösbar (der Sammler zählte 220 statt 219 offener Bindungen); so geschrieben sind
  // BEIDE Klassenketten für ihn lesbar. Das ist die Auflage aus JOB 3267 — die Klassen auflösbar
  // schreiben, nicht den Zählstand hochsetzen. KEIN VORBEISCHREIBEN: die Bindung bleibt eine
  // Bindung im `className`-Ausdruck und steht weiter in `ALLE_BINDUNGEN`; sie wandert nur von
  // „offen" nach „aufgelöst", weil hier nichts mehr zu raten ist.
  const vorbehaltTon = vorbehalt?.dringend === true ? "text-trust-warn-text" : "text-muted-2";
  return (
    <div data-testid="imp-groups-run-outcome" className="mt-1.5">
      <RunStateBanner
        state={zustand}
        failureCode={akte.failureCode}
        failureReason={akte.failureReason}
      />
      {/* Fortschritt als Zahl, fertig vom Server gezählt: angelegt + gebunden + übersprungen +
          gescheitert sind zusammen genau die Elemente, die der Lauf hinter sich hat. */}
      <p className="mt-1 text-[12.5px] text-muted">
        {t("w2.run.progress", {
          verarbeitet:
            akte.counters.itemsCreated +
            akte.counters.itemsBound +
            akte.counters.itemsSkipped +
            akte.counters.itemsFailed,
          gesamt: akte.counters.itemsTotal,
        })}
      </p>
      {/* Ein alter Stand bleibt STEHEN (nichts wird geleert), aber er wird nicht als frisch
          ausgegeben. Die KENNZEICHNUNG ist bei allen drei Gründen dieselbe — sie ist die Aussage,
          auf die es ankommt —, der GRUND steht daneben, weil „wartet auf die Verbindung",
          „fehlgeschlagen" und „läuft gerade" verschiedene Lagen sind. Ohne Verbindung (`isPaused`)
          ist der Vorbehalt PFLICHT: sonst stünde der zuletzt gelesene Ausgang unmarkiert da, als
          wäre er der aktuelle (Prüferbefund R1). */}
      {vorbehalt !== null ? (
        <p
          data-testid="imp-groups-run-outcome-stale"
          className={cx("mt-1 text-[12px]", vorbehaltTon)}
        >
          {t(IMPORT_GROUPS_RUN_TEXT.outcomeStale)} {t(vorbehalt.grund)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Die Läufe dieses Durchlaufs — einer je erfolgreich übertragenem Stapel, in Aufrufreihenfolge.
 *
 * KEINE ZUSAMMENFASSUNG ZU EINER: `runApply` schneidet die Auswahl in Stapel und ruft die
 * Übernahme je Stapel einmal auf; der Server legt dabei je Aufruf einen EIGENEN Lauf an. Zwei
 * Kennungen sind zwei Vorgänge mit zwei Akten, und eine Fläche, die daraus eine machte, würde
 * einen echten Vorgang verschweigen.
 *
 * Ein `null` in der Liste heißt: diese Antwort kam an und trug KEINE Kennung — der Server hat für
 * diesen Aufruf keinen Lauf geführt. Antworten, die gar nicht ankamen (Transportfehler), stehen
 * hier überhaupt nicht; nach ihnen weiß niemand, was der Server getan hat, und es wird deshalb
 * auch nichts behauptet.
 */
function LaufKennungen({
  kennungen,
}: { kennungen: readonly (string | null)[] }): JSX.Element | null {
  const { t } = useTranslation();
  if (kennungen.length === 0) {
    return null;
  }
  // Der Listenschlüssel trägt die Position voran: zwei Stapel können dieselbe (oder gar keine)
  // Kennung liefern, und React zöge gleich beschlüsselte Zeilen sonst zusammen.
  const zeilen = kennungen.map((importId, i) => ({
    key: `${i + 1}-${importId ?? "ohne-lauf"}`,
    nummer: i + 1,
    importId,
  }));
  const letzte = [...zeilen].reverse().find((z) => z.importId !== null)?.importId ?? null;
  return (
    <div data-testid="imp-groups-run" className="mt-2 border-t border-hairline pt-2">
      <p className="text-[12px] font-semibold text-text">{t(IMPORT_GROUPS_RUN_TEXT.heading)}</p>
      <ul className="mt-1 space-y-1 text-[12.5px] text-text">
        {zeilen.map((zeile) => (
          <li key={zeile.key}>
            {zeile.importId === null ? (
              // Ehrlich, nicht hübsch: kein Strich, kein leerer Platz, keine erfundene Kennung.
              <span data-testid="imp-groups-run-id-none" className="text-muted">
                {zeilen.length > 1
                  ? `${t(IMPORT_GROUPS_RUN_TEXT.call, { n: zeile.nummer })}: `
                  : ""}
                {t(IMPORT_GROUPS_RUN_TEXT.idNone)}
              </span>
            ) : (
              <>
                <span className="text-muted">
                  {zeilen.length > 1
                    ? `${t(IMPORT_GROUPS_RUN_TEXT.call, { n: zeile.nummer })} · `
                    : ""}
                  {t(IMPORT_GROUPS_RUN_TEXT.idLabel)}:{" "}
                </span>
                {/* `select-all` + `break-all`: der Wert ist zum Vorlesen UND zum Abschreiben da.
                    Bewusst KEIN `truncate` — eine halbe Kennung ist keine Kennung. */}
                <span
                  data-testid="imp-groups-run-id"
                  className="select-all break-all font-mono text-[12px] text-text"
                >
                  {zeile.importId}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      {/* Der Ausgang gehört zum ZULETZT gelaufenen — das ist der, nach dem gerade gefragt wird. */}
      {letzte !== null ? <LaufAusgang importId={letzte} /> : null}
    </div>
  );
}

export function ImportGroups({
  criteria,
  selectedCandidateIds,
  aiAvailable = true,
  aiBillable,
  stackConfidential = false,
  groupingStale = false,
  onGrouped,
  onApplied,
}: {
  criteria: ImportSelectCriteria;
  // F3 (bens ROT): die in der Vorschau gewählten, zulässigen Kandidaten-IDs. Sie steuern (zusätzlich
  // zu den Kriterien) SERVERSEITIG, welche Kandidaten gruppiert und übernommen werden — nicht mehr
  // „alle passenden". Leere Menge → der Weiter-Knopf ist deaktiviert (kein Lauf über alles).
  selectedCandidateIds: readonly string[];
  // PAKET 1 (D-AISTATE, Pedi 23.07.): ist die KI-Gruppierung (Task „group") nutzbar? Als PROP (nicht
  // Hook), damit die Komponente bis zur Bilanz ohne QueryClient-Provider testbar bleibt; der Eltern-Kontext
  // reicht die echte Verfügbarkeit ein. WICHTIG: der Knopf wird NICHT ausgegraut — die deterministische
  // Themen-Gruppierung bleibt ein voller, nutzbarer Kernablauf (Ergebnis ehrlich „Ohne KI gruppiert").
  // Ohne Modell kündigt nur ein Vor-Hinweis an, dass ohne KI gruppiert wird. Default true (kein Test-Bruch).
  aiAvailable?: boolean;
  // AUFTRAG-mega67 Block G: kostet der Gruppierungsklick wirklich etwas? Kommt von oben herein
  // (ImportSelect, useAiBillable("group")) — nicht dasselbe wie `aiAvailable`, das auch ein
  // kostenloses lokales Modell erfuellt. Ohne Auskunft schweigt der Hinweis.
  aiBillable?: boolean;
  // AUFTRAG-mega59 BLOCK F2: trägt der GEWÄHLTE Stapel vertrauliche oder nicht freigegebene
  // Einträge? Dann nimmt der Batch-Vertrag die Cloud-KI heraus, ganz unabhängig davon, ob ein Modell
  // aktiv ist — und die Vorwarnung muss das sagen, statt bei aktivem Reasoner zu schweigen und
  // hinterher „Ohne KI gruppiert" zu zeigen. Der Eltern-Kontext leitet es aus den gewählten
  // Vorschau-Einträgen ab (`confidentialForAi`); Default false hält Bestandstests unverändert.
  stackConfidential?: boolean;
  // AUFTRAG-mega9 Block E-4 (KW-E2E-008): In dieser Sitzung wurde SCHON gruppiert, aber zu einer
  // ANDEREN Auswahl — die damals aufgebauten Gruppen hat der Neu-Mount (React-Key) korrekt verworfen.
  // Dieses Wissen überlebt den Remount nur im Eltern-Kontext, deshalb kommt es als Prop herein: der
  // Knopf heißt dann ehrlich „Gruppierung aktualisieren" statt weiterhin „Weiter: Gruppieren".
  //
  // Warum NICHT automatisch neu gruppieren (die andere vom Prüfer angebotene Variante): Gruppieren
  // kostet einen Modelllauf. Ihn bei jedem Häkchen selbsttätig auszulösen wäre teuer und für den
  // Nutzer überraschend — ein ehrlich benannter Knopf ist hier die bessere Antwort.
  groupingStale?: boolean;
  // Eine Gruppierung ist erfolgreich durchgelaufen — der Eltern-Kontext merkt sich, ZU WELCHER
  // Auswahl, um `groupingStale` bilden zu können.
  onGrouped?: () => void;
  // AUFTRAG-mega9 Block E-5 (KW-E2E-009): Die Übernahme ist durch. Der Eltern-Kontext frischt die
  // Review-/Bilanz-Abfragen GEMEINSAM auf. Bewusst als Callback und nicht über einen eigenen
  // Query-Client-Griff in dieser Fläche (dokumentierte Entscheidung, gepinnt in
  // `tests/library/import-apply-invalidate.test.ts`).
  //
  // JOB 3357 — WAS SICH DARAN GEÄNDERT HAT, UND WAS NICHT: Die Bilanz liest seit diesem Auftrag
  // die Laufakte über den bestehenden Lesehaken `useImportRun` und hängt damit MITTELBAR an
  // react-query — aber nur in dem Zweig, der wirklich eine Laufkennung hat (`LaufAusgang`). Die
  // Entscheidung oben bleibt unberührt: diese Fläche hält weiterhin keinen QueryClient und macht
  // nichts selbst ungültig; das tut nach wie vor allein der Eltern-Kontext über diesen Rückruf.
  onApplied?: () => void;
}): JSX.Element {
  const { i18n, t } = useTranslation();
  const hasSelection = selectedCandidateIds.length > 0;
  const [data, setData] = useState<ImportGroupResponse | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"group" | "apply" | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [runState, setRunState] = useState<ApplyRunState>(EMPTY_APPLY_RUN);
  // JOB 3357: die Kennungen der Läufe dieses Durchlaufs, EIN Eintrag je angekommener Antwort, in
  // Aufrufreihenfolge; `null` = die Antwort kam an und trug keine Kennung (kein Lauf geführt).
  //
  // BEWUSST EIGENER ZUSTAND statt eines Felds in `ApplyRunState`: dessen `ApplyBatchResult` wohnt
  // in `lib/importGroups.ts` und kennt die Kennung nicht. Sie dort aus einem Wert zu lesen, den
  // der Typ nicht führt, wäre eine stille Annahme — hier steht sie als das da, was sie ist.
  const [laufKennungen, setLaufKennungen] = useState<(string | null)[]>([]);
  const [bilanz, setBilanz] = useState<ImportBilanz | null>(null);
  const [error, setError] = useState<string | null>(null);
  // WP-REST18 (bens Fix 2): der Snapshot hinter data.snapshotToken wurde serverseitig verdrängt —
  // in diesem Zustand gibt es NUR den Weg „Neu gruppieren" (frischer /group-Aufruf, neuer Token);
  // ein Wiederholen mit dem alten Token liefe garantiert wieder in den 409.
  const [snapshotExpired, setSnapshotExpired] = useState(false);
  // WP-RETEST7 R7 (Pedis Befund: Gruppieren nicht gefunden): nach dem Gruppieren scrollt die
  // Ansicht sanft zum Gruppen-Bereich — der Schritt darf nicht vom Scroll-Zufall abhängen.
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (data !== null && bilanz === null) {
      panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [data, bilanz]);

  // AUFTRAG-mega59 BLOCK E: die Abbildung Kennung→Titel für die Fehlerbilanz — aus den BEREITS
  // geladenen Kandidaten desselben Laufs. `data` bleibt gesetzt, wenn die Bilanz erscheint (der
  // Apply-Weg liest selbst `data.candidates`), also gibt es hier nichts nachzuladen: kein neuer
  // Serveraufruf, kein neuer Egress, kein neuer Host.
  // Durch `displayImportText` wie überall sonst in dieser Komponente — sonst stünde in der Bilanz
  // ein anders dekodierter Titel als in der Kandidatenliste darüber.
  const titelJeKandidat = useMemo(
    () =>
      new Map((data?.candidates ?? []).map((c) => [c.id, displayImportText(c.title, c.textCodec)])),
    [data],
  );

  // WP-COCKPIT-LINIE: Meilensteine an die Schritt-Leiste — Gruppen sichtbar → Schritt 4 aktiv.
  // WP-SHIP8-CLOSE-2 (bens F2): „applied" meldet NICHT mehr jede Bilanz, sondern nur der
  // ERFOLGREICH abgeschlossene Lauf am Ende von runApply (definierte Bilanz + kein
  // transportFailed-Batch). Fehlgeschlagene/abgebrochene Läufe spulen stattdessen ehrlich
  // zurück (rewind) — kein Haken auf Schritt 5, kein hängendes „applying".
  const reach = useReportImportStage();
  const rewind = useRewindImportStage();
  useEffect(() => {
    if (data !== null) {
      reach("grouping");
    }
  }, [data, reach]);

  // WP-SHIP9-S2 (D6): Sprung zur Review-Queue (klappt die standardmäßig eingeklappte Verlaufs-Sektion
  // auf). Der Zähler kommt ehrlich aus der gerade abgeschlossenen Bilanz (dieser Lauf), nicht aus einem
  // zusätzlichen Query — der Zähler dieses Knopfes braucht keinen Serveraufruf.
  // (JOB 3357 hat einen Lesehaken für die LAUFAKTE hinzugefügt; dieser Zähler bleibt davon
  // unberührt und stammt weiterhin allein aus der Bilanz dieses Laufs.)
  const jumpToReview = (): void => {
    const el =
      typeof document !== "undefined" ? document.getElementById("import-review-queue") : null;
    if (el instanceof HTMLDetailsElement) {
      el.open = true; // die standardmäßig eingeklappte Verlaufs-Sektion aufklappen
    }
    el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const runGrouping = async (): Promise<void> => {
    setBusy("group");
    setError(null);
    setBilanz(null);
    setRunState(EMPTY_APPLY_RUN);
    setLaufKennungen([]);
    setSnapshotExpired(false);
    try {
      const response = await endpoints.admin.import.group({
        criteria,
        locale: toReasonerLocale(i18n.language),
        // F3: NUR die in der Vorschau gewählten IDs gruppieren (serverseitig gegen den aktuellen
        // Snapshot validiert). Die von der Gruppen-Ansicht initialisierte Zweit-Auswahl startet
        // dadurch aus genau diesen IDs (der Server liefert nur sie zurück).
        selectedCandidateIds: [...selectedCandidateIds],
      });
      setData(response);
      setSelection(initialSelection(response.candidates));
      // AUFTRAG-mega9 Block E-4: dem Eltern-Kontext melden, ZU WELCHER Auswahl gruppiert wurde.
      onGrouped?.();
    } catch (err) {
      // Ehrliche Meldung; der erneute Versuch nutzt serverseitig automatisch die deterministische
      // Fallback-Gruppierung, falls das Modell weiter ausfällt.
      setError(err instanceof ApiError ? err.message : t("state.error"));
    } finally {
      setBusy(null);
    }
  };

  // WP-SHIP7-FIX (Fix 3): expliziter Lauf-Zustand (attempted/transportFailed) über Batches hinweg.
  // Ein HTTP-Fehler bricht den Lauf ab: die Ids DIESES Batches gelten als fehlgeschlagen (Zustand
  // unbekannt), alle noch nicht versuchten werden ehrlich als „nicht versucht" ausgewiesen — der
  // Wiederholen-Knopf übernimmt NUR den nicht versuchten Rest (kein Doppel-Import-Risiko).
  const runApply = async (idsOverride?: readonly string[]): Promise<void> => {
    if (!data) {
      return;
    }
    const prior = idsOverride ? runState : EMPTY_APPLY_RUN;
    const ids = idsOverride ? [...idsOverride] : includedIds(selection);
    setBusy("apply");
    // WP-COCKPIT-LINIE-b (bens Punkt 1): WÄHREND der Übernahme ist Schritt 5 der aktive Schritt
    // der Leiste (applying); erledigt ist er erst mit der Bilanz (applied, s. Effekt oben).
    reach("applying");
    setError(null);
    setProgress({ done: 0, total: ids.length });
    const results = [...prior.results];
    const attempted = [...prior.attempted];
    const transportFailed = [...prior.transportFailed];
    // Dieselbe Fortschreibungsregel wie bei `results`: beim Wiederholen des Restes werden die
    // Kennungen der Vorläufe mitgenommen, ein frischer Lauf beginnt bei null.
    const kennungen: (string | null)[] = idsOverride ? [...laufKennungen] : [];
    try {
      for (const batch of buildBatches(ids)) {
        attempted.push(...batch);
        try {
          const result: ImportApplyResponse = await endpoints.admin.import.apply({
            criteria,
            includeIds: batch,
            // Snapshot-Pin: alle Batches dieses Laufs arbeiten auf der Datenbasis der Gruppierung.
            snapshotToken: data.snapshotToken,
            // F3: die Übernahme ist zusätzlich auf die in der Vorschau gewählten IDs beschränkt —
            // eine IncludeId außerhalb dieser Menge lehnt der Server ehrlich ab (Bilanz-notFound).
            selectedCandidateIds: [...selectedCandidateIds],
          });
          results.push(result);
          // JOB 3357: Die Kennung dieses Aufrufs, so wie sie ankam. Fehlt sie, wird `null`
          // vermerkt — ausdrücklich „kein Lauf", nie ein Platzhalter und nie ein Weglassen.
          kennungen.push(
            typeof result.importId === "string" && result.importId.length > 0
              ? result.importId
              : null,
          );
        } catch (err) {
          // WP-REST18 (bens Fix 2): SNAPSHOT_EXPIRED ist KEIN Transportfehler — der alte Token
          // liefe bei jedem Wiederholen wieder in den 409. Lauf kontrolliert beenden, kompletten
          // Gruppierungs-Zustand zurücksetzen und NUR den Weg „Neu gruppieren" anbieten.
          if (err instanceof ApiError && err.code === "SNAPSHOT_EXPIRED") {
            setData(null);
            setSelection({});
            setRunState(EMPTY_APPLY_RUN);
            setLaufKennungen([]);
            setBilanz(null);
            setSnapshotExpired(true);
            // WP-SHIP8-CLOSE-2 (bens F2): kein hängendes „applying" — die Gruppen sind weg,
            // Eingrenzung/Vorschau stehen noch, das Neu-Gruppieren-Angebot ist der nächste
            // Schritt → ehrlich zurück auf „previewed" (Schritt 4 aktiv, kein Haken auf 5).
            rewind("previewed");
            return;
          }
          transportFailed.push(...batch);
          setError(err instanceof ApiError ? err.message : t("state.error"));
          break; // Rest bleibt „nicht versucht" — der Wiederholen-Knopf übernimmt ihn.
        }
        setProgress((prev) => ({
          done: Math.min((prev?.done ?? 0) + batch.length, ids.length),
          total: ids.length,
        }));
      }
    } finally {
      setBusy(null);
      setProgress(null);
    }
    const nextRun: ApplyRunState = { results, attempted, transportFailed };
    setRunState(nextRun);
    setLaufKennungen(kennungen);
    setBilanz(aggregateBilanz(data.candidates, selection, nextRun));
    // WP-SHIP8-CLOSE-2 (bens F2): der Haken auf Schritt 5 kommt NUR bei einem Lauf ohne
    // Transportfehler (inkl. der aus Vorläufen mitgeschleppten — deren Ids bleiben ehrlich
    // „fehlgeschlagen" in der Bilanz). Sonst zurück auf „grouping": die Gruppen sind noch da,
    // Schritt 4 ist der fachlich korrekte aktive Schritt.
    if (transportFailed.length === 0) {
      reach("applied");
    } else {
      rewind("grouping");
    }
    // AUFTRAG-mega9 Block E-5 (KW-E2E-009): Bilanz UND Review-Abfrage gehören zusammen aufgefrischt.
    // Vorher blieb ["import-candidates"] nach der Übernahme stale: der Knopf zeigte „1 offen" (aus der
    // frischen Bilanz dieses Laufs), der Review-Verlauf daneben noch „0 offen · 4 gesamt" (aus dem
    // alten Cache) — und jumpToReview sprang den Nutzer genau auf diesen widersprüchlichen Zähler.
    // Auch bei Transportfehlern melden: die TEILWEISE übernommenen Kandidaten sind echt und stehen
    // schon in der Queue; ein stale Zähler wäre dann genauso falsch.
    onApplied?.();
  };

  const counts = selectionCounts(selection);

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      {snapshotExpired ? (
        // WP-REST18 (Fix 2): handlungsfähiger Zustand — klare Meldung + prominenter Neustart des
        // Gruppierungs-Flows. Der alte Token existiert hier nicht mehr (data wurde zurückgesetzt).
        <div className="space-y-2">
          <p className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
            {t(IMPORT_GROUPS_TEXT.expired)}
          </p>
          <Button variant="primary" disabled={busy !== null} onClick={() => void runGrouping()}>
            {busy === "group" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
            {busy === "group" ? t(IMPORT_GROUPS_TEXT.grouping) : t(IMPORT_GROUPS_TEXT.regroup)}
          </Button>
        </div>
      ) : null}

      {data === null && !snapshotExpired ? (
        // WP-RETEST7 R7: UNÜBERSEHBARER Primär-CTA direkt unter der Vorschau — große Klickfläche,
        // volle Breite; der nächste Schritt (Gruppieren & Übernehmen) ist damit explizit benannt.
        // F3: leere Vorschau-Auswahl → deaktiviert mit ehrlichem Hinweis (kein Lauf über alles).
        <>
          <Button
            variant="primary"
            className="w-full py-3 text-[14px]"
            disabled={busy === "group" || !hasSelection}
            onClick={() => void runGrouping()}
          >
            {busy === "group" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {busy === "group"
              ? t(IMPORT_GROUPS_TEXT.grouping)
              : // AUFTRAG-mega9 Block E-4 (KW-E2E-008): nach einer Auswahländerung heißt derselbe
                // Knopf, was er wirklich tut — die verworfene Gruppierung neu aufbauen.
                t(groupingStale ? IMPORT_GROUPS_TEXT.refreshGrouping : IMPORT_GROUPS_TEXT.cta)}
          </Button>
          {!hasSelection ? (
            <p className="mt-1.5 text-[12px] text-muted-2">{t(IMPORT_GROUPS_TEXT.needSelection)}</p>
          ) : null}
          {/* AUFTRAG-mega61 Block E: der Gruppierungsschritt ruft ein Modell und hatte weder die
              Modellangabe noch einen dauerhaften Hinweis — nur Badges NACH dem Lauf. */}
          <p className="mt-1.5">
            <AiGeneratedNotice />{" "}
            {/* AUFTRAG-mega62 Block F: der Gruppierungslauf geht über den ganzen gewählten Stapel
                und ist damit der teuerste Klick dieser Fläche — der Halbsatz gehört an den Knopf,
                nicht hinter das Ergebnis. */}
            <AiCostHint billable={aiBillable} />
          </p>
          {/* ================================================================================
              AUFTRAG-mega59 BLOCK F2 — DIE VORWARNUNG HAT VORHER GELOGEN.
              ================================================================================
              Hier stand `hasSelection && !aiAvailable`. `aiAvailable` kommt aus
              `useAiAvailable("group")` und kennt AUSSCHLIESSLICH den globalen Reasoner-Status — von
              der Vertraulichkeit des gewählten Stapels weiß es nichts. Bei aktivem Reasoner gab es
              also KEINE Vorwarnung, und danach stand „Ohne KI gruppiert" da. Genau das hat der Chef
              live gesehen: nicht ein Schönheitsfehler, sondern eine falsche Zustandsaussage.
              Ab jetzt zählt beides — das fehlende Modell UND der vertrauliche Stapel. Der Grund wird
              getrennt benannt, weil er verschiedene Reaktionen verlangt: beim fehlenden Modell ist
              etwas zu konfigurieren, beim vertraulichen Stapel ist der Ausschluss KORREKT und der
              Nutzer soll nur nicht überrascht werden.
              Die Stufe wird clientseitig aus den GEWÄHLTEN Kandidaten abgeleitet (nicht aus der
              ganzen Vorschau — die Auswahl ist eine Teilmenge), aus einem Feld, das die
              Auswahl-Antwort mitbringt. Kein neuer Aufruf, kein neuer Egress, kein neuer Host. */}
          {hasSelection && (!aiAvailable || stackConfidential) ? (
            <p className="mt-1.5 text-[12px] text-muted-2">
              {t(
                stackConfidential
                  ? IMPORT_GROUPS_TEXT.willGroupWithoutAiConfidential
                  : IMPORT_GROUPS_TEXT.willGroupWithoutAi,
              )}
            </p>
          ) : null}
        </>
      ) : null}

      {error ? (
        <div className="mt-2">
          <p className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
            {error}
          </p>
          {data === null ? (
            <Button variant="ghost" disabled={busy !== null} onClick={() => void runGrouping()}>
              {t(IMPORT_GROUPS_TEXT.retry)}
            </Button>
          ) : null}
        </div>
      ) : null}

      {data !== null && bilanz === null ? (
        <div ref={panelRef} className="scroll-mt-4">
          {/* WP-COCKPIT-LINIE Schritt 4: Gruppen freigeben. */}
          <div className="mb-2">
            <ImportStepHeading step="groups" />
          </div>
          <GroupApprovalPanel
            groups={data.groups}
            candidates={data.candidates}
            selection={selection}
            demo={data.demo}
            fallbackReason={data.fallbackReason}
            onToggleGroup={(group, on) => setSelection((prev) => applyGroupToggle(prev, group, on))}
            onToggleCandidate={(id) => setSelection((prev) => toggleCandidate(prev, id))}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={busy !== null || counts.selected === 0}
              onClick={() => void runApply()}
            >
              {busy === "apply" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              {t(IMPORT_GROUPS_TEXT.applyCta, { n: counts.selected })}
            </Button>
            {progress ? (
              <span className="text-[12.5px] text-muted">
                {t(IMPORT_GROUPS_TEXT.applying, { x: progress.done, y: progress.total })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {bilanz !== null ? (
        <div className="mt-3">
          {/* WP-COCKPIT-LINIE Schritt 5: Übernehmen & Bilanz. */}
          <div className="mb-2">
            <ImportStepHeading step="apply" />
          </div>
          <div className="rounded-card border border-hairline bg-page p-3">
            <p className="text-[13px] font-semibold text-text">
              {t(IMPORT_GROUPS_TEXT.bilanzTitle)}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-text">
              <li>· {t(IMPORT_GROUPS_TEXT.bilanzImported, { n: bilanz.imported })}</li>
              {bilanz.updates > 0 ? (
                <li className="pl-3 text-muted">
                  {t(IMPORT_GROUPS_TEXT.bilanzUpdates, { n: bilanz.updates })}
                </li>
              ) : null}
              <li>· {t(IMPORT_GROUPS_TEXT.bilanzQueued, { n: bilanz.alreadyQueued })}</li>
              <li>· {t(IMPORT_GROUPS_TEXT.bilanzSkipped, { n: bilanz.skippedAlreadyImported })}</li>
              {/* WP-SHIP9-S1b: getrennter Zähler — übersprungen, weil bereits vorgemerkt. */}
              {bilanz.skippedAlreadyQueued > 0 ? (
                <li>
                  · {t(IMPORT_GROUPS_TEXT.bilanzSkippedQueued, { n: bilanz.skippedAlreadyQueued })}
                </li>
              ) : null}
              <li>· {t(IMPORT_GROUPS_TEXT.bilanzExcluded, { n: bilanz.excluded })}</li>
              <li>· {t(IMPORT_GROUPS_TEXT.bilanzFailed, { n: bilanz.failed.length })}</li>
              {bilanz.notAttempted.length > 0 ? (
                <li>
                  · {t(IMPORT_GROUPS_TEXT.bilanzNotAttempted, { n: bilanz.notAttempted.length })}
                </li>
              ) : null}
            </ul>
            {bilanz.failed.length > 0 ? (
              <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-trust-crit-text">
                {/* AUFTRAG-mega59 BLOCK E: hier stand die rohe Kandidaten-Kennung, obwohl
                    `data.candidates` mit `title` in DERSELBEN Komponente vorliegt. Die Abbildung
                    Kennung→Titel entsteht aus den bereits geladenen Kandidaten — KEIN neuer
                    Serveraufruf, kein neuer Egress. Fehlt ein Titel (Kandidat nicht mehr im
                    Schnappschuss), bleibt die Kennung der Rückfall. */}
                {bilanz.failed.map((f) => (
                  <li key={f.id} title={f.id}>
                    · {koLabel(titelJeKandidat.get(f.id), f.id)} —{" "}
                    {f.reason === "not-found"
                      ? t(IMPORT_GROUPS_TEXT.failNotFound)
                      : f.reason === "http-error"
                        ? t(IMPORT_GROUPS_TEXT.failHttp)
                        : f.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            {/* JOB 3357: der Lauf, den diese Bilanz gerade gefahren hat — Kennung, Ausgang,
                Zähler. Er steht NACH den Zahlen und VOR den Knöpfen: er ist eine Auskunft über
                das Geschehene, keine Handlung. Die Reihenfolge der Handlungsangebote
                („Rest übernehmen" · „Weiter zum Import-Review") bleibt dadurch unverändert —
                der Fluss hat weiterhin genau EINEN Primär-CTA je Zustand. */}
            <LaufKennungen kennungen={laufKennungen} />
            {bilanz.notAttempted.length > 0 ? (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => void runApply(bilanz.notAttempted)}
                >
                  {t(IMPORT_GROUPS_TEXT.retryRest, { n: bilanz.notAttempted.length })}
                </Button>
              </div>
            ) : null}
            <p className="mt-2 text-[12px] text-muted-2">{t(IMPORT_GROUPS_TEXT.bilanzReview)}</p>
            {/* WP-SHIP9-S2 (D6): direkter Sprung ins Import-Review mit echtem Zähler (die in DIESEM Lauf
                zur Prüfung offenen Fälle: neu eingereiht + bereits vorgemerkt). Sekundär (outline), damit
                der geführte Fluss weiter genau EINEN Primär-CTA je Zustand hat. */}
            <div className="mt-2">
              <Button variant="outline" onClick={jumpToReview}>
                <ArrowRight size={15} />
                {t(IMPORT_GROUPS_TEXT.toReview, {
                  n: bilanz.imported + bilanz.alreadyQueued,
                })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
