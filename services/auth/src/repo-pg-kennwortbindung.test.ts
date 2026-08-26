// ================================================================================================
// JOB 2521 · D1 — SALZ UND HASH DES KENNWORTS: LANDEN SIE IN IHRER SPALTE?
// ================================================================================================
//
// DER BEFUND (JOB 2514 D1, Rang 2 von drei; Rangfolge in JOB 2521 gegen die Korrektur geprueft):
//
//     services/auth/src/repo-pg.ts:167   INSERT INTO users(id,name,email,password_salt,
//                                        password_hash,role,approved,created_at) VALUES($1..$8)
//     services/auth/src/repo-pg.ts:213   UPDATE users SET name=$2,email=$3,password_salt=$4,
//                                        password_hash=$5,… WHERE id=$1
//
//     Gegenmutation: password_salt=$4 <-> password_hash=$5
//       gegen 10 Testdateien (Reihenmessung):  BLIND
//       gegen  4 Testdateien des Dienstes:     BLIND
//       gegen 473 Testdateien breit:           der gemeldete Treffer war Rohsocket-Vorbestand
//
// WARUM DAS GEFAEHRLICH IST. Salz und Hash sind beide Hexzeichenketten. Vertauscht prueft die
// Anmeldung den Hash gegen das Salz — KEIN NUTZER KAEME MEHR HEREIN, und der Fehler laege in den
// Daten, nicht im Code, den man beim Suchen zuerst ansieht. Die Wiederherstellung verlangt, jedes
// Kennwort neu zu setzen. Die Stelle steht ZWEIMAL im Repo (insert und update): ein Dreher in nur
// einer der beiden Formen spaltet Alt- gegen Neubestand, und dann stimmt keine Vermutung mehr.
//
// WIE DIESE DATEI ES PRUEFT — Muster aus JOB 2507 und 2516: nicht die Form der Anweisung, sondern
// den ZUSTAND NACH DEM AUFRUF. Das Doppel WENDET INSERT und UPDATE an; danach wird die Zeile
// gelesen. Der tragende Fall K3 geht weiter und faehrt den RUNDLAUF: schreiben, wieder auslesen,
// vergleichen. Ein Dreher ueberlebt das nicht — er kommt beim Lesen zurueck.
//
// GRENZE, ausdruecklich: Das Doppel ist eine MINI-DATENBANK, kein PostgreSQL. Es versteht
// `INSERT INTO t(spalten) VALUES($n,…)`, `UPDATE t SET spalte=$n[,…] WHERE …` und ein einfaches
// `SELECT * FROM t WHERE spalte=$n`. Bewiesen ist die WIRKUNG DER BINDUNG — welcher Wert in
// welcher Spalte landet und was beim Lesen zurueckkommt. NICHT bewiesen ist, dass PostgreSQL
// dieselben Anweisungen ebenso ausfuehrt.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgUserRepo, type User } from "../index";

interface Zeile {
  [spalte: string]: unknown;
}

