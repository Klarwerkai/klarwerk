import { describe, expect, it } from "vitest";
import { wholeDocumentDraftPayload } from "../../apps/web/src/lib/captureFromFile";
import {
  MAX_INLINE_BODY_HTML_BYTES,
  applyInlineImageBudget,
  utf8ByteLength,
} from "../../apps/web/src/lib/docx";
import { DRAFTS_BODY_LIMIT } from "../../services/app/src/routes/capture-routes";

// WP-D1c (bens ROT-Fix, echte Garantie): der clientseitig gebaute Draft-Payload bleibt — in ECHTEN
// UTF-8-Bytes, inkl. JSON-Envelope/Escaping — UNTER dem Server-Ceiling DRAFTS_BODY_LIMIT. Bilder werden
// komprimiert BEHALTEN; nur als Notbremse fällt eines.

const imgTag = (payload: string): string => `<img src="data:image/jpeg;base64,${payload}">`;
const identity = async (src: string): Promise<string> => src;

describe("WP-D1c: Draft-Payload bleibt unter DRAFTS_BODY_LIMIT", () => {
  it("das Client-Budget lässt reichlich Puffer zum Server-Ceiling", () => {
    expect(MAX_INLINE_BODY_HTML_BYTES).toBeLessThan(DRAFTS_BODY_LIMIT);
    // ≥ 8 MiB Puffer für JSON-Envelope, Escaping und weitere Felder.
    expect(DRAFTS_BODY_LIMIT - MAX_INLINE_BODY_HTML_BYTES).toBeGreaterThanOrEqual(8 * 1024 * 1024);
  });

  it("ein bildreicher Payload bleibt (UTF-8, JSON.stringify) unter dem Ceiling", async () => {
    // Mehr Bilder als ins Budget passen → das Budget deckelt, der Rest fällt als Notbremse.
    const many = Array.from({ length: 70 }, (_, i) =>
      imgTag(`${i}`.padStart(6, "0").repeat(33_000)),
    ).join("");
    const budgeted = await applyInlineImageBudget(
      `<h2>Handbuch</h2>${many}`,
      identity,
      MAX_INLINE_BODY_HTML_BYTES,
    );
    // Das budgetierte bodyHtml selbst bleibt unter dem Client-Budget.
    expect(utf8ByteLength(budgeted.html)).toBeLessThanOrEqual(MAX_INLINE_BODY_HTML_BYTES);
    expect(budgeted.dropped).toBeGreaterThan(0); // bildreich → Notbremse griff

    const payload = wholeDocumentDraftPayload({
      fileName: "handbuch.docx",
      text: "Wartungshandbuch mit vielen Diagrammen — Übersicht 📄.",
      html: budgeted.html,
      sourceKind: "docx",
      locale: "de",
    });
    const jsonBytes = utf8ByteLength(JSON.stringify(payload));
    expect(jsonBytes).toBeLessThan(DRAFTS_BODY_LIMIT);
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
    // UTF-8 zählt Mehrbyte-Zeichen höher als die reine String-Länge (UTF-16-Codeeinheiten).
    expect(utf8ByteLength(json)).toBeGreaterThan(json.length);
  });

  it("Kompression senkt Bytes → mehr Bilder passen ins selbe Budget als ohne", async () => {
    const raw = Array.from({ length: 8 }, () => imgTag("Q".repeat(1000))).join("");
    const budget = 3000;
    const withoutCompression = await applyInlineImageBudget(raw, identity, budget);
    // „Kompression": encode gibt eine deutlich kleinere data-URL zurück.
    const shrink = async (): Promise<string> => "data:image/jpeg;base64,QQQQ";
    const withCompression = await applyInlineImageBudget(raw, shrink, budget);
    const keptWithout = withoutCompression.total - withoutCompression.dropped;
    const keptWith = withCompression.total - withCompression.dropped;
    expect(keptWith).toBeGreaterThan(keptWithout); // komprimiert passen mehr Bilder → nicht wegwerfen
  });
});
