import { DIENST_ROUTEN, DIENST_SCHLUESSEL_HEADER, type DienstRecht } from "./dienst-schluessel";

// ================================================================================================
// Aufnahme gesamt-integrations-api (R-0696 / R-0712) — DER VERTRAG DER INTEGRATIONSSCHNITTSTELLE.
// ================================================================================================
//
// R-0696: welche Antwortzustände die Schnittstelle liefern DARF, steht hier als Tabelle — nicht im
// Code verstreut. Jede Route nennt ihre erlaubten Paare aus HTTP-Status und `error`-Kennung.
// `tests/integrations-api/zustandstabelle-am-draht.test.ts` fährt die Routen mit Dienst-Schlüsseln
// und verlangt, dass jede beobachtete Antwort in dieser Tabelle steht.
//
// R-0712: aus derselben Tabelle und den Schemas unten entsteht die maschinenlesbare Beschreibung
// (OpenAPI 3.1, `integrationsOpenApi()`). Die ausgelieferte Datei
// `docs/generated/integrations-openapi.json` muss ihr gleich sein — gehalten vom selben Testordner.
// Die menschenlesbare Fassung steht in `docs/architektur/integrations-schnittstelle.md`.
//
// Nacharbeit 2 (Bens Befunde): JEDER Fehlerzustand nennt jetzt seine Kennung — es gibt keinen
// Platzhalter mehr, der jede beliebige Kennung zuließe; der Kandidatenimport führt seine 413 und
// seine beiden fachlichen 400-Kennungen ausdrücklich; Anfragen und Antworten sind mit Feldern,
// Pflichtfeldern, Wertemengen und Antwortvarianten beschrieben statt als „beliebiges Objekt".
//
// Fassung 1.2.0 — Aufnahme gesamt-mcp (R-0713): der MCP-Zugang `/mcp` (Recht `mcp.werkzeug`,
// `routes/mcp-routes.ts`) steht mit seinen Zuständen in derselben Tabelle.

export const VERTRAGSFASSUNG = "1.2.0";

export interface Antwortzustand {
  readonly status: number;
  /**
   * Der Wert des Felds `error` im Antwortkörper. Fehlt GENAU bei Erfolgsantworten (2xx). Für die
   * Standardfehler des HTTP-Rahmens (Schema, Größe, Inhaltstyp) steht dort die HTTP-Kurzbezeichnung,
   * dazu `code`.
   */
  readonly fehler?: string;
  readonly bedeutung: string;
  /** Kopfzeilen, die in diesem Zustand verbindlich mitkommen. */
  readonly kopf?: readonly string[];
  /** Erfolg ohne Antwortkörper (MCP: angenommene Benachrichtigung). */
  readonly ohneRumpf?: true;
}

export interface Vertragsroute {
  readonly methode: "GET" | "POST";
  readonly pfad: string;
  readonly recht: DienstRecht;
  readonly zweck: string;
  /** Schema des Erfolgskörpers (Name unter `components.schemas`); `export` = vier Formate. */
  readonly erfolg:
    | "Antwort"
    | "Pruefergebnis"
    | "export"
    | "Kandidatenliste"
    | "Betriebszustand"
    | "KiZustand"
    | "McpAntwort";
  readonly zustaende: readonly Antwortzustand[];
}

/** Zustände, die JEDE Route mit Dienst-Schlüssel liefern kann. */
export const GEMEINSAME_ZUSTAENDE: readonly Antwortzustand[] = [
  {
    status: 401,
    fehler: "UNAUTHENTICATED",
    bedeutung:
      "Kein gültiger Dienst-Schlüssel: falsch, gesperrt oder nicht (mehr) konfiguriert. Es gibt keinen Rückfall auf eine Sitzung.",
  },
  {
    status: 403,
    fehler: "FORBIDDEN",
    bedeutung: "Der Schlüssel ist gültig, trägt aber das Recht dieser Route nicht.",
  },
  {
    status: 429,
    fehler: "RATE_LIMITED",
    bedeutung:
      "Grenze des Schlüssels erreicht, oder zu viele Fehlversuche von dieser Adresse. Retry-After nennt die Wartezeit in Sekunden; beim Schlüssel steht sie zusätzlich als wartenSek im Körper.",
    kopf: ["retry-after"],
  },
  {
    status: 500,
    fehler: "INTERNAL",
    bedeutung:
      "Interner Fehler; Einzelheiten bleiben im Serverprotokoll. Die Anfrage darf wiederholt werden.",
  },
];

