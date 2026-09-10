// @vitest-environment jsdom
// JOB 3427: echtes Blatt, echter Hook und API-Serializer; nur der HTTP-Transport ist gestellt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  antwort: { status: "done", similar: [], conflicts: [] } as unknown,
  fehler: false,
  /** Die Uhr des Dienstes — jeder Entwurf bekommt seinen eigenen, gemessenen Zeitpunkt. */
  zeit: 0,
  zaehler: { get: 0, list: 0, remove: 0 },
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  const bauen = (): InstanceType<typeof CaptureService> =>
    new CaptureService({ repo: new InMemoryDraftRepo(), now: () => box.zeit });
  let svc = bauen();
  box.reset = () => {
    box.zeit = Date.parse("2026-09-01T08:00:00.000Z");
    svc = bauen();
    box.zaehler.get = 0;
    box.zaehler.list = 0;
    box.zaehler.remove = 0;
  };
  box.seed = async (p: P) => {
    // Jeder Entwurf eine Minute später als der vorige: die Ordnung „neueste zuerst" ist damit
    // eine Tatsache des Bestands, nicht eine Folge der Einfügereihenfolge.
    box.zeit += 60_000;
    return (await svc.createDraft(p, "u1")).id;
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(async () => {
          box.zaehler.list += 1;
          return svc.listDrafts();
        }),
        get: vi.fn(async (id: string) => {
          box.zaehler.get += 1;
          return svc.getDraft(id);
        }),
        create: vi.fn(async (p: P) => {
          box.zeit += 60_000;
          return svc.createDraft(p, "u1");
        }),
        update: vi.fn(async (id: string, p: P) => {
          box.zeit += 60_000;
          return svc.continueDraft(id, p, "u1");
        }),
        remove: vi.fn(async (id: string) => {
          box.zaehler.remove += 1;
          return svc.deleteDraft(id);
        }),
        promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
      },
      ko: { list: ok([]) },
      knowledge: (
        await vi.importActual<typeof import("../../apps/web/src/api/endpoints")>(
          "../../apps/web/src/api/endpoints",
        )
      ).endpoints.knowledge,
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      gaps: { list: ok([]) },
      reasoner: {
        status: ok({ active: false, mode: "off", reachable: "unknown" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
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
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { DRAFT, appWith, conflictVerdict } from "./fixture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-testid": "adresse" }, `${ort.pathname}${ort.search}`);
}

async function mount(url = "/erfassen"): Promise<QueryClient> {
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
                { initialEntries: [url] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement(CaptureFrontDoor),
                      }),
                    ),
                    createElement(Adresse),
                  ),
                ),
              ),
              createElement(ToastViewport),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return qc;
}

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

const TEXT = DRAFT;
let server: Awaited<ReturnType<typeof appWith>>;
let drahtAntwort: { status: string; similar: unknown[] } | undefined;
const MATCH = {
  id: "kc",
  title: "Kaltstart Vorwärmung",
  score: 0.8,
  koStatus: "offen",
  koCategory: "Anlage",
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  box.reset();
  box.fehler = false;
  box.antwort = undefined;
  drahtAntwort = undefined;
  server = await appWith({ active: true, verdict: conflictVerdict });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/api/knowledge/check");
      if (box.fehler) throw new Error("offline");
      if (box.antwort !== undefined) return new Response(JSON.stringify(box.antwort));
      const response = await server.app.inject({
        method: "POST",
        url,
        payload: JSON.parse(String(init?.body)),
      });
      drahtAntwort = response.json();
      return new Response(response.body, { status: response.statusCode });
    }),
  );
});
afterEach(async () => {
  if (container?.isConnected) unmount();
  await server.app.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function gespeichertesBlatt(): Promise<void> {
  const id = await box.seed({
    title: "Kaltstart",
    bodyHtml: `<p>${TEXT}</p>`,
    confidentiality: "intern",
  });
  await mount(`/erfassen?draft=${id}`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
  });
  expect(fetch).toHaveBeenCalledWith(
    "/api/knowledge/check",
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining(TEXT),
    }),
  );
}

