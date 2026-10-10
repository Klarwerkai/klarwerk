import type { TxContext } from "../../db-tx";
import type { Assignment, Rating } from "./types";

export interface RatingRepo {
  upsert(rating: Rating, tx?: TxContext): Promise<void>; // eine Bewertung je (KO, Nutzer)
  /**
   * Aufnahme gesamt-auditprotokoll (Lauf 3, Runde 2): nimmt eine Bewertung zurück — nur für die
   * Rücknahme im Weg OHNE Transaktion (`ValidationService.rate`), wenn der Entscheidungsbeleg
   * ausfällt. OPTIONAL, damit handgeschriebene Test-Doubles nicht brechen.
   */
  remove?(koId: string, userId: string): Promise<void>;
  listByKo(koId: string): Promise<Rating[]>;
  /**
   * JOB 3043: die Bewertungen MEHRERER Objekte in EINER Abfrage.
   *
   * WARUM NEBEN `listByKo` UND NICHT AN SEINER STELLE. Beide Formen haben einen echten Aufrufer,
   * und keiner ist der billigere Fall des anderen: der Detailabruf kennt genau ein Objekt und
   * bezahlt dafuer genau eine Abfrage (gepinnt in `ko-routes-anzeigestatus.test.ts`, Fall K); der
   * Listen-Lesepfad kennt N Objekte und darf dafuer nicht N Abfragen bezahlen. Ein `listByKo`, das
   * ueber `listByKos` liefe, wuerde die Zusage von Fall K nicht brechen, aber auch nichts sparen —
   * eine Umschreibung ohne Gewinn, dafuer mit einem Feld statt eines Skalars im SQL.
   *
   * EINE LEERE KENNUNGSLISTE MACHT KEINE ABFRAGE und gibt `[]` zurueck. Das ist nicht nur
   * Sparsamkeit: `= ANY($1)` mit leerem Feld ist eine Anweisung, die nie eine Zeile treffen kann.
   */
  listByKos(koIds: readonly string[]): Promise<Rating[]>;
}

export interface AssignmentRepo {
  // Aufnahme gesamt-auditprotokoll (Lauf 3, Runde 2): optionaler TxContext wie bei den Bewertungen.
  create(assignment: Assignment, tx?: TxContext): Promise<void>;
  // Lauf 5 (BEN-R3-B1): mit `tx` liest `find` den Stand IN der Transaktion — die Rückgabe an die
  // verantwortliche Person muss eine dort eben erledigte Zuweisung sehen, nicht den alten Stand.
  find(koId: string, userId: string, tx?: TxContext): Promise<Assignment | undefined>;
  update(assignment: Assignment, tx?: TxContext): Promise<void>;
  /** Runde 3: nur für die Rücknahme ohne Transaktion (s. `RatingRepo.remove`). OPTIONAL. */
  remove?(koId: string, userId: string): Promise<void>;
  all(): Promise<Assignment[]>;
  /**
   * PRÜFSTATUS-ANZEIGE (R-1524): die Zuweisungen GENAU dieser Objekte — gezielt statt Vollscan.
   * Die Prüfstandswege (`pruefstandFuer`, `pruefstaendeFuer`) brauchen nur ihre Objekte; das
   * Prüfbrett braucht weiterhin alle offenen und bleibt bei `all()`. Leere Eingabe → leere Antwort.
   */
  listByKos(koIds: readonly string[]): Promise<Assignment[]>;
  /**
   * ADMIN-09: legt nur an, wenn es für (Objekt, Person) noch KEINE Zuweisung gibt — in einem
   * Schritt. `true` heisst: genau diese Anlage hat stattgefunden. Zwei gleichzeitige Fristläufe
   * können damit nicht beide „neu angelegt" melden und belegen. OPTIONAL für Test-Doubles.
   */
  createIfAbsent?(assignment: Assignment): Promise<boolean>;
  /**
   * ADMIN-09: Compare-and-Set — ersetzt den gespeicherten Stand nur, wenn er noch genau `alt` ist.
   * `true` heisst: dieser Aufrufer hat ersetzt. Grundlage für die Übergabe einer vorhandenen Aufgabe
   * an die Vertretung und für die Übernahme eines Versands. OPTIONAL für Test-Doubles.
   */
  replaceIf?(alt: Assignment, neu: Assignment): Promise<boolean>;
}

/** Ein Vergleichsschlüssel unabhängig von der Feldreihenfolge (Zuweisungen sind flach). */
function stand(a: Assignment): string {
  return JSON.stringify(a, Object.keys(a).sort());
}

export class InMemoryRatingRepo implements RatingRepo {
  private readonly ratings = new Map<string, Rating>();

  upsert(rating: Rating, _tx?: TxContext): Promise<void> {
    this.ratings.set(`${rating.koId}:${rating.userId}`, rating);
    return Promise.resolve();
  }

  remove(koId: string, userId: string): Promise<void> {
    this.ratings.delete(`${koId}:${userId}`);
    return Promise.resolve();
  }

  listByKo(koId: string): Promise<Rating[]> {
    return Promise.resolve([...this.ratings.values()].filter((r) => r.koId === koId));
  }

  listByKos(koIds: readonly string[]): Promise<Rating[]> {
    if (koIds.length === 0) {
      return Promise.resolve([]);
    }
    const gesucht = new Set(koIds);
    return Promise.resolve([...this.ratings.values()].filter((r) => gesucht.has(r.koId)));
  }
}

export class InMemoryAssignmentRepo implements AssignmentRepo {
  private readonly assignments = new Map<string, Assignment>();

  create(assignment: Assignment, _tx?: TxContext): Promise<void> {
    this.assignments.set(`${assignment.koId}:${assignment.userId}`, assignment);
    return Promise.resolve();
  }

  find(koId: string, userId: string, _tx?: TxContext): Promise<Assignment | undefined> {
    return Promise.resolve(this.assignments.get(`${koId}:${userId}`));
  }

  update(assignment: Assignment, _tx?: TxContext): Promise<void> {
    this.assignments.set(`${assignment.koId}:${assignment.userId}`, assignment);
    return Promise.resolve();
  }

  remove(koId: string, userId: string): Promise<void> {
    this.assignments.delete(`${koId}:${userId}`);
    return Promise.resolve();
  }

  all(): Promise<Assignment[]> {
    return Promise.resolve([...this.assignments.values()]);
  }

  listByKos(koIds: readonly string[]): Promise<Assignment[]> {
    const ids = new Set(koIds);
    return Promise.resolve([...this.assignments.values()].filter((a) => ids.has(a.koId)));
  }

  // Prüfen und Setzen ohne `await` dazwischen — im Speicher damit ein unteilbarer Schritt.
  createIfAbsent(assignment: Assignment): Promise<boolean> {
    const schluessel = `${assignment.koId}:${assignment.userId}`;
    if (this.assignments.has(schluessel)) {
      return Promise.resolve(false);
    }
    this.assignments.set(schluessel, assignment);
    return Promise.resolve(true);
  }

  replaceIf(alt: Assignment, neu: Assignment): Promise<boolean> {
    const schluessel = `${alt.koId}:${alt.userId}`;
    const jetzt = this.assignments.get(schluessel);
    if (!jetzt || stand(jetzt) !== stand(alt)) {
      return Promise.resolve(false);
    }
    this.assignments.set(schluessel, neu);
    return Promise.resolve(true);
  }
}
