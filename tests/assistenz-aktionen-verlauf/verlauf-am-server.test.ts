// ================================================================================================
// produkt:20261010:assistenz-aktionen-verlauf-ruecknahme (PV-02) — GESPRÄCH, AKTION, PROTOKOLL UND
// RÜCKNAHME AM ECHTEN SERVER.
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`) —
// dieselbe Vorrichtung wie `tests/klara-aktionen/*-am-server.test.ts`. Jede Wirkung wird am
// vorhandenen Produktweg nachgelesen (`/api/drafts`, `/api/gaps`), jeder Protokolleintrag an der
// vorhandenen Kette (`services.audit`, `/api/audit`). Rollen, getrennt: Erik (Experte) gibt die
// Aufträge, Fiona (Expertin) ist eine fremde Person, Ada (Admin) führt die Aufgabenaktion aus und
// liest als Betreiberin mit ausdrücklich erteilter Ketteneinsicht das Prüfprotokoll. Alle Namen und
// Inhalte sind erfunden.
//
//   V1 · K1/K2/K3/K4/K7  ausgeführte und zurückgenommene Bearbeitung: Aktionskennung, vorheriger und
//                        neuer Stand, Prüfprotokoll ohne Inhalt, Rücknahme nach Neuladen als NEUE
//                        Fassung, Verlauf und Kette bleiben vollständig; fremde Person 404.
//   V2 · K5/K7           Versionskonflikt: nach einer Änderung im Editor überschreibt die Rücknahme
//                        nichts; der Konflikt nennt eigenen und aktuellen Stand und den Korrekturweg.
//   V3 · K1/K5           nicht rücknehmbare Aufgabenwirkung: Vertrag, Sichtbarkeit für andere,
//                        Arbeitsort — die Wirkung bleibt.
//   V4 · K6/K7           Doppelversuch (gleichzeitig) bei Ausführung und Rücknahme; Teilfehler und
//                        Abbruch behalten den tatsächlichen Stand, Wiederholung wirkt nicht doppelt.
//   V5 · K4              Rücknahme ohne Recht bzw. nicht mehr erreichbares Ziel: nichts geändert.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";

type App = ReturnType<typeof buildApp>;

let repos: ReturnType<typeof inMemoryRepos>;
let services: AppServices;
let app: App;
let ada = { id: "", token: "" };
let erik = { id: "", token: "" };
let fiona = { id: "", token: "" };
const KETTENEINSICHT_VORHER = process.env.KLARWERK_AUDIT_KETTENEINSICHT;

const BASIS = "/api/me/klara";
const BEZUG = { pfad: "/fragen", seitenName: "Fragen", objekt: "Noch keine Frage" };
const kurz = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Schritt = KlaraAuftrag["schritte"][number] & {
  aktionskennung: string;
  vertrag: string;
  ruecknahmeHinderung: string | null;
};
type AuftragSicht = Omit<KlaraAuftrag, "schritte"> & {
  ergebnisstand: string;
  schritte: Schritt[];
};
type SchrittAntwort = { auftrag: AuftragSicht; schritt: Schritt; wiederholt: boolean };

interface Entwurf {
  id: string;
  updatedAt: string;
  payload: { title?: string; statement?: string };
}

interface Protokoll {
  auftrag: string;
  aktionskennungen: string[];
  eintraege: { seq: number; at: string; action: string; payload: Record<string, unknown> }[];
}

const auf = (
  wer: string,
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: unknown,
) =>
  app.inject({
    method: methode,
    url,
    headers: wer ? { authorization: `Bearer ${wer}` } : {},
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const login = await auf("", "POST", "/api/auth/login", { email, password: "secret123" });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string) {
  const angelegt = await auf(ada.token, "POST", "/api/users", {
    name,
    email,
    password: "secret123",
    role: rolle,
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

async function gespraech(wer: string): Promise<string> {
  const r = await auf(wer, "POST", `${BASIS}/gespraeche`, { objektbezug: BEZUG });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: { id: string } }).gespraech.id;
}

async function auftrag(
  wer: string,
  gid: string,
  ziele: Record<string, unknown>[],
  plan: Record<string, unknown>[],
): Promise<AuftragSicht> {
  const r = await auf(wer, "POST", `${BASIS}/gespraeche/${gid}/auftraege`, {
    quelle: "getippt",
    wortlaut: "Fiktiver Auftrag „Pumpe P7“",
    ziel: "Fiktives Ziel",
    erlaubteAktionen: [...new Set(plan.map((p) => p.aktion as string))],
    erlaubteZiele: ziele,
    erlaubteQuellen: ["Deine Eingabe (getippt)"],
    ergebnis: "Am Server nachgelesen",
    geplanteSchritte: plan.length,
    plan,
  });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { auftrag: AuftragSicht }).auftrag;
}

function schrittPfad(gid: string, aid: string, schluessel: string): string {
  return `${BASIS}/gespraeche/${gid}/auftraege/${aid}/schritte/${schluessel}`;
}

async function fuehreAus(wer: string, gid: string, aid: string, schluessel: string, nr: number) {
  const r = await auf(wer, "POST", `${schrittPfad(gid, aid, schluessel)}/ausfuehrung`, {
    nr,
    auftragFassung: 1,
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as SchrittAntwort;
}

function ruecknahme(wer: string, gid: string, aid: string, schluessel: string) {
  return auf(wer, "POST", `${schrittPfad(gid, aid, schluessel)}/ruecknahme`, {});
}

/** „Neuladen“: die Aufträge des Gesprächs, wie der Server sie nach dem Neuladen liefert. */
async function neuGeladen(wer: string, gid: string, aid: string): Promise<AuftragSicht> {
  const r = await auf(wer, "GET", `${BASIS}/gespraeche/${gid}/auftraege`);
  expect(r.statusCode, r.body).toBe(200);
  const a = (r.json() as { auftraege: AuftragSicht[] }).auftraege.find((x) => x.id === aid);
  if (!a) {
    throw new Error("Auftrag fehlt nach dem Neuladen");
  }
  return a;
}

