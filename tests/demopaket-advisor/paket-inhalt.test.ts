// ================================================================================================
// JOB 3277 · A — DER DATENVERTRAG. EINE VERRUTSCHTE SILBE IST HIER ROT.
// ================================================================================================
//
// Das Paket `advisor-ict-en-v1` ist eine ABSCHRIFT aus
// `gespraech/advisor-freitag/advisor-paket-v1/CONTENT-MANIFEST.json`. Abschriften verrutschen —
// und ein verrutschter Baseline-Text wäre am Freitag der Fehler, den niemand sieht: der Import
// fände seinen Konflikt nicht mehr, und die Vorführung liefe ins Leere, ohne dass irgendetwas
// „kaputt" aussieht.
//
// DER PRÜFSTEIN IST DER HASH, DEN DER VERTRAG SELBST MITBRINGT. `content_sha256` ist der sha256
// der QUELLDATEI (`confluence/<Bereich>/<Schlüssel>.md`), und diese Datei hat eine feste Form:
//
//     # <Titel>
//     <Leerzeile>
//     <Fiktionshinweis>
//     <Leerzeile>
//     <Absatz 1>
//     <Leerzeile>
//     …
//     <Zeilenumbruch am Ende>
//
// Dieser Test baut die Quelldatei aus Titel, Hinweis und Absätzen WIEDER ZUSAMMEN und misst den
// Hash nach. Stimmt er, dann sind Titel und alle Absätze zeichengenau die des Vertrags — nicht
// „ungefähr", sondern bitgleich. Die sechs erwarteten Hashes stehen unten NOCH EINMAL, als zweite,
// unabhängige Abschrift: so schlägt der Test auch dann an, wenn jemand Text UND Hash in der
// Datendatei gemeinsam „nachzieht".
//
// ES WIRD BEWUSST KEINE DATEI AUS `gespraech/` GELESEN: die liegt in der Steuerung, nicht im
// Produkt, und wäre im Tor nicht vorhanden. Der Vertrag reist als Hash mit, nicht als Pfad.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADVISOR_FICTION_NOTICE,
  ADVISOR_ICT_EN_V1,
} from "../../services/app/src/example-packages/advisor-ict-en-v1";
import { DEMO_PACKAGES } from "../../services/app/src/example-packages/demo-pakete";

/** Die `baseline_keys` des Manifests, wörtlich — der Umfang, den dieses Paket abbilden MUSS. */
const BASELINE_KEYS = ["S02", "S04", "C01", "C02", "T01", "T03"];

/** Zweite, unabhängige Abschrift der `content_sha256`-Werte aus dem Manifest. */
const VERTRAGS_HASHES: Record<string, string> = {
  S02: "e4fa5343eca1249eebcf075fc411457ad74a7d3851919b94a8f6f58e3e1a1640",
  S04: "8959f4b87e32f22a0886320803e77e09bcd8b325843965d2bda1c2e7e2a390ee",
  C01: "6c6582acb674760bb0d95b9b2221ba07d43a91584999b2293502f1fdd5773ffb",
  C02: "a0230d2eb23eccfbfeb94ca836478bfad6376bbb44469b10c0b4319bd618ccb0",
  T01: "9cb6ba89482124f4c54ffe33b460b4d0888b97d131d1f2abf0810919fd04a938",
  T03: "2e51c3f492d03b2c970a62f6dcee270b9e71b534ab68ae209c1ca0b0a1b4320d",
};

function quelldatei(titel: string, absaetze: readonly string[]): string {
  return `# ${titel}\n\n${ADVISOR_FICTION_NOTICE}\n\n${absaetze.join("\n\n")}\n`;
}

