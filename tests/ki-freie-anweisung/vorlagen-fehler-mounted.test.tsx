// @vitest-environment jsdom
// JOB 3566: Scheitert der Abruf der eigenen KI-Funktionen, sagt die KI-Fläche GENAU das — und
// behauptet keinen Fehler der ganzen Seite. Gemountet wie `standardeditor-mounted.test.tsx`: echte
// Capture-Seite, echtes Blatt, echte `AiAssistInstructions`; nur Transport und Modellantwort sind
// gestellt.
//
// Der Unterschied, um den es geht, ist ein Unterschied zweier LAGEN, die bis heute gleich aussehen:
//   * „diese Organisation hat keine eigenen KI-Funktionen"  → nichts steht da, und das ist wahr.
//   * „die eigenen KI-Funktionen konnten nicht geladen werden" → nichts steht da, und das ist eine
//     stillschweigende Falschaussage.
// Fall A und Fall B sind deshalb ein Paar: einer allein liesse sich mit „zeig den Satz immer" bzw.
// „zeig ihn nie" erfüllen, ohne den Zweck zu treffen.
//
// Die sechs Lagen aus §9 des Auftrags, je ein Fall, jede WIRKLICH erzeugt (Runde 2, BEN):
//   A Fehlerantwort · B erfolgreich leer · E laden (erster Abruf offen) · F gescheiterte
//   Auffrischung · G offline (der Abruf wird gar nicht gestellt) · H Cache mit LAUFENDER
//   Auffrischung (erster Abruf erfolgreich, zweiter offen).
// Dazu C (bedienbar bleiben), D (kein Sammelfehler) und I (beide Fehlerkanäle zugleich).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  /** Was der Client WIRKLICH an `reasoner.assist` gegeben hat, je Aufruf. */
  requests: [] as { text: string; locale: string; instruction: string }[],
  /** Was der Vorlagen-Endpunkt WIRFT, statt eine Liste zu liefern (Fall A/C/D/F). */
  presetsFehler: null as null | (() => unknown),
  /** Was der Vorlagen-Endpunkt liefert, wenn er NICHT wirft (Fall B: der leere Erfolg). */
  presetsListe: [] as { id: string; name: string; instruction: string }[],
  /** Der erste Abruf bleibt offen (Fall E: „laden" — es ist noch nichts gescheitert). */
  presetsHalt: false,
  presetsAufloesen: null as null | ((value: unknown) => void),
  /** Wie oft der Vorlagen-Endpunkt insgesamt gerufen wurde (Fall F/H: Auffrischung belegen). */
  presetsAufrufe: 0,
  /** Was die Assist-Anfrage WIRFT, statt zu antworten (Fall I: beide Fehler zugleich). */
  assistFehler: null as null | (() => unknown),
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
    box.requests.length = 0;
    box.presetsFehler = null;
    box.presetsListe = [];
    box.presetsHalt = false;
    box.presetsAufloesen = null;
    box.presetsAufrufe = 0;
    box.assistFehler = null;
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
        get: vi.fn(async (id: string) => (await svc.resumeDraft(id))?.draft),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        assistPresets: vi.fn(async () => {
          box.presetsAufrufe += 1;
          if (box.presetsHalt) {
            return new Promise((resolve) => {
              box.presetsAufloesen = resolve;
            });
          }
          if (box.presetsFehler) {
            throw box.presetsFehler();
          }
          return box.presetsListe;
        }),
        structure: vi.fn(async () => ({
          title: "Routerübergabe",
          statement: "Der Router wurde übergeben.",
          conditions: [],
          measures: [],
          tags: [],
          confidence: 0.8,
          demo: false,
        })),
        assist: vi.fn(
          async (_text: string, _locale: string, _instruction: string, _provenance: P) => {
            box.requests.push({ text: _text, locale: _locale, instruction: _instruction });
            if (box.assistFehler) {
              throw box.assistFehler();
            }
            return { text: "Der Kunde received den Router." };
          },
        ),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Link, MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";
import { sprachbestand } from "../support/i18nBestand";

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

