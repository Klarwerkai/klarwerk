// ================================================================================================
// Aufnahme gesamt-mcp · R-0713 — KLARA ALS MCP-WERKZEUG AM ECHTEN DRAHT (buildApp + inject).
// ================================================================================================
//
//   R-0713  „Klara meldet sich als Werkzeug bei fremden KI-Programmen wie ChatGPT, Claude, Copilot
//           oder Cursor an. Dort liefert sie nur validiertes Wissen mit Beleg und unter Beachtung
//           der Rechte."
//
// Gemessen wird das Protokoll, wie es ein MCP-Client spricht (initialize → notifications/
// initialized → tools/list → tools/call), und die drei Zusagen:
//   · NUR VALIDIERTES — derselbe Bestand wie `dienst-schluessel-am-draht.test.ts`: zwei Objekte zur
//     selben Sache, eines validiert, eines nicht; dazu ein validiertes VERTRAULICHES.
//   · MIT BELEG — die Antwort nennt genau die Wissensobjekte, die POST /api/ask mit demselben
//     Schlüssel nennt, mit Fundstelle und Einstufung.
//   · RECHTE — ohne `mcp.werkzeug` kein Zugang, ohne `ask.validated` kein Fragewerkzeug, ohne
//     Schlüssel keine Anmeldung (auch nicht mit Sitzung), kein Browseraufruf.
//
// Eine echte Anmeldung aus ChatGPT, Claude, Copilot oder Cursor gegen eine laufende Instanz ist
// damit NICHT belegt — sie braucht eine erreichbare Instanz und einen ausgestellten Schlüssel.
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { frageErgebnis } from "../../services/app/src/routes/mcp-routes";

const KOPF = "x-klarwerk-service-key";
const summe = (schluessel: string): string =>
  createHash("sha256").update(schluessel, "utf8").digest("hex");

const KI = "ki-werkzeug-0123456789abcdef0123456789abcdef0123";
const NUR_MCP = "nur-mcp-0123456789abcdef0123456789abcdef012345";
const NUR_FRAGE = "nur-frage-0123456789abcdef0123456789abcdef0123";

const ENV = [
  "KLARWERK_SERVICE_KEYS",
  "KLARWERK_ADDON_API",
  "KLARWERK_ADDON_API_KEY",
  "KLARWERK_ADDON_AUTH_MAX",
];
const GESICHERT: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV) {
    GESICHERT[k] = process.env[k];
    delete process.env[k];
  }
  process.env.KLARWERK_SERVICE_KEYS = JSON.stringify([
    { id: "ki-werkzeug", sha256: [summe(KI)], rechte: ["mcp.werkzeug", "ask.validated"] },
    { id: "nur-mcp", sha256: [summe(NUR_MCP)], rechte: ["mcp.werkzeug"] },
    { id: "nur-frage", sha256: [summe(NUR_FRAGE)], rechte: ["ask.validated"] },
  ]);
});
afterEach(() => {
  for (const k of ENV) {
    if (GESICHERT[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = GESICHERT[k];
    }
  }
});

const FRAGE_BREIT = "Wie wird die Kesselspeisepumpe KSP-7 angefahren?";
const FRAGE_NUR_UNGEPRUEFT = "Wozu dient der Schnellstartknopf NOTSTART-4?";
const FRAGE_VERTRAULICH = "Wie lautet die Rezeptur der Beschichtung BX-12 mit Zusatz ZK-55?";

async function appMitBestand() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@mcp.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@mcp.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  async function anlegen(
    title: string,
    statement: string,
    confidentiality = "intern",
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality,
        title,
        statement,
        type: "best_practice",
        category: "MCP",
        neededValidations: 1,
      },
    });
    return res.json().id as string;
  }
  async function validieren(id: string): Promise<void> {
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
  }
  const validiertId = await anlegen(
    "Kesselspeisepumpe KSP-7 anfahren",
    "Die Kesselspeisepumpe KSP-7 wird ueber das Handventil HV-9 langsam angefahren.",
  );
  const ungeprueftId = await anlegen(
    "Kesselspeisepumpe KSP-7 Schnellstart",
    "Die Kesselspeisepumpe KSP-7 wird ueber den Schnellstartknopf NOTSTART-4 angefahren.",
  );
  const vertraulichId = await anlegen(
    "Rezeptur der Beschichtung BX-12",
    "Die Beschichtung BX-12 wird mit dem Zusatz ZK-55 im Verhaeltnis 3 zu 1 angesetzt.",
    "vertraulich",
  );
  await validieren(validiertId);
  await validieren(vertraulichId);
  return { app, headers, validiertId, ungeprueftId, vertraulichId };
}

type App = Awaited<ReturnType<typeof appMitBestand>>["app"];

function rpc(app: App, schluessel: string | undefined, nachricht: unknown, kopf = {}) {
  return app.inject({
    method: "POST",
    url: "/mcp",
    headers: { ...(schluessel ? { [KOPF]: schluessel } : {}), ...kopf },
    payload: nachricht as object,
  });
}

