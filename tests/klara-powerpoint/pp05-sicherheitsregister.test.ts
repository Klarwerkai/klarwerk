import { describe, expect, it } from "vitest";
import { ROUTE_GUARD_MATRIX, routeKey, schutzartVon } from "../security/routeGuardAudit";
import { erhebeSchnittstellen } from "../security/schnittstellenErhebung";
describe("PP05 neue Schutzregister", () => {
  const funde = erhebeSchnittstellen().registrierungen.filter(
    (r) => r.datei === "services/app/src/routes/praesentation-aufbau-routes.ts",
  );
  it("Beide neuen Routen verlangen ko.create und behalten das bestehende Artikel-Zeilenrecht", () => {
    expect(funde).toHaveLength(2);
    for (const f of funde) {
      expect(schutzartVon(f.aufruf)).toBe("ko.create");
      expect(ROUTE_GUARD_MATRIX[routeKey(f.methode, f.pfad)]).toEqual({
        protection: "ko.create",
        zeilenrecht: ["darfSehen"],
      });
    }
  });
});
