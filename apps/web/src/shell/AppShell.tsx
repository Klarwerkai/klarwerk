import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
// Klara v1 (Pedi 05.07.): kontextsensitive Hilfe — schwebender ?-Knopf, nie aufdringlich.
import { KlaraAssistant } from "../components/KlaraAssistant";
import { CommandPalette } from "./CommandPalette";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { Sidebar } from "./Sidebar";
import { ToastViewport } from "./ToastViewport";
import { Topbar } from "./Topbar";
import { NARROW_QUERY, useMediaQuery } from "./useMediaQuery";

// App-Chrome (eingeloggt): auf Desktop Sidebar 252px + Topbar 60px + scrollbarer Content.
// E2E-017: unter ≤899px wird die Sidebar aus dem Dokumentfluss genommen und per Drawer geöffnet
// (Hamburger in der Topbar); der Inhalt nutzt dann die volle schmale Breite. `/mobile` rendert bewusst
// OHNE diese Hülle (volle schmale Breite) — sonst bliebe die Desktop-Shell darum stehen.
export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // E2E-017 (Block F): Auslöser (Hamburger) für die Fokus-Rückgabe und Hintergrund (Topbar+Inhalt)
  // für die Inert-Schaltung, während der Drawer offen ist.
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const narrowBackgroundRef = useRef<HTMLDivElement | null>(null);

  // Bei jedem Routenwechsel (Nav-Klick) schließt der Drawer — kein hängendes Overlay.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst nur auf Pfadwechsel schließen.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // B1b: /mobile OHNE Shell — volle schmale Breite, kein Sidebar/Topbar-Chrome drumherum.
  if (location.pathname === "/mobile") {
    return (
      <div className="h-full">
        {children}
        <ToastViewport />
      </div>
    );
  }

  if (narrow) {
    return (
      <div className="flex h-full flex-col">
        {/* AUFTRAG-mega3 Block C (bens Sammel-Review 3, Auflage F): der Hintergrund umfasst jetzt
            AUSNAHMSLOS ALLE Nicht-Drawer-Shellflächen — Topbar, Inhalt UND die zuvor daneben liegenden
            Geschwister Command Palette, Toasts und Klara. Bei offenem Drawer wird dieser eine Container
            inert geschaltet; damit ist KEINE Fläche außer dem Drawer mehr per Tastatur, Zeiger oder
            programmatisch/assistiv erreichbar. Das ist ECHTE Modalität — sie deckt das `aria-modal="true"`
            des Drawers, statt es nur zu behaupten. (Weg 1 aus bens Auflage; kein showModal/Portal nötig,
            weil keine Shellfläche mehr außerhalb des inerten Bereichs liegt.) */}
        <div ref={narrowBackgroundRef} className="flex min-h-0 flex-1 flex-col">
          <Topbar narrow onOpenMenu={() => setDrawerOpen(true)} menuButtonRef={hamburgerRef} />
          <main className="flex-1 overflow-y-auto px-4 py-5">{children}</main>
          <CommandPalette />
          <ToastViewport />
          <KlaraAssistant />
        </div>
        <MobileNavDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          triggerRef={hamburgerRef}
          backgroundRef={narrowBackgroundRef}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-9 py-7">{children}</main>
      </div>
      <CommandPalette />
      <ToastViewport />
      <KlaraAssistant />
    </div>
  );
}
