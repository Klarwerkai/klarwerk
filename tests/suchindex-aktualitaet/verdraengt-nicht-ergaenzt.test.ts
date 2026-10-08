// ================================================================================================
// AUFNAHME 20260922 · GESAMT-SUCHINDEX-AKTUALITAET — VERDRÄNGT, NICHT ERGÄNZT.
// ================================================================================================
//
// R-0195 / R-0470: nach einer Überarbeitung findet die Suche SOFORT den neuen Stand, der alte ist
// weder Bibliothekstreffer noch Klara-Kandidat — und beide Flächen sehen dasselbe, weil beide durch
// `KoService.findSearchHits` laufen (Bibliothek direkt, Klara über `findCandidates`).
// R-0483: was archiviert (Papierkorb) oder durch eine neue Fassung ersetzt wurde, taucht nicht mehr
// auf. Neu gemessen ist der Ersatz durch ZUSAMMENFÜHREN (`markMergedInto`): bis zu diesem Auftrag
// blieb der aufgegangene Artikel Treffer und Kandidat (docs/entscheidungen/dublettenvergleich.md,
// Quellenwiderspruch 4, „offen").
//
// ANTI-VAKUUM: jeder Ausschluss hat seine Kalibrierung davor — derselbe Begriff trifft, solange
// das Objekt gilt.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";

const EINGABE = {
  title: "Kühlkreislauf KK3",
  statement: "Kurzfassung ohne die Prüfwörter.",
  type: "best_practice" as const,
  category: "Wartung",
  author: "anna",
};

async function stapel() {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  return { ko };
}

/** Was Bibliothek (Trefferweg) und Klara (Kandidatenweg) zu einem Begriff sehen. */
async function beideFlaechen(ko: KoService, begriff: string) {
  return {
    bibliothek: (await ko.findSearchHits({ terms: [begriff] })).map((h) => h.koId),
    klara: (await ko.findCandidates({ terms: [begriff], limit: 50 })).map((k) => k.id),
  };
}

describe("Suchindex-Aktualität · Überarbeitung (R-0195, R-0470)", () => {
  it("Ü1 · der neue Stand ist sofort auffindbar, der alte auf BEIDEN Flächen verschwunden", async () => {
    const { ko } = await stapel();
    const a = await ko.create({ ...EINGABE, bodyHtml: "<p>Altwortkk</p>" });
    expect(await beideFlaechen(ko, "altwortkk")).toEqual({ bibliothek: [a.id], klara: [a.id] });

    await ko.revise(a.id, { bodyHtml: "<p>Neuwortkk</p>" }, "anna");

    // Ohne Warten, ohne Nachzug: die Projektion entsteht im Schreibvorgang der neuen Fassung.
    expect(await beideFlaechen(ko, "neuwortkk")).toEqual({ bibliothek: [a.id], klara: [a.id] });
    expect(await beideFlaechen(ko, "altwortkk")).toEqual({ bibliothek: [], klara: [] });
  });

  it("Ü2 · auch eine geänderte Kategorie verdrängt den alten Wert, statt ihn zu ergänzen", async () => {
    const { ko } = await stapel();
    const a = await ko.create({ ...EINGABE, category: "Altkategoriekk" });
    expect((await beideFlaechen(ko, "altkategoriekk")).bibliothek).toEqual([a.id]);

    // Die Kategorie ist Metadatum ohne neue Fassung (G27 S2) — ihr Schreibweg ist `updateCategory`,
    // nicht `revise`; er führt die versionslose Metadatenprojektion im selben Vorgang nach.
    await ko.updateCategory(a.id, "Neukategoriekk", "anna");

    expect(await beideFlaechen(ko, "neukategoriekk")).toEqual({
      bibliothek: [a.id],
      klara: [a.id],
    });
    expect(await beideFlaechen(ko, "altkategoriekk")).toEqual({ bibliothek: [], klara: [] });
  });
});

