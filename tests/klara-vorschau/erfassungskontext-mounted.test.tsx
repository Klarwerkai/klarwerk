// @vitest-environment jsdom
// ================================================================================================
// KLARA-VORSCHAU · K4 — der Erfassungskontext folgt dem TATSÄCHLICH geladenen Entwurf.
// ================================================================================================
//
// Bens Befund (Nacharbeit 3): Klara las das Objekt der Erfassung nur beim Öffnen, beim Pfadwechsel,
// einmal nach 400 ms und bei einem input-Ereignis. Das Blatt lädt seinen Entwurf aber später und
// setzt den Titel PROGRAMMATISCH (`components/erfassen/Blatt.tsx`: `?draft=` lesen, dann `setTitle`)
// — ohne input-Ereignis. Klara zeigte dann weiter das falsche Objekt.
//
// Diese Gegenprobe stellt genau diese Lage nach, in der ECHTEN Hülle: eine Erfassungsfläche, die
// ihr Feld `blatt-titel` erst nach der Antwort auf den jeweiligen Leseaufruf setzt. Der Test
// gibt die Antwort nach dem früheren 400-ms-Fenster frei. Das Gespräch bleibt dabei offen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useSearchParams,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import {
  bis,
  klick,
  medienStub,
  netz,
  netzStub,
  q,
  ruhe,
  warte,
} from "../fe003-tutorial-fragen/huelle";

type TitelLaden = (entwurf: string) => Promise<string>;

/** Wie das Blatt: Titel kommt verzögert und programmatisch, nie über ein input-Ereignis. */
function TestBlatt({ laden }: { laden: TitelLaden }): JSX.Element {
  const [parameter] = useSearchParams();
  const entwurf = parameter.get("draft") ?? "";
  const [titel, setTitel] = useState("");
  useEffect(() => {
    setTitel("");
    let aktuell = true;
    void laden(entwurf).then((antwort) => {
      if (aktuell) setTitel(antwort);
    });
    return () => {
      aktuell = false;
    };
  }, [entwurf, laden]);
  // `LinkProps` kennt `data-*` nicht als Literal-Eigenschaft (TS2769); als vorab gebautes Objekt
  // reicht React das Attribut wie im JSX an das <a> durch.
  const zuEntwurfB = { to: "/erfassen?draft=b", "data-testid": "zu-entwurf-b" };
  return createElement(
    "div",
    null,
    createElement("input", { "data-testid": "blatt-titel", value: titel, readOnly: true }),
    createElement(Link, zuEntwurfB, "b"),
  );
}

let abbauen: (() => void) | null = null;

async function montiere(route: string, laden: TitelLaden): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [route] },
                  createElement(
                    AppShell,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement(TestBlatt, { laden }),
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  abbauen = () => {
    act(() => root.unmount());
    container.remove();
  };
}

function objekt(): string {
  return q(document, "klara-ort-objekt")?.textContent ?? "";
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  setzeKlaraVorschauAktiv(true);
  netz.anfragen = [];
  netz.lage = { kiAktiv: true, rolle: "experte" };
  medienStub();
  vi.stubGlobal("fetch", vi.fn(netzStub));
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen?.();
  abbauen = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  setzeKlaraVorschauAktiv(false);
  zuruecksetzenGanz();
});

describe("K4 · Erfassung: Klara zeigt den tatsächlich geladenen Entwurf", () => {
  it("verzögert geladener Titel und Entwurfswechsel über ?draft= bei offenem Gespräch", async () => {
    const anfragen = new Map<string, (titel: string) => void>();
    const laden: TitelLaden = (id) => new Promise((antwort) => anfragen.set(id, antwort));
    async function beantworte(id: string, titel: string): Promise<void> {
      const antwort = anfragen.get(id);
      if (!antwort) throw new Error(`Keine offene Anfrage für Entwurf ${id}`);
      await warte(450);
      await act(async () => antwort(titel));
    }
    await montiere("/erfassen?draft=a", laden);
    await bis(() => Boolean(q(document, "klara-figur")), 120);
    await klick(q(document, "klara-figur"));
    await bis(() => Boolean(q(document, "klara-gespraech")));

    // Vor dem Laden: noch kein Titel.
    expect(q(document, "klara-ort-seite")?.textContent).toBe("Erfassung");
    expect(objekt()).toBe("Neuer, noch unbenannter Entwurf");

    // Erst jetzt liefert der Leseweg den Titel, ohne ein input-Ereignis auszulösen.
    await beantworte("a", "Ölwechsel Presse 4");
    await bis(() => objekt().includes("Ölwechsel"), 80);
    expect(objekt()).toBe("Entwurf „Ölwechsel Presse 4“");

    // Wechsel des Entwurfs über die Abfrage, das Gespräch bleibt offen.
    await klick(q(document, "zu-entwurf-b"));
    expect(q(document, "klara-gespraech")).not.toBeNull();
    expect(q<HTMLInputElement>(document, "blatt-titel")?.value).toBe("");
    await beantworte("b", "Schichtübergabe Linie 2");
    await bis(() => objekt().includes("Schichtübergabe"), 80);
    expect(objekt()).toBe("Entwurf „Schichtübergabe Linie 2“");
    expect(q(document, "klara-gespraech")).not.toBeNull();
  });
});
