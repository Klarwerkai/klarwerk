// ================================================================================================
// JOB 3655 · F — DER ECHTE SERVERPROZESS. NICHT `buildApp`, SONDERN `server.ts`.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT (BEN, Runde 1, Korrekturpflicht 1): Runde 1 mass die
// Sammelmeldung an `buildApp` — und übersah damit, dass `server.ts` schon VORHER abbricht.
// `assertPersistentStore` steht dort in Zeile 108, `buildApp` erst in Zeile 124. Fehlten BEIDE
// Pflichtwerte, nannte der Prozess nur `DATABASE_URL`; `APP_BASE_URL` kam im gesamten
// Ausgabetext nicht vor. Die zugesagte Eigenschaft „nennt ALLE fehlenden Namen" galt für eine
// Funktion, nicht für den Start.
//
// DESHALB STARTET DIESE DATEI DEN ECHTEN PROZESS. Kein `buildApp`, kein `inject`, keine Attrappe:
// `node --import tsx services/app/src/server.ts` mit einer von Hand gebauten Umgebung, und
// gemessen wird, was auf stdout/stderr landet und mit welchem Code der Prozess endet.
//
// DIE UMGEBUNG WIRD VOLLSTÄNDIG NEU GEBAUT und NICHT geerbt. Sonst brächte eine lokal gesetzte
// `DATABASE_URL` den Test still zum Schweigen — er misst dann eine Lage, die es nicht gibt.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");

interface Lauf {
  code: number | null;
  ausgabe: string;
  /**
   * JOB 3776: die Fehlerausgabe FÜR SICH. `ausgabe` führt stdout und stderr zusammen und taugt
   * deshalb für „kommt dieser Name vor" — aber nicht für „was steht ZUERST da". Genau das ist
   * hier der Gegenstand: der Betreiber liest die erste Zeile.
   */
  fehlerausgabe: string;
}

/**
 * Startet `server.ts` als echten Prozess mit GENAU dieser Umgebung (plus dem Nötigsten, damit Node
 * überhaupt läuft). Liefert Exit-Code und die zusammengeführte Ausgabe.
 */
function starteServer(env: Record<string, string>): Lauf {
  const ergebnis = spawnSync("node", ["--import", "tsx", "services/app/src/server.ts"], {
    cwd: WURZEL,
    encoding: "utf8",
    timeout: 90_000,
    env: {
      // Das Minimum, ohne das Node nicht startet — kein `...process.env`.
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      // Kein Schlüsselbund in der Prüfumgebung.
      KLARWERK_SKIP_KEYCHAIN: "1",
      ...env,
    },
  });
  return {
    code: ergebnis.status,
    ausgabe: `${ergebnis.stdout ?? ""}${ergebnis.stderr ?? ""}`,
    fehlerausgabe: ergebnis.stderr ?? "",
  };
}

/**
 * JOB 3776 Runde 2: derselbe Aufbau für den ZWEITEN gemessenen Einstiegspunkt, den CLI-Seed.
 * `seed.ts` hat in Runde 1 einen eigenen Fänger bekommen (`runSeed().catch(...)` statt
 * `void runSeed()`); ohne Prozesstest wäre genau der ungedeckt (BEN, Runde 1, Prüfpunkt 6).
 */
function starteSeed(env: Record<string, string>): Lauf {
  const ergebnis = spawnSync("node", ["--import", "tsx", "services/app/src/seed.ts"], {
    cwd: WURZEL,
    encoding: "utf8",
    timeout: 90_000,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      KLARWERK_SKIP_KEYCHAIN: "1",
      ...env,
    },
  });
  return {
    code: ergebnis.status,
    ausgabe: `${ergebnis.stdout ?? ""}${ergebnis.stderr ?? ""}`,
    fehlerausgabe: ergebnis.stderr ?? "",
  };
}

