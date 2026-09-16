// ================================================================================================
// JOB 4213 R3 · EINE ÜBERNAHME MACHT KEINE GESPERRTE DATEI SICHTBAR.
// ================================================================================================
//
// DER BEFUND, GEMESSEN VON BEN AN RUNDE 2: `BEN Anhang {"vorher":404,"nachher":200,"version":3}`.
//
// DIE KETTE, die dahinter steht, und warum sie greift:
//   1. B lädt ein Bild hoch. Es trägt KEINE eigene Vertraulichkeitsstufe — normale Uploads setzen
//      sie nicht —, und „unbekannt" wird so streng behandelt wie „vertraulich"
//      (`sichtbarkeit.ts`, `STUFE_FUER_UNBEKANNT`). Ohne NACHWEIS bleibt die Datei also zu.
//   2. A legt ein Wissensobjekt an, dessen Bericht auf Bs Bild zeigt. Die Fundstelle steht im
//      Fliesstext und trägt keinen Urheber; der Verfasser der Fassung ist A, nicht der Hochladende
//      B. Damit ist die Zuordnung „behauptet" — ein Dritter bekommt 404.
//   3. A entfernt das Bild in v2.
//   4. B holt v1 zurück. Die neue Fassung v3 trägt die Kennung wieder UND ist von B verfasst.
//      `zuordnungInFassung` misst Urheberschaft als DIFFERENZ ZUM UNMITTELBAREN VORGÄNGER: gegenüber
//      v2 ist die Kennung neu, also gilt B als Einbringer — und die Datei öffnet sich für Dritte.
//
// DIE REGEL IN `sichtbarkeit.ts` IST RICHTIG („Mitkopieren ist keine Urheberschaft"); sie kann den
// Sprung über v2 hinweg nur nicht sehen. Behoben wird das deshalb dort, wo man ihn SIEHT: im Dienst,
// der die Übernahme ausführt. Seine Zusage ist schärfer als die dortige Messung — nach einer
// Übernahme nennt der Bericht keine Objektkennung, die der aktuelle Stand nicht schon nennt. Damit
// ist die Vorgänger-Differenz für jede Übernahme leer, und der Fall kann gar nicht mehr entstehen.
//
// GEMESSEN WIRD AM ECHTEN DRAHT: echter Upload, echte Anlage, echte Überarbeitung, echter Abruf der
// Rohbytes durch einen Dritten. Kein Prädikat wird direkt gerufen — sonst hinge der Nachweis an der
// Frage, ob die Route dieses Prädikat überhaupt benutzt.
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

/** Drei Menschen: A schreibt, B lädt das Bild hoch, C ist der Dritte, der es NICHT sehen darf. */
async function dreiMenschen(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `admin@${marke}.test`, "geheim12345");
  for (const [email, role] of [
    [`a@${marke}.test`, "experte"],
    [`b@${marke}.test`, "experte"],
    [`c@${marke}.test`, "viewer"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    expect(res.statusCode, res.body).toBe(201);
  }
  return {
    app,
    a: await login(app, `a@${marke}.test`, "geheim12345"),
    b: await login(app, `b@${marke}.test`, "geheim12345"),
    c: await login(app, `c@${marke}.test`, "geheim12345"),
  };
}

/** Ein Bild hochladen — OHNE eigene Stufe, so wie jeder normale Anhang-Upload es tut. */
async function bildHochladen(app: App, wer: Auth): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: wer,
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

const anlegen = async (app: App, wer: Auth, bodyHtml: string): Promise<string> => {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer,
    payload: {
      confidentiality: "intern",
      title: "Reinigung Spritzzone",
      statement: "Nur trocken abkehren.",
      type: "technik",
      category: "Produktion",
      bodyHtml,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
};

const ueberarbeiten = (app: App, wer: Auth, id: string, bodyHtml: string) =>
  app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: wer,
    payload: { action: "revise", changes: { bodyHtml } },
  });

const uebernehmen = (app: App, wer: Auth, id: string, version: number) =>
  app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: wer,
    payload: { action: "revise", changes: { restoredFromVersion: version } },
  });

const rohbytes = (app: App, wer: Auth, objectId: string) =>
  app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers: wer });

const version = async (app: App, wer: Auth, id: string): Promise<number> => {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().version as number;
};

