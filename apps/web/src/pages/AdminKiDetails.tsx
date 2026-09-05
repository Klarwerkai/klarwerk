// JOB 3065 H6 — DIE DETAILKARTEN DES REITERS „KI".
//
// Was hier steht, stand vorher als Kartenwand in `Admin.tsx`. Der Umbau verlegt sie hinter die
// Zeilen der Einstellungen: eine Zeile mit Wert, ein Chevron, DIESE Karte — vollständig, mit allen
// Feldern, Knöpfen und Ergebnissen. Verloren geht nichts; die Hilfetexte (die Körper der früheren
// Hilfe-Zeichen und die Einleitungsabsätze) wandern in das eine „?"-Menü je Karte (Lieferung 9).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ExternalKnowledgeStage } from "../api/types";
import { useToast } from "../app/ToastContext";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { Button, Field, TextInput } from "../components/ui";
import { type AiAccessState, aiAccessRows } from "../lib/aiOverview";
// AUFTRAG kimodus-live: Topbar-/Status-Queries nach dem Übernehmen live invalidieren.
import { invalidateAiState } from "../lib/aiStateInvalidate";
import { parseNeededValidations } from "../lib/reviewerMinimum";
import { maxRawAttachmentMb } from "../lib/uploadLimits";

// KI-Verwaltung v1 (Pedi 02.07.): Zuordnung global + je Aufgabe.
// PMO-FEA-0006 'extract' · WP-BILD-1c 'describe' · WP-IC-4 'group'.
const AI_TASKS = [
  "structure",
  "assist",
  "interview",
  "answer",
  "select",
  "extract",
  "describe",
  "group",
] as const;

// SCRUM-414: die vier Stufen des Reglers „externe Wissensabfrage" in Anzeige-Reihenfolge.
const EXTERNAL_STAGES: readonly ExternalKnowledgeStage[] = [
  "blocked",
  "search_on_click",
  "search_attach",
  "open",
];

// SCRUM-413: Status-Töne der KI-Zugänge — Ampel nur als ECHTER Status (CI-konform).
const ACCESS_STATE_TONE: Record<AiAccessState, string> = {
  active: "bg-trust-pos-bg text-trust-pos-text",
  available: "bg-page text-muted",
  missing: "bg-trust-warn-bg text-trust-warn-text",
  planned: "bg-page text-muted-2",
};

