// ================================================================================================
// produkt:20261010:assistenz-aktionen-verlauf-ruecknahme (PV-02) · Nacharbeit 3 — GESPRÄCH, AKTION,
// PROTOKOLL UND RÜCKNAHME ÜBERSTEHEN DEN NEUSTART AUF ECHTEM POSTGRESQL.
// ================================================================================================
//
// Bens Befund: `verlauf-am-server.test.ts` liest nach dem „Neuladen“ aus derselben In-Memory-App —
// das belegt Wiederlesen, keine dauerhafte Speicherung. Hier läuft DIESELBE App (`buildApp`) auf
// `buildPgServices(pool)` gegen echtes PostgreSQL mit dem echten `migrate()`. Jede Phase ist ein
// eigener „Server“: neuer Pool, neue App, neue Anmeldung; die vorige App ist geschlossen. Was nach
// dem Neustart dasteht, stand also in den Tabellen (Gespräche, Entwürfe, Prüfprotokoll).
//
//   P1 · K3/K4/K7  ausgeführt → NEUSTART → Aktionskennung, vorher/neu (Stände und Inhalt),
//                  Ergebnisstand und Protokolleinträge aus der Datenbank → Rücknahme → NEUSTART →
//                  zurückgenommen samt Rücknahmestand und vollständiger Kette.
//   P2 · K5/K7     ausgeführt → Änderung im Editor → NEUSTART → Rücknahme abgelehnt (Konflikt mit
//                  beiden Ständen) → NEUSTART → neuere Fassung unverändert, Schritt gespeichert,
//                  Ablehnung im Protokoll.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Name mit „test“, `guardedLocalPgTestUrl`) — darauf legt
// die Datei eine EIGENE frische Datenbank an (das erste Konto einer frischen Instanz ist Admin) und
// räumt sie am Ende ab; sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf mit Grund —
// kein stiller Skip, kein Grün ohne Datenbank.
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

type App = ReturnType<typeof buildApp>;
type Dienste = ReturnType<typeof buildPgServices>;

type Schritt = KlaraAuftrag["schritte"][number] & {
  aktionskennung: string;
  ruecknahmeHinderung: string | null;
};
type AuftragSicht = Omit<KlaraAuftrag, "schritte"> & {
  ergebnisstand: string;
  schritte: Schritt[];
};
interface Entwurf {
  id: string;
  updatedAt: string;
  payload: { title?: string; statement?: string };
}
interface Protokoll {
  eintraege: { seq: number; action: string; payload: Record<string, unknown> }[];
}

const BASIS = "/api/me/klara";
const BEZUG = { pfad: "/fragen", seitenName: "Fragen", objekt: "Noch keine Frage" };
const KENNWORT = "secret123";
const ADA = "ada@pv02-pg.test";
const ERIK = "erik@pv02-pg.test";
const kurz = (ms: number) => new Promise((r) => setTimeout(r, ms));

let container: StartedTestContainer | undefined;
let url = "";
/** Die eigens angelegte Datenbank auf einem vorgegebenen Server — am Ende wieder entfernt. */
let eigeneDb: { verwaltung: string; name: string } | null = null;
let erikId = "";

/** Ein laufender „Server“: eigener Pool, eigene App. */
interface Server {
  app: App;
  dienste: Dienste;
  pool: Pool;
}

async function starte(): Promise<Server> {
  const pool = createPool(url);
  const dienste = buildPgServices(pool);
  const app = buildApp(dienste);
  await app.ready();
  return { app, dienste, pool };
}

async function stoppe(s: Server): Promise<void> {
  await s.app.close();
  await s.pool.end().catch(() => undefined);
}

function auf(s: Server, wer: string, methode: "GET" | "POST" | "PUT" | "DELETE", pfad: string) {
  return (payload?: unknown) =>
    s.app.inject({
      method: methode,
      url: pfad,
      headers: wer ? { authorization: `Bearer ${wer}` } : {},
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
}

async function anmelden(s: Server, email: string): Promise<string> {
  const r = await auf(s, "", "POST", "/api/auth/login")({ email, password: KENNWORT });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { token: string }).token;
}

async function auftraege(s: Server, wer: string, gid: string): Promise<AuftragSicht[]> {
  const r = await auf(s, wer, "GET", `${BASIS}/gespraeche/${gid}/auftraege`)();
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { auftraege: AuftragSicht[] }).auftraege;
}

