// ================================================================================================
// JOB 1128 · D1 — LITERAL, KOMPOSITUM UND ÜBERSETZUNG SIND DREI VERSCHIEDENE DINGE.
// ================================================================================================
//
// HERKUNFT. JOB 967 (PRO2) hat den Suchvertrag hinter Register S2 inventarisiert und sieben
// Zusagen `V-1` … `V-7` formuliert. BEN8 hat als Prüflücke 1 wörtlich verlangt:
//
//     „Produktpfad statt Kopie: Testvorschlag `services/reasoner/src/...` gegen den echten
//      `ueberschneidung`-/Tokenisierungspfad mit Fällen `klep→Ventil`, `klep→terugslagklep`,
//      `klep→klepspeling`, `ventil→ventilator`; erwartet: nur die benannten Literal-/
//      Kompositumfälle treffen, kein tragender Treffer für Übersetzung."
//
// WARUM „STATT KOPIE" DER KERN IST. JOB 967 durfte read-only nicht im Produktbaum testen und hat
// die Regel deshalb in eine **wortgetreue Kopie** der Zeilen `:872/:902/:922/:1257/:1260/:1276`
// nachgebaut und dort gerechnet. Die Rückgabe sagt die Grenze selbst (§7): *„Sie beweist, dass
// meine Handrechnung arithmetisch stimmt — sie beweist NICHT, dass der Produktpfad im Betrieb
// nichts anderes tut."* Genau diese Lücke schliesst diese Datei.
//
// DER ECHTE PFAD, ohne einen einzigen Nachbau: `keywordSelect` (provider.ts:1450) und
// `rankCandidates` (:1510) rufen beide intern `ueberschneidung` (:1285) über dieselbe
// Tokenisierung, die auch `queryTokens` (:1318) öffentlich anbietet. Alle drei sind exportiert —
// die Regel wird hier also BENUTZT, nicht abgeschrieben. `ueberschneidung`, `trifftAlsWortteil`
// und `grundform` selbst sind modul-privat (gemessen: kein `export`); sie werden bewusst NICHT
// freigelegt, denn ein Test, der die öffentliche Tür nimmt, prüft zugleich die Verdrahtung.
//
// DAS SPRACHMATERIAL ist das ausgelieferte: der Übersetzungszwilling aus `demo-content.ts:76`
// (DE) und `:394` (NL) sowie die niederländischen Komposita aus `sim-corpus.ts:328/:330`.
import { describe, expect, it } from "vitest";
import {
  MIN_ANSWER_SUBSTANCE,
  keywordSelect,
  queryTokens,
  rankCandidates,
} from "../../services/reasoner/src/provider";
import type { KnowledgeRef } from "../../services/reasoner/src/types";

const ref = (id: string, title: string, statement: string): KnowledgeRef => ({
  id,
  title,
  statement,
  status: "validiert",
  trust: 80,
});

// Die vier Quellen, wörtlich aus dem ausgelieferten Bestand.
const DE_VENTIL = ref(
  "de-ventil",
  "Ventil X bei Überdruck manuell schließen",
  "Ventil X bei Überdruck manuell schließen.",
);
const NL_KLEP = ref(
  "nl-klep",
  "Sluit klep X handmatig bij overdruk",
  "Sluit klep X handmatig bij overdruk.",
);
const NL_TERUGSLAGKLEP = ref(
  "nl-terugslagklep",
  "Terugslagklep RK-8 elke 6 maanden controleren",
  "Terugslagklep RK-8 elke 6 maanden controleren.",
);
const DE_VENTILATOR = ref(
  "de-ventilator",
  "Ventilatoren im Maschinenraum reinigen",
  "Ventilatoren im Maschinenraum regelmäßig reinigen.",
);

const ids = (refs: readonly KnowledgeRef[]): string[] => refs.map((r) => r.id);
const score = (frage: string, kandidat: KnowledgeRef): number | undefined =>
  rankCandidates(frage, [kandidat]).find((x) => x.ref.id === kandidat.id)?.keywordScore;

