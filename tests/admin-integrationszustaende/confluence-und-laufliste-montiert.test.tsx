// @vitest-environment jsdom
// ================================================================================================
// ADMIN-02 · NACHARBEIT 2 — CONFLUENCE-KARTE, CONFLUENCE-KACHEL UND IMPORTLISTE AN DER FLÄCHE.
// ================================================================================================
//
// Montiert wird der Ausschnitt aus `pages/Stufe2.tsx` (`ImportReview`): Zugangskasten Confluence,
// Importliste und Cockpit mit Quellen-Galerie — derselbe Abfragespeicher wie im Betrieb. Attrappe
// ist genau die Drahtgrenze (`api/endpoints`); die Antworten haben die Form, die
// `confluence-und-laufliste-am-draht.test.ts` am echten Server misst.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  zugang: null as null | Record<string, unknown>,
  naechsterTest: null as null | Record<string, unknown>,
  liste: null as null | Record<string, unknown>,
  listeFehler: false,
  zugangRufe: 0,
  testRufe: 0,
  listenRufe: 0,
  exploreRufe: 0,
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    importAccess: {
      confluence: async () => {
        d.zugangRufe += 1;
        return d.zugang;
      },
      confluenceSchalter: async () => d.zugang,
      confluenceVerbindungstest: async () => {
        d.testRufe += 1;
        d.zugang = { ...(d.zugang ?? {}), letzterVerbindungstest: d.naechsterTest };
        return d.naechsterTest;
      },
    },
    admin: {
      import: {
        explore: async () => {
          d.exploreRufe += 1;
          return {
            summary: {
              totalCount: 0,
              distinctSources: 0,
              dateRange: null,
              authors: [],
              themes: [],
              spaces: [],
            },
            truncated: false,
            alreadyImported: 0,
            alreadyQueued: 0,
            failedPages: 0,
          };
        },
        runs: async () => {
          d.listenRufe += 1;
          if (d.listeFehler) {
            throw new Error("Netz weg");
          }
          return d.liste;
        },
      },
    },
  },
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "admin" }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ImportAccessPanel } from "../../apps/web/src/components/ImportAccessPanel";
import { ImportExplore } from "../../apps/web/src/components/ImportExplore";
import { ImportLaufListe } from "../../apps/web/src/components/ImportLaufListe";
import { ImportCockpitProvider } from "../../apps/web/src/components/ImportStepper";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const VARS = [
  "KLARWERK_CONFLUENCE_BASE_URL",
  "KLARWERK_CONFLUENCE_USER",
  "KLARWERK_CONFLUENCE_TOKEN",
  "KLARWERK_CONFLUENCE_SPACE",
];

const zugang = (teil: Record<string, unknown>): Record<string, unknown> => ({
  system: "confluence",
  enabled: true,
  betreiber: { freigegeben: true, an: true },
  credentials: VARS.map((name) => ({ name, present: true })),
  credentialsUsable: true,
  blocker: null,
  lastConnectedAt: null,
  letzterVerbindungstest: null,
  ...teil,
});

const test = (ergebnis: string): Record<string, unknown> => ({
  geprueftAm: "2026-10-09T07:15:00.000Z",
  umfang: "space-lesen",
  ergebnis,
  dauerMs: 120,
});

const run = (importId: string, teil: Record<string, unknown>): Record<string, unknown> => ({
  importId,
  sourceSystem: "confluence",
  externalId: null,
  sourceScope: "space:FIKTIV",
  requestedSourceVersion: null,
  status: "COMPLETED",
  sourceRecordId: null,
  startedAt: "2026-10-09T07:00:00.000Z",
  completedAt: "2026-10-09T07:02:00.000Z",
  failureCode: null,
  failureReason: null,
  counters: { itemsTotal: 3, itemsCreated: 3, itemsBound: 0, itemsSkipped: 0, itemsFailed: 0 },
  sourceSync: null,
  ...teil,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};
const knoten = (testid: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
const kachel = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('#import-source-gallery [data-id="confluence"]');

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/import"] },
          createElement(ImportAccessPanel),
          createElement(ImportLaufListe),
          createElement(ImportCockpitProvider, null, createElement(ImportExplore)),
        ),
      ),
    );
    await flush();
  });
  for (let i = 0; i < 10 && !knoten("import-access-status"); i++) {
    await act(flush);
  }
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.zugang = null;
  d.naechsterTest = null;
  d.liste = { verfuegbar: true, limit: 50, ausloeserFestgehalten: false, runs: [] };
  d.listeFehler = false;
  d.zugangRufe = 0;
  d.testRufe = 0;
  d.listenRufe = 0;
  d.exploreRufe = 0;
});

afterEach(() => {
  abbauen();
});

