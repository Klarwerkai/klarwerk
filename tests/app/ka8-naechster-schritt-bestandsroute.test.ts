// ================================================================================================
// JOB 1494 · D2 · KA8 — DER ERSTE VERHALTENSTEST FUER DIE BESTANDSROUTE.
// ================================================================================================
//
// WAS DIESER DURCHGANG KORRIGIERT — und es ist mein eigener Fehler:
//
// JOB 1494 D1 hat eine Route `GET /api/drafts/:id/naechster-schritt` in einer NEUEN Datei
// (`services/app/src/routes/naechster-schritt-entwurf.ts`) gebaut. **Diese Route gab es bereits.**
// `services/app/src/routes/capture-routes.ts:230-243` deklariert exakt denselben Pfad, seit
// JOB 1171 D1 (KA8 Stufe 1a). Der D1-Bau war damit ein PARALLELWEG mit einem ABWEICHENDEN
// Vertrag — Leerfall dort `204` ohne Rumpf, im Bestand `200 {}` (`capture-routes.ts:241`).
//
// Aufgefallen ist es erst, als der D2-Test beide zugleich registrierte:
//     FastifyError: Method 'GET' already declared for route '/api/drafts/:id/naechster-schritt'
//
// Die D1-Dateien sind deshalb zurueckgenommen. Was bleibt, ist die Luecke, die D1 wirklich
// gefunden hat — nur an einer anderen Stelle als gedacht:
//
// DIE BESTANDSROUTE HAT KEINEN VERHALTENSTEST. Gemessen im Baum: sie erscheint in genau zwei
// Dateien, und beide sind Inventare, keine Verhaltenspruefungen —
//   · `tests/security/mega74-lesewege-sammler.test.ts:255`  (Lesewege-Sammler)
//   · `tests/security/routeGuardAudit.ts`                    (Guard-Scanner)
// Kein Fall ruft sie auf. Diese Datei ist der erste.
//
// SIE PRUEFT AM ECHTEN DRAHT: `buildApp(buildServices())` registriert `captureRoutes` selbst,
// die Wachposten sind die echten aus `services.auth`, die Rollen kommen aus der echten
// Rechtematrix, und die Entwuerfe entstehen ueber `POST /api/drafts`. Gestellt ist hier nichts —
// insbesondere wird NICHTS zusaetzlich registriert.
//
// DIE RECHTEMATRIX, GELESEN statt angenommen (`services/rbac/src/policy.ts:13-18`):
//     viewer     -> ["ko.read"]                  ohne ko.create
//     experte    -> ["ko.read", "ko.create"]     mit  ko.create
//     admin      -> alles
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const PASSWORT = "geheim12345";
const PFAD = (id: string) => `/api/drafts/${id}/naechster-schritt`;

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASSWORT },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

/** Ein echter Aufbau — nichts zusaetzlich registriert, nichts gestellt. */
async function echterAufbau() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@ka8d2.test", password: PASSWORT },
  });
  const admin = await anmelden(app, "admin@ka8d2.test");

  for (const [email, role] of [
    ["experte@ka8d2.test", "experte"],
    ["zweiter@ka8d2.test", "experte"],
    ["viewer@ka8d2.test", "viewer"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: PASSWORT, role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} (${role}) nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }

  return {
    app,
    admin,
    experte: await anmelden(app, "experte@ka8d2.test"),
    zweiter: await anmelden(app, "zweiter@ka8d2.test"),
    viewer: await anmelden(app, "viewer@ka8d2.test"),
  };
}

