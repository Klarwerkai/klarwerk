// ================================================================================================
// JOB 2021 · G8 — DIE MEDIENANALYSE WAR EIN EXISTENZORAKEL.
// ================================================================================================
//
// DER BEFUND. Genau DREI Stellen lesen den Objektspeicher: `object-routes.ts:241` (Metadaten),
// `object-routes.ts:267` (Rohbytes) und `media/src/service.ts:92` — die dritte über
// `POST /api/media/analyze`. Die ersten beiden fällen vor der Antwort das Sichtbarkeitsurteil und
// antworten sonst 404, ausdrücklich begründet in `object-routes.ts:247`:
//
//     „sonst wird die Kopfzeile zum Existenzorakel, das der 404 gerade verhindern soll."
//
// Die dritte tat es nicht. Sie forderte dasselbe `ko.read` und nahm eine BELIEBIGE `objectId` aus
// dem Rumpf entgegen.
//
// WARUM DAS NICHT AUFFIEL. `media.analyze()` sieht sehr wohl nach der Vertraulichkeit — aber nur,
// um den INHALT nicht an die externe Transkriptions-KI zu geben (service.ts:119). Einen Betrachter
// nimmt es gar nicht entgegen (service.ts:87). Der Sammler hat diese Filterung als Sperre gelesen
// und die Route bis zum 23.08. als `DIENST_FILTERT` geführt. Ein Egressfilter für den Inhalt ist
// aber keine Sichtbarkeitsprüfung für den Leser.
//
// WAS HINAUSGING. Kein Transkript — dafür der Bestand selbst, in drei unterscheidbaren Antworten:
//
//     404 NOT_FOUND          → diese Kennung gibt es nicht
//     400 UNSUPPORTED_KIND   → es gibt sie, sie ist KEIN Video
//     200 + Vertraulichkeits-Hinweis → es gibt sie, sie IST ein Video, und sie ist vertraulich
//
// Ein Betrachter ohne jedes Recht am Objekt konnte damit durch Raten von Kennungen erheben, welche
// Anhänge es gibt, welcher Art sie sind und welche vertraulich sind. Das ist die Auskunft, die die
// Schwesterrouten seit mega74 C verweigern.
//
// DIESER WÄCHTER PRÜFT AM DRAHT, nicht am Quelltext — die Lehre aus mega69. Und er prüft die
// GLEICHHEIT der Antworten, nicht nur den Status: ein Orakel, das statt 200 einen 404 mit anderem
// Rumpf gibt, wäre immer noch ein Orakel.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MP4_DATA_URL = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=";

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

async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@g8.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@g8.test", "geheim12345");
  for (const [email, role] of [
    ["viewer@g8.test", "viewer"],
    ["autor@g8.test", "experte"],
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
    autor: await login(app, "autor@g8.test", "geheim12345"),
    viewer: await login(app, "viewer@g8.test", "geheim12345"),
  };
}

// Hängt ein Objekt der gewünschten Art an ein frisches Wissensobjekt und stuft dieses bei Bedarf
// hoch. Die Stufe sitzt am WISSENSOBJEKT, nicht am Anhang — genau der Fall, den `analyze()` über
// `koConfidentiality` auflöst und den `beurteileAnhang` über die Trägerkette beurteilt.
async function anhangAmKo(
  app: App,
  autor: Auth,
  art: "video" | "image",
  vertraulich: boolean,
): Promise<string> {
  const up = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: autor,
    payload: {
      name: art === "video" ? "aufnahme.mp4" : "typenschild.png",
      mime: art === "video" ? "video/mp4" : "image/png",
      data: art === "video" ? MP4_DATA_URL : PNG_DATA_URL,
      kind: art,
      purpose: art === "video" ? "media" : "attachment",
    },
  });
  expect(up.statusCode, up.body).toBe(201);
  const objectId = up.json().id as string;

  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: vertraulich ? "Vertrauliche Aufnahme" : "Interne Aufnahme",
      statement: "Ein Objekt, an dem ein Original hängt.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const koId = created.json().id as string;

  const attach = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: autor,
    payload: {
      action: "attach",
      attachment: {
        name: art === "video" ? "aufnahme.mp4" : "typenschild.png",
        mime: "x",
        objectId,
      },
    },
  });
  expect(attach.statusCode, attach.body).toBe(200);

  if (vertraulich) {
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
  }
  return objectId;
}

