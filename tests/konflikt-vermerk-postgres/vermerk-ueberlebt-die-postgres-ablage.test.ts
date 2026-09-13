// ================================================================================================
// JOB 3914 — DER KONFLIKTVERMERK ÜBERLEBT DIE POSTGRES-ABLAGE
// ================================================================================================
//
// Geprüfte Zusage, wörtlich (`apps/web/src/i18n.ts:5043-5044`, Schlüssel `help.konflikte.body`):
// „Deine Wahl wird als Vermerk festgehalten, gelöscht wird nichts."
//
// JOB 3887 hat dafür den DIENSTVERTRAG belegt (`services/conflicts/src/service.test.ts:89-160`),
// JOB 3888 den HTTP-WEG (`tests/konflikt-vermerk-am-endpunkt/`) — beide gegen die In-Memory-Ablage.
// Im Betrieb liegt der Vermerk in Postgres, und für diese Hälfte gab es keinen Beleg, der im Tor
// mitfährt. Diese Datei ist dieser Beleg, in zwei Teilen:
//
//  1 DIESELBE HANDLUNG, ZWEI ABLAGEN. `ConflictService` läuft einmal über `InMemoryConflictRepo`
//    und einmal über `PgConflictRepo` an einem Doppelgänger-Pool, der die `data`-Spalte als jsonb
//    nachbildet. Verglichen wird FELDWEISE (`status`, `decidedBy`, `decision`, `resolutionReason`)
//    und am ganzen Datensatz — und zwar an dem, was ZURÜCKGELESEN wird (`repo.findById`). Der
//    Rückgabewert der Dienstmethode gilt hier nicht als Beleg; das ist die Vorgabe aus
//    `services/conflicts/src/service.test.ts:92-95`.
//  2 DAS STATEMENT SELBST, nicht nur sein Ergebnis. Der Doppelgänger zeichnet auf, was
//    `PgConflictRepo` tatsächlich absetzt: `save()` (`services/conflicts/src/service.ts:638-641`)
//    erzeugt für eine Entscheidung GENAU EIN Schreibstatement auf `conflicts`, und zwar das
//    Vollobjekt-UPDATE aus `services/conflicts/src/repo-pg.ts:108-113`, dessen serialisiertes
//    `data` alle vier Felder trägt. Eine spätere Umstellung auf ein Teilfeld-Update (die den
//    Freitext des Menschen verwerfen würde) wird damit rot statt unbemerkt.
//
// WAS DAS NICHT ERSETZT, ausdrücklich — Bauform und Zugeständnis wie in
// `tests/ko/g27-welle1-pg-paritaet.test.ts:16-19`: einen echten Postgres-Lauf. Der Doppelgänger
// BILDET die jsonb-Semantik nach, er IST sie nicht. Nicht gemessen sind hier der Planner und die
// Indexnutzung, die jsonb-Serialisierung der echten Instanz, das Überleben über eine echte
// Verbindung hinweg und die Nebenläufigkeit zweier Entscheidungen. Genau dafür steht der echte
// Datenbankfall NACH NEUEM VERBINDUNGSAUFBAU in
// `services/conflicts/src/repo-pg.integration.test.ts` (JOB 3914, „der menschliche Vermerk nach
// einem neuen Verbindungsaufbau"), der nur unter `npm run test:integration` fährt.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  type Conflict,
  type ConflictInput,
  type ConflictRepo,
  ConflictService,
  InMemoryConflictRepo,
  PgConflictRepo,
} from "../../services/conflicts";

interface Aufzeichnung {
  sql: string;
  params: unknown[];
}

/**
 * Der Doppelgänger des Pools. Er hält die `data`-Spalte so, wie Postgres sie hält: als JSON-TEXT.
 * Jeder Schreibvorgang geht durch `JSON.stringify`, jedes Lesen durch `JSON.parse` — ein Aufrufer
 * bekommt nie das Objekt zurück, das er hineingegeben hat (wie an einer echten Verbindung).
 * Zusätzlich zeichnet er jedes Statement mit seinen Parametern auf; das ist die Grundlage von
 * Lieferung 2.
 */
