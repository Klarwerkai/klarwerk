// ==================================================================================================
// JOB 3668 — DIE DREI ADRESSEN DES PAPIERKORBS, UND DASS ER KEIN SCHLUPFLOCH IST.
// ==================================================================================================
//
// HIER LÄUFT KEINE ATTRAPPE, sondern die ECHTE App (`buildApp(buildServices())`) mit echtem
// Entwurfsdienst, echter Anmeldung und echten Berechtigungen. Der Auftrag verlangt in §4.5 und
// §6(d) ausdrücklich einen SERVERSEITIGEN Nachweis, dass ein fremder Entwurf im Papierkorb nicht
// sichtbar ist — „nicht in der Oberfläche versteckt".
//
// DIE ADRESSEN SIND WÖRTLICH DIE DES WISSENSOBJEKTS (`ko-routes.ts:1717/1729/1741`):
//   GET    /api/drafts/trash       — was liegt im Papierkorb
//   POST   /api/drafts/:id/restore — zurückholen
//   DELETE /api/drafts/trash/:id   — endgültig, der zweite Griff
//
// DIE EINE ABWEICHUNG, geprüft in Fall R4: Der KO-Papierkorb ist ADMIN-Werkzeug (`users.manage`).
// Dieser hier ist die Rückholmöglichkeit des Autors für SEINE Entwürfe — Pedis Versprechen lautet
// „wer löscht, kann zurückholen", nicht „wer löscht, bittet einen Admin". Geprüft wird deshalb
// beides: dass der Autor seinen eigenen Entwurf zurückholen kann UND dass er den fremden weder
// sieht noch anfassen kann.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

const INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
  confidentiality: "intern",
  bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
};

async function anmelden(app: App, email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(res.statusCode).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

/**
 * Die Vorrichtung legt ihre Konten SELBST an (kein Demo-Seed) — dasselbe Muster wie
 * `tests/security/mega74-lesepfad-vertraulich.test.ts`: der erste registrierte Nutzer wird Admin,
 * danach legt der Admin die zwei Erfasser direkt an (sofort freigegeben).
 */
async function buehne() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Adam", email: "adam@x.de", password: "secret123" },
  });
  const admin = await anmelden(app, "adam@x.de");
  for (const [name, email] of [
    ["Anna", "anna@x.de"],
    ["Bodo", "bodo@x.de"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: "secret123", role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    admin,
    anna: await anmelden(app, "anna@x.de"),
    bodo: await anmelden(app, "bodo@x.de"),
  };
}

async function entwurfAnlegen(app: App, headers: Record<string, string>, titel: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers,
    payload: { ...INHALT, title: titel },
  });
  expect(res.statusCode).toBeLessThan(300);
  return res.json().id as string;
}

const ids = (res: { json: () => unknown }): string[] =>
  (res.json() as { id: string }[]).map((d) => d.id);

