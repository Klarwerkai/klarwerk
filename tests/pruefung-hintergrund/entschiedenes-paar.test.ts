// AUFNAHME 20260922 · gesamt-pruefung-hintergrund — R-1111.
//
// Der laufende Abgleich vergleicht den Bestand wiederholt. Ein von Menschen entschiedenes Paar
// (Fehlalarm, getrennt lassen) darf dabei nicht bei jedem Lauf neu auftauchen, solange beide
// Fassungen unverändert sind. Ändert sich eine Seite, wird das Paar wieder geprüft.
// Mutation: die Ausnahme für geschlossene Einträge mit Fassungspaar in hasOpenPair entfernen →
// die „bleibt entschieden"-Fälle werden rot.
import { describe, expect, it } from "vitest";
import type { ConflictVerdict, DetectSubject } from "../../services/conflicts/src/detect";
import { InMemoryOverlapRepo } from "../../services/conflicts/src/overlap-repo";
import { OverlapService } from "../../services/conflicts/src/overlap-service";
import { InMemoryConflictRepo } from "../../services/conflicts/src/repo";
import { ConflictService } from "../../services/conflicts/src/service";

function subject(id: string, statement: string, version: number): DetectSubject {
  return {
    refId: id,
    title: "Dienstwagen-Farbe",
    statement,
    conditions: [],
    measures: [],
    category: "Allgemein",
    tags: [],
    asset: null,
    version,
  };
}

const blau = subject("ko-blau", "Wir bestellen alle Dienstwagen in der Farbe blau.", 1);
const rot = subject("ko-rot", "Wir bestellen alle Dienstwagen in der Farbe rot.", 1);

const widerspruch = async (a: string, b: string): Promise<ConflictVerdict | null> => ({
  relation: "widerspruch",
  older: null,
  confidence: 0.95,
  begruendung: "A und B legen eine andere verbindliche Farbe fest.",
  zitat_a: a.includes("blau") ? "Farbe blau" : "Farbe rot",
  zitat_b: b.includes("rot") ? "Farbe rot" : "Farbe blau",
});

describe("Konflikt: ein entschiedenes Paar bleibt für dieselben Fassungen entschieden", () => {
  it("Fehlalarm → erneuter Lauf über unveränderte Fassungen legt nichts an", async () => {
    const service = new ConflictService({ repo: new InMemoryConflictRepo() });
    const [konflikt] = await service.detectForSubject(rot, [blau], widerspruch);
    expect(konflikt).toBeDefined();
    await service.dismiss(konflikt?.id ?? "", "controller-1", "Anderer Standort.");

    expect(await service.detectForSubject(rot, [blau], widerspruch)).toHaveLength(0);
    expect(await service.detectForSubject(blau, [rot], widerspruch)).toHaveLength(0);
    expect(await service.badgeCount()).toBe(0);
  });

  it("eine neue Fassung einer Seite wird wieder geprüft", async () => {
    const service = new ConflictService({ repo: new InMemoryConflictRepo() });
    const [konflikt] = await service.detectForSubject(rot, [blau], widerspruch);
    await service.dismiss(konflikt?.id ?? "", "controller-1", "Anderer Standort.");

    const neu = await service.detectForSubject({ ...rot, version: 2 }, [blau], widerspruch);
    expect(neu).toHaveLength(1);
    expect(await service.badgeCount()).toBe(1);
  });
});

describe("Überschneidung: getrennt gelassen bleibt getrennt, solange beide Fassungen gleich sind", () => {
  const a = {
    ...subject("ko-a", "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.", 1),
    title: "Pumpe entlüften",
    category: "Wartung",
  };
  const b = {
    ...subject("ko-b", "Nach dem Anfahren 10 Sekunden warten und dann die Pumpe entlüften.", 1),
    title: "Pumpe entlüften",
    category: "Wartung",
  };
  const keinModell = async () => null;

  it("getrennt lassen → erneuter Lauf legt nichts an; neue Fassung → wieder geprüft", async () => {
    const service = new OverlapService({ repo: new InMemoryOverlapRepo() });
    const [eintrag] = await service.detectForSubject(a, [b], keinModell);
    expect(eintrag).toBeDefined();
    await service.keepSeparate(eintrag?.id ?? "", "kurator-1");

    expect(await service.detectForSubject(a, [b], keinModell)).toHaveLength(0);
    expect(await service.badgeCount()).toBe(0);

    expect(await service.detectForSubject({ ...a, version: 2 }, [b], keinModell)).toHaveLength(1);
  });
});
