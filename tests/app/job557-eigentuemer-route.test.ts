// ================================================================================================
// JOB 557 · D7 — DER PRODUKTIVE EIGENTUMSGEBER, AM ECHTEN DRAHT.
// ================================================================================================
//
// BENs schärfster Mangel an D6: „Kein produktiver Eigentumsgeber. Öffentliche Route und alle
// übrigen realen Aufrufer setzen das Aggregat nicht; ohne autorisierte Schreib-/Änderungsoperation
// bleibt die Produktwirkung beim Autor-Fallback." Genau das prüft diese Datei — nicht am Dienst,
// sondern über HTTP, mit echten Anmeldungen und echten Rollen.
//
// DIE ENTSCHEIDENDE UNTERSCHEIDUNG: `ko.create` hat in diesem System jeder Experte. Wer damit das
// Eigentum setzen dürfte, könnte die Nacharbeit eines FREMDEN Menschen erklären. Der Zweig verlangt
// deshalb `ko.validate` — und dieser Test belegt beide Seiten: die erlaubte Vergabe UND die
// verworfene.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const EIGENTUEMERIN = "eva-eigentuemerin";

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job557.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@job557.test", "geheim12345");
  for (const [email, role] of [
    ["experte@job557.test", "experte"],
    ["controller@job557.test", "controller"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} (${role}) nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    experte: await login(app, "experte@job557.test", "geheim12345"),
    controller: await login(app, "controller@job557.test", "geheim12345"),
  };
}

async function legeKoAn(app: App, wer: Auth, extra: Record<string, unknown> = {}): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer,
    payload: { title: "Ventilprüfung", type: "technik", statement: "Jährlich prüfen.", ...extra },
  });
  if (created.statusCode !== 201) {
    throw new Error(`KO nicht angelegt: ${created.statusCode} ${created.body}`);
  }
  return created.json().id;
}

async function lies(app: App, wer: Auth, id: string) {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: wer });
  expect(res.statusCode).toBe(200);
  return res.json() as { ownership?: { owner?: string }; assignments?: string[] };
}

describe("JOB 557 D7 · autorisierte Eigentumsvergabe über die KO-Route", () => {
  it("A1 · eine Identität MIT `ko.validate` darf die Verantwortung benennen", async () => {
    const { app, experte, controller } = await setup();
    const id = await legeKoAn(app, experte);

    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: controller,
      payload: { action: "ownership", ownership: { owner: EIGENTUEMERIN } },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ownership).toEqual({
      owner: EIGENTUEMERIN,
      reviewers: [],
      validators: [],
    });
    // Und es steht wirklich am Bestand, nicht nur in der Antwort.
    expect((await lies(app, controller, id)).ownership?.owner).toBe(EIGENTUEMERIN);
  });

  it("A2 · eine Identität OHNE `ko.validate` wird abgewiesen — und ändert nichts", async () => {
    const { app, experte, controller } = await setup();
    const id = await legeKoAn(app, experte);

    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: experte,
      payload: { action: "ownership", ownership: { owner: EIGENTUEMERIN } },
    });

    expect(
      res.statusCode,
      "ein Experte darf sein eigenes Objekt bearbeiten — aber nicht bestimmen, wer fremde Nacharbeit bekommt",
    ).toBe(403);
    expect((await lies(app, controller, id)).ownership).toBeUndefined();
  });

  it("A3 · der Anlegeweg VERWIRFT ein mitgeschicktes Aggregat (kein Clientspread)", async () => {
    const { app, experte, controller } = await setup();
    // Der Experte legt an und versucht, die Verantwortung gleich mitzuliefern.
    const id = await legeKoAn(app, experte, { ownership: { owner: EIGENTUEMERIN } });
    expect(
      (await lies(app, controller, id)).ownership,
      "das Feld ist über den Spread der öffentlichen Route in den Bestand gelangt",
    ).toBeUndefined();
  });

  it("A4 · eine unbrauchbare Angabe wird abgelehnt, statt still zu löschen", async () => {
    const { app, experte, controller } = await setup();
    const id = await legeKoAn(app, experte);
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: controller,
      payload: { action: "ownership", ownership: { owner: EIGENTUEMERIN } },
    });

    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: controller,
      payload: { action: "ownership", ownership: { owner: "   " } },
    });

    expect(res.statusCode).toBe(400);
    // Der vorherige Stand steht unverändert — ein Tippfehler ist kein Löschvorgang.
    expect((await lies(app, controller, id)).ownership?.owner).toBe(EIGENTUEMERIN);
  });

  // ── DIE WIRKUNG, über dieselbe Tür wie ein Mensch sie ginge ───────────────────────────────────

  it("A5 · nach der Vergabe geht die Nacharbeit an die EIGENTUEMERIN, nicht an die Autorin", async () => {
    const { app, experte, controller } = await setup();
    const id = await legeKoAn(app, experte);
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: controller,
      payload: { action: "ownership", ownership: { owner: EIGENTUEMERIN } },
    });

    const bewertet = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: controller,
      payload: { action: "rate", verdict: "warn" },
    });
    expect(bewertet.statusCode).toBe(200);

    // Das Board reichert `assignments` mit den OFFENEN Zuweisungen an — dort steht, wer die
    // Nacharbeit hat.
    const board = await app.inject({
      method: "GET",
      url: "/api/validation/board",
      headers: controller,
    });
    expect(board.statusCode).toBe(200);
    const eintrag = (board.json() as { id: string; assignments?: string[] }[]).find(
      (k) => k.id === id,
    );
    expect(eintrag?.assignments, "die Nacharbeit erscheint bei niemandem").toBeTruthy();
    expect(eintrag?.assignments).toContain(EIGENTUEMERIN);
  });

  it("A6 · KALIBRIERUNG: ohne Vergabe geht sie weiterhin an die Autorin (Altbestand)", async () => {
    const { app, experte, controller } = await setup();
    const id = await legeKoAn(app, experte);
    const autorId = (await lies(app, controller, id)) as unknown as { author: string };

    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: controller,
      payload: { action: "rate", verdict: "warn" },
    });

    const board = await app.inject({
      method: "GET",
      url: "/api/validation/board",
      headers: controller,
    });
    const eintrag = (board.json() as { id: string; assignments?: string[] }[]).find(
      (k) => k.id === id,
    );
    expect(eintrag?.assignments).toContain(autorId.author);
  });

  it("A7 · eine echte Prüfzuweisung schreibt die Prüferin im Aggregat fort", async () => {
    const { app, experte, controller } = await setup();
    const id = await legeKoAn(app, experte);

    const zugewiesen = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: controller,
      payload: { action: "assign", userIds: ["paula-prueferin"] },
    });
    expect(zugewiesen.statusCode).toBe(204);

    const nachher = await lies(app, controller, id);
    expect(nachher.ownership).toEqual({
      reviewers: ["paula-prueferin"],
      validators: [],
    });
    // Und aus der Zuweisung ist KEIN Eigentum entstanden.
    expect(nachher.ownership?.owner).toBeUndefined();
  });
});
