// @vitest-environment jsdom
// ================================================================================================
// R-0014 · GRIFFE GEMOUNTET — der echte RichTextEditor, seine echten Griffe, sein echtes onChange.
// ================================================================================================
//
// WAS DIESE DATEI BELEGT: Ein ausgewähltes Bild bekommt Griffe NEBEN dem Schreibfeld; Zeigerdruck,
// -bewegung und Loslassen an einem Griff setzen genau die gezogene Breite am ausgewählten Bild und
// melden sie über onChange. Abbruch (Escape, pointercancel) stellt den Stand vor dem Zug her und
// meldet nichts. Die Stufen bleiben bedienbar und lösen eine gezogene Breite ab. Kennung, Quelle,
// Hülle und Fußnote beider Vorkommen bleiben, und die Griffe stehen in keiner Meldung.
//
// WAS SIE NICHT BELEGT: jsdom hat keine Darstellung. Bild- und Spaltenbreite antworten hier aus einer
// Vorgabe (400 px Bild in 800 px Spalte); dass Chromium die Breite wirklich so darstellt und dass sie
// Speichern in PostgreSQL und Wiederöffnen übersteht, misst
// `griff-speichern-wiederoeffnen-pg.integration.test.ts` mit echter Maus. Ein Neumontieren hier ist
// KEIN Persistenznachweis.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { sanitizeHtml as sanitizeServer } from "../../services/structure/src/sanitize";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SRC = "/api/objects/pumpe-1/raw";
// Zwei Vorkommen DESSELBEN Bildes, jedes mit eigener Hülle, eigener Kennung und gleicher Fußnote.
const START =
  `<p>Vorher</p><figure data-image-id="a1"><img data-image-id="a1" src="${SRC}" alt="Pumpe" data-kw-scale="100"><figcaption data-image-id="a1">Ventil <strong>A</strong></figcaption></figure>` +
  `<figure data-image-id="b2"><img data-image-id="b2" src="${SRC}" alt="Pumpe" data-kw-scale="50"><figcaption data-image-id="b2">Ventil <strong>A</strong></figcaption></figure><p>Nachher</p>`;

const BILD_PX = 400;
const SPALTE_PX = 800;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let meldungen: string[] = [];
const zurueck: Array<() => void> = [];

function Host({ start }: { start: string }) {
  const [value, setValue] = useState(start);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartung Pumpe",
      onChange: (html: string) => {
        meldungen.push(html);
        setValue(html);
      },
    }),
  );
}

function mount(start: string): HTMLDivElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  act(() => {
    r.render(createElement(Host, { start }));
  });
  return el;
}

// Darstellungsvorgabe für jsdom: jedes Bild ist 400 px breit, jede Spalte 800 px — und zwar
// UNABHÄNGIG von seinem width-Attribut. Damit rechnet der Editor jeden Zug vom Druckpunkt aus und
// kann seine Zielbreite nicht aus der Vorgabe ablesen.
function vorgabeDarstellung(): void {
  const rect = Object.getOwnPropertyDescriptor(Element.prototype, "getBoundingClientRect");
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const breite = this instanceof HTMLImageElement ? BILD_PX : SPALTE_PX;
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: breite,
      bottom: 100,
      width: breite,
      height: 100,
      toJSON: () => ({}),
    } as DOMRect;
  };
  const cw = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => SPALTE_PX,
  });
  zurueck.push(() => {
    if (rect) {
      Object.defineProperty(Element.prototype, "getBoundingClientRect", rect);
    }
    if (cw) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", cw);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
    }
  });
}

function editor(): HTMLElement {
  const el = container?.querySelector('[role="textbox"][contenteditable="true"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Schreibfeld fehlt");
  }
  return el;
}

function bild(id: string): HTMLImageElement {
  const img = editor().querySelector(`img[data-image-id="${id}"]`);
  if (!(img instanceof HTMLImageElement)) {
    throw new Error(`Bild ${id} fehlt`);
  }
  return img;
}

function griff(ecke: string): HTMLElement {
  const g = container?.querySelector(`[data-testid="bildgriffe"] [data-kw-griff="${ecke}"]`);
  if (!(g instanceof HTMLElement)) {
    throw new Error(`Griff ${ecke} fehlt`);
  }
  return g;
}

function stufe(label: string): HTMLButtonElement {
  const k = [...(container?.querySelectorAll("button") ?? [])].find(
    (b) => b.textContent?.trim() === label,
  );
  if (!(k instanceof HTMLButtonElement)) {
    throw new Error(`Stufe ${label} fehlt`);
  }
  return k;
}

const STUFEN = ["Klein", "Mittel", "Groß", "Volle Breite"];
const gedrueckt = (): string[] =>
  STUFEN.filter((s) => stufe(s).getAttribute("aria-pressed") === "true");

