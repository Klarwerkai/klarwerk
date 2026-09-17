// ================================================================================================
// JOB 4251 (WIKI-ZUSAMMENARBEIT) · K1 — DIE EINORDNUNG WIRD BEDINGT GESCHRIEBEN, ODER GAR NICHT.
// ================================================================================================
//
// DIE LAGE, DIE DIESE DATEI MISST. Zwei Menschen haben denselben Bibliothekseintrag offen. B ändert
// die Schlagwörter. A speichert danach einen Stand, den A VOR Bs Änderung gesehen hat. Bis zu
// diesem Auftrag ging As Liste mit einem stillen Erfolg durch und ersetzte Bs Schlagwörter —
// `updateTags`/`updateCategory` nahmen keine erwartete Fassung entgegen, und `mutateKoMetadata`
// verglich nichts gegen einen vom Menschen gesehenen Stand: letzter Schreiber gewinnt.
//
// DIE ENTSCHEIDENDE FALLE, UND SIE IST DER GRUND FÜR DIESE DATEI: eine Metadatenänderung erhöht die
// INHALTSVERSION ausdrücklich NICHT (`service.ts`, `mutateKoMetadata`, KW-ARCH-G27 Abschnitt 1).
// Ein Schutz, der nur `ko.version` vergleicht, fängt genau den Fall aus dem Nutzerziel NICHT — B hat
// ja nur Schlagwörter geändert, die Version steht unverändert da. K1a misst deshalb ausdrücklich
// bei GLEICHER Version. Der autoritative Stempel ist die `metadata_revision` der Mutable Metadata
// Projection (`metadata-projection.ts`): sie klettert monoton und genau dann, wenn sich Kategorie
// oder Schlagwörter fachlich wirklich ändern.
//
// GEMESSEN WIRD AM DIENST, nicht an der Route: die Route hat ihre eigene Datei nebenan
// (`route-einordnung-konflikt.test.ts`), und was der Dienst zusagt, sagt über das Durchreichen
// nichts — dieselbe Trennung wie in `tests/word-rueckweg/route-bedingter-schreibzugriff.test.ts`.
//
// BENANNTE PRÜFLÜCKEN: In-Memory-Ablagen, kein PostgreSQL, keine echte Nebenläufigkeit zweier
// Prozesse (der Lock ist per-KO serialisiert, die Verschränkung misst K4 an der Route).
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";

// Derselbe mechanische Aufbau wie `tests/ko/g27-welle1-metadata-projection.test.ts`: die Suche ist
// fail-closed, ein Dienst ohne Aktivierung beantwortet nichts. Kein Sonderpfad, keine Abkürzung.
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
  title: "Ventil X schließt bei Überdruck",
  statement: "Bei Überdruck Ventil X manuell schließen.",
  type: "best_practice" as const,
  author: "anna",
};

/**
 * Der Stempel der Einordnung, wie ihn auch die Route herausgibt. Fehlt die Projektionszeile, ist das
 * hier kein „unbekannt zum Weiterreichen", sondern ein Aufbaufehler des Tests — dann hätte der Fall
 * keinen Gegenstand, und ein stillschweigend weitergereichtes `undefined` machte die Messung stumm.
 */
async function stempel(ko: KoService, id: string): Promise<number> {
  const projektion = await ko.metadataProjectionOf(id);
  if (projektion === undefined) {
    throw new Error("Für dieses Objekt gibt es keine Metadatenprojektion");
  }
  return projektion.metadataRevision;
}

/** Wie viele Metadatenbelege es für dieses Objekt gibt — der Nachweis „kein Beleg" in K1a. */
async function belege(audit: AuditService, id: string): Promise<number> {
  const kategorie = await audit.list({ action: "ko.category-changed", target: id });
  const schlagworte = await audit.list({ action: "ko.tags-changed", target: id });
  return kategorie.length + schlagworte.length;
}

