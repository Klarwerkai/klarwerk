// @vitest-environment jsdom
// ================================================================================================
// R-0893 / R-1669 · SCHNELLWAHL — PER TASTENKOMBINATION DIREKT ZU EINEM WISSENSOBJEKT.
// ================================================================================================
//
// Auftrag aufnahme:20260922:gesamt-schnellwahl. Der Bestand (⌘K/Strg+K, rollengefilterte Seiten
// und Bereiche, Pfeile/Enter/Escape) ist in `tests/navigationsnamen/` und `tests/admin-navigation/`
// gemessen und wird hier NICHT wiederholt. Gemessen wird nur die Lücke, die dieser Auftrag schliesst:
//   S1  ab zwei Zeichen stehen Wissenseinträge der Bibliothekssuche unter „Wissen", jeder mit dem
//       Weg `/wissen/:id`, dazu die Schnellaktion „Alle Treffer … in der Bibliothek"
//   S2  nur Tastatur: ⌘K, tippen, Enter — und man steht auf dem Wissensobjekt
//   S2b dasselbe, wenn vor der Antwort Pfeiltasten gedrückt wurden (BEN, Nacharbeit 2)
//   S3  höchstens fünf Einträge; der Rest bleibt über die Schnellaktion erreichbar
//   S4  ein Zeichen fragt den Server nicht
//   S5  Seiten bleiben vorn: Enter auf einen Seitennamen öffnet weiter die Seite
//   S6  eine Antwort auf einen ÄLTEREN Begriff steht nicht da und ist per Enter nicht erreichbar
//   S7  die Palette zeigt nur, was der Server für DIESE Sitzung zurückgibt — sie erfindet nichts
//       hinzu (die Beschneidung selbst misst `tests/security/mega74-lesepfad-vertraulich.test.ts`)
//
// Echte Palette, echte Übersetzungen, echte Anbieter. Attrappen sind allein die Sitzung und die
// Endpunktgrenze; die Suchattrappe schneidet am Begriff wie `GET /api/library/search`.
import { afterEach, describe, expect, it, vi } from "vitest";

const netz = vi.hoisted(() => {
  const ko = (id: string, title: string, category = "Anlage 1") => ({
    id,
    title,
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category,
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
  });
  return {
    ko,
    rolle: "viewer",
    bestand: [] as ReturnType<typeof ko>[],
    gefragt: [] as string[],
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Lea", email: "l@x.de", role: netz.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    reasoner: {
      status: vi.fn(async () => ({ active: true, mode: "cloud", reachable: "active" })),
      config: vi.fn(async () => null),
    },
    notifications: { list: vi.fn(async () => []) },
    library: new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === "search"
            ? async (params: { q?: string }) => {
                const q = (params.q ?? "").toLowerCase();
                netz.gefragt.push(params.q ?? "");
                return netz.bestand.filter((k) => k.title.toLowerCase().includes(q));
              }
            : arrFn(),
      },
    ),
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import { act, createElement } from "../../apps/web/node_modules/react";
import { useLocation } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";
import {
  CommandPalette,
  WISSEN_AB_ZEICHEN,
  WISSEN_HOECHSTENS,
} from "../../apps/web/src/shell/CommandPalette";
import {
  type Stand,
  abbauen,
  beruhige,
  montiere,
  paletteOeffnen,
  paletteTippen,
  palettenFlaeche,
  palettenTreffer,
} from "../navigationsnamen/vorrichtung";

Element.prototype.scrollIntoView = () => {};

function Ort(): JSX.Element {
  const ort = useLocation();
  return createElement("output", { "data-ort": "" }, `${ort.pathname}${ort.search}`);
}

function ort(stand: Stand): string {
  return stand.container.querySelector("[data-ort]")?.textContent ?? "";
}

let stand: Stand | null = null;

afterEach(() => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  netz.rolle = "viewer";
  netz.bestand = [];
  netz.gefragt = [];
});

async function offenMit(bestand: ReturnType<typeof netz.ko>[]): Promise<Stand> {
  netz.bestand = bestand;
  const s = montiere([
    createElement(CommandPalette, { key: "p" }),
    createElement(Ort, { key: "o" }),
  ]);
  stand = s;
  await beruhige();
  await paletteOeffnen();
  return s;
}

