import type { TxContext } from "../../db-tx";
import type { OverlapEntry } from "./overlap-types";
import type { IsKoVersionCurrent } from "./repo";

// Persistenz der Überschneidungs-Einträge (Muster ConflictRepo). Pg-Adapter + Dev-Persist folgen in
// der Verdrahtungs-Stufe; die In-Memory-Variante trägt Logik und Tests.
export interface OverlapRepo {
  insert(entry: OverlapEntry): Promise<void>;
  // bens V5-Auflage (aistate-fix5): versions-konditionaler Insert — Vertrag und EHRLICHE GRENZE
  // wie ConflictRepo.insertIfVersionsCurrent (bei Versionsabweichung kein Datensatz; nicht gegen
  // gleichzeitiges Revisions-Interleaving serialisiert).
  insertIfVersionsCurrent(entry: OverlapEntry, isCurrent: IsKoVersionCurrent): Promise<boolean>;
  // bens fix5-Recheck §4 (aistate-fix6): STATUS-CAS für den Lese-GC — Vertrag wie
  // ConflictRepo.supersedeIfOpen: schließt ATOMAR nur den noch offenen (status="offen") Eintrag,
  // schützt eine zwischenzeitliche menschliche Entscheidung (status="in_bearbeitung"/"geschlossen")
  // und liefert genau EINEN Gewinner unter parallelen GC-Läufen. patch = die zu mergenden
  // Tombstone-Felder (status="geschlossen", resolution superseded/by=null, closedAt).
  supersedeIfOpen(id: string, patch: Partial<OverlapEntry>): Promise<boolean>;
  findById(id: string): Promise<OverlapEntry | undefined>;
  all(): Promise<OverlapEntry[]>;
  update(entry: OverlapEntry): Promise<void>;
  // ============================================================================================
  // JOB 3066 — DER AUFRÄUMWEG DER ENDLÖSCHUNG: EINE MENGENBASIERTE ANWEISUNG MIT OPAKEM tx.
  // ============================================================================================
  //
  // Vertrag des `tx` wörtlich nach dem Muster AuditRepo.append/last (services/audit/src/repo.ts:
  // 18-32): additiv, abwärtskompatibel, opak — das Repo weiss nur, dass es ihn an `pgQueryable`
  // reicht. Zweck: der EINE Aufräumweg der Endlöschung (OverlapService.onKoRemoved, gerufen aus
  // dem transaktionsgebundenen Purge-Haken) schreibt auf DEMSELBEN Pg-Client wie repo.delete und
  // audit.record — sonst kann eine zurückgerollte Löschung eine bereits geschlossene
  // Überschneidung nicht mehr zurücknehmen.
  //
  // WARUM EINE EINZIGE METHODE UND NICHT „LESEN, DANN JE TREFFER SCHREIBEN" (bens Korrekturpflicht
  // 1 zu R3, Vertrag PurgeTxCleanup in knowledge-object/src/service.ts:248-255): der Körper von
  // `withPgTx` hält eine Verbindung aus dem Pool, und n Einzelanweisungen halten die Sperre n-mal
  // so lange — der Vertrag schliesst Schleifen über Einzelobjekte deshalb ausdrücklich aus. R1 las
  // die ganze Tabelle und schrieb je Treffer; R3 las gezielt und schrieb je Treffer; hier ist es
  // EINE Anweisung gegen die Menge, die den Beitrag referenziert.
  //
  // `closeOpenForKo` — SUCHEN UND SCHLIESSEN IN EINEM. Es schliesst alle noch nicht geschlossenen
  // Einträge, die `koId` referenzieren (koA ODER koB), durch Aufmischen von `patch` und LIEFERT
  // die geschlossenen Einträge zurück. Der Rückgabewert ist kein Komfort, sondern Bedingung: der
  // Dienst braucht die Kennungen für seine Belege und die Anzahl für den Löschbeleg, und ein
  // zweites Lesen dafür wäre wieder eine Anweisung mehr in der gehaltenen Verbindung.
  //
  // MUTATIONSFLÄCHE: `closeOpenForKo` ist eine schreibende Repo-Methode und steht deshalb im
  // Dev-Mutationsjournal der Desktop-App (services/app/src/dev-persist.ts, dort bei `overlapRepo`)
  // — ohne diesen Eintrag stünde die Warnung nach einem Dev-Neustart wieder offen über einem
  // Beitrag, den es nicht mehr gibt. Das Replay ist exakt, weil `patch` (inkl. der vom Dienst
  // erzeugten Zeitstempel) vollständig in den Argumenten steht. Beweis:
  // tests/aufraeumen-atomar/geschlossen-bleibt-geschlossen-im-dev-journal.test.ts.
  //
  // GRENZE: NUR diese Methode führt den tx. insert, insertIfVersionsCurrent, supersedeIfOpen,
  // findById, all und update bleiben ausdrücklich am Pool — sie gehören keinem fremden Vorgang an,
  // und ein tx dort wäre eine Atomaritätszusage ohne Aufrufer, der sie einlöst.
  closeOpenForKo(
    koId: string,
    patch: Partial<OverlapEntry>,
    tx?: TxContext,
  ): Promise<OverlapEntry[]>;
}

