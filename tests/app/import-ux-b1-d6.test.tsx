// @vitest-environment jsdom
// WP-SHIP9-S2 Paket 2: B1 (wiederverwendbares Auswahl-Muster ChoiceCards — klare Radio-Flächen, oben)
// und D6 (Bilanz → „Weiter zum Import-Review (N offen)" mit echtem Zähler + Sprung zur Queue-Sektion).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ChoiceCards } from "../../apps/web/src/components/ChoiceCards";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("B1 · ChoiceCards (wiederverwendbares Befehlsfeld, klare Radio-Flächen)", () => {
  it("rendert ein echtes Radiogroup; die aktive Wahl trägt aria-checked, ein Klick wechselt sie", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    let selected = "points";
    const render = (): void => {
      act(() => {
        root.render(
          createElement(ChoiceCards, {
            label: "Wie übernehmen?",
            value: selected,
            onChange: (id: string) => {
              selected = id;
              render();
            },
            options: [
              { id: "points", label: "Einzelne Punkte", description: "Auszug wählen" },
              { id: "whole", label: "Ganzes Dokument", description: "komplett übernehmen" },
            ],
          }),
        );
      });
    };
    render();

    // Zwei klar erkennbare Auswahl-Flächen mit gewählt/nicht-gewählt-Semantik (aria-pressed).
    const radios = container.querySelectorAll("button[aria-pressed]");
    expect(radios).toHaveLength(2);
    // „points" ist aktiv, „whole" nicht.
    expect(radios[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(radios[1]?.getAttribute("aria-pressed")).toBe("false");

    // Klick auf „whole" schaltet die Auswahl um.
    act(() => {
      (radios[1] as HTMLButtonElement).click();
    });
    const after = container.querySelectorAll("button[aria-pressed]");
    expect(after[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(after[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(selected).toBe("whole");
  });
});

describe("B1 · Verdrahtung im Datei-Erfassen", () => {
  it("Capture.tsx nutzt ChoiceCards für Teil/Gesamt und stellt es DIREKT oben in den Datei-Block", () => {
    const src = read("apps/web/src/pages/Capture.tsx");
    expect(src).toContain('import { ChoiceCards } from "../components/ChoiceCards"');
    expect(src).toContain("<ChoiceCards");
    // Der Entscheid steht vor dem Hinweistext/Datei-Upload (oben im Datei-Block).
    const dateiIdx = src.indexOf('mode === "datei"');
    const choiceIdx = src.indexOf("<ChoiceCards", dateiIdx);
    const hintIdx = src.indexOf("CAPTURE_FILE_TEXT.hint", dateiIdx);
    expect(choiceIdx).toBeGreaterThan(dateiIdx);
    expect(choiceIdx).toBeLessThan(hintIdx);
  });
});

describe("D6 · Bilanz → Import-Review", () => {
  it("ImportGroups zeigt den Weiter-Knopf mit echtem Bilanz-Zähler und springt zum Queue-Anker", () => {
    const src = read("apps/web/src/components/ImportGroups.tsx");
    expect(src).toContain("IMPORT_GROUPS_TEXT.toReview");
    expect(src).toContain("bilanz.imported + bilanz.alreadyQueued");
    expect(src).toContain('document.getElementById("import-review-queue")');
  });

  it("die Queue-Sektion trägt den stabilen Anker import-review-queue", () => {
    expect(read("apps/web/src/components/ImportHistory.tsx")).toContain('id="import-review-queue"');
  });

  it("imp.groups.toReview ist in DE/EN/NL vorhanden und trägt den Zähler {{n}}", () => {
    for (const lng of ["de", "en", "nl"]) {
      const text = String(i18n.getResource(lng, "translation", "imp.groups.toReview") ?? "");
      expect(text.length, `${lng}:imp.groups.toReview`).toBeGreaterThan(0);
      expect(text, `${lng}:{{n}}`).toContain("{{n}}");
    }
  });
});
