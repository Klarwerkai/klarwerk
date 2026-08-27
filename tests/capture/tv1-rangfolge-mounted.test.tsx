// @vitest-environment jsdom
// ================================================================================================
// JOB 2489 · D1 — TV1 RANG 1: DER OBJEKTTEXT GEWINNT, UND DIE FLÄCHE SAGT ES.
// ================================================================================================
//
// DIE ENTSCHEIDUNG, IM WORTLAUT (`00_CONTROL/ENTSCHEIDUNGEN/JOB-508.md`, Nachtrag 19.08.2026,
// Punkt 2):
//
//   „Die Quelle eines kuenftigen Titelvorschlags ist der Inhalt des Wissensobjekts: der Objekttext,
//    wenn er vorhanden ist; sonst die Bildbeschreibung (`DescribeImageResult`), also der Bildweg.
//    Nicht zwei Vorschlaege, nicht eine Mischung — eine Quelle je Objekt, in dieser Rangfolge."
//
// DER FALL, DER ES ENTSCHEIDET, ist der erste unten: ein Objekt hat BEIDES. Bis JOB 2479 zeigte die
// Flaeche dort den BILDtitel — nicht aus Nachlaessigkeit, sondern weil sie den Objekttext nie zu
// sehen bekam: die Lesung hiess `titelVorschlagAusErgebnis(result: DescribeImageResult)` und KONNTE
// ihn nicht kennen. Das war kein Fehler des Bildwegs; es war die fehlende Haelfte der Entscheidung.
//
// WARUM DIE QUELLE SICHTBAR SEIN MUSS UND NICHT NUR RICHTIG GEWAEHLT: „Eine Quelle je Objekt" ist
// eine Zusage ueber das, was der Mensch sieht. Steht da nur ein Titel, kann niemand — auch kein
// Pruefer — unterscheiden, ob die Rangfolge gegriffen hat oder ob zufaellig beide dasselbe
// ergaben. Ein Vorschlag ohne Herkunft ist von einem Zufall nicht zu unterscheiden; genau so
// begruendet `titel-vorschlag.ts` schon heute, warum der GRUND mitreist.
//
// WAS UNANGETASTET BLEIBT: die vier Ehrlichkeitsgruende des Bildwegs (`vertraulich`, `kein_text`,
// `demo`, `leer`). Der Objekttext bekommt Vorrang, nicht Narrenfreiheit — Fall 3 unten haelt fest,
// dass ohne beide Quellen weiterhin der ehrliche Negativsatz steht und nichts erfunden wird.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (Default-Sprache de).
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { mitBildbeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGUR =
  '<figure><img src="data:image/png;base64,AAAA"><figcaption data-image-id="kw-a">A</figcaption></figure>';

/** Ein Beitrag, der BEIDES traegt: eigenen Text UND ein Bild. Der entscheidende Fall. */
const MIT_TEXT = `<p>Das Getriebe der Pumpe P-12 faellt bei Frost aus. Vorwaermung hilft.</p>${FIGUR}`;
/** Ein Beitrag, der NUR das Bild traegt — hier springt der Ersatzweg ein. */
const OHNE_TEXT = FIGUR;

const BILD_MIT_TITEL: DescribeImageResult = {
  text: "Ein Kegelradgetriebe. Daneben liegt ein Schluessel.",
  demo: false,
  titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
};
const BILD_OHNE_TITEL: DescribeImageResult = {
  text: "Ein unscharfes Bild ohne erkennbaren Gegenstand.",
  demo: false,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Host({ body, antwort }: { body: string; antwort: DescribeImageResult }) {
  const [value, setValue] = useState(body);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      onChange: setValue,
      documentTitle: "",
      onTitelVorschlag: () => undefined,
    }),
    async () => antwort,
  );
}

function mount(body: string, antwort: DescribeImageResult): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, { body, antwort }));
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

describe("JOB 2489 · TV1 Rang 1 — die Rangfolge der Quellen auf der Flaeche", () => {
  it("BEIDES DA: der Objekttext gewinnt, und die Flaeche nennt ihn als Quelle", async () => {
    // DER ENTSCHEIDENDE FALL. Das Bild wuerde „Ein Kegelradgetriebe" hergeben — der Objekttext
    // gewinnt trotzdem, weil die Entscheidung ihm den Vorrang gibt.
    mount(MIT_TEXT, BILD_MIT_TITEL);

    await vorschlagAnfordern();

    expect(marke("caption-form-title-text")?.textContent?.trim()).toBe(
      "Das Getriebe der Pumpe P-12 faellt bei Frost aus",
    );
    // Und ausdruecklich NICHT der Bildtitel — sonst waere die Rangfolge nur behauptet.
    expect(marke("caption-form-title-text")?.textContent ?? "").not.toContain("Kegelradgetriebe");

    const quelle = marke("caption-form-title-quelle");
    expect(
      quelle,
      "ein Vorschlag ohne Herkunft ist von einem Zufall nicht zu unterscheiden",
    ).not.toBeNull();
    expect(quelle?.getAttribute("data-quelle")).toBe("objekttext");
    expect((quelle?.textContent ?? "").trim().length, "und zwar als lesbarer Satz").toBeGreaterThan(
      10,
    );
  });

  it("NUR DAS BILD: ohne Objekttext springt der Ersatzweg ein — und sagt es auch", async () => {
    mount(OHNE_TEXT, BILD_MIT_TITEL);

    await vorschlagAnfordern();

    expect(marke("caption-form-title-text")?.textContent?.trim()).toBe("Ein Kegelradgetriebe");
    const quelle = marke("caption-form-title-quelle");
    expect(quelle?.getAttribute("data-quelle")).toBe("bild");
  });

  it("KEINS VON BEIDEM: der ehrliche Negativsatz bleibt, und keine Quelle wird behauptet", async () => {
    // Die vier Ehrlichkeitsgruende bleiben unangetastet — der Objekttext bekommt Vorrang, nicht
    // Narrenfreiheit.
    mount(OHNE_TEXT, BILD_OHNE_TITEL);

    await vorschlagAnfordern();

    expect(marke("caption-form-title-none"), "Schweigen waere hier eine Luecke").not.toBeNull();
    expect(marke("caption-form-title-suggestion")).toBeNull();
    expect(
      marke("caption-form-title-quelle"),
      "ohne Titel gibt es keine Quelle zu nennen",
    ).toBeNull();
  });
});