/**
 * DIE KETTE, um die es geht — EINMAL geschrieben und über die FUNDSTELLENFORM parametrisiert.
 *
 * RUNDE 5 · WARUM DIE FORM EIN PARAMETER IST: Runde 4 prüfte nur die URL-Form, und BEN hat mit
 * derselben Kette und einer bloss als Text geschriebenen Kennung 200 statt 404 gemessen
 * (`BEN Klartextkennung {"uebernahme":200,"rohbytesDanach":200}`). Der Fehler lag nicht in der
 * Kette, sondern darin, dass sie nur EINE Form kannte. Zwei abgeschriebene Ketten nebeneinander
 * wären derselbe Fehler noch einmal — die nächste Form fehlte dann wieder in einer von beiden.
 *
 * DIE FORMEN SIND BEIDE AUTORISIERUNGSWIRKSAM, und das ist gemessen, nicht angenommen:
 * `sichtbarkeit.ts` fragt `bodyHtml.includes(objectId)` — der Kennung ist es gleich, wie sie
 * dasteht.
 */
async function benKette(marke: string, fundstelle: (bild: string) => string): Promise<void> {
  const { app, a, b, c } = await dreiMenschen(marke);
  const bild = await bildHochladen(app, b);
  const id = await anlegen(app, a, fundstelle(bild));

  // VORBEDINGUNG, gemessen und nicht angenommen: der Dritte kommt nicht an die Bytes.
  expect(
    (await rohbytes(app, c, bild)).statusCode,
    "Vorbedingung verletzt: die Datei ist schon vor der Übernahme offen",
  ).toBe(404);

  expect((await ueberarbeiten(app, a, id, "<p>Ohne Bild.</p>")).statusCode).toBe(200);
  expect(await version(app, a, id)).toBe(2);
  expect(
    (await rohbytes(app, c, bild)).statusCode,
    "Vorbedingung verletzt: nach dem Entfernen ist die Datei offen",
  ).toBe(404);

  // DER GRIFF, um den es geht.
  const res = await uebernehmen(app, b, id, 1);
  expect(
    res.statusCode,
    `die Übernahme wurde angenommen und hätte die Datei geöffnet: ${res.body}`,
  ).toBe(400);
  // Der Grund nennt die Datei, die im Weg steht — sonst wüsste niemand, was zu tun ist.
  expect(String(res.json().message)).toContain(bild);

  expect(await version(app, a, id), "trotz Abweisung ist eine Fassung entstanden").toBe(2);
  expect(
    (await rohbytes(app, c, bild)).statusCode,
    "nach der Übernahme bekommt der Dritte die Rohbytes",
  ).toBe(404);
}

describe("JOB 4213 · A — BENs Kette: v1 nennt das Bild, v2 nicht, B holt v1 zurück", () => {
  it("URL-Form (`<img src=…/raw>`): abgewiesen, die Datei bleibt zu", async () => {
    await benKette("wn-anh1", (bild) => `<p>Typenschild: <img src="/api/objects/${bild}/raw"></p>`);
  });

  it("KLARTEXT-Form (nur die Kennung im Bericht): ebenso — BENs Gegenprobe an Runde 4", async () => {
    await benKette("wn-anh1b", (bild) => `<p>Dateikennung: ${bild}</p>`);
  });

  it("was der Zeichenweg WEGWIRFT, kann auch nichts autorisieren — gemessen, nicht angenommen", async () => {
    // GEMESSEN AN RUNDE 5: derselbe Fall war zuerst als „muss abgewiesen werden" gestellt und wurde
    // rot — der gespeicherte Bericht lautete `<p>Siehe Anlagenakte.</p>`. Der Sanitisierer entfernt
    // ein unbekanntes Attribut, die Kennung erreicht die Persistenz also NIE. `sichtbarkeit.ts` liest
    // den GESPEICHERTEN Bericht; was dort nicht steht, kann keine Zuordnung nachweisen.
    //
    // DER FALL BLEIBT DESHALB STEHEN, aber als das, was er wirklich zeigt: die Grenze des Schutzes
    // liegt an der Grenze der Persistenz, nicht früher. Er ist zugleich die Kalibrierung dazu — wäre
    // die Kennung doch gespeichert worden, müsste die Übernahme abgewiesen werden, und dann wäre
    // hier 400 statt 200 zu lesen.
    const { app, a, b, c } = await dreiMenschen("wn-anh1c");
    const bild = await bildHochladen(app, b);
    const id = await anlegen(app, a, `<p data-quelle="${bild}">Siehe Anlagenakte.</p>`);

    const gespeichert = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: a });
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);
    expect(
      String(gespeichert.json().bodyHtml),
      "Vorbedingung dieses Falls: der Zeichenweg hat das Attribut NICHT entfernt — dann ist er falsch gestellt",
    ).not.toContain(bild);

    expect((await ueberarbeiten(app, a, id, "<p>Ohne alles.</p>")).statusCode).toBe(200);
    const res = await uebernehmen(app, b, id, 1);
    expect(
      res.statusCode,
      `die Übernahme eines kennungsfreien Berichts wurde abgewiesen: ${res.body}`,
    ).toBe(200);
    expect(
      (await rohbytes(app, c, bild)).statusCode,
      "die Datei ist offen, obwohl ihre Kennung nie gespeichert wurde",
    ).toBe(404);
  });
});

