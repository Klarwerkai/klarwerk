import { describe, expect, it } from "vitest";
import type {
  AnswerResult,
  Conflict,
  KnowledgeObject as WebKo,
} from "../../apps/web/src/api/types";
import { answerReviewGuard } from "../../apps/web/src/lib/askView";
import { effectiveAnswer } from "../../apps/web/src/lib/effectiveAnswer";
import { answerEvidence } from "../../services/ask";
import type { KnowledgeObject } from "../../services/knowledge-object";
import type { KnowledgeRef } from "../../services/reasoner";
import { ModelProvider } from "../../services/reasoner/src/provider-model";

// ================================================================================================
// AUFTRAG-mega53 BLOCK B6 — DER SAMMLER: KEINE AUSSAGE ÜBER DIE ANTWORT AUS EINER QUELLE, DIE SIE
// NICHT GETRAGEN HAT.
// ================================================================================================
//
// DER BEFUND (ben, sammel50 ROT-2). `citedSources` steuerte seit mega52 Kennzeichnung, Beleg und
// Danke — aber NICHT Wissensklasse, Vertrauenswert, Prüf-Abdeckung und Konfliktlage. Die vier
// kanonischen Stellen rechneten weiter auf `sources`, also auf ALLEN bis zu acht herangezogenen
// Kandidaten. Folge: zitiert das Modell nur Quelle 2, bestimmt trotzdem Quelle 1 die sichtbare
// Sicherheit der Antwort.
//
// DIE BAUFORM, ÜBER DIE DIESER SAMMLER ERHEBT — und warum er keine Liste der heutigen Fälle ist:
//
// Eine Aussage ÜBER DIE ANTWORT ist genau dann ehrlich, wenn sie sich NICHT ÄNDERT, sobald sich
// eine bloß konsultierte Quelle ändert. Das ist eine UNABHÄNGIGKEITS-EIGENSCHAFT, keine Aufzählung:
// der Sammler quantifiziert über die VOLLSTÄNDIGE Zustandsmenge einer nicht zitierten Quelle
// (Status × Vertrauenswert × Prüf-Lauf × Auflösbarkeit × Konflikt = 40 Zustände) und verlangt für
// JEDEN, dass das Urteil identisch zu dem Lauf ist, in dem diese Quelle gar nicht existiert.
//
// Damit findet er eine falsche Grundlage, ohne sie zu kennen: WELCHE Stelle künftig `sources` statt
// `citedSources` liest, ist ihm gleich — sie fällt auf, weil ihr Ergebnis auf eine fremde Quelle
// reagiert. Eine neue Ableitung, die denselben Fehler macht, wird von derselben Erhebung erfasst,
// sobald sie in eines der vier erhobenen Urteile einfließt.
//
// GEGENPROBE GEGEN TRIVIALITÄT (ohne sie wäre „reagiert auf nichts" ein bestandener Lauf): dieselbe
// Störung an der ZITIERTEN Quelle MUSS das Urteil bewegen.
//
// BENANNTE GRENZE, ehrlich: der Sammler erhebt die vier Urteile, die eine Antwort tragen (Grad,
// Klasse, Prüfvorbehalt, Konfliktlage) plus den Vertrauenswert am Erzeuger. Eine künftige
// Ableitung, die eine FÜNFTE, hier nicht erhobene Aussage aus `sources` bildet, ginge vorbei —
// dafür ist die Gegenprüfung da, nicht dieser Test.

// ------------------------------------------------------------------------------------------------
// Die vollständige Zustandsmenge EINER Quelle.
// ------------------------------------------------------------------------------------------------
const PROVEN_COVERAGE = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};
const CAPPED_COVERAGE = { ...PROVEN_COVERAGE, available: 999, selected: 20, capped: true };

// Prüf-Lauf: alle vier unterscheidbaren Beweislagen plus „Quelle gar nicht auflösbar".
interface CheckState {
  name: string;
  aiCheck: unknown;
  missing: boolean;
}
const CHECK_PROVEN: CheckState = {
  name: "proven",
  aiCheck: { status: "done", coverage: PROVEN_COVERAGE },
  missing: false,
};
const CHECK_INCOMPLETE: CheckState = {
  name: "incomplete",
  aiCheck: { status: "done", coverage: CAPPED_COVERAGE },
  missing: false,
};
const CHECKS: readonly CheckState[] = [
  CHECK_PROVEN,
  CHECK_INCOMPLETE,
  { name: "noCoverage", aiCheck: { status: "done" }, missing: false },
  { name: "unchecked", aiCheck: undefined, missing: false },
  // Die Quelle ist im Bestand gar nicht auflösbar — der schwerste Zustand überhaupt.
  { name: "unresolvable", aiCheck: undefined, missing: true },
];

