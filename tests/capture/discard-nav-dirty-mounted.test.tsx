// @vitest-environment jsdom
// AUFTRAG-mega3 Block A (bens Sammel-Review 3, Auflage C): EIN kanonisches Dirty-Prädikat steuert den
// Verwerfen-Knopf UND die Navigationswache. bens Reproduktion: erweiterte Details öffnen, NUR die
// Wissensart bzw. Vertraulichkeit ändern — der Verwerfen-Knopf blieb deaktiviert, der Wert überlebte.
// Diese gemounteten Tests treiben die ECHTE CaptureArbeitsraum-Seite über reale Klicks und prüfen je Feld:
//   (a) nach Änderung ist Verwerfen aktiv UND die Navigationswache greift (dasselbe Prädikat),
//   (b) Verwerfen setzt das Feld auf seinen frischen Default zurück,
//   (c) frisches Formular / Feld auf Default zurück ⇒ NICHT dirty (Knopf aus, Wache still).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      // Ein wählbarer Prüfer (id != user) — sonst zeigt die Prüferwahl nur „keine".
      directory: { list: ok([{ id: "p2", name: "Bob Pruefer", email: "b@x.de", role: "editor" }]) },
      gaps: { list: ok([]) },
      drafts: { list: ok([]) },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
// Wird true, sobald die Navigationswache den Wechsel DURCHLÄSST (nicht dirty).
const nav = { proceeded: false };

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Sonde: löst über die ECHTE Navigationswache einen Seitenwechsel aus. Dirty ⇒ Dialog statt Wechsel.
function NavProbe(): JSX.Element {
  const { guard } = useNavGuard();
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "navprobe",
      onClick: () =>
        guard(() => {
          nav.proceeded = true;
        }),
    },
    "navprobe",
  );
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
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/erfassen"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement(CaptureArbeitsraum),
                    }),
                  ),
                  createElement(NavProbe),
                ),
              ),
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

function setNativeValue(el: HTMLElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
}

