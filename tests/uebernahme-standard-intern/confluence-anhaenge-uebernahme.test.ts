// ==================================================================================================
// R-0163 — ZU EINER ÜBERNOMMENEN CONFLUENCE-SEITE GEHÖREN IHRE ANHÄNGE UND BILDER.
// ==================================================================================================
//
// Bis hierher las der Importeur nur Text, Version, Schlagworte und Elternkette; die Anhänge blieben
// in Confluence. Dieser Test misst die KETTE bis zum angelegten Wissensobjekt — dieselbe Haltung
// wie `confluence-ohne-beschraenkung-ist-intern.test.ts` daneben: ein Test nur am Mapper wäre grün,
// während am Objekt nichts ankommt.
//
//   Mapper-Item (mit Anhängen) → Review-Queue → `accept` → Wissensobjekt
//   → Übernahmeweg der Kompositionswurzel → Objektspeicher → Anhang am Objekt.
//
// Der Adapter ist hier ein Doppel NUR für die Bytes (`fetchAttachment`); Liste, Download-Auflösung
// und Origin-Pin misst `services/confluence/src/anhaenge.test.ts` am echten Client.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { confluenceAnhangsUebernahme } from "../../services/app/src/confluence-anhaenge";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
import { makeGuards } from "../../services/app/src/http";
import {
  confluenceImportRoutes,
  warteAufOffeneImportLaeufe,
} from "../../services/app/src/routes/confluence-import-routes";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import {
  type EvidenceRecord,
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryUploadLimitsRepo,
  KoService,
} from "../../services/knowledge-object";
import { InMemoryImportRunRepo, LibraryService } from "../../services/library-analytics";
import { leseImportAnhaenge } from "../../services/library-analytics/src/service";
import { InMemoryObjectRepo, ObjectStore } from "../../services/object-store";
import { adapterFromConfig } from "../support/confluence-adapter";

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };

const seite = (version: number, restringiert = false): ConfluencePage => ({
  id: "3001",
  title: "Pumpenwartung",
  body: {
    storage: {
      value: '<p>Siehe Plan.</p><ac:image><ri:attachment ri:filename="plan.png"/></ac:image>',
    },
  },
  version: { number: version },
  _links: { webui: "/spaces/K/pages/3001/Pumpenwartung" },
  ...(restringiert
    ? { restrictions: { read: { restrictions: { user: { results: [{ x: 1 }] } } } } }
    : {}),
});

const ANHAENGE = [
  {
    id: "a-plan",
    title: "plan.png",
    extensions: { mediaType: "image/png", fileSize: 4 },
    _links: { download: "/download/attachments/3001/plan.png?api=v2" },
  },
  {
    id: "a-pdf",
    title: "Wartung.pdf",
    extensions: { mediaType: "application/pdf", fileSize: 4 },
    _links: { download: "/download/attachments/3001/Wartung.pdf?api=v2" },
  },
];

const BYTES: Record<string, Buffer> = {
  "/download/attachments/3001/plan.png?api=v2": Buffer.from("PNG!"),
  "/download/attachments/3001/Wartung.pdf?api=v2": Buffer.from("%PDF"),
};

function aufbau(opts: { mitWeg?: boolean; maxAttachments?: number } = {}) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const objects = new ObjectStore({ repo: new InMemoryObjectRepo() });
  const uploadLimits = new InMemoryUploadLimitsRepo();
  const abrufe: string[] = [];
  const adapter = {
    fetchAttachment: async (abruf: string) => {
      abrufe.push(abruf);
      const bytes = BYTES[abruf];
      if (!bytes) {
        throw new Error("unbekannt");
      }
      return { bytes };
    },
  };
  const library = new LibraryService({
    koService,
    audit,
    externalUpsert: true,
    ...(opts.mitWeg === false
      ? {}
      : {
          anhaenge: confluenceAnhangsUebernahme({
            ko: koService,
            objects,
            uploadLimits,
            makeAdapter: () => adapter,
          }),
        }),
  });
  return { koService, audit, objects, uploadLimits, library, abrufe, aktiviert: false };
}

