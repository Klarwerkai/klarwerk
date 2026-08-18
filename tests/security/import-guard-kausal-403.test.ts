// ================================================================================================
// JOB 832 · D2 — DER KAUSALE 403 AN DER RECHTEGRENZE DES CONFLUENCE-IMPORTS.
// ================================================================================================
//
// DER BEFUND, den BEN zu D1 bestätigt hat (BEN-PRUEFUNG-JOB-832-D1.md): Die statische Abdeckung
// ist vollständig — `tests/security/routeGuardAudit.ts` führt alle Routen mit
// `{ protection: "users.manage" }`, und `route-guard-audit.test.ts` hält das fest. Aber dieser
// Sammler ist ausdrücklich „reine Daten + ein dateibasierter Scanner — kein laufender Server".
// Er belegt, dass `requirePermission("users.manage", …)` DASTEHT. Er belegt nicht, dass es bei
// einer echten, angemeldeten Identität ohne dieses Recht auch WIRKT.
//
// Genau diese Lücke schließt diese Datei — laufend, nicht lesend.
//
// WARUM DIE UNTERSCHEIDUNG 401/403 DER GANZE PUNKT IST: Ein Test, der 401 misst und 403 zu messen
// glaubt, belegt die ANMELDUNG, nicht die Rechteprüfung. Würde später jemand das verlangte Recht
// verwässern, bliebe so ein Test grün. Der Bestand hat genau diesen Fehler zweimal:
//   · `confluence-import-routes.test.ts:92` prüft `toBeGreaterThanOrEqual(400)` und sagt im
//     eigenen Kommentar, dass er nicht weiß, welches Tor er trifft („401 unbestätigt / 403 kein
//     users.manage"); seine Testperson ist mangels Freigabe wahrscheinlich gar nicht aktiv.
//   · derselbe Datei-Fall `:212` trägt „ohne users.manage" im TITEL und prüft `401`.
//
// DESHALB IST P1.3 (die Anmeldekontrolle) KEIN BEIWERK: Erst der Nachweis, dass derselbe Token an
// einer `ko.read`-Route ein 2xx bekommt, macht aus „irgendeine Ablehnung" den Beleg „am Rechtetor
// abgewiesen".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";

// ------------------------------------------------------------------------------------------------
// Die sechs rechtegeschützten Routen. Fünf hinter dem Import-Schalter, eine davor.
// ------------------------------------------------------------------------------------------------

/** Die fünf Confluence-Flussrouten (alle POST, alle schemafrei). */
const FLUSS = [
  "/api/admin/import/confluence",
  "/api/admin/import/confluence/explore",
  "/api/admin/import/confluence/select",
  "/api/admin/import/confluence/group",
  "/api/admin/import/confluence/apply",
] as const;

/**
 * Die sechste Route. Sie ist BEWUSST außerhalb des `confluenceImport`-Schalters registriert
 * (import-access-routes.ts:11-17: „Läge DIESE Route hinter demselben Schalter, könnte sie den
 * einen Zustand nicht melden, für den sie gebaut ist: ausgeschaltet"). Sie trägt denselben Guard
 * mit derselben Begründung (`:41-44`) und ist GET statt POST.
 */
const ZUGANG = "/api/import/confluence/zugang";

/**
 * Eine Route, die nur `ko.read` verlangt — die Rolle `experte` trägt das (policy.ts).
 * Bewusst `/api/upload-limits`: sie antwortet auch auf einem frisch gebauten Bestand mit einem
 * Vorgabewert und kann deshalb nicht aus Datenmangel etwas anderes als 200 liefern.
 */
const NUR_LESEN = "/api/upload-limits";

const ADMIN = { name: "Pedi", email: "pedi832@example.com", password: "geheim-1234" };
const OHNE = { name: "Bea", email: "bea832@example.com", password: "geheim-1234", role: "experte" };

const FLAG = "KLARWERK_CONFLUENCE_IMPORT";
const FLAG_VORHER = process.env[FLAG];

afterEach(() => {
  if (FLAG_VORHER === undefined) {
    delete process.env[FLAG];
  } else {
    process.env[FLAG] = FLAG_VORHER;
  }
});

/**
 * Die ECHTE Komposition mit gesetztem Import-Schalter.
 *
 * Ohne ihn sind die fünf Flussrouten NICHT REGISTRIERT (build-app.ts: `if
 * (schalterAn("confluenceImport"))`) und der Server antwortete 404 — der 403-Fall prüfte dann nur,
 * dass es die Route nicht gibt. Genau das ist N1.2.
 */
function appMitFlag() {
  process.env[FLAG] = "1";
  const services = buildServices();
  const app = buildApp(services);
  return { app, services };
}

