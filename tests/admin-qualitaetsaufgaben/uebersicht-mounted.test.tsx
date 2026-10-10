// @vitest-environment jsdom
// ================================================================================================
// ADMIN-10 · DIE QUALITÄTSÜBERSICHT, GEMOUNTET — Anzeige, Filter ↔ Zahl, Rückweg, Übernehmen.
// ================================================================================================
//
// produkt:20261009:admin-qualitaetsaufgaben. Gemessen am ECHTEN Bauteil (`pages/Qualitaetsaufgaben`)
// mit echtem Verlauf (`createMemoryHistory`) und ohne echtes Netz: `fetch` beantwortet genau
// `GET /api/qualitaetsaufgaben` und die Übernahme mit FIKTIVEN Beständen.
//
//   U1  Typ, Zustand, Zuständigkeit, Frist und Alter stehen da; fehlende Zuständigkeit und fehlende
//       Frist werden ausgesprochen; „einmal gezählt" ist als Bilanz sichtbar.
//   U2  Die Zahl an jedem Filterwert ist die Länge der Liste nach seiner Wahl; Filter kombinieren
//       sich und stehen in der Adresse.
//   U3  „Bearbeiten" öffnet den Arbeitsweg genau dieses Vorgangs; Zurück bringt die Filter mit und
//       holt den Stand frisch — ein Abschluss am Ursprung ist danach sichtbar.
//   U4  Übernehmen schreibt einmal, meldet das Ergebnis in einer Live-Region und zeigt den frischen
//       Stand; „bereits" nennt, wer es war.
//   U5  Ohne Recht keine Liste; eine gescheiterte Quelle ist kein „Nichts offen.".
//
// NICHT hier: Layout, Fokusring und 390 px im echten Browser (`tests-smoke/admin-qualitaetsaufgaben`).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type MemoryHistory,
  createMemoryHistory,
} from "../../apps/web/node_modules/@remix-run/router";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import {
  type ReactNode,
  act,
  createElement,
  useLayoutEffect,
  useState,
} from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Route, Router, Routes, useLocation } from "../../apps/web/node_modules/react-router-dom";
import type {
  QualitaetsUebersicht,
  QualitaetsVorgang,
} from "../../apps/web/src/api/qualitaetsaufgaben";
import i18n from "../../apps/web/src/i18n";
import { Qualitaetsaufgaben } from "../../apps/web/src/pages/Qualitaetsaufgaben";
import {
  type Stand,
  abbauen,
  beruhige,
  klicke,
  ort,
  verlauf,
} from "../admin-navigation/vorrichtung";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = (key: string, opts?: Record<string, unknown>): string =>
  opts === undefined ? i18n.t(key) : i18n.t(key, opts);

// ---- Fiktiver Bestand (keine echten Personen, keine echten Inhalte) ------------------------------
const STAND = "2026-10-10T10:00:00.000Z";
const alex = { id: "u-alex", name: "Alex Autorin" };
const pia = { id: "u-pia", name: "Pia Prüferin" };
const bea = { id: "u-bea", name: "Bea Verwaltung" };

function v(teil: Partial<QualitaetsVorgang> & { schluessel: string }): QualitaetsVorgang {
  return {
    typ: "pruefung",
    zustand: "offen",
    ursprung: { art: "ko", id: teil.schluessel.split(":")[1] ?? "" },
    arbeitsweg: "/wissen/x",
    titel: null,
    inhalt: [],
    spaces: [],
    zustaendig: [],
    frist: null,
    ueberfaellig: false,
    seit: "2026-10-07T10:00:00.000Z",
    einstiege: ["pruefboard"],
    ...teil,
  };
}

