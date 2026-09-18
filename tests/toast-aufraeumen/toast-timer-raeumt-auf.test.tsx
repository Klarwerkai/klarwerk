// @vitest-environment jsdom
// ================================================================================================
// JOB 4339 — DER TOAST-TIMER RÄUMT HINTER SICH AUF.
// ================================================================================================
//
// DER BEFUND, gemessen und nicht vermutet: Tor JOB 4330 R2 (18.09. 00:59:56) endete mit
// `Test Files 2036 passed · Tests 19713 passed | 10 skipped · Errors 1 error` → `✖ test rot`.
// Kein einziger Test war rot. Der Fehler stand in `jobs/4330/runde-2/tor.err`:
//
//   ReferenceError: window is not defined
//    ❯ getCurrentEventPriority react-dom.development.js:10993:22
//    ❯ dispatchReducerAction  react-dom.development.js:16617:14
//    ❯ Timeout._onTimeout     apps/web/src/app/ToastContext.tsx:38:29
//   „This error originated in tests/import-anleitung-modus/sprachwechsel-import-meldungen.test.tsx …
//    caught after test environment was torn down."
//
// URSACHE: `push` setzte einen 4-Sekunden-Timer, verwahrte seine Kennung aber nirgends. Endete eine
// Testdatei innerhalb dieser vier Sekunden nach einem Toast, feuerte der Timer in eine abgebaute
// Umgebung. Das ist kein Testproblem, sondern ein Produktfehler: auch im Browser feuert der Timer
// nach dem Abbau des Providers in einen abgebauten Reducer, und ein weggeklickter Toast setzt
// später ein zweites, unnötiges „remove" auf eine längst entfernte Kennung ab.
//
// WAS HIER GEMESSEN WIRD — die Zahl der offenen Timer, nicht eine Behauptung darüber:
//   A  Abbau des Providers → 0 offene Timer (vor der Reparatur: 1).
//   B  Wegklicken → Timer weg, kein zweites `remove` nach Ablauf der vier Sekunden.
//   C  Unverändertes Verhalten: 3999 ms Toast da, bei 4000 ms weg (vor wie nach der Reparatur grün).
//   D  Zwei Toasts, einer weggeklickt, einer läuft aus — beide Wege getrennt belegt.
//   E  Mehr Toasts, als gleichzeitig angezeigt werden: auch der verdrängte Timer wird beim Abbau geräumt.
//   F  `dismiss` NACH dem Ablauf ist harmlos (die Kennung ist dann schon weg).
//   G  Nach dem Ablauf ist auch der MAP-Eintrag weg — was die Timerzahl allein nicht sieht.
//
// Die Renderzählung ist der Nachweis für „kein zweites remove": `removeToast` liefert IMMER ein
// neues Zustandsobjekt, ein überflüssiger Dispatch erzeugt also zwingend einen weiteren Rendergang.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ToastProvider, useToast } from "../../apps/web/src/app/ToastContext";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ------------------------------------------------------------------------------------------------
// DIE FRIST IST EIN VERTRAGSWERT AUS DEM AUFTRAG — NICHT AUS DEM PRODUKT (BENs Befund, Runde 1).
// ------------------------------------------------------------------------------------------------
// Runde 1 las `AUTO_DISMISS_MS` aus `ToastContext.tsx` und benutzte den gelesenen Wert als Sollwert.
// BEN hat gemessen, was das wert ist: mit `4000 → 8000` im Produkt blieb Fall C GRÜN
// (Kennung 443eabd3aa754fd3a20a67a78f5ee8c1). Ein Sollwert, der aus der geprüften Umsetzung stammt,
// kann sie nicht prüfen — er wandert mit.
//
// Deshalb steht die Zusage hier als LITERAL und ihre Herkunft ist der Auftrag, nicht der Quelltext:
//   JOB 4339 §1 · „Ein Toast verschwindet nach 4 s von selbst — das bleibt."
//   JOB 4339 §5.4(c) · „`push`, `advanceTimersByTime(3999)` → Toast da; `+1` → weg."
// Fall C schreibt 3999 und 1 ausdrücklich aus, damit auch eine ZU KURZE Produktfrist auffliegt.
const FRIST_MS = 4000;