/** Der Bootstrap-Admin über die echten Auth-Routen. */
async function admin(app: ReturnType<typeof buildApp>) {
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  const token = (login.json() as { token: string }).token;
  expect(token, "der Bootstrap-Admin muss ein Token bekommen").not.toBe("");
  return { authorization: `Bearer ${token}` };
}

/**
 * Eine zweite Identität OHNE `users.manage` — angelegt über die echte Adminroute, damit sie
 * FREIGEGEBEN ist. Das ist der Unterschied zum Bestandsfall: dort wird die Person nur registriert
 * und bleibt bis zur Admin-Freigabe inaktiv, weshalb dessen Ablehnung wahrscheinlich das
 * Anmeldetor trifft. Die `201`-Prüfung ist Teil der Zusage, nicht Beiwerk.
 */
async function ohneRecht(app: ReturnType<typeof buildApp>, adminKopf: Record<string, string>) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: adminKopf,
    payload: OHNE,
  });
  expect(angelegt.statusCode, "die zweite Identität muss angelegt werden können").toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: OHNE.email, password: OHNE.password },
  });
  const token = (login.json() as { token: string }).token;
  expect(token, "die Identität ohne Recht muss ein Token bekommen").not.toBe("");
  return { authorization: `Bearer ${token}` };
}

/** Ein Aufruf auf einer der sechs Routen — GET für die Zugangsroute, sonst POST. */
function ruf(app: ReturnType<typeof buildApp>, url: string, kopf: Record<string, string>) {
  return url === ZUGANG
    ? app.inject({ method: "GET", url, headers: kopf })
    : app.inject({ method: "POST", url, headers: kopf, payload: {} });
}

describe("JOB 832 · Z1 — jede rechtegeschützte Import-Route weist ohne `users.manage` mit 403 ab", () => {
  it("P1.3 · die Identität ist nachweislich ANGEMELDET — sonst bleibt jede Ablehnung zweideutig", async () => {
    const { app } = appMitFlag();
    const fremd = await ohneRecht(app, await admin(app));

    // Derselbe Token an einer Route, die nur `ko.read` verlangt: kommt hier ein 2xx, ist die
    // Person authentisiert — und ein 403 weiter unten kann nicht am Anmeldetor entstanden sein.
    const lesend = await app.inject({ method: "GET", url: NUR_LESEN, headers: fremd });
    expect(lesend.statusCode, `GET ${NUR_LESEN} mit der Identität ohne users.manage`).toBe(200);

    // Und die Gegenrichtung: ohne Token verweigert dieselbe Route mit 401. Damit ist belegt, dass
    // die 200 oben wirklich am Token hängt und nicht an einer offenen Route.
    const ohneToken = await app.inject({ method: "GET", url: NUR_LESEN });
    expect(ohneToken.statusCode, `GET ${NUR_LESEN} ohne Token`).toBe(401);
  });

  it("P1.1 · alle fünf Flussrouten: exakt 403 mit exaktem Körper", async () => {
    const { app } = appMitFlag();
    const fremd = await ohneRecht(app, await admin(app));

    for (const url of FLUSS) {
      const antwort = await ruf(app, url, fremd);
      expect(antwort.statusCode, `POST ${url}`).toBe(403);
      const koerper = antwort.json() as { error?: unknown; message?: unknown };
      expect(koerper.error, `POST ${url} · error`).toBe("FORBIDDEN");
      expect(koerper.message, `POST ${url} · message`).toBe("Recht fehlt: users.manage");
    }
  });

  it("P1.2 · die sechste Route (GET, ohne Schaltermanipulation erreichbar) ebenso", async () => {
    // Diese Route ist unbedingt registriert — der Schalter wird hier bewusst NICHT gesetzt.
    delete process.env[FLAG];
    const services = buildServices();
    const app = buildApp(services);
    const fremd = await ohneRecht(app, await admin(app));

    const antwort = await ruf(app, ZUGANG, fremd);
    expect(antwort.statusCode, `GET ${ZUGANG} ohne gesetzten Import-Schalter`).toBe(403);
    const koerper = antwort.json() as { error?: unknown; message?: unknown };
    expect(koerper.error).toBe("FORBIDDEN");
    expect(koerper.message).toBe("Recht fehlt: users.manage");
  });

  it("N1.1/N1.2 · weder 401 noch 404 — das Rechtetor, nicht das Anmelde- oder Routingtor", async () => {
    const { app } = appMitFlag();
    const fremd = await ohneRecht(app, await admin(app));

    for (const url of [...FLUSS, ZUGANG]) {
      const antwort = await ruf(app, url, fremd);
      // N1.1: 401 hieße, die Person wäre gar nicht angemeldet (der Bestandsfehler).
      expect(antwort.statusCode, `${url} darf nicht 401 sein`).not.toBe(401);
      // N1.2: 404 hieße, die Route ist nicht registriert — dann prüfte der Fall nichts.
      expect(antwort.statusCode, `${url} darf nicht 404 sein`).not.toBe(404);
      // N1.3: die Zusage ist eine Zahl, kein Bereich.
      expect(antwort.statusCode, `${url} ist exakt 403`).toBe(403);
    }
  });

  it("ohne Anmeldung antwortet dieselbe Route 401 — die beiden Tore sind unterscheidbar", async () => {
    // Die Gegenrichtung zu N1.1: der Vertrag aus http.ts trennt 401/UNAUTHENTICATED von
    // 403/FORBIDDEN. Ohne diesen Fall wäre nicht belegt, dass die Trennung überhaupt greift.
    const { app } = appMitFlag();
    const antwort = await ruf(app, FLUSS[0], {});
    expect(antwort.statusCode).toBe(401);
    expect((antwort.json() as { error?: unknown }).error).toBe("UNAUTHENTICATED");
  });
});

