// AUFTRAG-mega59 BLOCK C — DER KOMPOSITUM-TREFFER AN EINER BELEGBAREN GRENZE.
//
// ================================================================================================
// RÜCKNAHME DURCH AUFTRAG-mega60 A — LIES DAS ZUERST.
// ================================================================================================
//
// Diese Datei hat ursprünglich zugesagt, dass ein Kompositum-Treffer eine Antwort TRÄGT: er zählte
// auf den Überschneidungswert UND auf die Substanz. DIESE ZUSAGE IST ZURÜCKGENOMMEN. mega59 ist hier
// zu weit gegangen, und ben hat es nachgewiesen (ROT-1 gegen sammel57, ohne Fehlerinjektion
// reproduzierbar): die Frage „Welcher Stand gilt am Ventil?“ trifft „Der Widerstand am Ventil ist
// vorgeschrieben.“, weil „stand“ am Wortende von „widerstand“ steht und der Rest „wider“ selbst ein
// Wortteil ist. Mit dem echten Treffer „ventil“ ergab das zwei Substanzpunkte — eine sachfremde
// Quelle trug eine Antwort. Gleichartig: „Stand“ gegen „Wohlstand“. Der Fehler folgt aus der Regel.
//
// WAS JETZT GILT: der Kompositum-Treffer zählt weiter auf den SUCHWERT — die Quelle wird gefunden,
// kommt in die Kandidatenliste und wird gerankt —, aber NICHT auf die Substanz. Die Fälle unten
// prüfen deshalb ab hier die richtige Zusage: gefunden ja, Suchwert steigt ja, allein tragend NEIN.
// Die Umstellung ist bewusst als Rücknahme geschrieben und nicht als Reparatur: der ursprüngliche
// Zweck von Block C — S5, die validierte Quelle `koCarBlau` — ist damit NICHT erreicht, sondern
// präziser beschrieben. Die Negativseite steht in `mega60-kompositum-traegt-nicht.test.ts`.
//
// ------------------------------------------------------------------------------------------------
//
// DER URSPRÜNGLICHE BEFUND (S5, am Bestand nachgesehen): auf „Welche Farbe müssen Firmenwagen
// haben?“ fällt die VALIDIERTE Quelle `koCarBlau` („Firmenwagen: Pflichtfarbe Blau“) weg, während
// die nur OFFENE `koCarRot` trägt — weil „Farbe“ dort im Kompositum „Pflichtfarbe“ steckt.
//
// WO DIE LÜCKE NICHT SASS: nicht in der Vorauswahl. Der Repo-Prefilter arbeitet mit `%term%` ILIKE,
// „farb“ matcht „Pflichtfarbe“ als Teilstring, der Kandidat KOMMT AN — er starb erst am exakten
// Mengenschnitt in `ueberschneidung`. Genau dort greift die Regel weiterhin, nur eben für den
// Suchwert statt für die Substanz.
//
// WIE DER SUCHWERT ÜBERHAUPT ABLESBAR IST: eine Quelle unter der Mindestsubstanz kommt gar nicht aus
// `rankCandidates` heraus, ihr Suchwert wäre unsichtbar. Deshalb tragen die Fälle unten je ZWEI
// echte Volltreffer bei und vergleichen den `keywordScore` gegen eine sonst gleiche Quelle OHNE das
// Kompositum. Die Differenz von genau eins IST der Kompositum-Treffer.
import { describe, expect, it } from "vitest";
import { demoTexts } from "../../services/app/src/demo-content";
import type { KnowledgeRef } from "../../services/reasoner";
import { keywordSelect, queryTokens, rankCandidates } from "../../services/reasoner";

function ref(
  id: string,
  title: string,
  statement: string,
  status: KnowledgeRef["status"] = "validiert",
  trust = 70,
): KnowledgeRef {
  return { id, title, statement, status, trust };
}

// Liest den Suchwert einer Quelle ab, die das Substanztor passiert — sonst gäbe `rankCandidates`
// nichts heraus und der Vergleich hätte keinen Messpunkt.
function suchwert(frage: string, quelle: KnowledgeRef): number | undefined {
  return rankCandidates(frage, [quelle])[0]?.keywordScore;
}

