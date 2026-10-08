// ================================================================================================
// AUFNAHME 20260922 · PRÜFUNG-GEDÄCHTNIS — „KEIN DOPPEL" (R-1103) UND FEHLALARM BLEIBT ZU (R-1105).
// ================================================================================================
//
// R-1103: Ein Gedächtnis merkt sich, welche Textstände schon geprüft wurden. So entsteht derselbe
//         Widerspruch nie zweimal als offener Fall, und nichts geht unnötig erneut an die KI.
// R-1105: Ist ein automatisch erkannter Widerspruch keiner, schließt man ihn mit Begründung.
//         Derselbe Vorschlag kommt nicht wieder, solange sich die Inhalte nicht ändern.
//
// Gemessen wird `ConflictService.detectForSubject` (die einzige Anlegestelle automatischer
// Konflikte) mit dem In-Memory-Gedächtnis, die Verdrahtung in der Kompositionswurzel samt
// Dev-Journal sowie die SQL-Form des Postgres-Gedächtnisses an einem Doppelgänger-Pool. Der echte
// Postgres-Fall steht in services/conflicts/src/repo-pg.integration.test.ts. NICHT gemessen: ein
// echtes Modell und die Bedienung im Board.
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { assembleServices, buildServices, inMemoryRepos } from "../../services/app/src/build-app";
import { detectConflictsForKo } from "../../services/app/src/conflict-detection";
import { schemas } from "../../services/app/src/db";
import {
  type JournalEntry,
  journaledRepos,
  replayJournal,
} from "../../services/app/src/dev-persist";
import {
  ConflictService,
  type ConflictVerdict,
  type DetectSubject,
  InMemoryConflictMemoryRepo,
  InMemoryConflictRepo,
  type PairMemoryEntry,
  PgConflictMemoryRepo,
  emptyCoverage,
  isCompleteRun,
  singleRunBalances,
} from "../../services/conflicts";
import { CONFLICTS_SCHEMA } from "../../services/conflicts/src/repo-pg";
import { BESTANDSRESET_LOESCHGRAPH } from "../../services/db-tx";
import type { Reasoner } from "../../services/reasoner";
import { pflichttabellenAusDrill, tabellenAusSchemas } from "../backup-drill/pflichtsatz";

function subject(id: string, farbe: string, version?: number): DetectSubject {
  return {
    refId: id,
    title: "Dienstwagen-Farbe",
    statement: `Wir bestellen alle Dienstwagen in der Farbe ${farbe}.`,
    conditions: [],
    measures: [],
    category: "Allgemein",
    tags: [],
    asset: null,
    ...(version !== undefined ? { version } : {}),
  };
}

const farbeIn = (text: string): string => /Farbe \p{L}+/u.exec(text)?.[0] ?? "";

// Fake-„Modell": Widerspruch mit wörtlich vorhandenen Zitaten (G-2 erfüllt).
const widerspruch = () =>
  vi.fn(
    async (a: string, b: string): Promise<ConflictVerdict | null> => ({
      relation: "widerspruch",
      older: null,
      confidence: 0.95,
      begruendung: "A und B legen eine andere verbindliche Farbe fest.",
      zitat_a: farbeIn(a),
      zitat_b: farbeIn(b),
    }),
  );

const KEIN_KONFLIKT: ConflictVerdict = {
  relation: "kein_konflikt",
  older: null,
  confidence: 0.9,
  begruendung: "Unterschiedlicher Geltungsbereich.",
  zitat_a: "",
  zitat_b: "",
};

function dienst(memory = new InMemoryConflictMemoryRepo()) {
  const repo = new InMemoryConflictRepo();
  return { repo, memory, service: new ConflictService({ repo, memory }) };
}

const rot = subject("ko-rot", "rot");
const blau = subject("ko-blau", "blau");

