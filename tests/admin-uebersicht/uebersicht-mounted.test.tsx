// @vitest-environment jsdom
// ================================================================================================
// ADMIN-01 · DIE VERWALTUNGSÜBERSICHT, GEMOUNTET — Einstieg, Zähler ↔ Liste, Ladefehler, Rückweg.
// ================================================================================================
//
// produkt:20261009:admin-verwaltung-uebersicht. Gemessen an den ECHTEN Bauteilen (`pages/Admin`,
// `pages/Risk`) unter den echten Anbietern, mit echtem Verlauf (`createMemoryHistory`, wie
// `tests/admin-navigation/vorrichtung.tsx`) und ohne echtes Netz: `fetch` beantwortet genau die
// genannten GET-Pfade mit FIKTIVEN Beständen und lässt alles andere scheitern.
//
//   K1  `/admin` öffnet die Übersicht; jede Gruppe nennt ihren Zweck; jeder Verwaltungsweg landet
//       auf seiner Adresse und Browser-Zurück führt auf die Übersicht zurück.
//   K2  Der Zähler und die Liste dahinter zeigen für denselben Datenstand dieselbe Zahl
//       (Kontenliste mit `filter=wartet`, Lückenliste mit `luecken=offen`); jede Zahl nennt, wann
//       sie erhoben wurde, und „Zahlen aktualisieren" fragt die Quellen wirklich neu.
//   K3  Ohne Antwort steht nie eine Null: „wird ermittelt …" bzw. „nicht abrufbar"; scheitert EINE
//       Quelle, bleiben die übrigen Zahlen und alle Wege.
//   K4  Zurück, Vorwärts und Neuladen behalten Thema, Konto und Filter.
//
// WAS HIER NICHT GEMESSEN IST: Layout, Fokusring und 390 px — das braucht einen echten Browser
// (`tests-smoke/admin-uebersicht.spec.ts`). Und KEIN Mensch: K5 verlangt einen unvertrauten
// Testnutzer, den dieser Prüfstand nicht ersetzt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => ({
        id: "u-admin",
        name: "Ada Admin",
        email: "ada@beispiel.test",
        role: "admin",
      })),
    },
  };
});

import {
  type MemoryHistory,
  createMemoryHistory,
} from "../../apps/web/node_modules/@remix-run/router";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import {
  type ReactNode,
  act,
  createElement,
  useLayoutEffect,
  useState,
} from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Route, Router, Routes, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { adminHref } from "../../apps/web/src/lib/adminSections";
import { VERWALTUNG_GRUPPEN, aufgabeHref } from "../../apps/web/src/lib/adminUebersicht";
import { Admin } from "../../apps/web/src/pages/Admin";
import { Risk } from "../../apps/web/src/pages/Risk";
import {
  type Stand,
  abbauen,
  aktivesThema,
  beruhige,
  klicke,
  ort,
  setzeStufe2,
  verlauf,
} from "../admin-navigation/vorrichtung";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = (key: string, opts?: Record<string, unknown>): string =>
  opts === undefined ? i18n.t(key) : i18n.t(key, opts);

