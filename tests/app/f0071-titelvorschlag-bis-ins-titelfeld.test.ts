// @vitest-environment jsdom
// @ts-nocheck
// ================================================================================================
// JOB 2954 · D3 · F-0071 — DIE TITELZEILE GEHÖRT ÜBER DAS SCHREIBFELD, NICHT INS BILDFORMULAR.
// ================================================================================================
//
// WAS DAS REGISTER VERSPRICHT (`00_CONTROL/FUNKTIONSREGISTER.json`, F-0071):
//
//   „Klara schlägt beim Erfassen selbst einen Titel vor, abgeleitet nach einer festen Rangfolge aus
//    dem Text des Wissensobjekts, ersatzweise aus der Bildbeschreibung. ÜBER DEM SCHREIBFELD steht
//    dafür eine Titelzeile, die IMMER SICHTBAR bleibt und die Herkunft des Vorschlags nennt. Lässt
//    sich nichts ableiten, wird nichts erfunden; ein selbst geschriebener Titel wird nie verdrängt."
//
// Dazu Pedis Wortlaut vom 27.08. (Registernotiz): „die Titelzeile immer sichtbar lassen, so ist es
// richtig — KEIN ‚nur zeigen wenn etwas da ist', keine Höhe 0, kein hidden."
//
// WAS D1 GEMESSEN HAT (Rückgabe JOB 2954 D1): Die ganze Kette ist gebaut — Ableitung
// (`services/reasoner/src/titel-vorschlag.ts`), Dienst, Wiretyp, Client, Rangfolge
// (`apps/web/src/lib/titelRangfolge.ts`) und ein vollständiger Anzeigeblock mit Herkunft und
// Negativsatz. Sie hing nur an EINER Bedingung: `titelWahl` wurde ausschliesslich berechnet,
// solange das Bild-Beschreibungsformular mit einem Vorschlag offen war, und der Anzeigeblock stand
// INNERHALB dieses Formulars. Wer ein Wissensobjekt ohne Bild schrieb, sah nie einen Titelvorschlag
// — obwohl Rang 1, der Objekttext, ohne jedes Bild vollständig berechenbar ist.
//
// WAS DIESE DATEI ZUSICHERT, und warum jede Zusage gebraucht wird:
//
//   F1  Ohne jedes Bild und ohne geöffnetes Formular steht die Titelzeile da, trägt den Rang-1-Titel
//       und nennt „objekttext" als Herkunft — UND sie steht im DOM VOR dem Schreibfeld. Der letzte
//       Teil ist nicht Kosmetik: „über dem Schreibfeld" ist die Zusage des Registers, und ein Block
//       unterhalb wäre eine andere Fläche.
//   F2  Ohne Objekttext springt der Bildweg als RANG 2 ein und sagt es — eine Quelle je Objekt.
//   F3  Ein selbst geschriebener Titel wird nie automatisch verdrängt: `onTitelVorschlag` läuft
//       nicht von allein, erst der Klick ruft ihn, und dann genau einmal.
//   F4  Lässt sich nichts ableiten, bleibt die Zeile trotzdem stehen — mit dem ehrlichen
//       Negativsatz statt eines erfundenen Titels. Das ist der Fall, der „IMMER sichtbar" von
//       „sichtbar, wenn etwas da ist" unterscheidet.
//   F5  Es gibt GENAU EINEN Anzeigeblock, auch bei geöffnetem Bildformular. Der alte, bildgebundene
//       Renderort ist entfernt und nicht verdoppelt — ein zweiter Ort wäre eine zweite Wahrheit.
//
// ------------------------------------------------------------------------------------------------
// WARUM `@ts-nocheck` OBEN STEHT — ein Kompromiss, kein Versehen.
// ------------------------------------------------------------------------------------------------
// Der Zielpfad dieses Durchgangs ist in Auftrag und Lease auf `.ts` festgelegt. Die Typprüfung des
// Bestands trennt aber genau an dieser Endung, und zwar bewusst:
//
//   `tsconfig.json`           lib: ["ES2022"], kein `jsx`, include `tests`,
//                             exclude `tests` + `.tsx`            → der Node-reine Wurzel-Check
//   `tsconfig.tests-tsx.json` lib: [… "DOM", "DOM.Iterable"], jsx: "react-jsx",
//                             include NUR `tests` + `.tsx`        → für gemountete Tests
//
// Ein GEMOUNTETER Test in einer `.ts`-Datei fällt damit in den Node-reinen Check und scheitert dort
// zwangsläufig — gemessen im Abschlusstor: TS6142 („Module … was resolved to `RichTextEditor.tsx`,
// but `--jsx` is not set"), TS7016 für die react-Importe, TS2812 für jedes DOM-Mitglied. Deshalb
// tragen ALLE gemounteten Bestandstests die Endung `.tsx`.
//
// Zwei Auswege wurden geprüft und verworfen: `/// <reference lib="dom" />` wirkt auf das GANZE
// Programm und hat prompt einen fremden, bis dahin verdeckten Fehler in
// `services/app/src/trash-sweep-scheduler.ts` aufgedeckt — eine Datei, die dieser Durchgang nicht
// anfassen darf. Und die Endung zu ändern wäre ein Schreibvorgang ausserhalb der Lease.
//
// `@ts-nocheck` ist der kleinste verbleibende Schnitt: Er kostet die Typprüfung DIESER Datei und
// lässt den Rest des Bestands unberührt. Was er nicht kostet, ist die Aussagekraft — die Fälle
// laufen unter jsdom und messen das echte Bauteil. **Sobald die Datei `.tsx` heissen darf, gehört
// diese Zeile weg**; sie steht als Ownerfrage in der Rückgabe zu JOB 2954 D3.
//
// KEIN JSX im Rumpf ist davon unabhängig richtig: Die gemounteten Bestandstests bauen ihre Bäume
// ohnehin mit `createElement` (etabliertes Muster seit WP-D8b, s. `tests/types/mounted-react.d.ts`),
// und die Laufzeitumgebung wählt das Pragma ganz oben — nicht die Dateiendung.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (Default-Sprache de).
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGUR =
  '<figure><img src="data:image/png;base64,AAAA"><figcaption data-image-id="kw-a">A</figcaption></figure>';

