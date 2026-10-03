// ================================================================================================
// aufnahme:20260922:gesamt-import-adoption:herkunft-identitaet — R-0139 · R-0169 · R-0505 · FR-EXT-02
// ================================================================================================
//
// Was diese Datei SELBST misst, je Originalpunkt:
//
//   R-0139   Ein importiertes Objekt trägt dauerhaft, DASS und WIE es importiert wurde
//            (`importedVia`, beide Importwege), eine entfernte Quelle steht als Anker mit
//            provider/externalId/sourceVersion/url am Objekt und in der Belegkette. Die Herkunft
//            „Word" (`origin`) und „importiert" (`importedVia`) lassen sich über die öffentlichen
//            Schreibrouten NICHT behaupten — sonst wären sie nicht eindeutig.
//   R-0169   Dieselbe entfernte Seite (provider + externalId) bleibt EIN Wissensobjekt; jede
//            Quellfassung ist in einem unveränderlichen Versionsschnappschuss festgeschrieben, und
//            die Aussage einer Objektfassung lässt sich ihrer Quellfassung zuordnen.
//   R-0505   Der Importeur ist Autor, v1-Schnappschussautor, Akteur von `ko.created` und Ersteller
//            der Belegzeile; der genannte Name bleibt Metadatum. Am Draht: der Genannte sieht ein
//            vertrauliches Importobjekt nicht und darf es nicht löschen, der Importeur schon.
//   FR-EXT-02 Importiert startet ungeprüft (`offen`, trust 0, Version 1), als importiert
//            gekennzeichnet, in der Prüfmenge (`status: "offen"` — dieselbe Abfrage wie das
//            Prüfboard, services/validation/src/service.ts) und mit verlinkter Originalquelle.
//
// WAS SIE NICHT MISST: den Word-Entwurfsweg selbst (services/capture/src/origin-durchreiche.test.ts,
// JOB 679), die Urheberschaft im JSON-Rundlauf (urheberschaft-im-rundlauf.test.ts daneben) und den
// Re-Sync-Angriff über die Kandidatenroute (tests/security/mega82-importeur-handelt.test.ts).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import type { DublettenPruefung, ImportItem } from "../../services/library-analytics";

const OHNE_AEHNLICHKEIT: DublettenPruefung = () => ({ dublette: false });

const IMPORTEUR = "u-importeur";
const GENANNT = "Genannte Verfasserin";

async function instanz() {
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const koService = new KoService({
    repo: new InMemoryKoRepo(),
    versions: new InMemoryKoVersionRepo(),
    evidence: new InMemoryEvidenceRepo(),
    audit,
  });
  await koService.activateSearchProjectionV2();
  // `externalUpsert` = der Anker-/Re-Sync-Strang, wie ihn die Quellimporte verdrahten.
  const library = new LibraryService({ koService, externalUpsert: true });
  return { audit, koService, library };
}

function seite(fassung: number): ImportItem {
  return {
    title: `Wartungsplan Pumpe P2 (Fassung ${fassung})`,
    statement: `Aussage der Quellfassung ${fassung}.`,
    type: "best_practice",
    category: "Wartung",
    author: GENANNT,
    externalId: "SEITE-0169",
    provider: "Confluence",
    sourceScope: "WART",
    sourceVersion: fassung,
    url: "https://wiki.example.test/seite-0169",
    confidentiality: "intern",
  };
}

async function annehmen(
  ctx: Awaited<ReturnType<typeof instanz>>,
  item: ImportItem,
): Promise<string> {
  const [kandidat] = await ctx.library.createImportCandidates([item], IMPORTEUR, OHNE_AEHNLICHKEIT);
  if (!kandidat) {
    throw new Error("kein Kandidat eingereiht");
  }
  const entschieden = await ctx.library.reviewImportCandidate(kandidat.id, "accept", IMPORTEUR);
  if (!entschieden.koId) {
    throw new Error(`Annehmen legte kein Wissensobjekt an (Status ${entschieden.status})`);
  }
  return entschieden.koId;
}

