// GRAPH-BROWSER-RECHTE · die Fehlerdiagnose am Treiber, datenbankfrei geprüft.
//
// `pg.Client.prototype.query` wird hier VOR `installiere` durch einen Stellvertreter ersetzt, dessen
// Ausgang der Fall festlegt — so ist jeder Zweig der Diagnose ohne Datenbank erzwingbar. Am Ende
// steht der echte Treiber wieder da (geprüft).
import { Client } from "pg";
import { afterEach, describe, expect, it } from "vitest";
import { type PgVorfall, installiere } from "./pg-fehlerdiagnose";

type Abfrage = (this: unknown, ...a: unknown[]) => unknown;
const proto = Client.prototype as unknown as { query: Abfrage };
const ECHT = proto.query;

afterEach(() => {
  proto.query = ECHT;
});

const APPEND_ONCE =
  "INSERT INTO audit(seq,at,actor,action,target,payload,prev_hash,hash,event_id,hash_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING";
const RECORD =
  "INSERT INTO audit(seq,at,actor,action,target,payload,prev_hash,hash,hash_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)";
const kollision = Object.assign(
  new Error('duplicate key value violates unique constraint "audit_pkey"'),
  {
    code: "23505",
    constraint: "audit_pkey",
    table: "audit",
  },
);

function mitStellvertreter(ausgang: (sql: string) => unknown): PgVorfall[] {
  proto.query = function (this: unknown, ...a: unknown[]): unknown {
    const sql = String(a[0]);
    const letzte = a[a.length - 1];
    let fehler: unknown;
    let erg: unknown;
    try {
      erg = ausgang(sql);
    } catch (e) {
      fehler = e;
    }
    if (typeof letzte === "function") {
      (letzte as (f: unknown, e: unknown) => void)(fehler, erg);
      return undefined;
    }
    return fehler ? Promise.reject(fehler) : Promise.resolve(erg);
  };
  const vorfaelle: PgVorfall[] = [];
  installiere((v) => vorfaelle.push(v));
  return vorfaelle;
}

const warteKurz = (): Promise<void> => new Promise((weiter) => setTimeout(weiter, 0));

describe("GRAPH-BROWSER-RECHTE · pg-Fehlerdiagnose", () => {
  it("Kollision im Exactly-once-Pfad: SQLSTATE, Constraint, seq, Handlung, Ereigniskennung — und der Fehler erreicht den Aufrufer unverändert", async () => {
    const v = mitStellvertreter(() => {
      throw kollision;
    });
    const werte = [7, "t", "a", "ko.created", "k1", "{}", "p", "h", "ko.created:k1", 2];
    await expect(proto.query.call({}, APPEND_ONCE, werte)).rejects.toBe(kollision);
    await warteKurz();
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({
      ok: false,
      code: "23505",
      constraint: "audit_pkey",
      table: "audit",
      seq: 7,
      handlung: "ko.created",
      eventId: "ko.created:k1",
    });
  });

  it("erfolgreicher Prüfprotokoll-Eintrag (der zweite Schreiber) wird mit seq und Handlung gemeldet", async () => {
    const v = mitStellvertreter(() => ({ rows: [] }));
    await proto.query.call({}, RECORD, [
      7,
      "t",
      "a",
      "overlap.auto-created",
      "x",
      "{}",
      "p",
      "h",
      2,
    ]);
    await warteKurz();
    expect(v).toEqual([
      expect.objectContaining({ ok: true, seq: 7, handlung: "overlap.auto-created" }),
    ]);
    expect(v[0]?.eventId).toBeUndefined();
  });

  it("gewöhnliche erfolgreiche Anfragen erzeugen keinen Vorfall; gescheiterte jede einen", async () => {
    const v = mitStellvertreter((sql) => {
      if (sql.startsWith("SELECT kaputt")) throw Object.assign(new Error("x"), { code: "42P01" });
      return { rows: [] };
    });
    await proto.query.call({}, "SELECT 1", []);
    await expect(proto.query.call({}, "SELECT kaputt FROM nirgends", [])).rejects.toThrow("x");
    await warteKurz();
    expect(v.map((x) => [x.ok, x.code, x.sql])).toEqual([
      [false, "42P01", "SELECT kaputt FROM nirgends"],
    ]);
  });

  it("Rückrufform (so ruft `pool.query` den Client): Vorfall gemeldet, Rückruf erhält denselben Fehler", async () => {
    const v = mitStellvertreter(() => {
      throw kollision;
    });
    const erhalten = await new Promise<unknown>((fertig) => {
      proto.query.call({}, RECORD, [3, "t", "a", "kw.x", "x", "{}", "p", "h", 2], (f: unknown) =>
        fertig(f),
      );
    });
    expect(erhalten).toBe(kollision);
    expect(v[0]).toMatchObject({ ok: false, code: "23505", seq: 3, handlung: "kw.x" });
  });

  it("entfernen stellt den vorherigen Treiber wieder her", () => {
    const vorher = proto.query;
    const entferne = installiere(() => undefined);
    expect(proto.query).not.toBe(vorher);
    entferne();
    expect(proto.query).toBe(vorher);
  });
});
