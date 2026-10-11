// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) · AC10 — DIE REALE PROBE BLEIBT AN IHRE
// FREIGABE GEBUNDEN.
// ================================================================================================
//
// `echtprobe-wikipedia.ts` führt einen tatsächlichen Fähigkeitsaufruf über den Produktweg aus —
// aber nur, wenn er ausdrücklich freigegeben ist und die externe Suche nicht abgeschaltet ist. Diese
// Datei belegt die Grenze: ohne Freigabe oder im hermetischen Lauf (`EXTERNAL_SEARCH=off`, gesetzt
// von `tests/setup-env.ts`) geht keine Netzanfrage hinaus, und der Beleg nennt die konkrete
// Voraussetzung. Den realen Aufruf selbst belegt diese Datei NICHT.
import { afterEach, describe, expect, it, vi } from "vitest";
import { FREIGABE_ENV, fuehreEchtprobeAus } from "./echtprobe-wikipedia";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AC10 · reale Probe nur nach ausdrücklicher Freigabe", () => {
  it("ohne Freigabe: keine Netzanfrage, die fehlende Freigabe ist benannt", async () => {
    const netz = vi.spyOn(globalThis, "fetch");
    const beleg = await fuehreEchtprobeAus({ env: { KLARWERK_KANDIDAT: "test" } });
    expect(beleg.stand).toBe("voraussetzung_fehlt");
    expect(beleg.voraussetzungen.join(" ")).toContain(FREIGABE_ENV);
    expect(beleg.auftragId).toBeNull();
    expect(netz).not.toHaveBeenCalled();
  });

  it("freigegeben, aber hermetischer Lauf: keine Netzanfrage, EXTERNAL_SEARCH=off ist benannt", async () => {
    expect(process.env.EXTERNAL_SEARCH).toBe("off");
    const netz = vi.spyOn(globalThis, "fetch");
    const beleg = await fuehreEchtprobeAus({
      env: { ...process.env, [FREIGABE_ENV]: "freigegeben" },
    });
    expect(beleg.stand).toBe("voraussetzung_fehlt");
    expect(beleg.voraussetzungen.join(" ")).toContain("EXTERNAL_SEARCH=off");
    expect(netz).not.toHaveBeenCalled();
  });
});
