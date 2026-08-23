// ================================================================================================
// JOB 2016 · D1 (G6) — DER EXPORT UMGEHT DIE VERTRAULICHKEIT: die zwei ungeprueften Formate.
// ================================================================================================
//
// SCHRITT 1, DAS MESSERGEBNIS — und es faellt anders aus, als der Auftragstitel vermuten laesst:
//
// Der Exportweg `GET /api/library/export` IST geschuetzt. `library-routes.ts:205` bildet die
// Rollenentscheidung als Datum (`includeConfidential: can(user.role, "ko.validate")`), und alle
// VIER Ausgabeformate laufen durch dieselbe gefilterte Quelle `exportJson`
// (`library-analytics/src/service.ts:1283-1285`). Ein Leck im Produkt habe ich nicht gefunden —
// weder hier noch an einem anderen Ausgabeweg (`output` filtert im Dienst, `livewall`,
// `notifications`, `management`, `analytics` tragen Praedikate, `impact` rechnet nur auf eigenen
// Objekten, `audit` steht auf `ko.validate`).
//
// WAS FEHLT, IST DIE ABSICHERUNG ZWEIER FORMATE:
//
//   Format      Rolle viewer (nicht berechtigt)          Rolle admin (berechtigt)
//   json        library-export-egress.test.ts:75  ✓      :98  ✓
//   markdown    library-export-egress.test.ts:85  ✓      —
//   mediawiki   —                                        —
//   html        —                                        —
//
// `mediawiki` und `html` werden von KEINEM Fall auf Vertraulichkeit geprueft. Sie sind zugleich
// die beiden Formate, die man WEITERGIBT — ein Wiki-Absatz und eine druckfertige Seite verlassen
// das Haus leichter als eine JSON-Antwort.
//
// WARUM DAS MEHR IST ALS EINE LUECKE IN DER ABDECKUNG: Alle vier Formate haengen heute an
// `exportJson`. Wer morgen `exportMediaWiki` aus Geschwindigkeitsgruenden direkt an die
// Datenquelle haengt — genau die Sorte Umbau, die `mega74 BLOCK B` fuer die Suche und
// `JOB 1325` fuer den `helped`-Zweig der Live-Wall nachtraeglich reparieren musste —, faellt
// heute KEIN Test. Der Filter steht; was fehlt, ist der Waechter darueber.
//
// Diese Datei prueft deshalb beide fehlenden Formate am ECHTEN HTTP-Rand, in beide Richtungen.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const GEHEIM = "Geheime Prozedur";
const OFFEN = "Ventil entlasten";
const ROH = "Roher Entwurf";

// Der Aufbau ist bewusst DERSELBE wie in `library-export-egress.test.ts:10-69` — dieselbe
// Rollenbildung (Admin registriert sich, legt dann den Viewer ueber `POST /api/users` an) und
// derselbe Bestand. Ein eigener, abweichender Aufbau waere eine zweite Wahrheit ueber die Rollen;
// mein erster Anlauf hat das gezeigt: mit `register` allein bekam der zweite Nutzer kein
// `ko.read` und die Route antwortete 401 statt 200.
async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "g6-admin@x.de", password: "secret123" },
  });
  const adminLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "g6-admin@x.de", password: "secret123" },
  });
  const adminHeaders = { authorization: `Bearer ${adminLogin.json().token}` };

  const createdViewer = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: adminHeaders,
    payload: {
      name: "Vera Viewer",
      email: "g6-viewer@x.de",
      password: "secret123",
      role: "viewer",
    },
  });
  expect(createdViewer.statusCode).toBe(201);
  const viewerLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "g6-viewer@x.de", password: "secret123" },
  });
  const viewerHeaders = { authorization: `Bearer ${viewerLogin.json().token}` };

  const ko = services.ko;
  const offen = await ko.create({
    title: OFFEN,
    statement: "Vor der Wartung das Ventil entlasten.",
    type: "best_practice",
    category: "Anlage 1",
    author: "admin",
    tags: [],
  });
  await ko.setValidationState(offen.id, { trust: 80, status: "validiert" });

  const geheim = await ko.create({
    title: GEHEIM,
    statement: "Der Mandant Mueller verlangt das Sonderverfahren.",
    type: "best_practice",
    category: "Anlage 1",
    author: "admin",
    tags: [],
  });
  await ko.setValidationState(geheim.id, { trust: 80, status: "validiert" });
  await ko.setConfidentiality(geheim.id, "vertraulich", "admin");

  // Ein unvalidiertes Objekt — der Export ist Validiert-only, das gilt fuer jedes Format.
  await ko.create({
    title: ROH,
    statement: "Noch nicht geprueft.",
    type: "best_practice",
    category: "Anlage 1",
    author: "admin",
    tags: [],
  });

  return { app, adminHeaders, viewerHeaders };
}

const holen = (
  app: Awaited<ReturnType<typeof setup>>["app"],
  format: string,
  headers: Record<string, string>,
) =>
  app.inject({
    method: "GET",
    url: `/api/library/export?format=${format}`,
    headers,
  });

describe("G6 · der Export haelt die Vertraulichkeit in JEDEM Format", () => {
  for (const format of ["mediawiki", "html"] as const) {
    it(`G6-${format}-1 · Nicht-Berechtigter: ${format} traegt das vertrauliche Objekt NICHT`, async () => {
      const { app, viewerHeaders } = await setup();
      const res = await holen(app, format, viewerHeaders);
      expect(res.statusCode).toBe(200);

      // KALIBRIERUNG im selben Fall: das offene Objekt IST drin. Ohne diesen Anker waere jedes
      // „nicht enthalten" auch dann gruen, wenn der Export gar nichts mehr liefert.
      expect(res.body).toContain(OFFEN);

      // Die Zusage: weder Titel noch Aussage des vertraulichen Objekts.
      expect(res.body).not.toContain(GEHEIM);
      expect(res.body).not.toContain("Mandant Mueller");
      expect(res.body).not.toContain("Sonderverfahren");

      // Und Validiert-only gilt hier ebenso.
      expect(res.body).not.toContain(ROH);
    });

    it(`G6-${format}-2 · Berechtigter (ko.validate): ${format} traegt es — aber weiterhin nur Validiertes`, async () => {
      // Die Gegenrichtung. Ohne sie bewiese der Fall oben nur, dass das Format irgendetwas
      // weglaesst — nicht, dass es an der ROLLE haengt.
      const { app, adminHeaders } = await setup();
      const res = await holen(app, format, adminHeaders);
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain(OFFEN);
      expect(res.body).toContain(GEHEIM);
      expect(res.body).not.toContain(ROH);
    });
  }

  it("G6-anmeldung · ohne Anmeldung liefert KEIN Format etwas — auch nicht die Textformate", async () => {
    // `library-export-egress.test.ts:107` prueft das fuer JSON. Die drei Formatzweige liegen
    // hinter demselben Guard (`library-routes.ts:197`) — hier steht es auch fuer sie fest.
    const { app } = await setup();
    for (const format of ["mediawiki", "html", "markdown"]) {
      const res = await app.inject({ method: "GET", url: `/api/library/export?format=${format}` });
      expect(res.statusCode, `${format} ohne Anmeldung`).toBe(401);
    }
  });
});
