import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ==============================================================================================
// AUFTRAG-mega20 Block D — DER ENTWURF TRÄGT DIE REFERENZ.
// ==============================================================================================
//
// DER BEFUND. `DraftPayload.pendingSources` trug bis mega19 nur Text: Label, Adresse, Auszug,
// Herkunftsquelle. Die Bindung an das Originaldokument (`anchorKey`, `objectId`) lebte
// ausschliesslich im flüchtigen Zustand der Oberfläche und wurde beim Speichern ABGESTREIFT —
// Capture.tsx und captureSources.ts haben die Grenze selbst benannt.
//
// DIE FOLGE: nach „Entwurf speichern" und „Fortsetzen" stand der aus einem Dokument übernommene
// TEXT weiterhin im Body, sein Beleg war weg. Der Einreich-Weg sah keine verankerten Quellen mehr,
// wählte den einfachen Promote-Pfad — und heraus kam ein Wissensobjekt mit Dokumentinhalt OHNE
// Herkunft. Genau der Zustand, den mega18 und mega19 an jeder anderen Stelle geschlossen haben,
// nur über den Umweg eines Zwischenspeicherns.
//
// Diese Datei belegt beides: den ROUNDTRIP mit geprüfter Referenz, und die harte Kante — KEIN
// BODY-RESUME OHNE ANKER.

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

type App = ReturnType<typeof buildApp>;

const INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
};

async function login(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const headers = await login(app, "a@x.de", "secret123");
  return { app, headers, services };
}

async function objektAnlegen(app: App, headers: Record<string, string>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: {
      name: "Pruefbericht.pdf",
      mime: "application/pdf",
      data: PDF_DATA_URL,
      purpose: "anchor",
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

/** Ein Entwurf, wie ihn die Oberfläche nach einer Dokumentübernahme speichert. */
function entwurfMitAnker(objectId: string) {
  return {
    ...INHALT,
    bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
    pendingSources: [
      {
        label: "Pruefbericht.pdf",
        excerpt: "Dichtung nach 500 h tauschen.",
        anchorKey: "lokal-1",
        objectId,
      },
    ],
    anchorDocuments: [
      { key: "lokal-1", objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
    ],
  };
}

async function entwurfAnlegen(
  app: App,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
) {
  const res = await app.inject({ method: "POST", url: "/api/drafts", headers, payload });
  expect(res.statusCode).toBeLessThan(300);
  return res.json().id as string;
}

// ----------------------------------------------------------------------------------------------
// 1. DER ROUNDTRIP — was gespeichert wird, kommt zurück.
// ----------------------------------------------------------------------------------------------
describe("mega20 D: der Entwurf persistiert die gesicherte Original-Referenz", () => {
  it("Speichern → Fortsetzen: Belegstelle, Zuordnung UND Ankerdokument sind wieder da", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers, entwurfMitAnker(objectId));

    const geladen = await app.inject({ method: "GET", url: `/api/drafts/${draftId}`, headers });
    expect(geladen.statusCode).toBe(200);
    const payload = geladen.json().payload as {
      bodyHtml?: string | null;
      pendingSources?: { anchorKey?: string; objectId?: string }[];
      anchorDocuments?: { key: string; objectId: string; name: string; mime: string }[];
    };
    // Der Body ist da — der Anker hält.
    expect(payload.bodyHtml ?? "").toContain("Dichtung nach 500 h tauschen");
    // Die ZUORDNUNG ist da: welche Belegstelle gehört zu welchem Dokument.
    expect(payload.pendingSources?.[0]?.anchorKey).toBe("lokal-1");
    expect(payload.pendingSources?.[0]?.objectId).toBe(objectId);
    // Und das gesicherte ORIGINAL ist da, mit Name und Typ für den Anker-Payload.
    expect(payload.anchorDocuments).toHaveLength(1);
    expect(payload.anchorDocuments?.[0]).toMatchObject({
      key: "lokal-1",
      objectId,
      name: "Pruefbericht.pdf",
      mime: "application/pdf",
    });
    // Und keine Warnung, weil es nichts zu warnen gibt.
    expect(geladen.json().anchorsMissing).toBeUndefined();
  });

  it("die neuen Felder laufen durch dieselbe Härtung wie alles andere an dieser Grenze", async () => {
    const { app, headers } = await setup();
    // Echte Objektkennungen, damit dieser Test die NORMALISIERUNG prüft und nicht versehentlich die
    // Ankerprüfung (die alles mit unbekannter Kennung ohnehin ausdünnt — der nächste Block).
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers, {
      ...INHALT,
      pendingSources: [
        { label: "A", anchorKey: 42, objectId: { boese: true } },
        { label: "B", anchorKey: `  ${"x".repeat(400)}  `, objectId: `  ${objectId}  ` },
      ],
      anchorDocuments: [
        // Unvollständig ⇒ fällt WEG. Ein halber Anker ist die Behauptung ohne Deckung.
        { key: "k1", objectId },
        { key: "k2", objectId, name: "  Zweite.pdf  ", mime: " application/pdf " },
        // Doppelter Schlüssel ⇒ nur der erste zählt.
        { key: "k2", objectId, name: "Dritte.pdf", mime: "application/pdf" },
        "kein objekt",
      ],
    });
    const payload = (
      await app.inject({ method: "GET", url: `/api/drafts/${draftId}`, headers })
    ).json().payload as {
      pendingSources?: { anchorKey?: unknown; objectId?: unknown }[];
      anchorDocuments?: { key: string; objectId: string; name: string; mime: string }[];
    };
    // Falscher Typ ⇒ Feld weg (der Eintrag selbst überlebt, sein Label ist gültig).
    expect(payload.pendingSources?.[0]?.anchorKey).toBeUndefined();
    expect(payload.pendingSources?.[0]?.objectId).toBeUndefined();
    // Überlang ⇒ gekürzt; Rand-Leerzeichen ⇒ weg.
    expect(String(payload.pendingSources?.[1]?.anchorKey).length).toBeLessThanOrEqual(128);
    expect(payload.pendingSources?.[1]?.objectId).toBe(objectId);
    // Genau EIN gültiges Ankerdokument bleibt übrig.
    expect(payload.anchorDocuments).toHaveLength(1);
    expect(payload.anchorDocuments?.[0]).toMatchObject({
      key: "k2",
      objectId,
      name: "Zweite.pdf",
      mime: "application/pdf",
    });
  });
});

