// ================================================================================================
// AUFTRAG-mega78 BLOCK A — EINE BEHAUPTUNG IST KEIN BERECHTIGUNGSNACHWEIS.
// ================================================================================================
//
// DER BEFUND (ben, sammel74 → mega76 ROT). Die Trägersuche aus mega76 hat das Anhangsloch für drei
// zusätzliche Herkünfte geschlossen — und dabei eine Rechteumgehung geöffnet. `traegtObjekt`
// akzeptierte JEDES `bodyHtml`, das die Objektkennung als ZEICHENFOLGE enthält, und `entwurfTraegt`
// zusätzlich frei geliefertes `objectIds`. Sobald EIN so gefundener Träger für den Nutzer sichtbar
// war, gab `beurteileAnhang` den Anhang frei.
//
// Die Folge in einem Satz: wer die Kennung eines fremden Objekts kennt, schreibt sie in ein EIGENES
// Wissensobjekt oder einen EIGENEN Entwurf — und die selbstgeschriebene Behauptung wird als
// sichtbarer Träger gewertet.
//
// bens Satz ist der Maßstab dieses Tests: „Exakte UUIDs sind kein Berechtigungsnachweis; ihre
// Unerratbarkeit darf eine fehlende Autorisierung nicht ersetzen."
//
// VIER WEGE, und alle vier stehen dem Angreifer offen, ohne dass er das fremde Objekt je öffnen
// durfte: eigenes Wissensobjekt im Fließtext · eigenes Wissensobjekt als strukturierter Anhang ·
// eigener Entwurf im Fließtext · eigener Entwurf als Ankerdokument.
//
// JEDER FALL IST AM DRAHT GEBAUT, nicht am Prädikat — dieselbe Regel wie mega74/mega76: die
// Objekte reisen durch die echten HTTP-Wege, damit der Test unabhängig davon bleibt, wie die
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

/** Admin · Opfer (experte) · ANGREIFER (experte, darf anlegen und überarbeiten) · Betrachter. */
async function setup(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `admin@${marke}.test`, "geheim12345");
  for (const [email, role] of [
    [`opfer@${marke}.test`, "experte"],
    [`angreifer@${marke}.test`, "experte"],
    [`viewer@${marke}.test`, "viewer"],
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
    opfer: await login(app, `opfer@${marke}.test`, "geheim12345"),
    angreifer: await login(app, `angreifer@${marke}.test`, "geheim12345"),
    viewer: await login(app, `viewer@${marke}.test`, "geheim12345"),
  };
}

async function upload(app: App, wer: Auth): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: wer,
    // BEWUSST OHNE `confidentiality` — genau so senden die normalen Anhang-Uploads.
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

async function rohbytes(app: App, wer: Auth, objectId: string) {
  return app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers: wer });
}

/**
 * Der Ausgangszustand jedes Falls: das Opfer lädt ein Bild hoch, hängt es an SEIN Wissensobjekt und
 * stuft dieses vertraulich ein. Danach ist BELEGT, dass der Angreifer den Anhang nicht bekommt —
 * ohne diese Vorbedingung wäre jedes spätere 404 nichtssagend.
 */
async function vertraulicherAnhang(app: App, opfer: Auth, angreifer: Auth) {
  const objectId = await upload(app, opfer);
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: opfer,
    payload: {
      title: "Vertrauliches Trägerobjekt",
      statement: "Ein Objekt, dessen Anhang die Stufe erbt.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const koId = created.json().id as string;

  const attach = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: opfer,
    payload: {
      action: "attach",
      attachment: { name: "typenschild.png", mime: "image/png", objectId },
    },
  });
  expect(attach.statusCode, attach.body).toBe(200);

  const stufe = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: opfer,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(stufe.statusCode, stufe.body).toBe(200);

  const vorher = await rohbytes(app, angreifer, objectId);
  expect(
    vorher.statusCode,
    `VORBEDINGUNG: ohne eigenen Träger bekommt der Angreifer den Anhang nicht.
    Antwort: ${vorher.statusCode}`,
  ).toBe(404);

  return { koId, objectId };
}

/**
 * Der Ausgangszustand der ENTWURFS-Wege: ein frisch hochgeladenes Objekt des Opfers OHNE Träger.
 * mega76 hat diesen Fall fail-closed gestellt — genau deshalb ist er die Zelle, in der die
 * Entwurfs-Behauptung überhaupt zur Wirkung kommt: solange eine aktuelle Fassung das Objekt trägt,
 * entscheidet die billige Stufe und der Entwurfszweig läuft gar nicht erst.
 */
