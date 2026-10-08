// @vitest-environment jsdom
// ================================================================================================
// R-1624 · FOTO-ZU-WISSEN — der Durchstich am ECHTEN Erfassungs-Arbeitsraum.
// ================================================================================================
//
// „Der Experte fotografiert einen Schaden, eine Schweißnaht, ein Bauteil. KLARWERK erkennt aus dem
// Bild Kontext (Maschine, Bauteil-Typ) und stellt gezielte Rückfragen … — und baut daraus ein
// Wissensobjekt mit Bild-Anker."
//
//   D1  Foto → „Bild auswerten" (EIN describe-Aufruf mit dem Foto) → „Foto-Interview starten":
//       der erste Interview-Turn trägt den Befund, der Bild-Anker steht sofort im Rumpf und wird
//       mit dem Entwurf gesichert.
//   D2  Jeder weitere Turn trägt denselben Befund; nach Fehler · Ursache · Lösung steht die
//       Wissensseite UNTER dem Anker im gesicherten Entwurf.
//   D3  Das bisherige Interview ohne Foto schickt keinen Befund — unverändert.
// Der Server ist ersetzt: Entwürfe laufen über den echten CaptureService im Speicher, das Modell
// über einen festen Interviewdienst. jsdom hat keine Canvas-Pipeline — das Verkleinern liefert ein
// festes 1×1-PNG.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fix = vi.hoisted(() => ({
  PNG: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  BEFUND: "Kehlnaht an einem Stahlträger mit Riss am Nahtübergang.",
}));

const box = vi.hoisted(() => ({
  reset: (): void => {},
  created: [] as Record<string, unknown>[],
  // Der GESPEICHERTE Stand im echten CaptureService (nach dessen Normalisierung) — nicht der
  // Client-Payload. Daran misst D4, was ein Wiederöffnen tatsächlich vorfindet.
  gespeichert: async (): Promise<Record<string, unknown>[]> => [],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apps/web/src/lib/files")>();
  return { ...actual, fileToThumbDataUrl: vi.fn(async () => fix.PNG) };
});

// Die Verfügbarkeit der KI ist nicht Gegenstand dieses Tests — sie ist an.
vi.mock("../../apps/web/src/lib/useAiAvailable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apps/web/src/lib/useAiAvailable")>();
  return {
    ...actual,
    useAiAvailable: () => ({ available: true, isLoading: false, statusUnknown: false }),
  };
});

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    box.created.length = 0;
  };
  box.gespeichert = async () =>
    (await svc.listDrafts()).map((d) => d.payload as unknown as Record<string, unknown>);
  const ok = <T,>(v: T) => vi.fn(async () => v);
  const leer = {
    title: "",
    statement: "",
    conditions: [],
    measures: [],
    tags: [],
    confidence: 0,
    demo: false,
  };
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        create: vi.fn(async (p: P) => {
          box.created.push(p);
          return svc.createDraft(p, "u1");
        }),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        describeImage: vi.fn(async () => ({ text: fix.BEFUND, demo: false })),
        // Fester Interviewdienst: drei Fragen, danach verdichtet — wie die Foto-Fragenfolge.
        interview: vi.fn(async (answers: string[]) =>
          answers.length >= 3
            ? {
                question: null,
                done: true,
                demo: false,
                draft: {
                  ...leer,
                  title: answers[0],
                  statement: answers[0],
                  conditions: [answers[1]],
                  measures: [answers[2]],
                },
              }
            : { question: `Frage ${answers.length + 1}?`, done: false, demo: false, draft: leer },
        ),
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
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const interviewMock = vi.mocked(endpoints.reasoner.interview);
const describeMock = vi.mocked(endpoints.reasoner.describeImage);

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const nav = { proceeded: false };
let modus: "interview" | undefined;
let zeichnen: (() => Promise<void>) | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

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
  const zeichne = async (): Promise<void> => {
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
                        element: createElement(CaptureArbeitsraum, { modus }),
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
  };
  zeichnen = zeichne;
  await zeichne();
  await act(flush);
}