describe("JOB 3668 · R — der Papierkorb der Entwürfe an der echten Route", () => {
  it("R1 · Löschen → aus der Liste verschwunden, im Papierkorb sichtbar, mit Zeit und Urheber", async () => {
    const { app, anna } = await buehne();
    const id = await entwurfAnlegen(app, anna, "Zu löschen");

    expect(
      (await app.inject({ method: "DELETE", url: `/api/drafts/${id}`, headers: anna })).statusCode,
    ).toBe(204);

    expect(ids(await app.inject({ method: "GET", url: "/api/drafts", headers: anna }))).toEqual([]);

    const papierkorb = await app.inject({ method: "GET", url: "/api/drafts/trash", headers: anna });
    expect(papierkorb.statusCode).toBe(200);
    const zeilen = papierkorb.json() as { id: string; deletedAt: string; deletedBy: string }[];
    expect(zeilen.map((z) => z.id)).toEqual([id]);
    expect(Number.isNaN(Date.parse(zeilen[0]?.deletedAt ?? ""))).toBe(false);
    // Bis zu diesem Auftrag wusste niemand, WER gelöscht hat — die Route reicht es jetzt durch.
    expect(zeilen[0]?.deletedBy).toBeTruthy();
  });

  it("R2 · Wiederherstellen bringt den Entwurf VOLLSTÄNDIG zurück — nicht als Hülle", async () => {
    const { app, anna } = await buehne();
    const id = await entwurfAnlegen(app, anna, "Zurückzuholen");
    const vorher = (
      await app.inject({ method: "GET", url: `/api/drafts/${id}`, headers: anna })
    ).json();

    await app.inject({ method: "DELETE", url: `/api/drafts/${id}`, headers: anna });
    const zurueck = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/restore`,
      headers: anna,
    });

    expect(zurueck.statusCode).toBe(200);
    // Titel, Rumpf, Vertraulichkeit, Zeiten, Autor — alles, zeichengleich dem Stand vor dem Löschen.
    expect(zurueck.json()).toEqual(vorher);
    expect(ids(await app.inject({ method: "GET", url: "/api/drafts", headers: anna }))).toEqual([
      id,
    ]);
    expect(
      ids(await app.inject({ method: "GET", url: "/api/drafts/trash", headers: anna })),
    ).toEqual([]);
  });

  it("R3 · Endgültig löschen ist ein eigener, zweiter Griff — die Löschadresse kann es nicht", async () => {
    const { app, anna } = await buehne();
    const id = await entwurfAnlegen(app, anna, "Endgültig");

    // Der zweite Griff VOR dem ersten: es gibt nichts im Papierkorb, also 404 — und der lebende
    // Entwurf steht unberührt da.
    expect(
      (await app.inject({ method: "DELETE", url: `/api/drafts/trash/${id}`, headers: anna }))
        .statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: `/api/drafts/${id}`, headers: anna })).statusCode,
    ).toBe(200);

    await app.inject({ method: "DELETE", url: `/api/drafts/${id}`, headers: anna });
    expect(
      (await app.inject({ method: "DELETE", url: `/api/drafts/trash/${id}`, headers: anna }))
        .statusCode,
    ).toBe(204);

    // Und jetzt ist er wirklich weg: weder Liste noch Papierkorb noch Wiederherstellen.
    expect(
      ids(await app.inject({ method: "GET", url: "/api/drafts/trash", headers: anna })),
    ).toEqual([]);
    expect(
      (await app.inject({ method: "POST", url: `/api/drafts/${id}/restore`, headers: anna }))
        .statusCode,
    ).toBe(404);
  });

  it("R4 · DER PAPIERKORB IST KEIN SCHLUPFLOCH: Bodo sieht Annas gelöschten Entwurf nicht — serverseitig", async () => {
    const { app, anna, bodo, admin } = await buehne();
    const annas = await entwurfAnlegen(app, anna, "Annas Entwurf");
    await app.inject({ method: "DELETE", url: `/api/drafts/${annas}`, headers: anna });

    // Nicht in seiner Papierkorb-Liste …
    expect(
      ids(await app.inject({ method: "GET", url: "/api/drafts/trash", headers: bodo })),
    ).toEqual([]);
    // … und auch nicht über die Kennung. 404, NICHT 403 — und das ist der Punkt: vor diesem
    // Auftrag war die Kennung eines gelöschten Entwurfs schlicht nicht mehr auffindbar. Hielte der
    // Papierkorb sie mit einem 403 am Leben, hätte er eine Auskunft HINZUGEFÜGT (§4.5: „darf kein
    // Schlupfloch werden"). Dieselbe Richtung, in die mega80 die Wissensobjekte gebracht hat.
    expect(
      (await app.inject({ method: "POST", url: `/api/drafts/${annas}/restore`, headers: bodo }))
        .statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "DELETE", url: `/api/drafts/trash/${annas}`, headers: bodo }))
        .statusCode,
    ).toBe(404);

    // Annas Entwurf hat das alles unbeschadet überstanden — und sie selbst holt ihn zurück.
    expect(
      ids(await app.inject({ method: "GET", url: "/api/drafts/trash", headers: anna })),
    ).toEqual([annas]);
    expect(
      (await app.inject({ method: "POST", url: `/api/drafts/${annas}/restore`, headers: anna }))
        .statusCode,
    ).toBe(200);

    // DIE RECHTE BLEIBEN, WIE SIE SIND (§4.5): der Admin sieht im Papierkorb, was er auch sonst
    // sieht — alles. Der Papierkorb fügt keine Sichtbarkeit hinzu und nimmt keine weg.
    await app.inject({ method: "DELETE", url: `/api/drafts/${annas}`, headers: anna });
    expect(
      ids(await app.inject({ method: "GET", url: "/api/drafts/trash", headers: admin })),
    ).toEqual([annas]);
  });

  it("R5 · ein EINGEREICHTER Entwurf ist verbraucht, nicht gelöscht — er landet NICHT im Papierkorb", async () => {
    // Der Fall aus der Auftrags-Nachführung vom 12.09.: Läge ein übernommener Entwurf im
    // Papierkorb, liesse er sich wiederherstellen und stünde als Dublette neben dem
    // Wissensobjekt, das aus ihm geworden ist.
    const { app, anna } = await buehne();
    const id = await entwurfAnlegen(app, anna, "Wird eingereicht");

    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers: anna,
      payload: {},
    });
    expect(promote.statusCode).toBeLessThan(300);

    expect(ids(await app.inject({ method: "GET", url: "/api/drafts", headers: anna }))).toEqual([]);
    expect(
      ids(await app.inject({ method: "GET", url: "/api/drafts/trash", headers: anna })),
    ).toEqual([]);
    expect(
      (await app.inject({ method: "POST", url: `/api/drafts/${id}/restore`, headers: anna }))
        .statusCode,
    ).toBe(404);
  });

  it("R6 · `/api/drafts/trash` wird nicht von einem Entwurf mit der Kennung „trash“ verdeckt", async () => {
    // Fastify zieht das statische Segment dem Platzhalter vor. Geprüft, nicht angenommen: die
    // Liste antwortet mit einer Liste und nicht mit einem Entwurf.
    const { app, anna } = await buehne();
    await entwurfAnlegen(app, anna, "Irgendeiner");
    const res = await app.inject({ method: "GET", url: "/api/drafts/trash", headers: anna });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("R7 · ohne Anmeldung geht an keiner der drei Adressen etwas", async () => {
    const { app } = await buehne();
    for (const [method, url] of [
      ["GET", "/api/drafts/trash"],
      ["POST", "/api/drafts/d-1/restore"],
      ["DELETE", "/api/drafts/trash/d-1"],
    ] as const) {
      expect((await app.inject({ method, url })).statusCode).toBe(401);
    }
  });
});
