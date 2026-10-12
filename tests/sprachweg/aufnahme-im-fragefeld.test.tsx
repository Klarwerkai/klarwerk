// @vitest-environment jsdom
// ================================================================================================
// Aufnahme gesamt-sprachassistent · R-0104 — FRAGEN PER AUFNAHME, an der echten `/fragen`-Fläche.
// ================================================================================================
//
// Bauform wie `tests/diktat-fragefeld/mikrofon-im-fragefeld.test.tsx`: die echte Seite, `endpoints`
// als Zähler. Dazu ein Doppel für `MediaRecorder` und `navigator.mediaDevices` — die Browsergrenze.
//
//   A1 Der Aufnahmeknopf steht da, wenn der Browser aufnehmen kann — und fehlt sonst (Kalibrierung).
//   A2 Aufnehmen → Stoppen: GENAU EIN Transkriptionsaufruf mit lesbarer Data-URL; der Text steht im
//      Feld, das Mikrofon ist aus, und es ist KEINE Frage gelaufen — erst der Klick sendet.
//   A3 Liefert der Server keinen Text (keine Freigabe), steht sein Satz da; das Feld bleibt leer.
//   A4 Wer die Seite während der Aufnahme verlässt, schaltet das Mikrofon ab; nichts geht hinaus.
//
// NICHT GEMESSEN: ein echtes Mikrofon und ein echter Transkriptionsdienst.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Rumpf {
  data: string;
  locale: string;
  confidentiality?: string;
}

