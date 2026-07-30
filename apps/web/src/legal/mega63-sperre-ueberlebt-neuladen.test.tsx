// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega63 BLOCK A — EINE SPERRE, DIE EIN NEULADEN NICHT ÜBERSTEHT, IST KEINE SPERRE.
// ================================================================================================
//
// mega62 C hat den Fehlerfall im LAUFENDEN Anwendungszustand geschlossen: scheitert das strenge
// Abmelden, wird nicht weitergeleitet und nichts Geschütztes mehr gezeigt. ben hat die Kante daran
// gefunden (BERICHT-ben-sammel60-mega62.md, Abschnitt 1, Finding 3), und sie ist echt:
//
//     `signOutFailed` war reiner React-State (AuthContext.tsx:45-51). Ein manuelles Neuladen setzt
//     ihn zurück. Und weil der serverseitige Logout GERADE GESCHEITERT ist, liefert `/auth/me`
//     danach dieselbe Sitzung weiter — der Torwächter lässt den geschützten Baum wieder zu.
//
// Die Zusage „gesperrt, bis der Server die Beendigung bestätigt" galt damit nur bis zum Neuladen.
//
// WAS DIESER TEST MACHT, UND WARUM SO: Ein Neuladen lässt sich in jsdom nicht auslösen. Was ein
// Neuladen für die Anwendung BEDEUTET, lässt sich aber vollständig nachstellen — jeder React-State
// ist weg, jeder Abfrage-Zwischenspeicher ist weg, und der Server antwortet unverändert. Genau das
// tut `neuLaden()`: abbauen, FRISCHER `QueryClient`, neu montieren. Was einen solchen Neuaufbau
// übersteht, übersteht auch F5; was ihn nicht übersteht, überstände F5 auch nicht.
//
// Der Browserspeicher bleibt dabei ausdrücklich stehen — er ist das Einzige, was ein Neuladen
// überlebt, und deshalb ist er der Ort des Merkers.
//
// AUFTRAG-mega64 Block B: Hier stand bis mega63 „Kein `localStorage`: der Merker gehört zu GENAU
// DIESEM Tab". Das war der Kern von bens Befund aus sammel61 — der Zustand gehört zur SITZUNG, und
// die teilen alle Tabs. Er liegt seit mega64 im `localStorage`, mit Ablaufzeit statt Tab-Bindung;
// die tabübergreifende Wirkung belegt mega64-sperre-alle-tabs.test.tsx. Diese Datei prüft
// unverändert das, wofür sie gebaut wurde: dass ein NEULADEN die Sperre nicht abwirft.
//
//   A1  KALIBRIERUNG: der Server liefert nach dem gescheiterten Abmelden WIRKLICH weiter dieselbe
//       Sitzung. Ohne diesen Schritt bewiese A2 nichts — eine Sperre wäre auch dann grün, wenn der
//       Baum nur deshalb fehlte, weil niemand mehr angemeldet ist.
//   A2  DER BEFUND: nach dem Neuladen bleibt der geschützte Baum gesperrt.
//   A3  DIE GEGENRICHTUNG: nach BESTÄTIGTEM strengem Abmelden ist der Merker weg und die Anmeldung
//       wieder möglich. Ohne A3 wäre A2 eine Sperre, aus der niemand herauskommt — schlimmer als
//       der Fehler, den sie behebt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  abmeldenScheitert: false,
  abgemeldet: 0,
  // Nach einem GESCHEITERTEN Logout besteht die Sitzung fort — das ist der ganze Punkt. Die
  // Attrappe bildet das ab, statt es zu behaupten.
  sitzungBesteht: true,
}));

vi.mock("../api/auth", () => ({
  authApi: {
    status: () => Promise.resolve({ needsSetup: false, oidcEnabled: false }),
    me: () =>
      server.sitzungBesteht
        ? Promise.resolve({ id: "u1", name: "Nutzerin", role: "experte" })
        : Promise.reject(new Error("401")),
    notice: () => Promise.resolve({ currentVersion: "v1", due: true }),
    acknowledgeNotice: () =>
      Promise.resolve({ currentVersion: "v1", acknowledgedVersion: "v1", due: false }),
    logout: () => {
      server.abgemeldet += 1;
      if (server.abmeldenScheitert) {
        return Promise.reject(new Error("Netz weg"));
      }
      server.sitzungBesteht = false;
      return Promise.resolve(undefined);
    },
    ssoStartUrl: "/api/auth/oidc/start",
  },
}));

