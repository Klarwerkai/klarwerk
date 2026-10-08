// ================================================================================================
// P-WIKI-STELLENBEZUG · D1 — DER DIENST NIMMT EINE STELLE NUR AN, WENN SIE IN DER FASSUNG STEHT
// ================================================================================================
//
// DIE ZUSAGEN, am echten `KoService` mit der Speicherablage gemessen:
//   S1  eine Rückfrage an Absatz, Tabelle oder Bild trägt Fassung, Abschnitt und Textstelle
//   S2  eine Stelle aus einer ÄLTEREN Fassung wird abgelehnt (`KO_STALE`) — nichts wird geschrieben
//   S3  eine erfundene Textstelle wird abgelehnt (`INVALID`) — nichts wird geschrieben
//   S4  eine Antwort trägt keine eigene Stelle
//   S5  nach einer Überarbeitung bleibt der Anker UNVERÄNDERT am Beitrag (nie umgehängt), und die
//       alte Stelle ist in der Fassungsablage weiter lesbar
//   S6  die Wiederholung derselben Absendung bleibt ein Beitrag; eine ANDERE Stelle ist eine andere
//   S8  NACHARBEIT 3 (BEN): Art und Abschnitt müssen mit dem Inhalt einen vorhandenen Block bestimmen
import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  type KoCommentStelle,
  KoService,
} from "../../services/knowledge-object";
import { stellenFingerabdruck } from "../../services/knowledge-object/src/stellen-fingerabdruck";

/** Eine Stelle mit dem Abdruck ihres vollständigen Inhalts (hier ist Inhalt = Anzeigezitat). */
const stelle = (
  koVersion: number,
  art: KoCommentStelle["art"],
  abschnitt: string,
  text: string,
): KoCommentStelle => ({
  koVersion,
  art,
  abschnitt,
  text,
  fingerabdruck: stellenFingerabdruck(art, abschnitt, text),
});

const INHALT = [
  "<h2>Ablauf</h2>",
  "<p>Erst das <strong>Ventil X</strong> schließen, dann den Druck ablassen.</p>",
  "<p>Danach die Leitung spülen.</p>",
  "<h2>Grenzwerte</h2>",
  "<table><tbody><tr><th>Druck</th><td>6 bar</td></tr></tbody></table>",
  '<figure data-image-id="bild-1"><img src="/api/objects/obj1/raw" alt="Schaltschema" data-image-id="bild-1"><figcaption data-image-id="bild-1">Schaltschema Ventil X</figcaption></figure>',
].join("");

const ERSTER_ABSATZ = "Erst das Ventil X schließen, dann den Druck ablassen.";

const absatz = (koVersion: number, text = ERSTER_ABSATZ): KoCommentStelle =>
  stelle(koVersion, "absatz", "Ablauf", text);

