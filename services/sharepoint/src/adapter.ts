// ================================================================================================
// JOB 4086 — SHAREPOINT/ONEDRIVE ALS ADAPTER #2 DES QUELL-AGNOSTISCHEN IMPORT-VERTRAGS.
// ================================================================================================
//
// `build-app.ts` hat den Platz seit SCRUM-510 R2b ausdrücklich freigehalten: „Ein Adapter #2 OR-t
// später sein eigenes Flag ein — ohne dass der Import-Kern Confluence-Begriffe kennt." Dieser
// Adapter besetzt ihn. Er baut KEINEN zweiten Import-Kern: was er liefert, sind `ImportItem`s,
// und alles danach (Kandidat, Prüfung, Wissensobjekt, Herkunfts-Anker) ist der vorhandene Weg.
//
// ER KENNT DEN SCHALTER NICHT, und das ist eine Entscheidung: Über die ANWESENHEIT der Fläche
// entscheidet `schalterAn("sharepointImport")` an der einen Registrierungsstelle in `build-app.ts`
// — der Schalter steht im Registry und nirgends sonst (AUFTRAG-mega46 Block F). Läse dieses Modul
// ihn selbst, gäbe es zwei Leser derselben Regel; das ist genau die Bauform, die mega46 beseitigt
// hat. Was dieses Modul entscheidet, ist etwas anderes: ob mit den hinterlegten Zugangsdaten
// überhaupt ein Client zustande kommt.

import type { ImportItem } from "../../library-analytics";
import {
  type GraphDriveItem,
  type SharePointGraphClient,
  sharepointClientFromEnv,
} from "./graph-client";
import { istDatei, mapDriveItemToImportItem } from "./mapper";

/** Ein Eintrag der Auswahlliste — genug, um ihn zu erkennen und zu wählen, mehr nicht. */
export interface SharePointDatei {
  /** Die Kennung im Quellsystem (DriveItem-Id) — sie wird später der Herkunfts-Anker. */
  readonly id: string;
  readonly name: string;
  /** Die Originaladresse. `null`, wenn die Quelle keine nennt — nie eine geratene. */
  readonly url: string | null;
  /** ISO-Zeitstempel der letzten Änderung, oder `null`. */
  readonly geaendertAm: string | null;
  /** Grösse in Bytes, oder `null` — „unbekannt" ist von „0" unterscheidbar. */
  readonly groesseBytes: number | null;
}

export interface SharePointDateiliste {
  readonly dateien: SharePointDatei[];
  /** Es gäbe weitere, ungelesene Einträge. Eine gedeckelte Liste sagt das, statt „alles" zu heissen. */
  readonly truncated: boolean;
}

export class SharePointSourceAdapter {
  readonly source = "SharePoint";

  constructor(private readonly client: SharePointGraphClient) {}

  /** Die Bibliothek, auf die dieser Adapter gescoped ist (nicht geheim, für die Provenienz). */
  get driveId(): string {
    return this.client.driveId;
  }

  /**
   * Die berechtigten DATEIEN einer Bibliothek oder eines Ordners.
   *
   * Ordner werden AUSSORTIERT und nicht als nicht-importierbare Zeilen mitgeschleppt: Diese Liste
   * ist die Auswahl eines Imports, und ein Eintrag darin, den man nicht wählen kann, wäre ein
   * Angebot ohne Deckung. Dass es Ordner GIBT, verschweigt das nicht — die Bibliothek bleibt
   * dieselbe, nur diese Liste beantwortet genau eine Frage: was kann ich hier importieren?
   */
  async listeDateien(ordnerId?: string): Promise<SharePointDateiliste> {
    const { items, truncated } = await this.client.listeDateien(ordnerId);
    const dateien: SharePointDatei[] = [];
    for (const item of items) {
      const eintrag = zuDatei(item);
      if (eintrag) {
        dateien.push(eintrag);
      }
    }
    return { dateien, truncated };
  }

  /**
   * EINE Datei als normalisiertes `ImportItem`.
   *
   * `undefined` heisst: Graph hat geantwortet, aber der Eintrag ist keine importierbare Datei
   * (Ordner, oder ohne Kennung/Namen). Dass die Datei GAR NICHT MEHR DA ist, ist etwas anderes und
   * kommt als Fehlerlage `nicht-gefunden` aus dem Client — die zwei Fälle werden hier bewusst nicht
   * zu einem `undefined` verschmolzen, weil der Mensch zwei verschiedene Sätze dafür braucht.
   */
  async holeItem(externalId: string): Promise<ImportItem | undefined> {
    const item = await this.client.holeDatei(externalId);
    return mapDriveItemToImportItem(item, { driveId: this.client.driveId });
  }
}

function zuDatei(item: GraphDriveItem): SharePointDatei | null {
  const id = item.id?.trim();
  const name = item.name?.trim();
  if (!id || !name || !istDatei(item)) {
    return null;
  }
  const url = item.webUrl?.trim();
  const geaendert = item.lastModifiedDateTime?.trim();
  return {
    id,
    name,
    url: url && url.length > 0 ? url : null,
    geaendertAm: geaendert && geaendert.length > 0 ? geaendert : null,
    // `null` ist „unbekannt", `0` ist „leere Datei" — der Draht unterscheidet beides.
    groesseBytes: typeof item.size === "number" && Number.isFinite(item.size) ? item.size : null,
  };
}

/**
 * Baut den Adapter aus der Umgebung — oder gar nicht.
 *
 * `undefined` heisst „nicht eingerichtet": eine Variable fehlt oder die Basisadresse ist nicht
 * https. Der Aufrufer macht daraus den EINEN Fehlercode, den auch der Confluence-Weg für diesen
 * Zustand nennt (`IMPORT_UNAVAILABLE`) — keine zweite Vokabel für denselben Sachverhalt.
 */
export function createSharePointAdapterFromEnv(
  env: Record<string, string | undefined> = process.env,
): SharePointSourceAdapter | undefined {
  const client = sharepointClientFromEnv(env);
  return client ? new SharePointSourceAdapter(client) : undefined;
}

// ================================================================================================
// HIER STEHT BEWUSST KEIN `adapterFromConfig`.
// ================================================================================================
//
// Das Confluence-Modul führt einen solchen Einstieg (`adapter.ts`, „Test-/Wiederverwendungs-
// Einstieg mit injizierbarem fetchFn"), und er hat dort bis heute KEINEN Aufrufer ausserhalb der
// Tests — er steht im ALTBESTAND des Aufrufer-Wächters (`tests/capture/aufrufer-waechter.test.ts`),
// also in der Liste, die schrumpfen und nicht wachsen soll.
//
// Dieses Modul macht den Fehler nicht zum zweiten Mal: Ein Test INNERHALB des Moduls kann
// `SharePointSourceAdapter` und `SharePointGraphClient` direkt zusammensetzen — sie sind beide
// modul-intern erreichbar. Eine zusätzliche exportierte Fabrik dafür wäre eine Oberfläche, die nur
// Tests benutzen, und genau das ist die Bauform, gegen die der Wächter steht („Ein Test ist kein
// Aufrufer", `tools/modalgrenze.ts:8`).
