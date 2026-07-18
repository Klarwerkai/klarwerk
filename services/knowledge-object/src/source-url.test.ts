import { describe, expect, it } from "vitest";
import { safeSourceUrl, sanitizeSources } from "./source-url";

// SCRUM-527 (WP2): die zentrale Quell-URL-Allowlist. Ohne sie passieren aktive/relative Schemata die
// Persistenzgrenze und landen später im href (stored/cross-user XSS).
describe("safeSourceUrl", () => {
  it("verwirft aktive/gefährliche Schemata", () => {
    expect(safeSourceUrl("javascript:alert(1)")).toBeNull();
    expect(safeSourceUrl("JavaScript:alert(1)")).toBeNull(); // Groß/Klein
    expect(safeSourceUrl("java\tscript:alert(1)")).toBeNull(); // Tab-Obfuskation
    expect(safeSourceUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeSourceUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeSourceUrl("file:///etc/passwd")).toBeNull();
  });

  it("verwirft relative / schemalose / protokoll-relative URLs", () => {
    expect(safeSourceUrl("//evil.com/x")).toBeNull(); // protokoll-relativ
    expect(safeSourceUrl("/relative/path")).toBeNull();
    expect(safeSourceUrl("relative/path")).toBeNull();
    expect(safeSourceUrl("evil.com")).toBeNull(); // kein Schema
  });

  it("verwirft leer / null / undefined / Nicht-String", () => {
    expect(safeSourceUrl("")).toBeNull();
    expect(safeSourceUrl("   ")).toBeNull();
    expect(safeSourceUrl(null)).toBeNull();
    expect(safeSourceUrl(undefined)).toBeNull();
    expect(safeSourceUrl(42 as unknown as string)).toBeNull();
  });

  it("erlaubt absolute http/https-URLs (getrimmt, ansonsten unverändert)", () => {
    expect(safeSourceUrl("https://example.com/handbuch")).toBe("https://example.com/handbuch");
    expect(safeSourceUrl("http://example.com/a?b=1#c")).toBe("http://example.com/a?b=1#c");
    expect(safeSourceUrl("  https://example.com/a  ")).toBe("https://example.com/a");
    expect(safeSourceUrl("HTTPS://Example.com/A")).toBe("HTTPS://Example.com/A");
  });
});

describe("sanitizeSources", () => {
  it("nullt ungültige URLs, behält die Quelle & andere Felder", () => {
    const cleaned = sanitizeSources([
      { url: "javascript:alert(1)", label: "böse" },
      { url: "https://ok.example/x", label: "gut" },
      { url: null, label: "ohne" },
    ]);
    expect(cleaned).toEqual([
      { url: null, label: "böse" },
      { url: "https://ok.example/x", label: "gut" },
      { url: null, label: "ohne" },
    ]);
  });
});
