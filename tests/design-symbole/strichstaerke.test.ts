import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

// ================================================================================================
// R-0919 / Restvertrag R2 · STRICHSTÄRKEN DER SYMBOLE — je Symbolart der Wert der gültigen Vorlage.
// ================================================================================================
//
// Das Brand Book nennt „~1,8" (`docs/ci/CI_KURZREFERENZ.md`) als Richtwert. Die jüngeren,
// freigegebenen Vorlagen legen den Strich JE SYMBOLART fest, und diese Werte gelten — der Richtwert
// wird nicht pauschal darübergestellt. Gemessen sind sie bereits in Chromium:
//   · Lupe, Mikrofon, Dokument, Zahnrad: 1,8 — `zielbild-h1-huelle` V13 (Lupe, Zahnrad),
//     `zielbild-h5-start` (Lupe, Mikrofon, Dokument V25), `zielbild-h5-fragen` V14 (Mikrofon);
//   · Chevron (Zeilenpfeil): 2 — `zielbild-h5-start` („Chevron 13px / 2");
//   · Sendepfeil der Frage: 2,2 — `zielbild-h5-fragen` V15;
//   · die Lupe der ehrlichen Wissenslücke im Word-Panel: 1,5 — `zielbild-keinwissen-messung` M23
//     (eigene Fläche, nicht Teil der Web-App unten).
// ABGLEICH (Nacharbeit 9): an den gemessenen Stellen stimmte alles. Abweichend waren dieselben
// Symbolarten AUSSERHALB der gemessenen Flächen — 25 Stellen mit `Search`, `Mic` oder `FileText`
// ohne Angabe, also mit dem lucide-Standard 2 statt 1,8. Sie tragen jetzt 1,8. Chevrons zeichnen
// mit dem Standard 2 und entsprechen damit der Vorlage; sie bleiben unverändert.

const WEB_SRC = repoPfad("apps/web/src");

function quelldateien(dir: string): string[] {
  const raus: string[] = [];
  for (const name of readdirSync(dir)) {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) {
      raus.push(...quelldateien(pfad));
    } else if (name.endsWith(".tsx") && !/\.test\.tsx$/.test(name)) {
      raus.push(pfad);
    }
  }
  return raus;
}

interface Aufruf {
  ort: string;
  symbol: string;
  strich: string | null;
}

/** Jede JSX-Verwendung der genannten Symbole, auch mehrzeilig, mit ihrem `strokeWidth`. */
function aufrufe(symbole: readonly string[]): Aufruf[] {
  const muster = new RegExp(`<(${symbole.join("|")})\\b([^>]*?)\\/>`, "gs");
  const raus: Aufruf[] = [];
  for (const pfad of quelldateien(WEB_SRC)) {
    const text = readFileSync(pfad, "utf8");
    for (const m of text.matchAll(muster)) {
      const zeile = text.slice(0, m.index).split("\n").length;
      const strich = /strokeWidth=\{([\d.]+)\}/.exec(m[2] ?? "");
      raus.push({
        ort: `${relative(WEB_SRC, pfad)}:${zeile}`,
        symbol: m[1] ?? "",
        strich: strich?.[1] ?? null,
      });
    }
  }
  return raus;
}

describe("R2 · Strichstärke je Symbolart nach der gültigen Vorlage", () => {
  it("S1 · Lupe, Mikrofon, Dokument und Zahnrad zeichnen überall mit 1,8", () => {
    const alle = aufrufe(["Search", "Mic", "FileText", "Settings"]);
    // KALIBRIERUNG: die Erhebung findet die bekannten Stellen (Kopfband-Lupe, Start-Mikrofon …).
    expect(alle.length).toBeGreaterThan(25);
    expect(alle.map((a) => a.ort)).toEqual(
      expect.arrayContaining(["shell/Kopfband.tsx:407", "components/fragen/FrageFeld.tsx:117"]),
    );
    const abweichend = alle.filter((a) => a.strich !== "1.8").map((a) => `${a.ort} ${a.symbol}`);
    expect(abweichend, "Symbol ohne den Vorlagenwert 1,8").toEqual([]);
  });

  it("S2 · Chevrons zeichnen mit 2 — Standard oder ausdrücklich, nie abweichend", () => {
    const chevrons = aufrufe(["ChevronRight", "ChevronDown"]);
    expect(chevrons.length).toBeGreaterThan(5);
    const abweichend = chevrons.filter((a) => a.strich !== null && a.strich !== "2");
    expect(abweichend.map((a) => `${a.ort} ${a.strich}`)).toEqual([]);
  });

  it("S3 · der Sendepfeil der Frage zeichnet mit 2,2", () => {
    const pfeil = aufrufe(["ArrowUp"]).filter((a) => a.ort.startsWith("components/fragen/"));
    expect(pfeil.map((a) => a.strich)).toEqual(["2.2"]);
  });

  it("S4 · die Werte stammen aus den Vorlagen-Messungen, nicht aus dem Richtwert", () => {
    const lies = (rel: string): string => readFileSync(repoPfad(rel), "utf8");
    const huelle = lies("tests/design/zielbild-h1-huelle.test.ts");
    expect(huelle).toContain("lupe 15px, Strich #7E879A, 1.8");
    expect(lies("tests/design/zielbild-h5-fragen.test.ts")).toContain('toBe("2.2px")');
    expect(lies("tests/design/zielbild-h5-start.test.ts")).toContain('expect(strich).toBe("2px")');
    expect(lies("tests/design/zielbild-h5-start.test.ts")).toContain("dokument-symbol 15px");
  });
});
