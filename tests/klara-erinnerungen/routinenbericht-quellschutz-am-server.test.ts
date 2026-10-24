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

it("R4 · ein unlesbarer Aufgabenport verbirgt nur seinen Bericht, die freie Handlung bleibt und dieselben Meldungen kehren zurück", async () => {
  const { notiz } = await notizAusGeheimerAntwort();
  const a = await auf(anna, "POST", "/api/me/klara/aufgaben", {
    vorgang: "r4-einzelfehler-aufgabe-0001",
    weg: "notiz",
    quelle: { notizId: notiz.id },
  });
  expect(a.statusCode, a.body).toBe(201);
  const aufgabeId = a.json<{ aufgabe: { id: string } }>().aufgabe.id;
  const r = await auf(anna, "POST", "/api/me/klara/erinnerungen", {
    vorgang: "r4-einzelfehler-bericht-0001",
    titel: "R4 gebundener Bericht (fiktiv)",
    zeitzone: "UTC",
    zeitplan: { art: "einmalig", datum: "2026-10-21", uhrzeit: "08:05" },
    bezug: { art: "frei" },
    aktion: "routine_bericht",
    routine: { abschnitte: ["offene_aufgaben"] },
  });
  expect(r.statusCode, r.body).toBe(201);
  const berichtId = r.json<{ erinnerung: { id: string } }>().erinnerung.id;
  vi.setSystemTime(new Date("2026-10-21T08:10:00Z"));
  if (!lauf) throw new Error("Erinnerungstakt nicht angebunden");
  expect((await lauf()).zugestellt).toBe(1);
  const vorher = await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100);
  expect(vorher).toHaveLength(1);
  const bericht = vorher[0];
  if (!bericht?.routine) throw new Error("Echter zugestellter Bericht fehlt");
  expect(bericht.id).toBe(`ke-${berichtId}@2026-10-21T08:05`);
  expect(bericht.routine.quellen).toContainEqual(
    expect.objectContaining({ art: "aufgabe", id: aufgabeId, fassung: 1 }),
  );
  const notizweg = await auf(anna, "GET", `${NOTIZEN}/${bericht.routine.notizId}`);
  expect(notizweg.statusCode, notizweg.body).toBe(200);
  expect(notizweg.body).toContain(`[aufgabe ${aufgabeId}, Fassung 1]`);
  const anfang = await auf(anna, "GET", "/api/notifications");
  expect(anfang.statusCode, anfang.body).toBe(200);
  expect(anfang.body).toContain(bericht.id);

  const f = await auf(anna, "POST", "/api/me/klara/erinnerungen", {
    vorgang: "r4-einzelfehler-frei-0001",
    titel: "R4 freie Handlung (fiktiv)",
    zeitzone: "UTC",
    zeitplan: { art: "einmalig", datum: "2026-10-21", uhrzeit: "08:15" },
    bezug: { art: "frei" },
    aktion: "routine_bericht",
    routine: { abschnitte: ["offene_aufgaben"] },
  });
  expect(f.statusCode, f.body).toBe(201);
  const freiId = f.json<{ erinnerung: { id: string } }>().erinnerung.id;
  const handlungId = `ke-handlung-${freiId}@2026-10-21T08:15`;
  const hole = services.klaraAufgaben.hole;
  const liste = services.klaraAufgaben.liste;
  let listenfehler = 0;
  let lesefehler = 0;
  let lesefehlerAbgeschlossen = 0;
  let gespeicherteKennungen: string[] = [];
  services.klaraAufgaben.liste = async () => {
    listenfehler += 1;
    throw new Error("R4 kontrollierter Aufgabenlesefehler");
  };
  services.klaraAufgaben.hole = async () => {
    lesefehler += 1;
    await Promise.resolve();
    lesefehlerAbgeschlossen += 1;
    throw new Error("R4 kontrollierter Aufgabenlesefehler");
  };
  try {
    vi.setSystemTime(new Date("2026-10-21T08:16:00Z"));
    await lauf();
    expect(listenfehler).toBeGreaterThan(0);
    const gespeichert = await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100);
    expect(gespeichert).toHaveLength(2);
    expect(gespeichert.find((m) => m.id === handlungId)).toMatchObject({
      erinnerungId: freiId,
      art: "handlung",
      grund: "quelle_unlesbar",
      laufStatus: "fehlgeschlagen",
    });
    gespeicherteKennungen = gespeichert.map((m) => m.id);
    const feed = await auf(anna, "GET", "/api/notifications");
    expect(feed.statusCode, feed.body).toBe(200);
    const meldungen = feed.json<{ kind: string }[]>();
    const sichtbar = meldungen.filter((m) => m.kind === "erinnerung");
    expect(sichtbar).toMatchObject([
      { id: handlungId, erinnerungArt: "handlung", erinnerungGrund: "quelle_unlesbar" },
    ]);
    for (const verborgen of [bericht.id, berichtId, aufgabeId, notiz.id, MARKE]) {
      expect(feed.body).not.toContain(verborgen);
    }
    expect(feed.body).not.toContain("R4 kontrollierter Aufgabenlesefehler");
    expect(lesefehler).toBeGreaterThan(0);
    expect(lesefehlerAbgeschlossen).toBe(lesefehler);
    const fremd = await auf(vera, "GET", "/api/notifications");
    expect(fremd.statusCode, fremd.body).toBe(200);
    expect(fremd.json<{ kind: string }[]>().filter((m) => m.kind === "erinnerung")).toEqual([]);
    for (const verborgen of [bericht.id, handlungId, aufgabeId, notiz.id, MARKE]) {
      expect(fremd.body).not.toContain(verborgen);
    }
  } finally {
    services.klaraAufgaben.hole = hole;
    services.klaraAufgaben.liste = liste;
  }
  expect(services.klaraAufgaben.hole).toBe(hole);
  expect(services.klaraAufgaben.liste).toBe(liste);
  for (let abruf = 0; abruf < 2; abruf += 1) {
    const wieder = await auf(anna, "GET", "/api/notifications");
    expect(wieder.statusCode, wieder.body).toBe(200);
    const meldungen = wieder.json<{ id: string; kind: string }[]>();
    const kennungen = meldungen.filter((m) => m.kind === "erinnerung").map((m) => m.id);
    expect(kennungen).toEqual(gespeicherteKennungen);
  }
  expect(
    (await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100)).map((m) => m.id),
  ).toEqual(gespeicherteKennungen);
});

