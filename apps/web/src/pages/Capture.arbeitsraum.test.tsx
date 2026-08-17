// @vitest-environment jsdom
// ================================================================================================
// JOB 687 · D5 — DER ERFASSUNGS-ARBEITSRAUM, GEMOUNTET GEMESSEN.
// ================================================================================================
//
// Wiederhergestellt aus `RUECKGABE-BASIC6-JOB-687-D4-KORREKTUR.md` (`94ed18e6…7309`), D-010.
// D4 fuhr sechs Fälle in einem Prüfbaum unter `/private/tmp`; das Verzeichnis ist geräumt worden.
// Hier stehen sie als Produkttest — mit dem ECHTEN `NavGuardProvider`, nicht mit einem Doppelgänger:
// was weggemockt wird, wird nicht gemessen.
//
// ZWEI PRÄZISIERUNGEN GEGENÜBER D4, beide am Objekt nachgemessen:
//
//   1. `Capture.tsx` ist auf dieser Base NICHT mehr byteidentisch mit D4s Pin (`7db7e77f…` →
//      `587baad3…`, 5 895 → 5 915 Zeilen). Alle drei Scrollstellen und die harte Beschriftung sind
//      unverändert vorhanden, nur um rund zwanzig Zeilen verschoben (`:1897`, `:2045`, `:2053`,
//      `:3368`). Es ist also nichts von selbst grün geworden — gemessen, nicht angenommen.
//
//   2. D4 schreibt „fehlt `scrollIntoView`, WIRFT der Aufklapp-Scroll". Das ist richtig, aber der
//      Wurf fällt NICHT im Klick: der Scroll liegt in `window.setTimeout(…, 0)` (`:2048`, `:2056`).
//      Synchron am Klick gemessen bliebe der Fehler unsichtbar. Deshalb laufen die Scrollfälle hier
//      mit Fake-Timern — `vi.runAllTimers()` führt den Rückruf aus und trägt den Wurf an die
//      Messstelle. Wer das nicht trennt, misst die falsche Stelle und hält den Befund für erledigt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({ drafts: [] as unknown[], gaps: [] as unknown[] }));

// TEILWEISE gemockt, nicht vollständig: `Capture` zieht über seine Kindkomponenten weitere Haken
// (z. B. `useUploadLimits` in `UploadLimitsHint`). Ein Vollmock nähme sie weg und liesse die Seite
// gar nicht erst mounten — gemessen. Die übrigen Haken bleiben echt; ohne Netz liefern sie einen
// Fehlerzustand, und genau so verhält sich die Seite auch im Betrieb ohne Server.
vi.mock("../api/hooks", async (importOriginal) => {
  const echt = await importOriginal<Record<string, unknown>>();
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    ...echt,
    useDirectory: () => ok([]),
    useDrafts: () => ok(lage.drafts),
    useGaps: () => ok(lage.gaps),
    useReasonerStatus: () => ok({ active: false, mode: "deterministic" }),
  };
});
vi.mock("../app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { NavGuardProvider } from "../app/NavGuardContext";
import i18n from "../i18n";
import { Capture } from "./Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die beiden Beschriftungen stehen WÖRTLICH im Quelltext (`Capture.tsx:3368`) — kein i18n-Schlüssel. */
const AUF = "Weitere Wege anzeigen ▾";
const ZU = "Weitere Wege einklappen ▴";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/erfassen"] },
          // Der ECHTE Provider — ein Doppelgänger würde genau das wegnehmen, was gemessen werden soll.
          createElement(NavGuardProvider, null, createElement(Capture)),
        ),
      ),
    );
  });
}

function knopfMitText(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === text,
  ) as HTMLButtonElement | undefined;
}

function aufklapper(): HTMLButtonElement {
  const b = knopfMitText(AUF) ?? knopfMitText(ZU);
  if (!b) {
    throw new Error("Der Aufklapper des Arbeitsraums ist auf der gemounteten Seite nicht da.");
  }
  return b;
}

function arbeitsraum(): HTMLElement | null {
  return container.querySelector("#capture-workspace");
}

