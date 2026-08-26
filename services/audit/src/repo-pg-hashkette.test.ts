// ================================================================================================
// JOB 2516 · D1 — DIE HASHKETTE DES PRUEFPROTOKOLLS: HAELT SIE, WENN MAN NACHLIEST?
// ================================================================================================
//
// DER BEFUND, der diesen Bau ausgeloest hat (JOB 2514 D1, Rang 1 von drei):
//
//     services/audit/src/repo-pg.ts:98
//     INSERT INTO audit(seq,at,actor,action,target,payload,prev_hash,hash,hash_version)
//     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
//
//     Gegenmutation: prev_hash=$7 <-> hash=$8
//       gegen  5 Testdateien des Dienstes:   74 passed   (74)   BLIND
//       gegen 96 Testdateien breit:        1099 passed (1099)   BLIND
//
// WARUM DAS DER SCHWERSTE DER 42 FAELLE IST. Diese Kette ist das Mittel, mit dem sich Manipulation
// am Pruefprotokoll nachweisen laesst: Jeder Eintrag traegt den Hash seines Vorgaengers.
// Vertauschen sich `prev_hash` und `hash`, verweist jeder Eintrag auf SICH SELBST — der
// Vorgaengerbezug ist fort, und die Pruefsumme, die Faelschung aufdecken soll, ist selbst falsch.
// Beide Werte sind Hexzeichenketten gleicher Laenge: kein Typfehler, keine Ausnahme, kein Signal.
//
// WARUM ES NIEMAND SAH. Der einzige Test, der `repo-pg.ts` unmittelbar prueft, ist
// `repo-pg.integration.test.ts` — und die vitest-Konfiguration schliesst `**/*.integration.test.ts`
// aus. Der Nachweis existiert also, er laeuft nur nie. Dasselbe Muster wie bei `withPgTx`
// (JOB 2375 D2): eine Zusicherung, die im schnellen Gate nicht ankommt, schuetzt nichts.
//
// WIE DIESE DATEI ES ANDERS MACHT — das Muster aus JOB 2507: Sie prueft nicht die FORM der
// Anweisung, sondern den ZUSTAND NACH DEM AUFRUF. Das Doppel unten WENDET das INSERT an; danach
// wird die geschriebene Zeile gelesen. Und der tragende Fall H2 prueft nicht einmal einzelne
// Spalten, sondern die KETTE: Traegt der zweite Eintrag als `prev_hash` den `hash` des ersten?
// Ein Dreher kann das nicht ueberleben, gleich in welcher Form er geschrieben ist.
//
// GRENZE, ausdruecklich: Das Doppel ist eine MINI-DATENBANK, kein PostgreSQL. Es versteht
// `INSERT INTO <tabelle>(<spalten>) VALUES($n,…)` und ordnet Spalte fuer Spalte zu. Bewiesen ist
// damit die WIRKUNG DER BINDUNG — welcher Wert in welcher Spalte landet. NICHT bewiesen ist, dass
// PostgreSQL dieselbe Anweisung ebenso ausfuehrt; dafuer gibt es den Integrationstest, der hier
// gerade nicht laeuft.
import type { Pool, PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import { type AuditEntry, PgAuditRepo } from "../index";

interface Zeile {
  [spalte: string]: unknown;
}

/**
 * Ein Doppel, das INSERT-Anweisungen WIRKLICH ANWENDET, statt sie zu protokollieren.
 *
 * Der Unterschied ist der ganze Punkt: Wer aufzeichnet, was gesendet wurde, sieht eine vertauschte
 * Spaltenbindung nicht — die Parameterliste bleibt ja unveraendert. Wer nachliest, sieht sie.
 */
function anwendendesDoppel(): { pool: Pool; zeilen: Zeile[] } {
  const zeilen: Zeile[] = [];

  const query = async (text: string, params?: readonly unknown[]) => {
    const p = params ?? [];
    // `INSERT INTO audit(a,b,c) VALUES($1,$2,$3)` — die Spaltenliste bildet die Zuordnung.
    const m = /INSERT\s+INTO\s+\w+\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)/i.exec(text);
    if (!m) {
      return { rows: [], rowCount: 0 };
    }
    const spalten = (m[1] ?? "").split(",").map((s) => s.trim());
    const stellen = [...(m[2] ?? "").matchAll(/\$(\d+)/g)].map((t) => Number(t[1]));
    const zeile: Zeile = {};
    spalten.forEach((spalte, i) => {
      const stelle = stellen[i];
      zeile[spalte] = stelle === undefined ? undefined : p[stelle - 1];
    });
    zeilen.push(zeile);
    return { rows: [{ seq: zeile.seq }], rowCount: 1 };
  };

  const connect = async (): Promise<PoolClient> =>
    ({ query, release: () => undefined }) as unknown as PoolClient;

  return { pool: { query, connect } as unknown as Pool, zeilen };
}

function eintrag(seq: number, prevHash: string, hash: string): AuditEntry {
  return {
    seq,
    at: `2026-08-26T10:0${seq}:00.000Z`,
    actor: `anna-${seq}`,
    action: `handlung-${seq}`,
    target: `ziel-${seq}`,
    payload: { nummer: seq },
    prevHash,
    hash,
  };
}

// Unterscheidbare Sentinels in der FORM echter Hashes: gleiche Laenge, gleiches Alphabet.
// Nur so ist ein Dreher zwischen ihnen ueberhaupt von einem Zufall zu unterscheiden — und nur so
// bleibt der Fall ehrlich: zwei Werte, die sich nur im Inhalt unterscheiden, nicht in der Gestalt.
const HASH_0 = "0".repeat(64);
const HASH_1 = `1${"a".repeat(63)}`;
const HASH_2 = `2${"b".repeat(63)}`;

