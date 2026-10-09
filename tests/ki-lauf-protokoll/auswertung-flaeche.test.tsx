// @vitest-environment jsdom
// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll · Bens Befunde R1 B2–B5 AN DER FLÄCHE (KI-Übersicht, Stufe 2).
// ================================================================================================
//
// Gemountet wird die echte Seite (`Capital`) mit gestellter Serverantwort:
//   · die Laufkarte zeigt je Lauf die Kosten (wenn vorhanden) und das Erzeugte;
//   · die vier neuen Laufarten tragen in de/en/nl ein Wort, keinen rohen Schlüssel;
//   · die Auswertungskarte nennt Kostensumme samt Grundmenge und Preisstand — oder ausdrücklich,
//     dass keine Preisliste hinterlegt ist; die Zeitraumwahl ist ein natives Auswahlfeld und
//     fragt beim Wechsel einen neuen Zeitraum an.
// Nicht gemessen: Browserlayout und echte Tastaturbedienung in Chromium (Linux-Prüfweg).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { ModelRunAuswertungAntwort, ModelRunRecord } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { formatiereKosten } from "../../apps/web/src/lib/modelRuns";
import { Capital } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function lauf(over: Partial<ModelRunRecord> = {}): ModelRunRecord {
  return {
    id: "r1",
    task: "assist",
    provider: "anthropic:claude-sonnet-4-6",
    model: "claude-sonnet-4-6",
    demo: false,
    fallback: false,
    locale: "de",
    startedAt: "2026-09-20T10:00:00.000Z",
    finishedAt: "2026-09-20T10:00:00.250Z",
    status: "success",
    ...over,
  };
}

const MIT_KOSTEN = lauf({
  id: "mit",
  verbrauch: { eingabeToken: 1000, ausgabeToken: 500, gemeldeteAufrufe: 1 },
  kosten: { betrag: 0.0105, waehrung: "EUR", preisstand: "2026-10-01" },
  erzeugt: { art: "punkt", anzahl: 3 },
});
const OHNE_KOSTEN = lauf({ id: "ohne", task: "conflict" });

function auswertung(mitListe: boolean): ModelRunAuswertungAntwort {
  return {
    auswertung: {
      von: "2026-09-01T00:00:00.000Z",
      bis: "2026-10-01T00:00:00.000Z",
      laeufe: 2,
      erfolg: 2,
      fehler: 0,
      rueckfall: 0,
      demo: 0,
      jeAufgabe: {
        assist: { laeufe: 1, fehler: 0, eingabeToken: 1000, ausgabeToken: 500 },
        conflict: { laeufe: 1, fehler: 0, eingabeToken: 0, ausgabeToken: 0 },
      },
      dauerSummeMs: 500,
      dauerGezaehlt: 2,
      eingabeToken: 1000,
      ausgabeToken: 500,
      verbrauchGezaehlt: 1,
      kosten: mitListe ? [{ waehrung: "EUR", betrag: 0.0105, laeufe: 1 }] : [],
      verbrauchOhneKosten: mitListe ? 0 : 1,
      gekappt: false,
    },
    preisgrundlage: mitListe
      ? { hinterlegt: true, waehrung: "EUR", preisstand: "2026-10-01", modelle: 1 }
      : { hinterlegt: false },
  };
}

const angefragt: string[] = [];
// Ben R2 B6: schaltet die Auswertungsabfrage auf HTTP 500 (die Laufliste bleibt erreichbar).
let auswertungScheitert = false;
let letzterClient: QueryClient | undefined;

function stelleFetch(mitListe: boolean): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const pfad = String(url);
      angefragt.push(pfad);
      const koerper = pfad.includes("/api/model-runs/auswertung")
        ? auswertungScheitert
          ? null
          : auswertung(mitListe)
        : pfad.includes("/api/model-runs")
          ? [MIT_KOSTEN, OHNE_KOSTEN]
          : null;
      if (koerper === null) {
        return { ok: false, status: 500, statusText: "no", text: async () => "{}" } as Response;
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(koerper),
      } as Response;
    }),
  );
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(async () => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  angefragt.length = 0;
  auswertungScheitert = false;
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  await i18n.changeLanguage("de");
});

