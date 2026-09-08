// @vitest-environment jsdom
// ================================================================================================
// JOB 3282 · EDITOR-R26 — DIE ZWEI RÜCKWEGE AUF /erfassen, DIE INS NICHTS FÜHRTEN.
// ================================================================================================
//
// ZWEI BELEGTE BEFUNDE (Codex, Nutzerprüfung review26-ki-editor, 08.09., Live 1.185):
//
//   C  „Import und Anhänge …": „Nach Abbrechen blieb /erfassen auch neun Sekunden später ohne
//      Editor stehen. Gesicherter Entwurf über eigene URL weiter erreichbar."
//   D  „Bedienbarkeit … und Tastatur": „Enter öffnet das fokussierte KI-Menü … Escape schließt,
//      stellt den Fokus aber nicht zum KI-Knopf zurück."
//
// Beide sind RÜCKWEGE: der Mensch hat etwas geöffnet und will dahin zurück, wo er herkam. Beide
// endeten vorher nicht dort — der eine auf einer Fläche ohne Schreibfeld, der andere mit dem Fokus
// auf `body`, also ganz vorne auf der Seite.
//
// WAS HIER MONTIERT WIRD, IST DIE ECHTE SEITE: `Capture` — also das Blatt mit dem Arbeitsraum aus
// `pages/Capture.tsx` als hereingereichtem Bauteil, genau so, wie die Route `/erfassen` es tut.
// Ein nachgebauter Wirt hätte den Befund gar nicht zeigen können: er liegt an der NAHT zwischen
// beiden (die Ansicht gehört dem Blatt, der Abbruch dem Arbeitsraum).
import { afterEach, describe, expect, it, vi } from "vitest";

// DIE NETZWEGE SIND ALLE STILLGELEGT, und zwar OHNE Liste: eine von Hand gepflegte Attrappe müsste
// jede Gruppe kennen, die `Capture` und `Blatt` heute anfassen — und wäre morgen still unvollständig
// (gemessen: `endpoints.gaps.list` fehlte und riss die ganze Fläche mit einer TypeError um). Jeder
// Aufruf antwortet hier deshalb gleich: mit einem ehrlichen Fehler. Das ist auch inhaltlich richtig
// — kein Fall dieser Datei behauptet etwas über Serververhalten, und ein Blatt ohne Netz ist genau
// die Lage, in der beide Rückwege trotzdem tragen müssen.
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
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
// Die Adresse, auf der der Router gerade WIRKLICH steht. `window.location` taugt dafür nicht: der
// MemoryRouter fasst es nicht an, eine Messung daran wäre eine Behauptung ohne Gegenstand.
let adresseJetzt = "";

function Adresssonde(): null {
  const ort = useLocation();
  adresseJetzt = `${ort.pathname}${ort.search}`;
  return null;
}

