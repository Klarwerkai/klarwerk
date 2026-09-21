// ================================================================================================
// JOB 4367 · DIE KALIBRIERUNG DES STATISCHEN LESERS — ohne sie wäre der Build-Vertrag blind.
// ================================================================================================
//
// DAS PROBLEM. Zwei der sechs Zusagen des Modulvertrags brauchen den GRUNDBESTAND: „kein Schlüssel
// kommt zweimal vor" und „der Altname wurde aus `i18n.ts` wirklich entfernt". Zur Laufzeit ist der
// Grundbestand einfach da (`Object.keys(de)`). Das Build-Plugin läuft aber, BEVOR irgendetwas
// gebündelt ist, und liest `i18n.ts` deshalb als Text (`basisSchluesselAusQuelltext`).
//
// EIN TEXTLESER IST EINE ANNAHME ÜBER FORMATIERUNG, und Annahmen dieser Art zerbrechen leise: sie
// finden dann ein paar Schlüssel nicht mehr, melden nichts, und der Vertrag ist ab diesem Tag
// halb so viel wert. Genau das ist in JOB 3326 R5 schon einmal passiert, als sieben Wörterbuch-
// Leser über einem gespreadeten Block zerbrachen.
//
// DESHALB WIRD DER LESER GEGEN DIE WAHRHEIT GELEGT: gegen die Schlüssel des WIRKLICH
// initialisierten i18next, abzüglich dessen, was aus den Textmodulen kommt. Weichen beide Mengen
// ab, wird DIESER Test rot — namentlich, mit den Schlüsseln, die der Leser übersieht oder zu viel
// findet. Das ist die einzige Stelle, an der die Formatannahme überhaupt auffallen kann.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { basisSchluesselAusQuelltext } from "../../apps/web/src/texte/intern/pruefung";
import { basisQuellen, ladeTextbaum } from "../../apps/web/src/texte/intern/sammeln";
import { repoPfad } from "../support/repoPfad";

const SRC = repoPfad("apps/web/src");

function laufzeitSchluessel(): Set<string> {
  const bestand = i18n.getResourceBundle("de", "translation") as Record<string, string> | undefined;
  if (!bestand) {
    throw new Error("Sprachbestand de fehlt");
  }
  return new Set(Object.keys(bestand));
}

function modulSchluessel(): Set<string> {
  const gefunden = new Set<string>();
  for (const modul of Object.values(ladeTextbaum(SRC).module)) {
    for (const schluessel of Object.keys((modul as { de: Record<string, string> }).de)) {
      gefunden.add(schluessel);
    }
  }
  return gefunden;
}

describe("JOB 4367 · der statische Grundbestand deckt sich mit dem laufenden", () => {
  it("liest genau die Schlüssel, die i18next ohne die Module hätte", () => {
    const quellen = basisQuellen(`${SRC}/i18n.ts`);
    const statisch = basisSchluesselAusQuelltext(
      quellen.map((datei) => readFileSync(datei, "utf8")),
    );
    const ausModulen = modulSchluessel();
    const erwartet = [...laufzeitSchluessel()].filter((name) => !ausModulen.has(name)).sort();

    const uebersehen = erwartet.filter((name) => !statisch.has(name));
    const zuviel = [...statisch].filter((name) => !erwartet.includes(name)).sort();

    expect(
      uebersehen,
      "diese Schlüssel stehen im laufenden Grundbestand, der Textleser des Build-Plugins findet sie aber nicht — der Vertrag wäre für sie blind",
    ).toEqual([]);
    expect(
      zuviel,
      "diese Schlüssel findet der Textleser, obwohl es sie im laufenden Bestand nicht gibt — dann meldet der Build Fehler, die keine sind",
    ).toEqual([]);
    expect(erwartet.length).toBeGreaterThan(4000);
  });

  it("liest die ausgelagerten Blöcke mit — sonst wäre lesevariante.* frei erfindbar", () => {
    const quellen = basisQuellen(`${SRC}/i18n.ts`);
    expect(
      quellen.some((datei) => datei.endsWith("lib/lesevariante.ts")),
      "i18n.ts spreadet lesevarianteTexteDe hinein; die Datei gehört deshalb zum Grundbestand",
    ).toBe(true);
    const statisch = basisSchluesselAusQuelltext(
      quellen.map((datei) => readFileSync(datei, "utf8")),
    );
    expect(statisch.has("lesevariante.badge.original")).toBe(true);
  });
});
