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
//   Q7     Nacharbeit 14: die Anhebung durch mains Restriktionsnachzug ist kein menschlicher Vermerk.
//   G1     die Gruppierung: ein offener Bestand sperrt sie nicht, ein vererbt beschränkter schon.
//   L1–L4  der reguläre Leseweg mit angemeldeten Konten (Nacharbeit 2, Bens Befunde F1/F2).
//   L5–L8  Nacharbeit 3: Space, Gruppen, Konten ohne Mailadresse, unbekannte Space-Rechte (F1),
//          der annehmende Autor ohne Quellrecht (F2, in L1), der Gesamtanweisungsweg (F3).
//
// Fixture-Fetch, kein Netz, kein Token einer echten Instanz.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
import { darfSehen } from "../../services/app/src/sichtbarkeit";
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
  /**
   * Nacharbeit 16 (Ben, K1): das Space-Leserecht (auch) über eine Zugangsklasse — V1 trägt dazu
   * einen Lese-Eintrag OHNE Subjekt, V2 nennt die Klasse (Form wie SPACE-RECHTE-V2.json).
   * `berechtigt`: die Konten, denen die Quelle bei der Leseprüfung je Konto das Leserecht bestätigt.
   */
  zugangsklasse?: { klasse: string; berechtigt: string[] };
}

