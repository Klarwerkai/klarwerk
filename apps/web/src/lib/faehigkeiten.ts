// ================================================================================================
// R-1012 · DER ERSTE BLICK: WAS KLARWERK LEISTEN KANN (OFFEN.md U4, SCRUM-474).
// ================================================================================================
//
// Nataschas zweite Bedingung fürs Wiederbenutzen: „ein umfassendes Bild, was Klarwerk in der Lage
// ist zu leisten" — ohne Schulung. Bis hierher gab es dafür nur Bruchstücke („Über KLARWERK" mit
// zwei Sätzen, den Wissenskreis mit vier Schritten, die Einstiegsführung auf `/hilfe`).
//
// DER ORT IST DAS VORHANDENE BLATT „Über KLARWERK" im „…"-Menü der Startseite
// (`components/start/StartPanel.tsx`), nicht das Sichtfeld: JOB 3064 H5 (Pedi 04.09.) lässt auf
// `/start` nur Frage, Feld, „FÜR DICH" und „ZULETZT" stehen, und mega38 G2 hat Kacheln als „zweite
// Navigation" von der Fläche genommen. Beides bleibt unberührt.
//
// DIE REIHENFOLGE IST DIE KERNSCHLEIFE (R-0939): erfassen → prüfen → finden. Jede Gruppe nennt die
// Bereiche, die heute zu diesem Schritt gehören, und führt direkt in die volle Funktion.
//
// KEIN ZWEITES REGISTER. Ziel und Name eines Eintrags kommen aus `app/navigation.ts` — der Pfad aus
// dem Navigationspunkt, die Beschriftung aus `anzeigeNameKey` (UX-08: ein Name je Bereich). Eigene
// Texte trägt nur der eine Satz, was man dort tun kann (`texte/erstnutzer.ts`). Stufe-2-Bereiche
// stehen nicht darin: ein Erstnutzer sieht sie nicht, und für Admins gibt es den Punkt „Stufe 2".
import { ALL_ITEMS, type NavItem, anzeigeNameKey } from "../app/navigation";

export type FaehigkeitsSchritt = "erfassen" | "pruefen" | "finden";

export const FAEHIGKEITS_SCHRITTE: readonly FaehigkeitsSchritt[] = [
  "erfassen",
  "pruefen",
  "finden",
];

/** Navigationspunkt-`id` je Schritt, in Lesereihenfolge. */
const BEREICHE: Record<FaehigkeitsSchritt, readonly string[]> = {
  erfassen: ["erfassen"],
  pruefen: ["validierung", "konflikte", "duplikate", "lebenszyklus"],
  finden: ["fragen", "bibliothek", "wissensnetz"],
};

export interface Faehigkeit {
  readonly id: string;
  readonly schritt: FaehigkeitsSchritt;
  /** Beschriftung — derselbe Schlüssel wie in Kopfband, Zahnrad und „Gehe zu …". */
  readonly nameKey: string;
  /** Der eine Satz, was man dort tun kann. */
  readonly textKey: string;
  /** Die Route des Navigationspunkts. */
  readonly to: string;
}

function punkt(id: string): NavItem {
  const item = ALL_ITEMS.find((i) => i.id === id);
  if (!item) {
    throw new Error(`Navigationspunkt „${id}" fehlt — die Übersicht nennt nur Vorhandenes.`);
  }
  return item;
}

export const FAEHIGKEITEN: readonly Faehigkeit[] = FAEHIGKEITS_SCHRITTE.flatMap((schritt) =>
  BEREICHE[schritt].map((id) => {
    const item = punkt(id);
    return {
      id,
      schritt,
      nameKey: anzeigeNameKey(item),
      textKey: `erstnutzer.faehigkeiten.${id}`,
      to: item.path,
    };
  }),
);

/** Überschrift einer Gruppe. */
export function faehigkeitsSchrittKey(schritt: FaehigkeitsSchritt): string {
  return `erstnutzer.faehigkeiten.schritt.${schritt}`;
}
