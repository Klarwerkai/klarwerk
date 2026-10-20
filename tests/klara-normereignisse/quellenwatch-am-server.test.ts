import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import { pflegeAus } from "../../services/app/src/klara-wissenspflege";
import { type Konto, neuesKonto } from "../klara-quellen-nutzerweg/kette";
import { echterNotizauftrag } from "./pruefauftrag-vorrichtung";

const TEXT = "Norm N-17 v2: Ankündigung am 2026-11-01; Geltung: Werk A.";
let app: FastifyInstance;
let services: ReturnType<typeof buildServices>;
let ich: Konto;
let kontoId: string;
let lauf: () => Promise<KlaraErinnerungLaufbericht>;
beforeEach(async () => {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("KLARWERK_LOCAL_LLM_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T06:59:00Z"));
  services = buildServices();
  app = buildApp(services, {
    klaraErinnerungen: (fn) => {
      lauf = fn;
      return 65_000;
    },
  });
  await app.ready();
  const admin = await neuesKonto(app, "norm-watch-admin");
  ich = await neuesKonto(app, "norm-watch-expert", admin);
  kontoId = (await app.inject({ url: "/api/auth/me", headers: ich.kopf })).json().id;
});
afterEach(async () => {
  await app?.close();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
async function wissen(statement = TEXT) {
  return services.ko.create({
    title: "Fiktive Normwatchquelle",
    statement,
    type: "technik",
    category: "Synthetischer Normwatch",
    author: kontoId,
    confidentiality: "intern",
  });
}
function auftrag(id: string, norm = true) {
  return {
    vorlage: "quellaenderung",
    quellen: [id],
    ...(norm ? { normbekanntmachungen: "belege_vorbereiten" } : {}),
  };
}
async function einrichten(id: string, norm = true) {
  const r = await app.inject({
    method: "POST",
    url: "/api/me/klara/erinnerungen",
    headers: ich.kopf,
    payload: {
      vorgang: `norm-watch-${crypto.randomUUID()}`,
      titel: "Fiktiver bestellter Normwatch",
      aktion: "routine_bericht",
      zeitzone: "Europe/Berlin",
      routine: { wissenspflege: auftrag(id, norm) },
      zeitplan: {
        art: "serie",
        datum: "2026-10-20",
        uhrzeit: "09:00",
        wiederholung: { takt: "taeglich", intervall: 1, bis: "2026-10-23", anzahl: null },
      },
      verpasst: { regel: "nachholen", grenzeMinuten: 30 },
    },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().erinnerung;
}
const normen = async () =>
  (await app.inject({ url: "/api/me/klara/normereignisse", headers: ich.kopf })).json();
const notizen = async () =>
  (await app.inject({ url: "/api/me/klara/notizen", headers: ich.kopf })).json().notizen;
const faellig = (tag = "20") => vi.setSystemTime(new Date(`2026-10-${tag}T07:01:00Z`));

describe("AW21 · ausdrücklich bestellter Normbeleg-Zusatz am vorhandenen D-Quellenwatch", () => {
  it("erteilt weder aus Quelleninhalt noch anderen Vorlagen oder unklarer Zusatzwirkung einen Normwatchauftrag", () => {
    for (const vorlage of ["offene_pruefungen", "aktualitaet"])
      expect(() => pflegeAus({ ...auftrag("ko1"), vorlage })).toThrow();
    for (const normbekanntmachungen of [true, "volltext_lesen", "fachlich_annehmen", null])
      expect(() => pflegeAus({ ...auftrag("ko1"), normbekanntmachungen })).toThrow();
    expect(pflegeAus(auftrag("ko1"))).toMatchObject({
      normbekanntmachungen: "belege_vorbereiten",
      ausloeser: "quellstand_polling",
    });
  });
  it("Vorschau und Aktivierung sind ohne Normwirkung; der ausdrücklich bestellte erste Poll erfasst nur Ankündigung ohne Bericht oder Fachannahme", async () => {
    const q = await wissen();
    const v = await app.inject({
      method: "POST",
      url: "/api/me/klara/erinnerungen/wissenspflege/vorschau",
      headers: ich.kopf,
      payload: { wissenspflege: auftrag(q.id) },
    });
    expect(v.statusCode, v.body).toBe(200);
    expect(v.json().wirkung).toBe("keine");
    expect((await normen()).normen).toEqual([]);
    const e = await einrichten(q.id);
    expect(e.routine.wissenspflege.normbekanntmachungen).toBe("belege_vorbereiten");
    expect((await normen()).normen).toEqual([]);
    faellig();
    await lauf();
    const n = (await normen()).normen;
    expect(n).toHaveLength(1);
    expect(n[0].ereignisse).toHaveLength(1);
    expect(n[0].ereignisse[0].art).toBe("angekuendigt");
    expect(n[0].annahmen).toEqual([]);
    expect(await notizen()).toEqual([]);
    const gelesen = await app.inject({
      url: `/api/me/klara/erinnerungen/${e.id}`,
      headers: ich.kopf,
    });
    expect(gelesen.json().erinnerung.laeufe[0].ergebnis.wissenspflege).toMatchObject({
      stand: "ohne_quellaenderung",
      normbekanntmachungen: { stand: "belege_vorbereitet" },
    });
  });
  it("nur zusätzliche ausdrückliche Bestellung erfasst Normbelege; gewöhnlicher Quellenwatch bleibt bei seinen vorbereiteten Unterlagen", async () => {
    const q = await wissen();
    await einrichten(q.id, false);
    await services.ko.revise(q.id, { statement: TEXT + " Aktualisierter Quellstand." }, kontoId);
    faellig();
    await lauf();
    expect((await normen()).normen).toEqual([]);
    expect(await notizen()).toHaveLength(1);
  });
  it("spätere Veröffentlichung ergänzt dieselbe Geschichte und erhält den bewusst gebundenen bestehenden G-Prüfauftrag samt geltender Anleitung", async () => {
    const q = await wissen();
    const anleitung = await wissen("Fiktive geltende Anleitung bleibt unverändert.");
    await services.lifecycle.couple("Norm N-17", anleitung.id, kontoId);
    const vorher = await services.ko.get(anleitung.id);
    await einrichten(q.id);
    faellig();
    await lauf();
    const n = (await normen()).normen[0];
    const e = n.ereignisse[0];
    const p = await echterNotizauftrag(app, ich.kopf, TEXT);
    const b = await app.inject({
      method: "POST",
      url: `/api/me/klara/normereignisse/${n.id}/ereignisse/${e.id}/pruefauftrag`,
      headers: ich.kopf,
      payload: {
        fassung: (await normen()).fassung,
        gespraechId: p.gespraechId,
        auftragId: p.auftragId,
        bestaetigt: true,
      },
    });
    expect(b.statusCode, b.body).toBe(200);
    const ref = b.json().pruefauftrag;
    const aus = await app.inject({
      method: "POST",
      url: `${p.pfad}/${p.auftragId}/schritte/${ref.schluessel}/ausfuehrung`,
      headers: ich.kopf,
      payload: { nr: 1, auftragFassung: 1 },
    });
    expect(aus.statusCode, aus.body).toBe(200);
    const taskId = aus.json().schritt.ergebnis.id;
    await services.ko.revise(
      q.id,
      { statement: TEXT.replace("; Geltung", "; Veröffentlichung am 2026-11-02; Geltung") },
      kontoId,
    );
    faellig("21");
    await lauf();
    const nach = (await normen()).normen;
    expect(nach).toHaveLength(1);
    expect(nach[0].id).toBe(n.id);
    expect(nach[0].ereignisse.map((e: { art: string }) => e.art)).toEqual([
      "angekuendigt",
      "veroeffentlicht",
    ]);
    expect(nach[0].ereignisse[0].pruefauftrag).toEqual(ref);
    expect(nach[0].annahmen).toEqual([]);
    await lauf();
    faellig("22");
    await lauf();
    const tasks = (await app.inject({ url: "/api/me/klara/aufgaben", headers: ich.kopf })).json()
      .aufgaben;
    expect(tasks.map((a: { id: string }) => a.id)).toEqual([taskId]);
    expect(await services.ko.get(anleitung.id)).toEqual(vorher);
    expect((await notizen()).filter((n: { id: string }) => n.id !== p.notiz.id)).toHaveLength(1);
  });
  it("heutiger Quellenentzug verhindert auch Normvorbereitung und pausiert denselben Watchauftrag", async () => {
    const q = await wissen();
    const e = await einrichten(q.id);
    await services.ko.setQuellrechte(q.id, { stufe: "intern", leser: [] }, kontoId);
    faellig();
    await lauf();
    expect((await normen()).normen).toEqual([]);
    expect(await services.klaraFristen.hole(kontoId)).toBeNull();
    expect(
      (await services.klaraErinnerungen.erinnerungen.hole(kontoId, e.id))?.erinnerung.status,
    ).toBe("pausiert");
    expect(await notizen()).toEqual([]);
  });
  it("Pause vor dem vorhandenen Poll erlaubt keine neue Normwirkung", async () => {
    const q = await wissen();
    const e = await einrichten(q.id);
    const r = await app.inject({
      method: "POST",
      url: `/api/me/klara/erinnerungen/${e.id}/status`,
      headers: ich.kopf,
      payload: { fassung: e.fassung, aktion: "pausieren" },
    });
    expect(r.statusCode, r.body).toBe(200);
    faellig();
    await lauf();
    expect(await services.klaraFristen.hole(kontoId)).toBeNull();
    expect(await notizen()).toEqual([]);
  });
});