describe("R-0139 · FR-EXT-02 — importiert, gekennzeichnet, ungeprüft, Quelle verlinkt", () => {
  it("direkter JSON-Import: als importiert gekennzeichnet, ungeprüft und in der Prüfmenge", async () => {
    const ctx = await instanz();
    const ergebnis = await ctx.library.importJson(
      [{ title: "Aus der Sicherung", statement: "Eingespielt.", type: "technik", category: "A" }],
      IMPORTEUR,
      OHNE_AEHNLICHKEIT,
    );
    expect(ergebnis.imported).toBe(1);
    const [ko] = await ctx.koService.list();
    expect(ko?.importedVia, "der direkte Import hinterliess keine Importspur").toBe(
      "library_import",
    );
    expect(ko?.status).toBe("offen");
    expect(ko?.trust).toBe(0);
    expect(ko?.version).toBe(1);
    expect(ko?.neededValidations).toBeGreaterThanOrEqual(1);
    const pruefmenge = await ctx.koService.list({ status: "offen" });
    expect(pruefmenge.map((k) => k.id)).toContain(ko?.id);
  });

  it("Kandidaten-Accept aus entfernter Quelle: gekennzeichnet, Quelle als Anker und Beleg verlinkt", async () => {
    const ctx = await instanz();
    const koId = await annehmen(ctx, seite(1));
    const ko = await ctx.koService.get(koId);
    expect(ko?.importedVia).toBe("import_candidate");
    expect(ko?.importCandidateId).toBeTruthy();
    expect(ko?.status).toBe("offen");
    expect(ko?.trust).toBe(0);
    expect(ko?.sources).toHaveLength(1);
    expect(ko?.sources[0]).toMatchObject({
      kind: "external",
      peerValidated: false,
      provider: "Confluence",
      externalId: "SEITE-0169",
      spaceKey: "WART",
      sourceVersion: 1,
      url: "https://wiki.example.test/seite-0169",
    });
    // Die Originalquelle steht auch in der append-only Belegkette — nicht nur am Objekt.
    const belege = await ctx.koService.evidenceOf(koId);
    expect(belege.filter((b) => b.kind === "source")).toEqual([
      expect.objectContaining({
        url: "https://wiki.example.test/seite-0169",
        createdBy: IMPORTEUR,
      }),
    ]);
  });

  it("die Importspur überlebt eine spätere Überarbeitung", async () => {
    const ctx = await instanz();
    await ctx.library.importJson(
      [{ title: "Bleibt importiert", statement: "v1", type: "technik", category: "A" }],
      IMPORTEUR,
      OHNE_AEHNLICHKEIT,
    );
    const [ko] = await ctx.koService.list();
    const revidiert = await ctx.koService.revise(ko?.id ?? "", { statement: "v2" }, IMPORTEUR);
    expect(revidiert.version).toBe(2);
    expect(revidiert.importedVia).toBe("library_import");
  });
});

describe("R-0169 — eine Dokumentidentität, festgeschriebene Fassungen", () => {
  it("zwei Quellfassungen derselben Seite: ein Objekt, je Fassung ein unveränderlicher Schnappschuss", async () => {
    const ctx = await instanz();
    const erste = await annehmen(ctx, seite(1));
    const zweite = await annehmen(ctx, seite(2));
    expect(zweite, "die zweite Quellfassung legte ein zweites Objekt an").toBe(erste);

    const fassungen = await ctx.koService.versionsOf(erste);
    const v1 = fassungen.find((f) => f.version === 1);
    const v2 = fassungen.find((f) => f.version === 2);
    expect(v1 && v2, "es fehlen festgeschriebene Fassungen").toBeTruthy();
    // Aus welcher Quellfassung stammt die Aussage dieser Objektfassung? Aus dem Schnappschuss lesbar.
    expect(v1?.snapshot.statement).toBe("Aussage der Quellfassung 1.");
    expect(v1?.snapshot.sources.map((s) => [s.externalId, s.sourceVersion])).toEqual([
      ["SEITE-0169", 1],
    ]);
    expect(v2?.snapshot.statement).toBe("Aussage der Quellfassung 2.");
    expect(v2?.snapshot.sources.map((s) => [s.externalId, s.sourceVersion])).toEqual([
      ["SEITE-0169", 2],
    ]);
  });

  it("eine ältere oder gleiche Quellfassung schreibt keine neue Fassung", async () => {
    const ctx = await instanz();
    const koId = await annehmen(ctx, seite(2));
    await annehmen(ctx, { ...seite(1), statement: "Ältere Fassung, darf nichts überschreiben." });
    const ko = await ctx.koService.get(koId);
    expect(ko?.version).toBe(1);
    expect(ko?.statement).toBe("Aussage der Quellfassung 2.");
  });
});

describe("R-0505 — der Importeur handelt, der Genannte nicht", () => {
  it("importJson: Autor, v1-Schnappschuss und ko.created tragen den Importeur", async () => {
    const ctx = await instanz();
    await ctx.library.importJson(
      [
        {
          title: "Geerbtes Wissen",
          statement: "Stand im Dokument unter fremdem Namen.",
          type: "technik",
          category: "A",
          author: GENANNT,
        },
      ],
      IMPORTEUR,
      OHNE_AEHNLICHKEIT,
    );
    const [ko] = await ctx.koService.list();
    expect(ko?.author).toBe(IMPORTEUR);
    expect(ko?.originalAuthor, "der genannte Name reist als Metadatum weiter").toBe(GENANNT);
    const [v1] = await ctx.koService.versionsOf(ko?.id ?? "");
    expect(v1?.author).toBe(IMPORTEUR);
    const erzeugt = await ctx.audit.list({ action: "ko.created" });
    expect(erzeugt.map((e) => [e.target, e.actor])).toEqual([[ko?.id, IMPORTEUR]]);
  });

  it("Kandidaten-Accept: Autor, v1-Schnappschuss, ko.created und Belegzeile tragen den Annehmenden", async () => {
    const ctx = await instanz();
    const koId = await annehmen(ctx, seite(1));
    const ko = await ctx.koService.get(koId);
    expect(ko?.author).toBe(IMPORTEUR);
    expect(ko?.originalAuthor).toBe(GENANNT);
    const [v1] = await ctx.koService.versionsOf(koId);
    expect(v1?.author).toBe(IMPORTEUR);
    const erzeugt = await ctx.audit.list({ action: "ko.created" });
    expect(erzeugt.map((e) => e.actor)).toEqual([IMPORTEUR]);
    const belege = await ctx.koService.evidenceOf(koId);
    expect(belege.every((b) => b.createdBy === IMPORTEUR)).toBe(true);
  });
});