/** Ein Entwurf ueber den ECHTEN Weg — `POST /api/drafts` verlangt selbst `ko.create`. */
async function entwurfAnlegen(app: App, kopf: Kopf, titel: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: kopf,
    payload: {
      title: titel,
      statement: "Unter 5 mm Blechstaerke wird mit reduzierter Stromstaerke geschweisst.",
      type: "best_practice",
      category: "Fertigung",
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Entwurf nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  return (res.json() as { id: string }).id;
}

describe("JOB 1494 D2 · KA8 — die Bestandsroute liefert die Auskunft samt Herkunft", () => {
  it("ein vollstaendiger Entwurf ergibt `einreichen`, und die Herkunft ist nie leer", async () => {
    const { app, experte } = await echterAufbau();
    const id = await entwurfAnlegen(app, experte, "Schweissnaht pruefen");

    const res = await app.inject({ method: "GET", url: PFAD(id), headers: experte });

    expect(res.statusCode, res.body).toBe(200);
    const koerper = res.json() as { naechsterSchritt?: { art: string; herkunft: string[] } };
    expect(koerper.naechsterSchritt?.art).toBe("einreichen");
    expect(
      koerper.naechsterSchritt?.herkunft.length,
      "eine Auskunft ohne Herkunft waere geraten",
    ).toBeGreaterThan(0);
  });

  it("ein unvollstaendiger Entwurf ergibt `vervollstaendigen` — mit GENAU den fehlenden Feldern", async () => {
    const { app, experte } = await echterAufbau();
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: experte,
      payload: { title: "Nur ein Titel" },
    });
    expect(res.statusCode, res.body).toBe(201);
    const id = (res.json() as { id: string }).id;

    const auskunft = await app.inject({ method: "GET", url: PFAD(id), headers: experte });

    expect(auskunft.statusCode, auskunft.body).toBe(200);
    const schritt = (auskunft.json() as { naechsterSchritt?: { art: string; herkunft: string[] } })
      .naechsterSchritt;
    expect(schritt?.art).toBe("vervollstaendigen");
    expect([...(schritt?.herkunft ?? [])].sort()).toEqual([
      "payload.category",
      "payload.statement",
      "payload.type",
    ]);
  });

  it("DER UNTERSCHIED: zwei verschiedene Entwuerfe ergeben zwei verschiedene Auskuenfte", async () => {
    // Ohne diesen Fall koennte die Route immer dasselbe antworten und trotzdem gruen sein — er
    // prueft, dass die Ableitung wirklich vom Entwurf abhaengt.
    const { app, experte } = await echterAufbau();
    const vollstaendig = await entwurfAnlegen(app, experte, "Vollstaendig");
    const halb = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: experte,
      payload: { title: "Halb" },
    });
    const halbId = (halb.json() as { id: string }).id;

    const a = await app.inject({ method: "GET", url: PFAD(vollstaendig), headers: experte });
    const b = await app.inject({ method: "GET", url: PFAD(halbId), headers: experte });

    const artA = (a.json() as { naechsterSchritt?: { art: string } }).naechsterSchritt?.art;
    const artB = (b.json() as { naechsterSchritt?: { art: string } }).naechsterSchritt?.art;
    expect(`${artA} ≠ ${artB}`).toBe("einreichen ≠ vervollstaendigen");
  });
});

