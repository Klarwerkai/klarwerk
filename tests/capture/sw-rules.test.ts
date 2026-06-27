import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// SCRUM-222: DOM-freie Vertragsprüfung des handgeschriebenen Service Workers. Der SW selbst ist
// ein klassisches Worker-Skript (self/addEventListener) und nicht importierbar — daher prüfen wir
// seine Kernregeln statisch über den Quelltext (robust, ohne Browser/SW-Runtime). So sind die
// sicherheits-/offline-relevanten Invarianten gegen Regressionen abgesichert.
const SW = readFileSync(resolve(process.cwd(), "apps/web/public/sw.js"), "utf8");
const MANIFEST = readFileSync(
  resolve(process.cwd(), "apps/web/public/manifest.webmanifest"),
  "utf8",
);
const INDEX = readFileSync(resolve(process.cwd(), "apps/web/index.html"), "utf8");
const PUBLIC = resolve(process.cwd(), "apps/web/public");

describe("SCRUM-222: Service-Worker-Regeln (statischer Vertrag)", () => {
  it("/api und /health werden als nicht-cachebar erkannt (isApi)", () => {
    expect(SW).toMatch(/pathname\.startsWith\(["']\/api["']\)/);
    expect(SW).toMatch(/pathname === ["']\/health["']/);
  });

  it("API/cross-origin: network-only (früher return, kein respondWith → kein Cache)", () => {
    // Der Guard verlässt den Handler, bevor irgendeine Cache-Strategie greift.
    expect(SW).toMatch(/origin !== self\.location\.origin \|\| isApi\(url\)/);
    expect(SW).toMatch(/return;\s*\/\/[^\n]*network/i);
  });

  it("nur GET wird behandelt (Mutationen nie aus dem Cache)", () => {
    expect(SW).toMatch(/request\.method !== ["']GET["']/);
  });

  it("Navigationen: network-first mit App-Shell-Fallback", () => {
    expect(SW).toMatch(/request\.mode === ["']navigate["']/);
    expect(SW).toMatch(/caches\.match\(SHELL\)/);
  });

  it("App-Shell + PWA-Kernartefakte werden vorab gecacht", () => {
    expect(SW).toContain("/manifest.webmanifest");
    expect(SW).toContain("/icon-192.png");
    expect(SW).toContain("/icon-512.png");
    expect(SW).toMatch(/const SHELL = ["']\/index\.html["']/);
  });

  it("statische Assets: stale-while-revalidate (Cache zuerst, Netz aktualisiert)", () => {
    expect(SW).toMatch(/caches\.match\(request\)/);
    expect(SW).toMatch(/cached \|\| network/);
  });

  it("Manifest ist installierbar: standalone + 192/512-Icons + maskable", () => {
    const m = JSON.parse(MANIFEST);
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBeTruthy();
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  });

  it("HTML/PWA-Artefakte: Manifest und Apple-Touch-Icon sind referenziert und vorhanden", () => {
    expect(INDEX).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(INDEX).toContain('rel="apple-touch-icon" href="/apple-touch-icon-180.png"');
    for (const file of [
      "sw.js",
      "manifest.webmanifest",
      "icon-192.png",
      "icon-512.png",
      "icon-maskable-512.png",
      "apple-touch-icon-180.png",
    ]) {
      expect(existsSync(resolve(PUBLIC, file)), file).toBe(true);
    }
  });
});
