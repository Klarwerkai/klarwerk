// ================================================================================================
// AUFTRAG-mega76 BLOCK B — DER ANHANGSSCHUTZ DECKT ALLE HERKÜNFTE, UND DER TRÄGERLOSE FALL IST
// FAIL-CLOSED.
// ================================================================================================
//
// DER BEFUND (ben, sammel71). `beurteileAnhang` durchsuchte bis mega76 AUSSCHLIESSLICH die
// aktuellen Wissensobjekte, und dort nur `attachments[].objectId` sowie die Objektkennung im
// aktuellen `bodyHtml`. DREI Herkünfte fielen durch: Versions-Schnappschüsse, Belegketten und
// Entwürfe.
//
// UND DER AUSGANG WAR DER GEFÄHRLICHE. Fiel ein Objekt nur in einer dieser drei an, galt es als
// TRÄGERLOS; bei normalen Uploads ist die eigene `ObjectRef.confidentiality` gar nicht gesetzt (nur
// der Medien-Upload setzt sie), der trägerlose Zweig rief also `darfSehen` mit LEERER Stufe auf —
// und leer gilt als „intern" und damit als sichtbar. Fail-open an genau der Stelle, an der
// fail-closed versprochen war.
//
// JEDER FALL HIER IST AM DRAHT GEBAUT, nicht am Prädikat: die Objekte reisen durch die echten
// HTTP-Wege (Upload, Anlage, Überarbeitung, Entwurf), damit der Test unabhängig davon ist, wie die
// Trägersuche intern zugeschnitten wird.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `admin@${marke}.test`, "geheim12345");
  for (const [email, role] of [
    [`viewer@${marke}.test`, "viewer"],
    [`autor@${marke}.test`, "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    admin,
    autor: await login(app, `autor@${marke}.test`, "geheim12345"),
    viewer: await login(app, `viewer@${marke}.test`, "geheim12345"),
  };
}

async function upload(app: App, wer: Auth): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: wer,
    // BEWUSST OHNE `confidentiality` — genau so senden die normalen Anhang-/Bild-/Dokument-
    // Uploads (KnowledgeDetail.tsx, Capture.tsx, AppendToArticleModal.tsx). Der Fall, in dem der
    // trägerlose Zweig mit leerer Stufe urteilte.
    payload: {
      name: "typenschild.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

/** Ein vertrauliches Wissensobjekt anlegen; `bodyHtml` optional mit einer Objektreferenz. */
async function vertraulichesKo(app: App, autor: Auth, bodyHtml?: string): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: "Vertrauliches Trägerobjekt",
      statement: "Ein Objekt, dessen Anhang die Stufe erbt.",
      type: "best_practice",
      category: "Anlage 1",
      ...(bodyHtml ? { bodyHtml } : {}),
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const koId = created.json().id as string;
  const stufe = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: autor,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(stufe.statusCode, stufe.body).toBe(200);
  return koId;
}

async function rohbytes(app: App, wer: Auth, objectId: string) {
  return app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers: wer });
}