async function zumInterview(): Promise<void> {
  modus = "interview";
  if (!zeichnen) {
    throw new Error("zumInterview vor mount() gerufen");
  }
  await zeichnen();
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

async function change(el: HTMLElement, value: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

function antwortFeld(): HTMLTextAreaElement {
  const el = [...container.querySelectorAll("textarea")].find(
    (i) => i.placeholder === i18n.t("capture.ivAnswerHint"),
  );
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error("Antwortfeld des Interviews nicht gefunden");
  }
  return el;
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

async function fotoWaehlenUndAuswerten(): Promise<void> {
  const input = container.querySelector<HTMLInputElement>(
    '[data-foto-interview] input[type="file"]',
  );
  if (!input) {
    throw new Error("Kein Fotofeld im Interview-Einstieg");
  }
  const datei = new File([new Uint8Array([1, 2, 3])], "naht.jpg", { type: "image/jpeg" });
  Object.defineProperty(input, "files", { configurable: true, value: [datei] });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await click(buttonByText(i18n.t("fotowissen.auswerten")));
}

async function sichern(): Promise<Record<string, unknown>> {
  nav.proceeded = false;
  await click(
    container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
  );
  await click(buttonByText(i18n.t("nav.guard.save")));
  expect(nav.proceeded).toBe(true);
  const gesichert = box.created.at(-1);
  if (!gesichert) {
    throw new Error("Es wurde kein Entwurf gesichert");
  }
  return gesichert;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  nav.proceeded = false;
  box.reset();
});

afterEach(() => {
  modus = undefined;
  zeichnen = null;
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("R-1624 D1 · Foto → Befund → erster Turn, Bild-Anker im Entwurf", () => {
  it("ein describe-Aufruf mit dem Foto; der Turn trägt den Befund; der Anker wird gesichert", async () => {
    await mount();
    await zumInterview();
    expect(describeMock).not.toHaveBeenCalled();

    await fotoWaehlenUndAuswerten();
    expect(describeMock).toHaveBeenCalledTimes(1);
    expect(describeMock.mock.calls[0]?.[0]).toBe(fix.PNG);
    expect(interviewMock).not.toHaveBeenCalled();

    await click(buttonByText(i18n.t("fotowissen.starten")));
    expect(interviewMock).toHaveBeenCalledTimes(1);
    expect(interviewMock.mock.calls[0]?.[0]).toEqual([]);
    expect(interviewMock.mock.calls[0]?.[3]).toBe(fix.BEFUND);
    // Sichtbar, worauf sich die Rückfragen beziehen.
    expect(pageText()).toContain(i18n.t("fotowissen.laeuft"));
    expect(pageText()).toContain(fix.BEFUND);
    expect(pageText()).toContain("Frage 1?");

    const entwurf = await sichern();
    const body = String(entwurf.bodyHtml ?? "");
    expect(body).toContain("<figure");
    expect(body).toContain(`src="${fix.PNG}"`);
    expect(body).toMatch(new RegExp(`<figcaption[^>]*>${fix.BEFUND}</figcaption>`));
  });
});

describe("R-1624 D2 · Fehler · Ursache · Lösung → Wissensseite unter dem Anker", () => {
  it("jeder Turn trägt den Befund; der gesicherte Entwurf hat Anker, dann die Seite", async () => {
    await mount();
    await zumInterview();
    await fotoWaehlenUndAuswerten();
    await click(buttonByText(i18n.t("fotowissen.starten")));

    const antworten = [
      "Riss am Nahtübergang der Kehlnaht.",
      "Wasserstoffversprödung durch feuchte Elektroden.",
      "Elektroden trocknen, Naht ausschleifen und neu schweißen.",
    ];
    for (const antwort of antworten) {
      await change(antwortFeld(), antwort);
      await click(buttonByText(i18n.t("capture.ivSend")));
    }

    expect(interviewMock).toHaveBeenCalledTimes(4);
    for (const aufruf of interviewMock.mock.calls) {
      expect(aufruf[3]).toBe(fix.BEFUND);
    }
    expect(interviewMock.mock.calls[3]?.[0]).toEqual(antworten);

    const entwurf = await sichern();
    const body = String(entwurf.bodyHtml ?? "");
    const anker = body.indexOf("<figure");
    const seite = body.indexOf("<h2>Fehlerbild</h2>");
    expect(anker).toBeGreaterThanOrEqual(0);
    expect(seite).toBeGreaterThan(anker);
    expect(body).toContain("<h3>Vermutete Ursache</h3>");
    expect(body).toContain("Wasserstoffversprödung durch feuchte Elektroden.");
    expect(body).toContain("<h3>Lösung</h3>");
    expect(body).toContain("Elektroden trocknen, Naht ausschleifen und neu schweißen.");
    // Das Bild steht genau EINMAL im Rumpf — die fertige Seite fügt keinen zweiten Anker ein.
    expect(body.split(fix.PNG)).toHaveLength(2);
  });
});

async function fortsetzen(): Promise<void> {
  const aufklappen = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes("Entwürfe anzeigen"),
  );
  if (aufklappen instanceof HTMLButtonElement) {
    await click(aufklappen);
  }
  await click(buttonByText(i18n.t("capture.resume")));
}

describe("R-1624 D4 · ein gespeichertes Foto-Interview bleibt beim Wiederöffnen eines", () => {
  it("Befund wird gesichert und wiederhergestellt; weitere Turns tragen ihn; Seite unter dem Anker", async () => {
    await mount();
    await zumInterview();
    await fotoWaehlenUndAuswerten();
    await click(buttonByText(i18n.t("fotowissen.starten")));
    await change(antwortFeld(), "Riss am Nahtübergang der Kehlnaht.");
    await click(buttonByText(i18n.t("capture.ivSend")));
    expect(pageText()).toContain("Frage 2?");

    // Mitten im Interview sichern: der GESPEICHERTE Fortschritt trägt den Befund.
    await sichern();
    const [stand] = await box.gespeichert();
    const fortschritt = stand?.interview as Record<string, unknown> | undefined;
    expect(fortschritt?.answers).toEqual(["Riss am Nahtübergang der Kehlnaht."]);
    expect(fortschritt?.imageContext).toBe(fix.BEFUND);
    expect(String(stand?.bodyHtml ?? "")).toContain(`src="${fix.PNG}"`);

    // Wiederöffnen: weiterhin ein Foto-Interview — sichtbar und im nächsten Turn.
    const vorher = interviewMock.mock.calls.length;
    await fortsetzen();
    expect(pageText()).toContain(i18n.t("fotowissen.laeuft"));
    expect(pageText()).toContain(fix.BEFUND);
    // Fortsetzen startet keinen Modelllauf von selbst (bestehender Vertrag, mega5 Block A).
    expect(interviewMock.mock.calls.length).toBe(vorher);

    await change(antwortFeld(), "Wasserstoffversprödung durch feuchte Elektroden.");
    await click(buttonByText(i18n.t("capture.ivSend")));
    await change(antwortFeld(), "Elektroden trocknen, Naht ausschleifen und neu schweißen.");
    await click(buttonByText(i18n.t("capture.ivSend")));

    const nachher = interviewMock.mock.calls.slice(vorher);
    expect(nachher).toHaveLength(2);
    for (const aufruf of nachher) {
      expect(aufruf[3]).toBe(fix.BEFUND);
    }

    // Abschluss: die Foto-Wissensseite steht UNTER dem gesicherten Anker, das Bild genau einmal.
    await sichern();
    const [fertig] = await box.gespeichert();
    const body = String(fertig?.bodyHtml ?? "");
    const anker = body.indexOf("<figure");
    const seite = body.indexOf("<h2>Fehlerbild</h2>");
    expect(anker).toBeGreaterThanOrEqual(0);
    expect(seite).toBeGreaterThan(anker);
    expect(body).toContain("Elektroden trocknen, Naht ausschleifen und neu schweißen.");
    expect(body.split(fix.PNG)).toHaveLength(2);
  });
});

describe("R-1624 D3 · das Interview ohne Foto bleibt unverändert", () => {
  it("„Interview starten“ schickt keinen Befund und fügt kein Bild ein", async () => {
    await mount();
    await zumInterview();
    await click(buttonByText(i18n.t("capture.ivStart")));
    expect(interviewMock).toHaveBeenCalledTimes(1);
    expect(interviewMock.mock.calls[0]?.[3]).toBeUndefined();
    expect(describeMock).not.toHaveBeenCalled();
    expect(pageText()).not.toContain(i18n.t("fotowissen.laeuft"));
  });
});
