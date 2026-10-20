// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · EQF-06-K03 / EQF-06-K10 (Aufnahme 16.10.2026)
// — KORREKTUR IN EIGENEN WORTEN MIT QUELLE, KORREKTUR EINER BESTÄTIGTEN ROUTINE ALS NEUE FASSUNG.
// ================================================================================================
//
// Rein (Deutung) und am ECHTEN Server (`buildApp(buildServices())`): zwei Vorführungen über den
// vorhandenen Entwurfsweg — das Fachgebiet nur in der zweiten (Entscheidungspunkt), wechselnde
// Prüfer (Empfänger).
//   D1 Deutung: „gilt nur heute“ → Einmaligkeit, „gehört immer dazu“ → Regel, „hier entscheide ich
//      selbst“ → Entscheidungspunkt; verneint, doppeldeutig oder ohne Bedeutung → Rückfrage.
//   K1 Vorschau: „Das gehört immer dazu“ macht den Entscheidungspunkt zum festen Schritt mit
//      EINGABE (kein Beispielwert); ein unklarer Satz wird nachgefragt, die gewählte Bedeutung
//      übernommen; jede Korrektur steht mit Wortlaut, Zeitpunkt und Schritt in Vorschau und Routine.
//   K2 Fassung: „Hier entscheide ich selbst“ an der bestätigten Routine wird Fassung 2 mit Quelle;
//      ein vorher angelegter Lauf bleibt an Fassung 1 gebunden und wirkt nicht mehr; eine Korrektur
//      auf veralteter Fassung wird abgewiesen; ein neuer Lauf folgt Fassung 2.
// Fiktive Konten und Daten, kein Modell. Wortlaute stehen nie im Prüfprotokoll.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import type { FunktionsSchritt } from "../../services/app/src/assistenz-lernen";
import { bedeutungAus, deuteKorrektur } from "../../services/app/src/assistenz-lernen-korrektur";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";

type App = ReturnType<typeof buildApp>;
type Methode = "GET" | "POST" | "PUT" | "DELETE";
type Konto = { id: string; token: string };
type Quelle = { bedeutung: string; wortlaut: string; am: string; schritt: string; nr: number };
type Ableitung = {
  parameter: { name: string; beschriftung: string; art: string }[];
  schritte: FunktionsSchritt[];
  erklaerung?: { ueberschrift: string; zeilen: string[] }[];
  korrekturen?: Quelle[];
};
type Vorschau = { stand: string; ableitung?: Ableitung };
type Version = { fassung: number; art: string; quelle: Quelle | null };
type RoutineSicht = { id: string; fassung: number; versionen: Version[] };

let app: App;
let services: ReturnType<typeof buildServices>;
let adminToken = "";
let erik: Konto;
let pruefer: [string, string];

const VORMACHEN = "/api/me/vormachen";
const WEB = "http://localhost/erfassen";

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

/** Zwei Vorführungen; Schritt 5 ist der Entscheidungspunkt „Fachgebiet“, Schritt 6 der Prüfer. */
async function zweiVorfuehrungen(): Promise<{ sitzung: string; vorschau: Vorschau }> {
  const start = await auf(erik.token, "POST", VORMACHEN, {
    host: "klarwerk_web",
    vorgaenge: ["entwurf_anlegen"],
    zweck: "Wöchentlichen Bericht vorbereiten",
  });
  expect(start.statusCode, start.body).toBe(201);
  const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
  await auf(erik.token, "GET", `${VORMACHEN}?anzeige=klarwerk_web`);
  const basis = { type: "best_practice", category: "Bericht" };
  const erste = {
    ...basis,
    title: "Wochenbericht KW40",
    statement: "Umsatz stabil",
    reviewerIds: [pruefer[0]],
  };
  const zweite = {
    ...basis,
    title: "Wochenbericht KW41",
    statement: "Umsatz gestiegen",
    domain: "Finanzen",
    reviewerIds: [pruefer[1]],
  };
  for (const demo of [erste, zweite]) {
    const r = await auf(erik.token, "POST", "/api/drafts", demo, WEB);
    expect(r.statusCode, r.body).toBeLessThan(300);
  }
  const v = await auf(erik.token, "GET", `${VORMACHEN}/${sitzung}/vorschau`);
  expect(v.statusCode, v.body).toBe(200);
  return { sitzung, vorschau: (v.json() as { vorschau: Vorschau }).vorschau };
}

