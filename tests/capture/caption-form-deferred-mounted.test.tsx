// @vitest-environment jsdom
// AUFTRAG-mega11 Block D (bens SB-4): Das Bildformular band späte KI-Antworten zu schwach.
//
// Der bestehende INLINE-Weg bindet einen Vorschlags-Request an `data-image-id` UND die
// Auswahl-Generation und prüft beides mit `captionResponseApplicable` (WP-BILD-1f, bens P1). Der in
// mega9 ergänzte FORMULAR-Weg prüfte dagegen nur, ob die Fußnote noch dieselbe ist:
//
//     () => captionFormRef.current?.caption === target
//
// Weder Generation noch Bild-Kennung noch die aktuelle DOM-Zugehörigkeit noch die Bildquelle. Eine
// späte Antwort konnte deshalb nach einem Bildtausch, einem Quellenwechsel, dem Entfernen des
// Bildblocks oder einem externen Wertwechsel noch im Formular erscheinen — und beim Speichern auf
// ein abgelöstes oder nicht mehr zum angezeigten Bild gehörendes Ziel geschrieben werden.
//
// bens Widerlegung der mega9-Begründung, und sie sitzt: der EGRESS- und ERGEBNISKERN ist geteilt,
// die GELTUNGSPRÜFUNG war es nicht.
//
// Dieser Test hält die Antwort bewusst AN und lässt sie erst los, nachdem sich das Ziel verändert
// hat — genau das Zeitfenster, das der Fehler brauchte.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SRC_A = "data:image/png;base64,AAAA";
const SRC_B = "data:image/png;base64,BBBB";

const FIG_A = `<figure><img src="${SRC_A}"><figcaption data-image-id="kw-a">Fußnote A</figcaption></figure>`;
const FIG_B = `<figure><img src="${SRC_B}"><figcaption data-image-id="kw-b">Fußnote B</figcaption></figure>`;
const DOC = `${FIG_A}${FIG_B}`;

const ANSWER_TEXT = "Dichtring am Ventil V2, sichtbar gerissen.";
const ANSWER: DescribeImageResult = { text: ANSWER_TEXT, demo: false, withContext: true };

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let describeCalls = 0;

// Die Antwort wird ANGEHALTEN: der Test entscheidet, wann sie eintrifft.
let release: (() => void) | null = null;
function deferredDescribe(): Promise<DescribeImageResult> {
  describeCalls += 1;
  return new Promise<DescribeImageResult>((resolve) => {
    release = () => resolve(ANSWER);
  });
}

// Erlaubt dem Test, den Wert von AUSSEN zu setzen (der Fall „externer Wertwechsel").
let setValueFromOutside: ((html: string) => void) | null = null;

function Host(): JSX.Element {
  const [value, setValue] = useState(DOC);
  setValueFromOutside = setValue;
  return createElement(RichTextEditor, {
    value,
    onChange: setValue,
    onDescribeImage: deferredDescribe,
  });
}

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host));
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  release = null;
  setValueFromOutside = null;
  describeCalls = 0;
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