describe("JOB 4213 · B — KALIBRIERUNG: der legitime Weg bleibt offen", () => {
  // OHNE DIESE FÄLLE prüfte A nur, dass irgendetwas abgewiesen wird — und die schärfere
  // Kennungssuche aus Runde 5 könnte den Weg unbemerkt ganz zugemacht haben. Hier steht die Kennung
  // in v1 UND in v2: es gibt nichts wiederzubeleben, und die Übernahme MUSS laufen. Wieder in
  // BEIDEN Formen, damit die Weitung nicht an der Klartextform überschiesst.
  for (const [marke, form, name] of [
    ["wn-anh2", (b: string) => `<img src="/api/objects/${b}/raw">`, "URL-Form"],
    ["wn-anh2b", (b: string) => `Dateikennung ${b}`, "KLARTEXT-Form"],
  ] as const) {
    it(`${name}: nennt der AKTUELLE Stand die Datei noch, geht die Übernahme durch`, async () => {
      const { app, a, b, c } = await dreiMenschen(marke);
      const bild = await bildHochladen(app, b);
      const ref = form(bild);
      const id = await anlegen(app, a, `<p>Erst so: ${ref}</p>`);
      expect((await ueberarbeiten(app, a, id, `<p>Dann anders: ${ref}</p>`)).statusCode).toBe(200);

      const res = await uebernehmen(app, b, id, 1);
      expect(res.statusCode, `die legitime Übernahme wurde abgewiesen: ${res.body}`).toBe(200);
      expect(await version(app, a, id)).toBe(3);
      // Und sie hat die Sichtbarkeit NICHT verändert: die Fundstelle war schon im Vorgänger da.
      expect(
        (await rohbytes(app, c, bild)).statusCode,
        "die legitime Übernahme hat die Datei geöffnet",
      ).toBe(404);
    });
  }

  it("ein Bericht OHNE jede Kennung lässt sich unverändert zurückholen", async () => {
    // Die Weitung auf das UUID-Muster darf nicht dazu führen, dass gewöhnliche Berichte hängen
    // bleiben. Der häufigste Fall überhaupt — kein Bild, keine Datei — muss glatt durchgehen.
    const { app, a, b } = await dreiMenschen("wn-anh2c");
    const id = await anlegen(app, a, "<p>Nur Text, keine Datei.</p>");
    expect((await ueberarbeiten(app, a, id, "<p>Anderer Text.</p>")).statusCode).toBe(200);
    const res = await uebernehmen(app, b, id, 1);
    expect(res.statusCode, `eine Übernahme ohne jede Kennung wurde abgewiesen: ${res.body}`).toBe(
      200,
    );
    expect(await version(app, a, id)).toBe(3);
  });

  it("ein Bild, das der Hochladende selbst eingebracht hat, bleibt für Dritte sichtbar", async () => {
    // Die zweite Hälfte von BENs Auflage: „während legitime Bildfreigaben weiterhin funktionieren".
    // B schreibt sein eigenes Bild in sein eigenes Objekt — das IST der Nachweis, und er darf durch
    // eine Übernahme weder entstehen noch verschwinden.
    const { app, b, c } = await dreiMenschen("wn-anh3");
    const bild = await bildHochladen(app, b);
    const ref = `<img src="/api/objects/${bild}/raw">`;
    const id = await anlegen(app, b, `<p>Mein Bild: ${ref}</p>`);
    expect(
      (await rohbytes(app, c, bild)).statusCode,
      "Vorbedingung: das selbst eingebrachte Bild ist sichtbar",
    ).toBe(200);

    expect((await ueberarbeiten(app, b, id, `<p>Immer noch: ${ref}</p>`)).statusCode).toBe(200);
    expect((await uebernehmen(app, b, id, 1)).statusCode).toBe(200);
    expect(
      (await rohbytes(app, c, bild)).statusCode,
      "die Übernahme hat eine legitime Bildfreigabe zerstört",
    ).toBe(200);
  });
});
