// ================================================================================================
// JOB 1060 · D7 — DIE GEMEINSAME SPERRDOMÄNE, ALS SQL-VERTRAG
// ================================================================================================
//
// DER BEFUND AUS DEM VOLLURTEIL (`BEN2-PRUEFUNG-JOB-1060-D6.md:3`): „Der Prototyp verwendet
// Dateilock, `epoche.json`, `journal.json` und `audit.log`, während die benannten Produktpfade
// PostgreSQL-Dienste sind. Es fehlt die konkrete gemeinsame DB-Sperrdomäne — Tabelle/Zeile oder
// Advisory-Key, atomarer SQL-CAS, monotone Fencingpersistenz, Transaktionsgrenzen und
// Auditpersistenz — über die `service.ts` und `overlap-service.ts` wirklich konkurrieren."
//
// ================================================================================================
// WAS HIER GEMESSEN WIRD — UND WARUM KEIN DRITTES MODELL ENTSTEHT.
// ================================================================================================
// D6 hat ein DATEIMODELL gebaut und ist genau daran gescheitert: es beweist die Kausalität, sagt
// aber nichts über PostgreSQL. Ein handgeschriebener SQL-Nachbau wäre derselbe Fehler mit anderem
// Vorzeichen — eine zweite Wahrheit über das Verhalten der Datenbank, die von der echten abweichen
// kann, ohne dass es auffällt.
//
// Deshalb wird hier NICHT das Rennen simuliert. Die Rennentscheidung trifft die Datenbank; messbar
// ist, ob der Adapter ihr die RICHTIGE FRAGE stellt und auf ihre Antwort richtig reagiert:
//
//   · welches SQL wirklich abgesetzt wird (ein Statement, eine Bedingung, `RETURNING`),
//   · dass der erwartete Vorzustand IN der Bedingung steht und nicht in einer vorherigen Prüfung,
//   · dass `rowCount = 0` fail-closed als „nicht bekommen" gilt und nichts geschrieben wird,
//   · dass Stand und Audit in EINER Transaktionsklammer liegen,
//   · dass das Fencing-Token serverseitig verglichen wird, nicht im Anwendungscode.
//
// Das ist exakt die Technik, mit der das Haus dieselbe Frage an anderer Stelle schon beantwortet
// (`services/knowledge-object/src/search-projection-repo-pg.test.ts:519` — „die Freigabe hält eine
// EXKLUSIVE Sperre auf der Steuerzeile"). Sie ersetzt keinen echten Zwei-Verbindungs-Lauf; der
// bleibt Auflage 3 und ist in dieser Bahn blockiert (kein PostgreSQL installiert — s. Rückgabe).
import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { beforeAll, describe, expect, it } from "vitest";

// ================================================================================================
// WARUM DER MODULZUGRIFF DYNAMISCH IST — und nicht als gewöhnlicher `import` oben steht.
// ================================================================================================
// Baupflicht 2 des Auftrags: „Syntax-, Import- und Pfadfehler zählen nicht als Red-first." Ein
// statischer Import auf ein noch nicht gebautes Modul lässt die ganze Datei gar nicht erst laden —
// vitest meldet dann „Failed to load url … 0 test", und das ist ein kaputtes Testgerüst, keine
// Messung am Produkt.
//
// Über einen Spezifizierer in einer VARIABLEN wird daraus eine ZUSICHERUNG: die Datei lädt, jeder
// Fall läuft, und ein fehlendes Modul scheitert mit einer lesbaren Aussage darüber, WAS fehlt.
const MODULPFAD = "../../services/db-tx/src/write-fence";

interface FenceGrant {
  readonly key: string;
  readonly owner: string;
  readonly token: number;
}
interface FenceModul {
  fenceKey: (art: string, a: string, b?: string) => string;
  PgWriteFence: new (
    pool: Pool,
  ) => {
    acquire(key: string, owner: string, leaseMs: number): Promise<FenceGrant | null>;
    withFence<T>(
      grant: FenceGrant,
      fn: (q: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) => Promise<T>,
    ): Promise<T>;
  };
}

let modul: FenceModul | null = null;
let ladefehler = "";

beforeAll(async () => {
  try {
    modul = (await import(/* @vite-ignore */ MODULPFAD)) as FenceModul;
  } catch (err) {
    ladefehler = err instanceof Error ? err.message : String(err);
  }
});

