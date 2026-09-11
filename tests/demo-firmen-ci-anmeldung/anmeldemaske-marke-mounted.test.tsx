// @vitest-environment jsdom
// ================================================================================================
// JOB 3577 · M — DIE ANMELDEMASKE UND DIE FIRMEN-CI, GEMOUNTET.
// ================================================================================================
//
// Die Anmeldemaske ist bei der Vorführung die ERSTE Fläche, die ein Gast sieht. Bis JOB 3577 war
// sie die einzige, die der Markenwahl der Installation widersprochen hat: überall das
// Advisor-Zeichen, dort weiterhin nur KLARWERK.
//
// Gemessen wird an den ECHTEN Bausteinen `BrandPanel` und `BrandCompact` (beide rendern denselben
// Helfer `Wortmarke`), mit echtem React und echtem i18n. Die einzige Attrappe ist die
// Endpunktgrenze `api/client` — Bauform wie tests/demo-firmen-ci-web/admin-flaeche-mounted.test.tsx.
// Der Markenstand wird über `uebernimmBranding` gesetzt, den Weg, den die Adminfläche nach ihrem
// PUT selbst nimmt (`brandTheme.ts:207`), nicht über einen erfundenen Zugang.
//
//   M0   Noch nicht bekannt   Reine Wortmarke, kein Platzhalter, kein Skelett — die GRUNDFORM,
//                             gegen die alle „aus"-Fälle zeichengleich geprüft werden.
//   M1   Die Spalte           Logo neben der Wortmarke, Alternativtext und Adresse aus dem Vertrag.
//   M2   Der schmale Anker    Dasselbe — eine Änderung an EINER Stelle, nicht zwei.
//   M3   Kein zweiter Abruf   Das Mounten löst NULL Anfragen aus …
//   M3b  … und keine Absicht  … und im Quellbaum der öffentlichen Strecke steht kein Abrufweg.
//   M4   Ohne Neuladen        Umschalten wirkt am offenen Fenster — und Zurückschalten ist wieder
//                             zeichengleich die Grundform.
//   M5a–c Aus / halb / -1     Schalter ohne Profil, Profil ohne Schalter, Server ohne die Route.
//   M6   Gescheiterte Frische Ein ECHT gescheiterter Hintergrundabruf über bestätigtem Stand.
//   M7   Laufende Frische     Während der Abruf läuft, flackert nichts.
//   M8   Offline              Offline-Zustand VOR dem Mounten, danach ein echter Fehlabruf.
//   M9   Die Datei            Die vom Vertrag genannte Adresse liegt wirklich im Baum.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

// `ApiError` bleibt die ECHTE Klasse: die 404-Unterscheidung in `ladeBranding` hängt an
// `instanceof`, und eine nachgebaute Klasse führte genau daran vorbei.
vi.mock("../../apps/web/src/api/client", async (echt) => ({
  ...(await echt<typeof import("../../apps/web/src/api/client")>()),
  api: { get: d.get, put: d.put },
}));

