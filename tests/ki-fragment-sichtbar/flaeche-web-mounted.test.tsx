// @vitest-environment jsdom
// ================================================================================================
// JOB 3366 · T3 — DER HINWEIS AN DER ANTWORT, GEMOUNTET: `/fragen` UND ERFASSEN.
// ================================================================================================
//
// Ein Feld im Vertrag ist noch keine erfüllte Aufgabe (Auftrag §8.1): erfüllt ist sie, wenn ein
// MENSCH an einer wirklich abgeschnittenen Antwort sieht, dass sie unvollständig ist. Diese Datei
// misst das am gerenderten DOM der echten Seiten — beide Sprachen, je der VOLLSTÄNDIGE Satz, und
// je der Gegenfall ohne Feld.
//
// DIE SOLLWERTE KOMMEN AUS `i18n`, DIE ISTWERTE AUS DEM DOM (LEHREN.md, JOB 3220/UX-31): geprüft
// wird zusätzlich, dass der Satz die drei tragenden Bedeutungsmerkmale nennt (Längenlimit,
// abgeschnitten, unvollständig) — sonst wäre der Test gegen jeden beliebigen i18n-Wert grün.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({
  /** Trägt die Ask-Antwort ein Abbruchfeld? */
  abgeschnitten: false,
  /** Trägt das Extraktionsergebnis ein Abbruchfeld? */
  extraktAbgeschnitten: false,
  /** Die abgeleitete `note` des Extraktionswegs (JOB 3298/SCRUM-427) — bleibt Bestand. */
  extraktNote: null as string | null,
  /** Wie viele Punkte der Lauf liefert (R2: die Zustandswechsel brauchen 2 und 3). */
  extraktPunkte: 1,
}));

const BEFUND = {
  finishReason: "length",
  budgetFeld: "max_completion_tokens",
  budget: 1024,
  zeichen: 42,
};

const ANTWORT = "Ventil V4 wird jährlich geprüft und dann";

vi.mock("../../apps/web/src/app/RoleContext", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useRole: () => ({ role: "experte" }),
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
      ko: { list: ok([]) },
      conflicts: { list: ok([]) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      // R2: `create` trägt den Weg „ausgewählte Punkte als Entwürfe sichern" — genau der Weg, auf
      // dem die Punkteliste geräumt wird (Capture.tsx, `filePointDrafts.onSuccess`).
      drafts: { list: ok([]), create: vi.fn(async () => ({ id: "d-1", title: "E" })) },
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ enabled: false }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active", tasks: { answer: true } }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "Welche Anlage?", done: false })),
        extract: vi.fn(async () => ({
          points: Array.from({ length: bestand.extraktPunkte }, (_, i) => ({
            title: i === 0 ? "Dosierventil klemmt bei Kaltstart" : `Weiterer Fund ${i}`,
            summary: "Nach Stillstand klemmt das Ventil DP-4 sporadisch.",
            sourceExcerpt: "… Ventil DP-4 klemmt nach dem Wochenende …",
          })),
          note: bestand.extraktNote,
          demo: false,
          ...(bestand.extraktAbgeschnitten ? { abgeschnitten: BEFUND } : {}),
        })),
      },
      ask: {
        ask: vi.fn(async () => ({
          result: {
            answered: true,
            answer: ANTWORT,
            knowledgeClass: "gesichert",
            trust: 90,
            sources: [],
            citedSources: [],
            steps: [],
            demo: false,
            captionSources: [],
            ...(bestand.abgeschnitten ? { abgeschnitten: BEFUND } : {}),
          },
          gap: null,
          receipt: "r",
        })),
        helpful: vi.fn(),
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
import { Ask } from "../../apps/web/src/pages/Ask";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

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

/** Der Sollwert — GELESEN aus dem Wörterbuch der jeweiligen Sprache, nie abgeschrieben. */
function satz(sprache: "de" | "en"): string {
  return String(i18n.getResource(sprache, "translation", "ai.truncated.hint"));
}

async function mount(element: unknown, pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
                  { initialEntries: [pfad] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: pfad, element: element as never }),
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

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

/** Eine Frage über das ECHTE Formular stellen — kein Hineinschreiben in den Zustand. */
async function fragen(): Promise<void> {
  const feld = container.querySelector("input") as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, "Wie oft wird Ventil V4 geprüft?");
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    (container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
}

async function dropExtractFile(): Promise<void> {
  const zone = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
  if (!zone) {
    throw new Error("Datei-Dropzone nicht gefunden (Modus „Aus Datei“ aktiv?)");
  }
  const file = new File(["Ventil DP-4 klemmt nach dem Wochenende."], "erfahrung.txt", {
    type: "text/plain",
  });
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files: [file] } });
  await act(async () => {
    zone.dispatchEvent(ev);
    await flush();
  });
}