function jsonbDoppelgaenger() {
  const tabelle = new Map<string, string>();
  const calls: Aufzeichnung[] = [];

  const lies = (id: string): Record<string, unknown> | undefined => {
    const roh = tabelle.get(id);
    return roh === undefined ? undefined : (JSON.parse(roh) as Record<string, unknown>);
  };

  // Ein SKALARER Ausdruck innerhalb von `jsonb_build_object(...)`: Platzhalter, Textliteral, Zahl.
  const skalar = (teil: string, params: unknown[]): unknown => {
    const platzhalter = /^\$(\d+)$/.exec(teil);
    if (platzhalter) {
      return params[Number(platzhalter[1]) - 1];
    }
    const literal = /^'(.*)'$/.exec(teil);
    if (literal) {
      return literal[1];
    }
    const zahl = Number(teil);
    if (teil.length > 0 && !Number.isNaN(zahl)) {
      return zahl;
    }
    throw new Error(`Doppelgänger: unbekannter Wert «${teil}»`);
  };

  // Ein jsonb-Glied der SET-Klausel. Genau drei Formen, weil genau drei vorkommen: die vorhandene
  // Zeile (`data`), ein Platzhalter (`$2` / `$2::jsonb`) und `jsonb_build_object(...)`. Alles
  // andere fliegt — ein unbekannter Ausdruck darf NIE stillschweigend geschluckt werden, sonst
  // wäre jede Gegenprobe an dieser Datei wertlos.
  const jsonGlied = (
    teil: string,
    vorher: Record<string, unknown>,
    params: unknown[],
  ): Record<string, unknown> => {
    if (teil === "data") {
      return vorher;
    }
    const platzhalter = /^\$(\d+)(?:::jsonb)?$/.exec(teil);
    if (platzhalter) {
      return JSON.parse(String(params[Number(platzhalter[1]) - 1])) as Record<string, unknown>;
    }
    const bauer = /^jsonb_build_object\((.*)\)$/.exec(teil);
    if (bauer) {
      const stuecke = (bauer[1] ?? "").split(",").map((s) => s.trim());
      if (stuecke.length % 2 !== 0) {
        throw new Error(`Doppelgänger: ungerade Argumentzahl in «${teil}»`);
      }
      const gebaut: Record<string, unknown> = {};
      for (let i = 0; i < stuecke.length; i += 2) {
        const schluessel = /^'(.*)'$/.exec(stuecke[i] ?? "")?.[1];
        if (schluessel === undefined) {
          throw new Error(`Doppelgänger: unlesbarer Schlüssel in «${teil}»`);
        }
        gebaut[schluessel] = skalar(stuecke[i + 1] ?? "", params);
      }
      return gebaut;
    }
    throw new Error(`Doppelgänger: unbekannter jsonb-Ausdruck «${teil}»`);
  };

  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    const norm = sql.replace(/\s+/g, " ").trim();

    if (norm === "INSERT INTO conflicts(id,data) VALUES($1,$2)") {
      tabelle.set(String(params[0]), String(params[1]));
      return { rows: [], rowCount: 1 };
    }
    if (norm === "SELECT data FROM conflicts WHERE id=$1") {
      const daten = lies(String(params[0]));
      return daten === undefined
        ? { rows: [], rowCount: 0 }
        : { rows: [{ data: daten }], rowCount: 1 };
    }
    if (norm === "SELECT data FROM conflicts") {
      const rows = [...tabelle.keys()].map((id) => ({ data: lies(id) }));
      return { rows, rowCount: rows.length };
    }
    // Das Vollobjekt-UPDATE (`repo-pg.ts:108-113`), der Status-CAS des Lese-GC (`:80-89`) und jede
    // Teilfeld-Form derselben Gestalt laufen hier durch DIESELBE Auswertung — der Doppelgänger
    // kennt keine Sonderbehandlung für „das erwartete" Statement.
    const aktualisierung =
      /^UPDATE conflicts SET data ?= ?(.+?) WHERE id=\$1(?: AND data->>'status'='([a-z]+)')?(?: RETURNING (id|data))?$/.exec(
        norm,
      );
    if (aktualisierung) {
      const id = String(params[0]);
      const vorher = lies(id);
      if (!vorher || (aktualisierung[2] !== undefined && vorher.status !== aktualisierung[2])) {
        return { rows: [], rowCount: 0 };
      }
      const neu: Record<string, unknown> = {};
      for (const teil of (aktualisierung[1] ?? "").split("||")) {
        Object.assign(neu, jsonGlied(teil.trim(), vorher, params));
      }
      tabelle.set(id, JSON.stringify(neu));
      const rueckgabe =
        aktualisierung[3] === "data"
          ? [{ data: lies(id) }]
          : aktualisierung[3] === "id"
            ? [{ id }]
            : [];
      return { rows: rueckgabe, rowCount: 1 };
    }
    throw new Error(`Doppelgänger: unbekanntes Statement «${norm}»`);
  };

  return { pool: { query } as unknown as Pool, calls };
}