const KONFLIKT = v({
  schluessel: "konflikt:c1",
  typ: "konflikt",
  ursprung: { art: "konflikt", id: "c1" },
  arbeitsweg: "/konflikte?fall=c1",
  titel: "Fiktiv: Intervall widerspricht der Herstellerangabe",
  inhalt: [
    { koId: "k1", titel: "Fiktiv: Zahnriemen tauschen" },
    { koId: "k3", titel: "Fiktiv: Kühlmittel prüfen" },
  ],
  spaces: ["s-werk"],
  einstiege: ["konflikte"],
});
const REVAL = v({
  schluessel: "revalidierung:k3",
  typ: "revalidierung",
  arbeitsweg: "/lebenszyklus?fall=k3",
  inhalt: [{ koId: "k3", titel: "Fiktiv: Kühlmittel prüfen" }],
  spaces: ["s-werk"],
  zustaendig: [{ ...alex, art: "verantwortlich" }],
  frist: "2020-01-15",
  ueberfaellig: true,
  einstiege: ["lebenszyklus", "anforderung:bibliothek", "anforderung:anlage"],
});
const PRUEFUNG = v({
  schluessel: "pruefung:k1",
  zustand: "in_arbeit",
  arbeitsweg: "/wissen/k1",
  inhalt: [{ koId: "k1", titel: "Fiktiv: Zahnriemen tauschen" }],
  spaces: ["s-werk"],
  zustaendig: [{ ...pia, art: "pruefer" }],
  einstiege: ["pruefboard", "zuweisung:u-pia"],
  seit: null,
});
const MELDUNG_OFFEN = v({
  schluessel: "rueckmeldung:M-1",
  typ: "rueckmeldung",
  ursprung: { art: "meldung", id: "M-1" },
  arbeitsweg: "/wissen/k4",
  inhalt: [{ koId: "k4", titel: "Fiktiv: Spindel reinigen" }],
  zustaendig: [{ ...alex, art: "autor-ersatz" }],
  grund: "antwort-falsch",
  einstiege: ["glocke"],
});
const MELDUNG_ERLEDIGT = v({
  schluessel: "rueckmeldung:M-2",
  typ: "rueckmeldung",
  zustand: "erledigt",
  ursprung: { art: "meldung", id: "M-2" },
  arbeitsweg: "/wissen/k5",
  inhalt: [{ koId: "k5", titel: "Fiktiv: Presse entlüften" }],
  zustaendig: [{ ...alex, art: "autor-ersatz" }],
  grund: "quelle-passt-nicht",
  einstiege: ["glocke"],
  uebernahme: { am: "2026-10-08T09:00:00.000Z", durch: bea, vorgang: "revalidierung:k5" },
  ergebnis: { art: "bestaetigt", am: "2026-10-09T09:00:00.000Z", fassung: 4, durch: alex },
});

const ALLE_OK = {
  pruefung: "ok",
  revalidierung: "ok",
  konflikt: "ok",
  duplikat: "ok",
  luecke: "ok",
  rueckmeldung: "ok",
} as const;

function bestand(vorgaenge: QualitaetsVorgang[]): QualitaetsUebersicht {
  return {
    stand: STAND,
    vorgaenge,
    quellen: { ...ALLE_OK },
    spaces: [{ id: "s-werk", name: "Fiktivwerk Nord" }],
  };
}

// ---- Das Netz: ein veränderlicher Serverstand, jeder Ruf protokolliert ---------------------------
interface Server {
  stand: QualitaetsUebersicht | { status: number; body: unknown };
  uebernahme: (meldungId: string) => unknown;
  rufe: { methode: string; pfad: string }[];
}

function netz(server: Server): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string }) => {
      const pfad = String(eingabe);
      const methode = (init?.method ?? "GET").toUpperCase();
      server.rufe.push({ methode, pfad });
      const antwort = (status: number, body: unknown) => ({
        status,
        ok: status < 400,
        statusText: String(status),
        text: async () => JSON.stringify(body),
      });
      if (methode === "GET" && pfad === "/api/qualitaetsaufgaben") {
        const s = server.stand;
        return "status" in s ? antwort(s.status, s.body) : antwort(200, s);
      }
      const m = /^\/api\/qualitaetsaufgaben\/rueckmeldungen\/([^/]+)\/uebernehmen$/.exec(pfad);
      if (methode === "POST" && m) {
        return antwort(200, server.uebernahme(decodeURIComponent(m[1] ?? "")));
      }
      throw new Error(`kein Netz in diesem Prüfstand: ${methode} ${pfad}`);
    },
  });
}

