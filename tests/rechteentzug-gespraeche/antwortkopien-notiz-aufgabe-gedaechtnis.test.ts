// RC2: genau zwei neue Servergegenfälle auf dem regulären Live-Vertrag 179c/.1019.
// Nur fiktiver Bestand über echte AnswerRecord/Snapshot-Ports, normale eigene App-Routen
// und den vorhandenen Erinnerungstakt. Keine Produktattrappe, kein Modell/Provider/Listener.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import { type AnswerEvidenceSnapshot, hashAnswerSnapshot } from "../../services/ask";

type Konto = { id: string; token: string };
type Textobjekt = { id: string; fassung: number; titel: string; inhalt: string };
type Erinnerung = { id: string; fassung: number; titel: string };
type Merkeintrag = {
  id: string;
  fassung?: number;
  inhalt: string;
  antwort: string | null;
  herkunft: { art: string; antwortId: string | null };
};
const GESPRAECHE = "/api/me/klara/gespraeche";
const NOTIZEN = "/api/me/klara/notizen";
const AUFGABEN = "/api/me/klara/aufgaben";
const ERINNERUNGEN = "/api/me/klara/erinnerungen";
const GEDAECHTNIS = "/api/me/gedaechtnis";
const KENNWORT = "Rc2-fiktives-Kennwort-2026";
const ADMINMAIL = "admin-rc2@klarwerk.test";
const ANNAMAIL = "anna-rc2@klarwerk.test";
const MARKE = "Fiktive-RC2-Quelle-Erle";
const ZITAT = "Fiktiver abgeleiteter Druckwert 47";
const MISCHTEXT = `${MARKE}: ${ZITAT}. Allgemeine Empfehlung: die freie Checkliste prüfen.`;
const EIGEN = "Meine eigene freie Checkliste für morgen";
const FRAGE = "Welche eigenen freien Arbeitsschritte plane ich?";
const FREI = { pfad: "/fragen", seitenName: "Fragen", objekt: "Eigene Frage" };
const netz = vi.fn(async () => {
  throw new Error("RC2 verwendet keinen externen Abruf");
});
let services: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
let admin: Konto;
let anna: Konto;
let lauf: (() => Promise<KlaraErinnerungLaufbericht>) | null;
let aufrufe: string[];

async function auf(
  konto: Konto | null,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: Record<string, unknown>,
) {
  aufrufe.push(url);
  return app.inject({
    method,
    url,
    headers: konto ? { authorization: `Bearer ${konto.token}` } : {},
    ...(payload ? { payload } : {}),
  });
}
type Antwort = Awaited<ReturnType<typeof auf>>;

async function anmelden(email: string): Promise<Konto> {
  const r = await auf(null, "POST", "/api/auth/login", { email, password: KENNWORT });
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
  aufrufe = [];
  lauf = null;
  services = assembleServices(inMemoryRepos());
  delete services.push;
  app = buildApp(services, {
    klaraErinnerungen: (vorhandenerLauf) => {
      lauf = vorhandenerLauf;
      return 60_000;
    },
  });
  const r = await auf(null, "POST", "/api/auth/register", {
    name: "RC2 Admin fiktiv",
    email: ADMINMAIL,
    password: KENNWORT,
  });
  expect(r.statusCode, r.body).toBe(201);
  admin = await anmelden(ADMINMAIL);
  const a = await auf(admin, "POST", "/api/users", {
    name: "RC2 Anna fiktiv",
    email: ANNAMAIL,
    password: KENNWORT,
    role: "experte",
  });
  expect(a.statusCode, a.body).toBe(201);
  anna = await anmelden(ANNAMAIL);
});

