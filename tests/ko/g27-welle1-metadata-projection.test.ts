// ================================================================================================
// G27 WELLE 1 / S2 — DIE VERÄNDERLICHE METADATENPROJEKTION UND IHR AUDIT
// ================================================================================================
//
// Belegt: Akzeptanzkriterien 4 (Kategorie-/Tag-Suche bleibt im identischen äußeren Vertrag
// funktionsfähig; alte Werte verschwinden sofort, neue werden gefunden), 5 (`metadata_revision`
// erhöht sich genau einmal; identische Wiederholung ist idempotent) und 6 (vollständiger,
// unveränderlicher Metadaten-Audit).
//
// DER BEFUND, DEN DIESE DATEI FESTNAGELT: vor S2 lagen Kategorie und Schlagwörter append-only an
// (ko_id, ko_version). Ein `updateCategory` erzeugt aber KEINEN Versions-Bump — der alte Wert blieb
// also suchbar und der neue war unauffindbar. Genau das wird hier in beide Richtungen gemessen.
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
  METADATA_PROJECTION_FIELDS,
  METADATA_REVISION_NONE,
} from "../../services/knowledge-object";

// G27 R1 / Entscheidung 06 §4 — MECHANISCHE INITIALISIERUNG ÜBER DEN PRODUKTPFAD.
//
// Seit R1 ist die Standardsuche fail-closed: eine Instanz, deren Control-State auf `UNINITIALIZED`
// steht, beantwortet KEINE Suchanfrage. Ein direkter Testaufbau wie dieser ist eine solche
// Instanz — er baut den Dienst, aber niemand nimmt ihn in Betrieb. Genau das tut in der echten App
// die Startorchestrierung in `services/app/src/build-app.ts`.
//
// Deshalb läuft hier DERSELBE Aktivierungsweg und keine Testabkürzung: kein direktes Setzen des
// Control-States, kein abgeschwächtes Assert, kein Sonderpfad im Produktcode (06 §4/§6). Der
// Bestand ist zum Zeitpunkt der Aktivierung leer — exakt wie bei einer frisch gestarteten App;
// was danach angelegt wird, trägt die aktive Generation und ist reguläre Suchwahrheit.
async function stack() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const auditRepo = new InMemoryAuditRepo();
  const audit = new AuditService({ repo: auditRepo });
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    audit,
    searchProjections: projections,
  });
  await ko.activateSearchProjectionV2();
  return { repo, projections, audit, ko };
}

const EINGABE = {
  title: "Spezialpresse SPX9",
  statement: "Kurzfassung ohne Metadatenwörter.",
  type: "best_practice" as const,
  author: "anna",
};

const ids = async (ko: KoService, begriff: string): Promise<string[]> =>
  (await ko.findSearchHits({ terms: [begriff] })).map((h) => h.koId);

// ================================================================================================
// AK 4 — DER ÄUSSERE SUCHVERTRAG BLEIBT, VOR UND NACH DEM UPDATE
// ================================================================================================

