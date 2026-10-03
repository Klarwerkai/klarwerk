// @vitest-environment jsdom
// ================================================================================================
// Q3 (b) + R-0578 — DER VORDERTÜR-ALIAS UND DER UNGÜLTIG GESPEICHERTE ALTENTWURF.
// ================================================================================================
//
// ZWEI DER VIER GETRENNT ZU PRÜFENDEN DINGE AUS R-0578 stehen hier, die anderen beiden nicht:
//   · Q3 (c), die Stufenpflicht an `POST /api/kos`, misst `tests/q3c-stufenpflicht/`.
//   · die echte Bild-/Word-/Provenienzkette ist ein Gang durch Word und Panel, kein Vitest-Fall.
//
// A · Q3 (b): `/erfassen/vordertuer` führte nach `/start` statt zum Blatt. Die Adresse hatte nie
//     eine Router-Zeile (`apps/web/src/routes.tsx`) und fiel in den `*`-Zweig. Gemessen wird am
//     echten Router (`AppRoutes`), nicht an einer nachgebauten Routentabelle — dieselbe Bauform wie
//     `tests/entwuerfe-menuepunkt/weg-in-den-editor.test.tsx`.
//
// B · DER ALTENTWURF MIT UNGÜLTIGER STUFE. Die Schemaprüfung an `POST/PUT /api/drafts`
//     (`services/capture/src/draft-payload-schema.ts`) weist eine unbekannte Stufe heute mit 400
//     `BAD_REQUEST` ab. Das sagt NICHTS über Entwürfe, die schon VOR dieser Prüfung gespeichert
//     wurden: die liegen im Bestand und werden fortgesetzt, nicht neu angelegt. Deshalb wird der
//     Entwurf hier am Schema VORBEI direkt über den Dienst angelegt (`createDraft` prüft die Stufe
//     nicht — genau wie der Bestand sie nie geprüft hat) und dann über den Alias fortgesetzt. Die
//     Serverseite desselben Falls (Promote → INCOMPLETE, kein Objekt) misst F10b in
//     `promote-verlangt-stufe.test.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  const bauen = (): InstanceType<typeof CaptureService> =>
    new CaptureService({ repo: new InMemoryDraftRepo() });
  let svc = bauen();
  box.reset = () => {
    svc = bauen();
  };
  // Am Schema vorbei, wie der Altbestand: `createDraft` kennt die Stufenprüfung der Route nicht.
  box.seed = async (p: P) => (await svc.createDraft(p, "u1")).id;
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(async () => (await svc.listDrafts()).filter((d) => !("deletedAt" in d))),
        get: vi.fn(async (id: string) => svc.getDraft(id)),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: ok({ id: "ko-1", title: "egal" }),
      },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      ko: { list: ok([]) },
      knowledge: { check: ok({ status: "pending" }) },
      validation: { board: ok([]), settings: ok({ defaultNeededValidations: 3 }) },
      conflicts: { list: ok([]) },
      duplicates: { list: ok([]) },
      lifecycle: { pending: ok([]) },
      gaps: {
        list: ok([]),
        summary: ok({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }),
      },
      features: { get: ok({ features: {} }) },
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      notifications: { list: ok([]), markSeen: ok({ unseenCount: 0 }) },
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
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { AppRoutes } from "../../apps/web/src/routes";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const TITEL = "Splitterschutz vor Schichtbeginn pruefen";
const AUSSAGE = "Der Hebel wird vor jeder Schicht auf freien Lauf geprueft.";
const RUMPF = {
  title: TITEL,
  statement: AUSSAGE,
  bodyHtml: `<p>${AUSSAGE}</p>`,
  type: "best_practice",
  category: "Anlage 1",
};

let container: HTMLDivElement;
let root: Root | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-testid": "adresse" }, `${ort.pathname}${ort.search}`);
}

function adresse(): string {
  return container.querySelector('[data-testid="adresse"]')?.textContent ?? "";
}

