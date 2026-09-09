// @vitest-environment jsdom
// ================================================================================================
// JOB 3377 · ENTWURF-MOBIL-DESKTOP-R — DIE GANZE KETTE, BIS ZUR GEÖFFNETEN DESKTOP-FLÄCHE.
// ================================================================================================
//
// BEN hat JOB 3289 R4 an genau dieser Stelle eine Lücke angekreidet (Prüfpunkt 3, TEILWEISE):
//
//     „gegenfaelle-r3-mounted.test.tsx:41 liest aber lediglich payload.bodyHtml; die
//      Desktop-Oberfläche wird nicht geöffnet."
//
// Diesmal wird sie geöffnet. Gefahren wird: Handy-Fläche mounten → Entwurf fortsetzen → Satz
// anhängen → speichern → derselbe ECHTE CaptureService (InMemoryDraftRepo, echte
// `mergeDraftPayload`- und `sanitizeDraftPayload`-Grenze) wird erneut gelesen → der Entwurf wird in
// der DESKTOP-Fläche (`CaptureArbeitsraum`) fortgesetzt → im Editor steht der neue Satz UND das
// Linkziel.
//
// WARUM DER GESEEDETE BODY DURCH DEN SANITIZER LÄUFT: der Speicherweg sanitisiert jedes `bodyHtml`
// an der Persistenzgrenze (`sanitizeDraftPayload`, services/capture/src/service.ts). Stünde hier
// die rohe Fassung als Erwartung, prüfte der Vergleich die Zutat des Sanitizers statt die Arbeit
// dieses Auftrags. Deshalb ist der Ausgangsstand DER Stand, den der Server wirklich hält.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_payload: Record<string, unknown>): Promise<string> => "",
  lies: async (_id: string): Promise<Record<string, unknown>> => ({}),
  updates: [] as Record<string, unknown>[],
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
    box.updates.length = 0;
  };
  box.seed = async (payload: P) => (await svc.createDraft(payload, "u1")).id;
  box.lies = async (id: string) => {
    const alle = await svc.listDrafts();
    const treffer = alle.find((d) => d.id === id);
    if (!treffer) {
      throw new Error(`Entwurf ${id} nicht gefunden`);
    }
    return treffer.payload as unknown as P;
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      ko: { list: ok([]) },
      conflicts: { list: ok([]) },
      library: { search: ok([]) },
      ask: { ask: ok({ answered: false }) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => (await svc.resumeDraft(id))?.draft),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => {
          box.updates.push(p);
          return svc.continueDraft(id, p, "u1");
        }),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
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
import { Mobile } from "../../apps/web/src/pages/Mobile";
import { sanitizeHtml } from "../../services/structure";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// BENs Gegenfall, wörtlich — in der Fassung, die der Speicherweg wirklich hält.
const LINK_BODY = sanitizeHtml(
  '<p><a href="https://klarwerk.de">Hand<br><br>buch</a></p><p><strong>A</strong></p>',
);

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(seite: "mobile" | "desktop"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const pfad = seite === "mobile" ? "/mobile" : "/erfassen";
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
                  { initialEntries: [{ pathname: pfad, state: { from: "/start" } }] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/mobile",
                      element: createElement(Mobile),
                    }),
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement(CaptureArbeitsraum),
                    }),
                    createElement(Route, {
                      path: "/start",
                      element: createElement("div", null, "START-SEITE"),
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

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
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

function buttonByTitle(title: string): HTMLButtonElement {
  const btn = container.querySelector(`button[title="${title}"]`);
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Titel „${title}“ nicht gefunden`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function textfeld(): HTMLTextAreaElement {
  const el = container.querySelector("textarea");
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error("Mobiles Textfeld nicht gefunden");
  }
  return el;
}

async function tippe(el: HTMLTextAreaElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Der Fliesstext-Editor der DESKTOP-Fläche (`RichTextEditor`, contentEditable mit Textbox-Rolle). */
function desktopEditor(): HTMLElement {
  const el = container.querySelector(
    `[role="textbox"][aria-label="${i18n.t("editor.bodyLabel")}"]`,
  );
  if (!(el instanceof HTMLElement)) {
    throw new Error("Desktop-Editor (Fließtext) nicht gefunden");
  }
  return el;
}

async function mobilFortsetzen(): Promise<void> {
  await click(buttonByTitle(i18n.t("mob.resume")));
}

async function desktopFortsetzen(): Promise<void> {
  const aufklapper = maybeButtonByText("Entwürfe anzeigen");
  if (aufklapper) {
    await click(aufklapper);
  }
  await click(buttonByText(i18n.t("capture.resume")));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("JOB 3377 · Handy schreibt, Desktop sieht es — und behält seine Formatierung", () => {
  it("Satz anhängen am Handy → am Desktop steht er, und href und Fettung stehen noch da", async () => {
    const id = await box.seed({ title: "Handbuch", bodyHtml: LINK_BODY });

    await mount("mobile");
    await mobilFortsetzen();
    // DAS Feld, das der Desktop zeigt: derselbe Text, nicht ein zweiter.
    expect(textfeld().value).toBe("Hand\n\nbuch\n\nA");
    await tippe(textfeld(), "Hand\n\nbuch\n\nA\n\nNachtrag vom Handy");
    await click(buttonByText(i18n.t("mob.update")));
    abbauen();

    // Der ECHTE Speicherstand — nicht die abgeschickte Nutzlast.
    const gespeichert = await box.lies(id);
    expect(gespeichert.bodyHtml).toBe(`${LINK_BODY}<p>Nachtrag vom Handy</p>`);

    // ... und die Desktop-Fläche, geöffnet.
    await mount("desktop");
    await desktopFortsetzen();
    const editor = desktopEditor();
    expect(editor.textContent).toContain("Nachtrag vom Handy");
    expect(editor.innerHTML).toContain('href="https://klarwerk.de"');
    expect(editor.querySelector("strong")?.textContent).toBe("A");
    abbauen();
  });

  it("Fortsetzen → Aktualisieren OHNE Eingabe lässt den Body byte-gleich (BEN Prüfpunkt 4)", async () => {
    const id = await box.seed({ title: "Handbuch", bodyHtml: LINK_BODY });

    await mount("mobile");
    await mobilFortsetzen();
    await click(buttonByText(i18n.t("mob.update")));
    abbauen();

    expect(await box.lies(id).then((p) => p.bodyHtml)).toBe(LINK_BODY);
  });

  it("der Wächter-Weg („Entwurf speichern und wechseln“) nimmt DENSELBEN Weg", async () => {
    const id = await box.seed({ title: "Handbuch", bodyHtml: LINK_BODY });

    await mount("mobile");
    await mobilFortsetzen();
    await tippe(textfeld(), "Hand\n\nbuch\n\nA\n\nUeber den Waechter");
    await click(buttonByText(i18n.t("topbar.toDesktop")));
    await click(buttonByText(i18n.t("nav.guard.save")));
    abbauen();

    expect(await box.lies(id).then((p) => p.bodyHtml)).toBe(
      `${LINK_BODY}<p>Ueber den Waechter</p>`,
    );
    // Genau ein Weg: die Nutzlast des Wächters trägt den Body und NICHT die Kernaussage.
    expect(box.updates).toHaveLength(1);
    expect(box.updates[0]?.statement).toBeUndefined();
  });

  it("ein Entwurf OHNE Body verhält sich unverändert — die Kernaussage bleibt das eine Feld", async () => {
    const id = await box.seed({ title: "Ohne Rumpf", statement: "Alte Aussage" });

    await mount("mobile");
    await mobilFortsetzen();
    expect(textfeld().value).toBe("Alte Aussage");
    await tippe(textfeld(), "Neue Aussage");
    await click(buttonByText(i18n.t("mob.update")));
    abbauen();

    const gespeichert = await box.lies(id);
    expect(gespeichert.statement).toBe("Neue Aussage");
    expect(gespeichert.bodyHtml).toBeUndefined();
  });
});

// ================================================================================================
// RUNDE 2 — BENS DREI GEGENFÄLLE, AN DER ECHTEN FLÄCHE UND AM ECHTEN SPEICHERSTAND.
// ================================================================================================
//
// BEN hat sie in Runde 1 selbst gemessen (GESAMTURTEIL ROT) und als Korrekturpflichten 1–3
// festgehalten. Sie stehen hier dauerhaft, gefahren wie er sie gefahren hat: einmal OHNE jede
// Eingabe (nur „Fortsetzen → Aktualisieren"), einmal mit einem eingefügten Absatz davor. Gemessen
// wird nicht die abgeschickte Nutzlast, sondern der Stand IM CaptureService.
//
// Das Bild trägt bewusst eine echte Daten-URL: der Server-Sanitizer lässt nur
// `/api/objects/…/raw` oder `data:image/…;base64,…` durch (`isSafeImgSrc`, services/structure/src/
// sanitize.ts). Mit einem erfundenen `x.png` prüfte dieser Fall den Sanitizer statt diesen Auftrag —
// deshalb sichert jeder Bildfall AUSDRÜCKLICH zuerst, dass das Bild schon im AUSGANGSSTAND steht
// (BENs Prüflücke 6).
const BILD = '<img src="data:image/png;base64,QQ==" alt="Pumpe">';

/**
 * Ein Entwurf, EIN Fortsetzen, ein Speichern — und der Stand danach.
 *
 * Jeder Fall bekommt seinen eigenen frischen Dienst. Läge ein zweiter Entwurf in der Liste, träfe
 * „Fortsetzen" den ERSTEN, und der Fall prüfte still einen anderen Entwurf als den gemeinten.
 */
async function speichernUndLesen(
  bodyHtml: string,
  eingriff: "keine Eingabe" | "NEU davor",
): Promise<{ ausgang: string; danach: string }> {
  box.reset();
  const id = await box.seed({ title: "Gegenfall", bodyHtml });
  const ausgang = String((await box.lies(id)).bodyHtml);
  await mount("mobile");
  await mobilFortsetzen();
  if (eingriff === "NEU davor") {
    await tippe(textfeld(), `NEU\n\n${textfeld().value}`);
  }
  await click(buttonByText(i18n.t("mob.update")));
  abbauen();
  return { ausgang, danach: String((await box.lies(id)).bodyHtml) };
}

describe("JOB 3377 R2 · BENs Gegenfälle am echten Speicherstand", () => {
  it("BEN 1 · mehrdeutiger Klartext: ohne Eingabe bleibt die Reihenfolge", async () => {
    const koerper = sanitizeHtml("<p><strong>A</strong></p><p><em>B</em></p><p>A<br><br>B</p>");
    const r = await speichernUndLesen(koerper, "keine Eingabe");
    expect(r.ausgang).toBe(koerper);
    expect(r.danach).toBe(koerper);
  });

  it("BEN 1 · mehrdeutiger Klartext: auch mit NEU davor bleibt die Reihenfolge", async () => {
    const koerper = sanitizeHtml("<p><strong>A</strong></p><p><em>B</em></p><p>A<br><br>B</p>");
    const r = await speichernUndLesen(koerper, "NEU davor");
    expect(r.danach).toBe(`<p>NEU</p>${koerper}`);
  });

  it("BEN 2 · ein Absatz, der `[[1]]` lautet, bleibt Text; das Bild bleibt an seiner Stelle", async () => {
    const koerper = sanitizeHtml(`<p>[[1]]</p><p>${BILD}</p>`);
    const r = await speichernUndLesen(koerper, "keine Eingabe");
    // BENs Prüflücke 6: das Bild steht schon im AUSGANGSSTAND — sonst misst der Fall nichts.
    expect(r.ausgang).toContain("data:image/png;base64,QQ==");
    expect(r.ausgang).toBe(koerper);
    expect(r.danach).toBe(koerper);
  });

  it("BEN 2 · derselbe Fall mit NEU davor — der Einschub verschiebt weder Text noch Bild", async () => {
    const koerper = sanitizeHtml(`<p>[[1]]</p><p>${BILD}</p>`);
    const r = await speichernUndLesen(koerper, "NEU davor");
    expect(r.ausgang).toContain("data:image/png;base64,QQ==");
    expect(r.danach).toBe(`<p>NEU</p>${koerper}`);
  });

  it("BEN 3 · der gespeicherte Zeilenumbruch zwischen zwei Absätzen überlebt ohne Eingabe", async () => {
    // Der Sanitizer erzeugt diesen Zwischenraum nicht; er kommt aus Import/Einfügen. Gemessen wird
    // deshalb gegen den Stand, den der Dienst nach dem Anlegen wirklich hält.
    const r = await speichernUndLesen("<p>A</p>\n<p><strong>B</strong></p>\n", "keine Eingabe");
    expect(r.ausgang).toContain("</p>\n<p>");
    expect(r.danach).toBe(r.ausgang);
  });

  it("BEN 3 · derselbe Zeilenumbruch überlebt auch den Einschub davor", async () => {
    const r = await speichernUndLesen("<p>A</p>\n<p><strong>B</strong></p>\n", "NEU davor");
    expect(r.ausgang).toContain("</p>\n<p>");
    expect(r.danach).toBe(`<p>NEU</p>${r.ausgang}`);
  });
});

// ================================================================================================
// RUNDE 3 — BENS LETZTER GEGENFALL, AM ECHTEN SPEICHERSTAND.
// ================================================================================================
//
// BEN R2, Korrekturpflicht 1, wörtlich: „Ohne Eingabe: <p><strong></strong></p><p>A</p> wird im
// echten CaptureService zu <p>A</p>. Mit NEU davor verschwindet derselbe unberührte Absatz."
//
// Jeder Fall sichert AUSDRÜCKLICH zuerst, dass der leere ausgezeichnete Absatz im AUSGANGSSTAND
// wirklich steht (BENs Ausgangsspeicherprüfung). Ohne diese Zusicherung liefe der Fall ins Leere,
// falls der Sanitizer den Absatz schon beim Anlegen verwürfe — er prüfte dann nichts.

describe("JOB 3377 R3 · leere ausgezeichnete Absätze am echten Speicherstand", () => {
  const LEER_FORMATIERT = "<p><strong></strong></p><p>A</p>";

  it("ohne Eingabe bleibt der leere ausgezeichnete Absatz bytegleich stehen", async () => {
    const r = await speichernUndLesen(LEER_FORMATIERT, "keine Eingabe");
    expect(r.ausgang).toContain("<strong></strong>");
    expect(r.danach).toBe(r.ausgang);
  });

  it("mit NEU davor verschwindet er ebenfalls nicht", async () => {
    const r = await speichernUndLesen(LEER_FORMATIERT, "NEU davor");
    expect(r.ausgang).toContain("<strong></strong>");
    expect(r.danach).toBe(`<p>NEU</p>${r.ausgang}`);
  });
});
