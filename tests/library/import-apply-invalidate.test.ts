// AUFTRAG-mega9 Block E-4 + E-5: die zwei Nahtstellen zwischen Auswahl, Gruppierung und Übernahme.
//
// E-4 (KW-E2E-008): Nach dem Gruppieren einen Kandidaten abwählen verwirft die alte Gruppierung
// korrekt (Neu-Mount über den React-Key) — aber der Knopf hieß weiter „Weiter: Gruppieren &
// Übernehmen" und verschwieg damit, dass etwas neu aufgebaut werden muss. Von den zwei Wegen, die der
// Prüfer anbot, ist der EHRLICH BENANNTE KNOPF gewählt und nicht das automatische Neu-Gruppieren:
// Gruppieren kostet einen Modelllauf, ihn bei jedem Häkchen selbsttätig auszulösen wäre teuer und
// überraschend.
//
// E-5 (KW-E2E-009): Nach der Übernahme zeigte der Knopf „1 offen" (frische Bilanz dieses Laufs),
// der Review-Verlauf daneben noch „0 offen · 4 gesamt" (alter Cache) — und jumpToReview sprang den
// Nutzer genau auf diesen widersprüchlichen Zähler. Bilanz und Review-Abfrage müssen GEMEINSAM
// aufgefrischt werden.
//
// Geprüft an den Quell-Pins der beiden Bauteile (Muster der bestehenden Source-Pin-Tests): dass die
// Zuständigkeit dort sitzt, wo sie sitzen muss, und ImportGroups seine dokumentierte
// react-query-Freiheit behält.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { IMPORT_GROUPS_TEXT } from "../../apps/web/src/lib/importGroups";

const groups = readFileSync(
  resolve(process.cwd(), "apps/web/src/components/ImportGroups.tsx"),
  "utf8",
);
const select = readFileSync(
  resolve(process.cwd(), "apps/web/src/components/ImportSelect.tsx"),
  "utf8",
);

describe("Block E-4: der Knopf heißt nach einer Auswahländerung ehrlich anders", () => {
  it("die Beschriftung hängt an groupingStale — eine Quelle für beide Texte", () => {
    expect(IMPORT_GROUPS_TEXT.refreshGrouping).toBe("imp.groups.refreshGrouping");
    expect(groups).toContain(
      "t(groupingStale ? IMPORT_GROUPS_TEXT.refreshGrouping : IMPORT_GROUPS_TEXT.cta)",
    );
  });

  it("das Wissen 'schon gruppiert' lebt ÜBER dem React-Key, sonst überlebte es den Remount nicht", () => {
    // Der Key verwirft die Gruppierung (richtig) — und mit ihr jeden State IN der Komponente.
    expect(select).toContain("const [lastGroupedKey, setLastGroupedKey]");
    expect(select).toContain("onGrouped={() => setLastGroupedKey(groupKey)}");
    expect(select).toContain(
      "groupingStale={lastGroupedKey !== null && lastGroupedKey !== groupKey}",
    );
    // Derselbe Wert steuert Key UND Vergleich — kein Auseinanderlaufen möglich.
    expect(select).toContain("key={groupKey}");
  });

  it("es wird NICHT automatisch neu gruppiert (kein Modelllauf pro Häkchen)", () => {
    // Kein Effekt, der runGrouping bei Auswahländerung von selbst auslöst.
    expect(groups).not.toMatch(/useEffect\([^)]*\{\s*void runGrouping\(\)/);
  });
});

describe("Block E-5: Bilanz und Review-Abfrage werden gemeinsam aufgefrischt", () => {
  it("die Übernahme meldet ihren Abschluss nach oben", () => {
    expect(groups).toContain("onApplied?.();");
    // Im SELBEN Abschnitt wie die Bilanz, damit Zahl und Queue denselben Stand zeigen — und nicht
    // etwa in einem früheren Zweig (z. B. dem SNAPSHOT_EXPIRED-Abbruch, der gar nichts übernimmt).
    expect(groups).toMatch(/setBilanz\(aggregateBilanz[\s\S]{0,1400}onApplied\?\.\(\);/);
    // Genau EIN Aufruf: kein zweiter Pfad, der still doppelt invalidiert.
    expect(groups.match(/onApplied\?\.\(\);/g) ?? []).toHaveLength(1);
  });

  it("der Eltern-Kontext invalidiert die Review-Abfrage samt Begleitern", () => {
    expect(select).toContain('queryKey: ["import-candidates"]');
    for (const key of ["kos", "library", "validation"]) {
      expect(select).toContain(`queryKey: ["${key}"]`);
    }
  });

  it("ImportGroups bleibt ohne react-query-Abhängigkeit (dokumentierte Entscheidung)", () => {
    // Genau deshalb läuft die Invalidierung über den Callback statt über ein useQueryClient hier.
    expect(groups).not.toContain("@tanstack/react-query");
    expect(groups).not.toContain("useQueryClient");
  });
});