// Feste Kennung und feste Uhr: der Startdatensatz ist in beiden Ablagen zeichengleich. Ein
// Unterschied im Ergebnis kann deshalb nur aus der ABLAGE stammen.
const KENNUNG = "konflikt-3914";
const ENTSCHEIDER = "controller-1";
const NOTIZ = "Fehlalarm: andere Anlage";
const BEGRUENDUNG = "Quelle B gilt; A galt nur für die alte Baureihe.";

const EINGABE: ConflictInput = {
  koA: "ko1",
  koB: "ko2",
  type: "truth",
  description: "Widerspruch zur Schließreihenfolge.",
};

function dienstAuf(repo: ConflictRepo): ConflictService {
  return new ConflictService({ repo, genId: () => KENNUNG, now: () => 0 });
}

function inMemoryAblage() {
  const repo: ConflictRepo = new InMemoryConflictRepo();
  return { repo, dienst: dienstAuf(repo) };
}

function postgresAblage() {
  const { pool, calls } = jsonbDoppelgaenger();
  const repo: ConflictRepo = new PgConflictRepo(pool);
  return { repo, dienst: dienstAuf(repo), calls, pool };
}

const FELDER = ["status", "decidedBy", "decision", "resolutionReason"] as const;
type Feld = (typeof FELDER)[number];

interface Handlung {
  name: string;
  lauf: (dienst: ConflictService, id: string) => Promise<Conflict>;
  erwartet: Record<Feld, unknown>;
}

const HANDLUNGEN: Handlung[] = [
  {
    name: "Fehlalarm MIT Notiz (dismiss)",
    lauf: (dienst, id) => dienst.dismiss(id, ENTSCHEIDER, NOTIZ),
    erwartet: {
      status: "geloest",
      decidedBy: ENTSCHEIDER,
      decision: NOTIZ,
      resolutionReason: "dismissed",
    },
  },
  {
    name: "Fehlalarm OHNE Notiz (dismiss) — kein erfundener Text",
    lauf: (dienst, id) => dienst.dismiss(id, ENTSCHEIDER),
    erwartet: {
      status: "geloest",
      decidedBy: ENTSCHEIDER,
      decision: null,
      resolutionReason: "dismissed",
    },
  },
  {
    name: "Entscheidung MIT Begründung (resolve)",
    lauf: (dienst, id) => dienst.resolve(id, ENTSCHEIDER, BEGRUENDUNG),
    erwartet: {
      status: "geloest",
      decidedBy: ENTSCHEIDER,
      decision: BEGRUENDUNG,
      resolutionReason: "decided",
    },
  },
];

/** Legt an, handelt — und liest ZURÜCK. Der Rückgabewert der Dienstmethode wird bewusst verworfen. */
async function abgelegt(
  ablage: { repo: ConflictRepo; dienst: ConflictService },
  lauf: Handlung["lauf"],
): Promise<Conflict | undefined> {
  const angelegt = await ablage.dienst.create(EINGABE, ENTSCHEIDER);
  await lauf(ablage.dienst, angelegt.id);
  return ablage.repo.findById(angelegt.id);
}

