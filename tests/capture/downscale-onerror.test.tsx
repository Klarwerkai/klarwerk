// @vitest-environment jsdom
// WP-RETEST7 R1b: downscaleImageDataUrl darf bei einem NICHT dekodierbaren Bild (img.onerror) nie
// hängen — die Promise löst mit dem ORIGINAL auf (das Gesamt-Budget bleibt der Backstop). jsdom
// dekodiert keine echten Bilder; der Test stubbt Image und feuert onerror manuell.
import { afterEach, describe, expect, it, vi } from "vitest";
import { downscaleImageDataUrl } from "../../apps/web/src/lib/files";

class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 0;
  height = 0;
  set src(_value: string) {
    FakeImage.instances.push(this);
  }
}

afterEach(() => {
  FakeImage.instances = [];
  vi.unstubAllGlobals();
});

describe("WP-RETEST7 R1b: downscaleImageDataUrl bei kaputtem Bild", () => {
  it("onerror → Original zurück (keine hängende Promise)", async () => {
    vi.stubGlobal("Image", FakeImage);
    const original = "data:image/png;base64,kaputt";
    const pending = downscaleImageDataUrl(original);
    const img = FakeImage.instances[0];
    expect(img).toBeDefined();
    img?.onerror?.();
    await expect(pending).resolves.toBe(original);
  });

  it("kleines, leichtes Bild bleibt unverändert (onload-Pfad, Gegenprobe)", async () => {
    vi.stubGlobal("Image", FakeImage);
    const original = "data:image/png;base64,QQ==";
    const pending = downscaleImageDataUrl(original);
    const img = FakeImage.instances[0] as FakeImage;
    img.width = 10;
    img.height = 10;
    img.onload?.();
    await expect(pending).resolves.toBe(original);
  });
});
