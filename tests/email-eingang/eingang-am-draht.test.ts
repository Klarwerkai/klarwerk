import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { buildDevPersistServices } from "../../services/app/src/dev-persist";
import { ladeEmailEingang } from "../../services/app/src/email-eingang";
import { EMAIL_ANGENOMMEN } from "../../services/app/src/routes/email-eingang-routes";

// Ausschließlich fiktive Adressen und eigens gesetzte Testschlüssel, kein Mailversand/Netz.
const KEY = "nur-lokaler-fiktiver-mailadapter-20261020";
const OTHER_KEY = "anderer-fiktiver-mailadapter-20261020";
const IMPORT_KEY = "fiktiver-reiner-importadapter-20261020";
const headers = { "x-klarwerk-service-key": KEY };
const message = {
  recipient: "wissen@firma.example",
  messageId: "<fiktive-weiterleitung-1@firma.example>",
  from: "Kollegin <kollegin@firma.example>",
  subject: "WG: Erfahrung mit Pumpe 7",
  sentAt: "2026-10-20T14:00:00Z",
  text: "Vor der Wartung den Druck ablassen.\n<script>alert('x')</script>",
};
type App = ReturnType<typeof buildApp>;
const apps: App[] = [];
const dirs: string[] = [];
beforeEach(() => {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("APP_BASE_URL", "https://wissen.firma.example");
  vi.stubEnv(
    "KLARWERK_SERVICE_KEYS",
    JSON.stringify([
      {
        id: "mailadapter",
        sha256: [createHash("sha256").update(KEY).digest("hex")],
        rechte: ["mail.entwurf"],
        max: 100,
      },
      {
        id: "anderer",
        sha256: [createHash("sha256").update(OTHER_KEY).digest("hex")],
        rechte: ["import.kandidaten", "mail.entwurf"],
      },
      {
        id: "nurimport",
        sha256: [createHash("sha256").update(IMPORT_KEY).digest("hex")],
        rechte: ["import.kandidaten"],
      },
    ]),
  );
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function fixture(file?: string) {
  const services = file ? await buildDevPersistServices(file) : buildServices();
  const owner = await services.auth.register({
    name: "Eingang Prüferin",
    email: "prueferin@firma.example",
    password: "fiktiv-sicher-123",
  });
  const session = await services.auth.login({ email: owner.email, password: "fiktiv-sicher-123" });
  vi.stubEnv(
    "KLARWERK_EMAIL_EINGANG",
    JSON.stringify({
      adresse: message.recipient,
      anlage: "wissen.firma.example",
      dienstId: "mailadapter",
      eigentuemerId: owner.id,
    }),
  );
  const app = buildApp(services);
  apps.push(app);
  return { services, app, owner, userHeaders: { authorization: `Bearer ${session.token}` } };
}

const post = (app: App, payload: unknown = message, h = headers) =>
  app.inject({
    method: "POST",
    url: "/api/eingang/email",
    headers: h,
    payload: payload as Record<string, unknown>,
  });

describe("Organisations-E-Mail → vorhandener privater Wissensentwurf", () => {
  it("nimmt Text mit Herkunft an; gewöhnliches Wiederöffnen und Einreichen behalten die ungeprüfte Quelle", async () => {
    const { app, services, owner, userHeaders } = await fixture();
    const res = await post(app);
    expect(res.statusCode, res.body).toBe(201);
    const id = res.json().entwurfId;
    const liste = await app.inject({ method: "GET", url: "/api/drafts", headers: userHeaders });
    const draft = liste.json().find((d: { id: string }) => d.id === id);
    expect(draft.originalAuthor).toBe(owner.id);
    expect(draft.imPool).toBeUndefined();
    expect(draft.payload.title).toBe(message.subject);
    expect(draft.payload.bodyHtml).toContain("&lt;script&gt;");
    expect(draft.payload.bodyHtml).not.toContain("<script>");
    expect(draft.payload.bodyHtml).toContain(
      message.from.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    );
    expect(draft.payload.pendingSources[0].excerpt).toContain(message.messageId);
    const originalId = draft.payload.anchorDocuments[0].objectId;
    const original = await app.inject({
      method: "GET",
      url: `/api/objects/${originalId}/raw`,
      headers: userHeaders,
    });
    expect(original.statusCode, original.body).toBe(200);
    expect(original.json().text).toBe(message.text);
    expect(draft.payload.pendingSources[0].excerpt).toContain(
      createHash("sha256").update(original.rawPayload).digest("hex"),
    );
    expect(await services.ko.list()).toHaveLength(0);
    const belege = await services.audit.list({ action: EMAIL_ANGENOMMEN });
    expect(belege).toHaveLength(1);
    expect(belege[0]?.actor).toBe("dienst:mailadapter");
    expect(JSON.stringify(belege)).not.toContain(message.from);
    // Fachpflichtfelder erfordern weiterhin die bewusste Bearbeitung und Einstufung.
    const unvollstaendig = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers: userHeaders,
    });
    expect(unvollstaendig.statusCode).toBe(400);
    const save = await app.inject({
      method: "PUT",
      url: `/api/drafts/${id}`,
      headers: userHeaders,
      payload: { type: "best_practice", category: "Wartung", confidentiality: "intern" },
    });
    expect(save.statusCode, save.body).toBe(200);
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers: userHeaders,
    });
    expect(promote.statusCode, promote.body).toBe(201);
    expect(promote.json().status).toBe("offen");
    expect(promote.json().sources[0].peerValidated).toBe(false);
    expect(promote.json().sources[0].excerpt).toContain(message.messageId);
    // Nach Verbrauch bleibt der Annahmebeleg: erneute Zustellung erzeugt keinen zweiten Entwurf.
    expect((await post(app)).json()).toEqual({ entwurfId: id, neu: false });
    expect(await services.capture.getDraft(id)).toBeUndefined();
  });

  it("serialisiert Parallelzustellungen im bestehenden Vorgangsweg und meldet abweichenden Inhalt mit 409", async () => {
    const { app, services } = await fixture();
    const results = await Promise.all([post(app), post(app), post(app)]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 200, 201]);
    expect(new Set(results.map((r) => r.json().entwurfId)).size).toBe(1);
    expect(await services.audit.list({ action: EMAIL_ANGENOMMEN })).toHaveLength(1);
    expect((await post(app, { ...message, text: "Geänderte Erfahrung" })).statusCode).toBe(409);
  });

  it("erholt sich nach fehlgeschlagenem Annahmebeleg ohne zweiten Entwurf", async () => {
    const { app, services } = await fixture();
    vi.spyOn(services.audit, "recordOnce").mockRejectedValueOnce(
      new Error("fiktiver Speicherausfall"),
    );
    expect((await post(app)).statusCode).toBe(500);
    const res = await post(app);
    expect(res.statusCode, res.body).toBe(200);
    expect(await services.audit.list({ action: EMAIL_ANGENOMMEN })).toHaveLength(1);
  });

  it("behält bei unterbrochener Originalbindung den Fehler sichtbar und vervollständigt erst bei Wiederholung", async () => {
    const { app, services } = await fixture();
    vi.spyOn(services.capture, "continueDraft").mockRejectedValueOnce(
      new Error("fiktiver Bindungsausfall"),
    );
    expect((await post(app)).statusCode).toBe(500);
    expect(await services.audit.list({ action: EMAIL_ANGENOMMEN })).toHaveLength(0);
    expect((await post(app)).statusCode).toBe(200);
    const draft = (await services.capture.listDraftsForResume())[0]?.draft;
    expect(draft?.payload.anchorDocuments).toHaveLength(1);
    expect(draft?.payload.pendingSources?.[0]?.objectId).toBe(
      draft?.payload.anchorDocuments?.[0]?.objectId,
    );
    expect(await services.capture.listDraftsForResume()).toHaveLength(1);
  });

  it("wehrt fremde Adressen, Anhänge, HTML-only, Kopfzeilensteuerung und freie Rechtefelder ohne Anlage ab", async () => {
    const { app, services } = await fixture();
    for (const [payload, status] of [
      [{ ...message, recipient: "wissen@andere-firma.example" }, 400],
      [{ ...message, attachments: [{ name: "wissen.pdf" }] }, 422],
      [{ ...message, text: "", html: "<p>Nur HTML</p>" }, 400],
      [{ ...message, from: "Person\r\nBcc: andere@firma.example" }, 400],
      [{ ...message, ownerId: "fremd", confidentiality: "oeffentlich" }, 400],
      [{ ...message, text: " ", sentAt: "gestern" }, 400],
      [{ ...message, text: "x".repeat(100_001) }, 400],
    ] as const)
      expect((await post(app, payload)).statusCode).toBe(status);
    expect(await services.audit.list({ action: EMAIL_ANGENOMMEN })).toHaveLength(0);
    expect(await services.capture.listDraftsForResume()).toHaveLength(0);
  });

  it("verlangt den gebundenen Dienst mit eigenem Recht vor dem Bodyparser; kein Personenlogin oder import.kandidaten öffnet ihn", async () => {
    const { app, userHeaders } = await fixture();
    for (const h of [{}, userHeaders, { "x-klarwerk-service-key": "falsch" }]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/eingang/email",
        headers: { ...h, "content-type": "application/json" },
        payload: "{",
      });
      expect(res.statusCode).toBe(401);
    }
    expect((await post(app, message, { "x-klarwerk-service-key": OTHER_KEY })).statusCode).toBe(
      403,
    );
    const forbidden = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: { title: "Ausbruch" },
    });
    expect(forbidden.statusCode).toBe(403);
    expect((await post(app, message, { "x-klarwerk-service-key": IMPORT_KEY })).statusCode).toBe(
      403,
    );
    const gross = await post(app, { ...message, text: "x".repeat(1024 * 1024) });
    expect(gross.statusCode).toBe(413);
  });

  it("gibt privaten Entwurf weder einem anderen Nutzer noch dem Dienst zum Lesen frei", async () => {
    const { app, services, owner } = await fixture();
    const id = (await post(app)).json().entwurfId;
    const originalId = (await services.capture.getDraft(id))?.payload.anchorDocuments?.[0]
      ?.objectId;
    const anderer = await services.auth.register({
      name: "Andere",
      email: "andere@firma.example",
      password: "fiktiv-sicher-456",
    });
    await services.auth.approveUser(anderer.id, owner.id);
    const login = await services.auth.login({
      email: anderer.email,
      password: "fiktiv-sicher-456",
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/drafts/${id}`,
      headers: { authorization: `Bearer ${login.token}` },
    });
    expect(res.statusCode).toBe(404);
    const raw = await app.inject({
      method: "GET",
      url: `/api/objects/${originalId}/raw`,
      headers: { authorization: `Bearer ${login.token}` },
    });
    expect(raw.statusCode).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: `/api/drafts/${id}`, headers })).statusCode,
    ).toBe(403);
  });

  it("sperrt fehlende oder instanzfremde Konfiguration und entzogenes Zuständigkeitskonto", async () => {
    const { app, services, owner } = await fixture();
    vi.spyOn(services.auth, "kontoLesen").mockResolvedValueOnce(undefined);
    expect((await post(app)).statusCode).toBe(503);
    vi.spyOn(services.auth, "kontoLesen").mockResolvedValueOnce({ ...owner, role: "viewer" });
    expect((await post(app)).statusCode).toBe(503);
    vi.spyOn(services.auth, "kontoLesen").mockResolvedValueOnce({ ...owner, approved: false });
    expect((await post(app)).statusCode).toBe(503);
    vi.spyOn(services.auth, "kontoLesen").mockResolvedValueOnce({
      ...owner,
      accessExpiresAt: "2020-01-01T00:00:00Z",
    });
    expect((await post(app)).statusCode).toBe(503);
    vi.stubEnv("APP_BASE_URL", "https://andere.firma.example");
    expect(ladeEmailEingang()).toBeNull();
    const fremdeInstanz = buildApp(services);
    apps.push(fremdeInstanz);
    expect((await post(fremdeInstanz)).statusCode).toBe(503);
  });

  it("begrenzt den neuen Eingang über dieselbe Dienstbremse", async () => {
    await fixture();
    const keys = JSON.parse(process.env.KLARWERK_SERVICE_KEYS ?? "[]");
    keys[0].max = 1;
    vi.stubEnv("KLARWERK_SERVICE_KEYS", JSON.stringify(keys));
    const app = buildApp(buildServices());
    apps.push(app);
    // Das Zielkonto fehlt in diesem isolierten Bestand; selbst ein 503-Eingang zählt zur Bremse.
    expect((await post(app)).statusCode).toBe(503);
    const res = await post(app);
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("öffnet nach echtem Journal-Neuaufbau Entwurf und Annahmebeleg erneut", async () => {
    const dir = await mkdtemp(join(tmpdir(), "klara-l-email-"));
    dirs.push(dir);
    const file = join(dir, "fiktiver-bestand.jsonl");
    const { app, owner } = await fixture(file);
    const id = (await post(app)).json().entwurfId;
    await app.close();
    apps.splice(apps.indexOf(app), 1);
    const neu = await buildDevPersistServices(file);
    const reopened = buildApp(neu);
    apps.push(reopened);
    const login = await neu.auth.login({ email: owner.email, password: "fiktiv-sicher-123" });
    const res = await reopened.inject({
      method: "GET",
      url: `/api/drafts/${id}`,
      headers: { authorization: `Bearer ${login.token}` },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().payload.pendingSources[0].excerpt).toContain(message.messageId);
    expect((await post(reopened)).json()).toEqual({ entwurfId: id, neu: false });
  });
});
