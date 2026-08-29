// ================================================================================================
// JOB 2698 · D1 — DIE MESSUNG: WIE VIELE ZEILEN LIEST EIN BLICK AUF DIE GLOCKE? (R2-32)
// ================================================================================================
//
// DER NACHWEIS DES AUFTRAGS: „`GET /api/notifications` bei einem großen Protokoll, gelesene Zeilen
// vorher und nachher." PostgreSQL läuft in dieser Sandbox nicht (`connect EPERM 127.0.0.1:5432`) —
// gemessen wird deshalb an der ECHTEN App (`buildApp`, echte Routen, echte Anmeldung, echter
// `PgAuditRepo`) über ein Pool-Doppel, das die Anweisungen dieses Repos versteht und ZÄHLT, wie
// viele Zeilen es je Abfrage ausliefert. Das Doppel hält 100 000 Protokollzeilen.
//
// VORHER/NACHHER IN EINEM LAUF: „vorher" ist derselbe Repo-Stand, aber ohne `findBy`/`existsBy`
// (so sieht der Dienst eine Ablage, die nur `all()` kann — der Weg bis 2698); „nachher" ist der
// volle `PgAuditRepo`. Beide beantworten dieselbe Anfrage — und die Antwort muss GLEICH sein: das
// ist die zweite, wichtigere Hälfte der Abnahme („zeigt dieselben Einträge wie vorher").
import { describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { AuditRepo } from "../../services/audit/src/repo";
import {
  AUDIT_EXISTS_BY_SQL,
  AUDIT_FIND_BY_SQL,
  PgAuditRepo,
} from "../../services/audit/src/repo-pg";

interface Zeile {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  event_id: string | null;
  hash_version: number;
}

/**
 * Das Pool-Doppel: versteht INSERT (append/appendOnce), `last`, `findBySeq`, `all`, `findBy`,
 * `existsBy` — mit den Regeln, an denen die Gleichheit hängt (`=` byteweise, NULL = kein Filter,
 * ORDER BY seq). Es zählt je Abfrageart die AUSGELIEFERTEN Zeilen.
 */
function poolDoppel() {
  const rows: Zeile[] = [];
  const zaehler = { all: 0, findBy: 0, existsBy: 0, allAufrufe: 0, findByAufrufe: 0 };
  const trifft = (r: Zeile, p: unknown[]): boolean => {
    const [actor, action, target] = p as [string | null, string | null, string | null];
    return (
      (actor === null || r.actor === actor) &&
      (action === null || r.action === action) &&
      (target === null || r.target === target)
    );
  };
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith("INSERT INTO audit(")) {
        const p = params as [
          number,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          ...unknown[],
        ];
        const mitEventId = sql.includes("event_id");
        const eventId = mitEventId ? ((params[8] as string | null) ?? null) : null;
        if (eventId && rows.some((r) => r.event_id === eventId)) {
          return { rows: [], rowCount: 0 };
        }
        rows.push({
          seq: p[0],
          at: p[1],
          actor: p[2],
          action: p[3],
          target: p[4],
          payload: JSON.parse(p[5]) as Record<string, unknown>,
          prev_hash: p[6],
          hash: p[7],
          event_id: eventId,
          hash_version: Number(mitEventId ? params[9] : params[8]) || 1,
        });
        return { rows: [{ seq: p[0] }], rowCount: 1 };
      }
      if (sql === "SELECT * FROM audit ORDER BY seq DESC LIMIT 1") {
        const last = rows[rows.length - 1];
        return { rows: last ? [last] : [], rowCount: last ? 1 : 0 };
      }
      if (sql === "SELECT * FROM audit WHERE seq = $1") {
        const r = rows.find((x) => x.seq === params[0]);
        return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
      }
      if (sql === "SELECT * FROM audit ORDER BY seq") {
        zaehler.allAufrufe += 1;
        zaehler.all += rows.length;
        return { rows: [...rows], rowCount: rows.length };
      }
      if (sql === AUDIT_FIND_BY_SQL) {
        const res = rows.filter((r) => trifft(r, params));
        zaehler.findByAufrufe += 1;
        zaehler.findBy += res.length;
        return { rows: res, rowCount: res.length };
      }
      if (sql === AUDIT_EXISTS_BY_SQL) {
        zaehler.existsBy += 1;
        return { rows: [{ vorhanden: rows.some((r) => trifft(r, params)) }], rowCount: 1 };
      }
      throw new Error(`Doppel kennt diese Anweisung nicht: ${sql.slice(0, 80)}`);
    },
  };
  return { pool, rows, zaehler };
}

