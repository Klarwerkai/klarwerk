import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ================================================================================================
// JOB 2531 — EIN FREMDER ENTWURF DARF NIE IN DER EIGENEN LISTE STEHEN.
// ================================================================================================
//
// DIE REGEL, um die es geht, steht in `services/app/src/routes/capture-routes.ts`:
//
//     function visibleDraftsFor(user: SessionUser, drafts: Draft[]): Draft[] {
//       return user.role === "admin"
//         ? drafts
//         : drafts.filter((draft) => draft.originalAuthor === user.id);
//     }
//
// SIE IST HEUTE RICHTIG. Dieser Fall entsteht nicht, weil das Produkt einen Defekt hat, sondern
// weil die Regel BISHER VON KEINEM TEST GEDECKT WAR. Gemessen in JOB 2531 mit einer gesetzten
// Mutation (`return drafts;` — der Filter faellt ganz weg), gefahren gegen tests/capture/,
// tests/app/, services/app/src/routes/ und services/capture/:
//
//     M1 · visibleDraftsFor filtert nicht mehr  ->  KEINE einzige Testdatei wird rot
//     M2 · canSeeDraft sagt immer ja            ->  drei Testdateien werden rot
//
// Die EINZELentwurfs-Regel (`canSeeDraft`, Route `/api/drafts/:id`) ist also gedeckt — durch
// `tests/app/ka8-naechster-schritt-entwurf.test.ts` und zwei weitere. Die LISTENregel war es
// nicht: Haette jemand den Filter entfernt, waere jede Expertin ab dem naechsten Aufruf in die
// Entwuerfe ihrer Kollegen gefallen, und das Tor waere gruen geblieben.
//
// WARUM DAS NICHT AUFGEFALLEN IST — und der Grund, warum dieser Test hier steht und nicht
// woanders: `tests/security/mega74-lesewege-sammler.test.ts:279` fuehrt die Route bereits:
//
//     "GET /api/drafts": { urteil: "EIGENER_BESTAND", grund: "visibleDraftsFor — Eigentuemerlogik." }
//
// Das ist ein INVENTAREINTRAG. Er sagt, dass die Regel EXISTIERT — nicht, dass sie WIRKT. Genau
// diese Sorte Eintrag erzeugt die Ruhe, in der eine ungedeckte Regel jahrelang stehen kann.
// Namensanwesenheit ist kein Verhaltensnachweis.
//
// DIESER FALL PRUEFT BEIDE SEITEN DER REGEL. Ein Test, der nur die Filterung prueft, waere durch
// `return [];` zu befriedigen — dann saehe niemand mehr etwas, und der Fall bliebe gruen.

type App = ReturnType<typeof buildApp>;

interface DraftAntwort {
  id: string;
  originalAuthor: string;
}

async function anmelden(app: App, email: string): Promise<Record<string, string>> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(res.statusCode, `Anmeldung von ${email} fehlgeschlagen`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function entwurfAnlegen(app: App, headers: Record<string, string>, titel: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers,
    payload: { title: titel, statement: `Aussage zu ${titel}` },
  });
  expect(res.statusCode, `Entwurf „${titel}" konnte nicht angelegt werden`).toBe(201);
  return res.json() as DraftAntwort;
}

async function listeVon(app: App, headers: Record<string, string>): Promise<DraftAntwort[]> {
  const res = await app.inject({ method: "GET", url: "/api/drafts", headers });
  expect(res.statusCode).toBe(200);
  return res.json() as DraftAntwort[];
}

/** Ein Verwalter und zwei Expertinnen, die einander nichts angehen. */
async function aufbau() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Verwaltung", email: "chefin@x.de", password: "secret123" },
  });
  const adminHeaders = await anmelden(app, "chefin@x.de");

  for (const [name, email] of [
    ["Anna", "anna@x.de"],
    ["Boris", "boris@x.de"],
  ]) {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: adminHeaders,
      payload: { name, email, password: "secret123", role: "experte" },
    });
    expect(angelegt.statusCode, `Nutzer ${name} konnte nicht angelegt werden`).toBe(201);
  }

  const annaHeaders = await anmelden(app, "anna@x.de");
  const borisHeaders = await anmelden(app, "boris@x.de");
  const annas = await entwurfAnlegen(app, annaHeaders, "Annas Entwurf");
  const boris = await entwurfAnlegen(app, borisHeaders, "Boris' Entwurf");

  return { app, adminHeaders, annaHeaders, annas, boris };
}

describe("JOB 2531 · GET /api/drafts — ein fremder Entwurf erreicht die eigene Liste nie", () => {
  it("die Expertin sieht ihren eigenen Entwurf und KEINEN fremden", async () => {
    const { app, annaHeaders, annas, boris } = await aufbau();

    const liste = await listeVon(app, annaHeaders);

    // Die Zahl allein wuerde hier nichts sagen: kaeme Boris' Entwurf statt Annas zurueck, bliebe
    // sie bei eins. Geprueft wird deshalb die HERKUNFT jedes ausgelieferten Entwurfs.
    const fremde = liste.filter((d) => d.originalAuthor !== annas.originalAuthor);
    expect(
      fremde.map((d) => `${d.id} (Autor ${d.originalAuthor})`),
      "FREMDER ENTWURF IN DER EIGENEN LISTE. `GET /api/drafts` hat einer Expertin Entwuerfe " +
        "ausgeliefert, die ihr nicht gehoeren. Verantwortlich ist `visibleDraftsFor` in " +
        "services/app/src/routes/capture-routes.ts — sie filtert nicht mehr nach " +
        "`originalAuthor`. Das ist kein Anzeigefehler: fremde Arbeitsstaende werden sichtbar.",
    ).toEqual([]);

    // Und die eigene Arbeit ist da — sonst waere `return []` eine gueltige Loesung.
    expect(
      liste.map((d) => d.id),
      "Der EIGENE Entwurf fehlt in der eigenen Liste. Eine Sichtbarkeitsregel, die zu viel " +
        "wegnimmt, ist genauso falsch wie eine, die zu wenig wegnimmt.",
    ).toEqual([annas.id]);

    expect(liste.map((d) => d.id)).not.toContain(boris.id);
  });

  it("die Verwaltung sieht beide — die Regel nimmt niemandem etwas, das ihm zusteht", async () => {
    const { app, adminHeaders, annas, boris } = await aufbau();

    const liste = await listeVon(app, adminHeaders);

    expect(
      liste.map((d) => d.id).sort(),
      "Die Verwaltung sieht nicht mehr den ganzen Bestand. `visibleDraftsFor` gibt Admins " +
        "ausdruecklich alle Entwuerfe; faellt das weg, verliert die Verwaltung ihren Ueberblick.",
    ).toEqual([annas.id, boris.id].sort());
  });
});