describe("JOB 1128 · V-1/V-2 — Übersetzung ist kein Literalbeleg", () => {
  it("L-1: „klep“ findet den deutschen Ventil-Zwilling NICHT — ohne deklarierte Übersetzung gibt es keine Brücke", () => {
    // Der Kern von Register S2, am echten Pfad statt an einer Handrechnung.
    expect(ids(keywordSelect("klep", [DE_VENTIL]))).toEqual([]);
    expect(score("klep", DE_VENTIL), "auch der reine Überschneidungswert ist null").toBe(undefined);
  });

  it("L-2: dieselbe Frage findet den niederländischen Zwilling sehr wohl — der Anwender ist nicht blind", () => {
    // KALIBRIERUNG zu L-1: ohne sie belegte „findet nichts" nur, dass die Suche gar nicht anschlägt.
    // `klep` allein trägt 1 Substanztoken; MIN_ANSWER_SUBSTANCE ist 2 — deshalb die volle Frage.
    const treffer = keywordSelect("klep overdruk", [DE_VENTIL, NL_KLEP]);
    expect(ids(treffer), "der NL-Zwilling ist literal erreichbar, der DE nicht").toEqual([
      "nl-klep",
    ]);
  });

  it("L-3: die Gegenrichtung gilt genauso — „Ventil“ erreicht „klep“ nicht", () => {
    expect(ids(keywordSelect("Ventil Überdruck", [NL_KLEP]))).toEqual([]);
  });

  it("L-4: die Sprachgrenze ist der EINZIGE Grund — dieselbe Frage in der richtigen Sprache trägt", () => {
    // Schärfe: der DE-Zwilling ist nicht etwa generell unauffindbar.
    expect(ids(keywordSelect("Ventil Überdruck", [DE_VENTIL]))).toEqual(["de-ventil"]);
  });
});

