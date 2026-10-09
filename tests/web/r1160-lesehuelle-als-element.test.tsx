// @vitest-environment jsdom
// ================================================================================================
// R-1160 — DIE LESEHÜLLE ENTSTEHT ALS ELEMENT, NICHT IM HTML.
// ================================================================================================
//
// HERKUNFT: `d037-sanitizing-huellengrenze.test.tsx` (JOB 2427) hält fest, dass eine Hülle, die vor
// dem Sanitizing ins HTML geschrieben wird, ihre Klasse verliert — und dass der tragende Weg ein
// React-Element außerhalb von `SanitizedHtml` ist. Gebaut war im Lesepfad nur diese Aussage, nicht
// die Hülle selbst (`index.css`, Kommentar an `.prose-kw table`: „Was nicht gebaut ist").
//
// DIESE DATEI hält den gebauten Weg als Verhalten fest:
//   A  Im Lesepfad steht jede Tabelle der obersten Ebene in einer gekennzeichneten Hülle.
//   B  Die Kennzeichnung kommt NICHT aus dem Inhalt: dieselbe Markierung im HTML fällt weiter, die
//      Allowlist ist unverändert, Gefährliches in der Tabelle bleibt entfernt.
//   C  Die Zerlegung verliert und verdoppelt nichts; ohne Tabelle bleibt das Markup das bisherige.
import { describe, expect, it } from "vitest";
import { createElement } from "../../apps/web/node_modules/react";
import {
  LESEHUELLE_ATTR,
  SanitizedHtml,
  zerlegeLesekoerper,
} from "../../apps/web/src/components/SanitizedHtml";
import { KoReadStatement } from "../../apps/web/src/components/ko/KoRead";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
import { makeKo, renderMarkup } from "../../apps/web/src/test/render";

const TABELLE = "<table><tbody><tr><td>Ventil V-12</td><td>jährlich</td></tr></tbody></table>";
const HUELLE = `[${LESEHUELLE_ATTR}="tabelle"]`;

function baum(html: string): HTMLElement {
  const wurzel = document.createElement("div");
  wurzel.innerHTML = html;
  return wurzel;
}

function lesen(html: string): HTMLElement {
  return baum(renderMarkup(createElement(SanitizedHtml, { html, lesehuellen: true })));
}

describe("A · im Lesepfad trägt die Tabelle ihre Hülle", () => {
  it("die Tabelle steht in einem gekennzeichneten, waagerecht scrollenden Element", () => {
    const wurzel = lesen(`<p>Vorher</p>${TABELLE}<p>Nachher</p>`);
    const huelle = wurzel.querySelector("table")?.closest<HTMLElement>(HUELLE);

    expect(huelle, "die Tabelle hat keine Lesehülle").not.toBeNull();
    expect(huelle?.classList.contains("overflow-x-auto")).toBe(true);
    expect(huelle?.querySelectorAll("td")).toHaveLength(2);
  });

  it("die echte Leseansicht (KoReadStatement) zeichnet die Hülle", () => {
    const ko = makeKo({ bodyHtml: `<h2>Wartung</h2>${TABELLE}` });
    const wurzel = baum(renderMarkup(createElement(KoReadStatement, { ko })));
    const prosa = wurzel.querySelector(".prose-kw");

    expect(prosa, "der Lesekörper fehlt").not.toBeNull();
    expect(prosa?.querySelector("table")?.closest(HUELLE)).not.toBeNull();
    expect(prosa?.querySelector("h2")?.textContent).toBe("Wartung");
  });

  it("jede Tabelle der obersten Ebene bekommt ihre eigene Hülle", () => {
    const wurzel = lesen(`${TABELLE}<p>Zwischen</p>${TABELLE}`);

    expect(wurzel.querySelectorAll(HUELLE)).toHaveLength(2);
    for (const huelle of wurzel.querySelectorAll(HUELLE)) {
      expect(huelle.querySelectorAll("table")).toHaveLength(1);
    }
  });
});