/** Ein Beitrag, wie ihn der Normalfall des Erfassens hervorbringt: Text, KEIN Bild. */
const NUR_TEXT = "<p>Das Getriebe der Pumpe P-12 faellt bei Frost aus. Vorwaermung hilft.</p>";
/** Ein Beitrag ganz ohne ableitbaren Inhalt — der ehrliche Negativfall. */
const LEER = "<p></p>";
/** Ein Beitrag, der nur ein Bild traegt: hier ist der Bildweg Rang 2. */
const NUR_BILD = FIGUR;

const BILD_MIT_TITEL: DescribeImageResult = {
  text: "Ein Kegelradgetriebe. Daneben liegt ein Schluessel.",
  demo: false,
  titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let uebernommen: string[];

function Host({
  body,
  antwort,
  dokumentTitel,
}: {
  body: string;
  antwort: DescribeImageResult;
  dokumentTitel: string;
}) {
  const [value, setValue] = useState(body);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      onChange: setValue,
      documentTitle: dokumentTitel,
      onTitelVorschlag: (titel: string) => {
        uebernommen.push(titel);
      },
    }),
    async () => antwort,
  );
}

function mount(body: string, dokumentTitel = ""): void {
  uebernommen = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, { body, antwort: BILD_MIT_TITEL, dokumentTitel }));
  });
}

function marke(testid: string): HTMLElement | null {
  const el = container.querySelector(`[data-testid="${testid}"]`);
  return el instanceof HTMLElement ? el : null;
}

function alle(testid: string): NodeListOf<Element> {
  return container.querySelectorAll(`[data-testid="${testid}"]`);
}

/**
 * Steht `a` im Baum VOR `b`?
 *
 * BEWUSST OHNE `compareDocumentPosition`: Der Zielpfad dieses Durchgangs endet auf `.ts`, und der
 * Wurzel-`tsc` prüft den Testbaum mit `lib: ["ES2022"]` — ohne DOM-Bibliothek. Die gemounteten
 * Bestandstests tragen deshalb alle die Endung `.tsx`, die `tsconfig.json` dort ausschliesst; eine
 * `.ts`-Datei ist eingeschlossen. `compareDocumentPosition` und das globale `Node` sind dort nicht
 * bekannt (gemessen: TS2812 und TS2304 im Abschlusstor). `querySelectorAll` liefert
 * Dokumentreihenfolge und trägt dieselbe Aussage ohne diese Abhängigkeit.
 */