/** Auf einen Anker WARTEN — jede Seite wird nachgeladen (`routes.tsx`, `lazy`). */
async function warteAuf<T extends Element>(name: string, frist = 20_000): Promise<T> {
  const ende = Date.now() + frist;
  for (;;) {
    const el = container.querySelector<T>(`[data-testid="${name}"]`);
    if (el) {
      return el;
    }
    if (Date.now() > ende) {
      throw new Error(`Anker „${name}“ kam nicht innerhalb von ${frist} ms. Adresse: ${adresse()}`);
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
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
                { initialEntries: [pfad] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(NavGuardProvider, null, createElement(AppRoutes)),
                ),
                createElement(Adresse),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await flush();
}

async function klick(el: Element): Promise<void> {
  await act(async () => {
    for (const art of ["mousedown", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(art, { bubbles: true, cancelable: true }));
    }
  });
  await flush();
}

function einreichenKnopf(): HTMLButtonElement {
  const wort = i18n.t("erfassen.einreichen");
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(wort),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${wort}“ fehlt`);
  }
  return knopf;
}

function werkzeug(): HTMLButtonElement {
  const el = container.querySelector('[data-testid="blatt-werkzeug-vertraulichkeit"]');
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error("Vertraulichkeits-Werkzeug fehlt");
  }
  return el;
}

function werkzeugWort(): string {
  return (werkzeug().textContent ?? "").replace(/\s+/g, " ").trim();
}

const promote = (): ReturnType<typeof vi.fn> =>
  endpoints.drafts.promote as unknown as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  box.reset();
  window.localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  vi.clearAllMocks();
});

describe("Q3 (b) · /erfassen/vordertuer führt zum Blatt, nicht nach /start", () => {
  it("A0 — KALIBRIERUNG: eine Adresse ohne Router-Zeile landet auf /start (so lief der Alias bisher)", async () => {
    // Ohne diesen Fall wäre A1 auch dann grün, wenn der `*`-Zweig gar nicht mehr umleitete.
    await montiere("/erfassen/vordertuer-gibt-es-nicht");
    expect(adresse()).toBe("/start");
  });

  it("A1 — der Alias zeigt das Blatt und bleibt auf seiner Adresse", async () => {
    await montiere("/erfassen/vordertuer");
    await warteAuf("blatt-huelle");
    expect(adresse()).toBe("/erfassen/vordertuer");
  });

  it("A2 — der Alias trägt `?draft=<id>`: genau dieser Entwurf steht im Blatt", async () => {
    const id = await box.seed({ ...RUMPF, confidentiality: "intern" });
    await montiere(`/erfassen/vordertuer?draft=${id}`);
    const titel = await warteAuf<HTMLInputElement>("blatt-titel");
    await flush();
    expect(titel.value).toBe(TITEL);
    expect(adresse()).toBe(`/erfassen/vordertuer?draft=${id}`);
  });
});

describe("R-0578 · ein UNGÜLTIG gespeicherter Altentwurf erbt keine Stufe", () => {
  it("B1 — fortgesetzt über den Alias: die Wahl steht offen, Einreichen löst kein Promote aus", async () => {
    const id = await box.seed({ ...RUMPF, confidentiality: "geheimniskraemerei" });
    await montiere(`/erfassen/vordertuer?draft=${id}`);
    const titel = await warteAuf<HTMLInputElement>("blatt-titel");
    await flush();
    // Vorbedingung: der Entwurf ist WIRKLICH geladen — sonst scheiterte das Einreichen am Inhalt.
    expect(titel.value).toBe(TITEL);

    // Der unbekannte Wert ist keine Einstufung: das Werkzeug trägt das neutrale Wort, keine Stufe.
    expect(werkzeugWort()).toContain(i18n.t("erfassen.werkzeug.vertraulichkeit"));
    for (const stufe of ["intern", "vertraulich", "streng_vertraulich"]) {
      expect(werkzeugWort()).not.toContain(i18n.t(`conf.level.${stufe}`));
    }

    await klick(einreichenKnopf());

    expect(
      promote(),
      "der Altentwurf mit ungültiger Stufe wurde eingereicht",
    ).not.toHaveBeenCalled();
    // Der Hinweis steht am Feld und ist ihm zugeordnet (N-0017 auf diesem Weg).
    const hinweis = await warteAuf("blatt-vertraulichkeit-hinweis");
    expect(hinweis.textContent).toBe(i18n.t("conf.requiredHint"));
    expect(werkzeug().getAttribute("aria-describedby")).toBe(hinweis.id);
  });

  it("B2 — derselbe Altentwurf, Stufe ausdrücklich gewählt: das Promote trägt GENAU diese Stufe", async () => {
    const id = await box.seed({ ...RUMPF, confidentiality: "geheimniskraemerei" });
    await montiere(`/erfassen/vordertuer?draft=${id}`);
    await warteAuf("blatt-titel");
    await flush();

    await klick(werkzeug());
    const menue = await warteAuf("blatt-menue-vertraulichkeit");
    const wort = i18n.t("conf.level.vertraulich");
    const eintrag = [...menue.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(wort),
    );
    if (!eintrag) {
      throw new Error(`Eintrag „${wort}“ fehlt im Menü`);
    }
    await klick(eintrag);
    await klick(einreichenKnopf());

    expect(promote()).toHaveBeenCalledTimes(1);
    const [kennung, vorgang] = promote().mock.calls[0] as [
      string,
      { draftPayload: { confidentiality?: unknown } },
    ];
    expect(kennung).toBe(id);
    expect(vorgang.draftPayload.confidentiality).toBe("vertraulich");
  });
});
