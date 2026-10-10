// ==================================================================================================
// KLARA 03 (produkt:20261007:klara-kontext-tutorial) — DAS OBJEKT, DAS DIE LESEFLÄCHE GERADE ZEIGT.
// ==================================================================================================
//
// `lib/objektbezug.ts` hält Kennung und Fassung (`meldeGelesenenStand`). Klara braucht daneben, was
// die Fläche in diesem Augenblick ZEICHNET: Titel, Prüfstatus, ob gelesen oder bearbeitet wird und
// was die Rolle dort darf. Dieselbe Bauform wie der gelesene Stand: gemeldet wird, was ohnehin auf
// dem Bildschirm steht — kein eigener Abruf, kein zweiter Cache-Schlüssel. Verlässt die Fläche den
// Eintrag (anderer Eintrag, andere Seite), meldet sie `null`; Klara nennt dann kein Objekt, statt
// das zuletzt gesehene weiterzutragen.
import { useSyncExternalStore } from "react";

export interface Leseobjekt {
  readonly koId: string;
  readonly titel: string;
  /** Die Inhaltsfassung (`KnowledgeObject.version`). */
  readonly fassung: number | null;
  readonly pruefstatus: "geprueft" | "ungeprueft";
  readonly modus: "lesen" | "bearbeiten";
  /** Darf die Rolle hier bearbeiten? (dieselbe Regel wie der Bearbeiten-Knopf der Fläche) */
  readonly darfBearbeiten: boolean;
  /** Steht die Leseübersetzung statt des Originals da? */
  readonly lesart: "original" | "uebersetzung";
}

type Zuhoerer = () => void;
let aktuell: Leseobjekt | null = null;
const zuhoerer = new Set<Zuhoerer>();

function gleich(a: Leseobjekt | null, b: Leseobjekt | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.koId === b.koId &&
    a.titel === b.titel &&
    a.fassung === b.fassung &&
    a.pruefstatus === b.pruefstatus &&
    a.modus === b.modus &&
    a.darfBearbeiten === b.darfBearbeiten &&
    a.lesart === b.lesart
  );
}

export function meldeLeseobjekt(o: Leseobjekt | null): void {
  if (gleich(aktuell, o)) {
    return;
  }
  aktuell = o;
  for (const z of zuhoerer) {
    z();
  }
}

/** Nimmt die Meldung zurück — aber nur, wenn sie noch zu DIESEM Objekt gehört. */
export function zieheLeseobjektZurueck(koId: string): void {
  if (aktuell?.koId === koId) {
    meldeLeseobjekt(null);
  }
}

export function leseobjektJetzt(): Leseobjekt | null {
  return aktuell;
}

export function leseobjektAbonnieren(z: Zuhoerer): () => void {
  zuhoerer.add(z);
  return () => {
    zuhoerer.delete(z);
  };
}

export function useLeseobjekt(): Leseobjekt | null {
  return useSyncExternalStore(leseobjektAbonnieren, leseobjektJetzt, leseobjektJetzt);
}
