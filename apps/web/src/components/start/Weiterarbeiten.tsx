import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../../api/endpoints";
import type { KnowledgeObject, Notification } from "../../api/types";
import { GuardedLink } from "../../app/NavGuardContext";
import { type Role, routePathAllows } from "../../app/navigation";
import { draftResumeHref } from "../../lib/draftForm";
import { pruefHref } from "../../lib/objektbezug";
import { reworkHref } from "../../lib/reviewReworkContext";

export function Weiterarbeiten({
  kontoId,
  role,
  board,
  meldungen,
}: {
  kontoId: string;
  role: Role;
  board: readonly KnowledgeObject[];
  meldungen: readonly Notification[];
}): JSX.Element | null {
  const { t } = useTranslation();
  const drafts = useQuery({
    queryKey: ["drafts", "weiterarbeiten", kontoId],
    queryFn: () => endpoints.drafts.letzteEigene(),
  });
  // Offene persönliche Zuweisungen kommen aus demselben Feed wie die Glocke.
  // Auf der Startseite führt jede direkt zur Fassung bzw. Nacharbeit, die sie betrifft.
  const meine = new Map(
    board.filter((k) => k.assignments?.includes(kontoId)).map((k) => [k.id, k]),
  );
  const pruefungen = meldungen.flatMap((m) => {
    if (!m.koId || (m.kind !== "assignment" && m.kind !== "return")) return [];
    const k = meine.get(m.koId);
    if (!k) return [];
    const rueckgabe = m.kind === "return";
    const to = rueckgabe ? reworkHref(k.id) : pruefHref(k.id, k.version);
    return routePathAllows(to, role)
      ? [
          {
            to,
            title: k.title,
            action: rueckgabe ? "weiterarbeiten.nacharbeit" : "weiterarbeiten.pruefen",
          },
        ]
      : [];
  });
  const entwuerfe =
    !drafts.isError && drafts.data?.kontoId === kontoId
      ? drafts.data.entwuerfe.map((d) => ({
          to: draftResumeHref(d.id, d.mitAblauf),
          title: d.titel || t("capture.draftFallbackTitle"),
          action: "weiterarbeiten.entwurf",
        }))
      : [];
  // Bei vielen Prüfungen bleibt auch der jüngste eigene Entwurf direkt erreichbar.
  const zeilen = [
    ...pruefungen.slice(0, 1),
    ...entwuerfe.slice(0, 1),
    ...pruefungen.slice(1),
    ...entwuerfe.slice(1),
  ].slice(0, 3);
  if (!zeilen.length && !drafts.isError) return null;
  return (
    <section
      aria-labelledby="weiterarbeiten-titel"
      data-testid="start-weiterarbeiten"
      className="w-[640px] max-w-full"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="weiterarbeiten-titel" className="text-[17px] font-semibold text-text">
          {t("weiterarbeiten.titel")}
        </h2>
        <GuardedLink
          to="/aufgaben"
          className="rounded-btn text-sm text-brand-text underline-offset-2 hover:underline"
        >
          {t("weiterarbeiten.alleAufgaben")}
        </GuardedLink>
      </div>
      {zeilen.length > 0 ? (
        <ul className="divide-y divide-hairline overflow-hidden rounded-[14px] border border-hairline bg-surface">
          {zeilen.map((z) => (
            <li key={z.to}>
              <GuardedLink
                to={z.to}
                className="flex min-h-12 items-center gap-4 px-4 py-2 text-text hover:bg-page focus-visible:outline-offset-[-3px]"
              >
                <span className="min-w-0 flex-1 break-words">
                  <span className="block text-sm font-semibold">{z.title}</span>
                  <span className="block text-[13px] text-muted">{t(z.action)}</span>
                </span>
                <ArrowRight aria-hidden="true" size={16} className="shrink-0 text-muted" />
              </GuardedLink>
            </li>
          ))}
        </ul>
      ) : null}
      {drafts.isError ? (
        <output className="mt-2 block text-sm text-muted">
          {t("weiterarbeiten.fehler")}{" "}
          <button
            type="button"
            className="text-brand-text underline"
            onClick={() => void drafts.refetch()}
          >
            {t("loadstate.error.retry")}
          </button>
        </output>
      ) : null}
    </section>
  );
}