async function mounten(): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  letzterClient = qc;
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(MemoryRouter, { initialEntries: ["/kapital"] }, createElement(Capital)),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
  return container;
}

function zeile(container: HTMLElement, id: string): HTMLElement {
  const treffer = Array.from(
    container.querySelectorAll<HTMLElement>('[data-testid="mrun-row"]'),
  ).find((el) => el.getAttribute("data-run-id") === id);
  expect(treffer, `keine Laufzeile für ${id}`).toBeTruthy();
  return treffer as HTMLElement;
}

describe("Laufkarte: Kosten und Erzeugnis je Lauf", () => {
  it("F1 · ein Lauf mit Kosten nennt sie samt Preisstand; ohne Kosten steht nichts", async () => {
    stelleFetch(true);
    const container = await mounten();

    const kosten = zeile(container, "mit").querySelector<HTMLElement>(
      '[data-testid="mrun-kosten"]',
    );
    expect(kosten?.textContent).toBe(i18n.t("mrun.cost", { k: formatiereKosten(0.0105, "EUR") }));
    expect(kosten?.textContent).toContain("0.0105 EUR");
    expect(kosten?.getAttribute("title")).toContain("2026-10-01");
    expect(zeile(container, "ohne").querySelector('[data-testid="mrun-kosten"]')).toBeNull();
  });

  it("F2 · das Erzeugte steht als Art und Anzahl da", async () => {
    stelleFetch(true);
    const container = await mounten();

    const erzeugt = zeile(container, "mit").querySelector('[data-testid="mrun-erzeugt"]');
    expect(erzeugt?.textContent).toBe(
      i18n.t("mrun.produced", { n: 3, art: i18n.t("mrun.erzeugnis.punkt") }),
    );
    expect(zeile(container, "ohne").querySelector('[data-testid="mrun-erzeugt"]')).toBeNull();
  });
});

describe("Auswertungskarte: Zeitraum, Kosten, Preisgrundlage", () => {
  it("F3 · mit Preisliste: Kostensumme mit Grundmenge und Preisstand, je Aufgabenart eine Zeile", async () => {
    stelleFetch(true);
    const container = await mounten();

    const karte = container.querySelector<HTMLElement>('[data-testid="mrun-auswertung"]');
    expect(karte, "die Auswertungskarte fehlt").toBeTruthy();
    const kosten =
      karte?.querySelector('[data-testid="mrun-auswertung-kosten"]')?.textContent ?? "";
    expect(kosten).toContain(
      i18n.t("mrun.report.costSum", { k: formatiereKosten(0.0105, "EUR"), n: 1, total: 2 }),
    );
    expect(kosten).toContain("2026-10-01");
    const arten = karte?.querySelectorAll('[data-testid="mrun-auswertung-arten"] li') ?? [];
    expect(arten).toHaveLength(2);
    expect(karte?.textContent).toContain(i18n.t("mrun.task.conflict"));
  });

  it("F4 · ohne Preisliste: der Satz statt einer Null", async () => {
    stelleFetch(false);
    const container = await mounten();

    const hinweis = container.querySelector('[data-testid="mrun-auswertung-ohne-preisliste"]');
    expect(hinweis?.textContent).toBe(i18n.t("mrun.report.noPriceList"));
    const kosten =
      container.querySelector('[data-testid="mrun-auswertung-kosten"]')?.textContent ?? "";
    expect(kosten).not.toMatch(/0\.0000/);
  });

  it("F5 · die Zeitraumwahl ist ein natives Auswahlfeld; ein Wechsel fragt den neuen Zeitraum an", async () => {
    stelleFetch(true);
    const container = await mounten();
    const wahl = container.querySelector<HTMLSelectElement>(
      '[data-testid="mrun-auswertung-zeitraum"]',
    );
    expect(wahl?.tagName).toBe("SELECT");
    expect(wahl?.value).toBe("30");
    const vorher = angefragt.filter((u) => u.includes("/auswertung")).length;

    await act(async () => {
      if (wahl) {
        wahl.value = "7";
        wahl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await durchlaufen();
    });

    const auswertungen = angefragt.filter((u) => u.includes("/auswertung"));
    expect(auswertungen.length).toBeGreaterThan(vorher);
    const letzte = new URL(auswertungen.at(-1) as string, "http://x");
    const tage =
      (Date.parse(letzte.searchParams.get("bis") ?? "") -
        Date.parse(letzte.searchParams.get("von") ?? "")) /
      (24 * 60 * 60 * 1000);
    expect(Math.round(tage)).toBe(7);
  });

  it("F6 · in de/en/nl: alle neuen Texte übersetzt, kein roher Schlüssel, kein offener Platzhalter", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      for (const mitListe of [true, false]) {
        stelleFetch(mitListe);
        const container = await mounten();
        const text =
          (container.querySelector('[data-testid="mrun-card"]')?.textContent ?? "") +
          (container.querySelector('[data-testid="mrun-auswertung"]')?.textContent ?? "");
        expect(text, `${sprache}: roher Schlüssel`).not.toMatch(/mrun\./);
        expect(text, `${sprache}: offener Platzhalter`).not.toMatch(/\{\{|\}\}/);
      }
      for (const art of ["enrich", "conflict", "duplicate", "probe", "gaps"]) {
        expect(i18n.exists(`mrun.task.${art}`, { lng: sprache }), `${sprache}: ${art}`).toBe(true);
      }
    }
  });
});