vi.mock("../api/endpoints", () => ({
  endpoints: {
    features: {
      get: () => Promise.resolve({ features: { rechtsseiten: true, hinweisbanner: true } }),
    },
    ko: { list: () => Promise.resolve([]) },
    analytics: { overview: () => Promise.resolve({ total: 0, byStatus: {} }) },
    conflicts: { list: () => Promise.resolve([]) },
    duplicates: { list: () => Promise.resolve([]) },
    validation: { board: () => Promise.resolve([]) },
    lifecycle: { pending: () => Promise.resolve([]) },
    learningPaths: { byRole: () => Promise.resolve(null), progress: () => Promise.resolve([]) },
    livewall: { get: () => Promise.resolve({ fresh: [], helped: [], helpedToday: 0 }) },
    notifications: {
      list: () => Promise.resolve([]),
      markSeen: () => Promise.resolve({ unseenCount: 0 }),
    },
    reasoner: {
      status: () => Promise.resolve({ active: false, mode: "deterministic" }),
      config: () => Promise.resolve({}),
    },
    external: { policy: () => Promise.resolve(null) },
    help: { explain: () => Promise.resolve({}) },
    gaps: {
      list: () => Promise.resolve([]),
      summary: () => Promise.resolve({ open: 0, byPriority: {} }),
    },
    directory: { list: () => Promise.resolve([]) },
  },
}));

const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router-dom");
const { default: App } = await import("../App");
const { ABMELDESCHULD_SCHLUESSEL, ABMELDESCHULD_WERT, abmeldeschuldLoeschen } = await import(
  "../app/abmeldeschuld"
);

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let weitergeleitetNach: string[] = [];

async function ruhen(runden = 30): Promise<void> {
  await act(async () => {
    for (let i = 0; i < runden; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

async function anwendungMontieren(): Promise<void> {
  // FRISCHER Client bei jeder Montage — genau das, was ein Neuladen mit dem Zwischenspeicher tut.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, { initialEntries: ["/ui-kit"] }, createElement(App)),
      ),
    );
  });
  await ruhen();
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

/** Ein Neuladen, so weit jsdom es zulässt: aller React-State weg, aller Cache weg, Server gleich. */
async function neuLaden(): Promise<void> {
  abbauen();
  await anwendungMontieren();
}

async function warteAufWahl(wahl: string): Promise<Element> {
  for (let i = 0; i < 60; i++) {
    const gefunden = container.querySelector(wahl);
    if (gefunden) {
      return gefunden;
    }
    await ruhen(5);
  }
  throw new Error(`Fläche „${wahl}“ ist nicht erschienen`);
}

async function warteAuf(kennung: string): Promise<Element> {
  return warteAufWahl(`[data-testid=${kennung}]`);
}

function knopf(kennung: string): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(`[data-testid=${kennung}]`);
  if (!el) {
    throw new Error(`Knopf „${kennung}“ nicht gefunden`);
  }
  return el;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
  });
  await ruhen(20);
}

async function ablehnenUndBestaetigen(): Promise<void> {
  await warteAuf("notice-banner");
  await klick(knopf("notice-decline-open"));
  await klick(knopf("notice-decline-confirm"));
}

