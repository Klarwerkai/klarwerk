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
import { ImportParseError, parseImportItems } from "../../apps/web/src/lib/importReview";
import { dokumentkennungAusAntwort, mitDokumentkennung } from "../../apps/web/src/lib/wordAddin";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  DokumentaktenService,
  InMemoryDokumentaktenRepo,
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import { InMemoryExternalSourceRepo, LibraryService } from "../../services/library-analytics";
import type { DublettenPruefung, ImportItem } from "../../services/library-analytics";
import { MAX_SOURCE_VERSION } from "../../services/library-analytics/src/repo";
import { quellinhaltAbdruck } from "../../services/library-analytics/src/service";

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
  for (const [wer, role] of [
    ["importeur", "experte"],
    ["genannt", "experte"],
    ["controller", "controller"],
  ] as const) {
    const email = `${wer}@${marke}.test`;
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.auth,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    services,
    admin,
    importeur: await anmelden(app, `importeur@${marke}.test`),
    genannt: await anmelden(app, `genannt@${marke}.test`),
    controller: await anmelden(app, `controller@${marke}.test`),
  };
}

/**
 * Der vorhandene aktivierte Importzweig (wie mega82): der Quellschalter gilt NUR für den Körper —
 * die übrigen Drahtfälle laufen ausdrücklich OHNE ihn, weil der direkte Import seine mitgelieferte
 * Quelle auch ohne Quelladapter behalten muss.
 */
async function mitQuellimport<T>(fn: () => Promise<T>, an = true): Promise<T> {
  const vorher = process.env.KLARWERK_CONFLUENCE_IMPORT;
  if (an) {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  } else {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  }
  try {
    return await fn();
  } finally {
    if (vorher === undefined) {
      delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    } else {
      process.env.KLARWERK_CONFLUENCE_IMPORT = vorher;
    }
  }
}

const QUELL_URL = "https://wiki.example.test/display/WART/SEITE-HERKUNFT";

function quellEintrag(fassung: number, aussage: string) {
  return {
    title: "Herkunftsseite Pumpe P7",
    statement: aussage,
    type: "best_practice",
    category: "Wartung",
    confidentiality: "intern",
    provider: "Confluence",
    externalId: "SEITE-HERKUNFT",
    sourceVersion: fassung,
    url: QUELL_URL,
  };
}

// ================================================================================================
// INTEGRATION MIT MAIN (R-0143) — DER DIREKTE EINGANG REIHT EIN, ANGELEGT WIRD ERST BEI DER ANNAHME.
// ================================================================================================
//
// Seit R-0143 legt `POST /api/library/import` kein Wissensobjekt mehr an, sondern reiht Kandidaten
// in die Prüfwarteschlange (`direktimportAntwort`). Die Gegenproben dieser Datei messen deshalb den
// REGULÄREN Weg: einreichen über den direkten Eingang, annehmen über
// `PUT /api/library/import/candidates/:id` durch eine Person mit `ko.validate`. Die handelnde Person
// der Anlage ist damit die ANNEHMENDE (R-0505).
interface Direktantwort {
  imported: number;
  skipped: number;
  eingereiht: number;
  uebersprungen: { titel: string; grund: string; koId: string | null }[];
  kandidaten: { id: string; koId: string | null; dublettenbefund?: { ergebnis: string } }[];
}

