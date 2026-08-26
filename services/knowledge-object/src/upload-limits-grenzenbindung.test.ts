// ================================================================================================
// JOB 2521 · D1 — DIE UPLOAD-GRENZEN: ANZAHL GEGEN BYTES
// ================================================================================================
//
// DER BEFUND (JOB 2514 D1, Rang 3 von drei):
//
//     services/knowledge-object/src/upload-limits.ts:92-93
//     INSERT INTO upload_limits(key,max_attachments,max_attachment_bytes) VALUES($1,$2,$3)
//       ON CONFLICT (key) DO UPDATE SET max_attachments=$2, max_attachment_bytes=$3
//
//     Gegenmutation: max_attachments=$2 <-> max_attachment_bytes=$3
//       gegen  11 Testdateien des Dienstes:  150 passed  (150)   BLIND
//       gegen 127 Testdateien breit:        1589 passed (1589)   BLIND
//
// WARUM DAS GEFAEHRLICH IST. Beide Spalten sind ganze Zahlen — aber um Groessenordnungen
// verschieden: eine ANZAHL gegen eine BYTEANGABE. Vertauscht erlaubt das System Millionen Anhaenge
// zu je wenigen Bytes. Es gibt keinen Typfehler, keine Ausnahme, kein Signal — nur eine Grenze,
// die nicht mehr begrenzt. Eine Schutzvorkehrung, die still ihr Gegenteil tut.
//
// DIE BESONDERHEIT DIESER STELLE: EINE Anweisung traegt BEIDE Formen. Der `VALUES`-Teil schreibt
// beim ersten Mal, der `DO UPDATE SET`-Teil beim zweiten. Ein Dreher kann also in einem der beiden
// Zweige stecken und im anderen nicht — dann stimmen die Grenzen bei der Anlage und kippen beim
// ersten Aendern. Deshalb pruefen G1 und G2 die Zweige EINZELN.
//
// WIE GEPRUEFT WIRD — Muster aus JOB 2507, 2516 und der Kennwortbindung: nicht die Form der
// Anweisung, sondern der ZUSTAND NACH DEM AUFRUF. Der tragende Fall G3 faehrt den RUNDLAUF ueber
// `set` und `get`: Ein Dreher kommt beim Lesen zurueck, gleich in welchem Zweig er steckt.
//
// GRENZE, ausdruecklich: Das Doppel ist eine MINI-DATENBANK, kein PostgreSQL. Es versteht
// `INSERT … VALUES` mit `ON CONFLICT (spalte) DO UPDATE SET …` und ein einfaches `SELECT … WHERE`.
// Bewiesen ist die WIRKUNG DER BINDUNG. NICHT bewiesen ist, dass PostgreSQL denselben
// Konfliktzweig ebenso waehlt — das entscheidet dort der Primaerschluessel.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgUploadLimitsRepo } from "./upload-limits";

interface Zeile {
  [spalte: string]: unknown;
}

/**
 * Ein Doppel, das `INSERT … ON CONFLICT DO UPDATE SET` WIRKLICH ANWENDET — mit beiden Zweigen.
 *
 * `konfliktSpalte` entscheidet wie der Primaerschluessel: Gibt es die Zeile schon, laeuft der
 * UPDATE-Zweig; sonst der INSERT-Zweig. Nur so sind beide Wege einzeln pruefbar.
 */