// ---- Der Prüfstand: die Seite und ein fremdes Ziel in EINEM Router mit echtem Verlauf ------------
function Ortsanzeige(): JSX.Element {
  const o = useLocation();
  return createElement("div", { "data-testid": "ort" }, `${o.pathname}${o.search}`);
}

function VerlaufsRouter({
  verlaufsspeicher,
  children,
}: {
  verlaufsspeicher: MemoryHistory;
  children?: ReactNode;
}): JSX.Element {
  const [zustand, setZustand] = useState({
    action: verlaufsspeicher.action,
    location: verlaufsspeicher.location,
  });
  useLayoutEffect(() => verlaufsspeicher.listen(setZustand), [verlaufsspeicher]);
  return createElement(Router, {
    location: zustand.location,
    navigationType: zustand.action,
    navigator: verlaufsspeicher,
    children,
  });
}

let stand: Stand | null = null;

async function oeffne(pfad: string): Promise<Stand> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const verlaufsspeicher = createMemoryHistory({
    initialEntries: [pfad],
    initialIndex: 0,
    v5Compat: true,
  });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          VerlaufsRouter,
          { verlaufsspeicher },
          createElement(Ortsanzeige),
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/qualitaetsaufgaben",
              element: createElement(Qualitaetsaufgaben),
            }),
            createElement(Route, {
              path: "*",
              element: createElement("div", { "data-testid": "fremde-seite" }),
            }),
          ),
        ),
      ),
    );
  });
  stand = { container, root, verlaufsspeicher };
  await beruhige();
  return stand;
}

const q = (s: Stand, testId: string): HTMLElement | null =>
  s.container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

const zeilen = (s: Stand): HTMLElement[] => [
  ...s.container.querySelectorAll<HTMLElement>('[data-testid="qa-zeile"]'),
];

const zeile = (s: Stand, schluessel: string): HTMLElement | null =>
  s.container.querySelector<HTMLElement>(`[data-schluessel="${schluessel}"]`);

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").trim();

/** Eine Auswahl wie per Tastatur/Maus ändern — über den NATIVEN Setter, sonst sieht React sie nicht. */
async function waehle(feld: Element | null, wert: string): Promise<void> {
  if (!(feld instanceof window.HTMLSelectElement)) {
    throw new Error("Auswahlfeld nicht gefunden.");
  }
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
  await beruhige(3);
}

/** Die Zahl in einer Option „Name (3)". */
function optionsZahl(feld: HTMLElement | null, wert: string): number {
  const option = feld?.querySelector<HTMLOptionElement>(`option[value="${wert}"]`);
  const m = /\((\d+)\)$/.exec(text(option));
  if (!m) {
    throw new Error(`Option ${wert} ohne Zahl: "${text(option)}"`);
  }
  return Number(m[1]);
}

function server(vorgaenge: QualitaetsVorgang[]): Server {
  return {
    stand: bestand(vorgaenge),
    uebernahme: () => {
      throw new Error("unerwartete Übernahme");
    },
    rufe: [],
  };
}

const gets = (s: Server): number =>
  s.rufe.filter((r) => r.methode === "GET" && r.pfad === "/api/qualitaetsaufgaben").length;

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  if (stand) {
    abbauen(stand);
    stand = null;
  }
});

