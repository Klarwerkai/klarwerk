// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BESTANDSRESET (E9) — DER RESET GEGEN DIE PRODUKTIVE MIGRATION.
// ================================================================================================
//
// E9, entschieden: „Der Bestandsreset schließt den Papierkorb ein — aber die registrierten Nutzer
// bleiben bestehen. Gelöscht werden Wissensobjekte und Papierkorb, nicht die Konten."
//
// `bestandsreset.test.ts` beweist die Ablauflogik gegen ein Doppel. Was nur hier beweisbar ist:
//
//   P1  Jede Tabelle des Standard-Löschgraphen gibt es nach `migrate()` wirklich. Fehlte eine,
//       scheiterte jedes `DELETE` an ihr, und der Reset rollte IMMER zurück.
//   P2  Nach dem Reset sind lebende UND getrashte KOs samt wissensgebundener Tabellen leer; Konten
//       und Sitzungen stehen unverändert; der Schreibstand ist gestiegen; der Befund ist OK.
//   P3  Hält jemand die exklusive Sperre, beginnt ein zweiter Reset nicht — gegen echte
//       Advisory-Sperren, nicht gegen ein Doppel (die in `bestandsreset.test.ts` offen benannte
//       Hypothese).
//   P4  (Nacharbeit 2, Peters Entscheidung vom 11.10.) Der ADMINISTRATIVE WEG, vollständig über die
//       App der Postgres-Komposition (`buildApp(buildPgServices(pool))`): Folgenvorschau mit
//       Zahlen und Kennung; jede fehlende Bestätigung (Häkchen, zweite Passworteingabe, richtiges
//       Passwort, aktuelle Vorschau) lässt den Bestand stehen; erst mit allen dreien läuft der
//       Reset, löscht Wissen und Papierkorb, lässt Konto, Anmeldung und Firmenwörterbuch stehen
//       und schreibt einen Auditeintrag.
//
// Die Laufakte (`bestandsreset_laeufe`) legt seit Nacharbeit 2 `migrate()` selbst an
// (`BESTANDSRESET_SCHEMA` in `services/app/src/db.ts`); bis dahin musste dieser Test sie von Hand
// anlegen. P1 misst das mit.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { PgKenntnisnahmeRepo } from "../../services/app/src/kenntnisnahme";
import {
  BESTANDSRESET_LOESCHGRAPH,
  BestandsresetGesperrtError,
  SQL_SPERRE_EXKLUSIV,
  fuehreBestandsresetAus,
} from "../../services/db-tx";

