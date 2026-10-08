// ================================================================================================
// PLAN-SPRACHANMERKUNG (R-1625, R-2177) · NACHARBEIT 2 · D3 — DIE NOTIZ AN EINER HOCHGELADENEN
// ZEICHNUNG (PDF, CAD), AM DIENST UND AN DER ROUTE
// ================================================================================================
//
// BENs Befund: die erste Lieferung verankerte nur an Bildern im Text; R-1625 verlangt den Weg mit
// hochgeladenen CAD-Zeichnungen oder PDFs. Gemessen am echten `KoService` und am echten PUT:
//
// A1  eine Notiz an Seite 2 eines angehängten PDFs trägt Anhang, Seite und Punkt — und bleibt so
// A2  die Form: Seite nur am Anhang, ganzzahlig ab 1; ein Anhang hat keinen Abschnitt
// A3  ein Anhang, den der Eintrag nicht trägt, oder ein falscher Abdruck: INVALID, nichts geschrieben
// A4  derselbe Text auf einer anderen Seite ist eine andere Absendung
// A5  ROUTE: hochladen (PDF als Dokument), anhängen, Notiz an Seite und Punkt — 200 und beim
//     nächsten Lesen da; eine Notiz an einem fremden Objekt oder mit Seite 0 ist 400
import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  type KoCommentStelle,
  KoService,
  leseStelle,
  stelleAmAnhang,
} from "../../services/knowledge-object";
import { stellenFingerabdruck } from "../../services/knowledge-object/src/stellen-fingerabdruck";
import { type Objektstand, beitraege, flaeche, lesen, put } from "../wiki-diskussion/huelle";

const NOTIZ = "Hier wird oft falsch gemessen, der Bezugspunkt muss die linke Kante sein.";

/** Eine Stelle an dem Anhang mit dieser Objektkennung. */
const amAnhang = (objectId: string, extra: Partial<KoCommentStelle> = {}): KoCommentStelle => ({
  koVersion: 1,
  art: "anhang",
  abschnitt: "",
  text: objectId,
  fingerabdruck: stellenFingerabdruck("anhang", "", objectId),
  ...extra,
});

interface Gelesen {
  text: string;
  stelle?: unknown;
}

describe("PLAN-SPRACHANMERKUNG · D3 — Notiz an einer hochgeladenen Zeichnung, am Dienst", () => {
  let service: KoService;

  beforeEach(() => {
    service = new KoService({ repo: new InMemoryKoRepo(), versions: new InMemoryKoVersionRepo() });
  });

  async function mitPlan(): Promise<KnowledgeObject> {
    const ko = await service.create({
      title: "Flansch DN 80 bohren",
      statement: "Bohrbild nach Zeichnung, Bezug linke Kante.",
      type: "best_practice",
      category: "Fertigung",
      author: "pedi",
    });
    await service.addAttachment(ko.id, "pedi", {
      name: "Flansch-DN80.pdf",
      mime: "application/pdf",
      objectId: "obj-plan-1",
      size: 1234,
    });
    return (await service.get(ko.id)) as KnowledgeObject;
  }

  async function fehlercode(versuch: Promise<unknown>): Promise<string> {
    try {
      await versuch;
    } catch (e) {
      return String((e as { code?: unknown }).code);
    }
    return "kein Fehler";
  }

  it("A1 · Seite 2 eines angehängten PDFs mit Punkt: Anhang, Seite und Punkt stehen am Beitrag", async () => {
    const ko = await mitPlan();
    const gelesen = leseStelle(amAnhang("obj-plan-1", { seite: 2, punkt: { x: 0.25, y: 0.75 } }));
    expect(gelesen).toEqual(amAnhang("obj-plan-1", { seite: 2, punkt: { x: 0.25, y: 0.75 } }));

    const stand = await service.addComment(ko.id, "eva", NOTIZ, {
      stelle: gelesen as KoCommentStelle,
    });

    expect(stand.comments[0]?.stelle).toEqual(
      amAnhang("obj-plan-1", { seite: 2, punkt: { x: 0.25, y: 0.75 } }),
    );
    expect(stelleAmAnhang(stand.attachments, amAnhang("obj-plan-1"))).toBe(true);
  });

  it("A2 · Seite nur am Anhang und ganzzahlig ab 1; ein Anhang hat keinen Abschnitt", () => {
    expect(leseStelle(amAnhang("obj-plan-1"))).toEqual(amAnhang("obj-plan-1"));
    expect(leseStelle(amAnhang("obj-plan-1"))).not.toHaveProperty("seite");
    for (const seite of [0, -1, 1.5, "2", Number.NaN, 10_001]) {
      expect(leseStelle({ ...amAnhang("obj-plan-1"), seite }), String(seite)).toBe("unlesbar");
    }
    expect(leseStelle({ ...amAnhang("obj-plan-1"), abschnitt: "Bohrbild" })).toBe("unlesbar");
    const bild = {
      koVersion: 1,
      art: "bild",
      abschnitt: "",
      text: "plan-1",
      fingerabdruck: stellenFingerabdruck("bild", "", "plan-1"),
    };
    expect(leseStelle({ ...bild, seite: 1 })).toBe("unlesbar");
  });

  it("A3 · fremder Anhang oder falscher Abdruck: INVALID, nichts geschrieben", async () => {
    const ko = await mitPlan();
    const fremd = await fehlercode(
      service.addComment(ko.id, "eva", NOTIZ, { stelle: amAnhang("obj-gibt-es-nicht") }),
    );
    const abdruck = await fehlercode(
      service.addComment(ko.id, "eva", NOTIZ, {
        stelle: amAnhang("obj-plan-1", {
          fingerabdruck: stellenFingerabdruck("bild", "", "obj-plan-1"),
        }),
      }),
    );

    expect(fremd).toBe("INVALID");
    expect(abdruck).toBe("INVALID");
    expect((await service.get(ko.id))?.comments ?? []).toEqual([]);
  });

  it("A4 · derselbe Text auf einer anderen Seite ist eine andere Absendung", async () => {
    const ko = await mitPlan();
    const s1 = amAnhang("obj-plan-1", { seite: 1 });
    const s2 = amAnhang("obj-plan-1", { seite: 2 });

    await service.addComment(ko.id, "eva", NOTIZ, { clientKey: "k1", stelle: s1 });
    await service.addComment(ko.id, "eva", NOTIZ, { clientKey: "k1", stelle: s1 });
    await service.addComment(ko.id, "eva", NOTIZ, { clientKey: "k1", stelle: s2 });

    expect((await service.get(ko.id))?.comments.map((c) => c.stelle?.seite)).toEqual([1, 2]);
  });
});

