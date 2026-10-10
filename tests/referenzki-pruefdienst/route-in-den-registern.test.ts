// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02) — DIE NEUE TÜR STEHT IN JEDEM REGISTER, GEZIELT.
// ================================================================================================
//
// `POST /api/ask/referenzpruefung/:pruefId/erneut` ist mit diesem Auftrag neu. Die globalen
// Vollständigkeitswächter (`tests/security/route-guard-audit.test.ts`,
// `tests/security/mega74-lesewege-sammler.test.ts`, `tests/architektur-vertrag/http-api-referenz.test.ts`,
// `tests/beta-rollenabnahme/jede-registrierte-route-ist-abgenommen.test.ts`) prüfen ALLE Routen auf
// einmal und sind auf diesem Stand wegen Routen ANDERER Aufträge rot (Office/WOPI, Richtlinien,
// Importbefunde). Ihr Ergebnis sagt über diese eine Tür deshalb nichts. Diese Datei stellt dieselben
// Fragen nur für diese Tür — mit denselben Werkzeugen (Muster: `tests/sprachweg/transcribe-in-den-registern.test.ts`):
//   R1 Der Routenscanner findet sie mit `ko.read`; die Matrix erwartet genau das samt Zeilenrecht.
//   R2 Sie ist am Router der vollständigen App GENAU EINMAL registriert und hat GENAU EINE
//      vollständige Referenzzeile.
//   R3 Sie zählt zu den KI-Routen der Anfragebremse.
//   R4 Die Rollenabnahme führt für sie eine gemessene Zeile mit dem Tor `ko.read`.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { KI_ROUTEN, istKiRoute } from "../../services/app/src/ki-anfragebremse";
import { baueBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";
import { schluessel, zaehleRegistrierteRouten } from "../beta-rollenabnahme/registrierte-routen";
import { TABELLE } from "../beta-rollenabnahme/tabelle";
import { ROUTE_GUARD_MATRIX, routeKey, scanAllRoutes } from "../security/routeGuardAudit";
import { repoPfad } from "../support/repoPfad";

const METHODE = "POST";
const PFAD = "/api/ask/referenzpruefung/:pruefId/erneut";

afterAll(schliesseBuehnen);

describe("REF-02 · POST /api/ask/referenzpruefung/:pruefId/erneut in den Registern", () => {
  it("R1 · der Routenscanner findet die Tür mit ko.read — und die Matrix erwartet genau das", () => {
    const gefunden = scanAllRoutes().filter(
      (r) => routeKey(r.method, r.url) === `${METHODE} ${PFAD}`,
    );
    expect(gefunden, "der Scanner findet die Route nicht oder doppelt").toHaveLength(1);
    expect(gefunden[0]?.file).toBe("services/app/src/routes/ask-routes.ts");
    expect(gefunden[0]?.protection).toBe("ko.read");
    expect(ROUTE_GUARD_MATRIX[`${METHODE} ${PFAD}`]).toEqual({
      protection: "ko.read",
      zeilenrecht: ["sichtbarkeitsfilterFuer"],
    });
    // Gegenprobe: die Nachbartür REF-01 behält ihr eigenes Urteil.
    expect(ROUTE_GUARD_MATRIX["POST /api/ask/fundstellen"]?.protection).toBe("ko.read");
  });

  it("R2 · am Router der vollständigen App genau einmal registriert und genau einmal in der HTTP-Referenz", async () => {
    const buehne = await baueBuehne();
    const routen = zaehleRegistrierteRouten(buehne.app).routen;
    const ziel = schluessel(METHODE, PFAD);
    expect(routen.filter((r) => schluessel(r.methode, r.pfad) === ziel)).toHaveLength(1);

    const referenz = readFileSync(repoPfad("docs/architektur/http-api-referenz.md"), "utf8");
    const zeilen = referenz
      .split("\n")
      .filter((z) => z.startsWith(`| \`${METHODE}\` | \`${PFAD}\` |`));
    expect(zeilen, "keine oder mehr als eine Referenzzeile").toHaveLength(1);
    const spalten = (zeilen[0] ?? "").split(/(?<!\\)\|/).map((s) => s.trim());
    expect(spalten.slice(3, 7).every((s) => s.length > 0)).toBe(true);
    expect(spalten[3]).toContain("ko.read");
  });

  it("R3 · die Tür ist eine KI-Route der Anfragebremse", () => {
    expect(KI_ROUTEN.some((r) => r.methode === METHODE && r.pfad === PFAD)).toBe(true);
    expect(istKiRoute(METHODE, PFAD)).toBe(true);
    // Kalibrierung: die lesende Fundstellenauflösung ruft kein Modell und zählt nicht.
    expect(istKiRoute("POST", "/api/ask/fundstellen")).toBe(false);
  });

  it("R4 · die Rollenabnahme führt eine gemessene Zeile mit dem Tor ko.read", () => {
    const zeilen = TABELLE.filter((z) => z.methode === METHODE && (z.route ?? z.pfad) === PFAD);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.tor).toBe("ko.read");
    expect(zeilen[0]?.gruppe).toBe("askRoutes");
  });
});
