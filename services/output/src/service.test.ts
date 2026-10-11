import { beforeEach, describe, expect, it } from "vitest";
import { type AuditEntry, AuditService, InMemoryAuditRepo } from "../../audit";
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
// Feldern des Wissensobjekts und seinem Validierungsnachweis; Fehlendes ist als Unsicherheit
// ausgewiesen, nicht ergänzt. R-0349/R-0414: Quellenmarke je Passage. R-0732: FAQ. R-0350:
// Betriebsmitteilung.

const PRUEFZEIT = Date.parse("2026-10-01T09:00:00Z");

/** Ein Bestand MIT echter Auditkette: die Prüfentscheidungen werden wirklich aufgezeichnet. */
async function setupMitAudit(
  bauen: (belege: {
    frei: AuditEntry;
    alt: AuditEntry;
  }) => KnowledgeObject[],
) {
  const auditRepo = new InMemoryAuditRepo();
  const audit = new AuditService({ repo: auditRepo, now: () => PRUEFZEIT });
  const frei = await audit.record({
    actor: "pruefer-1",
    action: "ko.admin-validated",
    target: "G1",
    payload: { koVersion: 3 },
  });
  const alt = await audit.record({
    actor: "pruefer-1",
    action: "ko.admin-validated",
    target: "G2",
    payload: { koVersion: 1 },
  });
  const repo = new InMemoryKoRepo();
  for (const k of bauen({ frei, alt })) {
    await repo.insert(k);
  }
  const koService = new KoService({ repo });
  return new OutputService({ koService, audit: auditRepo, now: () => PRUEFZEIT });
}

describe("OutputService · Pflichtangaben je Quelle (R-0337/R-1739)", () => {
  it("übernimmt Geltung, verantwortliche Rolle, Verantwortung, Fassungs- UND Prüfdatum aus Objekt und Audit", async () => {
    const output = await setupMitAudit(({ frei }) => [
      ko({
        id: "G1",
        title: "Ventil drucklos",
        version: 3,
        trust: 90,
        geltung: { ebene: "werk", werk: "Werk Nord", rolle: "Instandhaltung" },
        ownership: {
          owner: "meister-1",
          ownerRole: "Instandhaltungsleitung",
          reviewers: [],
          validators: ["pruefer-1"],
        },
        validationDecisionRef: { auditSeq: frei.seq, auditHash: frei.hash },
        history: [
          { version: 1, at: "2026-08-01T08:00:00.000Z", author: "anna", note: "erstellt" },
          { version: 3, at: "2026-09-30T08:00:00.000Z", author: "anna", note: "überarbeitet" },
        ],
      }),
    ]);
    const doc = await output.generate({ kind: "instruction", koIds: ["G1"] });
    expect(doc.provenance[0]).toMatchObject({
      marke: "Q1",
      geltungsbereich: "Werks-Praxis (Werk Nord), Rolle Instandhaltung",
      verantwortlicheRolle: "Instandhaltungsleitung",
      verantwortlich: "meister-1",
      validiertVon: ["pruefer-1"],
      fassungVom: "2026-09-30T08:00:00.000Z",
      letztePruefungAm: "2026-10-01T09:00:00.000Z",
      unsicherheiten: [],
    });
    expect(doc.markdown).toContain(
      "  Gültigkeitsbereich: Werks-Praxis (Werk Nord), Rolle Instandhaltung · Verantwortliche Rolle: Instandhaltungsleitung · Verantwortung: meister-1 · Fassung vom: 2026-09-30 · Letzte Prüfung: 2026-10-01 (validiert von pruefer-1)",
    );
    expect(doc.markdown).toContain("  Offene Unsicherheiten: keine");
  });

  it("ein Prüfnachweis für eine FRÜHERE Fassung belegt kein Prüfdatum — und das steht da", async () => {
    const output = await setupMitAudit(({ alt }) => [
      ko({
        id: "G2",
        title: "Überholt geprüft",
        version: 2,
        validationDecisionRef: { auditSeq: alt.seq, auditHash: alt.hash },
      }),
    ]);
    const doc = await output.generate({ kind: "instruction", koIds: ["G2"] });
    expect(doc.provenance[0]?.letztePruefungAm).toBeNull();
    expect(doc.provenance[0]?.unsicherheiten).toContain("pruefnachweis_fremde_fassung");
    expect(doc.markdown).toContain("Prüfnachweis gilt einer früheren Fassung");
  });

  it("ein manipulierter Nachweis (falscher Hash) belegt nichts", async () => {
    const output = await setupMitAudit(({ frei }) => [
      ko({
        id: "G1",
        title: "Gefälscht",
        version: 3,
        validationDecisionRef: { auditSeq: frei.seq, auditHash: "0".repeat(64) },
      }),
    ]);
    const doc = await output.generate({ kind: "instruction", koIds: ["G1"] });
    expect(doc.provenance[0]?.letztePruefungAm).toBeNull();
    expect(doc.provenance[0]?.unsicherheiten).toContain("pruefnachweis_ungueltig");
  });

  it("fehlende Angaben werden benannt, nicht abgeleitet — Verantwortung fällt NICHT auf den Autor", async () => {
    const { output } = await setup([ko({ id: "L1", title: "Lückenhaft", trust: 30, version: 2 })]);
    const doc = await output.generate({ kind: "instruction", koIds: ["L1"] });
    const p = doc.provenance[0];
    expect(p?.geltungsbereich).toBeNull();
    expect(p?.verantwortlich).toBeNull();
    expect(p?.verantwortlicheRolle).toBeNull();
    expect(p?.fassungVom).toBeNull();
    expect(p?.unsicherheiten).toEqual([
      "niedriger_trust",
      "geltung_fehlt",
      "verantwortung_fehlt",
      "rolle_fehlt",
      "pruefdatum_fehlt",
    ]);
    expect(doc.markdown).toContain(
      "  Gültigkeitsbereich: nicht angegeben · Verantwortliche Rolle: nicht benannt · Verantwortung: nicht benannt · Fassung vom: nicht festgehalten · Letzte Prüfung: nicht belegt",
    );
  });
});

