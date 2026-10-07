// @vitest-environment jsdom
// ================================================================================================
// R-1646 · DIE SEITE `/ausgangspruefung` — gemountet, mit echtem i18n und echtem Router.
// ================================================================================================
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · Der Controller sieht den ausgehenden Text; jede Ersetzung ist als `<mark>` mit ihrer Art
//        hervorgehoben; ein mitgesendetes Bild ist ausdrücklich benannt; „Freigeben" und
//        „Ablehnen" treffen genau die Entscheidungsroute dieses Aufrufs. Ausgeschaltet sagt die
//        Seite das, statt eine leere Liste zu zeigen.
//
// Der Server ist hier eine Attrappe von `fetch`; die Serverseite misst `draht.test.ts`.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { AusgangspruefungLage } from "../../apps/web/src/api/ausgangspruefung";
import i18n from "../../apps/web/src/i18n";
import { Ausgangspruefung } from "../../apps/web/src/pages/Ausgangspruefung";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LAGE: AusgangspruefungLage = {
  aktiv: true,
  wartezeitMs: 300_000,
  offen: [
    {
      id: "a-1",
      anbieter: "cloud:openai:gpt-4o-mini",
      erstelltAm: "2026-10-07T08:00:00.000Z",
      laeuftAbAm: "2026-10-07T08:05:00.000Z",
      system: [{ text: "Antworte knapp.", ersetzt: null }],
      nutzer: [
        { text: "Frage von ", ersetzt: null },
        { text: "[Person 1]", ersetzt: "person" },
        { text: ", erreichbar unter ", ersetzt: null },
        { text: "[E-Mail 1]", ersetzt: "email" },
        { text: ": Wie lautet die Prüffrist?", ersetzt: null },
      ],
      bildUnveraendert: true,
      ersetzungen: { person: 1, email: 1, telefon: 0, iban: 0 },
    },
  ],
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const aufrufe: { url: string; methode: string }[] = [];

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function montieren(lage: AusgangspruefungLage): Promise<void> {
  aufrufe.length = 0;
  // Antwortattrappe in derselben Form wie `tests/ki-anbieterwahl/karte-mounted.test.tsx`: der
  // Client liest nur `ok`, `status`, `statusText` und `text()` (`apps/web/src/api/client.ts`).
  // Ein echtes `Response` unter jsdom lieferte hier keinen Körper an die Seite.
  vi.stubGlobal("fetch", (async (url: unknown, init?: { method?: string }) => {
    const methode = init?.method ?? "GET";
    aufrufe.push({ url: String(url), methode });
    const koerper = methode === "POST" ? { id: "a-1", entscheidung: "freigegeben" } : lage;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify(koerper),
    } as unknown as Response;
  }) as unknown as typeof fetch);
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
        createElement(
          MemoryRouter,
          { initialEntries: ["/ausgangspruefung"] },
          createElement(Ausgangspruefung),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("R-1646 · Seite Ausgangsprüfung", () => {
  it("zeigt den ausgehenden Text mit hervorgehobenen Ersetzungen und dem Bildhinweis", async () => {
    await montieren(LAGE);
    const text = container.querySelector('[data-testid="ausgang-nutzertext"]');
    expect(text?.textContent).toBe(
      "Frage von [Person 1], erreichbar unter [E-Mail 1]: Wie lautet die Prüffrist?",
    );
    const marken = [...container.querySelectorAll('mark[data-testid="ausgang-ersetzung"]')];
    expect(marken.map((m) => [m.textContent, m.getAttribute("data-art")])).toEqual([
      ["[Person 1]", "person"],
      ["[E-Mail 1]", "email"],
    ]);
    expect(marken[0]?.getAttribute("title")).toBe("Person");
    expect(container.querySelector('[data-testid="ausgang-ersetzungen"]')?.textContent).toBe(
      "Ersetzt: Person: 1 · E-Mail: 1",
    );
    expect(container.querySelector('[data-testid="ausgang-bild"]')?.textContent).toContain(
      "unverändert",
    );
    expect(container.textContent).toContain("cloud:openai:gpt-4o-mini");
  });

  it("„Freigeben und senden“ trifft genau die Freigaberoute dieses Aufrufs", async () => {
    await montieren(LAGE);
    const knopf = container.querySelector<HTMLButtonElement>('[data-testid="ausgang-freigeben"]');
    expect(knopf?.textContent).toBe("Freigeben und senden");
    await act(async () => {
      knopf?.click();
      await flush();
    });
    expect(aufrufe).toContainEqual({
      url: "/api/ausgangspruefung/a-1/freigeben",
      methode: "POST",
    });
    expect(aufrufe.some((a) => a.url.endsWith("/ablehnen"))).toBe(false);
  });

  it("„Ablehnen“ trifft genau die Ablehnungsroute dieses Aufrufs", async () => {
    await montieren(LAGE);
    const knopf = container.querySelector<HTMLButtonElement>('[data-testid="ausgang-ablehnen"]');
    await act(async () => {
      knopf?.click();
      await flush();
    });
    expect(aufrufe).toContainEqual({
      url: "/api/ausgangspruefung/a-1/ablehnen",
      methode: "POST",
    });
    expect(aufrufe.some((a) => a.url.endsWith("/freigeben"))).toBe(false);
  });

  it("ausgeschaltet: die Seite sagt es und zeigt keine Entscheidungsknöpfe", async () => {
    await montieren({ aktiv: false, wartezeitMs: null, offen: [] });
    expect(container.querySelector('[data-testid="ausgang-aus"]')?.textContent).toContain(
      "ausgeschaltet",
    );
    expect(container.querySelector('[data-testid="ausgang-freigeben"]')).toBeNull();
  });
});