/** Das Modul oder eine Zusicherung, die genau sagt, was fehlt. */
function fence(): FenceModul {
  expect(
    modul,
    `Das Schreibfenster-Modul ${MODULPFAD} liefert die gemeinsame Sperrdomäne noch nicht: ${ladefehler}`,
  ).not.toBeNull();
  return modul as FenceModul;
}

const fenceKey = (art: string, a: string, b?: string): string => fence().fenceKey(art, a, b);
const PgWriteFence = (pool: Pool) => new (fence().PgWriteFence)(pool);

/**
 * Aufzeichnender Doppelgänger — dieselbe Bauform wie im Haus
 * (`search-projection-repo-pg.test.ts:43`). `connect()` reicht denselben Ausführer durch, weil eine
 * Transaktion eine ANGEHEFTETE Verbindung braucht; über `pool.query()` wäre sie keine.
 *
 * `antwort` entscheidet je Statement, was die Datenbank zurückgibt. Der Test entscheidet damit NICHT
 * das Rennen — er stellt nur die beiden Antworten ein, die eine echte Datenbank geben kann:
 * „du hast die Zeile bekommen" (rowCount 1) oder „du hast sie nicht bekommen" (rowCount 0).
 */
function fakePool(antwort: (sql: string) => { rows: Record<string, unknown>[] }) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    const { rows } = antwort(sql);
    return { rows, rowCount: rows.length };
  };
  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as Pool;
  return { pool, calls };
}

/** Die Datenbank gibt die Sperre und ein Token — der Normalfall. */
const gewinnt = (token: number) => () => ({ rows: [{ fencing_token: String(token) }] });
/** Die Bedingung greift nicht: kein Datensatz, kein Token. Fail-closed. */
const verliert = () => ({ rows: [] as Record<string, unknown>[] });

const OWNER_A = "conflicts@a";
const OWNER_B = "overlap@b";

// ------------------------------------------------------------------------------------------------
describe("JOB1060 D7 · S — der GEMEINSAME Schlüssel", () => {
  it("S1: beide Dienste leiten für dasselbe Paar denselben Schlüssel ab — auch bei vertauschter Reihenfolge", () => {
    // Auflage 1 wörtlich: „alle beteiligten Dienste müssen denselben Schlüssel verwenden."
    // Ein Konfliktbefund und ein Overlapbefund über DASSELBE Paar konkurrieren um denselben Stand;
    // leiteten sie verschiedene Schlüssel ab, sperrte jeder in seiner eigenen Domäne — beide für
    // sich korrekt und zusammen trotzdem racy (Urteil, Nutzenkette Z. 23).
    expect(fenceKey("ko-paar", "k1", "k2")).toBe(fenceKey("ko-paar", "k2", "k1"));
  });

  it("S2: verschiedene Paare und verschiedene Gegenstandsarten trennen sich sauber", () => {
    expect(fenceKey("ko-paar", "k1", "k2")).not.toBe(fenceKey("ko-paar", "k1", "k3"));
    expect(fenceKey("ko-paar", "k1", "k2")).not.toBe(fenceKey("ko-einzel", "k1", "k2"));
    // Ein Trennzeichen im Bezeichner darf keine Kollision erzeugen: „a|b" + „c" ≠ „a" + „b|c".
    expect(fenceKey("ko-paar", "a|b", "c")).not.toBe(fenceKey("ko-paar", "a", "b|c"));
  });

  it("S3: der Schlüssel ist stabil — dieselbe Eingabe ergibt über Läufe hinweg denselben Wert", () => {
    // Er landet als Primärschlüssel in der Datenbank. Wäre er lauf- oder prozessabhängig, sperrten
    // zwei Prozesse nie dieselbe Zeile.
    expect(fenceKey("ko-paar", "k1", "k2")).toBe(fenceKey("ko-paar", "k1", "k2"));
    expect(fenceKey("ko-paar", "k1", "k2")).toMatch(/^ko-paar:/);
  });
});

