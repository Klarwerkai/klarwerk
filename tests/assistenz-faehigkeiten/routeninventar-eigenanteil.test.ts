// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) · DER EIGENE ANTEIL AN DEN ROUTENINVENTAREN.
// ================================================================================================
//
// Die globalen Wächter `route-guard-audit`, `jede-gruppe-steht-in-der-tabelle` und
// `jede-registrierte-route-ist-abgenommen` sind an Kandidat 2a5de283 an FREMDEN, gegenüber dem
// integrierten Hauptstand (8fc314ede) unveränderten Routen rot (office-routes, wiederanlauf,
// ask/library-Nebenwege, vorfuehrung). Sie bleiben unverändert. Diese Datei misst mit DENSELBEN
// Werkzeugen nur die Routen dieses Auftrags:
//
//   R1  Jede in `assistenz-faehigkeiten-routes.ts` registrierte Route steht in ROUTE_GUARD_MATRIX,
//       und die am Quelltext gemessene Schutzart ist die eingetragene.
//   R2  Keine schreibende Route dieser Datei ist öffentlich.
//   R3  Jede dieser Routen hat genau eine Zeile in der Rollenabnahme (TABELLE) unter der Gruppe
//       `assistenzFaehigkeitenRoutes`, und die Gruppe ist in `build-app.ts` registriert.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TABELLE } from "../beta-rollenabnahme/tabelle";
import { ROUTE_GUARD_MATRIX, routeKey, scanRouteFile } from "../security/routeGuardAudit";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATEI = "services/app/src/routes/assistenz-faehigkeiten-routes.ts";
const GRUPPE = "assistenzFaehigkeitenRoutes";

const gescannt = scanRouteFile(readFileSync(join(WURZEL, DATEI), "utf8"), DATEI);

describe("Routeninventare · eigener Anteil der Fähigkeitswege", () => {
  it("die Erhebung findet alle acht Wege dieser Datei", () => {
    expect(gescannt.map((r) => routeKey(r.method, r.url)).sort()).toEqual(
      [
        "GET /api/me/faehigkeiten",
        "GET /api/me/faehigkeiten/auftraege",
        "GET /api/me/faehigkeiten/auftraege/:id",
        "POST /api/me/faehigkeiten/auftraege",
        "POST /api/me/faehigkeiten/auftraege/:id/abbrechen",
        "POST /api/me/faehigkeiten/vormerkungen",
        "POST /api/me/faehigkeiten/vormerkungen/:id/deaktivieren",
        "POST /api/me/faehigkeiten/vorschau",
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
