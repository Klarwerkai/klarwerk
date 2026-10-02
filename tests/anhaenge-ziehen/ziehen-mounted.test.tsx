// @vitest-environment jsdom
// ================================================================================================
// ANHÄNGE ZIEHEN · GEMOUNTET — der echte Editor, sein echtes `dragstart` und sein echtes `drop`.
// ================================================================================================
//
// WAS DIESE DATEI BELEGT UND WAS NICHT. Hier wird der RichTextEditor montiert, der Listeneintrag
// bekommt sein `dragstart` und das Schreibfeld sein `drop` — mit DEMSELBEN DataTransfer, den der
// Editor beim Ziehen selbst befüllt hat. Gemessen werden DOM und gemeldeter (= gespeicherter) Stand.
//
// jsdom hat keine Darstellung und damit keine Antwort auf „welche Textstelle liegt unter diesem
// Punkt". Die Frage stellt der Editor dem Browser (`caretRangeFromPoint`); hier antwortet an seiner
// Stelle eine Vorgabe, und die Probe prüft, dass der Editor mit genau den Ablegekoordinaten fragt
// und genau dort einsetzt. Dass ein echter Browser für echte Mauskoordinaten die richtige Stelle
// liefert, misst `ziehen-im-browser-chromium.test.ts` mit echter Maus.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { type EditorImage, RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { ANHANG_ZIEH_TYP } from "../../apps/web/src/lib/anhangZiehen";
import type { EditorFile } from "../../apps/web/src/lib/bodyFileLink";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BILDER: EditorImage[] = [
  { objectId: "obj-pumpe", name: "Pumpe.png" },
  { src: "data:image/png;base64,iVBORw0KGgo=", name: "Skizze.png" },
];
const DATEIEN: EditorFile[] = [{ objectId: "obj-plan", name: "Wartungsplan.pdf" }];

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let gemeldet = "";

function Host({ start }: { start: string }) {
  const [value, setValue] = useState(start);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartung Pumpe",
      images: BILDER,
      files: DATEIEN,
      onChange: (html: string) => {
        gemeldet = html;
        setValue(html);
      },
    }),
  );
}

function mount(start: string): void {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  gemeldet = "";
  act(() => {
    r.render(createElement(Host, { start }));
  });
}

