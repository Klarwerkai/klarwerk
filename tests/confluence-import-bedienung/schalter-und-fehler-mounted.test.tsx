// @vitest-environment jsdom
// ================================================================================================
// CONFLUENCE-IMPORT-BEDIENUNG — DER SCHALTER WIRKT AUF DIE LAUF-KARTE, FEHLER HABEN WORTE.
// ================================================================================================
//
// Quellen: R-0134 (der Schalter wird gemeldet, aber keine Bedienfläche liest ihn), R-1005 (Start
// ohne Fachwissen über die Oberfläche), R-0159 (zu langsamer Abruf: eigener Code, verständliche
// Meldung), R-0171 (ganzer Bereich, angestoßen aus der Anwendung).
//
// Gedoppelt ist allein `fetch` — dieselbe Grenze wie in `tests/app/f0140-importlauf-fortschritt`:
// Endpunktfunktion, Hook, Ableitung und Renderer sind das echte Produkt. Die Zugangsauskunft liegt
// im Abfrage-Cache, wo der Zugangskasten (`ImportAccessPanel`) sie auf der echten Seite ablegt.
//
//   S  SCHALTER    aus ⇒ Start gesperrt + Grund; ohne Zugangsdaten ⇒ gesperrt + anderer Grund;
//                  bereit ⇒ Start geht wirklich als POST auf die Leitung.
//   F  FEHLER      504 CONFLUENCE_TIMEOUT / 404 (Schalter aus) / 503 ⇒ je eigener, verständlicher
//                  Satz statt „Fehler"; ein gescheiterter Lauf mit Zeitlimit-Code bekommt seinen Satz.
//   R  REIN        die Zuordnung Status/Code → Text ohne Oberfläche.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ToastProvider, useToast } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import {
  IMPORT_FAILURE_CODE_TEXT,
  type ImportAccessFacts,
  importStartFehlerKey,
} from "../../apps/web/src/lib/importAccessState";
import { ImportRunPanel } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let rufe: { url: string; method: string }[] = [];

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function antwort(status: number, koerper: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: async () => JSON.stringify(koerper),
  } as unknown as Response;
}

function leitung(start: { status: number; koerper: unknown }, lauf?: unknown): void {
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(
    async (url: string, init?: { method?: string }) => {
      rufe.push({ url: String(url), method: init?.method ?? "GET" });
      if (String(url).includes("/runs/")) {
        return antwort(200, lauf);
      }
      return antwort(start.status, start.koerper);
    },
  );
}

/** Zeigt die Toasts als Text — der Provider selbst zeichnet sie nicht. */
function ToastAnzeige(): JSX.Element {
  const { toasts } = useToast();
  return createElement(
    "ul",
    { "data-testid": "toasts" },
    toasts.map((t) => createElement("li", { key: t.id, "data-kind": t.kind }, t.message)),
  );
}

/**
 * `zugang` landet dort, wo ihn auf der echten Seite der Zugangskasten ablegt: im Abfrage-Cache unter
 * dem Schlüssel von `useImportAccessConfluence`. Die Lauf-Karte ruft ihn nicht selbst ab — fehlt er,
 * sieht sie keine Auskunft (Bestandsverhalten).
 */
async function oeffnen(zugang?: ImportAccessFacts): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (zugang) {
    qc.setQueryData(["import-access", "confluence"], {
      system: "confluence",
      enabled: zugang.enabled,
      credentials: [],
      credentialsUsable: zugang.credentialsUsable,
      blocker: zugang.credentialsUsable ? null : "missing",
      lastConnectedAt: null,
    });
  }
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(ImportRunPanel, null),
          createElement(ToastAnzeige, null),
        ),
      ),
    );
  });
  await act(flush);
}

const startKnopf = (): HTMLButtonElement | null =>
  container?.querySelector<HTMLButtonElement>('[data-testid="f0140-start"]') ?? null;
const gesperrt = (): Element | null =>
  container?.querySelector('[data-testid="f0140-gesperrt"]') ?? null;
function toastTexte(): string[] {
  const knoten = container?.querySelectorAll('[data-testid="toasts"] li') ?? [];
  return Array.from(knoten, (li) => li.textContent ?? "");
}

const klick = async (el: HTMLElement | null): Promise<void> => {
  await act(async () => {
    el?.click();
  });
  await act(flush);
};

