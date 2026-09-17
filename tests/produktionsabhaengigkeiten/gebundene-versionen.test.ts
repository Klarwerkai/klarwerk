// ================================================================================================
// JOB 4272 · 6f — DIE EINZIGE WAHRHEIT ÜBER VERSIONEN IST DIE LOCKDATEI.
// ================================================================================================
//
// WAS DIESER WÄCHTER VERHINDERT: einen Bericht, den niemand nachrechnet. Der Expositionsbericht
// (`README.md` daneben) nennt je Paket eine gebundene Version. Stünde diese Zahl NUR dort, wäre sie
// beim nächsten `npm install` still falsch — und die Einordnung „exponiert / nicht exponiert"
// hinge an einer Zahl, die nicht mehr gilt. Der Bericht führt deshalb KEINE eigenen Zahlen: er
// nennt den ORT in `package-lock.json`, und dieser Test liest die Version DORT und hält sie
// gegen die Tabelle.
//
// DARAUS FOLGT DIE TRAGENDE EIGENSCHAFT:
//   LOCKDATEI UND EINORDNUNG KÖNNEN NICHT AUSEINANDERLAUFEN, OHNE DASS DIESER TEST ROT WIRD.
//
// Er ist der Red-first-Fall dieses Auftrags: vor dem Bericht ist er rot, weil die Tabelle fehlt.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type Lockdatei, berichtstabelle, versionsAbweichungen } from "./waechter";

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, "..", "..");
const BERICHT = join(HIER, "README.md");

/** Die drei erlaubten Zustände. „unentschieden" ist eine ehrliche Antwort, keine Verlegenheit. */
const URTEILE = ["exponiert", "nicht exponiert", "unentschieden"] as const;

/**
 * Die acht Zeilen, die der Bericht führen MUSS — sieben gemeldete Pakete, `brace-expansion`
 * doppelt (Lieferung 2: die beiden installierten Versionen werden ausdrücklich nicht pauschal
 * gleich bewertet). Das ist bewusst KEINE Versionsangabe: hier steht, WORÜBER geurteilt werden
 * muss, nicht WAS gebunden ist. Das Was steht in der Lockdatei und nirgends sonst.
 */
const PFLICHTORTE = [
  "node_modules/@fastify/static",
  "node_modules/@fastify/static/node_modules/brace-expansion",
  "node_modules/brace-expansion",
  "node_modules/fast-uri",
  "node_modules/fastify",
  "node_modules/find-my-way",
  "node_modules/nodemailer",
  "node_modules/sharp",
] as const;

function lock(): Lockdatei {
  return JSON.parse(readFileSync(join(WURZEL, "package-lock.json"), "utf8")) as Lockdatei;
}

/** Die Expositionstabelle des Berichts — gelesen mit derselben Funktion wie in der Kalibrierung. */
function tabelle() {
  return berichtstabelle(readFileSync(BERICHT, "utf8"));
}

describe("JOB 4272 · gebundene Versionen (der Bericht liest aus der Lockdatei)", () => {
  it("die Tabelle führt genau die acht Pflichtorte — sieben Pakete, brace-expansion doppelt", () => {
    const orte = tabelle().map((z) => z.ort);
    expect(
      [...orte].sort(),
      "Der Expositionsbericht deckt nicht genau die acht gemeldeten Orte ab",
    ).toEqual([...PFLICHTORTE].sort());
    expect(new Set(orte).size, "Ein Ort steht doppelt in der Tabelle").toBe(orte.length);
  });

  it("jede genannte Version steht so wirklich in package-lock.json", () => {
    // Dieselbe Funktion fährt `kalibrierung.test.ts` gegen eine isolierte Lockdatei mit EINER
    // verstellten Version; dort muss sie reden, hier muss sie schweigen.
    expect(
      versionsAbweichungen(lock(), tabelle()),
      "Lockdatei und Expositionsbericht sind auseinandergelaufen — die Einordnung hängt an einer Zahl, die nicht mehr gilt",
    ).toEqual([]);
  });

  it("jede Zeile trägt genau einen der drei erlaubten Zustände", () => {
    for (const z of tabelle()) {
      expect(
        URTEILE as readonly string[],
        `${z.paket}: unerlaubtes Urteil „${z.urteil}"`,
      ).toContain(z.urteil);
    }
  });

  it("der Bericht behauptet nirgends Sicherheit (Lieferung 9)", () => {
    const text = readFileSync(BERICHT, "utf8");
    // Die verbotene Gattung Satz: eine Gesamtentwarnung. Erlaubt ist ausschliesslich die Aussage
    // über EINE Meldung an EINEM Pfad — deshalb greift das Muster nur die pauschale Form.
    for (const verboten of [
      /Klarwerk ist sicher/i,
      /frei von Sicherheitsmeldungen/i,
      /keine Sicherheitslücken/i,
      /alle Meldungen behoben/i,
    ]) {
      expect(
        verboten.test(text),
        `Der Bericht enthält eine Sicherheitsbehauptung: ${verboten}`,
      ).toBe(false);
    }
  });

  it("der Bericht führt den Abschnitt „Nicht gemessen“ (Lieferung 10)", () => {
    expect(readFileSync(BERICHT, "utf8")).toContain("## Nicht gemessen");
  });

  // ==============================================================================================
  // DIE ZWEITE HÄLFTE DER DOPPELBEWERTUNG (Lieferung 2): die beiden `brace-expansion` unterscheiden
  // sich nicht nur in der Nummer, sondern in der KLASSE — die eine hängt an einer
  // Produktionsabhängigkeit, die andere ist im Lockfile als `dev` markiert und kommt in
  // `npm audit --omit=dev` deshalb gar nicht vor. Genau das ist der Grund, warum der Befund
  // verlangt, sie nicht pauschal gleich zu bewerten.
  // ==============================================================================================
  it("brace-expansion: die eine hängt in der Produktion, die andere ist dev-markiert", () => {
    const p = lock().packages;
    expect(p["node_modules/@fastify/static/node_modules/brace-expansion"]?.dev ?? false).toBe(
      false,
    );
    expect(p["node_modules/brace-expansion"]?.dev ?? false).toBe(true);
  });
});
