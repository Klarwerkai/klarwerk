// PAKET 1 (D-AISTATE, Pedi 23.07.): der ehrliche Hinweis am HART ausgegrauten KI-Knopf — wird nur
// gezeigt, wenn für die Aufgabe kein Modell nutzbar ist. Kein stiller Fallback, der „KI läuft"
// vortäuscht: der Knopf ist deaktiviert, dieser Satz benennt den Grund. DOM-schlank, überall
// einsetzbar (Muster: kleiner gedämpfter Hinweistext unter/neben dem Knopf).
//
// R-1040: `hinweisKey` nennt den GRUND der Sperre, wenn der Aufrufer ihn kennt
// (`useAiSperrHinweisKey`, eine Regel für alle Flächen). Ohne Angabe bleibt es beim bisherigen Satz.
import { useTranslation } from "react-i18next";
import type { AiSperrHinweisKey } from "../lib/aiAvailability";

export function AiUnavailableHint({
  show,
  hinweisKey = "ai.unavailable.hint",
}: {
  show: boolean;
  hinweisKey?: AiSperrHinweisKey;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (!show) {
    return null;
  }
  return (
    <p className="mt-1.5 text-[12px] text-muted-2" data-hinweis={hinweisKey}>
      {t(hinweisKey)}
    </p>
  );
}
