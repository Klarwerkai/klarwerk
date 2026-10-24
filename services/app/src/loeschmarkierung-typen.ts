type LoeschmarkierungArt = "persoenliche_routinen";

export interface Loeschmarkierung {
  readonly art: LoeschmarkierungArt;
  readonly kontoId: string;
  /** Zeitpunkt der Löschung (ISO, UTC). */
  readonly am: string;
}

export interface LoeschmarkierungsAblage {
  /** Wo die Markierungen liegen — für die Auskunft, nie ein Inhalt. */
  readonly ort: string;
  vermerke(m: Loeschmarkierung): Promise<void>;
  alle(): Promise<Loeschmarkierung[]>;
}
