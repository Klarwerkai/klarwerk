// ================================================================================================
// Aufnahme gesamt-wissen-herkunft (K3) — „GELÖSCHT" IST EINE EIGENE AUSKUNFT, NICHT „UNBEKANNT".
// ================================================================================================
//
// `GET /api/directory` führt seit diesem Auftrag hinter den Konten die Kennungen gelöschter Konten
// als `{ id, geloescht: true }` — ohne Namen (services/auth/src/routes.ts). Die Zuweisungslisten
// dürfen diese Marken nie sehen: wer gelöscht ist, kann keine Aufgabe bekommen. Deshalb trennt der
// eine Abrufweg (`endpoints.directory.list`) sie hier ab und reicht nur die Konten weiter; die
// Kennungen bleiben für die Autorenzeile (`useAuthorName`) abrufbar.
//
// Warum eine Ablage und kein zweites Abfrageergebnis: die Kennungen kommen aus DERSELBEN Antwort
// wie die Namen. Eine zweite Abfrage könnte einen anderen Stand liefern als die erste, und dann
// stünde ein Konto zugleich als „unbekannt" und als „gelöscht" da. Die Ablage wird mit jeder
// Antwort vollständig ersetzt, nie ergänzt — ein wiederhergestelltes Konto verschwindet daraus.

export interface DirectoryAccount {
  id: string;
  name: string;
}

interface DeletedMarker {
  id: string;
  geloescht: true;
}

let geloescht: ReadonlySet<string> = new Set();

function istGeloeschtMarke(eintrag: unknown): eintrag is DeletedMarker {
  return (
    typeof eintrag === "object" &&
    eintrag !== null &&
    (eintrag as { geloescht?: unknown }).geloescht === true &&
    typeof (eintrag as { id?: unknown }).id === "string"
  );
}

/**
 * Trennt die Antwort des Verzeichnisses in Konten und gelöschte Kennungen. Die Konten gehen zurück,
 * die Kennungen in die Ablage. Eine Antwort, die keine Liste ist, wird unverändert durchgereicht —
 * über sie entscheidet weiterhin `useAuthorName` („nicht abrufbar"), nicht diese Stelle.
 */
export function trenneVerzeichnis<T>(antwort: T): T {
  if (!Array.isArray(antwort)) {
    return antwort;
  }
  const konten: DirectoryAccount[] = [];
  const kennungen = new Set<string>();
  for (const eintrag of antwort as unknown[]) {
    if (istGeloeschtMarke(eintrag)) {
      kennungen.add(eintrag.id);
    } else {
      konten.push(eintrag as DirectoryAccount);
    }
  }
  geloescht = kennungen;
  return konten as T;
}

/** Die Kennungen gelöschter Konten aus der jüngsten Verzeichnisantwort. */
export function geloeschteKonten(): ReadonlySet<string> {
  return geloescht;
}
