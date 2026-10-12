// ================================================================================================
// KLARA 12 (produkt:20261008:klara-eigeninitiative) · DER EIGENE ANTEIL AN DEN ROUTENINVENTAREN.
// ================================================================================================
//
// Wie `tests/assistenz-faehigkeiten/routeninventar-eigenanteil.test.ts`: dieselben Werkzeuge der
// globalen Wächter, gemessen nur an der Datei, die dieser Auftrag erweitert hat
// (`assistenz-profil-routes.ts`, drei neue Wege für den Unterstützungsmodus).
//
//   R1  Jede Route der Datei steht in ROUTE_GUARD_MATRIX, mit der am Quelltext gemessenen Schutzart.
//   R2  Keine Route der Datei ist öffentlich.
//   R3  Jede Route hat genau eine Zeile der Rollenabnahme unter `assistenzProfilRoutes`; die Gruppe
//       ist in `build-app.ts` registriert.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TABELLE } from "../beta-rollenabnahme/tabelle";
import { ROUTE_GUARD_MATRIX, routeKey, scanRouteFile } from "../security/routeGuardAudit";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATEI = "services/app/src/routes/assistenz-profil-routes.ts";
const GRUPPE = "assistenzProfilRoutes";

const gescannt = scanRouteFile(readFileSync(join(WURZEL, DATEI), "utf8"), DATEI);

describe("Routeninventare · eigener Anteil des Unterstützungsmodus", () => {
  it("die Erhebung findet alle fünf Wege der Datei", () => {
    expect(gescannt.map((r) => routeKey(r.method, r.url)).sort()).toEqual(
      [
        "GET /api/me/assistenz",
        "PUT /api/me/assistenz",
        "GET /api/me/assistenz/eigeninitiative",
        "PUT /api/me/assistenz/eigeninitiative",
        "POST /api/me/assistenz/eigeninitiative/hinweise",
      ].sort(),
    );
  });

  it("R1 · jede Route steht in der Matrix, mit der am Quelltext gemessenen Schutzart", () => {
    for (const r of gescannt) {
      const k = routeKey(r.method, r.url);
      expect([k, ROUTE_GUARD_MATRIX[k]?.protection]).toEqual([k, r.protection]);
    }
  });

  it("R2 · keine Route dieser Datei ist öffentlich", () => {
    expect(gescannt.filter((r) => r.protection === "public").map((r) => r.url)).toEqual([]);
  });

  it("R3 · jede Route hat genau eine Zeile der Rollenabnahme; die Gruppe ist registriert", () => {
    const zeilen = TABELLE.filter((z) => z.gruppe === GRUPPE);
    for (const r of gescannt) {
      const treffer = zeilen.filter(
        (z) => z.methode === r.method.toUpperCase() && (z.route ?? z.pfad) === r.url,
      );
      expect([routeKey(r.method, r.url), treffer.length]).toEqual([routeKey(r.method, r.url), 1]);
    }
    expect(zeilen).toHaveLength(gescannt.length);
    const buildApp = readFileSync(join(WURZEL, "services/app/src/build-app.ts"), "utf8");
    expect(buildApp).toContain(`${GRUPPE}(`);
  });
});
