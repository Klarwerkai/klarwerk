import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";

// R-1663 / R-2178 (aufnahme:20260922:gesamt-expertensuche) — `GET /api/gaps/:id/ansprechpartner`
// am Draht der vollständigen App. Gemessen werden die Grenzen, die die Route verspricht:
//   R1  ohne Schalter gibt es die Route nicht (404 vor dem Rechtetor) — Personen-Matching bleibt bis
//       zur BR/DSB-Freigabe unsichtbar,
//   R2  mit Schalter, ohne Sitzung → 401,
//   R3  mit Schalter und `ko.assign` → begründete Vorschläge aus den Wissensspuren der Frage,
//       ohne den Fragetext, mit der ähnlichen geschlossenen Lücke als eigener Spur,
//   R4  vertrauliches Wissen begründet keinen Vorschlag,
//   R5  unbekannte Lücke → 404.

const FLAG = "KLARWERK_EXPERT_MATCHING";
let savedFlag: string | undefined;
let savedKeychain: string | undefined;

beforeEach(() => {
  savedFlag = process.env[FLAG];
  savedKeychain = process.env.KLARWERK_SKIP_KEYCHAIN;
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  delete process.env[FLAG];
});

afterEach(() => {
  if (savedFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = savedFlag;
  if (savedKeychain === undefined) delete process.env.KLARWERK_SKIP_KEYCHAIN;
  else process.env.KLARWERK_SKIP_KEYCHAIN = savedKeychain;
});

const FRAGE = "Wie entlüfte ich die Kühlmittelpumpe?";

async function buehne() {
  const repos = inMemoryRepos();
  const app = buildApp(assembleServices(repos));
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
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  const adminId = (me.json() as { id: string }).id;
  await repos.gaps.insert({
    id: "luecke-offen",
    question: FRAGE,
    status: "offen",
    assignee: null,
    priority: "mittel",
    createdAt: "2026-10-08T08:00:00.000Z",
  });
  await repos.gaps.insert({
    id: "luecke-alt",
    question: "Kühlmittelpumpe entlüften nach Wartung",
    status: "geschlossen",
    assignee: "konto-erik",
    priority: "mittel",
    createdAt: "2026-09-01T08:00:00.000Z",
  });
  return { app, headers, adminId };
}

async function legeKoAn(
  app: Awaited<ReturnType<typeof buehne>>["app"],
  headers: Record<string, string>,
  confidentiality: string,
  title: string,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality,
      title,
      statement: `${title} — Kühlmittelpumpe entlüften.`,
      type: "best_practice",
      category: "Wartung",
    },
  });
  expect(res.statusCode, res.body).toBeLessThan(300);
  return (res.json() as { id: string }).id;
}

const URL = "/api/gaps/luecke-offen/ansprechpartner";

describe("GET /api/gaps/:id/ansprechpartner (R-1663 / R-2178)", () => {
  it("R1: Schalter AUS → 404, auch für den Admin (Fläche gibt es nicht)", async () => {
    const { app, headers } = await buehne();
    const res = await app.inject({ method: "GET", url: URL, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("R2: Schalter AN, ohne Sitzung → 401", async () => {
    process.env[FLAG] = "1";
    const { app } = await buehne();
    const res = await app.inject({ method: "GET", url: URL });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("R3: Schalter AN + ko.assign → begründete Vorschläge, ohne Fragetext", async () => {
    process.env[FLAG] = "1";
    const { app, headers, adminId } = await buehne();
    const koId = await legeKoAn(app, headers, "intern", "Kühlmittelpumpe entlüften");
    const res = await app.inject({ method: "GET", url: URL, headers });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as {
      vorschlaege: {
        personId: string;
        spuren: Record<string, number>;
        objekte: { id: string; title: string }[];
      }[];
      grundlage: { objekte: number; aehnlicheLuecken: number };
    };
    const admin = body.vorschlaege.find((v) => v.personId === adminId);
    expect(admin?.spuren.originalautor, "der Originalautor des passenden Objekts").toBe(1);
    expect(admin?.objekte.map((o) => o.id)).toEqual([koId]);
    const erik = body.vorschlaege.find((v) => v.personId === "konto-erik");
    expect(erik?.spuren.aehnlicheLuecken, "die ähnliche, geschlossene Lücke").toBe(1);
    expect(body.grundlage).toEqual({ objekte: 1, aehnlicheLuecken: 1 });
    expect(res.body, "der Fragetext verlässt die Route nicht").not.toContain("entlüfte ich");
    await app.close();
  });

  it("R4: ein vertrauliches Objekt begründet keinen Vorschlag", async () => {
    process.env[FLAG] = "1";
    const { app, headers, adminId } = await buehne();
    await legeKoAn(app, headers, "vertraulich", "Kühlmittelpumpe entlüften (vertraulich)");
    const res = await app.inject({ method: "GET", url: URL, headers });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as {
      vorschlaege: { personId: string }[];
      grundlage: { objekte: number };
    };
    expect(body.vorschlaege.map((v) => v.personId)).not.toContain(adminId);
    expect(body.grundlage.objekte).toBe(0);
    expect(res.body).not.toContain("vertraulich)");
    await app.close();
  });

  it("R5: unbekannte Lücke → 404", async () => {
    process.env[FLAG] = "1";
    const { app, headers } = await buehne();
    const res = await app.inject({
      method: "GET",
      url: "/api/gaps/gibt-es-nicht/ansprechpartner",
      headers,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
