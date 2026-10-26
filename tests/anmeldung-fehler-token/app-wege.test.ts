import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { stelleZugangsmarkeAus } from "../../services/app/src/office-wopi";
import { AccountLoginDelay } from "../../services/auth/src/rate-limit";
import {
  InMemoryPasswordResetRepo,
  InMemorySessionRepo,
  InMemoryUserRepo,
} from "../../services/auth/src/repo";
import { AuthService } from "../../services/auth/src/service";

const password = "synthetisch-passwort-123";
const users = new InMemoryUserRepo();
const resetTokens = new InMemoryPasswordResetRepo();
const wait = vi.fn(async (_ms: number) => {});
const auth = new AuthService({
  users,
  sessions: new InMemorySessionRepo(),
  resetTokens,
  loginDelay: new AccountLoginDelay({ wait, planen: () => {} }),
});
const services = buildServices();
services.auth = auth;
const mail = vi.spyOn(services.mailer, "send").mockResolvedValue(undefined);
let app: FastifyInstance;
let admin: { id: string; token: string };
let sequence = 0;
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
const call = (
  url: string,
  body: unknown,
  token?: string,
  method: "POST" | "PUT" = "POST",
  remoteAddress?: string,
) =>
  app.inject({
    method,
    url,
    payload: JSON.stringify(body),
    headers: { "content-type": "application/json", ...(token ? bearer(token) : {}) },
    ...(remoteAddress ? { remoteAddress } : {}),
  });

