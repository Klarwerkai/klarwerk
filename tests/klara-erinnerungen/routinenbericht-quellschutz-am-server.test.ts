// Review 22.10.2026 · FNR-2 (hoch): Ein Routinenbericht (`routine_bericht`, Abschnitt
// `neue_notizen`) darf Titel und erste Zeile einer quellengebundenen Notiz — hier aus einer
// geschützten Klara-Antwort — nicht in eine neue Notiz ohne Quellenbindung kopieren. Sonst bleibt
// der Text nach dem Rechteentzug lesbar und gelangt über die Wissensübernahme zu Personen ohne
// Leserecht. Der Bericht verweist auf die Ursprungsnotiz (Kennung, Fassung); deren eigener
// Quellschutz gilt dann für jeden Abruf. Nachgestellt nach Beleg `ra2-routinenbericht-nach-entzug.ts`
// (Gegenprobe R8, W1–W3). Fiktive Daten, In-Memory, vorhandener Erinnerungstakt, kein Netz.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import { type AnswerEvidenceSnapshot, hashAnswerSnapshot } from "../../services/ask";

type Konto = { id: string; token: string };
type Notiz = { id: string; fassung: number; titel: string; inhalt: string };
const KENNWORT = "Fnr2-fiktives-Kennwort-7";
const MARKE = "Fiktiv-FNR2-Geheimwert-Nord";
const TEXT = `${MARKE}: Druckwert 73 laut vertraulicher Quelle. Weitere Hinweise folgen hier.`;
const EIGEN = "Fiktive eigene Checkliste Presse 4";
const FREI = { pfad: "/fragen", seitenName: "Fragen", objekt: "Eigene Frage" };
const NOTIZEN = "/api/me/klara/notizen";
const ZIEL = {
  art: "artikel",
  confidentiality: "intern",
  type: "best_practice",
  category: "FNR2 fiktiv",
  conditions: [],
};

let services: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
let lauf: (() => Promise<KlaraErinnerungLaufbericht>) | null;
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
  services = assembleServices(inMemoryRepos());
  delete services.push;
  app = buildApp(services, {
    klaraErinnerungen: (l) => {
      lauf = l;
      return 60_000;
    },
  });
  const r = await auf(null, "POST", "/api/auth/register", {
    name: "Admin FNR2",
    email: "admin-fnr2@klarwerk.test",
    password: KENNWORT,
  });
  expect(r.statusCode, r.body).toBe(201);
  admin = await anmelden("admin-fnr2@klarwerk.test");
  for (const [name, email, role] of [
    ["Anna fiktiv", "anna-fnr2@klarwerk.test", "experte"],
    ["Vera fiktiv", "vera-fnr2@klarwerk.test", "viewer"],
  ]) {
    const x = await auf(admin, "POST", "/api/users", { name, email, password: KENNWORT, role });
    expect(x.statusCode, x.body).toBe(201);
  }
  anna = await anmelden("anna-fnr2@klarwerk.test");
  vera = await anmelden("vera-fnr2@klarwerk.test");
});
afterEach(async () => {
  try {
    await app.close();
  } finally {
    vi.useRealTimers();
  }
});

async function notizAusGeheimerAntwort() {
  const ko = await services.ko.create({
    title: "FNR2 geheime Quelle",
    statement: `${MARKE}: Prüfhinweis.`,
    type: "best_practice",
    category: "FNR2 fiktiv",
    confidentiality: "intern",
    author: admin.id,
  });
  await services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [anna.id] }, admin.id);
  const g = await auf(anna, "POST", "/api/me/klara/gespraeche", { objektbezug: FREI });
  expect(g.statusCode, g.body).toBe(201);
  const gid = g.json<{ gespraech: { id: string } }>().gespraech.id;
  await auf(anna, "PUT", `/api/me/klara/gespraeche/${gid}/einwilligung`, { erteilt: true });
  const antwortId = `fnr2-antwort-${gid}`;
  await services.answerSnapshots.createRecord({
    answerId: antwortId,
    askExecutionId: `fnr2-lauf-${gid}`,
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
    objektbezug: FREI,
    antwortId,
    quellen: [ko.id],
    quellenAngaben: [{ koId: ko.id, titel: ko.title, fassung: ko.version, geprueft: false }],
  });
  expect(m.statusCode, m.body).toBe(201);
  const nr = await auf(anna, "POST", NOTIZEN, {
    vorgang: "fnr2-notiz-0001",
    weg: "gespraech",
    quelle: { gespraechId: gid, nachrichtId: m.json<{ nachricht: { id: string } }>().nachricht.id },
  });
  expect(nr.statusCode, nr.body).toBe(201);
  const notiz = nr.json<{ notiz: Notiz }>().notiz;
  expect(nr.body).toContain(MARKE);
  return { geheim: ko, notiz };
}

