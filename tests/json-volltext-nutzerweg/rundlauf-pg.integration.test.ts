// ================================================================================================
// JOB 4293 · P — DERSELBE SICHTBARE WEG, ABER GEGEN ECHTES POSTGRESQL, MIT NEUSTART UND EIGENER LESUNG.
// ================================================================================================
//
// DIE KETTE, die diese Datei schliesst und die sonst nirgends ganz gemessen ist:
//
//     PostgreSQL-Zeile (`kos.data`) → PgKoRepo → LibraryService → `GET /api/library/export` über
//     einen ECHTEN Socket → Datei → echte Dateiauswahl in Chromium → Prüfkarte → „Annehmen" →
//     `PgCandidateRepo`/`PgKoRepo` → und über einen NEUSTART der Anwendung zurück in die Spalte.
//
// DER WEG IST NICHT ABGESCHRIEBEN. Er steht genau einmal in `flaeche.ts` (Bedienweg) und `weg.ts`
// (Datenweg) und wird von dieser Datei mit `buildPgServices(pool)` gefahren, von
// `rundlauf-im-echten-browser.test.ts` mit Speicherablagen. Verschieden ist EIN Argument.
//
// WAS HIER ZUSÄTZLICH GEMESSEN WIRD:
//   (a) EIGENE LESUNG AM POOL — direkt in der Spalte `kos.data`, nicht über den Dienst, der gerade
//       geschrieben hat. Gelesen wird der VOLLTEXT, zeichengenau gegen die Ausgangsdatei.
//   (b) APP-NEUSTART — herunterfahren, gegen DIESELBE Datenbank neu starten, neuer Horchplatz.
//       Ein Ergebnis, das nur im Prozessgedächtnis lebte, verschwindet hier.
//   (c) FRISCHES BROWSERPROFIL auf dem NEUEN Platz — die Leseansicht wird von vorn geladen.
//
// PRÜFGRENZE, LAUT GEMELDET (Lehre JOB 3668/4224): Ohne echte PostgreSQL wird der Grund SICHTBAR
// auf stderr gemeldet und übersprungen. Ein stiller Skip sähe aus wie ein bestandener Lauf.
// KEINE PRODUKTIVDATEN: ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen, am Ende entfernt.
//
// LÄUFT NICHT IM TOR: `.integration.test.ts` ist vom regulären Lauf ausgenommen
// (`vitest.config.ts`, `AUSSCHLUSS`). Aufruf:
// `npx vitest run --config vitest.integration.config.ts tests/json-volltext-nutzerweg`.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  liesImFrischenProfil,
  stelleFlaecheBereit,
} from "../fassungsrueckholung-echter-browser/weg";
import { type Browser, DIST, mitFlaeche, starteChromium } from "../gast-nutzerweg/browserweg";
import {
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import { fahreDenSichtbarenRundlauf, pruefeFlaechenzusage } from "./flaeche";
import {
  JOB,
  KERNAUSSAGE,
  LETZTER_ABSATZ,
  TITEL,
  VOLLTEXT_MARKE,
  exportEintrag,
  exportdatei,
  exportiere,
  freigeben,
  legeQuellobjektAn,
  mitMutation,
  mussVolltextTragen,
  volltextHtml,
} from "./weg";

const ADMIN = "pg-rundlauf@volltext-4293.test";
const TITEL_PG = `${TITEL} · aus der Datenbank`;
const TAGS = ["dichtung", "presse-7"];

/** Zusammengesetzt statt ausgeschrieben — s. `tests/neuinstallation/…` (Fall N3 dort). */
const PG_SCHEMA = "postgresql:";

interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

function zerlege(url: string): Verbindung | undefined {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
    if (!u.hostname) {
      return undefined;
    }
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: decodeURIComponent(u.username) || "postgres",
      passwort: decodeURIComponent(u.password),
    };
  } catch {
    return undefined;
  }
}

function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${JOB}: „${datenbank}" trägt kein „test" im Namen — diese Suite fasst ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

