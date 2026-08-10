// ================================================================================================
// G27 WELLE 1 / S1 — DIE UNVERÄNDERLICHE CONTENT PROJECTION, FASSUNG 2
// ================================================================================================
//
// Diese Datei misst die FELD- UND HASHGRENZE der revisionsgebundenen Projektion und die
// revisionsgebundene Klassifizierungsreferenz. Sie prüft ausdrücklich, was NICHT hineingehört —
// denn genau daran ist die erste PRO-Umsetzung gescheitert (Kategorie und Schlagwörter lagen
// append-only an einer Inhaltsversion, obwohl sie ohne Versions-Bump wandern).
//
// Belegt: Akzeptanzkriterien 1 (Feld-/Hashgrenze), 2 (eigenes body_text) und 3 (historische
// Klassifizierung stabil, explizites `none`, Snapshot autorisiert nie).
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  CLASSIFICATION_SOURCE,
  type ClassificationSnapshot,
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  KoService,
  SEARCH_PROJECTION_FIELDS,
  SEARCH_PROJECTION_VERSION,
  buildSearchProjection,
  isConfidential,
  isReconstructedClassification,
  searchProjectionContentHash,
  serializeClassificationSnapshot,
  visibleTextFromBodyHtml,
} from "../../services/knowledge-object";

const AT = "2026-08-02T09:00:00.000Z";

function stack() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const versions = new InMemoryKoVersionRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const ko = new KoService({ repo, versions, audit, searchProjections: projections });
  return { repo, projections, versions, audit, ko };
}

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Dosierpumpe warten",
    statement: "Regelmäßig entlüften.",
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
    asset: null,
    createdAt: AT,
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const EINGABE = {
  title: "Spezialpresse SPX9",
  statement: "Kurzfassung.",
  type: "best_practice" as const,
  category: "Wartung",
  author: "anna",
};

// ================================================================================================
// AK 1 — DIE FELD- UND HASHGRENZE
// ================================================================================================

describe("G27 Welle 1 · AK1 · Feld- und Hashgrenze der Content Projection", () => {
  it("die Projektionsfassung ist 2 und steht im Hash", () => {
    expect(SEARCH_PROJECTION_VERSION).toBe(2);
    expect(buildSearchProjection(ko(), AT).projectionVersion).toBe(2);
  });

  it("Kategorie und Schlagwörter sind KEIN Feld der Content Projection", () => {
    const p = buildSearchProjection(ko({ category: "Wartung", tags: ["hydraulik"] }), AT);
    expect(Object.keys(p)).not.toContain("categoryText");
    expect(Object.keys(p)).not.toContain("tagText");
    expect(SEARCH_PROJECTION_FIELDS).not.toContain("categoryText");
    expect(SEARCH_PROJECTION_FIELDS).not.toContain("tagText");
  });

  it("eine andere Kategorie ändert den content_hash NICHT", () => {
    const a = buildSearchProjection(ko({ category: "Wartung" }), AT);
    const b = buildSearchProjection(ko({ category: "Montage" }), AT);
    expect(b.contentHash).toBe(a.contentHash);
    expect(b.searchText).toBe(a.searchText);
  });

  it("andere Schlagwörter ändern den content_hash NICHT", () => {
    const a = buildSearchProjection(ko({ tags: [] }), AT);
    const b = buildSearchProjection(ko({ tags: ["hydraulik", "presse"] }), AT);
    expect(b.contentHash).toBe(a.contentHash);
  });

  it("Quellen-Label und -Auszug bleiben vollständig draußen — kein Feld, kein Suchtext, kein Hash", () => {
    const ohne = buildSearchProjection(ko({ sources: [] }), AT);
    const mit = buildSearchProjection(
      ko({
        sources: [
          {
            id: "q1",
            label: "QUELLENLABELWORT",
            excerpt: "QUELLENAUSZUGWORT",
          },
        ] as unknown as KnowledgeObject["sources"],
      }),
      AT,
    );
    expect(mit.contentHash).toBe(ohne.contentHash);
    expect(JSON.stringify(mit)).not.toContain("QUELLENLABELWORT");
    expect(JSON.stringify(mit)).not.toContain("QUELLENAUSZUGWORT");
  });

  it("geänderter INHALT ändert den Hash sehr wohl (Kalibrierung: der Hash misst überhaupt etwas)", () => {
    const a = buildSearchProjection(ko({ bodyHtml: "<p>Alpha</p>" }), AT);
    const b = buildSearchProjection(ko({ bodyHtml: "<p>Beta</p>" }), AT);
    expect(b.contentHash).not.toBe(a.contentHash);
  });

  it("weder Kategorie noch Schlagwort ist über die Content Projection auffindbar", async () => {
    const { ko: dienst, projections } = stack();
    const erstellt = await dienst.create({
      ...EINGABE,
      category: "Sonderkategoriewort",
      tags: ["Sonderschlagwort"],
    });
    const inhalt = await projections.find(erstellt.id, 1);
    expect(inhalt?.searchText).not.toContain("Sonderkategoriewort");
    expect(inhalt?.searchText).not.toContain("Sonderschlagwort");
  });
});