async function mount(pfad = "/"): Promise<void> {
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
                  { initialEntries: [pfad] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/",
                      element: createElement(Link, { to: "/erfassen" }, "Wissen erfassen"),
                    }),
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
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

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
  // Erst nach dem Commit beginnt der Vorlagenabruf der gerade geöffneten KI-Fläche.
  await act(flush);
}

const ORIGINAL = "Der Kunde recieved den Router.";
const INSTRUCTION = "Formuliere die Übergabe höflich, ohne Fakten hinzuzufügen.";
const VORLAGE = {
  id: "vorlage-1",
  name: "Übergabe kurz",
  instruction: "Fasse die Übergabe in zwei Sätzen zusammen.",
};
/** Der Fehler, den der Vorlagen-Endpunkt wirft — mit dem echten `ApiError` des Produkts. */
const PRESETS_FEHLER = (): unknown => new ApiError(500, "ERROR", "Vorlagen nicht erreichbar");

/** Der neue Satz, WÖRTLICH aus dem Katalog — nicht aus einem im Test wiederholten `t()`. */
function katalogsatz(sprache: string): string {
  const satz = sprachbestand(sprache)["capture.ai.presetsFailed"];
  if (typeof satz !== "string" || satz.trim().length === 0) {
    throw new Error(`capture.ai.presetsFailed fehlt oder ist leer in ${sprache}`);
  }
  return satz;
}

function byId(id: string): HTMLButtonElement {
  const el = container.querySelector(`[data-testid="${id}"]`);
  if (!(el instanceof HTMLButtonElement)) throw new Error(`Knopf fehlt: ${id}`);
  return el;
}
function button(text: string): HTMLButtonElement {
  const el = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  if (!el) throw new Error(`Knopf fehlt: ${text}`);
  return el;
}
function editor(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[contenteditable="true"]');
  if (!el) throw new Error("Editor fehlt");
  return el;
}
/** Die geöffnete KI-Fläche des Blattes — dort und nur dort gehört der Satz hin. */
function kiFlaeche(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="blatt-menue-ki"]');
  if (!el) throw new Error("KI-Fläche fehlt");
  return el;
}
function seitentext(): string {
  return container.textContent ?? "";
}
/** Der Hinweis als KNOTEN — er steht in der KI-Fläche, nicht irgendwo auf der Seite. */
function hinweis(): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="ki-vorlagen-fehler"]');
}
/** Die Fehlerkarte der ASSIST-Anfrage im Blatt — der andere Kanal, an seiner eigenen Stelle. */
function kiFehlerkarte(): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="blatt-ki-fehler"]');
}
async function freeInput(value: string): Promise<void> {
  const el = [...container.querySelectorAll("input")].find(
    (e) => e.getAttribute("aria-label") === i18n.t("capture.ai.freeLabel"),
  );
  expect(el, "Freie KI-Anweisung fehlt in der KI-Fläche").toBeDefined();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, value);
    el?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}
async function ownDraft(): Promise<string> {
  const draft = await endpoints.drafts.create({
    title: "Routerübergabe",
    bodyHtml: `<p>${ORIGINAL}</p>`,
    confidentiality: "intern",
  } as never);
  await mount();
  await act(async () => {
    container.querySelector<HTMLAnchorElement>("a")?.click();
    await flush();
  });
  await click(byId("blatt-werkzeug-entwuerfe"));
  await click(byId("blatt-entwurf-eintrag"));
  expect(editor().textContent).toBe(ORIGINAL);
  return draft.id;
}
async function kiOeffnen(): Promise<void> {
  await click(byId("blatt-werkzeug-ki"));
}
async function kiSchliessen(): Promise<void> {
  await click(byId("blatt-werkzeug-ki"));
  expect(container.querySelector('[data-testid="blatt-menue-ki"]')).toBeNull();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});
afterEach(async () => {
  if (root) act(() => root.unmount());
  container?.remove();
  vi.clearAllMocks();
  await i18n.changeLanguage("de");
  // Der Onlinezustand ist global (`onlineManager`) — Fall G stellt ihn, jeder Fall danach bekommt
  // ihn zurück, sonst prüften die folgenden Fälle unbemerkt eine offline gestellte Fläche.
  onlineManager.setOnline(true);
});

