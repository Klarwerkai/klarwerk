// ================================================================================================
// JOB 834 D3 — DER FEHLENDE FÜNF-ROUTEN-WÄCHTER FÜR DIE CONFLUENCE-IMPORTAKTIONEN
// ================================================================================================
//
// DER BEFUND, den BEN7 im D2-Vollurteil als tragenden Produktmangel benennt:
//
//   > „Der dauerhafte Wächter für `AB-R1` bis `AB-R5` fehlt weiterhin; die strittige Testdatei wird
//   > erneut nicht gelesen; Routenzuordnung, Kausalität, Seiteneffektfreiheit und Egress bleiben
//   > ungemessen."
//
// und als Prüflücken 1 bis 4, im Wortlaut:
//
//   1. „Für `/confluence`, `/explore`, `/select`, `/group` und `/apply` je einen unauthentifizierten
//      401-Fall, einen angemeldeten Fall ohne Recht mit 403 und einen berechtigten Positivfall
//      binden."
//   2. „Pro Route den zugehörigen `requirePermission`-Aufruf entfernen; erwartet wird, dass genau
//      der zugehörige 403-Test rot wird."
//   3. „Bei verweigertem Zugriff Datenbankwrites, Jobstart, externe Aufrufe und weitere
//      Seiteneffekte auf null prüfen."
//   4. „404 ausdrücklich als Nichtbeleg behandeln: Eine fehlende/falsch adressierte Route darf
//      keinen grünen Guardfall vortäuschen."
//
// WARUM ES DIESE DATEI BRAUCHT — nachgelesen, nicht behauptet. D1 hatte aus einem Treffer von
// `grep -rl "Recht fehlt: users.manage"` geschlossen, der vermisste Wächter existiere bereits in
// `tests/app/w2a-import-run-routes-148.test.ts`. Diese Datei ist jetzt gelesen: ihr 403-Fall
// (`:221-237`) iteriert über `START`, `LAUF`, `ERGEBNIS`, `QUELLE` — den Confluence-Start und drei
// LAUFLESErouten. `explore`, `select`, `group` und `apply` kommen darin nicht vor.
//
// **Ein gemeinsamer Fehlertext beweist keine gemeinsame Reichweite.** Genau deshalb steht hier eine
// eigene Datei neben der bestehenden, statt deren Zahl weiterzuverwenden.
//
// DIE ROUTENZUORDNUNG, die D1 und D2 schuldig geblieben sind (sie hatten die fünf
// `requirePermission`-Treffer nur GEZÄHLT): alle fünf liegen in
// `services/app/src/routes/confluence-import-routes.ts`, je einer als erste Anweisung im Handler —
// `:301` confluence, `:369` explore, `:442` select, `:594` group, `:720` apply.
//
// ZUR BEZEICHNUNG `AB-R1`–`AB-R5`: Die gebundenen Quellen führen die fünf Routen auf, ordnen ihnen
// aber keine Nummern zu. Diese Datei benutzt deshalb die Routenpfade als Namen und listet sie in der
// Reihenfolge, in der Prüflücke 1 sie nennt. Eine Nummernzuordnung wird nicht erfunden.
//
// WAS HIER AUSDRÜCKLICH NICHT ENTSCHIEDEN WIRD: ob `users.manage` für diese fünf Aktionen das
// fachlich richtige Recht ist (`E1b`, Prüflücke 5). Das ist eine Ownerfrage und in
// `00_CONTROL/ENTSCHEIDUNGEN/JOB-876.md` ausdrücklich offen gelassen. Diese Datei nagelt fest, DASS
// das heute geforderte Recht wirkt — nicht, dass es das richtige ist.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ------------------------------------------------------------------------------------------------
// DIE ENTWAFFNUNG — Prüflücke 2, ohne einen einzigen Productwrite.
// ------------------------------------------------------------------------------------------------
//
// Prüflücke 2 verlangt, den `requirePermission`-Aufruf einer Route zu ENTFERNEN und zu messen, dass
// genau deren 403-Fall rot wird. Die Routendatei ist in diesem Durchgang nicht geleast, ein Write
// dorthin wäre ein Scopeverstoss — auch ein sofort zurückgenommener.
//
// Also wird der Guard nicht im Text entfernt, sondern zur Laufzeit ENTWAFFNET: `makeGuards` liefert
// für genau eine benannte Route eine Fassung, die die ANMELDUNG weiter erzwingt, das RECHT aber
// nicht mehr prüft. Das isoliert die Rechteprüfung sauber von der Authentisierung — schärfer als ein
// ersatzloses Entfernen, bei dem auch der 401-Weg verschwände.
//
// WAS DAS IST: der Beweis, dass die 403-Antwort dieser Route aus DIESEM Guard kommt.
// WAS DAS NICHT IST: ein Beleg, dass der Aufruf im Quelltext steht. Käme die 403 anderswoher, bliebe
// sie hier stehen — und genau das würde der Fall unten aufdecken.
const zustand = vi.hoisted(() => ({ entwaffnet: undefined as string | undefined }));

