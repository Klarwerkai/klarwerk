// @vitest-environment jsdom
// WP-UX-WOW-1 U9 (Mounted): /import leitet bei ausgeschalteter Stufe 2 NICHT mehr still auf /start
// um — es erscheint die erklärende Karte („Erweiterte Funktionen (Stufe 2)") mit Einschalt-Knopf.
// Der Knopf setzt den BESTEHENDEN Toggle (RoleContext.setStufe2) und zeigt danach das echte
// Import-Cockpit. Aufbau: echte Provider (Auth/Role) mit gemockter Admin-Session, echte Bausteine
// (roleAllows, Stage2Notice, ImportReview); der Host spiegelt die drei Guard-Zeilen aus routes.tsx
// — deren Original per Quelltext-Pin gesichert ist (routes.tsx importiert ALLE Seiten und bliebe
// im Gate-tsc sonst außen vor).
//
// R-1030 (BEN, Nacharbeit 5): der zweite Block unten montiert die ECHTEN Routen (`AppRoutes` aus
// `routes.tsx`, kein Spiegel) für alle vier Bereiche der zweiten Stufe — /import, /graph, /kapital,
// /output — und prüft je Route: Stufe 2 aus (erklärende Karte, Einschalten führt auf die Seite),
// Stufe 2 an (Seite da), Rollenbegrenzung (Nicht-Admin bekommt die Rollenkarte), die Seitenhilfe
// der Seite im echten Zahnrad-Menü und Klaras Seitenerklärung im echten Assistenten.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sitzung = vi.hoisted(() => ({ rolle: "admin" }));

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      me: vi.fn(async () => ({ id: "u1", name: "Pedi", role: sitzung.rolle })),
    },
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => {
  // Was dieser Prüfstand nicht ausdrücklich beantwortet, SCHEITERT — ehrlich und sofort, statt
  // `undefined` zu liefern. Die vier Seiten müssen ihre Fläche, ihre Seitenhilfe und ihr Tor auch
  // dann tragen, wenn kein einziger Wert abrufbar ist (Bauform aus
  // `tests/seitenhilfe-navkapitel/weitere-kapitel-am-seitenverhalten.test.tsx`, dort mit Leerwert).
  const ohneNetz = (): unknown =>
    new Proxy(
      vi.fn(async () => {
        throw new Error("kein Netz in diesem Prüfstand");
      }),
      {
        get(ziel, name, empfaenger) {
          if (name in ziel || typeof name === "symbol") {
            return Reflect.get(ziel, name, empfaenger);
          }
          return ohneNetz();
        },
      },
    );
  const mit = (echt: Record<string, unknown>): unknown =>
    new Proxy(echt, {
      get(ziel, name, empfaenger) {
        if (name in ziel || typeof name === "symbol") {
          return Reflect.get(ziel, name, empfaenger);
        }
        return ohneNetz();
      },
    });
  return {
    endpoints: mit({
      library: mit({ importCandidates: mit({ list: vi.fn(async () => []) }) }),
      admin: mit({ import: mit({}) }),
      // AUFTRAG-mega67 Block C/D: die Import-Seite fragt jetzt (als Admin) den Zugangs-Zustand ab.
      // Dieser Test prüft das Stufe-2-Tor, nicht den Zugang — er antwortet deshalb ehrlich mit
      // „nicht eingeschaltet, nichts hinterlegt", statt den Aufruf ins Leere laufen zu lassen.
      importAccess: mit({
        confluence: vi.fn(async () => ({
          system: "confluence",
          enabled: false,
          credentials: [],
          credentialsUsable: false,
          blocker: "missing",
          lastConnectedAt: null,
        })),
      }),
    }),
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider, useSession } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS, roleAllows } from "../../apps/web/src/app/navigation";
import { KlaraAssistant } from "../../apps/web/src/components/KlaraAssistant";
import { RoleNotice, Stage2Notice } from "../../apps/web/src/components/Stage2Notice";
import i18n from "../../apps/web/src/i18n";
import { ImportReview } from "../../apps/web/src/pages/Stufe2";
import { AppRoutes } from "../../apps/web/src/routes";
import { SeitenhilfeProvider } from "../../apps/web/src/shell/SeitenhilfeContext";
import { ZahnradMenue } from "../../apps/web/src/shell/ZahnradMenue";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const IMPORT_ITEM = ALL_ITEMS.find((item) => item.id === "import");
if (!IMPORT_ITEM) {
  throw new Error("Nav-Item import fehlt");
}

