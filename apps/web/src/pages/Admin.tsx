import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  KeyRound,
  Power,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useAnalytics, useAudit, useUsers, useValidationBoard } from "../api/hooks";
import type { DemoSeedResult, ExternalKnowledgeStage } from "../api/types";
import { useToast } from "../app/ToastContext";
import { ROLES, type Role } from "../app/navigation";
import { HelpTip } from "../components/HelpTip";
import {
  Button,
  Card,
  Field,
  PageHeader,
  QueryState,
  SectionLabel,
  TextInput,
} from "../components/ui";
import {
  isPasswordResetValid,
  isUserAuditAction,
  newUserIssues,
  passwordRepeatMismatch,
} from "../lib/adminForms";
import { ADMIN_SECTIONS, type AdminSectionId, DEFAULT_ADMIN_SECTION } from "../lib/adminSections";
// SCRUM-413: „Verfügbare KIs" — DOM-freie Zeilen aus dem echten configStatus.
import { type AiAccessState, aiAccessRows } from "../lib/aiOverview";
import { PILOT_NEXT_STEPS } from "../lib/pilotNextSteps";
import { SECURITY_POINTS } from "../lib/securityStatements";
import { type ReadinessTone, readinessRows } from "../lib/vipReadiness";

const EMPTY_NEW_USER = { name: "", email: "", password: "", role: "experte" as Role };

// SCRUM-437: Ampel-Klassen für die Bereitschafts-Zeilen (info = ruhige, wertungsfreie Zahl).
const READY_TONE_CLASS: Record<ReadinessTone, string> = {
  ok: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
  info: "bg-page text-muted",
};

// SCRUM-440: nur den markierten Auszug drucken — eine Body-Klasse isoliert den Druck (via CSS),
// damit normales Strg+P auf anderen Seiten unberührt bleibt. Klasse nach dem Druck wieder entfernen.
function printExtract(): void {
  document.body.classList.add("printing-extract");
  window.addEventListener("afterprint", () => document.body.classList.remove("printing-extract"), {
    once: true,
  });
  window.print();
}

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

