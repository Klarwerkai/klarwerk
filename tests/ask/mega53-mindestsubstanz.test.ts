import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOP_K,
  DeterministicProvider,
  type KnowledgeRef,
  MIN_ANSWER_SUBSTANCE,
  keywordSelect,
  meetsRelevanceThreshold,
  queryTokens,
  rankCandidates,
} from "../../services/reasoner";
import { refMatchText } from "../../services/reasoner/src/provider";
import { ModelProvider } from "../../services/reasoner/src/provider-model";

// ================================================================================================
// AUFTRAG-mega53 BLOCK A — EIN SCHWACHER BESTTREFFER TRÄGT KEINE ANTWORT.
// ================================================================================================
//
// DER BEFUND (ben, sammel50 ROT-1). mega52 hat das Relevanz-Gate von „Überschneidung > 0" auf ein
// RELATIVES Maß gehoben: `keywordScore * 2 > bestScore`. Das entfernt Ein-Wort-Störer zuverlässig —
// aber nur NEBEN einem stärkeren Treffer. Ist der beste Treffer selbst ein Ein-Wort-Treffer, gilt
// `1 * 2 > 1` für jeden gleich schwachen Kandidaten, und die Vereinsfest-Lage aus Pedis
// Word-Handlauf kehrt vollständig zurück. mega52 hat diesen Gleichstand an Filter F3 und Kaltstart
// selbst GEMESSEN und im Bericht benannt — geschlossen hat er ihn nicht.
//
// Diese Datei pinnt die absolute Mindestsubstanz: erreicht der beste Treffer nicht mindestens zwei
// gemeinsame Inhaltstoken, gibt es KEINE Kandidaten und die Antwort ist eine Wissenslücke.

function ref(id: string, title: string, statement: string): KnowledgeRef {
  return { id, title, statement, status: "offen", trust: 50 };
}

// Die Überschneidung, unabhängig nachgerechnet aus den exportierten Bausteinen — damit die Fixture
// selbst beweist, dass sie den Fall herstellt, den sie behauptet (und nicht versehentlich einen
// starken Treffer enthält, der den Test grün färbt, ohne ihn zu prüfen).
function ueberschneidung(frage: string, r: KnowledgeRef): number {
  const ziel = new Set(queryTokens(refMatchText(r)));
  return queryTokens(frage).filter((w) => ziel.has(w)).length;
}

// ------------------------------------------------------------------------------------------------
// A4 — DER WÖRTLICH VERLANGTE REGRESSIONSFALL: mehrere Kandidaten, ALLE mit Wert 1.
// ------------------------------------------------------------------------------------------------
// AUFTRAG-mega57 B1 — DIESE FIXTURE WURDE NACHGESCHÄRFT, DIE REGEL NICHT ANGEFASST. „sommerfest"
// hing bis mega56 am Wort „oft"; mit dem Häufigkeitsadverb in `STOPWORDS` teilte die Notiz gar
// nichts mehr mit der Frage, und die zwei Fixture-Zusicherungen darunter („jeder Kandidat hat GENAU
// EINE Überschneidung", „das alte Maß hätte alle drei durchgelassen") wurden falsch — der Fall
// hätte sich stillschweigend in einen anderen verwandelt. Die Notiz hängt jetzt an „Filter", also
// an einem echten Inhaltswort: derselbe Fall, nur ehrlicher gebaut. Die geprüfte Regel (drei
// Kandidaten mit Wert eins ⇒ leere Menge) ist unverändert.
const SCHWACHE_FRAGE = "Wie oft muss der Filter eigentlich gewartet werden?";
const NUR_EINWORT: KnowledgeRef[] = [
  ref(
    "sommerfest",
    "Sommerfest",
    "Beim Sommerfest wird der Filter der Zapfanlage zu spät gereinigt",
  ),
  ref("kaffee", "Kaffeeküche", "Der Filter der Kaffeemaschine liegt in der oberen Schublade"),
  ref("waesche", "Wäscherei", "Die Wäsche wird gewartet, sobald der Korb voll ist"),
];

