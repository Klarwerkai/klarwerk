// ================================================================================================
// JOB 2697 · D7 — DER PERSISTENZVERTRAG, IM SPEICHER GEMESSEN.
// ================================================================================================
//
// Dieselben Fälle wie der PostgreSQL-Lauf in `repo-pg.integration.test.ts` (P0 bis P3), plus
// einen, den nur diese Hälfte haben kann: die Unteilbarkeit im selben Tick.
//
// WARUM BEIDE HÄLFTEN DIESELBEN FÄLLE TRAGEN: Zwei Auslegungen derselben Regel wären genau der
// Fehler, den die Parität verhindern soll (Lehre aus BEN-33 Befund B). Was hier grün ist und dort
// rot wäre, wäre eine Zusage, die nur im Test gilt.
import { describe, expect, it } from "vitest";
import { InMemoryDraftRepo } from "./repo";
import type { Draft } from "./types";

function entwurf(id: string, over: Partial<Draft> = {}): Draft {
  return {
    id,
    payload: { title: "Ventil prüfen", bodyHtml: "<p>Text</p>" },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

const vorgang = (id: string, actor: string, fingerprint = "abc") => ({ id, actor, fingerprint });

describe("JOB 2697 · InMemoryDraftRepo · insertIfOperationAbsent", () => {
  it("P0 · KALIBRIERUNG: zwei Anlagen OHNE Vorgang ergeben zwei Entwürfe", async () => {
    // Ohne diesen Fall wäre auch eine Ablage grün, die einfach nie zweimal anlegt — und der
    // Bestandspfad wäre still kaputt.
    const repo = new InMemoryDraftRepo();

    const a = await repo.insertIfOperationAbsent(entwurf("d1"));
    const b = await repo.insertIfOperationAbsent(entwurf("d2"));

    expect(a.angelegt).toBe(true);
    expect(b.angelegt).toBe(true);
    expect(await repo.list()).toHaveLength(2);
  });

  it("P1 · gleicher Eigentümer, gleiche Kennung: EIN Entwurf, der zweite bekommt den ersten", async () => {
    const repo = new InMemoryDraftRepo();

    const erst = await repo.insertIfOperationAbsent(
      entwurf("d1", { createOperation: vorgang("op-1", "u1") }),
    );
    const zweit = await repo.insertIfOperationAbsent(
      entwurf("d2", { createOperation: vorgang("op-1", "u1") }),
    );

    expect(erst.angelegt).toBe(true);
    expect(zweit.angelegt).toBe(false);
    if (zweit.angelegt) {
      throw new Error("der zweite Aufruf hat angelegt");
    }
    expect(zweit.bestehend.id, "es kam nicht der BESTEHENDE Entwurf zurück").toBe("d1");
    expect(await repo.list()).toHaveLength(1);
  });

  it("P3 · VERSCHIEDENE Eigentümer, gleiche Kennung: zwei Entwürfe, keiner sieht den anderen", async () => {
    // Die Denial-Kante. Wäre der Schlüssel nur die Kennung und nicht das Paar, könnte eine Person
    // mit einer geratenen Kennung die Anlage einer anderen blockieren — oder deren Entwurf
    // bekommen.
    const repo = new InMemoryDraftRepo();

    const a = await repo.insertIfOperationAbsent(
      entwurf("d1", { createOperation: vorgang("op-1", "u1") }),
    );
    const b = await repo.insertIfOperationAbsent(
      entwurf("d2", { originalAuthor: "u2", createOperation: vorgang("op-1", "u2") }),
    );

    expect(a.angelegt).toBe(true);
    expect(b.angelegt).toBe(true);
    expect(await repo.list()).toHaveLength(2);
  });

  it("der Schlüssel ist trennsicher — Doppelpunkte in Kennung oder Eigentümer verwechseln nichts", async () => {
    // `actor + ":" + id` wäre hier zweimal derselbe String gewesen, und der zweite Aufrufer
    // bekäme den Entwurf des ersten. Deshalb `JSON.stringify` statt Verkettung.
    const repo = new InMemoryDraftRepo();

    const a = await repo.insertIfOperationAbsent(
      entwurf("d1", { createOperation: vorgang("b:c", "a") }),
    );
    const b = await repo.insertIfOperationAbsent(
      entwurf("d2", { createOperation: vorgang("c", "a:b") }),
    );

    expect(a.angelegt).toBe(true);
    expect(b.angelegt, "zwei verschiedene Vorgänge fielen auf denselben Schlüssel").toBe(true);
    expect(await repo.list()).toHaveLength(2);
  });

  it("M6 · UNTEILBAR: zwei Anlagen im SELBEN Tick ergeben einen Entwurf", async () => {
    // Das ist die Zusage, auf der der Parallelfall im Speicher ruht: zwischen Prüfen und Setzen
    // liegt kein `await`. Wird die Methode je asynchron gemacht, fällt genau dieser Fall.
    const repo = new InMemoryDraftRepo();

    const [a, b] = await Promise.all([
      repo.insertIfOperationAbsent(entwurf("d1", { createOperation: vorgang("op-1", "u1") })),
      repo.insertIfOperationAbsent(entwurf("d2", { createOperation: vorgang("op-1", "u1") })),
    ]);

    expect(await repo.list(), "der Parallelfall legte zwei Entwürfe an").toHaveLength(1);
    expect(
      [a.angelegt, b.angelegt].filter(Boolean),
      "beide hielten sich für die Anlage",
    ).toHaveLength(1);
  });

  it("ein Entwurf OHNE Vorgang wird angelegt und blockiert keine spätere Kennung", async () => {
    const repo = new InMemoryDraftRepo();

    await repo.insertIfOperationAbsent(entwurf("d1"));
    const b = await repo.insertIfOperationAbsent(
      entwurf("d2", { createOperation: vorgang("op-1", "u1") }),
    );

    expect(b.angelegt).toBe(true);
    expect(await repo.list()).toHaveLength(2);
  });

  it("auch `insert` trägt den Vorgang nach — sonst hätte der Bestandsweg ein Loch", async () => {
    // `insert` ist der Weg ohne Kennung, aber ein Entwurf MIT `createOperation` kann auch darüber
    // hereinkommen (Dev-Journal-Replay). Träge er den Spiegel nicht nach, fände ihn die
    // Wiederholung danach nicht.
    const repo = new InMemoryDraftRepo();

    await repo.insert(entwurf("d1", { createOperation: vorgang("op-1", "u1") }));
    const zweit = await repo.insertIfOperationAbsent(
      entwurf("d2", { createOperation: vorgang("op-1", "u1") }),
    );

    expect(zweit.angelegt).toBe(false);
    expect(await repo.list()).toHaveLength(1);
  });
});
