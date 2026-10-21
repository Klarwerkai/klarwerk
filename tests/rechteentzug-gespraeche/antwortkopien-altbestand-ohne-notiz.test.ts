// Ein zusätzlicher enger RC2-Altklassenfall, kein Ersatz der beiden festen6039-Definitionen.
// Restaurierte fiktive JSON-Records entsprechen den normalen6039-Anlagefeldern:
// klara-notiz.ts SHA256 5c168bab1cb3f7aba8655e5aacaa6ee73a582b8a3e95976437ad4da6836bbc8d
// klara-aufgabe.ts SHA256 37d965557cc64f198e31f0b60a9067db086d2b93feefce6237c9658266314b3a
// klara-erinnerung.ts SHA256 1916384d6744db8f36a2342558e387f69430a15e4b29ee1ce3a3a4650a6a8fbe
// Die fehlenden Marker sind der damalige normale Schreibstand ohne wissensHerkunft.
// Kein neuer Writer wird benutzt und nachträglich durch Entfernen eines Flags passend gemacht.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraAufgabe } from "../../services/app/src/klara-aufgabe";
import {
  type KlaraErinnerung,
  type KlaraErinnerungLaufbericht,
  naechsteFaelligkeit,
} from "../../services/app/src/klara-erinnerung";
import type { KlaraNotiz } from "../../services/app/src/klara-notiz";
import { type AnswerEvidenceSnapshot, hashAnswerSnapshot } from "../../services/ask";

type Konto = { id: string; token: string };
const N = "/api/me/klara/notizen";
const A = "/api/me/klara/aufgaben";
const E = "/api/me/klara/erinnerungen";
const G = "/api/me/klara/gespraeche";
const MARKE = "Fiktive-RC2-Altquelle-Buche";
const ZITAT = "Fiktiver alter Mischwert 83";
const MISCHTEXT = `${MARKE}: ${ZITAT}. Allgemeiner eigener Prüfhinweis.`;
const EIGEN = "Meine bestätigte freie Eigenarbeit";
const NEU_EIGEN = "Meine neue unabhängige Planung";
const FREI = { pfad: "/fragen", seitenName: "Fragen", objekt: "Eigene Frage" };
const PASSWORT = "Rc2-Altklasse-fiktiv-2026";
const ADMINMAIL = "admin-rc2-alt@klarwerk.test";
const ANNAMAIL = "anna-rc2-alt@klarwerk.test";
const netz = vi.fn(async () => {
  throw new Error("Keine externen RC2-Altklassenabrufe");
});
let services: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
let admin: Konto;
let anna: Konto;
let lauf: (() => Promise<KlaraErinnerungLaufbericht>) | null;
let urls: string[];

async function auf(
  wer: Konto | null,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: Record<string, unknown>,
) {
  urls.push(url);
  return app.inject({
    method,
    url,
    headers: wer ? { authorization: `Bearer ${wer.token}` } : {},
    ...(payload ? { payload } : {}),
  });
}
type Antwort = Awaited<ReturnType<typeof auf>>;

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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T08:00:00Z"));
  netz.mockClear();
  vi.stubGlobal("fetch", netz);
  urls = [];
  lauf = null;
  services = assembleServices(inMemoryRepos());
  delete services.push;
  app = buildApp(services, {
    klaraErinnerungen: (l) => {
      lauf = l;
      return 60_000;
    },
  });
  expect(
    (
      await auf(null, "POST", "/api/auth/register", {
        name: "RC2 Alt Admin",
        email: ADMINMAIL,
        password: PASSWORT,
      })
    ).statusCode,
  ).toBe(201);
  admin = await anmelden(ADMINMAIL);
  expect(
    (
      await auf(admin, "POST", "/api/users", {
        name: "RC2 Alt Anna",
        email: ANNAMAIL,
        password: PASSWORT,
        role: "experte",
      })
    ).statusCode,
  ).toBe(201);
  anna = await anmelden(ANNAMAIL);
});

