import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryWorkflowLaeufe } from "../../services/app/src/teamworkflow-laeufe-repo";
import { ergebnisUmfeld } from "./ergebniswissen-fixture";

let s: ReturnType<typeof buildServices>;
let app: ReturnType<typeof buildApp>;
beforeEach(() => {
  s = buildServices();
  app = buildApp(s);
});
afterEach(() => app.close());
const titel = "Prüfprotokoll für den Einkauf";
const aussage = "Der Einkauf dokumentiert die Prüfung vor der Übergabe.";
const liste = "/api/teamworkflows/wissenspruefungen";

it("bindet das Quellenurteil serverseitig und legt auch bei paralleler Wiederholung nur einen nachvollziehbar bestätigten Artikel an", async () => {
  const f = await ergebnisUmfeld(s, app);
  const v = await f.leserApi("GET", f.b);
  expect(v.json()).toMatchObject({
    stand: "entwurf",
    kannVorschlagen: true,
    kannPruefen: false,
    aussage: f.aussage,
    zustaendig: f.autor.id,
    quellen: [{ id: f.ko.id, version: 1 }],
  });
  const daten = { titel, aussage, stempel: v.json().stempel };
  expect(
    (await f.leserApi("POST", f.b, { ...daten, quellen: [{ id: "fremd", version: 17 }] }))
      .statusCode,
  ).toBe(400);
  expect(
    (await f.leserApi("POST", f.b, { ...daten, stempel: "falscher-Stempel" })).statusCode,
  ).toBe(409);
  const einreichen = () => f.leserApi("POST", f.b, daten);
  const [a, b] = await Promise.all([einreichen(), einreichen()]);
  expect(a.statusCode, a.body).toBe(200);
  expect(b.json()).toEqual(a.json());
  expect(a.json()).toMatchObject({
    stand: "vorgeschlagen",
    vorgeschlagenVon: f.leser.id,
    kannPruefen: false,
  });
  expect((await s.ko.list()).some((k) => k.title === titel)).toBe(false);
  expect((await f.chef("GET", liste)).json().vorschlaege).toEqual([
    expect.objectContaining({ titel, ergebnisId: f.ergebnisId }),
  ]);
  expect((await f.leserApi("GET", liste)).json().vorschlaege).toEqual([]);
  expect((await f.fremdApi("GET", f.b)).statusCode).toBe(404);
  const entscheid = { entscheidung: "freigeben", stempel: a.json().stempel };
  expect((await f.leserApi("POST", `${f.b}/entscheiden`, entscheid)).statusCode).toBe(403);
  const anerkennen = () => f.chef("POST", `${f.b}/entscheiden`, entscheid);
  const [c, d] = await Promise.all([anerkennen(), anerkennen()]);
  expect(c.statusCode, c.body).toBe(200);
  expect(d.json()).toEqual(c.json());
  expect(c.json()).toMatchObject({
    stand: "freigegeben",
    koVersion: 1,
    entschiedenVon: f.autor.id,
  });
  const k = (await s.ko.list()).filter((k) => k.title === titel);
  expect(k).toHaveLength(1);
  expect(k[0]).toMatchObject({
    id: c.json().koId,
    author: f.leser.id,
    statement: aussage,
    status: "validiert",
    validationDecisionRef: { auditHash: expect.any(String) },
    sources: [
      {
        externalId: f.ergebnisId,
        workflowBezug: expect.objectContaining({ ergebnisId: f.ergebnisId }),
        workflowQuellart: "ergebnis",
        url: null,
        excerpt: null,
      },
      { externalId: f.ko.id, sourceVersion: 1, workflowQuellart: "wissensfassung", excerpt: null },
    ],
  });
  expect((await f.chef("GET", liste)).json().vorschlaege).toEqual([]);
});

