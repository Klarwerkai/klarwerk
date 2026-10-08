// ================================================================================================
// R-0550 · DER RECHTEENTZUG GEGEN DIE KOPIE, DIE SCHON IM BROWSER LIEGT — IM ECHTEN CHROMIUM.
// ================================================================================================
//
// WAS FEHLTE (Ben, Nacharbeit 2): `w-anhang-cachevertrag.test.ts` und `job605-anhang-widerruf-
// inprocess.test.ts` belegen Status und Kopfzeilen am Draht (`app.inject`). Ob ein ECHTER Browser
// eine bereits gespeicherte Antwort nach dem Entzug wiederverwendet, sagen sie nicht — job605 nimmt
// den Browser ausdrücklich aus (Zeile 30).
//
// DESHALB HIER KEIN ABFANGEN. Die h4-Vorrichtung bedient jede Anfrage über `seite.route`; Playwright
// schaltet damit den HTTP-Cache des Browsers ab — genau das, was hier gemessen werden soll. Diese
// Datei lässt stattdessen die echte App (`buildApp`, echte Dienste) auf `127.0.0.1` lauschen, und
// Chromium spricht sie über echtes HTTP an, angemeldet mit dem echten Sitzungs-Cookie `kw_session`
// (`http.ts:8`) — dem Weg, den die Oberfläche im Betrieb nimmt.
//
// WIE „WIEDERVERWENDET" GEMESSEN WIRD: am SERVER, nicht am Browser. Ein `onRequest`-Haken zählt jede
// Anfrage, die tatsächlich ankommt. Bedient Chromium aus seinem Zwischenspeicher, steigt der Zähler
// nicht. Damit das keine Leermessung ist, steht K0 davor: eine Kalibrierroute mit
// `private, max-age=300` MUSS beim zweiten Abruf aus dem Zwischenspeicher kommen (Zähler bleibt bei
// 1). Fällt K0, kann dieser Aufbau Wiederverwendung gar nicht erkennen, und jede Aussage danach wäre
// wertlos — dann ist die Datei rot, nicht grün.
//
// ZWEI WEGE DER WIEDERVERWENDUNG, beide über beide Anhangsrouten, wo sinnvoll:
//   · `fetch(url)` mit Vorgabe-Cachemodus aus der Seite (wie die Oberfläche Metadaten holt),
//   · die Navigation auf `/raw` (wie ein geöffnetes Original).
//
// WAS DIESE DATEI AUSDRÜCKLICH NICHT BEHAUPTET: dass die lokale Kopie GELÖSCHT wird. Der Server kann
// das nicht. Gemessen wird die Zusage des Vertrags: vor jeder Wiederverwendung fragt der Browser den
// Server, und der verweigert nach dem Entzug sofort — ohne Nachlauffenster.
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

const DATEI = "tests/security/anhang-browsercache-entzug-chromium.test.ts";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const KALIBRIERUNG = "/__kalibrierung/frist";
const STARTSEITE = "/__kalibrierung/seite";

// ---- Playwright, schlank (Muster: `h4-harness.ts`, kein Typimport aus `playwright`) -------------
interface Antwort {
  status(): number;
  headers(): Record<string, string>;
}
type SeitenFn = (arg: unknown) => unknown;
interface Seite {
  goto(url: string, opts?: Record<string, unknown>): Promise<Antwort | null>;
  evaluate<T>(f: SeitenFn, arg: string): Promise<T>;
}
interface Kontext {
  addCookies(c: { name: string; value: string; url: string }[]): Promise<void>;
  newPage(): Promise<Seite>;
  close(): Promise<void>;
}
interface Browser {
  newContext(opts?: Record<string, unknown>): Promise<Kontext>;
  close(): Promise<void>;
}

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

/** Was die Seite über einen `fetch` sieht — gelesen IN der Seite. */
interface Abruf {
  status: number;
  cacheControl: string | null;
  laenge: number;
  /**
   * Trägt der VOLLSTÄNDIGE Rumpf eine Daten-URL (`base64,`)? In der Seite über den ganzen Text
   * bestimmt — `text` unten ist auf 200 Zeichen gekürzt, und in der Metadatenantwort steht `data`
   * erst hinter dem langen `ref`-Block (Nacharbeit 4: die Prüfung am gekürzten Text sah die Bytes
   * nie, und ihre Verneinung wäre wirkungslos gewesen).
   */
  traegtBytes: boolean;
  text: string;
}

