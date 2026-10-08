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
// R-0712: aus derselben Tabelle entsteht die maschinenlesbare Beschreibung (OpenAPI 3.1,
// `integrationsOpenApi()`). Die ausgelieferte Datei `docs/generated/integrations-openapi.json`
// muss ihr gleich sein — gehalten vom selben Testordner. Die menschenlesbare Fassung steht in
// `docs/architektur/integrations-schnittstelle.md`.

export const VERTRAGSFASSUNG = "1.0.0";

export interface Antwortzustand {
  readonly status: number;
  /**
   * Der Wert des Felds `error` im Antwortkörper. Fehlt bei Erfolgsantworten. Für die Standardfehler
   * des HTTP-Rahmens (Schema, Größe, Inhaltstyp) steht dort die HTTP-Kurzbezeichnung, dazu `code`.
   */
  readonly fehler?: string;
  readonly bedeutung: string;
  /** Kopfzeilen, die in diesem Zustand verbindlich mitkommen. */
  readonly kopf?: readonly string[];
}

export interface Vertragsroute {
  readonly methode: "GET" | "POST";
  readonly pfad: string;
  readonly recht: DienstRecht;
  readonly zweck: string;
  /** Form des Erfolgskörpers: ein Objekt, eine Liste oder der Export in seinen vier Formaten. */
  readonly erfolg: "objekt" | "liste" | "export";
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
    erfolg: "objekt",
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
    erfolg: "objekt",
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
    erfolg: "liste",
    zustaende: [
      {
        status: 201,
        bedeutung: "Eingereiht; die Antwort nennt die Kandidaten samt Dublettenbefund.",
      },
      {
        status: 400,
        bedeutung:
          "Einträge unbrauchbar; error nennt den fachlichen Grund (Großbuchstaben-Kennung), message den Satz.",
      },
      SCHEMAFEHLER,
      FALSCHER_INHALTSTYP,
    ],
  },
  {
    methode: "GET",
    pfad: "/health",
    recht: "status.read",
    zweck: "Betriebszustand: status, Version und Deploy-Stand der Instanz.",
    erfolg: "objekt",
    zustaende: [{ status: 200, bedeutung: "Instanz antwortet (status = ok)." }],
  },
  {
    methode: "GET",
    pfad: "/api/reasoner/status",
    recht: "status.read",
    zweck: "Abstrakter KI-Zustand (aktiv/Modus), ohne Anbieter- oder Modellnamen.",
    erfolg: "objekt",
    zustaende: [{ status: 200, bedeutung: "Aktueller KI-Zustand." }],
  },
];

/** Alle erlaubten Zustände einer Route: ihre eigenen und die gemeinsamen. */
export function erlaubteZustaende(methode: string, pfad: string): readonly Antwortzustand[] {
  const route = INTEGRATIONS_VERTRAG.find((r) => r.methode === methode && r.pfad === pfad);
  return route ? [...route.zustaende, ...GEMEINSAME_ZUSTAENDE] : GEMEINSAME_ZUSTAENDE;
}

/** Steht dieses Paar aus Status und `error` in der Tabelle der Route? */
export function zustandErlaubt(
  methode: string,
  pfad: string,
  status: number,
  fehler: string | undefined,
): boolean {
  return erlaubteZustaende(methode, pfad).some(
    (z) => z.status === status && (z.fehler === undefined || z.fehler === fehler),
  );
}

// ------------------------------------------------------------------------------------------------
// R-0712 — OpenAPI 3.1 aus derselben Tabelle.
// ------------------------------------------------------------------------------------------------

