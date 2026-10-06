// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · R-1576 — DAS H1-GESAMTINVENTAR: ROLLE × SPRACHE × ZÄHLERZUSTAND.
// ================================================================================================
//
// Bens Befund (Runde 1): `tests/design/h1-funktionsinventar.test.ts` trägt 44 Zeilen, startet auf
// Deutsch als Admin und prüft die Rollen nur über die Vorschau. Das ist kein vollständiges Inventar
// über Rolle, Sprache und Zustand. Diese Datei ist es für die HÜLLE (H1): die drei Orte, an denen
// Bereiche und ihre Zahlen stehen — Kopfband-Punkte, Drawer-Liste, „Weitere Bereiche" — gemountet
// mit den echten Bauteilen (`shell/KopfbandPunkte.tsx`) und den echten Lese-Hooks; nur der Draht
// (`api/endpoints`) und die Anmeldung (`api/auth`) sind gemockt.
//
// DAS RASTER: 4 Rollen (viewer, experte, controller, admin — echte Sitzungsrolle, keine Vorschau)
// × Stufe 2 (aus, an) × 3 Sprachen (de, en, nl) × 7 Zählerzustände = 168 Fälle. Je Fall gilt:
//   R  Welche Punkte an welchem Ort stehen, ist je Rolle und Stufe AUSGESCHRIEBEN (`ERWARTET`) —
//      eine Verschiebung wird hier rot, nicht still übernommen. Kein angebotener Punkt führt an ein
//      Rollentor, das die Rolle zurückweist (`routePathAllows`, dieselbe Quelle wie der Router).
//   S  Jede Beschriftung steht in der Sprache des Falls (Wert des Schlüssels in DIESER Sprache,
//      kein roher Schlüssel) — an allen drei Orten.
//   Z  Eine Zahl steht NUR im Zustand „geladen" und dann mit dem richtigen Wert je Zählquelle; in
//      allen anderen Zuständen (lädt, echte 0, Fehler, gestörte Auffrischung, abgelaufen, offline)
//      steht an keinem Ort eine Zahl und kein Ersatzzeichen.
//
// WAS DIESE DATEI NICHT BELEGT (benannt, nicht verschwiegen): die Funktionen HINTER den Menüzielen
// in jeder Kombination; Breitenwechsel/Mobilkombinationen (das gebaute Bündel in Chromium misst
// `tests/kopfzaehler-frische/frische-im-echten-browser-chromium.test.ts` für DE/EN, Desktop und
// 390 px); die Admin-Rollenvorschau (bleibt bei `h1-funktionsinventar.test.ts`, Z-rollenvorschau).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({
  rolle: "admin" as string,
  modus: "geladen" as "laedt" | "geladen" | "leer" | "fehler",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: lage.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const quelle =
    <T,>(voll: T, leer: T) =>
    () => {
      if (lage.modus === "laedt") {
        return new Promise<T>(() => {});
      }
      if (lage.modus === "fehler") {
        return Promise.reject(new Error("Server nicht erreichbar"));
      }
      return Promise.resolve(lage.modus === "leer" ? leer : voll);
    };
  return {
    endpoints: {
      validation: { board: vi.fn(quelle([{ id: "a" }, { id: "b" }], [])) },
      conflicts: { list: vi.fn(quelle([{ id: "c-1", status: "offen" }], [])) },
      duplicates: { list: vi.fn(quelle([{ id: "d-1" }], [])) },
      gaps: {
        summary: vi.fn(
          quelle(
            { open: 1, byPriority: { hoch: 1, mittel: 0, niedrig: 0 } },
            { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } },
          ),
        ),
      },
      lifecycle: { pending: vi.fn(quelle(["ko-x"], [])) },
      notifications: { list: vi.fn(async () => []), markSeen: vi.fn(async () => ({})) },
      features: { get: vi.fn(async () => ({ features: {} })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import {
  FOOT_ITEMS,
  anzeigeNameKey,
  kopfbandItems,
  routePathAllows,
  weitereBereicheItems,
} from "../../apps/web/src/app/navigation";
import type { Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";
import {
  KopfbandPunkte,
  KopfbandPunkteListe,
  WeitereBereicheZeilen,
} from "../../apps/web/src/shell/KopfbandPunkte";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROLLEN = ["viewer", "experte", "controller", "admin"] as const;
const SPRACHEN = ["de", "en", "nl"] as const;
const ZUSTAENDE = [
  "laedt",
  "geladen",
  "echte-null",
  "fehler",
  "gestoerte-auffrischung",
  "abgelaufen",
  "offline",
] as const;
type Zustand = (typeof ZUSTAENDE)[number];

/** Die Zahl je Zählquelle im Zustand „geladen" (`app/useNavBadges.ts`): Board 2, 1 offener
 *  Konflikt, 1 Dublette, 1 offene Lücke, 1 fällige Re-Validierung. */
const ZAHL: Record<string, string> = {
  validierung: "2",
  aufgaben: "5",
  konflikte: "1",
  duplikate: "1",
};

/**
 * DAS AUSGESCHRIEBENE INVENTAR je Rolle und Stufe 2 (Stand dieser Fassung). Eine Änderung an
 * `app/navigation.ts`, die einen Punkt verschiebt, entzieht oder hinzufügt, wird HIER sichtbar.
 * Gemessen: Stufe 2 wirkt nur beim Admin (`RoleContext.tsx`, `effectiveStufe2`).
 */
const BASIS_KOPFBAND = ["start", "fragen", "bibliothek"];
const ARBEIT_KOPFBAND = [...BASIS_KOPFBAND, "erfassen", "entwuerfe"];
const PRUEF_KOPFBAND = [...ARBEIT_KOPFBAND, "validierung"];
const LESEN = ["wissensnetz", "extern", "hilfe", "profil"];
const ARBEIT = ["aufgaben", "gesamtanweisungen", "wissensnetz", "extern", "hilfe", "profil"];
const PRUEFEN = [
  "aufgaben",
  "gesamtanweisungen",
  "wissensnetz",
  "extern",
  "konflikte",
  "duplikate",
  "risiko",
  "lebenszyklus",
];
const ERWARTET: Record<string, { kopfband: string[]; bereiche: string[] }> = {
  "viewer|aus": { kopfband: BASIS_KOPFBAND, bereiche: LESEN },
  "viewer|an": { kopfband: BASIS_KOPFBAND, bereiche: LESEN },
  "experte|aus": { kopfband: ARBEIT_KOPFBAND, bereiche: ARBEIT },
  "experte|an": { kopfband: ARBEIT_KOPFBAND, bereiche: ARBEIT },
  "controller|aus": { kopfband: PRUEF_KOPFBAND, bereiche: [...PRUEFEN, "hilfe", "profil"] },
  "controller|an": { kopfband: PRUEF_KOPFBAND, bereiche: [...PRUEFEN, "hilfe", "profil"] },
  "admin|aus": {
    kopfband: PRUEF_KOPFBAND,
    bereiche: [...PRUEFEN, "analytics", "hilfe", "profil"],
  },
  "admin|an": {
    kopfband: PRUEF_KOPFBAND,
    bereiche: [...PRUEFEN, "analytics", "output", "import", "graph", "kapital", "hilfe", "profil"],
  },
};

const STUFE2_KEY = "kw.stufe2.v1";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: ZAEHLER_FRISCHE_MS } },
  });
  await act(async () => {
    neu.render(
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
                  { initialEntries: ["/start"] },
                  createElement("header", null, createElement(KopfbandPunkte)),
                  createElement(
                    "section",
                    { "data-ort": "drawer" },
                    createElement(KopfbandPunkteListe),
                  ),
                  createElement(
                    "section",
                    { "data-ort": "weitere-bereiche" },
                    createElement(WeitereBereicheZeilen),
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
  await act(flush);
}

async function zustandHerstellen(zustand: Zustand): Promise<void> {
  lage.modus =
    zustand === "laedt"
      ? "laedt"
      : zustand === "fehler"
        ? "fehler"
        : zustand === "echte-null"
          ? "leer"
          : "geladen";
  await mount();
  if (zustand === "gestoerte-auffrischung") {
    lage.modus = "fehler";
    await act(async () => {
      await qc.refetchQueries().catch(() => undefined);
      await flush();
    });
  }
  if (zustand === "abgelaufen") {
    await act(async () => {
      vi.advanceTimersByTime(ZAEHLER_FRISCHE_MS + 5_000);
      await flush();
    });
  }
  if (zustand === "offline") {
    await act(async () => {
      onlineManager.setOnline(false);
      await flush();
    });
  }
}

interface Ort {
  readonly name: string;
  readonly auswahl: string;
  readonly kennung: (el: Element) => string;
  readonly zahl: (el: Element) => string | null;
}

const ORTE: readonly Ort[] = [
  {
    name: "kopfband",
    auswahl: "header a[data-kopfband-punkt]",
    kennung: (el) => el.getAttribute("data-kopfband-punkt") ?? "",
    zahl: (el) => el.querySelector(".kw-kopfband-zaehler")?.textContent ?? null,
  },
  {
    name: "drawer",
    auswahl: '[data-ort="drawer"] [data-testid^="drawer-punkt-"]',
    kennung: (el) => (el.getAttribute("data-testid") ?? "").replace("drawer-punkt-", ""),
    zahl: (el) => el.querySelector(".kw-menue-wert")?.textContent ?? null,
  },
  {
    name: "weitere-bereiche",
    auswahl: '[data-ort="weitere-bereiche"] [data-testid^="bereich-"]',
    kennung: (el) => (el.getAttribute("data-testid") ?? "").replace("bereich-", ""),
    zahl: (el) => el.querySelector(".kw-menue-wert")?.textContent ?? null,
  },
];

const PFAD = new Map(
  [...kopfbandItems(), ...weitereBereicheItems(), ...FOOT_ITEMS].map((i) => [i.id, i]),
);

beforeEach(async () => {
  vi.useFakeTimers();
  onlineManager.setOnline(true);
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  qc?.clear();
  onlineManager.setOnline(true);
  window.localStorage.removeItem(STUFE2_KEY);
  vi.useRealTimers();
  await i18n.changeLanguage("de");
});

/** Die gemessenen Inventarzeilen — als Beleg am Ende des Laufs ausgegeben. */
const ergebnis = new Set<string>();

describe("R-1576 · H1-Gesamtinventar: jede Rolle × Stufe 2 × Sprache × Zählerzustand", () => {
  for (const rolle of ROLLEN) {
    for (const stufe2 of [false, true]) {
      for (const sprache of SPRACHEN) {
        for (const zustand of ZUSTAENDE) {
          it(`${rolle} · Stufe 2 ${stufe2 ? "an" : "aus"} · ${sprache} · ${zustand}`, async () => {
            lage.rolle = rolle;
            if (stufe2) {
              window.localStorage.setItem(STUFE2_KEY, "1");
            }
            await i18n.changeLanguage(sprache);
            await zustandHerstellen(zustand);
            const t = i18n.getFixedT(sprache);
            const fund: Record<string, string[]> = {};
            for (const ort of ORTE) {
              const elemente = [...container.querySelectorAll(ort.auswahl)];
              const kennungen = elemente.map(ort.kennung);
              fund[ort.name] = kennungen;
              for (const el of elemente) {
                const id = ort.kennung(el);
                const item = PFAD.get(id);
                expect(item, `${ort.name}: unbekannter Punkt ${id}`).toBeDefined();
                if (!item) {
                  continue;
                }
                // R: kein angebotener Weg endet am Rollentor.
                expect(routePathAllows(item.path, rolle as Role), `${ort.name}: ${id}`).toBe(true);
                // S: die Beschriftung steht in der Sprache des Falls.
                const soll = t(anzeigeNameKey(item));
                expect(soll, `${sprache}: Schlüssel ${anzeigeNameKey(item)} fehlt`).not.toBe(
                  anzeigeNameKey(item),
                );
                expect(el.textContent ?? "", `${ort.name}: ${id}`).toContain(soll);
                // Z: eine Zahl nur im Zustand „geladen", dann mit dem Wert ihrer Quelle.
                const zahl = ort.zahl(el);
                if (zustand === "geladen" && ZAHL[id] !== undefined) {
                  expect(zahl, `${ort.name}: ${id}`).toBe(ZAHL[id]);
                } else {
                  expect(zahl, `${ort.name}: ${id} im Zustand ${zustand}`).toBeNull();
                }
              }
            }
            // Z: kein Ersatzzeichen irgendwo, wenn keine Zahl stehen darf.
            if (zustand !== "geladen") {
              expect(
                container.querySelectorAll(".kw-kopfband-zaehler, .kw-menue-wert").length,
              ).toBe(0);
            }
            // R: das Inventar dieser Rolle und Stufe ist in jeder Sprache und jedem Zustand gleich.
            const schluessel = `${rolle}|${stufe2 ? "an" : "aus"}`;
            const inventar = {
              kopfband: fund.kopfband ?? [],
              bereiche: fund["weitere-bereiche"] ?? [],
            };
            expect(fund.drawer, "Drawer und Kopfband tragen dieselben Punkte").toEqual(
              inventar.kopfband,
            );
            expect(inventar, schluessel).toEqual(ERWARTET[schluessel]);
            ergebnis.add(
              `${schluessel} · Kopfband/Drawer: ${inventar.kopfband.join(" ")} · Weitere Bereiche: ${inventar.bereiche.join(" ")}`,
            );
          });
        }
      }
    }
  }

  it("Beleg: das gemessene Inventar je Rolle und Stufe (Ausgabe)", () => {
    console.info(`R-1576 · H1-Gesamtinventar\n${[...ergebnis].join("\n")}`);
    expect(Object.keys(ERWARTET)).toHaveLength(ROLLEN.length * 2);
  });
});
