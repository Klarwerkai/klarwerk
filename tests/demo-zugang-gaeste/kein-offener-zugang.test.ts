// ================================================================================================
// JOB 3656 · DEMO-ZUGANG-GAESTE — „KEIN OFFENER ZUGANG", an der ROUTE nachgewiesen.
// ================================================================================================
//
// WOHER DIESE DATEI KOMMT. Aus Messvorschrift (e) des Auftrags, wörtlich:
//
//   „Gegenprobe: es gibt keinen Aufruf, der ohne angemeldetes Konto Demoinhalte liefert — weise das
//    an der Route nach, nicht an der Flaeche."
//
// WARUM SIE KEIN ZWEITER WEG NEBEN DEM VORHANDENEN IST. Der Hausbestand deckt die Nachbarfragen,
// aber nicht diese:
//   · `tests/security/route-guard-audit.test.ts` vergleicht die Schutzart JE ROUTE gegen
//     `ROUTE_GUARD_MATRIX` und verlangt für jede öffentliche Route eine Begründung. Es beantwortet
//     „trägt diese Route das erwartete Recht?" — nicht „tritt geladener Demobestand irgendwo ohne
//     Anmeldung nach außen?". Eine NEUE öffentliche Route mit Begründung bliebe dort grün.
//   · `tests/security/g26-matrix-laufzeit.test.ts` misst drei rollenimplizite Lesewege am Draht,
//     aber gegen ein VERTRAULICHES Objekt und mit angemeldeten Identitäten. Der unangemeldete
//     Aufruf gegen den DEMObestand kommt dort nicht vor.
// Diese Datei leiht sich deshalb beide Werkzeuge, statt eigene zu bauen: den Routenscanner aus
// `routeGuardAudit.ts` (kein zweiter Scanner) und die echte Komposition `buildApp(buildServices())`
// mit `app.inject` wie g26 (kein zweiter Aufbau).
//
// WAS SIE NICHT BEHAUPTET. Dieser Job hat weder eine Gastrolle noch ein Gastkonto gebaut — die
// dafür nötigen Produktdateien liegen ausserhalb seiner Zielpfade (siehe RUECKGABE.md). Gemessen
// wird hier ausschliesslich Lieferpunkt 4: dass es keinen unangemeldeten Weg an Demoinhalte gibt,
// und wo die EINE verbleibende öffentliche Tür sitzt (D3 — die Ersteinrichtung einer leeren
// Instanz, die JOB 3655 gerade zum Normalfall gemacht hat).
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { scanAllRoutes } from "../security/routeGuardAudit";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const ADMIN = { name: "Demo-Admin", email: "admin@job3656.test", password: "geheim12345" };