function chip(): Element | null {
  return container.querySelector('[data-testid="blatt-live-chip"]');
}
function hinweis(): Element | null {
  return container.querySelector('[data-testid="blatt-live-ausfall"]');
}

describe("Live-Prüfung im gemounteten Editor", () => {
  it("pending mit Ähnlichkeit sagt sichtbar nicht geprüft, ohne falsche Nulltrefferaussage", async () => {
    box.antwort = { status: "pending", similar: [MATCH], conflicts: [] };
    await gespeichertesBlatt();
    expect(chip()?.getAttribute("data-lage")).toBe("similar");
    expect(hinweis()?.textContent).toBe("Auf Widerspruch noch nicht geprüft.");
    expect(container.textContent).not.toContain("Ähnliches gefunden? Nein.");
  });
  it("failed mit Treffern zeigt den Ausfall vor der Ähnlichkeit", async () => {
    box.antwort = { status: "failed", similar: [MATCH], conflicts: [MATCH] };
    await gespeichertesBlatt();
    expect(chip()?.getAttribute("data-lage")).toBe("similar");
    expect(hinweis()?.textContent).toBe("Prüfung derzeit nicht verfügbar.");
  });
  it("Netzwerkfehler ist ohne Öffnen des Statusmenüs sichtbar", async () => {
    box.fehler = true;
    await gespeichertesBlatt();
    expect(chip()).toBeNull();
    expect(hinweis()?.textContent).toBe("Prüfung derzeit nicht verfügbar.");
  });
  it("Darstellungsvertrag: kalibriertes Konfliktergebnis zeigt Treffer, Fundort und Link", async () => {
    // Das sichtbare Ergebnis kommt aus der echten Konfliktkette mit lokalem Fixture-Judge.
    // Die Kalibrieranfrage ist kein Beleg für die noch fehlende Entwurfsbindung im Editor.
    const response = await server.app.inject({
      method: "POST",
      url: "/api/knowledge/check",
      payload: {
        text: TEXT,
        source: "draft",
        confidentiality: "intern",
        koId: "kc",
      },
    });
    expect(server.judgeConflict).toHaveBeenCalled();
    box.antwort = response.json();
    await gespeichertesBlatt();
    expect(chip()?.getAttribute("data-lage")).toBe("conflict");
    await act(async () => {
      (chip()?.querySelector("button") as HTMLButtonElement).click();
    });
    expect(chip()?.textContent).toContain("Kaltstart Vorwärmung");
    expect(chip()?.textContent).toContain("Anlage");
    expect(chip()?.querySelector("a")?.getAttribute("href")).toBe("/wissen/kc");
    expect(hinweis()).toBeNull();
  });
  it("Darstellungsvertrag (Stub, kein Teil-A-Beleg): abgeschlossene Ähnlichkeit", async () => {
    box.antwort = { status: "done", similar: [MATCH], conflicts: [] };
    await gespeichertesBlatt();
    expect(chip()?.getAttribute("data-lage")).toBe("similar");
  });
  it("Darstellungsvertrag (Stub, kein Teil-A-Beleg): nur done ohne Treffer zeigt neu", async () => {
    box.antwort = { status: "done", similar: [], conflicts: [] };
    await gespeichertesBlatt();
    expect(chip()?.getAttribute("data-lage")).toBe("new");
  });
});

it.each([
  ["de", "Auf Widerspruch noch nicht geprüft."],
  ["en", "Conflict check not yet run."],
  ["nl", "Nog niet op tegenstrijdigheid gecontroleerd."],
])("echte Route ohne Modell sagt auf %s ehrlich nicht geprüft", async (locale, sentence) => {
  await i18n.changeLanguage(locale);
  await server.app.close();
  server = await appWith({ active: false });
  await gespeichertesBlatt();
  expect(server.judgeConflict).not.toHaveBeenCalled();
  expect(hinweis()?.textContent).toBe(sentence);
  await pruefeAehnlichenFundort();
});

