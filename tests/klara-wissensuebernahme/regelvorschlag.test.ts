import { afterEach, beforeEach, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { anmelden, draht, registrieren } from "../klara-fortsetzen/vorrichtung";

const frage = "Welche Einkaufsfreigabe gilt für den Axolitkuppler?";
const regelAlt = "Die Einkaufsfreigabe für den Axolitkuppler erfordert ein Angebot.";
const regelNeu = "Die Einkaufsfreigabe für den Axolitkuppler erfordert drei Angebote.";
const privat = "Private Notiz zur Personalplanung.";
let app: ReturnType<typeof buildApp>;
let services: ReturnType<typeof buildServices>;
let pruefer: ReturnType<typeof draht>;
let autor: ReturnType<typeof draht>;
let leser: ReturnType<typeof draht>;
beforeEach(async () => {
  services = buildServices();
  app = buildApp(services);
  pruefer = draht(app, await registrieren(app));
  async function konto(name: string, role: string) {
    const email = `${name}@fiktiv.test`;
    const neu = await pruefer("POST", "/api/users", {
      name,
      email,
      role,
      password: "fiktiver-g-test-2026",
    });
    expect(neu.statusCode, neu.body).toBe(201);
    return draht(app, await anmelden(app, email));
  }
  autor = await konto("einkauf", "experte");
  leser = await konto("lager", "viewer");
});
afterEach(() => app.close());

async function ausgangslage() {
  const k = await pruefer("POST", "/api/kos", {
    title: "Einkaufsfreigabe Axolitkuppler",
    statement: regelAlt,
    type: "best_practice",
    category: "Einkauf",
    confidentiality: "intern",
    neededValidations: 1,
  });
  expect(k.statusCode, k.body).toBe(201);
  const ziel = `/api/kos/${k.json().id}`;
  const validiert = await pruefer("PUT", ziel, { action: "rate", verdict: "up" });
  expect(validiert.statusCode, validiert.body).toBe(200);
  const meeting = await autor("POST", "/api/me/klara/besprechungen/import", {
    titel: "Sitzung Einkauf",
    meetingId: "einkauf-sitzung",
    berechtigt: true,
    text: `Beschluss: ${regelNeu}\nOffen: ${privat}`,
  });
  expect(meeting.statusCode, meeting.body).toBe(200);
  const n = meeting.json().notiz;
  const uebergabe = await autor("POST", `/api/me/klara/besprechungen/${n.id}/uebernehmen`, {
    fassung: n.fassung,
    bewusst: true,
    auswahl: ["zeile-1"],
  });
  expect(uebergabe.statusCode, uebergabe.body).toBe(200);
  const notizId = uebergabe.json().notizId;
  const notiz = await autor("GET", `/api/me/klara/notizen/${notizId}`);
  expect(notiz.body).toContain(regelNeu);
  expect(notiz.json().notiz.inhalt).not.toContain(privat);
  return {
    ziel,
    pfad: `/api/me/klara/notizen/${notizId}/wissen`,
    notizId,
    daten: {
      modus: "regelvorschlag",
      fassung: notiz.json().notiz.fassung,
      koId: k.json().id,
      basis: k.json().version,
      auszug: regelNeu,
      aussage: regelNeu,
    },
  };
}

it("gibt aus einem ausgewählten Einkaufsbeschluss genau eine neue, menschlich geprüfte Fassung für die nächste Frage aus", async () => {
  const { ziel, pfad, daten, notizId } = await ausgangslage();
  const v = await autor("POST", `${pfad}/vorschau`, daten);
  expect(v.statusCode, v.body).toBe(200);
  expect(v.json()).toMatchObject({ bisher: regelAlt, aussage: regelNeu });
  expect((await leser("GET", `${pfad}/stand`)).statusCode).toBe(404);
  expect((await pruefer("POST", `${pfad}/vorschau`, daten)).statusCode).toBe(404);
  const eingabe = { ...daten, stempel: v.json().stempel, bewusst: true };
  expect(
    (await autor("POST", `${pfad}/uebernehmen`, { ...eingabe, auszug: privat })).statusCode,
  ).toBe(400);
  const [a, b] = await Promise.all([
    autor("POST", `${pfad}/uebernehmen`, eingabe),
    autor("POST", `${pfad}/uebernehmen`, eingabe),
  ]);
  expect(a.statusCode, a.body).toBe(200);
  expect(b.json(), b.body).toEqual(a.json());
  const alteFassung = await pruefer("GET", ziel);
  expect(alteFassung.json().proposals).toHaveLength(1);
  const p = alteFassung.json().proposals[0];
  expect(p).toMatchObject({
    statement: regelNeu,
    status: "offen",
    baseVersion: 1,
    notizbeleg: { notizId, auszug: regelNeu, fassung: 1 },
  });
  expect(JSON.stringify(p)).not.toContain(privat);
  async function frageAlsLeser(soll: string, falsch: string) {
    const antwort = await leser("POST", "/api/ask", { question: frage });
    expect(antwort.statusCode, antwort.body).toBe(200);
    expect(antwort.json().result).toMatchObject({ answered: true, sources: [daten.koId] });
    expect(antwort.json().result.answer).toContain(soll);
    expect(antwort.json().result.answer).not.toContain(falsch);
  }
  await frageAlsLeser("ein Angebot", "drei Angebote");
  const entscheid = { action: "decide-proposal", proposalId: p.id, expectedVersion: 1 };
  expect((await autor("PUT", ziel, { ...entscheid, decision: "uebernehmen" })).statusCode).toBe(
    403,
  );
  const rueckfrage = await pruefer("PUT", ziel, {
    ...entscheid,
    decision: "rueckfrage",
    note: "Ab wann gilt der Beschluss?",
  });
  expect(rueckfrage.statusCode, rueckfrage.body).toBe(200);
  expect((await autor("GET", `${pfad}/stand`)).json().regelvorschlaege).toMatchObject([
    { stand: "rueckfrage", basis: 1, grund: "Ab wann gilt der Beschluss?" },
  ]);
  const result = await pruefer("PUT", ziel, { ...entscheid, decision: "uebernehmen" });
  expect(result.statusCode, result.body).toBe(200);
  expect(result.json()).toMatchObject({
    id: daten.koId,
    version: 2,
    status: "validiert",
    statement: regelNeu,
  });
  expect((await pruefer("PUT", ziel, { ...entscheid, decision: "uebernehmen" })).statusCode).toBe(
    409,
  );
  expect((await autor("GET", `${pfad}/stand`)).json().regelvorschlaege).toMatchObject([
    {
      stand: "uebernommen",
      basis: 1,
      ergebnisVersion: 2,
      aktuelleVersion: 2,
      aktuelleVersionFreigegeben: true,
    },
  ]);
  await frageAlsLeser("drei Angebote", "ein Angebot");
  const aenderung = await pruefer("PUT", ziel, {
    action: "revise",
    changes: { statement: "Die Einkaufsfreigabe für den Axolitkuppler erfordert vier Angebote." },
  });
  expect(aenderung.statusCode, aenderung.body).toBe(200);
  const aktuellerStand = async () => {
    const antwort = await autor("GET", `${pfad}/stand`);
    expect(antwort.statusCode, antwort.body).toBe(200);
    return antwort.json().regelvorschlaege;
  };
  expect(await aktuellerStand()).toMatchObject([
    {
      stand: "uebernommen",
      ergebnisVersion: 2,
      aktuelleVersion: 3,
      aktuelleVersionFreigegeben: false,
    },
  ]);
  const bestaetigt = await pruefer("PUT", ziel, {
    action: "rate",
    verdict: "up",
    expectedVersion: 3,
  });
  expect(bestaetigt.statusCode, bestaetigt.body).toBe(200);
  expect(await aktuellerStand()).toMatchObject([
    {
      stand: "uebernommen",
      ergebnisVersion: 2,
      aktuelleVersion: 3,
      aktuelleVersionFreigegeben: true,
    },
  ]);
  await frageAlsLeser("vier Angebote", "drei Angebote");
  await services.ko.setConfidentiality(daten.koId, "streng_vertraulich", "kontrolle");
  expect(await aktuellerStand()).toEqual([{ notizFassung: 1, stand: "nicht_verfuegbar" }]);
  expect(await services.ko.list()).toHaveLength(1);
});

it("verwirft leere oder fremde Auszüge, eine fremde Notizfassung und einen Fassungswechsel vor oder nach dem Einreichen", async () => {
  const { ziel, pfad, daten } = await ausgangslage();
  for (const feld of [{ auszug: "" }, { auszug: privat }, { aussage: regelAlt }]) {
    expect((await autor("POST", `${pfad}/vorschau`, { ...daten, ...feld })).statusCode).toBe(400);
  }
  expect((await autor("POST", `${pfad}/vorschau`, { ...daten, fassung: 2 })).statusCode).toBe(409);
  const v = await autor("POST", `${pfad}/vorschau`, daten);
  const eingabe = { ...daten, stempel: v.json().stempel, bewusst: true };
  expect(
    (await autor("POST", `${pfad}/uebernehmen`, { ...eingabe, bewusst: false })).statusCode,
  ).toBe(409);
  const offen = await autor("POST", `${pfad}/uebernehmen`, eingabe);
  expect(offen.statusCode, offen.body).toBe(200);
  const folge = await pruefer("PUT", ziel, {
    action: "revise-release",
    expectedVersion: 1,
    changes: { statement: "Die Einkaufsfreigabe ist vorübergehend ausgesetzt." },
  });
  expect(folge.statusCode, folge.body).toBe(200);
  expect((await autor("POST", `${pfad}/uebernehmen`, eingabe)).statusCode).toBe(409);
  const entscheid = {
    action: "decide-proposal",
    proposalId: offen.json().vorschlagId,
    expectedVersion: 2,
  };
  expect((await pruefer("PUT", ziel, { ...entscheid, decision: "uebernehmen" })).statusCode).toBe(
    409,
  );
  expect(
    (await pruefer("PUT", ziel, { ...entscheid, decision: "ablehnen", note: " " })).statusCode,
  ).toBe(400);
  const abgelehnt = await pruefer("PUT", ziel, {
    ...entscheid,
    decision: "ablehnen",
    note: "Neue Basisfassung prüfen.",
  });
  expect(abgelehnt.statusCode, abgelehnt.body).toBe(200);
  expect((await autor("GET", `${pfad}/stand`)).json().regelvorschlaege).toMatchObject([
    { stand: "abgelehnt", grund: "Neue Basisfassung prüfen." },
  ]);
  await services.ko.setConfidentiality(daten.koId, "streng_vertraulich", "kontrolle");
  expect((await autor("GET", `${pfad}/stand`)).json().regelvorschlaege).toEqual([
    { notizFassung: 1, stand: "nicht_verfuegbar" },
  ]);
});

it("erhält den herkömmlichen API-Vertrag für Vorschläge ohne Klara-Beleg", async () => {
  const { ziel, daten } = await ausgangslage();
  const p = await autor("PUT", ziel, {
    action: "propose",
    proposal: { baseVersion: daten.basis, statement: "Andere fachliche Regel." },
  });
  expect(p.statusCode, p.body).toBe(200);
  const antwort = await pruefer("PUT", ziel, {
    action: "decide-proposal",
    proposalId: p.json().proposals[0].id,
    decision: "ablehnen",
    expectedVersion: daten.basis,
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  expect(antwort.json().proposals[0].status).toBe("abgelehnt");
});

it("serialisiert die Einreichung im Zielspace mit einer Änderung der Space-Schreibrechte", async () => {
  const { pfad, daten } = await ausgangslage();
  const admin = (await services.auth.listUsers()).find((u) => u.email === "g-fiktiv@example.test");
  if (!admin) throw new Error("Prüfkonto fehlt");
  const sp = await pruefer("POST", "/api/spaces", {
    name: "Einkauf",
    zweck: "Einkaufsregeln",
    verantwortlich: admin.id,
    zugang: "alle",
    mitglieder: [],
    ansichten: [],
  });
  expect(sp.statusCode, sp.body).toBe(201);
  const space = sp.json();
  await services.ko.setLeadingSpace(daten.koId, space.id, admin.id, null);
  const v = await autor("POST", `${pfad}/vorschau`, daten);
  expect(v.statusCode, v.body).toBe(200);
  let halte: () => void = () => {};
  const block = new Promise<void>((r) => {
    halte = r;
  });
  let imSchreiben: () => void = () => {};
  const drin = new Promise<void>((r) => {
    imSchreiben = r;
  });
  const ursprung = services.ko.addProposal.bind(services.ko);
  services.ko.addProposal = async (...args) => {
    imSchreiben();
    await block;
    return ursprung(...args);
  };
  const form = { ...daten, stempel: v.json().stempel, bewusst: true };
  const speichern = autor("POST", `${pfad}/uebernehmen`, form).then((r) => r);
  await drin;
  let entzogen = false;
  const entzug = services.spaces.exklusiv(async () => {
    expect(
      await services.spaces.lege({
        ...space,
        version: space.version + 1,
        archiviert: true,
        vorgang: "archiviert",
        geaendertVon: admin.id,
        geaendertAm: new Date().toISOString(),
      }),
    ).toBe(true);
    entzogen = true;
  });
  await new Promise<void>((r) => setImmediate(r));
  try {
    expect(entzogen).toBe(false);
  } finally {
    halte();
  }
  expect((await speichern).statusCode).toBe(200);
  await entzug;
  expect((await autor("POST", `${pfad}/uebernehmen`, form)).statusCode).toBe(403);
  expect((await services.ko.get(daten.koId))?.proposals).toHaveLength(1);
});
