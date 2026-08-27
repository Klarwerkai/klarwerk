import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgKlaraSessionRepo } from "../../services/reasoner";

// ================================================================================================
// JOB 2415 D1 — DER DREHER IN `touchSession` UND `refreshResolution`, UND DER SAMMLER DARUEBER.
// ================================================================================================
//
// DIE FEHLERKLASSE (BASIC2, JOB 2384): Vertauscht man zwei Parameter gleichen Typs, gibt es
// „keinen Typfehler, keinen Laufzeitfehler und kein Rollback — die Klammer committet ihn sauber.
// Das Ergebnis ist ein dauerhaft falscher Bestand ohne jedes Signal."
//
// DIE ZWEI STELLEN, beide ueber `cas()` (`klara-policy-store.ts:651`):
//
//   touchSession       :695-700   SET last_activity_at=$3, expires_at=$4
//                                 params [sessionId, expectedRevision, lastActivityAt, expiresAt]
//   refreshResolution  :858-870   SET resolution_id=$3, policy_version=$4, configuration_version=$5
//                                 params [sessionId, expectedRevision, resolutionId,
//                                         policyVersion, configurationVersion]
//
// `expires_at` und `last_activity_at` vertauscht heisst fachlich: **eine Sitzung laeuft ab,
// sobald sie benutzt wird.** Kein Test hat das bisher bemerkt (gemessen in JOB 2415 D1:
// `klara-session-service.test.ts` faehrt gegen `InMemoryKlaraSessionRepo` und sieht das SQL nie;
// `db.migrate.integration.test.ts` ist ueber `vitest.config.ts:33` aus dem Lauf ausgeschlossen).
//
// WARUM NICHT IM `cas()` SELBST — die Frage aus dem Auftrag, hier beantwortet:
// `cas(sql, params)` bekommt beides als undurchsichtiges Paar. Es kennt weder die Spaltennamen
// noch die Bedeutung der Werte, und beide vertauschten Werte sind Zeichenketten. Es GIBT dort
// keine Information, an der ein Dreher erkennbar waere. Was traegt, ist entweder eine benannte
// statt positionalen Uebergabe im Produkt (Ownerfrage, ausserhalb dieser Lease) — oder ein
// SAMMLER, der jeden `cas`-Aufrufer zur Deckung zwingt. Der Sammler steht unten (Teil 3) und
// ist die Haelfte der Idee, die in `tests/**` gebaut werden kann.

/** Was der Store an die Datenbank gegeben hat. */
interface Abgesetzt {
  sql: string;
  params: unknown[];
}

/** Ein Pool-Doppel, das nichts tut ausser mitzuschreiben. Keine Datenbank, kein Netz. */
function poolDoppel(): { pool: Pool; abgesetzt: Abgesetzt[] } {
  const abgesetzt: Abgesetzt[] = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      abgesetzt.push({ sql, params: [...params] });
      return { rowCount: 1, rows: [] };
    },
  } as unknown as Pool;
  return { pool, abgesetzt };
}

/**
 * DIE ZUORDNUNG SPALTE -> WERT, aus dem WIRKLICH abgesetzten SQL gelesen.
 *
 * Das ist der Unterschied zu einer Namensprüfung: Es wird nicht behauptet, dass irgendwo
 * `last_activity_at` steht, sondern AUSGERECHNET, welcher uebergebene Wert in dieser Spalte
 * landet. Ein Dreher in der Parameterliste veraendert genau dieses Ergebnis.
 */
function spaltenBelegung(a: Abgesetzt): Record<string, unknown> {
  const set = /\bSET\b([\s\S]*?)\bWHERE\b/i.exec(a.sql);
  expect(set, `kein SET…WHERE im abgesetzten SQL: ${a.sql}`).not.toBeNull();
  const belegung: Record<string, unknown> = {};
  for (const stueck of (set?.[1] ?? "").split(",")) {
    const zuweisung = /^\s*([a-z_]+)\s*=\s*\$(\d+)\s*$/i.exec(stueck);
    if (!zuweisung) {
      continue; // z. B. `session_revision = session_revision + 1` — kein Parameter, kein Dreher
    }
    const [, spalte, nr] = zuweisung;
    if (spalte === undefined || nr === undefined) {
      continue;
    }
    belegung[spalte] = a.params[Number(nr) - 1];
  }
  return belegung;
}

