// ================================================================================================
// JOB 4146 · D5 — ZWEI MENSCHEN SCHREIBEN GLEICHZEITIG, UND BEIDE BEITRÄGE STEHEN DA
// ================================================================================================
//
// WAS `STALE_WRITE` IST UND WAS NICHT (`repo-pg.ts:412-437`): eine ABLEHNUNG des Schreibversuchs,
// kein nachgewiesener Datenverlust. Der bedingte UPDATE greift nur, wenn die gespeicherte
// `rowVersion` der gelesenen entspricht — ein veralteter Schreiber überschreibt nie. Bis zu diesem
// Auftrag kam diese Ablehnung aus `addComment` ungefiltert heraus: ein zweiter Mensch, der im selben
// Moment kommentierte, bekam einen Fehler, obwohl ANFÜGEN verträglich ist.
//
// DIE REGEL DIESES AUFTRAGS: bei `STALE_WRITE` liest der Dienst frisch und hängt EINMAL erneut an.
// Scheitert auch das, kommt der Fehler heraus — nicht geraten, nicht verschluckt (H3).
//
// ZWEI BAUARTEN, damit der Fall nicht an seiner eigenen Vorrichtung hängt:
//   H1 gegen das ECHTE `InMemoryKoRepo` mit seinem echten CAS (`repo.ts:443-454`) — zwei wirklich
//      gleichzeitige Aufrufe, deren zweiter seinen Stand verliert.
//   H2/H3 gegen ein Repo, das die Ablehnung GESTELLT erzeugt und dabei den fremden Beitrag wirklich
//      in den Bestand schreibt (Bauform `repo-pg.ts:432-437`) — nur so ist „der bestätigte Beitrag
//      verschwindet nicht" überhaupt prüfbar.
//
// KEIN ECHTER PostgreSQL-LAUF: hier läuft die Ablehnung nachgebildet, und dieser Fall behauptet
// nichts über die Datenbank.
import { describe, expect, it } from "vitest";
import type { TxContext } from "../../services/db-tx";
import { InMemoryKoRepo } from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import { KoError } from "../../services/knowledge-object/src/types";
import type { KnowledgeObject, KoComment } from "../../services/knowledge-object/src/types";

const FREMD_A: KoComment = {
  id: "fremd-a",
  author: "eva",
  text: "Ich habe die Dichtung schon getauscht.",
  at: "2026-02-01T07:00:00.000Z",
  koVersion: 1,
};

/**
 * Das Repo, das die nebenläufige Lage HERSTELLT statt sie zu behaupten: beim abgelehnten Versuch
 * landet der fremde Beitrag WIRKLICH im Bestand (das ist der andere Schreiber), und erst dann wird
 * abgelehnt — genau die Reihenfolge des bedingten UPDATE in `repo-pg.ts`.
 */
class RepoMitAblehnung extends InMemoryKoRepo {
  private offen: KoComment[];
  private durchlassen: number;

  /** `durchlassen` — so viele Schreibvorgänge laufen normal, bevor die erste Ablehnung greift. */
  constructor(fremde: KoComment[], durchlassen = 0) {
    super();
    this.offen = [...fremde];
    this.durchlassen = durchlassen;
  }

  override async update(ko: KnowledgeObject, tx?: TxContext): Promise<void> {
    if (this.durchlassen > 0) {
      this.durchlassen -= 1;
      return super.update(ko, tx);
    }
    const fremd = this.offen.shift();
    if (!fremd) {
      return super.update(ko, tx);
    }
    const bestand = await super.findById(ko.id);
    if (bestand) {
      await super.update({ ...bestand, comments: [...(bestand.comments ?? []), fremd] });
    }
    throw new KoError("STALE_WRITE", "Nebenläufige Änderung — bitte erneut lesen und anwenden.");
  }
}

async function objekt(service: KoService): Promise<KnowledgeObject> {
  return service.create({
    title: "Ventil X schließt bei Überdruck",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    type: "best_practice",
    category: "Anlage 1",
    author: "pedi",
  });
}