describe("JOB 1128 · V-4 — der Kompositumtreffer ist auffindbar, aber nicht tragend", () => {
  it("K-1: „klep“ trifft „terugslagklep“ als Wortteil — und trägt trotzdem KEINE Antwort", () => {
    // Der Kompositumtreffer zählt auf `wert`, nie auf `substanz` (provider.ts:1293-1303). Weil
    // `keywordSelect` zusätzlich `meetsAnswerSubstance` verlangt, kommt die Quelle NICHT als
    // Antwortquelle durch — genau die Schutzfunktion, die JOB 967 als V-4 beschreibt.
    expect(ids(keywordSelect("klep", [NL_TERUGSLAGKLEP]))).toEqual([]);
  });

  it("K-2: der Treffer EXISTIERT — messbar als Differenz im Überschneidungswert", () => {
    // Ohne diesen Fall wäre K-1 auch dann grün, wenn „klep“ gar nichts träfe. Zwei Quellen, die
    // sich NUR im Kompositum unterscheiden: der Wert unterscheidet sich um genau eins.
    const mitKompositum = ref(
      "mit",
      "Terugslagklep controleren",
      "Terugslagklep bij onderhoud controleren.",
    );
    const ohneKompositum = ref("ohne", "Pomp controleren", "Pomp bij onderhoud controleren.");
    const frage = "klep controleren onderhoud";
    const a = score(frage, mitKompositum);
    const b = score(frage, ohneKompositum);
    expect(a, "beide Quellen sind erreichbar").toBeDefined();
    expect(b).toBeDefined();
    expect(
      (a ?? 0) - (b ?? 0),
      "der Kompositumtreffer hebt den Wert um genau eins — er ist real, nur nicht tragend",
    ).toBe(1);
  });

  it("K-3: „klep“ trifft „klepspeling“ über die deutsche Fugen-s-Regel — auf niederländischem Wort", () => {
    // V-4 wörtlich: die formale Regel überschreitet die Sprachgrenze. Semantisch ist das Ergebnis
    // hier zufällig richtig (nl `klep` + `speling`); die Regel kann das nicht wissen, sie sieht
    // nur Zeichen. Der Fall hält den IST-Zustand fest — er ist kein erfundener Defekt, sondern
    // die von JOB 967 benannte, heute wirksame Eigenschaft.
    const mitFugenS = ref(
      "mit-s",
      "Klepspeling controleren",
      "Klepspeling bij onderhoud controleren.",
    );
    const ohne = ref("ohne-s", "Pomp controleren", "Pomp bij onderhoud controleren.");
    const frage = "klep controleren onderhoud";
    expect(
      (score(frage, mitFugenS) ?? 0) - (score(frage, ohne) ?? 0),
      "auch hier hebt der Wortteiltreffer den Wert um eins",
    ).toBe(1);
    // Und auch dieser Treffer trägt nicht: allein macht er keine Antwortquelle.
    expect(ids(keywordSelect("klep", [mitFugenS]))).toEqual([]);
  });

  it("K-4: die Wortteilgrenze SCHNEIDET — „ventil“ trifft „ventilator“ NICHT", () => {
    // Die Gegenprobe zu K-1/K-3: die Regel verlangt Wortende ODER Fugen-s. „ventilator“ erfüllt
    // beides nicht — „ventil“ steht am Wortanfang ohne Fuge. Ohne diesen Fall wäre „Wortteil
    // trifft“ eine Regel ohne Grenze.
    //
    // GEMESSEN UND NACHGEBESSERT (Gegenmutation GM-2): Die erste Fassung prüfte nur
    // `score("ventil", DE_VENTILATOR) === undefined`. Das war zu schwach — die Substanzschwelle
    // filtert einen reinen Kompositumtreffer ohnehin heraus, also blieb der Fall auch dann grün,
    // wenn die Wortteilregel auf blosses `includes` aufgeweicht wurde. Ein Test, der ohne die
    // Wirkung grün bleibt, zählt nicht. Deshalb misst dieser Fall jetzt dieselbe DIFFERENZ wie
    // K-2/K-3: mit gemeinsamen exakten Token wird der Wortteiltreffer im Wert sichtbar.
    const mitVentilator = ref(
      "mit-ventilator",
      "Ventilatoren im Maschinenraum reinigen",
      "Ventilatoren im Maschinenraum regelmäßig reinigen.",
    );
    const ohne = ref(
      "ohne-ventilator",
      "Pumpen im Maschinenraum reinigen",
      "Pumpen im Maschinenraum regelmäßig reinigen.",
    );
    const frage = "ventil maschinenraum reinigen";
    expect(
      score(frage, mitVentilator),
      "beide Quellen sind über die gemeinsamen Token erreichbar",
    ).toBeDefined();
    expect(
      (score(frage, mitVentilator) ?? 0) - (score(frage, ohne) ?? 0),
      "KEIN Wortteiltreffer: „ventilator“ liegt weder am Wortende noch hinter einer Fuge",
    ).toBe(0);
    // Und als Antwortquelle kommt der Ventilator ohnehin nicht durch.
    expect(ids(keywordSelect("ventil", [DE_VENTILATOR]))).toEqual([]);
  });
});

