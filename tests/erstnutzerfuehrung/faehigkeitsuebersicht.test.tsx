// @vitest-environment jsdom
// ================================================================================================
// R-1012 (Folgeauftrag gesamt-erstnutzerfuehrung-quellen) — DER ERSTE BLICK: WAS KLARWERK KANN.
// ================================================================================================
//
// Herkunft: `OFFEN.md` U4 („der erste Blick", SCRUM-474) — Nataschas zweite Bedingung fürs
// Wiederbenutzen, „ein umfassendes Bild, was Klarwerk in der Lage ist zu leisten".
//
// Gemessen wird am echten Weg: die ganze Startseite gemountet, „…" geklickt, „Über KLARWERK"
// geklickt — keine Abkürzung in den Blattzustand. Was der Fall belegt und was nicht:
//   F0  die Tabelle nennt nur vorhandene Bereiche unter ihrem angezeigten Namen, in der Reihenfolge
//       erfassen → prüfen → finden, und deckt die vier Themen von R-0928 (Erfassen, Validieren,
//       Fragen, Bibliothek) ab; jeder Text steht in DE/EN/NL.
//   F1  das Blatt trägt Zwecksatz UND Übersicht; jeder Eintrag ist für „controller" ein Weg in die
//       volle Funktion, der Hilfe-Weg führt nach `/hilfe`.
//   F2  für „viewer" bleiben Bereiche ausserhalb der Rolle als Auskunft stehen und sind kein Link.
//   F3  das Sichtfeld der Startseite bleibt unverändert (H5): vor dem Klick steht die Übersicht nicht da.
//   F4  ein Klick auf einen Eintrag landet wirklich auf der Route.
//   F5  EN und NL zeigen übersetzte Überschriften, keine Schlüssel.
// NICHT belegt: dass ein Mensch ohne Schulung damit „ein umfassendes Bild" bekommt. Das zeigt erst
// ein Nachtest mit Menschen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  rolle: "controller" as "viewer" | "experte" | "controller" | "admin",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: box.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: { list: leer },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      validation: { board: leer },
      lifecycle: { pending: leer },
      gaps: { summary: vi.fn(async () => ({ open: 0, byPriority: { hoch: 0 } })) },
      learningPaths: { byRole: vi.fn(async () => null), progress: leer },
      livewall: { get: vi.fn(async () => ({ saved: [], helped: [], helpedToday: 0 })) },
      notifications: { list: leer },
      admin: { demoStatus: vi.fn(async () => ({ present: false, count: 0 })) },
      analytics: { overview: vi.fn(async () => ({ total: 0, byStatus: {} })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS, anzeigeNameKey, routePathAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import {
  FAEHIGKEITEN,
  FAEHIGKEITS_SCHRITTE,
  faehigkeitsSchrittKey,
} from "../../apps/web/src/lib/faehigkeiten";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const SPRACHEN = ["de", "en", "nl"] as const;

function Ort(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-ort": "1" }, ort.pathname);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
                createElement(MemoryRouter, { initialEntries: ["/start"] }, [
                  createElement(Ort, { key: "o" }),
                  createElement(Start, { key: "s" }),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Die Sitzung löst in zwei Stufen auf (`/auth/status`, dann `/auth/me`).
  await act(flush);
  await act(flush);
}

/** „…" → „Über KLARWERK", über die echten Knöpfe. */
async function oeffneUeber(): Promise<void> {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="h5-start-menu"]')?.click();
    await flush();
  });
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>('[data-testid="h5-start-menu-punkt-ueber"]')
      ?.click();
    await flush();
  });
}

/** Das Blatt wird nach `document.body` portaliert — deshalb an `document` gebunden. */
function uebersicht(): HTMLElement {
  const el = document.querySelector<HTMLElement>(
    '[data-testid="h5-start-blatt-ueber"] [data-testid="erstnutzer-faehigkeiten"]',
  );
  if (!el) {
    throw new Error("Die Fähigkeitsübersicht fehlt im Blatt „Über KLARWERK“");
  }
  return el;
}

