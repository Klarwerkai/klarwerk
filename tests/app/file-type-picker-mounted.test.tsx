// @vitest-environment jsdom
// AUFTRAG-uxpol1 (PAKET 2): gemounteter Seam-Test des geteilten Dateityp-Kachel-Bauteils. Echter
// React-Mount (Muster wie file-format-info-mounted). Gepinnt (Ehrlichkeit aus IC-7 bleibt absolut):
//  (a) die AKTIVE JSON-Kachel löst onActivate aus (echter, bestehender Fluss) — KEIN neuer Fetch/Egress.
//  (b) eine „bald"-Kachel löst KEIN onActivate/keinen Import aus und zeigt den ehrlichen Hinweis.
//  (c) eine „geplant"-Kachel ebenso (eigener Hinweis), kein onActivate.
//  (d) Import (ImportSourceGallery) nutzt DASSELBE Bauteil — die aktive JSON-Kachel löst onActivate aus.
//  (e) i18n DE/EN/NL je Zustands-Badge.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { FileTypePicker } from "../../apps/web/src/components/FileTypePicker";
import { ImportSourceGallery } from "../../apps/web/src/components/ImportSourceGallery";
import i18n from "../../apps/web/src/i18n";
import { FILE_SOURCES } from "../../apps/web/src/lib/importSourceGallery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let activated: string[];
let fetchSpy: ReturnType<typeof vi.fn>;

function mount(el: unknown): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(el as Parameters<typeof root.render>[0]);
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  activated = [];
  // „kein neuer Egress": jeglicher Fetch würde hier auffallen — er darf NIE passieren.
  fetchSpy = vi.fn();
  (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
});

afterEach(async () => {
  act(() => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

function tile(state: string): HTMLButtonElement {
  const btn = container.querySelector(`button[data-state="${state}"]`);
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Kachel [data-state=${state}] fehlt`);
  }
  return btn;
}

function tileById(id: string): HTMLButtonElement {
  const btn = container.querySelector(`button[data-id="${id}"]`);
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Kachel [data-id=${id}] fehlt`);
  }
  return btn;
}

describe("FileTypePicker — aktiv löst echten Fluss aus, bald/geplant nie (Ehrlichkeit)", () => {
  beforeEach(() => {
    mount(
      createElement(FileTypePicker, {
        sources: FILE_SOURCES,
        onActivate: (id: string) => activated.push(id),
      }),
    );
  });

  it("(a) aktive JSON-Kachel löst onActivate aus — kein Fetch/Egress, kein Hinweis", () => {
    act(() => {
      tileById("json-file").click();
    });
    expect(activated).toEqual(["json-file"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    // Kein „bald/geplant"-Hinweis bei aktiver Kachel.
    expect(container.querySelector("output")).toBeNull();
  });

  it("(b) „bald“-Kachel löst KEINEN Import aus und zeigt den ehrlichen Hinweis", () => {
    act(() => {
      tile("soon").click();
    });
    expect(activated).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    const hint = String(i18n.getResource("de", "translation", "imp.gallery.hintSoon"));
    expect(container.querySelector("output")?.textContent).toBe(hint);
  });

  it("(c) „geplant“-Kachel löst KEINEN Import aus und zeigt den eigenen Hinweis", () => {
    act(() => {
      tile("planned").click();
    });
    expect(activated).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    const hint = String(i18n.getResource("de", "translation", "imp.gallery.hintPlanned"));
    expect(container.querySelector("output")?.textContent).toBe(hint);
  });

  it("(e) i18n DE/EN/NL: das Aktiv-Badge folgt der Sprache", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await i18n.changeLanguage(lng);
      });
      const badge = String(i18n.getResource(lng, "translation", "imp.explore.active"));
      expect(tileById("json-file").textContent).toContain(badge);
    }
  });
});

describe("ImportSourceGallery — nutzt DASSELBE FileTypePicker-Bauteil", () => {
  it("(d) die aktive JSON-Datei-Kachel löst onActivate aus (gleicher Seam wie Erfassen)", () => {
    mount(
      createElement(ImportSourceGallery, {
        onActivate: (id: string) => activated.push(id),
      }),
    );
    act(() => {
      tileById("json-file").click();
    });
    expect(activated).toEqual(["json-file"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