describe("B · die Kennzeichnung stammt nicht aus dem Inhalt", () => {
  it("dieselbe Markierung im HTML fällt weiter beim Sanitizing — die Grenze bleibt", () => {
    const fremd = `<div ${LESEHUELLE_ATTR}="tabelle" class="overflow-x-auto"><p>Fremd</p></div>`;

    expect(baum(sanitizeHtml(fremd)).querySelector(HUELLE)).toBeNull();
    expect(baum(sanitizeHtml(fremd)).querySelector(".overflow-x-auto")).toBeNull();
    // Auch über den Lesepfad: ohne Tabelle entsteht keine Hülle, die Inhaltsmarkierung bleibt weg.
    expect(lesen(fremd).querySelector(HUELLE)).toBeNull();
  });

  it("eine vom Inhalt mitgebrachte Hülle um die Tabelle verdoppelt sich nicht", () => {
    const wurzel = lesen(`<div ${LESEHUELLE_ATTR}="tabelle">${TABELLE}</div>`);

    // Die Tabelle steckt im (bereinigten) div — keine oberste Ebene, also keine Hülle. Die
    // Markierung des Inhalts selbst ist gefallen.
    expect(wurzel.querySelectorAll(HUELLE)).toHaveLength(0);
    expect(wurzel.querySelectorAll("table")).toHaveLength(1);
  });

  it("Gefährliches in der Tabelle bleibt entfernt — die Hülle umgeht den Sanitizer nicht für den Inhalt", () => {
    const wurzel = lesen(
      '<table><tr><td><img src="x" onerror="alert(1)">Zelle</td></tr></table><script>alert(2)</script>',
    );

    expect(wurzel.querySelector(HUELLE)).not.toBeNull();
    expect(wurzel.querySelector("[onerror]")).toBeNull();
    expect(wurzel.querySelector("script")).toBeNull();
    expect(wurzel.textContent).toContain("Zelle");
  });
});

describe("C · die Zerlegung ist verlustfrei und bleibt ohne Tabelle unsichtbar", () => {
  it("die Teile ergeben aneinandergereiht genau die sanitisierte Ausgabe", () => {
    const sauber = sanitizeHtml(
      `<h2>Kopf</h2><p>a<br>b</p>${TABELLE}<div class="panel"><p>Block</p></div>${TABELLE}<p>Ende</p>`,
    );
    const teile = zerlegeLesekoerper(sauber);

    expect(teile.map((t) => t.html).join("")).toBe(sauber);
    expect(teile.map((t) => t.art)).toEqual(["fluss", "tabelle", "fluss", "tabelle", "fluss"]);
  });

  it("eine verschachtelte Tabelle (im Block, in der Zelle) wird nicht herausgeschnitten", () => {
    const innen = `<div class="panel">${TABELLE}</div><table><tr><td>${TABELLE}</td></tr></table>`;
    const teile = zerlegeLesekoerper(sanitizeHtml(innen));

    expect(teile.map((t) => t.art)).toEqual(["fluss", "tabelle"]);
    const wurzel = lesen(innen);
    expect(wurzel.querySelectorAll(HUELLE)).toHaveLength(1);
    expect(wurzel.querySelector(".panel table")?.closest(HUELLE)).toBeNull();
  });

  it("ohne Tabelle — oder ohne Lesehülle — bleibt das Markup exakt das bisherige", () => {
    const text = '<p>Nur <strong>Text</strong>.</p><div class="panel-info"><p>Hinweis</p></div>';
    const bisher = `<div class="prose-kw">${sanitizeHtml(text)}</div>`;

    expect(
      renderMarkup(
        createElement(SanitizedHtml, { html: text, className: "prose-kw", lesehuellen: true }),
      ),
    ).toBe(bisher);
    expect(
      renderMarkup(
        createElement(SanitizedHtml, { html: `${text}${TABELLE}`, className: "prose-kw" }),
      ),
    ).toBe(`<div class="prose-kw">${sanitizeHtml(`${text}${TABELLE}`)}</div>`);
  });
});
