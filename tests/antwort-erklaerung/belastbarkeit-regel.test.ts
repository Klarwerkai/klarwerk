// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-ERKLÄRUNG — DIE REGEL DER BELASTBARKEIT, OHNE NETZ.
// ================================================================================================
//
// Gemessen wird `antwortBelastbarkeit` (services/ask/src/answer-belastbarkeit.ts) mit derselben
// Einstufung, die die Route liefert (`answerEvidence`). Der Drahttest daneben
// (`belastbarkeit-am-draht.test.ts`) zeigt, dass die Route das Ergebnis wirklich ausliefert.
//
// Je Fall der Originalpunkt, den er bewacht:
//   R-0283/R-0318  Begründung, Quellenzahl, Hinweis „kein Wahrheitsversprechen"
//   R-0319         Vertrauenswert = Minimum über `KnowledgeObject.trust` (dieselbe Größe wie die
//                  Bibliothek), mit benannter schwächster Quelle
//   R-0321         beide Konfliktseiten, kein Gewinner; nicht einsehbare Seite wird genannt
//   R-0322         Verantwortungslücke benannt, Antwort bleibt Antwort
//   R-0335         eine Lage aus der sechsteiligen Familie
//   R-0260         keine Prozentangabe, kein Wahrheitsgrad
import { describe, expect, it } from "vitest";
import {
  type AntwortLage,
  answerEvidence,
  antwortBelastbarkeit,
  konfliktGegenseiten,
} from "../../services/ask";
import type { Conflict } from "../../services/conflicts";

// R-1349 (Aufnahme gesamt-aufruferwaechter): die Liste stand bis hierher als Produktexport
// `ANTWORT_LAGEN`, den kein Produktweg las. Hier steht sie gegen den Produkttyp gebunden: ein
// `Record<AntwortLage, true>` übersetzt nur, wenn JEDE Lage des Typs genau einmal vorkommt und
// keine fremde dabei ist — eine fehlende oder erfundene Lage bricht schon die Typprüfung.
const LAGE_VOLLSTAENDIG: Record<AntwortLage, true> = {
  belegt: true,
  belegt_zustaendig_fehlt: true,
  belegt_mit_konflikt: true,
  wissensluecke: true,
  technischer_fehler: true,
  geschwaerzt: true,
};
const ANTWORT_LAGEN = Object.keys(LAGE_VOLLSTAENDIG) as AntwortLage[];
import type { KnowledgeObject } from "../../services/knowledge-object";

const BELEGT = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};

