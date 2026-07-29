// ================================================================================================
// AUFTRAG-mega34 BLOCK B (bens zweiter ROT-Befund) — WORD UND KLARA KENNEN DIE EINSTUFUNG NICHT.
// ================================================================================================
//
// Aufgabe 6 der Testerin. Die Word-Fläche rief `/api/ask`, verarbeitete Antwort, Quellen und Trust
// — und weder Einstufung noch Prüfabdeckung noch Konfliktstand. Sie versprach in allen drei
// Sprachen unbedingt „geprüftes Wissen", zeigte die Antwort ohne Einstufung und KOPIERTE sie ohne
// jeden Hinweis in ein echtes Dokument. Eine Suche nach `effectiveAnswer` fand dort keinen
// einzigen Verbraucher.
//
// Dieser Test pinnt vier Dinge:
//   B1a  Der Server liefert den kanonischen Evidenzzustand an `/api/ask` — für alle vier Fälle.
//   B1b  Die serverseitige Regel und der Spiegel in der Oberfläche geben über die VOLLSTÄNDIGE
//        Wahrheitstafel dasselbe Ergebnis. (Gemeinsamer Code ist baulich ausgeschlossen, s. u.)
//   B2   Anzeige, Kopieren und Einfügen benutzen denselben Hinweis — der eingefügte Text trägt die
//        Einstufung MIT.
//   B3   Die Word-Laufzeit wertet den Zustand aus, in beiden Fassungen (TS-Modul und Inline-HTML).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { answerGrade } from "../../apps/web/src/lib/answerGrade";
import {
  type AskOutcome,
  answerInsertEvidenceNote,
  buildAnswerInsertText,
  performAsk,
} from "../../apps/web/src/lib/wordAddin";
import { answerEvidence } from "../../services/ask";
import type { KnowledgeObject } from "../../services/knowledge-object";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";

const PROVEN = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};
// Der Lauf meldet „done", nichts übersprungen, nichts abgebrochen — nur gedeckelt. Bens Fall.
const CAPPED = {
  ...PROVEN,
  available: 12479,
  selected: 20,
  attempted: 20,
  completed: 20,
  capped: true,
};

function ko(id: string, coverage: unknown): KnowledgeObject {
  return {
    id,
    title: `Wissen ${id}`,
    statement: "Ventil V4 wird jährlich geprüft.",
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 90,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck: coverage === undefined ? undefined : { status: "done", coverage },
  } as unknown as KnowledgeObject;
}

// AUFTRAG-mega53 B4: `citedSources` ist Pflichteingabe der Regel geworden. Hier trägt die eine
// Quelle die Antwort auch wirklich — die vier Fälle unten prüfen die Prüf-/Konfliktlage, nicht die
// Zuordnung. Der Zuordnungs-Fall selbst liegt in tests/ask/mega53-tragende-grundlage-sammler.ts.
const ANSWER = {
  answered: true as const,
  knowledgeClass: "gesichert" as const,
  sources: ["k1"],
  citedSources: ["k1"],
};

// ================================================================================================
// B1a — DER KANONISCHE ZUSTAND, VIER FÄLLE.
// ================================================================================================
describe("mega34 B1 · der Server liefert einen quellengebundenen Evidenzzustand", () => {
  it("belegter Lauf, Konflikte bekannt und leer ⇒ verified", () => {
    const e = answerEvidence({
      answer: ANSWER,
      sourceKos: new Map([["k1", ko("k1", PROVEN)]]),
      openConflicts: [],
    });
    expect(e.grade).toBe("verified");
    expect(e.knowledgeClass).toBe("gesichert");
    expect(e.checkCaveat).toBeNull();
    expect(e.conflictsUnproven).toBe(false);
  });

  it("gedeckelte Abdeckung ⇒ unverified, mit benanntem Bezug", () => {
    const e = answerEvidence({
      answer: ANSWER,
      sourceKos: new Map([["k1", ko("k1", CAPPED)]]),
      openConflicts: [],
    });
    expect(e.grade).toBe("unverified");
    // Die angezeigte Klasse trägt das Wort NICHT mehr — auch nicht in Word.
    expect(e.knowledgeClass).toBe("ungeprueft");
    expect(e.checkCaveat).toEqual({ reason: "incomplete", unproven: 1, total: 1 });
  });

  it("unbekannter Konfliktstand (Abruf gescheitert) ⇒ unverified", () => {
    const e = answerEvidence({
      answer: ANSWER,
      sourceKos: new Map([["k1", ko("k1", PROVEN)]]),
      openConflicts: null, // „unbekannt", NICHT „keine"
    });
    expect(e.grade).toBe("unverified");
    expect(e.conflictsUnproven).toBe(true);
    expect(e.knowledgeClass).toBe("ungeprueft");
  });

  it("Quelle im Bestand unauflösbar ⇒ unverified mit reason unknown", () => {
    const e = answerEvidence({
      answer: ANSWER,
      sourceKos: new Map(),
      openConflicts: [],
    });
    expect(e.grade).toBe("unverified");
    expect(e.checkCaveat?.reason).toBe("unknown");
  });
});

