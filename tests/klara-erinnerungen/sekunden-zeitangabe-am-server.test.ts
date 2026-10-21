// AW18-K01/K02: zwei neue API-Fälle, kein Sekundensupport und kein alter Test-Replay.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assembleServices, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraErinnerungVorschau } from "../../services/app/src/klara-erinnerung";
import type { erinnerungSicht } from "../../services/app/src/routes/klara-erinnerung-routes";
import { Reasoner } from "../../services/reasoner";
import { type Aufbau, type Konto, appAufbauen, neuesKonto } from "../klara-quellen-nutzerweg/kette";

type Sicht = ReturnType<typeof erinnerungSicht>;
const BASIS = "/api/me/klara/erinnerungen";
const ZONE = "Europe/Berlin";
let aufbau: Aufbau;
let ich: Konto;
let kontoId: string;
let services: ReturnType<typeof assembleServices>;
const netz = vi.fn(async () => {
  throw new Error("Kein äußerer Transport in der synthetischen Sekundenprobe");
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
  ich = await neuesKonto(aufbau.app, "sekunden-klaerung", aufbau.admin);
  const me = await aufbau.app.inject({ url: "/api/auth/me", headers: ich.kopf });
  expect(me.statusCode, me.body).toBe(200);
  kontoId = me.json<{ id: string }>().id;
});
afterEach(async () => {
  try {
    await aufbau?.app.close();
  } finally {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

async function vorschau(text: string): Promise<KlaraErinnerungVorschau> {
  const r = await aufbau.app.inject({
    method: "POST",
    url: `${BASIS}/vorschau`,
    headers: ich.kopf,
    payload: { text, zeitzone: ZONE },
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json<KlaraErinnerungVorschau>();
}

async function bestand() {
  const liste = await aufbau.app.inject({ url: BASIS, headers: ich.kopf });
  const meldungen = await aufbau.app.inject({ url: "/api/notifications", headers: ich.kopf });
  expect(liste.statusCode, liste.body).toBe(200);
  expect(meldungen.statusCode, meldungen.body).toBe(200);
  return {
    liste: liste.json<unknown>(),
    meldungen: meldungen.json<unknown[]>(),
    laeufe: await services.klaraErinnerungen.laeufe.zaehle(kontoId, Date.now()),
  };
}

it("A: klärt Sekunden und Bruchteile ohne abgeschnittenen Plan oder Nebenwirkung", async () => {
  const vorher = await bestand();
  for (const text of [
    "morgen um 09:30:45",
    "morgen um 09:30:45.123",
    "morgen um 09:30,5",
    "morgen um 09:30.5",
    "morgen um 9:30:45",
  ]) {
    expect(await vorschau(text)).toEqual({
      deutung: { art: "klaerung", grund: "uhrzeit_fehlt", optionen: [] },
      zeitzone: ZONE,
      zeitplan: null,
      anzeige: null,
    });
    expect(await bestand()).toEqual(vorher);
  }
  expect(netz).not.toHaveBeenCalled();
});

it("B: erhält Minutenangaben und legt genau einen Vorschauplan unverändert an", async () => {
  let legitim: KlaraErinnerungVorschau | null = null;
  for (const text of [
    "morgen um 09:30.",
    "morgen um 09:30 Uhr",
    "morgen um 09.30 Uhr.",
    "am 22.10.2026 um 09:30 Uhr.",
  ]) {
    const v = await vorschau(text);
    expect(v.deutung).toEqual({ art: "eindeutig", datum: "2026-10-22", uhrzeit: "09:30" });
    expect(v.zeitplan).toEqual({ art: "einmalig", datum: "2026-10-22", uhrzeit: "09:30" });
    expect(v.zeitzone).toBe(ZONE);
    expect(v.anzeige?.naechste).toMatchObject({
      datum: "2026-10-22",
      uhrzeit: "09:30",
      versatz: "+02:00",
      zeitpunkt: "2026-10-22T07:30:00.000Z",
    });
    legitim ??= v;
  }
  if (!legitim?.zeitplan) throw new Error("Legitime Vorschau fehlt");
  const leer = await aufbau.app.inject({ url: BASIS, headers: ich.kopf });
  expect(leer.statusCode, leer.body).toBe(200);
  expect(leer.json<{ erinnerungen: Sicht[] }>().erinnerungen).toEqual([]);
  const angelegt = await aufbau.app.inject({
    method: "POST",
    url: BASIS,
    headers: ich.kopf,
    payload: {
      vorgang: `minuten-erhaltung-${crypto.randomUUID()}`,
      titel: "Synthetische Minuten-Erinnerung",
      zeitzone: legitim.zeitzone,
      zeitplan: legitim.zeitplan,
      aktion: "erinnern",
    },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const e = angelegt.json<{ erinnerung: Sicht }>().erinnerung;
  expect(e).toMatchObject({ status: "aktiv", zeitzone: ZONE, zeitplan: legitim.zeitplan });
  const gelesen = await aufbau.app.inject({ url: `${BASIS}/${e.id}`, headers: ich.kopf });
  expect(gelesen.statusCode, gelesen.body).toBe(200);
  expect(gelesen.json<{ erinnerung: Sicht }>().erinnerung).toEqual(e);
  const liste = await aufbau.app.inject({ url: BASIS, headers: ich.kopf });
  expect(liste.statusCode, liste.body).toBe(200);
  expect(liste.json<{ erinnerungen: Sicht[] }>().erinnerungen).toHaveLength(1);
  expect(await services.klaraErinnerungen.laeufe.fuerErinnerung(e.id, 50)).toEqual([]);
  expect(netz).not.toHaveBeenCalled();
});
