// @vitest-environment jsdom
// ================================================================================================
// Aufnahme gesamt-integrations-api · R-0842 — AUCH DIE KI-BILDBESCHREIBUNG ZEIGT DEN WARTESATZ.
// ================================================================================================
//
// Bens Befund (Nacharbeit 3): `POST /api/reasoner/describe` steht unter der KI-Bremse
// (`services/app/src/ki-anfragebremse.ts`), aber das Bildbeschreibungsformular ersetzte im `catch`
// JEDEN Fehler durch `CAPTION_AI_TEXT.fallbackError` — der Satz mit Wartezeit ging verloren.
// Gefahren wird das ECHTE Formular im `RichTextEditor` über dieselbe Naht wie
// `tests/capture/caption-form-mounted.test.tsx`; der Beschreibungsaufruf scheitert mit genau dem
// Fehler, den der Web-Client aus der 429-Antwort baut (`ApiError`).
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { ApiError } from "../../apps/web/src/api/client";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";
import { beschreibungsText, mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE =
  '<figure><img src="data:image/png;base64,AAAA"><figcaption data-image-id="kw-a">Alte Beschreibung</figcaption></figure>';
const WARTESATZ =
  "Sie haben in kurzer Zeit sehr viele KI-Anfragen gestellt. Bitte warten Sie 42 Sekunden und versuchen Sie es dann erneut.";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Host({ onDescribe }: { onDescribe: () => Promise<DescribeImageResult> }) {
  const [value, setValue] = useState(FIGURE);
  return mitBildbeschreibung(
    createElement(RichTextEditor, { value, documentTitle: "Wartungsnotiz", onChange: setValue }),
    onDescribe,
  );
}

function mount(onDescribe: () => Promise<DescribeImageResult>): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, { onDescribe }));
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function byTestId(id: string): HTMLElement {
  const el = document.querySelector(`[data-testid="${id}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element [data-testid="${id}"] nicht gerendert`);
  }
  return el;
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

async function vorschlagAnfordern(): Promise<HTMLElement> {
  const img = container.querySelector("img");
  if (!(img instanceof HTMLImageElement)) {
    throw new Error("Bild nicht gerendert");
  }
  await act(async () => {
    img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
  await click(byTestId("caption-form-open"));
  await click(byTestId("caption-form-suggest"));
  return byTestId("caption-form-fallback");
}

describe("R-0842 · die KI-Bildbeschreibung bei gebremster Anfrage", () => {
  it("B1 · zeigt den Satz des Servers mit Wartezeit statt des allgemeinen Fehlerhinweises", async () => {
    await i18n.changeLanguage("de");
    mount(async () => {
      throw new ApiError(429, "KI_ANFRAGEN_GEBREMST", WARTESATZ, { wartenSek: 42 });
    });
    const hinweis = await vorschlagAnfordern();
    expect(hinweis.textContent).toBe(WARTESATZ);
    expect(hinweis.textContent).not.toBe(i18n.t(CAPTION_AI_TEXT.fallbackError));
    // Auch hier: nie eine Pseudo-Beschreibung im Feld.
    expect(beschreibungsText()).toBe("Alte Beschreibung");
  });

  it("B2 · Gegenprobe: ein anderer Serverfehler behält den allgemeinen Fehlerhinweis", async () => {
    await i18n.changeLanguage("de");
    mount(async () => {
      throw new ApiError(500, "INTERNAL", "Unerwarteter Fehler.");
    });
    const hinweis = await vorschlagAnfordern();
    expect(hinweis.textContent).toBe(i18n.t(CAPTION_AI_TEXT.fallbackError));
  });
});
