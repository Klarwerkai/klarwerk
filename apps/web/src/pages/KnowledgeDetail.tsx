import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Paperclip, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { type KoAction, endpoints } from "../api/endpoints";
import {
  useAudit,
  useConflicts,
  useDirectory,
  useKo,
  useKoEvidence,
  useKoVersions,
  useKos,
  useLifecyclePending,
} from "../api/hooks";
import type { ConflictType, ExternalResult, KnowledgeObject, KnowledgeType } from "../api/types";
import { useSession } from "../app/AuthContext";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { AiAssistBox } from "../components/AiAssistBox";
import { BodyTemplateChooser } from "../components/BodyTemplateChooser";
import { DemoBanner } from "../components/DemoBanner";
import { EditorAttachmentContext } from "../components/EditorAttachmentContext";
import { EditorContentQuality } from "../components/EditorContentQuality";
import { EditorGuidance } from "../components/EditorGuidance";
import { HelpTip } from "../components/HelpTip";
import { KnowledgeInputStudio } from "../components/KnowledgeInputStudio";
import { KoRevisionSummary } from "../components/KoRevisionSummary";
import { RichTextEditor } from "../components/RichTextEditor";
import { SanitizedHtml } from "../components/SanitizedHtml";
import { ListEditor, TagEditor } from "../components/editors";
import {
  ConfidenceBar,
  KNOWLEDGE_TYPES,
  KnowledgeTypeTag,
  ProvenanceLine,
  StatusPill,
} from "../components/trust";
import {
  Button,
  Card,
  Field,
  PageHeader,
  QueryState,
  SectionLabel,
  TextInput,
} from "../components/ui";
import { applyBodyAssist, applyBodyAssistBlock, bodyTextForAssist } from "../lib/bodyAiAssist";
import { editorFilesFromAttachments } from "../lib/bodyFileLink";
import {
  BODY_READ_BLOCKS_KEY,
  BODY_READ_NOTE_KEY,
  BODY_READ_TITLE_KEY,
  bodyReadMode,
} from "../lib/bodyReadMode";
import { conflictImpact, conflictLimitedUsability, conflictNotice } from "../lib/conflictImpact";
import { isDemoKnowledge } from "../lib/demoKnowledge";
import { demoHref, isDemoContext } from "../lib/demoPilotPath";
import { deriveStatus } from "../lib/displayStatus";
import { studioSaveConfidence } from "../lib/editorApplySafety";
import { EDITOR_BLOCKS } from "../lib/editorBlocks";
import { groupEvidenceByVersion } from "../lib/evidenceByVersion";
import { analyzeEvidenceConsistency } from "../lib/evidenceConsistency";
import { analyzeEvidenceFreshness } from "../lib/evidenceFreshness";
import { evidenceFreshnessLabelKey, evidenceFreshnessTone } from "../lib/evidenceFreshnessView";
import { validityProtectionView } from "../lib/extConcept";
import { toSourcePayload as externalToSourcePayload } from "../lib/externalSearch";
import { fileToThumbDataUrl, readFileAsDataUrl } from "../lib/files";
import { helpfulDisabled, helpfulLabel } from "../lib/helpfulSignal";
import { koCta } from "../lib/koCta";
import { evidenceRows } from "../lib/koEvidence";
import { koAuditEvents, lineageSummary, relatedKos } from "../lib/koLineage";
import { type KoUsability, koOverview } from "../lib/koOverview";
import {
  EMPTY_SOURCE_FORM,
  type SourceFormInput,
  isSourceFormValid,
  sourceBadgeKey,
  toSourcePayload,
} from "../lib/koSource";
import { diffForVersion } from "../lib/koVersionDiff";
import { koVersionRows } from "../lib/koVersionSnapshots";
import { toReasonerLocale } from "../lib/reasonerLocale";
import {
  isReviewReworkContext,
  reworkNextSteps,
  reworkValidationHref,
} from "../lib/reviewReworkContext";
import {
  type SourceContributionInput,
  formatSourceComment,
  isSourceContributionValid,
} from "../lib/sourceContribution";
import { trustExplainer } from "../lib/trustExplainer";
import { useReadiness } from "../lib/useReadiness";
import { latestValidationFeedback } from "../lib/validationFeedback";
import { isReturnedForRework } from "../lib/validationStatus";

interface EditState {
  title: string;
  statement: string;
  bodyHtml: string; // KW-STR: WYSIWYG-Body
  type: KnowledgeType;
  category: string;
  conditions: string[];
  measures: string[];
  tags: string[];
}

const textareaCls =
  "w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30";

const CONFLICT_TYPES: readonly ConflictType[] = [
  "truth",
  "experience",
  "context",
  "temporal",
  "role",
];

interface ConflictForm {
  koB: string;
  type: ConflictType;
  description: string;
}

// SCRUM-251: Produktionsnähe → Tönung der Übersichts-Plakette (nutzbar/in Prüfung/in Arbeit).
const USABILITY_TONE: Record<KoUsability, string> = {
  ready: "bg-trust-pos-bg text-trust-pos-text",
  "in-review": "bg-trust-warn-bg text-trust-warn-text",
  "needs-work": "bg-page text-muted",
};

