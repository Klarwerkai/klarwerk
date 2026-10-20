// AW04 / PV-05-03: gespeicherte Mischantwort über echte App, Anmeldung und Quellrechte.
// Nur fiktiver Antwortbestand über den vorhandenen Snapshot-Port; kein Modell/Provider/Listener.
import { afterEach, beforeEach, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraGespraech } from "../../services/app/src/klara-gespraech";
import { type AnswerEvidenceSnapshot, hashAnswerSnapshot } from "../../services/ask";

type Konto = { id: string; token: string };
const BASIS = "/api/me/klara/gespraeche";
const MARKE = "Fiktive-AW04-Quellnotiz-Nord";
const MISCHTEXT = `${MARKE}: fiktiver Druckwert 73. Eigene allgemeine Empfehlung: regelmäßig prüfen.`;
const EIGEN = "Meine eigene Arbeitsnotiz: morgen die freie Checkliste ergänzen.";
const FREI = { pfad: "/fragen", seitenName: "Fragen", objekt: "Eigene Frage" };
const PASSWORT = "Aw04-fiktives-Kennwort-2";
let services: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
let admin: Konto;
let anna: Konto;

async function auf(
  wer: Konto | null,
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: Record<string, unknown>,
) {
  return app.inject({
    method,
    url,
    headers: wer ? { authorization: `Bearer ${wer.token}` } : {},
    ...(payload ? { payload } : {}),
  });
}
async function anmelden(email: string): Promise<Konto> {
  const r = await auf(null, "POST", "/api/auth/login", { email, password: PASSWORT });
  expect(r.statusCode, r.body).toBe(200);
  const token = r.json<{ token: string }>().token;
  const me = await app.inject({
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(me.statusCode, me.body).toBe(200);
  return { id: me.json<{ id: string }>().id, token };
}
beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  const r = await auf(null, "POST", "/api/auth/register", {
    name: "AW04 Admin",
    email: "admin-aw04-gespraech@klarwerk.test",
    password: PASSWORT,
  });
  expect(r.statusCode, r.body).toBe(201);
  admin = await anmelden("admin-aw04-gespraech@klarwerk.test");
  const a = await auf(admin, "POST", "/api/users", {
    name: "Anna fiktiv",
    email: "anna-aw04-gespraech@klarwerk.test",
    password: PASSWORT,
    role: "experte",
  });
  expect(a.statusCode, a.body).toBe(201);
  anna = await anmelden("anna-aw04-gespraech@klarwerk.test");
});
afterEach(async () => {
  await app.close();
});

