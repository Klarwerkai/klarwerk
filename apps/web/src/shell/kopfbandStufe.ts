import { type RefObject, useLayoutEffect } from "react";

// ================================================================================================
// FE-002 RUNDE 2 · DIE RECHTE GRUPPE DES KOPFBANDS MISST, OB SIE PASST — STATT ES ZU SCHÄTZEN.
// ================================================================================================
//
// Runde 1 hat die Griffe über CSS-Container-Abfragen mit festen Schwellen (560/420/250 px)
// zurücktreten lassen. Bens unabhängiger Linux-Lauf hat gezeigt, warum das nicht trägt: die
// Schwellen hingen an den Schriftmassen der Maschine, und bei 1024 px mit Firmen-CI auf
// Niederländisch lag die Suche dort 8,2 px über „Arbeitsbereiche". Eine Schwelle, die auf einem
// Rechner passt, ist auf dem nächsten eine Behauptung.
//
// DESHALB FRAGT DIE ZEILE DEN BROWSER. Nach jedem Zeichnen und bei jeder Grössenänderung (Fenster,
// Sprache, Firmenlogo, Zähler, Schriftladen) wird Stufe für Stufe gesetzt und nachgemessen, bis
// nichts mehr über den Rand der Gruppe oder der Zeile ragt und der Platzhalter „Wissen suchen" im
// Feld ungekürzt steht:
//   0  alles: Wort „Meldungen", Knopf „Seite finden ⌘K", Suchfeld „Wissen suchen"
//   1  ohne das Wort „Meldungen" (Glocke, Zahl, Name und Zeigehinweis bleiben)
//   2  ohne den breiten Knopf „Seite finden ⌘K" (der Weg bleibt unter „Arbeitsbereiche" und auf ⌘K)
//   3  die Suche kompakt: Lupe mit SICHTBAREM, zweizeiligem „Wissen suchen" — die Benennung bleibt
//      (Runde 1 zeigte hier nur die Lupe; das war Bens zweiter Befund)
// Reicht auch Stufe 3 nicht, behält die Gruppe ihren Inhalt als Mindestbreite, und die Punkte
// links brechen um („Meine Entwürfe" zweizeilig), statt dass sich Griffe überdecken.
//
// Die Stufe steht als `data-stufe` an der Gruppe; was sie ausblendet, regelt `index.css`. React
// rendert dafür nichts neu — der Messgang liest und schreibt nur dieses eine Attribut.

/** Die höchste Stufe — die kompakte, weiter beschriftete Suche. */
const LETZTE_STUFE = 3;

/**
 * Passt der Platzhalter des Suchfeldes ungekürzt hinein? Ein Feld, das nur „Search kno" zeigt,
 * benennt seinen Zweck nicht mehr — dann ist die kompakte Form mit dem ganzen Wort die bessere.
 *
 * Lauf 3 R3 (Bens Befund B1, 999 px/Englisch auf Linux: „Platzhalter 108.0 von 113.0 px" und
 * trotzdem abgeschnitten). Weder die Canvas-Messung (Runde 1) noch eine Probe-Zeile (Runde 2)
 * sehen, was Chromium IM Feld tut: ein `type="search"`-Feld reserviert neben dem Text Platz für
 * seinen Löschknopf, auch wenn es leer ist (gemessen: rund 13 px). Gefragt wird deshalb das Feld
 * selbst — ein unsichtbarer Zwilling in derselben Breite trägt den Platzhalter als Wert, und der
 * Browser meldet über `scrollWidth`, ob dieser Text samt Knopfplatz überläuft. Das echte Feld wird
 * nicht angefasst (kein Eingriff in Wert, Fokus oder Schreibmarke).
 */
function platzhalterAbgeschnitten(gruppe: HTMLElement): boolean {
  const feld = gruppe.querySelector<HTMLInputElement>(".kw-kopfband-suche input");
  if (!feld || feld.offsetParent === null || feld.placeholder === "" || !feld.parentElement) {
    return false;
  }
  const zwilling = feld.cloneNode(false) as HTMLInputElement;
  for (const name of ["id", "name", "data-testid", "aria-label", "placeholder"]) {
    zwilling.removeAttribute(name);
  }
  zwilling.setAttribute("aria-hidden", "true");
  zwilling.tabIndex = -1;
  Object.assign(zwilling.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    left: "0",
    top: "0",
    width: `${feld.getBoundingClientRect().width}px`,
  });
  zwilling.value = feld.placeholder;
  feld.parentElement.appendChild(zwilling);
  const ueber = zwilling.scrollWidth > zwilling.clientWidth;
  zwilling.remove();
  return ueber;
}