/** Eine Antwort gilt als Ablehnung, wenn sie abweist UND nichts vom Bestand mitgibt. */
function istAblehnung(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

/**
 * Die echte Komposition mit Bootstrap-Admin (erstes Konto = Admin, `service.ts:172`) und
 * GELADENEM Demobestand. Die Instanz ist davor leer — nach dem Seed ist deshalb JEDER vorhandene
 * Titel ein Demoinhalt, und genau diese Titel sind unten die Suchmuster.
 */
async function aufbauMitDemobestand(): Promise<{
  app: App;
  admin: Auth;
  demoTitel: string[];
  geladen: number;
}> {
  const app = buildApp(buildServices());
  const angelegt = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  if (angelegt.statusCode !== 201) {
    throw new Error(`Bootstrap-Admin nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
  }
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  if (anmeldung.statusCode !== 200) {
    throw new Error(`Bootstrap-Admin nicht angemeldet: ${anmeldung.statusCode} ${anmeldung.body}`);
  }
  const admin: Auth = { authorization: `Bearer ${anmeldung.json().token}` };

  const seed = await app.inject({
    method: "POST",
    url: "/api/admin/demo-seed",
    headers: admin,
    payload: { force: true, locale: "de" },
  });
  if (seed.statusCode !== 200) {
    throw new Error(`Demo-Seed fehlgeschlagen: ${seed.statusCode} ${seed.body}`);
  }

  const bestand = await app.inject({ method: "GET", url: "/api/kos", headers: admin });
  if (bestand.statusCode !== 200) {
    throw new Error(`Bestand nicht lesbar: ${bestand.statusCode} ${bestand.body}`);
  }
  const rohe: unknown = bestand.json();
  const zeilen: { title?: unknown }[] = Array.isArray(rohe)
    ? rohe
    : ((rohe as { items?: { title?: unknown }[] }).items ?? []);
  // Lange, unterscheidbare Titel: ein Wort wie „Technik" stünde auch in einem Sprachstring und
  // würde einen Fehlalarm erzeugen. Die Titel kommen aus dem LAUF, nicht aus einer Fixture.
  const demoTitel = zeilen
    .map((z) => (typeof z.title === "string" ? z.title : ""))
    .filter((t) => t.length >= 12)
    .slice(0, 12);

  return { app, admin, demoTitel, geladen: zeilen.length };
}

/** Platzhalter in einer gescannten URL mit echten Werten besetzen — sonst misst der Aufruf nichts. */
function urlBesetzen(url: string, demoId: string): string {
  return url
    .replace(":locale", "de")
    .replace(":lang", "de")
    .replace(":key", "app.title")
    .replace(/:[A-Za-z]+/g, demoId);
}

describe("JOB 3656 · D1 · Demoinhalte sind im Quelltext nie öffentlich", () => {
  it("D1 · jede Route, die Demobestand liefert oder ändert, trägt `users.manage`", () => {
    const demoRouten = scanAllRoutes().filter((r) => r.url.includes("demo"));
    // KALIBRIERUNG: ohne Treffer würde der Test unten nichts prüfen und wäre trivial grün.
    expect(
      demoRouten.length,
      "der Scanner findet keine Demo-Routen — Filter oder Pfade kaputt",
    ).toBeGreaterThanOrEqual(8);
    for (const route of demoRouten) {
      expect(
        route.protection,
        `${route.method} ${route.url} (${route.file}) ist nicht admin-geschützt`,
      ).toBe("users.manage");
    }
  });
});

describe("JOB 3656 · D2 · geladener Demobestand tritt durch KEINE öffentliche Route nach außen", () => {
  let umgebung: Awaited<ReturnType<typeof aufbauMitDemobestand>>;

  beforeAll(async () => {
    umgebung = await aufbauMitDemobestand();
  });

  it("D2a · KALIBRIERUNG: es liegt wirklich Demobestand mit unterscheidbaren Titeln da", () => {
    expect(
      umgebung.geladen,
      "kein Bestand geladen — D2b/D2c könnten nichts lecken",
    ).toBeGreaterThan(0);
    expect(
      umgebung.demoTitel.length,
      "keine ausreichend langen Titel — die Suchmuster unten wären leer",
    ).toBeGreaterThan(0);
  });

  it("D2b · jede öffentliche GET-Route ohne Anmeldung: kein Demotitel im Rumpf", async () => {
    const { app, demoTitel } = umgebung;
    const demoId = "id-das-es-nicht-gibt";
    const oeffentlich = scanAllRoutes().filter(
      (r) => r.protection === "public" && r.method === "GET",
    );
    // KALIBRIERUNG: die öffentliche Fläche ist nicht leer (sonst prüft die Schleife nichts).
    expect(oeffentlich.length, "keine öffentlichen GET-Routen gefunden").toBeGreaterThanOrEqual(5);

    for (const route of oeffentlich) {
      const url = urlBesetzen(route.url, demoId);
      const antwort = await app.inject({ method: "GET", url });
      for (const titel of demoTitel) {
        expect(
          antwort.body,
          `${route.method} ${url} (${route.file}) gibt ohne Anmeldung den Demotitel „${titel}" heraus`,
        ).not.toContain(titel);
      }
    }
  });

  it("D2c · die Demo-Routen selbst ohne Anmeldung: Ablehnung, kein Inhalt, und der Bestand bleibt", async () => {
    const { app, admin, demoTitel } = umgebung;
    const wege = [
      { method: "GET" as const, url: "/api/admin/demo-seed" },
      { method: "POST" as const, url: "/api/admin/demo-seed" },
      { method: "DELETE" as const, url: "/api/admin/demo-seed" },
      { method: "GET" as const, url: "/api/admin/demo-packages" },
    ];
    for (const weg of wege) {
      const antwort = await app.inject({ method: weg.method, url: weg.url, payload: {} });
      expect(
        istAblehnung(antwort.statusCode),
        `${weg.method} ${weg.url}: unerwarteter Status ${antwort.statusCode}`,
      ).toBe(true);
      for (const titel of demoTitel) {
        expect(
          antwort.body,
          `${weg.method} ${weg.url} trägt den Demotitel „${titel}" in der Ablehnung`,
        ).not.toContain(titel);
      }
    }
    // Der unangemeldete DELETE darf nicht nur abgewiesen sein, er darf auch nichts getan haben.
    const stand = await app.inject({ method: "GET", url: "/api/admin/demo-seed", headers: admin });
    expect(stand.statusCode).toBe(200);
    expect(stand.json().present, "der unangemeldete DELETE hat den Demobestand entfernt").toBe(
      true,
    );
  });

  it("D2d · KALIBRIERUNG: mit `users.manage` liefert derselbe Weg den Stand — sonst wäre D2c trivial", async () => {
    const { app, admin } = umgebung;
    const stand = await app.inject({ method: "GET", url: "/api/admin/demo-seed", headers: admin });
    expect(stand.statusCode).toBe(200);
    expect(stand.json().count, "der Admin sieht keinen Demobestand").toBeGreaterThan(0);
  });
});

