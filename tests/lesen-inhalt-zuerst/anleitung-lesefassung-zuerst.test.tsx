// @vitest-environment jsdom
// ================================================================================================
// LESEN-INHALT-ZUERST · DIE FREIGEGEBENE ARBEITSANLEITUNG ÖFFNET IHRE GÜLTIGE LESEFASSUNG.
// ================================================================================================
//
// Auftrag `produkt:20261007:lesen-inhalt-zuerst`, Kriterium 4: „Freigegebene Anleitung öffnet ihre
// gültige Lesefassung; Bearbeitung und Historie bleiben erreichbar."
//
//   A1  freigegeben („entschieden"): Titel und Status oben, danach die Lesefassung; Schritte,
//       Kopfangaben, Aufnehmen und Entscheidung liegen in EINER zugeklappten Zeile danach; der
//       Vergleich der Stände (Historie) steht offen. Die Sperren bleiben, wie sie sind.
//   A3  Gegenprobe Warnung (nacharbeit-6): eine gescheiterte Quellenprüfung bleibt vor dem
//       Dokument; eine „aktuelle" steht wie die Leseerläuterung nach dem Regeltext (A1).
//   A2  Gegenprobe Entwurf: die Arbeitsreihenfolge bleibt unverändert (Schritte, Kopf, Aufnehmen,
//       Lesefassung, Entscheidung) und es gibt keine zugeklappte Zeile.
//
// `fetch` ist adressabhängig festgelegt; kein Netz, kein Server, kein Browser. Die Lage im Bild
// misst `tests-smoke/lesen-inhalt-zuerst-browser.spec.ts` (K4) am gebauten Bündel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

import type {
  AnweisungLesestand,
  AnweisungStand,
  PruefErgebnis,
} from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { GesamtanweisungBereich } from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungBereich";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REGEL = "Regel 1: Dockingstation anschließen und Netzteil prüfen.";

function lesestand(stand: AnweisungStand, ergebnis: PruefErgebnis = "aktuell"): AnweisungLesestand {
  return {
    aenderungspruefung: {
      pruefzeitpunkt: "2026-10-07T10:30:00.000Z",
      ergebnis,
      gefundeneAenderungen: 0,
      fehlgeschlageneQuellen: ergebnis === "fehlgeschlagen" ? 1 : 0,
      ueberwachung: "nicht_eingerichtet",
    },
    uebernommeneAenderungen: [],
    id: "a-1",
    titel: "Start im Homeoffice",
    zweck: "Einarbeitung",
    geltungsbereich: "Alle Teams",
    voraussetzungen: "",
    stand,
    version: 5,
    urheber: "u-pia",
    erstelltAm: "2026-09-26T08:00:00.000Z",
    geaendertAm: "2026-10-07T10:30:00.000Z",
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
        rumpfHtml: `<p>${REGEL}</p>`,
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

let container: HTMLDivElement;
let root: Root;
let echtesFetch: typeof globalThis.fetch;

function serviere(stand: AnweisungStand, ergebnis: PruefErgebnis): void {
  globalThis.fetch = (async (eingabe: unknown) => {
    const adresse = String(eingabe);
    const antwort = (status: number, rumpf: unknown) =>
      ({
        status,
        ok: status >= 200 && status < 300,
        statusText: String(status),
        text: async () => JSON.stringify(rumpf),
      }) as unknown as Response;
    if (adresse === "/api/gesamtanweisungen/a-1") {
      return antwort(200, lesestand(stand, ergebnis));
    }
    if (adresse === "/api/gesamtanweisungen/a-1/staende") {
      return antwort(200, { staende: [4, 5] });
    }
    if (adresse === "/api/directory") {
      return antwort(200, [{ id: "u-pia", name: "Pia Beispiel" }]);
    }
    return antwort(404, { error: "NOT_FOUND", message: adresse });
  }) as typeof globalThis.fetch;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  echtesFetch = globalThis.fetch;
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
});

async function zeige(stand: AnweisungStand, ergebnis: PruefErgebnis = "aktuell"): Promise<void> {
  serviere(stand, ergebnis);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/gesamtanweisungen/a-1"] },
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
  for (let i = 0; i < 200 && !marke("ga-lesestand-baustein"); i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 10));
    });
  }
  expect(marke("ga-lesestand-baustein"), `die Lesefassung (${stand}) erschien nie`).not.toBeNull();
  // Die übrigen Abfragen (Stände, Verzeichnis) und die gebündelte Benachrichtigung von react-query
  // einige Takte durchlaufen lassen, bevor gelesen wird — wie im FE-001-Prüfstatus-Test.
  for (let takt = 0; takt < 5; takt += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 10));
    });
  }
}

