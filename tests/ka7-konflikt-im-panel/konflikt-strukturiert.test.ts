// ================================================================================================
// JOB 3094 · KA7 — DER SERVER NENNT BEIDE STELLEN, UND ER SAGT, OB DIE KONFLIKTPRÜFUNG GELAUFEN IST.
// ================================================================================================
//
// Pedis Fall (05.09., CODEX-POC-ENTSCHEIDUNG-1): das Memo sagt „drei Tage“, die freigegebene Regelung
// „zwei Tage“. Das Word-Panel soll BEIDE Stellen zeigen — ohne zu parsen. Bis zu diesem Auftrag trug
// ein Konflikttreffer von `POST /api/check-text` nur `rationale` (EIN Satz des Modells); die beiden
// wörtlichen Zitate, die das Urteil längst enthält (`ConflictVerdict.zitat_a`/`zitat_b`,
// services/conflicts/src/detect.ts:41-42), kamen nie bis zur Antwort.
//
// ZWEITE LÜCKE, gemessen an der Route vor diesem Auftrag: `conflicts: []` sieht in JEDEM dieser Fälle
// gleich aus — Prüfung nicht angefordert (kein want:"deep"), vertraulich (deterministischer Rückfall),
// Modell nicht verfügbar, oder wirklich geprüft und nichts gefunden. Ein Panel, das daraus „keine
// Abweichung" macht, behauptet in drei von vier Fällen etwas, das niemand gemessen hat (Zustandsmodell
// §9 des Auftrags). Deshalb trägt die Antwort jetzt `konfliktpruefung` — gelaufen ja/nein, Grund, Zahl
// der dem Modell vorgelegten Quellen.
//
// GEMESSEN WIRD DIE ECHTE ROUTE mit dem ECHTEN Konfliktdienst (services/conflicts, Kandidatenwahl,
// Zitatprüfung `quotesVerbatim`, Schwelle) — nur das Modellurteil ist ein Doppelgänger, der schreibt,
// was ihm gezeigt wird, statt zu rechnen. Fassade und Aufbau wie in check-text-routes.test.ts.
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { Guards } from "../../services/app/src/http";
import { checkTextRoutes } from "../../services/app/src/routes/check-text-routes";
import {
  ConflictService,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
} from "../../services/conflicts";
import type { KnowledgeObject, KoService } from "../../services/knowledge-object";
import type { ConflictJudgeOutcome, Reasoner } from "../../services/reasoner";

// Pedis Beispiel. Die Stellen stehen WÖRTLICH in den Kerntexten — sonst verwirft die Zitatprüfung
// des Konfliktdienstes das Urteil als Halluzination, und genau das ist richtig so.
const REGEL_STATEMENT = "Homeoffice ist für alle Beschäftigten an zwei Tagen pro Woche möglich.";
const MEMO_TEXT = "Homeoffice ist für alle Beschäftigten an drei Tagen pro Woche möglich.";
const STELLE_EIGEN = "an drei Tagen pro Woche";
const STELLE_QUELLE = "an zwei Tagen pro Woche";

function regel(
  id: string,
  statement: string,
  extra: Partial<KnowledgeObject> = {},
): KnowledgeObject {
  return {
    id,
    title: "Homeoffice-Regelung",
    statement,
    status: "validiert",
    conditions: [],
    measures: [],
    tags: [],
    category: "Personal",
    asset: null,
    version: 3,
    ...extra,
  } as unknown as KnowledgeObject;
}

function fakeKo(seed: KnowledgeObject[], opts: { getLiefertNichts?: boolean } = {}) {
  return {
    list: vi.fn(async () => seed),
    findCandidates: vi.fn(async () => seed),
    get: vi.fn(async (id: string) =>
      opts.getLiefertNichts ? undefined : seed.find((k) => k.id === id),
    ),
  } as unknown as KoService;
}

const fakeGuards = {
  requireUser: async () => ({ id: "u1" }),
  requirePermission: async () => ({ id: "u1" }),
} as unknown as Guards;

const WIDERSPRUCH: ConflictJudgeOutcome = {
  verdict: {
    relation: "widerspruch",
    older: null,
    confidence: 0.95,
    begruendung: "A erlaubt drei Tage, B zwei.",
    zitat_a: STELLE_EIGEN,
    zitat_b: STELLE_QUELLE,
  },
};

interface Aufbau {
  app: ReturnType<typeof Fastify>;
  judgeConflictOutcome: ReturnType<typeof vi.fn>;
}

