// WP-UX-WOW-1 U1: pure Parser-/Strip-Logik der Antwort-Darstellung. Das Subset (Überschriften
// h3/h4, fett/kursiv, Listen, Absätze) wird strukturiert geparst; alles andere bleibt Text —
// gerendert wird ausschließlich über React-Elemente (kein HTML-Sink, Test dazu mounted).
import { describe, expect, it } from "vitest";
import {
  parseAnswerInline,
  parseAnswerMarkdown,
  stripAnswerMarkdown,
} from "../../apps/web/src/lib/answerMarkdown";

describe("WP-UX-WOW-1 U1: parseAnswerMarkdown", () => {
  it("zerlegt Überschriften, Absätze und Listen in Subset-Segmente", () => {
    const segments = parseAnswerMarkdown(
      "## Antwort\nVentil **vorher** entlasten.\n\n### Fazit\n- Druck prüfen\n- Ventil schließen\n\n1. Erst A\n2. Dann B",
    );
    expect(segments.map((s) => s.kind)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "list",
      "list",
    ]);
    expect(segments[0]).toMatchObject({ kind: "heading", level: 3 });
    expect(segments[2]).toMatchObject({ kind: "heading", level: 4 });
    expect(segments[3]).toMatchObject({ kind: "list", ordered: false });
    expect(segments[4]).toMatchObject({ kind: "list", ordered: true });
  });

  it("fett/kursiv als Inline-Teile; unpaarige Marker bleiben wörtlicher Text", () => {
    expect(parseAnswerInline("Ventil **vorher** und *danach* prüfen.")).toEqual([
      { kind: "text", text: "Ventil " },
      { kind: "bold", text: "vorher" },
      { kind: "text", text: " und " },
      { kind: "italic", text: "danach" },
      { kind: "text", text: " prüfen." },
    ]);
    expect(parseAnswerInline("**unpaarig bleibt")).toEqual([
      { kind: "text", text: "**unpaarig bleibt" },
    ]);
  });

  it("HTML/Script wird NIE strukturell interpretiert — es bleibt reiner Text-Teil", () => {
    const segments = parseAnswerMarkdown('<script>alert("x")</script> und <b>fett</b>');
    expect(segments).toEqual([
      {
        kind: "paragraph",
        parts: [{ kind: "text", text: '<script>alert("x")</script> und <b>fett</b>' }],
      },
    ]);
  });

  it("mehrzeilige Absätze werden zusammengeführt, Leerzeile trennt", () => {
    const segments = parseAnswerMarkdown("Zeile eins\nZeile zwei\n\nNeuer Absatz");
    expect(segments.length).toBe(2);
    expect(segments[0]).toMatchObject({ kind: "paragraph" });
  });
});

describe("WP-UX-WOW-1 U1: stripAnswerMarkdown (Klartext-Fassung)", () => {
  it("entfernt Marker, erhält Inhalt und Listenstruktur als Zeilen", () => {
    expect(
      stripAnswerMarkdown("## Antwort\n**Ventil** *entlasten*.\n\n- Druck prüfen\n1. Erst A"),
    ).toBe("Antwort\nVentil entlasten.\n- Druck prüfen\n1. Erst A");
  });

  it("reiner Text bleibt unverändert", () => {
    expect(stripAnswerMarkdown("Kein Markdown, nur Text.")).toBe("Kein Markdown, nur Text.");
  });
});
