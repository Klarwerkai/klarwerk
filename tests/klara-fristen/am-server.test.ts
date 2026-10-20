import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import { FRISTEN_PRUEFSTAND } from "../../services/app/src/klara-fristen";
import { type Aufbau, type Konto, appAufbauen, neuesKonto } from "../klara-quellen-nutzerweg/kette";

let aufbau: Aufbau;
let services: ReturnType<typeof buildServices>;
let ich: Konto;
beforeEach(async () => {
  aufbau = await appAufbauen(true, () => {
    services = buildServices();
    return services;
  });
  ich = await neuesKonto(aufbau.app, "fristen", aufbau.admin);
});
afterEach(async () => {
  await aufbau.app.close();
});

const BEZUG = {
  pfad: "/kalender",
  seitenName: "Mein Kalender",
  objekt: "Synthetische Fristenbelege",
};
async function notiz(inhalt: string, konto = ich) {
  const r = await aufbau.app.inject({
    method: "POST",
    url: "/api/me/klara/notizen",
    headers: konto.kopf,
    payload: {
      vorgang: `frist-${crypto.randomUUID()}`,
      weg: "geschrieben",
      titel: "Synthetische Belege",
      inhalt,
      objektbezug: BEZUG,
    },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().notiz;
}
function regel(quellen: { art: string; id: string }[]) {
  return {
    aktiv: true,
    quellen,
    arten: ["ablauf", "erneuerung"],
    bereich: "persoenlich",
    zeitzone: "Europe/Berlin",
    aenderung: "aktualisieren",
    widerruf: "unzuverlaessig_ohne_vorlauf",
    wiederpruefung: "relevante_aenderung_klaeren",
    pruefstand: FRISTEN_PRUEFSTAND,
  };
}
function api(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url = "",
  payload?: Record<string, unknown>,
  konto = ich,
) {
  return aufbau.app.inject({
    method,
    url: `/api/me/klara/fristen${url}`,
    headers: konto.kopf,
    ...(payload === undefined ? {} : { payload }),
  });
}
async function kalender(konto = ich) {
  const r = await aufbau.app.inject({ url: "/api/me/kalender", headers: konto.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().eintraege;
}

describe("AW19 · tatsächliche persönliche Ablage und derselbe Kalender", () => {
  it("übernimmt nur tatsächlich bekannte Zuständigkeit und erfindet kein Konto aus einer unauflösbaren Quellkennung", async () => {
    const me = await aufbau.app.inject({ url: "/api/auth/me", headers: ich.kopf });
    const kontoId: string = me.json().id;
    const ko = await services.ko.create({
      title: "Synthetische Lizenzquelle",
      statement: "Lizenz L-17: Ablaufdatum 2027-04-30.",
      type: "best_practice",
      category: "Fristen-Prüfung",
      author: kontoId,
      confidentiality: "intern",
    });
    await services.ko.setOwnership(ko.id, { owner: kontoId }, kontoId);
    const r = await api("PUT", "/regel", {
      fassung: 0,
      regel: regel([{ art: "wissensobjekt", id: ko.id }]),
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().fristen[0].verantwortlich).toBe(kontoId);
    const e = (await kalender())[0];
    expect(e).toMatchObject({ verantwortlich: kontoId, zugeordnet: true, auftrag: null });
    await services.ko.setOwnership(ko.id, { owner: "nicht-vorhandene-person" }, kontoId);
    const neu = await api("POST", "/aktualisieren");
    expect(neu.statusCode, neu.body).toBe(200);
    expect(neu.json().fristen[0].verantwortlich).toBeNull();
    expect((await kalender())[0]).toMatchObject({
      id: e.id,
      verantwortlich: null,
      zugeordnet: false,
    });
  });
  it("Vorschau schreibt nichts; konfigurierte eindeutige Fristen erscheinen ohne Einzelfreigabe genau einmal", async () => {
    const n = await notiz(
      "Lizenz L-17: Ablaufdatum 2027-04-30.\nZertifikat Z-8: Ablaufdatum 2027-12-31.\nDokumentdatum 2026-10-20.",
    );
    const r = regel([{ art: "notiz", id: n.id }]);
    const v = await api("POST", "/vorschau", { regel: r });
    expect(v.statusCode, v.body).toBe(200);
    expect(v.json().fristen).toHaveLength(2);
    expect((await api("GET")).json().fristen).toEqual([]);
    expect(await kalender()).toEqual([]);
    const gespeichert = await api("PUT", "/regel", { regel: r, fassung: 0 });
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);
    expect(gespeichert.json().fristen).toHaveLength(2);
    const ids = (await kalender()).map((e: { id: string }) => e.id).sort();
    expect(ids).toHaveLength(2);
    expect((await kalender())[0]).toMatchObject({
      herkunft: { art: "information" },
      art: "frist",
      auftrag: null,
      lauf: null,
      verantwortlich: null,
    });
    const wiederholt = await Promise.all([
      api("POST", "/aktualisieren"),
      api("POST", "/aktualisieren"),
    ]);
    expect(wiederholt.map((x) => x.statusCode)).toEqual([200, 200]);
    expect((await api("GET")).json().fassung).toBe(gespeichert.json().fassung);
    expect((await kalender()).map((e: { id: string }) => e.id).sort()).toEqual(ids);
    const fremd = await neuesKonto(aufbau.app, "fremde-fristen", aufbau.admin);
    expect(await kalender(fremd)).toEqual([]);
    expect((await api("GET", "", undefined, fremd)).json().fristen).toEqual([]);
    expect((await api("PUT", "/regel", { regel: r, fassung: 0 }, fremd)).statusCode).toBe(404);
    // Kalender-Löschen verwirft denselben Vorgang; ein Neuabruf der Quelle belebt ihn nicht wieder.
    const weg = await aufbau.app.inject({
      method: "DELETE",
      url: `/api/me/kalender/eintraege/${encodeURIComponent(ids[0])}`,
      headers: ich.kopf,
    });
    expect(weg.statusCode, weg.body).toBe(200);
    expect((await api("POST", "/aktualisieren")).statusCode).toBe(200);
    expect(await kalender()).toHaveLength(1);
    expect(
      (await api("GET")).json().fristen.filter((f: { stand: string }) => f.stand === "verworfen"),
    ).toHaveLength(1);
  });

  it("widersprüchliche Belege ergeben anfangs ausschließlich Klärung und keine verbindliche Kalenderfälligkeit", async () => {
    const a = await notiz("Lizenz L-17: Ablaufdatum 2027-04-30.");
    const b = await notiz("Lizenz L-17: Ablaufdatum 2027-05-30.");
    const r = await api("PUT", "/regel", {
      fassung: 0,
      regel: regel([
        { art: "notiz", id: a.id },
        { art: "notiz", id: b.id },
      ]),
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().fristen).toHaveLength(1);
    expect(r.json().fristen[0]).toMatchObject({
      stand: "klaerung",
      datum: null,
      klaerung: ["widerspruch"],
    });
    expect(await kalender()).toEqual([]);
  });

  it("heutiger Rechteentzug schützt auch abgeleiteten Ereignistext, danach lässt sich die Erfassung pausieren", async () => {
    const ko = await services.ko.create({
      title: "Synthetische Lizenz",
      statement: "Lizenz L-17: Ablaufdatum 2027-04-30.",
      type: "best_practice",
      category: "Fiktive Lizenzbelege",
      author: "fiktive-fachperson",
      confidentiality: "intern",
    });
    const r = regel([{ art: "wissensobjekt", id: ko.id }]);
    const gespeichert = await api("PUT", "/regel", { regel: r, fassung: 0 });
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);
    expect((await kalender())[0]?.titel).toBe("Lizenz L-17");
    await services.ko.setConfidentiality(ko.id, "streng_vertraulich", "fiktive-fachperson");
    const privat = await api("GET");
    expect(privat.json().fristen).toEqual([]);
    const geschuetzt = await kalender();
    expect(geschuetzt[0]).toMatchObject({ geschuetzt: true, titel: null, notiz: null });
    expect(geschuetzt[0].erkennung).toBeUndefined();
    expect((await api("POST", "/vorschau", { regel: r })).statusCode).toBe(404);
    const pause = await api("PUT", "/regel", {
      regel: { ...r, aktiv: false },
      fassung: privat.json().fassung,
    });
    expect(pause.statusCode, pause.body).toBe(200);
    expect(pause.json().regel.aktiv).toBe(false);
    expect((await api("POST", "/aktualisieren")).statusCode).toBe(409);
  });
});
