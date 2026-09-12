// @vitest-environment jsdom
// ================================================================================================
// JOB 3783 · DIE SÄTZE DER FREIGABE IN DREI SPRACHEN — UND DER EINE SCHREIBWEG.
// ================================================================================================
//
// ZWEI ZUSAGEN, die der Durchstich (`freigabe-durchstich.test.tsx`) nicht misst, weil er in EINER
// Sprache läuft und nur das Verhalten sieht:
//
//   T · Jeder neue Satz steht in DE, EN UND NL. Geprüft wird die jeweilige Sprachressource
//       DIREKT (`i18n.getResource(<sprache>, …)`) und nicht über `t()` — LEHRE aus JOB 3742 R1:
//       ein Sprachwächter, der über `t()` misst, sieht eine fehlende NL-Übersetzung nicht, weil
//       der Rückfall auf `de` sie still ersetzt. `getResource` hat keinen Rückfall: fehlt ein
//       Satz in einer Sprache, ist genau diese Zeile rot, mit Sprache und Schlüssel im Namen.
//
//   W · Die Karte schreibt über GENAU EINEN Adminweg und führt KEIN zweites Protokoll
//       (Auftrag §5/§6; JOB 3549: „ein zweiter Adminweg wäre ein zweites Recht, ein zweites
//       Protokoll und eine zweite Gelegenheit, eines von beidem zu vergessen").
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
// Die Sätze wohnen bei ihrer Fläche und werden beim Laden des Moduls nachgereicht
// (`AdminKiDetails.tsx`, Abschnitt „DIE SÄTZE DER FREIGABE"). Deshalb steht dieser Import hier —
// ohne die Karte gäbe es die Sätze nicht, und genau diese Kopplung ist Gegenstand der Prüfung.
// `antwortZaehlt` (Runde 2) kommt aus derselben Datei und wird unten in N1–N4 gemessen.
import { antwortZaehlt } from "../../apps/web/src/pages/AdminKiDetails";

const WURZEL = join(__dirname, "..", "..");
const KARTE = "apps/web/src/pages/AdminKiDetails.tsx";
const quelle = readFileSync(join(WURZEL, KARTE), "utf8");

/** Die Sätze, die dieser Job hinzugefügt hat — die Liste steht hier, die Texte in der Karte. */
const SCHLUESSEL = [
  "adm.ai.freigabe.titel",
  "adm.ai.freigabe.oeffentlich",
  "adm.ai.freigabe.vertraulich",
  "adm.ai.freigabe.stand",
  "adm.ai.freigabe.an",
  "adm.ai.freigabe.aus",
  "adm.ai.freigabe.wirkungslos",
  "adm.ai.freigabe.vertraulichWarnung",
  "adm.ai.freigabe.vertraulichJa",
  "adm.ai.freigabe.abbrechen",
  "adm.ai.freigabe.gespeichert",
  "adm.ai.freigabe.nachladen",
  "adm.ai.freigabe.nachladenFehler",
] as const;

const SPRACHEN = ["de", "en", "nl"] as const;

describe("JOB 3783 · T — die Sätze der Freigabe stehen in allen drei Sprachen", () => {
  for (const sprache of SPRACHEN) {
    it(`T-${sprache} · jeder Schlüssel trägt in „${sprache}" einen eigenen Satz`, () => {
      for (const schluessel of SCHLUESSEL) {
        const satz = i18n.getResource(sprache, "translation", schluessel);
        expect(typeof satz, `${schluessel} fehlt in ${sprache}`).toBe("string");
        expect(String(satz).length, `${schluessel} ist in ${sprache} leer`).toBeGreaterThan(2);
        expect(String(satz), `${schluessel} ist in ${sprache} nur der Schlüssel`).not.toBe(
          schluessel,
        );
      }
    });
  }

  it("T-verwendet · jeder Schlüssel wird von der Karte auch wirklich benutzt", () => {
    // Ein Satz ohne Aufrufer wäre totes Wörterbuch — und ein `t()`-Aufruf ohne Satz wäre eine
    // Fläche, die ihren eigenen Schlüssel anzeigt. Hier hängt beides zusammen.
    for (const schluessel of SCHLUESSEL) {
      expect(quelle, `${schluessel} steht im Bündel, wird aber nicht angezeigt`).toContain(
        `t("${schluessel}"`,
      );
    }
  });

  it("T-unterschiedlich · DE, EN und NL sind wirklich übersetzt, nicht dreimal derselbe Satz", () => {
    // Die Kalibrierung zu T-de/en/nl: ein einfach durchgereichter deutscher Satz bestünde die
    // Prüfungen oben, wäre aber keine Übersetzung. Die drei kurzen Zustandswörter („freigegeben"
    // in DE und NL) sind bewusst ausgenommen — sie fallen in zwei Sprachen zusammen.
    const gleichErlaubt = new Set(["adm.ai.freigabe.an", "adm.ai.freigabe.aus"]);
    for (const schluessel of SCHLUESSEL) {
      if (gleichErlaubt.has(schluessel)) {
        continue;
      }
      const de = String(i18n.getResource("de", "translation", schluessel));
      const en = String(i18n.getResource("en", "translation", schluessel));
      expect(en, `${schluessel}: EN ist wortgleich mit DE`).not.toBe(de);
    }
  });
});