afterEach(async () => {
  try {
    await app?.close();
    expect(netz).not.toHaveBeenCalled();
    expect(aufrufe.filter((url) => url === "/api/ask")).toEqual([]);
  } finally {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

async function bestand() {
  const kos = [];
  for (const title of [MARKE, "Fiktive RC2 allgemeine Checkliste"]) {
    const ko = await services.ko.create({
      title,
      statement: `${title}: fiktiver Prüfhinweis.`,
      type: "best_practice",
      category: "RC2 fiktiv",
      confidentiality: "intern",
      author: admin.id,
    });
    // Produktiver kanonischer Quellrechts-Schreibdienst, keine ersetzte Rechteentscheidung.
    await services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [anna.id] }, admin.id);
    kos.push(ko);
  }
  const geheim = kos[0];
  const erlaubt = kos[1];
  if (!geheim || !erlaubt) throw new Error("Beide fiktiven Quellen sind Pflicht");
  for (const ko of kos) expect((await auf(anna, "GET", `/api/kos/${ko.id}`)).statusCode).toBe(200);
  const g = await auf(anna, "POST", GESPRAECHE, { objektbezug: FREI });
  expect(g.statusCode, g.body).toBe(201);
  const gespraechId = g.json<{ gespraech: { id: string } }>().gespraech.id;
  expect(
    (await auf(anna, "PUT", `${GESPRAECHE}/${gespraechId}/einwilligung`, { erteilt: true }))
      .statusCode,
  ).toBe(200);
  const frage = await auf(anna, "POST", `${GESPRAECHE}/${gespraechId}/nachrichten`, {
    von: "du",
    modus: "frage",
    text: FRAGE,
    objektbezug: FREI,
  });
  expect(frage.statusCode, frage.body).toBe(201);
  const antwortId = `rc2-antwort-${gespraechId}`;
  expect(
    await services.answerSnapshots.createRecord({
      answerId: antwortId,
      askExecutionId: `rc2-fiktiver-lauf-${gespraechId}`,
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
    citedSources: [erlaubt.id],
    evidence: kos.map((ko) => ({
      knowledgeObjectId: ko.id,
      knowledgeObjectVersion: ko.version,
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
  const belegt = { ...snapshot, integrityHash: hashAnswerSnapshot(snapshot) };
  expect(await services.answerSnapshots.appendSnapshot(belegt)).toBe(true);
  expect(await services.answerSnapshots.latestSnapshot(antwortId)).toEqual(belegt);
  const n = await auf(anna, "POST", `${GESPRAECHE}/${gespraechId}/nachrichten`, {
    von: "klara",
    modus: "ohne_ki",
    text: MISCHTEXT,
    objektbezug: FREI,
    antwortId,
    // Die nicht zitierte Mischquelle steht im echten Beleg, nicht im Seitenkontext/Clienthinweis.
    quellen: [erlaubt.id],
    quellenAngaben: [
      { koId: erlaubt.id, titel: erlaubt.title, fassung: erlaubt.version, geprueft: false },
    ],
  });
  expect(n.statusCode, n.body).toBe(201);
  expect(n.body).toContain(MISCHTEXT);
  const nachrichtId = n.json<{ nachricht: { id: string } }>().nachricht.id;
  const roh = await services.klaraGespraeche.hole(anna.id, gespraechId);
  const record = await services.answerSnapshots.findRecord(antwortId);
  expect(record?.owner).toEqual({ kind: "user", userId: anna.id });
  const snapshots = await services.answerSnapshots.listSnapshots(antwortId);
  const quellrecht = async (lesbar: boolean) => {
    await services.ko.setQuellrechte(
      geheim.id,
      { stufe: "intern", leser: lesbar ? [anna.id] : [] },
      admin.id,
    );
    expect((await auf(anna, "GET", `/api/kos/${geheim.id}`)).statusCode).toBe(lesbar ? 200 : 404);
    expect((await auf(anna, "GET", `/api/kos/${erlaubt.id}`)).statusCode).toBe(200);
  };
  const unveraendert = async () => {
    expect(await services.klaraGespraeche.hole(anna.id, gespraechId)).toEqual(roh);
    expect(await services.answerSnapshots.findRecord(antwortId)).toEqual(record);
    expect(await services.answerSnapshots.listSnapshots(antwortId)).toEqual(snapshots);
  };
  return { geheim, antwortId, gespraechId, nachrichtId, quellrecht, unveraendert };
}
type Bestand = Awaited<ReturnType<typeof bestand>>;

function geschuetzt(r: Antwort, b: Bestand, schreiben = false) {
  // Neutraler Inhalt oder vorhandene neutrale Ablehnung sind zulässig, kein Pflicht-201.
  expect.soft(schreiben ? [200, 201, 404, 409] : [200, 404, 409], r.body).toContain(r.statusCode);
  for (const wert of [MARKE, ZITAT, b.geheim.id, b.antwortId]) {
    expect.soft(r.body, `RC2 ${r.statusCode}: ${wert}`).not.toContain(wert);
  }
}

async function notiz(eingabe: Record<string, unknown>) {
  const r = await auf(anna, "POST", NOTIZEN, eingabe);
  expect(r.statusCode, r.body).toBe(201);
  return { daten: r.json<{ notiz: Textobjekt }>().notiz, eingabe };
}

async function aufgabe(notizId: string) {
  const eingabe = { vorgang: `rc2-aufgabe-${randomUUID()}`, weg: "notiz", quelle: { notizId } };
  const r = await auf(anna, "POST", AUFGABEN, eingabe);
  expect(r.statusCode, r.body).toBe(201);
  return { daten: r.json<{ aufgabe: Textobjekt }>().aufgabe, eingabe };
}

async function erinnerung(bezug: Record<string, string>) {
  const eingabe = {
    vorgang: `rc2-erinnerung-${randomUUID()}`,
    bezug,
    zeitzone: "Europe/Berlin",
    zeitplan: {
      art: "serie",
      datum: "2026-10-21",
      uhrzeit: "11:00",
      wiederholung: { takt: "taeglich", intervall: 1, anzahl: 3 },
    },
    aktion: "erinnern",
  };
  const r = await auf(anna, "POST", ERINNERUNGEN, eingabe);
  expect(r.statusCode, r.body).toBe(201);
  return { daten: r.json<{ erinnerung: Erinnerung }>().erinnerung, eingabe };
}

async function kette(n: Awaited<ReturnType<typeof notiz>>) {
  const a = await aufgabe(n.daten.id);
  const en = await erinnerung({ art: "notiz", notizId: n.daten.id });
  const ea = await erinnerung({ art: "aufgabe", aufgabeId: a.daten.id });
  return { notiz: n, aufgabe: a, notizErinnerung: en, erinnerungen: [en, ea] };
}

async function takt(zeit: string) {
  vi.setSystemTime(new Date(zeit));
  // Normale neue Sitzungen nach jedem Tageswechsel; kein abgelaufenes JWT als Quellentzug zählen.
  admin = await anmelden(ADMINMAIL);
  anna = await anmelden(ANNAMAIL);
  if (!lauf) throw new Error("Vorhandener Erinnerungstakt wurde nicht angeschlossen");
  return lauf();
}

it("RC2-Kopiekette: echte Mischantwort bindet normale Notiz, Aufgabe und beide Erinnerungsbezüge auch nach Notizlöschung", async () => {
  const b = await bestand();
  const eingabe = () => ({
    vorgang: `rc2-gespraechsnotiz-${randomUUID()}`,
    weg: "gespraech",
    quelle: { gespraechId: b.gespraechId, nachrichtId: b.nachrichtId },
  });
  const leben = await kette(await notiz(eingabe()));
  const geloescht = await kette(await notiz(eingabe()));
  const eigen = await kette(
    await notiz({
      vorgang: `rc2-eigene-notiz-${randomUUID()}`,
      weg: "geschrieben",
      inhalt: EIGEN,
      objektbezug: FREI,
    }),
  );
  const kopien = [leben, geloescht];
  const erinnerungen = kopien.flatMap((k) => k.erinnerungen);
  for (const k of kopien) {
    expect((await auf(anna, "GET", `${NOTIZEN}/${k.notiz.daten.id}`)).body).toContain(MISCHTEXT);
    expect((await auf(anna, "GET", `${AUFGABEN}/${k.aufgabe.daten.id}`)).body).toContain(MISCHTEXT);
    const raw = await services.klaraNotizen.hole(anna.id, k.notiz.daten.id);
    expect(raw?.quelle).toMatchObject({ gespraechId: b.gespraechId, nachrichtId: b.nachrichtId });
    expect(raw?.objektbezug).toEqual(FREI);
  }
  for (const e of erinnerungen) {
    const r = await auf(anna, "GET", `${ERINNERUNGEN}/${e.daten.id}`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.body).toContain(MARKE);
  }
  await takt("2026-10-21T09:00:00Z");
  expect((await auf(anna, "GET", "/api/notifications")).body).toContain(MARKE);
  expect((await auf(anna, "DELETE", `${NOTIZEN}/${geloescht.notiz.daten.id}`)).statusCode).toBe(
    200,
  );
  expect(await services.klaraNotizen.hole(anna.id, geloescht.notiz.daten.id)).toBeNull();
  await takt("2026-10-22T09:00:00Z");
  const en = geloescht.notizErinnerung.daten.id;
  const notizLaeufe = await services.klaraErinnerungen.laeufe.fuerErinnerung(en, 100);
  const fehlend = notizLaeufe.find((l) => l.ergebnis.grund === "quelle_geloescht");
  expect(
    notizLaeufe.some((l) => l.ergebnis.grund === "quelle_geloescht" || l.status === "gestoppt"),
  ).toBe(true);
  // Nur den tatsächlich erzeugten normalen Klärungszustand bedienen, keinen Laufstatus setzen.
  if (fehlend) {
    const alt = await services.klaraErinnerungen.erinnerungen.hole(anna.id, en);
    if (!alt) throw new Error("Gespeicherte Notiz-Erinnerung fehlt");
    const r = await auf(
      anna,
      "POST",
      `${ERINNERUNGEN}/${en}/laeufe/${fehlend.vorkommenId}/klaeren`,
      {
        fassung: alt.erinnerung.fassung,
        entscheidung: "fortfuehren",
      },
    );
    expect([200, 404, 409], r.body).toContain(r.statusCode);
  }
  await b.quellrecht(false);
  const gespraech = await auf(anna, "GET", `${GESPRAECHE}/${b.gespraechId}`);
  expect(gespraech.statusCode, gespraech.body).toBe(200);
  expect(gespraech.body).not.toContain(MARKE); // Bereits vorhandene D77-Referenzkontrolle.
  expect(gespraech.body).toContain(FRAGE);

  // Ab hier neue semantische Gegenpunkte, getrennt von den harten Montagevorbedingungen.
  for (const url of [NOTIZEN, AUFGABEN, ERINNERUNGEN, "/api/notifications"]) {
    const r = await auf(anna, "GET", url);
    geschuetzt(r, b);
    expect.soft(r.statusCode, r.body).toBe(200);
    expect.soft(r.body).toContain(EIGEN);
  }
  for (const k of kopien) {
    geschuetzt(await auf(anna, "GET", `${NOTIZEN}/${k.notiz.daten.id}`), b);
    geschuetzt(await auf(anna, "GET", `${AUFGABEN}/${k.aufgabe.daten.id}`), b);
    geschuetzt(await auf(anna, "POST", NOTIZEN, k.notiz.eingabe), b, true);
    geschuetzt(await auf(anna, "POST", AUFGABEN, k.aufgabe.eingabe), b, true);
    geschuetzt(
      await auf(anna, "PUT", `${NOTIZEN}/${k.notiz.daten.id}`, {
        fassung: k.notiz.daten.fassung,
        titel: k.notiz.daten.titel,
      }),
      b,
      true,
    );
    geschuetzt(
      await auf(anna, "PUT", `${AUFGABEN}/${k.aufgabe.daten.id}`, {
        fassung: k.aufgabe.daten.fassung,
        titel: k.aufgabe.daten.titel,
      }),
      b,
      true,
    );
  }
  for (const e of erinnerungen) {
    geschuetzt(await auf(anna, "GET", `${ERINNERUNGEN}/${e.daten.id}`), b);
    geschuetzt(await auf(anna, "POST", ERINNERUNGEN, e.eingabe), b, true);
    const alt = await services.klaraErinnerungen.erinnerungen.hole(anna.id, e.daten.id);
    if (!alt) throw new Error("Gespeicherte Erinnerung fehlt");
    geschuetzt(
      await auf(anna, "PUT", `${ERINNERUNGEN}/${e.daten.id}`, {
        fassung: alt.erinnerung.fassung,
        titel: alt.erinnerung.titel,
      }),
      b,
      true,
    );
  }
  if (fehlend) {
    const alt = await services.klaraErinnerungen.erinnerungen.hole(anna.id, en);
    if (!alt) throw new Error("Gespeicherte Notiz-Erinnerung fehlt");
    geschuetzt(
      await auf(anna, "POST", `${ERINNERUNGEN}/${en}/laeufe/${fehlend.vorkommenId}/klaeren`, {
        fassung: alt.erinnerung.fassung,
        entscheidung: "fortfuehren",
      }),
      b,
      true,
    );
  }
  for (const [basis, objekt] of [
    [NOTIZEN, eigen.notiz],
    [AUFGABEN, eigen.aufgabe],
  ] as const) {
    const r = await auf(anna, "PUT", `${basis}/${objekt.daten.id}`, {
      fassung: objekt.daten.fassung,
      titel: objekt.daten.titel,
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.body).toContain(EIGEN);
  }
  const vorher = await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100);
  await takt("2026-10-23T09:00:00Z");
  const danach = await services.klaraErinnerungen.meldungen.fuerKonto(anna.id, 100);
  const neu = danach.filter((m) => !vorher.some((v) => v.id === m.id));
  expect
    .soft(neu.filter((m) => erinnerungen.some((e) => e.daten.id === m.erinnerungId)))
    .toEqual([]);
  for (const e of eigen.erinnerungen) {
    expect(neu.some((m) => m.erinnerungId === e.daten.id && m.titel.includes(EIGEN))).toBe(true);
  }
  geschuetzt(await auf(anna, "GET", "/api/notifications"), b);
  await b.quellrecht(true);
  for (const url of [
    `${NOTIZEN}/${leben.notiz.daten.id}`,
    `${AUFGABEN}/${leben.aufgabe.daten.id}`,
  ]) {
    const r = await auf(anna, "GET", url);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.body).toContain(MISCHTEXT);
  }
  expect((await auf(anna, "GET", `${NOTIZEN}/${geloescht.notiz.daten.id}`)).statusCode).toBe(404);
  // Kein weiterer Takt nach Wiedererteilung und keine Wiederbelebung beendeter Serien behaupten.
  await b.unveraendert();
});

it("RC2-Gedächtnis: echte AntwortId schützt GET/POST/PUT-Echos bei Teilentzug und erhält eigene Eingaben und Löschen", async () => {
  const b = await bestand();
  const eingabe = {
    art: "frage_antwort",
    inhalt: FRAGE,
    antwort: MISCHTEXT,
    antwortId: b.antwortId,
  };
  const merken = async (payload: Record<string, unknown>) => {
    const r = await auf(anna, "POST", GEDAECHTNIS, payload);
    expect(r.statusCode, r.body).toBe(201);
    return r.json<{ eintrag: Merkeintrag }>().eintrag;
  };
  const gebunden = await merken(eingabe);
  const loeschbar = await merken(eingabe);
  const eigeneFrage = await merken({ art: "frage_antwort", inhalt: FRAGE, antwort: EIGEN });
  const vorliebe = await merken({ art: "vorliebe", inhalt: EIGEN, darstellung: "kurz" });
  expect(gebunden.herkunft).toMatchObject({ art: "antwort", antwortId: b.antwortId });
  expect(eigeneFrage.herkunft).toMatchObject({ art: "eigene_eingabe", antwortId: null });
  expect((await auf(anna, "GET", GEDAECHTNIS)).body).toContain(MISCHTEXT);
  await b.quellrecht(false);

  geschuetzt(await auf(anna, "GET", GEDAECHTNIS), b);
  geschuetzt(await auf(anna, "POST", GEDAECHTNIS, eingabe), b, true);
  geschuetzt(
    await auf(anna, "PUT", `${GEDAECHTNIS}/${gebunden.id}`, {
      fassung: gebunden.fassung ?? 1,
      inhalt: FRAGE,
    }),
    b,
    true,
  );
  for (const [e, payload] of [
    [eigeneFrage, { inhalt: FRAGE, antwort: EIGEN }],
    [vorliebe, { inhalt: EIGEN, darstellung: "ausfuehrlich" }],
  ] as const) {
    const r = await auf(anna, "PUT", `${GEDAECHTNIS}/${e.id}`, {
      fassung: e.fassung ?? 1,
      ...payload,
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json<{ eintrag: Merkeintrag }>().eintrag.herkunft).toEqual(e.herkunft);
    expect(r.body).toContain(EIGEN);
  }
  const frei = await merken({ art: "frage_antwort", inhalt: FRAGE, antwort: EIGEN });
  for (const e of [frei, loeschbar]) {
    expect((await auf(anna, "DELETE", `${GEDAECHTNIS}/${e.id}`)).statusCode).toBe(200);
  }
  const eigene = await auf(anna, "GET", GEDAECHTNIS);
  geschuetzt(eigene, b);
  const eintraege = eigene.json<{ eintraege: Merkeintrag[] }>().eintraege;
  expect(eintraege.find((e) => e.id === eigeneFrage.id)).toMatchObject({
    inhalt: FRAGE,
    antwort: EIGEN,
  });
  expect(eintraege.find((e) => e.id === vorliebe.id)).toMatchObject({ inhalt: EIGEN });
  expect(eintraege.some((e) => e.id === loeschbar.id || e.id === frei.id)).toBe(false);
  await b.quellrecht(true);
  const wieder = await auf(anna, "GET", GEDAECHTNIS);
  expect(wieder.statusCode, wieder.body).toBe(200);
  const alt = wieder
    .json<{ eintraege: Merkeintrag[] }>()
    .eintraege.find((e) => e.id === gebunden.id);
  expect(alt).toMatchObject({ antwort: MISCHTEXT, herkunft: gebunden.herkunft });
  if (!alt) throw new Error("Eigener gespeicherter Eintrag fehlt nach Wiedererteilung");
  const echo = await auf(anna, "PUT", `${GEDAECHTNIS}/${alt.id}`, {
    fassung: alt.fassung ?? 1,
    inhalt: FRAGE,
  });
  expect(echo.statusCode, echo.body).toBe(200);
  expect(echo.body).toContain(MISCHTEXT);
  expect((await merken(eingabe)).antwort).toBe(MISCHTEXT);
  await b.unveraendert();
});