// ---- Fiktive Bestände (keine echten Personen, keine echten Inhalte) ------------------------------
const BOARD = [
  { id: "ko-1", title: "Lehrring prüfen" },
  { id: "ko-2", title: "Messschieber kalibrieren" },
  { id: "ko-3", title: "Prüfstift ablegen" },
];
const LUECKEN = [
  {
    id: "g-1",
    question: "Wie oft wird die Lehre kalibriert?",
    status: "offen",
    assignee: null,
    priority: "hoch",
    createdAt: "2026-10-01T08:00:00.000Z",
  },
  {
    id: "g-2",
    question: "Wer gibt den Prüfplan frei?",
    status: "offen",
    assignee: null,
    priority: "mittel",
    createdAt: "2026-10-02T08:00:00.000Z",
  },
  {
    id: "g-3",
    question: "Wo liegt die alte Prüfanweisung?",
    status: "geschlossen",
    assignee: null,
    priority: "niedrig",
    createdAt: "2026-09-20T08:00:00.000Z",
  },
];
const KONTEN = [
  { id: "u-admin", name: "Ada Admin", email: "ada@beispiel.test", role: "admin", approved: true },
  {
    id: "u-neu",
    name: "Nils Neuling",
    email: "nils@beispiel.test",
    role: "viewer",
    approved: false,
  },
  {
    id: "u-exp",
    name: "Erika Expertin",
    email: "erika@beispiel.test",
    role: "experte",
    approved: true,
  },
];
// Nacharbeit 1: vollständig nach `ReasonerConfigStatus` (api/types.ts) — die erste Fassung ließ
// `taskConfig` weg, und die KI-Karte (K1.3 öffnet sie) brach an `taskConfig.global` ab. Der Server
// sendet diese Felder immer; ein Prüfstand mit halber Antwort misst die Attrappe, nicht das Produkt.
const KI = {
  provider: "none",
  configured: false,
  mode: "demo",
  fallbackAvailable: true,
  supportsLocales: ["de", "en", "nl"],
  tasks: [],
  taskConfig: { global: "auto", perTask: {} },
  effective: {},
  cloudConfigured: false,
  localConfigured: false,
  effectiveProvider: {},
  persisted: false,
};

const ALLE: Record<string, unknown> = {
  "/api/validation/board": BOARD,
  "/api/gaps": LUECKEN,
  "/api/users": KONTEN,
  "/api/reasoner/config": KI,
};

/** Ein Netz, das genau `antworten` kennt; `haengend` antwortet nie. Zurück kommt die Rufzählung. */
function netz(
  antworten: Record<string, unknown>,
  haengend: readonly string[] = [],
): Map<string, number> {
  const rufe = new Map<string, number>();
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string }) => {
      const pfad = String(eingabe);
      const methode = (init?.method ?? "GET").toUpperCase();
      rufe.set(pfad, (rufe.get(pfad) ?? 0) + 1);
      if (methode === "GET" && haengend.includes(pfad)) {
        return new Promise(() => undefined);
      }
      const antwort = methode === "GET" ? antworten[pfad] : undefined;
      if (antwort === undefined) {
        throw new Error(`kein Netz in diesem Prüfstand: ${methode} ${pfad}`);
      }
      return {
        status: 200,
        ok: true,
        statusText: "OK",
        text: async () => JSON.stringify(antwort),
      };
    },
  });
  return rufe;
}

// ---- Der Prüfstand: `/admin` und `/risiko` in EINEM Router mit echtem Verlauf --------------------
function Ortsanzeige(): JSX.Element {
  const o = useLocation();
  return createElement("div", { "data-testid": "ort" }, `${o.pathname}${o.search}`);
}

function VerlaufsRouter({
  verlaufsspeicher,
  children,
}: {
  verlaufsspeicher: MemoryHistory;
  children?: ReactNode;
}): JSX.Element {
  const [zustand, setZustand] = useState({
    action: verlaufsspeicher.action,
    location: verlaufsspeicher.location,
  });
  useLayoutEffect(() => verlaufsspeicher.listen(setZustand), [verlaufsspeicher]);
  return createElement(Router, {
    location: zustand.location,
    navigationType: zustand.action,
    navigator: verlaufsspeicher,
    children,
  });
}

function montiere(pfad: string): Stand {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const verlaufsspeicher = createMemoryHistory({
    initialEntries: [pfad],
    initialIndex: 0,
    v5Compat: true,
  });
  const seiten = createElement(
    Routes,
    null,
    createElement(Route, { path: "/admin", element: createElement(Admin) }),
    createElement(Route, { path: "/risiko", element: createElement(Risk) }),
    createElement(Route, {
      path: "*",
      element: createElement("div", { "data-testid": "fremde-seite" }),
    }),
  );
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          VerlaufsRouter,
          { verlaufsspeicher },
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
                  ImageDescribeProvider,
                  null,
                  createElement(NavGuardProvider, null, createElement(Ortsanzeige), seiten),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  return { container, root, verlaufsspeicher };
}

