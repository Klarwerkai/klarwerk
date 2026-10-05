// @vitest-environment jsdom
// ================================================================================================
// R-0159 · BEFUND F2 — EIN ZU LANGSAMER FOLGEABRUF, VOM KNOPF BIS ZUR ANZEIGE.
// ================================================================================================
//
// Bens Befund: Scheitert beim Gesamtlauf ein SPÄTERER Cursorabruf an Frist oder Zeitbudget, liefert
// `listAllPages` die gelesenen Seiten mit `truncated` und `abbruch` — `runConfluenceImport` warf
// `abbruch` weg, und der gespeicherte Lauf stand auf PARTIAL ohne Fehlercode und ohne Grund.
//
// DIESE KETTE IST HIER DURCHGEHEND ECHT: Startknopf der Lauf-Karte → `fetch` → Brücke →
// `POST /api/admin/import/confluence` → Hintergrundlauf → echter Adapter → echter REST-Client mit
// kurzer Frist → Laufablage → `GET /api/admin/import/runs/:id` → Lauf-Karte → `RunStateBanner`.
// Ersetzt ist allein die Antwort der externen Confluence-Instanz (`fetchFn`).
//
//   Z1  FRIST:      erste Ergebnisseite gültig mit Folgecursor, der Folgeabruf bleibt offen bis
//                   zur Frist → PARTIAL, die gelesene Seite ist als Kandidat erhalten,
//                   `CONFLUENCE_TIMEOUT` und ein verständlicher Satz — kein Token, keine Adresse.
//   Z2  BUDGET:     die erste Seite verbraucht das Zeitbudget → PARTIAL, `CONFLUENCE_BUDGET`.
//   Z3  KALIBRIERT: ohne Abbruch → COMPLETED ohne Fehlercode. Ohne diesen Fall könnte ein Code,
//                   der IMMER gesetzt würde, Z1/Z2 grün machen.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ImportRunPanel } from "../../apps/web/src/pages/Stufe2";
import { warteAufOffeneImportLaeufe } from "../../services/app/src/routes/confluence-import-routes";
import {
  BASIS,
  type Buehne,
  TOKEN,
  baueBuehne,
  confluenceInstanz,
  haengtBisZurFrist,
  seite,
} from "./confluence-buehne";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HOST = new URL(BASIS).host;

let b: Buehne | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function warteBis(bedingung: () => boolean, ms = 8000): Promise<void> {
  const ende = Date.now() + ms;
  while (!bedingung() && Date.now() < ende) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
  }
}

async function laufkarteOeffnen(): Promise<void> {
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
}

