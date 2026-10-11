import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ================================================================================================
// R-0676 · POST /api/kos UND POST /api/kos/from-document — ERST DAS RECHT, DANN DER KÖRPER
// ================================================================================================
//
// DER ZIELZUSTAND (wörtlich): „Beim Anlegen von Wissensobjekten über die Schnittstelle wird zuerst
// die Berechtigung geprüft und erst danach der Inhalt der Anfrage ausgewertet."
//
// Beide Anlegewege prüften `ko.create` im Handler, also NACH Fastifys Body-Parsing. Die Messung
// folgt `objects-auth-vor-parsing.test.ts` und `kos-auth-vor-parsing.test.ts`: ein 401/403 allein
// belegt nichts, denn er kam auch vorher — nur eben nach dem Parsen. Gemessen wird deshalb, was sich
// NUR unterscheidet, wenn der Körper ungelesen bleibt:
//
//   1. LIFECYCLE: ein Zähler in `preParsing` (läuft nach allen `onRequest`-Hooks, unmittelbar vor
//      dem Parsen). Anonym und ohne Anlegerecht steht er auf 0; die Gegenmessung mit Anlegerecht
//      zeigt, dass der Zähler überhaupt zählt.
//   2. PARSER-KANTE: kaputtes JSON. 400 `FST_ERR_CTP_INVALID_JSON` entsteht nur, wenn geparst wurde.
//      Anonym → 401, ohne Recht → 403, mit Recht → 400 (Kontrolle).
//
// GEGENPROBE: mit ausgehängtem `onRequest` fallen die Fälle 1–3 — der Zähler steht auf 1 und das
// kaputte JSON antwortet 400.

const ANLEGEWEGE = ["/api/kos", "/api/kos/from-document"] as const;
const JSON_KOPF = { "content-type": "application/json" };
const KAPUTT = '{"title":"x"';

function appMitParsingZaehler(): { app: FastifyInstance; parsingLaeufe: () => number } {
  const app = buildApp(buildServices());
  let laeufe = 0;
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (request.method === "POST" && (ANLEGEWEGE as readonly string[]).includes(request.url)) {
      laeufe += 1;
    }
    return payload;
  });
  return { app, parsingLaeufe: () => laeufe };
}

async function anmelden(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<Record<string, string>> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { authorization: `Bearer ${res.json().token}`, ...JSON_KOPF };
}

/** Admin (erstes Konto, darf anlegen) und ein Leser (`viewer`, nur `ko.read`). */
async function konten(
  app: FastifyInstance,
): Promise<{ admin: Record<string, string>; leser: Record<string, string> }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const admin = await anmelden(app, "a@x.de", "secret123");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: "Leser", email: "leser@x.de", password: "geheim12345", role: "viewer" },
  });
  if (angelegt.statusCode !== 201) {
    throw new Error(`Leserkonto nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
  }
  return { admin, leser: await anmelden(app, "leser@x.de", "geheim12345") };
}

describe("R-0676: die Anlegewege für Wissensobjekte urteilen, BEVOR der Körper gelesen wird", () => {
  for (const pfad of ANLEGEWEGE) {
    it(`${pfad} anonym: 401, die Parsing-Phase wird nie betreten`, async () => {
      const { app, parsingLaeufe } = appMitParsingZaehler();
      const res = await app.inject({
        method: "POST",
        url: pfad,
        headers: JSON_KOPF,
        payload: KAPUTT,
      });
      expect(res.statusCode).toBe(401);
      expect(res.body).not.toContain("FST_ERR_CTP_INVALID_JSON");
      expect(parsingLaeufe()).toBe(0);
    });

    it(`${pfad} angemeldet OHNE Anlegerecht: 403, die Parsing-Phase wird nie betreten`, async () => {
      const { app, parsingLaeufe } = appMitParsingZaehler();
      const { leser } = await konten(app);
      const res = await app.inject({ method: "POST", url: pfad, headers: leser, payload: KAPUTT });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({ error: "FORBIDDEN" });
      expect(res.body).toContain("ko.create");
      expect(parsingLaeufe()).toBe(0);
    });

    it(`${pfad} KONTROLLE mit Anlegerecht: der Zähler zählt, kaputtes JSON wird erst jetzt bemerkt`, async () => {
      const { app, parsingLaeufe } = appMitParsingZaehler();
      const { admin } = await konten(app);
      const res = await app.inject({ method: "POST", url: pfad, headers: admin, payload: KAPUTT });
      expect(res.statusCode).toBe(400);
      expect(parsingLaeufe()).toBe(1);
    });
  }

  it("mit Anlegerecht bleibt das Anlegen selbst unverändert (201)", async () => {
    const app = buildApp(buildServices());
    const { admin } = await konten(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: JSON.stringify({
        confidentiality: "intern",
        title: "Ventil prüfen",
        statement: "Vor dem Anfahren das Ventil prüfen.",
        type: "best_practice",
        category: "Sicherheit",
      }),
    });
    expect(res.statusCode).toBe(201);
  });
});