describe("JOB 4146 · D5 — gleichzeitig schreiben", () => {
  it("H1 · zwei wirklich gleichzeitige Beiträge stehen am Ende BEIDE da, genau einmal", async () => {
    const repo = new InMemoryKoRepo();
    const service = new KoService({ repo });
    const ko = await objekt(service);

    await Promise.all([
      service.addComment(ko.id, "eva", "Gilt das auch für Linie 3?"),
      service.addComment(ko.id, "pedi", "Die Dichtung ist neu."),
    ]);

    const stand = await service.get(ko.id);
    const texte = (stand?.comments ?? []).map((c) => c.text).sort();
    expect(texte).toEqual(["Die Dichtung ist neu.", "Gilt das auch für Linie 3?"]);
    expect(new Set((stand?.comments ?? []).map((c) => c.id)).size).toBe(2);
  });

  it("H2 · der abgelehnte Schreiber hängt erneut an — der bestätigte fremde Beitrag bleibt unverändert", async () => {
    const repo = new RepoMitAblehnung([FREMD_A]);
    const service = new KoService({ repo });
    const ko = await objekt(service);

    const nachher = await service.addComment(ko.id, "pedi", "Die Dichtung ist neu.");

    expect(nachher.comments).toHaveLength(2);
    // Feld für Feld: der bestätigte Beitrag des anderen Schreibers darf weder verschwinden noch
    // sich verändern.
    expect(nachher.comments[0]).toEqual(FREMD_A);
    expect(nachher.comments[1]?.text).toBe("Die Dichtung ist neu.");
    expect(nachher.comments[1]?.author).toBe("pedi");
    // Und keiner von beiden steht zweimal da.
    expect(new Set(nachher.comments.map((c) => c.id)).size).toBe(2);
    // Die ANTWORT ist nicht bloss eine freundliche Behauptung: derselbe Faden liegt im Bestand.
    // Verglichen werden die Beiträge und nicht das ganze Objekt — `rowVersion` ist der Schreibstand
    // des Repos und steht in der Rückgabe naturgemäss auf dem GELESENEN Wert (so wie bei jedem
    // anderen Schreibweg des Dienstes), im Bestand dagegen auf dem geschriebenen.
    expect((await service.get(ko.id))?.comments).toEqual(nachher.comments);
  });

  it("H3 · scheitert auch der zweite Versuch, kommt die Ablehnung heraus — ohne halben Beitrag", async () => {
    const repo = new RepoMitAblehnung([
      FREMD_A,
      { ...FREMD_A, id: "fremd-b", text: "Und ich habe das Ventil geprüft." },
    ]);
    const service = new KoService({ repo });
    const ko = await objekt(service);

    await expect(service.addComment(ko.id, "pedi", "Die Dichtung ist neu.")).rejects.toMatchObject({
      code: "STALE_WRITE",
    });

    const stand = await service.get(ko.id);
    // Die zwei fremden Beiträge stehen da (sie WURDEN geschrieben), der eigene nicht — ehrlich
    // abgelehnt statt halb angekommen.
    expect((stand?.comments ?? []).map((c) => c.id)).toEqual(["fremd-a", "fremd-b"]);
  });

  it("H4 · auch die Antwort auf einen Beitrag übersteht die Ablehnung und bleibt am richtigen Faden", async () => {
    // Der Wurzelbeitrag läuft durch (`durchlassen: 1`); die Ablehnung trifft erst die ANTWORT.
    const repo = new RepoMitAblehnung([FREMD_A], 1);
    const service = new KoService({ repo });
    const ko = await objekt(service);
    const mitFrage = await service.addComment(ko.id, "eva", "Gilt das auch für Linie 3?");
    const frage = mitFrage.comments.find((c) => c.text === "Gilt das auch für Linie 3?")?.id ?? "";
    expect(frage).not.toBe("");

    const nachher = await service.addComment(ko.id, "pedi", "Ja, seit Mai.", { replyTo: frage });

    expect(nachher.comments.find((c) => c.text === "Ja, seit Mai.")?.replyTo).toBe(frage);
    expect(nachher.comments).toHaveLength(3);
  });
});