// ------------------------------------------------------------------------------------------------
// Die Bühne: der ECHTE Provider, ein Verbraucher, der seine Bedienung nach aussen reicht.
// ------------------------------------------------------------------------------------------------
interface Spiegel {
  toasts: ReadonlyArray<{ id: string; message: string }>;
  push: (kind: "success" | "error" | "info", message: string) => void;
  dismiss: (id: string) => void;
}

let spiegel: Spiegel | null = null;
let rendergaenge = 0;

function Buehne(): JSX.Element {
  const { toasts, push, dismiss } = useToast();
  rendergaenge += 1;
  spiegel = { toasts, push, dismiss };
  return createElement(
    "ul",
    { "data-pruef": "toasts" },
    toasts.map((t) => createElement("li", { key: t.id, "data-id": t.id }, t.message)),
  );
}

function buehne(): Spiegel {
  if (!spiegel) {
    throw new Error("Bühne ist nicht montiert");
  }
  return spiegel;
}

let behaelter: HTMLDivElement | null = null;
let wurzel: ReturnType<typeof createRoot> | null = null;

function montieren(): void {
  behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  wurzel = createRoot(behaelter);
  const w = wurzel;
  act(() => {
    w.render(createElement(ToastProvider, null, createElement(Buehne)));
  });
}

function abbauen(): void {
  const w = wurzel;
  if (w) {
    act(() => {
      w.unmount();
    });
  }
  behaelter?.remove();
  wurzel = null;
  behaelter = null;
  spiegel = null;
}

/** Was ein Mensch auf der Fläche liest — aus dem DOM, nicht aus dem Zustand. */
function texte(): string[] {
  return Array.from(behaelter?.querySelectorAll("li") ?? []).map((li) => li.textContent ?? "");
}

function kennungVon(nachricht: string): string {
  const treffer = buehne().toasts.find((t) => t.message === nachricht);
  if (!treffer) {
    throw new Error(`Toast „${nachricht}" steht nicht im Bestand`);
  }
  return treffer.id;
}

