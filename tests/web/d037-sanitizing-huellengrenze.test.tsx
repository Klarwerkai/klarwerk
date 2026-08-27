// @vitest-environment jsdom
// ================================================================================================
// JOB 2427 · D1 — WARUM EINE HÜLLE NICHT INS HTML GESCHRIEBEN WERDEN KANN.
// ================================================================================================
//
// HERKUNFT: Beim Bau der Design-Scheibe D-037 (JOB 2417) sollte jede breite Tabelle im Lesepfad
// eine waagerecht scrollende Hülle bekommen. Der naheliegende Weg — jede `<table>` im bodyHtml in
// ein `<div class="overflow-x-auto">` wickeln, bevor es an `SanitizedHtml` geht — trägt NICHT:
// `SanitizedHtml` sanitisiert erst NACH der Übergabe, und `richText.ts` lässt an einem `div` nur
// acht benannte Blockklassen durch. Die Hülle hätte im Quelltext gestanden und im Ergebnis
// gefehlt — sichtbar erst an der Darstellung, nicht im Test.
//
// WAS DIESE DATEI IST: die Zusicherung dazu, nicht die Notiz. Sie hält drei Dinge als VERHALTEN
// fest, damit die nächste Scheibe an dieser Fläche nicht dieselbe Stunde verliert:
//
//   A  Der Fall selbst: die gewickelte Hülle verliert ihre Klasse.
//   B  Die Reichweite: WELCHE Klassen überleben — und dass es genau diese acht sind.
//   C  Der Weg, der trägt: was React rendert, geht nicht durch die Allowlist.
//
// WARUM DAS EINE SICHERHEITSGRENZE IST UND KEIN DARSTELLUNGSDETAIL: `ALLOWED_DIV_CLASSES` ist
// Teil des Allowlist-Sanitizers für FREMDEN Inhalt (Import, Paste, Add-in). Wer eine Klasse
// hinzufügt, um eine Hülle durchzulassen, weitet diese Grenze für jeden sanitisierten Inhalt —
// nicht nur für die eigene Scheibe. Genau deshalb machen die Fälle A und B hier rot, sobald
// jemand die Liste anfasst: Die Aufweichung soll auffallen, nicht durchrutschen.
import { describe, expect, it } from "vitest";
import { createElement } from "../../apps/web/node_modules/react";
import { SanitizedHtml } from "../../apps/web/src/components/SanitizedHtml";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
import { renderMarkup } from "../../apps/web/src/test/render";

/** Eine Tabelle, wie sie aus Import oder Paste in einem KO-Body landet. */
const TABELLE = "<table><tbody><tr><td>Ventil V-12</td><td>jährlich</td></tr></tbody></table>";

/** Die acht Blockklassen, die der Sanitizer heute an einem `div` durchlässt. */
const ERLAUBTE_DIV_KLASSEN = [
  "panel",
  "callout",
  "panel-info",
  "panel-note",
  "panel-warning",
  "panel-success",
  "attachment",
  "panel-external",
] as const;

/** Klassen, mit denen man eine Scroll-Hülle bauen WOLLTE — keine davon steht in der Liste. */
const HUELLEN_KLASSEN = ["overflow-x-auto", "overflow-auto", "overflow-x-scroll"] as const;

function gewickelt(klasse: string): string {
  return `<div class="${klasse}">${TABELLE}</div>`;
}

/** Parst sanitisiertes HTML und gibt die Wurzel zurück — geprüft wird am Baum, nicht am String. */
function baum(html: string): HTMLElement {
  const wurzel = document.createElement("div");
  wurzel.innerHTML = html;
  return wurzel;
}

