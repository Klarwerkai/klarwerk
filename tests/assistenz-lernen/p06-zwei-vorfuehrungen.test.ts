// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 AC02 / BPA-S06 — ZWEI VORFÜHRUNGEN
// IM INTEGRIERTEN P06-PRODUKTWEG.
// ================================================================================================
//
// Bens Befund zu d06c8487: die Ableitung aus zwei unterschiedlichen Vorführungen war nur als
// Modullogik belegt. Hier der ganze Weg am ECHTEN Server (`buildApp(buildServices())`, `app.inject`):
//   1. P06-Lernsitzung in Klarwerk-Web, Lernanzeige sichtbar, ZWEI Berichte über den vorhandenen
//      Entwurfsweg angelegt (der Server schreibt mit): wechselnde Titel, Kernaussagen und Prüfer
//      (Empfänger), gleiche Art/Kategorie, das Fachgebiet nur in der zweiten Vorführung.
//   2. Vorschau mit Ableitung: Titel/Kernaussage/Prüfer werden Eingaben, gleiche Ordnungsangaben
//      Festwerte, das Fachgebiet ein Entscheidungspunkt. Korrektur vor der Bestätigung.
//   3. Bestätigte Routine trägt keinen Beispielwert; Lauf über `…/routinen/:id/lauf`:
//        F1 Entscheidungspunkt → 409 haelt_an, kein Auftrag;
//        F2 Entscheidung herausgenommen → hält am Prüfer (Empfänger, folgenreich), kein Auftrag;
//        F3 auch Prüfer herausgenommen → Bericht über den Aktionskern angelegt, nachgelesen, geprüft;
//           Startdatum gesetzt, Pause sperrt den nächsten Lauf.
// Fiktive Konten und Daten, kein Modell, kein Word-Host, keine Zeitsteuerung (AC05 bleibt offen).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import type { FunktionsSchritt, LaufPlan } from "../../services/app/src/assistenz-lernen";
import { pruefeEntwurf } from "../../services/app/src/assistenz-lernen-auftrag";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";
import { type ArbeitswegBeobachtung, VormachenDienst } from "../../services/app/src/vormachen";

type App = ReturnType<typeof buildApp>;
type Methode = "GET" | "POST" | "PUT" | "DELETE";
type Konto = { id: string; token: string };
type Ableitung = {
  vorfuehrungen: number;
  parameter: { name: string; beschriftung: string; art: string }[];
  schritte: FunktionsSchritt[];
  erklaerung?: { ueberschrift: string; zeilen: string[] }[];
};
type RoutineAntwort = { routine: { id: string; fassung: number; ableitung: Ableitung | null } };

let app: App;
let adminToken = "";
let erik: Konto;
let pruefer: [string, string, string];

const VORMACHEN = "/api/me/vormachen";
const WEB = "http://localhost/erfassen";
const DEMO = [
  { title: "Wochenbericht KW40 Musterfirma", statement: "Umsatz 120 Tsd stabil" },
  { title: "Wochenbericht KW41 Beispiel AG", statement: "Umsatz 135 Tsd gestiegen" },
] as const;
// Inhaltswerte der Vorführungen. Ordnungsangaben (Art, Kategorie, Fachgebiet) führt P06 bewusst
// mit Wert in der Schrittbeschreibung; sie sind keine Inhalte.
const DEMOWERTE = ["KW40", "KW41", "Musterfirma", "Beispiel AG", "120 Tsd", "135 Tsd"];

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

async function kontoAnlegen(name: string, email: string): Promise<string> {
  const r = await auf(adminToken, "POST", "/api/users", {
    name,
    email,
    password: "secret123",
    role: "experte",
  });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { id: string }).id;
}

