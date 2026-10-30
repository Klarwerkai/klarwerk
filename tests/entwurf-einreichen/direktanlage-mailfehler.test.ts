import { afterEach, describe, expect, it, vi } from "vitest";
import * as koRouten from "../../services/app/src/routes/ko-routes";
import { ValidationError } from "../../services/validation";
import { baueFrischeBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  await schliesseBuehnen();
  vi.restoreAllMocks();
});

const fehlertext = "Mailinhalt an pruefer@example.test über https://mail.example.test/send";

async function buehne(mailFehlt: boolean) {
  const notify = vi.fn(async (_id: string, _reviewers: readonly string[]) => {
    if (mailFehlt) throw new TypeError(fehlertext);
  });
  const enqueue = vi.fn();
  const original = koRouten.koRoutes;
  vi.spyOn(koRouten, "koRoutes").mockImplementation((deps, guards) => {
    const worker = deps.aiCheckWorker;
    if (!worker) throw new Error("Produktiver Prüfport fehlt");
    return original(
      { ...deps, notifyAssignment: notify, aiCheckWorker: { ...worker, enqueue } },
      guards,
    );
  });
  const w = await baueFrischeBuehne();
  const assign = vi.spyOn(w.services.validation, "assign");
  const pending = vi.spyOn(w.services.ko, "markAiCheckPending");
  const warnung = vi.spyOn(w.services.ko, "recordCreateFollowUpFailures");
  const payload = {
    operationId: "imp4-direktanlage-mailfehler",
    type: "best_practice",
    category: "Wartung",
    confidentiality: "intern",
    title: "Pumpe vor dem Anfahren entlüften",
    statement: "Vor dem Anfahren die Pumpe entlüften.",
    conditions: [],
    measures: [],
    reviewerIds: [w.konto.experte.id, w.konto.controller.id, w.konto.controller.id],
  };
  const headers = { authorization: `Bearer ${w.sitzung.experte}` };
  const post = (body = payload) =>
    w.app.inject({ method: "POST", url: "/api/kos", headers, payload: body });
  const lese = (id: string) => w.app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  return { w, notify, enqueue, assign, pending, warnung, payload, post, lese };
}

