// @vitest-environment jsdom
// ================================================================================================
// R-0928 / R-1675 (Folgeauftrag gesamt-erstnutzerfuehrung-quellen, Nacharbeit 10) — VIER KURZE
// THEMATISCHE EINSTIEGE VOR DEN VOLLFUNKTIONEN.
// ================================================================================================
//
// Gemessen an der echten Seite `pages/Einstieg.tsx` hinter ihrer echten Adresse `/einstieg/:thema`:
//   E0  die Tabelle: genau vier Themen, je eigene Adresse, Ziel und Name aus der Fähigkeitsübersicht,
//       je ein Satz für den ersten Schritt in DE/EN/NL.
//   E1  controller: jede der vier Ansichten zeigt Name, Zweck und ersten Schritt und übergibt per
//       Klick an GENAU die Vollfunktion; die anderen drei Einstiege sind verlinkt.
//   E2  viewer/experte: wo die Rolle die Vollfunktion nicht erreicht, ist die Übergabe Auskunft ohne
//       Link, mit Zugriffshinweis und dem Satz zur Rolle; erreichbare Übergaben bleiben Links.
//   E3  „Fragen“ × KI-Lage (an/aus/Fehler/abgeschaltet) × DE/EN/NL: der Zweck sagt die Antwort nur
//       zu, wenn sie möglich ist — dieselbe Ableitung wie im Blatt „Über KLARWERK“.
//   E4  ein unbekanntes Thema führt auf die Startseite, nicht auf eine leere Ansicht.
// NICHT belegt: ob ein ungeschulter Mensch sich damit zurechtfindet (Menschenprobe, offen).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  rolle: "controller" as "viewer" | "experte" | "controller" | "admin",
  ki: "an" as "an" | "aus" | "abgeschaltet" | "fehler",
}));

