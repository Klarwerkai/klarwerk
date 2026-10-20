// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 AC05 — ZEITPLÄNE LÖSEN LÄUFE AUS.
// ================================================================================================
//
// Am echten Server (`buildApp(buildServices())`): der Fälligkeitslauf, den `server.ts` an die
// vorhandene Zeitsteuerung hängt, wird hier mit gestellter Zeit aufgerufen (`routinenZeitsteuerung`).
//   Z1 sofort → der Takt allein legt den gebundenen Auftrag an, führt ihn über den Aktionskern aus
//      und prüft den nachgelesenen Bericht (Nacharbeit 33: kein manueller Ausführungsaufruf).
//   Z2 ab Datum → vorher nichts, danach genau ein Lauf.
//   Z3 wöchentlich → einmal_nachholen holt den versäumten Termin nach, auslassen nicht (nur pünktlich).
//   Z4 Pause → kein Lauf; Rolle ohne Anlagerecht → abgelehnt, vermerkt, nicht in jedem Takt erneut.
//   Z5 Zeitplan entfernt → kein Lauf; Zugangsdaten als Zeitplaneingabe → abgewiesen.
// Fiktive Konten und Daten; Zeitzone UTC, damit die gestellten Zeiten ohne Umrechnung lesbar sind
// (Zeitzone und Sommerzeit: `zeitplan-faelligkeit.test.ts`).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import type { ZeitplanLaufErgebnis } from "../../services/app/src/assistenz-lernen-zeitsteuerung";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";

type App = ReturnType<typeof buildApp>;
type Methode = "GET" | "POST" | "PUT" | "DELETE";
type Takt = (jetzt?: number) => Promise<ZeitplanLaufErgebnis[]>;
type SchrittAntwort = { wiederholt: boolean; schritt: { ergebnis?: { id: string } } };

let app: App;
let services: ReturnType<typeof buildServices>;
let takt: Takt;
let adminToken = "";
let erik: { id: string; token: string };

const VORMACHEN = "/api/me/vormachen";
const WEB = "http://localhost/erfassen";
const TAG = 24 * 60 * 60 * 1000;
const EINGABEN = { titel: "Wochenbericht aus dem Zeitplan", inhalt: "Umsatz gehalten" };

function stillerPruefjob(): AiCheckWorker {
  const eingereiht = new Set<string>();
  return {
    enqueue: vi.fn((koId: string) => {
      eingereiht.add(koId);
    }),
    has: (koId) => eingereiht.has(koId),
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => undefined,
  };
}

const auf = (wer: string, methode: Methode, url: string, payload?: unknown, herkunft?: string) =>
  app.inject({
    method: methode,
    url,
    headers: {
      authorization: `Bearer ${wer}`,
      ...(herkunft ? { referer: herkunft } : {}),
    },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return (login.json() as { token: string }).token;
}

/** P06: einen Bericht über den vorhandenen Entwurfsweg vormachen und bestätigen. */
async function routineVormachen(): Promise<{ id: string; fassung: number }> {
  const start = await auf(erik.token, "POST", VORMACHEN, {
    host: "klarwerk_web",
    vorgaenge: ["entwurf_anlegen"],
    zweck: "Wöchentlichen Bericht vorbereiten",
  });
  expect(start.statusCode, start.body).toBe(201);
  const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
  await auf(erik.token, "GET", `${VORMACHEN}?anzeige=klarwerk_web`);
  const demo = { title: "Wochenbericht KW41 Musterfirma", statement: "Umsatz stabil" };
  const angelegt = await auf(erik.token, "POST", "/api/drafts", demo, WEB);
  expect(angelegt.statusCode, angelegt.body).toBeLessThan(300);
  const v = await auf(erik.token, "GET", `${VORMACHEN}/${sitzung}/vorschau`);
  const stand = (v.json() as { vorschau: { stand: string } }).vorschau.stand;
  const b = await auf(erik.token, "POST", `${VORMACHEN}/${sitzung}/bestaetigung`, { stand });
  expect(b.statusCode, b.body).toBe(201);
  return (b.json() as { routine: { id: string; fassung: number } }).routine;
}

function zeitplan(routine: string, rumpf: Record<string, unknown>) {
  return auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine}/zeitplan`, rumpf);
}

function zustand(routine: string, wert: "aktiv" | "pausiert") {
  return auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine}/zustand`, { zustand: wert });
}