describe("JOB 3914 · L1: dieselbe Entscheidung liegt in beiden Ablagen gleich", () => {
  for (const handlung of HANDLUNGEN) {
    it(`${handlung.name}: In-Memory und Postgres geben feldweise DENSELBEN Datensatz zurück`, async () => {
      const imSpeicher = await abgelegt(inMemoryAblage(), handlung.lauf);
      const inPostgres = await abgelegt(postgresAblage(), handlung.lauf);

      // Feldweise gegen die KONKRETEN Werte — „beide gleich" allein wäre auch von zwei leeren
      // Datensätzen erfüllt. `expect.soft`, damit ein Lauf ALLE abweichenden Felder zeigt und nicht
      // nur das erste.
      for (const feld of FELDER) {
        expect.soft(imSpeicher?.[feld], `in-memory · ${feld}`).toEqual(handlung.erwartet[feld]);
        expect.soft(inPostgres?.[feld], `postgres · ${feld}`).toEqual(handlung.erwartet[feld]);
      }
      // Und darüber hinaus der GANZE Datensatz: kein Feld, das nur eine der beiden Ablagen trägt.
      expect(inPostgres).toEqual(imSpeicher);
    });
  }
});

describe("JOB 3914 · L2: das Schreibstatement selbst wird gemessen", () => {
  it("eine Entscheidung erzeugt GENAU EIN Schreibstatement auf conflicts — das Vollobjekt-UPDATE", async () => {
    const ablage = postgresAblage();
    const angelegt = await ablage.dienst.create(EINGABE, ENTSCHEIDER);
    const abAnlage = ablage.calls.length; // ab hier zählt nur noch die Entscheidung
    await ablage.dienst.dismiss(angelegt.id, ENTSCHEIDER, NOTIZ);

    const schreibend = ablage.calls
      .slice(abAnlage)
      .filter((c) => /^\s*(INSERT|UPDATE|DELETE)/i.test(c.sql));
    expect(schreibend).toHaveLength(1);

    const geschriebenMit = schreibend[0] as Aufzeichnung;
    // Wörtlich das Statement aus `repo-pg.ts:108-113` — kein Teilfeld-Merge, kein zweiter Weg.
    expect(geschriebenMit.sql.replace(/\s+/g, " ").trim()).toBe(
      "UPDATE conflicts SET data=$2 WHERE id=$1",
    );
    expect(geschriebenMit.params[0]).toBe(angelegt.id);

    // Das serialisierte `data` trägt ALLE VIER Felder: der Vermerk geht nicht erst beim Lesen
    // verloren, er steht schon im abgesetzten Statement.
    const data = JSON.parse(String(geschriebenMit.params[1])) as Conflict;
    expect(data.status).toBe("geloest");
    expect(data.decidedBy).toBe(ENTSCHEIDER);
    expect(data.decision).toBe(NOTIZ);
    expect(data.resolutionReason).toBe("dismissed");
  });
});

// Was diese Datei misst, hängt daran, dass der Doppelgänger sich wie jsonb verhält. Die zwei Fälle
// hier messen genau das — sonst wäre die Aussage oben ein Zirkelschluss.
describe("JOB 3914 · der Doppelgänger, ehrlich vermessen", () => {
  it("ein Teilfeld-Merge lässt die übrigen Felder auf dem ALTEN Stand (jsonb-Semantik)", async () => {
    const ablage = postgresAblage();
    const angelegt = await ablage.dienst.create(EINGABE, ENTSCHEIDER);

    // Genau die Form, die ein Teilfeld-Update in `repo-pg.ts:109` absetzen würde.
    await ablage.pool.query(
      "UPDATE conflicts SET data = data || jsonb_build_object('status', $2) WHERE id=$1",
      [angelegt.id, "geloest"],
    );

    const zurueck = await ablage.repo.findById(angelegt.id);
    expect(zurueck?.status).toBe("geloest"); // das genannte Feld ist fortgeschrieben …
    expect(zurueck?.decision).toBeNull(); // … der Vermerk des Menschen NICHT (die Fehlwirkung) …
    expect(zurueck?.description).toBe(EINGABE.description); // … und nichts sonst ging verloren.
  });

  it("ein unbekanntes Statement wird nicht verschluckt, sondern geworfen", async () => {
    const { pool } = jsonbDoppelgaenger();
    await expect(pool.query("DELETE FROM conflicts WHERE id=$1", ["x"])).rejects.toThrow(
      /unbekanntes Statement/,
    );
  });
});
