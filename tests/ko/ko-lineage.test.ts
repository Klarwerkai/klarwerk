import { describe, expect, it } from "vitest";
import type { AuditEntry, KnowledgeObject, KoSource } from "../../apps/web/src/api/types";
import { koAuditEvents, lineageSummary, relatedKos } from "../../apps/web/src/lib/koLineage";

const src = (label: string, url: string | null = null): KoSource => ({
  id: `src-${label}`,
  label,
  url,
  excerpt: null,
  kind: "external",
  peerValidated: false,
  author: "a",
  at: "2026-01-01",
});

const ko = (p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject =>
  ({
    title: p.id,
    statement: "",
    conditions: [],
    measures: [],
    type: "technik",
    category: "",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    ...p,
  }) as KnowledgeObject;

describe("SCRUM-130: verwandte Wissensobjekte", () => {
  const current = ko({
    id: "K1",
    tags: ["druck", "ventil"],
    category: "Anlage 1",
    sources: [src("DIN 1")],
  });
  const all = [
    current,
    ko({ id: "K2", tags: ["ventil"] }), // Tag
    ko({ id: "K3", category: "Anlage 1" }), // Kategorie
    ko({ id: "K4", sources: [src("DIN 1")] }), // Quelle
    ko({ id: "K5", tags: ["druck"], category: "Anlage 1" }), // Tag + Kategorie
    ko({ id: "K6", tags: ["fremd"], category: "Anlage 9" }), // nichts
  ];

  it("findet KOs über Tag, Kategorie und Quelle, schließt sich selbst aus", () => {
    const r = relatedKos(current, all);
    const ids = r.map((x) => x.id);
    expect(ids).not.toContain("K1");
    expect(ids).toContain("K2");
    expect(ids).toContain("K3");
    expect(ids).toContain("K4");
    expect(ids).not.toContain("K6");
  });

  it("rankt mehrfach verwandte KOs zuerst und nennt Gründe", () => {
    const r = relatedKos(current, all);
    expect(r[0]?.id).toBe("K5"); // Tag + Kategorie
    expect(r[0]?.reasons).toEqual(expect.arrayContaining(["tag", "category"]));
  });

  it("respektiert das Limit", () => {
    expect(relatedKos(current, all, 2)).toHaveLength(2);
  });
});

describe("SCRUM-142: Lineage/Herkunft", () => {
  it("filtert Audit-Ereignisse nach target und sortiert nach seq", () => {
    const entries: AuditEntry[] = [
      {
        seq: 3,
        at: "c",
        actor: "x",
        action: "ko.revised",
        target: "K1",
        payload: {},
        prevHash: "",
        hash: "",
      },
      {
        seq: 1,
        at: "a",
        actor: "x",
        action: "ko.created",
        target: "K1",
        payload: {},
        prevHash: "",
        hash: "",
      },
      {
        seq: 2,
        at: "b",
        actor: "x",
        action: "ko.commented",
        target: "K9",
        payload: {},
        prevHash: "",
        hash: "",
      },
    ];
    const ev = koAuditEvents(entries, "K1");
    expect(ev.map((e) => e.seq)).toEqual([1, 3]);
  });

  it("leitet Herkunftskennzahlen aus echten Feldern ab", () => {
    const k = ko({
      id: "K1",
      version: 4,
      author: "bob",
      originalAuthor: "anna",
      sources: [src("A"), src("B")],
      history: [
        { version: 1, at: "x", author: "anna", note: "erstellt" },
        { version: 2, at: "y", author: "anna", note: "überarbeitet" },
      ],
    });
    const s = lineageSummary(k, 5);
    expect(s.authorTransferred).toBe(true);
    expect(s.versions).toBe(4);
    expect(s.historyCount).toBe(2);
    expect(s.sourceCount).toBe(2);
    expect(s.relatedCount).toBe(5);
  });
});
