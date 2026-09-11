// ================================================================================================
// JOB 3578 · DIE MARKENWAHL ÜBERLEBT NEUSTART UND DEPLOY.
// ================================================================================================
//
// DIE FRAGE, DIE HIER BEANTWORTET WIRD, ist nicht „gibt es eine Tabelle", sondern: Ein
// Administrator schaltet die Firmen-CI ein, der Server startet neu — steht sie danach noch da?
// Dafür braucht es BEIDES, und beides steht unten: eine haltbare Ablage (H1–H5, H8) UND den
// Nachweis, dass der Postgres-Betrieb sie wirklich benutzt (H7). Eine Tabelle, die niemand
// verdrahtet, erfüllt den Wortlaut und nichts sonst.
//
// WIE OHNE DATENBANK GEMESSEN WIRD: über den Stellvertreter-Pool nebenan. Er WERTET die Anweisung
// aus, statt sie zu erkennen — Schnappschuss, `ON CONFLICT DO UPDATE SET`, Ausdrücke, Schlüssel;
// der vollständige Grund steht in seinem Kopf, seine eigene Treue misst
// `stellvertreter-treue.test.ts`. Was er NICHT belegen kann, steht dort ebenfalls und wird hier
// nicht behauptet: das Verhalten echter Zeilensperren unter echter Gleichzeitigkeit.
import { describe, expect, it } from "vitest";
import {
  BRANDING_SETTINGS_SCHEMA,
  BRANDING_VORGABE,
  InMemoryBrandingSettingsRepo,
  PgBrandingSettingsRepo,
} from "../../services/app/src/branding-settings";
import { buildPgServices } from "../../services/app/src/build-app";
import { MIGRATIONS_SOLLLISTE, klassifiziereStufe } from "../../services/app/src/migrationsbeleg";
import { StellvertreterPool, type Tabellenzeile, leererSpeicher } from "./stellvertreter-pool";

/**
 * Die eine Zeile, die die Ablage angelegt hat. Die Tests fassen sie an, um einen ZWEITEN PROZESS
 * nachzustellen, der über derselben Datenbank schreibt — und sie holen sie über den Speicher statt
 * über einen hier wiederholten Schlüsselnamen: Welchen Schlüssel die Ablage benutzt, ist ihre
 * Sache, und ein zweites Mal hingeschriebener Name wäre eine zweite Wahrheit.
 */
function dieEineZeile(pool: StellvertreterPool): Tabellenzeile {
  expect(pool.speicher.zeilen, "die Ablage hat nicht genau eine Zeile angelegt").toHaveLength(1);
  const zeile = pool.speicher.zeilen[0];
  if (!zeile) {
    throw new Error("der Stellvertreter hat keine Zeile gespeichert");
  }
  return zeile;
}

describe("JOB 3578 · H1: die Markenwahl überlebt den Neustart", () => {
  it("eine ZWEITE Ablage über demselben Speicher sieht, was die erste gesetzt hat", async () => {
    const speicher = leererSpeicher();
    const vorNeustart = new PgBrandingSettingsRepo(new StellvertreterPool(speicher).alsPool());
    await vorNeustart.setze({ profil: "advisor", aktiv: true });

    // Der Neustart: neuer Pool, neue Ablage, neues Objekt — dieselbe Platte.
    const nachNeustart = new PgBrandingSettingsRepo(new StellvertreterPool(speicher).alsPool());
    expect(await nachNeustart.lies()).toEqual({ profil: "advisor", aktiv: true, version: 1 });
  });

  it("Gegenprobe: über einem LEEREN Speicher steht die Vorgabe da, nicht die fremde Wahl", async () => {
    const speicher = leererSpeicher();
    await new PgBrandingSettingsRepo(new StellvertreterPool(speicher).alsPool()).setze({
      profil: "advisor",
      aktiv: true,
    });
    const andereInstanz = new PgBrandingSettingsRepo(new StellvertreterPool().alsPool());
    expect(await andereInstanz.lies()).toEqual(BRANDING_VORGABE);
  });
});

