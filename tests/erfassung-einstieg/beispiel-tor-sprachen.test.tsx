// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg` — DIE BEISPIEL-RÜCKFRAGE SPRICHT DIE SPRACHE DER SITZUNG.
// ================================================================================================
//
// Bis hierher standen Frage und Bestätigung der Rückfrage vor dem Einreichen von Beispieldaten als
// deutscher Klartext in `pages/Capture.tsx` (`BEISPIEL_TOR_TEXT`), auch in einer englischen oder
// niederländischen Sitzung. Jetzt kommen sie aus `texte/einstieg.ts`.
//
// DER KLICKPFAD ist wörtlich der aus `tests/capture/f0007-beispiel-nur-bewusst-ui.test.tsx` (dort
// ausführlich begründet: nur Endpunkte und Modelllauf sind gefälscht, jeder Klick ist der eines
// Menschen). Dieselbe Sperre wird hier nicht noch einmal bewiesen — gemessen wird nur, dass sie in
// jeder Sprache ihren eigenen Satz trägt und die Bestätigung weiter genau eine Anlage auslöst.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  /** Jeder Aufruf, der ein Wissensobjekt in den Bestand legen wuerde. */
  koCreates: [] as Record<string, unknown>[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: ok([]),
        create: ok({ id: "d1" }),
        update: ok({ id: "d1" }),
        remove: ok({}),
        promote: ok({ id: "ko-promote" }),
      },
      ko: {
        // DER ZAEHLER. Jeder Aufruf hier waere ein Wissensobjekt im Bestand.
        create: vi.fn(async (p: Record<string, unknown>) => {
          box.koCreates.push(p);
          return { id: `ko-${box.koCreates.length}`, title: String(p.title ?? "") };
        }),
        createFromDocument: vi.fn(async () => ({ id: "ko-doc" })),
        get: ok(null),
      },
      objects: { upload: ok({ objectId: "o1" }) },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        // Nur der Modelllauf ist gefaelscht. Titel und Aussage sind noetig, damit
        // `captureReadiness` den Einreichen-Knopf ueberhaupt freigibt (`canSave`).
        structure: vi.fn(async () => ({
          title: "Dosierwert nach Schichtwechsel stabilisieren",
          statement:
            "Vor dem ersten Auftrag den Nullpunkt am HMI pruefen und die Dosierpumpe DP-4 entlueften.",
          conditions: ["Nach Gebindewechsel oder laengerer Pause"],
          measures: ["Nullpunkt am HMI pruefen", "Dosierpumpe DP-4 entlueften"],
          tags: [],
        })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
                  { initialEntries: ["/erfassen"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/erfassen",
                      element: createElement(CaptureArbeitsraum),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await arbeitsbereichOeffnen();
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function alleKnoepfe(): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter(
    (b): b is HTMLButtonElement => b instanceof HTMLButtonElement,
  );
}

function knopfMit(teil: string): HTMLButtonElement {
  const btn = alleKnoepfe().find((b) => (b.textContent ?? "").replace(/\s+/g, " ").includes(teil));
  if (!btn) {
    throw new Error(`Knopf „${teil}" nicht gefunden. Sichtbar: ${pageText().slice(0, 900)}`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function setNativeValue(el: HTMLElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
}

/** Eine echte Nutzereingabe: nativer Wert plus die Ereignisse, die ein Browser feuert. */
async function tippen(el: HTMLElement, value: string): Promise<void> {
  setNativeValue(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

// ------------------------------------------------------------------------------------------------
// SICHTBARKEIT — was der Mensch am Bildschirm sieht, nicht was im Zustand steht
// ------------------------------------------------------------------------------------------------

/** Die Rueckfrage, an ihrem eigenen Text erkannt — nicht an einer Klasse oder einem Testhaken. */
function rueckfrageSichtbar(): boolean {
  return pageText().includes(i18n.t("einstieg.beispiel.frage"));
}

function bestaetigungsKnopf(): HTMLButtonElement {
  return knopfMit(i18n.t("einstieg.beispiel.bestaetigen"));
}

/**
 * Der ECHTE Einreichen-Knopf. „Pruefen & einreichen" steht auch als Wegmarke in der Schrittleiste;
 * gemeint ist der letzte, der wirklich klickbar ist. Ein gesperrter Knopf ist ein Fehler und keine
 * Messung — sonst waere jede Null hier wertlos.
 */
function einreichKnopf(): HTMLButtonElement {
  const kandidaten = alleKnoepfe().filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("capture.submit")),
  );
  const btn = kandidaten[kandidaten.length - 1];
  if (!btn) {
    throw new Error(`Einreichen-Knopf nicht gefunden. Sichtbar: ${pageText().slice(-900)}`);
  }
  if (btn.disabled) {
    throw new Error(
      `Einreichen ist gesperrt — diese Messung waere wertlos. ${pageText().slice(-900)}`,
    );
  }
  return btn;
}

// ------------------------------------------------------------------------------------------------
// DER KLICKPFAD — genau der, den ein Mensch geht
// ------------------------------------------------------------------------------------------------

/**
 * Die Erfassungsseite startet mit eingeklapptem Arbeitsbereich („Weitere Wege anzeigen"). Ohne
 * dieses Aufklappen gibt es weder Erzaehlfeld noch „Beispiel laden" — der Test klickt also genau
 * das, was ein Mensch auch klicken muss.
 */
async function arbeitsbereichOeffnen(): Promise<void> {
  // Zielorientiert statt nach Beschriftung: der Aufklappzustand ueberlebt den Unmount des
  // vorigen Falls, weshalb derselbe Schalter mal „anzeigen" und mal „einklappen" heisst. Geklickt
  // wird, bis der Erfassungsweg wirklich offen liegt — hoechstens dreimal, damit ein kaputter
  // Schalter nicht als Endlosschleife erscheint.
  for (let versuch = 0; versuch < 3; versuch++) {
    const offen = alleKnoepfe().some((b) =>
      (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("capture.loadExample")),
    );
    if (offen) {
      return;
    }
    const schalter = alleKnoepfe().find((b) =>
      (b.textContent ?? "").replace(/\s+/g, " ").includes("Weitere Wege"),
    );
    if (!schalter) {
      return;
    }
    await click(schalter);
  }
}

async function beispielLaden(): Promise<void> {
  await click(knopfMit(i18n.t("capture.loadExample")));
}

async function strukturieren(): Promise<void> {
  await click(knopfMit(i18n.t("capture.structure")));
}

/**
 * JOB 3082 (Q3 a): DIE VERTRAULICHKEIT IST SEITHER PFLICHT VOR DEM EINREICHEN — ohne ausdrueckliche
 * Wahl laesst `requestSubmit` nichts durch. Dieser Fall misst die BEISPIEL-Ruecksprache, nicht die
 * Vertraulichkeitspflicht; die Wahl gehoert deshalb in den Klickpfad wie jede andere Eingabe auch,
 * sonst haenge die Null unten an der falschen Sperre. Belegt wird die Pflicht selbst in
 * `tests/vertraulichkeit-pflicht/erfassen-arbeitsraum-verlangt-stufe.test.tsx`.
 */
async function vertraulichkeitWaehlen(): Promise<void> {
  let feld = container.querySelector('[data-testid="capture-vertraulichkeit"]');
  if (!(feld instanceof HTMLSelectElement)) {
    // Im Experten-Weg liegt die Auswahl in den erweiterten Feldern; im gefuehrten Weg steht sie
    // direkt an der Einreich-Entscheidung.
    const schalter = alleKnoepfe().find((b) =>
      (b.textContent ?? "").includes(i18n.t("capture.advanced.title")),
    );
    if (schalter) {
      await click(schalter);
    }
    feld = container.querySelector('[data-testid="capture-vertraulichkeit"]');
  }
  if (!(feld instanceof HTMLSelectElement)) {
    throw new Error(`Vertraulichkeits-Auswahl nicht gefunden. Sichtbar: ${pageText().slice(-900)}`);
  }
  await tippen(feld, "intern");
}

beforeEach(async () => {
  box.koCreates.length = 0;
  // Jeder Fall startet auf einer frischen Seite. Ohne das truege ein Test den Erfolgsschirm oder
  // den aufgeklappten Arbeitsbereich des vorigen in seine Messung — und die Reihenfolge der Faelle
  // entschiede mit ueber ihr Ergebnis.
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

const DEUTSCH = ["Das sind Beispieldaten.", "Ja, Beispiel einreichen"];

describe("Beispiel-Rückfrage in DE, EN und NL", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`${sprache}: Frage und Bestätigung in der Sprache der Sitzung, Bestätigung legt genau eins an`, async () => {
      await i18n.changeLanguage(sprache);
      await mount();
      await beispielLaden();
      await strukturieren();
      await vertraulichkeitWaehlen();
      await click(einreichKnopf());
      expect(box.koCreates).toHaveLength(0);

      expect(rueckfrageSichtbar(), pageText().slice(-900)).toBe(true);
      if (sprache !== "de") {
        // Kein deutscher Rest in einer fremden Sitzung — und der Schlüssel ist wirklich übersetzt.
        for (const rest of DEUTSCH) {
          expect(pageText()).not.toContain(rest);
        }
        expect(i18n.t("einstieg.beispiel.frage")).not.toBe(
          i18n.getFixedT("de")("einstieg.beispiel.frage"),
        );
      } else {
        // Der deutsche Wortlaut ist unverändert der bisherige.
        expect(pageText()).toContain(DEUTSCH[0]);
      }

      await click(bestaetigungsKnopf());
      expect(box.koCreates).toHaveLength(1);
    });
  }
});

afterEach(async () => {
  await i18n.changeLanguage("de");
});