function ko(id: string, teil: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    title: `Wissen ${id}`,
    statement: `Aussage ${id}`,
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 80,
    version: 2,
    author: `autor-${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    history: [
      { version: 1, at: "2026-01-01T00:00:00.000Z", author: `autor-${id}`, note: "angelegt" },
      { version: 2, at: "2026-03-05T10:00:00.000Z", author: `autor-${id}`, note: "überarbeitet" },
    ],
    aiCheck: { status: "done", requestedAt: "x", coverage: BELEGT },
    ...teil,
  } as unknown as KnowledgeObject;
}

function konflikt(id: string, koA: string, koB: string): Conflict {
  return {
    id,
    koA,
    koB,
    type: "truth",
    description: `Widerspruch ${koA}/${koB}`,
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-04-01T00:00:00.000Z",
  } as Conflict;
}

interface Fall {
  answered?: boolean;
  sources?: string[];
  cited?: string[];
  kos: KnowledgeObject[];
  conflicts?: Conflict[] | null;
  seiteSichtbar?: (k: KnowledgeObject) => boolean;
  erreichbar?: Record<string, boolean>;
  namen?: Record<string, string> | null;
}

function rechne(f: Fall) {
  const answered = f.answered ?? true;
  const sources = f.sources ?? f.kos.map((k) => k.id);
  const cited = f.cited ?? sources;
  const kos = new Map(f.kos.map((k): [string, KnowledgeObject] => [k.id, k]));
  const openConflicts = f.conflicts === undefined ? [] : f.conflicts;
  const answer = {
    answered,
    knowledgeClass: "gesichert" as const,
    sources: answered ? sources : [],
    citedSources: answered ? cited : [],
  };
  const evidence = answerEvidence({ answer, sourceKos: kos, openConflicts });
  return antwortBelastbarkeit({
    answer,
    evidence,
    kos,
    openConflicts,
    ...(f.seiteSichtbar ? { seiteSichtbar: f.seiteSichtbar } : {}),
    ...(f.erreichbar ? { erreichbar: new Map(Object.entries(f.erreichbar)) } : {}),
    namen:
      f.namen === undefined
        ? new Map()
        : f.namen === null
          ? null
          : new Map(Object.entries(f.namen)),
  });
}

describe("R-0335 · die Zustandsfamilie", () => {
  it("hat genau sechs benannte Lagen, jede einmal", () => {
    expect([...ANTWORT_LAGEN].sort()).toEqual(
      [
        "belegt",
        "belegt_mit_konflikt",
        "belegt_zustaendig_fehlt",
        "geschwaerzt",
        "technischer_fehler",
        "wissensluecke",
      ].sort(),
    );
  });

  it("Wissenslücke: keine Zahl, kein Wert, aber Grund und Hinweis", () => {
    const b = rechne({ answered: false, kos: [] });
    expect(b.lage).toBe("wissensluecke");
    expect(b.gruende).toEqual(["keine_tragfaehige_quelle"]);
    expect(b.vertrauenswert).toEqual({
      wert: null,
      herleitung: "keine_tragende_quelle",
      schwaechsteQuelle: null,
    });
    expect(b.hinweis).toBe("vertrauen_ist_kein_wahrheitsversprechen");
  });

  it("belegt: erreichbare Verantwortliche, kein Konflikt", () => {
    const b = rechne({ kos: [ko("a")], erreichbar: { "autor-a": true } });
    expect(b.lage).toBe("belegt");
    expect(b.gruende).toContain("alle_tragenden_quellen_validiert");
    expect(b.gruende).not.toContain("offener_konflikt");
    expect(b.quellenAnzahl).toEqual({ herangezogen: 1, tragend: 1 });
  });
});

describe("R-0318 · Vertrauenswert, Aktualität, Verantwortung, Quellenqualität je tragender Quelle", () => {
  it("trägt Stand der geltenden Fassung, Prüfstand, Validierung und Verantwortung", () => {
    const b = rechne({
      kos: [ko("a", { status: "offen" } as Partial<KnowledgeObject>)],
      erreichbar: { "autor-a": true },
      namen: { "autor-a": "Karl Muster" },
    });
    const [q] = b.quellen;
    expect(q?.stand).toBe("2026-03-05T10:00:00.000Z");
    expect(q?.version).toBe(2);
    expect(q?.validiert).toBe(false);
    expect(q?.pruefstand).toBe("proven");
    expect(q?.verantwortung).toEqual({
      art: "author-fallback",
      person: { id: "autor-a", name: "Karl Muster" },
      erreichbar: true,
    });
    expect(b.gruende).toContain("tragende_quelle_nicht_validiert");
    expect(b.gruende).toContain("verantwortung_nur_autor");
  });

  it("ein benannter Eigentümer schlägt den Autor — und ist als solcher ausgewiesen", () => {
    const b = rechne({
      kos: [ko("a", { ownership: { owner: "chefin", reviewers: [], validators: [] } })],
      erreichbar: { chefin: true },
    });
    expect(b.quellen[0]?.verantwortung.art).toBe("owner");
    expect(b.quellen[0]?.verantwortung.person?.id).toBe("chefin");
    expect(b.gruende).not.toContain("verantwortung_nur_autor");
  });

  it("ohne Personensicht (Add-on-Weg) keine Kennung und kein Name", () => {
    const b = rechne({ kos: [ko("a")], erreichbar: { "autor-a": true }, namen: null });
    expect(b.quellen[0]?.verantwortung.person).toBeNull();
    expect(b.quellen[0]?.verantwortung.erreichbar).toBe(true);
  });
});

describe("R-0319 · der Vertrauenswert der Antwort ist dieselbe Größe wie am Eintrag", () => {
  it("Minimum über die TRAGENDEN Quellen, mit der schwächsten benannt", () => {
    const b = rechne({
      kos: [ko("a", { trust: 91 }), ko("b", { trust: 76 }), ko("c", { trust: 12 })],
      sources: ["a", "b", "c"],
      cited: ["a", "b"],
    });
    expect(b.vertrauenswert).toEqual({
      wert: 76,
      herleitung: "minimum_tragender_quellen",
      schwaechsteQuelle: "b",
    });
    // Je Quelle steht exakt `KnowledgeObject.trust` — die Zahl der Bibliothek.
    expect(b.quellen.map((q) => [q.koId, q.vertrauenswert])).toEqual([
      ["a", 91],
      ["b", 76],
    ]);
    expect(b.quellenAnzahl).toEqual({ herangezogen: 3, tragend: 2 });
  });

  it("ohne Zuordnung KEIN Wert — auch keine 0", () => {
    const b = rechne({ kos: [ko("a")], cited: [] });
    expect(b.vertrauenswert.wert).toBeNull();
    expect(b.gruende).toContain("zuordnung_unbekannt");
  });
});

describe("R-0321 · beide Seiten eines Widerspruchs, kein heimlicher Gewinner", () => {
  it("zeigt beide Seiten mit Beleg, wenn der Aufrufer die Gegenseite sehen darf", () => {
    const b = rechne({
      kos: [
        ko("a", { trust: 90 }),
        ko("g", { trust: 40, status: "offen" } as Partial<KnowledgeObject>),
      ],
      sources: ["a"],
      conflicts: [konflikt("c1", "a", "g")],
      seiteSichtbar: () => true,
      erreichbar: { "autor-a": true },
    });
    expect(b.lage).toBe("belegt_mit_konflikt");
    expect(b.gruende).toContain("offener_konflikt");
    expect(b.konflikte).toHaveLength(1);
    const [k] = b.konflikte;
    expect(k?.beschreibung).toBe("Widerspruch a/g");
    expect(k?.seiten).toEqual([
      {
        einsehbar: true,
        koId: "a",
        titel: "Wissen a",
        aussage: "Aussage a",
        version: 2,
        vertrauenswert: 90,
        validiert: true,
        traegtAntwort: true,
      },
      {
        einsehbar: true,
        koId: "g",
        titel: "Wissen g",
        aussage: "Aussage g",
        version: 2,
        vertrauenswert: 40,
        validiert: false,
        traegtAntwort: false,
      },
    ]);
    // Es gibt kein Feld, das eine Seite bevorzugt oder einen Wahrheitsgrad nennt (R-0260).
    expect(Object.keys(k ?? {}).sort()).toEqual(["beschreibung", "konfliktId", "seiten"]);
  });

  it("eine nicht sichtbare Gegenseite wird GENANNT, ihr Inhalt und die Beschreibung nicht", () => {
    const b = rechne({
      kos: [ko("a"), ko("g", { statement: "GEHEIMER INHALT" })],
      sources: ["a"],
      conflicts: [konflikt("c1", "g", "a")],
      // kein seiteSichtbar → nein
    });
    expect(b.konflikte[0]?.seiten).toEqual([
      { einsehbar: false, traegtAntwort: false },
      expect.objectContaining({ einsehbar: true, koId: "a", traegtAntwort: true }),
    ]);
    expect(b.konflikte[0]?.beschreibung).toBeNull();
    expect(JSON.stringify(b)).not.toContain("GEHEIMER INHALT");
  });

  it("eine vertrauliche Gegenseite bleibt verborgen, auch wenn der Filter sie durchliesse", () => {
    const b = rechne({
      kos: [ko("a"), ko("g", { confidentiality: "vertraulich", statement: "VERTRAULICH" })],
      sources: ["a"],
      conflicts: [konflikt("c1", "a", "g")],
      seiteSichtbar: () => true,
    });
    expect(b.konflikte[0]?.seiten[1]).toEqual({ einsehbar: false, traegtAntwort: false });
    expect(JSON.stringify(b)).not.toContain("VERTRAULICH");
  });

  it("ein Konflikt ohne Bezug zu einer tragenden Quelle erscheint nicht", () => {
    const b = rechne({
      kos: [ko("a")],
      conflicts: [konflikt("c9", "x", "y")],
      seiteSichtbar: () => true,
    });
    expect(b.konflikte).toEqual([]);
    expect(b.lage).not.toBe("belegt_mit_konflikt");
    expect(konfliktGegenseiten(["a"], [konflikt("c9", "x", "y")])).toEqual([]);
    expect(konfliktGegenseiten(["a"], [konflikt("c1", "g", "a")])).toEqual(["g"]);
  });

  it("unbekannte Konfliktlage wird als Grund benannt, nicht als Konfliktfreiheit", () => {
    const b = rechne({ kos: [ko("a")], conflicts: null, erreichbar: { "autor-a": true } });
    expect(b.gruende).toContain("konfliktlage_unbekannt");
  });
});

describe("R-0322 · der zuständige Experte fehlt", () => {
  it("die Antwort bleibt nutzbar, die Lücke wird benannt", () => {
    const b = rechne({ kos: [ko("a")], erreichbar: { "autor-a": false } });
    expect(b.lage).toBe("belegt_zustaendig_fehlt");
    expect(b.gruende).toContain("zustaendig_nicht_erreichbar");
    expect(b.quellen[0]?.verantwortung.erreichbar).toBe(false);
    expect(b.vertrauenswert.wert).toBe(80);
  });

  it("unbekannte Erreichbarkeit erfindet keine Lücke — sie wird als unbekannt benannt", () => {
    const b = rechne({ kos: [ko("a")] });
    expect(b.lage).toBe("belegt");
    expect(b.quellen[0]?.verantwortung.erreichbar).toBeNull();
    expect(b.gruende).toContain("erreichbarkeit_unbekannt");
  });

  it("Widerspruch UND fehlender Zuständiger: die Lage nennt den Widerspruch, der Grund bleibt", () => {
    const b = rechne({
      kos: [ko("a"), ko("g")],
      sources: ["a"],
      conflicts: [konflikt("c1", "a", "g")],
      erreichbar: { "autor-a": false },
    });
    expect(b.lage).toBe("belegt_mit_konflikt");
    expect(b.gruende).toEqual(
      expect.arrayContaining(["offener_konflikt", "zustaendig_nicht_erreichbar"]),
    );
  });
});

describe("R-0260 · kein Wahrheitsgrad", () => {
  it("die Auskunft trägt keine Prozentangabe und kein Wahrheitsfeld", () => {
    const b = rechne({
      kos: [ko("a"), ko("g")],
      sources: ["a"],
      conflicts: [konflikt("c1", "a", "g")],
      seiteSichtbar: () => true,
    });
    const text = JSON.stringify(b);
    expect(text).not.toMatch(/prozent|percent|wahrscheinlich|probability|%/i);
    // Und der Add-on-Wächter von mega77 (kein „ungeprueft" im Antwortkörper) bleibt haltbar:
    // keiner der neuen Codes enthält das Wort.
    expect(text).not.toContain("ungeprueft");
  });
});
