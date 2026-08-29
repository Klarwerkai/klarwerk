import type { Draft } from "./types";

export interface DraftRepo {
  insert(draft: Draft): Promise<void>;
  findById(id: string): Promise<Draft | undefined>;
  update(draft: Draft): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<Draft[]>; // FR-CAP-06: gemeinsamer Pool — alle Entwürfe.
  /**
   * JOB 2696 (Review-Befund R2-33): die Entwürfe EINES Autors, aus der Ablage gefiltert.
   *
   * WARUM DAS NICHT DASSELBE IST WIE `list().filter(…)`: Ein Entwurf trägt bis zu 5 MiB
   * `bodyHtml`. Filtert erst der Aufrufer, hat der ganze Bestand die Datenbank bereits verlassen —
   * und wer nach seinen zwei Entwürfen fragt, bezahlt die schweren Entwürfe aller anderen mit.
   * Genau das war der Befund: *„wird für alle langsam, sobald irgendjemand große Entwürfe hält."*
   *
   * DAS PRÄDIKAT IST DASSELBE, das `visibleDraftsFor` in `capture-routes.ts` anwendet
   * (`draft.originalAuthor === user.id`). Es steht hier nur früher. Wäre es ein anderes, wäre die
   * Vorfilterung eine zweite Sichtbarkeitsregel — und davon ist eine schon eine zu viel.
   */
  listByAuthor(authorId: string): Promise<Draft[]>;
}

export class InMemoryDraftRepo implements DraftRepo {
  private readonly drafts = new Map<string, Draft>();

  insert(draft: Draft): Promise<void> {
    this.drafts.set(draft.id, draft);
    return Promise.resolve();
  }

  findById(id: string): Promise<Draft | undefined> {
    return Promise.resolve(this.drafts.get(id));
  }

  update(draft: Draft): Promise<void> {
    this.drafts.set(draft.id, draft);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.drafts.delete(id);
    return Promise.resolve();
  }

  list(): Promise<Draft[]> {
    return Promise.resolve([...this.drafts.values()]);
  }

  // JOB 2696 (R2-33): im Speicher kostet die Filterung nichts — die Zusage ist trotzdem dieselbe
  // wie in PostgreSQL, damit beide Ablagen dieselbe Menge liefern und ein Test, der hier grün ist,
  // etwas über den Betrieb aussagt.
  listByAuthor(authorId: string): Promise<Draft[]> {
    return Promise.resolve(
      [...this.drafts.values()].filter((draft) => draft.originalAuthor === authorId),
    );
  }
}
