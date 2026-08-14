// @vitest-environment jsdom
// ================================================================================================
// JOB 994 D1 — I47 PUNKT 5: DER SPRACHWECHSEL AM OFFENEN EDITOR.
// ================================================================================================
//
// DER BEFUND (I47, fuenftens): seit mega88 haengt der Ladeeffekt des Editors nur noch an
// `[value, mode]`. Die editorseitigen Texte — der visuelle Einlade-Text der leeren Bildfussnote
// (`data-kw-placeholder`) und die angekuendigte Beschriftung des Bedienelements (`aria-label`) —
// werden aber NICHT von React gerendert: sie werden per `setAttribute` in den DOM geschrieben,
// einmal, beim Laden. Wechselt die Sprache am OFFENEN Editor, rendert React die Werkzeugleiste neu,
// diese beiden Attribute bleiben jedoch in der alten Sprache stehen — bis zum naechsten Wert- oder
// Moduswechsel. I47 nennt das die einzige der fuenf Haertungen, die ein Nutzer heute merken koennte.
//
// WARUM DIESER TEST GEMOUNTET SEIN MUSS: der Fehler ist kein Textfehler, sondern ein
// Aktualisierungsfehler. Im Quelltext steht der richtige Schluessel; falsch ist der ZEITPUNKT, zu
// dem er angewandt wird. Ein Quelltexttest saehe die richtige Zeile und bliebe gruen.
//
// WARUM KEINE NEUMONTAGE UND KEIN WERTWECHSEL: beides wuerde den Ladeeffekt ohnehin ausloesen und
// damit genau den Weg gehen, der heute schon funktioniert. Der Test wechselt deshalb AUSSCHLIESSLICH
// die Sprache (`i18n.changeLanguage`) am stehenden, montierten Editor — `value` und `mode` bleiben
// unberuehrt, und dass sie unberuehrt bleiben, wird eigens geprueft (S-3).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";
// Die EINE Naht fuer isoliert gemountete Editor-Tests (mega50 Block A) — nicht eine zweite bauen.
import { mitBildbeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Eine LEERE Fussnote — nur dort ist der Einlade-Text sichtbar (CSS `:empty::before`). Dazu ein
// zweites Bild mit gefuellter Fussnote, damit die Zusicherungen nicht am Einzelfall haengen.
const INHALT =
  "<p>Ein Satz, der stehen bleiben muss.</p>" +
  '<figure><img src="data:image/png;base64,AAAA"><figcaption></figcaption></figure>' +
  '<figure><img src="data:image/png;base64,BBBB"><figcaption>Gefuellte Beschreibung</figcaption></figure>';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let gesetzterWert = INHALT;
let wertwechsel = 0;

function Host(): JSX.Element {
  const [value, setValue] = useState(INHALT);
  gesetzterWert = value;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => {
        wertwechsel += 1;
        setValue(html);
      },
    }),
  );
}

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host));
  });
}

const fussnoten = (): HTMLElement[] =>
  Array.from(document.querySelectorAll("figcaption")) as HTMLElement[];

const leereFussnote = (): HTMLElement => {
  const treffer = fussnoten().find((c) => (c.textContent ?? "").trim().length === 0);
  if (!treffer) {
    throw new Error("Keine leere Fussnote im montierten Editor — die Vorbedingung fehlt.");
  }
  return treffer;
};

/** Die Sprache am STEHENDEN Editor wechseln. Kein Neurendern von aussen, kein Wertwechsel. */
async function spracheWechseln(lng: string): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage(lng);
  });
}

beforeEach(async () => {
  wertwechsel = 0;
  await i18n.changeLanguage("de");
  mount();
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await i18n.changeLanguage("de");
});

