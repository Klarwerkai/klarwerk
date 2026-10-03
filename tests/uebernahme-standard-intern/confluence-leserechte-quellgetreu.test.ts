// ==================================================================================================
// AUFNAHME 20260922 · confluence-import-rechte — LESERECHTE UND VERTRAULICHKEIT QUELLGETREU.
// ==================================================================================================
//
// Zielzustand (R-0549): wer eine Seite in Confluence sehen darf, sieht sie in Klara, und sonst niemand.
// Die Nachbardatei `confluence-ohne-beschraenkung-ist-intern.test.ts` hält die Einzelseite fest (offen →
// intern, Benutzer-/Gruppenbeschränkung → vertraulich, leere Listen → intern). Diese Datei misst, was
// dort fehlte:
//
//   V1–V3  die VERERBTE Beschränkung. Confluence liefert `restrictions.read` nur für die eigene Seite;
//          eine Beschränkung an der Elternseite gilt aber auch für das Kind. Bis hierher wurde ein
//          solches Kind „intern" — für jeden mit `ko.read` offen.
//   N1–N3  derselbe Schutz beim Nachladen je ID (`fetchItem`, der Anwendungsweg der Übernahme).
//   Q1–Q3  geänderte Quellversion: eine nachträglich beschränkte Seite hebt das Objekt an, eine
//          aufgehobene Beschränkung macht es wieder intern, eine menschliche Einstufung bleibt.
//   G1     die Gruppierung: ein offener Bestand sperrt sie nicht, ein vererbt beschränkter schon.
//   L1–L4  der reguläre Leseweg mit angemeldeten Konten (Nacharbeit 2, Bens Befunde F1/F2).
//
// Fixture-Fetch, kein Netz, kein Token einer echten Instanz.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { adapterFromConfig } from "../../services/confluence/src/adapter";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService, groupingRequiresConfidential } from "../../services/library-analytics";

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };

function seite(
  id: string,
  ahnen: { id?: string; title?: string }[],
  lesen?: { user?: unknown[]; group?: unknown[] },
  version = 1,
): ConfluencePage {
  return {
    id,
    title: `Seite ${id}`,
    body: { storage: { value: `<p>Inhalt ${id}.</p>` } },
    version: { number: version },
    _links: { webui: `/spaces/K/pages/${id}` },
    ancestors: ahnen,
    ...(lesen
      ? {
          restrictions: {
            read: {
              restrictions: {
                user: { results: lesen.user ?? [] },
                group: { results: lesen.group ?? [] },
              },
            },
          },
        }
      : {}),
  };
}