/**
 * Die erste abgesetzte Abfrage — mit Prüfung statt Index-Zugriff.
 *
 * `noUncheckedIndexedAccess` macht `abgesetzt[0]` zu `Abgesetzt | undefined`. Das ist kein
 * Formalismus: Setzt der Store gar nichts ab, prüfte der Fall sonst `undefined` gegen
 * `undefined` und wäre still grün. Hier fällt es auf.
 */
function ersteAbfrage(abgesetzt: Abgesetzt[]): Abgesetzt {
  const erste = abgesetzt[0];
  if (erste === undefined) {
    throw new Error("es wurde gar keine Abfrage abgesetzt");
  }
  return erste;
}

// Unterscheidbare Werte: waeren sie gleich, koennte kein Dreher auffallen.
const SITZUNG = "sess-2415";
const REVISION = 7;
const AKTIV = "AKTIV-2026-08-26T09:00:00.000Z";
const ABLAUF = "ABLAUF-2026-08-26T17:00:00.000Z";
const RESOLUTION = "res-2415";
const POLICY_V = "POLICY-v41";
const CONFIG_V = "CONFIG-v99";

describe("JOB 2415 · touchSession und refreshResolution binden ihre Parameter richtig", () => {
  it("touchSession: last_activity_at bekommt die AKTIVITAETSzeit, expires_at die ABLAUFzeit", async () => {
    const { pool, abgesetzt } = poolDoppel();
    await new PgKlaraSessionRepo(pool).touchSession(SITZUNG, REVISION, AKTIV, ABLAUF);

    expect(abgesetzt, "es wurde nicht genau eine Abfrage abgesetzt").toHaveLength(1);
    const erste = ersteAbfrage(abgesetzt);
    const b = spaltenBelegung(erste);

    // DER KERN: die beiden Zeitstempel sind gleichartig — nur die Zuordnung entscheidet.
    expect(b.last_activity_at, "last_activity_at traegt die falsche Zeit").toBe(AKTIV);
    expect(
      b.expires_at,
      "expires_at traegt die falsche Zeit — die Sitzung liefe ab, sobald sie benutzt wird",
    ).toBe(ABLAUF);
    // Der Compare-Teil gehoert dazu: ohne ihn waere das CAS kein CAS.
    expect(erste.params[0], "session_id steht nicht an $1").toBe(SITZUNG);
    expect(erste.params[1], "session_revision steht nicht an $2").toBe(REVISION);
  });

  it("refreshResolution: policy_version und configuration_version landen nicht ueber Kreuz", async () => {
    const { pool, abgesetzt } = poolDoppel();
    await new PgKlaraSessionRepo(pool).refreshResolution(SITZUNG, REVISION, {
      resolutionId: RESOLUTION,
      policyVersion: POLICY_V,
      configurationVersion: CONFIG_V,
    });

    expect(abgesetzt).toHaveLength(1);
    const erste = ersteAbfrage(abgesetzt);
    const b = spaltenBelegung(erste);

    expect(b.resolution_id, "resolution_id traegt den falschen Wert").toBe(RESOLUTION);
    expect(b.policy_version, "policy_version traegt die Konfigurationsfassung").toBe(POLICY_V);
    expect(b.configuration_version, "configuration_version traegt die Regelwerksfassung").toBe(
      CONFIG_V,
    );
    expect(erste.params[0]).toBe(SITZUNG);
    expect(erste.params[1]).toBe(REVISION);
  });

  // ==============================================================================================
  // TEIL 2 — DIE KALIBRIERUNG: erkennt der Prueler einen Dreher UEBERHAUPT?
  // ==============================================================================================
  //
  // Beide Faelle oben sind Zusagen der Form „der Wert steht an der richtigen Stelle". Solche
  // Faelle sind auch dann gruen, wenn `spaltenBelegung` gar nichts findet und `undefined` gegen
  // `undefined` vergleicht. Dieser Fall schliesst das aus, indem er einen KUENSTLICH gedrehten
  // Absatz durch dieselbe Auswertung schickt.
  it("KALIBRIERUNG: ein gedrehtes SET wird von der Auswertung wirklich bemerkt", () => {
    const gedreht: Abgesetzt = {
      sql: `UPDATE klara_sessions
              SET last_activity_at=$4, expires_at=$3, session_revision = session_revision + 1
            WHERE session_id=$1 AND session_revision=$2`,
      params: [SITZUNG, REVISION, AKTIV, ABLAUF],
    };
    const b = spaltenBelegung(gedreht);
    // Genau die Verwechslung, die im Produkt kein Signal erzeugen wuerde:
    expect(b.last_activity_at, "die Auswertung bemerkt den Dreher nicht").toBe(ABLAUF);
    expect(b.expires_at).toBe(AKTIV);
    // Und die Nicht-Parameter-Zuweisung stoert sie nicht.
    expect(Object.keys(b).sort()).toEqual(["expires_at", "last_activity_at"]);
  });

  // ==============================================================================================
  // TEIL 3 — DER SAMMLER: jeder `cas`-Aufrufer im Store braucht eine Deckung.
  // ==============================================================================================
  //
  // Das ist die Haelfte der Auftragsidee („der gemeinsame Weg ist die Chance"), die in `tests/**`
  // baubar ist: nicht EINE Zusicherung IM `cas()`, sondern eine, die JEDEN Aufrufer erfasst.
  // Kommt ein neuer `cas(`-Aufruf mit einer drehbaren SET-Liste hinzu, faellt dieser Fall — auch
  // wenn niemand an diese Datei denkt.
  it("SAMMLER: jede drehbare SET-Liste hinter `cas(` ist hier gedeckt", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const ganz = readFileSync(join(wurzel, "services/reasoner/src/klara-policy-store.ts"), "utf8");

    // NUR die PG-Klasse durchsuchen. Die Methodennamen stehen auch im Interface und in
    // `InMemoryKlaraSessionRepo`; der erste Treffer waere dort gewesen, und die Erhebung lief
    // leer — beim ersten Lauf dieses Tests genau so gemessen. Der Fail-closed-Fall unten hat es
    // gemeldet, statt still gruen zu bleiben.
    const klasseAb = ganz.indexOf("export class PgKlaraSessionRepo");
    expect(klasseAb, "PgKlaraSessionRepo nicht gefunden — Datei umgebaut?").toBeGreaterThan(0);
    const quelle = ganz.slice(klasseAb);

    // Alle Methoden, die ueber `this.cas(` gehen — ueber den Quelltext erhoben, nicht gepflegt.
    const ueberCas = [...quelle.matchAll(/\n {2}(\w+)\(/g)]
      .map((m) => ({ name: m[1], ab: m.index ?? 0 }))
      .filter(({ ab }) => {
        // Bis zur naechsten Methode auf derselben Ebene schauen — nicht darueber hinaus.
        const rest = quelle.slice(ab + 1);
        const naechste = rest.slice(1).search(/\n {2}\w+\(/);
        const koerper = naechste < 0 ? rest : rest.slice(0, naechste + 1);
        return /return this\.cas\(/.test(koerper);
      })
      .map(({ name }) => name);

    // Fail-closed: eine leere Erhebung prueft nichts.
    expect(
      ueberCas.length,
      "die Erhebung laeuft leer — der Sammler prueft dann nichts",
    ).toBeGreaterThan(0);

    // Was dieser Test deckt. Waechst `ueberCas`, muss diese Liste mitwachsen.
    const GEDECKT = ["touchSession", "refreshResolution"];
    expect(
      [...ueberCas].sort(),
      "ein neuer `cas(`-Aufrufer ist hinzugekommen — er braucht hier eine eigene Deckung, " +
        "sonst ist seine SET-Liste drehbar ohne jedes Signal",
    ).toEqual([...GEDECKT].sort());
  });
});
