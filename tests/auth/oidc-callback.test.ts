import { describe, expect, it } from "vitest";
import { isCompleteCallback, parseOidcCallback } from "../../apps/web/src/lib/oidcCallback";

describe("FR-AUTH-07: parseOidcCallback", () => {
  it("liest code + state aus der Query", () => {
    const cb = parseOidcCallback("?code=abc&state=xyz");
    expect(cb.code).toBe("abc");
    expect(cb.state).toBe("xyz");
    expect(cb.error).toBeNull();
    expect(isCompleteCallback(cb)).toBe(true);
  });

  it("funktioniert ohne führendes Fragezeichen", () => {
    expect(parseOidcCallback("code=a&state=b").code).toBe("a");
  });

  it("fasst error + error_description zusammen", () => {
    const cb = parseOidcCallback("?error=access_denied&error_description=Nope");
    expect(cb.error).toBe("access_denied: Nope");
    expect(cb.code).toBeNull();
    expect(isCompleteCallback(cb)).toBe(true);
  });

  it("unvollständiger Callback (nur code) ist nicht vollständig", () => {
    expect(isCompleteCallback(parseOidcCallback("?code=a"))).toBe(false);
    expect(isCompleteCallback(parseOidcCallback(""))).toBe(false);
  });
});
