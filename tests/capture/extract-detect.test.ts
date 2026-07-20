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

  // WP-D5b (bens GELB-Fix 4): PPTX-Erkennung über die zentrale Reihenfolge — die Endung .pptx gewinnt
  // gegen einen irreführenden MIME text/plain (sonst landete die Präsentation im Text-Pfad).
  it("erkennt PPTX über Endung und MIME; .pptx schlägt text/plain", () => {
    const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    expect(detectFileKind({ name: "deck.pptx" })).toBe("pptx");
    expect(detectFileKind({ name: "ohne-endung", type: PPTX_MIME })).toBe("pptx");
    // Der Kern-Bug: eine .pptx mit MIME text/plain darf NICHT als Text erkannt werden.
    expect(detectFileKind({ name: "deck.pptx", type: "text/plain" })).toBe("pptx");
  });
});

// WP-D3: joinPdfPages verbindet jetzt rekonstruierte ZEILEN je Seite (Zeilen mit \n, Seiten mit \n\n),
// statt Items einer Seite mit Leerzeichen zu EINER Zeile zu kleben.
describe("SCRUM-122 / WP-D3: joinPdfPages (Zeilenformat)", () => {
  it("verbindet Zeilen je Seite mit Zeilenumbruch und Seiten mit Leerzeile", () => {
    const out = joinPdfPages([["Hallo Welt", "zweite Zeile"], ["Seite zwei"]]);
    expect(out).toBe("Hallo Welt\nzweite Zeile\n\nSeite zwei");
  });

  it("erhält Absatz-Leerzeilen, glättet Rand-/Mehrfach-Leerzeilen, entfernt leere Seiten", () => {
    const out = joinPdfPages([["", "Absatz eins", "", "Absatz zwei", ""], [], ["   "]]);
    expect(out).toBe("Absatz eins\n\nAbsatz zwei");
  });

  it("leeres PDF → leerer String", () => {
    expect(joinPdfPages([])).toBe("");
  });
});
