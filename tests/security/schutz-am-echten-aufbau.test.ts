// ================================================================================================
// AUFTRAG gesamt-sicherheit-erzwingen (R-0622, R-0796, R-2057) — ZWEI SCHUTZMECHANISMEN AM ECHTEN
// AUFBAU, DIE BIS HIER NUR AN EINEM NACHGEBAUTEN GEPRÜFT WAREN.
// ================================================================================================
//
// DER BEFUND. Beide Mechanismen sind im Produkt vorhanden und haben Tests — aber keiner dieser Tests
// fällt rot, wenn die Kompositionswurzel den Schutz verliert:
//
//   · Zugriffsbremse am Login (`services/auth/src/rate-limit.test.ts`): JEDER Fall spritzt einen
//     eigenen `LoginRateLimiter` ein und baut eine eigene Fastify-Instanz. Die Vorgabe, auf die
//     `buildApp` sich verlässt (`options.loginRateLimiter ?? new LoginRateLimiter()`), war nirgends
//     gemessen. Ein späterer Aufbau, der einen durchlässigen Limiter übergibt oder die Vorgabe
//     entfernt, bliebe grün.
//   · Sitzungscookie (`tests/security/vip2-gate.test.ts` B3): am echten `buildApp` wird nur
//     `Secure` geprüft. `HttpOnly` — das, was das Cookie „gegen Auslesen im Browser schützt" —
//     stand am Passwort-Login nirgends am Draht.
//
// Deshalb hier: `buildApp(buildServices())` OHNE eingespritzte Schutzteile, gemessen am Draht.
// Jeder Fall hat eine Gegenprobe, damit er nicht nur seine eigene Annahme wiederholt.
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

const KONTO = { name: "Pedi", email: "p@x.de", password: "secret123" };

// Die Vorgabe aus `services/auth/src/rate-limit.ts` (DEFAULT_MAX_ATTEMPTS). Bewusst als Zahl hier:
// wird die Vorgabe gelockert, soll dieser Test es sagen.
const ERLAUBTE_FEHLVERSUCHE = 5;

let offen: App[] = [];

async function appMitKonto(): Promise<App> {
  const app = buildApp(buildServices());
  offen.push(app);
  const angelegt = await app.inject({ method: "POST", url: "/api/auth/register", payload: KONTO });
  expect(angelegt.statusCode, `Registrierung: ${angelegt.body}`).toBe(201);
  return app;
}

function login(app: App, email: string, password: string) {
  return app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
}

function cookieTeile(setCookie: string | string[] | undefined): string[] {
  const wert = Array.isArray(setCookie) ? setCookie.join(", ") : String(setCookie ?? "");
  return wert.split(";").map((teil) => teil.trim());
}

afterEach(async () => {
  for (const app of offen) {
    await app.close();
  }
  offen = [];
});

describe("R-0796 · die Zugriffsbremse am Login wirkt im echten Aufbau, ohne eingespritzten Limiter", () => {
  it(`nach ${ERLAUBTE_FEHLVERSUCHE} Fehlversuchen → 429 + Retry-After, auch mit richtigem Kennwort`, async () => {
    const app = await appMitKonto();

    for (let i = 0; i < ERLAUBTE_FEHLVERSUCHE; i += 1) {
      const res = await login(app, KONTO.email, "falsch-123");
      expect(res.statusCode, `Versuch ${i + 1}: ${res.body}`).toBe(401);
    }

    const gesperrt = await login(app, KONTO.email, "falsch-123");
    expect(gesperrt.statusCode, `Ohne Bremse kein 429. Antwort: ${gesperrt.body}`).toBe(429);
    expect((gesperrt.json() as { error: string }).error).toBe("RATE_LIMITED");
    expect(Number(gesperrt.headers["retry-after"])).toBeGreaterThan(0);
    expect(gesperrt.body).not.toContain(KONTO.email);

    // Die Sperre hält auch gegen das richtige Kennwort — sonst wäre Raten nur verlangsamt.
    const richtig = await login(app, KONTO.email, KONTO.password);
    expect(richtig.statusCode).toBe(429);
    expect(richtig.headers["set-cookie"]).toBeUndefined();
  });

  it("Gegenprobe: die Sperre trifft das geratene Konto, nicht jeden Aufruf derselben Quelle", async () => {
    const app = await appMitKonto();
    for (let i = 0; i <= ERLAUBTE_FEHLVERSUCHE; i += 1) {
      await login(app, KONTO.email, "falsch-123");
    }
    expect((await login(app, KONTO.email, "falsch-123")).statusCode).toBe(429);

    // Eine andere Login-ID derselben IP bekommt die normale Fehlersemantik — die 429 oben stammt
    // also aus der Bremse und nicht aus einem allgemeinen Fehlerzustand der Instanz.
    expect((await login(app, "jemand-anders@x.de", "falsch-123")).statusCode).toBe(401);
  });

  it("Gegenprobe: ein richtiger Login unter der Schwelle bleibt möglich und setzt den Zähler zurück", async () => {
    const app = await appMitKonto();
    for (let i = 0; i < ERLAUBTE_FEHLVERSUCHE - 1; i += 1) {
      expect((await login(app, KONTO.email, "falsch-123")).statusCode).toBe(401);
    }
    expect((await login(app, KONTO.email, KONTO.password)).statusCode).toBe(200);
    for (let i = 0; i < ERLAUBTE_FEHLVERSUCHE; i += 1) {
      expect((await login(app, KONTO.email, "falsch-123")).statusCode).toBe(401);
    }
  });
});

describe("R-0622 / R-2057 · das Sitzungscookie ist am echten Login gegen Auslesen im Browser geschützt", () => {
  it("Login setzt kw_session mit HttpOnly, SameSite=Lax und Path=/", async () => {
    const app = await appMitKonto();
    const res = await login(app, KONTO.email, KONTO.password);
    expect(res.statusCode).toBe(200);

    const teile = cookieTeile(res.headers["set-cookie"]);
    expect(teile[0], `Set-Cookie: ${teile.join("; ")}`).toMatch(/^kw_session=\S+/);
    expect(teile, `Set-Cookie: ${teile.join("; ")}`).toContain("HttpOnly");
    expect(teile).toContain("SameSite=Lax");
    expect(teile).toContain("Path=/");
  });

  it("Gegenprobe: das Cookie trägt eine echte Sitzung — /api/auth/me erkennt es, ohne Cookie nicht", async () => {
    const app = await appMitKonto();
    const res = await login(app, KONTO.email, KONTO.password);
    const keks = cookieTeile(res.headers["set-cookie"])[0] ?? "";

    const mit = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: keks },
    });
    expect(mit.statusCode, `Mit Cookie: ${mit.body}`).toBe(200);
    expect((mit.json() as { email: string }).email).toBe(KONTO.email);

    const ohne = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(ohne.statusCode).toBe(401);
  });

  it("auch das Löschen beim Abmelden bleibt HttpOnly", async () => {
    const app = await appMitKonto();
    const res = await login(app, KONTO.email, KONTO.password);
    const keks = cookieTeile(res.headers["set-cookie"])[0] ?? "";

    const ab = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: keks },
    });
    expect(ab.statusCode).toBe(204);
    const teile = cookieTeile(ab.headers["set-cookie"]);
    expect(teile[0]).toBe("kw_session=");
    expect(teile).toContain("HttpOnly");
    expect(teile).toContain("Max-Age=0");
  });
});