/** Nimmt jeden eingereihten Kandidaten an; liefert je Kandidat die vermerkte Objektkennung. */
async function alleAnnehmen(app: App, annehmer: Auth, antwort: Direktantwort) {
  const koIds: (string | null)[] = [];
  for (const kandidat of antwort.kandidaten) {
    const res = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidat.id}`,
      headers: annehmer,
      payload: { action: "accept" },
    });
    expect(res.statusCode, res.body).toBe(200);
    koIds.push((res.json() as { koId: string | null }).koId);
  }
  return koIds;
}

/** Einreichen über den direkten Eingang und annehmen — der reguläre Importweg bis zum Objekt. */
async function direktImportieren(
  app: App,
  wer: Auth,
  annehmer: Auth,
  item: Record<string, unknown>,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/library/import",
    headers: wer,
    payload: { items: [item] },
  });
  expect(res.statusCode, res.body).toBe(200);
  const antwort = res.json() as Direktantwort;
  expect(antwort.imported, "der direkte Eingang hat ohne Annahme angelegt").toBe(0);
  return { antwort, koIds: await alleAnnehmen(app, annehmer, antwort) };
}

async function koMitQuelle(services: ReturnType<typeof buildServices>, externalId: string) {
  const ko = (await services.ko.list()).find((k) =>
    k.sources.some((s) => s.externalId === externalId),
  );
  if (!ko) {
    throw new Error(`kein Wissensobjekt trägt die Quelle ${externalId}`);
  }
  return ko;
}

describe("am Draht — R-0505 Sichtbarkeit/Löschrecht, R-0139 keine behauptete Herkunft", () => {
  it("der im Dokument Genannte sieht und löscht das vertrauliche Importobjekt nicht, der Annehmende schon", async () => {
    const { app, services, importeur, genannt, controller } = await flaeche("r0505");
    // R-0143 (main): eingereicht vom Importeur, angelegt erst durch die Annahme des Controllers —
    // die handelnde Person der Anlage ist der ANNEHMENDE, nie der im Dokument genannte Name.
    const { koIds } = await direktImportieren(app, importeur.auth, controller.auth, {
      title: "Vertrauliche Anweisung aus Altdokument",
      statement: "Im Dokument stand ein anderer Name.",
      type: "best_practice",
      category: "Anlage 5",
      confidentiality: "vertraulich",
      author: genannt.id,
    });
    const ko = await services.ko.get(koIds[0] ?? "");
    expect(ko?.author).toBe(controller.id);
    expect(ko?.originalAuthor, "der genannte Name reist als Metadatum weiter").toBe(genannt.id);
    expect(ko?.importedVia).toBe("import_candidate");
    expect(ko?.origin).toBe("import");
    const id = ko?.id ?? "";

    // Wer nur eingereicht hat, bekommt dadurch keine Rechte am vertraulichen Objekt.
    const siehtEinreichender = await app.inject({
      method: "GET",
      url: `/api/kos/${id}`,
      headers: importeur.auth,
    });
    expect(siehtEinreichender.statusCode).toBe(404);

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

    const siehtAnnehmender = await app.inject({
      method: "GET",
      url: `/api/kos/${id}`,
      headers: controller.auth,
    });
    expect(siehtAnnehmender.statusCode, siehtAnnehmender.body).toBe(200);
    const loeschtAnnehmender = await app.inject({
      method: "DELETE",
      url: `/api/kos/${id}`,
      headers: controller.auth,
    });
    expect(loeschtAnnehmender.statusCode, loeschtAnnehmender.body).toBe(204);
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

// ================================================================================================
// NACHARBEIT 1 (bens Befunde zu K1, K2, K4) — GEGENPROBEN AM DRAHT.
// ================================================================================================
//
// K1/F1: der direkte JSON-Import behält provider/externalId/sourceVersion/url — am Objekt, in der
//        Belegkette und nach einer regulären Inhaltsrevision.
// K2/F2: der REGULÄRE Import (Kandidatenweg UND direkter Import) schreibt selbst die
//        unveränderlichen Quellrevisionen; kein Test fügt hier Quellrecords ein.
// K4:    der direkte Import steht auf dem tatsächlichen Prüfboard (`ValidationService.board`).

type Dienste = ReturnType<typeof buildServices>;

/** Zwei Quellfassungen derselben Quelle → zwei Revisionen, ein Objekt, je Fassung die passende. */
async function pruefeZweiFassungen(
  services: Dienste,
  ersteVorher: Awaited<ReturnType<Dienste["externalSources"]["findById"]>>,
) {
  expect(ersteVorher, "die erste Quellfassung wurde nicht festgeschrieben").toBeDefined();
  const revisionen = await services.externalSources.listBySource("Confluence", "SEITE-HERKUNFT");
  expect(revisionen.map((r) => r.sourceVersion)).toEqual([1, 2]);
  const [r1, r2] = revisionen;
  const meldung = "zwei Fassungen teilen sich eine Revisionskennung";
  expect(r1?.sourceRecordId, meldung).not.toBe(r2?.sourceRecordId);
  expect(r1?.contentHash).not.toBe(r2?.contentHash);
  expect(r1?.url).toBe(QUELL_URL);
  // Unveränderlich: die erste Revision ist nach dem zweiten Import Feld für Feld dieselbe.
  const quellen = services.externalSources;
  const erste = await quellen.findByRevision("Confluence", "SEITE-HERKUNFT", 1);
  const zweite = await quellen.findByRevision("Confluence", "SEITE-HERKUNFT", 2);
  expect(erste).toEqual(ersteVorher);
  expect(zweite).toEqual(r2);

  // EINE Dokumentidentität: beide Fassungen landen in demselben Wissensobjekt.
  const traeger = (await services.ko.list()).filter((k) =>
    k.sources.some((s) => s.externalId === "SEITE-HERKUNFT"),
  );
  expect(traeger, "dieselbe Quelle wurde zu zwei Objekten").toHaveLength(1);
  // Jede Objektfassung nennt die Revision, aus der ihre Aussage stammt.
  const fassungen = [...(await services.ko.versionsOf(traeger[0]?.id ?? ""))].sort(
    (a, b) => a.version - b.version,
  );
  expect(
    fassungen.map((f) => [
      f.snapshot.statement,
      f.snapshot.sources.find((s) => s.externalId === "SEITE-HERKUNFT")?.sourceRecordId,
    ]),
  ).toEqual([
    ["Aussage der Quellfassung 1.", r1?.sourceRecordId],
    ["Aussage der Quellfassung 2.", r2?.sourceRecordId],
  ]);
}

describe("Nacharbeit 1 — Quelle, Quellfassung und Prüfboard am Draht", () => {
  it("K1 · direkter JSON-Import behält die mitgelieferte Quelle, auch nach einer regulären Revision", async () => {
    const { app, services, admin, importeur, controller } = await flaeche("n1k1");
    const { koIds } = await direktImportieren(
      app,
      importeur.auth,
      controller.auth,
      quellEintrag(7, "Aussage aus Quellfassung 7."),
    );
    const ko = await koMitQuelle(services, "SEITE-HERKUNFT");
    expect(koIds).toEqual([ko.id]);
    expect((await services.ko.get(ko.id))?.importedVia).toBe("import_candidate");

    type Quelle = {
      provider?: string | null;
      externalId?: string;
      sourceVersion?: number;
      url?: string | null;
      sourceRecordId?: string;
    };
    const lesen = async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/kos/${ko.id}`,
        headers: importeur.auth,
      });
      expect(res.statusCode, res.body).toBe(200);
      return res.json() as { statement: string; version: number; sources: Quelle[] };
    };
    const vorher = await lesen();
    expect(vorher.sources).toEqual([
      expect.objectContaining({
        provider: "Confluence",
        externalId: "SEITE-HERKUNFT",
        sourceVersion: 7,
        url: QUELL_URL,
      }),
    ]);
    const revisionsId = vorher.sources[0]?.sourceRecordId;
    expect(revisionsId, "der Anker zeigt auf keine festgeschriebene Quellfassung").toBeTruthy();
    expect(await services.externalSources.findById(revisionsId ?? "")).toMatchObject({
      externalId: "SEITE-HERKUNFT",
      sourceVersion: 7,
      url: QUELL_URL,
    });
    const belegeVorher = await services.ko.evidenceOf(ko.id);
    expect(belegeVorher.filter((b) => b.kind === "source")).toEqual([
      expect.objectContaining({ url: QUELL_URL, createdBy: controller.id, koVersion: 1 }),
    ]);

    // Reguläre Inhaltsrevision über die Schreibroute.
    const revidiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: admin.auth,
      payload: { action: "revise", changes: { statement: "Später überarbeitet." } },
    });
    expect(revidiert.statusCode, revidiert.body).toBe(200);

    const nachher = await lesen();
    expect(nachher.version).toBe(2);
    expect(nachher.statement).toBe("Später überarbeitet.");
    expect(nachher.sources, "die Herkunft ging bei der Revision verloren").toEqual([
      expect.objectContaining({
        provider: "Confluence",
        externalId: "SEITE-HERKUNFT",
        sourceVersion: 7,
        url: QUELL_URL,
        sourceRecordId: revisionsId,
      }),
    ]);
    // Die ursprüngliche Fassung und ihr Beleg bleiben lesbar.
    const v1 = (await services.ko.versionsOf(ko.id)).find((f) => f.version === 1);
    expect(v1?.snapshot.statement).toBe("Aussage aus Quellfassung 7.");
    expect(v1?.snapshot.sources[0]?.sourceRecordId).toBe(revisionsId);
    const belegeNachher = await services.ko.evidenceOf(ko.id);
    expect(
      belegeNachher.some(
        (b) =>
          b.kind === "source" &&
          b.koVersion === 1 &&
          b.url === QUELL_URL &&
          b.createdBy === controller.id,
      ),
    ).toBe(true);
  });

  it("K1 · ohne Quellkennung bleibt eine mitgelieferte Quell-URL als Verweis erhalten — ohne erfundene Identität", async () => {
    const { app, services, importeur, controller } = await flaeche("n1k1b");
    await direktImportieren(app, importeur.auth, controller.auth, {
      title: "Nur mit Verweis",
      statement: "Kein Quellsystem-Schlüssel mitgeliefert.",
      type: "technik",
      category: "A",
      provider: "Confluence",
      url: QUELL_URL,
    });
    const ko = (await services.ko.list()).find((k) => k.title === "Nur mit Verweis");
    expect(ko?.sources).toEqual([
      expect.objectContaining({ provider: "Confluence", url: QUELL_URL }),
    ]);
    expect(ko?.sources[0]).not.toHaveProperty("externalId");
    expect(ko?.sources[0]).not.toHaveProperty("sourceRecordId");
  });

  it("K2 · Kandidatenweg: zwei Quellfassungen ergeben zwei unveränderliche Revisionen derselben Quelle", () =>
    mitQuellimport(async () => {
      const { app, services, importeur, controller } = await flaeche("n1k2a");
      let ersteVorher: Awaited<ReturnType<Dienste["externalSources"]["findById"]>> = undefined;
      for (const fassung of [1, 2]) {
        const eingereicht = await app.inject({
          method: "POST",
          url: "/api/library/import/candidates",
          headers: importeur.auth,
          payload: { items: [quellEintrag(fassung, `Aussage der Quellfassung ${fassung}.`)] },
        });
        expect(eingereicht.statusCode, eingereicht.body).toBe(201);
        const kandidatId = (eingereicht.json() as { id: string }[])[0]?.id;
        const angenommen = await app.inject({
          method: "PUT",
          url: `/api/library/import/candidates/${kandidatId}`,
          headers: controller.auth,
          payload: { action: "accept" },
        });
        expect(angenommen.statusCode, angenommen.body).toBe(200);
        if (fassung === 1) {
          ersteVorher = await services.externalSources.findByRevision(
            "Confluence",
            "SEITE-HERKUNFT",
            1,
          );
        }
      }
      await pruefeZweiFassungen(services, ersteVorher);
    }));

  it("K2 · direkter Eingang (eingereiht, angenommen): dieselbe Prüfung, zwei Aussagen, eine Quellenidentität", async () => {
    const { app, services, importeur, controller } = await flaeche("n1k2b");
    const ersteFassung = quellEintrag(1, "Aussage der Quellfassung 1.");
    const erste = await direktImportieren(app, importeur.auth, controller.auth, ersteFassung);
    expect(erste.koIds).toHaveLength(1);
    const ersteVorher = await services.externalSources.findByRevision(
      "Confluence",
      "SEITE-HERKUNFT",
      1,
    );
    const zweite = await direktImportieren(
      app,
      importeur.auth,
      controller.auth,
      quellEintrag(2, "Aussage der Quellfassung 2."),
    );
    expect(zweite.koIds, "die neue Quellfassung lief nicht in dasselbe Objekt").toEqual(
      erste.koIds,
    );
    await pruefeZweiFassungen(services, ersteVorher);

    // Eine ältere Fassung schreibt weder eine Revision noch eine Objektfassung.
    const aeltere = await direktImportieren(
      app,
      importeur.auth,
      controller.auth,
      quellEintrag(1, "Abweichender Text unter alter Fassung."),
    );
    expect(aeltere.koIds).toEqual(erste.koIds);
    await pruefeZweiFassungen(services, ersteVorher);
  });

  it("K4 · direkter Eingang (eingereiht, angenommen) steht ungeprüft auf dem tatsächlichen Prüfboard, mit Originalquelle", async () => {
    const { app, services, importeur, controller } = await flaeche("n1k4");
    await direktImportieren(app, importeur.auth, controller.auth, {
      ...quellEintrag(3, "Ungeprüft aus der Quelle."),
      externalId: "SEITE-K4",
    });
    const ko = await koMitQuelle(services, "SEITE-K4");

    const brett = await services.validation.board();
    const zeile = brett.find((k) => k.id === ko.id);
    expect(zeile, "das importierte Objekt fehlt auf dem Prüfboard").toBeDefined();
    expect(zeile).toMatchObject({
      status: "offen",
      trust: 0,
      version: 1,
      importedVia: "import_candidate",
      origin: "import",
    });
    expect(zeile?.sources).toEqual([
      expect.objectContaining({
        kind: "external",
        peerValidated: false,
        provider: "Confluence",
        externalId: "SEITE-K4",
        sourceVersion: 3,
        url: QUELL_URL,
      }),
    ]);
    const belege = await services.ko.evidenceOf(ko.id);
    expect(belege.filter((b) => b.kind === "source")).toEqual([
      expect.objectContaining({ url: QUELL_URL, createdBy: controller.id }),
    ]);
  });
});