describe("JOB 3655 F · der echte Serverstart", () => {
  it("F1 · fehlen BEIDE Pflichtwerte, nennt der echte Prozess BEIDE Namen — in einer Meldung", () => {
    const lauf = starteServer({ NODE_ENV: "production" });
    expect(lauf.code, `Prozess endete mit ${lauf.code}; Ausgabe: ${lauf.ausgabe}`).not.toBe(0);
    expect(lauf.ausgabe).toContain("DATABASE_URL");
    expect(lauf.ausgabe, "APP_BASE_URL fehlt in der Ausgabe — genau BENs Befund").toContain(
      "APP_BASE_URL",
    );
    expect(lauf.ausgabe).toContain("Pflichtwert(e)");
    // Und beide in EINER Meldung, nicht in zwei Abbrüchen hintereinander: die Zeile, die den
    // einen Namen trägt, trägt auch den anderen.
    const zeileMitBeiden = lauf.ausgabe
      .split("\n")
      .some((z) => z.includes("DATABASE_URL") && z.includes("APP_BASE_URL"));
    expect(zeileMitBeiden, `keine gemeinsame Zeile in:\n${lauf.ausgabe}`).toBe(true);
    // Der alte Speicherwächter kommt gar nicht mehr zum Zug — er hätte sonst die kürzere
    // Auskunft gegeben und die Sammelmeldung abgeschnitten.
    expect(lauf.ausgabe).not.toContain("StoragePersistenceError");
  }, 120_000);

  it("F2 · fehlt NUR APP_BASE_URL, bricht der Start trotzdem ab und nennt ihn", () => {
    // Mit gesetzter DATABASE_URL wäre der alte Speicherwächter zufrieden. Vor Runde 2 wäre der
    // Prozess hier bis zum Verbindungsaufbau gelaufen und erst dort gescheitert — mit einer
    // Meldung, die von APP_BASE_URL nichts weiss.
    const lauf = starteServer({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://kennung:kennwort@127.0.0.1:1/klarwerk_demo",
    });
    expect(lauf.code).not.toBe(0);
    expect(lauf.ausgabe).toContain("APP_BASE_URL");
    expect(lauf.ausgabe).toContain("Pflichtwert(e)");
    // Kein Kennwort in der Ausgabe, obwohl eines in der Verbindungszeichenkette steht.
    expect(lauf.ausgabe).not.toContain("kennwort");
  }, 120_000);

  it("F3 · KALIBRIERUNG: mit beiden Pflichtwerten lässt der Vertrag den Start durch", () => {
    // Ohne diese Gegenrichtung wäre F1/F2 auch dann grün, wenn der Vertrag IMMER abbräche.
    // Hier scheitert der Start an etwas anderem (die Datenbank antwortet nicht) — und genau das
    // ist der Beleg: der Vertrag hat ihn passieren lassen.
    const lauf = starteServer({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://kennung:kennwort@127.0.0.1:1/klarwerk_demo",
      APP_BASE_URL: "https://demo.klarwerk.ai",
    });
    expect(lauf.ausgabe).not.toContain("Pflichtwert(e)");
    expect(lauf.ausgabe).not.toContain("StartvertragError");
    expect(lauf.code, `Ausgabe: ${lauf.ausgabe}`).not.toBe(0);
  }, 120_000);

  it("F5 · JOB 3776 · der Abbruch ist EINE lesbare Zeile, keine Stapelspur", () => {
    // ============================================================================================
    // JOB 3776 · R1 — DIE WIRKUNG, GEMESSEN AM LAUFENDEN PROZESS.
    // ============================================================================================
    //
    // F1 und F2 messen, DASS die Namen vorkommen. Das war nach JOB 3655 erfüllt — und trotzdem sah
    // der Betreiber einen Programmabsturz. Denn der Vertrag stand im MODULRUMPF von `build-app.ts`
    // (Zeile 286), also in dem Code, der beim `import` läuft; der Fänger `start().catch(...)` sitzt
    // um `start()` und wurde nie erreicht.
    //
    // DIE IST-AUSGABE VOR DIESER RUNDE, wörtlich gemessen am Stand 8208f57 mit
    // `NODE_ENV=production node --import tsx services/app/src/server.ts`:
    //
    //   /…/services/app/src/start-vertrag.ts:927
    //       throw new StartvertragError(fehlend);
    //             ^
    //   StartvertragError: KLARWERK-Start abgebrochen: 2 Pflichtwert(e) … — APP_BASE_URL, DATABASE_URL. …
    //       at pruefeStartvertrag (…/start-vertrag.ts:927:11)
    //       at <anonymous> (…/services/app/src/build-app.ts:286:1)
    //       at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    //   Node.js v24.16.0
    //
    // Für Pedi ist das der Unterschied zwischen „ich sehe, was fehlt" und „da ist etwas kaputt".
    // Gemessen wird deshalb die ERSTE ZEILE und die ABWESENHEIT der Ladespur.
    const lauf = starteServer({ NODE_ENV: "production" });
    const ersteZeile = lauf.fehlerausgabe.split("\n").find((z) => z.trim() !== "") ?? "";

    expect(
      ersteZeile,
      `Die erste Fehlerzeile lautet '${ersteZeile}'. Erwartet ist die gewohnte Form ` +
        `'Serverstart fehlgeschlagen: …' aus server.ts (start().catch). Volle Ausgabe:\n${lauf.fehlerausgabe}`,
    ).toMatch(/^Serverstart fehlgeschlagen: /);

    // Und sie trägt die vollständige Auskunft — nicht nur den Kopf einer Stapelspur.
    expect(ersteZeile).toContain("DATABASE_URL");
    expect(ersteZeile).toContain("APP_BASE_URL");
    expect(ersteZeile).toContain("Pflichtwert(e)");

    // Keine Spur aus dem Modulladen. Diese drei Marken sind genau die, die die Ist-Ausgabe oben
    // trug; taucht eine wieder auf, steht der Wurf wieder vor dem Fänger.
    for (const marke of [
      "at ModuleJob.run",
      "asyncRunEntryPointWithESMLoader",
      "at pruefeStartvertrag (",
    ]) {
      expect(
        lauf.fehlerausgabe,
        `'${marke}' steht wieder in der Ausgabe — der Abbruch kommt aus dem Modulladen, nicht aus ` +
          `start(). Volle Ausgabe:\n${lauf.fehlerausgabe}`,
      ).not.toContain(marke);
    }

    // Der Fänger beendet mit 1 (server.ts: process.exit(1)) — ein Wurf beim Modulladen endete mit 1
    // ohne unser Zutun, deshalb ist das kein Beleg für sich, aber es gehört zur gewohnten Form.
    expect(lauf.code, `Ausgabe:\n${lauf.fehlerausgabe}`).toBe(1);
  }, 120_000);

  it("F4 · ausserhalb der Produktion verlangt der Vertrag nichts", () => {
    // Entwicklung und Desktopbetrieb dürfen weiterhin ohne Ausstattung hochkommen. Der Prozess
    // horcht dann wirklich; deshalb wird er über einen unbrauchbaren Port sofort wieder beendet
    // statt laufen gelassen — gemessen wird nur, dass der Vertrag nicht dazwischengeht.
    const lauf = starteServer({ NODE_ENV: "test", PORT: "-1" });
    expect(lauf.ausgabe).not.toContain("Pflichtwert(e)");
    expect(lauf.ausgabe).not.toContain("StartvertragError");
  }, 120_000);
});

