// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega65 BLOCK B — DIE SCHULD HAT KEINE FRIST MEHR, ALSO MUSS SIE EINEN AUSGANG HABEN.
// ================================================================================================
//
// ben hat in sammel62 (ROT-2) belegt, dass die zugesagten vierundzwanzig Stunden nie liefen:
// `abmeldeschuldGesetzt()` gab bei `inDiesemLauf` sofort `true` und LAS die gespeicherte Frist nie;
// ein beschädigter Eintrag sperrte ohne Ersatzfrist über Neustarts hinweg unbegrenzt. Dagegen stand
// in DE, EN und NL der Satz, der Merker verfalle „spätestens nach vierundzwanzig Stunden von
// selbst".
//
// mega65 löst das durch WEGNAHME: Der Eintrag trägt keine Frist mehr, er ist ein Merker — vorhanden
// heißt Schuld (Begründung in `app/abmeldeschuld.ts`). Damit verschwindet die Fehlerklasse, statt
// behandelt zu werden. Der Preis dieser Entscheidung ist eine Bringschuld: Ohne Frist MUSS es einen
// Ausgang geben, der ohne Zutun funktioniert — sonst wäre aus einer falschen Zusage eine echte
// Sackgasse geworden. Genau das prüft diese Datei, und zwar in der Reihenfolge, in der es zählt:
//
//   M1  DER AUSGANG OHNE ZUTUN (bens GELB-1): Wird die Anwendung MIT offener Schuld aufgebaut,
//       während Verbindung und Sichtbarkeit schon bestehen, versucht sie die Abmeldung von selbst.
//       Antwortet der Server, löst sich die Schuld auf — in jedem Tab, ohne Knopf, ohne Uhr.
//       Mit Kalibrierung: bei stummem Server bleibt genau derselbe Fall gesperrt.
//   M2  DIE SACKGASSENFRAGE AM SCHLIMMSTEN EINTRAG: Ein BESCHÄDIGTER Merker sperrt (fail-closed) —
//       und ein bestätigter Wiederholversuch macht wieder frei. Er ist kein Sonderfall mehr,
//       sondern ein vorhandener Merker, und genau so verhält er sich.
//   M3  DER EINTRAG SELBST: Er trägt keine Frist und keinen Zeitstempel. Der Datenschutztext sagt
//       zu, er enthalte keine Angaben über die Nutzerin — ein Zeitpunkt wäre eine.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  abmeldenScheitert: false,
  abgemeldet: 0,
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

