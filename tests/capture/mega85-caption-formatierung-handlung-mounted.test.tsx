// @vitest-environment jsdom
// AUFTRAG-mega85 Block C — DIE DREI FORMATIERHANDLUNGEN WERDEN AUSGEFÜHRT, NICHT AUFGEZÄHLT.
//
// DER BEFUND (ben, sammel83-mega84, ROT-Punkt 3, vom Kopf nachgezählt): `caption-form-bold`,
// `caption-form-italic` und `caption-form-linebreak` kamen im mega84-Diff siebenmal vor — dreimal
// als `data-testid` im Produktcode, einmal in einer Existenzschleife, dreimal in einer
// Beschriftungstabelle. Acht Klicks gibt es im Diff, KEINEN auf diese drei Knöpfe, und keinen Spion
// auf `document.execCommand`. Wer den `onClick` für Fett entfernt oder „bold" durch „italic"
// ersetzt hätte, wäre grün geblieben. mega84s eigene Selbstanzeige („Block B war nicht rot zuerst")
// hat hier ihren konkreten Beleg.
//
// WAS DIESE DATEI FÄHRT: den Knopf. Der Befehl selbst wird über die eine Naht abgefangen
// (`bildbeschreibung-naht.tsx`), weil jsdom `document.execCommand` gar nicht kennt — geprüft werden
// BEFEHLSNAME und ZIEL. Ein Befehl, der abgeht, während nicht das Beschreibungsfeld den Fokus hat,
// formatierte den Beitrag statt der Bildbeschreibung.
//
// UND BENS ZWEITER HINWEIS: der Rückgabewert des veralteten Aufrufs wurde bis mega84 verworfen.
// `insertLineBreak` ist kein standardisiertes Kommando; ein Browser, der es nicht kennt, meldete
// `false` und der Knopf ↵ tat still NICHTS. Der letzte Fall unten fährt genau das.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import {
  type Befehlsspion,
  befehlsspion,
  beschreibungsfeld,
  mitBildbeschreibung,
  schreibeBeschreibung,
} from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE =
  '<figure><img src="data:image/png;base64,AAAA" data-image-id="kw-a"><figcaption data-image-id="kw-a">Vorhandene Beschreibung</figcaption></figure>';

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let spion: Befehlsspion | null = null;
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
  spion?.abbauen();
  spion = null;
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

// Die drei Fähigkeiten samt dem Befehl, den sie auslösen MÜSSEN. Steht hier ein anderer Name als im
// Produktcode, ist einer von beiden falsch — und das ist genau der Punkt.
const FAEHIGKEITEN = [
  { testid: "caption-form-bold", befehl: "bold" },
  { testid: "caption-form-italic", befehl: "italic" },
  { testid: "caption-form-linebreak", befehl: "insertLineBreak" },
] as const;

describe("mega85 Block C: jede der drei Formatierhandlungen wird wirklich ausgeführt", () => {
  for (const faehigkeit of FAEHIGKEITEN) {
    it(`„${faehigkeit.testid}“ löst genau den Befehl „${faehigkeit.befehl}“ im Beschreibungsfeld aus`, () => {
      spion = befehlsspion();
      mount();
      oeffneFormular();
      const feld = beschreibungsfeld();
      spion.aufrufe.length = 0;

      klick(faehigkeit.testid);

      expect(
        spion.aufrufe.map((a) => a.befehl),
        `Der Klick auf ${faehigkeit.testid} hat keinen oder den falschen Formatier-Befehl ausgelöst. Fehlt der onClick, oder steht dort ein anderer Befehlsname?`,
      ).toEqual([faehigkeit.befehl]);
      expect(
        spion.aufrufe[0]?.ziel,
        "Der Befehl ging ab, während NICHT das Beschreibungsfeld den Fokus hatte — er hätte den " +
          "Beitrag formatiert statt der Bildbeschreibung.",
      ).toBe(feld);
    });
  }

  it("die drei Knöpfe sind drei VERSCHIEDENE Befehle (kein Kopierfehler zwischen ihnen)", () => {
    spion = befehlsspion();
    mount();
    oeffneFormular();
    spion.aufrufe.length = 0;
    for (const faehigkeit of FAEHIGKEITEN) {
      klick(faehigkeit.testid);
    }
    const befehle = spion.aufrufe.map((a) => a.befehl);
    expect(befehle).toEqual(FAEHIGKEITEN.map((f) => f.befehl));
    expect(new Set(befehle).size).toBe(3);
  });

  it("was der Nutzer im Feld stehen hat, überlebt eine Formatierhandlung", () => {
    // Der Knopf ruft nach dem Befehl `captionFieldChanged()` — schriebe das den Feldinhalt aus
    // einem veralteten Zustand zurück, verlöre der Nutzer sein Getipptes beim Klick auf B.
    spion = befehlsspion();
    mount();
    oeffneFormular();
    act(() => {
      schreibeBeschreibung("Der <strong>Dichtring</strong> am Ventil");
    });
    klick("caption-form-bold");
    expect(beschreibungsfeld().innerHTML).toContain("<strong>Dichtring</strong>");
  });
});

describe("mega85 Block C: ein Fehlschlag des veralteten Befehls bleibt nicht still", () => {
  it("meldet der Browser für den Umbruch „nicht ausgeführt“, kommt der Umbruch trotzdem", () => {
    // BENS HINWEIS, gefahren: `insertLineBreak` ist nicht standardisiert. Bis mega84 wurde der
    // Rückgabewert verworfen — auf einem Browser ohne dieses Kommando tat der Knopf ↵ NICHTS, und
    // nichts und niemand hat es gemerkt. Jetzt trägt der Umbruch über den Weg, den dieser Editor
    // für Einfügungen ohnehin schon benutzt (SCRUM-456: per Range statt execCommand).
    spion = befehlsspion(() => false);
    mount();
    oeffneFormular();
    act(() => {
      schreibeBeschreibung("Erste Zeile");
    });

    klick("caption-form-linebreak");

    expect(
      beschreibungsfeld().innerHTML,
      "Der Browser hat den Umbruch-Befehl abgelehnt, und der Knopf hat still nichts getan — " +
        "genau der Fehlschlag, den der verworfene Rückgabewert unsichtbar gemacht hat.",
    ).toContain("<br>");
  });

  it("der Umbruch landet auch im gespeicherten Dokument", () => {
    spion = befehlsspion(() => false);
    mount();
    oeffneFormular();
    act(() => {
      schreibeBeschreibung("Erste Zeile");
    });
    klick("caption-form-linebreak");
    act(() => {
      (flaeche().querySelector('[data-testid="caption-form-save"]') as HTMLElement).click();
    });
    expect(lastHtml).toContain("<br>");
  });

  it("eine Umgebung ganz OHNE execCommand lässt den Knopf nicht abstürzen", () => {
    // jsdom kennt `document.execCommand` nicht; ohne Spion wirft der Aufruf. Der Knopf darf davon
    // nicht mit in den Abgrund gerissen werden — er behandelt das wie ein „nicht ausgeführt“.
    mount();
    oeffneFormular();
    act(() => {
      schreibeBeschreibung("Erste Zeile");
    });
    expect(() => klick("caption-form-linebreak")).not.toThrow();
    expect(beschreibungsfeld().innerHTML).toContain("<br>");
  });
});
