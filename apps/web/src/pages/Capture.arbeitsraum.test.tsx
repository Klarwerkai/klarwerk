// @vitest-environment jsdom
// ================================================================================================
// JOB 687 · D6 — DER ERFASSUNGS-ARBEITSRAUM: DIAGNOSE UND SOLLVERTRAG GETRENNT.
// ================================================================================================
//
// Vorgeschichte: D4 fuhr sechs Fälle in einem Prüfbaum unter `/private/tmp`, D5 überführte sie in
// diese Produktdatei — und BEN hat sie mit PRODUKT ROT zurückgegeben
// (`BEN-PRUEFUNG-JOB-687-D5.md:8`):
//
//   > „Nicht tragfähig … Capture I1/N1/N2/N3: Sie verlangen weiterhin IMMER `smooth`, den Wurf bei
//   > fehlendem `scrollIntoView` und die hart deutsche, beim Sprachwechsel unveränderte
//   > Beschriftung. … GM2 … reisst deshalb alle sechs Capture-Fälle mit."
//
// DREI FEHLER STECKTEN DARIN, und alle drei sind hier behoben:
//
//  1. MÄNGEL ALS WUNSCH. `expect(scroll).toHaveBeenCalledWith({behavior:"smooth", …})` verlangte
//     smooth AUCH bei aktivierter Bewegungsreduktion; `expect(() => timerLaufen()).toThrow(…)`
//     verlangte den Absturz. Wer das Produkt härtet, machte grüne Tests rot.
//  2. TEXTGEBUNDENE KNOPFSUCHE. `aufklapper()` fand den Knopf an seiner WÖRTLICHEN deutschen
//     Beschriftung. Übersetzt man sie — die geforderte Korrektur —, ist der Knopf für ALLE Fälle
//     unauffindbar; genau deshalb riss GM2 sechs von sechs. Hier läuft die Suche über
//     `aria-controls="capture-workspace"` (`Capture.tsx:3366`), ein Merkmal, das die Übersetzung
//     nicht berührt. Die Beschriftung wird nur noch DORT gelesen, wo sie der Gegenstand ist (S7/S8).
//  3. NUR EINE VON DREI SCROLLSTELLEN. D5 prüfte allein den Aufklapper. `loadDraft` (`:1897`) und
//     `openFileImport` (`:2045`) tragen denselben ungesicherten Aufruf — wer nur eine härtet, lässt
//     zwei Abstürze stehen. Jede Stelle hat jetzt ihren eigenen Fall.
//
// AUFBAU. `A` kalibriert, `V` sichert Mount und Interaktion ab, `I` hält fest, was heute schon
// richtig ist, `S` fordert den gewünschten Nutzerzustand als kausalen Fehlschlag. Der Block `V` ist
// die Bedingung dafür, dass `S` überhaupt etwas aussagt: Ein `it.fails` ist auch dann grün, wenn die
// Seite nie gerendert oder der Knopf nie geklickt wurde. `V` schliesst das REGULÄR aus.
//
// WARUM FAKE-TIMER. Alle drei Scrollaufrufe liegen in `window.setTimeout(…, 0)` (`:1896`, `:2044`,
// `:2052`). Synchron am Klick gemessen bliebe der Wurf unsichtbar und der Befund verloren;
// `vi.runAllTimers()` trägt ihn an die Messstelle. Wer das nicht trennt, misst die falsche Stelle.
//
// KEINE ZEILE PRODUKTCODE. `Capture.tsx` ist in diesem Durchgang Null-Diff.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Draft } from "../api/types";

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

/**
 * Die beiden Beschriftungen stehen WÖRTLICH im Quelltext (`Capture.tsx:3368`) — kein i18n-Schlüssel.
 * Sie werden hier nur noch dort verwendet, wo die Beschriftung selbst der Gegenstand ist (S7/S8);
 * das AUFFINDEN des Knopfes läuft bewusst textunabhängig über `aria-controls`.
 */
const AUF = "Weitere Wege anzeigen ▾";

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

/** Ein Knopf, dessen sichtbarer Text den gesuchten ENTHÄLT (Icons stehen mit im `textContent`). */
function knopfEnthaelt(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(text),
  ) as HTMLButtonElement | undefined;
}

/**
 * Der Aufklapper — gefunden über sein ARIA-Verhältnis zum Arbeitsraum, NICHT über seinen Text.
 * Das ist der Unterschied zu D5 und der Grund, warum eine Übersetzung der Beschriftung hier nur
 * noch S7/S8 betrifft statt aller Fälle.
 */
