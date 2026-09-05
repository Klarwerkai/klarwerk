// @vitest-environment jsdom
// AUFTRAG-mega2 Block C (bens D9): die Bereitschafts-Checkliste behauptet vor der Datenladung KEINE
// echten Warnungen mehr („keine KI"/„0 validiert"). Gemountet an der ECHTEN Admin-Seite, Bereich
// „Bereitschaft":
//   VOR Auflösung der tragenden Queries → jede Zeile „wird geladen …", KEIN crit/warn
//   NACH Auflösung (KI wirklich nicht konfiguriert) → ehrliche „keine KI"-Zeile
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mega3 Block B: „channel"-Mock — jeder queryFn-Aufruf erhält ein frisches Promise; Ausgang steuerbar
// (resolve/reject). So sind pending→success (Bestand) UND ein initialer Fehler abbildbar.
const d = vi.hoisted(() => {
  const mk = () => {
    const state = { resolve: (_v: unknown) => {}, reject: (_e: unknown) => {} };
    const fn = vi.fn(
      () =>
        new Promise((resolve, reject) => {
          state.resolve = resolve;
          state.reject = reject;
        }),
    );
    return {
      fn,
      resolve: (v: unknown) => state.resolve(v),
      reject: (e: unknown) => state.reject(e),
    };
  };
  // AUFTRAG-mega14 Block H (SCRUM-437): die Demodaten-Zeile ist eine SECHSTE tragende Quelle —
  // sie gehört in dieselbe atomare Ladegruppe wie die anderen fünf.
  return {
    aiConfig: mk(),
    analytics: mk(),
    board: mk(),
    upload: mk(),
    extPolicy: mk(),
    demo: mk(),
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      admin: { factoryResetStatus: ok({ pending: false }), demoStatus: d.demo.fn },
      users: { list: ok([]) },
      analytics: { overview: d.analytics.fn },
      audit: { list: ok([]), verify: ok({ ok: true }) },
      validation: {
        board: d.board.fn,
        settings: ok({ defaultNeededValidations: 3 }),
        saveSettings: ok({}),
      },
      reasoner: {
        status: ok({ active: false, mode: "deterministic", reachable: "unreachable" }),
        config: d.aiConfig.fn,
        assistPresets: ok([]),
      },
      ko: { trash: ok([]) },
      uploadLimits: { get: d.upload.fn },
      external: { policy: d.extPolicy.fn },
      duplicates: { settings: ok({ minConfidence: 0.8 }) },
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
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Admin } from "../../apps/web/src/pages/Admin";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

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
              ToastProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/admin"] }, createElement(Admin)),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

/**
 * JOB 3065 H6: „Bereitschaft" ist kein eigener Reiter mehr, sondern eine Zeile unter „Sicherheit",
 * deren Chevron die Checkliste als Detailkarte öffnet. Die Checkliste selbst — Quellen, Ampeln,
 * Ladezustand, Fehlerzustand — ist unverändert; nur der Weg dorthin ist zwei Klicks statt einem.
 */
async function oeffneBereitschaft(): Promise<void> {
  await click(buttonByText(i18n.t("adm.sec.sicherheit")));
  const zeile = container.querySelector('[data-testid="zeile-bereitschaft"]');
  if (!(zeile instanceof HTMLButtonElement)) {
    throw new Error("Zeile „Bereitschaft“ nicht gefunden");
  }
  await click(zeile);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block C: Bereitschaft — Ladezustand statt vorschneller Warnung", () => {
  it("VOR Auflösung Ladezeilen, NACH Auflösung ehrliche keine-KI-Zeile", async () => {
    await mount();
    await oeffneBereitschaft();

    // VOR: jede Zeile lädt; KEINE „keine KI"-Warnung aus fehlenden Daten.
    expect(container.textContent).toContain(i18n.t("adm.ready.loading"));
    expect(container.textContent).not.toContain(i18n.t("adm.ready.ki.none"));

    // NACH: KI wirklich nicht konfiguriert, Board leer, Analytics 0 → ehrliche Warnung erscheint.
    await act(async () => {
      d.aiConfig.resolve({
        cloudConfigured: false,
        localConfigured: false,
        taskConfig: { global: "auto", perTask: {} },
      });
      d.analytics.resolve({ total: 0, byStatus: { offen: 0, validiert: 0 } });
      d.board.resolve([]);
      d.upload.resolve({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 });
      d.extPolicy.resolve({ enabled: false, stage: "blocked" });
      d.demo.resolve({ present: false, count: 0 });
      await flush();
    });

    expect(container.textContent).not.toContain(i18n.t("adm.ready.loading"));
    expect(container.textContent).toContain(i18n.t("adm.ready.ki.none"));
  });

  it("mega3 Block B: initial gescheiterte tragende Quelle → Fehlerzustand mit Wiederholen, kein „lädt“, keine falsche Warnung", async () => {
    await mount();
    await oeffneBereitschaft();
    expect(container.textContent).toContain(i18n.t("adm.ready.loading"));

    await act(async () => {
      // Eine tragende Quelle scheitert dauerhaft, die anderen liefern Daten.
      d.aiConfig.reject(new Error("kaputt"));
      d.analytics.resolve({ total: 0, byStatus: { offen: 0, validiert: 0 } });
      d.board.resolve([]);
      d.upload.resolve({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 });
      d.extPolicy.resolve({ enabled: false, stage: "blocked" });
      d.demo.resolve({ present: false, count: 0 });
      await flush();
    });

    // Ehrlicher Fehlerzustand mit Wiederholen — kein endloses „lädt", KEINE erfundene „keine KI"-Warnung.
    //
    // JOB 3065 R3 (BENs Korrekturpflicht 1: „sämtliche Detailkarten an denselben Zustandsvertrag"):
    // Der Wortlaut ist jetzt derselbe wie in jeder anderen Einstellungs-Karte — `nicht abrufbar`
    // statt `loadstate.error.title`. Die ZUSAGE aus mega3 Block B ist unverändert und wird hier
    // weiter geprüft: ehrlicher Fehlerzustand statt endlosem „lädt", mit einem Weg zurück.
    expect(container.textContent).toContain(i18n.t("einst.wert.nichtAbrufbar"));
    expect(container.textContent).toContain(i18n.t("loadstate.error.retry"));
    expect(container.textContent).not.toContain(i18n.t("adm.ready.loading"));
    expect(container.textContent).not.toContain(i18n.t("adm.ready.ki.none"));
  });
});