// Als Quelltext gebaut (Muster `fn` in `h4-harness.ts`): eine im Testmodul geschriebene Funktion
// liefe durch die Vitest-Transformation und könnte Hilfsaufrufe tragen, die es in der Seite nicht
// gibt. Vorgabe-Cachemodus — der Browser entscheidet nach den Kopfzeilen, wie im Betrieb.
const ABRUFEN = new Function(
  "url",
  `return (async (u) => {
    const res = await fetch(u, { credentials: "same-origin" });
    const text = await res.text();
    return {
      status: res.status,
      cacheControl: res.headers.get("cache-control"),
      laenge: text.length,
      traegtBytes: text.includes("base64,"),
      text: text.slice(0, 200),
    };
  })(url);`,
) as SeitenFn;

let app: App | null = null;
let browser: Browser | null = null;
let basis = "";
const zaehler = new Map<string, number>();
const treffer = (pfad: string): number => zaehler.get(pfad) ?? 0;

async function login(email: string): Promise<Auth & { token: string }> {
  const res = await (app as App).inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  const token = res.json().token as string;
  return { token, authorization: `Bearer ${token}` };
}

/**
 * Alle Kontexte dieses Laufs. Sie werden ERST in `afterAll` geschlossen, vor dem Browser.
 * Nacharbeit 3, gemessen: mit `--single-process` riss das Schließen des K0-Kontexts den ganzen
 * Browser mit („Target page, context or browser has been closed" in E1/E2). Ein Abbau mitten im Lauf
 * ist für die Aussage dieser Datei nicht nötig — jeder Fall hat seinen eigenen Kontext, also seinen
 * eigenen Zwischenspeicher.
 */
const kontexte: Kontext[] = [];

/** Ein Chromium-Kontext, angemeldet über das echte Sitzungs-Cookie. */
async function seiteFuer(token: string): Promise<{ seite: Seite }> {
  const kontext = await (browser as Browser).newContext();
  kontexte.push(kontext);
  await kontext.addCookies([{ name: "kw_session", value: token, url: basis }]);
  const seite = await kontext.newPage();
  await seite.goto(`${basis}${STARTSEITE}`, { waitUntil: "load" });
  return { seite };
}

