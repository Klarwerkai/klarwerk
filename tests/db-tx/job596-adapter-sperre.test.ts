import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { buildPgServices } from "../../services/app/src/build-app";
import { BestandsresetLaeuftError, SPERRSCHLUESSEL_BESTANDSRESET } from "../../services/db-tx";

// ================================================================================================
// JOB 596 · D9 — DIE SPERRE WIRKT DORT, WO DIE ADAPTER ZUGREIFEN.
// ================================================================================================
//
// DER ROTGRUND VON D8, woertlich: „D8 verbessert Poolvertrag und Reset-Orchestrator, laesst aber
// den tatsaechlichen Produktweg weiter ueber den alten Rohpool laufen; damit wirkt die zentrale
// Resetsperre dort nicht, wo die 24 Adapter zugreifen."
//
// Das trifft, und dieser Test ist die Stelle, an der es sichtbar wird. Bis D8 galt:
//
//     server.ts:22   const pool = createPool(databaseUrl);      ← ROHER Pool
//     server.ts:33   return buildPgServices(pool);              ← und der geht in ALLE Adapter
//     build-app.ts   buildPgServices(pool) reicht ihn 28-mal weiter
//
// Die Kapselung war exportiert und unbenutzt. Ein Bestandsreset haette die exklusive Sperre
// genommen — und jeder Adapter waere daran vorbeigelaufen, weil er die geteilte Sperre nie
// angefordert hat.
//
// ------------------------------------------------------------------------------------------------
// WARUM DER TEST AM `ObjectStore` HAENGT UND NICHT AN EINEM EIGENEN DOPPEL.
// ------------------------------------------------------------------------------------------------
//
// BEN verlangt „je einen Lese- und Mutationszugriff ueber einen BESTEHENDEN Adapter". `services.objects`
// IST der `PgObjectRepo` aus `build-app.ts:662` — er kommt unveraendert aus dem echten
// Anwendungsaufbau, nicht aus einer Testkonstruktion. Sein Lese- und sein Schreibweg sind zwei
// gewoehnliche Anweisungen:
//
//     repo-pg.ts:33   SELECT ref,data FROM objects WHERE id=$1     (lesen)
//     repo-pg.ts:48   DELETE FROM objects WHERE id=$1              (mutieren)
//
// Erreicht eine davon waehrend eines Resets die Datenbank, ist der Vertrag gebrochen — unabhaengig
// davon, was `gated-pool.test.ts` ueber die Huelle selbst sagt.
//
// REICHWEITENGRENZE, VORWEG: Auch dieser Test laeuft gegen ein Postgres-DOPPEL. Bewiesen ist, dass
// der PRODUKTAUFBAU die Huelle benutzt und die Anweisungen nicht durchlaesst. NICHT bewiesen ist
// das Verhalten echter Advisory-Sperren; das bleibt P1–P8 vorbehalten (s. Rueckgabe D9 §5).

const SCHLUESSEL = String(SPERRSCHLUESSEL_BESTANDSRESET);

interface Doppel {
  pool: Pool;
  protokoll: string[];
  resetLaeuft: { wert: boolean };
}

/** Dasselbe Doppel wie in `services/db-tx/src/gated-pool.test.ts` — eine Quelle, kein Klon. */
function poolDoppel(): Doppel {
  const protokoll: string[] = [];
  const resetLaeuft = { wert: false };

  const antwort = (text: string) => {
    if (text.includes("pg_try_advisory")) {
      return { rows: [{ erworben: !resetLaeuft.wert }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  const alsText = (befehl: string | { text: string }): string =>
    typeof befehl === "string" ? befehl : befehl.text;

  const pool = {
    query: async (befehl: string | { text: string }) => {
      protokoll.push(alsText(befehl));
      return antwort(alsText(befehl));
    },
    connect: async () => ({
      query: async (befehl: string | { text: string }) => {
        protokoll.push(alsText(befehl));
        return antwort(alsText(befehl));
      },
      release: () => undefined,
    }),
  };

  return { pool: pool as unknown as Pool, protokoll, resetLaeuft };
}

/** Die Nutzanweisungen — alles ausser Transaktionssteuerung und Sperrabfrage. */
function nutzanweisungen(protokoll: readonly string[]): string[] {
  return protokoll.filter(
    (z) => !["BEGIN", "COMMIT", "ROLLBACK"].includes(z.trim()) && !z.includes("pg_try_advisory"),
  );
}

describe("JOB 596 · D9 — waehrend eines Resets erreicht KEIN Adapterzugriff die Datenbank", () => {
  it("A1 LESEN: `objects.metadata` wird abgewiesen, und die SELECT-Anweisung wird nie abgesetzt", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    const services = buildPgServices(pool);
    resetLaeuft.wert = true;

    await expect(services.objects.metadata("obj-1")).rejects.toBeInstanceOf(
      BestandsresetLaeuftError,
    );

    // DIE SCHAERFSTE FORM: nicht „das Ergebnis ist leer", sondern „die Anweisung lief nie".
    expect(nutzanweisungen(protokoll)).toEqual([]);
    // Und die Sperre wurde wirklich angefordert — sonst waere die Ablehnung ein Zufall.
    expect(protokoll.some((z) => z.includes(SCHLUESSEL))).toBe(true);
  });

  it("A2 MUTIEREN: `objects.delete` wird abgewiesen, und das DELETE wird nie abgesetzt", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    const services = buildPgServices(pool);
    resetLaeuft.wert = true;

    await expect(services.objects.delete("obj-1")).rejects.toBeInstanceOf(BestandsresetLaeuftError);

    expect(nutzanweisungen(protokoll)).toEqual([]);
    expect(protokoll.some((z) => z.includes(SCHLUESSEL))).toBe(true);
  });

  it("A3 KALIBRIERUNG: ohne laufenden Reset gehen BEIDE Zugriffe durch — und die Sperre ist zuerst", async () => {
    // Ohne diesen Fall waeren A1 und A2 auch von einem Aufbau erfuellt, der grundsaetzlich alles
    // abweist. Erst die Kalibrierung macht aus ihnen eine Aussage ueber den RESET.
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    const services = buildPgServices(pool);
    resetLaeuft.wert = false;

    await expect(services.objects.metadata("obj-1")).resolves.toBeUndefined();
    await expect(services.objects.delete("obj-1")).resolves.toBe(false);

    expect(protokoll[0]).toBe("BEGIN");
    expect(protokoll[1]).toContain(SCHLUESSEL);
    expect(nutzanweisungen(protokoll)).toEqual([
      "SELECT ref,data FROM objects WHERE id=$1",
      "DELETE FROM objects WHERE id=$1",
    ]);
  });

  it("A4 NACH DER FREIGABE: derselbe Aufbau liefert wieder aus", async () => {
    // Der Reset ist ein Zustand, kein Schalter, der haengen bleibt. Dieselbe Instanz, erst
    // gesperrt, dann frei — und der Zugriff funktioniert wieder.
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    const services = buildPgServices(pool);

    resetLaeuft.wert = true;
    await expect(services.objects.metadata("obj-1")).rejects.toBeInstanceOf(
      BestandsresetLaeuftError,
    );
    expect(nutzanweisungen(protokoll)).toEqual([]);

    resetLaeuft.wert = false;
    await expect(services.objects.metadata("obj-1")).resolves.toBeUndefined();
    expect(nutzanweisungen(protokoll)).toEqual(["SELECT ref,data FROM objects WHERE id=$1"]);
  });
});
