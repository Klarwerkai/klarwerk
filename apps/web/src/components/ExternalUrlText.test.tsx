import { describe, expect, it } from "vitest";
import { renderMarkup } from "../test/render";
import { ExternalUrlText } from "./ExternalUrlText";

// SCRUM-527 (WP2, ben-Check V2): die GETEILTE defensive Grenze für alle externen Treffer-/Quelllinks
// (KnowledgeDetail, Enrich-Panel, Capture, ExternalKnowledge). Eine unsichere URL darf NIE zu einem
// aktiven <a href> werden — auch nicht, wenn ein Leading-Icon davorsteht.

describe("ExternalUrlText", () => {
  it("sichere http/https-URL → aktiver Link mit href", () => {
    const html = renderMarkup(<ExternalUrlText url="https://ex.com/a" className="x" />);
    expect(html).toContain('href="https://ex.com/a"');
    expect(html).toContain("<a ");
  });

  it("unsichere/relative URL → KEIN aktives <a>/href (reiner Text)", () => {
    for (const evil of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "//evil.com/x",
      "/relative",
    ]) {
      const html = renderMarkup(<ExternalUrlText url={evil} className="x" />);
      // Die URL erscheint höchstens als harmloser Text — aber NIE als aktiver Link (kein <a>/href).
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("href=");
    }
  });

  it("Leading-Icon: auch mit vorangestelltem Element bleibt die unsichere URL ein toter Text", () => {
    const safe = renderMarkup(
      <ExternalUrlText url="https://ex.com/a" leading={<svg data-icon="link" />} />,
    );
    expect(safe).toContain('href="https://ex.com/a"');
    expect(safe).toContain("data-icon"); // Icon erscheint im Link
    const evil = renderMarkup(
      <ExternalUrlText url="javascript:alert(1)" leading={<svg data-icon="link" />} />,
    );
    expect(evil).not.toContain("<a ");
    expect(evil).not.toContain("href=");
    expect(evil).toContain("data-icon"); // Icon erscheint, aber ohne aktiven Link
  });

  it("keine URL → rendert nichts", () => {
    expect(renderMarkup(<ExternalUrlText url={null} />)).toBe("");
  });
});