let stand: Stand | null = null;

async function oeffne(pfad: string): Promise<Stand> {
  const s = montiere(pfad);
  stand = s;
  await beruhige();
  return s;
}

/** Neuladen: dieselbe Adresse, ein frisch gebauter Baum und ein frischer Zwischenspeicher. */
async function neuLaden(s: Stand): Promise<Stand> {
  const adresse = `${s.verlaufsspeicher.location.pathname}${s.verlaufsspeicher.location.search}`;
  abbauen(s);
  return oeffne(adresse);
}

const q = (s: Stand, testId: string): HTMLElement | null =>
  s.container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

function zaehler(s: Stand, id: string): { text: string; art: string | null; href: string | null } {
  const zeile = q(s, `aufgabe-${id}`);
  return {
    text: (zeile?.querySelector('[data-einst="wert"]')?.textContent ?? "").trim(),
    art: zeile?.getAttribute("data-art") ?? null,
    href: zeile?.getAttribute("href") ?? null,
  };
}

/** Die führende Zahl eines Zählertexts („3 · erhoben 10:42:07" → 3). */
function zahl(text: string): number | null {
  const m = /^(\d+)/.exec(text);
  return m ? Number(m[1]) : null;
}

const nutzerZeilen = (s: Stand): HTMLElement[] => [
  ...s.container.querySelectorAll<HTMLElement>(
    '[data-testid="flaeche-nutzer"] button[data-einst="zeile"]',
  ),
];

beforeEach(async () => {
  setzeStufe2(true);
  await i18n.changeLanguage("de");
});

afterEach(() => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
  vi.clearAllMocks();
});

