// @vitest-environment jsdom
// ================================================================================================
// JOB 3051 — DIE GETRENNTE BILDKENNUNG WIRD DEM AUTOR GESAGT (die Flächenhälfte)
// ================================================================================================
//
// PRIORITAETEN.md V8: „Beim Öffnen eines Textes mit doppelter Bildkennung **meldet die Fläche das**
// und trennt die Zuordnung, statt still das erste Bild zu erwischen." Die Trennung ist seit JOB 3035
// gebaut. Was fehlte, war die Meldung: der Editor reparierte im Stillen, und der Autor erfuhr nichts
// davon, dass eine seiner Bildbeschreibungen jetzt an einem anderen Bild hängt.
//
// WARUM DIESER TEST GEMOUNTET IST: der Zweck ist erfüllt, wenn ein MENSCH den Satz sieht — nicht,
// wenn eine Funktion eine Liste zurückgibt (genau diese Halbheit hält die Zeile seit dem 03.09.
// offen). Ein Quelltext-Pin sähe die richtige Zeile und bliebe grün, während der Hinweis nirgends
// gerendert würde. Deshalb wird der Editor wirklich gerendert und der Hinweis im Baum gesucht.
//
// Die acht Fälle unten sind das Zustandsmodell aus dem Auftrag §9, je einer als eigener Fall.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
// Die EINE Naht für isoliert gemountete Editor-Tests (mega50 Block A) — nicht eine zweite bauen.
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BILD_A = "data:image/png;base64,AAAA";
const BILD_B = "data:image/png;base64,BBBB";
const BILD_C = "data:image/png;base64,CCCC";

function einheit(id: string, src: string, text: string): string {
  return [
    `<figure data-image-id="${id}">`,
    `<img src="${src}" data-image-id="${id}">`,
    `<figcaption data-image-id="${id}">${text}</figcaption>`,
    "</figure>",
  ].join("");
}

/** Zwei Bilder, EINE Kennung — der Altbestand, um den es geht. */
const DOPPELT = [
  "<p>Ein Satz.</p>",
  einheit("kw-img-1", BILD_A, "Beschreibung des ersten Bildes"),
  einheit("kw-img-1", BILD_B, "Beschreibung des zweiten Bildes"),
].join("");

/** Drei Bilder, EINE Kennung — zwei Trennungen. */
const DREIFACH = [
  einheit("kw-img-9", BILD_A, "Erste"),
  einheit("kw-img-9", BILD_B, "Zweite"),
  einheit("kw-img-9", BILD_C, "Dritte"),
].join("");

/** Zwei Bilder, zwei eigene Kennungen — nichts zu trennen, nichts zu melden. */
const EINDEUTIG = [
  einheit("kw-img-2", BILD_A, "Erste"),
  einheit("kw-img-3", BILD_B, "Zweite"),
].join("");

const OHNE_BILD = "<p>Nur Text, kein einziges Bild.</p>";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let setzeWert: (html: string) => void = () => undefined;

function Host({ start }: { start: string }): JSX.Element {
  const [value, setValue] = useState(start);
  setzeWert = setValue;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => setValue(html),
    }),
  );
}

function mount(start: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, { start }));
  });
}

/** Alle Hinweise dieser Art — als Feld, damit „genau einer" prüfbar ist statt „mindestens einer". */
function hinweise(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll('[data-testid="editor-kennung-getrennt"]'),
  ) as HTMLElement[];
}

function hinweis(): HTMLElement {
  const gefunden = hinweise();
  const eine = gefunden[0];
  if (gefunden.length !== 1 || eine === undefined) {
    throw new Error(`Erwartet war genau EIN Hinweis, gefunden: ${gefunden.length}`);
  }
  return eine;
}

/** Die Zahl, die der Hinweis über sich selbst sagt — aus der Liste, nicht aus dem Text geraten. */
function gemeldeteAnzahl(): number {
  return Number(hinweis().getAttribute("data-anzahl"));
}

function schliessknopf(): HTMLElement {
  const el = hinweis().querySelector("button");
  if (!(el instanceof HTMLElement)) {
    throw new Error("Der Hinweis hat keine Schaltfläche zum Schließen");
  }
  return el;
}

