// ================================================================================================
// WCAG 1.3.4 AUSRICHTUNG — DIE INSTALLIERTE APP SPERRT KEINE BILDSCHIRMLAGE.
// ================================================================================================
//
// BEFUND (Audit nacharbeit-5, `docs/barrierefreiheit/WCAG-2.1-AA-AUDIT.md`): Das Web-App-Manifest
// stand auf `"orientation": "portrait"`. Als installierte App (PWA) ließ sich Klarwerk damit nur im
// Hochformat bedienen — wer das Gerät im Querformat befestigt hat (Halterung an der Maschine,
// Tablet im Ständer), bekam die Oberfläche gedreht. 1.3.4 erlaubt eine Sperre nur, wenn eine
// bestimmte Lage UNERLÄSSLICH ist; dafür gibt es weder einen Grund im Produkt noch eine Entscheidung
// im Bestand. Dieser Vertrag hält fest, dass das Manifest keine Lage erzwingt — und dass auch der
// Quelltext der Anwendung keine Sperre über die Screen-Orientation-API setzt.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const ERLAUBT = new Set([undefined, "any", "natural"]);

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    return statSync(pfad).isDirectory() ? dateien(pfad) : [pfad];
  });
}

describe("WCAG 1.3.4 · keine erzwungene Bildschirmlage", () => {
  it("das Manifest der installierten App lässt jede Lage zu", () => {
    const manifest = JSON.parse(
      readFileSync(join(WURZEL, "apps/web/public/manifest.webmanifest"), "utf8"),
    ) as { orientation?: string };
    expect(ERLAUBT.has(manifest.orientation), `orientation: ${manifest.orientation}`).toBe(true);
  });

  it("KALIBRIERUNG: eine Sperre auf Hoch- oder Querformat fiele durch", () => {
    for (const gesperrt of ["portrait", "portrait-primary", "landscape", "landscape-primary"]) {
      expect(ERLAUBT.has(gesperrt)).toBe(false);
    }
  });

  it("kein Quelltext der Anwendung sperrt die Lage über screen.orientation.lock", () => {
    const quellen = dateien(join(WURZEL, "apps/web/src")).filter(
      (p) => /\.(ts|tsx)$/.test(p) && !/\.test\.(ts|tsx)$/.test(p),
    );
    expect(quellen.length, "keine Quelldateien gefunden").toBeGreaterThan(50);
    const treffer = quellen.filter((p) => /orientation\.lock\s*\(/.test(readFileSync(p, "utf8")));
    expect(treffer).toEqual([]);
  });
});
