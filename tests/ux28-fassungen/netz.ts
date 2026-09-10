// ================================================================================================
// JOB 3475 · UX-28 — DER BESTAND UND DAS NETZ-DOPPEL, OHNE EINEN EINZIGEN PRODUKTIMPORT.
// ================================================================================================
//
// WARUM DIESE DATEI VON `flaeche.tsx` GETRENNT IST: die `vi.mock`-Fabrik der drei Testdateien holt
// ihr Doppel hier. Läge es in `flaeche.tsx`, importierte die Fabrik über diese Datei den halben
// Produktbaum — einschließlich `api/endpoints`, also genau des Moduls, das sie ersetzen soll. Diese
// Datei importiert deshalb NUR Typen (`import type` erzeugt kein Modul zur Laufzeit).
import type { KnowledgeObject, KoVersionSnapshot } from "../../apps/web/src/api/types";

/** Der Bericht, den es NUR in der alten Fassung gibt — die Gegenprobe gegen Rekonstruktion. */
export const BERICHT_V1_TEXT = "Fruehere Anweisung: Spuelgang mit 60 Grad";
export const BERICHT_V1 = `<p>${BERICHT_V1_TEXT}</p>`;
export const BERICHT_V2_TEXT = "Aktuelle Anweisung: Spuelgang mit 80 Grad und Dichtungspruefung";
export const BERICHT_V2 = `<p>${BERICHT_V2_TEXT}</p>`;

/** Der Bestand, den das Netz-Doppel ausliefert. Wird je Fall vor dem Aufbau gesetzt. */
export const netz = { fassungen: [] as KoVersionSnapshot[] };

/** Der aktuelle Stand des Wissensobjekts — die Fassung, die NICHT historisch ist. */
export function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml: BERICHT_V2,
    conditions: ["Anlage steht"],
    measures: ["Nassreinigung"],
    type: "technik",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 2,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
    ...overrides,
  } as KnowledgeObject;
}

/** Eine gespeicherte Fassung. `bodyHtml: null` steht für „kein Bericht gespeichert". */
export function fassung(
  version: number,
  overrides: Partial<KnowledgeObject> = {},
): KoVersionSnapshot {
  return {
    koId: "ko-1",
    version,
    at: `2026-08-0${version}T10:00:00.000Z`,
    author: "u1",
    note: version === 1 ? "erstellt" : "überarbeitet",
    snapshot: ko({ version, ...overrides }),
  };
}

/** Die zwei Fassungen des Regelfalls: v1 mit dem alten, v2 mit dem aktuellen Bericht. */
export function zweiFassungen(): KoVersionSnapshot[] {
  return [fassung(1, { bodyHtml: BERICHT_V1 }), fassung(2, { bodyHtml: BERICHT_V2 })];
}

/**
 * Das Netz-Doppel für `api/endpoints` — gerufen aus der `vi.mock`-Fabrik der Testdatei. Alle Kanäle
 * antworten leer bis auf die Fassungen; nur um sie geht es hier.
 */
export function endpointsDoppel(): Record<string, unknown> {
  const leer = async (): Promise<unknown[]> => [];
  return {
    endpoints: {
      ko: {
        get: async () => ko(),
        list: async () => [ko()],
        evidence: leer,
        versions: async () => [...netz.fassungen],
        neighbors: async () => ({ center: "ko-1", neighbors: [], excludedTags: [], limit: 8 }),
        act: async () => ko(),
      },
      library: { search: leer },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: async () => [{ id: "u1", name: "Eva" }] },
      lifecycle: { pending: leer, linked: leer, couplingsFor: leer },
      external: { policy: async () => ({ stage: "blocked", enabled: false }) },
      uploadLimits: { get: async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 }) },
      reasoner: {
        status: async () => ({ active: false, mode: "off" }),
        config: async () => ({}),
        assist: async () => ({ text: "" }),
        assistPresets: leer,
        extract: async () => ({ points: [], note: null }),
        describeImage: async () => ({}),
      },
      aiCheck: { coverageSummary: async () => ({ total: 0 }) },
    },
  };
}

/** Das Anmelde-Doppel — dieselbe Form wie in `tests/q1c-nachladen`. */
export function authDoppel(): Record<string, unknown> {
  return {
    authApi: {
      status: async () => ({ needsSetup: false, oidcEnabled: false }),
      me: async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" }),
      logout: async () => ({}),
    },
  };
}
