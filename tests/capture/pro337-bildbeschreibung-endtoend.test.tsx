// @vitest-environment jsdom
// AUFTRAG-PRO-337 (Pedi HEUTE): Bildbeschreibung end-to-end shipfähig.
//
// DER BELEG, DER FEHLTE. Der Weg selbst ist seit mega84/mega69 gebaut und grün: der Klick auf die
// Beschreibung öffnet das Formular, die Galerie öffnet DASSELBE, der Vorschlag läuft über den einen
// describe-Aufruf. Was NICHT belegt war, ist die Zusammensetzung des Kontexts.
//
// `tests/capture/mega69-bildweg-mounted.test.tsx:232` prüft den Dokumentkontext mit einer einzigen
// Zusicherung: `expect(context ?? "").toContain("Kessel")`. Der Titel dieses Entwurfs lautet
// „Kesselwartung" — die Zusicherung hält also bereits, wenn AUSSCHLIESSLICH der Titel mitreist und
// Überschrift wie umgebender Text fehlen. Genau die drei Teile verlangt der Auftrag aber einzeln:
// „Bildinhalt sowie Dokumenttitel, nächstliegende Überschrift und umgebenden Dokumenttext".
// Ein Teilstring, den drei verschiedene Quellen erfüllen können, unterscheidet sie nicht.
//
// Dieser Test bindet deshalb VIER paarweise verschiedene Zeichenfolgen — Titel, Überschrift, Absatz
// davor, Absatz danach — plus das Bild selbst, und dazu die zwei Beschriftungen `Titel:` und
// `Abschnitt:`, mit denen `buildImageContext` die Teile ZUORDNET. Fällt einer der Teile aus, bleibt
// genau seine Zusicherung rot; die anderen tragen ihn nicht mit.
//
// Zweitens: beide Einstiege in EIN Formular. Der Klick auf die Beschreibung im Dokument und die
// Bitte der Galerie (`captionFormRequest`, derselbe Weg, den `BodyImageGallery.onEditCaption`
// auslöst) müssen dasselbe Fenster mit demselben Ziel öffnen — nicht zwei Formulare, die sich
// ähneln. Belegt über die Knoten-Zahl im DOM und über den Ausgangswert des Feldes.
//
// Drittens: die Negativkante. Ein Absatz, der jenseits der nächsten Überschrift und außerhalb des
// Absatzfensters steht, darf NICHT mitreisen — sonst wäre „umgebender Text" in Wahrheit „das ganze
// Dokument", und die Zusicherung oben wäre wertlos, weil sie alles erfüllt.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";
import {
  beschreibungsText,
  beschreibungsfeldOffen,
  mitBildbeschreibung,
  schreibeBeschreibung,
} from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PNG = "data:image/png;base64,AAAA";

// Die fünf Bausteine sind paarweise verschieden und teilen KEIN Wort — nur so kann eine Zusicherung
// den Ausfall genau ihres Teils anzeigen.
const TITEL = "Wartungsprotokoll Kessel 3";
const UEBERSCHRIFT = "Ventilgruppe V2";
const ABSATZ_DAVOR = "Der Dichtring wurde am Montag getauscht.";
const ABSATZ_DANACH = "Die Nachkontrolle erfolgt in vier Wochen.";
// Steht VOR einer weiteren Überschrift und damit in einem anderen Abschnitt: darf nicht mitreisen.
const FREMDER_ABSATZ = "Lieferantenanschrift und Rechnungsnummer stehen im Anhang.";

const BODY = [
  "<h2>Allgemeine Hinweise</h2>",
  `<p>${FREMDER_ABSATZ}</p>`,
  `<h2>${UEBERSCHRIFT}</h2>`,
  `<p>${ABSATZ_DAVOR}</p>`,
  `<figure><img src="${PNG}"><figcaption data-image-id="kw-337">Alte Beschreibung</figcaption></figure>`,
  `<p>${ABSATZ_DANACH}</p>`,
].join("");

