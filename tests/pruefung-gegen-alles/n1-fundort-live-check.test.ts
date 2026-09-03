// ================================================================================================
// JOB 3031 · N1 — AUCH DER LIVE-CHECK BEIM ERFASSEN SAGT, WO DER TREFFER LIEGT UND OB ER GESICHERT IST.
// ================================================================================================
//
// Pedis Zeile N1: „Vor dem Einreichen sieht man, ob es das schon gibt — auch als ungeprüfter
// Eintrag — und wo es liegt." Für den Add-in-Weg `POST /api/check-text` liefert das JOB 3020
// (`n1-ungeprueftes-wird-gefunden.test.ts`, Felder `koStatus`/`koCategory`). Der zweite Weg, auf dem
// ein Mensch vor dem Einreichen prüft, ist der Live-Check der Web-App (`POST /api/knowledge/check`,
// Kern `checkKnowledge`) — dort trug der Treffer bis zu dieser Runde nur `id`, `title`, `score`
// beziehungsweise `id`, `title`, `reason`.
//
// GEPRÜFT WIRD DER KERN, modul-rein mit Attrappen (Aufbau wie `services/app/src/knowledge-check.ts`
// Test): der Kandidatenrücklauf ist der Prüfstand, weil genau er die beiden Auskünfte trägt. Der
// Antwortkörper der ECHTEN Route steht in `services/app/src/routes/knowledge-check-routes.test.ts`.
//
// `null` IST EINE ECHTE ANTWORT und heißt „der Bestand sagt dazu nichts" — nicht „offen", nicht
// „keine Kategorie". F3 und F5 halten das fest.
import { describe, expect, it } from "vitest";
import { type DraftConflictJudge, checkKnowledge } from "../../services/app/src/knowledge-check";
import {
  ConflictService,
  type ConflictVerdict,
  InMemoryConflictRepo,
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
  } as KnowledgeObject;
}

function fakeKo(candidates: KnowledgeObject[]): KoService {
  return { findCandidates: async () => candidates } as unknown as KoService;
}

const conflicts = () => new ConflictService({ repo: new InMemoryConflictRepo() });

// Near-identische Kerntexte → deterministischer Trigramm-Treffer (kein Modell, kein Textabfluss).
const ENTWURF = "Bei Kaltstart die Vorwärmung aktivieren nicht vergessen.";
const BESTAND_TITEL = "Vorwärmung bei Kaltstart";
const BESTAND_STMT = "Bei Kaltstart die Vorwärmung aktivieren.";
// Kalibrierung: thematisch fremd, gleiche Form — teilt kein Inhaltstoken mit dem Bestand.
const FREMD = "Die Buchhaltung schließt das Geschäftsjahr zum einunddreißigsten Dezember ab.";

function bestand(over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return ko({ id: "k1", title: BESTAND_TITEL, statement: BESTAND_STMT, ...over });
}

