// ================================================================================================
// PLAN-SPRACHANMERKUNG (R-1625, R-2177) · D1 — DIE NOTIZ AN EINEM PUNKT DER ZEICHNUNG, AM DIENST
// ================================================================================================
//
// Gemessen am echten `KoService` mit der Speicherablage und an der echten Route
// `PUT /api/kos/:id` (action: comment; Hülle `tests/wiki-diskussion/huelle.ts`).
//
// P1  eine Rückfrage an ein Bild trägt den Punkt in der Zeichnung (relativ, vier Nachkommastellen)
// P2  die Form: Punkt nur am Bild, x und y je 0..1 (Ränder eingeschlossen); sonst „unlesbar"
// P3  derselbe Text an einem anderen Punkt ist eine andere Absendung; dieselbe bleibt eine
// P4  nach einer Überarbeitung steht der Punkt unverändert am Beitrag
// P5  ROUTE: der Punkt reist über den echten PUT und steht beim nächsten Lesen da; ein Punkt
//     ausserhalb des Bildes oder an einem Absatz ist ein Formfehler (400), nichts geschrieben
import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  type KoCommentStelle,
  KoService,
  leseStelle,
} from "../../services/knowledge-object";
import { stellenFingerabdruck } from "../../services/knowledge-object/src/stellen-fingerabdruck";
import {
  type App,
  type Kopf,
  type Objektstand,
  beitraege,
  flaeche,
  lesen,
  put,
} from "../wiki-diskussion/huelle";

const INHALT = [
  "<h2>Bohrbild</h2>",
  "<p>Bezugspunkt ist die linke Kante.</p>",
  '<figure data-image-id="plan-1"><img src="/api/objects/obj1/raw" alt="Bohrbild Flansch" data-image-id="plan-1"><figcaption data-image-id="plan-1">Bohrbild Flansch DN 80</figcaption></figure>',
].join("");

const BILD: KoCommentStelle = {
  koVersion: 1,
  art: "bild",
  abschnitt: "Bohrbild",
  text: "plan-1",
  fingerabdruck: stellenFingerabdruck("bild", "Bohrbild", "plan-1"),
};

const ABSATZ: KoCommentStelle = {
  koVersion: 1,
  art: "absatz",
  abschnitt: "Bohrbild",
  text: "Bezugspunkt ist die linke Kante.",
  fingerabdruck: stellenFingerabdruck("absatz", "Bohrbild", "Bezugspunkt ist die linke Kante."),
};

const NOTIZ = "Hier wird oft falsch gemessen, der Bezugspunkt muss die linke Kante sein.";

/** Ein Beitrag, wie die Route ihn beim Lesen zurückgibt. */
interface Gelesen {
  text: string;
  stelle?: unknown;
}

