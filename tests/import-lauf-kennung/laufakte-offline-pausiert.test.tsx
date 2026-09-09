// @vitest-environment jsdom
// ================================================================================================
// JOB 3357 · FALL 5 — OHNE VERBINDUNG: DER ECHTE HAKEN, DER ECHTE ZWISCHENSPEICHER.
// ================================================================================================
//
// WARUM ES DIESEN FALL GIBT. Runde 1 hat die Zustände dieses Auftrags gegen einen Doppelgänger des
// Hakens geprüft — und der Doppelgänger kannte nur `data`, `isError`, `isFetching`. Der Prüfer hat
// dann den ECHTEN `QueryClient` genommen, die Verbindung weggenommen und gemessen:
//
//     {"status":"success","fetchStatus":"paused","text":"Completed … 1 of 1 items processed"}
//
// `isError` falsch, `isFetching` falsch — und der zuletzt gelesene Ausgang stand unmarkiert da, als
// wäre er der aktuelle. Das ist genau die Zusage aus Auftrag §9, die dabei brach: „Cache mit
// gescheiterter Auffrischung / offline: der Ausgang wird als veraltet gekennzeichnet oder
// zurückgenommen; er darf nicht unmarkiert als aktueller Stand stehen bleiben."
//
// DESHALB OHNE DOPPELGÄNGER. Hier wird `useImportRun` NICHT ersetzt: es laufen der echte Haken, der
// echte `QueryClient` und der echte `onlineManager`. Nur die HTTP-Endpunkte sind ersetzt — sie sind
// die Grenze dieser Fläche, nicht ihr Innenleben. Nur so beweist dieser Fall, was der Doppelgänger
// nicht beweisen kann: dass die Fläche den Zustand liest, den react-query wirklich herstellt, und
// nicht den, den ein Testschreiber sich dafür ausgedacht hat.
//
// DIE STRECKE IST DER GEGENSTAND, nicht ein Standbild: gelesen → offline (ausgesetzt) → wieder
// online. Der Vorbehalt muss KOMMEN und wieder GEHEN; ein Vorbehalt, der klebt, wäre die andere
// Halbheit — dann wäre jeder Stand für immer verdächtig und die Aussage nichts mehr wert.
//
// ARIA-HIDDEN: nicht mitgelesen (`sichtbarerText()` aus `buehne.tsx`, Begründung dort im Kopf).
// Der Vorbehalt muss ein Mensch sehen und eine Vorlesehilfe nennen; im verborgenen Baum nützt er
// niemandem.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { admin: { import: { group: vi.fn(), apply: vi.fn(), run: vi.fn() } } },
}));

import type { Mock } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { endpoints } from "../../apps/web/src/api/endpoints";
import i18n from "../../apps/web/src/i18n";
import { abbauen, bisZurBilanz, laufakte, sichtbarerText, uebernahmeAntwort } from "./buehne";

const KENNUNG = "run-4711";
const SCHLUESSEL = ["import-run", KENNUNG];

const laufDoppel = (): Mock => endpoints.admin.import.run as unknown as Mock;
const uebernahmeDoppel = (): Mock => endpoints.admin.import.apply as unknown as Mock;

let qc: QueryClient;