function antwort(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Space-Listing liefert `liste`; `/content/<id>` liefert die Seite aus `einzeln` oder 404. */
function fixture(liste: ConfluencePage[], einzeln: ConfluencePage[] = liste) {
  const abgerufen: string[] = [];
  const fetchFn = (async (url: string | URL | Request) => {
    const u = new URL(String(url));
    const treffer = /\/rest\/api\/content\/([^/]+)$/.exec(u.pathname);
    if (treffer) {
      const id = decodeURIComponent(treffer[1] ?? "");
      abgerufen.push(id);
      const s = einzeln.find((p) => p.id === id);
      return s ? antwort(200, s) : antwort(404, {});
    }
    return antwort(200, { results: liste });
  }) as unknown as typeof fetch;
  const adapter = adapterFromConfig({
    baseUrl: OPTS.baseUrl,
    email: "svc@acme.test",
    apiToken: "fixture-token",
    spaceKey: "K",
    fetchFn,
  });
  return { adapter, abgerufen };
}

// Baum: Wurzel (offen) → Personal (Gruppe „hr") → Gehalt (selbst offen) → Detail (selbst offen)
//       Wurzel (offen) → Handbuch (offen) → Kapitel (offen)
const wurzel = seite("1", []);
const personal = seite("2", [{ id: "1", title: "Wurzel" }], { group: [{ name: "hr" }] });
const gehalt = seite("3", [
  { id: "1", title: "Wurzel" },
  { id: "2", title: "Personal" },
]);
const detail = seite("4", [
  { id: "1", title: "Wurzel" },
  { id: "2", title: "Personal" },
  { id: "3", title: "Gehalt" },
]);
const handbuch = seite("5", [{ id: "1", title: "Wurzel" }], { user: [], group: [] });
const kapitel = seite("6", [
  { id: "1", title: "Wurzel" },
  { id: "5", title: "Handbuch" },
]);
const BAUM = [wurzel, personal, gehalt, detail, handbuch, kapitel];

async function stufenAusSammlung(pages: ConfluencePage[]) {
  const { items } = await fixture(pages).adapter.collectAll();
  return Object.fromEntries(items.map((i) => [i.externalId, i.confidentiality]));
}

describe("R-0549 · vererbte Leseeinschränkung beim Einsammeln", () => {
  it("V1 · Kind und Enkel einer gruppenbeschränkten Seite sind vertraulich, offene Zweige intern", async () => {
    expect(await stufenAusSammlung(BAUM)).toEqual({
      "1": "intern",
      "2": "vertraulich", // eigene Gruppenbeschränkung
      "3": "vertraulich", // vererbt vom Elternteil
      "4": "vertraulich", // vererbt vom Großelternteil
      "5": "intern", // leere Listen sind keine Beschränkung
      "6": "intern", // offene Kette
    });
  });

  it("V2 · Benutzerbeschränkung am Vorfahren wirkt genauso wie Gruppenbeschränkung", async () => {
    const chef = seite("2", [{ id: "1", title: "Wurzel" }], { user: [{ accountId: "a" }] });
    expect(await stufenAusSammlung([wurzel, chef, gehalt])).toMatchObject({
      "2": "vertraulich",
      "3": "vertraulich",
    });
  });

  it("V3 · ein Vorfahr, der nicht nachgesehen werden konnte, ist kein „offen“ — fail-closed", async () => {
    // Elternteil 2 fehlt in der Sammlung (abgeschnittener Lauf oder für das Dienstkonto unsichtbar).
    expect(await stufenAusSammlung([wurzel, gehalt])).toMatchObject({ "3": "vertraulich" });
    // Vorfahr ohne ID: keine Aussage über ihn möglich.
    const lueckig = seite("7", [{ title: "ohne Kennung" }]);
    expect(await stufenAusSammlung([wurzel, lueckig])).toMatchObject({ "7": "vertraulich" });
  });

  it("V4 · Anti-Vakuum: die reine Einzelseiten-Sicht hätte das Kind als intern übernommen", () => {
    expect(mapConfluencePageToImportItem(gehalt, OPTS).confidentiality).toBe("intern");
  });
});

describe("R-0549 · derselbe Schutz beim Nachladen je ID (Anwendungsweg)", () => {
  it("N1 · Elternteil beschränkt → das frisch geladene Kind ist vertraulich", async () => {
    const { adapter } = fixture([], BAUM);
    expect((await adapter.fetchItem("3"))?.confidentiality).toBe("vertraulich");
    expect((await adapter.fetchItem("4"))?.confidentiality).toBe("vertraulich");
  });

  it("N2 · offene Kette → intern; jeder Vorfahr wurde dafür wirklich nachgesehen", async () => {
    const { adapter, abgerufen } = fixture([], BAUM);
    expect((await adapter.fetchItem("6"))?.confidentiality).toBe("intern");
    expect(abgerufen).toEqual(["6", "1", "5"]);
  });

  it("N3 · Vorfahr für das Dienstkonto nicht lesbar (404) → vertraulich", async () => {
    const { adapter } = fixture([], [wurzel, gehalt]);
    expect((await adapter.fetchItem("3"))?.confidentiality).toBe("vertraulich");
  });
});

describe("R-0182/R-0649 · geänderte Quellversion", () => {
  it("Q1 · offen übernommen, in v2 an der Quelle beschränkt → das Objekt wird vertraulich", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });

    // v1 enthält die GANZE offene Kette (Wurzel 1, Handbuch 5) — fehlte der Elternteil 5, wäre das
    // Kapitel nach V3 zu Recht fail-closed vertraulich und der Fall mäße nichts.
    const v1 = await fixture([wurzel, handbuch, kapitel]).adapter.collectAll();
    const c1 = (await library.createImportCandidates(v1.items, "importeur")).find(
      (c) => c.item.externalId === "6",
    );
    const r1 = await library.reviewImportCandidate(c1!.id, "accept", "reviewerin");
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("intern");

    // v2: das Handbuch (Elternteil) wird auf eine Gruppe beschränkt, das Kapitel bekommt Version 2.
    const handbuchZu = seite("5", [{ id: "1", title: "Wurzel" }], { group: [{ name: "qs" }] }, 2);
    const kapitelV2: ConfluencePage = {
      ...kapitel,
      body: { storage: { value: "<p>Inhalt 6, Stand 2.</p>" } },
      version: { number: 2 },
    };
    const v2 = await fixture([wurzel, handbuchZu, kapitelV2]).adapter.collectAll();
    const c2 = (await library.createImportCandidates(v2.items, "importeur")).find(
      (c) => c.item.externalId === "6",
    );
    await library.reviewImportCandidate(c2!.id, "accept", "reviewerin");

    const kos = (await koService.list()).filter((k) => k.sources.some((s) => s.externalId === "6"));
    expect(kos).toHaveLength(1);
    expect(kos[0]?.confidentiality).toBe("vertraulich");
  });

  // Nacharbeit 2 (Ben, Befund F2): bis hierher hielt Q2 die Funktionslücke als „Grenze" fest —
  // eine aufgehobene Quellbeschränkung liess das Objekt vertraulich. Jetzt ist es der Solltest.
  it("Q2 · in v1 beschränkt, in v2 mit LEEREN Listen → dasselbe Objekt wird wieder intern", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });
    const zu = seite("8", [], { user: [{ accountId: "a", email: "a@acme.test" }] }, 1);
    const v1 = await fixture([zu]).adapter.collectAll();
    const [c1] = await library.createImportCandidates(v1.items, "importeur");
    const r1 = await library.reviewImportCandidate(c1!.id, "accept", "reviewerin");
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("vertraulich");

    const offen: ConfluencePage = {
      ...seite("8", [], { user: [], group: [] }, 2),
      body: { storage: { value: "<p>Inhalt 8, Stand 2.</p>" } },
    };
    const v2 = await fixture([offen]).adapter.collectAll();
    const [c2] = await library.createImportCandidates(v2.items, "importeur");
    const r2 = await library.reviewImportCandidate(c2!.id, "accept", "reviewerin");

    expect(r2.koId).toBe(r1.koId);
    const kos = (await koService.list()).filter((k) => k.sources.some((s) => s.externalId === "8"));
    expect(kos).toHaveLength(1);
    expect(kos[0]?.sources.find((s) => s.externalId === "8")?.sourceVersion).toBe(2);
    expect(kos[0]?.confidentiality).toBe("intern");
    expect(kos[0]?.quellrechte).toEqual({ stufe: "intern" });
  });

  it("Q3 · Schutz bleibt: eine MENSCHLICHE Höherstufung überlebt die aufgehobene Quellbeschränkung", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });
    const v1 = await fixture([seite("9", [], { group: [{ name: "qs" }] }, 1)]).adapter.collectAll();
    const [c1] = await library.createImportCandidates(v1.items, "importeur");
    const r1 = await library.reviewImportCandidate(c1!.id, "accept", "reviewerin");
    // Ein Mensch stuft über die Quellstufe hinaus ein — diese Entscheidung gehört ihm.
    await koService.setConfidentiality(r1.koId!, "streng_vertraulich", "anna");

    const offen: ConfluencePage = {
      ...seite("9", [], { user: [], group: [] }, 2),
      body: { storage: { value: "<p>Inhalt 9, Stand 2.</p>" } },
    };
    const v2 = await fixture([offen]).adapter.collectAll();
    const [c2] = await library.createImportCandidates(v2.items, "importeur");
    await library.reviewImportCandidate(c2!.id, "accept", "reviewerin");
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("streng_vertraulich");
  });
});