describe("E9 · Bestandsreset gegen echtes Postgres: Wissen und Papierkorb weg, Konten bleiben", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    pool = createPool(
      `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
    );
    pool.options.max = 8;
    await migrate(pool);
  });

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      await container?.stop();
    }
  });

  const anzahl = async (tabelle: string): Promise<number> =>
    Number((await pool.query(`SELECT count(*)::int AS n FROM ${tabelle}`)).rows[0].n);

  const schreibstand = async (): Promise<number> =>
    Number((await pool.query("SELECT stand FROM ko_schreibstand WHERE id = 1")).rows[0].stand);

  beforeEach(async () => {
    // CASCADE seit der Integration mit main: `ko_versions_ko_fk`/`ko_evidence_ko_fk` zeigen auf
    // `kos` (KO_FREMDSCHLUESSEL_SCHEMA), und ein TRUNCATE auf eine referenzierte Tabelle verlangt
    // es. Nur die Vorbereitung räumt so ab; der Reset selbst löscht weiter per DELETE, Kinder zuerst.
    await pool.query(
      `TRUNCATE users, sessions, bestandsreset_laeufe, kos, dokument_fassungen,
                kenntnisnahme_empfaenger, kenntnisnahme_anforderungen CASCADE`,
    );
    await pool.query(
      `INSERT INTO users(id, name, email, password_salt, password_hash, role, approved, created_at)
       VALUES ('konto-testerin', 'Testerin', 'testerin@example.invalid', 's', 'h', 'editor', true,
               '2026-07-30T08:00:00.000Z')`,
    );
    await pool.query(
      "INSERT INTO sessions(token, user_id, expires_at) VALUES ('sitzung-1', 'konto-testerin', 9999999999999)",
    );
    const ko = (id: string, extra: Record<string, unknown>) =>
      pool.query(
        "INSERT INTO kos(id, type, status, category, data) VALUES ($1, 'wiki', 'published', 'allgemein', $2::jsonb)",
        [id, JSON.stringify({ id, title: `Testtitel ${id}`, ...extra })],
      );
    await ko("ko-lebend", {});
    await ko("ko-papierkorb", { deletedAt: "2026-07-01T00:00:00.000Z" });
    await pool.query(
      `INSERT INTO dokument_fassungen(fassung_id, dokument_id, fassung, data)
       VALUES ('fassung-1', 'ko-lebend', 1, '{}'::jsonb)`,
    );
    await new PgKenntnisnahmeRepo(pool).anlegen(
      {
        id: "anf-1",
        koId: "ko-lebend",
        fassung: 1,
        angefordertVon: "konto-testerin",
        angefordertAm: "2026-07-30T08:00:00.000Z",
        frist: null,
        erinnertAm: null,
      },
      ["konto-testerin"],
    );
  });

  it("P1 · jede Tabelle des Standard-Löschgraphen UND die Laufakte legt die produktive Migration an", async () => {
    const fehlend: string[] = [];
    for (const tabelle of [...BESTANDSRESET_LOESCHGRAPH, "bestandsreset_laeufe"]) {
      const res = await pool.query("SELECT to_regclass($1) AS r", [tabelle]);
      if (res.rows[0].r === null) {
        fehlend.push(tabelle);
      }
    }
    expect(fehlend).toEqual([]);
  });

  it("P2 · Wissen und Papierkorb sind weg, Konten und Sitzungen stehen, der Schreibstand steigt", async () => {
    expect(await anzahl("kos")).toBe(2);
    const standVorher = await schreibstand();

    const befund = await fuehreBestandsresetAus(pool, "lauf-e9");

    expect(befund).toMatchObject({ zustand: "OK", erfolgMeldbar: true });
    for (const tabelle of [
      "kos",
      "dokument_fassungen",
      "kenntnisnahme_empfaenger",
      "kenntnisnahme_anforderungen",
    ]) {
      expect(await anzahl(tabelle), tabelle).toBe(0);
    }
    const konten = await pool.query("SELECT id, email, approved FROM users");
    expect(konten.rows).toEqual([
      { id: "konto-testerin", email: "testerin@example.invalid", approved: true },
    ]);
    expect(await anzahl("sessions")).toBe(1);
    expect(await schreibstand()).toBeGreaterThan(standVorher);
    // Nacharbeit 2: die Steuerzeile der Suche bleibt stehen — ohne sie träfe kein Zustandswechsel.
    expect(await anzahl("ko_projection_control")).toBe(1);
    const lauf = await pool.query(
      "SELECT status, payload_committed_at FROM bestandsreset_laeufe WHERE id = 'lauf-e9'",
    );
    expect(lauf.rows[0].status).toBe("OK");
    expect(lauf.rows[0].payload_committed_at).not.toBeNull();
  });

  it("P3 · hält jemand die exklusive Sperre, beginnt ein zweiter Reset nicht — der Bestand steht", async () => {
    const halter = await pool.connect();
    try {
      await halter.query("BEGIN");
      const erworben = await halter.query<{ erworben: boolean }>(SQL_SPERRE_EXKLUSIV);
      expect(erworben.rows[0]?.erworben).toBe(true);

      await expect(fuehreBestandsresetAus(pool, "lauf-zweiter")).rejects.toBeInstanceOf(
        BestandsresetGesperrtError,
      );
    } finally {
      await halter.query("ROLLBACK").catch(() => undefined);
      halter.release();
    }

    expect(await anzahl("kos")).toBe(2);
    expect(await anzahl("users")).toBe(1);
    const lauf = await pool.query(
      "SELECT status, payload_committed_at FROM bestandsreset_laeufe WHERE id = 'lauf-zweiter'",
    );
    expect(lauf.rows[0]).toEqual({ status: "ROLLED_BACK", payload_committed_at: null });
  });

  it("P4 · der administrative Weg: Vorschau, zweimal Passwort, Häkchen — sonst bleibt alles stehen", async () => {
    // Eine leere Kontenablage, damit das erste Konto Admin wird (FR-AUTH-01) — wie im echten Erststart.
    await pool.query("TRUNCATE users, sessions, kos, begriffe_fassungen CASCADE");
    const app = buildApp(buildPgServices(pool));
    const PASSWORT = "Bestand-zurueck-2026!";
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@example.invalid", password: PASSWORT },
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().role).toBe("admin");
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.invalid", password: PASSWORT },
    });
    expect(login.statusCode).toBe(200);
    const headers = { authorization: `Bearer ${login.json().token}` };

    const legeKoAn = async (titel: string): Promise<string> => {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers,
        payload: {
          confidentiality: "intern",
          title: titel,
          statement: `${titel} — Entwicklungsschutt.`,
          type: "best_practice",
          category: "Anlage 1",
        },
      });
      expect(res.statusCode).toBe(201);
      return res.json().id as string;
    };
    await legeKoAn("Testtitel lebend");
    const getrasht = await legeKoAn("Testtitel Papierkorb");
    const trash = await app.inject({ method: "DELETE", url: `/api/kos/${getrasht}`, headers });
    expect(trash.statusCode).toBeLessThan(300);
    // Das Firmenwörterbuch bleibt (Peters Entscheidung). Eine Fassung, roh gesetzt — gemessen wird
    // hier nicht der Wörterbuchweg, sondern dass der Reset ihn nicht anfasst.
    await pool.query(
      `INSERT INTO begriffe_fassungen(begriff_id, version, data, geaendert_von, geaendert_am)
       VALUES ('begriff-1', 1, '{"begriff":"Ventil"}'::jsonb, 'admin', now())`,
    );

    // --- Die Folgenvorschau ---------------------------------------------------------------------
    const vorschau = await app.inject({ method: "GET", url: "/api/admin/bestandsreset", headers });
    expect(vorschau.statusCode).toBe(200);
    const stand = vorschau.json();
    expect(stand.verfuegbar).toBe(true);
    expect(stand.vorschau).toMatchObject({
      wissensobjekte: 2,
      papierkorb: 1,
      erhalten: { konten: 1, begriffe: 1 },
    });
    expect(stand.vorschau.kennung).toMatch(/^[0-9a-f]{64}$/);
    const kennung = stand.vorschau.kennung as string;

    const versuch = (payload: Record<string, unknown>) =>
      app.inject({ method: "POST", url: "/api/admin/bestandsreset", headers, payload });
    const voll = {
      passwort: PASSWORT,
      passwortWiederholung: PASSWORT,
      folgenBestaetigt: true,
      vorschauKennung: kennung,
    };

    // --- Jede fehlende Bestätigung lässt den Bestand stehen -------------------------------------
    const abgewiesen: [Record<string, unknown>, number, string][] = [
      [{ ...voll, folgenBestaetigt: false }, 400, "BESTAETIGUNG_FEHLT"],
      [{ ...voll, vorschauKennung: undefined }, 400, "VORSCHAU_FEHLT"],
      [{ ...voll, passwortWiederholung: "" }, 400, "PASSWORT_FEHLT"],
      [{ ...voll, passwortWiederholung: `${PASSWORT}x` }, 400, "PASSWORT_UNGLEICH"],
      [
        { ...voll, passwort: "falsch-falsch", passwortWiederholung: "falsch-falsch" },
        401,
        "INVALID_PASSWORD",
      ],
    ];
    for (const [payload, status, code] of abgewiesen) {
      const res = await versuch(payload);
      expect(res.statusCode, code).toBe(status);
      expect(res.json().error).toBe(code);
      expect(await anzahl("kos"), `${code}: der Bestand muss stehen`).toBe(2);
    }

    // Die Vorschau ist verbindlich: ändert sich der Bestand danach, läuft nichts.
    await legeKoAn("Nach der Vorschau angelegt");
    const veraltet = await versuch(voll);
    expect(veraltet.statusCode).toBe(409);
    expect(veraltet.json().error).toBe("VORSCHAU_VERALTET");
    expect(veraltet.json().vorschau.wissensobjekte).toBe(3);
    expect(await anzahl("kos")).toBe(3);

    // --- Mit allen drei Bestätigungen und der aktuellen Vorschau läuft der Reset -----------------
    const neu = await app.inject({ method: "GET", url: "/api/admin/bestandsreset", headers });
    const ok = await versuch({ ...voll, vorschauKennung: neu.json().vorschau.kennung });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      ok: true,
      befund: { zustand: "OK", erfolgMeldbar: true },
      protokolliert: true,
    });

    expect(await anzahl("kos")).toBe(0);
    expect(await anzahl("users")).toBe(1);
    expect(await anzahl("begriffe_fassungen")).toBe(1);
    // Die Anmeldung trägt weiter — dieselbe Sitzung, und ein neues Login.
    const nachher = await app.inject({ method: "GET", url: "/api/admin/bestandsreset", headers });
    expect(nachher.statusCode).toBe(200);
    expect(nachher.json().vorschau).toMatchObject({ wissensobjekte: 0, papierkorb: 0 });
    expect(nachher.json().letzterLauf).toMatchObject({ zustand: "OK", erfolgMeldbar: true });
    const wiederAn = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@example.invalid", password: PASSWORT },
    });
    expect(wiederAn.statusCode).toBe(200);
    // Der Papierkorb ist leer — über die Produktroute, nicht über SQL.
    const papierkorb = await app.inject({ method: "GET", url: "/api/kos/trash", headers });
    expect(papierkorb.statusCode).toBe(200);
    expect(papierkorb.json()).toEqual([]);
    // Wer, was, wann: der Eintrag in der Auditkette, die der Reset stehen lässt.
    const audit = await pool.query<{ actor: string; target: string }>(
      "SELECT actor, target FROM audit WHERE action = 'bestandsreset.ausgefuehrt'",
    );
    expect(audit.rows).toEqual([{ actor: reg.json().id, target: ok.json().laufId }]);
  });
});
