import { afterEach, describe, expect, it } from "vitest";
import { commitDocumentAppend } from "../../apps/web/src/lib/appendToArticle";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type Kopf = Record<string, string>;
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

async function welt() {
  const services = buildServices();
  const app = buildApp(services);
  apps.push(app);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Admin", email: "admin@p3.test", password: "secret123" },
      })
    ).statusCode,
  ).toBe(201);
  const login = async (email: string): Promise<Kopf> => {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    expect(r.statusCode).toBe(200);
    return { authorization: `Bearer ${r.json().token}` };
  };
  const admin = await login("admin@p3.test");
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: {
          name: "Expertin",
          email: "expertin@p3.test",
          password: "secret123",
          role: "experte",
        },
      })
    ).statusCode,
  ).toBe(201);
  const fremd = await login("expertin@p3.test");
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      confidentiality: "intern",
      title: "Ventil",
      statement: "Original",
      bodyHtml: "<p>Original</p>",
      type: "best_practice",
      category: "Anlage",
    },
  });
  expect(created.statusCode).toBe(201);
  const id = created.json().id as string;
  const upload = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: fremd,
    payload: {
      name: "beleg.txt",
      mime: "text/plain",
      data: "data:text/plain;base64,QkVMRUc=",
      kind: "document",
      purpose: "anchor",
    },
  });
  expect(upload.statusCode).toBe(201);
  const anhang = () => ({
    operationId: `append-${crypto.randomUUID()}`,
    anchor: { objectId: upload.json().id as string, name: "beleg.txt", mime: "text/plain" },
    points: [{ label: "beleg.txt", excerpt: "BELEG" }],
    changes: { bodyHtml: "<p>Ergänzt</p>", statement: "Ergänzt" },
  });
  const put = (headers: Kopf, payload: Record<string, unknown>) =>
    app.inject({ method: "PUT", url: `/api/kos/${id}`, headers, payload });
  const zustand = async () => {
    const k = await services.ko.get(id);
    return {
      version: k?.version,
      status: k?.status,
      trust: k?.trust,
      title: k?.title,
      statement: k?.statement,
      bodyHtml: k?.bodyHtml,
      attachments: k?.attachments,
      sources: k?.sources,
      appendOps: k?.appendOps,
      history: k?.history,
      versions: await services.ko.versionsOf(id),
      evidence: await services.ko.evidenceOf(id),
      writes: (await services.audit.list({ target: id })).filter((b) =>
        ["ko.revised", "ko.revalidated", "ko.document-appended"].includes(b.action),
      ),
    };
  };
  return { app, services, id, admin, fremd, anhang, put, zustand };
}

const aktionen = ["revalidate", "append-document"] as const;
describe.each(aktionen)("P3 · %s hat Freigabegate und bedingten Schreibzugriff", (action) => {
  it("fremde Änderung am freigegebenen Objekt: 403 PROPOSAL_REQUIRED ohne Mutation und Beleg", async () => {
    const w = await welt();
    expect(
      (await w.put(w.admin, { action: "admin-validate", expectedVersion: 1 })).statusCode,
    ).toBe(200);
    const vorher = await w.zustand();
    for (const expectedVersion of [undefined, 1]) {
      const r = await w.put(w.fremd, {
        action,
        ...(action === "append-document" ? { appendDocument: w.anhang() } : {}),
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
      });
      expect(r.statusCode).toBe(403);
      expect(r.json().error).toBe("PROPOSAL_REQUIRED");
      expect(await w.zustand()).toEqual(vorher);
    }
  });

  it.each(["offen", "admin-freigegeben"])(
    "berechtigter Weg %s schreibt die aktuelle Fassung",
    async (weg) => {
      const w = await welt();
      if (weg === "admin-freigegeben") {
        expect(
          (await w.put(w.admin, { action: "admin-validate", expectedVersion: 1 })).statusCode,
        ).toBe(200);
      }
      const r = await w.put(weg === "offen" ? w.fremd : w.admin, {
        action,
        expectedVersion: 1,
        ...(action === "append-document" ? { appendDocument: w.anhang() } : {}),
      });
      expect(r.statusCode, r.body).toBe(200);
      const nachher = await w.zustand();
      expect(nachher.version).toBe(2);
      expect(nachher.status).toBe("offen");
      if (action === "append-document") {
        expect(nachher.statement).toBe("Ergänzt");
        expect(nachher.attachments).toHaveLength(1);
        expect(nachher.sources).toHaveLength(1);
        expect(nachher.sources?.[0]?.objectId).toBe(nachher.attachments?.[0]?.objectId);
      }
    },
  );

  it("alte Fassung: 409 KO_STALE ohne Inhalt, Anker, Historie oder Beleg zu ändern", async () => {
    const w = await welt();
    expect(
      (await w.put(w.admin, { action: "revise", changes: { statement: "Fremde Fassung" } }))
        .statusCode,
    ).toBe(200);
    const vorher = await w.zustand();
    const r = await w.put(w.admin, {
      action,
      expectedVersion: 1,
      ...(action === "append-document" ? { appendDocument: w.anhang() } : {}),
    });
    expect(r.statusCode, r.body).toBe(409);
    expect(r.json()).toMatchObject({ error: "KO_STALE", currentVersion: 2 });
    expect(await w.zustand()).toEqual(vorher);
  });

  it("unlesbare Fassung: 400 und kein Schreiben", async () => {
    const w = await welt();
    const vorher = await w.zustand();
    const r = await w.put(w.admin, {
      action,
      expectedVersion: "1",
      ...(action === "append-document" ? { appendDocument: w.anhang() } : {}),
    });
    expect(r.statusCode).toBe(400);
    expect(await w.zustand()).toEqual(vorher);
  });

  it("zwei gleichzeitige Änderungen auf Fassung 1: genau ein Commit", async () => {
    const w = await welt();
    const responses = await Promise.all(
      [0, 1].map(() =>
        w.put(w.admin, {
          action,
          expectedVersion: 1,
          ...(action === "append-document" ? { appendDocument: w.anhang() } : {}),
        }),
      ),
    );
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await w.zustand()).version).toBe(2);
  });
});