async function koMitAnhang(autor: Auth, vertraulich: boolean) {
  const a = app as App;
  const up = await a.inject({
    method: "POST",
    url: "/api/objects",
    headers: autor,
    payload: {
      name: "typenschild.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(up.statusCode, up.body).toBe(201);
  const objectId = up.json().id as string;
  const created = await a.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      confidentiality: "intern",
      title: `Anhangsträger ${objectId}`,
      statement: `Ein Objekt, an dem das Original ${objectId} hängt.`,
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const koId = created.json().id as string;
  const attach = await a.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: autor,
    payload: {
      action: "attach",
      attachment: { name: "typenschild.png", mime: "image/png", objectId },
    },
  });
  expect(attach.statusCode, attach.body).toBe(200);
  if (vertraulich) {
    await hochstufen(autor, koId);
  }
  return { koId, objectId };
}

async function hochstufen(autor: Auth, koId: string): Promise<void> {
  const hoch = await (app as App).inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: autor,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(hoch.statusCode, hoch.body).toBe(200);
}

let admin: Auth;
let autor: Auth;
let viewer: Auth & { token: string };
let pruefer: Auth & { token: string };
let prueferId = "";
let fehler: string | null = null;

describe("R-0550 · Rechteentzug gegen die schon gespeicherte Browserkopie (Chromium, echtes HTTP)", () => {
  beforeAll(async () => {
    try {
      process.env.KLARWERK_SKIP_KEYCHAIN = "1";
      app = buildApp(buildServices());
      // K0-Kalibrierung: eine Antwort, die der Browser 300 s ohne Rückfrage verwenden DARF — genau
      // die alte Fünf-Minuten-Form. Dieselbe Vary-Lage wie die Anhänge.
      app.get(KALIBRIERUNG, async (_request, reply) => {
        reply
          .header("Cache-Control", "private, max-age=300")
          .header("Vary", "Cookie, Authorization")
          .type("text/plain")
          .send("kalibrierung");
      });
      app.get(STARTSEITE, async (_request, reply) => {
        reply
          .header("Cache-Control", "no-store")
          .type("text/html; charset=utf-8")
          .send("<!doctype html><title>Anhang-Entzug</title><p>Messseite</p>");
      });

      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Admin", email: "admin@r0550.test", password: "geheim12345" },
      });
      admin = await login("admin@r0550.test");
      for (const [kurz, role] of [
        ["viewer", "viewer"],
        ["autor", "experte"],
        ["pruefer", "controller"],
      ] as const) {
        const res = await app.inject({
          method: "POST",
          url: "/api/users",
          headers: admin,
          payload: { name: kurz, email: `${kurz}@r0550.test`, password: "geheim12345", role },
        });
        if (res.statusCode !== 201) {
          throw new Error(`Konto ${kurz} nicht angelegt: ${res.statusCode} ${res.body}`);
        }
        if (kurz === "pruefer") {
          prueferId = res.json().id as string;
        }
      }
      autor = await login("autor@r0550.test");
      viewer = await login("viewer@r0550.test");
      pruefer = await login("pruefer@r0550.test");

      await app.listen({ port: 0, host: "127.0.0.1" });
      basis = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
      // Der Zähler sitzt am Node-Server selbst, unterhalb von Fastify: jede HTTP-Anfrage, die
      // wirklich ankommt — unabhängig davon, welche Hooks Fastify an welche Route bindet.
      app.server.on("request", (req: { url?: string }) => {
        const pfad = (req.url ?? "").split("?")[0] ?? "";
        zaehler.set(pfad, (zaehler.get(pfad) ?? 0) + 1);
      });

      const verlangeModul = createRequire(import.meta.url);
      const { chromium } = verlangeModul("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      // Ohne `--single-process`/`--no-zygote` (Startform von `gast-nutzerweg/browserweg.ts`, das
      // ebenfalls mehrere Kontexte fährt): in einem Ein-Prozess-Chromium teilen sich Browser und
      // Renderer den Prozess, und das Ende eines Kontexts beendete hier den ganzen Browser.
      browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 5).join(" | ");
    }
  }, 240_000);

  afterAll(async () => {
    for (const kontext of kontexte) {
      await kontext.close().catch(() => undefined);
    }
    await schliesseChromium(DATEI, browser);
    await app?.close();
  }, 120_000);

  it("K0 · KALIBRIERUNG: dieser Aufbau erkennt eine Wiederverwendung aus dem Browser-Zwischenspeicher", async () => {
    expect(fehler).toBeNull();
    const { seite } = await seiteFuer(viewer.token);
    const erst = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${KALIBRIERUNG}`);
    const zweit = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${KALIBRIERUNG}`);
    expect(erst.status).toBe(200);
    expect(zweit.status).toBe(200);
    // Ohne diese Zeile wäre jede Aussage unten eine Leermessung: der Zwischenspeicher hätte gar
    // nicht gegriffen, und „der Server wurde erneut gefragt" bewiese nichts über den Vertrag.
    expect(
      treffer(KALIBRIERUNG),
      "eine Antwort mit max-age=300 muss beim zweiten Abruf aus dem Browser kommen",
    ).toBe(1);
  }, 90_000);

  it("E1 · Hochstufung: zuvor gespeicherte Metadaten und Rohbytes werden nicht wiederverwendet — Server fragt, verweigert sofort", async () => {
    expect(fehler).toBeNull();
    const { koId, objectId } = await koMitAnhang(autor, false);
    const metaPfad = `/api/objects/${objectId}`;
    const rawPfad = `/api/objects/${objectId}/raw`;
    const { seite } = await seiteFuer(viewer.token);
    // 1 · Berechtigt laden — über BEIDE Anhangsrouten, je über fetch; /raw zusätzlich navigiert.
    const meta1 = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${metaPfad}`);
    const raw1 = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${rawPfad}`);
    expect(meta1.status, meta1.text).toBe(200);
    expect(meta1.traegtBytes, "die Metadatenantwort trägt die Bytes als Daten-URL").toBe(true);
    expect(meta1.cacheControl).toBe("private, no-cache, must-revalidate");
    expect(raw1.status, raw1.text).toBe(200);
    expect(raw1.cacheControl).toBe("private, no-cache, must-revalidate");
    expect(raw1.laenge).toBeGreaterThan(0);

    // 2 · KONTROLLE OHNE ENTZUG: auch eine unveränderte Berechtigung geht vor der Wiederverwendung
    //     zum Server. Das ist der Vertrag (`no-cache`), und er ist die Voraussetzung dafür, dass
    //     ein Entzug überhaupt sofort greifen KANN.
    const metaVor = treffer(metaPfad);
    const rawVor = treffer(rawPfad);
    const meta2 = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${metaPfad}`);
    const raw2 = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${rawPfad}`);
    expect(meta2.status).toBe(200);
    expect(raw2.status).toBe(200);
    expect(treffer(metaPfad), "Metadaten: Rückfrage vor Wiederverwendung").toBe(metaVor + 1);
    expect(treffer(rawPfad), "Rohbytes: Rückfrage vor Wiederverwendung").toBe(rawVor + 1);
    const nav1 = await seite.goto(`${basis}${rawPfad}`, { waitUntil: "load" });
    expect(nav1?.status()).toBe(200);
    expect(treffer(rawPfad), "Navigation auf /raw: Rückfrage").toBe(rawVor + 2);

    // 3 · DER ENTZUG — ohne Wartezeit danach.
    await hochstufen(autor, koId);

    // 4 · Erneute Verwendung im SELBEN Browser: der Server wird gefragt und verweigert.
    const metaN = treffer(metaPfad);
    const rawN = treffer(rawPfad);
    const nav2 = await seite.goto(`${basis}${rawPfad}`, { waitUntil: "load" });
    expect(nav2?.status(), "Navigation auf /raw nach dem Entzug").toBe(404);
    expect(nav2?.headers()["cache-control"]).toBe("no-store");
    // Die Seite liegt jetzt auf dem 404 desselben Ursprungs — fetch bleibt same-origin.
    const meta3 = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${metaPfad}`);
    const raw3 = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${rawPfad}`);
    expect(treffer(rawPfad), "Rohbytes: Navigation und fetch fragen beide den Server").toBe(
      rawN + 2,
    );
    expect(treffer(metaPfad), "Metadaten: fetch fragt den Server").toBe(metaN + 1);
    expect(meta3.status, "Metadaten nach dem Entzug").toBe(404);
    expect(raw3.status, "Rohbytes nach dem Entzug").toBe(404);
    expect(meta3.cacheControl).toBe("no-store");
    expect(raw3.cacheControl).toBe("no-store");
    // Keine Bytes aus der alten Kopie: der Rumpf ist die Ablehnung, nicht das Bild.
    expect(meta3.text).toContain("NOT_FOUND");
    expect(meta3.traegtBytes, "keine Bytes nach dem Entzug").toBe(false);
    expect(raw3.text).toContain("NOT_FOUND");
  }, 120_000);

  it("E2 · Rollenentzug: derselbe Prüfer, dasselbe Cookie — nach dem Entzug liefert der Browser keine Kopie", async () => {
    expect(fehler).toBeNull();
    const { objectId } = await koMitAnhang(autor, true);
    const metaPfad = `/api/objects/${objectId}`;
    const rawPfad = `/api/objects/${objectId}/raw`;
    const { seite } = await seiteFuer(pruefer.token);
    const meta1 = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${metaPfad}`);
    const raw1 = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${rawPfad}`);
    expect(meta1.status, meta1.text).toBe(200);
    expect(raw1.status, raw1.text).toBe(200);
    expect(meta1.cacheControl).toBe("no-store");
    expect(raw1.cacheControl).toBe("no-store");

    // Der Admin nimmt dem Prüfer `ko.validate` — der einzige Rollenwechsel, der den Zugriff auf
    // Vertrauliches wirklich entzieht. Das Cookie bleibt gültig.
    const entzug = await (app as App).inject({
      method: "PUT",
      url: `/api/users/${prueferId}`,
      headers: admin,
      payload: { role: "viewer" },
    });
    expect(entzug.statusCode, entzug.body).toBeLessThan(300);

    const metaN = treffer(metaPfad);
    const rawN = treffer(rawPfad);
    const meta2 = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${metaPfad}`);
    const raw2 = await seite.evaluate<Abruf>(ABRUFEN, `${basis}${rawPfad}`);
    const nav = await seite.goto(`${basis}${rawPfad}`, { waitUntil: "load" });
    expect(treffer(metaPfad), "Metadaten: Server gefragt").toBe(metaN + 1);
    expect(treffer(rawPfad), "Rohbytes: fetch und Navigation fragen den Server").toBe(rawN + 2);
    expect(meta2.status).toBe(404);
    expect(raw2.status).toBe(404);
    expect(nav?.status()).toBe(404);
    expect(meta1.traegtBytes, "vor dem Entzug: Metadaten mit Bytes").toBe(true);
    expect(meta2.traegtBytes, "keine Bytes nach dem Entzug").toBe(false);
    expect(raw2.text).toContain("NOT_FOUND");
  }, 120_000);
});
