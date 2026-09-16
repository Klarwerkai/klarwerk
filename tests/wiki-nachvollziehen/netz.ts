// ================================================================================================
// JOB 4213 · DER BESTAND UND DAS NETZ-DOPPEL DER GEMOUNTETEN FÄLLE.
// ================================================================================================
//
// WARUM DIESE DATEI VON `flaeche.tsx` GETRENNT IST (dieselbe Begründung wie in
// `tests/ux28-fassungen/netz.ts`): die `vi.mock`-Fabrik der Testdateien holt ihr Doppel hier. Läge
// es in `flaeche.tsx`, importierte die Fabrik über diese Datei den halben Produktbaum — samt
// `api/endpoints`, also genau des Moduls, das sie ersetzen soll.
//
// DIE EINE AUSNAHME, und sie ist nötig: `ApiError` kommt aus `api/client`. Die Fläche erkennt den
// Konflikt an `e instanceof ApiError` (`MehrAbschnitte.tsx`), und ein nachgebauter Fehler mit
// denselben Feldern wäre eine ANDERE Klasse — der Konfliktzweig liefe dann nie. `api/client` zieht
// `api/endpoints` nicht nach sich; die Fabrik bleibt also frei von dem Modul, das sie ersetzt.
import { ApiError } from "../../apps/web/src/api/client";
import type { KnowledgeObject, KoVersionSnapshot } from "../../apps/web/src/api/types";
// RUNDE 4 · DER ROLLENTYP KOMMT AUS DER EINEN QUELLE, statt hier abgeschrieben zu werden.
//
// Runde 3 führte ihn als Literalvereinigung `"admin" | "experte" | "viewer"` — es fehlte
// `controller`, und der Rollenfall von `uebernahme-folgt-dem-schreibrecht.test.tsx` liess sich nicht
// übersetzen (`tools/build`, TS2322). Eine abgeschriebene Rollenliste im Prüfstand ist dieselbe
// zweite Wahrheit, gegen die der Test selbst antritt; wer künftig eine Rolle hinzufügt, bekommt sie
// hier von allein.
//
// `import type` ERZEUGT KEIN MODUL ZUR LAUFZEIT — die `vi.mock`-Fabrik, die diese Datei lädt, zieht
// darüber also nichts in den Prüfstand (derselbe Grund, aus dem der Kopf oben nur Typen importiert).
import type { Role } from "../../services/auth";

export const BERICHT_V1_TEXT = "Fruehere Anweisung: trocken abkehren";
export const BERICHT_V1 = `<p>${BERICHT_V1_TEXT}</p>`;
export const BERICHT_V3_TEXT = "Aktuelle Anweisung: nass reinigen und Dichtungen pruefen";
export const BERICHT_V3 = `<p>${BERICHT_V3_TEXT}</p>`;

/** Was die Fläche vorfindet — je Fall vor dem Aufbau gesetzt. */
export const netz: {
  fassungen: KoVersionSnapshot[];
  rolle: Role;
  /** Die Aufrufe an `ko.act`, in der Reihenfolge, in der die Fläche sie abgeschickt hat. */
  aufrufe: unknown[];
  /** Ist er gesetzt, wirft `ko.act` ihn — die Antwort des Servers auf einen Schreibversuch. */
  actFehler: ApiError | null;
} = { fassungen: [], rolle: "admin", aufrufe: [], actFehler: null };

export function zuruecksetzen(): void {
  netz.fassungen = [];
  netz.rolle = "admin";
  netz.aufrufe = [];
  netz.actFehler = null;
}

export function konfliktFehler(): ApiError {
  return new ApiError(
    409,
    "KO_STALE",
    "Das Wissensobjekt wurde inzwischen geändert (jetzt Version 4, erwartet 3). Es wurde nichts überschrieben.",
  );
}

/** Der aktuelle Stand: Version 3, freigegeben — v1 und v2 liegen als Fassungen darunter. */
export function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Nach jeder Schicht nass reinigen und die Dichtungen pruefen.",
    bodyHtml: BERICHT_V3,
    conditions: ["Anlage steht"],
    measures: ["Nassreinigung", "Dichtungspruefung"],
    type: "technik",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 3,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    history: [
      { version: 1, at: "2026-08-01T10:00:00.000Z", author: "u1", note: "erstellt" },
      { version: 2, at: "2026-08-02T10:00:00.000Z", author: "u1", note: "überarbeitet" },
      { version: 3, at: "2026-08-03T10:00:00.000Z", author: "u1", note: "überarbeitet" },
    ],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
    ...overrides,
  } as KnowledgeObject;
}

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

/**
 * DREI FASSUNGEN, in denen sich JEDE Nachbarin in einem ANDEREN Feld unterscheidet — nur so trennt
 * sich der freie Vergleich (v1 gegen v3) vom Vorgängervergleich (v2 gegen v3).
 */
export function dreiFassungen(): KoVersionSnapshot[] {
  return [
    fassung(1, {
      statement: "Nur trocken abkehren.",
      measures: ["Trockenreinigung"],
      bodyHtml: BERICHT_V1,
      status: "validiert",
    }),
    fassung(2, {
      statement: "Nach jeder Schicht nass reinigen.",
      measures: ["Trockenreinigung"],
      bodyHtml: BERICHT_V1,
      status: "validiert",
    }),
    fassung(3, {
      statement: "Nach jeder Schicht nass reinigen und die Dichtungen pruefen.",
      measures: ["Nassreinigung", "Dichtungspruefung"],
      bodyHtml: BERICHT_V3,
      status: "validiert",
    }),
  ];
}

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
        act: async (_id: string, body: unknown) => {
          netz.aufrufe.push(body);
          if (netz.actFehler) {
            throw netz.actFehler;
          }
          return ko();
        },
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

export function authDoppel(): Record<string, unknown> {
  return {
    authApi: {
      status: async () => ({ needsSetup: false, oidcEnabled: false }),
      me: async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: netz.rolle }),
      logout: async () => ({}),
    },
  };
}
