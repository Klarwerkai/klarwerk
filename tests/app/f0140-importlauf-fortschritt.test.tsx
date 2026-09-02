// @vitest-environment jsdom
// ================================================================================================
// F-0140 / K-20 · JOB 2970 D2 — DER ECHTE WEG, DER FORTSCHRITT ALS ZAHL, DER WIEDERGEFUNDENE LAUF
// ================================================================================================
//
// WAS D1 FALSCH GEMACHT HAT, und was diese Fassung anders macht: D1 hat `endpoints` gedoppelt und
// damit ausgerechnet die zwei NEUEN Funktionen ersetzt, die es zu beweisen galt. Der Test war
// gruen, ohne dass je eine Route oder eine Methode gepruft wurde. Hier ist die Grenze eine Ebene
// tiefer gezogen: **gedoppelt ist allein `fetch`**. `admin.import.startRun()` und
// `admin.import.run()` laufen ECHT — mit ihrer echten Route, ihrer echten Methode und ihrer
// echten Antwortverarbeitung. Eine Gegenmutation am Endpunktvertrag macht diese Datei rot.
//
// Die drei Nachweise:
//   K  KERNBELEG    Start → echte Endpunktfunktion → Laufabruf → Hook → Renderer, ueber `fetch`
//                   nachgewiesen: Methode, Route, `importId`, servergetreue Antwortform.
//   Z  ZAEHLER      Fortschritt ist eine ZAHL, nicht ein Zustandswort: verarbeitete Elemente von
//                   `itemsTotal`. Zwei aufeinanderfolgende Laufphasen, zwei verschiedene Staende.
//   W  WIEDERFINDEN Laeuft schon einer, antwortet der Server 409 mit der Kennung des laufenden
//                   Imports. Die Flaeche uebernimmt sie und zeigt den bestehenden Lauf.
//
// Servergetreu heisst hier woertlich: die Antwortkoerper unten sind Feld fuer Feld die von
// `import-run-routes.ts:54-69` (`laufNachAussen`) und `confluence-import-routes.ts:274-280`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ImportRunPanel } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

interface Ruf {
  readonly url: string;
  readonly method: string;
}

/** Alle Rufe, die WIRKLICH auf der Leitung landeten — Methode und Route im Wortlaut. */
let rufe: Ruf[] = [];

function antwort(status: number, koerper: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: async () => JSON.stringify(koerper),
  } as unknown as Response;
}

/** Der Laufkoerper, Feld fuer Feld wie `laufNachAussen` ihn sendet. */
function laufKoerper(
  status: string,
  zaehler: Partial<Record<string, number>> = {},
): Record<string, unknown> {
  return {
    importId: "lauf-1",
    sourceSystem: "confluence",
    externalId: null,
    sourceScope: "space:KW",
    requestedSourceVersion: null,
    status,
    sourceRecordId: null,
    startedAt: "2026-09-02T08:00:00.000Z",
    completedAt: null,
    failureCode: null,
    failureReason: null,
    counters: {
      itemsTotal: 10,
      itemsCreated: 0,
      itemsBound: 0,
      itemsSkipped: 0,
      itemsFailed: 0,
      ...zaehler,
    },
  };
}

/**
 * Das EINZIGE Doppel dieser Datei. Alles oberhalb — Endpunktfunktion, Hook, Ableitung, Renderer —
 * ist das echte Produkt. `laufFolge` erlaubt zwei aufeinanderfolgende Laufphasen.
 */
function leitung(start: { status: number; koerper: unknown }, laufFolge: unknown[]): void {
  let n = 0;
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(
    async (url: string, init?: { method?: string }) => {
      rufe.push({ url: String(url), method: init?.method ?? "GET" });
      if (String(url).includes("/runs/")) {
        const k = laufFolge[Math.min(n, laufFolge.length - 1)];
        n += 1;
        return antwort(200, k);
      }
      return antwort(start.status, start.koerper);
    },
  );
}

async function seiteOeffnen(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ToastProvider, null, createElement(ImportRunPanel, null)),
      ),
    );
  });
  await act(flush);
}

const startKnopf = (): HTMLButtonElement | null =>
  container?.querySelector<HTMLButtonElement>('[data-testid="f0140-start"]') ?? null;

const fortschritt = (): string =>
  container?.querySelector('[data-testid="f0140-fortschritt"]')?.textContent ?? "";

const klick = async (el: HTMLElement | null): Promise<void> => {
  await act(async () => {
    el?.click();
  });
  await act(flush);
};