/** Der Weg bis 2698: dieselbe Ablage, aber ohne die gefilterten Lesewege — der Dienst fällt auf all() zurück. */
function ohneFindBy(repo: PgAuditRepo): AuditRepo {
  return {
    append: (e, tx) => repo.append(e, tx),
    appendOnce: (e, tx) => repo.appendOnce(e, tx),
    all: () => repo.all(),
    last: (tx) => repo.last(tx),
    findBySeq: (seq, tx) => repo.findBySeq(seq, tx),
  };
}

type App = ReturnType<typeof buildApp>;

async function anmelden(app: App): Promise<{ headers: Record<string, string>; id: string }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job2698.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2698.test", password: "geheim12345" },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  return { headers, id: (me.json() as { id: string }).id };
}

/** 100 000 Protokollzeilen: fast alles Fragen, dazwischen 60 „hat geholfen" für den angemeldeten Autor. */
function protokollFuellen(rows: Zeile[], autor: string, n: number): { helpful: number } {
  const start = rows.length + 1;
  let helpful = 0;
  for (let i = 0; i < n; i++) {
    const seq = start + i;
    const istHelpful = i % 1_666 === 0 && helpful < 60;
    if (istHelpful) {
      helpful += 1;
    }
    rows.push({
      seq,
      at: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
      actor: istHelpful ? `leser-${i}` : `frager-${i % 97}`,
      action: istHelpful ? "answer.helpful" : "ask.query",
      target: istHelpful ? `ko-${i}` : "frage",
      payload: istHelpful
        ? { koAuthor: autor, koTitle: `Wissen ${i}` }
        : { answered: i % 3 === 0, question: "…" },
      prev_hash: `h${seq - 1}`,
      hash: `h${seq}`,
      event_id: null,
      hash_version: 2,
    });
  }
  return { helpful };
}

function appMit(auditRepo: AuditRepo): App {
  const repos = inMemoryRepos();
  const services = assembleServices({ ...repos, auditRepo }, {});
  return buildApp(services);
}