function anwendendesDoppel(): { pool: Pool; zeilen: Zeile[]; zweige: string[] } {
  const zeilen: Zeile[] = [];
  const zweige: string[] = [];

  const belege = (ziel: Zeile, liste: string, p: readonly unknown[]) => {
    for (const t of liste.matchAll(/(\w+)\s*=\s*(?:\$(\d+)|'([^']*)')/g)) {
      ziel[t[1] ?? ""] = t[2] !== undefined ? p[Number(t[2]) - 1] : t[3];
    }
  };

  const query = async (text: string, params?: readonly unknown[]) => {
    const p = params ?? [];
    const roh = text.trim().replace(/\s+/g, " ");

    const ins =
      /^INSERT\s+INTO\s+\w+\s*\(([^)]*)\)\s*VALUES\s*\(([^)]*)\)(?:\s+ON\s+CONFLICT\s*\((\w+)\)\s*DO\s+UPDATE\s+SET\s+(.+))?$/i.exec(
        roh,
      );
    if (ins) {
      const spalten = (ins[1] ?? "").split(",").map((s) => s.trim());
      const stellen = [...(ins[2] ?? "").matchAll(/\$(\d+)/g)].map((t) => Number(t[1]));
      const neue: Zeile = {};
      spalten.forEach((spalte, i) => {
        const stelle = stellen[i];
        neue[spalte] = stelle === undefined ? undefined : p[stelle - 1];
      });

      const konfliktSpalte = ins[3];
      const vorhanden = konfliktSpalte
        ? zeilen.find((z) => z[konfliktSpalte] === neue[konfliktSpalte])
        : undefined;

      if (vorhanden && ins[4]) {
        zweige.push("DO UPDATE");
        belege(vorhanden, ins[4], p);
      } else if (!vorhanden) {
        zweige.push("VALUES");
        zeilen.push(neue);
      } else {
        zweige.push("DO NOTHING");
      }
      return { rows: [], rowCount: 1 };
    }

    const sel = /^SELECT\s+.+?\s+FROM\s+\w+\s+WHERE\s+(.+)$/i.exec(roh);
    if (sel) {
      const treffer = zeilen.filter((z) => {
        for (const t of (sel[1] ?? "").matchAll(/(\w+)\s*=\s*(?:\$(\d+)|'([^']*)')/g)) {
          const wert = t[2] !== undefined ? p[Number(t[2]) - 1] : t[3];
          if (z[t[1] ?? ""] !== wert) return false;
        }
        return true;
      });
      return { rows: treffer, rowCount: treffer.length };
    }

    return { rows: [], rowCount: 0 };
  };

  return { pool: { query } as unknown as Pool, zeilen, zweige };
}

// Die beiden Werte sind bewusst UM GROESSENORDNUNGEN verschieden — genau darin liegt der Schaden:
// Vertauscht erlaubt das System 10 Millionen Anhaenge zu je 5 Bytes.
const ANZAHL = 5;
const BYTES = 10_000_000;

