// @vitest-environment jsdom
// ================================================================================================
// R-0909 (Aufnahme `gesamt-dialog-bedienung`) — BEFEHLSPALETTE UND STUDIO SIND BENANNTE DIALOGE.
// ================================================================================================
//
// BENS BEFUND (Nacharbeit 2): Die Palette war „ein Container ohne Dialogrolle und Dialognamen", das
// Studio ebenso — und keine der beiden hing an der Modalgrenze der Shell. Die sieben `<Modal>`-
// Flächen misst `tests/app/job1900-modalgrenze-alle-sieben-mounted.test.tsx`; hier stehen die
// zwei übrigen Flächen, jede dort gemountet, wo sie im Produkt steht: in der ECHTEN `AppShell`.
//
// Je Fläche dieselben Fragen, einzeln beantwortet:
//   R  ROLLE UND NAME — das Panel ist ein `<dialog>` mit `aria-modal="true"` und einem Namen.
//   G  GRENZE        — ein gemeldeter Bereich trägt `inert`, der Dialog liegt NICHT darin.
//   F  FOKUS         — er liegt nach dem Öffnen im Dialog und nach dem Schließen wieder auf dem
//                      Auslöser; die Sperre ist dann aufgehoben.
// Und die Gegenprobe OHNE Shell: Rolle und Name stehen auch dort, `aria-modal` aber NICHT — eine
// Fläche ohne Grenze behauptet keine Modalität (mega48).
//
// WAS DIESE DATEI NICHT LEISTET: eine echte Sprachausgabe. Sie belegt die Struktur, aus der ein
// Vorleseprogramm „Dialog, <Name>" macht — nicht, dass VoiceOver oder NVDA es so vorlesen.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/client", () => ({
  ApiError: class ApiError extends Error {},
  apiFetch: vi.fn(async () => ({})),
}));

// Jeder Endpunkt antwortet mit einer leeren Liste — für Rolle, Name und Grenze ist der Inhalt
// ohne Belang. Dieselbe Bauform wie im JOB-1900-Fall.
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
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  await Promise.resolve();
};

/** Die Provider-Kette aus App.tsx; `mitShell` hängt den Inhalt in die echte `AppShell`. */
async function render(inhalt: unknown, mitShell: boolean): Promise<void> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const kern = mitShell ? createElement(AppShell, null, inhalt as never) : (inhalt as never);
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
                  createElement(MemoryRouter, { initialEntries: ["/"] }, kern),
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

async function taste(init: KeyboardEventInit): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
    await flush();
  });
  await act(flush);
}

function ausloeser(): HTMLElement {
  const el = container?.querySelector<HTMLElement>('[data-testid="ausloeser"]');
  if (!el) {
    throw new Error("Auslöser nicht gefunden");
  }
  return el;
}

function offenerDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>("dialog[open]");
}

/** Der zugängliche Name: `aria-label` oder der Text dessen, worauf `aria-labelledby` zeigt. */
function nameVon(d: HTMLElement): string {
  const label = d.getAttribute("aria-label");
  if (label) {
    return label.trim();
  }
  const verweis = d.getAttribute("aria-labelledby") ?? "";
  const ziel = verweis ? document.getElementById(verweis) : null;
  expect(ziel, "aria-labelledby zeigt ins Leere").not.toBeNull();
  expect(d.contains(ziel), "die benennende Überschrift steht nicht im Dialog").toBe(true);
  return (ziel?.textContent ?? "").trim();
}

/** R, G und der erste Teil von F — gegen GENAU diesen Dialog und GENAU diesen Auslöser. */
function istModalerDialog(d: HTMLElement | null, name: string, knopf: HTMLElement): void {
  expect(d, "die Fläche ist nicht offen").not.toBeNull();
  const dialog = d as HTMLElement;
  // R
  expect(dialog.tagName, "das Panel ist kein Dialog").toBe("DIALOG");
  expect(dialog.getAttribute("aria-modal"), "an der Grenze, aber ohne aria-modal").toBe("true");
  expect(nameVon(dialog)).toBe(name);
  // G
  expect(container?.querySelector("[inert]"), "kein Bereich ist gesperrt").not.toBeNull();
  expect(knopf.closest("[inert]"), "der Auslöser liegt nicht im gesperrten Bereich").not.toBeNull();
  expect(dialog.closest("[inert]"), "der Dialog selbst ist gesperrt").toBeNull();
  // F (hinein)
  expect(dialog.contains(document.activeElement), "der Fokus liegt nicht im Dialog").toBe(true);
}

