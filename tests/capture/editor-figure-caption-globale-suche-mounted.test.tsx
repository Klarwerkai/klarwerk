import { afterEach, describe, expect, it } from "vitest";
// @vitest-environment jsdom
// ================================================================================================
// JOB 1186 / I50-3 — DER DUBLETTENFALL AN DER *GLOBALEN* SUCHE, NICHT AN DEN HILFSFUNKTIONEN
// ================================================================================================
//
// ben zu JOB 1186 D1, woertlich: „Ein erneuter Test nur von `imageForCaption` oder
// `captionForImage` erfuellt diese Pflicht nicht." Und das trifft: der D1-Fall belegte den
// Ersttreffer in `editorFigures.ts` (`knotenMitKennung`), nicht in der SPAETEREN globalen
// Kennungssuche des Editors. Der Unterschied ist kein Detail — es sind zwei verschiedene Stellen
// mit zwei verschiedenen Mechaniken, und nur die zweite ist hier gemeint.
//
// DIE STELLE, UM DIE ES GEHT — `RichTextEditor.tsx:764-766`:
//     const image = Array.from(el.querySelectorAll("img[data-image-id]")).find(
//       (img) => img.getAttribute("data-image-id") === captionFormRequest.imageId,
//     );
// `Array.prototype.find` nimmt den ERSTEN Treffer. Bei doppelter `data-image-id` entscheidet damit
// die Dokumentreihenfolge, welches Bild das Formular bekommt.
//
// WARUM DIESE DATEI GEMOUNTET IST: `captionFormRequest` ist ein Prop (die Bitte der Galerie,
// mega69 Block A) und nur ueber einen echten Mount erreichbar. Das ist der Preis dafuer, an der
// richtigen Stelle zu messen statt daneben.
//
// WARUM SIE `.tsx` IST UND NICHT `.ts`: der Wurzel-Typpruefer ist Node-rein (`tsconfig.json`:
// `lib: ["ES2022"]`, kein `jsx`, `exclude: [… "tests/**/*.tsx" …]`). Gemountete React-Tests laufen
// durch `tsconfig.tests-tsx.json`, das `tests/**/*.tsx` einschliesst und `DOM` + `jsx` mitbringt.
// Diese Datei liegt deshalb in genau dem Pfad, den diese Konfiguration abdeckt.
//
// Muster und Werkzeug sind unveraendert die des Bestands (`editor-figure-caption-mounted.test.tsx`):
// react/react-dom relativ aus apps/web/node_modules, `createElement` statt JSX-Syntax, kein
// @testing-library — gebraucht werden nur mount/act/dispatch.
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (useTranslation ohne Provider).
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import {
  beschreibungsText,
  beschreibungsfeldOffen,
  mitBildbeschreibung,
} from "./bildbeschreibung-naht";

// React 18: act ausserhalb eines Test-Renderers verlangt dieses Flag.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ZWEI Bilder mit DERSELBEN Kennung — bens Fall. Unterschiedliche Quellen und unterschiedliche
// Fussnoten, damit ueberhaupt UNTERSCHEIDBAR ist, welches der beiden adressiert wurde.
//
// WARUM DIE FUSSNOTEN EIGENE KENNUNGEN TRAGEN — das ist kein Kunstgriff, sondern noetig, und es ist
// nachgemessen: `ensureImageAnchors` (editorFigures.ts) schreibt die Bildkennung auf eine einzelne
// kennungslose Fussnote. Traegen beide Fussnoten danach `kw-img-dup-1`, liefert `captionForImage`
// fuer BEIDE Bilder dieselbe (erste) Fussnote — der Test koennte dann nicht mehr unterscheiden,
// welches Bild die globale Suche gewaehlt hat, und waere ein Scheinbeleg. Mit je eigener
// Fussnotenkennung greift `gemeinsameKennung` nicht, es wird NICHTS ueberschrieben, und die Auswahl
// an `:764-766` schlaegt sichtbar bis ins Formular durch. Genau das ist der Fall
// „widerspruechliches oder fremdes Markup", um den es in I50 ohnehin geht.
const DUBLETTE =
  '<figure><img src="/api/objects/erstes/raw" data-image-id="kw-img-dup-1">' +
  '<figcaption data-image-id="kw-cap-erste">Erste</figcaption></figure>' +
  '<figure><img src="/api/objects/zweites/raw" data-image-id="kw-img-dup-1">' +
  '<figcaption data-image-id="kw-cap-zweite">Zweite</figcaption></figure>';

