// @vitest-environment jsdom
// ================================================================================================
// R-1647 / R-2174 (aufnahme:20260922:gesamt-anlagenzugang) — DER QR-CODE STEHT AM WISSEN DER
// ANLAGE, UND WAS ER TRÄGT, ÖFFNET GENAU DIESE ANLAGE.
// ================================================================================================
// Gemountet wird die ECHTE Seite `KnowledgeDetail` im echten Providerbaum (Bauform aus
// `tests/capture/mega70-block-b3-herkunft-render.test.tsx`); ersetzt sind nur der Objektabruf und
// das Protokoll. Gelesen wird am gerenderten SVG — mit dem unabhängigen Leser `./qr-leser.ts`,
// also so, wie ein Scanner das Etikett liest.
//   W1  Objekt mit Anlage, Rolle `viewer`: Abschnitt „Kopplung und Anlagen" zeigt den Code; sein
//       Inhalt ist die Adresse der Anlage unter dem laufenden Ursprung; der Link daneben führt
//       auf denselben Pfad.
//   W2  Objekt ohne Anlage: kein Code, kein Platzhalter.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = {
  ko: {
    id: "ko-1",
    title: "Dosierpumpe entlüften",
    statement: "Vor dem Anfahren die Dosierpumpe entlüften.",
    bodyHtml: "<p>Entlüftungsschraube öffnen, bis blasenfrei.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Instandhaltung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    asset: "Linie L4 / Dosierstation DP-4" as string | null,
    createdAt: "2026-07-01T10:00:00.000Z",
    history: [{ version: 1, at: "2026-07-01T10:00:00.000Z", author: "u1", note: "erstellt" }],
    comments: [],
    attachments: [],
    sources: [],
  } as Record<string, unknown>,
};

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      ko: { ...original.endpoints.ko, get: vi.fn(async () => box.ko) },
      audit: { ...original.endpoints.audit, list: vi.fn(async () => []) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import type { Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { anlagenPfad } from "../../apps/web/src/lib/anlagenzugang";
import { QR_RUHEZONE } from "../../apps/web/src/lib/qrCode";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { leseQr, matrixAusPfad } from "./qr-leser";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function RolleStellen({ rolle }: { rolle: Role }): null {
  const { setRole } = useRole();
  useEffect(() => {
    setRole(rolle);
  }, [rolle, setRole]);
  return null;
}

async function mount(rolle: Role): Promise<void> {
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
                MemoryRouter,
                { initialEntries: ["/wissen/ko-1"] },
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(RolleStellen, { rolle }),
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
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

function kopplungOeffnen(): void {
  const mehr = container.querySelector('[data-testid="bib-mehr"]');
  if (mehr instanceof HTMLButtonElement && mehr.getAttribute("aria-expanded") !== "true") {
    act(() => {
      mehr.click();
    });
  }
  const abschnitt = container.querySelector('[data-bib-abschnitt="kopplung"]');
  if (!(abschnitt instanceof HTMLDetailsElement)) {
    throw new Error(`Abschnitt „kopplung" fehlt; DOM: ${container.textContent}`);
  }
  if (!abschnitt.open) {
    act(() => {
      abschnitt.open = true;
      abschnitt.dispatchEvent(new Event("toggle"));
    });
  }
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.ko.asset = "Linie L4 / Dosierstation DP-4";
  box.ko.anlagenkontext = undefined;
});

function waehle(testId: string, wert: string): void {
  const feld = container.querySelector(`[data-testid="${testId}"]`);
  if (!(feld instanceof HTMLSelectElement)) {
    throw new Error(`Auswahl „${testId}" fehlt; DOM: ${container.textContent}`);
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  act(() => {
    setter.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function gelesenerInhalt(): string {
  const bild = container.querySelector('[data-testid="anlagen-qr-bild"]');
  const seite = Number((bild?.getAttribute("viewBox") ?? "").split(" ")[2]);
  const pfad = bild?.querySelector("path")?.getAttribute("d") ?? "";
  return leseQr(matrixAusPfad(pfad, seite, QR_RUHEZONE)).text;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

describe("Anlagenzugang · der QR-Code in der Wissensansicht", () => {
  it("W1 · der Code trägt die Adresse der Anlage, der Link daneben denselben Pfad", async () => {
    await mount("viewer");
    kopplungOeffnen();

    const kennung = "Linie L4 / Dosierstation DP-4";
    const bild = container.querySelector('[data-testid="anlagen-qr-bild"]');
    expect(bild, `kein QR-Code im Abschnitt; DOM: ${container.textContent}`).not.toBeNull();
    expect(bild?.getAttribute("aria-label")).toContain(kennung);

    const seite = Number((bild?.getAttribute("viewBox") ?? "").split(" ")[2]);
    const pfad = bild?.querySelector("path")?.getAttribute("d") ?? "";
    const gelesen = leseQr(matrixAusPfad(pfad, seite, QR_RUHEZONE));
    expect(gelesen.text).toBe(`${window.location.origin}${anlagenPfad(kennung)}`);

    const link = container.querySelector('[data-testid="anlagen-qr-oeffnen"]');
    expect(link?.getAttribute("href")).toBe(anlagenPfad(kennung));
  });

  it("W3 · Bauteil und Standort gewählt: der Code trägt genau diese Adresse (R-1631)", async () => {
    box.ko.anlagenkontext = {
      bauteile: ["BT-4711"],
      standorte: ["Werk Nord", "Werk Süd"],
      schichten: ["Nacht"],
    };
    await mount("viewer");
    kopplungOeffnen();
    const kennung = "Linie L4 / Dosierstation DP-4";
    expect(gelesenerInhalt()).toBe(`${window.location.origin}${anlagenPfad(kennung)}`);

    waehle("anlagen-qr-bezug", "1");
    waehle("anlagen-qr-kontext-standort", "Werk Süd");
    waehle("anlagen-qr-kontext-schicht", "Nacht");
    const pfad = anlagenPfad("BT-4711", "bauteil", { standort: "Werk Süd", schicht: "Nacht" });
    expect(gelesenerInhalt()).toBe(`${window.location.origin}${pfad}`);
    expect(
      container.querySelector('[data-testid="anlagen-qr-oeffnen"]')?.getAttribute("href"),
    ).toBe(pfad);
  });

  it("W4 · Kontext treibt die Adresse über die Kapazität: Wahl bleibt bedienbar und rücknehmbar", async () => {
    // Ben Nacharbeit 3: zulässige Kennungen (≤ 120 Zeichen) können zusammen die 213 Byte von
    // Version 10-M überschreiten. Dann muss die Wahl sichtbar bleiben und zurückzunehmen sein.
    const standort = `Werk${"n".repeat(96)}`;
    const version = `Rev${"v".repeat(117)}`;
    box.ko.anlagenkontext = { standorte: [standort], versionen: [version] };
    await mount("viewer");
    kopplungOeffnen();
    const kennung = "Linie L4 / Dosierstation DP-4";

    waehle("anlagen-qr-kontext-standort", standort);
    waehle("anlagen-qr-kontext-anlagenversion", version);
    expect(container.querySelector('[data-testid="anlagen-qr-zu-lang"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="anlagen-qr-bild"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="anlagen-qr-kontext-standort"]'),
      "die Kontextwahl ist im Zustand „zu lang“ verschwunden",
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="anlagen-qr-kontext-zuruecksetzen"]'),
    ).not.toBeNull();

    // Eine Wahl zurücknehmen: sofort wieder ein Code, mit der verbliebenen Wahl.
    waehle("anlagen-qr-kontext-anlagenversion", "");
    expect(container.querySelector('[data-testid="anlagen-qr-zu-lang"]')).toBeNull();
    expect(gelesenerInhalt()).toBe(
      `${window.location.origin}${anlagenPfad(kennung, "asset", { standort })}`,
    );

    // Erneut über die Grenze, dann die sichtbare Rücksetzung: Code ohne Kontext.
    waehle("anlagen-qr-kontext-anlagenversion", version);
    expect(container.querySelector('[data-testid="anlagen-qr-zu-lang"]')).not.toBeNull();
    const zuruecksetzen = container.querySelector<HTMLButtonElement>(
      '[data-testid="anlagen-qr-kontext-zuruecksetzen"]',
    );
    act(() => {
      zuruecksetzen?.click();
    });
    expect(container.querySelector('[data-testid="anlagen-qr-zu-lang"]')).toBeNull();
    expect(gelesenerInhalt()).toBe(`${window.location.origin}${anlagenPfad(kennung)}`);
    expect(container.querySelector('[data-testid="anlagen-qr-kontext-zuruecksetzen"]')).toBeNull();
  });

  it("W2 · ohne Anlage am Objekt gibt es keinen Code", async () => {
    box.ko.asset = null;
    await mount("viewer");
    kopplungOeffnen();
    expect(container.querySelector('[data-bib-abschnitt="kopplung"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="anlagen-qr"]')).toBeNull();
  });
});
