import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @vitest-environment jsdom
// JOB 3144 · UX-16/N-0042: gemountete Struktur, keine Layoutbehauptung in jsdom.
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { KlaraPathTeaser } from "../../apps/web/src/components/KlaraPathTeaser";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function mount(surface: "start" | "import"): Promise<void> {
  await act(async () => {
    root.render(createElement(MemoryRouter, null, createElement(KlaraPathTeaser, { surface })));
  });
}

describe("JOB 3144 · Word-Vorschau hat einen erreichbaren nächsten Schritt", () => {
  it.each([
    ["F8", "start"],
    ["F9", "import"],
  ] as const)("%s · auf %s führt genau ein Link zur bestehenden Hilfe", async (_fall, surface) => {
    await mount(surface);
    const links = host.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("/hilfe");
    expect(host.querySelector("details")?.nextElementSibling).toBe(links[0]);
  });

  it("F10 · der benannte Hilfe-Link gehört zur Tabulatorreihenfolge", async () => {
    await mount("start");
    const link = host.querySelector<HTMLAnchorElement>('a[href="/hilfe"]');
    expect(link, "Hilfe-Link fehlt").not.toBeNull();
    if (!link) throw new Error("Hilfe-Link fehlt");
    expect(link.tabIndex).toBe(0);
    expect(link.closest('[aria-hidden="true"], [hidden], [inert]')).toBeNull();
    expect(link.textContent).toBe(
      "Klara hilft dir schon heute in der Web-App — hier geht es zur Hilfe.",
    );
    expect(link.getAttribute("aria-label")).toBeNull();
    // Native Fokusfähigkeit + Tabindex prüfen die Struktur. Ein synthetisches Tab-Ereignis
    // bewegt in jsdom keinen Fokus; echte Tab-Navigation misst die Chromium-Datei daneben.
    link.focus();
    expect(document.activeElement).toBe(link);
  });

  it.each(["start", "import"] as const)(
    "F11 · %s bleibt Demnächst, ohne Klara-CTA oder Verfügbarkeitsbehauptung",
    async (surface) => {
      await mount(surface);
      expect(host.textContent).toContain("Demnächst");
      expect(host.textContent).toContain("Verfügbar ist das noch nicht.");
      expect(host.querySelector("button")).toBeNull();
      for (const cta of [
        "Mit Klara starten",
        "Mit Klara Wissen erfassen",
        "Import mit Klara begleiten",
      ]) {
        expect(host.textContent).not.toContain(cta);
      }
    },
  );
});
