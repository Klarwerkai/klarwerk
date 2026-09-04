// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega70 BLOCK B · B3 (JOB 1973 · D3) — DER RENDERBELEG DER STILLSTEN SACKGASSE
// ================================================================================================
//
// WARUM B3 UND NICHT B1/B2 ZUERST: von den vier Sackgassen ist B3 die einzige OHNE
// Rollenbedingung. `KnowledgeDetail.tsx` haengt den Herkunftsgraph-Verweis nur an
// `events.length > 0` — er stand damit fuer JEDE Rolle da, auch fuer eine Betrachterin, waehrend
// `/graph` `admin` verlangt. B1 und B2 zeigen einer hoeheren Rolle einen noch hoeheren Weg; B3
// zeigt ihn allen. Wer nach Schwere sortiert, faengt hier an.
//
// GEGEN WEN GEMESSEN WIRD: gegen das Produkt. Gemountet wird die ECHTE Seite `KnowledgeDetail`
// im ECHTEN Providerbaum — `AuthProvider` -> `RoleProvider` -> `MemoryRouter` -> `Routes` —
// nach dem Muster des vorhandenen Pruefstands `mega18-ko-detail-uebernahme-mounted.test.tsx:200-243`.
// Die Rollenfrage beantwortet `RoleLink` -> `routePathAllows` -> `GUARDED_ITEMS`, also die
// Registry, aus der auch der Router sein Gate zieht. NICHTS davon ist nachgebaut: kein zweiter
// Guard, keine gespiegelte Registry, keine `RoleLink`-Attrappe. Gestellt sind allein die
// Datenquellen (`endpoints`), damit die Seite ueberhaupt bis zu ihrem Verweis kommt — sie
// treffen die Rollenentscheidung nicht.
//
// GELESEN WIRD AM ERGEBNIS, nicht am Quelltext:
//   R1  gesperrte Rolle -> `aria-disabled="true"` am Element, „Kein Zugriff" im Text,
//       und KEIN `<a href="/graph">` im Baum
//   R2  erlaubte Rolle  -> genau umgekehrt: ein echter `<a href="/graph">`, kein `aria-disabled`
//   R2 ist die Kalibrierung: ohne sie waere R1 auch dann gruen, wenn der Verweis gar nicht
//   gerendert wuerde.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = {
  // Die Fixture ist die ERPROBTE aus `mega18-ko-detail-uebernahme-mounted.test.tsx:321-345`,
  // nicht selbst zusammengestellt — eine eigene liess die Seite an einem fehlenden Feld
  // scheitern („Cannot read properties of undefined (reading 'length')", gemessen).
  ko: {
    id: "ko-1",
    title: "Dichtungswechsel L4",
    statement: "Dichtung vor jedem Anlauf pruefen.",
    bodyHtml: "<p>Alter, gepruefter Absatz.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Instandhaltung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    history: [{ version: 1, at: "2026-07-01T10:00:00.000Z", author: "u1", note: "erstellt" }],
    comments: [],
    attachments: [],
    sources: [],
  } as Record<string, unknown>,
  // Genau EIN Herkunftsereignis — mehr braucht `events.length > 0` nicht, und weniger waere
  // der Zweig, den dieser Fall NICHT prueft.
  audit: [{ id: "a-1", seq: 1, target: "ko-1", action: "ko.create", actor: "Anna", at: 1 }],
};