describe("IMP-4/M15: direkte Einreichung trotz ausgebliebener Zuweisungsmail", () => {
  it("Mailfehler erhält Anlage und Prüfjob mit Warnung sowie einmaligem Replay", async () => {
    const { w, notify, enqueue, assign, pending, warnung, post, lese } = await buehne(true);
    const antwort = await post();
    expect(antwort.statusCode, antwort.body).toBe(201);
    const erstellt = antwort.json();
    const id = erstellt.id as string;
    expect(erstellt).toMatchObject({
      author: w.konto.experte.id,
      version: 1,
      aiCheck: { status: "pending", koVersion: 1 },
      createFollowUpsFailed: ["notify-assignment"],
      followUpsFailed: ["notify-assignment"],
      followUpsRecorded: { aiCheckFailed: false, failures: true },
    });
    expect(await w.services.validation.openAssignmentsFor(w.konto.controller.id)).toEqual([
      expect.objectContaining({ koId: id }),
    ]);
    expect(await w.services.validation.openAssignmentsFor(w.konto.experte.id)).toEqual([]);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(id, [w.konto.controller.id], w.konto.experte.id);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(id, [w.konto.controller.id]);
    expect(pending).toHaveBeenCalledTimes(1);
    expect(pending).toHaveBeenCalledWith(id);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(id, 1);
    expect(warnung).toHaveBeenCalledTimes(1);
    expect(warnung).toHaveBeenCalledWith(id, ["notify-assignment"]);
    const gelesen = await lese(id);
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    expect(gelesen.json()).toMatchObject({
      id,
      aiCheck: { status: "pending", koVersion: 1 },
      createFollowUpsFailed: ["notify-assignment"],
    });
    const audit = (await w.services.audit.list({})).filter(
      (a) => a.target === id && a.action === "ko.create-followup-failed",
    );
    expect(audit).toHaveLength(1);
    const beleg = audit[0];
    if (!beleg) throw new Error("Auditbeleg fehlt");
    expect(beleg.payload).toEqual({ step: "notify-assignment", reason: "TypeError" });
    expect(JSON.stringify(audit)).not.toContain(fehlertext);
    expect(antwort.body).not.toContain(fehlertext);
    const vorher = await w.repos.koRepo.findById(id);
    const wiederholung = await post();
    expect(wiederholung.statusCode, wiederholung.body).toBe(201);
    expect(wiederholung.json()).toMatchObject({
      id,
      aiCheck: { status: "pending", koVersion: 1 },
      createFollowUpsFailed: ["notify-assignment"],
    });
    expect(await w.repos.koRepo.findById(id)).toEqual(vorher);
    expect(await w.services.ko.list()).toHaveLength(1);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(pending).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(warnung).toHaveBeenCalledTimes(1);
  });

  it("erhält Versand und beendet eine Zuweisungsabsage vor der Nachricht", async () => {
    const { w, notify, enqueue, assign, pending, warnung, payload, post, lese } =
      await buehne(false);
    const antwort = await post();
    expect(antwort.statusCode, antwort.body).toBe(201);
    const id = antwort.json().id as string;
    expect(antwort.json().aiCheck).toMatchObject({ status: "pending", koVersion: 1 });
    expect(antwort.json()).not.toHaveProperty("followUpsFailed");
    expect(antwort.json()).not.toHaveProperty("followUpsRecorded");
    expect(antwort.json()).not.toHaveProperty("createFollowUpsFailed");
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(id, [w.konto.controller.id]);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(id, 1);
    expect(warnung).not.toHaveBeenCalled();
    const gelesen = await lese(id);
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    expect(gelesen.json()).not.toHaveProperty("createFollowUpsFailed");
    expect(await w.services.validation.openAssignmentsFor(w.konto.controller.id)).toEqual([
      expect.objectContaining({ koId: id }),
    ]);
    assign.mockRejectedValueOnce(new ValidationError("FORBIDDEN", "Zuweisung abgelehnt"));
    const absage = await post({ ...payload, operationId: "imp4-zuweisung-abgelehnt" });
    expect(absage.statusCode, absage.body).toBe(403);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(pending).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(warnung).not.toHaveBeenCalled();
  });

  it("meldet fehlende Warnpersistenz ehrlich, ohne Anlage oder Prüfjob zu verwerfen", async () => {
    const { w, notify, enqueue, assign, pending, warnung, post, lese } = await buehne(true);
    warnung.mockRejectedValueOnce(new Error("Warnspeicher nicht verfügbar"));
    const antwort = await post();
    expect(antwort.statusCode, antwort.body).toBe(201);
    const id = antwort.json().id as string;
    expect(antwort.json()).toMatchObject({
      id,
      aiCheck: { status: "pending", koVersion: 1 },
      followUpsFailed: ["notify-assignment"],
      followUpsRecorded: { aiCheckFailed: false, failures: false },
    });
    expect(antwort.json()).not.toHaveProperty("createFollowUpsFailed");
    expect(await w.services.ko.list()).toHaveLength(1);
    expect(await w.services.validation.openAssignmentsFor(w.konto.controller.id)).toEqual([
      expect.objectContaining({ koId: id }),
    ]);
    const gelesen = await lese(id);
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    expect(gelesen.json().aiCheck).toMatchObject({ status: "pending", koVersion: 1 });
    expect(gelesen.json()).not.toHaveProperty("createFollowUpsFailed");
    expect(assign).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(pending).toHaveBeenCalledTimes(1);
    expect(pending).toHaveBeenCalledWith(id);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(id, 1);
    expect(warnung).toHaveBeenCalledTimes(1);
    expect(warnung).toHaveBeenCalledWith(id, ["notify-assignment"]);
  });
});