describe("JOB 4339 · Der Toast-Timer räumt hinter sich auf", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rendergaenge = 0;
    spiegel = null;
  });

  afterEach(() => {
    abbauen();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("A · nach dem Abbau des Providers steht kein Timer mehr offen", () => {
    montieren();
    act(() => buehne().push("success", "Gespeichert."));
    expect(vi.getTimerCount(), "der Auto-Timer des Toasts muss laufen").toBe(1);

    const vorAbbau = rendergaenge;
    abbauen();

    expect(
      vi.getTimerCount(),
      "nach dem Abbau steht noch 1 Timer — er feuert in einen abgebauten Reducer (ToastContext.tsx:38)",
    ).toBe(0);
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(rendergaenge, "nach dem Abbau darf nichts mehr rendern").toBe(vorAbbau);
  });

  it("B · Wegklicken räumt den Auto-Timer weg — kein zweites remove nach 4 s", () => {
    montieren();
    act(() => buehne().push("info", "Eins"));
    expect(vi.getTimerCount()).toBe(1);

    const id = kennungVon("Eins");
    act(() => buehne().dismiss(id));

    expect(texte()).toEqual([]);
    expect(vi.getTimerCount(), "der Auto-Timer des weggeklickten Toasts läuft weiter").toBe(0);

    const nachDismiss = rendergaenge;
    act(() => vi.advanceTimersByTime(FRIST_MS));
    expect(rendergaenge, "ein zweites remove auf die entfernte Kennung hat gerendert").toBe(
      nachDismiss,
    );
    expect(texte()).toEqual([]);
  });

  // Die beiden Zahlen 3999 und 1 sind der Vertrag aus dem Auftrag, ausgeschrieben und nicht
  // gerechnet. Sie fangen BEIDE Richtungen: eine ZU LANGE Produktfrist scheitert an der zweiten
  // Zusicherung („verschwindet nicht von selbst"), eine ZU KURZE an der ersten („verschwindet zu
  // früh"). Ein Test, der `FRIST_MS - 1` aus dem Produkt ableitete, wanderte mit beiden mit.
  it("C · Verhalten unverändert: bei 3999 ms steht der Toast, eine Millisekunde später ist er weg", () => {
    montieren();
    act(() => buehne().push("success", "Gespeichert."));
    expect(texte()).toEqual(["Gespeichert."]);

    act(() => vi.advanceTimersByTime(3999));
    expect(texte(), "nach 3999 ms schon weg — die Frist ist kürzer als die zugesagten 4 s").toEqual(
      ["Gespeichert."],
    );

    act(() => vi.advanceTimersByTime(1));
    expect(
      texte(),
      "nach 4000 ms noch sichtbar — die Frist ist länger als die zugesagten 4 s",
    ).toEqual([]);
    expect(vi.getTimerCount(), "nach 4000 ms läuft noch ein Timer").toBe(0);
  });

  it("D · zwei Toasts: einer weggeklickt, einer läuft aus — je genau ein Weg", () => {
    montieren();
    act(() => {
      buehne().push("info", "Eins");
      buehne().push("error", "Zwei");
    });
    expect(texte()).toEqual(["Eins", "Zwei"]);
    expect(vi.getTimerCount()).toBe(2);

    act(() => buehne().dismiss(kennungVon("Eins")));
    expect(texte()).toEqual(["Zwei"]);
    expect(vi.getTimerCount(), "nur der Timer des zweiten Toasts darf übrig sein").toBe(1);

    const nachDismiss = rendergaenge;
    act(() => vi.advanceTimersByTime(FRIST_MS));
    expect(texte()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(rendergaenge, "es hat mehr als der eine übrige Timer gerendert").toBe(nachDismiss + 1);
  });

  // Auch hier steht keine Produktkonstante: `MAX_TOASTS` wird nicht gelesen. Der Fall braucht nur,
  // dass von sechs Toasts WENIGER als sechs sichtbar sind — dann ist mindestens einer verdrängt und
  // sein Timer läuft unbeobachtet weiter. Bleibt diese Voraussetzung eines Tages aus, scheitert der
  // Fall laut, statt still nichts mehr zu messen.
  const GEDRAENGE = 6;

  it("E · auch der aus der Anzeige gefallene Toast lässt beim Abbau keinen Timer zurück", () => {
    montieren();
    act(() => {
      for (let i = 1; i <= GEDRAENGE; i += 1) {
        buehne().push("info", `Meldung ${i}`);
      }
    });
    expect(vi.getTimerCount(), "jeder Toast muss seinen eigenen Timer haben").toBe(GEDRAENGE);
    expect(
      texte().length,
      "kein Toast wurde verdrängt — dieser Fall misst den verdrängten Timer dann nicht mehr",
    ).toBeLessThan(GEDRAENGE);

    abbauen();
    expect(vi.getTimerCount(), "der Abbau räumt auch die Timer der verdrängten Toasts").toBe(0);
  });

  it("F · dismiss NACH dem Ablauf ist harmlos", () => {
    montieren();
    act(() => buehne().push("info", "Eins"));
    const id = kennungVon("Eins");

    act(() => vi.advanceTimersByTime(FRIST_MS));
    expect(texte()).toEqual([]);

    expect(() => act(() => buehne().dismiss(id))).not.toThrow();
    expect(texte()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  // BENs Prüfpunkt 6 aus Runde 1: `getTimerCount() === 0` sieht einen zurückgebliebenen MAP-Eintrag
  // nicht — der abgelaufene Timer ist ja weg, nur sein Eintrag bliebe liegen und die Map wüchse mit
  // jedem Toast. Sichtbar wird der Unterschied am Verhalten von `dismiss`: greift es später noch
  // einen Eintrag zu dieser Kennung ab, ruft es `window.clearTimeout` mit einer toten Kennung. Ist
  // der Eintrag im Timer-Rückruf geräumt worden, unterbleibt der Aufruf. Gemessen wird also der
  // Aufruf selbst — ohne jede Änderung am Produkt.
  it("G · nach dem Ablauf ist auch der Map-Eintrag weg, nicht nur der Timer", () => {
    montieren();
    act(() => buehne().push("info", "Eins"));
    const id = kennungVon("Eins");

    act(() => vi.advanceTimersByTime(FRIST_MS));
    expect(texte()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);

    const wecker = vi.spyOn(window, "clearTimeout");
    act(() => buehne().dismiss(id));
    expect(
      wecker.mock.calls.length,
      "der Map-Eintrag des abgelaufenen Toasts liegt noch da — dismiss räumt eine tote Kennung ab",
    ).toBe(0);
  });
});
