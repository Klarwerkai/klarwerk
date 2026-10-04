// @vitest-environment jsdom
// ================================================================================================
// MR-SELECT-1 / R-1567 · Ben-Befund P1 (Restrunde gesamt-ki-laufprotokoll:2) — DIE KETTE AM STÜCK.
// ================================================================================================
//
// Bens Befund: `route-einstieg.test.ts` und `laufkarte-kette.test.ts` belegen getrennte Teilstücke.
// Der Routentest liest sein Repo unmittelbar, der Kartentest zeigt den fest gebauten Datensatz
// `r-select-1`. Keine im Routenfall erzeugte ID kam je in der Karte an.
//
// HIER LÄUFT EINE KETTE, OHNE DASS DER TEST DATEN ÜBERGIBT:
//   1. echte Anfrage `POST /api/admin/import/confluence/select` an die gebaute App (Guard, Schema,
//      Vertraulichkeits-Gate); die Attrappe sitzt nur am Modell-Client und an der Confluence-Quelle;
//   2. der Reasoner schreibt in DASSELBE Protokoll-Repo, aus dem der App-Dienst `modelRuns` liest;
//      die neue select-ID wird über die echte Lese-Route `GET /api/model-runs` ermittelt — sie war
//      vor der Anfrage nicht da;
//   3. die echte Seite `Capital` wird gemountet. Ihr `fetch` geht über `fastify.inject` an DIESELBE
//      App — die Karte holt sich den Lauf selbst. Der Test reicht ihr keinen Datensatz;
//   4. in DE, EN und NL steht in der Zeile genau dieser ID die übersetzte Art, kein Schlüssel.
//
// TASTATUR UND SICHTBARKEIT BELEGT DIESE DATEI NICHT (Ben, Runde 2): Die Prüfung auf `hidden`,
// `inert`, `aria-hidden`, `style.display` und `tabindex="-1"` ist nur eine Vorprüfung. Eine per
// Stylesheet ausgeblendete Karte lässt sie grün. Den Tastaturweg und die Lesbarkeit im echten
// Browser misst `tastaturweg-laufkarte-im-echten-browser.test.ts` (K6–K8).
//
// NICHT GEMESSEN: echte Tab-Bewegung und Layout in Chromium, PostgreSQL-Persistenz
// (`PgModelRunRepo`), echte Anbieter-API. „Persistiert" heißt hier: im Protokoll-Repo der App
// geschrieben und über ihre Lese-Route wieder gelesen.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capital } from "../../apps/web/src/pages/Stufe2";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem } from "../../services/library-analytics";
import {
  InMemoryModelRunRepo,
  type ModelRunRecord,
  ModelRunService,
} from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { cappedModelClient } from "../../services/reasoner/src/model-concurrency";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Dieselbe Lage wie in `route-einstieg.test.ts`: vollständig „intern" eingestuft, damit der Satz
// nicht vertraulich ist und das Modell in der Kette bleibt.
const ITEMS: ImportItem[] = [
  {
    title: "Wartung Pumpe",
    statement: "Die Pumpe wird jährlich gewartet.",
    type: "best_practice",
    category: "K",
    author: "Anna",
    tags: ["wartung"],
    sourceScope: "SPACE-K",
    updatedAt: "2020-01-01T00:00:00.000Z",
    confidentiality: "intern",
  },
];

const quelle = {
  source: "Confluence",
  collect: async () => ITEMS,
  collectAll: async () => ({ items: ITEMS, failed: [], truncated: false }),
} as unknown as ConfluenceSourceAdapter;

async function kettenApp() {
  const repo = new InMemoryModelRunRepo();
  const services = buildServices();
  const reasoner = new Reasoner(
    new ModelProvider(
      cappedModelClient(
        {
          name: "anthropic:auswahl-modell",
          model: "auswahl-modell",
          complete: async () => '{"themes":["wartung"]}',
        },
        { rejectsConfidential: true },
      ),
    ),
    new DeterministicProvider(),
    repo,
  );
  await erteileKiFreigabe(reasoner);
  // EIN Repo für Schreiben (Reasoner) und Lesen (Route `GET /api/model-runs`).
  const mutable = services as unknown as { reasoner: Reasoner; modelRuns: ModelRunService };
  mutable.reasoner = reasoner;
  mutable.modelRuns = new ModelRunService({ repo });
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner,
      makeAdapter: () => quelle,
    }),
  );
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "kette@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "kette@x.de", password: "secret123" },
  });
  const admin = { authorization: `Bearer ${login.json().token}` };
  return { app, admin };
}