const VORSCHLAG: DescribeImageResult = {
  text: "Dichtring der Ventilgruppe, sichtbar gerissen.",
  demo: false,
  withContext: true,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let lastHtml = "";
const describeMock = vi.fn(async (): Promise<DescribeImageResult> => VORSCHLAG);

// Die Bitte der Galerie ist ein Prop des Editors — `BodyImageGallery.onEditCaption` mündet über die
// Seite in genau dieses Feld (KnowledgeDetail.tsx:1193, CaptureFrontDoor.tsx:834). Der Test setzt
// es direkt und fährt damit denselben Eingang, ohne die Seiten anzufassen.
function Host(): JSX.Element {
  const [value, setValue] = useState(BODY);
  const [request, setRequest] = useState<{ imageId: string; nonce: number } | undefined>(undefined);
  lastHtml = value;
  galerieBitte = (imageId: string) =>
    setRequest((prev) => ({ imageId, nonce: (prev?.nonce ?? 0) + 1 }));
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: TITEL,
      captionFormRequest: request,
      onChange: (html: string) => {
        lastHtml = html;
        setValue(html);
      },
    }),
    describeMock,
  );
}

let galerieBitte: (imageId: string) => void = () => {
  throw new Error("Host nicht montiert");
};

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host));
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  describeMock.mockClear();
  document.body.innerHTML = "";
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

function byTestId<T extends HTMLElement>(id: string): T {
  const el = document.querySelector(`[data-testid="${id}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element [data-testid="${id}"] nicht gerendert`);
  }
  return el as T;
}