async function uebernimm(
  ctx: ReturnType<typeof aufbau>,
  page: ConfluencePage,
  anhaenge: typeof ANHAENGE,
) {
  if (!ctx.aktiviert) {
    await ctx.koService.activateSearchProjectionV2();
    ctx.aktiviert = true;
  }
  const item = mapConfluencePageToImportItem(page, OPTS, {
    attachments: anhaenge,
    unvollstaendig: false,
  });
  const [kandidat] = await ctx.library.createImportCandidates([item], "importeur");
  const ergebnis = await ctx.library.reviewImportCandidate(kandidat!.id, "accept", "reviewerin");
  const ko = await ctx.koService.get(ergebnis.koId!);
  expect(ko, "Der Accept legt ein Wissensobjekt an — sonst misst der Fall nichts.").toBeDefined();
  return ko!;
}

describe("R-0163 · Anhänge und Bilder einer übernommenen Confluence-Seite", () => {
  it("U1 · die Anhangsangaben überleben die Review-Queue unverändert (fremdes Feld am Item)", async () => {
    const ctx = aufbau();
    await ctx.koService.activateSearchProjectionV2();
    const item = mapConfluencePageToImportItem(seite(1), OPTS, {
      attachments: ANHAENGE,
      unvollstaendig: false,
    });
    const [kandidat] = await ctx.library.createImportCandidates([item], "importeur");
    expect(leseImportAnhaenge(kandidat!.item).map((a) => a.name)).toEqual([
      "plan.png",
      "Wartung.pdf",
    ]);
  });

  it("U2 · nach dem accept trägt das Wissensobjekt Bild UND Datei, beide im Objektspeicher", async () => {
    const ctx = aufbau();
    const ko = await uebernimm(ctx, seite(1), ANHAENGE);

    expect(ko.attachments.map((a) => [a.name, a.mime])).toEqual([
      ["plan.png", "image/png"],
      ["Wartung.pdf", "application/pdf"],
    ]);
    for (const anhang of ko.attachments) {
      expect(anhang.objectId, "Referenz in den Objektspeicher, kein Inline-Inhalt").toBeTruthy();
      // Hochladender und Handelnder ist der Annehmende — nie der Quellautor.
      expect(anhang.author).toBe("reviewerin");
      const gespeichert = await ctx.objects.read(anhang.objectId!);
      expect(gespeichert?.ref.lifecycle?.purpose).toBe("attachment");
      expect(gespeichert?.ref.lifecycle?.owner).toBe("reviewerin");
      // Der Anhang erbt die Stufe seines Objekts (offene Seite → intern).
      expect(gespeichert?.ref.confidentiality).toBe("intern");
    }
    const png = await ctx.objects.read(ko.attachments[0]!.objectId!);
    expect(png?.data).toBe(`data:image/png;base64,${Buffer.from("PNG!").toString("base64")}`);
  });

  it("U3 · eine restringierte Seite: die Anhänge werden vertraulich abgelegt", async () => {
    const ctx = aufbau();
    const ko = await uebernimm(ctx, seite(1, true), ANHAENGE);
    expect(ko.confidentiality).toBe("vertraulich");
    const gespeichert = await ctx.objects.read(ko.attachments[0]!.objectId!);
    expect(gespeichert?.ref.confidentiality).toBe("vertraulich");
  });

  it("U4 · Re-Sync derselben Seite legt vorhandene Anhänge nicht doppelt an, neue kommen dazu", async () => {
    const ctx = aufbau();
    const erst = await uebernimm(ctx, seite(1), [ANHAENGE[0]!]);
    expect(erst.attachments.map((a) => a.name)).toEqual(["plan.png"]);

    const danach = await uebernimm(ctx, seite(2), ANHAENGE);
    expect(danach.id).toBe(erst.id);
    expect(danach.attachments.map((a) => a.name)).toEqual(["plan.png", "Wartung.pdf"]);
    // plan.png wurde genau einmal geholt.
    expect(ctx.abrufe.filter((a) => a.includes("plan.png"))).toHaveLength(1);
  });

  it("U5 · die geltende Anzahlgrenze wird eingehalten; der Rest steht als fehlgeschlagen im Audit", async () => {
    const ctx = aufbau();
    await ctx.uploadLimits.set({ maxAttachments: 1, maxAttachmentBytes: 20_000_000 });
    const ko = await uebernimm(ctx, seite(1), ANHAENGE);
    expect(ko.attachments).toHaveLength(1);
    const [eintrag] = await ctx.audit.list({ action: "import.attachments", target: ko.id });
    expect(eintrag?.payload).toMatchObject({ gemeldet: 2, uebernommen: 1, fehlgeschlagen: 1 });
  });

  it("U6 · ohne Übernahmeweg entsteht das Wissensobjekt trotzdem — und das Audit sagt, dass nichts übernommen wurde", async () => {
    const ctx = aufbau({ mitWeg: false });
    const ko = await uebernimm(ctx, seite(1), ANHAENGE);
    expect(ko.attachments).toEqual([]);
    const [eintrag] = await ctx.audit.list({ action: "import.attachments", target: ko.id });
    expect(eintrag?.payload).toMatchObject({
      gemeldet: 2,
      uebernommen: 0,
      fehlgeschlagen: 2,
      ohneUebernahmeweg: true,
    });
  });

  it("U7 · ein scheiternder Download kostet nur diesen Anhang, nicht die Annahme", async () => {
    const ctx = aufbau();
    const kaputt = [
      ANHAENGE[0]!,
      { ...ANHAENGE[1]!, _links: { download: "/download/attachments/3001/fehlt.pdf" } },
    ];
    const ko = await uebernimm(ctx, seite(1), kaputt);
    expect(ko.attachments.map((a) => a.name)).toEqual(["plan.png"]);
    const [eintrag] = await ctx.audit.list({ action: "import.attachments", target: ko.id });
    expect(eintrag?.payload).toMatchObject({ uebernommen: 1, fehlgeschlagen: 1 });
  });
});

