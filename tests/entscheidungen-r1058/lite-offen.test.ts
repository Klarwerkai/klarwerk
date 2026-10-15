// ================================================================================================
// R-1058 · KLARWERK LITE UND DIE INVESTOR-SEITEN SIND OFFEN — UND IM PRODUKT NICHT VORWEGGENOMMEN.
// ================================================================================================
//
// Ob die Lite-Variante (Fragen, Einblicke, Wissen, Prüfen, Beibringen) und die Boardroom-, Pitch-
// und Hub-Seiten der Investor-Demo ins Produkt gehören, ist unentschieden
// (`docs/entscheidungen/r1058-klarwerk-lite.md`). Dieser Test hält den Befund der Vorlage fest:
// keine dieser Seiten hat eine Route oder eine Komponente. Fällt die Entscheidung für eine
// Übernahme, wird er bewusst mit ihr angepasst — nicht vorher.
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FOOT_ITEMS, GUARDED_ITEMS } from "../../apps/web/src/app/navigation";

const WURZEL = resolve(__dirname, "../..");
const VORLAGE = resolve(WURZEL, "docs/entscheidungen/r1058-klarwerk-lite.md");

// Die Bausteine aus §9 der Frontend-Gesamtübersicht (Lite und Investor-Front-Door).
const DEMO_BAUSTEIN =
  /^(Lite[A-Z]\w*|Boardroom|Pitch|Hub|Site|Highlights|Tomorrow|MarketAnalysis|ProcessFlow|FlowApp)\.[jt]sx?$/;
const DEMO_PFAD =
  /^\/(lite|boardroom|pitch|hub|site|highlights|tomorrow|market|process|flow)(\/|$)/i;

function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? dateien(join(ordner, e.name)) : [e.name],
  );
}

describe("R-1058 · Lite- und Investor-Seiten sind nicht ins Produkt übernommen", () => {
  it("kein Routeneintrag führt zu einer Lite-, Boardroom-, Pitch- oder Hub-Seite", () => {
    const pfade = [...GUARDED_ITEMS, ...FOOT_ITEMS].map((i) => i.path);
    expect(pfade.length).toBeGreaterThan(0);
    expect(pfade.filter((p) => DEMO_PFAD.test(p))).toEqual([]);
  });

  it("die Web-App enthält keine der Demo-Komponenten aus §9", () => {
    const namen = dateien(resolve(WURZEL, "apps/web/src"));
    expect(namen.length).toBeGreaterThan(0);
    expect(namen.filter((n) => DEMO_BAUSTEIN.test(n))).toEqual([]);
  });

  it("die Vorlage nennt die offene Frage, beide Teilfragen und den fehlenden Entscheid", () => {
    const vorlage = readFileSync(VORLAGE, "utf8");
    expect(vorlage).toContain("Ob sie ins Produkt gehört, ist offen.");
    expect(vorlage).toContain(
      "Ebenso offen: Boardroom-, Pitch- und Hub-Seiten aus der Investor-Demo.",
    );
    expect(vorlage).toContain("**Frage A");
    expect(vorlage).toContain("**Frage B");
    expect(vorlage).toContain("**Noch erforderlich:**");
  });
});