function feld(testid: string): string {
  return container?.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

/** Startet über den ECHTEN Knopf und wartet, bis der Hintergrundlauf und die Anzeige fertig sind. */
async function startenUndAbwarten(buehne: Buehne): Promise<{
  importId: string;
  lauf: Record<string, unknown>;
}> {
  const knopf = container?.querySelector<HTMLButtonElement>('[data-testid="f0140-start"]');
  expect(knopf, "der Startknopf der Lauf-Karte fehlt").toBeTruthy();
  await act(async () => {
    knopf?.click();
  });
  await warteBis(() => buehne.aufrufe.some((a) => a.url.includes("/api/admin/import/runs/")));
  await warteAufOffeneImportLaeufe(buehne.dienste.importRuns);
  const abruf = buehne.aufrufe.find((a) => a.url.includes("/api/admin/import/runs/"));
  const importId = (abruf?.url ?? "").split("/").pop() ?? "";
  expect(importId, "die Lauf-Karte hat keinen Lauf abgefragt").not.toBe("");
  const antwort = await buehne.app.inject({
    method: "GET",
    url: `/api/admin/import/runs/${importId}`,
    headers: buehne.kopf,
  });
  expect(antwort.statusCode).toBe(200);
  const lauf = antwort.json() as Record<string, unknown>;
  // Die Karte fragt im Takt nach, solange der Lauf läuft — gewartet wird auf den ENDzustand.
  const erwartet = i18n.t(`w2.run.status.${String(lauf.status)}`);
  await warteBis(() => feld("w2-run-label") === erwartet);
  return { importId, lauf };
}

async function kandidaten(buehne: Buehne): Promise<Array<{ item: { externalId?: string } }>> {
  const res = await buehne.app.inject({
    method: "GET",
    url: "/api/library/import/candidates",
    headers: buehne.kopf,
  });
  expect(res.statusCode).toBe(200);
  return res.json() as Array<{ item: { externalId?: string } }>;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    const r = root;
    await act(async () => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
  b?.abbauen();
  b = null;
});

describe("R-0159 · F2 — der Abbruch eines Folgeabrufs reist bis in den Lauf und auf die Fläche", () => {
  it("Z1 · Frist auf der Folgeseite: PARTIAL, Kandidat erhalten, CONFLUENCE_TIMEOUT, verständlich", async () => {
    const instanz = confluenceInstanz({
      ergebnisseiten: [[seite("101", "Wartung Pumpe", 1, "Pumpe vor dem Anlauf prüfen.")]],
      folgeseite: (init) => haengtBisZurFrist(init),
    });
    b = await baueBuehne({ fetchFn: instanz.fetchFn, timeoutMs: 150 });
    await laufkarteOeffnen();
    const { lauf } = await startenUndAbwarten(b);

    // DER GESPEICHERTE LAUF — die Stelle, an der der Grund bis hierher verloren ging.
    expect(lauf.status).toBe("PARTIAL");
    expect(lauf.failureCode).toBe("CONFLUENCE_TIMEOUT");
    expect(String(lauf.failureReason)).toContain("Zeitüberschreitung");
    expect(lauf.counters).toMatchObject({ itemsTotal: 1, itemsCreated: 1 });
    // Der Folgeabruf hat wirklich stattgefunden (und ist an der Frist gescheitert).
    expect(instanz.abrufe.some((u) => u.includes("start=1"))).toBe(true);
    // Die bereits gelesene Seite ist erhalten — als Kandidat, nicht verworfen.
    expect((await kandidaten(b)).map((k) => k.item.externalId)).toEqual(["101"]);

    // DIE FLÄCHE: Zustand, Code UND der Satz in der Sprache der Fläche.
    expect(feld("w2-run-label")).toBe(i18n.t("w2.run.status.PARTIAL"));
    expect(feld("w2-run-failure-code")).toContain("CONFLUENCE_TIMEOUT");
    expect(feld("w2-run-failure-text")).toBe(i18n.t("w2.run.failureText.CONFLUENCE_TIMEOUT"));
    expect(feld("w2-run-failure-reason")).toContain("Zeitüberschreitung");

    // KEIN GEHEIMNIS, KEINE ADRESSE — weder im Lauf noch auf dem Bildschirm.
    const roh = JSON.stringify(lauf);
    const sichtbar = container?.textContent ?? "";
    for (const text of [roh, sichtbar]) {
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain(HOST);
    }
  });

  it("Z2 · Zeitbudget nach der ersten Seite: PARTIAL, CONFLUENCE_BUDGET, verständlich", async () => {
    const instanz = confluenceInstanz({
      ergebnisseiten: [
        [seite("201", "Wartung Ventil", 1, "Ventil vierteljährlich prüfen.")],
        [seite("202", "Wartung Filter", 1, "Filter monatlich tauschen.")],
      ],
      ersteVerzoegerungMs: 80,
    });
    b = await baueBuehne({ fetchFn: instanz.fetchFn, totalBudgetMs: 30 });
    await laufkarteOeffnen();
    const { lauf } = await startenUndAbwarten(b);

    expect(lauf.status).toBe("PARTIAL");
    expect(lauf.failureCode).toBe("CONFLUENCE_BUDGET");
    expect(String(lauf.failureReason)).toContain("nicht vollständig gelesen");
    expect(lauf.counters).toMatchObject({ itemsTotal: 1, itemsCreated: 1 });
    // Das Budget greift VOR dem nächsten Abruf: die zweite Ergebnisseite wurde nie angefragt.
    expect(instanz.abrufe.some((u) => u.includes("start=1"))).toBe(false);
    expect((await kandidaten(b)).map((k) => k.item.externalId)).toEqual(["201"]);

    expect(feld("w2-run-label")).toBe(i18n.t("w2.run.status.PARTIAL"));
    expect(feld("w2-run-failure-code")).toContain("CONFLUENCE_BUDGET");
    expect(feld("w2-run-failure-text")).toBe(i18n.t("w2.run.failureText.CONFLUENCE_BUDGET"));
    expect(container?.textContent ?? "").not.toContain(TOKEN);
  });

  it("Z3 · KALIBRIERUNG: ohne Abbruch COMPLETED und KEIN Fehlercode", async () => {
    const instanz = confluenceInstanz({
      ergebnisseiten: [
        [seite("301", "Wartung Lager", 1, "Lager schmieren.")],
        [seite("302", "Wartung Riemen", 1, "Riemen spannen.")],
      ],
    });
    b = await baueBuehne({ fetchFn: instanz.fetchFn });
    await laufkarteOeffnen();
    const { lauf } = await startenUndAbwarten(b);

    expect(lauf.status).toBe("COMPLETED");
    expect(lauf.failureCode).toBeNull();
    expect(lauf.counters).toMatchObject({ itemsTotal: 2, itemsCreated: 2 });
    expect(container?.querySelector('[data-testid="w2-run-failure-code"]')).toBeNull();
    expect(container?.querySelector('[data-testid="w2-run-failure-text"]')).toBeNull();
  });
});