function waehle(img: HTMLImageElement): void {
  act(() => {
    img.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function zeiger(ziel: Element, typ: string, clientX: number): void {
  const Ctor = typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
  act(() => {
    ziel.dispatchEvent(
      new Ctor(typ, { bubbles: true, cancelable: true, clientX, clientY: 50, button: 0 }),
    );
  });
}

// Die Identität eines Vorkommens: Kennung an Hülle/Bild/Fußnote, Quelle, Fußnotentext.
function identitaet(html: string): Array<Record<string, string | null>> {
  const d = document.createElement("div");
  d.innerHTML = html;
  return [...d.querySelectorAll("figure")].map((f) => ({
    huelle: f.getAttribute("data-image-id"),
    bild: f.querySelector("img")?.getAttribute("data-image-id") ?? null,
    fussnote: f.querySelector("figcaption")?.getAttribute("data-image-id") ?? null,
    src: f.querySelector("img")?.getAttribute("src") ?? null,
    text: f.querySelector("figcaption")?.innerHTML ?? null,
  }));
}

function bildAttr(html: string, id: string, name: string): string | null {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.querySelector(`img[data-image-id="${id}"]`)?.getAttribute(name) ?? null;
}

const IDENT_START = identitaet(START);

beforeEach(async () => {
  await i18n.changeLanguage("de");
  meldungen = [];
  vorgabeDarstellung();
});

afterEach(() => {
  if (root) {
    const r = root;
    act(() => {
      r.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  while (zurueck.length > 0) {
    zurueck.pop()?.();
  }
});

describe("R-0014 · Griffe am ausgewählten Bild (gemountet)", () => {
  it("K1 · ohne Auswahl keine Griffe; ausgewählt vier Griffe NEBEN dem Schreibfeld", () => {
    mount(START);
    expect(container?.querySelector('[data-testid="bildgriffe"]')).toBeNull();
    waehle(bild("a1"));
    const griffe = container?.querySelectorAll('[data-testid="bildgriffe"] [data-kw-griff]');
    expect([...(griffe ?? [])].map((g) => g.getAttribute("data-kw-griff"))).toEqual([
      "nw",
      "ne",
      "sw",
      "se",
    ]);
    for (const g of griffe ?? []) {
      expect(editor().contains(g), "Griff liegt im contenteditable").toBe(false);
    }
    expect(gedrueckt()).toEqual(["Volle Breite"]);
    expect(meldungen, "Auswahl allein meldet nichts").toEqual([]);
  });

  it("K1/K4 · Ziehen am rechten Griff setzt eine Zwischenbreite, meldet sie und lässt alles andere", () => {
    mount(START);
    waehle(bild("a1"));
    const se = griff("se");
    zeiger(se, "pointerdown", 500);
    zeiger(se, "pointermove", 560);
    // Während des Zugs: die Breite folgt dem Zeiger, gemeldet wird noch nichts.
    expect(bild("a1").getAttribute("width")).toBe("57.5%");
    zeiger(se, "pointermove", 600);
    expect(bild("a1").getAttribute("width")).toBe("62.5%");
    expect(meldungen).toEqual([]);
    expect(gedrueckt(), "eine freie Breite ist keine Stufe").toEqual([]);
    expect(container?.querySelector('[data-testid="bildgroesse-gezogen"]')?.textContent).toBe(
      "62.5 %",
    );
    zeiger(se, "pointerup", 600);

    expect(meldungen.length).toBe(1);
    const gespeichert = meldungen[0] as string;
    expect(bildAttr(gespeichert, "a1", "width")).toBe("62.5%");
    expect(bildAttr(gespeichert, "a1", "data-kw-scale"), "die Stufe tritt zurück").toBeNull();
    // Das zweite Vorkommen desselben Bildes bleibt unberührt.
    expect(bildAttr(gespeichert, "b2", "width")).toBeNull();
    expect(bildAttr(gespeichert, "b2", "data-kw-scale")).toBe("50");
    expect(identitaet(gespeichert)).toEqual(IDENT_START);
    // Griffe sind Oberfläche: nichts davon in der Meldung.
    expect(gespeichert).not.toMatch(/kw-bildgriff|data-kw-griff|bildgriffe|contenteditable/);
    // Der Server-Sanitizer übernimmt die Meldung unverändert (kein Wert, den er verwirft).
    expect(sanitizeServer(gespeichert)).toBe(gespeichert);
  });

  it("K1 · linker Griff wächst nach links; Grenzen 10 % und 100 % halten", () => {
    mount(START);
    waehle(bild("a1"));
    const nw = griff("nw");
    zeiger(nw, "pointerdown", 300);
    zeiger(nw, "pointermove", 220);
    expect(bild("a1").getAttribute("width")).toBe("60%");
    zeiger(nw, "pointermove", -50_000);
    expect(bild("a1").getAttribute("width")).toBe("100%");
    zeiger(nw, "pointermove", 50_000);
    expect(bild("a1").getAttribute("width")).toBe("10%");
    zeiger(nw, "pointerup", 50_000);
    expect(bildAttr(meldungen.at(-1) as string, "a1", "width")).toBe("10%");
  });

  it("K1 · Abbruch mit Escape und pointercancel: Stand vor dem Zug, keine Meldung, kein Hängen", () => {
    mount(START);
    waehle(bild("a1"));
    const se = griff("se");
    zeiger(se, "pointerdown", 500);
    zeiger(se, "pointermove", 640);
    expect(bild("a1").getAttribute("width")).toBe("67.5%");
    // Die ganze Escape-Geste, wie der Browser sie liefert: keydown UND keyup am fokussierten
    // Schreibfeld. Das keyup darf die Bildauswahl nicht über den Cursorweg löschen (Cloudbefund
    // root-nacharbeit-01: danach fehlten die Griffe).
    act(() => {
      editor().dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    act(() => {
      editor().dispatchEvent(new KeyboardEvent("keyup", { key: "Escape", bubbles: true }));
    });
    expect(bild("a1").hasAttribute("width"), "Escape stellt den Stand vor dem Zug her").toBe(false);
    expect(gedrueckt()).toEqual(["Volle Breite"]);
    expect(griff("se"), "nach dem Abbruch bleibt das Bild ausgewählt").toBe(se);
    // Weitere Bewegung nach dem Abbruch zieht nicht mehr; das Loslassen über dem Text meldet
    // nichts und wählt das Bild nicht ab.
    zeiger(se, "pointermove", 700);
    zeiger(se, "pointerup", 700);
    act(() => {
      editor().dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    expect(bild("a1").hasAttribute("width")).toBe(false);
    expect(meldungen).toEqual([]);
    expect(griff("se"), "nach dem Loslassen bleibt das Bild ausgewählt").toBe(se);

    // Ein zweiter, regulärer Zug funktioniert danach — kein hängender Zustand.
    zeiger(se, "pointerdown", 500);
    zeiger(se, "pointermove", 540);
    zeiger(se, "pointerup", 540);
    expect(bildAttr(meldungen.at(-1) as string, "a1", "width")).toBe("55%");

    // pointercancel während eines dritten Zugs: zurück auf 55 %, keine weitere Meldung.
    const vorher = meldungen.length;
    zeiger(se, "pointerdown", 500);
    zeiger(se, "pointermove", 300);
    expect(bild("a1").getAttribute("width")).toBe("25%");
    zeiger(se, "pointercancel", 300);
    expect(bild("a1").getAttribute("width")).toBe("55%");
    expect(meldungen.length).toBe(vorher);
  });

  it("K3 · die vier Stufen bleiben bedienbar und lösen eine gezogene Breite ab", () => {
    mount(START);
    waehle(bild("a1"));
    const se = griff("se");
    zeiger(se, "pointerdown", 500);
    zeiger(se, "pointermove", 520);
    zeiger(se, "pointerup", 520);
    expect(bildAttr(meldungen.at(-1) as string, "a1", "width")).toBe("52.5%");

    for (const [label, wert] of [
      ["Klein", "25"],
      ["Mittel", "50"],
      ["Groß", "75"],
      ["Volle Breite", "100"],
    ] as const) {
      act(() => {
        stufe(label).click();
      });
      const html = meldungen.at(-1) as string;
      expect(bildAttr(html, "a1", "data-kw-scale"), label).toBe(wert);
      expect(bildAttr(html, "a1", "width"), `${label} löst die gezogene Breite ab`).toBeNull();
      expect(gedrueckt()).toEqual([label]);
      expect(container?.querySelector('[data-testid="bildgroesse-gezogen"]')).toBeNull();
      expect(identitaet(html)).toEqual(IDENT_START);
    }
  });

  it("K2-Vorstufe · ein Rumpf mit gezogener Breite zeigt sie beim Auswählen wieder an", () => {
    // Nur die Anzeige des Editors bei einem bereits gespeicherten Wert — der Persistenzweg selbst
    // ist Sache der PostgreSQL-Strecke.
    mount(START.replace('data-kw-scale="100"', 'width="62.5%"'));
    waehle(bild("a1"));
    expect(bild("a1").getAttribute("width")).toBe("62.5%");
    expect(gedrueckt()).toEqual([]);
    expect(container?.querySelector('[data-testid="bildgroesse-gezogen"]')?.textContent).toBe(
      "62.5 %",
    );
    waehle(bild("b2"));
    expect(gedrueckt()).toEqual(["Mittel"]);
    expect(container?.querySelector('[data-testid="bildgroesse-gezogen"]')).toBeNull();
  });
});
