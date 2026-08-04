// @vitest-environment jsdom
// AUFTRAG-mega89 Block B + C — ZWEI BILDER IN EINER EINGEHENDEN FIGURE, GETRENNT BESCHRIEBEN.
//
// bens dritte Vor-Ship-Bedingung, wörtlich der Umfang: zwei Bilder in einer gemeinsamen eingehenden
// figure laden oder einfügen, BILD 1 UND BILD 2 GETRENNT BESCHREIBEN, SPEICHERN, ERNEUT ÖFFNEN und
// beide Zuordnungen AUCH IN DER GALERIE prüfen.
//
// WAS HIER GEFAHREN WIRD und was nicht: dies ist die deterministische Hälfte — Laden aus dem
// Bestand, Einfügen aus der Zwischenablage, der echte Rundlauf über BEIDE Sanitizer und die
// Galerie-Ableitung, die die Leseansicht wirklich benutzt (`extractBodyImages`, dieselbe Funktion,
// die `BodyImageGallery` aufruft — keine Attrappe). Die BROWSER-Hälfte (echte Dateiauswahl, echtes
// Drop, echtes Tippen, echter Entwurf über die Oberfläche) steht in
// `tests-smoke/mega89-mehrbild-browser.spec.ts`; die Lehre aus mega87 gilt: eine Aussage über
// Browserverhalten wird im Browser gemessen. jsdom kennt weder `execCommand` noch Canvas.
//
// DIE GEGENPROBE STECKT IM AUFBAU: es wird NICHT nur geprüft, dass zwei Fußnoten da sind (das war
// schon vor mega89 so — sie waren nur ineinander verschachtelt), sondern dass der Text, der in
// Fußnote 1 geschrieben wurde, in Fußnote 1 LANDET und nicht in Fußnote 2. Genau daran wird eine
// wieder verschachtelnde oder wieder über Nachfahren paarende Fassung rot.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";
import { CAPTION_OPEN_ATTR } from "../../apps/web/src/lib/editorFigures";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";
import {
  beschreibungsText,
  beschreibungsfeldOffen,
  mitBildbeschreibung,
  schreibeBeschreibung,
} from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const A = "/api/objects/bild-a/raw";
const B = "/api/objects/bild-b/raw";
const ERSTE = "Riefen in Laufrichtung bei Schmiermangel";
const ZWEITE = "Lagerschale, Innenring ausgeschlagen";

// Genau das Markup, das aus Word kommt und das ben als Ship-Bedingung benennt: EINE figure, ZWEI
// Bilder. Es steht hier als gespeicherter Bestand — so liegt es in Entwürfen, die Klara geliefert
// hat, und in allem, was ein API-Aufrufer als bodyHtml schickt.
const AUS_WORD = [
  "<h2>Befund</h2>",
  `<figure><img src="${A}" alt="Schiene"><img src="${B}" alt="Lager">`,
  "<figcaption></figcaption></figure>",
].join("");

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let lastHtml = "";

function mount(start: string): void {
  lastHtml = start;
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  act(() => {
    r.render(
      createElement(function Host() {
        const [value, setValue] = useState(start);
        lastHtml = value;
        return mitBildbeschreibung(
          createElement(RichTextEditor, {
            value,
            documentTitle: "Wartungsnotiz",
            onChange: (html: string) => {
              lastHtml = html;
              setValue(html);
            },
          }),
        );
      }),
    );
  });
}

