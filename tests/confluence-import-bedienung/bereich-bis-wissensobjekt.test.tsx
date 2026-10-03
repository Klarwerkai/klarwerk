// @vitest-environment jsdom
// ================================================================================================
// R-0171 — EIN GANZER CONFLUENCE-BEREICH, AUS DER ANWENDUNG ANGESTOSSEN, BIS ZU DEN WISSENSOBJEKTEN.
// ================================================================================================
//
// Bens Befund: Der belegte Bereichslauf endete bei Review-Kandidaten (`itemsBound` ausdrücklich 0),
// die Annahme eines Confluence-Ankerkandidaten war nur getrennt belegt. Hier ist der ganze Weg EIN
// Fall, und jede Station ist das Produkt:
//
//   Startknopf der Lauf-Karte → Brücke → `POST /api/admin/import/confluence` → echter Adapter über
//   ZWEI paginierte Antworten (drei Seiten, Versionen, Quelllinks) → Review-Kandidaten → reguläre
//   Annahme (`PUT /api/library/import/candidates/:id {action:"accept"}` → `reviewImportCandidate`)
//   → Wissensobjekte über den regulären Leseweg (`GET /api/kos/:id`).
//
// R-0126 (Elternabschnitt) grenzt gegen automatisch geprüftes Wissen ab: VOR der Annahme darf kein
// Wissensobjekt entstehen — der Lauf legt nur Kandidaten an, der Mensch entscheidet. Und ein
// WIEDERHOLTER Lauf über denselben Bereich legt weder Kandidaten noch Objekte doppelt an.
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
  SPACE,
  baueBuehne,
  confluenceInstanz,
  seite,
} from "./confluence-buehne";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der Bereich: drei Seiten, verteilt auf zwei Ergebnisseiten, mit verschiedenen Versionen. */
const BEREICH = [
  [
    seite("101", "Wartung Pumpe", 3, "Pumpe vor jedem Anlauf entlüften."),
    seite("102", "Wartung Ventil", 2, "Ventil vierteljährlich auf Dichtheit prüfen."),
  ],
  [seite("103", "Wartung Filter", 1, "Filter monatlich tauschen.")],
];
const ERWARTET = BEREICH.flat().map((p) => ({
  externalId: p.id,
  titel: p.title,
  version: p.version?.number,
  text: (p.body?.storage?.value ?? "").replace(/<[^>]+>/g, ""),
  url: `${BASIS}${p._links?.webui ?? ""}`,
}));

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

