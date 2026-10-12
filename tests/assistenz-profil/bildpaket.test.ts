// ================================================================================================
// produkt:20261010:assistenz-name-avatar · DAS BILDPAKET LIEGT IM BAU — ALLE DREIZEHN MOTIVE.
// ================================================================================================
//
// Die Auswahl verlangt das Paket LOKAL im Bau (`apps/web/public/…`), ohne externen Bilddienst.
// Geprüft wird je Motiv: die Datei existiert, ist ein echtes PNG (Signatur) und nicht leer; das
// Original trägt unverändert die freigegebene Prüfsumme der bisherigen Figur.
//
// DIESER TEST IST ABSICHTLICH STRENG: Fehlt eine der zwölf neuen Dateien, wird er rot und nennt sie.
// Die Oberfläche zeigt dann zwar ehrlich eine neutrale Ersatzgrafik — ein Lieferbeleg für das
// Bildpaket ist das aber nicht.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KLARA_AVATAR_SHA256 } from "../../apps/web/src/components/klara-vorschau/avatar";
import { ASSISTENZ_AVATAR_KATALOG } from "../../apps/web/src/lib/assistenzAvatare";
import { repoPfad } from "../support/repoPfad";

const PNG_SIGNATUR = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("Bildpaket Erstauswahl v1 im Bau", () => {
  it("das Original ist die unveränderte bisherige Figur", () => {
    const original = ASSISTENZ_AVATAR_KATALOG.find((m) => m.id === "original");
    const datei = repoPfad(`apps/web/public/${original?.datei}`);
    const summe = createHash("sha256").update(readFileSync(datei)).digest("hex");
    expect(summe).toBe(KLARA_AVATAR_SHA256);
  });

  it("alle zwölf neuen Motive liegen als PNG unter apps/web/public/assistenz/erstauswahl-v1/", () => {
    const fehlend: string[] = [];
    for (const m of ASSISTENZ_AVATAR_KATALOG.filter((x) => x.id !== "original")) {
      const datei = repoPfad(`apps/web/public/${m.datei}`);
      if (!existsSync(datei)) {
        fehlend.push(m.datei);
        continue;
      }
      const inhalt = readFileSync(datei);
      expect(inhalt.length, m.datei).toBeGreaterThan(1_000);
      expect(inhalt.subarray(0, 8).equals(PNG_SIGNATUR), `${m.datei} ist kein PNG`).toBe(true);
    }
    expect(fehlend, `fehlende Motivdateien: ${fehlend.join(", ")}`).toEqual([]);
  });
});