export class InMemoryOverlapRepo implements OverlapRepo {
  private readonly entries = new Map<string, OverlapEntry>();

  insert(entry: OverlapEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    return Promise.resolve();
  }

  // Versions-konditionale Anlage — Muster und ehrliche Grenze wie InMemoryConflictRepo
  // (synchrones isCurrent: kein await-Spalt; asynchrones: await-Fenster vor dem Map-Write —
  // keine Serialisierung gegen eine gleichzeitige Revision). Fail-closed.
  async insertIfVersionsCurrent(
    entry: OverlapEntry,
    isCurrent: IsKoVersionCurrent,
  ): Promise<boolean> {
    if (entry.koAVersion === undefined || entry.koBVersion === undefined) {
      return false;
    }
    const ra = isCurrent(entry.koA, entry.koAVersion);
    const rb = isCurrent(entry.koB, entry.koBVersion);
    const okA = typeof ra === "boolean" ? ra : await ra;
    const okB = typeof rb === "boolean" ? rb : await rb;
    if (okA !== true || okB !== true) {
      return false;
    }
    this.entries.set(entry.id, entry);
    return true;
  }

  // Compare-and-Set (synchron, kein await-Spalt) — Muster wie InMemoryConflictRepo.supersedeIfOpen:
  // nur der offene Eintrag wird geschlossen, nur ein nebenläufiger Aufruf gewinnt.
  supersedeIfOpen(id: string, patch: Partial<OverlapEntry>): Promise<boolean> {
    const cur = this.entries.get(id);
    if (!cur || cur.status !== "offen") {
      return Promise.resolve(false);
    }
    this.entries.set(id, { ...cur, ...patch });
    return Promise.resolve(true);
  }

  findById(id: string): Promise<OverlapEntry | undefined> {
    return Promise.resolve(this.entries.get(id));
  }

  all(): Promise<OverlapEntry[]> {
    return Promise.resolve([...this.entries.values()]);
  }

  update(entry: OverlapEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    return Promise.resolve();
  }

  // Fachlich identisch zur Pg-Anweisung: dasselbe Prädikat (koA ODER koB, Status ≠ "geschlossen"),
  // dasselbe Aufmischen des Patch, dieselbe Rückgabe der geschlossenen Einträge. Der ganze Schritt
  // liegt synchron im selben Makrotask — kein await-Spalt zwischen Auswahl und Schreiben.
  // Der tx wird benannt ignoriert: in dieser Ablage gibt es keine Transaktionsgrenze, also auch
  // nichts, worauf er sich beziehen könnte. Wer ohne Datenbank fährt, bekommt hier deshalb KEINE
  // Atomaritätszusage, nur dasselbe Ergebnis — wie InMemoryAuditRepo.append.
  closeOpenForKo(
    koId: string,
    patch: Partial<OverlapEntry>,
    _tx?: TxContext,
  ): Promise<OverlapEntry[]> {
    const geschlossen: OverlapEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.status === "geschlossen" || (entry.koA !== koId && entry.koB !== koId)) {
        continue;
      }
      const neu = { ...entry, ...patch };
      this.entries.set(entry.id, neu);
      geschlossen.push(neu);
    }
    return Promise.resolve(geschlossen);
  }
}