async function user(role = "controller") {
  const email = `u${++sequence}@example.test`;
  const created = await call(
    "/api/users",
    { name: "Synthetisch", email, password, role },
    admin.token,
  );
  expect(created.statusCode, created.body).toBe(201);
  const login = await call("/api/auth/login", { email, password });
  expect(login.statusCode, login.body).toBe(200);
  return { id: created.json().id as string, email, token: login.json().token as string };
}
const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const bytes = Buffer.from("PK synthetischer WOPI-Dateiinhalt");
async function article(confidentiality: "intern" | "vertraulich" | "streng_vertraulich") {
  const object = await services.objects.put({
    name: "Beleg.docx",
    mime,
    data: `data:${mime};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
  });
  const ko = await services.ko.create({
    title: "Synthetischer Artikel",
    statement: "Beleg",
    type: "best_practice",
    category: "Beleg",
    author: admin.id,
    confidentiality,
  });
  const attached = await services.ko.addAttachment(ko.id, admin.id, {
    name: "Beleg.docx",
    mime,
    objectId: object.id,
    size: object.size,
  });
  const attachment = attached.attachments?.[0];
  if (!attachment) throw new Error("Fixture fehlt");
  return { id: attached.id, attachmentId: attachment.id, version: attached.version ?? 1 };
}
function wopiUrl(
  a: Awaited<ReturnType<typeof article>>,
  userId: string,
  schreiben = false,
  contents = false,
) {
  const marke = stelleZugangsmarkeAus(
    { koId: a.id, anhangId: a.attachmentId, nutzerId: userId, schreiben, fassung: a.version },
    Buffer.from("0f".repeat(32), "hex"),
    Date.now(),
  ).marke;
  return `/wopi/files/${a.attachmentId}${contents ? "/contents" : ""}?access_token=${encodeURIComponent(marke)}`;
}
beforeAll(async () => {
  vi.stubEnv("KLARWERK_OFFICE_EDITOR_URL", "https://editor.example.invalid");
  vi.stubEnv("APP_BASE_URL", "https://app.example.invalid");
  vi.stubEnv("KLARWERK_WOPI_SCHLUESSEL", "0f".repeat(32));
  app = buildApp(services);
  await app.ready();
  const setup = await call("/api/auth/setup", {
    name: "Admin",
    email: "admin@example.test",
    password,
  });
  expect(setup.statusCode, setup.body).toBe(201);
  admin = { id: setup.json().user.id, token: setup.json().token };
});
afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});

describe("W4.3 strenge Rümpfe an den echten App-Routen", () => {
  it.each([
    ["/api/auth/login", { email: 5, password: "x" }],
    ["/api/auth/forgot", { email: [] }],
    ["/api/auth/reset", { token: {}, newPassword: password }],
    ["/api/auth/setup", { name: 5, email: "x@example.test", password }],
    ["/api/auth/oidc", { code: 5, state: {} }],
    ["/api/auth/password", { oldPassword: [], newPassword: password }],
    ["/api/auth/users/target/reset", { password: {} }],
    ["/api/users/target", null],
  ])("%s lehnt Null/Array/Primitive und falsche Feldtypen kontrolliert ab", async (url, wrong) => {
    const protectedRoute = url === "/api/auth/password" || url.includes("/users/");
    const method = url.startsWith("/api/users/") ? "PUT" : "POST";
    for (const body of [null, [], 5, "Text", wrong]) {
      const res = await call(url, body, protectedRoute ? admin.token : undefined, method);
      expect(res.statusCode, `${url}: ${res.body}`).toBe(400);
      expect(res.json().error).toBe("BAD_REQUEST");
      expect(res.body).not.toMatch(/TypeError|Cannot read|trim is not|undefined|passwordHash/);
    }
    const missing = await app.inject({
      method,
      url,
      ...(protectedRoute ? { headers: bearer(admin.token) } : {}),
    });
    expect(missing.statusCode, missing.body).toBe(400);
  });
  it("geschützte Auth-Routen behalten401/403 vor der Rumpfauswertung", async () => {
    const viewer = await user("viewer");
    for (const [method, url] of [
      ["POST", "/api/auth/password"],
      ["POST", "/api/auth/users/x/reset"],
      ["PUT", "/api/users/x"],
    ] as const) {
      expect((await app.inject({ method, url })).statusCode).toBe(401);
      if (url !== "/api/auth/password") {
        expect((await app.inject({ method, url, headers: bearer(viewer.token) })).statusCode).toBe(
          403,
        );
      }
    }
  });
  it("Login und bekannte Domänenfehler bleiben benutzbar", async () => {
    const good = await call("/api/auth/login", { email: "admin@example.test", password });
    expect(good.statusCode).toBe(200);
    expect(good.json().token).toBeTruthy();
    expect(
      (await call("/api/auth/login", { email: "admin@example.test", password: "falsch" }))
        .statusCode,
    ).toBe(401);
    expect(
      (await call("/api/auth/reset", { token: "unbekannt", newPassword: password })).statusCode,
    ).toBe(401);
    expect(
      (
        await call(
          "/api/auth/password",
          { oldPassword: "falsch", newPassword: password },
          admin.token,
        )
      ).statusCode,
    ).toBe(401);
  });
  it("POSTkos lehnt falsche Formen vor jeder Anlage ab und behält gültige optionale Felder", async () => {
    const before = (await services.ko.list()).length;
    const valid = {
      title: "Titel",
      statement: "",
      type: "best_practice",
      category: "Beleg",
      confidentiality: "intern",
      bodyHtml: "<p>Gültiger Rumpf</p>",
      conditions: ["Bedingung"],
      measures: ["Maßnahme"],
      tags: ["Tag"],
      assets: null,
      domain: null,
      neededValidations: 1,
    };
    for (const body of [
      null,
      [],
      5,
      {},
      { ...valid, statement: 5 },
      { ...valid, bodyHtml: {} },
      { ...valid, tags: [5] },
      { ...valid, reviewerIds: "alle" },
      { ...valid, confidence: "hoch" },
    ]) {
      const res = await call("/api/kos", body, admin.token);
      expect(res.statusCode, res.body).toBe(400);
      expect(res.json().error).toBe("BAD_REQUEST");
    }
    expect((await services.ko.list()).length).toBe(before);
    const created = await call("/api/kos", valid, admin.token);
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toMatchObject({
      title: valid.title,
      tags: valid.tags,
      conditions: valid.conditions,
      measures: valid.measures,
    });
    expect(created.json().statement).toContain("Gültiger Rumpf");
    const unknown = await call("/api/kos", { ...valid, type: "unbekannt" }, admin.token);
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json().error).toBe("INVALID_TYPE");
    expect((await app.inject({ method: "POST", url: "/api/kos" })).statusCode).toBe(401);
  });
});

describe("W4.3 echte App: IP-Wechsel, SSO und Reset", () => {
  it("verteilt geratene Passwörter werden verzögert; richtiges Passwort und andere Konten bleiben möglich", async () => {
    const target = await user();
    const other = await user();
    wait.mockClear();
    for (let i = 0; i < 9; i++) {
      const res = await call(
        "/api/auth/login",
        { email: target.email, password: "falsch" },
        undefined,
        "POST",
        `192.0.2.${i + 1}`,
      );
      expect(res.statusCode, res.body).toBe(401);
    }
    expect(wait).toHaveBeenCalledTimes(6);
    const before = wait.mock.calls.length;
    expect(
      (
        await call(
          "/api/auth/login",
          { email: other.email, password },
          undefined,
          "POST",
          "198.51.100.1",
        )
      ).statusCode,
    ).toBe(200);
    expect(wait).toHaveBeenCalledTimes(before);
    const good = await call(
      "/api/auth/login",
      { email: target.email, password },
      undefined,
      "POST",
      "198.51.100.2",
    );
    expect(good.statusCode).toBe(200);
    expect(wait).toHaveBeenCalledTimes(before + 1);
    expect(wait.mock.calls.every(([ms]) => ms <= 1000)).toBe(true);
    await call(
      "/api/auth/login",
      { email: target.email, password },
      undefined,
      "POST",
      "198.51.100.3",
    );
    expect(wait).toHaveBeenCalledTimes(before + 1);
  });
  it("SSO-Forgot bleibt neutral ohne Mail, beide Admin-Passwortwege verweigern den Umbau", async () => {
    const claims = {
      iss: "https://idp.example.invalid",
      sub: "app-sso",
      email: "app-sso@example.test",
      name: "SSO",
      roles: ["ctrl"],
      rolesClaimPresent: true,
      emailVerified: true,
    };
    const sso = await auth.loginWithOidc(claims, true, "controller");
    mail.mockClear();
    for (const email of [claims.email, "nichtvorhanden@example.test"])
      expect((await call("/api/auth/forgot", { email })).statusCode).toBe(204);
    expect(mail).not.toHaveBeenCalled();
    expect(
      (await call(`/api/auth/users/${sso.user.id}/reset`, { password }, admin.token)).statusCode,
    ).toBe(403);
    expect(
      (
        await call(
          `/api/users/${sso.user.id}`,
          { password, name: "Darf nicht geändert sein" },
          admin.token,
          "PUT",
        )
      ).statusCode,
    ).toBe(403);
    expect((await users.findById(sso.user.id))?.name).toBe("SSO");
    expect((await users.findById(sso.user.id))?.passwordHash).toBe("");
    const next = await auth.loginWithOidc({ ...claims, roles: [] }, true, "viewer");
    expect(next.user.role).toBe("viewer");
    expect(
      (await app.inject({ method: "GET", url: "/api/auth/me", headers: bearer(sso.token) })).json()
        .role,
    ).toBe("viewer");
  });
  it("zwei echte Reset-Mails: zweiter Link erfolgreich, erster ungültig, gültige neue Sitzung", async () => {
    const target = await user();
    mail.mockClear();
    for (let i = 0; i < 2; i++)
      expect(
        (await call("/api/auth/forgot", { email: target.email }, undefined, "POST", "203.0.113.7"))
          .statusCode,
      ).toBe(204);
    expect(mail).toHaveBeenCalledTimes(2);
    const tokens = mail.mock.calls.map(([m]) => /token=([0-9a-f]+)/.exec(m.text)?.[1]);
    expect(tokens[0]).toBeTruthy();
    expect(tokens[1]).toBeTruthy();
    expect(
      (await call("/api/auth/reset", { token: tokens[1], newPassword: "neues-passwort-123" }))
        .statusCode,
    ).toBe(204);
    expect(
      (await call("/api/auth/reset", { token: tokens[0], newPassword: "angreifer-passwort-123" }))
        .statusCode,
    ).toBe(401);
    expect(
      (await call("/api/auth/login", { email: target.email, password: "neues-passwort-123" }))
        .statusCode,
    ).toBe(200);
    expect(
      (await call("/api/auth/login", { email: target.email, password: "angreifer-passwort-123" }))
        .statusCode,
    ).toBe(401);
  });
});

describe("W4.3 WOPI prüft den aktuellen Zugang an jeder vorhandenen Operation", () => {
  it("gültige Session und Marke lesen; Befristung entzieht Info/Download/Lock/Schreibwege", async () => {
    const target = await user();
    const a = await article("intern");
    const url = wopiUrl(a, target.id, true);
    const contentUrl = wopiUrl(a, target.id, true, true);
    expect(
      (await app.inject({ method: "GET", url: "/api/auth/me", headers: bearer(target.token) }))
        .statusCode,
    ).toBe(200);
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: contentUrl })).rawPayload.equals(bytes)).toBe(
      true,
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url,
          headers: { "x-wopi-override": "LOCK", "x-wopi-lock": "fixture" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call(
          `/api/users/${target.id}`,
          { accessExpiresAt: new Date(Date.now() - 1000).toISOString() },
          admin.token,
          "PUT",
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: "GET", url: "/api/auth/me", headers: bearer(target.token) }))
        .statusCode,
    ).toBe(401);
    for (const targetUrl of [url, contentUrl]) {
      const r = await app.inject({ method: "GET", url: targetUrl });
      expect(r.statusCode).toBe(404);
      expect(r.rawPayload.equals(bytes)).toBe(false);
    }
    for (const op of ["LOCK", "REFRESH_LOCK", "UNLOCK", "UNLOCK_AND_RELOCK", "GET_LOCK"]) {
      expect(
        (
          await app.inject({
            method: "POST",
            url,
            headers: {
              "x-wopi-override": op,
              "x-wopi-lock": "fixture",
              "x-wopi-oldlock": "fixture",
            },
          })
        ).statusCode,
      ).toBe(404);
    }
    expect(
      (
        await app.inject({
          method: "POST",
          url: contentUrl,
          payload: bytes,
          headers: { "content-type": "application/octet-stream", "x-wopi-lock": "fixture" },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await call(`/api/users/${target.id}`, { accessExpiresAt: null }, admin.token, "PUT"))
        .statusCode,
    ).toBe(200);
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(200);
  });
  it("aktuelles niedriges Niveau sperrt, hohes Niveau erlaubt App und WOPI", async () => {
    const target = await user();
    const a = await article("vertraulich");
    const url = wopiUrl(a, target.id);
    const contents = wopiUrl(a, target.id, false, true);
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(200);
    await call(`/api/users/${target.id}`, { freigabe: "intern" }, admin.token, "PUT");
    expect(
      (await app.inject({ method: "GET", url: `/api/kos/${a.id}`, headers: bearer(target.token) }))
        .statusCode,
    ).toBe(404);
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: contents })).statusCode).toBe(404);
    await call(`/api/users/${target.id}`, { freigabe: "streng_vertraulich" }, admin.token, "PUT");
    const high = await article("streng_vertraulich");
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/kos/${high.id}`,
          headers: bearer(target.token),
        })
      ).statusCode,
    ).toBe(200);
    expect((await app.inject({ method: "GET", url: wopiUrl(high, target.id) })).statusCode).toBe(
      200,
    );
    expect(
      (
        await app.inject({ method: "GET", url: wopiUrl(high, target.id, false, true) })
      ).rawPayload.equals(bytes),
    ).toBe(true);
  });
});
