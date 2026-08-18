// ================================================================================================
// JOB 1120 · D-1 — COOLIFY-ANNAHMEN IM REGISTER AUSDRUECKLICH ALS UNBELEGT FUEHREN
// ================================================================================================
//
// GEGENSTAND. Registerpunkt I11 verlangt woertlich, Coolify-Eigenheiten „selbst nachpruefen ODER
// als unbelegt kennzeichnen". Die Inventur aus JOB 947 (`RUECKGABE-PRO2-JOB-947-D1-COOLIFY-BELEG.md`,
// §2.3) hat acht solche Annahmen gefunden; fuenf davon — U3 bis U6 und U8 — sind reine
// Betriebsverfahren, fuer die der zweite Weg der richtige ist. Sie stehen ab jetzt im Register, und
// zwar nicht als blosser Hinweis, sondern in der Form, die der Baum an einer Stelle schon richtig
// vormacht (`docs/TEAM6_UPDATE.md:291`): Behauptung, Belegstatus, Vorbehalt, Restrisiko, Bestaetiger.
//
// WARUM DIESE FUENF FELDER UND NICHT WENIGER. Eine Annahme ohne BELEGSTATUS ist von einer Messung
// nicht zu unterscheiden. Eine ohne VORBEHALT liest sich wie eine Zusage. Eine ohne RESTRISIKO
// verschweigt, was bricht, wenn sie faellt. Eine ohne BESTAETIGER hat niemanden, der sie schliessen
// koennte — sie bleibt ewig offen. Und ohne BEHAUPTUNG weiss niemand, wovon ueberhaupt die Rede ist.
// Genau diese fuenf macht `TEAM6_UPDATE.md:291` bei U7 vor; dieser Waechter erzwingt sie fuer die
// uebrigen.
//
// UND I11 SELBST. Der Eintrag, der Unbelegtes kennzeichnen soll, stand ohne eigene Begruendung da:
// seine fuenfte Spalte („Warum") war LEER. Ein Punkt, der Rechenschaft verlangt und selbst keine
// ablegt, ist genau die Erklaerungsluecke, die der Prozess-Waechter (P1, Regel 6) gelb macht.
//
// DIE PRUEFUNG LAEUFT AM ECHTEN REGISTER, NICHT AN EINER KOPIE. `OFFEN.md` wird zur Laufzeit aus
// dem Repository gelesen; es gibt kein Fixture-Abbild, das mit dem Original auseinanderlaufen
// koennte. Die Regel selbst ist zusaetzlich als reine Funktion gebaut und wird an synthetischen
// Zeilen gegengeprueft — sonst waere nicht unterscheidbar, ob der Waechter bindet oder nur alles
// durchwinkt.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REGISTER_PFAD = fileURLToPath(new URL("../../OFFEN.md", import.meta.url));
const REGISTER = readFileSync(REGISTER_PFAD, "utf8");

/** Die fuenf Pflichtfelder einer als unbelegt gefuehrten Plattformannahme. */
const PFLICHTFELDER = [
  "Behauptung",
  "Belegstatus",
  "Vorbehalt",
  "Restrisiko",
  "Bestätiger",
] as const;

/**
 * Die fuenf Annahmen aus JOB 947 §2.3, die dieser Durchgang ins Register holt.
 * Die Fundstellen sind am Clone nachgemessen, nicht aus der Fremdrueckgabe uebernommen.
 */
const ANNAHMEN = [
  { kennung: "I11-U3", gegenstand: "TLS" },
  { kennung: "I11-U4", gegenstand: "pg_dump" },
  { kennung: "I11-U5", gegenstand: "Rollback" },
  { kennung: "I11-U6", gegenstand: "Auto-Deploy" },
  { kennung: "I11-U8", gegenstand: "Coolify-Backup" },
] as const;

