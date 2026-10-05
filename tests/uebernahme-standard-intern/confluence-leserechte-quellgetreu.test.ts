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
//   Q4–Q6  Nacharbeit 3: menschliche Einstufung als Vermerk (F5); veraltete Kandidaten setzen
//          neuere Rechte nicht zurück — über die Version und bei reiner Rechteänderung (F4).
//   G1     die Gruppierung: ein offener Bestand sperrt sie nicht, ein vererbt beschränkter schon.
//   L1–L4  der reguläre Leseweg mit angemeldeten Konten (Nacharbeit 2, Bens Befunde F1/F2).
//   L5–L8  Nacharbeit 3: Space, Gruppen, Konten ohne Mailadresse, unbekannte Space-Rechte (F1),
//          der annehmende Autor ohne Quellrecht (F2, in L1), der Gesamtanweisungsweg (F3).
//
// Fixture-Fetch, kein Netz, kein Token einer echten Instanz.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
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

/**
 * Die Rechte außerhalb der Seite (Nacharbeit 3). `space: null` = das Dienstkonto darf die
 * Space-Berechtigungen nicht lesen (404). Ohne Angabe ist der Space ANONYM lesbar — dann gilt nur,
 * was Seite und Vorfahren beschränken (die Bedeutung aller Fälle vor Nacharbeit 3).
 */
interface FixtureRechte {
  space?: { users?: unknown[]; groups?: unknown[] } | null;
  gruppen?: Record<string, unknown[]>;
  /**
   * Nacharbeit 6 (Befund F3): eine Gruppe in MEHREREN Antwortseiten. Jede Seite außer der letzten
   * trägt `_links.next` — auch eine KURZE Seite. Ab `fehlerAb` antwortet die Quelle mit 500.
   */
  gruppenSeiten?: Record<string, { seiten: unknown[][]; fehlerAb?: number }>;
  kontoEmails?: Record<string, string>;
}

