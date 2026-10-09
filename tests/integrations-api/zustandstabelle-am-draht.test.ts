// ================================================================================================
// Aufnahme gesamt-integrations-api · R-0696 / R-0712 — TABELLE, BESCHREIBUNG UND DRAHT SIND EINS.
// ================================================================================================
//
// R-0696: „Welche Antwortzustände die Schnittstelle liefern darf, steht als verbindliche Tabelle
// fest, statt aus dem Code erschlossen zu werden." Verbindlich heißt hier: jede Antwort, die dieser
// Test am echten Draht beobachtet, MUSS als Paar (Status, error) in der Tabelle der Route stehen —
// eine neue Antwortform macht ihn rot, bevor ein Anbindender sie zum ersten Mal sieht.
//
// R-0712: die ausgelieferte OpenAPI-Datei ist die aus der Tabelle erzeugte — zeichengleich im Inhalt.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { DIENST_RECHTE, DIENST_SCHLUESSEL_HEADER } from "../../services/app/src/dienst-schluessel";
import {
  GEMEINSAME_ZUSTAENDE,
  INTEGRATIONS_VERTRAG,
  SCHEMAS,
  integrationsOpenApi,
  vertragUndRoutenGleich,
  zustandErlaubt,
} from "../../services/app/src/integrations-vertrag";
import { CONFIDENTIALITY_LEVELS, KNOWLEDGE_TYPES } from "../../services/knowledge-object";

const WURZEL = join(__dirname, "..", "..");
const VOLL = "voll-schluessel-0123456789abcdef0123456789abcdef0";
const NUR_STATUS = "status-schluessel-0123456789abcdef0123456789abcd";
const summe = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

const GESICHERT: { wert?: string | undefined } = {};
beforeEach(() => {
  GESICHERT.wert = process.env.KLARWERK_SERVICE_KEYS;
  process.env.KLARWERK_SERVICE_KEYS = JSON.stringify([
    { id: "voll", sha256: [summe(VOLL)], rechte: [...DIENST_RECHTE], max: 500 },
    { id: "nur-status", sha256: [summe(NUR_STATUS)], rechte: ["status.read"], max: 2 },
  ]);
});
afterEach(() => {
  if (GESICHERT.wert === undefined) {
    delete process.env.KLARWERK_SERVICE_KEYS;
  } else {
    process.env.KLARWERK_SERVICE_KEYS = GESICHERT.wert;
  }
});

interface Fall {
  name: string;
  methode: "GET" | "POST";
  pfad: string;
  url?: string;
  schluessel?: string;
  payload?: unknown;
  roh?: { body: string; contentType: string };
  erwartet: number;
}

const GROSS = "x".repeat(130 * 1024);

