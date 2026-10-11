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

/**
 * produkt:20261010:assistenz-avatarzustaende — WAS für ein Fehler (fachlich unterscheidbar, jeweils
 * mit eigenem Text an der Figur und eigener, ruhiger Darstellung):
 *   technisch  Server, Netz, Speichern — der Vorgang selbst ist fehlgeschlagen;
 *   quelle     der Frageweg hat geantwortet, aber ohne geprüfte Quelle/Grundlage — kein Erfolg;
 *   eingabe    eine Angabe der Person fehlt oder passt nicht (Feldprüfung, fehlende Einwilligung).
 */
export type FehlerArt = "technisch" | "quelle" | "eingabe";

export const FEHLER_ARTEN: readonly FehlerArt[] = ["technisch", "quelle", "eingabe"];

export interface Ergebnis {
  art: VorgangsErgebnis;
  seit: number;
  /** Nur bei `fehler`. */
  fehlerArt?: FehlerArt;
}

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
  ergebnis: Ergebnis | null;
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

let ergebnis: Ergebnis | null = null;
let freudeWecker: ReturnType<typeof setTimeout> | null = null;
const hoerer = new Set<() => void>();
/** produkt:20261010:assistenz-avatarzustaende — Kennung der jüngsten begonnenen Aktion. */
let aktuelleAktion = 0;

function benachrichtige(): void {
  for (const h of hoerer) {
    h();
  }
}

/**
 * Eine neue Aktion beginnt: ein früherer Fehler-, Pause- oder Freudezustand endet sofort. Die
 * zurückgegebene Kennung gehört zum Ergebnis dieser Aktion — ein späteres Ergebnis einer ÄLTEREN
 * Aktion (langsame Antwort, verspätetes Speichern) überschreibt die neuere dann nicht mehr.
 */
export function beginneAktion(): number {
  aktuelleAktion += 1;
  meldeErgebnis(null);
  return aktuelleAktion;
}

/**
 * Meldet das Ergebnis eines tatsächlich abgeschlossenen Vorgangs. `null` = neue Aktion beginnt.
 * Mit `aktion` (aus `beginneAktion`) zählt das Ergebnis nur, solange keine neuere Aktion begann.
 */
export function meldeErgebnis(
  art: VorgangsErgebnis | null,
  optionen: { aktion?: number; fehlerArt?: FehlerArt; jetzt?: number } = {},
): void {
  const { aktion, fehlerArt, jetzt = Date.now() } = optionen;
  if (aktion !== undefined && aktion !== aktuelleAktion) {
    // Veraltet: eine neuere Aktion bestimmt den Zustand.
    return;
  }
  if (freudeWecker !== null) {
    clearTimeout(freudeWecker);
    freudeWecker = null;
  }
  ergebnis =
    art === null
      ? null
      : art === "fehler"
        ? { art, seit: jetzt, fehlerArt: fehlerArt ?? "technisch" }
        : { art, seit: jetzt };
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
export function letztesErgebnis(): Ergebnis | null {
  return ergebnis;
}

export function useLetztesErgebnis(): Ergebnis | null {
  return useSyncExternalStore(abonniere, letztesErgebnis, letztesErgebnis);
}

/** Gründe des Fragewegs, die eine fehlende Angabe der Person sind — kein technischer Fehler. */
const EINGABE_GRUENDE: readonly string[] = ["einwilligung_fehlt"];

/**
 * Das Ergebnis einer Frage im echten Betrieb für den Ausdruck der Figur — aus dem tatsächlichen
 * Stand und der zuletzt abgelegten Nachricht der Assistenz:
 *   beantwortet + Antwort mit Grundlage und Beleg  → Freude (kurz)
 *   beantwortet, aber „ohne KI“ (keine geprüfte Quelle) → Fehler „quelle“ — kein Erfolg
 *   beantwortet, aber nicht gespeichert (ohne Beleg)   → kein Ergebnis (Bereit), keine Freude
 *   abgebrochen → Pause; fehlgeschlagen → Fehler „eingabe“ (z. B. Einwilligung fehlt) bzw. „technisch“
 */
export function ausdruckNachFrage(
  stand: "beantwortet" | "abgebrochen" | "fehlgeschlagen",
  letzte: { modus: string; grund?: string | null; ohneBeleg?: boolean } | null,
): { art: VorgangsErgebnis; fehlerArt?: FehlerArt } | null {
  if (stand === "abgebrochen") {
    return { art: "pause" };
  }
  if (stand === "fehlgeschlagen") {
    const eingabe = typeof letzte?.grund === "string" && EINGABE_GRUENDE.includes(letzte.grund);
    return { art: "fehler", fehlerArt: eingabe ? "eingabe" : "technisch" };
  }
  if (!letzte) {
    return null;
  }
  if (letzte.modus === "ohne_ki") {
    return { art: "fehler", fehlerArt: "quelle" };
  }
  if (letzte.ohneBeleg) {
    return null;
  }
  return { art: "freude" };
}

/** Der Textschlüssel des Zustands — Fehler je nach Art (Technik, fehlende Quelle, Angabe). */
export function zustandsTextSchluessel(zustand: AssistenzZustand, art?: FehlerArt): string {
  if (zustand === "fehler" && art && art !== "technisch") {
    return `assistenz.zustand.fehler_${art}`;
  }
  return `assistenz.zustand.${zustand}`;
}

// ------------------------------------------------------------------------------------------------
// produkt:20261010:assistenz-avatarzustaende — DIE BEWUSST GESTARTETE VORSCHAU der neun Zustände in
// der Avatar-Auswahl. Sie zeigt nur, wie ein Motiv aussieht; sie meldet KEIN Ergebnis, ändert weder
// Profil noch Gespräch noch Figur und hängt an keinem App-Ereignis.
// ------------------------------------------------------------------------------------------------

/** So lange steht jeder Zustand in der Vorschau — neun Zustände, gut zehn Sekunden insgesamt. */
export const VORSCHAU_SCHRITT_MS = 1_200;