export function Admin(): JSX.Element {
  const { t, i18n } = useTranslation();
  const query = useUsers();
  const audit = useAudit();
  // SCRUM-437: Live-Zahlen für die Bereitschafts-Checkliste (dedupt mit vorhandenen Queries).
  const analytics = useAnalytics();
  const board = useValidationBoard();
  const qc = useQueryClient();
  const { push } = useToast();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["users"] });
  const fail = (e: unknown) => push("error", e instanceof ApiError ? e.message : t("state.error"));

  const [newUser, setNewUser] = useState({ ...EMPTY_NEW_USER });
  // Sicherheit: Passwort-Bestätigung bei der Nutzeranlage (Vertipper-Schutz, analog Reset).
  const [newUserPw2, setNewUserPw2] = useState("");
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  // SCRUM-455: Wiederholung des neuen Passworts (Vertipper-Schutz).
  const [resetPw2, setResetPw2] = useState("");

  const create = useMutation({
    mutationFn: () =>
      endpoints.users.create(
        newUser.name.trim(),
        newUser.email.trim(),
        newUser.password,
        newUser.role,
      ),
    onSuccess: () => {
      invalidate();
      setNewUser({ ...EMPTY_NEW_USER });
      setNewUserPw2("");
      push("success", t("adm.created"));
    },
    onError: fail,
  });

  const approve = useMutation({
    mutationFn: (id: string) => endpoints.users.approve(id),
    onSuccess: invalidate,
    onError: fail,
  });
  const setRole = useMutation({
    mutationFn: (v: { id: string; role: Role }) => endpoints.users.setRole(v.id, v.role),
    onSuccess: invalidate,
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => endpoints.users.remove(id),
    onSuccess: invalidate,
    onError: fail,
  });
  const reset = useMutation({
    mutationFn: (v: { id: string; password: string }) =>
      endpoints.users.resetPassword(v.id, v.password),
    onSuccess: () => {
      setResetId(null);
      setResetPw("");
      setResetPw2("");
      push("success", t("adm.resetDone"));
    },
    onError: fail,
  });

  // SCRUM-181: Demodaten in eine LEERE Instanz laden (admin-only). Ehrliche skipped/seeded-Meldung.
  const demoSeed = useMutation<DemoSeedResult, unknown, boolean | undefined>({
    // Pedi 05.07. (Beta): force lädt das Demo-Set auch bei bereits erfassten Daten.
    // SCRUM-487: Demo-Sprache = aktuelle UI-Sprache des ladenden Admins.
    mutationFn: (force) => endpoints.admin.demoSeed(force ?? false, i18n.language),
    onSuccess: (r) => {
      for (const key of [
        ["users"],
        ["kos"],
        ["gaps"],
        ["conflicts"],
        ["validation"],
        ["notifications"],
        ["analytics"],
        ["evidence"],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      if (r.skipped) {
        push("info", t("adm.seedSkipped"));
      } else {
        push("success", t("adm.seedDone", { kos: r.kos, users: r.users }));
      }
    },
    onError: fail,
  });

  // Pedi 02.07.: Demodaten komplett entfernen (Merker überlebt Tester-Bearbeitungen).
  const [confirmPurge, setConfirmPurge] = useState(false);
  const demoPurge = useMutation({
    mutationFn: () => endpoints.admin.demoPurge(),
    onSuccess: (r) => {
      for (const key of [
        ["kos"],
        ["validation"],
        ["notifications"],
        ["analytics"],
        ["evidence"],
        ["conflicts"],
        // Bug (Pedi 04.07.): auch Wissenslücken/Aufgaben-Sichten auffrischen, sonst bleibt die
        // gelöschte Demo-Lücke in Risiko & Lücken / Meine Aufgaben stehen, bis man neu lädt.
        ["gaps"],
        ["tasks"],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      setConfirmPurge(false);
      push(
        "success",
        t("adm.purgeDone", { kos: r.kos, conflicts: r.conflicts, gaps: r.gaps, users: r.users }),
      );
    },
    onError: fail,
  });

  // Pedi 05.07. (Beta): Werksreset. Verfügbarkeit nur im Desktop/Dev-Modus (Server sagt es ehrlich).
  // Doppelte Rückfrage im UI; die Ausführung löscht alles und beendet das Programm.
  const factoryResetStatus = useQuery({
    queryKey: ["factory-reset-status"],
    queryFn: endpoints.admin.factoryResetStatus,
  });
  // Zwei-Stufen-Bestätigung: "" (aus) → "armed" (Passwort + erste Rückfrage) → "confirm" (große Warnung).
  const [factoryStep, setFactoryStep] = useState<"" | "armed" | "confirm">("");
  // SCRUM-450: Re-Authentifizierung — der Admin muss vor dem unwiderruflichen Reset sein Passwort bestätigen.
  const [factoryPw, setFactoryPw] = useState("");
  const [factoryDone, setFactoryDone] = useState(false);
  const cancelFactory = () => {
    setFactoryStep("");
    setFactoryPw("");
  };
  const factoryReset = useMutation({
    mutationFn: (password: string) => endpoints.admin.factoryReset(password),
    onSuccess: () => {
      // Der Server beendet sich unmittelbar danach — die Oberfläche zeigt einen Neustart-Hinweis.
      setFactoryStep("");
      setFactoryPw("");
      setFactoryDone(true);
      push("success", t("adm.factoryDone"));
    },
    // SCRUM-450: Falsches Passwort → zurück zur Eingabe (Passwort leeren) mit klarer Meldung.
    onError: () => {
      setFactoryStep("armed");
      setFactoryPw("");
      push("error", t("adm.factory.wrongPassword"));
    },
  });

  // KI-Verwaltung v1 (Pedi 02.07., Teil-Slice des PMO-Eintrags): Zuordnung global + je
  // Aufgabe. Keys bleiben serverseitig; v1 gilt bis zum Neustart (ehrlich angezeigt).
  // PMO-FEA-0006: 'extract' (Wissen aus Datei) als weiterer KI-Einsatz konfigurierbar.
  const AI_TASKS = ["structure", "assist", "interview", "answer", "select", "extract"] as const;
  const aiConfig = useQuery({ queryKey: ["reasonerConfig"], queryFn: endpoints.reasoner.config });
  const [aiGlobal, setAiGlobal] = useState<string | null>(null);
  const [aiPerTask, setAiPerTask] = useState<Record<string, string> | null>(null);
  // Pedi-Feedback 02.07. („etwas unübersichtlich"): Feinabstimmung je Einsatz eingeklappt —
  // sichtbar bleibt nur die EINE Frage nach dem Standard. Offen nur, wenn Overrides existieren.
  const [showAiDetail, setShowAiDetail] = useState(false);
  const effGlobal = aiGlobal ?? aiConfig.data?.taskConfig.global ?? "auto";
  const effPerTask = aiPerTask ?? aiConfig.data?.taskConfig.perTask ?? {};
  const aiSave = useMutation({
    mutationFn: () => endpoints.reasoner.updateConfig({ global: effGlobal, perTask: effPerTask }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reasonerConfig"] });
      setAiGlobal(null);
      setAiPerTask(null);
      push("success", t("adm.ai.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  // Key-Test (Pedi 02.07.): echter Mini-Modellaufruf; Ergebnis bleibt sichtbar stehen
  // (Inline statt flüchtigem Toast) — ehrlich inkl. Grund bei Fehlschlag (z. B. 401).
  const aiTest = useMutation({ mutationFn: () => endpoints.reasoner.test() });
  // SCRUM-428: separater Key-Test für den eigenen lokalen LLM.
  const aiTestLocal = useMutation({ mutationFn: () => endpoints.reasoner.testLocal() });
  // SCRUM-493: End-to-End-Selbsttest der Konflikterkennung — beweist judgeConflict + kollision im
  // deployten Stand (der einzige verlässliche Check; die Sidebar „aktiv" prüft nur Key-Präsenz).
  const conflictSelfTest = useMutation({ mutationFn: () => endpoints.reasoner.conflictSelfTest() });
  // SCRUM-494: End-to-End-Selbsttest der Duplikat-Erkennung — beweist judgeDuplicate am reifen-Fall
  // (semantisch gleich, lexikalisch verschieden), den der deterministische Ersatzmodus nicht sieht.
  const dupSelfTest = useMutation({ mutationFn: () => endpoints.reasoner.duplicateSelfTest() });
  // SCRUM-494: EIN Klick prüft BEIDE Erkennungsarten (Konflikt + Duplikat); beide Ergebnisse darunter.
  const runSelfTests = () => {
    conflictSelfTest.mutate();
    dupSelfTest.mutate();
  };
  const selfTestPending = conflictSelfTest.isPending || dupSelfTest.isPending;
  // SCRUM-386: kundeneigene KI-Assist-Funktionen (Presets) — lokal editieren, als Ganzes
  // speichern (Replace-Semantik der Route). Die Werks-Funktionen (klarer/strukturieren/…)
  // bleiben unangetastet im Code; hier entstehen NUR zusätzliche, instanz-eigene Funktionen.
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
  // SCRUM-395: Standard-Prüferanzahl (1–5) — Draft-Muster wie bei den Presets:
  // null = keine ungespeicherte Änderung, Anzeige folgt dem Server-Wert.
  const valSettings = useQuery({
    queryKey: ["validation", "settings"],
    queryFn: endpoints.validation.settings,
  });
  const [defaultNeededDraft, setDefaultNeededDraft] = useState<string | null>(null);
  const saveDefaultNeeded = useMutation({
    mutationFn: () =>
      endpoints.validation.saveSettings(Number.parseInt(defaultNeededDraft ?? "", 10)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["validation", "settings"] });
      setDefaultNeededDraft(null);
      push("success", t("adm.val.saved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // SCRUM-422: Papierkorb — Liste + Wiederherstellen + bewusste Endlöschung (Inline-Rückfrage).
  const trash = useQuery({ queryKey: ["kos", "trash"], queryFn: endpoints.ko.trash });
  const [confirmTrashPurgeId, setConfirmTrashPurgeId] = useState<string | null>(null);
  const invalidateTrash = () => {
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["validation"] });
  };
  const trashRestore = useMutation({
    mutationFn: (id: string) => endpoints.ko.restore(id),
    onSuccess: () => {
      invalidateTrash();
      push("success", t("adm.trash.restored"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const trashPurge = useMutation({
    mutationFn: (id: string) => endpoints.ko.purge(id),
    onSuccess: () => {
      setConfirmTrashPurgeId(null);
      invalidateTrash();
      push("success", t("adm.trash.purged"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const userName = (id: string): string => query.data?.find((u) => u.id === id)?.name ?? id;
  const daysLeft = (expiresAt: string): number =>
    Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86_400_000));

  // SCRUM-421: einstellbare Upload-Grenzen (Anzahl + Größe je Anhang, MB in der UI).
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
            maxMbDraft ?? String((uploadLimitsQ.data?.maxAttachmentBytes ?? 700_000) / 1_000_000),
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

  // SCRUM-414: Regler „externe Wissensabfrage" (4 Stufen) — Draft-Muster wie die Presets.
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

  // Pedi 04.07.: Anzeige-Schwelle der Duplikat-Erkennung. In der UI in Prozent (5–99), im Backend
  // als Anteil 0..1. „Niedriger = mehr Treffer, aber mehr Fehlalarme zum Wegklicken."
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

  // SCRUM-439: aktive Integritätsprüfung der Audit-Kette (Admin-Sicherheitsbereich). Echte
  // Verifikation statt bloßer Aussage — starkes Investoren-Signal.
  const verifyAudit = useMutation({
    mutationFn: () => endpoints.audit.verify(),
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // SCRUM-394: aktiver Admin-Bereich (Konten · KI · Daten).
  const [section, setSection] = useState<AdminSectionId>(DEFAULT_ADMIN_SECTION);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader kicker={t("adm.kicker")} title={t("nav.admin")} />

      {/* SCRUM-394 (Pedi): drei ruhige Bereiche statt Kartenwand — Konten · KI · Daten.
          Nichts entfernt, nur gruppiert; Wechsel rein clientseitig. */}
      <div className="flex flex-wrap items-center gap-2">
        {ADMIN_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={section === s.id}
            onClick={() => setSection(s.id)}
            className={`rounded-pill px-3.5 py-1.5 font-mono text-[12px] font-semibold transition-colors ${
              section === s.id ? "bg-ink text-white" : "bg-surface text-muted hover:text-text"
            }`}
          >
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      {section === "daten" ? (
        <>
          {/* SCRUM-181: Demodaten laden (nur leere Instanz; idempotent, ehrliche Rückmeldung). */}
          <Card className="space-y-2">
            <SectionLabel>{t("adm.seedTitle")}</SectionLabel>
            <p className="text-[12.5px] text-muted">{t("adm.seedHint")}</p>
            <div>
              <Button
                variant="ghost"
                disabled={demoSeed.isPending}
                onClick={() => demoSeed.mutate(false)}
              >
                <UserPlus size={15} />
                {t("adm.seedButton")}
              </Button>
              {/* SCRUM-412 (CI): Bestätigung = neutrale Fläche; Rot nur am destruktiven Knopf. */}
              {confirmPurge ? (
                <span className="ml-2 inline-flex items-center gap-2 rounded-card border border-hairline bg-page px-2.5 py-1.5">
                  <span className="text-[12px] font-semibold text-text">{t("adm.purgeQ")}</span>
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-muted hover:text-text"
                    onClick={() => setConfirmPurge(false)}
                  >
                    {t("adm.purgeKeep")}
                  </button>
                  <button
                    type="button"
                    disabled={demoPurge.isPending}
                    className="text-[12px] font-semibold text-trust-crit-text"
                    onClick={() => demoPurge.mutate()}
                  >
                    {t("adm.purgeYes")}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmPurge(true)}
                  className="ml-2 rounded-btn px-3 py-2 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                >
                  <Trash2 size={14} className="mr-1 inline" />
                  {t("adm.purgeButton")}
                </button>
              )}
            </div>
            {/* SCRUM-306: nach erfolgreichem Seed (nicht übersprungen) sichtbare Next-Steps in den Stage-1-
            Lauf — keine automatische Weiterleitung, nur vorhandene Routen. Ohne Seed unverändert. */}
            {demoSeed.isSuccess && demoSeed.data?.skipped ? (
              <div className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
                <p>{t("adm.seedSkippedInline")}</p>
                {/* Pedi 05.07. (Beta): Demo-Set trotzdem laden — vorhandenes Demo-Set wird zuerst
                    aufgeräumt, echte Daten bleiben unberührt. */}
                <button
                  type="button"
                  disabled={demoSeed.isPending}
                  onClick={() => demoSeed.mutate(true)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-btn border border-trust-warn-text/30 px-2.5 py-1 font-semibold text-trust-warn-text hover:bg-trust-warn-text/10 disabled:opacity-50"
                >
                  <UserPlus size={13} />
                  {t("adm.seedForce")}
                </button>
              </div>
            ) : null}
            {demoSeed.isSuccess && !demoSeed.data?.skipped ? (
              <div className="mt-1 rounded-card border border-hairline bg-page p-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
                  {t("pilot.next.title")}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {t("pilot.next.hint")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PILOT_NEXT_STEPS.map((step) => (
                    <Link
                      key={step.id}
                      to={step.to}
                      className="inline-flex items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 py-1 text-[12px] font-semibold text-text hover:border-ink/30"
                    >
                      {t(step.labelKey)}
                      <ArrowRight size={13} />
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          {/* Pedi 05.07. (Beta): Werksreset — nur im Desktop/Dev-Modus. Löscht ALLE Daten und
              beendet das Programm; nächster Start = Ersteinrichtung (erster Anwender = Admin).
              Doppelte Rückfrage, damit nichts versehentlich passiert. */}
          {factoryResetStatus.data?.available ? (
            <Card className="space-y-2 border-trust-crit-text/25">
              <div className="flex items-center gap-1.5">
                <SectionLabel>{t("adm.factory.title")}</SectionLabel>
                <HelpTip title={t("adm.factory.title")} body={t("adm.factory.help")} />
              </div>
              <p className="text-[12.5px] text-muted">{t("adm.factory.hint")}</p>
              {factoryDone ? (
                <p className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
                  {t("adm.factory.restartHint")}
                </p>
              ) : factoryStep === "" ? (
                <button
                  type="button"
                  onClick={() => setFactoryStep("armed")}
                  className="inline-flex items-center gap-1.5 rounded-btn px-3 py-2 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                >
                  <RotateCcw size={14} />
                  {t("adm.factory.button")}
                </button>
              ) : factoryStep === "armed" ? (
                // SCRUM-450: Stufe 1 — Passwort-Bestätigung (Re-Authentifizierung).
                <div className="space-y-2 rounded-card border border-hairline bg-page px-3 py-2.5">
                  <span className="block text-[12.5px] font-semibold text-text">
                    {t("adm.factory.confirm1")}
                  </span>
                  <Field label={t("adm.factory.passwordLabel")}>
                    <TextInput
                      type="password"
                      value={factoryPw}
                      autoComplete="current-password"
                      onChange={(e) => setFactoryPw(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-muted hover:text-text"
                      onClick={cancelFactory}
                    >
                      {t("adm.factory.cancel")}
                    </button>
                    <button
                      type="button"
                      disabled={factoryPw.trim().length === 0}
                      className="text-[12px] font-semibold text-trust-crit-text disabled:opacity-40"
                      onClick={() => setFactoryStep("confirm")}
                    >
                      {t("adm.factory.continue")}
                    </button>
                  </div>
                </div>
              ) : (
                // SCRUM-450: Stufe 2 — große, unübersehbare Warnung vor dem unwiderruflichen Schritt.
                <div className="space-y-2.5 rounded-card border border-trust-crit-text/40 bg-trust-crit-bg px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="shrink-0 text-trust-crit-text" />
                    <span className="text-[14px] font-bold text-trust-crit-text">
                      {t("adm.factory.confirm2")}
                    </span>
                  </div>
                  <p className="text-[12.5px] leading-snug text-trust-crit-text/90">
                    {t("adm.factory.warnBody")}
                  </p>
                  <div className="flex items-center gap-3 pt-0.5">
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-muted hover:text-text"
                      onClick={cancelFactory}
                    >
                      {t("adm.factory.cancel")}
                    </button>
                    <button
                      type="button"
                      disabled={factoryReset.isPending}
                      className="inline-flex items-center gap-1 rounded-btn bg-trust-crit-text px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                      onClick={() => factoryReset.mutate(factoryPw)}
                    >
                      <Power size={13} />
                      {t("adm.factory.execute")}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ) : null}

          {/* SCRUM-395: Standard-Prüferanzahl — gilt für neue Einreichungen ohne eigene
              Angabe (1–5). Persistiert; Änderungen landen im Audit-Log. */}
          <Card className="space-y-2">
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("adm.val.title")}</SectionLabel>
              <HelpTip title={t("adm.val.title")} body={t("adm.val.help")} />
            </div>
            <p className="text-[12.5px] text-muted">{t("adm.val.hint")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Field label={t("adm.val.label")}>
                <TextInput
                  type="number"
                  min={1}
                  max={5}
                  className="w-24"
                  value={
                    defaultNeededDraft ?? String(valSettings.data?.defaultNeededValidations ?? "")
                  }
                  onChange={(e) => setDefaultNeededDraft(e.target.value)}
                  aria-label={t("adm.val.label")}
                />
              </Field>
              <Button
                variant="primary"
                disabled={saveDefaultNeeded.isPending || defaultNeededDraft === null}
                onClick={() => saveDefaultNeeded.mutate()}
              >
                {t("adm.val.save")}
              </Button>
            </div>
          </Card>

          {/* SCRUM-421: Upload-Grenzen sichtbar + einstellbar (Anzahl + Größe je Anhang). */}
          <Card className="space-y-2">
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("adm.upload.title")}</SectionLabel>
              <HelpTip title={t("adm.upload.title")} body={t("adm.upload.help")} />
            </div>
            <p className="text-[12.5px] text-muted">{t("adm.upload.hint")}</p>
            <div className="flex flex-wrap items-end gap-2">
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
                    String((uploadLimitsQ.data?.maxAttachmentBytes ?? 700_000) / 1_000_000)
                  }
                  onChange={(e) => setMaxMbDraft(e.target.value)}
                  aria-label={t("adm.upload.maxMb")}
                />
              </Field>
              <Button
                variant="primary"
                disabled={
                  saveUploadLimits.isPending || (maxAttDraft === null && maxMbDraft === null)
                }
                onClick={() => saveUploadLimits.mutate()}
              >
                {t("adm.upload.save")}
              </Button>
            </div>
          </Card>

          {/* SCRUM-422: Papierkorb — 28 Tage wiederherstellbar, dann Auto-Endlöschung;
              Demo-Daten erscheinen hier nie. Endlöschung mit ruhiger Inline-Rückfrage (CI). */}
          <Card className="space-y-2">
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("adm.trash.title")}</SectionLabel>
              <HelpTip title={t("adm.trash.title")} body={t("adm.trash.help")} />
            </div>
            <QueryState query={trash} />
            {trash.data && trash.data.length === 0 ? (
              <p className="text-[12.5px] text-muted-2">{t("adm.trash.empty")}</p>
            ) : null}
            {trash.data && trash.data.length > 0 ? (
              <ul className="space-y-2">
                {trash.data.map((entry) => (
                  <li key={entry.id} className="rounded-card border border-hairline p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-text">
                          {entry.title}
                        </div>
                        <div className="text-[11.5px] text-muted-2">
                          {t("adm.trash.deletedMeta", {
                            name: userName(entry.deletedBy),
                            date: new Date(entry.deletedAt).toLocaleDateString(),
                          })}
                          {" · "}
                          {t("adm.trash.expires", { days: daysLeft(entry.expiresAt) })}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        disabled={trashRestore.isPending}
                        onClick={() => trashRestore.mutate(entry.id)}
                      >
                        {t("adm.trash.restore")}
                      </Button>
                      {confirmTrashPurgeId === entry.id ? (
                        <span className="flex w-full basis-full flex-wrap items-center justify-end gap-2 border-t border-hairline pt-2">
                          <span className="text-[12px] font-semibold text-text">
                            {t("adm.trash.purgeQ")}
                          </span>
                          <button
                            type="button"
                            className="text-[12px] font-semibold text-muted hover:text-text"
                            onClick={() => setConfirmTrashPurgeId(null)}
                          >
                            {t("adm.trash.keep")}
                          </button>
                          <button
                            type="button"
                            disabled={trashPurge.isPending}
                            className="text-[12px] font-semibold text-trust-crit-text"
                            onClick={() => trashPurge.mutate(entry.id)}
                          >
                            {t("adm.trash.purge")}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmTrashPurgeId(entry.id)}
                          className="rounded-btn px-2.5 py-1.5 text-[12px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                        >
                          <Trash2 size={13} className="mr-1 inline" />
                          {t("adm.trash.purge")}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </>
      ) : null}

      {section === "ki" ? (
        <>
          {/* KI-Verwaltung v1 (Teil-Slice): Zuordnung sichtbar + änderbar; ehrlicher Status. */}
          <Card className="space-y-3">
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("adm.ai.title")}</SectionLabel>
              <HelpTip title={t("adm.ai.title")} body={t("adm.ai.help")} />
            </div>
            {/* Pedi 05.07. (VIP): klar sichtbar, dass beide Wege wählbar sind — intern (eigener
                On-Prem-LLM) oder extern (Cloud), global oder je Aufgabe. */}
            <p className="text-[12.5px] text-muted">{t("adm.ai.internExtern")}</p>
            {aiConfig.data ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12.5px] text-muted">
                    {t("adm.ai.status", {
                      provider: aiConfig.data.provider,
                      mode:
                        aiConfig.data.mode === "model"
                          ? t("adm.ai.modeModel")
                          : t("adm.ai.modeDemo"),
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
                      {conflictSelfTest.data.ok ? "OK" : "FAIL"} · {t("adm.conflictSelfTest.label")}
                      : {t(conflictSelfTest.data.messageKey)}
                    </p>
                    <p className="mt-0.5 text-[11px] opacity-90">
                      {t("adm.conflictSelfTest.provider", {
                        provider: conflictSelfTest.data.provider,
                      })}
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
                        ? ` · ${t("adm.dupSelfTest.relation", {
                            relation: dupSelfTest.data.relation,
                          })}`
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
                          eigener LLM verbunden ist, damit erkennbar bleibt, dass beides unterstützt wird. */}
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
            ) : (
              <p className="text-[12.5px] text-muted-2">{t("state.loading")}</p>
            )}
          </Card>

          {/* SCRUM-386: kundeneigene KI-Funktionen (Presets) für die Editor-Palette.
              Leitplanken: benannte Anweisungen für den vorhandenen assist-Task; die Anweisung
              ist in der Palette am ?-HelpTip offen sichtbar; Vorschau + bewusste Übernahme
              bleiben (G-3). Werks-Funktionen sind nicht löschbar. */}
          <Card className="space-y-3">
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("adm.presets.title")}</SectionLabel>
              <HelpTip title={t("adm.presets.title")} body={t("adm.presets.help")} />
            </div>
            <p className="text-[12.5px] text-muted">{t("adm.presets.hint")}</p>
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
          </Card>

          {/* SCRUM-413 (Pedi): alle verfügbaren KIs direkt sichtbar — ehrliche Übersicht aus
              dem echten configStatus (nur Metadaten, keine Secrets); Status-Pill je Zugang. */}
          <Card className="space-y-3">
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("adm.ai.accessTitle")}</SectionLabel>
              <HelpTip title={t("adm.ai.accessTitle")} body={t("adm.ai.accessHelp")} />
            </div>
            {aiConfig.data ? (
              <ul className="space-y-2">
                {aiAccessRows(aiConfig.data).map((row) => (
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
            ) : (
              <p className="text-[12.5px] text-muted-2">{t("state.loading")}</p>
            )}
            <p className="text-[11px] text-muted-2">{t("adm.ai.accessNote")}</p>
          </Card>

          {/* SCRUM-414 (Pedi 03.07.): Regler „externe Wissensabfrage" — 4 Stufen von komplett
              blockiert bis offen. Standard restriktiv. Steuert die externe Quellensuche und ist
              die Freigabe für die Public-KI-Anreicherung (SCRUM-426). */}
          <Card className="space-y-3">
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("adm.ext.title")}</SectionLabel>
              <HelpTip title={t("adm.ext.title")} body={t("adm.ext.help")} />
            </div>
            <p className="text-[12.5px] text-muted">{t("adm.ext.hint")}</p>
            {extPolicy.data ? (
              <div className="space-y-1.5">
                {EXTERNAL_STAGES.map((stage) => {
                  const active = (extPolicyDraft ?? extPolicy.data.stage) === stage;
                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setExtPolicyDraft(stage)}
                      aria-pressed={active}
                      className={`flex w-full items-start gap-2 rounded-card border px-3 py-2 text-left transition-colors ${
                        active
                          ? "border-ink bg-hairline-soft"
                          : "border-hairline hover:border-ink/30"
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
                      extPolicyDraft === extPolicy.data.stage
                    }
                    onClick={() => saveExtPolicy.mutate()}
                  >
                    {t("adm.ext.save")}
                  </Button>
                  <span className="text-[11px] text-muted-2">{t("adm.ext.note")}</span>
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-2">{t("state.loading")}</p>
            )}
          </Card>

          {/* Pedi 04.07.: Anzeige-Schwelle der Duplikat-Erkennung — ab welcher KI-Wahrscheinlichkeit
              ein vermutliches Duplikat gezeigt wird. Niedriger = mehr Treffer + mehr Fehlalarme. */}
          <Card className="space-y-2">
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("adm.dup.title")}</SectionLabel>
              <HelpTip title={t("adm.dup.title")} body={t("adm.dup.help")} />
            </div>
            <p className="text-[12.5px] text-muted">{t("adm.dup.hint")}</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("adm.dup.threshold")}>
                <TextInput
                  type="number"
                  min={5}
                  max={99}
                  step={1}
                  className="w-24"
                  value={
                    dupThresholdDraft ??
                    String(Math.round((dupSettingsQ.data?.minConfidence ?? 0.5) * 100))
                  }
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
          </Card>
        </>
      ) : null}

      {section === "konten" ? (
        <>
          {/* SCRUM-147: Nutzer anlegen */}
          <Card className="space-y-3">
            <SectionLabel>{t("adm.createTitle")}</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("adm.name")}>
                <TextInput
                  value={newUser.name}
                  onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                />
              </Field>
              <Field label={t("adm.email")}>
                <TextInput
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                />
              </Field>
              <Field label={t("adm.password")}>
                <TextInput
                  type="password"
                  minLength={8}
                  value={newUser.password}
                  onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                />
              </Field>
              {/* SCRUM: Passwort-Bestätigung — ein Vertipper würde den neuen Nutzer sonst aussperren. */}
              <Field label={t("adm.newPasswordRepeat")}>
                <TextInput
                  type="password"
                  minLength={8}
                  value={newUserPw2}
                  onChange={(e) => setNewUserPw2(e.target.value)}
                />
                {passwordRepeatMismatch(newUser.password, newUserPw2) ? (
                  <p className="mt-1.5 text-[12px] text-trust-crit-text">
                    {t("adm.passwordMismatch")}
                  </p>
                ) : null}
              </Field>
              <Field label={t("adm.role")}>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value as Role }))}
                  className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`role.name.${r}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {/* SCRUM-463: Knopf nicht mehr stumm deaktivieren. Fehlt etwas, sagt ein Klick
                ehrlich, was — sonst „passiert nichts" ohne jede Rückmeldung. */}
            <div className="space-y-1.5">
              <Button
                variant="primary"
                disabled={create.isPending}
                onClick={() => {
                  const issues = newUserIssues(newUser);
                  if (issues.length > 0) {
                    push(
                      "error",
                      `${t("adm.createInvalid")} ${issues
                        .map((i) => t(`adm.field.${i}`))
                        .join(", ")}`,
                    );
                    return;
                  }
                  if (newUser.password !== newUserPw2) {
                    push("error", t("adm.passwordMismatch"));
                    return;
                  }
                  create.mutate();
                }}
              >
                <UserPlus size={15} />
                {t("adm.create")}
              </Button>
              {newUserIssues(newUser).length > 0 ? (
                <p className="text-[12px] text-muted-2">{t("adm.createHint")}</p>
              ) : null}
            </div>
          </Card>

          {/* Nutzerliste + Freigabe/Rolle/Reset/Löschen */}
          <QueryState query={query} emptyText={t("adm.empty")}>
            {(users) => (
              <Card className="p-0">
                <div className="divide-y divide-hairline">
                  {users.map((u) => (
                    <div key={u.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium text-text">
                            {u.name}
                          </div>
                          <div className="truncate font-mono text-[11px] text-muted-2">
                            {u.email}
                          </div>
                        </div>
                        {u.approved ? (
                          <select
                            value={u.role}
                            onChange={(e) =>
                              setRole.mutate({ id: u.id, role: e.target.value as Role })
                            }
                            className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px]"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {t(`role.name.${r}`)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => approve.mutate(u.id)}
                            className="rounded-btn bg-trust-pos-bg px-3 py-1.5 text-[12.5px] font-semibold text-trust-pos-text hover:opacity-80"
                          >
                            {t("adm.approve")}
                          </button>
                        )}
                        <button
                          type="button"
                          title={t("adm.reset")}
                          onClick={() => {
                            setResetId((id) => (id === u.id ? null : u.id));
                            setResetPw("");
                          }}
                          className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          type="button"
                          title={t("adm.remove")}
                          onClick={() => remove.mutate(u.id)}
                          className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {resetId === u.id ? (
                        <div className="mt-2 rounded-input bg-page p-2">
                          {/* SCRUM-455: Passwort + Wiederholung — Vertipper würde sonst den Nutzer aussperren. */}
                          <div className="flex flex-wrap items-center gap-2">
                            <TextInput
                              type="password"
                              minLength={8}
                              placeholder={t("adm.newPassword")}
                              value={resetPw}
                              onChange={(e) => setResetPw(e.target.value)}
                              className="h-9 flex-1"
                            />
                            <TextInput
                              type="password"
                              minLength={8}
                              placeholder={t("adm.newPasswordRepeat")}
                              value={resetPw2}
                              onChange={(e) => setResetPw2(e.target.value)}
                              className="h-9 flex-1"
                            />
                            <Button
                              variant="primary"
                              disabled={reset.isPending || !isPasswordResetValid(resetPw, resetPw2)}
                              onClick={() => reset.mutate({ id: u.id, password: resetPw })}
                            >
                              {t("adm.resetConfirm")}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setResetId(null);
                                setResetPw("");
                                setResetPw2("");
                              }}
                            >
                              {t("adm.resetCancel")}
                            </Button>
                          </div>
                          {/* Ehrlicher Grund erst, wenn im Wiederholfeld etwas steht (kein Fehler beim Tippen). */}
                          {passwordRepeatMismatch(resetPw, resetPw2) ? (
                            <p className="mt-1.5 text-[12px] text-trust-crit-text">
                              {t("adm.passwordMismatch")}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </QueryState>
        </>
      ) : null}

      {section === "daten" ? (
        /* SCRUM-149: kleine echte Audit-Sicht für Nutzer-/Auth-Aktionen */
        <Card className="p-0">
          <div className="px-4 pt-4">
            <SectionLabel>{t("adm.auditTitle")}</SectionLabel>
          </div>
          <QueryState query={audit} emptyText={t("adm.auditEmpty")}>
            {(entries) => {
              const userEntries = entries
                .filter((e) => isUserAuditAction(e.action))
                .slice(-15)
                .reverse();
              if (userEntries.length === 0) {
                return <p className="px-4 py-3 text-[13px] text-muted">{t("adm.auditEmpty")}</p>;
              }
              return (
                <div className="divide-y divide-hairline">
                  {userEntries.map((e) => (
                    <div key={e.seq} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                      <span className="font-mono text-[11px] text-muted-2">
                        {new Date(e.at).toLocaleString()}
                      </span>
                      <span className="font-semibold text-text">{e.action}</span>
                      <span className="ml-auto truncate font-mono text-[11px] text-muted-2">
                        {e.actor}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          </QueryState>
        </Card>
      ) : null}

      {/* SCRUM-432 (Pedi 03.07., VIP-Investor): Vertrauen & Sicherheit — manipulationssicheres
          Prüfprotokoll + Datenschutz-/Sicherheits-Nachweis. Ein Auszug, den man einem Investor
          ruhig zeigt: nur echte Systemeigenschaften, keine Versprechen. */}
      {section === "sicherheit" ? (
        <div className="print-area space-y-6">
          <div className="flex justify-end print-hide">
            <Button variant="outline" onClick={printExtract}>
              <Printer size={14} /> {t("adm.print")}
            </Button>
          </div>
          <Card className="p-0">
            <div className="px-4 pt-4">
              <div className="flex items-center gap-1.5">
                <SectionLabel>{t("adm.sich.auditTitle")}</SectionLabel>
                <HelpTip title={t("adm.sich.auditTitle")} body={t("adm.sich.auditHelp")} />
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {t("adm.sich.auditIntro")}
              </p>
            </div>
            <QueryState query={audit} emptyText={t("adm.auditEmpty")}>
              {(entries) => {
                const recent = entries.slice(-12).reverse();
                return (
                  <>
                    <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-3">
                      <span className="rounded-pill bg-trust-pos-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-pos-text">
                        {t("adm.sich.auditCount", { count: entries.length })}
                      </span>
                      {/* SCRUM-439: aktive Integritätsprüfung — Knopf print-versteckt, Ergebnis bleibt sichtbar. */}
                      <Button
                        variant="outline"
                        className="print-hide"
                        disabled={verifyAudit.isPending}
                        onClick={() => verifyAudit.mutate()}
                      >
                        <ShieldCheck size={14} /> {t("adm.sich.verify.button")}
                      </Button>
                      {verifyAudit.data ? (
                        verifyAudit.data.ok ? (
                          <span className="rounded-pill bg-trust-pos-bg px-2 py-0.5 text-[11px] font-semibold text-trust-pos-text">
                            {t("adm.sich.verify.ok", { count: verifyAudit.data.count })}
                          </span>
                        ) : (
                          <span className="rounded-pill bg-trust-crit-bg px-2 py-0.5 text-[11px] font-semibold text-trust-crit-text">
                            {t("adm.sich.verify.fail")}
                          </span>
                        )
                      ) : null}
                    </div>
                    {recent.length === 0 ? (
                      <p className="px-4 py-3 text-[13px] text-muted">{t("adm.auditEmpty")}</p>
                    ) : (
                      <div className="divide-y divide-hairline">
                        {recent.map((e) => (
                          <div
                            key={e.seq}
                            className="flex items-center gap-3 px-4 py-2 text-[12.5px]"
                          >
                            <span className="font-mono text-[11px] text-muted-2">
                              {new Date(e.at).toLocaleString()}
                            </span>
                            <span className="font-semibold text-text">{e.action}</span>
                            <span className="truncate text-[11.5px] text-muted">{e.target}</span>
                            <span className="ml-auto truncate font-mono text-[11px] text-muted-2">
                              {e.actor}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              }}
            </QueryState>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("adm.sich.dataTitle")}</SectionLabel>
              <HelpTip title={t("adm.sich.dataTitle")} body={t("adm.sich.dataHelp")} />
            </div>
            <ul className="mt-3 space-y-2.5">
              {SECURITY_POINTS.map((p) => (
                <li key={p.id} className="flex items-start gap-2.5">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-trust-pos-text" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-text">
                      {t(p.titleKey)}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
                      {t(p.bodyKey)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* SCRUM-444 (Pedi 03.07., Berater-Frage 7): Markenkern auf dem druckbaren Auszug —
              „Vertrauen ist Evidenz, nie behauptet." Grenzt gemessene Live-Werte klar von
              Zielwerten/Beispielrechnungen ab, damit nichts als bewiesen missverstanden wird. */}
          <p className="rounded-card border border-hairline bg-page px-3 py-2 text-[11px] leading-relaxed text-muted-2">
            {t("adm.sich.evidenceNote")}
          </p>
        </div>
      ) : null}

      {/* SCRUM-437 (Pedi 03.07., VIP): Bereitschafts-Checkliste — Ein-Blick-Status vor dem Test,
          je Zeile eine ehrliche Ampel aus echten Zahlen. Druckbar (SCRUM-440). */}
      {section === "bereitschaft" ? (
        <div className="print-area">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <SectionLabel>{t("adm.ready.title")}</SectionLabel>
                <HelpTip title={t("adm.ready.title")} body={t("adm.ready.help")} />
              </div>
              <Button variant="outline" className="print-hide" onClick={printExtract}>
                <Printer size={14} /> {t("adm.print")}
              </Button>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{t("adm.ready.intro")}</p>
            <ul className="mt-3 divide-y divide-hairline">
              {readinessRows({
                kiBoth:
                  (aiConfig.data?.cloudConfigured ?? false) &&
                  (aiConfig.data?.localConfigured ?? false),
                kiAny:
                  (aiConfig.data?.cloudConfigured ?? false) ||
                  (aiConfig.data?.localConfigured ?? false),
                validated: analytics.data?.byStatus.validiert ?? 0,
                openReviews: board.data?.length ?? 0,
                uploadLimits: uploadLimitsQ.data ?? null,
                externalStage: extPolicy.data?.stage ?? null,
              }).map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                  <span className="font-semibold text-text">{t(row.labelKey)}</span>
                  <span
                    className={`ml-auto rounded-pill px-2.5 py-0.5 text-[11.5px] font-semibold ${
                      READY_TONE_CLASS[row.tone]
                    }`}
                  >
                    {t(row.valueKey, row.params)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-2">{t("adm.ready.note")}</p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
