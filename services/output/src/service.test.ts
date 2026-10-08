import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../knowledge-object";
import { OutputService } from "./service";

function ko(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: p.id,
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    ...p,
  } as KnowledgeObject;
}

async function setup(kos: KnowledgeObject[]) {
  const repo = new InMemoryKoRepo();
  for (const k of kos) {
    await repo.insert(k);
  }
  const koService = new KoService({ repo });
  const output = new OutputService({ koService, now: () => Date.parse("2026-06-26T00:00:00Z") });
  return { output };
}

describe("OutputService (SCRUM-117 / FE-OUT)", () => {
  let svc: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    svc = await setup([
      ko({
        id: "K1",
        title: "Ventil schließen",
        statement: "Bei Überdruck schließen.",
        conditions: ["Druck > 6 bar"],
        measures: ["Hauptventil zudrehen", "Druck ablassen"],
        trust: 85,
        version: 2,
        author: "bob",
        originalAuthor: "anna",
      }),
      ko({ id: "K2", title: "Offenes Objekt", status: "offen", trust: 40 }),
      ko({ id: "K3", title: "Schwaches Wissen", trust: 30 }),
    ]);
  });

  it("listEligible liefert nur validierte KOs", async () => {
    const sources = await svc.output.listEligible();
    expect(sources.map((s) => s.id).sort()).toEqual(["K1", "K3"]);
    expect(sources.every((s) => s.status === "validiert")).toBe(true);
  });

  it("generate lehnt nicht-validierte Quelle ab (NOT_VALIDATED)", async () => {
    await expect(svc.output.generate({ kind: "instruction", koIds: ["K2"] })).rejects.toMatchObject(
      { code: "NOT_VALIDATED" },
    );
  });

  it("generate lehnt unbekannte KO-ID + leere Auswahl + unbekannten Typ ab", async () => {
    await expect(svc.output.generate({ kind: "instruction", koIds: ["X"] })).rejects.toMatchObject({
      code: "UNKNOWN_KO",
    });
    await expect(svc.output.generate({ kind: "instruction", koIds: [] })).rejects.toMatchObject({
      code: "NO_SOURCES",
    });
    await expect(
      // @ts-expect-error: ungültiger Typ wird zur Laufzeit abgewiesen
      svc.output.generate({ kind: "marketing", koIds: ["K1"] }),
    ).rejects.toMatchObject({ code: "UNKNOWN_KIND" });
  });

  it("jeder Output-Typ erzeugt strukturiertes Markdown mit KO-Inhalt", async () => {
    for (const kind of [
      "instruction",
      "checklist",
      "troubleshooting",
      "training",
      "management_summary",
    ] as const) {
      const doc = await svc.output.generate({ kind, koIds: ["K1"], audienceRole: "experte" });
      expect(doc.markdown).toContain("Ventil schließen");
      expect(doc.markdown.length).toBeGreaterThan(40);
      expect(doc.kind).toBe(kind);
      expect(doc.audienceRole).toBe("experte");
      expect(doc.generatedAt).toBe("2026-06-26T00:00:00.000Z");
    }
  });

  it("checklist nutzt abhakbare Punkte aus measures", async () => {
    const doc = await svc.output.generate({ kind: "checklist", koIds: ["K1"] });
    expect(doc.markdown).toContain("- [ ] Hauptventil zudrehen");
  });

  it("Provenance je Quelle: KO-ID, Status, Trust, Version, Autor, abgeleitete Gültigkeit", async () => {
    const doc = await svc.output.generate({ kind: "instruction", koIds: ["K1"] });
    const p = doc.provenance[0];
    expect(p).toMatchObject({
      koId: "K1",
      status: "validiert",
      trust: 85,
      version: 2,
      author: "bob",
      originalAuthor: "anna",
      uncertain: false,
    });
    expect(p?.validity).toBe("validiert · v2 · Stand 2026-01-01");
    expect(doc.markdown).toContain("## Herkunft & Nachweis");
    expect(doc.markdown).toContain("`K1`");
  });

  it("markiert niedrigen Trust als Unsicherheit", async () => {
    const doc = await svc.output.generate({ kind: "instruction", koIds: ["K3"] });
    expect(doc.provenance[0]?.uncertain).toBe(true);
    expect(doc.markdown).toContain("niedriger Trust");
  });
});