beforeEach(() => {
  bestand.abgeschnitten = false;
  bestand.extraktAbgeschnitten = false;
  bestand.extraktNote = null;
  bestand.extraktPunkte = 1;
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
});

describe("JOB 3366 · T3a · die Fläche /fragen", () => {
  it.each(["de", "en"] as const)(
    "mit Abbruchfeld steht der vollständige Hinweis (%s) an der Antwort, die Antwort bleibt unverändert",
    async (sprache) => {
      bestand.abgeschnitten = true;
      await i18n.changeLanguage(sprache);
      await mount(createElement(Ask), "/fragen");
      await fragen();
      const hinweis = container.querySelector('[data-testid="ask-abgeschnitten"]');
      expect(hinweis, "Der Hinweis fehlt an der Antwort").not.toBeNull();
      expect(hinweis?.textContent).toBe(satz(sprache));
      // Kein Sprachrest der jeweils anderen Sprache im Satz (LEHREN.md, JOB 3276 R4).
      expect(hinweis?.textContent).not.toBe(satz(sprache === "de" ? "en" : "de"));
      // Der Hinweis sitzt IN der Antwortkarte, nicht als eigene Ergebniskarte daneben.
      const karte = container.querySelector('[data-testid="ask-answer"]');
      expect(karte?.querySelectorAll('[data-testid="ask-abgeschnitten"]').length).toBe(1);
      // Die Antwort selbst bleibt vollständig sichtbar und Zeichen für Zeichen unverändert.
      expect(container.querySelector(".ask-answer-body")?.textContent).toContain(ANTWORT);
    },
  );

  it("ohne Abbruchfeld steht kein Hinweis — und keine Gegenaussage „vollständig“", async () => {
    await i18n.changeLanguage("de");
    await mount(createElement(Ask), "/fragen");
    await fragen();
    expect(container.querySelector('[data-testid="ask-abgeschnitten"]')).toBeNull();
    expect(container.textContent).not.toContain(satz("de"));
    expect(container.textContent).not.toContain("vollständig");
  });

  it("§9 laden: vor der ersten Antwort gibt es den Hinweis nicht", async () => {
    bestand.abgeschnitten = true;
    await i18n.changeLanguage("de");
    await mount(createElement(Ask), "/fragen");
    expect(container.querySelector('[data-testid="ask-abgeschnitten"]')).toBeNull();
  });

  it("§9 gehaltene Antwort: der Hinweis bleibt an ihr, auch nach einem Sprachwechsel", async () => {
    bestand.abgeschnitten = true;
    await i18n.changeLanguage("de");
    await mount(createElement(Ask), "/fragen");
    await fragen();
    expect(container.querySelector('[data-testid="ask-abgeschnitten"]')?.textContent).toBe(
      satz("de"),
    );
    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    // Die Antwort steht weiter, der Hinweis steht weiter — nur in der neuen Sprache.
    expect(container.querySelector(".ask-answer-body")?.textContent).toContain(ANTWORT);
    expect(container.querySelector('[data-testid="ask-abgeschnitten"]')?.textContent).toBe(
      satz("en"),
    );
  });

  it("der Satz nennt Längenlimit, Abbruch und Unvollständigkeit — nicht irgendeinen Text", async () => {
    expect(satz("de")).toMatch(/Längenlimit/);
    expect(satz("de")).toMatch(/abgeschnitten/);
    expect(satz("de")).toMatch(/unvollständig/);
    expect(satz("en")).toMatch(/length limit/);
    expect(satz("en")).toMatch(/cut off/);
    expect(satz("en")).toMatch(/incomplete/);
  });
});