// ------------------------------------------------------------------------------------------------
describe("JOB1060 D7 · C — der atomare CAS: EIN Statement, EINE Bedingung", () => {
  it("C1: die Übernahme ist genau EINE Anweisung mit RETURNING — kein Lesen-dann-Schreiben", () => {
    // Prüflücke 2: „Atomaren Stale-CAS als konkretes SQL mit erwarteter Owner-/Lease-/
    // Fencing-Bedingung und ausgewertetem Rowcount definieren."
    //
    // Ein Lesen-dann-Schreiben hätte ein Fenster, in dem ein zweiter Übernehmer denselben
    // Vorzustand sieht. Deshalb: ein Statement, und der Vorzustand steht in seiner WHERE-Bedingung.
    const { pool, calls } = fakePool(gewinnt(1));
    const zaun = PgWriteFence(pool);
    return zaun.acquire(fenceKey("ko-paar", "k1", "k2"), OWNER_A, 30_000).then((grant) => {
      expect(grant?.token).toBe(1);
      expect(calls).toHaveLength(1);
      const sql = calls[0]?.sql ?? "";
      expect(sql).toContain("INSERT INTO write_fences");
      expect(sql).toContain("ON CONFLICT (key) DO UPDATE");
      expect(sql).toContain("RETURNING fencing_token");
      // Die Übernahmebedingung: abgelaufen ODER derselbe Halter. Sie steht in SQL, nicht im Code.
      expect(sql).toContain("WHERE write_fences.lease_until <= ");
      expect(sql).toContain("OR write_fences.owner = ");
      // Monoton: das Token wird in derselben Anweisung erhöht, nie gesetzt.
      expect(sql).toContain("write_fences.fencing_token + 1");
    });
  });

  it("C2 · FAIL-CLOSED: greift die Bedingung nicht, gibt es kein Token und keinen Grant", async () => {
    // rowCount 0 heisst „ein anderer hält die Sperre". Der Verlierer bekommt `null` — er darf
    // daraus keine Berechtigung basteln (Urteil: „der Verlierer schreibt nicht").
    const { pool, calls } = fakePool(verliert);
    const grant = await PgWriteFence(pool).acquire(
      fenceKey("ko-paar", "k1", "k2"),
      OWNER_B,
      30_000,
    );
    expect(grant).toBeNull();
    // Und er hat nach dem abgelehnten CAS NICHTS weiter versucht.
    expect(calls).toHaveLength(1);
  });

  it("C3: die Lease reist als Dauer in Parametern — nicht als im Code gerechneter Zeitpunkt", async () => {
    // Die Uhr der Anwendung ist nicht die Uhr der Datenbank. Rechnet der Code den Ablauf aus,
    // entscheidet bei zwei Prozessen mit verschobenen Uhren die falsche Uhr über die Übernahme.
    const { pool, calls } = fakePool(gewinnt(7));
    await PgWriteFence(pool).acquire("k", OWNER_A, 30_000);
    const sql = calls[0]?.sql ?? "";
    expect(sql).toContain("now()");
    expect(sql).not.toMatch(/lease_until\s*=\s*'/); // kein eingebetteter Zeitstempel
  });
});

// ------------------------------------------------------------------------------------------------
describe("JOB1060 D7 · F — das Fencing wird SERVERSEITIG verglichen", () => {
  it("F1: jeder Schreibschritt trägt das Token in seiner eigenen Bedingung", async () => {
    // Prüflücke 3: „Monotone Fencing-ID transaktional persistieren und vor jedem Stand-/Auditwrite
    // SERVERSEITIG vergleichen." Ein Vergleich im Anwendungscode nützt nichts: der pausierte
    // Altinhaber hält ein gültig AUSSEHENDES Token und würde seinen eigenen Vergleich bestehen.
    const { pool, calls } = fakePool((sql) =>
      /INSERT INTO write_fences/.test(sql)
        ? { rows: [{ fencing_token: "5" }] }
        : { rows: [{ ok: 1 }] },
    );
    const zaun = PgWriteFence(pool);
    const grant = await zaun.acquire("k", OWNER_A, 30_000);
    expect(grant).not.toBeNull();

    await zaun.withFence(grant as NonNullable<typeof grant>, async (q) => {
      await q.query("UPDATE irgendein_stand SET x=1 WHERE id=$1", ["z"]);
    });

    // Die Transaktionsklammer, in der Reihenfolge, in der sie stehen muss.
    const folge = calls.map((c) => c.sql.trim().split("\n")[0]?.trim());
    expect(folge).toContain("BEGIN");
    expect(folge[folge.length - 1]).toBe("COMMIT");
    // Die exklusive Sperre auf GENAU der Fencezeile — dasselbe Hausmuster wie
    // `ko_projection_control … FOR UPDATE`.
    const sperre = calls.find((c) => c.sql.includes("FOR UPDATE"));
    expect(sperre?.sql).toContain("FROM write_fences WHERE key=$1");
    // Und der Tokenvergleich steht in der Bedingung dieser Sperre — nicht in einer if-Zeile.
    expect(sperre?.sql).toContain("AND fencing_token = $2");
    expect(sperre?.params?.[1]).toBe(5);
  });

  it("F2 · DER PAUSIERTE ALTINHABER: findet die Sperre sein Token nicht, wird nichts geschrieben", async () => {
    // Der Fall aus dem Urteil: A schläft, B übernimmt, A wacht auf und will weiterschreiben. Die
    // Datenbank findet für A kein Zeile mehr (Token erhöht) → rowCount 0 → Abbruch VOR dem Nutzwrite.
    const nutzwrites: string[] = [];
    const { pool, calls } = fakePool((sql) => {
      if (/INSERT INTO write_fences/.test(sql)) {
        return { rows: [{ fencing_token: "5" }] };
      }
      if (/FOR UPDATE/.test(sql)) {
        return { rows: [] }; // Token veraltet — die Zeile trägt inzwischen ein höheres
      }
      // BEGIN/COMMIT/ROLLBACK sind TransaktionssTEUERUNG, kein Nutzwrite. Sie hier mitzuzählen
      // wäre eine Verwechslung im Testgerüst — und genau daran ist der erste Lauf gescheitert.
      if (!/^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/i.test(sql)) {
        nutzwrites.push(sql);
      }
      return { rows: [{ ok: 1 }] };
    });
    const zaun = PgWriteFence(pool);
    const grant = await zaun.acquire("k", OWNER_A, 30_000);

    await expect(
      zaun.withFence(grant as NonNullable<typeof grant>, async (q) => {
        await q.query("UPDATE irgendein_stand SET x=1", []);
      }),
    ).rejects.toThrow(/Fencing/i);

    // KEIN Nutzwrite, und die Klammer ist sauber zurückgerollt.
    expect(nutzwrites).toEqual([]);
    expect(calls.some((c) => c.sql.trim() === "ROLLBACK")).toBe(true);
    expect(calls.some((c) => c.sql.trim() === "COMMIT")).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
describe("JOB1060 D7 · T — Stand UND Audit in EINER Transaktion", () => {
  it("T1: beide Schreibvorgänge liegen zwischen demselben BEGIN und COMMIT", async () => {
    // Auflage 4, erster Zweig: „Stand und Audit transaktional konsistent machen". Das ist die
    // bessere der beiden angebotenen Möglichkeiten — sie braucht weder Prüfsumme noch Nachholregel,
    // weil es keinen Zwischenzustand gibt, den man nachholen müsste.
    const { pool, calls } = fakePool((sql) =>
      /INSERT INTO write_fences/.test(sql)
        ? { rows: [{ fencing_token: "2" }] }
        : { rows: [{ ok: 1 }] },
    );
    const zaun = PgWriteFence(pool);
    const grant = await zaun.acquire("k", OWNER_A, 30_000);
    await zaun.withFence(grant as NonNullable<typeof grant>, async (q) => {
      await q.query("UPDATE stand SET s=$1", ["neu"]);
      await q.query("INSERT INTO audit_events(x) VALUES($1)", ["e"]);
    });

    const idx = (teil: string) => calls.findIndex((c) => c.sql.includes(teil));
    const begin = calls.findIndex((c) => c.sql.trim() === "BEGIN");
    const commit = calls.findIndex((c) => c.sql.trim() === "COMMIT");
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(idx("UPDATE stand")).toBeGreaterThan(begin);
    expect(idx("INSERT INTO audit_events")).toBeGreaterThan(idx("UPDATE stand"));
    expect(commit).toBeGreaterThan(idx("INSERT INTO audit_events"));
  });

  it("T2 · CRASH ZWISCHEN STAND UND AUDIT: es bleibt KEIN halber Stand zurück", async () => {
    // Genau die Grenze, die das Urteil als „offene Auditappend-Grenze" führt (Z. 25). Im
    // Dateimodell konnte eine halb geschriebene Auditzeile zurückbleiben; in einer Transaktion
    // kann sie es nicht — der Abbruch nach dem Standwrite rollt BEIDES zurück.
    const { pool, calls } = fakePool((sql) =>
      /INSERT INTO write_fences/.test(sql)
        ? { rows: [{ fencing_token: "3" }] }
        : { rows: [{ ok: 1 }] },
    );
    const zaun = PgWriteFence(pool);
    const grant = await zaun.acquire("k", OWNER_A, 30_000);

    await expect(
      zaun.withFence(grant as NonNullable<typeof grant>, async (q) => {
        await q.query("UPDATE stand SET s=$1", ["neu"]);
        throw new Error("Prozesscrash an der Auditgrenze");
      }),
    ).rejects.toThrow(/Prozesscrash/);

    expect(calls.some((c) => c.sql.trim() === "ROLLBACK")).toBe(true);
    expect(calls.some((c) => c.sql.trim() === "COMMIT")).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
describe("JOB1060 D7 · Z — die Tabelle ist spezifiziert, aber NICHT scharf", () => {
  const modulQuelle = readFileSync(
    new URL("../../services/db-tx/src/write-fence.ts", import.meta.url),
    "utf8",
  );

  /**
   * Der Quelltext OHNE Kommentare — eine Quellprüfung muss Code messen, nicht Prosa.
   *
   * Ohne diese Trennung schlug die Zusicherung unten an der ERKLÄRUNG an, warum es die Konstante
   * nicht gibt („WARUM SIE HIER NICHT ALS `export const … _SCHEMA = …` STEHT"). Ein Wächter, der
   * seinen eigenen Begründungstext für den Befund hält, ist kein Wächter.
   */
  const nurCode = (quelle: string): string =>
    quelle
      .split("\n")
      .map((zeile) => zeile.replace(/^\s*(\/\/|\*|\/\*).*$/, ""))
      .join("\n");

  it("Z1: die Fencetabelle ist wörtlich beschrieben — Schlüssel, Halter, Lease, Token", () => {
    expect(modulQuelle).toContain("CREATE TABLE IF NOT EXISTS write_fences");
    expect(modulQuelle).toContain("key text PRIMARY KEY");
    expect(modulQuelle).toContain("owner text NOT NULL");
    expect(modulQuelle).toContain("lease_until timestamptz NOT NULL");
    expect(modulQuelle).toContain("fencing_token bigint NOT NULL DEFAULT 1");
  });

  it("Z2 · DIE SCOPEGRENZE: keine exportierte Schemakonstante, solange db.ts nicht geleast ist", () => {
    // Der Hauswächter `services/app/src/db.migrate.test.ts` (SCRUM-496) verlangt, dass jede
    // exportierte DDL-`*_SCHEMA`-Konstante in der `schemas`-Liste von `services/app/src/db.ts`
    // steht — sonst fehlt die Tabelle auf Postgres, genau wie damals bei OVERLAP_SCHEMA. `db.ts`
    // liegt ausserhalb der D7-Lease.
    //
    // Diese Datei hat das GEMESSEN: die erste Fassung exportierte die Konstante, und die Vollsuite
    // wurde an genau dieser Stelle rot (1 von 7391). Der Verzicht ist also kein Vorbehalt, sondern
    // ein Befund — und er bleibt sichtbar, statt in einer Akte zu verschwinden.
    expect(nurCode(modulQuelle)).not.toMatch(/export\s+const\s+\w+_SCHEMA\s*=/);
    // KALIBRIERUNG: der Kommentarfilter darf nicht alles wegwerfen — der Code ist noch da.
    expect(nurCode(modulQuelle)).toContain("export class PgWriteFence");
    // Und die Erklaerung, die den Filter noetig macht, steht wirklich in der Datei.
    expect(modulQuelle).toMatch(/export\s+const\s+\w+_SCHEMA\s*=/);
  });

  it("Z3 · und die Sperre spricht genau diese Tabelle an", () => {
    // Anti-Vakuum: eine beschriebene Tabelle, die der Adapter nicht anfasst, wäre wertlos.
    expect(modulQuelle).toContain("INSERT INTO write_fences");
    expect(modulQuelle).toContain("FROM write_fences WHERE key=$1");
  });
});