import { Fragment, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { BrandCompact, BrandPanel } from "../../apps/web/src/auth/BrandPanel";
// Nebenwirkung: initialisiert die eine i18next-Instanz, aus der beide Bausteine ihre Texte holen.
import "../../apps/web/src/i18n";
import type { BrandingStand } from "../../apps/web/src/lib/brandTheme";
import {
  BRANDING_MINDESTABSTAND_MS,
  BRANDING_UNBEKANNT,
  aktuellesBranding,
  initBrandTheme,
  uebernimmBranding,
} from "../../apps/web/src/lib/brandTheme";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LOGO_PFAD = "/marke/advisor/adv-logo.svg";
const LOGO_ALT = "Advisor ICT solutions logo";

/** Wörtlich die Form aus dem Vertrag (`BrandingStand`, JOB 3510). */
const stand = (teile: Partial<BrandingStand> = {}): BrandingStand => ({
  profil: "advisor",
  aktiv: true,
  version: 1,
  marke: {
    name: "Advisor",
    farben: { primaer: "#0578b7", schrift: "#161417" },
    logo: LOGO_PFAD,
  },
  ...teile,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Beide öffentlichen Bausteine zusammen — so stehen sie auch in `AuthScreens.tsx:84,88`. */
async function stelleAuf(): Promise<void> {
  await act(async () => {
    root.render(
      createElement(Fragment, null, createElement(BrandPanel), createElement(BrandCompact)),
    );
  });
}

const flaeche = (testId: string): HTMLElement => {
  const el = container.querySelector(`[data-testid="${testId}"]`);
  expect(el, testId).not.toBeNull();
  return el as HTMLElement;
};

const panel = (): HTMLElement => flaeche("auth-brand-panel");
const kompakt = (): HTMLElement => flaeche("auth-brand-compact");

const bild = (wo: HTMLElement): HTMLImageElement | null =>
  wo.querySelector('[data-testid="auth-firmenlogo"] img');

function baueAuf(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
}

async function raeumeAb(): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

// ------------------------------------------------------------------------------------------------
// DIE GRUNDFORM — der Zustand „noch gar nichts bekannt", und warum er VOR allem anderen erfasst wird.
// ------------------------------------------------------------------------------------------------
// `aktuellesBranding()` ist genau EINMAL im Leben des Moduls `null`: vor dem ersten
// `uebernimmBranding`. Es gibt keinen Weg zurück dorthin, und das ist richtig so — ein Rücksetzer
// wäre ein zweiter Schreibweg neben dem einen des Moduls. Deshalb wird die Grundform hier vor dem
// ersten Fall abgenommen; M0 belegt mit `standBeimErfassen`, dass das wirklich der Nullzustand war,
// statt es zu behaupten.
let grundform: { panel: string; kompakt: string } | null = null;
let standBeimErfassen: BrandingStand | null | undefined;

beforeAll(async () => {
  standBeimErfassen = aktuellesBranding();
  baueAuf();
  await stelleAuf();
  grundform = { panel: panel().outerHTML, kompakt: kompakt().outerHTML };
  await raeumeAb();
});

beforeEach(() => {
  d.get.mockReset();
  d.put.mockReset();
  // Kein Fall dieser Datei erwartet einen Abruf aus der Fläche heraus; wer doch einen auslöst,
  // bekommt einen Fehler statt eines stillen `undefined`.
  d.get.mockRejectedValue(new Error("kein Abruf aus der Flaeche erwartet"));
  baueAuf();
});

afterEach(async () => {
  await raeumeAb();
  // Der Stand lebt im Modul; jeder Fall stellt ihn selbst her, der letzte räumt auf.
  uebernimmBranding(stand({ profil: null, aktiv: false, version: 0, marke: null }));
});

describe("JOB 3577 M · die Anmeldemaske trägt die Firmen-CI mit", () => {
  it("M0 · noch nicht bekannt: reine Wortmarke, kein Platzhalter, kein Aufblitzen", () => {
    expect(
      standBeimErfassen,
      "die Grundform wurde NICHT im Nullzustand erfasst — der Vergleich in M4/M5 wäre wertlos",
    ).toBeNull();
    const form = grundform as { panel: string; kompakt: string };
    for (const [name, html] of Object.entries(form)) {
      expect(html, `${name}: die Produktidentität`).toContain("KLARWERK");
      expect(html, `${name}: der Untertitel`).toContain("Reasoning System");
      expect(html, `${name}: ein Bild ohne bekannten Markenstand`).not.toContain("<img");
      expect(html, `${name}: ein Platzhalter für das Logo`).not.toContain("auth-firmenlogo");
      expect(html, `${name}: ein Skelett`).not.toMatch(/animate-pulse|skeleton/i);
    }
  });

  it("M1 · die Markenspalte trägt das Logo NEBEN der Wortmarke", async () => {
    uebernimmBranding(stand());
    await stelleAuf();
    const img = bild(panel());
    expect(img, "kein Firmenlogo, obwohl die Firmen-CI aktiv ist").not.toBeNull();
    expect(img?.getAttribute("src"), "die Adresse kommt aus dem Vertrag").toBe(LOGO_PFAD);
    expect(img?.getAttribute("alt"), "der Alternativtext kommt aus BRAND_LOGO_ALT").toBe(LOGO_ALT);
    // NEBEN, NICHT ANSTELLE — Pedis Auflage, ausführbar gemacht.
    expect(panel().textContent).toContain("KLARWERK");
    expect(panel().textContent).toContain("Reasoning System");
    // Die Domainzeile bleibt unangetastet.
    expect(panel().textContent).toContain("klarwerk.ai");
  });

  it("M2 · der schmale Anker trägt dasselbe — eine Stelle für beide", async () => {
    uebernimmBranding(stand());
    await stelleAuf();
    const img = bild(kompakt());
    expect(
      img,
      "kein Firmenlogo auf schmaler Breite — die Vorführung am Telefon fiele auf",
    ).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(LOGO_PFAD);
    expect(img?.getAttribute("alt")).toBe(LOGO_ALT);
    expect(kompakt().textContent).toContain("KLARWERK");
    expect(kompakt().textContent).toContain("Reasoning System");
  });

  it("M3 · das Mounten löst KEINEN eigenen Abruf aus", async () => {
    uebernimmBranding(stand());
    d.get.mockClear();
    d.put.mockClear();
    await stelleAuf();
    // Beide Flächen sind wirklich da — sonst prüfte dieser Fall nur, dass nichts gerendert wurde.
    expect(bild(panel())).not.toBeNull();
    expect(bild(kompakt())).not.toBeNull();
    expect(d.get, "die Anmeldemaske fragt den Markenstand selbst ab").not.toHaveBeenCalled();
    expect(d.put).not.toHaveBeenCalled();
  });

  it("M3b · und im Quellbaum der öffentlichen Strecke steht überhaupt kein Abrufweg", () => {
    // M3 misst den Mountvorgang. Dieser Fall deckt die Absicht: ein Abruf, der an einem Klick oder
    // einer Bedingung hinge, käme im Mount nicht vor und wäre trotzdem der zweite Takt, den
    // `brandTheme.ts:187-189` ausschließt.
    const wurzel = join(__dirname, "..", "..", "apps", "web", "src", "auth");
    // Die dateilokalen Tests bleiben draußen: eine Attrappe auf `api.get` IN einem Test ist kein
    // Abrufweg der Fläche, und dieser Fall misst die Fläche.
    const dateien = readdirSync(wurzel).filter(
      (f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.includes(".test."),
    );
    expect(dateien.length, "kein Quellbaum gefunden — der Pfad stimmt nicht mehr").toBeGreaterThan(
      0,
    );
    for (const datei of dateien) {
      const quelle = readFileSync(join(wurzel, datei), "utf8");
      for (const weg of ["ladeBranding", "useQuery", "api.get"]) {
        expect(quelle, `${datei} holt den Markenstand selbst (${weg})`).not.toContain(weg);
      }
    }
  });

  it("M4 · Umschalten wirkt ohne Neuladen — und Zurückschalten ist wieder die Grundform", async () => {
    await stelleAuf();
    expect(bild(panel())).toBeNull();
    await act(async () => {
      uebernimmBranding(stand({ version: 2 }));
    });
    expect(bild(panel())?.getAttribute("alt")).toBe(LOGO_ALT);
    expect(bild(kompakt())?.getAttribute("alt")).toBe(LOGO_ALT);
    await act(async () => {
      uebernimmBranding(stand({ aktiv: false, version: 3 }));
    });
    const form = grundform as { panel: string; kompakt: string };
    expect(panel().outerHTML, "zurückgeschaltet ist die Spalte nicht mehr die alte").toBe(
      form.panel,
    );
    expect(kompakt().outerHTML, "zurückgeschaltet ist der Anker nicht mehr der alte").toBe(
      form.kompakt,
    );
  });

  it("M5a · Profil ohne Schalter: zeichengleich die Grundform", async () => {
    uebernimmBranding(stand({ aktiv: false, version: 5 }));
    await stelleAuf();
    const form = grundform as { panel: string; kompakt: string };
    expect(panel().outerHTML).toBe(form.panel);
    expect(kompakt().outerHTML).toBe(form.kompakt);
  });

  it("M5b · Schalter ohne Profil: zeichengleich die Grundform", async () => {
    uebernimmBranding(stand({ profil: null, aktiv: true, marke: null, version: 6 }));
    await stelleAuf();
    const form = grundform as { panel: string; kompakt: string };
    expect(panel().outerHTML).toBe(form.panel);
    expect(kompakt().outerHTML).toBe(form.kompakt);
  });

  it("M5c · ein Server ohne die Route (version −1): zeichengleich die Grundform", async () => {
    uebernimmBranding(BRANDING_UNBEKANNT);
    await stelleAuf();
    const form = grundform as { panel: string; kompakt: string };
    expect(panel().outerHTML).toBe(form.panel);
    expect(kompakt().outerHTML).toBe(form.kompakt);
  });

  it("M9 · die vom Vertrag genannte Adresse liegt wirklich im ausgelieferten Baum", () => {
    // Ohne diesen Fall wäre M1 grün, während die Anmeldemaske ein totes Bild zeigt.
    expect(existsSync(join(__dirname, "..", "..", "apps", "web", "public", LOGO_PFAD))).toBe(true);
  });
});

// ================================================================================================
// DIE ZUSTÄNDE DES ABRUFS — mit ECHT erzeugten Läufen, nicht mit dem ersten Laden gleichgesetzt.
// ================================================================================================
//
// `frischeMarke` ist nicht exportiert, und das soll so bleiben. Ausgelöst wird sie deshalb über den
// ECHTEN Weg, den `initBrandTheme` anmeldet: den Fokus-Hörer am Fenster. Seine beiden Riegel sind
// die Drosselung (eine Minute, `brandTheme.ts:236`) und `laeuft`; die Uhr wird für den Anlass über
// die Drosselung hinausgestellt und danach sofort zurückgegeben.
let uhrSchritte = 0;

async function abrufAusloesen(): Promise<void> {
  uhrSchritte += 1;
  const echtJetzt = Date.now();
  const uhr = vi
    .spyOn(Date, "now")
    .mockReturnValue(echtJetzt + uhrSchritte * 5 * BRANDING_MINDESTABSTAND_MS);
  try {
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flush();
    });
  } finally {
    uhr.mockRestore();
  }
}

describe("JOB 3577 M · die Zustände des Abrufs auf der öffentlichen Strecke", () => {
  beforeAll(async () => {
    // Der eine Aufruf im Leben dieser Datei — `initBrandTheme` ist idempotent. Sein erzwungener
    // Erstabruf scheitert absichtlich: er darf keinen Stand mitbringen, den ein Fall später für
    // seinen eigenen hält.
    d.get.mockRejectedValue(new Error("Start ohne Serverweg"));
    initBrandTheme();
    await flush();
  });

  it("M6 · eine WIRKLICH gescheiterte Auffrischung leert nichts und behauptet nichts", async () => {
    uebernimmBranding(stand({ version: 10 }));
    await stelleAuf();
    expect(bild(panel()), "Vorbedingung: das Logo steht").not.toBeNull();
    d.get.mockRejectedValue(new Error("kaputt"));
    await abrufAusloesen();
    expect(
      d.get,
      "der Abruf hat gar nicht stattgefunden — der Fall prüft nichts",
    ).toHaveBeenCalled();
    expect(bild(panel())?.getAttribute("alt"), "der bestätigte Stand wurde geleert").toBe(LOGO_ALT);
    expect(bild(kompakt())?.getAttribute("alt")).toBe(LOGO_ALT);
    // Ehrlichkeit vor Optik: die Anmeldemaske sagt in KEINEM Zustand etwas über die Marke aus.
    expect(panel().textContent).not.toMatch(/nicht abrufbar|Fehler|Erneut versuchen/i);
    expect(kompakt().textContent).not.toMatch(/nicht abrufbar|Fehler|Erneut versuchen/i);
  });

  it("M7 · während eine Auffrischung läuft, flackert nichts — und die Antwort zieht nach", async () => {
    uebernimmBranding(stand({ version: 20 }));
    await stelleAuf();
    let aufloesen: ((s: BrandingStand) => void) | null = null;
    d.get.mockReturnValue(
      new Promise<BrandingStand>((r) => {
        aufloesen = r;
      }),
    );
    await abrufAusloesen();
    // Der hängende Abruf wird IN JEDEM FALL aufgelöst, auch wenn eine Erwartung darunter wirft:
    // ein für immer laufender Abruf ließe `laeuft` in `brandTheme.ts:239` stehen und nähme dem
    // nächsten Fall (M8) seinen Abrufweg — ein roter Fall würde einen zweiten mitreißen.
    try {
      expect(d.get).toHaveBeenCalled();
      expect(aufloesen, "der Abruf hängt gar nicht — der Fall prüft nichts").not.toBeNull();
      // Mitten im laufenden Abruf: unverändert, kein Aufblitzen, keine Meldung.
      expect(bild(panel())?.getAttribute("src")).toBe(LOGO_PFAD);
      expect(bild(kompakt())?.getAttribute("src")).toBe(LOGO_PFAD);
    } finally {
      await act(async () => {
        (aufloesen as ((s: BrandingStand) => void) | null)?.(stand({ aktiv: false, version: 21 }));
        await flush();
      });
    }
    const form = grundform as { panel: string; kompakt: string };
    expect(panel().outerHTML, "die eingetroffene Antwort wirkt nicht").toBe(form.panel);
  });

  it("M8 · offline: wie ein gescheiterter Abruf — der Zustand steht VOR dem Mounten", async () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    try {
      expect(window.navigator.onLine, "Vorbedingung: offline").toBe(false);
      uebernimmBranding(stand({ version: 30 }));
      await stelleAuf();
      d.get.mockRejectedValue(new TypeError("Failed to fetch"));
      await abrufAusloesen();
      expect(d.get).toHaveBeenCalled();
      expect(bild(panel())?.getAttribute("alt")).toBe(LOGO_ALT);
      expect(panel().textContent).not.toMatch(/offline|nicht abrufbar|Fehler/i);
      expect(kompakt().textContent).not.toMatch(/offline|nicht abrufbar|Fehler/i);
    } finally {
      Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    }
  });
});