describe("JOB 994 D1 · I47 Punkt 5: Sprachwechsel am offenen Editor", () => {
  it("S-1 · der Einlade-Text der leeren Fussnote folgt DE → EN → NL sofort", async () => {
    // Kalibrierung: der Ausgangszustand muss der deutsche sein — sonst prueft der Test nichts.
    expect(leereFussnote().getAttribute("data-kw-placeholder")).toBe(
      i18n.getFixedT("de")("editor.captionPlaceholder"),
    );

    for (const lng of ["en", "nl"]) {
      await spracheWechseln(lng);
      expect(
        leereFussnote().getAttribute("data-kw-placeholder"),
        `Nach dem Wechsel auf ${lng} steht der Einlade-Text noch in der alten Sprache — genau der Befund aus I47 Punkt 5.`,
      ).toBe(i18n.getFixedT(lng)("editor.captionPlaceholder"));
    }
  });

  it("S-2 · die angekuendigte Beschriftung jeder Fussnote folgt ebenfalls", async () => {
    // Zweite, unabhaengige Achse: `aria-label` haengt an DEMSELBEN Aufruf, ist aber ein anderer
    // Schluessel. Beide muessen mitziehen, sonst ist nur die Haelfte repariert.
    for (const lng of ["en", "nl", "de"]) {
      await spracheWechseln(lng);
      const erwartet = i18n.getFixedT(lng)(CAPTION_AI_TEXT.captionOpenLabel);
      for (const fussnote of fussnoten()) {
        expect(
          fussnote.getAttribute("aria-label"),
          `Fussnote ohne aktualisierte Beschriftung nach dem Wechsel auf ${lng}.`,
        ).toBe(erwartet);
      }
    }
  });

  it("S-3 · der Sprachwechsel aendert weder Wert noch Modus", async () => {
    // Die Zusage aus dem Auftrag: die Wirkung darf NICHT ueber einen Wert- oder Moduswechsel
    // erkauft sein. Ein `onChange` waehrend des Sprachwechsels waere genau dieser Erkauf.
    const vorher = gesetzterWert;
    await spracheWechseln("en");
    expect(wertwechsel, "Der Sprachwechsel hat einen Wertwechsel ausgeloest.").toBe(0);
    expect(gesetzterWert).toBe(vorher);
  });

  it("S-4 · Inhalt und Bildanker bleiben stabil", async () => {
    const ankerVorher = Array.from(document.querySelectorAll("[data-image-id]")).map((n) =>
      n.getAttribute("data-image-id"),
    );
    expect(ankerVorher.length, "Vorbedingung: es gibt verankerte Bilder.").toBeGreaterThan(0);
    // NUR die Schreibflaeche, nicht der ganze Seitentext: die Werkzeugleiste ist uebersetzt und
    // SOLL sich beim Sprachwechsel aendern. Ein Vergleich ueber `document.body` haette genau das
    // als Inhaltsverlust gemeldet — der erste Rotlauf dieses Durchgangs hat mir das gezeigt.
    const flaeche = document.querySelector('[contenteditable="true"]');
    if (!flaeche) {
      throw new Error("Keine editierbare Flaeche gefunden — die Vorbedingung fehlt.");
    }
    const inhaltVorher = flaeche.innerHTML;
    // DIE KNOTENIDENTITAET, und warum sie hier steht: eine Gegenmutation dieses Durchgangs hat
    // `el.innerHTML = el.innerHTML` in den neuen Effekt gesetzt — der Inhalt bleibt textgleich, der
    // Fokus auf der Flaeche selbst ueberlebt, und alle Zusicherungen blieben gruen. Genau diese
    // bequeme, falsche Reparatur faengt erst die Identitaet: ein Neuschreiben ERSETZT die Knoten.
    // Wer sie ersetzt, loest jedes offene Fussnotenformular und jeden laufenden Bildbeschreibungs-
    // Request vom DOM ab (die Lauf-Nummern in RichTextEditor.tsx sagen, warum das teuer ist).
    const fussnotenVorher = fussnoten();

    await spracheWechseln("nl");

    const ankerNachher = Array.from(document.querySelectorAll("[data-image-id]")).map((n) =>
      n.getAttribute("data-image-id"),
    );
    expect(ankerNachher, "Die Bildanker haben sich beim Sprachwechsel veraendert.").toEqual(
      ankerVorher,
    );
    // Der Text bleibt; nur die beiden editorseitigen ATTRIBUTE duerfen sich geaendert haben.
    expect(flaeche.textContent, "Der Inhalt hat sich beim Sprachwechsel veraendert.").toBe(
      new DOMParser().parseFromString(inhaltVorher, "text/html").body.textContent,
    );
    // Und dieselben Knoten, nicht nur derselbe Text.
    const fussnotenNachher = fussnoten();
    expect(fussnotenNachher.length).toBe(fussnotenVorher.length);
    for (let i = 0; i < fussnotenVorher.length; i += 1) {
      expect(
        fussnotenNachher[i],
        "Die Fussnotenknoten wurden beim Sprachwechsel ersetzt statt aktualisiert — ein " +
          "Inhaltsneuschreiben loest offene Formulare und laufende Anfragen vom DOM ab.",
      ).toBe(fussnotenVorher[i]);
    }
  });

  it("S-5 · der Fokus im Editor ueberlebt den Sprachwechsel", async () => {
    // Diese Zusicherung prueft, dass die Schreibflaeche den Fokus behaelt. Sie allein schliesst
    // ein Inhaltsneuschreiben NICHT aus — gemessen in diesem Durchgang: liegt der Fokus auf der
    // Flaeche selbst, ueberlebt er auch ein `innerHTML`-Neuschreiben ihrer Kinder. Den Riegel
    // dagegen schiebt die Knotenidentitaet in S-4 vor; hier steht nur, was hier steht.
    const flaeche = document.querySelector('[contenteditable="true"]') as HTMLElement | null;
    if (!flaeche) {
      throw new Error("Keine editierbare Flaeche gefunden — die Vorbedingung fehlt.");
    }
    act(() => flaeche.focus());
    expect(document.activeElement, "Vorbedingung: die Flaeche hat den Fokus.").toBe(flaeche);

    await spracheWechseln("en");

    expect(document.activeElement, "Der Fokus ging beim Sprachwechsel verloren.").toBe(flaeche);
    // Und die Wirkung tritt AUCH bei gesetztem Fokus ein: der Ladeeffekt haette hier wegen
    // `el.contains(document.activeElement)` gar nicht gegriffen — ein Beweis mehr, dass die
    // Aktualisierung nicht ueber den alten Weg laeuft.
    expect(leereFussnote().getAttribute("data-kw-placeholder")).toBe(
      i18n.getFixedT("en")("editor.captionPlaceholder"),
    );
  });
});
