// @vitest-environment jsdom
// ================================================================================================
// ADMIN-02 · DIE STATUSFALL-MATRIX AN DER MONTIERTEN IMPORTSEITE — GALERIE UND ZUGANGSBEREICH.
// ================================================================================================
//
// Montiert wird der Ausschnitt aus `pages/Stufe2.tsx`, in dem BEIDE Einstiege stehen: der
// SharePoint-Bereich (Zugangskarte, Verbindungstest, Dateiliste) und die Quellen-Galerie im
// Cockpit (Systemkachel „SharePoint"). Attrappe ist GENAU die Drahtgrenze
// (`components/sharepoint-import/api.ts`); die Antworten sind die fiktiven Serverantworten der
// Statusfälle, wortgleich in der Form, die `verbindungstest-am-draht.test.ts` am echten Server misst.
//
// GEMESSEN je Fall: Kachelzustand, Kachelabzeichen, Kartenzustand, nächster Schritt, Testzeile —
// und dass KEIN Einstieg „aktiv" oder „Verbindung geprüft" sagt, solange es nicht zutrifft.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  zugang: null as null | Record<string, unknown>,
  /** Was der nächste Verbindungstest liefert; danach liefert auch die Auskunft genau ihn. */
  naechsterTest: null as null | Record<string, unknown>,
  zugangRufe: 0,
  testRufe: 0,
  dateienRufe: 0,
  uebernahmeRufe: 0,
  uebernahme: null as null | Record<string, unknown>,
}));