// ================================================================================================
// JOB 3776 RUNDE 2 · S — DER ZWEITE EINSTIEGSPUNKT ALS ECHTER PROZESS: DER CLI-SEED.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESER BLOCK STEHT (BEN, Runde 1, Prüfpunkt 6): Runde 1 hat `seed.ts` den
// Vertrag UND einen Fänger gegeben (`runSeed().catch(...)` statt `void runSeed()`), aber nur am
// Quelltext geprüft (R2/2). Ohne Prozesstest wäre die Zusage „auch hier EINE lesbare Zeile" eine
// Behauptung: ein `void`-Aufruf hätte den Wurf als unbehandelte Zurückweisung stehen lassen, und
// Node schreibt dafür eine Stapelspur — exakt der Mangel, gegen den JOB 3776 angetreten ist.
describe("JOB 3776 S · der echte Seed-Prozess", () => {
  it("S1 · in Produktion greift die Seed-Sperre VOR dem Vertrag", () => {
    // Die Reihenfolge ist Absicht und in seed.ts begründet: Wer `seed:demo` versehentlich in
    // Produktion aufruft, soll erfahren, dass dieser Lauf gar nicht stattfindet — nicht, welche
    // Pflichtwerte einem Lauf fehlten, den es nicht gibt.
    const lauf = starteSeed({ NODE_ENV: "production" });
    expect(lauf.ausgabe).toContain("In Produktion deaktiviert");
    expect(lauf.ausgabe).not.toContain("Pflichtwert(e)");
  }, 120_000);

  it("S2 · mit SEED_ALLOW_PROD=1 und fehlenden Pflichtwerten: EINE lesbare Zeile, keine Stapelspur", () => {
    const lauf = starteSeed({ NODE_ENV: "production", SEED_ALLOW_PROD: "1" });
    const ersteZeile = lauf.fehlerausgabe.split("\n").find((z) => z.trim() !== "") ?? "";
    expect(
      ersteZeile,
      `Die erste Fehlerzeile lautet '${ersteZeile}'. Erwartet ist die gewohnte Form ` +
        `'[seed:demo] Abbruch: …' aus dem Fänger in seed.ts. Volle Ausgabe:\n${lauf.fehlerausgabe}`,
    ).toMatch(/^\[seed:demo\] Abbruch: /);
    expect(ersteZeile).toContain("DATABASE_URL");
    expect(ersteZeile).toContain("APP_BASE_URL");

    // Keine unbehandelte Zurückweisung: genau das erzeugte `void runSeed()` vor Runde 1.
    for (const marke of [
      "at ModuleJob.run",
      "UnhandledPromiseRejection",
      "at pruefeStartvertrag (",
    ]) {
      expect(
        lauf.fehlerausgabe,
        `'${marke}' steht in der Ausgabe — der Wurf läuft am Fänger vorbei. Volle Ausgabe:\n${lauf.fehlerausgabe}`,
      ).not.toContain(marke);
    }
  }, 120_000);

  it("S3 · KALIBRIERUNG: ausserhalb der Produktion läuft der Seed vollständig durch", () => {
    // Ohne diese Gegenrichtung wäre S2 auch dann grün, wenn der Vertrag im Seed IMMER abbräche —
    // und der Entwicklungs- und Vorführweg wäre kaputt, ohne dass es jemand merkt.
    const lauf = starteSeed({ NODE_ENV: "test" });
    expect(lauf.ausgabe).not.toContain("Pflichtwert(e)");
    expect(lauf.ausgabe).not.toContain("[seed:demo] Abbruch:");
    expect(lauf.ausgabe, `Ausgabe:\n${lauf.ausgabe}`).toContain("[seed:demo] Fertig:");
  }, 120_000);
});