/** Pedis Weg: der Klick auf die Beschreibung SELBST, nicht auf das Bild und nicht über eine Leiste. */
async function oeffneUeberBeschreibung(): Promise<void> {
  const cap = container.querySelector("figcaption");
  if (!(cap instanceof HTMLElement)) {
    throw new Error("Die Bildbeschreibung ist im Editor nicht gerendert");
  }
  await act(async () => {
    cap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
}

/** Der zweite Weg: aus der Bildergalerie heraus, über die Kennung des betrachteten Bildes. */
async function oeffneUeberGalerie(): Promise<void> {
  await act(async () => {
    galerieBitte("kw-337");
    await flush();
  });
}

/** Der eine describe-Aufruf, aufgeschlüsselt wie in ImageDescribeContext: (dataUrl, …, context). */
function letzterAufruf(): { dataUrl: string; context: string } {
  expect(describeMock, "es gab keinen einzigen describe-Aufruf").toHaveBeenCalledTimes(1);
  const [dataUrl, context] = describeMock.mock.calls[0] as unknown as [string, string | undefined];
  return { dataUrl, context: context ?? "" };
}

describe("PRO 337 · Bildbeschreibung end-to-end: ein Fenster, ein Vision-Weg, belegter Kontext", () => {
  it("der Klick auf die Beschreibung im Dokument öffnet das Fenster mit Überschrift, Feld und Vorschlagsweg", async () => {
    mount();
    await oeffneUeberBeschreibung();

    // Eine klare Überschrift …
    expect(document.body.textContent).toContain(i18n.t(CAPTION_AI_TEXT.formTitle));
    // … ein mehrzeiliges, beschriftetes Eingabefeld mit dem vorhandenen Text als Ausgangswert …
    const feld = document.querySelector("#caption-form-text");
    expect(feld, "das Eingabefeld fehlt").not.toBeNull();
    expect(
      feld?.getAttribute("aria-multiline"),
      "das Feld ist nicht als mehrzeilig ausgewiesen",
    ).toBe("true");
    expect(feld?.getAttribute("role")).toBe("textbox");
    expect(beschreibungsText()).toBe("Alte Beschreibung");
    // … und der KI-Vorschlag ist erreichbar, nicht nur vorhanden.
    expect(byTestId<HTMLButtonElement>("caption-form-suggest").disabled).toBe(false);
  });

  it("beide Einstiege münden in DASSELBE Fenster — nicht in zwei, die sich ähneln", async () => {
    mount();

    await oeffneUeberBeschreibung();
    expect(document.querySelectorAll("#caption-form-text")).toHaveLength(1);
    expect(beschreibungsText()).toBe("Alte Beschreibung");

    // Schließen und über den Galerieweg erneut öffnen.
    const abbrechen = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === i18n.t(CAPTION_AI_TEXT.formCancel),
    );
    if (!(abbrechen instanceof HTMLButtonElement)) {
      throw new Error("Abbrechen-Knopf nicht gerendert");
    }
    await click(abbrechen);
    expect(beschreibungsfeldOffen()).toBe(false);

    await oeffneUeberGalerie();
    // Genau EIN Formularknoten, dasselbe Ziel, derselbe Ausgangswert.
    expect(
      document.querySelectorAll("#caption-form-text"),
      "der Galerieweg hat ein zweites Formular geöffnet",
    ).toHaveLength(1);
    expect(beschreibungsText()).toBe("Alte Beschreibung");
    expect(document.body.textContent).toContain(i18n.t(CAPTION_AI_TEXT.formTitle));
  });

  it("der EINE Vision-Aufruf trägt Bild, Dokumenttitel, nächstliegende Überschrift und umgebenden Text — je einzeln belegt", async () => {
    mount();
    await oeffneUeberBeschreibung();
    await click(byTestId("caption-form-suggest"));

    const { dataUrl, context } = letzterAufruf();

    // 1. Der Bildinhalt reist mit — als data:-URL genau dieses Bildes.
    expect(dataUrl, "das Bild selbst fehlt im Vision-Aufruf").toBe(PNG);

    // 2. Der Dokumenttitel, mit seiner Zuordnung.
    expect(context, "der Dokumenttitel fehlt im Kontext").toContain(TITEL);
    expect(context, "der Titel reist ohne seine Zuordnung").toContain(`Titel: ${TITEL}`);

    // 3. Die NÄCHSTLIEGENDE Überschrift — nicht irgendeine des Dokuments.
    expect(context, "die nächstliegende Überschrift fehlt im Kontext").toContain(UEBERSCHRIFT);
    expect(context, "die Überschrift reist ohne ihre Zuordnung").toContain(
      `Abschnitt: ${UEBERSCHRIFT}`,
    );
    expect(context, "es reist eine fremde, weiter entfernte Überschrift mit").not.toContain(
      "Allgemeine Hinweise",
    );

    // 4. Der umgebende Dokumenttext, in BEIDE Richtungen.
    expect(context, "der Absatz VOR dem Bild fehlt").toContain(ABSATZ_DAVOR);
    expect(context, "der Absatz NACH dem Bild fehlt").toContain(ABSATZ_DANACH);

    // 5. Die Negativkante: „umgebend" heißt nicht „alles". Ohne diese Zusicherung wäre Punkt 4
    //    auch von einem Sammler erfüllt, der schlicht das ganze Dokument anhängt.
    expect(context, "ein Absatz aus einem anderen Abschnitt reist mit").not.toContain(
      FREMDER_ABSATZ,
    );

    // 6. Ein einziger Aufruf — eine Egress-Stelle, kein zweiter Versand des Kontexts.
    expect(describeMock).toHaveBeenCalledTimes(1);
  });

  it("Vorschlag übernehmen, speichern — die Beschreibung steht im Dokument; Abbrechen ändert nichts", async () => {
    mount();
    await oeffneUeberBeschreibung();
    await click(byTestId("caption-form-suggest"));

    // Der Vorschlag ist gekennzeichnet und wird NICHT von selbst übernommen.
    expect(byTestId("caption-form-suggestion").textContent).toContain(
      i18n.t(CAPTION_AI_TEXT.aiBadge),
    );
    expect(beschreibungsText(), "der Vorschlag wurde ungefragt ins Feld geschrieben").toBe(
      "Alte Beschreibung",
    );

    // Der Mensch übernimmt …
    await click(byTestId("caption-form-adopt"));
    expect(beschreibungsText()).toBe(VORSCHLAG.text);
    // … und speichert: der Text steht im Dokument, der alte ist fort.
    await click(byTestId("caption-form-save"));
    expect(lastHtml).toContain(VORSCHLAG.text);
    expect(lastHtml).not.toContain("Alte Beschreibung");
    expect(beschreibungsfeldOffen()).toBe(false);

    // Zweiter Durchgang über den GALERIEWEG: tippen, dann abbrechen → das Dokument bleibt, wie es war.
    const vorherHtml = lastHtml;
    await oeffneUeberGalerie();
    await act(async () => {
      schreibeBeschreibung("Diese Fassung wird verworfen");
      await flush();
    });
    const abbrechen = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === i18n.t(CAPTION_AI_TEXT.formCancel),
    );
    if (!(abbrechen instanceof HTMLButtonElement)) {
      throw new Error("Abbrechen-Knopf nicht gerendert");
    }
    await click(abbrechen);
    expect(lastHtml).toBe(vorherHtml);
    expect(lastHtml).not.toContain("Diese Fassung wird verworfen");
  });
});