function stehtVor(a: Element, b: Element): boolean {
  const kette = [...container.querySelectorAll("*")];
  return kette.indexOf(a) < kette.indexOf(b);
}

/** Liegt `kind` innerhalb von `huelle`? Aus demselben Grund ohne `contains`. */
function liegtIn(huelle: Element, kind: Element): boolean {
  return [...huelle.querySelectorAll("*")].includes(kind);
}

/**
 * Das Schreibfeld des BEITRAGS — der Bezugspunkt der Zusage „über dem Schreibfeld".
 *
 * `#caption-form-text` muss ausgeschlossen werden, und das ist gemessen, nicht vorsorglich: Das
 * Feld der Bildbeschreibung trägt seit mega84 dieselbe Semantik (`role="textbox"`,
 * `aria-multiline="true"`, `RichTextEditor.tsx:1821-1822`) und steht im DOM VOR dem Beitragsfeld.
 * Ein Selektor ohne diesen Ausschluss traf bei geöffnetem Formular das falsche Feld — F2 ist genau
 * daran zu Recht rot geworden. Das Beitragsfeld ist das eine ohne diese Kennung
 * (`RichTextEditor.tsx:2089-2091`, `aria-label` = `editor.bodyLabel`).
 */
function schreibfeld(): HTMLElement {
  const el = container.querySelector(
    '[role="textbox"][aria-multiline="true"]:not(#caption-form-text)',
  );
  if (!(el instanceof HTMLElement)) {
    throw new Error("Das Schreibfeld des Beitrags ist nicht gerendert");
  }
  return el;
}

