import { describe, expect, it } from "vitest";
import type { AnswerResult, KnowledgeObject as WebKo } from "../../apps/web/src/api/types";
import { citationState } from "../../apps/web/src/lib/askCitedSources";
import { effectiveAnswer } from "../../apps/web/src/lib/effectiveAnswer";
import { answerEvidence } from "../../services/ask";
import type { KnowledgeObject } from "../../services/knowledge-object";
import type { KnowledgeRef } from "../../services/reasoner";
import { ModelProvider } from "../../services/reasoner/src/provider-model";

// ================================================================================================
// AUFTRAG-mega53 BLOCK B5 — DIE ZWEI FÄLLE, DIE MEGA52 NICHT GEPRÜFT HAT.
// ================================================================================================
//
// ben, sammel50: „Die neuen Tests pruefen `[1]` und den markenlosen Fall, aber keinen Fall, in dem
// nur `[2]` zitiert wird und Quelle 1/2 unterschiedliche Status- oder Vertrauenswerte haben."
// Genau dort liegt der Unterschied zwischen „die Marken werden gelesen" und „die Marken WIRKEN".
// mega52 hat das erste erreicht, nicht das zweite.

const VOLLSTAENDIGE_ABDECKUNG = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};

function ko(id: string, status: "validiert" | "offen", trust: number): KnowledgeObject {
  return {
    id,
    title: `Wissen ${id}`,
    statement: "Aussage.",
    type: "best_practice",
    category: "Betrieb",
    status,
    trust,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck: { status: "done", coverage: VOLLSTAENDIGE_ABDECKUNG },
  } as unknown as KnowledgeObject;
}

// ================================================================================================
// FALL 1 — DAS MODELL ZITIERT NUR [2], UND DIE BEIDEN QUELLEN SIND GEGENSÄTZLICH.
// ================================================================================================
//
// Quelle 1 rankt vorn, weil sie validiert und hoch bewertet ist (statusTrustBoost < 1 als
// Tiebreaker) — das Modell benutzt aber die zweite. Bis mega53 kamen Klasse und Vertrauenswert
// trotzdem von Quelle 1: die Antwort stand auf einer offenen Quelle mit Vertrauenswert 10 und
// verkaufte sich als gesichert mit 95.
describe("mega53 B5 · nur [2] zitiert, Quelle 1 und 2 gegensätzlich", () => {
  const STARK: KnowledgeRef = {
    id: "stark",
    title: "Ventil X bei Überdruck schließen",
    statement: "Bei Überdruck über 6 bar Ventil X sofort schließen",
    status: "validiert",
    trust: 95,
  };
  const SCHWACH: KnowledgeRef = {
    id: "schwach",
    title: "Ventil X bei Überdruck offen lassen",
    statement: "Bei Überdruck über 6 bar Ventil X zunächst offen lassen",
    status: "offen",
    trust: 10,
  };

  async function antwort() {
    const provider = new ModelProvider({
      name: "fake",
      complete: async () => "Das Ventil zunächst offen lassen [2].",
    });
    return provider.answer("Was tun bei Überdruck am Ventil X?", [STARK, SCHWACH]);
  }

  it("die Rangfolge stellt den Fall wirklich her: die validierte Quelle steht auf Platz 1", async () => {
    const ergebnis = await antwort();
    // Ohne diese Zusicherung prüfte der Test nicht, was er behauptet — „[2]" wäre sonst
    // möglicherweise wieder die starke Quelle.
    expect(ergebnis.sources).toEqual(["stark", "schwach"]);
  });

  it("die tragende Quelle ist die zitierte — und NUR sie bestimmt Klasse und Vertrauenswert", async () => {
    const ergebnis = await antwort();
    expect(ergebnis.citedSources).toEqual(["schwach"]);
    // Vor mega53 stand hier "gesichert" / 95 — beides aus der Quelle, die die Antwort nie getragen
    // hat. Das ist der Kern von bens ROT-2.
    expect(ergebnis.knowledgeClass).toBe("ungeprueft");
    expect(ergebnis.trust).toBe(10);
    // B3: die vollständige Transparenzliste bleibt unangetastet.
    expect(ergebnis.sources).toEqual(["stark", "schwach"]);
  });

  it("die serverseitige Evidenz rechnet ebenfalls nur auf der zitierten Quelle", () => {
    // Die starke Quelle ist makellos: validiert, hoher Wert, vollständig belegter Prüf-Lauf. Die
    // zitierte hat gar keinen Lauf. Das Urteil muss der ZITIERTEN folgen.
    const e = answerEvidence({
      answer: {
        answered: true,
        knowledgeClass: "ungeprueft",
        sources: ["stark", "schwach"],
        citedSources: ["schwach"],
      } as never,
      sourceKos: new Map([
        ["stark", ko("stark", "validiert", 95)],
        [
          "schwach",
          { ...ko("schwach", "offen", 10), aiCheck: undefined } as unknown as KnowledgeObject,
        ],
      ]),
      openConflicts: [],
    });
    expect(e.grade).toBe("unverified");
    // Der Vorbehalt zählt EINE Quelle, nicht zwei — er spricht über die tragende Teilmenge.
    expect(e.checkCaveat).toEqual({ reason: "unchecked", unproven: 1, total: 1 });
  });

  it("und ein Konflikt auf der NICHT zitierten Quelle begrenzt die Antwort nicht", () => {
    const e = answerEvidence({
      answer: {
        answered: true,
        knowledgeClass: "gesichert",
        sources: ["stark", "schwach"],
        citedSources: ["schwach"],
      } as never,
      sourceKos: new Map([
        ["stark", ko("stark", "validiert", 95)],
        ["schwach", ko("schwach", "offen", 10)],
      ]),
      openConflicts: [{ id: "c1", koA: "stark", koB: "fremd", status: "offen" }] as never,
    });
    expect(e.sourcesConflicted).toBe(false);
    // Die zitierte Quelle ist belegt und konfliktfrei ⇒ die Einstufung trägt.
    expect(e.grade).toBe("verified");
  });
});

