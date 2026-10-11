// R-0194 (Pedis Entscheidung 95a8fe64): die Ähnlichkeitsprüfsumme als vierte Kandidatenquelle.
// Je Originalkriterium ein Block — K1 Regressionsfall, K2 fremder Eintrag, K3 Pflege und Ausschlüsse,
// K4 kein Textabfluss (Quelle), K5 Herkunft in der Prüfansicht.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { OverlapEntry as WebOverlapEntry } from "../../apps/web/src/api/types";
import { kandidatenQuellen } from "../../apps/web/src/lib/duplicateCompare";
import r0194Texte from "../../apps/web/src/texte/r0194";
import { DETECTION_CANDIDATE_CAP } from "../../services/app/src/detection-cap";
import {
  type DuplicateDetectionDeps,
  detectDuplicatesForKo,
} from "../../services/app/src/duplicate-detection";
import {
  CHECKSUM_MIN_SIMILARITY,
  type DetectSubject,
  type DetectionCoverage,
  InMemoryOverlapRepo,
  OverlapService,
  type OverlapVerdict,
  SimilarityChecksumIndex,
  checksumSimilarity,
  emptyCoverage,
  selectChecksumCandidates,
  similarityChecksum,
} from "../../services/conflicts";
import { selectOverlapCandidates } from "../../services/conflicts/src/duplicate-detect";
import type { KnowledgeObject } from "../../services/knowledge-object";
import { singleRunBalances } from "../support/abdeckung-buchhaltung";

function subject(
  refId: string,
  title: string,
  statement: string,
  conditions: string[],
  measures: string[],
  version?: number,
): DetectSubject {
  return {
    refId,
    title,
    statement,
    conditions,
    measures,
    tags: [],
    ...(version !== undefined ? { version } : {}),
  };
}

const S = subject(
  "ko-s",
  "Kreiselpumpe Lagerschaden vermeiden",
  "Lagertemperatur täglich protokollieren. Schmierfett alle 500 Betriebsstunden nachfüllen.",
  ["Dauerbetrieb oberhalb vierzig Grad Celsius"],
  ["Fettpresse mit Kennzeichnung blau verwenden"],
);
// Dieselben Sätze, umgestellt und über die Felder verschoben (Titel ↔ Maßnahme, Bedingung ↔ Titel).
const N = subject(
  "ko-n",
  "Fettpresse mit Kennzeichnung blau verwenden",
  "Schmierfett alle 500 Betriebsstunden nachfüllen. Lagertemperatur täglich protokollieren.",
  ["Kreiselpumpe: Lagerschaden vermeiden"],
  ["Dauerbetrieb oberhalb vierzig Grad Celsius"],
);
// Wie N, zusätzlich leicht verändert (ein Wort ersetzt).
const N2 = subject(
  "ko-n2",
  "Fettpresse mit Kennzeichnung blau verwenden",
  "Schmierfett alle 500 Betriebsstunden nachfüllen. Lagertemperatur stündlich protokollieren.",
  ["Kreiselpumpe: Lagerschaden vermeiden"],
  ["Dauerbetrieb oberhalb vierzig Grad Celsius"],
);
// Gleicher Titel, gleiche Aussage, sonst nichts: Trigrammdeckung 0,7 — sie füllen den Deckel.
const FUELLER = Array.from({ length: 25 }, (_, i) =>
  subject(`ko-f${String(i + 1).padStart(2, "0")}`, S.title, S.statement, [], []),
);
// Inhaltlich fremd: kein tragendes Wort gemeinsam mit S.
const FREMD = subject(
  "ko-x",
  "Urlaubsantrag rechtzeitig einreichen",
  "Formular beim Personalbüro abgeben. Genehmigung durch Vorgesetzte abwarten.",
  ["Resturlaub aus Vorjahr beachten"],
  ["Kalendereintrag für Abwesenheit anlegen"],
);

const GEMEINSAM = "Schmierfett alle 500 Betriebsstunden nachfüllen";
const teilweise: OverlapVerdict = {
  beziehung: "teilweise",
  aspects: [{ beschreibung: "Schmierintervall", zitatA: GEMEINSAM, zitatB: GEMEINSAM }],
  nurInA: "",
  nurInB: "",
  empfehlung: "zusammenfuehren_pruefen",
  confidence: 0.9,
  begruendung: "Dieselben Anweisungen in anderer Ordnung.",
};
const verschieden: OverlapVerdict = {
  ...teilweise,
  beziehung: "verschieden",
  aspects: [],
  empfehlung: "getrennt_lassen",
  begruendung: "Kein gemeinsamer Inhalt.",
};
// Urteilt „teilweise" nur über die umgestellten Fassungen (nur sie tragen „Fettpresse").
const judge = vi.fn(async (_a: string, b: string): Promise<OverlapVerdict> => {
  return b.includes("Fettpresse") ? teilweise : verschieden;
});

