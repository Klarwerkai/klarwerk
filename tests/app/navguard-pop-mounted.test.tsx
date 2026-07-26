// @vitest-environment jsdom
// AUFTRAG-mega13 Block A: der Zurück-Wächter am ECHTEN Router (BrowserRouter) mit der ECHTEN
// jsdom-History — nicht an einer Attrappe. Gemessen wird das, worum es geht: nach einem Klick auf
// Browser-Zurück steht der getippte Inhalt noch da.
//
// Warum eine eigene kleine Dirty-Seite und nicht die ganze Erfassen-Seite: geprüft wird der VERTRAG
// des Wächters (setGuard + POP), und der Verlust-Nachweis braucht genau eine Sache — echten
// React-Zustand, der beim Aushängen verschwindet. Ein `useState`-Feld ist dafür der scharfe Beleg;
// die echten Seiten fahren in tests-smoke/navguard-back-probe.spec.ts durch einen echten Browser.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createElement, useEffect, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { readHistoryIndex } from "../../apps/web/src/app/navHistory";
// Die sichtbaren Texte des Dialogs kommen aus i18n — der Import richtet sie ein (DE ist die Vorgabe).
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Wie oft „save" gerufen wurde und ob es scheitern soll (Kante 6). */
const saveState = { calls: 0, fail: false };

function PathProbe(): JSX.Element {
  const loc = useLocation();
  return createElement("span", { "data-testid": "path" }, loc.pathname + loc.search);
}

/** Baut die Vorgeschichte auf: echte Router-Navigation, also echte, gestempelte History-Einträge. */
function Trail(): JSX.Element {
  const navigate = useNavigate();
  return createElement(
    "div",
    null,
    createElement(
      "button",
      { type: "button", "data-testid": "go-start", onClick: () => navigate("/start") },
      "ZU-START",
    ),
    createElement(
      "button",
      { type: "button", "data-testid": "go-lib", onClick: () => navigate("/bibliothek") },
      "ZU-BIB",
    ),
    createElement(
      "button",
      { type: "button", "data-testid": "go-capture", onClick: () => navigate("/erfassen") },
      "ZU-ERFASSEN",
    ),
    createElement(
      "button",
      { type: "button", "data-testid": "go-lib-query", onClick: () => navigate("/bibliothek?f=x") },
      "ZU-BIB-QUERY",
    ),
  );
}

/**
 * Eine Seite mit ungespeicherter Eingabe. Der Inhalt lebt im React-Zustand — hängt der Router die
 * Seite aus, ist er WEG. Genau das ist der Verlust, den der Wächter verhindern muss.
 */
function DirtyPage({ id = "dirty" }: { id?: string }): JSX.Element {
  const [text, setText] = useState("");
  const { setGuard } = useNavGuard();
  useEffect(() => {
    setGuard({
      isDirty: () => text !== "",
      save: async () => {
        saveState.calls += 1;
        if (saveState.fail) {
          throw new Error("Speichern fehlgeschlagen (Testfall)");
        }
      },
    });
    return () => setGuard(null);
  }, [setGuard, text]);
  return createElement(
    "div",
    null,
    createElement("p", null, `SEITE-${id.toUpperCase()}`),
    createElement("textarea", {
      "data-testid": `feld-${id}`,
      value: text,
      onChange: (e: { target: { value: string } }) => setText(e.target.value),
    }),
  );
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        BrowserRouter,
        null,
        createElement(
          NavGuardProvider,
          null,
          createElement(PathProbe),
          createElement(Trail),
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/start",
              element: createElement("p", null, "SEITE-START"),
            }),
            createElement(Route, {
              path: "/bibliothek",
              element: createElement("p", null, "SEITE-BIB"),
            }),
            createElement(Route, { path: "/erfassen", element: createElement(DirtyPage) }),
            createElement(Route, {
              path: "/erfassen2",
              element: createElement(DirtyPage, { id: "zwei" }),
            }),
            createElement(Route, { path: "*", element: createElement("p", null, "SEITE-REST") }),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function path(): string {
  return container.querySelector<HTMLElement>("[data-testid=path]")?.textContent ?? "";
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function field(id = "dirty"): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>(`[data-testid=feld-${id}]`);
  if (!el) {
    throw new Error(`Feld „${id}" nicht gefunden — Seite ausgehängt?`);
  }
  return el;
}