function feld(testid: string): string {
  return container?.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

/** Die Laufkennungen, die die Lauf-Karte abgefragt hat — in der Reihenfolge ihres Auftretens. */
function laufKennungen(buehne: Buehne): string[] {
  const ids = buehne.aufrufe
    .filter((a) => a.url.includes("/api/admin/import/runs/"))
    .map((a) => a.url.split("/").pop() ?? "");
  return [...new Set(ids)];
}

/** Ein Lauf über den ECHTEN Startknopf, bis zum Endzustand auf Server UND Fläche. */
async function bereichImportieren(buehne: Buehne): Promise<Record<string, unknown>> {
  const vorher = laufKennungen(buehne).length;
  const knopf = container?.querySelector<HTMLButtonElement>('[data-testid="f0140-start"]');
  expect(knopf?.disabled, "der Startknopf ist nicht bedienbar").toBe(false);
  await act(async () => {
    knopf?.click();
  });
  await warteBis(() => laufKennungen(buehne).length > vorher);
  await warteAufOffeneImportLaeufe(buehne.dienste.importRuns);
  const importId = laufKennungen(buehne).at(-1) ?? "";
  const res = await buehne.app.inject({
    method: "GET",
    url: `/api/admin/import/runs/${importId}`,
    headers: buehne.kopf,
  });
  expect(res.statusCode).toBe(200);
  const lauf = res.json() as Record<string, unknown>;
  await warteBis(() => feld("w2-run-label") === i18n.t(`w2.run.status.${String(lauf.status)}`));
  return lauf;
}

interface Kandidat {
  id: string;
  status: string;
  koId: string | null;
  item: { externalId?: string };
}

async function lies<T>(buehne: Buehne, url: string): Promise<T> {
  const res = await buehne.app.inject({ method: "GET", url, headers: buehne.kopf });
  expect(res.statusCode, `GET ${url}`).toBe(200);
  return res.json() as T;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  b = await baueBuehne({ fetchFn: confluenceInstanz({ ergebnisseiten: BEREICH }).fetchFn });
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

describe("R-0171 · ganzer Bereich aus der Anwendung → Kandidaten → Annahme → Wissensobjekte", () => {
  it("der ganze Weg, die vollständige Seitenmenge, Herkunft je Objekt — und keine Doppelung", async () => {
    const buehne = b as Buehne;

    // 1 · DER LAUF ÜBER DEN KNOPF — beide Ergebnisseiten gelesen, alle drei Seiten eingereiht.
    const erster = await bereichImportieren(buehne);
    expect(erster.status).toBe("COMPLETED");
    expect(erster.failureCode).toBeNull();
    expect(erster.counters).toEqual({
      itemsTotal: 3,
      itemsCreated: 3,
      itemsBound: 0,
      itemsSkipped: 0,
      itemsFailed: 0,
    });
    expect(feld("w2-run-label")).toBe(i18n.t("w2.run.status.COMPLETED"));

    // 2 · VOR DER ANNAHME: kein Wissensobjekt — der Lauf hat nichts selbst freigegeben (R-0126).
    expect(await lies<unknown[]>(buehne, "/api/kos")).toEqual([]);
    const offen = await lies<Kandidat[]>(buehne, "/api/library/import/candidates");
    expect(offen.map((k) => k.item.externalId).sort()).toEqual(["101", "102", "103"]);
    for (const k of offen) {
      expect(k.status, `Kandidat ${k.item.externalId} ist nicht offen`).toBe("neu");
      expect(k.koId).toBeNull();
    }

    // 3 · DIE REGULÄRE ANNAHME — jeder Kandidat über die Prüfroute, wie im Betrieb.
    const koIds: Record<string, string> = {};
    for (const k of offen) {
      const res = await buehne.app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${k.id}`,
        headers: buehne.kopf,
        payload: { action: "accept" },
      });
      expect(res.statusCode, `Annahme ${k.item.externalId}: ${res.body}`).toBe(200);
      const koId = (res.json() as { koId: string | null }).koId;
      expect(koId, `Annahme ${k.item.externalId} ohne Wissensobjekt`).toBeTruthy();
      koIds[k.item.externalId ?? ""] = koId ?? "";
    }

    // 4 · DIE WISSENSOBJEKTE über den regulären Leseweg — Inhalt, Quelle, Kennung, Version, Link.
    expect(await lies<unknown[]>(buehne, "/api/kos")).toHaveLength(3);
    for (const e of ERWARTET) {
      const ko = await lies<{
        title: string;
        statement: string;
        bodyHtml?: string;
        sources?: Array<{
          provider?: string | null;
          externalId?: string;
          sourceVersion?: number;
          url?: string | null;
          spaceKey?: string;
        }>;
      }>(buehne, `/api/kos/${koIds[e.externalId]}`);
      expect(ko.title).toBe(e.titel);
      expect(ko.statement).toContain(e.text);
      const quelle = (ko.sources ?? []).find((s) => s.externalId === e.externalId);
      expect(quelle, `Wissensobjekt ${e.externalId} ohne Herkunftsanker`).toBeTruthy();
      expect(quelle?.provider).toBe("Confluence");
      expect(quelle?.sourceVersion).toBe(e.version);
      expect(quelle?.url).toBe(e.url);
      expect(quelle?.spaceKey).toBe(SPACE);
    }

    // 5 · DIE WIEDERHOLUNG über denselben Knopf: alles erkannt, nichts doppelt.
    const zweiter = await bereichImportieren(buehne);
    expect(zweiter.status).toBe("COMPLETED");
    expect(zweiter.counters).toMatchObject({ itemsTotal: 3, itemsCreated: 0, itemsSkipped: 3 });
    expect(await lies<Kandidat[]>(buehne, "/api/library/import/candidates")).toHaveLength(3);
    expect(await lies<unknown[]>(buehne, "/api/kos")).toHaveLength(3);
  });
});
