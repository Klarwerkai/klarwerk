// @vitest-environment jsdom
// ================================================================================================
// JOB 3064 · H5 — DIE FUSSNOTENMARKE `[n]` WIRD AUSGEZEICHNET, NICHT ROH GESETZT.
// ================================================================================================
//
// DER BEFUND (Ben, Runde 3, Korrekturpflicht 1): das Zielbild `design/klarwerk/Fragen.dc.html`
// (Z.40/41) zeichnet die Ziffer im Antworttext als Hochstellung in 10 px/#9C5009/700 aus. Gebaut
// war sie nicht: der Antworttext trug „[1]" als rohen Fliesstext. Der zugehoerige Messfall war ein
// Platzhalter — er protokollierte den Sollwert als OFFEN, mass `0 <sup>-Elemente` und prueft dann
// nur, ob ueberhaupt Text da ist. Er war damit gruen, ohne die Sache zu belegen.
//
// WARUM DIESE DATEI NEBEN DER CHROMIUM-MESSUNG STEHT: die Marke stammt im Betrieb vom Modell, und
// das Tor faehrt ohne Modell. Die Chromium-Messung braucht deshalb einen Antworttext, der die
// Marke traegt. DIESE Datei braucht das nicht: sie prueft die REGEL — Zerlegung und Satz — ohne
// Netz, ohne Modell, ohne Browser. Beide zusammen decken „die Regel stimmt" und „sie wirkt in der
// gebauten App".
//
// ------------------------------------------------------------------------------------------------
// UND SIE HAELT DIE ZWEITE RENDERSTELLE ZUSAMMEN (G1).
// ------------------------------------------------------------------------------------------------
// Die Marke entsteht zwangslaeufig dort, wo der Antworttext zu React-Knoten wird. Der gemeinsame
// Renderer `components/AnswerMarkdown.tsx` bedient DREI Flaechen (Fragen, Mobile, Klara); die
// Fussnote ist eine Zusage des H5-Zielbilds fuer die FRAGENFLAECHE allein. Deshalb hat die
// Fragenflaeche mit `components/start/AntwortText.tsx` ihren eigenen Textsatz — und deshalb steht
// hier G1: fuer markenfreien Text muessen BEIDE Bauteile Zeichen fuer Zeichen dasselbe `innerHTML`
// liefern. Ohne diesen Fall waere die zweite Renderstelle eine Drift-Quelle statt einer Zusage.
import { describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AnswerMarkdown } from "../../apps/web/src/components/AnswerMarkdown";
import { AntwortText } from "../../apps/web/src/components/start/AntwortText";
import { stripAnswerMarkdown } from "../../apps/web/src/lib/answerMarkdown";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(element: ReturnType<typeof createElement>): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return container;
}

/** Der gemeinsame Renderer (Mobile/Klara) — die Vergleichsseite fuer G1. */
const gemeinsam = (text: string): HTMLDivElement =>
  mount(createElement(AnswerMarkdown, { text, className: "ask-answer-body" }));

/**
 * Der Antworttext der Fragenflaeche. `quellen` ist die Zahl der Quellen, die die Antwort traegt —
 * nur Zahlen aus diesem Bereich duerfen zu Marken werden (dieselbe Regel wie im Reasoner).
 * Vorgabe 2, damit die haeufigen Beispiele `[1]`, `[1, 2]`, `[2][3]` nicht jedes Mal eine eigene
 * Zahl brauchen; wo der Bereich zur Sache gehoert, steht er ausdruecklich da.
 */
const antwort = (text: string, quellen = 2): HTMLDivElement =>
  mount(createElement(AntwortText, { text, quellen, className: "ask-answer-body" }));

/** Die Ziffern aller gesetzten Marken, in Lesereihenfolge. */
const marken = (c: HTMLElement): string[] =>
  [...c.querySelectorAll("sup[data-fussnote]")].map((e) => e.getAttribute("data-fussnote") ?? "");

