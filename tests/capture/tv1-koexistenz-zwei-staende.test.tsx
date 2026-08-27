// @vitest-environment jsdom
// ================================================================================================
// JOB 2604 · D1 — ZWEI ARBEITSSTÄNDE IN EINER DATEI, UND BEIDE MÜSSEN HALTEN.
// ================================================================================================
//
// WORUM ES GEHT. Drei Dateien tragen zwei Arbeitsschichten übereinander:
//
//   apps/web/src/components/RichTextEditor.tsx   JOB 2440 (der Anker) + JOB 2489 (die Herkunft)
//   apps/web/src/i18n.ts                         JOB 2402 (die Texte)  + JOB 2489 (die Herkunft)
//   apps/web/src/lib/captionAiSuggest.ts         JOB 2402 (der Vertrag) + JOB 2489 (die Herkunft)
//
// Die gesicherten Fassungen von JOB 2426 D1 und JOB 2440 D1 sind ÄLTER als JOB 2489 D1. Wer sie
// blind einspielt, überschreibt die neuere Arbeit — nicht aus Böswilligkeit, sondern weil die
// Rückgaben nur Hashes nennen und ein Hashvergleich „abweichend" sagt, ohne zu sagen, in welche
// Richtung. Dieser Test hält die neuere Arbeit fest, damit ein solcher Einbau AUFFÄLLT.
//
// ------------------------------------------------------------------------------------------------
// WARUM ES DIESEN TEST BRAUCHT, OBWOHL ZEHN TV1-DATEIEN IM BAUM LIEGEN — GEMESSEN, NICHT VERMUTET
// ------------------------------------------------------------------------------------------------
// Vier Gegenmutationen auf dem heutigen Stand, je eine Schicht, Protokoll in
// `kw-basic3-job2604-d1-arbeit/protokoll_02-gegenmutation.txt`:
//
//   M1  `data-quelle` aus dem Renderer entfernt          → 2 Fälle rot   GEDECKT
//   M3  die beiden Herkunftsschlüssel aus dem Vertrag    → 1 Fall  rot   GEDECKT
//   M4  `caption-form-title-text` aus dem Renderer       → 3 Fälle rot   GEDECKT
//   M2  die beiden HERKUNFTSSÄTZE aus `i18n.ts` entfernt → 0 Fälle rot   **UNGEDECKT**
//
// M2 ist genau der Schaden, den ein blindes Überkopieren der alten `i18n.ts` anrichtet — und er
// blieb still. DER GRUND ist lehrreich: `tv1-rangfolge-mounted.test.tsx:131` prüft die Herkunft mit
// `.trim().length > 10`. Fehlt der Schlüssel, gibt i18next den SCHLÜSSELNAMEN zurück —
// `"editor.titleSuggest.sourceText"`, dreißig Zeichen. Die Längenprüfung hält, der Mensch liest
// einen Rohschlüssel. **Eine Zusicherung über Länge ist keine Zusicherung über Übersetztheit.**
//
// DESHALB PRÜFT DIESER TEST GEGEN DEN SCHLÜSSEL SELBST, nicht gegen eine Länge: Der angezeigte Satz
// muss etwas ANDERES sein als der Schlüssel, unter dem er nachgeschlagen wird. Das ist die einzige
// Form, die nicht mitwandert, wenn jemand die Sprachdatei verliert.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (Default-Sprache de).
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";
import { mitBildbeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGUR =
  '<figure><img src="data:image/png;base64,AAAA"><figcaption data-image-id="kw-a">A</figcaption></figure>';

/** Ein Beitrag mit eigenem Text UND Bild — hier gewinnt der Objekttext (JOB 2489, Rang 1). */
const MIT_TEXT = `<p>Das Getriebe der Pumpe P-12 faellt bei Frost aus. Vorwaermung hilft.</p>${FIGUR}`;
/** Nur das Bild — hier springt der Ersatzweg ein. Beide Ausgänge müssen ihren Satz haben. */
const OHNE_TEXT = FIGUR;

const BILD_MIT_TITEL: DescribeImageResult = {
  text: "Ein Kegelradgetriebe. Daneben liegt ein Schluessel.",
  demo: false,
  titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Host({
  body,
  antwort,
  mitZiel,
}: {
  body: string;
  antwort: DescribeImageResult;
  mitZiel: boolean;
}) {
  const [value, setValue] = useState(body);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      onChange: setValue,
      documentTitle: "",
      ...(mitZiel ? { onTitelVorschlag: () => undefined } : {}),
    }),
    async () => antwort,
  );
}

function mount(body: string, antwort: DescribeImageResult, mitZiel = true): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, { body, antwort, mitZiel }));
  });
}

function marke(testid: string): HTMLElement | null {
  const el = container.querySelector(`[data-testid="${testid}"]`);
  return el instanceof HTMLElement ? el : null;
}

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