describe("P-WIKI-STELLENBEZUG · D1 — Stelle am Dienst", () => {
  let service: KoService;

  beforeEach(() => {
    service = new KoService({ repo: new InMemoryKoRepo(), versions: new InMemoryKoVersionRepo() });
  });

  async function objekt(): Promise<KnowledgeObject> {
    return service.create({
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      bodyHtml: INHALT,
      type: "best_practice",
      category: "Anlage 1",
      author: "pedi",
    });
  }

  async function fehlercode(versuch: Promise<unknown>): Promise<string> {
    try {
      await versuch;
    } catch (e) {
      return String((e as { code?: unknown }).code);
    }
    return "kein Fehler";
  }

  it("S1 · Absatz, Tabelle und Bild werden mit Fassung, Abschnitt und Textstelle gespeichert", async () => {
    const ko = await objekt();
    expect(ko.version).toBe(1);

    await service.addComment(ko.id, "eva", "Welcher Druck genau?", { stelle: absatz(1) });
    await service.addComment(ko.id, "eva", "Gilt das auch bei 8 bar?", {
      stelle: stelle(1, "tabelle", "Grenzwerte", "Druck 6 bar"),
    });
    const stand = await service.addComment(ko.id, "eva", "Ist das Schema aktuell?", {
      stelle: stelle(1, "bild", "Grenzwerte", "bild-1"),
    });

    expect(stand.comments.map((c) => c.stelle)).toEqual([
      absatz(1),
      stelle(1, "tabelle", "Grenzwerte", "Druck 6 bar"),
      stelle(1, "bild", "Grenzwerte", "bild-1"),
    ]);
    // Der Fassungsbezug des Beitrags und der seiner Stelle sind dieselbe gelesene Zahl.
    expect(stand.comments.map((c) => c.koVersion)).toEqual([1, 1, 1]);
  });

  it("S2 · eine Stelle aus einer älteren Fassung wird abgelehnt und nichts geschrieben", async () => {
    const ko = await objekt();
    await service.revise(ko.id, { bodyHtml: `${INHALT}<p>Neu dazu.</p>` }, "pedi");

    const code = await fehlercode(
      service.addComment(ko.id, "eva", "Frage zur alten Stelle.", { stelle: absatz(1) }),
    );

    expect(code).toBe("KO_STALE");
    expect((await service.get(ko.id))?.comments ?? []).toEqual([]);
  });

  it("S3 · eine erfundene Textstelle wird abgelehnt und nichts geschrieben", async () => {
    const ko = await objekt();

    const code = await fehlercode(
      service.addComment(ko.id, "eva", "Frage.", {
        stelle: absatz(1, "Diesen Satz gibt es im Dokument nicht."),
      }),
    );
    const bild = await fehlercode(
      service.addComment(ko.id, "eva", "Frage.", {
        stelle: stelle(1, "bild", "Grenzwerte", "bild-99"),
      }),
    );

    expect(code).toBe("INVALID");
    expect(bild).toBe("INVALID");
    expect((await service.get(ko.id))?.comments ?? []).toEqual([]);
  });

  it("S4 · eine Antwort trägt keine eigene Stelle", async () => {
    const ko = await objekt();
    const mitFrage = await service.addComment(ko.id, "eva", "Frage.", { stelle: absatz(1) });
    const frageId = mitFrage.comments[0]?.id as string;

    const code = await fehlercode(
      service.addComment(ko.id, "pedi", "Antwort.", { replyTo: frageId, stelle: absatz(1) }),
    );

    expect(code).toBe("INVALID");
    expect((await service.get(ko.id))?.comments).toHaveLength(1);
  });

  it("S5 · nach der Überarbeitung steht der Anker unverändert da, und die alte Stelle bleibt lesbar", async () => {
    const ko = await objekt();
    await service.addComment(ko.id, "eva", "Welcher Druck genau?", { stelle: absatz(1) });

    const neu = INHALT.replace(
      "Erst das <strong>Ventil X</strong> schließen, dann den Druck ablassen.",
      "Erst das Ventil Y schließen, dann den Druck ablassen.",
    );
    const weiter = await service.revise(ko.id, { bodyHtml: neu }, "pedi");

    expect(weiter.version).toBe(2);
    // Der Beitrag überlebt die Revision — und sein Anker ist NICHT auf den neuen Text umgehängt.
    expect(weiter.comments).toHaveLength(1);
    expect(weiter.comments[0]?.stelle).toEqual(absatz(1));
    // Die alte Stelle: Fassung 1 liegt in der Fassungsablage, mit genau dem verankerten Text.
    const fassungen = await service.versionsOf(ko.id);
    const alt = fassungen.find((f) => f.version === 1)?.snapshot.bodyHtml ?? "";
    expect(alt).toContain("<strong>Ventil X</strong> schließen");
  });

  it("S6 · dieselbe Absendung bleibt ein Beitrag, eine andere Stelle ist eine andere Absendung", async () => {
    const ko = await objekt();
    await service.addComment(ko.id, "eva", "Frage.", { clientKey: "k1", stelle: absatz(1) });
    await service.addComment(ko.id, "eva", "Frage.", { clientKey: "k1", stelle: absatz(1) });
    expect((await service.get(ko.id))?.comments).toHaveLength(1);

    await service.addComment(ko.id, "eva", "Frage.", {
      clientKey: "k1",
      stelle: absatz(1, "Danach die Leitung spülen."),
    });
    const stand = await service.get(ko.id);
    expect(stand?.comments).toHaveLength(2);
    expect(stand?.comments[1]?.stelle?.text).toBe("Danach die Leitung spülen.");
  });

  it("S7 · KALIBRIERUNG: ein Beitrag ohne Stelle bleibt, wie er war — ohne das Feld", async () => {
    const ko = await objekt();
    const stand = await service.addComment(ko.id, "eva", "Allgemeine Frage.");
    expect(stand.comments[0]).not.toHaveProperty("stelle");
  });

  // NACHARBEIT 3 (BEN): das Zitat steht im Inhalt, aber Art oder Abschnitt bestimmen keinen
  // vorhandenen Block. Vorher nahm der Dienst solche Anker an.
  it("S8 · falsche Art oder falscher Abschnitt zum vorhandenen Text: abgelehnt, nichts geschrieben", async () => {
    const ko = await objekt();
    const faelle = [
      stelle(1, "tabelle", "Ablauf", ERSTER_ABSATZ),
      stelle(1, "absatz", "Grenzwerte", ERSTER_ABSATZ),
      stelle(1, "absatz", "Gibt es nicht", ERSTER_ABSATZ),
      // Nur ein TEIL des Absatzes — das ist keine Stelle.
      stelle(1, "absatz", "Ablauf", "Erst das Ventil X schließen"),
    ];
    for (const falsch of faelle) {
      const code = await fehlercode(service.addComment(ko.id, "eva", "Frage.", { stelle: falsch }));
      expect(code, JSON.stringify(falsch)).toBe("INVALID");
    }
    expect((await service.get(ko.id))?.comments ?? []).toEqual([]);
  });
});
