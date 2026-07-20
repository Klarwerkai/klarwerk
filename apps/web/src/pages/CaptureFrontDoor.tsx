import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, Save, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { AssistResult, Confidentiality, KnowledgeObject, StructureResult } from "../api/types";
import { useSession } from "../app/AuthContext";
import { useToast } from "../app/ToastContext";
import { HelpTip } from "../components/HelpTip";
import { RichTextEditor } from "../components/RichTextEditor";
import { Button, Card, PageHeader, SectionLabel, TextInput } from "../components/ui";
import {
  applyBodyAssist,
  applySpellingAssistPreservingHtml,
  applyStructureProposal,
  bodyTextForAssist,
  structureProposalTitleOnly,
} from "../lib/bodyAiAssist";
import {
  ASSIST_ACTIONS,
  type AssistAction,
  assistActionInstructionKey,
  assistActionLabelKey,
} from "../lib/captureAiAssist";
import {
  FRONT_DOOR_STRUCTURING_UNAVAILABLE_KEY,
  buildFrontDoorPayload,
  buildFrontDoorStructureInput,
  createFrontDoorDraft,
  deriveFrontDoorTitle,
  frontDoorBodyFromDraft,
  submitFrontDoorDraft,
  withFrontDoorSaveTimeout,
} from "../lib/captureFrontDoor";
import { type CaptureHelpId, captureHelp } from "../lib/captureHelp";
import { CONFIDENTIALITY_LEVELS } from "../lib/confidentiality";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { draftProvenance } from "../lib/reasonerProvenance";
import { isEmptyHtml } from "../lib/richText";

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

