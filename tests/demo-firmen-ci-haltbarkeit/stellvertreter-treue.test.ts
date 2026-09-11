// ================================================================================================
// JOB 3578 · RUNDE 2 · IST DER STELLVERTRETER SEIN GELD WERT?
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT: Ein Test, der gegen einen Stellvertreter misst, ist nur so scharf wie
// dieser. In Runde 1 war er es nicht — er hat ERKANNT statt AUSGEWERTET, und dadurch blieben zwei
// echte Produktverstellungen des Prüfers grün:
//
//   (a) `aktiv = EXCLUDED.aktiv` aus dem `DO UPDATE SET` streichen — der Stellvertreter schrieb den
//       Schalter trotzdem, weil er ihn aus der Parameterliste nahm statt aus der Zuweisung.
//   (b) alle drei Vorher-Projektionen durch `SELECT NULL` ersetzen — der Stellvertreter füllte die
//       Vorher-Spalten trotzdem, weil irgendwo im Text „FROM branding_settings" stand.
//
// Diese Datei hält beide Regeln jetzt in AUSFÜHRBAREM CODE fest, und zwar am Stellvertreter selbst:
// Sie schickt ihm Anweisungen, die genau so verstellt sind, und verlangt, dass sich das im Ergebnis
// zeigt. Solange diese Fälle grün sind, kann keine der beiden Verstellungen am Produkt unentdeckt
// bleiben — dort sind es dieselben Regeln, nur an einer Anweisung, die das Produkt schreibt.
//
// Die Fälle prüfen ausserdem, was Runde 1 ganz ausgelassen hat: dass der Zeilenschlüssel wirklich
// zählt, dass Typen und NOT NULL gelten und dass eine nicht nachgebildete Anweisung abgewiesen und
// nicht erraten wird.
import { describe, expect, it } from "vitest";
import { StellvertreterPool, leererSpeicher } from "./stellvertreter-pool";

const SCHLUESSEL = "branding_settings";

/** Der Schreibweg des Produkts, hier als Textbaustein — die Verstellungen setzen daran an. */
function schreibe(satz: string, vorherProjektion: string): string {
  return `WITH vorher AS (
      SELECT profil, aktiv, version FROM branding_settings WHERE key=$1
    ), nachher AS (
      INSERT INTO branding_settings(key, profil, aktiv, version)
      VALUES($1,$2,$3,1)
      ON CONFLICT (key) DO UPDATE SET
        ${satz}
      RETURNING profil, aktiv, version
    )
    SELECT
      ${vorherProjektion} AS vorher_version,
      nachher.profil AS nachher_profil,
      nachher.aktiv AS nachher_aktiv,
      nachher.version AS nachher_version
    FROM nachher`;
}

const VOLLSTAENDIG = `profil = EXCLUDED.profil,
        aktiv = EXCLUDED.aktiv,
        version = branding_settings.version + 1`;
const ECHTE_VORHER_PROJEKTION = "(SELECT version FROM vorher)";

describe("JOB 3578 · S1: der Stellvertreter ergänzt keine Zuweisung, die im SQL fehlt", () => {
  it("`aktiv` bleibt stehen, wenn `aktiv = EXCLUDED.aktiv` fehlt — genau das blieb in Runde 1 grün", async () => {
    const pool = new StellvertreterPool();
    const ohneSchalter = schreibe(
      `profil = EXCLUDED.profil,
        version = branding_settings.version + 1`,
      ECHTE_VORHER_PROJEKTION,
    );
    await pool.query(ohneSchalter, [SCHLUESSEL, "advisor", true]);
    const zweite = await pool.query(ohneSchalter, [SCHLUESSEL, "acme", false]);
    // Der Aufrufer wollte AUS. Die Anweisung sagt dazu nichts, also bleibt AN stehen — und genau
    // diesen Unterschied muss ein Test sehen können.
    expect(zweite.rows[0]).toMatchObject({
      nachher_profil: "acme",
      nachher_aktiv: true,
      nachher_version: 2,
    });
  });

  it("mit der vollständigen Zuweisung kommt der Schalter an", async () => {
    const pool = new StellvertreterPool();
    const anweisung = schreibe(VOLLSTAENDIG, ECHTE_VORHER_PROJEKTION);
    await pool.query(anweisung, [SCHLUESSEL, "advisor", true]);
    const zweite = await pool.query(anweisung, [SCHLUESSEL, "acme", false]);
    expect(zweite.rows[0]).toMatchObject({
      nachher_profil: "acme",
      nachher_aktiv: false,
      nachher_version: 2,
    });
  });
});

