// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega62 BLOCK C — EINE ABLEHNUNG, DIE NICHT DURCHKAM, DARF NICHT WIE ERFOLG AUSSEHEN.
// ================================================================================================
//
// mega61 belegte den Erfolgsweg (tests/auth/mega61-hinweis-vermerk.test.ts: nach dem Abmelden wird
// eine geschützte Route abgewiesen). Der Fehlerfall war ungeprüft — und dort kippte die Zusage ins
// Gegenteil: `signOut()` räumte und verließ die Anwendung in einem `finally`, AUCH wenn das
// serverseitige Abmelden scheiterte. Nach einem harten Neuladen war die Nutzerin wieder angemeldet,
// obwohl sie gerade „Nicht einverstanden" bestätigt hatte.
//
// GEMOUNTET WIRD DIE ECHTE ANWENDUNG (`App`), nicht der Banner allein — die Sperre wirkt im
// Torwächter, und ein Test am Banner hätte genau die Ebene ausgelassen, auf der sie liegt. Nur die
// HTTP-Grenze ist ersetzt.
//
//   C1  KALIBRIERUNG: kommt das Abmelden durch, wird geräumt und weitergeleitet — wie bisher.
//   C2  FEHLERFALL: kommt es NICHT durch, wird NICHT weitergeleitet, die geschützte Nutzung ist
//       gesperrt, und die Fläche sagt, was wirklich ist.
//   C3  Der Grund-Merker für die Anmeldemaske wird zurückgenommen — es wurde nichts beendet, also
//       gibt es nichts zu erklären.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  abmeldenScheitert: false,
  abgemeldet: 0,
}));

