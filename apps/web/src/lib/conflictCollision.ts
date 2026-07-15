// SCRUM-492: DOM-freie Ableitung der visuellen Kollisions-Gegenüberstellung fürs Konflikt-Board.
// Sollbild: zwei gegenübergestellte Kacheln (Titel aus dem KO, knappe Kernaussage, hervorgehobener
// Streitwert) + ein sichtbarer Kollisionspunkt + „Kollision bei: {streitpunkt}". Die wörtlichen
// Belegzitate bleiben der Beweis im <details>; die Kacheln sind die Zusammenfassung. Eine Quelle für
// Komponente + Test (wie SCRUM-458/486). Titel NICHT vom Modell — hier aus dem KO-Paar aufgelöst.
import type { Conflict, KnowledgeObject } from "../api/types";
import { type Participant, participant } from "./boardCard";
import { conflictKoPair } from "./conflictView";

export const CONFLICT_COLLISION_TEXT = {
  at: "con.collision.at", // „Kollision bei"
  verbatim: "con.collision.verbatim", // Titel/aria-Hinweis: Streitwert wörtlich aus dem Beleg
  point: "con.collision.point", // aria-Label des Kollisionspunkts (Marker zwischen den Kacheln)
} as const;

// Welche Darstellung ein Konflikt bekommt: strukturierte Kollisions-Kacheln, sonst die zwei
// wörtlichen Zitate (Alt-Auto-Konflikte), sonst die Textbeschreibung (manuelle/Alt-Konflikte).
export type ConflictDisplayMode = "kollision" | "quotes" | "text";

export function conflictDisplayMode(conflict: Conflict): ConflictDisplayMode {
  if (conflict.detector?.kollision) {
    return "kollision";
  }
  if (conflict.detector?.quotes) {
    return "quotes";
  }
  return "text";
}

// Eine aufgelöste Kachel-Seite: Titel aus dem KO (Fallback „entfernt", nie die UUID), plus die
// Modell-Kernaussage/-Streitwert und ob der Streitwert wörtlich im Beleg steht (dann als belegt
// kennzeichenbar).
export interface CollisionSide {
  title: Participant;
  kernaussage: string;
  streitwert: string;
  streitwertWoertlich: boolean;
}

export interface ResolvedCollision {
  streitpunkt: string;
  a: CollisionSide;
  b: CollisionSide;
}

// Baut die Kachel-Daten aus dem Konflikt + KO-Bestand. null, wenn keine strukturierte Kollision
// vorliegt (dann greift die Fallback-Kaskade in der Komponente).
export function resolveCollision(
  conflict: Conflict,
  kos: readonly KnowledgeObject[],
): ResolvedCollision | null {
  const kollision = conflict.detector?.kollision;
  if (!kollision) {
    return null;
  }
  const pair = conflictKoPair(conflict, kos);
  return {
    streitpunkt: kollision.streitpunkt,
    a: {
      title: participant(pair.a),
      kernaussage: kollision.seiteA.kernaussage,
      streitwert: kollision.seiteA.streitwert,
      streitwertWoertlich: kollision.seiteA.streitwertWoertlich,
    },
    b: {
      title: participant(pair.b),
      kernaussage: kollision.seiteB.kernaussage,
      streitwert: kollision.seiteB.streitwert,
      streitwertWoertlich: kollision.seiteB.streitwertWoertlich,
    },
  };
}

// Der Streitpunkt wird nur gezeigt, wenn das Modell ihn wirklich geliefert hat (kein leeres „bei:").
export function hasStreitpunkt(collision: ResolvedCollision): boolean {
  return collision.streitpunkt.trim().length > 0;
}
