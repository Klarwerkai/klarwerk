import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { FRISTEN_PRUEFSTAND } from "../../services/app/src/klara-fristen";
import { KlaraFristenQuellen } from "../../services/app/src/klara-fristen-quellen";
import { KlaraNormereignisDienst } from "../../services/app/src/klara-normereignisse-dienst";
import { type Konto, neuesKonto } from "../klara-quellen-nutzerweg/kette";
import { echterNotizauftrag } from "./pruefauftrag-vorrichtung";

let app: FastifyInstance;
let services: ReturnType<typeof buildServices>;
let ich: Konto;
let admin: Konto;
let kontoId: string;
let dienst: KlaraNormereignisDienst;
let quellen: KlaraFristenQuellen;
const BEKANNTMACHUNG = "Norm N-17 v2: Ankündigung am 2026-11-01; Geltung: Werk A.";
const lauf = { gilt: () => true, sql: () => ({ und: ["true"], params: [] }) };
beforeEach(async () => {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("KLARWERK_LOCAL_LLM_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  services = buildServices();
  app = buildApp(services, { klaraErinnerungen: () => 60_000 });
  await app.ready();
  admin = await neuesKonto(app, "norm-admin");
  ich = await kontoMitRolle("controller");
  kontoId = (await app.inject({ url: "/api/auth/me", headers: ich.kopf })).json().id;
  quellen = new KlaraFristenQuellen({
    auth: services.auth,
    ko: services.ko,
    notizen: services.klaraNotizen,
    gespraeche: services.klaraGespraeche,
    spaces: services.spaces,
  });
  dienst = neu();
});
afterEach(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});
function neu() {
  return new KlaraNormereignisDienst({
    aufgaben: services.klaraAufgaben,
    gespraeche: services.klaraGespraeche,
    repo: services.klaraFristen,
    quellen,
    ko: services.ko,
    belege: services.audit,
    auth: services.auth,
  });
}
function wissen(statement = BEKANNTMACHUNG, title = "Fiktive begrenzte Bekanntmachung") {
  return services.ko.create({
    title,
    statement,
    type: "technik",
    category: "Synthetische Normprüfung",
    author: kontoId,
    confidentiality: "intern",
  });
}
async function kontoMitRolle(role: "controller" | "viewer"): Promise<Konto> {
  const email = `norm-${role}-${crypto.randomUUID()}@klarwerk.test`;
  const password = "Fiktiver-Normzugang-2026!";
  const r = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin.kopf,
    payload: { name: "Fiktive Normperson", email, password, role },
  });
  expect(r.statusCode, r.body).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(login.statusCode, login.body).toBe(200);
  const token: string = login.json().token;
  const konto: Konto = { email, token, kopf: { authorization: `Bearer ${token}` } };
  const me = await app.inject({ url: "/api/auth/me", headers: konto.kopf });
  expect(me.json().role).toBe(role);
  return konto;
}
async function fachlicheFassungen() {
  const anleitung = await wissen("Fiktive unveränderte Regel der v1-Anleitung.", "Anleitung A-4");
  await services.lifecycle.couple("Norm N-17", anleitung.id, kontoId);
  const freigeben = async () => {
    const r = await app.inject({
      method: "PUT",
      url: `/api/kos/${anleitung.id}`,
      headers: admin.kopf,
      payload: { action: "admin-validate", duplicateAcknowledged: true },
    });
    expect(r.statusCode, r.body).toBe(200);
    const ko = await services.ko.get(anleitung.id);
    if (!ko) throw new Error("Anleitung fehlt");
    return ko;
  };
  const bisher = await freigeben();
  await services.ko.revise(
    anleitung.id,
    { statement: "Fiktive ausdrücklich neu geprüfte Regel der v2-Anleitung." },
    kontoId,
  );
  const nachfolger = await freigeben();
  return { bisher, nachfolger };
}
async function annahmeEingabe(
  bisher: { id: string; version: number },
  nachfolger: { id: string; version: number },
) {
  return {
    fassung: (await services.klaraFristen.hole(kontoId))?.fassung,
    bestaetigt: true,
    bisher: { koId: bisher.id, fassung: bisher.version },
    nachfolger: { koId: nachfolger.id, fassung: nachfolger.version },
    geltung: "Werk A",
    begruendung: "Fiktive bewusste Fachannahme für diesen Anwendungsfall.",
  };
}

const notizauftrag = (inhalt = BEKANNTMACHUNG, konto = ich) =>
  echterNotizauftrag(app, konto.kopf, inhalt);

