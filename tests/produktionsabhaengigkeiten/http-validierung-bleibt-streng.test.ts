// ================================================================================================
// JOB 4272 · 6b — DIE FASTIFY-ADVISORY BRAUCHT EINE PRIMITIVE BODY-WURZEL. KLARWERK HAT KEINE.
// ================================================================================================
//
// DIE MELDUNG: `fastify` 5.8.5 trägt GHSA-w2qp-rph6-63g4 („schema validation bypass via root
// primitive coercion mismatch", Bereich <5.12.1). Der Recherchebefund vom 16.09.
// (`ABHAENGIGKEITEN-SICHERHEIT.md:21`) grenzt sie ausdrücklich „auf primitive Body-Wurzeln" ein.
//
// DASS DIE LÜCKE AUF DER GEBUNDENEN VERSION WIRKLICH DA IST, ist in dieser Runde gemessen und
// nicht abgeschrieben (Cloud-Lauf 4ff043e98dcb61c356bb8d1b): eine Route mit `body: {type:"number"}`
// nimmt den JSON-Körper `"42"` mit **200** an und reicht dem Handler einen STRING; eine Route mit
// `body: {type:"string"}` nimmt `42` an und reicht eine ZAHL. Der Validator prüft also eine
// coercierte Kopie, der Handler bekommt das Rohe. Das ist die Advisory, am Draht.
//
// Der Laufzeitnachweis erhebt jede registrierte Route mit Schema, auch Inline-Schemata.
// Ein neuer Weg oder eine weitere Schemaart erfordert eine neue Einordnung.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { routenschemata } from "./routenschemata";
import { abweisungsBefund } from "./waechter";

const ZUGANG = { name: "Admin", email: "job4272-http@x.de", password: "secret123" };

async function angemeldet() {
  const app = buildApp(buildServices());
  const registriert = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: ZUGANG,
  });
  expect(registriert.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  expect(login.statusCode).toBe(200);
  return {
    app,
    headers: {
      authorization: `Bearer ${login.json().token as string}`,
      "content-type": "application/json",
    },
  };
}

describe("JOB 4272 · die Bedingung der Fastify-Advisory ist nicht erfüllt", () => {
  it("jedes registrierte Body-Schema hat eine Objektwurzel", async () => {
    const { "OPTIONS *": preflight, ...schemata } = await routenschemata();
    // Das CORS-Plugin markiert seine Preflight-Antwort nur für die Dokumentation.
    expect(preflight).toEqual({ hide: true });
    expect(Object.keys(schemata).sort()).toEqual([
      "POST /api/ask",
      "POST /api/ask/vergleich",
      "POST /api/check-text",
      "POST /api/kiosk/fragen",
      "POST /api/klara/sessions/:sessionId/execute",
    ]);
    for (const [route, schema] of Object.entries(schemata)) {
      expect(Object.keys(schema), route).toEqual(["body"]);
      expect(schema.body, route).toMatchObject({ type: "object" });
    }
  });
});

describe("JOB 4272 · 6b — die HTTP-Validierung weist weiter ab", () => {
  it("ein nicht coercierbarer Feldwert wird abgewiesen (400), der Handler sieht ihn nie", async () => {
    const { app, headers } = await angemeldet();
    try {
      for (const frage of [{ verschachtelt: true }, ["a", "b"]]) {
        const res = await app.inject({
          method: "POST",
          url: "/api/ask",
          headers,
          payload: JSON.stringify({ question: frage }),
        });
        // Dieselbe Funktion fährt `kalibrierung.test.ts` gegen eine Route OHNE Schema; dort muss
        // sie reden, hier muss sie schweigen.
        expect(abweisungsBefund(res.statusCode, res.body)).toBeNull();
        expect(res.body).toContain("FST_ERR_VALIDATION");
      }
      // Ein Wert ausserhalb des `enum` ist ebenfalls nicht coercierbar.
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: JSON.stringify({ question: "Frage?", mode: "gibt-es-nicht" }),
      });
      expect(res.statusCode, res.body.slice(0, 200)).toBe(400);
    } finally {
      await app.close();
    }
  });

  // ==============================================================================================
  // WAS HIER BEWUSST NICHT BEHAUPTET WIRD — gemessen, nicht angenommen.
  // ==============================================================================================
  // `{ question: 123 }` kommt mit **200** durch: ajv coerciert die Zahl zum String, weil Fastify
  // `coerceTypes` standardmässig anhat. Das ist dokumentiertes Fastify-Verhalten und NICHT
  // GHSA-w2qp-rph6-63g4 — bei einer OBJEKT-Wurzel bekommt der Handler den coercierten Wert, die
  // Prüfung und die Weitergabe sind also EINIG. Die Advisory beschreibt genau den Fall, in dem sie
  // das nicht sind, und der tritt nur bei einer primitiven Wurzel auf.
  //
  // Der Fall steht hier, damit niemand später „die API prüft Typen streng" aus diesem Ordner
  // herausliest. Sie tut es nicht; sie coerciert, und das ist gewollt.
  it("MESSPUNKT: ein coercierbarer Feldwert kommt durch — das ist Fastify-Vorgabe, keine Lücke", async () => {
    const { app, headers } = await angemeldet();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: JSON.stringify({ question: 123 }),
      });
      expect(res.statusCode, res.body.slice(0, 200)).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("ein Wert jenseits der Längengrenze wird abgewiesen (400)", async () => {
    const { app, headers } = await angemeldet();
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: JSON.stringify({ question: "x".repeat(8_001) }),
      });
      expect(res.statusCode, res.body.slice(0, 200)).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("DER FALL DER ADVISORY: eine PRIMITIVE Body-Wurzel wird abgewiesen, nicht coerciert", async () => {
    const { app, headers } = await angemeldet();
    try {
      // Genau die Form, die GHSA-w2qp-rph6-63g4 beschreibt — nur in der Richtung, die Klarwerk
      // wirklich hat: das Schema erwartet ein Objekt, der Körper ist ein JSON-Primitiv.
      for (const koerper of ['"hallo"', "42", "true", "null"]) {
        const res = await app.inject({
          method: "POST",
          url: "/api/ask",
          headers,
          payload: koerper,
        });
        expect(
          res.statusCode,
          `Primitiver Body ${koerper} kam mit ${res.statusCode} durch: ${res.body.slice(0, 200)}`,
        ).toBe(400);
      }
    } finally {
      await app.close();
    }
  });
});
