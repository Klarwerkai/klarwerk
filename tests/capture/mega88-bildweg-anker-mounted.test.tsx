// @vitest-environment jsdom
// AUFTRAG-mega88 Block C + E — DER WEG BIS ZUM WIEDERLESEN, UND KEIN STILLER AUSFALL MEHR.
//
// DER BEFUND (Hand in mega87, ben bestätigt gegen die eingefrorene Basis): ein Bild kam auf dem
// naheliegendsten Weg als NACKTES `<img>` in den Editor. `openCaptionFormFor` suchte
// `image.closest("figure")?.querySelector("figcaption")`, fand nichts und ENDETE — ohne
// Rückmeldung, während der Knopf sichtbar blieb. Dasselbe galt für alles bereits Gespeicherte:
// Klara-Bilder (B33 im Register seit mega69), fremde Einfüge-Ausschnitte, jeder Body aus der Zeit
// vor mega88.
//
// WAS HIER GEFAHREN WIRD — die HANDLUNG, nicht die Verdrahtung:
//   (1) ALTBESTAND: ein gespeicherter Body mit nacktem Bild wird geladen. Danach muss der Nutzer
//       genau das tun können, was er vorher nicht konnte: auf die Beschreibung klicken, sie
//       schreiben, sichern — und beim erneuten Lesen muss sie da sein. Der Kreis schließt sich über
//       den ECHTEN Sanitizer-Rundlauf (Client → Server → Client), nicht über eine Attrappe.
//   (2) EINFÜGEN: ein Ausschnitt mit nacktem `<img>` kommt über `onPaste` in den Editor. Auch er
//       bekommt seinen Anker.
//   (3) KEIN STILLER AUSFALL: der Weg über die Bild-Werkzeugleiste endet nie in Schweigen — er
//       öffnet das Formular, und wenn das nicht ginge, sagte er den Grund.
//
// DIE GRENZE DIESER DATEI, benannt statt verschwiegen: jsdom kennt weder `document.execCommand`
// (der Bild-Knopf der Werkzeugleiste fährt darüber) noch Canvas (`fileToThumbDataUrl` für die lokale
// Dateiauswahl und Drop). Beide Wege sind BROWSERwege, und die Lehre aus mega87 gilt: eine Aussage
// über Browserverhalten wird im Browser gemessen. Sie stehen in
// `tests-smoke/mega88-bildanker-browser.spec.ts` und werden dort mit echter Dateiauswahl und echtem
// Drop gefahren. Was hier belegt wird, ist die Struktur- und Formularseite in einer Umgebung, in
// der sich der Rundlauf deterministisch schließen lässt.
//
// jsdom hat kein `DataTransfer` — das Einfüge-Ereignis wird deshalb mit einem schmalen
// `clipboardData`-Objekt am nativen Event gefahren, genau dem Ausschnitt der Schnittstelle, den der
// Produktcode liest. Das ist die Nachbildung der VORRICHTUNG, nicht des Prüflings.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_OPEN_ATTR } from "../../apps/web/src/lib/editorFigures";
import { insertImageSrcHtml, sanitizeHtml } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as serverSanitize } from "../../services/structure";
import {
  beschreibungsText,
  beschreibungsfeldOffen,
  mitBildbeschreibung,
  schreibeBeschreibung,
} from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TINY = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
// Der Altbestand: genau das, was heute in Entwürfen und Beiträgen steht, die Klara geliefert hat
// oder die vor mega88 über Dateiauswahl/Drop/Einfügen entstanden sind.
const ALTBESTAND = `<h2>Befund</h2><p>Vor dem Ausbau:</p>${insertImageSrcHtml(TINY, "Führungsschiene")}`;
const BESCHREIBUNG = "Riefen in Laufrichtung bei Schmiermangel";

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