const t = demoTexts("de");
// Die beiden Quellen WÖRTLICH aus dem Demo-Bestand — der Fall soll den echten Bestand messen, nicht
// eine passend geschriebene Fixture. Status/Trust wie geseedet: koCarBlau ist validiert, koCarRot
// bleibt offen (seed-demo.ts: nur koCarBlau bekommt die Vertrauensstufe über die Validierung).
const KO_CAR_BLAU = ref("koCarBlau", t.koCarBlau.title, t.koCarBlau.statement, "validiert", 100);
const KO_CAR_ROT = ref("koCarRot", t.koCarRot.title, t.koCarRot.statement, "offen", 20);
const FRAGE_FARBE = "Welche Farbe müssen Firmenwagen haben?";

describe("AUFTRAG-mega59 C — der Kompositum-Treffer an einer belegbaren Grenze", () => {
  it("die Fixture stellt den Fall wirklich her: „Farbe“ steckt nur im Kompositum", () => {
    // Ohne diese Vorkalibrierung wäre alles darunter auch dann grün, wenn „Farbe“ plötzlich wörtlich
    // in koCarBlau stünde. Der Frageterm ist „farb“, das Zieltoken „pflichtfarb“ — verschieden.
    expect(queryTokens(FRAGE_FARBE)).toEqual(["farb", "firmenwag"]);
    expect(queryTokens(`${KO_CAR_BLAU.title} ${KO_CAR_BLAU.statement}`)).not.toContain("farb");
    expect(queryTokens(`${KO_CAR_BLAU.title} ${KO_CAR_BLAU.statement}`)).toContain("pflichtfarb");
    // Die offene Quelle trägt „Farbe“ dagegen wörtlich — deshalb war sie die einzige Überlebende.
    expect(queryTokens(`${KO_CAR_ROT.title} ${KO_CAR_ROT.statement}`)).toContain("farb");
  });

  it("RÜCKNAHME (mega60 A): „Farbe“ findet „Pflichtfarbe“ — aber trägt die Antwort NICHT", () => {
    // Hier stand: „die validierte Quelle trägt die Antwort". Das war die Zusage, die ben an
    // Stand/Widerstand widerlegt hat. Was bleibt, ist die halbe Zusage — und die ist wahr:
    // die Frage liefert nur die zwei Terme „farb“ und „firmenwag“, „farb“ trifft „pflichtfarb“ NUR
    // als Kompositum, der Substanzwert bleibt bei EINS. Fail-closed, beide Wege leer.
    expect(rankCandidates(FRAGE_FARBE, [KO_CAR_BLAU])).toEqual([]);
    expect(keywordSelect(FRAGE_FARBE, [KO_CAR_BLAU])).toEqual([]);
  });

  it("RÜCKNAHME (mega60 A): S5 ist NICHT beglichen — koCarRot trägt, koCarBlau nicht", () => {
    // Hier stand: „koCarBlau erscheint VOR koCarRot". Der Bestand tut das Gegenteil, und das ist die
    // ehrliche Deckungsangabe: koCarRot führt „Farbe" wörtlich (zwei exakte Treffer, Substanz zwei),
    // koCarBlau nur im Kompositum (Substanz eins). Die VALIDIERTE Quelle fehlt der Antwort damit
    // weiterhin — die Recall-Schuld S5 ist nicht beglichen, sondern präziser beschrieben. Die
    // passende Lösung ist eine begrenzte, getestete Domänenrelation echter Fachkomposita; sie steht
    // im Register und gehört ausdrücklich NICHT in mega60.
    const ranked = rankCandidates(FRAGE_FARBE, [KO_CAR_ROT, KO_CAR_BLAU]);
    expect(ranked.map((x) => x.ref.id)).toEqual(["koCarRot"]);
    expect(keywordSelect(FRAGE_FARBE, [KO_CAR_ROT, KO_CAR_BLAU]).map((x) => x.id)).toEqual([
      "koCarRot",
    ]);
  });

  it("RÜCKNAHME (mega60 A): die Grenze am Fugen-s zählt auf den SUCHWERT, nicht auf die Substanz", () => {
    // Hier stand: „die Grenze am Fugen-s zählt ebenso" — mit einem Fall, der allein aus einem
    // exakten Treffer plus dem Fugen-s-Treffer trug. Das trägt nicht mehr. Die zweite belegbare
    // Grenze bleibt aber wirksam: ohne sie wäre die Regel eine reine Endungsregel und träfe genau die
    // Hälfte der deutschen Komposita nicht.
    expect(queryTokens("Betrieb")).toEqual(["betrieb"]);
    expect(queryTokens("Betriebsanleitung")).toEqual(["betriebsanlei"]);
    const einTreffer = ref(
      "anl",
      "Betriebsanleitung Ventil",
      "Die Betriebsanleitung nennt das Ventil.",
    );
    expect(rankCandidates("Was sagt der Betrieb zum Ventil?", [einTreffer])).toEqual([]);

    // Und der Suchwert-Beleg mit ZWEI echten Volltreffern („ventil", „filter"): mit Kompositum drei,
    // ohne Kompositum zwei. Die Differenz IST der Fugen-s-Treffer.
    const frage = "Was sagt der Betrieb zum Ventil und zum Filter?";
    const mit = ref("anl2", "Anleitung", "Die Betriebsanleitung nennt das Ventil und den Filter.");
    const ohne = ref("anl3", "Anleitung", "Die Anleitung nennt das Ventil und den Filter.");
    expect(suchwert(frage, mit)).toBe(3);
    expect(suchwert(frage, ohne)).toBe(2);
  });

  it("die Gegenrichtung geht mit — ein Frage-Kompositum trifft ein einfaches Quelltoken", () => {
    // Dieselbe Prüfung, beide Seiten. Sonst hinge das Ergebnis daran, wer das längere Wort benutzt.
    // Umgestellt (mega60 A) auf den Suchwert: „pflichtfarb" in der Frage findet „farb" in der Quelle
    // und hebt den Suchwert um eins — tragen tun die zwei echten Treffer „firmenwag" und „fuhrpark".
    const frage = "Welche Pflichtfarbe haben Firmenwagen im Fuhrpark?";
    const mit = ref("f", "Fuhrpark", "Die Farbe der Firmenwagen im Fuhrpark ist festgelegt.");
    const ohne = ref(
      "fo",
      "Fuhrpark",
      "Die Lackierung der Firmenwagen im Fuhrpark ist festgelegt.",
    );
    expect(suchwert(frage, mit)).toBe(3);
    expect(suchwert(frage, ohne)).toBe(2);
  });
});