function abbauen(): void {
  if (root) {
    const r = root;
    act(() => {
      r.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
}

const punktAbfragen: Array<[number, number]> = [];
let punktAntwort: (() => Range | null) | null = null;
Object.defineProperty(document, "caretRangeFromPoint", {
  configurable: true,
  get: () =>
    punktAntwort === null
      ? undefined
      : (x: number, y: number): Range | null => {
          punktAbfragen.push([x, y]);
          return punktAntwort?.() ?? null;
        },
});

afterEach(() => {
  abbauen();
  punktAntwort = null;
  punktAbfragen.length = 0;
  window.getSelection()?.removeAllRanges();
});

function schreibfeld(): HTMLElement {
  const el = container?.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Das Schreibfeld ist nicht gerendert");
  }
  return el;
}

function knopfMit(o: { text?: string; titel?: string }): HTMLButtonElement {
  const k = [...(container?.querySelectorAll("button") ?? [])].find((b) =>
    o.text !== undefined ? b.textContent?.trim() === o.text : b.title === o.titel,
  );
  if (!k) {
    throw new Error(`Kein Knopf ${JSON.stringify(o)}`);
  }
  return k;
}

function oeffneListe(art: "bild" | "datei"): void {
  const k = knopfMit({ titel: i18n.t(art === "bild" ? "editor.image" : "editor.file") });
  act(() => {
    k.click();
  });
}

// Ein DataTransfer, wie der Browser ihn zwischen `dragstart` und `drop` trägt.
interface Ziehdaten {
  daten: Map<string, string>;
  types: string[];
  files: File[];
  effectAllowed: string;
  dropEffect: string;
  setData(typ: string, wert: string): void;
  getData(typ: string): string;
}
function ziehdaten(vorgabe: Record<string, string> = {}): Ziehdaten {
  const daten = new Map(Object.entries(vorgabe));
  return {
    daten,
    get types() {
      return [...daten.keys()];
    },
    files: [],
    effectAllowed: "uninitialized",
    dropEffect: "none",
    setData: (typ, wert) => {
      daten.set(typ, wert);
    },
    getData: (typ) => daten.get(typ) ?? "",
  };
}

function beginneZiehen(eintrag: string, dt: Ziehdaten): void {
  const ev = new Event("dragstart", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: dt });
  act(() => {
    knopfMit({ text: eintrag }).dispatchEvent(ev);
  });
}

const ABLAGE = { x: 137, y: 42 };

function legeAb(dt: Ziehdaten, ziel: EventTarget = schreibfeld()): void {
  const ev = new MouseEvent("drop", {
    bubbles: true,
    cancelable: true,
    clientX: ABLAGE.x,
    clientY: ABLAGE.y,
  });
  Object.defineProperty(ev, "dataTransfer", { value: dt });
  act(() => {
    ziel.dispatchEvent(ev);
  });
}

// Die Stelle VOR `wort` im Schreibfeld — das, was der Browser für den Ablegepunkt melden würde.
function stelleVor(wort: string): () => Range {
  return () => {
    const gang = document.createTreeWalker(schreibfeld(), NodeFilter.SHOW_TEXT);
    for (let k = gang.nextNode(); k; k = gang.nextNode()) {
      const i = (k as Text).data.indexOf(wort);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(k, i);
        r.collapse(true);
        return r;
      }
    }
    throw new Error(`„${wort}" steht nicht im Schreibfeld`);
  };
}

function zieheAusListe(art: "bild" | "datei", eintrag: string, vorWort: string): Ziehdaten {
  oeffneListe(art);
  const dt = ziehdaten();
  beginneZiehen(eintrag, dt);
  punktAntwort = stelleVor(vorWort);
  legeAb(dt);
  return dt;
}

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

function textVor(wurzel: Node, k: Node): string {
  const r = document.createRange();
  r.setStart(wurzel, 0);
  r.setEndBefore(k);
  return norm(r.toString());
}

function figuren(wurzel: Element) {
  return [...wurzel.querySelectorAll("figure")].map((f) => ({
    bildId: f.querySelector("img")?.getAttribute("data-image-id") ?? null,
    unterschriftId: f.querySelector("figcaption")?.getAttribute("data-image-id") ?? null,
    src: f.querySelector("img")?.getAttribute("src") ?? null,
    davor: textVor(wurzel, f),
  }));
}

function geparst(html: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
}

describe("Anhänge ziehen · die Ziehdaten tragen einen Schlüssel, kein Markup", () => {
  it("Z0 · `dragstart` auf dem Listeneintrag setzt NUR den eigenen Typ mit Art und Schlüssel", () => {
    mount("<p>Alpha</p>");
    oeffneListe("bild");
    const dt = ziehdaten();
    beginneZiehen("Pumpe.png", dt);
    expect(dt.types).toEqual([ANHANG_ZIEH_TYP]);
    expect(JSON.parse(dt.getData(ANHANG_ZIEH_TYP))).toEqual({
      art: "bild",
      schluessel: "obj-pumpe",
    });
    expect(dt.effectAllowed).toBe("copy");
    expect(knopfMit({ text: "Pumpe.png" }).draggable).toBe(true);
  });
});

