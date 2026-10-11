// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-dialog-bedienung` — ZWEI LÜCKEN AUF /erfassen, AM ECHTEN BLATT GEMESSEN.
// ================================================================================================
//
//   R  FR-MOB-03 / R-1018: „Löschen und andere gefährliche Aktionen verlangen mobil eine Bestätigung
//      innerhalb der Anwendung, keinen Systemdialog des Betriebssystems." „Eingabe verwerfen" fragte
//      bis hierher über `window.confirm`. Jetzt fragt das Blatt selbst (Rückfragezeile).
//   M  N-0071: „Beim Öffnen den ersten Eintrag fokussieren, Pfeiltasten unterstützen und beim
//      Schließen den Fokus auf KI zurückführen." Die Rückgabe (Escape → Werkzeug) misst
//      `tests/editor-r26/erfassen-rueckwege-mounted.test.tsx` D1/D2; hier steht der Hinweg.
//
// GEMESSEN WIRD AM MENÜ „Datei", nicht an „KI": ohne Modell sind die KI-Einträge in dieser Probe
// gesperrt und nehmen keinen Fokus an (dieselbe Grenze, die D1 in `editor-r26` benennt). Beide
// Menüs sind dasselbe Bauteil (`components/erfassen/Menue.tsx`); die Mechanik steht dort EINMAL.
//
// WAS DIESE DATEI NICHT LEISTET: echtes Tabben in einem Browser, eine Sprachausgabe, ein Telefon.
// jsdom bewegt den Fokus nur, wo die Anwendung ihn selbst setzt — genau das wird hier gemessen.
import { afterEach, describe, expect, it, vi } from "vitest";

