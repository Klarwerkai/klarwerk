import { describe, expect, it } from "vitest";
import {
  ConflictService,
  type ConflictVerdict,
  InMemoryConflictRepo,
  trigramSimilarity,
} from "../../conflicts";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import { type DraftConflictJudge, checkKnowledge, dokumentAuszug } from "./knowledge-check";

// SCRUM-527 (Live-Check-Kern): similar = lexikalisch (deterministisch, kein Egress). conflicts laufen NUR
// mit einem übergebenen Judge (die fail-safe Contract-Entscheidung liegt in der Route, siehe
// knowledge-check-routes.test). Ohne Judge → status "pending", KEIN Modell-/Cloud-Aufruf mit Freitext.

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

// Fake-KoService: liefert vorgegebene Kandidaten (Repo-Keyword-Prefilter hier nicht Gegenstand).
// JOB 3298: OHNE `searchProjectionOf` — genau so, wie ihn Bestandstests und ältere Doppel bauen.
// Der Live-Check muss damit unverändert laufen: der Dokumenttext ist eine ANREICHERUNG, kein Träger.
function fakeKo(candidates: KnowledgeObject[]): KoService {
  return { findCandidates: async () => candidates } as unknown as KoService;
}

// JOB 3298: derselbe Fake MIT Suchprojektion — die Quelle, aus der der Dokumenttext kommt
// (`bodyText`, kanonisch geschnitten). Kein zweiter Scanner, kein bodyHtml.
function fakeKoMitBody(candidates: KnowledgeObject[], bodies: Record<string, string>): KoService {
  return {
    findCandidates: async () => candidates,
    searchProjectionOf: async (id: string) =>
      bodies[id] === undefined ? undefined : { bodyText: bodies[id] },
  } as unknown as KoService;
}

