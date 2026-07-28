// ================================================================================================
// AUFTRAG-mega35 BLOCK B — WORD BEHAUPTETE „GEPRÜFTES WISSEN" NEBEN „UNGEPRÜFT".
// ================================================================================================
//
// DER BEFUND. Die Word-Fläche versprach an vier Stellen unbedingt geprüftes Wissen — Fragen-Hinweis,
// Suchmeldung, Antwort-Überschrift und die Quellenzeile, die MIT ins Dokument reist — und stellte
// bei gedeckelter Abdeckung direkt daneben die Einstufung „ungeprüft — nicht als konfliktfrei
// belegt". Technisch meint das eine den validierten Bestand und das andere die Antwortklasse. Eine
// Testerin ohne Vorwissen kann diese zwei Ebenen nicht auseinanderhalten; ihre Aufgabe 7 fragt
// genau danach.
//
// DIE REGEL, die dieser Test durchsetzt: Die Worte GESICHERT und GEPRÜFT (samt ihren englischen und
// niederländischen Entsprechungen) stehen ausschließlich im Einstufungshinweis. Nirgends sonst in
// der Word-Fläche. Überschrift und Quellenzeile sind neutral.
//
// Geprüft wird über ALLE i18n-Werte des Taskpane in DE, EN und NL — nicht über eine Liste bekannter
// Schlüssel. Eine neu hinzugefügte Meldung, die das Wort wieder einführt, fällt damit auf.
//
// NICHT betroffen und bewusst erlaubt: „validiert"/„validated"/„gevalideerd" (die Statusangabe des
// Wissensobjekts, die in der Quellenliste als Abzeichen danebensteht) und „In Prüfung" (derselbe
// Status). Das sind Aussagen ÜBER EIN OBJEKT, keine Zusage über die Antwort.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

// Die beiden Schlüssel, die das Wort tragen DÜRFEN — und müssen.
const EINSTUFUNG = ["askEvidenceVerified", "askEvidenceUnverified"];

// Wortformen, nicht Wortstämme: „In Prüfung" (Objektstatus) bleibt zulässig, „geprüft" nicht.
const VERBOTEN: { sprache: string; muster: RegExp }[] = [
  { sprache: "de", muster: /gepr(ue|ü)ft/i },
  { sprache: "de", muster: /gesichert/i },
  { sprache: "en", muster: /verified/i },
  { sprache: "en", muster: /assured/i },
  { sprache: "nl", muster: /gecontroleerd/i },
  { sprache: "nl", muster: /gewaarborgd/i },
];

// Alle i18n-Einträge des Taskpane als (Schlüssel, Text). Kommentarzeilen fallen durch das Muster.
function i18nEintraege(): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = [];
  for (const zeile of HTML.split("\n")) {
    const treffer = zeile.match(/^\s{8}([A-Za-z0-9_]+):\s*"(.*)",\s*$/);
    if (treffer) {
      out.push({ key: treffer[1] as string, text: treffer[2] as string });
    }
  }
  return out;
}

describe("mega35 B · die Wortliste der Word-Fläche", () => {
  it("die Ernte greift: alle drei Sprachblöcke sind erfasst", () => {
    const eintraege = i18nEintraege();
    // Ohne diese Kalibrierung könnte ein kaputtes Muster null Treffer liefern und der Test wäre
    // still grün, ohne irgendetwas geprüft zu haben.
    expect(eintraege.length).toBeGreaterThan(150);
    for (const key of EINSTUFUNG) {
      expect(
        eintraege.filter((e) => e.key === key),
        key,
      ).toHaveLength(3);
    }
    // Die vier Stellen aus bens Befund sind in der Ernte enthalten.
    for (const key of ["askHint", "askBusy", "askAnswerTitle", "askSourceLine"]) {
      expect(
        eintraege.filter((e) => e.key === key),
        key,
      ).toHaveLength(3);
    }
  });

  it("„gesichert“ und „geprüft“ stehen NUR im Einstufungshinweis — DE, EN und NL", () => {
    const verstoesse: string[] = [];
    for (const { key, text } of i18nEintraege()) {
      if (EINSTUFUNG.includes(key)) {
        continue;
      }
      for (const { sprache, muster } of VERBOTEN) {
        if (muster.test(text)) {
          verstoesse.push(`${key} [${sprache}/${muster.source}]: ${text}`);
        }
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it("der Einstufungshinweis trägt das Wort weiterhin — in allen drei Sprachen", () => {
    const noten = i18nEintraege().filter((e) => EINSTUFUNG.includes(e.key));
    expect(noten).toHaveLength(6);
    // Jede der sechs Fassungen sagt etwas über den Belegzustand — keine ist leer geräumt worden.
    for (const { key, text } of noten) {
      expect(text.length, key).toBeGreaterThan(20);
    }
    // Und die Worte, die überall sonst verboten sind, kommen hier tatsächlich vor.
    const zusammen = noten.map((n) => n.text).join(" | ");
    for (const { muster } of VERBOTEN) {
      expect(muster.test(zusammen), muster.source).toBe(true);
    }
  });

  it("Überschrift und Quellenzeile sind neutral — in allen drei Sprachen", () => {
    const eintraege = i18nEintraege();
    const text = (key: string): string[] =>
      eintraege.filter((e) => e.key === key).map((e) => e.text);

    expect(text("askAnswerTitle")).toEqual([
      "Quellengebundene Antwort",
      "Source-bound answer",
      "Bronvast antwoord",
    ]);
    // Die Quellenzeile reist MIT ins Dokument — sie ist die Stelle, an der eine zu starke Zusage
    // das Haus verlassen würde.
    expect(text("askSourceLine")).toEqual([
      "Quelle: {titles} (KLARWERK-Wissen, Stand {date})",
      "Source: {titles} (KLARWERK knowledge, as of {date})",
      "Bron: {titles} (KLARWERK-kennis, per {date})",
    ]);
    expect(text("askSourceLineRetrieved")).toEqual([
      "Quelle: {titles} (KLARWERK-Wissen, abgerufen am {date})",
      "Source: {titles} (KLARWERK knowledge, retrieved on {date})",
      "Bron: {titles} (KLARWERK-kennis, opgehaald op {date})",
    ]);
  });

  it("die Statusangaben des Wissensobjekts bleiben unangetastet", () => {
    // Sie sagen etwas über ein OBJEKT, nicht über die Antwort — und die Quellenliste braucht sie.
    const eintraege = i18nEintraege();
    expect(eintraege.filter((e) => e.key === "askStatusValidiert").map((e) => e.text)).toEqual([
      "Validiert",
      "Validated",
      "Gevalideerd",
    ]);
    expect(eintraege.filter((e) => e.key === "askStatusPruefung")).toHaveLength(3);
  });
});
