// @vitest-environment jsdom
// ================================================================================================
// FE-002 · HEADER TEIL 1 — FUNKTIONEN FINDEN UND NAVIGATION VERSTEHEN (Bedienwege, jsdom).
// ================================================================================================
//
// Aus den Kriterien des Auftrags arbeit:fe-002-header-orientierung-20260926 abgeleitet, nicht aus
// dem Code. Gemountet werden das ECHTE Kopfband, die ECHTE Palette und der ECHTE Drawer-Inhalt
// unter denselben Anbietern wie in der Hülle; die Endpunktgrenze ist eine Attrappe, deren Antwort
// auf `/api/notifications` der Fall steuert.
//
//   E1  vier Zwecke unterscheidbar: Arbeitsbereiche, Wissen suchen, Einstellungen, Meldungen;
//       das Zahnrad führt nicht mehr zu Arbeitsseiten; der Konto-Kreis bleibt das Konto
//   E2  Wissen suchen ≠ Seite finden; die Palette zeigt keine technischen Pfade, Namen und
//       bisherige Namen finden weiterhin ihr Ziel, ⌘K bleibt
//   E3  Meldungen vor dem Kontomenü: ungelesen (Zahl), keine ungelesenen, lädt, Fehler
//   E4  Vorher/Nachher: jede Rolle erreicht über den Kopf GENAU die Ziele, die das Rollen-/
//       Modulmodell ihr erlaubt — keines verloren, keines hinzugewonnen
//   E5  Tastatur: öffnen, wandern, Escape, Fokusrückgabe
//
// Was hier NICHT belegt wird und auch nicht belegt werden kann: Layout, Überdeckung, Sichtbarkeit
// am Bildschirm — das misst `kopfband-fe002-chromium.test.ts` im echten Browser. Und die
// Verständlichkeit für eine neue Person — das ist die menschliche Probe (E7), die kein Test ersetzt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const netz = vi.hoisted(() => {
  const state = {
    rolle: "admin" as string,
    meldungen: (): Promise<unknown> => Promise.resolve([]),
  };
  return {
    state,
    markSeen: { calls: [] as unknown[] },
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({
      id: "u1",
      name: "Pia Prüfer",
      email: "p@x.de",
      role: netz.state.rolle,
    })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { board: ok([]) },
      conflicts: { list: ok([]) },
      duplicates: { list: ok([]) },
      gaps: { summary: ok({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }) },
      lifecycle: { pending: ok([]) },
      notifications: {
        list: vi.fn(() => netz.state.meldungen()),
        markSeen: vi.fn(async (ids: unknown) => {
          netz.markSeen.calls.push(ids);
          return { unseenCount: 0 };
        }),
      },
      features: { get: ok({ features: {} }) },
      reasoner: {
        status: ok({ active: false, mode: "none", reachable: "unknown", tasks: {} }),
        config: ok(null),
      },
      external: { policy: ok({ stage: "blocked" }) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useRef, useState } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import {
  ALL_ITEMS,
  FOOT_ITEMS,
  type Role,
  anzeigeNameKey,
  canSee,
  einstellungenItem,
  kopfbandItems,
  suchNamenKeys,
  weitereBereicheItems,
} from "../../apps/web/src/app/navigation";
import { direktzugangZiele } from "../../apps/web/src/app/navigationGliederung";
import i18n from "../../apps/web/src/i18n";
import { effectiveStufe2 } from "../../apps/web/src/lib/effectiveRole";
import { aktuellePlattform, kuerzelText } from "../../apps/web/src/lib/tastenkuerzel";
import { CommandPalette } from "../../apps/web/src/shell/CommandPalette";
import { DrawerMenue } from "../../apps/web/src/shell/DrawerMenue";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";
import { MobileNavDrawer } from "../../apps/web/src/shell/MobileNavDrawer";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const t = (key: string, o: Record<string, unknown> = {}): string => i18n.t(key, o);

let container: HTMLDivElement;
let root: Root;

const flush = async (runden = 30): Promise<void> => {
  for (let i = 0; i < runden; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("span", { "data-testid": "adresse" }, `${ort.pathname}${ort.search}`);
}

/**
 * Die schmale Hülle im Kleinen: der „Menü"-Auslöser, der ECHTE `MobileNavDrawer` (meldet sich an
 * der Modalgrenze an und gibt beim Schließen den Fokus zurück) und die ECHTE Palette daneben.
 */
function MobilHuelle(): JSX.Element {
  const [offen, setOffen] = useState(false);
  const ausloeser = useRef<HTMLButtonElement | null>(null);
  return createElement(
    "div",
    null,
    createElement(
      "button",
      {
        type: "button",
        ref: ausloeser,
        "data-testid": "kopfband-menue",
        onClick: () => setOffen(true),
      },
      "Menü",
    ),
    createElement(MobileNavDrawer, {
      open: offen,
      onClose: () => setOffen(false),
      triggerRef: ausloeser,
    }),
    createElement(CommandPalette),
  );
}

async function montiere(opt: { drawer?: boolean; mobil?: boolean } = {}): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // Frischezeit wie im Produkt (`main.tsx`: 30 s) — sonst wäre jede Antwort sofort „veraltet"
  // und der Meldungszugang dürfte nie eine Zahl zeigen (§9).
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  const kinder = opt.mobil
    ? [createElement(MobilHuelle, { key: "mobil" })]
    : opt.drawer
      ? [createElement(DrawerMenue, { key: "drawer", onClose: () => {} })]
      : [
          createElement(Kopfband, { key: "band" }),
          createElement(CommandPalette, { key: "palette" }),
        ];
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
                MemoryRouter,
                { initialEntries: ["/start"] },
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(ModalBoundaryProvider, {
                    hostRef: { current: null },
                    children: kinder,
                  }),
                  createElement(Adresse),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await flush();
}

const q = <T extends Element = HTMLElement>(sel: string): T | null =>
  container.querySelector<T & Element>(sel) as T | null;
const adresse = (): string => q('[data-testid="adresse"]')?.textContent ?? "";

async function klicke(el: Element | null): Promise<void> {
  if (!el) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    (el as HTMLElement).click();
  });
  await flush(5);
}

