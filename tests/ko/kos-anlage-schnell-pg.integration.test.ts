// ================================================================================================
// arbeit:kos-anlage-500-pg-20260930 · K2/K3 — SCHNELL NACHEINANDER ANLEGEN, UNTER POSTGRESQL.
// ================================================================================================
//
// DER BEFUND (Ben, Prüfauftrag pa-1790659426-c146cfc5 an 532a3bb1): `POST /api/kos` antwortete
// beim VIERTEN schnell aufeinanderfolgenden Anlegen unter PostgreSQL mit
// `500 {"error":"INTERNAL","message":"Unerwarteter Fehler."}`; mit Speicherablage liefen dieselben
// Anlagen mit 201 durch. Vermutet, nicht belegt: die Hintergrund-KI-Prüfung, die nach der 201
// weiterläuft, kollidiert mit der nächsten Anlage.
//
// DIESER LAUF IST DIE REPRODUKTION UND ZUGLEICH DER NACHWEIS:
//   · echter Server (`listen`, echte HTTP-Anfragen), echte Route, echte Kompositionswurzel
//     (`buildPgServices` + `migrate`) gegen eine isolierte PostgreSQL (`pg-pruefplatz.ts`:
//     `KLARWERK_PG_TEST_URL`, sonst Testcontainer, sonst rot — kein Skip);
//   · ANLAGEN Anlagen unmittelbar nacheinander, OHNE auf den Leerlauf der KI-Prüfung zu warten;
//     dass sie wirklich lief, während die nächste Anlage kam, wird gemessen (Warteschlange > 0);
//   · scheitert eine Anlage, nennt die Fehlermeldung des Tests den technischen Code (SQLSTATE) und
//     die Stapelrahmen aus der Logzeile des Auffangzweigs (K1) — die Ursache steht dann im Lauf.
//
// Die Bilanz jedes Laufs steht zusätzlich auf stderr (`[KLARWERK] kos-anlage-pg …`), damit auch ein
// grüner Lauf belegt, was gemessen wurde (Statusfolge, Warteschlange, Auffangzeilen).
import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices, createPool, migrate } from "../../services/app";
import { type IsoliertePg, oeffneIsoliertePg } from "./pg-pruefplatz";

const PREFIX = "[KLARWERK] kos-anlage-pg";
const ANLAGEN = 12;
const MELDUNG = "Unerwarteter Fehler ohne Domänencode (HTTP 500 INTERNAL).";

interface Zeile {
  level: number;
  msg?: string;
  reqId?: string;
  code?: string;
  stapel?: string[];
  err?: { type?: string; code?: string; herkunft?: string };
}

const stuecke: string[] = [];
const senke = {
  write(zeile: string): void {
    stuecke.push(zeile);
  },
};
function logzeilen(): Zeile[] {
  return stuecke
    .join("")
    .split("\n")
    .filter((z) => z.trim().length > 0)
    .map((z) => JSON.parse(z) as Zeile);
}

// Ähnliche Texte in derselben Kategorie: die Erkennung im Hintergrund findet Vergleichspartner und
// arbeitet wirklich (Kandidaten, Überschneidungen, Belege), statt sofort leer fertig zu sein.
const KO = (i: number) => ({
  confidentiality: "intern",
  title: `Dichtung an Pumpe ${i} prüfen`,
  statement: `Vor jedem Anlauf der Pumpe die Dichtung auf Risse prüfen und bei Bedarf tauschen (${i}).`,
  type: "best_practice",
  category: "Instandhaltung",
  tags: ["pumpe", "dichtung"],
});