describe("JOB 4251 · K1 · der Dienst schreibt die Einordnung bedingt", () => {
  // ==============================================================================================
  // K1a · DER FALL AUS DEM NUTZERZIEL — B ÄNDERT NUR DIE SCHLAGWÖRTER.
  // ==============================================================================================
  it("K1a · A schreibt mit dem vorher gesehenen Stempel: kein Write, Fehler mit Code, Bs Schlagwörter stehen noch da", async () => {
    const { ko, audit } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Anlage 1", tags: ["ventil"] });

    // A sieht den Stand — genau das, was die Lesefläche als `metadataRevision` bekommt.
    const gesehenVonA = await stempel(ko, erstellt.id);
    expect(gesehenVonA, "ohne Stempel hätte dieser Test keinen Gegenstand").toBe(1);
    const belegeVorher = await belege(audit, erstellt.id);

    // B ändert NUR die Schlagwörter. Die Inhaltsfassung bleibt dabei stehen — das ist die Falle.
    const nachB = await ko.updateTags(erstellt.id, ["ventil", "ueberdruck"], "bernd");
    expect(nachB.version, "eine Einordnungsänderung darf die Inhaltsfassung nicht bewegen").toBe(
      erstellt.version,
    );
    const stempelNachB = await stempel(ko, erstellt.id);
    expect(stempelNachB).toBe(2);

    // A speichert jetzt seine ALTE Liste — gegen den Stand, den A gesehen hat.
    await expect(
      ko.updateTags(erstellt.id, ["ventil", "wartung"], "anna", {
        expectedMetadataRevision: gesehenVonA,
      }),
    ).rejects.toMatchObject({ code: "KO_STALE" });

    // NICHTS ist geschrieben: Bs Schlagwörter stehen unverändert da …
    const jetzt = await ko.get(erstellt.id);
    expect(jetzt?.tags, "As alte Liste hat Bs Schlagwörter ersetzt").toEqual([
      "ventil",
      "ueberdruck",
    ]);
    // … der Stempel ist nicht geklettert …
    expect(await stempel(ko, erstellt.id), "der abgewiesene Aufruf hat die Revision bewegt").toBe(
      stempelNachB,
    );
    // … und es gibt keinen Beleg über einen Schreibvorgang, den es nicht gab.
    expect(await belege(audit, erstellt.id), "der abgewiesene Aufruf hat einen Beleg erzeugt").toBe(
      belegeVorher + 1, // genau der EINE von B
    );
  });

  it("K1b · dasselbe an der Kategorie — auch sie überlebt den alten Stand", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Anlage 1" });
    const gesehenVonA = await stempel(ko, erstellt.id);

    await ko.updateCategory(erstellt.id, "Anlage 7", "bernd");

    await expect(
      ko.updateCategory(erstellt.id, "Anlage 2", "anna", {
        expectedMetadataRevision: gesehenVonA,
      }),
    ).rejects.toMatchObject({ code: "KO_STALE" });
    expect((await ko.get(erstellt.id))?.category).toBe("Anlage 7");
  });

  // ==============================================================================================
  // K1c · UND GENAU DESHALB REICHT `expectedVersion` NICHT (§2 g).
  // ==============================================================================================
  //
  // Derselbe Vorgang, nur mit der Inhaltsfassung als Bedingung: sie stimmt noch, weil B die Version
  // gar nicht bewegt hat — der Schreibvorgang geht durch, und Bs Schlagwörter sind weg. Dieser Fall
  // ist der GRUND für den eigenen Stempel und steht hier, damit die Begründung messbar bleibt.
  it("K1c · mit der Inhaltsfassung allein greift der Schutz NICHT — B hat die Version nicht bewegt", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Anlage 1", tags: ["ventil"] });
    await ko.updateTags(erstellt.id, ["ventil", "ueberdruck"], "bernd");

    // A gibt die Fassung mit, die A gesehen hat — sie gilt unverändert weiter.
    const durch = await ko.updateTags(erstellt.id, ["ventil", "wartung"], "anna", {
      expectedVersion: erstellt.version,
    });
    expect(
      durch.tags,
      "die Inhaltsfassung hätte hier nie gegriffen — genau das ist der Befund",
    ).toEqual(["ventil", "wartung"]);
  });

  it("K1d · stimmt der Stempel, wird geschrieben — und der neue Stand wird gemeldet", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Anlage 1", tags: ["ventil"] });
    const gesehen = await stempel(ko, erstellt.id);

    let gemeldet: number | null = null;
    const geschrieben = await ko.updateTags(erstellt.id, ["ventil", "wartung"], "anna", {
      expectedMetadataRevision: gesehen,
      meldeMetadatenstand: (r) => {
        gemeldet = r;
      },
    });
    expect(geschrieben.tags).toEqual(["ventil", "wartung"]);
    // Die Quittung ist der Stand, der JETZT gilt — sonst liefe der nächste Schritt derselben Kette
    // in einen Konflikt mit dem eigenen Schreibvorgang von einer Zeile zuvor.
    expect(gemeldet).toBe(await stempel(ko, erstellt.id));
    expect(gemeldet).toBe(gesehen + 1);
  });

  // ==============================================================================================
  // K1e · ALTAUFRUFER BLEIBEN UNBEDINGT (Lieferung 1, letzter Satz).
  // ==============================================================================================
  it("K1e · ohne Option verhält sich der Dienst wie vor diesem Auftrag — Importwege sind unberührt", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Anlage 1", tags: ["ventil"] });
    await ko.updateTags(erstellt.id, ["fremd"], "bernd");

    // Kein `opts` — derselbe Aufruf, den `demo-pakete.ts` und jeder Importweg absetzen.
    const durch = await ko.updateTags(erstellt.id, ["alt"], "system");
    expect(durch.tags).toEqual(["alt"]);
  });

  // ==============================================================================================
  // K1f · DIE IDENTISCHE WIEDERHOLUNG BLEIBT, WAS SIE IST.
  // ==============================================================================================
  //
  // Ohne Bedingung: kein Write, kein Beleg, kein Revisions-Bump — Zeichen für Zeichen das Verhalten
  // aus G27 Welle 1 (`tests/ko/g27-welle1-metadata-projection.test.ts` pinnt es).
  it("K1f · die identische Wiederholung ist weiterhin idempotent", async () => {
    const { ko, audit } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Anlage 1", tags: ["ventil"] });
    const vorher = await stempel(ko, erstellt.id);
    const belegeVorher = await belege(audit, erstellt.id);

    await ko.updateTags(erstellt.id, ["ventil"], "anna");

    expect(await stempel(ko, erstellt.id)).toBe(vorher);
    expect(await belege(audit, erstellt.id)).toBe(belegeVorher);
  });

  // ==============================================================================================
  // K1g · EIN ÜBERHOLTER STEMPEL WIRD AUCH DANN ABGEWIESEN, WENN DER WERT ZUFÄLLIG DERSELBE IST.
  // ==============================================================================================
  //
  // Die Reihenfolge im Dienst ist eine Entscheidung: der Vergleich steht VOR der Erkennung der
  // identischen Wiederholung. Der Stempel klettert ausschliesslich bei einer fachlich wirksamen
  // Änderung — stimmt er nicht mehr, hat jemand die Einordnung WIRKLICH bewegt, und ein stiller
  // Erfolg liesse den Menschen einen Stand für bestätigt halten, den er nie gesehen hat.
  it("K1g · B ändert die Kategorie, A schreibt dieselben Schlagwörter wie bisher — trotzdem 409 statt stillem Erfolg", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Anlage 1", tags: ["ventil"] });
    const gesehenVonA = await stempel(ko, erstellt.id);

    await ko.updateCategory(erstellt.id, "Anlage 7", "bernd");

    await expect(
      ko.updateTags(erstellt.id, ["ventil"], "anna", {
        expectedMetadataRevision: gesehenVonA,
      }),
    ).rejects.toMatchObject({ code: "KO_STALE" });
  });

  // ==============================================================================================
  // K1h · DIE INHALTSFASSUNG STEHT DANEBEN, NICHT AN SEINER STELLE (Lieferung 1).
  // ==============================================================================================
  it("K1h · gibt der Aufrufer zusätzlich die Inhaltsfassung mit, wird auch sie geprüft", async () => {
    const { ko } = await stack();
    const erstellt = await ko.create({ ...EINGABE, category: "Anlage 1", tags: ["ventil"] });
    const gesehen = await stempel(ko, erstellt.id);

    // Jemand Fremdes revidiert den INHALT — der Stempel der Einordnung bleibt dabei stehen.
    const revidiert = await ko.revise(erstellt.id, { statement: "Fremde Änderung." }, "bernd");
    expect(revidiert.version).toBe(erstellt.version + 1);
    expect(await stempel(ko, erstellt.id)).toBe(gesehen);

    await expect(
      ko.updateTags(erstellt.id, ["ventil", "wartung"], "anna", {
        expectedMetadataRevision: gesehen,
        expectedVersion: erstellt.version,
      }),
    ).rejects.toMatchObject({ code: "KO_STALE" });
    expect((await ko.get(erstellt.id))?.tags).toEqual(["ventil"]);
  });
});
