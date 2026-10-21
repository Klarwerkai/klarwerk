// RC1 · genau EINE neue Gegenprobe am aktuellen regulären Chat→Entwurf→Wissen-Port.
// Echte InMemory-App/HTTP-Guards/Quellrechte, nur fiktive Inhalte. Keine Ausführung bei Definition.
// Kein Modell/Provider/Socket: Reasoner ohne Modell, Mail/Push kontrolliert, fetch verboten.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { Reasoner } from "../../services/reasoner";

type Konto = { id: string; token: string };
type Entwurfsicht = {
  id: string;
  payload: { title?: string; statement?: string; bodyHtml?: string | null };
};
const KENNWORT = "Rc1-nur-fiktives-Kennwort-3";
const ZITAT = "Fiktive-RC1-Quellaussage-Linde: Prüfwert 61 nur vor Freigabe.";
const QUELLTITEL = "Fiktive RC1 Quelle Linde";
const EIGEN = "Mein eigener Ansatz: morgen die freie Checkliste ergänzen.";
let services: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
let admin: Konto;
let anna: Konto;
const apiAufrufe: string[] = [];
const netz = vi.fn(async () => { throw new Error("Kein äußerer Transport in der RC1-Probe"); });

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
  const me = await app.inject({ url: "/api/auth/me", headers: { authorization: `Bearer ${token}` } });
  expect(me.statusCode, me.body).toBe(200);
  return { id: me.json<{ id: string }>().id, token };
}
beforeEach(async () => {
  apiAufrufe.length = 0;
  netz.mockClear();
  vi.stubGlobal("fetch", netz);
  services = assembleServices(inMemoryRepos());
  // Nur die Testbühne: kein konfigurierter Cloud-/Local-Modellclient oder äußerer Versand.
  services.reasoner = new Reasoner();
  services.mailer = { send: async () => {} };
  services.push = undefined;
  app = buildApp(services);
  const a = await auf(null, "POST", "/api/auth/register", {
    name: "RC1 Admin fiktiv", email: "rc1-admin@klarwerk.test", password: KENNWORT,
  });
  expect(a.statusCode, a.body).toBe(201);
  admin = await anmelden("rc1-admin@klarwerk.test");
  const b = await auf(admin, "POST", "/api/users", {
    name: "RC1 Anna fiktiv", email: "rc1-anna@klarwerk.test", password: KENNWORT, role: "experte",
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

it("RC1: reguläre Chatkopie schützt List/Resume/Promote nach echtem Quellentzug, erhält Eigenes und erlaubt frische Wiedererteilung", async () => {
  const quelle = await services.ko.create({
    title: QUELLTITEL, statement: ZITAT, type: "best_practice", category: "RC1 fiktiv",
    confidentiality: "intern", author: admin.id,
  });
  const quellrecht = async (erlaubt: boolean) => {
    await services.ko.setQuellrechte(
      quelle.id, { stufe: "intern", leser: erlaubt ? [admin.id, anna.id] : [admin.id] }, admin.id,
    );
    const r = await auf(anna, "GET", `/api/kos/${quelle.id}`);
    expect(r.statusCode, r.body).toBe(erlaubt ? 200 : 404);
  };
  await quellrecht(true);
  const fassung = (await services.ko.get(quelle.id))?.version;
  if (!fassung) throw new Error("Berechtigte fiktive Quellfassung fehlt");
  const g = await auf(admin, "POST", "/api/chat/gespraeche", {
    art: "direkt", teilnehmer: [anna.id],
  });
  expect(g.statusCode, g.body).toBe(201);
  const gespraechId = g.json<{ id: string }>().id;
  const m = await auf(admin, "POST", `/api/chat/gespraeche/${gespraechId}/nachrichten`, {
    sendeKennung: "rc1-regulaere-chatnachricht-1", text: EIGEN,
    ausschnitt: { text: ZITAT, quelle: QUELLTITEL, fiktiv: false, koId: quelle.id, fassung },
  });
  expect(m.statusCode, m.body).toBe(201);
  const nachrichtId = m.json<{ nachricht: { id: string } }>().nachricht.id;
  const u = await auf(anna, "POST", `/api/chat/nachrichten/${nachrichtId}/wissen`);
  expect(u.statusCode, u.body).toBe(201);
  const entwurfId = u.json<{ entwurfId: string }>().entwurfId;
  const alterTab = await fortsetzen(entwurfId);
  expect(alterTab.payload.bodyHtml).toContain(ZITAT);
  expect(alterTab.payload.bodyHtml).toContain(QUELLTITEL);
  expect(alterTab.payload.bodyHtml).toContain(EIGEN);

  // Der wirkliche kanonische KO-Leseweg ist jetzt 404, dieselbe Person behält ihr Entwurfsrecht.
  await quellrecht(false);
  const liste = await auf(anna, "GET", "/api/drafts");
  expect(liste.statusCode, liste.body).toBe(200);
  expect(liste.json<Entwurfsicht[]>().some((d) => d.id === entwurfId)).toBe(true);
  // Erster semantischer Gegenpunkt auf unverändertem ae856; kein fixturebedingter Ersatzfehler.
  expect(liste.body).not.toContain(ZITAT);
  expect(liste.body).not.toContain(QUELLTITEL);
  expect(liste.body).not.toContain(quelle.id);
  const gesperrt = await fortsetzen(entwurfId);
  expect(JSON.stringify(gesperrt)).not.toContain(ZITAT);
  expect(JSON.stringify(gesperrt)).not.toContain(QUELLTITEL);
  expect(JSON.stringify(gesperrt)).not.toContain(quelle.id);
  expect(gesperrt.payload.bodyHtml).toContain(EIGEN);

  // Wiedererteilung liest dieselbe gespeicherte Kopie mit heutigen Rechten; kein neues Modell.
  await quellrecht(true);
  const wieder = await fortsetzen(entwurfId);
  expect(wieder.id).toBe(entwurfId);
  expect(wieder.payload.bodyHtml).toContain(ZITAT);
  expect(wieder.payload.bodyHtml).toContain(EIGEN);

  await quellrecht(false);
  // Reguläres Einreichen mit dem tatsächlich vor Entzug geladenen Clientwortlaut.
  const p = await auf(anna, "POST", `/api/drafts/${entwurfId}/promote`, {
    operationId: "rc1-regulaeres-promote-1",
    reviewerIds: [],
    draftPayload: { type: "best_practice", category: "RC1 fiktiv", bodyHtml: alterTab.payload.bodyHtml ?? "" },
  });
  // Ein neutral abgewiesener Übergang ist ebenso rechtmäßig, wenn der eigene Entwurf nutzbar
  // bleibt. 201 war die ursprüngliche Fixtureannahme, kein zusätzliches Originalkriterium.
  expect([201, 409], p.body).toContain(p.statusCode);
  expect(p.body).not.toContain(ZITAT);
  expect(p.body).not.toContain(QUELLTITEL);
  expect(p.body).not.toContain(quelle.id);
  if (p.statusCode === 409) {
    expect(p.json<{ error: string }>().error).toBe("SOURCE_NOT_AVAILABLE");
    const behalten = await fortsetzen(entwurfId);
    expect(behalten.payload.bodyHtml).toContain(EIGEN);
    expect(JSON.stringify(behalten)).not.toContain(ZITAT);
    expect(JSON.stringify(behalten)).not.toContain(QUELLTITEL);
    expect(JSON.stringify(behalten)).not.toContain(quelle.id);
    // Die Ablehnung schreibt den alten Tab nicht zurück und löscht keine gespeicherte Arbeit.
    expect((await services.capture.getDraft(entwurfId))?.payload.bodyHtml).toBe(
      alterTab.payload.bodyHtml,
    );
  } else {
    const id = p.json<{ id: string }>().id;
    const detail = await auf(anna, "GET", `/api/kos/${id}`);
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.body).not.toContain(ZITAT);
    expect(detail.body).not.toContain(QUELLTITEL);
    expect(detail.body).not.toContain(quelle.id);
    expect(detail.body).toContain(EIGEN);
  }
  expect(apiAufrufe.filter((url) => url === "/api/ask")).toHaveLength(0);
  expect(netz).not.toHaveBeenCalled();
});