function korrigiere(sitzung: string, ableitung: Record<string, unknown>) {
  return auf(erik.token, "PUT", `${VORMACHEN}/${sitzung}/korrektur`, { ableitung });
}

async function gespraech(): Promise<string> {
  const bezug = { pfad: "/erfassen", seitenName: "Erfassen", objekt: "Neuer Entwurf" };
  const r = await auf(erik.token, "POST", "/api/me/klara/gespraeche", { objektbezug: bezug });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: { id: string } }).gespraech.id;
}

async function berichte(titel: string): Promise<number> {
  const r = await auf(erik.token, "GET", "/api/drafts");
  expect(r.statusCode, r.body).toBe(200);
  const entwuerfe = r.json() as { payload?: { title?: string } }[];
  return entwuerfe.filter((d) => d.payload?.title === titel).length;
}

/** K1 als Ausgangslage für K2: „gehört immer dazu“ zu Schritt 5, Prüfer „nur dieses Mal“. */
async function korrigierteRoutine(): Promise<RoutineSicht> {
  const { sitzung } = await zweiVorfuehrungen();
  const regel = await korrigiere(sitzung, { nr: 5, satz: "Das gehört immer dazu" });
  expect(regel.statusCode, regel.body).toBe(200);
  const k = await korrigiere(sitzung, { nr: 6, satz: "Den Prüfer nur dieses Mal" });
  expect(k.statusCode, k.body).toBe(200);
  const stand = (k.json() as { vorschau: Vorschau }).vorschau.stand;
  const b = await auf(erik.token, "POST", `${VORMACHEN}/${sitzung}/bestaetigung`, { stand });
  expect(b.statusCode, b.body).toBe(201);
  const id = (b.json() as { routine: { id: string } }).routine.id;
  const liste = await auf(erik.token, "GET", VORMACHEN);
  const routinen = (liste.json() as { routinen: RoutineSicht[] }).routinen;
  const routine = routinen.find((r) => r.id === id);
  if (!routine) {
    throw new Error("Routine fehlt");
  }
  return routine;
}

beforeEach(async () => {
  services = buildServices();
  services.aiCheckWorker = stillerPruefjob();
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Fiktiv Admin", email: "admin@eqf06-korrektur.test", password: "secret123" },
  });
  adminToken = await anmelden("admin@eqf06-korrektur.test");
  const id = await kontoAnlegen("Fiktiv Erik", "erik@eqf06-korrektur.test");
  erik = { id, token: await anmelden("erik@eqf06-korrektur.test") };
  pruefer = [
    await kontoAnlegen("Fiktiv Prüferin A", "pruefer-a@eqf06-korrektur.test"),
    await kontoAnlegen("Fiktiv Prüfer B", "pruefer-b@eqf06-korrektur.test"),
  ];
});

describe("EQF-06-K03 · Deutung einer Korrektur in eigenen Worten", () => {
  it("D1 · drei Bedeutungen; verneint, doppeldeutig oder ohne Bedeutung wird nachgefragt", () => {
    expect(bedeutungAus("Das gilt nur heute")).toBe("einmaligkeit");
    expect(bedeutungAus("Ausnahmsweise, nur dieses Mal")).toBe("einmaligkeit");
    expect(bedeutungAus("Das gehört immer dazu")).toBe("regel");
    expect(bedeutungAus("Jedes Mal so machen")).toBe("regel");
    expect(bedeutungAus("Hier entscheide ich selbst")).toBe("entscheidungspunkt");
    expect(bedeutungAus("Das gilt nicht nur heute")).toBeNull();
    expect(bedeutungAus("Nur heute, aber eigentlich gehört es immer dazu")).toBeNull();
    expect(bedeutungAus("Hm, vielleicht")).toBeNull();

    const geschuetzt: FunktionsSchritt = { nr: 2, art: "entscheidung", frage: "geschützt" };
    const regel = deuteKorrektur("Gehört immer dazu", geschuetzt, "2026-10-16T09:00:00Z");
    // Ein Entscheidungspunkt ohne Vorlage (geschütztes Feld, unklare Handlung) wird nie fest.
    expect(regel).toMatchObject({ ok: false, grund: "nicht_moeglich" });
    const token = ["eyJ", "a".repeat(8), ".", "b".repeat(8), ".", "c".repeat(8)].join("");
    expect(deuteKorrektur(token, geschuetzt, "2026-10-16T09:00:00Z")).toMatchObject({
      ok: false,
      grund: "eingabe",
    });
  });
});

