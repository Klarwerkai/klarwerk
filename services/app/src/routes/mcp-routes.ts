// ================================================================================================
// Aufnahme gesamt-mcp (R-0713) — KLARA ALS WERKZEUG IN FREMDEN KI-PROGRAMMEN (MCP-SERVER).
// ================================================================================================
//
// R-0713: „Klara meldet sich als Werkzeug bei fremden KI-Programmen wie ChatGPT, Claude, Copilot oder
// Cursor an. Dort liefert sie nur validiertes Wissen mit Beleg und unter Beachtung der Rechte."
//
// TRANSPORT: Model Context Protocol, „Streamable HTTP" in der zustandslosen Form — `POST /mcp` nimmt
// genau eine JSON-RPC-2.0-Nachricht und antwortet mit `application/json`. Kein Ereignisstrom, keine
// Sitzungskennung: `GET /mcp` antwortet 405, wie es das Protokoll für Server ohne Strom vorsieht.
//
// AUFLAGE AUS DER QUELLE (Landkarte v3 G2, PPLX2): „kein externer Kanal vor Berechtigungsvertrag".
// Der Kanal hängt deshalb vollständig an der Integrationsschnittstelle mit Dienst-Schlüsseln
// (`dienst-schluessel.ts`, `integrations-vertrag.ts`) und öffnet nichts Eigenes:
//   · ANMELDUNG nur mit Dienst-Schlüssel im Kopf `x-klarwerk-service-key`. Keine Sitzung, kein
//     Klara-Schlüssel, kein Browseraufruf (eine Anfrage mit `Origin` wird abgewiesen).
//   · EIGENES RECHT `mcp.werkzeug`: ohne es ist `/mcp` für den Schlüssel 403. Ein Schlüssel, der
//     heute schon fragen darf, wird dadurch NICHT stillschweigend zum KI-Werkzeug.
//   · JEDES WERKZEUG zusätzlich an das Recht seiner Route gebunden: `klara_fragen` erscheint in
//     `tools/list` nur mit `ask.validated` und ist ohne es ein unbekanntes Werkzeug.
//   · DIE FRAGE SELBST läuft unverändert über `POST /api/ask` mit DEMSELBEN Schlüssel (interne
//     Weiterleitung, kein Netz). Dort gilt der enge Dienst-Schlüssel-Zweig: nur validiertes, nicht
//     vertrauliches Wissen, kein Modell, nur Inhalt ohne Space oder aus offenen Spaces, die
//     Abschaltung der Fragefunktion. Hier steht keine zweite Auslegung dieser Regeln.
//   · BELEG: die Antwort nennt ihre Wissensobjekte mit Kennung und Fundstelle und ihre Einstufung;
//     ohne validiertes Wissen sagt sie das, statt etwas zu erfinden.
//
// GRENZE: Hülle und Weiterleitung zählen beide gegen die Grenze des Schlüssels — ein
// Werkzeugaufruf kostet zwei Aufrufe (`docs/architektur/integrations-schnittstelle.md` §6).
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { DIENST_SCHLUESSEL_HEADER } from "../dienst-schluessel";

export const MCP_PFAD = "/mcp";

/** Unterstützte Protokollfassungen, neueste zuerst. */
export const MCP_PROTOKOLLE = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

const MCP_BODY_LIMIT = 128 * 1024; // wie POST /api/ask
const FRAGE_MAX = 8000; // wie das Frage-Schema von POST /api/ask

export type McpWeiterleitung = (anfrage: {
  method: "POST";
  url: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
}) => Promise<{ statusCode: number; json(): unknown }>;

export interface McpRouteDienste {
  /** Interne Weiterleitung an die bestehende Route (in `build-app.ts`: `app.inject`). */
  weiterleiten: McpWeiterleitung;
  /** Produktfassung für `serverInfo.version`. */
  version: string;
}

type JsonRpcId = string | number;
type Sprache = "de" | "en" | "nl";

interface Werkzeug {
  readonly name: string;
  readonly recht: "ask.validated";
  readonly beschreibung: Record<string, unknown>;
}