describe("JOB 832 · Z2 — der Guard urteilt VOR jedem Seiteneffekt", () => {
  /**
   * Weg B: direkte Registrierung mit Spitzeln auf den beiden Effektquellen.
   *
   * Der Schalter bleibt AUS — sonst registrierte `buildApp` dieselben Pfade ein zweites Mal.
   * Muster aus dem Bestand: `tests/app/import-group-routes.test.ts`.
   */
  function appMitSpitzeln() {
    delete process.env[FLAG];
    const services = buildServices();
    const app = buildApp(services);
    const zaehler = { adapter: 0, modell: 0 };
    const adapter = {
      source: "Confluence",
      collect: async () => [],
      collectAll: async () => ({ items: [], failed: [], truncated: false }),
    } as unknown as ConfluenceSourceAdapter;
    app.register(
      confluenceImportRoutes({
        library: services.library,
        koService: services.ko,
        guards: makeGuards(services.auth),
        reasoner: services.reasoner,
        makeAdapter: () => {
          zaehler.adapter += 1;
          return adapter;
        },
      }),
    );
    return { app, services, zaehler };
  }

  it("P2.1 · im 403-Fall wird die Quellsystem-Fabrik auf KEINER der fünf Routen angefasst", async () => {
    const { app, zaehler } = appMitSpitzeln();
    const fremd = await ohneRecht(app, await admin(app));

    for (const url of FLUSS) {
      zaehler.adapter = 0;
      const antwort = await app.inject({ method: "POST", url, headers: fremd, payload: {} });
      expect(antwort.statusCode, `POST ${url}`).toBe(403);
      // Der Zähler wird unmittelbar vor und nach DIESEM Aufruf gelesen — nicht am Testende,
      // sonst zählte ein späterer Positivlauf mit.
      expect(zaehler.adapter, `POST ${url} darf keinen Adapter bauen`).toBe(0);
    }
  });

  it("P2.2 · Positivkontrolle: MIT Recht steigt derselbe Zähler — sonst wäre die Null wertlos", async () => {
    // Ohne diesen Fall belegt `toBe(0)` nur, dass der Spitzel nie verdrahtet war. Das ist die
    // wichtigste Gegenprobe des ganzen Vertrags.
    const { app, zaehler } = appMitSpitzeln();
    const adminKopf = await admin(app);

    zaehler.adapter = 0;
    const antwort = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/explore",
      headers: adminKopf,
      payload: {},
    });
    expect(antwort.statusCode, "mit users.manage ist es kein 403").not.toBe(403);
    expect(zaehler.adapter, "mit Recht MUSS die Fabrik laufen").toBeGreaterThan(0);
  });

  it("P2.3 · im 403-Fall entsteht kein Kandidat — Bestandszahl vorher == nachher", async () => {
    // `/apply` ist die einzige der sechs Routen, die überhaupt schreibt
    // (confluence-import-routes.ts: `library.createImportCandidates`).
    const { app, services, zaehler } = appMitSpitzeln();
    const fremd = await ohneRecht(app, await admin(app));

    const vorher = (await services.library.listImportCandidates()).length;
    zaehler.adapter = 0;
    const antwort = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/apply",
      headers: fremd,
      payload: { includeIds: ["egal"] },
    });
    expect(antwort.statusCode).toBe(403);
    const nachher = (await services.library.listImportCandidates()).length;
    expect(`kandidaten=${nachher}`).toBe(`kandidaten=${vorher}`);
    expect(zaehler.adapter).toBe(0);
  });
});

