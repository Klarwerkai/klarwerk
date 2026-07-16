import { readFileSync, readdirSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-490 D2: dedizierter Add-on-Principal (ask.validated) ERSETZT den ko.read-Viewer aus 48f24e2.
// Diese Suite sichert: validated-only-Antwort auf POST /api/ask, jede andere Route mit dem Key → 403
// (nicht 401, nicht Teilzugriff), KEIN generisches ko.read, und der Key wird pro Request nur EINMAL
// validiert. Alles hinter KLARWERK_ADDON_API; Flag AUS = Bestandsverhalten.
const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "s3cr3t-addon-key";

const SAVED: Record<string, string | undefined> = {};
const KEYS = [
  "KLARWERK_ADDON_API",
  "KLARWERK_ADDON_API_KEY",
  "KLARWERK_ADDON_ORIGIN",
  "KLARWERK_ADDON_TENANT",
];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

// Ein validiertes KO (XQ42) und ein UNvalidiertes KO (TVX99, „offen") — beide im Bestand, damit die
// validated-only-Grenze prüfbar ist.
async function seededApp() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };

  const validated = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Zylinderkopfdichtung XQ42 wechseln",
      statement: "Die Zylinderkopfdichtung XQ42 vor dem Wechsel entlasten.",
      type: "best_practice",
      category: "Ask",
      neededValidations: 1,
    },
  });
  const validatedId = validated.json().id as string;
  await app.inject({
    method: "PUT",
    url: `/api/kos/${validatedId}`,
    headers,
    payload: { action: "rate", verdict: "up" }, // → status "validiert"
  });

  const unvalidated = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Turboverdichter TVX99 Sonderfall",
      statement: "Beim Turboverdichter TVX99 die Drehzahl im Sonderfall begrenzen.",
      type: "best_practice",
      category: "Ask",
    },
  });
  const unvalidatedId = unvalidated.json().id as string; // NICHT bewertet → bleibt "offen"

  return { app, headers, validatedId, unvalidatedId };
}

describe("KLARWERK_ADDON_API — Add-on-Principal (Flag AUS = Bestandsverhalten)", () => {
  it("Add-in-Key ist KEIN Zugang → Session-Guard greift → 401 (kein Principal-Pfad)", async () => {
    process.env.KLARWERK_ADDON_API_KEY = KEY; // gesetzt, aber Flag AUS
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { question: "Hallo?" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("KLARWERK_ADDON_API — Add-on-Principal (Flag AN)", () => {
  beforeEach(() => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
  });

  it("ask.validated antwortet aus VALIDIERTEN Inhalten (POST /api/ask, ok)", async () => {
    const { app, validatedId } = await seededApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { question: "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.sources).toContain(validatedId);
  });

  it("validated-only: antwortet NICHT aus einem unvalidierten KO", async () => {
    const { app, unvalidatedId } = await seededApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { question: "Was gilt beim Turboverdichter TVX99 im Sonderfall?" },
    });
    expect(res.statusCode).toBe(200);
    // Das passende KO ist „offen" → für ask.validated unsichtbar: keine Quelle, keine Antwort.
    expect(res.json().result.sources).not.toContain(unvalidatedId);
    expect(res.json().result.answered).toBe(false);
  });

  it("der Key öffnet KEINE andere Route → reproduzierbar 403 (nicht 401, kein Teilzugriff)", async () => {
    const { app } = await seededApp();
    const routes: Array<{ method: "GET" | "POST"; url: string }> = [
      { method: "GET", url: "/api/gaps" }, // ko.read-Route → beweist: KEIN generisches ko.read
      { method: "GET", url: "/api/conflicts" },
      { method: "GET", url: "/api/duplicates" },
      { method: "POST", url: "/api/kos" },
      { method: "GET", url: "/health" },
    ];
    for (const r of routes) {
      const res = await app.inject({
        method: r.method,
        url: r.url,
        headers: { [ADDON_KEY_HEADER]: KEY },
        ...(r.method === "POST"
          ? { payload: { title: "x", statement: "y", type: "best_practice" } }
          : {}),
      });
      expect(res.statusCode, `${r.method} ${r.url}`).toBe(403);
    }
  });

  it("Session-Request auf /api/ask bleibt unverändert (ko.read, 200)", async () => {
    const { app, headers } = await seededApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("ungültiger Key → 401 (kein Fallback auf Session mit falschem Key)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: "falsch" },
      payload: { question: "Hallo?" },
    });
    expect(res.statusCode).toBe(401);
  });
});

// Statischer Nachweis: der Add-on-Key wird an GENAU EINER Stelle validiert (Dreifach-Validierung weg).
// Rate-Limiter und Ask-Route lesen nur den request-lokalen Principal (authContext), prüfen den Key nie.
describe("SCRUM-490 D2: Key-Validierung genau einmal", () => {
  const APP_SRC = "services/app/src";

  function srcFiles(): string[] {
    return readdirSync(APP_SRC)
      .filter((f) => f.endsWith(".ts") && !f.includes(".test."))
      .map((f) => `${APP_SRC}/${f}`);
  }

  it("timingSafeEqual (Key-Vergleich) steht nur in addon-principal.ts", () => {
    const withCompare = srcFiles().filter((f) =>
      readFileSync(f, "utf8").includes("timingSafeEqual"),
    );
    expect(withCompare).toEqual([`${APP_SRC}/addon-principal.ts`]);
  });

  it("Rate-Limiter und Ask-Route lesen authContext, prüfen den Key nicht selbst", () => {
    for (const f of [`${APP_SRC}/addon-rate-limit.ts`, `${APP_SRC}/routes/ask-routes.ts`]) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} soll authContext lesen`).toContain("authContext");
      expect(src.includes("timingSafeEqual"), `${f} darf den Key nicht selbst prüfen`).toBe(false);
      expect(src.includes("ADDON_KEY_HEADER"), `${f} darf den Key-Header nicht selbst lesen`).toBe(
        false,
      );
    }
  });
});