/**
 * Der Lookahead auf die naechste Feldmarke.
 *
 * BEWUSST NICHT `\\w+`: `Bestätiger` traegt einen Umlaut, und `\\w` ist in JavaScript
 * `[A-Za-z0-9_]`. Mit `\\w+` endete die Abgrenzung des vorigen Feldes erst am Spaltenende und
 * verschluckte den Bestaetiger mit — beim Red-first-Lauf genau so gemessen, bevor eine Zeile
 * geschrieben war.
 */
const NAECHSTE_FELDMARKE = "\\*\\*[A-Za-zÄÖÜäöüß]+:\\*\\*";

/** Eine Registerzeile in ihre Markdown-Spalten zerlegen. */
function spalten(zeile: string): string[] {
  const roh = zeile.trim().replace(/^\|/, "").replace(/\|$/, "");
  return roh.split("|").map((s) => s.trim());
}

/** Die Zeile einer Kennung — oder `undefined`, wenn es sie nicht gibt. */
function registerzeile(register: string, kennung: string): string | undefined {
  return register
    .split("\n")
    .find((z) => z.startsWith(`| ${kennung} |`) || z.startsWith(`|${kennung}|`));
}

/**
 * DIE REGEL, als reine Funktion — damit sie an synthetischen Zeilen gegengeprueft werden kann.
 *
 * Liefert die Namen der Felder, die fehlen ODER leer sind. Leer heisst: die Feldmarke steht da,
 * aber es folgt kein Inhalt bis zum naechsten Feld oder zum Spaltenende. Genau das ist der Fall,
 * den ein spaeteres Aufraeumen erzeugt — die Marke bleibt stehen, der Inhalt verschwindet.
 */
function fehlendeFelder(zeile: string | undefined): string[] {
  if (zeile === undefined) {
    return [...PFLICHTFELDER];
  }
  const sache = spalten(zeile)[3] ?? "";
  return PFLICHTFELDER.filter((feld) => {
    const treffer = sache.match(
      new RegExp(`\\*\\*${feld}:\\*\\*([\\s\\S]*?)(?=${NAECHSTE_FELDMARKE}|$)`),
    );
    return treffer === null || treffer[1] === undefined || treffer[1].trim().length < 3;
  });
}

describe("JOB 1120 · D1 · A1: die fuenf Coolify-Annahmen stehen im Register", () => {
  for (const { kennung, gegenstand } of ANNAHMEN) {
    it(`${kennung} (${gegenstand}) hat eine eigene Registerzeile`, () => {
      expect(registerzeile(REGISTER, kennung), `${kennung} fehlt im Register`).toBeDefined();
    });
  }

  it("jede der fuenf Zeilen steht in einer fuenfspaltigen Registertabelle", () => {
    for (const { kennung } of ANNAHMEN) {
      const zeile = registerzeile(REGISTER, kennung);
      expect({ kennung, spalten: spalten(zeile ?? "").length }).toEqual({ kennung, spalten: 5 });
    }
  });
});

describe("JOB 1120 · D1 · A2: jede Annahme traegt alle fuenf Pflichtfelder", () => {
  for (const { kennung, gegenstand } of ANNAHMEN) {
    it(`${kennung} (${gegenstand}) fuehrt Behauptung, Belegstatus, Vorbehalt, Restrisiko und Bestaetiger`, () => {
      expect(fehlendeFelder(registerzeile(REGISTER, kennung))).toEqual([]);
    });
  }

  it("kein Belegstatus behauptet eine Messung, die niemand vorgenommen hat", () => {
    // Der Punkt der ganzen Uebung: Diese fuenf sind NICHT gemessen. Ein Belegstatus, der etwas
    // anderes sagt, waere genau die Plattformbehauptung, die I11 abstellen will.
    for (const { kennung } of ANNAHMEN) {
      const sache = spalten(registerzeile(REGISTER, kennung) ?? "")[3] ?? "";
      const status =
        sache.match(
          new RegExp(`\\*\\*Belegstatus:\\*\\*([\\s\\S]*?)(?=${NAECHSTE_FELDMARKE}|$)`),
        )?.[1] ?? "";
      expect({ kennung, unbelegt: /UNBELEGT/.test(status) }).toEqual({ kennung, unbelegt: true });
      expect({ kennung, gemessen: /\bgemessen\b|\bbelegt\b(?!er)/i.test(status) }).toEqual({
        kennung,
        gemessen: false,
      });
    }
  });

  it("jede Annahme nennt ihre Fundstelle im Baum — sonst ist sie nicht nachpruefbar", () => {
    for (const { kennung } of ANNAHMEN) {
      const sache = spalten(registerzeile(REGISTER, kennung) ?? "")[3] ?? "";
      expect({ kennung, fundstelle: /`[^`]+\.md:\d+/.test(sache) }).toEqual({
        kennung,
        fundstelle: true,
      });
    }
  });
});

