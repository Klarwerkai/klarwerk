import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";
import {
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
  // R-1349: gemessen am echten `Set-Cookie` der Anmeldung statt an einer Abschrift der Eigenschaften.
  it("Cookie-Strategie am echten Set-Cookie: HttpOnly, Path=/, SameSite=Lax", async () => {
    expect(SESSION_COOKIE).toBe("kw_session");
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "c@x.de", password: "secret123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "c@x.de", password: "secret123" },
    });
    const roh = res.headers["set-cookie"];
    const cookie = (Array.isArray(roh) ? roh : [roh ?? ""]).find((c) =>
      c.startsWith(`${SESSION_COOKIE}=`),
    );
    expect(cookie, "die Anmeldung setzt kein Session-Cookie").toBeDefined();
    const teile = (cookie ?? "").split(";").map((t) => t.trim());
    expect(teile).toContain("HttpOnly");
    expect(teile).toContain("Path=/");
    expect(teile).toContain("SameSite=Lax");
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

  it("csrfAssessment: Cookie + unsafe ist ambient, aber durch die Herkunftsprüfung geschützt (ehrliches Restrisiko)", () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const a = csrfAssessment({ method, authMode: "cookie" });
      expect(a.stateChanging).toBe(true);
      expect(a.cookieCsrfExposed).toBe(true);
      expect(a.mitigation).toBe("origin-check");
      expect(a.residualRiskKey).toBe("csrf.residual.legacyBrowserNoOriginHeaders");
    }
  });

  it("csrfAssessment: ohne Auth + unsafe → der Guard lehnt ohnehin ab (kein CSRF-Vektor)", () => {
    const a = csrfAssessment({ method: "POST", authMode: "none" });
    expect(a.stateChanging).toBe(true);
    expect(a.cookieCsrfExposed).toBe(false);
    expect(a.mitigation).toBe("unauthenticated");
  });
});

// R-0544 / R-0797 (Aufnahme gesamt-csrf-schutz): die Herkunftsprüfung am ECHTEN `buildApp` per
// HTTP-inject — dieselbe Registrierung wie im Betrieb, keine Kopie. Eigener Host `klarwerk.test`.
describe("R-0544/R-0797: schreibende Sitzungsaufrufe nur aus der eigenen Herkunft", () => {
  const HOST = "klarwerk.test";

  async function angemeldet() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      headers: { host: HOST },
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { host: HOST },
      payload: { email: "a@x.de", password: "secret123" },
    });
    const token = res.json().token as string;
    expect(token).toBeTruthy();
    return { app, token, cookie: `${SESSION_COOKIE}=${token}` };
  }

  async function angemeldetBleibt(app: ReturnType<typeof buildApp>, cookie: string) {
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { host: HOST, cookie },
    });
    return me.statusCode;
  }

  it("fremde Seite (Sec-Fetch-Site cross-site) kann mit dem Cookie nicht schreiben — 403, Sitzung unberührt", async () => {
    const { app, cookie } = await angemeldet();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        host: HOST,
        cookie,
        "sec-fetch-site": "cross-site",
        origin: "https://boese.example",
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("FORBIDDEN");
    expect(await angemeldetBleibt(app, cookie)).toBe(200);
  });

  it("R-0544: Nachbar-Unteradresse derselben Site (Sec-Fetch-Site same-site) wird abgelehnt", async () => {
    const { app, cookie } = await angemeldet();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        host: HOST,
        cookie,
        "sec-fetch-site": "same-site",
        origin: `https://fremd.${HOST}`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(await angemeldetBleibt(app, cookie)).toBe(200);
  });

  it("die eigene Anwendung (Sec-Fetch-Site same-origin) schreibt weiter", async () => {
    const { app, cookie } = await angemeldet();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { host: HOST, cookie, "sec-fetch-site": "same-origin", origin: `https://${HOST}` },
    });
    expect(res.statusCode).toBe(204);
    expect(await angemeldetBleibt(app, cookie)).toBe(401);
  });

  it("ohne Sec-Fetch-Site entscheidet Origin gegen den eigenen Host (auch mit Standardport im Host)", async () => {
    const { app, cookie } = await angemeldet();
    for (const origin of ["https://boese.example", `https://fremd.${HOST}`, "null", "kaputt"]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: { host: HOST, cookie, origin },
      });
      expect(res.statusCode, origin).toBe(403);
    }
    expect(await angemeldetBleibt(app, cookie)).toBe(200);
    const eigen = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { host: `${HOST}:443`, cookie, origin: `https://${HOST}` },
    });
    expect(eigen.statusCode).toBe(204);
  });

  it("alle schreibenden Methoden sind erfasst, lesende nicht", async () => {
    const { app, cookie } = await angemeldet();
    const fremd = { host: HOST, cookie, "sec-fetch-site": "cross-site" };
    for (const method of ["POST", "PUT", "DELETE", "PATCH"] as const) {
      const res = await app.inject({ method, url: "/api/kos/irgendwas", headers: fremd });
      expect(res.statusCode, method).toBe(403);
    }
    const lesen = await app.inject({ method: "GET", url: "/api/auth/me", headers: fremd });
    expect(lesen.statusCode).toBe(200);
  });

  it("Bearer-Token und Aufrufe ohne Herkunftsangabe (Programmclients) bleiben unberührt", async () => {
    const { app, token } = await angemeldet();
    const bearer = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        host: HOST,
        authorization: `Bearer ${token}`,
        "sec-fetch-site": "cross-site",
        origin: "https://boese.example",
      },
    });
    expect(bearer.statusCode).toBe(204);
    const { app: app2, cookie: cookie2 } = await angemeldet();
    const programm = await app2.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { host: HOST, cookie: cookie2 },
    });
    expect(programm.statusCode).toBe(204);
  });
});
