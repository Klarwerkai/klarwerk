// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — P06-ROUTINE ÜBER DEN AKTIONSKERN.
// ================================================================================================
//
// Der ganze Produktweg am ECHTEN Server (`buildApp(buildServices())`, `app.inject`):
//   1. P06: Lernsitzung in Klarwerk-Web starten, Lernanzeige meldet sich sichtbar, vormachen über
//      die vorhandenen Entwurfswege (der Server schreibt mit), Vorschau, Bestätigung → Routine.
//   2. BPA-06: `POST /api/me/vormachen/routinen/:id/lauf` prüft den Lauf (`planeLauf`) und legt
//      über die Brücke einen gebundenen Klara-Auftrag im eigenen Gespräch an.
//   3. Klara 05: `POST …/schritte/:schluessel/ausfuehrung` führt ihn mit den Rechten der Person
//      über `/api/drafts` aus; nachgelesen über `GET /api/drafts/:id`.
// Fiktive Konten und Daten, kein Modell, kein Word-Host.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import type { LaufPlan } from "../../services/app/src/assistenz-lernen";
import { pruefeEntwurf } from "../../services/app/src/assistenz-lernen-auftrag";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";

type App = ReturnType<typeof buildApp>;
type Methode = "GET" | "POST" | "PUT" | "DELETE";
type Konto = { id: string; token: string };

let app: App;
let adminToken = "";
let erik: Konto;

const VORMACHEN = "/api/me/vormachen";
const WEB = "http://localhost/erfassen";
const DEMO_TITEL = "Wochenbericht KW41 Musterfirma";

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

/** P06: vormachen über die vorhandenen Entwurfswege, bestätigen — die Routine des Kontos. */
async function routineVormachen(wer: Konto, einreichen = false) {
  const vorgaenge = ["entwurf_anlegen", "entwurf_speichern"];
  const start = await auf(wer.token, "POST", VORMACHEN, {
    host: "klarwerk_web",
    vorgaenge: einreichen ? [...vorgaenge, "zur_pruefung_einreichen"] : vorgaenge,
    zweck: "Wöchentlichen Bericht vorbereiten",
  });
  expect(start.statusCode, start.body).toBe(201);
  const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
  // Die Lernanzeige dieses Clients meldet sich sichtbar (P06: Bedingung des Mitschreibens).
  const anzeige = await auf(wer.token, "GET", `${VORMACHEN}?anzeige=klarwerk_web`);
  expect((anzeige.json() as { sichtbar: boolean }).sichtbar).toBe(true);

  const angelegt = await auf(
    wer.token,
    "POST",
    "/api/drafts",
    {
      title: DEMO_TITEL,
      statement: "Umsatz stabil",
      type: "best_practice",
      category: "Vertrieb",
      confidentiality: "intern",
      bodyHtml: "<p>Fiktiver Bericht.</p>",
    },
    WEB,
  );
  expect(angelegt.statusCode, angelegt.body).toBeLessThan(300);
  const entwurfId = (angelegt.json() as { id: string }).id;
  const gespeichert = await auf(
    wer.token,
    "PUT",
    `/api/drafts/${entwurfId}`,
    { title: `${DEMO_TITEL} final` },
    WEB,
  );
  expect(gespeichert.statusCode, gespeichert.body).toBe(200);
  if (einreichen) {
    const operationId = "bpa06-einreichen-0001";
    const eingereicht = await auf(
      wer.token,
      "POST",
      `/api/drafts/${entwurfId}/promote`,
      { operationId },
      WEB,
    );
    expect(eingereicht.statusCode, eingereicht.body).toBe(201);
  }

  const vorschau = await auf(wer.token, "GET", `${VORMACHEN}/${sitzung}/vorschau`);
  expect(vorschau.statusCode, vorschau.body).toBe(200);
  const stand = (vorschau.json() as { vorschau: { stand: string } }).vorschau.stand;
  const bestaetigt = await auf(wer.token, "POST", `${VORMACHEN}/${sitzung}/bestaetigung`, {
    stand,
  });
  expect(bestaetigt.statusCode, bestaetigt.body).toBe(201);
  return (bestaetigt.json() as { routine: { id: string; fassung: number } }).routine;
}

