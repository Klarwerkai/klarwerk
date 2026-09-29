// ================================================================================================
// DIE SICHTMESSUNG, WENN DER BROWSER `Element.checkVisibility` NICHT KENNT — Quelltext für den Browser.
// ================================================================================================
//
// DER BEFUND, gegen den diese Datei steht: drei Beziehungsnachweise (JOB 4305
// `beziehungen-im-browser-nach-restore.integration.test.ts`, JOB 4328 `wissensnetz-nutzerweg/strecke.ts`,
// JOB 4356 `wissensbeziehungen-status/strecke.ts`) messen Sichtbarkeit mit `checkVisibility` und
// fallen ohne es auf `getComputedStyle(e)` + Kasten AM ELEMENT SELBST zurück. Diese Messung sieht
// einen durchsichtigen Vorfahren (`opacity: 0` am Container) nicht — `opacity` erbt nicht, das Kind
// meldet weiter `1` — und kein Element, das über dem gemessenen liegt. Ein solcher Rückfall meldet
// „sichtbar", wo ein Mensch nichts sieht, und das still.
//
// WAS DER RÜCKFALL HIER TUT, je Grund einzeln benannt:
//   · die GANZE Vorfahrenkette: `display: none`, `opacity: 0`, `content-visibility: hidden` an
//     jedem Vorfahren (und `display`/`opacity` am Element selbst);
//   · `visibility` am Element (sie erbt — der berechnete Wert trägt einen verdeckten Vorfahren mit,
//     und ein Kind mit ausdrücklich `visibility: visible` IST sichtbar);
//   · `color: transparent` am Element;
//   · der Kasten (bei SVG-Linien reicht eine Ausdehnung, eine waagrechte Linie hat Höhe 0);
//   · DIE VERDECKUNG: die Mitte des Elements wird ins Sichtfenster geholt, und `elementFromPoint`
//     sagt, wer dort oben liegt. Liegt dort etwas, das weder das Element noch sein Nachkomme ist,
//     ist es verdeckt. SVG-Formen sind davon ausgenommen (die Mitte einer schrägen Linie liegt
//     nicht auf ihr) — das steht dann als Grenze im Befund und nicht als „sichtbar".
//
// UND WENN AUCH DAS NICHT GEHT, SAGT ER ES: ohne `getComputedStyle`/`getBoundingClientRect` WIRFT
// der Rückfall mit einem ausgeschriebenen Satz. Ein fehlendes Messverfahren ist keine Messung —
// weder „sichtbar" noch „unsichtbar" darf dann als Ergebnis dastehen.
//
// Kalibriert wird das im echten Chromium, dem das Verfahren dafür GENOMMEN wird:
// `tests/wissensbeziehungen-browser-rechte/tastatur-schmal-rechte-im-echten-browser.test.ts`
// (K3 durchsichtiger/verborgener Vorfahre, K4 Verdeckung, K6 ganz ohne Messverfahren).

/**
 * Definiert im Browser `sichtRueckfall(e) → { sichtbar, grund, verfahren }`.
 *
 * Als Quelltext, weil die Verbraucher ihre Messfunktionen als Zeichenkette an
 * `page.evaluate`/`waitForFunction` geben (`browserweg.ts:85`, `fn`). Es enthält bewusst keinen
 * Rückstrich und kein Backtick — es wird in fremde Template-Literale eingesetzt.
 */
export const SICHT_RUECKFALL = `
  const sichtRueckfall = (e) => {
    if (typeof getComputedStyle !== "function" || typeof e.getBoundingClientRect !== "function") {
      throw new Error("SICHTMESSUNG NICHT MOEGLICH: dieser Browser kennt weder Element.checkVisibility noch getComputedStyle/getBoundingClientRect. Ohne Messverfahren gibt es keinen Sichtbarkeitsbefund - weder sichtbar noch unsichtbar.");
    }
    const gruende = [];
    for (let v = e; v && v.nodeType === 1; v = v.parentElement) {
      const s = getComputedStyle(v);
      const wer = v === e ? "Element" : "Vorfahre <" + v.tagName.toLowerCase() + (v.getAttribute("data-testid") ? " " + v.getAttribute("data-testid") : "") + ">";
      if (s.display === "none") gruende.push(wer + " display:none");
      if (Number(s.opacity) === 0) gruende.push(wer + " opacity:0");
      if (v !== e && s.contentVisibility === "hidden") gruende.push(wer + " content-visibility:hidden");
    }
    const eigen = getComputedStyle(e);
    if (eigen.visibility === "hidden" || eigen.visibility === "collapse") {
      gruende.push("visibility:" + eigen.visibility + " (eigen oder von einem Vorfahren geerbt)");
    }
    if (eigen.color === "transparent" || eigen.color === "rgba(0, 0, 0, 0)") gruende.push("color:" + eigen.color);
    const svg = typeof SVGElement === "function" && e instanceof SVGElement;
    const r = e.getBoundingClientRect();
    const ausgedehnt = svg ? r.width + r.height > 0 : r.width > 0 && r.height > 0;
    if (!ausgedehnt) {
      gruende.push("Kasten " + Math.round(r.width) + "x" + Math.round(r.height));
    } else if (svg) {
      // Keine Verdeckungsmessung an SVG-Formen: ihre Mitte liegt nicht zwingend auf ihnen.
    } else if (typeof document.elementFromPoint !== "function") {
      gruende.push("Verdeckung nicht messbar: document.elementFromPoint fehlt");
    } else if (gruende.length === 0) {
      if (typeof e.scrollIntoView === "function") e.scrollIntoView({ block: "center", inline: "center" });
      const k = e.getBoundingClientRect();
      const x = k.left + k.width / 2;
      const y = k.top + k.height / 2;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
        gruende.push("Verdeckung nicht messbar: die Mitte liegt ausserhalb des Sichtfensters (" + Math.round(x) + "," + Math.round(y) + ")");
      } else {
        const oben = document.elementFromPoint(x, y);
        if (oben && oben !== e && !e.contains(oben)) {
          gruende.push("verdeckt von <" + oben.tagName.toLowerCase() + (oben.getAttribute("data-testid") ? " " + oben.getAttribute("data-testid") : "") + ">");
        }
      }
    }
    return {
      sichtbar: gruende.length === 0,
      grund: gruende.length === 0 ? "sichtbar" : gruende.join(" / "),
      verfahren: "Rueckfall ohne checkVisibility",
    };
  };`;
