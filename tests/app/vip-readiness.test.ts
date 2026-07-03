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
  };
  const notReady: ReadinessInput = {
    kiBoth: false,
    kiAny: false,
    validated: 0,
    openReviews: 0,
    uploadLimits: null,
    externalStage: null,
  };

  it("liefert fünf Zeilen in fester Reihenfolge", () => {
    const ids = readinessRows(ready).map((r) => r.id);
    expect(ids).toEqual(["ki", "validated", "openReviews", "upload", "external"]);
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

  it("Upload-Grenzen werden in KB umgerechnet; ohne Grenzen 'unbekannt'", () => {
    const withLimits = readinessRows(ready).find((r) => r.id === "upload");
    expect(withLimits?.params).toEqual({ n: 8, kb: 700 });
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
