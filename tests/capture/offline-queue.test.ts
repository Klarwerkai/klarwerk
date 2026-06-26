import { describe, expect, it } from "vitest";
import {
  type NewOp,
  type QueuedOp,
  clearSynced,
  countByStatus,
  enqueue,
  markFailed,
  markPending,
  markSynced,
  pendingCount,
  replacePayload,
  syncableOps,
} from "../../apps/web/src/lib/offlineQueue";

const newOp = (p: Partial<NewOp>): NewOp => ({
  id: "op1",
  kind: "draft.create",
  draftId: null,
  payload: { title: "T", statement: "S" },
  title: "T",
  createdAt: "t0",
  ...p,
});

describe("SCRUM-113 / FE-MOB-07: offlineQueue", () => {
  it("enqueue legt einen Op mit Status queued an", () => {
    const q = enqueue([], newOp({}));
    expect(q).toHaveLength(1);
    expect(q[0]?.status).toBe("queued");
    expect(q[0]?.error).toBeNull();
  });

  it("update auf noch nicht synchronisierten Draft ersetzt Payload statt zu duplizieren", () => {
    const q1 = enqueue([], newOp({ id: "a", kind: "draft.update", draftId: "d1", title: "alt" }));
    const q2 = enqueue(
      q1,
      newOp({
        id: "b",
        kind: "draft.update",
        draftId: "d1",
        title: "neu",
        payload: { title: "N" },
      }),
    );
    expect(q2).toHaveLength(1);
    expect(q2[0]?.title).toBe("neu");
    expect(q2[0]?.payload).toEqual({ title: "N" });
    expect(q2[0]?.status).toBe("queued");
  });

  it("Status-Übergänge queued → pending → synced/failed", () => {
    let q = enqueue([], newOp({ id: "x" }));
    q = markPending(q, "x");
    expect(q[0]?.status).toBe("pending");
    q = markSynced(q, "x");
    expect(q[0]?.status).toBe("synced");

    let f = enqueue([], newOp({ id: "y" }));
    f = markFailed(f, "y", "Netzwerkfehler");
    expect(f[0]?.status).toBe("failed");
    expect(f[0]?.error).toBe("Netzwerkfehler");
  });

  it("failed bleibt synchronisierbar; synced nicht", () => {
    const q: QueuedOp[] = [
      { ...newOp({ id: "a" }), status: "queued", error: null },
      { ...newOp({ id: "b" }), status: "failed", error: "x" },
      { ...newOp({ id: "c" }), status: "pending", error: null },
      { ...newOp({ id: "d" }), status: "synced", error: null },
    ];
    expect(syncableOps(q).map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("replacePayload aktualisiert nur queued/failed Ops und setzt error zurück", () => {
    const q: QueuedOp[] = [{ ...newOp({ id: "a" }), status: "failed", error: "x" }];
    const r = replacePayload(q, "a", { title: "Neu" }, "Neu");
    expect(r[0]?.payload).toEqual({ title: "Neu" });
    expect(r[0]?.status).toBe("queued");
    expect(r[0]?.error).toBeNull();
  });

  it("clearSynced/pendingCount/countByStatus liefern ehrliche Zahlen", () => {
    const q: QueuedOp[] = [
      { ...newOp({ id: "a" }), status: "queued", error: null },
      { ...newOp({ id: "b" }), status: "failed", error: "x" },
      { ...newOp({ id: "c" }), status: "synced", error: null },
    ];
    expect(pendingCount(q)).toBe(2);
    expect(clearSynced(q).map((o) => o.id)).toEqual(["a", "b"]);
    expect(countByStatus(q)).toEqual({ queued: 1, pending: 0, failed: 1, synced: 1 });
  });
});