vi.mock("../../services/app/src/http", async (echtesModul) => {
  const echt = await echtesModul<typeof import("../../services/app/src/http")>();
  return {
    ...echt,
    makeGuards: (auth: Parameters<typeof echt.makeGuards>[0]) => {
      const guards = echt.makeGuards(auth);
      const requirePermission: ReturnType<typeof echt.makeGuards>["requirePermission"] = async (
        recht,
        request,
        reply,
      ) => {
        if (zustand.entwaffnet !== undefined && request.url === zustand.entwaffnet) {
          return guards.requireUser(request, reply);
        }
        return guards.requirePermission(recht, request, reply);
      };
      return { requireUser: guards.requireUser, requirePermission };
    },
  };
});

const { buildApp, buildServices } = await import("../../services/app/src/build-app");

// Ohne den Schalter registriert die Kompositionswurzel die Routen gar nicht — dann antwortete jede
// Anfrage 404, und der 403-Fall prüfte die Abwesenheit einer Route statt den Rechtepfad. Genau
// dieser Fehler ist Prüflücke 4; der Schalter ist seine Vermeidung, nicht seine Umgehung.
const VORHER = process.env.KLARWERK_CONFLUENCE_IMPORT;

const ADMIN = { name: "Pedi", email: "pedi834@example.com", password: "geheim-1234" };
const OHNE_RECHT = { email: "bea834@example.com", password: "geheim-1234" };

// Die fünf Routen aus Prüflücke 1, in ihrer Reihenfolge. Alle fünf sind POST.
const ROUTEN = [
  "/api/admin/import/confluence",
  "/api/admin/import/confluence/explore",
  "/api/admin/import/confluence/select",
  "/api/admin/import/confluence/group",
  "/api/admin/import/confluence/apply",
] as const;

let app: ReturnType<typeof buildApp>;
let services: ReturnType<typeof buildServices>;
let alsAdmin: Record<string, string>;
let ohneRecht: Record<string, string>;

beforeAll(async () => {
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  services = buildServices();
  app = buildApp(services);

  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const adminLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  alsAdmin = { authorization: `Bearer ${(adminLogin.json() as { token: string }).token}` };

  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: alsAdmin,
    payload: { name: "Bea", ...OHNE_RECHT, role: "experte" },
  });
  expect(angelegt.statusCode, "die Identität ohne Recht muss anlegbar sein").toBe(201);
  const fremdLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: OHNE_RECHT,
  });
  ohneRecht = { authorization: `Bearer ${(fremdLogin.json() as { token: string }).token}` };
});

afterAll(() => {
  if (VORHER === undefined) {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  } else {
    process.env.KLARWERK_CONFLUENCE_IMPORT = VORHER;
  }
});

afterEach(() => {
  zustand.entwaffnet = undefined;
});

function post(url: string, headers?: Record<string, string>) {
  return app.inject({ method: "POST", url, ...(headers ? { headers } : {}), payload: {} });
}

// ================================================================================================
// 1 · DIE MATRIX — je Route 401, 403 und berechtigter Positivfall (Prüflücke 1)
// ================================================================================================

describe("JOB 834 D3 · Rechtematrix der fünf Confluence-Importrouten", () => {
  it.each(ROUTEN)("%s · ohne Anmeldung: 401 UNAUTHENTICATED", async (url) => {
    const antwort = await post(url);
    expect(antwort.statusCode, url).toBe(401);
    expect((antwort.json() as { error?: unknown }).error).toBe("UNAUTHENTICATED");
  });

  it.each(ROUTEN)("%s · angemeldet ohne users.manage: 403 FORBIDDEN, ohne Inhalt", async (url) => {
    const antwort = await post(url, ohneRecht);
    expect(antwort.statusCode, url).toBe(403);
    const koerper = antwort.json() as { error?: unknown; message?: unknown };
    expect(koerper.error).toBe("FORBIDDEN");
    expect(koerper.message).toBe("Recht fehlt: users.manage");
    // Kein Fachinhalt und keine Auskunft über den Bestand in der Verweigerung.
    expect(antwort.body).not.toContain("importId");
    expect(antwort.body).not.toContain("candidates");
  });

  it.each(ROUTEN)("%s · berechtigt: der Guard lässt durch — weder 401 noch 403", async (url) => {
    const antwort = await post(url, alsAdmin);
    expect([401, 403], `${url} → ${antwort.statusCode}`).not.toContain(antwort.statusCode);
    // Und ausdrücklich auch kein 404: sonst wäre der Positivfall bloss eine fehlende Route.
    expect(antwort.statusCode, `${url} darf nicht 404 sein`).not.toBe(404);
  });
});

// ================================================================================================
// 2 · 404 IST KEIN GRÜNBELEG (Prüflücke 4)
// ================================================================================================

