// D-AISTATE PAKET 4 (bens V5, aistate-fix5, Pedi D-V5=b): GEMEINSAMER fail-closed Versions-Helfer
// für ALLE aktiven Lesepfade beider Befund-Dienste (Konflikt UND Overlap) — unresolved() (Board/
// Badge/Benachrichtigung) und get() (Detail-Routen). Sichtbarkeitsregel:
//  - gebundene KO-Version ≠ aktuelle KO-Version ⇒ NICHT sichtbar; der Befund ist SICHER stale
//    (Grundlage für den Lese-GC),
//  - aktuelle Version nicht ermittelbar (Lookup-Fehler, KO fehlt, keine Version) ⇒ NICHT sichtbar
//    (fail-closed), aber NICHT „sicher stale" — ein transienter Lookup-Fehler darf keinen Befund
//    schließen,
//  - Altbestand ohne Versionsfelder ⇒ konservativ sichtbar (keine Regression).
// Warum Read-seitig: die Schreibseite ist bewusst NICHT gegen ein gleichzeitiges Revisions-
// Interleaving serialisiert (Pedi D-V5=b; volle Schreib-Serialisierung = Post-VIP-Job-Queue-
// Scheibe). Die Ehrlichkeits-Garantie „kein stale Befund wird jemals angezeigt" trägt deshalb
// dieser Filter auf jedem aktiven Lesepfad.

// Versionsgebundene Seiten eines Befunds (Conflict wie OverlapEntry erfüllen diese Form).
export interface VersionBoundFinding {
  koA: string;
  koB: string;
  koAVersion?: number;
  koBVersion?: number;
}

// Versions-Autorität (der App-Root bindet sie an den KO-Store; conflicts kennt knowledge-object
// nicht). Darf synchron oder asynchron urteilen.
export type CurrentVersionLookup = (
  koId: string,
) => number | undefined | Promise<number | undefined>;

// Aufgelöste, gecachte Form für EINEN Lesevorgang (s. cachedCurrentVersions).
export type CurrentVersionResolver = (koId: string) => Promise<number | undefined>;

// Dedupliziert die Versionsabfragen eines Lesevorgangs pro KO und macht den Lookup fail-closed:
// ein Fehler zählt wie „nicht ermittelbar" (undefined) — nie als „aktuell".
export function cachedCurrentVersions(lookup: CurrentVersionLookup): CurrentVersionResolver {
  const cache = new Map<string, Promise<number | undefined>>();
  return (koId) => {
    let cached = cache.get(koId);
    if (!cached) {
      cached = Promise.resolve()
        .then(() => lookup(koId))
        .catch(() => undefined);
      cache.set(koId, cached);
    }
    return cached;
  };
}

export interface VersionBindingVerdict {
  // fail-closed: false sowohl bei sicherer Abweichung als auch bei nicht ermittelbarer Version.
  visible: boolean;
  // NUR gesetzt, wenn eine gebundene Seite SICHER veraltet ist (aktuelle Version bekannt und
  // abweichend) — die Grundlage, auf der der Lese-GC schließen darf.
  stale?: { koId: string; currentVersion: number };
}

export async function isBoundToCurrentVersions(
  entry: VersionBoundFinding,
  current: CurrentVersionResolver,
): Promise<VersionBindingVerdict> {
  let indeterminate = false;
  const sides = [
    { koId: entry.koA, bound: entry.koAVersion },
    { koId: entry.koB, bound: entry.koBVersion },
  ];
  for (const side of sides) {
    if (side.bound === undefined) {
      continue; // unversionierte Seite (Altbestand) → kein Kriterium
    }
    const currentVersion = await current(side.koId);
    if (currentVersion === undefined) {
      indeterminate = true; // fail-closed ausblenden, aber nicht als „sicher stale" werten
      continue;
    }
    if (currentVersion !== side.bound) {
      return { visible: false, stale: { koId: side.koId, currentVersion } };
    }
  }
  return { visible: !indeterminate };
}
