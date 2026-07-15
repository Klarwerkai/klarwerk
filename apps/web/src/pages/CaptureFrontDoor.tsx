import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, Save, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { AssistResult, KnowledgeObject, StructureResult } from "../api/types";
import { useSession } from "../app/AuthContext";
import { useToast } from "../app/ToastContext";
import { HelpTip } from "../components/HelpTip";
import { RichTextEditor } from "../components/RichTextEditor";
import { Button, Card, PageHeader, SectionLabel, TextInput } from "../components/ui";
import {
  applyBodyAssist,
  applySpellingAssistPreservingHtml,
  bodyTextForAssist,
} from "../lib/bodyAiAssist";
import {
  ASSIST_ACTIONS,
  type AssistAction,
  assistActionInstructionKey,
  assistActionLabelKey,
} from "../lib/captureAiAssist";
import {
  CAPTURE_FRONT_DOOR_FALLBACK_TITLE,
  FRONT_DOOR_STRUCTURING_UNAVAILABLE_MESSAGE,
  buildFrontDoorPayload,
  buildFrontDoorStructureInput,
  createFrontDoorDraft,
  deriveFrontDoorTitle,
  frontDoorBodyFromDraft,
  frontDoorStructuredBodyHtml,
  submitFrontDoorDraft,
  withFrontDoorSaveTimeout,
} from "../lib/captureFrontDoor";
import { type CaptureHelpId, captureHelp } from "../lib/captureHelp";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { isEmptyHtml } from "../lib/richText";

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Speichern fehlgeschlagen.";
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
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [structureProposal, setStructureProposal] = useState<StructureResult | null>(null);
  const [structureErr, setStructureErr] = useState<string | null>(null);
  const [structureAccepted, setStructureAccepted] = useState(false);
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
  const derivedTitle = deriveFrontDoorTitle(title, bodyHtml);
  const hasBody = !isEmptyHtml(bodyHtml);
  const locale = toReasonerLocale(i18n.language);
  const structureInput = buildFrontDoorStructureInput({ title, bodyHtml });
  const hasStructureInput = structureInput.length > 0;
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
    if (!window.confirm("Eingabe verwerfen? Nicht gespeicherte Inhalte gehen verloren.")) {
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
        setErr(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDraft(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resumeDraftId, clearStructureState, clearAssistState]);

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
    mutationFn: () => endpoints.reasoner.structure(structureInput, locale),
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
      setStructureErr(FRONT_DOOR_STRUCTURING_UNAVAILABLE_MESSAGE);
    },
  });

  const assist = useMutation({
    mutationFn: (action: AssistAction) =>
      endpoints.reasoner.assist(assistInput, locale, t(assistActionInstructionKey(action))),
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
      setAssistErr("Ich kann diese KI-Hilfe gerade nicht verlaesslich ausfuehren.");
    },
  });

  const save = useMutation({
    mutationFn: () => {
      if (activeDraftId) {
        return withFrontDoorSaveTimeout(
          endpoints.drafts.update(activeDraftId, buildFrontDoorPayload({ title, bodyHtml })),
        );
      }
      return createFrontDoorDraft({ title, bodyHtml }, (payload) =>
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
      push("success", "Entwurf gespeichert.");
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
      setErr(errorMessage(e));
    },
  });

  const submit = useMutation({
    mutationFn: () =>
      submitFrontDoorDraft(
        { title, bodyHtml, activeDraftId },
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
      push("success", "Zur Pruefung eingereicht.");
      void qc.invalidateQueries({ queryKey: ["validation"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: (e) => {
      submitRequestedRef.current = false;
      setErr(errorMessage(e));
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
    setTitle((prev) => (prev.trim() ? prev : structureProposal.title));
    setBodyHtml(frontDoorStructuredBodyHtml(structureProposal));
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
        setAssistErr("Rechtschreibprüfung kann Formatierung aktuell nicht sicher erhalten.");
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
          kicker="Erfassen"
          title="Dokument-Canvas"
          actions={
            <Link className="text-sm font-semibold text-muted hover:text-ink" to="/erfassen">
              Zurueck zu Wissen erfassen
            </Link>
          }
        />
        <Card className="space-y-4 border-trust-pos-fill/40 bg-trust-pos-bg">
          <div className="flex items-center gap-1.5 font-semibold text-trust-pos-text">
            <CheckCircle2 size={16} />
            Zur Pruefung eingereicht: <strong>{submittedKo.title}</strong>
            {/* SCRUM-474 P1: was „eingereicht/Validierung" heißt und was jetzt (nicht automatisch) passiert. */}
            <HelpTip {...chelp("savedNext")} />
          </div>
          <p className="text-sm leading-relaxed text-trust-pos-text/90">
            Der Editor ist abgeschlossen und geleert. Speichern oder erneutes Einreichen desselben
            Inhalts ist gesperrt; ein neuer Eintrag startet nur bewusst ueber den Button.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center justify-center rounded-btn bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
              to="/validierung"
            >
              Validierung oeffnen
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-btn border border-hairline bg-page px-3 py-1.5 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
              to={`/wissen/${submittedKo.id}`}
            >
              Objekt ansehen
            </Link>
            <Button type="button" variant="ghost" onClick={resetForNewEntry}>
              Neuer Eintrag
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        kicker="Erfassen"
        title="Dokument-Canvas"
        actions={
          <Link className="text-sm font-semibold text-muted hover:text-ink" to="/erfassen">
            Bisheriges Erfassen
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
              // (promote → KO), nicht nur Entwurf speichern. So landet ein frischer Nutzer, der den
              // Hauptknopf klickt, tatsächlich auf der Erfolgskarte statt still nur zu speichern.
              if (canSubmit) {
                requestSubmit();
              }
            }}
          >
            <div>
              <div className="mb-1.5 flex items-center gap-1">
                <span className="block text-[12.5px] font-medium text-muted">Titel optional</span>
                <HelpTip {...chelp("captureTitle")} />
              </div>
              <TextInput
                value={title}
                onChange={(event) => changeTitle(event.target.value)}
                placeholder={CAPTURE_FRONT_DOOR_FALLBACK_TITLE}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <SectionLabel>Inhalt</SectionLabel>
                <HelpTip {...chelp("tellRaw")} />
              </div>
              {loadingDraft ? (
                <div className="rounded-card border border-hairline bg-page p-3 text-sm text-muted">
                  Entwurf wird geladen ...
                </div>
              ) : null}
              {activeDraftId ? (
                <div className="rounded-card border border-ai/30 bg-ai/5 p-3 text-sm text-text">
                  Vordertuer-Entwurf geoeffnet. Aenderungen bleiben in diesem Entwurf.
                </div>
              ) : null}
              {/* SCRUM-474 P1: aktive Einladung statt leerer weißer Fläche. */}
              <RichTextEditor
                value={bodyHtml}
                onChange={changeBodyHtml}
                placeholder="Beschreibe hier dein Wissen, wie du es einem Kollegen erklären würdest — die KI strukturiert daraus einen Entwurf, den du prüfst und einreichst."
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
                  KI-Struktur vorschlagen
                </Button>
                <HelpTip {...chelp("structureNow")} />
                {!hasStructureInput ? (
                  <span className="text-[12.5px] text-muted">
                    Schreibe zuerst Inhalt, dann kann ein Vorschlag erzeugt werden.
                  </span>
                ) : (
                  <span className="text-[12.5px] text-muted">
                    Optionaler KI-Vorschlag. Nichts wird automatisch gespeichert.
                  </span>
                )}
              </div>
              <div className="mt-3 border-t border-ai/10 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className="text-[12px] font-semibold uppercase text-muted-2"
                    htmlFor="frontdoor-ai-assist"
                  >
                    KI-Hilfe
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
                    KI-Hilfe anwenden
                  </Button>
                  <span className="text-[12.5px] text-muted">
                    Klarer, strukturieren, erweitern, Rechtschreibung oder formatieren.
                  </span>
                </div>
              </div>
              {structure.isPending ? (
                <p className="mt-2 text-[12.5px] text-muted">KI-Vorschlag wird erzeugt ...</p>
              ) : null}
              {assist.isPending ? (
                <p className="mt-2 text-[12.5px] text-muted">KI-Hilfe-Vorschlag wird erzeugt ...</p>
              ) : null}
              {structureErr ? (
                <div className="mt-3 rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-3 text-sm text-trust-warn-text">
                  {structureErr} Originaltext bleibt unveraendert.
                </div>
              ) : null}
              {assistErr ? (
                <div className="mt-3 rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-3 text-sm text-trust-warn-text">
                  {assistErr} Originaltext bleibt unveraendert.
                </div>
              ) : null}
              {structureAccepted ? (
                <div className="mt-3 rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                  KI-Vorschlag uebernommen. Bitte pruefen; gespeichert wird erst mit deiner
                  naechsten Aktion.
                </div>
              ) : null}
              {assistAccepted ? (
                <div className="mt-3 rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                  KI-Hilfe uebernommen. Bitte pruefen; gespeichert wird erst mit deiner naechsten
                  Aktion.
                </div>
              ) : null}
            </div>

            {structureProposal ? (
              <div ref={proposalRef} className="rounded-card border border-ai/30 bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SectionLabel>KI-Vorschlag</SectionLabel>
                    <p className="text-sm font-semibold text-ink">
                      KI-generiert. Bitte pruefen, bevor du etwas uebernimmst.
                    </p>
                  </div>
                  {structureProposal.demo ? (
                    <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                      Fallback
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <div className="text-[12px] font-semibold uppercase text-muted-2">Titel</div>
                    <p className="mt-0.5 text-text">{structureProposal.title}</p>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold uppercase text-muted-2">
                      Aussage / Kernaussage
                    </div>
                    <p className="mt-0.5 text-text">{structureProposal.statement}</p>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold uppercase text-muted-2">
                      Bedingungen
                    </div>
                    {structureProposal.conditions.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                        {structureProposal.conditions.map((condition) => (
                          <li key={condition}>{condition}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-muted">Keine Bedingungen vorgeschlagen.</p>
                    )}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold uppercase text-muted-2">
                      Massnahmen
                    </div>
                    {structureProposal.measures.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                        {structureProposal.measures.map((measure) => (
                          <li key={measure}>{measure}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-muted">Keine Massnahmen vorgeschlagen.</p>
                    )}
                  </div>
                  {structureProposal.tags.length > 0 ? (
                    <div>
                      <div className="text-[12px] font-semibold uppercase text-muted-2">
                        Hinweise / Tags
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
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
                  <Button type="button" variant="primary" onClick={acceptStructureProposal}>
                    Uebernehmen
                  </Button>
                  <Button type="button" variant="ghost" onClick={discardStructureProposal}>
                    Vorschlag verwerfen
                  </Button>
                </div>
              </div>
            ) : null}

            {assistProposal ? (
              <div ref={proposalRef} className="rounded-card border border-ai/30 bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <SectionLabel>KI-Hilfe-Vorschlag</SectionLabel>
                    <p className="text-sm font-semibold text-ink">
                      {t(assistActionLabelKey(assistProposal.action))}: KI-generiert. Bitte pruefen,
                      bevor du etwas uebernimmst.
                    </p>
                  </div>
                  {assistProposal.demo ? (
                    <span className="rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-trust-warn-text">
                      Fallback
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-card border border-hairline bg-page p-3 text-sm leading-relaxed text-text">
                  {assistProposal.text}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
                  <Button type="button" variant="primary" onClick={acceptAssistProposal}>
                    Uebernehmen
                  </Button>
                  <Button type="button" variant="ghost" onClick={discardAssistProposal}>
                    Vorschlag verwerfen
                  </Button>
                </div>
              </div>
            ) : null}

            {err ? (
              <div className="rounded-card border border-trust-neg-fill/40 bg-trust-neg-bg p-3 text-sm text-trust-neg-text">
                {err}
              </div>
            ) : null}

            {/* SCRUM-474 P0: „Prüfen / Einreichen" ist der prominente Haupt-CTA (type=submit → Enter/Form
                löst Einreichen aus). „Als Entwurf speichern" ist bewusst sekundär (type=button), damit
                Enter nie versehentlich nur speichert. */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Button type="submit" variant="primary" disabled={!canSubmit}>
                  {submit.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  Pruefen / Einreichen
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
                  Als Entwurf speichern
                </Button>
                <HelpTip {...chelp("saveDraftHelp")} />
              </span>
              <Button type="button" variant="ghost" onClick={discardInputAndReturn}>
                <ArrowLeft size={15} />
                {hasDiscardRisk ? "Eingabe verwerfen" : "Zurueck"}
              </Button>
              {!hasBody ? (
                <span className="text-[12.5px] text-muted">
                  Schreibe oder fuege Inhalt ein, dann kannst du pruefen und einreichen.
                </span>
              ) : null}
            </div>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card className="space-y-3">
            <SectionLabel>Status</SectionLabel>
            <div>
              <div className="text-[12px] text-muted">Titel beim Speichern</div>
              <div className="mt-1 text-sm font-semibold text-ink">{derivedTitle}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">Autor</div>
              <div className="mt-1 text-sm text-text">{authorName}</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">Status nach dem Speichern</div>
              <div className="mt-1 text-sm text-text">Entwurf / fortsetzen</div>
            </div>
          </Card>
          <Card className="space-y-2">
            <SectionLabel>Fallback</SectionLabel>
            <p className="text-sm leading-relaxed text-muted">
              Der bisherige Erfassen-Weg bleibt erreichbar und enthaelt weiterhin die erweiterten
              Modi.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