// ================================================================================================
// AK 1b — DER VOLLSTÄNDIGE SNAPSHOT IM content_hash (Detailentscheidung J)
// ================================================================================================
//
// Die Zusage: der komplette kanonische `classification_snapshot` ist hashgeschützt — alle SIEBEN
// Felder. Der frühere Vertrag hashte nur `value` und `source`; damit ließ sich eine append-only
// Zeile still von „rekonstruiert/unbestätigt" auf „erfasst/bestätigt" umschreiben, ohne dass ein
// einziger Prüfwert sich bewegte. Genau das ist hier gemessen und ausgeschlossen.
//
// GEPRÜFT WIRD MIT EINZELMUTATIONEN: je Feld genau EINE Abweichung gegenüber derselben Grundlage.
// Nur so ist die Aussage „dieses Feld ist hashwirksam" belegt und nicht bloß „irgendetwas hat sich
// geändert".

const GRUND_SNAPSHOT: ClassificationSnapshot = {
  value: "vertraulich",
  source: CLASSIFICATION_SOURCE,
  koVersion: 1,
  capturedAt: "2024-03-01T08:00:00.000Z",
  capturedAtSource: "version_event",
  provenance: "captured_at_version",
  historicalConfidence: "verified",
};

// Die Nicht-Klassifizierungsseite des Hasheingangs — bei allen Einzelmutationen identisch.
const GRUND_INHALT = {
  projectionVersion: SEARCH_PROJECTION_VERSION,
  koId: "ko-1",
  koVersion: 1,
  language: "und",
  status: "vollstaendig" as const,
  titleText: "Dosierpumpe warten",
  statementText: "Regelmäßig entlüften.",
  captionText: "",
  bodyText: "Absatz",
  searchText: "Dosierpumpe warten\nRegelmäßig entlüften.\nAbsatz",
};

function hashMit(snapshot: ClassificationSnapshot): string {
  return searchProjectionContentHash({
    ...GRUND_INHALT,
    classificationValue: snapshot.value,
    classificationSource: snapshot.source,
    classificationEvidence: {
      koVersion: snapshot.koVersion,
      capturedAt: snapshot.capturedAt,
      capturedAtSource: snapshot.capturedAtSource,
      provenance: snapshot.provenance,
      historicalConfidence: snapshot.historicalConfidence,
    },
  });
}

