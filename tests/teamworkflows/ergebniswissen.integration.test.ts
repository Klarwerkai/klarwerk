import { GenericContainer, Wait } from "testcontainers";
import { expect, it, vi } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { PgWorkflowLaeufe } from "../../services/app/src/teamworkflow-laeufe-repo";
import { poolAbschluss } from "../audit-gesamt/pool-abschluss";
import { ergebnisUmfeld } from "./ergebniswissen-fixture";

it("prüft das Weitergaberecht atomar mit der Artikelanlage und lässt bei abgewiesener Buchung weder Artikel noch Freigabestempel zurück", async () => {
  const c = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "workflow-synthetic", POSTGRES_DB: "ergebniswissen" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  const pool = createPool(
    `postgresql://postgres:workflow-synthetic@${c.getHost()}:${c.getMappedPort(5432)}/ergebniswissen`,
  );
  const schliessen = poolAbschluss(pool);
  try {
    await migrate(pool);
    const s = buildPgServices(pool);
    const app = buildApp(s);
    try {
      const f = await ergebnisUmfeld(s, app);
      const v = (await f.leserApi("GET", f.b)).json();
      const titel = "Einkaufsergebnis aus dem Firmenworkflow";
      const p = await f.leserApi("POST", f.b, {
        titel,
        aussage: "Ein testweise dokumentierter Einkaufsbeschluss.",
        stempel: v.stempel,
      });
      expect(p.statusCode, p.body).toBe(200);
      const vorher = PgWorkflowLaeufe.prototype.speichern;
      // Eine zweite Verbindung macht die bestehende Quelle zwischen Anwendungsprüfung und SQL-Guard restriktiv.
      const buchen = vi
        .spyOn(PgWorkflowLaeufe.prototype, "speichern")
        .mockImplementationOnce(async function (this: PgWorkflowLaeufe, lauf, basis, bindung, tx) {
          expect(tx).toBeDefined();
          await pool.query(
            "UPDATE kos SET data=jsonb_set(data,'{quellrechte}', $2::jsonb) WHERE id=$1",
            [f.ko.id, JSON.stringify({ stufe: "intern", leser: [f.autor.id] })],
          );
          return vorher.call(this, lauf, basis, bindung, tx);
        });
      try {
        const d = await f.chef("POST", `${f.b}/entscheiden`, {
          entscheidung: "freigeben",
          stempel: p.json().stempel,
        });
        expect(d.statusCode, d.body).toBe(409);
        expect(buchen).toHaveBeenCalledTimes(1);
      } finally {
        buchen.mockRestore();
      }
      const bestand = await new PgWorkflowLaeufe(pool).lesen(f.lauf.split("/").at(-1) ?? "");
      expect(bestand?.wissensvorschlaege?.[f.ergebnisId]).toMatchObject({ stand: "vorgeschlagen" });
      expect(bestand?.wissensvorschlaege?.[f.ergebnisId]).not.toHaveProperty("koId");
      expect((await s.ko.list()).some((k) => k.title === titel)).toBe(false);
      expect(await s.audit.list({ action: "ko.owner-validated" })).toEqual([]);
    } finally {
      await app.close();
    }
  } finally {
    await schliessen();
    await c.stop();
  }
}, 90000);