afterEach(async () => {
  try {
    await app?.close();
    expect(netz).not.toHaveBeenCalled();
    expect(urls.filter((u) => u === "/api/ask")).toEqual([]);
  } finally {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

async function antwortbestand() {
  const kos = [];
  for (const title of [MARKE, "Fiktive freie Altklassen-Checkliste"]) {
    const ko = await services.ko.create({
      title,
      statement: `${title}: Prüfhinweis.`,
      type: "best_practice",
      category: "RC2 Altklasse fiktiv",
      confidentiality: "intern",
      author: admin.id,
    });
    await services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [anna.id] }, admin.id);
    kos.push(ko);
  }
  const geheim = kos[0];
  const erlaubt = kos[1];
  if (!geheim || !erlaubt) throw new Error("Beide fiktiven Quellen fehlen");
  const g = await auf(anna, "POST", G, { objektbezug: FREI });
  expect(g.statusCode, g.body).toBe(201);
  const gid = g.json<{ gespraech: { id: string } }>().gespraech.id;
  expect((await auf(anna, "PUT", `${G}/${gid}/einwilligung`, { erteilt: true })).statusCode).toBe(
    200,
  );
  const eigeneNachricht = await auf(anna, "POST", `${G}/${gid}/nachrichten`, {
    von: "du",
    modus: "frage",
    text: EIGEN,
    objektbezug: FREI,
  });
  expect(eigeneNachricht.statusCode, eigeneNachricht.body).toBe(201);
  const eigeneNachrichtId = eigeneNachricht.json<{ nachricht: { id: string } }>().nachricht.id;
  const antwortId = `rc2-alte-antwort-${gid}`;
  expect(
    await services.answerSnapshots.createRecord({
      answerId: antwortId,
      askExecutionId: `rc2-alte-ausfuehrung-${gid}`,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
      owner: { kind: "user", userId: anna.id },
    }),
  ).toBe(true);
  const s: AnswerEvidenceSnapshot = {
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
    await services.answerSnapshots.appendSnapshot({ ...s, integrityHash: hashAnswerSnapshot(s) }),
  ).toBe(true);
  const r = await auf(anna, "POST", `${G}/${gid}/nachrichten`, {
    von: "klara",
    modus: "ohne_ki",
    text: MISCHTEXT,
    objektbezug: FREI,
    antwortId,
    quellen: kos.map((k) => k.id),
  });
  expect(r.statusCode, r.body).toBe(201);
  const nid = r.json<{ nachricht: { id: string } }>().nachricht.id;
  const quellrecht = async (lesbar: boolean) => {
    await services.ko.setQuellrechte(
      geheim.id,
      { stufe: "intern", leser: lesbar ? [anna.id] : [] },
      admin.id,
    );
    expect((await auf(anna, "GET", `/api/kos/${geheim.id}`)).statusCode).toBe(lesbar ? 200 : 404);
    expect((await auf(anna, "GET", `/api/kos/${erlaubt.id}`)).statusCode).toBe(200);
  };
  return { gid, nid, eigeneNachrichtId, geheim, antwortId, quellrecht };
}

// Vollständiger normal möglicher6039-Ausgabestand, nicht aus einem neuen Task mit gelöschtem Flag.
async function alterStand(gid: string, nid: string) {
  const am = new Date().toISOString();
  const notiz: KlaraNotiz = {
    id: randomUUID(),
    kontoId: anna.id,
    vorgang: `rc2-alt-n-${randomUUID()}`,
    art: "notiz",
    weg: "gespraech",
    titel: MARKE,
    inhalt: MISCHTEXT,
    offeneFragen: [],
    objektbezug: FREI,
    quelle: { gespraechId: gid, nachrichtId: nid },
    angelegtAm: am,
    geaendertAm: am,
    fassung: 1,
  };
  const aufgabe: KlaraAufgabe = {
    id: randomUUID(),
    kontoId: anna.id,
    vorgang: `rc2-alt-a-${randomUUID()}`,
    bereich: "persoenlich",
    weg: "notiz",
    titel: notiz.titel,
    inhalt: notiz.inhalt,
    prioritaet: "mittel",
    status: "offen",
    bezug: { art: "notiz", notizId: notiz.id, notizTitel: notiz.titel },
    objektbezug: notiz.objektbezug,
    angelegtAm: am,
    geaendertAm: am,
    erledigtAm: null,
    fassung: 1,
  };
  const nr = services.klaraNotizenRoh ?? services.klaraNotizen;
  expect(await nr.lege(notiz)).toBe(true);
  expect(await services.klaraAufgaben.lege(aufgabe)).toBe(true);
  const erinnerungen: KlaraErinnerung[] = [];
  for (const bezug of [
    { art: "notiz", notizId: notiz.id, notizTitel: notiz.titel } as const,
    { art: "aufgabe", aufgabeId: aufgabe.id, aufgabeTitel: aufgabe.titel } as const,
  ]) {
    const e: KlaraErinnerung = {
      id: randomUUID(),
      kontoId: anna.id,
      vorgang: `rc2-alt-e-${randomUUID()}`,
      bereich: "persoenlich",
      titel: MARKE,
      notiz: MISCHTEXT,
      bezug,
      objektbezug: FREI,
      zeitzone: "Europe/Berlin",
      zeitplan: {
        art: "serie",
        datum: "2026-10-21",
        uhrzeit: "11:00",
        wiederholung: { takt: "taeglich", intervall: 1, wochentage: [], bis: null, anzahl: 2 },
      },
      sommerzeit: { luecke: "verschieben", doppelt: "erste" },
      verpasst: { regel: "nachholen", grenzeMinuten: 30 },
      aktion: "erinnern",
      routine: null,
      ziel: "glocke",
      status: "aktiv",
      ausnahmen: {},
      zustaendig: null,
      quelleFehltAkzeptiert: false,
      serieVon: null,
      angelegtAm: am,
      geaendertAm: am,
      fassung: 1,
    };
    expect(
      await services.klaraErinnerungen.erinnerungen.lege(e, {
        bearbeitetBis: Date.now(),
        naechste: naechsteFaelligkeit(e, Date.now()),
      }),
    ).toBe(true);
    erinnerungen.push(e);
  }
  expect(Object.hasOwn(notiz, "antwortId")).toBe(false);
  expect(Object.hasOwn(notiz, "wissensHerkunft")).toBe(false);
  expect(Object.hasOwn(aufgabe, "privatNotizGebunden")).toBe(false);
  for (const e of erinnerungen) expect(Object.hasOwn(e, "wissensQuellen")).toBe(false);
  return { notiz, aufgabe, erinnerungen };
}

async function neueFreieArbeit(gid: string, eigeneNachrichtId: string) {
  // Auch die freie alte g/n-Notiz hat noch keinen neuen Antwortmarker. Ihre echte eigene
  // Nachricht ist vorhanden: der heutige normale Kopierweg kann sie positiv als frei prüfen.
  const am = new Date().toISOString();
  const notiz: KlaraNotiz = {
    id: randomUUID(),
    kontoId: anna.id,
    vorgang: `rc2-frei-n-${randomUUID()}`,
    art: "notiz",
    weg: "gespraech",
    titel: EIGEN,
    inhalt: EIGEN,
    offeneFragen: [],
    objektbezug: FREI,
    quelle: { gespraechId: gid, nachrichtId: eigeneNachrichtId },
    angelegtAm: am,
    geaendertAm: am,
    fassung: 1,
  };
  expect(await (services.klaraNotizenRoh ?? services.klaraNotizen).lege(notiz)).toBe(true);
  const a = await auf(anna, "POST", A, {
    vorgang: `rc2-frei-a-${randomUUID()}`,
    weg: "notiz",
    quelle: { notizId: notiz.id },
  });
  expect(a.statusCode, a.body).toBe(201);
  const aufgabe = a.json<{ aufgabe: { id: string } }>().aufgabe;
  const ids: string[] = [];
  let aufgabeErinnerungId = "";
  for (const bezug of [
    { art: "notiz", notizId: notiz.id },
    { art: "aufgabe", aufgabeId: aufgabe.id },
  ]) {
    const r = await auf(anna, "POST", E, {
      vorgang: `rc2-frei-e-${randomUUID()}`,
      bezug,
      zeitzone: "Europe/Berlin",
      zeitplan: {
        art: "serie",
        datum: "2026-10-21",
        uhrzeit: "11:00",
        wiederholung: { takt: "taeglich", intervall: 1, anzahl: 2 },
      },
    });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json<{ erinnerung: { id: string } }>().erinnerung.id;
    ids.push(id);
    if (bezug.art === "aufgabe") aufgabeErinnerungId = id;
  }
  if (!aufgabeErinnerungId) throw new Error("Eigene Aufgaben-Erinnerung fehlt");
  return { notiz, aufgabe, ids, aufgabeErinnerungId };
}

async function takt(am: string) {
  vi.setSystemTime(new Date(am));
  admin = await anmelden(ADMINMAIL);
  anna = await anmelden(ANNAMAIL);
  if (!lauf) throw new Error("Normaler Erinnerungstakt fehlt");
  await lauf();
}

function geschuetzt(r: Antwort, quelleId: string, antwortId: string) {
  expect.soft([200, 404, 409], r.body).toContain(r.statusCode);
  for (const wort of [MARKE, ZITAT, quelleId, antwortId]) expect.soft(r.body).not.toContain(wort);
}

it("RC2-Altklasse6039: fehlende Note und fehlende alte Marker sind keine Freigabe; eigene Verwaltung und belegte freie Arbeit bleiben", async () => {
  const b = await antwortbestand();
  const alt = await alterStand(b.gid, b.nid);
  const bekannt = await alterStand(b.gid, b.nid);
  const frei = await neueFreieArbeit(b.gid, b.eigeneNachrichtId);
  const record = await services.answerSnapshots.findRecord(b.antwortId);
  const snapshots = await services.answerSnapshots.listSnapshots(b.antwortId);
  for (const k of [alt, bekannt]) {
    const r = await auf(anna, "GET", `${A}/${k.aufgabe.id}`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.body).toContain(MISCHTEXT);
  }
  await takt("2026-10-21T09:00:00Z");
  expect((await auf(anna, "GET", "/api/notifications")).body).toContain(MARKE);
  for (const id of [alt.notiz.id, frei.notiz.id]) {
    expect((await auf(anna, "DELETE", `${N}/${id}`)).statusCode).toBe(200);
  }
  await b.quellrecht(false);
  const roh = structuredClone(await services.klaraAufgaben.hole(anna.id, alt.aufgabe.id));
  const alteErinnerungen = await Promise.all(
    alt.erinnerungen.map((e) => services.klaraErinnerungen.erinnerungen.hole(anna.id, e.id)),
  );

  const unklar = await auf(anna, "GET", `${A}/${alt.aufgabe.id}`);
  geschuetzt(unklar, b.geheim.id, b.antwortId);
  expect.soft(unklar.statusCode, unklar.body).toBe(200);
  expect(
    unklar.json<{ aufgabe: { id: string; status: string; fassung: number } }>().aufgabe,
  ).toMatchObject({ id: alt.aufgabe.id, status: "offen", fassung: 1 });
  for (const url of [A, E, "/api/notifications", `${A}/${bekannt.aufgabe.id}`]) {
    geschuetzt(await auf(anna, "GET", url), b.geheim.id, b.antwortId);
  }
  for (const e of alt.erinnerungen) {
    geschuetzt(await auf(anna, "GET", `${E}/${e.id}`), b.geheim.id, b.antwortId);
  }
  expect(await services.klaraAufgaben.hole(anna.id, alt.aufgabe.id)).toEqual(roh);
  expect(
    await Promise.all(
      alt.erinnerungen.map((e) => services.klaraErinnerungen.erinnerungen.hole(anna.id, e.id)),
    ),
  ).toEqual(alteErinnerungen);

  // Eine normale Status-/Prioritätsänderung darf den neutralen Rundlauf nicht in Rohtext schreiben.
  const sicht = unklar.json<{ aufgabe: KlaraAufgabe }>().aufgabe;
  const verwaltung = await auf(anna, "PUT", `${A}/${alt.aufgabe.id}`, {
    fassung: 1,
    status: "erledigt",
    prioritaet: "hoch",
    titel: sicht.titel,
    inhalt: sicht.inhalt,
  });
  expect(verwaltung.statusCode, verwaltung.body).toBe(200);
  geschuetzt(verwaltung, b.geheim.id, b.antwortId);
  const nachStatus = await services.klaraAufgaben.hole(anna.id, alt.aufgabe.id);
  expect(nachStatus).toMatchObject({
    titel: MARKE,
    inhalt: MISCHTEXT,
    status: "erledigt",
    prioritaet: "hoch",
    fassung: 2,
  });
  const eigenerTitel = await auf(anna, "PUT", `${A}/${alt.aufgabe.id}`, {
    fassung: 2,
    titel: NEU_EIGEN,
  });
  expect(eigenerTitel.statusCode, eigenerTitel.body).toBe(200);
  expect(eigenerTitel.body).toContain(NEU_EIGEN);
  geschuetzt(eigenerTitel, b.geheim.id, b.antwortId);
  expect((await services.klaraAufgaben.hole(anna.id, alt.aufgabe.id))?.inhalt).toBe(MISCHTEXT);

  const eigeneAufgabe = await auf(anna, "GET", `${A}/${frei.aufgabe.id}`);
  expect.soft(eigeneAufgabe.statusCode, eigeneAufgabe.body).toBe(200);
  expect.soft(eigeneAufgabe.body).toContain(EIGEN);
  for (const id of frei.ids) {
    const r = await auf(anna, "GET", `${E}/${id}`);
    expect.soft(r.statusCode, r.body).toBe(200);
    expect.soft(r.body).toContain(EIGEN);
  }
  const vorher = await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100);
  await takt("2026-10-22T09:00:00Z");
  const neu = (await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100)).filter(
    (m) => !vorher.some((v) => v.id === m.id),
  );
  expect
    .soft(
      neu.some((m) =>
        [...alt.erinnerungen, ...bekannt.erinnerungen].some((e) => e.id === m.erinnerungId),
      ),
    )
    .toBe(false);
  // Der direkte Bezug zur gelöschten Notiz behält seinen normalen Klärungsweg.
  // Die vorhandene freie Aufgabe besteht und ihre eigene Erinnerung bleibt ausführbar.
  expect
    .soft(neu.some((m) => m.erinnerungId === frei.aufgabeErinnerungId && m.titel === EIGEN))
    .toBe(true);
  await b.quellrecht(true);
  expect((await auf(anna, "GET", `${A}/${bekannt.aufgabe.id}`)).body).toContain(MISCHTEXT);
  const nochUnklar = await auf(anna, "GET", `${A}/${alt.aufgabe.id}`);
  geschuetzt(nochUnklar, b.geheim.id, b.antwortId);
  expect(nochUnklar.body).toContain(NEU_EIGEN);
  expect(await services.answerSnapshots.findRecord(b.antwortId)).toEqual(record);
  expect(await services.answerSnapshots.listSnapshots(b.antwortId)).toEqual(snapshots);
  expect((await auf(anna, "DELETE", `${A}/${alt.aufgabe.id}`)).statusCode).toBe(200);
  for (const e of alt.erinnerungen)
    expect((await auf(anna, "DELETE", `${E}/${e.id}`)).statusCode).toBe(200);
});
