// ================================================================================================
// KLARA 11 (produkt:20261008:klara-kalender) · DIE KALENDERSPERRE AN DER TATSÄCHLICHEN STEUERUNG.
// ================================================================================================
//
// Nacharbeit 44 (Ben, K5/K10): Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(
// inMemoryRepos()), …)`, `app.inject`) mit der EINEN Erinnerungssteuerung (C04) und dem eigenen
// Kalender (C06) aus demselben Aufbau. Den Takt der Steuerung ruft der Test über dieselbe Option,
// über die `server.ts` ihn startet (`klaraErinnerungen`); die Uhr ist nur als `Date` gestellt. Der
// Kalenderanbieter ist das strenge Vertragsdouble — KEIN echter Microsoft-365-Kalender. Ein
// „Neustart“ ist eine NEUE App über denselben Bestand; echte Ablage und Pool-Neustart misst
// `scheduler-sperre-pg.integration.test.ts`. Ausschließlich fiktive Daten.
//
//   E1 (P07-AC05, AW17-K05/K06) Serie mit zwei Vorkommen plus unabhängige Erinnerung: die externe
//      Löschung EINES Vorkommens sperrt nur dessen Ausführung. Neustart, Fälligkeit und verspäteter
//      Abgleich erhalten die Sperre; Dialogschließen und fehlender Umfang geben nichts frei; erst
//      die ausdrückliche Fortführung führt GENAU dieses Vorkommen aus — einmal.
//   E2 (P07-AC06) Beenden „nur dieser Termin“: dieser Lauf endet, die Serie läuft weiter.
//   E3 (P07-AC06) Beenden „ganze Serie“: die Erinnerung ist beendet, kein weiteres Vorkommen wirkt.
//   S09 (AW17-K01) Derselbe Auftrag und dasselbe Vorkommen im eigenen und im verbundenen Kalender —
//      ohne Dublette; Sperre und Ergebnis über dieselbe Kennung nachgelesen; fremdes Konto 404.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { KlaraErinnerungLaufbericht } from "../../services/app/src/klara-erinnerung";
import type { AnbieterTermin } from "../../services/app/src/klara-kalender-anbindung";
import { DOUBLE_KALENDER, DOUBLE_KONTO, StrengerTestkalender } from "./vertragsdouble";

type App = ReturnType<typeof buildApp>;

const BASIS = "/api/me/klara/kalender";
const KENNWORT = "secret123";
const BERLIN = "Europe/Berlin";

let services: AppServices;
let app: App;
let takt: () => Promise<KlaraErinnerungLaufbericht>;
let kalender: StrengerTestkalender;
const eingespeist = new Set<string>();
let ada = { id: "", token: "" };
let erik = { id: "", token: "" };

/** Startet die Anwendung über dem VORHANDENEN Bestand — wie ein Neustart des Servers. */
function starte(): void {
  app = buildApp(services, {
    klaraKalenderAnbieter: async (kontoId) => (eingespeist.has(kontoId) ? kalender : null),
    klaraErinnerungen: (lauf) => {
      takt = lauf;
      return 60_000;
    },
  });
}

const auf = (wer: string, methode: "GET" | "POST" | "PUT", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const login = await auf("", "POST", "/api/auth/login", { email, password: KENNWORT });
  expect(login.statusCode, login.body).toBe(200);
  return (login.json() as { token: string }).token;
}

const uhr = (iso: string) => vi.setSystemTime(new Date(iso));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  uhr("2026-10-19T08:00:00.000Z");
  kalender = new StrengerTestkalender();
  eingespeist.clear();
  services = assembleServices(inMemoryRepos());
  starte();
  await auf("", "POST", "/api/auth/register", {
    name: "Ada Admin",
    email: "ada@klara-kalender-anschluss.test",
    password: KENNWORT,
  });
  const adaToken = await anmelden("ada@klara-kalender-anschluss.test");
  const ich = await auf(adaToken, "GET", "/api/auth/me");
  ada = { id: (ich.json() as { id: string }).id, token: adaToken };
  const angelegt = await auf(adaToken, "POST", "/api/users", {
    name: "Erik Experte",
    email: "erik@klara-kalender-anschluss.test",
    password: KENNWORT,
    role: "experte",
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  erik = {
    id: (angelegt.json() as { id: string }).id,
    token: await anmelden("erik@klara-kalender-anschluss.test"),
  };
  eingespeist.add(ada.id);
});

