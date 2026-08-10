// ==================================================================================================
// AUFTRAG PRO 381 · BÜNDEL 3 (Bewahrung) · `R-16` — DIE NULL-DIFF IST MASCHINELL GEPRÜFT.
// ==================================================================================================
//
// PLAN PRO 378 §4.1 `P-4`: „Ohne Zusicherung ist ‚additiv' eine Behauptung.“ Dieser Test macht sie
// zu einer Messung. Die dreizehn Dateien unten sind die Filterschiene und ihr Umfeld — zehn Achsen,
// eine Abhängigkeit (`category → tag`), ein additiver Bereichsfilter, eine Sortierung, eine
// Anzeige-Fensterung und der Seitenkopf, an dem der Routen-Rauchanker `page-<schlüssel>` hängt.
//
// WARUM AUCH `components/ui.tsx`: PLAN 378 §4.2 hält ausdrücklich fest, dass der Pfad NICHT in
// `PageHeader` wandert. Die Komponente wird von JEDER Seite benutzt und trägt den Anker, den
// `tests-smoke/ui-smoke.spec.ts` für alle zwölf Kernrouten prüft — eine Änderung dort wäre zwölf
// Flächen breit statt einer. Die Ortszeile steht als eigener Block darunter.
//
// EHRLICHE GRENZE, die hier stehen bleiben soll — sie ist der Preis dafür, dass dieser Test heute
// überhaupt messen kann: Die Grundlinie ist der ARBEITSBAUM zum Zeitpunkt von PRO 381
// (HEAD `90b86a9b81e602fc707ee1ee204700763ef6074b`, Dirty 198, gemessen am 2026-08-05), NICHT ein
// Commit. Das ist dieselbe Lage, die PLAN 378 `G-5` ausweist: der Iststand IST der Arbeitsbaum.
// Folge: der Test wird auch dann rot, wenn jemand eine dieser Dateien aus einem ANDEREN Grund
// ändert. Das ist gewollt — er sagt „hier wurde angefasst“, nicht „hier wurde falsch angefasst“.
// Wer bewusst ändert, ändert die Grundlinie in einem ausdrücklichen Auftrag mit.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { repoPfad } from "./support/wissensraum-ort-vertrag";

/** Die zwölf Dateien aus PLAN 378 §4.2 „Zugesicherte Null-Diff“ plus `components/ui.tsx`. */
const NULL_DIFF: ReadonlyArray<{ datei: string; sha256: string }> = [
  {
    datei: "apps/web/src/components/FacetFilter.tsx",
    sha256: "3723e7fb5917f14f08842897f8f2ddb867e2093dec2cfffa772284fbee3183f0",
  },
  {
    datei: "apps/web/src/components/facets/FacetGroupField.tsx",
    sha256: "842c17e2c7075ce2d4cc5e8783831bada346eff2a53652b80c56fd18d367e24e",
  },
  {
    datei: "apps/web/src/components/facets/FacetRangeField.tsx",
    sha256: "940058aed5e26f6e6fec5a0cc388c741f2d101f575f8e5f54d23c4dd71be4b52",
  },
  {
    datei: "apps/web/src/components/facets/FacetActiveBar.tsx",
    sha256: "6a0d5d4591dba2f4f019b7ee6648a10ad87ae2b83514e2ff08fb96502447d876",
  },
  {
    datei: "apps/web/src/lib/facetRail.ts",
    sha256: "1cc3c9ff26ed06a12a638f8c78323673a02e1a5eaedc09d68607c2595463aa8d",
  },
  {
    datei: "apps/web/src/lib/libraryFacets.ts",
    sha256: "56d55169f72f3ebe3e1d5f2e3722bb367318afe3fe79493f264c8d5c16ce17a1",
  },
  {
    datei: "apps/web/src/lib/facets.ts",
    sha256: "ab2312471fb032f7c73eb44cf01a82ed5ad7c22dd29f3935024f82e2700e4d3d",
  },
  {
    datei: "apps/web/src/lib/facetFilter.ts",
    sha256: "8d34bef35e29d2f3c1033448c3884d6d1f89c9dfcadf14bf0666c2481bc25bce",
  },
  {
    datei: "apps/web/src/lib/libraryUrlFilters.ts",
    sha256: "cb55c96976179d7e2307f505ba68dc5fa744d69088e01f7bc90e216112cf709c",
  },
  {
    datei: "apps/web/src/lib/librarySort.ts",
    sha256: "f7b80bc09146e118db19bffc59d78074ceeb59d71b374fd79698b8eef2cd77b1",
  },
  {
    datei: "apps/web/src/lib/libraryDisplay.ts",
    sha256: "6db7702af635db8ca12a9957405d0d7e6648dc49ccfc856f5e0e0408c65350f0",
  },
  {
    datei: "apps/web/src/lib/librarySearch.ts",
    sha256: "0d7c48809ce5acfc3ff0879d6230ca65f97d1b3bfd0e4ef1ae6371b9efb44e6a",
  },
  {
    datei: "apps/web/src/components/ui.tsx",
    sha256: "39306310015ee3ced11ce72b040c0ddaa9727b0036d1d78f391f8ba12ea4c2e3",
  },
];

function sha256(datei: string): string {
  return createHash("sha256")
    .update(readFileSync(repoPfad(datei)))
    .digest("hex");
}

describe("PRO 381 · R-16 — Null-Diff an der Filterschiene", () => {
  it("R-16 (a) BEWAHRUNGSANKER: alle dreizehn Dateien sind zeichengleich zur Grundlinie", () => {
    const abweichungen = NULL_DIFF.filter(({ datei, sha256: soll }) => sha256(datei) !== soll).map(
      ({ datei }) => datei,
    );
    expect(abweichungen, `Null-Diff verletzt in: ${abweichungen.join(", ")}`).toEqual([]);
  });

  it("R-16 (b): die Liste ist vollständig — zwölf aus §4.2 plus `components/ui.tsx`", () => {
    // Ohne diese Zeile könnte die Zusicherung durch Streichen einer Zeile „grün gemacht“ werden.
    expect(NULL_DIFF).toHaveLength(13);
    expect(NULL_DIFF.map((e) => e.datei)).toContain("apps/web/src/components/ui.tsx");
    for (const { sha256: soll } of NULL_DIFF) {
      expect(soll).toHaveLength(64);
    }
  });
});
