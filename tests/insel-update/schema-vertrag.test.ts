// ================================================================================================
// JOB 4012 — DER SCHEMA-VERTRAG: Downgrade und nicht umkehrbare Migration fallen VOR dem Umschalten.
// ================================================================================================
//
// DIE LUECKE, gemessen am Bestand vor dieser Runde: `services/app/src/db.migrate.test.ts` sichert,
// dass jede `*_SCHEMA`-DDL in `migrate()` referenziert ist, und `migrationsbeleg.ts` fuehrt die
// Sollliste samt Risikoklasse. Beides beschreibt den CODE. Niemand hat je gefragt, ob dieser Code
// zu den DATEN passt, an die er gleich gelegt wird — und `migrate()` laeuft beim Serverstart, also
// NACH dem Umschalten. Ab da traegt nur noch die Sicherung.
//
// Diese Datei misst beide Enden: die Erhebung der Stufen aus dem echten Quelltext (sonst waere der
// Vertrag eine Erfindung) und die Entscheidungen des Pruefers am fertigen Vertrag.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  GRUNDSTUFEN,
  type Insel,
  type Stufe,
  WURZEL,
  aktivesRelease,
  fahreUpdate,
  fahreVertrag,
  feldAus,
  legeInselAn,
  legeJournalAn,
  raeumeAb,
  schreibeRelease,
  setzeCurrent,
  vertragstext,
} from "./insel-probe";

const ALT = "klarwerk-insel-alt";
const NEU = "klarwerk-insel-neu";

let ordner: string | undefined;
let insel: Insel | undefined;
afterEach(() => {
  if (ordner !== undefined) {
    rmSync(ordner, { recursive: true, force: true });
    ordner = undefined;
  }
  if (insel !== undefined) {
    raeumeAb(insel);
    insel = undefined;
  }
});

function arbeitsordner(): string {
  ordner = mkdtempSync(join(tmpdir(), "klarwerk-vertrag-"));
  return ordner;
}

/** Schreibt Stand- und Vertragsdatei und laesst den Pruefer darauf los. */
function pruefe(stand: readonly Stufe[] | null, neu: readonly Stufe[], flaggen: string[] = []) {
  const ort = arbeitsordner();
  const standPfad = join(ort, "SCHEMA-STAND");
  const vertragPfad = join(ort, "SCHEMA-VERTRAG");
  if (stand !== null) {
    writeFileSync(
      standPfad,
      vertragstext({ release: ALT, appVersion: "1.0.0", stufen: stand, bestaetigt: "ja" }),
    );
  }
  writeFileSync(vertragPfad, vertragstext({ release: NEU, appVersion: "1.1.0", stufen: neu }));
  return fahreVertrag(["pruefen", standPfad, vertragPfad, ...flaggen]);
}

