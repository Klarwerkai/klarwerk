import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

// Inline-Hilfe (FE-FND-05): „?"-Icon öffnet ein Popover mit Erklärung und Link
// ins Hilfe-Center. Wiederverwendbar an Formularfeldern.
export function HelpTip({ title, body }: { title: string; body: string }): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={t("help.open")}
        onClick={() => setOpen((v) => !v)}
        className={`grid h-4 w-4 place-items-center rounded-full text-[11px] ${
          open ? "text-brand" : "text-muted-2 hover:text-text"
        }`}
      >
        <HelpCircle size={14} />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label={t("cmd.close")}
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute left-0 top-6 z-40 w-72 rounded-card border border-hairline bg-surface p-3.5 text-left shadow-popover">
            <div className="text-[13px] font-semibold text-ink">{title}</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{body}</p>
            <Link
              to="/hilfe"
              onClick={() => setOpen(false)}
              className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:opacity-80"
            >
              {t("help.openCenter")} ›
            </Link>
          </div>
        </>
      ) : null}
    </span>
  );
}