function mount(adresse = "/erfassen"): void {
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
              { initialEntries: [adresse] },
              createElement(
                RoleProvider,
                null,
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(Adresssonde),
                    createElement(Capture),
                  ),
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
  vi.clearAllMocks();
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

/** Ein Eintrag der offenen Menüfläche, über seinen sichtbaren Text — so findet ihn auch der Mensch. */
function menueEintrag(menue: string, text: string): HTMLElement {
  const flaeche = fordere(`[data-testid="blatt-menue-${menue}"]`);
  const treffer = [...flaeche.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(text),
  );
  if (!(treffer instanceof HTMLElement)) {
    throw new Error(`Eintrag ${text} im Menue ${menue} nicht gefunden`);
  }
  return treffer;
}

/** Der Editor des Blattes — das Schreibfeld, an dem der Mensch den Beitrag schreibt. */
function schreibfeldDa(): boolean {
  return suche('[data-testid="blatt-huelle"] [role="textbox"]') !== null;
}

describe("JOB 3282 · C — Import abbrechen gibt /erfassen sein Schreibfeld zurück", () => {
  it("C1 · Datei → Datei importieren → Abbrechen: der Editor steht sofort wieder da", () => {
    mount();
    expect(schreibfeldDa(), "Ausgangslage: das Blatt zeigt sein Schreibfeld").toBe(true);

    klicke(fordere('[data-testid="blatt-werkzeug-datei"]'));
    klicke(menueEintrag("datei", "Datei"));

    // Der Arbeitsraum hat übernommen — das Blatt zeigt kein Schreibfeld mehr.
    expect(suche('[data-testid="blatt-arbeitsraum"]')).not.toBeNull();
    expect(schreibfeldDa()).toBe(false);

    const abbrechen = [...(container?.querySelectorAll("button") ?? [])].find((b) =>
      (b.textContent ?? "").includes("Abbrechen"),
    );
    if (!(abbrechen instanceof HTMLElement)) {
      throw new Error("Der Knopf Abbrechen ist im Dateiimport nicht da");
    }
    klicke(abbrechen);

    // SOFORT, nicht „nach neun Sekunden": kein Timer, kein Nachladen, keine zweite Handlung.
    expect(suche('[data-testid="blatt-arbeitsraum"]')).toBeNull();
    expect(schreibfeldDa(), "Nach dem Abbruch fehlt das Schreibfeld").toBe(true);
  });

  it("C2 · der Abbruch lässt die Adresse stehen — der fortgesetzte Entwurf bleibt derselbe", () => {
    // Vorher warf `cancelFileImport` fest auf `/erfassen`; ein `?draft=…` fiel dabei weg und das
    // nächste Speichern hätte einen ZWEITEN Entwurf angelegt.
    mount("/erfassen?draft=abc-123");
    expect(adresseJetzt).toBe("/erfassen?draft=abc-123");

    klicke(fordere('[data-testid="blatt-werkzeug-datei"]'));
    klicke(menueEintrag("datei", "Datei"));

    const abbrechen = [...(container?.querySelectorAll("button") ?? [])].find((b) =>
      (b.textContent ?? "").includes("Abbrechen"),
    );
    klicke(abbrechen as HTMLElement);

    // Die Fläche gehört wieder dem Blatt (dass darauf ein Schreibfeld steht, misst C1 — hier
    // scheitert das Laden dieses erfundenen Entwurfs bewusst, und das Blatt sagt es statt zu tun,
    // als wäre nichts).
    expect(suche('[data-testid="blatt-arbeitsraum"]')).toBeNull();
    expect(
      adresseJetzt,
      "Der Abbruch hat die Adresse verstellt — der fortgesetzte Entwurf ist damit ein anderer",
    ).toBe("/erfassen?draft=abc-123");
  });
});

describe("JOB 3282 · D — Escape im KI-Menü gibt den Fokus an den KI-Knopf zurück", () => {
  it("D1 · geöffnet mit der Tastatur, geschlossen mit Escape — der Fokus steht wieder am Werkzeug", () => {
    mount();
    const kiKnopf = fordere('[data-testid="blatt-werkzeug-ki"]');

    // Der Tastaturweg: der Fokus steht auf dem Werkzeug, Enter öffnet (in jsdom als `click`, genau
    // das löst ein Enter auf einem `<button>` aus).
    act(() => {
      kiKnopf.focus();
      kiKnopf.click();
    });
    expect(
      suche('[data-testid="blatt-menue-ki"]'),
      "Das KI-Menü ist nicht aufgegangen",
    ).not.toBeNull();

    // Der Fokus wandert mit Tab in die Fläche und stirbt dort mit ihr — DAS ist der Zustand, in dem
    // Codex Escape gedrückt hat. Ohne KI-Freischaltung sind die Einträge dieses Menüs in der Probe
    // gesperrt und können den Fokus gar nicht annehmen; deshalb wird der Fokuszustand hier direkt
    // hergestellt (`blur()` → `body`), statt eine Freischaltung vorzutäuschen, die es nicht gibt.
    // Der REALISTISCHE Weg über einen wirklich fokussierbaren Eintrag steht in D2.
    act(() => {
      kiKnopf.blur();
    });
    expect(document.activeElement).toBe(document.body);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(
      suche('[data-testid="blatt-menue-ki"]'),
      "Escape hat das Menü nicht geschlossen",
    ).toBeNull();
    expect(
      document.activeElement,
      "Escape lässt den Fokus auf dem body zurück — der nächste Tabulator beginnt ganz vorne",
    ).toBe(kiKnopf);
  });

  it("D2 · dieselbe Mechanik trägt jedes Menü der Zeile (hier: Datei)", () => {
    mount();
    const dateiKnopf = fordere('[data-testid="blatt-werkzeug-datei"]');
    act(() => {
      dateiKnopf.focus();
      dateiKnopf.click();
    });
    const eintrag = fordere('[data-testid="blatt-menue-datei"] button');
    act(() => {
      eintrag.focus();
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(suche('[data-testid="blatt-menue-datei"]')).toBeNull();
    expect(document.activeElement).toBe(dateiKnopf);
  });
});
