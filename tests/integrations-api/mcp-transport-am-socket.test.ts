// ================================================================================================
// Aufnahme gesamt-mcp · R-0713 · Nacharbeit 1 — DER MCP-ZUGANG AN EINEM ECHTEN SOCKET.
// ================================================================================================
//
// Bens Befund (Nacharbeit 1): `mcp-zugang-am-draht.test.ts` spricht nur über `app.inject`, also
// ohne HTTP-Stapel. Ein Fremdclient spricht über TCP mit eigenen Köpfen und in einer festen Abfolge.
//
// WAS DIESE DATEI BELEGT: der Server unter `app.listen` beantwortet über echtes HTTP (Node-`fetch`)
// genau die Abfolge und die Köpfe, mit denen der Streamable-HTTP-Client des offiziellen MCP-SDKs
// (TypeScript, `StreamableHTTPClientTransport`) eine Verbindung aufbaut:
//   1. POST initialize — `accept: application/json, text/event-stream`, `content-type:
//      application/json`; die Antwort muss `application/json` sein (sonst erwartet der Client SSE).
//   2. POST notifications/initialized — ab hier mit `mcp-protocol-version`; erwartet 202.
//   3. GET mit `accept: text/event-stream` — der Client versucht einen Ereignisstrom und nimmt 405
//      als „kein Strom angeboten" hin; jeder andere Fehlerstatus würde als Fehler gemeldet.
//   4. POST tools/list, 5. POST tools/call.
// Kein `mcp-session-id` in den Antworten: der Server ist zustandslos, der Client sendet dann keine.
//
// WAS SIE NICHT BELEGT — und nicht belegen kann: die Anmeldung eines TATSÄCHLICHEN Fremdclients.
// Die Abfolge ist hier nachgebaut, nicht vom Fremdclient gefahren. Das SDK ist keine Abhängigkeit
// dieses Repositorys (keine Installation in diesem Auftrag), und ein Programm wie Claude Code oder
// Cursor braucht eine erreichbare Instanz, einen ausgestellten Schlüssel und eine bedienende Person.
// Das Abnahmeprotokoll dafür: `docs/abnahme/mcp-fremdclient-abnahme.md`.
import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const KOPF = "x-klarwerk-service-key";
const KI = "socket-ki-werkzeug-0123456789abcdef0123456789abcd";
const summe = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");
const PROTOKOLL = "2025-06-18";

const GESICHERT: { wert?: string | undefined } = {};
let schliessen: (() => Promise<unknown>) | undefined;
beforeEach(() => {
  GESICHERT.wert = process.env.KLARWERK_SERVICE_KEYS;
  process.env.KLARWERK_SERVICE_KEYS = JSON.stringify([
    { id: "socket-ki", sha256: [summe(KI)], rechte: ["mcp.werkzeug", "ask.validated"] },
  ]);
});
afterEach(async () => {
  await schliessen?.();
  schliessen = undefined;
  if (GESICHERT.wert === undefined) {
    delete process.env.KLARWERK_SERVICE_KEYS;
  } else {
    process.env.KLARWERK_SERVICE_KEYS = GESICHERT.wert;
  }
});

async function serverMitBestand() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@mcp-socket.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@mcp-socket.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Kesselspeisepumpe KSP-7 anfahren",
      statement: "Die Kesselspeisepumpe KSP-7 wird ueber das Handventil HV-9 langsam angefahren.",
      type: "best_practice",
      category: "MCP",
      neededValidations: 1,
    },
  });
  const validiertId = angelegt.json().id as string;
  await app.inject({
    method: "PUT",
    url: `/api/kos/${validiertId}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  await app.listen({ port: 0, host: "127.0.0.1" });
  schliessen = () => app.close();
  const adresse = app.server.address() as AddressInfo | null;
  if (adresse === null || typeof adresse === "string") {
    throw new Error("Der Server hat keinen Port gemeldet.");
  }
  return { url: `http://127.0.0.1:${adresse.port}/mcp`, validiertId };
}

/** POST wie der SDK-Client: beide Accept-Typen; nach initialize mit Protokollkopf. */
function senden(url: string, nachricht: unknown, nachInit = true) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      [KOPF]: KI,
      ...(nachInit ? { "mcp-protocol-version": PROTOKOLL } : {}),
    },
    body: JSON.stringify(nachricht),
  });
}

describe("R-0713 · MCP-Verbindungsaufbau über echtes HTTP (Abfolge des SDK-Clients)", () => {
  it("S1 · initialize → initialized → Strom-Versuch → tools/list → tools/call mit Beleg", async () => {
    const { url, validiertId } = await serverMitBestand();

    const init = await senden(
      url,
      {
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: {
          protocolVersion: PROTOKOLL,
          capabilities: {},
          clientInfo: { name: "socket-pruefclient", version: "1.0.0" },
        },
      },
      false,
    );
    expect(init.status).toBe(200);
    expect(init.headers.get("content-type") ?? "").toContain("application/json");
    expect(init.headers.get("mcp-session-id")).toBeNull();
    const initKoerper = (await init.json()) as {
      result: { protocolVersion: string; capabilities: { tools?: unknown } };
    };
    expect(initKoerper.result.protocolVersion).toBe(PROTOKOLL);
    expect(initKoerper.result.capabilities.tools).toBeDefined();

    const bereit = await senden(url, { jsonrpc: "2.0", method: "notifications/initialized" });
    expect(bereit.status).toBe(202);
    expect(await bereit.text()).toBe("");

    const strom = await fetch(url, {
      method: "GET",
      headers: { accept: "text/event-stream", [KOPF]: KI, "mcp-protocol-version": PROTOKOLL },
    });
    expect(strom.status, "der SDK-Client nimmt nur 405 als ‚kein Strom' hin").toBe(405);

    const liste = await senden(url, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(liste.status).toBe(200);
    const tools = ((await liste.json()) as { result: { tools: { name: string }[] } }).result.tools;
    expect(tools.map((t) => t.name)).toEqual(["klara_fragen"]);

    const aufruf = await senden(url, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "klara_fragen",
        arguments: { question: "Wie wird die Kesselspeisepumpe KSP-7 angefahren?" },
      },
    });
    expect(aufruf.status).toBe(200);
    const ergebnis = (
      (await aufruf.json()) as {
        result: {
          isError: boolean;
          content: { type: string; text: string }[];
          structuredContent: { beantwortet: boolean; belege: { wissensobjekt: string }[] };
        };
      }
    ).result;
    expect(ergebnis.isError).toBe(false);
    expect(ergebnis.content[0]?.type).toBe("text");
    expect(ergebnis.content[0]?.text).toContain("HV-9");
    expect(ergebnis.structuredContent.beantwortet).toBe(true);
    expect(ergebnis.structuredContent.belege.map((b) => b.wissensobjekt)).toContain(validiertId);
  });

  it("S2 · über echtes HTTP: ohne Schlüssel 401, kein Schlüssel in einer Antwort", async () => {
    const { url } = await serverMitBestand();
    const ohne = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect(ohne.status).toBe(401);
    const mit = await senden(url, { jsonrpc: "2.0", id: 1, method: "ping" });
    expect(mit.status).toBe(200);
    expect(await mit.text()).not.toContain(KI);
  });
});