describe("JOB 1128 · V-3 — der Vorfilter darf Kandidaten liefern, aber keine Substanz erfinden", () => {
  it("F-1: was ein `%ventil%`-Vorfilter einliefert, verwirft der Substanzschnitt", () => {
    // BEN8-Prüflücke 2. Der SQL-Vorfilter (`repo-pg.ts:487`, `ILIKE '%term%'`) ist bewusst
    // grosszügig und zieht „Ventilatoren" in die Kandidatenliste. Diese Liste ist genau der
    // Parameter `candidates` — der Vorfilter wird hier also nicht nachgebaut, sondern sein
    // ERGEBNIS eingespeist. Der zweite, strenge Schritt muss ihn verwerfen.
    const wieAusDemVorfilter = [DE_VENTILATOR, DE_VENTIL];
    expect(
      ids(keywordSelect("Ventil Überdruck", wieAusDemVorfilter)),
      "nur die tragende Quelle bleibt; der Vorfiltertreffer fällt heraus",
    ).toEqual(["de-ventil"]);
  });

  it("F-2: die Zweistufigkeit ist die Schutzfunktion — ein Kandidat allein wird nie zur Antwort", () => {
    // V-3 als eigenständige Zusage: selbst wenn der Vorfilter NUR den Ventilator liefert, entsteht
    // keine Antwortquelle. Das ist der Unterschied zwischen „auffindbar" und „belegt".
    expect(ids(keywordSelect("Ventil Überdruck", [DE_VENTILATOR]))).toEqual([]);
  });

  it("F-3: die Substanzschwelle ist der Grund — und sie ist am Produkt abgelesen, nicht gesetzt", () => {
    // Kein Festwert nur zum Bestehen: die Schwelle kommt aus dem Produkt.
    expect(MIN_ANSWER_SUBSTANCE, "zwei tragende Token, nicht eines").toBe(2);
    // Ein einzelnes gemeinsames Inhaltstoken genügt deshalb nicht.
    const einToken = ref("ein-token", "Überdruck im Kessel", "Überdruck im Kessel beobachten.");
    expect(ids(keywordSelect("Ventil Überdruck", [einToken]))).toEqual([]);
  });
});

describe("JOB 1128 · der Beziehungstyp bleibt im Antwortvertrag unterscheidbar", () => {
  it("B-1: dieselbe Tokenisierung trägt Frage und Quelle — eine Regel, nicht zwei", () => {
    // `queryTokens` ist die öffentliche Fassung derselben Zerlegung, die `keywordSelect` und
    // `rankCandidates` intern benutzen (provider.ts:1314-1320, Symmetriezusage mega59 B). Wer den
    // Vorfilter mit anderen Termen fütterte als das Ranking, bekäme genau die Kandidaten, die
    // danach niemand mehr belegen kann.
    expect(queryTokens("klep"), "der Term überlebt die Zerlegung unverändert").toContain("klep");
    expect(queryTokens("Ventil Überdruck")).toContain("ventil");
  });

  it("B-2: LITERAL und KOMPOSITUM sind an der Antwort unterscheidbar — Wert allein genügt nicht", () => {
    // Die Grundlage für V-7: ein Kompositumtreffer hebt den Überschneidungswert, kommt aber nicht
    // als Antwortquelle durch. Wer nur den Wert liest, sieht keinen Unterschied; wer die
    // Antwortmenge liest, sehr wohl. Genau diese Trennung darf ein späterer Übersetzungsbau
    // (B-2 aus JOB 967) nicht einebnen.
    const nurKompositum = ref(
      "nur-kompositum",
      "Terugslagklep RK-8",
      "Terugslagklep RK-8 controleren.",
    );
    const literal = ref("literal", "Klep RK-8 controleren", "Klep RK-8 handmatig controleren.");
    const frage = "klep rk controleren";

    // GEMESSEN, nicht angenommen: `rankCandidates` filtert substanzlose Kandidaten bereits selbst
    // heraus (provider.ts:1531, dasselbe `meetsAnswerSubstance` wie `keywordSelect`). Der reine
    // Kompositumtreffer erscheint deshalb GAR NICHT in der Rangliste — die Trennung sitzt eine
    // Stufe früher, als ich erwartet hatte, und ist damit strenger. Beide Wege sagen dasselbe:
    expect(score(frage, nurKompositum), "kein Rangeintrag ohne Substanz").toBe(undefined);
    expect(score(frage, literal), "der literale Treffer trägt").toBeGreaterThan(0);
    // … und nur er wird Antwortquelle.
    expect(ids(keywordSelect(frage, [nurKompositum, literal]))).toEqual(["literal"]);
  });

  it("B-3: kein tragender Treffer über Sprachen — auch nicht über den Umweg des Rankings", () => {
    // Schlusszusage: weder `keywordSelect` noch `rankCandidates` erzeugen eine Sprachbrücke.
    expect(ids(keywordSelect("klep overdruk handmatig", [DE_VENTIL]))).toEqual([]);
    expect(rankCandidates("klep overdruk handmatig", [DE_VENTIL])).toEqual([]);
  });
});
