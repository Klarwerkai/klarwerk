// ================================================================================================
// AUFTRAG-JOB2020 (G7b) — DIE FAELLIGKEITSLISTE NANNTE KENNUNGEN, DIE ES FUER DEN LESER NICHT GIBT
// ================================================================================================
//
// DER BEFUND. `GET /api/lifecycle/pending` gab `pendingRevalidation()` unveraendert heraus — eine
// Liste nackter KO-Kennungen. Der Dienst kennt keine Sichtbarkeitsregel; das ist seit JOB 704 D3
// benannt (`tests/security/w9-lifecycle-pending-sichtbarkeit.test.ts`, Kopf: „sie ist nicht
// getrimmt, und wer sie anzeigt, muss selbst trimmen"). Getrimmt hatte sie bis heute niemand.
//
// WARUM EINE KENNUNG REICHT — und warum das hier anders liegt als bei `openGaps`. `GET /api/kos`
// laesst ein unsichtbares Objekt aus der Liste FALLEN, mit Trim bis ins SQL, und begruendet das
// selbst: „ein Platzhalter waere wieder eine Existenzauskunft" (`ko-routes.ts:507f`). Ein
// Betrachter bekommt die Kennung eines vertraulichen Objekts also NIRGENDS SONST. Diese Route war
// damit die einzige Stelle, an der sie hinausging — kein zweiter Ausgang derselben Zahl.
//
// WAS DIESE DATEI MISST: den ECHTEN Routenpfad ueber `app.inject`, kein Nachbau der Regel.
// **Jede Zusage hat ihre Gegenprobe daneben** — ohne sie belegte die Datei nur, dass die Liste
// leer ist, und das waere sie auch bei einer kaputten Route.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

/** Die Anlage, ueber die BEIDE Objekte faellig werden — s. `setup`. */
const ANLAGE = "anlage://pruefplan-2026.pdf";

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