export function KnowledgeDetail(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { id = "" } = useParams();
  // SCRUM-313: KI-Nachbearbeitung der Aussage im Edit-Modus (Vorschau + bewusste Übernahme, kein
  // Auto-Submit). Nutzt den vorhandenen reasoner.assist-Endpunkt mit optionaler Instruktion.
  const runAssist = (input: string, instruction?: string): Promise<string> =>
    endpoints.reasoner
      .assist(input, toReasonerLocale(i18n.language), instruction)
      .then((r) => r.text);
  // SCRUM-294: Demo-Kontext der Zielseite (über Library erreicht) — nur Anzeige/Link-Kontext.
  const [params] = useSearchParams();
  const reviewReworkContext = isReviewReworkContext(params);
  const { role } = useRole();
  const query = useKo(id);
  const evidence = useKoEvidence(id);
  const versions = useKoVersions(id);
  const koList = useKos();
  const audit = useAudit();
  // SCRUM-95/96: Signale für die abgeleitete Gültigkeit-/Schutz-Sicht.
  const pending = useLifecyclePending();
  const conflicts = useConflicts();
  const dir = useDirectory();
  const nameOf = (uid: string): string => dir.data?.find((d) => d.id === uid)?.name || uid;
  const qc = useQueryClient();
  const [edit, setEdit] = useState<EditState | null>(null);
  // SCRUM-337: großer Knowledge-Studio-Arbeitsraum (Overlay) für den ausführlichen Inhalt im Edit.
  const [studioOpen, setStudioOpen] = useState(false);
  // SCRUM-339: kurzes, ehrliches Feedback nach Übernahme aus dem Studio (kein Auto-Save).
  const [studioApplied, setStudioApplied] = useState(false);
  // SCRUM-331: nach einer Revision aus dem Nacharbeitskontext (?rework=review) den Rückweg ins
  // Validation Board (Fokus „überarbeitet") anbieten. Nur Anzeige; keine Auto-Validierung/-Rückgabe.
  const [reworkSavedFor, setReworkSavedFor] = useState<string | null>(null);
  const reworkSaved = reviewReworkContext && reworkSavedFor === id;
  const [conflict, setConflict] = useState<ConflictForm | null>(null);
  const [commentText, setCommentText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [newAuthor, setNewAuthor] = useState("");
  // SCRUM-131 / FE-KO-06: Quelle/Beitrag melden (über Kommentar-Pfad).
  const [source, setSource] = useState<SourceContributionInput>({ contribution: "", source: "" });
  // SCRUM-129 / FE-KO-07: echte externe Quelle anhängen.
  const [sourceForm, setSourceForm] = useState<SourceFormInput>({ ...EMPTY_SOURCE_FORM });
  const { push } = useToast();
  const canEdit = role !== "viewer";
  const canReview = role === "controller" || role === "admin";
  // SCRUM-144: Autor-Übergabe nutzt users.manage-Pfad → nur Admin.
  const canTransfer = role === "admin";
  // Pedi 02.07.: Löschen dürfen Autor ODER Controller/Admin — mit Inline-Bestätigung,
  // danach zurück in die Bibliothek. Serverseitig gilt dieselbe Regel (Route prüft).
  const { user } = useSession();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const removeKo = useMutation({
    mutationFn: () => endpoints.ko.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["validation"] });
      push("success", t("ko.deleteDone"));
      navigate("/bibliothek");
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["ko", id] });
    void qc.invalidateQueries({ queryKey: ["validation"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["conflicts"] });
  };

  const act = useMutation({
    mutationFn: (body: KoAction) => endpoints.ko.act(id, body),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  // FE-LCY-03 / SCRUM-111: „Hat geholfen" nutzt den bestehenden Ask-Helpful-Pfad (Trust +2, Audit).
  const helpful = useMutation({
    mutationFn: () => endpoints.ask.helpful(id),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["analytics"] });
      void qc.invalidateQueries({ queryKey: ["audit"] });
      push("success", t("ko.helpfulThanks"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // SCRUM-129 / FE-KO-07: echte externe Quelle hinzufügen/entfernen.
  const addSource = useMutation({
    mutationFn: () =>
      endpoints.ko.act(id, { action: "add-source", source: toSourcePayload(sourceForm) }),
    onSuccess: () => {
      invalidate();
      setSourceForm({ ...EMPTY_SOURCE_FORM });
      push("success", t("ko.sourceAdded"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const removeSource = useMutation({
    mutationFn: (sourceId: string) => endpoints.ko.act(id, { action: "remove-source", sourceId }),
    onSuccess: invalidate,
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // SCRUM-118 / FR-EXT-02: externe Quellensuche (Server-Proxy) — kein Auto-Anhängen.
  const [extQuery, setExtQuery] = useState("");
  const [extResults, setExtResults] = useState<ExternalResult[]>([]);
  const extSearch = useMutation({
    mutationFn: (q: string) => endpoints.external.search(q),
    onSuccess: (results) => setExtResults(results),
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("ext.unavailable")),
  });
  const attachExternal = useMutation({
    mutationFn: (result: ExternalResult) =>
      endpoints.ko.act(id, { action: "add-source", source: externalToSourcePayload(result) }),
    onSuccess: () => {
      invalidate();
      push("success", t("ko.sourceAdded"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // SCRUM-144: Autorenübergabe über bestehende KO-Action transfer-author.
  const transfer = useMutation({
    mutationFn: (nextAuthor: string) =>
      endpoints.ko.act(id, { action: "transfer-author", newAuthor: nextAuthor }),
    onSuccess: () => {
      invalidate();
      setNewAuthor("");
      push("success", t("ko.transferDone"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // Audit B1 (Pedi 02.07.): Anlagen-Kopplung — gekoppelte Anlagen lesen + neue Kopplung setzen.
  // Erst damit trifft „Anlage geändert" (Lebenszyklus) gezielt die richtigen Wissensobjekte.
  const [coupleAsset, setCoupleAsset] = useState("");
  const couplings = useQuery({
    queryKey: ["couplings", id],
    queryFn: () => endpoints.lifecycle.couplingsFor(id),
  });
  const couple = useMutation({
    mutationFn: (assetRef: string) => endpoints.lifecycle.couple(assetRef, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["couplings", id] });
      setCoupleAsset("");
      push("success", t("ko.couple.done"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  // SCRUM-131 / FE-KO-06: Beitrag/Quelle als Review-Kommentar speichern (kein neues Quellenfeld).
  const sourceContribution = useMutation({
    mutationFn: () =>
      endpoints.ko.act(id, { action: "comment", text: formatSourceComment(source) }),
    onSuccess: () => {
      invalidate();
      setSource({ contribution: "", source: "" });
      push("success", t("ko.sourceSaved"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });

  const comment = useMutation({
    mutationFn: () => endpoints.ko.act(id, { action: "comment", text: commentText.trim() }),
    onSuccess: () => {
      invalidate();
      setCommentText("");
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  // SCRUM-121: Original in den Object-Store hochladen, am KO nur Referenz + Vorschau.
  const attach = useMutation({
    mutationFn: async (input: {
      name: string;
      mime: string;
      thumbnail: string;
      original: string;
    }) => {
      const ref = await endpoints.objects.upload({
        name: input.name,
        mime: input.mime,
        data: input.original,
        kind: "image",
      });
      return endpoints.ko.act(id, {
        action: "attach",
        attachment: {
          name: input.name,
          mime: input.mime,
          objectId: ref.id,
          thumbnail: input.thumbnail,
          size: ref.size,
        },
      });
    },
    onSuccess: () => {
      invalidate();
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const detach = useMutation({
    mutationFn: (attachmentId: string) => endpoints.ko.act(id, { action: "detach", attachmentId }),
    onSuccess: invalidate,
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    try {
      const [thumbnail, original] = await Promise.all([
        fileToThumbDataUrl(file),
        readFileAsDataUrl(file),
      ]);
      attach.mutate({ name: file.name, mime: file.type || "image/jpeg", thumbnail, original });
    } catch {
      setErr(t("state.error"));
    }
  };

  // SCRUM-121: Original öffnen — neue Anhänge via Objekt-Store, Alt-Anhänge via dataUrl.
  const openAttachment = async (a: { dataUrl?: string; objectId?: string }): Promise<void> => {
    if (a.dataUrl) {
      window.open(a.dataUrl, "_blank", "noopener");
      return;
    }
    if (a.objectId) {
      try {
        const obj = await endpoints.objects.read(a.objectId);
        window.open(obj.data, "_blank", "noopener");
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : t("state.error"));
      }
    }
  };

  const report = useMutation({
    mutationFn: () => {
      if (!conflict || !conflict.koB) {
        throw new Error("no target");
      }
      return endpoints.ko.act(id, {
        action: "conflict",
        conflict: {
          koA: id,
          koB: conflict.koB,
          type: conflict.type,
          description: conflict.description,
        },
      });
    },
    onSuccess: () => {
      invalidate();
      setConflict(null);
      setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!edit) {
        throw new Error("no edit");
      }
      await endpoints.ko.act(id, {
        action: "revise",
        changes: {
          title: edit.title,
          statement: edit.statement,
          bodyHtml: edit.bodyHtml, // KW-STR: Body verlustfrei mitspeichern (Server sanitisiert)
          type: edit.type,
          conditions: edit.conditions.filter((x) => x.trim()),
          measures: edit.measures.filter((x) => x.trim()),
        },
      });
      await endpoints.ko.act(id, { action: "tags", tags: edit.tags.filter((x) => x.trim()) });
      if (edit.category.trim()) {
        await endpoints.ko.act(id, { action: "category", category: edit.category.trim() });
      }
    },
    onSuccess: () => {
      invalidate();
      setEdit(null);
      setErr(null);
      // SCRUM-331: Revision aus dem Nacharbeitskontext → Rückweg zur Validierung der Revision anbieten.
      if (reviewReworkContext) {
        setReworkSavedFor(id);
      }
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  const startEdit = (ko: KnowledgeObject): void => {
    setErr(null);
    setEdit({
      title: ko.title,
      statement: ko.statement,
      bodyHtml: ko.bodyHtml ?? "",
      type: ko.type,
      category: ko.category,
      conditions: [...ko.conditions],
      measures: [...ko.measures],
      tags: [...ko.tags],
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader kicker={t("ko.kicker")} title={t("ko.title")} />
      {/* SCRUM-294: Demo-/Pilotpfad auf der Zielseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="detail" /> : null}
      <QueryState query={query}>
        {(ko) => {
          // SCRUM-251: kompakte Handlungs-/Statusübersicht aus bereits geladenen Feldern.
          const ov = koOverview(ko);
          // SCRUM-357 / AG-14: Konflikt-Wirkung — ein offener (v. a. Truth-)Konflikt begrenzt die
          // Nutzbarkeit ehrlich (ready → in-review). Gelöste Konflikte wirken nicht mehr.
          const impact = conflictImpact(ko.id, conflicts.data ?? []);
          const usability = conflictLimitedUsability(ov.usability, impact);
          const notice = conflictNotice(impact);
          return (
            <>
              <Card className="mb-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span
                    className={`rounded-pill px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${USABILITY_TONE[usability]}`}
                  >
                    {t(useReadiness(usability).labelKey)}
                  </span>
                  {/* SCRUM-357: sichtbares Konflikt-Signal direkt an der Nutzbarkeit. */}
                  {notice ? (
                    <span
                      title={t(notice.hintKey)}
                      className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text"
                    >
                      {t("conflict.impact.badge")}
                    </span>
                  ) : null}
                  <StatusPill status={ov.status} />
                  {/* SCRUM-308: Herkunfts-Kennzeichnung Demo-/Seed-Wissen (neutral, kein Statussignal). */}
                  {isDemoKnowledge(ko) ? (
                    <span
                      title={t("demo.badge.hint")}
                      className="rounded-pill bg-hairline-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2"
                    >
                      {t("demo.badge.label")}
                    </span>
                  ) : null}
                  <span className="font-mono text-[12px] text-muted">
                    {t("ko.ovTrust")} <span className="font-semibold text-ink">{ov.trust}</span>
                  </span>
                  <span className="font-mono text-[12px] text-muted-2">v{ov.version}</span>
                  <span className="font-mono text-[11.5px] text-muted-2">
                    {t("ko.ovSources", { n: ov.sourceCount })} ·{" "}
                    {t("ko.ovAttachments", { n: ov.attachmentCount })}
                  </span>
                </div>
                {/* SCRUM-293: konsistenter, ehrlicher Readiness-Hinweis (gleiche Sprache wie Library). */}
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                  {t(useReadiness(usability).hintKey)}
                </p>
                {/* SCRUM-359 / AG-05 / PI-K2: ruhige Trust-Transparenz (progressive disclosure).
                    Erklärt, dass Trust ein Review-/Evidenzsignal ist — keine Wahrheitsgarantie. */}
                {(() => {
                  const ex = trustExplainer({ trustBand: ov.trustBand, usability });
                  return (
                    <details className="mt-1.5 text-[12px] text-muted">
                      <summary className="cursor-pointer select-none font-medium text-muted-2 hover:text-text">
                        {t(ex.titleKey)}
                      </summary>
                      <p className="mt-1 leading-relaxed">{t(ex.metaKey)}</p>
                      <p className="mt-1 leading-relaxed">{t(ex.bandKey)}</p>
                      {ex.reviewHintKey ? (
                        <p className="mt-1 leading-relaxed text-trust-warn-text">
                          {t(ex.reviewHintKey)}
                        </p>
                      ) : null}
                    </details>
                  );
                })()}
                {/* SCRUM-357 / AG-14 / VC-P1-1: ehrlicher Konflikt-Banner — offener (Truth-)Konflikt
                    schränkt Nutzbarkeit/Trust ein, ohne das KO als falsch zu behaupten. */}
                {notice ? (
                  <div className="mt-2 rounded-card border border-trust-warn-fill bg-trust-warn-bg px-3 py-2">
                    <p className="text-[12.5px] font-semibold text-trust-warn-text">
                      {t(notice.titleKey)}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-trust-warn-text">
                      {t(notice.hintKey)}
                    </p>
                    <Link
                      to={notice.to}
                      className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-trust-warn-text underline"
                    >
                      {t("conflict.impact.cta")}
                    </Link>
                  </div>
                ) : null}
                {/* SCRUM-259: nächste Handlung als ehrliche CTA auf vorhandene Routen/Bereiche. */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <p className="text-[12.5px] text-muted">
                    <span className="font-semibold text-text">{t("ko.nextLabel")} </span>
                    {t(`ko.next.${ov.nextAction}`)}
                  </p>
                  {(() => {
                    const cta = koCta(ov.nextAction, ko);
                    const cls = `inline-flex items-center gap-1 rounded-btn px-2.5 py-1 text-[12px] font-semibold ${
                      cta.tone === "primary"
                        ? "bg-ink text-white hover:opacity-90"
                        : "border border-hairline text-text hover:bg-hairline-soft"
                    }`;
                    return cta.kind === "route" ? (
                      // SCRUM-294: im Demo-Kontext den Use-Fluss (→ Ask) quellengebunden weiterführen.
                      <Link to={demoHref(cta.href, params)} className={cls}>
                        {t(cta.labelKey)} <span aria-hidden="true">→</span>
                      </Link>
                    ) : (
                      <a href={cta.href} className={cls}>
                        {t(cta.labelKey)} <span aria-hidden="true">↓</span>
                      </a>
                    );
                  })()}
                </div>
              </Card>
              <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
                <Card>
                  {/* SCRUM-124: sichtbarer Rückgabe-/Nacharbeit-Hinweis aus Validierungsfeedback */}
                  {isReturnedForRework(audit.data ?? [], ko.id) ? (
                    <div className="mb-3 rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-3 text-[12.5px] text-trust-warn-text">
                      {t("ko.returnedBanner")}
                    </div>
                  ) : null}
                  {/* SCRUM-331: nach einer Revision aus dem Nacharbeitskontext → Rückweg zur Validierung
                      der überarbeiteten KOs. Ehrlich: neue Version + erneute Review, keine Auto-Freigabe. */}
                  {reworkSaved ? (
                    <div className="mb-3 rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3">
                      <div className="text-[12.5px] font-semibold text-trust-pos-text">
                        {t("ko.rework.savedTitle")}
                      </div>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-trust-pos-text/90">
                        {t("ko.rework.savedHint")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          to={reworkValidationHref()}
                          className="inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
                        >
                          {t("ko.rework.toValidation")} <span aria-hidden="true">→</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setReworkSavedFor(null)}
                          className="text-[11.5px] font-semibold text-muted hover:text-text"
                        >
                          {t("val.feedback.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {/* SCRUM-330: Review-Nacharbeitskontext (?rework=review) — nur Anzeige; Bearbeiten erzeugt
                      neue Version/Review, keine automatische Freigabe/Rückgabe. */}
                  {reviewReworkContext && !reworkSaved ? (
                    <div className="mb-3 rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-3">
                      <div className="text-[12.5px] font-semibold text-trust-warn-text">
                        {t("ko.rework.title")}
                      </div>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-trust-warn-text/90">
                        {t("ko.rework.hint")}
                      </p>
                      {/* SCRUM-332: das konkrete jüngste Validierungsfeedback fokussiert zeigen (aus den
                          KO-Kommentaren am stabilen Präfix erkannt); allgemeine Kommentarliste unberührt. */}
                      {(() => {
                        const fb = latestValidationFeedback(ko.comments);
                        if (!fb) {
                          return null;
                        }
                        return (
                          <div className="mt-2 rounded-btn border border-trust-warn-fill/30 bg-surface p-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                                {t("ko.rework.feedbackTitle")}
                              </span>
                              <span className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-trust-warn-text">
                                {t(`ko.rework.feedback.${fb.verdict}`)}
                              </span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">
                              {fb.body}
                            </p>
                            {fb.author ? (
                              <p className="mt-1 text-[10.5px] text-muted-2">
                                {nameOf(fb.author)}
                                {fb.at
                                  ? ` · ${new Date(fb.at).toLocaleDateString(i18n.language)}`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                        );
                      })()}
                      {/* SCRUM-336: ehrliche „Was als Nächstes?"-Schrittfolge — macht die Nacharbeit als
                          zusammenhängenden Ablauf sichtbar (Feedback → Revision → zurück in den Fokus).
                          Kein Assignee-Modell, keine Auto-Freigabe; reine Orientierung. */}
                      <div className="mt-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-trust-warn-text/80">
                          {t("ko.rework.stepsTitle")}
                        </div>
                        <ol className="mt-1 space-y-0.5">
                          {reworkNextSteps().map((step, idx) => (
                            <li
                              key={step.key}
                              className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-trust-warn-text/90"
                            >
                              <span className="font-mono text-[10px] font-semibold text-trust-warn-text/70">
                                {idx + 1}.
                              </span>
                              <span>{t(step.labelKey)}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {canEdit && !edit ? (
                          <button
                            type="button"
                            onClick={() => startEdit(ko)}
                            className="inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
                          >
                            <Pencil size={13} />
                            {t("ko.rework.edit")}
                          </button>
                        ) : null}
                        <Link
                          to="/validierung"
                          className="inline-flex items-center gap-1 rounded-btn border border-hairline bg-surface px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-text"
                        >
                          {t("ko.rework.back")} <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={deriveStatus(ko)} />
                    <KnowledgeTypeTag type={ko.type} />
                    <span className="font-mono text-[11px] text-muted-2">
                      v{ko.version}
                      {ko.asset ? ` · ${ko.asset}` : ""}
                    </span>
                    {canEdit && !edit ? (
                      <button
                        type="button"
                        onClick={() => startEdit(ko)}
                        className="ml-auto inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
                      >
                        <Pencil size={13} />
                        {t("ko.edit")}
                      </button>
                    ) : null}
                  </div>

                  {edit ? (
                    <div className="mt-4 space-y-3">
                      {/* SCRUM-333: im Rework-Edit-Modus das konkrete Review-Feedback als Arbeitshilfe
                          sichtbar halten (gleiche Erkennung wie SCRUM-332). Ehrlich: Speichern erzeugt
                          neue Version + erneute Review, keine Auto-Freigabe. Kein Auto-Prefill/-Abhaken. */}
                      {reviewReworkContext
                        ? (() => {
                            const fb = latestValidationFeedback(ko.comments);
                            if (!fb) {
                              return null;
                            }
                            return (
                              <div className="rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-3">
                                <div className="text-[12.5px] font-semibold text-trust-warn-text">
                                  {t("ko.rework.editTitle")}
                                </div>
                                <div className="mt-1.5 rounded-btn border border-trust-warn-fill/30 bg-surface p-2.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                                      {t("ko.rework.feedbackTitle")}
                                    </span>
                                    <span className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-trust-warn-text">
                                      {t(`ko.rework.feedback.${fb.verdict}`)}
                                    </span>
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">
                                    {fb.body}
                                  </p>
                                  {fb.author ? (
                                    <p className="mt-1 text-[10.5px] text-muted-2">
                                      {nameOf(fb.author)}
                                      {fb.at
                                        ? ` · ${new Date(fb.at).toLocaleDateString(i18n.language)}`
                                        : ""}
                                    </p>
                                  ) : null}
                                </div>
                                <p className="mt-1.5 text-[11.5px] leading-relaxed text-trust-warn-text/90">
                                  {t("ko.rework.editHint")}
                                </p>
                              </div>
                            );
                          })()
                        : null}
                      <Field label={t("capture.fTitle")}>
                        <TextInput
                          value={edit.title}
                          onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                        />
                      </Field>
                      <Field label={t("capture.fStatement")}>
                        <textarea
                          value={edit.statement}
                          onChange={(e) => setEdit({ ...edit, statement: e.target.value })}
                          rows={3}
                          className={textareaCls}
                        />
                        {/* SCRUM-313: KI-Nachbearbeitung der Aussage — Vorschau + bewusste Übernahme.
                            KI hilft nur beim Formulieren; nach dem Speichern startet die Prüfung neu
                            (ko.editNote), keine Auto-Validierung. */}
                        <AiAssistBox
                          text={edit.statement}
                          runAssist={runAssist}
                          onApply={(next) => setEdit({ ...edit, statement: next })}
                        />
                      </Field>
                      {/* KW-STR / FR-STR-02/03/05: WYSIWYG-Body verlustfrei, Bildpalette aus Anhängen */}
                      <Field label={t("capture.fBody")}>
                        {/* SCRUM-337: primärer Einstieg in den großen Knowledge-Studio-Arbeitsraum. Das
                            Inline-Feld bleibt erhalten; das Studio arbeitet auf demselben edit.bodyHtml. */}
                        <button
                          type="button"
                          onClick={() => {
                            setStudioApplied(false);
                            setStudioOpen(true);
                          }}
                          className="mb-2 inline-flex items-center gap-1.5 rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
                        >
                          <Sparkles size={14} /> {t("studio.open")}
                        </button>
                        <KnowledgeInputStudio
                          open={studioOpen}
                          onClose={() => setStudioOpen(false)}
                          bodyHtml={edit.bodyHtml}
                          onApply={(bodyHtml) => {
                            setEdit({ ...edit, bodyHtml });
                            setStudioApplied(true);
                          }}
                          runAssist={runAssist}
                          images={(ko.attachments ?? [])
                            .filter((a) => a.objectId && a.mime.startsWith("image/"))
                            .map((a) => ({ objectId: a.objectId as string, name: a.name }))}
                          files={editorFilesFromAttachments(ko.attachments ?? [])}
                          attachments={ko.attachments ?? []}
                        />
                        {/* SCRUM-339: ehrliches Feedback — übernommen in den Entwurf, kein Auto-Save. */}
                        {studioApplied ? (
                          <p className="mb-2 rounded-btn bg-trust-pos-bg px-2.5 py-1.5 text-[11.5px] text-trust-pos-text">
                            {t("studio.applied")}
                          </p>
                        ) : null}
                        {/* SCRUM-317: kompakte Orientierung am Body-Feld (Struktur/Handlung/Blöcke/KI). */}
                        <EditorGuidance />
                        {/* SCRUM-323: Anhänge-Kontext — Bilder (einfügbar) vs. Dateien (Anhang/Evidence). */}
                        <EditorAttachmentContext attachments={ko.attachments ?? []} />
                        {/* SCRUM-324: kompakte Struktur-/Nachvollziehbarkeits-Signale (keine Validierung). */}
                        <EditorContentQuality
                          bodyHtml={edit.bodyHtml}
                          attachments={ko.attachments ?? []}
                        />
                        {/* SCRUM-319: bewusst wählbare Body-Strukturvorlagen (leer = setzen, sonst anhängen). */}
                        <BodyTemplateChooser
                          bodyHtml={edit.bodyHtml}
                          onApply={(bodyHtml) => setEdit({ ...edit, bodyHtml })}
                        />
                        <RichTextEditor
                          value={edit.bodyHtml}
                          onChange={(bodyHtml) => setEdit({ ...edit, bodyHtml })}
                          images={(ko.attachments ?? [])
                            .filter((a) => a.objectId && a.mime.startsWith("image/"))
                            .map((a) => ({ objectId: a.objectId as string, name: a.name }))}
                          files={editorFilesFromAttachments(ko.attachments ?? [])}
                        />
                        {/* SCRUM-315: KI-Nachbearbeitung des ausführlichen Inhalts im Edit-Modus —
                            Textbasis aus edit.bodyHtml, Übernahme als sicheres Body-HTML. ko.editNote
                            und die Statement-KI bleiben unverändert; keine Auto-Validierung. */}
                        <AiAssistBox
                          text={bodyTextForAssist(edit.bodyHtml)}
                          runAssist={runAssist}
                          applyFn={(mode, _original, suggestion) =>
                            applyBodyAssist(mode, edit.bodyHtml, suggestion)
                          }
                          onApply={(bodyHtml) => setEdit({ ...edit, bodyHtml })}
                          hintKey="capture.ai.bodyHint"
                          extraApplyActions={EDITOR_BLOCKS.map((block) => ({
                            labelKey: `capture.ai.applyAs.${block}`,
                            apply: (_original, suggestion) =>
                              applyBodyAssistBlock(edit.bodyHtml, suggestion, block),
                          }))}
                        />
                      </Field>
                      <ListEditor
                        label={t("capture.fConditions")}
                        items={edit.conditions}
                        onChange={(conditions) => setEdit({ ...edit, conditions })}
                      />
                      <ListEditor
                        label={t("capture.fMeasures")}
                        items={edit.measures}
                        onChange={(measures) => setEdit({ ...edit, measures })}
                      />
                      <TagEditor tags={edit.tags} onChange={(tags) => setEdit({ ...edit, tags })} />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={t("capture.fType")}>
                          <select
                            value={edit.type}
                            onChange={(e) =>
                              setEdit({ ...edit, type: e.target.value as KnowledgeType })
                            }
                            className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
                          >
                            {KNOWLEDGE_TYPES.map((k) => (
                              <option key={k} value={k}>
                                {t(`ktype.${k}`)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={t("capture.fCategory")}>
                          <TextInput
                            value={edit.category}
                            onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                          />
                        </Field>
                      </div>
                      {/* SCRUM-325: kompakter Änderungsüberblick vor dem Revidieren (kein Blocking). */}
                      <KoRevisionSummary original={ko} edit={edit} />
                      <p className="text-[12px] text-muted">{t("ko.editNote")}</p>
                      {/* SCRUM-344: Save-Confidence — nach Studio-Apply ehrlich klarmachen, dass der Inhalt
                          im Revisionsentwurf liegt; Speichern erzeugt neue Version + erneute Prüfung. */}
                      {studioApplied
                        ? (() => {
                            const conf = studioSaveConfidence("revision");
                            return (
                              <div className="rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-2.5">
                                <p className="text-[12.5px] font-semibold text-trust-warn-text">
                                  {t(conf.titleKey)}
                                </p>
                                <p className="mt-0.5 text-[11.5px] leading-relaxed text-trust-warn-text/90">
                                  {t(conf.hintKey)}
                                </p>
                                <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-trust-warn-text">
                                  {t(conf.nextStepKey)}
                                </p>
                              </div>
                            );
                          })()
                        : null}
                      {err ? (
                        <div className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                          {err}
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          disabled={save.isPending || edit.title.trim().length === 0}
                          onClick={() => save.mutate()}
                        >
                          {t("ko.saveEdit")}
                        </Button>
                        <Button variant="ghost" onClick={() => setEdit(null)}>
                          {t("ko.cancelEdit")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="mt-3 text-xl font-semibold text-ink">{ko.title}</h2>
                      <div className="mt-2">
                        <ConfidenceBar value={ko.confidence} />
                      </div>

                      <div className="mt-5 space-y-4">
                        <div>
                          <SectionLabel>{t("ko.statement")}</SectionLabel>
                          {ko.bodyHtml ? (
                            // KW-STR / FR-STR-05: sanitisierter WYSIWYG-Body; Fallback auf statement.
                            // SCRUM-318: lesbare Knowledge-Seiten-Rahmung mit kurzer Orientierung.
                            <div className="rounded-card border border-hairline bg-surface p-3">
                              <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-hairline pb-2">
                                <span className="text-[11.5px] font-semibold text-ink">
                                  {t(BODY_READ_TITLE_KEY)}
                                </span>
                                {bodyReadMode(ko.bodyHtml).hasBlocks ? (
                                  <span className="rounded-pill bg-page px-2 py-0.5 text-[10.5px] font-semibold text-muted">
                                    {t(BODY_READ_BLOCKS_KEY)}
                                  </span>
                                ) : null}
                              </div>
                              <SanitizedHtml
                                html={ko.bodyHtml}
                                className="prose-kw text-[14.5px] leading-relaxed text-text"
                              />
                              <p className="mt-2 border-t border-hairline pt-2 text-[11px] leading-relaxed text-muted">
                                {t(BODY_READ_NOTE_KEY)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-[14.5px] leading-relaxed text-text">
                              {ko.statement}
                            </p>
                          )}
                        </div>
                        {ko.conditions.length > 0 ? (
                          <div>
                            <SectionLabel>{t("ko.conditions")}</SectionLabel>
                            <ul className="list-inside list-disc text-[13.5px] text-text">
                              {ko.conditions.map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {ko.measures.length > 0 ? (
                          <div className="rounded-card bg-trust-pos-bg p-3">
                            <SectionLabel>{t("ko.measures")}</SectionLabel>
                            <ul className="list-inside list-disc text-[13.5px] text-trust-pos-text">
                              {ko.measures.map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {ko.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {ko.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-pill bg-page px-2 py-0.5 font-mono text-[11px] text-muted"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2 border-t border-hairline pt-4">
                        {role === "controller" || role === "admin" ? (
                          <>
                            <Button
                              variant="primary"
                              disabled={act.isPending}
                              onClick={() => act.mutate({ action: "rate", verdict: "up" })}
                            >
                              {t("ko.validate")}
                            </Button>
                            <Button
                              disabled={act.isPending}
                              onClick={() => act.mutate({ action: "rate", verdict: "warn" })}
                            >
                              {t("ko.conditional")}
                            </Button>
                            <Button
                              disabled={act.isPending}
                              onClick={() => act.mutate({ action: "rate", verdict: "down" })}
                            >
                              {t("ko.reject")}
                            </Button>
                          </>
                        ) : null}
                        <Button
                          disabled={act.isPending}
                          onClick={() => act.mutate({ action: "revalidate" })}
                        >
                          {t("ko.stillValid")}
                        </Button>
                        {canReview ? (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setConflict(
                                conflict ? null : { koB: "", type: "truth", description: "" },
                              )
                            }
                          >
                            {t("ko.reportConflict")}
                          </Button>
                        ) : null}
                      </div>

                      {conflict ? (
                        <div className="mt-4 space-y-3 rounded-card border border-trust-crit-fill/30 bg-trust-crit-bg/40 p-4">
                          <SectionLabel>{t("ko.conflictTitle")}</SectionLabel>
                          <Field label={t("ko.conflictTarget")}>
                            <select
                              value={conflict.koB}
                              onChange={(e) => setConflict({ ...conflict, koB: e.target.value })}
                              className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
                            >
                              <option value="">{t("ko.conflictTargetPlaceholder")}</option>
                              {(koList.data ?? [])
                                .filter((k) => k.id !== id)
                                .map((k) => (
                                  <option key={k.id} value={k.id}>
                                    {k.title}
                                  </option>
                                ))}
                            </select>
                          </Field>
                          <Field label={t("ko.conflictType")}>
                            <select
                              value={conflict.type}
                              onChange={(e) =>
                                setConflict({ ...conflict, type: e.target.value as ConflictType })
                              }
                              className="h-10 w-full rounded-input border border-hairline bg-surface px-2 text-sm"
                            >
                              {CONFLICT_TYPES.map((ct) => (
                                <option key={ct} value={ct}>
                                  {t(`con.type.${ct}`)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={t("ko.conflictDesc")}>
                            <textarea
                              value={conflict.description}
                              onChange={(e) =>
                                setConflict({ ...conflict, description: e.target.value })
                              }
                              rows={2}
                              className={textareaCls}
                            />
                          </Field>
                          <Button
                            variant="primary"
                            disabled={report.isPending || !conflict.koB}
                            onClick={() => report.mutate()}
                          >
                            {t("ko.conflictSubmit")}
                          </Button>
                        </div>
                      ) : null}

                      {err ? (
                        <div className="mt-3 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
                          {err}
                        </div>
                      ) : null}
                    </>
                  )}
                </Card>

                <div className="space-y-5">
                  {/* FE-LCY-03 / SCRUM-111: Bewährungssignal „Hat geholfen" */}
                  <Card className="space-y-2">
                    <SectionLabel>{t("ko.helpfulTitle")}</SectionLabel>
                    <p className="text-[12.5px] text-muted">{t("ko.helpfulHint")}</p>
                    <Button
                      variant="primary"
                      disabled={helpfulDisabled({
                        pending: helpful.isPending,
                        success: helpful.isSuccess,
                      })}
                      onClick={() => helpful.mutate()}
                    >
                      {helpfulLabel(
                        { success: helpful.isSuccess },
                        t("ko.helpful"),
                        t("ko.helpfulDone"),
                      )}
                    </Button>
                  </Card>

                  {/* SCRUM-129 / FE-KO-01+07: echte externe Quellen (nie peer-validiert) */}
                  {/* SCRUM-259: Anker-Ziel für die „Quelle ergänzen"-CTA (lokale Orientierung). */}
                  <Card id="ko-sources" className="scroll-mt-20 space-y-3">
                    <SectionLabel>{t("ko.sourcesTitle")}</SectionLabel>
                    {(ko.sources ?? []).length === 0 ? (
                      <p className="text-[13px] text-muted">{t("ko.sourcesEmpty")}</p>
                    ) : (
                      <ul className="space-y-2">
                        {(ko.sources ?? []).map((s) => (
                          <li key={s.id} className="rounded-input bg-page p-2.5">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[13.5px] font-medium text-text">
                                    {s.label}
                                  </span>
                                  <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                                    {t(sourceBadgeKey(s))}
                                  </span>
                                  {s.provider ? (
                                    <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted">
                                      {s.provider}
                                    </span>
                                  ) : null}
                                </div>
                                {s.url ? (
                                  <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block truncate font-mono text-[11px] text-ai hover:underline"
                                  >
                                    {s.url}
                                  </a>
                                ) : null}
                                {s.excerpt ? (
                                  <p className="mt-1 text-[12px] text-muted">{s.excerpt}</p>
                                ) : null}
                              </div>
                              {canEdit ? (
                                <button
                                  type="button"
                                  title={t("ko.sourceRemove")}
                                  disabled={removeSource.isPending}
                                  onClick={() => removeSource.mutate(s.id)}
                                  className="grid h-7 w-7 shrink-0 place-items-center rounded-btn text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                                >
                                  <X size={14} />
                                </button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {canEdit ? (
                      <div className="space-y-2 border-t border-hairline pt-3">
                        <TextInput
                          value={sourceForm.label}
                          onChange={(e) => setSourceForm((s) => ({ ...s, label: e.target.value }))}
                          placeholder={t("ko.sourceLabel")}
                        />
                        <TextInput
                          value={sourceForm.url}
                          onChange={(e) => setSourceForm((s) => ({ ...s, url: e.target.value }))}
                          placeholder={t("ko.sourceUrl")}
                        />
                        <TextInput
                          value={sourceForm.excerpt}
                          onChange={(e) =>
                            setSourceForm((s) => ({ ...s, excerpt: e.target.value }))
                          }
                          placeholder={t("ko.sourceExcerpt")}
                        />
                        <p className="text-[11.5px] text-muted-2">{t("ko.sourcesHint")}</p>
                        <Button
                          variant="primary"
                          disabled={addSource.isPending || !isSourceFormValid(sourceForm)}
                          onClick={() => addSource.mutate()}
                        >
                          {t("ko.sourceAdd")}
                        </Button>
                      </div>
                    ) : null}

                    {/* SCRUM-118 / FR-EXT-02: externe Quellensuche (Server-Proxy) */}
                    {canEdit ? (
                      <div className="space-y-2 border-t border-hairline pt-3">
                        <SectionLabel>{t("ext.title")}</SectionLabel>
                        <p className="text-[11.5px] text-muted-2">{t("ext.hint")}</p>
                        <form
                          className="flex gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (extQuery.trim()) {
                              extSearch.mutate(extQuery.trim());
                            }
                          }}
                        >
                          <TextInput
                            value={extQuery}
                            onChange={(e) => setExtQuery(e.target.value)}
                            placeholder={t("ext.placeholder")}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            disabled={extSearch.isPending || extQuery.trim().length === 0}
                          >
                            {t("ext.search")}
                          </Button>
                        </form>
                        {extResults.length > 0 ? (
                          <ul className="space-y-1.5">
                            {extResults.map((r) => (
                              <li
                                key={r.url}
                                className="rounded-input border border-hairline p-2.5"
                              >
                                <div className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[13px] font-medium text-text">
                                        {r.title}
                                      </span>
                                      <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted">
                                        {r.provider}
                                      </span>
                                    </div>
                                    {r.snippet ? (
                                      <p className="mt-0.5 text-[11.5px] text-muted">{r.snippet}</p>
                                    ) : null}
                                    <a
                                      href={r.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block truncate font-mono text-[10.5px] text-ai hover:underline"
                                    >
                                      {r.url}
                                    </a>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    disabled={attachExternal.isPending}
                                    onClick={() => attachExternal.mutate(r)}
                                  >
                                    {t("ext.attach")}
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>

                  {/* SCRUM-131 / FE-KO-06: Quelle/Beitrag melden (Review-Kommentar) */}
                  <Card className="space-y-2">
                    <SectionLabel>{t("ko.sourceTitle")}</SectionLabel>
                    <textarea
                      value={source.contribution}
                      onChange={(e) => setSource((s) => ({ ...s, contribution: e.target.value }))}
                      placeholder={t("ko.sourceContribution")}
                      rows={3}
                      className={textareaCls}
                    />
                    <TextInput
                      value={source.source ?? ""}
                      onChange={(e) => setSource((s) => ({ ...s, source: e.target.value }))}
                      placeholder={t("ko.sourceRef")}
                    />
                    <p className="text-[11.5px] text-muted-2">{t("ko.sourceHint")}</p>
                    <Button
                      variant="primary"
                      disabled={sourceContribution.isPending || !isSourceContributionValid(source)}
                      onClick={() => sourceContribution.mutate()}
                    >
                      {t("ko.sourceSubmit")}
                    </Button>
                  </Card>

                  <Card>
                    <SectionLabel>{t("ko.provenance")}</SectionLabel>
                    <ProvenanceLine
                      author={nameOf(ko.author)}
                      originalAuthor={nameOf(ko.originalAuthor)}
                      domain={ko.category}
                      version={ko.version}
                    />
                    {canTransfer ? (
                      <div className="mt-3 border-t border-hairline pt-3">
                        <div className="mb-1.5 font-mono text-micro uppercase tracking-wider text-muted-2">
                          {t("ko.transferTitle")}
                        </div>
                        <div className="mb-2 text-[12px] text-muted">
                          {t("ko.transferOriginal")}: {nameOf(ko.originalAuthor)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label={t("ko.transferTitle")}
                            value={newAuthor}
                            onChange={(e) => setNewAuthor(e.target.value)}
                            className="h-9 flex-1 rounded-input border border-hairline bg-surface px-2 text-[13px] text-text outline-none focus:border-ink/30"
                          >
                            <option value="">{t("ko.transferPick")}</option>
                            {(dir.data ?? [])
                              .filter((d) => d.id !== ko.author)
                              .map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                          </select>
                          <Button
                            variant="primary"
                            disabled={transfer.isPending || !newAuthor}
                            onClick={() => transfer.mutate(newAuthor)}
                          >
                            {t("ko.transfer")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card>

                  {/* Pedi 02.07.: Löschen (Autor oder Controller/Admin) — bewusst unauffällig,
                      mit Inline-Bestätigung; Route erzwingt dieselbe Regel serverseitig. */}
                  {(role === "admin" || role === "controller" || ko.author === user?.id) && (
                    <Card>
                      {confirmDelete ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex-1 text-[12.5px] font-semibold text-trust-crit-text">
                            {t("ko.deleteQ")}
                          </span>
                          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                            {t("ko.deleteKeep")}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={removeKo.isPending}
                            onClick={() => removeKo.mutate()}
                          >
                            {t("ko.deleteYes")}
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(true)}
                          className="inline-flex items-center gap-1.5 rounded-btn px-2 py-1 text-[12.5px] font-semibold text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                        >
                          <Trash2 size={14} />
                          {t("ko.deleteButton")}
                        </button>
                      )}
                    </Card>
                  )}

                  {/* Audit B1 (Pedi 02.07.): Anlagen-Kopplung — ruhige Karte, ?-Hilfe statt Textwand. */}
                  <Card>
                    <div className="flex items-center gap-1.5">
                      <SectionLabel>{t("ko.couple.title")}</SectionLabel>
                      <HelpTip title={t("ko.couple.title")} body={t("ko.couple.help")} />
                    </div>
                    {couplings.data && couplings.data.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {couplings.data.map((a) => (
                          <span
                            key={a}
                            className="inline-flex items-center gap-1 rounded-pill bg-page px-2.5 py-1 text-[12px] font-medium text-text"
                          >
                            <Link2 size={12} className="text-muted-2" />
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[12px] text-muted-2">{t("ko.couple.empty")}</p>
                    )}
                    {role !== "viewer" ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-hairline pt-2.5">
                        <TextInput
                          value={coupleAsset}
                          onChange={(e) => setCoupleAsset(e.target.value)}
                          placeholder={ko.asset ? ko.asset : t("ko.couple.placeholder")}
                          className="h-9 min-w-[10rem] flex-1"
                        />
                        <Button
                          variant="ghost"
                          disabled={couple.isPending || !(coupleAsset.trim() || ko.asset?.trim())}
                          onClick={() =>
                            couple.mutate((coupleAsset.trim() || ko.asset || "").trim())
                          }
                        >
                          <Link2 size={14} />
                          {t("ko.couple.cta")}
                        </Button>
                      </div>
                    ) : null}
                  </Card>

                  {/* SCRUM-95/96: Gültigkeit & Schutz — ehrlich abgeleitete Sicht, keine Persistenz. */}
                  {(() => {
                    const v = validityProtectionView(ko, pending.data ?? [], conflicts.data ?? []);
                    return (
                      <Card className="space-y-2">
                        <SectionLabel>{t("ext.validity.title")}</SectionLabel>
                        <dl className="space-y-1.5 text-[12.5px]">
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-muted">{t("ext.validity.freshness")}</dt>
                            <dd className="font-mono text-text">
                              {t(`ext.freshness.${v.freshnessStatus}`)}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-muted">{t("ext.protection.ip")}</dt>
                            <dd className="font-mono text-muted-2">
                              {t("ext.protection.notRated")}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-muted">{t("ext.validity.outputEligible")}</dt>
                            <dd
                              className={`font-mono ${v.outputEligible ? "text-trust-pos-text" : "text-muted-2"}`}
                            >
                              {t(
                                v.outputEligible
                                  ? "ext.outputEligible.yes"
                                  : "ext.outputEligible.no",
                              )}
                            </dd>
                          </div>
                        </dl>
                        <p className="border-t border-hairline pt-2 text-[12.5px] text-text">
                          {t("ext.validity.recommendation")}:{" "}
                          {t(`ext.recommendation.${v.recommendation}`)}
                        </p>
                      </Card>
                    );
                  })()}

                  {/* SCRUM-142: Herkunft & Verlauf (Lineage) — datenbasiert */}
                  {(() => {
                    const related = relatedKos(ko, koList.data ?? []);
                    const summary = lineageSummary(ko, related.length);
                    const events = koAuditEvents(audit.data ?? [], ko.id)
                      .slice(-6)
                      .reverse();
                    return (
                      <>
                        <Card className="space-y-3">
                          <SectionLabel>{t("ko.lineageTitle")}</SectionLabel>
                          <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                            <div className="rounded-input bg-page p-2">
                              <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
                                {t("ko.lineageOrigin")}
                              </div>
                              <div className="text-text">{nameOf(ko.originalAuthor)}</div>
                              {summary.authorTransferred ? (
                                <div className="text-[11px] text-muted">
                                  → {nameOf(ko.author)} {t("ko.lineageTransferred")}
                                </div>
                              ) : null}
                            </div>
                            <div className="rounded-input bg-page p-2">
                              <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
                                {t("ko.lineageVersions")}
                              </div>
                              <div className="text-text">
                                v{summary.versions} · {summary.historyCount}{" "}
                                {t("ko.lineageChanges")}
                              </div>
                            </div>
                            <div className="rounded-input bg-page p-2">
                              <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
                                {t("ko.sourcesTitle")}
                              </div>
                              <div className="text-text">{summary.sourceCount}</div>
                            </div>
                            <div className="rounded-input bg-page p-2">
                              <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
                                {t("ko.lineageRelated")}
                              </div>
                              <div className="text-text">{summary.relatedCount}</div>
                            </div>
                          </div>
                          {events.length > 0 ? (
                            <div>
                              <div className="mb-1.5 font-mono text-micro uppercase tracking-wider text-muted-2">
                                {t("ko.lineageAudit")}
                              </div>
                              <ul className="space-y-1">
                                {events.map((e) => (
                                  <li
                                    key={e.seq}
                                    className="flex items-center gap-2 text-[11.5px] text-muted"
                                  >
                                    <span className="font-mono text-muted-2">
                                      {new Date(e.at).toLocaleDateString()}
                                    </span>
                                    <span className="font-semibold text-text">{e.action}</span>
                                    <span className="ml-auto font-mono text-muted-2">
                                      {nameOf(e.actor)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          <Link
                            to="/graph"
                            className="inline-block text-[12px] font-semibold text-ai hover:underline"
                          >
                            {t("ko.lineageGraphLink")} →
                          </Link>
                        </Card>

                        {/* SCRUM-130: verlinkbares Wissensnetz — verwandte Wissensobjekte */}
                        <Card className="space-y-2">
                          <SectionLabel>{t("ko.relatedTitle")}</SectionLabel>
                          {related.length === 0 ? (
                            <p className="text-[13px] text-muted">{t("ko.relatedEmpty")}</p>
                          ) : (
                            <ul className="space-y-2">
                              {related.map((r) => (
                                <li key={r.id}>
                                  <Link
                                    to={`/wissen/${r.id}`}
                                    className="block rounded-input bg-page p-2 hover:bg-hairline-soft"
                                  >
                                    <div className="truncate text-[13px] text-text">{r.title}</div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {r.reasons.map((reason) => (
                                        <span
                                          key={reason}
                                          className="rounded-pill bg-ai-surface-1 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai"
                                        >
                                          {t(`ko.relatedReason.${reason}`)}
                                        </span>
                                      ))}
                                      {r.via.length > 0 ? (
                                        <span className="font-mono text-[10.5px] text-muted-2">
                                          {r.via.slice(0, 3).join(" · ")}
                                        </span>
                                      ) : null}
                                    </div>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </Card>
                      </>
                    );
                  })()}

                  <Card>
                    <SectionLabel>{t("ko.history")}</SectionLabel>
                    <ol className="space-y-3">
                      {ko.history.map((h) => (
                        <li key={h.version} className="border-l-2 border-hairline pl-3">
                          <div className="font-mono text-[11px] text-muted-2">
                            v{h.version} · {new Date(h.at).toLocaleDateString()}
                          </div>
                          <div className="text-[12.5px] text-text">
                            {h.note || nameOf(h.author)}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </Card>

                  <Card>
                    <SectionLabel>{t("ko.evidenceTitle")}</SectionLabel>
                    {/* SCRUM-168: read-only Evidence-/Source-Konsistenzstatus (keine Datenänderung). */}
                    {!evidence.isLoading && !evidence.isError
                      ? (() => {
                          const consistency = analyzeEvidenceConsistency(ko, evidence.data ?? []);
                          return (
                            <div className="mb-3 rounded-card border border-hairline bg-surface p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[12px] font-semibold text-text">
                                  {t("ko.evCons.title")}
                                </span>
                                <span
                                  className={`rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                                    consistency.status === "ok"
                                      ? "bg-trust-pos-bg text-trust-pos-text"
                                      : "bg-trust-warn-bg text-trust-warn-text"
                                  }`}
                                >
                                  {t(`ko.evCons.status.${consistency.status}`)}
                                </span>
                              </div>
                              <div className="mt-1 font-mono text-[10.5px] text-muted-2">
                                {t("ko.evCons.counts", {
                                  sources: String(consistency.sourceCount),
                                  attachments: String(consistency.attachmentCount),
                                  evidence: String(consistency.evidenceCount),
                                })}
                              </div>
                              {consistency.findings.length > 0 ? (
                                <ul className="mt-2 space-y-1">
                                  {consistency.findings.map((f) => (
                                    <li
                                      key={`${f.kind}:${f.ref}`}
                                      className="flex items-start gap-2 text-[11.5px] text-muted"
                                    >
                                      <span
                                        className={`mt-0.5 rounded-pill px-1.5 py-0.5 font-mono text-[9.5px] uppercase ${
                                          f.severity === "warning"
                                            ? "bg-trust-warn-bg text-trust-warn-text"
                                            : "bg-hairline-soft text-muted-2"
                                        }`}
                                      >
                                        {t(`ko.evCons.finding.${f.kind}`)}
                                      </span>
                                      <span className="break-words">{f.label}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-[11.5px] text-muted">
                                  {t("ko.evCons.allOk")}
                                </p>
                              )}
                            </div>
                          );
                        })()
                      : null}
                    {/* SCRUM-175: kompakter versionierter Evidence-Freshness-Status für dieses KO. */}
                    {!evidence.isLoading && !evidence.isError
                      ? (() => {
                          const row = analyzeEvidenceFreshness({
                            kos: [ko],
                            evidence: evidence.data ?? [],
                          }).rows[0];
                          if (!row) {
                            return null;
                          }
                          const tone = evidenceFreshnessTone(row.status);
                          const toneClass =
                            tone === "pos"
                              ? "bg-trust-pos-bg text-trust-pos-text"
                              : tone === "warn"
                                ? "bg-trust-warn-bg text-trust-warn-text"
                                : "bg-hairline-soft text-muted-2";
                          return (
                            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-surface p-3">
                              <span className="text-[12px] font-semibold text-text">
                                {t("ko.evFresh.title")}
                              </span>
                              <span
                                className={`rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${toneClass}`}
                              >
                                {t(evidenceFreshnessLabelKey(row.status))}
                              </span>
                              <span className="font-mono text-[10.5px] text-muted-2">
                                {t("ko.evFresh.counts", {
                                  version: String(row.version),
                                  current: String(row.currentCount),
                                  older: String(row.olderCount),
                                })}
                              </span>
                            </div>
                          );
                        })()
                      : null}
                    {/* SCRUM-170: read-only Gruppierung der Evidence nach KO-Version (via koVersion). */}
                    {!evidence.isLoading && !evidence.isError
                      ? (() => {
                          const byVersion = groupEvidenceByVersion(
                            evidence.data ?? [],
                            versions.data ?? [],
                          );
                          if (byVersion.groups.length === 0) {
                            return null;
                          }
                          return (
                            <div className="mb-3 rounded-card border border-hairline bg-surface p-3">
                              <span className="text-[12px] font-semibold text-text">
                                {t("ko.evVer.title")}
                              </span>
                              <ul className="mt-2 space-y-1.5">
                                {byVersion.groups.map((g) => (
                                  <li
                                    key={g.version}
                                    className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted"
                                  >
                                    <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
                                      {t("ko.evVer.version", { n: String(g.version) })}
                                    </span>
                                    <span className="font-mono text-[10.5px] text-muted-2">
                                      {t("ko.evVer.counts", {
                                        sources: String(g.sourceCount),
                                        attachments: String(g.attachmentCount),
                                      })}
                                    </span>
                                    {g.latestAt ? (
                                      <span className="font-mono text-[10px] text-muted-2">
                                        {t("ko.evVer.latest", {
                                          at: new Date(g.latestAt).toLocaleDateString(),
                                        })}
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                              {byVersion.versionsWithoutEvidence.length > 0 ? (
                                <p className="mt-2 text-[11px] text-muted-2">
                                  {t("ko.evVer.without", {
                                    versions: byVersion.versionsWithoutEvidence
                                      .map((v) => `v${v}`)
                                      .join(", "),
                                  })}
                                </p>
                              ) : null}
                            </div>
                          );
                        })()
                      : null}
                    {evidence.isLoading ? (
                      <p className="text-[13px] text-muted">{t("state.loading")}</p>
                    ) : evidence.isError ? (
                      <p className="text-[13px] text-danger">{t("state.error")}</p>
                    ) : evidenceRows(evidence.data ?? []).length === 0 ? (
                      <p className="text-[13px] text-muted">{t("ko.evidenceEmpty")}</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {evidenceRows(evidence.data ?? []).map((ev) => (
                          <li
                            key={ev.key}
                            className="rounded-card border border-hairline bg-surface p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[13px] font-semibold text-text">
                                  {ev.title}
                                </div>
                                <div className="mt-1 font-mono text-[10.5px] text-muted-2">
                                  {nameOf(ev.createdBy)} ·{" "}
                                  {new Date(ev.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
                                {t(`ko.evidenceKind.${ev.kind}`)}
                              </span>
                            </div>
                            {ev.meta.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {ev.meta.map((m) => (
                                  <span
                                    key={m}
                                    className="rounded-pill bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-2"
                                  >
                                    {m}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  <Card>
                    <SectionLabel>{t("ko.snapshotsTitle")}</SectionLabel>
                    {versions.isLoading ? (
                      <p className="text-[13px] text-muted">{t("state.loading")}</p>
                    ) : versions.isError ? (
                      <p className="text-[13px] text-danger">{t("state.error")}</p>
                    ) : koVersionRows(versions.data ?? []).length === 0 ? (
                      <p className="text-[13px] text-muted">{t("ko.snapshotsEmpty")}</p>
                    ) : (
                      <ol className="space-y-3">
                        {koVersionRows(versions.data ?? []).map((v) => (
                          <li
                            key={v.key}
                            className="rounded-card border border-hairline bg-surface p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-mono text-[11px] text-muted-2">
                                  v{v.version} · {new Date(v.at).toLocaleDateString()} ·{" "}
                                  {nameOf(v.author)}
                                </div>
                                <div className="mt-1 text-[13px] font-semibold text-text">
                                  {v.title}
                                </div>
                              </div>
                              <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
                                {v.status}
                              </span>
                            </div>
                            <p className="mt-2 text-[12.5px] text-muted">{v.excerpt}</p>
                            {(() => {
                              const diff = diffForVersion(versions.data ?? [], v.version);
                              if (!diff || diff.fromVersion === null) {
                                return (
                                  <p className="mt-2 font-mono text-[10.5px] text-muted-2">
                                    {t("ko.snapshotInitial")}
                                  </p>
                                );
                              }
                              return diff.changed.length === 0 ? (
                                <p className="mt-2 font-mono text-[10.5px] text-muted-2">
                                  {t("ko.snapshotNoChanges")}
                                </p>
                              ) : (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {diff.changed.map((field) => (
                                    <span
                                      key={field}
                                      className="rounded-pill bg-warn-surface px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-warn"
                                    >
                                      {t(`ko.snapshotField.${field}`)}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                            <p className="mt-1 font-mono text-[10.5px] text-muted-2">{v.note}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Card>

                  <Card>
                    <SectionLabel>{t("ko.comments")}</SectionLabel>
                    <div className="space-y-3">
                      {(ko.comments ?? []).length === 0 ? (
                        <p className="text-[13px] text-muted">{t("ko.commentsEmpty")}</p>
                      ) : (
                        <ul className="space-y-2.5">
                          {(ko.comments ?? []).map((cm) => (
                            <li key={cm.id} className="border-l-2 border-hairline pl-3">
                              <div className="font-mono text-[11px] text-muted-2">
                                {nameOf(cm.author)} · {new Date(cm.at).toLocaleDateString()}
                              </div>
                              <div className="text-[13px] text-text">{cm.text}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="space-y-2 border-t border-hairline pt-3">
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          rows={2}
                          placeholder={t("ko.commentPlaceholder")}
                          className={textareaCls}
                        />
                        <Button
                          variant="primary"
                          disabled={comment.isPending || commentText.trim().length === 0}
                          onClick={() => comment.mutate()}
                        >
                          {t("ko.commentAdd")}
                        </Button>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <SectionLabel>{t("ko.attachments")}</SectionLabel>
                    {(ko.attachments ?? []).length === 0 ? (
                      <p className="text-[13px] text-muted">{t("ko.attachmentsEmpty")}</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {(ko.attachments ?? []).map((a) => (
                          <div key={a.id} className="group relative">
                            {/* SCRUM-121: Vorschau aus thumbnail (neu) oder dataUrl (alt); Original via Objekt-Ref */}
                            <button
                              type="button"
                              className="block w-full"
                              onClick={() => void openAttachment(a)}
                              title={a.name}
                            >
                              <img
                                src={a.thumbnail ?? a.dataUrl ?? ""}
                                alt={a.name}
                                className="h-20 w-full rounded-card border border-hairline object-cover"
                              />
                            </button>
                            {canEdit ? (
                              <button
                                type="button"
                                aria-label={t("ko.attachmentRemove")}
                                onClick={() => detach.mutate(a.id)}
                                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <X size={12} />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                    {canEdit ? (
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text">
                        <Paperclip size={14} />
                        {attach.isPending ? t("ko.attachmentUploading") : t("ko.attachmentAdd")}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={attach.isPending}
                          onChange={(e) => void onPickFile(e)}
                        />
                      </label>
                    ) : null}
                  </Card>
                </div>
              </div>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
