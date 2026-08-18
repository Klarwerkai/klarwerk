import { type AnswerEvidenceSnapshot, type AnswerRecord, AskError, type Gap } from "./types";

export interface GapRepo {
  insert(gap: Gap): Promise<void>;
  findById(id: string): Promise<Gap | undefined>;
  update(gap: Gap): Promise<void>;
  delete(id: string): Promise<void>;
  all(): Promise<Gap[]>;
  /**
   * ============================================================================================
   * JOB 1111 / D-032 — ANLEGEN ODER HOCHZÄHLEN, UNTEILBAR.
   * ============================================================================================
   *
   * WARUM DAS IN DIE ABLAGE GEHÖRT UND NICHT IN DEN DIENST: Ein „erst suchen, dann einfügen" im
   * Dienst verliert jedes Rennen. Zwei gleichzeitige Fragen sehen beide „gibt es noch nicht" und
   * legen beide an — genau die Dubletten, die D-032 beseitigt. Prüfen und Setzen müssen deshalb
   * ohne Unterbrechung geschehen: im Speicher ohne `await` dazwischen, in PostgreSQL als
   * `ON CONFLICT` gegen einen echten Unique-Index. Dieselbe Lehre wie beim Antwort-Snapshot
   * (`appendSnapshot`): eine Anwendungsprüfung behauptet Eindeutigkeit, ein Index erzwingt sie.
   *
   * VERGLICHEN WIRD `gap.compareKey`, und nur bei OFFENEN Lücken. Eine geschlossene Lücke ist
   * abgearbeitet; dieselbe Frage darf danach wieder aufkommen. Trägt `gap.compareKey` keinen
   * Wert, wird NICHT verglichen — dann ist es immer eine Neuanlage.
   *
   * `created: false` heisst: es gab bereits eine offene Lücke mit diesem Schlüssel; ihr Zähler
   * ist um eins erhöht, und sie — nicht die übergebene — kommt zurück.
   *
   * WARUM OPTIONAL, obwohl beide Betriebsablagen ihn führen: Zwei Testdoppel in
   * `services/ask/src/snapshot-ko-version-und-ref.test.ts` und
   * `services/ask/src/snapshot-verdrahtung-76.test.ts` erfüllen `GapRepo` als Attrappe. Beide
   * Dateien liegen NICHT in der Lease dieses Auftrags; eine Pflichtmethode hätte sie rot gemacht,
   * und ein Eingriff dort wäre ein Lease-Verstoss. Fachlich kostet das nichts: diese Attrappen
   * speichern nichts (`all()` liefert immer leer, `findById()` immer `undefined`), sie könnten
   * also ohnehin nie eine Dublette finden. Im Betrieb gibt es genau zwei Ablagen — `InMemoryGapRepo`
   * und `PgGapRepo` —, und beide führen den Weg. Dass die Methode PFLICHT wird, ist als kleiner
   * Folgeschritt in der Rückgabe benannt.
   */
  insertOrIncrement?(gap: Gap): Promise<{ gap: Gap; created: boolean }>;
}

/** Der Zähler einer Lücke; Altbestände ohne Feld gelten als einmal gefragt. */
function haeufigkeit(gap: Gap): number {
  return typeof gap.askCount === "number" && gap.askCount > 0 ? gap.askCount : 1;
}

export class InMemoryGapRepo implements GapRepo {
  private readonly gaps = new Map<string, Gap>();

  insert(gap: Gap): Promise<void> {
    this.gaps.set(gap.id, gap);
    return Promise.resolve();
  }

  insertOrIncrement(gap: Gap): Promise<{ gap: Gap; created: boolean }> {
    // KEIN `await` in diesem Block — das ist die Unteilbarkeit, die den Parallelfall trägt.
    if (gap.compareKey) {
      for (const vorhanden of this.gaps.values()) {
        if (vorhanden.status === "offen" && vorhanden.compareKey === gap.compareKey) {
          const erhoeht: Gap = { ...vorhanden, askCount: haeufigkeit(vorhanden) + 1 };
          this.gaps.set(erhoeht.id, erhoeht);
          return Promise.resolve({ gap: erhoeht, created: false });
        }
      }
    }
    this.gaps.set(gap.id, gap);
    return Promise.resolve({ gap, created: true });
  }