// ==================================================================================================
// BEN, NACHARBEIT 2 — DER REGULÄRE BEREICHSIMPORT, OHNE ABKÜRZUNG.
// ==================================================================================================
//
// U1–U7 setzen die Anhangsliste direkt per Mapper an das Item. Der Weg, den ein Admin wirklich
// nimmt (POST /api/admin/import/confluence → `runConfluenceImport`), sammelt aber über
// `collectAll` — und das las bis hierher keine Anhänge: der Kandidat trug weder `attachments`
// noch `attachmentsIncomplete`, die Annahme legte nichts an und schrieb kein Anhangsaudit.
//
// Diese Gegenprobe fährt die ganze Kette mit dem ECHTEN Adapter (`adapterFromConfig`, nur `fetch`
// ist injiziert): Space-Liste → Anhangsliste → Review-Queue → reguläre Annahme → Download →
// Objektspeicher. Nichts wird vorab in die Queue gesetzt.
const BASIS = "https://acme.atlassian.net/wiki";
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_BYTES = Buffer.from("%PDF-1.4 Wartung", "utf8");

function antwort(status: number, body: unknown, bytes?: Buffer): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    arrayBuffer: async () => {
      const b = bytes ?? Buffer.alloc(0);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    },
  } as unknown as Response;
}

function confluenceFixture() {
  const rufe: string[] = [];
  const fetchFn = async (eingabe: string | URL | Request): Promise<Response> => {
    const url = new URL(String(eingabe));
    rufe.push(url.pathname);
    if (url.pathname === "/wiki/rest/api/content/3001/child/attachment") {
      return antwort(200, { results: ANHAENGE });
    }
    if (url.pathname === "/wiki/download/attachments/3001/plan.png") {
      return antwort(200, null, PNG_BYTES);
    }
    if (url.pathname === "/wiki/download/attachments/3001/Wartung.pdf") {
      return antwort(200, null, PDF_BYTES);
    }
    if (url.pathname === "/wiki/rest/api/content" && url.searchParams.get("spaceKey") === "K") {
      return antwort(200, { results: [seite(1)] });
    }
    return antwort(404, null);
  };
  const adapter = adapterFromConfig({
    baseUrl: BASIS,
    email: "svc@acme.example",
    apiToken: "read-only-tok-123",
    spaceKey: "K",
    fetchFn: fetchFn as unknown as typeof fetch,
  });
  return { adapter, rufe };
}

