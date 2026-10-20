import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraDNormAuftragsPort } from "../../services/app/src/klara-d-normauftrag-vertrag";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import { type Konto, neuesKonto } from "../klara-quellen-nutzerweg/kette";
import type { App } from "./vorrichtung";
let app: App;
let s: ReturnType<typeof assembleServices>;
let ich: Konto;
let admin: Konto;
let kid = "";
let port: KlaraDNormAuftragsPort;
let lauf: () => Promise<KlaraErinnerungLaufbericht>;
const TEXT = "Norm N-17 v2: Ankündigung am 2026-11-01; Geltung: Werk A.";
const auf = (method: "GET" | "POST" | "PUT", url: string, payload?: unknown, person = ich) =>
  app.inject({
    method,
    url,
    headers: person.kopf,
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T06:59:00Z"));
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("KLARWERK_LOCAL_LLM_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  s = assembleServices(inMemoryRepos());
  app = buildApp(s, {
    klaraErinnerungen: (fn) => {
      lauf = fn;
      return 65000;
    },
    dNormAuftragsPort: (p) => {
      port = p;
    },
  });
  await app.ready();
  admin = await neuesKonto(app, "gd-joint-admin");
  ich = await neuesKonto(app, "gd-joint-expert", admin);
  kid = (await auf("GET", "/api/auth/me")).json().id;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await app.close();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
const aufgaben = async () => (await auf("GET", "/api/me/klara/aufgaben")).json().aufgaben;
const normen = async () => (await auf("GET", "/api/me/klara/normereignisse")).json();
async function quelle() {
  return s.ko.create({
    title: "Fiktive wirkliche D-G-Normquelle",
    statement: TEXT,
    type: "technik",
    category: "Kompositionsprobe",
    author: kid,
    confidentiality: "intern",
  });
}
async function einrichten(qid: string, folge: boolean) {
  const wissenspflege = {
    vorlage: "quellaenderung",
    quellen: [qid],
    normbekanntmachungen: "belege_vorbereiten",
    ...(folge ? { folgepruefung: "persoenliche_normpruefaufgabe" } : {}),
  };
  const v = await auf("POST", "/api/me/klara/erinnerungen/wissenspflege/vorschau", {
    wissenspflege,
  });
  expect(v.statusCode, v.body).toBe(200);
  expect(v.json().wirkung).toBe("keine");
  const r = await auf("POST", "/api/me/klara/erinnerungen", {
    vorgang: `gd-joint-${crypto.randomUUID()}`,
    titel: "Wirklich bestellter fiktiver Normwatch",
    aktion: "routine_bericht",
    zeitzone: "Europe/Berlin",
    routine: { wissenspflege },
    zeitplan: {
      art: "serie",
      datum: "2026-10-20",
      uhrzeit: "09:00",
      wiederholung: { takt: "taeglich", intervall: 1, bis: "2026-10-22", anzahl: null },
    },
    verpasst: { regel: "nachholen", grenzeMinuten: 30 },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().erinnerung;
}
it("DG-D1 · reale zusätzliche D-Bestellung → erster echter Eingang/original/ausfuehren → persönliche Originalaufgabe; gleiche Bekanntmachung im Folgelauf erhält Aufgabe/Anleitung/History", async () => {
  const q = await quelle();
  const guide = await s.ko.create({
    title: "Fiktive geltende Anleitung",
    statement: "Ursprüngliche Anleitungsfassung bleibt unverändert.",
    type: "technik",
    category: "Kompositionsprobe",
    author: kid,
    confidentiality: "intern",
  });
  expect(
    (await auf("POST", "/api/lifecycle/couple", { assetRef: "Norm N-17", koId: guide.id }))
      .statusCode,
  ).toBe(204);
  const validate = await auf(
    "PUT",
    `/api/kos/${guide.id}`,
    { action: "admin-validate", duplicateAcknowledged: true },
    admin,
  );
  expect(validate.statusCode, validate.body).toBe(200);
  const vorher = (await auf("GET", `/api/kos/${guide.id}`)).body;
  const human = await auf("POST", "/api/me/klara/gespraeche", {
    objektbezug: {
      pfad: "/fragen",
      seitenName: "Fragen",
      objekt: "Wirklicher leerer menschlicher Kontext",
    },
  });
  expect(human.statusCode).toBe(201);
  const hid = human.json().gespraech.id;
  const eingang = vi.spyOn(port, "eingang");
  const original = vi.spyOn(port, "original");
  const aus = vi.spyOn(port, "ausfuehren");
  const e = await einrichten(q.id, true);
  expect(e.routine.wissenspflege.folgepruefung).toBe("persoenliche_normpruefaufgabe");
  expect(await aufgaben()).toHaveLength(0);
  expect((await normen()).normen).toHaveLength(0);
  expect(eingang).not.toHaveBeenCalled();
  vi.setSystemTime(new Date("2026-10-20T07:01:00Z"));
  const erster = await lauf();
  const tasks = await aufgaben();
  expect(
    tasks,
    JSON.stringify({
      erster,
      normen: await normen(),
      routine: (await auf("GET", `/api/me/klara/erinnerungen/${e.id}`)).json(),
    }),
  ).toHaveLength(1);
  expect(eingang).toHaveBeenCalledTimes(1);
  expect(original).toHaveBeenCalled();
  expect(aus).toHaveBeenCalledTimes(1);
  const n = (await normen()).normen[0];
  expect(n.annahmen).toEqual([]);
  const event = n.ereignisse[0];
  expect(event.pruefauftrag).toBeTruthy();
  expect(event.pruefeingang.eingabe.notiz.id).toBe(tasks[0].bezug.notizId);
  const ref = event.pruefauftrag;
  const jobs = (await auf("GET", `/api/me/klara/gespraeche/${ref.gespraechId}/auftraege`)).json()
    .auftraege;
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    id: ref.auftragId,
    quelle: "d_routine",
    herkunft: { art: "d_normereignis", eigentuemer: kid, pruefVorgang: event.pruefVorgang },
    stand: "abgeschlossen",
  });
  expect(jobs[0].schritte[0].ergebnis.id).toBe(tasks[0].id);
  expect(jobs[0].wortlaut).toContain("Gespeicherte ausdrückliche D-Bestellung");
  const note = (await auf("GET", `/api/me/klara/notizen/${tasks[0].bezug.notizId}`)).body;
  await s.ko.revise(
    q.id,
    { statement: `${TEXT}\nKopie derselben begrenzten Bekanntmachung.` },
    kid,
  );
  vi.setSystemTime(new Date("2026-10-21T07:01:00Z"));
  await lauf();
  expect((await aufgaben()).map((t: { id: string }) => t.id)).toEqual([tasks[0].id]);
  const danach = (await normen()).normen[0];
  expect(danach.id).toBe(n.id);
  expect(danach.ereignisse).toHaveLength(1);
  expect(danach.ereignisse[0].pruefauftrag).toEqual(ref);
  expect(danach.annahmen).toEqual([]);
  expect(eingang).toHaveBeenCalledTimes(1);
  expect(aus).toHaveBeenCalledTimes(1);
  expect(original.mock.calls.length).toBeGreaterThan(1);
  expect((await auf("GET", `/api/me/klara/notizen/${tasks[0].bezug.notizId}`)).body).toBe(note);
  expect((await auf("GET", `/api/kos/${guide.id}`)).body).toBe(vorher);
  expect((await auf("GET", "/api/me/klara/gespraech")).json().gespraech.id).toBe(hid);
});
it("DG-D2 · tatsächlicher unveränderter Belegwatch ohne neue Bestellung erreicht den vorhandenen G-Port nie und erzeugt keine Folgeaufgabe", async () => {
  const q = await quelle();
  const eingang = vi.spyOn(port, "eingang");
  const aus = vi.spyOn(port, "ausfuehren");
  await einrichten(q.id, false);
  vi.setSystemTime(new Date("2026-10-20T07:01:00Z"));
  await lauf();
  expect((await normen()).normen).toHaveLength(1);
  expect(await aufgaben()).toHaveLength(0);
  expect(await s.klaraGespraeche.anzahl(kid)).toBe(0);
  expect(eingang).not.toHaveBeenCalled();
  expect(aus).not.toHaveBeenCalled();
});

it.each([
  { quelle: "Normquelle", aenderung: "Rechteentzug" },
  { quelle: "Anleitung", aenderung: "Rechteentzug" },
  { quelle: "Normquelle", aenderung: "Entfernung" },
  { quelle: "Anleitung", aenderung: "Entfernung" },
])(
  "DG-1 · $aenderung der kopierten $quelle schützt normale Notiz-/Aufgabenleser und Kopiercaller, erhält Originale und unabhängige eigene Notiz",
  async (fall) => {
    const q = await quelle();
    const guide = await s.ko.create({
      title: "Fiktive quellengebundene Anleitung",
      statement: "Fiktive unveränderte Regel mit geschütztem Namen.",
      type: "technik",
      category: "Kompositionsprobe",
      author: kid,
      confidentiality: "intern",
    });
    await s.lifecycle.couple("Norm N-17", guide.id, kid);
    await einrichten(q.id, true);
    vi.setSystemTime(new Date("2026-10-20T07:01:00Z"));
    await lauf();
    const tasks = await aufgaben();
    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    const notizId = task.bezug.notizId;
    const lesen = await auf("GET", `/api/me/klara/notizen/${notizId}`);
    expect(lesen.statusCode, lesen.body).toBe(200);
    const notiz = lesen.json().notiz;
    expect(notiz.inhalt).toContain(guide.title);
    expect(notiz.inhalt).toContain("Norm N-17 v2");
    expect(notiz.wissensHerkunft).toMatchObject({ anbieter: null, modell: null });
    expect(notiz.wissensHerkunft.aussagen[0].quellen).toEqual([
      { id: q.id, fassung: (await s.ko.get(q.id))?.version },
      { id: guide.id, fassung: (await s.ko.get(guide.id))?.version },
    ]);
    expect((await auf("GET", `/api/me/klara/aufgaben/${task.id}`)).statusCode).toBe(200);
    expect(
      (await auf("POST", `/api/me/klara/notizen/${notizId}/wissen/pruefen`, {})).statusCode,
    ).toBe(200);
    const ziel = {
      art: "artikel",
      confidentiality: "intern",
      type: "technik",
      category: "Wartung",
      conditions: ["Nur bei Stillstand", "Nur durch Fachpersonal"],
    };
    expect(
      (
        await auf("POST", `/api/me/klara/notizen/${notizId}/wissen/vorschau`, {
          fassung: notiz.fassung,
          ziel,
        })
      ).statusCode,
    ).toBe(200);
    // Normaler öffentlicher Als-Aufgabe-Caller: kein interner D-Parameter und kein Client-Grant.
    const kopie = await auf("POST", "/api/me/klara/aufgaben", {
      vorgang: `dg-kopie-${crypto.randomUUID()}`,
      weg: "notiz",
      quelle: { notizId },
      notizFassung: notiz.fassung,
    });
    expect(kopie.statusCode, kopie.body).toBe(201);
    const kopieId = kopie.json().aufgabe.id;
    expect((await auf("GET", `/api/me/klara/aufgaben/${kopieId}`)).statusCode).toBe(200);
    const frei = await auf("POST", "/api/me/klara/notizen", {
      vorgang: `dg-unabhaengig-${crypto.randomUUID()}`,
      weg: "geschrieben",
      titel: "Unabhängige eigene Notiz",
      inhalt: "Eigener Text ohne Norm- oder Anleitungsquelle.",
      objektbezug: { pfad: "/aufgaben", seitenName: "Meine Aufgaben", objekt: "Eigener Text" },
    });
    expect(frei.statusCode, frei.body).toBe(201);
    const freieNotiz = frei.json().notiz;
    expect(freieNotiz.wissensHerkunft).toBeUndefined();
    const freieAufgabe = await auf("POST", "/api/me/klara/aufgaben", {
      vorgang: `dg-frei-${crypto.randomUUID()}`,
      weg: "notiz",
      quelle: { notizId: freieNotiz.id },
    });
    expect(freieAufgabe.statusCode, freieAufgabe.body).toBe(201);
    const freiId = freieAufgabe.json().aufgabe.id;
    const fristenVorher = await s.klaraFristen.hole(kid);
    const ref = fristenVorher?.normereignisse?.[0]?.ereignisse[0]?.pruefauftrag;
    if (!ref) throw new Error("Tatsächlicher Originalauftrag fehlt.");
    const journalVorher = await s.klaraGespraeche.hole(kid, ref.gespraechId);
    const notizenRoh = s.klaraNotizenRoh;
    if (!notizenRoh) throw new Error("Die unveränderte Originalnotizablage fehlt.");
    const notizVorher = await notizenRoh.hole(kid, notizId);
    const entzogen = fall.quelle === "Normquelle" ? q.id : guide.id;
    if (fall.aenderung === "Rechteentzug")
      await s.ko.setQuellrechte(entzogen, { stufe: "intern", leser: [] }, kid);
    else await s.ko.delete(entzogen, kid);
    expect((await auf("GET", `/api/kos/${entzogen}`)).statusCode).toBe(404);
    expect((await auf("GET", `/api/me/klara/notizen/${notizId}`)).statusCode).toBe(404);
    for (const id of [task.id, kopieId])
      expect((await auf("GET", `/api/me/klara/aufgaben/${id}`)).statusCode).toBe(404);
    const notizenListe = await auf("GET", "/api/me/klara/notizen");
    expect(notizenListe.json().notizen.map((n: { id: string }) => n.id)).toEqual([freieNotiz.id]);
    expect((await aufgaben()).map((a: { id: string }) => a.id)).toEqual([freiId]);
    expect((await auf("GET", `/api/me/klara/notizen/${freieNotiz.id}`)).json().notiz).toEqual(
      freieNotiz,
    );
    expect((await auf("GET", `/api/me/klara/aufgaben/${freiId}`)).statusCode).toBe(200);
    expect(
      (await auf("POST", `/api/me/klara/notizen/${notizId}/wissen/pruefen`, {})).statusCode,
    ).toBe(404);
    expect(
      (
        await auf("POST", `/api/me/klara/notizen/${notizId}/wissen/vorschau`, {
          fassung: notiz.fassung,
          ziel,
        })
      ).statusCode,
    ).toBe(404);
    const spaeteKopie = await auf("POST", "/api/me/klara/aufgaben", {
      vorgang: `dg-spaet-${crypto.randomUUID()}`,
      weg: "notiz",
      quelle: { notizId },
    });
    expect(spaeteKopie.statusCode, spaeteKopie.body).toBe(404);
    expect((await normen()).normen).toEqual([]);
    // Verborgene Wirkung ist nicht gelöscht: Originalnotiz, Tasks und D/G-Journale bleiben erhalten.
    expect(await notizenRoh.hole(kid, notizId)).toEqual(notizVorher);
    expect((await s.klaraAufgaben.hole(kid, task.id))?.id).toBe(task.id);
    expect((await s.klaraAufgaben.hole(kid, kopieId))?.id).toBe(kopieId);
    expect(await s.klaraFristen.hole(kid)).toEqual(fristenVorher);
    expect(await s.klaraGespraeche.hole(kid, ref.gespraechId)).toEqual(journalVorher);
    if (fall.aenderung === "Rechteentzug") {
      await s.ko.setQuellrechte(entzogen, { stufe: "intern", leser: [kid] }, kid);
      expect((await auf("GET", `/api/me/klara/notizen/${notizId}`)).json().notiz.id).toBe(notizId);
      for (const id of [task.id, kopieId])
        expect((await auf("GET", `/api/me/klara/aufgaben/${id}`)).json().aufgabe.id).toBe(id);
    }
  },
);