describe("Confluence-Import-Bedienung · Schalter und verständliche Fehler", () => {
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

  it("S1 · Schalter aus: Start gesperrt, Grund steht da, kein Ruf", async () => {
    leitung({ status: 202, koerper: { importId: "x", status: "QUEUED" } });
    await oeffnen({ enabled: false, credentialsUsable: true });

    expect(startKnopf()?.disabled, "ausgeschaltet darf der Start nicht anklickbar sein").toBe(true);
    expect(gesperrt()?.getAttribute("data-state")).toBe("disabled");
    expect(gesperrt()?.textContent).toBe(i18n.t("w2.run.gesperrt.disabled"));

    await klick(startKnopf());
    expect(rufe, "ein gesperrter Start darf nichts senden").toEqual([]);
  });

  it("S2 · eingeschaltet ohne Zugangsdaten: gesperrt mit eigenem Grund", async () => {
    leitung({ status: 202, koerper: { importId: "x", status: "QUEUED" } });
    await oeffnen({ enabled: true, credentialsUsable: false });

    expect(startKnopf()?.disabled).toBe(true);
    expect(gesperrt()?.getAttribute("data-state")).toBe("no-credentials");
    expect(gesperrt()?.textContent).toBe(i18n.t("w2.run.gesperrt.noCredentials"));
    expect(i18n.t("w2.run.gesperrt.noCredentials")).not.toBe(i18n.t("w2.run.gesperrt.disabled"));
  });

  it("S3 · bereit: der Start geht als POST auf den ganzen Bereich (R-0171)", async () => {
    leitung(
      { status: 202, koerper: { importId: "lauf-1", status: "QUEUED" } },
      {
        importId: "lauf-1",
        sourceSystem: "confluence",
        externalId: null,
        sourceScope: "space:KW",
        requestedSourceVersion: null,
        status: "FETCHING",
        sourceRecordId: null,
        startedAt: "2026-10-03T08:00:00.000Z",
        completedAt: null,
        failureCode: null,
        failureReason: null,
        counters: {
          itemsTotal: 0,
          itemsCreated: 0,
          itemsBound: 0,
          itemsSkipped: 0,
          itemsFailed: 0,
        },
      },
    );
    await oeffnen({ enabled: true, credentialsUsable: true });

    expect(gesperrt(), "bereit heißt: kein Sperrgrund").toBeNull();
    expect(startKnopf()?.disabled).toBe(false);
    await klick(startKnopf());
    expect(rufe[0]).toEqual({ url: "/api/admin/import/confluence", method: "POST" });
  });

  it("F1 · Zeitüberschreitung beim Start: eigener Satz statt „Fehler“ (R-0159)", async () => {
    leitung({
      status: 504,
      koerper: {
        error: "CONFLUENCE_TIMEOUT",
        message: "Confluence antwortet nicht — Zeitüberschreitung nach 15 s.",
      },
    });
    await oeffnen();
    await klick(startKnopf());

    expect(toastTexte()).toEqual([i18n.t("w2.run.startFehler.zeitlimit")]);
    expect(toastTexte()).not.toContain(i18n.t("state.error"));
  });

  it("F2 · Schalter auf dem Server inzwischen aus (404): Satz nennt ihn", async () => {
    leitung({ status: 404, koerper: { error: "Not Found", message: "Route POST not found" } });
    await oeffnen();
    await klick(startKnopf());

    expect(toastTexte()).toEqual([i18n.t("w2.run.startFehler.ausgeschaltet")]);
  });

  it("F3 · am Zeitlimit gescheiterter Lauf: Code UND verständlicher Satz", async () => {
    leitung(
      { status: 202, koerper: { importId: "lauf-2", status: "QUEUED" } },
      {
        importId: "lauf-2",
        sourceSystem: "confluence",
        externalId: null,
        sourceScope: "space:KW",
        requestedSourceVersion: null,
        status: "FAILED",
        sourceRecordId: null,
        startedAt: "2026-10-03T08:00:00.000Z",
        completedAt: "2026-10-03T08:00:15.000Z",
        failureCode: "CONFLUENCE_TIMEOUT",
        failureReason: "Confluence antwortet nicht — Zeitüberschreitung nach 15 s.",
        counters: {
          itemsTotal: 0,
          itemsCreated: 0,
          itemsBound: 0,
          itemsSkipped: 0,
          itemsFailed: 0,
        },
      },
    );
    await oeffnen();
    await klick(startKnopf());

    const code = container?.querySelector('[data-testid="w2-run-failure-code"]')?.textContent;
    expect(code).toContain("CONFLUENCE_TIMEOUT");
    expect(container?.querySelector('[data-testid="w2-run-failure-text"]')?.textContent).toBe(
      i18n.t("w2.run.failureText.CONFLUENCE_TIMEOUT"),
    );
  });

  it("R · Zuordnung Status/Code → Text; Unbekanntes bleibt allgemein", () => {
    expect(importStartFehlerKey(504, "CONFLUENCE_TIMEOUT")).toBe("w2.run.startFehler.zeitlimit");
    expect(importStartFehlerKey(504, "CONFLUENCE_BUDGET")).toBe("w2.run.startFehler.zeitlimit");
    expect(importStartFehlerKey(503, "IMPORT_UNAVAILABLE")).toBe(
      "w2.run.startFehler.nichtKonfiguriert",
    );
    expect(importStartFehlerKey(404, "Not Found")).toBe("w2.run.startFehler.ausgeschaltet");
    expect(importStartFehlerKey(403, "FORBIDDEN")).toBe("w2.run.startFehler.keinRecht");
    expect(importStartFehlerKey(502, "IMPORT_FAILED")).toBe("state.error");
    expect(IMPORT_FAILURE_CODE_TEXT.IMPORT_FAILED).toBeUndefined();

    // Jeder benutzte Schlüssel ist in allen drei Sprachen aufgelöst (kein roher Schlüssel sichtbar).
    const schluessel = [
      "w2.run.gesperrt.disabled",
      "w2.run.gesperrt.noCredentials",
      "w2.run.startFehler.zeitlimit",
      "w2.run.startFehler.nichtKonfiguriert",
      "w2.run.startFehler.ausgeschaltet",
      "w2.run.startFehler.keinRecht",
      ...Object.values(IMPORT_FAILURE_CODE_TEXT),
    ];
    for (const sprache of ["de", "en", "nl"]) {
      for (const k of schluessel) {
        expect(i18n.exists(k, { lng: sprache }), `${sprache}: ${k} fehlt`).toBe(true);
      }
    }
  });
});
