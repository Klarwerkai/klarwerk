// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) · AC10 — DIE HERMETISCHE GRENZE BLEIBT.
// ================================================================================================
//
// `echtprobe-wikipedia.ts` führt den realen Aufruf aus, wenn ihm der Suchweg übergeben wird
// (`echtaufruf-wikipedia.integration.test.ts`, Integrationslauf). Diese Datei belegt nur, dass die
// Probe in der hermetischen Unit-Umgebung (`EXTERNAL_SEARCH=off`, `tests/setup-env.ts`) OHNE
// übergebenen Suchweg nichts sendet und das benennt. Den realen Aufruf belegt sie nicht.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fuehreEchtprobeAus } from "./echtprobe-wikipedia";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AC10 · ohne Suchweg im hermetischen Lauf keine Netzanfrage", () => {
  it("EXTERNAL_SEARCH=off ohne übergebenen Suchweg: keine Netzanfrage, Grund benannt", async () => {
    expect(process.env.EXTERNAL_SEARCH).toBe("off");
    const netz = vi.spyOn(globalThis, "fetch");
    const beleg = await fuehreEchtprobeAus({ env: { ...process.env } });
    expect(beleg.stand).toBe("voraussetzung_fehlt");
    expect(beleg.voraussetzungen.join(" ")).toContain("EXTERNAL_SEARCH=off");
    expect(beleg.auftragId).toBeNull();
    expect(netz).not.toHaveBeenCalled();
  });
});
