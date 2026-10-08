// ================================================================================================
// R-1637 · KONFLIKT-CLUSTER-ERKENNUNG — zusammenhängende Widersprüche als Gruppe.
// ================================================================================================
//
// Originalwortlaut (KLARWERK-Funktions-Roadmap §4.3): „Wenn zu einem Thema mehrere widersprüchliche
// Wissensobjekte existieren, zeigt KLARWERK das als Cluster statt als einzelnen Konflikt — das hilft
// Controllern, systematische Wissens-Unklarheiten zu erkennen statt einzelne Symptome."
//
// WAS HIER „DASSELBE THEMA" HEISST — belegt, nicht geraten: zwei Widersprüche gehören zusammen,
// wenn sie einen Beitrag teilen (A↯B und B↯C). Die Zusammengehörigkeit ist also der Zusammenhang im
// Widerspruchsgraphen, nicht eine Kategorie oder ein Textvergleich. Ein Cluster entsteht erst ab
// DREI verschiedenen Beiträgen; ein einzelnes Paar bleibt ein einzelner Konflikt — auch wenn
// zwischen denselben zwei Beiträgen mehrere Konfliktarten offen sind (das sind nicht „mehrere
// widersprüchliche Wissensobjekte").
//
// Eingabe ist ausschliesslich die Liste, die die Seite ohnehin zeigt (`GET /api/conflicts`: nur
// offene und für den Betrachter sichtbare Paare). Ein Cluster kann deshalb keinen Beitrag nennen,
// den der Betrachter nicht sehen darf. Rein und DOM-frei; keine Backend-Änderung.
import type { Conflict } from "../api/types";

type Kante = Pick<Conflict, "id" | "koA" | "koB">;

export interface KonfliktCluster {
  /** Konflikt-IDs in der Reihenfolge der Eingabe. */
  konflikte: string[];
  /** Beteiligte Beiträge (KO-IDs) in der Reihenfolge ihrer ersten Nennung. */
  beitraege: string[];
}

/** Ab so vielen verschiedenen Beiträgen ist ein Zusammenhang ein Cluster. */
export const CLUSTER_MIN_BEITRAEGE = 3;

function wurzelVon(eltern: Map<string, string>, ko: string): string {
  let w = ko;
  while (eltern.get(w) !== w) {
    w = eltern.get(w) ?? w;
  }
  // Pfadverkürzung: alle Knoten des Wegs zeigen danach direkt auf die Wurzel.
  let k = ko;
  while (k !== w) {
    const naechster = eltern.get(k) ?? w;
    eltern.set(k, w);
    k = naechster;
  }
  return w;
}

/**
 * Ordnet jedem Konflikt, der zu einem Cluster gehört, seinen Cluster zu. Konflikte ohne Cluster
 * fehlen in der Rückgabe — die Seite zeigt für sie genau das, was sie bisher zeigte.
 */
export function konfliktCluster(konflikte: readonly Kante[]): Map<string, KonfliktCluster> {
  const eltern = new Map<string, string>();
  for (const k of konflikte) {
    for (const ko of [k.koA, k.koB]) {
      if (!eltern.has(ko)) {
        eltern.set(ko, ko);
      }
    }
    const a = wurzelVon(eltern, k.koA);
    const b = wurzelVon(eltern, k.koB);
    if (a !== b) {
      eltern.set(b, a);
    }
  }

  const gruppen = new Map<string, KonfliktCluster>();
  for (const k of konflikte) {
    const wurzel = wurzelVon(eltern, k.koA);
    const gruppe = gruppen.get(wurzel) ?? { konflikte: [], beitraege: [] };
    gruppe.konflikte.push(k.id);
    for (const ko of [k.koA, k.koB]) {
      if (!gruppe.beitraege.includes(ko)) {
        gruppe.beitraege.push(ko);
      }
    }
    gruppen.set(wurzel, gruppe);
  }

  const zuordnung = new Map<string, KonfliktCluster>();
  for (const gruppe of gruppen.values()) {
    if (gruppe.beitraege.length < CLUSTER_MIN_BEITRAEGE) {
      continue;
    }
    for (const id of gruppe.konflikte) {
      zuordnung.set(id, gruppe);
    }
  }
  return zuordnung;
}

/**
 * Stellt die Konflikte eines Clusters nebeneinander, damit er beim Blättern als Gruppe erscheint:
 * der Cluster steht an der Stelle seines ersten Mitglieds, seine Mitglieder in ihrer bisherigen
 * Reihenfolge. Alles ohne Cluster behält seinen Platz relativ zueinander.
 */
export function clusterReihenfolge<T extends Kante>(konflikte: readonly T[]): T[] {
  const zuordnung = konfliktCluster(konflikte);
  const gezeigt = new Set<KonfliktCluster>();
  const ergebnis: T[] = [];
  for (const k of konflikte) {
    const cluster = zuordnung.get(k.id);
    if (!cluster) {
      ergebnis.push(k);
      continue;
    }
    if (gezeigt.has(cluster)) {
      continue;
    }
    gezeigt.add(cluster);
    const mitglieder = new Set(cluster.konflikte);
    ergebnis.push(...konflikte.filter((m) => mitglieder.has(m.id)));
  }
  return ergebnis;
}
