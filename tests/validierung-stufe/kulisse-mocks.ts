// ================================================================================================
// JOB 3112 · V3 — DIE KULISSE DER GEMOUNTETEN PRÜFFLÄCHE, EINMAL GEBAUT.
// ================================================================================================
//
// Diese Datei trägt AUSSCHLIESSLICH die `vi.mock`-Fabriken. Sie importiert bewusst NICHT
// `api/endpoints`: sie wird aus der Mock-Fabrik ebendieses Moduls heraus geladen, und ein Import
// zurück wäre ein Zirkel mitten in der Modulauflösung. Alles, was `endpoints` braucht (das Montieren
// der Seite, das Setzen der Antworten), wohnt deshalb in `kulisse.tsx` daneben.
//
// GEMOCKT IST DER ENDPUNKT, NICHT DER HAKEN. Ein Test, der `useValidationBoard` oder
// `useDuplicates` selbst ersetzte, bewiese nur, dass eine Testvoraussetzung ankommt; hier läuft die
// echte Kette `endpoints.*` → react-query → `boardAuskunft`/`doppelhinweis` → Karte. Dasselbe
// Muster wie `tests/pruefseite/stufe-und-herkunft-am-brett.test.tsx:20-25`.
import { vi } from "vitest";

/** Die Rolle, die eine Testdatei einstellt. Ein `vi.hoisted`-Halter, damit `vi.mock` ihn sieht. */
export interface RollenStand {
  rolle: string;
}

export function endpunktMock(): { endpoints: Record<string, unknown> } {
  return {
    endpoints: {
      validation: { board: vi.fn(async () => []), overview: vi.fn(async () => []) },
      directory: { list: vi.fn(async () => []) },
      reasoner: {
        status: vi.fn(async () => ({
          active: false,
          mode: "none",
          reachable: "unknown",
          tasks: {},
        })),
      },
      ko: {
        act: vi.fn(async () => ({})),
        aiCheckRetry: vi.fn(async () => ({})),
        remove: vi.fn(async () => ({})),
      },
      // Der gemeinsame Reiterkopf zählt die drei anderen Reiter aus echten Abrufen; `duplicates`
      // ist zusätzlich die Quelle des Doppel-Hinweises dieser Lieferung.
      conflicts: { list: vi.fn(async () => []) },
      duplicates: { list: vi.fn(async () => []) },
      lifecycle: { pending: vi.fn(async () => []) },
    },
  };
}

export async function authMock(
  importOriginal: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  return {
    ...(await importOriginal()),
    useSession: () => ({ user: { id: "u1", name: "Prüfer" }, isLoading: false }),
  };
}

export async function rolleMock(
  importOriginal: () => Promise<Record<string, unknown>>,
  stand: RollenStand,
): Promise<Record<string, unknown>> {
  return {
    ...(await importOriginal()),
    useRole: () => ({ role: stand.rolle, stufe2: true, setStufe2: () => undefined }),
  };
}

export async function toastMock(
  importOriginal: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  return { ...(await importOriginal()), useToast: () => ({ push: () => undefined }) };
}