export function KiDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const aiConfig = useQuery({ queryKey: ["reasonerConfig"], queryFn: endpoints.reasoner.config });
  const [aiGlobal, setAiGlobal] = useState<string | null>(null);
  const [aiPerTask, setAiPerTask] = useState<Record<string, string> | null>(null);
  // Pedi-Feedback 02.07. („etwas unübersichtlich"): Feinabstimmung je Einsatz eingeklappt.
  const [showAiDetail, setShowAiDetail] = useState(false);
  const effGlobal = aiGlobal ?? aiConfig.data?.taskConfig.global ?? "auto";
  const effPerTask = aiPerTask ?? aiConfig.data?.taskConfig.perTask ?? {};
  const aiSave = useMutation({
    mutationFn: () => endpoints.reasoner.updateConfig({ global: effGlobal, perTask: effPerTask }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reasonerConfig"] });
      // AUFTRAG kimodus-live: die Topbar-Badges hängen an EIGENEN Queries — ohne diese
      // Invalidierung springt die Topbar erst nach Hard-Reload auf den neuen Modus.
      invalidateAiState(qc);
      setAiGlobal(null);
      setAiPerTask(null);
      push("success", t("adm.ai.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  // Key-Test (Pedi 02.07.): echter Mini-Modellaufruf; Ergebnis bleibt sichtbar stehen.
  const aiTest = useMutation({ mutationFn: () => endpoints.reasoner.test() });
  // SCRUM-428: separater Key-Test für den eigenen lokalen LLM.
  const aiTestLocal = useMutation({ mutationFn: () => endpoints.reasoner.testLocal() });
  // SCRUM-493/494: End-to-End-Selbsttests der Konflikt- und Duplikat-Erkennung.
  const conflictSelfTest = useMutation({ mutationFn: () => endpoints.reasoner.conflictSelfTest() });
  const dupSelfTest = useMutation({ mutationFn: () => endpoints.reasoner.duplicateSelfTest() });
  const runSelfTests = (): void => {
    conflictSelfTest.mutate();
    dupSelfTest.mutate();
  };
  const selfTestPending = conflictSelfTest.isPending || dupSelfTest.isPending;

  return (
    <Detailkarte
      titel={t("adm.ai.title")}
      onZurueck={onZurueck}
      testId="detail-ki"
      hilfe={[
        { titel: t("adm.ai.title"), text: t("adm.ai.help") },
        { titel: t("adm.ai.title"), text: t("adm.ai.internExtern") },
      ]}
    >
      <Abfragehuelle abfrage={aiConfig}>
        {(konfig) => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12.5px] text-muted">
                {t("adm.ai.status", {
                  provider: konfig.provider,
                  mode: konfig.mode === "model" ? t("adm.ai.modeModel") : t("adm.ai.modeDemo"),
                })}
              </p>
              {/* Key-Test (Pedi 02.07.): Anzeige ≠ Beweis — der Knopf macht den Echtaufruf. */}
              <button
                type="button"
                disabled={aiTest.isPending}
                onClick={() => aiTest.mutate()}
                className="inline-flex h-7 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[11.5px] font-semibold text-text hover:border-ink/30 disabled:opacity-50"
              >
                <KeyRound size={12} />
                {aiTest.isPending ? t("adm.ai.testRunning") : t("adm.ai.test")}
              </button>
              {/* SCRUM-428: zweiter Knopf — echter Mini-Aufruf beim eigenen lokalen LLM. */}
              <button
                type="button"
                disabled={aiTestLocal.isPending}
                onClick={() => aiTestLocal.mutate()}
                className="inline-flex h-7 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[11.5px] font-semibold text-text hover:border-ink/30 disabled:opacity-50"
              >
                <KeyRound size={12} />
                {aiTestLocal.isPending ? t("adm.ai.testRunning") : t("adm.ai.testLocal")}
              </button>
              {/* SCRUM-493/494: EIN Klick prüft BEIDE Erkennungsarten (Konflikt + Duplikat). */}
              <button
                type="button"
                disabled={selfTestPending}
                onClick={runSelfTests}
                className="inline-flex h-7 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[11.5px] font-semibold text-text hover:border-ink/30 disabled:opacity-50"
              >
                <KeyRound size={12} />
                {selfTestPending ? t("adm.selfTest.running") : t("adm.selfTest.button")}
              </button>
            </div>
            {aiTest.data ? (
              <p
                className={`rounded-btn px-2.5 py-1.5 text-[12px] ${
                  aiTest.data.ok
                    ? "bg-trust-pos-bg text-trust-pos-text"
                    : "bg-trust-crit-bg text-trust-crit-text"
                }`}
              >
                {aiTest.data.ok
                  ? t("adm.ai.testOk", { provider: aiTest.data.provider })
                  : t("adm.ai.testFail", { detail: aiTest.data.detail })}
              </p>
            ) : null}
            {aiTest.isError ? (
              <p className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text">
                {t("adm.ai.testFail", { detail: t("state.error") })}
              </p>
            ) : null}
            {/* SCRUM-428: Ergebnis des lokalen Key-Tests, gleiche ehrliche Darstellung. */}
            {aiTestLocal.data ? (
              <p
                className={`rounded-btn px-2.5 py-1.5 text-[12px] ${
                  aiTestLocal.data.ok
                    ? "bg-trust-pos-bg text-trust-pos-text"
                    : "bg-trust-crit-bg text-trust-crit-text"
                }`}
              >
                {aiTestLocal.data.ok
                  ? t("adm.ai.testLocalOk", { provider: aiTestLocal.data.provider })
                  : t("adm.ai.testFail", { detail: aiTestLocal.data.detail })}
              </p>
            ) : null}
            {aiTestLocal.isError ? (
              <p className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text">
                {t("adm.ai.testFail", { detail: t("state.error") })}
              </p>
            ) : null}
            {/* SCRUM-493: strukturiertes OK/FAIL des Konflikt-Selbsttests inkl. Provider + Streitpunkt. */}
            {conflictSelfTest.data ? (
              <div
                className={`rounded-btn px-2.5 py-1.5 text-[12px] ${
                  conflictSelfTest.data.ok
                    ? "bg-trust-pos-bg text-trust-pos-text"
                    : "bg-trust-crit-bg text-trust-crit-text"
                }`}
              >
                <p className="font-semibold">
                  {conflictSelfTest.data.ok ? "OK" : "FAIL"} · {t("adm.conflictSelfTest.label")}:{" "}
                  {t(conflictSelfTest.data.messageKey)}
                </p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  {t("adm.conflictSelfTest.provider", { provider: conflictSelfTest.data.provider })}
                  {conflictSelfTest.data.hasKollision && conflictSelfTest.data.streitpunkt
                    ? ` · ${t("adm.conflictSelfTest.streitpunkt", {
                        streitpunkt: conflictSelfTest.data.streitpunkt,
                      })}`
                    : ""}
                </p>
              </div>
            ) : null}
            {conflictSelfTest.isError ? (
              <p className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text">
                {t("adm.ai.testFail", { detail: t("state.error") })}
              </p>
            ) : null}
            {/* SCRUM-494: strukturiertes OK/FAIL des Duplikat-Selbsttests inkl. Provider + Beziehung. */}
            {dupSelfTest.data ? (
              <div
                className={`rounded-btn px-2.5 py-1.5 text-[12px] ${
                  dupSelfTest.data.ok
                    ? "bg-trust-pos-bg text-trust-pos-text"
                    : "bg-trust-crit-bg text-trust-crit-text"
                }`}
              >
                <p className="font-semibold">
                  {dupSelfTest.data.ok ? "OK" : "FAIL"} · {t("adm.dupSelfTest.label")}:{" "}
                  {t(dupSelfTest.data.messageKey)}
                </p>
                <p className="mt-0.5 text-[11px] opacity-90">
                  {t("adm.conflictSelfTest.provider", { provider: dupSelfTest.data.provider })}
                  {dupSelfTest.data.duplicateCreated && dupSelfTest.data.relation
                    ? ` · ${t("adm.dupSelfTest.relation", { relation: dupSelfTest.data.relation })}`
                    : ""}
                </p>
              </div>
            ) : null}
            {dupSelfTest.isError ? (
              <p className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[12px] text-trust-crit-text">
                {t("adm.ai.testFail", { detail: t("state.error") })}
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-[11.5px] font-semibold text-muted">
                {t("adm.ai.global")}
                <select
                  value={effGlobal}
                  onChange={(e) => setAiGlobal(e.target.value)}
                  className="mt-1 h-9 w-full rounded-input border border-hairline bg-surface px-2 text-[13px] font-normal text-text"
                >
                  <option value="auto">{t("adm.ai.choice.auto")}</option>
                  <option value="cloud">{t("adm.ai.choice.cloud")}</option>
                  {/* Pedi 05.07. (VIP): interne Option immer SICHTBAR — deaktiviert, solange kein
                    eigener LLM verbunden ist. */}
                  {aiConfig.data?.localConfigured ? (
                    <option value="local">{t("adm.ai.choice.local")}</option>
                  ) : (
                    <option value="local" disabled>
                      {t("adm.ai.choice.localUnavailable")}
                    </option>
                  )}
                  <option value="deterministic">{t("adm.ai.choice.deterministic")}</option>
                </select>
              </label>
            </div>
            {/* AUFTRAG kimodus-live (Variante b): kein doppeldeutiger Zustand — geänderte, noch nicht
              übernommene Auswahl sagt es; nach dem Übernehmen steht „Übernommen ✓". */}
            {aiGlobal !== null || aiPerTask !== null ? (
              <output className="block rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] font-semibold text-trust-warn-text">
                {t("adm.ai.dirtyHint")}
              </output>
            ) : aiSave.isSuccess ? (
              <output className="block rounded-btn bg-trust-pos-bg px-2.5 py-1.5 text-[12px] font-semibold text-trust-pos-text">
                {t("adm.ai.applied")}
              </output>
            ) : null}
            <button
              type="button"
              aria-expanded={showAiDetail || Object.keys(effPerTask).length > 0}
              onClick={() => setShowAiDetail((s) => !s)}
              className="flex w-full items-center justify-between gap-2 border-t border-hairline pt-2.5 text-left"
            >
              <span className="text-[12.5px] font-semibold text-text">
                {t("adm.ai.detail")}
                {Object.keys(effPerTask).length > 0 ? (
                  <span className="ml-1.5 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-muted-2">
                    {Object.keys(effPerTask).length}
                  </span>
                ) : null}
              </span>
              <span className="text-[11px] text-muted-2">{t("adm.ai.detailHint")}</span>
            </button>
            {showAiDetail || Object.keys(effPerTask).length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {AI_TASKS.map((task) => (
                  <label key={task} className="block text-[11.5px] font-semibold text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      {t(`adm.ai.task.${task}`)}
                      <span
                        className={`rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${
                          aiConfig.data?.effective[task] === "model"
                            ? "bg-ai-surface-1 text-ai"
                            : "bg-page text-muted-2"
                        }`}
                      >
                        {/* SCRUM-424: ehrlich zeigen, WELCHE KI zuerst arbeitet. */}
                        {t(
                          `adm.ai.eff.${aiConfig.data?.effectiveProvider[task] ?? "deterministic"}`,
                        )}
                      </span>
                    </span>
                    <select
                      value={effPerTask[task] ?? ""}
                      onChange={(e) =>
                        setAiPerTask({
                          ...effPerTask,
                          ...(e.target.value
                            ? { [task]: e.target.value }
                            : (() => {
                                const cp = { ...effPerTask };
                                delete cp[task];
                                return cp;
                              })()),
                        })
                      }
                      className="mt-1 h-9 w-full rounded-input border border-hairline bg-surface px-2 text-[13px] font-normal text-text"
                    >
                      <option value="">{t("adm.ai.choice.inherit")}</option>
                      <option value="auto">{t("adm.ai.choice.auto")}</option>
                      <option value="cloud">{t("adm.ai.choice.cloud")}</option>
                      {aiConfig.data?.localConfigured ? (
                        <option value="local">{t("adm.ai.choice.local")}</option>
                      ) : (
                        <option value="local" disabled>
                          {t("adm.ai.choice.localUnavailable")}
                        </option>
                      )}
                      <option value="deterministic">{t("adm.ai.choice.deterministic")}</option>
                    </select>
                  </label>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                disabled={aiSave.isPending || (aiGlobal === null && aiPerTask === null)}
                onClick={() => aiSave.mutate()}
              >
                <Sparkles size={14} />
                {t("adm.ai.save")}
              </Button>
              <span className="text-[11px] text-muted-2">{t("adm.ai.persistNote")}</span>
            </div>
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** SCRUM-413: „Verfügbare KIs" — ehrliche Übersicht aus dem echten configStatus. */
export function KiZugaengeDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const aiConfig = useQuery({ queryKey: ["reasonerConfig"], queryFn: endpoints.reasoner.config });
  return (
    <Detailkarte
      titel={t("adm.ai.accessTitle")}
      onZurueck={onZurueck}
      testId="detail-ki-zugaenge"
      hilfe={[{ titel: t("adm.ai.accessTitle"), text: t("adm.ai.accessHelp") }]}
    >
      <Abfragehuelle abfrage={aiConfig}>
        {(konfig) => (
          <ul className="space-y-2">
            {aiAccessRows(konfig).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-card border border-hairline p-2.5"
              >
                <span className="text-[13px] font-semibold text-text">
                  {t(`adm.ai.access.${row.id}`)}
                </span>
                {row.detail ? (
                  <span className="font-mono text-[11px] text-muted-2">{row.detail}</span>
                ) : null}
                <span
                  className={`ml-auto rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${ACCESS_STATE_TONE[row.state]}`}
                >
                  {t(`adm.ai.state.${row.state}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Abfragehuelle>
      <p className="text-[11px] text-muted-2">{t("adm.ai.accessNote")}</p>
    </Detailkarte>
  );
}

/** SCRUM-386: kundeneigene KI-Funktionen (Presets) für die Editor-Palette. */
export function KiFunktionenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const presetsQuery = useQuery({
    queryKey: ["reasoner", "assistPresets"],
    queryFn: endpoints.reasoner.assistPresets,
  });
  const [presetDraft, setPresetDraft] = useState<
    { id?: string; name: string; instruction: string }[] | null
  >(null);
  const effPresets = presetDraft ?? presetsQuery.data ?? [];
  const presetsSave = useMutation({
    mutationFn: () =>
      endpoints.reasoner.updateAssistPresets(
        effPresets.map((p) => ({
          ...(p.id ? { id: p.id } : {}),
          name: p.name,
          instruction: p.instruction,
        })),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reasoner", "assistPresets"] });
      setPresetDraft(null);
      push("success", t("adm.presets.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <Detailkarte
      titel={t("adm.presets.title")}
      onZurueck={onZurueck}
      testId="detail-ki-funktionen"
      hilfe={[
        { titel: t("adm.presets.title"), text: t("adm.presets.help") },
        { titel: t("adm.presets.title"), text: t("adm.presets.hint") },
      ]}
    >
      {/* Die Hülle steht VOR der Liste und vor dem Speichern-Knopf: ohne geladenen Bestand wäre
          `effPresets` leer, „keine eigenen Funktionen" wäre eine Behauptung ohne Antwort — und ein
          Klick auf Speichern würde die serverseitige Liste mit dieser Leere überschreiben. */}
      <Abfragehuelle abfrage={presetsQuery}>
        {() => (
          <>
            {effPresets.length === 0 ? (
              <p className="text-[12.5px] text-muted-2">{t("adm.presets.empty")}</p>
            ) : (
              <ul className="space-y-2">
                {effPresets.map((p, i) => (
                  <li
                    key={p.id ?? `neu-${i}`}
                    className="rounded-card border border-hairline p-2.5"
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                      <TextInput
                        value={p.name}
                        onChange={(e) =>
                          setPresetDraft(
                            effPresets.map((x, xi) =>
                              xi === i ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder={t("adm.presets.name")}
                        aria-label={t("adm.presets.name")}
                      />
                      <TextInput
                        value={p.instruction}
                        onChange={(e) =>
                          setPresetDraft(
                            effPresets.map((x, xi) =>
                              xi === i ? { ...x, instruction: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder={t("adm.presets.instruction")}
                        aria-label={t("adm.presets.instruction")}
                      />
                      <button
                        type="button"
                        title={t("adm.presets.remove")}
                        onClick={() => setPresetDraft(effPresets.filter((_, xi) => xi !== i))}
                        className="grid h-9 w-9 place-items-center justify-self-end rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                disabled={effPresets.length >= 12}
                onClick={() => setPresetDraft([...effPresets, { name: "", instruction: "" }])}
              >
                {t("adm.presets.add")}
              </Button>
              <Button
                variant="primary"
                disabled={presetsSave.isPending || presetDraft === null}
                onClick={() => presetsSave.mutate()}
              >
                <Sparkles size={14} />
                {t("adm.presets.save")}
              </Button>
              <span className="text-[11px] text-muted-2">{t("adm.presets.note")}</span>
            </div>
          </>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/**
 * SCRUM-395 + SCRUM-421: „Prüfungen und Grenzen" — Standard-Prüferanzahl und Upload-Grenzen. Beide
 * standen bisher im Reiter „Daten"; sie gehören zu dem, was die Prüfung und die KI verarbeiten.
 */
export function KiGrenzenDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const valSettings = useQuery({
    queryKey: ["validation", "settings"],
    queryFn: endpoints.validation.settings,
  });
  const [defaultNeededDraft, setDefaultNeededDraft] = useState<string | null>(null);
  const saveDefaultNeeded = useMutation({
    mutationFn: () =>
      endpoints.validation.saveSettings(parseNeededValidations(defaultNeededDraft ?? "")),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["validation", "settings"] });
      setDefaultNeededDraft(null);
      push("success", t("adm.val.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  // E2E-005 / bens Auflage D4: EXAKT derselbe Vertrag wie der Server — eine ECHTE ganze Zahl 1–5.
  // (`Number.parseInt` nahm „1.5"/„1x" fälschlich als 1 an; eine Quelle: parseNeededValidations.)
  const neededEffective =
    defaultNeededDraft ?? String(valSettings.data?.defaultNeededValidations ?? "");
  const neededParsed = parseNeededValidations(neededEffective);
  const neededValid = Number.isInteger(neededParsed) && neededParsed >= 1 && neededParsed <= 5;

  const uploadLimitsQ = useQuery({
    queryKey: ["upload-limits"],
    queryFn: endpoints.uploadLimits.get,
  });
  const [maxAttDraft, setMaxAttDraft] = useState<string | null>(null);
  const [maxMbDraft, setMaxMbDraft] = useState<string | null>(null);
  const saveUploadLimits = useMutation({
    mutationFn: () =>
      endpoints.uploadLimits.save({
        maxAttachments: Number.parseInt(
          maxAttDraft ?? String(uploadLimitsQ.data?.maxAttachments ?? 8),
          10,
        ),
        maxAttachmentBytes: Math.round(
          Number.parseFloat(
            maxMbDraft ??
              String((uploadLimitsQ.data?.maxAttachmentBytes ?? 20_000_000) / 1_000_000),
          ) * 1_000_000,
        ),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["upload-limits"] });
      setMaxAttDraft(null);
      setMaxMbDraft(null);
      push("success", t("adm.upload.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <Detailkarte
      titel={t("einst.ki.grenzen")}
      onZurueck={onZurueck}
      testId="detail-ki-grenzen"
      hilfe={[
        { titel: t("adm.val.title"), text: t("adm.val.help") },
        { titel: t("adm.val.title"), text: t("adm.val.hint") },
        { titel: t("adm.upload.title"), text: t("adm.upload.help") },
        { titel: t("adm.upload.title"), text: t("adm.upload.hint") },
      ]}
    >
      {/* Zwei Quellen, zwei Hüllen: die Prüferanzahl und die Upload-Grenzen scheitern unabhängig
          voneinander, und ein Feld ohne geladenen Wert wäre eine leere Behauptung. */}
      <Abfragehuelle abfrage={valSettings} testId="huelle-pruefanzahl">
        {() => (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Field label={t("adm.val.label")}>
                <TextInput
                  type="number"
                  min={1}
                  max={5}
                  className="w-24"
                  value={neededEffective}
                  onChange={(e) => setDefaultNeededDraft(e.target.value)}
                  aria-label={t("adm.val.label")}
                  aria-invalid={!neededValid}
                  aria-describedby="adm-val-error"
                />
              </Field>
              <Button
                variant="primary"
                disabled={
                  saveDefaultNeeded.isPending || defaultNeededDraft === null || !neededValid
                }
                onClick={() => saveDefaultNeeded.mutate()}
              >
                {t("adm.val.save")}
              </Button>
            </div>
            {/* E2E-005: zugängliche, deutsche Fehlermeldung, sobald der Wert ungültig ist (z. B. 0). */}
            <output
              id="adm-val-error"
              aria-live="polite"
              className="block text-[12px] text-trust-crit-text"
            >
              {neededValid ? "" : t("adm.val.invalid")}
            </output>
          </>
        )}
      </Abfragehuelle>

      <Abfragehuelle abfrage={uploadLimitsQ} testId="huelle-uploadgrenzen">
        {() => (
          <div className="flex flex-wrap items-end gap-2 border-t border-hairline pt-4">
            <Field label={t("adm.upload.maxAttachments")}>
              <TextInput
                type="number"
                min={1}
                max={30}
                className="w-24"
                value={maxAttDraft ?? String(uploadLimitsQ.data?.maxAttachments ?? "")}
                onChange={(e) => setMaxAttDraft(e.target.value)}
                aria-label={t("adm.upload.maxAttachments")}
              />
            </Field>
            <Field label={t("adm.upload.maxMb")}>
              <TextInput
                type="number"
                min={0.1}
                step={0.1}
                className="w-24"
                value={
                  maxMbDraft ??
                  String((uploadLimitsQ.data?.maxAttachmentBytes ?? 20_000_000) / 1_000_000)
                }
                onChange={(e) => setMaxMbDraft(e.target.value)}
                aria-label={t("adm.upload.maxMb")}
              />
              {/* AUFTRAG-mega15 Block E: der eingestellte Wert misst die ÜBERTRAGENE Daten-URL; hier
              steht, was das an reiner Dateigröße bedeutet — am gerade eingetippten Entwurfswert. */}
              <p data-testid="upload-raw-limit" className="mt-1 text-[11px] text-muted-2">
                {t("adm.upload.rawHint", {
                  raw: maxRawAttachmentMb(
                    Math.round(
                      Number.parseFloat(
                        maxMbDraft ??
                          String(
                            (uploadLimitsQ.data?.maxAttachmentBytes ?? 20_000_000) / 1_000_000,
                          ),
                      ) * 1_000_000,
                    ) || 0,
                  ),
                })}
              </p>
            </Field>
            <Button
              variant="primary"
              disabled={saveUploadLimits.isPending || (maxAttDraft === null && maxMbDraft === null)}
              onClick={() => saveUploadLimits.mutate()}
            >
              {t("adm.upload.save")}
            </Button>
          </div>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** SCRUM-414: Regler „externe Wissensabfrage" — vier Stufen von blockiert bis offen. */
export function KiExternDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const extPolicy = useQuery({
    queryKey: ["external", "policy"],
    queryFn: endpoints.external.policy,
  });
  const [extPolicyDraft, setExtPolicyDraft] = useState<ExternalKnowledgeStage | null>(null);
  const saveExtPolicy = useMutation({
    mutationFn: () => endpoints.external.savePolicy(extPolicyDraft ?? "search_on_click"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["external", "policy"] });
      setExtPolicyDraft(null);
      push("success", t("adm.ext.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <Detailkarte
      titel={t("adm.ext.title")}
      onZurueck={onZurueck}
      testId="detail-ki-extern"
      hilfe={[
        { titel: t("adm.ext.title"), text: t("adm.ext.help") },
        { titel: t("adm.ext.title"), text: t("adm.ext.hint") },
      ]}
    >
      <Abfragehuelle abfrage={extPolicy}>
        {(politik) => (
          <div className="space-y-1.5">
            {EXTERNAL_STAGES.map((stage) => {
              const active = (extPolicyDraft ?? politik.stage) === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setExtPolicyDraft(stage)}
                  aria-pressed={active}
                  className={`flex w-full items-start gap-2 rounded-card border px-3 py-2 text-left transition-colors ${
                    active ? "border-ink bg-hairline-soft" : "border-hairline hover:border-ink/30"
                  }`}
                >
                  <span
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border ${
                      active ? "border-ink bg-ink" : "border-hairline"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-text">
                      {t(`adm.ext.stage.${stage}`)}
                    </span>
                    <span className="block text-[11.5px] text-muted">
                      {t(`adm.ext.stageHint.${stage}`)}
                    </span>
                  </span>
                </button>
              );
            })}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="primary"
                disabled={
                  saveExtPolicy.isPending ||
                  extPolicyDraft === null ||
                  extPolicyDraft === politik.stage
                }
                onClick={() => saveExtPolicy.mutate()}
              >
                {t("adm.ext.save")}
              </Button>
              <span className="text-[11px] text-muted-2">{t("adm.ext.note")}</span>
            </div>
          </div>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}

/** Pedi 04.07.: Anzeige-Schwelle der Duplikat-Erkennung (UI in Prozent, Backend als Anteil 0..1). */
export function KiDupDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { push } = useToast();
  const dupSettingsQ = useQuery({
    queryKey: ["duplicates", "settings"],
    queryFn: endpoints.duplicates.settings,
  });
  const [dupThresholdDraft, setDupThresholdDraft] = useState<string | null>(null);
  const saveDupSettings = useMutation({
    mutationFn: () =>
      endpoints.duplicates.saveSettings(
        Math.round(
          Number.parseFloat(
            dupThresholdDraft ??
              String(Math.round((dupSettingsQ.data?.minConfidence ?? 0.5) * 100)),
          ),
        ) / 100,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["duplicates", "settings"] });
      setDupThresholdDraft(null);
      push("success", t("adm.dup.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  return (
    <Detailkarte
      titel={t("adm.dup.title")}
      onZurueck={onZurueck}
      testId="detail-ki-dup"
      hilfe={[
        { titel: t("adm.dup.title"), text: t("adm.dup.help") },
        { titel: t("adm.dup.title"), text: t("adm.dup.hint") },
      ]}
    >
      <Abfragehuelle abfrage={dupSettingsQ}>
        {(einstellung) => (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("adm.dup.threshold")}>
              <TextInput
                type="number"
                min={5}
                max={99}
                step={1}
                className="w-24"
                value={dupThresholdDraft ?? String(Math.round(einstellung.minConfidence * 100))}
                onChange={(e) => setDupThresholdDraft(e.target.value)}
                aria-label={t("adm.dup.threshold")}
              />
            </Field>
            <Button
              variant="primary"
              disabled={saveDupSettings.isPending || dupThresholdDraft === null}
              onClick={() => saveDupSettings.mutate()}
            >
              {t("adm.dup.save")}
            </Button>
          </div>
        )}
      </Abfragehuelle>
    </Detailkarte>
  );
}
