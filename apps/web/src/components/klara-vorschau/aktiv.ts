// ================================================================================================
// KLARA-VORSCHAU · DER SCHALTER — ist die Vorschau in dieser Sitzung eingeschaltet?
// ================================================================================================
//
// Der dokumentierte Einstieg ist die Adresse `/klara-vorschau` (docs/klara/klara-vorschau.md). Wer sie
// öffnet, schaltet die Vorschau für diese Browser-Sitzung ein: Klara begleitet ihn danach über die
// ganze Oberfläche — Erfassung, Fragen, jede andere Seite. „Vorschau beenden“ in Klaras Gespräch
// schaltet sie wieder aus. Ohne Einschalten bleibt alles wie bisher (der Hilfeknopf `KlaraAssistant`).
//
// Diese Datei hängt statisch an der Hülle und ist deshalb bewusst winzig; die Figur selbst wird
// erst nachgeladen, wenn der Schalter an ist.
import { useSyncExternalStore } from "react";

const SCHLUESSEL = "klarwerk.klaraVorschau.aktiv";

function lesen(): boolean {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(SCHLUESSEL) === "1";
  } catch {
    return false;
  }
}

let aktiv = lesen();
const hoerer = new Set<() => void>();

export function setzeKlaraVorschauAktiv(wert: boolean): void {
  if (aktiv === wert) {
    return;
  }
  aktiv = wert;
  try {
    if (wert) {
      sessionStorage.setItem(SCHLUESSEL, "1");
    } else {
      sessionStorage.removeItem(SCHLUESSEL);
    }
  } catch {
    // ohne Sitzungsspeicher gilt der Schalter nur bis zum Neuladen
  }
  for (const h of hoerer) {
    h();
  }
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

const lesenAktuell = (): boolean => aktiv;

export function useKlaraVorschauAktiv(): boolean {
  return useSyncExternalStore(abonnieren, lesenAktuell, lesenAktuell);
}
