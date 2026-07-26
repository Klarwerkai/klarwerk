// @vitest-environment jsdom
// AUFTRAG-mega9 Block F (Pedi, wörtlich): „Wenn ich die Bildbeschreibung eingebe, ist es immer noch
// kein richtiges Eingabeformular mit einem KI-generierten Vorschlag, den ich einfügen kann."
//
// Der Ist-Zustand war Inline-Editieren: in die figcaption HINEINKLICKEN, dann erschien ein kleiner
// Knopf und ein schwebendes Panel. Die Mechanik darunter (captionAiSuggest) war ordentlich gebaut —
// die Oberfläche davor war keine. Dieser Test fährt das ECHTE Formular:
//   sichtbare Aktion am Bild → Bild + beschriftetes Feld mit sichtbarem Maximum → Vorschlag
//   erzeugen → abgesetzter, als KI gekennzeichneter Block → Übernehmen ins Feld → Speichern.
//
// Ausdrücklich mitgeprüft: jeder der vier Fallback-Gründe wird WÖRTLICH gezeigt und NIE als
// Beschreibung ins Feld geschrieben, Abbrechen verwirft wirklich, und das Maximum greift.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT, MAX_CAPTION_TEXT_CHARS } from "../../apps/web/src/lib/captionAiSuggest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE =
  '<figure><img src="data:image/png;base64,AAAA"><figcaption data-image-id="kw-a">Alte Beschreibung</figcaption></figure>';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let lastHtml = "";

function Host({ onDescribe }: { onDescribe: () => Promise<DescribeImageResult> }) {
  const [value, setValue] = useState(FIGURE);
  lastHtml = value;
  return createElement(RichTextEditor, {
    value,
    onChange: (html: string) => {
      lastHtml = html;
      setValue(html);
    },
    onDescribeImage: onDescribe,
  });
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

function byTestId<T extends HTMLElement>(id: string): T {
  const el = document.querySelector(`[data-testid="${id}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element [data-testid="${id}"] nicht gerendert`);
  }
  return el as T;
}

function maybeTestId(id: string): HTMLElement | null {
  const el = document.querySelector(`[data-testid="${id}"]`);
  return el instanceof HTMLElement ? el : null;
}

