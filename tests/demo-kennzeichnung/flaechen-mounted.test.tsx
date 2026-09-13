// @vitest-environment jsdom
// ================================================================================================
// JOB 3761 · D3/D4/D5 — DIE ZWEI FLÄCHEN, GEMOUNTET, UND JEDE FÜR SICH.
// ================================================================================================
//
// Pedis Satz (11.09. 17:20 über Codex, PRIORITAETEN.md/DEMO-ZUGANG-START): „und man muss ihr
// ansehen, dass sie die Demo ist und nicht das Echte". Zwei Flächen tragen das: die Anmeldemaske
// (VOR der Anmeldung — dort tippt ein Gast sein Kennwort ein und muss deshalb vorher wissen, wo er
// es eintippt) und das Kopfband (NACH der Anmeldung, auf jeder Seite).
//
// GEMESSEN WIRD AN DEN ECHTEN BAUSTEINEN: die echte `AuthScreens` (nicht `BrandPanel` allein — die
// Lücke von mega62 entstand nicht IN der Komponente, sondern an der Stelle, die sie einbindet) und
// die echte `AppShell`. Attrappen sind nur die zwei Endpunktgrenzen.
//
// EHRLICHE GRENZE, ausdrücklich: jsdom rechnet KEIN Layout. Jede Aussage hier ist eine über den
// BAUM (steht es da, in welchem Kasten, in welcher Sprache) — keine über Pixel. Dass die
// Kennzeichnung dem Firmenlogo keine Breite nimmt, wird deshalb NICHT als Messung behauptet,
// sondern an der Bauform festgehalten: sie steht in einer EIGENEN Zeile über der Kopfbandzeile
// (Fall D4c), also außerhalb des Kastens, um dessen Breite JOB 3571/3582/3641 gerungen haben.
//
//   D3a–c  Anmeldemaske, Schalter AN: die Kennzeichnung steht da — in DE, EN und NL.
//   D3d    Anmeldemaske, Schalter AUS: sie steht NICHT da, die Maske selbst schon.
//   D4a    Hülle breit (1280) mit Firmen-CI: Kennzeichnung UND Firmenlogo, beide vollständig.
//   D4b    Hülle schmal (390) mit Firmen-CI: dasselbe an der engsten zugesicherten Breite.
//   D4c    … und sie steht NICHT in der Kopfbandzeile, sondern als eigenes Geschwister davor.
//   D4d    Hülle, Schalter AUS: kein Zeichen — das Kopfband ist zeichengleich der Bestand.
//   D5     Die zwei Fälle decken sich NICHT gegenseitig: in D3 gibt es kein Kopfband, in D4 keine
//          Anmeldemaske. Entfernt man eine Fläche, bleibt der andere Fall grün.
//   Z1–Z4  Das Zustandsmodell: laden, Fehler, Schalter aus, gescheiterte Auffrischung.
//   S1     Der Sitzungswechsel verwirft die Auskunft von vor der Anmeldung wirklich.
//   E1     EIN Leser im ganzen Frontend, kein zweiter Weg an der Auskunft vorbei.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Die Schalterauskunft ist der Gegenstand dieser Datei und deshalb STELLBAR; alles andere antwortet
// leer. Bauform: `tests/navigation-schmal/kopfband-schmal.test.tsx`.
const server = vi.hoisted(() => ({
  features: { rechtsseiten: true, hinweisbanner: true } as Record<string, boolean>,
  /** Wie oft die Auskunft wirklich abgefragt wurde — für S1 und für „kein zweiter Takt". */
  abrufe: 0,
  /** Beantwortet die Auskunft NIE (Zustand „laden") bzw. mit einem Fehler. */
  modus: "antwortet" as "antwortet" | "haengt" | "fehler",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
    login: vi.fn(async () => ({ token: "t" })),
    register: vi.fn(async () => ({})),
    setup: vi.fn(async () => ({})),
    forgot: vi.fn(async () => ({})),
    logout: vi.fn(async () => ({})),
    notice: vi.fn(async () => ({ due: false })),
    acknowledgeNotice: vi.fn(async () => ({ due: false })),
    ssoStartUrl: "/api/auth/oidc/start",
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return leer();
        },
      },
    );
  const alles = leer() as Record<string, unknown>;
  return {
    endpoints: new Proxy(alles, {
      get(target, prop, recv) {
        if (prop === "features") {
          return {
            get: async () => {
              server.abrufe += 1;
              if (server.modus === "haengt") {
                return new Promise(() => {});
              }
              if (server.modus === "fehler") {
                throw new Error("Auskunft nicht erreichbar");
              }
              return { features: server.features };
            },
          };
        }
        return Reflect.get(target, prop, recv);
      },
    }),
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider, useSession } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { AuthScreens } from "../../apps/web/src/auth/AuthScreens";
import i18n from "../../apps/web/src/i18n";
import { BRANDING_UNBEKANNT, uebernimmBranding } from "../../apps/web/src/lib/brandTheme";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