function field(): HTMLTextAreaElement | null {
  const el = document.querySelector("#caption-form-text");
  return el instanceof HTMLTextAreaElement ? el : null;
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

function figures(): HTMLElement[] {
  return [...container.querySelectorAll("figure")];
}

// Der Nutzer klickt das Bild an (Werkzeugleiste) und öffnet die Beschreibung.
async function openFormFor(index: number): Promise<void> {
  const img = figures()[index]?.querySelector("img");
  if (!(img instanceof HTMLImageElement)) {
    throw new Error(`Bild ${index} nicht gerendert`);
  }
  await act(async () => {
    img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
  await click(byTestId("caption-form-open"));
}

async function requestSuggestion(): Promise<void> {
  await click(byTestId("caption-form-suggest"));
}

// Die angehaltene Antwort eintreffen lassen.
async function deliverAnswer(): Promise<void> {
  const go = release;
  if (!go) {
    throw new Error("Es war keine Antwort angehalten — der Request lief gar nicht");
  }
  await act(async () => {
    go();
    await flush();
  });
}

async function closeForm(): Promise<void> {
  const cancel = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === i18n.t(CAPTION_AI_TEXT.formCancel),
  );
  if (!(cancel instanceof HTMLButtonElement)) {
    throw new Error("Abbrechen-Knopf nicht gefunden");
  }
  await click(cancel);
}

function captionTextOf(index: number): string {
  return figures()[index]?.querySelector("figcaption")?.textContent ?? "";
}

describe("Block D: eine späte Antwort erscheint nur bei UNVERÄNDERTEM Ziel", () => {
  it("der gültige, unveränderte Fall geht weiterhin durch (sonst prüfte der Test nichts)", async () => {
    mount();
    await openFormFor(0);
    await requestSuggestion();
    await deliverAnswer();

    expect(describeCalls).toBe(1);
    expect(byTestId("caption-form-suggestion").textContent).toContain(ANSWER_TEXT);
  });

  it("Antwort trifft nach dem SCHLIESSEN des Formulars ein → sie erscheint nirgends", async () => {
    mount();
    await openFormFor(0);
    await requestSuggestion();
    await closeForm();

    await deliverAnswer();

    expect(field()).toBeNull();
    expect(maybeTestId("caption-form-suggestion")).toBeNull();
    // Auch nach dem Wiederöffnen desselben Bildes ist sie nicht da — der Lauf ist ein anderer.
    await openFormFor(0);
    expect(maybeTestId("caption-form-suggestion")).toBeNull();
    expect(field()?.value).toBe("Fußnote A");
  });

  it("Antwort zu Bild A trifft ein, während das Formular auf Bild B steht → sie landet NICHT bei B", async () => {
    mount();
    await openFormFor(0);
    await requestSuggestion();
    // Weiterarbeiten am zweiten Bild.
    await closeForm();
    await openFormFor(1);
    expect(field()?.value).toBe("Fußnote B");

    await deliverAnswer();

    // Das war die falsche Inhaltszuordnung: As Beschreibung im Formular von B.
    expect(maybeTestId("caption-form-suggestion")).toBeNull();
    expect(field()?.value).toBe("Fußnote B");
  });

  it("Bildquelle wechselt unter dem offenen Formular → Antwort wird verworfen, Speichern schreibt nicht", async () => {
    mount();
    await openFormFor(0);
    await requestSuggestion();

    // Dasselbe figure, dieselbe Fußnote, dieselbe Kennung — nur ein anderes BILD.
    const img = figures()[0]?.querySelector("img");
    await act(async () => {
      img?.setAttribute("src", SRC_B);
      await flush();
    });

    await deliverAnswer();
    expect(maybeTestId("caption-form-suggestion")).toBeNull();

    // Und das Speichern schreibt nicht auf ein Ziel, das nicht mehr das geöffnete ist …
    await click(byTestId("caption-form-save"));
    expect(captionTextOf(0)).toBe("Fußnote A");
    // … sondern sagt es, und behält den getippten Text.
    expect(byTestId("caption-form-stale").textContent).toBe(i18n.t(CAPTION_AI_TEXT.formStale));
    expect(field()?.value).toBe("Fußnote A");
  });

  it("Bildblock wird entfernt → Antwort wird verworfen, Speichern schreibt nicht in den abgelösten Knoten", async () => {
    mount();
    await openFormFor(0);
    await requestSuggestion();

    const removed = figures()[0];
    const caption = removed?.querySelector("figcaption") ?? null;
    await act(async () => {
      removed?.remove();
      await flush();
    });

    await deliverAnswer();
    expect(maybeTestId("caption-form-suggestion")).toBeNull();

    await click(byTestId("caption-form-save"));
    // Der abgelöste Knoten bleibt unberührt — genau hier ging der Text vorher „irgendwohin".
    expect(caption?.textContent).toBe("Fußnote A");
    expect(byTestId("caption-form-stale")).not.toBeNull();
  });

  it("externer Wertwechsel baut den Editor neu auf → die alte Antwort erscheint nicht", async () => {
    mount();
    await openFormFor(0);
    await requestSuggestion();

    // Der Elternkontext setzt einen neuen Wert (Entwurf geladen, Vorschlag übernommen, Reset).
    await act(async () => {
      setValueFromOutside?.(
        `<figure><img src="${SRC_A}"><figcaption data-image-id="kw-a">Ganz neuer Stand</figcaption></figure>`,
      );
      await flush();
    });

    await deliverAnswer();
    expect(maybeTestId("caption-form-suggestion")).toBeNull();
  });

  it("es gibt weiterhin GENAU einen describe-Aufruf je Anforderung — keine neue Egress-Kante", async () => {
    mount();
    await openFormFor(0);
    await requestSuggestion();
    await deliverAnswer();
    expect(describeCalls).toBe(1);
  });
});