describe("JOB 3578 · H2: leere Tabelle heißt Vorgabe — nicht `null`, nicht Fehler", () => {
  it("`lies()` auf der leeren Tabelle liefert genau BRANDING_VORGABE", async () => {
    const stand = await new PgBrandingSettingsRepo(new StellvertreterPool().alsPool()).lies();
    expect(stand).toEqual({ profil: null, aktiv: false, version: 0 });
    expect(stand).not.toBeNull();
  });

  it("nie gesetzt (version 0) bleibt von gesetzt-und-aus (version > 0) unterscheidbar", async () => {
    const pool = new StellvertreterPool();
    const repo = new PgBrandingSettingsRepo(pool.alsPool());
    expect((await repo.lies()).version).toBe(0);
    await repo.setze({ profil: "advisor", aktiv: false });
    const nachAus = await repo.lies();
    expect(nachAus.aktiv).toBe(false);
    expect(nachAus.version).toBe(1);
  });

  it("ein Profilname, den diese Instanz nicht kennt, wird beim Lesen zu `null` — die Version bleibt", async () => {
    // Eine fremde Zeichenkette aus der Ablage darf nicht als Profil durchgereicht werden: sie
    // ergäbe eine Wahl ohne auflösbare Marke, und die Fläche könnte „an" nicht von „aus"
    // unterscheiden. Die Änderungszahl ist davon unberührt — sie ist eine Tatsache der Ablage.
    const pool = new StellvertreterPool();
    const repo = new PgBrandingSettingsRepo(pool.alsPool());
    await repo.setze({ profil: "advisor", aktiv: true });
    const zeile = dieEineZeile(pool);
    zeile.profil = "acme";
    zeile.version = 4;
    expect(await repo.lies()).toEqual({ profil: null, aktiv: true, version: 4 });
  });

  it("eine Zeile unter einem FREMDEN Schlüssel beantwortet `lies()` nicht und wird nicht überschrieben", async () => {
    // Die Tabelle trägt EINE benannte Zeile. Läge daneben eine andere Einstellung, dürfte sie weder
    // als Markenwahl gelesen noch beim Setzen überbügelt werden — sonst hinge die Aussage der
    // Fläche an der Nachbarschaft in der Tabelle statt am eigenen Schlüssel.
    const speicher = leererSpeicher();
    const fremd: Tabellenzeile = {
      key: "eine-andere-einstellung",
      profil: "advisor",
      aktiv: true,
      version: 9,
    };
    speicher.zeilen.push(fremd);
    const repo = new PgBrandingSettingsRepo(new StellvertreterPool(speicher).alsPool());
    expect(await repo.lies()).toEqual(BRANDING_VORGABE);

    const { vorher, nachher } = await repo.setze({ profil: "advisor", aktiv: true });
    expect(vorher).toEqual(BRANDING_VORGABE);
    expect(nachher).toEqual({ profil: "advisor", aktiv: true, version: 1 });
    expect(speicher.zeilen).toHaveLength(2);
    expect(speicher.zeilen[0]).toEqual(fremd);
  });
});

describe("JOB 3578 · H3: eine Anweisung, nicht zwei", () => {
  it("`setze` erzeugt GENAU EINEN Aufruf, und vorher/nachher stammen beide daraus", async () => {
    const pool = new StellvertreterPool();
    const repo = new PgBrandingSettingsRepo(pool.alsPool());
    const erste = await repo.setze({ profil: "advisor", aktiv: true });
    expect(pool.markenAnweisungen).toHaveLength(1);
    expect(erste.vorher).toEqual({ profil: null, aktiv: false, version: 0 });
    expect(erste.nachher).toEqual({ profil: "advisor", aktiv: true, version: 1 });

    const zweite = await repo.setze({ profil: "advisor", aktiv: false });
    expect(pool.markenAnweisungen).toHaveLength(2);
    expect(zweite.vorher).toEqual(erste.nachher);
    expect(zweite.nachher).toEqual({ profil: "advisor", aktiv: false, version: 2 });
  });

  it("auch `lies` kommt mit einer Anweisung aus — kein zweites Zeitfenster", async () => {
    const pool = new StellvertreterPool();
    await new PgBrandingSettingsRepo(pool.alsPool()).lies();
    expect(pool.markenAnweisungen).toHaveLength(1);
  });
});