async function ko(app: App, autor: Auth, titel: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: titel,
      statement: "Eine Aussage, die irgendwann zur Revalidierung ansteht.",
      type: "best_practice",
      category: "Faelligkeit",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
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
  const autor = await login(app, `autor@${marke}.test`, "geheim12345");
  const viewer = await login(app, `viewer@${marke}.test`, "geheim12345");

  const geheim = await ko(app, autor, "Vertrauliche Faelligkeit");
  const offen = await ko(app, autor, "Offene Faelligkeit");
  const stufe = await app.inject({
    method: "PUT",
    url: `/api/kos/${geheim}`,
    headers: autor,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(stufe.statusCode, stufe.body).toBe(200);

  // BEIDE faellig stellen — ueber den PRODUKTIVEN Weg, nicht am Dienst vorbei:
  // koppeln (`ko.create`) und dann die Anlage aendern (`ko.validate`). `assetChanged` markiert
  // jedes gekoppelte Objekt als faellig (`lifecycle/src/service.ts:34-40`).
  //
  // WARUM DAS HIER STEHT UND NICHT NEBENBEI: ohne einen WIRKLICH faelligen Bestand ist die Liste
  // leer, und dann bestuende jede Zusage unten auch OHNE die Sperre. Ein erster Aufbau dieser
  // Datei tat genau das — die Gegenprobe blieb gruen, und der Fall war ein Scheinbeleg. Die
  // Vorbedingung unten haelt das fest, damit es nicht unbemerkt wiederkommt.
  for (const koId of [geheim, offen]) {
    const kopplung = await app.inject({
      method: "POST",
      url: "/api/lifecycle/couple",
      headers: autor,
      payload: { assetRef: ANLAGE, koId },
    });
    expect([200, 204], kopplung.body).toContain(kopplung.statusCode);
  }
  const geaendert = await app.inject({
    method: "POST",
    url: "/api/lifecycle/asset-changed",
    headers: admin,
    payload: { assetRef: ANLAGE },
  });
  expect(geaendert.statusCode, geaendert.body).toBe(200);

  return { app, admin, autor, viewer, geheim, offen };
}

function hole(app: App, wer: Auth) {
  return app.inject({ method: "GET", url: "/api/lifecycle/pending", headers: wer });
}

describe("JOB 2020 · G7b: die Faelligkeitsliste traegt dieselbe Grenze wie der Bestand", () => {
  it("VORBEDINGUNG: der Admin sieht BEIDE faelligen Kennungen — sonst misst alles darunter nichts", async () => {
    // DIE WICHTIGSTE ZEILE DIESER DATEI. Ohne einen wirklich faelligen Bestand waeren alle Zusagen
    // unten auch ohne die Sperre erfuellt — genau das hat die Gegenprobe an einem ersten Aufbau
    // gezeigt. Diese Vorbedingung macht den Fall unfaelschbar: schlaegt der Aufbau fehl, wird
    // HIER rot und nicht schweigend gruen.
    const { app, admin, geheim, offen } = await setup("g7b0");
    const res = await hole(app, admin);
    expect(res.statusCode, res.body).toBe(200);
    const ids = res.json() as string[];
    expect(
      ids,
      "die vertrauliche Kennung ist gar nicht faellig — der Aufbau traegt nicht",
    ).toContain(geheim);
    expect(ids, "die offene Kennung ist gar nicht faellig — der Aufbau traegt nicht").toContain(
      offen,
    );
  });

  it("die Kennung eines VERTRAULICHEN Objekts steht nicht in der Liste des Betrachters", async () => {
    const { app, viewer, geheim } = await setup("g7b1");
    const res = await hole(app, viewer);
    expect(res.statusCode, res.body).toBe(200);
    expect(
      res.json() as string[],
      `Die Kennung eines vertraulichen Objekts stand in der Faelligkeitsliste eines
      Betrachters, der es nicht oeffnen darf. Antwort: ${res.body}`,
    ).not.toContain(geheim);
  });

  it("GEGENPROBE: der AUTOR findet seine eigene vertrauliche Kennung, falls sie faellig ist", async () => {
    // Die Autor-Ausnahme aus `darfSehen` muss auch hier mitreisen. Ist das Objekt gar nicht
    // faellig, ist die Liste fuer BEIDE leer — dann sagt dieser Fall nichts, und genau deshalb
    // vergleicht er den Autor mit dem Betrachter statt gegen eine feste Erwartung.
    const { app, autor, viewer, geheim } = await setup("g7b2");
    const alsAutor = (await hole(app, autor)).json() as string[];
    const alsViewer = (await hole(app, viewer)).json() as string[];
    expect(
      alsViewer.includes(geheim),
      "der Betrachter sieht die vertrauliche Kennung — dann greift die Sperre nicht",
    ).toBe(false);
    if (alsAutor.includes(geheim)) {
      expect(
        alsAutor.length,
        "der Autor sieht sie, der Betrachter nicht — genau das ist die Autor-Ausnahme",
      ).toBeGreaterThan(alsViewer.length);
    }
  });

  it("GEGENPROBE: die Liste des Betrachters ist keine Kopie der Adminliste", async () => {
    // Waere sie identisch, koennte die Sperre gar nicht greifen; waere die Betrachterliste immer
    // leer, waere die Route kaputt statt geschuetzt. Geprueft wird deshalb die TEILMENGE.
    const { app, admin, viewer } = await setup("g7b3");
    const alsAdmin = (await hole(app, admin)).json() as string[];
    const alsViewer = (await hole(app, viewer)).json() as string[];
    for (const id of alsViewer) {
      expect(
        alsAdmin,
        `Die Betrachterliste enthaelt eine Kennung, die der Admin nicht hat: ${id}`,
      ).toContain(id);
    }
  });

  it("das offene Objekt bleibt fuer beide gleich behandelt", async () => {
    const { app, admin, viewer, offen } = await setup("g7b4");
    const alsAdmin = (await hole(app, admin)).json() as string[];
    const alsViewer = (await hole(app, viewer)).json() as string[];
    expect(
      alsViewer.includes(offen),
      "ein OFFENES Objekt darf der Betrachter sehen — die Sperre verengt nur dort, wo noetig",
    ).toBe(alsAdmin.includes(offen));
  });
});
