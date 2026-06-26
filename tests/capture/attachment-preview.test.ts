import { describe, expect, it } from "vitest";
import type { KoAttachment } from "../../apps/web/src/api/types";
import { attachmentPreview, isObjectAttachment } from "../../apps/web/src/lib/attachment";

const att = (p: Partial<KoAttachment>): KoAttachment =>
  ({ id: "a1", name: "x", mime: "image/jpeg", author: "u", at: "t", ...p }) as KoAttachment;

describe("SCRUM-121: Attachment-Preview/Referenz (FE)", () => {
  it("neuer Anhang: Referenz (objectId) + kleine Vorschau (thumbnail), KEIN großes dataUrl", () => {
    const a = att({ objectId: "obj-1", thumbnail: "data:img/thumb", size: 1_500_000 });
    expect(isObjectAttachment(a)).toBe(true);
    expect(attachmentPreview(a)).toBe("data:img/thumb");
    expect(a.dataUrl).toBeUndefined();
  });

  it("Alt-Anhang: dataUrl bleibt lesbar als Vorschau", () => {
    const a = att({ dataUrl: "data:img/old" });
    expect(isObjectAttachment(a)).toBe(false);
    expect(attachmentPreview(a)).toBe("data:img/old");
  });

  it("ohne Vorschau → null", () => {
    expect(attachmentPreview(att({ objectId: "obj-2" }))).toBeNull();
  });
});