describe("R-0163 · Bereichsimport über runConfluenceImport (Ben, Nacharbeit 2)", () => {
  it("B1 · Seite mit Bild und PDF: eingereiht, regulär angenommen, beide Anhänge mit exakten Bytes im Objektspeicher", async () => {
    const { adapter, rufe } = confluenceFixture();
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const objects = new ObjectStore({ repo: new InMemoryObjectRepo() });
    const library = new LibraryService({
      koService,
      audit,
      externalUpsert: true,
      anhaenge: confluenceAnhangsUebernahme({
        ko: koService,
        objects,
        uploadLimits: new InMemoryUploadLimitsRepo(),
        makeAdapter: () => adapter,
      }),
    });

    const lauf = await runConfluenceImport({
      adapter,
      library,
      koService,
      dryRun: false,
      actor: "admin",
    });
    expect(lauf.imported).toBe(1);

    const [kandidat] = await library.listImportCandidates();
    expect(kandidat, "der Bereichsimport hat die Seite eingereiht").toBeDefined();
    // Der eingereihte Kandidat trägt die Anhänge aus dem Import selbst — nicht aus dem Test.
    expect(leseImportAnhaenge(kandidat!.item).map((a) => a.name)).toEqual([
      "plan.png",
      "Wartung.pdf",
    ]);

    const ergebnis = await library.reviewImportCandidate(kandidat!.id, "accept", "reviewerin");
    const ko = await koService.get(ergebnis.koId!);
    expect(ko?.attachments.map((a) => [a.name, a.mime])).toEqual([
      ["plan.png", "image/png"],
      ["Wartung.pdf", "application/pdf"],
    ]);

    const erwartet = [
      { mime: "image/png", bytes: PNG_BYTES },
      { mime: "application/pdf", bytes: PDF_BYTES },
    ];
    for (const [i, anhang] of (ko?.attachments ?? []).entries()) {
      expect(anhang.objectId, "Referenz in den Objektspeicher").toBeTruthy();
      const gespeichert = await gespeicherteDaten(objects, anhang.objectId!);
      const soll = erwartet[i]!;
      expect(gespeichert).toBe(`data:${soll.mime};base64,${soll.bytes.toString("base64")}`);
      const roh = Buffer.from(gespeichert!.split(",")[1]!, "base64");
      expect(roh.equals(soll.bytes), "exakt dieselben Bytes wie in Confluence").toBe(true);
    }

    const [eintrag] = await audit.list({ action: "import.attachments", target: ko!.id });
    expect(eintrag?.payload).toMatchObject({
      gemeldet: 2,
      uebernommen: 2,
      vorhanden: 0,
      fehlgeschlagen: 0,
    });
    // Der Bereichsimport hat die Anhangsliste wirklich bei Confluence gelesen.
    expect(rufe).toContain("/wiki/rest/api/content/3001/child/attachment");
  });

  it("B2 · ein Probelauf (dryRun) liest keine Anhänge und reiht nichts ein", async () => {
    const { adapter, rufe } = confluenceFixture();
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.activateSearchProjectionV2();
    const library = new LibraryService({ koService, externalUpsert: true });

    const lauf = await runConfluenceImport({
      adapter,
      library,
      koService,
      dryRun: true,
      actor: "admin",
    });
    expect(lauf.imported).toBe(1);
    expect(await library.listImportCandidates()).toEqual([]);
    expect(rufe).not.toContain("/wiki/rest/api/content/3001/child/attachment");
  });
});

async function gespeicherteDaten(objects: ObjectStore, id: string): Promise<string | undefined> {
  return (await objects.read(id))?.data;
}

