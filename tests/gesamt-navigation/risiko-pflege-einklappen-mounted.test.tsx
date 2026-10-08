// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-NAVIGATION · R-1023 (b) — DAS EINKLAPPEN DER BEREICHSPFLEGE VERLIERT
// KEINE EINGABE.
// ================================================================================================
//
// Bens Befund (Nacharbeit 8, Kandidat 758116d8): der Entlastungsschalter auf „Risiken und Lücken"
// baute `BereichsprofilPflege` beim Einklappen aus. Die Zeilen halten ihren ungespeicherten Entwurf
// als lokalen Zustand — Ändern → Einklappen → Aufklappen stand wieder beim gespeicherten Wert, und
// „Speichern" schickte ihn. Diese Datei fährt genau diesen Ablauf an der ECHTEN Seite (`pages/Risk`,
// Admin aus der Sitzung); die Endpointgrenze ist die einzige Attrappe. Aufbau nach
// `tests/analytics/risiko-busfaktor-mounted.test.tsx`.
//
//   E1  Ausgangslage: eingeklappt — Schalter `aria-expanded=false`, Pflegebereich `hidden`
//   E2  Ändern → Einklappen → Aufklappen → Speichern: die geänderten Werte stehen noch da und gehen
//       genau so an den Server; es sind dieselben Formularknoten (nicht neu aufgebaut)
//   E3  Gegenprobe: ohne Änderung schickt Speichern den gespeicherten Stand — E2 misst also wirklich
//       den Erhalt des Entwurfs und nicht einen festen Wert
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  setCategoryProfile: vi.fn(async (body: unknown) => body),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  const ko = (id: string, status: string) => ({
    id,
    title: id,
    statement: "s",
    category: "Betrieb",
    author: "u2",
    originalAuthor: "u2",
    status,
    trust: 70,
  });
  const kos = [ko("k1", "validiert"), ko("k2", "offen")];
  return {
    endpoints: {
      conflicts: { list: ok([]) },
      gaps: { list: ok([]), summary: ok({ total: 0, byPriority: {} }) },
      ko: { list: ok(kos) },
      directory: { list: ok([{ id: "u2", name: "Hanna Beispiel" }]) },
      analytics: {
        busfactor: ok([{ category: "Betrieb", koCount: 2, authorCount: 1, singleSource: true }]),
        expertise: ok([]),
      },
      aiCheck: { coverageSummary: ok({ total: 2, incomplete: 0, unchecked: 0, noCoverage: 0 }) },
      lifecycle: { pending: ok([]) },
      management: {
        riskHorizon: ok({ generatedAt: "", seesAll: true, areas: [] }),
        // Gespeicherter Stand: Betrieb ohne Verantwortung, Kritikalität „mittel".
        profiles: ok({
          categories: [
            {
              category: "Betrieb",
              managerId: null,
              criticality: "mittel",
              processProximity: null,
              repetition: null,
              damagePotential: null,
              updatedAt: "2026-10-01T00:00:00.000Z",
              updatedBy: "u1",
            },
          ],
          retirement: [],
        }),
        setCategoryProfile: d.setCategoryProfile,
        setRetirement: ok({ entry: null }),
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Risk } from "../../apps/web/src/pages/Risk";

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
              createElement(MemoryRouter, { initialEntries: ["/risiko"] }, createElement(Risk)),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const q = <T extends Element>(sel: string): T | null => container.querySelector<T>(sel);
const schalter = (): HTMLButtonElement | null =>
  q<HTMLButtonElement>('[data-testid="risiko-pflege-schalter"]');
const bereich = (): HTMLElement | null => q<HTMLElement>('[data-testid="risiko-pflege"]');
const zeile = (): Element | null => q('[data-testid="pflege-bereich"][data-kategorie="Betrieb"]');
const manager = (): HTMLSelectElement | null =>
  zeile()?.querySelector<HTMLSelectElement>('[data-testid="pflege-manager"]') ?? null;
const kritikalitaet = (): HTMLSelectElement | null =>
  zeile()?.querySelector<HTMLSelectElement>('[data-faktor="criticality"]') ?? null;

async function klicken(el: Element | null): Promise<void> {
  expect(el, "Element fehlt").not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
    await flush();
  });
}

async function waehlen(el: HTMLSelectElement | null, wert: string): Promise<void> {
  expect(el, "Auswahl fehlt").not.toBeNull();
  const setzer = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(el, wert);
    el?.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.setCategoryProfile.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("R-1023 (b) · die eingeklappte Bereichspflege behält ungespeicherte Eingaben", () => {
  it("E1 · Ausgangslage: eingeklappt — Schalter zu, Pflegebereich verborgen", async () => {
    await mount();
    expect(schalter(), "der Admin sieht den Schalter nicht").not.toBeNull();
    expect(schalter()?.getAttribute("aria-expanded")).toBe("false");
    expect(bereich()?.hidden, "die Pflege steht eingeklappt sichtbar da").toBe(true);
  });

  it("E2 · Ändern → Einklappen → Aufklappen → Speichern: die Eingaben bleiben und gehen hinaus", async () => {
    await mount();
    await klicken(schalter());
    expect(bereich()?.hidden).toBe(false);
    const auswahlVorher = manager();
    await waehlen(manager(), "u2");
    await waehlen(kritikalitaet(), "hoch");

    await klicken(schalter());
    expect(schalter()?.getAttribute("aria-expanded")).toBe("false");
    expect(bereich()?.hidden, "eingeklappt ist die Pflege noch sichtbar").toBe(true);

    await klicken(schalter());
    expect(bereich()?.hidden).toBe(false);
    expect(manager(), "das Formular wurde neu aufgebaut").toBe(auswahlVorher);
    expect(manager()?.value, "die gewählte Verantwortung ist verloren").toBe("u2");
    expect(kritikalitaet()?.value, "die gewählte Kritikalität ist verloren").toBe("hoch");

    await klicken(zeile()?.querySelector('[data-testid="pflege-speichern"]') ?? null);
    expect(d.setCategoryProfile).toHaveBeenCalledWith({
      category: "Betrieb",
      managerId: "u2",
      criticality: "hoch",
      processProximity: null,
      repetition: null,
      damagePotential: null,
    });
  });

  it("E3 · Gegenprobe: ohne Änderung geht der gespeicherte Stand hinaus", async () => {
    await mount();
    await klicken(schalter());
    await klicken(schalter());
    await klicken(schalter());
    expect(manager()?.value).toBe("");
    expect(kritikalitaet()?.value).toBe("mittel");
    await klicken(zeile()?.querySelector('[data-testid="pflege-speichern"]') ?? null);
    expect(d.setCategoryProfile).toHaveBeenCalledWith({
      category: "Betrieb",
      managerId: null,
      criticality: "mittel",
      processProximity: null,
      repetition: null,
      damagePotential: null,
    });
  });
});
