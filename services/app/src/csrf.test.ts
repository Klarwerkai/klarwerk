import { describe, expect, it } from "vitest";
import {
  COOKIE_STRATEGY,
  SESSION_COOKIE,
  UNSAFE_METHODS,
  csrfAssessment,
  isUnsafeMethod,
  requestAuthMode,
} from "./csrf";

// SCRUM-367 / AG-10 / NFR-SEC-04: die CSRF-/Cookie-Strategie ist explizit und testbar. Diese Tests
// dokumentieren die Schutzlage als Code-Evidence (kein Verhalten geändert): Bearer-Token sind nicht
// cookie-CSRF-anfällig, Cookie-Sessions sind durch SameSite=Lax begrenzt, und die unsicheren Methoden
// sind klar benannt. Restrisiken werden ehrlich als Schlüssel transportiert (kein Sicherheitsversprechen).
describe("SCRUM-367: CSRF/Cookie strategy", () => {
  it("Cookie-Strategie ist dokumentiert (HttpOnly, Path=/, SameSite=Lax, Secure-konfigurierbar)", () => {
    expect(COOKIE_STRATEGY).toEqual({
      name: "kw_session",
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secureWhenConfigured: true,
    });
    expect(SESSION_COOKIE).toBe("kw_session");
  });

  it("unsichere (zustandsändernde) Methoden sind genau POST/PUT/DELETE/PATCH", () => {
    expect([...UNSAFE_METHODS]).toEqual(["POST", "PUT", "DELETE", "PATCH"]);
    for (const m of ["post", "PUT", "Delete", "patch"]) {
      expect(isUnsafeMethod(m)).toBe(true);
    }
    for (const m of ["GET", "head", "OPTIONS"]) {
      expect(isUnsafeMethod(m)).toBe(false);
    }
  });

  it("requestAuthMode: Bearer vor Cookie, sonst none", () => {
    expect(requestAuthMode({ authorization: "Bearer abc.def" })).toBe("bearer");
    expect(requestAuthMode({ cookie: "kw_session=tok; other=1" })).toBe("cookie");
    // Bearer hat Vorrang, wenn beides vorhanden ist.
    expect(requestAuthMode({ authorization: "Bearer x", cookie: "kw_session=tok" })).toBe("bearer");
    // Anderes Cookie ohne Session zählt nicht.
    expect(requestAuthMode({ cookie: "theme=dark" })).toBe("none");
    expect(requestAuthMode({})).toBe("none");
    // Leerer/unvollstaendiger Bearer zaehlt nicht.
    expect(requestAuthMode({ authorization: "Bearer " })).toBe("none");
  });

  it("csrfAssessment: GET ist nicht zustandsändernd → keine CSRF-Relevanz", () => {
    const a = csrfAssessment({ method: "GET", authMode: "cookie" });
    expect(a.stateChanging).toBe(false);
    expect(a.cookieCsrfExposed).toBe(false);
    expect(a.mitigation).toBe("not-state-changing");
  });

  it("csrfAssessment: Bearer + POST ist NICHT cookie-CSRF-gefährdet (Token nicht ambient)", () => {
    const a = csrfAssessment({ method: "POST", authMode: "bearer" });
    expect(a.stateChanging).toBe(true);
    expect(a.cookieCsrfExposed).toBe(false);
    expect(a.mitigation).toBe("bearer-token");
    // Restrisiko ist Token-Leakage (XSS) — KEIN CSRF.
    expect(a.residualRiskKey).toBe("csrf.residual.bearerTokenLeak");
  });

  it("csrfAssessment: Cookie + unsafe ist ambient, aber durch SameSite=Lax begrenzt (ehrliches Restrisiko)", () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const a = csrfAssessment({ method, authMode: "cookie" });
      expect(a.stateChanging).toBe(true);
      expect(a.cookieCsrfExposed).toBe(true);
      expect(a.mitigation).toBe("samesite-lax");
      expect(a.residualRiskKey).toBe("csrf.residual.legacyBrowserNoSameSite");
    }
  });

  it("csrfAssessment: ohne Auth + unsafe → der Guard lehnt ohnehin ab (kein CSRF-Vektor)", () => {
    const a = csrfAssessment({ method: "POST", authMode: "none" });
    expect(a.stateChanging).toBe(true);
    expect(a.cookieCsrfExposed).toBe(false);
    expect(a.mitigation).toBe("unauthenticated");
  });
});