describe("AW21 · tatsächliche bestehende Quellen-/Fristenablage", () => {
  it("Norm/Geltung-Präfixe v20 und Werk AB sind kein v2/Werk-A-Originalplan; derselbe richtige tatsächliche Plan bleibt bindbar", async () => {
    const q = await wissen();
    await dienst.beobachten(kontoId, [q.id], lauf);
    const n = (await dienst.sicht(kontoId))[0];
    const e = n?.ereignisse[0];
    if (!n || !e) throw new Error("Ereignis fehlt");
    const url = `/api/me/klara/normereignisse/${n.id}/ereignisse/${e.id}/pruefauftrag`;
    const vor = await services.klaraFristen.hole(kontoId);
    for (const inhalt of [
      BEKANNTMACHUNG.replace("v2:", "v20:").replace("Werk A.", "Werk AB."),
      BEKANNTMACHUNG.replace("v2:", "v20:"),
      BEKANNTMACHUNG.replace("Werk A.", "Werk AB."),
    ]) {
      const falsch = await notizauftrag(inhalt);
      const angebot = await app.inject({ url, headers: ich.kopf });
      expect(angebot.statusCode, angebot.body).toBe(200);
      expect(angebot.json().auftraege).toEqual([]);
      const abgewiesen = await app.inject({
        method: "POST",
        url,
        headers: ich.kopf,
        payload: {
          fassung: vor?.fassung,
          gespraechId: falsch.gespraechId,
          auftragId: falsch.auftragId,
          bestaetigt: true,
        },
      });
      expect(abgewiesen.statusCode, abgewiesen.body).toBe(404);
      expect(await services.klaraFristen.hole(kontoId)).toEqual(vor);
    }
    const richtig = await notizauftrag();
    const angebot = await app.inject({ url, headers: ich.kopf });
    expect(angebot.statusCode, angebot.body).toBe(200);
    expect(angebot.json().auftraege).toHaveLength(1);
    expect(angebot.json().auftraege[0].auftragId).toBe(richtig.auftragId);
    const angenommen = await app.inject({
      method: "POST",
      url,
      headers: ich.kopf,
      payload: {
        fassung: vor?.fassung,
        gespraechId: richtig.gespraechId,
        auftragId: richtig.auftragId,
        bestaetigt: true,
      },
    });
    expect(angenommen.statusCode, angenommen.body).toBe(200);
    expect(angenommen.json().pruefauftrag).toMatchObject({
      gespraechId: richtig.gespraechId,
      auftragId: richtig.auftragId,
    });
    const original = await app.inject({ url, headers: ich.kopf });
    expect(original.json().auftraege).toHaveLength(1);
    expect(original.json().auftraege[0]).toMatchObject({
      auftragId: richtig.auftragId,
      quelleAktuell: true,
    });
  });
  it("bewusster vorhandener Originalnotizauftrag bleibt über Kopie/Reload dieselbe echte G-Aufgabe; Entfernen erzeugt keinen Ersatz", async () => {
    const q = await wissen();
    await dienst.beobachten(kontoId, [q.id], lauf);
    const n = (await dienst.sicht(kontoId))[0];
    const e = n?.ereignisse[0];
    if (!n || !e) throw new Error("Ereignis fehlt");
    const p = await notizauftrag();
    const url = `/api/me/klara/normereignisse/${n.id}/ereignisse/${e.id}/pruefauftrag`;
    const liste = await app.inject({ url, headers: ich.kopf });
    expect(liste.statusCode, liste.body).toBe(200);
    expect(liste.json().auftraege).toHaveLength(1);
    expect(
      (await app.inject({ url: "/api/me/klara/aufgaben", headers: ich.kopf })).json().aufgaben,
    ).toEqual([]);
    const payload = {
      fassung: (await services.klaraFristen.hole(kontoId))?.fassung,
      gespraechId: p.gespraechId,
      auftragId: p.auftragId,
      bestaetigt: true,
    };
    const bindung = await app.inject({ method: "POST", url, headers: ich.kopf, payload });
    expect(bindung.statusCode, bindung.body).toBe(200);
    expect(bindung.json().wiederholt).toBe(false);
    const ref = bindung.json().pruefauftrag;
    const ausUrl = `${p.pfad}/${p.auftragId}/schritte/${ref.schluessel}/ausfuehrung`;
    const aus = () =>
      app.inject({
        method: "POST",
        url: ausUrl,
        headers: ich.kopf,
        payload: { nr: 1, auftragFassung: 1 },
      });
    const getan = await aus();
    expect(getan.statusCode, getan.body).toBe(200);
    const taskId = getan.json().schritt.ergebnis.id;
    const task = await app.inject({ url: `/api/me/klara/aufgaben/${taskId}`, headers: ich.kopf });
    expect(task.json().aufgabe).toMatchObject({
      inhalt: BEKANNTMACHUNG,
      bezug: { art: "notiz", notizId: p.notiz.id },
    });
    const kopie = await wissen();
    await neu().beobachten(kontoId, [kopie.id], lauf);
    const lesung = await neu().pruefauftraege(kontoId, n.id, e.id);
    expect(lesung.gebunden).toEqual(ref);
    expect(lesung.auftraege[0]).toMatchObject({
      ergebnisVorhanden: true,
      schritt: { ergebnis: { id: taskId } },
    });
    expect((await aus()).json().wiederholt).toBe(true);
    expect((await dienst.verknuepfePruefauftrag(kontoId, n.id, e.id, payload)).wiederholt).toBe(
      true,
    );
    expect(
      (await app.inject({ url: "/api/me/klara/aufgaben", headers: ich.kopf })).json().aufgaben,
    ).toHaveLength(1);
    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/me/klara/aufgaben/${taskId}`,
      headers: ich.kopf,
    });
    expect(geloescht.statusCode, geloescht.body).toBe(200);
    expect(geloescht.json()).toEqual({ geloescht: 1 });
    expect((await neu().pruefauftraege(kontoId, n.id, e.id)).auftraege[0]?.ergebnisVorhanden).toBe(
      false,
    );
    expect((await aus()).json().schritt.ergebnis.id).toBe(taskId);
    expect(
      (await app.inject({ url: "/api/me/klara/aufgaben", headers: ich.kopf })).json().aufgaben,
    ).toEqual([]);
  });
  it("fremde oder unpassende Notizpläne und spätere Zweitbindung werden abgewiesen; Stop erhält die Referenz ohne Aufgabe", async () => {
    const q = await wissen();
    await dienst.beobachten(kontoId, [q.id], lauf);
    const n = (await dienst.sicht(kontoId))[0];
    const e = n?.ereignisse[0];
    if (!n || !e) throw new Error("Ereignis fehlt");
    const unpassend = await notizauftrag(BEKANNTMACHUNG.replace("N-17", "N-18"));
    const fremd = await notizauftrag(BEKANNTMACHUNG, await kontoMitRolle("controller"));
    for (const p of [unpassend, fremd])
      await expect(
        dienst.verknuepfePruefauftrag(kontoId, n.id, e.id, {
          fassung: (await services.klaraFristen.hole(kontoId))?.fassung,
          gespraechId: p.gespraechId,
          auftragId: p.auftragId,
          bestaetigt: true,
        }),
      ).rejects.toMatchObject({ status: 404 });
    const p = await notizauftrag();
    const r = await dienst.verknuepfePruefauftrag(kontoId, n.id, e.id, {
      fassung: (await services.klaraFristen.hole(kontoId))?.fassung,
      gespraechId: p.gespraechId,
      auftragId: p.auftragId,
      bestaetigt: true,
    });
    const stopp = await app.inject({
      method: "PUT",
      url: `${p.pfad}/${p.auftragId}/abbruch`,
      headers: ich.kopf,
      payload: {},
    });
    expect(stopp.statusCode, stopp.body).toBe(200);
    const getan = await app.inject({
      method: "POST",
      url: `${p.pfad}/${p.auftragId}/schritte/${r.pruefauftrag.schluessel}/ausfuehrung`,
      headers: ich.kopf,
      payload: { nr: 1, auftragFassung: 1 },
    });
    expect(getan.statusCode, getan.body).toBe(409);
    const zweiter = await notizauftrag();
    await expect(
      dienst.verknuepfePruefauftrag(kontoId, n.id, e.id, {
        fassung: (await services.klaraFristen.hole(kontoId))?.fassung,
        gespraechId: zweiter.gespraechId,
        auftragId: zweiter.auftragId,
        bestaetigt: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await neu().pruefauftraege(kontoId, n.id, e.id)).gebunden).toEqual(r.pruefauftrag);
    expect(
      (await app.inject({ url: "/api/me/klara/aufgaben", headers: ich.kopf })).json().aufgaben,
    ).toEqual([]);
  });
  it("Vorschau wirkt nicht; Normbeleg erhält die vorhandene Fristenregel und echte Frist, Wiederholung schreibt keine neue Fassung", async () => {
    const n = await app.inject({
      method: "POST",
      url: "/api/me/klara/notizen",
      headers: ich.kopf,
      payload: {
        vorgang: `norm-alt-${crypto.randomUUID()}`,
        weg: "geschrieben",
        titel: "Synthetische Lizenz",
        inhalt: "Lizenz L-17: Ablaufdatum 2027-04-30.",
        objektbezug: { pfad: "/kalender", seitenName: "Mein Kalender", objekt: "Fiktive Lizenz" },
      },
    });
    expect(n.statusCode, n.body).toBe(201);
    const konfig = await app.inject({
      method: "PUT",
      url: "/api/me/klara/fristen/regel",
      headers: ich.kopf,
      payload: {
        fassung: 0,
        regel: {
          aktiv: true,
          quellen: [{ art: "notiz", id: n.json().notiz.id }],
          arten: ["ablauf"],
          bereich: "persoenlich",
          zeitzone: "Europe/Berlin",
          aenderung: "aktualisieren",
          widerruf: "unzuverlaessig_ohne_vorlauf",
          wiederpruefung: "relevante_aenderung_klaeren",
          pruefstand: FRISTEN_PRUEFSTAND,
        },
      },
    });
    expect(konfig.statusCode, konfig.body).toBe(200);
    const alt = await services.klaraFristen.hole(kontoId);
    const q = await wissen();
    expect((await dienst.vorschau(kontoId, [q.id])).ereignisse).toHaveLength(1);
    expect(await services.klaraFristen.hole(kontoId)).toEqual(alt);
    const r = await dienst.beobachten(kontoId, [q.id], lauf);
    expect(r.ereignisse[0]?.ereignis.art).toBe("angekuendigt");
    const gespeichert = await services.klaraFristen.hole(kontoId);
    expect(gespeichert?.regel).toEqual(alt?.regel);
    expect(gespeichert?.fristen).toEqual(alt?.fristen);
    expect(gespeichert?.normereignisse).toHaveLength(1);
    await neu().beobachten(kontoId, [q.id], lauf);
    expect(await services.klaraFristen.hole(kontoId)).toEqual(gespeichert);
  });
  it("unabhängige Ausführer und tatsächliche Quellkopie erzeugen nur eine Geschichte und Prüfkennung", async () => {
    const a = await wissen();
    const kopie = await wissen();
    await Promise.all([
      dienst.beobachten(kontoId, [a.id], lauf),
      neu().beobachten(kontoId, [a.id], lauf),
    ]);
    const vorher = (await services.klaraFristen.hole(kontoId))?.normereignisse;
    await dienst.beobachten(kontoId, [kopie.id], lauf);
    const nachher = (await services.klaraFristen.hole(kontoId))?.normereignisse;
    expect(nachher).toHaveLength(1);
    expect(nachher?.[0]?.ereignisse).toHaveLength(1);
    expect(nachher?.[0]?.ereignisse[0]?.belege).toHaveLength(2);
    expect(nachher?.[0]?.ereignisse[0]?.pruefVorgang).toBe(
      vorher?.[0]?.ereignisse[0]?.pruefVorgang,
    );
  });
  it("Betroffenheit folgt nur sichtbarer gespeicherter Normzuordnung, nie ähnlichem Titel oder der Bekanntmachung selbst", async () => {
    const q = await wissen();
    const anleitung = await wissen(
      "Geltende fiktive v1-Anleitung bleibt unverändert.",
      "Anleitung A-4 v1",
    );
    const nurAehnlich = await wissen(
      "Fiktiver unabhängiger Inhalt.",
      "Norm N-17 v2 ähnlich benannt",
    );
    const privat = await wissen("Geheime synthetische Abhängigkeit.", "Unsichtbare Anleitung");
    for (const ko of [q, anleitung, privat])
      await services.lifecycle.couple("Norm N-17", ko.id, kontoId);
    await services.ko.setQuellrechte(privat.id, { stufe: "intern", leser: [] }, kontoId);
    const vorher = await services.ko.get(anleitung.id);
    const r = await dienst.beobachten(kontoId, [q.id], lauf);
    expect(r.ereignisse[0]?.betroffen.map((b) => b.koId)).toEqual([anleitung.id]);
    expect(JSON.stringify(r)).not.toContain(nurAehnlich.id);
    expect(JSON.stringify(r)).not.toContain(privat.id);
    expect(await services.ko.get(anleitung.id)).toEqual(vorher);
  });
  it("historische Auszüge verlassen weder den alten Fristen-DTO noch nach Rechteentzug die Normsicht", async () => {
    const q = await wissen();
    await dienst.beobachten(kontoId, [q.id], lauf);
    expect(await dienst.sicht(kontoId)).toHaveLength(1);
    const fristen = await app.inject({ url: "/api/me/klara/fristen", headers: ich.kopf });
    expect(fristen.statusCode, fristen.body).toBe(200);
    expect(fristen.json()).not.toHaveProperty("normereignisse");
    const alt = await services.klaraFristen.hole(kontoId);
    await services.ko.setQuellrechte(q.id, { stufe: "intern", leser: [] }, kontoId);
    expect(await dienst.sicht(kontoId)).toEqual([]);
    await expect(dienst.beobachten(kontoId, [q.id], lauf)).rejects.toMatchObject({ status: 404 });
    expect(await services.klaraFristen.hole(kontoId)).toEqual(alt);
  });
  it("Vorschau und Erfassungsantwort einer sichtbaren Kopie verraten keinen früheren inzwischen entzogenen Beleg", async () => {
    const a = await wissen();
    const b = await wissen(
      BEKANNTMACHUNG.replace("; Geltung", "; PRIVATER_BEGLEITWORTLAUT; Geltung"),
    );
    await dienst.beobachten(kontoId, [a.id, b.id], lauf);
    await services.ko.setQuellrechte(b.id, { stufe: "intern", leser: [] }, kontoId);
    const v = await dienst.vorschau(kontoId, [a.id]);
    expect(JSON.stringify(v)).not.toContain("PRIVATER_BEGLEITWORTLAUT");
    expect(JSON.stringify(v)).not.toContain(b.id);
    expect(v.ereignisse).toEqual([]);
    expect(v.ungeprueft).toHaveLength(1);
    const r = await app.inject({
      method: "POST",
      url: "/api/me/klara/normereignisse/erfassen",
      headers: ich.kopf,
      payload: { quellen: [a.id], bekanntmachungErlaubt: true },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.body).not.toContain("PRIVATER_BEGLEITWORTLAUT");
    expect(r.body).not.toContain(b.id);
    expect(r.json().ungeprueft).toHaveLength(1);
  });
  it("ein inzwischen gestoppter Auftrag schreibt keinen Normbeleg", async () => {
    const q = await wissen();
    await expect(
      dienst.beobachten(kontoId, [q.id], { ...lauf, gilt: () => false }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await services.klaraFristen.hole(kontoId)).toBeNull();
  });
  it("eine geänderte Quelle zieht den früheren Beleg sichtbar zurück und ersetzt keine v1-Anleitung", async () => {
    const q = await wissen();
    await dienst.beobachten(kontoId, [q.id], lauf);
    await services.ko.revise(
      q.id,
      { statement: "Keine aktuelle Normbekanntmachung in dieser Quelle." },
      kontoId,
    );
    const vorGet = await services.klaraFristen.hole(kontoId);
    expect((await dienst.sicht(kontoId))[0]?.ereignisse[0]?.belege[0]?.aktuell).toBe(false);
    expect(await services.klaraFristen.hole(kontoId)).toEqual(vorGet);
    await dienst.beobachten(kontoId, [q.id], lauf);
    expect(
      (await services.klaraFristen.hole(kontoId))?.normereignisse?.[0]?.ereignisse[0]?.belege[0]
        ?.aktuell,
    ).toBe(false);
  });
  it("fachliche Annahme bindet tatsächlichen Freigabebeleg und konkrete frühere/neue Fassung desselben Originals; Wiederholung ist Readback", async () => {
    const q = await wissen();
    await dienst.beobachten(kontoId, [q.id], lauf);
    const { bisher, nachfolger } = await fachlicheFassungen();
    const n = (await dienst.sicht(kontoId))[0];
    if (!n) throw new Error("Normgeschichte fehlt");
    expect(n.annahmen).toEqual([]);
    const eingabe = await annahmeEingabe(bisher, nachfolger);
    const vor = await services.ko.get(nachfolger.id);
    const optionen = await app.inject({
      url: `/api/me/klara/normereignisse/${n.id}/fachoptionen`,
      headers: ich.kopf,
    });
    expect(optionen.statusCode, optionen.body).toBe(200);
    expect(
      optionen
        .json()
        .fassungen.map((v: { fassung: number; aktuell: boolean }) => [v.fassung, v.aktuell]),
    ).toEqual([
      [bisher.version, false],
      [nachfolger.version, true],
    ]);
    const entscheidung = await app.inject({
      method: "POST",
      url: `/api/me/klara/normereignisse/${n.id}/annahme`,
      headers: ich.kopf,
      payload: eingabe,
    });
    expect(entscheidung.statusCode, entscheidung.body).toBe(200);
    const r = entscheidung.json();
    expect(r.wiederholt).toBe(false);
    expect(r.annahme.entschiedenVon).toBe(kontoId);
    expect(r.annahme.fachfreigabe.nachfolger).toMatchObject({ koVersion: nachfolger.version });
    const audit = await services.audit.list({ target: nachfolger.id });
    expect(
      audit.some(
        (b) =>
          b.seq === r.annahme.fachfreigabe.nachfolger.auditSeq &&
          b.hash === r.annahme.fachfreigabe.nachfolger.auditHash &&
          b.action === "ko.admin-validated",
      ),
    ).toBe(true);
    expect(await services.ko.get(nachfolger.id)).toEqual(vor);
    expect(await dienst.nehmeAbloesungAn(kontoId, n.id, eingabe)).toEqual({
      fassung: r.fassung,
      annahme: r.annahme,
      wiederholt: true,
    });
    expect((await dienst.sicht(kontoId))[0]?.annahmen).toEqual([r.annahme]);
    expect(
      await neu().nehmeAbloesungAn(kontoId, n.id, { ...eingabe, geltung: "  Werk   A  " }),
    ).toEqual({
      fassung: r.fassung,
      annahme: r.annahme,
      wiederholt: true,
    });
    await services.ko.revise(
      nachfolger.id,
      { statement: "Fiktive spätere v3, noch ohne Annahme." },
      kontoId,
    );
    for (const original of [bisher, nachfolger]) {
      const fassung = await app.inject({
        url: `/api/me/klara/normereignisse/${n.id}/fassungen/${original.id}/${original.version}`,
        headers: ich.kopf,
      });
      expect(fassung.statusCode, fassung.body).toBe(200);
      expect(fassung.json()).toMatchObject({
        koId: original.id,
        fassung: original.version,
        aussage: original.statement,
      });
      expect(fassung.json().aussage).not.toContain("spätere v3");
    }
    await services.ko.setQuellrechte(nachfolger.id, { stufe: "intern", leser: [] }, kontoId);
    expect((await dienst.stand(kontoId)).normen[0]?.annahmeUngeprueft).toBe(true);
    expect(
      (
        await app.inject({
          url: `/api/me/klara/normereignisse/${n.id}/fassungen/${nachfolger.id}/${nachfolger.version}`,
          headers: ich.kopf,
        })
      ).statusCode,
    ).toBe(404);
  });
  it("ein aktuelles tatsächlich lesendes Konto ohne ko.validate kann keine Fachannahme erzeugen", async () => {
    const leser = await kontoMitRolle("viewer");
    const me = await app.inject({
      url: "/api/auth/me",
      headers: leser.kopf,
    });
    expect(me.json().role).toBe("viewer");
    await expect(dienst.nehmeAbloesungAn(me.json().id, "keine-norm", {})).rejects.toMatchObject({
      status: 403,
    });
  });
  it("Datum oder Veröffentlichung ist keine Annahme; erfundene Entscheidende und ein veralteter Nachfolger werden abgewiesen", async () => {
    const q = await wissen(
      "Norm N-17 v2: Veröffentlichung am 2026-01-01; Inkrafttreten am 2026-02-01; Geltung: Werk A.",
    );
    await dienst.beobachten(kontoId, [q.id], lauf);
    const { bisher, nachfolger } = await fachlicheFassungen();
    const n = (await dienst.sicht(kontoId))[0];
    if (!n) throw new Error("Normgeschichte fehlt");
    expect(n.annahmen).toEqual([]);
    const eingabe = await annahmeEingabe(bisher, nachfolger);
    await expect(
      dienst.nehmeAbloesungAn(kontoId, n.id, {
        ...eingabe,
        entschiedenVon: "andere-person",
        entschiedenAm: "2026-01-01",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await services.ko.revise(
      nachfolger.id,
      { statement: "Inzwischen weiter geänderte, unbestätigte Regel." },
      kontoId,
    );
    await expect(dienst.nehmeAbloesungAn(kontoId, n.id, eingabe)).rejects.toMatchObject({
      status: 409,
    });
    expect((await dienst.sicht(kontoId))[0]?.annahmen).toEqual([]);
  });
  it("widersprüchliche aktuelle Termine bleiben klärungsbedürftig und werden durch eine Annahme nicht still aufgelöst", async () => {
    const a = await wissen("Norm N-17 v2: Inkrafttreten am 2027-01-01; Geltung: Werk A.");
    const b = await wissen("Norm N-17 v2: Inkrafttreten am 2027-02-01; Geltung: Werk A.");
    await dienst.beobachten(kontoId, [a.id, b.id], lauf);
    const { bisher, nachfolger } = await fachlicheFassungen();
    const n = (await dienst.sicht(kontoId))[0];
    if (!n) throw new Error("Normgeschichte fehlt");
    await expect(
      dienst.nehmeAbloesungAn(kontoId, n.id, await annahmeEingabe(bisher, nachfolger)),
    ).rejects.toMatchObject({ status: 409 });
    expect((await dienst.sicht(kontoId))[0]?.annahmen).toEqual([]);
  });
  it("eine unverarbeitete widersprechende Quellfassung sperrt die Fachannahme auch neben einer unveränderten Kopie", async () => {
    const a = await wissen();
    const kopie = await wissen();
    await dienst.beobachten(kontoId, [a.id, kopie.id], lauf);
    const { bisher, nachfolger } = await fachlicheFassungen();
    const n = (await dienst.sicht(kontoId))[0];
    if (!n) throw new Error("Normgeschichte fehlt");
    await services.ko.revise(
      a.id,
      {
        statement: BEKANNTMACHUNG.replace("2026-11-01", "2026-12-01"),
      },
      kontoId,
    );
    await expect(
      dienst.nehmeAbloesungAn(kontoId, n.id, await annahmeEingabe(bisher, nachfolger)),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("noch nicht in den Ereignisbelegen"),
    });
    await dienst.beobachten(kontoId, [a.id, kopie.id], lauf);
    const danach = await dienst.stand(kontoId);
    expect(danach.normen[0]?.widerspruch).toBe(true);
    expect(danach.normen[0]?.ereignisse.map((e) => e.datum).sort()).toEqual([
      "2026-11-01",
      "2026-12-01",
    ]);
    expect(danach.normen[0]?.annahmen).toEqual([]);
  });
  it("tatsächlicher persönlicher HTTP-Anschluss: Vorschau wirkungslos, begrenzte Quelle bewusst erfassen, fremde Geschichte unsichtbar", async () => {
    const q = await wissen();
    const url = "/api/me/klara/normereignisse";
    expect((await app.inject({ url })).statusCode).toBe(401);
    for (const payload of [
      { quellen: [q.id], bekanntmachungErlaubt: false },
      { quellen: [q.id], bekanntmachungErlaubt: true, volltextUrl: "https://example.invalid/norm" },
    ])
      expect(
        (await app.inject({ method: "POST", url: `${url}/vorschau`, headers: ich.kopf, payload }))
          .statusCode,
      ).toBe(400);
    const payload = { quellen: [q.id], bekanntmachungErlaubt: true };
    const v = await app.inject({
      method: "POST",
      url: `${url}/vorschau`,
      headers: ich.kopf,
      payload,
    });
    expect(v.statusCode, v.body).toBe(200);
    expect(v.json().wirkung).toBe("keine");
    expect(v.json().ereignisse).toHaveLength(1);
    expect(await services.klaraFristen.hole(kontoId)).toBeNull();
    const s = await app.inject({
      method: "POST",
      url: `${url}/erfassen`,
      headers: ich.kopf,
      payload,
    });
    expect(s.statusCode, s.body).toBe(200);
    expect(s.json().normen).toHaveLength(1);
    expect(s.json().fachannahmeErlaubt).toBe(true);
    const anderer = await kontoMitRolle("controller");
    const fremd = await app.inject({ url, headers: anderer.kopf });
    expect(fremd.json().normen).toEqual([]);
    expect(
      (
        await app.inject({
          url: `${url}/${s.json().normen[0].id}/fachoptionen`,
          headers: anderer.kopf,
        })
      ).statusCode,
    ).toBe(404);
    const nurLesend = await kontoMitRolle("viewer");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${url}/${s.json().normen[0].id}/annahme`,
          headers: nurLesend.kopf,
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
  });
});