async function gespraech(wer: Konto): Promise<string> {
  const bezug = { pfad: "/erfassen", seitenName: "Erfassen", objekt: "Neuer Entwurf" };
  const r = await auf(wer.token, "POST", "/api/me/klara/gespraeche", { objektbezug: bezug });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: { id: string } }).gespraech.id;
}

const EINGABEN = { titel: "Wochenbericht KW43", inhalt: "Umsatz gehalten" };

function lauf(wer: Konto, routine: string, rumpf: Record<string, unknown>) {
  return auf(wer.token, "POST", `${VORMACHEN}/routinen/${routine}/lauf`, rumpf);
}

beforeEach(async () => {
  const services = buildServices();
  services.aiCheckWorker = stillerPruefjob();
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Fiktiv Admin", email: "admin@bpa06-p06.test", password: "secret123" },
  });
  adminToken = await anmelden("admin@bpa06-p06.test");
  const angelegt = await auf(adminToken, "POST", "/api/users", {
    name: "Fiktiv Erik",
    email: "erik@bpa06-p06.test",
    password: "secret123",
    role: "experte",
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  erik = { id, token: await anmelden("erik@bpa06-p06.test") };
});

describe("BPA-06 · bestätigte P06-Routine läuft über den vorhandenen Aktionskern", () => {
  it("AC04/AC08: Lauf legt Auftrag an, Ausführung erstellt den Bericht, geprüft", async () => {
    const routine = await routineVormachen(erik);
    const gid = await gespraech(erik);
    const r = await lauf(erik, routine.id, {
      gespraech: gid,
      lauf: "lauf-1",
      fassung: routine.fassung,
      eingaben: EINGABEN,
    });
    expect(r.statusCode, r.body).toBe(201);
    const { auftrag, plan } = r.json() as { auftrag: KlaraAuftrag; plan: LaufPlan };
    expect(plan.stand).toBe("vollstaendig");
    expect(auftrag).toMatchObject({ verantwortlich: erik.id, geplanteSchritte: 1 });

    const pfad = `/api/me/klara/gespraeche/${gid}/auftraege/${auftrag.id}/schritte/bericht-1`;
    const ausgefuehrt = await auf(erik.token, "POST", `${pfad}/ausfuehrung`, {
      nr: 1,
      auftragFassung: auftrag.fassung,
    });
    expect(ausgefuehrt.statusCode, ausgefuehrt.body).toBe(200);
    const schritt = (ausgefuehrt.json() as { schritt: KlaraAuftrag["schritte"][number] }).schritt;
    expect(schritt.stand).toBe("gespeichert");
    const entwurfId = schritt.ergebnis?.id ?? "";
    const gelesen = await auf(erik.token, "GET", `/api/drafts/${entwurfId}`);
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    const entwurf = gelesen.json() as Parameters<typeof pruefeEntwurf>[1];
    expect(entwurf.payload.title).toBe("Wochenbericht KW43");
    expect(entwurf.payload.statement).toContain("Umsatz gehalten");
    expect(JSON.stringify(entwurf.payload)).not.toContain("KW41");
    expect(pruefeEntwurf(plan, entwurf)).toEqual({ ok: true, abweichungen: [] });
  });

  it("fremde Routine 404, falsche Fassung und Zugangsdaten als Eingabe ohne Auftrag", async () => {
    const routine = await routineVormachen(erik);
    const gid = await gespraech(erik);
    const rumpf = { gespraech: gid, lauf: "lauf-2", fassung: routine.fassung, eingaben: EINGABEN };
    const admin = { id: "", token: adminToken };
    expect((await lauf(admin, routine.id, rumpf)).statusCode).toBe(404);
    const alt = await lauf(erik, routine.id, { ...rumpf, fassung: routine.fassung + 1 });
    expect(alt.statusCode, alt.body).toBe(409);
    expect((alt.json() as { grund: string }).grund).toBe("fassung_geaendert");
    const token = ["eyJ", "a".repeat(8), ".", "b".repeat(8), ".", "c".repeat(8)].join("");
    const mitToken = { ...rumpf, eingaben: { ...EINGABEN, titel: token } };
    const geheim = await lauf(erik, routine.id, mitToken);
    expect(geheim.statusCode, geheim.body).toBe(409);
    expect((geheim.json() as { grund: string }).grund).toBe("zugangsdaten_als_eingabe");
    const auftraege = await auf(erik.token, "GET", `/api/me/klara/gespraeche/${gid}/auftraege`);
    expect((auftraege.json() as { auftraege: unknown[] }).auftraege).toHaveLength(0);
  });

  it("AC08: ohne Anlagerecht genügt Beobachten nicht — 403, kein Auftrag", async () => {
    const routine = await routineVormachen(erik);
    const rolle = await auf(adminToken, "PUT", `/api/users/${erik.id}`, { role: "viewer" });
    expect(rolle.statusCode, rolle.body).toBe(200);
    const viewer = { id: erik.id, token: await anmelden("erik@bpa06-p06.test") };
    const gid = await gespraech(viewer);
    const r = await lauf(viewer, routine.id, {
      gespraech: gid,
      lauf: "lauf-3",
      fassung: routine.fassung,
      eingaben: EINGABEN,
    });
    expect(r.statusCode, r.body).toBe(403);
    expect((r.json() as { grund: string }).grund).toBe("nur_beobachtung");
  });

  it("G12: dieselbe Laufkennung ergibt denselben Auftrag; Abweichendes abgewiesen", async () => {
    const routine = await routineVormachen(erik);
    const gid = await gespraech(erik);
    const rumpf = { gespraech: gid, lauf: "lauf-5", fassung: routine.fassung, eingaben: EINGABEN };
    const erster = await lauf(erik, routine.id, rumpf);
    expect(erster.statusCode, erster.body).toBe(201);
    const zweiter = await lauf(erik, routine.id, rumpf);
    expect(zweiter.statusCode, zweiter.body).toBe(200);
    const id = (r: typeof erster) => (r.json() as { auftrag: { id: string } }).auftrag.id;
    expect(id(zweiter)).toBe(id(erster));
    expect((zweiter.json() as { wiederholt: boolean }).wiederholt).toBe(true);
    // Gleiche Kennung, andere Eingaben oder anderes Gespräch: abgewiesen, nichts Neues.
    const anders = { ...rumpf, eingaben: { ...EINGABEN, titel: "Wochenbericht KW44" } };
    const widerspruch = await lauf(erik, routine.id, anders);
    expect(widerspruch.statusCode, widerspruch.body).toBe(409);
    expect((widerspruch.json() as { grund: string }).grund).toBe("lauf_widerspricht");
    const zweitesGespraech = await gespraech(erik);
    const umgezogen = { ...rumpf, gespraech: zweitesGespraech };
    const anderesGespraech = await lauf(erik, routine.id, umgezogen);
    expect(anderesGespraech.statusCode, anderesGespraech.body).toBe(409);
    const auftraege = await auf(erik.token, "GET", `/api/me/klara/gespraeche/${gid}/auftraege`);
    expect((auftraege.json() as { auftraege: unknown[] }).auftraege).toHaveLength(1);
  });

  it("AC09: pausierte Routine läuft nicht; fortgesetzt läuft sie wieder", async () => {
    const routine = await routineVormachen(erik);
    const zustand = `${VORMACHEN}/routinen/${routine.id}/zustand`;
    const pause = await auf(erik.token, "PUT", zustand, { zustand: "pausiert" });
    expect(pause.statusCode, pause.body).toBe(200);
    const liste = await auf(erik.token, "GET", VORMACHEN);
    const gelesen = (liste.json() as { routinen: { id: string; zustand: string }[] }).routinen;
    expect(gelesen.find((r) => r.id === routine.id)?.zustand).toBe("pausiert");
    const gid = await gespraech(erik);
    const rumpf = { gespraech: gid, lauf: "lauf-6", fassung: routine.fassung, eingaben: EINGABEN };
    const gesperrt = await lauf(erik, routine.id, rumpf);
    expect(gesperrt.statusCode, gesperrt.body).toBe(409);
    expect((gesperrt.json() as { grund: string }).grund).toBe("pausiert");
    expect((await auf(erik.token, "PUT", zustand, { zustand: "aktiv" })).statusCode).toBe(200);
    expect((await lauf(erik, routine.id, rumpf)).statusCode).toBe(201);
  });

  it("AC05: Zeitplan mit Zeitzone und Nachholregel an der Routine, Ungültiges abgewiesen", async () => {
    const routine = await routineVormachen(erik);
    const pfad = `${VORMACHEN}/routinen/${routine.id}/zeitplan`;
    const zeitplan = {
      art: "woechentlich",
      wochentag: 1,
      uhrzeit: "08:00",
      zeitzone: "Europe/Berlin",
      nachholen: "einmal_nachholen",
    };
    const falsch = await auf(erik.token, "PUT", pfad, {
      zeitplan: { ...zeitplan, zeitzone: "Mars/Olympus" },
    });
    expect(falsch.statusCode, falsch.body).toBe(400);
    const gesetzt = await auf(erik.token, "PUT", pfad, { zeitplan });
    expect(gesetzt.statusCode, gesetzt.body).toBe(200);
    const liste = await auf(erik.token, "GET", VORMACHEN);
    const routinen = (liste.json() as { routinen: { id: string; zeitplan: unknown }[] }).routinen;
    expect(routinen.find((r) => r.id === routine.id)?.zeitplan).toEqual(zeitplan);
  });

  it("AC09: Löschen verhindert künftige Läufe, der erstellte Bericht bleibt", async () => {
    const routine = await routineVormachen(erik);
    const gid = await gespraech(erik);
    const rumpf = { gespraech: gid, lauf: "lauf-7", fassung: routine.fassung, eingaben: EINGABEN };
    const r = await lauf(erik, routine.id, rumpf);
    const auftrag = (r.json() as { auftrag: KlaraAuftrag }).auftrag;
    const pfad = `/api/me/klara/gespraeche/${gid}/auftraege/${auftrag.id}/schritte/bericht-1`;
    const ausgefuehrt = await auf(erik.token, "POST", `${pfad}/ausfuehrung`, {
      nr: 1,
      auftragFassung: auftrag.fassung,
    });
    const schritt = (ausgefuehrt.json() as { schritt: KlaraAuftrag["schritte"][number] }).schritt;
    const entwurfId = schritt.ergebnis?.id ?? "";
    const geloescht = await app.inject({
      method: "DELETE",
      url: VORMACHEN,
      headers: { authorization: `Bearer ${erik.token}` },
    });
    expect(geloescht.statusCode, geloescht.body).toBe(200);
    const danach = await lauf(erik, routine.id, { ...rumpf, lauf: "lauf-8" });
    expect(danach.statusCode, danach.body).toBe(404);
    expect((await auf(erik.token, "GET", `/api/drafts/${entwurfId}`)).statusCode).toBe(200);
  });

  it("AC09: Pause oder Löschen NACH dem Anlegen sperrt die Ausführung; Fortsetzen gibt sie frei", async () => {
    const routine = await routineVormachen(erik);
    const gid = await gespraech(erik);
    const rumpf = { gespraech: gid, lauf: "lauf-9", fassung: routine.fassung, eingaben: EINGABEN };
    const angelegt = await lauf(erik, routine.id, rumpf);
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const auftrag = (angelegt.json() as { auftrag: KlaraAuftrag }).auftrag;
    // Die Herkunft steht strukturiert am Auftrag.
    expect(auftrag.herkunft).toMatchObject({
      art: "routine",
      eigentuemer: erik.id,
      routineId: routine.id,
      fassung: routine.fassung,
      lauf: "lauf-9",
    });
    const zustand = `${VORMACHEN}/routinen/${routine.id}/zustand`;
    expect((await auf(erik.token, "PUT", zustand, { zustand: "pausiert" })).statusCode).toBe(200);
    const schritt = `/api/me/klara/gespraeche/${gid}/auftraege/${auftrag.id}/schritte/bericht-1`;
    const ausfuehren = () =>
      auf(erik.token, "POST", `${schritt}/ausfuehrung`, { nr: 1, auftragFassung: auftrag.fassung });
    const gesperrt = await ausfuehren();
    expect(gesperrt.statusCode, gesperrt.body).toBe(409);
    expect((gesperrt.json() as { grund: string }).grund).toBe("herkunft_gesperrt");
    // Auch die Wiederholung des Laufs gibt den Auftrag während der Pause nicht heraus.
    const wieder = await lauf(erik, routine.id, rumpf);
    expect(wieder.statusCode, wieder.body).toBe(409);
    expect((wieder.json() as { grund: string }).grund).toBe("pausiert");
    // Fortsetzen: derselbe Auftrag wirkt jetzt.
    expect((await auf(erik.token, "PUT", zustand, { zustand: "aktiv" })).statusCode).toBe(200);
    const frei = await ausfuehren();
    expect(frei.statusCode, frei.body).toBe(200);
    const s = (frei.json() as { schritt: KlaraAuftrag["schritte"][number] }).schritt;
    expect(s.stand).toBe("gespeichert");

    // Ein zweiter, noch nicht ausgeführter Auftrag — dann die Routine löschen.
    const zweiter = await lauf(erik, routine.id, { ...rumpf, lauf: "lauf-10" });
    const a2 = (zweiter.json() as { auftrag: KlaraAuftrag }).auftrag;
    const geloescht = await app.inject({
      method: "DELETE",
      url: VORMACHEN,
      headers: { authorization: `Bearer ${erik.token}` },
    });
    expect(geloescht.statusCode, geloescht.body).toBe(200);
    const pfad2 = `/api/me/klara/gespraeche/${gid}/auftraege/${a2.id}/schritte/bericht-1`;
    const nachLoeschen = await auf(erik.token, "POST", `${pfad2}/ausfuehrung`, {
      nr: 1,
      auftragFassung: a2.fassung,
    });
    expect(nachLoeschen.statusCode, nachLoeschen.body).toBe(409);
    expect((nachLoeschen.json() as { grund: string }).grund).toBe("herkunft_gesperrt");
    // Das schon erstellte Ergebnis bleibt.
    const bleibt = await auf(erik.token, "GET", `/api/drafts/${s.ergebnis?.id ?? ""}`);
    expect(bleibt.statusCode).toBe(200);
  });

  it("G12: gleiche Laufkennung zweier Routinen im selben Gespräch — je eigener Auftrag", async () => {
    const erste = await routineVormachen(erik);
    const zweite = await routineVormachen(erik);
    const gid = await gespraech(erik);
    const rumpf = (fassung: number) => ({
      gespraech: gid,
      lauf: "lauf-x",
      fassung,
      eingaben: EINGABEN,
    });
    const a = await lauf(erik, erste.id, rumpf(erste.fassung));
    const b = await lauf(erik, zweite.id, rumpf(zweite.fassung));
    expect(a.statusCode, a.body).toBe(201);
    expect(b.statusCode, b.body).toBe(201);
    const auftragA = (a.json() as { auftrag: KlaraAuftrag }).auftrag;
    const auftragB = (b.json() as { auftrag: KlaraAuftrag }).auftrag;
    expect(auftragA.id).not.toBe(auftragB.id);
    expect(auftragA.herkunft?.routineId).toBe(erste.id);
    expect(auftragB.herkunft?.routineId).toBe(zweite.id);
    // Wiederholungen bleiben je Routine bei ihrem eigenen Auftrag.
    const wiederA = await lauf(erik, erste.id, rumpf(erste.fassung));
    expect((wiederA.json() as { auftrag: { id: string } }).auftrag.id).toBe(auftragA.id);
  });

  it("AC09: Routine mit Einreichen hält am Außenschritt — kein Auftrag", async () => {
    const routine = await routineVormachen(erik, true);
    const gid = await gespraech(erik);
    const r = await lauf(erik, routine.id, {
      gespraech: gid,
      lauf: "lauf-4",
      fassung: routine.fassung,
      eingaben: EINGABEN,
    });
    expect(r.statusCode, r.body).toBe(409);
    expect((r.json() as { grund: string }).grund).toBe("haelt_an");
    const auftraege = await auf(erik.token, "GET", `/api/me/klara/gespraeche/${gid}/auftraege`);
    expect((auftraege.json() as { auftraege: unknown[] }).auftraege).toHaveLength(0);
  });
});