// Je Feld eine EINZELNE, unabhängige Abweichung — sonst nichts.
const EINZELMUTATIONEN: { feld: string; snapshot: ClassificationSnapshot }[] = [
  { feld: "value", snapshot: { ...GRUND_SNAPSHOT, value: "streng_vertraulich" } },
  {
    feld: "source",
    // `source` ist im Feldvertrag ein Literaltyp (es gibt heute genau eine Quelle). Für die
    // Einzelmutation wird er bewusst umgebogen: die Frage ist, ob der HASH ihn führt — nicht, ob
    // das Domänenmodell heute eine zweite Quelle kennt.
    snapshot: {
      ...GRUND_SNAPSHOT,
      source: "fremde_quelle",
    } as unknown as ClassificationSnapshot,
  },
  { feld: "koVersion", snapshot: { ...GRUND_SNAPSHOT, koVersion: 2 } },
  { feld: "capturedAt", snapshot: { ...GRUND_SNAPSHOT, capturedAt: "2024-03-02T08:00:00.000Z" } },
  {
    feld: "capturedAtSource",
    snapshot: { ...GRUND_SNAPSHOT, capturedAtSource: "ko_created_at" },
  },
  {
    feld: "provenance",
    snapshot: { ...GRUND_SNAPSHOT, provenance: "reconstructed_from_current_ko" },
  },
  {
    feld: "historicalConfidence",
    snapshot: { ...GRUND_SNAPSHOT, historicalConfidence: "unknown" },
  },
];