// Spiegel der drei Guard-Zeilen aus routes.tsx (per Quelltext-Pin unten ans Original gebunden).
// AUFTRAG-mega70 BLOCK A: der Rollenfall ist im Original keine stille Umleitung mehr, sondern
// RoleNotice — der Spiegel zieht mit (dieser Test fährt als Admin, der Zweig greift hier nie).
function GuardedImport(): JSX.Element {
  const { role, stufe2 } = useRole();
  if (!IMPORT_ITEM) {
    return createElement(Navigate, { to: "/start", replace: true });
  }
  if (!roleAllows(IMPORT_ITEM, role)) {
    return createElement(RoleNotice, { item: IMPORT_ITEM });
  }
  if (IMPORT_ITEM.stufe2 && !stufe2) {
    return createElement(Stage2Notice);
  }
  return createElement(ImportReview);
}

// Spiegel des App.tsx-Gates: Routen erst mit aufgelöster Session (sonst leitete die noch leere
// Session mit Preview-Rolle vorschnell um).
function GatedRoutes(): JSX.Element | null {
  const session = useSession();
  if (session.isLoading || !session.user) {
    return null;
  }
  return createElement(
    Routes,
    null,
    createElement(Route, { path: "/import", element: createElement(GuardedImport) }),
    createElement(Route, {
      path: "/start",
      element: createElement("div", null, "START-MARKER"),
    }),
  );
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
// Ob gerade etwas montiert ist — der Abbau unten darf nur abbauen, was steht.
let montiert = false;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  montiert = true;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
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
                { initialEntries: ["/import"] },
                createElement(GatedRoutes),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

afterEach(() => {
  if (montiert) {
    act(() => {
      root.unmount();
    });
    container.remove();
    montiert = false;
  }
  vi.clearAllMocks();
});

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Text ${part} nicht gefunden`);
  }
  return btn;
}

describe("WP-UX-WOW-1 U9: Stufe-2-Karte statt stiller Umleitung", () => {
  it("Stufe 2 aus + /import → erklärende Karte; der Knopf schaltet ein und zeigt das Cockpit", async () => {
    mount();
    // Auth auflösen lassen (status, dann me — zwei Query-Runden), dann rendert der Guard.
    for (let i = 0; i < 5 && !(container.textContent ?? "").includes("Stufe 2"); i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 25));
      });
    }
    // KEINE stille Umleitung: die Karte erklärt die Lage und bietet beide Wege an.
    expect(container.textContent).not.toContain("START-MARKER");
    expect(container.textContent).toContain("Erweiterte Funktionen (Stufe 2)");
    expect(container.textContent).toContain("Stufe 2 jetzt einschalten");
    expect(container.textContent).toContain("Zurück zum Start");
    // Das Cockpit ist noch NICHT da.
    expect(container.textContent).not.toContain("Gruppen freigeben");

    // Einschalten → derselbe bestehende Toggle wie in der Sidebar → das Cockpit erscheint.
    await act(async () => {
      buttonByText("Stufe 2 jetzt einschalten").click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(container.textContent).not.toContain("Stufe 2 jetzt einschalten");
    // Import-Cockpit sichtbar: Fünf-Schritte-Leiste (COCKPIT-LINIE) inkl. Schritt 4.
    expect(container.textContent).toContain("Gruppen freigeben");
    expect(container.textContent).toContain("Quelle");
  });

  it("routes.tsx trägt exakt diese Gate-Logik (Rollen-Gate → RoleNotice, Stufe-2 → Karte)", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/routes.tsx"), "utf8");
    expect(src).toContain("if (!roleAllows(item, role)) {");
    expect(src).toContain("return <RoleNotice item={item} />;");
    expect(src).toContain("if (item.stufe2 && !stufe2) {");
    expect(src).toContain("return <Stage2Notice />;");
    // Die alte stille Kombi-Umleitung (canSee) ist aus dem Guard verschwunden.
    expect(src).not.toContain("canSee(item, role, stufe2)");
  });
});

// ================================================================================================
// R-1030 · ALLE VIER BEREICHE DER ZWEITEN STUFE, AN DEN ECHTEN ROUTEN.
// ================================================================================================
//
// Kein Spiegel des Guards: gemountet wird `AppRoutes` selbst. Einzige Nachbildung ist die Hülle
// aus `App.tsx`, die Routen erst mit aufgelöster Sitzung zeigt (wie `GatedRoutes` oben) — sie
// entscheidet nichts über Stufe 2 oder Rolle. Daneben stehen das ECHTE Zahnrad-Menü mit dem ECHTEN
// Seitenhilfe-Sammler und der ECHTE Klara-Assistent, also genau das, was ein Mensch auf der Seite
// öffnet.
const STUFE2_SCHLUESSEL = "kw.stufe2.v1";

const BEREICHE = [
  { pfad: "/import", navKey: "nav.import", hilfe: "import", klara: "zweitestufe.klara.import" },
  { pfad: "/graph", navKey: "nav.graph", hilfe: "graph", klara: "zweitestufe.klara.graph" },
  {
    pfad: "/kapital",
    navKey: "nav.capital",
    hilfe: "kapital",
    klara: "zweitestufe.klara.kapital",
  },
  { pfad: "/output", navKey: "nav.output", hilfe: "output", klara: "zweitestufe.klara.output" },
] as const;

beforeEach(() => {
  sitzung.rolle = "admin";
  window.localStorage.removeItem(STUFE2_SCHLUESSEL);
  Element.prototype.scrollIntoView = () => {};
});

function MitSitzung(): JSX.Element | null {
  const session = useSession();
  if (session.isLoading || !session.user) {
    return null;
  }
  return createElement(AppRoutes);
}

function montiereEcht(pfad: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  montiert = true;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
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
                { initialEntries: [pfad] },
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    ImageDescribeProvider,
                    null,
                    createElement(
                      SeitenhilfeProvider,
                      null,
                      createElement(ZahnradMenue),
                      createElement(MitSitzung),
                      createElement(KlaraAssistant),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

function abbauenEcht(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
  montiert = false;
}

/** Auf einen Zustand warten, nicht auf eine Zahl von Takten (die Seiten laden `lazy`). */
async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    if (bedingung()) {
      return;
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
  throw new Error(`Zustand nie erreicht: ${was}`);
}

const text = (): string => container.textContent ?? "";
const t = (key: string): string => i18n.t(key);

async function klicke(el: Element | null | undefined, was: string): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Bedienelement fehlt: ${was}`);
  }
  await act(async () => {
    el.click();
    await new Promise((r) => setTimeout(r, 10));
  });
}

