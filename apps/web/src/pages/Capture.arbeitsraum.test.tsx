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
import { CaptureArbeitsraum } from "./Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
          createElement(NavGuardProvider, null, createElement(CaptureArbeitsraum)),
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

/**
 * Einen Entwurf fortsetzen (`loadDraft`, `Capture.tsx:1780`) — der einzige Weg in den Arbeitsraum,
 * den DIESE Datei noch misst. JOB 3062 · H3: Aufklapper und Datei-Import-Sprung sind keine Wege des
 * Arbeitsraums mehr, sondern Einträge im Menü „Datei ▾" der Blatt-Werkzeugzeile
 * (`components/erfassen/Blatt.tsx`); ihre Helfer sind mit ihren Fällen entfallen, statt ungenutzt
 * stehen zu bleiben.
 */
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
// JOB 3062 · H3 — ZWEI DER DREI SCROLLSTELLEN GIBT ES NICHT MEHR.
// ------------------------------------------------------------------------------------------------
// Diese Datei mass drei Wege in den Arbeitsraum, die alle dieselbe ungesicherte Zeile ausloesten:
//
//     Weg 1  Aufklapper „Weitere Wege anzeigen ▾"   `openCaptureWorkspace`   ENTFALLEN
//     Weg 2  Sprung in den Datei-Import             `openFileImport`         ENTFALLEN
//     Weg 3  Entwurf fortsetzen                     `loadDraft`              BESTEHT
//
// Gemessen am 04.09.2026 an `pages/Capture.tsx`: `openCaptureWorkspace` und `openFileImport` kommen
// dort null Mal vor, und es gibt keinen Knopf mehr mit `aria-controls="capture-workspace"`. Der
// Standardweg-Kasten mit seinem Aufklapper ist von der Flaeche genommen (Auftrag §5), der Weg in
// den Dateiimport liegt im Menue „Datei ▾" des Blattes und oeffnet die Ansicht ohne Scroll. Von den
// frueher drei `scrollIntoView`-Aufrufen ist EINER uebrig (`:2068`, in `loadDraft`).
//
// WAS DAS FUER DIESE DATEI HEISST: Die Faelle zu Weg 1 und Weg 2 (A1, V1, V2, V3, I1, I2, D1, S1,
// S2, S4, S5, S7, S8) haben keinen Gegenstand mehr und sind entfernt. Sie STILL stehen zu lassen
// waere schlimmer als sie zu loeschen: `it.fails` bleibt auch dann gruen, wenn der Fall aus einem
// ganz anderen Grund scheitert — hier, weil das Element fehlt. Ein Mangelbericht, der ueber ein
// verschwundenes Element berichtet, meldet nichts mehr.
//
// WAS BLEIBT, BLEIBT UNVERAENDERT: Weg 3 besteht, und die beiden Maengel an seiner Scrollstelle
// bestehen ebenso — die Methode ist nicht geprueft (nur die Ref ist optional verkettet), und
// `prefers-reduced-motion` wird nirgends in `apps/web/src/**/*.tsx` abgefragt. Sie stehen weiter
// als `it.fails`, also als ehrlich benannter, offener Mangel. Ihn zu beheben ist nicht Gegenstand
// von JOB 3062; ihn stillschweigend fallen zu lassen waere es erst recht nicht.
//
// MONTIERT WIRD JETZT `CaptureArbeitsraum` STATT `Capture`: `Capture` rendert seit JOB 3062 das
// Blatt, und die Entwurfsliste mit dem Fortsetzen-Knopf liegt im Arbeitsraum. Gemessen wird
// weiterhin genau die Komponente, in der die Scrollstelle steht.
// ------------------------------------------------------------------------------------------------
describe("V · Mount- und Interaktionsvoraussetzungen", () => {
  it("V4 · ein Entwurf laesst sich fortsetzen — die verbliebene Scrollstelle ist erreichbar", () => {
    lage.drafts = [entwurf()];
    scrollSonde();
    mount();
    wegEntwurfFortsetzen();
    // Ohne diesen Nachweis waeren S3/S6 wertlos: ein Fall, der den Weg nie geht, scheitert auch
    // dann, wenn das Produkt in Ordnung ist.
    expect(arbeitsraum()?.getAttribute("aria-hidden")).toBe("false");
  });

  it("V5 · die Bewegungsreduktion WAERE abfragbar — die Attrappe antwortet", () => {
    bewegungsreduktion(true);
    mount();
    // Ohne diesen Nachweis waere S6 wertlos: Ein Produkt, das `matchMedia` nie ruft, ist von einer
    // Umgebung, die nicht antworten kann, sonst nicht zu unterscheiden.
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    expect(window.matchMedia("(prefers-reduced-motion: no-preference)").matches).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// I · IST-MESSUNG — was am verbliebenen Weg heute schon richtig ist.
// ------------------------------------------------------------------------------------------------
describe("I · Ist-Messung des Fortsetzens", () => {
  it("I3 · Fortsetzen scrollt GENAU EINMAL, und zwar erst im Timer", () => {
    lage.drafts = [entwurf()];
    const scroll = scrollSonde();
    mount();
    wegEntwurfFortsetzen();
    // Vor dem Timer ist noch nichts gescrollt — der Aufruf liegt in `setTimeout` (Capture.tsx:2067).
    expect(scroll).toHaveBeenCalledTimes(0);
    timerLaufen();
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});

// ------------------------------------------------------------------------------------------------
// S · SOLLVERTRAG D-010 — der gewuenschte Nutzerzustand. Heute kausal ROT.
// ------------------------------------------------------------------------------------------------
describe("S · Sollvertrag D-010 — fehlende Browsermethode", () => {
  it.fails(
    "S3 · Entwurf fortsetzen stuerzt NICHT ab, wenn der Browser kein scrollIntoView hat",
    () => {
      lage.drafts = [entwurf()];
      mount();
      wegEntwurfFortsetzen();
      // jsdom implementiert `Element.prototype.scrollIntoView` nicht — genau die Umgebung, die der
      // Befund meint. `workAreaRef.current?.scrollIntoView(...)` (`Capture.tsx:2068`) sichert die
      // REF, nicht die METHODE. Gefordert ist eine Methodenpruefung; der Scroll darf dann entfallen.
      expect(() => timerLaufen()).not.toThrow();
    },
  );
});

describe("S · Sollvertrag D-010 — Bewegungsreduktion", () => {
  it.fails("S6 · bei reduzierter Bewegung scrollt das Fortsetzen NICHT smooth", () => {
    bewegungsreduktion(true);
    lage.drafts = [entwurf()];
    const scroll = scrollSonde();
    mount();
    wegEntwurfFortsetzen();
    timerLaufen();
    expect(scroll).toHaveBeenCalledTimes(1);
    // `prefers-reduced-motion` kommt in `apps/web/src` bislang nur in `styles/modern.css:318` vor —
    // in keiner einzigen TSX-Datei. Der Scroll ist deshalb unbedingt `smooth` (`Capture.tsx:2068`),
    // auch fuer Menschen, denen Bewegung Uebelkeit verursacht.
    const arg = scroll.mock.calls[0]?.[0] as { behavior?: string } | undefined;
    expect(arg?.behavior).not.toBe("smooth");
  });
});