/** Space-Listing liefert `liste`; `/content/<id>` liefert die Seite aus `einzeln` oder 404. */
function fixture(
  liste: ConfluencePage[],
  einzeln: ConfluencePage[] = liste,
  rechte: FixtureRechte = {},
) {
  const abgerufen: string[] = [];
  // Nacharbeit 18: jeder Abruf mit dem Konto, das er betrifft (Kontoabfrage bzw. Leseprüfung).
  const aufrufe: { pfad: string; konto?: string }[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    const geprueft = init?.body
      ? (JSON.parse(String(init.body)) as { subject?: { identifier?: string } }).subject?.identifier
      : undefined;
    const konto = u.searchParams.get("accountId") ?? geprueft;
    aufrufe.push({ pfad: u.pathname, ...(konto ? { konto } : {}) });
    // Nacharbeit 16: die Leseprüfung je Konto (`POST …/permission/check`) und die V2-Principals.
    if (/\/rest\/api\/content\/[^/]+\/permission\/check$/.test(u.pathname)) {
      const anfrage = JSON.parse(String(init?.body ?? "{}")) as {
        subject?: { identifier?: string };
      };
      const konto = anfrage.subject?.identifier ?? "";
      return antwort(200, {
        hasPermission: rechte.zugangsklasse?.berechtigt.includes(konto) ?? false,
      });
    }
    if (u.pathname.endsWith("/api/v2/spaces/655363/permissions")) {
      return antwort(200, {
        results: rechte.zugangsklasse
          ? [
              {
                id: "1",
                principal: { type: "access-class", id: rechte.zugangsklasse.klasse },
                operation: { key: "read", targetType: "space" },
              },
            ]
          : [],
        _links: {},
      });
    }
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
        id: 655363,
        key: "K",
        permissions: [
          {
            operation: { operation: "read", targetType: "space" },
            anonymousAccess: rechte.space === undefined && !rechte.zugangsklasse,
            subjects: {
              user: { results: rechte.space?.users ?? [] },
              group: { results: rechte.space?.groups ?? [] },
            },
          },
          ...(rechte.zugangsklasse
            ? [{ operation: { operation: "read", targetType: "space" }, anonymousAccess: false }]
            : []),
        ],
      });
    }
    // CF-REST-01: Confluence Cloud — erst das Gruppenverzeichnis (Name → ID), dann die Mitglieder
    // über `membersByGroupId`. Jede in dieser Fixture genannte Gruppe steht im Verzeichnis.
    if (u.pathname.endsWith("/rest/api/group")) {
      const namen = new Set([
        ...Object.keys(rechte.gruppen ?? {}),
        ...Object.keys(rechte.gruppenSeiten ?? {}),
        ...(rechte.space?.groups ?? []).map((g) => (g as { name?: string }).name),
        ...einzeln.flatMap((p) =>
          (p.restrictions?.read?.restrictions?.group?.results ?? []).map(
            (g) => (g as { name?: string }).name,
          ),
        ),
      ]);
      return antwort(200, {
        results: [...namen].filter(Boolean).map((name) => ({ name, id: `fixture-${name}` })),
        _links: {},
      });
    }
    const gruppenMitglieder = /\/rest\/api\/group\/([^/]+)\/membersByGroupId$/.exec(u.pathname);
    if (gruppenMitglieder) {
      const name = decodeURIComponent(gruppenMitglieder[1] ?? "").slice("fixture-".length);
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
                next: `/rest/api/group/${encodeURIComponent(`fixture-${name}`)}/membersByGroupId?start=${index + 1}&limit=200`,
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
  return { adapter, abgerufen, aufrufe };
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

  // Nacharbeit 14 (Zusammenführung mit mains Restriktionsnachzug R-0162/R-0549 Lauf 3): hebt der
  // Nachzug einer unveränderten Fassung die Stufe an, ist das eine QUELLentscheidung. Sie darf nicht
  // als menschliche Einstufung gelten — sonst folgte das Objekt einer wieder geöffneten Seite nie.
  it("Q7 · Anhebung durch den Restriktionsnachzug ist kein menschlicher Vermerk; wieder offen → intern", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });
    const v1 = await fixture([seite("13", [], undefined, 1)]).adapter.collectAll();
    const [c1] = await library.createImportCandidates(v1.items, "importeur");
    const r1 = await library.reviewImportCandidate(c1!.id, "accept", "reviewerin");
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("intern");

    // Dieselbe Fassung 1, jetzt an der Quelle auf eine Gruppe beschränkt — der Nachzug aus main.
    const zu = await fixture([
      seite("13", [], { group: [{ name: "qs" }] }, 1),
    ]).adapter.collectAll();
    const nachzug = await library.syncImportRestriction(zu.items[0]!, "lauf");
    expect(nachzug).toMatchObject({ koId: r1.koId, raisedTo: "vertraulich" });
    const angehoben = await koService.get(r1.koId!);
    expect(angehoben?.confidentiality).toBe("vertraulich");
    expect(angehoben?.einstufungMenschlich).toBeUndefined();

    // Gegenprobe: die Quelle öffnet die Seite in Fassung 2 wieder — das Objekt folgt (wie Q2).
    const offen: ConfluencePage = {
      ...seite("13", [], { user: [], group: [] }, 2),
      body: { storage: { value: "<p>Inhalt 13, Stand 2.</p>" } },
    };
    const v2 = await fixture([offen]).adapter.collectAll();
    const [c2] = await library.createImportCandidates(v2.items, "importeur");
    await library.reviewImportCandidate(c2!.id, "accept", "reviewerin");
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("intern");
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

  // Nacharbeit 8 (Ben, Befund F1): zwei ÜBERLAPPENDE Abgleiche derselben Seitenversion. Bei t1 ist
  // die Seite auf Lea beschränkt (gespeichert), ein Lauf beobachtet bei t2 „offen" und hängt, ein
  // späterer Lauf bestätigt bei t3 wieder Lea — gleiche Lage. Danach setzt der t2-Lauf fort.
  it("B3 · verzögerter älterer Abgleich (t2 offen) nach bestätigtem t3 (Lea): die Beschränkung bleibt", async () => {
    const k = await appMitKonten();
    const nurLea = { user: [{ accountId: "acc-lea", email: "lea@example.com" }] };
    // t1 — übernommen, auf Lea beschränkt.
    await bereichsabgleich(k, [seite("982", [], nurLea, 3)]);
    const r = await k.services.library.reviewImportCandidate(
      (await kandidatFuer(k, "982")).id,
      "accept",
      k.adminId,
    );
    const koId = r.koId!;
    // t2 — ein Lauf beobachtet die Seite OFFEN, wendet aber noch nichts an (er hängt).
    await new Promise((fertig) => setTimeout(fertig, 15));
    const t2 = (await fixture([seite("982", [], undefined, 3)]).adapter.collectAll()).items[0];
    // t3 — ein späterer Lauf bestätigt wieder Lea: gleiche Lage, nur der Zeitpunkt ist neu.
    await new Promise((fertig) => setTimeout(fertig, 15));
    await bereichsabgleich(k, [seite("982", [], nurLea, 3)]);
    // Der bestätigte Zeitpunkt steht am Objekt — auch ohne Änderung der Lage.
    const nachT3 = (await k.services.ko.get(koId))?.quellrechte;
    const t2Rechte = (t2 as { quellrechte?: { beobachtetAm?: string } }).quellrechte;
    expect(Date.parse(nachT3?.beobachtetAm ?? "")).toBeGreaterThan(
      Date.parse(t2Rechte?.beobachtetAm ?? ""),
    );
    // Jetzt setzt der hängende t2-Lauf fort.
    await k.services.library.gleicheQuellrechteFuerAnkerAb(t2!, k.adminId);

    const objekt = await k.services.ko.get(koId);
    expect(objekt?.quellrechte?.leser).toEqual([k.lea.id]);
    expect(objekt?.confidentiality).toBe("vertraulich");
    const otto = await liest(k.app, k.otto.headers, koId);
    expect(otto.einzeln.statusCode).toBe(404);
    expect(otto.inListe).toBe(false);
    expect((await liest(k.app, k.lea.headers, koId)).einzeln.statusCode).toBe(200);
  });

  it("B3-Gegenprobe · ohne bestätigenden t3-Lauf gibt dieselbe t2-Beobachtung die Seite frei", async () => {
    const k = await appMitKonten();
    const nurLea = { user: [{ accountId: "acc-lea", email: "lea@example.com" }] };
    await bereichsabgleich(k, [seite("983", [], nurLea, 3)]);
    const r = await k.services.library.reviewImportCandidate(
      (await kandidatFuer(k, "983")).id,
      "accept",
      k.adminId,
    );
    await new Promise((fertig) => setTimeout(fertig, 15));
    const t2 = (await fixture([seite("983", [], undefined, 3)]).adapter.collectAll()).items[0];
    await k.services.library.gleicheQuellrechteFuerAnkerAb(t2!, k.adminId);
    // Die Messung in B3 ist damit nicht vakuös: t2 allein HÄTTE freigegeben.
    expect((await liest(k.app, k.otto.headers, r.koId!)).einzeln.statusCode).toBe(200);
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

// ==================================================================================================
// Nacharbeit 16 (Ben, K1) — SPACE-LESERECHT ÜBER ZUGANGSKLASSEN (ALL_LICENSED_USERS).
// ==================================================================================================
//
// Die tatsächliche Quelle gibt das Space-Leserecht über Zugangsklassen; V1 liefert diese Einträge
// ohne Subjekt. Bis hierher fiel der Eintrag weg, und eine auf Lea und Otto beschränkte Seite
// bekam KEINEN Leser (Schnittmenge mit einem leeren Space). Jetzt: Lea ist nur über die
// Zugangsklasse berechtigt, die Quelle bestätigt es bei der Leseprüfung je Konto; Otto ist an der
// Seite genannt, die Quelle verneint sein Leserecht. Zugangsklassen werden nicht pauschal auf alle
// Klara-Nutzer abgebildet, und der Leserkreis steht als unvollständig bis zum Laufergebnis.
describe("R-0549 · Space-Leserecht über eine Zugangsklasse", () => {
  const ZUGANG: FixtureRechte = {
    space: { users: [], groups: [] },
    zugangsklasse: { klasse: "ALL_LICENSED_USERS", berechtigt: ["acc-lea"] },
  };
  const zuLeaUndOtto = () =>
    seite("995", [], {
      user: [
        { accountId: "acc-lea", email: "lea@example.com" },
        { accountId: "acc-otto", email: "otto@example.com" },
      ],
    });

  it("Z1 · nur über die Zugangsklasse berechtigte Lea liest, der ausgeschlossene Otto nicht — unvollständig bis zum Lauf", async () => {
    const k = await appMitKonten();
    const lauf = await bereichsabgleich(k, [zuLeaUndOtto()], ZUGANG);
    expect(lauf.leserUnvollstaendig).toBe(1);
    const kandidat = await kandidatFuer(k, "995");
    const amItem = (kandidat.item as MitQuellrechten).quellrechte;
    expect(amItem?.emails).toEqual(["lea@example.com"]);
    expect(amItem?.leserUnvollstaendig).toBe(true);

    const r = await k.services.library.reviewImportCandidate(kandidat.id, "accept", k.adminId);
    const objekt = await k.services.ko.get(r.koId!);
    expect(objekt?.confidentiality).toBe("vertraulich");
    expect(objekt?.quellrechte).toMatchObject({ leser: [k.lea.id], leserUnvollstaendig: true });
    const lea = await liest(k.app, k.lea.headers, r.koId!);
    expect(lea.einzeln.statusCode).toBe(200);
    expect(lea.inListe).toBe(true);
    // Ausgeschlossen: Otto (Quelle verneint), und niemand sonst wird über die Klasse Leser.
    for (const wer of [k.otto, k.carl, k.eva, k.admin]) {
      const ergebnis = await liest(k.app, wer.headers, r.koId!);
      expect(ergebnis.einzeln.statusCode).toBe(404);
      expect(ergebnis.inListe).toBe(false);
    }
  });

  it("Z2 · Gegenprobe: ohne Zugangsklasse liefert derselbe Space keinen Leser (die Messung ist nicht leer)", async () => {
    const { items } = await fixture([zuLeaUndOtto()], undefined, {
      space: { users: [], groups: [] },
    }).adapter.collectAll();
    const rechte = (items[0] as MitQuellrechten).quellrechte;
    expect(rechte?.emails).toEqual([]);
    expect(rechte?.leserUnvollstaendig).toBeUndefined();
  });

  // Nacharbeit 18 (Ben, K1): Lea und Otto sind weder Autoren noch Restriktionssubjekte — die
  // Seite trägt explizit leere Restriktionen, ihr Autor ist ein drittes Konto. Der reguläre
  // Quellkontenweg (Gruppenverzeichnis, Mitglieder über die ID) liefert beide; ihre Mailadressen
  // kommen über die Kontoabfrage. Die Quelle bestätigt Lea und verneint Otto.
  const NICHTAUTOREN: FixtureRechte = {
    space: { users: [], groups: [] },
    gruppen: { lizenziert: [{ accountId: "acc-lea" }, { accountId: "acc-otto" }] },
    kontoEmails: { "acc-lea": "lea@example.com", "acc-otto": "otto@example.com" },
    zugangsklasse: { klasse: "ALL_LICENSED_USERS", berechtigt: ["acc-lea"] },
  };
  const offenMitFremdemAutor = (): ConfluencePage => ({
    ...seite("996", [], { user: [], group: [] }),
    version: { number: 1, by: { accountId: "acc-autor", displayName: "Autor" } },
  });
  const kontoNachweise = (aufrufe: { pfad: string; konto?: string }[]) => {
    for (const konto of ["acc-lea", "acc-otto"]) {
      expect(
        aufrufe.some((a) => a.pfad.endsWith("/rest/api/user/email") && a.konto === konto),
        `Kontoabfrage ${konto}`,
      ).toBe(true);
      expect(
        aufrufe.some((a) => a.pfad.endsWith("/996/permission/check") && a.konto === konto),
        `Leseprüfung ${konto}`,
      ).toBe(true);
    }
    expect(aufrufe.some((a) => a.pfad.endsWith("/rest/api/group"))).toBe(true);
  };

  it("Z4 · collectAll: der reguläre Kontoweg liefert Lea und Otto — Lea wird Leserin, Otto bleibt ausgeschlossen", async () => {
    const { adapter, aufrufe } = fixture([offenMitFremdemAutor()], undefined, NICHTAUTOREN);
    const { items } = await adapter.collectAll();
    const rechte = (items[0] as MitQuellrechten).quellrechte;
    expect(rechte?.emails).toEqual(["lea@example.com"]);
    expect(rechte?.leserUnvollstaendig).toBe(true);
    expect(items[0]?.confidentiality).toBe("intern");
    kontoNachweise(aufrufe);
  });

  it("Z5 · fetchItem: derselbe Nachweis beim Nachladen je ID", async () => {
    const { adapter, aufrufe } = fixture([], [offenMitFremdemAutor()], NICHTAUTOREN);
    const item = await adapter.fetchItem("996");
    const rechte = (item as MitQuellrechten | undefined)?.quellrechte;
    expect(rechte?.emails).toEqual(["lea@example.com"]);
    expect(rechte?.leserUnvollstaendig).toBe(true);
    kontoNachweise(aufrufe);
  });

  // Nacharbeit 19 (Ben, K1; Beleg QUELLEN-HILFE-20261007-0923fd30.json): die Prüfgrenze galt für
  // den ganzen Lauf — bei 251 Seiten und zwei Verzeichniskonten kam Seite 251 ungeprüft und ohne
  // Lea an, und der reguläre Wiederabgleich entfernte Lea am gespeicherten Objekt.
  const bereich251 = (): ConfluencePage[] =>
    Array.from({ length: 251 }, (_, i) => ({
      ...seite(`b${i + 1}`, [], { user: [], group: [] }),
      version: { number: 1, by: { accountId: "acc-autor", displayName: "Autor" } },
    }));

  it("Z6 · 251 Seiten: auch die letzte Seite ist geprüft — Bereich und Einzelabruf gleich, der Wiederabgleich behält Lea", async () => {
    const seiten = bereich251();
    const { adapter, aufrufe } = fixture(seiten, undefined, NICHTAUTOREN);
    const { items } = await adapter.collectAll();
    expect(items).toHaveLength(251);
    for (const item of items) {
      const rechte = (item as MitQuellrechten).quellrechte;
      expect(rechte?.emails, `Leser von ${item.externalId}`).toEqual(["lea@example.com"]);
      expect(Object.hasOwn(rechte ?? {}, "leserNichtErmittelt")).toBe(false);
    }
    for (const konto of ["acc-lea", "acc-otto"]) {
      expect(
        aufrufe.some((a) => a.pfad.endsWith("/b251/permission/check") && a.konto === konto),
        `Leseprüfung ${konto} an Seite 251`,
      ).toBe(true);
    }
    const einzeln = await fixture([], seiten, NICHTAUTOREN).adapter.fetchItem("b251");
    expect((einzeln as MitQuellrechten | undefined)?.quellrechte?.emails).toEqual([
      "lea@example.com",
    ]);

    // Der reguläre Bereichsabgleich: übernommen, dann bei unveränderter Fassung erneut abgeglichen.
    const k = await appMitKonten();
    await bereichsabgleich(k, seiten, NICHTAUTOREN);
    const r = await k.services.library.reviewImportCandidate(
      (await kandidatFuer(k, "b251")).id,
      "accept",
      k.adminId,
    );
    const wieder = await bereichsabgleich(k, seiten, NICHTAUTOREN);
    expect(wieder.failed).toBe(0);
    const objekt = await k.services.ko.get(r.koId!);
    expect(objekt?.quellrechte?.leser).toEqual([k.lea.id]);
    expect((await liest(k.app, k.lea.headers, r.koId!)).einzeln.statusCode).toBe(200);
    expect((await liest(k.app, k.otto.headers, r.koId!)).einzeln.statusCode).toBe(404);
  });

  // Nacharbeit 20 (Ben, K1; Beleg QUELLEN-HILFE-20261007-1d62cf71.json): Lea steht HINTER der
  // früheren Grenze von 500 Prüfungen — davor der bisherige Leser Carl und 500 weitere zuordenbare
  // Konten. Jedes Konto wird geprüft; ein Rechtewechsel bei unveränderter Seitenversion kommt an.
  const grosseGruppe = (): unknown[] => [
    { accountId: "acc-carl", email: "carl@example.com" },
    ...Array.from({ length: 500 }, (_, i) => ({
      accountId: `acc-m${i}`,
      email: `m${i}@example.com`,
    })),
    { accountId: "acc-lea" },
    { accountId: "acc-otto" },
  ];
  const mitGrosserGruppe = (berechtigt: string[]): FixtureRechte => ({
    ...NICHTAUTOREN,
    gruppen: { lizenziert: grosseGruppe() },
    zugangsklasse: { klasse: "ALL_LICENSED_USERS", berechtigt },
  });

  it("Z7 · jenseits der früheren Grenze: alle Konten geprüft, Bereich und Einzelabruf gleich, der Rechtewechsel kommt am selben Objekt an", async () => {
    const seite996 = offenMitFremdemAutor();
    // Zuerst darf nur Carl lesen (erster Eintrag), danach nur Lea (Position 502).
    const vorher = mitGrosserGruppe(["acc-carl"]);
    const nachher = mitGrosserGruppe(["acc-lea"]);

    const { adapter, aufrufe } = fixture([seite996], undefined, nachher);
    const { items } = await adapter.collectAll();
    const rechte = (items[0] as MitQuellrechten).quellrechte as
      | { emails?: string[]; leserNichtErmittelt?: true }
      | undefined;
    expect(rechte?.emails).toEqual(["lea@example.com"]);
    expect(rechte?.leserNichtErmittelt).toBeUndefined();
    for (const konto of ["acc-lea", "acc-otto", "acc-carl"]) {
      expect(
        aufrufe.some((a) => a.pfad.endsWith("/996/permission/check") && a.konto === konto),
        `Leseprüfung ${konto}`,
      ).toBe(true);
    }
    expect(aufrufe.filter((a) => a.pfad.endsWith("/996/permission/check")).length).toBe(503);
    const einzeln = await fixture([], [seite996], nachher).adapter.fetchItem("996");
    expect((einzeln as MitQuellrechten | undefined)?.quellrechte?.emails).toEqual([
      "lea@example.com",
    ]);

    // Der reguläre Weg: übernommen mit Carl, dann bei UNVERÄNDERTER Fassung Carl entzogen, Lea
    // (hinter der früheren Grenze) berechtigt — nach dem Wiederabgleich liest dasselbe Objekt nur Lea.
    const k = await appMitKonten();
    await bereichsabgleich(k, [seite996], vorher);
    const r = await k.services.library.reviewImportCandidate(
      (await kandidatFuer(k, "996")).id,
      "accept",
      k.adminId,
    );
    expect((await k.services.ko.get(r.koId!))?.quellrechte?.leser).toEqual([k.carl.id]);
    const wieder = await bereichsabgleich(k, [seite996], nachher);
    expect(wieder.failed).toBe(0);
    const objekt = await k.services.ko.get(r.koId!);
    expect(objekt?.id).toBe(r.koId);
    expect(objekt?.quellrechte?.leser).toEqual([k.lea.id]);
    expect((await liest(k.app, k.lea.headers, r.koId!)).einzeln.statusCode).toBe(200);
    expect((await liest(k.app, k.carl.headers, r.koId!)).einzeln.statusCode).toBe(404);
    expect((await liest(k.app, k.otto.headers, r.koId!)).einzeln.statusCode).toBe(404);
  });

  it("Z8 · Abbruchschutz bleibt: ein nicht ermittelter Eintrag setzt keine Rechte, der gespeicherte Leser bleibt", async () => {
    const k = await appMitKonten();
    const seite996 = offenMitFremdemAutor();
    await bereichsabgleich(k, [seite996], NICHTAUTOREN);
    const r = await k.services.library.reviewImportCandidate(
      (await kandidatFuer(k, "996")).id,
      "accept",
      k.adminId,
    );
    expect((await k.services.ko.get(r.koId!))?.quellrechte?.leser).toEqual([k.lea.id]);

    // Derselbe Eintrag, als „Leser nicht ermittelt" gekennzeichnet und mit leerer Leserliste.
    const echt = await fixture([seite996], undefined, NICHTAUTOREN).adapter.collectAll();
    const roh = echt.items[0] as unknown as MitQuellrechten & Record<string, unknown>;
    const markiert = {
      ...roh,
      quellrechte: { ...roh.quellrechte, emails: [], leserNichtErmittelt: true as const },
    };
    const adapter = {
      source: "Confluence",
      sourceScope: "K",
      collectAll: async () => ({ items: [markiert], failed: [], truncated: false }),
    } as unknown as Parameters<typeof runConfluenceImport>[0]["adapter"];
    const lauf = await runConfluenceImport({
      adapter,
      library: k.services.library,
      koService: k.services.ko,
      dryRun: false,
      actor: k.adminId,
    });
    expect(lauf.failed).toBe(1);
    expect(lauf.perPage.find((p) => p.ref === "996")).toMatchObject({ status: "failed" });
    expect((await k.services.ko.get(r.koId!))?.quellrechte?.leser).toEqual([k.lea.id]);
    expect((await liest(k.app, k.lea.headers, r.koId!)).einzeln.statusCode).toBe(200);
  });

  it("Z3 · derselbe Schutz beim Nachladen je ID (fetchItem)", async () => {
    const seite995 = zuLeaUndOtto();
    const item = await fixture([], [seite995], ZUGANG).adapter.fetchItem("995");
    const rechte = (item as MitQuellrechten | undefined)?.quellrechte;
    expect(rechte?.emails).toEqual(["lea@example.com"]);
    expect(rechte?.leserUnvollstaendig).toBe(true);
  });
});

// ==================================================================================================
// Nacharbeit 23 — ZUSAMMENFÜHRUNG MIT MAIN (Spaces, „öffentlich").
// ==================================================================================================
describe("R-0549 · Zusammenführung mit main: Spaces und die Marke „öffentlich“", () => {
  it("S1 · der führende Space ist eine UND-Bedingung auch für Quellleser", () => {
    const objekt = {
      confidentiality: "vertraulich" as const,
      author: "admin",
      quellrechte: { leser: ["lea"] },
      spaceId: "space-hr",
    };
    const leaImSpace = { id: "lea", role: "viewer" as const, spaceLesbar: new Set(["space-hr"]) };
    const leaOhneSpace = { id: "lea", role: "viewer" as const, spaceLesbar: new Set<string>() };
    const ottoImSpace = { id: "otto", role: "viewer" as const, spaceLesbar: new Set(["space-hr"]) };
    expect(darfSehen(leaImSpace, objekt)).toBe(true);
    // Quellleser, aber ohne Space-Leserecht: die Quellleser öffnen keinen fremden Space.
    expect(darfSehen(leaOhneSpace, objekt)).toBe(false);
    // Im Space, aber nicht Quellleser: der Space öffnet keine Quellbeschränkung.
    expect(darfSehen(ottoImSpace, objekt)).toBe(false);
    // Ohne führenden Space gilt allein die Quellleserliste (Bestand vor main).
    const ohneSpace = { ...objekt, spaceId: undefined };
    expect(darfSehen({ id: "lea", role: "viewer" }, ohneSpace)).toBe(true);
    expect(darfSehen({ id: "otto", role: "viewer" }, ohneSpace)).toBe(false);
  });

  it("S2 · hebt die Quelle ein als öffentlich markiertes Objekt an, verschwindet die Marke (R-0652)", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const library = new LibraryService({ koService, externalUpsert: true });
    const v1 = await fixture([seite("31", [], undefined, 1)]).adapter.collectAll();
    const [c1] = await library.createImportCandidates(v1.items, "importeur");
    const r1 = await library.reviewImportCandidate(c1!.id, "accept", "reviewerin");
    expect((await koService.get(r1.koId!))?.confidentiality).toBe("intern");
    await koService.setOeffentlich(r1.koId!, true, "anna");
    expect((await koService.get(r1.koId!))?.oeffentlich).toBe(true);

    // Fassung 2 ist an der Quelle beschränkt — die Quelle hebt auf vertraulich an.
    const zu: ConfluencePage = {
      ...seite("31", [], { group: [{ name: "qs" }] }, 2),
      body: { storage: { value: "<p>Inhalt 31, Stand 2.</p>" } },
    };
    const v2 = await fixture([zu]).adapter.collectAll();
    const [c2] = await library.createImportCandidates(v2.items, "importeur");
    await library.reviewImportCandidate(c2!.id, "accept", "reviewerin");
    const objekt = await koService.get(r1.koId!);
    expect(objekt?.confidentiality).toBe("vertraulich");
    expect(objekt?.oeffentlich).toBeUndefined();
  });
});
