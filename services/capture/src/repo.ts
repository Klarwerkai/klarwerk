import type { Draft, EntwurfImPapierkorb } from "./types";

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
  /**
   * JOB 3668 — BLENDET DEN PAPIERKORB AUS, und das ist die tragende Zeile des ganzen Auftrags.
   *
   * Jeder Einzelzugriff auf einen Entwurf läuft durch hier: `CaptureService.getDraft`, `require`
   * (und damit Fortsetzen, Speichern, Löschen, Einreichen), `requireVisibleDraft` in den Routen,
   * der nächste Schritt, der Wissenscheck, der Reasoner. Einen getrashten Entwurf hier NICHT
   * zurückzugeben heisst deshalb: er ist für ALLE gewöhnlichen Wege nicht vorhanden — ohne dass
   * eine einzige dieser Stellen etwas davon wissen muss. Genau diese Zusage gibt SCRUM-422 dem
   * Wissensobjekt (`knowledge-object/src/service.ts:4202`), nur liegt sie dort im Dienst.
   *
   * DAS IST DIE ANTWORT AUF §4.5 („der Papierkorb darf kein Schlupfloch werden"): der Papierkorb
   * fügt keinem bestehenden Weg eine Sichtbarkeit hinzu, er nimmt eine weg.
   */
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
  /**
   * JOB 3668 — LÖSCHEN HEISST AB HIER: IN DEN PAPIERKORB. Die harte Löschung ist `purge`.
   *
   * DER BEFUND, den diese eine Zeile beseitigt (Pedi, 11.09.2026): *„Ich habe eben alle Entwürfe
   * gelöscht. Nicht einer befindet sich im Papierkorb."* Er stimmte — `PgDraftRepo.delete` führte
   * `DELETE FROM drafts WHERE id=$1` aus, und danach gab es nichts mehr zurückzuholen.
   *
   * `geloeschtVon` UND `zeitpunkt` SIND OPTIONAL, und beides ist eine Aussage über Ehrlichkeit,
   * nicht über Bequemlichkeit: Der Dienst reicht beides durch (`CaptureService.deleteDraft` nimmt
   * den Handelnden von der Route und den Zeitpunkt von seiner Uhr — derselben, die auch
   * `createdAt`/`updatedAt` stellt). Wo aber niemand einen Handelnden kennt, steht NICHTS statt
   * einer geratenen Person. Ohne Zeitpunkt nimmt die Ablage die Uhr, damit kein Eintrag ohne
   * Löschzeit entstehen kann.
   *
   * IDEMPOTENT: Ein zweites `delete` auf einen bereits getrashten Entwurf ändert nichts — es
   * überschreibt insbesondere NICHT den ursprünglichen Löschzeitpunkt, sonst liesse sich die Frist
   * eines Papierkorbeintrags durch Wiederholen beliebig verlängern. Und es löscht auch dann nicht
   * hart: der zweite Griff heisst `purge` und ist genau deshalb ein eigener Name.
   */
  delete(id: string, geloeschtVon?: string, zeitpunkt?: string): Promise<void>;
  /**
   * JOB 3668 — DIE PAPIERKORB-SICHT: NUR das Gelöschte, jüngste Löschung zuerst.
   *
   * Dieselbe Reihenfolge wie `KoService.trashed` (`knowledge-object/src/service.ts:3487`) und
   * dieselbe Begründung für die Eingrenzung wie bei `listByAuthor` (JOB 2696): wer nach seinen
   * zwei gelöschten Entwürfen fragt, soll nicht die bis zu 5 MiB schweren Rümpfe aller anderen
   * bezahlen — und vor allem soll ein FREMDER Entwurf gar nicht erst geladen werden. Ohne
   * `fuerAutor` ist es die Admin-Sicht, wie überall sonst in diesem Vertrag.
   *
   * DAS PRÄDIKAT IST DASSELBE wie in `listByAuthor` (`draft.originalAuthor === autor`). Ein
   * zweites wäre eine zweite Auffassung davon, wem ein Entwurf gehört — und davon ist eine schon
   * eine zu viel.
   */
  listTrashed(fuerAutor?: string): Promise<EntwurfImPapierkorb[]>;
  /** JOB 3668: der EINE gelöschte Entwurf. Liefert einen LEBENDEN Entwurf ausdrücklich nicht. */
  findTrashed(id: string): Promise<EntwurfImPapierkorb | undefined>;
  /**
   * JOB 3668 — ZURÜCK AUS DEM PAPIERKORB, vollständig.
   *
   * Es wird nichts neu zusammengesetzt: die zwei Papierkorb-Felder fallen weg, der Rest des
   * Dokuments bleibt Zeichen für Zeichen stehen. Deshalb kommen Titel, Rumpf, Quellen, Zeiten und
   * Vertraulichkeit zurück und nicht eine Hülle. `undefined` heisst: lag nicht im Papierkorb.
   */
  restore(id: string): Promise<Draft | undefined>;
  /**
   * JOB 3668 — DIE HARTE LÖSCHUNG. GENAU EINE, und das ist der Punkt.
   *
   * Sie ist das, was `delete` bis zu diesem Auftrag war: die Zeile ist danach fort. Zwei Wege
   * führen legitim hierher, und beide laufen über den Dienst:
   *   · `CaptureService.purgeTrashedDraft` — der zweite, ausdrückliche Griff aus dem Papierkorb.
   *   · `CaptureService.entwurfVerbraucht` — ein Promote hat den Entwurf zum Wissensobjekt
   *     gemacht. Er ist VERBRAUCHT, nicht gelöscht; läge er im Papierkorb, liesse er sich
   *     wiederherstellen und stünde als Dublette neben dem Objekt, das aus ihm geworden ist.
   *
   * RUNDE 2 — DIE BEDINGUNG IST HIERHER GEWANDERT, UND DAS IST EINE KORREKTUR AN RUNDE 1.
   *
   * Sie stand ALLEIN im Dienst: erst `findTrashed`, dann `purge`. Zwischen den beiden `await`
   * liegt ein Fenster, und Codex hat gemessen, was hineinpasst —
   * `Promise.allSettled([purgeTrashedDraft(id), restoreDraft(id)])` endete mit ZWEI erfüllten
   * Zusagen und einem Bestand von 0: Der Mensch hatte seinen Entwurf gerade zurückgeholt, bekam
   * gesagt, es sei gelungen, und die zweite Anfrage entfernte ihn hart. Derselbe Riss zeigte sich
   * im echten PostgreSQL-Lauf vom 12.09. an `P3`: `purge` auf einen LEBENDEN Entwurf gab `true` —
   * die Ablage entfernte, was der Dienst zu schützen behauptete.
   *
   * DESHALB IST DER SICHERE FALL JETZT DER NORMALFALL: `purge(id)` entfernt NUR, was im Papierkorb
   * liegt, und gibt für einen lebenden Entwurf `false`. Geprüft und gelöscht wird unteilbar — eine
   * `DELETE`-Anweisung mit ihrer Bedingung, im Speicher Prüfen und Löschen ohne `await` dazwischen.
   * Ein Aufrufer, der die Unterscheidung vergisst, bekommt damit den vorsichtigen Ausgang und
   * nicht den, der Daten verliert.
   *
   * `auchLebende` — UND HIER STEHT DER VERBRAUCH, ausdrücklich und nur hier. Ein Entwurf, aus dem
   * gerade ein Wissensobjekt geworden ist, hat den Papierkorb nie gesehen und muss trotzdem
   * entfernt werden (`CaptureService.entwurfVerbraucht`). Den Verbrauch an den Papierkorbstatus zu
   * binden wäre falsch: er müsste sonst erst „gelöscht" werden, um verschwinden zu dürfen. Wer
   * dieses Wort setzt, sagt damit „ich weiss, dass hier ein lebender Datensatz fällt".
   *
   * ES BLEIBT EINE MECHANIK, kein zweiter harter Weg: DIESELBE Methode, DIESELBE Anweisung, ein
   * Prädikat mehr oder weniger — nicht `purge` und daneben ein `purgeTrashed`. Das ist die Zusage
   * aus SCRUM-523 P.3 („exakt EINE Löschmechanik, kein Bypass", `ko-routes.ts:1747`), und sie ist
   * schärfer als beim Vorbild: `KoService.purgeTrashed` (`knowledge-object/src/service.ts:3531`)
   * prüft bis heute VOR dem Löschen und trägt dasselbe Fenster. Die Abweichung ist Absicht und
   * steht in der Rückgabe.
   *
   * `false` heisst ehrlich: es lag nicht (mehr) im Papierkorb — oder es war überhaupt nichts mehr
   * da. Der Aufrufer erfindet dann keinen Vollzug.
   */
  purge(id: string, auchLebende?: boolean): Promise<boolean>;
  /**
   * FR-CAP-06: gemeinsamer Pool — alle Entwürfe.
   *
   * JOB 3668 — UND DAS HEISST JETZT WÖRTLICH ALLE, EINSCHLIESSLICH PAPIERKORB. Das ist die eine
   * bewusste Abweichung vom Wissensobjekt in diesem Auftrag, und sie ist notwendig, nicht bequem:
   * `objectReferences.drafts` (`services/app/src/build-app.ts:756`) und die Anhangquellen (`:2339`)
   * beantworten über diese Liste die Frage „wird dieses gesicherte Original noch gebraucht?".
   * Verschwände ein getrashter Entwurf daraus, dürfte sein Original entfernt werden — und die
   * Wiederherstellung lieferte einen Entwurf mit fehlendem Anker, dessen Rumpf `withAnchorCheck`
   * ausdünnt. Das wäre genau die Hülle, die dieser Auftrag in §4.3 verbietet. Das Wissensobjekt
   * hält seinen Anker aus demselben Grund (`knowledge-object/src/repo-pg.ts:161`).
   *
   * WER EINEM MENSCHEN EINE LISTE ZEIGT, TRIMMT SELBST. Es gibt dafür genau eine Stelle:
   * `GET /api/drafts` in `capture-routes.ts` — dieselbe Stelle, die schon entscheidet, wer welchen
   * Entwurf sieht. Jeder EINZEL-Zugriff ist davon unberührt: `findById` blendet den Papierkorb aus,
   * und damit sehen Dienst, Fortsetzen, Speichern, Einreichen und jede andere Route ihn nicht.
   */
  list(): Promise<Draft[]>;
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

