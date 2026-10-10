// ================================================================================================
// produkt:20261010:assistenz-name-avatar — DIE NEUN ZUSTÄNDE DER ASSISTENZFIGUR, AUS ECHTEN EREIGNISSEN.
// ================================================================================================
//
// Vorgabe: `ANIMATIONSZUSTAENDE.json` (Bildpaket Erstauswahl v1). Neun Zustände — bereit, warten,
// nachdenken, zuhören, sprechen, ratlos, freude, fehler, pause — je mit Auslöser und Ende. Diese Datei
// leitet den Zustand AUSSCHLIESSLICH aus tatsächlichen App-Ereignissen ab; nichts wird behauptet, was
// nicht passiert ist:
//
//   bereit      nichts läuft
//   warten      eine Anfrage ist gesendet, die Antwort steht aus (Status „läuft")
//   nachdenken  NUR wenn das System eine laufende Antwortverarbeitung meldet. Der Frageweg meldet
//               heute keine eigene Verarbeitungsphase (eine Anfrage, eine Antwort) — der Zustand
//               ist angelegt, wird aber nicht vorgetäuscht (`verarbeitet` bleibt `false`).
//   zuhoeren    die Spracherkennung ist tatsächlich aktiv (nach erteilter Berechtigung gestartet)
//   sprechen    die Sprachausgabe spielt tatsächlich ab
//   ratlos      eine Entscheidung/Rückfrage der Person ist nötig (Status „Entscheidung nötig")
//   freude      eine bewusst angestossene Aktion ist bestätigt erfolgreich (Antwort gespeichert,
//               Profil gespeichert) — höchstens FREUDE_MS lang, dann von selbst zurück zu bereit
//   fehler      ein tatsächlicher Vorgang ist fehlgeschlagen — bis zur nächsten Aktion
//   pause       verkleinert, oder die Person hat die laufende Anfrage gestoppt
//
// Die Darstellung (motivgerechte Bewegung bzw. Lichtmodulation, `index.css`) hängt an
// `data-zustand` und `data-stil` der Figur; bei reduzierter Bewegung bleibt ein ruhiger, statischer
// Ausdruck plus Textstatus. Jeder Zustand steht zusätzlich als Text da.
import { useSyncExternalStore } from "react";

export const ASSISTENZ_ZUSTAENDE = [
  "bereit",
  "warten",
  "nachdenken",
  "zuhoeren",
  "sprechen",
  "ratlos",
  "freude",
  "fehler",
  "pause",
] as const;

export type AssistenzZustand = (typeof ASSISTENZ_ZUSTAENDE)[number];

/** Ergebnis eines abgeschlossenen Vorgangs — der Rest wird aus dem laufenden Zustand gelesen. */
export type VorgangsErgebnis = "freude" | "fehler" | "pause";

/** So lange bleibt die Freude stehen, dann zurück zu bereit (Vorgabe: „höchstens wenige Sekunden"). */
export const FREUDE_MS = 2_400;

export interface ZustandsLage {
  /** Figur verkleinert (oder Fläche zurückgetreten). */
  minimiert: boolean;
  /** Spracherkennung tatsächlich aktiv. */
  hoertZu: boolean;
  /** Sprachausgabe spielt tatsächlich ab. */
  spricht: boolean;
  /** Anfrage gesendet, Antwort steht aus. */
  laeuft: boolean;
  /** Das System meldet eine laufende Antwortverarbeitung (heute nie). */
  verarbeitet: boolean;
  /** Entscheidung bzw. Rückfrage der Person nötig. */
  rueckfrage: boolean;
  /** Das letzte abgeschlossene Ergebnis — oder `null`. */
  ergebnis: { art: VorgangsErgebnis; seit: number } | null;
  jetzt: number;
}

/**
 * Der eine Zustand der Figur. Vorrang: was die Person gerade selbst tut oder hört (Pause, Zuhören,
 * Sprechen), dann das Laufende (Nachdenken, Warten), dann die Rückfrage, zuletzt das Ergebnis.
 */
export function ermittleZustand(l: ZustandsLage): AssistenzZustand {
  if (l.minimiert) {
    return "pause";
  }
  if (l.hoertZu) {
    return "zuhoeren";
  }
  if (l.spricht) {
    return "sprechen";
  }
  if (l.laeuft) {
    return l.verarbeitet ? "nachdenken" : "warten";
  }
  if (l.rueckfrage) {
    return "ratlos";
  }
  if (l.ergebnis) {
    if (l.ergebnis.art === "freude") {
      return l.jetzt - l.ergebnis.seit < FREUDE_MS ? "freude" : "bereit";
    }
    return l.ergebnis.art;
  }
  return "bereit";
}

// ------------------------------------------------------------------------------------------------
// Das zuletzt abgeschlossene Ergebnis — ausserhalb von React, weil die Figur neu montiert werden
// kann (Breitenwechsel) und das Ergebnis dabei nicht verloren gehen darf.
// ------------------------------------------------------------------------------------------------

let ergebnis: { art: VorgangsErgebnis; seit: number } | null = null;
let freudeWecker: ReturnType<typeof setTimeout> | null = null;
const hoerer = new Set<() => void>();

function benachrichtige(): void {
  for (const h of hoerer) {
    h();
  }
}

/** Meldet das Ergebnis eines tatsächlich abgeschlossenen Vorgangs. `null` = neue Aktion beginnt. */
export function meldeErgebnis(art: VorgangsErgebnis | null, jetzt: number = Date.now()): void {
  if (freudeWecker !== null) {
    clearTimeout(freudeWecker);
    freudeWecker = null;
  }
  ergebnis = art === null ? null : { art, seit: jetzt };
  if (art === "freude") {
    // Von selbst zurück zu bereit — kein dauernder Jubel.
    freudeWecker = setTimeout(() => {
      freudeWecker = null;
      if (ergebnis?.art === "freude") {
        ergebnis = null;
        benachrichtige();
      }
    }, FREUDE_MS);
  }
  benachrichtige();
}

function abonniere(h: () => void): () => void {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

/** Das zuletzt gemeldete, noch gültige Ergebnis — oder `null`. */
export function letztesErgebnis(): { art: VorgangsErgebnis; seit: number } | null {
  return ergebnis;
}

export function useLetztesErgebnis(): { art: VorgangsErgebnis; seit: number } | null {
  return useSyncExternalStore(abonniere, letztesErgebnis, letztesErgebnis);
}
