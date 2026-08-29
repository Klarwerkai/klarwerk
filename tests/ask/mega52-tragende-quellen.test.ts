import { describe, expect, it } from "vitest";
import { attributeSources, canThank, citationState } from "../../apps/web/src/lib/askCitedSources";
import {
  DeterministicProvider,
  type KnowledgeRef,
  MIN_ANSWER_SUBSTANCE,
  rankCandidates,
} from "../../services/reasoner";
// AUFTRAG-mega59 BLOCK I: `meetsRelevanceThreshold` ist innere Regel, kein öffentlicher Vertrag —
// white-box relativ, wie `refMatchText` (s. services/reasoner/index.ts).
import { meetsRelevanceThreshold } from "../../services/reasoner/src/provider";
import { ModelProvider, citedSourceIds } from "../../services/reasoner/src/provider-model";

// ================================================================================================
// AUFTRAG-mega52 BLOCK A + B — DIE ANTWORT SAGT, WORAUF SIE STEHT, UND EIN TREFFER BRAUCHT MEHR
// ALS EIN WORT.
// ================================================================================================
//
// Zwei P0 aus Pedis Word-Handlauf vom 28.07., beide mit tieferliegender Ursache als das Symptom:
//   · Die Antwort zog fachfremde Quellen heran — weil das Relevanz-Gate `keywordScore > 0` hiess.
//   · Die Antwort wusste nicht, welche Quelle sie getragen hat — weil die Fussnotenmarken des
//     Modells nie zurueckgelesen wurden.
//
// Diese Datei haelt beide Vertraege fest, inklusive der Reissleine A5 (keine Marken ⇒ LEER, nie
// geraten) und der Kopplung A4 (das Vertrauensplus trifft nur noch die tragende Quelle).

function ref(id: string, title: string, statement: string, trust = 50): KnowledgeRef {
  return { id, title, statement, status: "offen", trust };
}

describe("mega52 B1: das Relevanzmass", () => {
  // ==============================================================================================
  // AUFTRAG-mega53 A3 — DIESE ZUSICHERUNG WAR FALSCH UND WIRD KORRIGIERT, NICHT UMGANGEN.
  // ==============================================================================================
  //
  // SIE STAND HIER SO (mega52): „der beste Treffer erfuellt die Schwelle IMMER — sie kann nie
  // leeren", mit `for (const best of [1, 2, 3, 8, 40]) expect(meets(best, best)).toBe(true)`.
  //
  // WARUM SIE FALSCH WAR. Sie hat eine Bequemlichkeit des Maßes zur Eigenschaft erhoben. „Kann nie
  // leeren" klang nach Schutz vor einer Ueberfilterung — tatsaechlich war es die Beschreibung eines
  // FAIL-OPEN: der Fall `best = 1` sagt genau, dass ein einzelnes gemeinsames Allerweltswort eine
  // Antwort tragen darf. Damit hat der Test den Befund, den ben in sammel50 als ROT-1 gefunden hat,
  // ausdruecklich FESTGEHALTEN statt ihn aufzudecken. Ein Test, der eine Schwaeche pinnt, macht sie
  // dauerhaft — das ist teurer als gar kein Test.
  //
  // WAS AB JETZT GILT: die Schwelle kann sehr wohl leeren, und genau das ist ihr Sinn. Was bleibt,
  // ist die WIRKLICH tragende Eigenschaft, wegen der es keine Deckungsanteil-Schwelle geworden ist:
  // oberhalb der Mindestsubstanz kommt der beste Treffer immer durch. Er wird nie an seiner eigenen
  // relativen Latte gemessen.
  it("oberhalb der Mindestsubstanz kommt der beste Treffer immer durch", () => {
    for (const best of [MIN_ANSWER_SUBSTANCE, 3, 8, 40]) {
      expect(meetsRelevanceThreshold(best, best), `best=${best}`).toBe(true);
    }
  });

  it("AUFTRAG-mega59 I: die ABSOLUTE Regel steht nicht mehr in dieser Funktion", () => {
    // HIER STAND `expect(meetsRelevanceThreshold(1, 1)).toBe(false)` — die gemischte Bedeutung.
    // Sie war seit mega58 doppelt: das Substanztor filtert JE KANDIDAT und VOR dem Bestwert, der
    // Zweig in dieser Funktion war damit unerreichbar (Beweis: mega59-getrennte-regeln.test.ts).
    //
    // Zwei Regeln in einer Funktion sind kein Kompromiss, sondern eine Zuständigkeitslüge: wer sie
    // liest, baut beim nächsten Umbau des Tors darauf. Ab jetzt trägt `meetsAnswerSubstance` die
    // absolute Regel und diese Funktion die relative — der Absolutfall ist an die Wertetafel in
    // tests/ask/mega57-suchbar-und-tragend.test.ts umgezogen, nicht entfallen.
    //
    // Rein relativ gilt: `1 * 2 > 1`, also passiert ein Ein-Wort-Treffer die RELATIVE Latte. Dass er
    // trotzdem keine Antwort trägt, entscheidet das Tor davor — belegt im Wächter dieses Blocks.
    expect(meetsRelevanceThreshold(1, 1)).toBe(true);
    expect(MIN_ANSWER_SUBSTANCE).toBe(2);
  });

  it("ein Kandidat unter der Haelfte des besten Treffers faellt weg", () => {
    expect(meetsRelevanceThreshold(1, 2)).toBe(false); // genau die Haelfte reicht NICHT
    expect(meetsRelevanceThreshold(1, 4)).toBe(false);
    expect(meetsRelevanceThreshold(2, 3)).toBe(true);
    expect(meetsRelevanceThreshold(3, 4)).toBe(true);
  });

  it("ohne jede Ueberschneidung gibt es keinen Treffer (das alte Gate bleibt darunter)", () => {
    expect(meetsRelevanceThreshold(0, 0)).toBe(false);
    expect(meetsRelevanceThreshold(0, 5)).toBe(false);
  });

  it("der Ein-Wort-Stoerer neben einem starken Treffer verschwindet", () => {
    // Pedis Bild in klein: die Frage trifft eine Quelle deutlich und eine andere nur ueber ein
    // Allerweltswort. Bis mega52 standen beide gleichberechtigt in den Antwortquellen.
    const kandidaten = [
      ref(
        "treffer",
        "Filter F3 monatlich pruefen",
        "Filter F3 monatlich auf Verschmutzung pruefen",
      ),
      ref("stoerer", "Unruhige Nacht", "Wird ein Bewohner nachts unruhig, folgt oft ein Infekt"),
    ];
    const gerankt = rankCandidates(
      "Wie oft muss der Filter F3 auf Verschmutzung geprueft werden?",
      kandidaten,
    );
    expect(gerankt.map((c) => c.ref.id)).toEqual(["treffer"]);
  });

  it("B2: die Schwelle wirkt VOR dem Deckel — zwei belegte Quellen statt acht halbgaren", () => {
    // Ein starker Treffer und sechs Ein-Token-Mitlaeufer. Frueher fuellten sie die Liste bis acht.
    const kandidaten = [
      ref(
        "stark",
        "Ventil X bei Ueberdruck schliessen",
        "Bei Ueberdruck ueber 6 bar Ventil X schliessen",
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        ref(
          `mit${i}`,
          `Notiz ${i}`,
          "Hier steht etwas ueber ein Ventil in einem anderen Zusammenhang",
        ),
      ),
    ];
    const gerankt = rankCandidates("Was tun bei Ueberdruck am Ventil X?", kandidaten);
    expect(gerankt.map((c) => c.ref.id)).toEqual(["stark"]);
    expect(gerankt.length).toBeLessThan(8);
  });
});

