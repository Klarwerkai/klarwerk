// Review 21.10.2026 · KVS-1 (kritisch): Eine Notiz aus einer gespeicherten Klara-Antwort trägt ihre
// Quellen über `quelle`/`antwortId`, nicht über `wissensHerkunft` oder `objektbezug.koId`. Die
// Wissensübernahme muss diese Antwortquellen derselben Schutzprüfung unterwerfen wie eine
// Import-Notiz (403), sonst liest eine Person ohne Leserecht die geschützte Quelle im neuen Beitrag.
// Nachgestellt nach Beleg `kvs-u1-notiz-wissen-aufgabe.ts` (Fälle G1, W1–W4, R5). Fiktive Daten,
// In-Memory, kein Modell, kein Netz.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { type AnswerEvidenceSnapshot, hashAnswerSnapshot } from "../../services/ask";

type Konto = { id: string; token: string };
const KENNWORT = "Kvs1-fiktives-Kennwort-7";
const MARKE = "Fiktiv-KVS1-Geheimwert-Nord";
const TEXT = `${MARKE}: Druckwert 73 laut vertraulicher Quelle. Weitere Hinweise folgen hier.`;
const FREI = { pfad: "/fragen", seitenName: "Fragen", objekt: "Eigene Frage" };
const ZIEL = {
  art: "artikel",
  confidentiality: "intern",
  type: "best_practice",
  category: "KVS1 fiktiv",
  conditions: [],
};

let services: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
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
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  const r = await auf(null, "POST", "/api/auth/register", {
    name: "Admin KVS1",
    email: "admin-kvs1@klarwerk.test",
    password: KENNWORT,
  });
  expect(r.statusCode, r.body).toBe(201);
  admin = await anmelden("admin-kvs1@klarwerk.test");
  for (const [name, email, role] of [
    ["Anna fiktiv", "anna-kvs1@klarwerk.test", "experte"],
    ["Vera fiktiv", "vera-kvs1@klarwerk.test", "viewer"],
  ]) {
    const x = await auf(admin, "POST", "/api/users", { name, email, password: KENNWORT, role });
    expect(x.statusCode, x.body).toBe(201);
  }
  anna = await anmelden("anna-kvs1@klarwerk.test");
  vera = await anmelden("vera-kvs1@klarwerk.test");
});
afterEach(async () => {
  await app.close();
});

async function quelle(geschuetzt: boolean) {
  const ko = await services.ko.create({
    title: geschuetzt ? "KVS1 geheime Quelle" : "KVS1 freie Quelle",
    statement: `${geschuetzt ? MARKE : "Frei"}: Prüfhinweis.`,
    type: "best_practice",
    category: "KVS1 fiktiv",
    confidentiality: "intern",
    author: admin.id,
  });
  if (geschuetzt) {
    await services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [anna.id] }, admin.id);
  }
  expect((await auf(anna, "GET", `/api/kos/${ko.id}`)).statusCode).toBe(200);
  expect((await auf(vera, "GET", `/api/kos/${ko.id}`)).statusCode).toBe(geschuetzt ? 404 : 200);
  return ko;
}

/** Gespeicherte Klara-Antwort (echter Antwortbeleg) im eigenen Gespräch, daraus eine Notiz. */
async function notizAusAntwort(ko: { id: string; title: string; version: number }, text: string) {
  const g = await auf(anna, "POST", "/api/me/klara/gespraeche", { objektbezug: FREI });
  expect(g.statusCode, g.body).toBe(201);
  const gid = g.json<{ gespraech: { id: string } }>().gespraech.id;
  await auf(anna, "PUT", `/api/me/klara/gespraeche/${gid}/einwilligung`, { erteilt: true });
  const antwortId = `kvs1-antwort-${gid}`;
  await services.answerSnapshots.createRecord({
    answerId: antwortId,
    askExecutionId: `kvs1-lauf-${gid}`,
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
    text,
    objektbezug: FREI,
    antwortId,
    quellen: [ko.id],
    quellenAngaben: [{ koId: ko.id, titel: ko.title, fassung: ko.version, geprueft: false }],
  });
  expect(m.statusCode, m.body).toBe(201);
  const nid = m.json<{ nachricht: { id: string } }>().nachricht.id;
  const nr = await auf(anna, "POST", "/api/me/klara/notizen", {
    vorgang: `kvs1-notiz-${gid.slice(0, 8)}`,
    weg: "gespraech",
    quelle: { gespraechId: gid, nachrichtId: nid },
  });
  expect(nr.statusCode, nr.body).toBe(201);
  return nr.json<{ notiz: { id: string; fassung: number; inhalt: string } }>().notiz;
}