it("ungespeicherter Text bleibt am echten Draht pending ohne Judge; derselbe Spy ist wirksam", async () => {
  await mount();
  const editor = container.querySelector('[role="textbox"]');
  expect(editor).toBeInstanceOf(HTMLElement);
  await act(async () => {
    if (editor) {
      editor.innerHTML = `<p>${TEXT}</p>`;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await flush();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
  });
  expect(fetch).toHaveBeenCalled();
  expect(server.judgeConflict).not.toHaveBeenCalled();
  expect(hinweis()?.textContent).toBe("Auf Widerspruch noch nicht geprüft.");
  await pruefeAehnlichenFundort();
  const calibration = await server.app.inject({
    method: "POST",
    url: "/api/knowledge/check",
    payload: {
      text: TEXT,
      source: "draft",
      confidentiality: "intern",
      koId: "kc",
    },
  });
  expect(calibration.json().status).toBe("done");
  expect(server.judgeConflict).toHaveBeenCalled();
});

async function pruefeAehnlichenFundort(): Promise<void> {
  expect(chip()?.getAttribute("data-lage")).toBe("similar");
  await act(async () => {
    (chip()?.querySelector("button") as HTMLButtonElement).click();
  });
  const fundort = chip()?.querySelector('[data-testid="live-fundort"]');
  expect(fundort?.textContent).toContain("Anlage");
  expect(fundort?.textContent).toContain(i18n.t("status.offen"));
  expect(chip()?.querySelector("a")?.getAttribute("href")).toBe("/wissen/kc");
  expect(chip()?.querySelector("a")?.textContent).toBe("Kaltstart Vorwärmung");
}

it("echter Editor mit aktivem Modell: pending UND Ähnlichkeit mit Fundort und Link", async () => {
  await gespeichertesBlatt();
  expect(fetch).toHaveBeenCalledWith(
    "/api/knowledge/check",
    expect.objectContaining({ body: JSON.stringify({ text: TEXT }) }),
  );
  expect(drahtAntwort?.status).toBe("pending");
  expect(drahtAntwort?.similar).toHaveLength(1);
  expect(server.judgeConflict).not.toHaveBeenCalled();
  console.info(
    `LIVE-MESSUNG status=${drahtAntwort?.status} similarAnzahl=${drahtAntwort?.similar.length} judgeAufgerufen=${server.judgeConflict.mock.calls.length > 0}`,
  );
  expect(hinweis()?.textContent).toBe("Auf Widerspruch noch nicht geprüft.");
  await pruefeAehnlichenFundort();
  expect(hinweis()?.textContent).toBe("Auf Widerspruch noch nicht geprüft.");
});

it.each(["pending", "failed"])(
  "Serializer lässt den %s-Serverbefund vollständig stehen",
  async (status) => {
    box.antwort = { status, similar: [MATCH], conflicts: [MATCH] };
    expect(await endpoints.knowledge.check(TEXT)).toEqual(box.antwort);
  },
);

it.each(["pending", "failed"])(
  "Darstellungsvertrag: %s ohne Treffer behauptet weder neu noch ähnlich",
  async (status) => {
    box.antwort = { status, similar: [], conflicts: [] };
    await gespeichertesBlatt();
    expect(chip()).toBeNull();
    expect(hinweis()?.textContent).toBe(
      status === "pending"
        ? "Auf Widerspruch noch nicht geprüft."
        : "Prüfung derzeit nicht verfügbar.",
    );
  },
);

it("eine verspätete Antwort darf nach dem Leeren weder Treffer noch Prüfstatus zurückbringen", async () => {
  let antworten: (response: Response) => void = () => {
    throw new Error("Anfrage fehlt");
  };
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        antworten = resolve;
      }),
  );
  await gespeichertesBlatt();
  const editor = container.querySelector('[role="textbox"]');
  expect(editor).toBeInstanceOf(HTMLElement);
  await act(async () => {
    if (editor) {
      editor.innerHTML = "";
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await flush();
  });
  await act(async () => {
    antworten(new Response(JSON.stringify({ status: "pending", similar: [MATCH], conflicts: [] })));
    await flush();
  });
  expect(chip()).toBeNull();
  expect(hinweis()).toBeNull();
});
