import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { LibraryService } from "../../library-analytics";
import { adapterFromConfig, createConfluenceAdapterFromEnv } from "./adapter";
import type { ConfluencePage } from "./rest-client";

// SCRUM-510: der Confluence-Adapter (Adapter #1 des quell-agnostischen Vertrags) end-to-end gegen ein
// deterministisches Fixture — collect() → normalisierte ImportItems → Import-Kern → KOs.

const restrictedPage: ConfluencePage = {
  id: "P-100",
  title: "Notfallplan",
  body: { storage: { value: "<p>Restringierter Inhalt.</p>" } },
  version: { number: 1 },
  _links: { webui: "/spaces/K/pages/P-100" },
  restrictions: { read: { restrictions: { group: { results: [{ g: 1 }] } } } },
};
const openPage: ConfluencePage = {
  id: "P-200",
  title: "Offene Seite",
  body: { storage: { value: "<p>Stand 1.</p>" } },
  version: { number: 1 },
  _links: { webui: "/spaces/K/pages/P-200" },
};

function fetchReturning(pages: ConfluencePage[]): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ results: pages }),
    }) as unknown as Response) as unknown as typeof fetch;
}

const config = (fetchFn: typeof fetch) => ({
  baseUrl: "https://acme.atlassian.net/wiki",
  email: "svc@acme.example",
  apiToken: "read-only-tok",
  spaceKey: "K",
  fetchFn,
});

