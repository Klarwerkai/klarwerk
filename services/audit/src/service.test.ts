import { beforeEach, describe, expect, it } from "vitest";
import { GENESIS, verifyChain } from "./chain";
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
    expect(await service.verifyReport()).toEqual({ ok: true, count: 0 });
  });

  it("filtert nach Aktion", async () => {
    await service.record({ actor: "a", action: "login", target: "a" });
    await service.record({ actor: "b", action: "logout", target: "b" });
    const logins = await service.list({ action: "login" });
    expect(logins).toHaveLength(1);
    expect(logins[0]?.actor).toBe("a");
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