function field(): HTMLTextAreaElement {
  const el = document.querySelector("#caption-form-text");
  if (!(el instanceof HTMLTextAreaElement)) {
    throw new Error("Beschreibungsfeld nicht gerendert");
  }
  return el;
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

// Der Nutzer klickt das BILD an — dadurch erscheint die Bild-Werkzeugleiste mit der sichtbaren Aktion.
async function openForm(): Promise<void> {
  const img = container.querySelector("img");
  if (!(img instanceof HTMLImageElement)) {
    throw new Error("Bild nicht gerendert");
  }
  await act(async () => {
    img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
  await click(byTestId("caption-form-open"));
}

async function type(value: string): Promise<void> {
  const el = field();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

const SUGGESTION: DescribeImageResult = {
  text: "Dichtring am Ventil V2, sichtbar gerissen.",
  demo: false,
  withContext: true,
};

function fallback(reason: string): DescribeImageResult {
  return { text: null, demo: true, fallbackReason: reason } as DescribeImageResult;
}

describe("AUFTRAG-mega9 Block F: die Bildbeschreibung ist ein echtes Eingabeformular", () => {
  it("öffnet über die sichtbare Aktion am Bild — mit Bild, beschriftetem Feld und sichtbarem Maximum", async () => {
    mount(async () => SUGGESTION);
    await openForm();

    // Das Formular ist da und trägt einen Namen.
    expect(document.body.textContent).toContain(i18n.t(CAPTION_AI_TEXT.formTitle));
    // Das Bild ist zu sehen …
    const img = document.querySelector(`img[alt="${i18n.t(CAPTION_AI_TEXT.formImageAlt)}"]`);
    expect(img).not.toBeNull();
    // … das Feld ist BESCHRIFTET (echtes <label for>) …
    const label = document.querySelector('label[for="caption-form-text"]');
    expect(label?.textContent).toBe(i18n.t(CAPTION_AI_TEXT.formLabel));
    // … trägt den bestehenden Fußnotentext als Ausgangswert …
    expect(field().value).toBe("Alte Beschreibung");
    // … und das Maximum steht SICHTBAR am Feld (nicht nur als stilles maxLength).
    expect(field().maxLength).toBe(MAX_CAPTION_TEXT_CHARS);
    expect(document.body.textContent).toContain(String(MAX_CAPTION_TEXT_CHARS));
  });

  it("Vorschlag erscheint als ABGESETZTER, gekennzeichneter Block und wird per Übernehmen ins Feld gesetzt", async () => {
    mount(async () => SUGGESTION);
    await openForm();

    // Vor dem Klick gibt es keinen Vorschlag — und nichts wurde automatisch erzeugt.
    expect(maybeTestId("caption-form-suggestion")).toBeNull();

    await click(byTestId("caption-form-suggest"));

    const block = byTestId("caption-form-suggestion");
    // Als KI-Vorschlag GEKENNZEICHNET und nicht mit der Nutzereingabe vermischt.
    expect(block.textContent).toContain(i18n.t(CAPTION_AI_TEXT.aiBadge));
    expect(block.textContent).toContain(SUGGESTION.text);
    // Das Feld trägt weiterhin den EIGENEN Text — der Vorschlag wird nie automatisch übernommen.
    expect(field().value).toBe("Alte Beschreibung");

    await click(byTestId("caption-form-adopt"));
    expect(field().value).toBe(SUGGESTION.text);
  });

  it("'Anhängen' gibt es nur, wenn schon Text im Feld steht — sonst wäre es dieselbe Wirkung", async () => {
    mount(async () => SUGGESTION);
    await openForm();
    await click(byTestId("caption-form-suggest"));

    // Feld hat Inhalt → beide Wege sind sinnvoll unterscheidbar.
    expect(maybeTestId("caption-form-append")).not.toBeNull();
    await click(byTestId("caption-form-append"));
    expect(field().value).toBe(`Alte Beschreibung ${SUGGESTION.text}`);

    // Feld geleert → „Anhängen" verschwindet (keine Scheinwahl mit identischer Wirkung).
    await type("");
    expect(maybeTestId("caption-form-append")).toBeNull();
  });

  it("Speichern schreibt in die Fußnote, Abbrechen nicht", async () => {
    mount(async () => SUGGESTION);
    await openForm();
    await type("Handgeschriebene Beschreibung");
    await click(byTestId("caption-form-save"));

    // Über die NORMALE Editier-Mechanik (textContent + emit) — der Body ist fortgeschrieben.
    expect(lastHtml).toContain("Handgeschriebene Beschreibung");
    expect(lastHtml).not.toContain("Alte Beschreibung");
    // Und das Formular ist zu.
    expect(document.querySelector("#caption-form-text")).toBeNull();

    // Zweiter Durchgang: tippen, dann ABBRECHEN → nichts davon landet im Dokument.
    const htmlBeforeCancel = lastHtml;
    await openForm();
    await type("Diese Fassung wird verworfen");
    const cancelBtn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === i18n.t(CAPTION_AI_TEXT.formCancel),
    );
    if (!(cancelBtn instanceof HTMLButtonElement)) {
      throw new Error("Abbrechen-Knopf nicht gerendert");
    }
    await click(cancelBtn);
    expect(lastHtml).toBe(htmlBeforeCancel);
    expect(lastHtml).not.toContain("Diese Fassung wird verworfen");
  });

  it("jeder der vier Fallback-Gründe wird wörtlich gezeigt und NIE als Beschreibung ins Feld geschrieben", async () => {
    const cases: Array<{ reason: string; key: string }> = [
      { reason: "no-model", key: CAPTION_AI_TEXT.fallbackNoModel },
      { reason: "model-timeout", key: CAPTION_AI_TEXT.fallbackTimeout },
      { reason: "confidential", key: CAPTION_AI_TEXT.fallbackConfidential },
      { reason: "model-error", key: CAPTION_AI_TEXT.fallbackError },
    ];

    for (const c of cases) {
      mount(async () => fallback(c.reason));
      await openForm();
      await click(byTestId("caption-form-suggest"));

      const note = byTestId("caption-form-fallback");
      // Der WAHRE Grund steht wörtlich da …
      expect(note.textContent, c.reason).toBe(i18n.t(c.key));
      // … es gibt KEINEN Vorschlagsblock und damit auch nichts zu übernehmen …
      expect(maybeTestId("caption-form-suggestion"), c.reason).toBeNull();
      expect(maybeTestId("caption-form-adopt"), c.reason).toBeNull();
      // … und das Feld ist unberührt: NIEMALS eine Pseudo-Beschreibung.
      expect(field().value, c.reason).toBe("Alte Beschreibung");

      act(() => root.unmount());
      container.remove();
    }
    // Für das afterEach dieser Datei wieder einen Mount bereitstellen.
    mount(async () => SUGGESTION);
  });

  it("das Zeichen-Maximum greift auch beim Übernehmen eines langen Vorschlags", async () => {
    const long = "x".repeat(MAX_CAPTION_TEXT_CHARS + 120);
    mount(async () => ({ text: long, demo: false, withContext: false }) as DescribeImageResult);
    await openForm();
    await click(byTestId("caption-form-suggest"));
    await click(byTestId("caption-form-adopt"));

    // Kein stilles Überlaufen über die sichtbar ausgewiesene Grenze.
    expect(field().value.length).toBe(MAX_CAPTION_TEXT_CHARS);
    // Und die Grenze wird am Feld ausdrücklich als erreicht benannt.
    expect(document.body.textContent).toContain(
      i18n.t(CAPTION_AI_TEXT.formLimitReached, { max: MAX_CAPTION_TEXT_CHARS }),
    );
  });
});