describe("SCRUM-510: ConfluenceSourceAdapter", () => {
  it("collect(): Fixture-Seiten → normalisierte ImportItems (quell-agnostisch)", async () => {
    const adapter = adapterFromConfig(config(fetchReturning([restrictedPage, openPage])));
    expect(adapter.source).toBe("Confluence");
    const items = await adapter.collect();
    expect(items.map((i) => i.externalId)).toEqual(["P-100", "P-200"]);
    expect(items[0]?.confidentiality).toBe("vertraulich"); // restringiert → Governance-Signal
    // JOB 3089 (N11, Pedis Entscheidung 23): offen → ausdrücklich „intern“. Bis hierher stand hier
    // `toBeUndefined()` („kein Signal, fail-safe später"); der Fall bleibt und misst jetzt die
    // gesetzte Stufe genauso scharf wie vorher ihr Fehlen.
    expect(items[1]?.confidentiality).toBe("intern");
  });

  it("end-to-end: gemappte Items → KOs; restringiert = vertraulich, offen = intern", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });
    const items = await adapterFromConfig(
      config(fetchReturning([restrictedPage, openPage])),
    ).collect();

    const cands = await library.createImportCandidates(items, "importer");
    for (const c of cands) {
      await library.reviewImportCandidate(c.id, "accept", "importer");
    }
    const kos = await koService.list();
    const restricted = kos.find((k) => k.sources.some((s) => s.externalId === "P-100"));
    const open = kos.find((k) => k.sources.some((s) => s.externalId === "P-200"));
    expect(restricted?.confidentiality).toBe("vertraulich");
    // JOB 3089 (N11): die offene Seite kommt als ausdrücklich „intern“ am Objekt an — vorher stand
    // hier „vertraulich (fehlendes Signal → fail-safe)". Der fail-safe-Zweig des Kerns ist damit
    // nicht abgeschwächt: er greift weiterhin für Quellen, die WIRKLICH keine Stufe liefern
    // (s. services/library-analytics/src/service.test.ts, Nicht-Confluence-Adapter).
    expect(open?.confidentiality).toBe("intern");
  });

  // JOB 3089 (N11): der Fall MISST WEITERHIN DEN DOWNGRADE-SCHUTZ — er misst ihn jetzt sogar
  // schärfer. Bis hierher war er fast wirkungslos: der Import-Boden der offenen Seite war „vertraulich"
  // (fehlendes Signal → fail-safe), das KO stand schon dort, es gab nichts zu senken. Seit
  // Entscheidung 23 ist der Boden „intern" — genau die Lage, in der ein Re-Sync eine vom MENSCHEN
  // gesetzte höhere Stufe still herabziehen könnte. Deshalb stuft hier ein Mensch nach dem Erst-Import
  // hoch, und der Re-Sync darf das nicht anrühren (`service.ts:1479-1491`).
  it("Re-Sync desselben pageId: nur Anheben, kein Downgrade; Inhalt aktualisiert", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });

    // Erst-Import der offenen Seite (v1) → KO ausdrücklich „intern“.
    const first = await adapterFromConfig(config(fetchReturning([openPage]))).collect();
    const [c1] = await library.createImportCandidates(first, "importer");
    const r1 = await library.reviewImportCandidate(c1!.id, "accept", "importer");
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("intern");

    // Ein Mensch stuft das Objekt bewusst hoch — diese Entscheidung gehört ihm, nicht der Quelle.
    await koService.setConfidentiality(r1.koId!, "vertraulich", "anna");

    // Re-Sync: gleiche pageId, neuer Body, HÖHERE Version, weiterhin NICHT restringiert.
    const openV2: ConfluencePage = {
      ...openPage,
      body: { storage: { value: "<p>Stand 2 (aktualisiert).</p>" } },
      version: { number: 2 },
    };
    const second = await adapterFromConfig(config(fetchReturning([openV2]))).collect();
    const [c2] = await library.createImportCandidates(second, "importer");
    await library.reviewImportCandidate(c2!.id, "accept", "importer");

    const kos = (await koService.list()).filter((k) =>
      k.sources.some((s) => s.externalId === "P-200"),
    );
    expect(kos).toHaveLength(1); // Re-Sync, keine Dublette
    expect(kos[0]?.statement).toContain("Stand 2"); // Inhalt aktualisiert
    // Die menschliche Höherstufung überlebt den Re-Sync: der Import-Boden „intern“ senkt nichts.
    expect(kos[0]?.confidentiality).toBe("vertraulich"); // NICHT auf intern herabgestuft
  });

  // WP-E (19.07.2026): der Fehlertext, den die Import-Route aus einem gescheiterten collectAll fängt
  // (und seither loggt), MUSS bereits redigiert sein — der token-tragende Roh-Fehler des fetch läuft
  // durch redactedError/redactSecrets, bevor er den Client/Adapter verlässt.
  it("WP-E: collectAll propagiert Netzfehler redigiert (ohne Token/Base64)", async () => {
    const SECRET = "SUPER-GEHEIM-tok-42";
    const secretB64 = Buffer.from(`svc@acme.example:${SECRET}`, "utf8").toString("base64");
    const boom = (async () => {
      throw new Error(`connect failed calling https://acme.atlassian.net?token=${SECRET}`);
    }) as unknown as typeof fetch;
    const adapter = adapterFromConfig({ ...config(boom), apiToken: SECRET });
    await expect(adapter.collectAll()).rejects.toSatisfy((e: unknown) => {
      const msg = String((e as Error).message);
      expect(msg).not.toContain(SECRET);
      expect(msg).not.toContain(secretB64);
      return true;
    });
  });

  it("Flag OFF (oder fehlende Credentials) → kein Adapter, kein aktiver Import-Pfad", () => {
    const creds = {
      KLARWERK_CONFLUENCE_BASE_URL: "https://x/wiki",
      KLARWERK_CONFLUENCE_USER: "u",
      KLARWERK_CONFLUENCE_TOKEN: "t",
      KLARWERK_CONFLUENCE_SPACE: "K",
    };
    expect(createConfluenceAdapterFromEnv({ ...creds })).toBeUndefined(); // Flag fehlt → OFF
    expect(
      createConfluenceAdapterFromEnv({ ...creds, KLARWERK_CONFLUENCE_IMPORT: "1" }),
    ).toBeDefined();
    // Flag AN, aber Credentials/Space fehlen → trotzdem kein Adapter.
    expect(createConfluenceAdapterFromEnv({ KLARWERK_CONFLUENCE_IMPORT: "1" })).toBeUndefined();
  });
});
