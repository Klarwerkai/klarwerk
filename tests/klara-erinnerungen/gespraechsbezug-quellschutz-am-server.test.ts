// Review 21.10.2026 · KVS-2 (kritisch): Eine Erinnerung mit Bezug „Gespräch“ kopiert Titel und
// Auszug aus dem Antworttext. Ihre Herkunft muss wie bei Notizen über den Antwortbeleg geprüft
// werden — für den Eigentümer UND für die Übergabeempfängerin —, und jede Ausgabe (Liste, Einzelabruf,
// Glocke, Zusammenfassung an das Modell) gilt nur mit den heutigen Rechten.
// Nachgestellt nach Beleg `kvs-s1-gespraechsbezug.ts` (Fälle A2–A4, B2, T1–T2). Fiktive Daten,
// In-Memory, vorhandener Erinnerungstakt, kein Netz.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import { type AnswerEvidenceSnapshot, hashAnswerSnapshot } from "../../services/ask";

type Konto = { id: string; token: string };
const KENNWORT = "Kvs2-fiktives-Kennwort-7";
const MARKE = "Fiktiv-KVS2-Geheimwert-Nord";
const TEXT = `${MARKE}: Druckwert 73 laut vertraulicher Quelle. Weitere Hinweise folgen hier.`;
const FREI = { pfad: "/fragen", seitenName: "Fragen", objekt: "Eigene Frage" };
const BASIS = "/api/me/klara/erinnerungen";
const VERA = "vera-kvs2@klarwerk.test";

let services: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
let lauf: (() => Promise<KlaraErinnerungLaufbericht>) | null;
let modellEingaben: string[];
let admin: Konto;
let anna: Konto;
let vera: Konto;

