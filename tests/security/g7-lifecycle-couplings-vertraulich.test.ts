// ================================================================================================
// AUFTRAG-JOB2017 (G7) — DER LESEWEG, DER NICHTS DURCHSETZTE: /api/lifecycle/couplings/:koId
// ================================================================================================
//
// DER BEFUND. G7 fragt, ob die Vertraulichkeit auf ALLEN Lesewegen greift (`OFFEN.md`, Zeile
// G6–G8: „systemisch auf allen Lesewegen"). Gemessen an den zwoelf Routendateien war
// `lifecycle-routes.ts` eine von vieren ohne jede Sichtbarkeitsstelle — und die einzige davon, bei
// der der AUFRUFER die Kennung waehlt:
//
//     app.get("/api/lifecycle/couplings/:koId", …)
//       const user = await guards.requirePermission("ko.read", request, reply);
//       reply.code(200).send(await lifecycle.couplingsForKo(request.params.koId));
//
// Wer die Kennung eines vertraulichen Objekts kannte — aus einem Konflikt, einer Benachrichtigung
// oder durch Raten —, bekam seine gekoppelten Anlagen, ohne das Objekt je oeffnen zu duerfen.
// Derselbe Mensch bekommt am Hauptlesepfad `GET /api/kos/:id` ein 404 (`ko-routes.ts:440-447`).
// **Ein Schutz, der am Hauptweg greift und am Nebenweg nicht, ist schwerer zu erkennen als keiner.**
//
// WAS DIESE DATEI MISST — und was sie ausdruecklich NICHT tut. Sie faehrt den ECHTEN Routenpfad
// ueber `app.inject` gegen die in-process gebaute Anwendung, wie die uebrigen Sicherheitstests.
// Kein Nachbau der Regel: was `darfSehen` entscheidet, entscheidet hier `darfSehen`.
//
// DIE GEGENPROBE STEHT NEBEN JEDER ZUSAGE. Ohne sie belegte die Datei nur, dass die Route
// ueberhaupt nichts herausgibt — der haeufigste Fehler dieser Testsorte.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const ANLAGE = "anlage://wartungsplan-2026.pdf";

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
      statement: "Eine Aussage, an der eine Anlage haengt.",
      type: "best_practice",
      category: "Anlagen",
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

  // Ein vertrauliches und ein offenes Objekt, jedes mit EINER gekoppelten Anlage.
  const geheim = await ko(app, autor, "Vertrauliche Anlagenakte");
  const offen = await ko(app, autor, "Offene Anlagenakte");
  const stufe = await app.inject({
    method: "PUT",
    url: `/api/kos/${geheim}`,
    headers: autor,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(stufe.statusCode, stufe.body).toBe(200);

  for (const koId of [geheim, offen]) {
    const kopplung = await app.inject({
      method: "POST",
      url: "/api/lifecycle/couple",
      headers: autor,
      payload: { assetRef: ANLAGE, koId },
    });
    expect([200, 204], kopplung.body).toContain(kopplung.statusCode);
  }

  return { app, admin, autor, viewer, geheim, offen };
}

function hole(app: App, wer: Auth, koId: string) {
  return app.inject({
    method: "GET",
    url: `/api/lifecycle/couplings/${koId}`,
    headers: wer,
  });
}

describe("JOB 2017 · G7: der Kopplungs-Leseweg traegt dieselbe Grenze wie der Hauptweg", () => {
  it("der Betrachter bekommt fuer ein VERTRAULICHES Objekt 404 — nicht die Kopplungen", async () => {
    const { app, viewer, geheim } = await setup("g7a");
    const res = await hole(app, viewer, geheim);
    expect(
      res.statusCode,
      `Die Kopplungen eines vertraulichen Objekts gingen an einen Betrachter, der es nicht
      oeffnen darf. Antwort: ${res.body}`,
    ).toBe(404);
    expect(res.body, "und die Anlagenkennung steht auch nicht im Rumpf").not.toContain(ANLAGE);
  });

  it("GEGENPROBE: fuer das OFFENE Objekt bekommt derselbe Betrachter seine Kopplung", async () => {
    // Ohne diesen Fall bewiese der Fall oben nur, dass die Route ueberhaupt nichts herausgibt.
    const { app, viewer, offen } = await setup("g7b");
    const res = await hole(app, viewer, offen);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body, "die Kopplung des offenen Objekts fehlt").toContain(ANLAGE);
  });

  it("GEGENPROBE: der Admin sieht die Kopplung des vertraulichen Objekts", async () => {
    // `ko.validate` sieht Vertrauliches (SCRUM-506) — die Grenze verengt nur dort, wo noetig.
    const { app, admin, geheim } = await setup("g7c");
    const res = await hole(app, admin, geheim);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body, "der Admin bekommt die Kopplung nicht").toContain(ANLAGE);
  });

  it("GEGENPROBE: der AUTOR sieht sein eigenes vertrauliches Objekt", async () => {
    // Die Autor-Ausnahme aus `darfSehen` (sichtbarkeit.ts:61) muss auch hier mitreisen — sonst
    // koennte jemand ein vertrauliches Objekt erfassen und seine Kopplungen nicht mehr lesen.
    const { app, autor, geheim } = await setup("g7d");
    const res = await hole(app, autor, geheim);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body, "der Autor bekommt seine eigene Kopplung nicht").toContain(ANLAGE);
  });

  it("eine unbekannte Kennung antwortet GENAUSO wie eine unsichtbare — 404, Wort fuer Wort", async () => {
    // Der Grund steht in ko-routes.ts:436-439: unterschieden sich die beiden Antworten, waere die
    // Meldung selbst das Existenzorakel, das der 404 gerade verhindern soll.
    const { app, viewer, geheim } = await setup("g7e");
    const unsichtbar = await hole(app, viewer, geheim);
    const gibtEsNicht = await hole(app, viewer, "ko-gibt-es-nicht-0000");
    expect(unsichtbar.statusCode).toBe(gibtEsNicht.statusCode);
    expect(unsichtbar.body, "die beiden Antworten unterscheiden sich im Rumpf").toBe(
      gibtEsNicht.body,
    );
  });
});
