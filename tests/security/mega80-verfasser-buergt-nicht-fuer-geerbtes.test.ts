// ================================================================================================
// AUFTRAG-mega80 BLOCK B — EIN VERFASSER BÜRGT NICHT FÜR DAS, WAS ER NUR MITKOPIERT HAT.
// ================================================================================================
//
// DER BEFUND (bens Fund). `zuordnungInFassung` (sichtbarkeit.ts) erklärte JEDE im Schnappschuss
// vorhandene Fundstelle für `nachgewiesen`, sobald `KoVersionSnapshot.author` der Hochladende ist.
// Die Annahme dahinter — „wer die Fassung schrieb, schrieb jede darin enthaltene Zuordnung" — ist
// bei einer VOLL-Schnappschuss-Revision falsch: `KoService.revise` übernimmt bei einer Teilrevision
// alle nicht geänderten Felder (knowledge-object/src/service.ts:1824-1856), und der danach
// geschriebene Voll-Schnappschuss bekommt den AKTUELLEN Revisionsautor (service.ts:447-459).
//
// DER WEG, den mega78 NICHT gemessen hat. Der dortige WEG-5-Test
// (tests/security/mega78-traeger-nachweis.test.ts:243-271) endet nach der Revision des ANGREIFERS.
// Genau EINEN Schritt später kippt die Entscheidung: revidiert danach der HOCHLADENDE sein eigenes
// Objekt an einem ganz anderen Feld, wandert die fremde Fundstelle unverändert in den neuen
// Schnappschuss — und der trägt jetzt den Hochladenden als Verfasser.
//
// DIE ZWEI-REVISIONEN-KETTE, die dieser Test bis zum Ende fährt:
//
//   1. A lädt ein Bild hoch und hängt es an SEIN vertrauliches Wissensobjekt. B bekommt 404.
//   2. B schreibt A's Kennung in den Fließtext eines EIGENEN, internen Wissensobjekts.
//      Das bleibt korrekt nur `behauptet` — B bekommt weiter 404 (das ist mega78 WEG 1).
//   3. A REVIDIERT B's Objekt an einem ganz anderen Feld (dem Titel). A darf das: das Objekt ist
//      intern, also lässt das Tor aus Block A ihn durch, und `ko.create` hat jeder Experte.
//      Der neue Schnappschuss trägt A als Verfasser und den geerbten Fließtext.
//   4. A HÄNGT DAS BILD AN SEINEM EIGENEN OBJEKT AB. Ohne diesen Schritt entscheidet die BILLIGE
//      Stufe (ein aktueller Träger mit nachgewiesener Zuordnung), und der Fassungs-Zweig läuft gar
//      nicht erst. Erst jetzt trägt die TEURE Stufe die Entscheidung wirklich.
//   5. B holt die Rohbytes.
//
// VOR mega80 endet Schritt 5 mit 200 und den Bytes. NACH mega80 mit 404.
//
// ------------------------------------------------------------------------------------------------
// DIE GEGENPROBE, ohne die die 404 nur „die Route gibt nichts mehr heraus" hieße.
// ------------------------------------------------------------------------------------------------
//
// Der Alltagsweg „ich schreibe mein eigenes Bild in meinen eigenen Text" MUSS weiter tragen, und
// zwar auch für Dritte. Er hängt an genau diesem Zweig: ein Bild, das NUR im Fließtext steht, hat
// keinen `attachments`-Eintrag und damit keinen anderen Nachweis (so legt
// services/app/src/example-packages.ts:320-334 seine Bilder an). Zwei Fälle unten:
//   - A bringt sein Bild in v1 seines internen Objekts ein → ein Dritter sieht es.
//   - A revidiert dieses Objekt danach an einem anderen Feld → der Dritte sieht es WEITER.
// Der zweite Fall ist die eigentliche Probe auf die neue Regel: die Fundstelle ist in v2 geerbt,
// aber v1 hat sie NEU EINGEBRACHT — und dieser Nachweis bleibt gültig.
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
    [`opfer@${marke}.test`, "experte"],
    [`angreifer@${marke}.test`, "experte"],
    [`dritter@${marke}.test`, "viewer"],
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
    opfer: await login(app, `opfer@${marke}.test`, "geheim12345"),
    angreifer: await login(app, `angreifer@${marke}.test`, "geheim12345"),
    dritter: await login(app, `dritter@${marke}.test`, "geheim12345"),
  };
}

