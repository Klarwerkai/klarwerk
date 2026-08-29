// ================================================================================================
// JOB 2685 D1+D2 (Review R2-30) — DIE VERDRAHTUNG: der Bildabruf nimmt die Trägersuche, wenn es sie gibt.
// ================================================================================================
//
// Am Draht:
//   1. Der Anwendungsspeicher bietet keine Trägersuche — `buildServices()` hat weder `anhangTraeger`
//      noch `anhangTraegerFuer`; der Bildabruf liest wie bisher `ko.list()` (D2: über den
//      Kandidaten-Speicher, der ohne Datenquellen-Suche den ganzen Bestand als Kandidaten führt und
//      jeden Kandidaten frisch über `ko.get` liest).
//   2. Bietet das KO-Repo die Suche, reicht `assembleServices` beide Fassungen gebunden durch.
//   3. Mit Trägersuche liest `GET /api/objects/:id/raw` NUR noch die Mehrfachsuche (D2) — nicht
//      `ko.list` —, trimmt den Papierkorb wie `KoService.list`, und urteilt wie zuvor.
import { describe, expect, it, vi } from "vitest";
import {
  type AppRepos,
  assembleServices,
  buildApp,
  buildServices,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { KnowledgeObject } from "../../services/knowledge-object";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function konten(app: App, marke: string): Promise<{ anna: Auth; bert: Auth }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: `anna@${marke}.test`, password: "geheim12345" },
  });
  const anna = await login(app, `anna@${marke}.test`, "geheim12345");
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: anna,
    payload: { name: "Bert", email: `bert@${marke}.test`, password: "geheim12345", role: "viewer" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Konto bert nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  return { anna, bert: await login(app, `bert@${marke}.test`, "geheim12345") };
}

async function upload(app: App, wer: Auth): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: wer,
    payload: {
      name: "typenschild.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function traegerAnlegen(app: App, wer: Auth, objectIds: string[]): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer,
    payload: {
      title: "Trägerobjekt",
      statement: "Ein Objekt, dessen Bilder im Fließtext stehen.",
      type: "best_practice",
      category: "Anlage 1",
      bodyHtml: objectIds.map((id) => `<p><img src="/api/objects/${id}/raw"></p>`).join(""),
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  return created.json().id as string;
}

// Die vier SQL-Arme als Stellvertreter über dem Anwendungsspeicher (dieselbe Übersetzung wie in
// tests/app/job2685-traegersuche-gleichheit.test.ts) — nur der AKTUELLE Stand, das genügt hier.
function stellvertreterFuer(
  repos: AppRepos,
): (objectIds: readonly string[]) => Promise<KnowledgeObject[]> {
  return async (objectIds) =>
    (await repos.koRepo.list({})).filter((k) =>
      objectIds.some(
        (objectId) =>
          (k.attachments ?? []).some((a) => a.objectId === objectId) ||
          (typeof k.bodyHtml === "string" && k.bodyHtml.includes(objectId)),
      ),
    );
}

async function raw(app: App, wer: Auth, objectId: string) {
  return app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers: wer });
}

