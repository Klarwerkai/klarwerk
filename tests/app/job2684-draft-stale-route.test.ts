// JOB 2684 D1 (Review R2-17) — ZWEI TABS, UND EIN ENTWURF IST WEG: die echten Routen.
//
// PUT /api/drafts/:id und POST /api/drafts/:id/promote mit `expectedUpdatedAt`: ein veralteter
// Stand bekommt 409 DRAFT_STALE; der Entwurf bleibt, kein Wissensobjekt entsteht. Ohne den Wert
// bleibt der alte Weg (Mobil, Offline-Warteschlange).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function angemeldeteApp() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const anlegen = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers,
    payload: { title: "Wartung der Presse", statement: "Ursprung" },
  });
  expect(anlegen.statusCode).toBe(201);
  const draft = anlegen.json() as { id: string; updatedAt: string };
  return { app, services, headers, draft };
}

describe("JOB 2684 D1 · PUT /api/drafts/:id mit gesehenem Stand", () => {
  it("Tab A speichert mit dem geladenen Stand → 200 und neuer Stand; Tab B mit dem alten Stand → 409 DRAFT_STALE, nichts überschrieben", async () => {
    const { app, headers, draft } = await angemeldeteApp();
    const gesehenVonB = draft.updatedAt;
    await warte(5);
    const a = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers,
      payload: { statement: "Fassung A", expectedUpdatedAt: draft.updatedAt },
    });
    expect(a.statusCode).toBe(200);
    const standA = a.json() as { updatedAt: string; payload: { statement: string } };
    expect(standA.updatedAt).not.toBe(draft.updatedAt);
    // `expectedUpdatedAt` ist KEIN Entwurfsfeld — es darf nicht in die Nutzlast gelangen.
    expect((standA.payload as Record<string, unknown>).expectedUpdatedAt).toBeUndefined();

    const b = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers,
      payload: { statement: "Fassung B", expectedUpdatedAt: gesehenVonB },
    });
    expect(b.statusCode).toBe(409);
    expect(b.json()).toMatchObject({ error: "DRAFT_STALE", currentUpdatedAt: standA.updatedAt });
    expect(String(b.json().message)).toContain("neu laden");

    const jetzt = await app.inject({ method: "GET", url: `/api/drafts/${draft.id}`, headers });
    expect(jetzt.json().payload.statement).toBe("Fassung A"); // B hat nichts überschrieben
    await app.close();
  });

  it("GEGENPROBE: ohne `expectedUpdatedAt` bleibt der alte Weg — letzter Schreiber gewinnt (Mobil, Offline)", async () => {
    const { app, headers, draft } = await angemeldeteApp();
    await warte(5);
    await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers,
      payload: { statement: "Fassung A" },
    });
    const b = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers,
      payload: { statement: "Fassung B" },
    });
    expect(b.statusCode).toBe(200);
    expect(b.json().payload.statement).toBe("Fassung B");
    await app.close();
  });
});

describe("JOB 2684 D1 · POST /api/drafts/:id/promote mit gesehenem Stand — die teuerste Stelle", () => {
  it("Promote aus dem alten Tab → 409, KEIN Wissensobjekt, der Entwurf bleibt (Fassung A)", async () => {
    const { app, services, headers, draft } = await angemeldeteApp();
    const gesehenVonB = draft.updatedAt;
    await warte(5);
    await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers,
      payload: { statement: "Fassung A", expectedUpdatedAt: draft.updatedAt },
    });
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draft.id}/promote`,
      headers,
      payload: {
        draftPayload: { title: "Wartung der Presse", statement: "Fassung B" },
        expectedUpdatedAt: gesehenVonB,
      },
    });
    expect(promote.statusCode).toBe(409);
    expect(promote.json().error).toBe("DRAFT_STALE");
    expect(await services.ko.list()).toEqual([]); // nichts entstanden
    const noch = await app.inject({ method: "GET", url: `/api/drafts/${draft.id}`, headers });
    expect(noch.statusCode).toBe(200);
    expect(noch.json().payload.statement).toBe("Fassung A");
    await app.close();
  });

  it("Promote OHNE Nutzlast, aber mit altem Stand → ebenfalls 409 (requireFresh)", async () => {
    const { app, services, headers, draft } = await angemeldeteApp();
    const gesehenVonB = draft.updatedAt;
    await warte(5);
    await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers,
      payload: { statement: "Fassung A" },
    });
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draft.id}/promote`,
      headers,
      payload: { expectedUpdatedAt: gesehenVonB },
    });
    expect(promote.statusCode).toBe(409);
    expect(await services.ko.list()).toEqual([]);
    await app.close();
  });

  it("Promote mit dem AKTUELLEN Stand → 201, das Wissensobjekt trägt die aktuelle Fassung", async () => {
    const { app, headers, draft } = await angemeldeteApp();
    await warte(5);
    const a = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers,
      payload: { statement: "Fassung A", expectedUpdatedAt: draft.updatedAt },
    });
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draft.id}/promote`,
      headers,
      payload: {
        // Die vier KO-Pflichtfelder (service.ts:69) — wie die Vordertür sie sendet.
        draftPayload: {
          title: "Wartung der Presse",
          statement: "Fassung A, eingereicht",
          type: "best_practice",
          category: "Allgemein",
        },
        expectedUpdatedAt: a.json().updatedAt,
      },
    });
    expect(promote.statusCode, promote.body).toBe(201);
    expect(promote.json().statement).toBe("Fassung A, eingereicht");
    await app.close();
  });
});
