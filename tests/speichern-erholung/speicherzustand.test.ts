// ================================================================================================
// SPEICHERN-ERHOLUNG (Ausbauliste Punkt 6) · K1 — DIE VIER LAGEN, DOM-FREI.
// ================================================================================================
//
// Die Ableitung, aus der das Blatt seine Anzeige baut (`apps/web/src/lib/speicherzustand.ts`). Die
// Reihenfolge ihrer Zweige IST die Aussage: eine laufende oder wartende Anfrage schlägt jedes
// Ergebnis eines vorigen Versuchs — „gespeichert" über einer wartenden Anfrage wäre die Unwahrheit.
import { describe, expect, it } from "vitest";
import { type Speicherlage, speicherzustand } from "../../apps/web/src/lib/speicherzustand";

const RUHE: Speicherlage = {
  unterwegs: false,
  angehalten: false,
  fehlgeschlagen: false,
  gespeichert: false,
};

describe("Speicherzustand · vier unterscheidbare Lagen", () => {
  it("Z1 · nichts angestossen, nichts quittiert → keine Aussage", () => {
    expect(speicherzustand(RUHE)).toBeNull();
  });

  it("Z2 · unterwegs mit Netz → läuft", () => {
    expect(speicherzustand({ ...RUHE, unterwegs: true })).toBe("laeuft");
  });

  it("Z3 · unterwegs, aber ohne Netz angehalten → wartet", () => {
    expect(speicherzustand({ ...RUHE, unterwegs: true, angehalten: true })).toBe("wartet");
  });

  it("Z4 · zurückgekommen mit Fehler → fehlgeschlagen", () => {
    expect(speicherzustand({ ...RUHE, fehlgeschlagen: true })).toBe("fehlgeschlagen");
  });

  it("Z5 · vom Server quittiert → gespeichert", () => {
    expect(speicherzustand({ ...RUHE, gespeichert: true })).toBe("gespeichert");
  });

  it("Z6 · eine wartende Anfrage schlägt eine alte Quittung und einen alten Fehler", () => {
    const alt = { ...RUHE, fehlgeschlagen: true, gespeichert: true };
    expect(speicherzustand({ ...alt, unterwegs: true, angehalten: true })).toBe("wartet");
    expect(speicherzustand({ ...alt, unterwegs: true })).toBe("laeuft");
  });

  it("Z7 · ein sichtbarer Fehler schlägt eine ältere Quittung", () => {
    expect(speicherzustand({ ...RUHE, fehlgeschlagen: true, gespeichert: true })).toBe(
      "fehlgeschlagen",
    );
  });
});
