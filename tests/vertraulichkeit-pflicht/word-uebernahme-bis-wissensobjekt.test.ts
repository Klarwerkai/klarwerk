// ================================================================================================
// N11 / R-0632 · DIE WORD-ÜBERNAHME BIS ZUM WISSENSOBJEKT — UND VON DORT BIS ZUM KI-EGRESS.
// ================================================================================================
//
// BEN-Befunde zu Kandidat baa84fa3 (Nacharbeit 10):
//
//   K6 / N11 · „Ohne Panelwahl ein Word-Dokument regulär übernehmen, den gespeicherten Standard
//              intern bis zum Wissensobjekt zurücklesen und einen KI-Aufruf mit dessen tatsächlichem
//              Herkunftsanker prüfen." Dazu „vertraulich"/„streng_vertraulich" als Gegenfälle, und
//              eine falsche Client-Behauptung „intern" darf den Egress-Riegel nicht öffnen.
//              → U1 (Standard bis zum Objekt), E1 (Egress mit dem Anker des Objekts),
//                G1/G2 (Gegenfälle: gespeichert vertraulich/streng + Behauptung „intern" → 409).
//
//   K2 / R-0632 · „Einen Word-Entwurf mit vertraulich speichern, regulär promoten und anschließend
//              als Administrator beziehungsweise Controller über die KO-Route intern setzen.
//              Herabstufung muss scheitern und GET weiterhin vertraulich liefern; Gleichbleiben und
//              Anheben müssen funktionieren. Zusätzlich den Weg nach vorheriger Herkunftsänderung."
//              → S1 (Administrator), S2 (Controller), S3 (Herkunft vor dem Promote auf frontdoor),
//                S4 ABGRENZUNG (ein Objekt ohne Word-Herkunft bleibt nach SCRUM-509 senkbar).
//
// AUFBAU wie `tests/uebernahme-standard-intern/datei-import-bis-egress.test.ts`: echte
// Kompositionswurzel (`buildApp(buildServices())`), echte Anmeldung, echte Routen
// (`POST /api/drafts/from-docx`, `POST /api/drafts/:id/promote`, `PUT/GET /api/kos/:id`,
// `POST /api/reasoner`), feste `.docx` aus `tests/fixtures/sample.docx`. Ersetzt ist allein der
// externe Modelltransport, der mitschreibt — keine echte Cloud, kein Modell.
//
// WAS DIESE DATEI NICHT ERSETZT: den echten Office-/Modellnachweis aus K1 (Word-Host, Bild- und
// Herkunftskette, wirkliche KI-Antwort). Die Übernahme läuft hier über die Route, nicht über Word.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftProvenance } from "../../apps/web/src/lib/reasonerProvenance";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { CONFIDENTIAL_CLOUD_BLOCKED } from "../../services/app/src/routes/reasoner-routes";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const DOCX_BASE64 = readFileSync(resolve(process.cwd(), "tests/fixtures/sample.docx")).toString(
  "base64",
);
const AUSSAGE = "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften.";
const KENNWORT = "test-password-word-ko";

type Stufe = "intern" | "vertraulich" | "streng_vertraulich";

const apps: ReturnType<typeof buildApp>[] = [];
beforeEach(() => vi.stubEnv("KLARWERK_ADDON_API", "1"));
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.unstubAllEnvs();
});

async function aufbauen() {
  const gesehen: string[] = [];
  const services = buildServices();
  services.reasoner = new Reasoner(
    new ModelProvider({
      name: "anthropic-word-ko",
      completeVision: async () => "Ein Bild.",
      complete: async (system, prompt) => {
        gesehen.push(`${system}\n${prompt}`);
        return "Nach dem Anfahren zehn Sekunden warten und die Pumpe danach entlüften.";
      },
    }),
  );
  await erteileKiFreigabe(services.reasoner);
  const app = buildApp(services);
  apps.push(app);
  const anmelden = async (email: string) => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: KENNWORT },
    });
    expect(login.statusCode, login.body).toBe(200);
    return { authorization: `Bearer ${login.json().token}` };
  };
  // Erstes Konto wird Administrator (FR-AUTH-01).
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "word-ko-admin@example.test", password: KENNWORT },
  });
  const admin = await anmelden("word-ko-admin@example.test");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: {
      name: "Controller",
      email: "word-ko-controller@example.test",
      password: KENNWORT,
      role: "controller",
    },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const controller = await anmelden("word-ko-controller@example.test");
  return { app, admin, controller, gesehen };
}
type Aufbau = Awaited<ReturnType<typeof aufbauen>>;

