// ================================================================================================
// JOB 3504 · PRUEFEN-LISTENNAVIGATION — DIE `vi.mock`-FABRIKEN, GETRENNT VON DER KULISSE.
// ================================================================================================
//
// Dieselbe Bauform wie `tests/validierung-stufe/kulisse-mocks.ts`: diese Datei importiert bewusst
// NICHT `api/endpoints`, denn sie wird aus der Mock-Fabrik ebendieses Moduls heraus geladen — ein
// Import zurück wäre ein Zirkel mitten in der Modulauflösung.
//
// GEMOCKT IST DER ENDPUNKT, NICHT DER HAKEN. Ein Test, der `useValidationBoard` selbst ersetzte,
// bewiese nur, dass eine Testvoraussetzung ankommt. Hier läuft die echte Kette
// `endpoints.validation.board` → react-query → `boardAuskunft` → Warteschlange und Karte. Genau
// deshalb ist auch die Aufrufzahl von `endpoints.validation.board` eine belastbare Aussage: sie
// zeigt, dass beim Weiterschalten KEIN artikelbezogener Abruf entsteht, der verspätet eintreffen
// und eine alte Antwort zeichnen könnte (Auftrag §3.4).
import { vi } from "vitest";

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
): Promise<Record<string, unknown>> {
  return {
    ...(await importOriginal()),
    useRole: () => ({ role: "controller", stufe2: true, setStufe2: () => undefined }),
  };
}

export async function toastMock(
  importOriginal: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  return { ...(await importOriginal()), useToast: () => ({ push: () => undefined }) };
}
