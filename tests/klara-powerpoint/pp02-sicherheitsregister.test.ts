// ================================================================================================
// PP-02 · DIE ACHT ROUTEN IN DEN SICHERHEITSREGISTERN (mega74-Lesewege, Routenmatrix, Zeilenrecht)
// ================================================================================================
//
// Die globalen Wächter `tests/security/mega74-lesewege-sammler.test.ts`,
// `route-guard-audit.test.ts` und `g10-herkunft-zentrum-vertraulich.test.ts` sind am Basisstand aus
// FREMDEN Gründen rot (unbeurteilte Routen anderer Aufträge). Sie bleiben unverändert. Diese Datei
// prüft mit DENSELBEN Helfern genau den Teil, den PP-02 beiträgt — sie erklärt nichts Fremdes grün:
//   R1  die selbst erhobene Grundmenge findet in praesentation-daten-routes.ts genau die acht Routen;
//   R2  jede steht in der Routenmatrix mit dem Recht, das die Registrierung wirklich fordert, und mit
//       dem Zeilenrecht `darfSehen`;
//   R3  jede trägt im mega74-Register das Urteil PRAEDIKAT. Dass dieses Urteil stimmt, misst der
//       Sammler selbst im Syntaxbaum („wer PRAEDIKAT behauptet …“, in beiden Fällen grün).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTE_GUARD_MATRIX, routeKey, schutzartVon } from "../security/routeGuardAudit";
import { erhebeSchnittstellen } from "../security/schnittstellenErhebung";
import { REPO_WURZEL } from "../support/repoPfad";

const DATEI = "services/app/src/routes/praesentation-daten-routes.ts";

const ERWARTET: Record<string, string> = {
  "GET /api/kos/:id/office/:anhangId/folien-daten": "ko.read",
  "GET /api/kos/:id/datenpunkte": "ko.read",
  "POST /api/kos/:id/datenpunkte": "ko.create",
  "GET /api/datenpunkte/:dpId": "ko.read",
  "POST /api/datenpunkte/:dpId/bindungen": "ko.create",
  "POST /api/datenpunkte/:dpId/pruefungen": "ko.create",
  "POST /api/datenpunkte/:dpId/korrektur": "ko.create",
  "POST /api/kos/:id/office/:anhangId/folien-abgleich": "ko.read",
};

const FUNDE = erhebeSchnittstellen().registrierungen.filter((r) => r.datei === DATEI);

describe("PP-02 · Sicherheitsregister", () => {
  it("R1 · die Erhebung findet genau die acht PP-02-Routen", () => {
    expect(FUNDE.map((r) => routeKey(r.methode, r.pfad)).sort()).toEqual(
      Object.keys(ERWARTET).sort(),
    );
  });

  it.each(Object.entries(ERWARTET))(
    "R2 · %s: Routenrecht %s wie verdrahtet, Zeilenrecht darfSehen",
    (schluessel, recht) => {
      const eintrag = ROUTE_GUARD_MATRIX[schluessel];
      expect(eintrag?.protection).toBe(recht);
      expect(eintrag?.zeilenrecht).toEqual(["darfSehen"]);
      const fund = FUNDE.find((r) => routeKey(r.methode, r.pfad) === schluessel);
      expect(fund && schutzartVon(fund.aufruf)).toBe(recht);
    },
  );

  it("R3 · jede Route trägt im mega74-Register das Urteil PRAEDIKAT", () => {
    const register = readFileSync(
      join(REPO_WURZEL, "tests/security/mega74-lesewege-sammler.test.ts"),
      "utf8",
    );
    for (const schluessel of Object.keys(ERWARTET)) {
      const stelle = register.indexOf(`"${schluessel}": {`);
      expect(stelle, schluessel).toBeGreaterThan(0);
      expect(register.slice(stelle, stelle + 200), schluessel).toMatch(
        /^"[^"]+": \{\s+urteil: "PRAEDIKAT",/,
      );
    }
  });
});