describe("A · der Fall: eine gewickelte Hülle verliert ihre Klasse", () => {
  it('`div class="overflow-x-auto"` kommt ohne Klasse aus dem Sanitizer', () => {
    const wurzel = baum(sanitizeHtml(gewickelt("overflow-x-auto")));
    const huelle = wurzel.querySelector("div");

    expect(huelle, "das div selbst bleibt stehen — nur seine Klasse fällt").not.toBeNull();
    expect(
      huelle?.getAttribute("class"),
      "überlebte die Klasse, wäre die Hülle über das HTML baubar — sie tut es nicht",
    ).toBeNull();
    // Und der Selektor, mit dem eine Scroll-Hülle gefunden würde, greift ins Leere:
    expect(wurzel.querySelector(".overflow-x-auto")).toBeNull();
  });

  it("das gilt für JEDE Schreibweise einer Scroll-Klasse, nicht nur die eine", () => {
    for (const klasse of HUELLEN_KLASSEN) {
      const wurzel = baum(sanitizeHtml(gewickelt(klasse)));
      expect(wurzel.querySelector(`.${klasse}`), `„${klasse}" darf nicht überleben`).toBeNull();
    }
  });

  it("auch ein `data-`Attribut trägt die Markierung nicht durch", () => {
    // Der zweite naheliegende Griff: die Hülle statt über eine Klasse über ein Datenattribut
    // markieren. `ALLOWED_ATTRS.div` (richText.ts:63) kennt nur `class` — alles andere fällt.
    const wurzel = baum(sanitizeHtml(`<div data-kw-scrollhuelle="">${TABELLE}</div>`));

    expect(wurzel.querySelector("[data-kw-scrollhuelle]")).toBeNull();
  });

  it("die Tabelle selbst kommt UNVERSEHRT durch — es fällt nur die Hülle", () => {
    // Ohne diesen Fall wäre „die Klasse fällt" nicht von „alles fällt" zu unterscheiden.
    const wurzel = baum(sanitizeHtml(gewickelt("overflow-x-auto")));

    expect(wurzel.querySelectorAll("table")).toHaveLength(1);
    expect(wurzel.querySelectorAll("td")).toHaveLength(2);
    expect(wurzel.textContent).toContain("Ventil V-12");
  });
});

describe("B · die Reichweite: welche Klassen überleben — und welche nicht", () => {
  it("die acht erlaubten Blockklassen kommen durch", () => {
    // Gemessen, nicht abgeschrieben: Jede wird einzeln durch den echten Sanitizer geschickt.
    for (const klasse of ERLAUBTE_DIV_KLASSEN) {
      const wurzel = baum(sanitizeHtml(`<div class="${klasse}"><p>Text</p></div>`));
      expect(wurzel.querySelector(`.${klasse}`), `„${klasse}" sollte erlaubt sein`).not.toBeNull();
    }
  });

  it("und NUR sie — eine erlaubte Klasse rettet keine fremde daneben", () => {
    // Der Fall, der „hat meine Klasse überlebt, weil sie zufällig passt?" beantwortet: Wer
    // `panel overflow-x-auto` schreibt, behält `panel` und verliert die Hülle. Die Liste filtert
    // je Klasse, nicht je Attribut (richText.ts:122-124).
    const wurzel = baum(sanitizeHtml(`<div class="panel overflow-x-auto">${TABELLE}</div>`));
    const div = wurzel.querySelector("div");

    expect(div?.classList.contains("panel")).toBe(true);
    expect(div?.classList.contains("overflow-x-auto")).toBe(false);
  });

  it("eine unbekannte Klasse fällt vollständig — es bleibt kein leeres class-Attribut", () => {
    const wurzel = baum(sanitizeHtml('<div class="voellig-fremd"><p>Text</p></div>'));

    expect(wurzel.querySelector("div")?.getAttribute("class")).toBeNull();
  });
});

describe("C · der Weg, der trägt: React-Hülle außerhalb des sanitisierten HTML", () => {
  it("was React rendert, geht NICHT durch die Allowlist — die Klasse bleibt", () => {
    // Das ist die Umsetzung aus JOB 2417 in ihrer kleinsten Form: Die Hülle ist ein
    // React-Element, sanitisiert wird nur, was IN `SanitizedHtml` hineingereicht wird.
    const markup = renderMarkup(
      createElement(
        "div",
        { className: "overflow-x-auto" },
        createElement(SanitizedHtml, { html: TABELLE }),
      ),
    );
    const wurzel = baum(markup);
    const tabelle = wurzel.querySelector("table");

    expect(tabelle, "die Tabelle wird gerendert").not.toBeNull();
    expect(
      tabelle?.closest(".overflow-x-auto"),
      "die React-Hülle überlebt, weil sie nie durch den Sanitizer läuft",
    ).not.toBeNull();
  });

  it("der Unterschied ist der Ort, nicht die Klasse — dieselbe Klasse, zwei Ergebnisse", () => {
    // Die beiden Wege nebeneinander, damit der Punkt ohne Kommentar lesbar ist.
    const ueberHtml = baum(sanitizeHtml(gewickelt("overflow-x-auto")));
    const ueberReact = baum(
      renderMarkup(
        createElement(
          "div",
          { className: "overflow-x-auto" },
          createElement(SanitizedHtml, { html: TABELLE }),
        ),
      ),
    );

    expect(ueberHtml.querySelector(".overflow-x-auto")).toBeNull();
    expect(ueberReact.querySelector(".overflow-x-auto")).not.toBeNull();
  });
});