describe("Suchindex-Aktualität · ersetzt oder archiviert (R-0483)", () => {
  it("E1 · ein in einem Führungsartikel aufgegangener Artikel ist weder Treffer noch Klara-Kandidat", async () => {
    const { ko } = await stapel();
    const fuehrend = await ko.create({
      ...EINGABE,
      title: "Führend",
      bodyHtml: "<p>Fuehrwort</p>",
    });
    const aufgehend = await ko.create({
      ...EINGABE,
      title: "Aufgehend",
      bodyHtml: "<p>Totwortkk</p>",
    });
    // Kalibrierung: vor dem Zusammenführen trifft der Begriff genau den aufgehenden Artikel.
    expect(await beideFlaechen(ko, "totwortkk")).toEqual({
      bibliothek: [aufgehend.id],
      klara: [aufgehend.id],
    });

    // Der Ablauf des Assistenten: der Führungsartikel nimmt den Inhalt in einer neuen Fassung auf,
    // der aufgehende bekommt den Verweis.
    const neu = await ko.revise(
      fuehrend.id,
      { bodyHtml: "<p>Fuehrwort</p><p>Totwortkk</p>" },
      "kurator",
    );
    await ko.markMergedInto(
      aufgehend.id,
      { koId: fuehrend.id, version: neu.version, overlapId: "ov-1" },
      "kurator",
      aufgehend.version,
    );

    // Der Inhalt ist jetzt NUR noch über den Führungsartikel zu finden — verdrängt, nicht ergänzt.
    expect(await beideFlaechen(ko, "totwortkk")).toEqual({
      bibliothek: [fuehrend.id],
      klara: [fuehrend.id],
    });
    // Und der aufgegangene Artikel bleibt lesbar (R-1107): ausgeblendet ist nur die Suche.
    expect((await ko.get(aufgehend.id))?.mergedInto?.koId).toBe(fuehrend.id);
  });

  it("E2 · ein Beitrag im Papierkorb ist weder Treffer noch Kandidat — und kommt beim Wiederherstellen zurück", async () => {
    const { ko } = await stapel();
    const a = await ko.create({ ...EINGABE, bodyHtml: "<p>Korbwortkk</p>" });
    expect((await beideFlaechen(ko, "korbwortkk")).klara).toEqual([a.id]);

    await ko.delete(a.id, "anna");
    expect(await beideFlaechen(ko, "korbwortkk")).toEqual({ bibliothek: [], klara: [] });

    await ko.restore(a.id, "anna");
    expect(await beideFlaechen(ko, "korbwortkk")).toEqual({ bibliothek: [a.id], klara: [a.id] });
  });
});

// ------------------------------------------------------------------------------------------------
// DER HTTP-WEG DER BIBLIOTHEK — Einreichen, Suchen, Überarbeiten, Suchen (R-0470 „jede Fläche").
// ------------------------------------------------------------------------------------------------
type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function anmelden(app: App, email: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function suchen(app: App, headers: Auth, q: string): Promise<string[]> {
  const res = await app.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(q)}`,
    headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { id: string }[]).map((t) => t.id);
}

describe("Suchindex-Aktualität · am echten Bibliotheksweg", () => {
  it("H1 · nach PUT revise liefert GET /api/library/search den neuen Begriff und den alten nicht mehr", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@aktualitaet.test", password: "geheim12345" },
    });
    const admin = await anmelden(app, "admin@aktualitaet.test");

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        title: "Druckspeicher DS2",
        statement: "Altwortroute im Kerntext.",
        type: "best_practice",
        category: "Wartung",
        confidentiality: "intern",
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const id = angelegt.json().id as string;
    expect(await suchen(app, admin, "Altwortroute")).toEqual([id]);

    const revidiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: { action: "revise", changes: { statement: "Neuwortroute im Kerntext." } },
    });
    expect(revidiert.statusCode, revidiert.body).toBe(200);

    expect(await suchen(app, admin, "Neuwortroute")).toEqual([id]);
    expect(await suchen(app, admin, "Altwortroute")).toEqual([]);
  });
});