afterEach(() => {
  vi.useRealTimers();
});

interface LaufSicht {
  vorkommenId: string;
  status: string;
  versuch: number;
  ergebnis: { grund?: string };
}

interface ErinnerungSicht {
  status: string;
  lage: string;
  laeufe: LaufSicht[];
}

interface ZuordnungSicht {
  schluessel: string;
  auftragId: string;
  ereignisId: string;
  externeId: string | null;
  stand: string;
}

interface EintragSicht {
  id: string;
  auftrag: { titel: string };
  lauf: { status: string };
}

interface AnsichtAntwort {
  vorhandenerKalender: { verbunden: boolean; termine: { id: string }[] };
  eintraege: { id: string }[];
  ausfuehrungAngebunden: boolean;
}

async function erinnerung(
  wer: { token: string },
  vorgang: string,
  zeitplan: Record<string, unknown>,
): Promise<string> {
  const r = await auf(wer.token, "POST", "/api/me/klara/erinnerungen", {
    vorgang,
    titel: "Zertifikat prüfen",
    zeitzone: BERLIN,
    zeitplan,
  });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { erinnerung: { id: string } }).erinnerung.id;
}

const serie = (anzahl: number) => ({
  art: "serie",
  datum: "2026-10-20",
  uhrzeit: "09:00",
  wiederholung: { takt: "taeglich", intervall: 1, anzahl },
});

async function erinnerungSicht(id: string): Promise<ErinnerungSicht> {
  const r = await auf(ada.token, "GET", `/api/me/klara/erinnerungen/${id}`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { erinnerung: ErinnerungSicht }).erinnerung;
}

async function lauf(id: string, vorkommenId: string): Promise<LaufSicht | undefined> {
  return (await erinnerungSicht(id)).laeufe.find((l) => l.vorkommenId === vorkommenId);
}

async function verbinde(wer: { token: string }): Promise<string> {
  const r = await auf(wer.token, "POST", `${BASIS}/anbindungen`, {
    kalenderId: DOUBLE_KALENDER.id,
    umfang: "lesen_schreiben",
  });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { anbindung: { id: string } }).anbindung.id;
}

/** Ein Vorkommen der Erinnerung als Termin — Auftrag = Erinnerung, Ereignis = Vorkommen. */
function vorkommenTermin(auftragId: string, datum: string) {
  return {
    auftragId,
    ereignisId: `${auftragId}@${datum}T09:00`,
    fassung: 1,
    privat: false,
    serienart: "vorkommen",
    abgesagt: false,
    inhalt: {
      titel: "Zertifikat prüfen",
      beginn: `${datum}T09:00`,
      ende: `${datum}T09:15`,
      zeitzone: BERLIN,
      ort: "",
      beschreibung: "",
      teilnehmer: [],
    },
  };
}

async function eintragen(anbindungId: string, rumpf: Record<string, unknown>) {
  const r = await auf(ada.token, "POST", `${BASIS}/anbindungen/${anbindungId}/termine`, rumpf);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { zuordnung: ZuordnungSicht }).zuordnung;
}

async function abgleich(anbindungId: string): Promise<void> {
  const r = await auf(ada.token, "POST", `${BASIS}/anbindungen/${anbindungId}/abgleich`, {});
  expect(r.statusCode, r.body).toBe(200);
}

const entscheide = (schluessel: string, rumpf: Record<string, unknown>) =>
  auf(ada.token, "POST", `${BASIS}/zuordnungen/${schluessel}/entscheidung`, rumpf);

async function laufStand(auftragId: string, ereignisId: string): Promise<string> {
  const r = await auf(
    ada.token,
    "GET",
    `${BASIS}/lauf?auftragId=${encodeURIComponent(auftragId)}&ereignisId=${encodeURIComponent(ereignisId)}`,
  );
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { stand: string }).stand;
}

