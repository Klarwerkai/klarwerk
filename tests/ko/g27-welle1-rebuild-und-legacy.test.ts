// ================================================================================================
// G27 WELLE 1 — DETERMINISTISCHER V2-REBUILD UND DIE LEGACY-REKONSTRUKTION
// ================================================================================================
//
// Belegt: Akzeptanzkriterium 8 — deterministischer V2-Rebuild und eine eindeutig als unbestätigt/
// provenienzbehaftet markierte Legacy-Rekonstruktion samt deterministischer `captured_at`-Quelle
// (Detailentscheidung I). Zusätzlich: der V1/V2-Mischbestand wird eindeutig erkannt und nachgeführt,
// ohne historische Content-Projections still zu überschreiben.
import { describe, expect, it } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  type KoSearchProjection,
  KoService,
  SEARCH_PROJECTION_VERSION,
  buildSearchProjection,
  isReconstructedClassification,
  resolveCapturedAt,
} from "../../services/knowledge-object";

const KO_CREATED_AT = "2024-03-01T08:00:00.000Z";

// G27 R1: EINE FRISCHE INSTANZ IST NICHT SUCHBEREIT (Entscheidung 05 §1). Sie steht persistent auf
// `UNINITIALIZED`, und die Standardsuche wirft dort — sie liefert kein stilles `[]`. Der Stapel
// fährt deshalb einmal die vorgeschriebene Folge `UNINITIALIZED → V2_BUILDING → V2_READY →
// V2_ACTIVE`: derselbe vollständige Gate-Lauf wie jede spätere Fassung, nur über einem leeren
// Bestand trivial erfüllt. Das ist KEINE Abkürzung um das Gate herum — die fünf Prüfungen laufen
// wirklich —, sondern die Inbetriebnahme, die eine echte Installation ebenso braucht.
async function stack() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const versions = new InMemoryKoVersionRepo();
  // DIE UHR STEHT STILL — und zwar aus einem gemessenen Grund, nicht aus Vorsicht.
  //
  // Der Determinismus-Fall unten vergleicht `classificationSnapshot.capturedAt` der ursprünglichen
  // Zeile mit dem der wiederhergestellten. Beide Werte entstehen aus `Date.now()` an zwei
  // verschiedenen Punkten desselben Vorgangs; unter Last liegt zwischen ihnen eine Millisekunde,
  // und der Fall wird flatterhaft — er misst dann die Maschine statt die Zusage. Der Dienst nimmt
  // seine Uhr ohnehin injiziert entgegen (dasselbe Muster wie in `trash-e2e`), also wird sie hier
  // festgehalten. Die Zusage selbst ändert sich dadurch nicht: geprüft wird weiterhin, dass Wert,
  // Zeitpunkt und Belastbarkeit gleich bleiben und NUR die Herkunft wechselt.
  const ko = new KoService({
    repo,
    versions,
    searchProjections: projections,
    now: () => Date.parse("2026-08-02T09:00:00.000Z"),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  return { repo, projections, versions, ko };
}

const EINGABE = {
  title: "Spezialpresse SPX9",
  statement: "Kurzfassung.",
  type: "best_practice" as const,
  category: "Wartung",
  author: "anna",
};

function legacyKo(id: string, overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    title: `Alt ${id}`,
    statement: "Aussage.",
    bodyHtml: "<p>Altbestandswort</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Altkategorie",
    tags: ["altschlagwort"],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    createdAt: KO_CREATED_AT,
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Eine Zeile in der ALTEN Projektionsfassung — so, wie sie ein Bestand aus der Zeit vor dieser
// Welle trägt: Fassung 1, Kategorie/Schlagwörter im Inhalt, kein body_text, keine Einstufung.
function v1Zeile(ko: KnowledgeObject, at: string): KoSearchProjection {
  return {
    ...buildSearchProjection(ko, at),
    projectionVersion: 1,
    bodyText: "",
    searchText: `${ko.title}\n${ko.statement}\n${ko.category}\n${(ko.tags ?? []).join(" ")}`,
    contentHash: "v1-hash",
  };
}

describe("G27 Welle 1 · AK8 · der V2-Rebuild ist deterministisch", () => {
  it("zweimal hintereinander gerebuildet ergibt byte-gleiche Zeilen (bis auf updated_at)", async () => {
    const { ko } = await stack();
    const a = await ko.create({ ...EINGABE, bodyHtml: "<p>Rebuildwort</p>" });
    const b = await ko.create({ ...EINGABE, title: "Zweites", bodyHtml: "<p>Anderswort</p>" });

    await ko.rebuildSearchProjections();
    const ersteRunde = [await ko.searchProjectionOf(a.id), await ko.searchProjectionOf(b.id)].map(
      (p) => ({ ...p, updatedAt: "egal" }),
    );

    await ko.rebuildSearchProjections();
    const zweiteRunde = [await ko.searchProjectionOf(a.id), await ko.searchProjectionOf(b.id)].map(
      (p) => ({ ...p, updatedAt: "egal" }),
    );

    expect(zweiteRunde).toEqual(ersteRunde);
  });

  it("bei unverändertem Inhalt liefert der Rebuild exakt denselben content_hash", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: "<p>Rebuildwort</p>" });
    const vorher = await ko.searchProjectionOf(erstellt.id);

    const bilanz = await ko.rebuildSearchProjections();
    expect(bilanz.unveraendert).toBe(1);
    expect(bilanz.v2Migriert).toBe(0);
    expect((await ko.searchProjectionOf(erstellt.id))?.contentHash).toBe(vorher?.contentHash);
  });

  it("`captured_at = now` ist ausgeschlossen: der Rebuild erfindet keinen historischen Zeitpunkt", async () => {
    // Eine gestellte Uhr, damit „damals" und „jetzt" unterscheidbar sind — sonst prüfte der Test
    // nichts (im Speicher liegen Anlage und Rebuild in derselben Millisekunde).
    let uhr = Date.parse("2024-05-01T12:00:00.000Z");
    const repo = new InMemoryKoRepo();
    const ko = new KoService({
      repo,
      versions: new InMemoryKoVersionRepo(),
      searchProjections: new InMemoryKoSearchProjectionRepo(repo),
      now: () => uhr,
    });
    const erstellt = await ko.create({ ...EINGABE });
    const vorher = await ko.searchProjectionOf(erstellt.id);
    expect(vorher?.classificationSnapshot.capturedAt).toBe("2024-05-01T12:00:00.000Z");

    uhr = Date.parse("2026-08-02T00:00:00.000Z");
    await ko.rebuildSearchProjections();

    const nachher = await ko.searchProjectionOf(erstellt.id);
    // Der erfasste Zeitpunkt ist DERSELBE geblieben — nicht der Zeitpunkt des Rebuilds.
    expect(nachher?.classificationSnapshot).toEqual(vorher?.classificationSnapshot);
    expect(nachher?.updatedAt).toBe("2026-08-02T00:00:00.000Z");
    expect(nachher?.classificationSnapshot.capturedAt).toBe("2024-05-01T12:00:00.000Z");
    // Und der Hash hat sich dadurch nicht bewegt.
    expect(nachher?.contentHash).toBe(vorher?.contentHash);
  });

  it("der Rebuild überschreibt eine bestehende V2-Klassifizierung NICHT still", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, confidentiality: "streng_vertraulich" });
    await ko.setConfidentiality(erstellt.id, "intern", "admin", { mayDowngrade: true });

    await ko.rebuildSearchProjections();

    // Die historische Aussage bleibt „streng_vertraulich", obwohl das Objekt heute „intern" ist.
    expect((await ko.searchProjectionOf(erstellt.id))?.classificationSnapshot.value).toBe(
      "streng_vertraulich",
    );
    expect((await ko.get(erstellt.id))?.confidentiality).toBe("intern");
  });

  it("der Rebuild stellt eine gelöschte Zeile inhaltlich wieder her und zieht die Metadaten mit", async () => {
    const { ko, projections } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Wiederherstellkategorie" });
    const original = await ko.searchProjectionOf(erstellt.id);
    await projections.removeByKo(erstellt.id);
    expect(await ko.findSearchHits({ terms: ["wiederherstellkategorie"] })).toEqual([]);

    await ko.rebuildSearchProjections();
    const wiederhergestellt = await ko.searchProjectionOf(erstellt.id);

    // DER INHALT ist vollständig und byte-gleich zurück …
    expect(wiederhergestellt?.searchText).toBe(original?.searchText);
    expect(wiederhergestellt?.bodyText).toBe(original?.bodyText);
    expect(wiederhergestellt?.titleText).toBe(original?.titleText);
    expect(wiederhergestellt?.statementText).toBe(original?.statementText);
    expect(wiederhergestellt?.captionText).toBe(original?.captionText);
    expect(wiederhergestellt?.status).toBe(original?.status);
    // … und das Objekt ist wieder auffindbar.
    expect(
      (await ko.findSearchHits({ terms: ["wiederherstellkategorie"] })).map((h) => h.koId),
    ).toEqual([erstellt.id]);

    // ABER DIE BELEGLAGE IST EINE ANDERE — und der Hash sagt das (Detailentscheidung J).
    // Die Originalzeile hat die Einstufung beim Wirksamwerden der Version am lebenden Objekt
    // GELESEN (`captured_at_version`); die zerstörte Zeile ist danach nicht mehr da, und der
    // Rebuild leitet die Aussage aus dem unveränderlichen Versionsstand ab
    // (`ko_version_snapshot`). Wert, Zeitpunkt und Belastbarkeit sind identisch, die HERKUNFT der
    // Aussage nicht. Genau dafür steht `provenance` im Hash: eine append-only Zeile darf ihre
    // Herkunftsangabe nicht still wechseln können, ohne dass ein Prüfwert sich bewegt.
    expect(original?.classificationSnapshot.provenance).toBe("captured_at_version");
    expect(wiederhergestellt?.classificationSnapshot.provenance).toBe("ko_version_snapshot");
    expect(wiederhergestellt?.classificationSnapshot.value).toBe(
      original?.classificationSnapshot.value,
    );
    expect(wiederhergestellt?.classificationSnapshot.capturedAt).toBe(
      original?.classificationSnapshot.capturedAt,
    );
    expect(wiederhergestellt?.classificationSnapshot.historicalConfidence).toBe("verified");
    expect(wiederhergestellt?.contentHash).not.toBe(original?.contentHash);

    // Und die Wiederherstellung ist ihrerseits deterministisch: ein zweiter Rebuild bewegt nichts.
    await ko.rebuildSearchProjections();
    expect({ ...(await ko.searchProjectionOf(erstellt.id)), updatedAt: "egal" }).toEqual({
      ...wiederhergestellt,
      updatedAt: "egal",
    });
  });
});

