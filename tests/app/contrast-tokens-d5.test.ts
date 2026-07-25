// AUFTRAG-mega1 Block D5 (E2E-014): Muted-/Brand-TEXT-Tokens erfüllen WCAG AA (≥4,5:1) auf Weiß UND
// auf der Seiten-Fläche. Prüft die realen Token-Werte aus tailwind.config.ts (Quelle der Wahrheit).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CONFIG = readFileSync(join(__dirname, "../../apps/web/tailwind.config.ts"), "utf8");

function hex(token: RegExp): string {
  const m = CONFIG.match(token);
  const value = m?.[1];
  if (!value) {
    throw new Error(`Token nicht gefunden: ${token}`);
  }
  return value;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hexColor: string): number {
  const r = Number.parseInt(hexColor.slice(1, 3), 16);
  const g = Number.parseInt(hexColor.slice(3, 5), 16);
  const b = Number.parseInt(hexColor.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "#ffffff";
const PAGE = "#f3f4f6";

describe("Block D5: Text-Token-Kontrast erfüllt WCAG AA (≥4,5:1)", () => {
  it("muted-2 (10–11px-Metadaten) ist auf Weiß und Seite ausreichend dunkel", () => {
    const muted2 = hex(/muted:\s*\{[^}]*2:\s*"(#[0-9a-fA-F]{6})"/);
    expect(contrast(muted2, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted2, PAGE)).toBeGreaterThanOrEqual(4.5);
  });

  it("brand.text (Link-Text „Alle Aufgaben →“) ist auf Weiß und Seite ausreichend dunkel", () => {
    const brandText = hex(/brand:\s*\{[^}]*text:\s*"(#[0-9a-fA-F]{6})"/);
    expect(contrast(brandText, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandText, PAGE)).toBeGreaterThanOrEqual(4.5);
  });
});