describe("FNR-2 · Routinenbericht über eine Notiz aus einer geschützten Klara-Antwort", () => {
  it("verweist auf die Ursprungsnotiz statt Titel/erste Zeile zu kopieren; nach Entzug und Übernahme liest niemand den Text", async () => {
    const { geheim, notiz } = await notizAusGeheimerAntwort();
    const eigene = await auf(anna, "POST", NOTIZEN, {
      vorgang: "fnr2-notiz-eigen-0001",
      weg: "geschrieben",
      titel: EIGEN,
      inhalt: "Ölstand nur bei stehender Presse prüfen.",
      objektbezug: { pfad: "/klara", seitenName: "Klara", objekt: "Servicebericht" },
    });
    expect(eigene.statusCode, eigene.body).toBe(201);
    const routine = await auf(anna, "POST", "/api/me/klara/erinnerungen", {
      vorgang: "fnr2-routine-0001",
      titel: "Wochenbericht FNR2",
      zeitzone: "UTC",
      zeitplan: { art: "einmalig", datum: "2026-10-21", uhrzeit: "08:05" },
      bezug: { art: "frei" },
      aktion: "routine_bericht",
      routine: { abschnitte: ["neue_notizen"] },
    });
    expect(routine.statusCode, routine.body).toBe(201);

    // Bericht läuft, solange Anna die Quelle lesen darf (Gegenprobe des Belegs).
    vi.setSystemTime(new Date("2026-10-21T08:10:00Z"));
    if (!lauf) throw new Error("Erinnerungstakt nicht angebunden");
    const takt = await (lauf as () => Promise<KlaraErinnerungLaufbericht>)();
    expect(takt.zugestellt).toBe(1);
    const liste = await auf(anna, "GET", NOTIZEN);
    const alle = (liste.json().notizen ?? liste.json()) as Notiz[];
    const bericht = alle.find((n) => n.titel.startsWith("Wochenbericht FNR2"));
    if (!bericht) throw new Error("Berichtsnotiz fehlt");
    // Der Bericht nennt die quellengebundene Notiz nur per Kennung und Fassung …
    expect(bericht.inhalt).toContain(`[notiz ${notiz.id}, Fassung ${notiz.fassung}]`);
    expect(bericht.inhalt).not.toContain(MARKE);
    expect(bericht.inhalt).not.toContain(notiz.titel);
    // … eine gewöhnliche eigene Notiz weiterhin mit Titel.
    expect(bericht.inhalt).toContain(EIGEN);

    // R8: Entzug NACH dem Bericht — Original 404, Bericht ohne den geschützten Text.
    await services.ko.setQuellrechte(geheim.id, { stufe: "intern", leser: [] }, admin.id);
    expect((await auf(anna, "GET", `${NOTIZEN}/${notiz.id}`)).statusCode).toBe(404);
    const b2 = await auf(anna, "GET", `${NOTIZEN}/${bericht.id}`);
    expect(b2.body).not.toContain(MARKE);
    expect((await auf(anna, "GET", NOTIZEN)).body).not.toContain(MARKE);

    // W1–W3: auch über die Wissensübernahme des Berichts liest Vera den Text nicht.
    if (b2.statusCode === 200) {
      const bj = b2.json<{ notiz: Notiz }>().notiz;
      const wv = await auf(anna, "POST", `${NOTIZEN}/${bericht.id}/wissen/vorschau`, {
        fassung: bj.fassung,
        ziel: ZIEL,
      });
      expect(wv.body).not.toContain(MARKE);
      if (wv.statusCode === 200) {
        const wu = await auf(anna, "POST", `${NOTIZEN}/${bericht.id}/wissen/uebernehmen`, {
          bewusst: true,
          fassung: bj.fassung,
          ziel: ZIEL,
          stempel: wv.json().stempel,
        });
        const koId = wu.json().beitrag?.id;
        if (koId) {
          expect((await auf(vera, "GET", `/api/kos/${koId}`)).body).not.toContain(MARKE);
        }
      }
    }
    expect((await auf(vera, "GET", "/api/kos")).body).not.toContain(MARKE);
  });
});