describe("R-1103 · gleiche Textstände gehen nicht erneut an die KI", () => {
  it("kein Widerspruch: der zweite Lauf über denselben Stand fragt die KI nicht erneut", async () => {
    const { service } = dienst();
    const judge = vi.fn(async () => KEIN_KONFLIKT);
    await service.detectForSubject(rot, [blau], judge);
    expect(judge).toHaveBeenCalledTimes(1);

    const coverage = emptyCoverage();
    const again = await service.detectForSubject(rot, [blau], judge, { coverage });
    expect(again).toHaveLength(0);
    expect(judge).toHaveBeenCalledTimes(1);
    // Angesehen (aus dem Gedächtnis), nicht vorgelegt — der Lauf bleibt ehrlich vollständig.
    expect(coverage).toMatchObject({ available: 1, selected: 1, alreadyOpen: 1, attempted: 0 });
    expect(isCompleteRun(coverage)).toBe(true);
    expect(singleRunBalances(coverage)).toBe(true);
  });

  it("das Paar ist dasselbe, gleich welche Seite geprüft wird", async () => {
    const { service } = dienst();
    const judge = vi.fn(async () => KEIN_KONFLIKT);
    await service.detectForSubject(rot, [blau], judge);
    await service.detectForSubject(blau, [rot], judge);
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it("geänderter Text auf einer Seite → das Paar wird wieder geprüft", async () => {
    const { service } = dienst();
    const judge = vi.fn(async () => KEIN_KONFLIKT);
    await service.detectForSubject(rot, [blau], judge);
    await service.detectForSubject(subject("ko-rot", "grün"), [blau], judge);
    expect(judge).toHaveBeenCalledTimes(2);
  });

  it("ein entschiedener Widerspruch entsteht bei gleichem Stand nicht ein zweites Mal als offener Fall", async () => {
    const { service, repo } = dienst();
    const judge = widerspruch();
    const [befund] = await service.detectForSubject(rot, [blau], judge);
    // R-0215/R-1714: ein Wahrheitskonflikt wird erst eskaliert, dann entschieden.
    await service.escalate(befund?.id ?? "", "controller-1");
    const entschieden = await service.resolve(befund?.id ?? "", "controller-1", "Rot gilt.");
    expect(entschieden).toMatchObject({ status: "geloest", resolutionReason: "decided" });

    const again = await service.detectForSubject(rot, [blau], judge);
    expect(again).toHaveLength(0);
    expect(judge).toHaveBeenCalledTimes(1);
    expect(await service.badgeCount()).toBe(0);
    expect(await repo.all()).toHaveLength(1);
  });

  it("eine verworfene Modellantwort und ein Modellausfall sind kein Urteil — sie werden nicht gemerkt", async () => {
    const { service } = dienst();
    const erfunden = vi.fn(
      async (): Promise<ConflictVerdict | null> => ({
        ...KEIN_KONFLIKT,
        relation: "widerspruch",
        confidence: 0.95,
        zitat_a: "kommt nicht vor",
        zitat_b: "auch nicht",
      }),
    );
    await service.detectForSubject(rot, [blau], erfunden);
    await service.detectForSubject(rot, [blau], erfunden);
    expect(erfunden).toHaveBeenCalledTimes(2);

    const ausfall = vi.fn(async () => null);
    await service.detectForSubject(rot, [blau], ausfall);
    await service.detectForSubject(rot, [blau], ausfall);
    expect(ausfall).toHaveBeenCalledTimes(2);
  });

  it("ein systemisch beendeter Befund (überholte Fassung) unterdrückt nichts", async () => {
    const { service } = dienst();
    const judge = widerspruch();
    const blau1 = subject("ko-blau", "blau", 1);
    await service.detectForSubject(subject("ko-rot", "rot", 1), [blau1], judge);
    await service.onKoRevised("ko-rot", 2);
    const neu = await service.detectForSubject(subject("ko-rot", "rot", 2), [blau1], judge);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(neu).toHaveLength(1);
  });

  it("das Gedächtnis hält nur Kennungen und einen Fingerabdruck — keinen Text", async () => {
    const { service, memory } = dienst();
    await service.detectForSubject(
      rot,
      [blau],
      vi.fn(async () => KEIN_KONFLIKT),
    );
    const [eintrag] = await memory.find(["ko:ko-blau|ko:ko-rot"]);
    expect(eintrag).toMatchObject({ pairKey: "ko:ko-blau|ko:ko-rot", outcome: "none" });
    expect(eintrag?.stand).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(eintrag)).not.toMatch(/Dienstwagen|Farbe|bestellen/);
  });

  it("ein Gedächtnisfehler kippt die Erkennung nicht und bleibt sichtbar", async () => {
    const kaputt = new InMemoryConflictMemoryRepo();
    kaputt.find = () => Promise.reject(new Error("lesen kaputt"));
    kaputt.put = () => Promise.reject(new Error("schreiben kaputt"));
    const onError = vi.fn();
    const service = new ConflictService({
      repo: new InMemoryConflictRepo(),
      memory: kaputt,
      onError,
    });
    const created = await service.detectForSubject(rot, [blau], widerspruch());
    expect(created).toHaveLength(1);
    expect(onError).toHaveBeenCalled();
  });
});

describe("R-1105 · Fehlalarm begründet schließen — derselbe Vorschlag kommt nicht wieder", () => {
  it("Fehlalarm mit Begründung: bei unveränderten Inhalten keine Wiederanlage, nach Änderung wieder prüfbar", async () => {
    const { service } = dienst();
    const judge = widerspruch();
    const [befund] = await service.detectForSubject(rot, [blau], judge);
    expect(befund?.origin).toBe("auto");
    const grund = "Anderer Standort.";
    const geschlossen = await service.dismiss(befund?.id ?? "", "controller-1", grund);
    expect(geschlossen).toMatchObject({
      status: "geloest",
      resolutionReason: "dismissed",
      decision: grund,
    });

    // Von beiden Seiten, mehrfach: kein neuer Fall, kein neuer KI-Aufruf.
    expect(await service.detectForSubject(rot, [blau], judge)).toHaveLength(0);
    expect(await service.detectForSubject(blau, [rot], judge)).toHaveLength(0);
    expect(judge).toHaveBeenCalledTimes(1);
    expect(await service.badgeCount()).toBe(0);

    // Inhalt ändert sich → der Vorschlag darf wieder kommen.
    const neu = await service.detectForSubject(subject("ko-rot", "grün"), [blau], judge);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(neu).toHaveLength(1);
    expect(await service.badgeCount()).toBe(1);
  });

  it("Altbefund ohne gemerkten Stand: der Fehlalarm gilt über die Versionsbindung beider Seiten", async () => {
    const service = new ConflictService({ repo: new InMemoryConflictRepo() });
    const judge = widerspruch();
    const a1 = subject("ko-rot", "rot", 1);
    const b1 = subject("ko-blau", "blau", 1);
    const [befund] = await service.detectForSubject(a1, [b1], judge);
    await service.dismiss(befund?.id ?? "", "controller-1", "Kein Widerspruch.");

    expect(await service.detectForSubject(a1, [b1], judge)).toHaveLength(0);
    expect(judge).toHaveBeenCalledTimes(1);

    const neu = await service.detectForSubject(subject("ko-rot", "grün", 2), [b1], judge);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(neu).toHaveLength(1);
  });
});

describe("Verdrahtung · Kompositionswurzel, Dev-Journal und Postgres-Form", () => {
  const KO = { type: "best_practice" as const, category: "Fuhrpark", author: "u1" };
  const fakeReasoner = () => {
    const judgeConflictOutcome = vi.fn(async () => ({ verdict: KEIN_KONFLIKT }));
    return { judgeConflictOutcome, reasoner: { judgeConflictOutcome } as unknown as Reasoner };
  };

  it("der Live-Weg (detectConflictsForKo) nutzt das Gedächtnis der App", async () => {
    const services = buildServices();
    await services.ko.create({ ...KO, title: "Dienstwagen", statement: "Dienstwagen sind blau." });
    const neu = await services.ko.create({
      ...KO,
      title: "Dienstwagen",
      statement: "Dienstwagen sind rot.",
    });
    const { judgeConflictOutcome, reasoner } = fakeReasoner();
    const deps = { ko: services.ko, conflicts: services.conflicts, reasoner };
    await detectConflictsForKo(neu.id, deps);
    await detectConflictsForKo(neu.id, deps);
    expect(judgeConflictOutcome).toHaveBeenCalledTimes(1);
  });

  it("das Gedächtnis überlebt den Dev-Journal-Wiederaufbau", async () => {
    const zeilen: JournalEntry[] = [];
    const vorher = assembleServices(journaledRepos(inMemoryRepos(), (e) => zeilen.push(e)));
    await vorher.ko.create({ ...KO, title: "Dienstwagen", statement: "Dienstwagen sind blau." });
    const neu = await vorher.ko.create({
      ...KO,
      title: "Dienstwagen",
      statement: "Dienstwagen sind rot.",
    });
    const erst = fakeReasoner();
    await detectConflictsForKo(neu.id, {
      ko: vorher.ko,
      conflicts: vorher.conflicts,
      reasoner: erst.reasoner,
    });
    expect(erst.judgeConflictOutcome).toHaveBeenCalledTimes(1);
    expect(zeilen.some((z) => z.repo === "conflictMemory" && z.method === "put")).toBe(true);

    const repos = inMemoryRepos();
    await replayJournal(
      repos,
      zeilen.map((entry, i) => ({ lineNumber: i + 1, entry })),
    );
    const nachher = assembleServices(repos);
    const zweit = fakeReasoner();
    await detectConflictsForKo(neu.id, {
      ko: nachher.ko,
      conflicts: nachher.conflicts,
      reasoner: zweit.reasoner,
    });
    expect(zweit.judgeConflictOutcome).not.toHaveBeenCalled();
  });

  // Die Gedächtnistabelle wird migriert, vom Restore-Drill geprüft und vom Bestandsreset gelöscht.
  // Gezielt nur für diese Tabelle: der Gesamtabgleich (tests/backup-drill/tabellensatz.test.ts)
  // ist an der Basis wegen zweier fremder Management-Tabellen rot und gehört nicht zu R-1103/R-1105.
  it("Ablage: conflict_pair_memory wird migriert, im Drill geprüft und im Reset gelöscht", () => {
    expect(tabellenAusSchemas(schemas)).toContain("conflict_pair_memory");
    expect(pflichttabellenAusDrill()).toContain("conflict_pair_memory");
    expect(BESTANDSRESET_LOESCHGRAPH).toContain("conflict_pair_memory");
  });

  it("Postgres: Tabelle in der Konflikt-Stufe, EIN Abruf je Lauf, Upsert je Paar", async () => {
    expect(CONFLICTS_SCHEMA).toContain("CREATE TABLE IF NOT EXISTS conflict_pair_memory");
    const eintrag: PairMemoryEntry = {
      pairKey: "ko:a|ko:b",
      stand: "f".repeat(64),
      outcome: "dismissed",
      conflictId: "c1",
      at: "2026-10-08T00:00:00.000Z",
    };
    const aufrufe: { text: string; values: unknown[] }[] = [];
    const pool = {
      query: async (text: string, values: unknown[]) => {
        aufrufe.push({ text, values });
        return { rows: [{ data: eintrag }], rowCount: 1 };
      },
    } as unknown as Pool;
    const repo = new PgConflictMemoryRepo(pool);

    expect(await repo.find([])).toEqual([]);
    expect(aufrufe).toHaveLength(0);
    expect(await repo.find(["ko:a|ko:b", "ko:a|ko:b", "ko:a|ko:c"])).toEqual([eintrag]);
    expect(aufrufe[0]?.text).toContain("pair_key = ANY($1::text[])");
    expect(aufrufe[0]?.values).toEqual([["ko:a|ko:b", "ko:a|ko:c"]]);

    await repo.put(eintrag);
    expect(aufrufe[1]?.text).toContain("ON CONFLICT (pair_key) DO UPDATE");
    expect(aufrufe[1]?.values).toEqual(["ko:a|ko:b", JSON.stringify(eintrag)]);
  });
});