describe("OutputService · Quellenmarke je tragender Passage (R-0349/R-0414)", () => {
  it("zwei gleichnamige Quellen bleiben in jeder Dokumentart eindeutig unterscheidbar", async () => {
    const { output } = await setup([
      ko({ id: "D1", title: "Ventil prüfen", measures: ["Sichtprüfung"] }),
      ko({ id: "D2", title: "Ventil prüfen", measures: ["Druckprüfung"], version: 4 }),
    ]);
    for (const kind of [
      "instruction",
      "checklist",
      "troubleshooting",
      "training",
      "management_summary",
      "faq",
      "betriebsmitteilung",
    ] as const) {
      const doc = await output.generate({ kind, koIds: ["D1", "D2"] });
      // Im Rumpf: Kennung UND Fassung je Quelle …
      const rumpf = doc.markdown.slice(0, doc.markdown.indexOf("## Herkunft & Nachweis"));
      expect(rumpf, kind).toContain("[Q1: D1 · v1]");
      expect(rumpf, kind).toContain("[Q2: D2 · v4]");
      // … und dieselbe Marke führt eindeutig in den Herkunftsblock.
      expect(doc.markdown, kind).toContain("- [Q1] **Ventil prüfen** (`D1`, Fassung 1)");
      expect(doc.markdown, kind).toContain("- [Q2] **Ventil prüfen** (`D2`, Fassung 4)");
    }
  });

  it("die Marke steht an der Passage selbst: Überschrift des Blocks bzw. die Zeile", async () => {
    const { output } = await setup([ko({ id: "D1", title: "Ventil prüfen", measures: ["A"] })]);
    const anweisung = await output.generate({ kind: "instruction", koIds: ["D1"] });
    expect(anweisung.markdown).toContain("## 1. Ventil prüfen [Q1: D1 · v1]");
    const summary = await output.generate({ kind: "management_summary", koIds: ["D1"] });
    expect(summary.markdown).toMatch(/^- Ventil prüfen — Aussage .* \[Q1: D1 · v1\]$/m);
  });
});

