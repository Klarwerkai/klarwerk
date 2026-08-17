import { beforeEach, describe, expect, it } from "vitest";
import { GENESIS, hashEntry, verifyChain } from "./chain";
import { InMemoryAuditRepo } from "./repo";
import { AuditService } from "./service";

describe("AuditService", () => {
  let service: AuditService;

  beforeEach(() => {
    service = new AuditService({ repo: new InMemoryAuditRepo() });
  });

  it("FR-AUD-01: erfasst wer/was/wann mit fortlaufender Sequenz", async () => {
    const e1 = await service.record({ actor: "admin", action: "user.approve", target: "u1" });
    expect(e1.seq).toBe(1);
    expect(e1.prevHash).toBe(GENESIS);
    expect(e1.actor).toBe("admin");
    expect(e1.at).toBeTruthy();

    const e2 = await service.record({ actor: "admin", action: "user.delete", target: "u2" });
    expect(e2.seq).toBe(2);
    expect(e2.prevHash).toBe(e1.hash); // Kette
  });

  it("FR-AUD-02: append-only — Einträge sind eingefroren", async () => {
    const entry = await service.record({ actor: "admin", action: "x", target: "y" });
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it("FR-AUD-02: intakte Kette verifiziert", async () => {
    await service.record({ actor: "a", action: "act1", target: "t1" });
    await service.record({ actor: "b", action: "act2", target: "t2" });
    expect(await service.verify()).toBe(true);
  });

  it("SCRUM-439: verifyReport meldet ok + Anzahl der geprüften Einträge", async () => {
    await service.record({ actor: "a", action: "act1", target: "t1" });
    await service.record({ actor: "b", action: "act2", target: "t2" });
    const report = await service.verifyReport();
    expect(report.ok).toBe(true);
    expect(report.count).toBe(2);
  });

  it("SCRUM-439: leere Kette gilt als intakt (count 0)", async () => {
    // AUFTRAG-mega14 Block A: die genaue Form bleibt geprüft (toEqual, kein toMatchObject) — sie ist
    // nur um die Ursachen-Zähler gewachsen.
    expect(await service.verifyReport()).toEqual({
      ok: true,
      count: 0,
      linkageBreaks: 0,
      payloadDeviations: 0,
      serialisationDeviations: 0,
      unresolvedDeviations: 0,
      uncheckedDeviations: 0,
    });
  });

  it("filtert nach Aktion", async () => {
    await service.record({ actor: "a", action: "login", target: "a" });
    await service.record({ actor: "b", action: "logout", target: "b" });
    const logins = await service.list({ action: "login" });
    expect(logins).toHaveLength(1);
    expect(logins[0]?.actor).toBe("a");
  });
});

describe("WP-SHIP8-CLOSE-6 (bens ROT-1): recordOnce — exactly-once je Event-Id", () => {
  it("gleiche Event-Id zweimal sequenziell → genau EIN Eintrag, zweiter Aufruf meldet false", async () => {
    const service = new AuditService({ repo: new InMemoryAuditRepo() });
    const first = await service.recordOnce("ko.created:ko-1", {
      actor: "a",
      action: "ko.created",
      target: "ko-1",
    });
    const second = await service.recordOnce("ko.created:ko-1", {
      actor: "b",
      action: "ko.created",
      target: "ko-1",
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    const entries = await service.list({ action: "ko.created", target: "ko-1" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.actor).toBe("a");
    expect(entries[0]?.eventId).toBe("ko.created:ko-1");
  });

  it("bens Pflichttest: zwei PARALLELE Schreiber derselben Event-Id → exakt EIN Eintrag, Kette intakt", async () => {
    const service = new AuditService({ repo: new InMemoryAuditRepo() });
    // Beide bauen ihren Ketten-Eintrag aus demselben (leeren) last()-Stand — der synchrone
    // Set-Guard des Repos entscheidet, die verworfene seq hinterlässt keine Lücke.
    const results = await Promise.all([
      service.recordOnce("ko.created:ko-1", { actor: "a", action: "ko.created", target: "ko-1" }),
      service.recordOnce("ko.created:ko-1", { actor: "b", action: "ko.created", target: "ko-1" }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await service.list({ action: "ko.created", target: "ko-1" })).toHaveLength(1);
    expect(await service.verify()).toBe(true);
  });

  it("verschiedene Event-Ids schreiben unabhängig; record() bleibt unverändert nutzbar", async () => {
    const service = new AuditService({ repo: new InMemoryAuditRepo() });
    expect(
      await service.recordOnce("ko.created:a", { actor: "x", action: "ko.created", target: "a" }),
    ).toBe(true);
    expect(
      await service.recordOnce("ko.created:b", { actor: "x", action: "ko.created", target: "b" }),
    ).toBe(true);
    await service.record({ actor: "x", action: "ko.updated", target: "a" });
    expect(await service.verifyReport()).toEqual({
      ok: true,
      count: 3,
      linkageBreaks: 0,
      payloadDeviations: 0,
      serialisationDeviations: 0,
      unresolvedDeviations: 0,
      uncheckedDeviations: 0,
    });
  });
});

// ================================================================================================
// JOB 498 D8 — NEUE EINTRÄGE SIND V2 (D6 T2, T4, T5)
// ================================================================================================
describe("JOB 498 D8: record und recordOnce schreiben Hashversion 2", () => {
  it("T2 — `record` liefert hashVersion 2, und die Kette verifiziert", async () => {
    const service = new AuditService({ repo: new InMemoryAuditRepo() });
    const entry = await service.record({ actor: "a", action: "ko.created", target: "ko-1" });
    expect(entry.hashVersion).toBe(2);
    expect(verifyChain([entry])).toBe(true);
    expect(await service.verify()).toBe(true);
  });

  it("T4 — die Version steht VOR dem Einfrieren im Eintrag", async () => {
    const service = new AuditService({ repo: new InMemoryAuditRepo() });
    const entry = await service.record({ actor: "a", action: "x", target: "y" });
    // Beides zusammen ist die Aussage: der Eintrag ist eingefroren UND trägt die Version. Wäre sie
    // nachträglich gesetzt worden, hätte das Einfrieren sie verschluckt — lautlos, weil ein Write
    // auf ein gefrorenes Objekt außerhalb des strict mode einfach nichts tut.
    expect(Object.isFrozen(entry)).toBe(true);
    expect(entry.hashVersion).toBe(2);
  });

  it("T5 — zwei parallele `recordOnce` derselben Event-Id: EIN Eintrag, Version 2, Kette intakt", async () => {
    const service = new AuditService({ repo: new InMemoryAuditRepo() });
    const ergebnisse = await Promise.all([
      service.recordOnce("ko.created:ko-v2", { actor: "a", action: "ko.created", target: "ko-v2" }),
      service.recordOnce("ko.created:ko-v2", { actor: "b", action: "ko.created", target: "ko-v2" }),
    ]);
    expect(ergebnisse.filter(Boolean)).toHaveLength(1);
    const eintraege = await service.list({ target: "ko-v2" });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.hashVersion).toBe(2);
    expect(await service.verify()).toBe(true);
  });

  it("eine gemischte Kette aus Alt- und Neubestand bleibt gültig", async () => {
    // Der Altbestand kommt hier als versionsloser Eintrag direkt ins Repo — genau so, wie ihn
    // eine Bestandsdatenbank vor der Migration liefert.
    const repo = new InMemoryAuditRepo();
    const alt = {
      seq: 1,
      at: "2026-07-01T00:00:00.000Z",
      actor: "alt",
      action: "ko.created",
      target: "ko-alt",
      payload: {} as Record<string, unknown>,
      prevHash: GENESIS,
    };
    await repo.append({ ...alt, hash: hashEntry(alt) });
    const service = new AuditService({ repo });
    const neu = await service.record({ actor: "neu", action: "ko.updated", target: "ko-alt" });
    expect(neu.seq).toBe(2);
    expect(neu.hashVersion).toBe(2);
    expect(await service.verify()).toBe(true);
    const bericht = await service.verifyReport();
    expect(bericht.ok).toBe(true);
    expect(bericht.count).toBe(2);
  });
});

describe("verifyChain (Manipulationserkennung)", () => {
  it("FR-AUD-02: nachträglich geänderter Eintrag bricht die Kette", async () => {
    const service = new AuditService({ repo: new InMemoryAuditRepo() });
    await service.record({ actor: "a", action: "act", target: "x" });
    await service.record({ actor: "b", action: "act2", target: "y" });

    const entries = await service.list();
    expect(verifyChain(entries)).toBe(true);

    // Inhalt eines Eintrags ändern, ohne den Hash neu zu berechnen → erkannt.
    const tampered = entries.map((entry, index) =>
      index === 0 ? { ...entry, actor: "haxor" } : entry,
    );
    expect(verifyChain(tampered)).toBe(false);
  });
});
