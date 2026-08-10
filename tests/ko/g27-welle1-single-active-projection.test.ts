// ================================================================================================
// G27 WELLE 1 / R1 — SINGLE ACTIVE PROJECTION UND READINESS GATE (In-Memory)
// ================================================================================================
//
// WAS DIESE DATEI IST. Die dauerhafte Negativkontrolle zu BENs Befund R1
// (BERICHT-BEN-G27-WELLE1-01, Abschnitt 3) und der Vertrag des Zustandsautomaten aus
// KW-ARCH-G27-SINGLE-ACTIVE-PROJECTION-03 / -PROJECTION-CONTROL-STATE-04 / -RESTFRAGEN-05.
//
// IHRE VORFASSUNG LIEF ROT, und das ist der einzige Grund, warum ihr Grün etwas bedeutet. Gemessen
// wurde am unveränderten Stand (HEAD 81ba93d) mit ausschließlich damals vorhandener Schnittstelle:
//
//   zielFassungNachGedeckeltemBackfill: 1      (Deckel greift — das Ziel bleibt V1)
//   alteKategorieTrifftZiel:            true   ← der Defekt
//   alteKategorieFundstelleBody:        true   ← aus dem V1-`search_text`, nicht aus der Kategorie
//   neueKategorieTrifftZiel:            true
//
// Genau BENs vier Werte. Der Rohbeleg liegt unter
// `_relay/messung/pro-g27-r1-single-active-02-tests.txt`.
//
// WAS SIE NICHT ERSETZT: den echten Postgres-Lauf. Restartfestigkeit über einen Pool, die
// Atomarität des bedingten UPDATE und das Verhalten der Steuerzeile unter Nebenläufigkeit
// entscheidet die Datenbank — dafür gibt es die Schwesterdatei
// `g27-welle1-single-active-projection.integration.test.ts`.
import { describe, expect, it } from "vitest";
import {
  InMemoryKoMetadataProjectionRepo,
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  type KoSearchProjection,
  KoService,
  SEARCH_PROJECTION_VERSION,
  buildSearchProjection,
  neuerProjektionsSpeicher,
  parseClassificationSnapshot,
} from "../../services/knowledge-object";

const AT = "2026-08-02T09:00:00.000Z";
const ALT = "AltkategorieXYZ";
const NEU = "NeukategorieXYZ";

// Der Deckel des gedeckelten Nachzugs. 21 Vorgänger sind die AUFBAUPFLICHT (Auftrag §3.11): mit
// weniger erreichte der Deckel das Ziel-KO und der Fall misse den Defekt gar nicht.
const DECKEL = 20;
const VORGAENGER = 21;

function objekt(id: string, kategorie: string, koerper: string): KnowledgeObject {
  return {
    id,
    title: `Objekt ${id}`,
    statement: "Aussage ohne Zielwort.",
    bodyHtml: `<p>${koerper}</p>`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: kategorie,
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    createdAt: "2024-03-01T08:00:00.000Z",
    history: [],
  } as unknown as KnowledgeObject;
}

// Eine Zeile, wie eine V1-Umgebung sie trägt: Fassung 1, Kategorie noch IM Inhalt, kein
// `body_text`, leere Klassifizierungszelle.
function v1Zeile(
  ko: KnowledgeObject,
  kategorieImInhalt: string,
  koVersion = ko.version,
): KoSearchProjection {
  return {
    ...buildSearchProjection(ko, AT),
    koVersion,
    projectionVersion: 1,
    bodyText: "",
    searchText: `${ko.title}\n${ko.statement}\n${kategorieImInhalt}`,
    contentHash: "v1-hash",
    classificationSnapshot: parseClassificationSnapshot("", koVersion),
  };
}

function stack() {
  const repo = new InMemoryKoRepo();
  const metadata = new InMemoryKoMetadataProjectionRepo();
  const speicher = neuerProjektionsSpeicher();
  const projections = new InMemoryKoSearchProjectionRepo(repo, metadata, speicher);
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: projections,
  });
  return { repo, metadata, speicher, projections, ko };
}

// BENs Aufbau, wörtlich: 21 Objekte ohne fertige Projektion vor einem Ziel-KO, dessen aktive Zeile
// noch Fassung 1 ist und den ALTEN Kategoriebegriff im `search_text` trägt, während die
// Metadatenprojektion bereits den NEUEN Wert führt.
async function benAufbau() {
  const s = stack();
  for (let i = 1; i <= VORGAENGER; i++) {
    await s.repo.insert(objekt(`vorgaenger-${String(i).padStart(2, "0")}`, "Wartung", "Fuellwort"));
  }
  const ziel = objekt("ziel", NEU, "Zielkoerperwort");
  await s.repo.insert(ziel);
  await s.projections.insert(v1Zeile(ziel, ALT));
  await s.projections.metadata.upsert({ koId: ziel.id, categoryText: NEU, tagText: "", at: AT });
  return { ...s, zielId: ziel.id };
}

// ================================================================================================
// 1 — DER ANFANGSZUSTAND EINER NEUEN INSTANZ (Entscheidung 05 §1)
// ================================================================================================