async function change(el: HTMLInputElement | HTMLSelectElement, value: string): Promise<void> {
  setNativeValue(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

function discardButton(): HTMLButtonElement {
  return buttonByText(i18n.t("capture.wizard.discard"));
}

function inputByPlaceholder(ph: string): HTMLInputElement {
  const el = [...container.querySelectorAll("input")].find((i) => i.placeholder === ph);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Input mit Placeholder „${ph}“ nicht gefunden`);
  }
  return el;
}

function selectByValue(value: string): HTMLSelectElement {
  const el = [...container.querySelectorAll("select")].find((s) => s.value === value);
  if (!(el instanceof HTMLSelectElement)) {
    throw new Error(`Select mit Wert „${value}“ nicht gefunden`);
  }
  return el;
}

async function openWorkspaceAndAdvanced(): Promise<void> {
  // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
  // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
  // des Blattes und startet offen.
  await click(buttonByText(i18n.t("capture.advanced.title")));
}

async function navProbeBlocks(): Promise<boolean> {
  nav.proceeded = false;
  await click(
    container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
  );
  const dialogOpen = (container.textContent ?? "").includes(i18n.t("nav.guard.title"));
  // Falls ein Wache-Dialog offen ist, wieder schließen (Bleiben), um den nächsten Schritt sauber zu halten.
  if (dialogOpen) {
    await click(buttonByText(i18n.t("nav.guard.stay")));
  }
  return dialogOpen && nav.proceeded === false;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  nav.proceeded = false;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block A: EIN Dirty-Prädikat steuert Verwerfen UND Navigationswache", () => {
  it("frisches Formular: Verwerfen deaktiviert, Navigationswache lässt durch", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    expect(discardButton().disabled).toBe(true);
    // Navigationswache greift NICHT — der Wechsel läuft durch, kein Dialog.
    nav.proceeded = false;
    await click(
      container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
    );
    expect(nav.proceeded).toBe(true);
    expect((container.textContent ?? "").includes(i18n.t("nav.guard.title"))).toBe(false);
  });

  it("NUR Wissensart geändert: Verwerfen aktiv, Wache greift, Reset stellt Default her", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    const typeSel = selectByValue("best_practice");
    const other = [...typeSel.options].map((o) => o.value).find((v) => v !== "best_practice");
    expect(other, "eine zweite Wissensart muss existieren").toBeTruthy();
    await change(typeSel, other as string);

    // (a) beide Steuerungen sehen dirty
    expect(discardButton().disabled).toBe(false);
    expect(await navProbeBlocks()).toBe(true);

    // (b) Verwerfen → Reset auf Default
    await click(discardButton());
    await click(buttonByText(i18n.t("capture.wizard.discardYes")));
    await click(buttonByText(i18n.t("capture.advanced.title"))); // Reset klappte advanced ein
    expect(selectByValue("best_practice").value).toBe("best_practice");
    // (c) wieder sauber: Knopf aus, Wache still
    expect(discardButton().disabled).toBe(true);
  });

  it("NUR Vertraulichkeit geändert: Verwerfen aktiv, Wache greift, Reset → intern", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    const confSel = selectByValue("intern");
    const other = [...confSel.options].map((o) => o.value).find((v) => v !== "intern");
    await change(confSel, other as string);

    expect(discardButton().disabled).toBe(false);
    expect(await navProbeBlocks()).toBe(true);

    await click(discardButton());
    await click(buttonByText(i18n.t("capture.wizard.discardYes")));
    await click(buttonByText(i18n.t("capture.advanced.title")));
    expect(selectByValue("intern").value).toBe("intern");
    expect(discardButton().disabled).toBe(true);
  });

  it("NUR Prüferminimum geändert: Verwerfen aktiv, Reset leert das Feld", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    const numberInput = [...container.querySelectorAll("input")].find(
      (i) => i.type === "number",
    ) as HTMLInputElement;
    await change(numberInput, "2");

    expect(discardButton().disabled).toBe(false);
    expect(await navProbeBlocks()).toBe(true);

    await click(discardButton());
    await click(buttonByText(i18n.t("capture.wizard.discardYes")));
    await click(buttonByText(i18n.t("capture.advanced.title")));
    const afterNumber = [...container.querySelectorAll("input")].find(
      (i) => i.type === "number",
    ) as HTMLInputElement;
    expect(afterNumber.value).toBe("");
    expect(discardButton().disabled).toBe(true);
  });

  it("NUR Prüferauswahl geändert: Verwerfen aktiv, Reset hebt die Auswahl auf", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    const reviewerBtn = buttonByText("Bob Pruefer");
    await click(reviewerBtn);
    expect(buttonByText("Bob Pruefer").getAttribute("aria-pressed")).toBe("true");

    expect(discardButton().disabled).toBe(false);
    expect(await navProbeBlocks()).toBe(true);

    await click(discardButton());
    await click(buttonByText(i18n.t("capture.wizard.discardYes")));
    await click(buttonByText(i18n.t("capture.advanced.title")));
    expect(buttonByText("Bob Pruefer").getAttribute("aria-pressed")).toBe("false");
    expect(discardButton().disabled).toBe(true);
  });

  it("NUR ein Quellenfeld ausgefüllt: Verwerfen aktiv, Reset leert das Quellenformular", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    const labelInput = inputByPlaceholder(i18n.t("ko.sourceLabel"));
    await change(labelInput, "Handbuch S. 12");

    expect(discardButton().disabled).toBe(false);
    expect(await navProbeBlocks()).toBe(true);

    await click(discardButton());
    await click(buttonByText(i18n.t("capture.wizard.discardYes")));
    await click(buttonByText(i18n.t("capture.advanced.title")));
    expect(inputByPlaceholder(i18n.t("ko.sourceLabel")).value).toBe("");
    expect(discardButton().disabled).toBe(true);
  });

  it("NUR externe Suchanfrage eingegeben: Verwerfen aktiv, Reset leert die Anfrage", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    const extInput = inputByPlaceholder(i18n.t("ext.placeholder"));
    await change(extInput, "Dichtung Norm");

    expect(discardButton().disabled).toBe(false);
    expect(await navProbeBlocks()).toBe(true);

    await click(discardButton());
    await click(buttonByText(i18n.t("capture.wizard.discardYes")));
    await click(buttonByText(i18n.t("capture.advanced.title")));
    expect(inputByPlaceholder(i18n.t("ext.placeholder")).value).toBe("");
    expect(discardButton().disabled).toBe(true);
  });

  it("Feld geändert und exakt auf den Default zurückgesetzt ⇒ NICHT dirty (Knopf aus, Wache still)", async () => {
    await mount();
    await openWorkspaceAndAdvanced();
    const confSel = selectByValue("intern");
    const other = [...confSel.options].map((o) => o.value).find((v) => v !== "intern") as string;
    await change(confSel, other);
    expect(discardButton().disabled).toBe(false);
    // zurück auf den frischen Default
    await change(selectByValue(other), "intern");
    expect(discardButton().disabled).toBe(true);
    // Navigationswache lässt jetzt wieder durch (kein Dialog).
    nav.proceeded = false;
    await click(
      container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
    );
    expect(nav.proceeded).toBe(true);
  });
});
