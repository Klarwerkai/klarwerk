import { afterEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
  vi.restoreAllMocks();
});

it("Zähler braucht keinen Vollobjektabruf; das Board behält seinen Inhalt", async () => {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  apps.push(app);
  const email = "count-projektion@example.test";
  const password = "test-password-count-projektion";
  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Zählprojektion", email, password },
  });
  expect(registration.statusCode, registration.body).toBe(201);
  const user = await repos.users.findByEmail(email);
  if (!user) {
    throw new Error("Das tatsächlich registrierte Konto fehlt.");
  }
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(login.statusCode, login.body).toBe(200);
  const headers = { authorization: `Bearer ${login.json<{ token: string }>().token}` };
  const ko = await services.ko.create({
    title: "Offener Beitrag mit Inhalt",
    statement: "Die vollständige Lesefassung bleibt verfügbar.",
    author: user.id,
    type: "best_practice",
    category: "Zählprojektion",
    confidentiality: "intern",
  });
  const bodyHtml = "<h2>Originalinhalt</h2><p>Dieser Inhalt gehört in den Leser.</p>";
  await repos.koRepo.update({ ...ko, bodyHtml });

  // Der volle Objektport ist tatsächlich nicht verfügbar. Der Zähler muss trotzdem antworten.
  const vollobjekte = vi.spyOn(services.ko, "list").mockRejectedValue(new Error("Vollobjekte"));
  const count = await app.inject({ method: "GET", url: "/api/validation/board/count", headers });
  expect(count.statusCode, count.body).toBe(200);
  expect(count.json()).toEqual({ length: 1 });
  expect(vollobjekte).not.toHaveBeenCalled();
  expect((await repos.koRepo.findById(ko.id))?.bodyHtml).toBe(bodyHtml);

  vollobjekte.mockRestore();
  const board = await app.inject({ method: "GET", url: "/api/validation/board", headers });
  expect(board.statusCode, board.body).toBe(200);
  const rows = board.json<{ id: string; bodyHtml?: string }[]>();
  expect(rows.map((row) => row.id)).toEqual([ko.id]);
  expect(rows[0]?.bodyHtml).toBe(bodyHtml);
  expect(count.json()).toEqual({ length: rows.length });
});