async function upload(app: App, wer: Auth): Promise<string> {
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

async function rohbytes(app: App, wer: Auth, objectId: string) {
  return app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers: wer });
}

async function legeKoAn(app: App, wer: Auth, titel: string, bodyHtml?: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer,
    payload: {
      title: titel,
      statement: "Inhalt für mega80 B.",
      type: "best_practice",
      category: "Anlage 1",
      ...(bodyHtml ? { bodyHtml } : {}),
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function revidiere(app: App, wer: Auth, koId: string, titel: string) {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: wer,
    payload: { action: "revise", changes: { title: titel } },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res;
}

describe("mega80 B · ein Voll-Schnappschuss hebt nichts mehr an", () => {
  it("ZWEI-REVISIONEN-KETTE — die geerbte Fundstelle öffnet die Rohbytes NICHT", async () => {
    const { app, opfer, angreifer } = await setup("mega80b1");

    // 1. A lädt hoch und hängt an SEIN vertrauliches Objekt.
    const objectId = await upload(app, opfer);
    const koA = await legeKoAn(app, opfer, "Vertrauliches Trägerobjekt");
    const attach = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers: opfer,
      payload: {
        action: "attach",
        attachment: { name: "typenschild.png", mime: "image/png", objectId },
      },
    });
    expect(attach.statusCode, attach.body).toBe(200);
    const attachmentId = attach.json().attachments.at(-1).id as string;
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers: opfer,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);

    const vorbedingung = await rohbytes(app, angreifer, objectId);
    expect(
      vorbedingung.statusCode,
      `VORBEDINGUNG: ohne eigenen Träger bekommt der Angreifer nichts. ${vorbedingung.statusCode}`,
    ).toBe(404);

    // 2. B schreibt die fremde Kennung in ein EIGENES, internes Objekt (mega78 WEG 1).
    const koB = await legeKoAn(
      app,
      angreifer,
      "Mein eigenes Objekt",
      `<p>Siehe <img src="/api/objects/${objectId}/raw" alt="" /></p>`,
    );
    const nachWeg1 = await rohbytes(app, angreifer, objectId);
    expect(
      nachWeg1.statusCode,
      `ZWISCHENSTAND: die blosse Behauptung öffnet nichts (mega78 WEG 1). ${nachWeg1.statusCode}`,
    ).toBe(404);

    // 3. A revidiert B's Objekt an einem GANZ ANDEREN Feld. Der neue Voll-Schnappschuss trägt A
    //    als Verfasser und erbt den Fließtext mit der Kennung unverändert.
    await revidiere(app, opfer, koB, "Vom Hochladenden umbenannt");

    // 4. A hängt das Bild an seinem eigenen Objekt AB — erst jetzt trägt die TEURE Stufe.
    const detach = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers: opfer,
      payload: { action: "detach", attachmentId },
    });
    expect(detach.statusCode, detach.body).toBe(200);

    // 5. Das Ende der Kette.
    const ende = await rohbytes(app, angreifer, objectId);
    expect(
      ende.statusCode,
      `DIE KETTE MUSS AUF 404 ENDEN. Ein Voll-Schnappschuss, der eine FREMD eingebrachte
      Fundstelle nur mitkopiert hat, ist kein Urheber-Nachweis. Antwort: ${ende.statusCode}`,
    ).toBe(404);
  });

  it("dasselbe über den ANHANG — ein fremd gesetzter KoAttachment.author wird nicht angehoben", async () => {
    const { app, opfer, angreifer } = await setup("mega80b2");

    const objectId = await upload(app, opfer);
    const koA = await legeKoAn(app, opfer, "Vertrauliches Trägerobjekt");
    const attach = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers: opfer,
      payload: {
        action: "attach",
        attachment: { name: "typenschild.png", mime: "image/png", objectId },
      },
    });
    expect(attach.statusCode, attach.body).toBe(200);
    const attachmentId = attach.json().attachments.at(-1).id as string;
    await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers: opfer,
      payload: { action: "confidentiality", level: "vertraulich" },
    });

    // B hängt dasselbe Objekt an sein EIGENES internes Objekt. `KoAttachment.author` = B, also
    // korrekt nur eine Behauptung (mega78 WEG 2).
    const koB = await legeKoAn(app, angreifer, "Mein eigenes Objekt");
    const fremdAttach = await app.inject({
      method: "PUT",
      url: `/api/kos/${koB}`,
      headers: angreifer,
      payload: {
        action: "attach",
        attachment: { name: "typenschild.png", mime: "image/png", objectId },
      },
    });
    expect(fremdAttach.statusCode, fremdAttach.body).toBe(200);
    expect((await rohbytes(app, angreifer, objectId)).statusCode).toBe(404);

    // A revidiert B's Objekt — der Voll-Schnappschuss erbt den fremden Anhang und trägt A.
    await revidiere(app, opfer, koB, "Vom Hochladenden umbenannt");
    await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers: opfer,
      payload: { action: "detach", attachmentId },
    });

    const ende = await rohbytes(app, angreifer, objectId);
    expect(
      ende.statusCode,
      `Auch der strukturierte Anhang darf durch einen geerbten Schnappschuss nicht
      angehoben werden. Antwort: ${ende.statusCode}`,
    ).toBe(404);
  });

  // ----------------------------------------------------------------------------------------------
  // GEGENPROBE 1 — der Alltagsweg beim EINBRINGEN.
  // ----------------------------------------------------------------------------------------------
  it("GEGENPROBE — das selbst eingebrachte Bild im eigenen Fließtext bleibt für Dritte sichtbar", async () => {
    const { app, opfer, dritter } = await setup("mega80b3");
    const objectId = await upload(app, opfer);
    // NUR im Fließtext, kein `attachments`-Eintrag — genau die Form aus example-packages.ts:320-334.
    await legeKoAn(
      app,
      opfer,
      "Mein internes Objekt",
      `<p><img src="/api/objects/${objectId}/raw" alt="" /></p>`,
    );

    const res = await rohbytes(app, dritter, objectId);
    expect(
      res.statusCode,
      `Der Hochladende hat diese Zuordnung in v1 SELBST eingebracht. Bräche das, wäre der
      Schutz nur die Abschaltung des Bildwegs. Antwort: ${res.statusCode}`,
    ).toBe(200);
  });

  // ----------------------------------------------------------------------------------------------
  // GEGENPROBE 2 — DIE EIGENTLICHE PROBE AUF DIE NEUE REGEL.
  // Die Fundstelle ist in v2 GEERBT, aber v1 hat sie NEU EINGEBRACHT. Dieser Nachweis bleibt.
  // Ohne diesen Fall könnte man die Lücke schliessen, indem man den Zweig einfach abschaltet.
  // ----------------------------------------------------------------------------------------------
  it("GEGENPROBE — der Nachweis aus v1 überlebt eine spätere Revision an einem anderen Feld", async () => {
    const { app, opfer, dritter } = await setup("mega80b4");
    const objectId = await upload(app, opfer);
    const koId = await legeKoAn(
      app,
      opfer,
      "Mein internes Objekt",
      `<p><img src="/api/objects/${objectId}/raw" alt="" /></p>`,
    );

    await revidiere(app, opfer, koId, "Titel später geändert");
    await revidiere(app, opfer, koId, "Und noch einmal geändert");

    const res = await rohbytes(app, dritter, objectId);
    expect(
      res.statusCode,
      `v1 hat die Zuordnung NEU eingebracht; v2/v3 haben sie nur geerbt. Der Nachweis aus v1
      bleibt gültig — sonst verlöre jedes revidierte Objekt seine eigenen Bilder.
      Antwort: ${res.statusCode}`,
    ).toBe(200);
  });
});
