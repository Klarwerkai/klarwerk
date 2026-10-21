// RC1 · genau EINE neue Definition für den regulären Chat→Entwurf→Dubletten-Titelport.
// Echte InMemory-App/HTTP-Guards/Quellrechte, nur fiktive Inhalte. Keine Ausführung bei Definition.
// Kein Modell/Provider/Socket: Reasoner ohne Modell, Mail/Push kontrolliert, fetch verboten.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { Reasoner } from "../../services/reasoner";

type Konto = { id: string; token: string };
type Entwurfsicht = {
  id: string;
  payload: { title?: string; statement?: string; bodyHtml?: string | null; tags?: string[] };
};
const KENNWORT = "Rc1-nur-fiktives-Kennwort-3";
const ZITAT = "Fiktive-RC1-Quellaussage-Linde: Prüfwert 61 nur vor Freigabe.";
const QUELLTITEL = "Fiktive RC1 Quelle Linde";
const EIGEN = "Mein eigener Ansatz: morgen die freie Checkliste ergänzen.";
let repos: ReturnType<typeof inMemoryRepos>;
let services: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
let admin: Konto;
let anna: Konto;
const apiAufrufe: string[] = [];
const netz = vi.fn(async () => {
  throw new Error("Kein äußerer Transport in der RC1-Probe");
});