/** Zwei Vorführungen über den vorhandenen Entwurfsweg; liefert Sitzung und Vorschau. */
async function zweiVorfuehrungen(wer: Konto) {
  const start = await auf(wer.token, "POST", VORMACHEN, {
    host: "klarwerk_web",
    vorgaenge: ["entwurf_anlegen"],
    zweck: "Wöchentlichen Bericht vorbereiten",
  });
  expect(start.statusCode, start.body).toBe(201);
  const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
  const anzeige = await auf(wer.token, "GET", `${VORMACHEN}?anzeige=klarwerk_web`);
  expect((anzeige.json() as { sichtbar: boolean }).sichtbar).toBe(true);

  const erste = await auf(
    wer.token,
    "POST",
    "/api/drafts",
    { ...DEMO[0], type: "best_practice", category: "Bericht", reviewerIds: [pruefer[0]] },
    WEB,
  );
  expect(erste.statusCode, erste.body).toBeLessThan(300);
  const zweite = await auf(
    wer.token,
    "POST",
    "/api/drafts",
    {
      ...DEMO[1],
      type: "best_practice",
      category: "Bericht",
      domain: "Finanzen",
      reviewerIds: [pruefer[1]],
    },
    WEB,
  );
  expect(zweite.statusCode, zweite.body).toBeLessThan(300);

  const v = await auf(wer.token, "GET", `${VORMACHEN}/${sitzung}/vorschau`);
  expect(v.statusCode, v.body).toBe(200);
  const vorschau = (v.json() as { vorschau: { stand: string; ableitung?: Ableitung } }).vorschau;
  return { sitzung, vorschau };
}

/** Die Ableitung ändern (Schritte herausnehmen) und den gezeigten Stand bestätigen. */
async function bestaetigeMit(wer: Konto, sitzung: string, stand: string, entfernen: number[]) {
  let aktuell = stand;
  for (const nr of entfernen) {
    const k = await auf(wer.token, "PUT", `${VORMACHEN}/${sitzung}/korrektur`, {
      ableitung: { art: "schritt_entfernen", nr },
    });
    expect(k.statusCode, k.body).toBe(200);
    aktuell = (k.json() as { vorschau: { stand: string } }).vorschau.stand;
  }
  const b = await auf(wer.token, "POST", `${VORMACHEN}/${sitzung}/bestaetigung`, {
    stand: aktuell,
  });
  expect(b.statusCode, b.body).toBe(201);
  const { routine } = b.json() as RoutineAntwort;
  return routine;
}

async function gespraech(wer: Konto): Promise<string> {
  const bezug = { pfad: "/erfassen", seitenName: "Erfassen", objekt: "Neuer Entwurf" };
  const r = await auf(wer.token, "POST", "/api/me/klara/gespraeche", { objektbezug: bezug });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: { id: string } }).gespraech.id;
}

function lauf(wer: Konto, routine: string, rumpf: Record<string, unknown>) {
  return auf(wer.token, "POST", `${VORMACHEN}/routinen/${routine}/lauf`, rumpf);
}

async function auftraegeIn(wer: Konto, gid: string): Promise<unknown[]> {
  const r = await auf(wer.token, "GET", `/api/me/klara/gespraeche/${gid}/auftraege`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { auftraege: unknown[] }).auftraege;
}

function ohneDemowerte(wert: unknown, auch: readonly string[] = []): void {
  const text = JSON.stringify(wert);
  for (const w of [...DEMOWERTE, pruefer[0], pruefer[1], ...auch]) {
    expect(text, w).not.toContain(w);
  }
}

beforeEach(async () => {
  const services = buildServices();
  services.aiCheckWorker = stillerPruefjob();
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Fiktiv Admin", email: "admin@bpa06-zwei.test", password: "secret123" },
  });
  adminToken = await anmelden("admin@bpa06-zwei.test");
  const id = await kontoAnlegen("Fiktiv Erik", "erik@bpa06-zwei.test");
  erik = { id, token: await anmelden("erik@bpa06-zwei.test") };
  pruefer = [
    await kontoAnlegen("Fiktiv Prüferin A", "pruefer-a@bpa06-zwei.test"),
    await kontoAnlegen("Fiktiv Prüfer B", "pruefer-b@bpa06-zwei.test"),
    await kontoAnlegen("Fiktiv Prüferin C", "pruefer-c@bpa06-zwei.test"),
  ];
});