const FAELLE = [
  {
    name: "nicht freigegeben",
    antwort: zugang({ enabled: false, betreiber: { freigegeben: false, an: true } }),
    status: "ausgeschaltet",
    state: "unconfigured",
    schritt: "integrationen.confluence.schritt.ausgeschaltet",
  },
  {
    name: "vom Betreiber ausgeschaltet",
    antwort: zugang({ enabled: false, betreiber: { freigegeben: true, an: false } }),
    status: "ausgeschaltet",
    state: "unconfigured",
    schritt: "integrationen.confluence.schritt.betreiberAus",
  },
  {
    name: "fehlende Angaben",
    antwort: zugang({ credentialsUsable: false, blocker: "missing" }),
    status: "nicht-eingerichtet",
    state: "unconfigured",
    schritt: "integrationen.confluence.schritt.nichtEingerichtet",
  },
  {
    name: "hinterlegt, ungeprüft, mit altem Import",
    antwort: zugang({ lastConnectedAt: "2026-08-20T09:00:00.000Z" }),
    status: "konfiguriert",
    state: "available",
    schritt: "integrationen.confluence.schritt.konfiguriert",
  },
  {
    name: "abgewiesene Anmeldung",
    antwort: zugang({ letzterVerbindungstest: test("anmeldung-abgewiesen") }),
    status: "fehlgeschlagen",
    state: "unconfigured",
    schritt: "integrationen.confluence.schritt.anmeldungAbgewiesen",
  },
  {
    name: "Zeitüberschreitung",
    antwort: zugang({ letzterVerbindungstest: test("zeitueberschreitung") }),
    status: "fehlgeschlagen",
    state: "unconfigured",
    schritt: "integrationen.confluence.schritt.zeitueberschreitung",
  },
  {
    name: "Erfolg",
    antwort: zugang({ letzterVerbindungstest: test("erreichbar") }),
    status: "geprueft",
    state: "active",
    schritt: "integrationen.confluence.schritt.erreichbar",
  },
];

describe("ADMIN-02 N2 · Confluence: Karte und Kachel sagen denselben Zustand", () => {
  for (const fall of FAELLE) {
    it(`K · ${fall.name}`, async () => {
      d.zugang = fall.antwort;
      await mount();
      expect(knoten("import-access-status")?.getAttribute("data-status")).toBe(fall.status);
      expect(kachel()?.getAttribute("data-status"), "die Kachel folgt der Auskunft").toBe(
        fall.status,
      );
      expect(kachel()?.getAttribute("data-state")).toBe(fall.state);
      expect(knoten("import-access-naechster-schritt")?.getAttribute("data-schritt")).toBe(
        fall.schritt,
      );
      if (fall.status !== "geprueft") {
        expect(kachel()?.textContent).not.toContain(i18n.t("imp.explore.active"));
        expect(container.textContent).not.toContain(i18n.t("integrationen.status.geprueft"));
      }
    });
  }

  it("K · Freischaltung, Verbindungsnachweis und historischer Import stehen getrennt", async () => {
    d.zugang = zugang({ lastConnectedAt: "2026-08-20T09:00:00.000Z" });
    await mount();
    expect(knoten("import-access-freischaltung")?.dataset.freigegeben).toBe("yes");
    expect(knoten("import-access-verbindungstest-keiner")).not.toBeNull();
    expect(container.textContent).toContain(i18n.t("integrationen.historie.titel"));
    expect(knoten("import-access-lastconnected")?.textContent).toContain("2026");
  });

  it("K · Verbindungstest per Knopf: ein Test, kein Erkunden, Karte und Kachel geprüft", async () => {
    d.zugang = zugang({});
    d.naechsterTest = test("erreichbar");
    await mount();
    const knopf = knoten("import-access-verbindungstest-starten") as HTMLButtonElement | null;
    knopf?.focus();
    expect(document.activeElement).toBe(knopf);
    await act(async () => {
      knopf?.click();
      await flush();
    });
    await act(flush);
    expect(d.testRufe).toBe(1);
    expect(d.exploreRufe, "der Test erkundet nicht").toBe(0);
    const zeile = knoten("import-access-verbindungstest-zeile");
    expect(zeile?.dataset.ergebnis).toBe("erreichbar");
    expect(zeile?.textContent).toContain(i18n.t("integrationen.test.umfang.spaceLesen"));
    expect(knoten("import-access-status")?.dataset.status).toBe("geprueft");
    expect(kachel()?.dataset.status).toBe("geprueft");
  });

  it("K · die Kachel startet im Zustand „eingerichtet, ungeprüft“ weiterhin die Erkundung", async () => {
    d.zugang = zugang({});
    await mount();
    expect(kachel()?.dataset.state).toBe("available");
    await act(async () => {
      kachel()?.click();
      await flush();
    });
    expect(d.exploreRufe).toBe(1);
  });

  it("K · ausgeschaltet: die Kachel startet keine Erkundung, sondern zeigt den Hinweis", async () => {
    d.zugang = zugang({ enabled: false, betreiber: { freigegeben: false, an: true } });
    await mount();
    await act(async () => {
      kachel()?.click();
      await flush();
    });
    expect(d.exploreRufe).toBe(0);
    expect(container.textContent).toContain(i18n.t("integrationen.galerie.hinweisStatus"));
  });
});

