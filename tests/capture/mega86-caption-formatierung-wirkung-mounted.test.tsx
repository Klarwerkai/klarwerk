// @vitest-environment jsdom
// AUFTRAG-mega86 Block B — FETT UND KURSIV BIS ZUR SICHTBAREN WIRKUNG.
//
// DER BEFUND (ben, sammel84-mega85, GELB — und er trägt): mega85 pinnte für fett und kursiv nur den
// AUFRUF von `document.execCommand`. Der Spion lieferte `true` und veränderte kein DOM; der Fall
// „was der Nutzer im Feld stehen hat" startete mit bereits vorhandenem `<strong>` und bewies damit
// gerade NICHT, dass der Klick die Auswahl formatiert. Meldete ein Browser `false` oder fehlte
// `execCommand`, tat der Produktcode sichtbar nichts — ohne Rückfall und ohne Hinweis. Beim
// Zeilenumbruch war das seit mega85 geschlossen, bei diesen beiden nicht.
//
// WAS DIESE DATEI ANDERS MACHT — und warum sie neben der mega85-Datei steht statt in ihr:
// mega85 misst den BEFEHL (Name und Ziel), diese hier misst die WIRKUNG (was danach im Feld steht).
// Das sind zwei Aussagen, und die eine ersetzt die andere nicht.
//
//   · Der Ausgangszustand enthält KEIN vorformatiertes Markup — reiner Text. Stünde dort schon ein
//     `<strong>`, bewiese ein `toContain("<strong>")` hinterher nichts.
//   · Es wird WIRKLICH etwas markiert (Range über einen Ausschnitt des Textknotens), und geprüft
//     wird, dass die Auszeichnung um GENAU diese Auswahl steht — nicht irgendwo im Feld.
//   · KEIN Befehlsspion. jsdom kennt `document.execCommand` nicht; der Aufruf wirft, der
//     Produktcode fängt das ab und nimmt den Range-Rückfall. Das ist exakt der Zustand, den ben
//     benannt hat („meldet ein Browser false oder fehlt execCommand"), und er ist hier deterministisch
//     fahrbar, statt einen Browser zu brauchen.
//
// DIE BENANNTE GRENZE: in einem Browser, in dem `execCommand("bold")` trägt, formatiert der Browser
// und nicht dieser Rückfall — dort ist die Wirkung seine Zusage, nicht unsere. Das ist Absicht
// (`RichTextEditor.tsx`, Kommentar an `umschliesseAuswahlMit`): der native Weg hängt in der
// Rückgängig-Kette, und ihn aufzugeben, um den kaputten Fall testbar zu machen, wäre ein schlechter
// Tausch. Belegt ist damit: die Fähigkeit fällt nicht mehr still aus, und wo sie ausfällt, sagt sie es.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";
import {
  beschreibungsfeld,
  mitBildbeschreibung,
  schreibeBeschreibung,
} from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE =
  '<figure><img src="data:image/png;base64,AAAA" data-image-id="kw-a"><figcaption data-image-id="kw-a">Vorhandene Beschreibung</figcaption></figure>';

// Reiner Text, kein Markup — der Ausgangszustand, den der Auftrag verlangt.
const KLARTEXT = "Dichtring am Ventil";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let lastHtml = "";

function Host() {
  const [value, setValue] = useState(FIGURE);
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
}

