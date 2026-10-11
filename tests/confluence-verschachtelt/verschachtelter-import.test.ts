// ================================================================================================
// R-1126 / R-1172 / R-1800 (E6) · R-0153 · R-0126 — DER IMPORT AN EINER ECHTEN VERSCHACHTELUNG
// ================================================================================================
//
// Die ganze Kette mit einem verschachtelten Bereich (`bereich.ts`): Confluence-Antwort über
// mehrere Ergebnisseiten → Adapter (`collectAll`) → quellneutrales Item mit Elternkette →
// Vorschau-Eintrag → Ordnerbaum der Auswahl → Kandidaten in der Prüfung. Die Erwartung jeder
// Ordnerlage wird aus dem Baum nachgerechnet, nicht aus den gelieferten `ancestors`.
import { describe, expect, it } from "vitest";
import type { ImportPreviewEntry } from "../../apps/web/src/api/types";
import { type PreviewTreeGroup, folderTree } from "../../apps/web/src/lib/importSelectView";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import { toPreviewEntry } from "../../services/library-analytics/src/select";
import { adapterFromConfig } from "../support/confluence-adapter";
import { BAUM, BEREICH, blaetternderFetch, erwarteterPfad } from "./bereich";

function adapter(jeSeite = 5) {
  const { fetchFn, aufrufe } = blaetternderFetch(jeSeite);
  return {
    adapter: adapterFromConfig({
      baseUrl: "https://baader-test.atlassian.net/wiki",
      email: "svc@baader-test.example",
      apiToken: "tok",
      spaceKey: BEREICH,
      fetchFn,
    }),
    aufrufe,
  };
}

function kind(knoten: PreviewTreeGroup | undefined, titel: string): PreviewTreeGroup | undefined {
  return knoten?.children?.find((c) => c.value === titel);
}

function titelIn(knoten: PreviewTreeGroup | undefined): string[] {
  return (knoten?.ownRows ?? []).map((r) => r.entry.title);
}

describe("E6 · verschachtelter Confluence-Bereich", () => {
  it("die Testdaten SIND verschachtelt: zwei Wurzeln, fünf Ebenen, gleichnamige Seiten", () => {
    const tiefen = BAUM.map((s) => erwarteterPfad(s.id).length);
    expect(Math.max(...tiefen)).toBe(4); // Seite auf Ebene 5 = vier Ahnen
    expect(BAUM.filter((s) => s.eltern === null)).toHaveLength(2);
    expect(BAUM.filter((s) => s.titel === "Checkliste")).toHaveLength(2);
    expect(BAUM.filter((s) => s.titel === "Wartung")).toHaveLength(2);
  });

  it("collectAll blättert über alle Ergebnisseiten und verliert keine Seite", async () => {
    const { adapter: a, aufrufe } = adapter(5);
    const r = await a.collectAll();
    expect(aufrufe).toHaveLength(Math.ceil(BAUM.length / 5));
    expect(r.truncated).toBe(false);
    expect(r.failed).toEqual([]);
    expect(r.items.map((i) => i.externalId).sort()).toEqual(BAUM.map((s) => s.id).sort());
  });

  it("jede Seite trägt ihre Elternkette — nachgerechnet aus dem Baum, nicht aus der Antwort", async () => {
    const { items } = await adapter().adapter.collectAll();
    for (const item of items) {
      const erwartet = erwarteterPfad(item.externalId ?? "");
      if (erwartet.length === 0) {
        expect(item.sourcePath, item.title).toBeUndefined(); // Wurzel: kein erfundener Ordner
      } else {
        expect(item.sourcePath, item.title).toEqual(erwartet);
      }
      expect(item.sourceScope).toBe(BEREICH);
    }
  });

  it("der Hierarchiebefund über den ganzen Bereich ist sauber — trotz Kind-vor-Eltern-Reihenfolge", async () => {
    const { hierarchie } = await adapter(3).adapter.collectAll();
    expect(hierarchie).toEqual({
      seiten: BAUM.length,
      mitKette: BAUM.length - 2,
      wurzeln: 2,
      maximaleTiefe: 4,
      fehlendeId: [],
      zyklus: [],
      doppelteId: [],
      verwaisterElternteil: [],
    });
  });

  it("der Ordnerbaum der Auswahl bildet die Struktur ab statt einer flachen Liste", async () => {
    const { items } = await adapter().adapter.collectAll();
    const rows = items.map((item, index) => ({
      entry: toPreviewEntry(item) as ImportPreviewEntry,
      index,
    }));
    const [wurzel, ...weitere] = folderTree(rows);
    expect(weitere).toEqual([]);
    expect(wurzel?.value).toBe(BEREICH);
    // Die beiden Wurzelseiten hängen direkt am Bereich, alles andere darunter.
    expect(titelIn(wurzel).sort()).toEqual(["Handbuch", "Organisation"]);
    expect(wurzel?.children?.map((c) => c.value).sort()).toEqual(["Handbuch", "Organisation"]);

    const handbuch = kind(wurzel, "Handbuch");
    const linieA = kind(kind(handbuch, "Produktion"), "Linie A");
    const wartungA = kind(linieA, "Wartung");
    expect(titelIn(wartungA).sort()).toEqual(["Checkliste", "Schmierplan"]);
    expect(titelIn(linieA).sort()).toEqual(["Störungen", "Wartung"]);

    // Gleichnamige Ordner in verschiedenen Zweigen bleiben getrennt.
    const wartungB = kind(kind(kind(handbuch, "Produktion"), "Linie B"), "Wartung");
    expect(titelIn(wartungB)).toEqual(["Checkliste"]);
    expect(wartungA).not.toBe(wartungB);

    // Ein Ordner-Haken erfasst den ganzen Teilbaum: „Handbuch" = alle Seiten unter Wurzel 100.
    const unterHandbuch = BAUM.filter((s) => erwarteterPfad(s.id)[0] === "Handbuch").length;
    expect(handbuch?.rows).toHaveLength(unterHandbuch);
    expect(kind(wurzel, "Organisation")?.rows).toHaveLength(2);
  });

  it("R-0126: alle Seiten landen als Kandidaten in der Prüfung — kein Wissensobjekt ohne Annahme", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });
    const { items } = await adapter().adapter.collectAll();
    const kandidaten = await library.createImportCandidates(items, "importer");
    expect(kandidaten).toHaveLength(BAUM.length);
    expect(new Set(kandidaten.map((k) => k.status))).toEqual(new Set(["neu"]));
    expect(await koService.list()).toEqual([]);

    // Titel, Schlagworte und Elternkette sind am Kandidaten erhalten.
    const schmierplan = kandidaten.find((k) => k.item.externalId === "11111");
    expect(schmierplan?.item.title).toBe("Schmierplan");
    expect(schmierplan?.item.tags).toEqual(["wartung", "linie-a"]);
    expect(schmierplan?.item.sourcePath).toEqual(["Handbuch", "Produktion", "Linie A", "Wartung"]);
  });

  it("der restringierte Teilbaum bleibt vertraulich, der offene Rest ist intern (Entscheidung 23)", async () => {
    const { items } = await adapter().adapter.collectAll();
    for (const item of items) {
      const gesperrt = BAUM.find((s) => s.id === item.externalId)?.gruppe !== undefined;
      expect(item.confidentiality, item.title).toBe(gesperrt ? "vertraulich" : "intern");
    }
  });
});
