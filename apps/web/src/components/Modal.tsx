import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { type ModalSurface, useModalBoundaryOptional } from "../app/ModalBoundaryContext";
import { focusFirstIn } from "../lib/focusables";

// Bug (Pedi 04.07.): "dritte Ebene" — eine wiederverwendbare Pop-up-Ebene. Sie legt sich über die
// aktuelle Seite (Board, Detail), ohne sie zu verlassen. So kann man z. B. zwei Objekte
// gegenüberstellen oder ein Objekt in einer Suchliste auswählen, ohne den Kontext zu verlieren.
// Muster wie die Command-Palette: Overlay + Panel, Esc schließt, Klick auf den Hintergrund schließt.
//
// JOB 1900 (Chef-Entscheidung 22.08.2026, Variante (b)): DIE GRENZE GILT FÜR ALLE SIEBEN FLÄCHEN.
// Bis hierher trug genau EINE der sieben `<Modal>`-Flächen eine Hintergrundsperre und eine
// Fokusrückgabe — der Navigationswächter, und der brachte sie selbst mit. Die anderen sechs hatten
// beides nicht: ihr Hintergrund blieb bedienbar, und der Fokus fiel beim Schließen auf `body`.
//
// Gemessen in JOB 1851 D6 (vier Läufe): eine ZWEITE Mechanik neben der Grenze ist keine Doppelung,
// sondern eine stille Ablösung — die vorhandene Rückgabe hört auf zu wirken, ohne dass jemand sie
// entfernt hätte. Deshalb steht hier keine eigene Fokuslogik, sondern der Anschluss an die eine
// Grenze: `enter()` sperrt den Hintergrund und gibt beim Abmelden den Fokus auf den Auslöser
// zurück (`ModalBoundaryContext.tsx:163`).

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  // wide = breiteres Panel für Gegenüberstellungen (zwei Spalten nebeneinander).
  wide?: boolean;
  // JOB 1900: ein Datenattribut auf DEM Panel. Der Navigationswächter kennzeichnet damit seine
  // Fläche (`data-navguard-dialog`), die er vor dem Anschluss noch selbst gerendert hat. Die Marke
  // gehört auf das Panel und nicht auf eine Hülle darum: nur so liegt sie im Portal-Anker, trägt
  // den Dialogtext und enthält den Fokus — die drei Zusicherungen aus JOB 1850.
  panelMarker?: string;
  // JOB 1900: die Grenze AUSDRÜCKLICH gereicht, für Flächen, die sie über den Kontext nicht
  // erreichen. Das ist genau EINE: der Navigationswächter hängt in `App.tsx:99` OBERHALB von
  // `ModalBoundaryProvider` (bewusst, damit er den Seitenabsturz überlebt) und bekommt die Grenze
  // deshalb seit JOB 1850 über die Brücke `NavGuardModalBoundaryBridge` heraufgemeldet.
  // Es ist dieselbe eine Mechanik — nur der Weg zu ihr ist ein anderer.
  grenze?: Pick<ModalBoundaryValueTeil, "host" | "enter"> | null;
}

// Der Teil der Grenze, den eine Fläche braucht: wohin sie gehört und wie sie sich an- und abmeldet.
interface ModalBoundaryValueTeil {
  host: () => HTMLElement | null;
  enter: (surface: ModalSurface) => () => void;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  panelMarker,
  grenze: gereichteGrenze,
}: ModalProps): JSX.Element | null {
  const { t } = useTranslation();
  // Ref, damit der Effekt nur von `open` abhängt und keinen veralteten onClose einfängt.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // JOB 1900: `Modal` wird auch außerhalb der Shell gerendert (Anmeldeweg, Absturzfall, gemountete
  // Tests ohne Provider). Dort gibt es keine Grenze — dann verhält sich die Fläche wie bisher.
  // Die gereichte Grenze hat Vorrang: wer sie ausdrücklich bekommt, hängt außerhalb des Kontexts.
  const ausKontext = useModalBoundaryOptional();
  const grenze = gereichteGrenze ?? ausKontext;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const ausloeserRef = useRef<HTMLElement | null>(null);

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
    // Der Auslöser ist das, was beim Öffnen den Fokus trug. `body` ist keiner: ein programmatisch
    // geöffnetes Pop-up hat kein Bedienelement hinter sich, und ein Rückgabeziel `body` wäre eine
    // Fokusbewegung, die niemand ausgelöst hat.
    const aktiv = document.activeElement;
    ausloeserRef.current = aktiv instanceof HTMLElement && aktiv !== document.body ? aktiv : null;
    const abmelden = grenze?.enter({
      panel: () => panelRef.current,
      trigger: () => ausloeserRef.current,
    });
    // GM-1b greift GENAU HIER an: das ist der Anfangsfokus aller sieben Flächen. Nimmt man diese
    // Zeile heraus, muss jede der sieben rot fallen — bleibt eine grün, hängt sie an etwas anderem.
    focusFirstIn(panelRef.current);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Erst abmelden — die Grenze liest `trigger()` beim Abmelden und gibt den Fokus zurück.
      abmelden?.();
      ausloeserRef.current = null;
    };
  }, [open, grenze]);

  if (!open) {
    return null;
  }

  // Der Portal-Anker wird beim Öffnen gelesen, nicht in einem Effekt: ein nachträglicher Umzug
  // würde den Teilbaum ab- und wieder aufbauen, und dann liefe die ganze Mechanik zweimal je
  // Öffnung (in JOB 1851 D6 Lauf B als vier Fokusaufrufe statt einem gemessen).
  const anker = grenze?.host() ?? null;

  const flaeche = (
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
        ref={panelRef}
        tabIndex={-1}
        {...(panelMarker ? { [panelMarker]: "" } : {})}
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

  return anker ? createPortal(flaeche, anker) : flaeche;
}
