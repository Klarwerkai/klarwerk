// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-KONFLIKTBOARD — OFFENE KONFLIKTE, GEGENÜBERSTELLUNG, EHRLICHER ZÄHLER.
// ================================================================================================
//
// Die Originalpunkte (R-0950, R-1711, R-1712, R-2106, SOLL:FR-CON-04) verlangen:
//   · eine eigene Seite, die ALLE ungelösten Konflikte listet — jeder Konfliktstatus außer „gelöst",
//     unabhängig vom Status der beteiligten Objekte —, je Fall mit Link zur Klärung;
//   · die widersprechenden Positionen samt Quellen nebeneinander;
//   · in der Navigation einen ROTEN Zähler mit der offenen Zahl — und der Zähler stimmt.
//
// WAS HIER GEMESSEN WIRD: die echte Hülle (`Kopfband`) und die echte Seite (`Conflicts`) zusammen,
// unter EINEM QueryClient, mit der Endpointgrenze als einziger Attrappe. Zähler, „k von n", Reiter
// und Fallliste lesen damit denselben Abruf — „Zähler stimmt" ist ein Vergleich am Bildschirm, keine
// Behauptung über eine Rechenregel. Die Rechenregel selbst pinnen die Nachbarn
// (`apps/web/src/app/useNavBadges.badges.test.ts`, `tests/app/nav-badges-sidebar-mounted.test.tsx`);
// den Server-Filter `unresolved()` pinnt `tests/conflicts/conflict-board.test.ts`.
//
// GEMOUNTET UND OHNE PLAYWRIGHT — dieselbe Begründung wie im Nachbarn
// `tests/conflict-description/beschreibung-sichtbar.test.tsx`: ein Playwright-Import zöge die Datei
// in die serielle Browsergruppe, ohne hier etwas zu belegen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({ konflikte: [] as unknown[] }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: () => T) => vi.fn(async () => v());
  // Alles, was diese Fälle NICHT messen, antwortet leer — aber es antwortet (Bauform aus
  // `tests/seitenhilfe-navkapitel/weitere-kapitel-am-seitenverhalten.test.tsx`). Hülle und Seite
  // stehen zusammen im Baum; eine unbekannte Ecke soll den Fall nicht abstürzen lassen.
  const leer = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(ziel, name, empfaenger) {
          if (name in ziel || typeof name === "symbol") {
            return Reflect.get(ziel, name, empfaenger);
          }
          return leer();
        },
      },
    );
  const mit = (echt: Record<string, unknown>): unknown =>
    new Proxy(echt, {
      get(ziel, name, empfaenger) {
        if (name in ziel || typeof name === "symbol") {
          return Reflect.get(ziel, name, empfaenger);
        }
        return leer();
      },
    });
  return {
    endpoints: mit({
      // Der Server liefert über `GET /api/conflicts` ausschließlich `unresolved()` — also keinen
      // gelösten Konflikt. Die Attrappe liefert dasselbe; was sie liefert, setzen die Fälle unten.
      conflicts: { list: ok(() => daten.konflikte) },
      duplicates: { list: ok(() => []), settings: ok(() => ({ minConfidence: 0.5 })) },
      validation: { board: ok(() => []), overview: ok(() => []) },
      lifecycle: { pending: ok(() => []) },
      ko: { list: ok(() => KOS) },
      gaps: {
        list: ok(() => []),
        summary: ok(() => ({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } })),
      },
      directory: { list: ok(() => []) },
      analytics: { busfactor: ok(() => []), expertise: ok(() => []) },
      aiCheck: {
        coverageSummary: ok(() => ({ total: 4, incomplete: 0, unchecked: 0, noCoverage: 0 })),
      },
      // Die Hülle: dieselben Quellen wie im Nachbarn `nav-badges-sidebar-mounted.test.tsx`.
      notifications: { list: ok(() => []), markSeen: ok(() => ({})) },
      features: { get: ok(() => ({ features: {} })) },
      reasoner: {
        status: ok(() => ({ active: false, mode: "none", reachable: "unknown", tasks: {} })),
        config: ok(() => null),
      },
      external: { policy: ok(() => ({ stage: "blocked" })) },
    }),
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
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// Volle Objektform (siehe Nachbar): `conflictKoPair`/`metaVon`/`SourceEvidence` lesen die Felder
// ohne Absicherung. Die Objekte tragen BEIDE Objektstatus — „offen" und „validiert".
const ko = (id: string, titel: string, status: "offen" | "validiert", quelle: string | null) => ({
  id,
  title: titel,
  statement: `Aussage ${id}`,
  status,
  category: "Technik",
  trust: 80,
  conditions: [],
  measures: [],
  sources: quelle
    ? [
        {
          id: `q-${id}`,
          label: quelle,
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
        },
      ]
    : [],
  tags: [],
  createdAt: "2026-08-01T06:00:00.000Z",
  updatedAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [
  ko("ko-a", "Frist Lieferant", "validiert", "Rahmenvertrag 2024"),
  ko("ko-b", "Frist Einkauf", "offen", "Einkaufsrichtlinie"),
  ko("ko-c", "Prüfintervall Anlage", "offen", null),
  ko("ko-d", "Prüfintervall Wartung", "offen", null),
];

const konflikt = (id: string, koA: string, koB: string, status: string, createdAt: string) => ({
  id,
  koA,
  koB,
  type: "truth",
  description: "",
  status,
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt,
});

// Drei ungelöste Konflikte in DREI verschiedenen Konfliktstatus; die Objekte darunter sind teils
// „offen", teils „validiert". Neueste zuerst — so ordnet die Fläche (`groupFindingsByBeitrag`).
const OFFEN = [
  konflikt("c-1", "ko-a", "ko-b", "offen", "2026-08-03T06:00:00.000Z"),
  konflikt("c-2", "ko-c", "ko-d", "eskaliert", "2026-08-02T06:00:00.000Z"),
  konflikt("c-3", "ko-b", "ko-c", "zweitmeinung", "2026-08-01T06:00:00.000Z"),
];

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
                  { initialEntries: ["/konflikte"] },
                  createElement(Kopfband),
                  createElement(Conflicts),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
  await act(flush);
}

async function klick(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

const q = (sel: string): HTMLElement | null => container.querySelector<HTMLElement>(sel);

const fallListe = async (): Promise<HTMLAnchorElement[]> => {
  if (!q('[data-testid="pruefen-menue-panel-faelle"]')) {
    await klick(q('[data-testid="pruefen-menue-faelle"]'));
  }
  return [
    ...container.querySelectorAll<HTMLAnchorElement>(
      '[data-testid="pruefen-menue-panel-faelle"] a',
    ),
  ];
};

const lauf = (): string => q('[data-testid="pruefen-pille-lauf"]')?.textContent ?? "";
const zeilenTitel = (): string =>
  q('[data-testid="pruefen-flaeche"] [data-text="titel"]')?.textContent ?? "";

/** Der Zähler der Navigationszeile „Konflikte" (Kopfband → „Arbeitsbereiche"). */
async function navZaehler(zeile: string): Promise<HTMLElement | null> {
  if (!q(`[data-testid="bereich-${zeile}"]`)) {
    await klick(q('[data-testid="kopfband-arbeitsbereiche"]'));
  }
  return q(`[data-testid="bereich-${zeile}"] .kw-menue-wert > span`);
}

beforeEach(async () => {
  daten.konflikte = OFFEN;
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("K1/K2/K4/K5 · die Konfliktseite listet ALLE ungelösten Konflikte mit Link zur Klärung", () => {
  it("jeder Konfliktstatus außer „gelöst“ steht in der Liste — unabhängig vom Objektstatus", async () => {
    await mount();
    expect(q('[data-testid="page-konflikte"]'), "eigene Seite /konflikte").not.toBeNull();
    const links = await fallListe();
    expect(links).toHaveLength(3);
    const text = links.map((a) => a.textContent ?? "");
    // Status je Fall: Offen, Eskaliert, Zweitmeinung — und die Objekte dahinter sind teils „offen",
    // teils „validiert"; keiner fällt deshalb heraus.
    expect(text[0]).toContain("Frist Lieferant");
    expect(text[0]).toContain(i18n.t("con.status.offen"));
    expect(text[1]).toContain("Prüfintervall Anlage");
    expect(text[1]).toContain(i18n.t("con.status.eskaliert"));
    expect(text[2]).toContain("Frist Einkauf");
    expect(text[2]).toContain(i18n.t("con.status.zweitmeinung"));
  });

  it("jede Zeile ist ein echter Link zur Klärung genau dieses Falls", async () => {
    await mount();
    const links = await fallListe();
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/konflikte?fall=c-1",
      "/konflikte?fall=c-2",
      "/konflikte?fall=c-3",
    ]);
  });

  it("der Link wählt den Fall auf derselben Seite vor und schließt die Liste", async () => {
    await mount();
    expect(lauf()).toBe("1 von 3");
    const links = await fallListe();
    await klick(links[2]);
    expect(lauf()).toBe("3 von 3");
    expect(zeilenTitel()).toBe("Frist Einkauf");
    expect(q('[data-testid="pruefen-menue-panel-faelle"]')).toBeNull();
    // Derselbe Link ein zweites Mal, nachdem von Hand geblättert wurde: er wählt wieder vor.
    await klick(q('[data-testid="pruefen-zurueck"]'));
    expect(lauf()).toBe("2 von 3");
    await klick((await fallListe())[2]);
    expect(lauf()).toBe("3 von 3");
  });

  it("Kalibrierung: ohne offene Konflikte gibt es keine Liste, sondern den Leerzustand", async () => {
    daten.konflikte = [];
    await mount();
    expect(q('[data-testid="pruefen-menue-faelle"]')).toBeNull();
    expect(q('[data-testid="pruefen-satz-leer"]')?.textContent ?? "").toContain(
      i18n.t("con.empty"),
    );
  });
});

describe("K1/K3 · die widersprechenden Positionen stehen samt Quellen nebeneinander", () => {
  it("zwei Karten mit beiden Aussagen; je Karte die eigene Quelle", async () => {
    await mount();
    const a = q('[data-testid="pruefen-paar-karte-a"]');
    const b = q('[data-testid="pruefen-paar-karte-b"]');
    expect(a?.parentElement).toBe(b?.parentElement);
    expect(q('[data-testid="pruefen-paar-text-a"]')?.textContent).toBe("Aussage ko-a");
    expect(q('[data-testid="pruefen-paar-text-b"]')?.textContent).toBe("Aussage ko-b");
    expect(a?.textContent).toContain("Rahmenvertrag 2024");
    expect(a?.textContent).not.toContain("Einkaufsrichtlinie");
    expect(b?.textContent).toContain("Einkaufsrichtlinie");
    expect(b?.textContent).not.toContain("Rahmenvertrag 2024");
  });
});

describe("K1/K5 · der rote Zähler in der Navigation zeigt die offene Zahl — und sie stimmt", () => {
  it("Navigation, Reiter, „k von n“ und Fallliste nennen dieselbe Zahl", async () => {
    await mount();
    const zaehler = await navZaehler("konflikte");
    expect(zaehler?.textContent).toBe("3");
    expect(zaehler?.getAttribute("aria-label")).toBe(i18n.t("nav.badge.conflicts", { count: 3 }));
    expect(lauf()).toBe("1 von 3");
    expect(q('[data-testid="pruefen-reiter-konflikte"]')?.textContent).toContain("3");
    expect(await fallListe()).toHaveLength(3);
  });

  it("der Zähler ist rot (Ton „crit“) — die neutrale Nachbarzeile ist es nicht", async () => {
    await mount();
    const zaehler = await navZaehler("konflikte");
    expect(zaehler?.className).toContain("bg-trust-crit-bg");
    expect(zaehler?.className).toContain("text-trust-crit-text");
    // Kalibrierung: die Klassenprüfung unterscheidet überhaupt — „Meine Aufgaben" zählt dieselben
    // drei Konflikte mit und trägt den neutralen Ton.
    const neutral = await navZaehler("aufgaben");
    expect(neutral?.textContent).toBe("3");
    expect(neutral?.className).not.toContain("trust-crit");
  });

  it("ein weiterer ungelöster Konflikt hebt Zähler und Liste gemeinsam", async () => {
    daten.konflikte = [
      ...OFFEN,
      konflikt("c-4", "ko-a", "ko-d", "offen", "2026-07-30T06:00:00.000Z"),
    ];
    await mount();
    expect((await navZaehler("konflikte"))?.textContent).toBe("4");
    expect(lauf()).toBe("1 von 4");
    expect(await fallListe()).toHaveLength(4);
  });
});
