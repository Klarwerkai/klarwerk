import { MoreHorizontal } from "lucide-react";
import { type MutableRefObject, useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { focusFirstIn } from "../../lib/focusables";

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
  const wurzelRef = useRef<HTMLSpanElement | null>(null);
  const listeRef = useRef<HTMLDivElement | null>(null);
  // Der Zustand ALS REF, weil die beiden Hörer unten ihn zum Ereigniszeitpunkt lesen müssen und
  // nicht zum Zeitpunkt ihrer Anmeldung. Er ist kein zweiter Zustand: `schliessen` schreibt beide
  // in derselben Zeile, und gelesen wird er ausschliesslich in `schliessen` selbst.
  const offenRef = useRef(false);
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
  //
  // ==============================================================================================
  // JOB 3129 UX-15 (Befund N-0032) — DAS MENÜ IST EIN GESCHLOSSENER BEDIENORT, AUCH OHNE MAUS.
  // ==============================================================================================
  // Gemessen bei 320 px (`gespraech/nutzerpruefung`, N-0032): „Tab wandert hinter das offene Menü,
  // Escape schließt nicht." Der Grund stand in dieser Datei — derselbe wie in `Seitenblatt.tsx:27`:
  // der Klickfänger nimmt der Fläche darunter die MAUS, nicht die TABULATORTASTE. Wer das Menü mit
  // der Tastatur öffnete, hatte keinen Weg heraus, der es auch schloss, und tabbte über den letzten
  // Punkt hinaus auf sichtbare Knöpfe, die der Fänger bereits tot gelegt hatte.
  //
  // ES BLEIBT BEI GENAU EINEM SCHLIESSWEG. Er trägt seit UX-15 eine Weiche, und sie steht an dieser
  // einen Stelle: `fokusZurueck` sagt, ob die Bedienung an den Griff zurückgeht (Escape, Klick auf
  // den Fänger, Wahl eines Punktes) oder dort bleibt, wohin der Mensch sie gerade selbst bewegt hat
  // (Heraustabben). Ein zweiter Fokusgriff daneben wäre genau die stille Ablösung, vor der
  // `Seitenblatt.tsx:31-35` warnt.
  //
  // Ist die Liste schon zu, ist dieser Weg WIRKUNGSLOS — und bewegt insbesondere keinen Fokus. Ohne
  // diese Sperre risse das Abräumen beim Schliessen (der Punkt, der den Fokus trug, verschwindet)
  // den Fokus ein zweites Mal herum, und die Fläche, die `onWahl` gerade öffnet, verlöre ihn wieder.
  const schliessen = useCallback((fokusZurueck: boolean): void => {
    if (!offenRef.current) {
      return;
    }
    offenRef.current = false;
    setOffen(false);
    if (fokusZurueck) {
      knopfRef.current?.focus();
    }
  }, []);
  const oeffnen = (): void => {
    offenRef.current = true;
    setOffen(true);
  };
  // Kein Punkt, kein Menüort: dann gibt es keinen Griff, kein Fokusziel und nichts zu schliessen.
  // `offen` kann in diesem Fall gar nicht wahr sein — der Griff, der es setzt, wird nicht gerendert.
  // Der Effekt unten hängt deshalb an `listeOffen` und meldet hier KEINEN Hörer an.
  const listeOffen = offen && punkte.length > 0;
  // Beide Hörer leben NUR, solange die Liste steht (Bauform `Seitenblatt.tsx:87-93`/`:115-121`):
  //  · `keydown` am Fenster — Escape schliesst, gleich ob der Fokus in der Liste steht oder daneben.
  //  · `focusout` an der Wurzel des Bauteils — wandert der Fokus aus dem Menü heraus (Tab über den
  //    letzten Punkt, Shift+Tab vor den Griff), geht die Liste zu und lässt ihn, wo er ist.
  //    Bewegungen INNERHALB (Griff → Punkt, Punkt → Punkt) tragen ein `relatedTarget` unter derselben
  //    Wurzel und schliessen nicht — sonst schlösse der Anfangsfokus die Liste sofort wieder.
  // Der Anfangsfokus ist `focusFirstIn` aus `lib/focusables.ts`, dieselbe eine Funktion, die
  // `Seitenblatt.tsx:114` und `ModalBoundaryContext.tsx:167` benutzen. Ziel ist die LISTE, nicht die
  // Wurzel: unter der Wurzel stünden Griff und Klickfänger vor dem ersten Punkt.
  useEffect(() => {
    if (!listeOffen) {
      return;
    }
    const wurzel = wurzelRef.current;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        schliessen(true);
      }
    };
    const onFocusOut = (e: FocusEvent): void => {
      const ziel = e.relatedTarget;
      if (ziel instanceof Node && wurzel?.contains(ziel)) {
        return;
      }
      schliessen(false);
    };
    window.addEventListener("keydown", onKey);
    wurzel?.addEventListener("focusout", onFocusOut);
    focusFirstIn(listeRef.current);
    return () => {
      window.removeEventListener("keydown", onKey);
      wurzel?.removeEventListener("focusout", onFocusOut);
    };
  }, [listeOffen, schliessen]);
  if (punkte.length === 0) {
    return null;
  }
  return (
    <span ref={wurzelRef} className="relative inline-flex">
      <button
        ref={setzeGriff}
        type="button"
        data-testid={testId}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={listeOffen}
        aria-controls={listeOffen ? listenId : undefined}
        // Umschalter wie bisher — nur führt der Zu-Zweig jetzt über den EINEN Schliessweg, statt
        // `setOffen` ein zweites Mal selbst anzufassen.
        onClick={() => {
          if (listeOffen) {
            schliessen(true);
          } else {
            oeffnen();
          }
        }}
        className={`grid h-8 w-8 place-items-center rounded-btn text-muted-2 transition-colors hover:bg-hairline-soft hover:text-text ${
          listeOffen ? "bg-hairline-soft text-text" : ""
        }`}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {listeOffen ? (
        <>
          <button
            type="button"
            aria-label={t("cmd.close")}
            tabIndex={-1}
            onClick={() => schliessen(true)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            ref={listeRef}
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
                  schliessen(true);
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
