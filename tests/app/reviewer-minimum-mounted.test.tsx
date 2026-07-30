// @vitest-environment jsdom
// AUFTRAG-mega2 Block B (E2E-005 / bens D4): der Client setzt EXAKT denselben Vertrag durch wie der
// Server — Standard-Prüferanzahl ist eine ECHTE ganze Zahl 1–5. Gemountet an der ECHTEN Admin-Seite
// über den echten Bedienweg (Zahlenfeld + Speichern-Knopf):
//   0 · 1.5 · leer · 6  → gesperrt (Speichern disabled, Fehlermeldung)
//   1 · 5               → erlaubt (Speichern feuert MIT der ganzen Zahl als number)
// Vorher akzeptierte Number.parseInt „1.5" als 1 und speicherte 1 (stilles Zurechtbiegen).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { saveSettingsSpy } = vi.hoisted(() => ({ saveSettingsSpy: vi.fn(async () => ({})) }));

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
      admin: { factoryResetStatus: ok({ pending: false }) },
      // AUFTRAG-mega64 Block A: Der Demodaten-Knopf steht seit mega64 in einem `FeatureGate`, und
      // das fragt die Schalter-Auskunft ab. Ohne diesen Eintrag wirft der Mock beim Rendern der
      // ganzen Admin-Seite — dieser Test prüft das Reviewer-Minimum und ist auf die Auskunft nur
      // insofern angewiesen, als die Seite überhaupt aufbauen muss. `demodaten: false` ist dabei die
      // ehrliche Vorgabe: der Knopf erscheint hier nicht, und dieser Test behauptet nichts über ihn.
      features: { get: ok({ features: { demodaten: false } }) },
      users: { list: ok([]) },
      analytics: { overview: ok(null) },
      audit: { list: ok([]), verify: ok({ ok: true }) },
      validation: {
        board: ok([]),
        settings: ok({ defaultNeededValidations: 3 }),
        saveSettings: saveSettingsSpy,
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        assistPresets: ok([]),
      },
      ko: { trash: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      external: { policy: ok({ enabled: false }) },
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

function neededInput(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>(
    `input[aria-label="${i18n.t("adm.val.label")}"]`,
  );
  if (!el) {
    throw new Error("Prüferanzahl-Feld nicht gefunden");
  }
  return el;
}

function saveButton(): HTMLButtonElement {
  return buttonByText(i18n.t("adm.val.save"));
}

async function typeNeeded(value: string): Promise<void> {
  const el = neededInput();
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el) as object, "value")?.set;
  setter?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  saveSettingsSpy.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block B: Reviewer-Minimum — Client setzt denselben 1–5-Ganzzahlvertrag durch", () => {
  async function openDaten(): Promise<void> {
    await mount();
    await click(buttonByText(i18n.t("adm.sec.daten")));
  }

  it("sperrt 0, 1.5, leer und 6 (Speichern disabled, Fehlermeldung, kein Request)", async () => {
    await openDaten();
    for (const bad of ["0", "1.5", "", "6"]) {
      await typeNeeded(bad);
      expect(saveButton().disabled).toBe(true);
      expect(neededInput().getAttribute("aria-invalid")).toBe("true");
      expect(container.textContent).toContain(i18n.t("adm.val.invalid"));
    }
    // Auch ein erzwungener Klick auf den (gesperrten) Knopf löst keinen Request aus.
    await click(saveButton());
    expect(saveSettingsSpy).not.toHaveBeenCalled();
  });

  it("erlaubt 1 und speichert die ganze Zahl 1 als number", async () => {
    await openDaten();
    await typeNeeded("1");
    expect(saveButton().disabled).toBe(false);
    expect(neededInput().getAttribute("aria-invalid")).toBe("false");
    await click(saveButton());
    expect(saveSettingsSpy).toHaveBeenCalledWith(1);
  });

  it("erlaubt 5 und speichert die ganze Zahl 5 als number", async () => {
    await openDaten();
    await typeNeeded("5");
    expect(saveButton().disabled).toBe(false);
    await click(saveButton());
    expect(saveSettingsSpy).toHaveBeenCalledWith(5);
  });
});
