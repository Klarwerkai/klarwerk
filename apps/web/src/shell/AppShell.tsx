import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
// AUFTRAG-mega48 Block A: die Modalgrenze der ganzen App. Sie entsteht hier, weil hier der
// Hintergrund entsteht — modale Flächen HOLEN sie sich (useModalBoundary), sie bekommen sie nicht
// mehr als Prop gereicht.
import { ModalBoundaryProvider, ModalRegion } from "../app/ModalBoundaryContext";
// Klara v1 (Pedi 05.07.): kontextsensitive Hilfe — schwebender ?-Knopf, nie aufdringlich.
import { KlaraAssistant } from "../components/KlaraAssistant";
// AUFTRAG-mega61 Block A/B: Fußbereich und Hinweisbanner auf derselben Ebene wie Kopfzeile und
// Meldungsfläche — bewusst NICHT im Torwächter, damit der Anmeldeweg unberührt bleibt.
import { LegalFooter } from "../legal/LegalPages";
import { NoticeBanner } from "../legal/NoticeBanner";
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
  // E2E-017 (Block F): Auslöser (Hamburger) für die Fokus-Rückgabe, während der Drawer offen ist.
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  // AUFTRAG-mega48 Block A: der Portal-Anker der Modalgrenze ist `<main>` selbst. Die gesperrten
  // Bereiche liegen DARIN (der Seiteninhalt) und DANEBEN (Topbar, Command Palette, Toasts, Klara);
  // eine modale Fläche hängt sich als Geschwister des Seiteninhalts ein und liegt damit außerhalb
  // jeder Sperre — und trotzdem innerhalb der Shell, nicht am `<body>`.
  const mainRef = useRef<HTMLElement | null>(null);

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
        {/* AUFTRAG-mega61 Block A/B: auch die shell-lose Route trägt Hinweis und Fußbereich —
            „auf jeder Seite" heißt jede, sonst wäre die Zusage an genau einer Stelle unwahr.
            BEWUSST ohne Umbau des Layouts dieser Route (kein flex, kein eigener Scrollbereich):
            sie ist durch Rauchproben festgenagelt, und beides zusammen wäre eine Änderung zu viel
            in einer Runde. Beide Flächen hängen im normalen Fluss hinter dem Inhalt — für einen
            Fußbereich ist das ohnehin der richtige Ort. */}
        <NoticeBanner />
        <div className="px-4">
          <LegalFooter />
        </div>
        <ToastViewport />
      </div>
    );
  }

  if (narrow) {
    return (
      <div className="flex h-full flex-col">
        {/* AUFTRAG-mega3 Block C (bens Sammel-Review 3, Auflage F) → AUFTRAG-mega48 Block A: die
            Grenze umfasst weiterhin AUSNAHMSLOS ALLE Nicht-Modalflächen — Topbar, Inhalt UND die
            Geschwister Command Palette, Toasts und Klara. Neu ist zweierlei: sie gilt für JEDE
            modale Fläche (Drawer UND Filterblatt, über den Kontext statt über einen Prop), und sie
            besteht aus mehreren angemeldeten BEREICHEN statt aus einem Container. Das ist nötig,
            weil `<main>` selbst der Portal-Anker ist: läge der Seiteninhalt nicht in einem eigenen
            Bereich, müsste man `<main>` sperren — und das Filterblatt läge wieder im gesperrten
            Teilbaum (genau bens sammel44-Blocker). */}
        <ModalBoundaryProvider hostRef={mainRef}>
          <div className="flex min-h-0 flex-1 flex-col">
            <ModalRegion>
              <Topbar narrow onOpenMenu={() => setDrawerOpen(true)} menuButtonRef={hamburgerRef} />
            </ModalRegion>
            <main ref={mainRef} className="flex-1 overflow-y-auto px-4 py-5">
              <ModalRegion>
                {children}
                <LegalFooter />
              </ModalRegion>
            </main>
            {/* AUFTRAG-mega61 Block B: der Hinweis liegt als GESCHWISTER der Inhaltsfläche, nicht
                darüber. Er nimmt echten Layout-Platz und verdeckt deshalb kein Bedienelement —
                weder auf schmalen noch auf breiten Geräten, und ohne eine Ausgleichs-Polsterung,
                die irgendwann jemand vergisst. */}
            <ModalRegion>
              <NoticeBanner />
            </ModalRegion>
            <ModalRegion>
              <CommandPalette />
              <ToastViewport />
              <KlaraAssistant />
            </ModalRegion>
          </div>
          <MobileNavDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            triggerRef={hamburgerRef}
          />
        </ModalBoundaryProvider>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Dieselbe Grenze auf breiten Geräten: hier gibt es heute keine modale Fläche (kein Drawer,
          und die Facetten stehen als Spalte statt als Blatt), aber die Bauform ist EINE — sonst
          entstünde beim nächsten Overlay wieder ein zweiter, halber Weg. */}
      <ModalBoundaryProvider hostRef={mainRef}>
        <ModalRegion>
          <Sidebar />
        </ModalRegion>
        <div className="flex min-w-0 flex-1 flex-col">
          <ModalRegion>
            <Topbar />
          </ModalRegion>
          <main ref={mainRef} className="flex-1 overflow-y-auto px-9 py-7">
            <ModalRegion>
              {children}
              <LegalFooter />
            </ModalRegion>
          </main>
          <ModalRegion>
            <NoticeBanner />
          </ModalRegion>
        </div>
        <ModalRegion>
          <CommandPalette />
          <ToastViewport />
          <KlaraAssistant />
        </ModalRegion>
      </ModalBoundaryProvider>
    </div>
  );
}
