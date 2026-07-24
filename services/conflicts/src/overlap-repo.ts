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
  update(entry: OverlapEntry): Promise<void>;
  all(): Promise<OverlapEntry[]>;
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

  update(entry: OverlapEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    return Promise.resolve();
  }

  all(): Promise<OverlapEntry[]> {
    return Promise.resolve([...this.entries.values()]);
  }
}