async function press(testid: string): Promise<void> {
  const el = container.querySelector<HTMLElement>(`[data-testid=${testid}]`);
  if (!el) {
    throw new Error(`Knopf „${testid}" nicht gefunden`);
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

async function type(value: string, id = "dirty"): Promise<void> {
  const el = field(id);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

function dialogButton(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Dialog-Knopf „${part}" nicht gefunden. Sichtbar: ${pageText()}`);
  }
  return btn;
}

async function clickDialog(part: string): Promise<void> {
  const btn = dialogButton(part);
  await act(async () => {
    btn.click();
    await flush();
  });
}

/** Echter Browser-Zurück-Knopf. Das popstate-Ereignis kommt asynchron — genau wie im Browser. */
async function back(steps = 1): Promise<void> {
  await act(async () => {
    window.history.go(-steps);
    await flush();
  });
  await act(flush);
}

async function forward(steps = 1): Promise<void> {
  await act(async () => {
    window.history.go(steps);
    await flush();
  });
  await act(flush);
}

/** Die Vorgeschichte /start → /bibliothek → /erfassen, echt navigiert. */
async function trailToCapture(): Promise<void> {
  await press("go-start");
  await press("go-lib");
  await press("go-capture");
  expect(path()).toBe("/erfassen");
}

// ── FÄHIGKEITSNACHWEIS ────────────────────────────────────────────────────────────────────────────
//
// Die Kanten unten behaupten etwas über echtes Browser-Verhalten, laufen aber in jsdom. Diese drei
// Zusagen sind die Grundlage; hielte jsdom sie nicht ein, wären die Kanten-Belege eine Messung am
// eigenen Wunschbild. Bricht eine (jsdom-Update), wird HIER rot und nicht mitten in einer Kante.
describe("Grundlage: was jsdom für diese Belege wirklich leistet", () => {
  const nextTick = (): Promise<void> => new Promise((r) => setTimeout(r, 50));

  it("Zusage 1 + 2: `go(delta)` traversiert MEHRERE Einträge, popstate kommt asynchron, `state` ist lesbar", async () => {
    const seen: Array<{ path: string; idx: unknown }> = [];
    const onPop = (): void => {
      seen.push({
        path: window.location.pathname,
        idx: (window.history.state as { idx?: number } | null)?.idx,
      });
    };
    window.addEventListener("popstate", onPop);

    window.history.replaceState({ idx: 0 }, "", "/p0");
    window.history.pushState({ idx: 1 }, "", "/p1");
    window.history.pushState({ idx: 2 }, "", "/p2");
    expect((window.history.state as { idx: number }).idx).toBe(2);

    // Zwei Schritte auf einmal — die Grundlage von Kante 2 (exaktes Delta).
    window.history.go(-2);
    // Das Ereignis kommt SPÄTER. Genau darauf beruht, dass Kante 3/5 überhaupt Rennen haben können.
    expect(seen).toEqual([]);
    await nextTick();
    expect(seen).toEqual([{ path: "/p0", idx: 0 }]);

    window.history.go(2);
    await nextTick();
    expect(seen.at(-1)).toEqual({ path: "/p2", idx: 2 });
    window.removeEventListener("popstate", onPop);
  });

  it("Zusage 3: der ZUERST registrierte popstate-Listener schneidet alle späteren ab", async () => {
    // Der Griff, mit dem der Wächter den blockierten POP vom Router fernhält. `stopImmediatePropagation`
    // wirkt nur für DANACH registrierte Listener — darum hängt sich der Wächter beim Modul-Laden ein
    // (Begründung in app/navHistory.ts).
    const order: string[] = [];
    const first = (e: Event): void => {
      order.push("waechter");
      e.stopImmediatePropagation();
    };
    const second = (): void => {
      order.push("router");
    };
    window.addEventListener("popstate", first);
    window.addEventListener("popstate", second);

    window.history.replaceState({ idx: 0 }, "", "/q0");
    window.history.pushState({ idx: 1 }, "", "/q1");
    window.history.go(-1);
    await nextTick();

    expect(order).toEqual(["waechter"]);
    window.removeEventListener("popstate", first);
    window.removeEventListener("popstate", second);
  });
});

describe("Zurück-Wächter am echten Router", () => {
  // Die App wird je Kante frisch gemountet; die History wächst dabei monoton weiter, deshalb prüfen
  // alle Belege RELATIV (Index vorher/nachher), nicht gegen absolute Zahlen.
  beforeEach(async () => {
    saveState.calls = 0;
    saveState.fail = false;
    await mount();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flush();
    });
    container.remove();
  });

  // ── Kante 1 ──────────────────────────────────────────────────────────────────────────────────────
  it("Kante 1: jeder von der App erzeugte Eintrag trägt einen monotonen Index", async () => {
    await press("go-start");
    const a = readHistoryIndex();
    await press("go-lib");
    const b = readHistoryIndex();
    await press("go-capture");
    const c = readHistoryIndex();
    expect(typeof a).toBe("number");
    expect(b).toBe((a ?? 0) + 1);
    expect(c).toBe((b ?? 0) + 1);
    // Und der Index ist auch nach einem echten POP belastbar (er wandert mit).
    await back();
    expect(readHistoryIndex()).toBe(b);
  });

  // ── Kante 10 + der Kern der Sache ────────────────────────────────────────────────────────────────
  it("Kante 10: Zurück aus schmutziger Seite — Dialog erscheint erst, wenn die Adresszeile wieder stimmt, Inhalt bleibt", async () => {
    await trailToCapture();
    await type("Wichtiger Satz, der nicht verloren gehen darf.");
    const idxBefore = readHistoryIndex();

    await back();

    // Die Adresszeile steht wieder auf dem UI-Ort — NICHT auf dem blockierten Ziel.
    expect(window.location.pathname).toBe("/erfassen");
    expect(path()).toBe("/erfassen");
    expect(readHistoryIndex()).toBe(idxBefore);
    // Der Dialog ist da …
    expect(pageText()).toContain("Ungespeicherte Eingabe");
    // … und der Inhalt ist unangetastet: die Seite wurde nie ausgehängt.
    expect(field().value).toBe("Wichtiger Satz, der nicht verloren gehen darf.");
    expect(pageText()).toContain("SEITE-DIRTY");
    expect(pageText()).not.toContain("SEITE-BIB");
  });

  // ── Kante 4 ──────────────────────────────────────────────────────────────────────────────────────
  it('Kante 4: „Hier bleiben" — Ort, Index und Inhalt zurück; Zurück UND Vorwärts danach unverändert; kein Extra-Eintrag', async () => {
    await trailToCapture();
    await type("Bleib-Text");
    const idxBefore = readHistoryIndex();
    const lenBefore = window.history.length;

    await back();
    await clickDialog("Hier bleiben");

    expect(path()).toBe("/erfassen");
    expect(readHistoryIndex()).toBe(idxBefore);
    expect(field().value).toBe("Bleib-Text");
    expect(pageText()).not.toContain("Ungespeicherte Eingabe");
    // Kein zusätzlicher Verlaufseintrag: der Wächter benutzt ausschließlich go().
    expect(window.history.length).toBe(lenBefore);

    // Zurück fragt weiterhin …
    await back();
    expect(pageText()).toContain("Ungespeicherte Eingabe");
    await clickDialog("Hier bleiben");
    // … und nach dem Leeren des Feldes läuft Zurück/Vorwärts unverändert durch.
    await type("");
    await back();
    expect(path()).toBe("/bibliothek");
    await forward();
    expect(path()).toBe("/erfassen");
  });

  // ── Kante 5 ──────────────────────────────────────────────────────────────────────────────────────
  it('Kante 5: „Verwerfen und wechseln" spielt das ursprüngliche Delta genau einmal ab', async () => {
    await trailToCapture();
    await type("Wird verworfen");
    await back();
    await clickDialog("Verwerfen und wechseln");
    // Genau EIN Schritt zurück — nicht zwei, nicht null.
    expect(path()).toBe("/bibliothek");
    expect(pageText()).not.toContain("Ungespeicherte Eingabe");
    // Vorwärts führt wieder auf /erfassen: der Verlauf ist intakt, nicht abgeschnitten.
    await forward();
    expect(path()).toBe("/erfassen");
  });

  it('Kante 5: „Entwurf speichern und wechseln" speichert und wechselt genau einmal', async () => {
    await trailToCapture();
    await type("Wird gespeichert");
    await back();
    await clickDialog("Entwurf speichern und wechseln");
    expect(saveState.calls).toBe(1);
    expect(path()).toBe("/bibliothek");
  });

  // ── Kante 2 ──────────────────────────────────────────────────────────────────────────────────────
  it("Kante 2: Mehrschritt-Zurück (2 Einträge) wird mit dem exakten Delta behandelt", async () => {
    await trailToCapture();
    await type("Mehrschritt");
    const idxBefore = readHistoryIndex();

    await back(2);
    // Zurückgestellt auf den Anker — nicht auf den Nachbarn.
    expect(path()).toBe("/erfassen");
    expect(readHistoryIndex()).toBe(idxBefore);
    expect(field().value).toBe("Mehrschritt");

    // Und „Verwerfen" landet auf dem ursprünglichen Ziel ZWEI Schritte zurück, nicht einem.
    await clickDialog("Verwerfen und wechseln");
    expect(path()).toBe("/start");
  });

  // ── Kante 3 ──────────────────────────────────────────────────────────────────────────────────────
  it("Kante 3: schnelles Doppel-Zurück erzeugt genau einen Dialog und keine gestapelte Navigation", async () => {
    await trailToCapture();
    await type("Doppelklick");

    // Zwei Zurück-Sprünge, ohne den Wächter zwischendurch atmen zu lassen.
    await act(async () => {
      window.history.go(-1);
      window.history.go(-1);
      await flush();
    });
    await act(flush);

    expect(container.querySelectorAll("[role=dialog]").length).toBeLessThanOrEqual(1);
    const treffer = (pageText().match(/Ungespeicherte Eingabe/g) ?? []).length;
    expect(treffer).toBe(1);
    expect(path()).toBe("/erfassen");
    expect(field().value).toBe("Doppelklick");

    await clickDialog("Hier bleiben");
    expect(path()).toBe("/erfassen");
    expect(pageText()).not.toContain("Ungespeicherte Eingabe");
  });

  // ── Kante 6 ──────────────────────────────────────────────────────────────────────────────────────
  it("Kante 6: Speicherfehler bleibt am Ausgangsort, Guard aktiv, URL und History unverändert", async () => {
    await trailToCapture();
    await type("Speichern scheitert");
    const idxBefore = readHistoryIndex();
    const lenBefore = window.history.length;
    saveState.fail = true;

    await back();
    await clickDialog("Entwurf speichern und wechseln");

    expect(saveState.calls).toBe(1);
    expect(path()).toBe("/erfassen");
    expect(window.location.pathname).toBe("/erfassen");
    expect(readHistoryIndex()).toBe(idxBefore);
    expect(window.history.length).toBe(lenBefore);
    expect(field().value).toBe("Speichern scheitert");
    // Der Dialog bleibt offen — die Seite kann ihre Fehlermeldung zeigen.
    expect(pageText()).toContain("Ungespeicherte Eingabe");

    // Der Wächter ist weiter aktiv: ein zweiter Versuch (erfolgreich) wechselt dann wirklich.
    saveState.fail = false;
    await clickDialog("Entwurf speichern und wechseln");
    expect(saveState.calls).toBe(2);
    expect(path()).toBe("/bibliothek");
  });

  // ── Kante 7 ──────────────────────────────────────────────────────────────────────────────────────
  it("Kante 7: zwei aufeinanderfolgende bewachte Seiten übergeben die Zuständigkeit sauber", async () => {
    await press("go-start");
    await press("go-capture");
    await type("Seite eins");
    // Bewusst wechseln (Verwerfen), damit die zweite bewachte Seite dran ist.
    await back();
    await clickDialog("Verwerfen und wechseln");
    expect(path()).toBe("/start");

    // Zweite bewachte Seite: eigener Wächter, eigener Inhalt.
    await act(async () => {
      container.querySelector<HTMLElement>("[data-testid=go-capture]")?.click();
      await flush();
    });
    await type("Seite zwei");
    await back();
    // Der Wächter der ZWEITEN Seite greift (kein veralteter, kein abgemeldeter).
    expect(pageText()).toContain("Ungespeicherte Eingabe");
    expect(path()).toBe("/erfassen");
    expect(field().value).toBe("Seite zwei");
    await clickDialog("Hier bleiben");

    // Und nach dem Verlassen einer bewachten Seite blockiert NICHTS mehr (kein Zombie-Wächter).
    await type("");
    await back();
    expect(path()).toBe("/start");
    expect(pageText()).not.toContain("Ungespeicherte Eingabe");
  });

  // ── Kante 8 ──────────────────────────────────────────────────────────────────────────────────────
  it("Kante 8: POP auf denselben Pfad (nur Query) läuft durch, POP auf einen anderen Pfad wird angehalten", async () => {
    await press("go-start");
    await press("go-lib");
    await press("go-lib-query");
    expect(path()).toBe("/bibliothek?f=x");
    // Auf /bibliothek gibt es keinen Wächter — der Query-POP läuft durch, wie er soll.
    await back();
    expect(path()).toBe("/bibliothek");

    // Der Pfadwechsel dagegen wird bei schmutziger Seite angehalten (siehe Kante 10) — hier der
    // Gegenpol: dieselbe Seite OHNE Eingabe lässt den Pfadwechsel durch.
    await press("go-capture");
    await back();
    expect(path()).toBe("/bibliothek");
    expect(pageText()).not.toContain("Ungespeicherte Eingabe");
  });

  // ── GEGENPROBE ───────────────────────────────────────────────────────────────────────────────────
  it("GEGENPROBE: ohne den Zurück-Wächter hängt derselbe POP die Seite aus und der Inhalt ist weg", async () => {
    await trailToCapture();
    await type("Dieser Satz geht ohne Waechter verloren");

    // Den Wächter abmelden = der Zustand VOR mega13 (der POP erreicht den Router ungefiltert).
    const { clearPopAuthorityForTests } = await import("../../apps/web/src/app/navHistory");
    clearPopAuthorityForTests();

    await back();

    // Kein Dialog, Seite gewechselt — und der getippte Satz existiert nirgends mehr.
    expect(pageText()).not.toContain("Ungespeicherte Eingabe");
    expect(path()).toBe("/bibliothek");
    expect(pageText()).not.toContain("Dieser Satz geht ohne Waechter verloren");
    expect(container.querySelector("[data-testid=feld-dirty]")).toBeNull();
  });
});