const lies = (pfad: string): string =>
  readFileSync(fileURLToPath(new URL(pfad, import.meta.url)), "utf8");

describe("K1: umgestellter/leicht veränderter Eintrag erscheint über die Prüfsumme (Regressionsfall)", () => {
  const pool = [...FUELLER, N, N2];

  it("vorher rot: die Trigramm-Vorauswahl unter dem Deckel erreicht N und N2 nicht", () => {
    const ids = selectOverlapCandidates(S, pool, DETECTION_CANDIDATE_CAP).map((c) => c.refId);
    expect(ids).toHaveLength(DETECTION_CANDIDATE_CAP);
    expect(ids).not.toContain("ko-n");
    expect(ids).not.toContain("ko-n2");
  });

  it("die Prüfsumme schätzt N (gleiche Wortmenge) mit 1 und N2 über der Schwelle", () => {
    const s = similarityChecksum(S);
    const n = similarityChecksum(N);
    const n2 = similarityChecksum(N2);
    expect(s && n && n2).toBeTruthy();
    if (!s || !n || !n2) {
      return;
    }
    expect(checksumSimilarity(s, n)).toBe(1);
    expect(checksumSimilarity(s, n2)).toBeGreaterThanOrEqual(CHECKSUM_MIN_SIMILARITY);
  });

  it("jetzt grün: der gedeckelte Lauf legt N und N2 zusätzlich vor — Befund mit Quelle Prüfsumme", async () => {
    judge.mockClear();
    const svc = new OverlapService({ repo: new InMemoryOverlapRepo() });
    const coverage: DetectionCoverage = emptyCoverage();
    const created = await svc.detectForSubject(S, pool, judge, {
      cap: DETECTION_CANDIDATE_CAP,
      coverage,
    });
    const judgedB = judge.mock.calls.map((call) => call[1]);
    expect(judgedB.some((core) => core.includes("stündlich"))).toBe(true);
    const n = created.find((e) => e.koB === "ko-n");
    const n2 = created.find((e) => e.koB === "ko-n2");
    expect(n?.detector?.candidateSources).toEqual(["pruefsumme"]);
    expect(n?.detector?.checksumSimilarity).toBe(1);
    expect(n2?.detector?.candidateSources).toEqual(["pruefsumme"]);
    // Die genaue Prüfung bleibt die bestehende: Modellurteil mit wörtlich belegtem Zitat.
    expect(n?.detector?.method).toBe("model");
    expect(n?.aspects[0]?.zitatB).toBe(GEMEINSAM);
    expect(n?.status).toBe("offen");
    // Ehrliche Abdeckung: genau zwei Zusatzvergleiche, weiterhin gedeckelt, Buchhaltung stimmt.
    expect(coverage.attempted).toBe(DETECTION_CANDIDATE_CAP + 2);
    expect(coverage.capped).toBe(true);
    expect(singleRunBalances(coverage)).toBe(true);
  });

  it("kein Nachschlag für den Deckel: was der Trigramm-Rang ebenso nah sieht, bleibt abgeschnitten", async () => {
    const zwillinge = Array.from({ length: 25 }, (_, i) => ({ ...S, refId: `ko-z${i + 10}` }));
    const svc = new OverlapService({ repo: new InMemoryOverlapRepo() });
    const coverage: DetectionCoverage = emptyCoverage();
    await svc.detectForSubject(S, zwillinge, judge, { cap: DETECTION_CANDIDATE_CAP, coverage });
    expect(coverage.attempted).toBe(DETECTION_CANDIDATE_CAP);
  });
});

describe("K2: ein inhaltlich fremder Eintrag wird über die Prüfsumme nicht vorgeschlagen", () => {
  it("Ähnlichkeit weit unter der Schwelle, keine Prüfsummen-Kandidaten", () => {
    const s = similarityChecksum(S);
    const x = similarityChecksum(FREMD);
    if (!s || !x) {
      throw new Error("Prüfsumme fehlt");
    }
    expect(checksumSimilarity(s, x)).toBeLessThan(0.1);
    expect(selectChecksumCandidates(S, [FREMD], new SimilarityChecksumIndex())).toEqual([]);
  });

  it("Deckel 0 (nur die Prüfsumme schlägt vor): N wird verglichen, der fremde Eintrag nie", async () => {
    judge.mockClear();
    const svc = new OverlapService({ repo: new InMemoryOverlapRepo() });
    const created = await svc.detectForSubject(S, [FREMD, N], judge, { cap: 0 });
    expect(judge).toHaveBeenCalledTimes(1);
    expect(judge.mock.calls[0]?.[1]).toContain("Fettpresse");
    expect(created.map((e) => e.koB)).toEqual(["ko-n"]);
  });
});