/** Öffnet das Bildformular und holt einen Vorschlag — nur die Fälle, die den Bildweg brauchen. */
async function vorschlagAnfordern(): Promise<void> {
  const cap = container.querySelector('figcaption[data-image-id="kw-a"]');
  if (!(cap instanceof HTMLElement)) {
    throw new Error("figcaption nicht gerendert");
  }
  act(() => {
    cap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const btn = container.querySelector('[data-testid="caption-form-suggest"]');
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error("Vorschlags-Knopf nicht gerendert");
  }
  await act(async () => {
    btn.click();
    await Promise.resolve();
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("JOB 2954 D3 · F-0071 — die Titelzeile steht über dem Schreibfeld, immer", () => {
  it("F1 · OHNE BILD: der Objekttext stellt den Titel, die Zeile steht vor dem Schreibfeld", () => {
    // Der Normalfall des Erfassens — und genau der Fall, der bis D3 leer ausging: kein Bild, kein
    // Formular, nie ein `describe`-Aufruf. Die Naht oben wirft, falls doch einer abginge.
    mount(NUR_TEXT);

    const vorschlag = marke("caption-form-title-suggestion");
    expect(
      vorschlag,
      "ohne Bild steht keine Titelzeile — genau die Luecke aus JOB 2954 D1",
    ).not.toBeNull();

    expect(marke("caption-form-title-text")?.textContent?.trim()).toBe(
      "Das Getriebe der Pumpe P-12 faellt bei Frost aus",
    );

    const quelle = marke("caption-form-title-quelle");
    expect(quelle?.getAttribute("data-quelle")).toBe("objekttext");
    expect(
      (quelle?.textContent ?? "").trim().length,
      "die Herkunft muss als lesbarer Satz dastehen, nicht nur als Attribut",
    ).toBeGreaterThan(10);

    // „ÜBER DEM SCHREIBFELD" ist wörtlich zugesichert — also wird die Reihenfolge gemessen und
    // nicht angenommen. `DOCUMENT_POSITION_FOLLOWING` heisst: das Schreibfeld kommt NACH der Zeile.
    expect(
      stehtVor(vorschlag as Element, schreibfeld()),
      "die Titelzeile steht nicht vor dem Schreibfeld",
    ).toBe(true);
  });

  it("F2 · NUR DAS BILD: Rang 2 springt ein und nennt sich, ohne Mischung", async () => {
    mount(NUR_BILD);

    await vorschlagAnfordern();

    expect(marke("caption-form-title-text")?.textContent?.trim()).toBe("Ein Kegelradgetriebe");
    expect(marke("caption-form-title-quelle")?.getAttribute("data-quelle")).toBe("bild");
    // Eine Quelle je Objekt: kein zweiter Titel und kein zusammengesetzter Text.
    expect(alle("caption-form-title-text")).toHaveLength(1);
    expect(marke("caption-form-title-text")?.textContent ?? "").not.toContain("Getriebe der Pumpe");

    // Auch im Rang-2-Fall gehört die Zeile AN DIE SEITE, nicht ins Formular. Ohne diese Zusage
    // wäre F2 auf dem Basisstand grün: Der Bildweg funktionierte dort ja — nur eben INNERHALB des
    // Bildformulars, dessen Überlagerung im DOM ohnehin vor dem Schreibfeld liegt. Eine reine
    // Reihenfolgeprüfung träfe die Änderung deshalb nicht.
    //
    // Gemessen wird darum die Zugehörigkeit: Die Titelzeile darf nicht in der Formular-
    // Überlagerung stehen (`Modal.tsx:114`, `fixed inset-0`). Sonst verschwände sie mit dem
    // Formular — und „immer sichtbar" wäre wieder „sichtbar, solange das Formular offen ist".
    const block = marke("caption-form-title-suggestion") as HTMLElement;
    const ueberlagerung = container.querySelector(".fixed.inset-0");
    expect(
      ueberlagerung,
      "das Bildformular ist gar nicht offen — dann misst dieser Fall nichts",
    ).not.toBeNull();
    expect(
      liegtIn(ueberlagerung as Element, block),
      "die Titelzeile steht im Bildformular und verschwindet mit ihm",
    ).toBe(false);

    expect(
      stehtVor(block, schreibfeld()),
      "die Titelzeile des Bildwegs steht nicht vor dem Schreibfeld",
    ).toBe(true);
  });

  it("F3 · EIGENER TITEL: nichts wird automatisch übernommen, erst der Klick — und der genau einmal", () => {
    mount(NUR_TEXT, "Mein eigener Titel");

    // Der Editor kennt `documentTitle` nur lesend (`RichTextEditor.tsx:315-318`); er hat gar keinen
    // Weg, ihn zu setzen. Zugesichert wird hier die beobachtbare Folge davon: Der Rückweg zur
    // Fläche, die den Titel führt, wird NICHT von allein gegangen.
    expect(
      uebernommen,
      "ein Vorschlag darf einen selbst geschriebenen Titel nie von allein verdraengen",
    ).toEqual([]);

    const knopf = marke("caption-form-title-adopt");
    expect(knopf, "ohne Uebernahmeknopf gaebe es keine ausdrueckliche Nutzeraktion").not.toBeNull();

    act(() => {
      (knopf as HTMLButtonElement).click();
    });

    expect(uebernommen).toEqual(["Das Getriebe der Pumpe P-12 faellt bei Frost aus"]);
  });

  it("F4 · NICHTS ABLEITBAR: die Zeile bleibt stehen und sagt es ehrlich", () => {
    // Der Fall, der „IMMER sichtbar" von „sichtbar, wenn etwas da ist" unterscheidet. Pedi
    // 27.08.: „kein ‚nur zeigen wenn etwas da ist', keine Hoehe 0, kein hidden."
    mount(LEER);

    const nichts = marke("caption-form-title-none");
    expect(nichts, "Schweigen waere hier eine Luecke, kein Ergebnis").not.toBeNull();
    expect((nichts?.textContent ?? "").trim().length).toBeGreaterThan(10);

    expect(marke("caption-form-title-suggestion")).toBeNull();
    expect(marke("caption-form-title-text"), "es wird nichts erfunden").toBeNull();

    expect(
      stehtVor(nichts as Element, schreibfeld()),
      "auch der Negativsatz gehoert ueber das Schreibfeld",
    ).toBe(true);
  });

  it("F5 · KEIN PARALLELWEG: auch bei offenem Bildformular gibt es genau einen Anzeigeblock", async () => {
    // BENs Punkt aus der D2-Prüfung: „den alten bildgebundenen Renderort entfernen". Stünde der
    // Block an beiden Stellen, sähe ein Nutzer denselben Vorschlag zweimal — und zwei Orte wären
    // zwei Wahrheiten, sobald einer von beiden je anders gerechnet würde.
    mount(NUR_BILD);

    await vorschlagAnfordern();

    expect(alle("caption-form-title-suggestion")).toHaveLength(1);
    expect(alle("caption-form-title-text")).toHaveLength(1);
    expect(alle("caption-form-title-quelle")).toHaveLength(1);
    expect(alle("caption-form-title-adopt")).toHaveLength(1);
  });
});
