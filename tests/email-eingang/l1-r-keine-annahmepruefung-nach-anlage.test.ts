import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { EMAIL_ANGENOMMEN } from "../../services/app/src/routes/email-eingang-routes";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("L-1-R: ein vorgeprüfter Mail-Promote hängt nach ko.create nicht erneut von Audit.list ab", async () => {
  const key = "fiktiver-l1-r-adapter-ohne-versand";
  const mail = {
    recipient: "wissen@firma.example",
    messageId: "<l1-r@firma.example>",
    from: "Fiktive Kollegin",
    subject: "WG: L1-R Wartung",
    sentAt: "2026-10-20T16:00:00Z",
    text: "Vor der Wartung den Druck ablassen.",
  };
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("APP_BASE_URL", "https://wissen.firma.example");
  vi.stubEnv(
    "KLARWERK_SERVICE_KEYS",
    JSON.stringify([
      {
        id: "l1-r-adapter",
        sha256: [createHash("sha256").update(key).digest("hex")],
        rechte: ["mail.entwurf"],
      },
    ]),
  );
  const services = buildServices();
  const owner = await services.auth.register({
    name: "L1-R Prüferin",
    email: "l1-r@firma.example",
    password: "fiktiv-12345",
  });
  const session = await services.auth.login({ email: owner.email, password: "fiktiv-12345" });
  vi.stubEnv(
    "KLARWERK_EMAIL_EINGANG",
    JSON.stringify({
      adresse: mail.recipient,
      anlage: "wissen.firma.example",
      dienstId: "l1-r-adapter",
      eigentuemerId: owner.id,
    }),
  );
  const app = buildApp(services);
  apps.push(app);
  const headers = { authorization: `Bearer ${session.token}` };
  const mailReplay = () =>
    app.inject({
      method: "POST",
      url: "/api/eingang/email",
      headers: { "x-klarwerk-service-key": key },
      payload: mail,
    });
  const receipt = await mailReplay();
  expect(receipt.statusCode, receipt.body).toBe(201);
  const id = receipt.json().entwurfId;
  const save = await app.inject({
    method: "PUT",
    url: `/api/drafts/${id}`,
    headers,
    payload: { type: "best_practice", category: "Wartung", confidentiality: "intern" },
  });
  expect(save.statusCode, save.body).toBe(200);

  const list = services.audit.list.bind(services.audit);
  const create = services.ko.create.bind(services.ko);
  const createdIds: string[] = [];
  let faultArmed = true;
  let successfulPrechecks = 0;
  let readsAfterCreate = 0;
  vi.spyOn(services.ko, "create").mockImplementation(async (...args) => {
    const created = await create(...args);
    createdIds.push(created.id);
    return created;
  });
  vi.spyOn(services.audit, "list").mockImplementation(async (filter) => {
    if (faultArmed && filter?.action === EMAIL_ANGENOMMEN) {
      if (createdIds.length > 0) {
        readsAfterCreate++;
        throw new Error("L1-R: ausschließlich Auditnachlese nach ko.create ausgefallen");
      }
      successfulPrechecks++;
    }
    return list(filter);
  });
  // Bewusst OHNE optionale operationId: der bestehende normale Port muss ebenfalls sicher sein.
  const first = await app.inject({ method: "POST", url: `/api/drafts/${id}/promote`, headers });
  faultArmed = false;
  const draftReadback = await app.inject({ method: "GET", url: `/api/drafts/${id}`, headers });
  const koReadback = await app.inject({ method: "GET", url: `/api/kos/${createdIds[0]}`, headers });
  const ownerRetry = await app.inject({
    method: "POST",
    url: `/api/drafts/${id}/promote`,
    headers,
  });
  const mailRetry = await mailReplay();
  // Alle Schritte werden auch vor dem Fix ausgeführt: dort500/Draft200/Retry201/zweiKO.
  expect({
    first: first.statusCode,
    draft: draftReadback.statusCode,
    ownerRetry: ownerRetry.statusCode,
    knowledgeObjects: (await services.ko.list()).length,
    successfulPrechecks,
    readsAfterCreate,
  }).toEqual({
    first: 201,
    draft: 404,
    ownerRetry: 404,
    knowledgeObjects: 1,
    successfulPrechecks: 1,
    readsAfterCreate: 0,
  });
  expect(koReadback.statusCode, koReadback.body).toBe(200);
  expect(koReadback.json().status).toBe("offen");
  expect(mailRetry.statusCode, mailRetry.body).toBe(200);
  expect(mailRetry.json()).toEqual({ entwurfId: id, neu: false });
  expect(await services.capture.listDraftsForResume()).toHaveLength(0);
});
