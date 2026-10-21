// EQF-07-K03: zwei neue API-Definitionen; source-only, noch nicht ausgeführt.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleServices, inMemoryRepos } from "../../services/app/src/build-app";
import type { erinnerungSicht } from "../../services/app/src/routes/klara-erinnerung-routes";
import { Reasoner } from "../../services/reasoner";
import { type Aufbau, type Konto, appAufbauen, neuesKonto } from "../klara-quellen-nutzerweg/kette";

type Sicht = ReturnType<typeof erinnerungSicht>;
type Antwort = { deutung: { art: string }; angewendet: boolean; erinnerung: Sicht };
let aufbau: Aufbau;
let ich: Konto;
let services: ReturnType<typeof assembleServices>;
const BASIS = "/api/me/klara/erinnerungen";
const netz = vi.fn(async () => {
  throw new Error("Kein äußerer Transport in der synthetischen Routinenprobe");
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T08:00:00.000Z"));
  netz.mockClear();
  vi.stubGlobal("fetch", netz);
  aufbau = await appAufbauen(true, () => {
    services = assembleServices(inMemoryRepos());
    services.reasoner = new Reasoner();
    services.mailer = { send: async () => {} };
    delete services.push;
    return services;
  });
  ich = await neuesKonto(aufbau.app, "routine-negation", aufbau.admin);
});
afterEach(async () => {
  try {
    await aufbau?.app.close();
  } finally {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

async function routine(): Promise<Sicht> {
  const r = await aufbau.app.inject({
    method: "POST",
    url: BASIS,
    headers: ich.kopf,
    payload: {
      vorgang: `routine-negation-${crypto.randomUUID()}`,
      titel: "Synthetischer Wochenbericht",
      zeitzone: "Europe/Berlin",
      zeitplan: {
        art: "serie",
        datum: "2026-11-02",
        uhrzeit: "09:00",
        wiederholung: { takt: "woechentlich", intervall: 1, anzahl: 4 },
      },
      aktion: "routine_bericht",
      routine: { abschnitte: ["offene_aufgaben", "erledigte_aufgaben"] },
    },
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json<{ erinnerung: Sicht }>().erinnerung;
}

async function lesen(id: string): Promise<Sicht> {
  const r = await aufbau.app.inject({ url: `${BASIS}/${id}`, headers: ich.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return r.json<{ erinnerung: Sicht }>().erinnerung;
}

async function aendern(e: Sicht, text: string): Promise<Antwort> {
  const r = await aufbau.app.inject({
    method: "POST",
    url: `${BASIS}/${e.id}/routine`,
    headers: ich.kopf,
    payload: { fassung: e.fassung, text, anwenden: true },
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json<Antwort>();
}

async function meldungen(): Promise<unknown[]> {
  const r = await aufbau.app.inject({ url: "/api/notifications", headers: ich.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return r.json<unknown[]>();
}

async function negiertUnveraendert(e: Sicht, text: string) {
  const auftrag = structuredClone(await services.klaraErinnerungen.erinnerungen.holeSystem(e.id));
  if (!auftrag) throw new Error("Gespeicherter Auftrag fehlt");
  const vorherigeMeldungen = await meldungen();
  const antwort = await aendern(e, text);
  expect(antwort).toMatchObject({ deutung: { art: "unklar" }, angewendet: false });
  expect(antwort.erinnerung).toEqual(e);
  expect(await lesen(e.id)).toEqual(e);
  expect(await services.klaraErinnerungen.erinnerungen.holeSystem(e.id)).toEqual(auftrag);
  expect(await services.klaraErinnerungen.laeufe.fuerErinnerung(e.id, 50)).toEqual([]);
  expect(await meldungen()).toEqual(vorherigeMeldungen);
  expect(netz).not.toHaveBeenCalled();
}

it("A: negierte Statusbefehle lassen Auftrag, Läufe und Meldungen unverändert", async () => {
  const e = await routine();
  expect(e.status).toBe("aktiv");
  for (const text of ["Bitte nicht pausieren", "Bitte nicht beenden", "Bitte nicht fortsetzen"]) {
    await negiertUnveraendert(e, text);
  }
});

it("B: erhält Pause, ausdrückliches Fortsetzen und nicht mehr ausführen", async () => {
  const e = await routine();
  const pause = await aendern(e, "Bitte pausieren");
  expect(pause).toMatchObject({ deutung: { art: "pausieren" }, angewendet: true });
  expect(pause.erinnerung).toMatchObject({ status: "pausiert", fassung: e.fassung + 1 });
  expect(pause.erinnerung.zeitplan).toEqual(e.zeitplan);
  expect(pause.erinnerung.routine).toEqual(e.routine);
  expect(await lesen(e.id)).toEqual(pause.erinnerung);
  await negiertUnveraendert(pause.erinnerung, "Bitte nicht fortsetzen");

  const weiter = await aendern(pause.erinnerung, "Bitte fortsetzen");
  expect(weiter).toMatchObject({ deutung: { art: "fortsetzen" }, angewendet: true });
  expect(weiter.erinnerung).toMatchObject({
    status: "aktiv",
    fassung: pause.erinnerung.fassung + 1,
  });
  expect(weiter.erinnerung.zeitplan).toEqual(e.zeitplan);
  expect(weiter.erinnerung.routine).toEqual(e.routine);
  expect(await lesen(e.id)).toEqual(weiter.erinnerung);

  const abschnitt = await aendern(weiter.erinnerung, "Erledigte Aufgaben nicht mehr");
  expect(abschnitt).toMatchObject({ deutung: { art: "abschnitt_weg" }, angewendet: true });
  expect(abschnitt.erinnerung.routine).toMatchObject({
    fassung: 2,
    abschnitte: ["offene_aufgaben"],
  });
  expect(abschnitt.erinnerung.status).toBe("aktiv");
  expect(abschnitt.erinnerung.zeitplan).toEqual(e.zeitplan);

  const ende = await aendern(abschnitt.erinnerung, "Bitte nicht mehr ausführen");
  expect(ende).toMatchObject({ deutung: { art: "beenden" }, angewendet: true });
  expect(ende.erinnerung).toMatchObject({
    status: "beendet",
    fassung: abschnitt.erinnerung.fassung + 1,
  });
  expect(ende.erinnerung.routine).toEqual(abschnitt.erinnerung.routine);
  expect(ende.erinnerung.zeitplan).toEqual(e.zeitplan);
  expect(await lesen(e.id)).toEqual(ende.erinnerung);
  expect(await services.klaraErinnerungen.laeufe.fuerErinnerung(e.id, 50)).toEqual([]);
  expect(netz).not.toHaveBeenCalled();
});
