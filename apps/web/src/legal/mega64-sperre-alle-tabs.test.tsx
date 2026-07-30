// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega64 BLOCK B — EINE SPERRE, DIE NUR EINEN TAB SPERRT, IST KEINE SPERRE.
// ================================================================================================
//
// mega63 A hat die Sperre neuladefest gemacht. ben hat den verbliebenen Zuschnitt gefunden
// (BERICHT-ben-sammel61-mega63.md, Finding 2), und der Befund ist echt:
//
//     `sessionStorage` ist tablokal. Ein BEREITS OFFENER zweiter Tab bekam den Merker nie und zeigte
//     mit DEMSELBEN Cookie weiter geschützte Inhalte. Die Sitzung, deren Beendigung gerade
//     unbestätigt geblieben war, wurde also nebenan ungestört weiterbenutzt.
//
// WAS DIESER TEST MACHT, UND WARUM SO: Zwei echte Tabs lassen sich in jsdom nicht öffnen. Was zwei
// Tabs für die Anwendung BEDEUTEN, lässt sich vollständig nachstellen — zwei voneinander unabhängige
// React-Bäume mit je eigenem `QueryClient`, die sich EINEN `localStorage` und EINEN Server teilen.
// Genau darin besteht der Unterschied zu zwei Tabs nicht: derselbe Speicher, dasselbe Cookie, zwei
// getrennte Anwendungszustände.
//
// Was jsdom NICHT von selbst tut, ist das `storage`-Ereignis zwischen zwei Bäumen im gleichen
// Fenster zu verteilen (echte Browser feuern es in den FREMDEN Tabs). Es wird deshalb ausgelöst wie
// ein Browser es täte — mit demselben Schlüssel und demselben Wert, die im Speicher stehen. Das ist
// keine Abkürzung um die Zusage herum, sondern die Nachbildung der Zustellung; dass der Merker
// wirklich geschrieben wurde, prüft B1 VORHER und unabhängig.
//
//   B1  DER BEFUND: Baum 2 ist nach der gescheiterten Abmeldung in Baum 1 ebenfalls gesperrt.
//       Mit Kalibrierung: derselbe Baum 2 zeigt OHNE das Ereignis geschützte Inhalte — sonst
//       bewiese die Sperre nichts über die Zustellung.
//   B2  DIE GEGENRICHTUNG: nach BESTÄTIGTER Abmeldung sind beide frei. Eine Sperre, die nur zugeht,
//       wäre eine Falle.
//   B3  DIE KANTE: ein VERWEIGERTER Speicher sperrt, statt zu öffnen.
//   B4  entfallen mit mega65 — die Verfallszeit, die er prüfte, gibt es nicht mehr. Begründung und
//       Nachfolgebelege stehen unten an seiner Stelle.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  abmeldenScheitert: false,
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
const { ABMELDESCHULD_SCHLUESSEL, abmeldeschuldLoeschen } = await import("../app/abmeldeschuld");

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Tab {
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
}

const offen: Tab[] = [];

async function ruhen(runden = 30): Promise<void> {
  await act(async () => {
    for (let i = 0; i < runden; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

/** Ein weiterer „Tab": eigener React-Baum, eigener QueryClient, GETEILTER Speicher und Server. */
async function tabOeffnen(): Promise<Tab> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
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
  const tab = { container, root };
  offen.push(tab);
  return tab;
}

async function warteAuf(tab: Tab, kennung: string): Promise<Element> {
  for (let i = 0; i < 60; i++) {
    const gefunden = tab.container.querySelector(`[data-testid=${kennung}]`);
    if (gefunden) {
      return gefunden;
    }
    await ruhen(5);
  }
  throw new Error(`Fläche „${kennung}“ ist in diesem Tab nicht erschienen`);
}

function sichtbar(tab: Tab, kennung: string): boolean {
  return tab.container.querySelector(`[data-testid=${kennung}]`) !== null;
}

async function klick(tab: Tab, kennung: string): Promise<void> {
  const el = tab.container.querySelector<HTMLButtonElement>(`[data-testid=${kennung}]`);
  if (!el) {
    throw new Error(`Knopf „${kennung}“ nicht gefunden`);
  }
  await act(async () => {
    el.click();
  });
  await ruhen(20);
}

/**
 * Die Zustellung, die ein echter Browser übernimmt: `storage` feuert in den FREMDEN Tabs, mit dem
 * Schlüssel und dem tatsächlich im Speicher stehenden Wert. Bewusst aus dem Speicher GELESEN und
 * nicht als Wunschwert übergeben — so kann dieser Helfer keine Zustellung vorspiegeln, die es ohne
 * einen echten Speichereintrag nicht gäbe.
 */
async function speicherEreignisZustellen(): Promise<void> {
  const wert = window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL);
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: ABMELDESCHULD_SCHLUESSEL,
        newValue: wert,
        storageArea: window.localStorage,
      }),
    );
  });
  await ruhen(20);
}

