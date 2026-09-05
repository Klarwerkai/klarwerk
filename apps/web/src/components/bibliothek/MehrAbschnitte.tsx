import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Paperclip, X } from "lucide-react";
import { type ChangeEvent, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import {
  useAudit,
  useConflicts,
  useDirectory,
  useExternalPolicy,
  useKoEvidence,
  useKoNeighbors,
  useKoVersions,
  useKos,
  useLifecyclePending,
} from "../../api/hooks";
import type {
  Confidentiality,
  ConflictType,
  ExternalResult,
  KnowledgeObject,
} from "../../api/types";
import { useRole } from "../../app/RoleContext";
import { useToast } from "../../app/ToastContext";
import { auditActionLabel } from "../../lib/auditAction";
import { objectRawHref } from "../../lib/bodyFileLink";
import { CONFIDENTIALITY_LEVELS, confidentialityOf } from "../../lib/confidentiality";
import { conflictImpact, conflictLimitedUsability } from "../../lib/conflictImpact";
import { isDemoKnowledge } from "../../lib/demoKnowledge";
import { deriveStatus } from "../../lib/displayStatus";
import { groupEvidenceByVersion } from "../../lib/evidenceByVersion";
import { analyzeEvidenceConsistency } from "../../lib/evidenceConsistency";
import { analyzeEvidenceFreshness } from "../../lib/evidenceFreshness";
import { evidenceFreshnessLabelKey } from "../../lib/evidenceFreshnessView";
import { validityProtectionView } from "../../lib/extConcept";
import {
  SOURCE_ATTACH_HINT_KEYS,
  canAttachExternalResult,
  canSearchExternal,
  sourceAttachHint,
} from "../../lib/externalAttachGate";
import { containsExternalUnchecked } from "../../lib/externalProvenance";
import { toSourcePayload as externalToSourcePayload } from "../../lib/externalSearch";
import { fileToThumbDataUrl, readFileAsDataUrl } from "../../lib/files";
import { evidenceRows } from "../../lib/koEvidence";
import { koAuditEvents, lineageSummary } from "../../lib/koLineage";
import { koOverview } from "../../lib/koOverview";
import {
  EMPTY_SOURCE_FORM,
  type SourceFormInput,
  isSourceFormValid,
  sourceBadgeKey,
  toAddSourceRequest,
  toSourcePayload,
} from "../../lib/koSource";
import { diffForVersion } from "../../lib/koVersionDiff";
import { koVersionRows } from "../../lib/koVersionSnapshots";
import {
  type SourceContributionInput,
  formatSourceComment,
  isSourceContributionValid,
} from "../../lib/sourceContribution";
import { trustExplainer } from "../../lib/trustExplainer";
import { useAuthorName } from "../../lib/useAuthorName";
import { useReadiness } from "../../lib/useReadiness";
import { AiCheckCoverageNotes } from "../AiCheckCoverageHint";
import { ConflictTargetPicker } from "../ConflictTargetPicker";
import { ExternalUrlText } from "../ExternalUrlText";
import { KnowledgeNeighborhood } from "../KnowledgeNeighborhood";
import { RoleLink } from "../RoleLink";
import { UploadLimitsHint } from "../UploadLimitsHint";
import { ConfidenceBar, KnowledgeTypeTag, ProvenanceLine } from "../trust";
import { Button, Field, TextInput, cx } from "../ui";

// ==================================================================================================
// JOB 3063 · H4 — „MEHR": DIE DREIZEHN ABSCHNITTE, ZUGEKLAPPT ALS VORGABE.
// ==================================================================================================
//
// Bis zu diesem Auftrag war jeder dieser dreizehn Abschnitte eine eigene `<Card>` auf der
// Detailseite — dreizehn Karten mit Einleitungssätzen und vier Hilfe-Tipps, 3.082 Zeichen sichtbarer
// Text an einem frisch erfassten Objekt (gemessen 04.09. in Chromium). Pedis Urteil dazu: „Text über
// Text über Text."
//
// JETZT: EINE Zeile „Mehr", darunter dreizehn schlichte Zeilen mit Titel. KEINE Hilfe-Tipps, KEINE
// Einleitungssätze — die FUNKTIONEN darin sind unverändert (Quelle anlegen, extern suchen und
// anhängen, Beitrag melden, Vertraulichkeit ändern, Autor übertragen, Anlage koppeln, kommentieren,
// Anhang hochladen, Konflikt melden, Nachbarschaft erkunden).
//
// DIESE KOMPONENTE WIRD ERST BEIM AUFKLAPPEN GEMOUNTET (s. `BibliothekLesen`). Damit laufen ihre
// zehn Abfragen (Belege, Fassungen, Audit, Nachbarschaft, Kopplungen, Verzeichnis, …) nur dann, wenn
// jemand sie sehen will — auf der Lesefläche selbst kostet „Mehr" nichts.

/**
 * Eine der dreizehn Zeilen. Der Inhalt wird ERST BEIM AUFKLAPPEN gezeichnet (`offen`), nicht nur
 * versteckt: ein `<details>` rendert seine Kinder auch zugeklappt, und dann liefe hinter jeder
 * zugeklappten Zeile ihre Arbeit weiter — Bilder, Nachbarschaftszeichnung, Listen. Zugeklappt steht
 * hier deshalb wirklich nur der Titel.
 */
function Abschnitt({
  schluessel,
  titel,
  children,
}: {
  schluessel: string;
  titel: string;
  children: ReactNode;
}): JSX.Element {
  const [offen, setOffen] = useState(false);
  return (
    <details
      data-bib-abschnitt={schluessel}
      open={offen}
      onToggle={(e) => setOffen((e.currentTarget as HTMLDetailsElement).open)}
      className="border-b border-hairline-soft last:border-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-[13px] text-muted">
        <span>{titel}</span>
        <span aria-hidden className="text-[11px] text-muted-2">
          ›
        </span>
      </summary>
      {offen ? <div className="pb-4 text-[12.5px] text-text">{children}</div> : null}
    </details>
  );
}

const CONFLICT_TYPES: readonly ConflictType[] = [
  "truth",
  "experience",
  "context",
  "temporal",
  "role",
];

const textareaCls =
  "w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none focus:border-ink/30";

export function MehrAbschnitte({ ko }: { ko: KnowledgeObject }): JSX.Element {
  const { t, i18n } = useTranslation();
  const id = ko.id;
  const { role } = useRole();
  const { push } = useToast();
  const qc = useQueryClient();
  const nameOf = useAuthorName();
  const canEdit = role !== "viewer";
  const canReview = role === "controller" || role === "admin";
  const canTransfer = role === "admin";

  const evidence = useKoEvidence(id);
  const versions = useKoVersions(id);
  const audit = useAudit();
  const neighborhood = useKoNeighbors(id);
  const koList = useKos();
  const conflicts = useConflicts();
  const pending = useLifecyclePending();
  const dir = useDirectory();
  const extPolicy = useExternalPolicy();
  const extStage = extPolicy.data?.stage ?? null;
  const extAttachAllowed = canAttachExternalResult(extStage);

  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: ["ko", id] });
    void qc.invalidateQueries({ queryKey: ["validation"] });
    void qc.invalidateQueries({ queryKey: ["kos"] });
    void qc.invalidateQueries({ queryKey: ["library"] });
    void qc.invalidateQueries({ queryKey: ["conflicts"] });
  };
  const fehlerToast = (e: unknown): void =>
    push("error", e instanceof ApiError ? e.message : t("state.error"));

  // ---- Quellen ---------------------------------------------------------------------------------
  const [sourceForm, setSourceForm] = useState<SourceFormInput>({ ...EMPTY_SOURCE_FORM });
  const sourceGateHint = sourceAttachHint(extStage, sourceForm.url);
  const addSource = useMutation({
    mutationFn: () =>
      endpoints.ko.act(id, { action: "add-source", source: toSourcePayload(sourceForm) }),
    onSuccess: () => {
      invalidate();
      setSourceForm({ ...EMPTY_SOURCE_FORM });
      push("success", t("ko.sourceAdded"));
    },
    onError: fehlerToast,
  });
  const removeSource = useMutation({
    mutationFn: (sourceId: string) => endpoints.ko.act(id, { action: "remove-source", sourceId }),
    onSuccess: invalidate,
    onError: fehlerToast,
  });

  // ---- Externes Wissen -------------------------------------------------------------------------
  const [extQuery, setExtQuery] = useState("");
  const [extResults, setExtResults] = useState<ExternalResult[]>([]);
  const extSearch = useMutation({
    mutationFn: (q: string) => endpoints.external.search(q),
    onSuccess: (results) => setExtResults(results),
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("ext.unavailable")),
  });
  const attachExternal = useMutation({
    mutationFn: (result: ExternalResult) =>
      endpoints.ko.act(id, {
        action: "add-source",
        source: toAddSourceRequest(externalToSourcePayload(result)),
      }),
    onSuccess: () => {
      invalidate();
      push("success", t("ko.sourceAdded"));
    },
    onError: fehlerToast,
  });

  // ---- Quelle/Beitrag melden -------------------------------------------------------------------
  const [source, setSource] = useState<SourceContributionInput>({ contribution: "", source: "" });
  const sourceContribution = useMutation({
    mutationFn: () =>
      endpoints.ko.act(id, { action: "comment", text: formatSourceComment(source) }),
    onSuccess: () => {
      invalidate();
      setSource({ contribution: "", source: "" });
      push("success", t("ko.sourceSaved"));
    },
    onError: fehlerToast,
  });

  // ---- Provenienz: Stufe ändern, Autor übertragen ----------------------------------------------
  const act = useMutation({
    mutationFn: (body: Parameters<typeof endpoints.ko.act>[1]) => endpoints.ko.act(id, body),
    onSuccess: invalidate,
    onError: fehlerToast,
  });
  const [newAuthor, setNewAuthor] = useState("");
  const transfer = useMutation({
    mutationFn: (next: string) =>
      endpoints.ko.act(id, { action: "transfer-author", newAuthor: next }),
    onSuccess: () => {
      invalidate();
      setNewAuthor("");
      push("success", t("ko.transferDone"));
    },
    onError: fehlerToast,
  });

  // ---- Kopplung --------------------------------------------------------------------------------
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
    onError: fehlerToast,
  });

  // ---- Kommentare ------------------------------------------------------------------------------
  const [commentText, setCommentText] = useState("");
  const comment = useMutation({
    mutationFn: () => endpoints.ko.act(id, { action: "comment", text: commentText.trim() }),
    onSuccess: () => {
      invalidate();
      setCommentText("");
    },
    onError: fehlerToast,
  });

  // ---- Anhänge ---------------------------------------------------------------------------------
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
        purpose: "attachment",
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
    onSuccess: invalidate,
    onError: fehlerToast,
  });
  const detach = useMutation({
    mutationFn: (attachmentId: string) => endpoints.ko.act(id, { action: "detach", attachmentId }),
    onSuccess: invalidate,
    onError: fehlerToast,
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
      push("error", t("state.error"));
    }
  };
  const openAttachment = (a: { dataUrl?: string; objectId?: string }): void => {
    if (a.objectId) {
      const href = objectRawHref(a.objectId);
      if (href) {
        window.open(href, "_blank", "noopener");
      }
      return;
    }
    if (a.dataUrl) {
      window.open(a.dataUrl, "_blank", "noopener");
    }
  };

  // ---- Konflikt melden -------------------------------------------------------------------------
  const [conflict, setConflict] = useState({ koB: "", type: "truth" as ConflictType, desc: "" });
  const [pickOpen, setPickOpen] = useState(false);
  const conflictTitle = (koList.data ?? []).find((k) => k.id === conflict.koB)?.title ?? "";
  const report = useMutation({
    mutationFn: () =>
      endpoints.ko.act(id, {
        action: "conflict",
        conflict: {
          koA: id,
          koB: conflict.koB,
          type: conflict.type,
          description: conflict.desc,
        },
      }),
    onSuccess: () => {
      invalidate();
      setConflict({ koB: "", type: "truth", desc: "" });
    },
    onError: fehlerToast,
  });

  // A27 · JOB 3025 · JOB 3068 (N5): DIE AUSKUNFT AN DIE VERFASSERIN STEHT NICHT MEHR HIER.
  //
  // Sie hing bis zu diesem Auftrag im Abschnitt „Konflikt" — also hinter der zugeklappten Zeile
  // „Mehr" und damit hinter einem Klick. N5 verlangt „DAUERHAFT"; sie ist deshalb in die Lesespalte
  // gezogen (`BibliothekLesen.tsx`, Kopf „DER EIGENE BEFUND"). Der Aufruf ist hier VOLLSTÄNDIG
  // entfernt und nicht daneben belassen: zwei Flächen, die denselben Befund je eigen auslegen, sind
  // genau die Drift, gegen die `lib/eigeneKollision.ts:15-17` gebaut ist.

  // SCRUM-357 / AG-14: ein offener Konflikt begrenzt die Nutzbarkeit ehrlich (ready → in Prüfung).
  const usability = conflictLimitedUsability(
    koOverview(ko).usability,
    conflictImpact(ko.id, conflicts.data ?? []),
  );
  const lineage = lineageSummary(ko, neighborhood.data?.total ?? 0);
  const auditEvents = koAuditEvents(audit.data ?? [], ko.id)
    .slice(-6)
    .reverse();
  const gueltigkeit = validityProtectionView(ko, pending.data ?? [], conflicts.data ?? []);

  return (
    <div data-testid="bib-mehr-abschnitte" className="flex flex-col">
      {/* 1 — Konflikt */}
      <Abschnitt schluessel="konflikt" titel={t("ko.mehr.konflikt")}>
        {/* mega29 C1: die Deckung des KI-Laufs schränkt jede Konfliktaussage ein — sie steht
            deshalb hier, direkt bei ihr. */}
        <AiCheckCoverageNotes coverage={ko.aiCheck?.coverage} />
        {canReview ? (
          <div className="mt-2 space-y-2">
            <div className="space-y-1.5">
              <span className="block text-[12.5px] font-medium text-muted">
                {t("ko.conflictTarget")}
              </span>
              <button
                type="button"
                onClick={() => setPickOpen(true)}
                className="flex h-10 w-full items-center justify-between gap-2 rounded-input border border-hairline bg-surface px-3 text-left text-sm hover:border-ink/30"
              >
                <span className={conflict.koB ? "truncate text-text" : "text-muted"}>
                  {conflictTitle || t("ko.conflictTargetPlaceholder")}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-2">
                  {t("ko.conflictTargetChoose")}
                </span>
              </button>
            </div>
            <Field label={t("ko.conflictType")}>
              <select
                value={conflict.type}
                onChange={(e) => setConflict({ ...conflict, type: e.target.value as ConflictType })}
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
                value={conflict.desc}
                onChange={(e) => setConflict({ ...conflict, desc: e.target.value })}
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
            <ConflictTargetPicker
              open={pickOpen}
              onClose={() => setPickOpen(false)}
              candidates={(koList.data ?? []).filter((k) => k.id !== id)}
              onSelect={(koId) => {
                setConflict({ ...conflict, koB: koId });
                setPickOpen(false);
              }}
            />
          </div>
        ) : null}
      </Abschnitt>

      {/* 2 — Quellen & Belege */}
      <Abschnitt schluessel="quellen" titel={t("ko.mehr.quellen")}>
        {(ko.sources ?? []).length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("ko.sourcesEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {(ko.sources ?? []).map((s) => (
              <li key={s.id} className="rounded-input bg-page p-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13.5px] font-medium text-text">{s.label}</span>
                      <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                        {t(sourceBadgeKey(s))}
                      </span>
                      {s.provider ? (
                        <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted">
                          {s.provider}
                        </span>
                      ) : null}
                    </div>
                    <ExternalUrlText
                      url={s.url}
                      className="block truncate font-mono text-[11px] text-ai hover:underline"
                    />
                    {s.excerpt ? <p className="mt-1 text-[12px] text-muted">{s.excerpt}</p> : null}
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
          <div className="mt-3 space-y-2 border-t border-hairline pt-3">
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
              onChange={(e) => setSourceForm((s) => ({ ...s, excerpt: e.target.value }))}
              placeholder={t("ko.sourceExcerpt")}
            />
            {/* mega16 A: die Stufe ist eine echte Grenze — der Grund steht VOR dem Absenden da. */}
            {sourceGateHint ? (
              <output className="block rounded-btn border border-hairline bg-page px-2.5 py-2 text-[11.5px] leading-relaxed text-muted">
                {t(SOURCE_ATTACH_HINT_KEYS[sourceGateHint].body)}{" "}
                {t(SOURCE_ATTACH_HINT_KEYS[sourceGateHint].how)}
              </output>
            ) : null}
            <Button
              variant="primary"
              disabled={addSource.isPending || !isSourceFormValid(sourceForm)}
              onClick={() => addSource.mutate()}
            >
              {t("ko.sourceAdd")}
            </Button>
          </div>
        ) : null}
      </Abschnitt>

      {/* 3 — Externes Wissen */}
      <Abschnitt schluessel="extern" titel={t("ko.mehr.extern")}>
        {canEdit && canSearchExternal(extStage) ? (
          <div className="space-y-2">
            {extAttachAllowed ? null : (
              <p
                data-testid="ext-attach-blocked"
                className="rounded-input bg-trust-warn-bg px-2.5 py-1.5 text-[11.5px] text-trust-warn-text"
              >
                {t("ext.attachBlocked")}
              </p>
            )}
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
                  <li key={r.url} className="rounded-input border border-hairline p-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-medium text-text">{r.title}</span>
                          <span className="rounded-pill bg-page px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted">
                            {r.provider}
                          </span>
                        </div>
                        {r.snippet ? (
                          <p className="mt-0.5 text-[11.5px] text-muted">{r.snippet}</p>
                        ) : null}
                        <ExternalUrlText
                          url={r.url}
                          className="block truncate font-mono text-[10.5px] text-ai hover:underline"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        disabled={attachExternal.isPending || !extAttachAllowed}
                        title={extAttachAllowed ? undefined : t("ext.attachBlocked")}
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
        ) : (
          <p className="text-[12.5px] text-muted">{t("ext.attachBlocked")}</p>
        )}
      </Abschnitt>

      {/* 4 — Quelle/Beitrag melden */}
      <Abschnitt schluessel="beitrag" titel={t("ko.mehr.beitrag")}>
        <div className="space-y-2">
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
          <Button
            variant="primary"
            disabled={sourceContribution.isPending || !isSourceContributionValid(source)}
            onClick={() => sourceContribution.mutate()}
          >
            {t("ko.sourceSubmit")}
          </Button>
        </div>
      </Abschnitt>

      {/* 5 — Provenienz (samt Herkunfts-Kennzeichnungen, Wissensart, Stufe, Autorenübergabe) */}
      <Abschnitt schluessel="provenienz" titel={t("ko.mehr.provenienz")}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <KnowledgeTypeTag type={ko.type} />
          {isDemoKnowledge(ko) ? (
            <span
              title={t("demo.badge.hint")}
              className="rounded-pill bg-hairline-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2"
            >
              {t("demo.badge.label")}
            </span>
          ) : null}
          {/* SCRUM-438: der Artikel enthält übernommenes externes, ungeprüftes Wissen — ein
              Herkunfts-Chip, keine Qualitätsaussage. */}
          {containsExternalUnchecked(ko.bodyHtml) ? (
            <span
              title={t("ko.externalUnchecked.hint")}
              className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai"
            >
              {t("ko.externalUnchecked.label")}
            </span>
          ) : null}
          {/* JOB 679 D2: Herkunfts-Chip „Aus Word" — fehlt `origin`, erscheint nichts. */}
          {ko.origin === "word_addin" ? (
            <span
              data-testid="ko-origin-word-addin"
              title={t("ko.originWordAddin.hint")}
              className="rounded-pill bg-hairline-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-muted-2"
            >
              {t("ko.originWordAddin.label")}
            </span>
          ) : null}
        </div>
        <ProvenanceLine
          author={nameOf(ko.author)}
          originalAuthor={nameOf(ko.originalAuthor)}
          domain={ko.category}
          version={ko.version}
        />
        {canEdit ? (
          <label className="mt-3 flex items-center gap-2 text-[12px] text-muted">
            <span>{t("conf.field")}</span>
            <select
              value={confidentialityOf(ko.confidentiality)}
              disabled={act.isPending}
              onChange={(e) =>
                act.mutate({ action: "confidentiality", level: e.target.value as Confidentiality })
              }
              aria-label={t("conf.field")}
              className="rounded-input border border-hairline bg-surface px-1.5 py-0.5 text-[12px] text-text"
            >
              {CONFIDENTIALITY_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {t(`conf.level.${lvl}`)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {canTransfer ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
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
        ) : null}
      </Abschnitt>

      {/* 6 — Kopplung und Anlagen */}
      <Abschnitt schluessel="kopplung" titel={t("ko.mehr.kopplung")}>
        {couplings.data && couplings.data.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
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
          <p className="text-[12px] text-muted-2">{t("ko.couple.empty")}</p>
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
              onClick={() => couple.mutate((coupleAsset.trim() || ko.asset || "").trim())}
            >
              <Link2 size={14} />
              {t("ko.couple.cta")}
            </Button>
          </div>
        ) : null}
      </Abschnitt>

      {/* 7 — Herkunftskette */}
      <Abschnitt schluessel="herkunftskette" titel={t("ko.mehr.herkunftskette")}>
        <div className="grid grid-cols-2 gap-2 text-[12.5px]">
          <div className="rounded-input bg-page p-2">
            <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
              {t("ko.lineageOrigin")}
            </div>
            <div className="text-text">{nameOf(ko.originalAuthor)}</div>
            {lineage.authorTransferred ? (
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
              {/* mega51 F1: Zahl und Wort werden NICHT von Hand zusammengesetzt — i18next
                  pluralisiert über `count`, sonst stünde bei genau einer Änderung „1 Änderungen". */}
              v{lineage.versions} · {t("ko.lineageChanges", { count: lineage.historyCount })}
            </div>
          </div>
          <div className="rounded-input bg-page p-2">
            <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
              {t("ko.sourcesTitle")}
            </div>
            <div className="text-text">{lineage.sourceCount}</div>
          </div>
          <div className="rounded-input bg-page p-2">
            <div className="font-mono text-micro uppercase tracking-wider text-muted-2">
              {t("ko.lineageRelated")}
            </div>
            <div className="text-text">{lineage.relatedCount}</div>
          </div>
        </div>
        {auditEvents.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {auditEvents.map((e) => (
              <li key={e.seq} className="flex items-center gap-2 text-[11.5px] text-muted">
                <span className="font-mono text-muted-2">
                  {new Date(e.at).toLocaleDateString(i18n.language)}
                </span>
                <span className="font-semibold text-text">{auditActionLabel(e.action, t)}</span>
                <span className="ml-auto font-mono text-muted-2">{nameOf(e.actor)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {/* mega70 B3: `/graph` verlangt `admin` — die gesperrte Fassung verliert Link und Pfeil. */}
        <RoleLink
          to="/graph"
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-ai"
          hoverClassName="hover:underline"
        >
          {(erreichbar) => (
            <>
              {t("ko.lineageGraphLink")}
              {erreichbar ? <span aria-hidden="true">→</span> : null}
            </>
          )}
        </RoleLink>
      </Abschnitt>

      {/* 8 — Historie */}
      <Abschnitt schluessel="historie" titel={t("ko.mehr.historie")}>
        <ol className="space-y-3">
          {ko.history.map((h) => (
            <li key={h.version} className="border-l-2 border-hairline pl-3">
              <div className="font-mono text-[11px] text-muted-2">
                v{h.version} · {new Date(h.at).toLocaleDateString(i18n.language)}
              </div>
              <div className="text-[12.5px] text-text">{h.note || nameOf(h.author)}</div>
            </li>
          ))}
        </ol>
      </Abschnitt>

      {/* 9 — Belege (samt Vertrauen, Konsistenz, Frische, Gültigkeit) */}
      <Abschnitt schluessel="belege" titel={t("ko.mehr.belege")}>
        {/* AUFTRAG-mega51 D2 (unverändert übernommen): „Validiert" NEBEN einer 0-Leiste verwirrt —
            Bedingung und Anzeige lesen deshalb DENSELBEN Wert (`confidence`), und bei validiert +
            Sicherheit 0 steht statt der leeren Leiste der nüchterne Hinweis. */}
        <div className="mb-3">
          {deriveStatus(ko) === "validiert" && ko.confidence === 0 ? (
            <span title={t("lib.confidenceNoneHint")} className="text-[12px] text-muted-2">
              {t("lib.confidenceNone")}
            </span>
          ) : (
            <ConfidenceBar value={ko.confidence} showLabel={false} percentPhrase />
          )}
        </div>
        {/* SCRUM-359 / AG-05 / PI-K2: Trust ist ein Review-/Evidenzsignal, KEINE Wahrheitsgarantie —
            die Einordnung steht dort, wo die Zahl steht, und bleibt aufklappbar. */}
        {(() => {
          const ex = trustExplainer({ trustBand: koOverview(ko).trustBand, usability });
          return (
            <details className="mb-2 text-[12px] text-muted">
              <summary className="cursor-pointer select-none text-muted-2">
                {t(ex.titleKey)}
              </summary>
              <p className="mt-1 leading-relaxed">{t(ex.metaKey)}</p>
              <p className="mt-1 leading-relaxed">{t(ex.bandKey)}</p>
              {ex.reviewHintKey ? (
                <p className="mt-1 leading-relaxed text-trust-warn-text">{t(ex.reviewHintKey)}</p>
              ) : null}
            </details>
          );
        })()}
        <dl className="mb-3 space-y-1.5 text-[12.5px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{t("ko.ovTrust")}</dt>
            <dd className="font-mono text-text">{ko.trust}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{t("lib.facet.maturity")}</dt>
            <dd className="font-mono text-text">{t(useReadiness(usability).labelKey)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{t("ext.validity.freshness")}</dt>
            <dd className="font-mono text-text">
              {t(`ext.freshness.${gueltigkeit.freshnessStatus}`)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{t("ext.validity.outputEligible")}</dt>
            <dd
              className={cx(
                "font-mono",
                gueltigkeit.outputEligible ? "text-trust-pos-text" : "text-muted-2",
              )}
            >
              {t(gueltigkeit.outputEligible ? "ext.outputEligible.yes" : "ext.outputEligible.no")}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">{t("ext.protection.ip")}</dt>
            <dd className="font-mono text-muted-2">{t("ext.protection.notRated")}</dd>
          </div>
        </dl>
        {/* SCRUM-168/175/170: Konsistenz, Frische und Gruppierung nach Fassung — nur bei
            erfolgreich geladenen Belegen, sonst wäre jede Zahl eine Behauptung. */}
        {!evidence.isLoading && !evidence.isError
          ? (() => {
              const consistency = analyzeEvidenceConsistency(ko, evidence.data ?? []);
              const fresh = analyzeEvidenceFreshness({ kos: [ko], evidence: evidence.data ?? [] })
                .rows[0];
              const byVersion = groupEvidenceByVersion(evidence.data ?? [], versions.data ?? []);
              return (
                <div className="mb-3 space-y-1.5 font-mono text-[10.5px] text-muted-2">
                  <div>
                    {t(`ko.evCons.status.${consistency.status}`)} ·{" "}
                    {t("ko.evCons.counts", {
                      sources: String(consistency.sourceCount),
                      attachments: String(consistency.attachmentCount),
                      evidence: String(consistency.evidenceCount),
                    })}
                  </div>
                  {consistency.findings.length > 0 ? (
                    <ul className="space-y-1">
                      {consistency.findings.map((f) => (
                        <li key={`${f.kind}:${f.ref}`} className="break-words">
                          {t(`ko.evCons.finding.${f.kind}`)} — {f.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {fresh ? (
                    <div>
                      {t(evidenceFreshnessLabelKey(fresh.status))} ·{" "}
                      {t("ko.evFresh.counts", {
                        version: String(fresh.version),
                        current: String(fresh.currentCount),
                        older: String(fresh.olderCount),
                      })}
                    </div>
                  ) : null}
                  {byVersion.groups.map((g) => (
                    <div key={g.version}>
                      {t("ko.evVer.version", { n: String(g.version) })} ·{" "}
                      {t("ko.evVer.counts", {
                        sources: String(g.sourceCount),
                        attachments: String(g.attachmentCount),
                      })}
                      {g.latestAt
                        ? ` · ${t("ko.evVer.latest", { at: new Date(g.latestAt).toLocaleDateString(i18n.language) })}`
                        : ""}
                    </div>
                  ))}
                  {byVersion.versionsWithoutEvidence.length > 0 ? (
                    <div>
                      {t("ko.evVer.without", {
                        versions: byVersion.versionsWithoutEvidence.map((v) => `v${v}`).join(", "),
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })()
          : null}
        {evidence.isLoading ? (
          <p className="text-[12.5px] text-muted">{t("state.loading")}</p>
        ) : evidence.isError ? (
          <p className="text-[12.5px] text-danger">{t("state.error")}</p>
        ) : evidenceRows(evidence.data ?? []).length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("ko.evidenceEmpty")}</p>
        ) : (
          <ul className="space-y-2.5">
            {evidenceRows(evidence.data ?? []).map((ev) => (
              <li key={ev.key} className="rounded-input border border-hairline bg-surface p-2.5">
                <div className="text-[13px] font-semibold text-text">{ev.title}</div>
                <div className="mt-1 font-mono text-[10.5px] text-muted-2">
                  {t(`ko.evidenceKind.${ev.kind}`)} · {nameOf(ev.createdBy)} ·{" "}
                  {new Date(ev.createdAt).toLocaleDateString(i18n.language)}
                </div>
                {ev.meta.length > 0 ? (
                  <div className="mt-1 font-mono text-[10px] text-muted-2">
                    {ev.meta.join(" · ")}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Abschnitt>

      {/* 10 — Schnappschüsse */}
      <Abschnitt schluessel="schnappschuesse" titel={t("ko.mehr.schnappschuesse")}>
        {versions.isLoading ? (
          <p className="text-[12.5px] text-muted">{t("state.loading")}</p>
        ) : versions.isError ? (
          <p className="text-[12.5px] text-danger">{t("state.error")}</p>
        ) : koVersionRows(versions.data ?? []).length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("ko.snapshotsEmpty")}</p>
        ) : (
          <ol className="space-y-3">
            {koVersionRows(versions.data ?? []).map((v) => (
              <li key={v.key} className="rounded-input border border-hairline bg-surface p-2.5">
                <div className="font-mono text-[11px] text-muted-2">
                  v{v.version} · {new Date(v.at).toLocaleDateString(i18n.language)} ·{" "}
                  {nameOf(v.author)} · {t(`status.${v.status}`)}
                </div>
                <div className="mt-1 text-[13px] font-semibold text-text">{v.title}</div>
                <p className="mt-1 text-[12.5px] text-muted">{v.excerpt}</p>
                {(() => {
                  const diff = diffForVersion(versions.data ?? [], v.version);
                  if (!diff || diff.fromVersion === null) {
                    return (
                      <p className="mt-1 font-mono text-[10.5px] text-muted-2">
                        {t("ko.snapshotInitial")}
                      </p>
                    );
                  }
                  return diff.changed.length === 0 ? (
                    <p className="mt-1 font-mono text-[10.5px] text-muted-2">
                      {t("ko.snapshotNoChanges")}
                    </p>
                  ) : (
                    <p className="mt-1 font-mono text-[10.5px] text-muted-2">
                      {diff.changed.map((f) => t(`ko.snapshotField.${f}`)).join(" · ")}
                    </p>
                  );
                })()}
                <p className="mt-1 font-mono text-[10.5px] text-muted-2">{v.note}</p>
              </li>
            ))}
          </ol>
        )}
      </Abschnitt>

      {/* 11 — Kommentare */}
      <Abschnitt schluessel="kommentare" titel={t("ko.mehr.kommentare")}>
        {(ko.comments ?? []).length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("ko.commentsEmpty")}</p>
        ) : (
          <ul className="space-y-2.5">
            {(ko.comments ?? []).map((cm) => (
              <li key={cm.id} className="border-l-2 border-hairline pl-3">
                <div className="font-mono text-[11px] text-muted-2">
                  {nameOf(cm.author)} · {new Date(cm.at).toLocaleDateString(i18n.language)}
                </div>
                <div className="text-[13px] text-text">{cm.text}</div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-2 border-t border-hairline pt-3">
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
      </Abschnitt>

      {/* 12 — Anhänge */}
      <Abschnitt schluessel="anhaenge" titel={t("ko.mehr.anhaenge")}>
        {(ko.attachments ?? []).length === 0 ? (
          <p className="text-[12.5px] text-muted">{t("ko.attachmentsEmpty")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {(ko.attachments ?? []).map((a) => (
              <div key={a.id} className="group relative">
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => openAttachment(a)}
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
          <>
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
            {/* AUFTRAG-mega14 Block E (SCRUM-421): die geltenden Grenzen stehen AN der
                Auswahlstelle, und sie kommen vom Server. */}
            <UploadLimitsHint />
          </>
        ) : null}
      </Abschnitt>

      {/* 13 — Nachbarschaft */}
      <Abschnitt schluessel="nachbarschaft" titel={t("ko.mehr.nachbarschaft")}>
        <KnowledgeNeighborhood key={ko.id} koId={ko.id} koTitle={ko.title} />
      </Abschnitt>
    </div>
  );
}