describe("JOB 4012 · die Stufen kommen aus dem echten Migrationsbeleg", () => {
  it("V1 · `erzeugen` liest die Sollliste UND die irreversiblen Datenmigrationen", () => {
    const ort = arbeitsordner();
    const ziel = join(ort, "SCHEMA-VERTRAG");

    const lauf = fahreVertrag(["erzeugen", ziel, "--release", "probe", "--commit", "abc1234"]);
    expect(lauf.code, lauf.ausgabe).toBe(0);

    const text = readFileSync(ziel, "utf8");
    const stufen = feldAus(text, "stufen").split(" ");
    // Die Zahl steht bewusst nicht als Erwartung da — sie waechst mit jedem neuen Schema. Gemessen
    // wird, dass die Erhebung wirklich beide Listen trifft und die Klassen nicht verliert.
    expect(stufen.length).toBeGreaterThan(30);
    expect(stufen).toContain("AUTH_SCHEMA:ADDITIV");
    expect(stufen).toContain("KO_CREATE_OPERATION_SCHEMA:TRANSFORMIEREND");
    expect(stufen).toContain("IMPORT_CANDIDATES_SCHEMA:IRREVERSIBEL");
    expect(
      stufen,
      "die Tokenmigration steht ausserhalb der Sollliste und ist trotzdem irreversibel",
    ).toContain("migrateAuthTokensAtRest:IRREVERSIBEL");

    const paket = JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8")) as {
      version: string;
    };
    expect(
      feldAus(text, "app_version"),
      "der Vertrag muss die Version nennen, die /health meldet",
    ).toBe(paket.version);
    expect(feldAus(text, "release")).toBe("probe");
  });

  it("V2 · fehlt die Sollliste im Quelltext, endet die Erhebung rot statt leer", () => {
    // Gegenprobe zur Erhebung selbst: ein Baum ohne Belegdatei darf keinen leeren Vertrag liefern.
    // Ein leerer Vertrag waere die gefaehrlichste Ausgabe von allen — er macht jeden Vergleich gruen.
    const ort = arbeitsordner();
    mkdirSync(join(ort, "scripts", "insel"), { recursive: true });
    mkdirSync(join(ort, "services", "app", "src"), { recursive: true });
    writeFileSync(join(ort, "package.json"), JSON.stringify({ version: "9.9.9" }));
    writeFileSync(
      join(ort, "services", "app", "src", "migrationsbeleg.ts"),
      "export const MIGRATIONS_SOLLLISTE = [\n];\nexport const IRREVERSIBLE_DATENMIGRATIONEN = [\n];\n",
    );
    writeFileSync(
      join(ort, "scripts", "insel", "schema-vertrag.mjs"),
      readFileSync(join(WURZEL, "scripts/insel/schema-vertrag.mjs"), "utf8"),
    );

    const lauf = spawnSync(
      "node",
      [join(ort, "scripts", "insel", "schema-vertrag.mjs"), "erzeugen", join(ort, "VERTRAG")],
      { encoding: "utf8" },
    );

    expect(lauf.status).not.toBe(0);
    expect(`${lauf.stdout}${lauf.stderr}`).toContain("keine einzige Stufe erhoben");
  });
});

describe("JOB 4012 · die Entscheidungen des Vertragspruefers", () => {
  it("V3 · gleiche Stufen: der Vertrag traegt", () => {
    const lauf = pruefe(GRUNDSTUFEN, GRUNDSTUFEN);
    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ausgabe).toContain("OK");
  });

  it("V4 · kein Stand neben den Daten: Erststand, nichts zu schuetzen", () => {
    const lauf = pruefe(null, GRUNDSTUFEN);
    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ausgabe).toContain("ERSTSTAND");
  });

  it("V5 · neue additive Stufe: sie laeuft beim Start mit und wird benannt", () => {
    const lauf = pruefe(GRUNDSTUFEN, [...GRUNDSTUFEN, { stufe: "NEU_SCHEMA", risiko: "ADDITIV" }]);
    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ausgabe).toContain("NEU_SCHEMA");
  });

  it("V6 · DOWNGRADE: das Release kennt eine Stufe nicht, die die Daten tragen", () => {
    const lauf = pruefe(
      [...GRUNDSTUFEN, { stufe: "SPAETER_SCHEMA", risiko: "ADDITIV" }],
      [...GRUNDSTUFEN],
    );
    expect(lauf.code, lauf.ausgabe).toBe(3);
    expect(lauf.ausgabe).toContain("DOWNGRADE");
    expect(lauf.ausgabe, "die fehlende Stufe wird benannt, nicht nur gezaehlt").toContain(
      "SPAETER_SCHEMA",
    );
  });

  it("V7 · NICHT UMKEHRBAR: eine neue irreversible Stufe braucht eine menschliche Zustimmung", () => {
    const neu: Stufe[] = [...GRUNDSTUFEN, { stufe: "WEG_SCHEMA", risiko: "IRREVERSIBEL" }];
    const ohne = pruefe(GRUNDSTUFEN, neu);
    expect(ohne.code, ohne.ausgabe).toBe(4);
    expect(ohne.ausgabe).toContain("WEG_SCHEMA");

    const mit = pruefe(GRUNDSTUFEN, neu, ["--nicht-umkehrbar-einspielen"]);
    expect(mit.code, mit.ausgabe).toBe(0);
    expect(mit.ausgabe).toContain("ausdrücklich zugestimmt");
  });

  it("V8 · eine bekannte Stufe, die still irreversibel wird, faellt genauso auf", () => {
    const lauf = pruefe(
      [{ stufe: "AUTH_SCHEMA", risiko: "ADDITIV" }],
      [{ stufe: "AUTH_SCHEMA", risiko: "IRREVERSIBEL" }],
    );
    expect(lauf.code, lauf.ausgabe).toBe(4);
    expect(lauf.ausgabe).toContain("AUTH_SCHEMA");
  });

  it("V9 · ein verstellter Vertrag wird abgelehnt, nicht halb gelesen", () => {
    const ort = arbeitsordner();
    const vertragPfad = join(ort, "SCHEMA-VERTRAG");
    const echt = vertragstext({ release: NEU, appVersion: "1.1.0", stufen: GRUNDSTUFEN });
    // Eine Stufe herausgenommen, den Hash stehen lassen: genau der Fall, den ein Pruefer merken muss.
    writeFileSync(vertragPfad, echt.replace(" KO_SCHEMA:ADDITIV", ""));

    const lauf = fahreVertrag(["pruefen", join(ort, "SCHEMA-STAND"), vertragPfad]);

    expect(lauf.code, lauf.ausgabe).toBe(5);
    expect(lauf.ausgabe).toContain("stufenhash");
  });

  it("V10 · eine unbekannte Vertragsfassung wird nicht geraten", () => {
    const ort = arbeitsordner();
    const vertragPfad = join(ort, "SCHEMA-VERTRAG");
    writeFileSync(
      vertragPfad,
      vertragstext({ release: NEU, appVersion: "1.1.0", stufen: GRUNDSTUFEN }).replace(
        "vertrag=1",
        "vertrag=99",
      ),
    );

    const lauf = fahreVertrag(["pruefen", join(ort, "SCHEMA-STAND"), vertragPfad]);

    expect(lauf.code, lauf.ausgabe).toBe(5);
    expect(lauf.ausgabe).toContain("Vertragsfassung");
  });
});