describe("G27 Welle 1 · AK4 · Kategorie- und Schlagwortsuche im identischen äußeren Vertrag", () => {
  it("Kategorie und Schlagwort sind unmittelbar nach der Anlage auffindbar", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({
      ...EINGABE,
      category: "Kategoriewortalpha",
      tags: ["Schlagwortalpha"],
    });
    expect(await ids(ko, "kategoriewortalpha")).toEqual([erstellt.id]);
    expect(await ids(ko, "schlagwortalpha")).toEqual([erstellt.id]);
  });

  it("der äußere Trefferbau ist UNVERÄNDERT: dieselben Felder, dieselben Fundstellenmarken", async () => {
    const { ko } = await stack();
    await ko.create({ ...EINGABE, category: "Kategoriewortalpha", tags: ["Schlagwortalpha"] });
    const [hit] = await ko.findSearchHits({ terms: ["kategoriewortalpha"] });
    expect(Object.keys(hit as object).sort()).toEqual([
      "contentHash",
      "koId",
      "koVersion",
      "language",
      "matched",
      "projectionVersion",
      "status",
    ]);
    expect(hit?.matched).toEqual({
      title: false,
      statement: false,
      category: true,
      tag: false,
      caption: false,
      body: false,
    });
  });

  it("NACH updateCategory: der alte Wert ist SOFORT weg, der neue sofort da — ohne Versions-Bump", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Altkategoriewort" });
    expect(await ids(ko, "altkategoriewort")).toEqual([erstellt.id]);

    const nachher = await ko.updateCategory(erstellt.id, "Neukategoriewort", "anna");

    expect(await ids(ko, "altkategoriewort")).toEqual([]);
    expect(await ids(ko, "neukategoriewort")).toEqual([erstellt.id]);
    // Die Inhaltsversion ist dieselbe geblieben — genau das war der Anlass der Projektionsgrenze.
    expect(nachher.version).toBe(1);
    expect((await ko.searchProjectionsOf(erstellt.id)).map((p) => p.koVersion)).toEqual([1]);
  });

  it("NACH updateTags: alte Schlagwörter verschwinden, neue werden gefunden", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Wartung", tags: ["Altschlagwort"] });
    expect(await ids(ko, "altschlagwort")).toEqual([erstellt.id]);

    await ko.updateTags(erstellt.id, ["Neuschlagwort"], "anna");

    expect(await ids(ko, "altschlagwort")).toEqual([]);
    expect(await ids(ko, "neuschlagwort")).toEqual([erstellt.id]);
  });

  it("die Metadatenänderung lässt die unveränderliche Inhaltszeile byte-gleich", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({
      ...EINGABE,
      category: "Altkategoriewort",
      bodyHtml: "<p>Inhaltswort</p>",
    });
    const vorher = await ko.searchProjectionOf(erstellt.id, 1);
    await ko.updateCategory(erstellt.id, "Neukategoriewort", "anna");
    expect(await ko.searchProjectionOf(erstellt.id, 1)).toEqual(vorher);
    // Und der Inhalt bleibt auffindbar (der Suchvertrag verliert nichts).
    expect(await ids(ko, "inhaltswort")).toEqual([erstellt.id]);
  });
});

// ================================================================================================
// AK 5 — metadata_revision: GENAU EINMAL, WIEDERHOLUNG IDEMPOTENT
// ================================================================================================

describe("G27 Welle 1 · AK5 · metadata_revision ist monoton und idempotent", () => {
  it("der Feldvertrag der Metadatenprojektion steht als Datum fest", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Wartung" });
    const projektion = await ko.metadataProjectionOf(erstellt.id);
    expect(Object.keys(projektion as object).sort()).toEqual(
      [...METADATA_PROJECTION_FIELDS].sort(),
    );
    expect(METADATA_PROJECTION_FIELDS).toEqual([
      "koId",
      "categoryText",
      "tagText",
      "metadataRevision",
      "updatedAt",
    ]);
  });

  it("die Anlage legt Revision 1 an; jede WIRKSAME Änderung erhöht um GENAU EINS", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Eins" });
    expect((await ko.metadataProjectionOf(erstellt.id))?.metadataRevision).toBe(1);

    await ko.updateCategory(erstellt.id, "Zwei", "anna");
    expect((await ko.metadataProjectionOf(erstellt.id))?.metadataRevision).toBe(2);

    await ko.updateTags(erstellt.id, ["drei"], "anna");
    expect((await ko.metadataProjectionOf(erstellt.id))?.metadataRevision).toBe(3);
  });

  it("IDENTISCHE WIEDERHOLUNG ist idempotent: keine zweite Revision, kein zweiter Beleg", async () => {
    const { ko, audit } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Eins" });
    await ko.updateCategory(erstellt.id, "Zwei", "anna");
    const nachErstem = await ko.metadataProjectionOf(erstellt.id);

    await ko.updateCategory(erstellt.id, "Zwei", "anna");
    await ko.updateCategory(erstellt.id, "Zwei", "anna");

    expect(await ko.metadataProjectionOf(erstellt.id)).toEqual(nachErstem);
    expect((await audit.list({ action: "ko.category-changed" })).length).toBe(1);
  });

  it("auch die Wiederholung derselben Schlagwortfolge ist idempotent — eine Umsortierung nicht", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Wartung", tags: ["a", "b"] });
    const basis = (await ko.metadataProjectionOf(erstellt.id))?.metadataRevision ?? 0;

    await ko.updateTags(erstellt.id, ["a", "b"], "anna");
    expect((await ko.metadataProjectionOf(erstellt.id))?.metadataRevision).toBe(basis);

    // Die Reihenfolge ist eine Eingabe des Menschen und geht in den tag_text ein — sie zu ändern
    // IST eine wirksame Änderung und darf nicht als „schon so" durchgehen.
    await ko.updateTags(erstellt.id, ["b", "a"], "anna");
    expect((await ko.metadataProjectionOf(erstellt.id))?.metadataRevision).toBe(basis + 1);
  });

  it("die Revision sinkt nie — auch eine Rücknahme auf den alten Wert klettert weiter", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Eins" });
    await ko.updateCategory(erstellt.id, "Zwei", "anna");
    await ko.updateCategory(erstellt.id, "Eins", "anna");
    expect((await ko.metadataProjectionOf(erstellt.id))?.metadataRevision).toBe(3);
  });

  it("noch keine Zeile ist von Zeile ohne Kategorie unterscheidbar", async () => {
    const { repo, ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "" });
    // Projiziert, aber ohne Kategorietext: Revision 1, nicht 0.
    expect((await ko.metadataProjectionOf(erstellt.id))?.categoryText).toBe("");
    expect((await ko.metadataProjectionOf(erstellt.id))?.metadataRevision).toBe(1);
    // Ein am Dienst vorbei eingefügtes Objekt hat gar keine Zeile.
    await repo.insert({ ...erstellt, id: "am-dienst-vorbei" });
    expect(await ko.metadataProjectionOf("am-dienst-vorbei")).toBeUndefined();
    expect(METADATA_REVISION_NONE).toBe(0);
  });
});

