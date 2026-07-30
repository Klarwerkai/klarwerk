// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega46 BLOCK F2 — BEIDE ZUSTÄNDE DER GESCHALTETEN FLÄCHE.
// ================================================================================================
//
// Nur den EINEN Zustand zu prüfen ist die häufigste Art, einen Schalter kaputtgehen zu lassen, ohne
// dass es auffällt (dieselbe Begründung wie in mega45-herkunft-schalter). Hier kommt ein dritter
// Zustand dazu, den ein Server-Test gar nicht sehen kann: die Zeit VOR der Antwort. Genau dort
// entsteht das Aufblitzen — eine Fläche, die kurz da ist und wieder verschwindet — und genau dort
// wäre ein „solange wir es nicht wissen, zeigen wir es mal" fatal.
//
// Gemountet am ECHTEN FeatureGate über den ECHTEN Hook; nur die HTTP-Grenze (endpoints) ist ersetzt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";

// Der Kanal, über den der Test den Ausgang der Auskunft steuert (Muster aus analytics-exec-loading).
const d = vi.hoisted(() => {
  const state = { resolve: (_v: unknown) => {}, reject: (_e: unknown) => {} };
  const fn = vi.fn(
    () =>
      new Promise((resolve, reject) => {
        state.resolve = resolve;
        state.reject = reject;
      }),
  );
  return {
    fn,
    antwortet: (v: unknown) => state.resolve(v),
    faellt_aus: (e: unknown) => state.reject(e),
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { features: { get: d.fn } },
}));

const { FeatureGate } = await import("../../apps/web/src/components/FeatureGate");

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const INHALT = "Herkunft ansehen";
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(FeatureGate, {
          feature: "herkunft",
          children: createElement("button", null, INHALT),
        }),
      ),
    );
  });
}

/**
 * Die Antwort bis in den gerenderten Baum durchlaufen lassen.
 *
 * ACHTUNG, hier steckt die Falle dieses Tests: Mit zu wenig Wartezeit rendert AUCH der
 * eingeschaltete Fall nichts — und dann sind die „aus"-Fälle grün, ohne irgendetwas zu beweisen.
 * Deshalb wird über den Makrotask gewartet (und der „an"-Fall unten prüft ausdrücklich, dass die
 * Fläche DA ist; er ist die Kalibrierung für alle „nichts da"-Fälle).
 *
 * AUFTRAG-mega47: EIN Makrotask war zu knapp. Im vollen Tor-Lauf (641 Dateien parallel) fiel der
 * „an"-Fall gemessen aus — allein wurde er grün. Genau die Falle, die der Absatz darüber beschreibt,
 * hat also zugeschlagen: eine Zusicherung, deren Farbe an der Maschinenlast hängt. Gewartet wird
 * jetzt über eine feste Zahl Makrotasks — für ALLE Fälle gleich, damit die Kalibrierungs-Logik
 * unberührt bleibt: die „aus"-Fälle warten unverändert mindestens so lange wie der „an"-Fall.
 */
async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

beforeEach(() => {
  d.fn.mockClear();
  mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("mega46 F2 · die Fläche hinter einem Betriebsschalter", () => {
  it("SOLANGE DIE AUSKUNFT FEHLT: nichts — kein Aufblitzen, kein Platzhalter", () => {
    expect(container.textContent).toBe("");
    expect(container.querySelector("button")).toBeNull();
  });

  it("SCHALTER AUS: die Fläche wird GAR NICHT gerendert", async () => {
    d.antwortet({ features: { herkunft: false, expertMatching: false, demodaten: false } });
    await durchatmen();
    // Nicht „ausgegraut", nicht „versteckt" — gar nicht im Dokument.
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).not.toContain(INHALT);
    expect(container.querySelector("[disabled]")).toBeNull();
  });

  it("SCHALTER AN: die Fläche ist da und bedienbar", async () => {
    d.antwortet({ features: { herkunft: true, expertMatching: false, demodaten: false } });
    await durchatmen();
    const knopf = container.querySelector("button");
    expect(knopf).not.toBeNull();
    expect(knopf?.textContent).toBe(INHALT);
    expect(knopf?.hasAttribute("disabled")).toBe(false);
  });

  it("EIN ANDERER SCHALTER schaltet diese Fläche NICHT frei", async () => {
    d.antwortet({ features: { herkunft: false, expertMatching: true, demodaten: true } });
    await durchatmen();
    expect(container.querySelector("button")).toBeNull();
  });

  it("KEINE ANTWORT (Fehler): fail-closed — nichts, aber auch keine Fehlermeldung", async () => {
    d.faellt_aus(new Error("Netz weg"));
    await durchatmen();
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).toBe("");
  });
});
