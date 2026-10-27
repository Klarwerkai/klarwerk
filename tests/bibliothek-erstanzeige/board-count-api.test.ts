import { afterEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { Role } from "../../services/auth";
import type { Confidentiality } from "../../services/knowledge-object";

const apps: ReturnType<typeof buildApp>[] = [];
const PASSWORD = "test-password-board-19";

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
  vi.restoreAllMocks();
});

async function aufbauen() {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  apps.push(app);
  const email = "board-admin@example.test";
  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Board Admin", email, password: PASSWORD },
  });
  expect(registration.statusCode, registration.body).toBe(201);
  const user = await repos.users.findByEmail(email);
  if (!user) {
    throw new Error("Das registrierte Konto fehlt.");
  }
  async function anmelden(email: string) {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: PASSWORD },
    });
    expect(login.statusCode, login.body).toBe(200);
    return { authorization: `Bearer ${login.json<{ token: string }>().token}` };
  }
  return { repos, services, app, user, anmelden, headers: await anmelden(email) };
}

it("Zähler und sichtbares Board stimmen für Rollen und Freigaben überein", async () => {
  const a = await aufbauen();
  const users = [a.user];
  for (const role of ["viewer", "experte", "controller"] satisfies Role[]) {
    const email = `board-${role}@example.test`;
    const response = await a.app.inject({
      method: "POST",
      url: "/api/users",
      headers: a.headers,
      payload: { name: role, email, password: PASSWORD, role },
    });
    expect(response.statusCode, response.body).toBe(201);
    const user = await a.repos.users.findByEmail(email);
    if (!user) {
      throw new Error("Das über die Benutzerroute angelegte Konto fehlt.");
    }
    users.push(user);
  }
  for (const author of users) {
    for (const level of ["intern", "vertraulich", "streng_vertraulich", undefined] as const) {
      await a.services.ko.create({
        title: `Offen Text ${author.role} ${level ?? "ohne"}`,
        statement: "Dieser KO-Text gehört nicht in den Hüllenzähler.",
        author: author.id,
        type: "best_practice",
        category: "Zählvergleich",
        ...(level === undefined ? {} : { confidentiality: level }),
      });
    }
  }
  const input = {
    title: "Ausgeschlossene Boardzeile",
    statement: "Eigenständige Negativkontrolle.",
    author: a.user.id,
    type: "best_practice" as const,
    category: "Zählvergleich",
    confidentiality: "intern" as const,
  };
  const validiert = await a.services.ko.create(input);
  await a.services.ko.setValidationState(validiert.id, { status: "validiert", trust: 70 });
  const trash = await a.services.ko.create(input);
  await a.repos.koRepo.update({ ...trash, deletedAt: new Date().toISOString() });
  await a.services.ko.create(input, undefined, { stufe: "intern", leser: [a.user.id] });
  // Ein nicht aufgelöster führender Space bleibt nach der bestehenden Regel geschlossen.
  await a.services.ko.create(input, undefined, undefined, "nicht-lesbarer-space");

  const unauthed = await a.app.inject({ method: "GET", url: "/api/validation/board/count" });
  expect(unauthed.statusCode).toBe(401);
  for (const user of users) {
    for (const freigabe of ["intern", "vertraulich", "streng_vertraulich"] as const) {
      await a.repos.users.update({ ...user, freigabe });
      const headers = await a.anmelden(user.email);
      const board = await a.app.inject({ method: "GET", url: "/api/validation/board", headers });
      const count = await a.app.inject({
        method: "GET",
        url: "/api/validation/board/count",
        headers,
      });
      expect(board.statusCode, board.body).toBe(200);
      expect(count.statusCode, count.body).toBe(200);
      const rows = board.json<{ id: string }[]>();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.map((row) => row.id)).not.toContain(validiert.id);
      expect(rows.map((row) => row.id)).not.toContain(trash.id);
      expect(count.json()).toEqual({ length: rows.length });
      expect(count.body).not.toContain("Offen Text");
    }
  }
});

it("Zählen liest frisch, ohne Anreicherung und KI-Neueinreihung", async () => {
  const a = await aufbauen();
  const ko = await a.services.ko.create({
    title: "Alte ausstehende Prüfung",
    statement: "Der Zähler ist ein reiner Leseweg.",
    author: a.user.id,
    type: "best_practice",
    category: "Zählvergleich",
    confidentiality: "intern" satisfies Confidentiality,
  });
  await a.repos.koRepo.update({
    ...ko,
    aiCheck: { status: "pending", requestedAt: "2000-01-01T00:00:00.000Z", koVersion: ko.version },
  });
  const vorher = JSON.stringify(await a.repos.koRepo.findById(ko.id));
  const board = vi.spyOn(a.services.validation, "board");
  const ratings = vi.spyOn(a.repos.ratings, "listByKos");
  const assignments = vi.spyOn(a.repos.assignments, "all");
  const worker = a.services.aiCheckWorker;
  if (!worker) {
    throw new Error("Der normale Prüfworker fehlt.");
  }
  const enqueue = vi.spyOn(worker, "enqueue");
  for (let i = 0; i < 2; i += 1) {
    const response = await a.app.inject({
      method: "GET",
      url: "/api/validation/board/count",
      headers: a.headers,
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({ length: 1 });
  }
  expect(board).not.toHaveBeenCalled();
  expect(ratings).not.toHaveBeenCalled();
  expect(assignments).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
  expect(JSON.stringify(await a.repos.koRepo.findById(ko.id))).toBe(vorher);
  await a.services.ko.setValidationState(ko.id, { status: "validiert", trust: 70 });
  const neu = await a.app.inject({
    method: "GET",
    url: "/api/validation/board/count",
    headers: a.headers,
  });
  expect(neu.statusCode, neu.body).toBe(200);
  expect(neu.json()).toEqual({ length: 0 });
  expect(enqueue).not.toHaveBeenCalled();
});
