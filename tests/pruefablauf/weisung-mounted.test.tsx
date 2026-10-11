// @vitest-environment jsdom
// ================================================================================================
// R-1863 · ANTWORTEN 18/19 (Ben, Nacharbeit 9) — WEISUNG UND SICHTUNG IN DER LESEFLÄCHE.
// ================================================================================================
//
// GEMESSEN AN DER ECHTEN ROUTE `/wissen/:id` (`KnowledgeDetail` → `BibliothekLesen` → `Weisung`),
// mit demselben Aufbau wie `vorschlagsweg-mounted.test.tsx`. Ersetzt ist nur die HTTP-Grenze.
//
//   M1 · Die Admin-Rolle ohne Befugnis am Konto bekommt den Weg nicht angeboten.
//   M2 · Mit Befugnis für den Bereich: Person und Frist wählen, der Aufruf trägt beides.
//   M3 · Befugnis für einen anderen Bereich: kein Weg.
//   M4 · Die benannte Person sieht „überfällig" und widerruft; der Aufruf trägt das Ergebnis.
//   M5 · Andere sehen Person und Frist, aber keine Sichtungsknöpfe.
//   M6 · Die Annahmezeile nennt die Kontoregel „Weisung".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  rolle: "experte" as "experte" | "controller" | "admin",
  ichId: "u-experte",
  befugnis: undefined as { bereiche: string[]; erteiltVon: string; erteiltAm: string } | undefined,
  aufrufe: [] as { id: string; body: Record<string, unknown> }[],
  // Ben, Nacharbeit 11: die Antwort des Servers auf die nächste Weisungsaktion (sonst Erfolg).
  fehler: null as { status: number; code: string; message: string } | null,
  gelesen: 0,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({
      id: box.ichId,
      name: "Eva",
      email: "e@x.de",
      role: box.rolle,
      ...(box.befugnis ? { weisungsbefugnis: box.befugnis } : {}),
    })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => {
          box.gelesen += 1;
          return globalThis.__weisungKo;
        }),
        list: vi.fn(async () => [globalThis.__weisungKo]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async (id: string, body: Record<string, unknown>) => {
          box.aufrufe.push({ id, body });
          if (box.fehler) {
            throw new ApiError(box.fehler.status, box.fehler.code, box.fehler.message);
          }
          return globalThis.__weisungKo;
        }),
        remove: vi.fn(async () => undefined),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: {
        list: vi.fn(async () => [
          { id: "u-experte", name: "Eva Expertin" },
          { id: "u-ctrl", name: "Carl Controller" },
        ]),
      },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => null),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useRef } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

declare global {
  // eslint-disable-next-line no-var
  var __weisungKo: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

const HEUTE = new Date().toISOString().slice(0, 10);

function ko(over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Urlaubsantrag",
    statement: "Urlaub wird spätestens drei Wochen vorher beantragt.",
    bodyHtml: "<p>Urlaub wird spätestens drei Wochen vorher beantragt.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 2,
    author: "u-experte",
    originalAuthor: "u-experte",
    neededValidations: 3,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
    ...over,
  } as KnowledgeObject;
}