// ================================================================================================
// AK 6 — DER UNVERÄNDERLICHE METADATEN-AUDIT
// ================================================================================================

describe("G27 Welle 1 · AK6 · der Metadaten-Audit ist vollständig und unveränderlich", () => {
  it("updateCategory belegt vorher/nachher, Actor, Zeitpunkt, Grund und neue Revision", async () => {
    const { ko, audit } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Alt", tags: ["t1"] });
    await ko.updateCategory(erstellt.id, "Neu", "anna");

    const [eintrag] = await audit.list({ action: "ko.category-changed" });
    expect(eintrag?.actor).toBe("anna");
    expect(eintrag?.target).toBe(erstellt.id);
    expect(eintrag?.at).toBeTruthy();
    const payload = eintrag?.payload as Record<string, unknown>;
    expect(payload.vorher).toEqual({ category: "Alt", tags: ["t1"] });
    expect(payload.nachher).toEqual({ category: "Neu", tags: ["t1"] });
    expect(payload.grund).toBe("ko.updateCategory");
    expect(payload.metadataRevision).toBe(
      (await ko.metadataProjectionOf(erstellt.id))?.metadataRevision,
    );
  });

  it("updateTags belegt genauso — der Weg war vorher gar nicht auditiert", async () => {
    const { ko, audit } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Wartung", tags: ["alt"] });
    await ko.updateTags(erstellt.id, ["neu", "frisch"], "bob");

    const [eintrag] = await audit.list({ action: "ko.tags-changed" });
    expect(eintrag?.actor).toBe("bob");
    const payload = eintrag?.payload as Record<string, unknown>;
    expect(payload.vorher).toEqual({ category: "Wartung", tags: ["alt"] });
    expect(payload.nachher).toEqual({ category: "Wartung", tags: ["neu", "frisch"] });
    expect(payload.grund).toBe("ko.updateTags");
    expect(payload.metadataRevision).toBe(2);
  });

  it("die Audit-Kette bleibt nach Metadatenänderungen prüfbar (unveränderlich)", async () => {
    const { ko, audit } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Wartung" });
    await ko.updateCategory(erstellt.id, "Montage", "anna");
    await ko.updateTags(erstellt.id, ["presse"], "anna");
    expect(await audit.verify()).toBe(true);
  });

  it("SICHERHEITSKLASSIFIZIERUNG LANDET NIE IN DIESER PROJEKTION", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({
      ...EINGABE,
      category: "Wartung",
      tags: ["presse"],
      confidentiality: "streng_vertraulich",
    });
    const projektion = await ko.metadataProjectionOf(erstellt.id);
    expect(JSON.stringify(projektion)).not.toContain("vertraulich");
    expect(Object.keys(projektion as object)).not.toContain("confidentiality");
    expect(Object.keys(projektion as object)).not.toContain("classificationSnapshot");

    // Und der Weg dorthin kann sie auch nicht transportieren: `updateTags` schreibt nur Schlagwörter.
    await ko.updateTags(erstellt.id, ["streng_vertraulich"], "anna");
    expect((await ko.get(erstellt.id))?.confidentiality).toBe("streng_vertraulich");
    // Ein „Schlagwort", das wie eine Stufe heißt, bleibt ein Schlagwort — es ändert keine Stufe.
    const { readFileSync } = await import("node:fs");
    const quelle = readFileSync("services/knowledge-object/src/metadata-projection.ts", "utf8");
    expect(quelle).not.toContain("confidentiality:");
  });
});