// Mindestens ein Fall je Zustand der Tabelle, der sich ohne Störung des Servers herstellen lässt.
// Nicht hergestellt: 500 INTERNAL (bräuchte einen eingebauten Fehler) und 503 KI_ABGESCHALTET (der
// Abschaltweg hat eigene Tests unter tests/d5-ki-aus/) — beide stehen trotzdem in der Tabelle.
const FAELLE: Fall[] = [
  {
    name: "Frage beantwortet/Lücke",
    methode: "POST",
    pfad: "/api/ask",
    payload: { question: "Wie wird die Pumpe P-1 angefahren?" },
    erwartet: 200,
  },
  {
    // Über der Feldgrenze (8.000 Zeichen), aber unter der Rumpfgrenze — das Schema greift.
    name: "Frage zu lang fürs Schema",
    methode: "POST",
    pfad: "/api/ask",
    payload: { question: "x".repeat(9_000) },
    erwartet: 400,
  },
  {
    name: "Frage zu groß",
    methode: "POST",
    pfad: "/api/ask",
    payload: { question: GROSS },
    erwartet: 413,
  },
  {
    name: "Frage als Text statt JSON",
    methode: "POST",
    pfad: "/api/ask",
    roh: { body: "Hallo", contentType: "text/csv" },
    erwartet: 415,
  },
  {
    name: "Prüfung",
    methode: "POST",
    pfad: "/api/check-text",
    payload: {
      text: "Die Pumpe P-1 wird über das Handventil HV-1 langsam und kontrolliert angefahren.",
    },
    erwartet: 200,
  },
  {
    name: "Prüfung zu kurz",
    methode: "POST",
    pfad: "/api/check-text",
    payload: { text: "zu kurz" },
    erwartet: 400,
  },
  { name: "Export", methode: "GET", pfad: "/api/library/export", erwartet: 200 },
  {
    name: "Export Markdown",
    methode: "GET",
    pfad: "/api/library/export",
    url: "/api/library/export?format=markdown",
    erwartet: 200,
  },
  {
    name: "Einliefern",
    methode: "POST",
    pfad: "/api/library/import/candidates",
    payload: {
      items: [
        {
          title: "Pumpe P-1",
          statement: "P-1 langsam anfahren.",
          type: "best_practice",
          category: "X",
        },
      ],
    },
    erwartet: 201,
  },
  {
    // Nacharbeit 2: die fachliche 400 des Imports trägt ihre Kennung aus der Tabelle.
    name: "Einliefern mit unbekannter Wissensart",
    methode: "POST",
    pfad: "/api/library/import/candidates",
    payload: {
      items: [
        {
          title: "Pumpe P-2",
          statement: "P-2 langsam anfahren.",
          type: "keine_wissensart",
          category: "X",
        },
      ],
    },
    erwartet: 400,
  },
  {
    // Nacharbeit 2: der Import hat keine eigene Rumpfgrenze — es gilt die des Rahmens (1 MiB).
    name: "Einliefern zu groß",
    methode: "POST",
    pfad: "/api/library/import/candidates",
    payload: {
      items: [
        {
          title: "Pumpe P-3",
          statement: "x".repeat(1_100_000),
          type: "best_practice",
          category: "X",
        },
      ],
    },
    erwartet: 413,
  },
  {
    name: "Einliefern kein JSON",
    methode: "POST",
    pfad: "/api/library/import/candidates",
    roh: { body: "{kaputt", contentType: "application/json" },
    erwartet: 400,
  },
  { name: "Health", methode: "GET", pfad: "/health", erwartet: 200 },
  { name: "KI-Status", methode: "GET", pfad: "/api/reasoner/status", erwartet: 200 },
  // Aufnahme gesamt-mcp (R-0713): der MCP-Zugang mit seinen Zuständen.
  {
    name: "MCP initialize",
    methode: "POST",
    pfad: "/mcp",
    payload: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    erwartet: 200,
  },
  {
    name: "MCP Benachrichtigung",
    methode: "POST",
    pfad: "/mcp",
    payload: { jsonrpc: "2.0", method: "notifications/initialized" },
    erwartet: 202,
  },
  {
    name: "MCP kein JSON",
    methode: "POST",
    pfad: "/mcp",
    roh: { body: "{kaputt", contentType: "application/json" },
    erwartet: 400,
  },
  {
    name: "MCP als CSV",
    methode: "POST",
    pfad: "/mcp",
    roh: { body: "a;b", contentType: "text/csv" },
    erwartet: 415,
  },
  { name: "MCP Ereignisstrom", methode: "GET", pfad: "/mcp", erwartet: 405 },
  {
    name: "falscher Schlüssel",
    methode: "GET",
    pfad: "/api/library/export",
    schluessel: "falsch-0123456789abcdef0123456789abcdef0123456789",
    erwartet: 401,
  },
  {
    name: "Recht fehlt",
    methode: "GET",
    pfad: "/api/library/export",
    schluessel: NUR_STATUS,
    erwartet: 403,
  },
];