// ================================================================================================
// B1b — DER PARITÄTSWÄCHTER.
// ================================================================================================
//
// WARUM EIN SPIEGEL UND KEIN GEMEINSAMES MODUL: `apps/web` darf nicht aus `services/` importieren.
// Der webbuild-Stage im Dockerfile kopiert nur `apps/web`; ein Import über die Modulgrenze löst
// LOKAL auf und bricht die Produktion. Das Verbot ist selbst gepinnt
// (tests/capture/draft-limits-shared.test.ts). Gemeinsamer Code ist damit baulich ausgeschlossen —
// also hält ein Wächter die beiden Kodierungen aneinander, wie bei der Vollständigkeits-Invariante
// (coverage-complete.ts) und den elf Entwurfs-Grenzwerten.
describe("mega34 B1 · Server-Regel und Oberflächen-Spiegel sagen dasselbe", () => {
  it("über die VOLLSTÄNDIGE Wahrheitstafel — 2^4 Kombinationen mal drei Klassen", () => {
    const KLASSEN = ["gesichert", "ungeprueft", "meinung"] as const;
    let geprueft = 0;
    for (const knowledgeClass of KLASSEN) {
      for (const answered of [true, false]) {
        for (const conflicted of [true, false]) {
          for (const checkUnproven of [true, false]) {
            for (const conflictsUnproven of [true, false]) {
              const spiegel = answerGrade({
                answered,
                knowledgeClass,
                sourcesConflicted: conflicted,
                sourcesCheckUnproven: checkUnproven,
                conflictsUnproven,
              });
              // Dieselben Bedingungen serverseitig herstellen: eine Quelle, deren Abdeckung den
              // Prüfstand setzt, plus ein Konflikt auf ihr, plus der Abrufzustand.
              const server = answerEvidence({
                answer: {
                  answered,
                  knowledgeClass,
                  sources: answered ? ["k1"] : [],
                  // mega53 B4: dieselbe eine Quelle trägt die Antwort — so misst die Tafel
                  // weiterhin genau die Prüf-/Konfliktlage und nicht zusätzlich die Zuordnung.
                  citedSources: answered ? ["k1"] : [],
                },
                sourceKos: new Map([["k1", ko("k1", checkUnproven ? CAPPED : PROVEN)]]),
                openConflicts: conflictsUnproven
                  ? null
                  : conflicted
                    ? ([{ id: "c1", koA: "k1", koB: "k9", status: "offen" }] as never)
                    : [],
              });
              expect(
                server.grade,
                `Klasse=${knowledgeClass} answered=${answered} konflikt=${conflicted} pruefung=${checkUnproven} abruf=${conflictsUnproven}`,
              ).toBe(spiegel);
              geprueft += 1;
            }
          }
        }
      }
    }
    expect(geprueft).toBe(3 * 2 * 2 * 2 * 2);
  });
});

// ================================================================================================
// B2/B3 — DIE WORD-LAUFZEIT.
// ================================================================================================
function fakeFetch(evidence: unknown): never {
  return (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      result: {
        answered: true,
        answer: "Ventil V4 wird jährlich geprüft.",
        knowledgeClass: "gesichert",
        trust: 90,
        sources: ["k1"],
        steps: [],
        demo: false,
        evidence,
      },
      gap: null,
      receipt: "r",
    }),
  })) as never;
}