describe("ADMIN-01 · K1 · der Einstieg Verwaltung öffnet die Übersicht", () => {
  it("K1.1 · `/admin` zeigt die Übersicht, nicht die Nutzerliste; jede Gruppe nennt ihren Zweck", async () => {
    netz(ALLE);
    const s = await oeffne("/admin");
    expect(q(s, "verwaltung-uebersicht"), "die Übersicht steht nicht da").not.toBeNull();
    expect(q(s, "flaeche-nutzer"), "die Nutzerliste ist wieder der Einstieg").toBeNull();
    expect(q(s, "reiter-uebersicht")?.getAttribute("aria-pressed")).toBe("true");
    expect(aktivesThema(s), "auf der Übersicht ist kein Thema ausgezeichnet").toBe("");
    for (const g of VERWALTUNG_GRUPPEN) {
      const gruppe = q(s, `gruppe-${g.id}`);
      expect(gruppe, `Gruppe ${g.id} fehlt`).not.toBeNull();
      expect(gruppe?.querySelector("h3")?.textContent).toBe(t(g.labelKey));
      expect(gruppe?.querySelector('[data-einst="zweck"]')?.textContent).toBe(t(g.zweckKey));
    }
  });

  it("K1.2 · Kommunikation bietet nichts Unbenutzbares an — eine Zeile ohne Link und ohne Knopf", async () => {
    netz(ALLE);
    const s = await oeffne("/admin");
    const leer = q(s, "gruppe-kommunikation-leer");
    expect(leer?.textContent).toContain(t("verwaltung.nichtVerfuegbar"));
    expect(leer?.tagName).toBe("DIV");
    expect(q(s, "gruppe-kommunikation")?.querySelector("a, button")).toBeNull();
  });

  it("K1.3 · jeder Verwaltungsweg landet auf seiner Adresse; Zurück führt auf die Übersicht", async () => {
    netz(ALLE);
    const s = await oeffne("/admin");
    for (const g of VERWALTUNG_GRUPPEN) {
      for (const z of g.ziele) {
        if (z.art !== "verwaltung") {
          continue;
        }
        const kennung = z.labelKey ? (z.labelKey.split(".").pop() ?? "") : "";
        const testId = `ziel-${kennung || (z.detail ? `${z.section}-${z.detail}` : z.section)}`;
        await klicke(q(s, testId));
        expect(ort(s), `${testId} führte woandershin`).toBe(adminHref(z.section, z.detail));
        await verlauf(s, -1);
        expect(ort(s)).toBe("/admin");
        expect(q(s, "verwaltung-uebersicht"), `nach ${testId} kein Rückweg`).not.toBeNull();
      }
    }
  });

  it("K1.4 · Bereiche der App und Spaces sind echte Links auf ihre vorhandenen Routen", async () => {
    netz(ALLE);
    const s = await oeffne("/admin");
    expect(q(s, "ziel-spaces")?.getAttribute("href")).toBe("/spaces");
    expect(q(s, "ziel-validierung")?.getAttribute("href")).toBe("/validierung");
    expect(q(s, "ziel-bibliothek")?.getAttribute("href")).toBe("/bibliothek");
    // Persönliche Einstellungen stehen getrennt, nicht in einer Verwaltungsgruppe.
    expect(q(s, "ziel-profil")?.getAttribute("href")).toBe("/profil");
    for (const g of VERWALTUNG_GRUPPEN) {
      expect(q(s, `gruppe-${g.id}`)?.querySelector('[data-testid="ziel-profil"]')).toBeNull();
    }
  });

  it("K1.5 · ein Modul, das aus ist, steht als „Modul aus“ da — ohne Weg", async () => {
    setzeStufe2(false);
    netz(ALLE);
    const s = await oeffne("/admin");
    const importZeile = q(s, "ziel-import");
    expect(importZeile?.textContent).toContain(t("einst.modul.aus"));
    expect(importZeile?.tagName).toBe("DIV");
  });
});

describe("ADMIN-01 · K2 · Zähler und gefilterte Liste stimmen überein", () => {
  it("K2.1 · vier Zähler mit Zahl und Erhebungszeit, jeder ein Link auf seine Liste", async () => {
    netz(ALLE);
    const s = await oeffne("/admin");
    const erhoben = t("verwaltung.aufgaben.erhoben", { zeit: "" }).trim();
    for (const [id, erwartet] of [
      ["pruefungen", 3],
      ["luecken", 2],
      ["freigaben", 1],
    ] as const) {
      const z = zaehler(s, id);
      expect(z.art, `${id}: ${z.text}`).toBe("wert");
      expect(zahl(z.text), `${id}: ${z.text}`).toBe(erwartet);
      expect(z.text, `${id}: keine Erhebungszeit`).toContain(erhoben);
      expect(z.href).toBe(aufgabeHref(id));
    }
    const ki = zaehler(s, "kiZugaenge");
    expect(ki.art).toBe("wert");
    expect(ki.href).toBe(aufgabeHref("kiZugaenge"));
  });

  it("K2.2 · „Konten warten auf Freigabe“ → genau diese Konten, gefiltert und benannt", async () => {
    netz(ALLE);
    const s = await oeffne("/admin");
    const anzahl = zahl(zaehler(s, "freigaben").text);
    await klicke(q(s, "aufgabe-freigaben"));
    expect(ort(s)).toBe(aufgabeHref("freigaben"));
    expect(aktivesThema(s)).toBe(t("adm.sec.konten"));
    expect(q(s, "zeile-filter-wartet")?.textContent).toContain(t("verwaltung.filter.wartet"));
    const zeilen = nutzerZeilen(s);
    expect(zeilen.length, "Liste und Zähler laufen auseinander").toBe(anzahl);
    expect(zeilen[0]?.textContent).toContain("Nils Neuling");
    // Gegenprobe: ohne Filter stehen alle drei Konten da.
    await klicke(q(s, "knopf-filter-aufheben"));
    expect(ort(s)).toBe(adminHref("konten"));
    expect(nutzerZeilen(s).length).toBe(KONTEN.length);
  });

  it("K2.3 · „Offene Wissenslücken“ → die Lückenliste zeigt genau die offenen", async () => {
    netz(ALLE);
    const s = await oeffne("/admin");
    const anzahl = zahl(zaehler(s, "luecken").text);
    await klicke(q(s, "aufgabe-luecken"));
    await beruhige();
    expect(ort(s)).toBe(aufgabeHref("luecken"));
    expect(q(s, "filter-luecken")?.textContent).toContain(t("verwaltung.filter.offeneLuecken"));
    const zeilen = s.container.querySelectorAll('[data-testid="luecke-zeile"]');
    expect(zeilen.length, "Liste und Zähler laufen auseinander").toBe(anzahl);
    // Und zurück auf die Übersicht — mit derselben Zahl, ohne neuen Zustand.
    await verlauf(s, -1);
    expect(ort(s)).toBe("/admin");
    expect(zahl(zaehler(s, "luecken").text)).toBe(anzahl);
  });

  it("K2.4 · „Zahlen aktualisieren“ fragt jede Quelle wirklich neu", async () => {
    const rufe = netz(ALLE);
    const s = await oeffne("/admin");
    const vorher = new Map(rufe);
    await klicke(q(s, "knopf-aufgaben-aktualisieren"));
    await beruhige();
    for (const pfad of Object.keys(ALLE)) {
      expect(rufe.get(pfad) ?? 0, `${pfad} wurde nicht neu gefragt`).toBeGreaterThan(
        vorher.get(pfad) ?? 0,
      );
    }
  });
});

