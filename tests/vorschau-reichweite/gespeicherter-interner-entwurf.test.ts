import { afterEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KnowledgeCheckResult } from "../../services/app/src/knowledge-check";
import type { Confidentiality } from "../../services/knowledge-object";

const TEXT = "Bei Kaltstart keine Vorwärmung aktivieren und sichern.";
const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
  vi.restoreAllMocks();
});

// Echte Auth, Capture-Ablage und Konfliktkern; nur Status und Judge sind lokale Ports.
async function aufbauen() {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const judge = vi.spyOn(services.reasoner, "judgeConflict").mockResolvedValue(null);
  const app = buildApp(services);
  apps.push(app);
  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Vorschau", email: "vorschau@example.test", password: "test-password-18" },
  });
  expect(registration.statusCode, registration.body).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "vorschau@example.test", password: "test-password-18" },
  });
  expect(login.statusCode, login.body).toBe(200);
  const headers = { authorization: `Bearer ${login.json().token}` };
  const kandidat = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Kaltstart Vorwärmung",
      statement: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
      type: "best_practice",
      category: "Werkstatt",
      confidentiality: "intern",
    },
  });
  expect(kandidat.statusCode, kandidat.body).toBe(201);
  await services.aiCheckWorker?.idle();
  const status = services.reasoner.status();
  vi.spyOn(services.reasoner, "status").mockReturnValue({ ...status, active: true });
  judge.mockClear();
  return { app, services, repos, headers, judge, koId: kandidat.json<{ id: string }>().id };
}
type Aufbau = Awaited<ReturnType<typeof aufbauen>>;

async function speichern(a: Aufbau, level: Confidentiality | undefined): Promise<string> {
  const response = await a.app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: a.headers,
    payload: {
      title: "Gespeicherte Vorschau",
      statement: "",
      bodyHtml: `<p>${TEXT}</p>`,
      origin: "expert",
      ...(level === undefined ? {} : { confidentiality: level }),
    },
  });
  expect(response.statusCode, response.body).toBe(201);
  const id = response.json<{ id: string }>().id;
  const gespeichert = await a.services.capture.getDraft(id);
  expect(gespeichert?.id).toBe(id);
  expect(gespeichert?.payload.confidentiality).toBe(level);
  expect(gespeichert?.payload.bodyHtml).toBe(`<p>${TEXT}</p>`);
  return id;
}

async function pruefen(
  a: Aufbau,
  herkunft: Record<string, unknown>,
): Promise<KnowledgeCheckResult> {
  a.judge.mockClear();
  const response = await a.app.inject({
    method: "POST",
    url: "/api/knowledge/check",
    headers: a.headers,
    payload: { text: TEXT, source: "draft", confidentiality: "intern", ...herkunft },
  });
  expect(response.statusCode, response.body).toBe(200);
  const body = response.json<KnowledgeCheckResult>();
  expect(body.similar.map((treffer) => treffer.id)).toEqual([a.koId]);
  expect(body.coverage).toEqual({
    kind: "candidates",
    checked: 1,
    limit: 40,
    limitReached: false,
  });
  return body;
}

it("gespeichertes intern prüft; fehlender oder unbekannter Draft-Anker sperrt", async () => {
  const a = await aufbauen();
  const draftId = await speichern(a, "intern");
  const erlaubt = await pruefen(a, { draftId });
  expect(erlaubt.status).toBe("done");
  expect(a.judge).toHaveBeenCalledTimes(1);
  expect(a.judge.mock.calls[0]?.[0]).toContain(TEXT);
  expect(a.judge.mock.calls[0]?.[1]).toContain("zuerst die Vorwärmung aktivieren");
  for (const herkunft of [{}, { draftId: "nicht-gespeichert" }]) {
    const gesperrt = await pruefen(a, herkunft);
    expect(gesperrt.status).toBe("pending");
    expect(gesperrt.conflicts).toEqual([]);
    expect(gesperrt.similar).toEqual(erlaubt.similar);
    expect(a.judge).not.toHaveBeenCalled();
  }
});

it("geschützte Draft- und KO-Stufen bleiben trotz Body-intern gesperrt", async () => {
  const a = await aufbauen();
  const internId = await speichern(a, "intern");
  let ohneStufe = "";
  for (const level of ["vertraulich", "streng_vertraulich", undefined] as const) {
    const draftId = await speichern(a, level);
    if (level === undefined) {
      ohneStufe = draftId;
    }
    const gesperrt = await pruefen(a, { draftId });
    expect(gesperrt.status).toBe("pending");
    expect(gesperrt.conflicts).toEqual([]);
    expect(a.judge).not.toHaveBeenCalled();
  }

  // Ungültiger Altbestand liegt in derselben echten Ablage, ohne getDraft-Attrappe.
  const alt = await a.services.capture.getDraft(ohneStufe);
  if (!alt) {
    throw new Error("Der tatsächlich gespeicherte Entwurf fehlt.");
  }
  await a.repos.drafts.update({
    ...alt,
    payload: { ...alt.payload, confidentiality: "ungueltig" as Confidentiality },
  });
  expect((await a.services.capture.getDraft(ohneStufe))?.payload.confidentiality).toBe("ungueltig");
  expect((await pruefen(a, { draftId: ohneStufe })).status).toBe("pending");
  expect(a.judge).not.toHaveBeenCalled();

  for (const level of ["vertraulich", "streng_vertraulich", undefined] as const) {
    const ko = await a.services.ko.create({
      title: `Geschützter Altbestand ${level ?? "ohne Stufe"}`,
      statement: "Andere Arbeitsanweisung im Archiv.",
      type: "best_practice",
      category: "Archiv",
      ...(level === undefined ? {} : { confidentiality: level }),
    });
    expect((await a.services.ko.get(ko.id))?.confidentiality).toBe(level);
    const gesperrt = await pruefen(a, { draftId: internId, koId: ko.id });
    expect(gesperrt.status).toBe("pending");
    expect(gesperrt.conflicts).toEqual([]);
    expect(a.judge).not.toHaveBeenCalled();
  }

  for (const herkunft of [
    { draftId: internId, confidentiality: "ungueltig" },
    { draftId: internId, confidentiality: undefined },
    { draftId: internId, source: "ko" },
    { draftId: internId, source: "unbekannt" },
  ]) {
    expect((await pruefen(a, herkunft)).status).toBe("pending");
    expect(a.judge).not.toHaveBeenCalled();
  }
});