describe("PLAN-SPRACHANMERKUNG · D3 — Notiz an einer hochgeladenen Zeichnung, an der Route", () => {
  it("A5 · PDF hochladen, anhängen, Notiz an Seite und Punkt — und die Formfehler sind 400", async () => {
    const { app, admin } = await flaeche();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        confidentiality: "intern",
        title: "Flansch DN 80 bohren",
        statement: "Bohrbild nach Zeichnung, Bezug linke Kante.",
        type: "best_practice",
        category: "Fertigung",
      },
    });
    expect(angelegt.statusCode).toBe(201);
    const ko = angelegt.json() as Objektstand;

    const hoch = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: admin,
      payload: {
        name: "Flansch-DN80.pdf",
        mime: "application/pdf",
        data: "data:application/pdf;base64,JVBERi0xLjQK",
        kind: "document",
        purpose: "attachment",
      },
    });
    expect(hoch.statusCode).toBe(201);
    const objectId = hoch.json().id as string;

    const angehaengt = await put(app, admin, ko.id, {
      action: "attach",
      attachment: { name: "Flansch-DN80.pdf", mime: "application/pdf", objectId },
    });
    expect(angehaengt.statusCode).toBe(200);
    const version = (await lesen(app, admin, ko.id)).version;

    for (const stelle of [
      { ...amAnhang("obj-fremd"), koVersion: version },
      { ...amAnhang(objectId), koVersion: version, seite: 0 },
      { ...amAnhang(objectId), koVersion: version, punkt: { x: 2, y: 0.5 } },
    ]) {
      const res = await put(app, admin, ko.id, { action: "comment", text: NOTIZ, stelle });
      expect(res.statusCode, JSON.stringify(stelle)).toBe(400);
    }
    expect(beitraege(await lesen(app, admin, ko.id))).toEqual([]);

    const punkt = { x: 0.4, y: 0.2 };
    const stelle = { ...amAnhang(objectId), koVersion: version, seite: 3, punkt };
    const res = await put(app, admin, ko.id, { action: "comment", text: NOTIZ, stelle });
    expect(res.statusCode).toBe(200);

    const gelesen = beitraege(await lesen(app, admin, ko.id)) as unknown as Gelesen[];
    expect(gelesen).toHaveLength(1);
    expect(gelesen[0]?.text).toBe(NOTIZ);
    expect(gelesen[0]?.stelle).toEqual(stelle);
  });
});