function schreibflaeche(): HTMLElement {
  const el = document.querySelector('[contenteditable="true"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Keine editierbare Fläche gefunden — die Vorbedingung fehlt.");
  }
  return el;
}

/** Ein neuer Text von außen — dieselbe Bewegung wie „anderen Entwurf laden". */
function neuerText(html: string): void {
  act(() => setzeWert(html));
}

async function spracheWechseln(lng: string): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage(lng);
  });
}

/** Der Knopf, der zwischen Bearbeiten und Vorschau umschaltet — über seinen angekündigten Titel. */
function modusKnopf(): HTMLElement {
  const titel = i18n.t("editor.preview");
  const el = Array.from(document.querySelectorAll("button")).find(
    (b) => b.getAttribute("title") === titel,
  );
  if (!(el instanceof HTMLElement)) {
    throw new Error("Kein Umschaltknopf für die Vorschau gefunden");
  }
  return el;
}

/** Einfügen aus der Zwischenablage — der Weg über `onPaste` → `insertHtmlReliable`. */
function fuegeEin(html: string): void {
  const ereignis = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(ereignis, "clipboardData", {
    value: { items: [], getData: (typ: string) => (typ === "text/html" ? html : "") },
  });
  act(() => {
    schreibflaeche().dispatchEvent(ereignis);
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await i18n.changeLanguage("de");
});

describe("JOB 3051 · Zustand 3: erfolgreich, MIT Trennung", () => {
  it("M1 · beim Öffnen eines Textes mit doppelter Kennung steht der Hinweis mit der Anzahl 1 da", () => {
    mount(DOPPELT);

    // Vorbedingung: die Trennung ist wirklich geschehen — sonst prüfte der Test einen leeren Fall.
    const ids = Array.from(schreibflaeche().querySelectorAll("img")).map((n) =>
      n.getAttribute("data-image-id"),
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size, "die Kennungen wurden gar nicht getrennt").toBe(2);

    const el = hinweis();
    expect(el.getAttribute("aria-live"), "der Hinweis wird nicht angekündigt").toBe("polite");
    expect(gemeldeteAnzahl(), "die gemeldete Anzahl stammt nicht aus der Trennung").toBe(1);
    // Und der Mensch liest genau den Satz aus dem Katalog — nicht eine Zeichenkette aus dem JSX.
    expect(el.textContent).toContain(i18n.getFixedT("de")("editor.kennungGetrennt", { count: 1 }));
  });

  it("M2 · die Anzahl kommt aus der Liste, nicht aus einer Schätzung: drei gleiche Kennungen → 2", () => {
    mount(DREIFACH);
    expect(gemeldeteAnzahl()).toBe(2);
    expect(hinweis().textContent).toContain(
      i18n.getFixedT("de")("editor.kennungGetrennt", { count: 2 }),
    );
  });
});

describe("JOB 3051 · Zustände 1 und 2: laden, und erfolgreich OHNE Trennung", () => {
  it("M3 · ein Text ohne Doppelung bekommt keinen Hinweis — auch keine Entwarnung", () => {
    mount(EINDEUTIG);
    expect(hinweise(), "es steht ein Hinweis da, obwohl nichts getrennt wurde").toEqual([]);
  });

  it("M4 · ein Text ganz ohne Bilder bekommt keinen Hinweis", () => {
    mount(OHNE_BILD);
    expect(hinweise()).toEqual([]);
  });
});

describe("JOB 3051 · Zustand 4: neuer Text von außen", () => {
  it("M5 · der Befund aus Dokument A bleibt an Dokument B nicht stehen", () => {
    // Die Lehre aus JOB 3046 R1, hier sinngemäß: ein Rücklauf aus einem älteren Stand darf den
    // neuen nicht mehr färben.
    mount(DOPPELT);
    expect(gemeldeteAnzahl(), "Vorbedingung: Dokument A hat einen Befund").toBe(1);

    neuerText(EINDEUTIG);
    expect(hinweise(), "der Hinweis von Dokument A steht an Dokument B noch da").toEqual([]);
  });

  it("M6 · und ein neuer Befund ersetzt den alten, statt sich zu ihm zu addieren", () => {
    mount(DOPPELT);
    expect(gemeldeteAnzahl()).toBe(1);

    neuerText(DREIFACH);
    expect(hinweise(), "es stehen zwei Hinweise da").toHaveLength(1);
    expect(gemeldeteAnzahl(), "die Zahl des alten Dokuments wurde mitgezählt").toBe(2);
  });
});

describe("JOB 3051 · Zustand 5: Sprachwechsel am offenen Editor", () => {
  it("M7 · der stehende Hinweis bleibt genau einmal stehen und wechselt die Sprache mit", async () => {
    mount(DOPPELT);
    expect(gemeldeteAnzahl(), "Vorbedingung: der Hinweis steht").toBe(1);

    for (const lng of ["en", "nl", "de"]) {
      await spracheWechseln(lng);
      expect(
        hinweise(),
        `Nach dem Wechsel auf ${lng} ist der Hinweis weg oder doppelt`,
      ).toHaveLength(1);
      expect(gemeldeteAnzahl(), `Nach dem Wechsel auf ${lng} stimmt die Anzahl nicht mehr`).toBe(1);
      expect(
        hinweis().textContent,
        `Nach dem Wechsel auf ${lng} steht der Satz noch in der alten Sprache`,
      ).toContain(i18n.getFixedT(lng)("editor.kennungGetrennt", { count: 1 }));
    }
  });
});

describe("JOB 3051 · Zustand 6: vom Autor geschlossen", () => {
  it("M8 · geschlossen bleibt geschlossen — auch über einen Sprachwechsel hinweg", async () => {
    mount(DOPPELT);
    const knopf = schliessknopf();
    expect(knopf.getAttribute("aria-label"), "die Schaltfläche ist nicht benannt").toBe(
      i18n.getFixedT("de")("editor.kennungGetrenntClose"),
    );

    act(() => knopf.click());
    expect(hinweise(), "der Hinweis lässt sich nicht schließen").toEqual([]);

    await spracheWechseln("en");
    expect(hinweise(), "der geschlossene Hinweis kam beim Sprachwechsel zurück").toEqual([]);
  });

  it("M9 · … bis ein neuer Text geladen wird, der wieder etwas trennt", () => {
    mount(DOPPELT);
    act(() => schliessknopf().click());
    expect(hinweise()).toEqual([]);

    neuerText(DREIFACH);
    expect(hinweise(), "ein neuer Befund erreicht den Autor nicht mehr").toHaveLength(1);
    expect(gemeldeteAnzahl()).toBe(2);
  });
});

describe("JOB 3051 · Zustand 7: Moduswechsel weg von „bearbeiten“", () => {
  it("M10 · in der Vorschau steht kein Hinweis", () => {
    mount(DOPPELT);
    expect(gemeldeteAnzahl(), "Vorbedingung: im Bearbeiten-Modus steht er").toBe(1);

    act(() => modusKnopf().click());
    expect(
      document.querySelector('[contenteditable="true"]'),
      "der Editor ist noch im Bearbeiten-Modus",
    ).toBe(null);
    expect(hinweise(), "der Hinweis steht in der Vorschau").toEqual([]);
  });
});

describe("JOB 3051 · Zustand 8: der Einfügeweg", () => {
  it("M11 · trennt das Einfügen etwas, wird es über DIESELBE Anzeige gemeldet — kein zweiter Kanal", () => {
    mount(einheit("kw-img-1", BILD_A, "Erste"));
    expect(hinweise(), "Vorbedingung: vorher ist nichts zu melden").toEqual([]);

    // Ein Ausschnitt aus einem anderen Dokument bringt dieselbe Kennung mit.
    fuegeEin(`<img src="${BILD_B}" data-image-id="kw-img-1">`);

    expect(hinweise(), "das Einfügen meldet nicht oder auf einem zweiten Kanal").toHaveLength(1);
    expect(gemeldeteAnzahl()).toBe(1);
  });
});