describe("E1 · externe Löschung pausiert NUR das betroffene Vorkommen — bis zur Entscheidung", () => {
  it("andere Vorkommen und Erinnerungen laufen; Neustart, Abgleich und Dialog geben nichts frei", async () => {
    const s = await erinnerung(ada, "serie-sperre-0001", serie(2));
    const u = await erinnerung(ada, "einzel-frei-00001", {
      art: "einmalig",
      datum: "2026-10-20",
      uhrzeit: "09:00",
    });
    const v1 = `${s}@2026-10-20T09:00`;
    const v2 = `${s}@2026-10-21T09:00`;
    const a = await verbinde(ada);
    const z1 = await eintragen(a, { termin: vorkommenTermin(s, "2026-10-20") });
    const z2 = await eintragen(a, { termin: vorkommenTermin(s, "2026-10-21") });
    expect(z1).toMatchObject({ auftragId: s, ereignisId: v1, stand: "projiziert" });

    // Im Kalender gelöscht → Abgleich → NUR dieses Vorkommen ist gesperrt.
    kalender.termine.delete(z1.externeId ?? "");
    await abgleich(a);
    expect(await laufStand(s, v1)).toBe("pausiert");
    expect(await laufStand(s, v2)).toBe("laeuft");

    // Neustart vor der Fälligkeit und ein verspäteter Abgleich: die Sperre bleibt.
    starte();
    await abgleich(a);
    expect(await laufStand(s, v1)).toBe("pausiert");

    // Fällig: die Steuerung wirkt NICHT für dieses Vorkommen, aber für die unabhängige Erinnerung.
    uhr("2026-10-20T07:05:00.000Z");
    const t1 = await takt();
    expect(t1).toMatchObject({ unklar: 1, zugestellt: 1 });
    expect(await lauf(s, v1)).toMatchObject({
      status: "unklar",
      ergebnis: { grund: "kalender_pausiert" },
    });
    expect((await erinnerungSicht(u)).laeufe).toMatchObject([{ status: "zugestellt" }]);
    expect(await erinnerungSicht(s)).toMatchObject({
      status: "aktiv",
      lage: "wartet_auf_klaerung",
    });

    // Neustart; das ANDERE Vorkommen derselben Serie wirkt unverändert.
    starte();
    uhr("2026-10-21T07:05:00.000Z");
    await takt();
    expect(await lauf(s, v2)).toMatchObject({ status: "zugestellt", versuch: 1 });
    expect(await lauf(s, v1)).toMatchObject({ status: "unklar" });

    // Dialogschließen ist keine Zustimmung; ohne Umfang gibt es keine Entscheidung.
    const zu = await entscheide(z1.schluessel, { wahl: "dialog_geschlossen" });
    expect(zu.statusCode, zu.body).toBe(200);
    expect(zu.json()).toMatchObject({ laufWirkung: "pausiert" });
    const ohneUmfang = await entscheide(z1.schluessel, { wahl: "fortfuehren_ohne_kalender" });
    expect(ohneUmfang.statusCode).toBe(400);
    await takt();
    expect(await lauf(s, v1)).toMatchObject({ status: "unklar" });
    expect(await laufStand(s, v1)).toBe("pausiert");

    // Ausdrücklich fortgeführt (nur dieser Termin): GENAU dieses Vorkommen wirkt jetzt — einmal.
    const weiter = await entscheide(z1.schluessel, {
      wahl: "fortfuehren_ohne_kalender",
      umfang: "einzeltermin",
    });
    expect(weiter.statusCode, weiter.body).toBe(200);
    expect(await laufStand(s, v1)).toBe("laeuft");
    const t3 = await takt();
    expect(t3.zugestellt).toBe(1);
    expect(await lauf(s, v1)).toMatchObject({ status: "zugestellt", versuch: 2 });
    expect(await lauf(s, v2)).toMatchObject({ status: "zugestellt", versuch: 1 });
    const t4 = await takt();
    expect(t4).toMatchObject({ zugestellt: 0, unklar: 0, dedupliziert: 0 });
    expect(z2.stand).toBe("projiziert");
  });
});