/** Die Tipp-Pause der Bibliothekssuche abwarten — dieselbe Zahl, die die Palette benutzt. */
async function entprellungAbwarten(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, LIBRARY_SEARCH_DEBOUNCE_MS + 60));
  });
  await beruhige(10);
}

async function enter(s: Stand): Promise<void> {
  const feld = palettenFlaeche(s).querySelector("input");
  await act(async () => {
    feld?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await beruhige(5);
}

const wissenszeilen = (s: Stand) => palettenTreffer(s).filter((z) => z.pfad.startsWith("/wissen/"));

describe("R-0893 · S1–S3 — Wissenseinträge in der Schnellwahl", () => {
  it("S1: „Ventil“ zeigt den Eintrag unter „Wissen“ mit Weg /wissen/:id und die Schnellaktion", async () => {
    const s = await offenMit([netz.ko("alpha", "Ventil Alpha"), netz.ko("beta", "Pumpe Beta")]);
    // Nicht-vakuös: die Sitzung ist beim Viewer angekommen (Bibliothek ja, Erfassen nein).
    const seiten = palettenTreffer(s).map((z) => z.pfad);
    expect(seiten).toContain("/bibliothek");
    expect(seiten).not.toContain("/erfassen");

    await paletteTippen(s, "Ventil");
    await entprellungAbwarten();

    expect(netz.gefragt).toContain("Ventil");
    const gruppe = palettenFlaeche(s).querySelector('[data-cmd-gruppe="wissen"]');
    expect(gruppe?.textContent).toBe(i18n.t("schnellwahl.wissenGruppe"));
    expect(wissenszeilen(s)).toEqual([{ pfad: "/wissen/alpha", text: "Ventil Alpha" }]);
    const aktion = palettenTreffer(s).find((z) => z.pfad === "/bibliothek?q=Ventil");
    expect(aktion?.text).toBe(i18n.t("schnellwahl.alleTreffer", { q: "Ventil" }));
    // Der Zielkontext sagt in Worten, wo der Eintrag wohnt — keine Route im sichtbaren Text.
    const zeile = palettenFlaeche(s).querySelector('[data-cmd-pfad="/wissen/alpha"]');
    expect(zeile?.querySelector("[data-cmd-kontext]")?.textContent).toBe(
      `${i18n.t("schnellwahl.wissenGruppe")} › Anlage 1`,
    );
    expect(zeile?.textContent).not.toContain("/wissen");
    // Die Trefferzahl zählt, was dasteht — Seiten plus Wissen plus Schnellaktion.
    expect(palettenFlaeche(s).querySelector('[data-cmd="trefferzahl"]')?.textContent).toBe(
      i18n.t("cmd.treffer", { count: palettenTreffer(s).length }),
    );
  });

  it("S2: nur Tastatur — ⌘K, tippen, Enter öffnet das Wissensobjekt", async () => {
    const s = await offenMit([netz.ko("alpha", "Ventil Alpha")]);
    await paletteTippen(s, "Ventil");
    await entprellungAbwarten();
    // Kein Seitenname passt, also ist der Wissenseintrag die erste Zeile.
    expect(
      palettenFlaeche(s).querySelector('[data-cmd-stelle="0"]')?.getAttribute("data-cmd-pfad"),
    ).toBe("/wissen/alpha");
    await enter(s);
    expect(ort(s)).toBe("/wissen/alpha");
  });

  it("S2b: Pfeiltasten VOR der Antwort verlieren die Auswahl nicht — Enter öffnet das Wissensobjekt", async () => {
    // BEN, Nacharbeit 2: bei leerer Liste setzte eine Pfeiltaste die Auswahl auf -1, und Enter
    // öffnete danach `/fragen?q=…` statt des sichtbaren Eintrags.
    const s = await offenMit([netz.ko("alpha", "Ventil Alpha")]);
    await paletteTippen(s, "Ventil");
    const feld = palettenFlaeche(s).querySelector("input");
    for (const key of ["ArrowDown", "ArrowUp", "ArrowDown"]) {
      await act(async () => {
        feld?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      });
    }
    // Nicht-vakuös: die Tasten trafen wirklich die LEERE Liste, vor jeder Serverfrage.
    expect(netz.gefragt).toEqual([]);
    expect(palettenFlaeche(s).querySelectorAll("[data-cmd-ziel]")).toHaveLength(0);

    await entprellungAbwarten();
    const markiert = palettenFlaeche(s).querySelector('[data-cmd-aktiv="true"]');
    expect(markiert?.getAttribute("data-cmd-pfad")).toBe("/wissen/alpha");
    await enter(s);
    expect(ort(s)).toBe("/wissen/alpha");
  });

  it("S3: höchstens fünf Einträge — die Schnellaktion führt zu allen", async () => {
    const viele = Array.from({ length: WISSEN_HOECHSTENS + 3 }, (_, i) =>
      netz.ko(`ko-${i}`, `Ventil ${i}`),
    );
    const s = await offenMit(viele);
    await paletteTippen(s, "Ventil");
    await entprellungAbwarten();
    expect(wissenszeilen(s)).toHaveLength(WISSEN_HOECHSTENS);
    const aktion = palettenFlaeche(s).querySelector<HTMLButtonElement>(
      '[data-cmd-pfad="/bibliothek?q=Ventil"]',
    );
    expect(aktion).not.toBeNull();
    await act(async () => {
      aktion?.click();
    });
    await beruhige(5);
    expect(ort(s)).toBe("/bibliothek?q=Ventil");
  });
});

describe("R-0893 · S4–S7 — Grenzen der Schnellwahl", () => {
  it("S4: unter zwei Zeichen fragt die Palette den Server nicht", async () => {
    expect(WISSEN_AB_ZEICHEN).toBe(2);
    const s = await offenMit([netz.ko("alpha", "Ventil Alpha")]);
    await paletteTippen(s, "V");
    await entprellungAbwarten();
    expect(netz.gefragt).toEqual([]);
    expect(palettenFlaeche(s).querySelector('[data-cmd-gruppe="wissen"]')).toBeNull();
  });

  it("S5: Seiten bleiben vorn — Enter auf den Seitennamen öffnet die Seite, nicht den Eintrag", async () => {
    const name = i18n.t("nav.library");
    const s = await offenMit([netz.ko("leit", `${name} Leitfaden`)]);
    await paletteTippen(s, name);
    await entprellungAbwarten();
    // Nicht-vakuös: der Wissenseintrag steht WIRKLICH da, nur hinter der Seite.
    expect(wissenszeilen(s).map((z) => z.pfad)).toEqual(["/wissen/leit"]);
    expect(
      palettenFlaeche(s).querySelector('[data-cmd-stelle="0"]')?.getAttribute("data-cmd-pfad"),
    ).toBe("/bibliothek");
    await enter(s);
    expect(ort(s)).toBe("/bibliothek");
  });

  it("S6: nach dem Weitertippen steht die Antwort zum alten Begriff nicht mehr da", async () => {
    const s = await offenMit([netz.ko("alpha", "Ventil Alpha"), netz.ko("beta", "Pumpe Beta")]);
    await paletteTippen(s, "Ventil");
    await entprellungAbwarten();
    expect(wissenszeilen(s).map((z) => z.pfad)).toEqual(["/wissen/alpha"]);

    // Sofort nach der Eingabe, VOR der Tipp-Pause: kein Treffer zu „Ventil“ darf noch dastehen.
    await paletteTippen(s, "Pumpe");
    expect(wissenszeilen(s)).toEqual([]);

    await entprellungAbwarten();
    expect(wissenszeilen(s).map((z) => z.pfad)).toEqual(["/wissen/beta"]);
  });

  it("S7: die Palette zeigt genau die Antwort des Servers — ohne Antwort kein Eintrag", async () => {
    // Der Server (hier die Attrappe) gibt für diese Sitzung nichts zu „Geheim“ zurück — so, wie
    // `sichtbareFuer` ein vertrauliches Objekt für den Viewer streicht.
    const s = await offenMit([netz.ko("alpha", "Ventil Alpha")]);
    await paletteTippen(s, "Geheim");
    await entprellungAbwarten();
    expect(netz.gefragt).toContain("Geheim");
    expect(wissenszeilen(s)).toEqual([]);
    expect(palettenFlaeche(s).querySelector('[data-cmd-gruppe="wissen"]')).toBeNull();
    // Der Nulltreffer bleibt der vorhandene (R-0474): Eingabe als Frage.
    expect(palettenFlaeche(s).querySelector('[data-cmd="als-frage"]')).not.toBeNull();
  });
});
