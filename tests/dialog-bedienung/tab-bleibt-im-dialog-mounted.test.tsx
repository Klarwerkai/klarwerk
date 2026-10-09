// @vitest-environment jsdom
// ================================================================================================
// R-0909 (Aufnahme `gesamt-dialog-bedienung`, Ben Nacharbeit 4) — „FOKUS BLEIBT DRIN".
// ================================================================================================
//
// BENS BEFUND: Der gemeinsame `GrenzDialog` rendert `<dialog open>` ohne `showModal()` und begrenzte
// die Tabulatortaste nicht; neben dem Panel standen fokussierbare Klickfänger (`Modal`, Palette).
// Umschalt+Tab vom ersten Bedienelement konnte den Klickfänger erreichen.
//
// GEMESSEN WIRD AN DEN BEIDEN RÄNDERN, je Fläche in der echten Shell:
//   V  Tab auf der LETZTEN Station  → der Fokus springt auf die ERSTE Station desselben Panels.
//   R  Umschalt+Tab auf der ERSTEN  → der Fokus springt auf die LETZTE Station desselben Panels.
//   K  Der Klickfänger daneben steht nicht in der Tab-Reihenfolge (`tabindex="-1"`).
//
// WAS DIESE DATEI NICHT LEISTET: jsdom bewegt den Fokus bei einem Tab-Ereignis nicht selbst. Belegt
// ist, dass der Dialog die Taste übernimmt und den Fokus an die richtige Stelle setzt — nicht das
// Verhalten eines echten Browsers ohne diese Übernahme.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/client", () => ({
  ApiError: class ApiError extends Error {},
  apiFetch: vi.fn(async () => ({})),
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make();
        },
      },
    );
  return { endpoints: make() };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { KnowledgeInputStudio } from "../../apps/web/src/components/KnowledgeInputStudio";
import { Modal } from "../../apps/web/src/components/Modal";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
};

async function render(inhalt: unknown): Promise<void> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    r.render(
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
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: ["/"] },
                    createElement(AppShell, null, inhalt as never),
                  ),
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

afterEach(async () => {
  if (root) {
    const r = root;
    await act(async () => {
      r.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

/** Ein Tab-Anschlag dort, wo der Fokus gerade steht — so, wie ihn der Browser zustellt. */
async function tab(rueckwaerts = false): Promise<void> {
  const ziel = document.activeElement ?? document.body;
  await act(async () => {
    ziel.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: rueckwaerts,
        bubbles: true,
        cancelable: true,
      }),
    );
    await flush();
  });
}

function offenerDialog(): HTMLElement {
  const d = document.querySelector<HTMLElement>("dialog[open]");
  if (!d) {
    throw new Error("kein Dialog offen");
  }
  return d;
}

/**
 * Die Tab-Stationen des Panels, unabhängig vom Produkt erhoben: was ein Browser per Tab erreicht —
 * Knöpfe, Felder, Verweise, Schreibflächen —, ohne Gesperrtes und ohne `tabindex="-1"`.
 */
const STATIONEN =
  'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"], [contenteditable=""]';

function stationen(d: HTMLElement): HTMLElement[] {
  return [...d.querySelectorAll<HTMLElement>(STATIONEN)].filter(
    (el) =>
      el.getAttribute("tabindex") !== "-1" &&
      !(el as HTMLButtonElement).disabled &&
      el.closest("[hidden],[aria-hidden='true']") === null,
  );
}

/** V, R und K für den offenen Dialog. */
async function randFaelle(): Promise<void> {
  const d = offenerDialog();
  const reihe = stationen(d);
  expect(
    reihe.length,
    "der Dialog hat keine zwei Stationen — dann misst dieser Fall nichts",
  ).toBeGreaterThanOrEqual(2);
  const erste = reihe[0] as HTMLElement;
  const letzte = reihe[reihe.length - 1] as HTMLElement;

  // V — vorwärts über den letzten Rand
  act(() => letzte.focus());
  await tab();
  expect(document.activeElement, "Tab am Ende verlässt das Panel").toBe(erste);

  // R — rückwärts über den ersten Rand
  act(() => erste.focus());
  await tab(true);
  expect(document.activeElement, "Umschalt+Tab am Anfang verlässt das Panel").toBe(letzte);
  expect(d.contains(document.activeElement)).toBe(true);

  // K — der Klickfänger neben dem Dialog ist kein Tab-Ziel
  const geschwister = [...(d.parentElement?.children ?? [])].filter((k) => k !== d);
  for (const k of geschwister) {
    if (k instanceof HTMLButtonElement) {
      expect(k.getAttribute("tabindex"), "der Klickfänger steht in der Tab-Reihenfolge").toBe("-1");
    }
  }
}

function ausloeser(): HTMLElement {
  const el = container?.querySelector<HTMLElement>('[data-testid="ausloeser"]');
  if (!el) {
    throw new Error("Auslöser nicht gefunden");
  }
  return el;
}

function ModalSonde(): JSX.Element {
  const [offen, setOffen] = useState(false);
  return createElement(
    "div",
    null,
    createElement(
      "button",
      { type: "button", "data-testid": "ausloeser", onClick: () => setOffen(true) },
      "öffnen",
    ),
    createElement(Modal, {
      open: offen,
      onClose: () => setOffen(false),
      title: "Probe",
      children: createElement(
        "div",
        null,
        createElement("button", { type: "button" }, "Mitte"),
        createElement("button", { type: "button" }, "Letzter"),
      ),
    }),
  ) as JSX.Element;
}

function StudioSonde(): JSX.Element {
  const [offen, setOffen] = useState(false);
  return createElement(
    "div",
    null,
    createElement(
      "button",
      { type: "button", "data-testid": "ausloeser", onClick: () => setOffen(true) },
      "Studio öffnen",
    ),
    createElement(KnowledgeInputStudio, {
      open: offen,
      onClose: () => setOffen(false),
      bodyHtml: "<p>Ein Absatz.</p>",
      onApply: () => undefined,
      runAssist: async () => "",
      documentTitle: "Pumpe P-12",
    }),
  ) as JSX.Element;
}

describe("R-0909 · Tab bleibt im Dialog — an beiden Rändern", () => {
  it("Modal (gemeinsamer Baustein aller Modal-Flächen): V, R und K", async () => {
    await i18n.changeLanguage("de");
    await render(createElement(ModalSonde));
    await klick(ausloeser());
    const d = offenerDialog();
    // Die Ränder sind die erwarteten: der Schließen-Knopf im Kopf, dann der Inhalt.
    const reihe = stationen(d);
    expect((reihe[0]?.textContent ?? "").trim()).toBe(i18n.t("modal.close"));
    expect((reihe[reihe.length - 1]?.textContent ?? "").trim()).toBe("Letzter");
    await randFaelle();
  });

  it("Befehlspalette: V, R und K", async () => {
    await render(createElement("div", null, "Inhalt"));
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
      );
      await flush();
    });
    await act(flush);
    const d = offenerDialog();
    // Erste Station ist das Suchfeld — dort, wo die Palette den Fokus seit jeher hinsetzt.
    expect(stationen(d)[0]?.getAttribute("data-cmd")).toBe("suchfeld");
    await randFaelle();
  });

  it("Knowledge Studio: V und R (ohne Klickfänger neben dem Dialog)", async () => {
    await render(createElement(StudioSonde));
    await klick(ausloeser());
    await randFaelle();
  });
});