describe("arbeit:kos-anlage-500-pg · schnelle Anlagen unter PostgreSQL während laufender KI-Prüfung", () => {
  let pg: IsoliertePg | undefined;
  let pool: Pool | undefined;
  let services: ReturnType<typeof buildPgServices> | undefined;
  let app: FastifyInstance | undefined;
  let basis = "";
  let kopf: Record<string, string> = {};

  beforeAll(async () => {
    pg = await oeffneIsoliertePg("kosanlage");
    // Derselbe Vorrat wie im Betrieb (`createPool` → `vorratsKonfiguration`).
    pool = createPool(pg.url);
    await migrate(pool);
    services = buildPgServices(pool);
    app = buildApp(services, { log: { senke, stufe: "info" } });
    await app.listen({ port: 0, host: "127.0.0.1" });
    basis = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    const reg = await fetch(`${basis}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Admin", email: "kosanlage@x.de", password: "secret123" }),
    });
    expect(reg.status, await reg.clone().text()).toBe(201);
    const login = await fetch(`${basis}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "kosanlage@x.de", password: "secret123" }),
    });
    expect(login.status).toBe(200);
    const { token } = (await login.json()) as { token: string };
    kopf = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  }, 180_000);

  afterAll(async () => {
    await services?.aiCheckWorker?.idle();
    await app?.close().catch(() => undefined);
    await pool?.end().catch(() => undefined);
    await pg?.abraeumen();
  });

  it(`${ANLAGEN} Anlagen unmittelbar nacheinander über die echte Route: alle 201, keine 500`, async () => {
    const worker = services?.aiCheckWorker;
    expect(worker, "die Kompositionswurzel hat keinen KI-Prüf-Worker verdrahtet").toBeDefined();
    const ergebnisse: { nr: number; status: number; body: string; warteschlange: number }[] = [];
    for (let i = 1; i <= ANLAGEN; i += 1) {
      const res = await fetch(`${basis}/api/kos`, {
        method: "POST",
        headers: kopf,
        body: JSON.stringify(KO(i)),
      });
      ergebnisse.push({
        nr: i,
        status: res.status,
        body: (await res.text()).slice(0, 200),
        // Gemessen direkt nach der Antwort — VOR der nächsten Anlage, ohne zu warten.
        warteschlange: worker?.queuedCount() ?? 0,
      });
    }

    const auffang = logzeilen().filter((z) => z.msg === MELDUNG);
    const bilanz = {
      status: ergebnisse.map((e) => e.status),
      warteschlange: ergebnisse.map((e) => e.warteschlange),
      auffangzeilen: auffang.map((z) => ({
        reqId: z.reqId,
        code: z.code,
        type: z.err?.type,
        stapel: z.stapel,
      })),
    };
    process.stderr.write(`${PREFIX} · Bilanz ${JSON.stringify(bilanz)}\n`);

    // Der Lauf prüft nur dann etwas, wenn die KI-Prüfung wirklich lief, während die nächste Anlage
    // kam — sonst wäre ein grünes Ergebnis die Messung eines anderen Falls.
    expect(
      Math.max(...bilanz.warteschlange),
      "keine KI-Prüfung lief während der Anlagen — der Fall wurde nicht hergestellt",
    ).toBeGreaterThanOrEqual(1);

    const gescheitert = ergebnisse.filter((e) => e.status !== 201);
    expect(
      gescheitert,
      `gescheiterte Anlagen ${JSON.stringify(gescheitert)} · Auffangzeilen (Code/Stapel) ${JSON.stringify(bilanz.auffangzeilen)}`,
    ).toEqual([]);
    expect(auffang, "der Auffangzweig von sendError hat geschrieben").toEqual([]);
  });

  it("nach dem Leerlauf der KI-Prüfung: jedes Objekt im Bestand, je genau ein ko.created", async () => {
    await services?.aiCheckWorker?.idle();
    const p = pool as Pool;
    const bestand = await p.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM kos WHERE data->>'title' LIKE 'Dichtung an Pumpe %'",
    );
    expect(bestand.rows[0]?.n).toBe(ANLAGEN);
    const ohneBeleg = await p.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM kos k
        WHERE (SELECT count(*) FROM audit a WHERE a.action = 'ko.created' AND a.target = k.id) <> 1`,
    );
    expect(ohneBeleg.rows[0]?.n).toBe(0);
    // Auch der Hintergrund hat nirgends eine unerwartete 500 ausgelöst.
    expect(logzeilen().filter((z) => z.msg === MELDUNG)).toEqual([]);
  });
});