describe("JOB 3783 · W — ein Adminweg, kein zweites Protokoll", () => {
  it("W1 · die Karte schreibt ausschließlich auf /reasoner/config", () => {
    const schreibwege = [...quelle.matchAll(/api\.(put|post|del)<[^>]*>\(\s*"([^"]+)"/g)].map(
      (m) => `${m[1]} ${m[2]}`,
    );
    expect(schreibwege, "die Karte schreibt auf einen zweiten Pfad").toEqual([
      "put /reasoner/config",
    ]);
  });

  it("W2 · die Karte legt kein eigenes Protokoll an — das tut der Server", () => {
    // Der Server schreibt die Auditzeile selbst (`reasoner-routes.ts:271` und `:759-861`,
    // `FREIGABE_ZIEL = "reasoner.kiFreigabe"`). Ein zweiter Eintrag von der Fläche aus wäre eine
    // zweite Wahrheit über denselben Vorgang — und die Fläche könnte ihn nicht erzwingen.
    expect(quelle).not.toContain("/audit");
    expect(quelle).not.toContain("endpoints.audit");
    expect(quelle).not.toContain("kiFreigabe-protokoll");
  });

  it("W3 · die Freigabe fährt über denselben Endpunkt wie die Zuordnung", () => {
    // `endpoints.reasoner.config` (GET) und `api.put("/reasoner/config")` sind derselbe Pfad —
    // die Fläche liest und schreibt an einer Stelle, so wie die Route sie anbietet.
    expect(quelle).toContain('queryKey: ["reasonerConfig"], queryFn: endpoints.reasoner.config');
    expect(quelle).toContain("endpoints.reasoner.updateConfig({");
    expect(quelle).toContain('api.put<ReasonerConfigStatus>("/reasoner/config"');
  });
});

// ================================================================================================
// N — DIE NUMMERNREGEL (Runde 2, BENs Korrekturpflicht 1, zweite Hälfte)
// ================================================================================================
//
// „… sodass ÜBERHOLTE PUT-ANTWORTEN KEINE NEUERE BESTÄTIGUNG ERSETZEN und Folgeschaltungen keine
// gespeicherten Werte zurücksetzen." Der zweite Halbsatz ist eine Bedienregel und wird auf der
// Fläche gemessen (`freigabe-durchstich.test.tsx`, Z1–Z4). Der erste ist eine Zustandsregel, und
// sie steht hier: `antwortZaehlt` entscheidet, ob eine eingetroffene Schreibantwort die geltende
// Bestätigung ablösen darf.
//
// EHRLICHE REICHWEITE, ausdrücklich: im Betrieb kann diese Regel nicht ablehnen, weil der
// Schreibkanal immer nur EIN Schreiben zulässt — zwei Antworten können sich gar nicht überholen.
// Sie ist der Riegel HINTER der Bediensperre, kein zweiter Weg neben ihr. Ein Riegel, den niemand
// prüft, ist eine Behauptung; deshalb wird er hier als Regel gemessen und nicht über die Fläche.
describe("JOB 3783 · N — eine Schreibantwort zählt nur vorwärts", () => {
  it("N1 · ohne geltende Bestätigung zählt jede Antwort", () => {
    expect(antwortZaehlt(null, 1)).toBe(true);
    expect(antwortZaehlt(null, 7)).toBe(true);
  });

  it("N2 · eine NEUERE Antwort löst die geltende Bestätigung ab", () => {
    expect(antwortZaehlt(1, 2)).toBe(true);
    expect(antwortZaehlt(2, 9)).toBe(true);
  });

  it("N3 · eine ÄLTERE Antwort wird verworfen — genau hier ging Runde 1 verloren", () => {
    // BENs Ablauf in Zahlen: Schreiben 1 (Zuordnung) trägt die Freigabe von vorher, Schreiben 2
    // (Freigabe) ist bestätigt. Träfe 1 danach ein, hätte Runde 1 es übernommen.
    expect(antwortZaehlt(2, 1)).toBe(false);
    expect(antwortZaehlt(9, 3)).toBe(false);
  });

  it("N4 · dieselbe Antwort noch einmal ist kein Rückschritt", () => {
    expect(antwortZaehlt(3, 3)).toBe(true);
  });
});