describe(`${JOB} · P · der Rundlauf im Browser, gegen echtes PostgreSQL`, () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let verfuegbar = false;
  let flaeche = "nicht hergestellt";
  // ZWEI Wegwerf-Datenbanken: die Quelle, aus der exportiert wird, und die FRISCHE Zielinstanz, in
  // die die Datei geht. Warum zwei und nicht eine, steht bei `Rundlaufinstanzen` in `weg.ts` — in
  // einer Instanz wäre der Wiedereinspieler richtigerweise eine Dublette, und dieser Fall hätte den
  // Dublettenschutz gemessen statt den Volltext. BEIDE sind echte PostgreSQL.
  const stempel = `${Date.now()}`.slice(-9);
  const quellDb = `klarwerk_volltext_quelle_test_${stempel}`;
  const zielDb = `klarwerk_volltext_ziel_test_${stempel}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `[KLARWERK] ${JOB} P ÜBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die gemeinsame Kette aus Browser, echter PostgreSQL und Neustart ist damit nicht messbar.\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `[KLARWERK] ${JOB} P ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }
    adminPool = new Pool({ connectionString: url });
    // DIE VERSIONEN WERDEN GELESEN, NICHT ABGESCHRIEBEN: welche PostgreSQL hier wirklich antwortet.
    const wer = await adminPool.query<{ version: string }>("SELECT version() AS version");
    await adminPool.query(`CREATE DATABASE ${quellDb}`);
    await adminPool.query(`CREATE DATABASE ${zielDb}`);
    flaeche = stelleFlaecheBereit();
    if (!existsSync(join(DIST, "index.html"))) {
      process.stderr.write(
        `[KLARWERK] ${JOB} P ÜBERSPRUNGEN: ${DIST}/index.html fehlt auch nach dem Bau.\n`,
      );
      return;
    }
    browser = await starteChromium();
    process.stderr.write(
      `[KLARWERK] ${JOB} · Prüfstand: ${wer.rows[0]?.version ?? "(PostgreSQL-Version nicht lesbar)"} · Chromium · Fläche: ${flaeche}\n`,
    );
    verfuegbar = true;
  }, 1_200_000);

  afterAll(async () => {
    await browser?.close();
    if (adminPool) {
      for (const db of [quellDb, zielDb]) {
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
  }, 180_000);

  it("P1 · Datei wählen, lesen, annehmen — und der Volltext überlebt Neuladen, App-Neustart und eine eigene Lesung am Pool", async (ctx) => {
    if (!verfuegbar || !verbindung || !browser) {
      ctx.skip();
      return;
    }
    const quellPool = createPool(pgUrl(verbindung, quellDb));
    const pool = createPool(pgUrl(verbindung, zielDb));
    let quellStrecke: Strecke | undefined;
    let strecke: Strecke | undefined;
    let nachNeustart: Strecke | undefined;
    try {
      await migrate(quellPool);
      await migrate(pool);
      // Die QUELLinstanz braucht keine Fläche — sie wird nur über HTTP exportiert.
      quellStrecke = await starteStrecke({ pool: quellPool });
      strecke = await starteStrecke({ pool, ...mitMutation(undefined, mitFlaeche().vorListen) });
      const quelle: Sitzung = (await ersteinrichtung(quellStrecke, ADMIN)).sitzung;
      const ziel: Sitzung = (await ersteinrichtung(strecke, ADMIN)).sitzung;

      // ── DIE AUSGANGSLAGE, in der Datenbank der Quelle nachgesehen. ──────────────────────────
      const quellId = await legeQuellobjektAn(quelle, {
        titel: TITEL_PG,
        kern: KERNAUSSAGE,
        volltext: volltextHtml(),
        tags: TAGS,
      });
      await freigeben(quelle, quellId);
      const inDerSpalte = await quellPool.query<{ volltext: string | null; kern: string }>(
        "SELECT data->>'bodyHtml' AS volltext, data->>'statement' AS kern FROM kos WHERE id = $1",
        [quellId],
      );
      expect(
        inDerSpalte.rows[0]?.volltext ?? "",
        `${JOB}: P1 · die Spalte des Quellobjekts traegt gar keinen Volltext.`,
      ).toContain(VOLLTEXT_MARKE);
      expect(inDerSpalte.rows[0]?.kern).toBe(KERNAUSSAGE);

      const quellEintrag = exportEintrag(await exportiere(quelle), TITEL_PG);
      const ausgangstext = mussVolltextTragen("die Ausgangsdatei", quellEintrag.bodyHtml);

      // ── DER GANZE BEDIENWEG IN DER ZIELINSTANZ, derselbe wie im Tor. ────────────────────────
      const befund = await fahreDenSichtbarenRundlauf({
        browser,
        strecke,
        admin: ziel,
        email: ADMIN,
        titel: TITEL_PG,
        dateiInhalt: exportdatei([quellEintrag]),
        letzterAbsatz: LETZTER_ABSATZ,
      });
      pruefeFlaechenzusage(befund, LETZTER_ABSATZ);
      const zielKoId = befund.kandidat.koId as string;

      // ── (a) DIE EIGENE LESUNG AM POOL DER ZIELDATENBANK — zeichengenau gegen die Ausgangsdatei.
      const zielSpalte = await pool.query<{
        volltext: string | null;
        kern: string;
        version: string;
      }>(
        "SELECT data->>'bodyHtml' AS volltext, data->>'statement' AS kern, data->>'version' AS version FROM kos WHERE id = $1",
        [zielKoId],
      );
      expect(
        zielSpalte.rowCount,
        `${JOB}: P1 · das Zielobjekt ${zielKoId} steht nicht in der Datenbank.`,
      ).toBe(1);
      expect(
        zielSpalte.rows[0]?.volltext,
        `${JOB}: P1 · in der Spalte des Zielobjekts steht nicht derselbe Volltext wie in der Ausgangsdatei.`,
      ).toBe(ausgangstext);
      expect(zielSpalte.rows[0]?.kern, `${JOB}: P1 · die Kernaussage ist nicht erhalten.`).toBe(
        KERNAUSSAGE,
      );
      // Version 1 und neue Kennung sind laut Auftrag § 5.8 KEIN Defekt — festgehalten, damit
      // niemand später eine Identitäts- oder Versionswiederherstellung hineinliest.
      expect(zielSpalte.rows[0]?.version).toBe("1");

      // ── (b) APP-NEUSTART gegen DIESELBE Datenbank. ──────────────────────────────────────────
      const alterPlatz = strecke.basis;
      await strecke.schliessen();
      strecke = undefined;
      nachNeustart = await starteStrecke({
        pool,
        ...mitMutation(undefined, mitFlaeche().vorListen),
      });
      expect(nachNeustart.basis, `${JOB}: P1 · der Neustart horcht am selben Platz.`).not.toBe(
        alterPlatz,
      );

      // ── (c) FRISCHES PROFIL auf dem NEUEN Platz. ────────────────────────────────────────────
      const textNachNeustart = await liesImFrischenProfil(
        browser,
        nachNeustart.basis,
        ADMIN,
        zielKoId,
        TITEL_PG,
      );
      expect(
        textNachNeustart,
        `${JOB}: P1 · nach dem Neustart steht der Volltext nicht mehr auf der Seite.`,
      ).toContain(VOLLTEXT_MARKE);
      expect(
        textNachNeustart,
        `${JOB}: P1 · nach dem Neustart fehlt der letzte Absatz — es ist nicht der ganze Text.`,
      ).toContain(LETZTER_ABSATZ);
    } finally {
      await nachNeustart?.schliessen();
      await strecke?.schliessen();
      await quellStrecke?.schliessen();
      await pool.end();
      await quellPool.end();
    }
  }, 1_800_000);
});