describe("AW21 · ausdrückliche fachliche Konfliktklärung", () => {
  async function konflikt() {
    const a = await wissen("Norm N-17 v2: Inkrafttreten am 2027-01-01; Geltung: Werk A.");
    const b = await wissen("Norm N-17 v2: Inkrafttreten am 2027-02-01; Geltung: Werk B.");
    await dienst.beobachten(kontoId, [a.id, b.id], lauf);
    const n = (await dienst.sicht(kontoId))[0];
    const e = n?.ereignisse.find((e) => e.datum === "2027-01-01");
    if (!n || !e) throw new Error("Konfliktfixture fehlt");
    const eingabe = {
      fassung: (await dienst.stand(kontoId)).fassung,
      auswahl: [{ art: e.art, ereignisId: e.id }],
      begruendung:
        "Beide Originale geprüft: Werk A ist der tatsächliche Anwendungsbereich dieser Entscheidung.",
      bestaetigt: true,
    };
    return { a, b, n, e, eingabe, url: `/api/me/klara/normereignisse/${n.id}/klaerung` };
  }
  it("befugte HTTP-Auswahl erhält beide Originale und echte Person/Zeit; Fachannahme bleibt gesondert an diese Klärung gebunden", async () => {
    const f = await konflikt();
    const { bisher, nachfolger } = await fachlicheFassungen();
    const anleitung = await services.ko.get(nachfolger.id);
    const vor = (await dienst.stand(kontoId)).normen[0];
    expect(vor?.widerspruch).toBe(true);
    const r = await app.inject({
      method: "POST",
      url: f.url,
      headers: ich.kopf,
      payload: f.eingabe,
    });
    expect(r.statusCode, r.body).toBe(200);
    const k = r.json().klaerung;
    expect(k).toMatchObject({
      auswahl: f.eingabe.auswahl,
      entschiedenVon: kontoId,
      entschiedenName: "Fiktive Normperson",
    });
    expect(Number.isFinite(Date.parse(k.entschiedenAm))).toBe(true);
    expect(k.belegstand).toEqual(
      f.n.ereignisse.map((e) => ({
        ereignisId: e.id,
        aktuell: e.belege.filter((b) => b.aktuell).map((b) => b.id),
      })),
    );
    const stand = await dienst.stand(kontoId);
    expect(stand.normen[0]).toMatchObject({
      widerspruch: false,
      konfliktarten: ["inkrafttreten"],
      klaerungAktuell: k.id,
      annahmen: [],
    });
    expect(stand.normen[0]?.ereignisse).toEqual(vor?.ereignisse);
    expect(await services.ko.get(nachfolger.id)).toEqual(anleitung);
    const wieder = await app.inject({
      method: "POST",
      url: f.url,
      headers: ich.kopf,
      payload: f.eingabe,
    });
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect(wieder.json()).toEqual({ ...r.json(), wiederholt: true });
    expect(
      (await services.audit.list({ target: f.n.id })).filter(
        (a) => a.action === "klara.normereignisse.konflikt_geklaert",
      ),
    ).toHaveLength(1);
    const annahme = await annahmeEingabe(bisher, nachfolger);
    await expect(
      dienst.nehmeAbloesungAn(kontoId, f.n.id, { ...annahme, geltung: "Werk B" }),
    ).rejects.toMatchObject({ status: 409 });
    const angenommen = await dienst.nehmeAbloesungAn(kontoId, f.n.id, annahme);
    expect(angenommen.annahme.klaerungId).toBe(k.id);
    expect(angenommen.annahme.fachfreigabe.nachfolger.koVersion).toBe(nachfolger.version);
  });
  it("Kopie bleibt derselbe geklärte Sachstand; neue Gegenangabe öffnet erneut und früherer Entscheid wird nicht still wieder aktiviert", async () => {
    const f = await konflikt();
    const k1 = await dienst.klaereKonflikt(kontoId, f.n.id, f.eingabe);
    const kopie = await wissen(f.a.statement);
    await dienst.beobachten(kontoId, [kopie.id], lauf);
    expect((await dienst.stand(kontoId)).normen[0]?.klaerungAktuell).toBe(k1.klaerung.id);
    const neu = await wissen("Norm N-17 v2: Inkrafttreten am 2027-03-01; Geltung: Werk C.");
    await dienst.beobachten(kontoId, [neu.id], lauf);
    expect((await dienst.stand(kontoId)).normen[0]).toMatchObject({
      widerspruch: true,
      klaerungAktuell: null,
    });
    await expect(dienst.klaereKonflikt(kontoId, f.n.id, f.eingabe)).rejects.toMatchObject({
      status: 409,
    });
    const k2 = await dienst.klaereKonflikt(kontoId, f.n.id, {
      ...f.eingabe,
      fassung: (await dienst.stand(kontoId)).fassung,
    });
    expect(k2.klaerung.id).not.toBe(k1.klaerung.id);
    const zweites = f.n.ereignisse.find((e) => e.datum === "2027-02-01");
    if (!zweites) throw new Error("Zweiter Beleg fehlt");
    await dienst.klaereKonflikt(kontoId, f.n.id, {
      ...f.eingabe,
      fassung: k2.fassung,
      auswahl: [{ art: zweites.art, ereignisId: zweites.id }],
    });
    const k4 = await dienst.klaereKonflikt(kontoId, f.n.id, {
      ...f.eingabe,
      fassung: (await dienst.stand(kontoId)).fassung,
    });
    expect(k4.wiederholt).toBe(false);
    expect(k4.klaerung.id).not.toBe(k2.klaerung.id);
    expect((await dienst.stand(kontoId)).normen[0]?.klaerungen).toHaveLength(4);
  });
  it("keine erfundenen Daten, Identitäten, unvollständigen Bestätigungen oder fremden Ereignisse im Fachweg", async () => {
    const f = await konflikt();
    const vorher = await services.klaraFristen.hole(kontoId);
    for (const payload of [
      { ...f.eingabe, entschiedenVon: "erfundene-person" },
      { ...f.eingabe, entschiedenAm: "2020-01-01" },
      { ...f.eingabe, bestaetigt: false },
      { ...f.eingabe, begruendung: " " },
      { ...f.eingabe, auswahl: [{ ...f.eingabe.auswahl[0], datum: "2027-01-01" }] },
    ]) {
      const r = await app.inject({ method: "POST", url: f.url, headers: ich.kopf, payload });
      expect(r.statusCode, r.body).toBe(400);
    }
    for (const auswahl of [
      [],
      [...f.eingabe.auswahl, ...f.eingabe.auswahl],
      [{ art: "veroeffentlicht", ereignisId: f.e.id }],
      [{ art: f.e.art, ereignisId: `ne-${"a".repeat(64)}` }],
    ]) {
      const r = await app.inject({
        method: "POST",
        url: f.url,
        headers: ich.kopf,
        payload: { ...f.eingabe, auswahl },
      });
      expect([400, 409]).toContain(r.statusCode);
    }
    expect(await services.klaraFristen.hole(kontoId)).toEqual(vorher);
  });
  it("heutige Fachrechte, eigene Geschichte und unverarbeitete neue Quellfassung bleiben bindend", async () => {
    const f = await konflikt();
    const viewer = await kontoMitRolle("viewer");
    expect(
      (await app.inject({ method: "POST", url: f.url, headers: viewer.kopf, payload: f.eingabe }))
        .statusCode,
    ).toBe(403);
    const fremd = await kontoMitRolle("controller");
    expect(
      (await app.inject({ method: "POST", url: f.url, headers: fremd.kopf, payload: f.eingabe }))
        .statusCode,
    ).toBe(404);
    await services.ko.revise(
      f.b.id,
      { statement: f.b.statement.replace("2027-02-01", "2027-04-01") },
      kontoId,
    );
    await expect(dienst.klaereKonflikt(kontoId, f.n.id, f.eingabe)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("noch nicht in den Ereignisbelegen"),
    });
    expect((await dienst.sicht(kontoId))[0]?.klaerungen).toBeUndefined();
    await services.ko.setQuellrechte(f.b.id, { stufe: "intern", leser: [] }, kontoId);
    expect(
      (await app.inject({ method: "POST", url: f.url, headers: ich.kopf, payload: f.eingabe }))
        .statusCode,
    ).toBe(404);
  });
  it("mehrdeutiger oder fehlender Termin kann nicht allein durch freie Fachwahl erfunden werden", async () => {
    const q = await wissen(
      "Norm N-17 v2: Inkrafttreten am 2027-01-01 oder 2027-02-01; Geltung: Werk A.",
    );
    await dienst.beobachten(kontoId, [q.id], lauf);
    const n = (await dienst.stand(kontoId)).normen[0];
    const e = n?.ereignisse[0];
    if (!n || !e) throw new Error("Mehrdeutiger Beleg fehlt");
    await expect(
      dienst.klaereKonflikt(kontoId, n.id, {
        fassung: (await dienst.stand(kontoId)).fassung,
        auswahl: [{ art: e.art, ereignisId: e.id }],
        begruendung: "Ich wähle ohne neuen Beleg ein Datum.",
        bestaetigt: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await dienst.stand(kontoId)).normen[0]).toMatchObject({
      widerspruch: true,
      klaerungAktuell: null,
      annahmen: [],
    });
  });
});