function DublettenHost({
  anfrage,
}: {
  anfrage?: { imageId: string; nonce: number } | undefined;
}) {
  const [wert, setWert] = useState(DUBLETTE);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value: wert,
      documentTitle: "Dublettenprobe",
      onChange: (html: string) => setWert(html),
      ...(anfrage ? { captionFormRequest: anfrage } : {}),
    }),
  );
}

let behaelter: HTMLDivElement | null = null;
let wurzel: ReturnType<typeof createRoot> | null = null;

function montiere(anfrage?: { imageId: string; nonce: number }): void {
  behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  wurzel = createRoot(behaelter);
  act(() => {
    wurzel?.render(createElement(DublettenHost, { anfrage }));
  });
}

// ACHTUNG, gemessene Falle: die Komponente traegt ZWEI Elemente mit `role="textbox"` — den
// Editor-Body und das Feld des Bildbeschreibungs-Formulars (`id="caption-form-text"`). Im JSX steht
// das Formular VOR dem Editor, ein blankes `querySelector('[role="textbox"]')` liefert also das
// FELD. Der Editor wird deshalb ueber seine eigene Klasse adressiert — sonst misst der Test die
// falsche Flaeche und wird gruen, ohne etwas zu belegen.
function editorFlaeche(): Element | null {
  return behaelter?.querySelector('div.prose-kw[role="textbox"]') ?? null;
}

// Das Vorschaubild DES FORMULARS: das einzige <img> ausserhalb der Editorflaeche.
function formularBild(): HTMLImageElement | null {
  const flaeche = editorFlaeche();
  for (const bild of Array.from(document.querySelectorAll("img"))) {
    if (flaeche === null || !flaeche.contains(bild)) {
      return bild;
    }
  }
  return null;
}

describe("JOB 1186 / I50-3: die GLOBALE Kennungssuche liefert den ersten Treffer", () => {
  afterEach(() => {
    act(() => {
      wurzel?.unmount();
    });
    behaelter?.remove();
    behaelter = null;
    wurzel = null;
  });

  it("KALIBRIERUNG: ohne captionFormRequest oeffnet der Editor kein Formular", () => {
    montiere(undefined);
    // Ohne diese Gegenprobe waere ein Formular, das sich aus irgendeinem anderen Grund oeffnet, im
    // Fall darunter ununterscheidbar von einem Treffer der globalen Suche.
    expect(beschreibungsfeldOffen()).toBe(false);
    expect(formularBild()).toBeNull();
  });

  it("BELEG AN DER ECHTEN STELLE: die Bitte adressiert das ERSTE Bild, nicht das zweite", () => {
    montiere({ imageId: "kw-img-dup-1", nonce: 1 });

    // Vorbedingung: beide Bilder stehen im Editor UND teilen sich die Kennung.
    const bilder = Array.from(
      editorFlaeche()?.querySelectorAll('img[data-image-id="kw-img-dup-1"]') ?? [],
    );
    expect(bilder).toHaveLength(2);
    expect(bilder[0]?.getAttribute("src")).toBe("/api/objects/erstes/raw");
    expect(bilder[1]?.getAttribute("src")).toBe("/api/objects/zweites/raw");

    // Die Bitte ist durch RichTextEditor.tsx:764-766 gelaufen — das Formular steht offen.
    expect(beschreibungsfeldOffen()).toBe(true);

    // DIE AUSSAGE: adressiert wurde das ERSTE Bild in Dokumentreihenfolge.
    expect(formularBild()?.getAttribute("src")).toBe("/api/objects/erstes/raw");
    expect(formularBild()?.getAttribute("src")).not.toBe("/api/objects/zweites/raw");

    // Und die zugehoerige Fussnote ist die des ERSTEN figure.
    expect(beschreibungsText()).toBe("Erste");
    expect(beschreibungsText()).not.toBe("Zweite");
  });
});
