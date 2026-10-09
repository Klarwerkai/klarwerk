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
// KEINE DOPPELMELDUNG — JE AKTION (Ben, Nacharbeit 11). Viele Flächen melden ihre Aktion schon
// selbst über den Bus, oft mit einem genaueren Satz („Quelle gespeichert", „Zuweisung an Pia").
// Bis hierher trat der zentrale Weg zurück, sobald IRGENDEINE Einblendung kam — schlossen zwei
// Aktionen zugleich ab, verschluckte die eine die Meldung der anderen. Jetzt gehören die Rückrufe
// einer Mutation zu IHRER Aktion: die eigenen `onSuccess`/`onError`/`onSettled` der Fläche und die
// Rückrufe aus `mutate(…, { … })` laufen geklammert (`inAktion`), und eine Einblendung darin zählt
// nur für diese Aktion. Am Ende der Aktion blendet der zentrale Weg ein, wenn SIE sich nicht selbst
// gemeldet hat — die Einblendung einer anderen Aktion unterdrückt nichts.
//
// WO DIE KLAMMER ANSETZT. Die Optionen einer Mutation werden bei jedem Rendern der Fläche neu
// gesetzt (`setOptions`), deshalb umhüllt der Cache sie beim Anlegen UND bei jedem Setzen. Die
// Rückrufe aus `mutate(…, { … })` ruft der Beobachter der Fläche in `onMutationUpdate` auf; die
// Klammer sitzt dort. Die Entscheidung fällt erst nach dem Abschluss-Ereignis (`updated` mit
// Erfolg/Fehler) — dann sind die Rückrufe der Fläche gelaufen.
//
// DER SATZ. Ein Fehler zeigt die Servermeldung (`ApiError`), sonst den allgemeinen Fehlersatz; ein
// Erfolg den allgemeinen Erledigt-Satz. Meldungen am Formular bleiben, wo sie sind — sie erklären
// am Ort, die Einblendung meldet einheitlich.
import { MutationCache } from "@tanstack/react-query";
import i18n from "i18next";
import { ApiError } from "../api/client";
import { einblenden, hatGemeldet, inAktion } from "../app/ToastContext";

/** Ein Rückruf, dessen Einblendungen für `aktion` zählen. */
function zugeordnet<A extends unknown[], R>(
  aktion: object,
  rueckruf: ((...args: A) => R) | undefined,
): ((...args: A) => R) | undefined {
  return rueckruf === undefined
    ? undefined
    : (...args: A): R => inAktion(aktion, () => rueckruf(...args));
}

function fehlersatz(fehler: unknown): string {
  return fehler instanceof ApiError && fehler.message ? fehler.message : i18n.t("state.error");
}

/** Der `MutationCache` der Anwendung — jede Speicheraktion meldet Erfolg und Fehler. */
export function einblendungsMutationCache(): MutationCache {
  const cache = new MutationCache();
  // Je Mutation ihre Aktion; je Beobachter die Aktion der Mutation, an der er gerade hängt.
  const aktionVon = new WeakMap<object, object>();
  const aktionAmBeobachter = new WeakMap<object, object>();
  cache.subscribe((ereignis) => {
    if (ereignis.type === "added") {
      const mutation = ereignis.mutation;
      const aktion = {};
      aktionVon.set(mutation, aktion);
      const setzen = mutation.setOptions.bind(mutation);
      mutation.setOptions = (optionen) =>
        setzen({
          ...optionen,
          onSuccess: zugeordnet(aktion, optionen.onSuccess),
          onError: zugeordnet(aktion, optionen.onError),
          onSettled: zugeordnet(aktion, optionen.onSettled),
        });
      mutation.setOptions(mutation.options);
      return;
    }
    if (ereignis.type === "observerAdded") {
      const beobachter = ereignis.observer;
      const aktion = aktionVon.get(ereignis.mutation);
      if (aktion === undefined) {
        return;
      }
      const schonUmhuellt = aktionAmBeobachter.has(beobachter);
      aktionAmBeobachter.set(beobachter, aktion);
      if (!schonUmhuellt) {
        const weiter = beobachter.onMutationUpdate.bind(beobachter);
        beobachter.onMutationUpdate = (action) => {
          const laufend = aktionAmBeobachter.get(beobachter);
          return laufend === undefined ? weiter(action) : inAktion(laufend, () => weiter(action));
        };
      }
      return;
    }
    if (ereignis.type !== "updated") {
      return;
    }
    const { action } = ereignis;
    if (action.type !== "success" && action.type !== "error") {
      return;
    }
    const aktion = aktionVon.get(ereignis.mutation);
    const art = action.type;
    const satz = art === "error" ? fehlersatz(action.error) : i18n.t("einblendung.erledigt");
    // Nach dem laufenden Durchlauf: die Rückrufe der Fläche sind dann sicher gelaufen.
    setTimeout(() => {
      if (aktion === undefined || !hatGemeldet(aktion)) {
        einblenden(art, satz);
      }
    }, 0);
  });
  return cache;
}
