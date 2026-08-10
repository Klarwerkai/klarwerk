// @vitest-environment jsdom
// AUFTRAG-mega87 Block A — DIE AUSWAHL ÜBERLEBT DEN KLICK, UND DIE WIRKUNG ENTSCHEIDET.
//
// DER BEFUND (Pedi, am Quelltext nachgemessen — der eine Ship-Blocker aus bens ROT zu mega86). Er
// hat drei Teile, und mega86 hat keinen davon berührt:
//
//   1. Die drei Schaltflächen trugen ausschließlich `onClick`. Im Browser verschiebt schon
//      `mousedown` den Fokus auf die Schaltfläche; `gemerkteAuswahl(el)` lief DANACH und fand nichts
//      mehr. Der Kommentar darüber versprach „GANZ ZUERST, vor jedem Fokuswechsel" — der Code hielt
//      das nicht.
//   2. Der gemerkte Bereich wurde nie ZURÜCKGESTELLT: auf `gemerkteAuswahl` folgte `el.focus()` und
//      dann `execCommand`, das also auf dem arbeitete, was der Browser gerade für ausgewählt hielt.
//   3. Es entschied der RÜCKGABEWERT, nicht die Wirkung. Ein Browser darf `true` melden, ohne etwas
//      zu verändern; dann blieb der Rückfall aus UND der Hinweis wurde auf `null` gesetzt — der
//      stille Ausfall aus bens sammel84, unverändert möglich.
//
// WARUM DIE VORHANDENEN TESTS DAS NICHT SAHEN, und das ist der eigentliche Fortschritt hier:
//   · mega86 klickte mit `knopf.click()`. Das überspringt den `mousedown` und damit den
//     Fokuswechsel — der Test fuhr eine Bedienung, die es im Browser nicht gibt. Diese Datei fährt
//     den Klick so, wie der Browser ihn ausführt (`klickWieBrowser`), und den Tastaturweg dazu.
//   · mega86 fuhr AUSSCHLIESSLICH den Rückfallweg, weil jsdom `execCommand` gar nicht kennt (Sonde:
//     `typeof document.execCommand === "undefined"`). Der Fall „meldet Erfolg und tut nichts" kam
//     darin nicht vor. Er ist hier die erste Zelle.
//
// Die Messungen, auf denen das beruht, stehen in `_relay/messung/mega87-auswahl-sonde.ts`:
// `knopf.focus()` kollabiert die Auswahl (`collapsed: false → true`), ein späteres `feld.focus()`
// holt sie nicht zurück, ein KLON überlebt den Fokuswechsel unversehrt, und `selectionchange` feuert
// in jsdom bei `addRange` null Mal.
//
// WAS DIESE DATEI NICHT BELEGT, und das gehört an den Anfang, damit niemand mehr daraus liest, als
// drinsteht: die beiden Fälle unter „MAUS" und „TASTATUR" belegen, dass der Weg unter jsdoms
// Auswahl-Verhalten trägt — NICHT, dass ein echter Browser ohne sie kaputt wäre. Nachgemessen in
// `_relay/messung/mega87-browser-messung.spec.ts`: Chromium, Firefox und WebKit bewahren die
// Auswahl beim Fokuswechsel auf die Schaltfläche (`collapsed === false`, Text unverändert). jsdom
// ist an genau dieser Stelle die unrealistische Attrappe. Der Fall, der WIRKLICH nur am Produktcode
// hängt und in jeder Engine eintreten kann, ist der erste: „meldet Erfolg und tut nichts".
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";
import {
  type Befehlsspion,
  befehlsspion,
  beschreibungsfeld,
  klickMitTastatur,
  klickWieBrowser,
  markiereMitMaus,
  markiereMitTastatur,
  mitBildbeschreibung,
  schreibeBeschreibung,
} from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE =
  '<figure><img src="data:image/png;base64,AAAA" data-image-id="kw-a"><figcaption data-image-id="kw-a">Vorhandene Beschreibung</figcaption></figure>';

// Reiner Text, kein Markup — sonst bewiese ein `toContain("<strong>")` hinterher nichts.
const KLARTEXT = "Dichtring am Ventil";
const MARKIERT = "Dichtring";

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let spion: Befehlsspion | null = null;

function Host() {
  const [value, setValue] = useState(FIGURE);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: setValue,
    }),
  );
}

