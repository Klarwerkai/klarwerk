// ================================================================================================
// AUFTRAG-mega34 BLOCK B1b — DER PARITÄTSWÄCHTER. DIE DATEI, AUF DIE DER PRODUKTCODE ZEIGT.
// ================================================================================================
//
// `services/ask/src/answer-evidence.ts:27` nennt genau diesen Pfad als den Wächter, der die
// serverseitige Regel und ihren Spiegel in der Oberfläche aneinanderhält. Bis JOB 619 D5 zeigte
// dieser Verweis ins Leere — der Wächter lief, aber unter einem anderen Dateinamen
// (`tests/app/mega34-word-einstufung.test.ts`, Block B1b). Ein Kommentar, der eine Prüfabdeckung
// behauptet und auf nichts zeigt, ist genau die Klasse, die
// `tests/structure/testverweise-aufloesbar.test.ts` seit diesem Durchgang bewacht.
//
// DESHALB IST DIESE DATEI EINE VERSCHIEBUNG, KEIN NEUBAU. BEN8 zum D4-Durchgang, Abschnitt
// ABLÖSUNG: „Der bestehende Wahrheitstafel-Wächter bleibt der alleinige Paritätsvertrag; kein
// paralleler Entscheidungsweg entstand." Ein zweiter Wächter neben dem bestehenden hätte genau
// diesen Satz gebrochen — die Tafel steht ab jetzt HIER und nur hier, und der Nachbar verweist
// darauf, statt sie ein zweites Mal auszuführen.
//
// ================================================================================================
// WARUM ES ÜBERHAUPT ZWEI KODIERUNGEN GIBT — UND WARUM SIE NICHT ZUSAMMENGELEGT WERDEN KÖNNEN.
// ================================================================================================
//
// `apps/web` DARF NICHT aus `services/` importieren. Der webbuild-Stage im Dockerfile kopiert nur
// `apps/web`; ein Import über die Modulgrenze löst LOKAL auf und bricht die Produktion. Das Verbot
// ist selbst gepinnt (`tests/capture/draft-limits-shared.test.ts`). Gemeinsamer Code ist damit
// baulich ausgeschlossen — also hält ein Wächter die beiden Kodierungen aneinander, wie bei der
// Vollständigkeits-Invariante (`coverage-complete.ts`) und den elf Entwurfs-Grenzwerten.
//
// Die Oberflächen-Fassung (`apps/web/src/lib/answerGrade.ts`) ist ein bewusster SPIEGEL, kein
// zweiter Entscheider: sie kennt zusätzlich den ABRUFZUSTAND ihrer Konfliktliste (mega34 A), den
// der Server nicht hat. Über die gemeinsamen Eingaben müssen beide dasselbe sagen.
import { describe, expect, it } from "vitest";
import { answerGrade } from "../../apps/web/src/lib/answerGrade";
import { answerEvidence } from "../../services/ask";
import type { KnowledgeObject } from "../../services/knowledge-object";

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

describe("mega34 B1b · Server-Regel und Oberflächen-Spiegel sagen dasselbe", () => {
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

  // ==============================================================================================
  // JOB 619 D5 — DIE KALIBRIERUNG, DIE DER TAFEL BISHER FEHLTE.
  // ==============================================================================================
  //
  // Die Tafel oben vergleicht zwei Funktionen miteinander. Gäben BEIDE für jede Eingabe denselben
  // konstanten Wert zurück, wäre sie ebenso grün — und würde nichts mehr bewachen. Bisher hing der
  // Beweis, dass die Tafel überhaupt unterscheidet, an den vier Einzelfällen im Nachbarn.
  //
  // Diese beiden Fälle machen ihn hier fest: Die Tafel MUSS beide Ergebnisse hervorbringen, und der
  // eine Zustand, der „Gesichert" tragen darf, muss die volle Bedingungskette verlangen.
  it("die Tafel unterscheidet wirklich — beide Ergebnisse kommen vor", () => {
    const ergebnisse = new Set<string>();
    for (const knowledgeClass of ["gesichert", "ungeprueft", "meinung"] as const) {
      for (const answered of [true, false]) {
        for (const conflicted of [true, false]) {
          for (const checkUnproven of [true, false]) {
            for (const conflictsUnproven of [true, false]) {
              ergebnisse.add(
                answerGrade({
                  answered,
                  knowledgeClass,
                  sourcesConflicted: conflicted,
                  sourcesCheckUnproven: checkUnproven,
                  conflictsUnproven,
                }),
              );
            }
          }
        }
      }
    }
    expect([...ergebnisse].sort()).toEqual(["gap", "unverified", "verified"]);
  });

  it("`verified` verlangt ALLE vier Bedingungen — jede einzeln gekippt ergibt `unverified`", () => {
    const belegt = {
      answered: true,
      knowledgeClass: "gesichert",
      sourcesConflicted: false,
      sourcesCheckUnproven: false,
      conflictsUnproven: false,
    } as const;
    expect(answerGrade(belegt)).toBe("verified");
    expect(answerGrade({ ...belegt, knowledgeClass: "ungeprueft" })).toBe("unverified");
    expect(answerGrade({ ...belegt, sourcesConflicted: true })).toBe("unverified");
    expect(answerGrade({ ...belegt, sourcesCheckUnproven: true })).toBe("unverified");
    expect(answerGrade({ ...belegt, conflictsUnproven: true })).toBe("unverified");
    // Und ohne Antwort ist es weder das eine noch das andere.
    expect(answerGrade({ ...belegt, answered: false })).toBe("gap");
  });
});