function ragtHeraus(band: HTMLElement, gruppe: HTMLElement): boolean {
  if (band.scrollWidth > band.clientWidth + 1) {
    return true;
  }
  if (platzhalterAbgeschnitten(gruppe)) {
    return true;
  }
  // Die Punkte-Navigation links darf schrumpfen (`min-w-0`) — dann läge ihr Inhalt, zuletzt
  // „Arbeitsbereiche", über der Gruppe, ohne dass die Gruppe selbst überläuft (Bens Linux-Befund,
  // gemessen hier: nl/1024 px/Firmen-CI, 14 px). Deshalb darf auch KEIN anderes Kind der Zeile über
  // seinen eigenen Kasten hinausragen.
  for (const teil of Array.from(band.children)) {
    if (teil !== gruppe && teil.scrollWidth > teil.clientWidth + 1) {
      return true;
    }
  }
  // Lauf 3 R2 (Bens Befund B1, 900 px/Niederländisch): die kompakte Suche „Kennis zoeken" lag über
  // dem Zahnrad, weil ihr Kasten enger war als ihr Inhalt. Die Suche ist der einzige schrumpffähige
  // Griff der Gruppe; ihr Inhalt darf nicht über ihren Kasten hinausragen, und kein Griff darf einen
  // anderen überdecken. (Die Zahl an der Glocke ragt absichtlich über deren Ecke — sie ist nicht
  // Teil dieser Prüfung.)
  const suche = gruppe.querySelector<HTMLElement>(".kw-kopfband-suche");
  if (suche && suche.offsetParent !== null && suche.scrollWidth > suche.clientWidth + 1) {
    return true;
  }
  const rahmen = gruppe.getBoundingClientRect();
  const kaesten: DOMRect[] = [];
  for (const kind of Array.from(gruppe.children)) {
    const r = kind.getBoundingClientRect();
    if (r.width <= 0) {
      continue;
    }
    if (r.left < rahmen.left - 0.5) {
      return true;
    }
    for (const frueher of kaesten) {
      if (Math.min(r.right, frueher.right) - Math.max(r.left, frueher.left) > 0.5) {
        return true;
      }
    }
    kaesten.push(r);
  }
  return false;
}

/** Setzt die niedrigste Stufe, bei der die Gruppe passt, und gibt sie zurück. */
function stufeAnpassen(band: HTMLElement, gruppe: HTMLElement): number {
  gruppe.style.minWidth = "";
  for (let stufe = 0; stufe <= LETZTE_STUFE; stufe += 1) {
    gruppe.dataset.stufe = String(stufe);
    if (!ragtHeraus(band, gruppe)) {
      return stufe;
    }
  }
  // Auch die kompakteste Form passt nicht: die Gruppe hält ihren Inhalt, links wird umgebrochen.
  const kaesten = Array.from(gruppe.children)
    .map((k) => k.getBoundingClientRect())
    .filter((r) => r.width > 0);
  if (kaesten.length > 0) {
    const breite =
      Math.max(...kaesten.map((r) => r.right)) - Math.min(...kaesten.map((r) => r.left));
    gruppe.style.minWidth = `${Math.ceil(breite)}px`;
  }
  return LETZTE_STUFE;
}

/**
 * Hält die Stufe aktuell: nach jedem Zeichnen und bei jeder Grössenänderung der beobachteten
 * Teile. Der Beobachter meldet nur Endzustände, die sich gegenüber dem zuletzt gemeldeten geändert
 * haben — der Messgang selbst, der am Ende dieselben Masse hinterlässt, löst deshalb keine Schleife
 * aus.
 */
export function useKopfbandStufe(
  bandRef: RefObject<HTMLElement>,
  gruppeRef: RefObject<HTMLElement>,
  /** Wechselt die Bauform (schmal/breit), stehen andere Griffe in der Gruppe — neu beobachten. */
  bauform: string,
): void {
  useLayoutEffect(() => {
    const band = bandRef.current;
    const gruppe = gruppeRef.current;
    if (band && gruppe) {
      stufeAnpassen(band, gruppe);
    }
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `bauform` ändert, welche Griffe die Gruppe trägt.
  useLayoutEffect(() => {
    const band = bandRef.current;
    const gruppe = gruppeRef.current;
    if (!band || !gruppe || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    let rahmen = 0;
    const beobachter = new ResizeObserver(() => {
      cancelAnimationFrame(rahmen);
      rahmen = requestAnimationFrame(() => stufeAnpassen(band, gruppe));
    });
    beobachter.observe(band);
    for (const teil of Array.from(band.querySelectorAll(".kw-kopfband-marke, nav"))) {
      beobachter.observe(teil);
    }
    for (const kind of Array.from(gruppe.children)) {
      beobachter.observe(kind);
    }
    // Lauf 3 R2 (Bens Befund B1): eine nachgeladene Schrift verbreitert den Platzhalter, ohne dass
    // sich ein beobachteter KASTEN ändert — das Feld behält seine Flex-Breite. Deshalb wird nach
    // jedem Schriftladen ausdrücklich neu gemessen.
    const schriften = typeof document !== "undefined" ? document.fonts : undefined;
    const nachSchrift = (): void => {
      cancelAnimationFrame(rahmen);
      rahmen = requestAnimationFrame(() => stufeAnpassen(band, gruppe));
    };
    schriften?.addEventListener?.("loadingdone", nachSchrift);
    let aktiv = true;
    void schriften?.ready?.then(() => {
      if (aktiv) {
        nachSchrift();
      }
    });
    return () => {
      aktiv = false;
      cancelAnimationFrame(rahmen);
      beobachter.disconnect();
      schriften?.removeEventListener?.("loadingdone", nachSchrift);
    };
  }, [bandRef, gruppeRef, bauform]);
}