interface SourceState {
  name: string;
  status: "validiert" | "offen";
  trust: number;
  check: CheckState;
  conflicted: boolean;
}

// 2 × 2 × 5 × 2 = 40 Zustände. Bewusst das Kreuzprodukt und keine Auswahl — eine Auswahl wäre
// wieder eine Liste der Fälle, an die ich heute denke.
const ALL_STATES: SourceState[] = [];
for (const status of ["validiert", "offen"] as const) {
  for (const trust of [100, 0]) {
    for (const check of CHECKS) {
      for (const conflicted of [true, false]) {
        ALL_STATES.push({
          name: `${status}/trust${trust}/${check.name}/${conflicted ? "konflikt" : "frei"}`,
          status,
          trust,
          check,
          conflicted,
        });
      }
    }
  }
}

function serverKo(id: string, s: SourceState): KnowledgeObject {
  return {
    id,
    title: `Wissen ${id}`,
    statement: "Aussage.",
    type: "best_practice",
    category: "Betrieb",
    status: s.status,
    trust: s.trust,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck: s.check.aiCheck,
  } as unknown as KnowledgeObject;
}

function webKo(id: string, s: SourceState): WebKo {
  return serverKo(id, s) as unknown as WebKo;
}

function conflictsFor(states: ReadonlyMap<string, SourceState>): Conflict[] {
  return [...states.entries()]
    .filter(([, s]) => s.conflicted)
    .map(
      ([id], i) => ({ id: `c${i}`, koA: id, koB: "fremd", status: "offen" }) as unknown as Conflict,
    );
}

// Die tragende Quelle ist in ALLEN Läufen dieselbe — nur die konsultierte daneben wandert durch
// ihre Zustandsmenge. Bewusst ein SCHWACHER Träger: so kann eine starke Nachbarquelle das Urteil
// sichtbar nach oben ziehen, wenn sie es (fälschlich) darf.
const TRAEGER: SourceState = {
  name: "traeger",
  status: "offen",
  trust: 30,
  check: CHECK_INCOMPLETE,
  conflicted: false,
};

function serverUrteil(sources: string[], cited: string[], states: Map<string, SourceState>) {
  const sourceKos = new Map<string, KnowledgeObject>();
  for (const [id, s] of states) {
    if (!s.check.missing) {
      sourceKos.set(id, serverKo(id, s));
    }
  }
  const e = answerEvidence({
    answer: {
      answered: true,
      knowledgeClass: "gesichert",
      sources,
      citedSources: cited,
    } as never,
    sourceKos,
    openConflicts: conflictsFor(states),
  });
  return {
    grade: e.grade,
    knowledgeClass: e.knowledgeClass,
    checkCaveat: e.checkCaveat,
    sourcesConflicted: e.sourcesConflicted,
  };
}

function webUrteil(sources: string[], cited: string[], states: Map<string, SourceState>) {
  const kos: WebKo[] = [];
  for (const [id, s] of states) {
    if (!s.check.missing) {
      kos.push(webKo(id, s));
    }
  }
  const answer = {
    answered: true,
    answer: "Antwort.",
    knowledgeClass: "gesichert",
    trust: 90,
    sources,
    citedSources: cited,
    steps: [],
    demo: false,
  } as unknown as AnswerResult;
  const e = effectiveAnswer(answer, kos, { state: "loaded", items: conflictsFor(states) });
  return {
    grade: e.grade,
    knowledgeClass: e.knowledgeClass,
    caveat: e.caveat,
    sourcesConflicted: e.sourcesConflicted,
    // Der Review-Wächter beschriftet sich aus den Quellen („stützt sich auf offene Quellen") —
    // auch das ist eine Aussage über DIE ANTWORT und gehört damit auf die tragende Teilmenge.
    // Genau so ruft Ask.tsx ihn seit mega53 auf; vorher stand dort die volle Liste.
    guard: answerReviewGuard(e.grade, e.carryingSources)?.labelKey ?? null,
  };
}

