// ================================================================================================
// Aufnahme gesamt-wissen-herkunft (R-0298 / FR-LIF-04) — DER AUTORENNAME IM AUSGABEDOKUMENT.
// ================================================================================================
//
// Output Factory und Bibliotheksexport schrieben in die Herkunftszeile die KONTOKENNUNG des Autors
// („Autor: 3f2a…") — ein erzeugtes Dokument trug damit keinen sichtbaren Autorennamen. Die
// Auflösung entsteht HIER, in der Kompositionswurzel: `output` und `library-analytics` kennen den
// Kontodienst nicht (Modulgrenze) und bekommen nur diese Funktion.
//
// DIESELBE LESEREGEL WIE `GET /api/directory`: jeder Angemeldete darf Kennung und Anzeigename
// eines Kontos lesen, nie den Namen eines gelöschten Kontos (den liest nur die Verwalteransicht aus
// dem Prüfprotokoll). Beide Ausgabewege verlangen eine Anmeldung; mehr als das Verzeichnis gibt
// diese Stelle nicht heraus. Die Zustände entsprechen der Autorenzeile der Oberfläche
// (apps/web/src/lib/koAuthor.ts), in der Sprache der Ausgabedokumente (Deutsch):
//   · Konto vorhanden          → der Anzeigename
//   · Konto gelöscht (belegt)  → „Gelöschtes Konto (ref)"
//   · Kennung nirgends belegt  → „Unbekannte Person (ref)"
//   · Verzeichnis nicht lesbar → „Autorenname nicht abrufbar" — ein Fehler wird nicht zur Aussage
//     über die Person.
// Einen Ladezustand gibt es im Dokument nicht: es entsteht erst, wenn die Auflösung fertig ist.
import type { AuthService } from "../../auth";

/** Kennung → angezeigter Autorentext. Fehlt eine Kennung in der Antwort, gilt die Kennung selbst. */
export type AutorenNamen = (ids: readonly string[]) => Promise<ReadonlyMap<string, string>>;

/** Dasselbe kurze Unterscheidungsmerkmal wie `authorShortRef` in apps/web/src/lib/koAuthor.ts. */
export function autorKurzRef(id: string): string {
  return id
    .replace(/[^0-9a-zA-Z]/g, "")
    .slice(0, 6)
    .toLowerCase();
}

export function autorenNamenAus(
  auth: Pick<AuthService, "listUsers" | "listDeletedUserIds">,
): AutorenNamen {
  return async (ids) => {
    const gesucht = [...new Set(ids.filter((id) => id.trim().length > 0))];
    const namen = new Map<string, string>();
    if (gesucht.length === 0) {
      return namen;
    }
    try {
      const konten = new Map((await auth.listUsers()).map((u) => [u.id, u.name.trim()]));
      const geloescht = new Set(await auth.listDeletedUserIds());
      for (const id of gesucht) {
        const name = konten.get(id);
        if (name) {
          namen.set(id, name);
        } else if (geloescht.has(id)) {
          namen.set(id, `Gelöschtes Konto (${autorKurzRef(id)})`);
        } else {
          namen.set(id, `Unbekannte Person (${autorKurzRef(id)})`);
        }
      }
    } catch {
      for (const id of gesucht) {
        namen.set(id, "Autorenname nicht abrufbar");
      }
    }
    return namen;
  };
}