describe("ADMIN-10 · U1 · Typ, Zustand, Zuständigkeit, Frist und Alter", () => {
  it("fehlende Zuständigkeit und Frist werden ausgesprochen; Überfälligkeit und Ergebnis stehen da", async () => {
    const srv = server([KONFLIKT, REVAL, PRUEFUNG, MELDUNG_OFFEN, MELDUNG_ERLEDIGT]);
    netz(srv);
    const s = await oeffne("/qualitaetsaufgaben");
    expect(zeilen(s)).toHaveLength(5);

    const k = zeile(s, "konflikt:c1");
    expect(text(k)).toContain(t("qualitaetsaufgaben.typ.konflikt"));
    expect(text(k?.querySelector('[data-testid="qa-zustand"]'))).toBe(
      t("qualitaetsaufgaben.zustand.offen"),
    );
    expect(text(k?.querySelector('[data-testid="qa-zustaendig"]'))).toBe(
      t("qualitaetsaufgaben.zustaendig.niemand"),
    );
    expect(text(k?.querySelector('[data-testid="qa-frist"]'))).toBe(
      t("qualitaetsaufgaben.frist.keine"),
    );
    expect(text(k?.querySelector('[data-testid="qa-seit"]'))).toBe(
      t("qualitaetsaufgaben.seit.tage", { anzahl: 3 }),
    );
    // Beide betroffenen Inhalte, und die Konfliktbeschreibung darunter.
    expect(text(k)).toContain("Fiktiv: Zahnriemen tauschen ↔ Fiktiv: Kühlmittel prüfen");

    const r = zeile(s, "revalidierung:k3");
    const tag = new Date("2020-01-15T00:00:00").toLocaleDateString("de");
    expect(text(r?.querySelector('[data-testid="qa-frist"]'))).toBe(
      t("qualitaetsaufgaben.frist.ueberfaellig", { datum: tag }),
    );
    expect(text(r?.querySelector('[data-testid="qa-zustaendig"]'))).toContain("Alex Autorin");
    expect(text(r?.querySelector('[data-testid="qa-einstiege"]'))).toBe(
      t("qualitaetsaufgaben.einstiege", { anzahl: 3 }),
    );

    const p = zeile(s, "pruefung:k1");
    expect(text(p?.querySelector('[data-testid="qa-seit"]'))).toBe(
      t("qualitaetsaufgaben.seit.unbekannt"),
    );

    const e = zeile(s, "rueckmeldung:M-2");
    expect(text(e?.querySelector('[data-testid="qa-ergebnis"]'))).toContain("Alex Autorin");
    expect(text(e?.querySelector('[data-testid="qa-uebernahme"]'))).toContain("Bea Verwaltung");
    // Rückbezug: der Weg führt zum Ursprung der Meldung, und dort gibt es nichts zu übernehmen.
    expect(e?.querySelector('[data-testid="qa-oeffnen"]')?.getAttribute("href")).toBe("/wissen/k5");
    expect(e?.querySelector('[data-testid="qa-uebernehmen"]')).toBeNull();

    // Einmal gezählt — als Bilanz sichtbar: 1 + 3 + 2 + 1 + 1 = 8 Einstiege auf 5 Vorgänge.
    expect(text(q(s, "qa-bilanz"))).toBe(t("qualitaetsaufgaben.bilanz", { treffer: 5, gesamt: 5 }));
    expect(text(q(s, "qa-einmal-gezaehlt"))).toBe(
      t("qualitaetsaufgaben.einmalGezaehlt", { einstiege: 8, vorgaenge: 5 }),
    );
  });

  it("jede Auswahl hat eine Beschriftung, jeder Weg einen sprechenden Namen", async () => {
    netz(server([KONFLIKT, REVAL, PRUEFUNG, MELDUNG_OFFEN, MELDUNG_ERLEDIGT]));
    const s = await oeffne("/qualitaetsaufgaben");
    for (const auswahl of s.container.querySelectorAll("select")) {
      const label = s.container.querySelector(`label[for="${auswahl.id}"]`);
      expect(text(label), `${auswahl.id} ohne Beschriftung`).not.toBe("");
    }
    const weg = zeile(s, "konflikt:c1")?.querySelector('[data-testid="qa-oeffnen"]');
    expect(weg?.getAttribute("aria-label")).toContain(t("qualitaetsaufgaben.typ.konflikt"));
    expect(weg?.getAttribute("href")).toBe("/konflikte?fall=c1");
  });
});