// Das ECHTE Endpunktmodul wird gespreizt und nur an ZWEI Stellen ueberschrieben — dem Objekt und
// dem Herkunftsprotokoll. Alles andere bleibt das Produkt. Ein vollstaendig nachgebautes
// `endpoints` waere eine Nachbildung und wuerde ausserdem jede Stelle verdecken, die die Seite
// sonst noch zieht (gemessen: ohne diese Spreizung faellt der Fall an
// „Cannot read properties of undefined (reading 'list')").
vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      ko: { ...original.endpoints.ko, get: vi.fn(async () => box.ko) },
      audit: { ...original.endpoints.audit, list: vi.fn(async () => box.audit) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import type { Role } from "../../apps/web/src/app/navigation";
import { PublicAiEnrichPanel } from "../../apps/web/src/components/PublicAiEnrichPanel";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Stellt die effektive Rolle ueber denselben Weg wie die Admin-Ansicht (`RoleContext.setRole`). */
function RolleStellen({ rolle }: { rolle: Role }): null {
  const { setRole } = useRole();
  useEffect(() => {
    setRole(rolle);
  }, [rolle, setRole]);
  return null;
}

async function mount(rolle: Role, eintritt = "/wissen/ko-1"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: [eintritt] },
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(RolleStellen, { rolle }),
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

/** Alle `href`-Werte im gerenderten Baum — die Frage ist, ob ein WEG dasteht. */
function wege(): string[] {
  return Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
}

/**
 * JOB 3063 (H4): `/wissen/:id` ist die Leseflaeche der Bibliothek. Der Herkunftsverweis steht im
 * Abschnitt „Herkunftskette" hinter der Zeile „Mehr" (`MehrAbschnitte.tsx:847`), zugeklappt als
 * Vorgabe. Die ZUSAGE dieses Auftrags — der Verweis ist fuer eine Betrachterin eine LAGE und kein
 * Weg — ist davon unberuehrt; gemessen wird sie am aufgeklappten Abschnitt.
 *
 * `open = true` allein genuegt nicht: React zeichnet den Inhalt erst, wenn es das Aufklappen ueber
 * `onToggle` mitbekommt, und jsdom stellt `toggle` nur in die Warteschlange.
 */
function abschnittOeffnen(schluessel: string): void {
  const mehr = container.querySelector('[data-testid="bib-mehr"]');
  if (mehr instanceof HTMLButtonElement && mehr.getAttribute("aria-expanded") !== "true") {
    act(() => {
      mehr.click();
    });
  }
  const abschnitt = container.querySelector(`[data-bib-abschnitt="${schluessel}"]`);
  if (!(abschnitt instanceof HTMLDetailsElement)) {
    throw new Error(`Abschnitt „${schluessel}" fehlt; DOM: ${container.textContent}`);
  }
  if (!abschnitt.open) {
    act(() => {
      abschnitt.open = true;
      abschnitt.dispatchEvent(new Event("toggle"));
    });
  }
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

describe("mega70 Block B · B3: der Herkunftsverweis ist fuer eine Betrachterin eine Lage", () => {
  it("R1 · Rolle `viewer`: aria-disabled, Kein-Zugriff-Pille, und KEIN Weg auf /graph", async () => {
    await mount("viewer");
    abschnittOeffnen("herkunftskette");

    // Vorbedingung: der Verweis ist ueberhaupt gerendert. Sonst pruefte der Fall ein leeres DOM.
    const text = container.textContent ?? "";
    expect(text, "der Herkunftsverweis fehlt — der Fall haette nichts zu lesen").toContain(
      i18n.t("ko.lineageGraphLink"),
    );

    expect(
      container.querySelector('[aria-disabled="true"]'),
      "kein Element mit aria-disabled — die Sackgasse steht offen",
    ).not.toBeNull();
    expect(text, "die Kein-Zugriff-Pille fehlt im gerenderten Text").toContain(
      i18n.t("roleLink.noReach"),
    );
    expect(
      wege().filter((h) => h.startsWith("/graph")),
      "es steht weiterhin ein begehbarer Weg auf /graph da",
    ).toEqual([]);
  });

  it("R2 · KALIBRIERUNG, Rolle `admin`: derselbe Verweis ist ein echter Weg", async () => {
    await mount("admin");
    abschnittOeffnen("herkunftskette");

    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t("ko.lineageGraphLink"));
    expect(
      wege().filter((h) => h.startsWith("/graph")),
      "als admin fehlt der Weg auf /graph — dann misst R1 nichts",
    ).not.toEqual([]);
    expect(text, "als admin steht die Kein-Zugriff-Pille da").not.toContain(
      i18n.t("roleLink.noReach"),
    );
  });

  // ==============================================================================================
  // B2 (JOB 1973 · D4) — DER RUECKWEG AUS DER NACHARBEIT.
  //
  // KORREKTUR MEINER EIGENEN AUSSAGE AUS `D3`: dort steht als Huerde, der Block erscheine „erst
  // NACH einem gespeicherten Revisionsdurchlauf". Das war falsch und ist hier gemessen:
  //   `KnowledgeDetail.tsx:976`  {reviewReworkContext && !reworkSaved ? (
  //   `KnowledgeDetail.tsx:190`  const reviewReworkContext = isReviewReworkContext(params);
  //   `lib/reviewReworkContext.ts:18-20`  params.get("rework") === "review"
  // Der Block haengt an einem reinen QUERY-PARAMETER — `?rework=review` genuegt, und
  // `reworkSaved` ist beim Eintritt ohnehin `false`. Ich hatte `reworkSaved` (`:949`) mit dem
  // Block bei `:976` verwechselt. Ein Aufruf mit dem Parameter reicht.
  // ==============================================================================================

  it("B2-R1 · Rolle `experte` in der Nacharbeit: der Rueckweg ist eine Lage, kein Weg", async () => {
    await mount("experte", "/wissen/ko-1?rework=review");

    const text = container.textContent ?? "";
    expect(text, "der Nacharbeits-Block fehlt — der Fall haette nichts zu lesen").toContain(
      i18n.t("ko.rework.back"),
    );
    expect(
      container.querySelector('[aria-disabled="true"]'),
      "kein Element mit aria-disabled — die Sackgasse steht offen",
    ).not.toBeNull();
    expect(text, "die Kein-Zugriff-Pille fehlt im gerenderten Text").toContain(
      i18n.t("roleLink.noReach"),
    );
    expect(
      wege().filter((h) => h.startsWith("/validierung")),
      "es steht weiterhin ein begehbarer Weg auf /validierung da",
    ).toEqual([]);
  });

  it("B2-R2 · KALIBRIERUNG, Rolle `controller`: derselbe Rueckweg ist ein echter Weg", async () => {
    await mount("controller", "/wissen/ko-1?rework=review");

    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t("ko.rework.back"));
    expect(
      wege().filter((h) => h.startsWith("/validierung")),
      "als controller fehlt der Weg auf /validierung — dann misst B2-R1 nichts",
    ).not.toEqual([]);
  });

  // ==============================================================================================
  // B4 (JOB 1973 · D5) — NEU GEBAUT, MIT DEN RICHTIGEN REQUISITEN.
  //
  // WARUM NEU UND NICHT UEBERNOMMEN — und das ist mein Fehler, nicht BENs Fund:
  // Der D1-Fall rief `PublicAiEnrichPanel` mit `title`/`statement`/`onApply` auf und schob sie
  // per `as never` am Typ vorbei. Der echte Vertrag ist `{ stage, locale, onAppendHtml }`
  // (`PublicAiEnrichPanel.tsx:30-37`). Ein Fall, der seine Requisiten erfindet, misst nicht das
  // Bauteil, sondern seine eigene Annahme. Schlimmer: ICH habe ihn in der D4-Abnahme trotzdem
  // als „gerendert belegt" gezaehlt und zwei Absaetze weiter geschrieben, dass er verworfen ist.
  // Ein Vorbehalt, der die Zeile daneben nicht bindet, ist Dekoration — hier bindet er.
  //
  // `stage: "blocked"` ist ein ECHTER Wert des Vertragstyps
  // (`api/types.ts:54`: "blocked" | "search_on_click" | "search_attach" | "open") und trifft den
  // Zweig `stage !== "open"` (`PublicAiEnrichPanel.tsx:72`), in dem der `/admin`-Hinweis steht.
  // Kein `as never`, keine erfundene Requisite.
  // ==============================================================================================

  /** Ein blosses Bauteil im ECHTEN Providerbaum — ohne die KO-Route, die es nicht braucht. */
  async function bauteilMounten(rolle: Role, inhalt: ReturnType<typeof createElement>) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(
            AuthProvider,
            null,
            createElement(
              RoleProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: ["/erfassen"] },
                createElement(RolleStellen, { rolle }),
                inhalt,
              ),
            ),
          ),
        ),
      );
      await flush();
    });
    await act(flush);
  }

  it("B4-R1 · Rolle `experte`: der Regler-Hinweis auf /admin ist eine Lage, kein Weg", async () => {
    await bauteilMounten(
      "experte",
      createElement(PublicAiEnrichPanel, {
        stage: "blocked",
        locale: "de",
        onAppendHtml: () => undefined,
      }),
    );

    const text = container.textContent ?? "";
    // Vorbedingung: der Hinweis ist ueberhaupt gerendert.
    expect(text, "der Regler-Hinweis fehlt — der Fall haette nichts zu lesen").toContain(
      i18n.t("enrich.openAdmin"),
    );
    expect(
      container.querySelector('[aria-disabled="true"]'),
      "kein Element mit aria-disabled — die Sackgasse steht offen",
    ).not.toBeNull();
    expect(text, "die Kein-Zugriff-Pille fehlt im gerenderten Text").toContain(
      i18n.t("roleLink.noReach"),
    );
    expect(
      wege().filter((h) => h.startsWith("/admin")),
      "es steht weiterhin ein begehbarer Weg auf /admin da",
    ).toEqual([]);
  });

  it("B4-R2 · KALIBRIERUNG, Rolle `admin`: derselbe Hinweis ist ein echter Weg", async () => {
    await bauteilMounten(
      "admin",
      createElement(PublicAiEnrichPanel, {
        stage: "blocked",
        locale: "de",
        onAppendHtml: () => undefined,
      }),
    );

    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t("enrich.openAdmin"));
    expect(
      wege().filter((h) => h.startsWith("/admin")),
      "als admin fehlt der Weg auf /admin — dann misst B4-R1 nichts",
    ).not.toEqual([]);
    expect(text, "als admin steht die Kein-Zugriff-Pille da").not.toContain(
      i18n.t("roleLink.noReach"),
    );
  });
});