describe("mega34 B3 · die Word-Laufzeit übernimmt die Einstufung", () => {
  it("verified: der Zustand reist bis in das Ergebnis", async () => {
    const out = (await performAsk(
      "Frage?",
      "de",
      fakeFetch({ grade: "verified" }),
      5000,
    )) as AskOutcome;
    expect(out.kind).toBe("answered");
    expect(out.grade).toBe("verified");
  });

  it("gedeckelte Abdeckung: unverified — Word behauptet keine Sicherheit mehr", async () => {
    const out = (await performAsk(
      "Frage?",
      "de",
      fakeFetch({
        grade: "unverified",
        checkCaveat: { reason: "incomplete", unproven: 1, total: 1 },
      }),
      5000,
    )) as AskOutcome;
    expect(out.kind).toBe("answered");
    expect(out.grade).toBe("unverified");
  });

  it("unbekannter Konfliktstand: unverified", async () => {
    const out = (await performAsk(
      "Frage?",
      "de",
      fakeFetch({ grade: "unverified", conflictsUnproven: true }),
      5000,
    )) as AskOutcome;
    expect(out.grade).toBe("unverified");
  });

  it("Abruffehler: fail-safe unverified — ein Server ohne Feld gilt NICHT als belegt", async () => {
    // Ein alter Server (oder ein abgeschnittener Body) liefert `evidence` gar nicht. Das ist genau
    // derselbe Fall wie „nichts da ⇒ nichts vorhanden" aus Block A und muss vorsichtig ausgehen.
    const out = (await performAsk("Frage?", "de", fakeFetch(undefined), 5000)) as AskOutcome;
    expect(out.kind).toBe("answered");
    expect(out.grade).toBe("unverified");
  });
});

describe("mega34 B2 · Anzeige, Kopieren und Einfügen tragen denselben Hinweis", () => {
  it("der EINGEFÜGTE Text trägt die Einstufung mit — genau das verlässt das Haus", () => {
    const hinweis = answerInsertEvidenceNote("unverified", {
      unverified: "Einstufung: ungeprüft — nicht als konfliktfrei belegt.",
      verified: "Einstufung: gesichert.",
    });
    const text = buildAnswerInsertText(
      "Ventil V4 wird jährlich geprüft.",
      "Quelle: X",
      "",
      hinweis,
    );
    expect(text).toContain("Ventil V4 wird jährlich geprüft.");
    expect(text).toContain("Quelle: X");
    expect(text).toContain("Einstufung: ungeprüft");
  });

  it("bei belegter Einstufung steht die belegte Fassung — nicht gar keine", () => {
    const hinweis = answerInsertEvidenceNote("verified", {
      unverified: "Einstufung: ungeprüft — nicht als konfliktfrei belegt.",
      verified: "Einstufung: gesichert.",
    });
    const text = buildAnswerInsertText("Antwort.", "Quelle: X", "", hinweis);
    expect(text).toContain("Einstufung: gesichert.");
    expect(text).not.toContain("ungeprüft");
  });
});

describe("mega34 B · die Inline-Fassung im Taskpane ist mitgezogen", () => {
  const html = readFileSync(TASKPANE, "utf8");

  it("das Taskpane liest `evidence` aus der Antwort und wertet den Grad aus", () => {
    expect(html).toContain("evidence");
    expect(html).toContain("answerInsertEvidenceNote");
  });

  it("die unbedingte Zusage „geprueftes Wissen“ steht nicht mehr als einzige Aussage da", () => {
    // Es muss in ALLEN DREI Sprachen einen Text für die NICHT belegte Einstufung geben — sonst
    // bleibt die alte Behauptung der Normalfall.
    expect(html).toContain("askEvidenceUnverified");
    expect(html).toContain("askEvidenceVerified");
    // Drei Sprachblöcke ⇒ jeder Schlüssel dreimal.
    expect(html.split("askEvidenceUnverified:").length - 1).toBe(3);
  });

  it("der Einfügeweg des Taskpane hängt den Hinweis an", () => {
    expect(html).toContain("buildAnswerInsertText(");
  });
});
