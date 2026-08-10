// ================================================================================================
// G27 — PERSISTENZ, ATOMARITÄT, BACKFILL UND REBUILD
// ================================================================================================
//
// Diese Datei prüft die Verträge des Repositories und des KoService: append-only je
// (ko_id, ko_version), Atomarität von neuer Inhaltsversion und Projektion, den aktiven Datensatz
// (historische Versionen sind in der Standardsuche unsichtbar), den idempotenten Altbestands-
// Backfill und den vollständigen Rebuild mit identischem content_hash.
import { describe, expect, it } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  type KoRepo,
  KoService,
  type ProjectionControlSitzung,
  buildSearchProjection,
} from "../../services/knowledge-object";

// `now` ist optional und nur dort gesetzt, wo ein Test den historischen Zeitpunkt festnageln muss
// (s. Rebuild-Provenienz): ohne feste Uhr trügen Schreibweg und Versionsstand zwei um Millisekunden
// auseinanderliegende Zeitpunkte, und ein Hashunterschied wäre nicht mehr eindeutig zurechenbar.

// G27 R1: EINE FRISCHE INSTANZ IST NICHT SUCHBEREIT (Entscheidung 05 §1). Sie steht persistent auf
// `UNINITIALIZED`, und die Standardsuche wirft dort — sie liefert kein stilles `[]`. Der Stapel
// fährt deshalb einmal die vorgeschriebene Folge `UNINITIALIZED → V2_BUILDING → V2_READY →
// V2_ACTIVE`: derselbe vollständige Gate-Lauf wie jede spätere Fassung, nur über einem leeren
// Bestand trivial erfüllt. Das ist KEINE Abkürzung um das Gate herum — die fünf Prüfungen laufen
// wirklich —, sondern die Inbetriebnahme, die eine echte Installation ebenso braucht.
async function stack(now?: () => number) {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const versions = new InMemoryKoVersionRepo();
  // `...(now ? { now } : {})` statt `now`: das Projekt fährt `exactOptionalPropertyTypes`, ein
  // ausdrückliches `undefined` wäre also KEIN „nicht gesetzt".
  const ko = new KoService({
    repo,
    versions,
    searchProjections: projections,
    ...(now ? { now } : {}),
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

// Ein Body, in dem das Zielwort ERST WEIT HINTER der Kurzfeldgrenze steht.
function langerBody(zielwort: string): string {
  return `<p>${"Fülltext zur Anlage. ".repeat(60)}</p><p>${zielwort}</p>`;
}

function legacyKo(id: string, bodyHtml: string): KnowledgeObject {
  return {
    id,
    title: `Alt ${id}`,
    statement: "Aussage ohne Zielwort.",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    history: [],
  } as unknown as KnowledgeObject;
}

describe("G27 · die Projektion entsteht mit der Inhaltsversion", () => {
  it("Erstanlage schreibt genau EINE Projektion für Version 1", async () => {
    const { ko, projections } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: langerBody("KORROSIONSSCHUTZ") });
    const alle = await ko.searchProjectionsOf(erstellt.id);
    expect(alle.map((p) => p.koVersion)).toEqual([1]);
    expect(alle[0]?.searchText).toContain("KORROSIONSSCHUTZ");
    expect(await projections.count()).toBe(1);
  });

  it("eine neue Version erzeugt eine NEUE Projektion; die alte bleibt byte-gleich erhalten", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: langerBody("ERSTWORT") });
    const v1 = await ko.searchProjectionOf(erstellt.id, 1);
    await ko.revise(erstellt.id, { bodyHtml: langerBody("ZWEITWORT") }, "anna");

    const v1DanachEreignis = await ko.searchProjectionOf(erstellt.id, 1);
    const v2 = await ko.searchProjectionOf(erstellt.id, 2);
    expect(v1DanachEreignis).toEqual(v1); // append-only: die alte Zeile ist unangetastet
    expect(v2?.koVersion).toBe(2);
    expect(v2?.searchText).toContain("ZWEITWORT");
    expect(v2?.contentHash).not.toBe(v1?.contentHash);
    expect((await ko.searchProjectionsOf(erstellt.id)).map((p) => p.koVersion)).toEqual([1, 2]);
  });

  it("die Standardsuche sieht NUR die aktive Version — der Begriff der Altfassung ist weg", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: langerBody("HISTORISCHESWORT") });
    expect((await ko.findSearchHits({ terms: ["historischeswort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);

    await ko.revise(erstellt.id, { bodyHtml: langerBody("AKTUELLESWORT") }, "anna");
    // Die historische Projektion EXISTIERT weiter (Rekonstruierbarkeit) …
    expect((await ko.searchProjectionOf(erstellt.id, 1))?.searchText).toContain("HISTORISCHESWORT");
    // … ist aber in der Standardsuche unsichtbar.
    expect(await ko.findSearchHits({ terms: ["historischeswort"] })).toEqual([]);
    expect((await ko.findSearchHits({ terms: ["aktuelleswort"] })).map((h) => h.koId)).toEqual([
      erstellt.id,
    ]);
  });

  it("append-only: ein zweiter Schreibversuch derselben (koId, koVersion) überschreibt NICHTS", async () => {
    const { projections } = await stack();
    const original = buildSearchProjection(
      legacyKo("k1", "<p>ORIGINAL</p>"),
      "2026-01-01T00:00:00.000Z",
    );
    expect(await projections.insert(original)).toBe(true);
    const anders = buildSearchProjection(
      legacyKo("k1", "<p>UEBERSCHRIEBEN</p>"),
      "2026-02-01T00:00:00.000Z",
    );
    expect(await projections.insert(anders)).toBe(false);
    expect((await projections.find("k1", 1))?.searchText).toBe(original.searchText);
  });
});

describe("G27 · Atomarität — kein Zustand „neue Version gilt, Suche kennt sie nicht“", () => {
  it("scheitert die Projektion, scheitert die Revision und der KO-Stand wird zurückgerollt", async () => {
    const repo = new InMemoryKoRepo();
    const echt = new InMemoryKoSearchProjectionRepo(repo);
    let brich = false;
    const projections = {
      ...echt,
      insert: async (p: Parameters<typeof echt.insert>[0]) => {
        if (brich) {
          throw new Error("Projektionsspeicher nicht erreichbar");
        }
        return echt.insert(p);
      },
      replace: (p: Parameters<typeof echt.replace>[0]) => echt.replace(p),
      find: (id: string, v: number) => echt.find(id, v),
      listByKo: (id: string) => echt.listByKo(id),
      findActive: (q: Parameters<typeof echt.findActive>[0]) => echt.findActive(q),
      missingActive: (n: number) => echt.missingActive(n),
      inventoryByProjectionVersion: () => echt.inventoryByProjectionVersion(),
      // G27 R1: der Control-State gehört zum Vertrag — der Doppelgänger reicht ihn unverändert an
      // den echten Adapter durch. Er zählt jede Methode einzeln auf, damit ein wachsender Vertrag
      // hier als Übersetzungsfehler auffällt und nicht erst als roter Test.
      controlState: () => echt.controlState(),
      compareAndSetControlState: (
        erwartet: Parameters<typeof echt.compareAndSetControlState>[0],
        naechster: Parameters<typeof echt.compareAndSetControlState>[1],
      ) => echt.compareAndSetControlState(erwartet, naechster),
      activeProjectionAudit: () => echt.activeProjectionAudit(),
      // G27 R1 / KW-ARCH-G27-GENERATION-UND-INTEGRITAET-09 §2: die drei neuen Vertragsmethoden.
      // Der Doppelgänger hat hier genau das geleistet, wofür er gebaut wurde — der wachsende
      // Vertrag ist als Übersetzungsfehler aufgefallen und nicht erst als roter Test.
      //
      // `withExclusiveControlLock` ist die exklusive Instanzsperre, unter der Gate-Prüfung und
      // Aktivierung EINE Entscheidung sind; `generationOf` und `activeRowsInGeneration` sind die
      // beiden Lesefragen des Gates. Alle drei gehen unverändert an den echten Adapter — dieser
      // Doppelgänger fälscht ausschließlich `insert`, und zwar nur, solange `brich` gesetzt ist.
      withExclusiveControlLock: <T>(fn: (sitzung: ProjectionControlSitzung) => Promise<T>) =>
        echt.withExclusiveControlLock(fn),
      generationOf: (id: string, v: number) => echt.generationOf(id, v),
      activeRowsInGeneration: (generation: number) => echt.activeRowsInGeneration(generation),
      // Das optionale `opts` reicht VERLUSTFREI weiter: es unterscheidet die Rücknahme eines nicht
      // committeten Schreibvorgangs von einer nachträglichen Beschädigung. Verschluckte der
      // Doppelgänger es, würde die Kompensation dieses Falls als Beschädigung gewertet und fällte
      // den Integritätsmarker — der Test misse dann eine Wirkung, die es im Produkt nicht gibt.
      remove: (id: string, v: number, opts?: Parameters<typeof echt.remove>[2]) =>
        echt.remove(id, v, opts),
      removeByKo: (id: string) => echt.removeByKo(id),
      count: () => echt.count(),
    };
    const ko = new KoService({
      repo,
      versions: new InMemoryKoVersionRepo(),
      searchProjections: projections,
    });
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: langerBody("ERSTWORT") });

    brich = true;
    const revision = ko.revise(erstellt.id, { bodyHtml: langerBody("ZWEITWORT") }, "anna");
    await expect(revision).rejects.toThrow(/Projektionsspeicher/);
    // Der Inhalt steht wieder auf Version 1 — es gibt keine gültige Fassung ohne Suchprojektion.
    const nachher = await ko.get(erstellt.id);
    expect(nachher?.version).toBe(1);
    expect(nachher?.bodyHtml).toContain("ERSTWORT");
    expect((await ko.searchProjectionsOf(erstellt.id)).map((p) => p.koVersion)).toEqual([1]);
  });
});

