import { describe, expect, it } from "vitest";
import type {
  EvidenceRecord,
  KnowledgeObject,
  KoAttachment,
  KoSource,
} from "../../apps/web/src/api/types";
import { analyzeEvidenceConsistency } from "../../apps/web/src/lib/evidenceConsistency";

function source(overrides: Partial<KoSource>): KoSource {
  return {
    id: "src-1",
    label: "Norm DIN 1234",
    url: "https://example.org/din-1234",
    excerpt: null,
    kind: "external",
    peerValidated: false,
    author: "pedi",
    at: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

function attachment(overrides: Partial<KoAttachment>): KoAttachment {
  return {
    id: "att-1",
    name: "Foto.jpg",
    mime: "image/jpeg",
    author: "pedi",
    at: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

function evid(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    id: "ev-1",
    koId: "ko-1",
    koVersion: 1,
    kind: "source",
    label: "Norm DIN 1234",
    createdBy: "pedi",
    createdAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

function ko(
  parts: Partial<Pick<KnowledgeObject, "sources" | "attachments">>,
): Pick<KnowledgeObject, "sources" | "attachments"> {
  return { sources: parts.sources ?? [], attachments: parts.attachments ?? [] };
}

describe("SCRUM-168: analyzeEvidenceConsistency", () => {
  it("vollständige Konsistenz → ok, keine Findings", () => {
    const res = analyzeEvidenceConsistency(
      ko({
        sources: [source({ id: "s1" })],
        attachments: [attachment({ id: "a1", objectId: "obj-1" })],
      }),
      [
        evid({ id: "e1", kind: "source", sourceId: "s1" }),
        evid({
          id: "e2",
          kind: "attachment",
          attachmentId: "a1",
          objectId: "obj-1",
          label: "Foto.jpg",
        }),
      ],
    );
    expect(res.status).toBe("ok");
    expect(res.findings).toEqual([]);
    expect(res).toMatchObject({ sourceCount: 1, attachmentCount: 1, evidenceCount: 2 });
  });

  it("Source ohne Evidence → warning", () => {
    const res = analyzeEvidenceConsistency(ko({ sources: [source({ id: "s1" })] }), []);
    expect(res.status).toBe("warning");
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]).toMatchObject({ kind: "source-without-evidence", ref: "s1" });
  });

  it("Object-Attachment ohne Evidence → warning", () => {
    const res = analyzeEvidenceConsistency(
      ko({ attachments: [attachment({ id: "a1", objectId: "obj-9" })] }),
      [],
    );
    expect(res.status).toBe("warning");
    expect(res.findings[0]).toMatchObject({ kind: "attachment-without-evidence", ref: "a1" });
  });

  it("Evidence ohne Gegenstück → warning (source & attachment)", () => {
    const res = analyzeEvidenceConsistency(ko({}), [
      evid({ id: "e1", kind: "source", sourceId: "ghost" }),
      evid({
        id: "e2",
        kind: "attachment",
        attachmentId: "ghost",
        objectId: "obj-x",
        label: "Weg.jpg",
      }),
    ]);
    expect(res.status).toBe("warning");
    expect(res.findings.map((f) => f.kind).sort()).toEqual([
      "evidence-without-attachment",
      "evidence-without-source",
    ]);
  });

  it("Legacy-DataUrl-Anhang ohne objectId → info-Hinweis, kein Fehler (status ok)", () => {
    const res = analyzeEvidenceConsistency(
      ko({ attachments: [attachment({ id: "leg", dataUrl: "data:image/png;base64,AAAA" })] }),
      [],
    );
    expect(res.status).toBe("ok");
    expect(res.findings).toHaveLength(1);
    expect(res.findings[0]).toMatchObject({ kind: "legacy-inline-attachment", severity: "info" });
  });

  it("matcht Source-Evidence per url-Fallback ohne sourceId", () => {
    const res = analyzeEvidenceConsistency(
      ko({ sources: [source({ id: "s1", url: "https://example.org/x" })] }),
      [evid({ id: "e1", kind: "source", url: "https://example.org/x", label: "anderes Label" })],
    );
    expect(res.status).toBe("ok");
    expect(res.findings).toEqual([]);
  });
});
