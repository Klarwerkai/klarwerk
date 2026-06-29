// SCRUM-326: kompakte Review-Kontextzeile im Validation Board. Macht für Beta-Revisoren sichtbar, ob
// ein KO neu/offen oder revidiert (Version > 1) ist, plus kurzer Review-Hinweis. Trust/Status zeigt das
// Board bereits — hier wird nichts gedoppelt. Keine fachliche Wahrheitsbewertung, kein Blocking.
import { useTranslation } from "react-i18next";
import { type ReviewContextInput, validationReviewContext } from "../lib/validationReviewContext";

const TONE: Record<"new" | "revision", string> = {
  new: "bg-page text-muted",
  revision: "bg-trust-warn-bg text-trust-warn-text",
};

export function ValidationReviewContext({ ko }: { ko: ReviewContextInput }): JSX.Element {
  const { t } = useTranslation();
  const ctx = validationReviewContext(ko);
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed text-muted">
      <span
        className={`rounded-pill px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${TONE[ctx.tone]}`}
      >
        {t(ctx.labelKey)} · v{ctx.version}
      </span>
      <span>{t(ctx.hintKey)}</span>
    </p>
  );
}
