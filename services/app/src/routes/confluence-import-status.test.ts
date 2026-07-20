import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConfluenceSourceAdapter } from "../../../confluence";
import type { ImportItem } from "../../../library-analytics";
import { buildApp, buildServices } from "../build-app";
import { makeGuards } from "../http";
import { confluenceImportRoutes } from "./confluence-import-routes";

// WP-IC-PAKET-1 (Teil 4, IC-6a): Import-Status + Doppel-Import-Schutz — gegen die ECHTEN Routen und
// Services (LibraryService-Queue, KoService-Herkunftsanker). Der Quell-Referenz-Vertrag ist
// externalId (Confluence-Seiten-ID) + sourceVersion an KoSource bzw. am offenen Kandidaten; genau
// derselbe Vertrag, den die Import-Idempotenz nutzt. „Quelle neuer als Import" läuft über die
// VERSIONSNUMMER (die Quell-Referenz führt kein Änderungsdatum) — reine Anzeige, kein Update (IC-6b).

const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_ADDON_API"];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

function baseItem(over: Partial<ImportItem>): ImportItem {
  return {
    title: over.title ?? "Seite",
    statement: over.statement ?? "Aussage der Seite.",
    type: "best_practice",
    category: "K",
    ...over,
  };
}

const P1_V1 = baseItem({ title: "Wartung Pumpe", externalId: "p1", sourceVersion: 1 });
const P2_V1 = baseItem({ title: "Wartung Ventile", externalId: "p2", sourceVersion: 1 });
const NO_ID = baseItem({ title: "Seite ohne Anker" });

async function statusApp(itemsRef: { current: ImportItem[] }) {
  const adapter = {
    source: "Confluence",
    collect: async () => itemsRef.current,
    collectAll: async () => ({ items: itemsRef.current, failed: [], truncated: false }),
  } as unknown as ConfluenceSourceAdapter;
  // Der Quell-Anker (KoSource.externalId) wird nur bei aktivem externem Import geschrieben
  // (externalUpsert, s. build-app) — exakt der Produktionszustand mit KLARWERK_CONFLUENCE_IMPORT=1.
  // Flag NUR für buildServices setzen; buildApp würde sonst die Routen selbst registrieren (Duplikat) —
  // hier registrieren wir sie manuell mit dem Fixture-Adapter (Muster der übrigen Route-Tests).
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  const services = buildServices();
  delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner: services.reasoner,
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
  return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
}

describe("WP-IC-PAKET-1 Teil 4: Import-Status-Abgleich (echte Routen + Services)", () => {
  it("Erkundung/Vorschau: vor dem Import 0 markiert; nach dem Einreihen zählen offene Kandidaten", async () => {
    const itemsRef = { current: [P1_V1, P2_V1, NO_ID] };
    const { app, headers } = await statusApp(itemsRef);

    // VOR jedem Import: nichts markiert.
    const before = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().alreadyImported).toBe(0);

    // Echter Import → alle drei landen als offene Kandidaten (Review-Invariante).
    const run = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: { dryRun: false },
    });
    expect(run.statusCode).toBe(200);
    expect(run.json().imported).toBe(3);

    // Erkundung: „X Seiten, davon Y bereits importiert" — NUR die verankerten Seiten (p1/p2) sind
    // abgleichbar; die ankerlose Seite wird EHRLICH nicht als importiert behauptet.
    const after = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers,
    });
    expect(after.json().summary.totalCount).toBe(3);
    expect(after.json().alreadyImported).toBe(2);

    // Vorschau: je Eintrag markiert (Badge-Datenlage) + Zähler über die Vorschau-Liste.
    const select = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: {},
    });
    expect(select.statusCode).toBe(200);
    const preview = select.json().preview as {
      title: string;
      alreadyImported?: boolean;
      sourceNewer?: boolean;
    }[];
    expect(preview.find((e) => e.title === "Wartung Pumpe")?.alreadyImported).toBe(true);
    expect(preview.find((e) => e.title === "Wartung Ventile")?.alreadyImported).toBe(true);
    expect(preview.find((e) => e.title === "Seite ohne Anker")?.alreadyImported).toBeUndefined();
    expect(select.json().alreadyImported).toBe(2);
    // Gleiche Version wie eingereiht → KEIN „Quelle neuer"-Signal.
    expect(preview.some((e) => e.sourceNewer === true)).toBe(false);
  });

  it("angenommener Kandidat (KO-Herkunftsanker) + höhere Quell-Version → sourceNewer-Badge-Datenlage", async () => {
    const itemsRef = { current: [P1_V1, P2_V1] };
    const { app, services, headers } = await statusApp(itemsRef);

    await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers,
      payload: { dryRun: false },
    });
    // p1 annehmen → echtes KO mit Herkunftsanker (externalId=p1, sourceVersion=1).
    const candidates = await services.library.listImportCandidates();
    const p1 = candidates.find((c) => c.item.externalId === "p1");
    expect(p1).toBeDefined();
    if (!p1) {
      throw new Error("Kandidat p1 fehlt");
    }
    await services.library.reviewImportCandidate(p1.id, "accept", "tester");

    // Die QUELLE ändert sich: p1 liegt dort jetzt in Version 2.
    itemsRef.current = [{ ...P1_V1, sourceVersion: 2 }, P2_V1];

    const select = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: {},
    });
    const preview = select.json().preview as {
      title: string;
      alreadyImported?: boolean;
      sourceNewer?: boolean;
    }[];
    const p1Entry = preview.find((e) => e.title === "Wartung Pumpe");
    // Importiert (KO-Anker) UND Quelle neuer als der Import (Versionsvergleich).
    expect(p1Entry?.alreadyImported).toBe(true);
    expect(p1Entry?.sourceNewer).toBe(true);
    // p2 ist nur offener Kandidat gleicher Version: importiert ja, „neuer" nein.
    const p2Entry = preview.find((e) => e.title === "Wartung Ventile");
    expect(p2Entry?.alreadyImported).toBe(true);
    expect(p2Entry?.sourceNewer).toBeUndefined();
  });
});