it("verlangt für die Ablehnung einen Grund und schützt die Vorlage beim Entzug der Zuständigkeit", async () => {
  const f = await ergebnisUmfeld(s, app);
  const v = (await f.leserApi("GET", f.b)).json();
  const p = await f.leserApi("POST", f.b, { titel, aussage, stempel: v.stempel });
  const entscheid = { entscheidung: "ablehnen", stempel: p.json().stempel };
  expect((await f.chef("POST", `${f.b}/entscheiden`, entscheid)).statusCode).toBe(400);
  const r = await f.chef("POST", `${f.b}/entscheiden`, {
    ...entscheid,
    grund: "Geltungsbereich der Regel fehlt.",
  });
  expect(r.json()).toMatchObject({ stand: "abgelehnt", grund: "Geltungsbereich der Regel fehlt." });
  expect(
    (
      await f.chef("POST", `${f.b}/entscheiden`, {
        entscheidung: "freigeben",
        stempel: r.json().stempel,
      })
    ).statusCode,
  ).toBe(409);
  await s.teams.lege({ ...f.team, mitglieder: [f.autor.id], version: 2 });
  expect((await f.leserApi("GET", f.b)).statusCode).toBe(404);
  expect((await s.ko.list()).some((k) => k.title === titel)).toBe(false);
});

it("sperrt die firmenweite Weitergabe selbst für die leseberechtigte Verantwortliche wenn die Quellfassung nach Einreichung enger wird", async () => {
  const f = await ergebnisUmfeld(s, app);
  const v = (await f.leserApi("GET", f.b)).json();
  const p = await f.leserApi("POST", f.b, { titel, aussage, stempel: v.stempel });
  await s.ko.setConfidentiality(f.ko.id, "streng_vertraulich", f.autor.id);
  const d = await f.chef("POST", `${f.b}/entscheiden`, {
    entscheidung: "freigeben",
    stempel: p.json().stempel,
  });
  expect(d.statusCode, d.body).toBe(409);
  expect((await f.chef("GET", liste)).json().vorschlaege).toEqual([]);
  expect((await s.ko.list()).some((k) => k.title === titel)).toBe(false);
});

it("kann einen protokollierten menschlichen Beschluss ohne Assistenten mit dem Workflowbeleg freigeben", async () => {
  const f = await ergebnisUmfeld(s, app, "beschluss");
  const v = (await f.leserApi("GET", f.b)).json();
  expect(v).toMatchObject({
    stand: "entwurf",
    quellen: [],
    beschluss: { person: f.autor.id, auszug: "Beschluss zum sachlich geprüften Einkauf" },
    kannVorschlagen: true,
  });
  const p = await f.leserApi("POST", f.b, { titel, aussage: v.aussage, stempel: v.stempel });
  const a = await f.chef("POST", `${f.b}/entscheiden`, {
    entscheidung: "freigeben",
    stempel: p.json().stempel,
  });
  expect(a.statusCode, a.body).toBe(200);
  expect((await s.ko.get(a.json().koId))?.sources.map((q) => q.externalId)).toEqual([f.ergebnisId]);
});

it("sperrt einen reinen Ergebnisvermerk ohne fachlichen Beschluss oder belegte Wissensquelle", async () => {
  const f = await ergebnisUmfeld(s, app, "aktion");
  const v = (await f.leserApi("GET", f.b)).json();
  expect(v).toMatchObject({
    stand: "gesperrt",
    grund: "QUELLEN_FEHLEN",
    kannVorschlagen: false,
    quellen: [],
  });
  expect((await f.leserApi("POST", f.b, { titel, aussage, stempel: v.stempel })).statusCode).toBe(
    409,
  );
});

it("prüft den Teamwechsel unmittelbar im Speicherschreibweg, bevor die Artikelannahme sichtbar wird", async () => {
  const f = await ergebnisUmfeld(s, app);
  const v = (await f.leserApi("GET", f.b)).json();
  const p = await f.leserApi("POST", f.b, { titel, aussage, stempel: v.stempel });
  const original = InMemoryWorkflowLaeufe.prototype.speichern;
  const buchen = vi
    .spyOn(InMemoryWorkflowLaeufe.prototype, "speichern")
    .mockImplementationOnce(async function (this: InMemoryWorkflowLaeufe, lauf, basis, bindung) {
      await s.teams.lege({ ...f.team, version: 2, verantwortlich: f.leser.id });
      return original.call(this, lauf, basis, bindung);
    });
  try {
    const urteil = await f.chef("POST", `${f.b}/entscheiden`, {
      entscheidung: "freigeben",
      stempel: p.json().stempel,
    });
    expect(urteil.statusCode, urteil.body).toBe(409);
    expect(buchen).toHaveBeenCalledTimes(1);
  } finally {
    buchen.mockRestore();
  }
  expect((await s.ko.list()).some((k) => k.title === titel)).toBe(false);
  expect(await s.audit.list({ action: "ko.owner-validated" })).toEqual([]);
});