/** Der zweite Teil von F: zu, Fokus zurück, Sperre aufgehoben. */
function istZuMitRueckgabe(knopf: HTMLElement): void {
  expect(offenerDialog(), "die Fläche ist noch offen").toBeNull();
  expect(document.activeElement, "der Fokus steht nicht wieder auf dem Auslöser").toBe(knopf);
  expect(container?.querySelector("[inert]"), "die Sperre ist nicht aufgehoben").toBeNull();
}

function AusloeserSeite(): JSX.Element {
  return createElement(
    "button",
    { type: "button", "data-testid": "ausloeser" },
    "hier stand der Fokus",
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

describe("R-0909 · Befehlspalette in der echten Shell", () => {
  it("P1 · Strg+K: benannter Dialog an der Grenze, Fokus hinein; Escape: zu, Fokus zurück", async () => {
    await i18n.changeLanguage("de");
    await render(createElement(AusloeserSeite), true);
    const knopf = ausloeser();
    knopf.focus();

    await taste({ key: "k", ctrlKey: true });

    istModalerDialog(offenerDialog(), i18n.t("fe002.seiteFindenMenue"), knopf);
    // Der Fokus steht im Suchfeld — dort, wo die Palette ihn seit jeher hinsetzt.
    expect(document.activeElement?.getAttribute("data-cmd")).toBe("suchfeld");

    await taste({ key: "Escape" });
    istZuMitRueckgabe(knopf);
  });

  it("P2 · Strg+K schließt die offene Palette weiterhin, obwohl sie selbst die Grenze hält", async () => {
    await render(createElement(AusloeserSeite), true);
    const knopf = ausloeser();
    knopf.focus();
    await taste({ key: "k", ctrlKey: true });
    expect(offenerDialog()).not.toBeNull();

    await taste({ key: "k", ctrlKey: true });
    istZuMitRueckgabe(knopf);
  });

  it("P0 · GEGENPROBE ohne Shell: Rolle und Name stehen, aria-modal NICHT", async () => {
    await render(createElement(CommandPalette), false);
    await taste({ key: "k", ctrlKey: true });
    const d = offenerDialog();
    expect(d?.tagName).toBe("DIALOG");
    expect(nameVon(d as HTMLElement)).toBe(i18n.t("fe002.seiteFindenMenue"));
    expect(d?.hasAttribute("aria-modal"), "ohne Grenze darf keine Modalität behauptet sein").toBe(
      false,
    );
  });
});

describe("R-0909 · Knowledge Studio in der echten Shell", () => {
  it("S1 · geöffnet: benannter Dialog an der Grenze, Fokus hinein; geschlossen: Fokus zurück", async () => {
    await i18n.changeLanguage("de");
    await render(createElement(StudioSonde), true);
    const knopf = ausloeser();
    knopf.focus();
    await klick(knopf);

    istModalerDialog(offenerDialog(), i18n.t("studio.title"), knopf);

    // Der sichtbare Ausgang ohne ungesicherte Änderung: „Einfach" schließt direkt.
    const zurueck = offenerDialog()?.querySelector<HTMLElement>(
      `[aria-label="${i18n.t("studio.viewSwitch")}"]`,
    );
    expect(zurueck, "der Ausgang des Studios fehlt").not.toBeNull();
    await klick(zurueck as HTMLElement);
    // Hat der Editor den Rumpf beim Laden nur umgeschrieben (gleicher Inhalt, andere Zeichen),
    // gilt das Studio als geändert und fragt zuerst — dann ist „Verwerfen" der Ausgang. Beide Wege
    // sind Schließen über die Fläche selbst; gemessen wird, was danach gilt.
    const verwerfen = [...(offenerDialog()?.querySelectorAll<HTMLElement>("button") ?? [])].find(
      (b) => (b.textContent ?? "").trim() === i18n.t("studio.confirmDiscard.discard"),
    );
    if (verwerfen) {
      await klick(verwerfen);
    }
    istZuMitRueckgabe(knopf);
  });

  it("S0 · GEGENPROBE ohne Shell: Rolle und Name stehen, aria-modal NICHT", async () => {
    await render(createElement(StudioSonde), false);
    await klick(ausloeser());
    const d = offenerDialog();
    expect(d?.tagName).toBe("DIALOG");
    expect(nameVon(d as HTMLElement)).toBe(i18n.t("studio.title"));
    expect(d?.hasAttribute("aria-modal"), "ohne Grenze darf keine Modalität behauptet sein").toBe(
      false,
    );
  });
});
