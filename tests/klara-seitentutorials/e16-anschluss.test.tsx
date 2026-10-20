import { afterEach, beforeEach, expect, it, vi } from "vitest";
// @vitest-environment jsdom
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement as h, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { TutorialBereich } from "../../apps/web/src/tutorial/TutorialBereich";
import {
  TutorialEinstieg,
  TutorialFlaeche,
  TutorialProvider,
  useTutorialFuerKlara,
} from "../../apps/web/src/tutorial/TutorialRahmen";
import { EINFUEHRUNG_UEBUNG } from "../../apps/web/src/tutorial/einfuehrung/lektion";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let ende: (() => void) | undefined;
const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
async function ruhe(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}
async function klick(el: HTMLElement | null): Promise<void> {
  expect(el).not.toBeNull();
  await act(async () => {
    el?.click();
  });
  await ruhe();
}
function Inhalt(): JSX.Element {
  const [uebung, setUebung] = useState(true);
  const tutorial = useTutorialFuerKlara();
  return h(
    "div",
    null,
    h(TutorialEinstieg),
    h(
      "main",
      null,
      h(TutorialFlaeche),
      uebung
        ? h(TutorialBereich, {
            definition: EINFUEHRUNG_UEBUNG,
            id: "e16-uebung",
            onSchliessen: () => setUebung(false),
          })
        : null,
      h(
        "button",
        { "data-testid": "e16-ausblenden", onClick: () => setUebung(false) },
        "Einführungsübung verlassen",
      ),
    ),
    h(
      "output",
      { "data-testid": "klara-lage" },
      tutorial.lage ? `${tutorial.lage.definitionId}/${tutorial.lage.schrittIndex}` : "keine",
    ),
    h("output", { "data-testid": "klara-offen" }, String(tutorial.offen)),
    h("output", { "data-testid": "klara-vorhanden" }, String(tutorial.vorhanden)),
    h("button", { "data-testid": "klara-oeffnen", onClick: tutorial.oeffnen }, "Tutorial zeigen"),
    h(
      "button",
      { "data-testid": "klara-zwischenfrage", onClick: () => tutorial.lage?.pause() },
      "Zwischenfrage",
    ),
    h(
      "button",
      { "data-testid": "klara-zurueck", onClick: () => tutorial.lage?.zurueck() },
      "Zurück",
    ),
  );
}
async function montiere(): Promise<void> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  const query = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  ende = () => {
    act(() => root.unmount());
    query.clear();
    el.remove();
  };
  await act(async () => {
    root.render(
      h(
        QueryClientProvider,
        { client: query },
        h(
          MemoryRouter,
          { initialEntries: ["/profil?bereich=klara&einfuehrung=1"] },
          h(TutorialProvider, null, h(Inhalt)),
        ),
      ),
    );
  });
  await ruhe();
}
beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  ende?.();
  ende = undefined;
  vi.restoreAllMocks();
});

it("meldet die echte E16-Lektion an Klara auch bei geschlossenem Profil-Seitentutorial", async () => {
  const fetchProbe = vi.spyOn(globalThis, "fetch");
  await montiere();
  expect(q("tutorial-knopf")?.getAttribute("aria-expanded")).toBe("false");
  expect(q("klara-lage")?.textContent).toBe("persoenliche-einfuehrung/0");
  expect(q("klara-offen")?.textContent).toBe("true");
  expect(q("klara-vorhanden")?.textContent).toBe("true");
  await klick(q("klara-oeffnen"));
  expect(q("tutorial-knopf")?.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement?.closest("[data-tutorial]")?.id).toBe("e16-uebung");
  await klick(q("klara-zwischenfrage"));
  expect(q("klara-lage")?.textContent).toBe("persoenliche-einfuehrung/0");
  expect(fetchProbe).not.toHaveBeenCalled();
});
it("aktiviert den fokussierten echten Bereich und erhält den anderen Schritt nach Schließen", async () => {
  await montiere();
  await klick(q("tutorial-knopf"));
  const seite = document.querySelector<HTMLElement>('[data-tutorial="seite-profil"]');
  await klick(seite?.querySelector<HTMLElement>('[data-schritt="ergebnis"]') ?? null);
  expect(q("klara-lage")?.textContent).toBe("seite-profil/2");
  const einfuehrung = document.getElementById("e16-uebung");
  await act(async () => {
    einfuehrung?.querySelector<HTMLElement>("h2")?.focus();
  });
  await ruhe();
  expect(q("klara-lage")?.textContent).toBe("persoenliche-einfuehrung/0");
  await klick(q("klara-zurueck"));
  expect(
    seite?.querySelector('[data-testid="tutorial-erklaerung"]')?.getAttribute("data-schritt"),
  ).toBe("ergebnis");
  await klick(
    einfuehrung?.querySelector<HTMLElement>('[data-testid="tutorial-schliessen"]') ?? null,
  );
  expect(q("klara-lage")?.textContent).toBe("seite-profil/2");
});
it("löscht beim Verlassen einer inaktiven E16-Übung nicht die aktive Seitenmeldung", async () => {
  await montiere();
  await klick(q("tutorial-knopf"));
  const seite = document.querySelector<HTMLElement>('[data-tutorial="seite-profil"]');
  await klick(seite?.querySelector<HTMLElement>('[data-schritt="ergebnis"]') ?? null);
  expect(q("klara-lage")?.textContent).toBe("seite-profil/2");
  await klick(q("e16-ausblenden"));
  expect(q("klara-lage")?.textContent).toBe("seite-profil/2");
});