describe("R-0696 · jede beobachtete Antwort steht in der Tabelle", () => {
  it("T1 · alle Fälle: erwarteter Status UND (Status, error) aus der Tabelle der Route", async () => {
    const app = buildApp(buildServices());
    const ausserhalb: string[] = [];
    for (const f of FAELLE) {
      const payload = (f.roh?.body ?? f.payload) as string | object | undefined;
      const res = await app.inject({
        method: f.methode,
        url: f.url ?? f.pfad,
        headers: {
          [DIENST_SCHLUESSEL_HEADER]: f.schluessel ?? VOLL,
          ...(f.roh ? { "content-type": f.roh.contentType } : {}),
        },
        ...(payload !== undefined ? { payload } : {}),
      });
      expect(res.statusCode, f.name).toBe(f.erwartet);
      const fehler = res.statusCode >= 400 ? (res.json() as { error?: string }).error : undefined;
      if (!zustandErlaubt(f.methode, f.pfad, res.statusCode, fehler)) {
        ausserhalb.push(`${f.name}: ${res.statusCode} ${fehler ?? "—"}`);
      }
    }
    expect(ausserhalb, "Antworten, die die Zustandstabelle nicht kennt").toEqual([]);
  });

  it("T2 · 429 mit Retry-After steht in der Tabelle und kommt so am Draht", async () => {
    const app = buildApp(buildServices());
    const kopf = { [DIENST_SCHLUESSEL_HEADER]: NUR_STATUS };
    const status = () => app.inject({ method: "GET", url: "/health", headers: kopf });
    await status();
    await status();
    const res = await status();
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(zustandErlaubt("GET", "/health", 429, res.json().error)).toBe(true);
    const zeile = GEMEINSAME_ZUSTAENDE.find((z) => z.status === 429);
    expect(zeile?.kopf).toContain("retry-after");
  });

  it("T3 · die Tabelle deckt genau die Routen, die ein Dienst-Schlüssel erreicht — mit demselben Recht", () => {
    expect(vertragUndRoutenGleich()).toBe(true);
  });

  it("T4 · kalibriert: ein Zustand außerhalb der Tabelle wird erkannt", () => {
    expect(zustandErlaubt("GET", "/api/library/export", 404, "NOT_FOUND")).toBe(false);
    expect(zustandErlaubt("POST", "/api/ask", 401, "UNAUTHENTICATED")).toBe(true);
    expect(zustandErlaubt("POST", "/api/ask", 503, "MODEL_BUSY")).toBe(false);
  });

  it("T5 · kein Platzhalter: jeder Fehlerzustand nennt seine Kennung, und nur diese passt", () => {
    const ohneKennung: string[] = [];
    for (const r of INTEGRATIONS_VERTRAG) {
      for (const z of r.zustaende) {
        if (z.status >= 400 && z.fehler === undefined) {
          ohneKennung.push(`${r.methode} ${r.pfad} ${z.status}`);
        }
      }
    }
    expect(ohneKennung, "Fehlerzustände ohne Kennung ließen jede Kennung zu").toEqual([]);
    const importPfad = "/api/library/import/candidates";
    expect(zustandErlaubt("POST", importPfad, 400, "BAD_REQUEST")).toBe(true);
    expect(zustandErlaubt("POST", importPfad, 400, "DOKUMENT_UNBEKANNT")).toBe(true);
    expect(zustandErlaubt("POST", importPfad, 400, "IRGENDEINE_KENNUNG")).toBe(false);
    expect(zustandErlaubt("POST", importPfad, 413, "Payload Too Large")).toBe(true);
    // Ein Erfolg passt nur ohne Fehlerkennung, ein Fehler nie ohne.
    expect(zustandErlaubt("POST", importPfad, 201, undefined)).toBe(true);
    expect(zustandErlaubt("POST", importPfad, 201, "BAD_REQUEST")).toBe(false);
    expect(zustandErlaubt("POST", importPfad, 400, undefined)).toBe(false);
  });
});

interface OpenApiOperation {
  responses: Record<string, unknown>;
  "x-klarwerk-recht": string;
}

interface OpenApiAuszug {
  openapi: string;
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { securitySchemes: { dienstSchluessel: { name: string; in: string } } };
}

describe("R-0712 · maschinenlesbare Beschreibung", () => {
  it("O1 · docs/generated/integrations-openapi.json ist die aus der Tabelle erzeugte Beschreibung", () => {
    const datei = JSON.parse(
      readFileSync(join(WURZEL, "docs", "generated", "integrations-openapi.json"), "utf8"),
    );
    expect(datei).toEqual(integrationsOpenApi());
  });

  it("O3 · Wertemengen kommen aus dem Produkt, und keine Erfolgsantwort ist ein unbestimmtes Objekt", () => {
    const schemas = SCHEMAS as Record<string, { enum?: unknown[] }>;
    expect(schemas.Wissensart?.enum).toEqual([...KNOWLEDGE_TYPES]);
    expect(schemas.Vertraulichkeit?.enum).toEqual([...CONFIDENTIALITY_LEVELS]);
    const doc = integrationsOpenApi() as unknown as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
    const unbestimmt: string[] = [];
    for (const [pfad, ops] of Object.entries(doc.paths)) {
      for (const [methode, op] of Object.entries(ops)) {
        for (const [status, antwort] of Object.entries(op.responses)) {
          const inhalt = (antwort as { content?: Record<string, { schema?: unknown }> }).content;
          const json = inhalt?.["application/json"]?.schema;
          if (Number(status) < 300 && JSON.stringify(json) === JSON.stringify({ type: "object" })) {
            unbestimmt.push(`${methode.toUpperCase()} ${pfad} ${status}`);
          }
        }
      }
    }
    expect(unbestimmt, "Erfolgsantworten ohne beschriebene Felder").toEqual([]);
  });

  it("O2 · jede Route der Tabelle steht mit allen erlaubten Status in der Beschreibung", () => {
    const doc = integrationsOpenApi() as unknown as OpenApiAuszug;
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.components.securitySchemes.dienstSchluessel).toMatchObject({
      in: "header",
      name: DIENST_SCHLUESSEL_HEADER,
    });
    for (const route of INTEGRATIONS_VERTRAG) {
      const op = doc.paths[route.pfad]?.[route.methode.toLowerCase()];
      expect(op, `${route.methode} ${route.pfad}`).toBeDefined();
      expect(op?.["x-klarwerk-recht"]).toBe(route.recht);
      const erwartet = [
        ...new Set([...route.zustaende, ...GEMEINSAME_ZUSTAENDE].map((z) => String(z.status))),
      ].sort();
      expect(Object.keys(op?.responses ?? {}).sort()).toEqual(erwartet);
    }
  });
});