describe("mega52 A2: die Marken werden zurueckgelesen", () => {
  const kandidaten = [
    ref("A", "Erste", "Aussage A"),
    ref("B", "Zweite", "Aussage B"),
    ref("C", "Dritte", "Aussage C"),
  ];

  it("erfasst einzelne, mehrfache und kommagetrennte Marken", () => {
    expect(citedSourceIds("Das gilt [1].", kandidaten)).toEqual(["A"]);
    expect(citedSourceIds("Das gilt [1][3].", kandidaten)).toEqual(["A", "C"]);
    expect(citedSourceIds("Das gilt [1, 2].", kandidaten)).toEqual(["A", "B"]);
  });

  it("die Reihenfolge folgt der Rangfolge, nicht dem Fliesstext; Doppelnennungen fallen weg", () => {
    expect(citedSourceIds("Erst [3], dann [1], nochmal [3].", kandidaten)).toEqual(["A", "C"]);
  });

  it("A5: eine Nummer ausserhalb der Liste wird VERWORFEN, nicht gebogen", () => {
    expect(citedSourceIds("Das gilt [9].", kandidaten)).toEqual([]);
    expect(citedSourceIds("Das gilt [0].", kandidaten)).toEqual([]);
    // Gemischt: die gueltige bleibt, die ungueltige verschwindet — kein Rueckfall auf alle.
    expect(citedSourceIds("Das gilt [2] und [12].", kandidaten)).toEqual(["B"]);
  });

  it("A5: ohne Marken ist das Ergebnis LEER — nie ein stiller Rueckfall auf alle", () => {
    expect(citedSourceIds("Eine Antwort voellig ohne Quellenverweise.", kandidaten)).toEqual([]);
    expect(citedSourceIds("Klammern [ohne Zahl] zaehlen nicht.", kandidaten)).toEqual([]);
  });
});