describe("K3: Pflege bei Anlage, Änderung, Löschung; Demo-Seed und das Objekt selbst ausgeschlossen", () => {
  it("Anlage legt an, Änderung rechnet neu, Löschung entfernt", async () => {
    const checksums = new SimilarityChecksumIndex();
    const svc = new OverlapService({ repo: new InMemoryOverlapRepo(), checksums });
    const v1 = { ...S, version: 1 };
    await svc.detectForSubject(v1, [FREMD], judge, { cap: 0 });
    expect(checksums.get("ko-s")).toEqual(similarityChecksum(v1));

    const v2 = { ...FREMD, refId: "ko-s", version: 2 };
    await svc.detectForSubject(v2, [N], judge, { cap: 0 });
    expect(checksums.get("ko-s")).toEqual(similarityChecksum(v2));
    expect(checksums.get("ko-s")).not.toEqual(similarityChecksum(v1));

    await svc.onKoRemoved("ko-s");
    expect(checksums.has("ko-s")).toBe(false);
  });

  it("das Objekt selbst ist nie sein eigener Prüfsummen-Kandidat", () => {
    const found = selectChecksumCandidates(S, [S, N], new SimilarityChecksumIndex());
    expect(found.map((c) => c.subject.refId)).toEqual(["ko-n"]);
  });

  function ko(s: DetectSubject, demoSeed: boolean): KnowledgeObject {
    return {
      id: s.refId,
      title: s.title,
      statement: s.statement,
      conditions: s.conditions,
      measures: s.measures,
      tags: [],
      demoSeed,
    } as unknown as KnowledgeObject;
  }

  it("Demo-Seed bekommt keine Prüfsumme und wird nie vorgelegt — als Bestand wie als Subjekt", async () => {
    const svc = new OverlapService({ repo: new InMemoryOverlapRepo() });
    const demo = ko({ ...N, refId: "ko-demo" }, true);
    const all = [ko(S, false), demo, ko(N, false)];
    const judgeDuplicateOutcome = vi.fn(async () => ({ verdict: verschieden }));
    const deps = {
      ko: {
        get: async (id: string) => all.find((k) => k.id === id),
        list: async () => all,
      },
      overlaps: svc,
      reasoner: { judgeDuplicateOutcome },
      settings: { get: async () => null },
    } as unknown as DuplicateDetectionDeps;

    await detectDuplicatesForKo("ko-s", deps);
    // Nur N wird vorgelegt — weder der Demo-Seed noch das Objekt selbst.
    expect(judgeDuplicateOutcome).toHaveBeenCalledTimes(1);
    expect(svc.checksums.has("ko-s")).toBe(true);
    expect(svc.checksums.has("ko-n")).toBe(true);
    expect(svc.checksums.has("ko-demo")).toBe(false);

    await detectDuplicatesForKo("ko-demo", deps);
    expect(judgeDuplicateOutcome).toHaveBeenCalledTimes(1);
    expect(svc.checksums.has("ko-demo")).toBe(false);
  });

  // bens Befund (Nacharbeit 1): der App-Pfad kehrte bei leerem Vergleichspool vor detectForSubject
  // zurück — Anlage und Änderung des einzigen regulären Objekts pflegten dann keine Prüfsumme.
  function appLauf(bestand: () => KnowledgeObject[]): {
    svc: OverlapService;
    deps: DuplicateDetectionDeps;
    judgeDuplicateOutcome: ReturnType<typeof vi.fn>;
  } {
    const svc = new OverlapService({ repo: new InMemoryOverlapRepo() });
    const judgeDuplicateOutcome = vi.fn(async () => ({ verdict: verschieden }));
    const deps = {
      ko: {
        get: async (id: string) => bestand().find((k) => k.id === id),
        list: async () => bestand(),
      },
      overlaps: svc,
      reasoner: { judgeDuplicateOutcome },
      settings: { get: async () => null },
    } as unknown as DuplicateDetectionDeps;
    return { svc, deps, judgeDuplicateOutcome };
  }

  const sV1 = { ...S, version: 1 };
  const sV2 = { ...FREMD, refId: "ko-s", version: 2 };
  const versioniert = (s: DetectSubject, demoSeed: boolean): KnowledgeObject =>
    ({ ...ko(s, demoSeed), version: s.version }) as KnowledgeObject;

  async function lebenszyklus(weitere: KnowledgeObject[]): Promise<void> {
    let stand = versioniert(sV1, false);
    const { svc, deps, judgeDuplicateOutcome } = appLauf(() => [stand, ...weitere]);

    // Anlage
    await detectDuplicatesForKo("ko-s", deps);
    expect(svc.checksums.get("ko-s")).toEqual(similarityChecksum(sV1));

    // Inhaltsänderung: derselbe Datensatz, anderer Kerntext, version=2
    stand = versioniert(sV2, false);
    await detectDuplicatesForKo("ko-s", deps);
    expect(svc.checksums.get("ko-s")).toEqual(similarityChecksum(sV2));
    expect(svc.checksums.get("ko-s")).not.toEqual(similarityChecksum(sV1));

    expect(judgeDuplicateOutcome).not.toHaveBeenCalled();
    for (const demo of weitere) {
      expect(svc.checksums.has(demo.id)).toBe(false);
    }
  }

  it("App-Pfad, leerer Vergleichspool: Anlage legt an, Änderung rechnet neu — kein Modell", async () => {
    await lebenszyklus([]);
  });

  it("App-Pfad, nur weitere Demo-Seeds: Prüfsumme gepflegt, keine Demo-Prüfsumme, kein Modell", async () => {
    await lebenszyklus([
      versioniert({ ...N, refId: "ko-demo1" }, true),
      versioniert({ ...S, refId: "ko-demo2" }, true),
    ]);
  });
});