describe("JOB 3064 · F · die Fussnotenmarke im Antworttext", () => {
  it("F1 · DER FANG: die Marke wird als <sup> mit der ZIFFER gesetzt, nicht als „[1]“ im Fliesstext", () => {
    const c = antwort("Hohlprofile sind zu vermeiden [1].");
    const sup = c.querySelector("sup[data-fussnote]");
    expect(sup, "die Marke steht roh im Text statt als Hochstellung").not.toBeNull();
    expect(sup?.getAttribute("data-fussnote")).toBe("1");
    expect(sup?.textContent, "die Klammern gehoeren nicht in die Hochstellung").toBe("1");
    // Der Satz ringsum bleibt vollstaendig — die Marke ersetzt nur ihre eigenen Zeichen.
    expect(c.textContent).toBe("Hohlprofile sind zu vermeiden 1.");
  });

  it("F2 · die Auszeichnung: 10 px, fett, der Ton des Zielbilds", () => {
    // Die GERECHNETEN Pixel- und Farbwerte misst die Chromium-Messung an der gebauten App
    // (`tests/design/zielbild-h5-fragen.test.ts` V18b). Hier haengt die Auszeichnung an Klassen —
    // wer eine davon streicht, wird hier rot, ohne dass ein Browser noetig waere.
    const klasse =
      antwort("Vermeiden [1].").querySelector("sup[data-fussnote]")?.getAttribute("class") ?? "";
    expect(klasse, "Schriftgrad fehlt").toContain("text-[10px]");
    expect(klasse, "Fettung fehlt").toContain("font-bold");
    expect(klasse, "der Ton des Zielbilds fehlt").toContain("text-[#9C5009]");
  });

  it("F3 · KALIBRIERUNG: mehrere Marken werden einzeln ausgezeichnet und behalten ihre Ziffer", () => {
    const c = antwort("Erstens [1]. Zweitens [2]. Drittens [12].", 12);
    expect(marken(c)).toEqual(["1", "2", "12"]);
  });

  it("F4 · DIE GEGENRICHTUNG: was keine Ziffernmarke ist, bleibt woertlicher Text", () => {
    // Sonst wuerde aus jeder eckigen Klammer eine erfundene Quellenbindung.
    const c = antwort("Siehe [Anhang] und [A1] sowie Ziffern im Satz wie 1 und 2.");
    expect(marken(c)).toEqual([]);
    expect(c.textContent).toContain("[Anhang]");
    expect(c.textContent).toContain("[A1]");
  });

  // ==============================================================================================
  // KORREKTURPFLICHT 1 (Ben, Runde 6) — ALLE ZITIERFORMEN, DIE DER REASONER ZURUECKLIEST.
  // ==============================================================================================
  // Bens Befund: `[1, 2]` band im Reasoner zwei Quellen und stand auf der Flaeche als rohe Klammer.
  // Die Formen stammen nicht aus meiner Feder, sondern aus `citedSourceIds` und seinem
  // Bestandstest `tests/ask/mega52-tragende-quellen.test.ts`.

  it("F7 · `[2][3]` — zwei Gruppen, zwei eigene Marken", () => {
    const c = antwort("Das gilt [2][3].", 3);
    expect(marken(c)).toEqual(["2", "3"]);
    expect(c.textContent, "die Klammern bleiben im Satz stehen").toBe("Das gilt 23.");
  });

  it("F8 · DER FANG: `[1, 2]` — EINE Gruppe, ZWEI eigene Marken", () => {
    // Bens Gegenprobe an Runde 6: erwartet `["1","2"]`, erhalten `[]`.
    const c = antwort("Ventil prüfen [1, 2].");
    expect(marken(c)).toEqual(["1", "2"]);
    expect(c.textContent).toBe("Ventil prüfen 12.");
  });

  it("F9 · Leerraum in der Gruppe zaehlt nicht: `[ 1 , 2 ]` ist dieselbe Aussage", () => {
    // Der Reasoner erlaubt Leerraum ausdruecklich (`[0-9\\s,]+`). Die Flaeche darf daran nicht
    // strenger sein als die Seite, die die Bindung herstellt.
    expect(marken(antwort("Ventil prüfen [ 1 , 2 ]."))).toEqual(["1", "2"]);
  });

  it("F10 · DER ZWEITE FANG: die Marke innerhalb von **fett** und *kursiv*", () => {
    // Bens Gegenprobe: `strong sup[data-fussnote='1']` war `null`. Die Marke gehoert IN die
    // Auszeichnung — sie bindet die ausgezeichnete Aussage an ihre Quelle, nicht den Satz daneben.
    const fett = antwort("**Ventil prüfen [1]**");
    expect(
      fett.querySelector("strong sup[data-fussnote]")?.getAttribute("data-fussnote"),
      "die Marke steht nicht im fetten Teil",
    ).toBe("1");
    const kursiv = antwort("*Ventil prüfen [2]*");
    expect(
      kursiv.querySelector("em sup[data-fussnote]")?.getAttribute("data-fussnote"),
      "die Marke steht nicht im kursiven Teil",
    ).toBe("2");
  });

  it("F11 · eine Zahl OHNE Quelle wird nicht zur Marke — und verschwindet auch nicht", () => {
    // Der Reasoner VERWIRFT eine Nummer ausserhalb seiner Kandidatenliste, statt sie zu biegen
    // (mega52 A5). Die Flaeche muss dasselbe tun: eine hochgestellte 9 ohne neunte Quelle waere
    // eine erfundene Bindung — und `zielbild-h5-fragen` V18 verlangt „keine Marke ohne Chip".
    const c = antwort("Das gilt [9].", 3);
    expect(marken(c)).toEqual([]);
    expect(c.textContent, "die ungueltige Zahl wurde still aus dem Satz geloescht").toBe(
      "Das gilt [9].",
    );
  });

  it("F12 · GEMISCHTE GRUPPE: die gueltige Zahl wird Marke, die ungueltige bleibt stehen", () => {
    // KORREKTURPFLICHT 1 (Ben, Runde 7). Bis Runde 7 stand hier die Gegenbehauptung: `[1, 9]` bleibe
    // GANZ Text. Bens Messung hat sie widerlegt — nicht am Geschmack, sondern am Vertrag: der
    // Reasoner entscheidet JE KOMMA-TEIL und bindet bei `[1, 9]` sehr wohl Quelle 1
    // (`citedSourceIds`, `for (const part of match[1].split(","))`). Eine gebundene Quelle ohne
    // Marke ist genau die Luecke, die F8 fuer `[1, 2]` geschlossen hat, eine Ebene tiefer.
    // Die 9 wird deshalb NICHT geloescht (das war die richtige Sorge der alten Fassung) und NICHT
    // zur Marke (das waere eine erfundene Bindung) — sie bleibt woertlich im Satz stehen.
    const c = antwort("Das gilt [1, 9].", 3);
    expect(marken(c), "die vom Reasoner gebundene Quelle 1 traegt keine Marke").toEqual(["1"]);
    expect(c.textContent, "die ungueltige 9 wurde still aus dem Satz geloescht").toBe(
      "Das gilt [1, 9].",
    );
  });

  it("F13 · KEIN gueltiger Rohmarker bleibt sichtbar", () => {
    // Bens Zusage in einem Satz: was der Reasoner als Quellenbindung liest, darf der Mensch nicht
    // als Klammertext lesen. Geprueft ueber alle Formen zusammen, am sichtbaren Text.
    const c = antwort("A [1]. B [2][3]. C [1, 3]. D **[2]**. E *[3]*.", 3);
    expect(marken(c)).toEqual(["1", "2", "3", "1", "3", "2", "3"]);
    expect(
      /\[\s*\d/.test(c.textContent ?? ""),
      `ein gueltiger Rohmarker blieb stehen: ${c.textContent}`,
    ).toBe(false);
  });

  it("F5 · im KLARTEXT behaelt die Marke ihre Klammern — Export und Word lesen keine Hochstellung", () => {
    // Ohne diese Regel wuerde aus „vermeiden [1]." im Word-Taskpane „vermeiden 1." — eine Ziffer,
    // die wie Teil des Satzes aussieht. Der gemeinsame Parser laesst `[1]` woertlich stehen; genau
    // deshalb ist an ihm fuer JOB 3064 NICHTS zu aendern gewesen.
    expect(stripAnswerMarkdown("Hohlprofile sind zu vermeiden [1].")).toBe(
      "Hohlprofile sind zu vermeiden [1].",
    );
  });

  it("F6 · die Marke bleibt in Listen und Ueberschriften erhalten", () => {
    // `#`/`##` werden h3, alles Tiefere h4 (`lib/answerMarkdown.ts`: die Antwort steckt in einer
    // Karte, h1/h2 waeren typografisch falsch). Beide Ebenen werden hier angefasst.
    const c = antwort(
      "## Titel [1]\n\n#### Untertitel [3]\n\n- Erster Punkt [2]\n- Zweiter Punkt",
      3,
    );
    expect(c.querySelector("h3 sup[data-fussnote]")?.getAttribute("data-fussnote")).toBe("1");
    expect(c.querySelector("h4 sup[data-fussnote]")?.getAttribute("data-fussnote")).toBe("3");
    expect(c.querySelector("li sup[data-fussnote]")?.getAttribute("data-fussnote")).toBe("2");
  });
});

describe("JOB 3064 · G · die zwei Renderstellen laufen nicht auseinander", () => {
  // Ohne markenfreien Text sind `AntwortText` und `AnswerMarkdown` DASSELBE Bauteil — sie teilen
  // den Parser und muessen dieselben Elemente, Klassen und Textknoten liefern. Weicht eines ab
  // (ein anderer Abstand, ein anderes Element, ein vergessener `first:mt-0`), faellt es hier auf.
  const OHNE_MARKE = [
    ["Absatz", "Ein schlichter Satz ohne alles."],
    ["fett und kursiv", "Ein **fetter** und ein *kursiver* Teil."],
    ["Ueberschrift h3", "### Ueberschrift\n\nDarunter ein Absatz."],
    ["Ueberschrift h4", "#### Kleine Ueberschrift\n\nDarunter ein Absatz."],
    ["Aufzaehlung", "- Erstens\n- Zweitens **fett**"],
    ["nummerierte Liste", "1. Erstens\n2. Zweitens"],
    ["mehrere Absaetze", "Erster Absatz.\n\nZweiter Absatz mit *kursiv*."],
    ["HTML bleibt Text", "<script>alert(1)</script> und <b>kein Fettdruck</b>."],
    ["eckige Klammern ohne Ziffer", "Siehe [Anhang] und [A1] sowie [2026]."],
  ] as const;

  for (const [name, text] of OHNE_MARKE) {
    it(`G1-${name} · gleiches innerHTML wie der gemeinsame Renderer`, () => {
      expect(antwort(text).innerHTML).toBe(gemeinsam(text).innerHTML);
    });
  }

  it("G2 · KALIBRIERUNG: MIT Marke unterscheiden sie sich — sonst pruefte G1 nichts", () => {
    // Ohne diesen Fall waere G1 auch von zwei identischen Bauteilen erfuellt, und die Fussnote
    // gaebe es gar nicht. Der Unterschied ist genau die Hochstellung.
    const text = "Hohlprofile sind zu vermeiden [1].";
    expect(antwort(text).innerHTML).not.toBe(gemeinsam(text).innerHTML);
    expect(gemeinsam(text).querySelector("sup")).toBeNull();
    expect(antwort(text).querySelector("sup")).not.toBeNull();
  });
});
