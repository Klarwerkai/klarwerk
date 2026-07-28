// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega32 BLOCK H (Pedis Beobachtung) — DIE QUELLENWAHL MUSS WÄHLEN.
// ================================================================================================
//
// Pedi: „Wenn ich oben etwas ausgewählt habe, sollte alles, was dann nicht mehr in Frage kommt,
// ausgeblendet werden." Der Grund war grundsätzlicher als die Anzeige: es gab GAR KEINEN Zustand
// „gewählte Quelle" — nur einen `stage`. Eine Kachel löste eine Handlung aus, aber niemand merkte
// sich, was gewählt wurde. Und der JSON-Kasten stand komplett außerhalb des Providers.
//
// DIE FALLE (H3), und warum sie ihren eigenen Test bekommt: `handleActivate` klickte den versteckten
// Dateieingang über seine DOM-Kennung. Der Eingang liegt in genau dem Kasten, den H2 ausblendet —
// wird der Kasten bedingt, greift der Griff ins Leere, GERÄUSCHLOS, ohne Fehler in der Konsole.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      import: {
        explore: vi.fn(async () => ({
          summary: {
            totalCount: 0,
            distinctSources: 0,
            dateRange: null,
            authors: [],
            themes: [],
            spaces: [],
          },
          truncated: false,
          alreadyImported: 0,
          alreadyQueued: 0,
          failedPages: 0,
        })),
      },
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ImportExplore } from "../../apps/web/src/components/ImportExplore";
import {
  IMPORT_JSON_CARD_ID,
  ImportJsonUpload,
} from "../../apps/web/src/components/ImportJsonUpload";
import {
  ImportCockpitProvider,
  ImportStepperBar,
} from "../../apps/web/src/components/ImportStepper";
import i18n from "../../apps/web/src/i18n";
import { JSON_UPLOAD_INPUT_ID } from "../../apps/web/src/lib/importSourceGallery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
// H3: Jeder Klick auf den versteckten Dateieingang wird gezählt — GENAU das ist die Wirkung, die
// beim DOM-Durchgriff geräuschlos verschwunden wäre.
let fileDialogOpens = 0;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Der echte Seiten-Ausschnitt: Provider + Schrittleiste + Galerie/Erkunden + JSON-Kasten, genau in
// der Verschachtelung aus pages/Stufe2.tsx.
async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/import"] },
          createElement(
            ImportCockpitProvider,
            null,
            createElement(ImportStepperBar),
            createElement(ImportExplore),
            createElement(ImportJsonUpload, {
              dragOver: false,
              setDragOver: () => {},
              onDrop: () => {},
              onFile: () => {},
              disabled: false,
            }),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const tile = (id: string): HTMLElement | undefined =>
  Array.from(container.querySelectorAll("button[data-id]")).find(
    (el) => el.getAttribute("data-id") === id,
  ) as HTMLElement | undefined;

const click = async (el: HTMLElement | undefined | null): Promise<void> => {
  await act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(flush);
};

const jsonCard = (): HTMLElement | null => container.querySelector(`#${IMPORT_JSON_CARD_ID}`);
// Der Erkunden-Schritt ist da, wenn SEIN Knopf da ist — in beiden Beschriftungen: vor der
// Landkarte „Weiter: Erkunden", danach „Neu erkunden" (der Knopf tritt zurück, bleibt aber).
const exploreCta = (): HTMLElement | null =>
  (Array.from(container.querySelectorAll("button")).find((b) => {
    const text = b.textContent ?? "";
    return (
      text.includes(i18n.t("imp.explore.cta")) || text.includes(i18n.t("imp.explore.ctaAgain"))
    );
  }) ?? null) as HTMLElement | null;

beforeEach(async () => {
  fileDialogOpens = 0;
  globalThis.localStorage?.clear();
  await i18n.changeLanguage("de");
  // Jeden echten Dialog-Aufruf abfangen: jsdom öffnet keinen, aber der KLICK ist die messbare Wirkung.
  HTMLInputElement.prototype.click = function patched(this: HTMLInputElement) {
    if (this.id === JSON_UPLOAD_INPUT_ID) {
      fileDialogOpens += 1;
    }
  };
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("mega32 H · die Quelle wird gewählt, und die Seite folgt ihr", () => {
  it("ohne Wahl steht alles wie bisher — Ausblenden beginnt erst mit einer echten Wahl", async () => {
    await mount();
    expect(jsonCard()).not.toBeNull();
    expect(exploreCta()).not.toBeNull();
  });

  it("H2 Confluence: der JSON-Kasten verschwindet, die Confluence-Schritte bleiben", async () => {
    await mount();
    await click(tile("confluence"));
    // Pedis Beobachtung, behoben: der Kasten „JSON-RE-IMPORT" steht nicht mehr darunter.
    expect(jsonCard()).toBeNull();
    expect(exploreCta()).not.toBeNull();
  });

  it("H2 JSON: die Confluence-Schritte verschwinden, der JSON-Kasten bleibt", async () => {
    await mount();
    await click(tile("json"));
    expect(exploreCta()).toBeNull();
    expect(jsonCard()).not.toBeNull();
  });

  it("H3 — DIE FALLE: die JSON-Kachel erreicht den Dateiweg auch NACH dem Umbau", async () => {
    await mount();
    await click(tile("json"));
    // Genau die Wirkung, die beim DOM-Durchgriff geräuschlos ausgefallen wäre.
    expect(fileDialogOpens).toBe(1);
    // Und der Eingang ist danach auch wirklich noch im Dokument (kein toter Knopf).
    expect(container.querySelector(`#${JSON_UPLOAD_INPUT_ID}`)).not.toBeNull();
  });

  it("H3 — DIE FALLE SCHARF: erst Confluence (Kasten weg), DANN JSON", async () => {
    await mount();
    // Nach der Confluence-Wahl ist der Kasten ausgeblendet — und mit ihm der versteckte Eingang.
    await click(tile("confluence"));
    expect(jsonCard()).toBeNull();
    expect(container.querySelector(`#${JSON_UPLOAD_INPUT_ID}`)).toBeNull();

    // GENAU HIER griff der DOM-Durchgriff ins Leere: `getElementById` liefert `null`, weil der
    // Kasten im Dokument nicht existiert — und React hat auf den Zustandswechsel noch gar nicht
    // gerendert. Die JSON-Kachel hätte GERÄUSCHLOS nichts getan.
    await click(tile("json"));
    expect(jsonCard()).not.toBeNull();
    expect(fileDialogOpens).toBe(1);
  });

  it("H3: die WIEDERHOLTE Wahl öffnet den Dialog erneut (abgebrochener Dialog, zweiter Versuch)", async () => {
    await mount();
    await click(tile("json"));
    await click(tile("json"));
    // Ein boolean-Flag wäre nach dem ersten Mal blind gewesen — der Zähler ist es nicht.
    expect(fileDialogOpens).toBe(2);
  });

  it("H3-Gegenprobe: die Confluence-Kachel öffnet KEINEN Dateidialog", async () => {
    await mount();
    await click(tile("confluence"));
    expect(fileDialogOpens).toBe(0);
  });

  it("H4: der Weg zur anderen Quelle bleibt sichtbar und geht ohne Neuladen", async () => {
    await mount();
    await click(tile("confluence"));
    expect(jsonCard()).toBeNull();
    // Die Galerie steht weiter da — Ausblenden ist kein Wegnehmen.
    expect(tile("json")).toBeDefined();
    await click(tile("json"));
    expect(jsonCard()).not.toBeNull();
    expect(exploreCta()).toBeNull();
    // Und zurück, ebenfalls ohne Neuladen.
    await click(tile("confluence"));
    expect(exploreCta()).not.toBeNull();
    expect(jsonCard()).toBeNull();
  });

  it("H4: ein Quellenwechsel ist eine neue Generation — die Schrittleiste nimmt ihre Haken zurück", async () => {
    await mount();
    // Confluence erkunden ⇒ Schritt „Erkunden" ist erreicht (die Leiste hakt ihn ab).
    await click(tile("confluence"));
    const nachErkunden = container.querySelectorAll('[data-step-status="done"]').length;
    expect(nachErkunden).toBeGreaterThan(0);

    // Wechsel auf JSON: eine Landkarte aus dem Confluence-Weg zählt nicht für den JSON-Weg.
    await click(tile("json"));
    expect(container.querySelectorAll('[data-step-status="done"]').length).toBeLessThan(
      nachErkunden,
    );
  });
});
