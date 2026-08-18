// ================================================================================================
// JOB 913 · D5 — DIE GRENZEN, DIE JEDE KÜNFTIGE DOMÄNENRELATION EINHALTEN MUSS
// ================================================================================================
//
// Der Auftragstext ist das rote Vollurteil BEN3-PRUEFUNG-JOB-913-D4 (SHA-256 fbd1fea9…). Sein
// PRODUKT-Urteil nennt den entscheidenden Mangel des Vorlaufs in einem Satz:
//
//     „Kein Test wird geschrieben oder ausgeführt."
//
// D4 hat den Testvertrag beschrieben; beschrieben heißt nicht ausgeführt. Diese Datei führt aus,
// was OHNE die offene Ownerentscheidung O-1 ausführbar ist — und nur das.
//
// ------------------------------------------------------------------------------------------------
// WAS O-1 SPERRT, UND WARUM DIESE DATEI TROTZDEM ETWAS PRÜFT
// ------------------------------------------------------------------------------------------------
// O-1 entscheidet, WELCHES Fachpaar deklariert wird (`pflichtfarb→farb` oder das gewünschte
// Firmenwagenpaar). Die BINDENDE FOLGEENTSCHEIDUNG des Urteils lautet: „Kein Produktwrite, bis
// O-1 … vorliegt." Gemessen existiert `00_CONTROL/ENTSCHEIDUNGEN/JOB-913.md` nicht.
//
// GEMESSEN UND FÜR DEN BAU ENTSCHEIDEND: es gibt in `services/reasoner/src/provider.ts` HEUTE
// überhaupt keine Deklarationsmechanik — `trifftAlsKompositum` (:1276-1283) prüft rein formal über
// `trifftAlsWortteil`, es gibt keine Paartabelle, weder im Clone noch in einer der 322 im Bestand
// gefundenen Fassungen dieser Datei (alle mit demselben Hash `b58c003e…`). Damit hängt JEDER Fall
// aus BEN3s Prüflücken 3, 5 und 7 — deklariertes Paar, testweise Deklaration, Richtungsprobe am
// deklarierten Paar, Entfernen des Tabellenpaars — am Bau genau dieser Mechanik, und der ist
// gesperrt.
//
// WAS DAVON UNABHÄNGIG IST, ist die andere Hälfte des Vertrags: die NEGATIVEN Grenzen. Sie sind
// heutiges Verhalten, sie müssen jede künftige Relation überleben, und sie sind sofort ausführbar.
// Genau sie stehen hier — als Wächter, nicht als Beschreibung.
import { describe, expect, it } from "vitest";
import type { KnowledgeRef } from "../../services/reasoner";
import { keywordSelect, queryTokens, rankCandidates } from "../../services/reasoner";

function ref(
  id: string,
  statement: string,
  status: KnowledgeRef["status"] = "validiert",
  trust = 70,
): KnowledgeRef {
  return { id, title: "Hinweis", statement, status, trust };
}

// ================================================================================================
// N-3 · DIE VERWALTUNGSGRENZE — BEN3, Prüflücke 4
// ================================================================================================
//
// Wörtlich verlangt: „konkreten Fixture-Kandidaten mit Kennung, Inhalt `arbeitsschutz`, Frage
// `schutz` und Erwartung `[]` binden; zusätzlich belegen, dass der Kandidat suchbar, aber nicht
// tragend ist."
//
// D4 hatte das als Rolle beschrieben („ein KO aus der Verwaltungsdomäne"). Hier stehen die
// vollständigen Eingaben, und die Tokenzerlegung ist am Bestand gemessen, nicht angenommen:
//
//     Frage    „Welcher Schutz gilt in der Werkstatt?"        → ["schutz", "gilt", "werksta"]
//     Kandidat „Der Arbeitsschutz in der Werkstatt …"          → ["arbeitsschutz", "werksta", "regel"]
//
// `schutz` steht am Wortende von `arbeitsschutz`, davor bleiben sechs Zeichen — die drei
// Bedingungen aus mega59 C sind buchstäblich erfüllt. Der Treffer ist also ECHT und trotzdem darf
// er nicht tragen: `arbeitsschutz` ist ein eigener Fachbegriff, kein Unterfall von `schutz`.
const N3_KENNUNG = "N-3-VERWALTUNGSGRENZE-ARBEITSSCHUTZ";
const N3_FRAGE = "Welcher Schutz gilt in der Werkstatt?";
const N3_KANDIDAT = ref(N3_KENNUNG, "Der Arbeitsschutz in der Werkstatt ist geregelt.");

