import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { AskError } from "../../ask";
import { KlaraAusweichwegGesperrtFehler, ModelCapacityError } from "../../reasoner";
import { modelBusyErrorHandler } from "./build-app";
import { FirmenresetSchreibsperre, JournalAusgangUngewiss } from "./dev-persist";
import { sendError } from "./http";

const INTERNAL = { error: "INTERNAL", message: "Unerwarteter Fehler." };
const diagnose = "relation beleg_tabelle; connect 10.0.0.5:5432 (user beleg_db)";

describe("P7 · beide Fehlerausgänge maskieren unerwartete Fehler", () => {
  it.each([
    new TypeError(diagnose),
    Object.assign(new Error(diagnose), { code: "42P01" }),
    Object.assign(new Error(diagnose), { code: "ECONNREFUSED" }),
    Object.assign(new Error(diagnose), { code: "UNKNOWN_INFRASTRUCTURE", statusCode: 400 }),
    Object.assign(new Error(diagnose), { code: "BAD_REQUEST", statusCode: 500 }),
    Object.assign(new Error(diagnose), { code: "BAD_REQUEST", status: 500 }),
    Object.assign(new Error(diagnose), { code: "FST_ERR_INTERNAL", statusCode: 502 }),
    Object.assign(new Error(diagnose), { code: "CREATE_ROLLBACK_FAILED" }),
  ])("global und abgefangen: %s", async (error) => {
    const app = Fastify();
    app.setErrorHandler(modelBusyErrorHandler);
    app.get("/global", async () => {
      throw error;
    });
    app.get("/caught", async (_request, reply) => {
      sendError(reply, error);
    });
    try {
      for (const url of ["/global", "/caught"]) {
        const res = await app.inject({ method: "GET", url });
        expect(res.statusCode).toBe(500);
        expect(res.json()).toEqual(INTERNAL);
        expect(res.body).not.toContain(diagnose);
        expect(res.body).not.toContain("beleg_tabelle");
        expect(res.body).not.toContain("10.0.0.5");
        expect(res.body).not.toContain("beleg_db");
        expect(res.body).not.toContain("TypeError");
      }
    } finally {
      await app.close();
    }
  });

  it("bewahrt echte Validierungs-400, MODEL_BUSY mit Retry-After und den Klara-409-Vertrag", async () => {
    const app = Fastify();
    app.setErrorHandler(modelBusyErrorHandler);
    app.post(
      "/input",
      {
        schema: {
          body: { type: "object", required: ["name"], properties: { name: { type: "string" } } },
        },
      },
      async () => ({ ok: true }),
    );
    app.get("/busy", async () => {
      throw new ModelCapacityError(diagnose);
    });
    const klara = new KlaraAusweichwegGesperrtFehler("consent_ended", "OpenAI");
    app.get("/klara", async () => {
      throw klara;
    });
    try {
      const invalid = await app.inject({ method: "POST", url: "/input", payload: {} });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().code).toBe("FST_ERR_VALIDATION");
      const valid = await app.inject({ method: "POST", url: "/input", payload: { name: "Tara" } });
      expect(valid.statusCode).toBe(200);
      expect(valid.json()).toEqual({ ok: true });
      const busy = await app.inject({ method: "GET", url: "/busy" });
      expect(busy.statusCode).toBe(503);
      expect(busy.headers["retry-after"]).toBe("1");
      expect(busy.json()).toEqual({
        error: "MODEL_BUSY",
        message: "KI-Modell derzeit ausgelastet. Bitte in Kürze erneut versuchen.",
      });
      expect(busy.body).not.toContain(diagnose);
      const blocked = await app.inject({ method: "GET", url: "/klara" });
      expect(blocked.statusCode).toBe(409);
      expect(blocked.json()).toEqual({
        error: "KLARA_AUSWEICHWEG_GESPERRT",
        reason: "consent_ended",
        message: klara.message,
      });
    } finally {
      await app.close();
    }
  });
  it("bekannte 503-Zustände behalten ihren festen Vertrag auch bei manipuliertem Fehlertext", async () => {
    const original = [
      new JournalAusgangUngewiss("interner-vorgang", new Error(diagnose)),
      new FirmenresetSchreibsperre(),
      new AskError("KI_ABGESCHALTET", diagnose),
    ];
    const erwartet = [
      "Der Ausgang ist ungewiss: der Speicher ist gerade weder lesbar noch beschreibbar. Bitte später neu laden, bevor Sie es erneut versuchen.",
      "Der Firmenreset läuft — dieser Schreibvorgang wurde nicht gespeichert. Bitte nach dem Neustart erneut versuchen.",
      "Der Administrator hat die KI abgeschaltet. Fragen an Klara werden derzeit nicht beantwortet, und es werden dafür keine Inhalte gelesen. Die Bibliothek und die Originale bleiben nach Ihren Leserechten nutzbar.",
    ];
    const app = Fastify();
    app.setErrorHandler(modelBusyErrorHandler);
    for (const [i, error] of original.entries()) {
      error.message = diagnose;
      app.get(`/global/${i}`, async () => {
        throw error;
      });
      app.get(`/caught/${i}`, async (_request, reply) => {
        sendError(reply, error);
      });
    }
    try {
      for (const [i, error] of original.entries()) {
        for (const weg of ["global", "caught"]) {
          const res = await app.inject({ method: "GET", url: `/${weg}/${i}` });
          expect(res.statusCode).toBe(503);
          expect(res.json()).toEqual({ error: error.code, message: erwartet[i] });
          expect(res.body).not.toContain(diagnose);
          expect(res.body).not.toContain("interner-vorgang");
        }
      }
      for (const [language, text] of [
        ["en", "The administrator has switched AI off."],
        ["nl", "De beheerder heeft AI uitgeschakeld."],
      ]) {
        const res = await app.inject({
          method: "GET",
          url: "/global/2",
          headers: { "accept-language": language },
        });
        expect(res.statusCode).toBe(503);
        expect(res.json().message).toContain(text);
        expect(res.body).not.toContain(diagnose);
      }
    } finally {
      await app.close();
    }
  });
});
