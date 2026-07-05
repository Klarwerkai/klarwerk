import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-234: Konflikt-Workflow über die ECHTEN HTTP-Routen absichern (kein Service-Direktaufruf).
// Anlegen via KO-Dispatcher (PUT /api/kos/:id {action:"conflict"}), Liste/Detail via /api/conflicts,
// Zweitmeinung/Eskalation via /api/conflicts/:id/*, Lösen via {action:"resolve-conflict"}.
describe("SCRUM-234: Konflikt-Workflow (HTTP end-to-end)", () => {
  async function adminApp() {
    const app = buildApp(buildServices());
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
    // Demo-Seed liefert echte, validierte KOs als koA/koB-Bezug.
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
    const ids = kos.json().map((k: { id: string }) => k.id) as string[];
    return { app, headers, koA: ids[0] as string, koB: ids[1] as string };
  }

  async function createConflict(
    app: Awaited<ReturnType<typeof adminApp>>["app"],
    headers: Record<string, string>,
    koA: string,
    koB: string,
    type: string,
  ) {
    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers,
      payload: {
        action: "conflict",
        conflict: { koA, koB, type, description: `Konflikt ${type}` },
      },
    });
    return res;
  }

  it("anlegen → Liste → Zweitmeinung → lösen, Status je Schritt im GET verifiziert", async () => {
    const { app, headers, koA, koB } = await adminApp();

    // 1) Konflikt anlegen (über den KO-Dispatcher) → 201, Status offen.
    const created = await createConflict(app, headers, koA, koB, "truth");
    expect(created.statusCode).toBe(201);
    const conflict = created.json();
    expect(conflict.status).toBe("offen");
    const id = conflict.id as string;

    // 2) Konflikt erscheint in der Liste der ungelösten Konflikte.
    const list = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((c: { id: string }) => c.id === id)).toBe(true);

    // 3) Zweitmeinung → Status zweitmeinung, Opinion gesetzt; im GET verifiziert.
    const opinion = await app.inject({
      method: "POST",
      url: `/api/conflicts/${id}/second-opinion`,
      headers,
      payload: { opinion: "Beide Quellen prüfen lassen." },
    });
    expect(opinion.statusCode).toBe(200);
    expect(opinion.json().status).toBe("zweitmeinung");

    const afterOpinion = await app.inject({
      method: "GET",
      url: `/api/conflicts/${id}`,
      headers,
    });
    expect(afterOpinion.json().status).toBe("zweitmeinung");
    expect(afterOpinion.json().secondOpinion).toBe("Beide Quellen prüfen lassen.");

    // 4) Lösen (über den KO-Dispatcher) → Status geloest, Entscheidung gesetzt.
    const resolved = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers,
      payload: { action: "resolve-conflict", conflictId: id, decision: "KO A gilt." },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().status).toBe("geloest");

    // 5) GET bestätigt den gelösten Status und die Entscheidung.
    const afterResolve = await app.inject({
      method: "GET",
      url: `/api/conflicts/${id}`,
      headers,
    });
    expect(afterResolve.json().status).toBe("geloest");
    expect(afterResolve.json().decision).toBe("KO A gilt.");

    // 6) Gelöste Konflikte fallen aus der Liste der ungelösten Konflikte heraus.
    const listAfter = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(listAfter.json().some((c: { id: string }) => c.id === id)).toBe(false);
  });

  it("Eskalation: Wahrheitskonflikt eskaliert, Nicht-Wahrheitskonflikt wird abgelehnt", async () => {
    const { app, headers, koA, koB } = await adminApp();

    // Wahrheitskonflikt → eskaliert.
    const truth = (await createConflict(app, headers, koA, koB, "truth")).json();
    const esc = await app.inject({
      method: "POST",
      url: `/api/conflicts/${truth.id}/escalate`,
      headers,
    });
    expect(esc.statusCode).toBe(200);
    expect(esc.json().status).toBe("eskaliert");

    // Kontextkonflikt → nicht eskalierbar (FR-CON-02), ehrlicher Fehler.
    const context = (await createConflict(app, headers, koA, koB, "context")).json();
    const escContext = await app.inject({
      method: "POST",
      url: `/api/conflicts/${context.id}/escalate`,
      headers,
    });
    expect(escContext.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("Fehlalarm (dismiss) schließt einen Konflikt und nimmt ihn aus der offenen Liste", async () => {
    const { app, headers, koA, koB } = await adminApp();
    // Berater-Konzept 04.07. (Stufe 4b): „Fehlalarm — kein Widerspruch" schließt einen (meist
    // automatisch erkannten) Konflikt bewusst als falsch-positiv. Hier über einen manuell angelegten.
    const created = (await createConflict(app, headers, koA, koB, "context")).json();
    const id = created.id as string;

    const dismissed = await app.inject({
      method: "POST",
      url: `/api/conflicts/${id}/dismiss`,
      headers,
      payload: { note: "Kein echter Widerspruch." },
    });
    expect(dismissed.statusCode).toBe(200);
    expect(dismissed.json().status).toBe("geloest");

    const list = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(list.json().some((c: { id: string }) => c.id === id)).toBe(false);
  });

  it("anonym → Konfliktliste ist geschützt (Guard greift)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "GET", url: "/api/conflicts" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