describe("G27 R1 · Pflichtfall 1 · eine neue Instanz ist UNINITIALIZED und nicht suchbereit", () => {
  it("der Zustand ist persistiert — nicht abgeleitet, nicht geraten", async () => {
    const { ko } = stack();
    expect(await ko.searchProjectionControl()).toEqual({
      activeProjectionVersion: null,
      targetProjectionVersion: null,
      projectionState: "UNINITIALIZED",
      lastSuccessfulRebuild: null,
      lastReconcile: null,
      lastFailure: null,
      buildStartedAt: null,
      buildFinishedAt: null,
      // G27 R1 / Entscheidung 09 §2: Generation 0 heisst „auf dieser Instanz gab es noch NIE einen
      // V2-Bauzyklus". Das ist keine Kosmetik — genau daran hängt, dass eine neue Instanz sich
      // nicht zur Legacy-Instanz erklären kann (09 §4, s. Pflichtfall 6a).
      buildGeneration: 0,
      activeGeneration: null,
      integrityMarker: null,
      activatedAt: null,
    });
  });

  it("leere Tabellen machen daraus NIEMALS automatisch V2_ACTIVE", async () => {
    const { ko, projections } = stack();
    expect(await projections.count()).toBe(0);
    // Beliebig oft gefragt — der Bestand ist leer, und der Zustand bleibt trotzdem, was er ist.
    await ko.searchProjectionVersions();
    await ko.searchProjectionAudit();
    expect((await ko.searchProjectionControl()).projectionState).toBe("UNINITIALIZED");
  });

  it("die Standardsuche WIRFT — sie liefert weder [] noch eine Teilmenge (04 §4)", async () => {
    const { ko } = stack();
    await ko.create({
      title: "Sichtbar nach Freigabe",
      statement: "s",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: "<p>Freigabewort</p>",
    });
    await expect(ko.findSearchHits({ terms: ["freigabewort"] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    // Auch die LEERE Anfrage verrät den Zustand ehrlich, statt ein fachliches „nichts gefunden“
    // vorzuschieben: die Control-Prüfung steht VOR der Leermengenentscheidung.
    await expect(ko.findSearchHits({ terms: [] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    // Und der Ask-/Klara-Kandidatenweg verhält sich identisch — es gibt nur EINEN Sucheinstieg.
    await expect(ko.findCandidates({ terms: ["freigabewort"], limit: 10 })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
  });
});

// ================================================================================================
// 2/3/4 — V1 VORHANDEN · TEILWEISE MIGRIERT · VOLLSTÄNDIGE MIGRATION
// ================================================================================================

describe("G27 R1 · Pflichtfälle 2–4 · V1-Betrieb, Bau und vollständige Migration", () => {
  it("V1 vorhanden: der erklärte V1-Betrieb liefert AUSSCHLIESSLICH Fassung 1", async () => {
    const { repo, projections, ko } = stack();
    const alt = objekt("alt-1", ALT, "Altkoerperwort");
    await repo.insert(alt);
    await projections.insert(v1Zeile(alt, ALT));
    await projections.metadata.upsert({ koId: alt.id, categoryText: ALT, tagText: "", at: AT });

    const control = await ko.declareSearchProjectionV1Active();
    expect(control.projectionState).toBe("V1_ACTIVE");
    expect(control.activeProjectionVersion).toBe(1);

    const treffer = await ko.findSearchHits({ terms: [ALT.toLowerCase()] });
    expect(treffer.map((h) => h.koId)).toEqual(["alt-1"]);
    expect(treffer[0]?.projectionVersion).toBe(1);
  });

  it("V1_ACTIVE ist nicht erklärbar, wenn der Bestand nicht vollständig Fassung 1 ist", async () => {
    const { ko } = stack();
    await ko.create({
      title: "Frisch",
      statement: "s",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    // Die aktive Zeile ist Fassung 2 — eine V1-Erklärung wäre eine Behauptung, kein Zustand.
    await expect(ko.declareSearchProjectionV1Active()).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
  });

  it("teilweise migriert: im Bau liefert die Suche KEINE Teilmenge, sondern wirft", async () => {
    const { ko, zielId } = await benAufbau();
    await ko.beginSearchProjectionBuild();
    const control = await ko.searchProjectionControl();
    expect(control.projectionState).toBe("V2_BUILDING");
    // Während des Baus gibt es keine freigegebene Fassung — auch nicht „die alte solange“.
    expect(control.activeProjectionVersion).toBeNull();

    // Ein halber Nachzug: 20 von 22 sind fertig, das Ziel ist es nicht.
    const bilanz = await ko.backfillSearchProjections({ limit: DECKEL });
    expect(bilanz.geprueft).toBe(DECKEL);
    expect((await ko.searchProjectionOf(zielId))?.projectionVersion).toBe(1);

    await expect(ko.findSearchHits({ terms: [ALT.toLowerCase()] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    // Und das Gate lässt diesen Stand ausdrücklich nicht durch.
    const readiness = await ko.searchProjectionReadiness();
    expect(readiness.alle).toBe(false);
    expect(readiness.projektionsversion).toBe(false);
  });

  it("vollständige Migration: nach dem Reconcile ist nichts mehr offen und nichts gemischt", async () => {
    const { ko } = await benAufbau();
    await ko.beginSearchProjectionBuild();
    const reconcile = await ko.reconcileSearchProjections();
    expect(reconcile.offenVorher).toBe(VORGAENGER + 1);
    expect(reconcile.differenz).toBe(0);
    const bestand = await ko.searchProjectionVersions();
    expect(bestand.offenV1).toBe(0);
    expect(bestand.gemischt).toBe(false);
  });
});

// ================================================================================================
// 5/6/7/8 — REBUILD · RECONCILE · DIE FÜNF PRÜFUNGEN · DIE ATOMARE FREIGABE
// ================================================================================================

describe("G27 R1 · Pflichtfälle 5–8 · das Gate und die eine Freigabeoperation", () => {
  it("ohne Rebuild und Reconcile gibt es KEINE Freigabe — die Vorbedingungen sind hart", async () => {
    const { ko } = await benAufbau();
    await ko.beginSearchProjectionBuild();
    const readiness = await ko.searchProjectionReadiness();
    expect(readiness.rebuild).toBe(false);
    expect(readiness.reconcile).toBe(false);
    expect(readiness.alle).toBe(false);
    // `V2_READY` wird gar nicht erst erreicht …
    const { control } = await ko.finishSearchProjectionBuild();
    expect(control.projectionState).toBe("V2_BUILDING");
    // … und eine Freigabe aus dem Bau heraus wird ausdrücklich abgelehnt.
    await expect(ko.releaseSearchProjectionVersion()).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
  });

  it("alle fünf Prüfungen bestehen erst nach vollständigem Rebuild UND Reconcile", async () => {
    const { ko } = await benAufbau();
    const { readiness, control } = await ko.activateSearchProjectionV2();
    expect(readiness).toMatchObject({
      rebuild: true,
      reconcile: true,
      konsistenz: true,
      projektionsversion: true,
      integritaet: true,
      alle: true,
    });
    expect(readiness.befunde).toEqual([]);
    expect(control.projectionState).toBe("V2_ACTIVE");
    expect(control.activeProjectionVersion).toBe(SEARCH_PROJECTION_VERSION);
    expect(control.lastSuccessfulRebuild).not.toBeNull();
    expect(control.lastReconcile).not.toBeNull();
  });

  it("die Integritätsprüfung schlägt an, wenn eine aktive Zeile nicht mehr zu ihrem Inhalt passt", async () => {
    const { ko, projections, zielId } = await benAufbau();
    await ko.activateSearchProjectionV2();
    // Eine aktive Zeile wird verfälscht — der Hash passt danach nicht mehr zum Objekt.
    const echt = await projections.find(zielId, 1);
    await projections.replace({ ...(echt as KoSearchProjection), contentHash: "verfaelscht" });
    const readiness = await ko.searchProjectionReadiness();
    expect(readiness.integritaet).toBe(false);
    expect(readiness.befunde.join(" ")).toContain("Hash-Konsistenz");
  });

  it("die Freigabe ist EINE Operation — ein zweiter Versuch findet den Vorzustand nicht mehr vor", async () => {
    const { ko } = await benAufbau();
    await ko.activateSearchProjectionV2();
    // `V2_READY → V2_ACTIVE` ist verbraucht: derselbe Übergang lässt sich nicht wiederholen, und es
    // gab keinen Moment dazwischen, in dem zwei Fassungen hätten liefern können.
    await expect(ko.releaseSearchProjectionVersion()).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    expect((await ko.searchProjectionControl()).projectionState).toBe("V2_ACTIVE");
  });

  it("Übergänge außerhalb der Folge werden abgelehnt, nicht still korrigiert", async () => {
    const { ko } = stack();
    // Aus `UNINITIALIZED` gibt es keinen Sprung nach `V2_READY` oder in die Freigabe.
    await expect(ko.finishSearchProjectionBuild()).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    await expect(ko.releaseSearchProjectionVersion()).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    await expect(ko.rollbackSearchProjectionVersion("Probe")).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    expect((await ko.searchProjectionControl()).projectionState).toBe("UNINITIALIZED");
  });

  it("der Fehlerpfad V2_BUILDING → FAILED ist ausdrücklich und macht die Suche nicht wieder auf", async () => {
    const { ko } = await benAufbau();
    await ko.beginSearchProjectionBuild();
    const control = await ko.failSearchProjectionBuild("Abbruch im Test");
    expect(control.projectionState).toBe("FAILED");
    expect(control.activeProjectionVersion).toBeNull();
    expect(control.lastFailure).toContain("Abbruch im Test");
    await expect(ko.findSearchHits({ terms: ["fuellwort"] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    // Aus `FAILED` führt der Weg zurück in den Bau — nicht direkt in den Betrieb.
    expect((await ko.beginSearchProjectionBuild()).projectionState).toBe("V2_BUILDING");
  });
});

// ================================================================================================
// 9 — WIEDERANLAUF
// ================================================================================================

describe("G27 R1 · Pflichtfall 9 · der Zustand überlebt den Wiederanlauf", () => {
  it("ein zweiter, frischer Adapter über denselben Speicher liest denselben Zustand", async () => {
    const { repo, metadata, speicher, ko } = await benAufbau();
    await ko.activateSearchProjectionV2();
    const vorher = await ko.searchProjectionControl();

    // „Neustart": neuer Adapter, neuer Dienst — derselbe Datenraum.
    const zweiterAdapter = new InMemoryKoSearchProjectionRepo(repo, metadata, speicher);
    const zweiterDienst = new KoService({
      repo,
      versions: new InMemoryKoVersionRepo(),
      searchProjections: zweiterAdapter,
    });
    expect(await zweiterDienst.searchProjectionControl()).toEqual(vorher);
    // Keine heuristische Wiederaufnahme, kein erneuter Rebuild: es wird sofort weiter gesucht.
    expect(
      (await zweiterDienst.findSearchHits({ terms: [NEU.toLowerCase()] })).map((h) => h.koId),
    ).toEqual(["ziel"]);
  });

  it("ein frischer Adapter über einen FRISCHEN Speicher ist wieder UNINITIALIZED", async () => {
    const { repo, metadata } = await benAufbau();
    const fremd = new InMemoryKoSearchProjectionRepo(repo, metadata, neuerProjektionsSpeicher());
    expect((await fremd.controlState()).projectionState).toBe("UNINITIALIZED");
  });
});

// ================================================================================================
// 10 — RÜCKNAHME: IMMER FAILED, DANACH VOLLSTÄNDIGE V2-RECOVERY
// ================================================================================================
//
// WAS HIER FRÜHER STAND UND WARUM ES WEG IST (KW-ARCH-G27-ROLLBACK-PROJEKTIONSSPEICHERUNG-08 §5,
// „Der künstliche Repo-Backdoor-Rollbacktest wird entfernt oder ersetzt").
//
// Der frühere Pflichtfall „wurde V1 BEWUSST erhalten ⇒ V1_ACTIVE" war grün — aber nur, weil ER
// SELBST den Vorzustand herstellte, den kein Produktweg herstellen kann: eine Schleife über
// `projections.replace(v1Zeile(...))` schrieb vor dem Rollback jede aktive Zeile auf Fassung 1
// zurück. Der Primärschlüssel ist `(ko_id, ko_version)`; der V2-Rebuild ERSETZT die V1-Zeile
// derselben aktiven KO-Version. Nach einer regulären V2-Aktivierung gibt es die vollständige V1
// also gar nicht mehr — der Test belegte eine Rückfalloption, die im Ernstfall nicht existiert.
// Genau das war BENs ROT-3.
//
// Entscheidung 08 §1 hat daraus die verbindliche Konsequenz gezogen: KEIN produktiver V1-Rollback.
// Diese Beschreibung prüft deshalb den Pfad, den es wirklich gibt — und ausdrücklich, dass der
// Rückweg nach V1 abgelehnt wird.

describe("G27 R1 · Pflichtfall 10 · Rücknahme endet immer in FAILED", () => {
  it("nach einem V2-Rebuild führt die Rücknahme nach FAILED mit Rebuild-Pflicht", async () => {
    const { ko } = await benAufbau();
    await ko.activateSearchProjectionV2();
    const control = await ko.rollbackSearchProjectionVersion("Betriebsentscheid");
    expect(control.projectionState).toBe("FAILED");
    expect(control.activeProjectionVersion).toBeNull();
    // Die Vorbedingungen sind verbraucht — ein vollständiger Rebuild ist erforderlich.
    expect(control.lastSuccessfulRebuild).toBeNull();
    expect(control.lastReconcile).toBeNull();
    // Und die Freigabe ist zurückgenommen, nicht nur der Zustandsname geändert.
    expect(control.activeGeneration).toBeNull();
    expect(control.integrityMarker).toBeNull();
    await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
  });

  it("AUCH ein vollständig zurückgestellter V1-Bestand führt nach FAILED — kein V1-Rollback (08 §1)", async () => {
    const { repo, projections, ko } = await benAufbau();
    await ko.activateSearchProjectionV2();
    // Selbst wenn jemand den kompletten V1-Stand von Hand zurückschreibt — was kein Produktweg
    // tut —, ist die Antwort dieselbe. Der Rückfall hängt nicht mehr am Bestand, sondern ist
    // abgeschafft.
    for (const objektImBestand of await repo.list({})) {
      await projections.replace(v1Zeile(objektImBestand, ALT));
    }
    const control = await ko.rollbackSearchProjectionVersion("Rückfallversuch auf V1");
    expect(control.projectionState).toBe("FAILED");
    expect(control.activeProjectionVersion).toBeNull();
    // Und `V1_ACTIVE` ist danach auch ausdrücklich nicht mehr erklärbar (09 §4).
    await expect(ko.declareSearchProjectionV1Active()).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
  });

  it("die vollständige V2-Recovery ist der EINE Weg zurück in den Betrieb", async () => {
    const { ko, zielId } = await benAufbau();
    await ko.activateSearchProjectionV2();
    const vorher = await ko.searchProjectionControl();
    await ko.rollbackSearchProjectionVersion("Betriebsentscheid");

    const { control } = await ko.recoverSearchProjectionV2("Wiederinbetriebnahme");
    expect(control.projectionState).toBe("V2_ACTIVE");
    // Eine NEUE Generation — der zurückgenommene Bau wird nicht wiederbelebt.
    expect(control.activeGeneration).toBe((vorher.activeGeneration ?? 0) + 1);
    expect((await ko.findSearchHits({ terms: [NEU.toLowerCase()] })).map((h) => h.koId)).toEqual([
      zielId,
    ]);
  });
});

// ================================================================================================
// 11/12/13 — BENs GEGENPROBE, WÖRTLICH
// ================================================================================================

describe("G27 R1 · Pflichtfälle 11–13 · BENs Gegenprobe bei mehr als 20 offenen Vorgängern", () => {
  it("der Deckel greift nachweislich — das Ziel bleibt jenseits des Schwungs (Aufbaubeleg)", async () => {
    const { ko, zielId } = await benAufbau();
    const bilanz = await ko.backfillSearchProjections({ limit: DECKEL });
    expect(bilanz).toEqual({ geprueft: 20, geschrieben: 20, v2Migriert: 0, gescheitert: 0 });
    // Genau BENs Vorzustandswert: das Ziel-KO bleibt in Fassung 1.
    expect((await ko.searchProjectionOf(zielId))?.projectionVersion).toBe(1);
  });

  it("nach bestandenem V2-Gate liefert die ALTE Kategorie NULL Treffer", async () => {
    const { ko } = await benAufbau();
    await ko.backfillSearchProjections({ limit: DECKEL }); // der gedeckelte Lauf ändert daran nichts
    await ko.activateSearchProjectionV2();
    expect(await ko.findSearchHits({ terms: [ALT.toLowerCase()] })).toEqual([]);
  });

  it("nach der Kategorieänderung trifft NUR der neue Begriff — und zwar als Kategoriefund", async () => {
    const { ko, zielId } = await benAufbau();
    await ko.activateSearchProjectionV2();
    const neueTreffer = await ko.findSearchHits({ terms: [NEU.toLowerCase()] });
    expect(neueTreffer.map((h) => h.koId)).toEqual([zielId]);
    expect(neueTreffer[0]?.matched.category).toBe(true);
    // KEIN `matched.body`-Fund aus einem V1-`search_text` — das war der Defekt.
    expect(neueTreffer[0]?.matched.body).toBe(false);
    expect(neueTreffer[0]?.projectionVersion).toBe(SEARCH_PROJECTION_VERSION);
  });

  it("JEDER reguläre Treffer trägt die freigegebene Fassung — ausnahmslos", async () => {
    const { ko } = await benAufbau();
    await ko.activateSearchProjectionV2();
    const control = await ko.searchProjectionControl();
    const treffer = await ko.findSearchHits({ terms: ["fuellwort", "zielkoerperwort"] });
    expect(treffer.length).toBeGreaterThan(0);
    expect(treffer.every((h) => h.projectionVersion === control.activeProjectionVersion)).toBe(
      true,
    );
  });

  it("eine NACHTRÄGLICH aufgetauchte V1-Zeile macht die Suche fail-closed — NICHT leer", async () => {
    // DIESER FALL HAT SICH DURCH ENTSCHEIDUNG 09 GEÄNDERT, und die Änderung ist der Kern von BENs
    // ROT-5. Bis hierher erwartete er `[]` und schrieb damit genau die Semantik fest, die
    // Architektur 04 §4 verbietet: eine leere Treffermenge heisst fachlich „nichts gefunden" und
    // darf „der aktive Bestand ist beschädigt" nicht verdecken. Der Fassungsfilter allein verhindert
    // zwar den FALSCHEN V1-Treffer — aber er verwandelt den beschädigten Bestand in eine stille
    // Leermenge, und das ist die zweite verbotene Antwort.
    //
    // Jetzt gilt: die Rückschreibung auf Fassung 1 kann die aktive Generation nicht tragen, fällt
    // deshalb den Integritätsmarker (09 §3) — und die nächste Suche antwortet ehrlich mit dem
    // internen Readiness-Fehler. Nach aussen wird daraus generisch HTTP 500 `INTERNAL`.
    const { repo, projections, ko, zielId } = await benAufbau();
    await ko.activateSearchProjectionV2();
    expect((await ko.findSearchHits({ terms: [NEU.toLowerCase()] })).map((h) => h.koId)).toEqual([
      zielId,
    ]);

    const ziel = (await repo.findById(zielId)) as KnowledgeObject;
    await projections.replace(v1Zeile(ziel, ALT));

    // WEDER der alte Begriff (das wäre der Mischbetrieb) …
    await expect(ko.findSearchHits({ terms: [ALT.toLowerCase()] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    // … NOCH der neue (das wäre die stille Teilmenge): der ganze Bestand ist unglaubwürdig, nicht
    // nur die eine Zeile.
    await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    // Der Marker ist gefallen; der Zustand selbst wird NICHT still umgeschrieben (er bleibt
    // beobachtbar `V2_ACTIVE` mit ungültigem Marker — die Recovery ist eine Handlung, keine
    // Nebenwirkung des Lesens).
    const control = await ko.searchProjectionControl();
    expect(control.integrityMarker).toBeNull();
    expect(control.activeGeneration).not.toBeNull();
    // Die Zeile IST da — sie ist nur keine Suchgrundlage mehr.
    expect((await ko.searchProjectionOf(zielId))?.projectionVersion).toBe(1);
    expect((await ko.searchProjectionOf(zielId))?.searchText).toContain(ALT);

    // UND DER WEG ZURÜCK ist die vollständige V2-Recovery (Entscheidung 08 §1) — kein Handanlegen
    // am Repository.
    await ko.recoverSearchProjectionV2("Gegenprobe");
    expect((await ko.findSearchHits({ terms: [NEU.toLowerCase()] })).map((h) => h.koId)).toEqual([
      zielId,
    ]);
    await expect(ko.findSearchHits({ terms: [ALT.toLowerCase()] })).resolves.toEqual([]);
  });

  it("V1-Zeilen bleiben physisch unverändert und historisch vorhanden (03 §2)", async () => {
    const { repo, projections, ko } = stack();
    // Ein Objekt mit ZWEI Versionen: die historische Zeile ist Fassung 1 und bleibt es.
    const objektV2 = { ...objekt("historie", NEU, "Zweitkoerperwort"), version: 2 };
    await repo.insert(objektV2 as KnowledgeObject);
    const historisch = v1Zeile(objektV2 as KnowledgeObject, ALT, 1);
    await projections.insert(historisch);

    await ko.activateSearchProjectionV2();

    // Byte-gleich erhalten — der Rebuild fasst historische Zeilen nicht an.
    expect(await projections.find("historie", 1)).toEqual(historisch);
    expect((await ko.searchProjectionsOf("historie")).map((p) => p.projectionVersion)).toEqual([
      1,
      SEARCH_PROJECTION_VERSION,
    ]);
    // Und sie ist trotzdem kein regulärer Treffer.
    expect(await ko.findSearchHits({ terms: [ALT.toLowerCase()] })).toEqual([]);
  });
});

// ================================================================================================
// 14/15/16 — BACKFILL, FUSSNOTEN-MAINTENANCE UND DER ÄUSSERE VERTRAG
// ================================================================================================

describe("G27 R1 · Pflichtfälle 14–16 · was der Backfill NICHT darf und was unverändert bleibt", () => {
  it("ein Backfill-Lauf lässt den Control-State byte-gleich (04 §5, §8)", async () => {
    const { ko } = await benAufbau();
    const vorherUninit = await ko.searchProjectionControl();
    await ko.backfillSearchProjections({ limit: 100 });
    // Er aktiviert nichts, gibt keine Readiness frei und bestätigt keine Konsistenz — auch dann
    // nicht, wenn er den Bestand vollständig fertig gemacht hat.
    expect(await ko.searchProjectionControl()).toEqual(vorherUninit);
    expect((await ko.searchProjectionVersions()).offenV1).toBe(0);
    await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });

    // Auch im laufenden Betrieb ändert er nichts an der Steuerzeile.
    await ko.activateSearchProjectionV2();
    const imBetrieb = await ko.searchProjectionControl();
    await ko.backfillSearchProjections({ limit: 100 });
    expect(await ko.searchProjectionControl()).toEqual(imBetrieb);
  });

  it("der Fußnoten-Nachzug läuft über die Reconcile-Kette — ohne jeden Suchaufruf (05 §4)", async () => {
    const { repo, ko } = stack();
    await repo.insert(objekt("mit-bild", "Wartung", "x") as KnowledgeObject & { bodyHtml: string });
    const mitBild = (await repo.findById("mit-bild")) as KnowledgeObject;
    await repo.update({
      ...mitBild,
      bodyHtml:
        '<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-1">Fussnotenwort</figcaption></figure>',
    });
    expect((await repo.findById("mit-bild"))?.captionTexts).toBeUndefined();

    await ko.beginSearchProjectionBuild();
    await ko.reconcileSearchProjections();

    // Der Nachzug ist gelaufen, und es wurde nie gesucht.
    expect((await repo.findById("mit-bild"))?.captionTexts).toEqual(["Fussnotenwort"]);
  });

  it("der äußere Treffervertrag und das Ranking sind unverändert", async () => {
    const { ko } = stack();
    const erstellt = await ko.create({
      title: "Vertragstitel",
      statement: "Aussage.",
      type: "best_practice",
      category: "Vertragskategorie",
      tags: ["Vertragsschlagwort"],
      author: "anna",
      bodyHtml: "<p>Vertragskoerperwort</p>",
    });
    await ko.activateSearchProjectionV2();
    const [treffer] = await ko.findSearchHits({ terms: ["vertragskoerperwort"] });
    // Dieselben Felder, dieselben Namen, dieselbe Bedeutung von `matched.body` wie vor R1.
    expect(Object.keys(treffer as object).sort()).toEqual([
      "contentHash",
      "koId",
      "koVersion",
      "language",
      "matched",
      "projectionVersion",
      "status",
    ]);
    expect(treffer?.koId).toBe(erstellt.id);
    expect(treffer?.matched).toEqual({
      title: false,
      statement: false,
      category: false,
      tag: false,
      caption: false,
      body: true,
    });
  });
});

// ================================================================================================
// G27 R1 · Entscheidung 09 — DIE PFLICHTGEGENPROBEN ZU GENERATION UND INTEGRITÄT (In-Memory)
// ================================================================================================
//
// Jede Beschreibung hier hat ein benanntes Gegenstück in `KW-ARCH-G27-GENERATION-UND-INTEGRITAET-09`
// §5. Sie prüfen NICHT, dass der Code tut, was er tut — sie prüfen, dass die vier Wege, auf denen
// BEN einen inkonsistenten `V2_ACTIVE` erzeugt hat, jetzt alle in einem ehrlichen Fehler enden.

describe("G27 R1 · Pflichtgegenprobe · Gate gegen parallele Mutation (09 §5)", () => {
  it("eine Mutation WÄHREND der Gate-Prüfung wird von der Sperre gehalten — nie inkonsistentes V2_ACTIVE", async () => {
    // BENs ROT-4, wörtlich: eine Projektionszeile wurde exakt zwischen bestandener Readiness und
    // dem CAS auf Fassung 1 verändert; die Freigabe lief trotzdem durch, und danach lieferte die
    // Suche `[]`. Jetzt läuft die Prüfung UNTER der Sperre, und die Mutation kommt nicht dazwischen.
    const { repo, projections, ko, zielId } = await benAufbau();
    await ko.beginSearchProjectionBuild();
    await ko.rebuildSearchProjections();
    const nachBau = await ko.searchProjectionControl();
    await projections.compareAndSetControlState("V2_BUILDING", {
      ...nachBau,
      lastSuccessfulRebuild: AT,
    });
    await ko.reconcileSearchProjections();
    await ko.finishSearchProjectionBuild();

    // Der Angriff: die Rückschreibung wird gestartet, OHNE auf sie zu warten — sie soll genau in
    // das Fenster fallen, das es früher gab.
    const ziel = (await repo.findById(zielId)) as KnowledgeObject;
    const mutation = projections.replace(v1Zeile(ziel, ALT));
    const freigabe = ko.releaseSearchProjectionVersion();

    // ENTWEDER die Freigabe gewinnt (die Mutation wartete) ODER sie scheitert (die Mutation war
    // vorher da). Ein drittes Ergebnis — freigegeben UND beschädigt — darf es nicht geben.
    const ergebnis = await freigabe.then(
      (c) => ({ freigegeben: true, control: c }),
      () => ({ freigegeben: false, control: null }),
    );
    await mutation;

    const control = await ko.searchProjectionControl();
    if (ergebnis.freigegeben) {
      // Freigegeben — dann hat die Mutation danach den Marker gefällt, und die Suche ist
      // fail-closed statt still leer.
      expect(control.activeGeneration).not.toBeNull();
      await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
    } else {
      // Nicht freigegeben — dann bedient die Instanz erst recht keine Suche.
      expect(control.projectionState).not.toBe("V2_ACTIVE");
      await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
    }
  });

  it("FREMDGENERATION: wer Generation N geprüft hat, gibt nicht Generation M frei", async () => {
    const { ko } = await benAufbau();
    await ko.activateSearchProjectionV2();
    const aktiv = await ko.searchProjectionControl();
    const generation = aktiv.activeGeneration as number;

    // Zurück in den Bau — dabei klettert die Generation. Eine Freigabe, die noch die ALTE
    // Generation im Sinn hat, prüft damit einen Bau, den es nicht mehr gibt.
    await ko.rollbackSearchProjectionVersion("Neuer Zyklus");
    await ko.beginSearchProjectionBuild();
    await ko.rebuildSearchProjections();
    const imBau = await ko.searchProjectionControl();
    expect(imBau.buildGeneration).toBe(generation + 1);
    await expect(ko.releaseSearchProjectionVersion(generation)).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
  });
});

describe("G27 R1 · Pflichtgegenprobe · nachträgliche Beschädigung ist nie `[]` (09 §5)", () => {
  it("ENTFERNUNG einer bedienenden Zeile: fail-closed statt stiller Leermenge", async () => {
    const { ko, projections, zielId } = await benAufbau();
    await ko.activateSearchProjectionV2();
    const ziel = await ko.searchProjectionOf(zielId);
    expect(ziel).toBeDefined();

    // Kein Rücknahmefall, sondern ein Eingriff: die Zeile eines LEBENDEN Objekts verschwindet.
    await projections.remove(zielId, ziel?.koVersion as number);

    await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    expect((await ko.searchProjectionControl()).integrityMarker).toBeNull();
  });

  it("FREMDGENERATION an der Zeile: dieselbe Antwort — der Bestand ist nicht mehr der geprüfte", async () => {
    const { repo, projections, ko, zielId } = await benAufbau();
    await ko.activateSearchProjectionV2();
    // Der Bau ist vorbei; wer jetzt noch eine Zeile der Zielfassung schreibt, bekommt die aktive
    // Generation — das ist der reguläre Weg. Eine Zeile mit einer FREMDEN Generation entsteht nur
    // ausserhalb dieses Weges. Sie ist über den Vertrag gar nicht erzeugbar; genau deshalb wird
    // hier gemessen, dass die Suche eine Zeile ohne die aktive Generation nicht bedient.
    const ziel = (await repo.findById(zielId)) as KnowledgeObject;
    expect(await projections.generationOf(zielId, ziel.version)).toBe(
      (await ko.searchProjectionControl()).activeGeneration,
    );
    // Und die Gegenprobe, dass diese Bindung wirkt: eine fremde Generation im Gate-Vergleich.
    expect(await projections.activeRowsInGeneration(9999)).toBe(false);
  });

  it("die REGULÄRE Einpflegung nach der Freigabe ist KEINE Beschädigung — sonst wäre die App tot", async () => {
    // Die notwendige Gegenprobe zu den beiden Fällen darüber: würde jede Mutation nach der
    // Freigabe den Marker fällen, könnte nach der Inbetriebnahme nie wieder etwas eingepflegt
    // werden. Der reguläre Weg trägt die aktive Generation und hält die Zusage ein.
    const { repo, ko } = await benAufbau();
    await ko.activateSearchProjectionV2();
    const vorher = await ko.searchProjectionControl();

    await repo.insert(objekt("frisch", "Wartung", "Frischkoerperwort"));
    await ko.backfillSearchProjections({ limit: 50 });

    const nachher = await ko.searchProjectionControl();
    expect(nachher.integrityMarker).toBe(vorher.integrityMarker);
    expect(nachher.activeGeneration).toBe(vorher.activeGeneration);
    expect((await ko.findSearchHits({ terms: ["frischkoerperwort"] })).map((h) => h.koId)).toEqual([
      "frisch",
    ]);
  });
});

describe("G27 R1 · Pflichtgegenprobe · die Übergänge zu V1 (09 §4)", () => {
  it("eine LEERE Neuinstanz kann V1 nicht aktivieren — `every([])` genügt nicht mehr", async () => {
    // BENs ROT-6, wörtlich: `{"before":"UNINITIALIZED","after":"V1_ACTIVE","active":1}`.
    const { ko } = stack();
    expect((await ko.searchProjectionControl()).projectionState).toBe("UNINITIALIZED");
    await expect(ko.declareSearchProjectionV1Active()).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    expect((await ko.searchProjectionControl()).projectionState).toBe("UNINITIALIZED");
  });

  it("ein ECHTER vollständiger Legacy-V1-Bestand darf EINMALIG bestätigt werden", async () => {
    const { repo, projections, ko } = stack();
    const legacy = objekt("legacy", ALT, "Legacykoerperwort");
    await repo.insert(legacy);
    await projections.insert(v1Zeile(legacy, ALT));
    await projections.metadata.upsert({ koId: legacy.id, categoryText: ALT, tagText: "", at: AT });

    const control = await ko.declareSearchProjectionV1Active();
    expect(control.projectionState).toBe("V1_ACTIVE");
    expect(control.activeProjectionVersion).toBe(1);
    // Der Legacy-Betrieb ist UNGENERATIONIERT — er hat nie einen V2-Zyklus durchlaufen, und eine
    // erfundene Generation wäre genau die Behauptung, die Entscheidung 09 abschafft.
    expect(control.buildGeneration).toBe(0);
    expect(control.activeGeneration).toBeNull();
    // Und er bedient: eine bestätigte Legacy-Instanz ist nicht suchtot.
    expect((await ko.findSearchHits({ terms: [ALT.toLowerCase()] })).map((h) => h.koId)).toEqual([
      "legacy",
    ]);
  });

  it("NACH V2 wird V1 immer abgelehnt — auch wenn der Bestand zufällig wieder wie V1 aussieht", async () => {
    const { repo, projections, ko } = stack();
    const objekt1 = objekt("nachV2", NEU, "Koerperwort");
    await repo.insert(objekt1);
    await ko.activateSearchProjectionV2();
    expect((await ko.searchProjectionControl()).projectionState).toBe("V2_ACTIVE");

    await expect(ko.declareSearchProjectionV1Active()).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
    // Auch nach FAILED nicht: die Generation überlebt den Abbruch und ist der Beleg, dass hier
    // einmal ein V2-Zyklus lief.
    await ko.rollbackSearchProjectionVersion("Abbruch");
    await projections.replace(v1Zeile(objekt1, ALT));
    await expect(ko.declareSearchProjectionV1Active()).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });
  });
});

describe("G27 R1 · Pflichtgegenprobe · Wiederanlauf aus jedem Zustand (06 §2)", () => {
  it("V2_BUILDING wird IDEMPOTENT fortgesetzt — dieselbe Generation, kein neuer Zyklus", async () => {
    const { ko } = await benAufbau();
    await ko.beginSearchProjectionBuild();
    const imBau = await ko.searchProjectionControl();
    expect(imBau.projectionState).toBe("V2_BUILDING");

    const { control } = await ko.continueSearchProjectionBuild();
    expect(control.projectionState).toBe("V2_ACTIVE");
    // DIESELBE Generation: der halbfertige Bestand des Vorgängers wird fortgesetzt, nicht entwertet.
    expect(control.activeGeneration).toBe(imBau.buildGeneration);
  });

  it("V2_READY wird nur noch freigegeben — ohne Rebuild", async () => {
    const { ko, projections } = await benAufbau();
    await ko.beginSearchProjectionBuild();
    await ko.rebuildSearchProjections();
    // Die Rebuild-Vorbedingung wird wie im Produktweg über den Control-CAS gesetzt (dasselbe, was
    // `continueSearchProjectionBuild` tut) — danach Reconcile und Gate.
    const nachBau = await ko.searchProjectionControl();
    // 10.08.2026 — WAR `lastSuccessfulRebuild: AT` UND MIT DEM KALENDER VERFALLEN.
    //
    // Die Pruefung lautet `lastSuccessfulRebuild >= buildStartedAt` (service.ts:1070-1073): der
    // Rebuild muss zu DIESEM Bau gehoeren. `AT` ist der feste 02.08.2026, `buildStartedAt` kommt
    // aus der echten Uhr — solange es der 02.08. war, ging das gut; ab dem 03.08. lag der Stempel
    // vor dem Bau. Der Fall wurde nicht durch eine Aenderung rot, sondern durch Zeitablauf, und er
    // haette an jedem Tag nach dem 02.08. rot sein muessen.
    //
    // Der Stempel haengt jetzt am BAU statt am Kalender — dieselbe Zusage wie im Produktweg
    // (`continueSearchProjectionBuild`, service.ts:1295-1298, stempelt `now()`), aber ohne
    // Verfallsdatum.
    await projections.compareAndSetControlState("V2_BUILDING", {
      ...nachBau,
      lastSuccessfulRebuild: nachBau.buildStartedAt ?? new Date().toISOString(),
    });
    await ko.reconcileSearchProjections();
    const { control: bereit } = await ko.finishSearchProjectionBuild();
    expect(bereit.projectionState).toBe("V2_READY");

    // Aus V2_READY heraus wird NUR noch freigegeben: kein zweiter Rebuild, keine neue Generation.
    const control = await ko.releaseSearchProjectionVersion(bereit.buildGeneration);
    expect(control.projectionState).toBe("V2_ACTIVE");
    expect(control.activeGeneration).toBe(bereit.buildGeneration);
  });

  it("FAILED führt über die vollständige V2-Recovery zurück — und vorher bedient nichts", async () => {
    const { ko, zielId } = await benAufbau();
    await ko.activateSearchProjectionV2();
    await ko.rollbackSearchProjectionVersion("Störung");
    expect((await ko.searchProjectionControl()).projectionState).toBe("FAILED");
    await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
      code: "SEARCH_PROJECTION_NOT_READY",
    });

    const { control } = await ko.recoverSearchProjectionV2("Wiederinbetriebnahme");
    expect(control.projectionState).toBe("V2_ACTIVE");
    expect((await ko.findSearchHits({ terms: [NEU.toLowerCase()] })).map((h) => h.koId)).toEqual([
      zielId,
    ]);
  });
});
