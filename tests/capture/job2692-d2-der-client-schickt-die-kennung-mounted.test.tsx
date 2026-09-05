// @vitest-environment jsdom
// ================================================================================================
// JOB 2692 · D2 — DER CLIENT MUSS DIE KENNUNG MITSCHICKEN (Review-Befund 17, Korrektur zu D1)
// ================================================================================================
//
// PEDIS FRAGE: „Gilt die Vertraulichkeit meines Entwurfs auch beim Bildbeschreiben?"
//
// BEN an D1: „Der produktive Client sendet keine `draftId`; A1/B2 injizieren sie von Hand, und ein
// gemounteter Clienttest fehlt." Dieser Test schließt genau das: Die ECHTE Seite `CaptureArbeitsraum` wird
// gemountet, ein GESPEICHERTER vertraulicher Entwurf über „Fortsetzen" geöffnet (Liste → Knopf, wie
// der Mensch es tut), der Mensch stellt die Stufe im Formular auf „intern" (ungespeichert) und lässt
// ein Bild beschreiben bzw. den Text nachbearbeiten. Beobachtet wird, was der Client WIRKLICH an
// den Reasoner-Endpunkt gibt — niemand reicht eine Kennung nach.
//
// UND DANN DIE ZWEITE HÄLFTE, ohne die der Clientbeleg nur die halbe Kette wäre: genau das, was der
// Client gesendet hat, geht an die ECHTE Route der ECHTEN App (`buildApp`), in deren Bestand derselbe
// Entwurf liegt. Der Spion am `confidential`-Argument des Reasoners zeigt, ob die gespeicherte Stufe
// gilt. Kein Handwert dazwischen: die `draftId` stammt aus dem Entwurf, den der Server angelegt hat,
// und reist über die Entwurfsliste in die Seite und von dort in den Aufruf.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Der Entwurfsbestand, den die Seite sieht — gefüllt mit dem Entwurf, den die ECHTE App angelegt hat.
const db = vi.hoisted(() => ({
  store: [] as { id: string; payload: Record<string, unknown>; [k: string]: unknown }[],
}));
// Was der Client an die Reasoner-Endpunkte gibt — je Aufruf die Provenienz und den Kontext.
const gesendet = vi.hoisted(() => ({
  describe: [] as { dataUrl: string; provenance: Record<string, unknown>; context?: string }[],
  assist: [] as { input: string; provenance: Record<string, unknown> }[],
}));

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
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: vi.fn(async () => [...db.store]),
        get: vi.fn(async (id: string) => db.store.find((d) => d.id === id)),
        create: vi.fn(async () => ({ id: "d-neu" })),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      ko: { create: ok({ id: "ko-x" }), createFromDocument: ok({ id: "ko-x" }) },
      objects: { upload: ok({ id: "obj-x", size: 1 }) },
      reasoner: {
        status: ok({
          active: true,
          mode: "cloud",
          reachable: "active",
          tasks: { structure: true, assist: true, describe: true },
          billable: { structure: true, assist: true, describe: true },
        }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
        assist: vi.fn(
          async (input: string, _locale: unknown, _instruction: unknown, provenance: unknown) => {
            gesendet.assist.push({ input, provenance: provenance as Record<string, unknown> });
            return { text: "nachbearbeitet", demo: true };
          },
        ),
        describeImage: vi.fn(
          async (dataUrl: string, _locale: unknown, provenance: unknown, context?: string) => {
            gesendet.describe.push({
              dataUrl,
              provenance: provenance as Record<string, unknown>,
              ...(context !== undefined ? { context } : {}),
            });
            return { text: "Manometer am Kesselzulauf", demo: false };
          },
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
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Confidentiality } from "../../services/knowledge-object";
import { schreibeBeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// jsdom kennt showModal()/close() des Dialogs nicht — derselbe minimale Polyfill wie mega69.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};
Object.defineProperty(HTMLDialogElement.prototype, "open", {
  configurable: true,
  get(this: HTMLDialogElement) {
    return this.hasAttribute("open");
  },
});

// 1×1-PNG — besteht die Bildprüfung des Clients (isSafeImgSrc) UND die der Route (Magic Bytes).
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
// Verankert wie ein Bild aus dem DOCX-Upload (figure + data-image-id): nur verankerte Bilder zeigt
// die Entwurfsgalerie (`extractBodyImages`); ein nacktes img wird beim /erfassen-Resume nicht
// nachverankert (das tut nur die Vordertür, mega69).
const BODY = `<p>Vor dem Bild</p><figure data-image-id="img-1"><img src="${PNG}" alt="" data-image-id="img-1"><figcaption data-image-id="img-1"></figcaption></figure><p>Der Kessel wird vor dem Anfahren entlüftet.</p>`;

type Dienste = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function settle(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
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

function maybeButtonByText(part: string): HTMLButtonElement | null {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  return btn instanceof HTMLButtonElement ? btn : null;
}

async function click(btn: HTMLButtonElement | null | undefined): Promise<void> {
  if (!btn) {
    throw new Error("Knopf fehlt");
  }
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

/** Der Weg des Menschen: Entwurfsliste aufklappen, „Fortsetzen" — der Entwurf kommt aus der Liste. */
async function entwurfFortsetzen(): Promise<void> {
  const expand = maybeButtonByText("Entwürfe anzeigen");
  if (expand) {
    await click(expand);
  }
  await click(buttonByText(i18n.t("capture.resume")));
}

/** Das Vertraulichkeits-Feld des Formulars (Auswahl mit der gespeicherten Stufe). */
async function stufeImFormular(): Promise<HTMLSelectElement> {
  const finde = (): HTMLSelectElement | undefined =>
    [...container.querySelectorAll("select")].find((s) =>
      [...s.options].some((o) => o.value === "vertraulich"),
    );
  let sel = finde();
  if (!sel) {
    const adv = maybeButtonByText(i18n.t("capture.advanced.title"));
    if (adv) {
      await click(adv);
    }
    sel = finde();
  }
  if (!sel) {
    throw new Error("Vertraulichkeits-Auswahl nicht gefunden");
  }
  return sel;
}

/** Bild in der Galerie → Großansicht → „Bildbeschreibung bearbeiten" → Vorschlag anfordern. */
async function bildBeschreibenLassen(): Promise<void> {
  await settle(350); // Galerie ist debounced (300 ms)
  const thumb = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Bild 1 vergrößern"]',
  );
  expect(thumb, "Galerie-Thumbnail des Entwurfsbilds fehlt").not.toBeNull();
  await click(thumb);
  const edit = container.querySelector<HTMLButtonElement>('[data-testid="gallery-caption-edit"]');
  expect(edit, "die Großansicht bietet keinen Weg zur Bildbeschreibung").not.toBeNull();
  await click(edit);
  await settle(0);
  expect(container.querySelector("#caption-form-text"), "Formular nicht offen").not.toBeNull();
  await act(async () => {
    schreibeBeschreibung("Kesselzulauf mit Manometer");
  });
  const suggest = container.querySelector<HTMLButtonElement>(
    '[data-testid="caption-form-suggest"]',
  );
  expect(suggest, "der Vorschlags-Knopf fehlt").not.toBeNull();
  expect(suggest?.disabled, "der Vorschlags-Knopf ist ausgegraut").toBe(false);
  await click(suggest);
  await settle(0);
}

/** Die ECHTE App: Entwurf im Bestand anlegen, Nutzer anmelden, Spion am Reasoner setzen. */
async function echteApp(stufe: Confidentiality): Promise<{
  services: Dienste;
  app: App;
  headers: Record<string, string>;
  draftId: string;
  describeSpy: ReturnType<typeof vi.fn>;
  assistSpy: ReturnType<typeof vi.fn>;
}> {
  const services = buildServices();
  const describeSpy = vi.fn(async () => ({
    text: null,
    demo: true as const,
    fallbackReason: "no-model" as const,
  }));
  const assistSpy = vi.fn(async () => ({ text: "x", demo: true }));
  const r = services.reasoner as unknown as Record<string, unknown>;
  r.describeImage = describeSpy;
  r.assistText = assistSpy;
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pia", email: "pia@job2692.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pia@job2692.test", password: "geheim12345" },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  const entwurf = await services.capture.createDraft(
    {
      title: "Kesselwartung",
      statement: "Der Kessel wird vor dem Anfahren entlüftet.",
      bodyHtml: BODY,
      origin: "expert",
      confidentiality: stufe,
    },
    "u1",
  );
  return { services, app, headers, draftId: entwurf.id, describeSpy, assistSpy };
}

/** Der Bestand, den die SEITE sieht, ist derselbe Entwurf — mit der Kennung aus der echten App. */
function seiteSiehtEntwurf(draftId: string, stufe: Confidentiality): void {
  db.store.length = 0;
  db.store.push({
    id: draftId,
    payload: {
      title: "Kesselwartung",
      statement: "Der Kessel wird vor dem Anfahren entlüftet.",
      bodyHtml: BODY,
      origin: "expert",
      confidentiality: stufe,
    },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-08-29T07:00:00.000Z",
    updatedAt: "2026-08-29T07:00:00.000Z",
  });
}

const vertraulichBei = (spy: ReturnType<typeof vi.fn>, index: number): unknown =>
  (spy.mock.calls.at(-1) as unknown[] | undefined)?.[index];

beforeEach(async () => {
  await i18n.changeLanguage("de");
  gesendet.describe.length = 0;
  gesendet.assist.length = 0;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("JOB 2692 D2 · der Client schickt die Kennung — und der Server hebt damit", () => {
  it("BILD: gespeichert ‹vertraulich›, Formular auf ‹intern› gestellt → der Client sendet source/intern/draftId aus dem Entwurf; die echte Route hält das Bild aus der Cloud", async () => {
    const echt = await echteApp("vertraulich");
    seiteSiehtEntwurf(echt.draftId, "vertraulich");
    await mount();
    await entwurfFortsetzen();

    // Der Mensch stellt die Stufe um — ungespeichert. Der Client wird ab jetzt „intern" sagen.
    const sel = await stufeImFormular();
    expect(sel.value, "der fortgesetzte Entwurf zeigt seine gespeicherte Stufe").toBe(
      "vertraulich",
    );
    await change(sel, "intern");

    await bildBeschreibenLassen();

    // (1) DER CLIENT: genau ein describe-Aufruf, mit der Kennung des fortgesetzten Entwurfs —
    //     nicht von Hand gesetzt, sondern aus der Liste über „Fortsetzen" in den Zustand gelangt.
    expect(gesendet.describe).toHaveLength(1);
    const { dataUrl, provenance, context } = gesendet.describe[0] as {
      dataUrl: string;
      provenance: Record<string, unknown>;
      context?: string;
    };
    expect(dataUrl).toBe(PNG);
    expect(provenance).toEqual({
      source: "draft",
      confidentiality: "intern",
      draftId: echt.draftId,
    });

    // (2) DER SERVER: dasselbe, was der Client gesendet hat, an die echte Route — die
    //     gespeicherte Stufe hebt; das Bild erreicht die Cloud-Vision nicht.
    const res = await echt.app.inject({
      method: "POST",
      url: "/api/reasoner/describe",
      headers: echt.headers,
      payload: { dataUrl, ...provenance, ...(context ? { context } : {}) },
    });
    expect(res.statusCode).toBe(200);
    expect(echt.describeSpy).toHaveBeenCalledTimes(1);
    expect(vertraulichBei(echt.describeSpy, 2), "die gespeicherte Stufe hat nicht gehoben").toBe(
      true,
    );
  });

  it("GEGENPROBE BILD: gespeichert ‹intern› → derselbe Weg, dieselbe Kennung, und die Cloud bleibt erreichbar", async () => {
    const echt = await echteApp("intern");
    seiteSiehtEntwurf(echt.draftId, "intern");
    await mount();
    await entwurfFortsetzen();
    await bildBeschreibenLassen();

    expect(gesendet.describe).toHaveLength(1);
    const { dataUrl, provenance } = gesendet.describe[0] as {
      dataUrl: string;
      provenance: Record<string, unknown>;
    };
    expect(provenance).toEqual({
      source: "draft",
      confidentiality: "intern",
      draftId: echt.draftId,
    });
    const res = await echt.app.inject({
      method: "POST",
      url: "/api/reasoner/describe",
      headers: echt.headers,
      payload: { dataUrl, ...provenance },
    });
    expect(res.statusCode).toBe(200);
    expect(vertraulichBei(echt.describeSpy, 2)).toBe(false);
  });

  it("TEXT: KI-Nachbearbeitung im fortgesetzten vertraulichen Entwurf, Formular auf ‹intern› → assist trägt die Kennung; die echte Route hält den Text aus der Cloud", async () => {
    const echt = await echteApp("vertraulich");
    seiteSiehtEntwurf(echt.draftId, "vertraulich");
    await mount();
    await entwurfFortsetzen();
    const sel = await stufeImFormular();
    await change(sel, "intern");

    // Die KI-Nachbearbeitung im Expertenmodus: freie Anweisung tippen, ausführen.
    const frei = [...container.querySelectorAll("input")].find(
      (i) => i.getAttribute("aria-label") === i18n.t("capture.ai.freeLabel"),
    );
    expect(frei, "das Feld für die freie KI-Anweisung fehlt").toBeDefined();
    await change(frei as HTMLInputElement, "kürzer fassen");
    await click(buttonByText(i18n.t("capture.ai.run")));

    expect(gesendet.assist).toHaveLength(1);
    const { input, provenance } = gesendet.assist[0] as {
      input: string;
      provenance: Record<string, unknown>;
    };
    expect(input).toContain("Kessel");
    expect(provenance).toEqual({
      source: "draft",
      confidentiality: "intern",
      draftId: echt.draftId,
    });

    const res = await echt.app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: echt.headers,
      payload: { task: "assist", text: input, instruction: "kürzer fassen", ...provenance },
    });
    expect(res.statusCode).toBe(200);
    expect(echt.assistSpy).toHaveBeenCalledTimes(1);
    expect(vertraulichBei(echt.assistSpy, 3), "die gespeicherte Stufe hat nicht gehoben").toBe(
      true,
    );
  });
});
