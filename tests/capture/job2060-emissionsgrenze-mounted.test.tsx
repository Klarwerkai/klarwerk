// @vitest-environment jsdom
// ================================================================================================
// JOB 2060 · D4 — I47 PUNKT 1: DIE EMISSIONSGRENZE ERZWINGT DIE INVARIANTE (AN DER ECHTEN STELLE)
// ================================================================================================
//
// DER BEFUND, den ben in `sammel88` benannt und als Nicht-Blocker eingeordnet hat (`OFFEN.md`, I47,
// erstens): „die Invariante wird heute an allen bekannten Editor-Wegen gerufen, aber nicht an der
// Emissionsgrenze erzwungen — `emit()` ruft sie nicht; ein kuenftiger Weg ueber `appendChild`,
// `replaceChildren` oder `Range.insertNode` koennte an ihr vorbei schreiben. Der Sammler ist
// Diagnose, nicht Garantie."
//
// WARUM DIESE DATEI GEMOUNTET IST UND NICHT NEBEN DER INVARIANTE LIEGT: `emit()` ist eine
// Funktion IN der Komponente. Eine Nachbildung ihrer Schritte (wie in
// `mega88-bildstruktur-invariante.test.ts`) belegt die Nachbildung, nicht die Komponente. Das ist
// dieselbe Unterscheidung, die ben zu JOB 1186 verlangt hat: „Ein erneuter Test nur von
// `imageForCaption` oder `captionForImage` erfuellt diese Pflicht nicht" — zwei verschiedene
// Stellen, zwei verschiedene Mechaniken. Der Beleg gehoert an die zweite.
//
// WAS DIESER FALL TUT: Er schreibt ein Bild ueber `appendChild` DIREKT in den Editor-Body — an
// allen fuenf bekannten Aufrufern der Verankerung vorbei — und laesst dann `emit()` laufen. Was
// `onChange` bekommt, ist das, was den Editor VERLAESST.
//
// Muster und Werkzeug sind die des Bestands (`editor-figure-caption-globale-suche-mounted.test.tsx`):
// react/react-dom relativ aus apps/web/node_modules, `createElement` statt JSX-Syntax, kein
// @testing-library.
import { afterEach, describe, expect, it } from "vitest";

import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (useTranslation ohne Provider).
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { mitBildbeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const START = "<p>Ein Satz.</p>";
const TINY = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Der zuletzt emittierte Wert — das, was den Editor verlassen hat. */
let emittiert: string | null = null;

function Host(): JSX.Element {
  const [wert, setWert] = useState(START);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value: wert,
      documentTitle: "Emissionsgrenze",
      onChange: (html: string) => {
        emittiert = html;
        setWert(html);
      },
    }),
  );
}

let behaelter: HTMLDivElement | null = null;
let wurzel: ReturnType<typeof createRoot> | null = null;

function montiere(): void {
  emittiert = null;
  behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  wurzel = createRoot(behaelter);
  act(() => {
    wurzel?.render(createElement(Host));
  });
}

// ACHTUNG, gemessene Falle (aus dem Bestand uebernommen): die Komponente traegt ZWEI Elemente mit
// `role="textbox"` — den Editor-Body und das Feld des Bildbeschreibungs-Formulars. Der Editor wird
// deshalb ueber seine eigene Klasse adressiert, sonst misst der Test die falsche Flaeche.
function editorFlaeche(): HTMLElement | null {
  const el = behaelter?.querySelector('div.prose-kw[role="textbox"]');
  return el instanceof HTMLElement ? el : null;
}

/** Ein Bild an ALLEN bekannten Verankerungs-Aufrufern vorbei in den Editor schreiben. */
function schreibeVorbei(): void {
  const flaeche = editorFlaeche();
  if (flaeche === null) {
    throw new Error("Editorflaeche nicht gefunden — der Test misst sonst die falsche Stelle");
  }
  const img = document.createElement("img");
  img.setAttribute("src", TINY);
  img.setAttribute("alt", "ueber appendChild");
  flaeche.appendChild(img);
}

