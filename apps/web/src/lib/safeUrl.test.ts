import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "./safeUrl";

// SCRUM-527 (WP2): defensive Render-Allowlist. Neutralisiert auch Altdaten, die bereits mit unsicherem
// Schema in der DB stehen, bevor sie in ein href gelangen.
describe("safeHttpUrl", () => {
  it("verwirft aktive/relative/leere Werte → null", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html,<script>",
      "vbscript:msgbox(1)",
      "//evil.com/x",
      "/relative",
      "relative/path",
      "evil.com",
      "",
      "   ",
    ]) {
      expect(safeHttpUrl(bad)).toBeNull();
    }
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
  });

  it("erlaubt absolute http/https", () => {
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpUrl("http://example.com/a?b=1")).toBe("http://example.com/a?b=1");
    expect(safeHttpUrl("  https://example.com/a  ")).toBe("https://example.com/a");
  });
});