async function taste(
  el: Element | null,
  key: string,
  extra: KeyboardEventInit = {},
): Promise<void> {
  if (!el) {
    throw new Error(`Element für Taste ${key} fehlt`);
  }
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...extra }));
  });
  await flush(5);
}

async function tippe(feld: HTMLInputElement | null, wert: string): Promise<void> {
  if (!feld) {
    throw new Error("Feld fehlt");
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush(3);
}

/** Alle Ziele, auf die ein Menü gerade verlinkt (Pfad ohne Query). */
function linkZiele(wurzel: Element | null): string[] {
  return [...(wurzel?.querySelectorAll("a[href]") ?? [])].map(
    (a) => (a.getAttribute("href") ?? "").split("?")[0] ?? "",
  );
}

beforeEach(() => {
  netz.state.rolle = "admin";
  netz.state.meldungen = () => Promise.resolve([]);
  netz.markSeen.calls = [];
  window.localStorage.setItem("kw.stufe2.v1", "1");
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await act(async () => {
    await i18n.changeLanguage("de");
  });
  vi.clearAllMocks();
});

// ------------------------------------------------------------------------------------------------
describe("FE-002 · E1 — vier Zwecke, vier sichtbare Wege", () => {
  it("E1.1 · das Kopfband nennt Arbeitsbereiche, Wissen suchen, Seite finden; Zahnrad, Meldungen und Konto sind benannt", async () => {
    await montiere();
    const band = q('header[data-testid="kopfband"]');
    const bereiche = q('[data-testid="kopfband-arbeitsbereiche"]');
    expect(bereiche?.textContent).toBe(t("fe002.arbeitsbereiche"));
    expect(bereiche?.getAttribute("aria-haspopup")).toBe("menu");
    // Der Einstieg steht IN der Hauptnavigation, hinter den Punkten — nicht bei den Werkzeugen.
    expect(bereiche?.closest("nav")?.getAttribute("aria-label")).toBe(t("kopfband.navigation"));

    const suche = q<HTMLInputElement>('[data-testid="kopfband-wissen-suchen"]');
    expect(suche?.placeholder, "Wissenssuche nur im aria-label benannt").toBe("Wissen suchen");
    expect(suche?.getAttribute("aria-label")).toBe("Wissen suchen");

    const seite = q('[data-testid="kopfband-gehezu"]');
    expect(seite?.textContent).toContain("Seite finden");
    // R-0987: das Kürzel der eigenen Plattform („⌘K" auf Apple, sonst „Strg+K").
    expect(seite?.textContent).toContain(kuerzelText("K", i18n.language, aktuellePlattform()));
    expect(seite?.textContent, "der alte, zweckfreie Name steht noch da").not.toContain("Gehe zu");

    expect(q('[data-testid="kopfband-zahnrad"]')?.getAttribute("aria-label")).toBe(
      "Einstellungen und Hilfe",
    );
    expect(q('[data-testid="kopfband-meldungen"]')?.getAttribute("aria-label")).toMatch(
      /^Meldungen · /,
    );
    expect(q('[data-testid="kopfband-konto"]')?.getAttribute("aria-label")).toBe("Konto");
    // Der Punkt am Konto-Kreis ist fort — das Signal wohnt am Meldungszugang.
    expect(q('[data-testid="konto-punkt"]')).toBeNull();
    expect(band).not.toBeNull();
  });

  it("E1.2 · das Zahnrad trägt Einstellungen und Hilfe — keine Arbeitsseiten, kein Schnellzugriff mehr", async () => {
    await montiere();
    await klicke(q('[data-testid="kopfband-zahnrad"]'));
    const menue = q('[data-testid="zahnrad-menue"]');
    expect(menue?.getAttribute("aria-label")).toBe("Einstellungen und Hilfe");
    expect(q('[data-testid="zahnrad-weitere-bereiche"]')).toBeNull();
    expect(q('[data-testid="zahnrad-schnellnavigation"]')).toBeNull();
    expect(menue?.querySelector('[data-testid^="bereich-"]')).toBeNull();
    // Einstellungen: für den Admin die Verwaltung, für JEDE Rolle die persönlichen.
    expect(q('[data-testid="zahnrad-einstellungen"]')?.getAttribute("href")).toBe("/admin");
    expect(q('[data-testid="zahnrad-persoenlich"]')?.textContent).toBe("Persönliche Einstellungen");
    expect(q('[data-testid="zahnrad-persoenlich"]')?.getAttribute("href")).toBe("/profil");
    expect(q('[data-testid="zahnrad-hilfe"]')?.getAttribute("href")).toBe("/hilfe");
  });

  it("E1.3 · „Arbeitsbereiche“ zeigt die weiteren Seiten in Gruppen und öffnet sie (Meine Aufgaben, Gesamtanweisungen)", async () => {
    await montiere();
    await klicke(q('[data-testid="kopfband-arbeitsbereiche"]'));
    const menue = q('[data-testid="arbeitsbereiche-menue"]');
    expect(menue?.getAttribute("role")).toBe("menu");
    expect(menue?.getAttribute("aria-label")).toBe("Arbeitsbereiche");
    expect(menue?.querySelectorAll("[data-bereichsgruppe]").length).toBeGreaterThan(1);
    // Die Namen kommen aus derselben Quelle wie überall (FE-001-Bezeichnung inklusive).
    const gesamt = ALL_ITEMS.find((i) => i.id === "gesamtanweisungen");
    expect(q('[data-testid="bereich-gesamtanweisungen"]')?.textContent).toBe(
      gesamt ? t(anzeigeNameKey(gesamt)) : "fehlt",
    );
    await klicke(q('[data-testid="bereich-aufgaben"]'));
    expect(adresse()).toBe("/aufgaben");
    expect(
      q('[data-testid="arbeitsbereiche-menue"]'),
      "Menü hängt über der neuen Seite",
    ).toBeNull();
  });

  it("E1.4 · der schmale Drawer trägt dieselben Abschnitte: Hauptnavigation, Arbeitsbereiche, Einstellungen und Hilfe, Konto", async () => {
    await montiere({ drawer: true });
    const koepfe = [...container.querySelectorAll(".kw-menue-kopf")].map((k) => k.textContent);
    for (const kopf of ["Hauptnavigation", "Arbeitsbereiche", "Einstellungen und Hilfe", "Konto"]) {
      expect(koepfe).toContain(kopf);
    }
    expect(q('[data-testid="bereich-aufgaben"]')).not.toBeNull();
    expect(q('[data-testid="arbeitsbereiche-seite-finden"]')).not.toBeNull();
    expect(q('[data-testid="zahnrad-persoenlich"]')).not.toBeNull();
  });
  // Ben, Lauf 2 Runde 1: im Drawer schloss „Seite finden" den Drawer, die Palette blieb zu — ihr
  // Ereignis kam, solange die Modalgrenze noch gesperrt war. E1.4 prüfte nur das Vorhandensein.
  it("E1.5 · Drawer → „Seite finden“ öffnet die Palette NACH Freigabe der Modalgrenze; Escape gibt den Fokus an „Menü“ zurück", async () => {
    await montiere({ mobil: true });
    const menue = q('[data-testid="kopfband-menue"]');
    menue?.focus();
    await klicke(menue);
    expect(q('[data-testid="arbeitsbereiche-seite-finden"]')).not.toBeNull();
    await klicke(q('[data-testid="arbeitsbereiche-seite-finden"]'));
    // Drawer zu, Palette offen, Fokus im Suchfeld der Palette.
    expect(q('[data-testid="arbeitsbereiche-seite-finden"]')).toBeNull();
    const feld = q<HTMLInputElement>('[data-cmd="suchfeld"]');
    expect(feld).not.toBeNull();
    expect(document.activeElement).toBe(feld);
    await taste(feld, "Escape");
    expect(q('[data-cmd="suchfeld"]')).toBeNull();
    expect(document.activeElement).toBe(q('[data-testid="kopfband-menue"]'));
  });

  it("E1.6 · GEGENPROBE: ein gewöhnliches Öffnungsereignis bei offener Modalgrenze bleibt abgewiesen und wird nicht nachgeholt", async () => {
    await montiere({ mobil: true });
    await klicke(q('[data-testid="kopfband-menue"]'));
    await act(async () => {
      window.dispatchEvent(new Event("open-command-palette"));
    });
    await flush(5);
    expect(q('[data-cmd="suchfeld"]')).toBeNull();
    // Drawer per Escape schließen: auch danach erscheint keine Palette.
    await taste(q(".kw-drawer") ?? q("dialog"), "Escape");
    expect(q('[data-testid="arbeitsbereiche-seite-finden"]')).toBeNull();
    expect(q('[data-cmd="suchfeld"]')).toBeNull();
  });

  // Tor-Volllauf pa-1790494556-7615eb59: unter Last stand beim Einlösen der Vormerkung noch `BODY`
  // im Fokus, und Escape ließ ihn dort. Der Rückweg kommt deshalb aus der Anfrage, nicht aus
  // `document.activeElement` — hier mit einem ANDEREN Ziel als dem Fokus belegt.
  it("E1.7 · der Rückweg der vorgemerkten Öffnung kommt aus der Anfrage, nicht aus dem gerade fokussierten Element", async () => {
    await montiere({ mobil: true });
    const ziel = document.createElement("button");
    ziel.setAttribute("data-testid", "rueckweg-ziel");
    container.appendChild(ziel);
    await klicke(q('[data-testid="kopfband-menue"]'));
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("open-command-palette", {
          detail: { nachModalgrenze: true, rueckweg: () => ziel },
        }),
      );
    });
    // Drawer schließen: die Grenze gibt den Fokus an „Menü" — die Palette öffnet trotzdem mit dem
    // genannten Rückweg.
    await taste(q(".kw-drawer") ?? q("dialog"), "Escape");
    const feld = q<HTMLInputElement>('[data-cmd="suchfeld"]');
    expect(feld).not.toBeNull();
    await taste(feld, "Escape");
    expect(q('[data-cmd="suchfeld"]')).toBeNull();
    expect(document.activeElement).toBe(ziel);
  });
});