describe("mega76 B · die drei fehlenden Herkünfte der Trägersuche", () => {
  it("HERKUNFT 1 — nur im VERSIONS-SCHNAPPSCHUSS eines vertraulichen Objekts", async () => {
    const { app, autor, viewer } = await setup("mega76b1");
    const objectId = await upload(app, autor);
    // Die Anlage schreibt einen Voll-Snapshot („erstellt"). Er trägt das Bild im `bodyHtml`.
    const koId = await vertraulichesKo(
      app,
      autor,
      `<p>Typenschild: <img src="/api/objects/${objectId}/raw"></p>`,
    );
    // Die Überarbeitung entfernt die Referenz aus der AKTUELLEN Fassung — im Schnappschuss bleibt
    // sie. Damit ist das Bild nur noch über die Versionshistorie an seinem Träger.
    const revise = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "revise", changes: { bodyHtml: "<p>Ohne Bild.</p>" } },
    });
    expect(revise.statusCode, revise.body).toBe(200);

    const aktuell = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: autor });
    expect(
      String(aktuell.json().bodyHtml ?? ""),
      "Vorbedingung: die aktuelle Fassung darf das Bild NICHT mehr nennen",
    ).not.toContain(objectId);

    const res = await rohbytes(app, viewer, objectId);
    expect(
      res.statusCode,
      `Ein Bild, das nur im Schnappschuss eines vertraulichen Objekts hängt, darf der
      Betrachter nicht bekommen. Antwort: ${res.statusCode}`,
    ).toBe(404);
  });

  it("HERKUNFT 2 — nur in der BELEGKETTE eines vertraulichen Objekts", async () => {
    const { app, autor, viewer } = await setup("mega76b2");
    const objectId = await upload(app, autor);
    const koId = await vertraulichesKo(app, autor);

    const attach = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: {
        action: "attach",
        attachment: { name: "typenschild.png", mime: "image/png", objectId },
      },
    });
    expect(attach.statusCode, attach.body).toBe(200);
    const attachmentId = (attach.json().attachments as { id: string }[]).at(-1)?.id;
    expect(attachmentId, "Vorbedingung: der Anhang muss eine Kennung haben").toBeTruthy();

    // Abhängen entfernt den `attachments`-Eintrag. Die Belegkette ist append-only und behält den
    // `objectId`-Eintrag — sie ist damit die letzte Spur des Trägers.
    const detach = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "detach", attachmentId },
    });
    expect(detach.statusCode, detach.body).toBe(200);
    expect(
      (detach.json().attachments ?? []) as unknown[],
      "Vorbedingung: die aktuelle Fassung trägt den Anhang nicht mehr",
    ).toHaveLength(0);

    const res = await rohbytes(app, viewer, objectId);
    expect(
      res.statusCode,
      `Ein Bild, das nur noch in der Belegkette eines vertraulichen Objekts steht,
      darf der Betrachter nicht bekommen. Antwort: ${res.statusCode}`,
    ).toBe(404);
  });

  it("HERKUNFT 3 — nur im ENTWURF eines anderen Menschen", async () => {
    const { app, autor, viewer } = await setup("mega76b3");
    const objectId = await upload(app, autor);
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: autor,
      payload: {
        title: "Unfertiges",
        bodyHtml: `<p><img src="/api/objects/${objectId}/raw"></p>`,
      },
    });
    expect(draft.statusCode, draft.body).toBe(201);

    const fremd = await rohbytes(app, viewer, objectId);
    expect(
      fremd.statusCode,
      `Unfertige Arbeit eines anderen ist keine Auskunft für Dritte. Antwort: ${fremd.statusCode}`,
    ).toBe(404);

    const eigen = await rohbytes(app, autor, objectId);
    expect(
      eigen.statusCode,
      `GEGENPROBE: wer den Entwurf schreibt, muss sein eigenes Bild sehen. Antwort: ${eigen.statusCode}`,
    ).toBe(200);
  });
});

describe('mega76 B · der trägerlose Fall ist fail-closed, nicht „intern"', () => {
  it("frisch hochgeladen, ohne Stufe, ohne Träger — für Dritte 404", async () => {
    const { app, autor, viewer } = await setup("mega76b4");
    const objectId = await upload(app, autor);

    const res = await rohbytes(app, viewer, objectId);
    expect(
      res.statusCode,
      `Ein Anhang ohne auffindbaren Träger ist nicht „intern", sondern UNBEKANNT — und
      Unbekanntes wird nicht ausgeliefert. Antwort: ${res.statusCode}`,
    ).toBe(404);

    const meta = await app.inject({
      method: "GET",
      url: `/api/objects/${objectId}`,
      headers: viewer,
    });
    expect(meta.statusCode, `Auch der Metadaten-Weg. Antwort: ${meta.body}`).toBe(404);
  });

  it("GEGENPROBE — das Hochlade-Fenster bleibt offen: der Hochladende sieht sein Objekt", async () => {
    const { app, admin, autor } = await setup("mega76b5");
    const objectId = await upload(app, autor);

    for (const [wer, headers] of [
      ["Hochladender", autor],
      ["Admin (ko.validate)", admin],
    ] as const) {
      const res = await rohbytes(app, headers === autor ? autor : admin, objectId);
      expect(
        res.statusCode,
        `${wer} muss das ungebundene Objekt bekommen — sonst bricht das Hochlade-Fenster.
        Antwort: ${res.statusCode}`,
      ).toBe(200);
    }
  });

  it("die Zwischenspeicher-Zusage folgt mit: unbekannt ⇒ no-store", async () => {
    const { app, autor } = await setup("mega76b6");
    const objectId = await upload(app, autor);

    const res = await rohbytes(app, autor, objectId);
    expect(res.statusCode).toBe(200);
    expect(
      String(res.headers["cache-control"]),
      "was wir nicht einstufen können, darf nirgends liegenbleiben",
    ).toBe("no-store");
  });
});
