// @vitest-environment jsdom
// ================================================================================================
// Aufnahme gesamt-sprachassistent · R-0104 — WISSEN PER AUFNAHME ERFASSEN, am echten Blatt.
// ================================================================================================
//
// Bauform und Aufbau wie `tests/cap-p1-fruehe-eingabe/blatt-fruehe-eingabe.test.tsx`: die echte
// Vordertür, die Entwurfs-Endpunkte gegen den ECHTEN Dienst (CaptureService + InMemoryDraftRepo).
// Dazu ein Doppel für `MediaRecorder`/`navigator.mediaDevices` und ein Zähler für
// `media.transcribe`, dessen Antwort der Test bei Bedarf selbst freigibt.
//
//   E1 Aufnehmen → Stoppen: das Transkript steht als Absatz im Blatt; ohne gewählte Stufe geht
//      KEINE Stufe mit (der Server behandelt die Aufnahme dann als vertraulich). „Sichern" legt
//      daraus ohne ausgefülltes Feld einen Entwurf an (R-0105 auf demselben Weg).
//   E2 Mit gewählter Stufe reist genau diese Stufe mit.
//   E3 „Eingabe verwerfen", während die Aufnahme beim Server ist: das späte Transkript erreicht das
//      geleerte Blatt nicht (dieselbe Trennung wie beim Diktat, JOB 3256 N4).
//
// NICHT GEMESSEN: echtes Mikrofon, echter Transkriptionsdienst.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Rumpf {
  data: string;
  locale: string;
  confidentiality?: string;
}

const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  zaehler: { create: 0 },
  liste: async (): Promise<{ id: string; payload: Record<string, unknown> }[]> => [],
  transcribe: [] as Rumpf[],
  transkript: "Pumpe P2 vor dem Anfahren entlueften.",
  angehalten: false,
  freigeben: null as null | (() => void),
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
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    box.zaehler.create = 0;
    box.transcribe = [];
    box.angehalten = false;
    box.freigeben = null;
  };
  box.liste = async () => (await svc.listDrafts()) as unknown as { id: string; payload: P }[];
  box.seed = async (p: P) => (await svc.createDraft(p, "u1")).id;
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => {
          box.zaehler.create += 1;
          return svc.createDraft(p, "u1");
        }),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
      },
      media: {
        transcribe: vi.fn(async (rumpf: Rumpf) => {
          box.transcribe.push(rumpf);
          if (box.angehalten) {
            await new Promise<void>((res) => {
              box.freigeben = res;
            });
          }
          return {
            transcript: box.transkript,
            engineActive: true,
            engine: "openai:whisper-1",
            note: "Automatisches Transkript",
          };
        }),
      },
      ko: { list: ok([]) },
      knowledge: { check: ok({ status: "pending" }) },
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
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

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

// ---- Das Doppel der Browsergrenze ----------------------------------------------------------------
const spuren = { gestoppt: 0 };

class AufnahmeDoppel {
  static isTypeSupported(mime: string): boolean {
    return mime === "audio/webm";
  }
  state = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: unknown, optionen?: { mimeType?: string }) {
    this.mimeType = optionen?.mimeType ?? "";
  }
  start(): void {
    this.state = "recording";
  }
  stop(): void {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["gesprochen"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function aufnahmeAnmelden(): void {
  (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder = AufnahmeDoppel;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => ({
        getTracks: () => [
          {
            stop: () => {
              spuren.gestoppt += 1;
            },
          },
        ],
      }),
    },
  });
}

function aufnahmeAbmelden(): void {
  (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder = undefined;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
}

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

function knopf(name: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="${name}"]`);
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${name}" fehlt`);
  }
  return el;
}

