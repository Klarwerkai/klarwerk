// ================================================================================================
// AUFNAHME 20260922 · WISSENSPRÜFUNG-ISTVERTRAG — DIE ZUORDNUNG ZEIGT AUF VORHANDENES.
// ================================================================================================
//
// `docs/entscheidungen/wissenspruefung-istvertrag.md` ordnet Import-, Prüf-, Rechte- und
// Freigabepfade, PostgreSQL, Herkunft, Versionen und Graph dem Code zu. Diese Datei hält fest:
//   · Z   jede Datei, die das Dokument nennt, liegt im Bestand;
//   · F   jede tragende Funktion, Tabelle oder Konstante steht in der genannten Datei;
//   · K   die Kennzahlen des Dokuments sind die des Codes (20, 40, 5);
//   · V   ein Kandidatenlauf ist nie eine Vollprüfung — auch nicht die Vorschau ohne Treffer —, und
//         im Konfliktweg reicht das Aufheben des Deckels allein nicht; erst der gewählte
//         Vollabgleich (R-1124, `tests/wissenspruefung-istvertrag/vollabgleich.test.ts`) hebt auch
//         den fachlichen Vorfilter auf.
//
// WAS DIESE DATEI NICHT BELEGT: das Verhalten der zugeordneten Wege. Das messen die im Dokument
// genannten Tests ihrer eigenen Lieferungen.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DETECTION_CANDIDATE_CAP } from "../../services/app/src/detection-cap";
import { type KnowledgeCheckDeps, checkKnowledge } from "../../services/app/src/knowledge-check";
import { type DetectSubject, emptyCoverage, isCompleteRun } from "../../services/conflicts";
import { selectCandidates } from "../../services/conflicts/src/detect";
import { selectOverlapCandidates } from "../../services/conflicts/src/duplicate-detect";
import { CHECKSUM_CANDIDATE_CAP } from "../../services/conflicts/src/similarity-checksum";

const DOKUMENT = "docs/entscheidungen/wissenspruefung-istvertrag.md";

const lies = (pfad: string): string => readFileSync(pfad, "utf8");