describe("G27 Welle 1 · AK8 · die deterministische captured_at-Quelle", () => {
  it("die Reihenfolge ist verbindlich und vollständig", () => {
    expect(
      resolveCapturedAt({
        versionEventAt: "2026-01-01T00:00:00.000Z",
        koVersionCreatedAt: "2025-01-01T00:00:00.000Z",
        koCreatedAt: "2024-01-01T00:00:00.000Z",
      }),
    ).toEqual({ capturedAt: "2026-01-01T00:00:00.000Z", capturedAtSource: "version_event" });
    expect(
      resolveCapturedAt({
        koVersionCreatedAt: "2025-01-01T00:00:00.000Z",
        koCreatedAt: "2024-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      capturedAt: "2025-01-01T00:00:00.000Z",
      capturedAtSource: "ko_version_created_at",
    });
    expect(resolveCapturedAt({ koCreatedAt: "2024-01-01T00:00:00.000Z" })).toEqual({
      capturedAt: "2024-01-01T00:00:00.000Z",
      capturedAtSource: "ko_created_at",
    });
    expect(resolveCapturedAt({})).toEqual({ capturedAt: null, capturedAtSource: "unknown" });
  });

  it("MIT unveränderlichem Versionsstand: der Zeitpunkt ist das Versionsereignis und `verified`", async () => {
    const { repo, versions, ko } = await stack();
    const alt = legacyKo("mit-snapshot");
    await repo.insert(alt);
    await versions.append({
      koId: alt.id,
      version: 1,
      snapshot: { ...alt, confidentiality: "vertraulich" },
      at: "2024-03-01T09:30:00.000Z",
      author: "anna",
      note: "erstellt",
    });

    await ko.backfillSearchProjections({ limit: 10 });
    const snapshot = (await ko.searchProjectionOf(alt.id))?.classificationSnapshot;

    expect(snapshot?.value).toBe("vertraulich");
    expect(snapshot?.provenance).toBe("ko_version_snapshot");
    expect(snapshot?.historicalConfidence).toBe("verified");
    expect(snapshot?.capturedAt).toBe("2024-03-01T09:30:00.000Z");
    expect(snapshot?.capturedAtSource).toBe("version_event");
    expect(isReconstructedClassification(snapshot!)).toBe(false);
  });

  it("OHNE Versionsstand: bestverfügbar rekonstruiert, ausdrücklich unbestätigt", async () => {
    const { repo, ko } = await stack();
    await repo.insert(legacyKo("ohne-snapshot", { confidentiality: "vertraulich" }));

    await ko.backfillSearchProjections({ limit: 10 });
    const snapshot = (await ko.searchProjectionOf("ohne-snapshot"))?.classificationSnapshot;

    // Bestverfügbarer Wert — kein `none`, obwohl ein aktueller Wert existiert (No-Go 1).
    expect(snapshot?.value).toBe("vertraulich");
    expect(snapshot?.provenance).toBe("reconstructed_from_current_ko");
    // NIEMALS `verified` für eine Rekonstruktion (No-Go 5).
    expect(snapshot?.historicalConfidence).toBe("unknown");
    // Deterministischer Zeitpunkt aus dem KO — nicht `now` (No-Go 2).
    expect(snapshot?.capturedAt).toBe(KO_CREATED_AT);
    expect(snapshot?.capturedAtSource).toBe("ko_created_at");
    expect(isReconstructedClassification(snapshot!)).toBe(true);
  });

  it("ohne jede Zeitquelle bleibt captured_at null statt geraten", async () => {
    const { repo, ko } = await stack();
    // Ein Altbestand ganz ohne Zeitangabe — die letzte Stufe der deterministischen Kette.
    const { createdAt: _ohneZeitstempel, ...ohneZeit } = legacyKo("ohne-zeit");
    await repo.insert(ohneZeit as unknown as KnowledgeObject);
    await ko.backfillSearchProjections({ limit: 10 });
    const snapshot = (await ko.searchProjectionOf("ohne-zeit"))?.classificationSnapshot;
    expect(snapshot?.capturedAt).toBeNull();
    expect(snapshot?.capturedAtSource).toBe("unknown");
  });

  it("der Legacy-Rebuild bleibt über wiederholte Läufe byte- und hashgleich", async () => {
    // Die Zusage aus Abschnitt J, gemessen NACH dem vollständigen Hashschutz: dass die Beleglage
    // jetzt im `content_hash` steht, macht den Rebuild NICHT wackelig — sie ist eine reine Funktion
    // des Bestands (hier: `created_at` des Objekts), nicht der Uhr des Rebuilds.
    const { repo, ko } = await stack();
    await repo.insert(legacyKo("wiederholt", { confidentiality: "vertraulich" }));
    await ko.backfillSearchProjections({ limit: 10 });
    const erste = await ko.searchProjectionOf("wiederholt");
    expect(erste?.classificationSnapshot.provenance).toBe("reconstructed_from_current_ko");

    await ko.rebuildSearchProjections();
    const zweite = await ko.searchProjectionOf("wiederholt");
    await ko.rebuildSearchProjections();
    const dritte = await ko.searchProjectionOf("wiederholt");

    expect(zweite?.contentHash).toBe(erste?.contentHash);
    expect(dritte?.contentHash).toBe(erste?.contentHash);
    expect({ ...dritte, updatedAt: "egal" }).toEqual({ ...erste, updatedAt: "egal" });
  });

  it("die Rekonstruktion BLOCKIERT den Nachzug nicht — das Objekt ist danach auffindbar", async () => {
    const { repo, ko } = await stack();
    await repo.insert(legacyKo("nicht-blockiert"));
    await ko.backfillSearchProjections({ limit: 10 });
    expect((await ko.findSearchHits({ terms: ["altbestandswort"] })).map((h) => h.koId)).toEqual([
      "nicht-blockiert",
    ]);
    expect((await ko.findSearchHits({ terms: ["altkategorie"] })).map((h) => h.koId)).toEqual([
      "nicht-blockiert",
    ]);
  });
});

describe("G27 Welle 1 · der V1/V2-Mischbestand wird erkannt und nachgeführt", () => {
  it("eine Zeile der Fassung 1 wird ausdrücklich gezählt und auf Fassung 2 gehoben", async () => {
    const { repo, projections, ko } = await stack();
    const alt = legacyKo("misch-1");
    await repo.insert(alt);
    await projections.insert(v1Zeile(alt, "2024-03-01T10:00:00.000Z"));

    const vorher = await ko.searchProjectionVersions();
    expect(vorher.offenV1).toBe(1);
    expect(vorher.geltendeFassung).toBe(SEARCH_PROJECTION_VERSION);

    const bilanz = await ko.backfillSearchProjections({ limit: 10 });
    expect(bilanz.v2Migriert).toBe(1);

    const nachher = await ko.searchProjectionOf("misch-1");
    expect(nachher?.projectionVersion).toBe(2);
    expect(nachher?.bodyText).toBe("Altbestandswort");
    expect(nachher?.classificationSnapshot.provenance).toBe("reconstructed_from_current_ko");
    // `created_at` der Zeile bleibt: sie wurde neu abgeleitet, nicht neu geboren.
    expect(nachher?.createdAt).toBe("2024-03-01T10:00:00.000Z");
    expect((await ko.searchProjectionVersions()).offenV1).toBe(0);
  });

  it("die Fassungsnachführung berührt HISTORISCHE Zeilen nicht", async () => {
    const { repo, projections, ko } = await stack();
    const alt = legacyKo("misch-2", { version: 2 });
    await repo.insert(alt);
    // Eine historische V1-Zeile der Version 1 (nicht die aktive) …
    const historisch = { ...v1Zeile(alt, "2024-03-01T10:00:00.000Z"), koVersion: 1 };
    await projections.insert(historisch);
    // … und die aktive Zeile der Version 2, ebenfalls in Fassung 1.
    await projections.insert(v1Zeile(alt, "2024-03-02T10:00:00.000Z"));

    await ko.backfillSearchProjections({ limit: 10 });

    expect(await ko.searchProjectionOf("misch-2", 1)).toEqual(historisch);
    expect((await ko.searchProjectionOf("misch-2", 2))?.projectionVersion).toBe(2);
    // Der Mischzustand ist dadurch weiterhin sichtbar — und nicht still verschwiegen.
    const bestand = await ko.searchProjectionVersions();
    expect(bestand.zeilen).toEqual([
      { projectionVersion: 1, count: 1 },
      { projectionVersion: 2, count: 1 },
    ]);
    expect(bestand.gemischt).toBe(true);
  });

  it("nach dem Nachzug ist ein zweiter Lauf ein No-op (idempotent)", async () => {
    const { repo, projections, ko } = await stack();
    const alt = legacyKo("misch-3");
    await repo.insert(alt);
    await projections.insert(v1Zeile(alt, "2024-03-01T10:00:00.000Z"));

    await ko.backfillSearchProjections({ limit: 10 });
    const zweiter = await ko.backfillSearchProjections({ limit: 10 });
    expect(zweiter).toEqual({ geprueft: 0, geschrieben: 0, v2Migriert: 0, gescheitert: 0 });
  });
});