/** Wie viele eigene Entwürfe dieses Titels Erik hat (ein Bericht = genau einer). */
async function berichte(titel: string): Promise<number> {
  const r = await auf(erik.token, "GET", "/api/drafts");
  expect(r.statusCode, r.body).toBe(200);
  const entwuerfe = r.json() as { payload?: { title?: string } }[];
  return entwuerfe.filter((d) => d.payload?.title === titel).length;
}

/** Eine Zeit in UTC als lokale Angabe „JJJJ-MM-TTThh:mm“. */
const lokal = (ms: number) => new Date(ms).toISOString().slice(0, 16);

beforeEach(async () => {
  services = buildServices();
  services.aiCheckWorker = stillerPruefjob();
  app = buildApp(services, {
    routinenZeitsteuerung: (lauf) => {
      takt = lauf;
    },
  });
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Fiktiv Admin", email: "admin@bpa06-takt.test", password: "secret123" },
  });
  adminToken = await anmelden("admin@bpa06-takt.test");
  const angelegt = await auf(adminToken, "POST", "/api/users", {
    name: "Fiktiv Erik",
    email: "erik@bpa06-takt.test",
    password: "secret123",
    role: "experte",
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  erik = { id, token: await anmelden("erik@bpa06-takt.test") };
});

describe("BPA-06 AC05 · die vorhandene Zeitsteuerung führt fällige Läufe aus", () => {
  it("Z1 · sofort: genau ein Auftrag, ausgeführt entsteht der Bericht mit den Zeitplaneingaben", async () => {
    const routine = await routineVormachen();
    const z = await zeitplan(routine.id, { zeitplan: { art: "sofort" }, eingaben: EINGABEN });
    expect(z.statusCode, z.body).toBe(200);
    // Die Routinensicht nennt nur die Namen der Zeitplaneingaben, nicht ihre Werte.
    const sicht = (z.json() as { routine: { zeitplanEingaben: string[] } }).routine;
    expect(sicht.zeitplanEingaben).toEqual(["titel", "inhalt"]);
    expect(JSON.stringify(sicht)).not.toContain(EINGABEN.titel);

    // Nacharbeit 33: der Takt allein führt bis zur Wirkung — kein manueller Ausführungsaufruf.
    const [e, ...rest] = await takt(Date.now());
    expect(rest).toEqual([]);
    expect(e).toMatchObject({ routineId: routine.id, kontoId: erik.id, stand: "ausgefuehrt" });
    expect(e?.abweichungen).toBeUndefined();
    // Ein zweiter Takt legt nichts neu an.
    expect(await takt(Date.now() + 60_000)).toEqual([]);

    // Der Auftrag im Zeitplan-Gespräch steht mit gespeichertem Schritt und Ergebnis da.
    const gid = e?.gespraech ?? "";
    const liste = await auf(erik.token, "GET", `/api/me/klara/gespraeche/${gid}/auftraege`);
    const auftraege = (liste.json() as { auftraege: KlaraAuftrag[] }).auftraege;
    expect(auftraege.map((a) => a.id)).toEqual([e?.auftragId]);
    const schritt = auftraege[0]?.schritte.find((s) => s.schluessel === "bericht-1");
    expect(schritt?.stand).toBe("gespeichert");
    expect(schritt?.ergebnis?.id).toBe(e?.ergebnisId);
    // Wiederöffnen mit der eigenen Anmeldung: der Bericht trägt die Zeitplaneingaben.
    const gelesen = await auf(erik.token, "GET", `/api/drafts/${e?.ergebnisId ?? ""}`);
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    const entwurf = gelesen.json() as { payload: { title?: string; statement?: string } };
    expect(entwurf.payload.title).toBe(EINGABEN.titel);
    expect(entwurf.payload.statement).toContain(EINGABEN.inhalt);
    // Ein späterer Klick auf denselben Schritt legt nichts doppelt an.
    const auftrag = auftraege[0] as KlaraAuftrag;
    const pfad = `/api/me/klara/gespraeche/${gid}/auftraege/${auftrag.id}/schritte/bericht-1`;
    const nochmal = await auf(erik.token, "POST", `${pfad}/ausfuehrung`, {
      nr: 1,
      auftragFassung: auftrag.fassung,
    });
    expect(nochmal.statusCode, nochmal.body).toBe(200);
    const wieder = nochmal.json() as SchrittAntwort;
    expect(wieder.wiederholt).toBe(true);
    expect(wieder.schritt.ergebnis?.id).toBe(e?.ergebnisId);

    // Prüfprotokoll: Ereignis und Kennungen, nie der Inhalt.
    const ereignisse = await services.audit.list({ action: "bpa06.zeitplan.lauf" });
    expect(ereignisse).toHaveLength(1);
    expect(JSON.stringify(ereignisse)).not.toContain(EINGABEN.titel);
  });

  it("Z2 · ab Datum: vorher kein Lauf, danach genau einer", async () => {
    const routine = await routineVormachen();
    const jetzt = Date.now();
    const start = lokal(jetzt + 2 * 60 * 60 * 1000);
    const z = await zeitplan(routine.id, {
      zeitplan: { art: "ab_datum", start, zeitzone: "UTC" },
      eingaben: EINGABEN,
    });
    expect(z.statusCode, z.body).toBe(200);
    expect(await takt(jetzt)).toEqual([]);
    const spaeter = await takt(jetzt + 3 * 60 * 60 * 1000);
    expect(spaeter).toHaveLength(1);
    expect(spaeter[0]).toMatchObject({
      stand: "ausgefuehrt",
      termin: `zeitplan-ab-${start.replace(":", "-")}`,
    });
    expect(await takt(jetzt + 4 * 60 * 60 * 1000)).toEqual([]);
  });

  it("Z3 · wöchentlich: einmal_nachholen holt nach, auslassen nur pünktlich", async () => {
    const termin = Math.floor((Date.now() + 3 * TAG) / 60_000) * 60_000;
    const wochentag = ((new Date(termin).getUTCDay() + 6) % 7) + 1;
    const uhrzeit = lokal(termin).slice(11, 16);
    const woechentlich = (nachholen: string) => ({
      zeitplan: { art: "woechentlich", wochentag, uhrzeit, zeitzone: "UTC", nachholen },
      eingaben: EINGABEN,
    });

    const nachholen = await routineVormachen();
    expect((await zeitplan(nachholen.id, woechentlich("einmal_nachholen"))).statusCode).toBe(200);
    const auslassen = await routineVormachen();
    expect((await zeitplan(auslassen.id, woechentlich("auslassen"))).statusCode).toBe(200);

    // Eine Stunde nach dem Termin (z. B. Server war aus): nur `einmal_nachholen` läuft.
    const spaet = await takt(termin + 60 * 60 * 1000);
    expect(spaet.map((e) => [e.routineId, e.stand])).toEqual([[nachholen.id, "ausgefuehrt"]]);
    expect(spaet[0]?.termin).toBe(`zeitplan-w-${lokal(termin).slice(0, 10)}`);
    expect(await takt(termin + 61 * 60 * 1000)).toEqual([]);
    // Pünktlich (innerhalb der Toleranz) läuft auch `auslassen`.
    const puenktlich = await takt(termin + 30_000);
    expect(puenktlich.map((e) => [e.routineId, e.stand])).toEqual([[auslassen.id, "ausgefuehrt"]]);
  });

  it("Z4 · Pause: kein Lauf; ohne Anlagerecht abgelehnt und vermerkt", async () => {
    const routine = await routineVormachen();
    const sofort = { zeitplan: { art: "sofort" }, eingaben: EINGABEN };
    expect((await zeitplan(routine.id, sofort)).statusCode).toBe(200);
    expect((await zustand(routine.id, "pausiert")).statusCode).toBe(200);
    expect(await takt(Date.now())).toEqual([]);
    expect((await zustand(routine.id, "aktiv")).statusCode).toBe(200);

    const rolle = await auf(adminToken, "PUT", `/api/users/${erik.id}`, { role: "viewer" });
    expect(rolle.statusCode, rolle.body).toBe(200);
    const abgelehnt = await takt(Date.now() + 60_000);
    expect(abgelehnt).toHaveLength(1);
    expect(abgelehnt[0]).toMatchObject({ stand: "abgelehnt", grund: "nur_beobachtung" });
    expect(abgelehnt[0]?.auftragId).toBeUndefined();
    expect(await takt(Date.now() + 120_000)).toEqual([]);
  });

  it("Z5 · Zeitplan entfernt: kein Lauf; Zugangsdaten als Zeitplaneingabe abgewiesen", async () => {
    const routine = await routineVormachen();
    const token = ["eyJ", "a".repeat(8), ".", "b".repeat(8), ".", "c".repeat(8)].join("");
    const geheim = await zeitplan(routine.id, {
      zeitplan: { art: "sofort" },
      eingaben: { ...EINGABEN, titel: token },
    });
    expect(geheim.statusCode, geheim.body).toBe(400);
    const sofort = { zeitplan: { art: "sofort" }, eingaben: EINGABEN };
    expect((await zeitplan(routine.id, sofort)).statusCode).toBe(200);
    expect((await zeitplan(routine.id, { zeitplan: null })).statusCode).toBe(200);
    expect(await takt(Date.now())).toEqual([]);
  });

  it("Z7 · Abbruch zwischen Auftrag und Wirkung: derselbe Lauf wird später wieder aufgenommen", async () => {
    const routine = await routineVormachen();
    const jetzt = Date.now();
    const start = lokal(jetzt + 60 * 60 * 1000);
    const plan = { zeitplan: { art: "ab_datum", start, zeitzone: "UTC" }, eingaben: EINGABEN };
    expect((await zeitplan(routine.id, plan)).statusCode).toBe(200);
    // Der Auftrag entsteht, dann bricht der Lauf ab, bevor etwas wirkt (Laufsitzung nicht anlegbar).
    const ablage = services.sitzungsablage;
    if (!ablage) {
      throw new Error("Sitzungsablage fehlt");
    }
    vi.spyOn(ablage, "create").mockRejectedValueOnce(new Error("Ablage kurz nicht erreichbar"));
    const [abbruch] = await takt(jetzt + 2 * 60 * 60 * 1000);
    expect(abbruch).toMatchObject({ stand: "fehler", grund: "voruebergehend" });
    expect(await berichte(EINGABEN.titel)).toBe(0);

    // Pausiert wird auch ein offener Lauf nicht fortgesetzt.
    expect((await zustand(routine.id, "pausiert")).statusCode).toBe(200);
    expect(await takt(jetzt + 2 * TAG)).toEqual([]);
    expect((await zustand(routine.id, "aktiv")).statusCode).toBe(200);

    // Tage nach dem Termin: wieder aufgenommen, dieselbe Kennung, genau ein Auftrag, ein Bericht.
    const [weiter] = await takt(jetzt + 3 * TAG);
    expect(weiter).toMatchObject({
      stand: "ausgefuehrt",
      wiederaufnahme: true,
      termin: `zeitplan-ab-${start.replace(":", "-")}`,
    });
    const gid = weiter?.gespraech ?? "";
    const liste = await auf(erik.token, "GET", `/api/me/klara/gespraeche/${gid}/auftraege`);
    const auftraege = (liste.json() as { auftraege: KlaraAuftrag[] }).auftraege;
    expect(auftraege.map((a) => a.id)).toEqual([weiter?.auftragId]);
    expect(await berichte(EINGABEN.titel)).toBe(1);
    expect(await takt(jetzt + 4 * TAG)).toEqual([]);
  });

  it("Z8 · vorübergehender Ausführungsfehler: neuer Versuch, kein zweiter Bericht", async () => {
    const routine = await routineVormachen();
    const sofort = { zeitplan: { art: "sofort" }, eingaben: EINGABEN };
    expect((await zeitplan(routine.id, sofort)).statusCode).toBe(200);
    const fehler = new Error("Ablage kurz nicht erreichbar");
    vi.spyOn(services.capture, "createDraftVorgang").mockRejectedValueOnce(fehler);
    const [erst] = await takt(Date.now());
    expect(erst).toMatchObject({ stand: "offen", grund: "server" });
    expect(await berichte(EINGABEN.titel)).toBe(0);

    const [dann] = await takt(Date.now() + 60_000);
    expect(dann).toMatchObject({ stand: "ausgefuehrt", wiederaufnahme: true });
    expect(dann?.auftragId).toBe(erst?.auftragId);
    const gid = dann?.gespraech ?? "";
    const liste = await auf(erik.token, "GET", `/api/me/klara/gespraeche/${gid}/auftraege`);
    const auftraege = (liste.json() as { auftraege: KlaraAuftrag[] }).auftraege;
    expect(auftraege).toHaveLength(1);
    // Derselbe Schritt des Aktionskerns, neu begonnen und jetzt gespeichert (kein zweiter Schritt).
    const schritte = (auftraege[0]?.schritte ?? []).map((s) => [s.schluessel, s.stand]);
    expect(schritte).toEqual([["bericht-1", "gespeichert"]]);
    expect(await berichte(EINGABEN.titel)).toBe(1);
    expect(await takt(Date.now() + 120_000)).toEqual([]);
  });

  it("Z9 · vor der Wiederaufnahme gelten die Rechte von jetzt: abgelehnt, nichts wirkt", async () => {
    const routine = await routineVormachen();
    const sofort = { zeitplan: { art: "sofort" }, eingaben: EINGABEN };
    expect((await zeitplan(routine.id, sofort)).statusCode).toBe(200);
    const ablage = services.sitzungsablage;
    if (!ablage) {
      throw new Error("Sitzungsablage fehlt");
    }
    vi.spyOn(ablage, "create").mockRejectedValueOnce(new Error("Ablage kurz nicht erreichbar"));
    expect((await takt(Date.now()))[0]).toMatchObject({ stand: "fehler" });

    const rolle = await auf(adminToken, "PUT", `/api/users/${erik.id}`, { role: "viewer" });
    expect(rolle.statusCode, rolle.body).toBe(200);
    const [abgelehnt] = await takt(Date.now() + 60_000);
    expect(abgelehnt).toMatchObject({
      stand: "abgelehnt",
      grund: "nur_beobachtung",
      wiederaufnahme: true,
    });
    expect(await takt(Date.now() + 120_000)).toEqual([]);
    // Kein Bericht: direkt in der Entwurfsablage nachgesehen (Erik darf als Betrachter nicht listen).
    const eintraege = await services.capture.listDraftsForResume(erik.id, { mitPool: true });
    const titel = eintraege.map((e) => e.draft.payload.title);
    expect(titel).not.toContain(EINGABEN.titel);
  });

  it("Z10 · ohne Zeitsteuerung bleibt ein gescheiterter Schritt endgültig (Aktionskern unverändert)", async () => {
    const routine = await routineVormachen();
    const sofort = { zeitplan: { art: "sofort" }, eingaben: EINGABEN };
    expect((await zeitplan(routine.id, sofort)).statusCode).toBe(200);
    const fehler = new Error("Ablage kurz nicht erreichbar");
    vi.spyOn(services.capture, "createDraftVorgang").mockRejectedValueOnce(fehler);
    const [erst] = await takt(Date.now());
    expect(erst).toMatchObject({ stand: "offen", grund: "server" });
    // Der Klick der Person auf denselben Schritt führt nichts erneut aus.
    const gid = erst?.gespraech ?? "";
    const liste = await auf(erik.token, "GET", `/api/me/klara/gespraeche/${gid}/auftraege`);
    const auftrag = (liste.json() as { auftraege: KlaraAuftrag[] }).auftraege[0] as KlaraAuftrag;
    const pfad = `/api/me/klara/gespraeche/${gid}/auftraege/${auftrag.id}/schritte/bericht-1`;
    const klick = await auf(erik.token, "POST", `${pfad}/ausfuehrung`, {
      nr: 1,
      auftragFassung: auftrag.fassung,
    });
    expect(klick.statusCode, klick.body).toBe(200);
    const antwort = klick.json() as { wiederholt: boolean; schritt: { stand: string } };
    expect(antwort).toMatchObject({ wiederholt: true, schritt: { stand: "fehlgeschlagen" } });
    expect(await berichte(EINGABEN.titel)).toBe(0);
  });

  it("Z6 · ohne nötige Eingabe: abgelehnt vor der Wirkung, kein Bericht", async () => {
    const routine = await routineVormachen();
    const ohneInhalt = { zeitplan: { art: "sofort" }, eingaben: { titel: EINGABEN.titel } };
    expect((await zeitplan(routine.id, ohneInhalt)).statusCode).toBe(200);
    const [e] = await takt(Date.now());
    expect(e).toMatchObject({ stand: "abgelehnt", grund: "eingabe_fehlt" });
    expect(e?.ergebnisId).toBeUndefined();
  });
});