function abbauen(): void {
  const r = root;
  if (r) {
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
}

afterEach(abbauen);

function flaeche(): HTMLElement {
  if (!container) {
    throw new Error("Die Fläche wurde nicht gemountet");
  }
  return container;
}

function fussnoten(): HTMLElement[] {
  return Array.from(flaeche().querySelectorAll(`figcaption[${CAPTION_OPEN_ATTR}]`));
}

function bilderImKoerper(): HTMLImageElement[] {
  return Array.from(flaeche().querySelectorAll('[contenteditable="true"] img'));
}

function klickeFussnote(i: number): void {
  const cap = fussnoten()[i];
  if (!cap) {
    throw new Error(`Es gibt keine ${i + 1}. verankerte Fußnote`);
  }
  act(() => {
    cap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function klick(testid: string): void {
  const knopf = flaeche().querySelector(`[data-testid="${testid}"]`);
  if (!(knopf instanceof HTMLElement)) {
    throw new Error(`Der Knopf ${testid} ist nicht da`);
  }
  act(() => {
    knopf.click();
  });
}

/** Beschreiben über den Weg aus mega84: Klick auf die Beschreibung selbst, tippen, sichern. */
function beschreibe(i: number, text: string): void {
  klickeFussnote(i);
  expect(beschreibungsfeldOffen(), `Das Formular für Bild ${i + 1} hat sich nicht geöffnet`).toBe(
    true,
  );
  act(() => {
    schreibeBeschreibung(text);
  });
  klick("caption-form-save");
}

/** Ein Einfüge-Ereignis mit `text/html` — jsdom hat kein DataTransfer, also der schmale Ausschnitt. */
function fuegeEin(html: string): void {
  const el = flaeche().querySelector('[contenteditable="true"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Der Editor-Knoten ist nicht da");
  }
  const ev = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clipboardData", {
    value: { items: [], getData: (typ: string) => (typ === "text/html" ? html : "") },
  });
  act(() => {
    el.dispatchEvent(ev);
  });
}

describe("AUFTRAG-mega89 Block A/B: aus einer figure mit zwei Bildern werden zwei bedienbare", () => {
  it("beim Laden entstehen zwei FLACHE figures mit zwei eigenen Fußnoten", () => {
    mount(AUS_WORD);
    expect(
      flaeche().querySelectorAll("figure figure").length,
      "Eine figure liegt in einer figure — genau die Verschachtelung, aus der der Datenschaden folgt",
    ).toBe(0);
    expect(fussnoten().length, "Die beiden Bilder teilen sich eine Fußnote oder haben keine").toBe(
      2,
    );
    const kennungen = fussnoten().map((c) => c.getAttribute("data-image-id"));
    expect(new Set(kennungen).size, "Beide Fußnoten tragen dieselbe Kennung").toBe(2);
    expect(bilderImKoerper().map((i) => i.getAttribute("src"))).toEqual([A, B]);
  });

  it("das Laden allein emittiert weiterhin NICHTS", () => {
    mount(AUS_WORD);
    expect(lastHtml, "Das Flachmachen hat ungefragt einen neuen Wert nach außen geschrieben").toBe(
      AUS_WORD,
    );
  });

  it("Bild 1 öffnet SEINE Fußnote, Bild 2 seine — der Formularinhalt beweist es", () => {
    mount(AUS_WORD);
    beschreibe(0, ERSTE);
    beschreibe(1, ZWEITE);

    klickeFussnote(0);
    expect(
      beschreibungsText(),
      "Bild 1 zeigt die Beschreibung von Bild 2 — genau der Befund aus sammel88",
    ).toBe(ERSTE);
    // Erneut sichern: damit steht nicht nur das ÖFFNEN, sondern auch das SCHREIBEN am richtigen Ziel.
    klick("caption-form-save");

    klickeFussnote(1);
    expect(beschreibungsText()).toBe(ZWEITE);
    klick("caption-form-save");

    expect(fussnoten()[0]?.textContent ?? "").toBe(ERSTE);
    expect(fussnoten()[1]?.textContent ?? "").toBe(ZWEITE);
  });
});

describe("AUFTRAG-mega89 Block C: der Kreis — beschreiben, speichern, erneut öffnen, Galerie", () => {
  it("beide Beschreibungen überleben den Rundlauf und stehen beim RICHTIGEN Bild", () => {
    mount(AUS_WORD);
    beschreibe(0, ERSTE);
    beschreibe(1, ZWEITE);

    // Der echte Weg über die Persistenzgrenze: emit() ist durch den Client-Sanitizer, der Server
    // sanitisiert autoritativ beim Speichern, der Client beim Laden.
    const geladen = sanitizeHtml(serverSanitize(lastHtml));
    abbauen();
    mount(geladen);

    expect(flaeche().querySelectorAll("figure figure").length).toBe(0);
    expect(fussnoten().length).toBe(2);
    expect(
      fussnoten()[0]?.textContent ?? "",
      "Nach dem Wiederöffnen steht beim ersten Bild die falsche Beschreibung",
    ).toContain(ERSTE);
    expect(fussnoten()[1]?.textContent ?? "").toContain(ZWEITE);
    expect(fussnoten()[0]?.textContent ?? "").not.toContain(ZWEITE);

    // Und sie sind weiterhin BEDIENBAR, nicht bloß sichtbar.
    klickeFussnote(1);
    expect(beschreibungsfeldOffen()).toBe(true);
    expect(beschreibungsText()).toBe(ZWEITE);
  });

  it("die Galerie zeigt BEIDE Bilder mit der jeweils richtigen Beschreibung", () => {
    mount(AUS_WORD);
    beschreibe(0, ERSTE);
    beschreibe(1, ZWEITE);
    const gespeichert = sanitizeHtml(serverSanitize(lastHtml));

    // Dieselbe Ableitung, die `BodyImageGallery` in der Leseansicht benutzt.
    const galerie = extractBodyImages(gespeichert);
    expect(galerie.length, "Der zweite Galerieeintrag ist verloren gegangen").toBe(2);
    expect(galerie.map((g) => ({ src: g.src, caption: g.caption }))).toEqual([
      { src: A, caption: ERSTE },
      { src: B, caption: ZWEITE },
    ]);
  });
});

describe("AUFTRAG-mega89 Block C: derselbe Fall über den EINFÜGE-Weg", () => {
  it("ein eingefügter Ausschnitt mit zwei Bildern in einer figure wird flach und getrennt beschreibbar", () => {
    mount("<p>Vorher</p>");
    expect(fussnoten().length).toBe(0);
    fuegeEin(`<figure><img src="${A}"><img src="${B}"><figcaption></figcaption></figure>`);

    expect(
      flaeche().querySelectorAll("figure figure").length,
      "Der eingefügte Ausschnitt ist verschachtelt geblieben",
    ).toBe(0);
    expect(fussnoten().length, "Das zweite eingefügte Bild hat keine eigene Fußnote").toBe(2);

    beschreibe(0, ERSTE);
    beschreibe(1, ZWEITE);
    const galerie = extractBodyImages(sanitizeHtml(serverSanitize(lastHtml)));
    expect(galerie.map((g) => g.caption)).toEqual([ERSTE, ZWEITE]);
  });
});