it("R4 · tatsächlicher Quellrechteentzug verbirgt den Bericht und erhält die unabhängige eigene Meldung", async () => {
  const { geheim, notiz } = await notizAusGeheimerAntwort();
  const r = await auf(anna, "POST", "/api/me/klara/erinnerungen", {
    vorgang: "r4-entzug-bericht-0001",
    titel: "R4 Bericht vor Entzug (fiktiv)",
    zeitzone: "UTC",
    zeitplan: { art: "einmalig", datum: "2026-10-21", uhrzeit: "08:05" },
    bezug: { art: "frei" },
    aktion: "routine_bericht",
    routine: { abschnitte: ["neue_notizen"] },
  });
  expect(r.statusCode, r.body).toBe(201);
  const berichtId = r.json<{ erinnerung: { id: string } }>().erinnerung.id;
  const f = await auf(anna, "POST", "/api/me/klara/erinnerungen", {
    vorgang: "r4-entzug-frei-0001",
    titel: "R4 eigene freie Erinnerung (fiktiv)",
    zeitzone: "UTC",
    zeitplan: { art: "einmalig", datum: "2026-10-21", uhrzeit: "08:05" },
    bezug: { art: "frei" },
    aktion: "erinnern",
  });
  expect(f.statusCode, f.body).toBe(201);
  const freiId = f.json<{ erinnerung: { id: string } }>().erinnerung.id;
  const meldungId = `ke-${freiId}@2026-10-21T08:05`;
  vi.setSystemTime(new Date("2026-10-21T08:10:00Z"));
  if (!lauf) throw new Error("Erinnerungstakt nicht angebunden");
  expect((await lauf()).zugestellt).toBe(2);
  const gespeichert = await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100);
  const bericht = gespeichert.find((m) => m.erinnerungId === berichtId);
  if (!bericht?.routine) throw new Error("Echter zugestellter Bericht fehlt");
  expect(bericht.routine.quellen).toContainEqual(
    expect.objectContaining({ art: "notiz", id: notiz.id, fassung: notiz.fassung }),
  );
  const anfang = await auf(anna, "GET", "/api/notifications");
  expect(anfang.statusCode, anfang.body).toBe(200);
  expect(anfang.body).toContain(bericht.id);
  expect(anfang.body).toContain(meldungId);
  await services.ko.setQuellrechte(geheim.id, { stufe: "intern", leser: [] }, admin.id);
  expect((await auf(anna, "GET", `${NOTIZEN}/${notiz.id}`)).statusCode).toBe(404);
  const feed = await auf(anna, "GET", "/api/notifications");
  expect(feed.statusCode, feed.body).toBe(200);
  const meldungen = feed.json<{ id: string; kind: string }[]>();
  const sichtbar = meldungen.filter((m) => m.kind === "erinnerung").map((m) => m.id);
  expect(sichtbar).toEqual([meldungId]);
  for (const verborgen of [bericht.id, berichtId, geheim.id, notiz.id, MARKE]) {
    expect(feed.body).not.toContain(verborgen);
  }
  const fremd = await auf(vera, "GET", "/api/notifications");
  expect(fremd.statusCode, fremd.body).toBe(200);
  expect(fremd.json<{ kind: string }[]>().filter((m) => m.kind === "erinnerung")).toEqual([]);
  for (const verborgen of [bericht.id, meldungId, geheim.id, notiz.id, MARKE]) {
    expect(fremd.body).not.toContain(verborgen);
  }
  expect(
    (await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100)).map((m) => m.id),
  ).toEqual(gespeichert.map((m) => m.id));
});
