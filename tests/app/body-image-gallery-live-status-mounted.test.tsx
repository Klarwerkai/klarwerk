// @vitest-environment jsdom
// JOB 1117 D1 — DIE BILDGALERIE MELDET ÖFFNEN, BILDWECHSEL UND SCHLIESSEN.
//
// Vorgeschichte (belegt): RUECKGABE-PRO4-JOB-908-D1, Befund L4 — „Keine der vier Modalflächen trägt
// einen Ansagebereich, und keine Zusicherung verlangt einen. Öffnen, Schliessen, Filterergebnis,
// Bildwechsel in der Galerie — nichts davon wird angesagt." BEN5-PRUEFUNG-JOB-908-D1, Prüflücke 2
// verlangt genau diese Klammer: „Mounted-Test je Modalfläche: Öffnen/Schließen/Statusänderung
// erzeugt nicht-leeren `aria-live`-Text; erwartet: definierter Ansagetext im DOM, aber keine
// Behauptung echter Ausgabe."
//
// EHRLICHE GRENZE DIESER KLAMMER (wortgleich zur Vorquelle, F3): belegt ist die EXISTENZ und der
// INHALT des Bereichs — NICHT, dass er von einer Sprachausgabe vorgelesen wird. Kein Test hier
// behauptet echte Ausgabe; jsdom hat keine Sprachausgabe und keinen Top-Layer.
//
// Gemessen wird am ECHTEN Produktpfad (gemountete Komponente, echte Klicks, echte Tasten,
// echtes cancel/close-Ereignispaar des Dialogs) — keine Quelltextkopie, kein Regex auf der Datei.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { BodyImageGallery } from "../../apps/web/src/components/BodyImageGallery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom-Polyfill für <dialog> (Muster body-image-gallery-mounted / gallery-lightbox-focus-mounted):
// nur open/close + close-Ereignis. Escape läuft im Browser nativ als cancel — hier dispatched.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};
Object.defineProperty(HTMLDialogElement.prototype, "open", {
  configurable: true,
  get(this: HTMLDialogElement) {
    return this.hasAttribute("open");
  },
});

const figure = (id: string, caption: string): string =>
  `<figure><img data-image-id="${id}" src="data:image/png;base64,QQ=="><figcaption data-image-id="${id}">${caption}</figcaption></figure>`;

// Drei Bilder MIT Fußnote — der Normalfall für Öffnen/Vor/Zurück/Schließen.
const DREI = `${figure("kw-a", "Eins")}${figure("kw-b", "Zwei")}${figure("kw-c", "Drei")}`;
// Zwei Bilder OHNE jede Fußnote — der Fall „keine Beschreibung erfinden".
const ZWEI_OHNE = `${figure("kw-a", "")}${figure("kw-b", "")}`;
// Erstes Bild beschrieben, zweites nicht — deckt das Weiterschleppen einer alten Beschreibung ab.
const GEMISCHT = `${figure("kw-a", "Ventil V2")}${figure("kw-b", "")}`;
// WP-D10-Altlast: exakt einer der zentralen Platzhaltertexte gilt als KEINE Beschreibung.
const PLATZHALTER = `${figure("kw-a", "Noch keine Bildbeschreibung")}${figure("kw-b", "")}`;

// Die erwarteten Textbausteine stammen aus den BESTEHENDEN i18n-Schlüsseln (de ist Vorgabesprache):
// ko.gallery = „Bildergalerie", ko.galleryCount = „Bild {{n}} von {{m}}", ko.galleryClose = „Schließen".
const FLAECHE = "Bildergalerie";
const SCHLIESSEN = "Schließen";
const ort = (n: number, m: number): string => `Bild ${n} von ${m}`;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(bodyHtml: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(BodyImageGallery, { bodyHtml }));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