describe("Anhänge ziehen · Z1 — abgelegt wird an der Stelle, die der Browser für den Punkt meldet", () => {
  it("Z1 · Bild vor „Beta“, obwohl der Cursor am Ende steht; gefragt wird mit den Ablegekoordinaten", () => {
    mount("<p>Alpha Beta Gamma</p>");
    // Cursor ans Ende — ein Einfügen am Cursor wäre hier sichtbar falsch.
    const ende = document.createRange();
    ende.selectNodeContents(schreibfeld());
    ende.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(ende);

    zieheAusListe("bild", "Pumpe.png", "Beta");

    expect(punktAbfragen).toEqual([[ABLAGE.x, ABLAGE.y]]);
    const imFeld = figuren(schreibfeld());
    expect(imFeld).toHaveLength(1);
    expect(imFeld[0]?.src).toBe("/api/objects/obj-pumpe/raw");
    expect(imFeld[0]?.davor).toBe("Alpha");
    expect(imFeld[0]?.bildId).toBeTruthy();
    expect(imFeld[0]?.unterschriftId).toBe(imFeld[0]?.bildId);
    // Gemeldet (= gespeichert) ist dieselbe Hülle an derselben Stelle.
    expect(figuren(geparst(gemeldet))).toEqual(imFeld);
    // Die Liste ist nach dem Ablegen zu — wie nach dem Klick.
    expect(() => knopfMit({ text: "Pumpe.png" })).toThrow();
  });

  it("Z1b · ein Bild ohne objectId (eigene Quelle) wird mit dieser Quelle eingesetzt", () => {
    mount("<p>Alpha Beta</p>");
    zieheAusListe("bild", "Skizze.png", "Beta");
    const imFeld = figuren(schreibfeld());
    expect(imFeld[0]?.src).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(imFeld[0]?.davor).toBe("Alpha");
  });
});

describe("Anhänge ziehen · Z2/Z3 — Anker je Vorkommen, stabil über Speichern und Wiederöffnen", () => {
  it("Z2 · zweimal dasselbe Bild: zwei Hüllen mit zwei verschiedenen, je gepaarten Kennungen", () => {
    mount("<p>Alpha Beta Gamma Delta</p>");
    zieheAusListe("bild", "Pumpe.png", "Beta");
    zieheAusListe("bild", "Pumpe.png", "Delta");

    const [a, b] = figuren(schreibfeld());
    expect(a?.bildId).toBeTruthy();
    expect(b?.bildId).toBeTruthy();
    expect(a?.bildId).not.toBe(b?.bildId);
    expect(a?.unterschriftId).toBe(a?.bildId);
    expect(b?.unterschriftId).toBe(b?.bildId);
    expect([a?.davor, b?.davor]).toEqual(["Alpha", "Alpha Beta Gamma"]);
  });

  it("Z3 · Speichern (Sanitizer) und Wiederöffnen: dieselben Kennungen an denselben Stellen", () => {
    mount("<p>Alpha Beta Gamma Delta</p>");
    zieheAusListe("bild", "Pumpe.png", "Beta");
    zieheAusListe("bild", "Pumpe.png", "Delta");
    const vorher = figuren(schreibfeld());

    const gespeichert = sanitizeHtml(gemeldet);
    abbauen();
    mount(gespeichert);
    const nachher = figuren(schreibfeld());

    expect(nachher).toEqual(vorher);
    for (const f of vorher) {
      expect(gespeichert.split(`data-image-id="${f.bildId}"`).length - 1, gespeichert).toBe(2);
    }
  });
});

