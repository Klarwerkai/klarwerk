// @vitest-environment jsdom
// ================================================================================================
// R-0300 — DIE KI-SCHREIBHILFE BEARBEITET DEN MARKIERTEN TEXT, NICHT DEN GANZEN RUMPF.
// ================================================================================================
//
// Bens Befund (Nacharbeit 1): Der Standardeditor schickte unabhängig von einer Markierung den ganzen
// Rumpf (`assistInput`) und ersetzte bei der Übernahme den ganzen Rumpf. Der Originalpunkt R-0300
// sagt „den MARKIERTEN Text"; „Der Vorschlag kann übernommen oder eingefügt werden".
//
// Gemountet wie `tests/ki-freie-anweisung/standardeditor-mounted.test.tsx`: echte Capture-Seite,
// echtes Blatt, echter RichTextEditor, echter CaptureService. Gestellt sind nur Transport und
// Modellantwort. Die Markierung wird mit der Selection-API im Schreibfeld gesetzt — so, wie ein
// Mensch sie mit Maus oder Umschalt+Pfeil setzt.
//
//   M1  Markierung → „Klarer": NUR der markierte Text geht an die KI; Vorschau nennt die Stelle;
//       Übernehmen ersetzt nur sie — Fettschrift und Liste daneben bleiben unverändert.
//   M2  Markierung → „Dahinter einfügen": der Vorschlag steht hinter der Stelle, sie selbst bleibt.
//   M3  Markierung über Fettschrift → „Rechtschreibung": korrigiert, Fett innerhalb bleibt,
//       der Absatz davor ist unberührt.
//   M4  Nach der Anfrage weitergeschrieben: der Vorschlag ist zurückgezogen, NICHTS wird
//       übernommen (die Sperre der Übernahme selbst: `auswahl-assist.test.tsx`).
//   M5  Ohne Markierung: der bisherige Gesamttextweg — ganzer Text geht hin, ganzer Text wird ersetzt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  requests: [] as { text: string; instruction: string }[],
  antwort: "",
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
    box.antwort = "";
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
        assistPresets: ok([]),
        structure: vi.fn(async () => ({
          title: "x",
          statement: "x",
          conditions: [],
          measures: [],
          tags: [],
          confidence: 0.8,
          demo: false,
        })),
        assist: vi.fn(async (text: string, _locale: string, instruction: string) => {
          box.requests.push({ text, instruction });
          return { text: box.antwort };
        }),
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

async function mitEntwurf(bodyHtml: string): Promise<void> {
  const entwurf = await endpoints.drafts.create({
    title: "Routerübergabe",
    bodyHtml,
    confidentiality: "intern",
  } as never);
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
                  { initialEntries: [`/erfassen?draft=${entwurf.id}`] },
                  createElement(
                    Routes,
                    null,
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

async function click(btn: Element | null | undefined): Promise<void> {
  if (!(btn instanceof HTMLElement)) {
    throw new Error("Knopf fehlt");
  }
  await act(async () => {
    btn.click();
    await flush();
  });
  await act(flush);
}

function editor(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[contenteditable="true"]');
  if (!el) throw new Error("Editor fehlt");
  return el;
}

function knopf(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
}

function textknoten(wurzel: Node, enthaelt: string): Text {
  const gaenger = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  let k = gaenger.nextNode();
  while (k !== null) {
    if ((k as Text).data.includes(enthaelt)) {
      return k as Text;
    }
    k = gaenger.nextNode();
  }
  throw new Error(`Textknoten mit „${enthaelt}" fehlt`);
}

/** Eine Markierung setzen, wie Maus oder Umschalt+Pfeil es tun. */
async function markieren(anfang: Text, von: number, ende: Text, bis: number): Promise<void> {
  const bereich = document.createRange();
  bereich.setStart(anfang, von);
  bereich.setEnd(ende, bis);
  const auswahl = document.getSelection();
  auswahl?.removeAllRanges();
  auswahl?.addRange(bereich);
  await act(async () => {
    document.dispatchEvent(new Event("selectionchange"));
    await flush();
  });
}

async function kiAktion(label: string): Promise<void> {
  await click(container.querySelector('[data-testid="blatt-werkzeug-ki"]'));
  await click(knopf(label));
}

function vorschlag(): HTMLElement | null {
  return container.querySelector('[data-testid="blatt-ki-vorschlag"]');
}

const SATZ = "Der Kunde recieved den Router.";
const RUMPF = `<p><strong>Wichtig:</strong> ${SATZ}</p><ul><li>Punkt eins</li></ul>`;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
  document.getSelection()?.removeAllRanges();
});
afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  vi.clearAllMocks();
});