const SCHEMAFEHLER: Antwortzustand = {
  status: 400,
  fehler: "Bad Request",
  bedeutung:
    "Rumpf verletzt das Schema oder ist kein JSON (code: FST_ERR_VALIDATION bzw. FST_ERR_CTP_…).",
};
const ZU_GROSS: Antwortzustand = {
  status: 413,
  fehler: "Payload Too Large",
  bedeutung: "Rumpf größer als 128 KiB (code: FST_ERR_CTP_BODY_TOO_LARGE).",
};
const FALSCHER_INHALTSTYP: Antwortzustand = {
  status: 415,
  fehler: "Unsupported Media Type",
  bedeutung: "Rumpf ist nicht application/json (code: FST_ERR_CTP_INVALID_MEDIA_TYPE).",
};

export const INTEGRATIONS_VERTRAG: readonly Vertragsroute[] = [
  {
    methode: "POST",
    pfad: "/api/ask",
    recht: "ask.validated",
    zweck:
      "Frage stellen. Antwort ausschließlich aus validiertem, nicht vertraulichem Wissen, ohne Modellaufruf; sonst eine ehrliche Wissenslücke.",
    erfolg: "Antwort",
    zustaende: [
      {
        status: 200,
        bedeutung:
          "Beantwortet (result.answered = true, mit Quellen) ODER Wissenslücke (result.answered = false). Beides ist ein Erfolg.",
      },
      SCHEMAFEHLER,
      ZU_GROSS,
      FALSCHER_INHALTSTYP,
      {
        status: 503,
        fehler: "KI_ABGESCHALTET",
        bedeutung: "Der Administrator hat die Fragefunktion der Instanz abgeschaltet.",
      },
    ],
  },
  {
    methode: "POST",
    pfad: "/api/check-text",
    recht: "checktext.validated",
    zweck:
      "Text gegen validiertes Wissen prüfen (Dubletten, Überschneidungen, Widersprüche) — deterministisch, ohne Modell, nichts wird gespeichert.",
    erfolg: "Pruefergebnis",
    zustaende: [
      { status: 200, bedeutung: "Prüfergebnis (auch: keine Funde)." },
      { ...SCHEMAFEHLER, bedeutung: "text fehlt oder liegt außerhalb von 40–8.000 Zeichen." },
      ZU_GROSS,
      FALSCHER_INHALTSTYP,
    ],
  },
  {
    methode: "GET",
    pfad: "/api/library/export",
    recht: "export.validated",
    zweck:
      "Wissen ausleiten: validierte, nicht vertrauliche Wissensobjekte; format = json (Standard), markdown, mediawiki oder html. Jeder Export wird protokolliert (Akteur dienst:<id>).",
    erfolg: "export",
    zustaende: [{ status: 200, bedeutung: "Export im angefragten Format." }],
  },
  {
    methode: "POST",
    pfad: "/api/library/import/candidates",
    recht: "import.kandidaten",
    zweck:
      "Wissen einliefern: die Einträge werden als Kandidaten in die Prüfwarteschlange gestellt. Ein Wissensobjekt entsteht erst, wenn ein berechtigter Mensch annimmt.",
    erfolg: "Kandidatenliste",
    zustaende: [
      {
        status: 201,
        bedeutung: "Eingereiht; die Antwort nennt die Kandidaten samt Dublettenbefund.",
      },
      {
        status: 400,
        fehler: "BAD_REQUEST",
        bedeutung:
          "Ein Eintrag ist unbrauchbar: unbekannte Wissensart (type) oder ungültige sourceVersion. Es wird nichts eingereiht.",
      },
      {
        status: 400,
        fehler: "DOKUMENT_UNBEKANNT",
        bedeutung:
          "Ein Eintrag nennt eine Dokumentkennung, die diese Instanz nicht vergeben hat. Es wird nichts eingereiht.",
      },
      { ...SCHEMAFEHLER, bedeutung: "Rumpf ist kein JSON (code: FST_ERR_CTP_…)." },
      {
        ...ZU_GROSS,
        bedeutung: "Rumpf größer als 1 MiB (code: FST_ERR_CTP_BODY_TOO_LARGE).",
      },
      FALSCHER_INHALTSTYP,
    ],
  },
  {
    methode: "GET",
    pfad: "/health",
    recht: "status.read",
    zweck: "Betriebszustand: status, Version und Deploy-Stand der Instanz.",
    erfolg: "Betriebszustand",
    zustaende: [{ status: 200, bedeutung: "Instanz antwortet (status = ok)." }],
  },
  {
    methode: "GET",
    pfad: "/api/reasoner/status",
    recht: "status.read",
    zweck: "Abstrakter KI-Zustand (aktiv/Modus), ohne Anbieter- oder Modellnamen.",
    erfolg: "KiZustand",
    zustaende: [{ status: 200, bedeutung: "Aktueller KI-Zustand." }],
  },
  {
    methode: "POST",
    pfad: "/mcp",
    recht: "mcp.werkzeug",
    zweck:
      "MCP-Zugang für fremde KI-Programme (Model Context Protocol, Streamable HTTP, zustandslos): eine JSON-RPC-2.0-Nachricht je Anfrage. Werkzeug klara_fragen nur mit zusätzlichem Recht ask.validated; es fragt über POST /api/ask mit demselben Schlüssel und liefert nur validiertes Wissen mit Beleg. Kein Browseraufruf (Anfrage mit Origin: 403).",
    erfolg: "McpAntwort",
    zustaende: [
      {
        status: 200,
        bedeutung:
          "JSON-RPC-Antwort: Ergebnis (initialize, ping, tools/list, tools/call) oder JSON-RPC-Fehler (-32600, -32601, -32602). Ein Werkzeugfehler steht als result.isError = true im Ergebnis.",
      },
      {
        status: 202,
        bedeutung: "Benachrichtigung oder Antwort des Clients angenommen; kein Antwortkörper.",
        ohneRumpf: true,
      },
      { ...SCHEMAFEHLER, bedeutung: "Rumpf ist kein JSON oder leer (code: FST_ERR_CTP_…)." },
      ZU_GROSS,
      FALSCHER_INHALTSTYP,
    ],
  },
  {
    methode: "GET",
    pfad: "/mcp",
    recht: "mcp.werkzeug",
    zweck: "Ereignisstrom des MCP-Zugangs — nicht angeboten (zustandsloser Server).",
    erfolg: "McpAntwort",
    zustaende: [
      {
        status: 405,
        fehler: "METHOD_NOT_ALLOWED",
        bedeutung: "Kein Ereignisstrom; Nachrichten nur per POST.",
        kopf: ["allow"],
      },
    ],
  },
];