/**
 * JOB 3668 — DAS PAPIERKORB-PRÄDIKAT DER SPEICHERABLAGE, an EINER Stelle.
 *
 * Es fragt nach dem VORHANDENSEIN des Schlüssels, nicht nach seinem Wahrheitswert — zeichengleich
 * das `data ? 'deletedAt'` von PostgreSQL. Ein `Boolean(draft.deletedAt)` wäre etwas anderes: ein
 * leerer Löschzeitpunkt gälte dann als lebendig, in Postgres aber nicht. Genau solche stillen
 * Unterschiede zwischen den zwei Ablagen sind es, die Tests grün und den Betrieb falsch machen.
 */
function istGetrasht(draft: Draft): draft is EntwurfImPapierkorb {
  return "deletedAt" in draft;
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
    const draft = this.drafts.get(id);
    return Promise.resolve(draft && istGetrasht(draft) ? undefined : draft);
  }

  update(draft: Draft): Promise<void> {
    // JOB 3668: KEINE AUFERSTEHUNG ÜBER DEN SCHREIBWEG. Der übergebene Datensatz trägt die
    // Papierkorb-Felder nicht (er stammt aus `findById`, das getrashte gar nicht herausgibt) —
    // ihn blind zu setzen hiesse, `deletedAt` zu überschreiben und den Entwurf still zurück ins
    // Leben zu holen. Spiegel der Pg-Bedingung `AND NOT (data ? 'deletedAt')`.
    const gespeichert = this.drafts.get(draft.id);
    if (gespeichert && istGetrasht(gespeichert)) {
      return Promise.resolve();
    }
    this.drafts.set(draft.id, draft);
    return Promise.resolve();
  }

  // JOB 2684 D3: Spiegel der Pg-Bedingung `data->>'updatedAt' = $3` — SYNCHRON geprüft und gesetzt
  // (kein await dazwischen), damit zwei Dienst-Instanzen an dieser Ablage genau das erleben, was
  // sie an Postgres erleben würden: nur eine trifft den erwarteten Stand.
  updateWennStand(draft: Draft, erwarteterStand: string): Promise<boolean> {
    const gespeichert = this.drafts.get(draft.id);
    // JOB 3668: ein getrashter Entwurf ist kein gültiger Stand — dieselbe Bedingung, die Postgres
    // seit diesem Auftrag im `WHERE` derselben Anweisung trägt.
    if (!gespeichert || istGetrasht(gespeichert) || gespeichert.updatedAt !== erwarteterStand) {
      return Promise.resolve(false);
    }
    this.drafts.set(draft.id, draft);
    return Promise.resolve(true);
  }

  /**
   * JOB 3668 — WEICH. Der Datensatz bleibt im Bestand und bekommt seine zwei Papierkorb-Felder.
   *
   * SYNCHRON GEPRÜFT UND GESETZT, kein `await` dazwischen — dieselbe Unteilbarkeit, die
   * `insertIfOperationAbsent` und `updateWennStand` hier tragen. In Postgres leistet das die eine
   * `UPDATE`-Anweisung mit ihrer Bedingung.
   */
  delete(id: string, geloeschtVon?: string, zeitpunkt?: string): Promise<void> {
    const draft = this.drafts.get(id);
    if (!draft || istGetrasht(draft)) {
      return Promise.resolve();
    }
    const vermerk: EntwurfImPapierkorb = {
      ...draft,
      deletedAt: zeitpunkt ?? new Date().toISOString(),
      ...(geloeschtVon === undefined ? {} : { deletedBy: geloeschtVon }),
    };
    this.drafts.set(id, vermerk);
    return Promise.resolve();
  }

  listTrashed(fuerAutor?: string): Promise<EntwurfImPapierkorb[]> {
    return Promise.resolve(
      [...this.drafts.values()]
        .filter((draft): draft is EntwurfImPapierkorb => istGetrasht(draft))
        .filter((draft) => fuerAutor === undefined || draft.originalAuthor === fuerAutor)
        .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    );
  }

  findTrashed(id: string): Promise<EntwurfImPapierkorb | undefined> {
    const draft = this.drafts.get(id);
    return Promise.resolve(draft && istGetrasht(draft) ? draft : undefined);
  }

  restore(id: string): Promise<Draft | undefined> {
    const draft = this.drafts.get(id);
    if (!draft || !istGetrasht(draft)) {
      return Promise.resolve(undefined);
    }
    // Genau die zwei Felder fallen weg — der Rest des Datensatzes wird nicht angefasst. Spiegel
    // von `data - 'deletedAt' - 'deletedBy'` in Postgres.
    const { deletedAt: _at, deletedBy: _von, ...zurueck } = draft;
    this.drafts.set(id, zurueck);
    return Promise.resolve(zurueck);
  }

  // Der Vorgangseintrag bleibt liegen und zeigt ins Leere; `insertIfOperationAbsent` räumt ihn
  // beim nächsten Treffer selbst auf (der Zweig ist seit JOB 2697 da und genau dafür gebaut).
  //
  // RUNDE 2 — GEPRÜFT UND GELÖSCHT OHNE `await` DAZWISCHEN. Das ist hier die ganze Unteilbarkeit,
  // dieselbe wie in `updateWennStand` und `insertIfOperationAbsent`: Ein gleichzeitiges `restore`
  // kann zwischen die Bedingung und das Entfernen nicht mehr geraten, weil zwischen ihnen kein
  // Punkt liegt, an dem die Ereignisschleife eine andere Zusage fortsetzen könnte. In PostgreSQL
  // leistet dasselbe die eine `DELETE`-Anweisung mit ihrem `WHERE`.
  purge(id: string, auchLebende = false): Promise<boolean> {
    const draft = this.drafts.get(id);
    if (!draft || !(auchLebende || istGetrasht(draft))) {
      return Promise.resolve(false);
    }
    return Promise.resolve(this.drafts.delete(id));
  }

  // JOB 3668: einschliesslich Papierkorb — die Begründung steht am Vertrag (`DraftRepo.list`).
  list(): Promise<Draft[]> {
    return Promise.resolve([...this.drafts.values()]);
  }

  // JOB 2696 (R2-33): im Speicher kostet die Filterung nichts — die Zusage ist trotzdem dieselbe
  // wie in PostgreSQL, damit beide Ablagen dieselbe Menge liefern und ein Test, der hier grün ist,
  // etwas über den Betrieb aussagt.
  // JOB 3668: einschliesslich Papierkorb, wie `list()` — es ist dieselbe Liste, nur eingegrenzt,
  // und zwei verschiedene Papierkorb-Auffassungen in einem Vertrag wären der nächste Befund.
  listByAuthor(authorId: string): Promise<Draft[]> {
    return Promise.resolve(
      [...this.drafts.values()].filter((draft) => draft.originalAuthor === authorId),
    );
  }
}