function mount(): void {
  lastHtml = FIGURE;
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  act(() => {
    r.render(createElement(Host));
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

function oeffneFormular(): void {
  const cap = flaeche().querySelector("figcaption");
  act(() => {
    (cap as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

// Was der Nutzer mit der Maus tut: einen Ausschnitt des Feldtextes markieren. Ohne diesen Schritt
// gäbe es nichts zu formatieren — und genau darauf beruhte die Lücke.
function markiere(von: number, bis: number): void {
  const knoten = beschreibungsfeld().firstChild;
  if (!(knoten instanceof Text)) {
    throw new Error(
      "Das Feld trägt keinen einfachen Textknoten — der Ausgangszustand stimmt nicht",
    );
  }
  const bereich = document.createRange();
  bereich.setStart(knoten, von);
  bereich.setEnd(knoten, bis);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(bereich);
}

function hinweis(): string | null {
  return flaeche().querySelector('[data-testid="caption-form-format-hint"]')?.textContent ?? null;
}

// Je Fähigkeit ihr Tag. Die Gegenmutationen unten zerlegen genau eine Zeile davon.
const FAEHIGKEITEN = [
  { testid: "caption-form-bold", tag: "strong" },
  { testid: "caption-form-italic", tag: "em" },
] as const;

describe("mega86 Block B: der Klick formatiert die AUSWAHL, nicht nur den Befehlsnamen", () => {
  for (const f of FAEHIGKEITEN) {
    it(`„${f.testid}“ legt <${f.tag}> um genau das Markierte`, () => {
      mount();
      oeffneFormular();
      act(() => {
        schreibeBeschreibung(KLARTEXT);
      });
      // Vorbedingung, sonst bewiese der Fall nichts: es steht noch keine Auszeichnung im Feld.
      expect(beschreibungsfeld().innerHTML).toBe(KLARTEXT);

      markiere(0, "Dichtring".length);
      klick(f.testid);

      const vorwurf = `Der Klick auf ${f.testid} hat die Auswahl nicht ausgezeichnet.`;
      expect(
        beschreibungsfeld().innerHTML,
        `${vorwurf} Genau das war bis mega85 unbelegt: der Befehl ging ab, das DOM blieb, wie es war.`,
      ).toBe(`<${f.tag}>Dichtring</${f.tag}> am Ventil`);
      // Nicht mehr als die Auswahl: „am Ventil" bleibt unausgezeichnet.
      expect(beschreibungsfeld().innerHTML).not.toContain(`<${f.tag}>Dichtring am Ventil`);
      // Und der gelungene Weg schweigt — der Hinweis gehört nur zum Ausfall.
      expect(hinweis()).toBeNull();
    });

    it(`der gespeicherte Wert trägt <${f.tag}> bis in das Dokument`, () => {
      mount();
      oeffneFormular();
      act(() => {
        schreibeBeschreibung(KLARTEXT);
      });
      markiere(0, "Dichtring".length);
      klick(f.testid);
      act(() => {
        (flaeche().querySelector('[data-testid="caption-form-save"]') as HTMLElement).click();
      });
      expect(
        lastHtml,
        "Die Auszeichnung überlebt den Speicherpfad nicht — das Feld verspricht dann etwas, was " +
          "das Dokument nicht hält.",
      ).toContain(`<${f.tag}>Dichtring</${f.tag}>`);
    });
  }

  it("die beiden Fähigkeiten legen VERSCHIEDENE Tags (kein Kopierfehler zwischen ihnen)", () => {
    mount();
    oeffneFormular();
    act(() => {
      schreibeBeschreibung(KLARTEXT);
    });
    markiere(0, "Dichtring".length);
    klick("caption-form-bold");
    expect(beschreibungsfeld().innerHTML).toContain("<strong>");
    expect(beschreibungsfeld().innerHTML).not.toContain("<em>");
  });
});

describe("mega86 Block B, dritter Fall: ein wirkungsloser Klick bleibt nicht stumm", () => {
  for (const f of FAEHIGKEITEN) {
    it(`ohne Markierung sagt „${f.testid}“ dem Nutzer den Grund`, () => {
      mount();
      oeffneFormular();
      act(() => {
        schreibeBeschreibung(KLARTEXT);
      });
      // KEINE Markierung: weder execCommand (fehlt hier) noch der Range-Rückfall können etwas tun.
      window.getSelection()?.removeAllRanges();

      klick(f.testid);

      expect(beschreibungsfeld().innerHTML).toBe(KLARTEXT);
      expect(
        hinweis(),
        "Der Knopf hat nichts bewirkt UND nichts gesagt — genau der Ausfall, den man nicht sieht.",
      ).toBe(i18n.t(CAPTION_AI_TEXT.formSelectFirst));
    });
  }

  it("der Hinweis ist angekündigt und verschwindet nach einem gelungenen Klick wieder", () => {
    mount();
    oeffneFormular();
    act(() => {
      schreibeBeschreibung(KLARTEXT);
    });
    window.getSelection()?.removeAllRanges();
    klick("caption-form-bold");
    expect(
      flaeche()
        .querySelector('[data-testid="caption-form-format-hint"]')
        ?.getAttribute("aria-live"),
      "der Hinweis erscheint, ohne dass ein Screenreader ihn mitbekommt",
    ).toBe("polite");

    markiere(0, "Dichtring".length);
    klick("caption-form-bold");
    expect(hinweis(), "der Hinweis bleibt stehen, obwohl es längst geklappt hat").toBeNull();
  });
});
