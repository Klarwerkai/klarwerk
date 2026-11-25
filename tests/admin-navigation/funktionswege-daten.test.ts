import { describe, expect, it } from "vitest";
import { funktionskatalog } from "../../services/app/src/funktionskatalog/katalog";
import type { KatalogWeg } from "../../services/app/src/funktionskatalog/vertrag";

function folge(weg: KatalogWeg, von: string): string[] {
  return weg.verbindungen.filter((k) => k.von === von).map((k) => k.nach);
}

describe("Redaktionelle Funktionswege", () => {
  const { entries, wege } = funktionskatalog;
  const ids = new Set(entries.map((e) => e.id));

  it("jeder gerichtete Weg besteht aus drei bis acht adressierbaren Funktionen und lässt sich vom Einstieg aus durchlaufen", () => {
    expect(new Set(wege.map((w) => w.id)).size).toBe(wege.length);
    for (const w of wege) {
      expect(w.id).toMatch(/^[a-z][a-z0-9-]*$/);
      const knoten = new Set(w.verbindungen.flatMap((k) => [k.von, k.nach]));
      expect(knoten.size, w.id).toBeGreaterThanOrEqual(3);
      expect(knoten.size, w.id).toBeLessThanOrEqual(8);
      for (const id of knoten) expect(ids.has(id), id).toBe(true);
      const erster = w.verbindungen[0];
      if (!erster) throw new Error(w.id);
      const erreichbar = new Set([erster.von]);
      for (const von of erreichbar) for (const nach of folge(w, von)) erreichbar.add(nach);
      expect(erreichbar, w.id).toEqual(knoten);
      expect(new Set(w.verbindungen.map((k) => `${k.von}→${k.nach}`)).size, w.id).toBe(
        w.verbindungen.length,
      );
      for (const k of w.verbindungen) expect(k.von).not.toBe(k.nach);
    }
  });

  it("bindet jede Übersetzung und den Nachweis an den Übergang; geplante Datenbankanschlüsse sind als vorgesehen ausgewiesen", () => {
    for (const weg of wege) {
      for (const k of weg.verbindungen) {
        expect(["nachgewiesen", "dokumentiert", "vorgesehen"]).toContain(k.stand);
        for (const sprache of ["de", "en", "nl"] as const) {
          expect(weg.titel[sprache].trim()).not.toBe("");
          expect(k.text[sprache].trim()).not.toBe("");
          expect(k.beleg[sprache]).toMatch(/\b(2026|1139)\b/);
        }
      }
    }
    const geplant = wege.find((w) => w.id === "datenbankwissen");
    expect(geplant?.verbindungen.map((k) => [k.von, k.nach, k.stand])).toEqual([
      ["425", "426", "vorgesehen"],
      ["426", "269", "vorgesehen"],
    ]);
    const externerKalender = wege
      .flatMap((w) => w.verbindungen)
      .find((k) => k.von === "300" && k.nach === "301");
    expect(externerKalender?.stand).toBe("dokumentiert");
    expect(externerKalender?.beleg.de).toContain("simuliertem Anbieter");
  });

  it("verknüpft die Ausbauaufträge für Wissen, Teamassistenten und Workflows in der Landkarte", () => {
    const weg = wege.find((w) => w.id === "firmenwissen-teamarbeit");
    expect(weg?.verbindungen.map(({ von, nach }) => [von, nach])).toEqual([
      ["283", "P02"],
      ["P02", "V03"],
      ["V03", "P03"],
      ["P03", "P04"],
      ["P04", "P02"],
    ]);
    expect(weg?.verbindungen.find((k) => k.nach === "P03")?.stand).toBe("nachgewiesen");
    expect(weg?.verbindungen.find((k) => k.nach === "P04")?.stand).toBe("nachgewiesen");
    expect(entries.find((e) => e.id === "P04")?.status).toBe("available");
    expect(entries.find((e) => e.id === "P03")?.status).toBe("available");
    const auftraege = {
      P02: [
        "aufnahme:20260922:gesamt-wissensarchitektur",
        "produkt:20261008:klara-gemeinsames-wissen",
        "produkt:20261125:workflowergebnis-firmenwissen",
      ],
      P03: ["produkt:20261125:teamassistent-pruefbeispiele"],
      P04: ["produkt:20261125:teamablauf-gepruefte-entscheidung"],
    };
    for (const [id, erwartet] of Object.entries(auftraege)) {
      expect(entries.find((e) => e.id === id)?.sources.map((s) => s.reference)).toEqual(
        expect.arrayContaining(erwartet),
      );
    }
  });

  it("zeigt beide Fortsetzungen des belegten Dokumentvergleichs und verwendet dieselben Quellen- und Kalenderknoten in weiteren Wegen", () => {
    const doc = wege[0];
    expect(doc?.id).toBe("dokumentpruefung");
    if (!doc) throw new Error("Dokumentprüfung fehlt");
    expect(folge(doc, "321").sort()).toEqual(["V01", "V06"]);
    expect(folge(doc, "V06")).toContain("V01");
    expect(folge(doc, "V01")).toContain("V02");
    expect(folge(doc, "V02").sort()).toEqual(["V03", "V04"]);
    expect(folge(doc, "V04")).toContain("V03");
    expect(folge(doc, "V03")).toContain("V05");
    for (const id of ["V03", "300", "285"]) {
      expect(
        wege.filter((w) => w.verbindungen.some((k) => k.von === id || k.nach === id)).length,
        id,
      ).toBeGreaterThan(1);
    }
  });
});