vi.mock("../../apps/web/src/components/sharepoint-import/api", () => ({
  sharepointApi: {
    zugang: async () => {
      d.zugangRufe += 1;
      return d.zugang;
    },
    verbindungstest: async () => {
      d.testRufe += 1;
      // Der Server hält das Ergebnis fest — die nächste Auskunft trägt es.
      d.zugang = { ...(d.zugang ?? {}), letzterVerbindungstest: d.naechsterTest };
      return d.naechsterTest;
    },
    dateien: async () => {
      d.dateienRufe += 1;
      return {
        dateien: [
          {
            id: "01FIKTIV",
            name: "Fiktive-Anleitung.docx",
            url: null,
            geaendertAm: "2026-10-01T08:00:00Z",
            groesseBytes: 100,
            inhaltstyp: "nur-merkmale",
          },
          {
            id: "01FIKTIV2",
            name: "Fiktiv-leer.txt",
            url: null,
            geaendertAm: "2026-10-01T08:00:00Z",
            groesseBytes: 0,
            inhaltstyp: "leer",
          },
        ],
        truncated: false,
        nurBefunde: false,
        befunde: [],
      };
    },
    inhalte: async (ids: string[]) => ({
      dateien: [],
      truncated: false,
      nurBefunde: true,
      befunde: ids.map((id) => ({ id, befund: id === "01FIKTIV2" ? "leer" : "nur-merkmale" })),
    }),
    uebernehmen: async () => {
      d.uebernahmeRufe += 1;
      return d.uebernahme;
    },
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      import: {
        explore: vi.fn(async () => ({
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
        })),
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
import { ImportExplore } from "../../apps/web/src/components/ImportExplore";
import { ImportCockpitProvider } from "../../apps/web/src/components/ImportStepper";
import { SharePointImportBereich } from "../../apps/web/src/components/sharepoint-import/SharePointImportBereich";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

/** Fiktive Variablennamen-Zustände — Namen, nie Werte. */
const ALLE_DA = [
  { name: "KLARWERK_SHAREPOINT_BASE_URL", present: true },
  { name: "KLARWERK_SHAREPOINT_TOKEN", present: true },
  { name: "KLARWERK_SHAREPOINT_DRIVE", present: true },
];
const TOKEN_FEHLT = [
  { name: "KLARWERK_SHAREPOINT_BASE_URL", present: true },
  { name: "KLARWERK_SHAREPOINT_TOKEN", present: false },
  { name: "KLARWERK_SHAREPOINT_DRIVE", present: true },
];

const zugang = (teil: Record<string, unknown>): Record<string, unknown> => ({
  system: "sharepoint",
  enabled: true,
  credentials: ALLE_DA,
  credentialsUsable: true,
  blocker: null,
  lastConnectedAt: null,
  letzterVerbindungstest: null,
  ...teil,
});

const test = (ergebnis: string): Record<string, unknown> => ({
  geprueftAm: "2026-10-09T07:15:00.000Z",
  umfang: "bibliothek-lesen",
  ergebnis,
  dauerMs: 412,
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
  container.querySelector<HTMLElement>('#import-source-gallery [data-id="sharepoint"]');

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Dieselbe Verschachtelung wie `ImportReview` in pages/Stufe2.tsx: Bereich und Cockpit teilen
  // sich EINEN Abfragespeicher.
  await act(async () => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/import"] },
          createElement(
            ImportCockpitProvider,
            null,
            createElement(SharePointImportBereich),
            createElement(ImportExplore),
          ),
        ),
      ),
    );
    await flush();
  });
  for (let i = 0; i < 10 && !knoten("sharepoint-zugang-state"); i++) {
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
  d.zugangRufe = 0;
  d.testRufe = 0;
  d.dateienRufe = 0;
  d.uebernahmeRufe = 0;
  d.uebernahme = null;
});

afterEach(() => {
  abbauen();
});

interface Fall {
  name: string;
  antwort: Record<string, unknown>;
  status: string;
  kachelState: string;
  kachelAbzeichen: string;
  schritt: string;
}

const FAELLE: Fall[] = [
  {
    name: "ausgeschaltet (Schalter aus, keine Angaben)",
    antwort: zugang({
      enabled: false,
      credentials: TOKEN_FEHLT,
      credentialsUsable: false,
      blocker: "missing",
    }),
    status: "ausgeschaltet",
    kachelState: "unconfigured",
    kachelAbzeichen: "integrationen.status.ausgeschaltet",
    schritt: "integrationen.test.schritt.ausgeschaltet",
  },
  {
    name: "fehlende Angaben (eingeschaltet, Token fehlt)",
    antwort: zugang({ credentials: TOKEN_FEHLT, credentialsUsable: false, blocker: "missing" }),
    status: "nicht-eingerichtet",
    kachelState: "unconfigured",
    kachelAbzeichen: "integrationen.status.nichtEingerichtet",
    schritt: "integrationen.test.schritt.nichtEingerichtet",
  },
  {
    name: "hinterlegt, ungeprüft — mit altem erfolgreichem Import",
    antwort: zugang({ lastConnectedAt: "2026-08-20T09:00:00.000Z" }),
    status: "konfiguriert",
    kachelState: "available",
    kachelAbzeichen: "integrationen.status.konfiguriert",
    schritt: "integrationen.schritt.konfiguriert",
  },
  {
    name: "abgewiesene Anmeldung",
    antwort: zugang({ letzterVerbindungstest: test("anmeldung-abgewiesen") }),
    status: "fehlgeschlagen",
    kachelState: "unconfigured",
    kachelAbzeichen: "integrationen.status.fehlgeschlagen",
    schritt: "integrationen.test.schritt.anmeldungAbgewiesen",
  },
  {
    name: "Zeitüberschreitung",
    antwort: zugang({ letzterVerbindungstest: test("zeitueberschreitung") }),
    status: "fehlgeschlagen",
    kachelState: "unconfigured",
    kachelAbzeichen: "integrationen.status.fehlgeschlagen",
    schritt: "integrationen.test.schritt.zeitueberschreitung",
  },
  {
    name: "Erfolg (Verbindungstest erreichbar)",
    antwort: zugang({ letzterVerbindungstest: test("erreichbar") }),
    status: "geprueft",
    kachelState: "active",
    kachelAbzeichen: "integrationen.status.geprueft",
    schritt: "integrationen.test.schritt.erreichbar",
  },
];

describe("ADMIN-02 · Statusfall-Matrix — Galeriekachel und Zugangskarte sagen dasselbe", () => {
  for (const fall of FAELLE) {
    it(`M · ${fall.name}`, async () => {
      d.zugang = fall.antwort;
      await mount();

      const karte = knoten("sharepoint-zugang-state");
      expect(karte?.getAttribute("data-status"), "Kartenzustand").toBe(fall.status);
      expect(karte?.textContent).toBe(i18n.t(fall.kachelAbzeichen));

      const k = kachel();
      expect(k, "die SharePoint-Kachel der Galerie steht da").not.toBeNull();
      expect(k?.getAttribute("data-status"), "Kachel und Karte nennen denselben Zustand").toBe(
        fall.status,
      );
      expect(k?.getAttribute("data-state")).toBe(fall.kachelState);
      expect(k?.textContent).toContain(i18n.t(fall.kachelAbzeichen));

      const schritt = knoten("sharepoint-naechster-schritt");
      expect(schritt?.getAttribute("data-schritt")).toBe(fall.schritt);
      expect(schritt?.textContent).toContain(i18n.t(fall.schritt));

      // K1/K2: kein Einstieg behauptet Einsatzbereitschaft, solange kein Test sie belegt.
      if (fall.status !== "geprueft") {
        expect(k?.textContent).not.toContain(i18n.t("imp.explore.active"));
        expect(container.textContent).not.toContain(i18n.t("integrationen.status.geprueft"));
        expect(k?.getAttribute("data-state")).not.toBe("active");
      }
    });
  }

  it("M · die Ergebnisse sind untereinander unterscheidbar: kein Schritt- oder Ergebnistext doppelt", () => {
    const schritte = FAELLE.map((f) => i18n.t(f.schritt));
    expect(new Set(schritte).size).toBe(schritte.length);
  });
});

describe("ADMIN-02 · Verbindungsnachweis und historischer Import sind getrennt", () => {
  it("N1 · hinterlegt allein: kein Testnachweis, der alte Import steht als HISTORISCHER Nachweis", async () => {
    d.zugang = zugang({ lastConnectedAt: "2026-08-20T09:00:00.000Z" });
    await mount();
    expect(knoten("sharepoint-verbindungstest-keiner")?.textContent).toBe(
      i18n.t("integrationen.test.keiner"),
    );
    expect(knoten("sharepoint-verbindungstest-zeile")).toBeNull();
    // Die Zeile des alten Imports steht unter der Überschrift „historischer Nachweis".
    expect(container.textContent).toContain(i18n.t("integrationen.historie.titel"));
    expect(knoten("sharepoint-zugang-lastconnected")?.textContent).toContain("2026");
    expect(knoten("sharepoint-zugang-state")?.getAttribute("data-status")).toBe("konfiguriert");
  });

  it("N2 · ein Nachweis nennt Zeitpunkt, geprüften Umfang und Ergebnis", async () => {
    d.zugang = zugang({ letzterVerbindungstest: test("anmeldung-abgewiesen") });
    await mount();
    const zeile = knoten("sharepoint-verbindungstest-zeile");
    expect(zeile?.getAttribute("data-ergebnis")).toBe("anmeldung-abgewiesen");
    expect(zeile?.getAttribute("data-umfang")).toBe("bibliothek-lesen");
    const text = zeile?.textContent ?? "";
    expect(text).toContain(i18n.t("integrationen.test.umfang.bibliothekLesen"));
    expect(text).toContain(i18n.t("integrationen.test.ergebnis.anmeldungAbgewiesen"));
    expect(text).toMatch(/2026/);
    expect(text, "kein roher ISO-Zeitstempel").not.toContain("T07:15:00");
  });
});

describe("ADMIN-02 · Diagnose bewusst gestartet, Wirkung erklärt, kein Import", () => {
  it("D1 · Knopf → genau ein Test, Ergebnis erscheint, Auskunft frisch; keine Übernahme", async () => {
    d.zugang = zugang({});
    d.naechsterTest = test("erreichbar");
    await mount();
    // Vorher: ungeprüft. Die Wirkung steht neben dem Knopf.
    expect(knoten("sharepoint-zugang-state")?.getAttribute("data-status")).toBe("konfiguriert");
    expect(knoten("sharepoint-verbindungstest-wirkung")?.textContent).toBe(
      i18n.t("integrationen.test.wirkung"),
    );
    const knopf = knoten("sharepoint-verbindungstest-starten") as HTMLButtonElement | null;
    expect(knopf?.tagName).toBe("BUTTON");
    expect(knopf?.textContent).toContain(i18n.t("integrationen.test.knopf"));
    // Es lief noch KEIN Test von selbst.
    expect(d.testRufe).toBe(0);
    const zugangVorher = d.zugangRufe;

    await act(async () => {
      knopf?.click();
      await flush();
    });
    await act(flush);

    expect(d.testRufe, "genau ein Test pro Klick").toBe(1);
    expect(d.zugangRufe, "die Auskunft wird danach neu geholt").toBeGreaterThan(zugangVorher);
    expect(knoten("sharepoint-verbindungstest-zeile")?.getAttribute("data-ergebnis")).toBe(
      "erreichbar",
    );
    expect(knoten("sharepoint-zugang-state")?.getAttribute("data-status")).toBe("geprueft");
    expect(kachel()?.getAttribute("data-status"), "die Galerie folgt").toBe("geprueft");
    // K4: die Diagnose hat nichts übernommen.
    expect(d.uebernahmeRufe).toBe(0);
  });

  it("D2 · Tastatur: der Knopf ist fokussierbar und mit Enter/Leertaste ein echter <button>", async () => {
    d.zugang = zugang({});
    await mount();
    const knopf = knoten("sharepoint-verbindungstest-starten") as HTMLButtonElement | null;
    knopf?.focus();
    expect(document.activeElement).toBe(knopf);
    expect(knopf?.getAttribute("type") ?? "button").not.toBe("submit");
  });
});

describe("ADMIN-02 · Fähigkeiten getrennt benannt, Zuständigkeit sichtbar, kein Wert", () => {
  it("F1 · Import, Metadatenübernahme, Dokumentvorschau und Office-Bearbeitung — vier eigene Zeilen", async () => {
    d.zugang = zugang({});
    await mount();
    const zeilen = [
      ...(knoten("sharepoint-faehigkeiten")?.querySelectorAll("[data-faehigkeit]") ?? []),
    ];
    expect(zeilen.map((z) => z.getAttribute("data-faehigkeit"))).toEqual([
      "import",
      "metadaten",
      "vorschau",
      "office",
    ]);
    expect(new Set(zeilen.map((z) => z.textContent)).size).toBe(4);
    expect(zeilen[3]?.textContent).toBe(i18n.t("integrationen.faehigkeit.office"));
  });

  it("F2 · Zuständigkeit und Einrichtungshinweise stehen da — Variablennamen ja, Werte nie", async () => {
    d.zugang = zugang({ credentials: TOKEN_FEHLT, credentialsUsable: false, blocker: "missing" });
    await mount();
    const zustaendig = knoten("sharepoint-zustaendigkeit")?.textContent ?? "";
    expect(zustaendig).toContain(i18n.t("imp.access.whoMay"));
    expect(zustaendig).toContain(i18n.t("integrationen.zustaendig.test"));
    expect(knoten("sharepoint-zugang-var-KLARWERK_SHAREPOINT_TOKEN")?.dataset.present).toBe("no");
    const alles = container.textContent ?? "";
    expect(alles).not.toMatch(/Bearer\s/);
    expect(alles).not.toMatch(/••/);
    // Es gibt kein Eingabefeld für Zugangsdaten auf der Karte.
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it("F3 · die Galerie zählt „bald“ und „geplant“ NICHT als verfügbare Anbindung", async () => {
    d.zugang = zugang({ enabled: false, credentialsUsable: false });
    await mount();
    const zeile = knoten("import-gallery-verfuegbar")?.textContent ?? "";
    expect(zeile).toContain("Confluence");
    expect(zeile).toContain("SharePoint");
    expect(zeile).not.toContain("Jira");
    expect(zeile).not.toContain("Notion");
  });
});

describe("ADMIN-02 · Übernahmebilanz: teilweise gegen vollständig, mit nächstem Schritt", () => {
  async function uebernimm(ids: string[], antwort: Record<string, unknown>): Promise<void> {
    d.zugang = zugang({ letzterVerbindungstest: test("erreichbar") });
    d.uebernahme = antwort;
    await mount();
    for (let i = 0; i < 20 && !knoten(`sharepoint-datei-${ids[0]}`); i++) {
      await act(flush);
    }
    for (const id of ids) {
      await act(async () => {
        (knoten(`sharepoint-datei-${id}`) as HTMLInputElement | null)?.click();
        await flush();
      });
    }
    for (
      let i = 0;
      i < 20 && (knoten("sharepoint-uebernehmen") as HTMLButtonElement | null)?.disabled !== false;
      i++
    ) {
      await act(flush);
    }
    await act(async () => {
      (knoten("sharepoint-uebernehmen") as HTMLButtonElement | null)?.click();
      await flush();
    });
    await act(flush);
  }

  it("B1 · Teilübernahme: eine Datei übernommen, eine leer → „Teilweise übernommen: 1 von 2“", async () => {
    await uebernimm(["01FIKTIV", "01FIKTIV2"], {
      imported: 1,
      alreadyQueued: 0,
      neuerStand: [],
      failed: [],
      notFound: [],
      ohneInhalt: [{ id: "01FIKTIV2", befund: "leer" }],
      dateien: [
        {
          id: "01FIKTIV",
          name: "Fiktive-Anleitung.docx",
          url: null,
          geaendertAm: null,
          inhalt: "nur-merkmale",
        },
      ],
      importId: "lauf-fiktiv-1",
    });
    const bilanz = knoten("sharepoint-bilanz");
    expect(bilanz?.getAttribute("data-bilanz")).toBe("teil");
    expect(bilanz?.textContent).toBe(i18n.t("integrationen.bilanz.teil", { ok: 1, gesamt: 2 }));
    expect(d.uebernahmeRufe).toBe(1);
  });

  it("B2 · Gesamtübernahme inkl. schon Vorhandenem → „Vollständig verarbeitet: 1 von 1“", async () => {
    await uebernimm(["01FIKTIV"], {
      imported: 0,
      alreadyQueued: 1,
      neuerStand: [],
      failed: [],
      notFound: [],
      ohneInhalt: [],
      dateien: [],
      importId: "lauf-fiktiv-2",
    });
    const bilanz = knoten("sharepoint-bilanz");
    expect(bilanz?.getAttribute("data-bilanz")).toBe("gesamt");
    expect(bilanz?.textContent).toBe(i18n.t("integrationen.bilanz.gesamt", { gesamt: 1 }));
  });
});

describe("ADMIN-02 · Sprachen", () => {
  it("S1 · EN und NL zeigen Zustand und Schritt in ihrer Sprache — kein Schlüssel, kein Deutsch", async () => {
    const deutsch = i18n.getResource("de", "translation", "integrationen.status.nichtEingerichtet");
    for (const sprache of ["en", "nl"]) {
      await i18n.changeLanguage(sprache);
      d.zugang = zugang({ credentials: TOKEN_FEHLT, credentialsUsable: false, blocker: "missing" });
      await mount();
      const text = container.textContent ?? "";
      expect(text).not.toContain("integrationen.");
      expect(knoten("sharepoint-zugang-state")?.textContent).not.toBe(deutsch);
      abbauen();
    }
    await i18n.changeLanguage("de");
  });
});