describe("G27 Welle 1 · AK1b · der vollständige classification_snapshot im content_hash", () => {
  it("der Snapshot hat GENAU sieben kanonische Felder — die Liste ist vollständig", () => {
    expect(Object.keys(GRUND_SNAPSHOT).sort()).toEqual([
      "capturedAt",
      "capturedAtSource",
      "historicalConfidence",
      "koVersion",
      "provenance",
      "source",
      "value",
    ]);
    expect(EINZELMUTATIONEN.map((m) => m.feld).sort()).toEqual(Object.keys(GRUND_SNAPSHOT).sort());
  });

  it.each(EINZELMUTATIONEN)(
    "eine Einzelmutation von `$feld` ändert den content_hash",
    ({ snapshot }) => {
      expect(hashMit(snapshot)).not.toBe(hashMit(GRUND_SNAPSHOT));
    },
  );

  it("alle sieben Mutationen ergeben SIEBEN verschiedene Hashes (kein Feld fällt mit einem anderen zusammen)", () => {
    const hashes = new Set(EINZELMUTATIONEN.map((m) => hashMit(m.snapshot)));
    hashes.add(hashMit(GRUND_SNAPSHOT));
    expect(hashes.size).toBe(EINZELMUTATIONEN.length + 1);
  });

  it("gleicher Snapshot und gleicher Inhalt ⇒ deterministisch derselbe Hash", () => {
    expect(hashMit(GRUND_SNAPSHOT)).toBe(hashMit({ ...GRUND_SNAPSHOT }));
    expect(hashMit(GRUND_SNAPSHOT)).toBe(hashMit(GRUND_SNAPSHOT));
  });

  it("DIESELBE Einstufung mit unterschiedlicher BELEGLAGE hasht unterschiedlich", () => {
    // Der Kern von Abschnitt J: `vertraulich` als revisionszeitlich erfasste, bestätigte Aussage
    // und dasselbe `vertraulich` als unbestätigte Rekonstruktion sind NICHT derselbe historische
    // Datensatz — auch wenn der Wert identisch ist.
    const rekonstruiert: ClassificationSnapshot = {
      ...GRUND_SNAPSHOT,
      capturedAtSource: "ko_created_at",
      provenance: "reconstructed_from_current_ko",
      historicalConfidence: "unknown",
    };
    expect(rekonstruiert.value).toBe(GRUND_SNAPSHOT.value);
    expect(hashMit(rekonstruiert)).not.toBe(hashMit(GRUND_SNAPSHOT));
  });

  it("ohne übergebene Beleglage hasht die Funktion die UNBESTÄTIGTE Lage — nie eine verifizierte", () => {
    // Die Beleglage ist im Hasheingang optional, damit ein Aufrufer sie nicht versehentlich
    // erfinden muss. Weggelassen heißt dann aber AUSDRÜCKLICH „unbestätigt" — und ist damit vom
    // verifizierten Fall unterscheidbar. Ein Default, der Sicherheit vortäuscht, ist ausgeschlossen.
    const ohneBeleg = searchProjectionContentHash({
      ...GRUND_INHALT,
      classificationValue: GRUND_SNAPSHOT.value,
      classificationSource: GRUND_SNAPSHOT.source,
    });
    const unbestaetigt = hashMit({
      ...GRUND_SNAPSHOT,
      capturedAt: null,
      capturedAtSource: "unknown",
      provenance: "reconstructed_from_current_ko",
      historicalConfidence: "unknown",
    });
    expect(ohneBeleg).toBe(unbestaetigt);
    expect(ohneBeleg).not.toBe(hashMit(GRUND_SNAPSHOT));
  });

  it("Hash und Zelle benutzen DIESELBE kanonische Serialisierung — es gibt keine zweite Textfassung", () => {
    // Wären es zwei, könnte die eine sich bewegen, ohne dass die andere es merkt. Der Beleg: der
    // serialisierte Snapshot steht wörtlich im gehashten Text (der Hash über genau diesen Text
    // stimmt mit dem der Funktion überein) …
    const serialisiert = serializeClassificationSnapshot(GRUND_SNAPSHOT);
    expect(serialisiert).toContain("captured_at_version");
    expect(serialisiert).toContain("verified");
    // … und die Serialisierung ist eine feste Reihenfolge, kein JSON-Objekt mit variabler
    // Schlüsselfolge.
    expect(serialisiert.startsWith("[")).toBe(true);
    expect(JSON.parse(serialisiert)).toEqual([
      "vertraulich",
      CLASSIFICATION_SOURCE,
      1,
      "2024-03-01T08:00:00.000Z",
      "version_event",
      "captured_at_version",
      "verified",
    ]);
  });

  it("DER PRODUKTIVE WEG bindet die Beleglage ebenfalls — buildSearchProjection, nicht nur die Hashfunktion", () => {
    const basis = buildSearchProjection(ko(), AT, { classification: GRUND_SNAPSHOT });
    for (const { snapshot } of EINZELMUTATIONEN) {
      const abweichend = buildSearchProjection(ko(), AT, { classification: snapshot });
      expect(abweichend.contentHash).not.toBe(basis.contentHash);
    }
    // Gegenprobe: derselbe Snapshot am selben Inhalt ⇒ derselbe Hash (der Zeitstempel des
    // Schreibvorgangs bleibt draußen, solange er nicht Teil des Snapshots ist).
    expect(
      buildSearchProjection(ko(), "2027-01-01T00:00:00.000Z", { classification: GRUND_SNAPSHOT })
        .contentHash,
    ).toBe(basis.contentHash);
  });

  it("KEINE STILLE MUTATION: eine bessere Beleglage an derselben Zeile fällt am Hash auf", () => {
    // Der No-Go aus Abschnitt J, als Angriff formuliert: jemand schreibt in einer append-only Zeile
    // `historical_confidence` von `unknown` auf `verified` und `provenance` auf einen erfassten
    // Wert. Vorher blieb der `content_hash` dabei gleich — die Fälschung wäre unsichtbar gewesen.
    const zeile = buildSearchProjection(ko(), AT, {
      classification: {
        ...GRUND_SNAPSHOT,
        provenance: "reconstructed_from_current_ko",
        historicalConfidence: "unknown",
      },
    });
    const aufgehuebscht: ClassificationSnapshot = {
      ...zeile.classificationSnapshot,
      provenance: "ko_version_snapshot",
      historicalConfidence: "verified",
    };
    // Die Zeile behauptet weiterhin ihren alten Hash — er passt nicht mehr zum Inhalt.
    expect(hashMit(aufgehuebscht)).not.toBe(hashMit(zeile.classificationSnapshot));
    expect(buildSearchProjection(ko(), AT, { classification: aufgehuebscht }).contentHash).not.toBe(
      zeile.contentHash,
    );
  });
});