/** Alle erlaubten Zustände einer Route: ihre eigenen und die gemeinsamen. */
export function erlaubteZustaende(methode: string, pfad: string): readonly Antwortzustand[] {
  const route = INTEGRATIONS_VERTRAG.find((r) => r.methode === methode && r.pfad === pfad);
  return route ? [...route.zustaende, ...GEMEINSAME_ZUSTAENDE] : GEMEINSAME_ZUSTAENDE;
}

/**
 * Steht dieses Paar aus Status und `error` in der Tabelle der Route? EXAKT: ein Erfolgszustand
 * passt nur ohne `error`, ein Fehlerzustand nur mit genau seiner Kennung — kein Platzhalter.
 */
export function zustandErlaubt(
  methode: string,
  pfad: string,
  status: number,
  fehler: string | undefined,
): boolean {
  return erlaubteZustaende(methode, pfad).some((z) => z.status === status && z.fehler === fehler);
}

// ------------------------------------------------------------------------------------------------
// R-0712 — die Schemas. Sie beschreiben, was die Routen heute TATSÄCHLICH senden (Quellen: die
// Antwortbauer in ask-routes.ts/answerEvidence, check-text-routes.ts `toResponse`,
// library-routes.ts `toImportCandidateDto`, build-app.ts `/health`, ReasonerService.publicStatus).
// Pflichtfelder sind nur dort gesetzt, wo der Bauer das Feld immer schreibt.
// ------------------------------------------------------------------------------------------------

const NULLBAR_TEXT = { type: ["string", "null"] };
const GANZZAHL = { type: "integer", minimum: 0 };