// ================================================================================================
// FALL 2 — KEINE MARKE, OBWOHL ALLE QUELLEN VALIDIERT SIND.
// ================================================================================================
//
// Der gefährlichste Fall, weil er GUT aussieht: makellose Quellen, vollständige Prüf-Läufe, keine
// Konflikte. Nur weiß niemand, worauf die Antwort steht. Bis mega53 sagte die Oberfläche darunter
// korrekt „Zuordnung unbekannt" — und zeigte daneben 95 und den Grad „gesichert".
describe("mega53 B5 · keine Marke bei sonst makellosen Quellen", () => {
  const MAKELLOS: KnowledgeRef[] = [
    {
      id: "a",
      title: "Ventil X bei Überdruck schließen",
      statement: "Bei Überdruck über 6 bar Ventil X sofort schließen",
      status: "validiert",
      trust: 95,
    },
    {
      id: "b",
      title: "Ventil X Überdruck Wartung",
      statement: "Ventil X bei Überdruck jährlich prüfen lassen",
      status: "validiert",
      trust: 90,
    },
  ];

  it("der Erzeuger behauptet weder einen Wert noch die Klasse gesichert", async () => {
    const provider = new ModelProvider({
      name: "fake",
      // Eine flüssige, plausible Antwort ganz ohne Marke — der Normalfall bei einem Modell, das
      // sich nicht an das Zitierformat hält.
      complete: async () => "Bei Überdruck sollte das Ventil geschlossen werden.",
    });
    const ergebnis = await provider.answer("Was tun bei Überdruck am Ventil X?", MAKELLOS);

    // JOB 2659 D1 (Review EXT1, Befund 6) — HIER STAND `answered = true` mit `sources = ["a","b"]`.
    // mega53 nahm der markenlosen Antwort Wert und Klasse; JOB 2659 nimmt ihr den Status
    // „Antwort": ohne Marke keine Quellaussage, also Wissenslücke. Der Kern des Falls bleibt —
    // nichts „gesichert", kein Wert — und wird strenger, nicht lockerer.
    expect(ergebnis.answered).toBe(false);
    expect(ergebnis.answer).toBeNull();
    expect(ergebnis.sources).toEqual([]);
    expect(ergebnis.citedSources).toEqual([]);
    // Vor mega53: "gesichert" und 95.
    expect(ergebnis.knowledgeClass).not.toBe("gesichert");
    expect(ergebnis.trust).toBe(0);
  });

  it("die serverseitige Evidenz sagt weder gesichert noch schweigt sie", () => {
    const e = answerEvidence({
      answer: {
        answered: true,
        // Selbst wenn der Datensatz „gesichert" hergäbe: ohne Zuordnung wird es nicht angezeigt.
        knowledgeClass: "gesichert",
        sources: ["a", "b"],
        citedSources: [],
      } as never,
      sourceKos: new Map([
        ["a", ko("a", "validiert", 95)],
        ["b", ko("b", "validiert", 90)],
      ]),
      openConflicts: [],
    });
    expect(e.grade).toBe("unverified");
    expect(e.knowledgeClass).toBe("ungeprueft");
    expect(e.rawKnowledgeClass).toBe("gesichert"); // Herkunft bleibt lesbar, ist aber kein Anzeigewert.
    expect(e.checkCaveat).toEqual({ reason: "unattributed", unproven: 2, total: 2 });
    expect(e.sourcesConflicted).toBe(false);
  });

  it("der Spiegel in der Oberfläche sagt dasselbe — und zeigt keine Zahl", () => {
    const answer = {
      answered: true,
      answer: "Bei Überdruck sollte das Ventil geschlossen werden.",
      knowledgeClass: "gesichert",
      trust: 95,
      sources: ["a", "b"],
      citedSources: [],
      steps: [],
      demo: false,
    } as unknown as AnswerResult;
    const kos = [
      ko("a", "validiert", 95) as unknown as WebKo,
      ko("b", "validiert", 90) as unknown as WebKo,
    ];
    const e = effectiveAnswer(answer, kos, { state: "loaded", items: [] });

    expect(e.grade).toBe("unverified");
    expect(e.knowledgeClass).toBe("ungeprueft");
    expect(e.caveat).toEqual({ reason: "unattributed", unproven: 2, total: 2 });
    expect(e.carryingSources).toEqual([]);
    // B3: die Transparenzliste bleibt vollständig — verschwiegen wird nichts.
    expect(e.sources.map((s) => s.id)).toEqual(["a", "b"]);
    // Und das ist die Bedingung, an der Ask.tsx den Vertrauenswert durch „nicht zuordenbar"
    // ersetzt (statt eine 0 zu zeigen, die eine eigene Behauptung wäre).
    expect(citationState(answer.citedSources)).toBe("unattributed");
  });
});
