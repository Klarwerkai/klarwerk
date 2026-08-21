// ================================================================================================
// JOB 1510 / G1 — DAS PRUEF-BOARD AM DRAHT: FAIL-CLOSED, UND ZWAR ALS FEHLEN.
// ================================================================================================
//
// DER ABNAHMESATZ, den dieser Test misst (Auftrag §6, woertlich):
//
//   „Ein Betrachter ohne `ko.validate`, der nicht Autor ist, sieht auf dem Pruef-Board kein
//    vertrauliches Objekt — und erfaehrt auch nicht, dass es existiert."
//
// WARUM ER TROTZ DREIFACHER ABSICHERUNG NOETIG WAR — gemessen in diesem Durchgang:
//
// Die Regel selbst steht seit AUFTRAG-mega74 Block E in `validation-routes.ts:35`
// (`sichtbareFuer(user, await validation.board(...))`), und gleich ZWEI Register halten sie fest:
//   · `tests/security/mega74-lesewege-sammler.test.ts:167` — Urteil `PRAEDIKAT`, seit mega76 C
//     zusaetzlich auf Pfaddominanz nachgeprueft;
//   · `tests/security/routeGuardAudit.ts:270` — `zeilenrecht: ["sichtbareFuer"]`.
//
// BEIDE PRUEFEN DIE REGISTRIERUNG, NICHT DIE ANTWORT. Der Sammler sagt das selbst
// (mega74-lesewege-sammler.test.ts:68-71): „Der Sammler prueft die REGISTRIERUNG, nicht die
// Antwort. Dass eine Route mit `darfSehen` wirklich 404 antwortet, belegen die Draht-Tests in
// mega74-lesepfad-vertraulich.test.ts, mega74-anhang-vertraulich.test.ts,
// mega74-nebenwege-vertraulich.test.ts und mega76-schutz-erzwungen.test.ts."
//
// GEMESSEN: In keinem dieser vier Draht-Tests kommt `/api/validation/board` vor. Fuer den
// Hauptlesepfad, die Anhaenge und die Nebenwege gibt es den Drahtbeleg — fuer das Pruef-Board
// nicht. Diese Datei schliesst genau diese Luecke und erfindet keine zweite Regel: sie ruft die
// echte Route ueber `app.inject` und sieht nach, was ankommt.
//
// BAUART UEBERNOMMEN, NICHT ERFUNDEN: Vorrichtung, Rollenkonten und die beiden KO-Helfer sind die
// aus `mega74-lesepfad-vertraulich.test.ts` — dieselbe Bauart fuer dieselbe Frage an einer anderen
// Route. Ein zweiter Aufbau waere die zweite Wahrheit, vor der der Zugriffsschutz-Bauplan warnt.
//
// WAS DIESE DATEI NICHT TUT: sie aendert keine Regel und legt kein zweites Praedikat an. Sie misst
// das Verhalten der bestehenden.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

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

/**
 * Die Vorrichtung legt ihre Konten SELBST an (kein Demo-Seed): der erste registrierte Nutzer wird
 * Admin, danach legt der Admin die Rollen direkt an.
 *
 * `autor` und `fremd` sind BEIDE `experte` — derselbe Rollenanteil, unterschiedliche Autorschaft.
 * Nur so trennt der Test die Autor-Ausnahme von der Rollenfrage; waeren es zwei Rollen, bewiese
 * ein Unterschied nichts ueber den Autor.
 */
async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@g1510.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@g1510.test", "geheim12345");

  for (const [email, role] of [
    ["autor@g1510.test", "experte"],
    ["fremd@g1510.test", "experte"],
    ["controller@g1510.test", "controller"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} (${role}) nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }

  return {
    app,
    admin,
    autor: await login(app, "autor@g1510.test", "geheim12345"),
    fremd: await login(app, "fremd@g1510.test", "geheim12345"),
    controller: await login(app, "controller@g1510.test", "geheim12345"),
  };
}

/** Legt ein KO an und stuft es auf „vertraulich" hoch (Upgrade ist fuer ko.create frei, SCRUM-509). */
async function vertraulichesKo(app: App, autor: Auth): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: "Vertraulicher Pruefling",
      statement: "Sensibler Kerntext, der einen fremden Pruefer nichts angeht.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().id as string;
  const up = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: autor,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(up.statusCode, up.body).toBe(200);
  expect(up.json().confidentiality).toBe("vertraulich");
  return id;
}

/**
 * Ein INTERNES KO als Kalibrierung. Ohne dieses Objekt bewiese der Kernfall nichts: er waere auch
 * dann gruen, wenn die Route ueberhaupt nichts mehr herausgaebe.
 */