describe("ADMIN-10 · U2 · Zahl und Liste, kombinierte Filter in der Adresse", () => {
  it("die Zahl an jedem Wert ist die Länge der Liste nach seiner Wahl", async () => {
    netz(server([KONFLIKT, REVAL, PRUEFUNG, MELDUNG_OFFEN, MELDUNG_ERLEDIGT]));
    const s = await oeffne("/qualitaetsaufgaben?space=s-werk&typ=konflikt");
    expect(zeilen(s).map((z) => z.dataset.schluessel)).toEqual(["konflikt:c1"]);
    expect((q(s, "qa-filter-space") as HTMLSelectElement).value).toBe("s-werk");

    for (const [dimension, wert] of [
      ["typ", "pruefung"],
      ["typ", "revalidierung"],
      ["zustand", "in_arbeit"],
      ["zustaendig", "u-pia"],
      ["zustaendig", "ohne"],
      ["space", "ohne"],
    ] as const) {
      const feld = q(s, `qa-filter-${dimension}`);
      const versprochen = optionsZahl(feld, wert);
      await waehle(feld, wert);
      expect(zeilen(s).length, `${dimension}=${wert}`).toBe(versprochen);
      expect(ort(s)).toContain(`${dimension}=${wert}`);
    }
  });

  it("Filter zurücksetzen zeigt wieder den ganzen Bestand", async () => {
    netz(server([KONFLIKT, REVAL, PRUEFUNG]));
    const s = await oeffne("/qualitaetsaufgaben?typ=pruefung&zustaendig=u-pia");
    expect(zeilen(s)).toHaveLength(1);
    await klicke(q(s, "qa-filter-zuruecksetzen"));
    expect(zeilen(s)).toHaveLength(3);
    expect(ort(s)).toBe("/qualitaetsaufgaben");
  });
});

describe("ADMIN-10 · U3 · Bearbeiten im bestehenden Arbeitsweg, Rückweg mit Filtern", () => {
  it("öffnet genau diesen Vorgang; Zurück behält die Filter und holt den Abschluss frisch", async () => {
    const srv = server([KONFLIKT, REVAL, PRUEFUNG]);
    netz(srv);
    const start = "/qualitaetsaufgaben?space=s-werk&typ=konflikt";
    const s = await oeffne(start);
    const vorherAbrufe = gets(srv);

    await klicke(zeile(s, "konflikt:c1")?.querySelector('[data-testid="qa-oeffnen"]'));
    expect(ort(s)).toBe("/konflikte?fall=c1");
    expect(q(s, "fremde-seite")).not.toBeNull();

    // Am Ursprung wird der Konflikt entschieden — nur er; die übrigen Vorgänge bleiben.
    srv.stand = bestand([REVAL, PRUEFUNG]);
    await verlauf(s, -1);
    expect(ort(s)).toBe(start);
    expect((q(s, "qa-filter-typ") as HTMLSelectElement).value).toBe("konflikt");
    expect((q(s, "qa-filter-space") as HTMLSelectElement).value).toBe("s-werk");
    expect(gets(srv)).toBeGreaterThan(vorherAbrufe);
    expect(zeilen(s)).toHaveLength(0);
    expect(text(q(s, "qa-leer"))).toBe(t("qualitaetsaufgaben.leerGefiltert"));
    expect(text(q(s, "qa-bilanz"))).toBe(t("qualitaetsaufgaben.bilanz", { treffer: 0, gesamt: 2 }));
  });
});

