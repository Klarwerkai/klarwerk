import { describe, expect, it } from "vitest";
// AUFTRAG-mega1 Block D7 (E2E-020): Dateigrößen EINHEITLICH in MB (nicht mehr „20000 KB" in der
// Bereitschaft) und die Profil-Sprachwahl bietet DE/EN/NL wie der Header.
import i18n from "../../apps/web/src/i18n";
import { OBERFLAECHEN_SPRACHEN } from "../../apps/web/src/lib/sprachregister";
import { readinessRows } from "../../apps/web/src/lib/vipReadiness";

describe("Block D7: MB/KB einheitlich + Sprachumfang", () => {
  it("Bereitschaft rechnet Anhangsgröße in MB (20_000_000 Bytes → 20)", () => {
    const rows = readinessRows({
      kiBoth: false,
      kiAny: true,
      validated: 0,
      openReviews: 0,
      uploadLimits: { maxAttachments: 10, maxAttachmentBytes: 20_000_000 },
      externalStage: null,
      demo: null,
    });
    const upload = rows.find((r) => r.id === "upload");
    expect(upload?.params?.mb).toBe(20);
    expect(upload?.params?.kb).toBeUndefined();
  });

  it("das i18n-Label der Bereitschaft nennt MB (nicht KB) in allen Sprachen", () => {
    for (const lng of ["de", "en", "nl"] as const) {
      const val = String(i18n.getResource(lng, "translation", "adm.ready.upload.val"));
      expect(val).toContain("{{mb}} MB");
      expect(val).not.toContain("KB");
    }
  });

  it("Profil und Kontomenü bieten die drei mitgelieferten Oberflächensprachen an", () => {
    // Die tatsächlich gerenderten Knöpfe prüft regionale-sprache-aktiv für beide Flächen.
    expect(OBERFLAECHEN_SPRACHEN).toEqual(["de", "en", "nl"]);
  });
});