/** Space-Listing liefert `liste`; `/content/<id>` liefert die Seite aus `einzeln` oder 404. */
function fixture(
  liste: ConfluencePage[],
  einzeln: ConfluencePage[] = liste,
  rechte: FixtureRechte = {},
) {
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
    if (u.pathname.endsWith("/rest/api/space/K")) {
      if (rechte.space === null) {
        return antwort(404, {});
      }
      return antwort(200, {
        key: "K",
        permissions: [
          {
            operation: { operation: "read", targetType: "space" },
            anonymousAccess: rechte.space === undefined,
            subjects: {
              user: { results: rechte.space?.users ?? [] },
              group: { results: rechte.space?.groups ?? [] },
            },
          },
        ],
      });
    }
    if (u.pathname.endsWith("/rest/api/group/member")) {
      const name = u.searchParams.get("name") ?? "";
      const mehrseitig = rechte.gruppenSeiten?.[name];
      if (mehrseitig) {
        // Die Seitennummer reist im eigenen Fortsetzungsverweis (`start` = Seitenindex).
        const index = Number(u.searchParams.get("start") ?? "0");
        if (mehrseitig.fehlerAb !== undefined && index >= mehrseitig.fehlerAb) {
          return antwort(500, {});
        }
        const naechste = index + 1 < mehrseitig.seiten.length;
        return antwort(200, {
          results: mehrseitig.seiten[index] ?? [],
          _links: naechste
            ? {
                next: `/rest/api/group/member?name=${encodeURIComponent(name)}&start=${index + 1}&limit=200`,
              }
            : {},
        });
      }
      return antwort(200, { results: rechte.gruppen?.[name] ?? [] });
    }
    if (u.pathname.endsWith("/child/attachment")) {
      // Die Seiten dieser Fixtures tragen keine Anhänge (R-0163-Weg des Bereichsimports).
      return antwort(200, { results: [] });
    }
    if (u.pathname.endsWith("/rest/api/user/email")) {
      const email = rechte.kontoEmails?.[u.searchParams.get("accountId") ?? ""];
      return email ? antwort(200, { email }) : antwort(404, {});
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
    expect(kos[0]?.quellrechte).toMatchObject({ stufe: "intern", version: 2 });
    expect(Object.hasOwn(kos[0]?.quellrechte ?? {}, "leser")).toBe(false);
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

  // Nacharbeit 3 (Ben, Befund F5): die menschliche Entscheidung ist ein VERMERK, keine abweichende
  // Stufe. Setzt ein Mensch am Ende genau den Quellwert, bleibt es seine Entscheidung.
  it("Q4 · vertraulich (Quelle) → Mensch streng → Mensch vertraulich → Quelle intern: bleibt vertraulich", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });
    const v1 = await fixture([
      seite("10", [], { group: [{ name: "qs" }] }, 1),
    ]).adapter.collectAll();
    const [c1] = await library.createImportCandidates(v1.items, "importeur");
    const r1 = await library.reviewImportCandidate(c1!.id, "accept", "reviewerin");
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("vertraulich");
    await koService.setConfidentiality(r1.koId!, "streng_vertraulich", "anna");
    await koService.setConfidentiality(r1.koId!, "vertraulich", "anna", { mayDowngrade: true });
    expect((await koService.get(r1.koId!))?.einstufungMenschlich).toMatchObject({
      stufe: "vertraulich",
      von: "anna",
    });

    const offen: ConfluencePage = {
      ...seite("10", [], { user: [], group: [] }, 2),
      body: { storage: { value: "<p>Inhalt 10, Stand 2.</p>" } },
    };
    const v2 = await fixture([offen]).adapter.collectAll();
    const [c2] = await library.createImportCandidates(v2.items, "importeur");
    await library.reviewImportCandidate(c2!.id, "accept", "reviewerin");
    const objekt = await koService.get(r1.koId!);
    expect(objekt?.confidentiality).toBe("vertraulich");
    // Der Inhalt folgt der Quelle trotzdem — nur die Einstufung gehört dem Menschen.
    expect(objekt?.statement).toContain("Stand 2");
  });

  // Nacharbeit 3 (Ben, Befund F4): ein veralteter, noch offener Kandidat darf neuere Rechte nicht
  // zurücksetzen — weder über die Seitenversion noch bei einer reinen Rechteänderung.
  it("Q5 · v1-Kandidat zurückgehalten, eingeschränkte v2 angenommen, danach v1 angenommen: v2 bleibt", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({
      koService,
      externalUpsert: true,
      quellLeserAufloesen: async (emails) => emails.map((e) => `konto:${e}`),
    });
    const offenV1 = seite("11", [], undefined, 1);
    const v1 = await fixture([offenV1]).adapter.collectAll();
    const [alt] = await library.createImportCandidates(v1.items, "importeur");

    const zuV2: ConfluencePage = {
      ...seite("11", [], { user: [{ accountId: "a", email: "lea@example.com" }] }, 2),
      body: { storage: { value: "<p>Inhalt 11, Stand 2.</p>" } },
    };
    const v2 = await fixture([zuV2]).adapter.collectAll();
    const [neu] = await library.createImportCandidates(v2.items, "importeur");
    const rNeu = await library.reviewImportCandidate(neu!.id, "accept", "reviewerin");
    const rAlt = await library.reviewImportCandidate(alt!.id, "accept", "reviewerin");
    expect(rAlt.koId).toBe(rNeu.koId);

    const objekt = await koService.get(rNeu.koId!);
    expect(objekt?.confidentiality).toBe("vertraulich");
    expect(objekt?.quellrechte).toMatchObject({ leser: ["konto:lea@example.com"], version: 2 });
    expect(objekt?.sources.find((s) => s.externalId === "11")?.sourceVersion).toBe(2);
    expect(objekt?.statement).toContain("Stand 2");
  });

  it("Q6 · reine Rechteänderung ohne neue Seitenversion: die frühere Beobachtung setzt nichts zurück", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({
      koService,
      externalUpsert: true,
      quellLeserAufloesen: async (emails) => emails.map((e) => `konto:${e}`),
    });
    // Dieselbe Version 3 — zuerst offen beobachtet, später beschränkt (Confluence zählt bei einer
    // Rechteänderung die Seitenversion nicht hoch).
    const frueh = await fixture([seite("12", [], undefined, 3)]).adapter.collectAll();
    const [frueherKandidat] = await library.createImportCandidates(frueh.items, "importeur");
    await new Promise((r) => setTimeout(r, 15));
    const zu = seite("12", [], { user: [{ accountId: "a", email: "lea@example.com" }] }, 3);
    const spaet = await fixture([zu]).adapter.collectAll();
    // Dieselbe Version stünde in derselben Warteschlange nur EINMAL offen. Der zweite Lauf hat
    // deshalb seine eigene Warteschlange — über DENSELBEN Wissensbestand (zwei Importläufe).
    const zweiterLauf = new LibraryService({
      koService,
      externalUpsert: true,
      quellLeserAufloesen: async (emails) => emails.map((e) => `konto:${e}`),
    });
    const [spaeterKandidat] = await zweiterLauf.createImportCandidates(spaet.items, "importeur");
    const rSpaet = await zweiterLauf.reviewImportCandidate(
      spaeterKandidat!.id,
      "accept",
      "reviewerin",
    );
    await library.reviewImportCandidate(frueherKandidat!.id, "accept", "reviewerin");

    const objekt = await koService.get(rSpaet.koId!);
    expect(objekt?.confidentiality).toBe("vertraulich");
    expect(objekt?.quellrechte?.leser).toEqual(["konto:lea@example.com"]);
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
    admin: { id: adminId, headers: adminHeaders },
    lea: await konto("Lea", "lea@example.com", "viewer"),
    carl: await konto("Carl", "carl@example.com", "controller"),
    otto: await konto("Otto", "otto@example.com", "viewer"),
    // Nacharbeit 3: eine Expertin MIT Quellrecht — sie darf eine Gesamtanweisung anlegen.
    eva: await konto("Eva", "eva@example.com", "experte"),
  };
}

