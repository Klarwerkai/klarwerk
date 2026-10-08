// ================================================================================================
// R-0953 / R-1015 (Nacharbeit 7) — JEDE SPEICHERAKTION MELDET SICH, AN EINER STELLE.
// ================================================================================================
//
// R-0953 verlangt: „Erfolge und Fehler erscheinen als kurze, einheitliche Einblendungen statt als
// stille Zustandsänderung". Die Quelle nennt den Ort selbst — „Die Härtung der Toasts ist Teil der
// geplanten globalen Fehlerbrücke" —, und R-1015 will den „einheitlichen Rückweg an einer Stelle
// statt vieler eigener Lösungen". Dieser Ort ist der `MutationCache` des QueryClient: JEDE
// `useMutation` im Web läuft durch ihn, auch die, die bis hierher nur eine Meldung am Formular
// trugen oder gar keine.
//
// KEINE DOPPELMELDUNG. Viele Flächen melden ihre Aktion schon selbst über den Bus — oft mit einem
// genaueren Satz („Quelle gespeichert", „Zuweisung an Pia"). Der zentrale Weg wartet deshalb das
// Ende des Durchlaufs ab (die eigenen `onSuccess`/`onError` der Fläche und die Rückrufe von
// `mutate(…, { … })` laufen davor) und blendet NUR ein, wenn seitdem keine Einblendung kam. Die
// genauere Meldung der Fläche hat also Vorrang; fehlt sie, steht die einheitliche da.
//
// DER SATZ. Ein Fehler zeigt die Servermeldung (`ApiError`), sonst den allgemeinen Fehlersatz; ein
// Erfolg den allgemeinen Erledigt-Satz. Meldungen am Formular bleiben, wo sie sind — sie erklären
// am Ort, die Einblendung meldet einheitlich.
import { MutationCache } from "@tanstack/react-query";
import i18n from "i18next";
import { ApiError } from "../api/client";
import { einblenden, einblendungsStand } from "../app/ToastContext";
import type { ToastKind } from "./toastBus";

/** Blendet ein, sofern bis zum Ende des Durchlaufs keine andere Einblendung kam. */
function meldeNachDurchlauf(kind: ToastKind, satz: string): void {
  const stand = einblendungsStand();
  // Zweimal „nach hinten": die eigenen Rückrufe der Fläche laufen in Mikroaufgaben, die Rückrufe
  // aus `mutate(…, { … })` über den Benachrichtigungstakt von react-query (eigener Zeitgeber).
  setTimeout(() => {
    setTimeout(() => {
      if (einblendungsStand() === stand) {
        einblenden(kind, satz);
      }
    }, 0);
  }, 0);
}

/** Der `MutationCache` der Anwendung — jede Speicheraktion meldet Erfolg und Fehler. */
export function einblendungsMutationCache(): MutationCache {
  return new MutationCache({
    onSuccess: () => meldeNachDurchlauf("success", i18n.t("einblendung.erledigt")),
    onError: (fehler) =>
      meldeNachDurchlauf(
        "error",
        fehler instanceof ApiError && fehler.message ? fehler.message : i18n.t("state.error"),
      ),
  });
}
