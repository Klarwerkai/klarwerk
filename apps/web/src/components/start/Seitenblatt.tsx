import { X } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

// ================================================================================================
// JOB 3064 H5 — DAS SEITENBLATT: WO EIN MENÜPUNKT SEINEN INHALT ZEIGT.
// ================================================================================================
// Pages-Muster (canvas.json, Notiz „menues"): „Alles, was nicht ins Sichtfeld gehört, liegt in
// Untermenüs." Ein Menüpunkt ohne Wirkung wäre eine Scheinfunktion — deshalb hat JEDER Punkt ein
// Blatt, und `tests/design/h5-funktionsinventar.test.ts` klickt sie einzeln an.
//
// Breite 360 px wie im Auftrag (§5.5). Der Abfangknopf darunter schliesst beim Klick daneben —
// dasselbe Muster wie `HelpTip.tsx` und `OverflowMenu.tsx`, kein drittes Overlay-Verfahren.
export function Seitenblatt({
  titel,
  testId,
  onSchliessen,
  children,
}: {
  titel: string;
  testId: string;
  onSchliessen: () => void;
  children: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  // KORREKTURPFLICHT 2 (Ben, Runde 3): das Blatt hängt je nach Lage TIEF im Baum — auf `/fragen`
  // innerhalb der Antwortkarte. `position: fixed` bezieht sich dann nicht mehr auf das Fenster,
  // sobald irgendein Vorfahr einen eigenen Enthaltungsblock aufspannt (`transform`, `filter`,
  // `contain`, `will-change`). Genau das war messbar: Breite und `fixed` stimmten, die rechte
  // Kante und die volle Höhe nicht (`rechtsBuendig: false`, `vollHoch: false`).
  // Ein Portal an `document.body` macht die Geometrie unabhängig davon, WO das Blatt gerufen wird —
  // die Alternative wäre, jedem Aufrufer zu verbieten, je einen Enthaltungsblock zu erzeugen.
  // `tests/design/zielbild-h5-fragen.test.ts` M2 misst die Kante seither.
  return createPortal(
    <>
      <button
        type="button"
        aria-label={t("cmd.close")}
        tabIndex={-1}
        onClick={onSchliessen}
        // Bewusst OHNE Abdunklung: das Blatt ist eine Auskunft, kein Dialog. Es hält keinen Fokus
        // fest, trägt kein `aria-modal` und verlangt keine Entscheidung — die Fläche darunter
        // bleibt lesbar. Die Vollfläche ist ausschliesslich der Klickfänger zum Schliessen,
        // dieselbe Bauform wie in `HelpTip.tsx` (und dort ebenso registriert:
        // `tests/app/mega47-modale-flaechen-sammler.test.tsx`, NICHT_MODALE_VOLLFLAECHEN).
        className="fixed inset-0 z-40 cursor-default"
      />
      <aside
        data-testid={testId}
        aria-label={titel}
        className="fixed right-0 top-0 z-50 flex h-full w-[360px] max-w-full flex-col border-l border-hairline bg-surface shadow-popover"
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <h2 className="text-[14px] font-semibold text-ink">{titel}</h2>
          <button
            type="button"
            onClick={onSchliessen}
            aria-label={t("cmd.close")}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-btn text-muted-2 hover:bg-hairline-soft hover:text-text"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </>,
    document.body,
  );
}
