// @vitest-environment jsdom
// ================================================================================================
// JOB 3282 · EDITOR-R26 — DER LINK STEHT EINMAL DA, UND ALLE VIER BLÖCKE ÜBERLEBEN DEN ROUNDTRIP.
// ================================================================================================
//
// DIE BEIDEN BELEGTEN BEFUNDE (Codex, Nutzerprüfung review26-ki-editor, 08.09., Live 1.185):
//
//   1. „Linkdialog übernimmt die Auswahl als Linktext, verdoppelt sie beim Einfügen jedoch. In zwei
//      Versuchen beobachtet; LINKPROBE-Verdopplung nach Speichern/Reload erhalten."
//   2. „Alle vier Schaltflächen betätigt. … In der anschließenden Kombination mit Liste bzw.
//      vorhandenem Hinweisblock erschienen weitere Typen teils nur als … oder farbige Spans; nach
//      Reload blieb nur der Hinweisblock."
//
// WAS DIE URSACHE WAR, an der Quelle nachgelesen und hier gefahren:
//
//   · LINK: `addLink` rief `exec("insertHTML", …)`. `exec` fokussiert erst den Editor und übergibt
//     dann an `document.execCommand` — es arbeitet also auf dem, was der Browser NACH dem Ausflug
//     in die beiden Dialogfelder für ausgewählt hält. Das ist eine Einfügemarke, keine Markierung:
//     der markierte Text bleibt stehen UND der Link mit demselben Text kommt daneben. Genau die
//     beobachtete Verdopplung.
//   · BLÖCKE: `addBlock` rief denselben Weg. `execCommand("insertHTML")` steht dabei mitten in
//     einem `<li>` bzw. in einem vorhandenen `.panel` — die Engine darf den Block-Container dort
//     auflösen, und übrig bleibt der Platzhalter „…" oder ein Span. Was der Sanitizer nie zu sehen
//     bekommt, kann er auch nicht retten; nach dem Reload war nur noch da, was als `div.panel`
//     wirklich im Rumpf stand.
//
// WARUM DIESE DATEI DEN FEHLER SEHEN KANN UND DIE VORHANDENEN NICHT: `tests/app/editor-blocks.test.ts`
// und `tests/app/editor-links.test.ts` prüfen die reinen Helfer (`editorBlockHtml`,
// `editorLinkHtml`). Die waren nie kaputt — kaputt war der WEG vom Knopf ins DOM. Hier wird deshalb
// der Editor montiert, mit der echten Auswahl markiert und so geklickt, wie der Browser klickt
// (`klickWieBrowser` aus der bestehenden Naht: erst `mousedown`, dann der Fokuswechsel, dann
// `click`). Gemessen wird das DOM des Schreibfeldes UND das, was `onChange` nach oben meldet —
// letzteres ist wörtlich das, was gespeichert und beim Reload wieder geladen wird.
//
// DIE SERIALISIERUNG WIRD NICHT NACHERZÄHLT, sondern gefahren: der emittierte Wert läuft durch
// `sanitizeHtml` (dieselbe Funktion, die den Rumpf an der Persistenzgrenze passiert) und geht als
// neues `value` in einen frisch montierten Editor zurück. Das ist der Reload.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { EDITOR_BLOCKS, editorBlockClass } from "../../apps/web/src/lib/editorBlocks";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
import { klickWieBrowser, mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
// Was der Editor zuletzt nach oben gemeldet hat — der Wert, der gespeichert würde.
let gemeldet = "";

function Host({ start }: { start: string }) {
  const [value, setValue] = useState(start);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
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
  window.getSelection()?.removeAllRanges();
});

/** Das Schreibfeld des Rumpfes (contentEditable mit Textbox-Rolle). */
function schreibfeld(): HTMLElement {
  const el = container?.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Das Schreibfeld ist nicht gerendert");
  }
  return el;
}

/** Der erste Textknoten unter `wurzel` — die Nutzer markieren Text, keine Elemente. */
function textknoten(wurzel: Node): Text {
  const lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  const knoten = lauf.nextNode();
  if (!(knoten instanceof Text)) {
    throw new Error("Kein Textknoten im Schreibfeld");
  }
  return knoten;
}

/**
 * Markieren mit der Maus IM RUMPF: ziehen und loslassen. Dieselbe Bauform wie
 * `markiereMitMaus` der Bildbeschreibungs-Naht, nur auf dem Schreibfeld des Rumpfes.
 */