describe("Anhänge ziehen · Z4/Z5 — Dateien und vorhandene Hüllen", () => {
  it("Z4 · Datei aus der Dateiliste: sicherer Anhang-Link an der Stelle, überlebt das Wiederöffnen", () => {
    mount("<p>Vorher Nachher</p>");
    zieheAusListe("datei", "Wartungsplan.pdf", "Nachher");

    const link = schreibfeld().querySelector("div.attachment > a");
    expect(link?.getAttribute("href")).toBe("/api/objects/obj-plan/raw");
    expect(textVor(schreibfeld(), link?.parentElement as Node)).toBe("Vorher");

    const gespeichert = sanitizeHtml(gemeldet);
    abbauen();
    mount(gespeichert);
    expect(schreibfeld().querySelector("div.attachment > a")?.getAttribute("href")).toBe(
      "/api/objects/obj-plan/raw",
    );
  });

  it("Z5 · meldet der Browser eine Stelle IN einer Bildunterschrift, kommt das Bild hinter die Hülle", () => {
    mount(
      `<figure><img src="/api/objects/obj-alt/raw" alt="Alt"><figcaption>Alte Unterschrift</figcaption></figure><p>Text danach</p>`,
    );
    const vorher = figuren(schreibfeld());
    expect(vorher).toHaveLength(1);

    zieheAusListe("bild", "Pumpe.png", "Unterschrift");

    const [alt, neu] = figuren(schreibfeld());
    expect(alt).toEqual(vorher[0]);
    expect(schreibfeld().querySelector("figcaption")?.textContent).toBe("Alte Unterschrift");
    expect(neu?.src).toBe("/api/objects/obj-pumpe/raw");
    expect(neu?.davor).toBe("Alte Unterschrift");
    expect(neu?.unterschriftId).toBe(neu?.bildId);
  });
});

describe("Anhänge ziehen · Z6 — nur bekannte Anhänge, nie fremdes Markup", () => {
  const FAELLE: Array<[string, Record<string, string>]> = [
    ["fremdes HTML", { "text/html": `<img src="https://fremd.example/x.png" onerror="alert(1)">` }],
    ["fremde URL", { "text/uri-list": "https://fremd.example/x.png" }],
    ["unbekannter Schlüssel", { [ANHANG_ZIEH_TYP]: '{"art":"bild","schluessel":"obj-fremd"}' }],
    ["Bildschlüssel als Datei", { [ANHANG_ZIEH_TYP]: '{"art":"datei","schluessel":"obj-pumpe"}' }],
    ["Markup statt Schlüssel", { [ANHANG_ZIEH_TYP]: "<img src=x onerror=alert(1)>" }],
  ];

  it.each(FAELLE)("Z6 · %s: nichts eingefügt, nichts gemeldet", (_name, vorgabe) => {
    mount("<p>Vorher Nachher</p>");
    const vorher = schreibfeld().innerHTML;
    punktAntwort = stelleVor("Nachher");
    legeAb(ziehdaten(vorgabe));
    expect(schreibfeld().innerHTML).toBe(vorher);
    expect(gemeldet).toBe("");
  });

  it("Z6 · Markup neben einem bekannten Schlüssel wird ignoriert — eingesetzt wird nur das Listenbild", () => {
    mount("<p>Vorher Nachher</p>");
    punktAntwort = stelleVor("Nachher");
    legeAb(
      ziehdaten({
        [ANHANG_ZIEH_TYP]: JSON.stringify({
          art: "bild",
          schluessel: "obj-pumpe",
          html: `<img src="https://fremd.example/x.png" onerror="alert(1)">`,
        }),
      }),
    );
    const html = schreibfeld().innerHTML + gemeldet;
    expect(html).not.toContain("fremd.example");
    expect(html).not.toContain("onerror");
    expect(figuren(schreibfeld())[0]?.src).toBe("/api/objects/obj-pumpe/raw");
  });
});

describe("Anhänge ziehen · ohne Punkt-Auskunft des Browsers", () => {
  it("R1 · liefert der Browser keine Stelle, gilt der bisherige Einfügeweg (Cursor, sonst Ende)", () => {
    mount("<p>Vorher Nachher</p>");
    oeffneListe("bild");
    const dt = ziehdaten();
    beginneZiehen("Pumpe.png", dt);
    // `punktAntwort` bleibt null: `caretRangeFromPoint` gibt es in diesem „Browser" nicht.
    legeAb(dt);
    const [f] = figuren(schreibfeld());
    expect(f?.src).toBe("/api/objects/obj-pumpe/raw");
    expect(f?.davor).toBe("Vorher Nachher");
    expect(f?.unterschriftId).toBe(f?.bildId);
  });
});