beforeEach(() => {
  server.abmeldenScheitert = false;
  server.abgemeldet = 0;
  server.sitzungBesteht = true;
  weitergeleitetNach = [];
  // AUFTRAG-mega64 Block B: Den Speicher zu leeren GENÜGT NICHT, und das ist Absicht des Produkts.
  // Eine festgestellte Schuld überlebt einen verweigerten oder geleerten Speicher (fail-closed —
  // sonst hübe ein `localStorage.clear()` die Sperre auf). Der Ausgangszustand muss deshalb über den
  // PRODUKTWEG hergestellt werden, nicht über den Speicher: `abmeldeschuldLoeschen()`.
  abmeldeschuldLoeschen();
  window.localStorage.clear();
  window.sessionStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      pathname: "/",
      assign: (ziel: string) => {
        weitergeleitetNach.push(String(ziel));
      },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mega63 A · die Sperre übersteht ein Neuladen", () => {
  it("A1 · KALIBRIERUNG: ohne Sperre käme dieselbe Sitzung nach dem Neuladen wieder durch", async () => {
    // Kein gescheitertes Abmelden — nur montieren, neu laden, und nachsehen, dass der Server
    // unverändert dieselbe Sitzung liefert und der geschützte Baum steht. Damit ist belegt, dass
    // A2 die SPERRE misst und nicht eine beendete Sitzung.
    await anwendungMontieren();
    await warteAuf("notice-banner");
    await neuLaden();
    await warteAuf("notice-banner");
    expect(container.querySelector("[data-testid=signout-blocked]")).toBeNull();
    abbauen();
  });

  it("A2 · DER BEFUND: nach gescheitertem Abmelden bleibt der Baum auch nach dem Neuladen gesperrt", async () => {
    server.abmeldenScheitert = true;
    await anwendungMontieren();
    await ablehnenUndBestaetigen();

    // Der laufende Zustand ist schon seit mega62 richtig — hier nur als Ausgangspunkt.
    expect(container.querySelector("[data-testid=signout-blocked]")).not.toBeNull();

    await neuLaden();

    // DIE ZUSAGE, und sie steht bewusst VOR der Merker-Prüfung: der Server liefert dieselbe
    // Sitzung weiter (`sitzungBesteht` ist unverändert wahr — das gescheiterte Abmelden hat nichts
    // beendet), und trotzdem bleibt gesperrt. Wäre die Merker-Prüfung zuerst rot, benennte die
    // Ausgabe nur das Mittel; so benennt sie den Mangel.
    expect(server.sitzungBesteht).toBe(true);
    await warteAuf("signout-blocked");
    expect(container.querySelector("[data-testid=notice-banner]")).toBeNull();
    // Und der Merker ist das Mittel, mit dem das gelingt — seit mega64 im `localStorage`, weil er
    // für alle Tabs gilt.
    //
    // AUFTRAG-mega65 Block B: Hier stand `JSON.parse(roh).bis > Date.now()`. Der Eintrag trägt keine
    // Frist mehr — vorhanden heißt Schuld (Begründung in `app/abmeldeschuld.ts`, Belege in
    // `mega65-abmeldeschuld-ohne-frist.test.tsx`). Geprüft wird deshalb, was jetzt die Aussage ist:
    // dass er DA ist, im dauerhaften Speicher und nicht im tablokalen.
    const roh = window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL);
    expect(roh, "der Merker fehlt im dauerhaften Browserspeicher").toBe(ABMELDESCHULD_WERT);
    expect(window.sessionStorage.getItem(ABMELDESCHULD_SCHLUESSEL)).toBeNull();
    abbauen();
  });

  it("A3 · nach BESTÄTIGTEM Abmelden ist der Merker weg — die Sperre ist keine Sackgasse", async () => {
    server.abmeldenScheitert = true;
    await anwendungMontieren();
    await ablehnenUndBestaetigen();
    await neuLaden();
    await warteAuf("signout-blocked");

    // Der Server ist wieder da. Der Knopf auf der Sperrfläche ist der einzige Weg heraus.
    server.abmeldenScheitert = false;
    await klick(knopf("signout-blocked-retry"));

    expect(weitergeleitetNach).toEqual(["/"]);
    expect(window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL)).toBeNull();

    // Und nach dem Neuladen steht die Anmeldemaske, nicht die Sperre: die Sitzung IST jetzt
    // beendet, also gibt es nichts mehr zu sperren.
    await neuLaden();
    expect(container.querySelector("[data-testid=signout-blocked]")).toBeNull();
    // Die Anmeldemaske, erkannt an ihrem E-Mail-Feld — kein neuer Testhaken im Anmeldeweg, der
    // ist die empfindlichste Stelle des Produkts (mega61 B).
    await warteAufWahl('input[type="email"]');
    abbauen();
  });

  it("A4 · ein LIEGENGEBLIEBENER Merker sperrt nicht dauerhaft aus", async () => {
    // Der Fall, den A3 NICHT abdeckt: Der Merker steht noch, aber die Sitzung ist inzwischen von
    // selbst weg (anderswo abgemeldet, abgelaufen). Ohne diesen Weg heraus hätten wir eine Sperre
    // gebaut, die eine Unbeteiligte am Anmelden hindert — schlimmer als der Fehler von vorher.
    //
    // Dass der Knopf hier durchkommt, ist keine Annahme: `/api/auth/logout` antwortet auch OHNE
    // Token mit 204 (services/auth/src/routes.ts:277-284, gepinnt in
    // tests/auth/mega63-abmelden-ohne-sitzung.test.ts). Ein verlorener Token kann den Ausweg
    // deshalb nicht verriegeln.
    //
    // AUFTRAG-mega65 Block B: Der Server ist beim Aufbau ausdrücklich STUMM gestellt. Sonst löste die
    // Anwendung diesen Fall von selbst auf, bevor der Knopf überhaupt sichtbar wäre — seit mega65
    // versucht sie die Abmeldung schon beim Aufbau (bens GELB-1). Genau DAS ist ein eigener Beleg
    // (`mega65-abmeldeschuld-ohne-frist.test.tsx`, M1) und darf hier nicht die Frage verdecken, für
    // die dieser Fall gebaut ist: Kommt der KNOPF durch, wenn die Sitzung schon weg ist?
    window.localStorage.setItem(ABMELDESCHULD_SCHLUESSEL, ABMELDESCHULD_WERT);
    server.sitzungBesteht = false;
    server.abmeldenScheitert = true;
    await anwendungMontieren();

    // Gesperrt, obwohl gar keine Sitzung mehr da ist — der Merker allein trägt.
    await warteAuf("signout-blocked");

    server.abmeldenScheitert = false;
    await klick(knopf("signout-blocked-retry"));
    expect(window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL)).toBeNull();
    expect(weitergeleitetNach).toEqual(["/"]);
    abbauen();
  });
});