describe("KVS-1 · Wissensübernahme einer Notiz aus einer geschützten Klara-Antwort", () => {
  it("lehnt Vorschau und Übernahme ab wie bei der Import-Notiz; Vera liest nichts, auch nach Entzug", async () => {
    const geheim = await quelle(true);
    const notiz = await notizAusAntwort(geheim, TEXT);
    expect(notiz.inhalt).toContain(MARKE);

    // G1 Gegenprobe: dieselbe Quelle über eine Import-Notiz → 403 (Bestand).
    const imp = await auf(anna, "POST", "/api/me/klara/wissen/import", {
      titel: "KVS1 Import",
      inhalt: TEXT,
      projekt: "KVS1",
      abschnitt: "A1",
      antwortFassung: "1",
      aussagen: [
        { art: "behauptung", text: MARKE, quellen: [{ id: geheim.id, fassung: geheim.version }] },
      ],
    });
    expect(imp.statusCode, imp.body).toBe(201);
    const g1 = await auf(
      anna,
      "POST",
      `/api/me/klara/notizen/${imp.json().notiz.id}/wissen/vorschau`,
      {
        fassung: 1,
        ziel: ZIEL,
      },
    );
    expect(g1.statusCode, g1.body).toBe(403);

    // W1/W2: dieselbe Sperre für die Gesprächsnotiz.
    const w1 = await auf(anna, "POST", `/api/me/klara/notizen/${notiz.id}/wissen/vorschau`, {
      fassung: notiz.fassung,
      ziel: ZIEL,
    });
    expect(w1.statusCode, w1.body).toBe(403);
    expect(w1.body).not.toContain(MARKE);
    const w2 = await auf(anna, "POST", `/api/me/klara/notizen/${notiz.id}/wissen/uebernehmen`, {
      bewusst: true,
      fassung: notiz.fassung,
      ziel: ZIEL,
      stempel: "kvs1-beliebig",
    });
    expect(w2.statusCode, w2.body).toBe(403);
    expect(w2.json().beitrag).toBeUndefined();

    // W3/W4: kein Beitrag mit dem Quelltext entstanden, Vera liest nichts.
    const kos = await services.ko.list();
    expect(JSON.stringify(kos.filter((k) => k.id !== geheim.id))).not.toContain(MARKE);
    const veraListe = await auf(vera, "GET", "/api/kos");
    expect(veraListe.statusCode).toBe(200);
    expect(veraListe.body).not.toContain(MARKE);

    // R5: nach Annas Rechteentzug bleibt nichts lesbar.
    await services.ko.setQuellrechte(geheim.id, { stufe: "intern", leser: [] }, admin.id);
    expect((await auf(anna, "GET", `/api/kos/${geheim.id}`)).statusCode).toBe(404);
    expect((await auf(anna, "GET", "/api/kos")).body).not.toContain(MARKE);
    expect((await auf(vera, "GET", "/api/kos")).body).not.toContain(MARKE);
    const nachEntzug = await auf(
      anna,
      "POST",
      `/api/me/klara/notizen/${notiz.id}/wissen/vorschau`,
      {
        fassung: notiz.fassung,
        ziel: ZIEL,
      },
    );
    expect(nachEntzug.statusCode).toBe(404);
    expect(nachEntzug.body).not.toContain(MARKE);
  });

  it("übernimmt eine Notiz aus einer Antwort mit freier interner Quelle weiterhin", async () => {
    const frei = await quelle(false);
    const notiz = await notizAusAntwort(frei, "Frei: Ölstand nur bei stehender Presse prüfen.");
    const v = await auf(anna, "POST", `/api/me/klara/notizen/${notiz.id}/wissen/vorschau`, {
      fassung: notiz.fassung,
      ziel: ZIEL,
    });
    expect(v.statusCode, v.body).toBe(200);
    // Die Antwortquelle ist jetzt Teil der ausgewiesenen Herkunft.
    expect(v.json().input.bodyHtml).toContain(`/wissen/${frei.id}`);
    const u = await auf(anna, "POST", `/api/me/klara/notizen/${notiz.id}/wissen/uebernehmen`, {
      bewusst: true,
      fassung: notiz.fassung,
      ziel: ZIEL,
      stempel: v.json().stempel,
    });
    expect(u.statusCode, u.body).toBe(200);
    expect((await auf(vera, "GET", `/api/kos/${u.json().beitrag.id}`)).statusCode).toBe(200);
  });
});
