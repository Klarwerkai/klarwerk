// ================================================================================================
// JOB 3568 · Q9-FREMDE-FLÄCHEN — DIE ZWEI MODULÜBERGREIFENDEN WÄCHTER HÖREN DEN SPRACHKOPF.
// ================================================================================================
//
// JOB 3449 hat den Sprachkopf vollständig verlegt: `apps/web/src/api/client.ts:23` setzt
// `Accept-Language` bei JEDEM `/api`-Aufruf, nicht nur bei der Anmeldung. Angekommen ist er bis
// hierher trotzdem nicht — `services/app/src/http.ts` und `services/rbac/src/guard.ts` trugen ihre
// Sätze als deutsche Literale im Code und lasen den Kopf nie. Wer die Oberfläche auf Englisch
// stellt und irgendwo im Produkt auf eine abgelaufene Sitzung läuft, las einen deutschen Satz.
//
// GEPRÜFT WIRD AM DRAHT, nicht am Diff: eine echte Fastify-Instanz, `app.inject` mit echtem
// `accept-language`-Kopf, und die Antwort so gelesen, wie der Browser sie bekommt. Dass
// `meldung(...)` im Quelltext steht, ist kein Nutzen; dass drei Sprachen aus der Route kommen, ist
// einer. Vorbild des Aufbaus: `tests/q9-serverfehlertexte/server.test.ts:14-21`.
//
// DER FEHLERCODE AUF DEM DRAHT IST MITGEPINNT (`UNAUTHENTICATED`) und der Status ebenso: die
// Übersetzung darf den Vertrag nach außen nicht nebenbei verschieben.
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): Der zweite Wächter, `requirePermission` aus
// `services/rbac/src/guard.ts`, hatte im Produkt keinen Aufrufer und ist entfernt; mit ihm der Block
// R2, der ihn auf einer eigenen Fastify-Instanz fuhr. Sein 401 `INVALID_CREDENTIALS` entstand an
// keiner echten Route. Den 403-Satz `PERMISSION_DENIED` misst jetzt
// `tests/q9-entwurfsfehler/entwurfsfehler-sprachfaelle.test.ts` (G) an der Route, die ihn im Produkt
// sendet.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { makeGuards } from "../../services/app/src/http";
import type { AuthService } from "../../services/auth";

/**
 * Der Sprachvertrag aus JOB 3415, wie ihn `tests/q9-serverfehlertexte/server.test.ts:8-12` fährt:
 * Volltext UND Abwesenheit der deutschen Erkennungswörter. Ein Volltextvergleich allein ließe eine
 * Antwort durchgehen, die den deutschen Satz nur umformuliert hätte.
 */
function sprachvertrag(message: unknown, volltext: string): void {
  expect.soft(message).toBe(volltext);
  expect.soft(String(message)).not.toMatch(/angemeldet|Fehler|Berechtigung/);
}

/**
 * Kein Token im Request → `auth.authenticate` wird von `requireUser` gar nicht erst gerufen
 * (`http.ts:151`: `token ? … : undefined`). Der Stub ist deshalb absichtlich leer; eine echte
 * `AuthService`-Instanz würde hier nur Repos und eine Uhr mitschleppen, ohne die Aussage zu ändern.
 * Die Behauptung ist nicht geglaubt, sondern gemessen: `authenticate` zählt seine Aufrufe mit und
 * der Fall unten belegt die Null.
 */
let authenticateAufrufe = 0;
const authStub = {
  authenticate: async (): Promise<undefined> => {
    authenticateAufrufe += 1;
    return undefined;
  },
} as unknown as AuthService;

let app: FastifyInstance | undefined;

/** Eine Fastify-Instanz mit genau einer Route, die den übergebenen Wächter fährt. */
async function draht(
  handler: (app: FastifyInstance) => void,
  sprache: string | undefined,
): Promise<{ status: number; koerper: { error?: unknown; message?: unknown }; roh: string }> {
  const instanz = Fastify();
  app = instanz;
  handler(instanz);
  const antwort = await instanz.inject({
    method: "GET",
    url: "/probe",
    ...(sprache ? { headers: { "accept-language": sprache } } : {}),
  });
  return {
    status: antwort.statusCode,
    koerper: antwort.json() as { error?: unknown; message?: unknown },
    roh: antwort.payload,
  };
}

/** R1: der Auth-Guard aus `services/app/src/http.ts`, ohne Token. */
function guardProbe(sprache?: string) {
  const guards = makeGuards(authStub);
  return draht((instanz) => {
    instanz.get("/probe", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (user) {
        return reply.send({ durchgelassen: true });
      }
      return reply;
    });
  }, sprache);
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("R1 · der Auth-Guard von services/app antwortet in der gewählten Sprache", () => {
  it("EN: 401 UNAUTHENTICATED mit englischem Volltext", async () => {
    const res = await guardProbe("en");
    expect(res.status).toBe(401);
    expect(res.koerper.error).toBe("UNAUTHENTICATED");
    sprachvertrag(res.koerper.message, "You are not signed in.");
  });

  it("NL: 401 UNAUTHENTICATED mit niederländischem Volltext", async () => {
    const res = await guardProbe("nl");
    expect(res.status).toBe(401);
    expect(res.koerper.error).toBe("UNAUTHENTICATED");
    sprachvertrag(res.koerper.message, "Je bent niet aangemeld.");
  });

  // LIEFERUNG 6 — BESTANDSSCHUTZ DEUTSCH. Ohne Kopf und mit `de` steht WÖRTLICH derselbe Satz da
  // wie vor dieser Runde. Das ist die Zusicherung an jeden Bestandstest, der ihn pinnt.
  it.each([undefined, "de", "fr"])(
    "Rückfall DE bei %s: unveränderter deutscher Wortlaut",
    async (sprache) => {
      const res = await guardProbe(sprache);
      expect(res.status).toBe(401);
      expect(res.koerper).toEqual({ error: "UNAUTHENTICATED", message: "Nicht angemeldet." });
    },
  );

  it("zusammengesetzter Kopf: Regionalvariante und Gewichte werden beachtet", async () => {
    for (const kopf of ["en-GB,en;q=0.9", "de;q=0.2,en;q=0.9", "nl;q=0,en;q=0.5"]) {
      const res = await guardProbe(kopf);
      expect(res.status, kopf).toBe(401);
      expect(res.koerper.message, kopf).toBe("You are not signed in.");
    }
  });

  it("der Stub wurde nie gerufen — ohne Token fragt der Guard den Dienst gar nicht", async () => {
    authenticateAufrufe = 0;
    await guardProbe("en");
    expect(authenticateAufrufe).toBe(0);
  });
});