export const MCP_WERKZEUGE: readonly Werkzeug[] = [
  {
    name: "klara_fragen",
    recht: "ask.validated",
    beschreibung: {
      name: "klara_fragen",
      title: "KLARWERK fragen (nur validiertes Wissen)",
      description:
        "Stellt eine Frage an das validierte Firmenwissen in KLARWERK. Die Antwort stammt ausschließlich aus geprüften, nicht vertraulichen Wissensobjekten und nennt jedes als Beleg (Kennung und Fundstelle). Gibt es kein validiertes Wissen dazu, sagt Klara das — sie erfindet nichts und ruft kein Sprachmodell auf.",
      inputSchema: {
        type: "object",
        properties: {
          question: {
            type: "string",
            minLength: 1,
            maxLength: FRAGE_MAX,
            description: "Die Frage in natürlicher Sprache.",
          },
          locale: {
            type: "string",
            enum: ["de", "en", "nl"],
            description: "Sprache der Frage (Standard: de).",
          },
        },
        required: ["question"],
        additionalProperties: false,
      },
      annotations: {
        title: "KLARWERK fragen (nur validiertes Wissen)",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  },
];

/** Die Werkzeuge, die ein Schlüssel mit diesen Rechten sieht und aufrufen darf. */
export function werkzeugeFuer(rechte: readonly string[]): readonly Werkzeug[] {
  return MCP_WERKZEUGE.filter((w) => rechte.includes(w.recht));
}

/** Protokollfassung: die angefragte, wenn unterstützt — sonst die neueste unterstützte. */
export function protokollFuer(angefragt: unknown): string {
  if (typeof angefragt === "string" && (MCP_PROTOKOLLE as readonly string[]).includes(angefragt)) {
    return angefragt;
  }
  return MCP_PROTOKOLLE[0];
}

function spracheVon(wert: unknown): Sprache {
  return wert === "en" ? "en" : wert === "nl" ? "nl" : "de";
}

// ------------------------------------------------------------------------------------------------
// Antwort von POST /api/ask → Werkzeugergebnis mit Beleg.
// ------------------------------------------------------------------------------------------------

interface AskErgebnis {
  answered?: boolean;
  answer?: string | null;
  knowledgeClass?: string;
  trust?: number;
  sources?: string[];
  citedSources?: string[];
  steps?: { sourceId?: string | null; snippet?: string | null }[];
  evidence?: { grade?: string; checkCaveat?: { reason?: string } | null } | null;
}

export interface McpBeleg {
  wissensobjekt: string;
  fundstelle: string | null;
}

export interface WerkzeugErgebnis {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError: boolean;
}

const TEXTE = {
  de: {
    belege: "Belege (validiertes Wissen in KLARWERK):",
    einstufung: "Einstufung",
    luecke:
      "Zu dieser Frage gibt es in KLARWERK kein validiertes Wissen. Klara erfindet keine Antwort.",
    abgeschaltet: "Die Fragefunktion dieser KLARWERK-Instanz ist abgeschaltet.",
    gebremst: (s: number) => `Grenze des Zugangs erreicht — bitte in ${s} Sekunden erneut fragen.`,
    fehler: (s: number) => `KLARWERK konnte die Frage nicht beantworten (Status ${s}).`,
    leer: "Die Frage fehlt oder ist länger als 8.000 Zeichen.",
  },
  en: {
    belege: "Evidence (validated knowledge in KLARWERK):",
    einstufung: "Grade",
    luecke:
      "KLARWERK holds no validated knowledge on this question. Klara does not invent an answer.",
    abgeschaltet: "The question function of this KLARWERK instance is switched off.",
    gebremst: (s: number) => `Access limit reached — please ask again in ${s} seconds.`,
    fehler: (s: number) => `KLARWERK could not answer the question (status ${s}).`,
    leer: "The question is missing or longer than 8,000 characters.",
  },
} as const;

function texte(sprache: Sprache) {
  return sprache === "de" ? TEXTE.de : TEXTE.en;
}

function textErgebnis(text: string, isError: boolean, strukturiert?: Record<string, unknown>) {
  const ergebnis: WerkzeugErgebnis = { content: [{ type: "text", text }], isError };
  if (strukturiert) {
    ergebnis.structuredContent = strukturiert;
  }
  return ergebnis;
}

/** Baut aus der Antwort von `POST /api/ask` das Werkzeugergebnis — ohne etwas hinzuzufügen. */
export function frageErgebnis(
  statusCode: number,
  koerper: unknown,
  sprache: Sprache,
): WerkzeugErgebnis {
  const t = texte(sprache);
  if (statusCode === 503) {
    return textErgebnis(t.abgeschaltet, true);
  }
  if (statusCode === 429) {
    const warten = Number((koerper as { wartenSek?: unknown } | null)?.wartenSek);
    return textErgebnis(t.gebremst(Number.isFinite(warten) && warten > 0 ? warten : 60), true);
  }
  if (statusCode !== 200) {
    return textErgebnis(t.fehler(statusCode), true);
  }
  const r: AskErgebnis = (koerper as { result?: AskErgebnis } | null)?.result ?? {};
  if (r.answered !== true || typeof r.answer !== "string" || r.answer.trim() === "") {
    return textErgebnis(t.luecke, false, { beantwortet: false, einstufung: "gap" });
  }
  const grad = r.evidence?.grade ?? "unverified";
  const genannt = (r.citedSources?.length ? r.citedSources : r.sources) ?? [];
  const belege: McpBeleg[] = [...new Set(genannt)].map((id) => ({
    wissensobjekt: id,
    fundstelle: r.steps?.find((s) => s.sourceId === id && s.snippet)?.snippet ?? null,
  }));
  const zeilen: string[] = [];
  for (const b of belege) {
    zeilen.push(`- [${b.wissensobjekt}]${b.fundstelle ? ` ${b.fundstelle}` : ""}`);
  }
  const vorbehalt = r.evidence?.checkCaveat?.reason;
  const text = [
    r.answer,
    "",
    t.belege,
    ...zeilen,
    "",
    `${t.einstufung}: ${grad}${vorbehalt ? ` (${vorbehalt})` : ""}`,
  ].join("\n");
  return textErgebnis(text, false, {
    beantwortet: true,
    antwort: r.answer,
    belege,
    einstufung: grad,
    wissensklasse: r.knowledgeClass ?? null,
    vertrauen: typeof r.trust === "number" ? r.trust : null,
  });
}

// ------------------------------------------------------------------------------------------------
// JSON-RPC.
// ------------------------------------------------------------------------------------------------

function rpcErgebnis(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcFehler(id: JsonRpcId | null, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function istId(wert: unknown): wert is JsonRpcId {
  return typeof wert === "string" || (typeof wert === "number" && Number.isInteger(wert));
}

const ANLEITUNG =
  "Klara beantwortet Fragen ausschließlich aus validiertem, nicht vertraulichem KLARWERK-Wissen und nennt dafür die Wissensobjekte als Beleg. Ohne validiertes Wissen meldet sie eine Wissenslücke.";

export function mcpRoutes(dienste: McpRouteDienste): FastifyPluginAsync {
  return async (app) => {
    // Nur ein Dienst-Schlüssel mit `mcp.werkzeug` kommt bis hierher durch (Anmeldehook in
    // `build-app.ts`). Eine Sitzung ohne Schlüssel wird hier abgewiesen, ein Browser ebenso.
    const zugang = (request: FastifyRequest, reply: FastifyReply) => {
      const auth = request.authContext;
      const schluessel = request.headers[DIENST_SCHLUESSEL_HEADER];
      if (auth?.authKind !== "addon" || !auth.principal.dienst || typeof schluessel !== "string") {
        reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "Der MCP-Zugang verlangt einen Dienst-Schlüssel.",
        });
        return null;
      }
      if (request.headers.origin !== undefined) {
        reply.code(403).send({
          error: "FORBIDDEN",
          message: "Der MCP-Zugang nimmt keine Browseraufrufe an.",
        });
        return null;
      }
      return { rechte: auth.principal.capabilities, schluessel };
    };

    app.get(MCP_PFAD, async (request, reply) => {
      if (!zugang(request, reply)) {
        return;
      }
      reply.code(405).header("allow", "POST").send({
        error: "METHOD_NOT_ALLOWED",
        message: "Dieser MCP-Server bietet keinen Ereignisstrom an; Nachrichten nur per POST.",
      });
    });

    const optionen = { bodyLimit: MCP_BODY_LIMIT };
    app.post<{ Body: unknown }>(MCP_PFAD, optionen, async (request, reply) => {
      const z = zugang(request, reply);
      if (!z) {
        return;
      }
      const nachricht = request.body;
      if (Array.isArray(nachricht)) {
        reply.code(200).send(rpcFehler(null, -32600, "Stapelanfragen werden nicht unterstützt."));
        return;
      }
      if (typeof nachricht !== "object" || nachricht === null) {
        reply.code(200).send(rpcFehler(null, -32600, "Keine JSON-RPC-2.0-Nachricht."));
        return;
      }
      const n = nachricht as Record<string, unknown>;
      if (n.jsonrpc !== "2.0") {
        reply.code(200).send(rpcFehler(null, -32600, "Keine JSON-RPC-2.0-Nachricht."));
        return;
      }
      // Benachrichtigung (ohne id) oder Antwort des Clients (ohne method): angenommen, kein Rumpf.
      if (typeof n.method !== "string" || n.id === undefined) {
        reply.code(202).send();
        return;
      }
      if (!istId(n.id)) {
        reply.code(200).send(rpcFehler(null, -32600, "Ungültige Nachrichtenkennung."));
        return;
      }
      const id = n.id;
      const params = (n.params ?? {}) as Record<string, unknown>;
      const erlaubt = werkzeugeFuer(z.rechte);

      if (n.method === "initialize") {
        reply.code(200).send(
          rpcErgebnis(id, {
            protocolVersion: protokollFuer(params.protocolVersion),
            capabilities: { tools: { listChanged: false } },
            serverInfo: {
              name: "klarwerk-klara",
              title: "KLARWERK Klara",
              version: dienste.version,
            },
            instructions: ANLEITUNG,
          }),
        );
        return;
      }
      if (n.method === "ping") {
        reply.code(200).send(rpcErgebnis(id, {}));
        return;
      }
      if (n.method === "tools/list") {
        reply.code(200).send(rpcErgebnis(id, { tools: erlaubt.map((w) => w.beschreibung) }));
        return;
      }
      if (n.method !== "tools/call") {
        reply.code(200).send(rpcFehler(id, -32601, "Unbekannte Methode."));
        return;
      }
      const werkzeug = erlaubt.find((w) => w.name === params.name);
      if (!werkzeug) {
        reply.code(200).send(rpcFehler(id, -32602, "Unbekanntes Werkzeug."));
        return;
      }
      const argumente = (params.arguments ?? {}) as Record<string, unknown>;
      const sprache = spracheVon(argumente.locale);
      const frage = typeof argumente.question === "string" ? argumente.question.trim() : "";
      if (frage === "" || frage.length > FRAGE_MAX) {
        reply.code(200).send(rpcErgebnis(id, textErgebnis(texte(sprache).leer, true)));
        return;
      }
      const antwort = await dienste.weiterleiten({
        method: "POST",
        url: "/api/ask",
        headers: { [DIENST_SCHLUESSEL_HEADER]: z.schluessel, "content-type": "application/json" },
        payload: { question: frage, locale: sprache },
      });
      let koerper: unknown = null;
      try {
        koerper = antwort.json();
      } catch {
        koerper = null;
      }
      const ergebnis = frageErgebnis(antwort.statusCode, koerper, sprache);
      reply.code(200).send(rpcErgebnis(id, ergebnis));
    });
  };
}