async function auf(
  wer: Konto | null,
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: Record<string, unknown>,
) {
  apiAufrufe.push(url);
  return app.inject({
    method,
    url,
    headers: wer ? { authorization: `Bearer ${wer.token}` } : {},
    ...(payload ? { payload } : {}),
  });
}
async function anmelden(email: string): Promise<Konto> {
  const login = await auf(null, "POST", "/api/auth/login", { email, password: KENNWORT });
  expect(login.statusCode, login.body).toBe(200);
  const token = login.json<{ token: string }>().token;
  const me = await app.inject({
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(me.statusCode, me.body).toBe(200);
  return { id: me.json<{ id: string }>().id, token };
}
beforeEach(async () => {
  apiAufrufe.length = 0;
  netz.mockClear();
  vi.stubGlobal("fetch", netz);
  repos = inMemoryRepos();
  services = assembleServices(repos);
  // Nur die Testbühne: kein konfigurierter Cloud-/Local-Modellclient oder äußerer Versand.
  services.reasoner = new Reasoner();
  services.mailer = { send: async () => {} };
  delete services.push;
  app = buildApp(services);
  const a = await auf(null, "POST", "/api/auth/register", {
    name: "RC1 Admin fiktiv",
    email: "rc1-admin@klarwerk.test",
    password: KENNWORT,
  });
  expect(a.statusCode, a.body).toBe(201);
  admin = await anmelden("rc1-admin@klarwerk.test");
  const b = await auf(admin, "POST", "/api/users", {
    name: "RC1 Anna fiktiv",
    email: "rc1-anna@klarwerk.test",
    password: KENNWORT,
    role: "experte",
  });
  expect(b.statusCode, b.body).toBe(201);
  anna = await anmelden("rc1-anna@klarwerk.test");
});
afterEach(async () => {
  try {
    await services?.aiCheckWorker?.idle();
  } finally {
    await app?.close();
    vi.unstubAllGlobals();
  }
});
async function fortsetzen(id: string): Promise<Entwurfsicht> {
  const r = await auf(anna, "GET", `/api/drafts/${id}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json<Entwurfsicht>();
}

type Dublettensicht = {
  indexStatus: "vollstaendig" | "unvollstaendig";
  entwuerfe: { id: string; titel: string }[];
};

async function vorhandenerIndex(id: string) {
  const index = await repos.drafts.entwurfsIndexVon?.(id);
  if (!index) throw new Error("Der regulär geschriebene Entwurfsindex fehlt in der Testbühne");
  return structuredClone(index);
}

it("RC1-Dubletten: aktueller Quellentzug schützt gespeicherte Titel im regulären Dublettenport und erhält eigene Entwürfe und ihren Index", async () => {
  const quelle = await services.ko.create({
    title: QUELLTITEL,
    statement: ZITAT,
    type: "best_practice",
    category: "RC1 fiktiv",
    confidentiality: "intern",
    author: admin.id,
  });
  const quellrecht = async (erlaubt: boolean) => {
    await services.ko.setQuellrechte(
      quelle.id,
      { stufe: "intern", leser: erlaubt ? [admin.id, anna.id] : [admin.id] },
      admin.id,
    );
    const r = await auf(anna, "GET", `/api/kos/${quelle.id}`);
    expect(r.statusCode, r.body).toBe(erlaubt ? 200 : 404);
  };
  await quellrecht(true);
  const fassung = (await services.ko.get(quelle.id))?.version;
  if (!fassung) throw new Error("Die erlaubte fiktive Quellfassung fehlt");
  const g = await auf(admin, "POST", "/api/chat/gespraeche", {
    art: "direkt",
    teilnehmer: [anna.id],
  });
  expect(g.statusCode, g.body).toBe(201);
  const gespraechId = g.json<{ id: string }>().id;
  const ids: string[] = [];
  for (const nr of [1, 2]) {
    const m = await auf(admin, "POST", `/api/chat/gespraeche/${gespraechId}/nachrichten`, {
      sendeKennung: `rc1-dubletten-regulaere-nachricht-${nr}`,
      text: EIGEN,
      ausschnitt: { text: ZITAT, quelle: QUELLTITEL, fiktiv: false, koId: quelle.id, fassung },
    });
    expect(m.statusCode, m.body).toBe(201);
    const nachrichtId = m.json<{ nachricht: { id: string } }>().nachricht.id;
    const u = await auf(anna, "POST", `/api/chat/nachrichten/${nachrichtId}/wissen`);
    expect(u.statusCode, u.body).toBe(201);
    ids.push(u.json<{ entwurfId: string }>().entwurfId);
  }
  const [ersteId, zweiteId] = ids;
  if (!ersteId || !zweiteId || ersteId === zweiteId) {
    throw new Error("Zwei verschiedene reguläre Übernahmen fehlen");
  }
  const erster = await fortsetzen(ersteId);
  const bodyHtml = erster.payload.bodyHtml;
  if (typeof bodyHtml !== "string") throw new Error("Der erlaubte Übernahmerumpf fehlt");
  expect(bodyHtml).toContain(ZITAT);
  expect(bodyHtml).toContain(QUELLTITEL);
  expect(bodyHtml).toContain(EIGEN);

  // Legale Bearbeitung bei bestehendem Quellrecht: gleicher gespeicherter Inhalt, Quelltitel im
  // normalen Titelfeld. Keine manuelle Index-/Hashbefüllung und keine nachgeahmte Übernahmemarke.
  for (const id of ids) {
    const p = await auf(anna, "PUT", `/api/drafts/${id}`, {
      title: QUELLTITEL,
      statement: erster.payload.statement ?? EIGEN,
      bodyHtml,
    });
    expect(p.statusCode, p.body).toBe(200);
    expect(p.json<Entwurfsicht>().payload.title).toBe(QUELLTITEL);
  }
  await services.capture.indexArbeitAbgeschlossen();
  const [index1, index2] = await Promise.all([
    vorhandenerIndex(ersteId),
    vorhandenerIndex(zweiteId),
  ]);
  expect(index1.status).toBe("vollstaendig");
  expect(index2.status).toBe("vollstaendig");
  expect(index1.inhaltsHash).toBe(index2.inhaltsHash);
  const roh1 = structuredClone(await services.capture.getDraft(ersteId));
  const roh2 = structuredClone(await services.capture.getDraft(zweiteId));
  if (!roh1 || !roh2) throw new Error("Die gespeicherten eigenen Entwürfe fehlen");
  expect(roh1.payload.title).toBe(QUELLTITEL);
  expect(roh2.payload.title).toBe(QUELLTITEL);
  expect(index1.stand).toBe(roh1.updatedAt);
  expect(index2.stand).toBe(roh2.updatedAt);
  const vorher = await auf(anna, "GET", `/api/drafts/${ersteId}/gleicher-inhalt`);
  expect(vorher.statusCode, vorher.body).toBe(200);
  expect(vorher.json<Dublettensicht>()).toEqual({
    indexStatus: "vollstaendig",
    entwuerfe: [{ id: zweiteId, titel: QUELLTITEL }],
  });
  // Auch die Verwaltung bekommt keinen fremden privaten Entwurf über diesen Leseweg.
  const fremd = await auf(admin, "GET", `/api/drafts/${ersteId}/gleicher-inhalt`);
  expect(fremd.statusCode, fremd.body).toBe(404);

  await quellrecht(false);
  const eigenes = await fortsetzen(ersteId);
  expect(eigenes.payload.bodyHtml).toContain(EIGEN);
  expect(JSON.stringify(eigenes)).not.toContain(ZITAT);
  expect(JSON.stringify(eigenes)).not.toContain(QUELLTITEL);
  const nachher = await auf(anna, "GET", `/api/drafts/${ersteId}/gleicher-inhalt`);
  // Auch eine legitime neutrale Ablehnung dieses Hinweises ist möglich; das eigene Fortsetzen
  // muss weiter funktionieren. Die Fixture erfindet weder eine Trefferzahl noch einen HTTP-Zwang.
  expect([200, 404, 409], nachher.body).toContain(nachher.statusCode);
  if (nachher.statusCode === 404) expect(nachher.json<{ error: string }>().error).toBe("NOT_FOUND");
  if (nachher.statusCode === 409) expect(nachher.json<{ error: string }>().error).toBe("SOURCE_NOT_AVAILABLE");
  // Erster neuer semantischer Gegenpunkt: dieser andere reguläre Leseweg darf den gespeicherten
  // Quelltitel nicht umgehen. Eine erlaubte neutrale Ausgabe legt keine neue Trefferzahl fest.
  expect(nachher.body).not.toContain(QUELLTITEL);
  expect(nachher.body).not.toContain(ZITAT);
  expect(nachher.body).not.toContain(quelle.id);
  expect(await services.capture.getDraft(ersteId)).toEqual(roh1);
  expect(await services.capture.getDraft(zweiteId)).toEqual(roh2);
  expect(await vorhandenerIndex(ersteId)).toEqual(index1);
  expect(await vorhandenerIndex(zweiteId)).toEqual(index2);

  // Wiedererteilung nur am bestehenden Quellrechteweg: dieselben gespeicherten Entwürfe und
  // unveränderten Indizes werden erneut lesbar, ohne neue Übernahme oder Neuberechnung.
  await quellrecht(true);
  const wieder = await auf(anna, "GET", `/api/drafts/${ersteId}/gleicher-inhalt`);
  expect(wieder.statusCode, wieder.body).toBe(200);
  expect(wieder.json<Dublettensicht>()).toEqual(vorher.json<Dublettensicht>());
  expect(await vorhandenerIndex(ersteId)).toEqual(index1);
  expect(await vorhandenerIndex(zweiteId)).toEqual(index2);
  expect(apiAufrufe.filter((url) => url === "/api/ask")).toHaveLength(0);
  expect(netz).not.toHaveBeenCalled();
});