async function protokoll(s: Server, wer: string, gid: string, aid: string): Promise<Protokoll> {
  const r = await auf(s, wer, "GET", `${BASIS}/gespraeche/${gid}/auftraege/${aid}/protokoll`)();
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Protokoll;
}

async function entwurfLesen(s: Server, wer: string, id: string): Promise<Entwurf> {
  const r = await auf(s, wer, "GET", `/api/drafts/${id}`)();
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Entwurf;
}

function schrittPfad(gid: string, aid: string, schluessel: string): string {
  return `${BASIS}/gespraeche/${gid}/auftraege/${aid}/schritte/${schluessel}`;
}

/** Erik legt einen Entwurf an, gibt den Auftrag „ergänze …“ und lässt ihn am Server ausführen. */
async function bearbeitet(s: Server, wer: string, gid: string, titel: string, text: string) {
  const neu = await auf(s, wer, "POST", "/api/drafts")({ title: titel, statement: "Basis." });
  expect(neu.statusCode, neu.body).toBe(201);
  const d = neu.json() as Entwurf;
  const ziel = { art: "entwurf", id: d.id, titel, stand: d.updatedAt, pfad: null };
  const angelegt = await auf(
    s,
    wer,
    "POST",
    `${BASIS}/gespraeche/${gid}/auftraege`,
  )({
    quelle: "getippt",
    wortlaut: `Ergänze im Entwurf „${titel}“: ${text}`,
    ziel: `Entwurf „${titel}“ bearbeiten`,
    erlaubteAktionen: ["entwurf_bearbeiten"],
    erlaubteZiele: [ziel],
    erlaubteQuellen: ["Deine Eingabe (getippt)"],
    ergebnis: "Am Server nachgelesen",
    geplanteSchritte: 1,
    plan: [
      {
        aktion: "entwurf_bearbeiten",
        ziel,
        ausSchritt: null,
        aenderung: { art: "ergaenzen", text },
      },
    ],
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const aid = (angelegt.json() as { auftrag: { id: string } }).auftrag.id;
  await kurz(5);
  const r = await auf(
    s,
    wer,
    "POST",
    `${schrittPfad(gid, aid, "s-1")}/ausfuehrung`,
  )({
    nr: 1,
    auftragFassung: 1,
  });
  expect(r.statusCode, r.body).toBe(200);
  expect((r.json() as { schritt: { stand: string } }).schritt.stand).toBe("gespeichert");
  return { d, aid };
}

/** Eine frische Datenbank auf dem vorgegebenen Server; der Name enthält „test“. */
async function frischeDatenbank(lokal: string): Promise<string> {
  const teile = /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(lokal);
  if (!teile) {
    throw new Error("KLARWERK_PG_TEST_URL ist nicht lesbar — keine eigene Datenbank anlegbar.");
  }
  const name = `klarwerk_test_pv02_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const verwaltung = createPool(lokal);
  try {
    await verwaltung.query(`CREATE DATABASE "${name}"`);
  } catch (cause) {
    throw new Error("Auf KLARWERK_PG_TEST_URL lässt sich keine eigene Testdatenbank anlegen.", {
      cause,
    });
  } finally {
    await verwaltung.end();
  }
  eigeneDb = { verwaltung: lokal, name };
  return `${teile[1]}${name}${teile[3]}`;
}

beforeAll(async () => {
  const lokal = guardedLocalPgTestUrl();
  if (lokal) {
    url = await frischeDatenbank(lokal);
  } else if (process.env.KLARWERK_PG_TEST_URL) {
    throw new Error("KLARWERK_PG_TEST_URL abgelehnt (Grund auf stderr) — kein Container-Rückfall");
  } else {
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
    } catch (cause) {
      throw new Error("Weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar", {
        cause,
      });
    }
    url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
  }
  const pool = createPool(url);
  try {
    await migrate(pool);
  } finally {
    await pool.end();
  }
  // Die Konten — über den echten Weg: das erste Konto der frischen Instanz ist Admin, es legt Erik an.
  const s = await starte();
  try {
    const reg = await auf(
      s,
      "",
      "POST",
      "/api/auth/register",
    )({
      name: "Ada Admin",
      email: ADA,
      password: KENNWORT,
    });
    expect(reg.statusCode, reg.body).toBe(201);
    const ada = await anmelden(s, ADA);
    const erik = await auf(
      s,
      ada,
      "POST",
      "/api/users",
    )({
      name: "Erik Experte",
      email: ERIK,
      password: KENNWORT,
      role: "experte",
    });
    expect(erik.statusCode, erik.body).toBe(201);
    erikId = (erik.json() as { id: string }).id;
  } finally {
    await stoppe(s);
  }
}, 180_000);

afterAll(async () => {
  await container?.stop();
  if (eigeneDb) {
    const verwaltung = createPool(eigeneDb.verwaltung);
    try {
      await verwaltung.query(`DROP DATABASE IF EXISTS "${eigeneDb.name}" WITH (FORCE)`);
    } finally {
      await verwaltung.end();
    }
  }
});

describe("PV-02 · Nacharbeit 3 — der Zusammenhang übersteht den Neustart auf PostgreSQL", () => {
  it("P1 · ausgeführt → Neustart → Nachweis und Protokoll aus der Datenbank → Rücknahme → Neustart", async () => {
    // --- Server 1: ausführen ---------------------------------------------------------------
    const s1 = await starte();
    const erik1 = await anmelden(s1, ERIK);
    const g = await auf(s1, erik1, "POST", `${BASIS}/gespraeche`)({ objektbezug: BEZUG });
    expect(g.statusCode, g.body).toBe(201);
    const gid = (g.json() as { gespraech: { id: string } }).gespraech.id;
    const { d, aid } = await bearbeitet(s1, erik1, gid, "Pumpe P11", "Dichtung D4 prüfen");
    const nachher = await entwurfLesen(s1, erik1, d.id);
    await stoppe(s1);

    // --- Server 2: alles aus der Datenbank, dann zurücknehmen -------------------------------
    const s2 = await starte();
    const erik2 = await anmelden(s2, ERIK);
    const [a] = await auftraege(s2, erik2, gid);
    expect(a?.id).toBe(aid);
    expect(a?.ergebnisstand).toBe("ausgefuehrt");
    expect(a?.verantwortlich).toBe(erikId);
    expect(a?.schritte[0]).toMatchObject({
      stand: "gespeichert",
      aktionskennung: `klara-auftrag-${aid}-1`,
      ruecknahmeHinderung: null,
      vorherStand: d.updatedAt,
      vorher: { title: "Pumpe P11", statement: "Basis." },
      nachher: { title: "Pumpe P11", statement: "Basis. Dichtung D4 prüfen" },
      ergebnis: { id: d.id, stand: nachher.updatedAt },
    });
    const p2 = await protokoll(s2, erik2, gid, aid);
    expect(p2.eintraege.find((e) => e.payload.stand === "gespeichert")?.payload).toMatchObject({
      gespraech: gid,
      aktionskennung: `klara-auftrag-${aid}-1`,
      vorherStand: d.updatedAt,
      neuerStand: nachher.updatedAt,
    });
    expect(JSON.stringify(p2)).not.toContain("Dichtung");
    const ketteVorher = (await s2.dienste.audit.list({})).map((e) => `${e.seq}|${e.hash}`);
    await kurz(5);
    const z = await auf(s2, erik2, "POST", `${schrittPfad(gid, aid, "s-1")}/ruecknahme`)({});
    expect(z.statusCode, z.body).toBe(200);
    const zurueck = await entwurfLesen(s2, erik2, d.id);
    expect(zurueck.payload.statement).toBe("Basis.");
    await stoppe(s2);

    // --- Server 3: zurückgenommen, Verlauf und Kette vollständig ------------------------------
    const s3 = await starte();
    const erik3 = await anmelden(s3, ERIK);
    const [b] = await auftraege(s3, erik3, gid);
    expect(b?.ergebnisstand).toBe("zurueckgenommen");
    expect(b?.schritte[0]).toMatchObject({
      stand: "zurueckgenommen",
      ruecknahmeStand: zurueck.updatedAt,
      ruecknahmeHinderung: "zurueckgenommen",
      vorher: { statement: "Basis." },
      nachher: { statement: "Basis. Dichtung D4 prüfen" },
    });
    expect(b?.verlauf.map((v) => `${v.ereignis}${v.nr ?? ""}`)).toEqual([
      "vorgeschlagen",
      "begonnen1",
      "gespeichert1",
      "auftrag_abgeschlossen",
      "zurueckgenommen1",
    ]);
    const p3 = await protokoll(s3, erik3, gid, aid);
    expect(
      p3.eintraege.filter((e) => e.action === "klara.auftrag.schritt").map((e) => e.payload.stand),
    ).toEqual(["gespeichert", "zurueckgenommen"]);
    expect(p3.eintraege.find((e) => e.payload.stand === "zurueckgenommen")?.payload).toMatchObject({
      aktionskennung: `klara-auftrag-${aid}-1`,
      vorherStand: nachher.updatedAt,
      neuerStand: zurueck.updatedAt,
    });
    const ketteNachher = (await s3.dienste.audit.list({})).map((e) => `${e.seq}|${e.hash}`);
    expect(ketteNachher.slice(0, ketteVorher.length)).toEqual(ketteVorher);
    expect((await s3.dienste.audit.verifyReport()).ok).toBe(true);
    await stoppe(s3);
  }, 120_000);

  it("P2 · konkurrierende Fassung → Neustart → Rücknahme abgelehnt → Neustart → nichts überschrieben", async () => {
    const s1 = await starte();
    const erik1 = await anmelden(s1, ERIK);
    const g = await auf(s1, erik1, "POST", `${BASIS}/gespraeche`)({ objektbezug: BEZUG });
    const gid = (g.json() as { gespraech: { id: string } }).gespraech.id;
    const { d, aid } = await bearbeitet(s1, erik1, gid, "Ventil V9", "Sitz prüfen");
    const klaras = await entwurfLesen(s1, erik1, d.id);
    // Die konkurrierende Fassung: im vorhandenen Editor weiterbearbeitet.
    await kurz(5);
    const weiter = await auf(
      s1,
      erik1,
      "PUT",
      `/api/drafts/${d.id}`,
    )({
      statement: "Basis. Sitz prüfen. Feder tauschen.",
      expectedUpdatedAt: klaras.updatedAt,
    });
    expect(weiter.statusCode, weiter.body).toBe(200);
    const aktuell = await entwurfLesen(s1, erik1, d.id);
    await stoppe(s1);

    const s2 = await starte();
    const erik2 = await anmelden(s2, ERIK);
    const k = await auf(s2, erik2, "POST", `${schrittPfad(gid, aid, "s-1")}/ruecknahme`)({});
    expect(k.statusCode).toBe(409);
    expect(k.json()).toMatchObject({
      grund: "geaendert",
      konflikt: {
        aktionskennung: `klara-auftrag-${aid}-1`,
        eigenerStand: klaras.updatedAt,
        aktuellerStand: aktuell.updatedAt,
        korrekturweg: "entwurf",
      },
    });
    await stoppe(s2);

    const s3 = await starte();
    const erik3 = await anmelden(s3, ERIK);
    const noch = await entwurfLesen(s3, erik3, d.id);
    expect(noch.payload.statement).toBe("Basis. Sitz prüfen. Feder tauschen.");
    expect(noch.updatedAt).toBe(aktuell.updatedAt);
    const [a] = await auftraege(s3, erik3, gid);
    expect(a?.schritte[0]?.stand).toBe("gespeichert");
    const p = await protokoll(s3, erik3, gid, aid);
    const abgelehnt = p.eintraege.filter((e) => e.action === "klara.auftrag.ruecknahme-abgelehnt");
    expect(abgelehnt).toHaveLength(1);
    expect(abgelehnt[0]?.payload).toMatchObject({
      gespraech: gid,
      grund: "geaendert",
      eigenerStand: klaras.updatedAt,
      aktuellerStand: aktuell.updatedAt,
    });
    expect(JSON.stringify(p)).not.toContain("Feder");
    await stoppe(s3);
  }, 120_000);
});
