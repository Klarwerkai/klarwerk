// ================================================================================================
// JOB 4146 · D4 — ERLEDIGT HEISST GEKLÄRT, NICHT FREIGEGEBEN
// ================================================================================================
//
// DIE GEFÄHRLICHSTE HALBHEIT DIESES AUFTRAGS wäre ein Klärungsstand, der still als fachliche
// Freigabe gelesen wird. Deshalb misst dieser Fall den Objektzustand VORHER und NACHHER und
// vergleicht ihn — nicht nur „resolution ist gesetzt" (JOB 4141 R1, LEHREN 15.09.: ein Bestandsfeld
// zählt erst als Nachweis, wenn seine Werte wirklich verglichen werden).
//
// DER FADEN WIRD AN SEINER WURZEL MARKIERT. „Erledigt" ist eine Aussage über die SACHE, nicht über
// eine einzelne Zeile; wer die Antwort erledigt, erledigt den Faden. Zwei Klärungsstände in einem
// Faden wären zwei Wahrheiten über dieselbe Frage.
import { beforeEach, describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo } from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";

describe("JOB 4146 · D4 — Klärungsstand", () => {
  let audit: AuditService;
  let service: KoService;

  beforeEach(() => {
    audit = new AuditService({ repo: new InMemoryAuditRepo() });
    service = new KoService({ repo: new InMemoryKoRepo(), audit });
  });

  async function fadenMitAntwort(): Promise<{
    ko: KnowledgeObject;
    frage: string;
    antwort: string;
  }> {
    const ko = await service.create({
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "pedi",
    });
    const mitFrage = await service.addComment(ko.id, "eva", "Gilt das auch für Linie 3?");
    const frage = mitFrage.comments[0]?.id ?? "";
    const mitAntwort = await service.addComment(ko.id, "pedi", "Ja, seit Mai.", { replyTo: frage });
    const antwort = mitAntwort.comments[1]?.id ?? "";
    return { ko: mitAntwort, frage, antwort };
  }

  /** Genau die Felder, an denen sich eine heimliche Freigabe zeigen würde. */
  function freigabestand(ko: KnowledgeObject): Record<string, unknown> {
    return {
      status: ko.status,
      version: ko.version,
      trust: ko.trust,
      confidence: ko.confidence,
      neededValidations: ko.neededValidations,
      assignments: ko.assignments,
      ownership: ko.ownership,
      history: ko.history,
    };
  }

  it("erledigt setzen und wieder öffnen ist mit Urheber und Zeitpunkt nachvollziehbar", async () => {
    const { ko, frage } = await fadenMitAntwort();

    const geklaert = await service.setCommentResolution(ko.id, frage, "pedi", "erledigt");
    expect(geklaert.comments[0]?.resolution).toEqual({
      state: "erledigt",
      by: "pedi",
      at: expect.any(String),
    });

    const wiederOffen = await service.setCommentResolution(ko.id, frage, "eva", "offen");
    expect(wiederOffen.comments[0]?.resolution).toEqual({
      state: "offen",
      by: "eva",
      at: expect.any(String),
    });
  });

  it("der Status des Wissensobjekts und seine Freigabe sind davor und danach identisch", async () => {
    const { ko, frage } = await fadenMitAntwort();
    const vorher = freigabestand(ko);

    const geklaert = await service.setCommentResolution(ko.id, frage, "pedi", "erledigt");
    expect(freigabestand(geklaert)).toEqual(vorher);

    const wiederOffen = await service.setCommentResolution(ko.id, frage, "pedi", "offen");
    expect(freigabestand(wiederOffen)).toEqual(vorher);
    expect(geklaert.status).toBe("offen");
  });

  it("auch an einem FREIGEGEBENEN Objekt bewegt der Klärungsstand die Freigabe nicht", async () => {
    const { ko, frage } = await fadenMitAntwort();
    // Der Freigabeweg des Produkts (`revise-release`, ko-routes.ts) — kein von Hand gesetzter Status.
    const freigegeben = await service.reviseUndFreigeben(
      ko.id,
      { statement: "Geprüfte Fassung." },
      "pedi",
      {
        trust: 100,
      },
    );
    expect(freigegeben.status).toBe("validiert");
    const vorher = freigabestand(freigegeben);

    const geklaert = await service.setCommentResolution(ko.id, frage, "pedi", "erledigt");

    expect(freigabestand(geklaert)).toEqual(vorher);
    expect(geklaert.status).toBe("validiert");
  });

  it("der Klärungsstand hängt am Wurzelbeitrag des Fadens, auch wenn die ANTWORT erledigt wird", async () => {
    const { ko, frage, antwort } = await fadenMitAntwort();

    const geklaert = await service.setCommentResolution(ko.id, antwort, "pedi", "erledigt");

    expect(geklaert.comments[0]?.id).toBe(frage);
    expect(geklaert.comments[0]?.resolution?.state).toBe("erledigt");
    // KEIN zweiter Klärungsstand an der Antwort — ein Faden, eine Aussage.
    expect(geklaert.comments[1]?.resolution).toBeUndefined();
  });

  it("ein unbekannter Beitrag hat keinen Klärungsstand — und hinterlässt keinen", async () => {
    const { ko } = await fadenMitAntwort();

    await expect(
      service.setCommentResolution(ko.id, "gibt-es-nicht", "pedi", "erledigt"),
    ).rejects.toThrow();

    const nachher = await service.get(ko.id);
    expect(nachher?.comments.every((c) => c.resolution === undefined)).toBe(true);
  });

  it("jeder Vorgang hinterlässt einen eigenen Beleg — erledigt und wieder offen getrennt", async () => {
    const { ko, frage } = await fadenMitAntwort();

    await service.setCommentResolution(ko.id, frage, "pedi", "erledigt");
    await service.setCommentResolution(ko.id, frage, "eva", "offen");

    const eintraege = (await audit.list()).filter((e) => e.target === ko.id);
    const aktionen = eintraege.map((e) => e.action);
    expect(aktionen).toContain("ko.comment-resolved");
    expect(aktionen).toContain("ko.comment-reopened");
    expect(eintraege.find((e) => e.action === "ko.comment-resolved")?.actor).toBe("pedi");
    expect(eintraege.find((e) => e.action === "ko.comment-reopened")?.actor).toBe("eva");
  });
});
