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
//   · der Kasten (bei SVG-Formen reicht eine Ausdehnung, eine waagrechte Linie hat Höhe 0);
//   · DIE VERDECKUNG, per `elementFromPoint` an MESSPUNKTEN, die auf dem Element liegen:
//       – HTML: die Mitte des ersten Zeilenkastens (`getClientRects()[0]`) — bei einem umbrochenen
//         Inline-Element läge die Mitte des Gesamtkastens womöglich auf dem Nachbarn;
//       – SVG-Formen (`getTotalLength`/`getPointAtLength`/`getScreenCTM`): neun Punkte AUF der Form,
//         10 % bis 90 % ihrer Länge — die Mitte des Kastens einer schrägen Linie liegt nicht auf ihr,
//         und eine gestrichelte Linie kann an einem einzelnen Punkt gerade eine Lücke haben;
//       – andere SVG-Elemente: die Mitte ihres Kastens.
//     Jeder Treffer wird eingeordnet: das Element selbst oder ein Nachkomme („selbst"), ein fremdes
//     Element darüber („fremd") oder ein Durchfall — kein Treffer, oder der Treffer ist ein
//     VORFAHRE (der Hit-Test ging durch das Element hindurch, z. B. `pointer-events: none` oder ein
//     Punkt in der Lücke einer Strichelung). Ein Durchfall beweist WEDER Sicht NOCH Verdeckung.
//
// DREI AUSGÄNGE, UND „SICHTBAR" NUR MIT BELEG (Befund B1, Ben Runde 1 zu GRAPH-BROWSER-RECHTE):
//   · `sichtbar: true` nur, wenn kein Stilgrund vorliegt UND mindestens ein Messpunkt das Element
//     selbst trifft;
//   · `sichtbar: false, messbar: true` bei einem benannten Mangel (Stil, Kasten, fremder Treffer);
//   · `messbar: false` (und `sichtbar: false`), wenn die Verdeckung NICHT gemessen werden konnte:
//     `elementFromPoint` fehlt, kein Messpunkt im Sichtfenster, oder jeder Messpunkt fiel durch.
//     Der Grund beginnt dann mit „NICHT MESSBAR" — nie steht dort „sichtbar".
//   Früher übersprang der Rückfall SVG-Formen ganz und meldete dennoch „sichtbar"; ein fehlender
//   Treffer (`elementFromPoint` → `null`) galt ebenfalls als „sichtbar". Beides ist hier geschlossen.
//
// FÜR VERBRAUCHER, DIE NUR JA/NEIN KENNEN: `sichtbarOhneCheck(e)` WIRFT bei `messbar: false` mit
// „SICHTMESSUNG NICHT MOEGLICH: …" — so bleibt die fehlende Messfähigkeit im Befund des
// Verbrauchers erhalten, statt still zu „unsichtbar" oder „sichtbar" zu werden.
//
// UND WENN SCHON DER STIL NICHT MESSBAR IST, SAGT ER ES: ohne `getComputedStyle`/
// `getBoundingClientRect` WIRFT der Rückfall mit einem ausgeschriebenen Satz.
//
// Kalibriert wird das zweifach:
//   · DOM-frei, im Tor: `tests/support/sichtRueckfall.test.ts` (Treffer selbst/fremd/Vorfahre/null,
//     SVG-Punkte auf der Form, fehlendes `elementFromPoint`, Messpunkt ausserhalb);
//   · im echten Chromium, dem das Verfahren dafür GENOMMEN wird:
//     `tests/wissensbeziehungen-browser-rechte/tastatur-schmal-rechte-im-echten-browser.test.ts`
//     (K3 durchsichtiger/verborgener Vorfahre, K4 Verdeckung, K6 ganz ohne Messverfahren, K8 SVG-Linie
//     frei/verdeckt/durchfallend, K9 Hit-Test ohne Treffer).