function auf(konto: Konto | null, method: "GET" | "POST" | "PUT", url: string, payload?: unknown) {
  return app.inject({
    method,
    url,
    headers: konto ? { authorization: `Bearer ${konto.token}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
}
async function anmelden(email: string): Promise<Konto> {
  const r = await auf(null, "POST", "/api/auth/login", { email, password: KENNWORT });
  expect(r.statusCode, r.body).toBe(200);
  const token = r.json<{ token: string }>().token;
  const me = await auf({ id: "", token }, "GET", "/api/auth/me");
  return { id: me.json<{ id: string }>().id, token };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T08:00:00Z"));
  lauf = null;
  modellEingaben = [];
  services = assembleServices(inMemoryRepos());
  delete services.push;
  const assist = services.reasoner.assistText.bind(services.reasoner);
  services.reasoner.assistText = (async (...a: Parameters<typeof assist>) => {
    modellEingaben.push(String(a[0]));
    return assist(...a);
  }) as typeof services.reasoner.assistText;
  app = buildApp(services, {
    klaraErinnerungen: (l) => {
      lauf = l;
      return 60_000;
    },
  });
  const r = await auf(null, "POST", "/api/auth/register", {
    name: "Admin KVS2",
    email: "admin-kvs2@klarwerk.test",
    password: KENNWORT,
  });
  expect(r.statusCode, r.body).toBe(201);
  admin = await anmelden("admin-kvs2@klarwerk.test");
  for (const [name, email, role] of [
    ["Anna fiktiv", "anna-kvs2@klarwerk.test", "experte"],
    ["Vera fiktiv", VERA, "viewer"],
  ]) {
    const x = await auf(admin, "POST", "/api/users", { name, email, password: KENNWORT, role });
    expect(x.statusCode, x.body).toBe(201);
  }
  anna = await anmelden("anna-kvs2@klarwerk.test");
  vera = await anmelden(VERA);
});
afterEach(async () => {
  try {
    await app.close();
  } finally {
    vi.useRealTimers();
  }
});

async function geheimeQuelle() {
  const ko = await services.ko.create({
    title: "KVS2 geheime Quelle",
    statement: `${MARKE}: Prüfhinweis.`,
    type: "best_practice",
    category: "KVS2 fiktiv",
    confidentiality: "intern",
    author: admin.id,
  });
  await services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [anna.id] }, admin.id);
  expect((await auf(anna, "GET", `/api/kos/${ko.id}`)).statusCode).toBe(200);
  expect((await auf(vera, "GET", `/api/kos/${ko.id}`)).statusCode).toBe(404);
  return ko;
}

/** Gespeicherte Klara-Antwort mit echtem Antwortbeleg (Quelle = geheim). */
async function antwort(
  ko: { id: string; title: string; version: number },
  objektbezug: Record<string, unknown>,
) {
  const g = await auf(anna, "POST", "/api/me/klara/gespraeche", { objektbezug: FREI });
  expect(g.statusCode, g.body).toBe(201);
  const gid = g.json<{ gespraech: { id: string } }>().gespraech.id;
  await auf(anna, "PUT", `/api/me/klara/gespraeche/${gid}/einwilligung`, { erteilt: true });
  const antwortId = `kvs2-antwort-${gid}`;
  await services.answerSnapshots.createRecord({
    answerId: antwortId,
    askExecutionId: `kvs2-lauf-${gid}`,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    owner: { kind: "user", userId: anna.id },
  });
  const snap: AnswerEvidenceSnapshot = {
    answerId: antwortId,
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    citedSources: [ko.id],
    evidence: [
      {
        knowledgeObjectId: ko.id,
        knowledgeObjectVersion: ko.version,
        evidenceRole: "carrying",
        sourceRecordId: null,
        sourceRecordIdReason: "no_source_anchor",
        locator: null,
        locatorReason: "no_source_anchor",
        validationReferenceAbsenceReason: "NOT_AVAILABLE_AT_EXECUTION",
      },
    ],
    resolutionId: null,
    resolutionIdReason: "w1_not_on_answer_path",
    validationDecisionRef: null,
    validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
    status: "INCOMPLETE",
    integrityHash: "",
    generationMode: "deterministic",
  };
  await services.answerSnapshots.appendSnapshot({
    ...snap,
    integrityHash: hashAnswerSnapshot(snap),
  });
  const m = await auf(anna, "POST", `/api/me/klara/gespraeche/${gid}/nachrichten`, {
    von: "klara",
    modus: "ohne_ki",
    text: TEXT,
    objektbezug,
    antwortId,
    quellen: [ko.id],
    quellenAngaben: [{ koId: ko.id, titel: ko.title, fassung: ko.version, geprueft: false }],
  });
  expect(m.statusCode, m.body).toBe(201);
  return { gid, nid: m.json<{ nachricht: { id: string } }>().nachricht.id };
}

let z = 0;
async function lege(bezug: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  z += 1;
  const r = await auf(anna, "POST", BASIS, {
    vorgang: `kvs2-beleg-${String(z).padStart(4, "0")}`,
    zeitzone: "UTC",
    zeitplan: { art: "einmalig", datum: "2026-10-21", uhrzeit: "08:05" },
    bezug,
    ...extra,
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json<{ erinnerung: { id: string; fassung: number; titel: string } }>().erinnerung;
}

describe("KVS-2 · Erinnerung mit Bezug „Gespräch“ auf eine geschützte Klara-Antwort", () => {
  it("Übergabe an eine Person ohne Leserecht wird abgelehnt; nach dem Entzug keine Ausgabe, kein Modellaufruf", async () => {
    const geheim = await geheimeQuelle();

    // A1/A2/A3: Titel kommt aus der Antwort; Übergabe an Vera ohne Leserecht → 409.
    const a = await antwort(geheim, FREI);
    const eA = await lege({ art: "gespraech", gespraechId: a.gid, nachrichtId: a.nid });
    expect(eA.titel).toContain(MARKE);
    const ueb = await auf(anna, "POST", `${BASIS}/${eA.id}/uebergabe`, {
      fassung: eA.fassung,
      an: VERA,
    });
    expect(ueb.statusCode, ueb.body).toBe(409);
    const veraListe = await auf(vera, "GET", BASIS);
    expect(veraListe.statusCode).toBe(200);
    expect(veraListe.body).not.toContain(MARKE);

    // A4 Gegenprobe: Antwort mit gebundener koId → 409 (Bestand).
    const b = await antwort(geheim, { ...FREI, koId: geheim.id, fassung: geheim.version });
    const eB = await lege({ art: "gespraech", gespraechId: b.gid, nachrichtId: b.nid });
    const uebB = await auf(anna, "POST", `${BASIS}/${eB.id}/uebergabe`, {
      fassung: eB.fassung,
      an: VERA,
    });
    expect(uebB.statusCode, uebB.body).toBe(409);

    // B: Zusammenfassungs-Erinnerung, danach Rechteentzug bei Anna.
    const c = await antwort(geheim, FREI);
    const eC = await lege(
      { art: "gespraech", gespraechId: c.gid, nachrichtId: c.nid },
      { aktion: "inhalt_zusammenfassen" },
    );
    await services.ko.setQuellrechte(geheim.id, { stufe: "intern", leser: [] }, admin.id);
    expect((await auf(anna, "GET", `/api/kos/${geheim.id}`)).statusCode).toBe(404);
    // B2: Einzelabruf und Liste zeigen den kopierten Antworttext nicht mehr.
    const annaE = await auf(anna, "GET", `${BASIS}/${eC.id}`);
    expect(annaE.statusCode).toBe(404);
    expect(annaE.body).not.toContain(MARKE);
    expect((await auf(anna, "GET", BASIS)).body).not.toContain(MARKE);

    // T: Takt nach Fälligkeit — keine Glocke mit dem Text, kein Modellaufruf mit dem Text.
    vi.setSystemTime(new Date("2026-10-21T08:10:00Z"));
    if (!lauf) throw new Error("Erinnerungstakt nicht angebunden");
    await (lauf as () => Promise<KlaraErinnerungLaufbericht>)();
    const glVera = await auf(vera, "GET", "/api/notifications");
    expect(glVera.statusCode).toBe(200);
    expect(glVera.body).not.toContain(MARKE);
    const glAnna = await auf(anna, "GET", "/api/notifications");
    expect(glAnna.body).not.toContain(MARKE);
    expect(modellEingaben.filter((t) => t.includes(MARKE))).toEqual([]);
  });
});
