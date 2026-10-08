// @vitest-environment jsdom
// ================================================================================================
// STATUS-FREIGABE (produkt:20261007) · DIE FREIGABEANGABEN DER ANLEITUNG AN DER FLÄCHE.
// ================================================================================================
//
// Originalkriterien dieses Prüfstands:
//   K3 · Neue Anleitungsfreigabe zeigt tatsächlich handelnde Person, Zeitpunkt und Fassung auch nach
//        Reload — hier: Übersicht UND Detail zeigen aus der Serverantwort dieselbe Person (Name aus
//        dem Verzeichnis), denselben Zeitpunkt und dieselbe Fassung; „Reload" ist ein neuer Aufbau
//        der Fläche mit neuem Abruf.
//   K4 · Unbekannte historische Freigabeperson wird nicht erfunden — ohne festgehaltene Angabe
//        steht „nicht festgehalten", und es erscheint kein Name, auch nicht der der Urheberin.
//   K5 · Klaras Zeige-Modus nimmt den Status über `objektstatusAus` WÖRTLICH aus dem gezeichneten
//        Statusblock derselben Anleitung — in Übersicht und Detail.
//
// Bauform wie `tests/fe001-arbeitsanleitungen/pruefstatus-uebersicht-und-detail.test.tsx`: `fetch`
// ist adressabhängig festgelegt; kein Netz, kein Server, kein Browser. Die Serverseite (wer wird
// festgehalten) prüft `anleitung-entscheidung.test.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";

const sitzung = vi.hoisted(() => ({ rolle: "experte" as string, antworten: 0 }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => {
      sitzung.antworten += 1;
      return { id: "u1", name: "Lesende Person", email: "l@x.de", role: sitzung.rolle };
    }),
    logout: vi.fn(async () => ({})),
  },
}));

import type { AnweisungListeneintrag } from "../../apps/web/src/api/endpoints";
import type {
  AnweisungEntscheidung,
  AnweisungLesestand,
  AnweisungStand,
} from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import {
  GesamtanweisungBereich,
  LISTE_MARKE,
} from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungBereich";
import { SEITE_MARKE } from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungSeite";
import {
  type Freigabeeingabe,
  freigabeanzeige,
} from "../../apps/web/src/components/gesamtanweisung/zustand";
import i18n from "../../apps/web/src/i18n";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";
import { objektstatusAus } from "../../apps/web/src/lib/statusFreigabe";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const GEAENDERT = "2026-10-07T10:30:00.000Z";
const ENTSCHIEDEN_AM = "2026-10-07T09:15:00.000Z";

function text(schluessel: string, werte?: Record<string, unknown>): string {
  return i18n.t(schluessel, { lng: "de", ...werte });
}

const PRUEFEN = { darfVorlegen: true, darfEntscheiden: true };
const BASIS: Freigabeeingabe = {
  stand: "entschieden",
  version: 5,
  geaendertAm: GEAENDERT,
  abschnitte: 1,
  unvollstaendig: false,
};

// ================================================================================================
// TEIL A · DIE ABLEITUNG
// ================================================================================================

describe("A · freigabeanzeige mit festgehaltener Entscheidung", () => {
  it("K3 · Person, Zeitpunkt und Fassung kommen aus der Entscheidung", () => {
    const e: AnweisungEntscheidung = {
      ergebnis: "angenommen",
      von: "u-carla",
      am: ENTSCHIEDEN_AM,
      version: 5,
    };
    expect(freigabeanzeige({ ...BASIS, entscheidung: e }, PRUEFEN).pruefung).toEqual({
      schluessel: "statusfreigabe.anleitung.freigegebenVon",
      am: ENTSCHIEDEN_AM,
      von: "u-carla",
      nummer: 5,
    });
    const ablehnung = freigabeanzeige(
      { ...BASIS, stand: "abgelehnt", version: 7, entscheidung: { ...e, ergebnis: "abgelehnt" } },
      PRUEFEN,
    );
    expect(ablehnung.pruefung).toMatchObject({
      schluessel: "statusfreigabe.anleitung.abgelehntVon",
      von: "u-carla",
      nummer: 5,
    });
  });

  it("K4 · passt die Angabe nicht zum Stand, gilt sie als nicht festgehalten — nie als Person", () => {
    const e: AnweisungEntscheidung = {
      ergebnis: "angenommen",
      von: "u-carla",
      am: ENTSCHIEDEN_AM,
      version: 4,
    };
    // Fassung passt nicht zur freigegebenen: der Altsatz ohne Person.
    expect(freigabeanzeige({ ...BASIS, entscheidung: e }, PRUEFEN).pruefung).toEqual({
      schluessel: "fe001.status.pruefung.freigegeben",
      am: GEAENDERT,
    });
    // Ergebnis passt nicht zum Stand: ebenfalls keine Person.
    const falsch = freigabeanzeige({ ...BASIS, stand: "abgelehnt", entscheidung: e }, PRUEFEN);
    expect(falsch.pruefung).toEqual({ schluessel: "fe001.status.pruefung.abgelehnt", am: null });
    // Vorgelegt: keine Prüfangabe, auch wenn eine alte Entscheidung im Datensatz steht.
    expect(
      freigabeanzeige({ ...BASIS, stand: "vorgelegt", entscheidung: e }, PRUEFEN).pruefung,
    ).toBeNull();
    // Ohne Angabe: unverändert der Altsatz — und er sagt „nicht festgehalten".
    expect(freigabeanzeige(BASIS, PRUEFEN).pruefung?.schluessel).toBe(
      "fe001.status.pruefung.freigegeben",
    );
    expect(text("fe001.status.pruefung.freigegeben", { nummer: 5, zeit: "x" })).toContain(
      "nicht festgehalten",
    );
  });

  it("die neuen Sätze liegen in DE, EN und NL vor", () => {
    for (const sprache of ["de", "en", "nl"]) {
      for (const s of [
        "statusfreigabe.anleitung.freigegebenVon",
        "statusfreigabe.anleitung.abgelehntVon",
        "statusfreigabe.klara.titel",
        "statusfreigabe.klara.hinweis",
      ]) {
        const wert = i18n.getResource(sprache, "translation", s);
        expect(typeof wert === "string" && wert.length > 0, `${sprache}: ${s} fehlt`).toBe(true);
      }
    }
  });
});