vi.mock("../api/auth", () => ({
  authApi: {
    status: () => Promise.resolve({ needsSetup: false, oidcEnabled: false }),
    me: () => Promise.resolve({ id: "u1", name: "Nutzerin", role: "experte" }),
    notice: () => Promise.resolve({ currentVersion: "v1", due: true }),
    acknowledgeNotice: () =>
      Promise.resolve({ currentVersion: "v1", acknowledgedVersion: "v1", due: false }),
    logout: () => {
      server.abgemeldet += 1;
      return server.abmeldenScheitert
        ? Promise.reject(new Error("Netz weg"))
        : Promise.resolve(undefined);
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
const { abmeldeschuldLoeschen } = await import("../app/abmeldeschuld");
const { default: i18n } = await import("../i18n");
const { DECLINE_MARKER } = await import("./NoticeBanner");

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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        // Bewusst eine INHALTSARME Route: Es geht um die Hülle und den Torwächter, nicht um eine
        // Startseite. Jede datenreiche Seite hier wäre nur eine Attrappen-Wartungslast, die dem
        // Gegenstand dieses Tests nichts hinzufügt.
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

/**
 * Wartet gebunden auf eine Fläche. Der echte Baum hängt an mehreren Abfragen (Sitzung, Konto,
 * Schalter, Vermerk), und wie viele Ticks die brauchen, ist nichts, was ein Test raten sollte —
 * eine feste Rundenzahl wäre eine Wette, kein Beleg. Läuft die Grenze ab, ist der Test rot.
 */
async function warteAuf(kennung: string): Promise<Element> {
  for (let i = 0; i < 60; i++) {
    const gefunden = container.querySelector(`[data-testid=${kennung}]`);
    if (gefunden) {
      return gefunden;
    }
    await ruhen(5);
  }
  throw new Error(`Fläche „${kennung}“ ist nicht erschienen`);
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

/** Der Klickpfad bis zur Bestätigung — bei beiden Fällen identisch. */
async function ablehnenUndBestaetigen(): Promise<void> {
  await warteAuf("notice-banner");
  await klick(knopf("notice-decline-open"));
  await klick(knopf("notice-decline-confirm"));
}

beforeEach(() => {
  server.abmeldenScheitert = false;
  server.abgemeldet = 0;
  weitergeleitetNach = [];
  // AUFTRAG-mega64 Block B: Die Abmeldeschuld überlebt einen geleerten Speicher absichtlich
  // (fail-closed, s. `app/abmeldeschuld.ts`, Fall 2) — nach einem Fall mit gescheitertem Abmelden
  // wäre der nächste Fall also von Anfang an gesperrt. Der Ausgangszustand wird deshalb über den
  // PRODUKTWEG hergestellt, nicht über den Speicher.
  abmeldeschuldLoeschen();
  window.localStorage.clear();
  window.sessionStorage.clear();
  // `window.location` ist in jsdom nicht überschreibbar (die Eigenschaft ist nicht konfigurierbar),
  // deshalb wird sie einmalig durch eine schlichte Attrappe ersetzt. Sie ist der ZEUGE dieses
  // Tests: nur sie sagt, ob die Anwendung die Sitzung wirklich verlassen hat. `pathname` bleibt
  // „/", weil der Torwächter ihn liest (Reset-, SSO- und Rechtsseiten-Zweige).
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

describe("mega62 C · die Ablehnung ist fail-closed", () => {
  it("C1 · KALIBRIERUNG: kommt das Abmelden durch, verlässt die Anwendung die Sitzung", async () => {
    await anwendungMontieren();
    // Ohne diesen Schritt bewiese C2 nichts: ein fehlendes `assign` wäre auch dann grün, wenn der
    // Knopf gar nichts täte.
    await warteAuf("notice-banner");

    await ablehnenUndBestaetigen();

    expect(server.abgemeldet).toBe(1);
    expect(weitergeleitetNach).toEqual(["/"]);
    expect(container.querySelector("[data-testid=signout-blocked]")).toBeNull();
    expect(window.sessionStorage.getItem(DECLINE_MARKER)).toBe("1");
    abbauen();
  });

  it("C2 · FEHLERFALL: scheitert das Abmelden, wird nicht weitergeleitet und nichts Geschütztes mehr gezeigt", async () => {
    server.abmeldenScheitert = true;
    await anwendungMontieren();
    await warteAuf("notice-banner");

    await ablehnenUndBestaetigen();

    expect(server.abgemeldet).toBe(1);
    // DIE ZUSAGE: kein kommentarloses Weiterleiten. Die Anwendung behauptet nicht, etwas sei
    // geschehen, was nicht geschehen ist.
    expect(weitergeleitetNach).toEqual([]);

    // Und die geschützte Nutzung ist gesperrt — der Banner mit ihr, denn er hängt in der Hülle.
    const sperre = container.querySelector("[data-testid=signout-blocked]");
    expect(sperre).not.toBeNull();
    expect(sperre?.getAttribute("role")).toBe("alert");
    expect(sperre?.textContent).toContain(i18n.t("notice.signOutFailed.body"));
    expect(container.querySelector("[data-testid=notice-banner]")).toBeNull();

    abbauen();
  });

  it("C3 · der Grund-Merker wird zurückgenommen — es wurde nichts beendet", async () => {
    server.abmeldenScheitert = true;
    await anwendungMontieren();
    await ablehnenUndBestaetigen();
    // Bliebe er liegen, erklärte die Anmeldemaske irgendwann eine Beendigung, die nie stattfand.
    expect(window.sessionStorage.getItem(DECLINE_MARKER)).toBeNull();
    abbauen();
  });

  it("C4 · der Knopf auf der Sperrfläche versucht es erneut — und meldet, wenn es wieder scheitert", async () => {
    server.abmeldenScheitert = true;
    await anwendungMontieren();
    await ablehnenUndBestaetigen();
    expect(server.abgemeldet).toBe(1);

    await klick(knopf("signout-blocked-retry"));
    expect(server.abgemeldet).toBe(2);
    expect(weitergeleitetNach).toEqual([]);
    expect(container.querySelector("[data-testid=signout-blocked-again]")).not.toBeNull();

    // Und wenn der Server wieder erreichbar ist, kommt die Beendigung durch — die Sperre ist
    // eine Sperre, keine Sackgasse.
    server.abmeldenScheitert = false;
    await klick(knopf("signout-blocked-retry"));
    expect(server.abgemeldet).toBe(3);
    expect(weitergeleitetNach).toEqual(["/"]);
    abbauen();
  });
});