describe("JOB 1120 · D1 · A3: I11 selbst ist begruendet", () => {
  it("I11 hat eine nicht-leere fuenfte Spalte", () => {
    const zeile = registerzeile(REGISTER, "I11");
    expect(zeile, "I11 fehlt im Register").toBeDefined();
    const warum = spalten(zeile ?? "")[4] ?? "";
    expect(warum.length).toBeGreaterThan(20);
  });

  it("die Begruendung verweist auf die fuenf ausgelagerten Annahmen", () => {
    const warum = spalten(registerzeile(REGISTER, "I11") ?? "")[4] ?? "";
    expect(warum).toMatch(/I11-U/);
  });
});

// ================================================================================================
// A4 · DIE REGEL BEISST — gegengeprueft an synthetischen Zeilen
// ================================================================================================
//
// Ohne diesen Block waere nicht unterscheidbar, ob der Waechter oben wirklich bindet oder ob er
// jede Eingabe durchwinkt. Geprueft wird die reine Funktion, nicht das Register — deshalb sind die
// Faelle hier frei konstruierbar.
describe("JOB 1120 · D1 · A4: der Waechter wird rot, wenn ein Feld fehlt oder leerlaeuft", () => {
  const VOLLSTAENDIG =
    "| I11-UX | UNBELEGT | NACH-VORTEST | **Behauptung:** Etwas gilt (`docs/x.md:12`). " +
    "**Belegstatus:** UNBELEGT — nie geprueft. **Vorbehalt:** durch Ops zu bestaetigen. " +
    "**Restrisiko:** bricht still. **Bestätiger:** Ops/Pedi | Warum-Text |";

  it("eine vollstaendige Zeile hat keine fehlenden Felder", () => {
    expect(fehlendeFelder(VOLLSTAENDIG)).toEqual([]);
  });

  it("eine fehlende Zeile meldet ALLE fuenf Felder", () => {
    expect(fehlendeFelder(undefined)).toEqual([...PFLICHTFELDER]);
  });

  for (const feld of PFLICHTFELDER) {
    it(`ein entferntes \`${feld}\` wird genau als \`${feld}\` gemeldet`, () => {
      const ohne = VOLLSTAENDIG.replace(
        new RegExp(`\\*\\*${feld}:\\*\\*[\\s\\S]*?(?=${NAECHSTE_FELDMARKE}|\\|)`),
        "",
      );
      expect(fehlendeFelder(ohne)).toEqual([feld]);
    });
  }

  it("ein LEERGELAUFENER Belegstatus zaehlt wie ein fehlender — die Marke allein genuegt nicht", () => {
    const leer = VOLLSTAENDIG.replace(
      new RegExp(`\\*\\*Belegstatus:\\*\\*[\\s\\S]*?(?=${NAECHSTE_FELDMARKE})`),
      "**Belegstatus:** ",
    );
    expect(fehlendeFelder(leer)).toEqual(["Belegstatus"]);
  });

  it("ein leergelaufener Vorbehalt ebenso — das ist der zweite vom Auftrag benannte Fall", () => {
    const leer = VOLLSTAENDIG.replace(
      new RegExp(`\\*\\*Vorbehalt:\\*\\*[\\s\\S]*?(?=${NAECHSTE_FELDMARKE})`),
      "**Vorbehalt:** ",
    );
    expect(fehlendeFelder(leer)).toEqual(["Vorbehalt"]);
  });
});
