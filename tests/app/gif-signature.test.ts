// WP-BILD-1g (bens Klein-Fix 2): die GIF-Signatur wird EXAKT geprüft — nur GIF87a und GIF89a
// (nicht mehr jedes „GIF8…"-Präfix). Ungültige Signaturen werden an der Route abgelehnt, OHNE
// dass ein Provider-Aufruf läuft.
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { validateDescribeImageDataUrl } from "../../services/reasoner";

const gifUrl = (signature: string): string =>
  `data:image/gif;base64,${Buffer.concat([
    Buffer.from(signature, "latin1"),
    Buffer.alloc(8),
  ]).toString("base64")}`;

describe("WP-BILD-1g: exakte GIF-Signatur (GIF87a | GIF89a)", () => {
  it("beide echten GIF-Versionen passieren; alles andere wird als magic-mismatch abgelehnt", () => {
    expect(validateDescribeImageDataUrl(gifUrl("GIF87a")).ok).toBe(true);
    expect(validateDescribeImageDataUrl(gifUrl("GIF89a")).ok).toBe(true);
    for (const bad of ["GIF88a", "GIF8Xa", "GIF89b", "GIF90a"]) {
      const verdict = validateDescribeImageDataUrl(gifUrl(bad));
      expect(verdict).toEqual({ ok: false, code: "magic-mismatch" });
    }
  });

  it("Route: ungültige Signatur → 400 ohne Provider-Aufruf; gültige → Provider genau einmal", async () => {
    const services = buildServices();
    const spy = vi.fn(async () => ({
      text: null,
      demo: true as const,
      fallbackReason: "no-model" as const,
    }));
    services.reasoner.describeImage = spy as unknown as typeof services.reasoner.describeImage;
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Nutzer", email: "n@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "n@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };

    const bad = await app.inject({
      method: "POST",
      url: "/api/reasoner/describe",
      headers,
      payload: { dataUrl: gifUrl("GIF8Xa") },
    });
    expect(bad.statusCode).toBe(400);
    expect(spy).not.toHaveBeenCalled();

    const good = await app.inject({
      method: "POST",
      url: "/api/reasoner/describe",
      headers,
      payload: { dataUrl: gifUrl("GIF89a") },
    });
    expect(good.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
