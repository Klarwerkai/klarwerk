import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { EMAIL_ANGENOMMEN } from "../../services/app/src/routes/email-eingang-routes";

const KEY = "fiktiver-l1-mailadapter-ohne-versand";
const mail = {
  recipient: "wissen@firma.example",
  messageId: "<l1-fiktiv@firma.example>",
  from: "Fiktive Kollegin",
  subject: "WG: L1 Wartung",
  sentAt: "2026-10-20T16:00:00Z",
  text: "Vor der Wartung den Druck ablassen.",
};
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function fixture() {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("APP_BASE_URL", "https://wissen.firma.example");
  vi.stubEnv(
    "KLARWERK_SERVICE_KEYS",
    JSON.stringify([
      {
        id: "l1-adapter",
        sha256: [createHash("sha256").update(KEY).digest("hex")],
        rechte: ["mail.entwurf"],
      },
    ]),
  );
  const services = buildServices();
  const owner = await services.auth.register({
    name: "L1 Prüferin",
    email: "l1@firma.example",
    password: "fiktiv-12345",
  });
  const session = await services.auth.login({ email: owner.email, password: "fiktiv-12345" });
  vi.stubEnv(
    "KLARWERK_EMAIL_EINGANG",
    JSON.stringify({
      adresse: mail.recipient,
      anlage: "wissen.firma.example",
      dienstId: "l1-adapter",
      eigentuemerId: owner.id,
    }),
  );
  const app = buildApp(services);
  apps.push(app);
  const headers = { authorization: `Bearer ${session.token}` };
  const post = (message = mail) =>
    app.inject({
      method: "POST",
      url: "/api/eingang/email",
      headers: { "x-klarwerk-service-key": KEY },
      payload: message,
    });
  return { app, services, headers, post };
}

describe("L-1: unterbrochene Annahme vor erlaubtem Owner-Verbrauch", () => {
  it("hält Owner-Promote bis zum dauerhaften Annahmebeleg; Replay bleibt dieselbe Operation/Fassung", async () => {
    const { app, services, headers, post } = await fixture();
    vi.spyOn(services.audit, "recordOnce").mockRejectedValueOnce(new Error("L1 vor Audit-Append"));
    expect((await post()).statusCode).toBe(500);
    expect(await services.audit.list({ action: EMAIL_ANGENOMMEN })).toHaveLength(0);
    const liste = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(liste.statusCode).toBe(200);
    expect(liste.json()).toHaveLength(1);
    const id = liste.json()[0].id;
    // Tatsächlicher normaler Owner-Pfad, alle Fachpflichtfelder bewusst gewählt.
    const save = await app.inject({
      method: "PUT",
      url: `/api/drafts/${id}`,
      headers,
      payload: { type: "best_practice", category: "Wartung", confidentiality: "intern" },
    });
    expect(save.statusCode, save.body).toBe(200);
    const held = await app.inject({ method: "POST", url: `/api/drafts/${id}/promote`, headers });
    expect(held.statusCode, held.body).toBe(409);
    expect(held.json().error).toBe("CONFLICT");
    expect(await services.ko.list()).toHaveLength(0);
    expect(await services.capture.getDraft(id)).toBeDefined();
    expect((await post({ ...mail, text: "Abweichende Fassung" })).statusCode).toBe(409);
    expect((await post()).json()).toEqual({ entwurfId: id, neu: false });
    const promote = await app.inject({ method: "POST", url: `/api/drafts/${id}/promote`, headers });
    expect(promote.statusCode, promote.body).toBe(201);
    expect(await services.ko.list()).toHaveLength(1);
    expect((await post()).json()).toEqual({ entwurfId: id, neu: false });
    expect((await post({ ...mail, text: "Abweichende Fassung" })).statusCode).toBe(409);
    expect(await services.capture.listDraftsForResume()).toHaveLength(0);
    expect(await services.ko.list()).toHaveLength(1);
  });

  it("hält auch endgültiges Entfernen des noch nicht angenommenen Mailentwurfs; normale Entwürfe bleiben unverändert", async () => {
    const { app, services, headers, post } = await fixture();
    vi.spyOn(services.audit, "recordOnce").mockRejectedValueOnce(new Error("L1 vor Audit-Append"));
    expect((await post()).statusCode).toBe(500);
    const id = (await services.capture.listDraftsForResume())[0]?.draft.id;
    expect(id).toBeDefined();
    const trash = await app.inject({ method: "DELETE", url: `/api/drafts/${id}`, headers });
    expect(trash.statusCode, trash.body).toBe(204);
    const purge = await app.inject({ method: "DELETE", url: `/api/drafts/trash/${id}`, headers });
    expect(purge.statusCode, purge.body).toBe(409);
    expect((await post({ ...mail, text: "Andere Fassung" })).statusCode).toBe(409);
    const restore = await app.inject({ method: "POST", url: `/api/drafts/${id}/restore`, headers });
    expect(restore.statusCode, restore.body).toBe(200);
    expect((await post()).json()).toEqual({ entwurfId: id, neu: false });
    expect(await services.capture.listDraftsForResume()).toHaveLength(1);
    const normal = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Manueller Entwurf",
        statement: "Prüfbare Aussage",
        type: "best_practice",
        category: "Wartung",
        confidentiality: "intern",
      },
    });
    expect(normal.statusCode, normal.body).toBe(201);
    const normalPromote = await app.inject({
      method: "POST",
      url: `/api/drafts/${normal.json().id}/promote`,
      headers,
    });
    expect(normalPromote.statusCode, normalPromote.body).toBe(201);
  });
});