// Spy-Judge: zählt JEDEN Aufruf (der Judge ist der Cloud-Egress-Pfad). Ohne übergebenen Judge darf er nie
// entstehen; mit Judge muss er für passende Kandidaten laufen.
function spyJudge(verdict: ConflictVerdict | null): {
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

// JOB 3298 R2: Spion auf den KERNTEXT der Gegenseite — er zählt nicht nur, ob der Judge lief,
// sondern hält fest, WAS ihm vorgelegt wurde. Damit misst ein Fall beides zugleich: die
// Kandidaten-Vorauswahl (Zahl der Kerne) und den Inhalt (Auszug ja/nein).
function kernSpion(): { judge: DraftConflictJudge; kerne: string[] } {
  const kerne: string[] = [];
  return {
    judge: async (_a, b) => {
      kerne.push(b);
      return null;
    },
    kerne,
  };
}

const conflicts = () => new ConflictService({ repo: new InMemoryConflictRepo() });

describe("checkKnowledge", () => {
  it("G-2 (ben-V2): zu kurzer Text → status 'pending' (nicht 'done', UI nicht 'neu')", async () => {
    const res = await checkKnowledge("kurz", { ko: fakeKo([]), conflicts: conflicts() });
    // Kurztext wurde nicht auf Widerspruch geprüft → ehrlich pending, NICHT done.
    expect(res.status).toBe("pending");
    expect(res.status).not.toBe("done");
    expect(res.conflicts).toEqual([]);
  });

  it("similar: findet lexikalisch ähnliche KOs (deterministisch, kein Judge)", async () => {
    const match = ko({
      id: "k1",
      title: "Vorwärmung bei Kaltstart",
      statement: "Bei Kaltstart die Vorwärmung aktivieren.",
    });
    const unrelated = ko({ id: "k2", title: "Kaffeeküche", statement: "Milch nachfüllen." });
    const res = await checkKnowledge("Bei Kaltstart die Vorwärmung aktivieren nicht vergessen.", {
      ko: fakeKo([match, unrelated]),
      conflicts: conflicts(),
    });
    expect(res.similar.map((s) => s.id)).toContain("k1");
    expect(res.similar.map((s) => s.id)).not.toContain("k2");
    expect(res.similar[0]?.score).toBeGreaterThan(0);
  });

  it("OHNE Judge → status 'pending', conflicts [], similar bleibt (kein Egress)", async () => {
    const match = ko({ id: "k1", title: "Kaltstart", statement: "Vorwärmung aktivieren." });
    const res = await checkKnowledge("Bei Kaltstart die Vorwärmung aktivieren.", {
      ko: fakeKo([match]),
      conflicts: conflicts(),
      judge: null,
    });
    expect(res.status).toBe("pending");
    expect(res.conflicts).toEqual([]);
    expect(res.similar.map((s) => s.id)).toContain("k1");
  });

  it("MIT Judge + G-2-gültigem Verdikt → status 'done', conflicts enthält Kandidaten (Dry-Run, kein Persist)", async () => {
    const cand = ko({
      id: "kc",
      title: "Kaltstart Vorwärmung",
      statement: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
    });
    const text = "Bei Kaltstart keine Vorwärmung aktivieren.";
    // Verdikt mit wörtlichen, in den Kerntexten VORHANDENEN Zitaten (G-2-Prüfung greift).
    const verdict: ConflictVerdict = {
      relation: "widerspruch",
      older: null,
      confidence: 0.9,
      begruendung: "Widersprüchliche Aussage zur Vorwärmung.",
      zitat_a: "keine Vorwärmung aktivieren",
      zitat_b: "zuerst die Vorwärmung aktivieren",
    };
    const spy = spyJudge(verdict);
    const cs = conflicts();
    const res = await checkKnowledge(text, { ko: fakeKo([cand]), conflicts: cs, judge: spy.judge });
    expect(spy.calls()).toBeGreaterThan(0); // Judge lief für den passenden Kandidaten
    expect(res.status).toBe("done");
    expect(res.conflicts.map((c) => c.id)).toContain("kc");
    expect(res.conflicts[0]?.reason).toContain("Vorwärmung");
    // Dry-Run: NICHTS persistiert.
    expect(await cs.unresolved()).toHaveLength(0);
  });

  // ==============================================================================================
  // JOB 3298 · ASK-VOLLTEXT — DER LIVE-CHECK VERGLEICHT DEN DOKUMENTTEXT MIT.
  // ==============================================================================================
  // Der Marker steht AUSSCHLIESSLICH im Dokumenttext des Bestandsobjekts, nirgends in Titel oder
  // Aussage. Vor diesem Auftrag konnte der Live-Check ihn nicht sehen: `trigramSimilarity` maß
  // `title + statement`, und `koToSubject` reichte den Text nicht an den Judge weiter.
  const MARKER = "Rueckhaltebecken bei Frostgefahr vollstaendig entleeren";
  const KURZ = { id: "kb", title: "Winterbetrieb", statement: "Hinweis aus dem Import." };
  const BODY = `Diese Seite wurde importiert. ${MARKER}. Die Abrechnung erfolgt quartalsweise.`;
  const ENTWURF =
    "Rueckhaltebecken bei Frostgefahr vollstaendig entleeren, sonst friert die Leitung.";

  it("E0 · KALIBRIERUNG: ohne Dokumenttext ist das Objekt KEIN Ähnlichkeitstreffer", async () => {
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKo([ko(KURZ)]),
      conflicts: conflicts(),
    });
    expect(res.similar.map((s) => s.id)).not.toContain("kb");
  });

  it("E1 · ein Marker NUR im Dokumenttext erzeugt einen Ähnlichkeitstreffer", async () => {
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKoMitBody([ko(KURZ)], { kb: BODY }),
      conflicts: conflicts(),
    });
    expect(res.similar.map((s) => s.id)).toContain("kb");
  });

  it("E2 · kein bestehender Treffer verliert durch den Dokumenttext seinen Wert", async () => {
    // Jaccard: zusätzlicher Text vergrößert immer auch die Vereinigung. Würde der Auszug einfach
    // angehängt, sänke der Wert eines heute gefundenen Treffers mit langem Dokument — deshalb gilt
    // der HÖHERE der beiden Werte. Dieser Fall hält genau das fest.
    const nah = ko({
      id: "k1",
      title: "Vorwärmung bei Kaltstart",
      statement: "Bei Kaltstart die Vorwärmung aktivieren.",
    });
    const text = "Bei Kaltstart die Vorwärmung aktivieren nicht vergessen.";
    const ohne = await checkKnowledge(text, { ko: fakeKo([nah]), conflicts: conflicts() });
    const mit = await checkKnowledge(text, {
      // Ein Dokumenttext, der zum Entwurf ein Wort beisteuert und sonst nur Ballast ist.
      ko: fakeKoMitBody([nah], {
        k1: `Die Vorwärmung ist bei jedem Anlagentyp anders dokumentiert. ${"Weitere Hinweise ohne Bezug. ".repeat(20)}`,
      }),
      conflicts: conflicts(),
    });
    const vorher = ohne.similar.find((s) => s.id === "k1")?.score ?? 0;
    const nachher = mit.similar.find((s) => s.id === "k1")?.score ?? 0;
    expect(vorher).toBeGreaterThan(0);
    expect(nachher).toBeGreaterThanOrEqual(vorher);
  });

  it("E3 · der Konfliktkandidat trägt den Dokumenttext in den Kerntext, den der Judge liest", async () => {
    const gesehen: string[] = [];
    const judge: DraftConflictJudge = async (_a, b) => {
      gesehen.push(b);
      return null;
    };
    await checkKnowledge(ENTWURF, {
      ko: fakeKoMitBody([ko(KURZ)], { kb: BODY }),
      conflicts: conflicts(),
      judge,
    });
    expect(gesehen).toHaveLength(1);
    expect(gesehen[0]).toContain(MARKER);
    // Und die Kurzfelder bleiben unangetastet daneben stehen.
    expect(gesehen[0]).toContain("Hinweis aus dem Import.");
  });

  it("E4 · GEGENPROBE zur Vorauswahl: der Auszug hängt NICHT an `statement`", async () => {
    // Hinge er dort, rechnete die Kandidaten-Vorauswahl des Konfliktwegs ihre Textnähe gegen den
    // aufgeblähten Text und ein heutiger Kandidat könnte unter die 0,3-Schwelle fallen. Gemessen:
    // derselbe Kandidat wird mit UND ohne Dokumenttext dem Judge vorgelegt.
    const spion = kernSpion;
    const nah = ko({
      id: "k1",
      title: "Vorwärmung bei Kaltstart",
      statement: "Bei Kaltstart die Vorwärmung aktivieren.",
    });
    const text = "Bei Kaltstart die Vorwärmung aktivieren nicht vergessen.";
    // Ein Dokumenttext, der ein Entwurfswort trägt (also einen Auszug ERZEUGT) und im Übrigen aus
    // lauter fremden Zeichen besteht — der Auszug senkt die Textnähe, statt sie zu heben.
    const BALLAST =
      "Die Vorwärmung wird jährlich im Anlagenbuch unter Angabe der Werkstattnummer und des zuständigen Sachbearbeiters protokolliert. Sonstige Vorgänge betreffen die Buchhaltung.";
    const a = spion();
    await checkKnowledge(text, { ko: fakeKo([nah]), conflicts: conflicts(), judge: a.judge });
    const b = spion();
    await checkKnowledge(text, {
      ko: fakeKoMitBody([nah], { k1: BALLAST }),
      conflicts: conflicts(),
      judge: b.judge,
    });
    expect(a.kerne).toHaveLength(1);
    // Der Kandidat bleibt Kandidat — die Vorauswahl hat ihn nicht verloren.
    expect(b.kerne).toHaveLength(1);
    // Der Judge SIEHT den Dokumenttext trotzdem …
    expect(b.kerne[0]).toContain("Dokumenttext (Auszug): Die Vorwärmung wird jährlich");
    // … und das Kurzfeld, auf dem die Vorauswahl rechnet, ist Zeichen für Zeichen das alte.
    const aussage = (b.kerne[0] as string).split("\n").slice(0, 2).join("\n");
    expect(aussage).toBe(a.kerne[0]);
  });

  // ==============================================================================================
  // JOB 3298 R2 · KORREKTURPFLICHT 1 (ben, Runde 1) — DIE BESCHRIFTUNG WIRD MITVERGLICHEN.
  // ==============================================================================================
  // E4 misst den GROBEN Fall: ein Auszug aus lauter fremdem Text senkt die Textnähe deutlich, und
  // die Entscheidung „nicht ins Kurzfeld" fiel schon in Runde 1 richtig. Der Fall, den Runde 1
  // VERLOR, ist der knappe: die Textnähe steigt durch den Auszug NICHT (sie bleibt exakt gleich),
  // die 21 Zeichen der Beschriftung „Dokumenttext (Auszug): " senken sie aber unter die Schwelle
  // 0,3 der Vorauswahl (services/conflicts/src/detect.ts:132-133). Weil Runde 1 ohne Beschriftung
  // maß, hielt sie den Auszug für unschädlich, schrieb ihn ins Kurzfeld — und ein bisher geprüfter
  // Kandidat fiel still aus der Vorauswahl; der Check meldete weiterhin „done".
  // Der Fall ist ben's Gegenprobe, wörtlich.
  const SCHWELLE_ENTWURF = "Bei Kaltstart keine Vorwärmung aktivieren.";
  const SCHWELLE_KO = {
    id: "k1",
    title: "Kaltstart",
    statement:
      "Bei Kaltstart zuerst die Vorwärmung aktivieren und danach den Druck am Ventil mit einem geeigneten Messgerät.",
  };
  const SCHWELLE_BODY = "Bei Kaltstart zuerst die Vorwärmung aktivieren.";

  it("E7a · KALIBRIERUNG: der Fall liegt wirklich auf der 0,3-Kante — und die Beschriftung kippt ihn", () => {
    const kurz = `${SCHWELLE_KO.title} ${SCHWELLE_KO.statement}`;
    const ohne = trigramSimilarity(SCHWELLE_ENTWURF, kurz);
    const mitTextOhneMarke = trigramSimilarity(SCHWELLE_ENTWURF, `${kurz} ${SCHWELLE_BODY}`);
    const mitMarke = trigramSimilarity(
      SCHWELLE_ENTWURF,
      `${kurz}\nDokumenttext (Auszug): ${SCHWELLE_BODY}`,
    );
    // Ohne Auszug: Kandidat (über der Schwelle der Vorauswahl).
    expect(ohne).toBeGreaterThanOrEqual(0.3);
    // Der Auszug allein senkt nichts — genau deshalb hielt Runde 1 ihn fürs Kurzfeld geeignet.
    expect(mitTextOhneMarke).toBeGreaterThanOrEqual(ohne);
    // Die Beschriftung senkt ihn unter die Schwelle. Das ist die ganze Regression in einer Zeile.
    expect(mitMarke).toBeLessThan(0.3);
  });

  it("E7b · der Kandidat knapp über der Schwelle bleibt Kandidat — und der Judge sieht den Auszug", async () => {
    const nah = ko(SCHWELLE_KO);
    const a = kernSpion();
    await checkKnowledge(SCHWELLE_ENTWURF, {
      ko: fakeKo([nah]),
      conflicts: conflicts(),
      judge: a.judge,
    });
    const b = kernSpion();
    const res = await checkKnowledge(SCHWELLE_ENTWURF, {
      ko: fakeKoMitBody([nah], { k1: SCHWELLE_BODY }),
      conflicts: conflicts(),
      judge: b.judge,
    });
    // Der Bestand vor diesem Auftrag: genau ein Kerntext ging an den Judge.
    expect(a.kerne).toHaveLength(1);
    // Runde 1 lieferte hier 0 — der Kandidat war weg, der Status log „done".
    expect(b.kerne).toHaveLength(1);
    expect(res.status).toBe("done");
    // Das Kurzfeld, auf dem die Vorauswahl rechnet, ist Zeichen für Zeichen das alte …
    expect((b.kerne[0] as string).split("\n").slice(0, 2).join("\n")).toBe(a.kerne[0]);
    // … und der Judge bekommt den Dokumenttext trotzdem, genau einmal.
    expect(b.kerne[0]).toContain(`Dokumenttext (Auszug): ${SCHWELLE_BODY}`);
    expect((b.kerne[0] as string).split("Dokumenttext (Auszug):")).toHaveLength(2);
  });

  it("E5 · der Deckel gilt: höchstens 600 Zeichen Dokumenttext je Objekt", () => {
    const langerText = Array.from(
      { length: 40 },
      (_, i) => `Rueckhaltebecken Nummer ${i} bei Frostgefahr vollstaendig entleeren.`,
    ).join(" ");
    expect(langerText.length).toBeGreaterThan(600);
    expect(dokumentAuszug(langerText, ENTWURF).length).toBeLessThanOrEqual(600);
    // Ohne gemeinsames Inhaltstoken kein Auszug — eine Auswahl, keine Abschrift.
    expect(dokumentAuszug(langerText, "Welche Farbe hat der Anstrich?")).toBe("");
  });

  it("E6 · eine fehlende oder scheiternde Suchprojektion lässt den Check unverändert laufen", async () => {
    const kaputt = {
      findCandidates: async () => [ko(KURZ)],
      searchProjectionOf: async () => {
        throw new Error("projektion weg");
      },
    } as unknown as KoService;
    const res = await checkKnowledge(ENTWURF, { ko: kaputt, conflicts: conflicts() });
    // Nicht "failed": der Dokumenttext ist eine Anreicherung, sein Ausfall kippt den Check nicht.
    expect(res.status).toBe("pending");
    expect(res.similar.map((s) => s.id)).not.toContain("kb");
  });

  it("never block: ein Fehler in der Kandidatensuche → status 'failed', leer", async () => {
    const brokenKo = {
      findCandidates: async () => {
        throw new Error("db down");
      },
    } as unknown as KoService;
    const res = await checkKnowledge("Bei Kaltstart die Vorwärmung aktivieren.", {
      ko: brokenKo,
      conflicts: conflicts(),
      judge: spyJudge(null).judge,
    });
    expect(res).toEqual({ status: "failed", similar: [], conflicts: [] });
  });
});