describe("JOB 2685 D2 · Verdrahtung der Trägersuche", () => {
  it("1 · Anwendungsspeicher: keine Datenquellen-Suche; der Bildabruf liest den Bestand über `ko.list()` und den Träger frisch über `ko.get`", async () => {
    const services = buildServices();
    expect(services.anhangTraeger).toBeUndefined();
    expect(services.anhangTraegerFuer).toBeUndefined();
    expect(inMemoryRepos().koRepo.listAnhangTraegerFuer).toBeUndefined();

    const list = vi.spyOn(services.ko, "list");
    const get = vi.spyOn(services.ko, "get");
    const app = buildApp(services);
    const { anna, bert } = await konten(app, "v1");
    const objectId = await upload(app, anna);
    await traegerAnlegen(app, anna, [objectId]);
    list.mockClear();
    get.mockClear();

    const res = await raw(app, bert, objectId);
    expect(res.statusCode, res.body).toBe(200);
    expect(list).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalled();
  });

  it("2 · bietet das Repo `listAnhangTraegerFuer`, reicht assembleServices sie gebunden und mit den Kennungen durch", async () => {
    const repos = inMemoryRepos();
    const gesehen: { gebunden: boolean; objectIds: readonly string[] }[] = [];
    repos.koRepo.listAnhangTraegerFuer = async function (this: unknown, objectIds) {
      gesehen.push({ gebunden: this === repos.koRepo, objectIds });
      return [];
    };
    const services = assembleServices(repos);
    expect(typeof services.anhangTraegerFuer).toBe("function");
    await services.anhangTraegerFuer?.(["obj-42", "obj-43"]);
    expect(gesehen).toEqual([{ gebunden: true, objectIds: ["obj-42", "obj-43"] }]);
  });

  it("3 · mit Trägersuche liest der Bildabruf NUR sie — `ko.list` bleibt still — und urteilt wie zuvor; zehn Bilder einer Seite = zwei Suchen", async () => {
    const repos = inMemoryRepos();
    const suche = vi.fn(stellvertreterFuer(repos));
    repos.koRepo.listAnhangTraegerFuer = suche;
    const services = assembleServices(repos);
    const list = vi.spyOn(services.ko, "list");
    const app = buildApp(services);
    const { anna, bert } = await konten(app, "v3");
    const bilder: string[] = [];
    for (let i = 0; i < 10; i++) {
      bilder.push(await upload(app, anna));
    }
    await traegerAnlegen(app, anna, bilder);
    list.mockClear();
    suche.mockClear();

    for (const id of bilder) {
      const res = await raw(app, bert, id);
      expect(res.statusCode, `${id}: ${res.body}`).toBe(200);
    }
    // Bild 1 → eine Suche; seine neun Geschwister → eine weitere. Nicht zehn.
    expect(suche).toHaveBeenCalledTimes(2);
    expect(suche.mock.calls[0]?.[0]).toEqual([bilder[0]]);
    expect(new Set(suche.mock.calls[1]?.[0] as string[])).toEqual(new Set(bilder));
    expect(list).not.toHaveBeenCalled();

    // Kalibrierung: ein Bild, das KEIN Objekt trägt, bekommt Bert nicht — die Vorsortierung hat
    // das Urteil nicht geöffnet, sie hat nur die Menge verkleinert.
    const fremd = await upload(app, anna);
    const zu = await raw(app, bert, fremd);
    expect(zu.statusCode).toBe(404);
    expect(suche).toHaveBeenCalledWith([fremd]);
  });

  it("4 · der Papierkorb wird getrimmt wie in `KoService.list` — ein getrashter Träger öffnet nichts, auch nicht aus dem Speicher", async () => {
    const repos = inMemoryRepos();
    // Die Trägersuche liefert ROH inklusive Papierkorb (so wie SQL es täte): hier ein getrashtes,
    // internes Objekt mit einem Anhangseintrag des Hochladenden. UNGETRIMMT wäre das ein Nachweis
    // und Bert bekäme das Bild; getrimmt (und über `ko.get` frisch gelesen: `undefined`) bleibt nur
    // die Rücklage — und die ist ohne Stufe zu.
    repos.koRepo.listAnhangTraegerFuer = async (objectIds: readonly string[]) => [
      {
        id: "ko-trash",
        title: "Im Papierkorb",
        statement: "",
        type: "best_practice",
        category: "x",
        confidentiality: "intern",
        author: "u-anna",
        deletedAt: "2026-08-01T00:00:00.000Z",
        attachments: objectIds.map((objectId) => ({
          id: `a-${objectId}`,
          name: "b.png",
          mime: "image/png",
          objectId,
          author: "u-anna",
        })),
      } as unknown as KnowledgeObject,
    ];
    const app = buildApp(assembleServices(repos));
    const { anna, bert } = await konten(app, "v4");
    const objectId = await upload(app, anna);
    expect((await raw(app, bert, objectId)).statusCode).toBe(404);
  });
});