describe("mega53 A1/A4 · mehrere Kandidaten, alle mit Wert 1 ⇒ Wissenslücke", () => {
  it("die Fixture stellt den Fall wirklich her: JEDER Kandidat hat genau eine Überschneidung", () => {
    for (const r of NUR_EINWORT) {
      expect(ueberschneidung(SCHWACHE_FRAGE, r), r.id).toBe(1);
    }
  });

  it("das alte, relative Maß allein hätte ALLE drei durchgelassen", () => {
    // Genau der Fail-open, den ben gefunden hat: 1 * 2 > 1. Hier steht er als Beleg, damit der
    // Regressionsfall nachweislich der Fall IST und nicht nur so heißt.
    for (const r of NUR_EINWORT) {
      const score = ueberschneidung(SCHWACHE_FRAGE, r);
      expect(score > 0 && score * 2 > 1, r.id).toBe(true);
    }
  });

  it("A2: rankCandidates liefert LEER", () => {
    expect(rankCandidates(SCHWACHE_FRAGE, NUR_EINWORT)).toEqual([]);
  });

  it("A2: keywordSelect liefert LEER — dieselbe Schwelle im zweiten Auswahlweg", () => {
    expect(keywordSelect(SCHWACHE_FRAGE, NUR_EINWORT)).toEqual([]);
  });

  it("der deterministische Weg antwortet nicht — Wissenslücke, keine Rateantwort", async () => {
    const ergebnis = await new DeterministicProvider().answer(SCHWACHE_FRAGE, NUR_EINWORT);
    expect(ergebnis.answered).toBe(false);
    expect(ergebnis.sources).toEqual([]);
    expect(ergebnis.citedSources).toEqual([]);
    expect(ergebnis.knowledgeClass).toBe("unbekannt");
  });

  it("der Modellweg fragt das Modell GAR NICHT ERST — kein Kontext, kein Egress", async () => {
    let aufrufe = 0;
    const provider = new ModelProvider({
      name: "fake",
      complete: async () => {
        aufrufe += 1;
        return "Der Filter wird beim Sommerfest gewartet.";
      },
    });
    const ergebnis = await provider.answer(SCHWACHE_FRAGE, NUR_EINWORT);
    expect(ergebnis.answered).toBe(false);
    expect(aufrufe).toBe(0);
    expect(ergebnis.trust).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
// A4 — DIE GEGENPROBE: ein starker Treffer mit schwachen Störern funktioniert UNVERÄNDERT.
// ------------------------------------------------------------------------------------------------
describe("mega53 A4 · die Gegenprobe: der starke Treffer bleibt, die Störer fallen", () => {
  const STARKE_FRAGE = "Was tun bei Überdruck am Ventil X?";
  const MIT_STARKEM: KnowledgeRef[] = [
    ref("stark", "Ventil X bei Überdruck schließen", "Bei Überdruck über 6 bar Ventil X schließen"),
    ...NUR_EINWORT,
    ref("stoerer", "Unruhige Nacht", "Wird ein Bewohner nachts unruhig, folgt oft ein Infekt"),
  ];

  it("der starke Treffer erreicht die Mindestsubstanz — und steht allein in der Auswahl", () => {
    expect(ueberschneidung(STARKE_FRAGE, MIT_STARKEM[0] as KnowledgeRef)).toBeGreaterThanOrEqual(
      MIN_ANSWER_SUBSTANCE,
    );
    expect(rankCandidates(STARKE_FRAGE, MIT_STARKEM).map((c) => c.ref.id)).toEqual(["stark"]);
    expect(keywordSelect(STARKE_FRAGE, MIT_STARKEM).map((r) => r.id)).toEqual(["stark"]);
  });

  it("und die Antwort kommt zustande, quellengebunden", async () => {
    const ergebnis = await new DeterministicProvider().answer(STARKE_FRAGE, MIT_STARKEM);
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.citedSources).toEqual(["stark"]);
  });
});

// ------------------------------------------------------------------------------------------------
// A2 — EINE SCHWELLE, ZWEI WEGE. Über die Bauform erhoben, nicht an zwei Beispielen behauptet.
// ------------------------------------------------------------------------------------------------
describe("mega53 A2 · beide Auswahlwege messen identisch", () => {
  it("über die volle Wertetafel von meetsRelevanceThreshold", () => {
    for (let best = 0; best <= 6; best += 1) {
      for (let score = 0; score <= 6; score += 1) {
        const erwartet = best >= MIN_ANSWER_SUBSTANCE && score > 0 && score * 2 > best;
        expect(meetsRelevanceThreshold(score, best), `score=${score} best=${best}`).toBe(erwartet);
      }
    }
  });

  it("und über echte Kandidatenmengen: keywordSelect und rankCandidates wählen dieselbe Menge", () => {
    // Beide Wege bekommen dieselben Fragen und dieselbe Menge. Sie dürfen sich in der SORTIERUNG
    // unterscheiden (rankCandidates gewichtet Status/Trust), nie in der AUSWAHL — sonst läge die
    // Schwelle faktisch nur in einem der beiden Wege.
    const FRAGEN = [
      SCHWACHE_FRAGE,
      "Was tun bei Überdruck am Ventil X?",
      "Wie oft muss der Filter auf Verschmutzung geprüft werden?",
      "Völlig fachfremde Frage über Astronomie",
    ];
    const MENGE: KnowledgeRef[] = [
      ref(
        "stark",
        "Ventil X bei Überdruck schließen",
        "Bei Überdruck über 6 bar Ventil X schließen",
      ),
      ref(
        "filter",
        "Filter auf Verschmutzung prüfen",
        "Den Filter monatlich auf Verschmutzung prüfen",
      ),
      ...NUR_EINWORT,
    ];
    for (const frage of FRAGEN) {
      const ausKeyword = [...keywordSelect(frage, MENGE)].map((r) => r.id).sort();
      const ausRank = [...rankCandidates(frage, MENGE, DEFAULT_TOP_K)].map((c) => c.ref.id).sort();
      expect(ausKeyword, frage).toEqual(ausRank);
    }
  });
});