// ==================================================================================================
// R-0549 / R-2197 AM REGULÄREN LESEWEG — echte App, echte Anmeldung, drei getrennte Identitäten.
// ==================================================================================================
//
// Ben, Nacharbeit 2 (Befund F1/F2): die Einstufung allein belegt nicht, WER liest. Gemessen wird
// hier über `buildServices`/`buildApp`, Adapter → `createImportCandidates` → `reviewImportCandidate`
// in DENSELBEN Dienst, und gelesen wird über `GET /api/kos/:id` und `GET /api/kos`:
//   · Lea   — gewöhnliche Leserin (viewer), in Confluence per Benutzerrestriktion berechtigt.
//   · Carl  — Controller (`ko.validate`), in Confluence NICHT berechtigt.
//   · Otto  — gewöhnlicher Leser ohne Quellrecht (Gegenprobe zu Lea).
// Angenommen wird vom Admin — eine DRITTE Identität, damit die Autorausnahme nichts verdeckt.
process.env.KLARWERK_CONFLUENCE_IMPORT = "1";

async function appMitKonten() {
  const services = buildServices();
  const app = buildApp(services);
  const admin = { name: "Admin R0549", email: "admin-r0549@example.com", password: "geheim-1234" };
  await app.inject({ method: "POST", url: "/api/auth/register", payload: admin });
  const anmelden = async (email: string, password: string) => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    const token = (login.json() as { token: string }).token;
    expect(token, `Anmeldung ${email}`).toBeTruthy();
    return { authorization: `Bearer ${token}` };
  };
  const adminHeaders = await anmelden(admin.email, admin.password);
  const liste = await app.inject({ method: "GET", url: "/api/users", headers: adminHeaders });
  const adminId = (liste.json() as { id: string }[])[0]?.id ?? "";
  expect(adminId).not.toBe("");
  const konto = async (name: string, email: string, role: string) => {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: adminHeaders,
      payload: { name, email, password: "geheim-1234", role },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    return {
      id: (angelegt.json() as { id: string }).id,
      headers: await anmelden(email, "geheim-1234"),
    };
  };
  return {
    app,
    services,
    adminId,
    lea: await konto("Lea", "lea@example.com", "viewer"),
    carl: await konto("Carl", "carl@example.com", "controller"),
    otto: await konto("Otto", "otto@example.com", "viewer"),
  };
}

