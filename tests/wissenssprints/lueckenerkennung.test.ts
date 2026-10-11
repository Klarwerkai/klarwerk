// ================================================================================================
// R-1657 (ROADMAP 9.3) — LÜCKENERKENNUNG: WISSENS-SPRINTS JE BEREICH.
// ================================================================================================
//
// Quelle: „KLARWERK analysiert regelmäßig, in welchen Themenbereichen wenig Wissen, geringer Trust
// oder hohe Konflikt-Dichte herrscht — und schlägt der Organisation Wissens-Sprints vor: ‚Bereich
// Schweißtechnik: 4 offene Konflikte, 12 Objekte zur Re-Validierung. 2-Tage-Sprint vorschlagen?'"
//
//   S1  das Beispiel der Quelle: 4 Objekte im Konflikt + 12 zur Re-Validierung ⇒ 2-Tage-Sprint;
//       ein gesunder Bereich bekommt keinen Vorschlag
//   S2  geringes Vertrauen und dünner validierter Bestand sind eigene Gründe; Reihenfolge nach
//       Arbeitsumfang; Sprintlänge gedeckelt; ohne Konflikt-Eingang wird kein Konflikt behauptet
//   S3  der echte Datenweg (buildServices, Konfliktdienst, Paar-Regel): ein Konflikt mit einem
//       unsichtbaren Partner zählt nicht, und ein nur unsichtbarer Bereich erscheint gar nicht
//
// Nacharbeit 2 (Ben: „über Reasoner", „regelmäßig") — die regelmäßige Analyse je Betrachtersicht:
//   R1  der Lauf legt dem Reasoner NUR Kennzahlen vor; danach tragen dessen Urteile die Vorschläge
//       (`source: "reasoner"`); ändern sich die Kennzahlen eines Bereichs, gilt bis zum nächsten
//       Lauf die Regel, und der nächste Lauf legt nur diesen Bereich erneut vor
//   R2  je Sicht nur deren sichtbarer Bestand; das Egress-Bit folgt vertraulichen Objekten
//   R3  regelmäßig aktiv: eine neue Sicht wird sofort einmal analysiert; der Stand ist sichtbar
//   R4  kein Urteil (Ursache oder Fehler) ⇒ benannte Regel, Ursache im Stand, kein Absturz
//   R5  echter Datenweg ohne Modell: der Lauf läuft, die Ursache heisst no-model
//   R6  (Nacharbeit 4, Ben) leere oder unvollständige Antwort: fehlende Bereiche behalten den
//       Regelvorschlag und werden im nächsten Lauf erneut vorgelegt; nur `sprint: false` (R3)
//       schliesst negativ ab
import { describe, expect, it, vi } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import type { KnowledgeObject, KoService } from "../../services/knowledge-object";
import {
  type GapJudgeOutcome,
  type GapSignal,
  ManagementService,
  type SprintReasonKey,
  computeSnapshot,
} from "../../services/management";
import { sprints } from "../../services/management/src/metrics";
import type { MetricsInput } from "../../services/management/src/types";

const NOW = Date.parse("2026-10-01T00:00:00Z");

function ko(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: p.id,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Schweißtechnik",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-06-20",
    history: [],
    ...p,
  } as KnowledgeObject;
}

function input(over: Partial<MetricsInput> = {}): MetricsInput {
  return {
    kos: [],
    openGaps: 0,
    openConflicts: 0,
    pendingRevalidation: [],
    busFactor: [],
    now: NOW,
    openConflictKoIds: [],
    ...over,
  };
}

const reihe = (prefix: string, n: number, over: Partial<KnowledgeObject> = {}) =>
  Array.from({ length: n }, (_, i) => ko({ id: `${prefix}${i + 1}`, ...over }));