describe("JOB 4012 · der Vertrag greift VOR dem Umschalten", () => {
  it("V11 · ein Downgrade wird eingespielt? Nein — current bleibt, das Paket bleibt ausgepackt liegen", async () => {
    insel = await legeInselAn();
    schreibeRelease(insel.releases, {
      name: ALT,
      appVersion: "1.0.0",
      stufen: [...GRUNDSTUFEN, { stufe: "SPAETER_SCHEMA", risiko: "ADDITIV" }],
    });
    setzeCurrent(insel, ALT);
    legeJournalAn(insel);

    const eingang = join(insel.wurzel, "eingang");
    mkdirSync(eingang, { recursive: true });
    schreibeRelease(eingang, { name: NEU, appVersion: "0.9.0", stufen: GRUNDSTUFEN });

    const lauf = fahreUpdate(insel, join(eingang, NEU));

    expect(lauf.code, lauf.ausgabe).toBe(3);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: vertrag");
    expect(lauf.ausgabe).toContain("SPAETER_SCHEMA");
    expect(aktivesRelease(insel)).toBe(ALT);
    expect(existsSync(join(insel.releases, NEU))).toBe(false);
  });

  it("V12 · eine neue irreversible Stufe haelt das Update an — mit Zustimmung laeuft es durch", async () => {
    insel = await legeInselAn();
    schreibeRelease(insel.releases, { name: ALT, appVersion: "1.0.0" });
    setzeCurrent(insel, ALT);
    legeJournalAn(insel);

    const eingang = join(insel.wurzel, "eingang");
    mkdirSync(eingang, { recursive: true });
    const neu = schreibeRelease(eingang, {
      name: NEU,
      appVersion: "1.1.0",
      stufen: [...GRUNDSTUFEN, { stufe: "WEG_SCHEMA", risiko: "IRREVERSIBEL" }],
    });

    const ohne = fahreUpdate(insel, neu);
    expect(ohne.code, ohne.ausgabe).toBe(4);
    expect(ohne.ergebnis).toContain("Grund: vertrag");
    expect(aktivesRelease(insel)).toBe(ALT);

    const mit = fahreUpdate(insel, neu, ["--nicht-umkehrbar-einspielen"]);
    expect(mit.code, mit.ausgabe).toBe(0);
    expect(aktivesRelease(insel)).toBe(NEU);
  });
});