function analyse(app: App, auth: Auth, objectId: string) {
  return app.inject({
    method: "POST",
    url: "/api/media/analyze",
    headers: auth,
    payload: { objectId, locale: "de" },
  });
}

describe("G8 · POST /api/media/analyze verrät den Bestand nicht mehr", () => {
  // OHNE DIESEN FALL WÄRE DIE DATEI UNFÄLSCHBAR: Ein Wächter, der nur 404 verlangt, bliebe auch
  // dann grün, wenn die Route gar nichts mehr beantwortet oder der Aufbau nie ein Video erzeugt
  // hat. Hier steht deshalb zuerst, dass es das Objekt WIRKLICH gibt und die Route für den
  // Berechtigten WIRKLICH antwortet. Erst dadurch bedeutet der 404 unten „verschwiegen" und nicht
  // „kaputt".
  it("VORBEDINGUNG — der Autor bekommt für dasselbe Objekt eine echte Antwort", async () => {
    const { app, autor } = await setup();
    const objectId = await anhangAmKo(app, autor, "video", true);

    const res = await analyse(app, autor, objectId);
    expect(res.statusCode, `Der Autor darf sein eigenes Objekt sehen. Antwort: ${res.body}`).toBe(
      200,
    );
    expect(res.json().objectId).toBe(objectId);
  });

  it("Betrachter bekommt 404 statt der Auskunft, dass ein vertrauliches Video existiert", async () => {
    const { app, autor, viewer } = await setup();
    const objectId = await anhangAmKo(app, autor, "video", true);

    const res = await analyse(app, viewer, objectId);
    expect(
      res.statusCode,
      `Vertrauliches Video, Betrachter ohne Recht. Antwort: ${res.statusCode} ${res.body}`,
    ).toBe(404);
    expect(res.statusCode).not.toBe(403);
    expect(res.body).not.toContain("Vertrauliche Inhalte");
  });

  // DER EIGENTLICHE ORAKELTEST. Nicht „es kommt ein 404", sondern „die beiden Fälle sind für den
  // Unbefugten NICHT UNTERSCHEIDBAR". Genau daran ist die Route vorher gescheitert.
  it("Vorhanden-aber-unsichtbar antwortet BYTEGLEICH wie gar-nicht-vorhanden", async () => {
    const { app, autor, viewer } = await setup();
    const objectId = await anhangAmKo(app, autor, "video", true);

    const unsichtbar = await analyse(app, viewer, objectId);
    const erfunden = await analyse(app, viewer, "obj_gibt-es-nicht-0000");

    expect(erfunden.statusCode).toBe(404);
    expect(unsichtbar.statusCode).toBe(erfunden.statusCode);
    expect(
      unsichtbar.body,
      `Der Rumpf unterscheidet die beiden Fälle — damit bleibt das Orakel bestehen.\nunsichtbar: ${unsichtbar.body}\nerfunden:   ${erfunden.body}`,
    ).toBe(erfunden.body);
  });

  // Die ART war die zweite Auskunft: 400 UNSUPPORTED_KIND hiess „es gibt die Kennung, sie ist nur
  // kein Video". Auch das ist Bestand.
  it("Auch die ART bleibt verschwiegen — kein 400 UNSUPPORTED_KIND für Unbefugte", async () => {
    const { app, autor, viewer } = await setup();
    const objectId = await anhangAmKo(app, autor, "image", true);

    const res = await analyse(app, viewer, objectId);
    expect(
      res.statusCode,
      `Vertrauliches Bild. Ein 400 verriete, dass die Kennung existiert. Antwort: ${res.body}`,
    ).toBe(404);
    expect(res.body).not.toContain("UNSUPPORTED_KIND");
  });

  // GEGENPROBE: strenger, nicht kaputt. Wer das Objekt sehen darf, wird nicht ausgesperrt.
  it("Ein Betrachter behält den Zugang zu einem NICHT vertraulichen Video", async () => {
    const { app, autor, viewer } = await setup();
    const objectId = await anhangAmKo(app, autor, "video", false);

    const res = await analyse(app, viewer, objectId);
    expect(
      res.statusCode,
      `Internes Video — der Betrachter darf es sehen. Antwort: ${res.statusCode} ${res.body}`,
    ).toBe(200);
    expect(res.json().objectId).toBe(objectId);
  });
});
