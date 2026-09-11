// ================================================================================================
// DIE ATTRAPPEN DER ENTWURF-VERLASSEN-TESTS — EINMAL, FÜR ALLE DATEIEN DIESES ORDNERS.
// ================================================================================================
//
// JOB 3572, Lieferung 7: Testserver und Bremse standen bis hierher EINMAL in
// `entwurf-verlassen-mounted.test.tsx`. Die zweite Datei dieses Ordners (`dialog-speicherfall-…`)
// braucht dieselben Werkzeuge — sie IMPORTIERT sie, sie schreibt sie nicht ab (Lehre 3550/3571).
//
// WARUM ZWEI MODULE UND NICHT EINES: `huelle.tsx` mountet das Produkt (`CaptureArbeitsraum`) und
// zieht damit `api/endpoints` herein. Die `vi.mock`-Fabrik jeder Testdatei lädt dieses Modul hier
// nach, WÄHREND `api/endpoints` gerade aufgelöst wird — läge die Hülle mit im selben Modul, liefe
// die Auflösung im Kreis. Deshalb steht hier ausschliesslich, was OHNE Produktimport auskommt.
//
// Der SERVER ist ein schreibbarer Bestand, kein festes Objekt: nur so kann ein falscher Bau
// überhaupt auffallen — ein `remove` oder ein `update` beim Verlassen verändert ihn sichtbar.
// Die BREMSE hängt den nächsten `update`/`remove`/`promote` an einem Riegel auf — genau das
// Fenster, in dem sich die Seite verlassen liess, während der Schreibvorgang noch lief.
import { vi } from "vitest";

/** Der Serverbestand. Wird je Fall in `grundzustand()` (huelle.tsx) frisch gesetzt. */
export const server = { bestand: {} as Record<string, unknown> };

let riegel: (() => void) | null = null;
let warte: Promise<void> | null = null;
/**
 * JOB 3572, Lieferung 4 (a): der nächste `update` scheitert EINMAL — der Fall „der Server lehnt ab".
 * Kein Schalter, der stehen bleibt: er verbraucht sich beim ersten Aufruf.
 */
let naechsterUpdateFehler: unknown = null;

export const bremse = {
  /** Ab jetzt hängt der nächste Schreibvorgang, bis `loslassen()` kommt. */
  halte(): void {
    warte = new Promise<void>((r) => {
      riegel = r;
    });
  },
  async loslassen(): Promise<void> {
    riegel?.();
    riegel = null;
    warte = null;
  },
  async passiere(): Promise<void> {
    if (warte) {
      await warte;
    }
  },
};

/** Der nächste `drafts.update` wirft diesen Fehler, danach schreibt er wieder normal. */
export function lasseNaechstesUpdateScheitern(fehler: unknown): void {
  naechsterUpdateFehler = fehler;
}

export const draftsGet = vi.fn(async (id: string) => {
  const d = server.bestand[id];
  if (!d) {
    throw new Error(`kein Entwurf ${id}`);
  }
  return JSON.parse(JSON.stringify(d)) as unknown;
});

export const draftsList = vi.fn(
  async () => JSON.parse(JSON.stringify(Object.values(server.bestand))) as unknown[],
);

export const draftsCreate = vi.fn(async (payload: unknown) => {
  server.bestand["neu-1"] = { id: "neu-1", updatedAt: "2026-09-10T12:00:00.000Z", payload };
  return { id: "neu-1" };
});

export const draftsUpdate = vi.fn(async (id: string, payload: unknown) => {
  await bremse.passiere();
  if (naechsterUpdateFehler !== null) {
    const fehler = naechsterUpdateFehler;
    naechsterUpdateFehler = null;
    throw fehler;
  }
  server.bestand[id] = { id, updatedAt: "2026-09-10T12:00:00.000Z", payload };
  return { id };
});

export const draftsRemove = vi.fn(async (id: string) => {
  await bremse.passiere();
  delete server.bestand[id];
  return {};
});

export const draftsPromote = vi.fn(async (id: string) => {
  await bremse.passiere();
  delete server.bestand[id];
  return { id: "ko-1", title: "egal" };
});

/** Setzt Riegel und Einmalfehler zurück — nichts aus einem Fall reicht in den nächsten hinein. */
export async function attrappenZuruecksetzen(): Promise<void> {
  await bremse.loslassen();
  naechsterUpdateFehler = null;
}

/** Das Modul `api/auth`, wie die Testdateien es in ihrer `vi.mock`-Fabrik zurückgeben. */
export function authAttrappe(): Record<string, unknown> {
  return {
    authApi: {
      status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
      me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
      logout: vi.fn(async () => ({})),
    },
  };
}

/** Das Modul `api/endpoints`, wie die Testdateien es in ihrer `vi.mock`-Fabrik zurückgeben. */
export function endpointsAttrappe(): Record<string, unknown> {
  const ok = <T>(v: T) => vi.fn(async () => v);
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    validation: { settings: ok({ defaultNeededValidations: 3 }) },
    external: { policy: vi.fn(async () => ({ stage: "off" })), search: vi.fn(async () => []) },
    uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
    directory: { list: arrFn() },
    gaps: { list: arrFn() },
    drafts: {
      list: draftsList,
      get: draftsGet,
      create: draftsCreate,
      update: draftsUpdate,
      remove: draftsRemove,
      promote: draftsPromote,
    },
    reasoner: {
      status: ok({ active: true, mode: "cloud", reachable: "active" }),
      config: ok(null),
      structure: vi.fn(async () => ({})),
      interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
      assist: vi.fn(async () => ({ text: "" })),
      describeImage: vi.fn(async () => ({ text: "", demo: false })),
    },
    notifications: { list: arrFn(), markSeen: vi.fn(async () => ({})) },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
}