describe("JOB 2521 · die Upload-Grenzen: Anzahl gegen Bytes", () => {
  it("G1 · der VALUES-Zweig: beim ersten Setzen landet jede Zahl in ihrer Spalte", async () => {
    const d = anwendendesDoppel();
    await new PgUploadLimitsRepo(d.pool).set({
      maxAttachments: ANZAHL,
      maxAttachmentBytes: BYTES,
    });

    expect(d.zweige, "der Anlagezweig lief nicht").toEqual(["VALUES"]);
    const z = d.zeilen[0];
    // DER KERN. Vertauscht stuende die Byteangabe in der Anzahl — eine Grenze, die nicht mehr
    // begrenzt, ohne Typfehler und ohne Signal.
    expect(z?.max_attachments, "die Anzahl traegt den Bytewert").toBe(ANZAHL);
    expect(z?.max_attachment_bytes, "die Byteangabe traegt die Anzahl").toBe(BYTES);
  });

  it("G2 · der DO-UPDATE-Zweig: beim zweiten Setzen ebenso", async () => {
    // Die Besonderheit dieser Stelle: EINE Anweisung, ZWEI Zweige. Ein Dreher kann in nur einem
    // stecken — dann stimmen die Grenzen bei der Anlage und kippen beim ersten Aendern.
    const d = anwendendesDoppel();
    const repo = new PgUploadLimitsRepo(d.pool);

    await repo.set({ maxAttachments: 1, maxAttachmentBytes: 1_000 });
    await repo.set({ maxAttachments: ANZAHL, maxAttachmentBytes: BYTES });

    expect(d.zweige, "der Konfliktzweig lief nicht").toEqual(["VALUES", "DO UPDATE"]);
    expect(d.zeilen, "das zweite Setzen hat eine zweite Zeile angelegt").toHaveLength(1);
    const z = d.zeilen[0];
    expect(z?.max_attachments, "die Anzahl traegt nach der Aenderung den Bytewert").toBe(ANZAHL);
    expect(z?.max_attachment_bytes, "die Byteangabe traegt nach der Aenderung die Anzahl").toBe(
      BYTES,
    );
  });

  it("G3 · DER RUNDLAUF: was gesetzt wurde, kommt unveraendert zurueck", async () => {
    // Das ist die eigentliche Zusage. Ein Dreher kommt hier zurueck, gleich in welchem Zweig er
    // steckt — und die Zahlen sind so verschieden, dass die Meldung fuer sich spricht.
    const d = anwendendesDoppel();
    const repo = new PgUploadLimitsRepo(d.pool);

    await repo.set({ maxAttachments: ANZAHL, maxAttachmentBytes: BYTES });
    const gelesen = await repo.get();

    expect(gelesen, "die gesetzten Grenzen sind nicht auffindbar").not.toBeNull();
    expect(
      gelesen?.maxAttachments,
      "die erlaubte ANZAHL kommt als Byteangabe zurueck — die Grenze begrenzt nicht mehr",
    ).toBe(ANZAHL);
    expect(gelesen?.maxAttachmentBytes, "die BYTEGRENZE kommt als Anzahl zurueck").toBe(BYTES);

    // Und nach einer Aenderung ebenso — der Rundlauf ueber beide Zweige.
    await repo.set({ maxAttachments: 3, maxAttachmentBytes: 2_000_000 });
    const danach = await repo.get();
    expect(danach?.maxAttachments).toBe(3);
    expect(danach?.maxAttachmentBytes).toBe(2_000_000);
  });

  it("G4 · KALIBRIERUNG: das Doppel waehlt die Zweige richtig und ordnet nicht wahllos zu", async () => {
    // Ohne diesen Fall waeren G1 bis G3 auch dann gruen, wenn das Doppel gar nichts schreibt oder
    // immer denselben Zweig nimmt.
    const d = anwendendesDoppel();
    await d.pool.query("INSERT INTO upload_limits(key,max_attachments) VALUES($1,$2)", ["k", 7]);
    expect(d.zeilen[0], "das Doppel schreibt nicht").toEqual({ key: "k", max_attachments: 7 });
    expect(d.zweige).toEqual(["VALUES"]);

    // Gegenprobe 1: eine vertauschte Werteliste MUSS eine andere Zeile ergeben.
    const e = anwendendesDoppel();
    await e.pool.query(
      "INSERT INTO upload_limits(key,max_attachments,max_attachment_bytes) VALUES($1,$3,$2)",
      ["k", 5, 999],
    );
    expect(e.zeilen[0]?.max_attachments, "das Doppel sieht einen Dreher nicht").toBe(999);

    // Gegenprobe 2: ein ANDERER Schluessel darf NICHT in den Konfliktzweig laufen.
    const f = anwendendesDoppel();
    await f.pool.query(
      "INSERT INTO upload_limits(key,max_attachments) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET max_attachments=$2",
      ["a", 1],
    );
    await f.pool.query(
      "INSERT INTO upload_limits(key,max_attachments) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET max_attachments=$2",
      ["b", 2],
    );
    expect(f.zweige, "das Doppel waehlt den Konfliktzweig bei fremdem Schluessel").toEqual([
      "VALUES",
      "VALUES",
    ]);
    expect(f.zeilen).toHaveLength(2);
  });
});