describe("R-0300 · KI-Schreibhilfe auf der Markierung im Standardeditor", () => {
  it("M1 · nur die Markierung geht hin; Übernehmen ersetzt nur sie, Fett und Liste bleiben", async () => {
    await mitEntwurf(RUMPF);
    box.antwort = "Der Kunde hat den Router erhalten.";
    const knoten = textknoten(editor(), SATZ);
    const von = knoten.data.indexOf(SATZ);
    await markieren(knoten, von, knoten, von + SATZ.length);

    await kiAktion(i18n.t("capture.ai.action.clarify"));

    expect(box.requests).toHaveLength(1);
    expect(box.requests[0]?.text, "es ging mehr als die Markierung an die KI").toBe(SATZ);
    // Vorschau zuerst: der Rumpf ist noch unverändert, die Karte nennt die Stelle.
    expect(editor().innerHTML).toContain(SATZ);
    expect(
      container.querySelector('[data-testid="blatt-ki-auswahl"]')?.textContent ?? "",
    ).toContain(SATZ);

    await click(knopf(i18n.t("fd.accept")));

    const html = editor().innerHTML;
    expect(html).toContain("<strong>Wichtig:</strong> Der Kunde hat den Router erhalten.");
    expect(html).toContain("<ul><li>Punkt eins</li></ul>");
    expect(html).not.toContain("recieved");
    expect(vorschlag()).toBeNull();
  });

  it("M2 · „Dahinter einfügen“ setzt den Vorschlag hinter die Stelle und lässt sie stehen", async () => {
    await mitEntwurf(RUMPF);
    box.antwort = "Er hat ihn geprüft.";
    const knoten = textknoten(editor(), SATZ);
    const von = knoten.data.indexOf(SATZ);
    await markieren(knoten, von, knoten, von + SATZ.length);

    await kiAktion(i18n.t("capture.ai.action.expand"));
    await click(container.querySelector('[data-testid="blatt-ki-einfuegen"]'));

    const html = editor().innerHTML;
    expect(html).toContain(`<strong>Wichtig:</strong> ${SATZ} Er hat ihn geprüft.`);
    expect(html).toContain("<ul><li>Punkt eins</li></ul>");
  });

  it("M3 · Rechtschreibung auf einer Markierung über Fettschrift: Fett bleibt, der Rest ist unberührt", async () => {
    await mitEntwurf(
      "<p>Davor bleibt alles.</p><p><strong>Der Kunde</strong> recieved den Router.</p>",
    );
    box.antwort = "Der Kunde received den Router.";
    const fett = textknoten(editor(), "Der Kunde");
    const rest = textknoten(editor(), "recieved");
    await markieren(fett, 0, rest, rest.data.length);

    await kiAktion(i18n.t("capture.ai.action.spelling"));
    expect(box.requests[0]?.text).toBe("Der Kunde recieved den Router.");

    await click(knopf(i18n.t("fd.accept")));

    const html = editor().innerHTML;
    expect(html).toContain("<p>Davor bleibt alles.</p>");
    expect(html).toContain("<p><strong>Der Kunde</strong> received den Router.</p>");
  });

  it("M4 · nach der Anfrage weitergeschrieben: der Vorschlag ist zurückgezogen, nichts wird übernommen", async () => {
    // Prüflauf Nacharbeit 2: hier stand die Annahme, die Karte bliebe nach dem Weiterschreiben
    // stehen und „Übernehmen“ melde dann die veraltete Stelle. Das Blatt tut mehr: jede Eingabe
    // im Schreibfeld verwirft den offenen Vorschlag (`changeBodyHtml` → `clearAssistState`). Ein
    // veralteter Vorschlag ist auf diesem Weg also gar nicht mehr anzunehmen. Die Sperre der
    // Übernahme selbst prüft `auswahl-assist.test.tsx` (A3) an der Funktion.
    await mitEntwurf(RUMPF);
    box.antwort = "Der Kunde hat den Router erhalten.";
    const knoten = textknoten(editor(), SATZ);
    const von = knoten.data.indexOf(SATZ);
    await markieren(knoten, von, knoten, von + SATZ.length);
    await kiAktion(i18n.t("capture.ai.action.clarify"));
    expect(vorschlag()).not.toBeNull();

    // Der Mensch schreibt weiter — die markierte Stelle trägt jetzt anderen Text.
    const neu = "<p><strong>Wichtig:</strong> Ganz anderer Satz steht hier jetzt.</p>";
    editor().innerHTML = neu;
    await act(async () => {
      editor().dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });

    expect(vorschlag(), "Vorschlag zu überholtem Text steht noch da").toBeNull();
    expect(knopf(i18n.t("fd.accept"))).toBeUndefined();
    expect(editor().innerHTML).toContain("Ganz anderer Satz steht hier jetzt.");
    expect(editor().innerHTML).not.toContain("Der Kunde hat den Router erhalten.");
  });

  it("M5 · ohne Markierung bleibt der Gesamttextweg: ganzer Text hin, ganzer Text ersetzt", async () => {
    await mitEntwurf(`<p>${SATZ}</p>`);
    box.antwort = "Der Kunde hat den Router erhalten.";

    await kiAktion(i18n.t("capture.ai.action.clarify"));

    expect(box.requests[0]?.text).toBe(SATZ);
    expect(container.querySelector('[data-testid="blatt-ki-auswahl"]')).toBeNull();
    expect(container.querySelector('[data-testid="blatt-ki-einfuegen"]')).toBeNull();
    await click(knopf(i18n.t("fd.accept")));
    expect(editor().textContent).toBe("Der Kunde hat den Router erhalten.");
  });
});
