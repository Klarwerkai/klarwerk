// ================================================================================================
// K13 · DER DURCHGEHENDE WEG AM BLATT: BROWSER → PERSISTENZ → WIEDERÖFFNEN, GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// DIE FRAGE (K13): „Belegt Fehler-/Erfolgsanzeige, ungeklärt echter Browser→Persistenz→Wiederöffnen-
// Weg." Die bisherigen Teilbelege tragen das nicht: die gemounteten Fälle laufen gegen Attrappen oder
// die In-Memory-Ablage, die Smoke-Fälle gegen den In-Memory-Smoke-Server, und der PostgreSQL-
// Browserbeleg `tests/entwurf-verlassen/speicherknopf-ganzdokument-pg-im-browser.integration.test.ts`
// gilt dem Dateiweg. Dieser Fall ist EIN Weg, dafür durch jede echte Grenze, und er wird nicht aus
// Teilbelegen zusammengesetzt (auch nicht mit T009).
//
// DIE KETTE:
//     Chromium (Tastatur ins Titelfeld und in die Schreibfläche des Blattes, sichtbarer Knopf
//     „Entwurf sichern") → echter Socket → Fastify → `PgDraftRepo` → Zeile in `drafts`
//     → unabhängige Probe per SQL → frische Seite über `/erfassen?draft=<id>` → Neuladen
//     → Titel und Rumpf stehen wieder da. Dazu ein zweites Sichern: es AKTUALISIERT dieselbe Zeile.
//
// DEUTSCH UND ENGLISCH: K1 in der Vorgabesprache, K2 über `?lang=en` (nicht gespeichert).
//
// PRÜFGRENZE, LAUT GEMELDET: ohne gesicherte KLARWERK_PG_TEST_URL wird der Grund auf stderr gemeldet
// und übersprungen — derselbe Weg wie in JOB 4352. KEINE PRODUKTIVDATEN: nur eine Wegwerf-Datenbank
// mit `test` im Namen, am Ende entfernt, erst nach `warteAufVerbindungsende`.
//
// WERKZEUGE werden importiert, nicht abgeschrieben (`gast-nutzerweg/`, `import-wiederoeffnen-
// nutzerweg/strecke.ts`, `ux19-speichern-oeffnen-reload/`).
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import type { Kontext, Seite } from "../gast-nutzerweg/browserweg";
import {
  fn,
  mitFlaeche,
  profil,
  starteChromium,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Strecke, ersteinrichtung, starteStrecke } from "../gast-nutzerweg/strecke";
import {
  type Verbindungszeile,
  alsBefund,
  warteAufVerbindungsende,
} from "../gast-nutzerweg/verbindungsende";
import {
  type BrowserMitVersion,
  SELEKTOR_DA,
  type SeiteMitDialogUndRoute,
  type Verbindung,
  aufZustandWarten,
  entwurfszahl,
  entwurfszeile,
  pgUrl,
  pgVersion,
  stelleFlaecheBereit,
  zerlege,
} from "../import-wiederoeffnen-nutzerweg/strecke";
import { FALL_RAHMEN_MS, wartebudget } from "../ux19-speichern-oeffnen-reload/ux19-buehne";

const KENNZEICHEN = "[KLARWERK] K13 Blatt-Rundlauf";
const KONTO = "blatt-rundlauf@k13.test";
const FENSTER = { width: 1280, height: 800 };
const TITEL = '[data-testid="blatt-titel"]';
const SCHREIBFLAECHE = '[data-testid="blatt-text"] [contenteditable="true"]';

/** Klickt GENAU den betätigbaren Knopf mit dieser Beschriftung. `false`, wenn es ihn nicht gibt. */
const KLICK_KNOPF_EXAKT = `(text) => {
  const k = [...document.querySelectorAll('button')].find((b) =>
    (b.textContent || '').replace(/\\s+/g, ' ').trim() === text
    && !b.disabled && b.offsetParent !== null);
  if (!k) { return false; }
  k.click();
  return true;
}`;

/** Der Stand, den ein Mensch am Blatt SIEHT: Titelwert und Text der Schreibfläche. */
const BLATT_STAND = `([titel, flaeche]) => {
  const t = document.querySelector(titel);
  const f = document.querySelector(flaeche);
  return {
    titel: t ? t.value : null,
    rumpf: f ? (f.innerText || '').replace(/\\s+/g, ' ').trim() : null,
    lang: document.documentElement.lang,
  };
}`;

