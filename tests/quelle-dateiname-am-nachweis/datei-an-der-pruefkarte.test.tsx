// @vitest-environment jsdom
// ================================================================================================
// JOB 4077 — DIE FLÄCHE (R5): auf `/pruefen` LIEST ein Mensch den Dateinamen
// ================================================================================================
//
// Erfüllt ist der Zweck nicht, wenn ein Feld existiert, sondern wenn der Dateiname der Belegstelle
// im Nachweisblock STEHT — dort, wo derselbe Mensch gleich freigibt oder ablehnt. Gemessen an der
// GEMOUNTETEN Seite über den echten react-query-Weg; gemockt ist der ENDPUNKT, nicht der Haken.
// Kulisse und Aufbau übernommen von `tests/pruefen-quellennachweis/nachweis-an-der-pruefkarte.test.tsx`
// (JOB 4013) — ein zweiter Aufbau für dieselbe Seite wäre eine zweite Wahrheit über sie.
//
// BEIDE RICHTUNGEN, in jedem Fall: der Name erscheint bei verankerter Quelle UND er erscheint
// NICHT, wo kein Anker steht — und an seiner Stelle steht dann auch kein Platzhalter.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
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
}));

vi.mock("../../apps/web/src/app/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/AuthContext")>()),
  useSession: () => ({ user: { id: "u1", name: "Prüfer" }, isLoading: false }) as never,
}));
vi.mock("../../apps/web/src/app/RoleContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/RoleContext")>()),
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }) as never,
}));
vi.mock("../../apps/web/src/app/ToastContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/ToastContext")>()),
  useToast: () => ({ push: () => {} }) as never,
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KoAttachment, KoSource, ValidationBoardKo } from "../../apps/web/src/api/types";
// i18n VOR der Seite: initialisiert react-i18next global.
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZEIT_ISO = "2026-09-14T10:00:00Z";
const DATEINAME = "Pruefbericht-2026.pdf";

function quelle(over: Partial<KoSource> = {}): KoSource {
  return {
    id: "q1",
    label: "Seite 4",
    url: null,
    excerpt: "Die tragende Naht wird vor dem Verzinken geprüft.",
    kind: "external",
    peerValidated: false,
    author: "u1",
    at: ZEIT_ISO,
    ...over,
  };
}

function anhang(over: Partial<KoAttachment> = {}): KoAttachment {
  return {
    id: "a1",
    name: DATEINAME,
    mime: "application/pdf",
    objectId: "obj-1",
    author: "u1",
    at: ZEIT_ISO,
    ...over,
  };
}

function zeile(over: Partial<ValidationBoardKo> = {}): ValidationBoardKo {
  return {
    id: "k1",
    title: "PROBE-KO Ventilwartung",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    reviewVotes: { up: 0, warn: 0, down: 0 },
    staleVotes: 0,
    asset: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    confidentiality: null,
    confidentialityProvenance: "unknown",
    origin: null,
    originSources: [],
    ...over,
  } as ValidationBoardKo;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function mountMit(items: ValidationBoardKo[]): Promise<void> {
  (endpoints.validation.board as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    items as never,
  );
  (endpoints.directory.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: "u1", name: "Prüfer" },
  ] as never);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(Validation),
        ),
      ),
    );
  });
  for (
    let i = 0;
    i < 8 && container.querySelectorAll('[data-testid="validation-row"]').length === 0;
    i += 1
  ) {
    await flush();
  }
}

/** Der Aufklapper „Mehr", wie ihn ein Mensch öffnet — sonst misst der Test eine zugeklappte Fläche. */
async function aufklappen(): Promise<void> {
  await act(async () => {
    for (const d of container.querySelectorAll("details")) {
      d.open = true;
    }
  });
}

const KARTE = '[data-testid="pruefen-karte"]';
const NACHWEIS = '[data-testid="pruefen-quellennachweis"]';
const DATEI = '[data-testid="pruefen-quelle-datei"]';
const ADRESS_MARKE = '[data-testid="pruefen-quelle-adresse"]';
const AUSZUG_MARKE = '[data-testid="pruefen-quelle-auszug"]';

function einer(wahl: string): HTMLElement | null {
  return container.querySelector(`${KARTE} ${wahl}`) as HTMLElement | null;
}

function alle(wahl: string): HTMLElement[] {
  return [...container.querySelectorAll(`${KARTE} ${wahl}`)] as HTMLElement[];
}