  findById(id: string): Promise<Gap | undefined> {
    return Promise.resolve(this.gaps.get(id));
  }

  update(gap: Gap): Promise<void> {
    this.gaps.set(gap.id, gap);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.gaps.delete(id);
    return Promise.resolve();
  }

  all(): Promise<Gap[]> {
    return Promise.resolve([...this.gaps.values()]);
  }
}

// ================================================================================================
// W3-A (KW-W3-18) — DER APPEND-ONLY-VERTRAG DER ANTWORTBELEGE
// ================================================================================================

/**
 * DIE TIEFE KOPIE — Unveraenderlichkeit als Laufzeitzusage, nicht als `readonly`.
 *
 * Dieselbe Lehre wie in `library-analytics` (BEN-33 Befund A): `readonly` ist eine
 * Uebersetzungshilfe. Wer dieselbe Referenz ablegt und wieder herausgibt, hat nichts
 * unveraenderlich gemacht. Der Massstab ist wieder PostgreSQL — dort geht der Datensatz durch
 * `JSON.stringify` in eine `jsonb`-Spalte und kommt als frisches Objekt zurueck.
 */
function schnappschuss<T>(wert: T): T {
  return JSON.parse(JSON.stringify(wert)) as T;
}

/**
 * Persistenz der Antwortidentitaet und ihrer Belegrevisionen.
 *
 * ES GIBT KEIN `update` UND KEIN `delete`. Das ist die Unveraenderlichkeit, im Vertrag
 * ausgedrueckt statt im Kommentar: was der Aufrufer nicht aufrufen kann, kann er auch nicht
 * versehentlich tun. Eine Ergaenzung ist Revision `n+1`, nie eine Aenderung an `n`.
 */
export interface AnswerSnapshotRepo {
  /** `true` = neu angelegt; `false` = diese Antwort-Id existierte bereits (idempotent). */
  createRecord(record: AnswerRecord): Promise<boolean>;
  findRecord(answerId: string): Promise<AnswerRecord | undefined>;
  /**
   * `true` = diese Revision war neu; `false` = sie existierte bereits und die VORHANDENE bleibt
   * unangetastet. Wirft `AskError`, wenn die Revisionskette bricht oder ein `null` ohne Grund
   * kaeme — ein Beleg mit gebrochener Kette ist kein Beleg.
   */
  appendSnapshot(snapshot: AnswerEvidenceSnapshot): Promise<boolean>;
  findSnapshot(answerId: string, revision: number): Promise<AnswerEvidenceSnapshot | undefined>;
  /** Alle Revisionen EINER Antwort, aufsteigend. */
  listSnapshots(answerId: string): Promise<AnswerEvidenceSnapshot[]>;
  latestSnapshot(answerId: string): Promise<AnswerEvidenceSnapshot | undefined>;
}

/**
 * DIE EINGANGSPRUEFUNG DER REVISIONSKETTE — geteilt von beiden Ablagen.
 *
 * Sie steht hier und nicht je Adapter, weil zwei Auslegungen derselben Regel genau der Fehler
 * waeren, den die Paritaet verhindern soll (Lehre aus BEN-33 Befund B).
 */
