// WP-SAMMEL20-FIX (bens Fix 6, IC-2): (a) partielle Confluence-Mappingfehler werden nicht mehr
// verschwiegen — die Erkundungs-Antwort trägt mappedPages/failedPages (+ PII-freie Fehlerklassen,
// nie die rohe Meldung) und die UI zeigt den nüchternen Hinweis; (b) die Explore-Antwort ist
// serverseitig auf Top-N gedeckelt (TOP_AUTHORS/TOP_TOPICS), die Gesamtzahlen reisen separat und
// der Client zeigt ehrlich Top N von X an.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toExploreView } from "../../apps/web/src/lib/importExplore";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem } from "../../services/library-analytics";
import { TOP_AUTHORS, TOP_TOPICS, summarizeImportItems } from "../../services/library-analytics";

function item(overrides: Partial<ImportItem> & { title: string }): ImportItem {
  return {
    statement: "kurz",
    type: "best_practice",
    category: "K",
    provider: "Confluence",
    textCodec: "decoded",
    ...overrides,
  };
}

// Großer Fixture-Space: 25 verschiedene Autoren, 35 verschiedene Themen-Labels.
function bigSpace(): ImportItem[] {
  const items: ImportItem[] = [];
  for (let i = 1; i <= 25; i++) {
    items.push(item({ title: `Seite Autor ${i}`, author: `Autor-${String(i).padStart(2, "0")}` }));
  }
  for (let i = 1; i <= 35; i++) {
    items.push(
      item({
        title: `Seite Thema ${i}`,
        author: "Autor-01",
        tags: [`thema-${String(i).padStart(2, "0")}`],
      }),
    );
  }
  return items;
}

async function exploreApp(adapter: ConfluenceSourceAdapter) {
  const services = buildServices();
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      makeAdapter: () => adapter,
    }),
  );
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return {
    app,
    headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
  };
}

describe("WP-SAMMEL20-FIX (Fix 6b): summarizeImportItems — Top-N-Deckel + ehrliche Gesamtzahlen", () => {
  it("deckelt Autoren/Themen auf die Optionen und liefert authorsTotal/topicsTotal VOR dem Deckel", () => {
    const summary = summarizeImportItems(bigSpace(), {
      topAuthors: TOP_AUTHORS,
      topThemes: TOP_TOPICS,
    });
    expect(summary.authors.length).toBe(TOP_AUTHORS);
    expect(summary.authorsTotal).toBe(25);
    // 25 Autor-Seiten ohne Label haben abgeleitete/keine Themen — die 35 echten Labels dominieren.
    expect(summary.themes.length).toBeLessThanOrEqual(TOP_TOPICS + 1); // + „(ohne Label)"-Zähler
    expect(summary.topicsTotal).toBeGreaterThanOrEqual(35);
    // Ohne Optionen bleibt alles ungedeckelt — Totale und Listenlänge stimmen überein.
    const full = summarizeImportItems(bigSpace());
    expect(full.authors.length).toBe(full.authorsTotal);
  });
});

describe("WP-SAMMEL20-FIX (Fix 6): Explore-Route — Wire-Deckel + ehrliche Mappingfehler-Zähler", () => {
  it("großer Space → Antwort gedeckelt (Top-N), Gesamtzahlen als separate Zähler", async () => {
    const items = bigSpace();
    const adapter = {
      source: "Confluence",
      collect: async () => items,
      collectAll: async () => ({ items, failed: [], truncated: false }),
    } as unknown as ConfluenceSourceAdapter;
    const { app, headers } = await exploreApp(adapter);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      summary: {
        authors: unknown[];
        themes: unknown[];
        authorsTotal: number;
        topicsTotal: number;
      };
      mappedPages: number;
      failedPages: number;
    };
    expect(body.summary.authors.length).toBe(TOP_AUTHORS);
    expect(body.summary.authorsTotal).toBe(25);
    expect(body.summary.themes.length).toBeLessThanOrEqual(TOP_TOPICS + 1);
    expect(body.summary.topicsTotal).toBeGreaterThanOrEqual(35);
    expect(body.mappedPages).toBe(items.length);
    expect(body.failedPages).toBe(0);
  });

  it("nicht lesbare Seiten → failedPages + PII-freie Fehlerklassen (nie die rohe Meldung)", async () => {
    const items = [item({ title: "Lesbar", author: "Anna" })];
    const adapter = {
      source: "Confluence",
      collect: async () => items,
      collectAll: async () => ({
        items,
        failed: [
          { ref: "p9", error: "Mapping kaputt: interner Pfad /srv/geheim", errorClass: "MapError" },
          { ref: "p10", error: "noch ein Fehler", errorClass: "MapError" },
        ],
        truncated: false,
      }),
    } as unknown as ConfluenceSourceAdapter;
    const { app, headers } = await exploreApp(adapter);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      mappedPages: number;
      failedPages: number;
      failedClasses?: string[];
    };
    expect(body.mappedPages).toBe(1);
    expect(body.failedPages).toBe(2);
    expect(body.failedClasses).toEqual(["MapError"]); // dedupliziert, nur die Klasse
    // Die ROHE Fehlermeldung (könnte Quell-/Infrastruktur-Details tragen) bleibt vom Wire fern.
    expect(res.body).not.toContain("geheim");
  });
});

describe("WP-SAMMEL20-FIX (Fix 6b): Client — ehrliche Top-N-von-X-Anzeige", () => {
  it("toExploreView rechnet den Rest gegen die ECHTE Gesamtzahl und führt listed/total", () => {
    const view = toExploreView({
      totalCount: 200,
      distinctSources: 1,
      authors: Array.from({ length: TOP_AUTHORS }, (_, i) => ({ name: `A${i}`, count: 1 })),
      themes: [],
      authorsTotal: 134,
      topicsTotal: 0,
      dateRange: null,
      withImagesHint: 0,
      sourceNames: [],
      textCodec: "decoded",
    });
    expect(view.authors.length).toBe(8); // Anzeige-Deckel des Clients bleibt
    expect(view.authorsListed).toBe(TOP_AUTHORS);
    expect(view.authorsTotal).toBe(134);
    expect(view.authorsRest).toBe(134 - 8); // Rest gegen die Gesamtzahl, nicht gegen die Wire-Liste
  });

  it("UI-Verdrahtung + i18n: failedPages-Hinweis und Top-N-von-Anzeige existieren (DE/EN/NL)", () => {
    const explore = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/ImportExplore.tsx"),
      "utf8",
    );
    expect(explore).toContain("imp.explore.failedPages");
    expect(explore.split("imp.explore.topOf").length - 1).toBe(2); // Autoren + Themen
    const select = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/ImportSelect.tsx"),
      "utf8",
    );
    expect(select).toContain("imp.select.aiUnavailable");
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const key of [
      "imp.explore.failedPages",
      "imp.explore.topOf",
      "imp.select.aiUnavailable",
    ]) {
      expect(`${key}:${i18n.split(`"${key}":`).length - 1}`).toBe(`${key}:3`);
    }
  });
});