/** Ein Doppel, das INSERT, UPDATE und SELECT WIRKLICH ANWENDET, statt sie zu protokollieren. */
function anwendendesDoppel(): { pool: Pool; zeilen: Zeile[] } {
  const zeilen: Zeile[] = [];

  const passt = (zeile: Zeile, bedingung: string, p: readonly unknown[]): boolean => {
    for (const t of bedingung.matchAll(/(\w+)\s*=\s*(?:\$(\d+)|'([^']*)')/g)) {
      const wert = t[2] !== undefined ? p[Number(t[2]) - 1] : t[3];
      if (zeile[t[1] ?? ""] !== wert) {
        return false;
      }
    }
    return true;
  };

  const query = async (text: string, params?: readonly unknown[]) => {
    const p = params ?? [];
    const roh = text.trim();

    const ins = /^INSERT\s+INTO\s+\w+\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)/i.exec(roh);
    if (ins) {
      const spalten = (ins[1] ?? "").split(",").map((s) => s.trim());
      const stellen = [...(ins[2] ?? "").matchAll(/\$(\d+)/g)].map((t) => Number(t[1]));
      const zeile: Zeile = {};
      spalten.forEach((spalte, i) => {
        const stelle = stellen[i];
        zeile[spalte] = stelle === undefined ? undefined : p[stelle - 1];
      });
      zeilen.push(zeile);
      return { rows: [], rowCount: 1 };
    }

    const upd = /^UPDATE\s+\w+\s+SET\s+([\s\S]*?)\s+WHERE\s+([\s\S]*)$/i.exec(roh);
    if (upd) {
      let getroffen = 0;
      for (const zeile of zeilen) {
        if (!passt(zeile, upd[2] ?? "", p)) continue;
        getroffen += 1;
        for (const t of (upd[1] ?? "").matchAll(/(\w+)\s*=\s*(?:\$(\d+)|'([^']*)')/g)) {
          zeile[t[1] ?? ""] = t[2] !== undefined ? p[Number(t[2]) - 1] : t[3];
        }
      }
      return { rows: [], rowCount: getroffen };
    }

    const sel = /^SELECT\s+[\s\S]*?\s+FROM\s+\w+\s+WHERE\s+([\s\S]*)$/i.exec(roh);
    if (sel) {
      const treffer = zeilen.filter((z) => passt(z, sel[1] ?? "", p));
      return { rows: treffer, rowCount: treffer.length };
    }

    return { rows: [], rowCount: 0 };
  };

  return { pool: { query } as unknown as Pool, zeilen };
}

// Unterscheidbare Sentinels in der FORM echter Werte: beides Hexzeichenketten gleicher Laenge.
// Zwei Werte, die sich nur im Inhalt unterscheiden, nicht in der Gestalt — sonst waere ein Dreher
// schon ohne Test zu sehen und der Fall unehrlich.
const SALZ = `5a${"1".repeat(30)}`;
const HASH = `4b${"2".repeat(30)}`;

function nutzer(): User {
  return {
    id: "nutzer-1",
    name: "Anna Beispiel",
    email: "anna@beispiel.test",
    passwordSalt: SALZ,
    passwordHash: HASH,
    role: "experte",
    approved: true,
    createdAt: "2026-08-26T10:00:00.000Z",
  };
}

