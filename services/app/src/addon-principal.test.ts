import { readFileSync, readdirSync } from "node:fs";
import type { FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type AddonPrincipal,
  authorizesAsk,
  isLiteralAskPath,
  resolveAddonAuth,
} from "./addon-principal";
import { buildApp, buildServices } from "./build-app";

// SCRUM-490 D2: dedizierter Add-on-Principal (ask.validated) ERSETZT den ko.read-Viewer aus 48f24e2.
// Diese Suite sichert: validated-only-Antwort auf POST /api/ask, jede andere Route mit dem Key → 403
// (nicht 401, nicht Teilzugriff), KEIN generisches ko.read, und der Key wird pro Request nur EINMAL
// validiert. Alles hinter KLARWERK_ADDON_API; Flag AUS = Bestandsverhalten.
const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "s3cr3t-addon-key";

const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_ADDON_API", "KLARWERK_ADDON_API_KEY", "KLARWERK_ADDON_ORIGIN"];
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

  it("Roh-Pfad-Exaktheit end-to-end (inject-treue Fälle): literal → 200, Variante → 403", async () => {
    // Hinweis: light-my-request löst Dot-Segmente (/%2e%2e/…) vorab auf, daher ist dieser Fall im
    // Unit-Test unten byte-genau abgedeckt; hier die Fälle, die inject den Rohpfad treu durchreicht.
    const app = buildApp(buildServices());
    const post = (url: string) =>
      app.inject({
        method: "POST",
        url,
        headers: { [ADDON_KEY_HEADER]: KEY },
        payload: { question: "Hallo?" },
      });
    expect((await post("/api/ask")).statusCode).toBe(200);
    expect((await post("/api/ask?x=1")).statusCode).toBe(200);
    expect((await post("/api/%61sk")).statusCode).toBe(403); // %61 = 'a'
    expect((await post("/api/ask/")).statusCode).toBe(403); // Trailing-Slash
    expect((await post("/API/ASK")).statusCode).toBe(403); // Groß-/Kleinschreibung
  });
});

// ben-Review-Nachbesserung: Defense-in-Depth-Capability-Check + expliziter Single-Tenant-Vertrag
// (keine erzwungene Tenant-Grenze am Principal).
describe("SCRUM-490 D2 (ben-Review): Capability-Check + Single-Tenant-Vertrag", () => {
  it("isLiteralAskPath: nur der byte-genaue Pfad /api/ask ist literal (Roh-Pfad-Regel)", () => {
    expect(isLiteralAskPath("/api/ask")).toBe(true);
    expect(isLiteralAskPath("/api/ask?x=1")).toBe(true);
    expect(isLiteralAskPath("/api/%61sk")).toBe(false); // %61 = 'a'
    expect(isLiteralAskPath("/%2e%2e/api/ask")).toBe(false); // %2e%2e = '..'
    expect(isLiteralAskPath("/api/ask/")).toBe(false); // Trailing-Slash
    expect(isLiteralAskPath("/API/ASK")).toBe(false); // Groß-/Kleinschreibung
    expect(isLiteralAskPath(undefined)).toBe(false);
  });

  it("authorizesAsk: nur Capability ask.validated autorisiert, sonst fail-closed", () => {
    const real: AddonPrincipal = { kind: "addon", id: "addon:klara", capability: "ask.validated" };
    expect(authorizesAsk(real)).toBe(true);
    // Simulierte künftige Capability → fail-closed (403 im Handler).
    const other = {
      kind: "addon",
      id: "addon:klara",
      capability: "ask.everything",
    } as unknown as AddonPrincipal;
    expect(authorizesAsk(other)).toBe(false);
  });

  it("der aufgelöste Principal trägt KEIN tenant-Feld (Single-Tenant, keine erzwungene Grenze)", () => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
    const res = resolveAddonAuth({
      headers: { [ADDON_KEY_HEADER]: KEY },
    } as unknown as FastifyRequest);
    expect(res.kind).toBe("valid");
    if (res.kind === "valid") {
      expect(res.principal).toEqual({
        kind: "addon",
        id: "addon:klara",
        capability: "ask.validated",
      });
      expect(Object.keys(res.principal)).not.toContain("tenant");
    }
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

// SCRUM-490 D1: count_only-Gap-Policy — der Nur-Lese-Add-on-Key schreibt keine Wissenslücke (und keinen
// Fragetext) mehr; die Zählung bleibt über das metadata-only ask.query-Audit. Session-Pfad byte-identisch.
describe("SCRUM-490 D1: count_only-Gap-Policy (addon-Actor)", () => {
  beforeEach(() => {
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = KEY;
  });

  // Session-Admin (erstes Konto: ko.read + ko.validate) für Einsicht in Gaps/Audit — der addon-Key darf das nicht.
  async function adminHeaders(app: ReturnType<typeof buildApp>) {
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
    return { authorization: `Bearer ${login.json().token}` };
  }

  it("addon-Actor, answered=false → keine Wissenslücke, kein gap im Response, kein gap.created", async () => {
    const app = buildApp(buildServices());
    const headers = await adminHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { question: "Was gilt beim Turboverdichter TVX99?" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.answered).toBe(false);
    expect(res.json().gap).toBeNull();
    // Keine Wissenslücke im Bestand.
    const gaps = await app.inject({ method: "GET", url: "/api/gaps", headers });
    expect(gaps.json()).toHaveLength(0);
    // Kein gap.created-Audit.
    const created = await app.inject({
      method: "GET",
      url: "/api/audit?action=gap.created",
      headers,
    });
    expect(created.json()).toHaveLength(0);
  });

  it("addon-Actor: kein Fragetext in Audit/Persistenz; ask.query metadata-only + addon-Actor", async () => {
    const app = buildApp(buildServices());
    const headers = await adminHeaders(app);
    const SECRET = "GEHEIMFRAGE-TVX99-XYZ";
    await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY },
      payload: { question: SECRET },
    });
    const audit = await app.inject({ method: "GET", url: "/api/audit", headers });
    const entries = audit.json() as Array<{
      actor: string;
      action: string;
      payload: Record<string, unknown>;
    }>;
    // Kein Audit-Eintrag enthält den Fragetext (weder als Feld noch irgendwo im JSON).
    expect(JSON.stringify(entries)).not.toContain(SECRET);
    // ask.query trägt den addon-Actor und ist metadata-only (keine question).
    const askQuery = entries.find((e) => e.action === "ask.query" && e.actor === "addon:klara");
    expect(askQuery).toBeDefined();
    expect(askQuery?.payload).not.toHaveProperty("question");
    // Keine Wissenslücke (die den Text speichern würde).
    const gaps = await app.inject({ method: "GET", url: "/api/gaps", headers });
    expect(gaps.json()).toHaveLength(0);
  });

  it("Session (nicht-addon), answered=false → Gap wie heute angelegt (actor=system, bit-identisch)", async () => {
    const app = buildApp(buildServices());
    const headers = await adminHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers, // Session, KEIN addon-Key
      payload: { question: "Was gilt beim Turboverdichter TVX99?" },
    });
    expect(res.json().result.answered).toBe(false);
    expect(res.json().gap).not.toBeNull(); // Gap zurückgegeben
    const gaps = await app.inject({ method: "GET", url: "/api/gaps", headers });
    expect(gaps.json()).toHaveLength(1); // Gap angelegt
    const created = await app.inject({
      method: "GET",
      url: "/api/audit?action=gap.created",
      headers,
    });
    expect(created.json()).toHaveLength(1);
    expect(created.json()[0].actor).toBe("system"); // Attribution unverändert
  });
});