async function klick(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function schreibfeld(): HTMLElement {
  const el = container.querySelector('[data-testid="blatt-text"] [role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Schreibfeld nicht gefunden");
  }
  return el;
}

async function tippeRumpf(html: string): Promise<void> {
  const feld = schreibfeld();
  await act(async () => {
    feld.innerHTML = html;
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

function menueEintrag(text: string): HTMLButtonElement {
  const el = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(text),
  );
  if (!el) {
    throw new Error(`Menüeintrag „${text}" fehlt`);
  }
  return el;
}

/** Aufnehmen und wieder anhalten — wie ein Mensch, zwei Klicks auf denselben Knopf. */
async function sprichEin(): Promise<void> {
  await klick(knopf("blatt-werkzeug-aufnehmen"));
  expect(knopf("blatt-werkzeug-aufnehmen").getAttribute("aria-pressed")).toBe("true");
  await klick(knopf("blatt-werkzeug-aufnehmen"));
  await act(flush);
}

const echtesConfirm = window.confirm;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
  spuren.gestoppt = 0;
  window.confirm = () => true;
  aufnahmeAnmelden();
});

afterEach(() => {
  window.confirm = echtesConfirm;
  act(() => root.unmount());
  container.remove();
  aufnahmeAbmelden();
  vi.clearAllMocks();
});

describe("R-0104 · Wissen per Aufnahme ins Blatt", () => {
  it("E1 · das Transkript wird ein Absatz — und „Sichern“ legt daraus ohne Formular einen Entwurf an", async () => {
    await mount("/erfassen");
    expect(knopf("blatt-werkzeug-aufnehmen").textContent).toContain(i18n.t("sprachaufnahme.start"));
    await sprichEin();

    expect(box.transcribe).toHaveLength(1);
    expect(box.transcribe[0]?.data.startsWith("data:audio/webm;base64,")).toBe(true);
    // Keine Wahl getroffen → keine Stufe auf dem Draht (der Server nimmt dann „vertraulich“ an).
    expect(Object.hasOwn(box.transcribe[0] as object, "confidentiality")).toBe(false);
    expect(spuren.gestoppt, "das Mikrofon läuft nach dem Stopp weiter").toBe(1);
    expect(schreibfeld().textContent).toContain("Pumpe P2 vor dem Anfahren entlueften.");

    await klick(knopf("blatt-entwurf-sichern"));
    expect(box.zaehler.create).toBe(1);
    const [entwurf] = await box.liste();
    expect(String(entwurf?.payload.title)).toBe("Pumpe P2 vor dem Anfahren entlueften.");
    expect(String(entwurf?.payload.bodyHtml)).toContain("Pumpe P2 vor dem Anfahren entlueften.");
  });

  it("E2 · mit gewählter Stufe reist genau diese Stufe mit", async () => {
    await mount("/erfassen");
    await klick(knopf("blatt-werkzeug-vertraulichkeit"));
    await klick(menueEintrag(i18n.t("conf.level.intern")));
    await sprichEin();
    expect(box.transcribe).toHaveLength(1);
    expect(box.transcribe[0]?.confidentiality).toBe("intern");
  });

  it("E3 · „Eingabe verwerfen“ während der Verschriftlichung: das späte Transkript bleibt draussen", async () => {
    await mount("/erfassen");
    await tippeRumpf("<p>Vorher getippt.</p>");
    box.angehalten = true;
    await sprichEin();
    expect(box.transcribe, "die Aufnahme ging nicht hinaus").toHaveLength(1);

    await klick(knopf("blatt-werkzeug-mehr"));
    await klick(menueEintrag(i18n.t("fd.discardInput")));
    await klick(knopf("blatt-rueckfrage-ja"));
    expect(schreibfeld().textContent ?? "").not.toContain("Vorher getippt.");

    await act(async () => {
      box.freigeben?.();
      await flush();
    });
    expect(container.textContent ?? "").not.toContain("Pumpe P2 vor dem Anfahren entlueften.");
    // Und der Knopf ist wieder bereit — die Trennung hat auch den Wartezustand beendet.
    expect(knopf("blatt-werkzeug-aufnehmen").disabled).toBe(false);
  });
});

// ================================================================================================
// Nacharbeit 3 (Bens Befund zu `useSprachaufnahme.ts:126`) — DAS FENSTER VOR DEM VERSAND.
// ================================================================================================
// Zwischen dem Ende der Aufnahme und dem Versand liegt das asynchrone Einlesen der Audiodaten
// (`FileReader`). E3 oben misst nur eine schon VERSANDTE Aufnahme. Hier hält ein Leser-Doppel das
// Einlesen an, und der Test gibt es selbst frei — erst so steht das Fenster wirklich offen.
//   E4 Verwerfen während des Einlesens: es geht NICHTS hinaus.
//   E5 Einen anderen Entwurf (mit eigener Stufe „intern") öffnen während des Einlesens: es geht
//      NICHTS hinaus — die alte Aufnahme bekommt weder die neue Stufe noch das neue Blatt.
//   E6 Die Stufe ändert sich nach dem Ende der Aufnahme: gesendet wird die Stufe des VORGANGS.
//   E7 Kalibrierung: ohne Eingriff geht nach der Freigabe des Lesers genau ein Aufruf hinaus.
const leser = { offen: [] as Array<() => void> };
const echterFileReader = globalThis.FileReader;

class AngehaltenerLeser {
  result: string | null = null;
  error: Error | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(_blob: Blob): void {
    leser.offen.push(() => {
      this.result = "data:audio/webm;base64,Z2VzcHJvY2hlbg==";
      this.onload?.();
    });
  }
}

async function leserFreigeben(): Promise<void> {
  await act(async () => {
    for (const weiter of leser.offen.splice(0)) {
      weiter();
    }
    await flush();
  });
}

describe("R-0104 · Nacharbeit 3: getrennt während des Einlesens heisst nicht gesendet", () => {
  beforeEach(() => {
    leser.offen = [];
    (globalThis as unknown as { FileReader: unknown }).FileReader = AngehaltenerLeser;
  });
  afterEach(() => {
    (globalThis as unknown as { FileReader: unknown }).FileReader = echterFileReader;
  });

  it("E7 · Kalibrierung: der Leser hält wirklich an — erst seine Freigabe sendet, genau einmal", async () => {
    await mount("/erfassen");
    await sprichEin();
    expect(leser.offen, "das Einlesen wurde nicht angehalten").toHaveLength(1);
    expect(box.transcribe, "vor der Freigabe des Lesers ging schon etwas hinaus").toEqual([]);
    await leserFreigeben();
    expect(box.transcribe).toHaveLength(1);
    expect(schreibfeld().textContent).toContain("Pumpe P2 vor dem Anfahren entlueften.");
  });

  it("E4 · „Eingabe verwerfen“ während des Einlesens: es geht nichts hinaus", async () => {
    await mount("/erfassen");
    await tippeRumpf("<p>Vorher getippt.</p>");
    await sprichEin();
    expect(leser.offen).toHaveLength(1);

    await klick(knopf("blatt-werkzeug-mehr"));
    await klick(menueEintrag(i18n.t("fd.discardInput")));
    await klick(knopf("blatt-rueckfrage-ja"));
    await leserFreigeben();

    expect(box.transcribe, "die verworfene Aufnahme wurde trotzdem gesendet").toEqual([]);
    expect(container.textContent ?? "").not.toContain("Pumpe P2 vor dem Anfahren entlueften.");
    expect(knopf("blatt-werkzeug-aufnehmen").disabled).toBe(false);
  });

  it("E5 · anderer Entwurf mit eigener Stufe während des Einlesens: nichts geht hinaus", async () => {
    await box.seed({
      title: "Zweiter Entwurf",
      statement: "Fremder Text.",
      bodyHtml: "<p>Fremder Text.</p>",
      origin: "frontdoor",
      confidentiality: "intern",
    });
    await mount("/erfassen");
    await sprichEin();
    expect(leser.offen).toHaveLength(1);

    await klick(knopf("blatt-werkzeug-mehr"));
    await klick(menueEintrag(i18n.t("erfassen.mehr.entwuerfe")));
    await klick(menueEintrag("Zweiter Entwurf"));
    expect(schreibfeld().textContent, "der andere Entwurf wurde nicht geöffnet").toContain(
      "Fremder Text.",
    );

    await leserFreigeben();
    expect(box.transcribe, "alte Aufnahme ging beim neuen Entwurf hinaus").toEqual([]);
    expect(schreibfeld().textContent ?? "").not.toContain("Pumpe P2");
  });

  it("E6 · die Stufe ändert sich nach dem Ende der Aufnahme: gesendet wird die des Vorgangs", async () => {
    await mount("/erfassen");
    await sprichEin();
    expect(leser.offen).toHaveLength(1);
    // Nach dem Ende der Aufnahme, noch im Einlesen: jetzt wird „intern“ gewählt.
    await klick(knopf("blatt-werkzeug-vertraulichkeit"));
    await klick(menueEintrag(i18n.t("conf.level.intern")));

    await leserFreigeben();
    expect(box.transcribe).toHaveLength(1);
    // Beim Ende der Aufnahme war keine Stufe gewählt — also reist keine mit (Server: vertraulich).
    expect(Object.hasOwn(box.transcribe[0] as object, "confidentiality")).toBe(false);
  });
});
