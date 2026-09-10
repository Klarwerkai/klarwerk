import { afterEach, describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { Role } from "../../services/auth";
import type { CreateKoInput } from "../../services/knowledge-object";
import { ROLE_PERMISSIONS } from "../../services/rbac";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup() {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  apps.push(app);
  const credentials = { email: "admin@categories.test", password: "secret123" };
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { ...credentials, name: "Admin" },
  });
  expect(registered.statusCode, registered.body).toBe(201);
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: credentials });
  expect(login.statusCode, login.body).toBe(200);
  const admin = { authorization: `Bearer ${login.json().token}` };

  async function user(name: string, role: Role) {
    const credentials = { email: `${name}@categories.test`, password: "secret123" };
    const created = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { ...credentials, name, role },
    });
    expect(created.statusCode, created.body).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: credentials,
    });
    expect(login.statusCode, login.body).toBe(200);
    return { id: created.json().id as string, authorization: `Bearer ${login.json().token}` };
  }

  const create = (category: string, extra: Partial<CreateKoInput> = {}) =>
    services.ko.create({
      title: "Wissensobjekt",
      statement: "Ein belegter Bestandseintrag.",
      type: "best_practice",
      category,
      author: login.json().user.id as string,
      confidentiality: "intern",
      ...extra,
    });
  const categories = (headers: Record<string, string> = admin) =>
    app.inject({ method: "GET", url: "/api/categories", headers });
  return { app, repos, services, admin, user, create, categories };
}