/** Ein Aufbau der Anwendung, wie ihn ein Neuladen oder ein neu geöffneter Tab auslöst. */
async function anwendungAufbauen(): Promise<void> {
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

function sichtbar(kennung: string): boolean {
  return container.querySelector(`[data-testid=${kennung}]`) !== null;
}

async function klick(kennung: string): Promise<void> {
  const el = container.querySelector<HTMLButtonElement>(`[data-testid=${kennung}]`);
  if (!el) {
    throw new Error(`Knopf „${kennung}“ nicht gefunden`);
  }
  await act(async () => {
    el.click();
  });
  await ruhen(20);
}

/** Ein beschädigter Eintrag, genau wie ben ihn beschreibt: kein gültiges JSON, keine Frist. */
const BESCHAEDIGT = '{"bis": ';

beforeEach(() => {
  server.abmeldenScheitert = false;
  server.abgemeldet = 0;
  server.sitzungBesteht = true;
  weitergeleitetNach = [];
  // Über den Produktweg, nicht über den Speicher: eine festgestellte Schuld überlebt ein
  // Speicher-Leeren absichtlich (fail-closed, s. abmeldeschuld.ts, Fall 1).
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

describe("mega65 B · eine offene Schuld löst sich beim Aufbau von selbst auf", () => {
  it("M1 · KALIBRIERUNG: bei stummem Server bleibt derselbe Aufbau gesperrt", async () => {
    // Die Kalibrierung steht ZUERST, weil sie das Maß setzt: Ohne sie wäre M1 unten auch dann grün,
    // wenn der Merker gar nicht mehr gelesen würde — und dann bewiese die Freigabe nichts.
    server.abmeldenScheitert = true;
    window.localStorage.setItem(ABMELDESCHULD_SCHLUESSEL, ABMELDESCHULD_WERT);

    await anwendungAufbauen();

    await warteAuf("signout-blocked");
    expect(sichtbar("notice-banner"), "geschützte Inhalte dürfen nicht durchkommen").toBe(false);
    // Versucht hat sie es trotzdem — der Versuch beim Aufbau ist der Punkt, nicht sein Ausgang.
    expect(server.abgemeldet, "beim Aufbau wurde kein Versuch unternommen").toBeGreaterThan(0);
    expect(window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL)).toBe(ABMELDESCHULD_WERT);
    abbauen();
  });

  it("M1 · antwortet der Server, ist die Schuld nach dem Aufbau ohne jedes Zutun weg", async () => {
    // bens GELB-1: mega64 hörte nur auf `online` und `visibilitychange` — beides ÜBERGÄNGE. Wird die
    // Seite aufgebaut, während der Browser schon online und sichtbar ist, fand keiner davon statt,
    // und es versuchte niemand die Abmeldung. Seit mega65 gibt es keine Frist mehr, die diesen Fall
    // ersatzweise auflöste; dieser Beleg ist deshalb der tragende Ausgang.
    window.localStorage.setItem(ABMELDESCHULD_SCHLUESSEL, ABMELDESCHULD_WERT);

    await anwendungAufbauen();

    expect(server.abgemeldet, "beim Aufbau wurde die Abmeldung nicht nachgeholt").toBeGreaterThan(
      0,
    );
    expect(
      window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL),
      "die bestätigte Beendigung muss den Merker löschen",
    ).toBeNull();
    // Und die Anwendung startet danach frisch — dieselbe Wirkung wie beim bestätigten Abmelden.
    expect(weitergeleitetNach).toEqual(["/"]);
    expect(sichtbar("signout-blocked"), "die Sperre muss gefallen sein").toBe(false);
    abbauen();
  });

  it("M2 · ein BESCHÄDIGTER Eintrag sperrt — und ein bestätigter Versuch macht wieder frei", async () => {
    // Der Eintrag, der bis mega64 unbegrenzt sperrte, weil `JSON.parse` warf und keine Ersatzfrist
    // gesetzt wurde. Er ist jetzt kein Sonderfall mehr: ein vorhandener Merker, nicht mehr und nicht
    // weniger. Dass er sperrt, ist richtig; dass es einen Ausgang gibt, ist die Zusage.
    server.abmeldenScheitert = true;
    window.localStorage.setItem(ABMELDESCHULD_SCHLUESSEL, BESCHAEDIGT);

    await anwendungAufbauen();
    await warteAuf("signout-blocked");
    expect(window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL)).toBe(BESCHAEDIGT);

    // Der Server ist wieder da; der Knopf auf der Sperrfläche löst die Schuld ein.
    server.abmeldenScheitert = false;
    await klick("signout-blocked-retry");

    expect(
      window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL),
      "ein beschädigter Eintrag darf keine Sackgasse sein",
    ).toBeNull();
    expect(weitergeleitetNach).toEqual(["/"]);
    abbauen();
  });

  it("M3 · der Merker trägt keine Frist und keinen Zeitstempel", async () => {
    server.abmeldenScheitert = true;
    await anwendungAufbauen();
    // Über den Produktweg entstehen lassen: „Nicht einverstanden" bis zur Bestätigung.
    await warteAuf("notice-banner");
    await klick("notice-decline-open");
    await klick("notice-decline-confirm");
    await warteAuf("signout-blocked");

    const roh = window.localStorage.getItem(ABMELDESCHULD_SCHLUESSEL);
    expect(roh, "der Merker fehlt im dauerhaften Browserspeicher").not.toBeNull();
    // Bis mega64 stand hier `{"bis":<Zeitpunkt>}`. Der Datenschutztext sagt zu, der Merker enthalte
    // keine Angaben über die Nutzerin — ein Zeitpunkt wäre eine, und eine Frist wäre eine Zusage,
    // die niemand einlöst.
    expect(roh, "der Merker trägt eine Zahl — also doch eine Angabe").not.toMatch(/\d/);
    expect(roh).toBe(ABMELDESCHULD_WERT);
    abbauen();
  });
});