/** Wertet eine Abfrage aus `min-width`/`max-width` gegen eine echte Breite aus. */
function passt(query: string, breite: number): boolean {
  let ergebnis = true;
  for (const m of query.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) {
    const grenze = Number(m[2]);
    ergebnis = ergebnis && (m[1] === "min" ? breite >= grenze : breite <= grenze);
  }
  return ergebnis;
}

function setzeBreite(breite: number): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: passt(q, breite),
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

/** Der Markenstand der Firmen-CI — wörtlich die Form aus `BrandingStand` (JOB 3510). */
const MARKE = {
  profil: "advisor" as const,
  aktiv: true,
  version: 1,
  marke: {
    name: "Advisor",
    farben: { primaer: "#0578b7", schrift: "#161417" },
    logo: "/marke/advisor/adv-logo.svg",
  },
};

let container: HTMLDivElement;
let root: Root;
let sitzung: { refresh: () => void } | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

/** Greift die echte Sitzung ab, damit S1 den ECHTEN `refresh()` benutzt und keinen nachgebauten. */
function SitzungsGriff(): null {
  sitzung = useSession();
  return null;
}

/** Die echte Providerkette aus `App.tsx` (Auth → Role → Toast → NavGuard → Router). */
async function montiere(inhalt: unknown): Promise<void> {
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
                  { initialEntries: ["/start"] },
                  createElement(SitzungsGriff),
                  inhalt as never,
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

const anmeldemaske = (): Promise<void> =>
  montiere(createElement(AuthScreens, { needsSetup: false }));

const huelle = (): Promise<void> =>
  montiere(createElement(AppShell, null, createElement("div", null, "INHALT")));

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

const zeichen = (): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('[data-testid="demo-kennzeichen"]'),
];

const in_ = (wo: string): HTMLElement | null => {
  const kasten = container.querySelector(`[data-testid="${wo}"]`);
  expect(kasten, `${wo} steht nicht`).not.toBeNull();
  return (kasten as HTMLElement).querySelector<HTMLElement>('[data-testid="demo-kennzeichen"]');
};

beforeEach(async () => {
  server.features = { rechtsseiten: true, hinweisbanner: true, demoInstanz: true };
  server.modus = "antwortet";
  server.abrufe = 0;
  sitzung = null;
  setzeBreite(1280);
  // „noch nichts bekannt" ist der Ausgangszustand der Firmen-CI (brandTheme.ts:137).
  uebernimmBranding(BRANDING_UNBEKANNT);
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------------------------------------------------------------
// D3 — DIE ANMELDEMASKE
// ------------------------------------------------------------------------------------------------
describe("JOB 3761 D3 · vor der Anmeldung sieht man es", () => {
  // Dieselbe Aussage, dieselbe Quelle, drei Sprachen — und der Text wird aus i18n GEHOLT, nicht
  // abgeschrieben: ein Fall, der „Demo-Instanz" fest erwartete, wäre bei jeder Umformulierung rot,
  // ohne dass die Zusage gebrochen wäre.
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`D3 ${sprache} · die Kennzeichnung steht auf beiden öffentlichen Bausteinen`, async () => {
      await i18n.changeLanguage(sprache);
      await anmeldemaske();

      const wort = i18n.t("demo.kennzeichen");
      // Der Schlüssel ist wirklich übersetzt und fällt nicht auf sich selbst zurück.
      expect(wort).not.toBe("demo.kennzeichen");
      expect(wort.length).toBeGreaterThan(3);

      // Die Spalte am Desktop UND der Anker für schmale Geräte — eine von beiden allein hieße:
      // auf der Hälfte der Geräte unsichtbar.
      expect(in_("auth-brand-panel"), "Kennzeichnung fehlt in der Markenspalte").not.toBeNull();
      expect(in_("auth-brand-compact"), "Kennzeichnung fehlt am schmalen Anker").not.toBeNull();
      for (const el of zeichen()) {
        expect(el.textContent).toContain(wort);
      }
      // Die Marke bleibt: NEBEN, nicht anstelle (JOB 3577).
      expect(container.textContent).toContain("KLARWERK");
      abbauen();
    });
  }

  it("D3d · KALIBRIERUNG · Schalter AUS: kein Zeichen — und die Maske steht trotzdem", async () => {
    server.features = { rechtsseiten: true, hinweisbanner: true, demoInstanz: false };
    await anmeldemaske();
    expect(zeichen()).toHaveLength(0);
    expect(container.textContent).not.toContain(i18n.t("demo.kennzeichen"));
    // Ohne diese zwei Zeilen wäre der Fall auch dann grün, wenn die Maske gar nicht gerendert hätte.
    expect(container.textContent).toContain(i18n.t("auth.title.login"));
    expect(container.querySelector("form")).not.toBeNull();
    abbauen();
  });

  it("D3e · und die echte Instanz sagt NIRGENDS das Gegenteil", async () => {
    // Kein „Produktivsystem", kein „dies ist nicht die Demo": eine solche Aussage wäre
    // zeitabhängig und nicht belegbar. Die echte Instanz schreibt gar nichts.
    server.features = { rechtsseiten: true, hinweisbanner: true, demoInstanz: false };
    await anmeldemaske();
    const text = (container.textContent ?? "").toLowerCase();
    for (const wort of ["demo", "produktiv", "production", "echtsystem"]) {
      expect(text, `„${wort}" steht auf der echten Anmeldemaske`).not.toContain(wort);
    }
    abbauen();
  });
});