/** `POST /api/drafts/from-docx` — mit Panelwahl oder, bei `undefined`, ohne jede Stufe. */
async function wordUebernahme(a: Aufbau, stufe?: Stufe): Promise<string> {
  const res = await a.app.inject({
    method: "POST",
    url: "/api/drafts/from-docx",
    headers: a.admin,
    payload: {
      name: "Pumpe.docx",
      data: DOCX_BASE64,
      ...(stufe !== undefined ? { confidentiality: stufe } : {}),
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

async function entwurf(a: Aufbau, id: string): Promise<Record<string, unknown>> {
  const res = await a.app.inject({ method: "GET", url: `/api/drafts/${id}`, headers: a.admin });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { payload: Record<string, unknown> }).payload;
}

/**
 * Der reguläre Einreichweg. Der Stand ergänzt nur die Pflichtfelder Art und Kategorie (und eine
 * feste Aussage) — die Stufe reist NICHT mit, sie kommt allein aus dem gespeicherten Entwurf.
 */
async function promote(a: Aufbau, draftId: string): Promise<string> {
  const res = await a.app.inject({
    method: "POST",
    url: `/api/drafts/${draftId}/promote`,
    headers: a.admin,
    payload: { draftPayload: { statement: AUSSAGE, type: "best_practice", category: "Wartung" } },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

/** Die Stufe, wie die Detailroute sie ausliefert — gelesen, nicht aus der Eingabe abgeleitet. */
async function koStufe(a: Aufbau, koId: string): Promise<unknown> {
  const res = await a.app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: a.admin });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { confidentiality?: unknown }).confidentiality;
}

async function koStufeSetzen(
  a: Aufbau,
  headers: Record<string, string>,
  koId: string,
  level: Stufe,
) {
  return a.app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "confidentiality", level },
  });
}

/** Der Reasoner mit der Client-Behauptung „intern" und dem ECHTEN Anker des Wissensobjekts. */
async function reasoner(a: Aufbau, koId: string) {
  return a.app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers: { ...a.admin, "content-type": "application/json" },
    payload: { task: "assist", text: AUSSAGE, ...draftProvenance("intern", koId) },
  });
}

describe("N11 · Word-Übernahme ohne Panelwahl: „intern“ bis zum Wissensobjekt und zum KI-Egress", () => {
  it("U1 — ohne Wahl: Entwurf intern → Promote → Wissensobjekt intern (zurückgelesen)", async () => {
    const a = await aufbauen();
    const draftId = await wordUebernahme(a);
    const gespeichert = await entwurf(a, draftId);
    expect(gespeichert.confidentiality).toBe("intern");
    expect(gespeichert.origin).toBe("word_addin");
    const koId = await promote(a, draftId);
    expect(await koStufe(a, koId)).toBe("intern");
  });

  it("E1 — der Anker des übernommenen internen Objekts öffnet den Transport", async () => {
    const a = await aufbauen();
    const koId = await promote(a, await wordUebernahme(a));
    expect(await koStufe(a, koId)).toBe("intern");
    a.gesehen.length = 0;
    const res = await reasoner(a, koId);
    expect(res.statusCode, res.body).toBe(200);
    expect((res.json() as { demo: boolean }).demo).toBe(false);
    expect(a.gesehen.join("\n")).toContain(AUSSAGE);
  });

  for (const stufe of ["vertraulich", "streng_vertraulich"] as const) {
    it(`G — GEGENFALL ${stufe}: die Panelwahl bleibt am Objekt, Behauptung „intern“ → 409 backstop`, async () => {
      const a = await aufbauen();
      const draftId = await wordUebernahme(a, stufe);
      expect((await entwurf(a, draftId)).confidentiality).toBe(stufe);
      const koId = await promote(a, draftId);
      expect(await koStufe(a, koId)).toBe(stufe);
      a.gesehen.length = 0;
      const res = await reasoner(a, koId);
      expect(res.statusCode, res.body).toBe(409);
      expect((res.json() as { code?: unknown }).code).toBe(CONFIDENTIAL_CLOUD_BLOCKED);
      expect((res.json() as { reason?: unknown }).reason).toBe("backstop");
      expect(res.body).not.toContain(AUSSAGE);
      expect(a.gesehen).toEqual([]);
    });
  }
});