describe("ADMIN-01 · K3 · unbekannt statt null; ein Teilfehler sperrt nichts", () => {
  it("K3.1 · ohne jede Antwort: „nicht abrufbar“, nirgends eine Null — und die Wege tragen", async () => {
    netz({});
    const s = await oeffne("/admin");
    for (const id of ["pruefungen", "luecken", "freigaben", "kiZugaenge"]) {
      const z = zaehler(s, id);
      expect(z.art, `${id}: ${z.text}`).toBe("fehler");
      expect(z.text).toBe(t("einst.wert.nichtAbrufbar"));
      expect(zahl(z.text), `${id} behauptet eine Zahl ohne Antwort`).toBeNull();
    }
    await klicke(q(s, "ziel-system"));
    expect(aktivesThema(s)).toBe(t("adm.sec.system"));
  });

  it("K3.2 · solange eine Quelle lädt: „wird ermittelt …“ statt einer Zahl", async () => {
    netz(ALLE, ["/api/gaps"]);
    const s = await oeffne("/admin");
    const z = zaehler(s, "luecken");
    expect(z.art).toBe("laedt");
    expect(z.text).toBe(t("verwaltung.wert.laedt"));
    // Die übrigen Zähler stehen unabhängig davon.
    expect(zahl(zaehler(s, "pruefungen").text)).toBe(3);
  });

  it("K3.3 · scheitert EINE Quelle, bleiben die anderen Zahlen und jede Gruppe bedienbar", async () => {
    const { "/api/gaps": _ohne, ...rest } = ALLE;
    netz(rest);
    const s = await oeffne("/admin");
    expect(zaehler(s, "luecken").art).toBe("fehler");
    expect(zahl(zaehler(s, "pruefungen").text)).toBe(3);
    expect(zahl(zaehler(s, "freigaben").text)).toBe(1);
    for (const g of VERWALTUNG_GRUPPEN) {
      expect(q(s, `gruppe-${g.id}`), `Gruppe ${g.id} fehlt beim Teilfehler`).not.toBeNull();
    }
    await klicke(q(s, "ziel-uebergabe"));
    expect(ort(s)).toBe(adminHref("konten"));
  });
});