async function liest(
  app: Awaited<ReturnType<typeof appMitKonten>>["app"],
  headers: Record<string, string>,
  koId: string,
) {
  const einzeln = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
  const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(liste.statusCode).toBe(200);
  const ids = (liste.json() as { id: string }[]).map((k) => k.id);
  return { einzeln, inListe: ids.includes(koId) };
}

describe("R-0549 · wer in Confluence lesen darf, liest in Klara — und sonst niemand", () => {
  it("L1 · Benutzerrestriktion auf Lea: Lea liest (200), Controller Carl und Leser Otto nicht", async () => {
    const k = await appMitKonten();
    // Die Mailadresse in anderer Schreibweise — die Zuordnung ist nicht zeichengenau.
    const nurLea = seite("900", [], { user: [{ accountId: "acc-lea", email: "Lea@Example.com" }] });
    const { items } = await fixture([nurLea]).adapter.collectAll();
    const [kandidat] = await k.services.library.createImportCandidates(items, k.adminId);
    const r = await k.services.library.reviewImportCandidate(kandidat!.id, "accept", k.adminId);
    const koId = r.koId!;
    expect((await k.services.ko.get(koId))?.quellrechte).toEqual({
      stufe: "vertraulich",
      leser: [k.lea.id],
    });

    const lea = await liest(k.app, k.lea.headers, koId);
    expect(lea.einzeln.statusCode).toBe(200);
    expect(lea.einzeln.body).toContain("Inhalt 900");
    expect(lea.inListe).toBe(true);

    const carl = await liest(k.app, k.carl.headers, koId);
    expect(carl.einzeln.statusCode).toBe(404);
    expect(carl.einzeln.body).not.toContain("Inhalt 900");
    expect(carl.inListe).toBe(false);

    const otto = await liest(k.app, k.otto.headers, koId);
    expect(otto.einzeln.statusCode).toBe(404);
    expect(otto.inListe).toBe(false);
  });

  it("L2 · vererbt: Elternseite nur für Lea UND Carl, Kind nur für Lea → nur Lea liest das Kind", async () => {
    const k = await appMitKonten();
    const eltern = seite("910", [], {
      user: [
        { accountId: "acc-lea", email: "lea@example.com" },
        { accountId: "acc-carl", email: "carl@example.com" },
      ],
    });
    const kind = seite("911", [{ id: "910", title: "Eltern" }], {
      user: [{ accountId: "acc-lea", email: "lea@example.com" }],
    });
    const enkel = seite("912", [
      { id: "910", title: "Eltern" },
      { id: "911", title: "Kind" },
    ]);
    const { items } = await fixture([eltern, kind, enkel]).adapter.collectAll();
    const kandidaten = await k.services.library.createImportCandidates(items, k.adminId);
    const koIds = new Map<string, string>();
    for (const c of kandidaten) {
      const r = await k.services.library.reviewImportCandidate(c.id, "accept", k.adminId);
      koIds.set(c.item.externalId ?? "", r.koId ?? "");
    }
    // Eltern: beide; Kind und Enkel (eigene Listen leer): nur die Schnittmenge = Lea.
    expect((await liest(k.app, k.carl.headers, koIds.get("910") ?? "")).einzeln.statusCode).toBe(
      200,
    );
    for (const pageId of ["911", "912"]) {
      const koId = koIds.get(pageId) ?? "";
      expect((await liest(k.app, k.lea.headers, koId)).einzeln.statusCode, pageId).toBe(200);
      expect((await liest(k.app, k.carl.headers, koId)).einzeln.statusCode, pageId).toBe(404);
    }
  });

  it("L3 · R-2197: Beschränkung in v2 aufgehoben → dasselbe Objekt wird intern und Otto liest es", async () => {
    const k = await appMitKonten();
    const zu = seite("920", [], { user: [{ accountId: "acc-lea", email: "lea@example.com" }] }, 1);
    const v1 = await fixture([zu]).adapter.collectAll();
    const [c1] = await k.services.library.createImportCandidates(v1.items, k.adminId);
    const r1 = await k.services.library.reviewImportCandidate(c1!.id, "accept", k.adminId);
    const koId = r1.koId!;
    expect((await liest(k.app, k.otto.headers, koId)).einzeln.statusCode).toBe(404);

    const offen: ConfluencePage = {
      ...seite("920", [], { user: [], group: [] }, 2),
      body: { storage: { value: "<p>Inhalt 920, Stand 2.</p>" } },
    };
    const v2 = await fixture([offen]).adapter.collectAll();
    const [c2] = await k.services.library.createImportCandidates(v2.items, k.adminId);
    const r2 = await k.services.library.reviewImportCandidate(c2!.id, "accept", k.adminId);
    expect(r2.koId).toBe(koId);

    const objekt = await k.services.ko.get(koId);
    expect(objekt?.confidentiality).toBe("intern");
    expect(objekt?.sources.find((s) => s.externalId === "920")?.sourceVersion).toBe(2);
    const otto = await liest(k.app, k.otto.headers, koId);
    expect(otto.einzeln.statusCode).toBe(200);
    expect(otto.einzeln.body).toContain("Stand 2");
    expect(otto.inListe).toBe(true);
  });

  it("L4 · ein öffentlicher Importrumpf kann sich keine Quellrechte schreiben", async () => {
    const k = await appMitKonten();
    const antwort = await k.app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers: k.carl.headers,
      payload: {
        items: [
          {
            title: "Fremd",
            statement: "Eingeschleust",
            type: "best_practice",
            category: "K",
            confidentiality: "intern",
            quellrechte: { stufe: "intern", emails: ["otto@example.com"] },
          },
        ],
      },
    });
    expect(antwort.statusCode, antwort.body).toBe(201);
    expect(antwort.body).not.toContain("quellrechte");
    const [gespeichert] = await k.services.library.listImportCandidates();
    expect(Object.hasOwn(gespeichert?.item ?? {}, "quellrechte")).toBe(false);
  });
});

describe("R-1601/R-2197 · die Gruppierung läuft für offene Bestände", () => {
  it("G1 · offener Zweig sperrt die externe Gruppierung nicht, ein vererbt beschränkter schon", async () => {
    const { items } = await fixture(BAUM).adapter.collectAll();
    const offen = items.filter((i) => ["1", "5", "6"].includes(i.externalId ?? ""));
    expect(groupingRequiresConfidential(offen)).toBe(false);
    const mitVererbung = items.filter((i) => ["1", "3"].includes(i.externalId ?? ""));
    expect(groupingRequiresConfidential(mitVererbung)).toBe(true);
  });
});