describe("JOB 832 · Z3 — ein Testname behauptet kein Tor, das sein Assert nicht prüft", () => {
  const BESTAND = join(__dirname, "../../services/app/src/routes/confluence-import-routes.test.ts");

  /**
   * Alle `it("…")`-Fälle einer Datei mit ihrem Rumpf — OHNE Kommentarzeilen.
   *
   * Die Bereinigung ist nicht kosmetisch: ohne sie schlägt der Wächter auf jede Erklärung an, die
   * eine Zusicherung bloß ZITIERT (etwa den Hinweis, dass hier früher ein Bereich stand). Ein
   * Wächter, der auf Fließtext anspringt, ist unbrauchbar — er zwänge dazu, den Befund nicht mehr
   * zu beschreiben.
   */
  function faelle(datei: string): { titel: string; rumpf: string }[] {
    const text = readFileSync(datei, "utf8");
    const teile = text.split(/\n {2}it\(/).slice(1);
    return teile.map((teil) => {
      const titel = /^"([^"]*)"/.exec(teil)?.[1] ?? "";
      const rumpf = teil
        .split("\n")
        .filter((zeile) => !/^\s*(\/\/|\*|\/\*)/.test(zeile))
        .join("\n");
      return { titel, rumpf };
    });
  }

  it("kein Fall trägt `users.manage` im Titel und prüft dabei 401", () => {
    // Der Bestandsfall `:212` hieß „Guard-Pfad (ohne users.manage)" und prüfte
    // `toBe(401)`/`UNAUTHENTICATED`. Der Fall selbst ist richtig — er prüft die Doppelsendung, und
    // dafür genügt jedes Guardurteil. Sein TITEL war es nicht: wer die Testliste überfliegt, hält
    // das Rechtetor für abgedeckt.
    const irrefuehrend = faelle(BESTAND)
      .filter((f) => /users\.manage|ohne Recht/i.test(f.titel))
      .filter((f) => /toBe\(401\)|UNAUTHENTICATED/.test(f.rumpf))
      .map((f) => f.titel);
    expect(irrefuehrend).toEqual([]);
  });

  it("kein Fall an dieser Rechtegrenze prüft nur einen Bereich `>= 400`", () => {
    // Der Fall `:65` hieß „Flag ON, Nicht-Admin → abgelehnt (kein Import-Zugang)" und prüfte
    // `toBeGreaterThanOrEqual(400)`. „Nicht-Admin" liest sich wie eine Rechteaussage, gemessen ist
    // es aber das Anmeldetor (401, weil die Person nicht freigegeben ist). Ein Bereich hätte beides
    // verdeckt — deshalb greift dieser Wächter über ALLE Fälle der Datei, nicht nur über die mit
    // verräterischem Titel.
    const unscharf = faelle(BESTAND)
      .filter((f) => /toBeGreaterThanOrEqual\(400\)/.test(f.rumpf))
      .map((f) => f.titel);
    expect(unscharf).toEqual([]);
  });
});

describe("JOB 832 · Auflage 1/2 — die Restmenge, ehrlich gebucht", () => {
  it("R1 war bereits vor diesem Durchgang exakt belegt — hier kommt nur der Seiteneffektrest dazu", () => {
    // BENs Auflage 1: START/R1 korrekt als VORHANDENEN exakten 403-Beleg führen. Der Beleg liegt
    // in `tests/app/w2a-import-run-routes-148.test.ts` und prüft dort 403/FORBIDDEN/
    // „Recht fehlt: users.manage" samt Seiteneffektprobe „ein abgelehnter POST legt keinen Lauf an".
    // Dieser Fall hält fest, dass er existiert — verschwindet er, ist die Buchung falsch.
    const r1 = readFileSync(join(__dirname, "../app/w2a-import-run-routes-148.test.ts"), "utf8");
    expect(r1).toContain('expect(koerper.message).toBe("Recht fehlt: users.manage")');
    expect(r1).toContain("der Negativpfad ist seiteneffektfrei");
  });

  it("die sechs Routen dieses Vertrags sind genau die, die der statische Sammler schützt", () => {
    // Die Brücke zwischen statischer und kausaler Abdeckung: was `routeGuardAudit.ts` als
    // `users.manage` führt, muss hier auch laufend belegt sein. Wächst die eine Seite, fällt es auf.
    const audit = readFileSync(join(__dirname, "routeGuardAudit.ts"), "utf8");
    for (const url of [...FLUSS, ZUGANG]) {
      expect(`${url}=${audit.includes(url)}`).toBe(`${url}=true`);
    }
  });
});
