import { describe, expect, it } from "vitest";
import {
  KNOWN_PERMISSIONS,
  MUTATING_METHODS,
  type Protection,
  ROUTE_GUARD_MATRIX,
  routeKey,
  scanAllRoutes,
} from "./routeGuardAudit";

// SCRUM-367 / AG-11 / FR-RBAC-04 / NFR-SEC-04: RBAC-Route-Guard-Audit als Regression. Der Scanner liest
// die ECHTEN Route-Quelldateien; die Erwartung steht in routeGuardAudit.ts. Diese Tests belegen, dass
// jede kritische mutierende Route serverseitig geschützt ist und keine Route unauditiert/heruntergestuft
// durchrutscht.
describe("SCRUM-367: RBAC route guard audit", () => {
  const scanned = scanAllRoutes();
  const scannedByKey = new Map(scanned.map((r) => [routeKey(r.method, r.url), r]));

  it("findet eine plausible Anzahl Routen (Scanner funktioniert)", () => {
    expect(scanned.length).toBeGreaterThan(60);
    // Keine unbekannten URLs durchgerutscht.
    expect(scanned.every((r) => r.url.startsWith("/"))).toBe(true);
  });

  it("jede tatsächlich verdrahtete Route ist in der Audit-Matrix erfasst (keine blinde Route)", () => {
    const missing = [...scannedByKey.keys()].filter((k) => !(k in ROUTE_GUARD_MATRIX));
    expect(missing).toEqual([]);
  });

  it("die Audit-Matrix enthält keine veralteten Einträge (jede erwartete Route existiert real)", () => {
    const stale = Object.keys(ROUTE_GUARD_MATRIX).filter((k) => !scannedByKey.has(k));
    expect(stale).toEqual([]);
  });

  it("die verdrahtete Schutzart entspricht der Erwartung (kein stilles Downgrade)", () => {
    const mismatches: string[] = [];
    for (const [key, expectedEntry] of Object.entries(ROUTE_GUARD_MATRIX)) {
      const actual = scannedByKey.get(key);
      if (actual && actual.protection !== expectedEntry.protection) {
        mismatches.push(`${key}: erwartet ${expectedEntry.protection}, ist ${actual.protection}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("JEDE mutierende Route (POST/PUT/DELETE/PATCH) ist NICHT öffentlich — außer den bewussten Auth-Endpunkten", () => {
    const mutating = scanned.filter((r) =>
      (MUTATING_METHODS as readonly string[]).includes(r.method),
    );
    const publicMutating = mutating
      .filter((r) => r.protection === "public")
      .map((r) => routeKey(r.method, r.url));
    // Erlaubt sind ausschließlich die Auth-Einstiegspunkte (sie SIND der Login-/Recovery-/SSO-Mechanismus).
    const allowed = new Set([
      "POST /api/auth/register",
      "POST /api/auth/login",
      "POST /api/auth/logout",
      "POST /api/auth/forgot",
      "POST /api/auth/reset",
      "POST /api/auth/oidc",
      "POST /api/auth/setup",
    ]);
    const unexpected = publicMutating.filter((k) => !allowed.has(k));
    expect(unexpected).toEqual([]);
  });

  it("jede öffentliche Route trägt eine Begründung (bewusste public-Entscheidung)", () => {
    const undocumented = Object.entries(ROUTE_GUARD_MATRIX)
      .filter(([, e]) => e.protection === "public" && !e.reason)
      .map(([k]) => k);
    expect(undocumented).toEqual([]);
  });

  it("alle Permission-Schutzarten sind gültige RBAC-Rechte", () => {
    const permLike = Object.values(ROUTE_GUARD_MATRIX)
      .map((e) => e.protection)
      .filter((p) => p.includes("."));
    const valid = new Set<Protection>(KNOWN_PERMISSIONS);
    expect(permLike.every((p) => valid.has(p))).toBe(true);
  });

  it("die action-dispatched Route (PUT /api/kos/:id) ist niemals öffentlich", () => {
    const put = scannedByKey.get("PUT /api/kos/:id");
    expect(put?.protection).toBe("action-dispatched");
  });
});
