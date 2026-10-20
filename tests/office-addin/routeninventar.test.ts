// ================================================================================================
// aufnahme:20260922:excel-erster-weg · KO-04-01 · DIE NEUE SEITE STEHT IM ROUTENINVENTAR
// ================================================================================================
//
// Die globalen Wächter `tests/security/route-guard-audit.test.ts` und
// `tests/security/mega74-lesewege-sammler.test.ts` sind am Basisstand ee3b2bc6 aus FREMDEN Gründen
// rot (unbeurteilte Routen anderer Aufträge, z. B. klara-aufgabe-routes, office-routes,
// wiederanlauf). Sie bleiben unverändert. Diese Datei prüft mit DENSELBEN Helfern genau den Teil,
// den dieser Auftrag beiträgt: die Route `GET /office-addin/taskpane.html` aus `web-static.ts`
// wird von der selbst erhobenen Grundmenge gefunden, ist lesbar und trägt in der Matrix dieselbe
// Schutzart, die die Erhebung am Aufruf misst.
import { describe, expect, it } from "vitest";
import { KLARA_OFFICE_TASKPANE_PFAD, KLARA_TASKPANE_PFAD } from "../../services/app/src/web-static";
import { ROUTE_GUARD_MATRIX, routeKey, schutzartVon } from "../security/routeGuardAudit";
import { erhebeSchnittstellen } from "../security/schnittstellenErhebung";

const DATEI = "services/app/src/web-static.ts";
const ERHEBUNG = erhebeSchnittstellen();

describe("KO-04-01 · die Office-Seite im selbst erhobenen Routeninventar", () => {
  it("web-static.ts ist vollständig lesbar — kein unaufgelöster Pfad", () => {
    expect(ERHEBUNG.dateien).toContain(DATEI);
    expect(ERHEBUNG.unlesbar.filter((eintrag) => eintrag.startsWith(DATEI))).toEqual([]);
  });

  const SEITEN = [KLARA_OFFICE_TASKPANE_PFAD, KLARA_TASKPANE_PFAD];

  it.each(SEITEN)("%s: erhoben, eingetragen, öffentlich", (pfad) => {
    const funde = ERHEBUNG.registrierungen.filter((r) => r.pfad === pfad);
    expect(funde.map((r) => `${r.datei} ${r.methode}`)).toEqual([`${DATEI} GET`]);
    const eintrag = ROUTE_GUARD_MATRIX[routeKey("GET", pfad)];
    expect(eintrag?.protection).toBe("public");
    for (const fund of funde) {
      expect(schutzartVon(fund.aufruf)).toBe(eintrag?.protection);
    }
  });
});