function markiereImRumpf(von: number, bis: number): void {
  const knoten = textknoten(schreibfeld());
  const bereich = document.createRange();
  bereich.setStart(knoten, von);
  bereich.setEnd(knoten, bis);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(bereich);
  schreibfeld().dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

/** Die Einfügemarke IN einen Textknoten setzen (Klick ins Feld, ohne Markierung). */
function setzeMarkeIn(knoten: Text, versatz: number): void {
  const bereich = document.createRange();
  bereich.setStart(knoten, versatz);
  bereich.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(bereich);
  schreibfeld().dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

/** Ein React-kontrolliertes Eingabefeld befüllen (nativer Setter + `input`, wie beim Tippen). */
function tippe(testid: string, wert: string): void {
  const el = container?.querySelector(`[data-testid="${testid}"]`);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Eingabefeld ${testid} nicht gefunden`);
  }
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    this: HTMLInputElement,
    v: string,
  ) => void;
  act(() => {
    setzer.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function klick(testid: string): void {
  act(() => {
    klickWieBrowser(testid);
  });
}

function zaehle(text: string, teil: string): number {
  return text.split(teil).length - 1;
}

describe("JOB 3282 · A — der Linkdialog verdoppelt die Auswahl nicht mehr", () => {
  it("A1 · markierter Text wird zu GENAU EINEM Link, im DOM und im gespeicherten Stand", () => {
    mount("<p>LINKPROBE</p>");

    markiereImRumpf(0, "LINKPROBE".length);
    klick("editor-link-open");
    // Der Dialog hat die Auswahl als Linktext übernommen — das tat er auch vorher schon richtig.
    const beschriftung = container?.querySelector('[data-testid="editor-link-label"]');
    expect((beschriftung as HTMLInputElement).value).toBe("LINKPROBE");

    tippe("editor-link-url", "https://example.org/probe");
    klick("editor-link-insert");

    const rumpf = schreibfeld().innerHTML;
    expect(zaehle(rumpf, "LINKPROBE"), `Der Rumpf trägt: ${rumpf}`).toBe(1);
    expect(zaehle(rumpf, "<a "), `Der Rumpf trägt: ${rumpf}`).toBe(1);
    expect(schreibfeld().querySelector("a")?.getAttribute("href")).toBe(
      "https://example.org/probe",
    );
  });

  it("A2 · nach Speichern und Reload steht der Text weiterhin genau einmal", () => {
    mount("<p>LINKPROBE</p>");
    markiereImRumpf(0, "LINKPROBE".length);
    klick("editor-link-open");
    tippe("editor-link-url", "https://example.org/probe");
    klick("editor-link-insert");

    // Der Weg über die Persistenzgrenze: derselbe Sanitizer, den Client und Server fahren.
    const gespeichert = sanitizeHtml(gemeldet);
    expect(zaehle(gespeichert, "LINKPROBE"), `Gespeichert: ${gespeichert}`).toBe(1);

    // Und der Reload: ein frisch montierter Editor auf genau diesem Stand.
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    mount(gespeichert);
    const nachReload = schreibfeld().innerHTML;
    expect(zaehle(nachReload, "LINKPROBE"), `Nach Reload: ${nachReload}`).toBe(1);
    expect(schreibfeld().querySelectorAll("a").length).toBe(1);
  });
});

describe("JOB 3282 · B — alle vier Blocktypen überleben Liste, Nachbarblock und Reload", () => {
  it("B1 · vier Blöcke nach einer Liste sind vier eigenständige Blöcke im Rumpf", () => {
    mount("<ul><li>Eins</li></ul>");

    // Die Einfügemarke steht IN der Liste — genau der Kontext, in dem Codex den Verlust sah.
    setzeMarkeIn(textknoten(schreibfeld()), 2);
    for (const block of EDITOR_BLOCKS) {
      klick(`editor-block-${block}`);
    }

    const bloecke = schreibfeld().querySelectorAll("div.panel");
    expect(bloecke.length, `Der Rumpf trägt: ${schreibfeld().innerHTML}`).toBe(4);
    // Jeder Block liegt AUF DER OBERSTEN EBENE des Rumpfes — nicht im `<li>`, nicht ineinander.
    for (const b of bloecke) {
      expect(b.parentElement).toBe(schreibfeld());
    }
    for (const block of EDITOR_BLOCKS) {
      expect(
        schreibfeld().querySelector(`div.${editorBlockClass(block).split(" ").join(".")}`),
        `Der Typ ${block} fehlt`,
      ).not.toBeNull();
    }
    // Die Liste ist unversehrt geblieben.
    expect(schreibfeld().querySelectorAll("ul > li").length).toBe(1);
  });

  it("B2 · nach Speichern und Reload sind alle vier Typen typgerecht wieder da", () => {
    mount("<ul><li>Eins</li></ul>");
    setzeMarkeIn(textknoten(schreibfeld()), 2);
    for (const block of EDITOR_BLOCKS) {
      klick(`editor-block-${block}`);
    }

    const gespeichert = sanitizeHtml(gemeldet);
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    mount(gespeichert);

    expect(
      schreibfeld().querySelectorAll("div.panel").length,
      `Nach Reload: ${schreibfeld().innerHTML}`,
    ).toBe(4);
    for (const block of EDITOR_BLOCKS) {
      expect(
        schreibfeld().querySelector(`div.${editorBlockClass(block).split(" ").join(".")}`),
        `Der Typ ${block} überlebt den Reload nicht`,
      ).not.toBeNull();
    }
  });

  it("B3 · ein Block hinter einem vorhandenen Block wird sein Nachbar, nicht sein Kind", () => {
    mount('<div class="panel panel-note"><p>Vorhandener Hinweis</p></div>');

    setzeMarkeIn(textknoten(schreibfeld()), 3);
    klick("editor-block-warning");

    const bloecke = schreibfeld().querySelectorAll("div.panel");
    expect(bloecke.length, `Der Rumpf trägt: ${schreibfeld().innerHTML}`).toBe(2);
    expect(bloecke[1]?.parentElement).toBe(schreibfeld());
    expect(bloecke[0]?.querySelector("div.panel")).toBeNull();
  });
});
