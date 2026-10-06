// Aufnahme gesamt-auditprotokoll · Lauf 5 — BEN-R3-B1, ohne Datenbank.
//
// Befund: Hat die bewertende verantwortliche Person schon eine OFFENE Zuweisung, setzt `rate` sie in
// der Transaktion auf „erledigt". Die Rückgabe an die verantwortliche Person las die Zuweisung danach
// über den Pool — also den festgeschriebenen Stand „offen" — und unterließ das Wiederöffnen. Die
// Transaktion schrieb „erledigt" fest, obwohl `ko.returned-to-*` angehängt wurde.
//
// Hier läuft der ECHTE `PgAssignmentRepo` (unverändertes SQL) gegen ein Testdoppel mit zwei
// getrennten Sichten: der Pool sieht nur Festgeschriebenes, der Transaktionsclient seinen eigenen,
// noch nicht festgeschriebenen Stand; COMMIT übernimmt ihn, ein Fehler verwirft ihn. Damit zeigt der
// Test die Lesestelle, an der es scheiterte. Der PostgreSQL-Weg desselben Falls steht in
// `kette-und-beleg-atomar.integration.test.ts` (BEN-R3-B1).
import type { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { TxContext } from "../../services/db-tx";
import { type AssignmentRepo, PgAssignmentRepo } from "../../services/validation";

type Assignment = NonNullable<Awaited<ReturnType<AssignmentRepo["find"]>>>;
type Ablage = Map<string, Assignment>;

/** Beantwortet genau die Anweisungen von `PgAssignmentRepo` auf einer Ablage. */
function sql(ablage: Ablage, text: string, p: readonly unknown[] = []) {
  const schluessel = `${String(p[0])}:${String(p[1])}`;
  if (text.startsWith("INSERT INTO assignments") || text.startsWith("UPDATE assignments")) {
    const daten = JSON.parse(String(p[2])) as Assignment;
    if (text.startsWith("INSERT") || ablage.has(schluessel)) {
      ablage.set(schluessel, daten);
    }
    return { rows: [], rowCount: 1 };
  }
  if (text.startsWith("DELETE FROM assignments")) {
    ablage.delete(schluessel);
    return { rows: [], rowCount: 1 };
  }
  if (text.startsWith("SELECT data FROM assignments WHERE")) {
    const d = ablage.get(schluessel);
    return { rows: d ? [{ data: d }] : [], rowCount: d ? 1 : 0 };
  }
  if (text === "SELECT data FROM assignments") {
    return { rows: [...ablage.values()].map((data) => ({ data })), rowCount: ablage.size };
  }
  throw new Error(`Testdoppel: unbekannte Anweisung ${text}`);
}

function getrennteSichten() {
  let fest: Ablage = new Map();
  const pool = {
    query: async (text: string, p?: readonly unknown[]) => sql(fest, text, p),
  } as unknown as Pool;
  const withTx = async <T>(fn: (tx: TxContext) => Promise<T>): Promise<T> => {
    const offen: Ablage = new Map([...fest].map(([k, v]) => [k, { ...v }]));
    const client = {
      query: async (text: string, p?: readonly unknown[]) => sql(offen, text, p),
    };
    const ergebnis = await fn({ brand: "TxContext", client } as unknown as TxContext);
    fest = offen;
    return ergebnis;
  };
  return { pool, withTx, fest: () => fest };
}

const offen: Array<{ close: () => Promise<unknown> }> = [];
afterEach(async () => {
  for (const app of offen.splice(0)) {
    await app.close();
  }
});

async function buehne() {
  const sichten = getrennteSichten();
  const repos = inMemoryRepos();
  repos.assignments = new PgAssignmentRepo(sichten.pool);
  const services = assembleServices(repos, { withTx: sichten.withTx });
  const app = buildApp(services);
  await app.ready();
  offen.push(app);
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "r3@x.de", password: "secret123" },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  const angelegt = reg.json() as { id?: string; user?: { id: string } };
  const adminId = angelegt.user?.id ?? angelegt.id ?? "";
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "r3@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, services, repos, headers, adminId, sichten };
}

describe("BEN-R3-B1 · Rückgabe an die selbst bewertende verantwortliche Person (getrennte Sichten)", () => {
  for (const verdict of ["down", "warn"] as const) {
    it(`${verdict}: die schon offene Zuweisung bleibt nach COMMIT offen, passend zum Rückgabebeleg`, async () => {
      const b = await buehne();
      const res = await b.app.inject({
        method: "POST",
        url: "/api/kos",
        headers: b.headers,
        payload: {
          confidentiality: "intern",
          title: `Rückgabe ${verdict}`,
          statement: "Dichtung vor jedem Anlauf prüfen.",
          type: "best_practice",
          category: "Instandhaltung",
        },
      });
      expect(res.statusCode, res.body).toBe(201);
      const id = res.json().id as string;
      await b.services.validation.assign(id, [b.adminId], b.adminId);
      expect(b.sichten.fest().get(`${id}:${b.adminId}`)?.status).toBe("open");

      const bewertet = await b.app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: b.headers,
        payload: { action: "rate", verdict },
      });
      expect(bewertet.statusCode, bewertet.body).toBe(200);

      // Die verantwortliche Person hat danach eine OFFENE Nacharbeitsaufgabe …
      const festgeschrieben = [...b.sichten.fest().values()].filter((z) => z.koId === id);
      expect(festgeschrieben).toEqual([
        expect.objectContaining({ koId: id, userId: b.adminId, status: "open" }),
      ]);
      expect(await b.services.validation.openAssignmentsFor(b.adminId)).toEqual([
        expect.objectContaining({ koId: id }),
      ]);
      // … und genau EIN Rückgabebeleg an sie — der protokollierte Vorgang entspricht der Wirkung.
      const belege = (await b.repos.auditRepo.all()).filter(
        (e) => e.target === id && e.action.startsWith("ko.returned-to-"),
      );
      expect(belege).toHaveLength(1);
      expect(belege[0]?.payload).toEqual(
        expect.objectContaining({ verdict, responsible: b.adminId }),
      );
    });
  }

  it("Kontrolle: das Testdoppel trennt die Sichten wirklich (Pool sieht Ungeschriebenes nicht)", async () => {
    const s = getrennteSichten();
    const repo = new PgAssignmentRepo(s.pool);
    await repo.create({ koId: "k", userId: "u", status: "open" });
    await s.withTx(async (tx) => {
      await repo.update({ koId: "k", userId: "u", status: "done" }, tx);
      expect((await repo.find("k", "u"))?.status).toBe("open");
      expect((await repo.find("k", "u", tx))?.status).toBe("done");
    });
    expect((await repo.find("k", "u"))?.status).toBe("done");
  });
});
