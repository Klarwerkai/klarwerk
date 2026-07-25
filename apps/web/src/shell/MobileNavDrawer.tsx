import { X } from "lucide-react";
import { type KeyboardEvent, type RefObject, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";

// E2E-017 (bens Sammel-Review 2, Block F): der Off-Canvas-Navigations-Drawer ist ein ECHTES modales
// Panel — Dialogsemantik + aria-modal, initialer Fokus beim Öffnen, Escape schließt, eine Fokusfalle
// hält Tab im Panel, der Hintergrund ist währenddessen nicht fokussierbar (inert), und beim Schließen
// kehrt der Fokus auf den auslösenden Hamburger zurück. Das bisherige Maus-Verhalten (Hamburger,
// Backdrop-Klick, X) bleibt unverändert. Das Desktop-Layout (>899px) rendert diesen Drawer nie.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) {
    return [];
  }
  // Kein offsetParent-Sichtbarkeitsfilter: jsdom rechnet kein Layout (offsetParent ist dort immer
  // null). `hidden`/`aria-hidden` werden ausgeschlossen; im echten Browser sichert zusätzlich die
  // Inert-Schaltung des Hintergrunds, dass nur Panel-Elemente erreichbar sind.
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hasAttribute("hidden") && el.closest("[hidden],[aria-hidden='true']") === null,
  );
}

export function MobileNavDrawer({
  open,
  onClose,
  triggerRef,
  backgroundRef,
}: {
  open: boolean;
  onClose: () => void;
  // Auslöser (Hamburger) — Fokus kehrt beim Schließen genau hierher zurück.
  triggerRef: RefObject<HTMLButtonElement | null>;
  // Hintergrund (Topbar + Inhalt) — wird geöffnet inert gesetzt (nicht fokussierbar).
  backgroundRef: RefObject<HTMLElement | null>;
}): JSX.Element | null {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDialogElement | null>(null);

  // Öffnen: Hintergrund inert, Fokus ins Panel. Schließen (Cleanup): erst Hintergrund wieder aktiv,
  // DANN Fokus zurück auf den Hamburger — die Reihenfolge ist wichtig, sonst liefe der Restore ins
  // inerte (nicht fokussierbare) Element.
  useEffect(() => {
    if (!open) {
      return;
    }
    const trigger = triggerRef.current;
    const background = backgroundRef.current;
    background?.setAttribute("inert", "");
    const panel = panelRef.current;
    const first = focusablesIn(panel)[0];
    (first ?? panel)?.focus();
    return () => {
      background?.removeAttribute("inert");
      trigger?.focus();
    };
  }, [open, triggerRef, backgroundRef]);

  if (!open) {
    return null;
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>): void => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") {
      return;
    }
    // Fokusfalle: Tab am Ende springt zum Anfang, Shift+Tab am Anfang ans Ende — der Fokus verlässt
    // das Panel nie.
    const focusables = focusablesIn(panelRef.current);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* AUFTRAG-mega4 Block C (bens Sammel-Review 4): der Backdrop ist eine NICHT fokussierbare, rein
          präsentierende Fläche (aria-hidden, kein Button, kein Tab-Stop) — er liegt bewusst außerhalb des
          inerten Hintergrunds UND außerhalb des Dialogs, darf aber deshalb keine erreichbare Nicht-Drawer-
          Fläche sein. Vorher war er ein <button> und damit programmatisch/assistiv fokussierbar (bens
          Blocker). Die zugängliche Schließen-Aktion bleibt der X-Knopf im Dialog + Escape; der Backdrop-
          Klick bleibt reine Maus-Bequemlichkeit. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Tastatur-Schließen läuft über Escape/X im Dialog, nicht über diese aria-hidden Fläche. */}
      <div
        aria-hidden="true"
        data-testid="drawer-backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      {/* Natives <dialog> (implizite Dialog-Rolle) als Off-Canvas-Panel. Bewusst OHNE showModal() —
          der Drawer verwaltet Fokus/Inert/Escape selbst und behält so das bestehende Backdrop-/
          Slide-in-Verhalten; `open` hält es sichtbar, die Positionierung kommt aus den Klassen. */}
      <dialog
        ref={panelRef}
        open
        aria-modal="true"
        aria-label={t("topbar.menuLabel")}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative z-10 m-0 h-full w-[252px] max-w-[85vw] bg-transparent p-0 text-text shadow-popover outline-none"
      >
        <button
          type="button"
          aria-label={t("topbar.closeMenu")}
          onClick={onClose}
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-hairline-soft hover:text-text"
        >
          <X size={18} />
        </button>
        <Sidebar />
      </dialog>
    </div>
  );
}
