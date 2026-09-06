import { MoreHorizontal } from "lucide-react";
import { type MutableRefObject, useCallback, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// ================================================================================================
// JOB 3064 H5 — DAS „…"-MENÜ: DER BENANNTE ORT FÜR ALLES, WAS NICHT INS SICHTFELD GEHÖRT.
// ================================================================================================
// Pedi 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere dich an
// Pages, arbeite mit Untermenüs." Genau das ist dieses Bauteil: EIN Knopf, EIN Menü, je Eintrag
// ein Ort. Es ist bewusst dumm — es kennt nur Beschriftungen und Rückrufe; was ein Eintrag zeigt,
// entscheidet die Fläche.
//
// Warum kein `<details>`: ein Menü schliesst sich beim Klick daneben und beim Klick auf einen
// Eintrag. Der unsichtbare Abfangknopf darunter ist dasselbe Muster wie in `HelpTip.tsx` — kein
// zweites Overlay-Verfahren im Haus.
export interface MenuPunkt {
  id: string;
  label: string;
}

export function OverflowMenu({
  label,
  punkte,
  onWahl,
  testId,
  align = "right",
  griffRef,
}: {
  /** Zugänglicher Name des Knopfes (er trägt nur die drei Punkte). */
  label: string;
  punkte: readonly MenuPunkt[];
  onWahl: (id: string) => void;
  testId: string;
  align?: "left" | "right";
  /**
   * KORREKTURPFLICHT 1 (Ben, Runde 1): der Griff nach aussen, für Aufrufer, die denselben Menüort
   * an zwei Stellen im Baum haben und deshalb wissen müssen, welcher der beiden gerade dasteht
   * (`Ask.tsx`: das „…" der Antwortkarte gegen das der leeren Fläche). Rein lesend — die
   * Fokusrückgabe unten bleibt Sache dieses Bauteils.
   */
  griffRef?: MutableRefObject<HTMLButtonElement | null>;
}): JSX.Element | null {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  const listenId = useId();
  const knopfRef = useRef<HTMLButtonElement | null>(null);
  // Zwei Refs an EINEM Knopf, also ein Rückruf-Ref. Beim Wechsel des Menüorts (`Ask.tsx`: Karte →
  // Lückenfall) leert React zuerst den Ref des abgebauten Knopfes und setzt DANN den des neuen; der
  // geteilte Griff zeigt also am Ende des Umbaus auf den Knopf, der wirklich dasteht. GEMESSEN,
  // nicht angenommen: A7 in `tests/ux06-antwortpanel-tastatur/antwortblatt-tastatur.test.tsx` fährt
  // genau diesen Umbau und fällt, sobald der Auslöser nicht mehr stimmt.
  const setzeGriff = useCallback(
    (node: HTMLButtonElement | null): void => {
      knopfRef.current = node;
      if (griffRef) {
        griffRef.current = node;
      }
    },
    [griffRef],
  );
  // ==============================================================================================
  // JOB 3102 UX-06 — DAS MENÜ GIBT DIE BEDIENUNG AN SEINEN GRIFF ZURÜCK.
  // ==============================================================================================
  // Wenn die Liste zugeht, verschwindet das Element, das gerade den Fokus trug — der gewählte
  // Punkt. Ohne diese Rückgabe stand der Fokus danach auf `body`: der Nutzer war mit einem Klick
  // aus der Tastaturbedienung heraus, und was der Punkt öffnet (`Seitenblatt`), fand keinen
  // Auslöser mehr, an den es beim Schliessen zurückgeben könnte.
  // Es gilt für ALLE heutigen Aufrufer, weil es hier steht und nicht bei einem von ihnen.
  const schliessenMitFokusrueckgabe = (): void => {
    setOffen(false);
    knopfRef.current?.focus();
  };
  if (punkte.length === 0) {
    return null;
  }
  return (
    <span className="relative inline-flex">
      <button
        ref={setzeGriff}
        type="button"
        data-testid={testId}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-controls={offen ? listenId : undefined}
        onClick={() => setOffen((v) => !v)}
        className={`grid h-8 w-8 place-items-center rounded-btn text-muted-2 transition-colors hover:bg-hairline-soft hover:text-text ${
          offen ? "bg-hairline-soft text-text" : ""
        }`}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {offen ? (
        <>
          <button
            type="button"
            aria-label={t("cmd.close")}
            tabIndex={-1}
            onClick={schliessenMitFokusrueckgabe}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            id={listenId}
            role="menu"
            data-testid={`${testId}-liste`}
            className={`absolute top-9 z-40 min-w-[13rem] rounded-card border border-hairline bg-surface py-1 shadow-popover ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {punkte.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                data-testid={`${testId}-punkt-${p.id}`}
                onClick={() => {
                  // ERST der Fokus zurück auf den Griff, DANN die Wahl. Die Reihenfolge ist der
                  // Punkt: `onWahl` öffnet unter Umständen eine Fläche, die ihren Auslöser aus
                  // `document.activeElement` liest (`Seitenblatt.tsx`, Bauform `Modal.tsx:83-87`).
                  // Andersherum stünde dort der Menüpunkt, den React im selben Durchlauf abbaut.
                  schliessenMitFokusrueckgabe();
                  onWahl(p.id);
                }}
                className="block w-full px-3.5 py-1.5 text-left text-[13px] text-text hover:bg-hairline-soft"
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </span>
  );
}
