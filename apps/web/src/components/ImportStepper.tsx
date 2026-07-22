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

interface ImportCockpitContextValue {
  stage: ImportStage;
  reach: (stage: ImportStage) => void;
  beginGeneration: (generation: string) => void;
  // WP-SHIP8-CLOSE-2 (bens F2): Rücksprung innerhalb der AKTUELLEN Generation (nur abwärts) —
  // für fehlgeschlagene/abgebrochene Übernahme-Läufe (kein Haken auf Schritt 5, kein hängendes
  // „applying"). Dieselbe rewind-Mechanik wie der Generationswechsel, keine neue Statusmaschine.
  rewind: (stage: ImportStage) => void;
}

const ImportCockpitContext = createContext<ImportCockpitContextValue>({
  stage: "start",
  reach: () => {},
  beginGeneration: () => {},
  rewind: () => {},
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
  const value = useMemo(
    () => ({ stage: state.stage, reach, beginGeneration, rewind }),
    [state.stage, reach, beginGeneration, rewind],
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
