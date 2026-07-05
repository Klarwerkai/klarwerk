import { HelpCircle } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

// Inline-Hilfe (FE-FND-05): „?"-Icon öffnet ein Popover mit Erklärung und Link
// ins Hilfe-Center. Wiederverwendbar an Formularfeldern.
//
// Bug (Pedi 05.07.): Einige Info-Fenster öffneten sich außerhalb des sichtbaren Bereichs
// (rechte Spalte → rechts abgeschnitten; weit unten → unter dem Rand). Das Popover misst sich
// beim Öffnen jetzt selbst und klappt bei Bedarf nach links bzw. nach oben, damit es immer im
// Viewport bleibt. Messung in useLayoutEffect (vor dem Paint) → kein sichtbares Springen.
export function HelpTip({ title, body }: { title: string; body: string }): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ h: "left" | "right"; v: "down" | "up" }>({
    h: "left",
    v: "down",
  });

  useLayoutEffect(() => {
    if (!open || !popRef.current) {
      return;
    }
    const rect = popRef.current.getBoundingClientRect();
    const margin = 8;
    const next = {
      h: rect.right > window.innerWidth - margin ? ("right" as const) : ("left" as const),
      v: rect.bottom > window.innerHeight - margin ? ("up" as const) : ("down" as const),
    };
    setPos((prev) => (prev.h === next.h && prev.v === next.v ? prev : next));
  }, [open]);

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
          <div
            ref={popRef}
            className={`absolute z-40 w-72 max-w-[calc(100vw-1rem)] rounded-card border border-hairline bg-surface p-3.5 text-left font-sans shadow-popover ${
              pos.h === "right" ? "right-0" : "left-0"
            } ${pos.v === "up" ? "bottom-6" : "top-6"}`}
          >
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