// ------------------------------------------------------------------------------------------------
describe("FE-002 · E2 — Wissen suchen und Seite finden sind zwei Wege", () => {
  it("E2.1 · „Wissen suchen“ führt in die Bibliothekssuche", async () => {
    await montiere();
    const feld = q<HTMLInputElement>('[data-testid="kopfband-wissen-suchen"]');
    await tippe(feld, "Urlaubsantrag");
    await act(async () => {
      feld?.form?.requestSubmit();
    });
    await flush(5);
    expect(adresse()).toBe("/bibliothek?q=Urlaubsantrag");
  });

  it("E2.2 · „Seite finden“ öffnet die vorhandene Palette: benanntes Feld, Hinweis auf die Wissenssuche, KEINE technischen Pfade", async () => {
    await montiere();
    const knopf = q('[data-testid="kopfband-gehezu"]') as HTMLElement;
    knopf.focus();
    await klicke(knopf);
    const feld = q<HTMLInputElement>('[data-cmd="suchfeld"]');
    expect(feld?.getAttribute("aria-label")).toBe("Seite finden");
    expect(feld?.placeholder).toContain("Seite finden");
    expect(q('[data-cmd="hinweis"]')?.textContent).toContain("Wissen suchen");
    const zeilen = [...container.querySelectorAll("[data-cmd-ziel]")];
    expect(zeilen.length).toBe(direktzugangZiele(t, "admin", true).length);
    expect(q("[data-cmd-route]")).toBeNull();
    const mitPfad = zeilen
      .map((z) => z.textContent ?? "")
      .filter((text) => /(^|\s)\/[a-z]/.test(text) || text.includes("?bereich="));
    expect(mitPfad, `sichtbare Pfade: ${mitPfad.join(" | ")}`).toEqual([]);
    // Gruppenüberschriften sind Wörter, keine Pfade.
    const gruppen = [...container.querySelectorAll("[data-cmd-gruppe]")].map((g) => g.textContent);
    expect(gruppen.length).toBeGreaterThan(1);
    expect(gruppen.every((g) => g && !g.includes("/"))).toBe(true);
    // Escape schließt und gibt den Fokus an „Seite finden“ zurück.
    await taste(feld, "Escape");
    expect(q('[data-cmd="suchfeld"]')).toBeNull();
    expect(document.activeElement).toBe(knopf);
  });

  it("E2.3 · angezeigte UND bisherige Namen finden ihr Ziel; Enter öffnet es", async () => {
    await montiere();
    const mitAltname = ALL_ITEMS.find(
      (i) => suchNamenKeys(i).length > 1 && canSee(i, "admin", true),
    );
    expect(mitAltname, "kein Ziel mit bisherigem Namen — der Fall misst nichts").toBeDefined();
    if (!mitAltname) {
      return;
    }
    const altname = t(suchNamenKeys(mitAltname)[1] ?? "");
    await klicke(q('[data-testid="kopfband-gehezu"]'));
    await tippe(q<HTMLInputElement>('[data-cmd="suchfeld"]'), altname);
    const erster = q('[data-cmd-stelle="0"]');
    expect(erster?.getAttribute("data-cmd-pfad")).toBe(mitAltname.path);
    expect(erster?.querySelector("[data-cmd-name]")?.textContent).toBe(
      t(anzeigeNameKey(mitAltname)),
    );
    await taste(q('[data-cmd="suchfeld"]'), "Enter");
    expect(adresse()).toBe(mitAltname.path);
  });

  it("E2.4 · ⌘K und Strg+K öffnen dieselbe Palette weiterhin; „Seite finden …“ steht auch unter Arbeitsbereiche", async () => {
    await montiere();
    await taste(window as unknown as Element, "k", { metaKey: true });
    expect(q('[data-cmd="suchfeld"]')).not.toBeNull();
    await taste(q('[data-cmd="suchfeld"]'), "Escape");
    await taste(window as unknown as Element, "k", { ctrlKey: true });
    expect(q('[data-cmd="suchfeld"]')).not.toBeNull();
    await taste(q('[data-cmd="suchfeld"]'), "Escape");

    const ausloeser = q('[data-testid="kopfband-arbeitsbereiche"]') as HTMLElement;
    await klicke(ausloeser);
    const zeile = q('[data-testid="arbeitsbereiche-seite-finden"]');
    expect(zeile?.textContent).toContain("Seite finden");
    expect(zeile?.textContent).toContain(kuerzelText("K", i18n.language, aktuellePlattform()));
    await klicke(zeile);
    expect(q('[data-testid="arbeitsbereiche-menue"]')).toBeNull();
    expect(q('[data-cmd="suchfeld"]')).not.toBeNull();
    await taste(q('[data-cmd="suchfeld"]'), "Escape");
    expect(document.activeElement, "Fokus fällt nach der Palette ins Leere").toBe(ausloeser);
  });
});

