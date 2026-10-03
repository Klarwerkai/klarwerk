// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg`, Runde 2 (Bens Befund BEN-3) — R-1560, „Neue 1.126-Matrix
// R0633: sechs ungültige Werte 400, drei gültige erhalten; fehlendes Feld weiterhin 201".
// ================================================================================================
//
// Die Quelle hält eine an 1.126 gemessene Matrix fest. Im Repository stand dafür kein Test; hier
// wird sie am heutigen Stand wiederholt, an der echten Anwendung über `app.inject` (kein Socket,
// keine Datenbank): Anlage (POST) und Aktualisierung (PUT) eines Entwurfs, danach der Abruf.
// Gültig sind genau die Stufen des Moduls knowledge-object (`CONFIDENTIALITY_LEVELS`).
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { CONFIDENTIALITY_LEVELS } from "../../services/knowledge-object/src/confidentiality";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

interface Res {
  statusCode: number;
  body: string;
}
type App = { inject: (o: Record<string, unknown>) => Promise<Res> };

let app: App;
let token = "";

beforeEach(async () => {
  app = buildApp(buildServices()) as unknown as App;
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@stufen.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@stufen.test", password: "geheim12345" },
  });
  token = (JSON.parse(login.body) as { token: string }).token;
});

function senden(method: "POST" | "PUT", url: string, payload: unknown): Promise<Res> {
  return app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    payload: JSON.stringify(payload),
  });
}

async function nutzlast(id: string): Promise<Record<string, unknown>> {
  const res = await app.inject({
    method: "GET",
    url: `/api/drafts/${id}`,
    headers: { authorization: `Bearer ${token}` },
  });
  return (JSON.parse(res.body) as { payload: Record<string, unknown> }).payload;
}

async function anzahlEntwuerfe(): Promise<number> {
  const res = await app.inject({
    method: "GET",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${token}` },
  });
  const daten = JSON.parse(res.body) as unknown;
  return (Array.isArray(daten) ? daten : ((daten as { items?: unknown[] }).items ?? [])).length;
}

const UNGUELTIG: readonly unknown[] = ["geheim", "", "INTERN", 5, null, ["intern"]];
const BASIS = { title: "Pumpe entlüften", bodyHtml: "<p>Erst absperren.</p>" };

describe("R-1560 · R0633-Matrix der Stufenwerte am Entwurf", () => {
  it("S0 · die Matrix hat die gemessene Gestalt: sechs ungültige, drei gültige Werte", () => {
    expect(UNGUELTIG).toHaveLength(6);
    expect(CONFIDENTIALITY_LEVELS).toHaveLength(3);
  });

  for (const wert of UNGUELTIG) {
    it(`S1 · ungültig ${JSON.stringify(wert)}: POST 400, kein Entwurf; PUT 400, Stufe unverändert`, async () => {
      const anlage = await senden("POST", "/api/drafts", { ...BASIS, confidentiality: wert });
      expect(anlage.statusCode, anlage.body.slice(0, 200)).toBe(400);
      expect(await anzahlEntwuerfe()).toBe(0);

      const gut = await senden("POST", "/api/drafts", { ...BASIS, confidentiality: "vertraulich" });
      expect(gut.statusCode).toBe(201);
      const id = (JSON.parse(gut.body) as { id: string }).id;
      const aenderung = await senden("PUT", `/api/drafts/${id}`, {
        ...BASIS,
        confidentiality: wert,
      });
      expect(aenderung.statusCode, aenderung.body.slice(0, 200)).toBe(400);
      expect((await nutzlast(id)).confidentiality).toBe("vertraulich");
    });
  }

  for (const stufe of CONFIDENTIALITY_LEVELS) {
    it(`S2 · gültig „${stufe}“: POST 201 und die Stufe steht danach am Entwurf`, async () => {
      const anlage = await senden("POST", "/api/drafts", { ...BASIS, confidentiality: stufe });
      expect(anlage.statusCode, anlage.body.slice(0, 200)).toBe(201);
      const id = (JSON.parse(anlage.body) as { id: string }).id;
      expect((await nutzlast(id)).confidentiality).toBe(stufe);
    });
  }

  it("S3 · fehlendes Feld: POST 201, und die Nutzlast trägt KEINE erfundene Stufe", async () => {
    const anlage = await senden("POST", "/api/drafts", BASIS);
    expect(anlage.statusCode, anlage.body.slice(0, 200)).toBe(201);
    const id = (JSON.parse(anlage.body) as { id: string }).id;
    expect(Object.hasOwn(await nutzlast(id), "confidentiality")).toBe(false);
  });
});