export function CaptureFrontDoor(): JSX.Element {
  const { i18n, t } = useTranslation();
  const { user } = useSession();
  const { push } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeDraftId = searchParams.get("draft");
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  // SCRUM-502 Schicht 2 (Round 3): Vertraulichkeit auch im Front-Door erfassen — steuert den
  // Reasoner-Egress (source:"draft") UND fließt in den Entwurf/das spätere KO. Standard „intern".
  const [confidentiality, setConfidentiality] = useState<Confidentiality>("intern");
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [structureProposal, setStructureProposal] = useState<StructureResult | null>(null);
  const [structureErr, setStructureErr] = useState<string | null>(null);
  const [structureAccepted, setStructureAccepted] = useState(false);
  // WP-D6/WP-D6b: true, wenn beim Übernehmen des Struktur-Vorschlags der reiche Body (Bilder/Struktur/
  // Formatierung) BEWUSST erhalten wurde (nicht ersetzt). structureTitleAdopted unterscheidet die ehrliche
  // Meldung: Titel war leer und wurde gesetzt (a) vs. Titel war bereits vorhanden (b). Kernaussage wird nie
  // in den Inhalt übernommen.
  const [structureKeptRichBody, setStructureKeptRichBody] = useState(false);
  const [structureTitleAdopted, setStructureTitleAdopted] = useState(false);
  const [assistAction, setAssistAction] = useState<AssistAction>("clarify");
  const [assistProposal, setAssistProposal] = useState<
    (AssistResult & { action: AssistAction }) | null
  >(null);
  const [assistErr, setAssistErr] = useState<string | null>(null);
  const [assistAccepted, setAssistAccepted] = useState(false);
  const [submittedKo, setSubmittedKo] = useState<Pick<KnowledgeObject, "id" | "title"> | null>(
    null,
  );
  const proposalRef = useRef<HTMLDivElement | null>(null);
  const saveRequestedRef = useRef(false);
  const submitRequestedRef = useRef(false);

  // SCRUM-474 P1: ausführliche ?-Hilfen aus der zentralen Erfassen-Hilfekarte (lib/captureHelp),
  // gleiches Muster wie im Prüfbereich (reviewHelp) und im geführten Erfassen (Capture.tsx).
  const chelp = (id: CaptureHelpId): { title: string; body: string } => {
    const topic = captureHelp(id);
    return { title: t(topic.titleKey), body: t(topic.bodyKey) };
  };

  const authorName = user?.name ?? user?.email ?? "-";
  // SCRUM-487 (i18n): lokalisierter Fallback-Titel — folgt der UI-Sprache und wird als echter
  // KO-Titel gespeichert (nicht nur Anzeige). Wird an alle Payload-Builder durchgereicht.
  const fallbackTitle = t("cfd.fallbackTitle");
  const derivedTitle = deriveFrontDoorTitle(title, bodyHtml, fallbackTitle);
  const hasBody = !isEmptyHtml(bodyHtml);
  const locale = toReasonerLocale(i18n.language);
  const structureInput = buildFrontDoorStructureInput({ title, bodyHtml });
  const hasStructureInput = structureInput.length > 0;
  // WP-D7 (Befund 3): reicher Body erhalten → Vorschlag-Panel zeigt NUR den Titel (kein Fließtext-Dump).
  const proposalTitleOnly = structureProposalTitleOnly(bodyHtml);
  const assistInput = bodyTextForAssist(bodyHtml);
  const hasAssistInput = assistInput.trim().length > 0;
  const submitComplete = submittedKo !== null;
  const hasPendingProposal = structureProposal !== null || assistProposal !== null;
  const hasDiscardRisk =
    title.trim().length > 0 ||
    hasBody ||
    hasPendingProposal ||
    structureAccepted ||
    assistAccepted ||
    activeDraftId !== null;

  const clearStructureState = useCallback((): void => {
    setStructureProposal(null);
    setStructureErr(null);
    setStructureAccepted(false);
    setStructureKeptRichBody(false);
    setStructureTitleAdopted(false);
  }, []);

  const clearAssistState = useCallback((): void => {
    setAssistProposal(null);
    setAssistErr(null);
    setAssistAccepted(false);
  }, []);

  const changeTitle = (next: string): void => {
    if (submitComplete) {
      return;
    }
    setTitle(next);
    setSubmittedKo(null);
    saveRequestedRef.current = false;
    submitRequestedRef.current = false;
    clearStructureState();
    clearAssistState();
  };

  const changeBodyHtml = (next: string): void => {
    if (submitComplete) {
      return;
    }
    setBodyHtml(next);
    setSubmittedKo(null);
    saveRequestedRef.current = false;
    submitRequestedRef.current = false;
    clearStructureState();
    clearAssistState();
  };

  const resetForNewEntry = (): void => {
    setTitle("");
    setBodyHtml("");
    setSubmittedKo(null);
    setActiveDraftId(null);
    saveRequestedRef.current = false;
    submitRequestedRef.current = false;
    setSearchParams({}, { replace: true });
    clearStructureState();
    clearAssistState();
    setErr(null);
  };

  const discardInputAndReturn = (): void => {
    if (!hasDiscardRisk) {
      navigate("/erfassen");
      return;
    }
    if (!window.confirm(t("fd.confirmDiscard"))) {
      return;
    }
    resetForNewEntry();
    navigate("/erfassen");
  };

  useEffect(() => {
    if (!resumeDraftId) {
      setActiveDraftId(null);
      return;
    }

    let cancelled = false;
    setLoadingDraft(true);
    setErr(null);

    endpoints.drafts
      .get(resumeDraftId)
      .then((draft) => {
        if (cancelled) {
          return;
        }
        setActiveDraftId(draft.id);
        setTitle(draft.payload.title ?? "");
        setBodyHtml(frontDoorBodyFromDraft(draft.payload));
        setConfidentiality(draft.payload.confidentiality ?? "intern");
        setSubmittedKo(null);
        saveRequestedRef.current = false;
        submitRequestedRef.current = false;
        clearStructureState();
        clearAssistState();
      })
      .catch((e: unknown) => {
        if (cancelled) {
          return;
        }
        setActiveDraftId(null);
        setErr(errorMessage(e, t("fd.errSaveFailed")));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDraft(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resumeDraftId, clearStructureState, clearAssistState, t]);

  useEffect(() => {
    if (!structureProposal && !assistProposal) {
      return;
    }
    const timeout = window.setTimeout(() => {
      proposalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [structureProposal, assistProposal]);

  const structure = useMutation({
    mutationFn: () =>
      endpoints.reasoner.structure(structureInput, locale, draftProvenance(confidentiality)),
    onMutate: () => {
      setErr(null);
      setStructureErr(null);
      setStructureProposal(null);
      setStructureAccepted(false);
      setAssistProposal(null);
      setAssistErr(null);
      setAssistAccepted(false);
    },
    onSuccess: (proposal) => {
      setStructureProposal(proposal);
      setStructureErr(null);
    },
    onError: () => {
      setStructureErr(t(FRONT_DOOR_STRUCTURING_UNAVAILABLE_KEY));
    },
  });

  const assist = useMutation({
    mutationFn: (action: AssistAction) =>
      endpoints.reasoner.assist(
        assistInput,
        locale,
        t(assistActionInstructionKey(action)),
        draftProvenance(confidentiality),
      ),
    onMutate: () => {
      setErr(null);
      setAssistErr(null);
      setAssistProposal(null);
      setAssistAccepted(false);
      setStructureProposal(null);
      setStructureErr(null);
      setStructureAccepted(false);
    },
    onSuccess: (proposal, action) => {
      setAssistProposal({ ...proposal, action });
      setAssistErr(null);
    },
    onError: () => {
      setAssistErr(t("fd.errAssist"));
    },
  });

  const save = useMutation({
    mutationFn: () => {
      if (activeDraftId) {
        return withFrontDoorSaveTimeout(
          endpoints.drafts.update(
            activeDraftId,
            buildFrontDoorPayload({ title, bodyHtml, fallbackTitle, confidentiality }),
          ),
        );
      }
      return createFrontDoorDraft({ title, bodyHtml, fallbackTitle, confidentiality }, (payload) =>
        endpoints.drafts.create(payload),
      );
    },
    onMutate: () => {
      setErr(null);
      setSubmittedKo(null);
    },
    onSuccess: (draft) => {
      const savedTitle = draft.payload.title ?? derivedTitle;
      setActiveDraftId(draft.id);
      setErr(null);
      push("success", t("fd.toastSaved"));
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      navigate("/erfassen", {
        replace: true,
        state: {
          frontDoorDraftSaved: {
            id: draft.id,
            title: savedTitle,
          },
        },
      });
    },
    onError: (e) => {
      saveRequestedRef.current = false;
      setErr(errorMessage(e, t("fd.errSaveFailed")));
    },
  });

  const submit = useMutation({
    mutationFn: () =>
      submitFrontDoorDraft(
        { title, bodyHtml, activeDraftId, fallbackTitle, confidentiality },
        {
          createDraft: (payload) => endpoints.drafts.create(payload),
          updateDraft: (id, payload) => endpoints.drafts.update(id, payload),
          promoteDraft: (id) => endpoints.drafts.promote(id),
        },
      ),
    onMutate: () => {
      setErr(null);
      setSubmittedKo(null);
    },
    onSuccess: (ko) => {
      setSubmittedKo({ id: ko.id, title: ko.title });
      setTitle("");
      setBodyHtml("");
      setActiveDraftId(null);
      setSearchParams({}, { replace: true });
      clearStructureState();
      clearAssistState();
      setErr(null);
      push("success", t("fd.toastSubmitted"));
      void qc.invalidateQueries({ queryKey: ["validation"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: (e) => {
      submitRequestedRef.current = false;
      setErr(errorMessage(e, t("fd.errSaveFailed")));
    },
  });

  const canSave = hasBody && !save.isPending && !submit.isPending && !loadingDraft && !submittedKo;
  const canSubmit =
    hasBody && !save.isPending && !submit.isPending && !loadingDraft && !submittedKo;
  const canStructure =
    hasStructureInput &&
    !structure.isPending &&
    !loadingDraft &&
    !save.isPending &&
    !submit.isPending &&
    !submittedKo;
  const canAssist =
    hasAssistInput &&
    !assist.isPending &&
    !loadingDraft &&
    !save.isPending &&
    !submit.isPending &&
    !submittedKo;

  const acceptStructureProposal = (): void => {
    if (!structureProposal) {
      return;
    }
    // WP-D6/WP-D6b (Pedi-LIVE-BEFUND + bens GELB-Fix 3): „Original ist heilig" gilt auch für den
    // KI-Struktur-Vorschlag. Die gesamte Übernahme-Entscheidung liegt in der PUREN, getesteten
    // applyStructureProposal — der Handler macht nur noch setState aus dem Ergebnis (keine Logik-Kopie).
    // Reicher Body (Bilder/Struktur/Formatierung) bleibt byte-identisch erhalten; der Titel wird nur
    // gesetzt, wenn er vorher leer war; die Kernaussage wird nie in den Body übernommen.
    const result = applyStructureProposal({
      currentTitle: title,
      currentBodyHtml: bodyHtml,
      proposal: structureProposal,
    });
    setTitle(result.title);
    setBodyHtml(result.bodyHtml);
    setStructureKeptRichBody(result.preserved);
    setStructureTitleAdopted(result.titleAdopted);
    setStructureProposal(null);
    setStructureErr(null);
    setStructureAccepted(true);
  };

  const discardStructureProposal = (): void => {
    setStructureProposal(null);
    setStructureErr(null);
    setStructureAccepted(false);
  };

  const acceptAssistProposal = (): void => {
    if (!assistProposal) {
      return;
    }
    if (assistProposal.action === "spelling") {
      const result = applySpellingAssistPreservingHtml(bodyHtml, assistProposal.text);
      if (!result.applied) {
        setAssistErr(t("fd.errSpelling"));
        setAssistAccepted(false);
        return;
      }
      setBodyHtml(result.html);
    } else {
      setBodyHtml(applyBodyAssist("replace", bodyHtml, assistProposal.text));
    }
    setAssistProposal(null);
    setAssistErr(null);
    setAssistAccepted(true);
    clearStructureState();
  };

  const discardAssistProposal = (): void => {
    setAssistProposal(null);
    setAssistErr(null);
    setAssistAccepted(false);
  };

  const requestSave = (): void => {
    if (!canSave || saveRequestedRef.current) {
      return;
    }
    saveRequestedRef.current = true;
    save.mutate();
  };

  const requestSubmit = (): void => {
    if (!canSubmit || submitRequestedRef.current) {
      return;
    }
    submitRequestedRef.current = true;
    submit.mutate();
  };

  if (submittedKo) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          kicker={t("fd.kicker")}
          title={t("fd.title")}
          actions={
            <Link className="text-sm font-semibold text-muted hover:text-ink" to="/erfassen">
              {t("fd.backToCapture")}
            </Link>
          }
        />
        <Card className="space-y-4 border-trust-pos-fill/40 bg-trust-pos-bg">
          <div className="flex items-center gap-1.5 font-semibold text-trust-pos-text">
            <CheckCircle2 size={16} />
            {t("fd.submitted")} <strong>{submittedKo.title}</strong>
            {/* SCRUM-474 P1: was „eingereicht/Validierung" heißt und was jetzt (nicht automatisch) passiert. */}
            <HelpTip {...chelp("savedNext")} />
          </div>
          <p className="text-sm leading-relaxed text-trust-pos-text/90">{t("fd.submittedBody")}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center justify-center rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
              to="/validierung"
            >
              {t("fd.openValidation")}
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-btn border border-hairline bg-page px-3 py-1.5 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
              to={`/wissen/${submittedKo.id}`}
            >
              {t("fd.viewObject")}
            </Link>
            <Button type="button" variant="ghost" onClick={resetForNewEntry}>
              {t("fd.newEntry")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* SCRUM-488: Migrationssprache raus — der Link sagt, was ihn erwartet (nicht die interne Historie). */}
      <PageHeader
        kicker={t("fd.kicker")}
        title={t("fd.title")}
        actions={
          <Link className="text-sm font-semibold text-muted hover:text-ink" to="/erfassen">
            {t("fd.allModes")}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              // SCRUM-474 P0: Der Primär-Pfad (Enter/Form-Submit + prominenter Button) REICHT EIN
              // (promote → KO), nicht nur Entwurf speichern.
              if (canSubmit) {
                requestSubmit();
              }
            }}
          >
            <div>
              <div className="mb-1.5 flex items-center gap-1">
                <span className="block text-[12.5px] font-medium text-muted">
                  {t("fd.titleOptional")}
                </span>
                <HelpTip {...chelp("captureTitle")} />
              </div>
              <TextInput
                value={title}
                onChange={(event) => changeTitle(event.target.value)}
                placeholder={fallbackTitle}
              />
            </div>

            {/* SCRUM-502 Schicht 2 (Round 3): Vertraulichkeit im Front-Door. Vertrauliche Inhalte
                nutzen nie die Cloud-KI (nur lokal/deterministisch) und fließen in den Entwurf. */}
            <div>
              <div className="mb-1.5 flex items-center gap-1">
                <span className="block text-[12.5px] font-medium text-muted">
                  {t("conf.field")}
                </span>
                <HelpTip title={t("conf.field")} body={t("conf.help")} />
              </div>
              <select
                value={confidentiality}
                onChange={(event) => setConfidentiality(event.target.value as Confidentiality)}
                aria-label={t("conf.field")}
                className="h-9 w-full rounded-input border border-hairline bg-surface px-2 text-[13px] text-text"
              >
                {CONFIDENTIALITY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {t(`conf.level.${lvl}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <SectionLabel>{t("fd.content")}</SectionLabel>
                <HelpTip {...chelp("tellRaw")} />
              </div>
              {loadingDraft ? (
                <div className="rounded-card border border-hairline bg-page p-3 text-sm text-muted">
                  {t("fd.draftLoading")}
                </div>
              ) : null}
              {activeDraftId ? (
                <div className="rounded-card border border-ai/30 bg-ai/5 p-3 text-sm text-text">
                  {t("fd.draftOpen")}
                </div>
              ) : null}
              {/* SCRUM-474 P1: aktive Einladung statt leerer weißer Fläche. */}
              <RichTextEditor
                value={bodyHtml}
                onChange={changeBodyHtml}
                placeholder={t("fd.editorPlaceholder")}
              />
            </div>

            <div className="rounded-card border border-dashed border-ai/30 bg-ai/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canStructure}
                  onClick={() => structure.mutate()}
                >
                  {structure.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  {t("fd.structureSuggest")}
                </Button>
                <HelpTip {...chelp("structureNow")} />
                {!hasStructureInput ? (
                  <span className="text-[12.5px] text-muted">{t("fd.needContentFirst")}</span>
                ) : (
                  <span className="text-[12.5px] text-muted">{t("fd.optionalAiHint")}</span>
                )}
              </div>
              <div className="mt-3 border-t border-ai/10 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className="text-[12px] font-semibold uppercase text-muted-2"
                    htmlFor="frontdoor-ai-assist"
                  >
                    {t("fd.aiHelp")}
                  </label>
                  <select
                    id="frontdoor-ai-assist"
                    value={assistAction}
                    onChange={(event) => setAssistAction(event.target.value as AssistAction)}
                    className="h-9 rounded-card border border-hairline bg-surface px-2 text-sm text-ink shadow-sm focus:border-ai focus:outline-none focus:ring-2 focus:ring-ai/20"
                    disabled={assist.isPending || loadingDraft || save.isPending}
                  >
                    {ASSIST_ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {t(assistActionLabelKey(action))}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canAssist}
                    onClick={() => assist.mutate(assistAction)}
                  >
                    {assist.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Sparkles size={15} />
                    )}
                    {t("fd.aiHelpApply")}
                  </Button>
                  <span className="text-[12.5px] text-muted">{t("fd.aiHelpModes")}</span>
                </div>
              </div>
              {structure.isPending ? (
                <p className="mt-2 text-[12.5px] text-muted">{t("fd.structureGenerating")}</p>
              ) : null}
              {assist.isPending ? (
                <p className="mt-2 text-[12.5px] text-muted">{t("fd.assistGenerating")}</p>
              ) : null}
              {structureErr ? (
                <div className="mt-3 rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-3 text-sm text-trust-warn-text">
                  {structureErr} {t("fd.originalUnchanged")}
                </div>
              ) : null}
              {assistErr ? (
                <div className="mt-3 rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-3 text-sm text-trust-warn-text">
                  {assistErr} {t("fd.originalUnchanged")}
                </div>
              ) : null}
              {structureAccepted ? (
                <div className="mt-3 rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                  {/* WP-D6b: zustandsabhängige, ehrliche Meldung. Bei erhaltenem reichem Body zwei Varianten:
                      (a) Titel war leer und wurde übernommen; (b) Titel war schon da → nur Inhalt bleibt.
                      Keine Kernaussage-Behauptung. Sonst (flacher Body strukturiert) die Standard-Meldung. */}
                  {structureKeptRichBody
                    ? structureTitleAdopted
                      ? t("fd.structureKeptRichBodyTitle")
                      : t("fd.structureKeptRichBodyNoTitle")
                    : t("fd.structureAccepted")}
                </div>
              ) : null}
              {assistAccepted ? (
                <div className="mt-3 rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                  {t("fd.assistAccepted")}
                </div>
              ) : null}
            </div>

            {structureProposal ? (
              <div ref={proposalRef} className="rounded-card border border-ai/30 bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SectionLabel>{t("fd.aiProposal")}</SectionLabel>
                    <p className="text-sm font-semibold text-ink">{t("fd.aiProposalCheck")}</p>
                  </div>
                  {structureProposal.demo ? (
                    <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                      {t("fd.fallback")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <div className="text-[12px] font-semibold uppercase text-muted-2">
                      {t("fd.fieldTitle")}
                    </div>
                    <p className="mt-0.5 text-text">{structureProposal.title}</p>
                  </div>
                  {/* WP-D7 (Befund 3): reicher Body erhalten → NUR Titel + ehrliche Kurz-Erklärung, KEIN
                      Aussage-/Bedingungen-/Maßnahmen-Dump (der wäre nur der ganze Dokument-Fließtext). */}
                  {proposalTitleOnly ? (
                    <p className="text-[12.5px] leading-relaxed text-muted">
                      {t("fd.structureRichTitleOnly")}
                    </p>
                  ) : (
                    <>
                      <div>
                        <div className="text-[12px] font-semibold uppercase text-muted-2">
                          {t("fd.fieldStatement")}
                        </div>
                        <p className="mt-0.5 text-text">{structureProposal.statement}</p>
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold uppercase text-muted-2">
                          {t("fd.fieldConditions")}
                        </div>
                        {structureProposal.conditions.length > 0 ? (
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                            {structureProposal.conditions.map((condition) => (
                              <li key={condition}>{condition}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-0.5 text-muted">{t("fd.noConditions")}</p>
                        )}
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold uppercase text-muted-2">
                          {t("fd.fieldMeasures")}
                        </div>
                        {structureProposal.measures.length > 0 ? (
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                            {structureProposal.measures.map((measure) => (
                              <li key={measure}>{measure}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-0.5 text-muted">{t("fd.noMeasures")}</p>
                        )}
                      </div>
                      {structureProposal.tags.length > 0 ? (
                        <div>
                          <div className="text-[12px] font-semibold uppercase text-muted-2">
                            {t("fd.fieldTags")}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {structureProposal.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-pill bg-hairline-soft px-2 py-0.5 text-[11px] text-muted"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
                  <Button type="button" variant="primary" onClick={acceptStructureProposal}>
                    {t("fd.accept")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={discardStructureProposal}>
                    {t("fd.discardProposal")}
                  </Button>
                </div>
              </div>
            ) : null}

            {assistProposal ? (
              <div ref={proposalRef} className="rounded-card border border-ai/30 bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SectionLabel>{t("fd.aiHelpProposal")}</SectionLabel>
                    <p className="text-sm font-semibold text-ink">
                      {t("fd.assistProposalCheck", {
                        action: t(assistActionLabelKey(assistProposal.action)),
                      })}
                    </p>
                  </div>
                  {assistProposal.demo ? (
                    <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                      {t("fd.fallback")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-card border border-hairline bg-page p-3 text-sm leading-relaxed text-text">
                  {assistProposal.text}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
                  <Button type="button" variant="primary" onClick={acceptAssistProposal}>
                    {t("fd.accept")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={discardAssistProposal}>
                    {t("fd.discardProposal")}
                  </Button>
                </div>
              </div>
            ) : null}

            {err ? (
              <div className="rounded-card border border-trust-neg-fill/40 bg-trust-neg-bg p-3 text-sm text-trust-neg-text">
                {err}
              </div>
            ) : null}

            {/* SCRUM-474 P0: „Prüfen / Einreichen" ist der prominente Haupt-CTA (type=submit). */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Button type="submit" variant="primary" disabled={!canSubmit}>
                  {submit.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {t("fd.submitReview")}
                </Button>
                <HelpTip {...chelp("submitReview")} />
              </span>
              <span className="inline-flex items-center gap-1">
                <Button type="button" variant="outline" disabled={!canSave} onClick={requestSave}>
                  {save.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {t("fd.saveDraft")}
                </Button>
                <HelpTip {...chelp("saveDraftHelp")} />
              </span>
              <Button type="button" variant="ghost" onClick={discardInputAndReturn}>
                <ArrowLeft size={15} />
                {hasDiscardRisk ? t("fd.discardInput") : t("fd.back")}
              </Button>
              {!hasBody ? (
                <span className="text-[12.5px] text-muted">{t("fd.writeToSubmit")}</span>
              ) : null}
            </div>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card className="space-y-3">
            {/* SCRUM-488: Status-Karte mit ?-Hilfe — erklärt Entwurf vs. Einreichen (was passiert, was NICHT). */}
            <div className="flex items-center gap-1.5">
              <SectionLabel>{t("fd.statusLabel")}</SectionLabel>
              <HelpTip {...chelp("savedNext")} />
            </div>
            <div>
              <div className="text-[12px] text-muted">{t("fd.titleOnSave")}</div>
              <div className="mt-1 text-sm font-semibold text-ink">{derivedTitle}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">{t("fd.author")}</div>
              <div className="mt-1 text-sm text-text">{authorName}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">{t("fd.whatOnSave")}</div>
              {/* SCRUM-488: Klartext statt kryptisch „Entwurf / fortsetzen". */}
              <div className="mt-1 text-sm text-text">{t("fd.whatOnSaveBody")}</div>
            </div>
          </Card>
          <Card className="space-y-2">
            {/* SCRUM-488: keine interne Migrationssprache — was der vollständige Bereich dem Nutzer bietet. */}
            <SectionLabel>{t("fd.moreWays")}</SectionLabel>
            <p className="text-sm leading-relaxed text-muted">{t("fd.moreWaysBody")}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
