// ================================================================================================
// AUFNAHME 20260922 · NEGATIVWISSEN-HINWEIS (R-1629) — DIE AUSKUNFT DES LIVE-CHECKS.
// ================================================================================================
//
// Originalpunkt (Roadmap 2.3): „Wenn jemand eine Lösung vorschlägt, die in der
// Negativwissens-Bibliothek bereits als ‚haben wir probiert, ging nicht' dokumentiert ist, blendet
// KLARWERK das proaktiv ein — bevor der Fehler ein zweites Mal gemacht wird."
//
// Diese Datei misst die Serverhälfte: `checkKnowledge` weist ähnliche Einträge der Wissensart
// „negativwissen" gesondert aus — auch ohne Widerspruchsprüfung, auch wenn andere Treffer vorne
// stehen, nie an Sichtbarkeit oder Vertraulichkeit vorbei, und ohne Treffer zeichengleich wie bisher.
// Die Anzeige im Blatt misst `hinweis-im-blatt.test.tsx` daneben.
import { describe, expect, it } from "vitest";
import { checkKnowledge } from "../../services/app/src/knowledge-check";
import {
  ConflictService,
  type ConflictVerdict,
  InMemoryConflictRepo,
  trigramSimilarity,
} from "../../services/conflicts";
import type { KnowledgeObject, KoService } from "../../services/knowledge-object";

function ko(over: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "x",
    title: "",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...over,
  };
}

function fakeKo(candidates: KnowledgeObject[]): KoService {
  return { findCandidates: async () => candidates } as unknown as KoService;
}

const conflicts = () => new ConflictService({ repo: new InMemoryConflictRepo() });

// Der Vorschlag im Entwurf und der dokumentierte Fehlschlag dazu.
const ENTWURF = "Pumpe P3 bei Frost mit einem Heizband am Saugstutzen schützen.";
const FEHLSCHLAG = ko({
  id: "nw-p3",
  type: "negativwissen",
  title: "Heizband am Saugstutzen der Pumpe P3",
  statement:
    "Pumpe P3 bei Frost mit Heizband am Saugstutzen schützen: probiert, ging nicht — die Leitung friert oberhalb ein.",
  category: "Pumpen",
  status: "validiert",
});

