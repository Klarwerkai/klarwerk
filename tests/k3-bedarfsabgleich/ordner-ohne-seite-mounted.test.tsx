// @vitest-environment jsdom
// ================================================================================================
// R-0991 (K3) · WIRKUNGSTEST DES EINZIGEN A-FALLS: DER ORDNER, DESSEN SEITE NICHT MITKOMMT.
// ================================================================================================
//
// Der heutige Bedarfsabgleich der 82 Kandidaten (`bedarfsabgleich.ts` daneben) ergibt genau einen
// noch offenen Fall A: `lib/importSelectView.ts::ordnerOhneEigeneZeile`. Die Vorschau zeigte jeden
// Elterntitel aus `sourcePath` als Ordner — auch dann, wenn die Elternseite selbst gar nicht in der
// Vorschau liegt. Ein Mensch hielt den Ordnernamen dann für eine mitimportierte Seite (JOB 931 `B2`,
// JOB 1132). Jetzt trägt genau ein solcher Ordner die Marke „Seite nicht in diesem Import".
//
// GEMOUNTET wird die echte `ImportSelect`-Fläche; ersetzt ist allein das `endpoints`-Modul (Hausform
// von `tests/import-freitext-titel/auswahl-sagt-was-die-ki-verstand.test.tsx`). Gemessen wird, was
// ein Mensch sieht: die Marke am betroffenen Ordnerkopf, KEINE Marke am Ordner, dessen Seite in der
// Vorschau liegt, und keine an der Wurzel (dem Quell-Container).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: { import: { select: vi.fn(), group: vi.fn(), apply: vi.fn() } },
    reasoner: { status: vi.fn().mockResolvedValue({ active: false, mode: "deterministic" }) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ImportSelect } from "../../apps/web/src/components/ImportSelect";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const selectMock = endpoints.admin.import.select as unknown as ReturnType<typeof vi.fn>;

// Quell-Container „Technik". „Wartung" hängt unter „Anlagen" — eine Seite „Anlagen" gibt es in
// dieser Vorschau NICHT. „Kapitel 1" hängt unter „Handbuch" — die Seite „Handbuch" liegt selbst in
// der Vorschau. Drei Ordnerknoten (Wurzel + zwei) → der Ordnermodus ist die Vorgabe.
const VORSCHAU = {
  matched: 3,
  limited: false,
  truncated: false,
  criteria: {},
  preview: [
    {
      id: "p1",
      title: "Wartung",
      sourceScope: "Technik",
      sourcePath: ["Anlagen"],
      hasImage: false,
      themes: [],
    },
    {
      id: "p2",
      title: "Kapitel 1",
      sourceScope: "Technik",
      sourcePath: ["Handbuch"],
      hasImage: false,
      themes: [],
    },
    {
      id: "p3",
      title: "Handbuch",
      sourceScope: "Technik",
      sourcePath: [],
      hasImage: false,
      themes: [],
    },
  ],
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ImportSelect, { chip: { themes: [], authors: [], spaces: [] } }),
      ),
    );
  });
}

afterEach(async () => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

async function vorschauAnfordern(): Promise<void> {
  const feld = [...container.querySelectorAll("input")].find(
    (el) => el.getAttribute("placeholder") === i18n.t("imp.select.promptPlaceholder"),
  );
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Freitext-Feld nicht gefunden");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(feld, "Technik");
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(i18n.t("imp.select.previewCta")),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Vorschau-Knopf fehlt: ${container.textContent?.slice(0, 300)}`);
  }
  await act(async () => {
    knopf.click();
  });
  await act(async () => {
    await new Promise((fertig) => setTimeout(fertig, 0));
  });
}

/** Der Ordnerkopf mit dieser Beschriftung (Checkbox-Name = sichtbarer Ordnername). */
function ordnerkopf(name: string): HTMLElement {
  const box = [...container.querySelectorAll("details > summary input[type=checkbox]")].find(
    (el) => el.getAttribute("aria-label") === name,
  );
  const kopf = box?.closest("summary");
  if (!(kopf instanceof HTMLElement)) {
    throw new Error(`Ordner „${name}“ fehlt im Baum: ${container.textContent?.slice(0, 400)}`);
  }
  return kopf;
}

const marke = (kopf: HTMLElement): HTMLElement | null =>
  kopf.querySelector<HTMLElement>('[data-testid="ordner-ohne-seite"]');

describe("R-0991 (K3) · Importvorschau kennzeichnet Ordner ohne eigene Seite", () => {
  it("DE: nur der Ordner ohne Elternseite trägt die Marke samt Erklärung", async () => {
    selectMock.mockResolvedValue(VORSCHAU);
    mount();
    await vorschauAnfordern();

    const anlagen = marke(ordnerkopf("Anlagen"));
    expect(anlagen, "Ordner „Anlagen“ ohne Marke").not.toBeNull();
    expect(anlagen?.textContent).toBe("Seite nicht in diesem Import");
    expect(anlagen?.getAttribute("title")).toBe(i18n.t("importordner.ohneSeiteHinweis"));

    // Gegenproben: die Seite „Handbuch" liegt in der Vorschau, die Wurzel ist der Quell-Container.
    expect(marke(ordnerkopf("Handbuch")), "Ordner „Handbuch“ trägt eine Marke").toBeNull();
    expect(marke(ordnerkopf("Technik")), "die Wurzel trägt eine Marke").toBeNull();
    expect(container.querySelectorAll('[data-testid="ordner-ohne-seite"]')).toHaveLength(1);

    // Die Auswahl selbst bleibt unberührt: die Seite unter dem markierten Ordner ist wählbar da.
    expect(container.textContent).toContain("Wartung");
  });

  for (const [sprache, soll] of [
    ["en", "Page not in this import"],
    ["nl", "Pagina niet in deze import"],
  ] as const) {
    it(`${sprache.toUpperCase()}: dieselbe Marke in der Sprache der Oberfläche`, async () => {
      await act(async () => {
        await i18n.changeLanguage(sprache);
      });
      selectMock.mockResolvedValue(VORSCHAU);
      mount();
      await vorschauAnfordern();
      expect(marke(ordnerkopf("Anlagen"))?.textContent).toBe(soll);
      expect(container.querySelectorAll('[data-testid="ordner-ohne-seite"]')).toHaveLength(1);
    });
  }
});
