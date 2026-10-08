// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-ocr` (FR-CAP-05) — DER ERKANNTE BILDTEXT REIST INS GEFÜHRTE INTERVIEW
// ================================================================================================
//
// Bens Befund (Nacharbeit 2): Der auf Klick erkannte Bildtext floss über `onOcr` in den Rohtext
// und damit in die Strukturierung, aber nicht ins Interview — dessen Aufruf trug nur die Antworten.
// Gemountet an der ECHTEN Erfassungsseite (Gerüst wie job2700-handbuch-an-der-seite-mounted):
// Bild anhängen → „OCR → Text" klicken → Interview bewusst starten. Erwartet: der Interview-Aufruf
// trägt den erkannten Text als Kontext. Gegenprobe: ohne Klick auf die Erkennung kein Kontext.
// Die Bild-Engine und die Vorschau-Erzeugung (Canvas, in jsdom nicht vorhanden) sind ersetzt.
//
// Bens Befunde (Nacharbeit 3): I3 — eine Korrektur im erkannten Block landet im Kontext; I4 —
// gespeichert, neu geöffnet (frische Seite, ECHTER Entwurfsdienst im Speicher) und fortgesetzt,
// trägt der Interview-Aufruf den erkannten Text weiterhin.
// Bens Befunde (Nacharbeit 4): I5 — dasselbe NACH dem Strukturieren (der Entwurf trägt dann die
// verdichtete Aussage, nicht den Rohtext); I6 — Klammern im Bildnamen und Klammerzeilen im
// erkannten Text schneiden nichts ab.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";

const steuerung = vi.hoisted(() => ({
  ocr: vi.fn(async (_input: unknown): Promise<OcrResult> => ({ status: "success", text: "" })),
  interview: vi.fn(async (..._args: unknown[]) => ({
    question: "Woran erkennst du den Druckabfall?",
    done: false,
    demo: true,
  })),
  entwuerfeLeeren: (): void => {},
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Der Entwurfsweg ist der ECHTE Dienst (im Speicher) — Muster aus interview-pending-turn-mounted.
vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  steuerung.entwuerfeLeeren = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        // Strukturieren muss möglich sein (I5) — Verfügbarkeit wie in mega21-capture-mounted.
        status: ok({
          active: true,
          mode: "cloud",
          reachable: "ok",
          tasks: { structure: true, extract: true },
        }),
        config: ok(null),
        structure: vi.fn(async () => ({
          title: "Druckabfall an P2",
          statement: "Bei Druckabfall Ventil prüfen.",
          type: "best_practice",
          tags: [],
          conditions: [],
          measures: [],
        })),
        interview: steuerung.interview,
        extract: vi.fn(async () => ({ points: [], note: null })),
      },
    },
  };
});

// Nur Bild-Engine und Vorschau werden ersetzt; alles andere bleibt der echte Leser.
vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  runImageOcr: steuerung.ocr,
  fileToThumbDataUrl: vi.fn(async () => "data:image/jpeg;base64,AAAA"),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ADVANCED_FIELDS_KEYS } from "../../apps/web/src/lib/captureAdvancedFields";