let adminPool: Pool | undefined;
let verbindung: Verbindung | undefined;
let verfuegbar = false;
let browser: BrowserMitVersion | undefined;
let flaeche = "nicht hergestellt";
let pool: Pool | undefined;
let strecke: Strecke | undefined;
let kontext: Kontext | undefined;
const wegwerfDb = `klarwerk_k13_blatt_test_${`${Date.now()}`.slice(-9)}`;

function brauche<T>(wert: T | undefined, was: string): T {
  if (wert === undefined) {
    throw new Error(
      `${KENNZEICHEN}: ${was} fehlt — der Aufbau ist nicht bis dahin gekommen. Dieser Fall ist damit NICHT gemessen (und nicht etwa bestanden).`,
    );
  }
  return wert;
}

/** Anmeldung über die echte Maske, nur mit der Tastatur (Vorbild JOB 4352). */
async function anmelden(roh: Seite): Promise<void> {
  const basis = brauche(strecke, "die Messstrecke").basis;
  await roh.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(roh, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske steht");
  await tippeMitTastatur(roh, "#auth-email", KONTO, "E-Mail");
  await tippeMitTastatur(roh, "#auth-password", PASSWORT, "Passwort");
  await roh.keyboard.press("Enter");
  await warte(roh, `() => !document.querySelector("#auth-email")`, "die Anmeldung trägt");
}

async function sichern(seite: SeiteMitDialogUndRoute, beschriftung: string): Promise<void> {
  expect(
    await seite.evaluate<boolean>(fn(KLICK_KNOPF_EXAKT), beschriftung),
    `der Knopf «${beschriftung}» ist nicht betätigbar`,
  ).toBe(true);
}

/** Wartet, bis die Zeile in `drafts` diesen Text trägt — die Probe ist die Datenbank, nicht die Fläche. */
async function aufZeileWarten(db: Pool, id: string, text: string): Promise<string> {
  const start = Date.now();
  for (;;) {
    const zeile = await entwurfszeile(db, id);
    if (zeile?.includes(text)) {
      return zeile;
    }
    if (Date.now() - start > wartebudget("aufFlaechensatzWarten")) {
      throw new Error(
        `${KENNZEICHEN}: die drafts-Zeile ${id} trägt «${text}» nicht. Stand: ${zeile}`,
      );
    }
    await new Promise((auf) => setTimeout(auf, 200));
  }
}

async function blattStand(
  seite: SeiteMitDialogUndRoute,
): Promise<{ titel: string | null; rumpf: string | null; lang: string }> {
  return await seite.evaluate(fn(BLATT_STAND), [TITEL, SCHREIBFLAECHE]);
}

async function rundlauf(sprache: "de" | "en"): Promise<void> {
  const db = brauche(pool, "der Verbindungspool");
  const basis = brauche(strecke, "die Messstrecke").basis;
  const t = i18n.getFixedT(sprache);
  const zusatz = sprache === "en" ? "?lang=en" : "";
  const lauf = `${sprache.toUpperCase()}-${Date.now()}`;
  const titel = `K13 Blatt-Rundlauf ${lauf}`;
  const rumpf = `Vor dem Anfahren den Ventildruck prüfen (${lauf}).`;
  const nachtrag = " Nachtrag";

  const seite = (await brauche(
    kontext,
    "die Sitzung",
  ).newPage()) as unknown as SeiteMitDialogUndRoute;
  try {
    const vorher = await entwurfszahl(db);
    await seite.goto(`${basis}/erfassen${zusatz}`, {
      waitUntil: "load",
      timeout: wartebudget("neuLadenAdresse"),
    });
    await aufZustandWarten(seite, SELEKTOR_DA, "die Schreibfläche steht", SCHREIBFLAECHE);

    // Getippt, nicht gesetzt: echte Tastenanschläge in Titel und Schreibfläche.
    await seite.click(TITEL);
    await seite.keyboard.type(titel);
    await seite.click(SCHREIBFLAECHE);
    await seite.keyboard.type(rumpf);
    await sichern(seite, t("erfassen.entwurfSichern"));

    // Die Adresse trägt die Kennung (UX-01) — und die ZEILE trägt den Inhalt.
    await aufZustandWarten(
      seite,
      "() => new URLSearchParams(location.search).has('draft')",
      "die Adresse trägt die Entwurfskennung",
    );
    const id = new URL(seite.url()).searchParams.get("draft") ?? "";
    expect(id).not.toBe("");
    const zeile = await aufZeileWarten(db, id, rumpf);
    expect(zeile, "der Titel steht nicht in der drafts-Zeile").toContain(titel);
    expect(await entwurfszahl(db), "Sichern hat nicht genau EINEN Entwurf angelegt").toBe(
      vorher + 1,
    );

    // Zweites Sichern auf derselben Fläche: AKTUALISIERT dieselbe Zeile.
    await seite.click(TITEL);
    await seite.keyboard.press("End");
    await seite.keyboard.type(nachtrag);
    await sichern(seite, t("erfassen.entwurfSichern"));
    await aufZeileWarten(db, id, `${titel}${nachtrag}`);
    expect(await entwurfszahl(db), "das zweite Sichern hat einen zweiten Entwurf angelegt").toBe(
      vorher + 1,
    );

    // Wiederöffnen: eine FRISCHE Seite über die Adresse, danach Neuladen.
    const neu = (await brauche(
      kontext,
      "die Sitzung",
    ).newPage()) as unknown as SeiteMitDialogUndRoute;
    try {
      const trenner = zusatz ? "&lang=en" : "";
      await neu.goto(`${basis}/erfassen?draft=${encodeURIComponent(id)}${trenner}`, {
        waitUntil: "load",
        timeout: wartebudget("neuLadenAdresse"),
      });
      await aufZustandWarten(
        neu,
        `([flaeche, text]) => ((document.querySelector(flaeche) || {}).innerText || '').includes(text)`,
        "der wiedergeöffnete Entwurf zeigt den gesicherten Rumpf",
        [SCHREIBFLAECHE, rumpf],
      );
      expect(await blattStand(neu)).toEqual({
        titel: `${titel}${nachtrag}`,
        rumpf,
        lang: sprache,
      });

      await neu.reload({ waitUntil: "load", timeout: wartebudget("neuLadenAdresse") });
      await aufZustandWarten(
        neu,
        `([flaeche, text]) => ((document.querySelector(flaeche) || {}).innerText || '').includes(text)`,
        "nach dem Neuladen steht der Rumpf wieder da",
        [SCHREIBFLAECHE, rumpf],
      );
      expect((await blattStand(neu)).titel).toBe(`${titel}${nachtrag}`);
    } finally {
      await neu.close({ runBeforeUnload: false }).catch(() => undefined);
    }
    process.stderr.write(`${KENNZEICHEN} ${sprache} GRÜN · Entwurf ${id}\n`);
  } finally {
    await seite.close({ runBeforeUnload: false }).catch(() => undefined);
  }
}

describe("K13 · Blatt: Browser → PostgreSQL → Wiederöffnen", () => {
  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      process.stderr.write(
        `${KENNZEICHEN} UEBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die Kette aus Browser, echtem Socket und echter PostgreSQL ist damit nicht messbar.\n`,
      );
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${KENNZEICHEN} UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }
    await i18n.changeLanguage("de");
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${wegwerfDb}`);
    flaeche = stelleFlaecheBereit();
    browser = (await starteChromium()) as BrowserMitVersion;

    pool = createPool(pgUrl(verbindung, wegwerfDb));
    await migrate(pool);
    strecke = await starteStrecke({ pool, ...mitFlaeche() });
    await ersteinrichtung(strecke, KONTO);

    const p = await profil(browser, FENSTER);
    kontext = p.kontext;
    await anmelden(p.seite);
    await (p.seite as unknown as SeiteMitDialogUndRoute).close({ runBeforeUnload: false });

    process.stderr.write(
      `${KENNZEICHEN} BELEG · Chromium ${browser.version()} · Socket-Port ${new URL(strecke.basis).port} · PostgreSQL „${await pgVersion(pool)}" · dist ${flaeche}\n`,
    );
    verfuegbar = true;
  }, 900_000);

  afterAll(async () => {
    await kontext?.close().catch(() => undefined);
    await browser?.close();
    await strecke?.schliessen().catch(() => undefined);
    await pool?.end().catch(() => undefined);
    let rest: Verbindungszeile[] = [];
    if (adminPool) {
      const befund = await warteAufVerbindungsende(adminPool, wegwerfDb);
      rest = befund.rest;
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${wegwerfDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
    expect(
      rest,
      `beim DROP DATABASE hingen noch Verbindungen an ${wegwerfDb}:\n  ${alsBefund(rest)}`,
    ).toEqual([]);
  }, 120_000);

  it(
    "K1 (de) — getippt, gesichert, in `drafts` gelesen, zweimal gesichert (eine Zeile), frisch geöffnet und neu geladen: Titel und Rumpf stehen wieder da",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      await rundlauf("de");
    },
    FALL_RAHMEN_MS * 3,
  );

  it(
    "K2 (en) — derselbe Weg in der englischen Oberfläche",
    async (ctx) => {
      if (!verfuegbar) {
        ctx.skip();
        return;
      }
      await rundlauf("en");
    },
    FALL_RAHMEN_MS * 3,
  );
});