// ------------------------------------------------------------------------------------------------
// D4 — DIE ANGEMELDETE HÜLLE
// ------------------------------------------------------------------------------------------------
describe("JOB 3761 D4 · nach der Anmeldung sieht man es auf jeder Seite", () => {
  for (const breite of [1280, 390]) {
    it(`D4 ${breite} px · Kennzeichnung UND Firmenlogo, beide vollständig`, async () => {
      setzeBreite(breite);
      uebernimmBranding(MARKE);
      await huelle();

      const kopf = container.querySelector<HTMLElement>('header[data-testid="kopfband"]');
      expect(kopf, "das Kopfband steht nicht").not.toBeNull();
      const band = container.querySelector<HTMLElement>('[data-testid="demo-kennzeichen"]');
      expect(band, "die Kennzeichnung fehlt in der Hülle").not.toBeNull();
      expect(band?.textContent).toContain(i18n.t("demo.kennzeichen"));

      // Die Firmen-CI ist WIRKLICH aktiv und bleibt vollständig sichtbar — das ist der Fall, den
      // der Auftrag ausdrücklich verlangt (nicht verdrängen, nicht überlappen).
      const logo = container.querySelector<HTMLImageElement>(
        '[data-testid="kopfband-firmenlogo"] img',
      );
      expect(logo, "das Firmenlogo ist fort").not.toBeNull();
      expect(logo?.getAttribute("src")).toBe(MARKE.marke.logo);
      expect(logo?.getAttribute("alt")?.length ?? 0).toBeGreaterThan(0);
      // Und die Wortmarke des Produkts steht weiter da.
      expect(kopf?.textContent).toContain("KLARWERK");
      abbauen();
    });
  }

  it("D4c · sie steht NICHT in der Kopfbandzeile, sondern als eigenes Geschwister davor", async () => {
    // Der Grund ist die Breite: die Kopfbandzeile ist an 390, 760 und 1000 px auf den Pixel
    // ausgemessen (JOB 3571/3582/3641), ihr freier Zwischenraum bei 1000 px ist gemessene 0,0 px.
    // Ein Kasten IN dieser Zeile nähme genau dort Platz weg. jsdom kann das nicht nachrechnen —
    // aber es kann festhalten, dass die Kennzeichnung gar nicht erst in dem Kasten liegt, um dessen
    // Breite es geht. Wandert sie eines Tages hinein, wird dieser Fall rot.
    setzeBreite(390);
    uebernimmBranding(MARKE);
    await huelle();
    const kopf = container.querySelector<HTMLElement>('header[data-testid="kopfband"]');
    const band = container.querySelector<HTMLElement>('[data-testid="demo-kennzeichen"]');
    expect(kopf).not.toBeNull();
    expect(band).not.toBeNull();
    expect(kopf?.contains(band as Node), "die Kennzeichnung liegt IN der Kopfbandzeile").toBe(
      false,
    );
    expect(band?.nextElementSibling, "sie steht nicht unmittelbar vor dem Kopfband").toBe(kopf);
    abbauen();
  });

  it("D4d · KALIBRIERUNG · Schalter AUS: die Hülle ist zeichengleich der Bestand", async () => {
    server.features = { rechtsseiten: true, hinweisbanner: true, demoInstanz: false };
    uebernimmBranding(MARKE);
    await huelle();
    expect(zeichen()).toHaveLength(0);
    // Kalibrierung: das Kopfband selbst ist da, der Fall misst also wirklich die Kennzeichnung.
    const kopf = container.querySelector<HTMLElement>('header[data-testid="kopfband"]');
    expect(kopf).not.toBeNull();
    expect(kopf?.previousElementSibling, "es steht noch etwas vor dem Kopfband").toBeNull();
    abbauen();
  });
});

