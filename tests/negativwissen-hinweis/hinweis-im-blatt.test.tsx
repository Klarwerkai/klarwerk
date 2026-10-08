// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · NEGATIVWISSEN-HINWEIS (R-1629) — DER HINWEIS IM GEMOUNTETEN BLATT.
// ================================================================================================
//
// Originalpunkt (Roadmap 2.3): „Wenn jemand eine Lösung vorschlägt, die in der
// Negativwissens-Bibliothek bereits als ‚haben wir probiert, ging nicht' dokumentiert ist, blendet
// KLARWERK das proaktiv ein — bevor der Fehler ein zweites Mal gemacht wird."
//
// Gemessen wird die GANZE Kette, Bauform wie tests/live-check-verdrahtung/editor-mounted.test.tsx:
//   echte Route `knowledgeCheckRoutes` → `checkKnowledge` → JSON am Draht → echter Serializer
//   (`endpoints.knowledge`) → echter Hook → echtes Blatt (`CaptureFrontDoor`) → sichtbarer Text.
// Gestellt sind nur der HTTP-Transport (fetch → app.inject), Anmeldung und der Bestand.
//
// „PROAKTIV" wird am DOM abgelesen: der Hinweis steht offen auf dem Blatt, ohne dass ein Chip
// aufgeklappt oder ein Menü geöffnet wurde, und zwar auch dann, wenn die Widerspruchsprüfung
// nicht lief (kein Modell → „pending", der Normalfall).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  zeit: 0,
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  getDraft: async (_id: string): Promise<{ payload: { confidentiality?: unknown } } | undefined> =>
    undefined,
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
  };
  box.seed = async (p: P) => {
    box.zeit += 60_000;
    return (await svc.createDraft(p, "u1")).id;
  };
  box.getDraft = async (id: string) => svc.getDraft(id);
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
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

import Fastify, { type FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import type { Guards } from "../../services/app/src/http";
import {
  type KnowledgeCheckRouteDeps,
  knowledgeCheckRoutes,
} from "../../services/app/src/routes/knowledge-check-routes";
import { ConflictService, InMemoryConflictRepo } from "../../services/conflicts";
import type { KnowledgeObject, KoService } from "../../services/knowledge-object";
import type { Reasoner } from "../../services/reasoner";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// Der Vorschlag im Entwurf und der dokumentierte Fehlschlag dazu (derselbe Bestand wie in
// `auskunft.test.ts`, dort ist die Ähnlichkeit über der Schwelle als Vorbedingung gemessen).
const ENTWURF = "Pumpe P3 bei Frost mit einem Heizband am Saugstutzen schützen.";
const BEGRUENDUNG =
  "Pumpe P3 bei Frost mit Heizband am Saugstutzen schützen: probiert, ging nicht — die Leitung friert oberhalb ein.";

function mkKo(over: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "nw-p3",
    type: "negativwissen",
    title: "Heizband am Saugstutzen der Pumpe P3",
    statement: BEGRUENDUNG,
    conditions: [],
    measures: [],
    category: "Pumpen",
    status: "validiert",
    confidentiality: "intern",
    tags: [],
    asset: null,
    ...over,
  } as unknown as KnowledgeObject;
}

let bestand: KnowledgeObject[] = [];
let server: FastifyInstance;

async function serverStarten(): Promise<FastifyInstance> {
  const ko = {
    findCandidates: vi.fn(async () => bestand),
    get: vi.fn(async (id: string) => bestand.find((k) => k.id === id)),
  } as unknown as KoService;
  // Kein Modell: die Widerspruchsprüfung läuft NICHT („pending") — genau der Fall, in dem der
  // Hinweis trotzdem erscheinen muss.
  const reasoner = {
    status: () => ({ active: false, provider: "cloud", mode: "off" }),
    judgeConflict: vi.fn(async () => null),
  } as unknown as Reasoner;
  // Der Server liest DENSELBEN Entwurfsbestand wie die Fläche (Entwurfs-Backstop der Route).
  const capture = {
    getDraft: (id: string) => box.getDraft(id),
  } as unknown as KnowledgeCheckRouteDeps["capture"];
  const app = Fastify();
  await app.register(
    knowledgeCheckRoutes({
      ko,
      conflicts: new ConflictService({ repo: new InMemoryConflictRepo() }),
      reasoner,
      guards: { requirePermission: async () => ({ id: "u1" }) } as unknown as Guards,
      capture,
    }),
  );
  return app;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string): Promise<void> {
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

// Ein gespeicherter Entwurf mit dem Vorschlag, geöffnet im Blatt; danach läuft der Debounce ab.
async function blattMitVorschlag(): Promise<void> {
  const id = await box.seed({
    title: "Frostschutz P3",
    bodyHtml: `<p>${ENTWURF}</p>`,
    confidentiality: "intern",
  });
  await mount(`/erfassen?draft=${id}`);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
  });
  await act(flush);
}