// ------------------------------------------------------------------------------------------------
describe("FE-002 · E3 — Meldungen vor dem Kontomenü", () => {
  const UNGELESEN = [
    { id: "n1", kind: "conflict", title: "Widerspruch in Reisekosten", seen: false },
    { id: "n2", kind: "assignment", title: "Urlaubsregel prüfen", seen: false },
    { id: "n3", kind: "impact", title: "Dein Wissen hat geholfen", seen: true },
  ];

  it("E3.1 · ungelesene Meldungen: Zahl und Name am Zugang, Öffnen zeigt die Liste und ist Kenntnisnahme", async () => {
    netz.state.meldungen = () => Promise.resolve(UNGELESEN);
    await montiere();
    const zugang = q('[data-testid="kopfband-meldungen"]');
    expect(q('[data-testid="meldungen-zahl"]')?.textContent).toBe("2");
    expect(zugang?.getAttribute("aria-label")).toBe("Meldungen · 2 ungelesene Meldungen");
    expect(zugang?.getAttribute("title")).toBe("Meldungen · 2 ungelesene Meldungen");
    // Der Konto-Kreis bleibt dabei das Konto, ohne Meldungssignal.
    expect(q('[data-testid="kopfband-konto"]')?.getAttribute("aria-label")).toBe("Konto");

    await klicke(zugang);
    const menue = q('[data-testid="meldungen-menue"]');
    expect(menue?.getAttribute("aria-label")).toBe("Meldungen");
    // Öffnen ist Kenntnisnahme — die Kopfzeile hält fest, wie viele gerade neu waren.
    expect(q('[data-testid="meldungen-stand"]')?.textContent).toBe("Meldungen · 2 neu");
    expect(menue?.textContent).toContain("Widerspruch in Reisekosten");
    expect(menue?.textContent).toContain("Urlaubsregel prüfen");
    expect(netz.markSeen.calls, "Öffnen ist Kenntnisnahme (Audit-P3)").toEqual([["n1", "n2"]]);
  });

  it("E3.2 · keine ungelesenen: keine Zahl, der Name sagt es ausdrücklich", async () => {
    netz.state.meldungen = () => Promise.resolve(UNGELESEN.map((n) => ({ ...n, seen: true })));
    await montiere();
    expect(q('[data-testid="meldungen-zahl"]')).toBeNull();
    expect(q('[data-testid="kopfband-meldungen"]')?.getAttribute("aria-label")).toBe(
      "Meldungen · Keine ungelesenen Meldungen",
    );
  });

  it("E3.3 · leere Liste nach bestätigtem Abruf: „Keine Benachrichtigungen.“", async () => {
    await montiere();
    await klicke(q('[data-testid="kopfband-meldungen"]'));
    expect(q('[data-testid="meldungen-leer"]')?.textContent).toBe(t("topbar.notificationsEmpty"));
    // Ohne Zeile bekommt die Fläche selbst den Fokus — Escape erreicht sie und gibt ihn zurück.
    const flaeche = q('[data-testid="meldungen-menue"]');
    expect(document.activeElement).toBe(flaeche);
    await taste(flaeche, "Escape");
    expect(q('[data-testid="meldungen-menue"]')).toBeNull();
    expect(document.activeElement).toBe(q('[data-testid="kopfband-meldungen"]'));
  });

  it("E3.4 · noch keine Antwort: KEINE Null — der Zugang sagt „wird geprüft“, die Liste „wird geladen“", async () => {
    netz.state.meldungen = () => new Promise(() => {});
    await montiere();
    expect(q('[data-testid="meldungen-zahl"]')).toBeNull();
    expect(q('[data-testid="kopfband-meldungen"]')?.getAttribute("aria-label")).toBe(
      "Meldungen · Stand der Meldungen wird geprüft",
    );
    await klicke(q('[data-testid="kopfband-meldungen"]'));
    expect(q('[data-testid="meldungen-leer"]')?.textContent).toBe("Meldungen werden geladen …");
    expect(container.textContent).not.toContain(t("topbar.notificationsEmpty"));
  });

  it("E3.5 · Abruf gescheitert: KEINE Null — die Liste sagt, dass die Zahl unbekannt ist", async () => {
    netz.state.meldungen = () => Promise.reject(new Error("503"));
    await montiere();
    expect(q('[data-testid="meldungen-zahl"]')).toBeNull();
    expect(q('[data-testid="kopfband-meldungen"]')?.getAttribute("aria-label")).toBe(
      "Meldungen · Stand der Meldungen wird geprüft",
    );
    await klicke(q('[data-testid="kopfband-meldungen"]'));
    expect(q('[data-testid="meldungen-leer"]')?.textContent).toBe(t("fe002.meldungenFehler"));
    expect(container.textContent).not.toContain(t("topbar.notificationsEmpty"));
  });

  it("E3.6 · der Weg über das Kontomenü bleibt und zeigt dieselbe Zahl", async () => {
    netz.state.meldungen = () => Promise.resolve(UNGELESEN);
    await montiere();
    await klicke(q('[data-testid="kopfband-konto"]'));
    expect(q('[data-testid="konto-meldungen"]')?.textContent).toContain("2");
  });
});

