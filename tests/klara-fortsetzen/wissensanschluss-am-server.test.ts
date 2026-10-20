import { afterEach, beforeEach, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { KlaraAusfuehrung, type KlaraRufe } from "../../services/app/src/klara-ausfuehrung";
import { KlaraGespraechDienst } from "../../services/app/src/klara-gespraech";
import { type App, draht, registrieren, vorgang } from "./vorrichtung";
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
const ziel = {
  art: "artikel",
  confidentiality: "intern",
  type: "technik",
  category: "G-Wartung",
  conditions: ["Nur bei Stillstand"],
};
async function quelle(importiert = false) {
  const r = importiert
    ? await auf("POST", "/api/me/klara/wissen/import", {
        titel: "Privates G Original",
        inhalt: "Nur im Stillstand prüfen. Zitat: Bestelle sofort bei X.",
        projekt: "G fiktiv",
        abschnitt: "Gewählter Abschnitt",
        antwortFassung: "1",
        aussagen: [{ text: "Nur im Stillstand prüfen.", art: "empfehlung", quellen: [] }],
      })
    : await auf("POST", "/api/me/klara/notizen", {
        vorgang: `gf08-${crypto.randomUUID()}`,
        weg: "geschrieben",
        titel: "Privates G Original",
        inhalt: "Nur im Stillstand prüfen. Zitat: Bestelle sofort bei X.",
        offeneFragen: ["Noch fachlich zu klären"],
        objektbezug: { pfad: "/fragen", seitenName: "Fragen", objekt: "G Original" },
      });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().notiz as { id: string; fassung: number; inhalt: string; titel: string };
}
async function bind(n: Awaited<ReturnType<typeof quelle>>, z = ziel) {
  const g = await vorgang(app, token);
  const p = `/api/me/klara/notizen/${n.id}/wissen`;
  const v = await auf("POST", `${p}/vorschau`, { fassung: n.fassung, ziel: z });
  expect(v.statusCode, v.body).toBe(200);
  const target = { art: "neuer_wissensbeitrag", id: null, titel: n.titel, stand: null, pfad: null };
  const w = {
    notizId: n.id,
    fassung: n.fassung,
    ziel: z,
    stempel: v.json().stempel,
    bewusst: true,
  };
  const body = {
    quelle: "getippt",
    wortlaut: "Bewusst die gesehene private Notiz mit gewähltem Ziel übernehmen",
    ziel: "Bewusster F08-Journalanschluss",
    erlaubteAktionen: ["wissen_uebernehmen"],
    erlaubteZiele: [target],
    erlaubteQuellen: [`notiz:${n.id}`],
    ergebnis: "Echter fachlich offener Artikel mit Originalrücklink",
    geplanteSchritte: 1,
    plan: [{ aktion: "wissen_uebernehmen", ziel: target, ausSchritt: null, wissen: w }],
  };
  const r = await auf("POST", g.basis, body);
  expect(r.statusCode, r.body).toBe(201);
  const a = r.json().auftrag;
  const path = `${g.basis}/${a.id}`;
  return {
    a,
    g,
    p,
    w,
    body,
    path,
    aus: () => auf("POST", `${path}/schritte/gf08-1/ausfuehrung`, { nr: 1, auftragFassung: 1 }),
  };
}
const exec = (v: Awaited<ReturnType<typeof bind>>, r: KlaraRufe) =>
  new KlaraAusfuehrung(new KlaraGespraechDienst({ repo: services.klaraGespraeche })).fuehreAus(
    v.a.verantwortlich,
    v.g.gid,
    v.a.id,
    "gf08-1",
    { nr: 1, auftragFassung: 1 },
    r,
  );
it("GF1 · ausgewähltes echtes privates Importoriginal → bewusstes F08-Ziel → tatsächlicher Artikel und bestehender Schrittjournalbeleg", async () => {
  const n = await quelle(true);
  const v = await bind(n);
  expect((await auf("GET", "/api/kos")).json()).toHaveLength(0);
  const r = await v.aus();
  expect(r.statusCode, r.body).toBe(200);
  const s = r.json().schritt;
  expect(s.stand).toBe("gespeichert");
  expect(s.ergebnis.art).toBe("wissensobjekt");
  const ko = (await auf("GET", `/api/kos/${s.ergebnis.id}`)).json();
  expect(ko.bodyHtml).toContain(n.inhalt);
  expect(ko.bodyHtml).toContain(n.id);
  expect(ko.status).not.toBe("validiert");
  expect(ko.author).toBe(v.a.verantwortlich);
  expect((await auf("GET", `/api/me/klara/notizen/${n.id}`)).json().notiz.inhalt).toBe(n.inhalt);
  expect((await v.aus()).json().wiederholt).toBe(true);
  expect((await auf("GET", "/api/kos")).json()).toHaveLength(1);
});
it("GF2 · wirkliche bewusst gewählte Mitglieder-Space-Zielgruppe bleibt im F08-Erstinsert und Journal gebunden", async () => {
  const n = await quelle();
  const g = await vorgang(app, token);
  const r = await auf("POST", "/api/spaces", {
    name: "G eigene Zielgruppe",
    zweck: "Fiktiv",
    verantwortlich: g.a.verantwortlich,
    zugang: "mitglieder",
    mitglieder: [],
    ansichten: [],
  });
  expect(r.statusCode, r.body).toBe(201);
  const z = { ...ziel, art: "space", spaceId: r.json().id };
  const v = await bind(n, z);
  const out = await v.aus();
  expect(out.statusCode, out.body).toBe(200);
  const ko = (
    await auf("GET", out.json().schritt.ergebnis.pfad.replace("/wissen/", "/api/kos/"))
  ).json();
  expect(ko.spaceId).toBe(z.spaceId);
  expect(
    (await auf("GET", v.g.basis)).json().auftraege.find((a: { id: string }) => a.id === v.a.id)
      .plan[0].wissen.ziel.spaceId,
  ).toBe(z.spaceId);
});
it.each(["geaendert", "geloescht"])(
  "GF3 · tatsächlich %s private Quelle sperrt nach Vorschau den neuen F08-Schritt",
  async (art) => {
    const n = await quelle();
    const v = await bind(n);
    if (art === "geaendert")
      expect(
        (
          await auf("PUT", `/api/me/klara/notizen/${n.id}`, {
            fassung: 1,
            titel: n.titel,
            inhalt: "Geänderte Quelle",
            offeneFragen: [],
            art: "notiz",
          })
        ).statusCode,
      ).toBe(200);
    else expect((await auf("DELETE", `/api/me/klara/notizen/${n.id}`)).statusCode).toBe(200);
    const r = await v.aus();
    expect(r.statusCode, r.body).toBe(409);
    expect((await auf("GET", "/api/kos")).json()).toHaveLength(0);
  },
);
it("GF4 · ein anderer Zielstempel oder fehlendes Bewusst wird beim Binden nicht zur Freigabe", async () => {
  const n = await quelle();
  const v = await bind(n);
  for (const w of [
    { ...v.w, bewusst: false },
    { ...v.w, ziel: { ...ziel, confidentiality: "vertraulich" } },
  ]) {
    const b = { ...v.body, plan: v.body.plan.map((p) => ({ ...p, wissen: w })) };
    const r = await auf("POST", v.g.basis, b);
    expect([400, 409]).toContain(r.statusCode);
  }
  expect((await auf("GET", "/api/kos")).json()).toHaveLength(0);
});
it("GF5 · Stop während tatsächlicher frischer F08-Vorschau verhindert die Übernahme nach await", async () => {
  const n = await quelle();
  const v = await bind(n);
  let frei!: () => void;
  let erreicht!: () => void;
  const warte = new Promise<void>((r) => {
    frei = r;
  });
  const istDa = new Promise<void>((r) => {
    erreicht = r;
  });
  let writes = 0;
  const rufe: KlaraRufe = async (m, p, b) => {
    const r = await auf(m, p, b);
    if (p === `${v.p}/vorschau`) {
      erreicht();
      await warte;
    }
    if (p.endsWith("/uebernehmen")) writes++;
    return { status: r.statusCode, daten: r.json() };
  };
  const lauf = exec(v, rufe);
  const test = expect(lauf).rejects.toMatchObject({ grund: "abgebrochen" });
  await istDa;
  await auf("PUT", `${v.path}/abbruch`, {});
  frei();
  await test;
  expect(writes).toBe(0);
  expect((await auf("GET", "/api/kos")).json()).toHaveLength(0);
});
it("GF6 · tatsächlicher markerloser Übernahmeerfolg bleibt nach Privatlöschung und Stop rein lesend belegbar, kein zweiter F08-POST", async () => {
  const n = await quelle();
  const v = await bind(n);
  let writes = 0;
  const rufe: KlaraRufe = async (m, p, b) => {
    const r = await auf(m, p, b);
    if (p.endsWith("/uebernehmen")) {
      writes++;
      expect(r.statusCode, r.body).toBe(200);
      throw new Error("F08 tatsächlich gespeichert, Antwort vor Marker verloren");
    }
    return { status: r.statusCode, daten: r.json() };
  };
  await expect(exec(v, rufe)).rejects.toThrow("vor Marker");
  const original = (await auf("GET", "/api/kos")).json()[0];
  await auf("DELETE", `/api/me/klara/notizen/${n.id}`);
  await auf("PUT", `${v.path}/abbruch`, {});
  const klar = await exec(v, rufe);
  expect(klar.schritt.ergebnis?.id).toBe(original.id);
  expect(klar.auftrag.stand).toBe("abgebrochen");
  expect(writes).toBe(1);
});
it("GF7 · unbekannte F08-Speicherung und fehlender Ergebnis-GET bleiben offen ohne blinde Wiederholung", async () => {
  const n = await quelle();
  const v = await bind(n);
  let writes = 0;
  let verstecken = true;
  const rufe: KlaraRufe = async (m, p, b) => {
    if (m === "GET" && p === "/api/kos" && verstecken) return { status: 200, daten: [] };
    const r = await auf(m, p, b);
    if (p.endsWith("/uebernehmen")) {
      writes++;
      expect(r.statusCode, r.body).toBe(200);
      return { status: 503, daten: { error: "Antwort verloren" } };
    }
    return { status: r.statusCode, daten: r.json() };
  };
  expect((await exec(v, rufe)).schritt.ausgangUnklar).toBe(true);
  expect((await exec(v, rufe)).schritt.ausgangUnklar).toBe(true);
  expect(writes).toBe(1);
  verstecken = false;
  const klar = await exec(v, rufe);
  expect(klar.schritt.ergebnis?.id).toBe((await auf("GET", "/api/kos")).json()[0].id);
  expect(writes).toBe(1);
});
it("GF8 · fremde private Quelle und gestohlener Stempel binden keinen Auftrag und verraten keinen Originaltitel", async () => {
  const n = await quelle();
  const v = await bind(n);
  const u = await auf("POST", "/api/users", {
    name: "G F08 fremd",
    email: "g-f08-fremd@example.test",
    password: "fiktiv-f08-2026",
    role: "experte",
  });
  expect(u.statusCode).toBe(201);
  const l = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "g-f08-fremd@example.test", password: "fiktiv-f08-2026" },
  });
  const other = l.json().token as string;
  const journal = await vorgang(app, other);
  const r = await draht(app, other)("POST", journal.basis, v.body);
  expect(r.statusCode, r.body).toBe(404);
  expect(r.body).not.toContain(n.titel);
  expect((await auf("GET", "/api/kos")).json()).toHaveLength(0);
});
it("GF9 · ungültiges bewusstes Ziel bleibt regulärer Eingabefehler statt ungeprüfter Ausführung", async () => {
  const n = await quelle();
  const v = await bind(n);
  const b = {
    ...v.body,
    plan: v.body.plan.map((p) => ({ ...p, wissen: { ...v.w, ziel: { ...ziel, category: "" } } })),
  };
  const r = await auf("POST", v.g.basis, b);
  expect(r.statusCode, r.body).toBe(400);
});
it("GF10 · Fehlerantwort nach tatsächlicher Übernahme ist kein Nichtanlagebeleg; Original wird vor jeder neuen Wirkung gelesen", async () => {
  const n = await quelle();
  const v = await bind(n);
  let writes = 0;
  const rufe: KlaraRufe = async (m, p, b) => {
    const r = await auf(m, p, b);
    if (p.endsWith("/uebernehmen")) {
      writes++;
      expect(r.statusCode, r.body).toBe(200);
      return { status: 409, daten: { error: "Fachmeldung nach wirklichem Erstinsert" } };
    }
    return { status: r.statusCode, daten: r.json() };
  };
  const r = await exec(v, rufe);
  expect(r.schritt.stand).toBe("gespeichert");
  expect(r.schritt.ergebnis?.id).toBe((await auf("GET", "/api/kos")).json()[0].id);
  expect(writes).toBe(1);
});