describe("Ben R2 B6: die Auswertung täuscht weder Laden noch Aktualität vor", () => {
  it("F7 · offline ohne geladene Zahlen: kein „Lädt …“, sondern der Fehlersatz", async () => {
    stelleFetch(true);
    onlineManager.setOnline(false);
    const container = await mounten();

    const karte = container.querySelector<HTMLElement>('[data-testid="mrun-auswertung"]');
    expect(karte?.textContent).not.toContain(i18n.t("state.loading"));
    expect(karte?.querySelector('[data-testid="mrun-auswertung-fehler"]')?.textContent).toBe(
      i18n.t("state.error"),
    );
  });

  it("F8 · gescheiterte Auffrischung: die alten Kosten bleiben, aber mit dem Hinweis darauf", async () => {
    stelleFetch(true);
    const container = await mounten();
    const karte = (): HTMLElement =>
      container.querySelector<HTMLElement>('[data-testid="mrun-auswertung"]') as HTMLElement;
    expect(karte().querySelector('[data-testid="mrun-auswertung-refresh-error"]')).toBeNull();

    auswertungScheitert = true;
    await act(async () => {
      await letzterClient?.refetchQueries({ queryKey: ["model-runs", "auswertung"] });
      await durchlaufen();
    });

    expect(karte().textContent).toContain(formatiereKosten(0.0105, "EUR"));
    expect(
      karte().querySelector('[data-testid="mrun-auswertung-refresh-error"]')?.textContent,
    ).toBe(i18n.t("mrun.refreshFailed"));
  });

  it("F9 · offline MIT geladenen Zahlen: sie bleiben, und die Karte sagt, dass sie nicht frisch sind", async () => {
    stelleFetch(true);
    const container = await mounten();
    await act(async () => {
      onlineManager.setOnline(false);
      await durchlaufen();
    });

    const karte = container.querySelector<HTMLElement>('[data-testid="mrun-auswertung"]');
    expect(karte?.textContent).toContain(formatiereKosten(0.0105, "EUR"));
    expect(karte?.querySelector('[data-testid="mrun-auswertung-offline"]')?.textContent).toBe(
      i18n.t("mrun.offline"),
    );
  });
});
