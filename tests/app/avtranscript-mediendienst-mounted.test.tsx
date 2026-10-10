// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-ocr` (R-0121, Nacharbeit 6) — DIE TRANSKRIPT-KACHEL FOLGT DEM MEDIENDIENST
// ================================================================================================
//
// Bens Befund: die Kachel „Audio-/Video-Transkript" sagte fest „nicht konfiguriert — kein Dienst
// hinterlegt", auch als `GET /api/media/status` `active: true` meldete und die Transkription über
// den vorhandenen Anhangsweg gelang. Hier wird die ECHTE Import-Galerie mit Abfrage-Kontext gemountet
// und nur die Statusantwort des Mediendienstes gestellt.
//
//   M1  Dienst aktiv   → Kachel „im Erfassen", Klick nennt den vorhandenen Weg (Beifügen →
//                        Dokumente → Transkribieren); kein Import, kein Link auf den Dateiimport.
//   M2  Dienst inaktiv → Kachel „nicht konfiguriert", Klick sagt „kein Dienst hinterlegt".
import { afterEach, describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => ({ active: false }));

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      media: {
        ...original.endpoints.media,
        status: vi.fn(async () => ({ active: status.active, engine: status.active ? "x" : null })),
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
import { ImportSourceGallery } from "../../apps/web/src/components/ImportSourceGallery";
import i18n from "../../apps/web/src/i18n";
import {
  AVTRANSCRIPT_ACTIVE_HINT_KEY,
  STATE_BADGE_KEY,
  STATE_HINT_KEY,
} from "../../apps/web/src/lib/importSourceGallery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onActivate = vi.fn();

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(aktiv: boolean): Promise<void> {
  status.active = aktiv;
  await i18n.changeLanguage("de");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ImportSourceGallery, { onActivate }),
      ),
    );
    await flush();
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  onActivate.mockClear();
});

function kachel(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-id="avtranscript"]');
  if (!el) {
    throw new Error("Keine Transkript-Kachel");
  }
  return el;
}

async function klicke(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

describe("gesamt-ocr · R-0121 · die Transkript-Kachel folgt dem gemeldeten Mediendienst", () => {
  it("M1 · Dienst aktiv: „im Erfassen“, und der Klick nennt den vorhandenen Weg", async () => {
    await mount(true);
    const el = kachel();
    expect(el.getAttribute("data-state")).toBe("elsewhere");
    expect(el.textContent).toContain(i18n.t(STATE_BADGE_KEY.elsewhere));
    // Kein Link auf den Dateiimport: der nimmt keine Aufnahme an.
    expect(el.tagName).toBe("BUTTON");
    await klicke(el);
    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t(AVTRANSCRIPT_ACTIVE_HINT_KEY));
    expect(text).not.toContain(i18n.t(STATE_HINT_KEY.unconfigured));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("M2 · Dienst inaktiv: „nicht konfiguriert“, und der Klick sagt, dass kein Dienst hinterlegt ist", async () => {
    await mount(false);
    const el = kachel();
    expect(el.getAttribute("data-state")).toBe("unconfigured");
    await klicke(el);
    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t(STATE_HINT_KEY.unconfigured));
    expect(text).not.toContain(i18n.t(AVTRANSCRIPT_ACTIVE_HINT_KEY));
    expect(onActivate).not.toHaveBeenCalled();
  });
});