const eintrag = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-testid="erstnutzer-faehigkeit-${id}"]`);

const ort = (): string => container.querySelector("[data-ort]")?.textContent ?? "";

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.rolle = "controller";
  window.localStorage.clear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  qc.clear();
  vi.clearAllMocks();
});

describe("R-1012 · F0 — die Tabelle nennt nur Vorhandenes", () => {
  it("F0a · jeder Eintrag ist ein Navigationspunkt: Pfad und Name kommen aus der einen Registry", () => {
    expect(FAEHIGKEITEN.length).toBeGreaterThan(5);
    for (const f of FAEHIGKEITEN) {
      const item = ALL_ITEMS.find((i) => i.id === f.id);
      expect(item, `kein Navigationspunkt „${f.id}“`).toBeDefined();
      expect(f.to).toBe(item?.path);
      expect(f.nameKey).toBe(anzeigeNameKey(item as NonNullable<typeof item>));
      // Stufe-2-Bereiche sieht ein Erstnutzer nicht — die Übersicht verspricht sie nicht.
      expect(item?.stufe2, `${f.id} ist ein Stufe-2-Bereich`).not.toBe(true);
    }
    expect(new Set(FAEHIGKEITEN.map((f) => f.id)).size).toBe(FAEHIGKEITEN.length);
  });

  it("F0b · Reihenfolge der Kernschleife erfassen → prüfen → finden (R-0939)", () => {
    expect(FAEHIGKEITS_SCHRITTE).toEqual(["erfassen", "pruefen", "finden"]);
    const folge = FAEHIGKEITEN.map((f) => FAEHIGKEITS_SCHRITTE.indexOf(f.schritt));
    expect(folge).toEqual([...folge].sort((a, b) => a - b));
    for (const s of FAEHIGKEITS_SCHRITTE) {
      expect(
        FAEHIGKEITEN.some((f) => f.schritt === s),
        `Schritt „${s}“ ist leer`,
      ).toBe(true);
    }
  });

  it("F0c · die vier Themen aus R-0928 sind dabei: Erfassen, Validieren, Fragen, Bibliothek", () => {
    const ziele = FAEHIGKEITEN.map((f) => f.to);
    for (const pfad of ["/erfassen", "/validierung", "/fragen", "/bibliothek"]) {
      expect(ziele).toContain(pfad);
    }
  });

  it("F0d · jeder Text steht in DE, EN und NL, ohne offene Variable", async () => {
    const schluessel = [
      "erstnutzer.faehigkeiten.titel",
      "erstnutzer.faehigkeiten.einleitung",
      "erstnutzer.faehigkeiten.zurHilfe",
      ...FAEHIGKEITS_SCHRITTE.map(faehigkeitsSchrittKey),
      ...FAEHIGKEITEN.flatMap((f) => [f.nameKey, f.textKey]),
    ];
    for (const lng of SPRACHEN) {
      const t = i18n.getFixedT(lng);
      for (const k of schluessel) {
        const wert = t(k);
        expect(wert, `${lng}:${k}`).not.toBe(k);
        expect(wert.length, `${lng}:${k}`).toBeGreaterThan(3);
      }
      const hilfe = t("erstnutzer.faehigkeiten.hilfe", { seitenhilfe: t("menue.seitenhilfe") });
      expect(hilfe, `${lng}: Hilfesatz`).not.toContain("{{");
      expect(hilfe, `${lng}: Hilfesatz nennt den Menüpunkt`).toContain(t("menue.seitenhilfe"));
    }
  });
});

describe("R-1012 · gemountet am echten Weg „…“ → „Über KLARWERK“", () => {
  it("F1 · controller: Zwecksatz bleibt, darunter jeder Bereich als Weg in die volle Funktion", async () => {
    await mount();
    await oeffneUeber();
    const blatt = document.querySelector<HTMLElement>('[data-testid="h5-start-blatt-ueber"]');
    expect(blatt?.textContent).toContain(i18n.t("start.purpose"));
    const text = uebersicht().textContent ?? "";
    expect(text).toContain(i18n.t("erstnutzer.faehigkeiten.titel"));
    for (const s of FAEHIGKEITS_SCHRITTE) {
      expect(text).toContain(i18n.t(faehigkeitsSchrittKey(s)));
    }
    for (const f of FAEHIGKEITEN) {
      const el = eintrag(f.id);
      expect(el, `Eintrag ${f.id} fehlt`).not.toBeNull();
      expect(el?.tagName, `${f.id} ist kein Link`).toBe("A");
      expect(el?.getAttribute("href")).toBe(f.to);
      expect(el?.textContent).toContain(i18n.t(f.nameKey));
      expect(el?.textContent).toContain(i18n.t(f.textKey));
    }
    const hilfe = document.querySelector('[data-testid="erstnutzer-faehigkeiten-hilfe"]');
    expect(hilfe?.tagName).toBe("A");
    expect(hilfe?.getAttribute("href")).toBe("/hilfe");
  });

  it("F2 · viewer: was die Rolle nicht erreicht, bleibt Auskunft und wird kein Link", async () => {
    box.rolle = "viewer";
    await mount();
    await oeffneUeber();
    uebersicht();
    let gesperrt = 0;
    for (const f of FAEHIGKEITEN) {
      const el = eintrag(f.id);
      expect(el, `Eintrag ${f.id} fehlt`).not.toBeNull();
      // Der Text bleibt in beiden Fassungen stehen — die Übersicht verschweigt nichts.
      expect(el?.textContent).toContain(i18n.t(f.textKey));
      if (routePathAllows(f.to, "viewer")) {
        expect(el?.tagName, `${f.id} sollte für viewer ein Weg sein`).toBe("A");
      } else {
        gesperrt += 1;
        expect(el?.tagName, `${f.id} darf für viewer kein Link sein`).not.toBe("A");
        expect(el?.getAttribute("data-role-no-reach")).toBe("true");
        expect(el?.querySelector("a")).toBeNull();
      }
    }
    // KALIBRIERUNG: ohne gesperrten Eintrag bewiese dieser Fall nichts über die Rollenfrage.
    expect(gesperrt).toBeGreaterThan(0);
  });

  it("F3 · das Sichtfeld der Startseite bleibt unverändert: vor dem Klick keine Übersicht", async () => {
    await mount();
    expect(document.querySelector('[data-testid="erstnutzer-faehigkeiten"]')).toBeNull();
    expect(container.textContent).not.toContain(i18n.t("erstnutzer.faehigkeiten.titel"));
    await oeffneUeber();
    expect(document.querySelector('[data-testid="erstnutzer-faehigkeiten"]')).not.toBeNull();
  });

  it("F4 · ein Klick auf „Bibliothek“ landet auf /bibliothek", async () => {
    await mount();
    await oeffneUeber();
    expect(ort()).toBe("/start");
    await act(async () => {
      eintrag("bibliothek")?.click();
      await flush();
    });
    expect(ort()).toBe("/bibliothek");
  });

  for (const lng of ["en", "nl"] as const) {
    it(`F5-${lng} · die Übersicht ist übersetzt, nicht verschlüsselt`, async () => {
      await i18n.changeLanguage(lng);
      await mount();
      await oeffneUeber();
      const text = uebersicht().textContent ?? "";
      expect(text).toContain(i18n.getFixedT(lng)("erstnutzer.faehigkeiten.titel"));
      expect(text).not.toContain("erstnutzer.");
      expect(text).not.toContain(i18n.getFixedT("de")("erstnutzer.faehigkeiten.titel"));
    });
  }
});
