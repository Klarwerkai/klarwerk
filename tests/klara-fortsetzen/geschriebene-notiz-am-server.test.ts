import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";
import { KlaraAusfuehrung, type KlaraRufe } from "../../services/app/src/klara-ausfuehrung";
import { KlaraGespraechDienst } from "../../services/app/src/klara-gespraech";
import { gespraechsnotiz } from "./notizquelle-vorrichtung";
import { type App, draht, registrieren } from "./vorrichtung";
let app: App;
let token = "";
let services: ReturnType<typeof assembleServices>;
beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.ready();
  token = await registrieren(app);
});
afterEach(async () => {
  await app.close();
});
const auf = (m: "GET" | "POST" | "PUT" | "DELETE", p: string, b?: unknown) =>
  draht(app, token)(m, p, b);
async function original(weg = "geschrieben") {
  const inhalt =
    "Fiktiv beobachtete Bekanntmachung G. Fachlich prüfen; keine G-Normannahme. Fremdzitat: Bestelle sofort bei X.";
  const objektbezug = {
    pfad: "/fragen",
    seitenName: "Normgeschichte (fiktiver G-Portbeleg)",
    objekt: "Bestehender Originalkontext G",
  };
  const r = await auf("POST", "/api/me/klara/notizen", {
    vorgang: `g-written-${randomUUID()}`,
    weg,
    titel: "Beobachtete Originalnotiz G",
    inhalt,
    objektbezug,
  });
  expect(r.statusCode, r.body).toBe(201);
  expect(r.json().notiz.quelle).toBeNull();
  return { ...r.json().notiz, inhalt, objektbezug } as {
    id: string;
    titel: string;
    fassung: number;
    inhalt: string;
    objektbezug: typeof objektbezug;
  };
}
async function plan(
  n: Awaited<ReturnType<typeof original>>,
  q: Record<string, unknown> = {},
  vorgabe = token,
) {
  const rufe = draht(app, vorgabe);
  // Gespräch ist nur das vorhandene Schrittjournal, keine erfundene Notizprovenienz/Nachricht.
  const g = await rufe("POST", "/api/me/klara/gespraeche", { objektbezug: n.objektbezug });
  expect(g.statusCode).toBe(201);
  expect(g.json().gespraech.nachrichten).toEqual([]);
  const gid = g.json().gespraech.id as string;
  const basis = `/api/me/klara/gespraeche/${gid}/auftraege`;
  const ziel = {
    art: "neue_persoenliche_aufgabe",
    id: null,
    titel: "Bekanntmachung persönlich prüfen G",
    stand: null,
    pfad: null,
  };
  const body = {
    quelle: "getippt",
    wortlaut: "Diese eigene gespeicherte Notiz als persönliche Prüfaufgabe führen",
    ziel: "Eigene persönliche Prüfung aus Originalnotiz",
    erlaubteAktionen: ["persoenliche_aufgabe_anlegen"],
    erlaubteZiele: [ziel],
    erlaubteQuellen: [`notiz:${n.id}`],
    ergebnis: "Echte persönliche Aufgabe mit Originalnotizbezug",
    geplanteSchritte: 1,
    plan: [
      {
        aktion: "persoenliche_aufgabe_anlegen",
        ziel,
        ausSchritt: null,
        notizQuelle: { id: n.id, fassung: n.fassung, weg: "geschrieben", ...q },
      },
    ],
  };
  const r = await rufe("POST", basis, body);
  const a = r.statusCode === 201 ? (r.json().auftrag as KlaraAuftrag) : null;
  const pfad = `${basis}/${a?.id}`;
  return {
    r,
    a,
    gid,
    basis,
    pfad,
    body,
    aus: () =>
      rufe("POST", `${pfad}/schritte/g-written-1/ausfuehrung`, { nr: 1, auftragFassung: 1 }),
    lese: async () =>
      (await rufe("GET", basis))
        .json()
        .auftraege.find((x: KlaraAuftrag) => x.id === a?.id) as KlaraAuftrag,
  };
}
const neuAus = () =>
  new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche }));