/** Bis zur KI-Punkteliste: Erfassen im Datei-Modus mounten, Datei einlegen, analysieren lassen. */
async function bisZurPunkteliste(sprache: "de" | "en"): Promise<void> {
  await i18n.changeLanguage(sprache);
  await mount(createElement(CaptureArbeitsraum, { modus: "datei" }), "/erfassen");
  await dropExtractFile();
  await click(buttonByText(i18n.t("capture.file.searchCta")));
  expect(container.textContent).toContain("Dosierventil klemmt bei Kaltstart");
}

/** Der Hinweis im DOM — oder `null`. */
function hinweis(): Element | null {
  return container.querySelector('[data-testid="capture-abgeschnitten"]');
}

/** Steht die Punkteliste (das Ergebnis, über das der Hinweis etwas sagt) auf der Fläche? */
function punktelisteSteht(): boolean {
  return (container.textContent ?? "").includes("Dosierventil klemmt bei Kaltstart");
}

describe("JOB 3366 · T3b · die Fläche Erfassen (KI-Punkte aus Datei)", () => {
  it.each(["de", "en"] as const)(
    "mit Abbruchfeld steht der vollständige Hinweis (%s) an der KI-Antwort",
    async (sprache) => {
      bestand.extraktAbgeschnitten = true;
      await bisZurPunkteliste(sprache);
      const hinweis = container.querySelector('[data-testid="capture-abgeschnitten"]');
      expect(hinweis, "Der Hinweis fehlt an der KI-Punkteliste").not.toBeNull();
      expect(hinweis?.textContent).toBe(satz(sprache));
      expect(hinweis?.textContent).not.toBe(satz(sprache === "de" ? "en" : "de"));
    },
  );

  it("ohne Abbruchfeld steht kein Hinweis", async () => {
    await bisZurPunkteliste("de");
    expect(container.querySelector('[data-testid="capture-abgeschnitten"]')).toBeNull();
    expect(container.textContent).not.toContain(satz("de"));
  });

  it("der belegte Hinweis LÖST die abgeleitete note ab — zwei Sätze über dieselbe Lage gibt es nicht", async () => {
    bestand.extraktAbgeschnitten = true;
    bestand.extraktNote = "Hinweis: Ein Teil des Dokuments konnte nicht verarbeitet werden.";
    await bisZurPunkteliste("de");
    expect(container.querySelector('[data-testid="capture-abgeschnitten"]')?.textContent).toBe(
      satz("de"),
    );
    expect(container.textContent).not.toContain(bestand.extraktNote);
  });

  it("ohne Befund bleibt die abgeleitete note unverändert zuständig", async () => {
    bestand.extraktNote = "In diesem Dokument wurden keine Wissenspunkte gefunden.";
    await bisZurPunkteliste("de");
    expect(container.querySelector('[data-testid="capture-abgeschnitten"]')).toBeNull();
    expect(container.textContent).toContain(bestand.extraktNote);
  });
});

