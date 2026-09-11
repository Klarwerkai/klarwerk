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
  return { code: ergebnis.status, ausgabe: `${ergebnis.stdout ?? ""}${ergebnis.stderr ?? ""}` };
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

  it("F4 · ausserhalb der Produktion verlangt der Vertrag nichts", () => {
    // Entwicklung und Desktopbetrieb dürfen weiterhin ohne Ausstattung hochkommen. Der Prozess
    // horcht dann wirklich; deshalb wird er über einen unbrauchbaren Port sofort wieder beendet
    // statt laufen gelassen — gemessen wird nur, dass der Vertrag nicht dazwischengeht.
    const lauf = starteServer({ NODE_ENV: "test", PORT: "-1" });
    expect(lauf.ausgabe).not.toContain("Pflichtwert(e)");
    expect(lauf.ausgabe).not.toContain("StartvertragError");
  }, 120_000);
});