type KettenApp = Awaited<ReturnType<typeof kettenApp>>;

async function laufIds(k: KettenApp): Promise<ModelRunRecord[]> {
  const res = await k.app.inject({ method: "GET", url: "/api/model-runs", headers: k.admin });
  expect(res.statusCode).toBe(200);
  return res.json() as ModelRunRecord[];
}

/** Der `fetch` der Oberfläche geht an DIESELBE App — keine gestellte Antwort. */
function fetchUeberApp(k: KettenApp): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const kopf: Record<string, string> = { ...k.admin };
      new Headers(init?.headers).forEach((wert, name) => {
        kopf[name] = wert;
      });
      const res = await k.app.inject({
        method: (init?.method ?? "GET") as "GET",
        url: String(url),
        headers: kopf,
        ...(typeof init?.body === "string" ? { payload: init.body } : {}),
      });
      return {
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        statusText: res.statusMessage,
        text: async () => res.body,
      } as Response;
    }),
  );
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(async () => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.unstubAllGlobals();
  await i18n.changeLanguage("de");
});

async function mounten(): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

function verborgenOderInert(el: HTMLElement | null): boolean {
  for (let x = el; x; x = x.parentElement) {
    if (
      x.hidden ||
      x.hasAttribute("inert") ||
      x.getAttribute("aria-hidden") === "true" ||
      x.style.display === "none"
    ) {
      return true;
    }
  }
  return false;
}

describe("MR-SELECT-1 · echte Anfrage → neue select-ID → Laufkarte DE/EN/NL", () => {
  it("K5 · die von der Route erzeugte ID kommt über die Lese-Route in der gemounteten Karte an", async () => {
    const k = await kettenApp();
    const vorher = new Set((await laufIds(k)).map((r) => r.id));

    const antwort = await k.app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers: k.admin,
      payload: { prompt: "alles zum Thema Wartung", promptConfidential: false },
    });
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json().inferenceStatus).toBe("ok");

    const neu = (await laufIds(k)).filter((r) => !vorher.has(r.id));
    expect(neu).toHaveLength(1);
    const lauf = neu[0] as ModelRunRecord;
    expect(lauf.task).toBe("select");
    expect(lauf.status).toBe("success");
    expect(lauf.model).toBe("auswahl-modell");
    // Keine feste Kennung aus einem anderen Test: die ID stammt aus diesem Lauf.
    expect(lauf.id).not.toBe("r-select-1");

    fetchUeberApp(k);
    for (const [sprache, wort] of [
      ["de", "Auswählen"],
      ["en", "Select"],
      ["nl", "Selecteren"],
    ] as const) {
      await i18n.changeLanguage(sprache);
      const container = await mounten();
      const zeilen = Array.from(
        container.querySelectorAll<HTMLElement>('[data-testid="mrun-row"]'),
      );
      const zeile = zeilen.find((z) => z.getAttribute("data-run-id") === lauf.id);
      expect(zeile, `${sprache}: keine Zeile für die neue ID ${lauf.id}`).toBeTruthy();
      const text = zeile?.textContent ?? "";
      expect(text, sprache).toContain(wort);
      expect(text, sprache).not.toContain("mrun.");
      expect(zeile?.querySelector('[data-testid="mrun-task-unbekannt"]')).toBeNull();
      expect(zeile?.querySelector('[data-testid="mrun-model"]')?.textContent).toContain(
        "auswahl-modell",
      );
      // Tastatur/Ohne Zeigegerät: nicht verborgen, nicht inert, nichts aus der Tab-Folge genommen.
      expect(verborgenOderInert(zeile ?? null), sprache).toBe(false);
      const karte = container.querySelector('[data-testid="mrun-card"]');
      expect(karte?.querySelectorAll('[tabindex="-1"]').length, sprache).toBe(0);
      act(() => gemountet.pop()?.root.unmount());
      container.remove();
    }
  });
});