describe("JOB 834 D3 · eine fehlende Route täuscht keinen Guard vor", () => {
  it("die falsch adressierte Nachbarroute antwortet 404 — für Berechtigte wie für Rechtlose", async () => {
    const falsch = "/api/admin/import/confluence/gibt-es-nicht";
    const mitRecht = await post(falsch, alsAdmin);
    const ohne = await post(falsch, ohneRecht);

    expect(mitRecht.statusCode, "die Nachbarroute existiert nicht").toBe(404);
    // DER PUNKT: Für die Identität OHNE Recht ist die Antwort ebenfalls 404 und NICHT 403 — es gibt
    // dort keinen Guard, weil es dort keinen Handler gibt. Ein Test, der 404 als Verweigerung läse,
    // wäre für jede nicht existierende Route grün. Genau davor warnt Prüflücke 4.
    expect(ohne.statusCode, "404 ist keine Rechteverweigerung").toBe(404);
    expect(ohne.statusCode).not.toBe(403);
  });

  it("die fünf echten Routen sind registriert — der Positivfall oben ist kein 404-Zufall", async () => {
    for (const url of ROUTEN) {
      const antwort = await post(url, alsAdmin);
      expect(antwort.statusCode, `${url} muss registriert sein`).not.toBe(404);
    }
  });
});

// ================================================================================================
// 3 · KAUSALITÄT — je Route der entwaffnete Guard (Prüflücke 2)
// ================================================================================================

describe("JOB 834 D3 · die 403 kommt aus dem Guard genau dieser Route", () => {
  it.each(ROUTEN)("%s · entwaffnet: die Verweigerung fällt weg", async (url) => {
    const scharf = await post(url, ohneRecht);
    expect(scharf.statusCode, "scharf muss die Route verweigern").toBe(403);

    zustand.entwaffnet = url;
    const entwaffnet = await post(url, ohneRecht);

    // Ohne Rechteprüfung läuft dieselbe Anfrage in den Handler. Bliebe sie 403, käme die
    // Verweigerung NICHT aus diesem Guard — und der Fall oben wäre kein Guardbeleg.
    expect(
      entwaffnet.statusCode,
      `${url} verweigert weiterhin — die 403 kommt anderswoher`,
    ).not.toBe(403);
    // Die Anmeldung bleibt scharf: entwaffnet wird das RECHT, nicht die Authentisierung.
    expect((await post(url, undefined)).statusCode, "401 bleibt").toBe(401);
  });

  it.each(ROUTEN)(
    "%s · entwaffnet: die anderen vier Routen verweigern unverändert",
    async (url) => {
      zustand.entwaffnet = url;
      for (const andere of ROUTEN.filter((r) => r !== url)) {
        const antwort = await post(andere, ohneRecht);
        expect(
          antwort.statusCode,
          `${andere} darf von der Entwaffnung von ${url} unberührt sein`,
        ).toBe(403);
      }
    },
  );
});

// ================================================================================================
// 4 · SEITENEFFEKTFREIHEIT DER VERWEIGERUNG (Prüflücke 3)
// ================================================================================================

describe("JOB 834 D3 · eine verweigerte Anfrage hinterlässt nichts", () => {
  it.each(ROUTEN)("%s · kein Auditsatz, kein Wissensobjekt, keine Kennung", async (url) => {
    const auditVorher = (await services.audit.list({})).length;
    const koVorher = (await services.ko.list({})).length;

    const antwort = await post(url, ohneRecht);
    expect(antwort.statusCode).toBe(403);

    expect(
      (await services.audit.list({})).length,
      "die Verweigerung schreibt keinen Auditsatz",
    ).toBe(auditVorher);
    expect((await services.ko.list({})).length, "die Verweigerung legt kein KO an").toBe(koVorher);
    expect(
      (antwort.json() as { importId?: unknown }).importId,
      "eine abgelehnte Anfrage vergibt keine Kennung",
    ).toBeUndefined();
  });

  it.each(ROUTEN)("%s · der externe Weg wird gar nicht erst betreten", async (url) => {
    // MESSBARER BELEG statt Behauptung: Jeder der fünf Handler ruft die Adapter-Fabrik ERST NACH
    // `requirePermission`. Ohne konfigurierten Adapter antwortet der betretene Handler deshalb 503
    // IMPORT_UNAVAILABLE beziehungsweise legt einen Lauf an — die Verweigerung antwortet 403.
    // 403 statt 503 heisst: die Anfrage ist nie bis zur Adapterfabrik gekommen.
    const verweigert = await post(url, ohneRecht);
    expect(verweigert.statusCode).toBe(403);
    expect(verweigert.statusCode, "503 hiesse: der Handler lief").not.toBe(503);

    // Die Gegenprobe, ohne die der Satz oben nichts wert wäre: MIT Recht wird der Weg betreten.
    const berechtigt = await post(url, alsAdmin);
    expect(
      berechtigt.statusCode,
      `${url}: mit Recht muss der Handler laufen (503 ohne Adapter oder 200 mit Laufdomäne)`,
    ).not.toBe(403);
  });
});
