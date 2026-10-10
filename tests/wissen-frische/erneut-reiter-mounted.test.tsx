// @vitest-environment jsdom
// aufnahme:20260922:gesamt-wissen-frische — der Reiter „Erneut" am ECHTEN Produktpfad, gemountet.
//   R-0206: geprüftes Wissen, das nach der Server-Frische fällig ist, steht in der Liste — auch
//           ohne Merker aus `GET /api/lifecycle/pending`; frisches Wissen nicht.
//   R-0266: die ältesten geprüften Beiträge der angemeldeten Person stehen zur Bestätigung bereit.
// Attrappen-Muster wie `tests/app/lifecycle-bestand-zuerst-mounted.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  pending: [] as string[],
  kos: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Nacharbeit 1: die angemeldete Person wird GESTELLT, wie in `tests/aufgaben-ansicht/*` — über die
// echte Sitzungsabfrage kam in diesem Aufbau kein Nutzer an, und R-0266 hängt genau an ihm. Alle
// übrigen Felder der Sitzung bleiben die echten (`AuthProvider` bleibt gemountet).
vi.mock("../../apps/web/src/app/AuthContext", async (original) => {
  const echt = await original<typeof import("../../apps/web/src/app/AuthContext")>();
  return {
    ...echt,
    useSession: () => ({
      ...echt.useSession(),
      user: { id: "u1", name: "Pia", email: "p@x.de", role: "admin" },
    }),
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      lifecycle: { pending: vi.fn(async () => d.pending), assetChanged: ok([]) },
      ko: { list: vi.fn(async () => d.kos), act: ok({}) },
      validation: { board: ok([]), overview: ok([]) },
      conflicts: { list: ok([]) },
      duplicates: { list: ok([]) },
      learningPaths: { byRole: ok(null), progress: ok([]), complete: ok({}) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import i18n from "../../apps/web/src/i18n";
import { Lifecycle } from "../../apps/web/src/pages/Lifecycle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function frische(stufe: string, verantwortlich: string, bezugAm: string) {
  return {
    stufe,
    halbwertszeitTage: 365,
    bezugAm,
    letztesSignal: null,
    haltbarBis: "2027-01-01T00:00:00.000Z",
    erinnerungAb: "2026-12-18T00:00:00.000Z",
    erinnern: false,
    verantwortlich,
    verantwortlichArt: "owner",
    gesichert: stufe === "frisch" || stufe === "altert",
    aktuellerStand: stufe === "frisch" || stufe === "altert",
    schutz: "intern",
    betriebsmodell: "freigegebene_ki",
    inDokumente: false,
    naechsterSchritt: stufe === "faellig" ? "erneut_bestaetigen" : "keiner",
    ungeprueft: {},
  };
}

async function mount(): Promise<void> {
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
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/lebenszyklus"] },
              createElement(Lifecycle),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Reiter „Erneut“ mit Server-Frische", () => {
  it("R-0206: fällig nach Frische erscheint ohne Merker; frisches Wissen nicht", async () => {
    d.pending = [];
    d.kos = [
      {
        id: "alt",
        title: "Kesseldruck prüfen",
        status: "validiert",
        asset: null,
        frische: frische("faellig", "u9", "2025-06-01T00:00:00.000Z"),
      },
      {
        id: "neu",
        title: "Pumpe entlüften",
        status: "validiert",
        asset: null,
        frische: frische("frisch", "u9", "2026-09-01T00:00:00.000Z"),
      },
    ];
    await mount();
    const zeilen = [...container.querySelectorAll('[data-testid="lifecycle-row"]')].map(
      (z) => z.textContent,
    );
    expect(zeilen).toEqual(["Kesseldruck prüfen"]);
    // Die Karte nennt die Frische des gewählten Objekts.
    expect(container.querySelector('[data-testid="pruefen-karte"]')?.textContent).toContain(
      i18n.t("frische.stufe.faellig"),
    );
  });

  it("GEGENPROBE: ohne Merker und ohne fälliges Wissen bleibt der Leerzustand", async () => {
    d.pending = [];
    d.kos = [
      {
        id: "neu",
        title: "Pumpe entlüften",
        status: "validiert",
        asset: null,
        frische: frische("frisch", "u9", "2026-09-01T00:00:00.000Z"),
      },
    ];
    await mount();
    expect(container.querySelector('[data-testid="lifecycle-row"]')).toBeNull();
    expect(container.textContent).toContain(i18n.t("lcy.empty"));
  });

  it("R-0266: die ältesten geprüften Beiträge der angemeldeten Person, ältester zuerst", async () => {
    d.pending = [];
    d.kos = [
      {
        id: "a",
        title: "Neuerer Beitrag",
        status: "validiert",
        asset: null,
        frische: frische("frisch", "u1", "2026-08-01T00:00:00.000Z"),
      },
      {
        id: "b",
        title: "Ältester Beitrag",
        status: "validiert",
        asset: null,
        frische: frische("altert", "u1", "2026-02-01T00:00:00.000Z"),
      },
      {
        id: "c",
        title: "Fremder Beitrag",
        status: "validiert",
        asset: null,
        frische: frische("altert", "u9", "2025-01-01T00:00:00.000Z"),
      },
    ];
    await mount();
    const vorlage = [
      ...container.querySelectorAll('[data-testid="pruefen-vorlage-eintrag"] a'),
    ].map((a) => a.textContent);
    expect(vorlage).toEqual(["Ältester Beitrag", "Neuerer Beitrag"]);
  });
});
