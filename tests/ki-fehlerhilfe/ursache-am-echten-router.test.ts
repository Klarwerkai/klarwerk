// ================================================================================================
// JOB 3420 · UX-10b — FALL 1: DIE GEMESSENE URSACHE KOMMT AM ECHTEN ROUTER HERAUS.
// ================================================================================================
//
// GEGEN DEN ECHTEN ROUTER, NICHT GEGEN EINE ATTRAPPE (Codex-Lehre JOB 3203 R4, 07.09.). Gemessen
// wird `POST /api/reasoner/test` bzw. `POST /api/reasoner/test-local` am gebauten Fastify-Baum,
// mit echter Anmeldung (`users.manage`) und `app.inject` — nicht `reasoner.probe()` direkt. Nur so
// ist belegt, dass die drei neuen Felder die DIENSTGRENZE überqueren; eine Route, die das Ergebnis
// Feld für Feld neu zusammensetzte, würde hier rot.
//
// WAS DIESER FALL AUSDRÜCKLICH NICHT BELEGT: dass irgendjemand die Auskunft SIEHT. Das messen die
// gemounteten Fälle dieses Ordners.
//
// DER NEGATIVFALL IST DER WICHTIGERE: wo nichts gescheitert ist (kein Anbieter gewählt, nichts
// eingerichtet, kein lokaler LLM verdrahtet), FEHLT `fehlerklasse`. „Kein Feld" heisst „nicht
// gemessen" — nicht „unbekannter Fehler".
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type ModelClient,
  ModelHttpError,
  ModelProvider,
  ModelTimeoutError,
  Reasoner,
} from "../../services/reasoner";

/** Die wörtliche, gekappte Begründung, die JOB 3122 (N12d) genau für den 400-Fall mitträgt. */
const ANBIETER_GRUND = "unknown parameter: max_tokens";

interface Probeantwort {
  ok: boolean;
  provider: string;
  mode: string;
  detail: string;
  anbieter?: string;
  fehlerklasse?: string;
  status?: number;
  anbieterGrund?: string;
}

/** Ein Client, dessen jeder Aufruf mit dem übergebenen Fehler scheitert. Kein Netz, kein Schlüssel. */
function clientDerWirft(name: string, fehler: Error): ModelClient {
  return {
    name,
    complete: async () => {
      throw fehler;
    },
  } as unknown as ModelClient;
}

async function adminKopf(
  app: ReturnType<typeof buildApp>,
  email: string,
): Promise<{ authorization: string }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email, password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  return { authorization: `Bearer ${String(login.json().token)}` };
}

describe("JOB 3420 · Fall 1 — POST /api/reasoner/test trägt die gemessene Ursache", () => {
  it("400 mit Anbieter-Begründung: Klasse, Status und die WÖRTLICHE Begründung kommen an", async () => {
    const services = buildServices();
    services.reasoner = new Reasoner(
      new ModelProvider(
        clientDerWirft(
          "cloud:openai:gpt-6-astra",
          new ModelHttpError("Modell-API antwortete mit 400", 400, ANBIETER_GRUND),
        ),
      ),
    );
    const app = buildApp(services);
    const headers = await adminKopf(app, "a400@x.de");

    const res = await app.inject({ method: "POST", url: "/api/reasoner/test", headers });

    expect(res.statusCode).toBe(200);
    const body = res.json() as Probeantwort;
    expect(body.ok).toBe(false);
    expect(body.mode).toBe("model");
    // Die drei neuen Felder — heute gibt es sie nicht, deshalb ist dieser Fall vor der Änderung rot.
    expect(body.fehlerklasse).toBe("http");
    expect(body.status).toBe(400);
    expect(body.anbieterGrund).toBe(ANBIETER_GRUND);
    // Der geprüfte Anbieter und die unveränderte Rohmeldung stehen unangetastet daneben.
    expect(body.anbieter).toBe("openai");
    expect(body.detail).toBe("Modell-API antwortete mit 400");
  });

  it("Zeitlimit: Klasse timeout, und WEDER Status NOCH Anbieter-Begründung werden erfunden", async () => {
    const services = buildServices();
    services.reasoner = new Reasoner(
      new ModelProvider(
        clientDerWirft(
          "anthropic:claude-sonnet-4-6",
          new ModelTimeoutError("Zeitlimit überschritten", 30_000),
        ),
      ),
    );
    const app = buildApp(services);
    const headers = await adminKopf(app, "atimeout@x.de");

    const res = await app.inject({ method: "POST", url: "/api/reasoner/test", headers });

    const body = res.json() as Probeantwort;
    expect(res.statusCode).toBe(200);
    expect(body.fehlerklasse).toBe("timeout");
    // Die schärfere Form als `toBeUndefined()`: der Schlüssel existiert gar nicht.
    expect("status" in body).toBe(false);
    expect("anbieterGrund" in body).toBe(false);
  });

  it("kein Anbieter gewählt: KEINE Fehlerklasse — dort ist nichts gescheitert", async () => {
    const app = buildApp(buildServices());
    const headers = await adminKopf(app, "aleer@x.de");

    const res = await app.inject({ method: "POST", url: "/api/reasoner/test", headers });

    const body = res.json() as Probeantwort;
    expect(body.ok).toBe(false);
    expect(body.mode).toBe("deterministic");
    expect("fehlerklasse" in body).toBe(false);
  });

  it("POST /api/reasoner/test-local: der lokale Weg trägt dieselbe Klasse", async () => {
    const services = buildServices();
    services.reasoner = new Reasoner(
      undefined,
      undefined,
      undefined,
      undefined,
      new ModelProvider(
        clientDerWirft("local:Qwen3-32B-AWQ", new Error("fetch failed: ECONNREFUSED")),
      ),
    );
    const app = buildApp(services);
    const headers = await adminKopf(app, "alokal@x.de");

    const res = await app.inject({ method: "POST", url: "/api/reasoner/test-local", headers });

    const body = res.json() as Probeantwort;
    expect(res.statusCode).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.fehlerklasse).toBe("network");
  });

  it("kein lokaler LLM verdrahtet: KEINE Fehlerklasse — dort ist nichts eingerichtet", async () => {
    const app = buildApp(buildServices());
    const headers = await adminKopf(app, "akeinlokal@x.de");

    const res = await app.inject({ method: "POST", url: "/api/reasoner/test-local", headers });

    const body = res.json() as Probeantwort;
    expect(body.mode).toBe("deterministic");
    expect("fehlerklasse" in body).toBe(false);
  });
});
