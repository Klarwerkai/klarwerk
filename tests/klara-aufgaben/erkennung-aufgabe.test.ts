// ================================================================================================
// KLARA 07 (produkt:20261008:klara-aufgaben) — WELCHER SATZ LEGT EINE PERSÖNLICHE AUFGABE AN?
// ================================================================================================
//
// Die reine Erkennung (`apps/web/src/lib/klaraAuftragErkennung.ts`) — DIESELBE Funktion für getippte
// und gesprochene Aufträge (K1: der gesprochene Auftrag geht den gemeinsamen Aktionsweg). Sie legt
// immer eine NEUE persönliche Aufgabe an; Sätze über vorhandene (gemeinsame) Aufgaben bleiben, was
// sie in Klara 05 waren — nichts wird umetikettiert (K3).
import { describe, expect, it } from "vitest";
import {
  erkenneAuftrag,
  istAusfuehrungsauftrag,
} from "../../apps/web/src/lib/klaraAuftragErkennung";
import { auftragsArt } from "../../apps/web/src/lib/klaraSprache";

describe("E1 · K1 — persönliche Aufgabe anlegen, DE/EN/NL", () => {
  it("Titel in Anführungszeichen, mit und ohne „mir“, „persönliche“, Text", () => {
    const erwartet = [
      { aktion: "persoenliche_aufgabe_anlegen", suche: "neue_aufgabe", name: "Filter bestellen" },
    ];
    expect(erkenneAuftrag("Lege mir die Aufgabe „Filter bestellen“ an")?.schritte).toEqual(
      erwartet,
    );
    expect(erkenneAuftrag("Klara, lege eine Aufgabe „Filter bestellen“ an.")?.schritte).toEqual(
      erwartet,
    );
    expect(
      erkenneAuftrag("Erstelle eine persönliche Aufgabe „Filter bestellen“")?.schritte,
    ).toEqual(erwartet);
    expect(erkenneAuftrag("Erstelle mir eine neue Aufgabe Filter bestellen")?.schritte).toEqual(
      erwartet,
    );
    expect(
      erkenneAuftrag("Lege die Aufgabe „Filter bestellen“ mit dem Text „Bis Freitag“ an")?.schritte,
    ).toEqual([{ ...erwartet[0], inhalt: "Bis Freitag" }]);
    expect(erkenneAuftrag('Create a personal task "Order filter"')?.schritte).toEqual([
      { aktion: "persoenliche_aufgabe_anlegen", suche: "neue_aufgabe", name: "Order filter" },
    ]);
    expect(erkenneAuftrag("Maak een taak „Filter bestellen” aan")?.schritte).toEqual(erwartet);
  });

  it("gesprochen ist ein Ausführungsauftrag — dieselbe Erkennung wie getippt", () => {
    expect(istAusfuehrungsauftrag("Lege mir die Aufgabe „Filter bestellen“ an")).toBe(true);
    // Klara 02 ordnet den Satz als Arbeitsauftrag ein, nicht als Frage.
    expect(auftragsArt("Lege mir die Aufgabe „Filter bestellen“ an")).toBe("aktion");
  });
});

describe("E2 · K3 — gemeinsame Aufgaben werden nicht zu persönlichen", () => {
  it("„Erledige/Bearbeite die Aufgabe …“ bleibt die vorhandene Aufgabe (Klara 05)", () => {
    for (const satz of [
      "Erledige die Aufgabe „Hydraulikfilter“",
      "Bearbeite die Aufgabe „Hydraulikfilter“",
      "Setze die Priorität der Aufgabe „Hydraulikfilter“ auf hoch",
    ]) {
      const s = erkenneAuftrag(satz)?.schritte ?? [];
      expect(
        s.map((x) => x.aktion),
        satz,
      ).toEqual(["aufgabe_bearbeiten"]);
      expect(s[0]?.suche, satz).toBe("aufgabe");
    }
  });

  it("ein Thema statt eines Titels legt nichts an — Klara 02/05 bleiben unverändert", () => {
    // Dieselben Sätze, die Klara 02 (`klara-sprache`) und Klara 05 (`klara-aktionen/erkennung`)
    // als nicht ausgeführten Arbeitsauftrag festhalten.
    for (const satz of [
      "Lege eine Aufgabe zur Zylinderkopfdichtung an",
      "Lege eine Aufgabe für Anna an",
      "Create a task about the cylinder head",
    ]) {
      expect(erkenneAuftrag(satz), satz).toBeNull();
      expect(istAusfuehrungsauftrag(satz), satz).toBe(false);
    }
    // In Anführungszeichen gilt der Titel, wie er dasteht.
    expect(erkenneAuftrag("Lege eine Aufgabe „Zur Zylinderkopfdichtung“ an")?.schritte).toEqual([
      {
        aktion: "persoenliche_aufgabe_anlegen",
        suche: "neue_aufgabe",
        name: "Zur Zylinderkopfdichtung",
      },
    ]);
  });

  it("Entwürfe bleiben Entwürfe; Fragen und leere Titel sind keine Anlage", () => {
    expect(erkenneAuftrag("Lege den Entwurf „Wartung“ an")?.schritte[0]?.aktion).toBe(
      "entwurf_erstellen",
    );
    expect(erkenneAuftrag("Lege mir die Aufgabe „Filter bestellen“ an?")).toBeNull();
    expect(erkenneAuftrag("Lege mir die Aufgabe „“ an")).toBeNull();
  });
});