describe("ADMIN-01 · K4 · Zurück und Neuladen behalten Thema, Konto und Filter", () => {
  it("K4.1 · gefilterte Liste → Konto → Zurück → Vorwärts → Neuladen → Kartenrückweg", async () => {
    netz(ALLE);
    let s = await oeffne(aufgabeHref("freigaben"));
    expect(nutzerZeilen(s).length).toBe(1);

    await klicke(nutzerZeilen(s)[0]);
    expect(ort(s)).toContain("detail=nutzer%3Au-neu");
    expect(ort(s), "der Filter ging beim Öffnen des Kontos verloren").toContain("filter=wartet");

    await verlauf(s, -1);
    expect(ort(s)).toBe(aufgabeHref("freigaben"));
    expect(nutzerZeilen(s).length, "Zurück kam ungefiltert an").toBe(1);

    await verlauf(s, 1);
    expect(ort(s)).toContain("detail=nutzer%3Au-neu");

    s = await neuLaden(s);
    expect(ort(s), "Neuladen verlor Konto oder Filter").toContain("filter=wartet");
    expect(s.container.querySelector('[data-einst="detail"]'), "die Karte ist zu").not.toBeNull();

    await klicke(s.container.querySelector('[data-einst="zurueck"]'));
    expect(ort(s), "der Kartenrückweg verlor den Filter").toBe(aufgabeHref("freigaben"));

    s = await neuLaden(s);
    expect(nutzerZeilen(s).length, "Neuladen der gefilterten Liste").toBe(1);
  });

  it("K4.2 · die gefilterte Lückenliste übersteht das Neuladen", async () => {
    netz(ALLE);
    let s = await oeffne(aufgabeHref("luecken"));
    expect(s.container.querySelectorAll('[data-testid="luecke-zeile"]').length).toBe(2);
    s = await neuLaden(s);
    expect(ort(s)).toBe(aufgabeHref("luecken"));
    expect(s.container.querySelectorAll('[data-testid="luecke-zeile"]').length).toBe(2);
  });

  it("K4.3 · der Wechsel in ein anderes Thema beginnt ohne den Kontenfilter", async () => {
    netz(ALLE);
    const s = await oeffne(aufgabeHref("freigaben"));
    const ki = [...s.container.querySelectorAll('[data-einst="reiter"]')].find(
      (b) => (b.textContent ?? "").trim() === t("adm.sec.ki"),
    );
    await klicke(ki);
    expect(ort(s)).toBe(adminHref("ki"));
    await klicke(q(s, "reiter-uebersicht"));
    expect(ort(s)).toBe("/admin");
  });
});

describe("ADMIN-01 · K6 · bedienbar ohne Maus (Elementvertrag — Fokusring und 390 px im Smoke)", () => {
  it("jede Aufgabe und jeder Weg ist ein Link oder Knopf, nie aus der Tabfolge genommen", async () => {
    netz(ALLE);
    const s = await oeffne("/admin");
    const ziele = [
      ...s.container.querySelectorAll<HTMLElement>(
        '[data-testid^="aufgabe-"][data-einst="zeile"], [data-testid^="ziel-"]',
      ),
    ];
    expect(ziele.length).toBeGreaterThan(20);
    for (const el of ziele) {
      const testId = el.getAttribute("data-testid");
      if (el.tagName === "DIV") {
        // Nur „Modul aus" darf eine Zeile ohne Weg sein (Stufe 2 ist hier an — also keine).
        throw new Error(`${testId} ist kein Bedienelement`);
      }
      expect(["A", "BUTTON"], `${testId}`).toContain(el.tagName);
      expect(el.getAttribute("tabindex"), `${testId} ist aus der Tabfolge genommen`).not.toBe("-1");
    }
    expect(q(s, "reiter-uebersicht")?.tagName).toBe("BUTTON");
  });
});