describe("mega53 B6 · der Sammler: eine nur konsultierte Quelle bewegt kein Urteil", () => {
  // Der Bezugslauf: die tragende Quelle ALLEIN. So sähe die Antwort aus, wenn es die konsultierte
  // Nachbarquelle gar nicht gäbe — und genau so muss sie in allen 40 Zuständen aussehen.
  const nurTraeger = new Map([["traeger", TRAEGER]]);

  it("die serverseitige Regel ist über ALLE 40 Zustände der Nachbarquelle invariant", () => {
    const referenz = serverUrteil(["traeger"], ["traeger"], nurTraeger);
    expect(ALL_STATES).toHaveLength(40);
    for (const nachbar of ALL_STATES) {
      const states = new Map([
        ["traeger", TRAEGER],
        ["nachbar", nachbar],
      ]);
      expect(serverUrteil(["traeger", "nachbar"], ["traeger"], states), nachbar.name).toEqual(
        referenz,
      );
    }
  });

  it("der Spiegel in der Oberfläche ist über dieselben 40 Zustände invariant", () => {
    const referenz = webUrteil(["traeger"], ["traeger"], nurTraeger);
    for (const nachbar of ALL_STATES) {
      const states = new Map([
        ["traeger", TRAEGER],
        ["nachbar", nachbar],
      ]);
      expect(webUrteil(["traeger", "nachbar"], ["traeger"], states), nachbar.name).toEqual(
        referenz,
      );
    }
  });

  it("der Vertrauenswert am Erzeuger ist über dieselben 40 Zustände invariant", async () => {
    // Das Modell zitiert AUSDRÜCKLICH nur den Träger — und zwar unter der Nummer, unter der er im
    // Prompt wirklich steht. Bewusst NICHT hart „[1]": das Ranking darf die Reihenfolge ändern
    // (eine validierte Nachbarquelle steigt über den offenen Träger), und dieser Arm misst die
    // ZUORDNUNG, nicht die Rangfolge.
    const refFor = (kandidaten: KnowledgeRef[]) =>
      new ModelProvider({
        name: "fake",
        complete: async (_system: string, user: string) => {
          const zeile = user
            .split("\n")
            .find((l) => /^\[\d+\] Ventil X bei Überdruck schließen:/.test(l));
          return `Bei Überdruck das Ventil schließen ${zeile?.slice(0, zeile.indexOf("]") + 1)}.`;
        },
      }).answer("Was tun bei Überdruck am Ventil X?", kandidaten);

    const traegerRef: KnowledgeRef = {
      id: "traeger",
      title: "Ventil X bei Überdruck schließen",
      statement: "Bei Überdruck über 6 bar Ventil X schließen",
      status: "offen",
      trust: 30,
    };
    const allein = await refFor([traegerRef]);
    for (const nachbar of ALL_STATES) {
      const ergebnis = await refFor([
        traegerRef,
        {
          id: "nachbar",
          title: "Ventil X bei Überdruck prüfen",
          statement: "Bei Überdruck über 6 bar Ventil X einmal jährlich prüfen",
          status: nachbar.status,
          trust: nachbar.trust,
        },
      ]);
      expect(ergebnis.citedSources, nachbar.name).toEqual(["traeger"]);
      expect(ergebnis.trust, nachbar.name).toBe(allein.trust);
      expect(ergebnis.knowledgeClass, nachbar.name).toBe(allein.knowledgeClass);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // GEGENPROBE: der Sammler wäre wertlos, wenn die Urteile auf NICHTS reagierten.
  // ----------------------------------------------------------------------------------------------
  it("dieselbe Störung an der TRAGENDEN Quelle bewegt das Urteil sehr wohl", () => {
    const schwach = serverUrteil(["traeger"], ["traeger"], new Map([["traeger", TRAEGER]]));
    const stark = serverUrteil(
      ["traeger"],
      ["traeger"],
      new Map([["traeger", { ...TRAEGER, status: "validiert" as const, check: CHECK_PROVEN }]]),
    );
    expect(stark).not.toEqual(schwach);
    expect(stark.grade).toBe("verified");
    expect(schwach.grade).toBe("unverified");
  });

  // ----------------------------------------------------------------------------------------------
  // B2 — OHNE ZUORDNUNG WIRD NICHTS BEHAUPTET. Über dieselbe Zustandsmenge erhoben: egal wie
  // makellos die konsultierten Quellen sind, ohne Marke trägt keine von ihnen die Antwort.
  // ----------------------------------------------------------------------------------------------
  it("leere Zuordnung ⇒ nie gesichert, über alle 40 Zustände der konsultierten Quelle", () => {
    for (const zustand of ALL_STATES) {
      const states = new Map([["q1", zustand]]);
      const server = serverUrteil(["q1"], [], states);
      expect(server.grade, zustand.name).toBe("unverified");
      expect(server.knowledgeClass, zustand.name).not.toBe("gesichert");
      expect(server.checkCaveat, zustand.name).not.toBeNull();
      const web = webUrteil(["q1"], [], states);
      expect(web.grade, zustand.name).toBe("unverified");
      expect(web.knowledgeClass, zustand.name).not.toBe("gesichert");
      expect(web.caveat, zustand.name).not.toBeNull();
    }
  });
});
