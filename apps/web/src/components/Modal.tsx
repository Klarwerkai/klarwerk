import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

// Bug (Pedi 04.07.): "dritte Ebene" — eine wiederverwendbare Pop-up-Ebene. Sie legt sich über die
// aktuelle Seite (Board, Detail), ohne sie zu verlassen. So kann man z. B. zwei Objekte
// gegenüberstellen oder ein Objekt in einer Suchliste auswählen, ohne den Kontext zu verlieren.
// Muster wie die Command-Palette: Overlay + Panel, Esc schließt, Klick auf den Hintergrund schließt.

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  // wide = breiteres Panel für Gegenüberstellungen (zwei Spalten nebeneinander).
  wide?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: ModalProps): JSX.Element | null {
  const { t } = useTranslation();
  // Ref, damit der Effekt nur von `open` abhängt und keinen veralteten onClose einfängt.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    // Hintergrund-Scroll sperren, solange das Pop-up offen ist.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:pt-[8vh]">
      <button
        type="button"
        aria-label={t("modal.close")}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      {/* Schlichtes Panel wie die Command-Palette (kein role="dialog" → useSemanticElements bleibt grün).
          Zugänglichkeit trägt der sichtbare Titel (h2) + der beschriftete Schließen-Knopf. */}
      <div
        className={
          wide
            ? "relative w-full max-w-4xl overflow-hidden rounded-card border border-hairline bg-surface shadow-popover"
            : "relative w-full max-w-xl overflow-hidden rounded-card border border-hairline bg-surface shadow-popover"
        }
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <h2 className="text-[14px] font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-2.5 py-1 text-[12.5px] font-semibold text-muted hover:bg-hairline-soft hover:text-text"
          >
            {t("modal.close")}
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