describe("G27 · Altbestand: sicher und idempotent", () => {
  it("ein am Dienst vorbei eingefügtes Objekt wird nachprojiziert — der zweite Lauf schreibt nichts", async () => {
    const { repo, ko } = await stack();
    await repo.insert(legacyKo("legacy-1", langerBody("ALTBESTANDSWORT")));
    expect(await ko.findSearchHits({ terms: ["altbestandswort"] })).toEqual([]);

    const erster = await ko.backfillSearchProjections({ limit: 10 });
    expect(erster).toEqual({ geprueft: 1, geschrieben: 1, v2Migriert: 0, gescheitert: 0 });
    expect((await ko.findSearchHits({ terms: ["altbestandswort"] })).map((h) => h.koId)).toEqual([
      "legacy-1",
    ]);

    const zweiter = await ko.backfillSearchProjections({ limit: 10 });
    expect(zweiter).toEqual({ geprueft: 0, geschrieben: 0, v2Migriert: 0, gescheitert: 0 });
  });

  it("der Deckel wird eingehalten und der Rest im nächsten Lauf abgearbeitet (konvergiert)", async () => {
    const { repo, ko } = await stack();
    for (let i = 0; i < 7; i += 1) {
      await repo.insert(legacyKo(`legacy-${i}`, langerBody("SCHWUNGWORT")));
    }
    expect(await ko.backfillSearchProjections({ limit: 3 })).toEqual({
      geprueft: 3,
      geschrieben: 3,
      v2Migriert: 0,
      gescheitert: 0,
    });
    expect((await ko.findSearchHits({ terms: ["schwungwort"] })).length).toBe(3);
    await ko.backfillSearchProjections({ limit: 3 });
    await ko.backfillSearchProjections({ limit: 3 });
    expect((await ko.findSearchHits({ terms: ["schwungwort"] })).length).toBe(7);
  });

  it("ein Objekt, dessen Vollladung scheitert, bringt den Backfill NICHT zu Fall", async () => {
    const inner = new InMemoryKoRepo();
    await inner.insert(legacyKo("ok", langerBody("BACKFILLWORT")));
    await inner.insert(legacyKo("kaputt", langerBody("BACKFILLWORT")));
    const repo: KoRepo = {
      ...inner,
      insert: (k) => inner.insert(k),
      update: (k) => inner.update(k),
      delete: (id, tx) => inner.delete(id, tx),
      bumpTrust: (id, s, m, tx) => inner.bumpTrust(id, s, m, tx),
      list: (f) => inner.list(f),
      listForSearch: (f) => inner.listForSearch(f),
      listByIds: (ids) => inner.listByIds(ids),
      setCaptionTexts: (id, c) => inner.setCaptionTexts(id, c),
      setAiCheck: (id, a) => inner.setAiCheck(id, a),
      resolveAiCheck: (id, p, v) => inner.resolveAiCheck(id, p, v),
      findCandidates: (q) => inner.findCandidates(q),
      findByCreateOperation: (o, a) => inner.findByCreateOperation(o, a),
      findById: async (id) => {
        if (id === "kaputt") {
          throw new Error("Datenbank kurzzeitig nicht erreichbar");
        }
        return inner.findById(id);
      },
    };
    const ko = new KoService({ repo, searchProjections: new InMemoryKoSearchProjectionRepo(repo) });
    const bilanz = await ko.backfillSearchProjections({ limit: 10 });
    expect(bilanz.geschrieben).toBe(1);
    expect(bilanz.gescheitert).toBe(1);
    // Das kaputte Objekt bleibt ohne Projektion — und seit G27 R1 ist die Folge SCHÄRFER als
    // vorher, nicht schwächer: bis dahin lieferte die Suche einfach die eine gelungene Zeile und
    // verschwieg die Lücke. Jetzt ist die Lücke ein Freigabehindernis. Die Instanz kann gar nicht
    // in den regulären Suchbetrieb gehen, solange nicht jedes Objekt projiziert ist (04 §3).
    await ko.beginSearchProjectionBuild();
    await ko.reconcileSearchProjections();
    const readiness = await ko.searchProjectionReadiness();
    expect(readiness.konsistenz).toBe(false);
    expect(readiness.alle).toBe(false);
    expect(readiness.befunde.join(" ")).toContain("unvollständige Projektion");
    // Und die Freigabe wird ausdrücklich abgelehnt — keine Teilvollständigkeit, kein Mischbetrieb.
    const { control } = await ko.finishSearchProjectionBuild();
    expect(control.projectionState).toBe("V2_BUILDING");
    await expect(ko.releaseSearchProjectionVersion()).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    // Die Suche bleibt in diesem Zustand ehrlich nicht verfügbar — statt eine Teilmenge zu liefern,
    // die wie ein vollständiges Ergebnis aussähe.
    await expect(ko.findSearchHits({ terms: ["backfillwort"] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
  });
});

describe("G27 · Rebuild", () => {
  it("liefert bei unverändertem Inhalt exakt denselben content_hash", async () => {
    const { ko } = await stack();
    const a = await ko.create({ ...EINGABE, bodyHtml: langerBody("REBUILDWORT") });
    const b = await ko.create({ ...EINGABE, title: "Zweites", bodyHtml: langerBody("ANDERSWORT") });
    const vorher = new Map([a, b].map((k) => [k.id, undefined as string | undefined]));
    for (const id of vorher.keys()) {
      vorher.set(id, (await ko.searchProjectionOf(id))?.contentHash);
    }

    const bilanz = await ko.rebuildSearchProjections();
    expect(bilanz.geprueft).toBe(2);
    expect(bilanz.geschrieben).toBe(2);
    expect(bilanz.unveraendert).toBe(2); // die Zusage der Architekturentscheidung, gemessen

    for (const [id, hash] of vorher) {
      expect((await ko.searchProjectionOf(id))?.contentHash).toBe(hash);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // DIE WIEDERHERSTELLUNG EINER GELÖSCHTEN ZEILE — UND WARUM IHR HASH EIN ANDERER IST
  // ----------------------------------------------------------------------------------------------
  //
  // Der Schreibweg liest die Einstufung am lebenden Objekt, WÄHREND die Version wirksam wird:
  // Provenienz `captured_at_version`. Ist die Zeile ausdrücklich gelöscht, gibt es diesen Moment
  // nicht mehr; der Rebuild nimmt die belastbarste verfügbare Quelle — den unveränderlichen
  // `KoVersionSnapshot` — und schreibt das als Provenienz `ko_version_snapshot` hin.
  //
  // Die frühere Fassung erwartete hier denselben `content_hash`. Nach Detailentscheidung J ist das
  // ausgeschlossen: die Provenienz ist hashwirksam, und „gleicher Hash für unterschiedliche
  // Beleglagen" ist ein ausdrückliches No-Go. Beides gleich zu machen ginge nur, indem der
  // Produktcode eine Provenienz vortäuscht, die er nicht hat — genau das darf nicht passieren.
  //
  // WAS DER REBUILD DESHALB ZUSAGT und was dieser Test misst: Inhalt, Wert, Zeitpunkt und Confidence
  // bleiben fachlich unverändert belegt, der Provenienzwechsel ist SICHTBAR, der Hash unterscheidet
  // sich deswegen — und ein zweiter Rebuild aus derselben Provenienz ist deterministisch.
  it("stellt eine gelöschte Projektionszeile wieder her — Provenienzwechsel sichtbar, Hash deshalb anders", async () => {
    const { ko, projections } = await stack(() => Date.parse("2026-03-01T08:00:00.000Z"));
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: langerBody("WIEDERHERSTELLWORT") });
    const original = await ko.searchProjectionOf(erstellt.id);
    expect(original?.classificationSnapshot.provenance).toBe("captured_at_version");

    await projections.removeByKo(erstellt.id);
    expect(await ko.findSearchHits({ terms: ["wiederherstellwort"] })).toEqual([]);

    await ko.rebuildSearchProjections();
    const wieder = await ko.searchProjectionOf(erstellt.id);
    // Fachlich unverändert belegt: derselbe Inhalt, derselbe Wert, derselbe historische Zeitpunkt
    // aus derselben Zeitquelle, dieselbe Confidence.
    expect(wieder?.searchText).toBe(original?.searchText);
    expect(wieder?.bodyText).toBe(original?.bodyText);
    expect(wieder?.classificationSnapshot.value).toBe(original?.classificationSnapshot.value);
    expect(wieder?.classificationSnapshot.capturedAt).toBe(
      original?.classificationSnapshot.capturedAt,
    );
    expect(wieder?.classificationSnapshot.capturedAtSource).toBe(
      original?.classificationSnapshot.capturedAtSource,
    );
    expect(wieder?.classificationSnapshot.historicalConfidence).toBe(
      original?.classificationSnapshot.historicalConfidence,
    );
    // Die HERKUNFT der Aussage ist eine andere — und sie steht ausdrücklich in der Zeile.
    expect(wieder?.classificationSnapshot.provenance).toBe("ko_version_snapshot");
    expect(wieder?.contentHash).not.toBe(original?.contentHash);
    // Das eigentliche Versprechen des Rebuilds bleibt: der Fund ist wieder da.
    expect((await ko.findSearchHits({ terms: ["wiederherstellwort"] })).map((h) => h.koId)).toEqual(
      [erstellt.id],
    );

    // Deterministisch: ein zweiter Rebuild aus DERSELBEN Provenienz erzeugt denselben Hash.
    await ko.rebuildSearchProjections();
    const zweiterLauf = await ko.searchProjectionOf(erstellt.id);
    expect(zweiterLauf?.classificationSnapshot.provenance).toBe("ko_version_snapshot");
    expect(zweiterLauf?.contentHash).toBe(wieder?.contentHash);
  });
});

describe("G27 · die Fundstelle wird ehrlich benannt", () => {
  it("ein Treffer NUR im Dokumenttext ist als body-Fund gekennzeichnet", async () => {
    const { ko } = await stack();
    await ko.create({ ...EINGABE, bodyHtml: langerBody("NURIMKOERPER") });
    const [hit] = await ko.findSearchHits({ terms: ["nurimkoerper"] });
    expect(hit?.matched).toEqual({
      title: false,
      statement: false,
      category: false,
      tag: false,
      caption: false,
      body: true,
    });
  });

  it("Schlagwörter und Bildunterschriften bleiben Teil desselben Suchvertrags", async () => {
    const { ko } = await stack();
    const mitTag = await ko.create({ ...EINGABE, tags: ["hydraulik"] });
    const mitFussnote = await ko.create({
      ...EINGABE,
      title: "Mit Fußnote",
      bodyHtml:
        '<figure><img src="/api/objects/x/raw"><figcaption>Verschraubung am Pumpenkopf</figcaption></figure>',
    });
    const tagTreffer = await ko.findSearchHits({ terms: ["hydraulik"] });
    expect(tagTreffer.map((h) => h.koId)).toEqual([mitTag.id]);
    expect(tagTreffer[0]?.matched.tag).toBe(true);

    const fussnotenTreffer = await ko.findSearchHits({ terms: ["verschraubung"] });
    expect(fussnotenTreffer.map((h) => h.koId)).toEqual([mitFussnote.id]);
    expect(fussnotenTreffer[0]?.matched.caption).toBe(true);
  });

  it("Script-/Style-Inhalt ist NICHT suchbar (erste Schranke: der Sanitizer an der Schreibgrenze)", async () => {
    const { ko } = await stack();
    await ko.create({
      ...EINGABE,
      bodyHtml: "<p>sichtbar</p><script>SKRIPTWORT</script><style>STYLEWORT</style>",
    });
    expect(await ko.findSearchHits({ terms: ["skriptwort"] })).toEqual([]);
    expect(await ko.findSearchHits({ terms: ["stylewort"] })).toEqual([]);
    expect((await ko.findSearchHits({ terms: ["sichtbar"] })).length).toBe(1);
  });

  it("versteckte Fragmente sind NICHT suchbar — auch in Inhalt, der nie durch den Sanitizer lief", async () => {
    // Der Schreibweg (create/revise) verwirft `hidden`/`style` bereits am Sanitizer; diese Schranke
    // greift für ALTBESTAND und für Inhalt, der am Dienst vorbei in die Ablage kam. Genau dafür
    // überspringt die Projektion unsichtbare Elemente selbst — eine zweite, unabhängige Schranke.
    const { repo, ko } = await stack();
    await repo.insert(
      legacyKo(
        "legacy-versteckt",
        "<p>SICHTBARWORT</p><div hidden><p>VERSTECKTWORT</p></div><script>SKRIPTWORT</script>",
      ),
    );
    await ko.backfillSearchProjections({ limit: 10 });
    expect(await ko.findSearchHits({ terms: ["verstecktwort"] })).toEqual([]);
    expect(await ko.findSearchHits({ terms: ["skriptwort"] })).toEqual([]);
    expect((await ko.findSearchHits({ terms: ["sichtbarwort"] })).map((h) => h.koId)).toEqual([
      "legacy-versteckt",
    ]);
  });

  it("ein endgültig gelöschtes Objekt hinterlässt keine Projektionszeile", async () => {
    const { ko, projections } = await stack();
    const erstellt = await ko.create({ ...EINGABE, bodyHtml: langerBody("ENTFERNTWORT") });
    expect(await projections.count()).toBe(1);
    await ko.delete(erstellt.id, "admin", { hard: true });
    expect(await projections.count()).toBe(0);
    expect(await ko.findSearchHits({ terms: ["entferntwort"] })).toEqual([]);
  });
});
