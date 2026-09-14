// @vitest-environment jsdom
// ================================================================================================
// JOB 3879 · LIEFERUNG 1 — WIE OFT WIRD WIRKLICH ABONNIERT? GEZÄHLT, NICHT GESCHÄTZT.
// ================================================================================================
//
// DER UNTERSCHIED, UM DEN ES GEHT, ist am Quelltext NICHT zu sehen: beide Hooks rufen
// `useSyncExternalStore` mit denselben drei Argumenten, beide lesen denselben `onlineManager`,
// beide liefern denselben booleschen Wert. Verschieden ist allein die IDENTITÄT des ersten
// Arguments. `useSyncExternalStore` meldet sich ab und neu an, sobald sie wechselt (so begründet in
// `apps/web/src/lib/netzzustand.ts`). Eine im Rumpf angelegte Pfeilfunktion ist bei JEDEM
// Rendervorgang eine neue — also ein Ab- und Anmelden je Bild, für einen Wert, der sich fast nie
// ändert.
//
// WARUM DAS EIN EIGENER FALL IST und nicht der Bestandswächter nebenan
// (`eine-quelle-waechter.test.ts`, W-4): W-4 zählt Dateien mit `onlineManager.subscribe`. Er bliebe
// grün, wenn jemand die Verdrahtung nur an EINE Stelle zöge und sie dort weiterhin je Bild neu
// anlegte. Dass je Hookinstanz genau EINMAL abonniert wird, ist eine Aussage über den ABLAUF und
// nur an einem gemounteten Baum messbar.
//
// WIE GEMESSEN WIRD: `onlineManager.subscribe` wird für die Dauer eines Falles umhüllt und zählt
// seine Aufrufe; danach steht wieder genau die vorgefundene Funktion da (V-0 prüft das). Der
// Zähler liegt am `onlineManager`, nicht an einem der Hooks — er sieht also jede Anmeldung, egal
// welcher Weg sie auslöst. Zurückgestellt wird ERST NACH dem Unmount (LEHREN, JOB 3044: ein
// Zurücksetzen am lebenden Baum erzeugt eine React-`act`-Warnung).
import { describe, expect, it } from "vitest";
import { onlineManager } from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useSyncExternalStore } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { useNetzOnline } from "../../apps/web/src/lib/netzzustand";
import { useOnline } from "../../apps/web/src/shell/Meldungen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** So viele Rendervorgänge bekommt jeder Hook — dieselbe Zahl für alle Fälle, sonst vergleicht man nichts. */
const BILDER = 5;

function Probe({ hook, bild }: { hook: () => boolean; bild: number }): JSX.Element {
  // `bild` steht wirklich im Ergebnis: ohne eine sich ändernde Ausgabe könnte React einen
  // Rendervorgang verwerfen, und der Fall zählte weniger Bilder, als er behauptet.
  return createElement("span", null, `${bild}:${hook() ? "online" : "offline"}`);
}

/** Rendert `hook` `BILDER`-mal in denselben Baum und gibt zurück, wie oft dabei abonniert wurde. */
function anmeldungenBei(hook: () => boolean): number {
  const behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  const wurzel = createRoot(behaelter);
  const vorher = onlineManager.subscribe;
  const warEigen = Object.prototype.hasOwnProperty.call(onlineManager, "subscribe");
  let anmeldungen = 0;
  onlineManager.subscribe = ((melden: (online: boolean) => void) => {
    anmeldungen += 1;
    return vorher.call(onlineManager, melden);
  }) as typeof onlineManager.subscribe;
  try {
    for (let bild = 1; bild <= BILDER; bild += 1) {
      act(() => {
        wurzel.render(createElement(Probe, { hook, bild }));
      });
    }
  } finally {
    act(() => {
      wurzel.unmount();
    });
    if (warEigen) {
      onlineManager.subscribe = vorher;
    } else {
      // `Reflect.deleteProperty` und nicht `= undefined`: die Methode steht am Prototyp
      // (`Subscribable`). Eine eigene Eigenschaft mit dem Wert `undefined` verdeckte sie — das wäre
      // kein Zurückstellen, sondern ein zweiter Schaden.
      Reflect.deleteProperty(onlineManager, "subscribe");
    }
    behaelter.remove();
  }
  return anmeldungen;
}

/**
 * Die Bauform, gegen die dieser Fall steht — hier absichtlich nachgebaut, damit die Messung eine
 * bekannte Antwort hat. Zeichengleich mit dem, was `shell/Meldungen.tsx` bis zu diesem Auftrag tat:
 * die Abonnierfunktion entsteht im Rumpf und ist bei jedem Bild eine andere.
 */
function useJeBildNeu(): boolean {
  return useSyncExternalStore(
    (melden: () => void) => onlineManager.subscribe(melden),
    () => onlineManager.isOnline(),
    () => true,
  );
}

describe("JOB 3879 · je Hookinstanz EINE Anmeldung, nicht eine je Bild", () => {
  it("V-0 · KALIBRIERUNG: die Hülle zählt wirklich und wird bytegleich zurückgenommen", () => {
    // Ohne diesen Fall wäre V-2 auch dann grün, wenn die Hülle gar nicht greift (0 ≠ 1 fiele zwar
    // auf, aber erst als Rätsel). Und: bliebe die Hülle stehen, verfälschte sie jeden späteren
    // Fall in derselben Datei.
    const vorher = onlineManager.subscribe;
    expect(
      anmeldungenBei(useJeBildNeu),
      "eine im Rumpf angelegte Verdrahtung meldet je Bild an",
    ).toBe(BILDER);
    expect(onlineManager.subscribe, "die vorgefundene Funktion steht wieder da").toBe(vorher);
  });

  it("V-1 · `useNetzOnline` aus `lib/netzzustand` abonniert genau einmal", () => {
    expect(anmeldungenBei(useNetzOnline)).toBe(1);
  });

  it("V-2 · `useOnline` aus `shell/Meldungen` abonniert ebenfalls genau einmal", () => {
    // GEMESSEN VOR DEM UMBAU (JOB 3879, Runde 1): 5 Anmeldungen bei 5 Bildern — die Zahl wuchs mit
    // n, weil `useOnline` seine Abonnierfunktion im Rumpf anlegte. Danach: 1.
    expect(anmeldungenBei(useOnline)).toBe(1);
  });
});
