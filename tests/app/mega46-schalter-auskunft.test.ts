// ================================================================================================
// AUFTRAG-mega46 BLOCK F1 — DIE AUSKUNFT ÜBER DIE BETRIEBSSCHALTER.
// ================================================================================================
//
// Die Oberfläche konnte bis hierher nur RATEN, ob ein Schalter steht — am 404 einer Route. Diese
// Auskunft ersetzt das Raten. Sie ist die schmalste Fläche, die den Zweck erfüllt, und dieser Test
// hält beides fest: dass sie die Wahrheit sagt UND dass sie nichts darüber hinaus sagt.
//
// Der zweite Teil ist der wichtigere. Eine Auskunft über die Umgebung ist genau so lange harmlos,
// wie niemand ihr ein Feld mit einem WERT hinzufügt — eine URL, einen Modellnamen, eine Version.
// Deshalb prüft der letzte Fall nicht die Absicht, sondern die ANTWORT: Jeder Wert muss ein Boolean
// sein, und in der Zeichenkette der Antwort darf weder ein Variablenname noch ein gesetzter
// Umgebungswert auftauchen. Ein künftiges `{ herkunftUrl: "..." }` wird damit rot, ohne dass jemand
// an diesen Test denken muss.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../services/app/src/build-app";

const SCHALTER_VARIABLEN = [
  "KLARWERK_PROVENANCE_ENABLED",
  "KLARWERK_CONFLUENCE_IMPORT",
  "KLARWERK_EXPERT_MATCHING",
] as const;

// Jeder Fall setzt die Schalter AUSDRÜCKLICH; die Vorgabe hat unten ihren eigenen Fall.
function schalterLeeren(): void {
  for (const variable of SCHALTER_VARIABLEN) {
    delete process.env[variable];
  }
}
beforeEach(schalterLeeren);
afterEach(schalterLeeren);

async function angemeldet(app: ReturnType<typeof buildApp>): Promise<{ authorization: string }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Nutzerin", email: "n@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "n@x.de", password: "secret123" },
  });
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function schalterAbfragen(
  headers: { authorization: string },
  app: ReturnType<typeof buildApp>,
): Promise<Record<string, unknown>> {
  const res = await app.inject({ method: "GET", url: "/api/features", headers });
  expect(res.statusCode).toBe(200);
  return (res.json() as { features: Record<string, unknown> }).features;
}

describe("mega46 F1 · die Auskunft über die gesetzten Schalter", () => {
  it("ohne Anmeldung gibt es keine Auskunft", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/features" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("VORGABE: ohne gesetzte Schalter meldet jeder Schalter „aus“", async () => {
    const app = buildApp();
    const headers = await angemeldet(app);
    const features = await schalterAbfragen(headers, app);
    // Der Schlüsselsatz ist vollständig und stabil — „aus“ ist von „kenne ich nicht“ unterscheidbar.
    expect(features).toEqual({ herkunft: false, confluenceImport: false, expertMatching: false });
    await app.close();
  });

  it("AN: ein gesetzter Schalter erscheint als „an“ — und nur er", async () => {
    process.env.KLARWERK_PROVENANCE_ENABLED = "1";
    const app = buildApp();
    const headers = await angemeldet(app);
    expect(await schalterAbfragen(headers, app)).toEqual({
      herkunft: true,
      confluenceImport: false,
      expertMatching: false,
    });
    await app.close();
  });

  it("AN: `true` schaltet ebenso scharf, ein anderer Wert NICHT", async () => {
    process.env.KLARWERK_EXPERT_MATCHING = "true";
    process.env.KLARWERK_CONFLUENCE_IMPORT = "ja"; // gilt nicht — fail-closed
    const app = buildApp();
    const headers = await angemeldet(app);
    expect(await schalterAbfragen(headers, app)).toEqual({
      herkunft: false,
      confluenceImport: false,
      expertMatching: true,
    });
    await app.close();
  });

  it("die Auskunft deckt sich mit dem, was der Server WIRKLICH tut", async () => {
    // Der eigentliche Zweck der einen Schalter-Wahrheit: Die Auskunft darf nicht behaupten, die
    // Herkunftsroute sei da, wenn sie nicht registriert wurde — und umgekehrt.
    process.env.KLARWERK_PROVENANCE_ENABLED = "1";
    const an = buildApp();
    const headersAn = await angemeldet(an);
    expect((await schalterAbfragen(headersAn, an)).herkunft).toBe(true);
    const routeAn = await an.inject({
      method: "GET",
      url: "/api/kos/gibt-es-nicht/provenance",
      headers: headersAn,
    });
    // Route registriert: ehrlicher fachlicher 404 MIT Grund (nicht der Route-404 von Fastify).
    expect(routeAn.json()).toMatchObject({ error: "NOT_FOUND" });
    await an.close();

    delete process.env.KLARWERK_PROVENANCE_ENABLED;
    const aus = buildApp();
    const headersAus = await angemeldet(aus);
    expect((await schalterAbfragen(headersAus, aus)).herkunft).toBe(false);
    const routeAus = await aus.inject({
      method: "GET",
      url: "/api/kos/gibt-es-nicht/provenance",
      headers: headersAus,
    });
    expect(routeAus.statusCode).toBe(404);
    expect(routeAus.json()).not.toMatchObject({ error: "NOT_FOUND" });
    await aus.close();
  });

  it("SAMMLER: die Antwort trägt NUR Ja/Nein — keine Werte, keine Variablennamen", async () => {
    // Werte, die es NIE über den Draht schaffen dürfen, auch nicht versehentlich mitgeschleift.
    process.env.KLARWERK_PROVENANCE_ENABLED = "1";
    const app = buildApp();
    const headers = await angemeldet(app);
    const res = await app.inject({ method: "GET", url: "/api/features", headers });
    expect(res.statusCode).toBe(200);

    const koerper = res.json() as Record<string, unknown>;
    // Genau EIN Feld — kein Platz für Version, Umgebung, Zählungen.
    expect(Object.keys(koerper)).toEqual(["features"]);
    const features = koerper.features as Record<string, unknown>;
    // Über die BAUFORM, nicht über eine Liste der heutigen Schalter: JEDER Wert ist ein Boolean.
    for (const [name, wert] of Object.entries(features)) {
      expect(typeof wert, `Schalter „${name}“ trägt keinen Ja/Nein-Wert`).toBe("boolean");
    }

    const roh = res.body;
    expect(roh).not.toContain("KLARWERK");
    expect(roh).not.toContain("process.env");
    for (const variable of SCHALTER_VARIABLEN) {
      expect(roh).not.toContain(variable);
    }
    await app.close();
  });
});