// ================================================================================================
// AK 2 — body_text IST EIGENSTÄNDIG UND REVISIONSGEBUNDEN
// ================================================================================================

describe("G27 Welle 1 · AK2 · body_text ist eine eigene, revisionsgebundene Spalte", () => {
  it("body_text trägt den sichtbaren Dokumenttext der Version — nicht den Suchtext", () => {
    const body = "<p>Erster Absatz</p><p>Zweiter Absatz</p>";
    const p = buildSearchProjection(ko({ title: "TITELWORT", bodyHtml: body }), AT);
    expect(p.bodyText).toBe("Erster Absatz Zweiter Absatz");
    // Der Suchtext ist die VEREINIGUNG und trägt zusätzlich Titel/Aussage — er ist etwas anderes.
    expect(p.searchText).toContain("TITELWORT");
    expect(p.bodyText).not.toContain("TITELWORT");
  });

  it("body_text ist NICHT aus dem normalisierten search_text rekonstruiert", () => {
    // Der Beweis: der Suchtext trägt Titel und Aussage vor dem Body. Wer body_text aus ihm
    // zurückrechnen wollte, müsste raten, wo der Body anfängt — genau das ist das No-Go aus
    // Detailentscheidung A. Hier steht der Body eigenständig und deckungsgleich mit seiner Quelle.
    const body = "<p>Reiner Dokumenttext ohne Kurzfelder</p>";
    const p = buildSearchProjection(ko({ bodyHtml: body }), AT);
    expect(p.bodyText).toBe(visibleTextFromBodyHtml(body).trim());
    expect(p.searchText.startsWith(p.bodyText)).toBe(false);
  });

  it("jede Version trägt ihren EIGENEN body_text; die alte Zeile bleibt unangetastet", async () => {
    const { ko: dienst } = stack();
    const erstellt = await dienst.create({ ...EINGABE, bodyHtml: "<p>ERSTFASSUNGSWORT</p>" });
    const v1 = await dienst.searchProjectionOf(erstellt.id, 1);
    await dienst.revise(erstellt.id, { bodyHtml: "<p>ZWEITFASSUNGSWORT</p>" }, "anna");
    const v2 = await dienst.searchProjectionOf(erstellt.id, 2);

    expect(v1?.bodyText).toBe("ERSTFASSUNGSWORT");
    expect(v2?.bodyText).toBe("ZWEITFASSUNGSWORT");
    // Die revisionsgebundene Quelle: der Versions-Snapshot der Version 1 trägt genau diesen Body.
    const snapshots = await dienst.versionsOf(erstellt.id);
    const snapshot1 = snapshots.find((s) => s.version === 1);
    expect(visibleTextFromBodyHtml(snapshot1?.snapshot.bodyHtml).trim()).toBe(v1?.bodyText);
    // Und die alte Zeile ist unverändert (append-only).
    expect(await dienst.searchProjectionOf(erstellt.id, 1)).toEqual(v1);
  });

  it("ein Objekt ohne Body hat einen leeren body_text — kein undefined, kein Rateversuch", () => {
    expect(buildSearchProjection(ko({ bodyHtml: null }), AT).bodyText).toBe("");
  });
});

// ================================================================================================
// AK 3 — DIE HISTORISCHE KLASSIFIZIERUNG
// ================================================================================================