describe("E2/E3 · Beenden wirkt nur im ausdrücklich gewählten Umfang", () => {
  it("„nur dieser Termin“ beendet genau diesen Lauf; die Serie läuft weiter", async () => {
    const s = await erinnerung(ada, "serie-einzel-ende", serie(2));
    const v1 = `${s}@2026-10-20T09:00`;
    const v2 = `${s}@2026-10-21T09:00`;
    const a = await verbinde(ada);
    const z1 = await eintragen(a, { termin: vorkommenTermin(s, "2026-10-20") });
    kalender.termine.delete(z1.externeId ?? "");
    await abgleich(a);
    uhr("2026-10-20T07:05:00.000Z");
    await takt();
    expect(await lauf(s, v1)).toMatchObject({ status: "unklar" });

    const ende = await entscheide(z1.schluessel, { wahl: "beenden", umfang: "einzeltermin" });
    expect(ende.statusCode, ende.body).toBe(200);
    expect(await lauf(s, v1)).toMatchObject({
      status: "abgebrochen",
      ergebnis: { grund: "kalender_beendet" },
    });
    expect((await erinnerungSicht(s)).status).toBe("aktiv");

    uhr("2026-10-21T07:05:00.000Z");
    await takt();
    expect(await lauf(s, v2)).toMatchObject({ status: "zugestellt" });
    expect(await lauf(s, v1)).toMatchObject({ status: "abgebrochen" });
  });

  it("„ganze Serie“ beendet die Erinnerung über ihren Statusweg — kein Vorkommen wirkt mehr", async () => {
    const s = await erinnerung(ada, "serie-ganz-ende0", serie(3));
    const a = await verbinde(ada);
    const z1 = await eintragen(a, { termin: vorkommenTermin(s, "2026-10-20") });
    kalender.termine.delete(z1.externeId ?? "");
    await abgleich(a);

    const ende = await entscheide(z1.schluessel, { wahl: "beenden", umfang: "serie" });
    expect(ende.statusCode, ende.body).toBe(200);
    expect(ende.json()).toMatchObject({ laufWirkung: "beendet" });
    expect((await erinnerungSicht(s)).status).toBe("beendet");

    uhr("2026-10-22T07:05:00.000Z");
    const t = await takt();
    expect(t.zugestellt).toBe(0);
    expect((await erinnerungSicht(s)).laeufe).toEqual([]);
  });
});