describe("ADMIN-02 N2 · Importliste", () => {
  it("I1 · Status, Zeitraum, Zuständigkeit und Fehlerhilfe je Lauf — unterscheidbar", async () => {
    d.zugang = zugang({});
    d.liste = {
      verfuegbar: true,
      limit: 50,
      ausloeserFestgehalten: false,
      runs: [
        run("r-laeuft", { status: "FETCHING", completedAt: null }),
        run("r-fehler", {
          sourceSystem: "sharepoint",
          sourceScope: "drive:b!fiktiv",
          status: "FAILED",
          failureCode: "SHAREPOINT_FORBIDDEN",
          failureReason: "Keine Leseberechtigung für diese SharePoint-Quelle.",
        }),
        run("r-teil", {
          status: "PARTIAL",
          counters: {
            itemsTotal: 3,
            itemsCreated: 2,
            itemsBound: 0,
            itemsSkipped: 0,
            itemsFailed: 1,
          },
        }),
        run("r-fremd", { status: "FAILED", failureCode: "JIRA_IRGENDWAS" }),
        run("r-fertig", {}),
        run("r-ohne-ende", { status: "FAILED", completedAt: null }),
      ],
    };
    await mount();
    for (let i = 0; i < 10 && !knoten("import-laufliste"); i++) {
      await act(flush);
    }
    const hilfe = (id: string) => knoten(`import-lauf-hilfe-${id}`)?.dataset.hilfe;
    expect(hilfe("r-laeuft")).toBe("integrationen.liste.hilfe.laeuft");
    expect(hilfe("r-fehler")).toBe("integrationen.liste.hilfe.keineBerechtigung");
    expect(hilfe("r-teil")).toBe("integrationen.liste.hilfe.teilweise");
    expect(hilfe("r-fremd")).toBe("integrationen.liste.hilfe.unbekannterCode");
    expect(knoten("import-lauf-hilfe-r-fremd")?.textContent).toContain("JIRA_IRGENDWAS");
    expect(hilfe("r-fertig")).toBe("integrationen.liste.hilfe.fertig");
    expect(knoten("import-lauf-status-r-fehler")?.textContent).toBe(i18n.t("w2.run.status.FAILED"));
    // Zeitraum: laufend, abgeschlossen, ohne festgehaltenes Ende — drei verschiedene Sätze.
    expect(knoten("import-lauf-zeitraum-r-laeuft")?.textContent).toMatch(/läuft seit/);
    expect(knoten("import-lauf-zeitraum-r-fertig")?.textContent).toMatch(/bis/);
    expect(knoten("import-lauf-zeitraum-r-ohne-ende")?.textContent).toMatch(/kein Ende/);
    // Zuständigkeit: Rolle genannt, Person ausdrücklich nicht festgehalten.
    expect(knoten("import-lauf-zustaendig-r-fertig")?.textContent).toBe(
      i18n.t("integrationen.liste.zustaendig"),
    );
    expect(knoten("import-laufliste-ausloeser")).not.toBeNull();
    // Laufdetails sind angebunden: aufklappbar, mit Kennung, Fehlercode und Grund.
    const auf = knoten("import-lauf-details-r-fehler") as HTMLButtonElement | null;
    expect(auf?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      auf?.click();
      await flush();
    });
    expect(auf?.getAttribute("aria-expanded")).toBe("true");
    const detail = knoten("import-lauf-detail-r-fehler")?.textContent ?? "";
    expect(detail).toContain("r-fehler");
    expect(detail).toContain("SHAREPOINT_FORBIDDEN");
    expect(detail).toContain("drive:");
  });

  it("I2 · Leer, nicht auflistbar und Fehler sind drei verschiedene Aussagen; Neu laden fragt neu", async () => {
    d.zugang = zugang({});
    await mount();
    for (let i = 0; i < 10 && !knoten("import-laufliste-leer"); i++) {
      await act(flush);
    }
    expect(knoten("import-laufliste-leer")).not.toBeNull();
    const vorher = d.listenRufe;
    d.liste = { verfuegbar: false, limit: 50, ausloeserFestgehalten: false, runs: [] };
    await act(async () => {
      (knoten("import-laufliste-neu-laden") as HTMLButtonElement | null)?.click();
      await flush();
    });
    expect(d.listenRufe).toBeGreaterThan(vorher);
    expect(knoten("import-laufliste-nicht-verfuegbar")).not.toBeNull();
    expect(knoten("import-laufliste-leer")).toBeNull();
    d.listeFehler = true;
    await act(async () => {
      (knoten("import-laufliste-neu-laden") as HTMLButtonElement | null)?.click();
      await flush();
    });
    expect(knoten("import-laufliste-fehler")).not.toBeNull();
    expect(knoten("import-laufliste"), "Fehler vor Daten — keine alte Liste daneben").toBeNull();
  });
});