describe("mega52 A3: der Modellmodus meldet die tragenden Quellen", () => {
  it("nur die markierte Quelle steht in citedSources — sources bleibt vollstaendig", async () => {
    const provider = new ModelProvider({
      name: "fake",
      complete: async () => "Bei Ueberdruck das Ventil schliessen [1].",
    });
    const kandidaten = [
      ref(
        "ventil",
        "Ventil X bei Ueberdruck schliessen",
        "Bei Ueberdruck ueber 6 bar Ventil X schliessen",
      ),
      ref("ventil2", "Ventil X Wartung", "Ventil X bei Ueberdruck einmal jaehrlich pruefen"),
    ];
    const ergebnis = await provider.answer("Was tun bei Ueberdruck am Ventil X?", kandidaten);

    expect(ergebnis.answered).toBe(true);
    // Beide wurden herangezogen …
    expect(ergebnis.sources).toEqual(["ventil", "ventil2"]);
    // … getragen hat die Antwort nur die eine, die das Modell markiert hat.
    expect(ergebnis.citedSources).toEqual(["ventil"]);
  });

  // ==============================================================================================
  // JOB 2659 D1 (Review EXT1-20260828, Befund 6) — DIESER PIN HIELT DEN BEFUND FEST, NICHT DEN
  // SCHUTZ. ER WIRD GEÄNDERT, NICHT UMGANGEN.
  // ==============================================================================================
  //
  // ER STAND HIER SO (mega52 A5): „liefert das Modell keine Marken, bleibt citedSources leer" —
  // mit `answered = true` und `sources = ["ventil"]`. Das Review nennt genau diese Zeilen: „Liefert
  // das Modell keine Marken, geht die Antwort trotzdem mit answered:true und bis zu 8 sources
  // hinaus; die Reissleine greift nur bei sources.length===0, was im Modellweg nie eintritt."
  //
  // WAS DER PIN RICHTIG HIELT und was bleibt: ohne Marke wird NICHTS geraten — `citedSources` ist
  // leer, nie stillschweigend auf alle zurückgefallen.
  // WAS ER FALSCH HIELT: dass der Text trotzdem eine Antwort ist. Der Prompt macht die Marke seit
  // mega52 A1 zur PFLICHT für jede Quellaussage. Ein Text ohne Marke ist nach diesem Vertrag keine
  // Quellaussage — also keine Antwort, sondern eine Wissenslücke. `sources` ist dann leer: eine
  // Nicht-Antwort trägt keine Grundlage, die ein Verbraucher als Deckung lesen könnte.
  it("A5 / JOB 2659: liefert das Modell keine Marken, gibt es keine Antwort — nichts wird geraten", async () => {
    const provider = new ModelProvider({
      name: "fake",
      complete: async () => "Bei Ueberdruck das Ventil schliessen.",
    });
    const kandidaten = [ref("ventil", "Ventil X", "Bei Ueberdruck Ventil X schliessen")];
    const ergebnis = await provider.answer("Was tun bei Ueberdruck am Ventil X?", kandidaten);

    expect(ergebnis.answered).toBe(false);
    expect(ergebnis.answer).toBeNull();
    expect(ergebnis.sources).toEqual([]);
    expect(ergebnis.citedSources).toEqual([]);
  });
});

describe("mega52 A3: der deterministische Weg war immer schon ehrlich", () => {
  it("citedSources ist die eine Quelle, aus der die Antwort gebildet wurde", async () => {
    const provider = new DeterministicProvider();
    const kandidaten = [
      ref("ventil", "Ventil X", "Bei Ueberdruck ueber 6 bar Ventil X schliessen"),
    ];
    const ergebnis = await provider.answer("Was tun bei Ueberdruck am Ventil X?", kandidaten);

    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.citedSources).toEqual(["ventil"]);
    expect(ergebnis.citedSources).toEqual(ergebnis.sources);
  });

  it("ohne Treffer ist beides leer", async () => {
    const provider = new DeterministicProvider();
    const ergebnis = await provider.answer("Voellig fachfremde Frage ueber Astronomie", [
      ref("ventil", "Ventil X", "Bei Ueberdruck Ventil X schliessen"),
    ]);
    expect(ergebnis.answered).toBe(false);
    expect(ergebnis.citedSources).toEqual([]);
  });
});

describe("mega52 A3/A4: die Oberflaeche ordnet und bindet das Danke", () => {
  const quellen = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("tragende zuerst, uebrige danach — beide Gruppen stabil in Rangfolge", () => {
    const geordnet = attributeSources(quellen, ["c", "a"]);
    expect(geordnet.map((s) => s.id)).toEqual(["a", "c", "b"]);
    expect(geordnet.map((s) => s.carrying)).toEqual([true, true, false]);
  });

  it("A5: unbekannte Zuordnung ordnet NICHTS um und kennzeichnet NICHTS", () => {
    for (const unbekannt of [undefined, []]) {
      const geordnet = attributeSources(quellen, unbekannt);
      expect(
        geordnet.map((s) => s.id),
        String(unbekannt),
      ).toEqual(["a", "b", "c"]);
      expect(geordnet.every((s) => !s.carrying)).toBe(true);
      expect(citationState(unbekannt)).toBe("unattributed");
    }
    expect(citationState(["a"])).toBe("attributed");
  });

  it("A4: gedankt werden darf nur, was die Antwort getragen hat", () => {
    const geordnet = attributeSources(quellen, ["b"]);
    expect(geordnet.filter(canThank).map((s) => s.id)).toEqual(["b"]);
    // Bei unbekannter Zuordnung darf fuer KEINE Quelle gedankt werden — ein Vertrauensplus auf
    // Verdacht ist genau die stille Verfaelschung, die dieser Block beseitigt.
    expect(attributeSources(quellen, []).filter(canThank)).toEqual([]);
  });
});
