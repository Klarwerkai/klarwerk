import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  GrenzDialog,
  type ModalSurface,
  useModalBoundaryOptional,
} from "../app/ModalBoundaryContext";

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
//
// R-0909 (Aufnahme `gesamt-dialog-bedienung`): DAS PANEL IST JETZT EIN BENANNTER DIALOG. Bis hierher
// war es ein `<div>` ohne Rolle — „Zugänglichkeit trägt der sichtbare Titel" stimmte nicht: eine
// Überschrift benennt keinen Container. Das Panel ist nun der gemeinsame `GrenzDialog` aus dem
// Grenzmodul; er trägt die Rolle, den Namen (die Überschrift, über `aria-labelledby`) und genau
// dann `aria-modal`, wenn er sich an der Grenze angemeldet hat. Die Anmeldung, der Anfangsfokus und
// die Fokusrückgabe, die hier standen, macht er — dieselbe eine Mechanik, eine Ebene tiefer.

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
  // R-0909: die Überschrift ist der Name des Dialogs.
  const titelId = useId();

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
      {/* R-0909: das Panel ist der benannte Dialog. `GrenzDialog` meldet sich an der Grenze an
          (Hintergrundsperre, Anfangsfokus, Fokusrückgabe) und trägt `aria-modal` nur dann.
          `m-0 p-0 text-text` nehmen dem nativen Element seine Vorgaben (Rand, Innenabstand, Farbe). */}
      <GrenzDialog
        grenze={grenze}
        benanntDurch={titelId}
        marke={panelMarker}
        className={
          wide
            ? "relative m-0 w-full max-w-4xl overflow-hidden rounded-card border border-hairline bg-surface p-0 text-text shadow-popover"
            : "relative m-0 w-full max-w-xl overflow-hidden rounded-card border border-hairline bg-surface p-0 text-text shadow-popover"
        }
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <h2 id={titelId} className="text-[14px] font-semibold text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-2.5 py-1 text-[12.5px] font-semibold text-muted hover:bg-hairline-soft hover:text-text"
          >
            {t("modal.close")}
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto p-4">{children}</div>
      </GrenzDialog>
    </div>
  );

  return anker ? createPortal(flaeche, anker) : flaeche;
}
