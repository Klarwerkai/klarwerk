// ==================================================================================================
// AUFNAHME gesamt-entwurf-einreichen · Entscheidung Pedi `debbb8e8` — EIN ENTWURF IST PRIVAT.
// ==================================================================================================
//
// „Entwürfe sind standardmäßig privat, liegen also serverseitig, sind nur für den Autor sichtbar und
// auf allen seinen Geräten fortsetzbar." Bis Lauf :3 Runde 1 bekam ein Administrator jeden fremden
// lebenden Entwurf samt Inhalt über `GET /api/drafts` und `GET /api/drafts/:id` (Ben B1, unabhängig
// reproduziert). Die Regel steht an EINER Stelle (`canSeeDraft`, capture-routes.ts); dieser Test
// misst sie an jedem Entwurfsweg von aussen, mit drei echten Konten am echten Server:
//
//   · Anna (Expertin) legt den Entwurf an — sie sieht ihn auf zwei „Geräten" (zwei Anmeldungen).
//   · Ada (Administratorin) sieht ihn nirgends: nicht in der Liste, nicht einzeln, nicht im
//     Papierkorb, und sie kann ihn weder ändern, noch löschen, noch einreichen.
//   · Otto (Experte) ebenso.
//
// Gegenprobe: mit `canSeeDraft` aus Runde 1 (`user.role === "admin" || …`) sind alle Admin-Fälle rot.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type Services = ReturnType<typeof buildServices>;

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

type App = ReturnType<typeof buildApp>;

async function anmelden(app: App, email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(res.statusCode).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const services: Services = buildServices();
  const app = buildApp(services);
  // Die erste Registrierung ist die Administratorin.
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada", email: "ada@x.de", password: "secret123" },
  });
  const ada = await anmelden(app, "ada@x.de");
  for (const [name, email] of [
    ["Anna", "anna@x.de"],
    ["Otto", "otto@x.de"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: ada,
      payload: { name, email, password: "secret123", role: "experte" },
    });
    expect(res.statusCode).toBeLessThan(300);
  }
  // Zwei Anmeldungen derselben Autorin: das Telefon an der Anlage und der Rechner im Büro.
  const annaTelefon = await anmelden(app, "anna@x.de");
  const annaRechner = await anmelden(app, "anna@x.de");
  const otto = await anmelden(app, "otto@x.de");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: annaTelefon,
    payload: {
      title: "Annas Entwurf",
      statement: "Nur ein Zwischenstand.",
      bodyHtml: "<p>Vertraulicher Zwischenstand an Linie 4.</p>",
    },
  });
  expect(angelegt.statusCode).toBeLessThan(300);
  return {
    app,
    services,
    ada,
    annaTelefon,
    annaRechner,
    otto,
    id: angelegt.json().id as string,
  };
}

async function inListe(app: App, headers: Record<string, string>, url: string, id: string) {
  const res = await app.inject({ method: "GET", url, headers });
  expect(res.statusCode).toBe(200);
  return (res.json() as { id: string }[]).some((d) => d.id === id);
}

