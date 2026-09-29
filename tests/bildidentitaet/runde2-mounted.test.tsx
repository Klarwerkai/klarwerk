// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · Runde 2 — am gemounteten Editor:
//   · B1 in der Gegenrichtung: die Bitte der Galerie („Bildbeschreibung bearbeiten") trifft das
//     gewählte Vorkommen, auch wenn ein loses Bild davor die Zählung verschiebt.
//   · B4 / R-0090: die Spur des Servers wird beim Öffnen SICHTBAR gemeldet.
// Aufbau wie `tests/capture/editor-figure-caption-globale-suche-mounted.test.tsx`.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { sanitizeHtml as serverSanitize } from "../../services/structure/src/sanitize";
import {
  beschreibungsText,
  beschreibungsfeldOffen,
  mitBildbeschreibung,
} from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const A = "/api/objects/gleich/raw";

const einheit = (text: string): string =>
  `<figure data-image-id="kw-dup"><img src="${A}" data-image-id="kw-dup"><figcaption data-image-id="kw-dup">${text}</figcaption></figure>`;

/** Bens G5: ein loses Bild vor zwei Einheiten mit gleicher Quelle und gleicher Kennung. */
const G5 = `<p><img src="${A}"></p>${einheit("Erste")}<p>x</p>${einheit("Zweite")}`;

interface Bitte {
  imageId: string;
  src: string;
  index: number;
  nonce: number;
}

let behaelter: HTMLDivElement | null = null;
let wurzel: ReturnType<typeof createRoot> | null = null;

function Host({ start, anfrage }: { start: string; anfrage?: Bitte | undefined }) {
  const [wert, setWert] = useState(start);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value: wert,
      documentTitle: "Runde 2",
      onChange: (html: string) => setWert(html),
      ...(anfrage ? { captionFormRequest: anfrage } : {}),
    }),
  );
}

function montiere(start: string): void {
  behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  wurzel = createRoot(behaelter);
  act(() => {
    wurzel?.render(createElement(Host, { start }));
  });
}

function bitte(start: string, anfrage: Bitte): void {
  act(() => {
    wurzel?.render(createElement(Host, { start, anfrage }));
  });
}

afterEach(() => {
  act(() => {
    wurzel?.unmount();
  });
  behaelter?.remove();
  behaelter = null;
  wurzel = null;
});

describe("B1 Gegenrichtung · die Galerie-Bitte trifft das gewählte Vorkommen", () => {
  // Die Galerie des unveränderten Körpers zeigt ZWEI Einträge (das lose Bild zählt dort nicht):
  // Eintrag 0 = „Erste", Eintrag 1 = „Zweite". Der Editor zählt DREI Bilder.
  it("Eintrag 0 öffnet das Formular mit „Erste“", () => {
    montiere(G5);
    bitte(G5, { imageId: "kw-dup", src: A, index: 0, nonce: 1 });
    expect(beschreibungsfeldOffen()).toBe(true);
    expect(beschreibungsText()).toBe("Erste");
  });

  it("Eintrag 1 öffnet das Formular mit „Zweite“", () => {
    montiere(G5);
    bitte(G5, { imageId: "kw-dup", src: A, index: 1, nonce: 2 });
    expect(beschreibungsfeldOffen()).toBe(true);
    expect(beschreibungsText()).toBe("Zweite");
  });
});

describe("B4 · R-0090: die Bereinigung beim Speichern wird beim Öffnen gemeldet", () => {
  it("vom Server getrennte Doppelung → Trennungshinweis", () => {
    montiere(serverSanitize(einheit("Erste") + einheit("Zweite")));
    const hinweis = behaelter?.querySelector('[data-testid="editor-kennung-getrennt"]');
    expect(hinweis, "kein Hinweis auf die Trennung").not.toBeNull();
    expect(hinweis?.getAttribute("data-anzahl")).toBe("1");
    expect(hinweis?.getAttribute("aria-live")).toBe("polite");
  });

  it("verworfene ungültige Kennung → eigener Hinweis, wegklickbar", () => {
    montiere(serverSanitize(`<figure><img src="${A}" data-image-id="a b"></figure>`));
    const hinweis = behaelter?.querySelector('[data-testid="editor-kennung-ungueltig"]');
    expect(hinweis, "kein Hinweis auf die ungültige Kennung").not.toBeNull();
    expect(hinweis?.getAttribute("data-anzahl")).toBe("1");
    expect(hinweis?.textContent ?? "").toMatch(/ungültige Kennung/);
    const zu = hinweis?.querySelector("button");
    act(() => zu?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(behaelter?.querySelector('[data-testid="editor-kennung-ungueltig"]')).toBeNull();
  });

  it("Gegenprobe: ein sauberer Text zeigt keinen der beiden Hinweise", () => {
    montiere(serverSanitize(einheit("Erste")));
    expect(behaelter?.querySelector('[data-testid="editor-kennung-getrennt"]')).toBeNull();
    expect(behaelter?.querySelector('[data-testid="editor-kennung-ungueltig"]')).toBeNull();
  });

  it("die Spur steht nach dem Öffnen nicht mehr im Editorinhalt — gespeichert wird ohne sie", () => {
    montiere(serverSanitize(einheit("Erste") + einheit("Zweite")));
    const flaeche = behaelter?.querySelector('div.prose-kw[role="textbox"]');
    expect(flaeche?.innerHTML ?? "").not.toContain("data-kw-kennung");
  });
});