/** „Nicht einverstanden" bis zur Bestätigung durchklicken — der Weg in das strenge Abmelden. */
async function ablehnenUndBestaetigen(tab: Tab): Promise<void> {
  await warteAuf(tab, "notice-banner");
  await klick(tab, "notice-decline-open");
  await klick(tab, "notice-decline-confirm");
}

beforeEach(() => {
  server.abmeldenScheitert = false;
  server.sitzungBesteht = true;
  // Über den Produktweg, nicht über den Speicher: eine festgestellte Schuld überlebt ein
  // Speicher-Leeren absichtlich (fail-closed). Siehe abmeldeschuld.ts, Fall 2.
  abmeldeschuldLoeschen();
  window.localStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname: "/", assign: () => undefined },
  });
});

afterEach(() => {
  while (offen.length > 0) {
    const tab = offen.pop();
    if (tab) {
      act(() => tab.root.unmount());
      tab.container.remove();
    }
  }
  vi.restoreAllMocks();
});

describe("mega64 B · die Abmeldeschuld gilt in allen Tabs", () => {
  it("B1 · der zweite, BEREITS OFFENE Tab ist nach der gescheiterten Abmeldung ebenfalls gesperrt", async () => {
    server.abmeldenScheitert = true;

    // Beide Tabs stehen offen und zeigen geschützte Inhalte — das ist der Ausgangszustand, den ben
    // beschreibt. Tab 2 wird ausdrücklich VOR der Ablehnung geöffnet: ein danach geöffneter Tab
    // hätte den Merker beim Aufbau ohnehin gelesen und bewiese den Befund nicht.
    const tab1 = await tabOeffnen();
    const tab2 = await tabOeffnen();
    await warteAuf(tab1, "notice-banner");
    await warteAuf(tab2, "notice-banner");

    await ablehnenUndBestaetigen(tab1);
    expect(sichtbar(tab1, "signout-blocked"), "Tab 1 muss sofort gesperrt sein").toBe(true);

    // DIE KALIBRIERUNG: Ohne die Zustellung des Ereignisses zeigt Tab 2 weiter Inhalte. Genau das
    // war der Ist-Stand bis mega63 — und ohne diese Zeile wüsste niemand, ob die Sperre unten von
    // der Zustellung kommt oder ohnehin da gewesen wäre.
    expect(
      sichtbar(tab2, "signout-blocked"),
      "Kalibrierung: ohne Zustellung ist Tab 2 noch offen — genau der Befund",
    ).toBe(false);
    expect(sichtbar(tab2, "notice-banner")).toBe(true);

    // Der Merker steht wirklich im geteilten Speicher — die Zustellung erfindet ihn nicht.
    const roh = window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL);
    expect(roh, "die Schuld muss im geteilten Browserspeicher liegen").not.toBeNull();

    await speicherEreignisZustellen();

    // DIE ZUSAGE: derselbe schon offene Tab, dieselbe fortbestehende Sitzung — und trotzdem gesperrt.
    expect(server.sitzungBesteht, "die Sitzung besteht fort — das ist der ganze Punkt").toBe(true);
    await warteAuf(tab2, "signout-blocked");
    expect(sichtbar(tab2, "notice-banner")).toBe(false);
  });

  it("B2 · nach BESTÄTIGTER Abmeldung sind BEIDE Tabs frei", async () => {
    server.abmeldenScheitert = true;
    const tab1 = await tabOeffnen();
    const tab2 = await tabOeffnen();
    await ablehnenUndBestaetigen(tab1);
    await speicherEreignisZustellen();
    await warteAuf(tab2, "signout-blocked");

    // Der Server ist wieder da; der Knopf in Tab 1 löst die Schuld ein.
    server.abmeldenScheitert = false;
    await klick(tab1, "signout-blocked-retry");
    expect(window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL)).toBeNull();

    // Und die Entlastung erreicht Tab 2 auf demselben Weg. Eine Sperre, die sich nur ausbreitet und
    // nie zurücknimmt, wäre eine Falle statt eines Vorgangs.
    await speicherEreignisZustellen();
    expect(sichtbar(tab2, "signout-blocked"), "Tab 2 muss wieder frei sein").toBe(false);
  });

  it("B3 · ein VERWEIGERTER Speicher sperrt, statt zu öffnen", async () => {
    // Der Fall, den ben zusätzlich gefunden hat: Bis mega63 fiel der Leser bei werfendem Speicher
    // fail-OPEN auf „nicht gesperrt" zurück. Bei einer Sperre ist das die falsche Richtung.
    server.abmeldenScheitert = true;
    const echt = window.localStorage;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Speicher verweigert (verschärfter Datenschutzmodus)");
      },
    });
    try {
      const tab1 = await tabOeffnen();
      await ablehnenUndBestaetigen(tab1);
      // Kein Speicher, also kein Merker — und trotzdem gesperrt: die festgestellte Schuld trägt im
      // Arbeitsspeicher weiter (abmeldeschuld.ts, `inDiesemLauf`). Fail-closed in der Richtung, in
      // der es schützt.
      await warteAuf(tab1, "signout-blocked");
      // Und ein NEU aufgebauter Baum im selben Lauf bleibt ebenfalls gesperrt — der Rückfall ist
      // nicht an diesen einen React-Baum gebunden.
      const tab2 = await tabOeffnen();
      await warteAuf(tab2, "signout-blocked");
    } finally {
      Object.defineProperty(window, "localStorage", { configurable: true, value: echt });
    }
  });

  // ==============================================================================================
  // AUFTRAG-mega65 BLOCK B — B4 IST ENTFALLEN, UND ZWAR NICHT WEIL ER UNBEQUEM WURDE.
  // ==============================================================================================
  //
  // B4 hieß „eine ABGELAUFENE Schuld sperrt einen unbeteiligten späteren Besuch nicht aus" und
  // prüfte die ausgeschriebene Verfallszeit von vierundzwanzig Stunden. Diese Frist gibt es nicht
  // mehr: ben hat belegt, dass sie in dem Tab, in dem die Abmeldung scheiterte, überhaupt nie lief
  // und dass ein beschädigter Eintrag unbegrenzt sperrte (sammel62, ROT-2) — während DE, EN und NL
  // sie ausdrücklich zusagten. mega65 nimmt sie deshalb weg statt sie nachzubauen (Begründung in
  // `app/abmeldeschuld.ts`).
  //
  // EIN TEST, DESSEN GEGENSTAND WEG IST, DARF NICHT UMGEDEUTET WERDEN — sonst behält er seinen
  // Namen und prüft etwas anderes. Die FRAGE hinter B4 bleibt aber gültig und ist die wichtigste
  // der ganzen Scheibe: Ein Merker im dauerhaften Speicher darf niemanden aussperren. Sie wird
  // jetzt anders beantwortet, nämlich über den Ausgang statt über eine Uhr, und dort belegt:
  // `mega65-abmeldeschuld-ohne-frist.test.tsx` — M1 (der Aufbau holt die Abmeldung von selbst nach,
  // mit Kalibrierung am stummen Server) und M2 (auch ein beschädigter Eintrag ist keine Sackgasse).
});
