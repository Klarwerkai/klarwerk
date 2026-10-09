import { describe, expect, it } from "vitest";
import { parseOidcCallback } from "../../apps/web/src/lib/oidcCallback";

// R-1349 (Aufnahme gesamt-aufruferwaechter): `isCompleteCallback` ist entfernt (kein Produktleser;
// der SSO-Rückruf prüft code und state selbst). Gemessen bleibt das Parsen, das er liest.
describe("FR-AUTH-07: parseOidcCallback", () => {
  it("liest code + state aus der Query", () => {
    const cb = parseOidcCallback("?code=abc&state=xyz");
    expect(cb.code).toBe("abc");
    expect(cb.state).toBe("xyz");
    expect(cb.error).toBeNull();
  });

  it("funktioniert ohne führendes Fragezeichen", () => {
    expect(parseOidcCallback("code=a&state=b").code).toBe("a");
  });

  it("fasst error + error_description zusammen", () => {
    const cb = parseOidcCallback("?error=access_denied&error_description=Nope");
    expect(cb.error).toBe("access_denied: Nope");
    expect(cb.code).toBeNull();
  });

  it("ein unvollständiger Callback (nur code) liefert state als null", () => {
    expect(parseOidcCallback("?code=a")).toEqual({ code: "a", state: null, error: null });
    expect(parseOidcCallback("")).toEqual({ code: null, state: null, error: null });
  });
});
