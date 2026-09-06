// ================================================================================================
// JOB 3112 · V3 — DIE PRÜFFLÄCHE MONTIEREN UND BEDIENEN (Helfer, keine Testdatei).
// ================================================================================================
//
// Sie heisst nicht `*.test.tsx` und läuft deshalb nicht selbst als Suite (vitest.config.ts:36-40).
// Jede Testdatei setzt ihre eigenen `vi.mock`-Zeilen (aus `kulisse-mocks.ts`) und benutzt von hier
// nur das Montieren, das Klicken und das Ablesen — die Aussagen bleiben in den Testdateien.
import { expect, type vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KoAction } from "../../apps/web/src/api/endpoints";
import type { OverlapEntry, ValidationBoardKo } from "../../apps/web/src/api/types";
// i18n VOR der Seite: initialisiert react-i18next global.
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Fn = ReturnType<typeof vi.fn>;

/** Der deutsche Wortlaut eines Schlüssels — gemessen wird gegen das Register, nie gegen Prosa. */
export function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

/**
 * Eine Board-Zeile, wie die Route sie seit JOB 3003 liefert: die vier Auskunftsfelder sind IMMER
 * da, der Fehlzustand ist eine Aussage (`null` + `"unknown"`) und kein weggelassener Schlüssel.
 * Vorbelegt ist der Fall dieses Auftrags: KEINE Stufe.
 */
export function zeile(over: Partial<ValidationBoardKo> = {}): ValidationBoardKo {
  return {
    id: "k1",
    title: "PROBE-KO Ventilwartung",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    reviewVotes: { up: 0, warn: 0, down: 0 },
    staleVotes: 0,
    asset: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    confidentiality: null,
    confidentialityProvenance: "unknown",
    origin: null,
    originSources: [],
    ...over,
  } as ValidationBoardKo;
}

/** Ein Überschneidungs-Eintrag, wie `/api/duplicates` ihn (bereits redigiert) herausgibt. */
export function paar(over: Partial<OverlapEntry> = {}): OverlapEntry {
  return {
    id: "d1",
    koA: "k1",
    koB: "k9",
    relation: "identisch",
    aspects: [],
    eigenanteilA: "",
    eigenanteilB: "",
    recommendation: "zusammenfuehren",
    status: "offen",
    pairKey: "k1|k9",
    origin: "auto",
    createdAt: "2026-08-12T00:00:00.000Z",
    ...over,
  };
}

export interface Brett {
  container: HTMLDivElement;
  /** Der echte Abfrage-Zwischenspeicher der Seite — für den Fall „Auffrischung gescheitert". */
  qc: QueryClient;
  abbauen: () => void;
}

export async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

export async function mounteBrett(opts: {
  zeilen: ValidationBoardKo[];
  duplikate?: OverlapEntry[] | (() => Promise<OverlapEntry[]>);
}): Promise<Brett> {
  await i18n.changeLanguage("de");
  (endpoints.validation.board as unknown as Fn).mockResolvedValue(opts.zeilen as never);
  (endpoints.directory.list as unknown as Fn).mockResolvedValue([
    { id: "u1", name: "Prüfer" },
  ] as never);
  const dup = opts.duplikate ?? [];
  if (typeof dup === "function") {
    (endpoints.duplicates.list as unknown as Fn).mockImplementation(dup as never);
  } else {
    (endpoints.duplicates.list as unknown as Fn).mockResolvedValue(dup as never);
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(Validation),
        ),
      ),
    );
  });
  for (
    let i = 0;
    i < 8 && container.querySelectorAll('[data-testid="pruefen-karte"]').length === 0;
    i += 1
  ) {
    await flush();
  }
  return {
    container,
    qc,
    abbauen: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/**
 * RUNDE 2: eine FRISCHE Board-Antwort einspielen, während die Fläche schon steht — genau der
 * Vorgang, bei dem ein offener Folgezustand gefährlich wird (WP-SHIP9-B3FIX2, Bens Korrekturpflicht
 * 1). Es wird der echte react-query-Zwischenspeicher gesetzt, kein Haken ersetzt.
 */
export async function neuerBoardStand(b: Brett, zeilen: ValidationBoardKo[]): Promise<void> {
  await act(async () => {
    b.qc.setQueriesData({ queryKey: ["validation", "board"] }, zeilen as never);
  });
  await flush();
}

/** Klick wie ein Mensch — in `act`, damit React den Zustand vor der Messung durchreicht. */
export async function klick(el: Element | null | undefined): Promise<void> {
  expect(el, "das Element, auf das geklickt werden sollte, gibt es nicht").toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await flush();
}

export function finde(c: HTMLElement, sel: string): HTMLElement | null {
  return c.querySelector(sel) as HTMLElement | null;
}

/** Ein Knopf der Fläche, gefunden über seinen sichtbaren Text — so, wie ihn ein Mensch trifft. */
export function knopfMitText(c: HTMLElement, text: string): HTMLElement | null {
  for (const b of [...c.querySelectorAll("button")]) {
    if ((b.textContent ?? "").trim() === text) {
      return b as HTMLElement;
    }
  }
  return null;
}

/** Alle `PUT /api/kos/:id`-Nutzlasten in der Reihenfolge ihres Absendens. */
export function putFolge(): KoAction[] {
  const act_ = endpoints.ko.act as unknown as Fn;
  return act_.mock.calls.map((c: unknown[]) => c[1] as KoAction);
}
