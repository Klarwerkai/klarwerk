// ================================================================================================
// JOB 4146 · D1 — DER BESTANDSKOMMENTAR OHNE DIE NEUEN FELDER BLEIBT, WAS ER IST
// ================================================================================================
//
// DER VERTRAG (`VERTRAG-QUELLEN-VERSION-PRUEFSTAND.md`, Abnahmefall 1, im HINWEIS der Runde 1
// verbindlich gemacht): ein versionsloser Bestandskommentar bleibt lesbar mit UNBEKANNTEM
// Versionsbezug. Die aktuelle Version darf nicht nachträglich als seine Basis erfunden werden —
// weder beim Lesen noch beim Schreiben eines NEUEN Beitrags an dasselbe Objekt.
//
// GEMESSEN WIRD FELD FÜR FELD, nicht „ist noch da": eine Rückfüllung von `koVersion` an Altdaten
// wäre genau der stille Schaden, den Fall 1 verbietet, und eine Längenprüfung sähe ihn nicht.
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryKoRepo } from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";

/** Zwei Beiträge in der Form VOR diesem Auftrag: id, author, text, at — mehr kannte `KoComment` nicht. */
const ALT_A = {
  id: "alt-1",
  author: "controller",
  text: "Bitte Quelle ergänzen.",
  at: "2026-01-02T08:00:00.000Z",
};
const ALT_B = {
  id: "alt-2",
  author: "eva",
  text: "Quelle liegt im Ordner P.",
  at: "2026-01-03T09:30:00.000Z",
};

describe("JOB 4146 · D1 — Altbeiträge bleiben unverändert", () => {
  let repo: InMemoryKoRepo;
  let service: KoService;

  beforeEach(() => {
    repo = new InMemoryKoRepo();
    service = new KoService({ repo });
  });

  /** Ein Objekt mit ZWEI Altkommentaren, direkt im Bestand — so, wie es heute in der Datenbank liegt. */
  async function mitAltbestand(): Promise<KnowledgeObject> {
    const ko = await service.create({
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "pedi",
    });
    const gelesen = await repo.findById(ko.id);
    if (!gelesen) {
      throw new Error("Das eben angelegte Objekt fehlt im Bestand.");
    }
    await repo.update({ ...gelesen, comments: [{ ...ALT_A }, { ...ALT_B }] });
    const nachher = await repo.findById(ko.id);
    if (!nachher) {
      throw new Error("Der Altbestand konnte nicht gelesen werden.");
    }
    return nachher;
  }

  it("ein neuer Beitrag lässt beide Altbeiträge Feld für Feld unverändert", async () => {
    const ko = await mitAltbestand();

    const nachher = await service.addComment(ko.id, "pedi", "Ich schaue morgen nach.");

    expect(nachher.comments).toHaveLength(3);
    // Feld für Feld, nicht „enthält": ein zusätzlich gesetztes `koVersion` an einem Altbeitrag wäre
    // eine erfundene Fassungsbasis und muss diesen Fall rot machen.
    expect(nachher.comments[0]).toEqual(ALT_A);
    expect(nachher.comments[1]).toEqual(ALT_B);
    expect(Object.keys(nachher.comments[0] ?? {}).sort()).toEqual(["at", "author", "id", "text"]);
    expect(Object.keys(nachher.comments[1] ?? {}).sort()).toEqual(["at", "author", "id", "text"]);
  });

  it("der versionslose Altbeitrag behält seinen unbekannten Versionsbezug auch nach einer Überarbeitung", async () => {
    const ko = await mitAltbestand();
    await service.addComment(ko.id, "pedi", "Ich schaue morgen nach.");

    const revidiert = await service.revise(
      ko.id,
      { statement: "Ventil X zweifach sichern." },
      "pedi",
    );

    expect(revidiert.version).toBeGreaterThan(1);
    expect(revidiert.comments[0]).toEqual(ALT_A);
    expect(revidiert.comments[1]).toEqual(ALT_B);
    expect(revidiert.comments[0]?.koVersion).toBeUndefined();
    expect(revidiert.comments[1]?.koVersion).toBeUndefined();
  });

  it("ein Klärungsstand an einem Altbeitrag ergänzt genau ein Feld und erfindet keine Fassung", async () => {
    const ko = await mitAltbestand();

    const geklaert = await service.setCommentResolution(ko.id, ALT_A.id, "pedi", "erledigt");

    const wurzel = geklaert.comments[0];
    expect(wurzel?.resolution).toEqual({
      state: "erledigt",
      by: "pedi",
      at: expect.any(String),
    });
    expect(wurzel?.koVersion).toBeUndefined();
    expect({ id: wurzel?.id, author: wurzel?.author, text: wurzel?.text, at: wurzel?.at }).toEqual(
      ALT_A,
    );
    // Der zweite Altbeitrag ist ein eigener Faden und bleibt völlig unberührt.
    expect(geklaert.comments[1]).toEqual(ALT_B);
  });
});