describe("JOB 2521 · Salz und Hash des Kennworts", () => {
  it("K1 · insert: password_salt und password_hash landen JEDER in seiner Spalte", async () => {
    const d = anwendendesDoppel();
    await new PgUserRepo(d.pool).insert(nutzer());

    const z = d.zeilen[0];
    expect(z, "es wurde nichts geschrieben").toBeDefined();
    // DER KERN. Vertauscht stuende das Salz im Hashfeld — beide Hexketten gleicher Laenge,
    // kein Typfehler, kein Signal, und die Anmeldung schlaegt ab dann immer fehl.
    expect(z?.password_salt, "das Salz steht in der falschen Spalte").toBe(SALZ);
    expect(z?.password_hash, "der Kennworthash steht in der falschen Spalte").toBe(HASH);

    // Und die Nachbarn, damit die Probe vollstaendig ist — `name` und `email` sind ebenfalls
    // zwei freie Zeichenketten in Folge und waeren ebenso vertauschbar.
    expect(z?.id).toBe("nutzer-1");
    expect(z?.name, "der Name steht in der falschen Spalte").toBe("Anna Beispiel");
    expect(z?.email, "die Adresse steht in der falschen Spalte").toBe("anna@beispiel.test");
    expect(z?.role).toBe("experte");
    expect(z?.approved).toBe(true);
  });

  it("K2 · update: dieselbe Zusage auf dem zweiten Schreibweg", async () => {
    // Die Stelle steht ZWEIMAL im Repo. Ein Dreher in nur einer der beiden Formen spaltet
    // Alt- gegen Neubestand — deshalb wird auch der Aenderungsweg geprueft, nicht nur der Anlageweg.
    const d = anwendendesDoppel();
    const repo = new PgUserRepo(d.pool);
    await repo.insert(nutzer());

    const neuesSalz = `9c${"3".repeat(30)}`;
    const neuerHash = `8d${"4".repeat(30)}`;
    await repo.update({ ...nutzer(), passwordSalt: neuesSalz, passwordHash: neuerHash });

    const z = d.zeilen[0];
    expect(z?.password_salt, "das Salz steht nach der Aenderung in der falschen Spalte").toBe(
      neuesSalz,
    );
    expect(z?.password_hash, "der Hash steht nach der Aenderung in der falschen Spalte").toBe(
      neuerHash,
    );
    expect(d.zeilen, "das UPDATE hat eine zweite Zeile angelegt").toHaveLength(1);
  });

  it("K3 · DER RUNDLAUF: was geschrieben wurde, kommt unveraendert zurueck", async () => {
    // Das ist die eigentliche Zusage und sie ist staerker als K1: Nicht welche Spalte welchen Wert
    // traegt, sondern ob der Nutzer nach Schreiben und Lesen DERSELBE ist. Genau daran haengt die
    // Anmeldung — sie liest Salz und Hash und rechnet damit. Ein Dreher kommt hier zurueck.
    const d = anwendendesDoppel();
    const repo = new PgUserRepo(d.pool);
    const anna = nutzer();

    await repo.insert(anna);
    const gelesen = await repo.findById("nutzer-1");

    expect(gelesen, "der angelegte Nutzer ist nicht auffindbar").toBeDefined();
    expect(
      gelesen?.passwordSalt,
      "das Salz kommt vertauscht zurueck — keine Anmeldung wuerde mehr gelingen",
    ).toBe(SALZ);
    expect(gelesen?.passwordHash, "der Kennworthash kommt vertauscht zurueck").toBe(HASH);
    // Und beide sind nicht etwa gleich geworden — das waere ein zweiter Weg, den Dreher zu
    // verstecken.
    expect(gelesen?.passwordSalt).not.toBe(gelesen?.passwordHash);
    expect(gelesen?.email, "die Adresse kommt vertauscht zurueck").toBe("anna@beispiel.test");
  });

  it("K4 · KALIBRIERUNG: das Doppel ordnet wirklich zu — und nicht wahllos", async () => {
    // Ohne diesen Fall waeren K1 bis K3 auch dann gruen, wenn das Doppel gar nichts schreibt.
    // Beide Richtungen, an Anweisungen von Hand.
    const d = anwendendesDoppel();
    await d.pool.query("INSERT INTO users(id,password_salt,password_hash) VALUES($1,$2,$3)", [
      "x",
      "SALZ",
      "HASH",
    ]);
    expect(d.zeilen[0], "das Doppel schreibt nicht").toEqual({
      id: "x",
      password_salt: "SALZ",
      password_hash: "HASH",
    });

    // Gegenprobe: eine vertauschte Werteliste MUSS eine andere Zeile ergeben — sonst koennte das
    // Doppel den Dreher gar nicht sichtbar machen und alle Faelle oben waeren wertlos.
    const e = anwendendesDoppel();
    await e.pool.query("INSERT INTO users(id,password_salt,password_hash) VALUES($1,$3,$2)", [
      "x",
      "SALZ",
      "HASH",
    ]);
    expect(e.zeilen[0]?.password_salt, "das Doppel sieht einen Dreher nicht").toBe("HASH");

    // Und das UPDATE trifft nur, was seine Bedingung nennt.
    const f = anwendendesDoppel();
    await f.pool.query("INSERT INTO users(id,name) VALUES($1,$2)", ["a", "Anna"]);
    await f.pool.query("UPDATE users SET name=$2 WHERE id=$1", ["fremd", "Falsch"]);
    expect(f.zeilen[0]?.name, "das UPDATE trifft ohne passende Bedingung").toBe("Anna");
  });
});