describe("JOB 3566 · gescheiterter Abruf der eigenen KI-Funktionen", () => {
  it("A · der gescheiterte Abruf spricht — in allen drei geführten Sprachen aus dem Katalog", async () => {
    box.presetsFehler = PRESETS_FEHLER;
    await ownDraft();
    await kiOeffnen();
    expect(vi.mocked(endpoints.reasoner.assistPresets)).toHaveBeenCalled();
    for (const sprache of ["de", "en", "nl"]) {
      await act(async () => {
        await i18n.changeLanguage(sprache);
        await flush();
      });
      expect(kiFlaeche().textContent, `Satz fehlt in ${sprache}`).toContain(katalogsatz(sprache));
    }
    // Und die drei Sätze sind wirklich drei — nicht dreimal der deutsche.
    const saetze = new Set(["de", "en", "nl"].map(katalogsatz));
    expect(saetze.size).toBe(3);
    // Er steht IN der KI-Fläche, genau einmal, über der freien Eingabe.
    expect(kiFlaeche().contains(hinweis())).toBe(true);
    expect(container.querySelectorAll('[data-testid="ki-vorlagen-fehler"]')).toHaveLength(1);
  });

  it("B · der erfolgreiche LEERE Bestand schweigt — kein Satz, wo nichts gescheitert ist", async () => {
    box.presetsListe = [];
    await ownDraft();
    await kiOeffnen();
    expect(vi.mocked(endpoints.reasoner.assistPresets)).toHaveBeenCalled();
    for (const sprache of ["de", "en", "nl"]) {
      expect(seitentext(), `Satz steht fälschlich in ${sprache}`).not.toContain(
        katalogsatz(sprache),
      );
    }
    expect(hinweis()).toBeNull();
    // Der Weg selbst steht vollständig: die freie Eingabe ist da, nur eigene Funktionen gibt es keine.
    expect(kiFlaeche().textContent).not.toContain(VORLAGE.name);
    await freeInput(INSTRUCTION);
    await click(button(i18n.t("capture.ai.run")));
    expect(box.requests).toEqual([{ text: ORIGINAL, locale: "de", instruction: INSTRUCTION }]);
  });

  it("C · die Fläche bleibt bedienbar: fünf Standardaktionen und freie Anweisung arbeiten weiter", async () => {
    box.presetsFehler = PRESETS_FEHLER;
    await ownDraft();
    await kiOeffnen();
    for (const action of ["clarify", "structure", "expand", "spelling", "format"]) {
      const knopf = button(i18n.t(`capture.ai.action.${action}`));
      expect(knopf.disabled, `Standardaktion ${action} ist gesperrt`).toBe(false);
    }
    const laufen = button(i18n.t("capture.ai.run"));
    expect(laufen.disabled).toBe(true); // leere Eingabe — genau wie ohne Fehler
    await freeInput(INSTRUCTION);
    await click(button(i18n.t("capture.ai.run")));
    expect(box.requests).toEqual([{ text: ORIGINAL, locale: "de", instruction: INSTRUCTION }]);
    expect(container.querySelector('[data-testid="blatt-ki-vorschlag"]')?.textContent).toContain(
      "Der Kunde received den Router.",
    );
    // Die KI speichert nie automatisch.
    expect(endpoints.drafts.update).not.toHaveBeenCalled();
  });

  it("D · kein Sammelfehler: der Satz der ganzen Seite steht weiterhin nicht da", async () => {
    box.presetsFehler = PRESETS_FEHLER;
    await ownDraft();
    await kiOeffnen();
    expect(kiFlaeche().textContent).toContain(katalogsatz("de"));
    expect(seitentext()).not.toContain(i18n.t("state.error"));
    // Auch nach einer erfolgreichen freien Anweisung bleibt es dabei: der neue Satz tritt an die
    // Stelle des Sammelfehlers, nicht daneben. (Das Ausführen schliesst das KI-Menü — der Satz
    // steht danach wieder da, wo er hingehört: in der erneut geöffneten Fläche.)
    await freeInput(INSTRUCTION);
    await click(button(i18n.t("capture.ai.run")));
    expect(box.requests).toHaveLength(1);
    expect(seitentext()).not.toContain(i18n.t("state.error"));
    await kiOeffnen();
    expect(kiFlaeche().textContent).toContain(katalogsatz("de"));
    expect(seitentext()).not.toContain(i18n.t("state.error"));
  });

  it("E · während der erste Abruf läuft, steht kein Satz — es ist noch nichts gescheitert", async () => {
    box.presetsHalt = true;
    await ownDraft();
    await kiOeffnen();
    expect(box.presetsAufrufe).toBe(1);
    expect(hinweis()).toBeNull();
    expect(seitentext()).not.toContain(katalogsatz("de"));
    expect(seitentext()).not.toContain(i18n.t("state.error"));
    // Und wenn er dann gelingt, erscheint die Funktion — weiterhin ohne Satz.
    await act(async () => {
      box.presetsAufloesen?.([VORLAGE]);
      await flush();
    });
    expect(kiFlaeche().textContent).toContain(VORLAGE.name);
    expect(seitentext()).not.toContain(katalogsatz("de"));
  });

  it("F · gescheiterte AUFFRISCHUNG: die bekannten Funktionen bleiben stehen UND der Satz kommt dazu", async () => {
    box.presetsListe = [VORLAGE];
    await ownDraft();
    await kiOeffnen();
    expect(kiFlaeche().textContent).toContain(VORLAGE.name);
    expect(hinweis()).toBeNull();
    await kiSchliessen();
    box.presetsFehler = PRESETS_FEHLER;
    await kiOeffnen();
    expect(box.presetsAufrufe).toBeGreaterThan(1);
    // Nichts wird geleert: was zuletzt erfolgreich geholt wurde, bleibt sichtbar …
    expect(kiFlaeche().textContent).toContain(VORLAGE.name);
    // … und daneben steht, dass die Auffrischung scheiterte.
    expect(kiFlaeche().textContent).toContain(katalogsatz("de"));
    expect(seitentext()).not.toContain(i18n.t("state.error"));
  });

  // ------------------------------------------------------------------------------------------
  // JOB 3566 RUNDE 2 — die drei Lagen, die Runde 1 behauptet, aber nicht erzeugt hat (BEN).
  // ------------------------------------------------------------------------------------------

  it("G · OFFLINE vor dem Öffnen: der Abruf läuft gar nicht erst — und die Fläche sagt genau das", async () => {
    box.presetsListe = [VORLAGE];
    await ownDraft();
    // Der echte Offline-Zustand, gestellt an DER Quelle, aus der react-query sein „paused" ableitet
    // (`apps/web/src/lib/netzzustand.ts:13-18`) — nicht ein HTTP-500, der etwas anderes ist: dort
    // ANTWORTET der Server, hier wird nicht einmal gefragt.
    onlineManager.setOnline(false);
    await kiOeffnen();
    // Das ist der Unterschied zu Fall A: kein Aufruf, also auch kein Fehler, den `isError` sehen
    // könnte. Genau hier schwieg die Fläche in Runde 1.
    expect(box.presetsAufrufe).toBe(0);
    expect(vi.mocked(endpoints.reasoner.assistPresets)).not.toHaveBeenCalled();
    expect(hinweis(), "Offline steht der Satz nicht da").not.toBeNull();
    expect(kiFlaeche().textContent).toContain(katalogsatz("de"));
    expect(kiFlaeche().contains(hinweis())).toBe(true);
    expect(seitentext()).not.toContain(i18n.t("state.error"));
    // Bedienbar bleibt sie: die fünf Standardaktionen und die freie Eingabe sind nicht gesperrt.
    for (const action of ["clarify", "structure", "expand", "spelling", "format"]) {
      expect(button(i18n.t(`capture.ai.action.${action}`)).disabled, action).toBe(false);
    }
    await freeInput(INSTRUCTION);
    expect(button(i18n.t("capture.ai.run")).disabled).toBe(false);
    // Und kommt das Netz zurück, holt der Abruf nach: der Satz geht, die Funktion kommt.
    await act(async () => {
      onlineManager.setOnline(true);
      await flush();
    });
    await act(flush);
    expect(box.presetsAufrufe).toBe(1);
    expect(hinweis(), "Der Satz bleibt stehen, obwohl der Abruf gelang").toBeNull();
    expect(kiFlaeche().textContent).toContain(VORLAGE.name);
  });

  it("H · CACHE mit LAUFENDER Auffrischung: die Funktionen stehen, und es wird geschwiegen", async () => {
    box.presetsListe = [VORLAGE];
    await ownDraft();
    await kiOeffnen();
    expect(box.presetsAufrufe).toBe(1);
    expect(kiFlaeche().textContent).toContain(VORLAGE.name);
    await kiSchliessen();
    // Der ZWEITE Abruf bleibt offen — das ist die laufende Auffrischung. (Fall E hält den ERSTEN
    // offen; das ist „laden" und eine andere Lage: dort gibt es noch keinen Bestand.)
    box.presetsHalt = true;
    await kiOeffnen();
    expect(box.presetsAufrufe).toBe(2);
    expect(box.presetsAufloesen, "der zweite Abruf läuft gar nicht mehr").not.toBeNull();
    expect(kiFlaeche().textContent).toContain(VORLAGE.name);
    expect(hinweis(), "gescheitert ist noch nichts — der Satz wäre eine Falschaussage").toBeNull();
    expect(seitentext()).not.toContain(i18n.t("state.error"));
    // Und wenn die Auffrischung ankommt, bleibt es beim Schweigen — mit dem neuen Bestand.
    const ZWEITE = { id: "vorlage-2", name: "Übergabe lang", instruction: "Fasse ausführlich." };
    await act(async () => {
      box.presetsAufloesen?.([VORLAGE, ZWEITE]);
      await flush();
    });
    expect(kiFlaeche().textContent).toContain(ZWEITE.name);
    expect(hinweis()).toBeNull();
  });

  it("I · beide Fehler zugleich: zwei Stellen, zwei verschiedene Sätze, kein Sammelfehler", async () => {
    box.presetsFehler = PRESETS_FEHLER;
    box.assistFehler = () => new Error("Modell nicht erreichbar");
    await ownDraft();
    await kiOeffnen();
    expect(hinweis()).not.toBeNull();
    await freeInput(INSTRUCTION);
    await click(button(i18n.t("capture.ai.run")));
    expect(box.requests).toEqual([{ text: ORIGINAL, locale: "de", instruction: INSTRUCTION }]);
    // Der eigene Kanal der Assist-Anfrage: die Fehlerkarte im Blatt, mit ihrer eigenen Aussage.
    const karte = kiFehlerkarte();
    expect(karte, "die Fehlerkarte der Assist-Anfrage fehlt").not.toBeNull();
    expect(karte?.textContent).toContain(i18n.t("fd.errAssist"));
    expect(karte?.textContent).toContain(i18n.t("fd.originalUnchanged"));
    // Und daneben, in der wieder geöffneten Palette, steht weiterhin der Satz des Vorlagenabrufs.
    await kiOeffnen();
    expect(kiFlaeche().textContent).toContain(katalogsatz("de"));
    expect(kiFehlerkarte(), "die Fehlerkarte ist verschwunden").not.toBeNull();
    // Zwei Kanäle heißt: die Karte steht NICHT in der Palette, und die Sätze sind verschieden.
    expect(kiFlaeche().contains(kiFehlerkarte())).toBe(false);
    expect(kiFlaeche().contains(hinweis())).toBe(true);
    expect(katalogsatz("de")).not.toBe(i18n.t("fd.errAssist"));
    expect(kiFehlerkarte()?.textContent).not.toContain(katalogsatz("de"));
    // Und keiner der beiden ist der Satz der ganzen Seite.
    expect(seitentext()).not.toContain(i18n.t("state.error"));
    // Die KI speichert auch im Doppelfehler nichts.
    expect(endpoints.drafts.update).not.toHaveBeenCalled();
  });
});