// ------------------------------------------------------------------------------------------------
// E4 — VORHER/NACHHER. „Vorher" ist das Rollen-/Modulmodell, wie es die Oberfläche vor FE-002
// über Kopfband, Zahnrad (samt „Bereiche") und Kontomenü anbot: die Punkte, die weiteren Bereiche
// und die Fußziele (Profil, Hilfe) unter `canSee`, „Einstellungen" nur für den Admin. „Nachher"
// ist, was die gemountete Oberfläche jetzt wirklich verlinkt — in Kopfband, Arbeitsbereiche,
// Zahnrad und Kontomenü. Beide Mengen müssen GLEICH sein: kein Ziel verliert seinen Weg, keine
// Rolle bekommt eines hinzu.
function erlaubteZiele(role: Role, stufe2: boolean): string[] {
  const sichtbar = [...kopfbandItems(), ...weitereBereicheItems(), ...FOOT_ITEMS]
    .filter((i) => canSee(i, role, stufe2))
    .map((i) => i.path);
  const einstellungen = einstellungenItem();
  if (canSee(einstellungen, role, stufe2)) {
    sichtbar.push(einstellungen.path);
  }
  return [...new Set(sichtbar)].sort();
}

async function erreichbareZiele(): Promise<string[]> {
  const ziele = new Set<string>(linkZiele(q('[data-testid="kopfband"] nav')));
  for (const [ausloeser, flaeche] of [
    ["kopfband-arbeitsbereiche", "arbeitsbereiche-menue"],
    ["kopfband-zahnrad", "zahnrad-menue"],
    ["kopfband-konto", "konto-menue"],
  ] as const) {
    await klicke(q(`[data-testid="${ausloeser}"]`));
    for (const z of linkZiele(q(`[data-testid="${flaeche}"]`))) {
      ziele.add(z);
    }
    await taste(q(`[data-testid="${flaeche}"]`), "Escape");
  }
  return [...ziele].sort();
}