// ================================================================================================
// NACHARBEIT 2 (bens Befunde zu K1, K2, K3, K4) — GEGENPROBEN.
// ================================================================================================
//
// K1/K4: der tatsächliche Dateiparser (`parseImportItems`) und die Kandidatenrouten, Quelladapter AUS.
// K2:    keine Revision nach abgewiesenem Erstversuch, Inhaltskonflikt gegen eine vorhandene
//        Revision, ungültige Quellfassungen werden abgewiesen statt ohne Revision übernommen.
// K3:    der direkte Re-Sync erreicht weder fremde vertrauliche noch freigegebene Objekte.

async function direktRoh(app: App, wer: Auth, item: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/api/library/import",
    headers: wer,
    payload: { items: [item] },
  });
}

function anker(externalId: string, fassung: number, aussage: string, stufe = "intern") {
  return {
    title: `Quelle ${externalId}`,
    statement: aussage,
    type: "best_practice",
    category: "Wartung",
    confidentiality: stufe,
    provider: "Confluence",
    externalId,
    sourceVersion: fassung,
    url: QUELL_URL,
  };
}

describe("Nacharbeit 2 — Dateiparser, Fassungsbindung und Rechte am Draht", () => {
  it("K1/K4 · JSON-Datei → parseImportItems → Kandidat → Annahme: Quelle erhalten, auf dem Prüfboard (Quelladapter AUS)", () =>
    mitQuellimport(async () => {
      const { app, services, importeur, controller } = await flaeche("n2k1");
      const datei = JSON.stringify([
        {
          title: "Aus der Datei",
          statement: "Mit Quellangaben aus der Datei.",
          type: "best_practice",
          category: "Wartung",
          provider: "Confluence",
          externalId: "DATEI-QUELLE",
          sourceVersion: 7,
          url: QUELL_URL,
        },
      ]);
      const items = parseImportItems(datei);
      expect(items[0], "der Produktparser verwirft die Quellangaben").toMatchObject({
        provider: "Confluence",
        externalId: "DATEI-QUELLE",
        sourceVersion: 7,
        url: QUELL_URL,
      });

      const eingereicht = await app.inject({
        method: "POST",
        url: "/api/library/import/candidates",
        headers: importeur.auth,
        payload: { items },
      });
      expect(eingereicht.statusCode, eingereicht.body).toBe(201);
      const kandidatId = (eingereicht.json() as { id: string }[])[0]?.id;
      const angenommen = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${kandidatId}`,
        headers: controller.auth,
        payload: { action: "accept" },
      });
      expect(angenommen.statusCode, angenommen.body).toBe(200);
      const koId = (angenommen.json() as { koId: string | null }).koId;
      expect(koId, "die Annahme legte kein Wissensobjekt an").toBeTruthy();

      // K1: zurückgelesen über die Route.
      const gelesen = await app.inject({
        method: "GET",
        url: `/api/kos/${koId}`,
        headers: controller.auth,
      });
      expect(gelesen.statusCode, gelesen.body).toBe(200);
      const quellen = (gelesen.json() as { sources: Record<string, unknown>[] }).sources;
      expect(quellen).toEqual([
        expect.objectContaining({
          provider: "Confluence",
          externalId: "DATEI-QUELLE",
          sourceVersion: 7,
          url: QUELL_URL,
        }),
      ]);
      const revisionsId = quellen[0]?.sourceRecordId as string | undefined;
      expect(await services.externalSources.findById(revisionsId ?? "")).toMatchObject({
        externalId: "DATEI-QUELLE",
        sourceVersion: 7,
        url: QUELL_URL,
      });

      // K4: das tatsächliche Prüfboard und die Belegzeile des authentifizierten Annehmenden.
      const zeile = (await services.validation.board()).find((k) => k.id === koId);
      expect(zeile, "das Objekt fehlt auf dem Prüfboard").toBeDefined();
      expect(zeile).toMatchObject({ status: "offen", trust: 0, importedVia: "import_candidate" });
      expect(zeile?.sources[0]?.url).toBe(QUELL_URL);
      const belege = await services.ko.evidenceOf(koId ?? "");
      expect(belege.filter((b) => b.kind === "source")).toEqual([
        expect.objectContaining({ url: QUELL_URL, createdBy: controller.id }),
      ]);
    }, false));

  it("K1 · der Produktparser lehnt unbrauchbare Quellangaben mit Feldnamen ab, statt sie still zu verwerfen", () => {
    const basis = { title: "t", statement: "s", type: "technik", category: "c" };
    for (const [feld, wert] of [
      ["sourceVersion", 1.5],
      ["sourceVersion", -1],
      ["url", "javascript:alert(1)"],
      ["externalId", 42],
    ] as const) {
      try {
        parseImportItems(JSON.stringify([{ ...basis, [feld]: wert }]));
        throw new Error(`${feld}=${String(wert)} wurde angenommen`);
      } catch (fehler) {
        expect(fehler).toBeInstanceOf(ImportParseError);
        expect((fehler as ImportParseError).fields).toContain(feld);
      }
    }
    // Ohne Quellangaben bleibt alles wie bisher.
    expect(parseImportItems(JSON.stringify([basis]))[0]).not.toHaveProperty("externalId");
  });

  it("K2 · abgewiesener Erstversuch hinterlässt keine Revision; die Wiederholung mit Text B wird an B gebunden", async () => {
    const { app, services, importeur, controller } = await flaeche("n2k2a");
    const quelle = (aussage: string, type: string) => ({
      ...anker("RETRY-QUELLE", 1, aussage),
      type,
    });
    const erster = await direktRoh(app, importeur.auth, quelle("Text A", "keine_wissensart"));
    expect(erster.statusCode, erster.body).toBe(400);
    expect(await services.externalSources.listBySource("Confluence", "RETRY-QUELLE")).toEqual([]);
    expect((await services.ko.list()).some((k) => k.statement === "Text A")).toBe(false);

    const itemB = quelle("Text B", "best_practice");
    const zweiter = await direktImportieren(app, importeur.auth, controller.auth, itemB);
    expect(zweiter.koIds).toHaveLength(1);
    const revisionen = await services.externalSources.listBySource("Confluence", "RETRY-QUELLE");
    expect(revisionen).toHaveLength(1);
    expect(revisionen[0]?.contentHash).toBe(quellinhaltAbdruck(itemB as unknown as ImportItem));
    const ko = await koMitQuelle(services, "RETRY-QUELLE");
    expect(ko.statement).toBe("Text B");
    expect(ko.sources[0]?.sourceRecordId).toBe(revisionen[0]?.sourceRecordId);

    // Positive Gegenprobe: die identische Wiederholung ist ein No-op, kein Fehler.
    const dritter = await direktImportieren(app, importeur.auth, controller.auth, itemB);
    expect(dritter.koIds.filter((id) => id !== null && id !== ko.id)).toEqual([]);
    expect(await services.externalSources.listBySource("Confluence", "RETRY-QUELLE")).toEqual(
      revisionen,
    );
  });

  it("K2 · eine vorhandene Revision mit anderem Inhalt wird nicht übernommen: Konflikt, nichts verändert", async () => {
    // Die Ausgangslage, die die Vorprüfung heute verhindert, aber ein Abbruch ZWISCHEN Revision und
    // Objekt (Prozessende) weiterhin erzeugen kann: eine Revision für Text A ohne Objekt.
    const quellen = new InMemoryExternalSourceRepo();
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();
    const library = new LibraryService({ koService, externalSources: quellen });
    const itemA = anker("RETRY-KONFLIKT", 1, "Text A") as unknown as ImportItem;
    const itemB = anker("RETRY-KONFLIKT", 1, "Text B") as unknown as ImportItem;
    await quellen.insertIfAbsent({
      sourceRecordId: "rev-a",
      sourceSystem: "confluence",
      externalId: "RETRY-KONFLIKT",
      sourceVersion: 1,
      url: QUELL_URL,
      title: itemA.title,
      rawOrRenderedContentReference: null,
      importedAt: "2026-10-04T08:00:00.000Z",
      contentHash: quellinhaltAbdruck(itemA),
      sourceMetadata: {},
    });
    const vorher = await quellen.listBySource("Confluence", "RETRY-KONFLIKT");

    const versuch = library.importJson([itemB], IMPORTEUR, OHNE_AEHNLICHKEIT);
    await expect(versuch).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await quellen.listBySource("Confluence", "RETRY-KONFLIKT")).toEqual(vorher);
    expect(await koService.list(), "trotz Konflikt entstand ein Objekt").toEqual([]);

    // Positive Gegenprobe: derselbe Inhalt wie die Revision wird an genau sie gebunden.
    const ok = await library.importJson([itemA], IMPORTEUR, OHNE_AEHNLICHKEIT);
    expect(ok.imported).toBe(1);
    const [ko] = await koService.list();
    expect(ko?.sources[0]?.sourceRecordId).toBe("rev-a");
  });

  for (const fassung of [-1, 1.5, MAX_SOURCE_VERSION + 1]) {
    it(`K2 · ungültige Quellfassung ${fassung} wird mit 4xx abgewiesen, Bestand unverändert`, async () => {
      const marke = `n2k2v${String(fassung).replace(/\W/g, "")}`;
      const { app, services, importeur, controller } = await flaeche(marke);
      const kennung = `FASSUNG-${String(fassung).replace(/\W/g, "_")}`;
      const kosVorher = (await services.ko.list()).length;
      const res = await direktRoh(app, importeur.auth, anker(kennung, fassung, "Ungültig."));
      expect(res.statusCode, res.body).toBeGreaterThanOrEqual(400);
      expect(res.statusCode, res.body).toBeLessThan(500);
      expect((await services.ko.list()).length).toBe(kosVorher);
      expect(await services.externalSources.listBySource("Confluence", kennung)).toEqual([]);

      // Gegenprobe: dieselbe Quelle mit gültiger Fassung 1 wird übernommen, mit auflösbarer Revision.
      const gueltig = anker(kennung, 1, "Gültig.");
      await direktImportieren(app, importeur.auth, controller.auth, gueltig);
      const ko = await koMitQuelle(services, kennung);
      const revisionsId = ko.sources[0]?.sourceRecordId ?? "";
      expect(await services.externalSources.findById(revisionsId)).toMatchObject({
        externalId: kennung,
        sourceVersion: 1,
      });
    });
  }

  it("K3 · der direkte Eingang erreicht kein fremdes vertrauliches Objekt — weder Kennung noch Änderung", async () => {
    const { app, services, importeur, genannt, controller } = await flaeche("n2k3a");
    // Ein vertrauliches Objekt mit Quellanker (eingereicht von A, angenommen vom Controller).
    await direktImportieren(
      app,
      importeur.auth,
      controller.auth,
      anker("SEITE-FREMD", 1, "Vertraulich bei A.", "vertraulich"),
    );
    const ko = await koMitQuelle(services, "SEITE-FREMD");
    const vorher = await services.ko.get(ko.id);
    const sieht = await app.inject({
      method: "GET",
      url: `/api/kos/${ko.id}`,
      headers: genannt.auth,
    });
    expect(sieht.statusCode, "VORBEDINGUNG: B sieht das Objekt nicht").toBe(404);

    // R-0143 (main): B reiht nur ein — es entsteht nichts und es ändert sich nichts ohne Annahme;
    // NACHARBEIT 3: und die Antwort nennt den unsichtbaren Treffer nicht.
    for (const fassung of [1, 2]) {
      const res = await direktRoh(
        app,
        genannt.auth,
        anker("SEITE-FREMD", fassung, `Von B überschrieben (${fassung}).`),
      );
      expect(res.statusCode, res.body).toBe(200);
      expect(res.body, "die Antwort nennt die fremde Kennung").not.toContain(ko.id);
      const antwort = res.json() as Direktantwort;
      expect(antwort.imported).toBe(0);
      for (const kandidat of antwort.kandidaten) {
        expect(kandidat.dublettenbefund).toEqual({ ergebnis: "pruefung_nicht_moeglich" });
      }
    }
    const nachher = await services.ko.get(ko.id);
    expect({
      statement: nachher?.statement,
      confidentiality: nachher?.confidentiality,
      version: nachher?.version,
      sources: nachher?.sources,
    }).toEqual({
      statement: vorher?.statement,
      confidentiality: vorher?.confidentiality,
      version: vorher?.version,
      sources: vorher?.sources,
    });
    const versionen = await services.externalSources.listBySource("Confluence", "SEITE-FREMD");
    expect(
      versionen.map((r) => r.sourceVersion),
      "B schrieb eine Quellrevision",
    ).toEqual([1]);

    // Positive Gegenprobe: fortgeschrieben wird über die berechtigte Annahme (`ko.validate`).
    await direktImportieren(
      app,
      importeur.auth,
      controller.auth,
      anker("SEITE-FREMD", 3, "Über die Annahme fortgeschrieben.", "vertraulich"),
    );
    expect((await services.ko.get(ko.id))?.statement).toBe("Über die Annahme fortgeschrieben.");
  });

  it("K3 · ein freigegebenes Objekt: revise verlangt einen Vorschlag, und der direkte Import umgeht das nicht", async () => {
    const { app, services, admin, importeur, genannt, controller } = await flaeche("n2k3b");
    await direktImportieren(
      app,
      importeur.auth,
      controller.auth,
      anker("SEITE-FREI", 1, "Freigegebener Stand."),
    );
    const ko = await koMitQuelle(services, "SEITE-FREI");
    await services.ko.setValidationState(ko.id, { trust: 80, status: "validiert" });
    const vorher = await services.ko.get(ko.id);

    const revise = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: genannt.auth,
      payload: { action: "revise", changes: { statement: "Direkt ersetzt." } },
    });
    expect(revise.statusCode, revise.body).toBe(403);
    expect((revise.json() as { error: string }).error).toBe("PROPOSAL_REQUIRED");

    // Der direkte Eingang reiht nur ein (R-0143) — der freigegebene Stand bleibt unberührt.
    const umweg = await direktRoh(app, genannt.auth, anker("SEITE-FREI", 2, "Über den Import."));
    expect(umweg.statusCode, umweg.body).toBe(200);
    const umwegAntwort = umweg.json() as Direktantwort;
    expect(umwegAntwort.imported).toBe(0);
    const nachher = await services.ko.get(ko.id);
    expect(nachher?.statement).toBe(vorher?.statement);
    expect(nachher?.version).toBe(vorher?.version);
    expect(nachher?.status).toBe("validiert");

    // Positive Gegenprobe: wer freigeben darf (Admin), nimmt die neue Quellfassung an.
    await alleAnnehmen(app, admin.auth, umwegAntwort);
    expect((await services.ko.get(ko.id))?.statement).toBe("Über den Import.");
  });
});

// ================================================================================================
// NACHARBEIT 3 (bens Befunde zu K1, K2, K3, K4) — GEGENPROBEN.
// ================================================================================================
//
// K1/K4: Datei mit Quell-URL OHNE `externalId` über Parser und Kandidatenweg (Quelladapter AUS).
// K2:    Inhaltskonflikt beim Re-Sync eines bestehenden Objekts ändert auch die Einstufung nicht.
// K3:    die Kandidatenantworten nennen die Kennung eines unsichtbaren Ziels nicht.

async function kandidatEinreichen(app: App, wer: Auth, items: unknown[]) {
  const res = await app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers: wer,
    payload: { items },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res;
}

describe("Nacharbeit 3 — Verweis ohne Kennung, Konflikt vor Einstufung, verdeckte Treffer", () => {
  it("K1/K4 · Datei mit Quell-URL ohne externalId → Kandidat → Annahme: Verweis erhalten, ohne erfundene Kennung", () =>
    mitQuellimport(async () => {
      const { app, services, importeur, controller } = await flaeche("n3k1");
      const datei = JSON.stringify([
        {
          title: "Verweis ohne Kennung aus der Datei",
          statement: "Die Datei nennt nur Anbieter und Adresse der Quelle.",
          type: "best_practice",
          category: "Wartung",
          provider: "Confluence",
          url: QUELL_URL,
        },
      ]);
      const items = parseImportItems(datei);
      expect(items[0]).toMatchObject({ provider: "Confluence", url: QUELL_URL });
      expect(items[0]).not.toHaveProperty("externalId");

      const eingereicht = await kandidatEinreichen(app, importeur.auth, items);
      const kandidatId = (eingereicht.json() as { id: string }[])[0]?.id;
      const angenommen = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${kandidatId}`,
        headers: controller.auth,
        payload: { action: "accept" },
      });
      expect(angenommen.statusCode, angenommen.body).toBe(200);
      const koId = (angenommen.json() as { koId: string | null }).koId ?? "";
      expect(koId, "die Annahme legte kein Wissensobjekt an").toBeTruthy();

      // K1: zurückgelesen über die Route — die Adresse als Quelle, KEINE Kennung, Fassung, Revision.
      const gelesen = await app.inject({
        method: "GET",
        url: `/api/kos/${koId}`,
        headers: controller.auth,
      });
      expect(gelesen.statusCode, gelesen.body).toBe(200);
      const quellen = (gelesen.json() as { sources: Record<string, unknown>[] }).sources;
      expect(quellen).toEqual([
        expect.objectContaining({ provider: "Confluence", url: QUELL_URL, kind: "external" }),
      ]);
      for (const erfunden of ["externalId", "sourceVersion", "sourceRecordId"]) {
        expect(quellen[0], `der Verweis trägt ein erfundenes ${erfunden}`).not.toHaveProperty(
          erfunden,
        );
      }

      // K4: das tatsächliche Prüfboard und die Belegzeile des authentifizierten Annehmenden.
      const zeile = (await services.validation.board()).find((k) => k.id === koId);
      expect(zeile, "das Objekt fehlt auf dem Prüfboard").toBeDefined();
      expect(zeile).toMatchObject({ status: "offen", trust: 0, importedVia: "import_candidate" });
      expect(zeile?.sources[0]?.url).toBe(QUELL_URL);
      const belege = await services.ko.evidenceOf(koId);
      expect(belege.filter((b) => b.kind === "source")).toEqual([
        expect.objectContaining({ url: QUELL_URL, createdBy: controller.id }),
      ]);
    }, false));

  it("K2 · Inhaltskonflikt beim Re-Sync: 409, und auch die höhere Einstufung wird nicht übernommen", async () => {
    const { app, services, importeur, controller } = await flaeche("n3k2");
    const ersteFassung = anker("RESYNC-KONFLIKT", 1, "Fassung 1.");
    await direktImportieren(app, importeur.auth, controller.auth, ersteFassung);
    const ko = await koMitQuelle(services, "RESYNC-KONFLIKT");

    // Fehlerausgangslage wie im Abbruchtest: Fassung 2 ist bereits mit Text A festgeschrieben.
    const textA = anker("RESYNC-KONFLIKT", 2, "Text A", "vertraulich");
    await services.externalSources.insertIfAbsent({
      sourceRecordId: "rev-2-text-a",
      sourceSystem: "confluence",
      externalId: "RESYNC-KONFLIKT",
      sourceVersion: 2,
      url: QUELL_URL,
      title: textA.title,
      rawOrRenderedContentReference: null,
      importedAt: "2026-10-04T08:00:00.000Z",
      contentHash: quellinhaltAbdruck(textA as unknown as ImportItem),
      sourceMetadata: {},
    });
    const vorher = await services.ko.get(ko.id);
    const revisionenVorher = await services.externalSources.listBySource(
      "Confluence",
      "RESYNC-KONFLIKT",
    );

    // R-0143 (main): eingereiht wird ohne Wirkung; der Konflikt fällt bei der Annahme.
    const textB = anker("RESYNC-KONFLIKT", 2, "Text B", "vertraulich");
    const eingereicht = await direktRoh(app, importeur.auth, textB);
    expect(eingereicht.statusCode, eingereicht.body).toBe(200);
    const kandidatB = (eingereicht.json() as Direktantwort).kandidaten[0]?.id;
    const konflikt = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidatB}`,
      headers: controller.auth,
      payload: { action: "accept" },
    });
    expect(konflikt.statusCode, konflikt.body).toBe(409);
    const nachher = await services.ko.get(ko.id);
    const stand = (k: typeof nachher) => ({
      statement: k?.statement,
      confidentiality: k?.confidentiality,
      version: k?.version,
      sources: k?.sources,
    });
    expect(stand(nachher), "die abgelehnte Übernahme hat das Objekt verändert").toEqual(
      stand(vorher),
    );
    expect(nachher?.confidentiality).toBe("intern");
    const revisionenNachher = await services.externalSources.listBySource(
      "Confluence",
      "RESYNC-KONFLIKT",
    );
    expect(revisionenNachher).toEqual(revisionenVorher);

    // Der abgewiesene Kandidat B bleibt offen in der Warteschlange — und solange er offen ist, reiht
    // die Warteschlange dieselbe Quellfassung (RESYNC-KONFLIKT, Fassung 2) idempotent NICHT erneut
    // ein (SCRUM-510 WP3). Der reguläre Weg ist deshalb: B ablehnen, dann Text A einreichen.
    const abgelehnt = await app.inject({
      method: "PUT",
      url: `/api/library/import/candidates/${kandidatB}`,
      headers: controller.auth,
      payload: { action: "reject" },
    });
    expect(abgelehnt.statusCode, abgelehnt.body).toBe(200);
    expect(stand(await services.ko.get(ko.id)), "das Ablehnen hat das Objekt verändert").toEqual(
      stand(vorher),
    );

    // Positive Gegenprobe: der zur Revision passende Text A wird übernommen — samt Einstufung.
    const passend = await direktImportieren(app, importeur.auth, controller.auth, textA);
    expect(passend.koIds).toEqual([ko.id]);
    const fortgeschrieben = await services.ko.get(ko.id);
    expect(fortgeschrieben?.statement).toBe("Text A");
    expect(fortgeschrieben?.confidentiality).toBe("vertraulich");
    expect(fortgeschrieben?.sources[0]?.sourceRecordId).toBe("rev-2-text-a");
  });

  it("K3 · die Kandidatenantworten nennen die Kennung eines unsichtbaren Ziels nicht", () =>
    mitQuellimport(async () => {
      const { app, services, importeur, genannt, controller } = await flaeche("n3k3");
      await direktImportieren(
        app,
        importeur.auth,
        controller.auth,
        anker("SEITE-VERDECKT", 1, "Vertraulich bei A.", "vertraulich"),
      );
      const ko = await koMitQuelle(services, "SEITE-VERDECKT");
      const sieht = await app.inject({
        method: "GET",
        url: `/api/kos/${ko.id}`,
        headers: genannt.auth,
      });
      expect(sieht.statusCode, "VORBEDINGUNG: B sieht das Objekt nicht").toBe(404);

      // B reicht dieselbe Quellenidentität über den echten Parser und die Dateiroute ein.
      const datei = JSON.stringify([{ ...anker("SEITE-VERDECKT", 2, "Von B eingereicht.") }]);
      const eingereicht = await kandidatEinreichen(app, genannt.auth, parseImportItems(datei));
      expect(eingereicht.body, "die Einreichungsantwort nennt die fremde Kennung").not.toContain(
        ko.id,
      );
      const [kandidat] = eingereicht.json() as {
        id: string;
        koId: string | null;
        dublettenbefund?: { ergebnis: string };
      }[];
      expect(kandidat?.dublettenbefund).toEqual({ ergebnis: "pruefung_nicht_moeglich" });

      const listeB = await app.inject({
        method: "GET",
        url: "/api/library/import/candidates",
        headers: genannt.auth,
      });
      expect(listeB.statusCode, listeB.body).toBe(200);
      expect(listeB.body, "die Kandidatenliste nennt die fremde Kennung").not.toContain(ko.id);

      // Positive Gegenprobe: die berechtigte Reviewer-Sicht behält den Treffer.
      const listeReviewer = await app.inject({
        method: "GET",
        url: "/api/library/import/candidates",
        headers: controller.auth,
      });
      expect(listeReviewer.statusCode, listeReviewer.body).toBe(200);
      const fuerReviewer = (
        listeReviewer.json() as { id: string; dublettenbefund?: unknown }[]
      ).find((k) => k.id === kandidat?.id);
      expect(fuerReviewer?.dublettenbefund).toEqual({
        ergebnis: "wiederverwendet",
        treffer: { art: "wissensobjekt", koId: ko.id },
      });
    }, false));
});

// ================================================================================================
// NACHARBEIT 5 (bens Befund zu R-0169) — INTERNE DOKUMENTIDENTITÄT FÜR WORD UND JSON OHNE KENNUNG.
// ================================================================================================
//
// Gemessen wird der SERVERWEG, den der Word-Zusatz und der JSON-Import tatsächlich gehen
// (POST /api/drafts mit origin word_addin, POST /api/drafts/:id/promote, POST /api/library/import,
// Dateiweg über die Kandidatenroute). Was hier NICHT gemessen werden kann: dass Word selbst die
// Kennung in den Dokumenteinstellungen behält (Office-Host) — das bleibt eine Prüfung am echten
// Word-Dokument. Die Ablage- und Lesehelfer des Panels sind unten als reine Funktionen geprüft.

const UUID_FORM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Herkunft = { dokumentId: string; fassung: number; fassungId: string };

async function wordSenden(app: App, wer: Auth, aussage: string, dokumentId?: string) {
  return app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: wer,
    payload: {
      title: "Wartungsanweisung aus Word",
      statement: aussage,
      bodyHtml: `<p>${aussage}</p>`,
      type: "best_practice",
      category: "Wartung",
      confidentiality: "intern",
      origin: "word_addin",
      ...(dokumentId ? { dokumentId } : {}),
    },
  });
}

describe("Nacharbeit 5 — Dokumentakte: Word-Zusatz", () => {
  it("R-0169 · erstes Senden vergibt eine Kennung, jedes weitere eine neue unveränderliche Fassung derselben Akte", async () => {
    const { app, services, importeur } = await flaeche("n5w1");
    const erstes = await wordSenden(app, importeur.auth, "Fassung eins aus dem Dokument.");
    expect(erstes.statusCode, erstes.body).toBe(201);
    const h1 = (erstes.json() as { dokumentHerkunft?: Herkunft }).dokumentHerkunft;
    expect(h1?.dokumentId, "der Word-Entwurf trägt keine Dokumentkennung").toMatch(UUID_FORM);
    expect(h1?.fassung).toBe(1);
    // Die Kennung ist keine Ableitung des Inhalts: derselbe Text aus einem ANDEREN Dokument
    // (ohne mitgebrachte Kennung) ist eine andere Akte.
    const fremd = await wordSenden(app, importeur.auth, "Fassung eins aus dem Dokument.");
    const hFremd = (fremd.json() as { dokumentHerkunft?: Herkunft }).dokumentHerkunft;
    expect(hFremd?.dokumentId).not.toBe(h1?.dokumentId);

    const dokumentId = h1?.dokumentId ?? "";
    const fassung1Vorher = await services.dokumente.fassungById(h1?.fassungId ?? "");
    expect(fassung1Vorher).toMatchObject({
      dokumentId,
      fassung: 1,
      weg: "word_addin",
      festgeschriebenVon: importeur.id,
    });

    const zweites = await wordSenden(app, importeur.auth, "Überarbeitete Fassung.", dokumentId);
    expect(zweites.statusCode, zweites.body).toBe(201);
    const h2 = (zweites.json() as { dokumentHerkunft?: Herkunft }).dokumentHerkunft;
    expect(h2).toMatchObject({ dokumentId, fassung: 2 });
    expect(h2?.fassungId).not.toBe(h1?.fassungId);

    // Derselbe Stand noch einmal ist keine neue Fassung.
    const drittes = await wordSenden(app, importeur.auth, "Überarbeitete Fassung.", dokumentId);
    expect((drittes.json() as { dokumentHerkunft?: Herkunft }).dokumentHerkunft).toMatchObject({
      dokumentId,
      fassung: 2,
    });

    const fassungen = await services.dokumente.fassungen(dokumentId);
    expect(fassungen.map((f) => f.fassung)).toEqual([1, 2]);
    expect(fassungen[0], "die erste Fassung hat sich verändert").toEqual(fassung1Vorher);
  });

  it("R-0169 · eine hier nicht vergebene Kennung wird abgewiesen — weder übernommen noch neu angelegt", async () => {
    const { app, services, importeur } = await flaeche("n5w2");
    const vorher = (await services.capture.listDrafts()).length;
    const fremdeKennung = "0d6f3a52-1c2b-4e7a-9f10-123456789abc";
    const res = await wordSenden(app, importeur.auth, "Mit erfundener Kennung.", fremdeKennung);
    expect(res.statusCode, res.body).toBe(400);
    expect((res.json() as { error: string }).error).toBe("DOKUMENT_UNBEKANNT");
    expect((await services.capture.listDrafts()).length, "es entstand trotzdem ein Entwurf").toBe(
      vorher,
    );
    expect(await services.dokumente.fassungen(fremdeKennung)).toEqual([]);
  });

  it("R-0169 · das eingereichte Wissensobjekt nennt die Fassung, aus der seine Aussage stammt", async () => {
    const { app, services, importeur } = await flaeche("n5w3");
    const erstes = await wordSenden(app, importeur.auth, "Erste Fassung.");
    const dokumentId = (erstes.json() as { dokumentHerkunft: Herkunft }).dokumentHerkunft
      .dokumentId;
    const zweites = await wordSenden(app, importeur.auth, "Zweite Fassung.", dokumentId);
    const entwurf = zweites.json() as { id: string; dokumentHerkunft: Herkunft };

    const eingereicht = await app.inject({
      method: "POST",
      url: `/api/drafts/${entwurf.id}/promote`,
      headers: importeur.auth,
      payload: {},
    });
    expect(eingereicht.statusCode, eingereicht.body).toBe(201);
    const koId = (eingereicht.json() as { id: string }).id;
    const ko = await services.ko.get(koId);
    expect(ko?.dokumentHerkunft).toEqual(entwurf.dokumentHerkunft);
    expect(ko?.origin).toBe("word_addin");
    const [v1] = await services.ko.versionsOf(koId);
    expect(v1?.snapshot.statement).toBe("Zweite Fassung.");
    expect(v1?.snapshot.dokumentHerkunft).toMatchObject({ dokumentId, fassung: 2 });
  });

  it("R-0169 · die öffentlichen Schreibwege setzen keinen Fassungsbezug", async () => {
    const { app, services, importeur } = await flaeche("n5w4");
    const angelegt = await wordSenden(app, importeur.auth, "Echte Fassung.");
    const echt = (angelegt.json() as { dokumentHerkunft: Herkunft }).dokumentHerkunft;
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: importeur.auth,
      payload: {
        title: "Frei erfasst",
        statement: "Behauptet eine Dokumentfassung.",
        type: "best_practice",
        category: "Anlage 1",
        confidentiality: "intern",
        dokumentHerkunft: echt,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(await services.ko.get((res.json() as { id: string }).id)).not.toHaveProperty(
      "dokumentHerkunft",
    );
  });

  it("Panel-Helfer: Kennung nur mitschicken, wenn vorhanden; nur eine Serverkennung zurücklesen", () => {
    const rumpf = JSON.stringify({ title: "t", statement: "s", origin: "word_addin" });
    expect(mitDokumentkennung(rumpf, null)).toBe(rumpf);
    expect(mitDokumentkennung(rumpf, "  ")).toBe(rumpf);
    expect(JSON.parse(mitDokumentkennung(rumpf, "abc"))).toEqual({
      title: "t",
      statement: "s",
      origin: "word_addin",
      dokumentId: "abc",
    });
    expect(dokumentkennungAusAntwort({ id: "d", dokumentHerkunft: { dokumentId: "k" } })).toBe("k");
    expect(dokumentkennungAusAntwort({ id: "d" })).toBeNull();
    expect(dokumentkennungAusAntwort(null)).toBeNull();
  });
});

describe("Nacharbeit 5 — Dokumentakte: JSON ohne externalId", () => {
  const eintrag = (aussage: string, extra: Record<string, unknown> = {}) => ({
    title: `Akteneintrag ${aussage}`,
    statement: aussage,
    type: "technik",
    category: "Wartung",
    confidentiality: "intern",
    ...extra,
  });

  it("R-0169 · direkter Eingang (eingereiht, angenommen): neue Akte, nächste Fassung über die mitgebrachte Kennung, Aussage je Fassung", async () => {
    const { app, services, importeur, controller } = await flaeche("n5j1");
    const erste = await direktImportieren(
      app,
      importeur.auth,
      controller.auth,
      eintrag("Stand eins."),
    );
    const ko1 = await services.ko.get(erste.koIds[0] ?? "");
    const h1 = ko1?.dokumentHerkunft;
    expect(h1?.dokumentId, "das angenommene Objekt trägt keine vergebene Kennung").toMatch(
      UUID_FORM,
    );
    expect(h1?.fassung).toBe(1);
    expect(ko1?.sources, "die interne Kennung wurde als externe Quelle ausgegeben").toEqual([]);

    const zweite = await direktImportieren(
      app,
      importeur.auth,
      controller.auth,
      eintrag("Stand zwei.", { dokumentId: h1?.dokumentId }),
    );
    const ko2 = await services.ko.get(zweite.koIds[0] ?? "");
    expect(ko2?.statement).toBe("Stand zwei.");
    expect(ko2?.dokumentHerkunft).toMatchObject({ dokumentId: h1?.dokumentId, fassung: 2 });
    // Die erste Aussage bleibt ihrer Fassung zugeordnet.
    expect((await services.ko.get(ko1?.id ?? ""))?.dokumentHerkunft?.fassung).toBe(1);
    // Festgeschrieben bei der ANNAHME — vom Annehmenden, auf dem Kandidatenweg.
    const fassungen = await services.dokumente.fassungen(h1?.dokumentId ?? "");
    expect(fassungen.map((f) => [f.fassung, f.weg, f.festgeschriebenVon])).toEqual([
      [1, "import_candidate", controller.id],
      [2, "import_candidate", controller.id],
    ]);
  });

  it("R-0169 · unbekannte Kennung: 400, kein Objekt; externe Kennung wird nie zur internen", async () => {
    const { app, services, importeur, controller } = await flaeche("n5j2");
    const vorher = (await services.ko.list()).length;
    const res = await direktRoh(
      app,
      importeur.auth,
      eintrag("Fremd.", { dokumentId: "11111111-2222-4333-8444-555555555555" }),
    );
    expect(res.statusCode, res.body).toBe(400);
    expect((res.json() as { error: string }).error).toBe("DOKUMENT_UNBEKANNT");
    expect((await services.ko.list()).length).toBe(vorher);

    // Mit externer Kennung bleibt es beim externen Revisionsweg — keine interne Akte.
    const extern = anker("SEITE-EXTERN-N5", 1, "Extern.");
    await direktImportieren(app, importeur.auth, controller.auth, extern);
    const ko = await koMitQuelle(services, "SEITE-EXTERN-N5");
    expect(ko).not.toHaveProperty("dokumentHerkunft");
  });

  it("R-0169 · Dateiweg: parseImportItems → Kandidat → Annahme legt die Akte an; die Datei mit Kennung schreibt Fassung 2", () =>
    mitQuellimport(async () => {
      const { app, services, importeur, controller } = await flaeche("n5j3");
      const annehmen = async (items: unknown[]) => {
        const res = await kandidatEinreichen(app, importeur.auth, items);
        const kandidatId = (res.json() as { id: string }[])[0]?.id;
        const angenommen = await app.inject({
          method: "PUT",
          url: `/api/library/import/candidates/${kandidatId}`,
          headers: controller.auth,
          payload: { action: "accept" },
        });
        expect(angenommen.statusCode, angenommen.body).toBe(200);
        return services.ko.get((angenommen.json() as { koId: string }).koId);
      };
      const ko1 = await annehmen(parseImportItems(JSON.stringify([eintrag("Datei Stand eins.")])));
      const h1 = ko1?.dokumentHerkunft;
      expect(h1?.dokumentId).toMatch(UUID_FORM);
      expect(h1?.fassung).toBe(1);
      expect(await services.dokumente.fassungById(h1?.fassungId ?? "")).toMatchObject({
        weg: "import_candidate",
        festgeschriebenVon: controller.id,
      });

      const datei2 = JSON.stringify([eintrag("Datei Stand zwei.", { dokumentId: h1?.dokumentId })]);
      const items2 = parseImportItems(datei2);
      expect(items2[0]?.dokumentId).toBe(h1?.dokumentId);
      const ko2 = await annehmen(items2);
      expect(ko2?.dokumentHerkunft).toMatchObject({ dokumentId: h1?.dokumentId, fassung: 2 });

      // Eine nicht vergebene Kennung kommt gar nicht erst in die Warteschlange.
      const fremd = await app.inject({
        method: "POST",
        url: "/api/library/import/candidates",
        headers: importeur.auth,
        payload: {
          items: [eintrag("Fremd.", { dokumentId: "11111111-2222-4333-8444-555555555555" })],
        },
      });
      expect(fremd.statusCode, fremd.body).toBe(400);
    }, false));

  it("DokumentaktenService · eine mitgebrachte Kennung muss hier vergeben sein", async () => {
    const dokumente = new DokumentaktenService({ repo: new InMemoryDokumentaktenRepo() });
    await expect(
      dokumente.festschreiben({
        dokumentId: "11111111-2222-4333-8444-555555555555",
        inhalt: { title: "t", statement: "s" },
        weg: "library_import",
        actor: "u1",
      }),
    ).rejects.toMatchObject({ code: "DOKUMENT_UNBEKANNT" });
    const neu = await dokumente.festschreiben({
      inhalt: { title: "t", statement: "s" },
      weg: "library_import",
      actor: "u1",
    });
    expect(await dokumente.bekannt(neu.dokumentId)).toBe(true);
    expect(await dokumente.bekannt("kein-uuid")).toBe(false);
  });
});

// ================================================================================================
// NACHARBEIT 8 (bens F2) — DIE WIEDERHOLUNG EINES WORD-VORGANGS NACH GESCHEITERTER FASSUNGSBINDUNG.
// ================================================================================================

describe("Nacharbeit 8 — Word-Vorgang: fehlgeschlagene Fassungsbindung wird bei der Wiederholung vervollständigt", () => {
  it("R-0169 · erster Versuch scheitert nach der Anlage, die Wiederholung bindet, weitere Wiederholungen ändern nichts", async () => {
    const { app, services, importeur } = await flaeche("n8w1");
    const dienst = services.dokumente;
    const echt = dienst.festschreiben.bind(dienst);
    let ausfallen = true;
    dienst.festschreiben = async (eingabe: Parameters<typeof echt>[0]) => {
      if (ausfallen) {
        ausfallen = false;
        throw new Error("Testausfall der Dokumentakte");
      }
      return echt(eingabe);
    };
    const senden = () =>
      app.inject({
        method: "POST",
        url: "/api/drafts",
        headers: importeur.auth,
        payload: {
          title: "Wartungsanweisung aus Word",
          statement: "Vorgang mit Ausfall.",
          bodyHtml: "<p>Vorgang mit Ausfall.</p>",
          type: "best_practice",
          category: "Wartung",
          confidentiality: "intern",
          origin: "word_addin",
          operationId: "word-vorgang-n8",
        },
      });

    // 1. Der Entwurf entsteht, das Festschreiben scheitert — KEIN Erfolg wird gemeldet.
    const erster = await senden();
    expect(erster.statusCode, erster.body).toBeGreaterThanOrEqual(500);
    const angelegt = (await services.capture.listDrafts()).filter(
      (d) => d.createOperation?.id === "word-vorgang-n8",
    );
    expect(angelegt, "der Vorgang hat keinen Entwurf hinterlassen").toHaveLength(1);
    expect(angelegt[0]?.dokumentHerkunft).toBeUndefined();

    // 2. Dieselbe Anfrage noch einmal: derselbe Entwurf, jetzt MIT auflösbarem Fassungsbezug.
    const zweiter = await senden();
    expect(zweiter.statusCode, zweiter.body).toBe(200);
    const entwurf = zweiter.json() as { id: string; dokumentHerkunft?: Herkunft };
    expect(entwurf.id).toBe(angelegt[0]?.id);
    const herkunft = entwurf.dokumentHerkunft;
    expect(herkunft, "die Wiederholung lieferte den ungebundenen Entwurf").toBeDefined();
    expect(await services.dokumente.fassungById(herkunft?.fassungId ?? "")).toMatchObject({
      dokumentId: herkunft?.dokumentId,
      fassung: 1,
      weg: "word_addin",
    });
    expect((await services.capture.getDraft(entwurf.id))?.dokumentHerkunft).toEqual(herkunft);

    // 3. Weitere Wiederholungen: dieselbe Bindung, keine zusätzliche Akte oder Fassung.
    const dritter = await senden();
    expect(dritter.statusCode, dritter.body).toBe(200);
    expect((dritter.json() as { dokumentHerkunft?: Herkunft }).dokumentHerkunft).toEqual(herkunft);
    expect(await services.dokumente.fassungen(herkunft?.dokumentId ?? "")).toHaveLength(1);
    expect(
      (await services.capture.listDrafts()).filter(
        (d) => d.createOperation?.id === "word-vorgang-n8",
      ),
    ).toHaveLength(1);

    // 4. Promote: Wissensobjekt und v1-Schnappschuss tragen genau diesen Bezug.
    const eingereicht = await app.inject({
      method: "POST",
      url: `/api/drafts/${entwurf.id}/promote`,
      headers: importeur.auth,
      payload: {},
    });
    expect(eingereicht.statusCode, eingereicht.body).toBe(201);
    const koId = (eingereicht.json() as { id: string }).id;
    expect((await services.ko.get(koId))?.dokumentHerkunft).toEqual(herkunft);
    const [v1] = await services.ko.versionsOf(koId);
    expect(v1?.snapshot.dokumentHerkunft).toEqual(herkunft);
  });
});