describe("P3 · vorhandene Folge- und Retryverträge", () => {
  it("identischer append-Retry quittiert nach neuer Freigabe mit alter expectedVersion denselben Commit", async () => {
    const w = await welt();
    const payload = { action: "append-document", expectedVersion: 1, appendDocument: w.anhang() };
    const first = await w.put(w.fremd, payload);
    expect(first.statusCode, first.body).toBe(200);
    expect(
      (await w.put(w.admin, { action: "admin-validate", expectedVersion: 2 })).statusCode,
    ).toBe(200);
    const vorher = await w.zustand();
    const retry = await w.put(w.fremd, payload);
    expect(retry.statusCode, retry.body).toBe(200);
    expect(retry.json()).toMatchObject({
      committed: true,
      replayed: true,
      operationId: payload.appendDocument.operationId,
      koVersion: first.json().koVersion,
      attachmentId: first.json().attachmentId,
      sourceIds: first.json().sourceIds,
    });
    expect(await w.zustand()).toEqual(vorher);
  });

  it("append-Dienst selbst vergleicht unter seiner Schreibsperre; die Route ist nicht der CAS", async () => {
    const w = await welt();
    const a = w.anhang();
    await w.services.ko.revise(w.id, { statement: "Andere Fassung" }, "admin");
    const vorher = await w.zustand();
    await expect(
      w.services.ko.appendDocumentExtract(w.id, "admin", {
        operationId: a.operationId,
        anchor: a.anchor,
        sources: a.points,
        changes: a.changes,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "KO_STALE" });
    expect(await w.zustand()).toEqual(vorher);
  });

  it("stand/fassung bleibt bindend; eine abweichende expectedVersion räumt den Folgefall nicht", async () => {
    const w = await welt();
    await w.services.lifecycle.couple("anlage-p3", w.id);
    await w.services.lifecycle.assetChanged("anlage-p3");
    const vorher = await w.zustand();
    const falsch = await w.put(w.admin, {
      action: "revalidate",
      stand: 1,
      fassung: 1,
      expectedVersion: 2,
    });
    expect(falsch.statusCode).toBe(400);
    expect(await w.zustand()).toEqual(vorher);
    expect(await w.services.lifecycle.pendingRevalidation()).toContain(w.id);
    const aktuell = await w.put(w.admin, {
      action: "revalidate",
      stand: 1,
      fassung: 1,
      expectedVersion: 1,
    });
    expect(aktuell.statusCode, aktuell.body).toBe(200);
    expect(await w.services.lifecycle.pendingRevalidation()).not.toContain(w.id);
  });

  it.each(["KO_STALE", "PROPOSAL_REQUIRED"])(
    "Client behandelt %s als eindeutige Ablehnung ohne Retry",
    async (code) => {
      let aufrufe = 0;
      const ergebnis = await commitDocumentAppend(
        {
          append: async () => {
            aufrufe++;
            throw { code };
          },
        },
        "append-p3-abgelehnt",
      );
      expect(ergebnis).toMatchObject({ kind: "rejected", reason: code });
      expect(aufrufe).toBe(1);
    },
  );
});