/** Ein Urteil je Aufruf — fest, oder je nach vorgelegter Quelle (Kerntext `b`), auch werfend. */
type Urteil = ConflictJudgeOutcome | ((a: string, b: string) => Promise<ConflictJudgeOutcome>);

async function aufbau(
  seed: KnowledgeObject[],
  urteil: Urteil = WIDERSPRUCH,
  koOpts: { getLiefertNichts?: boolean } = {},
): Promise<Aufbau> {
  const judgeConflictOutcome = vi.fn(async (a: string, b: string) =>
    typeof urteil === "function" ? urteil(a, b) : urteil,
  );
  const reasoner = {
    judgeConflictOutcome,
    judgeConflict: vi.fn(async (a: string, b: string) =>
      typeof urteil === "function" ? (await urteil(a, b)).verdict : urteil.verdict,
    ),
    judgeDuplicate: vi.fn(async () => null),
  } as unknown as Reasoner;
  const app = Fastify();
  await app.register(
    checkTextRoutes(
      {
        ko: fakeKo(seed, koOpts),
        overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
        reasoner,
        conflicts: new ConflictService({ repo: new InMemoryConflictRepo() }),
      },
      fakeGuards,
    ),
  );
  return { app, judgeConflictOutcome };
}

const DEEP = {
  text: MEMO_TEXT,
  title: "Homeoffice-Regelung",
  locale: "de",
  want: "deep",
  source: "transient-document",
  confidentiality: "intern",
};

async function pruefen(app: Aufbau["app"], payload: Record<string, unknown>) {
  const res = await app.inject({ method: "POST", url: "/api/check-text", payload });
  expect(res.statusCode).toBe(200);
  return res.json();
}