// ------------------------------------------------------------------------------------------------
// D5 — DIE ZWEI FÄLLE DECKEN SICH NICHT GEGENSEITIG
// ------------------------------------------------------------------------------------------------
describe("JOB 3761 D5 · zwei Flächen, zwei unabhängig beißende Fälle", () => {
  it("D5a · in der Anmeldemaske-Montage gibt es gar kein Kopfband", async () => {
    await anmeldemaske();
    expect(container.querySelector('[data-testid="kopfband"]')).toBeNull();
    expect(zeichen().length).toBeGreaterThan(0);
    abbauen();
  });

  it("D5b · in der Hüllen-Montage gibt es gar keine Anmeldemaske", async () => {
    await huelle();
    expect(container.querySelector('[data-testid="auth-brand-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="auth-brand-compact"]')).toBeNull();
    expect(zeichen().length).toBeGreaterThan(0);
    abbauen();
  });
});

// ------------------------------------------------------------------------------------------------
// Z — DAS ZUSTANDSMODELL DER AUSSAGE „DAS IST DIE DEMO"
// ------------------------------------------------------------------------------------------------
describe("JOB 3761 Z · die Aussage hängt an ihrer Voraussetzung", () => {
  it("Z1 · LADEN: eine unbeantwortete Auskunft ist weder „Demo“ noch „keine Demo“", async () => {
    server.modus = "haengt";
    await anmeldemaske();
    // Kein Zeichen, kein Platzhalter, kein Skelett — und nichts, was danach springt.
    expect(zeichen()).toHaveLength(0);
    expect(container.querySelector('[data-testid="auth-brand-panel"]')).not.toBeNull();
    abbauen();
  });

  it("Z2 · FEHLER: eine gescheiterte Auskunft behauptet nichts", async () => {
    server.modus = "fehler";
    await anmeldemaske();
    expect(zeichen()).toHaveLength(0);
    // Und es entsteht kein Fehlerbanner für diese Kleinigkeit: die Maske bleibt, wie sie ist.
    expect(container.textContent).toContain(i18n.t("auth.title.login"));
    abbauen();
  });

  it("Z3 · Fehler in der HÜLLE: kein Zeichen, aber auch kein Bruch", async () => {
    server.modus = "fehler";
    uebernimmBranding(MARKE);
    await huelle();
    expect(zeichen()).toHaveLength(0);
    expect(container.querySelector('header[data-testid="kopfband"]')).not.toBeNull();
    abbauen();
  });

  it("Z4 · GESCHEITERTE AUFFRISCHUNG: der bestätigte Stand bleibt stehen", async () => {
    // Erst ein bestätigter Stand …
    await anmeldemaske();
    expect(zeichen().length).toBeGreaterThan(0);
    const vorher = server.abrufe;
    // … dann scheitert jede weitere Abfrage. Die Kennzeichnung darf davon nicht verschwinden:
    // eine gescheiterte Auffrischung nimmt keine bestätigte Aussage zurück.
    server.modus = "fehler";
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await flush();
    });
    expect(zeichen().length, "die bestätigte Aussage ist weggefallen").toBeGreaterThan(0);
    expect(server.abrufe, "unerwarteter zweiter Takt auf die Auskunft").toBe(vorher);
    abbauen();
  });
});