function aufklapper(): HTMLButtonElement {
  const b = container.querySelector<HTMLButtonElement>('button[aria-controls="capture-workspace"]');
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

/** `scrollIntoView` bereitstellen und mitschreiben. jsdom bringt die Methode NICHT mit. */
function scrollSonde(): ReturnType<typeof vi.fn> {
  const scroll = vi.fn();
  (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = scroll;
  return scroll;
}

/**
 * Bewegungsreduktion melden. jsdom kennt `matchMedia` nicht; ohne diese Attrappe könnte das Produkt
 * die Vorliebe gar nicht abfragen. Sie steht deshalb VOR dem Mount und ist selbst Gegenstand von
 * V4: Erst wenn belegt ist, dass die Abfrage beantwortet WÜRDE, ist ihr Ausbleiben ein Befund.
 */
function bewegungsreduktion(an: boolean): void {
  (window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
    // Auf den WERT prüfen, nicht auf den Merkmalsnamen: `(prefers-reduced-motion: no-preference)`
    // enthält die Zeichenfolge „reduce" bereits in „reduced" — eine Suche nach `includes("reduce")`
    // meldet deshalb auch dort einen Treffer. V5 hat genau das aufgedeckt.
    matches: an && /prefers-reduced-motion:\s*reduce\b/.test(query),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

function entwurf(): Draft {
  return {
    id: "d1",
    // `origin: "tell"` ist wesentlich: `resumeTargetForDraft` (lib/captureResume.ts:22) schickt
    // einen `frontdoor`-Entwurf per `guardedNavigate` fort — dann würde `loadDraft` VOR der
    // Scrollstelle zurückkehren (`Capture.tsx:1803`) und der Fall messte nichts.
    payload: { origin: "tell", title: "Ein offener Entwurf" },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
  } as unknown as Draft;
}

/** Weg 1 — der Aufklapper des Arbeitsraums (`openCaptureWorkspace`, `Capture.tsx:2049`). */
function wegAufklapper(): void {
  klick(aufklapper());
}

/** Weg 2 — der Sprung in den Datei-Import (`openFileImport`, `Capture.tsx:2040`). */
function wegDateiImport(): void {
  const b = knopfEnthaelt(String(i18n.t("capture.fileImportJump")));
  if (!b) {
    throw new Error("Der Datei-Import-Knopf ist auf der gemounteten Seite nicht da.");
  }
  klick(b);
}

/** Weg 3 — einen Entwurf fortsetzen (`loadDraft`, `Capture.tsx:1780`). */
function wegEntwurfFortsetzen(): void {
  const auf = knopfEnthaelt(String(i18n.t("capture.resumeExpand", { count: 1 })));
  if (!auf) {
    throw new Error("Die Entwurfsliste liess sich nicht aufklappen.");
  }
  klick(auf);
  const weiter = knopfEnthaelt(String(i18n.t("capture.resume")));
  if (!weiter) {
    throw new Error("Der Fortsetzen-Knopf ist auf der gemounteten Seite nicht da.");
  }
  klick(weiter);
}

beforeEach(() => {
  vi.useFakeTimers();
  lage.drafts = [];
  bewegungsreduktion(false);
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
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, "matchMedia");
  void i18n.changeLanguage("de");
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
  });
});

// ------------------------------------------------------------------------------------------------
// V · VORAUSSETZUNGEN — sie tragen die erwarteten Fehlschläge in `S`.
// ------------------------------------------------------------------------------------------------
describe("V · Mount- und Interaktionsvoraussetzungen", () => {
  it("V1 · der Aufklapper ist OHNE Rückgriff auf seinen Text auffindbar", () => {
    mount();
    // Die tragende Voraussetzung dieser Datei: Wird die Beschriftung übersetzt (S7/S8), bleibt
    // jeder andere Fall messbar. Genau daran scheiterte D5s GM2 mit 6 von 6 gerissenen Fällen.
    expect(aufklapper()).toBeInstanceOf(HTMLButtonElement);
  });

  it("V2 · der Klick auf den Aufklapper öffnet den Arbeitsraum wirklich", () => {
    scrollSonde();
    mount();
    wegAufklapper();
    expect(aufklapper().getAttribute("aria-expanded")).toBe("true");
    expect(arbeitsraum()?.getAttribute("aria-hidden")).toBe("false");
  });

  it("V3 · der Datei-Import-Knopf ist da und öffnet den Arbeitsraum ebenfalls", () => {
    scrollSonde();
    mount();
    wegDateiImport();
    expect(arbeitsraum()?.getAttribute("aria-hidden")).toBe("false");
  });

  it("V4 · ein Entwurf lässt sich fortsetzen — der dritte Scrollweg ist erreichbar", () => {
    lage.drafts = [entwurf()];
    scrollSonde();
    mount();
    wegEntwurfFortsetzen();
    expect(arbeitsraum()?.getAttribute("aria-hidden")).toBe("false");
  });

  it("V5 · die Bewegungsreduktion WÄRE abfragbar — die Attrappe antwortet", () => {
    bewegungsreduktion(true);
    mount();
    // Ohne diesen Nachweis wäre S4/S5/S6 wertlos: Ein Produkt, das `matchMedia` nie ruft, ist von
    // einer Umgebung, die nicht antworten kann, sonst nicht zu unterscheiden.
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    expect(window.matchMedia("(prefers-reduced-motion: no-preference)").matches).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// I · IST-MESSUNG — ausschliesslich das, was heute schon RICHTIG ist.
// ------------------------------------------------------------------------------------------------
//
// D5 führte hier zusätzlich „IMMER smooth" (I1) und den Wurf (N1) als grüne Erwartung. Beides ist
// nach `S` gewandert. Was bleibt, ist gewünscht: dass überhaupt und genau einmal gescrollt wird.
describe("I · Ist-Messung des Aufklappens", () => {
  it("I1 · Aufklappen scrollt GENAU EINMAL, und zwar erst im Timer", () => {
    const scroll = scrollSonde();
    mount();
    wegAufklapper();
    // Vor dem Timer ist noch nichts gescrollt — der Aufruf liegt in `setTimeout` (Capture.tsx:2052).
    expect(scroll).toHaveBeenCalledTimes(0);
    timerLaufen();
    expect(scroll).toHaveBeenCalledTimes(1);
    // Zum Ziel gescrollt wird bewusst NICHT auf `#capture-workspace`, sondern auf den
    // Abstandshalter `workAreaRef` (`Capture.tsx:3863`). Das ist eine andere Stelle als das
    // ARIA-Ziel — hier nur festgehalten, nicht bewertet.
  });

  it("I2 · Einklappen scrollt NICHT und setzt aria-expanded zurück", () => {
    const scroll = scrollSonde();
    mount();
    wegAufklapper();
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
// S · SOLLVERTRAG D-010 — der gewünschte Nutzerzustand. Heute kausal ROT.
// ------------------------------------------------------------------------------------------------
//
// S1-S3 fordern dasselbe für DREI verschiedene Stellen. Sie sind bewusst nicht zusammengelegt: Eine
// Härtung an nur einer Stelle soll genau einen Fall grün machen und die anderen beiden weiter
// melden. D5 prüfte allein den Aufklapper — und hätte eine halbe Korrektur für vollständig gehalten.
describe("S · Sollvertrag D-010 — fehlende Browsermethode", () => {
  it.fails("S1 · Aufklappen stürzt NICHT ab, wenn der Browser kein scrollIntoView hat", () => {
    // jsdom implementiert `Element.prototype.scrollIntoView` nicht — genau die Umgebung, die der
    // Befund meint. `workAreaRef.current?.scrollIntoView(...)` (`Capture.tsx:2053`) sichert die REF,
    // nicht die METHODE. Gefordert ist eine Methodenprüfung; der Scroll darf dann entfallen.
    expect(
      (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView,
    ).toBeUndefined();
    mount();
    wegAufklapper();
    expect(() => timerLaufen()).not.toThrow();
  });

  it.fails(
    "S2 · der Datei-Import stürzt NICHT ab, wenn der Browser kein scrollIntoView hat",
    () => {
      mount();
      wegDateiImport();
      // Dieselbe ungesicherte Zeile an anderer Stelle: `Capture.tsx:2045`.
      expect(() => timerLaufen()).not.toThrow();
    },
  );

  it.fails(
    "S3 · Entwurf fortsetzen stürzt NICHT ab, wenn der Browser kein scrollIntoView hat",
    () => {
      lage.drafts = [entwurf()];
      mount();
      wegEntwurfFortsetzen();
      // Und ein drittes Mal: `Capture.tsx:1897`.
      expect(() => timerLaufen()).not.toThrow();
    },
  );
});

describe("S · Sollvertrag D-010 — Bewegungsreduktion", () => {
  it.fails("S4 · bei reduzierter Bewegung scrollt das Aufklappen NICHT smooth", () => {
    bewegungsreduktion(true);
    const scroll = scrollSonde();
    mount();
    wegAufklapper();
    timerLaufen();
    expect(scroll).toHaveBeenCalledTimes(1);
    // `prefers-reduced-motion` kommt in `apps/web/src` bislang nur in `styles/modern.css:318` vor —
    // in keiner einzigen TSX-Datei. Der Scroll ist deshalb unbedingt `smooth` (`Capture.tsx:2053`),
    // auch für Menschen, denen Bewegung Übelkeit verursacht.
    const arg = scroll.mock.calls[0]?.[0] as { behavior?: string } | undefined;
    expect(arg?.behavior).not.toBe("smooth");
  });

  it.fails("S5 · bei reduzierter Bewegung scrollt der Datei-Import NICHT smooth", () => {
    bewegungsreduktion(true);
    const scroll = scrollSonde();
    mount();
    wegDateiImport();
    timerLaufen();
    expect(scroll).toHaveBeenCalledTimes(1);
    const arg = scroll.mock.calls[0]?.[0] as { behavior?: string } | undefined;
    expect(arg?.behavior).not.toBe("smooth");
  });

  it.fails("S6 · bei reduzierter Bewegung scrollt das Fortsetzen NICHT smooth", () => {
    bewegungsreduktion(true);
    lage.drafts = [entwurf()];
    const scroll = scrollSonde();
    mount();
    wegEntwurfFortsetzen();
    timerLaufen();
    expect(scroll).toHaveBeenCalledTimes(1);
    const arg = scroll.mock.calls[0]?.[0] as { behavior?: string } | undefined;
    expect(arg?.behavior).not.toBe("smooth");
  });
});

describe("S · Sollvertrag D-010 — die Beschriftung", () => {
  it.fails("S7 · die Umschaltbeschriftung hat i18n-Schlüssel in allen drei Sprachen", () => {
    mount();
    // Heute steht die Beschriftung wörtlich im Quelltext (`Capture.tsx:3368`); die Schlüssel, die es
    // geben MÜSSTE, existieren in keiner der drei Sprachen.
    for (const sprache of ["de", "en", "nl"]) {
      for (const schluessel of ["capture.workspaceOpen", "capture.workspaceClose"]) {
        expect(i18n.getResource(sprache, "translation", schluessel)).toBeDefined();
      }
    }
  });

  it.fails("S8 · beim Sprachwechsel folgt der Aufklapper der Sprache — wie sein Nachbar", () => {
    mount();
    const nachbarDe = String(i18n.getResource("de", "translation", "capture.fileImportJump"));
    const nachbarEn = String(i18n.getResource("en", "translation", "capture.fileImportJump"));
    // Vorbedingung der Messung, REGULÄR geprüft: die Sprachwerte des Nachbarn unterscheiden sich
    // wirklich, und der deutsche steht vor dem Wechsel auf der Seite.
    expect(nachbarDe).not.toBe(nachbarEn);
    expect(knopfEnthaelt(nachbarDe)).toBeDefined();
    const deutsch = aufklapper().textContent?.trim();

    act(() => {
      void i18n.changeLanguage("en");
    });

    // Der Nachbar folgt der Sprache — der Aufklapper unmittelbar daneben bleibt heute deutsch.
    // Zwei Knöpfe, eine Zeile, zwei Welten.
    expect(knopfEnthaelt(nachbarEn)).toBeDefined();
    expect(aufklapper().textContent?.trim()).not.toBe(deutsch);
  });
});

// ------------------------------------------------------------------------------------------------
// D · DIAGNOSE — der heutige Wortlaut, hashartig festgehalten.
// ------------------------------------------------------------------------------------------------
//
// Dieser eine Fall hält den IST-Wortlaut fest, OHNE ihn zu wünschen: Er ist die Gegenprobe zu S7/S8
// und macht sichtbar, wann die Korrektur greift. Er ist bewusst der EINZIGE textgebundene Fall der
// Datei — reisst er, ist die Beschriftung angefasst worden, und das ist dann eine gewollte Meldung.
describe("D · Diagnose des heutigen Wortlauts", () => {
  it("D1 · heute trägt der Aufklapper den fest eingebauten deutschen Text", () => {
    mount();
    expect(aufklapper().textContent?.trim()).toBe(AUF);
  });
});