// ----------------------------------------------------------------------------------------------
// 2. KEIN BODY-RESUME OHNE ANKER.
// ----------------------------------------------------------------------------------------------
describe("mega20 D: der Server prüft die Referenz beim Fortsetzen", () => {
  it("ist das gesicherte Original weg, kommt der BODY NICHT zurück — und der Grund steht dabei", async () => {
    const { app, headers, services } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers, entwurfMitAnker(objectId));

    // Das Original verschwindet (Aufräumlauf, Migration, Betreiber-Eingriff — der Weg ist egal).
    expect(await services.objects.delete(objectId)).toBe(true);

    const geladen = await app.inject({ method: "GET", url: `/api/drafts/${draftId}`, headers });
    expect(geladen.statusCode).toBe(200);
    const body = geladen.json() as {
      anchorsMissing?: string[];
      payload: {
        title?: string;
        bodyHtml?: string | null;
        pendingSources?: unknown[];
        anchorDocuments?: unknown[];
      };
    };
    // DIE ZUSAGE: der übernommene Text kommt NICHT zurück. Er wäre Dokumentinhalt ohne Herkunft —
    // speicherbar, einreichbar, und niemand könnte mehr sagen, woraus er stammt.
    expect(body.payload.bodyHtml ?? null).toBeNull();
    // Die verwaisten Belegstellen ebenfalls nicht: eine Belegstelle ohne Original ist kein Beleg.
    expect(body.payload.pendingSources ?? []).toHaveLength(0);
    expect(body.payload.anchorDocuments ?? []).toHaveLength(0);
    // Der Aufrufer erfährt AUSDRÜCKLICH, welches Original fehlt — kein stilles Verschwinden.
    expect(body.anchorsMissing).toEqual([objectId]);
    // Aber die eigene Arbeit ohne Herkunftsproblem bleibt: Titel, Aussage, Metadaten.
    expect(body.payload.title).toBe(INHALT.title);
  });

  it("das EINREICHEN bricht ehrlich ab, statt ein Objekt ohne Herkunft zu erzeugen", async () => {
    const { app, headers, services } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers, entwurfMitAnker(objectId));
    await services.objects.delete(objectId);

    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/promote`,
      headers,
    });
    expect(promote.statusCode).toBe(400);
    expect(promote.json().error).toBe("MISSING_DRAFT_ANCHOR");
    // Und im Bestand steht nichts.
    const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(kos.json()).toHaveLength(0);
    // Der Entwurf lebt weiter — nichts wurde nebenbei vernichtet.
    expect((await app.inject({ method: "GET", url: "/api/drafts", headers })).json()).toHaveLength(
      1,
    );
  });

  it("auch der Weg über die Erstanlage aus Dokumenten bleibt fail-closed", async () => {
    // Zweite Tür, dieselbe Regel: `POST /api/kos/from-document` mit `draftId` lädt den Entwurf
    // über denselben Zugang (`toKoInput`) und läuft damit durch dieselbe Ankerprüfung.
    const { app, headers, services } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers, entwurfMitAnker(objectId));
    const zweiterAnker = await objektAnlegen(app, headers);
    await services.objects.delete(objectId);

    const res = await app.inject({
      method: "POST",
      url: "/api/kos/from-document",
      headers,
      payload: {
        operationId: "entwurf-ohne-anker-1",
        draftId,
        // AUFTRAG-mega22 Block C: `draftPayload` ist bei gesetztem `draftId` Pflicht.
        draftPayload: {},
        documents: [
          {
            anchor: { objectId: zweiterAnker, name: "Pruefbericht.pdf", mime: "application/pdf" },
            points: [{ label: "Pruefbericht.pdf", excerpt: "eins" }],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("MISSING_DRAFT_ANCHOR");
    expect((await app.inject({ method: "GET", url: "/api/kos", headers })).json()).toHaveLength(0);
  });

  it("GEGENPROBE: ein Entwurf OHNE jede Referenz wird von der Prüfung nicht angefasst", async () => {
    // Kein Daueralarm: die überwältigende Mehrheit der Entwürfe hat nie ein Dokument gesehen.
    const { app, headers } = await setup();
    const draftId = await entwurfAnlegen(app, headers, {
      ...INHALT,
      bodyHtml: "<p>Selbst getippt.</p>",
    });
    const geladen = await app.inject({ method: "GET", url: `/api/drafts/${draftId}`, headers });
    expect(geladen.json().payload.bodyHtml).toContain("Selbst getippt");
    expect(geladen.json().anchorsMissing).toBeUndefined();
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/promote`,
      headers,
    });
    expect(promote.statusCode).toBe(201);
    expect(promote.json().bodyHtml).toContain("Selbst getippt");
  });

  it("GEGENPROBE: hält das Original, läuft der Entwurfsweg ganz normal durch", async () => {
    const { app, headers } = await setup();
    const objectId = await objektAnlegen(app, headers);
    const draftId = await entwurfAnlegen(app, headers, entwurfMitAnker(objectId));

    const res = await app.inject({
      method: "POST",
      url: "/api/kos/from-document",
      headers,
      payload: {
        operationId: "entwurf-mit-anker-1",
        draftId,
        draftPayload: {},
        documents: [
          {
            anchor: { objectId, name: "Pruefbericht.pdf", mime: "application/pdf" },
            points: [{ label: "Pruefbericht.pdf", excerpt: "Dichtung nach 500 h tauschen." }],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    const ko = res.json();
    expect(ko.attachments).toHaveLength(1);
    expect(ko.sources).toHaveLength(1);
    expect(ko.bodyHtml).toContain("Dichtung nach 500 h tauschen");
  });
});