// Netz stillgelegt, ohne Liste — dieselbe Bauform wie `tests/editor-r26/erfassen-rueckwege-mounted`.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const gruppe = (): unknown =>
    new Proxy(
      {},
      {
        get: () => async (): Promise<never> => {
          throw new Error("kein Netz in dieser Probe");
        },
      },
    );
  return { endpoints: new Proxy({}, { get: () => gruppe() }) };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function mount(): void {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            AuthProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/erfassen"] },
              createElement(
                RoleProvider,
                null,
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(NavGuardProvider, null, createElement(Capture)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

afterEach(() => {
  if (root) {
    const r = root;
    act(() => {
      r.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

function suche(selektor: string): HTMLElement | null {
  const el = container?.querySelector(selektor);
  return el instanceof HTMLElement ? el : null;
}

function fordere(selektor: string): HTMLElement {
  const el = suche(selektor);
  if (!el) {
    throw new Error(`${selektor} ist nicht da`);
  }
  return el;
}

function klicke(el: HTMLElement): void {
  act(() => {
    el.click();
  });
}

function taste(el: HTMLElement, key: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

function titelfeld(): HTMLInputElement {
  const el = fordere('[data-testid="blatt-titel"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Titelfeld ist kein Eingabefeld");
  }
  return el;
}

function tippeTitel(wert: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  act(() => {
    setter.call(titelfeld(), wert);
    titelfeld().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** „…" öffnen und „Eingabe verwerfen" wählen — der Weg, den ein Mensch geht. */
function eingabeVerwerfenWaehlen(): void {
  klicke(fordere('[data-testid="blatt-werkzeug-mehr"]'));
  const alle = container?.querySelectorAll('[data-testid="blatt-menue-mehr"] [role="menuitem"]');
  const eintrag = [...(alle ?? [])].find(
    (e) => (e.textContent ?? "").trim() === i18n.t("fd.discardInput"),
  );
  if (!(eintrag instanceof HTMLButtonElement)) {
    throw new Error("„Eingabe verwerfen“ steht nicht im Menü");
  }
  expect(
    eintrag.disabled,
    "„Eingabe verwerfen“ ist gesperrt, obwohl das Blatt beschrieben ist",
  ).toBe(false);
  klicke(eintrag);
}

function dateiEintraege(): HTMLElement[] {
  const alle = container?.querySelectorAll<HTMLElement>(
    '[data-testid="blatt-menue-datei"] [role="menuitem"]',
  );
  return [...(alle ?? [])];
}

describe("FR-MOB-03 · R — „Eingabe verwerfen“ fragt in der Anwendung, nicht das Betriebssystem", () => {
  it("R1 · die Frage steht im Blatt, der Fokus liegt auf „Weiter bearbeiten“, kein Systemdialog", () => {
    const system = vi.spyOn(window, "confirm").mockReturnValue(true);
    mount();
    tippeTitel("Druck am Ventil V2 prüfen");

    eingabeVerwerfenWaehlen();

    expect(system, "es ging ein Systemdialog auf").not.toHaveBeenCalled();
    const zeile = fordere('[data-testid="blatt-rueckfrage"]');
    expect(zeile.tagName, "die Rückfrage ist keine Gruppe").toBe("FIELDSET");
    const name = zeile.getAttribute("aria-labelledby") ?? "";
    expect(container?.querySelector(`#${name}`)?.textContent).toBe(i18n.t("fd.confirmDiscard"));
    expect(document.activeElement, "der Fokus steht nicht auf dem sicheren Knopf").toBe(
      fordere('[data-testid="blatt-rueckfrage-nein"]'),
    );
    // Gefragt ist noch nicht verworfen.
    expect(titelfeld().value).toBe("Druck am Ventil V2 prüfen");
  });

  it("R2 · „Weiter bearbeiten“ behält alles und gibt den Fokus an „…“ zurück", () => {
    mount();
    tippeTitel("Druck am Ventil V2 prüfen");
    eingabeVerwerfenWaehlen();

    klicke(fordere('[data-testid="blatt-rueckfrage-nein"]'));

    expect(suche('[data-testid="blatt-rueckfrage"]')).toBeNull();
    expect(titelfeld().value).toBe("Druck am Ventil V2 prüfen");
    expect(document.activeElement).toBe(fordere('[data-testid="blatt-werkzeug-mehr"]'));
  });

  it("R3 · „Verwerfen“ leert das Blatt — erst nach der Zustimmung", () => {
    const system = vi.spyOn(window, "confirm").mockReturnValue(false);
    mount();
    tippeTitel("Druck am Ventil V2 prüfen");
    eingabeVerwerfenWaehlen();

    klicke(fordere('[data-testid="blatt-rueckfrage-ja"]'));

    expect(suche('[data-testid="blatt-rueckfrage"]')).toBeNull();
    expect(titelfeld().value).toBe("");
    // Hätte das Blatt doch noch den Systemdialog gefragt, hätte dessen „Nein“ (false) das Leeren
    // verhindert — und er wäre gerufen worden.
    expect(system).not.toHaveBeenCalled();
  });
});

describe("N-0071 · M — der Tastaturweg in ein Menü der Werkzeugzeile", () => {
  it("M1 · Enter öffnet und setzt den Fokus auf den ersten Eintrag", () => {
    mount();
    const werkzeug = fordere('[data-testid="blatt-werkzeug-datei"]');
    act(() => {
      werkzeug.focus();
    });
    // Enter auf einem `<button>`: erst das Tastenereignis, dann der Klick, den der Browser auslöst.
    taste(werkzeug, "Enter");
    klicke(werkzeug);

    const eintraege = dateiEintraege();
    expect(eintraege.length, "das Menü „Datei“ ist nicht aufgegangen").toBeGreaterThan(1);
    expect(document.activeElement, "Fokus liegt nicht auf dem ersten Eintrag").toBe(eintraege[0]);
  });

  it("M2 · Pfeil ab/auf wandern ringsum, Pos1/Ende springen an die Enden", () => {
    mount();
    const werkzeug = fordere('[data-testid="blatt-werkzeug-datei"]');
    act(() => {
      werkzeug.focus();
    });
    taste(werkzeug, "Enter");
    klicke(werkzeug);
    const eintraege = dateiEintraege();
    const letzter = eintraege[eintraege.length - 1] as HTMLElement;

    taste(eintraege[0] as HTMLElement, "ArrowDown");
    expect(document.activeElement).toBe(eintraege[1]);

    taste(eintraege[1] as HTMLElement, "ArrowUp");
    expect(document.activeElement).toBe(eintraege[0]);

    taste(eintraege[0] as HTMLElement, "ArrowUp");
    expect(document.activeElement, "Pfeil auf am ersten Eintrag läuft nicht ans Ende").toBe(
      letzter,
    );

    taste(letzter, "ArrowDown");
    expect(document.activeElement, "Pfeil ab am letzten Eintrag läuft nicht an den Anfang").toBe(
      eintraege[0],
    );

    taste(eintraege[0] as HTMLElement, "End");
    expect(document.activeElement).toBe(letzter);
    taste(letzter, "Home");
    expect(document.activeElement).toBe(eintraege[0]);
  });

  it("M3 · Pfeil ab am geschlossenen Werkzeug öffnet und fokussiert den ersten Eintrag", () => {
    mount();
    const werkzeug = fordere('[data-testid="blatt-werkzeug-datei"]');
    act(() => {
      werkzeug.focus();
    });
    taste(werkzeug, "ArrowDown");

    const eintraege = dateiEintraege();
    expect(eintraege.length).toBeGreaterThan(1);
    expect(document.activeElement).toBe(eintraege[0]);
  });

  it("M4 · der ganze Weg: hinein mit Enter, wandern, hinaus mit Escape — zurück am Werkzeug", () => {
    mount();
    const werkzeug = fordere('[data-testid="blatt-werkzeug-datei"]');
    act(() => {
      werkzeug.focus();
    });
    taste(werkzeug, "Enter");
    klicke(werkzeug);
    taste(dateiEintraege()[0] as HTMLElement, "ArrowDown");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(suche('[data-testid="blatt-menue-datei"]')).toBeNull();
    expect(document.activeElement).toBe(werkzeug);
  });

  it("M5 · GEGENPROBE: mit der Maus geöffnet bleibt der Fokus, wo er war", () => {
    mount();
    const werkzeug = fordere('[data-testid="blatt-werkzeug-datei"]');
    act(() => {
      werkzeug.focus();
    });
    klicke(werkzeug);

    expect(dateiEintraege().length).toBeGreaterThan(1);
    expect(document.activeElement, "ein Mausklick hat den Fokus ins Menü gezogen").toBe(werkzeug);
  });
});
