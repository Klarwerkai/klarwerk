// @vitest-environment jsdom
// WP-BILD-1f (bens P1, PFLICHT-Test): der KI-Beschreibungs-Vorschlag ist FEST an seine
// Ausgangs-Fußnote gebunden. Deferred-Promise-Szenario A → B: der Nutzer startet den Vorschlag in
// Fußnote A, wechselt WÄHREND des laufenden Requests zu Fußnote B — As späte Antwort darf weder
// das Panel noch den Inhalt von B verändern (still verworfen). Gegenprobe: bleibt der Nutzer auf A,
// erscheint der Vorschlag und die Übernahme trifft exakt A. Echter React-Mount (Muster WP-D8b:
// react-dom/client + act aus apps/web/node_modules, createElement statt JSX).
//
// AUFTRAG-mega84 Block A: DER WEG ZUM VORSCHLAG HAT SICH GEÄNDERT, DIE ZUSAGE NICHT. Bis mega82
// klickte man IN die Fußnote (Editing-Host) und bekam eine Vorschlagsleiste am oberen Editorrand;
// seit mega84 öffnet derselbe Klick das Formular, und der Vorschlag lebt darin. Der Fußnoten-Wechsel
// mitten im Request ist damit ein Formular-Wechsel — der Fall, den dieser Test beschreibt, ist
// unverändert erreichbar und bleibt gepinnt. Verschoben hat sich nur, WO der Nutzer klickt.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (Default-Sprache de).
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { mitBildbeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Zwei Bild-Fußnoten A und B mit data:-Bildern (kein fetch nötig — der data:-Pfad ist synchron).
const TWO_FIGURES =
  '<figure><img src="data:image/png;base64,AAAA"><figcaption data-image-id="kw-a">A</figcaption></figure>' +
  '<figure><img src="data:image/png;base64,BBBB"><figcaption data-image-id="kw-b">B</figcaption></figure>';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

interface Deferred {
  promise: Promise<DescribeImageResult>;
  resolve: (r: DescribeImageResult) => void;
}

function deferred(): Deferred {
  let resolve!: (r: DescribeImageResult) => void;
  const promise = new Promise<DescribeImageResult>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function Host({ onDescribe }: { onDescribe: () => Promise<DescribeImageResult> }) {
  const [value, setValue] = useState(TWO_FIGURES);
  return mitBildbeschreibung(
    createElement(RichTextEditor, { value, onChange: setValue, documentTitle: "Wartungsnotiz" }),
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

function caption(imageId: string): HTMLElement {
  const cap = container.querySelector(`figcaption[data-image-id="${imageId}"]`);
  if (!(cap instanceof HTMLElement)) {
    throw new Error(`figcaption ${imageId} nicht gerendert`);
  }
  return cap;
}

// AUFTRAG-mega84 Block A: der Klick auf die Fußnote öffnet das Formular für genau dieses Bild.
function clickInto(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

// Der Vorschlags-Knopf des Formulars — seit mega84 der einzige, den es überhaupt noch gibt.
function suggestButton(): HTMLButtonElement {
  const btn = container.querySelector('[data-testid="caption-form-suggest"]');
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error("Vorschlags-Knopf nicht gerendert");
  }
  return btn;
}

function knopf(testid: string): HTMLButtonElement {
  const btn = container.querySelector(`[data-testid="${testid}"]`);
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf ${testid} nicht gerendert`);
  }
  return btn;
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("WP-BILD-1f P1: Vorschlag ist an die Ausgangs-Fußnote gebunden (Deferred A → B)", () => {
  it("A→B-Wechsel während des Requests: As späte Antwort verändert weder Panel noch Inhalt von B", async () => {
    const d = deferred();
    mount(() => d.promise);

    // Auf Fußnote A klicken → das Formular für A öffnet → Vorschlag anfordern (hängt am Deferred).
    clickInto(caption("kw-a"));
    await act(async () => {
      suggestButton().click();
    });

    // WÄHREND des laufenden Requests auf Fußnote B wechseln (das Formular zeigt jetzt B).
    clickInto(caption("kw-b"));

    // JETZT erst antwortet das Modell — die Antwort gehört zu A, das Ziel hat gewechselt.
    await act(async () => {
      d.resolve({ text: "Eine Kreiselpumpe auf dem Prüfstand.", demo: false });
      await Promise.resolve();
    });

    // Still verworfen: kein Panel mit dem Vorschlagstext, beide Fußnoten-Inhalte unverändert.
    expect(container.textContent ?? "").not.toContain("Eine Kreiselpumpe");
    expect(caption("kw-a").textContent).toBe("A");
    expect(caption("kw-b").textContent).toBe("B");
  });

  it("GEGENPROBE: ohne Wechsel erscheint der Vorschlag, und Übernehmen setzt exakt Fußnote A", async () => {
    const d = deferred();
    mount(() => d.promise);

    clickInto(caption("kw-a"));
    await act(async () => {
      suggestButton().click();
    });
    await act(async () => {
      d.resolve({ text: "Eine Kreiselpumpe auf dem Prüfstand.", demo: false });
      await Promise.resolve();
    });

    // Das Formular zeigt den Vorschlag (Ziel unverändert).
    expect(container.textContent ?? "").toContain("Eine Kreiselpumpe auf dem Prüfstand.");

    // Übernehmen setzt ihn ins FELD — nicht in die Fußnote. Erst Speichern schreibt.
    act(() => {
      knopf("caption-form-adopt").click();
    });
    expect(caption("kw-a").textContent).toBe("A");
    act(() => {
      knopf("caption-form-save").click();
    });

    // Jetzt trifft er exakt A — und B bleibt unberührt.
    expect(caption("kw-a").textContent).toBe("Eine Kreiselpumpe auf dem Prüfstand.");
    expect(caption("kw-b").textContent).toBe("B");
  });
});