const laeufe = vi.hoisted(() => ({
  ask: [] as string[],
  transcribe: [] as Rumpf[],
  antwort: {
    transcript: "Wie oft wird Ventil V3 entlueftet?" as string | null,
    engineActive: true,
    engine: "openai:whisper-1" as string | null,
    note: "Automatisches Transkript",
  },
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    media: {
      transcribe: vi.fn(async (rumpf: Rumpf) => {
        laeufe.transcribe.push(rumpf);
        return { ...laeufe.antwort };
      }),
    },
    ask: {
      ask: vi.fn(async (frage: string) => {
        laeufe.ask.push(frage);
        return {
          result: {
            answered: false,
            answer: null,
            knowledgeClass: "unbekannt",
            trust: 0,
            sources: [],
            citedSources: [],
            steps: [],
            demo: false,
            captionSources: [],
          },
          gap: null,
          receipt: "r",
        };
      }),
      helpful: vi.fn(),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// ---- Das Doppel der Browsergrenze ----------------------------------------------------------------
const spuren = { gestoppt: 0, angefragt: 0 };

class AufnahmeDoppel {
  static letzter: AufnahmeDoppel | null = null;
  static isTypeSupported(mime: string): boolean {
    return mime === "audio/webm";
  }
  state = "inactive";
  mimeType: string;
  gestartet = 0;
  gestoppt = 0;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: unknown, optionen?: { mimeType?: string }) {
    this.mimeType = optionen?.mimeType ?? "";
    AufnahmeDoppel.letzter = this;
  }
  start(): void {
    this.state = "recording";
    this.gestartet += 1;
  }
  stop(): void {
    this.gestoppt += 1;
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
      getUserMedia: async () => {
        spuren.angefragt += 1;
        return {
          getTracks: () => [
            {
              stop: () => {
                spuren.gestoppt += 1;
              },
            },
          ],
        };
      },
    },
  });
}

function aufnahmeAbmelden(): void {
  (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder = undefined;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function aufnahmeKnopf(container: HTMLElement): HTMLButtonElement | null {
  const el = container.querySelector('[data-testid="ask-sprachaufnahme"]');
  return el instanceof HTMLButtonElement ? el : null;
}

async function klick(el: HTMLButtonElement | null | undefined): Promise<void> {
  await act(async () => {
    el?.click();
    await flush();
  });
}

beforeEach(async () => {
  laeufe.ask = [];
  laeufe.transcribe = [];
  laeufe.antwort = {
    transcript: "Wie oft wird Ventil V3 entlueftet?",
    engineActive: true,
    engine: "openai:whisper-1",
    note: "Automatisches Transkript",
  };
  spuren.gestoppt = 0;
  spuren.angefragt = 0;
  AufnahmeDoppel.letzter = null;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  aufnahmeAbmelden();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("R-0104 · Fragen per Aufnahme mit Server-Transkription", () => {
  it("A1 · mit Aufnahmemöglichkeit steht der Knopf da — ohne sie nicht", async () => {
    const ohne = await mountAsk();
    expect(aufnahmeKnopf(ohne.container), "Knopf ohne Rekorder").toBeNull();
    ohne.unmount();

    aufnahmeAnmelden();
    const mit = await mountAsk();
    const knopf = aufnahmeKnopf(mit.container);
    expect(knopf, "kein Aufnahmeknopf auf /fragen").toBeTruthy();
    expect(knopf?.getAttribute("type")).toBe("button");
    expect(knopf?.getAttribute("aria-label")).toBe(i18n.t("sprachaufnahme.frage"));
    expect(knopf?.getAttribute("aria-pressed")).toBe("false");
    mit.unmount();
  });

  it("A2 · Aufnahme → genau ein Transkriptionsaufruf → Text im Feld; gesendet wird erst auf Klick", async () => {
    aufnahmeAnmelden();
    const { container, unmount } = await mountAsk();
    await klick(aufnahmeKnopf(container));
    expect(spuren.angefragt, "Mikrofon nicht angefragt").toBe(1);
    expect(AufnahmeDoppel.letzter?.gestartet).toBe(1);
    expect(AufnahmeDoppel.letzter?.mimeType).toBe("audio/webm");
    expect(aufnahmeKnopf(container)?.getAttribute("aria-pressed")).toBe("true");
    expect(aufnahmeKnopf(container)?.getAttribute("aria-label")).toBe(
      i18n.t("sprachaufnahme.stop"),
    );

    await klick(aufnahmeKnopf(container));
    await act(flush);
    expect(laeufe.transcribe).toHaveLength(1);
    const rumpf = laeufe.transcribe[0];
    expect(rumpf?.data.startsWith("data:audio/webm;base64,")).toBe(true);
    expect(rumpf?.locale).toBe("de");
    expect(rumpf?.confidentiality).toBe("intern");
    expect(spuren.gestoppt, "das Mikrofon läuft nach dem Stopp weiter").toBe(1);

    const feld = container.querySelector("input") as HTMLInputElement;
    expect(feld.value).toBe("Wie oft wird Ventil V3 entlueftet?");
    expect(laeufe.ask, "die Aufnahme hat von allein gefragt").toEqual([]);

    // KALIBRIERUNG: der Sendeknopf sendet den verschriftlichten Text.
    const senden = Array.from(container.querySelectorAll("button")).find(
      (b) => b.getAttribute("type") === "submit",
    );
    await klick(senden);
    expect(laeufe.ask).toEqual(["Wie oft wird Ventil V3 entlueftet?"]);
    unmount();
  });

  it("A3 · ohne Freigabe kein erfundener Text — der Satz des Servers steht da", async () => {
    aufnahmeAnmelden();
    laeufe.antwort = {
      transcript: null,
      engineActive: false,
      engine: "openai:whisper-1",
      note: "Die öffentliche KI ist vom Administrator nicht freigegeben.",
    };
    const { container, unmount } = await mountAsk();
    await klick(aufnahmeKnopf(container));
    await klick(aufnahmeKnopf(container));
    await act(flush);
    expect(laeufe.transcribe).toHaveLength(1);
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("");
    expect(container.querySelector('[data-testid="ask-sprachaufnahme-meldung"]')?.textContent).toBe(
      "Die öffentliche KI ist vom Administrator nicht freigegeben.",
    );
    expect(laeufe.ask).toEqual([]);
    unmount();
  });

  it("A4 · wer die Seite während der Aufnahme verlässt, schaltet das Mikrofon ab — nichts geht hinaus", async () => {
    aufnahmeAnmelden();
    const { container, unmount } = await mountAsk();
    await klick(aufnahmeKnopf(container));
    const rekorder = AufnahmeDoppel.letzter;
    expect(rekorder?.state).toBe("recording");
    unmount();
    await act(flush);
    expect(rekorder?.gestoppt).toBe(1);
    expect(spuren.gestoppt).toBe(1);
    expect(laeufe.transcribe).toEqual([]);
  });
});