// ==================================================================================================
// BEN, NACHARBEIT 3 — DIE DREI HISTORISCHEN ANHANGSFEHLER (beleg:851c4003 / beleg:2def0ac2,
// jeweils Befunde 1–3), am regulären Bereichsimport einer BEREITS IMPORTIERTEN Seite gleicher
// Version:
//   N1 · Die Quelle liefert `results:[{id:'a1'}]` (ohne Titel, ohne Abrufweg). Bisher: removed a1,
//        synced:true. Soll: Bestand bleibt, Seite und Lauf sind unvollständig.
//   N2 · Nur der Abrufweg ändert sich. Bisher: skipped, gespeichert blieb der alte Weg. Soll: der
//        gespeicherte Abrufweg wird nachgezogen.
//   N3 · Eine neue Anhangsversion trifft auf einen Speicherfehler. Bisher: failed:0,
//        „unverändert (idempotent)", COMPLETED. Soll: Altbestand bleibt, die Seite ist gescheitert,
//        und der GESPEICHERTE Lauf ist PARTIAL mit SOURCE_SYNC_INCOMPLETE.
// Der Adapter ist echt (`adapterFromConfig`), nur `fetch` ist injiziert.
// ==================================================================================================
const A1_V1 = {
  id: "a1",
  title: "plan.png",
  extensions: { mediaType: "image/png", fileSize: 8 },
  version: { number: 1 },
  _links: { download: "/download/attachments/3001/plan.png?version=1&api=v2" },
};
const PNG_V2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b]);

/**
 * Nacharbeit 7: die echte Belegablage, mit einem injizierbaren Schreibfehler (Bens Fall „Fehler bei
 * der Belegschreibung NACH erfolgreichem Objekt-Update"). Lesen bleibt immer möglich.
 */
class StoerbareBelege extends InMemoryEvidenceRepo {
  an = false;
  override append(record: EvidenceRecord): Promise<void> {
    if (this.an) {
      return Promise.reject(new Error("BEN_INJECTED_EVIDENCE_FAILURE"));
    }
    return super.append(record);
  }
}

function abgleichAufbau() {
  const zustand: { anhaenge: unknown[]; bytes: Map<string, Buffer> } = {
    anhaenge: [A1_V1],
    bytes: new Map([
      ["/wiki/download/attachments/3001/plan.png", PNG_BYTES],
      ["/wiki/download/attachments/3001/plan-v2.png", PNG_V2],
    ]),
  };
  const fetchFn = async (eingabe: string | URL | Request): Promise<Response> => {
    const url = new URL(String(eingabe));
    if (url.pathname === "/wiki/rest/api/content/3001/child/attachment") {
      return antwort(200, { results: zustand.anhaenge });
    }
    const bytes = zustand.bytes.get(url.pathname);
    if (bytes) {
      return antwort(200, null, bytes);
    }
    if (url.pathname === "/wiki/rest/api/content" && url.searchParams.get("spaceKey") === "K") {
      return antwort(200, { results: [seite(1)] });
    }
    return antwort(404, null);
  };
  const adapter = adapterFromConfig({
    baseUrl: BASIS,
    email: "svc@acme.example",
    apiToken: "read-only-tok-123",
    spaceKey: "K",
    fetchFn: fetchFn as unknown as typeof fetch,
  });
  const belege = new StoerbareBelege();
  const koService = new KoService({ repo: new InMemoryKoRepo(), evidence: belege });
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const objects = new ObjectStore({ repo: new InMemoryObjectRepo() });
  // Der injizierte Speicherfehler (Bens BEN_INJECTED_STORAGE_FAILURE) — am echten Objektspeicher.
  const stoerung = { an: false };
  const library = new LibraryService({
    koService,
    audit,
    externalUpsert: true,
    anhaenge: confluenceAnhangsUebernahme({
      ko: koService,
      objects: {
        put: async (eingabe) => {
          if (stoerung.an) {
            throw new Error("BEN_INJECTED_STORAGE_FAILURE");
          }
          return objects.put(eingabe);
        },
      },
      uploadLimits: new InMemoryUploadLimitsRepo(),
      makeAdapter: () => adapter,
    }),
  });

  /** Erster regulärer Import samt Annahme — danach trägt das Wissensobjekt a1 mit Herkunft. */
  const ersterImport = async () => {
    await koService.activateSearchProjectionV2();
    await runConfluenceImport({ adapter, library, koService, dryRun: false, actor: "admin" });
    const [kandidat] = await library.listImportCandidates();
    const ergebnis = await library.reviewImportCandidate(kandidat!.id, "accept", "reviewerin");
    const ko = await koService.get(ergebnis.koId!);
    // Nur die Voraussetzung „a1 ist am Objekt". Die Herkunft (`quelle`) prüfen N2 und N3 fachlich
    // selbst — stünde sie hier, scheiterte ein Vor-Korrektur-Lauf (cda3ac3b) schon im Aufbau statt
    // an der Assertion, um die es im jeweiligen Fall geht (Bens Befund, Nacharbeit 7).
    expect(ko?.attachments).toHaveLength(1);
    return ko!;
  };
  const zweiterLauf = () =>
    runConfluenceImport({ adapter, library, koService, dryRun: false, actor: "admin" });

  return {
    zustand,
    adapter,
    koService,
    audit,
    objects,
    belege,
    stoerung,
    library,
    ersterImport,
    zweiterLauf,
  };
}