describe("KA7 · Server — die beiden Stellen reisen strukturiert mit (Lieferung 2)", () => {
  it("K1 · ein Konflikttreffer trägt `stellen.eigen` und `stellen.quelle` wörtlich aus dem Urteil — und behält alle bisherigen Felder", async () => {
    const { app } = await aufbau([regel("regel-1", REGEL_STATEMENT)]);
    const body = await pruefen(app, DEEP);

    expect(body.conflicts, "die Route hat den Widerspruch nicht als Konflikt geführt").toHaveLength(
      1,
    );
    const treffer = body.conflicts[0];
    // Das Neue: beide Stellen, strukturiert — das Panel parst nichts.
    expect(treffer.stellen).toEqual({ eigen: STELLE_EIGEN, quelle: STELLE_QUELLE });
    // Quelle: Titel, Version, Prüfstand — was das Panel neben den Stellen nennt (Lieferung 1).
    expect(treffer.koTitle).toBe("Homeoffice-Regelung");
    expect(treffer.version).toBe(3);
    expect(treffer.pruefstand).toBe("validiert");
    // Bestehende Felder bleiben (JOB 1970/3020): nichts wird ersetzt.
    expect(treffer.koId).toBe("regel-1");
    expect(treffer.type).toBe("truth");
    expect(treffer.method).toBe("model");
    expect(treffer.confidence).toBe(0.95);
    expect(treffer.rationale).toBe("A erlaubt drei Tage, B zwei.");
    expect(treffer.koStatus).toBe("validiert");
    expect(treffer.koCategory).toBe("Personal");
  });

  it("K2 · nach gelaufener Prüfung sagt `konfliktpruefung` das auch: gelaufen, kein Grund, eine vorgelegte Quelle", async () => {
    const { app, judgeConflictOutcome } = await aufbau([regel("regel-1", REGEL_STATEMENT)]);
    const body = await pruefen(app, DEEP);
    expect(body.konfliktpruefung).toEqual({
      gelaufen: true,
      grund: null,
      kandidaten: 1,
      ausgefallen: 0,
      verworfen: 0,
    });
    expect(judgeConflictOutcome).toHaveBeenCalledTimes(1);
    // Die Sprache des Fensters erreicht das Urteil (drittes Argument) — kein stilles „de“.
    expect(judgeConflictOutcome.mock.calls[0]?.[2]).toBe("de");
  });

  it('K3 · ohne want:"deep" ist die Konfliktprüfung NICHT gelaufen — die Antwort sagt es, statt leer zu schweigen', async () => {
    const { app, judgeConflictOutcome } = await aufbau([regel("regel-1", REGEL_STATEMENT)]);
    const { want: _want, ...ohneDeep } = DEEP;
    const body = await pruefen(app, ohneDeep);
    expect(body.conflicts).toEqual([]);
    expect(body.konfliktpruefung).toEqual({
      gelaufen: false,
      grund: "nicht_angefordert",
      kandidaten: 0,
      ausgefallen: 0,
      verworfen: 0,
    });
    expect(judgeConflictOutcome).not.toHaveBeenCalled();
  });

  it("K4 · vertraulicher Text: deterministischer Rückfall, Konfliktprüfung nicht gelaufen — Grund „vertraulich“", async () => {
    const { app, judgeConflictOutcome } = await aufbau([regel("regel-1", REGEL_STATEMENT)]);
    const body = await pruefen(app, { ...DEEP, confidentiality: "vertraulich" });
    expect(body.conflicts).toEqual([]);
    expect(body.konfliktpruefung).toEqual({
      gelaufen: false,
      grund: "vertraulich",
      kandidaten: 0,
      ausgefallen: 0,
      verworfen: 0,
    });
    expect(judgeConflictOutcome).not.toHaveBeenCalled();
    // Der bestehende Hinweis bleibt (SCRUM-502) — nichts wird durch das neue Feld ersetzt.
    expect(String(body.note)).toContain("deterministisch");
  });

  it("K5 · ohne Modell: eine Quelle wurde vorgelegt, kein Urteil kam — NICHT gelaufen, Grund „kein_modell“", async () => {
    const { app } = await aufbau([regel("regel-1", REGEL_STATEMENT)], {
      verdict: null,
      failure: "no-model",
    });
    const body = await pruefen(app, DEEP);
    expect(body.conflicts).toEqual([]);
    expect(body.konfliktpruefung).toEqual({
      gelaufen: false,
      grund: "kein_modell",
      kandidaten: 1,
      ausgefallen: 1,
      verworfen: 0,
    });
  });

  it("K5b · Modellfehler (Antwort unverwertbar): Grund „modellfehler“, nicht „kein Konflikt“", async () => {
    const { app } = await aufbau([regel("regel-1", REGEL_STATEMENT)], {
      verdict: null,
      failure: "model-error",
    });
    const body = await pruefen(app, DEEP);
    expect(body.konfliktpruefung).toEqual({
      gelaufen: false,
      grund: "modellfehler",
      kandidaten: 1,
      ausgefallen: 1,
      verworfen: 0,
    });
  });

  it("K6 · kein vergleichbarer Eintrag im Bestand: gelaufen mit null Kandidaten — das ist eine ehrliche Leere, keine Behauptung", async () => {
    const { app, judgeConflictOutcome } = await aufbau([]);
    const body = await pruefen(app, DEEP);
    expect(body.conflicts).toEqual([]);
    expect(body.konfliktpruefung).toEqual({
      gelaufen: true,
      grund: null,
      kandidaten: 0,
      ausgefallen: 0,
      verworfen: 0,
    });
    expect(judgeConflictOutcome).not.toHaveBeenCalled();
  });

  it("K7 · lässt sich die Quelle nicht nachladen, bleibt der Konflikt GENANNT — Stellen und Version sind dann null, nicht erfunden", async () => {
    const { app } = await aufbau([regel("regel-1", REGEL_STATEMENT)], WIDERSPRUCH, {
      getLiefertNichts: true,
    });
    const body = await pruefen(app, DEEP);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0].koId).toBe("regel-1");
    expect(body.conflicts[0].stellen).toBeNull();
    expect(body.conflicts[0].version).toBeNull();
    expect(body.konfliktpruefung).toEqual({
      gelaufen: true,
      grund: null,
      kandidaten: 1,
      ausgefallen: 0,
      verworfen: 0,
    });
  });

  it("K8 · ein eingereichter (offener) Eintrag trägt Prüfstand „eingereicht“ — der Session-Weg prüft auch Ungeprüftes mit", async () => {
    const { app } = await aufbau([regel("regel-2", REGEL_STATEMENT, { status: "offen" })]);
    const body = await pruefen(app, DEEP);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0].pruefstand).toBe("eingereicht");
    expect(body.conflicts[0].koStatus).toBe("offen");
  });

  // ------------------------------------------------------------------------------------------------
  // Runde 6 (Codex R5, Korrekturpflicht 1): drei Wege, auf denen die Route vorher „gelaufen: true" bei
  // leerer Konfliktliste sagte, obwohl niemand belastbar geprüft hatte. Gemessen mit dem ECHTEN
  // Konfliktdienst — die Zitatprüfung, die das Urteil verwirft, ist seine, nicht die der Route.
  // ------------------------------------------------------------------------------------------------
  it("K9 · Urteil „Widerspruch“ mit ERFUNDENEN Zitaten: der Dienst verwirft es — die Antwort sagt „urteil_verworfen“, nicht „gelaufen“", async () => {
    const { app, judgeConflictOutcome } = await aufbau([regel("regel-1", REGEL_STATEMENT)], {
      verdict: {
        relation: "widerspruch",
        older: null,
        confidence: 0.95,
        begruendung: "A erlaubt drei Tage, B zwei.",
        zitat_a: "an fünf Tagen pro Woche", // steht in KEINEM der beiden Texte
        zitat_b: STELLE_QUELLE,
      },
    });
    const body = await pruefen(app, DEEP);
    expect(judgeConflictOutcome).toHaveBeenCalledTimes(1);
    // Kein Konflikt — richtig so (Halluzination). Aber auch keine belastbare Leere.
    expect(body.conflicts).toEqual([]);
    expect(body.konfliktpruefung).toEqual({
      gelaufen: false,
      grund: "urteil_verworfen",
      kandidaten: 1,
      ausgefallen: 0,
      verworfen: 1,
    });
  });

  it("K10 · der Judge WIRFT (Netz, Provider): der Dienst geht weiter, die Route zählt den Ausfall — „modellfehler“, nicht „gelaufen“", async () => {
    const { app, judgeConflictOutcome } = await aufbau(
      [regel("regel-1", REGEL_STATEMENT)],
      async () => {
        throw new Error("upstream reset");
      },
    );
    const body = await pruefen(app, DEEP);
    expect(judgeConflictOutcome).toHaveBeenCalledTimes(1);
    expect(body.conflicts).toEqual([]);
    expect(body.konfliktpruefung).toEqual({
      gelaufen: false,
      grund: "modellfehler",
      kandidaten: 1,
      ausgefallen: 1,
      verworfen: 0,
    });
  });

  // Die zweite Quelle muss dem Memo AEHNLICH sein, sonst legt die Kandidatenwahl des Dienstes
  // (Trigramm-Aehnlichkeit) sie dem Modell gar nicht vor — gemessen: mit einem fremden Satz blieb es
  // bei EINEM Judge-Aufruf.
  const ZWEITE =
    "Homeoffice ist für alle Beschäftigten an vier Tagen pro Woche möglich (alte Fassung).";

  it("K11 · zwei Quellen, eine mit Widerspruch, eine geworfen: der Konflikt reist mit — und die Prüfung gilt trotzdem NICHT als belastbar", async () => {
    const { app, judgeConflictOutcome } = await aufbau(
      [
        regel("regel-1", REGEL_STATEMENT),
        regel("regel-2", ZWEITE, { title: "Homeoffice-Regelung (alt)" }),
      ],
      async (_a: string, b: string) => {
        if (b.includes("zwei Tagen pro Woche")) {
          return WIDERSPRUCH;
        }
        throw new Error("upstream reset");
      },
    );
    const body = await pruefen(app, DEEP);
    expect(judgeConflictOutcome).toHaveBeenCalledTimes(2);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0].koId).toBe("regel-1");
    expect(body.conflicts[0].stellen).toEqual({ eigen: STELLE_EIGEN, quelle: STELLE_QUELLE });
    expect(body.konfliktpruefung).toEqual({
      gelaufen: false,
      grund: "modellfehler",
      kandidaten: 2,
      ausgefallen: 1,
      verworfen: 0,
    });
  });

  it("K12 · zwei Quellen mit Urteil, davon eines verworfen: gefundener Konflikt bleibt, `verworfen` zählt das andere", async () => {
    const { app } = await aufbau(
      [
        regel("regel-1", REGEL_STATEMENT),
        regel("regel-2", ZWEITE, { title: "Homeoffice-Regelung (alt)" }),
      ],
      async (_a: string, b: string) =>
        b.includes("zwei Tagen pro Woche")
          ? WIDERSPRUCH
          : {
              verdict: {
                relation: "widerspruch",
                older: null,
                confidence: 0.9,
                begruendung: "Erfunden.",
                zitat_a: "gibt es nicht",
                zitat_b: "gibt es auch nicht",
              },
            },
    );
    const body = await pruefen(app, DEEP);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0].koId).toBe("regel-1");
    expect(body.konfliktpruefung).toEqual({
      gelaufen: false,
      grund: "urteil_verworfen",
      kandidaten: 2,
      ausgefallen: 0,
      verworfen: 1,
    });
  });
});
