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
