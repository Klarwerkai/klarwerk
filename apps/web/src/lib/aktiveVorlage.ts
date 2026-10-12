// produkt:20261007:templates-default — DIE VORLAGE, MIT DER GERADE GESCHRIEBEN WIRD.
//
// Der Editor (`components/VorlagenWahl.tsx`) setzt hier DIESELBEN Felder, die er einsetzt — die
// der Fassung, mit der der Beitrag geschrieben wird; Klara (`components/KlaraVorlagenKontext.tsx`)
// liest sie von hier. So begleitet Klara mit genau den Feldern und Pflichtangaben, die der Editor
// verwendet und der Server beim Einreichen prüft — keine zweite Beschreibung derselben Vorlage.
// Kein Speichern: der Stand gilt für die offene Seite.
import { useSyncExternalStore } from "react";
import type { SpaceVorgabe, VorlagenGeltung } from "../api/vorlagen";
import type { StrukturVorlage } from "./vorlagenStruktur";

export interface AktiveFassung extends StrukturVorlage {
  id: string;
  version: number;
  geltung: VorlagenGeltung;
}

export interface AktiveVorlage {
  /** `null` = freie Eingabe. */
  vorlage: AktiveFassung | null;
  space: { id: string; name: string } | null;
  vorgabe: SpaceVorgabe | null;
  /** Die im Space verbindliche Vorlage, falls eine gilt. */
  verbindlich: AktiveFassung | null;
}

let stand: AktiveVorlage | null = null;
const hoerer = new Set<() => void>();

export function setzeAktiveVorlage(neu: AktiveVorlage | null): void {
  stand = neu;
  for (const h of hoerer) {
    h();
  }
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => {
    hoerer.delete(h);
  };
}

const lesen = (): AktiveVorlage | null => stand;

export function useAktiveVorlage(): AktiveVorlage | null {
  // Derselbe Stand auch beim statischen Rendern — es gibt keinen zweiten, „serverseitigen“.
  return useSyncExternalStore(abonnieren, lesen, lesen);
}