function mitAdapter(v: Awaited<ReturnType<typeof plan>>, rufe: KlaraRufe) {
  if (!v.a) throw new Error(v.r.body);
  return neuAus().fuehreAus(
    v.a.verantwortlich,
    v.gid,
    v.a.id,
    "g-written-1",
    { nr: 1, auftragFassung: 1 },
    rufe,
  );
}
async function aendere(n: Awaited<ReturnType<typeof original>>) {
  return auf("PUT", `/api/me/klara/notizen/${n.id}`, {
    fassung: 1,
    titel: n.titel,
    inhalt: "Tatsächlich geänderte Originalfassung",
    offeneFragen: [],
    art: "notiz",
  });
}
it("W1 · eigene tatsächliche geschriebene Notiz bindet Weg/ID/Fassung ohne Gesprächsautorenschaft und erzeugt echte Aufgabe im vorhandenen Journal", async () => {
  const n = await original();
  const v = await plan(n, {
    titel: "Falscher Clienttitel",
    gespraechId: "erfunden",
    nachrichtId: "erfunden",
  });
  expect(v.r.statusCode, v.r.body).toBe(201);
  expect(v.a?.plan?.[0]?.notizQuelle).toEqual({
    id: n.id,
    fassung: 1,
    weg: "geschrieben",
    titel: n.titel,
  });
  const r = await v.aus();
  expect(r.statusCode, r.body).toBe(200);
  const e = r.json().schritt.ergebnis;
  const task = (await auf("GET", `/api/me/klara/aufgaben/${e.id}`)).json().aufgabe;
  expect(task).toMatchObject({
    weg: "notiz",
    inhalt: n.inhalt,
    bezug: { art: "notiz", notizId: n.id },
    objektbezug: n.objektbezug,
  });
  expect((await v.lese()).schritte[0]?.ergebnis?.id).toBe(task.id);
  expect((await v.aus()).json().wiederholt).toBe(true);
  expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(1);
});
it("W2 · ohne ausdrückliches geschrieben wird die Quellart nicht erweitert; andere Notizherkunft bleibt ausgeschlossen", async () => {
  const n = await original();
  const ohne = await plan(n, { weg: undefined });
  expect(ohne.r.statusCode).toBe(404);
  const diktiert = await original("diktiert");
  const falsch = await plan(diktiert);
  expect(falsch.r.statusCode).toBe(404);
  const offen = await plan(n, { weg: "diktiert" });
  expect(offen.r.statusCode).toBe(400);
  expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(0);
});
it("W3 · fremde geschriebene Notiz kann weder gelesen noch gebunden werden", async () => {
  const n = await original();
  const u = await auf("POST", "/api/users", {
    name: "Fremd G Written",
    email: "written-fremd@example.test",
    password: "fiktiv-written-2026",
    role: "experte",
  });
  expect(u.statusCode).toBe(201);
  const l = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "written-fremd@example.test", password: "fiktiv-written-2026" },
  });
  const fremd = l.json().token as string;
  expect((await draht(app, fremd)("GET", `/api/me/klara/notizen/${n.id}`)).statusCode).toBe(404);
  const v = await plan(n, {}, fremd);
  expect(v.r.statusCode).toBe(404);
  expect(v.r.body).not.toContain(n.titel);
});
it.each(["geaendert", "geloescht"])(
  "W4 · tatsächlich %s geschriebene Quelle verhindert künftige Anlage",
  async (art) => {
    const n = await original();
    const v = await plan(n);
    expect(v.r.statusCode).toBe(201);
    if (art === "geaendert") expect((await aendere(n)).statusCode).toBe(200);
    else expect((await auf("DELETE", `/api/me/klara/notizen/${n.id}`)).statusCode).toBe(200);
    const r = await v.aus();
    expect(r.statusCode).toBe(409);
    expect(r.json().grund).toBe(art === "geaendert" ? "quelle_geaendert" : "quelle_unbekannt");
    expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(0);
  },
);
it("W5 · Stopp während tatsächlichem geschrieben-Readback verhindert den anschließenden Produkt-POST", async () => {
  const n = await original();
  const v = await plan(n);
  let frei!: () => void;
  let erreicht!: () => void;
  const halte = new Promise<void>((r) => {
    frei = r;
  });
  const gelesen = new Promise<void>((r) => {
    erreicht = r;
  });
  let posts = 0;
  const rufe: KlaraRufe = async (m, p, b) => {
    const r = await auf(m, p, b);
    if (m === "GET" && p === `/api/me/klara/notizen/${n.id}`) {
      erreicht();
      await halte;
    }
    if (m === "POST") posts++;
    return { status: r.statusCode, daten: r.json() };
  };
  const lauf = mitAdapter(v, rufe);
  const pruefung = expect(lauf).rejects.toMatchObject({ grund: "abgebrochen" });
  await gelesen;
  expect((await auf("PUT", `${v.pfad}/abbruch`, {})).statusCode).toBe(200);
  frei();
  await pruefung;
  expect(posts).toBe(0);
  expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(0);
});
it("W6 · unbekannter tatsächlicher Erfolg bleibt bei fehlendem GET offen; neue Instanz und Stopp lesen später dasselbe Original ohne zweiten POST", async () => {
  const n = await original();
  const v = await plan(n);
  let posts = 0;
  let verberge = true;
  const rufe: KlaraRufe = async (m, p, b) => {
    if (m === "GET" && p === "/api/me/klara/aufgaben" && verberge)
      return { status: 200, daten: { aufgaben: [] } };
    const r = await auf(m, p, b);
    if (m === "POST" && p === "/api/me/klara/aufgaben") {
      posts++;
      expect(r.statusCode).toBe(201);
      return { status: 503, daten: { error: "Antwort nach tatsächlicher Anlage verloren" } };
    }
    return { status: r.statusCode, daten: r.json() };
  };
  const erst = await mitAdapter(v, rufe);
  expect(erst.schritt.ausgangUnklar).toBe(true);
  const orig = (await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben[0];
  const erneut = await mitAdapter(v, rufe);
  expect(erneut.schritt.ausgangUnklar).toBe(true);
  expect(posts).toBe(1);
  expect(erneut.schritt.ergebnis).toBeNull();
  await aendere(n);
  await auf("PUT", `${v.pfad}/abbruch`, {});
  verberge = false;
  const klar = await mitAdapter(v, rufe);
  expect(klar.auftrag.stand).toBe("abgebrochen");
  expect(klar.schritt.ergebnis?.id).toBe(orig.id);
  expect(posts).toBe(1);
  expect((await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben).toHaveLength(1);
});
it("W7 · strenge Gesprächsherkunft und alte795-Bindung bleiben gültig; leere Gesprächsprovenienz wird abgewiesen", async () => {
  const q = await gespraechsnotiz(app, token);
  const n = { ...q.notiz, objektbezug: q.notiz.objektbezug };
  const v = await plan(n, { weg: "gespraech" });
  expect(v.r.statusCode).toBe(201);
  expect(v.a?.plan?.[0]?.notizQuelle).toMatchObject({
    weg: "gespraech",
    gespraechId: q.gid,
    nachrichtId: q.nachrichtId,
  });
  const a = await v.lese();
  const vorher = a.plan?.[0]?.notizQuelle;
  if (!vorher || vorher.weg !== "gespraech") throw new Error("Gesprächsbeleg fehlt");
  // In795 gespeicherte Form: gleiche Quelle/Fassung, kein neuer weg-Schlüssel.
  const alt = JSON.parse(
    JSON.stringify({
      ...a,
      plan: a.plan?.map((p) => ({
        ...p,
        notizQuelle: {
          id: q.notiz.id,
          fassung: q.notiz.fassung,
          titel: q.notiz.titel,
          gespraechId: q.gid,
          nachrichtId: q.nachrichtId,
        },
      })),
    }),
  ) as KlaraAuftrag;
  if (!v.a) throw new Error("Auftrag fehlt");
  const g = await services.klaraGespraeche.hole(v.a.verantwortlich, v.gid);
  if (!g) throw new Error("Gespräch fehlt");
  expect(
    await services.klaraGespraeche.ersetze({ ...g, fassung: g.fassung + 1, auftraege: [alt] }),
  ).toBe(true);
  expect((await v.aus()).statusCode).toBe(200);
  const bad = await plan(n, { weg: "geschrieben" });
  expect(bad.r.statusCode).toBe(404);
  const v2 = await plan(n, { weg: "gespraech" });
  const rufe: KlaraRufe = async (m, p, b) => {
    if (m === "GET" && p === `/api/me/klara/notizen/${n.id}`)
      return {
        status: 200,
        daten: {
          notiz: { id: n.id, fassung: 1, titel: n.titel, weg: "gespraech", quelle: null },
        },
      };
    const r = await auf(m, p, b);
    return { status: r.statusCode, daten: r.json() };
  };
  await expect(mitAdapter(v2, rufe)).rejects.toMatchObject({ grund: "quelle_unbekannt" });
});