describe("JOB 3031 N1: der Live-Check nennt Zustand und Fundort des Treffers", () => {
  it("F1 · ein ungeprüfter Treffer wird als ungeprüft ausgewiesen (Zustand + Kategorie)", async () => {
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKo([bestand({ status: "offen", category: "Wartung" })]),
      conflicts: conflicts(),
    });
    const treffer = res.similar.find((s) => s.id === "k1");
    expect(treffer, "das offene Objekt muss ein Treffer sein").toBeDefined();
    expect(treffer?.koStatus).toBe("offen");
    expect(treffer?.koCategory).toBe("Wartung");
  });

  it("F2 · ein gesicherter Treffer trägt koStatus 'validiert'", async () => {
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKo([bestand({ status: "validiert", category: "Wartung" })]),
      conflicts: conflicts(),
    });
    const treffer = res.similar.find((s) => s.id === "k1");
    expect(treffer?.koStatus).toBe("validiert");
    expect(treffer?.koStatus).not.toBe("offen");
  });

  it("F3 · eine leere Kategorie ist null, nicht ''", async () => {
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKo([bestand({ status: "offen", category: "   " })]),
      conflicts: conflicts(),
    });
    const treffer = res.similar.find((s) => s.id === "k1");
    expect(treffer?.koCategory).toBeNull();
    expect(treffer?.koCategory).not.toBe("");
  });

  it("F4 · der Konfliktzweig trägt dieselbe Auskunft wie der Ähnlichkeitszweig", async () => {
    // G-2-gültiges Verdikt: beide Zitate stehen wörtlich in den Kerntexten.
    const verdict: ConflictVerdict = {
      relation: "widerspruch",
      older: null,
      confidence: 0.9,
      begruendung: "Widersprüchliche Aussage zur Vorwärmung.",
      zitat_a: "keine Vorwärmung aktivieren",
      zitat_b: "zuerst die Vorwärmung aktivieren",
    };
    const judge: DraftConflictJudge = async () => verdict;
    const cand = ko({
      id: "kc",
      title: "Kaltstart Vorwärmung",
      statement: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
      status: "offen",
      category: "Instandhaltung",
    });
    const res = await checkKnowledge("Bei Kaltstart keine Vorwärmung aktivieren.", {
      ko: fakeKo([cand]),
      conflicts: conflicts(),
      judge,
    });
    expect(res.status).toBe("done");
    const treffer = res.conflicts.find((c) => c.id === "kc");
    expect(treffer, "der Konflikt-Treffer muss erscheinen").toBeDefined();
    expect(treffer?.koStatus).toBe("offen");
    expect(treffer?.koCategory).toBe("Instandhaltung");
  });

  it("F5 · ein Befund ohne passenden Kandidaten sagt nichts (null/null), statt zu leihen", async () => {
    // Attrappe des Konfliktdienstes: liefert einen Befund zu einer koId, die in KEINEM Kandidaten
    // vorkommt. Der einzige Kandidat trägt Zustand und Kategorie — ein Rückfall auf ihn wäre ein
    // geliehener, also erfundener Fundort.
    const geisterDienst = {
      assessAgainstPool: async () => [
        { koId: "geist", koTitle: "Geist", type: "widerspruch", method: "model", rationale: "x" },
      ],
    } as unknown as ConflictService;
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKo([bestand({ status: "offen", category: "Wartung" })]),
      conflicts: geisterDienst,
      judge: async () => null,
    });
    const treffer = res.conflicts.find((c) => c.id === "geist");
    expect(treffer, "der Befund muss durchgereicht werden").toBeDefined();
    expect(treffer?.koStatus).toBeNull();
    expect(treffer?.koCategory).toBeNull();
  });

  it("F6 · Kalibrierung: ein thematisch fremder Entwurf findet NICHTS", async () => {
    const res = await checkKnowledge(`${FREMD} Der Abschluss wird testiert und abgelegt.`, {
      ko: fakeKo([bestand({ status: "offen", category: "Wartung" })]),
      conflicts: conflicts(),
    });
    expect(res.similar).toEqual([]);
  });

  it("F7 · ein vertraulicher Kandidat erscheint in KEINEM Feld — auch nicht als Kategorie", async () => {
    const GEHEIM = "Sonderventil Kennung 4711";
    const KATEGORIE = "Sonderanlage";
    const res = await checkKnowledge(ENTWURF, {
      ko: fakeKo([
        bestand({
          id: "kg",
          title: GEHEIM,
          statement: BESTAND_STMT,
          status: "offen",
          category: KATEGORIE,
          confidentiality: "vertraulich",
        }),
      ]),
      conflicts: conflicts(),
    });
    expect(res.similar).toEqual([]);
    const roh = JSON.stringify(res);
    expect(roh).not.toContain(GEHEIM);
    expect(roh).not.toContain(KATEGORIE);
    expect(roh).not.toContain("kg");
  });
});