describe("JOB 2516 · die Hashkette des Pruefprotokolls", () => {
  it("H1 · append: prev_hash und hash landen JEDER in seiner Spalte", async () => {
    const d = anwendendesDoppel();
    await new PgAuditRepo(d.pool).append(eintrag(1, HASH_0, HASH_1));

    const z = d.zeilen[0];
    expect(z, "es wurde nichts geschrieben").toBeDefined();
    // DER KERN. Bei vertauschten Platzhaltern stuenden die beiden Werte ueber Kreuz — beide
    // Hexketten gleicher Laenge, kein Typfehler, kein Signal.
    expect(z?.prev_hash, "der Vorgaengerhash steht in der falschen Spalte").toBe(HASH_0);
    expect(z?.hash, "der eigene Hash steht in der falschen Spalte").toBe(HASH_1);

    // Und die uebrigen Felder, damit die Probe vollstaendig ist.
    expect(z?.seq).toBe(1);
    expect(z?.actor).toBe("anna-1");
    expect(z?.action).toBe("handlung-1");
    expect(z?.target).toBe("ziel-1");
    expect(z?.hash_version, "die Hashversion wird nicht ausdruecklich geschrieben").toBe(1);
  });

  it("H2 · DIE KETTE HAELT: der zweite Eintrag traegt als prev_hash den hash des ersten", async () => {
    // Das ist die eigentliche Zusage des Pruefprotokolls, und sie ist staerker als H1: Sie prueft
    // keine einzelne Spalte, sondern die BEZIEHUNG zwischen zwei geschriebenen Zeilen. Ein Dreher
    // laesst jeden Eintrag auf sich selbst zeigen — die Kette zerfaellt in lauter Schleifen.
    const d = anwendendesDoppel();
    const repo = new PgAuditRepo(d.pool);

    await repo.append(eintrag(1, HASH_0, HASH_1));
    await repo.append(eintrag(2, HASH_1, HASH_2));

    const [erste, zweite] = d.zeilen;
    expect(d.zeilen).toHaveLength(2);
    expect(
      zweite?.prev_hash,
      "die Kette ist gebrochen: der zweite Eintrag zeigt nicht auf den ersten",
    ).toBe(erste?.hash);
    expect(zweite?.hash, "der zweite Eintrag traegt seinen eigenen Hash nicht").toBe(HASH_2);
    // Und kein Eintrag zeigt auf SICH SELBST — genau das waere die Folge des Drehers.
    for (const z of d.zeilen) {
      expect(z.prev_hash, "ein Eintrag verweist auf sich selbst").not.toBe(z.hash);
    }
  });

  it("H3 · appendOnce: dieselbe Zusage auf dem zweiten Schreibweg", async () => {
    // `appendOnce` fuehrt dieselbe Spaltenliste plus `event_id`. Die Stelle wurde in JOB 2514
    // getrennt erhoben (`repo-pg.ts:117`) und war ebenso blind.
    const d = anwendendesDoppel();
    await new PgAuditRepo(d.pool).appendOnce({
      ...eintrag(7, HASH_0, HASH_1),
      eventId: "ko.created:k1",
    });

    const z = d.zeilen[0];
    expect(z?.prev_hash, "der Vorgaengerhash steht in der falschen Spalte").toBe(HASH_0);
    expect(z?.hash, "der eigene Hash steht in der falschen Spalte").toBe(HASH_1);
    expect(z?.event_id, "die Ereigniskennung steht in der falschen Spalte").toBe("ko.created:k1");
    expect(z?.seq).toBe(7);
  });

  it("H4 · KALIBRIERUNG: das Doppel ordnet wirklich zu — und nicht wahllos", async () => {
    // Ohne diesen Fall waeren H1 bis H3 auch dann gruen, wenn das Doppel gar nichts schreibt oder
    // jeder Spalte denselben Wert gibt. Beide Richtungen, an einer Anweisung von Hand.
    const d = anwendendesDoppel();
    await d.pool.query("INSERT INTO audit(seq,prev_hash,hash) VALUES($1,$2,$3)", [
      9,
      "VORGAENGER",
      "EIGENER",
    ]);
    expect(d.zeilen[0], "das Doppel schreibt nicht").toEqual({
      seq: 9,
      prev_hash: "VORGAENGER",
      hash: "EIGENER",
    });

    // Gegenprobe: eine vertauschte Werteliste MUSS eine andere Zeile ergeben — sonst koennte das
    // Doppel den Dreher gar nicht sichtbar machen, und alle Faelle oben waeren wertlos.
    const e = anwendendesDoppel();
    await e.pool.query("INSERT INTO audit(seq,prev_hash,hash) VALUES($1,$3,$2)", [
      9,
      "VORGAENGER",
      "EIGENER",
    ]);
    expect(e.zeilen[0]?.prev_hash, "das Doppel sieht einen Dreher nicht").toBe("EIGENER");
    expect(e.zeilen[0]?.hash).toBe("VORGAENGER");

    // Und eine Anweisung, die kein INSERT ist, schreibt nichts.
    const f = anwendendesDoppel();
    await f.pool.query("SELECT 1", []);
    expect(f.zeilen, "das Doppel schreibt bei beliebigen Anweisungen").toEqual([]);
  });
});
