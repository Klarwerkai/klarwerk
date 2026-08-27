// @vitest-environment jsdom
// ================================================================================================
// JOB 2402 · D1 — TV1 SCHEIBE (b): DER TITELVORSCHLAG WIRD SICHTBAR, MIT EHRLICHEM NEGATIVFALL.
// ================================================================================================
//
// WAS VORHER STAND: Scheibe (a) ist gebaut (JOB 2395) — `titelVorschlag` reist von der Ableitung
// bis in den Rückgabewert von `useImageDescribe().describe()`. Gemessen, bewacht, grün. Und in
// KEINER `.tsx` gelesen: `grep -rn "titelVorschlag" --include='*.tsx' apps/web/src` = 0 Treffer.
// Eine fertige Ableitung, die kein Mensch je sah.
//
// DER NEGATIVFALL IST DER KERN, nicht das Beiwerk. Ein Titelvorschlag, der bei fehlender Ableitung
// etwas Erfundenes oder einen leeren Platzhalter zeigt, ist schlimmer als gar keiner — dieselbe
// Klasse wie W11 und wie der Bildverlust-Satz: eine Fläche, die etwas behauptet, das nicht
// passiert. Der Server sendet das Feld ausschliesslich im Erfolgsfall
// (`services/reasoner/src/service.ts`, `mitTitelVorschlag`); „kein Vorschlag" kommt als ABWESENHEIT
// an. Die Fläche muss das SAGEN, nicht verschweigen und nicht ausschmücken.
//
// VORSCHLAG, NICHT GESETZTER TITEL. KA6 Stufe 1 hat die Unterscheidung gebaut („erscheint als
// Vorschlag und wird erst auf Klick eingefügt"); dieselbe Bauart gilt hier. Der dritte Fall unten
// prüft genau das: VOR dem Klick darf nichts übernommen worden sein.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (Default-Sprache de).
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { mitBildbeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EINE_FIGUR =
  '<figure><img src="data:image/png;base64,AAAA"><figcaption data-image-id="kw-a">A</figcaption></figure>';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Host({
  antwort,
  onTitelVorschlag,
}: {
  antwort: DescribeImageResult;
  onTitelVorschlag?: (titel: string) => void;
}) {
  const [value, setValue] = useState(EINE_FIGUR);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      onChange: setValue,
      documentTitle: "Wartungsnotiz",
      ...(onTitelVorschlag ? { onTitelVorschlag } : {}),
    }),
    async () => antwort,
  );
}

function mount(antwort: DescribeImageResult, onTitelVorschlag?: (titel: string) => void): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(Host, { antwort, ...(onTitelVorschlag ? { onTitelVorschlag } : {}) }),
    );
  });
}

function caption(imageId: string): HTMLElement {
  const cap = container.querySelector(`figcaption[data-image-id="${imageId}"]`);
  if (!(cap instanceof HTMLElement)) {
    throw new Error(`figcaption ${imageId} nicht gerendert`);
  }
  return cap;
}

function marke(testid: string): HTMLElement | null {
  const el = container.querySelector(`[data-testid="${testid}"]`);
  return el instanceof HTMLElement ? el : null;
}

/** Fußnote anklicken → Formular öffnet → Vorschlag anfordern → Antwort ist da. */
async function vorschlagAnfordern(): Promise<void> {
  act(() => {
    caption("kw-a").dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

describe("JOB 2402 · TV1 Scheibe (b) — der Titelvorschlag auf der Fläche", () => {
  it("POSITIV: ein abgeleiteter Titel erscheint als eigener, erkennbarer Vorschlag", async () => {
    mount({
      text: "Ein Kegelradgetriebe. Daneben liegt ein Schlüssel.",
      demo: false,
      titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
    });

    await vorschlagAnfordern();

    const block = marke("caption-form-title-suggestion");
    expect(block, "der Titelvorschlag braucht eine eigene Fläche").not.toBeNull();
    expect(block?.textContent ?? "").toContain("Ein Kegelradgetriebe");
    // Und der ehrliche Negativsatz darf dann NICHT dastehen — sonst wäre er ein Dauerschild.
    expect(marke("caption-form-title-none")).toBeNull();
  });

  it("VORSCHLAG, NICHT GESETZT: übernommen wird erst auf Klick, mit genau dem Titel", async () => {
    const uebernommen = vi.fn();
    mount(
      {
        text: "Ein Kegelradgetriebe. Daneben liegt ein Schlüssel.",
        demo: false,
        titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
      },
      uebernommen,
    );

    await vorschlagAnfordern();

    // VOR dem Klick: nichts übernommen. Das ist die KA6-Unterscheidung.
    expect(uebernommen, "ein Vorschlag setzt nichts von allein").not.toHaveBeenCalled();

    const knopf = marke("caption-form-title-adopt");
    expect(knopf, "ohne Knopf gäbe es keinen Weg, den Vorschlag zu nehmen").not.toBeNull();
    await act(async () => {
      (knopf as HTMLButtonElement).click();
    });

    expect(uebernommen).toHaveBeenCalledTimes(1);
    expect(uebernommen).toHaveBeenCalledWith("Ein Kegelradgetriebe");
  });

  it("NEGATIV EHRLICH: ohne ableitbaren Titel steht da, dass es keinen gibt — kein Platzhalter", async () => {
    // Der Server lässt das Feld weg; das ist der einzige Negativfall, den es auf dem Draht gibt.
    mount({ text: "Ein unscharfes Bild ohne erkennbaren Gegenstand.", demo: false }, vi.fn());

    await vorschlagAnfordern();

    const satz = marke("caption-form-title-none");
    expect(satz, "Schweigen wäre hier eine Lücke, kein Ergebnis").not.toBeNull();
    // Ein echter Satz, kein leeres Kästchen und kein Bindestrich.
    expect((satz?.textContent ?? "").trim().length).toBeGreaterThan(10);
    // Und kein Vorschlagsblock, kein Übernehmen-Knopf — es gibt nichts zu übernehmen.
    expect(marke("caption-form-title-suggestion")).toBeNull();
    expect(marke("caption-form-title-adopt")).toBeNull();
  });

  it("KEIN ERFUNDENER TITEL: die Bildbeschreibung wird nicht als Titel ausgegeben", async () => {
    // Die naheliegende Fehlbauart: bei fehlender Ableitung den Beschreibungstext kürzen und als
    // Titel anbieten. Das wäre eine erfundene Behauptung — genau das, was §5 Punkt 2 verbietet.
    mount({ text: "Ein unscharfes Bild ohne erkennbaren Gegenstand.", demo: false }, vi.fn());

    await vorschlagAnfordern();

    // Der scharfe Teil: es darf ueberhaupt KEIN Vorschlagsblock entstehen. Ohne diese Zeile waere
    // der Fall unter genau der Fehlbauart gruen, gegen die er steht — der erfundene Titel stuende
    // im Vorschlagsblock, und die Suche im (dann fehlenden) Negativsatz liefe ins Leere.
    expect(
      marke("caption-form-title-suggestion"),
      "ohne Ableitung darf kein Vorschlag entstehen — auch kein gekuerzter Beschreibungstext",
    ).toBeNull();
    // Nur der TITELBEREICH darf die Beschreibung nicht tragen. Im Panel darueber steht sie zu
    // Recht — sie IST der Beschreibungsvorschlag. Eine Suche ueber den ganzen Container waere hier
    // falsch und hat diesen Fall beim ersten Versuch zu Recht rot gemacht.
    expect(marke("caption-form-title-none")?.textContent ?? "").not.toContain(
      "Ein unscharfes Bild",
    );
  });
});
