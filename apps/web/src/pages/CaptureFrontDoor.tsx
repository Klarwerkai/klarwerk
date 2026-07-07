import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Save, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { AssistResult, KnowledgeObject, StructureResult } from "../api/types";
import { useSession } from "../app/AuthContext";
import { useToast } from "../app/ToastContext";
import { RichTextEditor } from "../components/RichTextEditor";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import { applyBodyAssist, bodyTextForAssist } from "../lib/bodyAiAssist";
import {
  ASSIST_ACTIONS,
  type AssistAction,
  assistActionInstructionKey,
  assistActionLabelKey,
} from "../lib/captureAiAssist";
import {
  CAPTURE_FRONT_DOOR_FALLBACK_TITLE,
  CAPTURE_FRONT_DOOR_ROUTE,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeDraftId = searchParams.get("draft");
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [savedDraft, setSavedDraft] = useState<{ id: string; title: string } | null>(null);
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

  const authorName = user?.name ?? user?.email ?? "-";
  const derivedTitle = deriveFrontDoorTitle(title, bodyHtml);
  const hasBody = !isEmptyHtml(bodyHtml);
  const locale = toReasonerLocale(i18n.language);
  const structureInput = buildFrontDoorStructureInput({ title, bodyHtml });
  const hasStructureInput = structureInput.length > 0;
  const assistInput = bodyTextForAssist(bodyHtml);
  const hasAssistInput = assistInput.trim().length > 0;

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
    setTitle(next);
    setSavedDraft(null);
    setSubmittedKo(null);
    clearStructureState();
    clearAssistState();
  };

  const changeBodyHtml = (next: string): void => {
    setBodyHtml(next);
    setSavedDraft(null);
    setSubmittedKo(null);
    clearStructureState();
    clearAssistState();
  };

  const resetForNewEntry = (): void => {
    setTitle("");
    setBodyHtml("");
    setSavedDraft(null);
    setSubmittedKo(null);
    setActiveDraftId(null);
    setSearchParams({}, { replace: true });
    clearStructureState();
    clearAssistState();
    setErr(null);
  };

  useEffect(() => {
    if (!resumeDraftId) {
      setActiveDraftId(null);
      return;
    }

    let cancelled = false;
    setLoadingDraft(true);
    setErr(null);
    setSavedDraft(null);

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
      setSavedDraft(null);
      setSubmittedKo(null);
    },
    onSuccess: (draft) => {
      setSavedDraft({
        id: draft.id,
        title: draft.payload.title ?? derivedTitle,
      });
      setActiveDraftId(draft.id);
      setErr(null);
      push("success", "Entwurf gespeichert.");
      void qc.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: (e) => setErr(errorMessage(e)),
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
      setSavedDraft(null);
      setSubmittedKo(null);
    },
    onSuccess: (ko) => {
      setSubmittedKo({ id: ko.id, title: ko.title });
      setActiveDraftId(null);
      setSearchParams({}, { replace: true });
      setErr(null);
      push("success", "Zur Pruefung eingereicht.");
      void qc.invalidateQueries({ queryKey: ["validation"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  const canSave = hasBody && !save.isPending && !submit.isPending && !loadingDraft;
  const canSubmit = hasBody && !save.isPending && !submit.isPending && !loadingDraft;
  const canStructure =
    hasStructureInput &&
    !structure.isPending &&
    !loadingDraft &&
    !save.isPending &&
    !submit.isPending;
  const canAssist =
    hasAssistInput && !assist.isPending && !loadingDraft && !save.isPending && !submit.isPending;

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
    setBodyHtml(applyBodyAssist("replace", bodyHtml, assistProposal.text));
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
              if (canSave) {
                save.mutate();
              }
            }}
          >
            <Field label="Titel optional">
              <TextInput
                value={title}
                onChange={(event) => changeTitle(event.target.value)}
                placeholder={CAPTURE_FRONT_DOOR_FALLBACK_TITLE}
              />
            </Field>

            <div className="space-y-2">
              <SectionLabel>Inhalt</SectionLabel>
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
              <RichTextEditor value={bodyHtml} onChange={changeBodyHtml} />
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
                  Soll ich das ordnen?
                </Button>
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
                    Verwerfen
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
                    Verwerfen
                  </Button>
                </div>
              </div>
            ) : null}

            {err ? (
              <div className="rounded-card border border-trust-neg-fill/40 bg-trust-neg-bg p-3 text-sm text-trust-neg-text">
                {err}
              </div>
            ) : null}

            {savedDraft ? (
              <div className="rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 size={15} />
                  Entwurf gespeichert: <strong>{savedDraft.title}</strong>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex items-center justify-center rounded-btn border border-trust-pos-fill/50 px-3 py-1.5 text-[12.5px] font-semibold hover:bg-trust-pos-fill/10"
                    to={`${CAPTURE_FRONT_DOOR_ROUTE}?draft=${savedDraft.id}`}
                  >
                    Weiter bearbeiten
                  </Link>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!canSubmit}
                    onClick={() => submit.mutate()}
                  >
                    {submit.isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    Pruefen / Einreichen
                  </Button>
                  <Button type="button" variant="ghost" onClick={resetForNewEntry}>
                    Neuer Eintrag
                  </Button>
                </div>
              </div>
            ) : null}

            {submittedKo ? (
              <div className="rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 size={15} />
                  Zur Pruefung eingereicht: <strong>{submittedKo.title}</strong>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
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
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" disabled={!canSave}>
                {save.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Als Entwurf speichern
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canSubmit}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                Pruefen / Einreichen
              </Button>
              {!hasBody ? (
                <span className="text-[12.5px] text-muted">
                  Schreibe oder fuege Inhalt ein, dann kann gespeichert werden.
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