describe("JOB 2604 · zwei Arbeitsstaende in einer Datei", () => {
  it("HERKUNFT AUS DEM OBJEKTTEXT: ein uebersetzter Satz, nicht der Schluessel", async () => {
    // DER FALL, DER DIE GEMESSENE LUECKE SCHLIESST (M2). Fehlt `editor.titleSuggest.sourceText` in
    // der Sprachdatei — und genau das taete ein blindes Ueberkopieren der alten `i18n.ts` —, dann
    // steht hier der Schluesselname. Er ist lang genug fuer jede Laengenpruefung und trotzdem
    // unlesbar.
    mount(MIT_TEXT, BILD_MIT_TITEL);
    await vorschlagAnfordern();

    const quelle = marke("caption-form-title-quelle");
    expect(
      quelle,
      "ohne Herkunft ist ein Vorschlag von einem Zufall nicht zu unterscheiden",
    ).not.toBeNull();
    expect(quelle?.getAttribute("data-quelle")).toBe("objekttext");

    const satz = (quelle?.textContent ?? "").trim();
    expect(satz, "die Sprachdatei liefert den Schluessel zurueck statt eines Satzes").not.toBe(
      CAPTION_AI_TEXT.titleSourceText,
    );
    // Und keinen Rohschluessel irgendeiner anderen Form: ein Satz fuer Menschen traegt Leerzeichen
    // und keinen Punkt-getrennten Bezeichner.
    expect(satz, "ein Punkt-getrennter Bezeichner ist kein Satz").not.toMatch(
      /^[a-z][\w]*(\.[\w]+)+$/,
    );
    expect(satz.length, "und er ist wirklich da").toBeGreaterThan(10);
  });

  it("HERKUNFT AUS DEM BILD: auch der Ersatzweg sagt es in Worten", async () => {
    // Die Rangfolge hat zwei Ausgaenge. Ein Test, der nur den ersten prueft, laesst die Haelfte der
    // Zusage ungedeckt — und `titleSourceImage` faellt bei einem Ueberkopieren genauso weg.
    mount(OHNE_TEXT, BILD_MIT_TITEL);
    await vorschlagAnfordern();

    const quelle = marke("caption-form-title-quelle");
    expect(quelle?.getAttribute("data-quelle")).toBe("bild");

    const satz = (quelle?.textContent ?? "").trim();
    expect(satz, "auch der Ersatzweg darf keinen Schluessel zeigen").not.toBe(
      CAPTION_AI_TEXT.titleSourceImage,
    );
    expect(satz, "und die beiden Ausgaenge sagen NICHT dasselbe").not.toBe(
      CAPTION_AI_TEXT.titleSourceText,
    );
    expect(satz.length).toBeGreaterThan(10);
  });

  it("BEIDE STAENDE NEBENEINANDER: der Anker aus 2440 und die Herkunft aus 2489 im selben Block", async () => {
    // DAS IST DER EIGENTLICHE GEGENSTAND DIESES DURCHGANGS. Die Frage des Auftrags lautet: „Traegt
    // beides nebeneinander, oder schliesst es sich aus?" Die Antwort ist ein Verhalten, kein Satz
    // in einer Rueckgabe.
    //
    // Der Anker `caption-form-title-text` (JOB 2440) traegt den Titel ALLEIN — das war sein ganzer
    // Zweck: der umschliessende Block trug auch die Knopfbeschriftung mit. Die Herkunft (JOB 2489)
    // steht DANEBEN, in einem eigenen Element. Zieht jemand eines von beiden in das andere, faellt
    // dieser Fall.
    mount(MIT_TEXT, BILD_MIT_TITEL);
    await vorschlagAnfordern();

    const titel = marke("caption-form-title-text");
    const quelle = marke("caption-form-title-quelle");
    expect(titel, "der Anker aus JOB 2440 fehlt").not.toBeNull();
    expect(quelle, "die Herkunft aus JOB 2489 fehlt").not.toBeNull();

    // Zwei getrennte Elemente, nicht eines im anderen.
    expect(titel?.contains(quelle as Node), "die Herkunft steckt im Titelanker").toBe(false);
    expect(quelle?.contains(titel as Node), "der Titelanker steckt in der Herkunft").toBe(false);

    // Der Anker traegt den Titel und NUR den Titel — nicht die Herkunft, nicht den Knopf.
    const titeltext = (titel?.textContent ?? "").trim();
    expect(titeltext).toBe("Das Getriebe der Pumpe P-12 faellt bei Frost aus");
    expect(titeltext, "der Anker hat die Herkunft mitgemessen").not.toContain(
      (quelle?.textContent ?? "").trim(),
    );

    // Und beide stehen im selben Vorschlagsblock — sie gehoeren zusammen, ohne ineinander zu liegen.
    const block = marke("caption-form-title-suggestion");
    expect(block?.contains(titel as Node)).toBe(true);
    expect(block?.contains(quelle as Node)).toBe(true);
  });

  it("OHNE UEBERNAHME-WEG bleibt die Herkunft trotzdem lesbar", async () => {
    // Die Bauart des Wissens-Studios (JOB 2440): kein `onTitelVorschlag`. Der Knopf faellt weg —
    // die Herkunft darf es NICHT, sonst waere die Flaeche ohne Titelfeld schlechter informiert als
    // die mit. Das ist dieselbe Zusage wie in `tv1-ohne-uebernahmeweg-mounted`, hier fuer die
    // Schicht, die es damals noch nicht gab.
    mount(MIT_TEXT, BILD_MIT_TITEL, false);
    await vorschlagAnfordern();

    expect(marke("caption-form-title-adopt"), "ohne Ziel kein Knopf").toBeNull();
    const quelle = marke("caption-form-title-quelle");
    expect(quelle, "die Herkunft haengt nicht am Uebernahme-Weg").not.toBeNull();
    expect((quelle?.textContent ?? "").trim()).not.toBe(CAPTION_AI_TEXT.titleSourceText);
  });
});