describe("JOB 3578 · H4: die Version zählt in SQL hoch, nicht in JavaScript", () => {
  it("dieselbe Wahl zweimal setzen ergibt 1 und 2; nur der Schalter kippen ergibt 3", async () => {
    const repo = new PgBrandingSettingsRepo(new StellvertreterPool().alsPool());
    expect((await repo.setze({ profil: "advisor", aktiv: true })).nachher).toEqual({
      profil: "advisor",
      aktiv: true,
      version: 1,
    });
    expect((await repo.setze({ profil: "advisor", aktiv: true })).nachher).toEqual({
      profil: "advisor",
      aktiv: true,
      version: 2,
    });
    expect((await repo.setze({ profil: "advisor", aktiv: false })).nachher).toEqual({
      profil: "advisor",
      aktiv: false,
      version: 3,
    });
  });

  it("wird der Speicher von außen auf 7 gesetzt, ergibt der nächste `setze` 8 — nicht 2", async () => {
    // Das ist der zweite Prozess über derselben Datenbank, nachgestellt: Die Ablage darf ihre
    // Versionszahl nicht aus einem in JavaScript gemerkten Wert bilden, sondern nur aus dem, was
    // WIRKLICH gespeichert ist.
    const pool = new StellvertreterPool();
    const repo = new PgBrandingSettingsRepo(pool.alsPool());
    await repo.setze({ profil: "advisor", aktiv: true });
    dieEineZeile(pool).version = 7;
    expect((await repo.setze({ profil: null, aktiv: false })).nachher.version).toBe(8);
  });

  it("der Vorher-Stand derselben Anweisung ist der Stand, der wirklich in der Ablage stand", async () => {
    const pool = new StellvertreterPool();
    const repo = new PgBrandingSettingsRepo(pool.alsPool());
    await repo.setze({ profil: "advisor", aktiv: true });
    const zeile = dieEineZeile(pool);
    zeile.profil = null;
    zeile.aktiv = false;
    zeile.version = 7;
    const { vorher } = await repo.setze({ profil: "advisor", aktiv: true });
    expect(vorher).toEqual({ profil: null, aktiv: false, version: 7 });
  });
});

describe("JOB 3578 · H5: ein Datenbankfehler kommt an", () => {
  it("`lies()` reicht den Fehler durch und liefert NICHT still die Vorgabe", async () => {
    const pool = new StellvertreterPool();
    pool.fehler = new Error("Verbindung zur Datenbank verloren");
    const repo = new PgBrandingSettingsRepo(pool.alsPool());
    await expect(repo.lies()).rejects.toThrow("Verbindung zur Datenbank verloren");
  });

  it("`setze()` reicht den Fehler ebenfalls durch", async () => {
    const pool = new StellvertreterPool();
    pool.fehler = new Error("Verbindung zur Datenbank verloren");
    const repo = new PgBrandingSettingsRepo(pool.alsPool());
    await expect(repo.setze({ profil: "advisor", aktiv: true })).rejects.toThrow(
      "Verbindung zur Datenbank verloren",
    );
  });
});

describe("JOB 3578 · H6: Migrationsweg und Sollliste tragen dieselbe Einstufung", () => {
  it("die Stufe steht in der Sollliste, und ihre Einstufung ist die, die der Quelltext hergibt", () => {
    const eintrag = MIGRATIONS_SOLLLISTE.find((s) => s.stufe === "BRANDING_SETTINGS_SCHEMA");
    expect(eintrag, "BRANDING_SETTINGS_SCHEMA fehlt in der Sollliste").toBeDefined();
    expect(klassifiziereStufe(BRANDING_SETTINGS_SCHEMA)).toBe("ADDITIV");
    expect(eintrag?.risiko).toBe(klassifiziereStufe(BRANDING_SETTINGS_SCHEMA));
  });

  it("die DDL ist additiv und wiederholbar — kein Abbau, kein Seed", () => {
    expect(BRANDING_SETTINGS_SCHEMA).toMatch(/CREATE TABLE IF NOT EXISTS branding_settings/i);
    for (const verboten of [/\bDROP\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i, /\bINSERT\b/i]) {
      expect(BRANDING_SETTINGS_SCHEMA, `verbotener Bestandteil: ${verboten}`).not.toMatch(verboten);
    }
    expect(BRANDING_SETTINGS_SCHEMA).not.toMatch(/REFERENCES/i);
  });
});