// ================================================================================================
// TEIL B · DIE MONTIERTE FLÄCHE — Übersicht und Detail derselben Anleitung
// ================================================================================================

let container: HTMLDivElement;
let root: Root;
let echtesFetch: typeof globalThis.fetch;
let detailAbrufe = 0;

function lesestand(
  stand: AnweisungStand,
  version: number,
  entscheidung?: AnweisungEntscheidung,
): AnweisungLesestand {
  return {
    id: "a-1",
    titel: "Start im Homeoffice",
    zweck: "Einarbeitung",
    geltungsbereich: "Alle Teams",
    voraussetzungen: "",
    stand,
    version,
    urheber: "u-pia",
    erstelltAm: "2026-10-01T08:00:00.000Z",
    geaendertAm: GEAENDERT,
    ...(entscheidung ? { entscheidung } : {}),
    bausteine: [
      {
        id: "b-1",
        position: 0,
        koId: "ko-a",
        koVersion: 1,
        nachweisHash: null,
        voraussetzung: null,
        herkunft: {
          titel: "Arbeitsplatz einrichten",
          autor: "u-pia",
          fassungAm: "2026-09-25T08:00:00.000Z",
          status: "validated",
        },
        rumpfHtml: "<p>Dockingstation anschließen.</p>",
        aktuelleKoVersion: 1,
        aktualisierungsvorschlag: null,
        inhalt: { tabellenUeberschriften: [], abbildungen: [], geltung: null },
      },
    ],
    unvollstaendig: false,
    verborgeneBausteine: 0,
    pruefanbindung: "nicht_angebunden",
  };
}

function listeneintrag(
  stand: AnweisungStand,
  version: number,
  entscheidung?: AnweisungEntscheidung,
): AnweisungListeneintrag {
  return {
    id: "a-1",
    titel: "Start im Homeoffice",
    stand,
    version,
    urheber: "u-pia",
    erstelltAm: "2026-10-01T08:00:00.000Z",
    geaendertAm: GEAENDERT,
    ...(entscheidung ? { entscheidung } : {}),
    sichtbareBausteine: 1,
    verborgeneBausteine: 0,
    unvollstaendig: false,
  };
}

function serviere(stand: AnweisungStand, version: number, entscheidung?: AnweisungEntscheidung) {
  globalThis.fetch = (async (eingabe: unknown) => {
    const adresse = String(eingabe);
    const antwort = (status: number, rumpf: unknown) =>
      ({
        status,
        ok: status >= 200 && status < 300,
        statusText: String(status),
        text: async () => JSON.stringify(rumpf),
      }) as unknown as Response;
    if (adresse === "/api/gesamtanweisungen") {
      return antwort(200, { eintraege: [listeneintrag(stand, version, entscheidung)] });
    }
    if (adresse === "/api/gesamtanweisungen/a-1") {
      detailAbrufe += 1;
      return antwort(200, lesestand(stand, version, entscheidung));
    }
    if (adresse === "/api/gesamtanweisungen/a-1/staende") {
      return antwort(200, { staende: [version] });
    }
    if (adresse === "/api/directory") {
      return antwort(200, [
        { id: "u-pia", name: "Pia Beispiel" },
        { id: "u-carla", name: "Carla Beispiel" },
      ]);
    }
    return antwort(404, { error: "NOT_FOUND", message: adresse });
  }) as typeof globalThis.fetch;
}

beforeEach(() => {
  echtesFetch = globalThis.fetch;
  detailAbrufe = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.fetch = echtesFetch;
  sitzung.rolle = "experte";
});

