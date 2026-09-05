import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
// AUFTRAG-mega48 Block A: die Modalgrenze der ganzen App. Sie entsteht hier, weil hier der
// Hintergrund entsteht — modale Flächen HOLEN sie sich (useModalBoundary), sie bekommen sie nicht
// mehr als Prop gereicht.
import { ModalBoundaryProvider, ModalRegion } from "../app/ModalBoundaryContext";
// JOB 1850 (A-1265-NAVGUARD): Der Wächter für ungespeicherte Eingaben hängt ABSICHTLICH oberhalb der
// Fehlergrenze (App.tsx:96-98) und damit oberhalb dieser Shell. Diese Brücke reicht ihm die hier
// entstehende Modalgrenze hinauf, damit sein Dialog in `<main>` portalisiert wird — ohne dass einer
// der beiden Anbieter seinen Platz verlässt.
import { NavGuardModalBoundaryBridge } from "../app/NavGuardContext";
// Klara v1 (Pedi 05.07.): kontextsensitive Hilfe — schwebender ?-Knopf, nie aufdringlich.
import { KlaraAssistant } from "../components/KlaraAssistant";
// AUFTRAG-mega61 Block A/B: Hinweisbanner auf derselben Ebene wie Kopfband und Meldungsfläche —
// bewusst NICHT im Torwächter, damit der Anmeldeweg unberührt bleibt. Der Fußbereich (LegalFooter)
// steht seit JOB 3060 in der Hülle als Zeile „Rechtliches" im Zahnrad-Menü (shell/ZahnradMenue.tsx);
// nur die shell-lose Route /mobile trägt ihn weiterhin im Fluss.
import { LegalFooter } from "../legal/LegalPages";
import { NoticeBanner } from "../legal/NoticeBanner";
import { CommandPalette } from "./CommandPalette";
import { Kopfband } from "./Kopfband";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { SeitenhilfeProvider } from "./SeitenhilfeContext";
import { ToastViewport } from "./ToastViewport";
import { NARROW_QUERY, useMediaQuery } from "./useMediaQuery";