// aufnahme:20260922:gesamt-dokumenterzeugung — R-0337 / R-1739: Pflichtangaben je Quelle aus den
// Feldern des Wissensobjekts; Fehlendes ist als Unsicherheit ausgewiesen, nicht ergänzt. R-0732: FAQ.
describe("OutputService · Pflichtangaben je Quelle und FAQ", () => {
  it("übernimmt Geltung, Verantwortung, Validierer und Fassungsdatum aus dem Objekt", async () => {
    const { output } = await setup([
      ko({
        id: "G1",
        title: "Ventil drucklos",
        version: 3,
        trust: 90,
        geltung: { ebene: "werk", werk: "Werk Nord", rolle: "Instandhaltung" },
        ownership: { owner: "meister-1", reviewers: [], validators: ["pruefer-1"] },
        history: [
          { version: 1, at: "2026-08-01T08:00:00.000Z", author: "anna", note: "erstellt" },
          { version: 3, at: "2026-09-30T08:00:00.000Z", author: "anna", note: "überarbeitet" },
        ],
      }),
    ]);
    const doc = await output.generate({
      kind: "instruction",
      koIds: ["G1"],
      audienceRole: "Schicht",
    });
    expect(doc.provenance[0]).toMatchObject({
      geltungsbereich: "Werks-Praxis (Werk Nord), Rolle Instandhaltung",
      verantwortlich: "meister-1",
      validiertVon: ["pruefer-1"],
      fassungVom: "2026-09-30T08:00:00.000Z",
      letztePruefungAm: null,
      unsicherheiten: ["pruefdatum_fehlt"],
    });
    expect(doc.markdown).toContain(
      "  Gültigkeitsbereich: Werks-Praxis (Werk Nord), Rolle Instandhaltung · Verantwortung: meister-1 · Fassung vom: 2026-09-30 · Letzte Prüfung: nicht festgehalten (validiert von pruefer-1)",
    );
    expect(doc.markdown).toContain(
      "  Offene Unsicherheiten: Datum der letzten Prüfung nicht festgehalten",
    );
  });

  it("fehlende Angaben werden benannt, nicht abgeleitet — Verantwortung fällt NICHT auf den Autor", async () => {
    const { output } = await setup([ko({ id: "L1", title: "Lückenhaft", trust: 30, version: 2 })]);
    const doc = await output.generate({ kind: "instruction", koIds: ["L1"] });
    const p = doc.provenance[0];
    expect(p?.geltungsbereich).toBeNull();
    expect(p?.verantwortlich).toBeNull();
    expect(p?.fassungVom).toBeNull();
    expect(p?.unsicherheiten).toEqual([
      "niedriger_trust",
      "geltung_fehlt",
      "verantwortung_fehlt",
      "pruefdatum_fehlt",
    ]);
    expect(doc.markdown).toContain(
      "  Gültigkeitsbereich: nicht angegeben · Verantwortung: nicht benannt · Fassung vom: nicht festgehalten · Letzte Prüfung: nicht festgehalten",
    );
  });

  it("FAQ: je Quelle Frage und Antwort aus Titel, Aussage, Bedingungen und Maßnahmen", async () => {
    const { output } = await setup([
      ko({
        id: "F1",
        title: "Wie wird das Ventil entlastet?",
        statement: "Vor jeder Wartung drucklos schalten.",
        conditions: ["Wartung am Druckventil"],
        measures: ["Absperrhahn schließen", "Manometer prüfen"],
      }),
    ]);
    const doc = await output.generate({ kind: "faq", koIds: ["F1"] });
    expect(doc.title).toBe("FAQ");
    expect(doc.markdown).toContain("### Wie wird das Ventil entlastet?");
    expect(doc.markdown).toContain("**Gilt, wenn:** Wartung am Druckventil");
    expect(doc.markdown).toContain("1. Absperrhahn schließen");
    expect(doc.markdown).toContain("## Herkunft & Nachweis");
  });
});