async function entwurf(wer: string, title: string, statement: string): Promise<Entwurf> {
  const r = await auf(wer, "POST", "/api/drafts", { title, statement });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as Entwurf;
}

async function entwurfLesen(wer: string, id: string): Promise<Entwurf> {
  const r = await auf(wer, "GET", `/api/drafts/${id}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Entwurf;
}

function bearbeitenPlan(d: Entwurf, text: string) {
  const ziel = { art: "entwurf", id: d.id, titel: d.payload.title, stand: d.updatedAt, pfad: null };
  const aenderung = { art: "ergaenzen", text };
  return {
    ziele: [ziel],
    plan: [{ aktion: "entwurf_bearbeiten", ziel, ausSchritt: null, aenderung }],
  };
}

const NEU = (titel: string) => ({ art: "neuer_entwurf", id: null, titel, stand: null, pfad: null });

beforeEach(async () => {
  repos = inMemoryRepos();
  services = assembleServices(repos);
  app = buildApp(services);
  await auf("", "POST", "/api/auth/register", {
    name: "Ada Admin",
    email: "ada@pv02.test",
    password: "secret123",
  });
  const adaToken = await anmelden("ada@pv02.test");
  ada = {
    id: ((await auf(adaToken, "GET", "/api/auth/me")).json() as { id: string }).id,
    token: adaToken,
  };
  erik = await konto("experte", "erik@pv02.test", "Erik Experte");
  fiona = await konto("experte", "fiona@pv02.test", "Fiona Fiktiv");
});

afterEach(() => {
  if (KETTENEINSICHT_VORHER === undefined) {
    delete process.env.KLARWERK_AUDIT_KETTENEINSICHT;
  } else {
    process.env.KLARWERK_AUDIT_KETTENEINSICHT = KETTENEINSICHT_VORHER;
  }
});

// ================================================================================================
describe("V1 · K1–K4/K7 — ausgeführt, nachgewiesen, nach dem Neuladen zurückgenommen", () => {
  it("Bearbeitung mit Aktionskennung, vorher/neu, Protokoll ohne Inhalt und Rücknahme als neue Fassung", async () => {
    const d = await entwurf(erik.token, "Pumpe P7 Wartung", "Basis.");
    const gid = await gespraech(erik.token);
    const { ziele, plan } = bearbeitenPlan(d, "Dichtung D2 prüfen");
    const a = await auftrag(erik.token, gid, ziele, plan);
    // K2: ein angelegter Auftrag ist ein Vorschlag — noch nichts ausgeführt.
    expect(a.ergebnisstand).toBe("vorschlag");
    expect(a.schritte).toEqual([]);

    await kurz(5);
    // K1: keine zusätzliche Bestätigung — die Ausführung ist EIN Aufruf der vorhandenen Tür.
    const r = await fuehreAus(erik.token, gid, a.id, "s-1", 1);
    expect(r.schritt).toMatchObject({
      stand: "gespeichert",
      ruecknehmbar: true,
      aktionskennung: `klara-auftrag-${a.id}-1`,
      vertrag: "entwurf_bearbeiten",
      ruecknahmeHinderung: null,
      vorherStand: d.updatedAt,
    });
    const nachher = await entwurfLesen(erik.token, d.id);
    expect(nachher.payload.statement).toBe("Basis. Dichtung D2 prüfen");
    // K3: der neue Stand ist der nachgelesene — und ein anderer als der vorherige.
    expect(r.schritt.ergebnis?.stand).toBe(nachher.updatedAt);
    expect(nachher.updatedAt).not.toBe(d.updatedAt);
    expect(r.auftrag.ergebnisstand).toBe("ausgefuehrt");
    // Nacharbeit 3 (Ben): der tatsächliche Inhalt vorher/neu steht am Schritt des eigenen Gesprächs.
    expect(r.schritt.vorher).toEqual({ title: "Pumpe P7 Wartung", statement: "Basis." });
    expect(r.schritt.nachher).toEqual({
      title: "Pumpe P7 Wartung",
      statement: "Basis. Dichtung D2 prüfen",
    });

    // K3: das Prüfprotokoll des eigenen Auftrags — Vorgang, Zeitpunkt, Identität, vorher/neu.
    const protokollPfad = `${BASIS}/gespraeche/${gid}/auftraege/${a.id}/protokoll`;
    const p = await auf(erik.token, "GET", protokollPfad);
    expect(p.statusCode, p.body).toBe(200);
    const protokoll = p.json() as Protokoll;
    expect(protokoll.aktionskennungen).toEqual([`klara-auftrag-${a.id}-1`]);
    const gespeichert = protokoll.eintraege.find(
      (e) => e.action === "klara.auftrag.schritt" && e.payload.stand === "gespeichert",
    );
    expect(gespeichert?.payload).toMatchObject({
      nr: 1,
      aktion: "entwurf_bearbeiten",
      gespraech: gid,
      aktionskennung: `klara-auftrag-${a.id}-1`,
      vertrag: "entwurf_bearbeiten",
      vorherStand: d.updatedAt,
      neuerStand: nachher.updatedAt,
      ergebnis: d.id,
    });
    expect(Number.isFinite(Date.parse(gespeichert?.at ?? ""))).toBe(true);
    // Vertrauliches bleibt draussen: kein Titel, kein Inhalt, kein Wortlaut.
    const roh = JSON.stringify(protokoll);
    for (const inhalt of ["Pumpe", "Dichtung", "Basis."]) {
      expect(roh).not.toContain(inhalt);
    }
    const ketteVorher = (await services.audit.list({})).map((e) => `${e.seq}|${e.hash}`);

    // K4: nach dem Neuladen ist die Rücknahme direkt erreichbar — am Server festgehalten.
    const geladen = await neuGeladen(erik.token, gid, a.id);
    expect(geladen.schritte[0]).toMatchObject({
      stand: "gespeichert",
      ruecknahmeHinderung: null,
      vorherStand: d.updatedAt,
    });
    // Getrennte Rolle: eine fremde Person sieht weder Auftrag noch Protokoll und nimmt nichts zurück.
    const fremd = await auf(fiona.token, "GET", protokollPfad);
    expect(fremd.statusCode).toBe(404);
    expect((await ruecknahme(fiona.token, gid, a.id, "s-1")).statusCode).toBe(404);
    expect((await entwurfLesen(erik.token, d.id)).payload.statement).toBe(
      "Basis. Dichtung D2 prüfen",
    );

    await kurz(5);
    const z = await ruecknahme(erik.token, gid, a.id, "s-1");
    expect(z.statusCode, z.body).toBe(200);
    const zurueck = z.json() as SchrittAntwort;
    const danach = await entwurfLesen(erik.token, d.id);
    expect(danach.payload.statement).toBe("Basis.");
    // Keine pauschale Wiederherstellung der alten Fassung: die Rücknahme ist eine NEUE Fassung.
    expect(danach.updatedAt).not.toBe(d.updatedAt);
    expect(danach.updatedAt).not.toBe(nachher.updatedAt);
    expect(zurueck.schritt).toMatchObject({
      stand: "zurueckgenommen",
      ruecknahmeStand: danach.updatedAt,
      ruecknahmeHinderung: "zurueckgenommen",
    });

    // Nach dem Neuladen: zurückgenommen — Verlauf und Verantwortung bleiben vollständig.
    const spaeter = await neuGeladen(erik.token, gid, a.id);
    expect(spaeter.ergebnisstand).toBe("zurueckgenommen");
    expect(spaeter.verantwortlich).toBe(erik.id);
    expect(spaeter.verlauf.map((v) => `${v.ereignis}${v.nr ?? ""}`)).toEqual([
      "vorgeschlagen",
      "begonnen1",
      "gespeichert1",
      "auftrag_abgeschlossen",
      "zurueckgenommen1",
    ]);
    expect(spaeter.schritte[0]?.ergebnis?.stand).toBe(nachher.updatedAt);
    // Kein Löschen der Auditspur: die Kette vor der Rücknahme steht unverändert am Anfang.
    const ketteNachher = (await services.audit.list({})).map((e) => `${e.seq}|${e.hash}`);
    expect(ketteNachher.slice(0, ketteVorher.length)).toEqual(ketteVorher);
    const ruecknahmeEintrag = (await services.audit.list({ target: `klara-auftrag:${a.id}` })).find(
      (e) => e.payload.stand === "zurueckgenommen",
    );
    expect(ruecknahmeEintrag?.payload).toMatchObject({
      aktionskennung: `klara-auftrag-${a.id}-1`,
      vorherStand: nachher.updatedAt,
      neuerStand: danach.updatedAt,
    });
    expect(ruecknahmeEintrag?.actor).toBe(erik.id);

    // Eine zweite Rücknahme ist dieselbe — nichts geschieht doppelt, nichts kommt ins Protokoll.
    const anzahl = (await services.audit.list({})).length;
    const nochmal = await ruecknahme(erik.token, gid, a.id, "s-1");
    expect(nochmal.statusCode, nochmal.body).toBe(200);
    expect((nochmal.json() as SchrittAntwort).wiederholt).toBe(true);
    expect((await services.audit.list({})).length).toBe(anzahl);

    // Getrennte Rolle: die Betreiberin mit erteilter Ketteneinsicht liest dieselben Einträge in der
    // vorhandenen Verwalteransicht — mit Kennungen, ohne Inhalt.
    process.env.KLARWERK_AUDIT_KETTENEINSICHT = ada.id;
    const verwaltung = await auf(ada.token, "GET", "/api/audit?action=klara.auftrag.schritt");
    expect(verwaltung.statusCode, verwaltung.body).toBe(200);
    const eintraege = verwaltung.json() as { actor: string; payload: Record<string, unknown> }[];
    expect(
      eintraege
        .filter((e) => e.payload.aktionskennung === `klara-auftrag-${a.id}-1`)
        .map((e) => e.payload.stand),
    ).toEqual(["gespeichert", "zurueckgenommen"]);
    expect(eintraege.every((e) => e.actor === erik.id)).toBe(true);
    expect(JSON.stringify(eintraege)).not.toContain("Dichtung");
  });

  it("ein angelegter Entwurf: vorher „gab es nicht“, Rücknahme in den Papierkorb, nach Neuladen", async () => {
    const gid = await gespraech(erik.token);
    const ziel = NEU("Lager L4 Prüfplan");
    const a = await auftrag(erik.token, gid, [ziel], [{ aktion: "entwurf_erstellen", ziel }]);
    const r = await fuehreAus(erik.token, gid, a.id, "s-1", 1);
    expect(r.schritt).toMatchObject({ stand: "gespeichert", vertrag: "entwurf_erstellen" });
    expect(r.schritt.vorherStand ?? null).toBeNull();
    const id = r.schritt.ergebnis?.id as string;
    await neuGeladen(erik.token, gid, a.id);
    const z = await ruecknahme(erik.token, gid, a.id, "s-1");
    expect(z.statusCode, z.body).toBe(200);
    expect((z.json() as SchrittAntwort).schritt.ruecknahmeStand).toBe("papierkorb");
    expect((await auf(erik.token, "GET", `/api/drafts/${id}`)).statusCode).toBe(404);
    const korb = (await auf(erik.token, "GET", "/api/drafts/trash")).json() as { id: string }[];
    expect(korb.map((x) => x.id)).toContain(id);
    expect((await neuGeladen(erik.token, gid, a.id)).ergebnisstand).toBe("zurueckgenommen");
  });
});

// ================================================================================================
describe("V2 · K5/K7 — Versionskonflikt: die Rücknahme überschreibt keine neue Fassung", () => {
  it("nach einer Änderung im Editor: 409 mit eigenem und aktuellem Stand, Korrekturweg, Protokoll", async () => {
    const d = await entwurf(erik.token, "Ventil V3", "Basis.");
    const gid = await gespraech(erik.token);
    const { ziele, plan } = bearbeitenPlan(d, "Sitz prüfen");
    const a = await auftrag(erik.token, gid, ziele, plan);
    await kurz(5);
    const r = await fuehreAus(erik.token, gid, a.id, "s-1", 1);
    const klarasStand = r.schritt.ergebnis?.stand as string;

    // Die konkurrierende Fassung: im vorhandenen Editor weiterbearbeitet (zweiter Tab).
    await kurz(5);
    const weiter = await auf(erik.token, "PUT", `/api/drafts/${d.id}`, {
      statement: "Basis. Sitz prüfen. Feder tauschen.",
      expectedUpdatedAt: klarasStand,
    });
    expect(weiter.statusCode, weiter.body).toBe(200);
    const aktuell = await entwurfLesen(erik.token, d.id);

    const k = await ruecknahme(erik.token, gid, a.id, "s-1");
    expect(k.statusCode).toBe(409);
    const antwort = k.json() as { grund: string; konflikt: Record<string, unknown> };
    expect(antwort.grund).toBe("geaendert");
    expect(antwort.konflikt).toMatchObject({
      aktionskennung: `klara-auftrag-${a.id}-1`,
      eigenerStand: klarasStand,
      aktuellerStand: aktuell.updatedAt,
      korrekturweg: "entwurf",
      pfad: `/erfassen?draft=${encodeURIComponent(d.id)}`,
    });
    // Die neuere Fassung bleibt, der Schritt bleibt gespeichert.
    const noch = await entwurfLesen(erik.token, d.id);
    expect(noch.payload.statement).toBe("Basis. Sitz prüfen. Feder tauschen.");
    expect(noch.updatedAt).toBe(aktuell.updatedAt);
    expect((await neuGeladen(erik.token, gid, a.id)).schritte[0]?.stand).toBe("gespeichert");
    // Die Ablehnung steht im Protokoll — mit Ständen, ohne Inhalt.
    const abgelehnt = await services.audit.list({ action: "klara.auftrag.ruecknahme-abgelehnt" });
    expect(abgelehnt).toHaveLength(1);
    expect(abgelehnt[0]).toMatchObject({
      actor: erik.id,
      target: `klara-auftrag:${a.id}`,
      payload: {
        gespraech: gid,
        grund: "geaendert",
        aktionskennung: `klara-auftrag-${a.id}-1`,
        eigenerStand: klarasStand,
        aktuellerStand: aktuell.updatedAt,
      },
    });
    expect(JSON.stringify(abgelehnt)).not.toContain("Feder");

    // Der Korrekturweg ist der vorhandene Editor: dort korrigiert die Person selbst.
    const korrigiert = await auf(erik.token, "PUT", `/api/drafts/${d.id}`, {
      statement: "Basis. Feder tauschen.",
      expectedUpdatedAt: aktuell.updatedAt,
    });
    expect(korrigiert.statusCode, korrigiert.body).toBe(200);
  });
});

// ================================================================================================
describe("V3 · K1/K5 — nicht rücknehmbare Wirkung wird zutreffend benannt", () => {
  it("Priorität einer Lücke: vorher/neu nachgewiesen, Rücknahme abgelehnt mit Arbeitsort", async () => {
    await repos.gaps.insert({
      id: "gap-pv02-1",
      question: "Wie oft wird Filter F9 gewechselt?",
      status: "offen",
      assignee: null,
      priority: "mittel",
      createdAt: new Date().toISOString(),
    });
    const ziel = {
      art: "aufgabe",
      id: "gap-pv02-1",
      titel: "Wie oft wird Filter F9 gewechselt?",
      stand: null,
      pfad: "/risiko?fall=gap-pv02-1",
    };
    const gid = await gespraech(ada.token);
    const a = await auftrag(
      ada.token,
      gid,
      [ziel],
      [
        {
          aktion: "aufgabe_bearbeiten",
          ziel,
          ausSchritt: null,
          aufgabenaktion: { art: "prioritaet", wert: "hoch" },
        },
      ],
    );
    const r = await fuehreAus(ada.token, gid, a.id, "s-1", 1);
    expect(r.schritt).toMatchObject({
      stand: "gespeichert",
      vertrag: "aufgabe_prioritaet",
      vorherStand: "prioritaet:mittel nicht_zugewiesen",
      ergebnis: { stand: "prioritaet:hoch" },
      ruecknahmeHinderung: "nicht_ruecknehmbar",
    });
    const k = await ruecknahme(ada.token, gid, a.id, "s-1");
    expect(k.statusCode).toBe(409);
    expect(k.json()).toMatchObject({
      grund: "nicht_ruecknehmbar",
      konflikt: {
        vertrag: "aufgabe_prioritaet",
        fuerAndereSichtbar: true,
        korrekturweg: "luecke",
        pfad: "/risiko?fall=gap-pv02-1",
      },
    });
    const luecken = (await auf(ada.token, "GET", "/api/gaps")).json() as {
      id: string;
      priority: string;
    }[];
    expect(luecken.find((g) => g.id === "gap-pv02-1")?.priority).toBe("hoch");
    const schritte = await services.audit.list({ target: `klara-auftrag:${a.id}` });
    expect(schritte.find((e) => e.payload.stand === "gespeichert")?.payload).toMatchObject({
      vorherStand: "prioritaet:mittel nicht_zugewiesen",
      neuerStand: "prioritaet:hoch",
    });
  });
});

// ================================================================================================
describe("V4 · K6/K7 — Doppelversuch, Teilfehler und Abbruch behalten den tatsächlichen Stand", () => {
  it("zwei gleichzeitige Ausführungen und Rücknahmen desselben Schritts wirken genau einmal", async () => {
    const d = await entwurf(erik.token, "Kupplung K5", "Basis.");
    const gid = await gespraech(erik.token);
    const { ziele, plan } = bearbeitenPlan(d, "Spiel prüfen");
    const a = await auftrag(erik.token, gid, ziele, plan);
    await kurz(5);
    const [eins, zwei] = await Promise.all([
      fuehreAus(erik.token, gid, a.id, "s-1", 1),
      fuehreAus(erik.token, gid, a.id, "s-1", 1),
    ]);
    expect([eins.schritt.stand, zwei.schritt.stand]).toEqual(["gespeichert", "gespeichert"]);
    expect([eins.wiederholt, zwei.wiederholt].sort()).toEqual([false, true]);
    const jetzt = await entwurfLesen(erik.token, d.id);
    expect(jetzt.payload.statement?.split("Spiel prüfen")).toHaveLength(2);
    const gespeichert = (await services.audit.list({ target: `klara-auftrag:${a.id}` })).filter(
      (e) => e.payload.stand === "gespeichert",
    );
    expect(gespeichert).toHaveLength(1);

    await kurz(5);
    const zurueck = await Promise.all([
      ruecknahme(erik.token, gid, a.id, "s-1"),
      ruecknahme(erik.token, gid, a.id, "s-1"),
    ]);
    expect(zurueck.map((x) => x.statusCode)).toEqual([200, 200]);
    expect(zurueck.map((x) => (x.json() as SchrittAntwort).wiederholt).sort()).toEqual([
      false,
      true,
    ]);
    expect((await entwurfLesen(erik.token, d.id)).payload.statement).toBe("Basis.");
    const zurueckgenommen = (await services.audit.list({ target: `klara-auftrag:${a.id}` })).filter(
      (e) => e.payload.stand === "zurueckgenommen",
    );
    expect(zurueckgenommen).toHaveLength(1);
  });

  it("Teilfehler: Schritt 1 bleibt gespeichert und rücknehmbar, Schritt 2 scheitert ehrlich", async () => {
    const weg = await entwurf(erik.token, "Gleich weg", "Basis.");
    const gid = await gespraech(erik.token);
    const neu = NEU("Teilfehler Eins");
    const zielWeg = {
      art: "entwurf",
      id: weg.id,
      titel: "Gleich weg",
      stand: weg.updatedAt,
      pfad: null,
    };
    const a = await auftrag(
      erik.token,
      gid,
      [neu, zielWeg],
      [
        { aktion: "entwurf_erstellen", ziel: neu, ausSchritt: null },
        {
          aktion: "entwurf_bearbeiten",
          ziel: zielWeg,
          ausSchritt: null,
          aenderung: { art: "ergaenzen", text: "Nie geschrieben" },
        },
      ],
    );
    const s1 = await fuehreAus(erik.token, gid, a.id, "s-1", 1);
    expect(s1.schritt.stand).toBe("gespeichert");
    // Das Ziel von Schritt 2 verschwindet vor seiner Ausführung (Papierkorb).
    expect((await auf(erik.token, "DELETE", `/api/drafts/${weg.id}`)).statusCode).toBe(204);
    const s2 = await fuehreAus(erik.token, gid, a.id, "s-2", 2);
    expect(s2.schritt).toMatchObject({ stand: "fehlgeschlagen", fehlerCode: "nichtGefunden" });
    expect(s2.auftrag.ergebnisstand).toBe("teilweise");

    // Wiederholung beider Schritte: derselbe Stand, keine zweite Wirkung.
    const anzahl = (await services.audit.list({})).length;
    expect((await fuehreAus(erik.token, gid, a.id, "s-1", 1)).wiederholt).toBe(true);
    expect((await fuehreAus(erik.token, gid, a.id, "s-2", 2)).schritt.stand).toBe("fehlgeschlagen");
    expect((await services.audit.list({})).length).toBe(anzahl);
    const titel = ((await auf(erik.token, "GET", "/api/drafts")).json() as Entwurf[]).map(
      (x) => x.payload.title,
    );
    expect(titel).toEqual(["Teilfehler Eins"]);

    // Nach dem Neuladen: teilweise — Schritt 1 nicht als ungeschehen, weiter rücknehmbar.
    const geladen = await neuGeladen(erik.token, gid, a.id);
    expect(geladen.ergebnisstand).toBe("teilweise");
    expect(geladen.schritte.map((s) => [s.nr, s.stand, s.ruecknahmeHinderung])).toEqual([
      [1, "gespeichert", null],
      [2, "fehlgeschlagen", "nicht_gespeichert"],
    ]);
  });

  it("Abbruch nach Schritt 1: kein Schritt 2, Gespeichertes bleibt — Ergebnis „teilweise“", async () => {
    const gid = await gespraech(erik.token);
    const eins = NEU("Abbruch Eins");
    const zwei = NEU("Abbruch Zwei");
    const a = await auftrag(
      erik.token,
      gid,
      [eins, zwei],
      [
        { aktion: "entwurf_erstellen", ziel: eins, ausSchritt: null },
        { aktion: "entwurf_erstellen", ziel: zwei, ausSchritt: null },
      ],
    );
    await fuehreAus(erik.token, gid, a.id, "s-1", 1);
    const abbruchPfad = `${BASIS}/gespraeche/${gid}/auftraege/${a.id}/abbruch`;
    const abbruch = await auf(erik.token, "PUT", abbruchPfad, {});
    expect(abbruch.statusCode, abbruch.body).toBe(200);
    const s2 = await auf(erik.token, "POST", `${schrittPfad(gid, a.id, "s-2")}/ausfuehrung`, {
      nr: 2,
      auftragFassung: 1,
    });
    expect(s2.statusCode).toBe(409);
    expect((s2.json() as { grund: string }).grund).toBe("abgebrochen");
    const geladen = await neuGeladen(erik.token, gid, a.id);
    expect(geladen.ergebnisstand).toBe("teilweise");
    expect(geladen.schritte.map((s) => s.stand)).toEqual(["gespeichert"]);
    const titel = ((await auf(erik.token, "GET", "/api/drafts")).json() as Entwurf[]).map(
      (x) => x.payload.title,
    );
    expect(titel).toEqual(["Abbruch Eins"]);
  });
});

// ================================================================================================
describe("V5 · K4 — vor der Rücknahme aktuelle Rechte und Ziel prüfen", () => {
  it("ein inzwischen gelöschter Entwurf: „nicht mehr erreichbar“, nichts geändert, Schritt bleibt", async () => {
    const d = await entwurf(erik.token, "Riemen R8", "Basis.");
    const gid = await gespraech(erik.token);
    const { ziele, plan } = bearbeitenPlan(d, "Spannung prüfen");
    const a = await auftrag(erik.token, gid, ziele, plan);
    await kurz(5);
    await fuehreAus(erik.token, gid, a.id, "s-1", 1);
    expect((await auf(erik.token, "DELETE", `/api/drafts/${d.id}`)).statusCode).toBe(204);
    const k = await ruecknahme(erik.token, gid, a.id, "s-1");
    expect(k.statusCode).toBe(409);
    expect((k.json() as { grund: string }).grund).toBe("ziel_fehlt");
    expect((await neuGeladen(erik.token, gid, a.id)).schritte[0]?.stand).toBe("gespeichert");
    const korb = (await auf(erik.token, "GET", "/api/drafts/trash")).json() as Entwurf[];
    expect(korb.find((x) => x.id === d.id)?.payload.statement).toBe("Basis. Spannung prüfen");
  });
});