// Für den Nachweis „suchbar, aber nicht tragend" braucht es eine Frage, die das Substanztor über
// ZWEI echte Volltreffer passiert — sonst ist der Kandidat mangels Substanz ohnehin leer, und der
// Suchwert wäre gar nicht ablesbar. Dieselbe Bauform wie in mega60 A.
const N3_FRAGE_ZWEI = "Welcher Schutz gilt in der Werkstatt und an der Anlage?";
const N3_MIT_KOMPOSITUM = ref(
  "mit",
  "Der Arbeitsschutz in der Werkstatt an der Anlage ist geregelt.",
);
const N3_OHNE_KOMPOSITUM = ref("ohne", "Der Ablauf in der Werkstatt an der Anlage ist geregelt.");

describe("JOB 913 · N-3 — die Verwaltungsgrenze traegt nicht", () => {
  it('die Fixture stellt den Fall wirklich her: „schutz" steckt nur im Kompositum', () => {
    // Ohne diese Vorkalibrierung waeren die Faelle darunter auch dann gruen, wenn Frage und
    // Kandidat gar keine gemeinsame Kompositumgrenze haetten — dann pruefte nichts etwas.
    expect(queryTokens(N3_FRAGE)).toEqual(["schutz", "gilt", "werksta"]);
    const ziel = queryTokens(N3_KANDIDAT.statement);
    expect(ziel).toContain("arbeitsschutz");
    expect(ziel).not.toContain("schutz");
    // Und die Grenze selbst ist gemessen: „schutz" steht am Wortende, davor bleiben vier oder mehr
    // Zeichen. Sonst waere die Fixture eine Behauptung ueber sich selbst.
    expect("arbeitsschutz".endsWith("schutz")).toBe(true);
    expect("arbeitsschutz".length - "schutz".length >= 4).toBe(true);
  });

  it("Erwartung [] — der Verwaltungsbegriff traegt KEINE Antwort", () => {
    // Der Kern von Prueflücke 4. Beide Auswahlwege sind fail-closed leer.
    expect(rankCandidates(N3_FRAGE, [N3_KANDIDAT])).toEqual([]);
    expect(keywordSelect(N3_FRAGE, [N3_KANDIDAT])).toEqual([]);
  });

  it("… und ist trotzdem SUCHBAR: der Suchwert steigt, die Substanz nicht", () => {
    // Ohne diese Zeile pruefte der Fall darueber versehentlich, der Kompositumtreffer sei ganz
    // verschwunden. Er ist nur nicht tragend — genau die Trennung suchbar/tragend aus mega57.
    expect(queryTokens(N3_FRAGE_ZWEI)).toEqual(["schutz", "gilt", "werksta", "anlag"]);
    const [mit] = rankCandidates(N3_FRAGE_ZWEI, [N3_MIT_KOMPOSITUM]);
    const [ohne] = rankCandidates(N3_FRAGE_ZWEI, [N3_OHNE_KOMPOSITUM]);
    expect(mit?.keywordScore).toBe(3);
    expect(ohne?.keywordScore).toBe(2);
  });
});

// ================================================================================================
// N-4 · DIE RICHTUNGSFRAGE LIEGT NICHT IN DER WORTTEILREGEL — BEN3, Prüflücke 5
// ================================================================================================
//
// Prüflücke 5 verlangt „dasselbe konkrete Paar in beiden Richtungen" und sagt dazu den
// entscheidenden Satz: „Die DEKLARATIONSRICHTUNG, nicht die symmetrische Wortteilprüfung, muss den
// Unterschied erzeugen."
//
// Solange keine Deklaration existiert, ist die vollständige Richtungsprobe nicht baubar. Was HEUTE
// baubar ist — und was die Falle schließt, in die D4 beinahe gelaufen wäre — ist der Nachweis der
// SYMMETRIE: `trifftAlsKompositum` (:1278) prüft `trifftAlsWortteil(wort, anderes)` ODER
// `trifftAlsWortteil(anderes, wort)`. Beide Richtungen verhalten sich deshalb gleich.
//
// Daraus folgt zwingend: wer später eine Richtungsaussage prüfen will, misst sie NICHT an der
// Wortteilregel. Dieser Fall hält das fest, damit die künftige N-4-Probe nicht denselben
// Scheinbeleg baut, den BEN2 schon einmal an der Gegenmutation aufgedeckt hat.
const N4_VORWAERTS_FRAGE = "Welcher Schutz gilt in der Werkstatt?";
const N4_VORWAERTS_KANDIDAT = ref("vorwaerts", "Der Arbeitsschutz in der Werkstatt ist geregelt.");
const N4_RUECKWAERTS_FRAGE = "Welcher Arbeitsschutz gilt in der Werkstatt?";
const N4_RUECKWAERTS_KANDIDAT = ref("rueckwaerts", "Der Schutz in der Werkstatt ist geregelt.");

