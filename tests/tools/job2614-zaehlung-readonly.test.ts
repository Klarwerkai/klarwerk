import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { Pool } from "pg";
// JOB 2614 · D4 — DIE ZÄHLUNG AUS §2 IST BELEGT READ-ONLY UND STELLT DIE RICHTIGEN FRAGEN.
//
// Das Werkzeug tools/bodytext-zaehlung.ts liest die Live-Datenbank (Auftrag §2: „gelesen, nicht
// geschrieben"). Dieser Test pinnt beides OHNE Datenbank, am Modul selbst:
//   R1  Jedes abgesetzte Statement beginnt mit SELECT — kein INSERT/UPDATE/DELETE/ALTER/CREATE,
//       auch nicht versteckt. Das Werkzeug KANN nicht schreiben.
//   R2  Gegen einen aufzeichnenden Fake-Pool (Bauform wie tests/ko/g27-welle1-v1-v2-migration)
//       liefert `zaehlen` die Zahlen aus den Antworten und fragt die Projektionstabelle VOR den
//       projektionsabhängigen Statements ab.
//   R3  Fehlt die Projektionstabelle (älterer Bestand), gilt ehrlich: betroffen = alle mit
//       bodyHtml — und KEIN projektionsabhängiges Statement wird abgesetzt.
//   R4  (R-1410, BEFUND 19) Fassungsschutz: jede Betroffenen-Frage verlangt die GELTENDE
//       Projektionsfassung — eine Altfassungszeile mit Text gilt nicht als versorgt.
//   R5  (R-1410) Schreibschutz auf Sitzungsebene: der Pool öffnet jede Transaktion read-only.
import { describe, expect, it } from "vitest";
import { SEARCH_PROJECTION_VERSION } from "../../services/knowledge-object";
import {
  BODYTEXT_ZAEHLUNG_SQL,
  ZAEHLUNG_POOL_OPTIONEN,
  zaehlen,
  zaehlungAbbruchZeile,
  zaehlungAusfuehren,
} from "../../tools/bodytext-zaehlung";

function fakePool(antworten: (sql: string) => { rows: unknown[] }) {
  const calls: string[] = [];
  const pool = {
    query: async (sql: string) => {
      calls.push(sql);
      return antworten(sql);
    },
    end: async () => undefined,
  } as unknown as Pool;
  return { pool, calls };
}

