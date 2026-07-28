// WP-COCKPIT-LINIE (Pedis VIP2-Klarstellung): sichtbare Schritt-Leiste + Schritt-Überschriften für
// den geführten Import-Fluss. Die BESTEHENDEN Bausteine (Quellen-Kacheln, Landkarte, Eingrenzen,
// Gruppen, Bilanz) bleiben unverändert — sie melden nur ihre Meilensteine über den Context; die
// Leiste oben und die Nummern-Überschriften je Schritt machen daraus den roten Faden. Ohne Provider
// (Bausteine einzeln eingebettet/getestet) verpuffen die Meldungen und die Anzeige steht auf "start".
import { Check } from "lucide-react";
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IMPORT_STEPS,
  IMPORT_STEP_TEXT,
  type ImportStage,
  type ImportStep,
  importStepStatus,
  maxStage,
  rewindForNewGeneration,
  rewindStage,
} from "../lib/importStepper";
import { Card } from "./ui";

// ================================================================================================
// AUFTRAG-mega32 BLOCK H (Pedis Beobachtung, aus dem zurückgezogenen mega30) — DIE QUELLENWAHL
// WÄHLT NICHTS AUS.
// ================================================================================================
//
// DER BEFUND. Es gab GAR KEINEN Zustand „gewählte Quelle". Der Provider führte ausschließlich einen
// `stage`. Eine Galerie-Kachel löste über `onActivate` eine HANDLUNG aus — Confluence startete die
// Erkundung, JSON öffnete einen Dateidialog —, aber niemand merkte sich, WAS gewählt wurde. Es gab
// also nichts, worauf ein anderer Teil der Seite hätte reagieren können. Die Quellenwahl war eine
// Auslöse-Leiste, keine Auswahl.
//
// `source` ist dieser fehlende Zustand. Er gehört hierher, weil die Quellenwahl Schritt 1 des
// Flusses ist und die späteren Schritte ohnehin von ihr abhängen.
export type ImportSource = "confluence" | "json";

interface ImportCockpitContextValue {
  stage: ImportStage;
  reach: (stage: ImportStage) => void;
  beginGeneration: (generation: string) => void;
  // WP-SHIP8-CLOSE-2 (bens F2): Rücksprung innerhalb der AKTUELLEN Generation (nur abwärts) —
  // für fehlgeschlagene/abgebrochene Übernahme-Läufe (kein Haken auf Schritt 5, kein hängendes
  // „applying"). Dieselbe rewind-Mechanik wie der Generationswechsel, keine neue Statusmaschine.
  rewind: (stage: ImportStage) => void;
  // AUFTRAG-mega32 H1: die GEWÄHLTE Quelle. `null` = noch nichts gewählt — dann zeigt die Seite
  // unverändert alles, wie bisher. Ausblenden beginnt erst mit einer echten Wahl.
  source: ImportSource | null;
  chooseSource: (source: ImportSource) => void;
  // ==============================================================================================
  // AUFTRAG-mega32 H3 — DIE FALLE, AN DER DAS SONST STILL ZERBRICHT.
  // ==============================================================================================
  // `handleActivate` suchte den versteckten Dateieingang über seine DOM-KENNUNG und klickte ihn
  // (ImportExplore.tsx, JSON_UPLOAD_INPUT_ID). Dieser Eingang liegt in genau dem Kasten, den H2
  // ausblendet. Wird der Kasten bedingt, greift der Griff ins Leere — GERÄUSCHLOS, ohne Fehler in
  // der Konsole: `document.getElementById` liefert dann `null`, und die Funktion tut schlicht nichts.
  //
  // Deshalb läuft die Anforderung jetzt über den ZUSTAND, nicht über den DOM-Durchgriff. Ein
  // monoton steigender Zähler ist dabei bewusst kein `boolean`: der Kasten muss auch dann wieder
  // reagieren, wenn dieselbe Quelle ein zweites Mal geklickt wird (Dialog abgebrochen, erneuter
  // Versuch) — ein Flag wäre nach dem ersten Mal blind.
  filePickRequest: number;
}

const ImportCockpitContext = createContext<ImportCockpitContextValue>({
  stage: "start",
  reach: () => {},
  beginGeneration: () => {},
  rewind: () => {},
  source: null,
  chooseSource: () => {},
  filePickRequest: 0,
});