// ------------------------------------------------------------------------------------------------
// S1 — DER SITZUNGSWECHSEL (Prüfpunkt 6b des Auftrags)
// ------------------------------------------------------------------------------------------------
describe("JOB 3761 S · die Teilmenge von vor der Anmeldung bleibt nicht hängen", () => {
  it("S1 · `refresh()` verwirft die Schalter-Auskunft und holt sie neu", async () => {
    // Vor der Anmeldung antwortet der Server mit der TEILMENGE (`schalterZustandVorAnmeldung`).
    server.features = { rechtsseiten: true, hinweisbanner: true, demoInstanz: true };
    await anmeldemaske();
    expect(server.abrufe, "die Auskunft wurde gar nicht geholt").toBe(1);
    expect(zeichen().length).toBeGreaterThan(0);

    // Nach dem Anmelden ruft `AuthContext.tsx:237` genau diesen `refresh()`. Er wird hier über den
    // ECHTEN Sitzungskontext ausgelöst, nicht nachgebaut.
    expect(sitzung, "kein Sitzungskontext").not.toBeNull();
    server.features = { ...server.features, herkunft: true, demoInstanz: false };
    await act(async () => {
      sitzung?.refresh();
      await flush();
    });
    expect(server.abrufe, "die Auskunft blieb im Zwischenspeicher hängen").toBe(2);
    // Und die Fläche folgt der NEUEN Antwort statt der alten.
    expect(zeichen()).toHaveLength(0);
    abbauen();
  });
});

// ------------------------------------------------------------------------------------------------
// E1 — EIN LESER, KEIN ZWEITER WEG
// ------------------------------------------------------------------------------------------------
describe("JOB 3761 E · ein Schalter, ein Leser, eine Auskunft", () => {
  const WURZEL = join(__dirname, "..", "..");

  function quelldateien(verzeichnis: string): string[] {
    const gefunden: string[] = [];
    for (const eintrag of readdirSync(join(WURZEL, verzeichnis))) {
      if (eintrag === "node_modules" || eintrag === "dist" || eintrag.startsWith(".")) {
        continue;
      }
      const relativ = join(verzeichnis, eintrag);
      if (statSync(join(WURZEL, relativ)).isDirectory()) {
        gefunden.push(...quelldateien(relativ));
      } else if (
        (relativ.endsWith(".ts") || relativ.endsWith(".tsx")) &&
        !relativ.includes(".test.")
      ) {
        gefunden.push(relativ);
      }
    }
    return gefunden;
  }

  it("E1 · genau EINE Stelle im Frontend liest diesen Schalter aus der Auskunft", async () => {
    const dateien = quelldateien(join("apps", "web", "src"));
    expect(dateien.length, "kein Quellbaum gefunden").toBeGreaterThan(100);
    const leser = dateien.filter((d) =>
      readFileSync(join(WURZEL, d), "utf8").includes("features?.demoInstanz"),
    );
    // Zwei Flächen, aber EIN Leser — sonst driften sie auseinander, sobald jemand eine anfasst.
    expect(leser).toEqual([join("apps", "web", "src", "auth", "BrandPanel.tsx")]);
  });

  it("E1b · und niemand baut sich die Aussage aus etwas anderem zusammen", async () => {
    const dateien = quelldateien(join("apps", "web", "src"));
    // Nur CODE, keine Erklärtexte: die Adresse `demo.klarwerk.io` steht zu Recht in Kommentaren
    // (sie ist der Anlass dieses Auftrags). Ein Muster, das sie dort fände, meldete einen Fehler,
    // den es nicht gibt — dieselbe Unterscheidung, die `mega46-schalter-eine-wahrheit` trifft.
    const ohneKommentar = (quelle: string): string =>
      quelle
        .split("\n")
        .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
        .join("\n");
    let geprueft = 0;
    for (const datei of dateien) {
      const code = ohneKommentar(readFileSync(join(WURZEL, datei), "utf8"));
      geprueft += 1;
      // Nicht aus dem Demodaten-Werkzeug (zwei verschiedene Aussagen) …
      expect(code, `${datei} leitet die Demo-Aussage aus demodaten ab`).not.toContain(
        "features?.demodaten",
      );
      // … und nicht aus der Adresszeile: eine Instanz, die sich an ihrem Namen erkennt, wäre bei
      // jeder neuen Adresse still falsch.
      expect(code, `${datei} liest die Demo-Aussage aus der Adresse`).not.toContain(
        "demo.klarwerk",
      );
    }
    expect(geprueft, "die Erhebung hat gar nichts gelesen").toBeGreaterThan(100);
  });
});