describe("debbb8e8 · ein Entwurf ist privat — nur seine Autorin sieht ihn, auf allen ihren Geräten", () => {
  it("Liste: die Autorin sieht ihn auf beiden Geräten, Administratorin und Kollege nicht", async () => {
    const b = await buehne();
    expect({
      annaTelefon: await inListe(b.app, b.annaTelefon, "/api/drafts", b.id),
      annaRechner: await inListe(b.app, b.annaRechner, "/api/drafts", b.id),
      admin: await inListe(b.app, b.ada, "/api/drafts", b.id),
      kollege: await inListe(b.app, b.otto, "/api/drafts", b.id),
    }).toEqual({ annaTelefon: true, annaRechner: true, admin: false, kollege: false });
  });

  it("Einzelabruf: die Autorin bekommt den Inhalt am anderen Gerät, die Administratorin 403 ohne Inhalt", async () => {
    const b = await buehne();
    const eigen = await b.app.inject({
      method: "GET",
      url: `/api/drafts/${b.id}`,
      headers: b.annaRechner,
    });
    expect(eigen.statusCode).toBe(200);
    expect(eigen.json().payload.bodyHtml).toContain("Linie 4");

    for (const headers of [b.ada, b.otto]) {
      const fremd = await b.app.inject({ method: "GET", url: `/api/drafts/${b.id}`, headers });
      expect(fremd.statusCode).toBe(403);
      expect(fremd.body).not.toContain("Linie 4");
      expect(fremd.body).not.toContain("Annas Entwurf");
    }
  });

  it("Ändern, Löschen und Einreichen eines fremden Entwurfs sind auch der Administratorin verwehrt", async () => {
    const b = await buehne();
    const aendern = await b.app.inject({
      method: "PUT",
      url: `/api/drafts/${b.id}`,
      headers: b.ada,
      payload: { title: "Übernommen" },
    });
    const loeschen = await b.app.inject({
      method: "DELETE",
      url: `/api/drafts/${b.id}`,
      headers: b.ada,
    });
    const einreichen = await b.app.inject({
      method: "POST",
      url: `/api/drafts/${b.id}/promote`,
      headers: b.ada,
      payload: { operationId: "fremd-einreichen-0001" },
    });
    expect([aendern.statusCode, loeschen.statusCode, einreichen.statusCode]).toEqual([
      403, 403, 403,
    ]);
    // Der Entwurf steht unverändert bei seiner Autorin.
    const danach = await b.app.inject({
      method: "GET",
      url: `/api/drafts/${b.id}`,
      headers: b.annaTelefon,
    });
    expect(danach.statusCode).toBe(200);
    expect(danach.json().payload.title).toBe("Annas Entwurf");
  });

  it("Papierkorb: ein gelöschter Entwurf bleibt privat — die Administratorin sieht ihn dort auch nicht", async () => {
    const b = await buehne();
    const geloescht = await b.app.inject({
      method: "DELETE",
      url: `/api/drafts/${b.id}`,
      headers: b.annaTelefon,
    });
    expect(geloescht.statusCode).toBeLessThan(300);
    expect({
      autorin: await inListe(b.app, b.annaRechner, "/api/drafts/trash", b.id),
      admin: await inListe(b.app, b.ada, "/api/drafts/trash", b.id),
    }).toEqual({ autorin: true, admin: false });
    const wiederherstellen = await b.app.inject({
      method: "POST",
      url: `/api/drafts/${b.id}/restore`,
      headers: b.ada,
    });
    expect(wiederherstellen.statusCode).toBe(404);
  });

  it("herrenloser Altbestand (ohne `originalAuthor`) ist niemandes privater Entwurf — nur die Verwaltung erreicht ihn", async () => {
    // Ohne diese Ausnahme käme an einen Entwurf aus der Zeit vor WP-RETEST7 niemand mehr heran —
    // nicht zum Fortsetzen, nicht zum Einreichen, nicht zum Löschen (tests/app/ko-author-paths).
    const b = await buehne();
    const alt = await b.services.capture.createDraft(
      { title: "Alt-Entwurf", statement: "Aus dem Altbestand." },
      "",
    );
    expect({
      admin: await inListe(b.app, b.ada, "/api/drafts", alt.id),
      expertin: await inListe(b.app, b.annaTelefon, "/api/drafts", alt.id),
    }).toEqual({ admin: true, expertin: false });
  });

  // ================================================================================================
  // Lauf :3 Runde 3 · Ben B1-R — DIE INHALTE EINES PRIVATEN ENTWURFS: DER ANHANG-LESEWEG.
  // ================================================================================================
  //
  // Bens Gegenprobe: ein Bild, das die Autorin hochlädt und nur in ihrem Entwurf trägt; der Entwurf
  // nennt die Administratorin als frühere Bearbeiterin (`lastEditor`, historische Weitergabe). Die
  // Entwurfsroute gab ihr 403 — `GET /api/objects/:id/raw` gab ihr 200 mit den Bytes, weil die
  // Anhangregel `lastEditor` als Leserecht zählte. Jetzt entscheidet an beiden Wegen dieselbe
  // Funktion (`entwurfSichtbarFuer`, services/app/src/sichtbarkeit.ts).
  // Gegenprobe: mit `sichtbar: entwurfGehoert(entwurf, user.id)` (Stand Runde 2) ist der Fall rot
  // („expected 200 to be 404").
  it("Anhang eines privaten Entwurfs: die Autorin bekommt die Bytes, eine frühere Bearbeiterin (Admin) nicht", async () => {
    const b = await buehne();
    const adaId = await (async () => {
      const res = await b.app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "ada@x.de", password: "secret123" },
      });
      return res.json().user.id as string;
    })();
    const hochgeladen = await b.app.inject({
      method: "POST",
      url: "/api/objects",
      headers: b.annaTelefon,
      payload: {
        name: "typenschild.png",
        mime: "image/png",
        data: PNG_DATA_URL,
        kind: "image",
        purpose: "attachment",
      },
    });
    expect(hochgeladen.statusCode, hochgeladen.body).toBe(201);
    const objectId = hochgeladen.json().id as string;
    const entwurf = await b.app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: b.annaTelefon,
      payload: {
        title: "Annas Entwurf mit Bild",
        bodyHtml: `<p><img src="/api/objects/${objectId}/raw"></p>`,
      },
    });
    expect(entwurf.statusCode).toBeLessThan(300);
    const draftId = entwurf.json().id as string;
    // Die historische Weitergabe: die Administratorin steht als letzte Bearbeiterin am Entwurf.
    await b.services.capture.continueDraft(draftId, {}, adaId);
    expect((await b.services.capture.getDraft(draftId))?.lastEditor).toBe(adaId);

    const roh = (headers: Record<string, string>) =>
      b.app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers });
    const alsAutorin = await roh(b.annaRechner);
    const alsAdmin = await roh(b.ada);
    const alsKollege = await roh(b.otto);
    const entwurfAlsAdmin = await b.app.inject({
      method: "GET",
      url: `/api/drafts/${draftId}`,
      headers: b.ada,
    });

    expect({
      autorin: alsAutorin.statusCode,
      admin: alsAdmin.statusCode,
      kollege: alsKollege.statusCode,
      entwurfAlsAdmin: entwurfAlsAdmin.statusCode,
    }).toEqual({ autorin: 200, admin: 404, kollege: 404, entwurfAlsAdmin: 403 });
    expect(alsAdmin.rawPayload.length).toBeLessThan(alsAutorin.rawPayload.length);
  });
});
