import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// FUNKE F1/F2 (nacht24 Paket 6) am HTTP-Rand: GET /api/me/impact liefert die persönlichen
// Wirkungs-Zähler (nur eigene Beiträge, nur Zahlen), und das „Danke" (POST /api/ask/helpful)
// ist über die ECHTE Route idempotent je Nutzer+Ziel.
describe("FUNKE: /api/me/impact + idempotentes Danke (HTTP end-to-end)", () => {
  async function setup() {
    const services = buildServices();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Anna Autor", email: "anna@x.de", password: "secret123" },
    });
    const annaLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "anna@x.de", password: "secret123" },
    });
    const anna = {
      headers: { authorization: `Bearer ${annaLogin.json().token}` },
      id: annaLogin.json().user.id as string,
    };
    // Zweiter Nutzer (Leser), vom Admin angelegt — dankt Annas Beitrag.
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: anna.headers,
      payload: { name: "Vera", email: "vera@x.de", password: "secret123", role: "viewer" },
    });
    const veraLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "vera@x.de", password: "secret123" },
    });
    const vera = { headers: { authorization: `Bearer ${veraLogin.json().token}` } };
    const ko = await services.ko.create({
      title: "Pumpe entlüften",
      statement: "Vor dem Start entlüften.",
      type: "best_practice",
      category: "Pumpen",
      author: anna.id,
      tags: [],
    });
    return { app, services, anna, vera, koId: ko.id };
  }

  // FUNKE-FIX P0 (bens ROT-1): das „Danke" verlangt den Answer-Receipt aus einem echten
  // Antwortvorgang. Wir stellen die Frage passend zum KO, damit die Antwort GENAU dieses KO als
  // Quelle ausliefert, und reichen den zurückgegebenen Receipt beim „Danke" zurück.
  async function receiptFor(
    app: Awaited<ReturnType<typeof setup>>["app"],
    headers: Record<string, string>,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Pumpe entlüften vor dem Start" },
    });
    const body = res.json();
    expect(body.result.sources.length).toBeGreaterThan(0);
    return body.receipt as string;
  }

  it("ohne Belege ehrliche Nullen; eigener Beitrag zählt; Danke eines ANDEREN erscheint genau einmal", async () => {
    const { app, anna, vera, koId } = await setup();
    const before = await app.inject({
      method: "GET",
      url: "/api/me/impact",
      headers: anna.headers,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toEqual({
      contributions: 1,
      validated: 0,
      cited: 0,
      helpfulReceived: 0,
    });

    // FUNKE F2: Vera dankt — zweimal geklickt, zählt EINMAL (idempotent je Nutzer+Ziel).
    const veraReceipt = await receiptFor(app, vera.headers);
    const first = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers: vera.headers,
      payload: { koId, receipt: veraReceipt },
    });
    expect(first.statusCode).toBe(204);
    const second = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers: vera.headers,
      payload: { koId, receipt: veraReceipt },
    });
    expect(second.statusCode).toBe(204);

    const after = await app.inject({ method: "GET", url: "/api/me/impact", headers: anna.headers });
    expect(after.json().helpfulReceived).toBe(1);
    // Annas EIGENER Klick auf ihr KO zählt nicht in die eigene Wirkung.
    await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers: anna.headers,
      payload: { koId, receipt: await receiptFor(app, anna.headers) },
    });
    const still = await app.inject({ method: "GET", url: "/api/me/impact", headers: anna.headers });
    expect(still.json().helpfulReceived).toBe(1);
  });

  it("ohne Anmeldung: 401 — die Wirkung ist nie offen", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/me/impact" });
    expect(res.statusCode).toBe(401);
  });

  // FUNKE-FIX P0 (bens ROT-1) am HTTP-Rand: ein „Danke" ohne gültigen, dieses KO belegenden
  // Answer-Receipt ist NICHT wirksam — die früher frei wählbare KO-ID ist zu (403), und die Wirkung
  // des Autors bleibt bei 0.
  it("unbelegte/fremd gewählte KO-ID → 403, keine Wirkung erzeugt", async () => {
    const { app, anna, vera, koId } = await setup();
    // (a) gar kein Receipt.
    const noReceipt = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers: vera.headers,
      payload: { koId },
    });
    expect(noReceipt.statusCode).toBe(403);
    // (b) gültiger Receipt aus einem echten Vorgang, aber für ein NICHT ausgeliefertes KO.
    const receipt = await receiptFor(app, vera.headers);
    const wrongKo = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers: vera.headers,
      payload: { koId: "fremdes-ko", receipt },
    });
    expect(wrongKo.statusCode).toBe(403);
    // Autor sieht keinerlei Wirkung — nichts wurde wirksam.
    const impact = await app.inject({
      method: "GET",
      url: "/api/me/impact",
      headers: anna.headers,
    });
    expect(impact.json().helpfulReceived).toBe(0);
  });
});