describe("K4: kein Text verlässt das System für die Prüfsumme (Quelleninspektion)", () => {
  const source = lies("../../services/conflicts/src/similarity-checksum.ts");

  it("einziger Import ist der modul-eigene Texthelfer; kein Netz, keine Umgebung", () => {
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(specifiers).toEqual(["./detect"]);
    expect(source).not.toMatch(/\bfetch\s*\(|https?:\/\/|process\.env|require\(/);
  });
});

describe("K5: die Prüfansicht zeigt die Kandidatenquelle; der Mensch entscheidet", () => {
  const entry = (patch: Partial<WebOverlapEntry>): WebOverlapEntry =>
    ({ id: "o1", koA: "a", koB: "b", origin: "auto", ...patch }) as WebOverlapEntry;

  it("Herkunft aus dem Befund; Altbefund → Text; von Hand gemeldet → keine Quelle", () => {
    const detector = { trigger: "validation", method: "model", lexicalScore: 0.4 } as const;
    expect(
      kandidatenQuellen(entry({ detector: { ...detector, candidateSources: ["pruefsumme"] } })),
    ).toEqual(["pruefsumme"]);
    expect(
      kandidatenQuellen(
        entry({ detector: { ...detector, candidateSources: ["text", "pruefsumme"] } }),
      ),
    ).toEqual(["text", "pruefsumme"]);
    expect(kandidatenQuellen(entry({ detector }))).toEqual(["text"]);
    expect(kandidatenQuellen(entry({ origin: "manual" }))).toBeNull();
  });

  const compareSource = lies("../../apps/web/src/pages/DuplicateCompare.tsx");

  // Seit der I18N-AUFTEILUNG (main) wohnen neue Texte im Textmodul `texte/r0194.ts`.
  it("alle vier Quellen sind in de/en/nl benannt, die Seite rendert Pille und Hinweis", () => {
    for (const q of ["metadaten", "text", "pruefsumme", "abschnitt"]) {
      for (const sprache of [r0194Texte.de, r0194Texte.en, r0194Texte.nl]) {
        expect(sprache[`r0194.quelle.${q}` as keyof typeof sprache]).toBeTruthy();
      }
    }
    expect(r0194Texte.de["r0194.quelle.pruefsumme"]).toBe("Prüfsumme");
    expect(compareSource).toContain("kandidatenQuellen(");
    expect(compareSource).toContain('kennung="quelle"');
    expect(compareSource).toContain("r0194.quelle.hinweis");
    // Die Vergleichsseite entscheidet nichts: keine Mutation, nur Lesen.
    expect(compareSource).not.toMatch(/useMutation|Mutation\(/);
  });
});
