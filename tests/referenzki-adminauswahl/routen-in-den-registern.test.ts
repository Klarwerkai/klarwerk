// ================================================================================================
// produkt:20261009:referenzki-adminauswahl (REF-03) — DIE DREI NEUEN TÜREN IN JEDEM REGISTER, GEZIELT.
// ================================================================================================
//
// Neu mit diesem Auftrag: `GET`/`PUT /api/reasoner/referenzpruefung` und
// `POST /api/reasoner/referenzpruefung/funktionscheck`. Die globalen Vollständigkeitswächter prüfen
// alle Routen auf einmal und sagen über diese drei Türen allein wenig (Begründung und Muster:
// `tests/referenzki-pruefdienst/route-in-den-registern.test.ts`). Hier dieselben Fragen gezielt:
//   R1 Der Routenscanner findet jede mit `users.manage`; die Matrix erwartet genau das.
//   R2 Jede ist am Router der vollständigen App GENAU EINMAL registriert und hat GENAU EINE
//      vollständige Referenzzeile mit `users.manage`.
//   R3 Nur der Funktionscheck ist eine KI-Route der Anfragebremse — Lesen und Speichern rufen kein
//      Modell.
//   R4 Die Rollenabnahme misst `GET` (nur Admin) und führt die beiden schreibenden Türen mit Grund.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { KI_ROUTEN, istKiRoute } from "../../services/app/src/ki-anfragebremse";
import { baueBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";
import { schluessel, zaehleRegistrierteRouten } from "../beta-rollenabnahme/registrierte-routen";
import { NICHT_ABGENOMMEN, TABELLE } from "../beta-rollenabnahme/tabelle";
import { ROUTE_GUARD_MATRIX, routeKey, scanAllRoutes } from "../security/routeGuardAudit";
import { repoPfad } from "../support/repoPfad";

const TUEREN = [
  ["GET", "/api/reasoner/referenzpruefung"],
  ["PUT", "/api/reasoner/referenzpruefung"],
  ["POST", "/api/reasoner/referenzpruefung/funktionscheck"],
] as const;

afterAll(schliesseBuehnen);

describe("REF-03 · die Türen des Einstiegs Referenzprüfung in den Registern", () => {
  it("R1 · der Routenscanner findet jede Tür mit users.manage — und die Matrix erwartet genau das", () => {
    const alle = scanAllRoutes();
    for (const [methode, pfad] of TUEREN) {
      const gefunden = alle.filter((r) => routeKey(r.method, r.url) === `${methode} ${pfad}`);
      expect(gefunden, `${methode} ${pfad}`).toHaveLength(1);
      expect(gefunden[0]?.file).toBe("services/app/src/routes/reasoner-routes.ts");
      expect(gefunden[0]?.protection).toBe("users.manage");
      expect(ROUTE_GUARD_MATRIX[`${methode} ${pfad}`]).toEqual({ protection: "users.manage" });
    }
  });

  it("R2 · am Router genau einmal registriert und genau einmal vollständig in der HTTP-Referenz", async () => {
    const buehne = await baueBuehne();
    const routen = zaehleRegistrierteRouten(buehne.app).routen;
    const referenz = readFileSync(repoPfad("docs/architektur/http-api-referenz.md"), "utf8");
    for (const [methode, pfad] of TUEREN) {
      const ziel = schluessel(methode, pfad);
      expect(
        routen.filter((r) => schluessel(r.methode, r.pfad) === ziel),
        `${methode} ${pfad}`,
      ).toHaveLength(1);
      const zeilen = referenz
        .split("\n")
        .filter((z) => z.startsWith(`| \`${methode}\` | \`${pfad}\` |`));
      expect(zeilen, `${methode} ${pfad}: keine oder mehr als eine Referenzzeile`).toHaveLength(1);
      const spalten = (zeilen[0] ?? "").split(/(?<!\\)\|/).map((s) => s.trim());
      expect(spalten.slice(3, 7).every((s) => s.length > 0)).toBe(true);
      expect(spalten[3]).toContain("users.manage");
    }
  });

  it("R3 · nur der Funktionscheck zählt zur KI-Anfragebremse", () => {
    expect(
      KI_ROUTEN.some(
        (r) => r.methode === "POST" && r.pfad === "/api/reasoner/referenzpruefung/funktionscheck",
      ),
    ).toBe(true);
    expect(istKiRoute("POST", "/api/reasoner/referenzpruefung/funktionscheck")).toBe(true);
    expect(istKiRoute("GET", "/api/reasoner/referenzpruefung")).toBe(false);
    expect(istKiRoute("PUT", "/api/reasoner/referenzpruefung")).toBe(false);
  });

  it("R4 · die Rollenabnahme misst GET als Admin-Tür und führt die schreibenden Türen mit Grund", () => {
    const lesen = TABELLE.filter(
      (z) => z.methode === "GET" && (z.route ?? z.pfad) === "/api/reasoner/referenzpruefung",
    );
    expect(lesen).toHaveLength(1);
    expect(lesen[0]?.tor).toBe("users.manage");
    expect(lesen[0]?.gruppe).toBe("reasonerRoutes");
    for (const [methode, pfad] of TUEREN.slice(1)) {
      const zurueck = NICHT_ABGENOMMEN.filter((z) => z.methode === methode && z.pfad === pfad);
      expect(zurueck, `${methode} ${pfad}`).toHaveLength(1);
      expect(zurueck[0]?.grund.length).toBeGreaterThan(40);
    }
  });
});