describe("EQF-06-K03/K10 · Korrektur am echten Server", () => {
  it("K1 · Vorschau: Regel wird fester Schritt mit Eingabe, Rückfrage bei Unklarheit, Quelle zugeordnet", async () => {
    const { sitzung, vorschau } = await zweiVorfuehrungen();
    expect(vorschau.ableitung?.schritte[4]?.art).toBe("entscheidung");

    // „Gehört immer dazu“: der Entscheidungspunkt „Fachgebiet“ wird fester Schritt — sein Wert
    // wird je Lauf erfragt, NICHT „Finanzen“ aus der einen Vorführung.
    const regel = await korrigiere(sitzung, { nr: 5, satz: "Das gehört immer dazu" });
    expect(regel.statusCode, regel.body).toBe(200);
    const nachRegel = (regel.json() as { vorschau: Vorschau }).vorschau.ableitung;
    expect(nachRegel?.schritte[4]).toMatchObject({
      nr: 5,
      art: "auswahl",
      ziel: { name: "Fachgebiet" },
      wert: { parameter: "fachgebiet" },
    });
    expect(nachRegel?.parameter).toContainEqual({
      name: "fachgebiet",
      beschriftung: "Fachgebiet",
      art: "text",
    });
    expect(JSON.stringify(nachRegel)).not.toContain("Finanzen");

    // Unklar: Rückfrage mit den drei Bedeutungen — geraten wird nicht.
    const unklar = await korrigiere(sitzung, { nr: 6, satz: "Hm, den Prüfer vielleicht" });
    expect(unklar.statusCode, unklar.body).toBe(422);
    expect(unklar.json()).toMatchObject({
      grund: "klaerung",
      klaerung: { nr: 6, optionen: ["einmaligkeit", "regel", "entscheidungspunkt"] },
    });
    // Die gewählte Bedeutung gilt — mit dem Satz der Person als Quelle.
    const gewaehlt = await korrigiere(sitzung, {
      nr: 6,
      satz: "Hm, den Prüfer vielleicht",
      bedeutung: "einmaligkeit",
    });
    expect(gewaehlt.statusCode, gewaehlt.body).toBe(200);
    const a = (gewaehlt.json() as { vorschau: Vorschau }).vorschau;
    expect(a.ableitung?.schritte.map((s) => s.ziel?.name ?? s.art)).not.toContain("Prüfer");
    const quellen = (a.ableitung?.korrekturen ?? []).map((q) => [
      q.nr,
      q.bedeutung,
      q.schritt,
      q.wortlaut,
    ]);
    expect(quellen).toEqual([
      [5, "regel", "Fachgebiet", "Das gehört immer dazu"],
      [6, "einmaligkeit", "Prüfer", "Hm, den Prüfer vielleicht"],
    ]);
    const erklaerung = a.ableitung?.erklaerung ?? [];
    const abschnitt = erklaerung.find((x) => x.ueberschrift === "Deine Korrekturen");
    expect(abschnitt?.zeilen.join(" ")).toContain("„Das gehört immer dazu“");

    // Bestätigt: die Routine trägt die Korrekturen mit Quelle, keinen Beispielwert.
    const b = await auf(erik.token, "POST", `${VORMACHEN}/${sitzung}/bestaetigung`, {
      stand: a.stand,
    });
    expect(b.statusCode, b.body).toBe(201);
    const routine = (b.json() as { routine: { ableitung: Ableitung } }).routine;
    const bedeutungen = routine.ableitung.korrekturen?.map((q) => q.bedeutung);
    expect(bedeutungen).toEqual(["regel", "einmaligkeit"]);
    // Die FUNKTION (Eingaben und Schritte der Ableitung) übernimmt den Beispielwert nicht — er wird
    // je Lauf erfragt. Die P06-Schrittbeschreibung nennt Ordnungsangaben dagegen bewusst mit Wert
    // („Fachgebiet „Finanzen““, vormachen-arbeitswege.ts, unverändert); sie ist keine Laufeingabe.
    expect(JSON.stringify(routine.ableitung)).not.toContain("Finanzen");
    const fachgebiet = routine.ableitung.schritte.find((s) => s.ziel?.name === "Fachgebiet");
    expect(fachgebiet?.wert).toEqual({ parameter: "fachgebiet" });
  });

  it("K2 · bestätigte Routine: Korrektur wird Fassung 2 mit Quelle, laufender Versuch bleibt gebunden", async () => {
    const routine = await korrigierteRoutine();
    expect(routine.fassung).toBe(1);
    const gid = await gespraech();
    const eingaben = { titel: "Wochenbericht KW43", inhalt: "Umsatz gehalten", fachgebiet: "IT" };
    // Ein Lauf an Fassung 1 ist angelegt, aber noch nicht ausgeführt.
    const lauf = await auf(erik.token, "POST", `${VORMACHEN}/routinen/${routine.id}/lauf`, {
      gespraech: gid,
      lauf: "lauf-k2",
      fassung: 1,
      eingaben,
    });
    expect(lauf.statusCode, lauf.body).toBe(201);
    const auftrag = (lauf.json() as { auftrag: KlaraAuftrag }).auftrag;

    // „Beachte meine heutige Korrektur künftig“: Kategorie (Schritt 4) entscheide ich selbst.
    const korrekturPfad = `${VORMACHEN}/routinen/${routine.id}/korrektur`;
    const satz = "Bei der Kategorie entscheide ich selbst";
    const k = await auf(erik.token, "POST", korrekturPfad, {
      fassung: 1,
      ableitung: { nr: 4, satz },
    });
    expect(k.statusCode, k.body).toBe(200);
    const antwort = k.json() as { routine: RoutineSicht; ableitung: Ableitung; korrektur: Quelle };
    const neu = antwort.routine;
    expect(neu.fassung).toBe(2);
    expect(antwort.korrektur).toMatchObject({ bedeutung: "entscheidungspunkt", wortlaut: satz });
    expect(neu.versionen).toEqual([
      {
        fassung: 2,
        am: expect.any(String),
        art: "als_entscheidung",
        quelle: expect.objectContaining({ bedeutung: "entscheidungspunkt", wortlaut: satz, nr: 4 }),
      },
    ]);
    expect(antwort.ableitung.schritte[3]?.art).toBe("entscheidung");
    // Die frühere Korrektur (aus der Vorschau) bleibt mit ihrer Quelle erhalten, die neue kommt dazu.
    expect(antwort.ableitung.korrekturen?.map((q) => q.bedeutung)).toEqual([
      "regel",
      "einmaligkeit",
      "entscheidungspunkt",
    ]);
    // Prüfprotokoll: Fassung und Art, nie der Wortlaut.
    const ereignisse = await services.audit.list({ action: "bpa06.routine.korrektur" });
    expect(ereignisse).toHaveLength(1);
    expect(JSON.stringify(ereignisse)).not.toContain(satz);

    // Wer noch Fassung 1 sieht, korrigiert nichts.
    const veraltet = await auf(erik.token, "POST", korrekturPfad, {
      fassung: 1,
      ableitung: { nr: 1, satz: "Das gilt nur heute" },
    });
    expect(veraltet.statusCode, veraltet.body).toBe(409);
    expect(veraltet.json()).toMatchObject({ grund: "stand_veraltet" });

    // Der an Fassung 1 gebundene Versuch wirkt nicht mehr — ausdrücklich, mit Grund.
    const pfad = `/api/me/klara/gespraeche/${gid}/auftraege/${auftrag.id}/schritte/bericht-1`;
    const alt = await auf(erik.token, "POST", `${pfad}/ausfuehrung`, {
      nr: 1,
      auftragFassung: auftrag.fassung,
    });
    expect(alt.statusCode, alt.body).toBe(409);
    expect(alt.body).toContain("inzwischen geändert");
    expect(await berichte("Wochenbericht KW43")).toBe(0);

    // Ein neuer Lauf folgt Fassung 2: er hält am neuen Entscheidungspunkt an.
    const neuerLauf = await auf(erik.token, "POST", `${VORMACHEN}/routinen/${routine.id}/lauf`, {
      gespraech: gid,
      lauf: "lauf-k2-neu",
      fassung: 2,
      eingaben,
    });
    expect(neuerLauf.statusCode, neuerLauf.body).toBe(409);
    expect(neuerLauf.json()).toMatchObject({ grund: "haelt_an", plan: { haltBei: 4 } });
  });
});