describe("BPA-06 AC02 · zwei Vorführungen im P06-Produktweg", () => {
  it("Vorschau: wechselnde Werte und Empfänger werden Eingaben, Fachgebiet Entscheidungspunkt", async () => {
    const { vorschau } = await zweiVorfuehrungen(erik);
    const a = vorschau.ableitung;
    expect(a?.vorfuehrungen).toBe(2);
    expect(a?.parameter).toEqual([
      { name: "titel", beschriftung: "Titel", art: "text" },
      { name: "inhalt", beschriftung: "Kernaussage", art: "text" },
      { name: "pruefer", beschriftung: "Prüfer", art: "empfaenger" },
    ]);
    expect(a?.schritte.map((s) => [s.nr, s.art, s.ziel?.name ?? null, s.wert ?? null])).toEqual([
      [1, "eingabe", "Titel", { parameter: "titel" }],
      [2, "eingabe", "Kernaussage", { parameter: "inhalt" }],
      [3, "auswahl", "Art", { konstante: "best_practice" }],
      [4, "auswahl", "Kategorie", { konstante: "Bericht" }],
      [5, "entscheidung", null, null],
      [6, "senden", "Prüfer", { parameter: "pruefer" }],
      [7, "speichern", "Entwurf speichern", null],
    ]);
    expect(a?.schritte[4]?.frage).toContain("Fachgebiet");
    // AC03: Erklärung in einfacher Sprache mit Eingaben, Rechten und Haltepunkten.
    const ueberschriften = (a?.erklaerung ?? []).map((x) => x.ueberschrift);
    expect(ueberschriften).toContain("Deine Eingaben bei jedem Lauf");
    expect(ueberschriften).toContain("Hier entscheidest du selbst");
    // Kein Beispielwert und kein Empfänger der Vorführungen in der Vorschau.
    ohneDemowerte(a);
  });

  it("F1 · bestätigt mit Entscheidungspunkt: der Lauf hält dort an, nichts angelegt", async () => {
    const { sitzung, vorschau } = await zweiVorfuehrungen(erik);
    const routine = await bestaetigeMit(erik, sitzung, vorschau.stand, []);
    expect(routine.ableitung?.schritte).toHaveLength(7);
    ohneDemowerte(routine);
    const gid = await gespraech(erik);
    const eingaben = {
      titel: "Wochenbericht KW43",
      inhalt: "Umsatz gehalten",
      pruefer: pruefer[2],
    };
    const r = await lauf(erik, routine.id, {
      gespraech: gid,
      lauf: "lauf-f1",
      fassung: routine.fassung,
      eingaben,
    });
    expect(r.statusCode, r.body).toBe(409);
    const { grund, plan } = r.json() as { grund: string; plan: LaufPlan };
    expect(grund).toBe("haelt_an");
    expect(plan.stand).toBe("haelt_an");
    if (plan.stand !== "haelt_an") {
      return;
    }
    expect(plan.haltBei).toBe(5);
    expect(plan.schritte[0]?.wert).toBe("Wochenbericht KW43");
    expect(plan.schritte[4]?.grund).toContain("Fachgebiet");
    expect(await auftraegeIn(erik, gid)).toHaveLength(0);
  });

  it("F2 · Entscheidung herausgenommen: Prüfer kommt aus dem Lauf und hält als Außenwirkung an", async () => {
    const { sitzung, vorschau } = await zweiVorfuehrungen(erik);
    const routine = await bestaetigeMit(erik, sitzung, vorschau.stand, [5]);
    const gid = await gespraech(erik);
    const basis = { gespraech: gid, fassung: routine.fassung };
    // Ohne Empfänger kein Lauf: er wird nie aus einer Vorführung übernommen.
    const ohne = await lauf(erik, routine.id, {
      ...basis,
      lauf: "lauf-f2a",
      eingaben: { titel: "Wochenbericht KW43", inhalt: "Umsatz gehalten" },
    });
    expect(ohne.statusCode, ohne.body).toBe(409);
    expect((ohne.json() as { grund: string }).grund).toBe("eingabe_fehlt");
    const r = await lauf(erik, routine.id, {
      ...basis,
      lauf: "lauf-f2b",
      eingaben: { titel: "Wochenbericht KW43", inhalt: "Umsatz gehalten", pruefer: pruefer[2] },
    });
    expect(r.statusCode, r.body).toBe(409);
    const plan = (r.json() as { plan: LaufPlan }).plan;
    expect(plan.stand).toBe("haelt_an");
    if (plan.stand !== "haelt_an") {
      return;
    }
    const halt = plan.schritte[plan.schritte.length - 1];
    expect(halt).toMatchObject({ nr: 5, art: "senden", ausfuehrung: "angehalten" });
    expect(halt?.wert).toBe(pruefer[2]);
    expect(halt?.grund).toContain("wirkt nach außen");
    expect(await auftraegeIn(erik, gid)).toHaveLength(0);
  });

  it("F3 · korrigiert: Bericht mit Laufwerten angelegt und geprüft; ab Datum, Pause sperrt", async () => {
    const { sitzung, vorschau } = await zweiVorfuehrungen(erik);
    // Erst den Entscheidungspunkt (5), dann den nachgerückten Prüferschritt (wieder 5).
    const routine = await bestaetigeMit(erik, sitzung, vorschau.stand, [5, 5]);
    expect(routine.ableitung?.parameter.map((p) => p.name)).toEqual(["titel", "inhalt"]);
    const liste = await auf(erik.token, "GET", VORMACHEN);
    ohneDemowerte(liste.json(), ["Umsatz"]);

    const gid = await gespraech(erik);
    const r = await lauf(erik, routine.id, {
      gespraech: gid,
      lauf: "lauf-f3",
      fassung: routine.fassung,
      eingaben: { titel: "Wochenbericht KW43", inhalt: "Umsatz gehalten" },
    });
    expect(r.statusCode, r.body).toBe(201);
    const { auftrag, plan } = r.json() as { auftrag: KlaraAuftrag; plan: LaufPlan };
    expect(plan.stand).toBe("vollstaendig");

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
    // Nacharbeit 31: die bestätigten Festwerte stehen in IHREN Feldern, nicht im Text.
    expect(entwurf.payload.type).toBe("best_practice");
    expect(entwurf.payload.category).toBe("Bericht");
    expect(entwurf.payload.statement).not.toContain("Kategorie");
    ohneDemowerte(entwurf.payload);
    expect(pruefeEntwurf(plan, entwurf)).toEqual({ ok: true, abweichungen: [] });

    // Ab Datum (Zeitzone) an der Routine; Pause sperrt jeden weiteren Lauf.
    const zeitplan = { art: "ab_datum", start: "2026-10-19T08:00", zeitzone: "Europe/Berlin" };
    const z = await auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine.id}/zeitplan`, {
      zeitplan,
    });
    expect(z.statusCode, z.body).toBe(200);
    const p = await auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine.id}/zustand`, {
      zustand: "pausiert",
    });
    expect(p.statusCode, p.body).toBe(200);
    const pausiert = await lauf(erik, routine.id, {
      gespraech: gid,
      lauf: "lauf-f3-pause",
      fassung: routine.fassung,
      eingaben: { titel: "Wochenbericht KW44", inhalt: "Umsatz gehalten" },
    });
    expect(pausiert.statusCode, pausiert.body).toBe(409);
    expect((pausiert.json() as { grund: string }).grund).toBe("pausiert");
    expect(await auftraegeIn(erik, gid)).toHaveLength(1);
  });

  it("AC06 · Rohfelder bleiben in der Lernsitzung und fallen beim Abbruch weg", async () => {
    const dienst = new VormachenDienst();
    const s = dienst.starte("konto-roh", {
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen"],
      zweck: "Bericht",
      abbruchRegel: "lernnotiz_behalten",
    });
    expect(dienst.meldeSichtbar("konto-roh", "klarwerk_web", "c1")).toBe(true);
    const b: ArbeitswegBeobachtung = {
      host: "klarwerk_web",
      vorgang: "entwurf_anlegen",
      beschreibung: "Entwurf anlegen",
      rohwert: DEMO[0].title,
      felder: { ...DEMO[0], reviewerIds: pruefer[0] },
    };
    expect(dienst.beobachteArbeitsweg("konto-roh", b, "c1")).toBe(1);
    expect(dienst.brecheAb("konto-roh", s.id)).toMatchObject({
      rohdatenEntfernt: 1,
      notizBehalten: true,
    });
    const { sitzungen } = await dienst.uebersicht("konto-roh");
    expect(sitzungen).toHaveLength(1);
    ohneDemowerte(sitzungen);
  });

  it("Negativ · eine Änderung an einer nicht vorhandenen Ableitung wird abgewiesen", async () => {
    const start = await auf(erik.token, "POST", VORMACHEN, {
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen"],
      zweck: "Einzelner Bericht",
    });
    const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
    const k = await auf(erik.token, "PUT", `${VORMACHEN}/${sitzung}/korrektur`, {
      ableitung: { art: "schritt_entfernen", nr: 1 },
    });
    expect(k.statusCode, k.body).toBe(400);
  });
});