function klick(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Die Timer laufen lassen — dort liegt der Scroll (`window.setTimeout(…, 0)`). */
function timerLaufen(): void {
  act(() => {
    vi.runAllTimers();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  // Die Prototyp-Ergänzung je Fall zurücknehmen — jsdom bringt `scrollIntoView` NICHT mit.
  // `Reflect.deleteProperty` statt des `delete`-Operators: dieselbe Wirkung, und die Hausregel
  // `lint/performance/noDelete` bleibt gewahrt.
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  i18n.changeLanguage("de");
});

// ------------------------------------------------------------------------------------------------
// A · KALIBRIERUNG — der Ausgangszustand, gegen den alles andere gemessen wird.
// ------------------------------------------------------------------------------------------------
describe("A · Kalibrierung des Aufklappers", () => {
  it("A1 · der Arbeitsraum startet ZU: aria-expanded=false, aria-controls zeigt auf ein vorhandenes, verborgenes Ziel", () => {
    mount();
    const b = aufklapper();
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(b.getAttribute("aria-controls")).toBe("capture-workspace");
    // Das Ziel existiert wirklich — ein `aria-controls` ins Leere wäre eine Zusage ohne Gegenstand.
    const ziel = arbeitsraum();
    expect(ziel).not.toBeNull();
    expect(ziel?.getAttribute("aria-hidden")).toBe("true");
    expect(b.textContent?.trim()).toBe(AUF);
  });
});

// ------------------------------------------------------------------------------------------------
// I · IST-MESSUNG — was das Aufklappen heute wirklich tut.
// ------------------------------------------------------------------------------------------------
describe("I · Ist-Messung des Aufklappens", () => {
  it("I1 · Aufklappen scrollt GENAU EINMAL und IMMER mit {behavior:'smooth', block:'start'}", () => {
    const scroll = vi.fn();
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = scroll;
    mount();
    klick(aufklapper());
    // Vor dem Timer ist noch nichts gescrollt — der Aufruf liegt in `setTimeout` (Capture.tsx:2056).
    expect(scroll).toHaveBeenCalledTimes(0);
    timerLaufen();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    // Und der Raum ist offen.
    expect(aufklapper().getAttribute("aria-expanded")).toBe("true");
    expect(arbeitsraum()?.getAttribute("aria-hidden")).toBe("false");
  });

  it("I2 · Einklappen scrollt NICHT und setzt aria-expanded zurück", () => {
    const scroll = vi.fn();
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = scroll;
    mount();
    klick(aufklapper());
    timerLaufen();
    expect(scroll).toHaveBeenCalledTimes(1);
    klick(aufklapper()); // jetzt „einklappen"
    timerLaufen();
    // Kein ZWEITER Scroll — `closeCaptureWorkspace` scrollt bewusst nicht.
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(aufklapper().getAttribute("aria-expanded")).toBe("false");
    expect(arbeitsraum()?.getAttribute("aria-hidden")).toBe("true");
  });
});

// ------------------------------------------------------------------------------------------------
// N · DIE BEFUNDE — sie sind heute grün, weil sie den MANGEL festhalten.
// ------------------------------------------------------------------------------------------------
//
// Diese drei Fälle drehen sich um, sobald D-010 gebaut ist: dann darf N1 nicht mehr werfen, und
// N2/N3 müssen einen übersetzten Text zeigen. Sie sind damit die Gegenprobe zur Spezifikation —
// nicht ihre Erfüllung.
describe("N · Die festgenagelten Mängel", () => {
  it("N1 · fehlt `scrollIntoView`, WIRFT der Aufklapp-Scroll — und zwar im Timer, nicht im Klick", () => {
    // jsdom implementiert `Element.prototype.scrollIntoView` nicht. Genau diese Umgebung meint der
    // Befund: `workAreaRef.current?.scrollIntoView(...)` sichert die REF, nicht die METHODE.
    expect(
      (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView,
    ).toBeUndefined();
    mount();
    // Der Klick selbst ist harmlos — hier fällt nichts.
    expect(() => klick(aufklapper())).not.toThrow();
    // Der Wurf kommt erst, wenn der Timer läuft.
    expect(() => timerLaufen()).toThrow(/scrollIntoView is not a function/);
  });

  it("N2 · die Umschaltbeschriftung ist HART DEUTSCH — kein i18n-Schlüssel dahinter", () => {
    mount();
    expect(aufklapper().textContent?.trim()).toBe(AUF);
    // Die beiden Schlüssel, die es geben MÜSSTE, existieren in keiner der drei Sprachen.
    for (const sprache of ["de", "en", "nl"]) {
      for (const schluessel of ["capture.workspaceOpen", "capture.workspaceClose"]) {
        expect(i18n.getResource(sprache, "translation", schluessel)).toBeUndefined();
      }
    }
  });

  it("N3 · Sprachwechsel beweist es: der Nachbarknopf übersetzt, der Aufklapper nicht", () => {
    mount();
    const nachbarDe = i18n.getResource("de", "translation", "capture.fileImportJump") as string;
    const nachbarEn = i18n.getResource("en", "translation", "capture.fileImportJump") as string;
    // Vorbedingung der Messung: die beiden Sprachwerte des Nachbarn unterscheiden sich wirklich.
    expect(nachbarDe).not.toBe(nachbarEn);
    expect(knopfMitText(nachbarDe)).toBeDefined();

    act(() => {
      void i18n.changeLanguage("en");
    });

    // Der Nachbar folgt der Sprache …
    expect(knopfMitText(nachbarEn)).toBeDefined();
    expect(knopfMitText(nachbarDe)).toBeUndefined();
    // … der Aufklapper unmittelbar daneben bleibt deutsch. Zwei Knöpfe, eine Zeile, zwei Welten.
    expect(knopfMitText(AUF)).toBeDefined();
  });
});