describe("S09 · derselbe Auftrag im eigenen und im verbundenen Kalender — ohne Dublette", () => {
  it("eine Identität durch eigenen Kalender, Kalenderanbindung und Steuerung", async () => {
    const e = await erinnerung(ada, "s09-eigener-kal1", {
      art: "einmalig",
      datum: "2026-10-20",
      uhrzeit: "09:00",
    });
    const v = `${e}@2026-10-20T09:00`;
    // Der eigene Kalender verweist auf DENSELBEN Auftrag und DASSELBE Vorkommen der Steuerung.
    const angelegt = await auf(ada.token, "POST", "/api/me/kalender/eintraege", {
      titel: "Zertifikat prüfen (eigener Kalender)",
      beginn: "2026-10-20T07:00:00.000Z",
      ende: "2026-10-20T07:15:00.000Z",
      zeitzone: BERLIN,
      auftrag: { taskId: e },
      lauf: { runId: v },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const eintrag = (angelegt.json() as { eintrag: EintragSicht }).eintrag;
    expect(eintrag).toMatchObject({
      auftrag: { titel: "Zertifikat prüfen" },
      lauf: { status: "geplant" },
    });
    const sicht = await auf(ada.token, "PUT", "/api/me/kalender/einstellungen", {
      sichtmodus: "beide",
    });
    expect(sicht.statusCode, sicht.body).toBe(200);

    // In den verbundenen Kalender — mit der Kennung des eigenen Eintrags, nicht vom Browser erfunden.
    const a = await verbinde(ada);
    const z = await eintragen(a, { eigenerEintragId: eintrag.id });
    expect(z).toMatchObject({ auftragId: e, ereignisId: v, stand: "projiziert" });
    expect(kalender.termine.get(z.externeId ?? "")).toMatchObject({
      titel: "Zertifikat prüfen (eigener Kalender)",
      beginn: "2026-10-20T09:00",
      zeitzone: BERLIN,
    });
    // Ein zweites Eintragen ist dasselbe Ereignis — keine Dublette.
    const nochmal = await eintragen(a, { eigenerEintragId: eintrag.id });
    expect(nochmal.externeId).toBe(z.externeId);
    const eigene = [...kalender.termine.values()].filter((t) => t.vorgang?.startsWith("kk-"));
    expect(eigene).toHaveLength(1);

    // Ein fremder Termin im verbundenen Kalender.
    const fremd: AnbieterTermin = {
      id: "fremd-1",
      kalenderId: DOUBLE_KALENDER.id,
      version: 'W/"fremd"',
      titel: "Team-Frühstück",
      beginn: "2026-10-20T12:00",
      ende: "2026-10-20T13:00",
      zeitzone: BERLIN,
      ort: "",
      beschreibung: "",
      teilnehmer: [],
      serienart: "einzel",
      serienId: null,
      abgesagt: false,
      organisator: DOUBLE_KONTO.adresse,
      vorgang: null,
    };
    kalender.termine.set(fremd.id, fremd);

    // Gemeinsame Ansicht: eigener Eintrag EINMAL, aus dem verbundenen Kalender nur der fremde Termin.
    const ansicht = await auf(ada.token, "GET", "/api/me/kalender");
    expect(ansicht.statusCode, ansicht.body).toBe(200);
    const an = ansicht.json() as AnsichtAntwort;
    expect(an.ausfuehrungAngebunden).toBe(true);
    expect(an.eintraege.map((x) => x.id)).toEqual([eintrag.id]);
    expect(an.vorhandenerKalender).toEqual({
      verbunden: true,
      termine: [
        {
          id: "fremd-1",
          titel: "Team-Frühstück",
          ganztaegig: false,
          beginn: "2026-10-20T12:00",
          ende: "2026-10-20T13:00",
        },
      ],
    });

    // Externe Löschung: dieselbe Kennung ist in der Laufauskunft pausiert, die Steuerung hält an.
    kalender.termine.delete(z.externeId ?? "");
    await abgleich(a);
    expect(await laufStand(e, v)).toBe("pausiert");
    uhr("2026-10-20T07:05:00.000Z");
    await takt();
    expect(await lauf(e, v)).toMatchObject({ status: "unklar" });

    // Ausdrücklich fortgeführt: das Ergebnis steht danach im eigenen Kalender — aus dem Dienst.
    const weiter = await entscheide(z.schluessel, {
      wahl: "fortfuehren_ohne_kalender",
      umfang: "einzeltermin",
    });
    expect(weiter.statusCode, weiter.body).toBe(200);
    await takt();
    expect(await lauf(e, v)).toMatchObject({ status: "zugestellt" });
    const offen = await auf(ada.token, "GET", `/api/me/kalender/eintraege/${eintrag.id}`);
    expect(offen.json()).toMatchObject({
      eintrag: {
        lauf: { runId: v, status: "abgeschlossen" },
        ergebnis: { art: "erinnerung_zugestellt" },
      },
    });
  });

  it("ein fremdes Konto trägt einen fremden Eintrag nicht ein (404)", async () => {
    const angelegt = await auf(ada.token, "POST", "/api/me/kalender/eintraege", {
      titel: "Persönlicher Termin",
      beginn: "2026-10-20T07:00:00.000Z",
      ende: "2026-10-20T07:30:00.000Z",
      zeitzone: BERLIN,
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const id = (angelegt.json() as { eintrag: { id: string } }).eintrag.id;
    eingespeist.add(erik.id);
    const a = await verbinde(erik);
    const r = await auf(erik.token, "POST", `${BASIS}/anbindungen/${a}/termine`, {
      eigenerEintragId: id,
    });
    expect(r.statusCode).toBe(404);
    expect(kalender.termine.size).toBe(0);
  });
});