describe("JOB 3656 · D3 · die öffentliche Kontotür ist genau so lange offen, wie die Instanz leer ist", () => {
  // DER BEFUND, ehrlich benannt statt verschwiegen: `needsSetup()` und der Bootstrap-Zweig der
  // Registrierung hängen BEIDE an `users.count() === 0` (`service.ts:141`, `:172`). Auf einer leeren
  // Instanz — also genau dem Startzustand, den JOB 3655 zum Normalfall gemacht hat — macht der
  // ERSTE unangemeldete Aufruf seinen Urheber zum freigegebenen Admin. Danach ist die Tür dauerhaft
  // zu. Dieser Test pinnt BEIDE Hälften: dass sie zugeht (D3b/D3c) und dass sie vorher offen war
  // (D3a) — ohne D3a wäre D3b auch von einer Instanz erfüllt, in der gar nichts registrierbar ist.
  it("D3a · leere Instanz: die Ersteinrichtung steht ohne Anmeldung offen", async () => {
    const app = buildApp(buildServices());
    const status = await app.inject({ method: "GET", url: "/api/auth/status" });
    expect(status.statusCode).toBe(200);
    expect(status.json().needsSetup, "eine frische Instanz meldet keinen Einrichtungsbedarf").toBe(
      true,
    );

    const setup = await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
    expect(setup.statusCode, `Ersteinrichtung fehlgeschlagen: ${setup.body}`).toBe(201);
    expect(setup.json().user.role, "die Ersteinrichtung legt keinen Admin an").toBe("admin");
  });

  it("D3b · danach ist die Ersteinrichtung dauerhaft zu", async () => {
    const app = buildApp(buildServices());
    await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });

    const status = await app.inject({ method: "GET", url: "/api/auth/status" });
    expect(status.json().needsSetup, "die Instanz meldet weiter Einrichtungsbedarf").toBe(false);

    const zweiter = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { name: "Fremder", email: "fremd@job3656.test", password: "geheim12345" },
    });
    expect(zweiter.statusCode, "eine zweite Ersteinrichtung ging durch").toBe(409);
    expect(zweiter.json().error).toBe("ALREADY_SETUP");
  });

  it("D3c · Selbstregistrierung ist danach kein Zugang: Konto ja, Anmeldung nein", async () => {
    const app = buildApp(buildServices());
    await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Gast ohne Abnahme", email: "gast@job3656.test", password: "geheim12345" },
    });
    expect(angelegt.statusCode, `Registrierung unerwartet: ${angelegt.body}`).toBe(201);
    expect(angelegt.json().approved, "ein selbstregistriertes Konto ist freigegeben").toBe(false);

    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "gast@job3656.test", password: "geheim12345" },
    });
    expect(
      istAblehnung(anmeldung.statusCode),
      `ein selbstregistriertes Konto kam herein: ${anmeldung.statusCode} ${anmeldung.body}`,
    ).toBe(true);
    expect(anmeldung.json().error).toBe("NOT_APPROVED");
  });

  it("D3d · und ein so entstandenes Konto sieht auch ohne Anmeldung keinen Demobestand", async () => {
    const { app, demoTitel } = await aufbauMitDemobestand();
    const antwort = await app.inject({ method: "GET", url: "/api/kos" });
    expect(
      istAblehnung(antwort.statusCode),
      `GET /api/kos ohne Anmeldung: ${antwort.statusCode}`,
    ).toBe(true);
    for (const titel of demoTitel) {
      expect(antwort.body, `GET /api/kos gibt unangemeldet „${titel}" heraus`).not.toContain(titel);
    }
  });
});