async function traegerlosesOpferObjekt(app: App, opfer: Auth, angreifer: Auth): Promise<string> {
  const objectId = await upload(app, opfer);
  const vorher = await rohbytes(app, angreifer, objectId);
  expect(
    vorher.statusCode,
    `VORBEDINGUNG (mega76 B): ein trägerloses fremdes Objekt ist fail-closed.
    Antwort: ${vorher.statusCode}`,
  ).toBe(404);
  return objectId;
}

/** Ein eigenes, INTERNES Wissensobjekt des Angreifers — sichtbar für jeden. */
async function eigenesKo(app: App, angreifer: Auth, bodyHtml?: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: angreifer,
    payload: {
      title: "Mein eigenes Objekt",
      statement: "Ganz normales internes Wissen.",
      type: "best_practice",
      category: "Anlage 1",
      ...(bodyHtml ? { bodyHtml } : {}),
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

describe("mega78 A · ein selbstgeschriebener Träger öffnet keinen fremden Anhang", () => {
  it("WEG 1 — die fremde Kennung im FLIESSTEXT eines eigenen Wissensobjekts", async () => {
    const { app, opfer, angreifer } = await setup("mega78a1");
    const { objectId } = await vertraulicherAnhang(app, opfer, angreifer);

    // Der Angreifer schreibt die fremde Kennung in seinen EIGENEN, internen Fließtext.
    const eigenId = await eigenesKo(
      app,
      angreifer,
      `<p>Siehe <img src="/api/objects/${objectId}/raw"></p>`,
    );
    const gegenprobe = await app.inject({
      method: "GET",
      url: `/api/kos/${eigenId}`,
      headers: angreifer,
    });
    expect(
      String(gegenprobe.json().bodyHtml ?? ""),
      "VORBEDINGUNG: die Behauptung muss im gespeicherten Fließtext stehen",
    ).toContain(objectId);

    const res = await rohbytes(app, angreifer, objectId);
    expect(
      res.statusCode,
      `Eine exakte Kennung im eigenen Fließtext ist kein Berechtigungsnachweis.
      Antwort: ${res.statusCode}`,
    ).toBe(404);
  });

  it("WEG 2 — die fremde Kennung als STRUKTURIERTER Anhang am eigenen Wissensobjekt", async () => {
    const { app, opfer, angreifer } = await setup("mega78a2");
    const { objectId } = await vertraulicherAnhang(app, opfer, angreifer);

    const eigenId = await eigenesKo(app, angreifer);
    const attach = await app.inject({
      method: "PUT",
      url: `/api/kos/${eigenId}`,
      headers: angreifer,
      payload: {
        action: "attach",
        attachment: { name: "fremd.png", mime: "image/png", objectId },
      },
    });
    expect(
      attach.statusCode,
      `VORBEDINGUNG: die strukturierte Zuordnung ist nutzerkontrolliert und wird angenommen.
      Antwort: ${attach.statusCode} ${attach.body}`,
    ).toBe(200);

    const res = await rohbytes(app, angreifer, objectId);
    expect(
      res.statusCode,
      `Auch die strukturierte Zuordnung ist nur eine BEHAUPTUNG, solange sie nicht vom
      Hochladenden stammt. Antwort: ${res.statusCode}`,
    ).toBe(404);
  });

  it("WEG 5 — die fremde Kennung in den FLIESSTEXT eines DRITTEN Objekts hineinüberarbeitet", async () => {
    const { app, opfer, angreifer } = await setup("mega78a8");
    const { objectId } = await vertraulicherAnhang(app, opfer, angreifer);

    // Der Angreifer schreibt die Behauptung NICHT in ein eigenes Objekt, sondern überarbeitet ein
    // fremdes, internes — `revise` verlangt nur `ko.create`. Ein Nachweis, der am AUTOR des
    // Wissensobjekts hinge statt am Urheber der Zuordnung, fiele genau hier.
    const drittesKo = await eigenesKo(app, opfer);
    const revise = await app.inject({
      method: "PUT",
      url: `/api/kos/${drittesKo}`,
      headers: angreifer,
      payload: {
        action: "revise",
        changes: { bodyHtml: `<p><img src="/api/objects/${objectId}/raw"></p>` },
      },
    });
    expect(
      revise.statusCode,
      `VORBEDINGUNG: der Angreifer darf ein fremdes internes Objekt überarbeiten.
      Antwort: ${revise.statusCode} ${revise.body}`,
    ).toBe(200);

    const res = await rohbytes(app, angreifer, objectId);
    expect(
      res.statusCode,
      `Wer eine Zuordnung in ein fremdes Objekt hineinschreibt, hat sie behauptet,
      nicht nachgewiesen. Antwort: ${res.statusCode}`,
    ).toBe(404);
  });

  it("WEG 3 — die fremde Kennung im FLIESSTEXT eines eigenen Entwurfs", async () => {
    const { app, opfer, angreifer } = await setup("mega78a3");
    const objectId = await traegerlosesOpferObjekt(app, opfer, angreifer);

    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: angreifer,
      payload: {
        title: "Mein Entwurf",
        bodyHtml: `<p><img src="/api/objects/${objectId}/raw"></p>`,
      },
    });
    expect(draft.statusCode, draft.body).toBe(201);

    const res = await rohbytes(app, angreifer, objectId);
    expect(
      res.statusCode,
      `Ein eigener Entwurf ist unfertige eigene Arbeit — er verleiht keine Rechte an
      fremden Originalen. Antwort: ${res.statusCode}`,
    ).toBe(404);
  });

  it("WEG 4 — die fremde Kennung als ANKERDOKUMENT im eigenen Entwurf", async () => {
    const { app, opfer, angreifer } = await setup("mega78a4");
    const objectId = await traegerlosesOpferObjekt(app, opfer, angreifer);

    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: angreifer,
      payload: {
        title: "Mein Entwurf mit Anker",
        anchorDocuments: [{ key: "a1", objectId, name: "fremd.png", mime: "image/png" }],
        pendingSources: [{ label: "Beleg", anchorKey: "a1", objectId }],
      },
    });
    expect(draft.statusCode, draft.body).toBe(201);

    const res = await rohbytes(app, angreifer, objectId);
    expect(
      res.statusCode,
      `Frei geliefertes objectIds ist die reinste Form der Behauptung.
      Antwort: ${res.statusCode}`,
    ).toBe(404);
  });
});