const hinweis = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="blatt-negativwissen"]');
const lesbar = (el: Element | null): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

interface Drahtantwort {
  status: string;
  similar: { id: string }[];
  negativwissen?: { id: string }[];
}
let drahtAntworten: Drahtantwort[] = [];
/** Die zuletzt am Draht gemessene Antwort der echten Route — nicht die, die der Test erwartet. */
function letzteAntwort(): Drahtantwort {
  const antwort = drahtAntworten[drahtAntworten.length - 1];
  if (antwort === undefined) {
    throw new Error("Es gab keine Anfrage an /knowledge/check.");
  }
  return antwort;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  box.reset();
  bestand = [];
  drahtAntworten = [];
  server = await serverStarten();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/api/knowledge/check");
      const response = await server.inject({
        method: "POST",
        url,
        payload: JSON.parse(String(init?.body)),
      });
      drahtAntworten.push(response.json() as Drahtantwort);
      return new Response(response.body, { status: response.statusCode });
    }),
  );
});

afterEach(async () => {
  if (container?.isConnected) {
    act(() => root.unmount());
    container.remove();
  }
  await server.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("de");
});

describe("NEGATIVWISSEN-HINWEIS · im gemounteten Blatt", () => {
  it("B1 · ähnlicher Fehlschlag: der Hinweis steht offen da — Titel, Grund, Link, Grenze", async () => {
    bestand = [mkKo({})];
    await blattMitVorschlag();

    // Der Draht trägt die Auskunft, und die Widerspruchsprüfung lief NICHT.
    const antwort = letzteAntwort();
    expect(antwort.status).toBe("pending");
    expect(antwort.negativwissen?.map((n) => n.id)).toEqual(["nw-p3"]);

    // Ohne Klick sichtbar — kein Chip aufgeklappt, kein Menü geöffnet.
    const h = hinweis();
    expect(h).not.toBeNull();
    const text = lesbar(h);
    expect(text).toContain(i18n.t("negativwissen.titel"));
    expect(text).toContain(i18n.t("negativwissen.einleitung"));
    expect(text).toContain("Heizband am Saugstutzen der Pumpe P3");
    expect(text).toContain("die Leitung friert oberhalb ein");
    expect(text).toContain(i18n.t("negativwissen.grenze"));
    expect(i18n.t("negativwissen.titel")).toBe("Achtung: Das wurde schon einmal probiert");

    // Der Eintrag öffnet sich in einem neuen Tab; der Entwurf bleibt stehen.
    const link = h?.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/wissen/nw-p3");
    expect(link?.getAttribute("target")).toBe("_blank");

    // Der Hinweis blockiert nichts: der Prüfstatus steht unverändert daneben.
    expect(lesbar(container.querySelector('[data-testid="blatt-live-ausfall"]'))).toBe(
      "Auf Widerspruch noch nicht geprüft.",
    );
  });

  it("B2 · ähnlicher Eintrag ohne Wissensart Negativwissen: kein Hinweis", async () => {
    bestand = [mkKo({ id: "bp-p3", type: "best_practice" })];
    await blattMitVorschlag();
    const antwort = letzteAntwort();
    expect(antwort.similar.map((s) => s.id)).toContain("bp-p3");
    expect("negativwissen" in antwort).toBe(false);
    expect(hinweis()).toBeNull();
  });

  it("B3 · vertraulicher Fehlschlag erscheint nicht", async () => {
    bestand = [mkKo({ confidentiality: "vertraulich" } as Partial<KnowledgeObject>)];
    await blattMitVorschlag();
    expect(hinweis()).toBeNull();
  });

  it("B4 · englische Oberfläche: der Hinweis spricht Englisch", async () => {
    bestand = [mkKo({})];
    await i18n.changeLanguage("en");
    await blattMitVorschlag();
    const text = lesbar(hinweis());
    expect(text).toContain("Heads-up: this has been tried before");
    expect(text).toContain("Heizband am Saugstutzen der Pumpe P3");
  });
});
