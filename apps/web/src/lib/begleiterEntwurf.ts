// ================================================================================================
// produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-12) — DER ENTWURF DER BEGLEITAPP.
// ================================================================================================
//
// Die Fläche der Mac-Begleitapp (`pages/Begleiter.tsx`) hielt ihren angefangenen Text nur im
// Komponentenstatus: Neuladen der App-Seite verlor ihn, und ein Wechsel des Word-Fensters schickte
// ihn still an das dann gebundene Dokument. Hier liegt er jetzt — wie im Web (`eingabe.ts`):
//   · in der Sitzung des WKWebView, GEBUNDEN an das Konto (Abmelden/anderes Konto findet nichts);
//   · samt URSPRUNG beim ersten Zeichen: Word-Fenster, Host, Dokumenttitel und Auswahlstand — KEIN
//     Markierungstext (der bleibt im Word-Kanal);
//   · samt ABGEWIESENER Entwürfe, die nur durch Zurückholen oder Verwerfen verschwinden.
// An den Server geht davon nichts.
import { useSyncExternalStore } from "react";

const SITZUNG = "klarwerk.begleiter.entwurf";

export interface BegleiterUrsprung {
  /** Das Word-Fenster beim Beginnen — `null`, wenn keines verbunden war. */
  instanz: string | null;
  titel: string | null;
  host: string | null;
  /** Der Auswahlstand in diesem Fenster (0 = keine Markierung). */
  auswahlStand: number;
}

export interface BegleiterAbgewiesen {
  id: string;
  text: string;
  ursprung: BegleiterUrsprung | null;
}

export interface BegleiterEntwurf {
  kontoId: string | null;
  text: string;
  ursprung: BegleiterUrsprung | null;
  abgewiesen: BegleiterAbgewiesen[];
}

const LEER: BegleiterEntwurf = { kontoId: null, text: "", ursprung: null, abgewiesen: [] };

function istUrsprung(roh: unknown): roh is BegleiterUrsprung {
  if (typeof roh !== "object" || roh === null) {
    return false;
  }
  const u = roh as BegleiterUrsprung;
  const textOderNull = (w: unknown): boolean => w === null || typeof w === "string";
  return (
    textOderNull(u.instanz) &&
    textOderNull(u.titel) &&
    textOderNull(u.host) &&
    typeof u.auswahlStand === "number"
  );
}

function laden(): BegleiterEntwurf {
  try {
    const roh = typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(SITZUNG);
    if (!roh) {
      return LEER;
    }
    const g = JSON.parse(roh) as Partial<BegleiterEntwurf>;
    const text = typeof g.text === "string" ? g.text : "";
    const abgewiesen = Array.isArray(g.abgewiesen)
      ? g.abgewiesen
          .filter(
            (e): e is BegleiterAbgewiesen =>
              typeof e === "object" &&
              e !== null &&
              typeof (e as BegleiterAbgewiesen).id === "string" &&
              typeof (e as BegleiterAbgewiesen).text === "string" &&
              (e as BegleiterAbgewiesen).text.length > 0,
          )
          .map((e) => ({
            id: e.id,
            text: e.text,
            ursprung: istUrsprung(e.ursprung) ? e.ursprung : null,
          }))
      : [];
    return {
      kontoId: typeof g.kontoId === "string" ? g.kontoId : null,
      text,
      ursprung: text && istUrsprung(g.ursprung) ? g.ursprung : null,
      abgewiesen,
    };
  } catch {
    return LEER;
  }
}

let stand: BegleiterEntwurf = laden();
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
    // ohne Sitzungsspeicher gilt der Entwurf nur bis zum Neuladen
  }
  for (const h of hoerer) {
    h();
  }
}

/**
 * Setzt den Entwurf des Kontos. `ursprungBeiBeginn` gilt nur, wenn hier ein NEUER Entwurf beginnt
 * (vorher leer); ein weitergeschriebener Entwurf behält seinen Ursprung, ein leeres Feld verliert ihn.
 */
export function setzeBegleiterEntwurf(
  kontoId: string | null,
  text: string,
  ursprungBeiBeginn: BegleiterUrsprung | null,
): void {
  if (stand.kontoId === kontoId && stand.text === text) {
    return;
  }
  const anderesKonto = stand.kontoId !== kontoId;
  const neu = !stand.text || anderesKonto;
  stand = {
    kontoId,
    text,
    ursprung: !text ? null : neu ? ursprungBeiBeginn : stand.ursprung,
    abgewiesen: anderesKonto ? [] : stand.abgewiesen,
  };
  sichern();
}

/** Ein anderes Konto (oder Abmelden) verwirft Entwurf und abgewiesene Entwürfe. */
export function begleiterEntwurfAnKontoBinden(kontoId: string | null): void {
  if (stand.kontoId === kontoId) {
    return;
  }
  const behalten = stand.kontoId === null && kontoId !== null;
  stand = behalten ? { ...stand, kontoId } : { ...LEER, kontoId };
  sichern();
}

/** Ein nicht angekommener Entwurf, während im Feld schon neuer Text steht — nie still ersetzt. */
export function fuegeBegleiterAbgewiesenHinzu(
  kontoId: string | null,
  text: string,
  ursprung: BegleiterUrsprung | null,
): void {
  if (stand.kontoId !== kontoId || !text.trim()) {
    return;
  }
  zaehler += 1;
  stand = {
    ...stand,
    abgewiesen: [
      { id: `bgl-abgewiesen-${Date.now().toString(36)}-${zaehler}`, text, ursprung },
      ...stand.abgewiesen,
    ],
  };
  sichern();
}

/** Nur auf bewusste Entscheidung (Zurückholen oder Verwerfen). */
export function entferneBegleiterAbgewiesen(
  kontoId: string | null,
  id: string,
): BegleiterAbgewiesen | null {
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

export const leseBegleiterEntwurf = (): BegleiterEntwurf => stand;

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

export function useBegleiterEntwurf(): BegleiterEntwurf {
  return useSyncExternalStore(abonnieren, leseBegleiterEntwurf, leseBegleiterEntwurf);
}

/** Nur für Tests. */
export function begleiterEntwurfZuruecksetzen(): void {
  stand = LEER;
  sichern();
}

/**
 * Hat sich das Ziel seit dem Beginnen geändert? Ein anderes Word-Fenster, ein Entwurf ohne damals
 * verbundenes Fenster oder eine andere Markierung im selben Fenster zählen als Zielwechsel.
 */
export function zielGewechselt(
  ursprung: BegleiterUrsprung | null,
  jetzt: { instanz: string; auswahlStand: number },
): boolean {
  if (!ursprung) {
    return false;
  }
  return ursprung.instanz !== jetzt.instanz || ursprung.auswahlStand !== jetzt.auswahlStand;
}
