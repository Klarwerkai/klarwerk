import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useSession } from "../app/AuthContext";
import { useToast } from "../app/ToastContext";
import { RichTextEditor } from "../components/RichTextEditor";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import {
  CAPTURE_FRONT_DOOR_FALLBACK_TITLE,
  CAPTURE_FRONT_DOOR_ROUTE,
  buildFrontDoorPayload,
  createFrontDoorDraft,
  deriveFrontDoorTitle,
  frontDoorBodyFromDraft,
  withFrontDoorSaveTimeout,
} from "../lib/captureFrontDoor";
import { isEmptyHtml } from "../lib/richText";

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Speichern fehlgeschlagen.";
}

export function CaptureFrontDoor(): JSX.Element {
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

  const authorName = user?.name ?? user?.email ?? "-";
  const derivedTitle = deriveFrontDoorTitle(title, bodyHtml);
  const hasBody = !isEmptyHtml(bodyHtml);

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
  }, [resumeDraftId]);

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
                onChange={(event) => setTitle(event.target.value)}
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
              <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
            </div>

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