async function bestand() {
  const kos = [];
  for (const title of [MARKE, "Freie fiktive Checkliste"]) {
    const ko = await services.ko.create({
      title,
      statement: `${title}: Prüfhinweis.`,
      type: "best_practice",
      category: "AW04 fiktiv",
      confidentiality: "intern",
      author: admin.id,
    });
    await services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [anna.id] }, admin.id);
    kos.push(ko);
  }
  const geheim = kos[0];
  const erlaubt = kos[1];
  if (!geheim || !erlaubt) throw new Error("Fiktive Quellen fehlen");
  const bezug = {
    pfad: `/wissen/${geheim.id}`,
    seitenName: "Wissen",
    objekt: MARKE,
    koId: geheim.id,
    fassung: geheim.version,
    bezug: "markierung",
    auswahl: `${MARKE}: Druckwert 73.`,
  };
  const r = await auf(anna, "POST", BASIS, { objektbezug: bezug });
  expect(r.statusCode, r.body).toBe(201);
  const id = r.json<{ gespraech: KlaraGespraech }>().gespraech.id;
  expect(
    (await auf(anna, "PUT", `${BASIS}/${id}/einwilligung`, { erteilt: true })).statusCode,
  ).toBe(200);
  expect(
    (
      await auf(anna, "POST", `${BASIS}/${id}/nachrichten`, {
        von: "du",
        modus: "frage",
        text: EIGEN,
        objektbezug: FREI,
      })
    ).statusCode,
  ).toBe(201);
  const antwortId = `aw04-antwort-${id}`;
  expect(
    await services.answerSnapshots.createRecord({
      answerId: antwortId,
      askExecutionId: `aw04-lauf-${id}`,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
      owner: { kind: "user", userId: anna.id },
    }),
  ).toBe(true);
  const snapshot: AnswerEvidenceSnapshot = {
    answerId: antwortId,
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    citedSources: kos.map((k) => k.id),
    evidence: kos.map((k) => ({
      knowledgeObjectId: k.id,
      knowledgeObjectVersion: k.version,
      evidenceRole: "carrying",
      sourceRecordId: null,
      sourceRecordIdReason: "no_source_anchor",
      locator: null,
      locatorReason: "no_source_anchor",
      validationReferenceAbsenceReason: "NOT_AVAILABLE_AT_EXECUTION",
    })),
    resolutionId: null,
    resolutionIdReason: "w1_not_on_answer_path",
    validationDecisionRef: null,
    validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
    status: "INCOMPLETE",
    integrityHash: "",
    generationMode: "deterministic",
  };
  expect(
    await services.answerSnapshots.appendSnapshot({
      ...snapshot,
      integrityHash: hashAnswerSnapshot(snapshot),
    }),
  ).toBe(true);
  const a = await auf(anna, "POST", `${BASIS}/${id}/nachrichten`, {
    von: "klara",
    modus: "ohne_ki",
    text: MISCHTEXT,
    objektbezug: bezug,
    antwortId,
    quellen: kos.map((k) => k.id),
    quellenAngaben: kos.map((k) => ({
      koId: k.id,
      titel: k.title,
      fassung: k.version,
      geprueft: false,
    })),
  });
  expect(a.statusCode, a.body).toBe(201);
  const nachrichtId = a.json<{ nachricht: { id: string } }>().nachricht.id;
  expect((await auf(anna, "GET", `${BASIS}/${id}`)).body).toContain(MISCHTEXT);
  const entziehen = async () => {
    await services.ko.setQuellrechte(geheim.id, { stufe: "intern", leser: [] }, admin.id);
    expect((await auf(anna, "GET", `/api/kos/${geheim.id}`)).statusCode).toBe(404);
  };
  return { id, nachrichtId, antwortId, geheim, erlaubt, bezug, entziehen };
}

it("PV-05-03 / AW04-K01: eigener gespeicherter Mischtext und Quellenmetadaten bleiben nach echtem Entzug verborgen", async () => {
  const b = await bestand();
  await b.entziehen();
  const r = await auf(anna, "GET", `${BASIS}/${b.id}`);
  expect(r.statusCode, r.body).toBe(200);
  expect(r.body).not.toContain(MARKE);
  expect(r.body).not.toContain("Druckwert 73");
  expect(r.body).not.toContain(b.geheim.id);
  expect(r.body).not.toContain(b.antwortId);
  expect(r.body).toContain(EIGEN);
});

it.each(["aktuell", "nachrichten", "schritt", "einwilligung"] as const)(
  "PV-05-03: gemeinsame Ausgabe %s schützt alten Inhalt, eigener freier Beitrag bleibt",
  async (weg) => {
    const b = await bestand();
    await b.entziehen();
    const r =
      weg === "aktuell"
        ? await auf(anna, "GET", "/api/me/klara/gespraech")
        : weg === "nachrichten"
          ? await auf(anna, "POST", `${BASIS}/${b.id}/nachrichten`, {
              von: "du",
              modus: "hilfe",
              text: EIGEN,
              objektbezug: FREI,
            })
          : weg === "schritt"
            ? await auf(anna, "PUT", `${BASIS}/${b.id}/schritt`, {
                art: "frage",
                text: `${MARKE}: Druckwert 73.`,
                objektbezug: b.bezug,
                stand: "beantwortet",
              })
            : await auf(anna, "PUT", `${BASIS}/${b.id}/einwilligung`, { erteilt: false });
    expect(r.statusCode, r.body).toBe(weg === "nachrichten" ? 201 : 200);
    expect(r.body).not.toContain(MARKE);
    expect(r.body).not.toContain(b.geheim.id);
    expect(r.body).not.toContain(b.antwortId);
    expect(r.body).toContain(EIGEN);
    if (weg === "nachrichten")
      expect(r.json<{ nachricht: { text: string } }>().nachricht.text).toBe(EIGEN);
  },
);