function frage(app: App, schluessel: string, question: string) {
  return rpc(app, schluessel, {
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "klara_fragen", arguments: { question } },
  });
}

interface Werkzeugergebnis {
  content: { type: string; text: string }[];
  structuredContent?: {
    beantwortet: boolean;
    belege?: { wissensobjekt: string; fundstelle: string | null }[];
    einstufung: string;
  };
  isError: boolean;
}

describe("R-0713 · Klara meldet sich als MCP-Werkzeug an", () => {
  it("P1 · initialize: Protokollfassung, Werkzeugfähigkeit, Servername", async () => {
    const { app } = await appMitBestand();
    const res = await rpc(app, KI, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "pruefclient", version: "1" },
      },
    });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.jsonrpc).toBe("2.0");
    expect(r.id).toBe(1);
    expect(r.result.protocolVersion).toBe("2025-03-26");
    expect(r.result.capabilities.tools).toBeDefined();
    expect(r.result.serverInfo.name).toBe("klarwerk-klara");

    const unbekannt = await rpc(app, KI, {
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: { protocolVersion: "1999-01-01" },
    });
    expect(unbekannt.json().result.protocolVersion).toBe("2025-06-18");
  });

  it("P2 · notifications/initialized: 202 ohne Rumpf; ping antwortet", async () => {
    const { app } = await appMitBestand();
    const n = await rpc(app, KI, { jsonrpc: "2.0", method: "notifications/initialized" });
    expect(n.statusCode).toBe(202);
    expect(n.body).toBe("");
    const ping = await rpc(app, KI, { jsonrpc: "2.0", id: "p", method: "ping" });
    expect(ping.json()).toEqual({ jsonrpc: "2.0", id: "p", result: {} });
  });

  it("P3 · tools/list nennt klara_fragen mit Eingabeschema und Nur-Lesen-Hinweis", async () => {
    const { app } = await appMitBestand();
    const res = await rpc(app, KI, { jsonrpc: "2.0", id: 3, method: "tools/list" });
    const tools = res.json().result.tools as {
      name: string;
      inputSchema: { required: string[] };
      annotations: { readOnlyHint: boolean };
    }[];
    expect(tools.map((t) => t.name)).toEqual(["klara_fragen"]);
    expect(tools[0]?.inputSchema.required).toEqual(["question"]);
    expect(tools[0]?.annotations.readOnlyHint).toBe(true);
  });

  it("P4 · unbekannte Methode -32601, Stapel und Fremdformat -32600", async () => {
    const { app } = await appMitBestand();
    const methode = await rpc(app, KI, { jsonrpc: "2.0", id: 4, method: "resources/list" });
    expect(methode.json().error.code).toBe(-32601);
    const stapel = await rpc(app, KI, [{ jsonrpc: "2.0", id: 5, method: "ping" }]);
    expect(stapel.json().error.code).toBe(-32600);
    const fremd = await rpc(app, KI, { id: 6, method: "ping" });
    expect(fremd.json().error.code).toBe(-32600);
  });

  it("P5 · GET /mcp: 405 mit Allow: POST (kein Ereignisstrom)", async () => {
    const { app } = await appMitBestand();
    const res = await app.inject({ method: "GET", url: "/mcp", headers: { [KOPF]: KI } });
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe("POST");
    expect(res.json().error).toBe("METHOD_NOT_ALLOWED");
  });
});

describe("R-0713 · nur validiertes Wissen, mit Beleg", () => {
  it("V0 · VORAUSSETZUNG: Prüfstände und Vertraulichkeit sind wie behauptet", async () => {
    const { app, headers, validiertId, ungeprueftId, vertraulichId } = await appMitBestand();
    const lies = async (id: string) =>
      (await app.inject({ method: "GET", url: `/api/kos/${id}`, headers })).json();
    expect((await lies(validiertId)).status).toBe("validiert");
    expect((await lies(ungeprueftId)).status).not.toBe("validiert");
    const vertraulich = await lies(vertraulichId);
    expect(vertraulich.status).toBe("validiert");
    expect(vertraulich.confidentiality).toBe("vertraulich");
  });

  it("V1 · Antwort aus validiertem Wissen nennt das Wissensobjekt mit Fundstelle und Einstufung", async () => {
    const { app, validiertId, ungeprueftId } = await appMitBestand();
    const res = await frage(app, KI, FRAGE_BREIT);
    expect(res.statusCode).toBe(200);
    const e = res.json().result as Werkzeugergebnis;
    expect(e.isError).toBe(false);
    expect(e.structuredContent?.beantwortet).toBe(true);
    const ids = (e.structuredContent?.belege ?? []).map((b) => b.wissensobjekt);
    expect(ids).toContain(validiertId);
    expect(ids).not.toContain(ungeprueftId);
    expect(["verified", "unverified"]).toContain(e.structuredContent?.einstufung);
    const text = e.content[0]?.text ?? "";
    expect(text).toContain("HV-9");
    expect(text).toContain(`[${validiertId}]`);
    expect(text).toContain("Belege");
    expect(text).not.toContain("NOTSTART-4");
  });

  it("V2 · der Beleg ist genau der von POST /api/ask mit demselben Schlüssel — nichts hinzugefügt", async () => {
    const { app } = await appMitBestand();
    const direkt = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [KOPF]: KI },
      payload: { question: FRAGE_BREIT, locale: "de" },
    });
    expect(direkt.statusCode).toBe(200);
    const r = direkt.json().result as { citedSources: string[]; sources: string[] };
    const erwartet = [...new Set(r.citedSources.length ? r.citedSources : r.sources)];
    const e = (await frage(app, KI, FRAGE_BREIT)).json().result as Werkzeugergebnis;
    expect((e.structuredContent?.belege ?? []).map((b) => b.wissensobjekt)).toEqual(erwartet);
  });

  it("V3 · nur Ungeprüftes zur Frage: Wissenslücke, kein Inhalt, kein Werkzeugfehler", async () => {
    const { app, ungeprueftId } = await appMitBestand();
    const res = await frage(app, KI, FRAGE_NUR_UNGEPRUEFT);
    const e = res.json().result as Werkzeugergebnis;
    expect(e.isError).toBe(false);
    expect(e.structuredContent?.beantwortet).toBe(false);
    expect(res.body).not.toContain("NOTSTART-4");
    expect(res.body).not.toContain(ungeprueftId);
  });

  it("V4 · validiertes, aber VERTRAULICHES Wissen geht nicht hinaus", async () => {
    const { app, vertraulichId } = await appMitBestand();
    const res = await frage(app, KI, FRAGE_VERTRAULICH);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain("3 zu 1");
    expect(res.body).not.toContain(vertraulichId);
  });
});

