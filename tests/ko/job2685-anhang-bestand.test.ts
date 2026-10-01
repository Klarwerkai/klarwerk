// BEN Runde 2, B3: Die Treffersumme der Anhang-Träger-Suite wird aus dem angelegten Bestand
// abgeleitet, nicht aus einer Rechnung im Kommentar. Dieser Test braucht keine Datenbank: Er führt
// das Node-Orakel über denselben Bestand aus, gegen den die Integrationssuite SQL vergleicht, und
// hält fest, dass jede Kennung höchstens ihr EIGENES Objekt findet.
import { describe, expect, it } from "vitest";
import { erwartet, faelle } from "./job2685-anhang-bestand";

describe("JOB 2685 · der Kreuzbestand der Anhang-Träger-Suite ist in sich schlüssig", () => {
  const alle = faelle();

  it("keine Kennung ist Teilstring einer anderen — die Fundarten bleiben unabhängig", () => {
    const kennungen = alle.map((f) => f.objectId);
    expect(new Set(kennungen).size).toBe(kennungen.length);
    for (const a of kennungen) {
      for (const b of kennungen) {
        if (a !== b) {
          expect(b.includes(a), `${a} steckt in ${b}`).toBe(false);
        }
      }
    }
  });

  it("jede Kennung findet genau ihr eigenes Objekt — außer F1 und obj-nachbar, die nichts finden", () => {
    const leer = new Set(["obj-01", "obj-02", "obj-nachbar"]);
    for (const f of alle) {
      expect(erwartet(alle, f.objectId), `Kennung ${f.objectId}`).toEqual(
        leer.has(f.objectId) ? [] : [f.ko.id],
      );
    }
  });

  it("die LIKE-Entwertung ist im Bestand angelegt: obj%son_der findet ko-sonder, nicht ko-nachbar", () => {
    expect(erwartet(alle, "obj%son_der")).toEqual(["ko-sonder"]);
    expect(alle.find((f) => f.objectId === "obj-nachbar")?.ko.bodyHtml).toContain("objXsonYder");
  });

  it("die Treffersumme, die die Integrationssuite verlangt, ist 21 = 10 Fundarten × 2 + obj%son_der", () => {
    const summe = alle.reduce((n, f) => n + erwartet(alle, f.objectId).length, 0);
    expect(summe).toBe(21);
  });
});
