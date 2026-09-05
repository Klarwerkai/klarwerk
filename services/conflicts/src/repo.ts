import type { TxContext } from "../../db-tx";
import type { Conflict } from "./types";

// D-AISTATE PAKET 4 (bens V5, aistate-fix4/fix6): Versions-Autorität für den VERSIONS-KONDITIONALEN
// Insert — er prüft gegen den bereits committeten KO-Stand, ist aber NICHT gegen ein gleichzeitiges
// Revisions-Interleaving serialisiert (volle Schreib-Serialisierung = Post-VIP). Der Aufrufer
// (App-Root) bindet sie an den KO-Store; sie darf synchron ODER asynchron urteilen — eine synchrone
// Antwort erlaubt der In-Memory-Implementierung Prüfung+Insert ohne await-Spalt. conflicts kennt
// knowledge-object weiterhin nicht (nur dieser Callback-Typ).
export type IsKoVersionCurrent = (koId: string, version: number) => boolean | Promise<boolean>;

export interface ConflictRepo {
  insert(conflict: Conflict): Promise<void>;
  // bens V5-Auflage (aistate-fix5): legt den Datensatz NUR an, wenn BEIDE gebundenen KO-Versionen
  // (koAVersion/koBVersion) zum Prüfzeitpunkt noch den aktuellen KO-Versionen entsprechen
  // (versions-konditional). Bei Abweichung oder fehlender Versionsbindung wird kein Datensatz
  // angelegt (Rückgabe false). EHRLICHE GRENZE (Pedi D-V5=b): der Schritt ist NICHT gegen ein
  // gleichzeitiges Revisions-Interleaving serialisiert — die Sichtbarkeits-Garantie trägt der
  // fail-closed Read-Pfad (version-guard). Die Pg-Implementierung zieht die aktuelle KO-Version
  // im selben Statement aus der Datenbank heran; isCurrent trägt die Autorität für In-Memory.
  insertIfVersionsCurrent(conflict: Conflict, isCurrent: IsKoVersionCurrent): Promise<boolean>;
  // D-AISTATE PAKET 4 (bens fix5-Recheck §4, aistate-fix6): STATUS-CAS für den Lese-GC. Schließt den
  // Befund ATOMAR nur, wenn er JETZT noch offen ist (Compare-and-Set gegen status="offen"), und meldet
  // über den Rückgabewert, ob DIESER Aufruf geschlossen hat. Kein Vollobjekt-Read-Modify-Write mehr:
  //  - kein Lost Update — eine zwischenzeitliche MENSCHLICHE Entscheidung (geloest/eskaliert/
  //    zweitmeinung ⇒ Status ≠ "offen") gewinnt das CAS und der GC überschreibt sie nie,
  //  - genau EIN Gewinner unter nebenläufigen GC-Läufen (nur er auditiert).
  // patch = die zu mergenden Tombstone-Felder (status="geloest", decidedBy=null, resolutionReason=
  // "superseded"). Pg mergt sie ins jsonb; nur dieser Aufruf, der die offene Zeile flippt, gewinnt.
  supersedeIfOpen(id: string, patch: Partial<Conflict>): Promise<boolean>;
  findById(id: string): Promise<Conflict | undefined>;
  all(): Promise<Conflict[]>;
  update(conflict: Conflict): Promise<void>;
  // JOB 3066: der EINE mengenbasierte Schritt des Aufräumwegs mit optionalem, opakem TxContext —
  // Vertrag, Begründung und Grenze wortgleich zu OverlapRepo.closeOpenForKo (dort ausgeschrieben).
  // Er schliesst alle noch nicht gelösten Konflikte GENAU DIESES Beitrags (Terminalzustand ist
  // hier "geloest") in EINER Anweisung und liefert die beendeten Konflikte zurück — Kennungen für
  // die Belege und Anzahl für den Löschbeleg, ohne ein zweites Lesen.
  // GRENZE: NUR diese Methode führt den tx — insert, insertIfVersionsCurrent, supersedeIfOpen,
  // findById, all und update bleiben am Pool.
  closeOpenForKo(koId: string, patch: Partial<Conflict>, tx?: TxContext): Promise<Conflict[]>;
}

export class InMemoryConflictRepo implements ConflictRepo {
  private readonly conflicts = new Map<string, Conflict>();

  insert(conflict: Conflict): Promise<void> {
    this.conflicts.set(conflict.id, conflict);
    return Promise.resolve();
  }

  // Versions-konditionale Anlage. Bei SYNCHRON urteilendem isCurrent liegen Prüfung und Map-Write
  // ohne await-Spalt im selben kritischen Abschnitt; bei ASYNCHRONEN Urteilen bestehen await-
  // Fenster vor dem Map-Write — auch In-Memory ist das also keine Serialisierung gegen eine
  // gleichzeitige Revision (die trägt der fail-closed Read-Pfad, s. version-guard). Fail-closed:
  // ohne Versionsbindung oder bei Abweichung kein Insert.
  async insertIfVersionsCurrent(
    conflict: Conflict,
    isCurrent: IsKoVersionCurrent,
  ): Promise<boolean> {
    if (conflict.koAVersion === undefined || conflict.koBVersion === undefined) {
      return false;
    }
    const ra = isCurrent(conflict.koA, conflict.koAVersion);
    const rb = isCurrent(conflict.koB, conflict.koBVersion);
    // Synchron gelieferte Urteile werden NICHT awaited — dann ist der gesamte Schritt atomar.
    const okA = typeof ra === "boolean" ? ra : await ra;
    const okB = typeof rb === "boolean" ? rb : await rb;
    if (okA !== true || okB !== true) {
      return false;
    }
    this.conflicts.set(conflict.id, conflict);
    return true;
  }

  // Compare-and-Set: der get()+status-Check+set() liegt synchron im selben Makrotask (kein await-
  // Spalt) — zwei nebenläufige GC-Ketten können nicht beide gewinnen, und ein bereits nicht-offener
  // (menschlich entschiedener) Befund wird nie überschrieben. true = DIESER Aufruf hat geschlossen.
  supersedeIfOpen(id: string, patch: Partial<Conflict>): Promise<boolean> {
    const cur = this.conflicts.get(id);
    if (!cur || cur.status !== "offen") {
      return Promise.resolve(false);
    }
    this.conflicts.set(id, { ...cur, ...patch });
    return Promise.resolve(true);
  }

  findById(id: string): Promise<Conflict | undefined> {
    return Promise.resolve(this.conflicts.get(id));
  }

  all(): Promise<Conflict[]> {
    return Promise.resolve([...this.conflicts.values()]);
  }

  update(conflict: Conflict): Promise<void> {
    this.conflicts.set(conflict.id, conflict);
    return Promise.resolve();
  }

  // Fachlich identisch zum Pg-Prädikat, synchron im selben Makrotask (kein await-Spalt zwischen
  // Auswahl und Schreiben). Der tx wird benannt ignoriert: in dieser Ablage gibt es keine
  // Transaktionsgrenze und deshalb auch keine Atomaritätszusage, nur dasselbe Ergebnis.
  closeOpenForKo(koId: string, patch: Partial<Conflict>, _tx?: TxContext): Promise<Conflict[]> {
    const beendet: Conflict[] = [];
    for (const conflict of this.conflicts.values()) {
      if (conflict.status === "geloest" || (conflict.koA !== koId && conflict.koB !== koId)) {
        continue;
      }
      const neu = { ...conflict, ...patch };
      this.conflicts.set(conflict.id, neu);
      beendet.push(neu);
    }
    return Promise.resolve(beendet);
  }
}