// ================================================================================================
// JOB 3366 R2 · T3c — DER HINWEIS GEHT MIT SEINER ANTWORT (bens Befund zu Runde 1).
// ================================================================================================
//
// In Runde 1 hing der Hinweis allein am Serverbefund und blieb deshalb stehen, wenn die
// Punkteliste, über die er etwas sagt, nicht mehr auf der Fläche war. Zwei Wege stellte ben nach:
// der Wechsel auf „Ganzes Dokument übernehmen" (Liste ausgeblendet) und das Sichern ALLER Punkte
// (Liste geräumt). Beide stehen hier als Fall, dazu die zwei Gegenrichtungen, die beweisen, dass
// der Hinweis nicht einfach seltener geworden ist: der Rückwechsel und die Restpunkte.
describe("JOB 3366 R2 · T3c · Erfassen: der Hinweis lebt und stirbt mit dem angezeigten Ergebnis", () => {
  it.each(["de", "en"] as const)(
    "%s · Ganzdokument-Weg: mit der ausgeblendeten Liste geht der Hinweis — und mit ihr kommt er zurück",
    async (sprache) => {
      bestand.extraktAbgeschnitten = true;
      await bisZurPunkteliste(sprache);
      expect(hinweis()?.textContent, "Ausgangslage: Hinweis an der Liste").toBe(satz(sprache));

      await click(buttonByText(i18n.t("capture.file.importMode.whole")));
      expect(punktelisteSteht(), "die Punkteliste ist im Ganzdokument-Weg ausgeblendet").toBe(
        false,
      );
      expect(hinweis(), "Hinweis ohne die Antwort, über die er etwas sagt").toBeNull();
      expect(container.textContent).not.toContain(satz(sprache));

      // Gegenrichtung: der Befund ist nicht verloren, nur unsichtbar — die Antwort kommt zurück
      // und trägt ihre Aussage wieder.
      await click(buttonByText(i18n.t("capture.file.importMode.points")));
      expect(punktelisteSteht()).toBe(true);
      expect(hinweis()?.textContent).toBe(satz(sprache));
    },
  );

  it.each(["de", "en"] as const)(
    "%s · alle Punkte gesichert: die Liste ist geräumt, der Hinweis steht nicht mehr allein da",
    async (sprache) => {
      bestand.extraktAbgeschnitten = true;
      bestand.extraktPunkte = 2;
      await bisZurPunkteliste(sprache);
      expect(hinweis()?.textContent).toBe(satz(sprache));

      // Beide Punkte sind vorausgewählt → „Als Entwürfe speichern" sichert alle und räumt die Liste.
      await click(buttonByText(i18n.t("capture.file.saveDraftsCta")));
      expect(punktelisteSteht(), "die Punkteliste ist nach dem Sichern geräumt").toBe(false);
      expect(hinweis(), "verwaister Hinweis nach dem vollständigen Sichern").toBeNull();
      expect(container.textContent).not.toContain(satz(sprache));
    },
  );

  it.each(["de", "en"] as const)(
    "%s · Restpunkte: was von der abgeschnittenen Antwort stehen bleibt, behält seinen Hinweis",
    async (sprache) => {
      bestand.extraktAbgeschnitten = true;
      bestand.extraktPunkte = 3;
      await bisZurPunkteliste(sprache);

      // Den ersten Punkt abwählen → er bleibt als Restpunkt in der Liste.
      const kaesten = [
        ...container.querySelectorAll<HTMLInputElement>('li input[type="checkbox"]'),
      ];
      expect(kaesten.length).toBe(3);
      await act(async () => {
        kaesten[0]?.click();
        await flush();
      });
      await click(buttonByText(i18n.t("capture.file.saveDraftsCta")));
      // Nachfrage „nicht Ausgewählte löschen?" → behalten.
      await click(buttonByText(i18n.t("capture.file.purgeUnselectedKeep")));

      expect(punktelisteSteht(), "der abgewählte Punkt steht weiter").toBe(true);
      expect(hinweis()?.textContent, "der Hinweis gehört auch zum Rest desselben Laufs").toBe(
        satz(sprache),
      );
    },
  );
});
