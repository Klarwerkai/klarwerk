import { afterEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../services/validation";
import { mussGelingen } from "../gast-nutzerweg/strecke";
import { type MailWelt, ROHFEHLER, mailWelt } from "./mailfehler-pruefstand";

let w: MailWelt | undefined;
afterEach(async () => {
  await w?.schliessen();
  w = undefined;
  vi.restoreAllMocks();
});

describe("IMP4/M15: gespeicherte manuelle Zuweisung und fehlende Versandbestätigung", () => {
  it.each([false, true])("Mailfehler, Auditabsage=%s: Erfolg und Glocke", async (auditFehlt) => {
    w = await mailWelt();
    const x = w;
    const ko = x.objekte[0];
    if (!ko) throw new Error("Prüfobjekt fehlt");
    if (auditFehlt) {
      const record = x.services.audit.record.bind(x.services.audit);
      vi.spyOn(x.services.audit, "record").mockImplementation((e) =>
        e.action === "ko.assignment-notification-unconfirmed"
          ? Promise.reject(new Error("Warnbuchführung abgewiesen"))
          : record(e),
      );
    }
    const antwort = await x.admin.sende("PUT", `/api/kos/${ko.id}`, {
      action: "assign",
      userIds: [x.konto.id],
    });
    expect(antwort.status, antwort.text).toBe(200);
    expect(antwort.json).toEqual({ assigned: true, notification: "unconfirmed" });
    expect(antwort.text).not.toContain(ROHFEHLER);
    expect(x.notify).toHaveBeenCalledTimes(1);
    expect(x.teilweiseBestaetigt).toEqual([x.konto.id]);
    expect(await x.services.validation.openAssignmentsFor(x.konto.id)).toEqual([
      expect.objectContaining({ koId: ko.id }),
    ]);
    const board = mussGelingen(
      "Board-Readback",
      await x.admin.sende("GET", "/api/validation/board"),
    );
    expect(board.json).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ko.id, assignments: [x.konto.id] })]),
    );
    const glocke = mussGelingen("Glocke", await x.pruefer.sende("GET", "/api/notifications"));
    expect(glocke.json).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "assignment", koId: ko.id })]),
    );
    const audit = (await x.services.audit.list({})).filter(
      (e) => e.target === ko.id && e.action === "ko.assignment-notification-unconfirmed",
    );
    expect(audit).toHaveLength(auditFehlt ? 0 : 1);
    if (!auditFehlt) expect(audit[0]?.payload).toEqual({ reason: "TypeError" });
    expect(JSON.stringify(audit)).not.toContain(ROHFEHLER);
  });

  it("behält den normalen 204-Erfolg ohne Warnkörper", async () => {
    w = await mailWelt();
    w.lage.mailFehlt = false;
    const ko = w.objekte[0];
    if (!ko) throw new Error("Prüfobjekt fehlt");
    const antwort = await w.admin.sende("PUT", `/api/kos/${ko.id}`, {
      action: "assign",
      userIds: [w.konto.id],
    });
    expect(antwort.status, antwort.text).toBe(204);
    expect(antwort.text).toBe("");
    expect(w.notify).toHaveBeenCalledTimes(1);
    expect(await w.services.validation.openAssignmentsFor(w.konto.id)).toHaveLength(1);
  });

  it("erhält Rechte-, Konten- und fachliche Absagen ohne Benachrichtigung", async () => {
    w = await mailWelt();
    const ko = w.objekte[0];
    if (!ko) throw new Error("Prüfobjekt fehlt");
    const payload = { action: "assign", userIds: [w.konto.id] };
    expect((await w.leser.sende("PUT", `/api/kos/${ko.id}`, payload)).status).toBe(403);
    expect((await w.admin.sende("PUT", "/api/kos/nicht-vorhanden", payload)).status).toBe(404);
    const unbekannt = await w.admin.sende("PUT", `/api/kos/${ko.id}`, {
      action: "assign",
      userIds: ["kein-konto"],
    });
    expect(unbekannt.status).toBe(400);
    const assign = vi.spyOn(w.services.validation, "assign");
    assign.mockRejectedValueOnce(new ValidationError("FORBIDDEN", "Zuweisung abgelehnt"));
    const absage = await w.admin.sende("PUT", `/api/kos/${ko.id}`, payload);
    expect(absage.status, absage.text).toBe(403);
    expect(w.notify).not.toHaveBeenCalled();
    expect(await w.services.validation.openAssignmentsFor(w.konto.id)).toEqual([]);
  });
});
