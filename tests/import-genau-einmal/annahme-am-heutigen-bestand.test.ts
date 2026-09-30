// ================================================================================================
// LAUF gesamt-import-adoption, RUNDE 2 — BENS VIER GEGENPROBEN, AM DRAHT.
// ================================================================================================
//
// B1  A und identisches B eingereiht, A abgelehnt, B angenommen: „angenommen" ohne Objekt.
// B2  Kandidat eingereiht, derselbe Inhalt kam inzwischen anders in den Bestand, Annahme: zwei
//     Objekte.
// B3  `POST /api/library/import` legte Wissensobjekte unmittelbar an — an der Warteschlange vorbei.
// B4  Mitgelieferte Herkunft (provider/externalId/sourceVersion/url) ging bei der Annahme verloren,
//     solange der externe Upsert-Strang aus war (`sources: []`).
//
// Alle Fälle laufen über `buildApp(buildServices())` und die echten Routen, denn die Dublettenregel
// reist als Port aus der Kompositionswurzel in den Dienst — nur die Route misst diese Naht.
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KandidatDublettenbefund } from "../../services/library-analytics";

interface KandidatDto {
  id: string;
  duplicate: boolean;
  koId: string | null;
  status: string;
  dublettenbefund?: KandidatDublettenbefund;
}

interface KoDto {
  id: string;
  title: string;
  author: string;
  originalAuthor: string;
  status: string;
  importCandidateId?: string;
  sources?: {
    provider?: string | null;
    externalId?: string;
    sourceVersion?: number;
    url?: string | null;
    kind?: string;
  }[];
}

const EINTRAG = {
  title: "Lager nachschmieren",
  statement: "Das Loslager alle 200 Betriebsstunden nachschmieren",
  type: "best_practice",
  category: "Wartung",
  confidentiality: "intern",
};

const vorherSchalter = process.env.KLARWERK_CONFLUENCE_IMPORT;
afterEach(() => {
  if (vorherSchalter === undefined) {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  } else {
    process.env.KLARWERK_CONFLUENCE_IMPORT = vorherSchalter;
  }
});

async function angemeldeteApp(marke: string) {
  const app = buildApp(buildServices());
  const zugang = { name: "Admin", email: `${marke}@genau-einmal.test`, password: "secret123" };
  await app.inject({ method: "POST", url: "/api/auth/register", payload: zugang });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: zugang.email, password: zugang.password },
  });
  const body = login.json();
  return {
    app,
    headers: { authorization: `Bearer ${body.token}` },
    userId: body.user.id as string,
  };
}

type App = Awaited<ReturnType<typeof angemeldeteApp>>["app"];
type Headers = Record<string, string>;

async function reiheEin(
  app: App,
  headers: Headers,
  items: unknown[],
  url = "/api/library/import/candidates",
): Promise<KandidatDto[]> {
  const res = await app.inject({ method: "POST", url, headers, payload: { items } });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as KandidatDto[];
}

