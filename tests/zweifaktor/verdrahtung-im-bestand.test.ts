// ================================================================================================
// R-0562 · NACHARBEIT 1 — DER ZWEITE FAKTOR IN DEN VIER BESTANDSWÄCHTERN, GEZIELT GEMESSEN.
// ================================================================================================
//
// Die Prüfung des Kandidaten 09a556a2 fand vier Bestandswächter rot. Genau EIN Eintrag gehörte zu
// diesem Auftrag: `POST /api/auth/login/second-factor` fehlte in der Liste der bewusst öffentlichen
// Auth-Einstiege (`tests/security/route-guard-audit.test.ts`) — behoben dort. Alle übrigen roten
// Einträge nennen FREMDE Routen, Ablagen und Tabellen (Spaces, Begriffe, Verantwortung,
// Kenntnisnahmen, Gedächtnis, Management, `POST /api/ask`, Wörterbuch `nav.tasks` …); sie bleiben in
// den unveränderten globalen Wächtern sichtbar und werden hier NICHT abgeschwächt.
//
// Diese Datei misst mit denselben Werkzeugen wie die Wächter nur, was dieser Auftrag beiträgt —
// damit sein Anteil ausgeführt belegt ist, auch solange fremde Einträge die Wächter rot halten.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schemas } from "../../services/app/src/db";
import { pflichttabellenAusDrill, tabellenAusSchemas } from "../backup-drill/pflichtsatz";
import { baueBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";
import {
  AUTOMATISCHE_METHODEN,
  schluessel,
  zaehleRegistrierteRouten,
} from "../beta-rollenabnahme/registrierte-routen";
import { ROUTE_GUARD_MATRIX, routeKey, scanAllRoutes } from "../security/routeGuardAudit";
import { repoPfad } from "../support/repoPfad";

/** Die Routen dieses Auftrags, mit der Schutzart, die sie tragen müssen. */
const ZWEIFAKTOR_ROUTEN: Record<string, string> = {
  "POST /api/auth/login/second-factor": "public",
  "GET /api/auth/second-factor": "auth",
  "POST /api/auth/second-factor/setup": "auth",
  "POST /api/auth/second-factor/confirm": "auth",
  "POST /api/auth/second-factor/disable": "auth",
  "DELETE /api/users/:id/second-factor": "admin",
};

describe("R-0562 · Routenschutz (Wächter route-guard-audit)", () => {
  const gescannt = new Map(scanAllRoutes().map((r) => [routeKey(r.method, r.url), r]));

  it("jede Zwei-Faktor-Route ist verdrahtet, in der Matrix und trägt genau die erwartete Schutzart", () => {
    for (const [route, schutz] of Object.entries(ZWEIFAKTOR_ROUTEN)) {
      expect(gescannt.get(route)?.protection, `${route} gescannt`).toBe(schutz);
      expect(ROUTE_GUARD_MATRIX[route]?.protection, `${route} in der Matrix`).toBe(schutz);
    }
  });

  it("die einzige öffentliche Zwei-Faktor-Route ist der zweite Anmeldeschritt — mit Begründung", () => {
    const oeffentlich = Object.keys(ZWEIFAKTOR_ROUTEN).filter(
      (r) => gescannt.get(r)?.protection === "public",
    );
    expect(oeffentlich).toEqual(["POST /api/auth/login/second-factor"]);
    expect(ROUTE_GUARD_MATRIX["POST /api/auth/login/second-factor"]?.reason).toBeTruthy();
    // Die Ausnahme steht in der Erlaubtliste des Wächters selbst (nicht nur hier).
    const waechter = readFileSync(repoPfad("tests/security/route-guard-audit.test.ts"), "utf8");
    expect(waechter).toContain('"POST /api/auth/login/second-factor",');
  });
});

describe("R-0562 · API-Referenz (Wächter http-api-referenz)", () => {
  let registriert: Set<string>;

  beforeAll(async () => {
    const buehne = await baueBuehne();
    const automatisch: readonly string[] = AUTOMATISCHE_METHODEN;
    const routen = zaehleRegistrierteRouten(buehne.app).routen;
    const eigene = routen.filter((r) => !automatisch.includes(r.methode));
    registriert = new Set(eigene.map((r) => schluessel(r.methode, r.pfad)));
  });

  afterAll(schliesseBuehnen);

  it("jede Zwei-Faktor-Route ist registriert und hat genau EINE vollständige Referenzzeile", () => {
    const referenz = readFileSync(repoPfad("docs/architektur/http-api-referenz.md"), "utf8");
    const zeilen = referenz
      .split("\n")
      .map((z) => /^\| `([A-Z]+)` \| `([^`]+)` \|(.*)\|\s*$/.exec(z))
      .filter((m): m is RegExpExecArray => m !== null);
    for (const route of Object.keys(ZWEIFAKTOR_ROUTEN)) {
      const [methode = "", pfad = ""] = route.split(" ");
      const k = schluessel(methode, pfad);
      expect(registriert.has(k), `${route} registriert`).toBe(true);
      const treffer = zeilen.filter((m) => schluessel(m[1] ?? "", m[2] ?? "") === k);
      expect(treffer, `${route}: Referenzzeilen`).toHaveLength(1);
      const spalten = (treffer[0]?.[3] ?? "").split(/(?<!\\)\|/).map((s) => s.trim());
      expect(spalten.filter((s) => s.length > 0).length, `${route}: Spalten`).toBe(4);
    }
  });
});

describe("R-0562 · Zusammenschaltung (Wächter zusammenschaltung)", () => {
  it("die Ablage secondFactors steht in AppRepos, beiden Kompositionen, dem Journal und dem Vertrag", () => {
    const wurzel = readFileSync(repoPfad("services/app/src/build-app.ts"), "utf8");
    const journal = readFileSync(repoPfad("services/app/src/dev-persist.ts"), "utf8");
    const vertrag = readFileSync(repoPfad("docs/architektur/zusammenschaltung.md"), "utf8");
    expect(wurzel).toMatch(/^ {2}secondFactors: SecondFactorRepo;$/m);
    expect(wurzel).toMatch(/^ {4}secondFactors: new InMemorySecondFactorRepo\(\),$/m);
    expect(wurzel).toMatch(/^ {6}secondFactors: new PgSecondFactorRepo\(pool\),$/m);
    expect(journal).toMatch(/^ {2}secondFactors: \["set", "delete", "claimStep"\],$/m);
    expect(vertrag).toContain(
      "| `secondFactors` | `InMemorySecondFactorRepo` | `PgSecondFactorRepo` |",
    );
  });
});

describe("R-0562 · Restore-Drill (Wächter tabellensatz)", () => {
  it("user_second_factors wird migriert UND im Drill geprüft", () => {
    expect(tabellenAusSchemas(schemas)).toContain("user_second_factors");
    expect(pflichttabellenAusDrill()).toContain("user_second_factors");
  });
});
