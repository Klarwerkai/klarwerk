// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung (AA-04) — DER EINE AUSFÜHRUNGSWEG DER KÜRZEL.
// ================================================================================================
//
// `KlaraKuerzelAusfuehrung` steht einmal in der Klara-Ebene der Hülle (`shell/AppShell.tsx`). Sie
// liest die bestätigten Kürzel des angemeldeten Kontos und hält GENAU EINEN `keydown`-Hörer am
// Fenster. Ändert sich die Belegung, wird der alte Hörer im Effekt-Abbau entfernt und ein neuer mit
// der neuen Belegung angemeldet — eine geänderte Kombination wirkt sofort, eine entfernte gar nicht
// mehr, und es gibt nie zwei Hörer für dieselbe Aktion. Ohne Belegung hängt kein Hörer.
//
// Der Hörer führt selbst nichts aus: er meldet die Aktion über `loeseKlaraAktionAus`, und die
// vorhandene Fläche (Gespräch `KlaraVorschau.tsx`, Seitenhilfe `KlaraAssistant.tsx`) ruft ihren
// eigenen, schon gelieferten Weg auf (`useKlaraAktion`). So gelten deren Regeln weiter: nie zwei
// offene Flächen, Mikrofon nur bei sichtbarem Stopp, Freigaben des Browsers.
//
// NICHT AUSGELÖST wird:
//   · während eine Kombination im Setup aufgenommen wird (`kuerzelAufnahmeLaeuft`);
//   · solange eine modale Fläche offen ist (`useModalLocked`, wie die Befehlspalette);
//   · bei gedrückt gehaltener Taste (`repeat`) — eine Betätigung, eine Aktion;
//   · bei Eingabe über einen Kompositionseditor (`isComposing`, z. B. Akzente, IME);
//   · wenn ein Textfeld oder Editor das Ereignis schon selbst behandelt hat (`defaultPrevented`) —
//     vorhandene Bearbeitungskürzel gehen vor. Normales Schreiben kann ohnehin nichts auslösen: jede
//     Belegung braucht Befehlstaste oder Strg (`lib/klaraTastenkuerzel.ts`).
import { useEffect, useRef } from "react";
import { useSession } from "../../app/AuthContext";
import { useModalLocked } from "../../app/ModalBoundaryContext";
import {
  KLARA_AKTION_EREIGNIS,
  type KlaraKuerzelAktion,
  aktionFuer,
  kuerzelAufnahmeLaeuft,
  ladeTastenkuerzel,
  loeseKlaraAktionAus,
  useTastenkuerzel,
  verwerfeTastenkuerzel,
  wirksameEintraege,
} from "../../lib/klaraTastenkuerzel";

export function KlaraKuerzelAusfuehrung(): null {
  const sitzung = useSession();
  const kontoId = sitzung.user?.id ?? null;
  const beantwortet = !sitzung.isLoading && sitzung.sitzungslage !== "unbeantwortet";
  useEffect(() => {
    if (!beantwortet) {
      return;
    }
    if (kontoId) {
      void ladeTastenkuerzel(kontoId);
    } else {
      verwerfeTastenkuerzel();
    }
  }, [beantwortet, kontoId]);

  const lage = useTastenkuerzel();
  const eintraege = wirksameEintraege(lage);
  const modalOffen = useModalLocked();
  useEffect(() => {
    const belegt = eintraege.filter((e) => e.belegung !== null);
    if (belegt.length === 0) {
      return;
    }
    const beiTaste = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.isComposing || kuerzelAufnahmeLaeuft() || modalOffen) {
        return;
      }
      const aktion = aktionFuer(e, belegt);
      if (!aktion) {
        return;
      }
      // Auch eine Wiederholung gehört Klara — sie soll nicht nachträglich im Browser landen.
      e.preventDefault();
      if (e.repeat) {
        return;
      }
      loeseKlaraAktionAus(aktion);
    };
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
  }, [eintraege, modalOffen]);
  return null;
}

/**
 * Für die ausführende Fläche: ruft `ausfuehren` für jede gemeldete Klara-Aktion auf. Der Rückruf
 * darf sich bei jedem Rendern ändern; angemeldet ist immer genau ein Hörer.
 */
export function useKlaraAktion(ausfuehren: (aktion: KlaraKuerzelAktion) => void): void {
  const ref = useRef(ausfuehren);
  ref.current = ausfuehren;
  useEffect(() => {
    const bei = (e: Event): void => {
      const aktion = (e as CustomEvent<{ aktion?: KlaraKuerzelAktion }>).detail?.aktion;
      if (aktion) {
        ref.current(aktion);
      }
    };
    window.addEventListener(KLARA_AKTION_EREIGNIS, bei);
    return () => window.removeEventListener(KLARA_AKTION_EREIGNIS, bei);
  }, []);
}
