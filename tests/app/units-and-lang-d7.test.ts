// AUFTRAG-mega1 Block D7 (E2E-020): Dateigrößen EINHEITLICH in MB (nicht mehr „20000 KB" in der
// Bereitschaft) und die Profil-Sprachwahl bietet DE/EN/NL wie der Header.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { readinessRows } from "../../apps/web/src/lib/vipReadiness";

const web = (p: string): string => readFileSync(join(__dirname, "../../apps/web/src", p), "utf8");

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

  it("Profil-Sprachwahl bietet DE/EN/NL", () => {
    const src = web("pages/Profile.tsx");
    expect(src).toMatch(/\["de",\s*"en",\s*"nl"\]/);
  });
});