// ================================================================================================
// JOB 3060 · H1 — DIE HÜLLE: EIN KOPFBAND, SONST NICHTS.
// ================================================================================================
//
// Bis hierher: Seitenleiste 252 px + Kopfzeile 60 px + Fußzeile unter jedem Inhalt. Pedi (04.09.,
// Mockup design/klarwerk): EIN Kopfband (56 px) mit fünf Punkten, Suche, Zahnrad und Konto; keine
// Seitenleiste, keine Fußzeile, keine Hilfe-Tipps im Sichtfeld. `<main>` nimmt die volle Breite,
// und die Seite bekommt sie ganz (Main.dc.html kennt keine max-width; Bibliothek.dc.html braucht
// 380 + 720 px, das Wissensnetz 880 px neben seiner Leiste — Runde 8). Die Seitenleiste ist als ORT entfernt (kein
// `<aside>` im DOM), nicht versteckt; ihre Punkte stehen im Kopfband und im Zahnrad-Menü.
//
// E2E-017: unter ≤899px trägt das Kopfband einen Hamburger, der die Punkte und Menüeinträge als
// Drawer öffnet; der Inhalt nutzt dann die volle schmale Breite. `/mobile` rendert bewusst OHNE
// diese Hülle (volle schmale Breite) — sonst bliebe die Desktop-Shell darum stehen.
//
// Die SEITENHILFE (SeitenhilfeProvider) umfasst Kopfband UND Inhalt: die `HelpTip`s der Seite
// melden sich dort an, das Zahnrad-Menü liest sie. Sie liegt außerhalb der Modalgrenze, weil sie
// keinen DOM-Anker braucht.
export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // E2E-017 (Block F): Auslöser (Hamburger) für die Fokus-Rückgabe, während der Drawer offen ist.
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  // AUFTRAG-mega48 Block A: der Portal-Anker der Modalgrenze ist `<main>` selbst. Die gesperrten
  // Bereiche liegen DARIN (der Seiteninhalt) und DANEBEN (Kopfband, Command Palette, Toasts, Klara);
  // eine modale Fläche hängt sich als Geschwister des Seiteninhalts ein und liegt damit außerhalb
  // jeder Sperre — und trotzdem innerhalb der Shell, nicht am `<body>`.
  const mainRef = useRef<HTMLElement | null>(null);

  // Bei jedem Routenwechsel (Nav-Klick) schließt der Drawer — kein hängendes Overlay.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst nur auf Pfadwechsel schließen.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // B1b: /mobile OHNE Shell — volle schmale Breite, kein Kopfband-Chrome drumherum.
  if (location.pathname === "/mobile") {
    return (
      <div className="h-full">
        {children}
        {/* AUFTRAG-mega61 Block A/B: auch die shell-lose Route trägt Hinweis und Fußbereich —
            „auf jeder Seite" heißt jede, sonst wäre die Zusage an genau einer Stelle unwahr.
            Hier gibt es kein Zahnrad-Menü, deshalb bleibt der Fußbereich im Fluss. */}
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
      <SeitenhilfeProvider>
        <div className="flex h-full flex-col">
          {/* AUFTRAG-mega3 Block C (bens Sammel-Review 3, Auflage F) → AUFTRAG-mega48 Block A: die
              Grenze umfasst weiterhin AUSNAHMSLOS ALLE Nicht-Modalflächen — Kopfband, Inhalt UND die
              Geschwister Command Palette, Toasts und Klara. Sie gilt für JEDE modale Fläche (Drawer
              UND Filterblatt, über den Kontext statt über einen Prop), und sie besteht aus mehreren
              angemeldeten BEREICHEN statt aus einem Container. Das ist nötig, weil `<main>` selbst
              der Portal-Anker ist: läge der Seiteninhalt nicht in einem eigenen Bereich, müsste man
              `<main>` sperren — und das Filterblatt läge wieder im gesperrten Teilbaum. */}
          <ModalBoundaryProvider hostRef={mainRef}>
            <NavGuardModalBoundaryBridge />
            <div className="flex min-h-0 flex-1 flex-col">
              <ModalRegion>
                <Kopfband
                  narrow
                  onOpenMenu={() => setDrawerOpen(true)}
                  menuButtonRef={hamburgerRef}
                />
              </ModalRegion>
              <main ref={mainRef} className="flex-1 overflow-y-auto px-4 py-5">
                <ModalRegion>{children}</ModalRegion>
              </main>
              {/* AUFTRAG-mega61 Block B: der Hinweis liegt als GESCHWISTER der Inhaltsfläche, nicht
                  darüber. Er nimmt echten Layout-Platz und verdeckt deshalb kein Bedienelement. */}
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
      </SeitenhilfeProvider>
    );
  }

  return (
    <SeitenhilfeProvider>
      <div className="flex h-full flex-col">
        {/* Dieselbe Grenze auf breiten Geräten — die Bauform ist EINE, sonst entstünde beim
            nächsten Overlay wieder ein zweiter, halber Weg. */}
        <ModalBoundaryProvider hostRef={mainRef}>
          <NavGuardModalBoundaryBridge />
          <div className="flex min-h-0 flex-1 flex-col">
            <ModalRegion>
              <Kopfband />
            </ModalRegion>
            {/* `<main>` nimmt die volle Breite, der Inhaltskasten ebenso — die Mockup-Seiten setzen
                ihre Breiten selbst (Bibliothek 380 + 720, Wissensnetz 880 + Leiste); ein Deckel von
                1040 px nahm ihnen 60 px (Runde 8). `h-full` am Kasten, damit Seiten mit `min-h-full`
                (Start: die Konsole füllt den ersten Bildschirm) ihre Bezugshöhe behalten. */}
            <main ref={mainRef} className="flex-1 overflow-y-auto px-9 py-7">
              <ModalRegion>
                <div className="kw-inhalt h-full w-full">{children}</div>
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
    </SeitenhilfeProvider>
  );
}