describe("mega78 A · GEGENPROBEN — der Nachweisweg bleibt offen", () => {
  it("der Hochladende und der Admin bekommen den Anhang weiterhin", async () => {
    const { app, admin, opfer, angreifer } = await setup("mega78a5");
    const { objectId } = await vertraulicherAnhang(app, opfer, angreifer);

    for (const [wer, headers] of [
      ["Hochladender/Autor", opfer],
      ["Admin (ko.validate)", admin],
    ] as const) {
      const res = await rohbytes(app, headers, objectId);
      expect(res.statusCode, `${wer} muss den eigenen Anhang bekommen`).toBe(200);
    }
  });

  it("KALIBRIERUNG — der Anhang eines INTERNEN Objekts bleibt für Dritte erreichbar", async () => {
    const { app, opfer, viewer } = await setup("mega78a6");
    const objectId = await upload(app, opfer);
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: opfer,
      payload: {
        title: "Internes mit Anhang",
        statement: "Ein Objekt, an dem ein Original hängt.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const attach = await app.inject({
      method: "PUT",
      url: `/api/kos/${created.json().id}`,
      headers: opfer,
      payload: {
        action: "attach",
        attachment: { name: "typenschild.png", mime: "image/png", objectId },
      },
    });
    expect(attach.statusCode, attach.body).toBe(200);

    const res = await rohbytes(app, viewer, objectId);
    expect(
      res.statusCode,
      `Ohne diesen Fall bewiesen die Tests oben nur, dass die Route gar nichts mehr
      herausgibt. Antwort: ${res.statusCode}`,
    ).toBe(200);
  });

  it("KALIBRIERUNG — ein Bild im FLIESSTEXT des eigenen Objekts bleibt für Dritte erreichbar", async () => {
    const { app, opfer, viewer } = await setup("mega78a7");
    const objectId = await upload(app, opfer);
    await eigenesKo(app, opfer, `<p><img src="/api/objects/${objectId}/raw"></p>`);

    const res = await rohbytes(app, viewer, objectId);
    expect(
      res.statusCode,
      `Wer sein EIGENES Bild in seinen EIGENEN internen Fließtext schreibt, hat die
      Zuordnung nachgewiesen — sie darf nicht mit der fremden Behauptung sterben.
      Antwort: ${res.statusCode}`,
    ).toBe(200);
  });
});