describe("AUFTRAG-mega59 C — die Gegenproben: die Regel ist keine Teilstring-Suche", () => {
  const WARTUNG = ref("w", "Wartungsplan", "Die Wartung am Ventil erfolgt jährlich.");

  it("„Art“ trifft NICHT „Wartung“ — unter der Mindestlänge greift nichts", () => {
    // Der Fall, den der Auftrag namentlich nennt. „art" IST ein Wortende von „wart“ — nur drei
    // Zeichen lang, also unterhalb der Grenze, und damit kein Treffer.
    expect(queryTokens("Welche Art hat das Ventil?")).toEqual(["art", "ventil"]);
    expect(rankCandidates("Welche Art hat das Ventil?", [WARTUNG])).toEqual([]);
    expect(keywordSelect("Welche Art hat das Ventil?", [WARTUNG])).toEqual([]);
  });

  it("DIE VORKALIBRIERUNG dazu: derselbe Fall mit VIER Zeichen zahlt auf den Suchwert ein", () => {
    // Ohne diese Zeile wäre der Fall oben auch dann grün, wenn die Kompositum-Regel gar nicht
    // existierte. Umgestellt (mega60 A) auf den Suchwert, denn seit mega60 trägt der
    // Kompositum-Treffer nicht mehr: beide Fälle haben ZWEI exakte Treffer („ventil", „filter") plus
    // EIN Kompositum-Wort und unterscheiden sich AUSSCHLIESSLICH in dessen Länge — drei Zeichen
    // („art" in „wart") bleiben wirkungslos, vier Zeichen („farb" in „pflichtfarb") heben den
    // Suchwert um eins.
    const wartung = ref(
      "w2",
      "Wartungsplan",
      "Die Wartung am Ventil und am Filter erfolgt jährlich.",
    );
    const anstrich = ref(
      "nf2",
      "Anstrichplan",
      "Die Pflichtfarbe am Ventil und am Filter ist grau.",
    );
    expect(queryTokens("Welche Art am Ventil und am Filter?")).toEqual(["art", "ventil", "filter"]);
    expect(queryTokens("Welche Farbe am Ventil und am Filter?")).toEqual([
      "farb",
      "ventil",
      "filter",
    ]);
    expect(suchwert("Welche Art am Ventil und am Filter?", wartung)).toBe(2);
    expect(suchwert("Welche Farbe am Ventil und am Filter?", anstrich)).toBe(3);
  });

  it("der Rest vor der Grenze muss selbst ein Wortteil sein — „Rand“ trifft nicht „Brand“", () => {
    // Ohne diese dritte Bedingung wäre die zweite zahnlos: „rand“ steht wirklich am Wortende von
    // „brand“, ist vier Zeichen lang und passierte damit die ersten beiden Bedingungen. Was übrig
    // bleibt, ist EIN Buchstabe — kein Kompositumglied, sondern Zufall. Vier ist die Grenze, ab der
    // der Rest selbst ein Wort sein kann; das ist dieselbe Zahl und derselbe Grund wie bei der
    // Mindestlänge des Frageterms.
    expect(queryTokens("Rand")).toEqual(["rand"]);
    expect(queryTokens("Brand")).toEqual(["brand"]);
    const brand = ref("b", "Hinweis", "Der Brand am Ventil war gemeldet.");
    expect(rankCandidates("Wo ist der Rand am Ventil?", [brand])).toEqual([]);
    expect(keywordSelect("Wo ist der Rand am Ventil?", [brand])).toEqual([]);
  });

  it("DIE BENANNTE GRENZE: ein erstes Kompositumglied OHNE Fugen-s wird nicht erreicht", () => {
    // Das ist keine Gegenprobe, sondern eine ehrliche Deckungsangabe. „Druck“ steht in „Druckluft“
    // am Wortanfang und ohne Fuge — also an keiner der beiden Stellen, die diese Regel als BELEGBARE
    // Grenze anerkennt. Eine reine Präfix-Suche würde den Fall lösen und wäre genau die
    // Teilstring-Suche, die der Auftrag ausschließt: sie fände auch das „rand“ im „brand“ nicht
    // schlechter als das „druck“ in der „druckluft“. Die Lücke ist damit benannt und nicht behauptet.
    expect(queryTokens("Druck")).toEqual(["druck"]);
    expect(queryTokens("Druckluft")).toEqual(["druckluf"]);
    const luft = ref("l", "Hinweis", "Mit Druckluft am Ventil arbeiten.");
    expect(rankCandidates("Welcher Druck gilt am Ventil?", [luft])).toEqual([]);
  });

  it("die Mindestsubstanz bleibt fail-closed: EIN Kompositum-Treffer allein trägt nicht", () => {
    // Seit mega60 A gilt das doppelt: der Kompositum-Treffer zählt nur noch auf `wert`, nicht mehr
    // auf `substanz`. Ein einziges geteiltes Wort war schon vorher eine Wissenslücke — jetzt ist es
    // auch dann eine, wenn ein zweites Wort per Kompositum dazukäme.
    const nurFarbe = ref("nf", "Anstrichplan", "Die Pflichtfarbe der Halle ist grau.");
    expect(rankCandidates("Welche Farbe hat das Ventil?", [nurFarbe])).toEqual([]);
    expect(keywordSelect("Welche Farbe hat das Ventil?", [nurFarbe])).toEqual([]);
  });
});