describe("R-0713 · unter Beachtung der Rechte", () => {
  it("R1 · Schlüssel ohne mcp.werkzeug: /mcp ist 403 — auch wenn er fragen darf", async () => {
    const { app } = await appMitBestand();
    const res = await rpc(app, NUR_FRAGE, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("FORBIDDEN");
  });

  it("R2 · Schlüssel ohne ask.validated: kein Fragewerkzeug in der Liste und kein Aufruf", async () => {
    const { app } = await appMitBestand();
    const liste = await rpc(app, NUR_MCP, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(liste.json().result.tools).toEqual([]);
    const aufruf = await frage(app, NUR_MCP, FRAGE_BREIT);
    expect(aufruf.json().error.code).toBe(-32602);
    expect(aufruf.body).not.toContain("HV-9");
  });

  it("R3 · ohne Schlüssel 401 — auch mit gültiger Admin-Sitzung", async () => {
    const { app, headers } = await appMitBestand();
    const res = await rpc(app, undefined, { jsonrpc: "2.0", id: 1, method: "ping" }, headers);
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("UNAUTHENTICATED");
  });

  it("R4 · falscher Schlüssel 401; Browseraufruf (Origin) 403", async () => {
    const { app } = await appMitBestand();
    const falsch = await rpc(app, "falsch-0123456789abcdef0123456789abcdef0123", {
      jsonrpc: "2.0",
      id: 1,
      method: "ping",
    });
    expect(falsch.statusCode).toBe(401);
    const browser = await rpc(
      app,
      KI,
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { origin: "https://fremde-seite.example" },
    );
    expect(browser.statusCode).toBe(403);
    expect(browser.json().error).toBe("FORBIDDEN");
  });

  it("R5 · der Schlüssel steht in keiner Antwort", async () => {
    const { app } = await appMitBestand();
    const antworten = [
      await rpc(app, KI, { jsonrpc: "2.0", id: 1, method: "initialize" }),
      await frage(app, KI, FRAGE_BREIT),
      await app.inject({ method: "GET", url: "/mcp", headers: { [KOPF]: KI } }),
    ];
    for (const res of antworten) {
      expect(res.body).not.toContain(KI);
    }
  });

  it("R6 · ohne konfigurierte Dienst-Schlüssel gibt es /mcp nicht", async () => {
    delete process.env.KLARWERK_SERVICE_KEYS;
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/mcp",
      payload: { jsonrpc: "2.0", id: 1, method: "initialize" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("R-0713 · Werkzeugergebnis aus der Antwort (ohne Zusätze)", () => {
  it("E1 · abgeschaltet, gebremst und sonstige Fehler sind Werkzeugfehler mit Satz", () => {
    expect(frageErgebnis(503, { error: "KI_ABGESCHALTET" }, "de").isError).toBe(true);
    const gebremst = frageErgebnis(429, { wartenSek: 12 }, "de");
    expect(gebremst.isError).toBe(true);
    expect(gebremst.content[0]?.text).toContain("12 Sekunden");
    expect(frageErgebnis(500, null, "en").content[0]?.text).toContain("status 500");
  });

  it("E2 · beantwortet ohne Antworttext gilt als Wissenslücke, nicht als erfundene Antwort", () => {
    const e = frageErgebnis(200, { result: { answered: true, answer: null } }, "de");
    expect(e.isError).toBe(false);
    expect(e.structuredContent?.beantwortet).toBe(false);
  });
});
