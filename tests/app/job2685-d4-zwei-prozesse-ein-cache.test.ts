// ================================================================================================
// JOB 2685 D4 (Review R2-30) — ZWEI PROZESSE, EIN CACHE: der Schreibstand gehört der Ablage.
// ================================================================================================
//
// BEN an D3: „Kein Test lässt Prozess A einen 404-Kandidatenbestand wärmen, Prozess B an derselben
// Datenbank den Träger hinzufügen und Prozess A unmittelbar erneut abrufen." Und: „Ein
// prozesslokaler Singleton ist kein gemeinsamer Änderungsstand der PostgreSQL-Persistenz."
//
// ZWEI PROZESSE sind hier zwei `buildApp`-Instanzen — jede mit EIGENEM Kandidaten-Speicher (der
// lebt je Routen-Instanz, also je Prozess) — über EINEM Repository-Satz (`inMemoryRepos()` = eine
// Datenbank; die drei Ablagen teilen ein `Schreibstand`-Objekt, wie sie in Postgres eine Sequenz
// teilen). Der Stand kommt bei jedem Abruf aus der Ablage (`quellen.stand`, asynchron), nicht aus
// dem Prozess.
//
//   A · BENs DREISCHRITT: A wärmt 404 für Bert; B hängt das Bild an einen internen Träger; A ruft
//       sofort erneut ab → 200 und `no-store` (der alte vertrauliche Träger bleibt Mitträger), ohne
//       Uhrsprung, ohne Fristablauf.
//   B · KALIBRIERUNG — der Stand von D3: Prozess A mit EINGEFRORENEM (prozesslokalem) Stand sieht
//       das Schreiben aus B bis zum Fristablauf nicht. Damit ist belegt, dass der Stand aus der
//       Ablage es ist, der die Grenze schließt — nicht der geteilte Node-Prozess des Tests.
//   C · ZWEI BESTÄNDE teilen nichts: ein Schreiben in Datenbank 2 entwertet keinen Eintrag über
//       Datenbank 1 (keine Fehlentwertung durch einen globalen Zähler).
//   D · DER PREIS: zehn Bilder einer Seite = elf Standlesungen (O(1); der Fehltreffer liest zweimal)
//       und zwei Trägersuchen — nicht zehn Suchen; ein zweiter Aufruf innerhalb der Frist: zehn
//       Standlesungen, null Suchen.
//   E · VERDRAHTUNG: `assembleServices` reicht `anhangSchreibstand` des Repos als `anhangStand`
//       durch; ohne ihn arbeitet der Speicher nicht (Urteil über `kos`, kein Speicher).
import { describe, expect, it, vi } from "vitest";
import {
  type AppRepos,
  assembleServices,
  buildApp,
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

/** Konten in EINER Datenbank — angelegt über Prozess B, angemeldet je Prozess. */
async function konten(appA: App, appB: App, marke: string): Promise<{ anna: Auth; bert: Auth }> {
  await appB.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: `anna@${marke}.test`, password: "geheim12345" },
  });
  const anna = await login(appB, `anna@${marke}.test`, "geheim12345");
  const res = await appB.inject({
    method: "POST",
    url: "/api/users",
    headers: anna,
    payload: { name: "Bert", email: `bert@${marke}.test`, password: "geheim12345", role: "viewer" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Konto bert nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  // Bert meldet sich an PROZESS A an — dieselbe Datenbank, dieselben Konten.
  return { anna, bert: await login(appA, `bert@${marke}.test`, "geheim12345") };
}

async function upload(app: App, wer: Auth): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: wer,
    payload: {
      name: "schritt.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function objekt(
  app: App,
  wer: Auth,
  bodyHtml: string,
  confidentiality?: "vertraulich",
): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer,
    payload: {
      title: "Wartung der Presse",
      statement: "Ein Objekt mit Bild.",
      type: "best_practice",
      category: "Instandhaltung",
      bodyHtml,
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().id as string;
  if (confidentiality) {
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: wer,
      payload: { action: "confidentiality", level: confidentiality },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
  }
  return id;
}

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

/** Eine Datenbank, zwei Prozesse — jeder mit eigenem Dienstsatz und eigenem Kandidaten-Speicher. */
function zweiProzesse(einfrierenA = false) {
  const repos = inMemoryRepos();
  const suche = vi.fn(stellvertreterFuer(repos));
  repos.koRepo.listAnhangTraegerFuer = suche;
  const servicesA = assembleServices(repos);
  const servicesB = assembleServices(repos);
  const standA = vi.fn(servicesA.anhangStand ?? (async () => ""));
  if (einfrierenA) {
    // Der Stand von D3, nachgestellt: Prozess A führt seinen EIGENEN Zähler, den B nie berührt.
    servicesA.anhangStand = async () => "prozesslokal";
  } else {
    servicesA.anhangStand = standA;
  }
  return { repos, suche, standA, appA: buildApp(servicesA), appB: buildApp(servicesB) };
}

describe("JOB 2685 D4 · A · BENs Dreischritt: A wärmt 404, B hängt an, A ruft sofort erneut ab", () => {
  it("200 und `no-store` über Prozess A — ohne Uhrsprung, über eine neue Suche mit dem Stand aus der Ablage", async () => {
    const { appA, appB, suche } = zweiProzesse();
    const { anna, bert } = await konten(appA, appB, "d4a");
    const bild = await upload(appB, anna);
    await objekt(appB, anna, `<p><img src="/api/objects/${bild}/raw"></p>`, "vertraulich");
    suche.mockClear();
    // Prozess A wärmt: nur ein vertraulicher Träger → 404, Kandidaten gemerkt (in A).
    expect((await raw(appA, bert, bild)).statusCode).toBe(404);
    expect((await raw(appA, bert, bild)).statusCode).toBe(404);
    expect(suche).toHaveBeenCalledTimes(1);
    // Prozess B hängt das Bild an einen INTERNEN Träger — B kennt A's Speicher nicht.
    await objekt(appB, anna, `<p>Für alle: <img src="/api/objects/${bild}/raw"></p>`);
    // Prozess A ruft SOFORT erneut ab.
    const danach = await raw(appA, bert, bild);
    expect(danach.statusCode, danach.body).toBe(200);
    expect(danach.headers["cache-control"]).toBe("no-store"); // der vertrauliche Mitträger bleibt
    expect(suche).toHaveBeenCalledTimes(2);
    expect(suche.mock.calls[1]?.[0]).toEqual([bild]);
  });

  it("und umgekehrt: A wärmt 200, B entzieht (Hochstufung des einzigen Trägers) → A liefert sofort 404", async () => {
    const { appA, appB } = zweiProzesse();
    const { anna, bert } = await konten(appA, appB, "d4a2");
    const bild = await upload(appB, anna);
    const ko = await objekt(appB, anna, `<p><img src="/api/objects/${bild}/raw"></p>`);
    expect((await raw(appA, bert, bild)).statusCode).toBe(200);
    const stufe = await appB.inject({
      method: "PUT",
      url: `/api/kos/${ko}`,
      headers: anna,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
    const weg = await raw(appA, bert, bild);
    expect(weg.statusCode).toBe(404);
    expect(weg.headers["cache-control"]).toBe("no-store");
  });
});

describe("JOB 2685 D4 · B · KALIBRIERUNG — der Stand von D3 (prozesslokal) sieht das Schreiben aus B nicht", () => {
  it("mit eingefrorenem Stand in A bleibt es bis zum Fristablauf bei 404 — genau BENs Fenster; der Stand aus der Ablage ist es, der es schließt", async () => {
    const { appA, appB, suche } = zweiProzesse(true);
    const { anna, bert } = await konten(appA, appB, "d4b");
    const bild = await upload(appB, anna);
    await objekt(appB, anna, `<p><img src="/api/objects/${bild}/raw"></p>`, "vertraulich");
    suche.mockClear();
    expect((await raw(appA, bert, bild)).statusCode).toBe(404);
    await objekt(appB, anna, `<p>Für alle: <img src="/api/objects/${bild}/raw"></p>`);
    // A sieht nichts: sein Stand ändert sich nie, der Eintrag gilt bis zur Frist.
    expect((await raw(appA, bert, bild)).statusCode).toBe(404);
    expect(suche).toHaveBeenCalledTimes(1);
    // Prozess B selbst (Stand aus der Ablage) sieht es sofort.
    expect((await raw(appB, bert, bild)).statusCode).toBe(200);
  });
});

describe("JOB 2685 D4 · C · zwei Bestände teilen nichts", () => {
  it("ein Schreiben in Datenbank 2 entwertet keinen Eintrag über Datenbank 1 — kein globaler Zähler mehr", async () => {
    const eins = zweiProzesse();
    const zwei = zweiProzesse();
    const k1 = await konten(eins.appA, eins.appB, "d4c1");
    const k2 = await konten(zwei.appA, zwei.appB, "d4c2");
    const bild = await upload(eins.appB, k1.anna);
    await objekt(eins.appB, k1.anna, `<p><img src="/api/objects/${bild}/raw"></p>`);
    eins.suche.mockClear();
    expect((await raw(eins.appA, k1.bert, bild)).statusCode).toBe(200);
    expect(eins.suche).toHaveBeenCalledTimes(1);
    // Datenbank 2 schreibt — Datenbank 1 merkt davon nichts.
    await objekt(zwei.appB, k2.anna, "<p>fremder Bestand</p>");
    expect((await raw(eins.appA, k1.bert, bild)).statusCode).toBe(200);
    expect(eins.suche).toHaveBeenCalledTimes(1);
  });
});

describe("JOB 2685 D4 · D · der Preis: eine Standlesung je Abruf, zwei Suchen je Seite", () => {
  it("zehn Bilder: elf Standlesungen (O(1)), zwei Suchen; zweiter Aufruf innerhalb der Frist: zehn Standlesungen, keine Suche", async () => {
    const { appA, appB, suche, standA } = zweiProzesse();
    const { anna, bert } = await konten(appA, appB, "d4d");
    const bilder: string[] = [];
    for (let i = 0; i < 10; i++) {
      bilder.push(await upload(appB, anna));
    }
    await objekt(
      appB,
      anna,
      bilder.map((id) => `<p><img src="/api/objects/${id}/raw"></p>`).join(""),
    );
    suche.mockClear();
    standA.mockClear();
    for (const id of bilder) {
      expect((await raw(appA, bert, id)).statusCode).toBe(200);
    }
    // Elf, nicht zehn: der EINE Fehltreffer (Bild 1) liest den Stand zweimal — einmal am Speicher,
    // einmal unmittelbar vor der Suche (nach dem Warten in der Reihe, D3) —, die neun Treffer je
    // einmal. Jede Lesung ist O(1) (eine Zeile per Primärschlüssel), keine ist ein Tabellenscan.
    expect(standA).toHaveBeenCalledTimes(11);
    expect(suche).toHaveBeenCalledTimes(2);
    for (const id of bilder) {
      expect((await raw(appA, bert, id)).statusCode).toBe(200);
    }
    expect(standA).toHaveBeenCalledTimes(21);
    expect(suche).toHaveBeenCalledTimes(2);
  });
});

describe("JOB 2685 D4 · E · Verdrahtung", () => {
  it("assembleServices reicht `anhangSchreibstand` des Repos gebunden als `anhangStand` durch; die drei Speicher-Ablagen eines Satzes teilen den Stand", async () => {
    const repos = inMemoryRepos();
    const services = assembleServices(repos);
    expect(typeof services.anhangStand).toBe("function");
    const vorher = await services.anhangStand?.();
    await repos.evidence.append({
      id: "e-x",
      koId: "ko-x",
      koVersion: 1,
      kind: "attachment",
      objectId: "obj-x",
      createdBy: "u",
      createdAt: "2026-08-29T00:00:00.000Z",
    } as never);
    expect(await services.anhangStand?.()).not.toBe(vorher);
    expect(await repos.koRepo.anhangSchreibstand?.()).toBe(await services.anhangStand?.());
  });

  it("ohne Stand aus der Ablage arbeitet der Speicher nicht: jeder Abruf urteilt über `kos`, keine Mehrfachsuche", async () => {
    const repos = inMemoryRepos();
    const suche = vi.fn(stellvertreterFuer(repos));
    repos.koRepo.listAnhangTraegerFuer = suche;
    // Eine Ablage ohne Schreibstand (etwa eine fremde Implementierung des Vertrags).
    Object.defineProperty(repos.koRepo, "anhangSchreibstand", { value: undefined });
    const app = buildApp(assembleServices(repos));
    const { anna, bert } = await konten(app, app, "d4e");
    const bild = await upload(app, anna);
    await objekt(app, anna, `<p><img src="/api/objects/${bild}/raw"></p>`);
    suche.mockClear();
    expect((await raw(app, bert, bild)).statusCode).toBe(200);
    expect((await raw(app, bert, bild)).statusCode).toBe(200);
    expect(suche).toHaveBeenCalledTimes(0); // kein Speicher → `kos(objectId)`, nicht `kosFuer`
  });
});
