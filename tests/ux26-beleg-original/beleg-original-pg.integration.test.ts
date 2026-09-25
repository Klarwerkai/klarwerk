// ================================================================================================
// UX-26 · BELEG UND ORIGINAL — DERSELBE WEG GEGEN ECHTES POSTGRESQL, MIT NEUSTART UND POOL-LESUNG.
// ================================================================================================
//
// Der Weg steht genau einmal in `weg.ts`; diese Datei fährt ihn mit `buildPgServices(pool)`
// (`starteStrecke({ pool })`, die vorhandene Vorrichtung aus `tests/gast-nutzerweg/strecke.ts`).
// Was hier ZUSÄTZLICH zählt:
//
//   (a) DER ALTBESTAND IST ECHT: die Belegzeilen des Eintrags „Beleg fehlt" werden in `ko_evidence`
//       gelöscht — so sieht ein Bestand aus der Zeit vor den Belegzeilen aus. Keine Drahtweiche.
//   (b) DER GESPEICHERTE BELEG steht nach dem Weg als Zeile in `ko_evidence` — am Pool gelesen,
//       nicht über den Dienst, der gerade geschrieben hat.
//   (c) NEUSTART: die Anwendung wird gegen DIESELBE Datenbank neu gestartet; die angelegten Belege,
//       der Beleg des abgelösten Originals und der Altbestand ohne Beleg sind danach über die Route
//       unverändert so da.
//
// PRÜFGRENZE, LAUT GEMELDET: ohne gesicherte `KLARWERK_PG_TEST_URL` wird der Grund auf stderr
// genannt und übersprungen. KEINE PRODUKTIVDATEN: nur eine Wegwerf-Datenbank mit `test` im Namen.
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { browserKennung, stelleFlaecheBereit } from "../fassungsrueckholung-echter-browser/weg";
import { type Browser, mitFlaeche, starteChromium } from "../gast-nutzerweg/browserweg";
import {
  PASSWORT,
  type Strecke,
  ersteinrichtung,
  gastAnlegen,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import { type Verbindung, pgUrl, zerlege } from "../import-wiederoeffnen-nutzerweg/strecke";
import { SPRACHEN } from "./bedeutung";
import {
  DESKTOP,
  INHALT,
  SCHMAL,
  belegeAmServer,
  durchgangsName,
  fahreDurchgang,
  fahreLeser,
  legeBestandAn,
} from "./weg";

const JOB = "[KLARWERK] UX-26 Beleg/Original (PG)";
const ADMIN = "pg-bearbeiter@ux26-beleg.test";
const LESER = "pg-leser@ux26-beleg.test";
const FENSTER = [SCHMAL, DESKTOP] as const;

describe("UX-26 · Beleg und Original im Browser, gegen echtes PostgreSQL", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;
  let browser: Browser | undefined;
  const datenbank = `klarwerk_ux26_beleg_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(`${JOB} ÜBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL.\n`);
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(`${JOB} ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechner.\n`);
      return;
    }
    adminPool = new Pool({ connectionString: url });
    const wer = await adminPool.query<{ version: string }>("SELECT version() AS version");
    await adminPool.query(`CREATE DATABASE ${datenbank}`);
    const flaeche = stelleFlaecheBereit();
    browser = await starteChromium();
    process.stderr.write(
      `${JOB} · ${wer.rows[0]?.version ?? "(Version nicht lesbar)"} · Chromium ${browserKennung(browser)} · Fläche: ${flaeche}\n`,
    );
    verfuegbar = true;
  }, 1_200_000);

  afterAll(async () => {
    await browser?.close();
    if (adminPool) {
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  it("P1 — alle Durchgänge DE/EN/NL × 320/Desktop, der Leser, der gespeicherte Beleg am Pool und nach Neustart", async (ctx) => {
    if (!verfuegbar || !verbindung || !browser) {
      ctx.skip();
      return;
    }
    const pool = createPool(pgUrl(verbindung, datenbank));
    let strecke: Strecke | undefined;
    try {
      await migrate(pool);
      strecke = await starteStrecke({ pool, ...mitFlaeche() });
      const adminApi = (await ersteinrichtung(strecke, ADMIN)).sitzung;
      const leser = await gastAnlegen(adminApi, {
        name: "Nur Lesen",
        email: LESER,
        role: "viewer",
      });
      expect(leser.status, leser.text).toBe(201);

      const durchgaenge = SPRACHEN.flatMap((s) => FENSTER.map((f) => durchgangsName(s, f.width)));
      const bestand = await legeBestandAn(adminApi, durchgaenge, async (koId) => {
        // (a) DER ECHTE ALTBESTAND: die Belegzeilen dieses einen Eintrags gibt es nicht mehr.
        const weg = await pool.query("DELETE FROM ko_evidence WHERE ko_id = $1", [koId]);
        expect(weg.rowCount, "Vorbedingung: es gab eine Belegzeile zu löschen").toBeGreaterThan(0);
      });
      // Die Zeile des abgelösten Originals liegt WIRKLICH in der Tabelle — mit Anhangsbezug,
      // obwohl der Anhang nicht mehr am Objekt hängt.
      const zeilenZwei = await pool.query<{ kind: string; anhang: string | null }>(
        "SELECT kind, data->>'attachmentId' AS anhang FROM ko_evidence WHERE ko_id = $1",
        [bestand.zwei.koId],
      );
      expect(zeilenZwei.rows, "vier Belegzeilen am Eintrag mit zwei Originalen").toHaveLength(4);

      for (const sprache of SPRACHEN) {
        for (const fenster of FENSTER) {
          const name = durchgangsName(sprache, fenster.width);
          const befund = await fahreDurchgang({
            browser,
            strecke,
            bestand,
            email: ADMIN,
            sprache,
            fenster,
          });
          expect(befund.originalInhalt, name).toBe(INHALT.zwei);
          // (b) DER GESPEICHERTE BELEG, am Pool gelesen.
          const leer = bestand.leer.get(name);
          const amPool = await pool.query<{ kind: string; label: string }>(
            "SELECT kind, data->>'label' AS label FROM ko_evidence WHERE ko_id = $1",
            [leer?.koId ?? ""],
          );
          expect(amPool.rows, `${name}: der angelegte Beleg liegt nicht in ko_evidence`).toEqual([
            { kind: "source", label: befund.neueQuelle },
          ]);
        }
        const l = await fahreLeser({ browser, strecke, bestand, email: LESER, sprache });
        expect(l.wegDa, `Leser ${sprache}: „Quelle anlegen“ wird angeboten`).toBe(false);
        expect(l.knoepfe, `Leser ${sprache}: eine Aktion im Belegabschnitt`).toEqual(["nachladen"]);
      }
      const leserZeilen = await pool.query("SELECT 1 FROM ko_evidence WHERE ko_id = $1", [
        bestand.leserLeer.koId,
      ]);
      expect(leserZeilen.rowCount, "der Leser hat einen Beleg erzeugt").toBe(0);

      // (c) NEUSTART gegen dieselbe Datenbank: die Belege sind über die Route weiterhin da.
      await strecke.schliessen();
      strecke = undefined;
      strecke = await starteStrecke({ pool, ...mitFlaeche() });
      const neu = strecke.profil("admin-neu");
      const an = await neu.sende("POST", "/api/auth/login", { email: ADMIN, password: PASSWORT });
      expect(an.status, an.text).toBe(200);
      expect(await belegeAmServer(neu, bestand.zwei.koId)).toHaveLength(4);
      expect(await belegeAmServer(neu, bestand.fehlt.koId)).toEqual([]);
      for (const name of durchgaenge) {
        const zeilen = await belegeAmServer(neu, bestand.leer.get(name)?.koId ?? "");
        expect(
          zeilen.map((z) => z.kind),
          `${name} nach Neustart`,
        ).toEqual(["source"]);
      }
    } finally {
      await strecke?.schliessen();
      await pool.end();
    }
  }, 1_800_000);
});