const KI_STATUS = vi.hoisted(() => ({
  an: { active: true, mode: "cloud", reachable: "active", tasks: { answer: true } },
  aus: { active: false, mode: "deterministic", tasks: { answer: false } },
  abgeschaltet: {
    active: false,
    mode: "deterministic",
    tasks: { answer: false },
    kiAbgeschaltet: true,
  },
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: box.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    reasoner: {
      status: vi.fn(async () => {
        if (box.ki === "fehler") {
          throw new Error("Status nicht erreichbar");
        }
        return KI_STATUS[box.ki];
      }),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS, anzeigeNameKey, routePathAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { EINSTIEGE, EINSTIEG_THEMEN, einstiegFuer } from "../../apps/web/src/lib/einstiege";
import {
  type AntwortLage,
  FAEHIGKEITEN,
  faehigkeitTextKey,
} from "../../apps/web/src/lib/faehigkeiten";
import { Einstieg } from "../../apps/web/src/pages/Einstieg";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPRACHEN = ["de", "en", "nl"] as const;

function Ort(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-ort": "1" }, ort.pathname);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | undefined;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die echte Seite hinter ihrer echten Adresse; jedes Ziel ist eine Marke mit seinem Pfad. */
async function mount(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const ziele = [...new Set([...FAEHIGKEITEN.map((f) => f.to), "/start"])];
  await act(async () => {
    root?.render(
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
                createElement(MemoryRouter, { initialEntries: [pfad] }, [
                  createElement(Ort, { key: "o" }),
                  createElement(Routes, { key: "r" }, [
                    createElement(Route, {
                      key: "e",
                      path: "/einstieg/:thema",
                      element: createElement(Einstieg),
                    }),
                    ...ziele.map((z) =>
                      createElement(Route, {
                        key: z,
                        path: z,
                        element: createElement("p", { "data-ziel": z }, z),
                      }),
                    ),
                  ]),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Sitzung (zwei Stufen) und KI-Status brauchen eigene Durchläufe.
  await act(flush);
  await act(flush);
}

const ort = (): string => container.querySelector("[data-ort]")?.textContent ?? "";
const ansicht = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="einstieg"]');
const weiter = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="einstieg-weiter"]');

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.rolle = "controller";
  box.ki = "an";
  window.localStorage.clear();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  qc.clear();
  vi.clearAllMocks();
});

describe("R-0928 · E0 — vier Einstiege, aus der einen Registry", () => {
  it("E0a · genau vier Themen mit eigener Adresse; Ziel und Name sind die der Vollfunktion", () => {
    expect([...EINSTIEG_THEMEN]).toEqual(["erfassen", "pruefen", "fragen", "bibliothek"]);
    expect(EINSTIEGE.map((e) => e.pfad)).toEqual([
      "/einstieg/erfassen",
      "/einstieg/pruefen",
      "/einstieg/fragen",
      "/einstieg/bibliothek",
    ]);
    expect(EINSTIEGE.map((e) => e.faehigkeit.to)).toEqual([
      "/erfassen",
      "/validierung",
      "/fragen",
      "/bibliothek",
    ]);
    for (const e of EINSTIEGE) {
      const item = ALL_ITEMS.find((i) => i.path === e.faehigkeit.to);
      expect(item, `kein Navigationspunkt für ${e.faehigkeit.to}`).toBeDefined();
      expect(e.faehigkeit.nameKey).toBe(anzeigeNameKey(item as NonNullable<typeof item>));
      // Die Einstiegsansicht selbst steht hinter keinem Rollen-Tor — sie erklärt nur.
      expect(routePathAllows(e.pfad, "viewer")).toBe(true);
    }
    expect(einstiegFuer("gibt-es-nicht")).toBeNull();
    expect(einstiegFuer(undefined)).toBeNull();
  });

  it("E0b · jeder Text der Ansichten steht in DE, EN und NL", () => {
    const schluessel = [
      "erstnutzer.einstiege.titel",
      "erstnutzer.einstiege.einleitung",
      "erstnutzer.einstieg.kicker",
      "erstnutzer.einstieg.wozu",
      "erstnutzer.einstieg.anfangen",
      "erstnutzer.einstieg.weitere",
      "erstnutzer.einstieg.zurStartseite",
      ...EINSTIEGE.map((e) => e.ersterSchrittKey),
    ];
    for (const lng of SPRACHEN) {
      const t = i18n.getFixedT(lng);
      for (const k of schluessel) {
        expect(t(k), `${lng}:${k}`).not.toBe(k);
        expect(t(k).trim().length, `${lng}:${k}`).toBeGreaterThan(0);
      }
      for (const k of ["erstnutzer.einstieg.weiter", "erstnutzer.einstieg.ohneRolle"]) {
        const satz = t(k, { name: "Probe" });
        expect(satz, `${lng}:${k}`).toContain("Probe");
        expect(satz, `${lng}:${k}`).not.toContain("{{");
      }
    }
  });
});

describe("R-0928 · E1 — controller: vier Ansichten, je mit Übergabe in die Vollfunktion", () => {
  for (const e of EINSTIEGE) {
    it(`E1-${e.thema} · ${e.pfad} zeigt Name, Zweck, ersten Schritt und übergibt an ${e.faehigkeit.to}`, async () => {
      await mount(e.pfad);
      const t = i18n.getFixedT("de");
      const a = ansicht();
      expect(a, "die Einstiegsansicht fehlt").not.toBeNull();
      expect(a?.getAttribute("data-thema")).toBe(e.thema);
      expect(a?.querySelector("h1")?.textContent).toBe(t(e.faehigkeit.nameKey));
      const zweck = container.querySelector('[data-testid="einstieg-zweck"]')?.textContent ?? "";
      expect(zweck).toContain(t(faehigkeitTextKey(e.faehigkeit, "verfuegbar")));
      const schritt =
        container.querySelector('[data-testid="einstieg-erster-schritt"]')?.textContent ?? "";
      expect(schritt).toContain(t(e.ersterSchrittKey));
      // Kein Rollenhinweis, wo die Rolle das Ziel erreicht.
      expect(container.querySelector('[data-testid="einstieg-rolle"]')).toBeNull();
      // Die drei anderen Einstiege sind verlinkt, der eigene nicht.
      for (const anderer of EINSTIEGE) {
        const link = container.querySelector(`[data-testid="einstieg-zu-${anderer.thema}"]`);
        if (anderer.thema === e.thema) {
          expect(link).toBeNull();
        } else {
          expect(link?.getAttribute("href")).toBe(anderer.pfad);
        }
      }
      // Die Übergabe: ein echter Link, und der Klick landet GENAU auf der Vollfunktion.
      const knopf = weiter();
      expect(knopf?.tagName).toBe("A");
      expect(knopf?.getAttribute("href")).toBe(e.faehigkeit.to);
      expect(knopf?.textContent).toContain(t(e.faehigkeit.nameKey));
      await act(async () => {
        knopf?.click();
        await flush();
      });
      expect(ort()).toBe(e.faehigkeit.to);
      expect(container.querySelector(`[data-ziel="${e.faehigkeit.to}"]`)).not.toBeNull();
    });
  }
});

describe("R-0928 · E2 — Rollengrenzen: Auskunft statt Weg, wo die Rolle nicht hinreicht", () => {
  for (const rolle of ["viewer", "experte"] as const) {
    for (const e of EINSTIEGE) {
      it(`E2-${rolle}-${e.thema} · Übergabe nur, wenn ${rolle} ${e.faehigkeit.to} erreicht`, async () => {
        box.rolle = rolle;
        await mount(e.pfad);
        const t = i18n.getFixedT("de");
        const knopf = weiter();
        expect(knopf, "die Übergabe fehlt").not.toBeNull();
        // Zweck und erster Schritt stehen für JEDE Rolle da — die Ansicht verschweigt nichts.
        expect(ansicht()?.textContent).toContain(t(e.ersterSchrittKey));
        if (routePathAllows(e.faehigkeit.to, rolle)) {
          expect(knopf?.tagName).toBe("A");
          expect(knopf?.getAttribute("href")).toBe(e.faehigkeit.to);
          expect(container.querySelector('[data-testid="einstieg-rolle"]')).toBeNull();
        } else {
          expect(knopf?.tagName).not.toBe("A");
          expect(knopf?.hasAttribute("href")).toBe(false);
          expect(knopf?.getAttribute("data-role-no-reach")).toBe("true");
          expect(knopf?.textContent).toContain(t("roleLink.noReach"));
          const hinweis = container.querySelector('[data-testid="einstieg-rolle"]');
          expect(hinweis?.textContent).toBe(
            t("erstnutzer.einstieg.ohneRolle", { name: t(e.faehigkeit.nameKey) }),
          );
        }
      });
    }
  }

  it("E2-Kalibrierung · viewer erreicht Erfassen und Prüfen nicht, Fragen und Bibliothek schon", () => {
    // Ohne gesperrte UND offene Fälle bewiese E2 nichts über die Rollenfrage.
    expect(routePathAllows("/erfassen", "viewer")).toBe(false);
    expect(routePathAllows("/validierung", "viewer")).toBe(false);
    expect(routePathAllows("/fragen", "viewer")).toBe(true);
    expect(routePathAllows("/bibliothek", "viewer")).toBe(true);
  });
});

describe("R-0928 · E3 — „Fragen“ sagt die Antwort nur zu, wenn sie möglich ist", () => {
  const LAGEN: readonly { ki: typeof box.ki; lage: AntwortLage }[] = [
    { ki: "an", lage: "verfuegbar" },
    { ki: "aus", lage: "ohneModell" },
    { ki: "fehler", lage: "unbekannt" },
    { ki: "abgeschaltet", lage: "abgeschaltet" },
  ];
  const fragen = einstiegFuer("fragen");

  for (const { ki, lage } of LAGEN) {
    for (const lng of SPRACHEN) {
      it(`E3-${ki}-${lng} · Zweck in der Lage „${lage}“`, async () => {
        if (!fragen) {
          throw new Error("Einstieg „fragen“ fehlt");
        }
        box.ki = ki;
        await i18n.changeLanguage(lng);
        await mount(fragen.pfad);
        const t = i18n.getFixedT(lng);
        expect(ansicht()?.getAttribute("data-antwort-lage")).toBe(lage);
        const zweck = container.querySelector('[data-testid="einstieg-zweck"]')?.textContent ?? "";
        const zusage = t("erstnutzer.faehigkeiten.fragen");
        expect(zweck).toContain(t(faehigkeitTextKey(fragen.faehigkeit, lage)));
        if (lage === "verfuegbar") {
          expect(zweck, "Gegenprobe: die volle Zusage fehlt").toContain(zusage);
        } else {
          expect(zweck, "uneingeschränkte Antwortzusage").not.toContain(zusage);
        }
        // Die Übergabe nach /fragen bleibt in jeder Lage ein Weg (die Seite sagt dort selbst Bescheid).
        expect(weiter()?.getAttribute("href")).toBe("/fragen");
      });
    }
  }
});

describe("R-0928 · E4 — ein unbekanntes Thema", () => {
  it("E4 · /einstieg/gibt-es-nicht führt auf die Startseite", async () => {
    await mount("/einstieg/gibt-es-nicht");
    expect(ansicht()).toBeNull();
    expect(ort()).toBe("/start");
  });
});
