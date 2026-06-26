import { describe, expect, it } from "vitest";
import { detectFileKind, joinPdfPages } from "../../apps/web/src/lib/extract";

const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("SCRUM-122/123: detectFileKind", () => {
  it("erkennt Text über Endung und MIME", () => {
    expect(detectFileKind({ name: "notiz.txt", type: "text/plain" })).toBe("text");
    expect(detectFileKind({ name: "daten.csv" })).toBe("text");
    expect(detectFileKind({ name: "log.json" })).toBe("text");
  });

  it("erkennt DOCX (Regression: unverändert)", () => {
    expect(detectFileKind({ name: "anleitung.docx" })).toBe("docx");
    expect(detectFileKind({ name: "ohne-endung", type: WORD_MIME })).toBe("docx");
  });

  it("erkennt PDF über Endung und MIME", () => {
    expect(detectFileKind({ name: "bericht.pdf" })).toBe("pdf");
    expect(detectFileKind({ name: "scan", type: "application/pdf" })).toBe("pdf");
  });

  it("erkennt Bilder", () => {
    expect(detectFileKind({ name: "foto.jpg", type: "image/jpeg" })).toBe("image");
    expect(detectFileKind({ name: "x.png", type: "image/png" })).toBe("image");
  });

  it("alles andere → unsupported", () => {
    expect(detectFileKind({ name: "archiv.zip", type: "application/zip" })).toBe("unsupported");
    expect(detectFileKind({ name: "alt.doc" })).toBe("unsupported");
  });
});

describe("SCRUM-122: joinPdfPages", () => {
  it("verbindet Items je Seite und Seiten mit Leerzeile, trimmt", () => {
    const out = joinPdfPages([
      ["Hallo", "Welt"],
      ["Seite", "zwei"],
    ]);
    expect(out).toBe("Hallo Welt\n\nSeite zwei");
  });

  it("entfernt leere Items und leere Seiten", () => {
    const out = joinPdfPages([["  ", "Text"], [], ["  "]]);
    expect(out).toBe("Text");
  });

  it("leeres PDF → leerer String", () => {
    expect(joinPdfPages([])).toBe("");
  });
});
