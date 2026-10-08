// ================================================================================================
// Aufnahme gesamt-sprachassistent · R-0104 — DIE NEUE TÜR STEHT IN JEDEM REGISTER, GEZIELT GEPRÜFT.
// ================================================================================================
//
// `POST /api/media/transcribe` ist mit diesem Auftrag neu. Die globalen Vollständigkeitswächter
// (`tests/security/route-guard-audit.test.ts`, `tests/architektur-vertrag/http-api-referenz.test.ts`,
// `tests/integrations-api/ki-bremse-angemeldet.test.ts`) prüfen ALLE Routen auf einmal. Sind sie
// wegen Routen anderer Aufträge rot, sagt ihr Ergebnis über diese eine Tür nichts mehr aus. Diese
// Datei stellt dieselben Fragen nur für diese Tür — mit denselben Werkzeugen, nichts nachgebaut:
//   R1 Der Scanner des Routenaudits findet sie mit `ko.read`, und die Matrix erwartet genau das.
//   R2 Sie ist am Router der vollständigen App registriert — und hat GENAU EINE Referenzzeile.
//   R3 Sie zählt zu den KI-Routen der Anfragebremse.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { KI_ROUTEN, istKiRoute } from "../../services/app/src/ki-anfragebremse";
import { baueBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";
import { schluessel, zaehleRegistrierteRouten } from "../beta-rollenabnahme/registrierte-routen";
import { ROUTE_GUARD_MATRIX, routeKey, scanAllRoutes } from "../security/routeGuardAudit";
import { repoPfad } from "../support/repoPfad";

const METHODE = "POST";
const PFAD = "/api/media/transcribe";

afterAll(schliesseBuehnen);

/** Alle Funde des Routenscanners zu einem Schlüssel „METHODE /pfad“. */
function gescannt(schluesselText: string) {
  return scanAllRoutes().filter((r) => routeKey(r.method, r.url) === schluesselText);
}

describe("R-0104 · POST /api/media/transcribe in den Registern", () => {
  it("R1 · der Routenscanner findet die Tür mit ko.read — und die Matrix erwartet genau das", () => {
    const gefunden = gescannt(`${METHODE} ${PFAD}`);
    expect(gefunden, "der Scanner findet die Route nicht oder doppelt").toHaveLength(1);
    expect(gefunden[0]?.file).toBe("services/app/src/routes/media-routes.ts");
    expect(gefunden[0]?.protection).toBe("ko.read");
    expect(ROUTE_GUARD_MATRIX[`${METHODE} ${PFAD}`]?.protection).toBe("ko.read");
    // GEGENPROBE: die Nachbartür im selben Modul behält ihr eigenes Urteil samt Zeilenrecht.
    const analyze = gescannt("POST /api/media/analyze");
    expect(analyze).toHaveLength(1);
    expect(analyze[0]?.protection).toBe("ko.read");
    expect(ROUTE_GUARD_MATRIX["POST /api/media/analyze"]?.zeilenrecht).toEqual(["beurteileAnhang"]);
  });

  it("R2 · am Router der vollständigen App registriert und genau einmal in der HTTP-Referenz", async () => {
    const buehne = await baueBuehne();
    const routen = zaehleRegistrierteRouten(buehne.app).routen;
    const ziel = schluessel(METHODE, PFAD);
    expect(routen.filter((r) => schluessel(r.methode, r.pfad) === ziel)).toHaveLength(1);

    const referenz = readFileSync(repoPfad("docs/architektur/http-api-referenz.md"), "utf8");
    const zeilen = referenz
      .split("\n")
      .filter((z) => z.startsWith(`| \`${METHODE}\` | \`${PFAD}\` |`));
    expect(zeilen, "keine oder mehr als eine Referenzzeile").toHaveLength(1);
    // Recht, Eingaben, Erfolg und Fehler stehen da (dieselbe Spaltenzahl wie jede Endpunktzeile).
    const spalten = (zeilen[0] ?? "").split(/(?<!\\)\|/).map((s) => s.trim());
    expect(spalten.slice(3, 7).every((s) => s.length > 0)).toBe(true);
    expect(spalten[3]).toContain("ko.read");
  });

  it("R3 · die Tür ist eine KI-Route der Anfragebremse", () => {
    expect(KI_ROUTEN.some((r) => r.methode === METHODE && r.pfad === PFAD)).toBe(true);
    expect(istKiRoute(METHODE, PFAD)).toBe(true);
    // Kalibrierung: eine Route ohne Modellbezug zählt nicht.
    expect(istKiRoute("GET", "/api/media/status")).toBe(false);
  });
});