describe("JOB 3578 · H7: der Postgres-Betrieb verdrahtet die haltbare Ablage", () => {
  it("`buildPgServices` liefert NICHT die flüchtige Ablage", () => {
    const dienste = buildPgServices(new StellvertreterPool().alsPool());
    expect(dienste.brandingSettings).not.toBeInstanceOf(InMemoryBrandingSettingsRepo);
    expect(dienste.brandingSettings).toBeInstanceOf(PgBrandingSettingsRepo);
  });

  it("ein `setze` über die gebaute Komposition erreicht wirklich den Pool", async () => {
    const pool = new StellvertreterPool();
    const dienste = buildPgServices(pool.alsPool());
    const { nachher } = await dienste.brandingSettings.setze({ profil: "advisor", aktiv: true });
    expect(nachher).toEqual({ profil: "advisor", aktiv: true, version: 1 });
    expect(pool.markenAnweisungen).toHaveLength(1);
    expect(dieEineZeile(pool)).toMatchObject({ profil: "advisor", aktiv: true, version: 1 });
  });

  it("und der Neustart wirkt auch über die Komposition: die zweite gebaute App sieht die Wahl", async () => {
    const speicher = leererSpeicher();
    await buildPgServices(new StellvertreterPool(speicher).alsPool()).brandingSettings.setze({
      profil: "advisor",
      aktiv: true,
    });
    const zweiteApp = buildPgServices(new StellvertreterPool(speicher).alsPool());
    expect(await zweiteApp.brandingSettings.lies()).toEqual({
      profil: "advisor",
      aktiv: true,
      version: 1,
    });
  });
});

describe("JOB 3578 · H8: die Schreibanweisung weist wirklich jede Spalte zu", () => {
  it("über eine bestehende Zeile hinweg kommen Profil UND Schalter neu an — im Ergebnis und in der Ablage", async () => {
    // Der Fall, den Runde 1 nicht sehen konnte: Fehlt `aktiv = EXCLUDED.aktiv` im `DO UPDATE SET`,
    // bliebe die Firmen-CI eingeschaltet, obwohl der Administrator sie ausgeschaltet hat. Gemessen
    // wird beides — was die Ablage ZURÜCKGIBT und was WIRKLICH in der Zeile steht.
    const pool = new StellvertreterPool();
    const repo = new PgBrandingSettingsRepo(pool.alsPool());
    await repo.setze({ profil: "advisor", aktiv: true });
    const { vorher, nachher } = await repo.setze({ profil: null, aktiv: false });
    expect(vorher).toEqual({ profil: "advisor", aktiv: true, version: 1 });
    expect(nachher).toEqual({ profil: null, aktiv: false, version: 2 });
    expect(dieEineZeile(pool)).toMatchObject({ profil: null, aktiv: false, version: 2 });
    expect(await repo.lies()).toEqual({ profil: null, aktiv: false, version: 2 });
  });

  it("und die Wahl kommt auch wieder AN — der Schalter kippt in beide Richtungen", async () => {
    const pool = new StellvertreterPool();
    const repo = new PgBrandingSettingsRepo(pool.alsPool());
    await repo.setze({ profil: null, aktiv: false });
    const { nachher } = await repo.setze({ profil: "advisor", aktiv: true });
    expect(nachher).toEqual({ profil: "advisor", aktiv: true, version: 2 });
    expect(dieEineZeile(pool)).toMatchObject({ profil: "advisor", aktiv: true, version: 2 });
  });
});