// Alle Ansagebereiche der Fläche — bewusst über das ARIA-Merkmal gesucht, nicht über eine Testmarke:
// gemessen wird der Vertrag „es gibt einen höflichen Live-Bereich", nicht ein internes Attribut.
function bereiche(): HTMLElement[] {
  return [...container.querySelectorAll("[aria-live]")].filter(
    (e): e is HTMLElement => e instanceof HTMLElement,
  );
}

function texte(): string[] {
  return bereiche().map((e) => (e.textContent ?? "").trim());
}

// Der EINE gerade sprechende Bereich. Genau einer darf nichtleer sein — zwei gefüllte Bereiche
// wären eine Doppelansage.
function ansage(): string {
  const gefuellt = texte().filter((s) => s.length > 0);
  if (gefuellt.length > 1) {
    throw new Error(`Mehr als ein nichtleerer Ansagebereich: ${JSON.stringify(gefuellt)}`);
  }
  return gefuellt[0] ?? "";
}

function dialog(): HTMLDialogElement | null {
  const d = container.querySelector("dialog");
  return d instanceof HTMLDialogElement ? d : null;
}

function knopf(labelTeil: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("dialog button")].find((b) =>
    (b.getAttribute("aria-label") ?? "").toLowerCase().includes(labelTeil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf ${labelTeil} nicht gefunden`);
  }
  return btn;
}

function oeffne(index: number): void {
  const thumbs = container.querySelectorAll("div.grid button");
  const thumb = thumbs[index];
  if (!(thumb instanceof HTMLButtonElement)) {
    throw new Error(`Thumbnail ${index} nicht gefunden`);
  }
  act(() => {
    thumb.click();
  });
}

function klick(btn: HTMLButtonElement): void {
  act(() => {
    btn.click();
  });
}

describe("JOB 1117 · Ansagebereich der Bildgalerie (DOM-Ereignisvertrag, keine Ausgabebehauptung)", () => {
  it("V1: der Ansagebereich existiert schon VOR dem Öffnen und ist leer", () => {
    mount(DREI);
    // Ein Live-Bereich, der erst MIT Text eingefügt wird, wird von Screenreadern typischerweise
    // nicht angesagt. Deshalb ist die Existenz vor dem Ereignis Teil des Vertrags.
    expect(bereiche().length).toBeGreaterThanOrEqual(1);
    expect(ansage()).toBe("");
  });

  it("V2: der Bereich für den geschlossenen Zustand ist höflich und liegt AUSSERHALB des Dialogs", () => {
    mount(DREI);
    const aussen = bereiche().filter((e) => e.closest("dialog") === null);
    expect(aussen.length).toBeGreaterThanOrEqual(1);
    for (const e of aussen) {
      expect(e.getAttribute("aria-live")).toBe("polite");
    }
  });

  it("V3: nach dem Öffnen trägt ein Bereich INNERHALB des Dialogs den Text", () => {
    mount(DREI);
    oeffne(0);
    const innen = bereiche().filter((e) => e.closest("dialog") !== null);
    expect(innen.length).toBeGreaterThanOrEqual(1);
    expect(innen.some((e) => (e.textContent ?? "").trim().length > 0)).toBe(true);
    for (const e of innen) {
      if ((e.textContent ?? "").trim().length > 0) {
        expect(e.getAttribute("aria-live")).toBe("polite");
      }
    }
  });

  it("V4: Öffnen nennt die Fläche UND die Position", () => {
    mount(DREI);
    oeffne(0);
    expect(ansage()).toBe(`${FLAECHE}: ${ort(1, 3)} — Eins`);
  });

  it("V5: Vorwärts meldet die neue Position", () => {
    mount(DREI);
    oeffne(0);
    klick(knopf("chste")); // ko.galleryNext „Nächstes Bild"
    expect(ansage()).toBe(`${ort(2, 3)} — Zwei`);
  });

  it("V6: Zurück meldet die neue Position", () => {
    mount(DREI);
    oeffne(2);
    klick(knopf("vorheriges"));
    expect(ansage()).toBe(`${ort(2, 3)} — Zwei`);
  });

  it("V7: auch der Tastaturpfad (Pfeiltaste) meldet die neue Position", () => {
    mount(DREI);
    oeffne(0);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });
    expect(ansage()).toBe(`${ort(2, 3)} — Zwei`);
  });

  it("V8: Schließen über den X-Knopf meldet das Schließen im äußeren Bereich", () => {
    mount(DREI);
    oeffne(0);
    klick(knopf("schlie"));
    expect(dialog()).toBeNull();
    expect(ansage()).toBe(`${FLAECHE}: ${SCHLIESSEN}`);
    const gefuellt = bereiche().filter((e) => (e.textContent ?? "").trim().length > 0);
    expect(gefuellt.every((e) => e.closest("dialog") === null)).toBe(true);
  });

  it("V9: Escape (nativer cancel-Pfad) meldet dasselbe Schließen", () => {
    mount(DREI);
    oeffne(1);
    const d = dialog();
    act(() => {
      d?.dispatchEvent(new Event("cancel"));
    });
    expect(dialog()).toBeNull();
    expect(ansage()).toBe(`${FLAECHE}: ${SCHLIESSEN}`);
  });

  it("V10: Öffnen, Bildwechsel und Schließen sind nichtleer und paarweise unterscheidbar", () => {
    mount(DREI);
    oeffne(0);
    const beimOeffnen = ansage();
    klick(knopf("chste"));
    const beimWechsel = ansage();
    klick(knopf("schlie"));
    const beimSchliessen = ansage();
    for (const m of [beimOeffnen, beimWechsel, beimSchliessen]) {
      expect(m.length).toBeGreaterThan(0);
    }
    expect(new Set([beimOeffnen, beimWechsel, beimSchliessen]).size).toBe(3);
  });

  it("V11: zu jedem Zeitpunkt ist höchstens EIN Bereich gefüllt (keine Doppelansage)", () => {
    mount(DREI);
    const zaehle = (): number => texte().filter((s) => s.length > 0).length;
    expect(zaehle()).toBeLessThanOrEqual(1);
    oeffne(0);
    expect(zaehle()).toBe(1);
    klick(knopf("chste"));
    expect(zaehle()).toBe(1);
    klick(knopf("schlie"));
    expect(zaehle()).toBe(1);
  });

  it("P1: die Position ist die WIRKLICHE Position, nicht immer die erste", () => {
    mount(DREI);
    oeffne(1);
    expect(ansage()).toContain(ort(2, 3));
    expect(ansage()).not.toContain(ort(1, 3));
  });

  it("B1: ohne Fußnote erfindet die Meldung KEINE Beschreibung", () => {
    mount(ZWEI_OHNE);
    oeffne(0);
    const m = ansage();
    expect(m).toBe(`${FLAECHE}: ${ort(1, 2)}`);
    // Weder die technische Kennung noch die Quelle dürfen als Ersatzbeschreibung auftauchen.
    expect(m).not.toContain("kw-a");
    expect(m).not.toContain("QQ==");
    expect(m).not.toContain("data:image");
  });

  it("B2: eine WIRKLICH vorhandene Fußnote steht wörtlich in der Meldung", () => {
    mount(GEMISCHT);
    oeffne(0);
    expect(ansage()).toContain("Ventil V2");
  });

  it("B3: ein Alt-Platzhaltertext zählt nicht als Beschreibung", () => {
    mount(PLATZHALTER);
    oeffne(0);
    const m = ansage();
    expect(m).toBe(`${FLAECHE}: ${ort(1, 2)}`);
    expect(m).not.toContain("Noch keine Bildbeschreibung");
  });

  it("B4: beim Wechsel auf ein unbeschriebenes Bild wird die alte Beschreibung nicht mitgeschleppt", () => {
    mount(GEMISCHT);
    oeffne(0);
    expect(ansage()).toContain("Ventil V2");
    klick(knopf("chste"));
    const m = ansage();
    expect(m).toBe(ort(2, 2));
    expect(m).not.toContain("Ventil V2");
  });
});
