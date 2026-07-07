import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { StructureResult } from "../api/types";
import { useSession } from "../app/AuthContext";
import { useToast } from "../app/ToastContext";
import { RichTextEditor } from "../components/RichTextEditor";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
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
  const { i18n } = useTranslation();
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

  const authorName = user?.name ?? user?.email ?? "-";
  const derivedTitle = deriveFrontDoorTitle(title, bodyHtml);
  const hasBody = !isEmptyHtml(bodyHtml);
  const locale = toReasonerLocale(i18n.language);
  const structureInput = buildFrontDoorStructureInput({ title, bodyHtml });
  const hasStructureInput = structureInput.length > 0;

  const clearStructureState = useCallback((): void => {
    setStructureProposal(null);
    setStructureErr(null);
    setStructureAccepted(false);
  }, []);

  const changeTitle = (next: string): void => {
    setTitle(next);
    clearStructureState();
  };

  const changeBodyHtml = (next: string): void => {
    setBodyHtml(next);
    clearStructureState();
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
        clearStructureState();
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
  }, [resumeDraftId, clearStructureState]);

  const structure = useMutation({
    mutationFn: () => endpoints.reasoner.structure(structureInput, locale),
    onMutate: () => {
      setErr(null);
      setStructureErr(null);
      setStructureProposal(null);
      setStructureAccepted(false);
    },
    onSuccess: (proposal) => {
      setStructureProposal(proposal);
      setStructureErr(null);
    },
    onError: () => {
      setStructureErr(FRONT_DOOR_STRUCTURING_UNAVAILABLE_MESSAGE);
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
    },
    onSuccess: (draft) => {
      setSavedDraft({
        id: draft.id,
        title: draft.payload.title ?? derivedTitle,
      });
      setTitle("");
      setBodyHtml("");
      setActiveDraftId(null);
      setSearchParams({}, { replace: true });
      setErr(null);
      push("success", "Entwurf gespeichert.");
      void qc.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  const canSave = hasBody && !save.isPending && !loadingDraft;
  const canStructure =
    hasStructureInput && !structure.isPending && !loadingDraft && !save.isPending;

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
              {structure.isPending ? (
                <p className="mt-2 text-[12.5px] text-muted">KI-Vorschlag wird erzeugt ...</p>
              ) : null}
              {structureErr ? (
                <div className="mt-3 rounded-card border border-trust-warn-fill/40 bg-trust-warn-bg p-3 text-sm text-trust-warn-text">
                  {structureErr} Originaltext bleibt unveraendert.
                </div>
              ) : null}
              {structureAccepted ? (
                <div className="mt-3 rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                  KI-Vorschlag uebernommen. Bitte pruefen; gespeichert wird erst mit deiner
                  naechsten Aktion.
                </div>
              ) : null}
            </div>

            {structureProposal ? (
              <div className="rounded-card border border-ai/30 bg-surface p-4">
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

            {err ? (
              <div className="rounded-card border border-trust-neg-fill/40 bg-trust-neg-bg p-3 text-sm text-trust-neg-text">
                {err}
              </div>
            ) : null}

            {savedDraft ? (
              <div className="rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                Entwurf gespeichert: <strong>{savedDraft.title}</strong>.{" "}
                <Link
                  className="font-semibold underline"
                  to={`${CAPTURE_FRONT_DOOR_ROUTE}?draft=${savedDraft.id}`}
                >
                  In der Vordertuer fortsetzen
                </Link>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" disabled={!canSave}>
                {save.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Als Wissensobjekt sichern
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
