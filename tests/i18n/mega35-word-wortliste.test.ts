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

// JOB 3092 S6 (W5/W6): vier deutsche Schlüssel tragen „geprüft“ als AUSSAGE ÜBER OBJEKTE bzw. über
// einen GELAUFENEN Prüfvorgang — genau die Klasse, die der Kopf dieser Datei ausdrücklich zulässt
// („Aussagen ÜBER EIN OBJEKT, keine Zusage über die Antwort“, wie „In Prüfung“):
//   · askUngeprueftEins/-Mehrere: „… der noch NICHT geprüft ist“ — Pedis Wortlaut (05.09., M2): das
//     Gegenteil eines Versprechens, es benennt ungeprüften Bestand statt ihn zu verschweigen.
//   · captureDubLeer/-Treffer: „(geprüft 14:32)“ — der Zeitstempel eines gelaufenen check-text-Laufs,
//     keine Aussage über die Antwort. EN/NL kommen ohne das verbotene Wort aus (reviewed/checked,
//     beoordeeld/nagekeken). Die Liste ist abschließend; ein fünfter Schlüssel fällt wieder auf.
const OBJEKTAUSSAGEN = [
  "askUngeprueftEins",
  "askUngeprueftMehrere",
  "captureDubLeer",
  "captureDubTreffer",
  // Runde 2 (BEN 1): die gekuerzte Pruefung — „nur die ersten 8000 Zeichen konnten geprüft
  // werden … der Rest bleibt ungeprüft": dieselbe Vorgangsaussage, ausdruecklich EINGESCHRAENKT.
  "captureDubLeerGekuerzt",
  "captureDubTrefferGekuerzt",
  // JOB 3094 (KA7 „Passt das zur Regelung?“): drei Lagesätze des Abgleichs tragen „(geprüft {zeit})“
  // — der Zeitstempel eines GELAUFENEN check-text-Laufs in der tiefen Stufe, dieselbe Vorgangsklasse
  // wie captureDubLeer. Der Wortlaut „Keine Abweichung zu geprüften Quellen gefunden (geprüft <Zeit>)“
  // ist Auftrag 3094 §5.3; er steht NUR nach `konfliktpruefung.gelaufen === true` (mounted P2/P2b),
  // nie als Zusage über eine Antwort. EN/NL kommen ohne die dort verbotenen Wörter aus
  // (checked, nagekeken). Alle übrigen KA7-Sätze (Stand, Kürzung, Prüfstand) wurden so gefasst, dass
  // sie das Wort NICHT brauchen — der Prüfstand nutzt die 3093-Schlüssel (askStatusValidiert,
  // bestandNochNichtGeprueft), kein zweiter Wortlaut.
  "ka7Leer",
  "ka7LeerGekuerzt",
  "ka7LeerOhneQuelle",
];

// JOB 3093 (M3 „Haben wir das schon?"): EIN weiterer Schlüssel sagt etwas über ein OBJEKT — nicht
// über die Antwort. Das ist genau die Unterscheidung aus dem Kopf dieser Datei („Aussagen ÜBER EIN
// OBJEKT, keine Zusage über die Antwort"), unter der „In Prüfung" schon zulässig ist:
// `bestandNochNichtGeprueft` ist der Prüfstand eines gefundenen Eintrags (Pedis Wortlaut „noch
// nicht geprüft", CODEX-POC-ENTSCHEIDUNG-1). Die Lagesätze des Bestandswegs (leer/Treffer/
// gekürzt/Fehler) sind DIESELBEN Schlüssel wie in der Erfassen-Fläche (captureDub*, oben) — kein
// zweiter Wortlaut. Der Schlüssel steht in der Bestandsliste des Panels, nie in der Antwortkarte,
// nie in der Quellenzeile. Jeder weitere Schlüssel mit dem Wort bleibt rot.
const OBJEKTSTAND = ["bestandNochNichtGeprueft"];

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
    // JOB 3017 D4: der Fragen-Hinweis heisst seit dem Umbau des Grundpanels nicht mehr `askHint`,
    // sondern ist in `askReviewNotice` (der EINE Satz unter der Fragen-Karte) aufgegangen.
    for (const key of ["askReviewNotice", "askBusy", "askAnswerTitle", "askSourceLine"]) {
      expect(
        eintraege.filter((e) => e.key === key),
        key,
      ).toHaveLength(3);
    }
    // JOB 3046 D2: die Wortlaute der Luecke (Zielbild KeinWissen.dc.html) sind in der Ernte —
    // der eine Satz, die Hauptaktion, der Textlink, die Fusszeile — je Sprache genau einmal; der
    // entfernte Erklaertext askGapBody ist in keiner Sprache mehr da.
    for (const key of ["askGapTitle", "askGapFrageAendern", "askGapSendCta", "askGapFuss"]) {
      expect(
        eintraege.filter((e) => e.key === key),
        key,
      ).toHaveLength(3);
    }
    expect(eintraege.filter((e) => e.key === "askGapBody")).toHaveLength(0);
  });

  it("„gesichert“ und „geprüft“ stehen NUR im Einstufungshinweis — DE, EN und NL", () => {
    const verstoesse: string[] = [];
    for (const { key, text } of i18nEintraege()) {
      if (EINSTUFUNG.includes(key) || OBJEKTAUSSAGEN.includes(key) || OBJEKTSTAND.includes(key)) {
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

  it("JOB 3093 · der Objektstand-Schlüssel steht in allen drei Sprachen — und nur DE trägt das Wort", () => {
    const eintraege = i18nEintraege();
    for (const key of OBJEKTSTAND) {
      expect(
        eintraege.filter((e) => e.key === key),
        key,
      ).toHaveLength(3);
    }
    // EN/NL kommen ohne die dort verbotenen Wörter aus („reviewed"/„checked", „beoordeeld"/
    // „nagekeken") — die Ausnahme ist eine deutsche Wortform, keine Lizenz für drei Sprachen.
    const fremd = eintraege.filter(
      (e) => OBJEKTSTAND.includes(e.key) && !/gepr(ue|ü)ft/i.test(e.text),
    );
    expect(fremd).toHaveLength(2);
    for (const { key, text } of fremd) {
      for (const { sprache, muster } of VERBOTEN) {
        if (sprache !== "de") {
          expect(muster.test(text), `${key}: ${text}`).toBe(false);
        }
      }
    }
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
