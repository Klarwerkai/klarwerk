// ================================================================================================
// JOB 3612 · Q9-KATALOGSPRACHE — DREI FASSUNGEN, DIE AUCH WIRKLICH DREI SPRACHEN SIND.
// ================================================================================================
//
// DER BEFUND, gegen den S1 und S2 stehen (gemessen an main 00ad694):
//
//   R6 (JOB 3449, unten unverändert) prüft, DASS jeder Schlüssel drei nichtleere Fassungen hat —
//   nicht, DASS sie verschieden sind. Ein deutscher Satz im `en`- oder `nl`-Feld bestand ihn
//   deshalb, solange kein Routenfall genau diesen Schlüssel misst. Gemessen wird heute nur jeder
//   dritte: 8 von 27 Schlüsseln (`katalogschluessel-herkunft.test.ts`, H4). Für die anderen 19 war
//   „ist übersetzt" bis hierher eine Behauptung ohne Prüfung.
//
//   Codex hat die Lücke benannt und offen gelassen (`archiv/3449/runde-2/ben.md`, HINWEIS 2:
//   „Der Katalogwächter prüft Vorhandensein und Nicht-Leere, nicht die Sprache"); der Ordner hatte
//   seither keinen Halter.
//
// ZWEI STELLEN, AN DENEN DIE LÜCKE AUFGEHT — S1 und S2 schließen je eine, keine ersetzt die andere:
//
//   S1  im KATALOG     `en` und `nl` sind nicht wortgleich mit `de`. (Deutscher Satz im falschen
//                      Feld.)
//   S2  in der AUSWAHL `meldung(key,"en")` liefert wirklich die `en`-Fassung. R6 misst von
//                      `meldung()` nur den `de`-Zweig und den `fr`-Rückfall (:16-17 der alten
//                      Fassung, unten unverändert). Fiele `"nl"` aus der Bedingung in
//                      `meldungen.ts:152`, bliebe R6 grün, S1 bliebe grün — und jeder
//                      niederländische Nutzer bekäme ab da Deutsch zu lesen.
//
// KEINE AUSNAHMELISTE. Findet S1 einen Gleichstand, wird das Katalogfeld übersetzt, nicht der
// Wächter entschärft. Beide Fälle laufen über `Object.entries(MELDUNGEN)`, nicht über eine
// abgeschriebene Schlüsselliste: ein 28. Schlüssel ist am Tag seiner Einführung mitgeprüft.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { MELDUNGEN, meldung } from "../../services/auth/src/meldungen";

const SPRACHEN = ["de", "en", "nl"] as const;

/**
 * Der Katalog als flache Liste. Bewusst über die drei benannten Felder statt über einen dynamischen
 * Index: nur so bleibt jeder Text für den Typprüfer eine Zeichenkette, und eine fehlende Sprache
 * fällt beim Bauen auf statt erst als `undefined` mitten in einem Wächter.
 */
const FASSUNGEN = Object.entries(MELDUNGEN).map(([schluessel, texte]) => ({
  schluessel,
  de: texte.de,
  en: texte.en,
  nl: texte.nl,
}));

// R6 unverändert in seiner Zusage (drei nichtleere Fassungen) und in jeder seiner Prüfungen. Nur
// der Modulzugang liegt jetzt oben am Dateikopf statt als zweiter, gleichlautender Pfad im Fall —
// bis hierher stand derselbe Pfad zweimal in dieser Datei (`archiv/3449/runde-2/ben.md`, HINWEIS 5).
it("R6 jeder echte Katalogschlüssel hat drei nichtleere Sprachfassungen", () => {
  const pfad = resolve(__dirname, "../../services/auth/src/meldungen.ts");
  expect(existsSync(pfad), "Auth-Meldungskatalog fehlt").toBe(true);
  const katalog = MELDUNGEN as Record<string, Record<string, string>>;
  expect(Object.keys(katalog).length).toBeGreaterThan(0);
  for (const [key, texte] of Object.entries(katalog)) {
    for (const sprache of SPRACHEN) {
      expect(typeof texte[sprache], `${key}.${sprache} fehlt`).toBe("string");
      expect(texte[sprache]?.trim(), `${key}.${sprache} ist leer`).not.toBe("");
    }
    expect(meldung(key)).toBe(texte.de);
    expect(meldung(key, "fr")).toBe(texte.de);
  }
});

it("S1 keine englische oder niederländische Fassung ist wortgleich mit der deutschen", () => {
  const gleichstaende: string[] = [];
  for (const { schluessel, de, en, nl } of FASSUNGEN) {
    for (const [sprache, text] of [
      ["en", en],
      ["nl", nl],
    ] as const) {
      // Getrimmt verglichen: ein angehängtes Leerzeichen macht aus einem deutschen Satz keinen
      // englischen, bestünde einen rohen Vergleich aber und verdeckte den Gleichstand.
      if (text.trim() === de.trim()) {
        gleichstaende.push(`${schluessel}.${sprache} ist wortgleich mit \`de\`: "${de}"`);
      }
    }
  }
  expect(
    gleichstaende,
    `Wer die Anwendung auf Englisch oder Niederländisch benutzt, bekommt bei einem Anmelde- oder
Kontofehler einen Satz in SEINER Sprache. Ein deutscher Satz im \`en\`- oder \`nl\`-Feld bleibt
sonst unbemerkt, solange kein Routenfall genau diesen Schlüssel misst — und das tut heute nur
jeder dritte. Fehlt eine Übersetzung, wird sie nachgetragen; dieser Wächter bekommt keine
Ausnahmeliste: ${gleichstaende.join(" · ")}`,
  ).toEqual([]);
});

it("S2 meldung() liefert für de, en und nl die jeweils eigene Fassung", () => {
  // Die Auswahl selbst ist das zweite Glied der Nutzenkette (Katalog → meldung() → sendError →
  // Antworttext). R6 misst davon nur den de-Zweig und den fr-Rückfall; die beiden Zweige, auf denen
  // das ganze Versprechen dieses Ordners beruht, waren ungemessen.
  const abweichungen: string[] = [];
  for (const { schluessel, de, en, nl } of FASSUNGEN) {
    for (const [sprache, erwartet] of [
      ["de", de],
      ["en", en],
      ["nl", nl],
    ] as const) {
      const geliefert = meldung(schluessel, sprache);
      if (geliefert !== erwartet) {
        abweichungen.push(
          `meldung("${schluessel}","${sprache}") → "${geliefert}" statt "${erwartet}"`,
        );
      }
    }
  }
  expect(
    abweichungen,
    `Die Sprachwahl in \`meldungen.ts\` muss die gewählte Fassung liefern, nicht die deutsche.
Fällt eine Sprache aus der Bedingung, antwortet die Route ab da still auf Deutsch — und zwar für
JEDEN Schlüssel zugleich. Deshalb hier nur die ersten Abweichungen von ${abweichungen.length};
die vollständige Liste steht im Vergleich darunter: ${abweichungen.slice(0, 3).join(" · ")}`,
  ).toEqual([]);
});