describe("PLAN-SPRACHANMERKUNG · D1 — Punkt in der Zeichnung am Dienst", () => {
  let service: KoService;

  beforeEach(() => {
    service = new KoService({ repo: new InMemoryKoRepo(), versions: new InMemoryKoVersionRepo() });
  });

  async function objekt(): Promise<KnowledgeObject> {
    return service.create({
      title: "Flansch DN 80 bohren",
      statement: "Bohrbild nach Zeichnung, Bezug linke Kante.",
      bodyHtml: INHALT,
      type: "best_practice",
      category: "Fertigung",
      author: "pedi",
    });
  }

  it("P1 · die Rückfrage an das Bild trägt den Punkt — gerundet auf vier Nachkommastellen", async () => {
    const ko = await objekt();
    const gelesen = leseStelle({ ...BILD, punkt: { x: 0.123456, y: 0.98765 } });
    expect(gelesen).toEqual({ ...BILD, punkt: { x: 0.1235, y: 0.9877 } });

    const stand = await service.addComment(ko.id, "eva", NOTIZ, {
      stelle: gelesen as KoCommentStelle,
    });

    expect(stand.comments).toHaveLength(1);
    expect(stand.comments[0]?.stelle).toEqual({ ...BILD, punkt: { x: 0.1235, y: 0.9877 } });
    expect((await service.get(ko.id))?.comments[0]?.stelle?.punkt).toEqual({
      x: 0.1235,
      y: 0.9877,
    });
  });

  it("P2 · Punkt nur am Bild und nur im Bild; ohne Punkt bleibt die Stelle wie vorher", () => {
    expect(leseStelle({ ...BILD, punkt: { x: 0, y: 1 } })).toEqual({
      ...BILD,
      punkt: { x: 0, y: 1 },
    });
    // KALIBRIERUNG: ohne Punkt kein Feld — eine Bildrückfrage gilt dann dem ganzen Bild.
    expect(leseStelle(BILD)).toEqual(BILD);
    expect(leseStelle(BILD)).not.toHaveProperty("punkt");

    for (const punkt of [
      { x: 1.01, y: 0.5 },
      { x: -0.01, y: 0.5 },
      { x: 0.5 },
      { x: "0.5", y: 0.5 },
      { x: Number.NaN, y: 0.5 },
      { x: Number.POSITIVE_INFINITY, y: 0.5 },
      "mitte",
      null,
    ]) {
      expect(leseStelle({ ...BILD, punkt }), JSON.stringify(punkt)).toBe("unlesbar");
    }
    expect(leseStelle({ ...ABSATZ, punkt: { x: 0.5, y: 0.5 } })).toBe("unlesbar");
  });

  it("P3 · derselbe Text an einem anderen Punkt ist eine andere Absendung", async () => {
    const ko = await objekt();
    const links = { ...BILD, punkt: { x: 0.1, y: 0.5 } };
    const rechts = { ...BILD, punkt: { x: 0.9, y: 0.5 } };

    await service.addComment(ko.id, "eva", NOTIZ, { clientKey: "k1", stelle: links });
    await service.addComment(ko.id, "eva", NOTIZ, { clientKey: "k1", stelle: links });
    expect((await service.get(ko.id))?.comments).toHaveLength(1);

    await service.addComment(ko.id, "eva", NOTIZ, { clientKey: "k1", stelle: rechts });
    const stand = await service.get(ko.id);
    expect(stand?.comments.map((c) => c.stelle?.punkt)).toEqual([
      { x: 0.1, y: 0.5 },
      { x: 0.9, y: 0.5 },
    ]);
  });

  it("P4 · nach einer Überarbeitung steht der Punkt unverändert am Beitrag", async () => {
    const ko = await objekt();
    const stelle = { ...BILD, punkt: { x: 0.25, y: 0.75 } };
    await service.addComment(ko.id, "eva", NOTIZ, { stelle });

    const weiter = await service.revise(
      ko.id,
      { bodyHtml: `${INHALT}<p>Toleranz ±0,1 mm.</p>` },
      "pedi",
    );

    expect(weiter.version).toBe(2);
    expect(weiter.comments[0]?.stelle).toEqual(stelle);
  });
});

async function anlegenMitZeichnung(app: App, headers: Kopf): Promise<Objektstand> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Flansch DN 80 bohren",
      statement: "Bohrbild nach Zeichnung, Bezug linke Kante.",
      bodyHtml: INHALT,
      type: "best_practice",
      category: "Fertigung",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return angelegt.json() as Objektstand;
}

describe("PLAN-SPRACHANMERKUNG · D1 — Punkt in der Zeichnung an der Route", () => {
  it("P5 · der Punkt reist über den echten PUT; ein Punkt ausserhalb oder am Absatz ist 400", async () => {
    const { app, admin } = await flaeche();
    const ko = await anlegenMitZeichnung(app, admin);
    expect(ko.version).toBe(1);

    for (const stelle of [
      { ...BILD, punkt: { x: 1.5, y: 0.5 } },
      { ...BILD, punkt: { x: 0.5 } },
      { ...ABSATZ, punkt: { x: 0.5, y: 0.5 } },
    ]) {
      const res = await put(app, admin, ko.id, { action: "comment", text: NOTIZ, stelle });
      expect(res.statusCode, JSON.stringify(stelle)).toBe(400);
    }
    expect(beitraege(await lesen(app, admin, ko.id))).toEqual([]);

    const stelle = { ...BILD, punkt: { x: 0.3, y: 0.6 } };
    const res = await put(app, admin, ko.id, { action: "comment", text: NOTIZ, stelle });
    expect(res.statusCode).toBe(200);

    const gelesen = beitraege(await lesen(app, admin, ko.id)) as unknown as Gelesen[];
    expect(gelesen).toHaveLength(1);
    expect(gelesen[0]?.text).toBe(NOTIZ);
    expect(gelesen[0]?.stelle).toEqual(stelle);
  });
});
