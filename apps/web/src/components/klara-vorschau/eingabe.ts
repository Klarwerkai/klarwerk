// ================================================================================================
// ASSISTENZ IM PRODUKT · DIE ANGEFANGENE EINGABE — übersteht Schliessen, Verkleinern, Breitenwechsel
// und Neuladen.
// ================================================================================================
//
// Die Hülle montiert die Assistenz beim Wechsel über 900 px neu (`shell/AppShell.tsx`), und ein
// Neuladen beginnt ohnehin von vorn. Eine halb getippte Frage lag bisher in einem `useState` der
// Figur und ging dabei verloren. Sie liegt jetzt in der Browser-Sitzung — gebunden an das Konto, unter
// dem sie getippt wurde: Abmelden oder ein anderes Konto findet sie nicht vor. An den Server geht
// davon nichts; gesendet wird erst mit „Senden“.
//
// produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-12): mit dem Text bleibt auch der
// Ort erhalten, an dem er BEGONNEN wurde (`herkunft`). Wer danach die Seite oder das Objekt wechselt,
// sendet nicht still auf das neue Ziel — die Fläche klärt den Zielwechsel ausdrücklich.
//
// Nacharbeit 5 (Bens Befund): ein ABGEWIESENER Entwurf (nicht gesendet, während im Feld schon neuer
// Text stand) liegt ebenfalls hier — kontogebunden, über Neuladen und Neumontage hinweg, samt
// Herkunft. Er verschwindet NUR durch eine bewusste Entscheidung (Zurückholen oder Verwerfen), nie
// durch einen weiteren Sendeversuch.
import { useSyncExternalStore } from "react";
import type { Herkunft } from "./zustand";

const SITZUNG = "klarwerk.assistenz.eingabe";

export interface AbgewiesenerEntwurf {
  id: string;
  text: string;
  herkunft: Herkunft | null;
}

interface Gespeichert {
  kontoId: string | null;
  text: string;
  /** Der Ort beim ersten Zeichen dieses Entwurfs — `null` ohne Entwurf. */
  herkunft: Herkunft | null;
  abgewiesen: AbgewiesenerEntwurf[];
}

const LEER: Gespeichert = { kontoId: null, text: "", herkunft: null, abgewiesen: [] };

function istHerkunft(roh: unknown): roh is Herkunft {
  return (
    typeof roh === "object" &&
    roh !== null &&
    typeof (roh as Herkunft).pfad === "string" &&
    typeof (roh as Herkunft).seitenName === "string" &&
    typeof (roh as Herkunft).objekt === "string"
  );
}

function abgewieseneAus(roh: unknown): AbgewiesenerEntwurf[] {
  if (!Array.isArray(roh)) {
    return [];
  }
  return roh
    .filter(
      (e): e is AbgewiesenerEntwurf =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as AbgewiesenerEntwurf).id === "string" &&
        typeof (e as AbgewiesenerEntwurf).text === "string" &&
        (e as AbgewiesenerEntwurf).text.length > 0,
    )
    .map((e) => ({
      id: e.id,
      text: e.text,
      herkunft: istHerkunft(e.herkunft) ? e.herkunft : null,
    }));
}

function laden(): Gespeichert {
  try {
    const roh = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(SITZUNG);
    if (!roh) {
      return LEER;
    }
    const g = JSON.parse(roh) as Partial<Gespeichert>;
    const text = typeof g.text === "string" ? g.text : "";
    return {
      kontoId: typeof g.kontoId === "string" ? g.kontoId : null,
      text,
      herkunft: text && istHerkunft(g.herkunft) ? g.herkunft : null,
      abgewiesen: abgewieseneAus(g.abgewiesen),
    };
  } catch {
    return LEER;
  }
}

let stand: Gespeichert = laden();
const hoerer = new Set<() => void>();
let zaehler = 0;

function sichern(): void {
  try {
    if (stand.text || stand.abgewiesen.length > 0) {
      sessionStorage.setItem(SITZUNG, JSON.stringify(stand));
    } else {
      sessionStorage.removeItem(SITZUNG);
    }
  } catch {
    // ohne Sitzungsspeicher gilt die Eingabe nur bis zum Neuladen
  }
  for (const h of hoerer) {
    h();
  }
}

