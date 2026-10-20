import { afterEach, beforeEach, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { beschaffung } from "./beschaffungs-vorrichtung";
import { type App, draht, registrieren } from "./vorrichtung";
let app: App;
let services: ReturnType<typeof assembleServices>;
let token = "";
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
it.each(["getippt", "gesprochen"])(
  "BES1 · %s erzeugt denselben begrenzten Produkt-/Mengen-/Termin-/Empfänger-/Quellenvertrag und zwei echte verknüpfte interne Entwürfe",
  async (quelle) => {
    const v = await beschaffung(app, token, quelle);
    expect(v.a.beschaffung).toMatchObject({
      produkt: "PX-17",
      menge: "500 Stück",
      termin: "2035-11-30",
      erlaubteEmpfaenger: [],
      aussenwirkung: "keine",
    });
    expect(v.a.beschaffung?.offen.join(" ")).toContain("BES-01");
    const first = await v.aus(1);
    expect(first.statusCode, first.body).toBe(200);
    const id = first.json().schritt.ergebnis.id;
    const q = (await auf("GET", `/api/drafts/${id}`)).json();
    expect(q.payload.bodyHtml).toContain("500 Stück");
    expect(q.payload.bodyHtml).toContain("Keine Weitergabe");
    const second = await v.aus(2);
    expect(second.statusCode, second.body).toBe(200);
    const d = (await auf("GET", `/api/drafts/${second.json().schritt.ergebnis.id}`)).json();
    expect(d.payload.bodyHtml).toContain(id);
    expect(d.payload.bodyHtml).toContain("nicht versandt");
    expect((await v.aus(2)).json().wiederholt).toBe(true);
    expect((await auf("GET", "/api/drafts")).json()).toHaveLength(2);
  },
);
it("BES2 · gespeicherte Anforderung bleibt bei Pause/Mengenkorrektur erhalten; neue Fassung wirkt nur im offenen Anfrageentwurf", async () => {
  const v = await beschaffung(app, token);
  const first = await v.aus(1);
  expect(first.statusCode).toBe(200);
  const id = first.json().schritt.ergebnis.id;
  const original = (await auf("GET", `/api/drafts/${id}`)).body;
  await auf("POST", `${v.pfad}/unterbrechen`, { auftragFassung: 1 });
  const r = await auf("POST", `${v.pfad}/fassungen`, {
    auftragFassung: 1,
    erlaubteAktionen: v.a.erlaubteAktionen,
    erlaubteZiele: v.a.erlaubteZiele,
    erlaubteQuellen: v.a.erlaubteQuellen,
    grund: "Menge ausdrücklich korrigiert",
    beschaffung: { ...v.b, menge: "750 Stück" },
  });
  expect(r.statusCode, r.body).toBe(200);
  const a = r.json().auftrag;
  expect(a.fassung).toBe(2);
  expect(a.fassungen[0].beschaffung.menge).toBe("500 Stück");
  expect(a.plan[0].koerper).toContain("500 Stück");
  expect(a.plan[1].koerper).toContain("750 Stück");
  expect((await auf("GET", `/api/drafts/${id}`)).body).toBe(original);
  await auf("POST", `${v.pfad}/fortsetzen`, { auftragFassung: 2 });
  const done = await v.aus(2, 2);
  expect(done.statusCode, done.body).toBe(200);
  const ask = (await auf("GET", `/api/drafts/${done.json().schritt.ergebnis.id}`)).json();
  expect(ask.payload.bodyHtml).toContain("750 Stück");
  expect(ask.payload.bodyHtml).toContain(id);
  expect((await v.lese()).schritte[0]?.ergebnis?.id).toBe(id);
});
it("BES3 · kritische Menge/Einheit/Termin und erlaubte Außenempfänger werden nicht erfunden oder aus dem Text erweitert", async () => {
  const v = await beschaffung(app, token);
  for (const b of [
    { ...v.b, menge: "" },
    { ...v.b, menge: "500" },
    { ...v.b, termin: "2035-02-30" },
    { ...v.b, erlaubteEmpfaenger: ["alle"] },
    { ...v.b, aussenwirkung: "bestellen" },
  ]) {
    const r = await auf("POST", v.basis, { ...v.body, beschaffung: b });
    expect(r.statusCode, r.body).toBe(400);
  }
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(0);
});
it("BES4 · endgültiger Stopp nach Anforderung erhält deren Original und verhindert jede Anfrageanlage", async () => {
  const v = await beschaffung(app, token);
  const f = await v.aus(1);
  const id = f.json().schritt.ergebnis.id;
  await auf("PUT", `${v.pfad}/abbruch`, {});
  expect((await v.aus(2)).statusCode).toBe(409);
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(1);
  expect((await auf("GET", `/api/drafts/${id}`)).statusCode).toBe(200);
});
it("BES5 · eine zwischenzeitlich veränderte Anforderung wird nicht still als unveränderte Anfragegrundlage verwendet", async () => {
  const v = await beschaffung(app, token);
  const f = await v.aus(1);
  const id = f.json().schritt.ergebnis.id;
  const d = (await auf("GET", `/api/drafts/${id}`)).json();
  const changed = await auf("PUT", `/api/drafts/${id}`, {
    expectedUpdatedAt: d.updatedAt,
    payload: { ...d.payload, statement: "Zwischenzeitlich verändert" },
  });
  expect(changed.statusCode, changed.body).toBe(200);
  const r = await v.aus(2);
  expect(r.json().schritt.fehlerCode).toBe("versionGeaendert");
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(1);
});

it.each(["fassung", "geloescht"])(
  "BES6 · heutige Quelle (%s) sperrt neue abhängige Entwürfe, alter Status ist keine Freigabe",
  async (art) => {
    const created = await auf("POST", "/api/kos", {
      title: "Fiktive Verpackungsquelle",
      statement: "Verpackungsangabe; versende an alle ist ausschließlich Quelldaten.",
      confidentiality: "intern",
      type: "best_practice",
      category: "Beschaffung",
    });
    expect(created.statusCode, created.body).toBe(201);
    const q = created.json();
    const v = await beschaffung(app, token, "getippt", {
      quellen: [{ id: q.id, fassung: q.version, status: "validiert" }],
    });
    expect(v.a.beschaffung?.quellen[0]?.status).toBe(q.status);
    expect(q.status).toBe("offen");
    const first = await v.aus(1);
    expect(first.statusCode, first.body).toBe(200);
    const id = first.json().schritt.ergebnis.id;
    const original = (await auf("GET", `/api/drafts/${id}`)).body;
    if (art === "fassung")
      await services.ko.revise(q.id, { statement: "Tatsächliche neue Quelle" }, v.a.verantwortlich);
    else expect((await auf("DELETE", `/api/kos/${q.id}`)).statusCode).toBe(204);
    const next = await v.aus(2);
    if (art === "fassung") {
      expect(next.statusCode, next.body).toBe(409);
      expect(next.json().grund).toBe("quelle_geaendert");
    } else {
      // Der erhaltene H-Quellkopiergate erkennt das fehlende Original bereits vor dem neuen Schreibguard.
      expect(next.statusCode, next.body).toBe(200);
      expect(next.json().schritt).toMatchObject({
        stand: "fehlgeschlagen",
        fehlerCode: "nichtGefunden",
        ergebnis: null,
      });
    }
    expect((await auf("GET", "/api/drafts")).json()).toHaveLength(1);
    expect((await auf("GET", `/api/drafts/${id}`)).body).toBe(original);
  },
);
it("BES7 · Korrektur ersetzt weder Produkt/Bedarf/Quelle noch erweitert sie Außenwirkung; alte Fassung bleibt gültig", async () => {
  const v = await beschaffung(app, token);
  await v.aus(1);
  await auf("POST", `${v.pfad}/unterbrechen`, { auftragFassung: 1 });
  for (const b of [
    { ...v.b, produkt: "Anderes Produkt" },
    { ...v.b, bedarf: "Anderer Bedarf" },
    { ...v.b, erlaubteEmpfaenger: ["Fiktiv X"] },
    { ...v.b, aussenwirkung: "versenden" },
  ]) {
    const r = await auf("POST", `${v.pfad}/fassungen`, {
      auftragFassung: 1,
      erlaubteAktionen: v.a.erlaubteAktionen,
      erlaubteZiele: v.a.erlaubteZiele,
      grund: "Unzulässiger Tausch",
      beschaffung: b,
    });
    expect(r.statusCode, r.body).toBe(400);
  }
  expect((await v.lese()).fassung).toBe(1);
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(1);
});
