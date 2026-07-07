import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useSession } from "../app/AuthContext";
import { useToast } from "../app/ToastContext";
import { RichTextEditor } from "../components/RichTextEditor";
import { Button, Card, Field, PageHeader, SectionLabel, TextInput } from "../components/ui";
import {
  CAPTURE_FRONT_DOOR_FALLBACK_TITLE,
  buildFrontDoorPayload,
  deriveFrontDoorTitle,
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
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [savedKoId, setSavedKoId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const authorName = user?.name ?? user?.email ?? "-";
  const derivedTitle = deriveFrontDoorTitle(title, bodyHtml);
  const hasBody = !isEmptyHtml(bodyHtml);

  const save = useMutation({
    mutationFn: () => endpoints.ko.create(buildFrontDoorPayload({ title, bodyHtml })),
    onSuccess: (ko) => {
      setSavedKoId(ko.id);
      setErr(null);
      push("success", "Wissensobjekt gespeichert.");
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["validation"] });
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  const canSave = hasBody && !save.isPending;

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
              <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
            </div>

            {err ? (
              <div className="rounded-card border border-trust-neg-fill/40 bg-trust-neg-bg p-3 text-sm text-trust-neg-text">
                {err}
              </div>
            ) : null}

            {savedKoId ? (
              <div className="rounded-card border border-trust-pos-fill/40 bg-trust-pos-bg p-3 text-sm text-trust-pos-text">
                Gespeichert. Das Wissensobjekt ist angelegt und noch nicht validiert.{" "}
                <Link className="font-semibold underline" to={`/wissen/${savedKoId}`}>
                  Wissensobjekt oeffnen
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
              <div className="mt-1 text-sm text-text">offen / nicht validiert</div>
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