describe("JOB 3277 A · das Paket ist die zeichengenaue Abschrift des Datenvertrags", () => {
  it("genau die sechs baseline_keys, in der Reihenfolge des Manifests", () => {
    expect(ADVISOR_ICT_EN_V1.id).toBe("advisor-ict-en-v1");
    expect(ADVISOR_ICT_EN_V1.language).toBe("en");
    expect(ADVISOR_ICT_EN_V1.fictional).toBe(true);
    expect(ADVISOR_ICT_EN_V1.items.map((i) => i.key)).toEqual(BASELINE_KEYS);
    // Und NICHTS darüber hinaus: die übrigen 30 Manifest-Seiten kommen über den echten
    // Confluence-Import, nicht über dieses Paket.
    expect(ADVISOR_ICT_EN_V1.items.length).toBe(6);
  });

  it("je Baustein: die rekonstruierte Quelldatei trifft den Vertragshash bitgenau", () => {
    for (const item of ADVISOR_ICT_EN_V1.items) {
      const gemessen = createHash("sha256")
        .update(quelldatei(item.title, item.paragraphs), "utf8")
        .digest("hex");
      // Gegen die MITGEFÜHRTE Angabe …
      expect(`${item.key}:${gemessen}`).toBe(`${item.key}:${item.contentSha256}`);
      // … und gegen die zweite, unabhängige Abschrift oben.
      expect(`${item.key}:${item.contentSha256}`).toBe(`${item.key}:${VERTRAGS_HASHES[item.key]}`);
    }
  });

  it("T03 trägt den ABSICHTLICHEN Fehler — er ist der Streitpunkt der Vorführung", () => {
    const t03 = ADVISOR_ICT_EN_V1.items.find((i) => i.key === "T03");
    expect(t03?.paragraphs[0]).toContain("only needs eight characters");
  });

  it("jeder Baustein bringt Bereich, Wissensart und drei Absätze mit", () => {
    for (const item of ADVISOR_ICT_EN_V1.items) {
      expect(["Sales", "Commercial", "Technical"], item.key).toContain(item.area);
      expect(item.paragraphs.length, item.key).toBe(3);
      expect(item.title.length, item.key).toBeGreaterThan(0);
      expect(item.type, item.key).toBeTruthy();
    }
  });

  it("Beschreibung und Titel liegen in allen drei Sprachen vor (EN ist Pflicht für den 11.09.)", () => {
    for (const pkg of DEMO_PACKAGES) {
      for (const sprache of ["de", "en", "nl"] as const) {
        expect(pkg.title[sprache].length, `${pkg.id}/title/${sprache}`).toBeGreaterThan(0);
        expect(pkg.description[sprache].length, `${pkg.id}/desc/${sprache}`).toBeGreaterThan(20);
      }
    }
    // Die englische Beschreibung nennt den Zweck: erst laden, dann importieren.
    expect(ADVISOR_ICT_EN_V1.description.en).toContain("before the Confluence import");
  });
});

// ------------------------------------------------------------------------------------------------
// Die Datei, die NIE in den Bestand darf. Der Vertrag sagt es wörtlich, und ein Test, der nur die
// Absicht dokumentiert, hätte nichts bewacht: hier wird der ganze Nicht-Test-Quellbaum abgesucht.
// ------------------------------------------------------------------------------------------------
const WURZEL = resolve(__dirname, "../..");
const BAEUME = ["services", "apps/web/src", "tools", "scripts"];

function quelldateien(ordner: string): string[] {
  const gefunden: string[] = [];
  let eintraege: string[];
  try {
    eintraege = readdirSync(ordner);
  } catch {
    return gefunden;
  }
  for (const name of eintraege) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) {
      continue;
    }
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) {
      gefunden.push(...quelldateien(pfad));
      continue;
    }
    if (/\.(ts|tsx|js|cjs|mjs|json)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      gefunden.push(pfad);
    }
  }
  return gefunden;
}

describe("JOB 3277 A · EXPECTED-RESULTS-DO-NOT-IMPORT.json ist nirgends importierbar", () => {
  it("kein Produktionspfad nennt die Datei — auch nicht als Zeichenkette", () => {
    const treffer: string[] = [];
    for (const baum of BAEUME) {
      for (const datei of quelldateien(join(WURZEL, baum))) {
        if (readFileSync(datei, "utf8").includes("EXPECTED-RESULTS")) {
          treffer.push(datei.slice(WURZEL.length + 1));
        }
      }
    }
    expect(treffer).toEqual([]);
  });

  it("kein Produktionspfad liest überhaupt aus dem Vertragsordner der Steuerung", () => {
    // Der Vertrag ist ABGESCHRIEBEN, nicht eingebunden: liefe ein Pfad gegen `gespraech/`, hinge
    // das Produkt an einem Ordner, den es im Betrieb nicht gibt — und die Erwartungsdatei läge
    // plötzlich in Reichweite.
    // Gesucht wird der LESEVORGANG, nicht die Erwähnung: der Dateikopf des Pakets darf (und soll)
    // sagen, woher die Zeilen abgeschrieben sind.
    const lesewege = /(readFile|readFileSync|createReadStream|require\(|import\()[^\n]*gespraech/;
    const treffer: string[] = [];
    for (const baum of BAEUME) {
      for (const datei of quelldateien(join(WURZEL, baum))) {
        if (lesewege.test(readFileSync(datei, "utf8"))) {
          treffer.push(datei.slice(WURZEL.length + 1));
        }
      }
    }
    expect(treffer).toEqual([]);
  });

  it("das Paket führt ausschließlich Baseline-Bausteine — keine erwarteten Ergebnisse", () => {
    // Die Erwartungsdatei nennt Befunde („expected conflict", Ergebnisurteile). Nichts davon steht
    // im Paket: es trägt Ausgangswissen, nicht die Auflösung.
    const text = JSON.stringify(ADVISOR_ICT_EN_V1).toLowerCase();
    for (const wort of ["expected_", "expected result", "do-not-import"]) {
      expect(`${wort}:${text.includes(wort)}`).toBe(`${wort}:false`);
    }
  });
});
