// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-QUELLENANZEIGE (R-1026) — AUF DEM TELEFON BLEIBEN QUELLENTITEL LESBAR.
// ================================================================================================
//
// Befund am Basisstand: die Telefonfläche (`pages/Mobile.tsx`) kappte jeden Quellentitel unter einer
// Antwort mit `line-clamp-1 max-w-[220px]` auf eine Zeile; der Rest stand nur im Tooltip, den es auf
// Touch nicht gibt. Die Lieferung lässt die Titel umbrechen — auch lange Dateinamen ohne
// Umbruchstelle (`[overflow-wrap:anywhere]`, `min-w-0` als Flex-Kind). Dasselbe am Titel im
// Quellenchip der Web-Fragenseite (`QuellenChipInhalt`).
//
// EIGENE DATEI, nicht in `tests/app/paket4-w3-w4.test.ts`: dort scheitert derselbe Fall bereits am
// Basisstand 863a0974 an einer fremden Zeile (`Mobile.tsx:797`, `conflicts.data ?? []` im
// Konfliktweg) — hinter diesem Fehlschlag liefe keine Aussage zu R-1026 mehr.
//
// GRENZE: gemessen wird die gebaute KLASSENKETTE des Elements, das den Titel trägt, nicht die
// Darstellung in einem Browser.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

/** Die `className` des ersten JSX-Elements ab `anker` — fail-closed, wenn es keine gibt. */
function klassenAb(src: string, anker: string): string[] {
  const start = src.indexOf(anker);
  expect(start, `Anker ${anker} fehlt`).toBeGreaterThanOrEqual(0);
  const m = /className="([^"]*)"/.exec(src.slice(start));
  expect(m, `keine className nach ${anker}`).not.toBeNull();
  return (m?.[1] ?? "").split(/\s+/).filter((k) => k.length > 0);
}

const KAPPEND =
  /^(truncate|whitespace-nowrap|text-ellipsis|overflow-(x-)?(hidden|clip)|line-clamp-\d+|max-w-\[\d+px\])$/;

describe("R-1026 · Quellentitel unter einer Antwort brechen auf dem Telefon um, statt gekappt zu werden", () => {
  it("Telefonfläche: der Quellenverweis trägt den Titel umbrechend, ohne kappende Klasse", () => {
    const src = read("apps/web/src/pages/Mobile.tsx");
    const klassen = klassenAb(src, "title={ref.label}");
    expect(klassen).toContain("[overflow-wrap:anywhere]");
    expect(klassen).toContain("min-w-0");
    expect(klassen.filter((k) => KAPPEND.test(k))).toEqual([]);
    // Der Titel selbst ist der Inhalt — nicht die rohe Kennung.
    expect(src).toContain("{ref.label}");
  });

  it("Web-Fragenseite: der Titel im Quellenchip bricht um, ohne kappende Klasse", () => {
    const src = read("apps/web/src/components/fragen/Quellenplaketten.tsx");
    // Der Kommentar steht unmittelbar über dem Element, das „n · Titel" trägt.
    const klassen = klassenAb(src, "R-1026 (Aufnahme 20260922");
    expect(klassen).toContain("[overflow-wrap:anywhere]");
    expect(klassen.filter((k) => KAPPEND.test(k))).toEqual([]);
  });
});
