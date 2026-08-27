// @vitest-environment jsdom
// ================================================================================================
// JOB 2440 · D1 — TV1: DIE FLÄCHE OHNE ÜBERNAHME-WEG MUSS TROTZDEM EHRLICH SEIN.
// ================================================================================================
//
// WAS DIESER TEST TRÄGT — und warum er nachgereicht wird: In JOB 2426 habe ich `KnowledgeInputStudio`
// als BEGRÜNDETE AUSNAHME bilanziert. Die Begründung steht im Wortlaut in `OHNE_UEBERNAHME`
// (`tests/app/tv1-reichweite-einbindungen.test.tsx`) und endet mit dem Satz: „Der Vorschlag bleibt
// im Studio LESBAR." **Genau dieser Satz hatte keinen Beleg.** Er stimmte — der Negativsatz und der
// Vorschlagsblock hängen in `RichTextEditor.tsx:1909-1940` NICHT am Callback, nur der Knopf tut das
// (`:1928`) — aber er stimmte durch Quelltextlesen, und darauf ruhte eine Bilanzzeile.
//
// GEMESSEN VOR DEM BAU: Von den vier Fällen in `tv1-titelvorschlag-mounted.test.tsx` übergibt JEDER
// einen Callback (`vi.fn()`). Das `toBeNull()` auf den Knopf dort (:158) ist der Fall OHNE
// ABLEITUNG, nicht der Fall OHNE ZIEL. Keine Zeile im Baum mountete den Editor so, wie das Studio
// ihn einbindet.
//
// DIE FEHLBAUART, GEGEN DIE ER STEHT, ist nicht theoretisch: Der Negativsatz und der Vorschlagsblock
// stehen HEUTE ausserhalb des `onTitelVorschlag`-Zweigs. Sie eine Ebene nach innen zu ziehen sähe
// wie Aufräumen aus („der ganze Titelbereich gehört doch zusammen") und wäre unsichtbar — das
// Studio zeigte danach schweigend gar nichts mehr, und keine Zusicherung im Baum würde rot.
// Die Ausnahme wäre still zur Lücke geworden, und die Bilanz aus 2426 hätte weiter ERLEDIGT gesagt.
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

const MIT_TITEL: DescribeImageResult = {
  text: "Ein Kegelradgetriebe. Daneben liegt ein Schlüssel.",
  demo: false,
  titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
};

const OHNE_TITEL: DescribeImageResult = {
  text: "Ein unscharfes Bild ohne erkennbaren Gegenstand.",
  demo: false,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/**
 * WORTGLEICH mit `apps/web/src/components/KnowledgeInputStudio.tsx:363 ff.`: `documentTitle` geht
 * hinein (nur lesend, fuer den Dokumentkontext), ein `onTitelVorschlag` gibt es dort NICHT. Wird
 * `zielFehlt` gesetzt, mountet dieser Test genau diese Bauart.
 */
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

/**
 * Was der Titelbereich nach einer Ableitung zeigt — als Text, damit Faelle vergleichbar sind.
 *
 * `titeltext` liest bewusst `caption-form-title-text` und NICHT den umschliessenden Block: dessen
 * `textContent` traegt die Knopfbeschriftung mit, und der Vergleichsfall unten wurde beim ersten
 * Lauf genau daran rot („expected 'TitelvorschlagEin Kegelradgetriebe' to be
 * 'TitelvorschlagEin KegelradgetriebeAls…'"). Der Fehler lag bei mir, nicht am Produkt — die
 * Rueckgabe weist ihn aus, und der Anker in `RichTextEditor.tsx` ist die Lehre daraus.
 */
function titelbereich(): {
  negativsatz: string | null;
  vorschlag: string | null;
  titeltext: string | null;
  knopf: boolean;
} {
  return {
    negativsatz: marke("caption-form-title-none")?.textContent?.trim() ?? null,
    vorschlag: marke("caption-form-title-suggestion")?.textContent?.trim() ?? null,
    titeltext: marke("caption-form-title-text")?.textContent?.trim() ?? null,
    knopf: marke("caption-form-title-adopt") !== null,
  };
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("JOB 2440 · TV1 — die Flaeche ohne Uebernahme-Weg (Bauart KnowledgeInputStudio)", () => {
  it("NEGATIV OHNE ZIEL: der ehrliche Satz steht auch dort, wo es nichts zu uebernehmen gibt", async () => {
    // Der Fall, der die Ausnahme traegt. Ohne Uebernahme-Knopf ist der Negativsatz das EINZIGE,
    // was der Titelbereich hier noch sagen kann — faellt er weg, schweigt die Flaeche.
    mount(OHNE_TITEL);

    await vorschlagAnfordern();

    const b = titelbereich();
    expect(b.negativsatz, "Schweigen waere hier eine Luecke, kein Ergebnis").not.toBeNull();
    expect((b.negativsatz ?? "").length, "ein echter Satz, kein Bindestrich").toBeGreaterThan(10);
    expect(b.vorschlag, "ohne Ableitung darf kein Vorschlag entstehen").toBeNull();
    expect(b.knopf, "und ohne Ziel erst recht kein Knopf").toBe(false);
  });

  it("POSITIV OHNE ZIEL: der Vorschlag bleibt LESBAR — nur der Knopf fehlt", async () => {
    // Das ist der Satz aus meiner eigenen Ausnahme-Begruendung in JOB 2426, hier zum ersten Mal
    // als Verhalten belegt statt aus dem Quelltext geschlossen.
    mount(MIT_TITEL);

    await vorschlagAnfordern();

    const b = titelbereich();
    expect(b.vorschlag, "der abgeleitete Titel muss auch ohne Knopf zu sehen sein").not.toBeNull();
    expect(b.titeltext, "und zwar als Text, nicht nur als Kasten").toBe("Ein Kegelradgetriebe");
    // KEIN Knopf: eine Schaltflaeche, die nichts bewirkt, waere eine Scheinwahl — dieselbe Klasse
    // von Fehler, gegen die diese ganze Reihe gebaut ist.
    expect(b.knopf, "ein Knopf ohne Ziel waere eine Scheinwahl").toBe(false);
    // Und der Negativsatz darf dann NICHT dastehen, sonst waere er ein Dauerschild.
    expect(b.negativsatz).toBeNull();
  });

  it("DER EINZIGE UNTERSCHIED IST DER KNOPF: mit Ziel und ohne Ziel sagen dasselbe", async () => {
    // Die schaerfste Form der Zusicherung. Sie prueft nicht zwei Zustaende einzeln, sondern die
    // BEZIEHUNG: was der Titelbereich SAGT, haengt an der Ableitung — nicht daran, ob die
    // einbindende Flaeche ein Titelfeld hat. Zieht jemand den Text in den Callback-Zweig, faellt
    // dieser Fall, auch wenn beide Einzelfaelle fuer sich noch plausibel aussaehen.
    mount(MIT_TITEL);
    await vorschlagAnfordern();
    const ohneZiel = titelbereich();
    act(() => {
      root.unmount();
    });
    container.remove();

    mount(MIT_TITEL, vi.fn());
    await vorschlagAnfordern();
    const mitZiel = titelbereich();

    expect(ohneZiel.titeltext, "derselbe Vorschlagstext, mit Ziel wie ohne").toBe(
      mitZiel.titeltext,
    );
    expect(ohneZiel.negativsatz).toBe(mitZiel.negativsatz);
    // Und der eine erlaubte Unterschied, ausdruecklich benannt:
    expect(ohneZiel.knopf).toBe(false);
    expect(mitZiel.knopf).toBe(true);
  });
});