export function ImportCockpitProvider({ children }: { children: ReactNode }): JSX.Element {
  // WP-COCKPIT-LINIE-b (bens Punkt 2): der Fortschritt lebt IN einer Eingrenzungs-Generation
  // (Schlüssel der aktuellen Eingrenzungs-Eingaben). Monotonie (maxStage) gilt nur innerhalb
  // einer Generation; eine NEUE Generation setzt den Downstream-Fortschritt ehrlich zurück
  // (Haken 4+5 weg, Schritt 3 wieder der aktuelle) — eine alte Bilanz zählt nicht für eine
  // neue Eingrenzung.
  const [state, setState] = useState<{ stage: ImportStage; generation: string | null }>({
    stage: "start",
    generation: null,
  });
  // AUFTRAG-mega32 H1/H3: gewählte Quelle + die Anforderung „öffne den Dateidialog", beide als
  // Zustand. Sie liegen bewusst NEBEN `state`: ein Quellenwechsel setzt den Fortschritt zurück
  // (s. chooseSource), aber die Zähler-Erhöhung darf keinen Generationswechsel auslösen.
  const [source, setSource] = useState<ImportSource | null>(null);
  const [filePickRequest, setFilePickRequest] = useState(0);
  const reach = useCallback(
    (next: ImportStage) =>
      setState((prev) => ({ stage: maxStage(prev.stage, next), generation: prev.generation })),
    [],
  );
  const beginGeneration = useCallback(
    (generation: string) =>
      setState((prev) => {
        if (prev.generation === generation) {
          return prev; // gleiche Eingrenzung — nichts passiert
        }
        // Erste gemeldete Generation: nur registrieren (der Fluss beginnt gerade erst).
        if (prev.generation === null) {
          return { stage: prev.stage, generation };
        }
        return { stage: rewindForNewGeneration(prev.stage), generation };
      }),
    [],
  );
  const rewind = useCallback(
    (target: ImportStage) =>
      setState((prev) => ({
        stage: rewindStage(prev.stage, target),
        generation: prev.generation,
      })),
    [],
  );
  // AUFTRAG-mega32 H1/H4: Eine Quelle wählen. H4 — ein Quellenwechsel ist eine NEUE GENERATION:
  // die Schrittleiste nimmt ihre Haken ehrlich zurück, wie sie es bei einer geänderten Eingrenzung
  // schon tut. Eine Landkarte aus dem Confluence-Weg zählt nicht für einen JSON-Weg.
  const chooseSource = useCallback((next: ImportSource) => {
    setSource((prev) => {
      if (prev !== null && prev !== next) {
        // Wechsel: zurück auf Schritt 1. Kein Neuladen, kein Verlust der Erreichbarkeit —
        // die Galerie bleibt ja stehen (H4).
        setState({ stage: "start", generation: null });
      }
      return next;
    });
    // H3: JEDE Wahl von „json" fordert den Dateidialog an — auch die wiederholte. Der Kasten
    // beobachtet den Zähler und öffnet den Dialog über seine eigene Referenz.
    if (next === "json") {
      setFilePickRequest((n) => n + 1);
    }
  }, []);
  const value = useMemo(
    () => ({
      stage: state.stage,
      reach,
      beginGeneration,
      rewind,
      source,
      chooseSource,
      filePickRequest,
    }),
    [state.stage, reach, beginGeneration, rewind, source, chooseSource, filePickRequest],
  );
  return <ImportCockpitContext.Provider value={value}>{children}</ImportCockpitContext.Provider>;
}

// WP-SHIP8-CLOSE-2 (bens F2): Rücksprung-Hook für Bausteine, deren Lauf scheitert/abbricht —
// meldet den fachlich korrekten Schritt der aktuellen Generation zurück (nie aufwärts).
export function useRewindImportStage(): (stage: ImportStage) => void {
  return useContext(ImportCockpitContext).rewind;
}

export function useReportImportStage(): (stage: ImportStage) => void {
  return useContext(ImportCockpitContext).reach;
}