async function zeige(pfad: string): Promise<void> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [pfad] },
        createElement(
          QueryClientProvider,
          { client },
          createElement(
            AuthProvider,
            null,
            createElement(
              RoleProvider,
              null,
              createElement(
                Routes,
                null,
                createElement(Route, {
                  path: "/gesamtanweisungen",
                  element: createElement(GesamtanweisungBereich),
                }),
                createElement(Route, {
                  path: "/gesamtanweisungen/:id",
                  element: createElement(GesamtanweisungBereich),
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

async function neuAufbauen(pfad: string): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  root = createRoot(container);
  await zeige(pfad);
}

async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 200 && !bedingung(); i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 10));
    });
  }
  expect(bedingung(), `Die Fläche hat nie erreicht: ${was}`).toBe(true);
}

const marke = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const inhalt = (e: Element | null) => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

const CARLA: AnweisungEntscheidung = {
  ergebnis: "angenommen",
  von: "u-carla",
  am: ENTSCHIEDEN_AM,
  version: 5,
};

describe("B · K3 — die festgehaltene Freigabe in Übersicht und Detail, auch nach neuem Aufbau", () => {
  it("Person (Name aus dem Verzeichnis), Zeitpunkt und Fassung — identisch in beiden Ansichten", async () => {
    serviere("entschieden", 5, CARLA);
    const zeit = formatKoTimestamp(ENTSCHIEDEN_AM, "de") as string;
    const erwartet = text("statusfreigabe.anleitung.freigegebenVon", {
      name: "Carla Beispiel",
      zeit,
      nummer: 5,
    });

    await zeige("/gesamtanweisungen");
    await warteBis(
      () => inhalt(marke(`${LISTE_MARKE}-pruefung`)) === erwartet,
      "Übersicht nennt die freigebende Person",
    );
    expect(marke(`${LISTE_MARKE}-pruefung`)?.getAttribute("data-festgehalten")).toBe("ja");

    await neuAufbauen("/gesamtanweisungen/a-1");
    await warteBis(
      () => inhalt(marke(`${SEITE_MARKE}-pruefung`)) === erwartet,
      "Detail nennt dieselbe Person",
    );
    const detail = inhalt(marke(`${SEITE_MARKE}-pruefung`));
    expect(detail).toContain("Carla Beispiel");
    expect(detail).toContain(zeit);
    expect(detail).toContain("Stand 5");
    // Die Urheberin ist nicht die freigebende Person.
    expect(detail).not.toContain("Pia Beispiel");

    // „Reload": die Fläche wird neu aufgebaut und holt den Stand erneut vom Server.
    const abrufeVorher = detailAbrufe;
    await neuAufbauen("/gesamtanweisungen/a-1");
    await warteBis(
      () => detailAbrufe > abrufeVorher && inhalt(marke(`${SEITE_MARKE}-pruefung`)) === erwartet,
      "nach dem Neuaufbau steht dieselbe Angabe",
    );
  });
});

describe("B · K4 — ohne festgehaltene Person wird keine erfunden", () => {
  it("Altbestand: „nicht festgehalten“, kein Name — weder Urheberin noch sonst jemand", async () => {
    serviere("entschieden", 5);
    const altsatz = text("fe001.status.pruefung.freigegeben", {
      nummer: 5,
      zeit: formatKoTimestamp(GEAENDERT, "de") as string,
    });
    await zeige("/gesamtanweisungen/a-1");
    await warteBis(
      () => inhalt(marke(`${SEITE_MARKE}-pruefung`)) === altsatz,
      "Detail zeigt den Altsatz",
    );
    const block = marke(`${SEITE_MARKE}-pruefung`);
    expect(block?.getAttribute("data-festgehalten")).toBe("nein");
    expect(inhalt(block)).toContain("nicht festgehalten");
    expect(inhalt(block)).not.toContain("Pia");
    expect(inhalt(block)).not.toContain("Carla");
  });
});

describe("K · K5 — Klaras Statusweg nimmt den gezeichneten Block derselben Anleitung", () => {
  it("Detail und Übersicht: ein Element der Anleitung führt zu genau ihrem Statustext", async () => {
    serviere("entschieden", 5, CARLA);
    await zeige("/gesamtanweisungen/a-1");
    await warteBis(() => marke(`${SEITE_MARKE}-pruefung`) !== null, "Detail gezeichnet");
    const titel = marke(`${SEITE_MARKE}-titel`);
    const status = objektstatusAus(titel);
    expect(status).toEqual({ art: "anleitung", text: inhalt(marke(`${SEITE_MARKE}-freigabe`)) });
    expect(status?.text).toContain("Carla Beispiel");

    await neuAufbauen("/gesamtanweisungen");
    await warteBis(() => marke(`${LISTE_MARKE}-pruefung`) !== null, "Übersicht gezeichnet");
    const zeilenstatus = objektstatusAus(marke(`${LISTE_MARKE}-oeffnen`));
    expect(zeilenstatus).toEqual({
      art: "anleitung",
      text: inhalt(marke(`${LISTE_MARKE}-freigabe`)),
    });
  });
});