describe("ADMIN-10 · U4 · Rückmeldung übernehmen", () => {
  it("ein Klick, ein Schreibruf, Meldung in der Live-Region, frischer Stand ohne Doppel", async () => {
    const srv = server([REVAL, MELDUNG_OFFEN]);
    srv.uebernahme = (meldungId) => {
      srv.stand = bestand([
        REVAL,
        v({
          schluessel: "revalidierung:k4",
          typ: "revalidierung",
          arbeitsweg: "/lebenszyklus?fall=k4",
          inhalt: [{ koId: "k4", titel: "Fiktiv: Spindel reinigen" }],
          zustaendig: [{ ...alex, art: "autor-ersatz" }],
          einstiege: ["lebenszyklus", "anforderung:rueckmeldung", `rueckmeldung:${meldungId}`],
          rueckmeldungen: [{ meldungId, grund: "antwort-falsch", at: STAND }],
        }),
      ]);
      return { art: "angelegt", vorgang: "revalidierung:k4", am: STAND, durch: bea };
    };
    netz(srv);
    const s = await oeffne("/qualitaetsaufgaben");
    await klicke(zeile(s, "rueckmeldung:M-1")?.querySelector('[data-testid="qa-uebernehmen"]'));
    await beruhige();

    const schreibend = srv.rufe.filter((r) => r.methode !== "GET");
    expect(schreibend).toEqual([
      { methode: "POST", pfad: "/api/qualitaetsaufgaben/rueckmeldungen/M-1/uebernehmen" },
    ]);
    const live = q(s, "qa-meldung");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(text(live)).toBe(
      t("qualitaetsaufgaben.uebernahme.angelegt", { titel: "Fiktiv: Spindel reinigen" }),
    );
    expect(zeile(s, "rueckmeldung:M-1")).toBeNull();
    const neu = zeile(s, "revalidierung:k4");
    expect(text(neu?.querySelector('[data-testid="qa-angehaengt"]'))).toContain("M-1");
    expect(zeilen(s)).toHaveLength(2);
  });

  it("„bereits“: eine zweite Person hat schon übernommen — die Fläche nennt sie und lädt frisch", async () => {
    const srv = server([MELDUNG_OFFEN]);
    srv.uebernahme = () => {
      srv.stand = bestand([]);
      return { art: "bereits", vorgang: "revalidierung:k4", am: STAND, durch: bea };
    };
    netz(srv);
    const s = await oeffne("/qualitaetsaufgaben");
    await klicke(zeile(s, "rueckmeldung:M-1")?.querySelector('[data-testid="qa-uebernehmen"]'));
    await beruhige();
    expect(text(q(s, "qa-meldung"))).toContain("Bea Verwaltung");
    expect(zeile(s, "rueckmeldung:M-1")).toBeNull();
  });
});

describe("ADMIN-10 · U5 · Rechte und fehlende Signale", () => {
  it("ohne Verwaltungsrecht: ein verständlicher Hinweis, keine Liste", async () => {
    const srv = server([]);
    srv.stand = { status: 403, body: { error: "FORBIDDEN", message: "Keine Berechtigung." } };
    netz(srv);
    const s = await oeffne("/qualitaetsaufgaben");
    expect(text(q(s, "qa-ladezustand"))).toBe(t("qualitaetsaufgaben.recht"));
    expect(zeilen(s)).toHaveLength(0);
  });

  it("eine gescheiterte Quelle: Warnung, und das Leere heisst nicht „Nichts offen.“", async () => {
    const srv = server([]);
    srv.stand = { ...bestand([]), quellen: { ...ALLE_OK, duplikat: "fehler" } };
    netz(srv);
    const s = await oeffne("/qualitaetsaufgaben");
    expect(text(q(s, "qa-quelle-fehlt"))).toBe(
      t("qualitaetsaufgaben.quelleFehlt", { liste: t("qualitaetsaufgaben.typ.duplikat") }),
    );
    expect(text(q(s, "qa-leer"))).toBe(t("qualitaetsaufgaben.leerUnvollstaendig"));
    expect(text(q(s, "qa-leer"))).not.toBe(t("qualitaetsaufgaben.leer"));
  });
});