// WP-COCKPIT-LINIE-b (bens Punkt 2): meldet die aktuelle Eingrenzungs-Generation (Schlüssel der
// Eingrenzungs-Eingaben) — der Provider setzt bei einem Wechsel den Downstream-Fortschritt zurück.
export function useReportImportGeneration(): (generation: string) => void {
  return useContext(ImportCockpitContext).beginGeneration;
}

// AUFTRAG-mega32 H1: die gewählte Quelle lesen und setzen. EIN Hook für beides — wer wählen darf,
// darf auch wissen, was gewählt ist; eine Trennung hätte hier keinen Nutzen.
export function useImportSource(): {
  source: ImportSource | null;
  chooseSource: (source: ImportSource) => void;
} {
  const ctx = useContext(ImportCockpitContext);
  return { source: ctx.source, chooseSource: ctx.chooseSource };
}

// AUFTRAG-mega32 H3: die Dateidialog-Anforderung als ZAHL statt als DOM-Griff. Der JSON-Kasten
// beobachtet sie; steigt sie, öffnet er seinen eigenen (per Ref gehaltenen) Eingang.
export function useFilePickRequest(): number {
  return useContext(ImportCockpitContext).filePickRequest;
}

const STEP_PILL_CLASS: Record<string, string> = {
  done: "border-trust-pos-fill/40 bg-trust-pos-bg text-trust-pos-text",
  active: "border-ink/30 bg-ink text-white",
  upcoming: "border-hairline bg-page text-muted-2 opacity-70",
};

// Die Schritt-Leiste oben im Cockpit: aktueller Schritt hervorgehoben, Erledigtes mit Haken,
// Kommendes gedimmt. Bricht auf schmalen Geräten sauber um (flex-wrap + min-w-0, kein Overflow).
export function ImportStepperBar(): JSX.Element {
  const { t } = useTranslation();
  const { stage } = useContext(ImportCockpitContext);
  return (
    <Card className="mb-5">
      <ol aria-label={t("imp.step.barLabel")} className="flex flex-wrap items-center gap-1.5">
        {IMPORT_STEPS.map((step, i) => {
          const status = importStepStatus(stage, step);
          return (
            <li
              key={step}
              // AUFTRAG-mega32 H4: der Schrittzustand maschinenlesbar. Rein additiv (kein
              // Verhalten, keine Optik) — damit ein Test belegen kann, dass ein Quellenwechsel die
              // Haken ehrlich zurücknimmt, ohne sich an Symbole oder Klassennamen zu klammern.
              data-step-status={status}
              {...(status === "active" ? { "aria-current": "step" as const } : {})}
              className={`flex min-w-0 items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px] font-semibold ${STEP_PILL_CLASS[status]}`}
            >
              {status === "done" ? (
                <Check size={13} aria-hidden className="shrink-0" />
              ) : (
                <span className="shrink-0 font-mono text-[10.5px]">{i + 1}</span>
              )}
              <span className="min-w-0 truncate">{t(IMPORT_STEP_TEXT[step].title)}</span>
              {status === "done" ? <span className="sr-only">{t("imp.step.done")}</span> : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// Schritt-Überschrift IN den bestehenden Bausteinen: Nummer + Titel + 1-Satz-Erklärung in
// einfacher Sprache — die visuelle Zuordnung der Bausteine zu den fünf Schritten.
export function ImportStepHeading({ step }: { step: ImportStep }): JSX.Element {
  const { t } = useTranslation();
  const { stage } = useContext(ImportCockpitContext);
  const status = importStepStatus(stage, step);
  const number = IMPORT_STEPS.indexOf(step) + 1;
  return (
    <div className={`flex items-start gap-2 ${status === "upcoming" ? "opacity-60" : ""}`}>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-pill font-mono text-[11px] font-semibold ${
          status === "active"
            ? "bg-ink text-white"
            : status === "done"
              ? "bg-trust-pos-bg text-trust-pos-text"
              : "border border-hairline bg-page text-muted-2"
        }`}
      >
        {status === "done" ? <Check size={13} aria-hidden /> : number}
      </span>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-text">
          {t(IMPORT_STEP_TEXT[step].title)}
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
          {t(IMPORT_STEP_TEXT[step].hint)}
        </p>
      </div>
    </div>
  );
}