describe("JOB 3578 · S2: der Stellvertreter füllt keine Vorher-Spalte, die das SQL nicht liest", () => {
  it("`(SELECT NULL FROM vorher)` liefert NULL — auch wenn es die Zeile gäbe", async () => {
    const pool = new StellvertreterPool();
    const mitNull = schreibe(VOLLSTAENDIG, "(SELECT NULL FROM vorher)");
    await pool.query(mitNull, [SCHLUESSEL, "advisor", true]);
    const zweite = await pool.query(mitNull, [SCHLUESSEL, "advisor", true]);
    expect(zweite.rows[0]).toMatchObject({ vorher_version: null, nachher_version: 2 });
  });

  it("die echte Projektion liefert dagegen den Stand VOR dieser Anweisung", async () => {
    const pool = new StellvertreterPool();
    const anweisung = schreibe(VOLLSTAENDIG, ECHTE_VORHER_PROJEKTION);
    await pool.query(anweisung, [SCHLUESSEL, "advisor", true]);
    const zweite = await pool.query(anweisung, [SCHLUESSEL, "advisor", true]);
    // Der Schnappschuss: Der Lesezweig sieht 1, obwohl der Schreibzweig derselben Anweisung schon
    // 2 geschrieben hat.
    expect(zweite.rows[0]).toMatchObject({ vorher_version: 1, nachher_version: 2 });
  });
});

describe("JOB 3578 · S3: der Zeilenschlüssel zählt", () => {
  it("`WHERE key=$1` beantwortet nur die eigene Zeile, und `ON CONFLICT` trifft nur sie", async () => {
    const speicher = leererSpeicher();
    speicher.zeilen.push({
      key: "eine-andere-einstellung",
      profil: "advisor",
      aktiv: true,
      version: 9,
    });
    const pool = new StellvertreterPool(speicher);

    const leer = await pool.query(
      "SELECT profil, aktiv, version FROM branding_settings WHERE key=$1",
      [SCHLUESSEL],
    );
    expect(leer.rows).toEqual([]);

    await pool.query(schreibe(VOLLSTAENDIG, ECHTE_VORHER_PROJEKTION), [
      SCHLUESSEL,
      "advisor",
      true,
    ]);
    expect(speicher.zeilen).toHaveLength(2);
    expect(speicher.zeilen[0]).toEqual({
      key: "eine-andere-einstellung",
      profil: "advisor",
      aktiv: true,
      version: 9,
    });
    expect(speicher.zeilen[1]).toEqual({
      key: SCHLUESSEL,
      profil: "advisor",
      aktiv: true,
      version: 1,
    });
  });
});

describe("JOB 3578 · S4: die Versionsrechnung kommt aus dem Ausdruck, nicht aus der Gewohnheit", () => {
  it("`branding_settings.version + 1` nimmt den gespeicherten Wert, `$4` den Parameter", async () => {
    const pool = new StellvertreterPool();
    const ausTabelle = schreibe(VOLLSTAENDIG, ECHTE_VORHER_PROJEKTION);
    await pool.query(ausTabelle, [SCHLUESSEL, "advisor", true]);
    const zeile = pool.speicher.zeilen[0];
    if (!zeile) {
      throw new Error("der Stellvertreter hat keine Zeile gespeichert");
    }
    zeile.version = 41;
    const gewachsen = await pool.query(ausTabelle, [SCHLUESSEL, "advisor", true]);
    expect(gewachsen.rows[0]).toMatchObject({ nachher_version: 42 });

    const ausParameter = schreibe(
      `profil = EXCLUDED.profil,
        aktiv = EXCLUDED.aktiv,
        version = $4`,
      ECHTE_VORHER_PROJEKTION,
    );
    const gesetzt = await pool.query(ausParameter, [SCHLUESSEL, "advisor", true, 7]);
    expect(gesetzt.rows[0]).toMatchObject({ nachher_version: 7 });
  });
});

describe("JOB 3578 · S5: was er nicht nachbilden kann, weist er ab", () => {
  it("eine nicht nachgebildete Anweisungsform wird zum Fehler, nicht zu einem Ergebnis", async () => {
    const pool = new StellvertreterPool();
    await expect(pool.query("UPDATE branding_settings SET aktiv=true", [])).rejects.toThrow(
      /nur SELECT, INSERT und WITH/,
    );
    await expect(pool.query("SELECT 1 FROM andere_tabelle", [])).rejects.toThrow(
      /unbekannte Quelle/,
    );
  });

  it("NOT NULL aus der DDL des Produkts gilt auch hier", async () => {
    const pool = new StellvertreterPool();
    await expect(
      pool.query(
        "INSERT INTO branding_settings(key, profil, aktiv, version) VALUES($1,$2,NULL,1) RETURNING version",
        [SCHLUESSEL, "advisor"],
      ),
    ).rejects.toThrow(/„aktiv" ist NOT NULL/);
  });

  it("eine Spalte, die es in der DDL nicht gibt, wird abgewiesen", async () => {
    const pool = new StellvertreterPool();
    await expect(
      pool.query("INSERT INTO branding_settings(key, farbe) VALUES($1,$2) RETURNING key", [
        SCHLUESSEL,
        "blau",
      ]),
    ).rejects.toThrow(/keine Spalte „farbe"/);
  });
});
