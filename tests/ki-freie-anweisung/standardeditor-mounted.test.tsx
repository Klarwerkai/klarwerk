// @vitest-environment jsdom
// JOB 3428: echte Capture-Seite, RichTextEditor und CaptureService; nur Modellantwort/Transport sind gestellt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  /** Was der Client WIRKLICH an die Reasoner-Endpunkte gegeben hat, je Aufruf. */
  assist: [] as Record<string, unknown>[],
  structure: [] as Record<string, unknown>[],
  requests: [] as { text: string; locale: string; instruction: string }[],
  resolve: null as null | ((value: { text: string }) => void),
  hold: false,
  /**
   * JOB 3353 B: was der Endpunkt statt eines Vorschlags WIRFT — gesetzt von den Fällen K3/K4. Der
   * Fehler wird im Test gebaut (mit dem echten `ApiError`), nicht hier: diese Fabrik läuft
   * gehoistet, vor jedem Import.
   */
  assistFehler: null as null | (() => unknown),
  /**
   * RUNDE 2: was der Vorlagen-Endpunkt statt einer Liste WIRFT — gesetzt von Fall F6. Runde 1 hat
   * diesen Fehler als „Etwas ist schiefgelaufen" auf die ganze Fläche geschrieben; zwei fremde
   * Wächter (JOB 2684 D2/D4) wurden dadurch rot.
   */
  presetsFehler: null as null | (() => unknown),
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
    box.assist.length = 0;
    box.structure.length = 0;
    box.assistFehler = null;
    box.presetsFehler = null;
    box.requests.length = 0;
    box.resolve = null;
    box.hold = false;
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
        // Dieselbe Gestalt, die die echte Route liefert (capture-routes.ts:1043 —
        // `resumeDraft(...).draft`), nicht der rohe Datensatz: sonst misst der Test eine Form,
        // die es im Produkt nicht gibt.
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
          if (box.presetsFehler) {
            throw box.presetsFehler();
          }
          return [
            {
              id: "vorlage-1",
              name: "Übergabe kurz",
              instruction: "Fasse die Übergabe in zwei Sätzen zusammen.",
            },
          ];
        }),
        // Ein VOLLSTÄNDIGER Vorschlag, wie ihn die echte Route liefert (`StructureResult`) — ein
        // `{}` als Attrappe reicht nicht: die Seite liest `statement`/`title` und stürzte darüber.
        structure: vi.fn(async (_text: string, _locale: string, provenance: P) => {
          box.structure.push(provenance);
          return {
            title: "Routerübergabe",
            statement: "Der Router wurde übergeben.",
            conditions: [],
            measures: [],
            tags: [],
            confidence: 0.8,
            demo: false,
          };
        }),
        assist: vi.fn(
          async (_text: string, _locale: string, _instruction: string, provenance: P) => {
            box.assist.push(provenance);
            box.requests.push({ text: _text, locale: _locale, instruction: _instruction });
            if (box.hold)
              return new Promise<{ text: string }>((resolve) => {
                box.resolve = resolve;
              });
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

/**
 * Schreiben ins Blatt. Die Schreibfläche ist ein UNKONTROLLIERTES `contentEditable`
 * (`RichTextEditor.tsx:3078`); der Zustand des Blattes entsteht aus dessen `onInput`. Genau diesen
 * Weg nimmt dieser Helfer — kein Setzen von React-Zustand an der Fläche vorbei.
 */
async function schreiben(text: string): Promise<void> {
  const feld = [...container.querySelectorAll<HTMLElement>("[contenteditable]")].find(
    (e) => e.getAttribute("contenteditable") === "true",
  );
  if (!feld) {
    throw new Error("Schreibfläche des Blattes nicht gefunden");
  }
  feld.innerHTML = `<p>${text}</p>`;
  await act(async () => {
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

const ORIGINAL = "Der Kunde recieved den Router.";
const INSTRUCTION = "Formuliere die Übergabe höflich, ohne Fakten hinzuzufügen.";
const PRESET = "Fasse die Übergabe in zwei Sätzen zusammen.";

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
async function freeInput(value: string): Promise<void> {
  const el = [...container.querySelectorAll("input")].find(
    (e) => e.getAttribute("aria-label") === i18n.t("capture.ai.freeLabel"),
  );
  expect(el, "Freie KI-Anweisung fehlt im Standardeditor").toBeDefined();
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
async function runFree(): Promise<void> {
  await click(byId("blatt-werkzeug-ki"));
  await freeInput(INSTRUCTION);
  await click(button(i18n.t("capture.ai.run")));
}
function preview(): HTMLElement | null {
  return container.querySelector('[data-testid="blatt-ki-vorschlag"]');
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
});

describe("JOB 3428 · freie KI-Anweisung im Standardeditor", () => {
  it("F1 · Navigation, eigener Entwurf, sichtbarer Text und echte Herkunft, Vorschau, Übernahme, erneutes Speichern und Wiederöffnen", async () => {
    const id = await ownDraft();
    await schreiben(`${ORIGINAL} Neuer sichtbarer Zusatz.`);
    await click(byId("blatt-entwurf-sichern"));
    const writes = vi.mocked(endpoints.drafts.update).mock.calls.length;
    await schreiben(`${ORIGINAL} Noch nicht gespeicherter Zusatz.`);
    await runFree();
    expect(box.requests).toEqual([
      {
        text: `${ORIGINAL} Noch nicht gespeicherter Zusatz.`,
        locale: "de",
        instruction: INSTRUCTION,
      },
    ]);
    expect(box.assist).toEqual([{ source: "draft", confidentiality: "intern", draftId: id }]);
    expect(preview()?.textContent).toContain("Der Kunde received den Router.");
    expect(preview()?.textContent).toContain(INSTRUCTION);
    expect(editor().textContent).toContain("Noch nicht gespeicherter Zusatz.");
    expect(vi.mocked(endpoints.drafts.update).mock.calls).toHaveLength(writes);
    await click(button(i18n.t("fd.accept")));
    expect(editor().textContent).toBe("Der Kunde received den Router.");
    expect(vi.mocked(endpoints.drafts.update).mock.calls).toHaveLength(writes);
    await click(byId("blatt-entwurf-sichern"));
    expect(vi.mocked(endpoints.drafts.update).mock.calls).toHaveLength(writes + 1);
    expect(vi.mocked(endpoints.drafts.update).mock.lastCall?.[0]).toBe(id);
    act(() => root.unmount());
    container.remove();
    await mount(`/erfassen?draft=${id}`);
    expect(editor().textContent).toBe("Der Kunde received den Router.");
  });

  it("F2 · bestehende Vorlage zeigt ihre Anweisung, sendet sie unverändert und lässt sich ablehnen", async () => {
    const id = await ownDraft();
    await click(byId("blatt-werkzeug-ki"));
    expect(container.querySelector('[data-testid="blatt-menue-ki"]')?.textContent).toContain(
      PRESET,
    );
    await click(button("Übergabe kurz"));
    expect(box.requests[0]?.instruction).toBe(PRESET);
    expect(box.assist[0]?.draftId).toBe(id);
    expect(preview()).not.toBeNull();
    await click(button(i18n.t("fd.discardProposal")));
    expect(preview()).toBeNull();
    expect(editor().textContent).toBe(ORIGINAL);
    expect(endpoints.drafts.update).not.toHaveBeenCalled();
  });

  it("F3 · Fehler und Wiederholung nach Sprachwechsel behalten Inhalt und konkrete freie Anweisung", async () => {
    await ownDraft();
    box.assistFehler = () => new ApiError(500, "ERROR", "Modellfehler");
    await runFree();
    expect(container.querySelector('[data-testid="blatt-ki-fehler"]')?.textContent).toContain(
      i18n.t("fd.errAssist"),
    );
    expect(editor().textContent).toBe(ORIGINAL);
    box.assistFehler = null;
    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    await click(button(i18n.t("erfassen.erneutVersuchen")));
    expect(box.requests).toHaveLength(2);
    expect(box.requests[1]).toEqual({ text: ORIGINAL, locale: "en", instruction: INSTRUCTION });
    expect(preview()).not.toBeNull();
    expect(editor().textContent).toBe(ORIGINAL);
    expect(endpoints.drafts.update).not.toHaveBeenCalled();
  });

  it("F4 · Abbruch der Eingabe und Sprachwechsel während offener Modellantwort erhalten den Inhalt", async () => {
    await ownDraft();
    await click(byId("blatt-werkzeug-ki"));
    await freeInput(INSTRUCTION);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await flush();
    });
    expect(box.requests).toHaveLength(0);
    expect(editor().textContent).toBe(ORIGINAL);
    box.hold = true;
    await runFree();
    expect(preview()).toBeNull();
    expect(editor().textContent).toBe(ORIGINAL);
    await act(async () => {
      await i18n.changeLanguage("en");
      box.resolve?.({ text: "Vorschlag nach Sprachwechsel" });
      await flush();
    });
    expect(preview()?.textContent).toContain("Vorschlag nach Sprachwechsel");
    expect(editor().textContent).toBe(ORIGINAL);
    await click(button(i18n.t("fd.discardProposal")));
    expect(editor().textContent).toBe(ORIGINAL);
    expect(endpoints.drafts.update).not.toHaveBeenCalled();
  });

  it("F5 · alle fünf Standardaktionen senden weiterhin ihre Anweisung und lassen sich bewusst übernehmen", async () => {
    await ownDraft();
    const actions = ["clarify", "structure", "expand", "spelling", "format"];
    for (const action of actions) {
      await schreiben(
        action === "spelling" ? "Der Kunde <strong>recieved</strong> den Router." : ORIGINAL,
      );
      await click(byId("blatt-werkzeug-ki"));
      await click(button(i18n.t(`capture.ai.action.${action}`)));
      expect(box.requests.at(-1)?.instruction).toBe(i18n.t(`capture.ai.instr.${action}`));
      expect(editor().textContent).toBe(ORIGINAL);
      await click(button(i18n.t("fd.accept")));
      expect(editor().textContent).toBe("Der Kunde received den Router.");
      if (action === "spelling")
        expect(editor().querySelector("strong")?.textContent).toBe("received");
    }
    expect(box.requests).toHaveLength(5);
    expect(endpoints.drafts.update).not.toHaveBeenCalled();
  });

  // RUNDE 2 — der Fehler, an dem Runde 1 im Tor scheiterte, als eigener Fall.
  //
  // Der Vorlagenabruf ist eine NEBENSACHE der KI-Fläche. Scheitert er, fehlen die eigenen Vorlagen
  // — mehr nicht. Runde 1 schrieb dafür `state.error` („Etwas ist schiefgelaufen.") in die Fläche;
  // dieser Satz behauptet einen Fehler der GANZEN Seite, obwohl der Standardeditor vollständig
  // arbeitet. Zwei fremde Wächter haben genau das gemessen und den Lauf rot gemacht:
  // `tests/capture/job2684-d2-studio-mounted.test.tsx:…` und
  // `tests/capture/job2684-d4-studio-dokumentweg-mounted.test.tsx:262` prüfen beim DRAFT_STALE-Weg
  // `expect(pageText()).not.toContain(i18n.t("state.error"))` — der fremde Vorlagenfehler stand
  // ihnen im Weg und tarnte sich als Fehler ihres eigenen Weges.
  //
  // Ein knapperer, eigener Text wäre ein neuer i18n-Schlüssel in `apps/web/src/i18n.ts` — außerhalb
  // der Zielpfade dieses Auftrags. Der alte Arbeitsraum (`Capture.tsx:4514` → `AiAssistBox`) zeigt
  // seit jeher ebenfalls keinen Vorlagenfehler; „derselbe vorhandene Weg" heißt hier also: kein
  // Sammelfehler. Dieser Fall hält das fest, damit der Satz nicht ein drittes Mal zurückkommt.
  it("F6 · scheitert der Vorlagenabruf, steht KEIN Sammelfehler auf der Seite — die freie Anweisung arbeitet weiter", async () => {
    box.presetsFehler = () => new ApiError(500, "ERROR", "Vorlagen nicht erreichbar");
    await ownDraft();
    await click(byId("blatt-werkzeug-ki"));
    expect(vi.mocked(endpoints.reasoner.assistPresets)).toHaveBeenCalled();
    const menue = container.querySelector('[data-testid="blatt-menue-ki"]');
    // Die Vorlage fehlt ehrlich — sie wird nicht erfunden und nicht aus einem Zwischenspeicher
    // behauptet.
    expect(menue?.textContent).not.toContain(PRESET);
    expect(menue?.textContent).not.toContain("Übergabe kurz");
    // Und der Fehler wird nicht zum Fehler der Seite.
    expect(container.textContent).not.toContain(i18n.t("state.error"));
    // Der Weg, der nicht vom Vorlagenabruf abhängt, steht vollständig.
    await freeInput(INSTRUCTION);
    await click(button(i18n.t("capture.ai.run")));
    expect(box.requests).toHaveLength(1);
    expect(box.requests[0]?.instruction).toBe(INSTRUCTION);
    expect(preview()?.textContent).toContain("Der Kunde received den Router.");
    expect(container.textContent).not.toContain(i18n.t("state.error"));
    await click(button(i18n.t("fd.accept")));
    expect(editor().textContent).toBe("Der Kunde received den Router.");
  });
});