const PFADANGABE = /`((?:services|tests|apps|docs)\/[^`\s]+)`/g;

/** Alle Pfadangaben in Backticks, ohne Zeilenzusatz (`datei.ts:38-45` → `datei.ts`). */
function genanntePfade(): string[] {
  const pfade = new Set<string>();
  for (const treffer of lies(DOKUMENT).matchAll(PFADANGABE)) {
    pfade.add((treffer[1] ?? "").replace(/:[\d-]+$/, ""));
  }
  return [...pfade].sort();
}

// Datei → was das Dokument dort verortet. Wörtliche Zeichenfolgen, keine Zeilennummern.
const FUNDSTELLEN: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["services/app/src/routes/library-routes.ts", ["recordImportAcceptAiCheck"]],
  ["services/app/src/ai-check-worker.ts", ["createAiCheckRunner"]],
  [
    "services/app/src/conflict-detection.ts",
    [
      "detectConflictsForKo",
      "cap: vergleichsDeckel(umfang)",
      'vollabgleich: umfang === "vollstaendig"',
    ],
  ],
  [
    "services/app/src/duplicate-detection.ts",
    ["detectDuplicatesForKo", "SemanticPrefilter", "cap: vergleichsDeckel(umfang)"],
  ],
  [
    "services/app/src/detection-cap.ts",
    ["export const DETECTION_CANDIDATE_CAP = 20;", "export function vergleichsDeckel"],
  ],
  ["services/reasoner/src/service.ts", ["private oeffentlicheKiErlaubt", "vertraulicheInhalte"]],
  [
    "services/app/src/knowledge-check.ts",
    ["const CANDIDATE_LIMIT = 40;", "dropConfidential", "assessAgainstPool"],
  ],
  [
    "services/knowledge-object/src/service.ts",
    [
      "recordAiCheckOutcome(",
      "findByImportCandidateId(",
      "setValidationStateMitBeleg(",
      "findCandidates(",
    ],
  ],
  [
    "services/knowledge-object/src/pruefbasis.ts",
    ["export function pruefbasisVon", "export function bestandsStempelVon", "aiCheckUeberholt"],
  ],
  [
    "services/knowledge-object/src/repo-pg.ts",
    [
      "CREATE TABLE IF NOT EXISTS ko_versions",
      "KO_EVIDENCE_SCHEMA",
      "KO_SICHTBARKEIT_SCHEMA",
      "KO_IMPORT_ANCHOR_SCHEMA",
      "ko_schreibstand",
    ],
  ],
  ["services/knowledge-object/src/kanten-repo-pg.ts", ["CREATE TABLE IF NOT EXISTS ko_kanten ("]],
  ["services/knowledge-object/src/kanten-types.ts", ["export interface BeurteilterStand"]],
  ["services/knowledge-object/src/kanten-service.ts", ["export type KantenAbweichung"]],
  ["services/conflicts/src/repo-pg.ts", ["CREATE TABLE IF NOT EXISTS conflicts"]],
  ["services/conflicts/src/overlap-repo-pg.ts", ["CREATE TABLE IF NOT EXISTS ko_overlaps"]],
  ["services/conflicts/src/coverage.ts", ["export function isCompleteRun"]],
  ["services/rbac/src/policy.ts", ['"ko.validate"', '"conflict.resolve"', '"ko.relate"']],
  ["services/provenance/src/project.ts", ["MAX_PROVENANCE_NODES"]],
];

function subjekt(refId: string, over: Partial<DetectSubject> = {}): DetectSubject {
  return {
    refId,
    title: "",
    statement: "",
    conditions: [],
    measures: [],
    category: "",
    tags: [],
    asset: null,
    ...over,
  };
}

describe("Istvertrag · Z — jede genannte Datei liegt im Bestand", () => {
  it("Z1: das Dokument nennt Dateien, und jede davon existiert", () => {
    const pfade = genanntePfade();
    expect(pfade.length).toBeGreaterThan(30);
    expect(pfade.filter((pfad) => !existsSync(pfad))).toEqual([]);
  });
});

describe("Istvertrag · F — die tragenden Stellen stehen in den genannten Dateien", () => {
  for (const [datei, zeichenfolgen] of FUNDSTELLEN) {
    it(`F: ${datei}`, () => {
      expect(lies(DOKUMENT)).toContain(datei);
      const quelle = lies(datei);
      expect(zeichenfolgen.filter((z) => !quelle.includes(z))).toEqual([]);
    });
  }

  it("F-Freigabe: der Validierungsdienst liest keinen KI-Prüfnachweis", () => {
    expect(lies("services/validation/src/service.ts")).not.toContain("aiCheck");
  });
});

describe("Istvertrag · K — die Kennzahlen des Dokuments sind die des Codes", () => {
  it("K1: Deckel 20, Vorschau 40, Prüfsumme 5", () => {
    expect(DETECTION_CANDIDATE_CAP).toBe(20);
    expect(CHECKSUM_CANDIDATE_CAP).toBe(5);
    const dokument = lies(DOKUMENT);
    expect(dokument).toContain("| `DETECTION_CANDIDATE_CAP` | 20,");
    expect(dokument).toContain("| `CANDIDATE_LIMIT` | 40,");
    expect(dokument).toContain("`CHECKSUM_CANDIDATE_CAP` = 5");
  });
});

describe("Istvertrag · V — Kandidatenlauf ist keine Vollprüfung", () => {
  it("V1: gedeckelter Lauf ist nie vollständig, auch wenn jeder Vergleich urteilte", () => {
    const gedeckelt = {
      ...emptyCoverage(),
      available: 100,
      selected: 20,
      attempted: 20,
      completed: 20,
      capped: true,
    };
    expect(isCompleteRun(gedeckelt)).toBe(false);
    expect(isCompleteRun({ ...gedeckelt, capped: false })).toBe(false);
    // Kalibrierung: dieselbe Regel sagt „vollständig", wenn wirklich alles angesehen wurde.
    expect(isCompleteRun({ ...gedeckelt, available: 20, capped: false })).toBe(true);
  });

  it("V2: Vorschau ohne Treffer meldet Kandidatenumfang ohne Nenner", async () => {
    const deps = {
      ko: { findCandidates: async () => [], searchProjectionOf: async () => undefined },
      conflicts: {},
    } as unknown as KnowledgeCheckDeps;
    const ergebnis = await checkKnowledge("Druckluftnetz im Werk Nord monatlich prüfen", deps);
    expect(ergebnis.status).toBe("pending");
    expect(ergebnis.coverage).toEqual({
      kind: "candidates",
      checked: 0,
      limit: 40,
      limitReached: false,
    });
  });

  it("V3: ohne Deckel filtert der Konfliktweg weiter — nur der Vollabgleich hebt den Filter auf", () => {
    const ich = subjekt("ich", { title: "Druckluft", statement: "Ventil prüfen", category: "A" });
    const nachbar = subjekt("nachbar", { title: "Kessel", statement: "Wasser", category: "A" });
    const fremd = subjekt("fremd", { title: "Urlaub", statement: "Antrag stellen", category: "B" });
    const pool = [ich, nachbar, fremd];
    const ohneDeckel = Number.POSITIVE_INFINITY;
    const dubletten = selectOverlapCandidates(ich, pool, ohneDeckel).map((s) => s.refId);
    const konflikte = selectCandidates(ich, pool, ohneDeckel).map((s) => s.refId);
    const voll = selectCandidates(ich, pool, ohneDeckel, false).map((s) => s.refId);
    expect([...dubletten].sort()).toEqual(["fremd", "nachbar"]);
    expect(konflikte).toEqual(["nachbar"]);
    // R-1124: im gewählten Vollabgleich ist jedes Objekt außer dem Subjekt Kandidat.
    expect([...voll].sort()).toEqual(["fremd", "nachbar"]);
  });
});
