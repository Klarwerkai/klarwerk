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
  type SharePointInhalt,
  type SharePointInhaltsbefund,
  type SharePointInhaltsvorschau,
  sharepointClientFromEnv,
  sharepointInhaltsvorschau,
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
  /**
   * JOB 4232 — WAS DIESE ZEILE BEI EINER ÜBERNAHME BRINGT: Inhalt oder nur Merkmale.
   *
   * Sie ist eine AUSSAGE ÜBER DIE MERKMALE dieses frischen Abrufs (Medientyp und Grösse aus dem
   * DriveItem-Vertrag), nicht über den Text — der ist an dieser Stelle noch nicht gelesen, und ein
   * Abruf je Listenzeile wäre ein Download der ganzen Bibliothek für einen Blick. Was die Vorschau
   * verspricht, prüft die Übernahme noch einmal an den wirklichen Bytes nach
   * (`SharePointSourceAdapter.holeItem`) — und dort, nicht hier, entscheidet sich, was im Bestand
   * landet.
   */
  readonly inhaltstyp: SharePointInhaltsvorschau;
}

export interface SharePointDateiliste {
  readonly dateien: SharePointDatei[];
  /** Es gäbe weitere, ungelesene Einträge. Eine gedeckelte Liste sagt das, statt „alles" zu heissen. */
  readonly truncated: boolean;
}

/**
 * R-0145/R-0190 — DER STAND EINER FORTSETZBAREN ORDNER-INVENTUR.
 *
 * Er hält genau das fest, was nötig ist, um später an derselben Stelle weiterzulesen: die Ordner,
 * deren Liste noch (ganz oder teilweise) zu lesen ist, den Graph-Cursor der laufenden Ordnerliste,
 * die schon gesehenen Datei- und Ordnerkennungen und die gefundenen, noch keinem Los zugeteilten
 * Dateien. Es gibt KEINE Gesamtkante: ein Aufruf liest höchstens eine begrenzte Zahl Seiten, aber
 * der Rest geht nicht verloren — er bleibt im Stand und wird beim nächsten Aufruf gelesen.
 *
 * Die Kennungen darin sind Graph-Kennungen der Quelle. Sie dienen nur als Lesezeiger und Dedup-
 * Schlüssel dieser Inventur, nicht als Identität im Produkt.
 */
export interface SharePointInventur {
  /** Noch zu lesende Ordner; der erste ist der gerade gelesene (`undefined` = Wurzel). */
  readonly warteschlange: { readonly id: string | undefined }[];
  /** Graph-Cursor der Folgeseite des ersten Ordners der Warteschlange — `null`: erste Seite. */
  weiter: string | null;
  readonly besuchteOrdner: Set<string>;
  readonly gesehen: Set<string>;
  /** Gefundene Dateien in Lieferfolge, die noch keinem Los zugeteilt sind. */
  readonly puffer: string[];
  /** Bisher gefundene Dateien bzw. Unterordner (alle Ebenen). */
  dateien: number;
  unterordner: number;
}

/** Eine neue Inventur über den gewählten Ordner (`undefined` = Wurzel der Bibliothek). */
export function neueInventur(ordnerId?: string): SharePointInventur {
  return {
    warteschlange: [{ id: ordnerId }],
    weiter: null,
    besuchteOrdner: new Set(ordnerId ? [ordnerId] : []),
    gesehen: new Set(),
    puffer: [],
    dateien: 0,
    unterordner: 0,
  };
}