describe("OutputService · Betriebsmitteilung (R-0350)", () => {
  it("Betreff, Anrede, Sie-Form, geltende Punkte mit Quellenmarke, Ansprechpartner, Gruß — als Entwurf ohne KI", async () => {
    const { output } = await setup([
      ko({
        id: "U1",
        title: "Resturlaub",
        statement: "Resturlaub aus dem Vorjahr verfällt am 31. März.",
        conditions: ["Urlaub wurde nicht genommen"],
        measures: ["Resturlaub bis 15. März beantragen"],
        ownership: { ownerRole: "Personalabteilung", reviewers: [], validators: [] },
      }),
    ]);
    const doc = await output.generate({
      kind: "betriebsmitteilung",
      koIds: ["U1"],
      audienceRole: "Produktion",
      anlass: "Urlaubstage 2027",
    });
    expect(doc.title).toBe("Betriebsmitteilung");
    const zeilen = doc.markdown.split("\n");
    expect(zeilen[2]).toMatch(
      /^_Entwurf · an: Produktion · aus 1 geprüften Quelle\(n\) zusammengestellt, ohne KI · erstellt am .* · vor dem Versand prüfen, kürzen und unterschreiben_$/,
    );
    for (const teil of [
      "**Betreff:** Urlaubstage 2027",
      "Liebe Kolleginnen und Kollegen (Produktion),",
      "wir möchten Sie über Folgendes informieren: Urlaubstage 2027. Für Sie gilt:",
      "**Resturlaub** [Q1: U1 · v1]",
      "Resturlaub aus dem Vorjahr verfällt am 31. März.",
      "Das gilt, wenn: Urlaub wurde nicht genommen.",
      "Bitte beachten Sie:",
      "1. Resturlaub bis 15. März beantragen",
      "Bei Rückfragen wenden Sie sich bitte an: Personalabteilung.",
      "Mit freundlichen Grüßen",
      "[Name, Funktion]",
    ]) {
      expect(zeilen, teil).toContain(teil);
    }
    // Reihenfolge der Gattung: Betreff → Anrede → Punkte → Ansprechpartner → Gruß → Unterschrift.
    const stelle = (t: string): number => zeilen.indexOf(t);
    expect(stelle("**Betreff:** Urlaubstage 2027")).toBeLessThan(
      stelle("Liebe Kolleginnen und Kollegen (Produktion),"),
    );
    expect(stelle("**Resturlaub** [Q1: U1 · v1]")).toBeLessThan(stelle("Mit freundlichen Grüßen"));
    expect(stelle("Mit freundlichen Grüßen")).toBeLessThan(stelle("[Name, Funktion]"));
  });

  it("ohne benannte Rolle steht ein sichtbarer Platzhalter statt eines erfundenen Ansprechpartners", async () => {
    const { output } = await setup([ko({ id: "U2", title: "Gleitzeit" })]);
    const doc = await output.generate({ kind: "betriebsmitteilung", koIds: ["U2"] });
    expect(doc.markdown).toContain("**Betreff:** Gleitzeit");
    expect(doc.markdown).toContain("Liebe Kolleginnen und Kollegen,");
    expect(doc.markdown).toContain(
      "Bei Rückfragen wenden Sie sich bitte an: [Ansprechpartner eintragen].",
    );
  });
});

describe("OutputService · FAQ", () => {
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
    expect(doc.markdown).toContain("### Wie wird das Ventil entlastet? [Q1: F1 · v1]");
    expect(doc.markdown).toContain("**Gilt, wenn:** Wartung am Druckventil");
    expect(doc.markdown).toContain("1. Absperrhahn schließen");
    expect(doc.markdown).toContain("## Herkunft & Nachweis");
  });
});