describe("K2b · Kategorien am echten Anwendungsdraht", () => {
  it("F1 die Route existiert und antwortet vollständig, eindeutig und nach Namen sortiert", async () => {
    const { create, categories } = await setup();
    // Absichtlich B zuerst und ungleiche Zähler: weder Einfügereihenfolge noch count aufsteigend.
    await create("B");
    await create("A");
    await create("A");
    const response = await categories();
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.json()).toEqual({
      categories: [
        { name: "A", count: 2 },
        { name: "B", count: 1 },
      ],
    });
  });

  it("F2 Sichtbarkeit ist echt: derselbe Bestand ergibt je Anwender andere Bereiche und Zähler", async () => {
    const { create, user, categories } = await setup();
    const a = await user("a", "experte");
    const b = await user("b", "experte");
    await create("Gemeinsam");
    await create("Gemeinsam", { author: a.id, confidentiality: "vertraulich" });
    await create("Nur A", { author: a.id, confidentiality: "streng_vertraulich" });
    await create("Nur B", { author: b.id, confidentiality: "vertraulich" });
    const responseA = await categories(a);
    const responseB = await categories(b);
    const responseAdmin = await categories();
    expect([responseA.statusCode, responseB.statusCode, responseAdmin.statusCode]).toEqual([
      200, 200, 200,
    ]);
    expect(responseA.json()).toEqual({
      categories: [
        { name: "Gemeinsam", count: 2 },
        { name: "Nur A", count: 1 },
      ],
    });
    expect(responseB.json()).toEqual({
      categories: [
        { name: "Gemeinsam", count: 1 },
        { name: "Nur B", count: 1 },
      ],
    });
    expect(responseAdmin.json()).toEqual({
      categories: [
        { name: "Gemeinsam", count: 2 },
        { name: "Nur A", count: 1 },
        { name: "Nur B", count: 1 },
      ],
    });
  });

  it("F3 ohne gültige Anmeldung kein Bestandsabzug, wie bei der Bibliothekssuche", async () => {
    const { app, create, categories } = await setup();
    await create("Bestandsgeheimnis");
    const neighbor = await app.inject({ method: "GET", url: "/api/library/search" });
    expect(neighbor.statusCode).toBe(401);
    for (const headers of [{}, { authorization: "Bearer ungueltig" }]) {
      const response = await categories(headers);
      expect(response.statusCode).toBe(neighbor.statusCode);
      expect(response.json()).toEqual(neighbor.json());
      expect(response.json()).toEqual({ error: "UNAUTHENTICATED", message: "Nicht angemeldet." });
    }
  });

  it("F4 ohne Kategorie erfindet nichts: fehlend, leer, Weißraum und null bleiben ohne Eintrag", async () => {
    const { create, repos, services, categories } = await setup();
    await create("A");
    await create("");
    await create("   ");
    await create("\t\n\u00a0");
    // Altbestand an der echten Ablage: das heutige Schreibmodell verlangt einen String.
    const missing = await create("Altbestand");
    Reflect.deleteProperty(missing, "category");
    await repos.koRepo.update(missing);
    const nullable = await create("Altbestand null");
    Reflect.set(nullable, "category", null);
    await repos.koRepo.update(nullable);
    const response = await categories();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ categories: [{ name: "A", count: 1 }] });
    const sum = response
      .json<{ categories: { count: number }[] }>()
      .categories.reduce((n, c) => n + c.count, 0);
    expect(sum).toBeLessThan((await services.ko.list()).length);
  });

  it("F5 leerer Bestand ist eine ehrliche leere Liste", async () => {
    const { categories } = await setup();
    const response = await categories();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ categories: [] });
  });

  it("F6 gültige Anmeldung ohne Leserecht liefert leer und liest keinen Bestand", async () => {
    const { user, create, repos, categories } = await setup();
    const viewer = await user("leser", "viewer");
    await create("A");
    const read = vi.spyOn(repos.koRepo, "listForSearch");
    // Alle heutigen Rollen haben ko.read. Entzug an der echten Matrix prüft den sonst
    // unerreichbaren Pflichtfall, ohne Authentifizierung oder Guard zu ersetzen.
    const previous = ROLE_PERMISSIONS.viewer;
    ROLE_PERMISSIONS.viewer = [];
    try {
      const response = await categories(viewer);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ categories: [] });
      expect(read).not.toHaveBeenCalled();
    } finally {
      ROLE_PERMISSIONS.viewer = previous;
    }
  });

  it("F7 Abruffehler ist ein benannter Fehler statt einer falschen leeren Liste", async () => {
    const { create, repos, categories } = await setup();
    await create("A");
    vi.spyOn(repos.koRepo, "listForSearch").mockRejectedValueOnce(
      new Error("Interne Ablagedetails"),
    );
    const response = await categories();
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "INTERNAL", message: "Unerwarteter Fehler." });
    const recovered = await categories();
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json()).toEqual({ categories: [{ name: "A", count: 1 }] });
  });

  it("F8 Namen bleiben exakt und die Reihenfolge ist gebietsunabhängig", async () => {
    const { create, categories } = await setup();
    for (const name of ["ä", "a", "Z", "A", " A ", "__proto__"]) {
      await create(name);
    }
    expect((await categories()).json()).toEqual({
      categories: [
        { name: " A ", count: 1 },
        { name: "A", count: 1 },
        { name: "Z", count: 1 },
        { name: "__proto__", count: 1 },
        { name: "a", count: 1 },
        { name: "ä", count: 1 },
      ],
    });
  });

  it("F9 der nächste Abruf sieht Änderungen, Papierkorb und Sichtbarkeitsentzug", async () => {
    const { create, user, services, categories } = await setup();
    const viewer = await user("leser", "viewer");
    const ko = await create("A");
    expect((await categories(viewer)).json()).toEqual({ categories: [{ name: "A", count: 1 }] });
    await services.ko.updateCategory(ko.id, "B");
    expect((await categories(viewer)).json()).toEqual({ categories: [{ name: "B", count: 1 }] });
    await services.ko.setConfidentiality(ko.id, "vertraulich", ko.author);
    expect((await categories(viewer)).json()).toEqual({ categories: [] });
    expect((await categories()).json()).toEqual({ categories: [{ name: "B", count: 1 }] });
    await services.ko.delete(ko.id, ko.author);
    expect((await categories()).json()).toEqual({ categories: [] });
  });
});