export function pruefeSnapshotKette(
  snapshot: AnswerEvidenceSnapshot,
  vorhandene: readonly AnswerEvidenceSnapshot[],
): void {
  if (snapshot.snapshotRevision < 1) {
    throw new AskError("BAD_REQUEST", "Snapshot-Revision beginnt bei 1.");
  }
  // KW-W3-18: `null` ist nur MIT maschinenlesbarem Grund erlaubt. Schweigen ist kein Grund.
  if (snapshot.resolutionId === null && snapshot.resolutionIdReason === null) {
    throw new AskError("BAD_REQUEST", "Leere resolutionId ohne maschinenlesbaren Grund.");
  }
  if (snapshot.validationDecisionRef === null && snapshot.validationDecisionRefReason === null) {
    throw new AskError("BAD_REQUEST", "Leere validationDecisionRef ohne maschinenlesbaren Grund.");
  }
  for (const ref of snapshot.evidence) {
    if (ref.sourceRecordId === null && ref.sourceRecordIdReason === null) {
      throw new AskError("BAD_REQUEST", "Leere sourceRecordId ohne maschinenlesbaren Grund.");
    }
    if (ref.locator === null && ref.locatorReason === null) {
      throw new AskError("BAD_REQUEST", "Leerer locator ohne maschinenlesbaren Grund.");
    }
  }
  const hoechste = vorhandene.reduce((max, s) => Math.max(max, s.snapshotRevision), 0);
  if (snapshot.snapshotRevision === 1) {
    if (snapshot.supersedesSnapshotRevision !== null) {
      throw new AskError("BAD_REQUEST", "Die erste Revision loest keine ab.");
    }
    return;
  }
  // Eine Revision > 1 MUSS ihren unmittelbaren Vorgaenger benennen. Ohne diese Bedingung koennte
  // eine Kette Luecken haben, und eine Belegkette mit Luecken belegt nichts.
  if (snapshot.supersedesSnapshotRevision !== snapshot.snapshotRevision - 1) {
    throw new AskError(
      "BAD_REQUEST",
      `Revision ${snapshot.snapshotRevision} muss ${snapshot.snapshotRevision - 1} abloesen.`,
    );
  }
  if (snapshot.snapshotRevision > hoechste + 1) {
    throw new AskError("BAD_REQUEST", "Die Revisionskette hat eine Luecke.");
  }
}

export class InMemoryAnswerSnapshotRepo implements AnswerSnapshotRepo {
  private readonly records = new Map<string, AnswerRecord>();
  /** Schluessel ist `answerId@revision` — die Revisionsidentitaet, nicht die Antwort allein. */
  private readonly snapshots = new Map<string, AnswerEvidenceSnapshot>();

  createRecord(record: AnswerRecord): Promise<boolean> {
    if (this.records.has(record.answerId)) {
      return Promise.resolve(false);
    }
    this.records.set(record.answerId, schnappschuss(record));
    return Promise.resolve(true);
  }

  findRecord(answerId: string): Promise<AnswerRecord | undefined> {
    const treffer = this.records.get(answerId);
    return Promise.resolve(treffer === undefined ? undefined : schnappschuss(treffer));
  }

  async appendSnapshot(snapshot: AnswerEvidenceSnapshot): Promise<boolean> {
    if (!this.records.has(snapshot.answerId)) {
      throw new AskError("NOT_FOUND", "Zu diesem Snapshot gibt es keine Antwort.");
    }
    const schluessel = `${snapshot.answerId}@${snapshot.snapshotRevision}`;
    // Pruefen und Setzen ohne `await` dazwischen — dieselbe Unteilbarkeit wie ein
    // ON-CONFLICT-Insert. Die Idempotenz kommt VOR der Kettenpruefung, damit ein
    // Wiederholungslauf derselben Revision ein stiller No-op bleibt und nicht wirft.
    if (this.snapshots.has(schluessel)) {
      return false;
    }
    pruefeSnapshotKette(snapshot, await this.listSnapshots(snapshot.answerId));
    this.snapshots.set(schluessel, schnappschuss(snapshot));
    return true;
  }

  findSnapshot(answerId: string, revision: number): Promise<AnswerEvidenceSnapshot | undefined> {
    const treffer = this.snapshots.get(`${answerId}@${revision}`);
    return Promise.resolve(treffer === undefined ? undefined : schnappschuss(treffer));
  }

  listSnapshots(answerId: string): Promise<AnswerEvidenceSnapshot[]> {
    return Promise.resolve(
      [...this.snapshots.values()]
        .filter((s) => s.answerId === answerId)
        .sort((a, b) => a.snapshotRevision - b.snapshotRevision)
        .map(schnappschuss),
    );
  }

  async latestSnapshot(answerId: string): Promise<AnswerEvidenceSnapshot | undefined> {
    const alle = await this.listSnapshots(answerId);
    return alle.length > 0 ? alle[alle.length - 1] : undefined;
  }
}
