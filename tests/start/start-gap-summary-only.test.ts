import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// FUNKE-FIX2 P0 (bens Erforderlich 1 + Test „/start fetcht keine Volltexte"): die Startseite darf
// KEINE Gap-Volltexte mehr laden — sie nutzt AUSSCHLIESSLICH den aggregierten Summary-Endpunkt
// (useGapsSummary → GET /api/gaps/summary, nur Zahlen). Diese Invariante wird hier per Quell-Audit
// festgeschrieben (gleiches Muster wie der Route-Guard-Audit).
// FUNKE-FIX3 P0 (bens Blocker A + Auflage 4): der Quell-Audit allein beweist den gemounteten
// Datenfluss NICHT (die global gerenderte Sidebar rief useGaps() trotzdem auf) — der Laufzeit-Beleg
// über den ECHTEN Shell-Baum liegt in tests/app/start-shell-no-gap-fetch-mounted.test.tsx. Hier
// bleibt zusätzlich der Quell-Audit für Start.tsx UND die global gemountete Shell-Quelle
// (useNavBadges) als schnelle Frühwarnung.
describe("FUNKE-FIX2/3 P0: /start lädt keine Gap-Volltexte (nur aggregierte Zähler)", () => {
  const start = readFileSync("apps/web/src/pages/Start.tsx", "utf8");
  const navBadges = readFileSync("apps/web/src/app/useNavBadges.ts", "utf8");

  it("Start.tsx nutzt useGapsSummary (aggregierte Zähler)", () => {
    expect(start).toContain("useGapsSummary");
  });

  it("Start.tsx ruft NIRGENDS den Volltext-Hook useGaps() auf", () => {
    // useGaps( würde die vollen Gap-Objekte inkl. question in den Browser laden — genau das ist
    // untersagt. (useGapsSummary enthält „useGaps" NICHT als Aufruf-Präfix — daher gezielt „useGaps(".)
    expect(start).not.toMatch(/useGaps\s*\(/);
  });

  it("Start.tsx importiert useGaps nicht mehr aus dem Hook-Modul", () => {
    // Der Import-Block der Hooks darf useGaps nicht als eigenständigen Namen führen.
    const importBlock = start.slice(0, start.indexOf('from "../api/hooks"'));
    expect(importBlock).not.toMatch(/\buseGaps\b(?!Summary)/);
  });

  it("useNavBadges (globale Sidebar) nutzt die textfreie Summary, NIE useGaps()", () => {
    expect(navBadges).toContain("useGapsSummary");
    expect(navBadges).not.toMatch(/useGaps\s*\(/);
    const importBlock = navBadges.slice(0, navBadges.indexOf('from "../api/hooks"'));
    expect(importBlock).not.toMatch(/\buseGaps\b(?!Summary)/);
  });
});