describe("R-1657 · Wissens-Sprints aus erkannten Lücken und Konflikten", () => {
  it("S1 · das Beispiel der Quelle: 4 Konfliktobjekte, 12 zur Re-Validierung ⇒ 2-Tage-Sprint", () => {
    const konflikt = reihe("K", 4);
    const faellig = reihe("R", 12);
    const gesund = reihe("G", 3, { category: "Montage" });
    const snap = computeSnapshot(
      input({
        kos: [...konflikt, ...faellig, ...gesund],
        openConflicts: 2,
        openConflictKoIds: konflikt.map((k) => k.id),
        pendingRevalidation: faellig.map((k) => k.id),
      }),
    );

    expect(snap.sprints).toEqual([
      {
        category: "Schweißtechnik",
        reasons: [
          { key: "conflicts", count: 4 },
          { key: "revalidation", count: 12 },
        ],
        workItems: 16,
        days: 2,
        source: "rule",
      },
    ]);
    // Gegenprobe: drei validierte, vertrauenswürdige Objekte ohne Konflikt — kein Vorschlag.
    expect(snap.sprints.some((s) => s.category === "Montage")).toBe(false);
  });

  it("S2 · geringes Vertrauen und dünner Bestand begründen eigene Vorschläge; Rang und Deckel", () => {
    const rows = sprints(
      input({
        kos: [
          // Ein Objekt, mehrere Gründe: es zählt im Arbeitsumfang nur einmal.
          ko({ id: "A1", category: "Hydraulik", trust: 20, status: "offen" }),
          ko({ id: "A2", category: "Hydraulik", trust: 90 }),
          ko({ id: "B1", category: "Elektrik" }),
          ...reihe("V", 60, { category: "Lackierung", trust: 30 }),
        ],
        pendingRevalidation: ["A1"],
        openConflictKoIds: ["A1"],
      }),
    );

    expect(rows.map((r) => r.category)).toEqual(["Lackierung", "Hydraulik", "Elektrik"]);
    const [lack, hydraulik, elektrik] = rows;
    expect(lack?.reasons).toEqual([{ key: "lowTrust", count: 60 }]);
    expect(lack?.workItems).toBe(60);
    expect(lack?.days, "60 Objekte ergäben 8 Tage — gedeckelt auf 5").toBe(5);
    expect(hydraulik?.reasons).toEqual([
      { key: "conflicts", count: 1 },
      { key: "revalidation", count: 1 },
      { key: "lowTrust", count: 1 },
      { key: "thinKnowledge", count: 1 },
    ]);
    expect(hydraulik?.workItems).toBe(1);
    expect(hydraulik?.days).toBe(1);
    // „Wenig Wissen": ein einziges validiertes Objekt im Bereich.
    expect(elektrik?.reasons).toEqual([{ key: "thinKnowledge", count: 1 }]);
    expect(elektrik?.workItems).toBe(0);
    expect(elektrik?.days).toBe(1);

    // Ohne Konflikt-Eingang (null) wird keine Konfliktzahl behauptet.
    const ohne = sprints(
      input({ kos: [ko({ id: "A1", category: "Hydraulik" })], openConflictKoIds: null }),
    );
    expect(ohne[0]?.reasons.map((r) => r.key)).toEqual(["thinKnowledge"]);
    // Leerer Bestand: keine Vorschläge.
    expect(sprints(input())).toEqual([]);
  });

  it("S3 · echter Datenweg: Paar-Regel der Konflikte und kein unsichtbarer Bereich", async () => {
    const services = buildServices();
    const BEREICH = "Sprint R1657";
    const GEHEIM = "Sprint R1657 vertraulich";
    const anlegen = (title: string, category: string) =>
      services.ko.create({
        title,
        statement: `Aussage zu ${title}`,
        type: "best_practice",
        category,
        author: "u-sprint",
      });
    const a = await anlegen("Objekt A", BEREICH);
    const b = await anlegen("Objekt B", BEREICH);
    const c = await anlegen("Objekt C", BEREICH);
    const geheim = await anlegen("Objekt G", GEHEIM);
    const sichtbar = (k: { id: string }) => k.id !== b.id && k.id !== geheim.id;
    const vorschlag = async () => {
      const snap = await services.management.snapshot({ sichtbar });
      expect(snap.sprints.some((s) => s.category === GEHEIM)).toBe(false);
      return snap.sprints.find((s) => s.category === BEREICH);
    };

    await services.conflicts.create({ koA: a.id, koB: b.id, type: "truth", description: "A–B" });
    expect(
      (await vorschlag())?.reasons.find((r) => r.key === "conflicts"),
      "Konflikt mit nur einem sichtbaren Partner",
    ).toBeUndefined();

    await services.conflicts.create({ koA: a.id, koB: c.id, type: "truth", description: "A–C" });
    const s = await vorschlag();
    expect(s?.reasons.find((r) => r.key === "conflicts")?.count).toBe(2);
    // Frisch angelegte Objekte sind ungeprüft: geringes Vertrauen und dünner validierter Bestand.
    expect(s?.reasons.find((r) => r.key === "lowTrust")?.count).toBe(2);
    expect(s?.reasons.find((r) => r.key === "thinKnowledge")?.count).toBe(0);
    expect(s?.workItems).toBe(2);
    expect(s?.days).toBe(1);
  });
});