describe("JOB 1494 D2 · KA8 — das Recht greift wirklich", () => {
  it("KALIBRIERUNG: der 403 der Betrachterin kommt vom RECHT — nicht vom Eigentum", async () => {
    // DIE SCHAERFSTE AUSSAGE DIESER DATEI, und sie musste geschaerft werden.
    //
    // Ein blosser Vergleich „viewer 403, experte 200" traegt NICHT: vor dieser Route liegen ZWEI
    // Tore, und beide antworten mit 403. Eine Betrachterin scheitert am ersten (kein `ko.create`)
    // — sie wuerde aber auch am zweiten scheitern, weil der Entwurf ihr nicht gehoert. Der blosse
    // Statuscode sagt also nicht, welches Tor gegriffen hat.
    //
    // Belegt durch eine Gegenmutation in JOB 1494 D2: das Recht auf `ko.read` herabgesetzt — der
    // Fall blieb GRUEN, weil das Eigentuemertor uebernahm. Erst die MELDUNG trennt die beiden:
    //     Rechtetor      `http.ts:169`          -> "Recht fehlt: ko.create"
    //     Eigentuemertor `capture-routes.ts:45` -> "Entwurf nicht verfuegbar."
    const { app, experte, viewer } = await echterAufbau();
    const id = await entwurfAnlegen(app, experte, "Kalibrierfall");

    const alsViewer = await app.inject({ method: "GET", url: PFAD(id), headers: viewer });
    const alsExperte = await app.inject({ method: "GET", url: PFAD(id), headers: experte });

    expect(`${alsViewer.statusCode}/${alsExperte.statusCode}`).toBe("403/200");
    expect(
      (alsViewer.json() as { message: string }).message,
      "der 403 kam vom falschen Tor — dann prueft dieser Fall nicht das Recht",
    ).toBe("Recht fehlt: ko.create");
  });

  it("ein FREMDER Entwurf bleibt fremd — auch fuer eine zweite Expertin mit demselben Recht", async () => {
    // `canSeeDraft` (capture-routes.ts:23-25) trennt nach Eigentuemerschaft, nicht nach Recht.
    // Beide tragen `ko.create`; nur eine hat den Entwurf angelegt.
    const { app, experte, zweiter } = await echterAufbau();
    const id = await entwurfAnlegen(app, experte, "Fremder Entwurf");

    const fremd = await app.inject({ method: "GET", url: PFAD(id), headers: zweiter });

    expect(fremd.statusCode, fremd.body).toBe(403);
    expect((fremd.json() as { error: string }).error).toBe("FORBIDDEN");
  });

  it("die Verwaltung sieht denselben fremden Entwurf — die andere Haelfte derselben Regel", async () => {
    const { app, admin, experte } = await echterAufbau();
    const id = await entwurfAnlegen(app, experte, "Admin sieht mit");

    const alsAdmin = await app.inject({ method: "GET", url: PFAD(id), headers: admin });

    expect(alsAdmin.statusCode, alsAdmin.body).toBe(200);
  });

  it("ohne Anmeldung 401 — und existierend bleibt von erfunden ununterscheidbar", async () => {
    // Waere das Recht erst NACH der Objektaufloesung geprueft, gaebe der eine 401 und der andere
    // 404 — und die blosse Statuszahl verriete, welche Kennung existiert.
    const { app, experte } = await echterAufbau();
    const id = await entwurfAnlegen(app, experte, "Nicht verraten");

    const vorhanden = await app.inject({ method: "GET", url: PFAD(id) });
    const erfunden = await app.inject({ method: "GET", url: PFAD("gibt-es-nicht") });

    expect(`${vorhanden.statusCode}/${erfunden.statusCode}`).toBe("401/401");
  });

  it("ein unbekannter Entwurf ist fuer die Berechtigte 404 — kein erfundener Leerfall", async () => {
    const { app, experte } = await echterAufbau();

    const res = await app.inject({ method: "GET", url: PFAD("gibt-es-nicht"), headers: experte });

    expect(res.statusCode, res.body).toBe(404);
    expect((res.json() as { error: string }).error).toBe("NOT_FOUND");
  });
});

describe("JOB 1494 D2 · KA8 — reine Lesung", () => {
  it("zweimal abrufen aendert den Entwurfsbestand nicht", async () => {
    const { app, experte } = await echterAufbau();
    const id = await entwurfAnlegen(app, experte, "Unveraendert");

    const vorher = await app.inject({ method: "GET", url: "/api/drafts", headers: experte });
    await app.inject({ method: "GET", url: PFAD(id), headers: experte });
    await app.inject({ method: "GET", url: PFAD(id), headers: experte });
    const nachher = await app.inject({ method: "GET", url: "/api/drafts", headers: experte });

    expect(nachher.body).toBe(vorher.body);
  });
});