import { CAPTURE_WIZARD_TEXT } from "../../apps/web/src/lib/captureWizard";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ERKANNT = "Bei Druckabfall an P2 zuerst Ventil V3 prüfen.";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let modus: "freitext" | "interview" | undefined;
let zeichnen: (() => Promise<void>) | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Ein Wegklick aus der Seite — die Navigationswache bietet „Speichern" an (Muster pending-turn). */
const nav = { weiter: false };
function NavProbe(): JSX.Element {
  const { guard } = useNavGuard();
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "navprobe",
      onClick: () =>
        guard(() => {
          nav.weiter = true;
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

/** Der Modus kommt als Prop — wie im Produkt aus dem Menü „Datei ▾" des Blatts (JOB 3062 H3). */
async function waehleModus(m: "freitext" | "interview"): Promise<void> {
  modus = m;
  if (!zeichnen) {
    throw new Error("waehleModus vor mount() gerufen");
  }
  await zeichnen();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  steuerung.ocr.mockReset();
  steuerung.interview.mockClear();
  steuerung.entwuerfeLeeren();
  nav.weiter = false;
  await mount();
});

afterEach(() => {
  modus = undefined;
  zeichnen = null;
  act(() => root.unmount());
  container.remove();
});

async function haengeBildAn(bildname = "aushang.png"): Promise<void> {
  // Die Bilder stehen in den erweiterten Feldern (SCRUM-375: standardmäßig eingeklappt).
  const titel = i18n.t(ADVANCED_FIELDS_KEYS.title);
  const aufklapper = [...container.querySelectorAll("button[aria-expanded]")].find((b) =>
    (b.textContent ?? "").includes(titel),
  );
  if (aufklapper?.getAttribute("aria-expanded") === "false") {
    await klicke(aufklapper as HTMLButtonElement);
  }
  const input = container.querySelector<HTMLInputElement>('input[type="file"][accept="image/*"]');
  if (!input) {
    throw new Error("Kein Bild-Eingang auf der Erfassungsseite");
  }
  const bild = new File([new Uint8Array(64)], bildname, { type: "image/png" });
  Object.defineProperty(input, "files", { value: [bild], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

function knopf(beschriftung: string): HTMLButtonElement {
  // Genaue Gleichheit: „OCR → Text“ soll keinen anderen Knopf treffen, der „OCR“ nur enthält.
  const passt = (x: HTMLButtonElement): boolean => (x.textContent ?? "").trim() === beschriftung;
  const b = [...container.querySelectorAll("button")].find(passt);
  if (!b) {
    throw new Error(`Kein Knopf „${beschriftung}“`);
  }
  return b;
}

async function klicke(b: HTMLButtonElement): Promise<void> {
  await act(async () => {
    b.click();
    await flush();
  });
  await act(flush);
}

/** Knopf, dessen Beschriftung den Teil enthält (Knöpfe mit Symbol oder Zähler). */
function knopfMit(teil: string): HTMLButtonElement | null {
  const passt = (b: HTMLButtonElement): boolean =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil);
  return [...container.querySelectorAll("button")].find(passt) ?? null;
}

/** Das Rohtextfeld des Erzählens. */
function rohtextFeld(): HTMLTextAreaElement {
  const ph = i18n.t("capture.rawPlaceholder");
  const feld = [...container.querySelectorAll("textarea")].find((x) => x.placeholder === ph);
  if (!feld) {
    throw new Error("Kein Rohtextfeld");
  }
  return feld;
}

async function tippe(feld: HTMLTextAreaElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(feld, wert);
  await act(async () => {
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Bild anhängen und seinen Text auf Klick erkennen lassen. */
async function erkenneBild(): Promise<void> {
  steuerung.ocr.mockResolvedValue({ status: "success", text: ERKANNT });
  await haengeBildAn();
  await klicke(knopf(i18n.t("capture.ocr")));
  expect(steuerung.ocr).toHaveBeenCalledTimes(1);
}

/** Das Interview bewusst starten und den mitgeschickten Kontext zurückgeben. */
async function starteInterview(): Promise<string> {
  await waehleModus("interview");
  await klicke(knopf(i18n.t("capture.ivStart")));
  expect(steuerung.interview).toHaveBeenCalledTimes(1);
  return String(steuerung.interview.mock.calls[0]?.[3] ?? "");
}

describe("gesamt-ocr · FR-CAP-05 · erkannter Bildtext als Kontext des geführten Interviews", () => {
  it("I1 · nach dem Klick auf die Erkennung trägt der Interview-Aufruf den erkannten Text", async () => {
    steuerung.ocr.mockResolvedValue({ status: "success", text: ERKANNT });
    await haengeBildAn();
    // Das Anhängen allein erkennt nichts.
    expect(steuerung.ocr).not.toHaveBeenCalled();
    await klicke(knopf(i18n.t("capture.ocr")));
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);

    await waehleModus("interview");
    // Der Moduswechsel allein sendet nichts (E2E-008).
    expect(steuerung.interview).not.toHaveBeenCalled();
    await klicke(knopf(i18n.t("capture.ivStart")));

    expect(steuerung.interview).toHaveBeenCalledTimes(1);
    const kontext = steuerung.interview.mock.calls[0]?.[3];
    expect(typeof kontext).toBe("string");
    expect(kontext as string).toContain(ERKANNT);
    expect(kontext as string).toContain("aushang.png");
  });

  it("I2 · Gegenprobe: ohne Klick auf die Erkennung reist kein Bildtext ins Interview", async () => {
    await haengeBildAn();
    await waehleModus("interview");
    await klicke(knopf(i18n.t("capture.ivStart")));

    expect(steuerung.ocr).not.toHaveBeenCalled();
    expect(steuerung.interview).toHaveBeenCalledTimes(1);
    expect(steuerung.interview.mock.calls[0]?.[3] ?? "").toBe("");
  });

  it("I3 · Bens Befund: ein korrigiertes Zeichen im erkannten Block landet im Kontext", async () => {
    await erkenneBild();
    const korrigiert = ERKANNT.replace("V3", "V8");
    const feld = rohtextFeld();
    expect(feld.value).toContain(ERKANNT);
    await tippe(feld, feld.value.replace(ERKANNT, korrigiert));

    const kontext = await starteInterview();
    expect(kontext).toContain(korrigiert);
    expect(kontext).not.toContain(ERKANNT);
  });

  it("I4 · Bens Befund: gespeichert, neu geöffnet und fortgesetzt — der Kontext ist wieder da", async () => {
    await erkenneBild();
    await entferneBild();
    await speichereUeberWache();
    await neuOeffnenUndFortsetzen();
    expect(rohtextFeld().value).toContain(ERKANNT);

    const kontext = await starteInterview();
    expect(kontext).toContain(ERKANNT);
    expect(kontext).toContain("aushang.png");
  });

  it("I5 · Bens Befund (Nacharbeit 4): strukturiert gespeichert, fortgesetzt — der Kontext ist wieder da", async () => {
    await erkenneBild();
    await entferneBild();
    // Strukturieren: danach trägt der Entwurf die VERDICHTETE Aussage statt des Rohtextes.
    await klicke(knopfMit(i18n.t("capture.structure")) as HTMLButtonElement);
    await speichereUeberWache();
    await neuOeffnenUndFortsetzen();

    // Fortgesetzt auf der Wissensseite; zurück zum Erzählen — der Rohtext kam NICHT zurück.
    await klicke(knopfMit(i18n.t(CAPTURE_WIZARD_TEXT.back)) as HTMLButtonElement);
    expect(rohtextFeld().value).not.toContain(ERKANNT);

    // Trotzdem trägt das Interview den erkannten Text — aus dem gesicherten Entwurfsfeld.
    const kontext = await starteInterview();
    expect(kontext).toContain(ERKANNT);
    expect(kontext).toContain("aushang.png");
  });

  it("I6 · Bens Befund (Nacharbeit 4): Klammern im Bildnamen und Klammerzeilen im Text gehen nicht verloren", async () => {
    const erkannt = `${ERKANNT}\n[Hinweis]\nNur mit Schutzbrille.`;
    steuerung.ocr.mockResolvedValue({ status: "success", text: erkannt });
    await haengeBildAn("aushang[1].png");
    await klicke(knopf(i18n.t("capture.ocr")));

    const kontext = await starteInterview();
    expect(kontext).toContain("[aushang[1].png]");
    expect(kontext).toContain("[Hinweis]\nNur mit Schutzbrille.");
  });
});

async function entferneBild(): Promise<void> {
  // Das Bild selbst reist nicht im Entwurf (lokaler Anhang) — vor dem Speichern entfernen, damit
  // die Wache nicht über ein ungesichertes Bild spricht. Der erkannte TEXT steht im Rohtext.
  const bildKachel = container.querySelector('img[alt="aushang.png"]')?.parentElement;
  const wahl = `button[aria-label="${i18n.t("capture.listRemove")}"]`;
  const bildEntfernen = bildKachel?.querySelector<HTMLButtonElement>(wahl);
  if (bildEntfernen) {
    await klicke(bildEntfernen);
  }
}

/** Speichern über die Navigationswache (der vorhandene Entwurfsweg). */
async function speichereUeberWache(): Promise<void> {
  const wegklick = container.querySelector<HTMLButtonElement>("[data-testid=navprobe]");
  await klicke(wegklick as HTMLButtonElement);
  const speichern = knopfMit(i18n.t("nav.guard.save"));
  expect(speichern).not.toBeNull();
  await klicke(speichern as HTMLButtonElement);
  expect(nav.weiter).toBe(true);
}

/** Eine FRISCHE Seite — kein Sitzungszustand überlebt; nur der gespeicherte Entwurf. */
async function neuOeffnenUndFortsetzen(): Promise<void> {
  modus = undefined;
  act(() => root.unmount());
  container.remove();
  await mount();
  const aufklappen =
    knopfMit(i18n.t("capture.resumeExpand", { count: 1 })) ?? knopfMit("Entwürfe anzeigen");
  if (aufklappen) {
    await klicke(aufklappen);
  }
  const fortsetzen = knopfMit(i18n.t("capture.resume"));
  expect(fortsetzen).not.toBeNull();
  await klicke(fortsetzen as HTMLButtonElement);
}