async function entscheide(
  app: App,
  headers: Headers,
  id: string,
  action: "accept" | "reject",
): Promise<KandidatDto> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/library/import/candidates/${id}`,
    headers,
    payload: { action },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as KandidatDto;
}

async function kos(app: App, headers: Headers): Promise<KoDto[]> {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as KoDto[];
}

async function warteschlange(app: App, headers: Headers): Promise<KandidatDto[]> {
  const res = await app.inject({ method: "GET", url: "/api/library/import/candidates", headers });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as KandidatDto[];
}

describe("B1 · die Annahme entscheidet am heutigen Bestand, nicht am Befund vom Einreihen", () => {
  it("B1 · A abgelehnt, identisches B angenommen: B legt genau ein Wissensobjekt an", async () => {
    const { app, headers } = await angemeldeteApp("b1");
    const [a] = await reiheEin(app, headers, [EINTRAG]);
    const [b] = await reiheEin(app, headers, [EINTRAG]);
    expect(b?.dublettenbefund, "Vorbedingung: B trifft beim Einreihen den offenen A.").toEqual({
      ergebnis: "identisch",
      treffer: { art: "kandidat", kandidatId: a?.id },
    });

    await entscheide(app, headers, a?.id ?? "", "reject");
    const angenommen = await entscheide(app, headers, b?.id ?? "", "accept");

    expect(angenommen.status).toBe("angenommen");
    expect(angenommen.koId, "Eine wirksame Annahme führt in den Wissensobjektfluss.").toBeTruthy();
    expect(angenommen.duplicate, "Der Kandidat sagt, was bei der Entscheidung galt.").toBe(false);
    expect(angenommen.dublettenbefund).toEqual({ ergebnis: "keine" });
    const bestand = await kos(app, headers);
    expect(bestand.map((ko) => ko.id)).toEqual([angenommen.koId]);
  });

  it("B1b · wird B zuerst angenommen, legt B an — und die spätere Annahme von A nennt Bs Objekt", async () => {
    const { app, headers } = await angemeldeteApp("b1b");
    const [a] = await reiheEin(app, headers, [EINTRAG]);
    const [b] = await reiheEin(app, headers, [EINTRAG]);

    const bAngenommen = await entscheide(app, headers, b?.id ?? "", "accept");
    expect(bAngenommen.koId).toBeTruthy();
    const aAngenommen = await entscheide(app, headers, a?.id ?? "", "accept");

    expect(aAngenommen.koId, "Derselbe Inhalt wird genau einmal übernommen.").toBeNull();
    expect(aAngenommen.duplicate).toBe(true);
    expect(aAngenommen.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "wissensobjekt", koId: bAngenommen.koId },
    });
    expect(await kos(app, headers)).toHaveLength(1);
  });
});

describe("B2 · ein zwischen Einreihen und Annahme entstandenes Objekt verhindert die zweite Anlage", () => {
  it("B2 · derselbe Inhalt kommt über einen anderen Weg in den Bestand: die Annahme legt nichts an", async () => {
    const { app, headers } = await angemeldeteApp("b2");
    const [kandidat] = await reiheEin(app, headers, [EINTRAG]);
    expect(kandidat?.dublettenbefund).toEqual({ ergebnis: "keine" });

    // Derselbe Inhalt, unabhängig von der Warteschlange angelegt.
    const direkt = await app.inject({ method: "POST", url: "/api/kos", headers, payload: EINTRAG });
    expect(direkt.statusCode, direkt.body).toBe(201);
    const koId = direkt.json().id as string;

    const angenommen = await entscheide(app, headers, kandidat?.id ?? "", "accept");
    expect(angenommen.koId).toBeNull();
    expect(angenommen.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "wissensobjekt", koId },
    });
    expect((await kos(app, headers)).map((ko) => ko.id)).toEqual([koId]);
  });

  it("B2b · leicht verändert (Satzpunkt, Schreibweise): `aehnlich` auf das inzwischen vorhandene Objekt", async () => {
    const { app, headers } = await angemeldeteApp("b2b");
    const [kandidat] = await reiheEin(app, headers, [
      { ...EINTRAG, title: EINTRAG.title.toUpperCase(), statement: `${EINTRAG.statement}.` },
    ]);
    const direkt = await app.inject({ method: "POST", url: "/api/kos", headers, payload: EINTRAG });
    expect(direkt.statusCode, direkt.body).toBe(201);

    const angenommen = await entscheide(app, headers, kandidat?.id ?? "", "accept");
    expect(angenommen.koId).toBeNull();
    expect(angenommen.dublettenbefund?.ergebnis).toBe("aehnlich");
    expect(await kos(app, headers)).toHaveLength(1);
  });

  it("B2c · Bens Ablauf wörtlich: Kandidat, derselbe Inhalt über POST /api/library/import, Annahme", async () => {
    const { app, headers } = await angemeldeteApp("b2c");
    const [erster] = await reiheEin(app, headers, [EINTRAG]);
    const [zweiter] = await reiheEin(app, headers, [EINTRAG], "/api/library/import");

    await entscheide(app, headers, erster?.id ?? "", "accept");
    const zweiteAnnahme = await entscheide(app, headers, zweiter?.id ?? "", "accept");

    expect(zweiteAnnahme.koId).toBeNull();
    expect(await kos(app, headers), "Genau ein Wissensobjekt, nicht zwei.").toHaveLength(1);
  });
});

describe("B3 · POST /api/library/import reiht ein, statt anzulegen", () => {
  it("B3 · der Direktweg erzeugt kein Wissensobjekt, sondern einen Kandidaten; erst die Annahme legt an", async () => {
    const { app, headers, userId } = await angemeldeteApp("b3");
    const kandidaten = await reiheEin(
      app,
      headers,
      [{ ...EINTRAG, author: "Fremder Name" }],
      "/api/library/import",
    );

    expect(kandidaten).toHaveLength(1);
    expect(kandidaten[0]?.status).toBe("neu");
    expect(await kos(app, headers), "Ohne Entscheidung entsteht kein Wissensobjekt.").toEqual([]);
    expect((await warteschlange(app, headers)).map((k) => k.id)).toEqual([kandidaten[0]?.id]);

    const angenommen = await entscheide(app, headers, kandidaten[0]?.id ?? "", "accept");
    const [ko] = await kos(app, headers);
    expect(ko?.id).toBe(angenommen.koId);
    // R-0505 bleibt: der Handelnde ist der Annehmende, der gelieferte Name nur Metadatum.
    expect(ko?.author).toBe(userId);
    expect(ko?.originalAuthor).toBe("Fremder Name");
    // FR-EXT-02: das Objekt ist ungeprüft und als importiert erkennbar (Kandidaten-Stempel).
    expect(ko?.status).toBe("offen");
    expect(ko?.importCandidateId).toBe(kandidaten[0]?.id);
  });
});

describe("B4 · die mitgelieferte Herkunft bleibt am übernommenen Wissen", () => {
  const MIT_HERKUNFT = {
    ...EINTRAG,
    provider: "customer-wiki",
    externalId: "source-42",
    sourceVersion: 7,
    url: "https://wiki.example.test/seiten/source-42",
  };

  for (const [fall, schalter] of [
    ["Schalter aus", undefined],
    ["Schalter an", "1"],
  ] as const) {
    it(`B4 · ${fall}: provider, externalId, sourceVersion und URL stehen nach der Annahme am Objekt`, async () => {
      if (schalter === undefined) {
        delete process.env.KLARWERK_CONFLUENCE_IMPORT;
      } else {
        process.env.KLARWERK_CONFLUENCE_IMPORT = schalter;
      }
      const { app, headers } = await angemeldeteApp(`b4-${schalter ?? "aus"}`);
      const [kandidat] = await reiheEin(app, headers, [MIT_HERKUNFT], "/api/library/import");
      const angenommen = await entscheide(app, headers, kandidat?.id ?? "", "accept");

      const [ko] = await kos(app, headers);
      expect(ko?.id).toBe(angenommen.koId);
      expect(ko?.sources, "Die Originalquelle ist am Objekt verlinkt.").toEqual([
        expect.objectContaining({
          kind: "external",
          provider: "customer-wiki",
          externalId: "source-42",
          sourceVersion: 7,
          url: "https://wiki.example.test/seiten/source-42",
        }),
      ]);
    });
  }

  it("B4b · ohne jede Herkunftsangabe wird kein Anker erfunden", async () => {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const { app, headers } = await angemeldeteApp("b4b");
    const [kandidat] = await reiheEin(app, headers, [EINTRAG]);
    await entscheide(app, headers, kandidat?.id ?? "", "accept");
    const [ko] = await kos(app, headers);
    expect(ko?.sources ?? []).toEqual([]);
  });

  it("B4c · eine unsichere URL (javascript:) wird nicht zur Herkunft", async () => {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const { app, headers } = await angemeldeteApp("b4c");
    const [kandidat] = await reiheEin(app, headers, [{ ...EINTRAG, url: "javascript:alert(1)" }]);
    await entscheide(app, headers, kandidat?.id ?? "", "accept");
    const [ko] = await kos(app, headers);
    expect(ko?.sources ?? []).toEqual([]);
  });
});