describe("JOB 2698 — ein Blick auf die Glocke liest die Einträge, die er braucht, nicht das ganze Protokoll", () => {
  it("GET /api/notifications bei 100 000 Zeilen: vorher 100 000 gelesen, nachher nur die Treffer — und derselbe Feed", async () => {
    // NACHHER: der volle PgAuditRepo (findBy/existsBy).
    const neu = poolDoppel();
    const appNeu = appMit(new PgAuditRepo(neu.pool as never));
    const pedi = await anmelden(appNeu);
    const { helpful } = protokollFuellen(neu.rows, pedi.id, 100_000);
    expect(neu.rows.length).toBeGreaterThanOrEqual(100_000);
    const vorher = { ...neu.zaehler };

    const resNeu = await appNeu.inject({
      method: "GET",
      url: "/api/notifications",
      headers: pedi.headers,
    });
    expect(resNeu.statusCode).toBe(200);
    const gelesenNeu = neu.zaehler.all - vorher.all + (neu.zaehler.findBy - vorher.findBy);
    // Die Messung: kein Vollscan mehr; ausgeliefert werden genau die `answer.helpful`-Zeilen.
    expect(neu.zaehler.allAufrufe - vorher.allAufrufe, "Vollscan während der Glocke").toBe(0);
    expect(gelesenNeu).toBe(helpful);
    expect(gelesenNeu).toBeLessThan(1_000);

    // VORHER: dieselbe Ablage, aber ohne gefilterte Lesewege — der Weg bis 2698.
    const alt = poolDoppel();
    const appAlt = appMit(ohneFindBy(new PgAuditRepo(alt.pool as never)));
    const pediAlt = await anmelden(appAlt);
    protokollFuellen(alt.rows, pediAlt.id, 100_000);
    const vorherAlt = { ...alt.zaehler };
    const resAlt = await appAlt.inject({
      method: "GET",
      url: "/api/notifications",
      headers: pediAlt.headers,
    });
    expect(resAlt.statusCode).toBe(200);
    expect(alt.zaehler.allAufrufe - vorherAlt.allAufrufe).toBeGreaterThan(0);
    expect(alt.zaehler.all - vorherAlt.all).toBeGreaterThanOrEqual(100_000);

    // DIESELBEN EINTRÄGE: der Feed ist alt wie neu gleich (ids, Titel, Zeiten) — die Impacts der
    // Glocke kommen aus genau diesen Zeilen.
    const feedNeu = resNeu.json() as { id: string; kind: string; title: string; at: string }[];
    const feedAlt = resAlt.json() as { id: string; kind: string; title: string; at: string }[];
    expect(feedNeu.map((n) => [n.id, n.kind, n.title, n.at])).toEqual(
      feedAlt.map((n) => [n.id, n.kind, n.title, n.at]),
    );
    const impacts = feedNeu.filter((n) => n.kind === "impact");
    expect(impacts.length, "die Glocke zeigt die Wirkungsmeldungen (max. 12)").toBe(
      Math.min(12, helpful),
    );
  });

  it("GET /api/me/impact (Wirkung) und /api/livewall: kein Vollscan mehr, gleiche Zahlen", async () => {
    const neu = poolDoppel();
    const appNeu = appMit(new PgAuditRepo(neu.pool as never));
    const pedi = await anmelden(appNeu);
    protokollFuellen(neu.rows, pedi.id, 20_000);
    const vorher = { ...neu.zaehler };
    const impactNeu = await appNeu.inject({
      method: "GET",
      url: "/api/me/impact",
      headers: pedi.headers,
    });
    const wallNeu = await appNeu.inject({
      method: "GET",
      url: "/api/livewall",
      headers: pedi.headers,
    });
    expect(impactNeu.statusCode).toBe(200);
    expect(wallNeu.statusCode).toBe(200);
    expect(neu.zaehler.allAufrufe - vorher.allAufrufe, "Vollscan in Wirkung/Live-Wall").toBe(0);

    const alt = poolDoppel();
    const appAlt = appMit(ohneFindBy(new PgAuditRepo(alt.pool as never)));
    const pediAlt = await anmelden(appAlt);
    protokollFuellen(alt.rows, pediAlt.id, 20_000);
    const impactAlt = await appAlt.inject({
      method: "GET",
      url: "/api/me/impact",
      headers: pediAlt.headers,
    });
    const wallAlt = await appAlt.inject({
      method: "GET",
      url: "/api/livewall",
      headers: pediAlt.headers,
    });
    expect(impactNeu.json()).toEqual(impactAlt.json());
    expect(wallNeu.json()).toEqual(wallAlt.json());
  });

  it("KO-Nachzug: die Frage ‹gibt es schon ein ko.created?› ist ein EXISTS, kein Laden", async () => {
    const neu = poolDoppel();
    const repos = inMemoryRepos();
    const services = assembleServices(
      { ...repos, auditRepo: new PgAuditRepo(neu.pool as never) },
      {},
    );
    const appNeu = buildApp(services);
    const pedi = await anmelden(appNeu);
    protokollFuellen(neu.rows, pedi.id, 5_000);
    const res = await appNeu.inject({
      method: "POST",
      url: "/api/kos",
      headers: pedi.headers,
      payload: {
        title: "Neues Wissen",
        statement: "Eine Aussage mit genug Substanz für die Anlage.",
        type: "best_practice",
        category: "Betrieb",
      },
    });
    expect(res.statusCode).toBe(201);
    const ko = await services.ko.get((res.json() as { id: string }).id);
    expect(ko).toBeDefined();
    if (!ko) {
      return;
    }
    // Der Nachzieh-Pfad der Anlage-Seiteneffekte (Adoption/Recovery, `ensureCreatedSideEffects`)
    // fragte bis 2698 mit `list({ action: "ko.created", target })` — also über das ganze Protokoll —,
    // ob der Beleg schon da ist. Jetzt ein EXISTS; zweimal aufgerufen bleibt es bei einem Beleg.
    const vorher = { ...neu.zaehler };
    await services.ko.ensureCreatedSideEffects(ko);
    await services.ko.ensureCreatedSideEffects(ko);
    expect(neu.zaehler.allAufrufe - vorher.allAufrufe, "Vollscan beim Nachzug").toBe(0);
    expect(neu.zaehler.existsBy - vorher.existsBy).toBe(2);
    expect(neu.rows.filter((r) => r.action === "ko.created" && r.target === ko.id)).toHaveLength(1);
  });
});
