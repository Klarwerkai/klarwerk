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
import {
  BestandsresetVorschauVeraltetError,
  pgBestandsresetDienst,
} from "../../services/app/src/bestandsreset-dienst";
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

  // Nacharbeit 7 (BEN): DER ABGLEICH MIT DEM TATSÄCHLICH MIGRIERTEN SCHEMA. Jede Tabelle, die
  // `migrate()` anlegt, steht GENAU EINER Seite zu: im Löschgraphen — oder hier, mit Grund. Eine
  // neue Tabelle macht diesen Fall rot, bis jemand entschieden hat, ob sie zum Wissensbestand gehört.
  // Die Trennlinie ist Peters Entscheidung vom 11.10. und die des Löschgraphen: Konten,
  // Firmenwörterbuch, Einstellungen und Nachweise bleiben.
  const ERHALTEN: Readonly<Record<string, string>> = {
    users: "Konto",
    sessions: "Anmeldung",
    password_resets: "Konto (Rücksetzmarke)",
    user_second_factors: "Konto (zweiter Faktor)",
    verantwortung_nachfolge: "Konto (Nachfolge bei Befristung)",
    begriffe_fassungen: "Firmenwörterbuch (Peter, 11.10.)",
    audit: "Nachweis: Prüfprotokoll",
    bestandsreset_laeufe: "Nachweis: Laufakte des Resets selbst",
    richtlinien_handlungen: "Nachweis: Handlungsprotokoll der Richtlinien",
    loeschantraege: "Nachweis über Betroffenenrechte",
    ko_schreibstand: "Steuerung: Zählerzeile, wird erhöht statt gelöscht",
    ko_projection_control: "Steuerung: Steuerzeile der Suche",
    overlap_settings: "Einstellung",
    validation_settings: "Einstellung",
    external_knowledge_policy: "Einstellung",
    upload_limits: "Einstellung",
    reasoner_policy: "Einstellung",
    branding_settings: "Einstellung",
    confluence_import_schalter: "Einstellung",
    assist_presets: "Einstellung",
    instanz_bindung: "Einstellung (Instanzbindung)",
    ui_uebersetzungen: "Einstellung (Oberflächentexte)",
    ui_sprachen: "Einstellung (angelegte Sprachen)",
    management_category_profiles: "Einstellung (Bereichsverantwortung)",
    management_retirement_horizons: "Einstellung (Ruhestandshorizonte)",
    unternehmensprofil_fassungen: "Einstellung (Unternehmensprofil)",
    richtlinien_fassungen: "Einstellung (interne Richtlinien)",
    kommunikationsregel_fassungen: "Einstellung (Kommunikationsregeln)",
    meldungsregel_persoenlich: "Einstellung je Person (Abwahlen)",
    assistenz_profile: "Einstellung je Person (Assistenzprofil)",
    spaces_fassungen: "Struktur (Spaces), nicht an Wissensobjekte gebunden",
    teams_fassungen: "Struktur (Teams), nicht an Wissensobjekte gebunden",
    vorlagen_fassungen: "Struktur (Vorlagen), nicht an Wissensobjekte gebunden",
    interaktions_gedaechtnis: "persönliche Daten je Konto, nicht an Wissensobjekte gebunden",
    klara_gespraeche: "persönliche Gespräche je Konto, nicht an Wissensobjekte gebunden",
    chat_gespraeche: "interner Chat zwischen Personen",
    chat_nachrichten: "interner Chat zwischen Personen",
    livewall_fotos: "freiwillige Fotos je Konto",
    ask_nulltreffer: "Suchbegriffe ohne Treffer je Konto, nicht an Wissensobjekte gebunden",
  };

  it("P1b · jede migrierte Tabelle steht im Löschgraphen ODER mit Grund auf der Erhaltensliste", async () => {
    const res = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
    );
    const migriert = res.rows.map((z) => z.table_name);
    // Kalibrierung: ohne eine nennenswerte Erhebung wäre der Abgleich trivial grün.
    expect(migriert.length).toBeGreaterThan(80);
    const loeschen = new Set(BESTANDSRESET_LOESCHGRAPH);
    expect(migriert.filter((t) => !loeschen.has(t) && ERHALTEN[t] === undefined)).toEqual([]);
    expect(Object.keys(ERHALTEN).filter((t) => loeschen.has(t))).toEqual([]);
  });

  it("P2 · Wissen und Papierkorb sind weg, Konten und Sitzungen stehen, der Schreibstand steigt", async () => {
    expect(await anzahl("kos")).toBe(2);
    // Nacharbeit 7 (BEN): die an Wissensobjekte gebundenen Tabellen OHNE Fremdschlüsselkaskade —
    // je eine echte Zeile, damit die Leerung belegt ist und nicht an leeren Tabellen gemessen wird.
    const gebunden: [string, string, unknown[]][] = [
      [
        "ko_embeddings",
        `INSERT INTO ko_embeddings(ko_id, embedding_version, dim, vektor)
         VALUES ('ko-lebend', 'v1', 2, ARRAY[0.1, 0.2]::double precision[])`,
        [],
      ],
      [
        "ko_mitgelesen",
        "INSERT INTO ko_mitgelesen(ko_a, ko_b, anzahl) VALUES ('ko-lebend', 'ko-papierkorb', 3)",
        [],
      ],
      [
        "lesevarianten",
        `INSERT INTO lesevarianten(ko_id, lang, original_language, title, statement, body_html,
           herkunft, status, original_sha256, uebersetzung_sha256, quellabgleich, updated_at)
         VALUES ('ko-lebend', 'en', 'de', 'Title', 'Statement', '<p>x</p>', 'test', 'aktuell',
           'a', 'b', 'aktuell', now())`,
        [],
      ],
      [
        "ko_kanten",
        `INSERT INTO ko_kanten(id, quelle_id, ziel_id, art, richtung, urheber, gesetzt_am,
           geaendert_am, status, version, beziehungs_schluessel_hash)
         VALUES ('kante-1', 'ko-lebend', 'ko-papierkorb', 'verwandt', 'beide', 'konto-testerin',
           '2026-07-30T08:00:00.000Z', '2026-07-30T08:00:00.000Z', 'aktiv', 1, 'hash-1')`,
        [],
      ],
      [
        "ko_kanten_beitrag",
        "INSERT INTO ko_kanten_beitrag(beitrag_schluessel, kante_id) VALUES ('beitrag-1', 'kante-1')",
        [],
      ],
      [
        "gemeinsame_entwuerfe",
        `INSERT INTO gemeinsame_entwuerfe(id, ko_id, offen, revision, geaendert_am, data)
         VALUES ('entwurf-1', 'ko-lebend', true, 1, now(), '{}'::jsonb)`,
        [],
      ],
      [
        "office_gesichert",
        `INSERT INTO office_gesichert(anhang_id, object_id, ko_id, nutzer_id, at)
         VALUES ('anhang-1', 'objekt-1', 'ko-lebend', 'konto-testerin', now())`,
        [],
      ],
      [
        "office_sitzungen",
        "INSERT INTO office_sitzungen(anhang_id, sitzung) VALUES ('anhang-1', '{}'::jsonb)",
        [],
      ],
      [
        "veroeffentlichung_zustellungen",
        `INSERT INTO veroeffentlichung_zustellungen(vermerk_id, ko_id, empfaenger_id, am, hervorgehoben)
         VALUES ('vermerk-1', 'ko-lebend', 'konto-testerin', now(), false)`,
        [],
      ],
      [
        "meldung_zustellstatus",
        `INSERT INTO meldung_zustellstatus(vermerk_id, ko_id, empfaenger_id, kanal, status, angelegt_am)
         VALUES ('vermerk-1', 'ko-lebend', 'konto-testerin', 'app', 'offen', now())`,
        [],
      ],
      [
        "verstaendnis_fragensaetze",
        `INSERT INTO verstaendnis_fragensaetze(fragensatz_id, version, ko_id, data)
         VALUES ('satz-1', 1, 'ko-lebend', '{}'::jsonb)`,
        [],
      ],
      [
        "verstaendnis_versuche",
        `INSERT INTO verstaendnis_versuche(versuch_id, person_id, fragensatz_id, fragensatz_version,
           nummer, abgegeben_am, data)
         VALUES ('versuch-1', 'konto-testerin', 'satz-1', 1, 1, now(), '{}'::jsonb)`,
        [],
      ],
    ];
    for (const [tabelle, sql, werte] of gebunden) {
      await pool.query(sql, werte);
      expect(await anzahl(tabelle), `${tabelle}: vor dem Reset befüllt`).toBe(1);
    }
    // Firmenwörterbuch: bleibt (Peter, 11.10.) — auch das wird an einer echten Zeile gemessen.
    await pool.query("TRUNCATE begriffe_fassungen");
    await pool.query(
      `INSERT INTO begriffe_fassungen(begriff_id, version, data, geaendert_von, geaendert_am)
       VALUES ('begriff-p2', 1, '{"begriff":"Ventil"}'::jsonb, 'konto-testerin', now())`,
    );
    const standVorher = await schreibstand();

    const befund = await fuehreBestandsresetAus(pool, "lauf-e9");

    expect(befund).toMatchObject({ zustand: "OK", erfolgMeldbar: true });
    for (const tabelle of [
      "kos",
      "dokument_fassungen",
      "kenntnisnahme_empfaenger",
      "kenntnisnahme_anforderungen",
      ...gebunden.map(([t]) => t),
    ]) {
      expect(await anzahl(tabelle), tabelle).toBe(0);
    }
    expect(await anzahl("begriffe_fassungen")).toBe(1);
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

  it("P5 · Nacharbeit 7: ein Schreiber zwischen bestätigter Vorschau und Sperre — der Reset bricht ab, nichts gelöscht", async () => {
    // Genau das Fenster aus BENs Befund: die Kennung ist bestätigt (und hätte die frühe Prüfung der
    // Route bestanden), DANACH legt ein anderer Aufruf ein Wissensobjekt an, und erst dann nimmt der
    // Reset seine Sperre. Gefahren wird der Dienst direkt — ohne die Routenprüfung, damit allein die
    // Prüfung UNTER der Sperre über das Ergebnis entscheidet.
    const dienst = pgBestandsresetDienst(pool);
    const bestaetigt = (await dienst.stand()).vorschau.kennung;
    await pool.query(
      "INSERT INTO kos(id, type, status, category, data) VALUES ('ko-neu', 'wiki', 'published', 'allgemein', $1::jsonb)",
      [JSON.stringify({ id: "ko-neu", title: "Nach der Vorschau angelegt" })],
    );

    await expect(dienst.ausfuehren("lauf-fenster", bestaetigt)).rejects.toBeInstanceOf(
      BestandsresetVorschauVeraltetError,
    );

    expect(await anzahl("kos")).toBe(3);
    expect(await anzahl("dokument_fassungen")).toBe(1);
    expect(await anzahl("kenntnisnahme_anforderungen")).toBe(1);
    const lauf = await pool.query(
      "SELECT status, payload_committed_at FROM bestandsreset_laeufe WHERE id = 'lauf-fenster'",
    );
    expect(lauf.rows[0]).toEqual({ status: "ROLLED_BACK", payload_committed_at: null });

    // Gegenprobe: mit der Kennung des JETZIGEN Bestands läuft derselbe Dienst durch.
    const aktuell = (await dienst.stand()).vorschau.kennung;
    await expect(dienst.ausfuehren("lauf-aktuell", aktuell)).resolves.toMatchObject({
      zustand: "OK",
    });
    expect(await anzahl("kos")).toBe(0);
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