describe("R-0163 · Anhangsabgleich bereits importierter Seiten (Ben, Nacharbeit 3)", () => {
  it("N1 · fehlender Anhangstitel bei gleicher Seitenversion: Bestand bleibt, Seite und Lauf unvollständig", async () => {
    const ctx = abgleichAufbau();
    const vorher = await ctx.ersterImport();
    const objektVorher = vorher.attachments[0]!.objectId;

    ctx.zustand.anhaenge = [{ id: "a1" }];
    const lauf = await ctx.zweiterLauf();

    const nachher = await ctx.koService.get(vorher.id);
    expect(
      nachher?.attachments,
      "a1 bleibt — eine unbrauchbare Liste beweist keine Abwesenheit",
    ).toHaveLength(1);
    expect(nachher?.attachments[0]?.objectId).toBe(objektVorher);
    expect(lauf.failed).toBe(1);
    expect(lauf.perPage[0]).toMatchObject({ ref: "3001", status: "failed" });
    expect(lauf.perPage[0]?.note).toContain("Anhangsliste der Quelle unvollständig");
    expect(lauf.anhangsabgleich?.unvollstaendigeSeiten).toEqual(["3001"]);
    const eintraege = await ctx.audit.list({ action: "import.attachments", target: vorher.id });
    expect(eintraege.at(-1)?.payload).toMatchObject({ listeUnvollstaendig: true });
  });

  it("N2 · nur die Abrufadresse ändert sich: der gespeicherte Abrufweg wird nachgezogen", async () => {
    const ctx = abgleichAufbau();
    const vorher = await ctx.ersterImport();
    const objektVorher = vorher.attachments[0]!.objectId;

    const neuerWeg = "/download/attachments/3001/plan.png?version=1&api=v2&neu=1";
    ctx.zustand.anhaenge = [{ ...A1_V1, _links: { download: neuerWeg } }];
    const lauf = await ctx.zweiterLauf();

    const nachher = await ctx.koService.get(vorher.id);
    expect(nachher?.attachments).toHaveLength(1);
    expect(nachher?.attachments[0]?.quelle?.abruf, "die Herkunft trägt den neuen Abrufweg").toBe(
      neuerWeg,
    );
    // Die Zuordnung lief über die Quellkennung, nicht über den Namen.
    expect(nachher?.attachments[0]?.quelle).toMatchObject({ externalId: "a1", sourceVersion: 1 });
    // Gleiche Anhangsversion → kein neuer Inhalt, nur die Herkunft.
    expect(nachher?.attachments[0]?.objectId).toBe(objektVorher);
    expect(lauf.failed).toBe(0);
    expect(lauf.anhangsabgleich).toMatchObject({ nachgezogen: 1, fehlgeschlagen: 0 });
    expect(lauf.perPage[0]?.note).toContain("1 Abrufweg nachgezogen");
  });

  it("N3 · Speicherfehler beim geänderten Anhang: Altbestand bleibt, Seite gescheitert, gespeicherter Lauf PARTIAL", async () => {
    const ctx = abgleichAufbau();
    const vorher = await ctx.ersterImport();
    const objektVorher = vorher.attachments[0]!.objectId!;

    ctx.zustand.anhaenge = [
      {
        ...A1_V1,
        version: { number: 2 },
        _links: { download: "/download/attachments/3001/plan-v2.png?version=2&api=v2" },
      },
    ];
    ctx.stoerung.an = true;

    // (a) Die Laufbilanz nennt die betroffene Seite und zählt sie als gescheitert.
    const lauf = await ctx.zweiterLauf();
    expect(lauf.failed).toBe(1);
    expect(lauf.perPage[0]).toMatchObject({ ref: "3001", status: "failed" });
    expect(lauf.perPage[0]?.note).toContain("1 Anhang/Anhänge nicht übernommen");
    expect(lauf.anhangsabgleich).toMatchObject({
      fehlgeschlagen: 1,
      ersetzt: 0,
      unvollstaendigeSeiten: ["3001"],
    });

    // (b) Der Altbestand ist unverändert: derselbe Eintrag, derselbe Inhalt, dieselbe Herkunft.
    const nachher = await ctx.koService.get(vorher.id);
    expect(nachher?.attachments).toHaveLength(1);
    expect(nachher?.attachments[0]?.objectId).toBe(objektVorher);
    expect(nachher?.attachments[0]?.quelle?.sourceVersion).toBe(1);
    expect(await gespeicherteDaten(ctx.objects, objektVorher)).toBe(
      `data:image/png;base64,${PNG_BYTES.toString("base64")}`,
    );

    // (c) Der GESPEICHERTE Laufstatus über die echte Importroute mit Laufablage: PARTIAL, mit
    // eigenem Code und Grund — nicht COMPLETED.
    // Wie im Statustest: ohne Importschalter registriert `buildApp` die Importroute NICHT selbst —
    // sie wird gleich mit dem Fixture-Adapter und der Laufablage dieses Falls angemeldet.
    const gesichert = process.env.KLARWERK_CONFLUENCE_IMPORT;
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const services = buildServices();
    const app = buildApp(services);
    if (gesichert !== undefined) {
      process.env.KLARWERK_CONFLUENCE_IMPORT = gesichert;
    }
    const importRuns = new InMemoryImportRunRepo();
    app.register(
      confluenceImportRoutes({
        library: ctx.library,
        koService: ctx.koService,
        guards: makeGuards(services.auth),
        reasoner: services.reasoner,
        makeAdapter: () => ctx.adapter,
        importRuns,
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
    const start = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence",
      headers: { authorization: `Bearer ${login.json().token}` },
      payload: { dryRun: false },
    });
    expect(start.statusCode).toBe(202);
    await warteAufOffeneImportLaeufe(importRuns);
    const gespeichert = await importRuns.findById(start.json().importId);
    expect(gespeichert).toMatchObject({
      status: "PARTIAL",
      failureCode: "SOURCE_SYNC_INCOMPLETE",
      counters: { itemsFailed: 1 },
    });
    expect(gespeichert?.failureReason).toContain("Anhangsabgleich unvollständig für 1 Seite(n)");
    await app.close();
  });

  // ------------------------------------------------------------------------------------------------
  // BEN, NACHARBEIT 7 — DER FEHLER NACH DER OBJEKTÄNDERUNG. N3 oben scheitert VOR jeder Änderung
  // (objects.put). Hier gelingen Ablage und Objektänderung, und erst der Beleg scheitert. Bisher warf
  // `updateAttachment` dann trotzdem, der Port zählte „fehlgeschlagen", und die Seite meldete
  // „vorhandene Anhänge bleiben erhalten" — obwohl der Anhang schon ersetzt war.
  // ------------------------------------------------------------------------------------------------
  it("N3b · Belegfehler nach erfolgreichem Objekt-Update: Anhang ist ersetzt, Beleg offen, Seite unvollständig", async () => {
    const ctx = abgleichAufbau();
    const vorher = await ctx.ersterImport();
    const objektVorher = vorher.attachments[0]!.objectId!;
    const belegeVorher = await ctx.belege.listByKo(vorher.id);
    expect(
      belegeVorher.some((b) => b.kind === "attachment" && b.objectId === objektVorher),
      "der erste Import hat seinen Beleg",
    ).toBe(true);

    ctx.zustand.anhaenge = [
      {
        ...A1_V1,
        version: { number: 2 },
        _links: { download: "/download/attachments/3001/plan-v2.png?version=2&api=v2" },
      },
    ];
    ctx.belege.an = true;
    const lauf = await ctx.zweiterLauf();

    // Inhalt und Herkunft: der Anhang IST ersetzt — derselbe Eintrag, neue Bytes, Version 2.
    const nachher = await ctx.koService.get(vorher.id);
    expect(nachher?.attachments).toHaveLength(1);
    const objektNachher = nachher?.attachments[0]?.objectId;
    expect(objektNachher).toBeTruthy();
    expect(objektNachher).not.toBe(objektVorher);
    expect(nachher?.attachments[0]?.quelle?.sourceVersion).toBe(2);
    expect(await gespeicherteDaten(ctx.objects, objektNachher!)).toBe(
      `data:image/png;base64,${PNG_V2.toString("base64")}`,
    );

    // Beleg: zum neuen Objekt gibt es (noch) keinen.
    const belegeNachher = await ctx.belege.listByKo(vorher.id);
    expect(belegeNachher.some((b) => b.objectId === objektNachher)).toBe(false);

    // Laufbilanz: ersetzt, NICHT fehlgeschlagen — und trotzdem unvollständig, mit ehrlichem Grund.
    expect(lauf.anhangsabgleich).toMatchObject({
      ersetzt: 1,
      fehlgeschlagen: 0,
      belegOffen: 1,
      unvollstaendigeSeiten: ["3001"],
    });
    expect(lauf.failed).toBe(1);
    expect(lauf.perPage[0]).toMatchObject({ ref: "3001", status: "failed" });
    expect(lauf.perPage[0]?.note).toContain("1 Beleg(e) zu übernommenen Anhängen offen");
    expect(lauf.perPage[0]?.note).not.toContain("nicht übernommen");
    const eintraege = await ctx.audit.list({ action: "import.attachments", target: vorher.id });
    expect(eintraege.at(-1)?.payload).toMatchObject({
      ersetzt: 1,
      fehlgeschlagen: 0,
      belegOffen: 1,
    });
  });

  it("N3c · der nächste Lauf trägt den fehlenden Beleg nach — die Teilpersistenz bleibt nicht unbemerkt", async () => {
    const ctx = abgleichAufbau();
    const vorher = await ctx.ersterImport();
    ctx.zustand.anhaenge = [
      {
        ...A1_V1,
        version: { number: 2 },
        _links: { download: "/download/attachments/3001/plan-v2.png?version=2&api=v2" },
      },
    ];
    ctx.belege.an = true;
    await ctx.zweiterLauf();
    const objektNachher = (await ctx.koService.get(vorher.id))?.attachments[0]?.objectId;

    // Die Belegablage ist wieder da; Seite und Anhänge sind unverändert (gleiche Versionen).
    ctx.belege.an = false;
    const lauf = await ctx.zweiterLauf();

    const belege = await ctx.belege.listByKo(vorher.id);
    expect(
      belege.filter((b) => b.kind === "attachment" && b.objectId === objektNachher),
      "genau EIN nachgetragener Beleg zum ersetzten Inhalt",
    ).toHaveLength(1);
    expect(lauf.failed).toBe(0);
    expect(lauf.anhangsabgleich).toMatchObject({ belegNachgetragen: 1, belegOffen: 0 });
    expect(lauf.perPage[0]?.status).toBe("skipped");
    expect(lauf.perPage[0]?.note).toContain("1 Beleg(e) nachgetragen");
    // Ein weiterer Lauf hat nichts mehr nachzutragen.
    const danach = await ctx.zweiterLauf();
    expect(danach.anhangsabgleich?.belegNachgetragen ?? 0).toBe(0);
  });
});
