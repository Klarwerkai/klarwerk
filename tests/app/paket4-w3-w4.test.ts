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

describe("W3 · Bibliothek-Erststart-Block nur bei leerem Bestand", () => {
  it("Library.tsx macht den Erststart-Block (EmptyStateCtas) vom leeren Bestand abhängig", () => {
    const src = read("apps/web/src/pages/Library.tsx");
    // Der generische Block erscheint NUR bei all.data.length === 0 (kein KO), sonst undefined.
    expect(src).toContain(
      '(all.data?.length ?? -1) === 0 ? <EmptyStateCtas context="library" /> : undefined',
    );
    // Die ehrliche Treffer-Meldung bleibt (Suche vs. leer differenziert).
    expect(src).toContain('trimmedQ ? t("lib.emptyQuery", { q: trimmedQ }) : t("lib.empty")');
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
    expect(src).toContain("sourceRefs(s.sources, kos.data ?? [])");
    expect(src).toContain("{ref.label}");
    expect(src).toContain("title={ref.label}");
    expect(src).toContain("line-clamp-1");
    // Die alte rohe-ID-Darstellung ist weg.
    expect(src).not.toContain("{s.sources.map((id) => (");
  });
});