/** Import und Annahme durch den Admin (die annehmende, dritte Identität). */
async function uebernimmAlsAdmin(
  k: Awaited<ReturnType<typeof appMitKonten>>,
  pages: ConfluencePage[],
  rechte: FixtureRechte = {},
): Promise<Map<string, string>> {
  return nimmAnAlsAdmin(k, await reiheEinAlsAdmin(k, pages, rechte));
}

/** Nacharbeit 6: nur das Einreihen — für Prüfungen der Warteschlange VOR der Annahme. */
async function reiheEinAlsAdmin(
  k: Awaited<ReturnType<typeof appMitKonten>>,
  pages: ConfluencePage[],
  rechte: FixtureRechte = {},
) {
  const { items } = await fixture(pages, pages, rechte).adapter.collectAll();
  return k.services.library.createImportCandidates(items, k.adminId);
}

async function nimmAnAlsAdmin(
  k: Awaited<ReturnType<typeof appMitKonten>>,
  kandidaten: Awaited<ReturnType<typeof reiheEinAlsAdmin>>,
): Promise<Map<string, string>> {
  const koIds = new Map<string, string>();
  for (const c of kandidaten) {
    const r = await k.services.library.reviewImportCandidate(c.id, "accept", k.adminId);
    koIds.set(c.item.externalId ?? "", r.koId ?? "");
  }
  return koIds;
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

/**
 * Nacharbeit 6 (Ben, Befund F1): was ein Konto in der Importwarteschlange von einer Seite sieht —
 * Titel UND Text werden am Rohkörper gemessen, nicht an einer DTO-Auswahl.
 */
async function warteschlange(
  app: Awaited<ReturnType<typeof appMitKonten>>["app"],
  headers: Record<string, string>,
  pageId: string,
) {
  const antwort = await app.inject({
    method: "GET",
    url: "/api/library/import/candidates",
    headers,
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return {
    titel: antwort.body.includes(`Seite ${pageId}`),
    text: antwort.body.includes(`Inhalt ${pageId}`),
  };
}

describe("R-0549 · wer in Confluence lesen darf, liest in Klara — und sonst niemand", () => {
  it("L1 · Benutzerrestriktion auf Lea: Lea liest (200), Controller Carl und Leser Otto nicht", async () => {
    const k = await appMitKonten();
    // Die Mailadresse in anderer Schreibweise — die Zuordnung ist nicht zeichengenau.
    const nurLea = seite("900", [], { user: [{ accountId: "acc-lea", email: "Lea@Example.com" }] });
    const { items } = await fixture([nurLea]).adapter.collectAll();
    const [kandidat] = await k.services.library.createImportCandidates(items, k.adminId);

    // Nacharbeit 6 (F1): die Warteschlange VOR der Annahme — Lea sieht Titel und Text, alle
    // anderen (auch Controller und Admin) weder noch.
    expect(await warteschlange(k.app, k.lea.headers, "900")).toEqual({ titel: true, text: true });
    for (const wer of [k.carl, k.otto, k.admin]) {
      expect(await warteschlange(k.app, wer.headers, "900")).toEqual({ titel: false, text: false });
    }
    // Wer den Kandidaten nicht sehen darf, kann ihn auch nicht annehmen — und erfährt nichts.
    const blind = await k.app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidat!.id}`,
      headers: k.carl.headers,
      payload: { action: "accept" },
    });
    expect(blind.statusCode, blind.body).toBe(404);
    expect(blind.body).not.toContain("Inhalt 900");
    expect((await k.services.library.importKandidat(kandidat!.id))?.status).toBe("neu");

    const r = await k.services.library.reviewImportCandidate(kandidat!.id, "accept", k.adminId);
    const koId = r.koId!;
    expect((await k.services.ko.get(koId))?.quellrechte).toMatchObject({
      stufe: "vertraulich",
      leser: [k.lea.id],
    });
    expect((await k.services.ko.get(koId))?.author).toBe(k.adminId);

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

    // Nacharbeit 3 (Ben, Befund F2): der ANNEHMENDE Admin ist Autor, aber in Confluence nicht
    // berechtigt — die Annahme verschafft ihm keinen Lesezugriff.
    const admin = await liest(k.app, k.admin.headers, koId);
    expect(admin.einzeln.statusCode).toBe(404);
    expect(admin.einzeln.body).not.toContain("Inhalt 900");
    expect(admin.inListe).toBe(false);

    // Nacharbeit 6 (F1): die Warteschlange NACH der Annahme — dieselbe Grenze.
    expect(await warteschlange(k.app, k.lea.headers, "900")).toEqual({ titel: true, text: true });
    for (const wer of [k.carl, k.otto, k.admin]) {
      expect(await warteschlange(k.app, wer.headers, "900")).toEqual({ titel: false, text: false });
    }
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

  // ------------------------------------------------------------------------------------------------
  // Nacharbeit 3 (Ben, Befund F1): Space, Gruppen und Konten ohne mitgelieferte Mailadresse.
  // ------------------------------------------------------------------------------------------------

  it("L5 · eingeschränkter Space: seitenoffene Seite nur für Space-Leser — Gruppe und Konto ohne Mail aufgelöst", async () => {
    const k = await appMitKonten();
    const kandidaten = await reiheEinAlsAdmin(k, [seite("940", [])], {
      // Space lesbar für Lea (Benutzer mit Mail) und die Gruppe „team" — deren einziges Mitglied
      // Carl kommt OHNE Mailadresse; sie wird über `/rest/api/user/email` nachgefragt.
      space: {
        users: [{ accountId: "acc-lea", email: "lea@example.com" }],
        groups: [{ name: "team" }],
      },
      gruppen: { team: [{ accountId: "acc-carl" }] },
      kontoEmails: { "acc-carl": "carl@example.com" },
    });
    // Nacharbeit 6 (F1): die Warteschlange VOR der Annahme — nur die Space-Leser.
    for (const wer of [k.lea, k.carl]) {
      expect(await warteschlange(k.app, wer.headers, "940")).toEqual({ titel: true, text: true });
    }
    for (const wer of [k.otto, k.admin]) {
      expect(await warteschlange(k.app, wer.headers, "940")).toEqual({ titel: false, text: false });
    }
    const koIds = await nimmAnAlsAdmin(k, kandidaten);
    for (const wer of [k.lea, k.carl]) {
      expect(await warteschlange(k.app, wer.headers, "940")).toEqual({ titel: true, text: true });
    }
    for (const wer of [k.otto, k.admin]) {
      expect(await warteschlange(k.app, wer.headers, "940")).toEqual({ titel: false, text: false });
    }
    const koId = koIds.get("940") ?? "";
    const objekt = await k.services.ko.get(koId);
    // R-2197 bleibt: die Seite selbst ist offen, also nicht vertraulich.
    expect(objekt?.confidentiality).toBe("intern");
    expect([...(objekt?.quellrechte?.leser ?? [])].sort()).toEqual([k.carl.id, k.lea.id].sort());

    expect((await liest(k.app, k.lea.headers, koId)).einzeln.statusCode).toBe(200);
    expect((await liest(k.app, k.carl.headers, koId)).einzeln.statusCode).toBe(200);
    const otto = await liest(k.app, k.otto.headers, koId);
    expect(otto.einzeln.statusCode).toBe(404);
    expect(otto.inListe).toBe(false);
    expect((await liest(k.app, k.admin.headers, koId)).einzeln.statusCode).toBe(404);
  });

  it("L6 · Gruppenrestriktion an der Seite: die Mitglieder lesen, Nichtmitglieder nicht", async () => {
    const k = await appMitKonten();
    const koIds = await uebernimmAlsAdmin(k, [seite("950", [], { group: [{ name: "hr" }] })], {
      gruppen: { hr: [{ accountId: "acc-otto", email: "otto@example.com" }] },
    });
    const koId = koIds.get("950") ?? "";
    expect((await liest(k.app, k.otto.headers, koId)).einzeln.statusCode).toBe(200);
    expect((await liest(k.app, k.lea.headers, koId)).einzeln.statusCode).toBe(404);
    expect((await liest(k.app, k.carl.headers, koId)).einzeln.statusCode).toBe(404);
  });

  it("L7 · Space-Rechte nicht nachsehbar: unbekannt ist keine Freigabe — niemand liest", async () => {
    const k = await appMitKonten();
    const koIds = await uebernimmAlsAdmin(k, [seite("960", [])], { space: null });
    const koId = koIds.get("960") ?? "";
    expect((await k.services.ko.get(koId))?.quellrechte?.leser).toEqual([]);
    for (const wer of [k.lea, k.carl, k.otto, k.eva, k.admin]) {
      const ergebnis = await liest(k.app, wer.headers, koId);
      expect(ergebnis.einzeln.statusCode).toBe(404);
      expect(ergebnis.inListe).toBe(false);
    }
  });

  // ------------------------------------------------------------------------------------------------
  // Nacharbeit 3 (Ben, Befund F3): dieselbe Seite über den Gesamtanweisungsweg.
  // ------------------------------------------------------------------------------------------------

  it("L8 · Gesamtanweisung: Quellberechtigte lesen den Baustein, der ausgeschlossene Controller weder Titel noch Inhalt", async () => {
    const k = await appMitKonten();
    const koIds = await uebernimmAlsAdmin(k, [
      seite("970", [], {
        user: [
          { accountId: "acc-lea", email: "lea@example.com" },
          { accountId: "acc-eva", email: "eva@example.com" },
        ],
      }),
    ]);
    const koId = koIds.get("970") ?? "";
    // Gegenprobe am KO-Weg: dieselbe Lage wie unten.
    expect((await liest(k.app, k.lea.headers, koId)).einzeln.statusCode).toBe(200);
    expect((await liest(k.app, k.carl.headers, koId)).einzeln.statusCode).toBe(404);

    // Eva (Expertin, quellberechtigt) legt die Anweisung an und bindet Fassung 1.
    const angelegt = await k.app.inject({
      method: "POST",
      url: "/api/gesamtanweisungen",
      headers: k.eva.headers,
      payload: { titel: "Anweisung Quellrechte" },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const { id, version } = angelegt.json() as { id: string; version: number };
    const gebunden = await k.app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${id}/bausteine`,
      headers: k.eva.headers,
      payload: { version, koId, koVersion: 1 },
    });
    expect(gebunden.statusCode, gebunden.body).toBe(200);

    const alsLea = await k.app.inject({
      method: "GET",
      url: `/api/gesamtanweisungen/${id}`,
      headers: k.lea.headers,
    });
    expect(alsLea.statusCode, alsLea.body).toBe(200);
    expect(alsLea.body).toContain("Seite 970");
    expect(alsLea.body).toContain("Inhalt 970");

    const alsCarl = await k.app.inject({
      method: "GET",
      url: `/api/gesamtanweisungen/${id}`,
      headers: k.carl.headers,
    });
    expect(alsCarl.statusCode, alsCarl.body).toBe(200);
    expect(alsCarl.body).not.toContain("Seite 970");
    expect(alsCarl.body).not.toContain("Inhalt 970");
    expect((alsCarl.json() as { verborgeneBausteine: number }).verborgeneBausteine).toBe(1);
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

// ==================================================================================================
// Nacharbeit 6 (Ben, Befund F2) — DER REGULÄRE BEREICHSABGLEICH UND EINE REINE RECHTEÄNDERUNG.
// ==================================================================================================
//
// Confluence zählt die Seitenversion bei einer reinen Rechteänderung nicht hoch. Gemessen wird über
// `runConfluenceImport` — den Weg, den „Bereich importieren" wirklich geht —, nicht über eine zweite
// Warteschlange (Q6).

/** Ein Bereichsimport-Lauf über die echte Kette, mit dem Admin als Akteur. */
async function bereichsabgleich(
  k: Awaited<ReturnType<typeof appMitKonten>>,
  pages: ConfluencePage[],
  rechte: FixtureRechte = {},
) {
  return runConfluenceImport({
    adapter: fixture(pages, pages, rechte).adapter,
    library: k.services.library,
    koService: k.services.ko,
    dryRun: false,
    actor: k.adminId,
  });
}

async function kandidatFuer(k: Awaited<ReturnType<typeof appMitKonten>>, pageId: string) {
  const kandidat = (await k.services.library.listImportCandidates()).find(
    (c) => c.item.externalId === pageId && c.status === "neu",
  );
  expect(kandidat, `offener Kandidat für ${pageId}`).toBeDefined();
  return kandidat!;
}

describe("R-0549 · der Bereichsabgleich zieht Leserechte auch bei unveränderter Version nach", () => {
  it("B1 · offen übernommen, bei GLEICHER Version auf Lea beschränkt, erneut abgeglichen: Otto wird abgewiesen", async () => {
    const k = await appMitKonten();
    const lauf1 = await bereichsabgleich(k, [seite("980", [], undefined, 4)]);
    expect(lauf1.imported).toBe(1);
    const r = await k.services.library.reviewImportCandidate(
      (await kandidatFuer(k, "980")).id,
      "accept",
      k.adminId,
    );
    const koId = r.koId!;
    expect((await liest(k.app, k.otto.headers, koId)).einzeln.statusCode).toBe(200);

    await new Promise((fertig) => setTimeout(fertig, 15));
    const zu = seite("980", [], { user: [{ accountId: "acc-lea", email: "lea@example.com" }] }, 4);
    const lauf2 = await bereichsabgleich(k, [zu]);
    // Kein neuer Kandidat — die Version ist dieselbe. Trotzdem gelten die neuen Rechte.
    expect(lauf2.imported).toBe(0);

    const objekt = await k.services.ko.get(koId);
    expect(objekt?.quellrechte?.leser).toEqual([k.lea.id]);
    expect(objekt?.confidentiality).toBe("vertraulich");
    expect(objekt?.sources.find((s) => s.externalId === "980")?.sourceVersion).toBe(4);
    const otto = await liest(k.app, k.otto.headers, koId);
    expect(otto.einzeln.statusCode).toBe(404);
    expect(otto.inListe).toBe(false);
    expect((await liest(k.app, k.lea.headers, koId)).einzeln.statusCode).toBe(200);
  });

  it("B2 · ein offener Kandidat derselben Version verdrängt die neuere Rechtebeobachtung nicht", async () => {
    const k = await appMitKonten();
    await bereichsabgleich(k, [seite("981", [], undefined, 2)]);
    const offen = await kandidatFuer(k, "981");
    // Vor der Rechteänderung sieht Otto den offenen Kandidaten.
    expect(await warteschlange(k.app, k.otto.headers, "981")).toEqual({ titel: true, text: true });

    await new Promise((fertig) => setTimeout(fertig, 15));
    const zu = seite("981", [], { user: [{ accountId: "acc-lea", email: "lea@example.com" }] }, 2);
    const lauf2 = await bereichsabgleich(k, [zu]);
    expect(lauf2.imported).toBe(0);
    // Der offene Kandidat trägt jetzt die neuere Beobachtung — Otto sieht ihn nicht mehr.
    expect(await warteschlange(k.app, k.otto.headers, "981")).toEqual({
      titel: false,
      text: false,
    });
    expect(await warteschlange(k.app, k.lea.headers, "981")).toEqual({ titel: true, text: true });

    const r = await k.services.library.reviewImportCandidate(offen.id, "accept", k.adminId);
    const objekt = await k.services.ko.get(r.koId!);
    expect(objekt?.quellrechte?.leser).toEqual([k.lea.id]);
    expect((await liest(k.app, k.otto.headers, r.koId!)).einzeln.statusCode).toBe(404);
    expect((await liest(k.app, k.lea.headers, r.koId!)).einzeln.statusCode).toBe(200);
  });
});

// ==================================================================================================
// Nacharbeit 6 (Ben, Befund F3) — GRUPPENLESER VOLLSTÄNDIG, ODER SICHTBAR UNVOLLSTÄNDIG.
// ==================================================================================================

type MitQuellrechten = { quellrechte?: { emails?: string[]; leserUnvollstaendig?: true } };

describe("R-0549 · mehrseitige Gruppen und der Abbruchfall", () => {
  it("P1 · KURZE Seite mit Fortsetzung, dann eine zweite Seite: alle Mitglieder werden Leser", async () => {
    const gross = seite("990", [], { group: [{ name: "gross" }] });
    const { items } = await fixture([gross], undefined, {
      gruppenSeiten: {
        gross: {
          seiten: [
            [{ accountId: "a1", email: "lea@example.com" }],
            [
              { accountId: "a2", email: "otto@example.com" },
              { accountId: "a3", email: "eva@example.com" },
            ],
          ],
        },
      },
    }).adapter.collectAll();
    const rechte = (items[0] as MitQuellrechten).quellrechte;
    expect([...(rechte?.emails ?? [])].sort()).toEqual([
      "eva@example.com",
      "lea@example.com",
      "otto@example.com",
    ]);
    expect(rechte?.leserUnvollstaendig).toBeUndefined();
  });

  it("P2 · Abbruch mitten in der Gruppe: gelesene Mitglieder bleiben, unvollständig steht am Item, am Objekt und im Laufergebnis", async () => {
    const k = await appMitKonten();
    const zu = seite("991", [], { group: [{ name: "gross" }] });
    const lauf = await bereichsabgleich(k, [zu], {
      gruppenSeiten: {
        gross: {
          seiten: [
            [{ accountId: "a1", email: "lea@example.com" }],
            [{ accountId: "a2", email: "otto@example.com" }],
          ],
          fehlerAb: 1,
        },
      },
    });
    expect(lauf.leserUnvollstaendig).toBe(1);
    const kandidat = await kandidatFuer(k, "991");
    expect((kandidat.item as MitQuellrechten).quellrechte?.leserUnvollstaendig).toBe(true);

    const r = await k.services.library.reviewImportCandidate(kandidat.id, "accept", k.adminId);
    const objekt = await k.services.ko.get(r.koId!);
    expect(objekt?.quellrechte).toMatchObject({ leser: [k.lea.id], leserUnvollstaendig: true });
    // Fail-closed: der nicht gelesene Otto bekommt kein Leserecht.
    expect((await liest(k.app, k.lea.headers, r.koId!)).einzeln.statusCode).toBe(200);
    expect((await liest(k.app, k.otto.headers, r.koId!)).einzeln.statusCode).toBe(404);
  });

  it("P3 · technische Grenze: eine Gruppe über der Seitenobergrenze gilt nicht als vollständig", async () => {
    // 51 Seiten à ein Mitglied, jede mit Fortsetzung — die Grenze liegt bei 50 Seiten.
    const seiten = Array.from({ length: 51 }, (_, i) => [
      { accountId: `m${i}`, email: `m${i}@example.com` },
    ]);
    const riesig = seite("992", [], { group: [{ name: "riesig" }] });
    const { items } = await fixture([riesig], undefined, {
      gruppenSeiten: { riesig: { seiten } },
    }).adapter.collectAll();
    const rechte = (items[0] as MitQuellrechten).quellrechte;
    expect(rechte?.leserUnvollstaendig).toBe(true);
    expect(rechte?.emails).toHaveLength(50);
  });
});