function mount(): void {
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

// Formular geöffnet, Feld mit reinem Text gefüllt, Vorbedingung geprüft.
function bereitMitText(): void {
  mount();
  const cap = flaeche().querySelector("figcaption");
  act(() => {
    (cap as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  act(() => {
    schreibeBeschreibung(KLARTEXT);
  });
  expect(
    beschreibungsfeld().innerHTML,
    "Ausgangszustand nicht sauber — im Feld steht schon Auszeichnung",
  ).toBe(KLARTEXT);
}

function hinweis(): string | null {
  return flaeche().querySelector('[data-testid="caption-form-format-hint"]')?.textContent ?? null;
}

const FAEHIGKEITEN = [
  { testid: "caption-form-bold", tag: "strong", befehl: "bold" },
  { testid: "caption-form-italic", tag: "em", befehl: "italic" },
] as const;

// ── 1. Der stille Ausfall: der Befehl meldet Erfolg und verändert nichts ───────────────────────
//
// Das ist die Zelle, die dem heutigen Code fehlt. Sie ist ROT, solange der RÜCKGABEWERT entscheidet,
// und grün, sobald die WIRKUNG entscheidet. Der Spion ist keine Erfindung: `execCommand` ist seit
// Jahren „deprecated", sein Rückgabewert ist in keiner Engine eine Zusage über das DOM, und genau
// diesen Fall hat ben in sammel84 beanstandet.
describe("mega87 Block A: `execCommand` meldet Erfolg und tut nichts", () => {
  for (const f of FAEHIGKEITEN) {
    it(`„${f.testid}“ zeichnet trotzdem aus — der Rückfall hängt an der Wirkung, nicht am Rückgabewert`, () => {
      bereitMitText();
      // Ein Browser, der `true` meldet und das DOM nicht anfasst.
      spion = befehlsspion(() => true);

      act(() => {
        markiereMitMaus(0, MARKIERT.length);
      });
      act(() => {
        klickWieBrowser(f.testid);
      });

      expect(
        spion.aufrufe.map((a) => a.befehl),
        "der native Weg wird weiterhin ZUERST gefragt — er hängt dort, wo er trägt, in der " +
          "nativen Rückgängig-Kette",
      ).toEqual([f.befehl]);
      expect(
        beschreibungsfeld().innerHTML,
        `Der Befehl meldete Erfolg und veränderte nichts, und ${f.testid} hat sich darauf verlassen: keine Auszeichnung, kein Rückfall, kein Hinweis. Genau der Ausfall, den man nicht sieht.`,
      ).toBe(`<${f.tag}>${MARKIERT}</${f.tag}> am Ventil`);
      expect(hinweis(), "der gelungene Weg schweigt").toBeNull();
    });
  }

  it("meldet der Befehl Erfolg und wirkt WIRKLICH, bleibt der Rückfall aus (keine doppelte Auszeichnung)", () => {
    bereitMitText();
    // Ein Browser, der tut, was er sagt: er zeichnet aus und meldet `true`.
    spion = befehlsspion((befehl) => {
      if (befehl === "bold") {
        const sel = window.getSelection();
        const bereich = sel?.getRangeAt(0);
        const huelle = document.createElement("strong");
        huelle.appendChild(bereich?.extractContents() as DocumentFragment);
        bereich?.insertNode(huelle);
      }
      return true;
    });

    act(() => {
      markiereMitMaus(0, MARKIERT.length);
    });
    act(() => {
      klickWieBrowser("caption-form-bold");
    });

    expect(
      beschreibungsfeld().innerHTML,
      "Der Rückfall ist zusätzlich gelaufen und hat ein zweites Mal umschlossen — die Wirkung " +
        "wurde nicht gemessen, sondern angenommen.",
    ).toBe(`<strong>${MARKIERT}</strong> am Ventil`);
  });

  it("der native Befehl arbeitet auf DEM, was der Nutzer markiert hat (Bereich wiederhergestellt)", () => {
    bereitMitText();
    let gesehen: string | null = null;
    spion = befehlsspion(() => {
      // Was der Browser im Moment des Aufrufs für ausgewählt hält. Ohne Wiederherstellung ist das
      // leer — der Fokuswechsel hat die Markierung kollabiert.
      gesehen = window.getSelection()?.toString() ?? null;
      return true;
    });

    act(() => {
      markiereMitMaus(0, MARKIERT.length);
    });
    act(() => {
      klickWieBrowser("caption-form-bold");
    });

    expect(
      gesehen,
      "`execCommand` lief auf einer leeren Auswahl: der gemerkte Bereich wurde nie zurückgestellt, " +
        "der native Befehl formatierte also ins Nichts.",
    ).toBe(MARKIERT);
  });
});

// ── 2. Der Mausweg: der Fokuswechsel darf die Auswahl nicht fressen ────────────────────────────
describe("mega87 Block A: die Auswahl überlebt den Klick mit der MAUS", () => {
  for (const f of FAEHIGKEITEN) {
    it(`„${f.testid}“ unterbindet den Fokuswechsel beim mousedown und zeichnet die Auswahl aus`, () => {
      bereitMitText();
      act(() => {
        markiereMitMaus(0, MARKIERT.length);
      });

      const ergebnis: { fokusUnterbunden: boolean }[] = [];
      act(() => {
        ergebnis.push(klickWieBrowser(f.testid));
      });

      expect(
        ergebnis[0]?.fokusUnterbunden,
        "Die Schaltfläche lässt den Fokus wandern. Im Browser ist die Markierung damit weg, bevor " +
          "`onClick` überhaupt läuft — der Knopf formatiert dann nichts.",
      ).toBe(true);
      // Und der Fokus bleibt, wo der Nutzer schreibt: im Feld.
      expect(
        document.activeElement,
        "der Fokus ist auf die Schaltfläche gesprungen statt im Feld zu bleiben",
      ).toBe(beschreibungsfeld());
      expect(beschreibungsfeld().innerHTML).toBe(`<${f.tag}>${MARKIERT}</${f.tag}> am Ventil`);
      expect(hinweis()).toBeNull();
    });
  }
});

// ── 3. Der Tastaturweg: gleichwertig, und es gibt dort KEIN mousedown ──────────────────────────
//
// Der Auftrag verlangt Gleichwertigkeit ausdrücklich. Über die Tastatur wandert der Fokus mit Tab
// auf die Schaltfläche — kein `mousedown`, das man unterbinden könnte. Die Auswahl muss sich das
// Feld also GEMERKT haben, als sie noch da war.
describe("mega87 Block A: der Tastaturweg ist dem Mausweg gleichwertig", () => {
  for (const f of FAEHIGKEITEN) {
    it(`mit Umschalt+Pfeil markiert, mit Tab auf „${f.testid}“, ausgelöst — die Auswahl trägt`, () => {
      bereitMitText();
      act(() => {
        markiereMitTastatur(0, MARKIERT.length);
      });
      act(() => {
        klickMitTastatur(f.testid);
      });

      expect(
        beschreibungsfeld().innerHTML,
        "Über die Tastatur kam die Auswahl nicht an. Der Fokuswechsel per Tab hat sie kollabiert, " +
          "und gemerkt hatte sich das Feld sie nicht — der Tastaturweg wäre damit zweite Klasse.",
      ).toBe(`<${f.tag}>${MARKIERT}</${f.tag}> am Ventil`);
      expect(hinweis()).toBeNull();
    });
  }

  it("auch eine mit der MAUS gesetzte Markierung überlebt den Wechsel per Tab", () => {
    bereitMitText();
    act(() => {
      markiereMitMaus(0, MARKIERT.length);
    });
    act(() => {
      klickMitTastatur("caption-form-bold");
    });
    expect(beschreibungsfeld().innerHTML).toBe(`<strong>${MARKIERT}</strong> am Ventil`);
  });
});

// ── 4. Die Gegenprobe: der Hinweis gehört WEITERHIN nur zum echten Ausfall ─────────────────────
//
// Ohne diese Zelle wäre „gemerkte Auswahl" ein Freibrief: ein Feld, das sich alles merkt, formatiert
// auch dann, wenn der Nutzer die Markierung längst aufgehoben hat. Der Hinweis bleibt die eine
// ehrliche Antwort auf „es war nichts markiert".
describe("mega87 Block A: was nicht markiert ist, wird nicht ausgezeichnet", () => {
  it("nie markiert → der Grund wird gesagt, nichts wird verändert", () => {
    bereitMitText();
    window.getSelection()?.removeAllRanges();
    act(() => {
      klickWieBrowser("caption-form-bold");
    });
    expect(beschreibungsfeld().innerHTML).toBe(KLARTEXT);
    expect(hinweis()).toBe(i18n.t(CAPTION_AI_TEXT.formSelectFirst));
  });

  it("markiert, dann im Feld AUFGEHOBEN → das Gedächtnis hält nicht an einer toten Markierung fest", () => {
    bereitMitText();
    act(() => {
      markiereMitMaus(0, MARKIERT.length);
    });
    // Der Nutzer klickt im Feld weiter — die Markierung ist aufgehoben, der Cursor steht irgendwo.
    act(() => {
      const knoten = beschreibungsfeld().firstChild as Text;
      const leer = document.createRange();
      leer.setStart(knoten, 3);
      leer.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(leer);
      beschreibungsfeld().dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    act(() => {
      klickWieBrowser("caption-form-bold");
    });
    expect(
      beschreibungsfeld().innerHTML,
      "Das Feld hat eine längst aufgehobene Markierung ausgezeichnet — es formatiert Text, den " +
        "der Nutzer gar nicht mehr ausgewählt hat.",
    ).toBe(KLARTEXT);
    expect(hinweis()).toBe(i18n.t(CAPTION_AI_TEXT.formSelectFirst));
  });

  it("eine Markierung AUSSERHALB des Feldes zählt nicht", () => {
    bereitMitText();
    const fremd = document.createElement("p");
    fremd.textContent = "Fremder Text";
    document.body.appendChild(fremd);
    const bereich = document.createRange();
    bereich.selectNodeContents(fremd);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(bereich);

    act(() => {
      klickWieBrowser("caption-form-bold");
    });
    expect(beschreibungsfeld().innerHTML).toBe(KLARTEXT);
    expect(fremd.innerHTML, "der Knopf hat in fremdes DOM geschrieben").toBe("Fremder Text");
    expect(hinweis()).toBe(i18n.t(CAPTION_AI_TEXT.formSelectFirst));
    fremd.remove();
  });
});