describe("JOB 2614 · D4 · Zählung: read-only, richtige Fragen, ehrlicher Altbestands-Zweig", () => {
  it("R1 — ausschließlich SELECT: das Werkzeug kann nicht schreiben", () => {
    for (const [name, sql] of Object.entries(BODYTEXT_ZAEHLUNG_SQL)) {
      expect(
        sql.trim().toUpperCase().startsWith("SELECT"),
        `${name} beginnt nicht mit SELECT`,
      ).toBe(true);
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
    }
  });

  it("R2 — mit Projektionstabelle: die Zahlen kommen aus den Antworten, die Tabellenfrage läuft zuerst", async () => {
    const { pool, calls } = fakePool((sql) => {
      if (sql === BODYTEXT_ZAEHLUNG_SQL.projektionstabelle) {
        return { rows: [{ name: "ko_search_projections" }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.gesamt) {
        return { rows: [{ n: 12 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.mitBodyHtml) {
        return { rows: [{ n: 5 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.betroffen) {
        return { rows: [{ n: 2 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.betroffeneNachStatus) {
        return { rows: [{ status: "offen", n: 2 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.betroffeneOhneStufe) {
        return { rows: [{ n: 2 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.inventur) {
        return {
          rows: [
            { projection_version: 1, n: 2 },
            { projection_version: 2, n: 7 },
          ],
        };
      }
      throw new Error(`unerwartetes Statement: ${sql}`);
    });

    const b = await zaehlen(pool);

    expect(calls[0]).toBe(BODYTEXT_ZAEHLUNG_SQL.projektionstabelle);
    expect(b).toEqual({
      projektionstabelle: true,
      gesamt: 12,
      mitBodyHtml: 5,
      betroffen: 2,
      betroffeneNachStatus: [{ status: "offen", n: 2 }],
      betroffeneOhneStufe: 2,
      inventur: [
        { projectionVersion: 1, n: 2 },
        { projectionVersion: 2, n: 7 },
      ],
    });
  });

  it("R3 — ohne Projektionstabelle: betroffen = alle mit bodyHtml, kein projektionsabhängiges Statement", async () => {
    const { pool, calls } = fakePool((sql) => {
      if (sql === BODYTEXT_ZAEHLUNG_SQL.projektionstabelle) {
        return { rows: [{ name: null }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.gesamt) {
        return { rows: [{ n: 4 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.mitBodyHtml) {
        return { rows: [{ n: 3 }] };
      }
      throw new Error(`projektionsabhängiges Statement trotz fehlender Tabelle: ${sql}`);
    });

    const b = await zaehlen(pool);

    expect(b.projektionstabelle).toBe(false);
    expect(b.betroffen).toBe(3);
    expect(calls).toEqual([
      BODYTEXT_ZAEHLUNG_SQL.projektionstabelle,
      BODYTEXT_ZAEHLUNG_SQL.gesamt,
      BODYTEXT_ZAEHLUNG_SQL.mitBodyHtml,
    ]);
  });

  it("R4 — Fassungsschutz: jede Betroffenen-Frage verlangt die geltende Projektionsfassung", () => {
    const fragen = [
      BODYTEXT_ZAEHLUNG_SQL.betroffen,
      BODYTEXT_ZAEHLUNG_SQL.betroffeneNachStatus,
      BODYTEXT_ZAEHLUNG_SQL.betroffeneOhneStufe,
    ];
    for (const sql of fragen) {
      expect(sql).toContain(`p.projection_version = ${SEARCH_PROJECTION_VERSION}`);
    }
  });

  it("R5 — Schreibschutz auf Sitzungsebene: jede Transaktion des Pools ist read-only", () => {
    expect(ZAEHLUNG_POOL_OPTIONEN.options).toBe("-c default_transaction_read_only=on");
    expect(ZAEHLUNG_POOL_OPTIONEN.max).toBe(1);
  });
});

// ================================================================================================
// R-0623 (Ben, Nacharbeit 19) — DER CLI-FÄNGER GIBT KEINEN FEHLERTEXT AUS.
// ================================================================================================
//
// Befund: „Der unveränderte CLI-Fehlerfänger umgeht die Positivlisten und schreibt rohe
// Fehlernamen, Fehlermeldungen beziehungsweise String(fehler) auf stderr." Gefordert: feste
// Abbruchmeldung mit nur erlaubten Fehlerkennungen; Exit 2, einzeilige Ausgabe und Pool-Ende bleiben.
const MARKER = "kundeninhalt_marker_4711";

function abbruchFall(name: string, wurf: unknown) {
  return { name, wurf };
}

const FAELLE = [
  abbruchFall("Meldung mit Inhalt", new Error(`Key (email)=(${MARKER}@example.org) exists`)),
  abbruchFall(
    "freier Fehlername",
    Object.assign(new Error("x"), { name: `Befund ${MARKER}`, code: `C_${MARKER}` }),
  ),
  abbruchFall("kein Error-Objekt (String(fehler))", `Abbruch bei ${MARKER}`),
  abbruchFall(
    "mehrzeiliger Stacktext",
    Object.assign(new Error(`erste\n${MARKER}\nletzte`), {
      stack: `Error: ${MARKER}\n    at ${MARKER} (/srv/${MARKER}/tools/x.ts:1:1)`,
    }),
  ),
];

describe("R-0623 · R6 — der Fänger der Zählung: feste Zeile, Exit 2, Pool-Ende", () => {
  for (const fall of FAELLE) {
    it(`R6 · ${fall.name}: kein Inhalt auf stderr, eine Zeile, Exit 2, Pool beendet`, async () => {
      let beendet = 0;
      const pool = {
        query: async () => {
          throw fall.wurf;
        },
        end: async () => {
          beendet += 1;
        },
      } as unknown as Pool;
      const stdout: string[] = [];
      const stderr: string[] = [];

      const code = await zaehlungAusfuehren({
        env: { KLARWERK_DB_URL: "postgres://nur-ein-platzhalter" },
        neuerPool: () => pool,
        stdout: (t) => stdout.push(t),
        stderr: (t) => stderr.push(t),
      });

      expect(code).toBe(2);
      expect(beendet).toBe(1);
      expect(stdout).toEqual([]);
      const ausgabe = stderr.join("");
      expect(ausgabe).not.toContain(MARKER);
      expect(ausgabe.endsWith("\n")).toBe(true);
      expect(ausgabe.trimEnd().split("\n")).toHaveLength(1);
      expect(ausgabe.startsWith("[bodytext-zaehlung] Abbruch: ")).toBe(true);
    });
  }

  it("R6 · die erlaubten Kennungen bleiben: Typ, Code aus der Liste, Quelltextstelle", () => {
    const fehler = Object.assign(new Error(`connect ENOENT /tmp/${MARKER}`), { code: "ENOENT" });
    fehler.stack = `Error: ${fehler.message}\n    at verbinde (/srv/klarwerk/tools/bodytext-zaehlung.ts:9:3)`;
    const zeile = zaehlungAbbruchZeile(fehler);
    expect(zeile).not.toContain(MARKER);
    expect(zeile).toContain("Error (code ENOENT, herkunft tools/bodytext-zaehlung.ts:9:3)");
  });

  it("R6 · ohne Verbindungsangabe: feste Meldung, Exit 2, kein Pool", async () => {
    const stderr: string[] = [];
    let pools = 0;
    const code = await zaehlungAusfuehren({
      env: {},
      neuerPool: () => {
        pools += 1;
        return {} as Pool;
      },
      stdout: () => undefined,
      stderr: (t) => stderr.push(t),
    });
    expect(code).toBe(2);
    expect(pools).toBe(0);
    expect(stderr).toEqual([
      "KLARWERK_DB_URL (oder DATABASE_URL) setzen — kein Wert steht im Code.\n",
    ]);
  });
});

describe("R-0623 · R7 — der echte CLI-Prozess", () => {
  it("R7 · ein Verbindungsfehler mit Inhalt in Nutzer, Datenbank und Socketpfad: eine Zeile ohne Inhalt, Exit 2", () => {
    const lauf = spawnSync("node", ["--import", "tsx", "tools/bodytext-zaehlung.ts"], {
      cwd: join(__dirname, "..", ".."),
      encoding: "utf8",
      timeout: 90_000,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        TMPDIR: process.env.TMPDIR ?? "/tmp",
        KLARWERK_SKIP_KEYCHAIN: "1",
        KLARWERK_DB_URL: `postgres://${MARKER}@/${MARKER}?host=/tmp/${MARKER}`,
      },
    });
    const fehlerausgabe = lauf.stderr ?? "";
    expect(lauf.status, `stderr: ${fehlerausgabe}`).toBe(2);
    expect(fehlerausgabe).not.toContain(MARKER);
    expect(lauf.stdout ?? "").not.toContain(MARKER);
    const zeilen = fehlerausgabe.split("\n").filter((z) => z.trim() !== "");
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.startsWith("[bodytext-zaehlung] Abbruch: ")).toBe(true);
  });
});
