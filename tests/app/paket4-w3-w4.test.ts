// WP-SHIP9-S2 Paket 4: W3 (/bibliothek-Erststart-Block nur bei wirklich leerem Bestand) und
// W4 (Mobile-Quellen zeigen KO-Titel statt roher UUID). W4 nutzt die zentrale Titel-Auflösung
// sourceRefs (gleiche Ableitung wie die Konsole) — hier als pure Logik gepinnt.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { sourceRefs } from "../../apps/web/src/lib/askView";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function ko(over: Partial<KnowledgeObject> & { id: string; title: string }): KnowledgeObject {
  return {
    statement: "",
    conditions: [],
    measures: [],
    type: "regel",
    category: "allg",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "ungeprueft",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    history: [],
    ...over,
  } as KnowledgeObject;
}

describe("W3 · der Leerzustand der Bibliothek unterscheidet „nichts gesucht“ von „nichts gefunden“", () => {
  it("die Liste sagt bei aktiver Suche etwas anderes als bei leerem Bestand", () => {
    // JOB 3063 (H4) — WAS HIER FRÜHER STAND: der Pin auf `<EmptyStateCtas context="library" />`
    // hinter `(all.data?.length ?? -1) === 0` und auf die zwei langen Nulltreffer-Sätze
    // (`lib.empty`/`lib.emptyQuery`). Beides gibt es nicht mehr: der Leerzustand der Liste ist
    // Pedis Vorgabe vom 04.09. gefolgt — EIN Satz plus EIN Knopf, kein Erklärabsatz. Die
    // Unterscheidung selbst, um die es W3 ging, ist geblieben.
    const src = read("apps/web/src/components/bibliothek/BibliothekListe.tsx");
    expect(src).toContain('q.trim() ? t("lib.liste.leerSuche") : t("lib.liste.leer")');
    // Der Weg ins Erfassen bleibt im Leerzustand erreichbar (der frühere Erststart-Block).
    const flaeche = read("apps/web/src/components/bibliothek/BibliothekFlaeche.tsx");
    expect(flaeche).toContain("leerAktion=");
    expect(flaeche).toContain('t("lib.liste.erfassen")');
  });
});

describe("W4 · Mobile-Quellen zeigen KO-Titel statt UUID", () => {
  it("sourceRefs löst bekannte IDs auf den KO-Titel auf, unbekannte auf die ID (Fallback)", () => {
    const refs = sourceRefs(
      ["k1", "unknown-uuid"],
      [ko({ id: "k1", title: "Wartungsplan Pumpe" })],
    );
    expect(refs[0]?.label).toBe("Wartungsplan Pumpe");
    expect(refs[0]?.known).toBe(true);
    // Unbekannte Quelle: Fallback auf die ID (nie ein Fake-Titel).
    expect(refs[1]?.label).toBe("unknown-uuid");
    expect(refs[1]?.known).toBe(false);
  });

  it("Mobile.tsx rendert den aufgelösten Titel (line-clamp + Tooltip), nicht die rohe ID", () => {
    const src = read("apps/web/src/pages/Mobile.tsx");
    // AUFTRAG-mega33 A2: die Auflösung passiert nicht mehr in der Seite, sondern EINMAL in der
    // gemeinsamen Ableitung (summarizeAnswer → effectiveAnswer → conflictAwareSourceRefs). Die
    // Seite bekommt die fertigen Referenzen — dieselben, die der Desktop verwendet.
    // AUFTRAG-mega34 A1: `conflicts.data ?? []` ist weg — der Konfliktstand reist mit seiner
    // Herkunft durch `conflictKnowledge()`, damit ein hängender oder abgerissener Abruf hier nicht
    // als „keine Konflikte" ankommt.
    // Umbruchunempfindlich gepinnt: der Formatter bricht diesen Aufruf über vier Zeilen.
    expect(src.replace(/\s+/g, " ")).toContain(
      "summarizeAnswer( answer, kos.data ?? [], conflictKnowledge(conflicts), )",
    );
    expect(src).not.toContain("conflicts.data ?? []");
    expect(src).toContain("{s.sources.map((ref) => (");
    expect(src).toContain("{ref.label}");
    expect(src).toContain("title={ref.label}");
    expect(src).toContain("line-clamp-1");
    // Die alte rohe-ID-Darstellung ist weg.
    expect(src).not.toContain("{s.sources.map((id) => (");
  });
});