/**
 * Definiert im Browser `sichtRueckfall(e) → { sichtbar, messbar, grund, verfahren }` und
 * `sichtbarOhneCheck(e) → boolean` (wirft bei fehlender Messfähigkeit).
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
    const verfahren = "Rueckfall ohne checkVisibility";
    const benenne = (v) => "<" + String(v.tagName || "?").toLowerCase() + (typeof v.getAttribute === "function" && v.getAttribute("data-testid") ? " " + v.getAttribute("data-testid") : "") + ">";
    const gruende = [];
    for (let v = e; v && v.nodeType === 1; v = v.parentElement) {
      const s = getComputedStyle(v);
      const wer = v === e ? "Element" : "Vorfahre " + benenne(v);
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
    if (!ausgedehnt) gruende.push("Kasten " + Math.round(r.width) + "x" + Math.round(r.height));
    if (gruende.length > 0) {
      return { sichtbar: false, messbar: true, grund: gruende.join(" / "), verfahren };
    }
    const nichtMessbar = (warum) => ({ sichtbar: false, messbar: false, grund: "NICHT MESSBAR: Verdeckung - " + warum, verfahren });
    if (typeof document.elementFromPoint !== "function") {
      return nichtMessbar("document.elementFromPoint fehlt");
    }
    if (typeof e.scrollIntoView === "function") e.scrollIntoView({ block: "center", inline: "center" });
    const punkte = [];
    let art = "Mitte des Kastens";
    const form = svg && typeof e.getTotalLength === "function" && typeof e.getPointAtLength === "function" && typeof e.getScreenCTM === "function";
    if (form) {
      art = "Punkte auf der Form";
      const laenge = e.getTotalLength();
      const ctm = e.getScreenCTM();
      if (ctm && laenge > 0) {
        for (let i = 1; i <= 9; i += 1) {
          const p = e.getPointAtLength((laenge * i) / 10);
          punkte.push({ x: ctm.a * p.x + ctm.c * p.y + ctm.e, y: ctm.b * p.x + ctm.d * p.y + ctm.f });
        }
      }
      if (punkte.length === 0) return nichtMessbar("die SVG-Form liefert keine Punkte (Laenge " + laenge + ", Bildschirmmatrix " + (ctm ? "da" : "fehlt") + ")");
    } else {
      const zeilen = !svg && typeof e.getClientRects === "function" ? e.getClientRects() : [];
      const k = zeilen.length > 0 ? zeilen[0] : e.getBoundingClientRect();
      if (zeilen.length > 0) art = "Mitte des ersten Zeilenkastens";
      punkte.push({ x: k.left + k.width / 2, y: k.top + k.height / 2 });
    }
    const imFenster = punkte.filter((p) => p.x >= 0 && p.y >= 0 && p.x < innerWidth && p.y < innerHeight);
    if (imFenster.length === 0) {
      return nichtMessbar("kein Messpunkt im Sichtfenster (" + art + ": " + punkte.map((p) => Math.round(p.x) + "," + Math.round(p.y)).join(" ") + ")");
    }
    let selbst = 0;
    const fremd = [];
    const durchfall = [];
    for (const p of imFenster) {
      const oben = document.elementFromPoint(p.x, p.y);
      if (!oben) durchfall.push("kein Treffer");
      else if (oben === e || e.contains(oben)) selbst += 1;
      else if (oben.contains(e)) durchfall.push("Treffer am Vorfahren " + benenne(oben));
      else fremd.push(benenne(oben));
    }
    if (selbst > 0) {
      return { sichtbar: true, messbar: true, grund: "sichtbar (" + selbst + "/" + imFenster.length + " " + art + " treffen das Element)", verfahren };
    }
    if (fremd.length > 0) {
      return { sichtbar: false, messbar: true, grund: "verdeckt von " + Array.from(new Set(fremd)).join(", ") + (durchfall.length > 0 ? " (weitere Punkte fielen durch: " + Array.from(new Set(durchfall)).join(", ") + ")" : ""), verfahren };
    }
    return nichtMessbar("jeder Messpunkt fiel durch das Element (" + art + "; " + Array.from(new Set(durchfall)).join(", ") + ") - pointer-events:none, Luecke der Zeichnung oder ein Browser ohne Treffer an dieser Stelle");
  };
  const sichtbarOhneCheck = (e) => {
    const b = sichtRueckfall(e);
    if (!b.messbar) {
      throw new Error("SICHTMESSUNG NICHT MOEGLICH: " + b.grund + " (" + b.verfahren + ")");
    }
    return b.sichtbar;
  };`;