const marke = (id: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

function vor(a: string, b: string): boolean {
  const erstes = marke(a);
  const zweites = marke(b);
  expect(erstes, `${a} fehlt`).not.toBeNull();
  expect(zweites, `${b} fehlt`).not.toBeNull();
  const lage = (erstes as Node).compareDocumentPosition(zweites as Node);
  return (lage & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe("A1 · freigegeben: die gültige Lesefassung zuerst", () => {
  it("Titel und Status, dann die Lesefassung; Bearbeitung zugeklappt, Historie offen", async () => {
    await zeige("entschieden");
    expect(marke("ga-seite-titel")?.textContent).toBe("Start im Homeoffice");
    expect(marke("ga-seite-stand")?.textContent).toContain("Freigegeben");
    expect(marke("ga-lesestand")?.textContent).toContain(REGEL);

    // Reihenfolge: Titel → Status → Lesefassung → Bearbeiten-Zeile → Historie.
    expect(vor("ga-seite-titel", "ga-seite-stand")).toBe(true);
    expect(vor("ga-seite-stand", "ga-lesestand")).toBe(true);
    expect(vor("ga-lesestand", "ga-seite-bearbeiten")).toBe(true);
    expect(vor("ga-seite-bearbeiten", "ga-vergleich")).toBe(true);

    // Nacharbeit 6 (Ben): IN der Lesefassung stehen Freigabestand und Regeltext VOR der
    // allgemeinen Leseerläuterung und der ausführlichen Quellenprüfung („aktuell" = keine Warnung).
    expect(marke("ga-lesestand-stand")?.textContent).toBe("Freigegeben");
    expect(marke("ga-lesestand-text")?.textContent).toContain(REGEL);
    expect(vor("ga-lesestand-stand", "ga-lesestand-text")).toBe(true);
    expect(vor("ga-lesestand-text", "ga-lesestand-einleitung")).toBe(true);
    expect(vor("ga-lesestand-text", "ga-lesestand-quellen")).toBe(true);
    // Der Regeltext steht vor den Herkunftsdetails des Abschnitts („kein Nachweis").
    const abschnitt = marke("ga-lesestand-baustein")?.textContent ?? "";
    expect(abschnitt.indexOf(REGEL)).toBeLessThan(abschnitt.indexOf("kein Nachweis"));
    // Quellenprüfung und Lückenvermerk bleiben erreichbar.
    expect(marke("ga-lesestand-quellen-ergebnis")?.getAttribute("data-ergebnis")).toBe("aktuell");
    expect(marke("ga-lesestand-pruefanbindung")).not.toBeNull();

    // Die Bearbeitung ist EINE zugeklappte Zeile mit Namen …
    const zeile = marke("ga-seite-bearbeiten") as HTMLDetailsElement;
    expect(zeile.tagName).toBe("DETAILS");
    expect(zeile.open).toBe(false);
    expect(zeile.querySelector("summary")?.textContent).toBe("Bearbeiten und Freigabe");
    // … und enthält alles, was vorher VOR dem Inhalt stand — erreichbar, nicht entfernt.
    for (const id of ["ga-seite-schritte", "ga-kopf", "ga-aufnahme", "ga-entscheidung"]) {
      expect(zeile.contains(marke(id)), `${id} liegt nicht in der Bearbeiten-Zeile`).toBe(true);
    }
    // Die Standsperre gilt unverändert: Kopfangaben sind gesperrt, mit Grund.
    const speichern = marke("ga-kopf-speichern") as HTMLButtonElement | null;
    expect(speichern?.disabled).toBe(true);
    expect(marke("ga-kopf-sperre")?.textContent).toBe(
      "Diese Arbeitsanleitung ist angenommen und wird nicht mehr geändert.",
    );
    // Die Historie (Vergleich der Stände) liegt NICHT in der zugeklappten Zeile.
    expect(zeile.contains(marke("ga-vergleich"))).toBe(false);
    // Aufgeklappt ist die Bearbeitung da.
    await act(async () => {
      zeile.open = true;
    });
    expect(zeile.open).toBe(true);
  });
});

describe("A3 · Gegenprobe Warnung: eine gescheiterte Quellenprüfung bleibt vor dem Inhalt", () => {
  it("fehlgeschlagen → Quellenprüfung vor dem Dokument, Leseerläuterung weiter danach", async () => {
    await zeige("entschieden", "fehlgeschlagen");
    expect(marke("ga-lesestand-quellen-ergebnis")?.getAttribute("data-ergebnis")).toBe(
      "fehlgeschlagen",
    );
    expect(vor("ga-lesestand-quellen", "ga-lesestand-dokument")).toBe(true);
    expect(vor("ga-lesestand-text", "ga-lesestand-einleitung")).toBe(true);
    // Genau EINE Quellenprüfung — nicht oben und unten zugleich.
    expect(container.querySelectorAll('[data-testid="ga-lesestand-quellen"]')).toHaveLength(1);
  });
});

describe("A2 · Gegenprobe Entwurf: die Arbeitsreihenfolge bleibt", () => {
  it("Schritte, Kopf, Aufnehmen, Lesefassung, Entscheidung — ohne zugeklappte Zeile", async () => {
    await zeige("entwurf");
    expect(marke("ga-seite-bearbeiten")).toBeNull();
    expect(vor("ga-seite-schritte", "ga-kopf")).toBe(true);
    expect(vor("ga-kopf", "ga-aufnahme")).toBe(true);
    expect(vor("ga-aufnahme", "ga-lesestand")).toBe(true);
    expect(vor("ga-lesestand", "ga-entscheidung")).toBe(true);
    expect(vor("ga-entscheidung", "ga-vergleich")).toBe(true);
  });
});
