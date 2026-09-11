// ================================================================================================
// JOB 3574 · DER MESSSTAND FÜR DIE SUCHWÖRTER DES LIVE-CHECKS — DIE ECHTE KETTE, KEIN DOPPEL.
// ================================================================================================
//
// Warum ein eigener Aufbau neben `services/app/src/knowledge-check.test.ts`: der dortige Fake
// (`findCandidates: async () => candidates`, :46-48) wirft das Feld `terms` WEG. Genau das ist die
// Blindstelle, die dieser Auftrag misst — mit ihm gemessen wäre jede Aussage über die Wortauswahl
// eine Aussage über den Fake, nicht über das Produkt.
//
// Hier läuft deshalb: echter `KoService` auf `InMemoryKoRepo` samt `activateSearchProjectionV2()`
// (Aufbau wie `services/knowledge-object/src/repo-candidates.test.ts:19-26`), echter
// `ConflictService` auf `InMemoryConflictRepo`, und `checkKnowledge` aus dem Produktpfad.
//
// Der LAUSCHER ist ein Proxy AM DIENST: er schreibt die Wortliste mit, die `checkKnowledge`
// wirklich übergibt, und reicht den Aufruf unverändert an den echten Dienst weiter. Die
// Auswahlregel wird dabei nirgends nachgebaut — was hier steht, ist das, was lief.
import type {
  DraftConflictJudge,
  KnowledgeCheckResult,
} from "../../services/app/src/knowledge-check";
import { checkKnowledge } from "../../services/app/src/knowledge-check";
import {
  ConflictService,
  type ConflictVerdict,
  InMemoryConflictRepo,
} from "../../services/conflicts";
import {
  InMemoryKoRepo,
  type KnowledgeObject,
  type KoCandidateQuery,
  KoService,
} from "../../services/knowledge-object";

export interface BestandsEintrag {
  title: string;
  statement: string;
  category?: string;
  tags?: string[];
}

/** Ein echter KoService mit freigegebener Suchprojektion und den übergebenen Bestandsobjekten. */
export async function bestand(eintraege: BestandsEintrag[]): Promise<KoService> {
  const dienst = new KoService({ repo: new InMemoryKoRepo() });
  // Wie repo-candidates.test.ts:19-26: die Suche ist fail-closed, ein direkter Aufbau ohne diese
  // Freigabe wäre eine nicht in Betrieb genommene Instanz.
  await dienst.activateSearchProjectionV2();
  for (const eintrag of eintraege) {
    const ko = await dienst.create({
      title: eintrag.title,
      statement: eintrag.statement,
      type: "best_practice",
      category: eintrag.category ?? "Anlage 1",
      tags: eintrag.tags ?? [],
      author: "anna",
    });
    await dienst.setValidationState(ko.id, { trust: 90, status: "validiert" });
  }
  return dienst;
}

/**
 * Der Zwischenlauscher: derselbe Dienst, nur mit Mitschrift der Vorauswahl-Aufrufe. Kein Nachbau
 * der Regel — `terme` ist wörtlich das Feld, mit dem `checkKnowledge` den Dienst gerufen hat.
 */
export function lauscher(dienst: KoService): {
  ko: KoService;
  terme: string[][];
  kandidaten: string[][];
} {
  const terme: string[][] = [];
  const kandidaten: string[][] = [];
  const ko = new Proxy(dienst, {
    get(ziel, name, empfaenger) {
      if (name === "findCandidates") {
        return async (query: KoCandidateQuery): Promise<KnowledgeObject[]> => {
          terme.push([...query.terms]);
          const treffer = await ziel.findCandidates(query);
          kandidaten.push(treffer.map((k) => k.id));
          return treffer;
        };
      }
      const wert = Reflect.get(ziel, name, empfaenger);
      return typeof wert === "function" ? wert.bind(ziel) : wert;
    },
  });
  return { ko, terme, kandidaten };
}

/** Spy-Judge wie knowledge-check.test.ts:60-70 — er zählt JEDEN Aufruf (der Egress-Pfad). */
export function spyJudge(verdict: ConflictVerdict | null = null): {
  judge: DraftConflictJudge;
  calls: () => number;
} {
  let n = 0;
  return {
    judge: async () => {
      n += 1;
      return verdict;
    },
    calls: () => n,
  };
}

export interface Messung {
  /** a) die an findCandidates übergebene Wortliste */
  terme: string[];
  /** b) die Zahl der gefundenen Kandidaten */
  kandidaten: number;
  kandidatenIds: string[];
  /** c) similar / conflicts / status */
  similar: string[];
  conflicts: string[];
  status: KnowledgeCheckResult["status"];
  /** d) die Zahl der Judge-Aufrufe */
  judgeAufrufe: number;
}

/** Ein voller Lauf der echten Kette über einen Entwurfstext. */
export async function miss(dienst: KoService, text: string): Promise<Messung> {
  const horcher = lauscher(dienst);
  const spy = spyJudge(null);
  const res = await checkKnowledge(text, {
    ko: horcher.ko,
    conflicts: new ConflictService({ repo: new InMemoryConflictRepo() }),
    judge: spy.judge,
  });
  return {
    terme: horcher.terme[0] ?? [],
    kandidaten: (horcher.kandidaten[0] ?? []).length,
    kandidatenIds: horcher.kandidaten[0] ?? [],
    similar: res.similar.map((s) => s.id),
    conflicts: res.conflicts.map((c) => c.id),
    status: res.status,
    judgeAufrufe: spy.calls(),
  };
}