const ANFRAGE_SCHEMAS: Readonly<Record<string, unknown>> = {
  "POST /api/ask": {
    type: "object",
    properties: {
      question: { type: "string", maxLength: 8000 },
      locale: { type: "string", enum: ["de", "en", "nl"] },
    },
  },
  "POST /api/check-text": {
    type: "object",
    required: ["text"],
    properties: {
      text: { type: "string", minLength: 40, maxLength: 8000 },
      title: { type: "string" },
      locale: { type: "string", enum: ["de", "en"] },
    },
  },
  "POST /api/library/import/candidates": {
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
            type: { type: "string" },
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            confidentiality: { type: "string" },
            externalId: { type: "string" },
            sourceScope: { type: "string" },
          },
        },
      },
    },
  },
};

const LISTE = { type: "array", items: { type: "object" } };
const TEXT = { schema: { type: "string" } };

function erfolgsinhalt(erfolg: Vertragsroute["erfolg"]): Record<string, unknown> {
  if (erfolg === "export") {
    return {
      "application/json": { schema: LISTE },
      "text/markdown": TEXT,
      "text/plain": TEXT,
      "text/html": TEXT,
    };
  }
  return { "application/json": { schema: erfolg === "liste" ? LISTE : { type: "object" } } };
}

function antwortAus(z: Antwortzustand, erfolg: Vertragsroute["erfolg"]): Record<string, unknown> {
  const beschreibung = z.fehler ? `${z.fehler}: ${z.bedeutung}` : z.bedeutung;
  return {
    description: beschreibung,
    ...(z.kopf?.includes("retry-after")
      ? { headers: { "Retry-After": { schema: { type: "integer", minimum: 1 } } } }
      : {}),
    content:
      z.status >= 400
        ? { "application/json": { schema: { $ref: "#/components/schemas/Fehler" } } }
        : erfolgsinhalt(erfolg),
  };
}

function antwortenFuer(route: Vertragsroute): Record<string, unknown> {
  const nachStatus = new Map<number, Antwortzustand[]>();
  for (const z of [...route.zustaende, ...GEMEINSAME_ZUSTAENDE]) {
    nachStatus.set(z.status, [...(nachStatus.get(z.status) ?? []), z]);
  }
  const antworten: Record<string, unknown> = {};
  for (const status of [...nachStatus.keys()].sort((a, b) => a - b)) {
    const zustaende = nachStatus.get(status) ?? [];
    const erste = zustaende[0];
    if (!erste) {
      continue;
    }
    const kopf = zustaende.flatMap((z) => z.kopf ?? []);
    const zusammen: Antwortzustand =
      zustaende.length === 1
        ? erste
        : {
            status,
            bedeutung: zustaende
              .map((z) => (z.fehler ? `${z.fehler}: ${z.bedeutung}` : z.bedeutung))
              .join(" | "),
            ...(kopf.length > 0 ? { kopf } : {}),
          };
    antworten[String(status)] = antwortAus(zusammen, route.erfolg);
  }
  return antworten;
}

export function integrationsOpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of INTEGRATIONS_VERTRAG) {
    const schluessel = `${route.methode} ${route.pfad}`;
    const anfrage = ANFRAGE_SCHEMAS[schluessel];
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
      ...(anfrage
        ? { requestBody: { required: true, content: { "application/json": { schema: anfrage } } } }
        : {}),
      responses: antwortenFuer(route),
    };
    paths[route.pfad] = { ...(paths[route.pfad] ?? {}), [route.methode.toLowerCase()]: operation };
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
      schemas: {
        Fehler: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string" },
            message: { type: "string" },
            code: { type: "string" },
            wartenSek: { type: "integer", minimum: 1 },
          },
        },
      },
    },
  };
}

/** Jede Vertragsroute ist eine Dienst-Route mit demselben Recht — und umgekehrt. */
export function vertragUndRoutenGleich(): boolean {
  const a = INTEGRATIONS_VERTRAG.map((r) => `${r.methode} ${r.pfad} ${r.recht}`).sort();
  const b = DIENST_ROUTEN.map((r) => `${r.methode} ${r.pfad} ${r.recht}`).sort();
  return JSON.stringify(a) === JSON.stringify(b);
}