/**
 * Setzt die angefangene Eingabe des angegebenen Kontos. `herkunftBeiBeginn` gilt nur, wenn hier ein
 * NEUER Entwurf beginnt (vorher leer); ein weitergeschriebener Entwurf behält seinen Ursprung, ein
 * geleertes Feld verliert ihn.
 */
export function setzeEingabe(
  kontoId: string | null,
  text: string,
  herkunftBeiBeginn: Herkunft | null = null,
): void {
  if (stand.kontoId === kontoId && stand.text === text) {
    return;
  }
  const anderesKonto = stand.kontoId !== kontoId;
  const neuBegonnen = !stand.text || anderesKonto;
  const herkunft = !text ? null : neuBegonnen ? herkunftBeiBeginn : stand.herkunft;
  stand = { kontoId, text, herkunft, abgewiesen: anderesKonto ? [] : stand.abgewiesen };
  sichern();
}

/**
 * Ein abgewiesener Entwurf kommt dazu — vorne, damit der jüngste zuerst steht. Es gibt keine
 * Obergrenze: ein älterer Eintrag wird nie still verdrängt.
 */
export function fuegeAbgewiesenHinzu(
  kontoId: string | null,
  text: string,
  herkunft: Herkunft | null,
): boolean {
  if (stand.kontoId !== kontoId || !text.trim()) {
    return false;
  }
  zaehler += 1;
  const eintrag: AbgewiesenerEntwurf = {
    id: `abgewiesen-${Date.now().toString(36)}-${zaehler}`,
    text,
    herkunft,
  };
  stand = { ...stand, abgewiesen: [eintrag, ...stand.abgewiesen] };
  sichern();
  return true;
}

/** Nur auf bewusste Entscheidung (Zurückholen oder Verwerfen): genau dieser Eintrag geht. */
export function entferneAbgewiesen(kontoId: string | null, id: string): AbgewiesenerEntwurf | null {
  if (stand.kontoId !== kontoId) {
    return null;
  }
  const e = stand.abgewiesen.find((x) => x.id === id) ?? null;
  if (e) {
    stand = { ...stand, abgewiesen: stand.abgewiesen.filter((x) => x.id !== id) };
    sichern();
  }
  return e;
}

/** Ein anderes Konto (oder Abmelden) verwirft die angefangene Eingabe. */
export function eingabeAnKontoBinden(kontoId: string | null): void {
  if (stand.kontoId === kontoId) {
    return;
  }
  // Noch keinem Konto zugeordnet (getippt, während die Sitzung noch geladen wurde): nur zuordnen.
  const behalten = stand.kontoId === null && kontoId !== null;
  stand = {
    kontoId,
    text: behalten ? stand.text : "",
    herkunft: behalten ? stand.herkunft : null,
    abgewiesen: behalten ? stand.abgewiesen : [],
  };
  sichern();
}

/** Wo der aktuelle Entwurf begonnen wurde — `null` ohne Entwurf oder ohne bekannten Ort. */
export const leseEingabeHerkunft = (): Herkunft | null => stand.herkunft;

const leseStand = (): Gespeichert => stand;

/** Der Entwurf samt Ursprung, für die Anzeige eines Zielwechsels. */
export function useEingabeStand(): Gespeichert {
  return useSyncExternalStore(abonnieren, leseStand, leseStand);
}

const leseAbgewiesen = (): AbgewiesenerEntwurf[] => stand.abgewiesen;

/** Die abgewiesenen Entwürfe des aktuellen Kontos. */
export function useAbgewiesen(): AbgewiesenerEntwurf[] {
  return useSyncExternalStore(abonnieren, leseAbgewiesen, leseAbgewiesen);
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

export const leseEingabe = (): string => stand.text;

export function useEingabe(): string {
  return useSyncExternalStore(abonnieren, leseEingabe, leseEingabe);
}

/**
 * Nur für Tests (`zuruecksetzenGanz`): alles auf Anfang. „Vorschau beenden“ berührt die Eingabe
 * NICHT — sie gehört der Person, nicht der Vorschau.
 */
export function eingabeZuruecksetzen(): void {
  stand = LEER;
  sichern();
}