describe("R-0632 · die Herabstufungssperre eines Word-Entwurfs gilt auch am Wissensobjekt", () => {
  async function vertraulichesWordObjekt(a: Aufbau): Promise<string> {
    const koId = await promote(a, await wordUebernahme(a, "vertraulich"));
    expect(await koStufe(a, koId)).toBe("vertraulich");
    return koId;
  }

  for (const rolle of ["admin", "controller"] as const) {
    it(`S — ${rolle}: senken auf intern scheitert, GET bleibt vertraulich; gleich und anheben gehen`, async () => {
      const a = await aufbauen();
      const koId = await vertraulichesWordObjekt(a);

      const gesenkt = await koStufeSetzen(a, a[rolle], koId, "intern");
      expect(gesenkt.statusCode, gesenkt.body).toBe(403);
      expect((gesenkt.json() as { error?: unknown }).error).toBe("DOWNGRADE_FORBIDDEN");
      expect(await koStufe(a, koId)).toBe("vertraulich");

      const gleich = await koStufeSetzen(a, a[rolle], koId, "vertraulich");
      expect(gleich.statusCode, gleich.body).toBe(200);
      const angehoben = await koStufeSetzen(a, a[rolle], koId, "streng_vertraulich");
      expect(angehoben.statusCode, angehoben.body).toBe(200);
      expect(await koStufe(a, koId)).toBe("streng_vertraulich");

      // Auch nach dem Anheben bleibt die Sperre: kein Weg zurück auf eine niedrigere Stufe.
      const zurueck = await koStufeSetzen(a, a[rolle], koId, "vertraulich");
      expect(zurueck.statusCode, zurueck.body).toBe(403);
      expect(await koStufe(a, koId)).toBe("streng_vertraulich");
    });
  }

  it("S3 — erst die Herkunft des Entwurfs auf frontdoor, dann promoten: die Sperre gilt weiter", async () => {
    const a = await aufbauen();
    const draftId = await wordUebernahme(a, "vertraulich");
    const umetikettiert = await a.app.inject({
      method: "PUT",
      url: `/api/drafts/${draftId}`,
      headers: a.admin,
      payload: { origin: "frontdoor" },
    });
    expect(umetikettiert.statusCode, umetikettiert.body).toBe(200);
    const koId = await promote(a, draftId);
    expect(await koStufe(a, koId)).toBe("vertraulich");

    for (const rolle of ["admin", "controller"] as const) {
      const gesenkt = await koStufeSetzen(a, a[rolle], koId, "intern");
      expect(gesenkt.statusCode, gesenkt.body).toBe(403);
      expect(await koStufe(a, koId)).toBe("vertraulich");
    }
    const angehoben = await koStufeSetzen(a, a.controller, koId, "streng_vertraulich");
    expect(angehoben.statusCode, angehoben.body).toBe(200);
    expect(await koStufe(a, koId)).toBe("streng_vertraulich");
  });

  it("S4 — ABGRENZUNG: ein Objekt aus einem Blatt-Entwurf bleibt für Prüfer senkbar (SCRUM-509)", async () => {
    const a = await aufbauen();
    const angelegt = await a.app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: a.admin,
      payload: {
        title: "Blatt",
        statement: AUSSAGE,
        type: "best_practice",
        category: "Wartung",
        confidentiality: "vertraulich",
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const koId = await promote(a, (angelegt.json() as { id: string }).id);
    expect(await koStufe(a, koId)).toBe("vertraulich");
    const gesenkt = await koStufeSetzen(a, a.controller, koId, "intern");
    expect(gesenkt.statusCode, gesenkt.body).toBe(200);
    expect(await koStufe(a, koId)).toBe("intern");
  });
});