// ================================================================================================
// AM DRAHT — Sichtbarkeit, Löschrecht und die verworfenen Herkunftsbehauptungen.
// ================================================================================================

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

// Wie mega82: der Aufbau fasst keinen Schlüsselbund an — dieser Test braucht kein Modell.
let keychainVorher: string | undefined;
beforeAll(() => {
  keychainVorher = process.env.KLARWERK_SKIP_KEYCHAIN;
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
});
afterAll(() => {
  if (keychainVorher === undefined) {
    delete process.env.KLARWERK_SKIP_KEYCHAIN;
  } else {
    process.env.KLARWERK_SKIP_KEYCHAIN = keychainVorher;
  }
});

async function anmelden(app: App, email: string): Promise<{ auth: Auth; id: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  const body = res.json();
  return { auth: { authorization: `Bearer ${body.token}` }, id: body.user.id as string };
}

async function flaeche(marke: string) {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await anmelden(app, `admin@${marke}.test`);
  for (const wer of ["importeur", "genannt"]) {
    const email = `${wer}@${marke}.test`;
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.auth,
      payload: { name: email, email, password: "geheim12345", role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    services,
    importeur: await anmelden(app, `importeur@${marke}.test`),
    genannt: await anmelden(app, `genannt@${marke}.test`),
  };
}

describe("am Draht — R-0505 Sichtbarkeit/Löschrecht, R-0139 keine behauptete Herkunft", () => {
  it("der im Dokument Genannte sieht und löscht das vertrauliche Importobjekt nicht, der Importeur schon", async () => {
    const { app, services, importeur, genannt } = await flaeche("r0505");
    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers: importeur.auth,
      payload: {
        items: [
          {
            title: "Vertrauliche Anweisung aus Altdokument",
            statement: "Im Dokument stand ein anderer Name.",
            type: "best_practice",
            category: "Anlage 5",
            confidentiality: "vertraulich",
            author: genannt.id,
          },
        ],
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    const ko = (await services.ko.list()).find(
      (k) => k.title === "Vertrauliche Anweisung aus Altdokument",
    );
    expect(ko?.author).toBe(importeur.id);
    expect(ko?.importedVia).toBe("library_import");
    const id = ko?.id ?? "";

    const siehtGenannt = await app.inject({
      method: "GET",
      url: `/api/kos/${id}`,
      headers: genannt.auth,
    });
    expect(siehtGenannt.statusCode, "der Genannte sieht ein fremdes vertrauliches Objekt").toBe(
      404,
    );
    const loeschtGenannt = await app.inject({
      method: "DELETE",
      url: `/api/kos/${id}`,
      headers: genannt.auth,
    });
    expect(loeschtGenannt.statusCode, "der Genannte durfte löschen").toBe(404);

    const siehtImporteur = await app.inject({
      method: "GET",
      url: `/api/kos/${id}`,
      headers: importeur.auth,
    });
    expect(siehtImporteur.statusCode, siehtImporteur.body).toBe(200);
    const loeschtImporteur = await app.inject({
      method: "DELETE",
      url: `/api/kos/${id}`,
      headers: importeur.auth,
    });
    expect(loeschtImporteur.statusCode, loeschtImporteur.body).toBe(204);
  });

  it("POST /api/kos verwirft behauptetes origin und importedVia", async () => {
    const { app, services, importeur } = await flaeche("r0139");
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: importeur.auth,
      payload: {
        title: "Frei erfasst",
        statement: "Behauptet, aus Word und importiert zu sein.",
        type: "best_practice",
        category: "Anlage 1",
        confidentiality: "intern",
        origin: "word_addin",
        importedVia: "import_candidate",
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const gespeichert = await services.ko.get(res.json().id as string);
    expect(gespeichert, "das Objekt fehlt").toBeDefined();
    expect(gespeichert).not.toHaveProperty("origin");
    expect(gespeichert).not.toHaveProperty("importedVia");
    expect(gespeichert?.author).toBe(importeur.id);
  });
});