it("PV-05-06: freigegebene Quelle, Wiedererteilung und unveränderter Rohverlauf bleiben nutzbar", async () => {
  const b = await bestand();
  const vorher = await services.klaraGespraeche.hole(anna.id, b.id);
  const snapshots = await services.answerSnapshots.listSnapshots(b.antwortId);
  expect(vorher?.nachrichten.find((n) => n.id === b.nachrichtId)?.text).toBe(MISCHTEXT);
  await b.entziehen();
  expect((await auf(anna, "GET", `${BASIS}/${b.id}`)).body).not.toContain(MARKE);
  expect(await services.klaraGespraeche.hole(anna.id, b.id)).toEqual(vorher);
  await services.ko.setQuellrechte(b.geheim.id, { stufe: "intern", leser: [anna.id] }, admin.id);
  const wieder = await auf(anna, "GET", `${BASIS}/${b.id}`);
  expect(wieder.statusCode, wieder.body).toBe(200);
  expect(wieder.body).toContain(MISCHTEXT);
  expect(wieder.body).toContain(b.erlaubt.title);
  expect(wieder.body).toContain(EIGEN);
  expect(await services.klaraGespraeche.hole(anna.id, b.id)).toEqual(vorher);
  expect(await services.answerSnapshots.listSnapshots(b.antwortId)).toEqual(snapshots);
});

it("PV-05-03: gekürzte Clientquellen umgehen die tatsächliche gespeicherte Herkunft nicht; auch das neue Antwort-Echo schützt", async () => {
  const b = await bestand();
  await b.entziehen();
  const r = await auf(anna, "POST", `${BASIS}/${b.id}/nachrichten`, {
    von: "klara",
    modus: "ki",
    text: MISCHTEXT,
    objektbezug: FREI,
    antwortId: b.antwortId,
    quellen: [b.erlaubt.id],
    quellenAngaben: [
      { koId: b.erlaubt.id, titel: b.erlaubt.title, fassung: b.erlaubt.version, geprueft: false },
    ],
  });
  expect(r.statusCode, r.body).toBe(201);
  expect(r.body).not.toContain(MARKE);
  expect(r.body).not.toContain(b.antwortId);
  expect(
    r.json<{ nachricht: { quellen: string[]; antwortId: string | null } }>().nachricht,
  ).toMatchObject({ quellen: [], antwortId: null });
  const raw = await services.klaraGespraeche.hole(anna.id, b.id);
  expect(raw?.nachrichten.at(-1)?.text).toBe(MISCHTEXT);
});

it("PV-05-03: eine eigene Antwortkennung ohne Herkunftsbeleg öffnet keinen vertraulichen Antworttext", async () => {
  const b = await bestand();
  const answerId = "aw04-eigene-kennung-ohne-beleg";
  await services.answerSnapshots.createRecord({
    answerId,
    askExecutionId: "aw04-ohne-beleg",
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    owner: { kind: "user", userId: anna.id },
  });
  const r = await auf(anna, "POST", `${BASIS}/${b.id}/nachrichten`, {
    von: "klara",
    modus: "ohne_ki",
    text: "Fiktiver unbelegter Altinhalt",
    objektbezug: FREI,
    antwortId: answerId,
    quellen: [],
  });
  expect(r.statusCode, r.body).toBe(201);
  expect(r.body).not.toContain("Fiktiver unbelegter Altinhalt");
  expect(r.body).not.toContain(answerId);
  expect(r.body).toContain(MISCHTEXT); // Andere, weiterhin erlaubte Herkunft bleibt lesbar.
  expect(r.body).toContain(EIGEN);
});

it("PV-05-03: Entzug während der Antwortbeleglesung gilt noch vor der HTTP-Ausgabe", async () => {
  const b = await bestand();
  const original = services.answerSnapshots.latestSnapshot.bind(services.answerSnapshots);
  let eingetreten: () => void = () => {};
  let freigeben: () => void = () => {};
  const imLeser = new Promise<void>((resolve) => {
    eingetreten = resolve;
  });
  const weiter = new Promise<void>((resolve) => {
    freigeben = resolve;
  });
  services.answerSnapshots.latestSnapshot = async (id) => {
    const s = await original(id);
    if (id === b.antwortId) {
      eingetreten();
      await weiter;
    }
    return s;
  };
  const lesen = auf(anna, "GET", `${BASIS}/${b.id}`).then((r) => r);
  try {
    await imLeser;
    await b.entziehen();
  } finally {
    freigeben();
  }
  const r = await lesen;
  expect(r.statusCode, r.body).toBe(200);
  expect(r.body).not.toContain(MARKE);
  expect(r.body).not.toContain(b.antwortId);
  expect(r.body).toContain(EIGEN);
});