describe("FE-002 · E4 — Vorher/Nachher der erlaubten Ziele je Rolle und Modulzustand", () => {
  const faelle: Array<{ rolle: Role; stufe2: boolean }> = [
    { rolle: "viewer", stufe2: false },
    { rolle: "experte", stufe2: false },
    { rolle: "controller", stufe2: false },
    { rolle: "admin", stufe2: false },
    { rolle: "admin", stufe2: true },
  ];
  for (const fall of faelle) {
    it(`E4 · ${fall.rolle}, erweiterte Module ${fall.stufe2 ? "an" : "aus"}: dieselben Ziele wie das Modell`, async () => {
      netz.state.rolle = fall.rolle;
      window.localStorage.setItem("kw.stufe2.v1", fall.stufe2 ? "1" : "0");
      await montiere();
      const stufe2 = effectiveStufe2(fall.rolle, fall.stufe2);
      const soll = erlaubteZiele(fall.rolle, stufe2);
      const ist = await erreichbareZiele();
      expect(ist).toEqual(soll);
      // Und die Palette bietet genau die Ziele des Modells an — nicht mehr, nicht weniger.
      await klicke(q('[data-testid="kopfband-gehezu"]'));
      expect(container.querySelectorAll("[data-cmd-ziel]").length).toBe(
        direktzugangZiele(t, fall.rolle, stufe2).length,
      );
    });
  }

  it("E4 · KALIBRIERUNG: die Rollen unterscheiden sich wirklich (sonst wäre der Vergleich leer)", () => {
    expect(erlaubteZiele("viewer", false).length).toBeLessThan(erlaubteZiele("admin", true).length);
    expect(erlaubteZiele("viewer", false)).not.toContain("/admin");
    expect(erlaubteZiele("admin", false)).not.toContain("/graph");
    expect(erlaubteZiele("admin", true)).toContain("/graph");
  });
});