export const SCHEMAS: Readonly<Record<string, unknown>> = {
  Fehler: {
    type: "object",
    required: ["error", "message"],
    properties: {
      error: { type: "string" },
      message: { type: "string" },
      code: { type: "string" },
      wartenSek: { type: "integer", minimum: 1 },
    },
  },
  Wissensart: {
    type: "string",
    enum: ["bauchgefuehl", "best_practice", "lernkurve", "technik", "negativwissen"],
  },
  Vertraulichkeit: { type: "string", enum: ["intern", "vertraulich", "streng_vertraulich"] },
  Wissensklasse: {
    type: "string",
    enum: ["gesichert", "ungeprueft", "meinung", "extern", "annahme", "unbekannt"],
  },
  Frage: {
    type: "object",
    required: ["question"],
    properties: {
      question: { type: "string", maxLength: 8000 },
      locale: { type: "string", enum: ["de", "en", "nl"] },
    },
  },
  Antwort: {
    type: "object",
    required: ["result", "answerId", "gap", "receipt"],
    properties: {
      result: {
        type: "object",
        required: [
          "answered",
          "answer",
          "knowledgeClass",
          "trust",
          "sources",
          "citedSources",
          "steps",
          "demo",
          "captionSources",
          "evidence",
        ],
        properties: {
          answered: { type: "boolean" },
          answer: NULLBAR_TEXT,
          knowledgeClass: { $ref: "#/components/schemas/Wissensklasse" },
          trust: { type: "number", minimum: 0, maximum: 100 },
          sources: { type: "array", items: { type: "string" } },
          citedSources: { type: "array", items: { type: "string" } },
          captionSources: { type: "array", items: { type: "string" } },
          steps: {
            type: "array",
            items: {
              type: "object",
              required: ["description", "sourceId", "snippet"],
              properties: {
                description: { type: "string" },
                sourceId: NULLBAR_TEXT,
                snippet: NULLBAR_TEXT,
              },
            },
          },
          demo: { type: "boolean" },
          evidence: { $ref: "#/components/schemas/Evidenz" },
        },
        oneOf: [
          {
            title: "Beantwortet",
            properties: {
              answered: { const: true },
              evidence: { properties: { grade: { enum: ["verified", "unverified"] } } },
            },
          },
          {
            title: "Wissenslücke",
            properties: {
              answered: { const: false },
              evidence: { properties: { grade: { const: "gap" } } },
            },
          },
        ],
      },
      answerId: NULLBAR_TEXT,
      gap: { type: ["object", "null"] },
      receipt: { type: "string" },
      // R-0310: die ausdrückliche Absatz-Beleg-Zuordnung (services/app/src/absatz-belege.ts) —
      // nur bei beantworteter Frage; `quellen` leer heißt: unbelegt, wird nicht ausgegeben.
      absaetze: {
        type: "array",
        items: {
          type: "object",
          required: ["text", "quellen"],
          properties: {
            text: { type: "string" },
            quellen: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
  Evidenz: {
    type: "object",
    required: [
      "grade",
      "knowledgeClass",
      "rawKnowledgeClass",
      "checkCaveat",
      "sourcesConflicted",
      "conflictsUnproven",
    ],
    properties: {
      grade: { type: "string", enum: ["verified", "unverified", "gap"] },
      knowledgeClass: { $ref: "#/components/schemas/Wissensklasse" },
      rawKnowledgeClass: { $ref: "#/components/schemas/Wissensklasse" },
      checkCaveat: {
        type: ["object", "null"],
        required: ["reason", "unproven", "total"],
        properties: {
          reason: {
            type: "string",
            enum: ["unknown", "unchecked", "noCoverage", "incomplete", "unattributed"],
          },
          unproven: GANZZAHL,
          total: GANZZAHL,
        },
      },
      sourcesConflicted: { type: "boolean" },
      conflictsUnproven: { type: "boolean" },
    },
  },
  Textpruefung: {
    type: "object",
    required: ["text"],
    properties: {
      text: { type: "string", minLength: 40, maxLength: 8000 },
      title: { type: "string" },
      locale: { type: "string", enum: ["de", "en"] },
    },
  },
  Fundort: {
    type: "object",
    required: ["kategorie", "bereich", "bibliothekPfad"],
    properties: {
      kategorie: NULLBAR_TEXT,
      bereich: NULLBAR_TEXT,
      bibliothekPfad: { type: "string" },
    },
  },
  Pruefergebnis: {
    type: "object",
    required: [
      "duplicates",
      "conflicts",
      "konfliktpruefung",
      "answer",
      "note",
      "persisted",
      "sourceHits",
      "sourceHitsTruncated",
      "quellenfund",
    ],
    properties: {
      duplicates: {
        type: "array",
        items: {
          type: "object",
          required: [
            "koId",
            "koTitle",
            "relation",
            "confidence",
            "method",
            "pruefstand",
            "fundort",
          ],
          properties: {
            koId: { type: "string" },
            koTitle: { type: "string" },
            relation: {
              type: "string",
              enum: ["identisch", "a_enthaelt_b", "b_enthaelt_a", "teilweise", "verwandt"],
            },
            confidence: { type: ["number", "null"] },
            method: { type: "string", enum: ["model", "deterministic"] },
            rationale: NULLBAR_TEXT,
            pruefstand: { type: ["string", "null"], enum: ["validiert", "eingereicht", null] },
            version: { type: ["integer", "null"] },
            fundort: { $ref: "#/components/schemas/Fundort" },
          },
        },
      },
      conflicts: {
        type: "array",
        items: {
          type: "object",
          required: ["koId", "koTitle", "type", "confidence", "method", "pruefstand", "fundort"],
          properties: {
            koId: { type: "string" },
            koTitle: { type: "string" },
            type: {
              type: "string",
              enum: ["truth", "experience", "context", "temporal", "role"],
            },
            confidence: { type: ["number", "null"] },
            method: { type: "string", enum: ["model"] },
            rationale: NULLBAR_TEXT,
            pruefstand: { type: ["string", "null"], enum: ["validiert", "eingereicht", null] },
            fundort: { $ref: "#/components/schemas/Fundort" },
          },
        },
      },
      konfliktpruefung: {
        type: "object",
        required: ["gelaufen", "grund", "kandidaten", "ausgefallen", "verworfen"],
        properties: {
          gelaufen: { type: "boolean" },
          grund: {
            type: ["string", "null"],
            enum: [
              "nicht_angefordert",
              "vertraulich",
              "kein_konfliktdienst",
              "kein_modell",
              "modellfehler",
              "urteil_verworfen",
              null,
            ],
          },
          kandidaten: GANZZAHL,
          ausgefallen: GANZZAHL,
          verworfen: GANZZAHL,
        },
      },
      answer: { type: "null" },
      note: NULLBAR_TEXT,
      persisted: { const: false },
      sourceHits: {
        type: "array",
        items: {
          type: "object",
          required: [
            "refId",
            "koTitle",
            "coverage",
            "gedeckteZeichen",
            "passageZeichen",
            "fundstelle",
          ],
          properties: {
            refId: { type: "string" },
            koTitle: { type: "string" },
            coverage: { type: "string", enum: ["full", "partial"] },
            gedeckteZeichen: GANZZAHL,
            passageZeichen: GANZZAHL,
            fundstelle: { type: "string" },
            fundort: { $ref: "#/components/schemas/Fundort" },
          },
        },
      },
      sourceHitsTruncated: { type: "boolean" },
      quellenfund: {
        type: "object",
        required: ["gelaufen", "grund", "geprueft"],
        properties: {
          gelaufen: { type: "boolean" },
          grund: {
            type: ["string", "null"],
            enum: ["passage_zu_kurz", "suche_nicht_verfuegbar", null],
          },
          geprueft: GANZZAHL,
        },
      },
    },
  },
  Wissensobjekt: {
    type: "object",
    required: ["id", "title", "statement", "type", "category", "status", "version"],
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      statement: { type: "string" },
      type: { $ref: "#/components/schemas/Wissensart" },
      category: { type: "string" },
      status: { type: "string", enum: ["validiert"] },
      version: { type: "integer", minimum: 1 },
      confidentiality: { type: "string", enum: ["intern"] },
      conditions: { type: "array", items: { type: "string" } },
      measures: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      trust: { type: "number" },
    },
  },
  Einlieferung: {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "statement", "type", "category"],
          properties: {
            title: { type: "string" },
            statement: { type: "string" },
            type: { $ref: "#/components/schemas/Wissensart" },
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            confidentiality: { $ref: "#/components/schemas/Vertraulichkeit" },
            externalId: { type: "string" },
            sourceScope: { type: "string" },
            sourceVersion: { type: "integer", minimum: 0 },
          },
        },
      },
    },
  },
  Kandidatenliste: {
    type: "array",
    items: {
      type: "object",
      required: ["id", "item", "status", "duplicate", "note", "koId", "createdAt"],
      properties: {
        id: { type: "string" },
        item: { type: "object" },
        status: {
          type: "string",
          enum: ["neu", "in_bearbeitung", "angenommen", "abgelehnt", "info-angefragt"],
        },
        duplicate: { type: "boolean" },
        note: NULLBAR_TEXT,
        koId: NULLBAR_TEXT,
        createdAt: { type: "string", format: "date-time" },
        dublettenbefund: {
          type: "object",
          required: ["ergebnis"],
          properties: {
            ergebnis: {
              type: "string",
              enum: [
                "keine",
                "identisch",
                "aehnlich",
                "pruefung_nicht_moeglich",
                "nicht_gestellt",
                "im_papierkorb",
                "wiederverwendet",
              ],
            },
            aehnlichkeit: { type: "number" },
            treffer: {
              oneOf: [
                {
                  type: "object",
                  required: ["art", "koId"],
                  properties: { art: { const: "wissensobjekt" }, koId: { type: "string" } },
                },
                {
                  type: "object",
                  required: ["art", "kandidatId"],
                  properties: { art: { const: "kandidat" }, kandidatId: { type: "string" } },
                },
              ],
            },
          },
        },
      },
    },
  },
  KiZustand: {
    type: "object",
    required: ["active", "mode", "reachable", "tasks", "billable", "kiAbgeschaltet"],
    properties: {
      active: { type: "boolean" },
      mode: { type: "string", enum: ["cloud", "local", "deterministic"] },
      reachable: { type: "string", enum: ["none", "unverified", "active", "unreachable"] },
      tasks: { type: "object", additionalProperties: { type: "boolean" } },
      billable: { type: "object", additionalProperties: { type: "boolean" } },
      kiAbgeschaltet: { type: "boolean" },
    },
  },
  Betriebszustand: {
    type: "object",
    required: ["status", "version", "commit", "ai", "aiRuns"],
    properties: {
      status: { const: "ok" },
      version: { type: "string" },
      commit: { type: "string" },
      ai: { $ref: "#/components/schemas/KiZustand" },
      aiRuns: {
        type: "object",
        required: ["available", "recent"],
        properties: {
          available: { type: "boolean" },
          recent: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
  // R-0713 — die Nachrichten des MCP-Zugangs (`routes/mcp-routes.ts`).
  McpNachricht: {
    type: "object",
    required: ["jsonrpc"],
    properties: {
      jsonrpc: { const: "2.0" },
      id: { type: ["string", "integer"] },
      method: {
        type: "string",
        description: "initialize, ping, tools/list, tools/call; Benachrichtigungen ohne id.",
      },
      params: { type: "object" },
    },
  },
  McpAntwort: {
    type: "object",
    required: ["jsonrpc", "id"],
    properties: {
      jsonrpc: { const: "2.0" },
      id: { type: ["string", "integer", "null"] },
      result: { type: "object" },
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "integer", enum: [-32600, -32601, -32602] },
          message: { type: "string" },
        },
      },
    },
    oneOf: [
      { title: "Ergebnis", required: ["result"] },
      { title: "JSON-RPC-Fehler", required: ["error"] },
    ],
  },
};

const ANFRAGE_SCHEMAS: Readonly<Record<string, string>> = {
  "POST /api/ask": "Frage",
  "POST /api/check-text": "Textpruefung",
  "POST /api/library/import/candidates": "Einlieferung",
  "POST /mcp": "McpNachricht",
};

const ref = (name: string): { $ref: string } => ({ $ref: `#/components/schemas/${name}` });
const TEXT = { schema: { type: "string" } };

/** Die vier gemeinsamen Fehlerantworten als wiederverwendbare `components.responses`. */
const GEMEINSAME_ANTWORTNAMEN: Readonly<Record<number, string>> = {
  401: "NichtAngemeldet",
  403: "RechtFehlt",
  429: "Gebremst",
  500: "Intern",
};

function beschreibung(z: Antwortzustand): string {
  return z.fehler ? `${z.fehler}: ${z.bedeutung}` : z.bedeutung;
}

function erfolgsinhalt(erfolg: Vertragsroute["erfolg"]): Record<string, unknown> {
  if (erfolg === "export") {
    return {
      "application/json": { schema: { type: "array", items: ref("Wissensobjekt") } },
      "text/markdown": TEXT,
      "text/plain": TEXT,
      "text/html": TEXT,
    };
  }
  return { "application/json": { schema: ref(erfolg) } };
}

function antwortAus(zustaende: readonly Antwortzustand[], erfolg: Vertragsroute["erfolg"]) {
  const erste = zustaende[0];
  const status = erste?.status ?? 0;
  const fehler = zustaende.flatMap((z) => (z.fehler ? [z.fehler] : []));
  const mitWartezeit = zustaende.some((z) => z.kopf?.includes("retry-after"));
  const ohneRumpf = zustaende.every((z) => z.ohneRumpf);
  // Die Fehlerkennung(en) dieses Status — genau die aus der Tabelle, keine andere.
  const kennung = fehler.length === 1 ? { const: fehler[0] } : { enum: fehler };
  const fehlerSchema = { allOf: [ref("Fehler"), { properties: { error: kennung } }] };
  const content =
    status >= 400 ? { "application/json": { schema: fehlerSchema } } : erfolgsinhalt(erfolg);
  return {
    description: zustaende.map(beschreibung).join(" | "),
    ...(mitWartezeit
      ? { headers: { "Retry-After": { schema: { type: "integer", minimum: 1 } } } }
      : {}),
    ...(ohneRumpf ? {} : { content }),
  };
}

function antwortenFuer(route: Vertragsroute): Record<string, unknown> {
  const nachStatus = new Map<number, Antwortzustand[]>();
  for (const z of route.zustaende) {
    nachStatus.set(z.status, [...(nachStatus.get(z.status) ?? []), z]);
  }
  const antworten: Record<string, unknown> = {};
  const alle = [...nachStatus.keys(), ...GEMEINSAME_ZUSTAENDE.map((z) => z.status)];
  for (const status of alle.sort((a, b) => a - b)) {
    const gemeinsam = GEMEINSAME_ANTWORTNAMEN[status];
    antworten[String(status)] = gemeinsam
      ? { $ref: `#/components/responses/${gemeinsam}` }
      : antwortAus(nachStatus.get(status) ?? [], route.erfolg);
  }
  return antworten;
}

export function integrationsOpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of INTEGRATIONS_VERTRAG) {
    const anfrage = ANFRAGE_SCHEMAS[`${route.methode} ${route.pfad}`];
    const rumpf = anfrage ? { "application/json": { schema: ref(anfrage) } } : undefined;
    const operation: Record<string, unknown> = {
      summary: route.zweck,
      "x-klarwerk-recht": route.recht,
      security: [{ dienstSchluessel: [] }],
      ...(route.pfad === "/api/library/export"
        ? {
            parameters: [
              {
                name: "format",
                in: "query",
                required: false,
                schema: { type: "string", enum: ["json", "markdown", "mediawiki", "html"] },
              },
            ],
          }
        : {}),
      ...(rumpf ? { requestBody: { required: true, content: rumpf } } : {}),
      responses: antwortenFuer(route),
    };
    paths[route.pfad] = { ...(paths[route.pfad] ?? {}), [route.methode.toLowerCase()]: operation };
  }
  const responses: Record<string, unknown> = {};
  for (const z of GEMEINSAME_ZUSTAENDE) {
    const name = GEMEINSAME_ANTWORTNAMEN[z.status];
    if (name) {
      responses[name] = antwortAus([z], "Antwort");
    }
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "KLARWERK Integrationsschnittstelle",
      version: VERTRAGSFASSUNG,
      description:
        "Anmeldung mit Dienst-Schlüssel im Kopf x-klarwerk-service-key. Jeder Schlüssel hat eigene Rechte und eine eigene Anfragegrenze. Antworten aus Wissen stammen ausschließlich aus validiertem Wissen. Zustandstabelle: docs/architektur/integrations-schnittstelle.md.",
    },
    paths,
    components: {
      securitySchemes: {
        dienstSchluessel: { type: "apiKey", in: "header", name: DIENST_SCHLUESSEL_HEADER },
      },
      responses,
      schemas: SCHEMAS,
    },
  };
}

/** Jede Vertragsroute ist eine Dienst-Route mit demselben Recht — und umgekehrt. */
export function vertragUndRoutenGleich(): boolean {
  const a = INTEGRATIONS_VERTRAG.map((r) => `${r.methode} ${r.pfad} ${r.recht}`).sort();
  const b = DIENST_ROUTEN.map((r) => `${r.methode} ${r.pfad} ${r.recht}`).sort();
  return JSON.stringify(a) === JSON.stringify(b);
}
