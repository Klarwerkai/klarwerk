import { describe, expect, it } from "vitest";
import { normalizeSearchFragment, normalizeSearchTerms } from "../../services/knowledge-object";
import { queryTokens } from "../../services/reasoner";

// ================================================================================================
// JOB 1493 · KA1 — DIE UEBERGABE DES BEGRIFFSBILDS AN DIE SUCHE, HAUSSEITIG ZUGESICHERT.
// ================================================================================================
//
// WAS HIER GEPRUEFT WIRD — und was ausdruecklich NICHT.
//
// `tests/app/word-addin.test.ts` (Gruppe „JOB 1149 · KA1") sichert die eine Haelfte: die buildlose
// SPIEGELFASSUNG im Aufgabenfenster verhaelt sich wie die Suchregel des Hauses. Sie prueft das
// Panel gegen das Haus.
//
// Diese Datei prueft die andere Haelfte: die REGEL SELBST — und zwar an der Naht, an der KA2 sie
// benutzt. Denn die Begriffsliste ist kein Selbstzweck; sie wird als `KoSearchQuery.terms` in die
// bestehende Suchmechanik gereicht (`services/knowledge-object/src/search-projection.ts`,
// Abschnitt „Die Abfrage des gemeinsamen Suchvertrags"). Ob sie DORT unveraendert ankommt, hat
// bisher nichts gemessen.
//
// DIE LUECKE, GEMESSEN (JOB 1493 D1, Stand `449d76b4`): `normalizeSearchTerms` wird ausserhalb der
// Adapter nur von `tests/app/word-addin.test.ts` und `tests/app/mega69-klara-waechter.test.ts`
// beruehrt — also ausschliesslich ueber die Panelspiegelung. Faellt der Panelblock je weg, faellt
// mit ihm JEDE ausfuehrbare Zusage ueber die Begriffsgewinnung, weil die dortigen Tests ihren
// Pruefgegenstand aus dem HTML laden. Diese Datei haengt an keinem Markup.
//
// WARUM DIE REZEPTUR HIER STEHT UND NICHT IM PRODUKT. Sie ist dreistufig und ueberschreitet eine
// Modulgrenze: `normalizeSearchFragment`/`normalizeSearchTerms` liegen in `knowledge-object`,
// `queryTokens` in `reasoner`. `reasoner` importiert `knowledge-object` — die Gegenrichtung waere
// ein Zyklus, und `.dependency-cruiser.cjs` fuehrt `no-circular` mit `severity: "error"`
// („Verstoesse brechen den Build"). Eine hausseitige Funktion braucht deshalb einen eigenen
// Zuschnitt in `services/reasoner` und eine eigene Kennung; sie wird hier NICHT nebenbei erfunden.
// Was diese Datei tut, ist das Gegenteil einer zweiten Auslegung: sie ruft die EINEN echten
// Hausfunktionen auf und haelt ihr Zusammenspiel fest.
//
// KEINE ZUSICHERUNG WIRD WEGGENOMMEN. Diese Datei ist neu und nimmt keiner anderen etwas ab.

/**
 * DIE KANONISCHE REZEPTUR — aus den echten Hausfunktionen zusammengesetzt, nicht nachgebaut.
 *
 * Die Reihenfolge IST die Aussage: erst die Bereinigung (Entitaeten, NFKC, unsichtbare Zeichen,
 * Leerraum), dann die Inhaltstoken-Zerlegung der Suche, dann die kanonische Termbereinigung der
 * Suchadapter. Die erste Zusicherung unten zeigt an gemessenen Werten, dass keine Stufe entbehrlich
 * ist.
 */
function begriffsbild(text: string, deckel: number): string[] {
  return normalizeSearchTerms(queryTokens(normalizeSearchFragment(text))).slice(0, deckel);
}

// Der Deckel des Begriffsbilds. Er ist eine Eigenschaft der ANZEIGE (das Aufgabenfenster fuehrt ihn
// als `KA1_MAX_TERMS`), nicht der Suchregel — deshalb steht er hier als Parameter der Rezeptur und
// nicht als zweite Wahrheit. Dass das Panel denselben Wert benutzt, ist in
// `tests/app/word-addin.test.ts` gepinnt.
const DECKEL = 12;

// Ein realistischer Dokumentanfang mit Umlauten, einer HTML-Entitaet, einer Wiederholung,
// Stoppwoertern, Kurzwoertern, einer technischen Kennung und Inhaltswoertern.
const DOKUMENT =
  "Die Wartung der Hallenkr&auml;ne ist zu pr&uuml;fen. Bei der Wartung gilt: der Kran wird vorher entlastet, das Ventil ab M12 geschlossen.";