describe("JOB 913 · N-4 — beide Richtungen verhalten sich heute GLEICH", () => {
  it("die Fixture dreht wirklich um: Grundwort und Kompositum tauschen die Seiten", () => {
    expect(queryTokens(N4_VORWAERTS_FRAGE)).toContain("schutz");
    expect(queryTokens(N4_VORWAERTS_KANDIDAT.statement)).toContain("arbeitsschutz");
    expect(queryTokens(N4_RUECKWAERTS_FRAGE)).toContain("arbeitsschutz");
    expect(queryTokens(N4_RUECKWAERTS_KANDIDAT.statement)).toContain("schutz");
  });

  it("vorwaerts und rueckwaerts sind beide nicht tragend — die Wortteilregel ist symmetrisch", () => {
    // DIE AUSSAGE DIESES FALLS: aus der Wortteilregel folgt KEIN Richtungsunterschied. Wer einen
    // behauptet, muss ihn aus der Deklaration holen. Wird die Regel spaeter einseitig gemacht,
    // ohne dass jemand es beabsichtigt, wird dieser Fall rot.
    expect(rankCandidates(N4_VORWAERTS_FRAGE, [N4_VORWAERTS_KANDIDAT])).toEqual([]);
    expect(rankCandidates(N4_RUECKWAERTS_FRAGE, [N4_RUECKWAERTS_KANDIDAT])).toEqual([]);
    expect(keywordSelect(N4_VORWAERTS_FRAGE, [N4_VORWAERTS_KANDIDAT])).toEqual([]);
    expect(keywordSelect(N4_RUECKWAERTS_FRAGE, [N4_RUECKWAERTS_KANDIDAT])).toEqual([]);
  });
});

// ================================================================================================
// MEGA59-ERHALT — BEN3, Prüflücke 6
// ================================================================================================
//
// Verlangt sind „konkrete bestehende Fallnamen für einen nicht deklarierten Farb-/Fahrzeugfall und
// ‚suchbar, aber nicht tragend'". Ausgewählt und hier namentlich gebunden:
//
//   · `tests/ask/mega59-komposita.test.ts` (210 Z, Startpin 4869838f9456d94f…)
//       :86  „RÜCKNAHME (mega60 A): S5 ist NICHT beglichen — koCarRot trägt, koCarBlau nicht"
//            → DER nicht deklarierte Farb-/Fahrzeugfall. Er MUSS negativ bleiben, bis O-1 ein
//              Paar deklariert; danach ist er der Fall, der sich als einziger umdreht.
//       :77  „RÜCKNAHME (mega60 A): „Farbe" findet „Pflichtfarbe" — aber trägt die Antwort NICHT"
//       :100 „RÜCKNAHME (mega60 A): die Grenze am Fugen-s zählt auf den SUCHWERT, nicht auf die
//              Substanz"
//            → die zwei Fälle „suchbar, aber nicht tragend", je einer pro Zweig.
//   · `tests/ask/mega59-getrennte-regeln.test.ts` (130 Z, Startpin 386170d08e74cd89…)
//   · `tests/ask/mega59-herkunftstreue.test.ts`   (126 Z, Startpin 76a6cae63f1cfa6e…)
//
// HIER WIRD NICHT DER NAME GEPINNT, SONDERN DAS VERHALTEN. Ein Namenspin bräche bei jeder
// Umbenennung, ohne dass sich etwas Fachliches geändert hätte; das Verhalten dagegen ist genau
// die Zusage, die eine künftige Domänenrelation nicht entwerten darf. Die Namen stehen oben,
// damit der Prüfer die Fälle findet — die Messung steht hier.
const FARB_FRAGE = "Welche Farbe müssen Firmenwagen haben?";
const KO_CAR_BLAU = ref("koCarBlau", "Firmenwagen: Pflichtfarbe Blau ist vorgeschrieben.");

describe("JOB 913 · Mega59-Erhalt — die Grenzen, die eine Domaenenrelation nicht entwerten darf", () => {
  it("der nicht deklarierte Farb-/Fahrzeugfall bleibt negativ (mega59-komposita :86)", () => {
    // Genau der Fall, den O-1 spaeter umdrehen KANN — heute und bis dahin bleibt er leer. Wird er
    // ohne Deklaration positiv, ist die Regel wieder zu weit geraten (der mega60-A-Befund).
    expect(rankCandidates(FARB_FRAGE, [KO_CAR_BLAU])).toEqual([]);
    expect(keywordSelect(FARB_FRAGE, [KO_CAR_BLAU])).toEqual([]);
  });

  it('die Fixture stellt den Fall her: „farb" steckt nur im Kompositum (mega59-komposita :67)', () => {
    const frage = queryTokens(FARB_FRAGE);
    expect(frage).toContain("farb");
    const ziel = queryTokens(KO_CAR_BLAU.statement);
    expect(ziel).not.toContain("farb");
    expect(ziel.some((t) => t.endsWith("farb"))).toBe(true);
  });
});
