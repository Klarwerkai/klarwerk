import { describe, expect, it } from "vitest";
import {
  DRAFT_PAYLOAD_LIMIT_BYTES,
  draftPayloadByteLength,
  draftPayloadWithinLimit,
  wholeDocumentDraftPayload,
} from "../../apps/web/src/lib/captureFromFile";
import {
  MAX_INLINE_BODY_HTML_BYTES,
  applyInlineImageBudget,
  utf8ByteLength,
} from "../../apps/web/src/lib/docx";
import { DRAFTS_BODY_LIMIT } from "../../services/app/src/routes/capture-routes";

// WP-D1d (bens ROT-Fix 2, echte Garantie): der finale, serialisierte Draft-Payload bleibt — in ECHTEN
// UTF-8-Bytes, inkl. JSON-Envelope/Escaping — UNTER dem Server-Ceiling DRAFTS_BODY_LIMIT. Bilder werden
// komprimiert BEHALTEN; nur als Notbremse fällt eines. Getestet wird die GESAMTGARANTIE (JSON-Payload),
// nicht nur der Bildhelfer — für bildreich, text-schwer mit langem Tail und den Kein-Bild-Fall.

const imgTag = (payload: string): string => `<img src="data:image/jpeg;base64,${payload}">`;
const identity = async (src: string): Promise<string> => src;

describe("WP-D1d: Draft-Payload bleibt unter DRAFTS_BODY_LIMIT", () => {
  it("die Grenzen sind gestaffelt: Bild-Budget < Payload-Grenze < Server-Ceiling", () => {
    expect(MAX_INLINE_BODY_HTML_BYTES).toBeLessThan(DRAFT_PAYLOAD_LIMIT_BYTES);
    expect(DRAFT_PAYLOAD_LIMIT_BYTES).toBeLessThan(DRAFTS_BODY_LIMIT);
    expect(DRAFTS_BODY_LIMIT).toBe(5 * 1024 * 1024);
  });

  it("bildreicher Fall: finaler JSON-Payload < DRAFTS_BODY_LIMIT (UTF-8)", async () => {
    // Mehr Bilder als ins Budget passen → das Budget deckelt, der Rest fällt als Notbremse.
    const many = Array.from({ length: 60 }, (_, i) =>
      imgTag(`${i}`.padStart(6, "0").repeat(20_000)),
    ).join("");
    const budgeted = await applyInlineImageBudget(
      `<h2>Handbuch</h2>${many}`,
      identity,
      MAX_INLINE_BODY_HTML_BYTES,
    );
    expect(utf8ByteLength(budgeted.html)).toBeLessThanOrEqual(MAX_INLINE_BODY_HTML_BYTES);
    expect(budgeted.dropped).toBeGreaterThan(0); // bildreich → Notbremse griff

    const payload = wholeDocumentDraftPayload({
      fileName: "handbuch.docx",
      text: "Wartungshandbuch mit vielen Diagrammen — Übersicht 📄.",
      html: budgeted.html,
      sourceKind: "docx",
      locale: "de",
    });
    expect(draftPayloadByteLength(payload)).toBeLessThan(DRAFTS_BODY_LIMIT);
    expect(draftPayloadWithinLimit(payload)).toBe(true);
  });

  it("text-schwer MIT langem Tail nach dem letzten Bild: finaler Payload < Ceiling", async () => {
    // Ein Bild, dann sehr viel Text (Tail) — der Tail zählt ins Budget (bens Fix 1); die Gesamtgarantie
    // gilt für den serialisierten Payload, nicht nur den Bildhelfer.
    const longTail = `<p>${"Wartungsschritt mit Detailbeschreibung. ".repeat(20_000)}</p>`;
    const budgeted = await applyInlineImageBudget(
      `${imgTag("Z".repeat(50_000))}${longTail}`,
      identity,
      MAX_INLINE_BODY_HTML_BYTES,
    );
    expect(utf8ByteLength(budgeted.html)).toBeLessThanOrEqual(MAX_INLINE_BODY_HTML_BYTES);
    const payload = wholeDocumentDraftPayload({
      fileName: "text-schwer.docx",
      text: "Sehr langes Dokument.",
      html: budgeted.html,
      sourceKind: "docx",
      locale: "de",
    });
    expect(draftPayloadByteLength(payload)).toBeLessThan(DRAFTS_BODY_LIMIT);
  });

  it("Kein-Bild-Fall (reiner Markdown-Text): finaler Payload < Ceiling", () => {
    const payload = wholeDocumentDraftPayload({
      fileName: "notiz.md",
      text: `# Titel\n\n${"Ein Absatz mit Inhalt. ".repeat(500)}`,
      sourceKind: "text",
      locale: "de",
    });
    expect(draftPayloadByteLength(payload)).toBeLessThan(DRAFTS_BODY_LIMIT);
    expect(draftPayloadWithinLimit(payload)).toBe(true);
  });

  it("mehrbyteiger Text im Payload wird korrekt (UTF-8) gemessen, nicht als UTF-16", () => {
    const payload = wholeDocumentDraftPayload({
      fileName: "smörgåsbord-📄.docx",
      text: "Ölstand prüfen — Größe 5 µm. 📄📄📄",
      html: "<p>Ölstand — 📄</p>",
      sourceKind: "docx",
      locale: "de",
    });
    const json = JSON.stringify(payload);
    expect(utf8ByteLength(json)).toBeGreaterThan(json.length);
  });

  it("überlanger Payload → draftPayloadWithinLimit false (ehrlicher Abbruch statt 413)", () => {
    const payload = wholeDocumentDraftPayload({
      fileName: "riesig.docx",
      text: "x".repeat(DRAFT_PAYLOAD_LIMIT_BYTES + 1000),
      sourceKind: "docx",
      locale: "de",
    });
    expect(draftPayloadWithinLimit(payload)).toBe(false);
  });

  it("Kompression senkt Bytes → mehr Bilder passen ins selbe Budget als ohne", async () => {
    const raw = Array.from({ length: 8 }, () => imgTag("Q".repeat(1000))).join("");
    const budget = 3000;
    const withoutCompression = await applyInlineImageBudget(raw, identity, budget);
    const shrink = async (): Promise<string> => "data:image/jpeg;base64,QQQQ";
    const withCompression = await applyInlineImageBudget(raw, shrink, budget);
    expect(withCompression.kept).toBeGreaterThan(withoutCompression.kept);
    expect(withCompression.compressed).toBe(withCompression.kept); // alle behaltenen wurden re-encodiert
  });
});