/** Ein paar Takte durchlaufen lassen — Abfragen, Auflösungen, Neuzeichnungen. */
async function durchatmen(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

function fetchStatus(): string | undefined {
  return qc.getQueryState(SCHLUESSEL)?.fetchStatus;
}

beforeEach(async () => {
  // Die Vorführung läuft auf Englisch (UEBERGABE 08.09. 07:10) — hier wird die Abnahmesprache
  // gemessen; der deutsche Text hängt an denselben Schlüsseln und wird in D7/D8 mitgeprüft.
  await i18n.changeLanguage("en");
  onlineManager.setOnline(true);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  uebernahmeDoppel().mockResolvedValue(uebernahmeAntwort(KENNUNG));
  laufDoppel().mockResolvedValue(laufakte());
});

afterEach(async () => {
  await abbauen();
  qc.clear();
  // Der `onlineManager` ist modulweit: bliebe er offline, stünde der nächste Fall ohne Netz da.
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe("JOB 3357 · §9 — ohne Verbindung bleibt kein Ausgang unmarkiert stehen", () => {
  it("E1 · gelesen → offline → wieder online: der Vorbehalt kommt und geht, die Kennung bleibt", async () => {
    await bisZurBilanz(1, (kind) => createElement(QueryClientProvider, { client: qc }, kind));
    await durchatmen();

    // --- 1. GELESEN. Der Ausgang steht frisch da, ohne jeden Vorbehalt. -------------------------
    const gelesen = sichtbarerText();
    expect({
      lage: fetchStatus(),
      kennung: gelesen.includes(KENNUNG),
      ausgang: gelesen.includes(i18n.t("w2.run.status.COMPLETED")),
      zaehler: gelesen.includes(i18n.t("w2.run.progress", { verarbeitet: 1, gesamt: 1 })),
      vorbehalt: gelesen.includes(i18n.t("imp.groups.runOutcomeStale")),
    }).toEqual({ lage: "idle", kennung: true, ausgang: true, zaehler: true, vorbehalt: false });

    // --- 2. OFFLINE. react-query setzt die Auffrischung AUS. ------------------------------------
    // Der Zustand wird ausdrücklich mitgeprüft (`fetchStatus: "paused"`): ohne diese Zeile wäre
    // nicht bewiesen, dass die Bühne die Lage überhaupt hergestellt hat — der Fall könnte
    // leer-grün werden, wenn eine spätere react-query-Fassung hier etwas anderes täte.
    await act(async () => {
      onlineManager.setOnline(false);
      void qc.invalidateQueries({ queryKey: SCHLUESSEL });
    });
    await durchatmen();
    const offline = sichtbarerText();
    expect({
      lage: fetchStatus(),
      // Nichts wird geleert (REGELN.md §7, erster Satz): Kennung, Ausgang und Zähler bleiben.
      kennung: offline.includes(KENNUNG),
      ausgang: offline.includes(i18n.t("w2.run.status.COMPLETED")),
      zaehler: offline.includes(i18n.t("w2.run.progress", { verarbeitet: 1, gesamt: 1 })),
      // ... aber der Stand wird ausdrücklich als alter Stand benannt.
      vorbehalt: offline.includes(i18n.t("imp.groups.runOutcomeStale")),
      grund: offline.includes(i18n.t("imp.groups.runOutcomeStalePaused")),
      // Und mit dem richtigen Grund: nichts ist gescheitert, nichts läuft.
      nichtAlsGescheitert: offline.includes(i18n.t("imp.groups.runOutcomeStaleFailed")),
      nichtAlsLaufend: offline.includes(i18n.t("imp.groups.runOutcomeRefreshing")),
    }).toEqual({
      lage: "paused",
      kennung: true,
      ausgang: true,
      zaehler: true,
      vorbehalt: true,
      grund: true,
      nichtAlsGescheitert: false,
      nichtAlsLaufend: false,
    });

    // --- 3. WIEDER ONLINE. Die ausgesetzte Abfrage läuft nach; der Vorbehalt geht. --------------
    // Die zweite Antwort trägt ANDERE Zähler. Nur so ist belegt, dass wirklich neu gelesen wurde
    // und der Vorbehalt nicht bloß aus Zeitablauf verschwand.
    laufDoppel().mockResolvedValue(
      laufakte({
        counters: {
          itemsTotal: 2,
          itemsCreated: 1,
          itemsBound: 1,
          itemsSkipped: 0,
          itemsFailed: 0,
        },
      }),
    );
    await act(async () => {
      onlineManager.setOnline(true);
    });
    await durchatmen();
    const wieder = sichtbarerText();
    expect({
      lage: fetchStatus(),
      kennung: wieder.includes(KENNUNG),
      frischeZaehler: wieder.includes(i18n.t("w2.run.progress", { verarbeitet: 2, gesamt: 2 })),
      vorbehalt: wieder.includes(i18n.t("imp.groups.runOutcomeStale")),
      abrufe: laufDoppel().mock.calls.length,
    }).toEqual({ lage: "idle", kennung: true, frischeZaehler: true, vorbehalt: false, abrufe: 2 });
  });

  it("E2 · offline VOR dem ersten Lesen: kein Ladehinweis, denn es lädt nichts", async () => {
    // Die Verbindung fehlt von Anfang an. Die Kennung kommt trotzdem an — die Übernahme selbst
    // läuft in diesem Fall über den ersetzten Endpunkt und nicht über react-query; das entspricht
    // dem Produkt, wo `apply` eine Mutation ist und die Antwort ohne Zwischenspeicher ankommt.
    // Die LAUFAKTE dagegen wird über den echten Haken gelesen und deshalb ausgesetzt, bevor sie je
    // gelesen wurde. „Wird geladen …" wäre hier eine Behauptung über einen Vorgang, den es nicht gibt.
    onlineManager.setOnline(false);
    await bisZurBilanz(1, (kind) => createElement(QueryClientProvider, { client: qc }, kind));
    await durchatmen();
    const text = sichtbarerText();
    expect({
      lage: fetchStatus(),
      kennung: text.includes(KENNUNG),
      benannt: text.includes(i18n.t("imp.groups.runOutcomeOffline")),
      ladehinweis: text.includes(i18n.t("imp.groups.runOutcomeLoading")),
      // Kein Ausgang, kein Zähler — über Ungelesenes wird nichts gesagt.
      ausgangBehauptet: text.includes(i18n.t("w2.run.status.COMPLETED")),
    }).toEqual({
      lage: "paused",
      kennung: true,
      benannt: true,
      ladehinweis: false,
      ausgangBehauptet: false,
    });
  });
});