const SICHTUNG = {
  auditSeq: 7,
  auditHash: "h7",
  koVersion: 2,
  erteiltVon: "u-experte",
  bereich: "Anlage 1",
  verantwortlich: "u-ctrl",
  frist: "2026-01-15",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Huelle({ children }: { children: React.ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  return createElement(ModalBoundaryProvider, {
    hostRef: mainRef,
    children: [
      createElement(
        "main",
        { key: "main", ref: mainRef, className: "flex-1 overflow-y-auto px-9 py-7" },
        children,
      ),
      createElement(ToastViewport, { key: "toasts" }),
    ],
  });
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(
                    Huelle,
                    null,
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
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

function da(testId: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function muss(testId: string): HTMLElement {
  const treffer = da(testId);
  if (!treffer) {
    throw new Error(`„${testId}" ist auf der Fläche nicht da`);
  }
  return treffer;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

async function setzeWert(
  feld: HTMLInputElement | HTMLSelectElement,
  wert: string,
  ereignis: "input" | "change",
): Promise<void> {
  await act(async () => {
    const proto =
      feld instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set as (v: string) => void;
    setter.call(feld, wert);
    feld.dispatchEvent(new Event(ereignis, { bubbles: true }));
    await flush();
  });
  await act(flush);
}

function aufrufe(aktion: string): Record<string, unknown>[] {
  return box.aufrufe.filter((a) => a.body.action === aktion).map((a) => a.body);
}

const BEFUGNIS = (bereiche: string[]) => ({
  bereiche,
  erteiltVon: "u-admin",
  erteiltAm: "2026-10-11T08:00:00.000Z",
});

beforeEach(async () => {
  box.rolle = "experte";
  box.ichId = "u-experte";
  box.befugnis = undefined;
  box.aufrufe = [];
  box.fehler = null;
  box.gelesen = 0;
  globalThis.__weisungKo = ko();
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("R-1863 · Antworten 18/19 — die Weisung in der Lesefläche", () => {
  it("M1 · Admin-Rolle ohne Befugnis am Konto: kein Weisungsweg", async () => {
    box.rolle = "admin";
    await mount();
    expect(da("bib-weisung-einstellen")).toBeNull();
  });

  it("M2 · Befugnis für den Bereich: Person und Frist reisen mit dem Aufruf", async () => {
    box.befugnis = BEFUGNIS(["Anlage 1"]);
    await mount();
    muss("bib-weisung-einstellen");
    expect(muss("bib-weisung-knopf").hasAttribute("disabled")).toBe(true);
    const wahl = muss("bib-weisung-verantwortlich") as HTMLSelectElement;
    // Die eigene Person steht nicht zur Wahl.
    expect([...wahl.options].map((o) => o.value)).toEqual(["", "u-ctrl"]);
    await setzeWert(wahl, "u-ctrl", "change");
    await setzeWert(muss("bib-weisung-frist-eingabe") as HTMLInputElement, HEUTE, "input");
    await klick(muss("bib-weisung-knopf"));
    // Ben, Nacharbeit 11: die ANGEZEIGTE Fassung reist mit (AW06-K02).
    expect(aufrufe("weisung-validate")).toEqual([
      {
        action: "weisung-validate",
        sichtung: { verantwortlich: "u-ctrl", frist: HEUTE },
        expectedVersion: 2,
      },
    ]);
  });

  it("M3 · Befugnis für einen anderen Bereich: kein Weg", async () => {
    box.befugnis = BEFUGNIS(["Personal"]);
    await mount();
    expect(da("bib-weisung-einstellen")).toBeNull();
  });

  it("M4 · die benannte Person sieht „überfällig“ und widerruft", async () => {
    box.rolle = "controller";
    box.ichId = "u-ctrl";
    globalThis.__weisungKo = ko({ status: "validiert", weisungsSichtung: SICHTUNG });
    await mount();
    const frist = muss("bib-weisung-frist");
    expect(frist.getAttribute("data-ueberfaellig")).toBe("ja");
    expect(frist.textContent).toContain("überfällig");
    expect(frist.textContent).toContain("Carl Controller");
    await klick(muss("bib-weisung-widerrufen"));
    expect(aufrufe("weisung-sichten")).toEqual([
      { action: "weisung-sichten", sichtung: { ergebnis: "widerrufen" }, expectedVersion: 2 },
    ]);
  });

  it("M5 · andere sehen Person und Frist, aber keine Sichtungsknöpfe", async () => {
    box.befugnis = BEFUGNIS(["Anlage 1"]);
    globalThis.__weisungKo = ko({
      status: "validiert",
      weisungsSichtung: { ...SICHTUNG, frist: "2099-12-31" },
    });
    await mount();
    const frist = muss("bib-weisung-frist");
    expect(frist.getAttribute("data-ueberfaellig")).toBe("nein");
    expect(frist.textContent).toContain("Carl Controller");
    expect(da("bib-weisung-bestaetigen")).toBeNull();
    expect(da("bib-weisung-widerrufen")).toBeNull();
    // Das Objekt ist schon fachlich bestätigt: kein zweites Einstellen.
    expect(da("bib-weisung-einstellen")).toBeNull();
  });

  it("M7 · ist inzwischen eine neue Fassung gespeichert, nennt die Fläche das und lädt sie nach", async () => {
    box.rolle = "controller";
    box.ichId = "u-ctrl";
    globalThis.__weisungKo = ko({ status: "validiert", weisungsSichtung: SICHTUNG });
    box.fehler = {
      status: 409,
      code: "KO_STALE",
      message:
        "Das Wissensobjekt wurde inzwischen überarbeitet (jetzt Fassung 3, geprüft wurde Fassung 2). Es wurde nichts entschieden.",
    };
    await mount();
    const vorher = box.gelesen;
    await klick(muss("bib-weisung-bestaetigen"));
    expect(aufrufe("weisung-sichten")).toHaveLength(1);
    // Die Meldung des Servers steht da …
    expect(document.body.textContent).toContain("jetzt Fassung 3");
    // … und das Objekt wird neu gelesen, damit über die neue Fassung entschieden werden kann.
    expect(box.gelesen).toBeGreaterThan(vorher);
  });

  it("M6 · die Annahmezeile nennt die Kontoregel „Weisung“", async () => {
    globalThis.__weisungKo = ko({
      status: "validiert",
      weisungsSichtung: SICHTUNG,
      annahme: {
        fassung: 2,
        person: "u-experte",
        zeitpunkt: "2026-10-11T09:00:00.000Z",
        kontoregel: "weisung",
      },
    });
    await mount();
    const regel = muss("bib-annahme-regel");
    expect(regel.getAttribute("data-kontoregel")).toBe("weisung");
    expect(regel.textContent).toBe(i18n.t("pruefablauf.annahme.regel.weisung"));
  });
});