describe("G27 Welle 1 · AK3 · classification_snapshot", () => {
  it("fehlende Vertraulichkeit wird ausdrücklich `none` — nie intern, nie eine Freigabe", () => {
    // Der Basis-Bauplan trägt bewusst KEINE Vertraulichkeit — genau der Altbestandsfall.
    const p = buildSearchProjection(ko(), AT);
    expect(p.classificationSnapshot.value).toBe("none");
    expect(p.classificationSnapshot.value).not.toBe("intern");
    expect(p.classificationSnapshot.value).not.toBe("public");
    // `none` ist keine Zugriffsfreigabe: die Live-Prüfung kennt den Wert überhaupt nicht.
    expect(isConfidential(undefined)).toBe(false);
  });

  it("ein vorhandener Wert wird übernommen — kein `none`, wenn es etwas zu sagen gibt", () => {
    const p = buildSearchProjection(ko({ confidentiality: "streng_vertraulich" }), AT);
    expect(p.classificationSnapshot.value).toBe("streng_vertraulich");
    expect(p.classificationSnapshot.source).toBe(CLASSIFICATION_SOURCE);
    expect(p.classificationSnapshot.koVersion).toBe(1);
  });

  it("der Schreibweg erfasst revisionszeitlich: provenance/confidence sind belastbar", async () => {
    const { ko: dienst } = stack();
    const erstellt = await dienst.create({ ...EINGABE, confidentiality: "vertraulich" });
    const snapshot = (await dienst.searchProjectionOf(erstellt.id))?.classificationSnapshot;
    expect(snapshot?.value).toBe("vertraulich");
    expect(snapshot?.provenance).toBe("captured_at_version");
    expect(snapshot?.historicalConfidence).toBe("verified");
    expect(snapshot?.capturedAtSource).toBe("version_event");
    expect(isReconstructedClassification(snapshot!)).toBe(false);
  });

  it("HISTORISCH STABIL: eine spätere Herabstufung lässt den alten Snapshot unberührt", async () => {
    const { ko: dienst } = stack();
    const erstellt = await dienst.create({ ...EINGABE, confidentiality: "streng_vertraulich" });
    const vorher = await dienst.searchProjectionOf(erstellt.id, 1);
    expect(vorher?.classificationSnapshot.value).toBe("streng_vertraulich");

    await dienst.setConfidentiality(erstellt.id, "intern", "admin", { mayDowngrade: true });

    // Die Geschichte wird NICHT umgeschrieben …
    const nachher = await dienst.searchProjectionOf(erstellt.id, 1);
    expect(nachher).toEqual(vorher);
    expect(nachher?.classificationSnapshot.value).toBe("streng_vertraulich");
    // … und der LIVE-Zustand ist der einzige, der über Zugriff entscheidet.
    const live = await dienst.get(erstellt.id);
    expect(live?.confidentiality).toBe("intern");
    expect(isConfidential(live?.confidentiality)).toBe(false);
  });

  it("DER SNAPSHOT AUTORISIERT NIE: das Live-Gate liest ausschließlich den aktuellen Zustand", async () => {
    const { ko: dienst } = stack();
    // Umgekehrter Fall: historisch harmlos, heute streng vertraulich. Wer den Snapshot als
    // Freigabe läse, gäbe ein vertrauliches Objekt frei.
    const erstellt = await dienst.create({ ...EINGABE });
    expect((await dienst.searchProjectionOf(erstellt.id))?.classificationSnapshot.value).toBe(
      "none",
    );
    await dienst.setConfidentiality(erstellt.id, "streng_vertraulich", "admin");

    const live = await dienst.get(erstellt.id);
    expect(isConfidential(live?.confidentiality)).toBe(true);
    // Der historische Snapshot sagt weiterhin `none` — und ist genau deshalb keine Entscheidung.
    expect((await dienst.searchProjectionOf(erstellt.id, 1))?.classificationSnapshot.value).toBe(
      "none",
    );
  });

  it("kein Autorisierungspfad des Moduls liest den historischen Snapshot", async () => {
    const { readFileSync } = await import("node:fs");
    // Die Live-Prüfung hängt an `confidentiality` des Objekts (confidentiality.ts) — dort kommt
    // der Snapshot nicht vor, und er darf dort auch nie vorkommen.
    const gate = readFileSync("services/knowledge-object/src/confidentiality.ts", "utf8");
    expect(gate).not.toContain("classificationSnapshot");
    expect(gate).not.toContain("classification_snapshot");
    // Und die Egress-/Exportentscheidung ebenso wenig.
    const output = readFileSync("services/output/src/service.ts", "utf8");
    expect(output).not.toContain("classificationSnapshot");
  });
});
