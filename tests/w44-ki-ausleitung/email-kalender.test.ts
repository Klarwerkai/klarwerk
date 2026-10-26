import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { buildDevPersistServices } from "../../services/app/src/dev-persist";
import { kalenderAnbieterAusEnv } from "../../services/app/src/klara-kalender-m365";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { PgPasswordResetRepo } from "../../services/auth/src/repo-pg";
import { AuthService } from "../../services/auth/src/service";
import { ConsoleMailer } from "../../services/notifications";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const pw = "Fiktiv-geheim-123";
describe("W4.4 Kalenderkonto und neue Mailadresse", () => {
  it("weist ohne versandfähigen Mailer ehrlich ab; eine Konsole bestätigt keinen Adressbesitz", async () => {
    vi.stubEnv("APP_BASE_URL", "https://klarwerk.attrappe.test");
    const s = buildServices();
    const mailer = new ConsoleMailer();
    s.mailer = mailer;
    const send = vi.spyOn(mailer, "send");
    const u = await s.auth.register({ name: "Ada", email: "a@attrappe.test", password: pw });
    const login = await s.auth.login({ email: u.email, password: pw });
    const app = buildApp(s);
    try {
      const r = await app.inject({
        method: "PUT",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${login.token}` },
        payload: { email: "neue@attrappe.test", currentPassword: pw },
      });
      expect(r.statusCode, r.body).toBe(403);
      expect(send).not.toHaveBeenCalled();
      expect((await s.auth.authenticate(login.token))?.email).toBe("a@attrappe.test");
    } finally {
      await app.close();
    }
  });

  it("bindet den wirklichen App-Kalender an IDs; die bestätigte freie Altlistenadresse erteilt kein Recht", async () => {
    vi.stubEnv("APP_BASE_URL", "https://klarwerk.attrappe.test");
    vi.stubEnv("KLARWERK_LOG_LEVEL", "silent");
    const services = buildServices();
    const mails: { to: string; text: string }[] = [];
    services.mailer = {
      send: async (m) => {
        mails.push(m);
      },
    };
    const admin = await services.auth.register({
      name: "Ada",
      email: "ada@attrappe.test",
      password: pw,
    });
    const bert = await services.auth.register({
      name: "Bert",
      email: "bert@attrappe.test",
      password: pw,
    });
    await services.auth.approveUser(bert.id, admin.id);
    const a = await services.auth.login({ email: "ada@attrappe.test", password: pw });
    const b = await services.auth.login({ email: "bert@attrappe.test", password: pw });
    vi.stubEnv("KLARWERK_KALENDER_M365_BASE_URL", "https://graph.attrappe.test/v1.0");
    vi.stubEnv("KLARWERK_KALENDER_M365_TOKEN", "nur-fiktiv");
    vi.stubEnv("KLARWERK_KALENDER_M365_KONTO_IDS", admin.id);
    vi.stubEnv("KLARWERK_KALENDER_M365_KONTEN", "vorstand@attrappe.test");
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: unknown) => {
      const path = String(url);
      calls.push(path);
      return new Response(
        JSON.stringify(
          path.includes("/me/calendars")
            ? {
                value: [
                  {
                    id: "kal",
                    name: "ID-Kalender",
                    canEdit: true,
                    owner: { address: "ada@attrappe.test" },
                  },
                ],
              }
            : { id: "graph-A", displayName: "Ada", mail: "ada@attrappe.test" },
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const app = buildApp(services);
    const headers = (token: string) => ({ authorization: `Bearer ${token}` });
    const cal = (token: string) =>
      app.inject({ method: "GET", url: "/api/me/klara/kalender", headers: headers(token) });
    try {
      expect((await cal(a.token)).json().auswahl.verbunden).toBe(true);
      expect(calls.length).toBeGreaterThan(0);
      calls.length = 0;
      expect((await cal(b.token)).json().auswahl.verbunden).toBe(false);
      expect(calls).toHaveLength(0);
      const pending = await app.inject({
        method: "PUT",
        url: "/api/auth/me",
        headers: headers(b.token),
        payload: { name: "Bert Neu", email: "vorstand@attrappe.test", currentPassword: pw },
      });
      expect(pending.statusCode).toBe(202);
      expect(pending.json()).toMatchObject({
        id: bert.id,
        name: "Bert Neu",
        email: "bert@attrappe.test",
        emailChangePending: true,
        role: bert.role,
      });
      expect(pending.body).not.toMatch(/emailBestaetigung|https:|"token"/);
      expect(mails).toHaveLength(1);
      expect(mails[0]?.to).toBe("vorstand@attrappe.test");
      const link = new URL(mails[0]?.text.split("\n").at(-1) ?? "");
      const token = link.searchParams.get("emailBestaetigung");
      expect(token).toBeTruthy();
      expect(link.pathname).toBe("/profil");
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/auth/me/email/confirm",
            headers: headers(a.token),
            payload: { token },
          })
        ).statusCode,
      ).toBe(401);
      expect((await services.auth.authenticate(b.token))?.email).toBe("bert@attrappe.test");
      const confirmed = await app.inject({
        method: "POST",
        url: "/api/auth/me/email/confirm",
        headers: headers(b.token),
        payload: { token },
      });
      expect(confirmed.statusCode).toBe(200);
      expect(confirmed.json()).toMatchObject({
        id: bert.id,
        email: "vorstand@attrappe.test",
        role: bert.role,
        name: "Bert Neu",
      });
      expect((await services.auth.authenticate(b.token))?.id).toBe(bert.id);
      expect((await cal(b.token)).json().auswahl.verbunden).toBe(false);
      expect(calls).toHaveLength(0);
      expect((await cal(a.token)).json().auswahl.verbunden).toBe(true);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/auth/me/email/confirm",
            headers: headers(b.token),
            payload: { token },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  });
  it("nimmt die alte E-Mail-Konfiguration nie still als Konto-ID-Liste", () => {
    const old = {
      KLARWERK_KALENDER_M365_BASE_URL: "https://graph.attrappe.test",
      KLARWERK_KALENDER_M365_TOKEN: "fake",
      KLARWERK_KALENDER_M365_KONTEN: "u-1",
    };
    expect(kalenderAnbieterAusEnv(old)).toBeUndefined();
    const neu = kalenderAnbieterAusEnv({ ...old, KLARWERK_KALENDER_M365_KONTO_IDS: "u-1" });
    expect(neu?.fuer("u-1")).toBeTruthy();
    expect(neu?.fuer("U-1")).toBeNull();
    expect(neu?.fuer("u-1@tenant")).toBeNull();
    expect(neu?.fuer("oidc:u-1")).toBeNull();
  });
  it("bindet Token an Konto, neue und bisherige Adresse, Ersatz, Zweck und 15-Minuten-Frist", async () => {
    let now = 1000;
    const users = new InMemoryUserRepo();
    const s = new AuthService({ users, sessions: new InMemorySessionRepo(), now: () => now });
    const u = await s.register({ name: "A", email: "a@attrappe.test", password: pw });
    const other = await s.register({ name: "B", email: "b@attrappe.test", password: pw });
    const first = await s.requestEmailChange(u.id, "neu@attrappe.test");
    await expect(s.confirmEmailChange(other.id, first.token)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(s.resetPasswordWithToken(first.token, "Anderes-fiktiv-123")).rejects.toBeDefined();
    const second = await s.requestEmailChange(u.id, "neuer@attrappe.test");
    await expect(s.confirmEmailChange(u.id, first.token)).rejects.toBeDefined();
    now += 15 * 60000;
    await expect(s.confirmEmailChange(u.id, second.token)).rejects.toBeDefined();
    const third = await s.requestEmailChange(u.id, "dritte@attrappe.test");
    await s.correctAccountData(u.id, { email: "zwischen@attrappe.test" }, u.id);
    await expect(s.confirmEmailChange(u.id, third.token)).rejects.toBeDefined();
    expect((await users.findById(u.id))?.email).toBe("zwischen@attrappe.test");
  });
  it("bewahrt offene und verbrauchte Bestätigungen im echten Journal beim Wiederaufbau", async () => {
    const dir = mkdtempSync(join(tmpdir(), "w44-mail-journal-"));
    const file = join(dir, "journal.jsonl");
    try {
      const s = await buildDevPersistServices(file);
      const u = await s.auth.register({ name: "A", email: "a@attrappe.test", password: pw });
      const pending = await s.auth.requestEmailChange(u.id, "neu@attrappe.test");
      expect(readFileSync(file, "utf8")).not.toContain(pending.token);
      const restarted = await buildDevPersistServices(file);
      expect((await restarted.auth.confirmEmailChange(u.id, pending.token)).email).toBe(
        "neu@attrappe.test",
      );
      const again = await buildDevPersistServices(file);
      await expect(again.auth.confirmEmailChange(u.id, pending.token)).rejects.toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("führt PG-Einmalverbrauch konto- und fristgebunden mit Parametern in EINEM Befehl aus (kein PG-Start)", async () => {
    const query = vi.fn(async (_sql: string, _params: unknown[]) => ({ rows: [] }));
    const repo = new PgPasswordResetRepo({ query } as unknown as Pool);
    await repo.createEmailChange({
      token: "sha256:fake",
      userId: "u",
      email: "n@attrappe.test",
      previousEmail: "a@attrappe.test",
      expiresAt: 900,
    });
    expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT(user_id)");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "sha256:fake",
      "u",
      "n@attrappe.test",
      "a@attrappe.test",
      900,
    ]);
    await repo.takeEmailChange("sha256:fake", "u", 100);
    expect(query.mock.calls[1]).toEqual([
      "DELETE FROM email_changes WHERE token=$1 AND user_id=$2 AND expires_at>$3 RETURNING *",
      ["sha256:fake", "u", 100],
    ]);
  });
});
