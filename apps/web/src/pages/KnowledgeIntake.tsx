import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useKos } from "../api/hooks";
import type { KnowledgeObject } from "../api/types";
import { useSession } from "../app/AuthContext";
import { IntakeCompletion } from "../components/capture/intake/IntakeCompletion";
import { IntakeEmptyState } from "../components/capture/intake/IntakeEmptyState";
import { LiveReactionZone } from "../components/capture/intake/LiveReactionZone";
import { StructureSuggestionChips } from "../components/capture/intake/StructureSuggestionChips";
import { useLiveKnowledgeCheck } from "../components/capture/intake/useLiveKnowledgeCheck";
import { Button } from "../components/ui";
import { dominantCategory, pickExampleKo } from "../lib/intakeExample";
import { INTAKE_MIN_LENGTH } from "../lib/intakeSimilarity";
import type { IntakeStarter } from "../lib/intakeStarters";
import { type IntakeSuggestion, deriveIntakeSuggestion } from "../lib/intakeSuggestion";

// SCRUM-527 (Design-Batch B): der zusammengesetzte „Wissen erfassen"-Fluss als zuhörendes System —
// Leerzustand (WP1) → Freitext + Live-Reaktion (WP2) → editierbarer Struktur-Vorschlag (WP3) → Abschluss
// mit Namensnennung (WP4). Andockbereit; erste Version für die Browser-Iteration. Bewusst NICHT in die
// bestehende 3701-Zeilen-Capture.tsx verwoben (Risiko), sondern eigene, testbare Bausteine.
export function KnowledgeIntake(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const authorName = user?.name ?? user?.email ?? "-";
  const kos = useKos();
  const qc = useQueryClient();

  const [text, setText] = useState("");
  const [starter, setStarter] = useState<IntakeStarter | null>(null);
  const [suggestion, setSuggestion] = useState<IntakeSuggestion | null>(null);
  const [created, setCreated] = useState<KnowledgeObject | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const verdict = useLiveKnowledgeCheck(text);
  // SCRUM-527 (Iteration 1): domänennahes Beispiel — bevorzugte Kategorie aus den EIGENEN KOs des
  // Nutzers; hat er keine, undefined → pickExampleKo nimmt Org-Bestand, nie ein fachfremdes Muster.
  const preferCategory = useMemo(() => {
    const mine = (kos.data ?? []).filter((k) => user?.id && k.author === user.id);
    return dominantCategory(mine.length > 0 ? mine : undefined);
  }, [kos.data, user?.id]);
  const example = useMemo(
    () => pickExampleKo(kos.data, preferCategory),
    [kos.data, preferCategory],
  );
  const enough = text.trim().length >= INTAKE_MIN_LENGTH;

  // Der Struktur-Vorschlag: Platzhalter aus dem Text abgeleitet (WP3). Sobald ein KI-Endpoint verdrahtet
  // ist, kann hier reasoner.structure den Titel liefern — der Chip bleibt editierbar.
  const effectiveSuggestion: IntakeSuggestion =
    suggestion ?? deriveIntakeSuggestion(text, authorName);

  const submit = useMutation({
    mutationFn: () =>
      endpoints.ko.create({
        title: effectiveSuggestion.title || text.slice(0, 60),
        statement: text.trim(),
        type: "best_practice",
        category: effectiveSuggestion.category || "",
        confidentiality: "intern",
      }),
    onSuccess: (ko) => {
      setCreated(ko);
      setErr(null);
      void qc.invalidateQueries({ queryKey: ["kos"] });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  // Abschluss (WP4).
  if (created) {
    return (
      <div className="mx-auto max-w-2xl">
        <IntakeCompletion authorName={authorName} koId={created.id} />
      </div>
    );
  }

  // SCRUM-527 (Iteration 1): ein Starter-Chip füllt das Feld NICHT vor. Er merkt sich die gewählte
  // Wissensart (als entfernbares Label über dem Feld) und fokussiert das LEERE Feld. Der „passende
  // Anfang" erscheint nur als HTML-placeholder (verschwindet beim Tippen), nie als value/defaultValue.
  const start = (chosen: IntakeStarter): void => {
    setStarter(chosen);
    setTimeout(() => textRef.current?.focus(), 0);
  };

  const showEmptyState = starter === null && text.length === 0;
  // Feld-Placeholder: mit gewählter Wissensart deren „passender Anfang" als Ghost-Hinweis, sonst neutral.
  const placeholder = starter ? t(starter.prefillKey) : t("intake.fieldPlaceholder");

  return (
    <div className="mx-auto max-w-2xl">
      {showEmptyState ? (
        <IntakeEmptyState example={example} onStart={start} />
      ) : (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold leading-snug text-ink">{t("intake.question")}</h1>

          {/* Gewählte Wissensart als ENTFERNBARES Label über dem Feld (kein Text im Feld). */}
          {starter ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-page px-2.5 py-1 text-[12.5px] font-medium text-text">
              {t(starter.labelKey)}
              <button
                type="button"
                aria-label={t("intake.removeStarter")}
                onClick={() => setStarter(null)}
                className="text-muted-2 hover:text-text"
              >
                ✕
              </button>
            </span>
          ) : null}

          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={placeholder}
            className="w-full rounded-card border border-hairline bg-surface p-3 text-[15px] leading-relaxed text-text outline-none placeholder:text-muted-2 focus:border-ink/30"
            aria-label={t("intake.question")}
          />

          {/* Live-Reaktion (WP2) — die Hauptattraktion. */}
          <LiveReactionZone verdict={verdict} />

          {/* Struktur-Vorschlag (WP3) — erst wenn genug Text da ist. */}
          {enough ? (
            <div className="rounded-card border border-hairline bg-page p-3">
              <StructureSuggestionChips
                suggestion={effectiveSuggestion}
                onChange={setSuggestion}
                derived
              />
            </div>
          ) : null}

          {err ? <p className="text-[13px] text-trust-crit-text">{err}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={!enough || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {t("intake.submit")}
            </Button>
            <p className="text-[13px] text-muted">{t("intake.calming")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