// ------------------------------------------------------------------------------------------------
describe("FE-002 · E5 — Tastaturwege der neuen Menüs", () => {
  it("E5.1 · Arbeitsbereiche: Öffnen setzt den Fokus auf die erste Zeile, Pfeile wandern, Escape schließt mit Fokusrückgabe", async () => {
    await montiere();
    const ausloeser = q('[data-testid="kopfband-arbeitsbereiche"]') as HTMLElement;
    ausloeser.focus();
    expect(ausloeser.getAttribute("aria-expanded")).toBe("false");
    await klicke(ausloeser);
    expect(ausloeser.getAttribute("aria-expanded")).toBe("true");
    expect(ausloeser.getAttribute("aria-controls")).toBe(
      q('[data-testid="arbeitsbereiche-menue"]')?.id,
    );
    const erste = document.activeElement;
    expect(erste?.getAttribute("role")).toBe("menuitem");
    await taste(erste, "ArrowDown");
    expect(document.activeElement).not.toBe(erste);
    expect(document.activeElement?.getAttribute("role")).toBe("menuitem");
    await taste(document.activeElement, "Escape");
    expect(q('[data-testid="arbeitsbereiche-menue"]')).toBeNull();
    expect(document.activeElement).toBe(ausloeser);
  });

  it("E5.2 · Einstellungen und Meldungen: gleiche Tastaturregel", async () => {
    netz.state.meldungen = () =>
      Promise.resolve([{ id: "n1", kind: "conflict", title: "Widerspruch", seen: false }]);
    await montiere();
    for (const [ausloeserId, flaecheId] of [
      ["kopfband-zahnrad", "zahnrad-menue"],
      ["kopfband-meldungen", "meldungen-menue"],
    ] as const) {
      const ausloeser = q(`[data-testid="${ausloeserId}"]`) as HTMLElement;
      await klicke(ausloeser);
      const flaeche = q(`[data-testid="${flaecheId}"]`);
      expect(flaeche?.contains(document.activeElement)).toBe(true);
      await taste(document.activeElement, "Escape");
      expect(q(`[data-testid="${flaecheId}"]`)).toBeNull();
      expect(document.activeElement).toBe(ausloeser);
    }
  });
});

// ------------------------------------------------------------------------------------------------
describe("FE-002 · Sprachvarianten", () => {
  it("S1 · EN und NL tragen eigene Wörter für alle vier Zwecke (kein deutscher Rückfall)", async () => {
    for (const [lng, soll] of [
      ["en", ["Work areas", "Search knowledge", "Find page", "Settings and help", "Notifications"]],
      [
        "nl",
        ["Werkgebieden", "Kennis zoeken", "Pagina vinden", "Instellingen en hulp", "Meldingen"],
      ],
    ] as const) {
      await act(async () => {
        await i18n.changeLanguage(lng);
      });
      expect([
        t("fe002.arbeitsbereiche"),
        t("fe002.wissenSuchen"),
        t("fe002.seiteFinden"),
        t("fe002.einstellungen"),
        t("fe002.meldungen"),
      ]).toEqual(soll);
      expect(t("fe002.meldungenUngelesen", { count: 1 })).not.toBe(
        t("fe002.meldungenUngelesen", { count: 2 }).replace("2", "1"),
      );
    }
  });
});
