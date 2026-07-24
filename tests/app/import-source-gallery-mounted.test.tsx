// @vitest-environment jsdom
// AUFTRAG-ic7-import-vision (Mounted): die EHRLICHE Quellen-Galerie rendert alle drei
// Zustandsklassen in der Reihenfolge aktiv→bald→geplant; ein Klick auf „geplant"/„bald" loest
// KEINEN Import/keinen echten Call aus (onActivate + fetch bleiben stumm) und zeigt nur den
// ehrlichen „kommt später"/„in Arbeit"-Hinweis; nur „aktiv" (JSON) ruft den echten Fluss (onActivate).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ImportSourceGallery } from "../../apps/web/src/components/ImportSourceGallery";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RANK: Record<string, number> = { active: 0, soon: 1, planned: 2 };

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onActivate: ReturnType<typeof vi.fn>;
let fetchSpy: ReturnType<typeof vi.fn>;
const realFetch = globalThis.fetch;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(ImportSourceGallery, { onActivate }));
  });
}

function tiles(): HTMLButtonElement[] {
  return [...container.querySelectorAll("button[data-id]")] as HTMLButtonElement[];
}

function tileById(id: string): HTMLButtonElement {
  const tile = tiles().find((b) => b.getAttribute("data-id") === id);
  if (!tile) {
    throw new Error(`Kachel ${id} nicht gefunden`);
  }
  return tile;
}

beforeEach(() => {
  onActivate = vi.fn();
  fetchSpy = vi.fn();
  // Egress-Gegenprobe: keine Kachel darf einen echten Netz-Call ausloesen.
  (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  (globalThis as unknown as { fetch: unknown }).fetch = realFetch;
  vi.clearAllMocks();
});

describe("ic7: Galerie rendert alle drei Zustandsklassen in Reihenfolge", () => {
  it("Systeme + Dateien tragen aktiv/bald/geplant und sind je Galerie geordnet", () => {
    mount();
    const states = tiles().map((b) => b.getAttribute("data-state") ?? "");
    expect(states).toContain("active");
    expect(states).toContain("soon");
    expect(states).toContain("planned");

    // Zwei Galerien (Systeme + Dateien) — jede fuer sich aktiv→bald→geplant. Da beide hintereinander
    // gerendert werden, pruefen wir die Ordnung je data-id-Gruppe ueber die bekannten Kacheln.
    const systemIds = ["confluence", "json", "jira", "word-sys", "pdf-sys", "sharepoint"];
    const ranks = systemIds.map((id) => RANK[tileById(id).getAttribute("data-state") ?? ""] ?? 99);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });

  it("Badges tragen TEXT (nicht nur Farbe) — barrierearm", async () => {
    await i18n.changeLanguage("de");
    mount();
    expect(tileById("confluence").textContent).toContain("aktiv");
    expect(tileById("jira").textContent).toContain("bald");
    expect(tileById("sharepoint").textContent).toContain("geplant");
  });

  it("keine Kachel nutzt bg-ink (schuetzt die Ein-Primaer-CTA-Zaehlung des Fluss-Steppers)", () => {
    mount();
    for (const tile of tiles()) {
      expect(tile.className.includes("bg-ink"), tile.getAttribute("data-id") ?? "").toBe(false);
    }
  });
});

describe("ic7: ehrlicher Klick-Zustand — geplant/bald loesen KEINEN Import aus", () => {
  it("Klick auf eine GEPLANT-Kachel: kein onActivate, kein fetch, nur der ehrliche Hinweis", async () => {
    await i18n.changeLanguage("de");
    mount();
    act(() => {
      tileById("sharepoint").click();
    });
    expect(onActivate).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Geplant — kommt später.");
    // Der Hinweis ist nicht-modal (aria-live status), kein blockierender Dialog.
    const notice = container.querySelector("output");
    expect(notice?.getAttribute("aria-live")).toBe("polite");
  });

  it("Klick auf eine BALD-Kachel: kein onActivate, kein fetch, in-Arbeit-Hinweis", async () => {
    await i18n.changeLanguage("de");
    mount();
    act(() => {
      tileById("jira").click();
    });
    expect(onActivate).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain("In Arbeit — diese Quelle kommt bald.");
  });

  it("erneuter Klick auf dieselbe geplante Kachel schliesst den Hinweis wieder (Toggle)", async () => {
    await i18n.changeLanguage("de");
    mount();
    act(() => {
      tileById("sap").click();
    });
    expect(container.textContent).toContain("Geplant — kommt später.");
    act(() => {
      tileById("sap").click();
    });
    expect(container.querySelector("output")).toBeNull();
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe("ic7: aktiv loest den echten bestehenden Fluss aus (keine Regression)", () => {
  it("Klick auf die aktive JSON-Datei-Kachel ruft onActivate(json-file) und keinen fetch", () => {
    mount();
    act(() => {
      tileById("json-file").click();
    });
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith("json-file");
    // „echter Fluss" heisst: der Seam wird gezogen — NICHT die Galerie selbst netzwerkt.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Klick auf Confluence (aktiv) ruft onActivate(confluence); der geplante SharePoint-Hinweis verschwindet dabei", () => {
    mount();
    // Erst einen ehrlichen Hinweis oeffnen …
    act(() => {
      tileById("sharepoint").click();
    });
    expect(container.querySelector("output")).not.toBeNull();
    // … dann eine aktive Kachel: sie zieht den echten Seam und blendet den Hinweis aus.
    act(() => {
      tileById("confluence").click();
    });
    expect(onActivate).toHaveBeenCalledWith("confluence");
    expect(container.querySelector("output")).toBeNull();
  });
});

describe("ic7: i18n DE/EN/NL — Badge + Hinweis", () => {
  it("der geplant-Badge und der ehrliche Hinweis erscheinen in jeder UI-Sprache", async () => {
    const expected = {
      de: { badge: "geplant", hint: "Geplant — kommt später." },
      en: { badge: "planned", hint: "Planned — coming later." },
      nl: { badge: "gepland", hint: "Gepland — komt later." },
    } as const;
    let mounted = false;
    for (const lng of ["de", "en", "nl"] as const) {
      if (mounted) {
        // Vorherige Iteration ZUERST abbauen (sonst re-rendert changeLanguage einen alten Baum
        // ausserhalb von act); die LETZTE bleibt fuer afterEach stehen (kein Doppel-Unmount).
        act(() => {
          root.unmount();
        });
        container.remove();
      }
      await i18n.changeLanguage(lng);
      mount();
      mounted = true;
      expect(tileById("sharepoint").textContent, lng).toContain(expected[lng].badge);
      act(() => {
        tileById("sharepoint").click();
      });
      expect(container.textContent, lng).toContain(expected[lng].hint);
    }
    await i18n.changeLanguage("de");
  });
});