/**
 * `emit()` ausloesen — ueber den Weg, den die Komponente selbst dafuer vorsieht (`onBlur`).
 *
 * GEMESSENE FALLE: `new Event("blur")` greift NICHT. React 17+ haengt seine Listener an den
 * Root-Container und bildet `onBlur` auf das BUBBELNDE `focusout` ab; das native `blur` bubbelt
 * nicht und erreicht den Container nie. Ein Test mit `blur` waere hier rot geworden, ohne dass am
 * Produkt etwas falsch ist — und mit `toBe(false)` statt `toBe(true)` waere er sogar gruen
 * geworden und haette nichts belegt.
 */
function loeseEmitAus(): void {
  const flaeche = editorFlaeche();
  act(() => {
    flaeche?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

afterEach(() => {
  act(() => {
    wurzel?.unmount();
  });
  behaelter?.remove();
  behaelter = null;
  wurzel = null;
});

describe("JOB 2060 · I47 Punkt 1: die Emissionsgrenze am echten `emit()`", () => {
  it("KALIBRIERUNG: das Bild kommt wirklich UNVERANKERT in den Editor", () => {
    // Ohne diese Gegenprobe waere der Fall darunter auch dann gruen, wenn irgendein Aufrufer die
    // Verankerung schon vorher nachgeholt haette — dann belegte er nicht die Emissionsgrenze.
    montiere();
    schreibeVorbei();

    const bild = editorFlaeche()?.querySelector("img");
    expect(bild, "das Bild ist gar nicht im Editor angekommen").not.toBeNull();
    expect(
      bild?.getAttribute("data-image-id"),
      "das Bild ist bereits verankert — dann misst der Fall darunter nicht die Emissionsgrenze",
    ).toBeNull();
  });

  it("DER BELEG: was den Editor verlaesst, ist verankert — auch auf einem Weg, den kein Aufrufer kennt", () => {
    montiere();
    schreibeVorbei();
    loeseEmitAus();

    expect(
      emittiert,
      "es wurde ueberhaupt nichts emittiert — der Ausloeser greift nicht",
    ).not.toBeNull();
    expect(emittiert ?? "", "das Bild ist beim Emittieren verschwunden").toMatch(/<img[\s>]/);
    expect(
      /data-image-id/.test(emittiert ?? ""),
      "der emittierte Wert traegt keine Bildkennung — die Emissionsgrenze erzwingt die Invariante " +
        "NICHT, und I47 (erstens) ist wieder offen",
    ).toBe(true);
    expect(
      emittiert ?? "",
      "das Bild ist nicht in eine figure gefasst — die Invariante ist halb angewandt",
    ).toMatch(/<figure[\s>]/);
  });

  it("DER PREIS, DEN ES NICHT KOSTET: der lebende Editor-DOM bleibt unveraendert", () => {
    // Der Verschluss darf nicht mit Cursor- und Auswahlverlust erkauft sein: `emit()` haengt an
    // `onEditorInput`, also an JEDEM Tastendruck. Deshalb verankert die Grenze auf einer
    // ABGEKOPPELTEN Kopie. Faellt dieser Fall, ist der Verschluss zwar da — aber zu teuer.
    montiere();
    schreibeVorbei();
    loeseEmitAus();

    const bild = editorFlaeche()?.querySelector("img");
    expect(bild, "das Bild ist aus dem Editor verschwunden").not.toBeNull();
    expect(
      bild?.getAttribute("data-image-id"),
      "die Emissionsgrenze hat den lebenden Editor-DOM veraendert — sie soll ihn nur LESEN",
    ).toBeNull();
    expect(
      bild?.closest("figure"),
      "das Bild wurde im lebenden DOM in eine figure gefasst — dasselbe Problem, eine Ebene tiefer",
    ).toBeNull();
  });

  it("GEGENPROBE: ein bereits verankerter Bestand behaelt seine Kennung ueber die Grenze", () => {
    // Ohne diesen Fall waere die Erzwingung auch dann gruen, wenn sie bei jedem Emittieren neue
    // Kennungen vergaebe — der Wert des Anker-Vertrags ist aber seine STABILITAET (mega88 Block B).
    montiere();
    const flaeche = editorFlaeche();
    act(() => {
      if (flaeche !== null) {
        flaeche.innerHTML = `<figure><img src="${TINY}" data-image-id="kw-img-fest-1"></figure>`;
      }
    });
    loeseEmitAus();

    expect(emittiert ?? "", "die feste Kennung hat das Emittieren nicht ueberlebt").toMatch(
      /data-image-id="kw-img-fest-1"/,
    );
  });
});