describe("R-1657 · Nacharbeit 2 — regelmäßige Lückenerkennung über den Reasoner, je Sicht", () => {
  const ALLE = () => true;
  const OEFFENTLICH = (k: KnowledgeObject) => (k.confidentiality ?? "intern") === "intern";
  const GAP_FELDER = [
    "bereich",
    "geringesVertrauen",
    "imKonflikt",
    "mittleresVertrauen",
    "objekte",
    "revalidierung",
    "validiert",
  ];

  function dienst(
    kos: KnowledgeObject[],
    antwort: (bereiche: readonly GapSignal[]) => GapJudgeOutcome | Promise<GapJudgeOutcome>,
  ) {
    const aufrufe: { bereiche: GapSignal[]; confidential: boolean }[] = [];
    const bestand = { kos };
    const management = new ManagementService({
      koService: { list: async () => bestand.kos } as unknown as KoService,
      listGaps: async () => [],
      countOpenConflicts: async () => 0,
      openConflictKoIds: async () => [],
      pendingRevalidation: async () => [],
      busFactor: async () => [],
      judgeGaps: async (bereiche, confidential) => {
        aufrufe.push({ bereiche: [...bereiche], confidential });
        return antwort(bereiche);
      },
      now: () => NOW,
    });
    return { management, aufrufe, bestand };
  }

  const urteil = (bereich: string, tage: number, schwerpunkte: SprintReasonKey[]) => ({
    bereich,
    sprint: true,
    tage,
    schwerpunkte,
  });

  it("R1 · nur Kennzahlen gehen hinaus; danach tragen Reasoner-Urteile; Änderung ⇒ Regel bis zum Lauf", async () => {
    const hydraulik = reihe("H", 4, { category: "Hydraulik", trust: 30 });
    const montage = reihe("M", 3, { category: "Montage" });
    const { management, aufrufe, bestand } = dienst([...hydraulik, ...montage], () => ({
      urteile: [urteil("Hydraulik", 3, ["lowTrust"]), urteil("Montage", 1, ["thinKnowledge"])],
      provider: "anthropic:test-modell",
    }));

    // Vor dem ersten Lauf: die benannte Regel, ausdrücklich so gekennzeichnet.
    const vorher = await management.snapshot({ sichtbar: ALLE, sicht: "u1" });
    expect(vorher.sprints.map((s) => [s.category, s.source])).toEqual([["Hydraulik", "rule"]]);
    expect(vorher.sprintAnalysis).toEqual({
      regular: false,
      intervalMs: null,
      analyzedAt: null,
      provider: null,
      failure: null,
    });
    expect(aufrufe).toHaveLength(0);

    expect(await management.wissenssprintLauf()).toBe(1);
    expect(aufrufe).toHaveLength(1);
    // Hinaus gingen NUR Name und Zähler — kein Titel, keine Aussage, keine Kennung.
    for (const b of aufrufe[0]?.bereiche ?? []) {
      expect(Object.keys(b).sort()).toEqual(GAP_FELDER);
    }
    expect(JSON.stringify(aufrufe)).not.toMatch(/"H1"|"M1"|Aussage/);
    expect(aufrufe[0]?.confidential).toBe(false);

    const nachher = await management.snapshot({ sichtbar: ALLE, sicht: "u1" });
    expect(nachher.sprints).toEqual([
      {
        category: "Hydraulik",
        reasons: [{ key: "lowTrust", count: 4 }],
        workItems: 4,
        days: 3,
        source: "reasoner",
      },
      {
        category: "Montage",
        reasons: [{ key: "thinKnowledge", count: 3 }],
        workItems: 0,
        days: 1,
        source: "reasoner",
      },
    ]);
    expect(nachher.sprintAnalysis.provider).toBe("anthropic:test-modell");
    expect(nachher.sprintAnalysis.analyzedAt).toBe(new Date(NOW).toISOString());

    // Neue Kennzahlen in Hydraulik: dort gilt bis zum nächsten Lauf wieder die Regel.
    bestand.kos = [...bestand.kos, ko({ id: "H5", category: "Hydraulik", trust: 20 })];
    const geaendert = await management.snapshot({ sichtbar: ALLE, sicht: "u1" });
    expect(geaendert.sprints.map((s) => [s.category, s.source])).toEqual([
      ["Hydraulik", "rule"],
      ["Montage", "reasoner"],
    ]);
    await management.wissenssprintLauf();
    expect(aufrufe[1]?.bereiche.map((b) => b.bereich)).toEqual(["Hydraulik"]);
  });

  it("R2 · je Sicht nur deren sichtbarer Bestand; vertrauliche Objekte setzen das Egress-Bit", async () => {
    const kos = [
      ...reihe("H", 3, { category: "Hydraulik", trust: 30 }),
      ko({ id: "HV", category: "Hydraulik", confidentiality: "vertraulich" }),
      ko({ id: "GV", category: "Geheimbereich", confidentiality: "streng_vertraulich" }),
    ];
    const { management, aufrufe } = dienst(kos, () => ({
      urteile: [urteil("Hydraulik", 1, ["lowTrust"])],
      provider: "lokal:test",
    }));

    await management.snapshot({ sichtbar: ALLE, sicht: "admin" });
    await management.snapshot({ sichtbar: OEFFENTLICH, sicht: "leser" });
    expect(await management.wissenssprintLauf()).toBe(2);

    const [admin, leser] = aufrufe;
    expect(admin?.confidential).toBe(true);
    expect(admin?.bereiche.map((b) => b.bereich).sort()).toEqual(["Geheimbereich", "Hydraulik"]);
    expect(admin?.bereiche.find((b) => b.bereich === "Hydraulik")?.objekte).toBe(4);
    // Die Lesersicht: kein Geheimbereich, nur die drei öffentlichen Objekte, kein Egress-Bit.
    expect(leser?.confidential).toBe(false);
    expect(leser?.bereiche.map((b) => b.bereich)).toEqual(["Hydraulik"]);
    expect(leser?.bereiche[0]?.objekte).toBe(3);
    const alsLeser = await management.snapshot({ sichtbar: OEFFENTLICH, sicht: "leser" });
    expect(JSON.stringify(alsLeser)).not.toContain("Geheimbereich");
    expect(alsLeser.sprints.map((s) => [s.category, s.source])).toEqual([
      ["Hydraulik", "reasoner"],
    ]);
  });

  it("R3 · regelmäßig aktiv: eine neue Sicht wird sofort analysiert, der Stand nennt den Takt", async () => {
    // Nacharbeit 4 (Ben): die negative Entscheidung ist ein AUSDRÜCKLICHES Bereichsurteil.
    const { management, aufrufe } = dienst(reihe("H", 2, { category: "Hydraulik" }), () => ({
      urteile: [{ bereich: "Hydraulik", sprint: false, tage: 1, schwerpunkte: [] }],
      provider: "anthropic:test-modell",
    }));
    management.regelmaessigeAnalyseAktiv(60_000);

    const erst = await management.snapshot({ sichtbar: ALLE, sicht: "neu" });
    expect(erst.sprintAnalysis.regular).toBe(true);
    expect(erst.sprintAnalysis.intervalMs).toBe(60_000);
    // Ohne `wissenssprintLauf`: das erste Urteil kam allein aus dem Vormerken der neuen Sicht.
    await vi.waitFor(async () => {
      const stand = await management.snapshot({ sichtbar: ALLE, sicht: "neu" });
      expect(stand.sprintAnalysis.provider).toBe("anthropic:test-modell");
    });
    expect(aufrufe).toHaveLength(1);
    // Ausdrücklich `sprint: false` ⇒ negativer Abschluss: auch die Regel schlägt nichts mehr vor,
    // und bei unveränderten Kennzahlen wird der Bereich nicht erneut vorgelegt.
    const danach = await management.snapshot({ sichtbar: ALLE, sicht: "neu" });
    expect(danach.sprints).toEqual([]);
    await management.wissenssprintLauf();
    expect(aufrufe).toHaveLength(1);
  });

  it("R6 · leere oder unvollständige Antwort: fehlende Bereiche behalten die Regel und bleiben offen", async () => {
    const kos = [
      ...reihe("H", 2, { category: "Hydraulik", trust: 10 }),
      ...reihe("L", 2, { category: "Lackierung", trust: 20 }),
    ];
    const antworten: GapJudgeOutcome[] = [
      // Lauf 1: leere Liste — kein Bereich ist beurteilt.
      { urteile: [], provider: "anthropic:test-modell" },
      // Lauf 2: nur Hydraulik beurteilt; Lackierung fehlt (z. B. vom Parser verworfen).
      { urteile: [urteil("Hydraulik", 2, ["lowTrust"])], provider: "anthropic:test-modell" },
      // Lauf 3: nun auch Lackierung.
      { urteile: [urteil("Lackierung", 1, ["lowTrust"])], provider: "anthropic:test-modell" },
    ];
    const LEER: GapJudgeOutcome = { urteile: [] };
    const { management, aufrufe } = dienst(kos, () => antworten[aufrufe.length - 1] ?? LEER);
    const quellen = async () => {
      const snap = await management.snapshot({ sichtbar: ALLE, sicht: "u" });
      return snap.sprints.map((s) => [s.category, s.source]).sort();
    };

    await management.snapshot({ sichtbar: ALLE, sicht: "u" });
    await management.wissenssprintLauf();
    // Leere Antwort: kein Regelvorschlag verschwindet.
    expect(await quellen()).toEqual([
      ["Hydraulik", "rule"],
      ["Lackierung", "rule"],
    ]);

    await management.wissenssprintLauf();
    // Beide Bereiche wurden erneut vorgelegt — die leere Antwort hat nichts abgeschlossen.
    const zweiterLauf = aufrufe[1]?.bereiche.map((b) => b.bereich).sort();
    expect(zweiterLauf).toEqual(["Hydraulik", "Lackierung"]);
    expect(await quellen()).toEqual([
      ["Hydraulik", "reasoner"],
      ["Lackierung", "rule"],
    ]);

    await management.wissenssprintLauf();
    // Nur der noch offene Bereich geht erneut hinaus.
    expect(aufrufe[2]?.bereiche.map((b) => b.bereich)).toEqual(["Lackierung"]);
    expect(await quellen()).toEqual([
      ["Hydraulik", "reasoner"],
      ["Lackierung", "reasoner"],
    ]);
  });

  it("R4 · kein Urteil ⇒ benannte Regel und Ursache im Stand; ein Fehler bricht den Lauf nicht", async () => {
    const ohne = dienst(reihe("H", 2, { category: "Hydraulik", trust: 10 }), () => ({
      urteile: null,
      failure: "no-model",
    }));
    await ohne.management.snapshot({ sichtbar: ALLE, sicht: "u" });
    await ohne.management.wissenssprintLauf();
    const snap = await ohne.management.snapshot({ sichtbar: ALLE, sicht: "u" });
    expect(snap.sprints.map((s) => s.source)).toEqual(["rule"]);
    expect(snap.sprintAnalysis.failure).toBe("no-model");

    const kaputt = dienst(reihe("H", 2, { category: "Hydraulik", trust: 10 }), () => {
      throw new Error("Anbieter weg");
    });
    await kaputt.management.snapshot({ sichtbar: ALLE, sicht: "u" });
    await expect(kaputt.management.wissenssprintLauf()).resolves.toBe(1);
    const nachFehler = await kaputt.management.snapshot({ sichtbar: ALLE, sicht: "u" });
    expect(nachFehler.sprintAnalysis.failure).toBe("model-error");
    expect(nachFehler.sprints.map((s) => s.source)).toEqual(["rule"]);
  });

  it("R5 · echter Datenweg ohne Modell: der Lauf geht über den Reasoner, Ursache no-model", async () => {
    const services = buildServices();
    await services.ko.create({
      title: "Objekt R5",
      statement: "Aussage R5",
      type: "best_practice",
      category: "Sprint R1657 R5",
      author: "u-r5",
    });
    await services.management.snapshot({ sichtbar: ALLE, sicht: "u-r5" });

    expect(await services.management.wissenssprintLauf()).toBe(1);
    const snap = await services.management.snapshot({ sichtbar: ALLE, sicht: "u-r5" });
    expect(snap.sprintAnalysis.failure).toBe("no-model");
    const zeile = snap.sprints.find((s) => s.category === "Sprint R1657 R5");
    expect(zeile?.source).toBe("rule");
  });
});
