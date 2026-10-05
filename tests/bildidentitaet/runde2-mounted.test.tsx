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

describe("Runde 3 · N1/N2 in der Gegenrichtung: die Galerie-Bitte öffnet kein anderes Bild", () => {
  const paar = (id: string, text: string): string =>
    `<figure data-image-id="${id}"><img src="${A}" data-image-id="${id}"><figcaption data-image-id="${id}">${text}</figcaption></figure>`;

  function loescheErstesBild(): void {
    const flaeche = behaelter?.querySelector<HTMLElement>('div.prose-kw[role="textbox"]');
    act(() => {
      flaeche?.querySelector("figure")?.remove();
      flaeche?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("N1 · Bitte für das GELÖSCHTE Bild (Galerie noch auf dem alten Stand): es öffnet sich nichts", () => {
    const start = `${paar("a", "Erste")}<p>x</p>${paar("b", "Zweite")}`;
    montiere(start);
    loescheErstesBild();
    bitte(start, { imageId: "a", src: A, index: 0, nonce: 1 });
    expect(beschreibungsfeldOffen(), "das verbliebene Bild wurde als das gelöschte geöffnet").toBe(
      false,
    );
  });

  it("N1 Grenze · Bitte für das verbliebene Bild über die ALTE Position: es öffnet sich nichts", () => {
    // Aus dem Galeriekörper allein ist diese Lage nicht von N1b zu unterscheiden (die Kennung steht
    // dort jetzt an einer anderen Stelle). Es wird nicht geraten; nach Ablauf der Galerieverzögerung
    // stimmt die Position wieder, und dieselbe Bitte öffnet „Zweite“ (nächster Fall).
    const start = `${paar("a", "Erste")}<p>x</p>${paar("b", "Zweite")}`;
    montiere(start);
    loescheErstesBild();
    bitte(start, { imageId: "b", src: A, index: 1, nonce: 2 });
    expect(beschreibungsfeldOffen()).toBe(false);
  });

  it("N1 · nach dem Nachziehen der Galerie (neue Position 0) öffnet die Bitte „Zweite“", () => {
    const start = `${paar("a", "Erste")}<p>x</p>${paar("b", "Zweite")}`;
    montiere(start);
    loescheErstesBild();
    bitte(start, { imageId: "b", src: A, index: 0, nonce: 3 });
    expect(beschreibungsfeldOffen()).toBe(true);
    expect(beschreibungsText()).toBe("Zweite");
  });

  it("N1b · Doppelkennung, das ZWEITE gelöscht: die Bitte dafür öffnet nicht das erste", () => {
    montiere(G5.replace(`<p><img src="${A}"></p>`, ""));
    const flaeche = behaelter?.querySelector<HTMLElement>('div.prose-kw[role="textbox"]');
    act(() => {
      const figuren = flaeche?.querySelectorAll("figure");
      figuren?.[figuren.length - 1]?.remove();
      flaeche?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    bitte(G5.replace(`<p><img src="${A}"></p>`, ""), {
      imageId: "kw-dup",
      src: A,
      index: 1,
      nonce: 5,
    });
    expect(
      beschreibungsfeldOffen(),
      "das verbliebene erste Bild wurde als das gelöschte geöffnet",
    ).toBe(false);
  });

  it("N2 · ein Bild in einer losen Fußnote verschiebt die Auswahl nicht", () => {
    const start = `<figcaption><img src="${A}" alt="in der Fußnote"></figcaption>${einheit("Erste")}<p>x</p>${einheit("Zweite")}`;
    montiere(start);
    bitte(start, { imageId: "kw-dup", src: A, index: 0, nonce: 3 });
    expect(beschreibungsText()).toBe("Erste");
    bitte(start, { imageId: "kw-dup", src: A, index: 1, nonce: 4 });
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
    expect(hinweis?.textContent ?? "").toMatch(
      /Bei 1 Bild oder Bildbeschreibung war die Kennung ungültig/,
    );
    const zu = hinweis?.querySelector("button");
    act(() => zu?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(behaelter?.querySelector('[data-testid="editor-kennung-ungueltig"]')).toBeNull();
  });

  it("N3 (Runde 3) · Rahmen, Bild und Fußnote EINES Bildes mit ungültiger Kennung → der Hinweis nennt 1", () => {
    montiere(
      serverSanitize(
        `<figure data-image-id="a b"><img src="${A}" data-image-id="a b"><figcaption data-image-id="a b">Text</figcaption></figure>`,
      ),
    );
    const hinweis = behaelter?.querySelector('[data-testid="editor-kennung-ungueltig"]');
    expect(hinweis?.getAttribute("data-anzahl"), "ein Bild wurde mehrfach gezählt").toBe("1");
    expect(hinweis?.textContent ?? "").toMatch(/Bei 1 Bild oder Bildbeschreibung/);
  });

  it("N3 Kalibrierung · zwei Bilder mit ungültiger Kennung → der Hinweis nennt 2", () => {
    const einheitUngueltig = `<figure data-image-id="a b"><img src="${A}" data-image-id="a b"><figcaption data-image-id="a b">Text</figcaption></figure>`;
    montiere(serverSanitize(einheitUngueltig + einheitUngueltig));
    const hinweis = behaelter?.querySelector('[data-testid="editor-kennung-ungueltig"]');
    expect(hinweis?.getAttribute("data-anzahl")).toBe("2");
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