describe("F-0140 · JOB 2970 D2 — echte Endpunktkette, Zahlenfortschritt, wiedergefundener Lauf", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("de");
    rufe = [];
  });

  afterEach(async () => {
    if (root) {
      const r = root;
      await act(async () => r.unmount());
    }
    container?.remove();
    root = null;
    container = null;
  });

  it("K · KERNBELEG: Start und Laufabruf gehen ueber die ECHTEN Endpunktfunktionen", async () => {
    leitung({ status: 202, koerper: { importId: "lauf-1", status: "QUEUED" } }, [
      laufKoerper("EXTRACTING", { itemsCreated: 3 }),
    ]);
    await seiteOeffnen();
    await klick(startKnopf());

    // Der Start: Methode und Route im Wortlaut des Serververtrags.
    const start = rufe[0];
    expect(start, "es ging ueberhaupt kein Ruf auf die Leitung").toBeDefined();
    expect(start?.method, "der Start muss ein POST sein").toBe("POST");
    expect(start?.url, "die Startroute stimmt nicht mit dem Serververtrag ueberein").toBe(
      "/api/admin/import/confluence",
    );

    // Der Laufabruf: die vom Start gelieferte `importId` MUSS in der Route stehen.
    const abruf = rufe.find((r) => r.url.includes("/runs/"));
    expect(
      abruf,
      "der Lauf wurde nie abgerufen — die Kette bricht nach dem Start ab",
    ).toBeDefined();
    expect(abruf?.method, "der Laufabruf muss ein GET sein").toBe("GET");
    expect(
      abruf?.url,
      "die Laufroute muss die vom Start gelieferte Kennung tragen — sonst ist die Kette " +
        "Start → Kennung → Abruf nicht bewiesen.",
    ).toBe("/api/admin/import/runs/lauf-1");

    // Und die servergetreue Antwortform kommt bis an die Flaeche durch.
    expect(container?.querySelector('[data-testid="w2-run"]')).not.toBeNull();
    expect(
      container?.querySelector('[data-testid="w2-run-label"]')?.textContent,
      "der gelesene Zustand steht als Text auf der Flaeche",
    ).toBe(i18n.t("w2.run.status.EXTRACTING"));
  });

  it("Z · ZAEHLER: der Fortschritt ist eine Zahl und wandert mit dem Lauf mit", async () => {
    leitung({ status: 202, koerper: { importId: "lauf-1", status: "QUEUED" } }, [
      laufKoerper("EXTRACTING", { itemsCreated: 3 }),
      laufKoerper("CREATING_KNOWLEDGE", { itemsCreated: 5, itemsSkipped: 2 }),
    ]);
    await seiteOeffnen();
    await klick(startKnopf());

    expect(
      fortschritt(),
      "Ein Zustandswort allein ist kein Fortschritt — der Mensch will wissen, WIE WEIT.",
    ).toBe(i18n.t("w2.run.progress", { verarbeitet: 3, gesamt: 10 }));

    // Zweite Laufphase: derselbe Lauf, weiter fortgeschritten.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2100));
    });
    await act(flush);

    expect(
      fortschritt(),
      "Der angezeigte Stand muss dem Lauf folgen; eine eingefrorene Zahl waere schlimmer " +
        "als gar keine, weil sie wie ein Stillstand aussieht.",
    ).toBe(i18n.t("w2.run.progress", { verarbeitet: 7, gesamt: 10 }));
  });

  it("W · WIEDERFINDEN: laeuft schon einer, uebernimmt die Flaeche dessen Kennung", async () => {
    // Genau der 409-Koerper des Servers — mit der Kennung des laufenden Imports.
    leitung(
      {
        status: 409,
        koerper: {
          error: "IMPORT_ALREADY_RUNNING",
          message: "Fuer diesen Space laeuft bereits ein Import.",
          importId: "lauf-schon-da",
        },
      },
      [laufKoerper("ANALYZING", { itemsCreated: 8 })],
    );
    await seiteOeffnen();

    // Die Seite wurde waehrend eines laufenden Imports neu geoeffnet: sie kennt keine Kennung,
    // der Mensch tippt auf Start.
    await klick(startKnopf());

    const abruf = rufe.find((r) => r.url.includes("/runs/"));
    expect(
      abruf?.url,
      "Der 409-Koerper nennt die Kennung des laufenden Imports. Wird sie verworfen, bietet die " +
        "Flaeche stumm einen neuen Start an — und der Mensch sieht den laufenden Import nie.",
    ).toBe("/api/admin/import/runs/lauf-schon-da");
    expect(
      container?.querySelector('[data-testid="f0140-idle"]'),
      "statt des Startangebots muss der bestehende Lauf stehen",
    ).toBeNull();
    expect(
      container?.querySelector('[data-testid="w2-run"]')?.getAttribute("data-run-running"),
      "der wiedergefundene Lauf wird als laufend ausgewiesen",
    ).toBe("true");
    expect(fortschritt(), "auch der wiedergefundene Lauf zeigt seinen Zahlenstand").toBe(
      i18n.t("w2.run.progress", { verarbeitet: 8, gesamt: 10 }),
    );
  });
});
