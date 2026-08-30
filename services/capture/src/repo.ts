import type { Draft } from "./types";

/**
 * JOB 2697 — DAS ERGEBNIS EINER BEDINGTEN ANLAGE.
 *
 * `angelegt: true` heisst: diese Anfrage hat den Entwurf erzeugt. `angelegt: false` heisst: unter
 * derselben (Kennung, Eigentümer) gab es ihn schon, und `bestehend` ist genau dieser Datensatz —
 * nicht der übergebene. Der Aufrufer entscheidet danach über 200 oder 409; die Ablage entscheidet
 * das nicht, sie berichtet nur.
 */
export type DraftAnlageErgebnis =
  | { angelegt: true; draft: Draft }
  | { angelegt: false; bestehend: Draft };

export interface DraftRepo {
  insert(draft: Draft): Promise<void>;
  /**
   * JOB 2697 — ANLEGEN ODER DEN BESTEHENDEN ZURÜCKGEBEN, UNTEILBAR.
   *
   * WARUM DAS IN DIE ABLAGE GEHÖRT UND NICHT IN DEN DIENST: Ein „erst suchen, dann einfügen" im
   * Dienst verliert jedes Rennen. Zwei gleichzeitige Klicks sehen beide „gibt es noch nicht" und
   * legen beide an — genau die zwei Entwürfe, die dieser Job beseitigt. Prüfen und Setzen müssen
   * deshalb ohne Unterbrechung geschehen: im Speicher ohne `await` dazwischen, in PostgreSQL als
   * `ON CONFLICT` gegen einen echten partiellen Unique-Index. Eine Anwendungsprüfung behauptet
   * Eindeutigkeit, ein Index erzwingt sie.
   *
   * DIE FORM IST ÜBERNOMMEN, NICHT ERFUNDEN: `GapRepo.insertOrIncrement`
   * (`services/ask/src/repo.ts`) ist dieselbe Bauart mit derselben Begründung — eine Methode, die
   * anlegt oder den vorhandenen Datensatz liefert, statt zweier Aufrufe mit einem Fenster dazwischen.
   *
   * VERGLICHEN WIRD (`createOperation.id`, `createOperation.actor`) — beides zusammen. Trägt der
   * Entwurf keinen `createOperation`, wird NICHT verglichen: dann ist es eine gewöhnliche Neuanlage,
   * und der Bestandspfad bleibt unberührt.
   *
   * DER ABDRUCK WIRD HIER NICHT GEPRÜFT. Die Ablage liefert den bestehenden Datensatz; ob sein
   * Abdruck zum neuen passt, entscheidet der Dienst. Zwei Stellen für dieselbe Frage wären der
   * nächste Befund.
   *
   * WARUM OPTIONAL, obwohl beide Betriebsablagen ihn führen — dieselbe Lage und dieselbe Antwort
   * wie bei `GapRepo.insertOrIncrement` (`services/ask/src/repo.ts`): Vier Testdoppel erfüllen
   * `DraftRepo` als Attrappe (`services/capture/src/service.test.ts:277`,
   * `tests/capture/job1171-naechster-schritt-auskunft.test.ts:65`,
   * `tests/capture/job2684-d3-zwei-prozesse.test.ts:189`,
   * `tests/capture/job2696-entwurfsliste-reichweite.test.ts:33`). Eine Pflichtmethode macht sie
   * rot; `service.test.ts` liegt NICHT in der Lease dieses Auftrags, ein Eingriff dort wäre ein
   * Lease-Verstoss. Fachlich kostet es nichts: Im Betrieb gibt es genau zwei Ablagen —
   * `InMemoryDraftRepo` und `PgDraftRepo` —, und beide führen den Weg. Dass die Methode PFLICHT
   * wird, ist als kleiner Folgeschritt in der Rückgabe benannt.
   */
  insertIfOperationAbsent?(draft: Draft): Promise<DraftAnlageErgebnis>;
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

/**
 * JOB 2697 — DER SCHLÜSSEL AUS KENNUNG UND EIGENTÜMER, trennsicher.
 *
 * `JSON.stringify` statt einer Verkettung: `actor + ":" + id` ist nicht trennsicher — ein
 * Eigentümer `a` mit Kennung `b:c` und ein Eigentümer `a:b` mit Kennung `c` ergäben denselben
 * String, und der zweite bekäme den Entwurf des ersten. Das ist keine theoretische Sorge: die
 * Kennung kommt aus dem Rumpf.
 */
function vorgangsSchluessel(op: { id: string; actor: string }): string {
  return JSON.stringify([op.actor, op.id]);
}

export class InMemoryDraftRepo implements DraftRepo {
  private readonly drafts = new Map<string, Draft>();
  /** Spiegel des partiellen Pg-Unique-Index: Vorgang auf Entwurfs-Id. */
  private readonly vorgaenge = new Map<string, string>();

  insert(draft: Draft): Promise<void> {
    this.drafts.set(draft.id, draft);
    if (draft.createOperation) {
      this.vorgaenge.set(vorgangsSchluessel(draft.createOperation), draft.id);
    }
    return Promise.resolve();
  }

  /**
   * JOB 2697 — die Speicher-Hälfte des Vertrags.
   *
   * KEIN `await` zwischen Prüfen und Setzen — das ist die Unteilbarkeit, die den Parallelfall
   * trägt. In PostgreSQL leistet das der partielle Unique-Index. Wird diese Methode je asynchron
   * gemacht, fällt genau diese Zusage; `repo.test.ts` pinnt sie mit zwei Anlagen im selben Tick.
   *
   * Ohne `createOperation` ist es eine gewöhnliche Neuanlage — der Bestandspfad, unverändert.
   */
  insertIfOperationAbsent(draft: Draft): Promise<DraftAnlageErgebnis> {
    if (!draft.createOperation) {
      this.drafts.set(draft.id, draft);
      return Promise.resolve({ angelegt: true, draft });
    }
    const schluessel = vorgangsSchluessel(draft.createOperation);
    const vorhandeneId = this.vorgaenge.get(schluessel);
    if (vorhandeneId !== undefined) {
      const bestehend = this.drafts.get(vorhandeneId);
      if (bestehend) {
        return Promise.resolve({ angelegt: false, bestehend });
      }
      // Der Vorgang zeigt auf einen gelöschten Entwurf. Ehrlich: dann ist nichts mehr da, das
      // wiederverwendet werden könnte — der Eintrag wird aufgeräumt und neu angelegt.
      this.vorgaenge.delete(schluessel);
    }
    this.drafts.set(draft.id, draft);
    this.vorgaenge.set(schluessel, draft.id);
    return Promise.resolve({ angelegt: true, draft });
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