describe("NEGATIVWISSEN-HINWEIS · Auskunft des Live-Checks", () => {
  it("N0 · Vorbedingung: der Testbestand liegt wirklich über der Ähnlichkeitsschwelle", () => {
    // Ohne diese Zusicherung könnte N1 aus dem falschen Grund grün oder rot sein.
    const nah = trigramSimilarity(ENTWURF, `${FEHLSCHLAG.title} ${FEHLSCHLAG.statement}`);
    expect(nah).toBeGreaterThanOrEqual(0.18);
  });

  it("N1 · ähnlicher Fehlschlag ohne Widerspruchsprüfung (pending): Titel, Grund und Fundort reisen mit", async () => {
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKo([FEHLSCHLAG]),
      conflicts: conflicts(),
      judge: null,
    });
    expect(res.status).toBe("pending");
    expect(res.negativwissen).toEqual([
      {
        id: "nw-p3",
        title: "Heizband am Saugstutzen der Pumpe P3",
        statement: FEHLSCHLAG.statement,
        score: expect.any(Number),
        koStatus: "validiert",
        koCategory: "Pumpen",
      },
    ]);
    expect(res.negativwissen?.[0]?.score).toBeGreaterThanOrEqual(0.18);
  });

  it("N2 · auch hinter stärkeren Treffern: der Fehlschlag wird gesondert ausgewiesen", async () => {
    // Fünf Einträge mit wortgleicher Aussage füllen `similar` vorne; der Fehlschlag stünde dort
    // höchstens auf einem hinteren Platz, den die Fläche nicht zeigt.
    const vorne = [1, 2, 3, 4, 5].map((n) =>
      ko({ id: `bp-${n}`, title: "", statement: ENTWURF, type: "best_practice" }),
    );
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKo([...vorne, FEHLSCHLAG]),
      conflicts: conflicts(),
      judge: null,
    });
    expect(res.similar[0]?.id).not.toBe("nw-p3");
    expect(res.similar.map((s) => s.id)).not.toContain("nw-p3");
    expect(res.negativwissen?.map((n) => n.id)).toEqual(["nw-p3"]);
  });

  it("N3 · mit Widerspruchsprüfung (done) steht der Hinweis ebenso da", async () => {
    const judge = async (): Promise<ConflictVerdict | null> => null;
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKo([FEHLSCHLAG]),
      conflicts: conflicts(),
      judge,
    });
    expect(res.status).toBe("done");
    expect(res.negativwissen?.map((n) => n.id)).toEqual(["nw-p3"]);
  });

  it("N4 · ohne Treffer bleibt die Antwort zeichengleich: das Feld fehlt", async () => {
    // a) ähnlicher Eintrag, aber KEIN Negativwissen
    const gleich = ko({ ...FEHLSCHLAG, id: "bp", type: "best_practice" });
    const a = await checkKnowledge(ENTWURF, {
      ko: fakeKo([gleich]),
      conflicts: conflicts(),
      judge: null,
    });
    expect(a.similar.map((s) => s.id)).toContain("bp");
    expect("negativwissen" in a).toBe(false);
    expect(Object.keys(a).sort()).toEqual(["conflicts", "coverage", "similar", "status"]);
    // b) Negativwissen, aber thematisch fern (unter der Schwelle)
    const fern = ko({
      id: "nw-kaffee",
      type: "negativwissen",
      title: "Kaffeeküche",
      statement: "Milch im Wasserkocher erhitzen ging nicht.",
    });
    const b = await checkKnowledge(ENTWURF, {
      ko: fakeKo([fern]),
      conflicts: conflicts(),
      judge: null,
    });
    expect("negativwissen" in b).toBe(false);
    // c) zu kurzer Text: es lief nichts, es wird nichts behauptet
    const c = await checkKnowledge("Heizband", {
      ko: fakeKo([FEHLSCHLAG]),
      conflicts: conflicts(),
    });
    expect("negativwissen" in c).toBe(false);
  });

  it("N5 · kein Kanal an Sichtbarkeit und Vertraulichkeit vorbei", async () => {
    const unsichtbar = await checkKnowledge(ENTWURF, {
      ko: fakeKo([FEHLSCHLAG]),
      conflicts: conflicts(),
      judge: null,
      sichtbar: (k) => k.id !== "nw-p3",
    });
    expect("negativwissen" in unsichtbar).toBe(false);

    const vertraulich = await checkKnowledge(ENTWURF, {
      ko: fakeKo([{ ...FEHLSCHLAG, confidentiality: "vertraulich" } as KnowledgeObject]),
      conflicts: conflicts(),
      judge: null,
    });
    expect("negativwissen" in vertraulich).toBe(false);
  });

  it("N6 · lange Begründung wird gekürzt, höchstens drei Treffer, stärkster zuerst", async () => {
    // Der lange Eintrag wiederholt den Vorschlag — er wird lang, ohne an Nähe zu verlieren.
    const lang = ko({
      ...FEHLSCHLAG,
      id: "nw-lang",
      statement: `${FEHLSCHLAG.statement} ${`${ENTWURF} `.repeat(10)}`,
    });
    // Drei schwächere: dieselbe Aussage mit eigenem Zusatz — über der Schwelle, unter `lang`.
    const schwaecher = [
      "Zusätzlich wurde die Isolierung der gesamten Rohrleitung erneuert und dokumentiert.",
      "Auch ein zweites Heizband an der Druckseite brachte im Januar keine Verbesserung.",
      "Die Thermostatsteuerung des Heizbands schaltete bei Nebel regelmäßig zu spät.",
    ].map((zusatz, n) =>
      ko({ ...FEHLSCHLAG, id: `nw-${n + 1}`, statement: `${FEHLSCHLAG.statement} ${zusatz}` }),
    );
    const pool = [...schwaecher, lang];
    for (const k of pool) {
      // Vorbedingung wie N0: alle vier tragen die Schwelle, sonst misst der Deckel nichts.
      expect(trigramSimilarity(ENTWURF, `${k.title} ${k.statement}`)).toBeGreaterThanOrEqual(0.18);
    }
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKo(pool),
      conflicts: conflicts(),
      judge: null,
    });
    const liste = res.negativwissen ?? [];
    expect(liste).toHaveLength(3);
    const scores = liste.map((n) => n.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    expect(liste[0]?.id).toBe("nw-lang");
    expect(lang.statement.length).toBeGreaterThan(280);
    expect(liste[0]?.statement.length).toBeLessThanOrEqual(280);
    expect(liste[0]?.statement.endsWith("…")).toBe(true);
    expect(liste[0]?.statement.startsWith("Pumpe P3 bei Frost")).toBe(true);
  });
});
