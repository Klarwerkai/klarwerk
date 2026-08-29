import type { Draft } from "./types";

export interface DraftRepo {
  insert(draft: Draft): Promise<void>;
  findById(id: string): Promise<Draft | undefined>;
  update(draft: Draft): Promise<void>;
  /**
   * JOB 2684 D3 (R2-17, BEN: „repository- oder transaktionsatomarer Compare-and-Swap"): schreibt
   * `draft` NUR, wenn der gespeicherte `updatedAt` noch `erwarteterStand` ist — die Bedingung liegt
   * in der Ablage (Pg: im `WHERE` derselben Abfrage; Speicher: synchron, ohne `await` zwischen
   * Prüfen und Setzen), nicht in einer Sperre im Prozess. Deshalb trägt sie auch bei zwei
   * Serverprozessen gegen dieselbe Datenbank. `false` = nicht geschrieben, weil der Stand ein
   * anderer war (oder der Entwurf fehlt); der Aufrufer liest dann neu und entscheidet.
   */
  updateWennStand(draft: Draft, erwarteterStand: string): Promise<boolean>;
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

  // JOB 2684 D3: Spiegel der Pg-Bedingung `data->>'updatedAt' = $3` — SYNCHRON geprüft und gesetzt
  // (kein await dazwischen), damit zwei Dienst-Instanzen an dieser Ablage genau das erleben, was
  // sie an Postgres erleben würden: nur eine trifft den erwarteten Stand.
  updateWennStand(draft: Draft, erwarteterStand: string): Promise<boolean> {
    const gespeichert = this.drafts.get(draft.id);
    if (!gespeichert || gespeichert.updatedAt !== erwarteterStand) {
      return Promise.resolve(false);
    }
    this.drafts.set(draft.id, draft);
    return Promise.resolve(true);
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