async function internesKo(app: App, autor: Auth): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: "Internes Alltagswissen",
      statement: "Nichts Geheimes — dieses Objekt muss jeder Pruefer sehen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  return created.json().id as string;
}

/** Das Pruef-Board, wie der Client es bekommt. */
async function board(app: App, wer: Auth): Promise<Array<{ id: string; title?: string }>> {
  const res = await app.inject({ method: "GET", url: "/api/validation/board", headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Array<{ id: string; title?: string }>;
}

describe("JOB 1510 · G1 — das Pruef-Board gibt kein vertrauliches Objekt heraus", () => {
  it("G1-1 · KERNFALL: ein fremder Experte findet das vertrauliche Objekt NICHT auf dem Board", async () => {
    const { app, autor, fremd } = await setup();
    const geheim = await vertraulichesKo(app, autor);
    const offen = await internesKo(app, autor);

    const gesehen = await board(app, fremd);
    const ids = gesehen.map((k) => k.id);

    // KALIBRIERUNG ZUERST — ohne sie bewiese die Zeile darunter nichts: Das interne Objekt MUSS
    // da sein, sonst misst der Fall nur eine leere Route.
    expect(ids, "das interne Objekt gehoert auf das Board — sonst ist der Fall wertlos").toContain(
      offen,
    );

    expect(
      ids,
      "ein fremder Experte ohne ko.validate darf das vertrauliche Objekt nicht auf dem Pruef-Board sehen",
    ).not.toContain(geheim);
  });

  it("G1-2 · EXISTENZ: auch Titel und Kerntext reisen nicht mit", async () => {
    const { app, autor, fremd } = await setup();
    await vertraulichesKo(app, autor);
    await internesKo(app, autor);

    // Fail-closed heisst FEHLEN, nicht „gesperrt". Ein Eintrag mit leerem Titel waere ebenso ein
    // Existenzorakel wie ein 403 — deshalb wird hier der ganze Antwortkoerper geprueft, nicht nur
    // die Kennungsliste.
    const roh = await app.inject({
      method: "GET",
      url: "/api/validation/board",
      headers: fremd,
    });
    expect(roh.statusCode).toBe(200);
    expect(roh.body).not.toContain("Vertraulicher Pruefling");
    expect(roh.body).not.toContain("Sensibler Kerntext");
    // Gegenprobe: der unverfaengliche Text IST da — die Antwort ist also nicht einfach leer.
    expect(roh.body).toContain("Internes Alltagswissen");
  });

  it("G1-3 · ZAEHLER: die Menge verraet das verborgene Objekt nicht", async () => {
    const { app, autor, fremd, controller } = await setup();
    await vertraulichesKo(app, autor);
    await internesKo(app, autor);

    const alsFremder = await board(app, fremd);
    const alsKurator = await board(app, controller);

    // Auftrag §3: „Ein Zaehler, der ein unsichtbares Objekt mitzaehlt, verraet es ebenso wie ein
    // 403." Der Kurator sieht beide, der Fremde genau eines weniger.
    expect(alsKurator.length, "der Kurator sieht beide Objekte").toBe(2);
    expect(
      alsFremder.length,
      "die Antwort an den Fremden ist um genau das verborgene Objekt kuerzer",
    ).toBe(1);
  });

  it("G1-4 · GEGENPROBE AUTOR: der Autor sieht sein eigenes vertrauliches Objekt sehr wohl", async () => {
    const { app, autor } = await setup();
    const geheim = await vertraulichesKo(app, autor);

    // Ohne diesen Fall waere die Regel „verbirg alles Vertrauliche" — und der Alltagsweg
    // „ich erfasse etwas Sensibles und pruefe es danach" ginge zu. Die Autor-Ausnahme steht
    // ausdruecklich in `sichtbarkeit.ts:63-65`.
    const gesehen = await board(app, autor);
    expect(gesehen.map((k) => k.id)).toContain(geheim);
  });

  it("G1-5 · GEGENPROBE KURATOR: wer kuratiert, sieht es ebenfalls", async () => {
    const { app, autor, controller } = await setup();
    const geheim = await vertraulichesKo(app, autor);

    // `can(role,"ko.validate")` — die SCRUM-506-Regel. Ohne diesen Fall bewiese G1-1 nur, dass
    // irgendetwas gefiltert wird, nicht dass GENAU die richtige Regel greift.
    const gesehen = await board(app, controller);
    expect(gesehen.map((k) => k.id)).toContain(geheim);
  });
});