describe("JOB 1493 · KA1: die Uebergabe des Begriffsbilds an die Suche", () => {
  it("die drei Stufen sind nicht austauschbar — jede weggelassene liefert eine ANDERE Liste", () => {
    // KALIBRIERUNG ZUERST: die vollstaendige Rezeptur liefert das gemessene Ergebnis. Ohne diese
    // Zeile waeren die Gegenproben darunter Aussagen ueber nichts.
    expect(begriffsbild(DOKUMENT, DECKEL)).toEqual([
      "wart",
      "hallenkrä",
      "prüf",
      "gilt",
      "kran",
      "vorher",
      "entla",
      "ventil",
      "m12",
      "schlo",
    ]);

    // OHNE `normalizeSearchFragment`: die HTML-Entitaet zerfaellt in Muell-Token. `pr&uuml;fen`
    // wird zu „uuml" und „fen" — zwei Begriffe, die im Dokument niemand liest, und der echte
    // Begriff „prüf" fehlt.
    const ohneBereinigung = normalizeSearchTerms(queryTokens(DOKUMENT)).slice(0, DECKEL);
    expect(ohneBereinigung).toContain("uuml");
    expect(ohneBereinigung).not.toContain("prüf");
    expect(ohneBereinigung).not.toEqual(begriffsbild(DOKUMENT, DECKEL));

    // Derselbe Verlust an einem zweiten, unabhaengigen Beispiel: ein Zero-Width-Space steht
    // INNERHALB eines Wortes. Ohne die Bereinigung zerfaellt „Donaudampfschiff" in zwei
    // Indexwoerter, und die Suche nach dem ganzen Wort geht ins Leere.
    const zerowidth = "Donau​dampfschiff";
    expect(begriffsbild(zerowidth, DECKEL)).toEqual(["donaudampfschiff"]);
    expect(normalizeSearchTerms(queryTokens(zerowidth)).slice(0, DECKEL)).toEqual([
      "donau",
      "dampfschiff",
    ]);

    // OHNE `normalizeSearchTerms`: die Dubletten ueberleben. „Wartung" steht zweimal im Dokument
    // und belegt dann zwei der zwoelf Plaetze — der Deckel wird mit Wiederholungen verbraucht.
    const ohneTermbereinigung = queryTokens(normalizeSearchFragment(DOKUMENT)).slice(0, DECKEL);
    expect(ohneTermbereinigung.filter((term) => term === "wart")).toHaveLength(2);
    expect(begriffsbild(DOKUMENT, DECKEL).filter((term) => term === "wart")).toHaveLength(1);
  });

  it("die Uebergabe an die Suche ist idempotent — die Terme kommen unveraendert an", () => {
    // DAS IST DIE NAHT ZU KA2. Die Begriffsliste wird als `KoSearchQuery.terms` gereicht, und JEDER
    // Suchadapter (In-Memory wie Postgres) laesst sie durch `normalizeSearchTerms` laufen. Waere
    // dieser zweite Durchlauf nicht wirkungslos, suchte KA2 mit anderen Begriffen als das Panel
    // anzeigt — und niemand saehe, warum der Bestandsblick danebenfindet.
    for (const text of [
      DOKUMENT,
      "F3 M12 DN50 Q1",
      "Pr&uuml;fung gepr&uuml;ft pr&uuml;fen Pr&uuml;fungen",
      "Ümläute UND GROSSschreibung",
      "Wartungsplan\nVentil\r\nHallenkran",
      "",
    ]) {
      const terme = begriffsbild(text, DECKEL);
      expect(normalizeSearchTerms(terme), `idempotent:${text.slice(0, 24)}`).toEqual(terme);
    }
  });

  it("jeder uebergebene Term erfuellt die Invarianten der Suchabfrage", () => {
    // Was ein Konsument von `KoSearchQuery.terms` voraussetzen darf, ohne es zu pruefen: kein
    // leerer Term (er traefe alles), keine Grossschreibung (die Abfrage vergleicht kleingeschrieben),
    // kein Leerraum (er wuerde ueber eine Wortgrenze hinweg suchen), keine Dublette.
    const terme = begriffsbild(DOKUMENT, DECKEL);
    expect(terme.length).toBeGreaterThan(3);
    for (const term of terme) {
      expect(term.length, `nicht leer: ${term}`).toBeGreaterThan(0);
      expect(term, `kleingeschrieben: ${term}`).toBe(term.toLowerCase());
      expect(term, `ohne Leerraum: ${term}`).not.toMatch(/\s/);
    }
    expect(new Set(terme).size, "keine Dublette").toBe(terme.length);
  });

  it("der Deckel schneidet NACH der Entdopplung, nicht davor", () => {
    // Zwanzig verschiedene Woerter ⇒ der Deckel greift und liefert genau zwoelf.
    const zwanzigVerschiedene = Array.from({ length: 20 }, (_, i) => `Wartungsplan${i}`).join(" ");
    expect(begriffsbild(zwanzigVerschiedene, DECKEL)).toHaveLength(DECKEL);

    // Zwanzigmal DASSELBE Wort ⇒ EIN Begriff. Schnitte der Deckel vor der Entdopplung, stuenden
    // hier zwoelf identische Eintraege und die Liste waere wertlos.
    const zwanzigmalGleich = Array.from({ length: 20 }, () => "Wartungsplan").join(" ");
    expect(begriffsbild(zwanzigmalGleich, DECKEL)).toHaveLength(1);
  });

  it("technische Kennungen ueberleben die Laengengrenze der Tokenisierung", () => {
    // mega54 A: `F3` und `Q1` sind zwei Zeichen und fielen einer reinen Mindestlaenge zum Opfer —
    // in einem technischen Dokument sind sie aber der spezifischste Begriff ueberhaupt. Faellt
    // diese Zusicherung, findet KA2 zu „Filter F3" nichts.
    expect(begriffsbild("F3 M12 DN50 Q1", DECKEL)).toEqual(["f3", "m12", "dn50", "q1"]);
    expect(begriffsbild(DOKUMENT, DECKEL)).toContain("m12");
  });

  it("ohne auswertbaren Inhalt entsteht ehrlich NICHTS statt eines Fuellwerts", () => {
    // Die Kehrseite der Zusage aus `OFFEN.md`: eine leere Liste bleibt leer. Ein Fuellwert waere
    // eine Behauptung ueber ein Dokument, das nichts hergibt — und KA2 suchte danach.
    for (const leer of ["", "   \n\t  ", "und oder aber weil dann", "an im so ob je"]) {
      expect(begriffsbild(leer, DECKEL), `leer:${JSON.stringify(leer)}`).toEqual([]);
    }
  });
});
