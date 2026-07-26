import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type ReadinessInput, readinessRows } from "../../apps/web/src/lib/vipReadiness";

// SCRUM-437 (Pedi 03.07., VIP): Bereitschafts-Zeilen — ehrliche Ampel aus echten Zahlen, DE+EN belegt.
describe("SCRUM-437: VIP-Bereitschaft", () => {
  const ready: ReadinessInput = {
    kiBoth: true,
    kiAny: true,
    validated: 5,
    openReviews: 2,
    uploadLimits: { maxAttachments: 8, maxAttachmentBytes: 700_000 },
    externalStage: "open",
    // AUFTRAG-mega14 Block H (SCRUM-437): Demodaten-Stand.
    demo: { present: false, count: 0 },
  };
  const notReady: ReadinessInput = {
    kiBoth: false,
    kiAny: false,
    validated: 0,
    openReviews: 0,
    uploadLimits: null,
    externalStage: null,
    demo: null,
  };

  it("liefert sechs Zeilen in fester Reihenfolge", () => {
    // AUFTRAG-mega14 Block H (SCRUM-437): die Demodaten-Zeile ist dazugekommen — sie fehlte, obwohl
    // Laden/Entfernen längst im Datenbereich lag. Reihenfolge bleibt fest.
    const ids = readinessRows(ready).map((r) => r.id);
    expect(ids).toEqual(["ki", "validated", "openReviews", "upload", "external", "demo"]);
  });

  it("Block H: die Demodaten-Zeile sagt ehrlich, was sie weiß", () => {
    const geladen = readinessRows({ ...ready, demo: { present: true, count: 22 } }).find(
      (r) => r.id === "demo",
    );
    expect(geladen?.valueKey).toBe("adm.ready.demo.loaded");
    expect(geladen?.params?.n).toBe(22);
    // Demodaten sind ein ZUSTAND, kein Mangel — kein warn/crit, wie bei der Externe-Stufe.
    expect(geladen?.tone).toBe("info");

    const keine = readinessRows(ready).find((r) => r.id === "demo");
    expect(keine?.valueKey).toBe("adm.ready.demo.none");
    expect(keine?.tone).toBe("ok");

    // Noch nicht geladen → „unbekannt", NICHT „keine". Eine fehlende Antwort ist kein Nein.
    const unbekannt = readinessRows({ ...ready, demo: null }).find((r) => r.id === "demo");
    expect(unbekannt?.valueKey).toBe("adm.ready.unknown");
    expect(unbekannt?.tone).toBe("warn");
  });

  it("Ampel ehrlich: bereit=ok, fehlend=warn/crit", () => {
    const r = Object.fromEntries(readinessRows(ready).map((x) => [x.id, x.tone]));
    expect(r.ki).toBe("ok");
    expect(r.validated).toBe("ok");
    expect(r.openReviews).toBe("info");
    expect(r.upload).toBe("ok");

    const n = Object.fromEntries(readinessRows(notReady).map((x) => [x.id, x.tone]));
    expect(n.ki).toBe("crit");
    expect(n.validated).toBe("warn");
    expect(n.upload).toBe("warn");
  });

  // E2E-020: EINHEITLICH in MB (nicht mehr KB), damit Admin/Erfassen/Bereitschaft dieselbe Einheit
  // zeigen. 700_000 Bytes → gerundet 1 MB.
  it("Upload-Grenzen werden in MB umgerechnet; ohne Grenzen 'unbekannt'", () => {
    const withLimits = readinessRows(ready).find((r) => r.id === "upload");
    expect(withLimits?.params).toEqual({ n: 8, mb: 1 });
    const without = readinessRows(notReady).find((r) => r.id === "upload");
    expect(without?.valueKey).toBe("adm.ready.unknown");
    expect(without?.params).toBeUndefined();
  });

  it("alle Label- und Wert-Schlüssel lösen in DE und EN auf", async () => {
    const stages: ReadinessInput["externalStage"][] = [
      "blocked",
      "search_on_click",
      "search_attach",
      "open",
      null,
    ];
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const stage of stages) {
        for (const row of readinessRows({ ...ready, externalStage: stage })) {
          for (const key of [row.labelKey, row.valueKey]) {
            expect(i18n.t(key)).not.toBe(key);
          }
        }
      }
    }
  });
});
