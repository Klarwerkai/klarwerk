// ================================================================================================
// JOB 4146 · D2 — JEDER NEUE BEITRAG SAGT, WELCHE FASSUNG SEIN VERFASSER VOR SICH HATTE
// ================================================================================================
//
// DER VERTRAG (Abnahmefall 2): Beitrag an Version 3, Dokument inzwischen Version 4 — der ALTE Bezug
// bleibt sichtbar, und es geschieht KEINE automatische fachliche Übernahme. Der Bezug ist damit eine
// historische Tatsache am Beitrag, kein mitlaufender Zeiger auf „jetzt".
//
// DER SERVER SETZT IHN, NICHT DER CLIENT. Ein vom Aufrufer mitgeschicktes `koVersion` wäre eine
// Herkunftsbehauptung ohne Beleg — dieselbe Grenze, an der `add-source` sein `provider` verloren hat
// (mega15 Block B). Gemessen wird deshalb auch, dass der Dienst die Fassung aus dem GELESENEN Objekt
// nimmt (H3: nach einer Überarbeitung trägt der nächste Beitrag die neue Zahl).
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryKoRepo } from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";

describe("JOB 4146 · D2 — Versionsbezug am Beitrag", () => {
  let service: KoService;

  beforeEach(() => {
    service = new KoService({ repo: new InMemoryKoRepo() });
  });

  async function objekt(): Promise<KnowledgeObject> {
    return service.create({
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "pedi",
    });
  }

  it("trägt die Inhaltsversion ein, die beim Schreiben galt", async () => {
    const ko = await objekt();
    expect(ko.version).toBe(1);

    const mitBeitrag = await service.addComment(ko.id, "eva", "Gilt das auch für Linie 3?");

    expect(mitBeitrag.comments[0]?.koVersion).toBe(1);
  });

  it("nach einer Überarbeitung bleibt die Zahl am alten Beitrag stehen", async () => {
    const ko = await objekt();
    // Zwei Überarbeitungen, damit der Beitrag an Fassung 3 hängt und das Objekt danach auf 4 steht —
    // genau die Bezifferung des Abnahmefalls 2.
    await service.revise(ko.id, { statement: "Fassung zwei." }, "pedi");
    await service.revise(ko.id, { statement: "Fassung drei." }, "pedi");
    const stand = await service.get(ko.id);
    expect(stand?.version).toBe(3);

    const mitBeitrag = await service.addComment(ko.id, "eva", "Gilt das auch für Linie 3?");
    expect(mitBeitrag.comments[0]?.koVersion).toBe(3);

    const weiter = await service.revise(ko.id, { statement: "Fassung vier." }, "pedi");

    expect(weiter.version).toBe(4);
    expect(weiter.comments[0]?.koVersion).toBe(3);
    // KEINE automatische fachliche Übernahme: der Beitrag hat weder Inhalt noch Freigabe bewegt.
    expect(weiter.statement).toBe("Fassung vier.");
    expect(weiter.status).toBe(stand?.status);
  });

  it("der nächste Beitrag trägt die NEUE Fassung — der Bezug ist gelesen, nicht geraten", async () => {
    const ko = await objekt();
    const erster = await service.addComment(ko.id, "eva", "Frage zur ersten Fassung.");
    expect(erster.comments[0]?.koVersion).toBe(1);

    await service.revise(ko.id, { statement: "Fassung zwei." }, "pedi");
    const zweiter = await service.addComment(ko.id, "eva", "Frage zur zweiten Fassung.");

    expect(zweiter.comments.map((c) => c.koVersion)).toEqual([1, 2]);
  });
});