/** Fertig heisst: jede Seite jedes Ordners ist gelesen. Über den Puffer sagt das nichts. */
export function inventurFertig(inventur: SharePointInventur): boolean {
  return inventur.warteschlange.length === 0;
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
   * ADMIN-02 — DER VERBINDUNGSTEST: GENAU EINE Listenseite des Wurzelordners, nur Merkmale.
   *
   * Er beantwortet „nimmt die Gegenstelle den hinterlegten Zugang an und liefert sie diese
   * Bibliothek aus?" mit dem kleinsten Abruf, der das belegt. Kein Inhalt, kein Folgecursor, kein
   * Schreibeffekt — die Fehlerlagen reisen unverändert als `SharePointRequestError` nach oben.
   * Zurück kommt nur die Zahl der gelesenen Einträge, keine Namen.
   */
  async pruefeVerbindung(): Promise<{ eintraege: number }> {
    const { items } = await this.client.listeOrdnerSeite(undefined, null);
    return { eintraege: items.length };
  }

  /**
   * R-0145/R-0190 — DIE ORDNER-INVENTUR EIN STÜCK WEITERFÜHREN.
   *
   * Liest Listenseiten — dem Graph-Cursor folgend, Unterordner auf allen Ebenen in die Warteschlange
   * —, bis wenigstens `bisDateien` Dateien im Puffer liegen, die Inventur fertig ist oder
   * `maxSeiten` Seiten in DIESEM Aufruf gelesen sind. Die letzte Kante begrenzt nur die Arbeit
   * eines Aufrufs; was danach noch zu lesen ist, bleibt im Stand und wird beim nächsten gelesen.
   *
   * Ordner werden nie Dateien. Jede Datei kommt höchstens einmal in den Puffer, jeder Ordner wird
   * höchstens einmal gelesen. Der Stand wird erst NACH einer erfolgreich gelesenen Seite fortgeschrieben:
   * scheitert ein Abruf, liest der nächste Aufruf dieselbe Seite noch einmal.
   */
  async setzeInventurFort(
    inventur: SharePointInventur,
    bisDateien: number,
    maxSeiten: number,
  ): Promise<void> {
    let seiten = 0;
    while (inventur.puffer.length < bisDateien && seiten < maxSeiten && !inventurFertig(inventur)) {
      const ordner = inventur.warteschlange[0];
      const seite = await this.client.listeOrdnerSeite(ordner?.id, inventur.weiter);
      seiten += 1;
      for (const item of seite.items) {
        const datei = zuDatei(item);
        if (datei) {
          if (!inventur.gesehen.has(datei.id)) {
            inventur.gesehen.add(datei.id);
            inventur.puffer.push(datei.id);
            inventur.dateien += 1;
          }
          continue;
        }
        const id = item.id?.trim();
        if (item.folder !== undefined && id && !inventur.besuchteOrdner.has(id)) {
          inventur.besuchteOrdner.add(id);
          inventur.unterordner += 1;
          inventur.warteschlange.push({ id });
        }
      }
      inventur.weiter = seite.weiter;
      if (seite.weiter === null) {
        inventur.warteschlange.shift();
      }
    }
  }

  /**
   * EINE Datei als normalisiertes `ImportItem` — UND der Befund über ihren Inhalt.
   *
   * `undefined` heisst: Graph hat geantwortet, aber der Eintrag ist keine importierbare Datei
   * (Ordner, oder ohne Kennung/Namen). Dass die Datei GAR NICHT MEHR DA ist, ist etwas anderes und
   * kommt als Fehlerlage `nicht-gefunden` aus dem Client — die zwei Fälle werden hier bewusst nicht
   * zu einem `undefined` verschmolzen, weil der Mensch zwei verschiedene Sätze dafür braucht.
   *
   * JOB 4232 — WARUM BEFUND UND ITEM ZUSAMMEN HERAUSKOMMEN: Der Aufrufer muss unterscheiden können
   * zwischen „hier steht Text, weil er gelesen wurde" und „hier steht keiner, und zwar aus DIESEM
   * Grund". Läge nur das `ImportItem` vor, bliebe ihm nur der Rückschluss aus einem FEHLENDEN Feld —
   * und ein fehlendes Feld kann leer, zu gross, unlesbar oder schlicht der falsche Typ heissen. Vier
   * verschiedene Sätze für den Menschen aus einem `undefined` zu raten, ist genau die Sorte
   * Scheingenauigkeit, die dieser Auftrag beseitigt.
   *
   * DER INHALTSABRUF LÄUFT NUR, WENN ER ETWAS BRINGEN KANN: Die vorautorisierte Downloadadresse
   * wird nur für Dateien angefordert, deren Merkmale `text` versprechen — für alles andere steht der
   * Befund schon fest, und es geht kein zweiter Abruf hinaus.
   */
  async holeItem(externalId: string): Promise<SharePointUebernahmeEintrag | undefined> {
    const gemessen = await this.holeMitBefund(externalId);
    if (!gemessen) {
      return undefined;
    }
    const { roh, inhalt } = gemessen;
    const item = mapDriveItemToImportItem(roh, { driveId: this.client.driveId, inhalt });
    return item ? { item, inhalt } : undefined;
  }

  /**
   * JOB 4232 RUNDE 2 — DIE GEMESSENE VORSCHAU (bens Korrekturpflicht 2).
   *
   * DER BEFUND, GEGEN DEN DIESE METHODE STEHT: Bis Runde 1 sagte die Fläche „Inhalt kommt mit",
   * sobald Medientyp und Grösse passten. Ben hat vorgeführt, dass das eine Zusage ohne Deckung ist —
   * er liess den Download mit 403 antworten, und die Vorschau behauptete weiter Inhalt, ohne je
   * einen geholt zu haben. Merkmale sind kein Nachweis gelesenen Inhalts.
   *
   * DIESE METHODE HOLT IHN WIRKLICH — für genau die Dateien, die ein Mensch ausgewählt hat, und
   * BEVOR er die Übernahme auslöst. Was sie zurückgibt, ist deshalb keine Ankündigung mehr, sondern
   * ein Messwert.
   *
   * SIE SCHREIBT NICHTS. Kein Kandidat, kein Objekt, kein Lauf — sie ist derselbe lesende Weg wie
   * die Dateiliste, nur eine Ebene tiefer.
   *
   * WAS SIE NICHT TUT: den gelesenen TEXT herausgeben. Nach aussen reist der Befund, nicht der
   * Inhalt — die Vorschau beantwortet „kommt Text?" und nicht „welcher?"; den Text bekommt erst die
   * Übernahme, und zwar in den Bestand.
   */
  async pruefeInhalte(externalIds: readonly string[]): Promise<SharePointInhaltsprobe[]> {
    const proben: SharePointInhaltsprobe[] = [];
    for (const id of externalIds) {
      const gemessen = await this.holeMitBefund(id);
      // `undefined` heisst „kein importierbarer Eintrag" (Ordner, ohne Kennung). Dazu gibt es keinen
      // Inhaltsbefund, und es wird auch keiner erfunden — die Kennung fehlt dann im Ergebnis.
      if (gemessen) {
        proben.push({ id, befund: gemessen.inhalt.art });
      }
    }
    return proben;
  }

  /**
   * Merkmale UND Inhaltsbefund EINER Datei — der eine Weg, den Übernahme und Vorschau teilen.
   *
   * KEIN ZWEITER ABRUF AUF VERDACHT: Die Inhaltsadresse wird nur angefordert, wenn die Merkmale
   * überhaupt Text versprechen; ist der Typ ein anderer, steht der Befund fest und es geht kein
   * Inhaltsabruf hinaus.
   */
  private async holeMitBefund(
    externalId: string,
  ): Promise<{ roh: GraphDriveItem; inhalt: SharePointInhalt } | undefined> {
    const roh = await this.client.holeDatei(externalId, true);
    if (!istDatei(roh)) {
      return undefined;
    }
    const inhalt: SharePointInhalt =
      sharepointInhaltsvorschau(roh) === "nur-merkmale"
        ? { art: "nur-merkmale" }
        : await this.client.holeTextInhalt(roh);
    return { roh, inhalt };
  }
}

/**
 * Das Ergebnis EINER gemessenen Inhaltsprobe: die Kennung und was wirklich dahinter steckt. Kein
 * Text — s. `pruefeInhalte`.
 */
export interface SharePointInhaltsprobe {
  readonly id: string;
  readonly befund: SharePointInhaltsbefund;
}

/**
 * Was bei der Übernahme EINER Datei herauskommt: der normalisierte Eintrag und der Befund über
 * seinen Inhalt. Die beiden gehören zusammen — `item.bodyHtml` ist genau dann gesetzt, wenn
 * `inhalt.art === "text"` ist, und das ist keine Absprache, sondern der Mapper (`mapper.ts`).
 */
export interface SharePointUebernahmeEintrag {
  readonly item: ImportItem;
  readonly inhalt: SharePointInhalt;
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
    // JOB 4232: die Auskunft VOR der Annahme — gemessen am Medientyp und der Grösse aus der Quelle.
    inhaltstyp: sharepointInhaltsvorschau(item),
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