/** Der Text GENAU des Nachweises — „—" und „unbekannt" stehen auf der Karte schon aus anderem Recht. */
function nachweisText(): string {
  return alle(NACHWEIS)
    .map((e) => e.textContent ?? "")
    .join(" | ");
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// ================================================================================================
// a) DIE VERANKERTE QUELLE — der Dateiname steht IM Nachweisblock
// ================================================================================================
describe("JOB 4077 · R5a: die Belegstelle nennt die Datei, aus der sie stammt", () => {
  it("der Name des angehängten Originals steht unter dem Label derselben Quelle", async () => {
    await mountMit([zeile({ sources: [quelle({ objectId: "obj-1" })], attachments: [anhang()] })]);
    await aufklappen();

    const datei = einer(DATEI);
    expect(datei).not.toBeNull();
    expect(datei?.textContent).toContain(DATEINAME);
    // Er steht IM Nachweisblock dieser Quelle, nicht irgendwo auf der Karte.
    expect(einer(NACHWEIS)?.contains(datei as Node)).toBe(true);
    // Und die Entscheidung sitzt auf derselben Karte — das ist der ganze Zweck.
    expect(einer('[data-testid="pruefen-entscheidung-up"]')).not.toBeNull();
  });

  it("KEINE NEUEN WÖRTER: der Name trägt keine Beschriftung, er steht als Name da", async () => {
    await mountMit([zeile({ sources: [quelle({ objectId: "obj-1" })], attachments: [anhang()] })]);
    await aufklappen();

    expect((einer(DATEI)?.textContent ?? "").trim()).toBe(DATEINAME);
  });

  it("zwei Quellen, zwei Anhänge — jede Zeile nennt IHRE Datei", async () => {
    await mountMit([
      zeile({
        sources: [
          quelle({ id: "q1", label: "Seite 4", objectId: "obj-1" }),
          quelle({ id: "q2", label: "Seite 9", objectId: "obj-2" }),
        ],
        attachments: [anhang(), anhang({ id: "a2", objectId: "obj-2", name: "Messprotokoll.pdf" })],
      }),
    ]);
    await aufklappen();

    expect(alle(DATEI).map((e) => e.textContent?.trim())).toEqual([DATEINAME, "Messprotokoll.pdf"]);
  });
});

// ================================================================================================
// b) OHNE ANKER KEINE ZEILE — und ausdrücklich kein Platzhalter an ihrer Stelle
// ================================================================================================
describe("JOB 4077 · R5b: fehlen heisst fehlen", () => {
  it("Quelle ohne Anker: das Element existiert NICHT, und nichts steht ersatzweise da", async () => {
    await mountMit([zeile({ sources: [quelle()], attachments: [anhang()] })]);
    await aufklappen();

    expect(einer(DATEI)).toBeNull();
    // Kein Ersatzzeichen, kein „unbekannt", und ausdrücklich auch nicht der Name des Anhangs, der
    // zufällig am selben Objekt hängt — er gehört zu KEINER Belegstelle.
    const gezeichnet = nachweisText();
    expect(gezeichnet).not.toContain(DATEINAME);
    expect(gezeichnet).not.toContain("—");
    expect(gezeichnet).not.toContain("unbekannt");
    expect(gezeichnet).not.toContain("null");
    // Der Nachweis selbst steht weiterhin (Label + Auszug aus JOB 4013) — ein Fehlen steckt nicht an.
    expect(alle(NACHWEIS)).toHaveLength(1);
    expect(einer(AUSZUG_MARKE)).not.toBeNull();
  });

  it("Anker, aber der Anhang liegt nicht (mehr) am Objekt: ebenfalls keine Zeile", async () => {
    await mountMit([
      zeile({ sources: [quelle({ objectId: "obj-weg" })], attachments: [anhang()] }),
    ]);
    await aufklappen();

    expect(einer(DATEI)).toBeNull();
    expect(nachweisText()).not.toContain(DATEINAME);
  });

  it("ohne Anhangsliste am Objekt (Altbestand) bleibt alles übrige heil", async () => {
    const { attachments: _weg, ...ohne } = zeile({
      sources: [quelle({ objectId: "obj-1", url: "https://beispiel.de/norm" })],
      attachments: [],
    });
    await mountMit([ohne as ValidationBoardKo]);
    await aufklappen();

    expect(einer(DATEI)).toBeNull();
    expect(einer(ADRESS_MARKE)).not.toBeNull();
    expect(einer(AUSZUG_MARKE)).not.toBeNull();
  });
});