/** Öffnet Zahnrad → Seitenhilfe und gibt den Text der Seitenhilfe-Liste zurück. */
async function seitenhilfe(): Promise<string> {
  await klicke(container.querySelector('[data-testid="kopfband-zahnrad"]'), "Zahnrad");
  await klicke(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'), "Seitenhilfe");
  return container.querySelector('[data-testid="seitenhilfe-liste"]')?.textContent ?? "";
}

/** Öffnet Klara und gibt den Text des ganzen Containers (samt Panel) zurück. */
async function klara(): Promise<string> {
  await klicke(container.querySelector('button[data-klara="1"]'), "Klara-Knopf");
  return text();
}

/** Die Seite ist da: Stufe-2-Kopf mit dem Namen des Bereichs, keine Torkarte. */
const seiteDa = (navKey: string): boolean =>
  text().includes(t("s2.kicker")) &&
  text().includes(t(navKey)) &&
  !text().includes(t("stage2.gate.title"));

describe("R-1030 · Import, Wissensgraph, Kapital und Auswertungen — echte Routen", () => {
  it("Stufe 2 aus: jede Route zeigt die erklärende Karte, Einschalten führt auf die echte Seite", async () => {
    for (const b of BEREICHE) {
      montiereEcht(b.pfad);
      await warteBis(() => text().includes(t("stage2.gate.title")), `${b.pfad}: Torkarte`);
      expect(seiteDa(b.navKey), `${b.pfad}: Seite trotz Stufe 2 aus`).toBe(false);
      // Die Seite ist nicht montiert — also hat sie auch keine Seitenhilfe angemeldet.
      expect(await seitenhilfe(), `${b.pfad}: Seitenhilfe ohne Seite`).not.toContain(
        t(`seitenhilfe.${b.hilfe}.titel`),
      );
      await klicke(buttonByText(t("stage2.gate.enable")), "Stufe 2 einschalten");
      await warteBis(() => seiteDa(b.navKey), `${b.pfad}: Seite nach dem Einschalten`);
      abbauenEcht();
      window.localStorage.removeItem(STUFE2_SCHLUESSEL);
    }
  });

  it("Stufe 2 an: Seite, Seitenhilfe im Zahnrad und Klaras Seitenerklärung — je Route", async () => {
    for (const b of BEREICHE) {
      window.localStorage.setItem(STUFE2_SCHLUESSEL, "1");
      montiereEcht(b.pfad);
      await warteBis(() => seiteDa(b.navKey), `${b.pfad}: Seite`);
      const hilfe = await seitenhilfe();
      expect(hilfe, `${b.pfad}: Seitenhilfe-Titel`).toContain(t(`seitenhilfe.${b.hilfe}.titel`));
      expect(hilfe, `${b.pfad}: Seitenhilfe-Text`).toContain(t(`seitenhilfe.${b.hilfe}.text`));
      const panel = await klara();
      expect(panel, `${b.pfad}: Klara „Du bist hier“`).toContain(t("klara.pageLabel"));
      expect(panel, `${b.pfad}: Klaras Seitenerklärung`).toContain(t(b.klara));
      abbauenEcht();
    }
  });

  it("Rollenbegrenzung: ein Nicht-Admin bekommt die Rollenkarte — auch mit gespeicherter Stufe 2", async () => {
    sitzung.rolle = "experte";
    for (const b of BEREICHE) {
      window.localStorage.setItem(STUFE2_SCHLUESSEL, "1");
      montiereEcht(b.pfad);
      await warteBis(() => text().includes(t("role.gate.title")), `${b.pfad}: Rollenkarte`);
      expect(seiteDa(b.navKey), `${b.pfad}: Seite trotz fehlender Rolle`).toBe(false);
      expect(text(), `${b.pfad}: kein Einschaltknopf für Nicht-Admins`).not.toContain(
        t("stage2.gate.enable"),
      );
      expect(await seitenhilfe(), `${b.pfad}: Seitenhilfe ohne Seite`).not.toContain(
        t(`seitenhilfe.${b.hilfe}.titel`),
      );
      abbauenEcht();
    }
  });

  it("Klaras Seitenerklärung der vier Bereiche steht in DE, EN und NL", () => {
    for (const b of BEREICHE) {
      const texte = ["de", "en", "nl"].map((lng) => i18n.getFixedT(lng)(b.klara));
      for (const wert of texte) {
        expect(wert, `${b.klara}: roher Schlüssel`).not.toBe(b.klara);
      }
      expect(new Set(texte).size, `${b.klara}: eine Sprache fällt zurück`).toBe(3);
    }
  });
});