afterEach(() => {
  const r = root;
  if (r) {
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

function flaeche(): HTMLElement {
  if (!container) {
    throw new Error("Die Fläche wurde nicht gemountet");
  }
  return container;
}

function fussnoten(): HTMLElement[] {
  return Array.from(flaeche().querySelectorAll(`figcaption[${CAPTION_OPEN_ATTR}]`));
}

function klickeFussnote(): void {
  const cap = fussnoten()[0];
  if (!cap) {
    throw new Error("Es gibt keine verankerte Fußnote, auf die geklickt werden könnte");
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

describe("AUFTRAG-mega88 Block C: der Altbestand bekommt seinen Anker beim Laden", () => {
  it("ein gespeichertes nacktes Bild ist nach dem Laden beschreibbar", () => {
    expect(ALTBESTAND, "Vorbedingung: der Ausgangs-Body hat keine Fußnote").not.toMatch(
      /<figcaption/,
    );
    mount(ALTBESTAND);
    expect(
      fussnoten().length,
      "Das geladene Bild hat keine verankerte Fußnote bekommen — der Klick des Nutzers liefe wieder ins Leere",
    ).toBe(1);
  });

  it("die Normalisierung SPEICHERT nichts, was der Nutzer nicht geschrieben hat", () => {
    mount(ALTBESTAND);
    // Der Editor hat verankert — aber ohne eine Handlung des Nutzers ist NICHTS emittiert worden.
    expect(lastHtml, "Das Laden allein hat schon einen neuen Wert nach außen geschrieben").toBe(
      ALTBESTAND,
    );
    // Und wenn er schreibt, entsteht die Struktur — nicht ein Text, den er nicht getippt hat.
    klickeFussnote();
    act(() => {
      schreibeBeschreibung(BESCHREIBUNG);
    });
    klick("caption-form-save");
    expect(lastHtml).toMatch(/<figcaption data-image-id="kw-img-[a-z0-9]+-1">/);
    expect(lastHtml).toContain(BESCHREIBUNG);
    expect(lastHtml, "Ein Platzhalter ist als Inhalt gespeichert worden").not.toContain("✎");
  });

  it("der Kreis schließt sich: schreiben, sichern, ERNEUT LESEN", () => {
    mount(ALTBESTAND);
    klickeFussnote();
    act(() => {
      schreibeBeschreibung(BESCHREIBUNG);
    });
    klick("caption-form-save");

    // Der echte Weg über die Persistenzgrenze: emit() ist schon durch den Client-Sanitizer, der
    // Server sanitisiert autoritativ beim Speichern, der Client beim Laden.
    const gespeichert = serverSanitize(lastHtml);
    const geladen = sanitizeHtml(gespeichert);
    expect(geladen, "Die Beschreibung hat den Speicherweg nicht überlebt").toContain(BESCHREIBUNG);

    // Und jetzt wirklich ERNEUT LESEN — frischer Editor, geladener Wert.
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
    mount(geladen);

    expect(fussnoten().length).toBe(1);
    expect(fussnoten()[0]?.textContent ?? "").toContain(BESCHREIBUNG);
    // …und sie ist weiterhin bedienbar, nicht bloß sichtbar.
    klickeFussnote();
    expect(beschreibungsfeldOffen(), "Das Formular öffnet nach dem Wiederlesen nicht mehr").toBe(
      true,
    );
    expect(beschreibungsText()).toBe(BESCHREIBUNG);
  });
});

describe("AUFTRAG-mega88 Block B: der EINFÜGE-Weg läuft durch dieselbe Invariante", () => {
  it("ein eingefügter Ausschnitt mit nacktem <img> bekommt seinen Anker", () => {
    mount("<p>Vorher</p>");
    expect(fussnoten().length).toBe(0);
    fuegeEin(`<p>Aus Word</p><img src="${TINY}" alt="Lager">`);
    expect(
      fussnoten().length,
      "Das eingefügte Bild ist ohne Fußnote geblieben — genau der Ship-Blocker",
    ).toBe(1);
    klickeFussnote();
    expect(beschreibungsfeldOffen()).toBe(true);
  });

  it("ein eingefügter Ausschnitt MIT vorhandener Fußnote wird nicht doppelt umhüllt", () => {
    mount("<p>Vorher</p>");
    fuegeEin(
      `<figure><img src="${TINY}" data-image-id="kw-img-abc123-1"><figcaption data-image-id="kw-img-abc123-1">Schon beschrieben</figcaption></figure>`,
    );
    expect(fussnoten().length).toBe(1);
    expect(Array.from(flaeche().querySelectorAll("figure")).length).toBe(1);
    // Die mitgebrachte Kennung bleibt — sonst verlöre eine offene Bitte der Galerie ihr Ziel.
    expect(fussnoten()[0]?.getAttribute("data-image-id")).toBe("kw-img-abc123-1");
  });
});

describe("AUFTRAG-mega88 Block C: die Aktion läuft nie mehr lautlos ins Leere", () => {
  it("der Knopf der Bild-Werkzeugleiste antwortet — mit dem Formular oder mit dem Grund", () => {
    mount(ALTBESTAND);
    // Der Weg, den Pedi genommen hat: erst das BILD anklicken, dann den Knopf.
    const img = flaeche().querySelector("img");
    if (!(img instanceof HTMLElement)) {
      throw new Error("Kein Bild im Editor");
    }
    act(() => {
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    klick("caption-form-open");

    const formular = beschreibungsfeldOffen();
    const hinweis = flaeche().querySelector('[data-testid="editor-anchor-notice"]') !== null;
    expect(
      formular || hinweis,
      "Der Knopf war sichtbar und hat NICHTS getan — weder Formular noch Grund. Das ist der Auslieferungsblocker aus mega87/mega88.",
    ).toBe(true);
    // Mit der Invariante ist es das Formular; ohne sie wäre es der Hinweis. Beides ist eine Antwort,
    // und genau das ist die Zusage dieses Falls.
    expect(formular, "Mit der Bildstruktur-Invariante muss es das FORMULAR sein").toBe(true);
  });

  it("der ehrliche Restfall ist in allen drei Sprachen da (DE/EN/NL, echte Umlaute)", () => {
    const de = i18n.getFixedT("de")("editor.captionNoAnchor");
    const en = i18n.getFixedT("en")("editor.captionNoAnchor");
    const nl = i18n.getFixedT("nl")("editor.captionNoAnchor");
    for (const [sprache, text] of [
      ["de", de],
      ["en", en],
      ["nl", nl],
    ] as const) {
      expect(text, `${sprache}: der Text fehlt oder ist der Schlüssel`).not.toBe(
        "editor.captionNoAnchor",
      );
      expect(text.length, `${sprache}: der Text ist leer`).toBeGreaterThan(10);
    }
    expect(new Set([de, en, nl]).size, "Zwei Sprachen tragen denselben Text").toBe(3);
    expect(de, "Die deutsche Fassung hat keine echten Umlaute").toMatch(/[äöüß]/);
  });
});
