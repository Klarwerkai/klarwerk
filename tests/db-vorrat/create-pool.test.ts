import type { PoolConfig } from "pg";
import { describe, expect, it } from "vitest";
import { createPool } from "../../services/app/src/db";
import { LEERLAUF_IN_TRANSAKTION_MS, VORRAT_WARTEZEIT_MS } from "../../services/db-tx";

// R-0798: Der EINE Vorrat, den der Server (`server.ts`, `pgServices`) anlegt, trägt die Zeitgrenzen
// tatsächlich — nicht nur die Hilfsfunktion in db-tx. Ein Pool öffnet beim Anlegen keine
// Verbindung; die Adresse unten wird nie erreicht.
describe("createPool · der Vorrat des Servers trägt seine Zeitgrenzen", () => {
  it("Wartezeit auf eine Verbindung und Leerlauffrist in offener Transaktion sind gesetzt", async () => {
    const pool = createPool("postgresql://pruefung@127.0.0.1:1/keine");
    try {
      const optionen = (pool as unknown as { options: PoolConfig }).options;
      expect(optionen.connectionString).toBe("postgresql://pruefung@127.0.0.1:1/keine");
      expect(optionen.connectionTimeoutMillis).toBe(VORRAT_WARTEZEIT_MS);
      expect(optionen.options).toBe(
        `-c idle_in_transaction_session_timeout=${LEERLAUF_IN_TRANSAKTION_MS}`,
      );
    } finally {
      await pool.end();
    }
  });
});
