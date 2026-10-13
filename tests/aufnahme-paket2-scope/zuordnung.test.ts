// Auftrag aufnahme:20260922:gesamt-paket2-scope (R-1395 „Scopeanalyse Paket 2“). Er liefert eine
// Klärungsakte, keine Produktfunktion. Dieser Test hält die Akte am Bestand fest:
//   Z1 — jede Datei der Paket-2-Tabelle (Integrationspaket 2 = mega87 + mega88) existiert und trägt
//        ihre Paketkennung;
//   Z2 — jede Fundstelle und jeder Test der namensgleichen „Paket 2“ A–E existiert und trägt
//        Programmkennung UND „Paket 2“ (sonst wäre die Abgrenzung erfunden oder veraltet);
//   Z3 — „JOB 534“, „Scopeanalyse“, „F-1395“, „R-1395“ stehen in apps/, services/, docs/ nur in
//        der Akte;
//   Z4 — die Akte nennt MEGA87–88 als Gegenstand, führt A–E nur als Quellbestand und bietet die in
//        Lauf 1 grundlos gestellte Wahl A–G nicht mehr an (Bens Befund, nacharbeit-1).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "../..");
const AKTE = "docs/aufnahme/20260922-gesamt-paket2-scope.md";
const akte = readFileSync(join(WURZEL, AKTE), "utf8");

interface Zeile {
  kennung: string;
  marke: string;
  dateien: string[];
}

function backticks(zelle: string | undefined): string[] {
  return [...(zelle ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "");
}

function abschnitt(titel: string): string {
  return akte.split(`\n## ${titel}`)[1]?.split("\n## ")[0] ?? "";
}

// Tabellenzeilen eines Abschnitts. zellen[0] ist leer (führendes „|“).
function zeilen(text: string, kopf: RegExp): string[][] {
  return text
    .split("\n")
    .filter((zeile) => kopf.test(zeile))
    .map((zeile) => zeile.split("|").map((z) => z.trim()));
}

function paket2(): Zeile[] {
  const text = abschnitt("Gegenstand: Integrationspaket 2 = mega87 + mega88");
  // Spalten: 1 Paket, 2 Datei.
  return zeilen(text, /^\| mega8[78] \|/).map((z) => ({
    kennung: z[1] ?? "",
    marke: z[1] ?? "",
    dateien: backticks(z[2]),
  }));
}

function namensgleiche(): Zeile[] {
  const text = abschnitt("Namensgleiche „Paket 2“ im Bestand (nicht Gegenstand von R-1395)");
  // Spalten: 1 Alt., 2 Programm, 5 Fundstellen, 6 vorhandene Tests.
  return zeilen(text, /^\| [A-E] \|/).map((z) => ({
    kennung: z[1] ?? "",
    marke: backticks(z[2])[0] ?? "",
    dateien: [...backticks(z[5]), ...backticks(z[6])],
  }));
}

function pruefeDateien(liste: Zeile[], auchPaket2: boolean): void {
  for (const z of liste) {
    for (const datei of z.dateien) {
      const ort = `${z.kennung}: ${datei}`;
      const pfad = join(WURZEL, datei);
      expect(existsSync(pfad), ort).toBe(true);
      const text = readFileSync(pfad, "utf8");
      expect(text.includes(z.marke), `${ort} ohne ${z.marke}`).toBe(true);
      if (auchPaket2) expect(/paket 2/i.test(text), `${ort} ohne „Paket 2“`).toBe(true);
    }
  }
}

const AUSGELASSEN = new Set(["node_modules", "dist", "generated", ".local"]);
const TEXTDATEI = /\.(ts|tsx|js|mjs|md|json)$/;

function textdateien(verzeichnis: string): string[] {
  const funde: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (AUSGELASSEN.has(eintrag.name)) continue;
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) funde.push(...textdateien(pfad));
    else if (eintrag.isFile() && TEXTDATEI.test(eintrag.name)) funde.push(pfad);
  }
  return funde;
}

describe("Z1: Paket 2 (mega87 + mega88) stimmt mit dem Bestand überein", () => {
  const liste = paket2();

  it("führt zwei mega87- und vier mega88-Dateien, je genau eine pro Zeile", () => {
    expect(liste.filter((z) => z.kennung === "mega87")).toHaveLength(2);
    expect(liste.filter((z) => z.kennung === "mega88")).toHaveLength(4);
    for (const z of liste) expect(z.dateien, z.kennung).toHaveLength(1);
  });

  it("jede genannte Datei existiert und trägt ihre Paketkennung", () => {
    pruefeDateien(liste, false);
  });
});

describe("Z2: namensgleiche „Paket 2“ stimmen mit dem Bestand überein", () => {
  const liste = namensgleiche();

  it("führt A–E, jede mit Programm und Datei", () => {
    expect(liste.map((z) => z.kennung)).toEqual(["A", "B", "C", "D", "E"]);
    for (const z of liste) {
      expect(z.marke, z.kennung).toBeTruthy();
      expect(z.dateien.length, z.kennung).toBeGreaterThan(0);
    }
  });

  it("jede genannte Datei existiert und trägt Programmkennung und „Paket 2“", () => {
    pruefeDateien(liste, true);
  });
});

describe("Z3: R-1395 hat keine Fundstelle im Produktbestand außer der Akte", () => {
  it("JOB 534, Scopeanalyse, F-1395 und R-1395 stehen nur in der Akte", () => {
    const muster = /Scopeanalyse|\bJOB[ -]534\b|\bF-1395\b|\bR-1395\b/i;
    const treffer = ["apps", "services", "docs"]
      .flatMap((teil) => textdateien(join(WURZEL, teil)))
      .map((pfad) => relative(WURZEL, pfad))
      .filter((pfad) => pfad !== AKTE)
      .filter((pfad) => muster.test(readFileSync(join(WURZEL, pfad), "utf8")));
    expect(treffer).toEqual([]);
  });
});

describe("Z4: Gegenstand benannt, Bestand und Lieferung getrennt", () => {
  it("nennt Integrationspaket 2 (MEGA87–88) und seinen Einzug in den Hauptstand", () => {
    const gegenstand = abschnitt("Gegenstand: Integrationspaket 2 = mega87 + mega88");
    expect(akte).toContain("**Integrationspaket 2 (MEGA87–88:\nAuswahlstabilität und Bildanker)**");
    expect(gegenstand).toContain("`7bc79b10e`");
  });

  it("führt A–E nur als Quellbestand und nicht mehr als Wahl", () => {
    expect(akte).toContain("Belegt ist **nur der Quellbestand**");
    expect(akte).not.toContain("bereits gelieferte Teilumfänge");
    expect(akte).not.toContain("## Erforderliche Entscheidung (Pedi)");
    expect(akte).not.toContain("- **G — nicht mehr zuordenbar.**");
  });

  it("benennt die fehlenden Abschlussbelege für mega87/88", () => {
    const luecken = abschnitt("Quellenwidersprüche und fehlende Belege");
    expect(luecken).toContain("**Kein grünes Ben-Urteil:**");
    expect(luecken).toContain("Ein Abschlussbeleg für mega87/88 als Paket fehlt.");
  });

  it("hält den Originalwortlaut von R-1395 und den fehlenden Pedi-Entscheid fest", () => {
    expect(akte).toContain("„Abgrenzung, was zu Paket 2 gehoert und was nicht.“");
    expect(akte).toContain("`pedi_override: null`");
  });
});
